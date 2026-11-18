import React, { useState } from 'react';
import { Room, Booking, RoomStatus, RoomCategory, BookingSource, PaymentMethod, BookingStatus } from '../types';
import { showToast } from '../utils/toast';
import { 
  Calendar, Layers, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, 
  AlertCircle, Hammer, Move, Sparkles, Plus, Clock, Users 
} from 'lucide-react';

interface CalendarBookingViewProps {
  rooms: Room[];
  bookings: Booking[];
  setActiveTab?: (tab: string) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  onOpenAdvanceBooking?: (prefill: { roomNumber: string; roomType: string; date: string }) => void;
}

interface PriceOverrideEntry {
  id: string;
  category: string;
  fromDate: string;
  toDate: string;
  roomOnlyPrice: number;
  cpPrice?: number;
  mapPrice?: number;
  apPrice?: number;
  label?: string;
}

export default function CalendarBookingView({ 
  rooms, 
  bookings, 
  setActiveTab,
  onUpdateBookings,
  onUpdateRooms,
  onAddAuditLog,
  onOpenAdvanceBooking
}: CalendarBookingViewProps) {
  const [currentCalendarView, setCurrentCalendarView] = useState<'daily' | 'weekly' | 'monthly' | 'priceHistory'>('weekly');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Base system clock

  const hotelStorageKey = `pms_price_history_${rooms[0]?.hotelId || 'default'}`;
  const [priceOverrides, setPriceOverrides] = useState<PriceOverrideEntry[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(hotelStorageKey) : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [phCategory, setPhCategory] = useState<string>(rooms[0]?.category || 'Standard');
  const [phFromDate, setPhFromDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [phToDate, setPhToDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [phRoomOnlyPrice, setPhRoomOnlyPrice] = useState<number>(2000);
  const [phCpPrice, setPhCpPrice] = useState<number>(2300);
  const [phMapPrice, setPhMapPrice] = useState<number>(2700);
  const [phLabel, setPhLabel] = useState<string>('Festival / Seasonal Rate');
  const [editingPhId, setEditingPhId] = useState<string | null>(null);

  // Immediate Click-Booking State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [targetRoomNumber, setTargetRoomNumber] = useState('');
  const [targetRoomType, setTargetRoomType] = useState<RoomCategory>('Standard');
  const [targetRate, setTargetRate] = useState(2500);
  const [targetDateStr, setTargetDateStr] = useState('');
  
  // Quick booking input fields
  const [bookingCustomerType, setBookingCustomerType] = useState<'Personal' | 'Corporate'>('Personal');
  const [companyName, setCompanyName] = useState('');
  const [companyGst, setCompanyGst] = useState('');
  const [mealPlanChoice, setMealPlanChoice] = useState<'EP' | 'CP' | 'MAP' | 'AP'>('EP');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [applyGstBooking, setApplyGstBooking] = useState<boolean>(false);
  const [sourceBookingId, setSourceBookingId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [nightsCount, setNightsCount] = useState(1);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [bkgSource, setBkgSource] = useState<BookingSource>('Walk-in');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');

  // Drag-and-Drop alert state
  const [dragNotice, setDragNotice] = useState('');

  // Date Formatting Helper
  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handlePrevDate = () => {
    const d = new Date(selectedDate);
    if (currentCalendarView === 'monthly') {
      d.setMonth(d.getMonth() - 1);
    } else if (currentCalendarView === 'weekly') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setSelectedDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate);
    if (currentCalendarView === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else if (currentCalendarView === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setSelectedDate(d);
  };

  const jumpToToday = () => {
    setSelectedDate(new Date());
  };

  // Generate 7 visible dates for the WEEKLY timeline
  const generateWeeklyDates = (base: Date): Date[] => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  };

  const weeklyDates = generateWeeklyDates(selectedDate);

  // Status & Colour Evaluation for each Room on a specific Date
  // Green = Available
  // Red = Occupied
  // Yellow = Reserved
  // Blue = Check-In Today
  // Orange = Check-Out Today
  // Grey = Maintenance
  const getRoomComplianceStatus = (room: Room, dateStr: string) => {
    // Maintenance
    const todayStr = formatDateStr(new Date());
    if (room.status === 'Maintenance' && dateStr === todayStr) {
      return {
        code: 'Grey',
        label: 'Maintenance',
        colorClass: 'bg-zinc-400 text-white border-zinc-500',
        textColor: 'text-zinc-600',
        badgeClass: 'bg-zinc-100 text-zinc-700 border border-zinc-300'
      };
    }

    // Find custom dynamic status on this date
    const matchedBooking = bookings.find(
      b => b.roomNumber === room.number && b.status !== 'Cancelled' && dateStr >= b.checkInDate && dateStr <= b.checkOutDate
    );

    if (matchedBooking) {
      // Check if it's a same-day / short-stay booking (e.g. 2 hours)
      if (matchedBooking.checkInDate === matchedBooking.checkOutDate && matchedBooking.checkInDate === dateStr) {
        const timeSlotText = (matchedBooking.checkInTime && matchedBooking.checkOutTime)
          ? `${matchedBooking.checkInTime} - ${matchedBooking.checkOutTime}`
          : matchedBooking.checkInTime
          ? `From ${matchedBooking.checkInTime}`
          : 'Short Stay';
        return {
          code: 'Purple',
          label: `Booked (${timeSlotText}) • Available rest of day`,
          colorClass: 'bg-purple-600 text-white border-purple-700 font-bold',
          textColor: 'text-purple-700',
          badgeClass: 'bg-purple-100 text-purple-800 font-bold border border-purple-300',
          booking: matchedBooking,
          timeSlot: timeSlotText,
          isHourly: true
        };
      }

      if (matchedBooking.checkInDate === dateStr) {
        const timeInfo = matchedBooking.checkInTime ? ` (${matchedBooking.checkInTime})` : '';
        return {
          code: 'Blue',
          label: `Check-In Today${timeInfo}`,
          colorClass: 'bg-blue-600 text-white border-blue-700 font-bold',
          textColor: 'text-blue-700',
          badgeClass: 'bg-blue-100 text-blue-700 font-bold border border-blue-300',
          booking: matchedBooking
        };
      }
      if (matchedBooking.checkOutDate === dateStr) {
        const timeInfo = matchedBooking.checkOutTime ? ` (${matchedBooking.checkOutTime})` : '';
        return {
          code: 'Orange',
          label: `Check-Out Today${timeInfo}`,
          colorClass: 'bg-orange-500 text-white border-orange-600 font-bold',
          textColor: 'text-orange-700',
          badgeClass: 'bg-orange-100 text-orange-700 font-bold border border-orange-300',
          booking: matchedBooking
        };
      }
      if (matchedBooking.isCheckedIn) {
        return {
          code: 'Red',
          label: 'Occupied',
          colorClass: 'bg-red-500 text-white border-red-600',
          textColor: 'text-red-700',
          badgeClass: 'bg-rose-100 text-red-700 border border-red-200',
          booking: matchedBooking
        };
      } else {
        return {
          code: 'Yellow',
          label: 'Reserved',
          colorClass: 'bg-amber-400 text-luxury-brown-950 border-amber-500 font-medium',
          textColor: 'text-amber-700',
          badgeClass: 'bg-amber-100 text-amber-750 border border-amber-300',
          booking: matchedBooking
        };
      }
    }

    return {
      code: 'Green',
      label: 'Available',
      colorClass: 'bg-emerald-500 text-white border-emerald-600',
      textColor: 'text-emerald-700',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    };
  };

  const uniqueCategories = Array.from(new Set(rooms.map(r => r.category).filter(Boolean)));

  const getEffectiveRateForCategoryOnDate = (cat: string, dateStr: string, defaultRate: number): number => {
    const matched = priceOverrides.find(
      po => po.category === cat && dateStr >= po.fromDate && dateStr <= po.toDate
    );
    return matched ? matched.roomOnlyPrice : defaultRate;
  };

  const handleSavePriceOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phCategory || !phFromDate || !phToDate || phRoomOnlyPrice <= 0) {
      showToast('Please select a category, valid date range, and price.', 'warning');
      return;
    }
    const entry: PriceOverrideEntry = {
      id: editingPhId || `PH-${Date.now()}`,
      category: phCategory,
      fromDate: phFromDate,
      toDate: phToDate,
      roomOnlyPrice: Number(phRoomOnlyPrice),
      cpPrice: Number(phCpPrice) || Number(phRoomOnlyPrice) + 300,
      mapPrice: Number(phMapPrice) || Number(phRoomOnlyPrice) + 700,
      label: phLabel.trim() || 'Seasonal / Festival Rate'
    };
    const nextList = editingPhId
      ? priceOverrides.map(p => (p.id === editingPhId ? entry : p))
      : [entry, ...priceOverrides];
    setPriceOverrides(nextList);
    try {
      localStorage.setItem(hotelStorageKey, JSON.stringify(nextList));
    } catch {}
    onAddAuditLog?.(
      'Price History Updated',
      `Set ${phCategory} rate to ₹${phRoomOnlyPrice}/N from ${phFromDate} to ${phToDate} (${entry.label}).`
    );
    showToast(`Saved ${phCategory} price ₹${phRoomOnlyPrice}/N for ${phFromDate} → ${phToDate}`, 'success');
    setEditingPhId(null);
  };

  const handleDeletePriceOverride = (id: string) => {
    const nextList = priceOverrides.filter(p => p.id !== id);
    setPriceOverrides(nextList);
    try {
      localStorage.setItem(hotelStorageKey, JSON.stringify(nextList));
    } catch {}
    showToast('Removed price history override.', 'info');
  };

  // Click on Available cell action
  const handleCellClick = (room: Room, dateStr: string) => {
    const compliance = getRoomComplianceStatus(room, dateStr);
    if (compliance.code === 'Green' || compliance.code === 'Purple') {
      if (onOpenAdvanceBooking) {
        onOpenAdvanceBooking({
          roomNumber: room.number,
          roomType: room.category,
          date: dateStr
        });
        return;
      }
      const effectiveRate = getEffectiveRateForCategoryOnDate(room.category, dateStr, room.rate);
      setTargetRoomNumber(room.number);
      setTargetRoomType(room.category);
      setTargetRate(effectiveRate);
      setTargetDateStr(dateStr);
      
      // Seed inputs
      setBookingCustomerType('Personal');
      setCompanyName('');
      setCompanyGst('');
      setMealPlanChoice('EP');
      setDiscountAmount(0);
      setApplyGstBooking(false);
      setSourceBookingId('');
      setGuestName('');
      setGuestMobile('');
      setNightsCount(1);
      setAdvancePaid(0);

      setIsBookModalOpen(true);
    } else if (compliance.booking) {
      // Direct deep-link click representation
      setDragNotice(`Booking ID: ${compliance.booking.id} • Assigned to ${compliance.booking.guestName}. Move by dragging this block.`);
      setTimeout(() => setDragNotice(''), 5000);
    }
  };

  // Instant booking save directly from Calendar
  const handleSaveInstantBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestMobile) {
      showToast('Guest name and contact number are mandatory.', 'warning');
      return;
    }

    // Calculate dates
    const checkIn = new Date(targetDateStr);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + Number(nightsCount));

    const mealExtra =
      mealPlanChoice === 'CP' ? 300 : mealPlanChoice === 'MAP' ? 700 : mealPlanChoice === 'AP' ? 1100 : 0;
    const grossRoomAmt = (Number(targetRate) + mealExtra) * Math.max(1, Number(nightsCount));
    const netRoomAmt = Math.max(0, grossRoomAmt - Math.max(0, Number(discountAmount) || 0));
    const gstRateVal = applyGstBooking ? 5 : 0;
    const gstAmtVal = applyGstBooking ? parseFloat(((netRoomAmt * 5) / 100).toFixed(2)) : 0;

    const noteDetails = [
      `Direct Booking via Room Calendar (${bookingCustomerType} • Plan: ${mealPlanChoice})`,
      bookingCustomerType === 'Corporate' && companyName.trim() ? `Company: ${companyName.trim()}` : '',
      bookingCustomerType === 'Corporate' && companyGst.trim() ? `GSTIN: ${companyGst.trim()}` : '',
      sourceBookingId.trim() ? `Source ID: ${sourceBookingId.trim()}` : '',
      discountAmount > 0 ? `Discount: ₹${discountAmount}` : ''
    ].filter(Boolean).join(' • ');

    const newBooking: Booking = {
      id: `GP-BKG-${1000 + bookings.length + 1}`,
      guestName,
      mobile: guestMobile,
      email: `${guestName.toLowerCase().replace(/\s+/g, '')}@pms.com`,
      aadhaarNumber: 'PENDING_REGISTRATION',
      address: bookingCustomerType === 'Corporate' && companyName ? companyName : 'Checked-In from Visual Calendar Desk',
      checkInDate: targetDateStr,
      checkOutDate: formatDateStr(checkOut),
      nights: Number(nightsCount),
      adults: 1,
      children: 0,
      roomNumber: targetRoomNumber,
      roomType: targetRoomType,
      advanceAmount: Number(advancePaid),
      bookingAmount: netRoomAmt,
      gstRate: gstRateVal,
      gstAmount: gstAmtVal,
      paymentMethod: payMethod,
      bookingSource: bkgSource,
      transactionId: sourceBookingId.trim() || undefined,
      status: 'Confirmed',
      notes: noteDetails
    };

    // Update global state
    onUpdateBookings([newBooking, ...bookings]);
    onAddAuditLog?.(
      'Calendar Booking Created',
      `Booked Suite ${targetRoomNumber} (${targetRoomType}) for ${guestName} from ${targetDateStr} for ${nightsCount} night(s) via ${bkgSource} (ID: ${newBooking.id}).`
    );
    setIsBookModalOpen(false);

    setDragNotice(`Success! Suite ${targetRoomNumber} booked for ${guestName} successfully.`);
    setTimeout(() => setDragNotice(''), 4000);
  };

  // DRAG & DROP BOOKING RESCHEDULE HANDLERS
  const handleDragStart = (e: React.DragEvent, bookingId: string) => {
    e.dataTransfer.setData('text/plain', bookingId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnCell = (e: React.DragEvent, targetRoom: Room, targetDate: string) => {
    e.preventDefault();
    const bkgId = e.dataTransfer.getData('text/plain');
    if (!bkgId) return;

    // Verify cell is vacant
    const cellStatus = getRoomComplianceStatus(targetRoom, targetDate);
    if (cellStatus.code !== 'Green' && cellStatus.booking?.id !== bkgId) {
      showToast(`Conflict: Cannot shift booking to Suite ${targetRoom.number} on ${targetDate}. Under "${cellStatus.label}" allocation.`, 'error');
      return;
    }

    // Update target booking checkIn / room assigned
    const updatedBookings = bookings.map(b => {
      if (b.id === bkgId) {
        // preserve nights gap
        const nights = b.nights || 1;
        const newCheckIn = new Date(targetDate);
        const newCheckOut = new Date(newCheckIn);
        newCheckOut.setDate(newCheckOut.getDate() + nights);

        return {
          ...b,
          roomNumber: targetRoom.number,
          roomType: targetRoom.category,
          checkInDate: targetDate,
          checkOutDate: formatDateStr(newCheckOut),
          notes: `${b.notes || ''} Moved via Drag-and-Drop to Room ${targetRoom.number} on ${targetDate}.`
        };
      }
      return b;
    });

    onUpdateBookings(updatedBookings);
    onAddAuditLog?.(
      'Booking Rescheduled',
      `Shifted Booking ${bkgId} via Calendar drag-and-drop to Room ${targetRoom.number} starting ${targetDate}.`
    );
    setDragNotice(`✓ Decisively shifted Booking ${bkgId} to Room ${targetRoom.number} on check-in date ${targetDate}!`);
    setTimeout(() => setDragNotice(''), 5000);
  };

  // Monthly logic parameters
  const firstDayIdx = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
  const totalDaysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const monthsArr = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-luxury-brown-100 pb-4">
        <div>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#C5A059]" /> Visual Room Booking Calendar
          </h1>
          <p className="text-xs text-luxury-brown-500">
            Real-time interactive matrix: Click available cells to book directly or drag booking blocks to reschedule.
          </p>
        </div>
        
        {/* View Switches */}
        <div className="mt-3 md:mt-0 grid grid-cols-2 sm:flex sm:flex-wrap gap-1 p-1 bg-luxury-beige-100/80 rounded-xl border border-luxury-brown-100/50 w-full md:w-auto">
          <button
            onClick={() => setCurrentCalendarView('daily')}
            className={`px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              currentCalendarView === 'daily' ? 'bg-luxury-brown-950 text-white shadow-xs' : 'text-luxury-brown-700 hover:bg-white/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Daily View</span>
          </button>
          
          <button
            onClick={() => {
              setCurrentCalendarView('weekly');
              jumpToToday();
            }}
            className={`px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              currentCalendarView === 'weekly' ? 'bg-luxury-brown-950 text-white shadow-xs' : 'text-luxury-brown-700 hover:bg-white/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Weekly View</span>
          </button>
          
          <button
            onClick={() => setCurrentCalendarView('monthly')}
            className={`px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              currentCalendarView === 'monthly' ? 'bg-luxury-brown-950 text-white shadow-xs' : 'text-luxury-brown-700 hover:bg-white/50'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Monthly View</span>
          </button>

          <button
            onClick={() => setCurrentCalendarView('priceHistory')}
            className={`px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              currentCalendarView === 'priceHistory' ? 'bg-luxury-brown-950 text-white shadow-xs' : 'text-luxury-brown-700 hover:bg-white/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Price History & Rates</span>
          </button>
        </div>
      </div>

      {dragNotice && (
        <div className="bg-[#C5A059]/10 border border-[#C5A059] text-luxury-brown-950 text-xs py-2 px-4 rounded-xl font-mono text-center animate-pulse">
          <strong>Interactive Radar:</strong> {dragNotice}
        </div>
      )}

      {/* Date Navigation Bar */}
      <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4.5 flex justify-between items-center shadow-xs">
        <button
          onClick={handlePrevDate}
          className="p-2 border border-luxury-brown-200 rounded-xl hover:bg-luxury-beige-100 transition shadow-xs cursor-pointer"
          title="Backwards"
        >
          <ChevronLeft className="w-5 h-5 text-luxury-brown-800" />
        </button>
        
        <div className="text-center space-y-0.5">
          <h2 className="text-lg font-serif font-bold text-luxury-brown-950 tracking-wide uppercase">
            {currentCalendarView === 'monthly'
              ? `${monthsArr[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
              : selectedDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            }
          </h2>
          <div className="flex gap-2 justify-center items-center">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#C5A059] font-bold">
              CLOCK: {formatDateStr(new Date())} • Live Desk
            </span>
          </div>
        </div>

        <button
          onClick={handleNextDate}
          className="p-2 border border-luxury-brown-200 rounded-xl hover:bg-luxury-beige-100 transition shadow-xs cursor-pointer"
          title="Forwards"
        >
          <ChevronRight className="w-5 h-5 text-luxury-brown-800" />
        </button>
      </div>

      {/* Color Legend segment */}
      <div className="bg-[#FCFAF2] border border-[#f4efdf] px-4 py-3 rounded-2xl flex flex-wrap gap-4 text-[10.5px] font-mono justify-center lg:justify-between items-center">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded" /> <span className="text-emerald-700 font-bold">Green = Available</span> (Click to Book)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500 rounded" /> <span className="text-red-700 font-bold">Red = Occupied</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-400 rounded" /> <span className="text-amber-500 font-bold">Yellow = Reserved</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-600 rounded" /> <span className="text-blue-600 font-bold">Blue = Check-In Today</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-orange-500 rounded" /> <span className="text-orange-500 font-bold">Orange = Check-Out Today</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-purple-600 rounded" /> <span className="text-purple-600 font-bold">Purple = Short Stay / Hourly</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-zinc-400 rounded" /> <span className="text-zinc-500 font-bold">Grey = Maintenance</span></div>
      </div>

      {/* VIEW SECTION 1: DAILY VIEW */}
      {currentCalendarView === 'daily' && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="border-b border-luxury-gold-500/10 pb-3 flex justify-between items-center">
            <h3 className="font-serif text-md text-luxury-brown-900 font-bold">
              Room Status Roster & Occupancy breakdown
            </h3>
            <span className="text-[10px] font-mono text-luxury-brown-400 font-bold capitalize">
              Date: {formatDateStr(selectedDate)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => {
              const compliance = getRoomComplianceStatus(room, formatDateStr(selectedDate));
              return (
                <div 
                  key={room.id}
                  className="p-4 border border-luxury-brown-200/60 rounded-xl relative hover:border-luxury-gold-300 transition-all flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-base font-serif font-bold text-luxury-brown-950">Suite {room.number}</span>
                      <p className="text-[10.5px] text-luxury-brown-400 font-mono capitalize">{room.category} • ₹{room.rate}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-mono tracking-wider font-bold ${compliance.badgeClass}`}>
                      {compliance.label}
                    </span>
                  </div>

                  {/* Guest status block if scheduled */}
                  <div className="mt-4 pt-3 border-t border-luxury-brown-100/60 flex-1 flex flex-col justify-end">
                    {compliance.booking ? (
                      <div className="bg-luxury-beige-100/30 p-2.5 rounded-lg space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <strong className="text-luxury-brown-950">{compliance.booking.guestName}</strong>
                          <span className="font-mono text-gray-500">{compliance.booking.mobile}</span>
                        </div>
                        <p className="text-[10px] text-luxury-brown-500 font-mono">
                          Duration: {compliance.booking.checkInDate} to {compliance.booking.checkOutDate} ({compliance.booking.nights}N)
                        </p>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span>Source: <strong className="text-teal-700">{compliance.booking.bookingSource}</strong></span>
                          <span>Advance: <strong>₹{compliance.booking.advanceAmount}</strong></span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2.5 text-center">
                        <button
                          onClick={() => handleCellClick(room, formatDateStr(selectedDate))}
                          className="px-4 py-1.5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 font-serif font-bold text-xs hover:bg-emerald-100 hover:border-emerald-400 transition cursor-pointer"
                        >
                          + Direct Calendar Book
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW SECTION 2: WEEKLY VIEW (GANTT Timeline style with HTML5 drag-and-drop) */}
      {currentCalendarView === 'weekly' && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-luxury-brown-950 text-white flex justify-between items-center border-b border-luxury-gold-500/20">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-luxury-gold-400 animate-pulse" />
              <h3 className="font-serif text-sm font-semibold text-luxury-gold-200">
                Weekly Grid Timeline (Drag-and-Drop Reschedule)
              </h3>
            </div>
            <span className="text-[10px] tracking-wider uppercase font-mono bg-white/10 px-2 py-0.5 rounded text-white font-bold">
              Drop over Vacant cells to shift bookings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs divide-y divide-luxury-brown-100">
              <thead className="bg-luxury-beige-100/50 text-luxury-brown-700">
                <tr>
                  <th className="p-3 sticky left-0 bg-luxury-beige-100/90 z-10 w-28 border-r border-luxury-brown-205 font-bold font-serif leading-tight">
                    Suite (Type)
                  </th>
                  {weeklyDates.map(d => {
                    const dStr = formatDateStr(d);
                    const todayStr = formatDateStr(new Date());
                    const isTodayRef = dStr === todayStr;
                    return (
                      <th 
                        key={dStr}
                        className={`p-3 text-center border-r border-luxury-brown-100/65 min-w-24 ${
                          isTodayRef ? 'bg-luxury-gold-100 text-luxury-brown-950 font-extrabold font-mono border-x-2 border-x-[#C5A059]' : ''
                        }`}
                      >
                        <div className="text-xs uppercase tracking-wider">{d.toLocaleString('en-IN', { weekday: 'short' })}</div>
                        <div className="text-sm font-serif font-bold">{d.getDate()} {monthsArr[d.getMonth()].slice(0, 3)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100 font-medium">
                {rooms.map(room => (
                  <tr key={room.id} className="hover:bg-luxury-beige-50/50 transition-colors" data-testid={`row-${room.number}`}>
                    <td className="p-3 sticky left-0 bg-white z-10 border-r border-luxury-brown-200 font-bold shadow-xs flex flex-col justify-center">
                      <span className="text-luxury-brown-955 text-sm">Suite {room.number}</span>
                      <span className="text-[9px] font-mono text-luxury-gold-700 uppercase font-bold tracking-tight">
                        {room.category.split(' ')[0]}
                      </span>
                    </td>

                    {/* Timeline Date Grids */}
                    {weeklyDates.map(date => {
                      const dStr = formatDateStr(date);
                      const compliance = getRoomComplianceStatus(room, dStr);
                      const todayStr = formatDateStr(new Date());
                      const isTodayRef = dStr === todayStr;

                      return (
                        <td
                          key={dStr}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropOnCell(e, room, dStr)}
                          onClick={() => handleCellClick(room, dStr)}
                          className={`p-1.5 text-center border-r border-luxury-brown-105 text-[10.5px] transition-colors relative cursor-pointer min-h-16 ${
                            isTodayRef ? 'bg-luxury-gold-50/20' : ''
                          } ${
                            compliance.code === 'Green' ? 'hover:bg-emerald-505/10' : ''
                          }`}
                        >
                          {compliance.booking ? (
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, compliance.booking!.id)}
                              className={`rounded-lg p-2 text-center text-[10px] select-none font-bold uppercase cursor-grab active:cursor-grabbing shadow-xs transition duration-250 ${compliance.colorClass}`}
                              title={`Draggable • Guest: ${compliance.booking.guestName} (${compliance.label})`}
                            >
                              <div className="flex items-center justify-center gap-1 font-serif text-[11px] truncate">
                                <Move className="w-3 h-3 text-white/50 shrink-0" />
                                {compliance.booking.guestName.split(' ')[0]}
                              </div>
                              <span className="text-[8px] font-mono block tracking-tight opacity-95 mt-0.5">
                                {compliance.booking.id.slice(-4)} • {compliance.label.slice(0, 6)}
                              </span>
                            </div>
                          ) : (
                            <div className="py-3 group text-center min-h-11 flex flex-col items-center justify-center">
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded opacity-80 group-hover:opacity-100 transition-opacity">
                                Vacant
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW SECTION 3: MONTHLY VIEW (With stats and date selections) */}
      {currentCalendarView === 'monthly' && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono font-bold text-luxury-brown-700 border-b border-luxury-brown-100 pb-3">
            <div>Sunday</div>
            <div>Monday</div>
            <div>Tuesday</div>
            <div>Wednesday</div>
            <div>Thursday</div>
            <div>Friday</div>
            <div>Saturday</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Blanks */}
            {Array.from({ length: firstDayIdx }).map((_, idx) => (
              <div key={`month-blank-${idx}`} className="bg-luxury-beige-50/20 aspect-video rounded-xl border border-luxury-brown-100/30" />
            ))}

            {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateObj = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
              const dateStr = formatDateStr(dateObj);
              const todayStr = formatDateStr(new Date());
              const isTodayRef = dateStr === todayStr;

              // Occupied rooms calculation on this date
              const occupiedOnThisDateBookings = bookings.filter(
                b => b.status === 'Confirmed' && dateStr >= b.checkInDate && dateStr <= b.checkOutDate
              );
              const occupancyFraction = rooms.length > 0 ? (occupiedOnThisDateBookings.length / rooms.length) : 0;

              return (
                <div
                  key={`month-day-${day}`}
                  onClick={() => {
                    setSelectedDate(dateObj);
                    setCurrentCalendarView('daily');
                  }}
                  className={`aspect-video p-2 border border-luxury-brown-150 rounded-xl transition-all cursor-pointer flex flex-col justify-between hover:border-luxury-gold-400 ${
                    isTodayRef 
                      ? 'bg-luxury-gold-55 border-luxury-gold-400 font-bold ring-2 ring-luxury-gold-400/20' 
                      : 'bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-bold">{day}</span>
                    {isTodayRef && (
                      <span className="text-[8px] bg-[#C5A059] text-luxury-brown-950 font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                        Clock
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {occupiedOnThisDateBookings.length > 0 ? (
                      <div className="text-[9px] font-mono leading-tight">
                        <span className={`px-1.5 py-0.5 rounded text-center block ${
                          occupancyFraction > 0.6 ? 'bg-rose-50 text-rose-700 font-bold' :
                          occupancyFraction > 0.3 ? 'bg-amber-50 text-amber-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {occupiedOnThisDateBookings.length} Suites ({Math.round(occupancyFraction * 100)}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-[8px] text-emerald-600 font-mono block text-center bg-emerald-50 rounded">
                        100% Vacant
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW SECTION 4: PRICE HISTORY & SEASONAL / FESTIVAL RATES */}
      {currentCalendarView === 'priceHistory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add / Edit Date-Range Price Override Form */}
            <form
              onSubmit={handleSavePriceOverride}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs space-y-4 h-fit"
            >
              <div className="border-b border-luxury-brown-100 pb-3">
                <h3 className="font-serif font-bold text-sm text-luxury-brown-950 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#C5A059]" />
                  {editingPhId ? 'Edit Date-Range Price Override' : 'Add Price History / Festival Rate'}
                </h3>
                <p className="text-[11px] text-luxury-brown-500 mt-0.5">
                  Change room category pricing for a specific festival, weekend, or date range.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">
                    Room Category *
                  </label>
                  <select
                    value={phCategory}
                    onChange={e => setPhCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl bg-white font-semibold"
                  >
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">
                      From Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={phFromDate}
                      onChange={e => setPhFromDate(e.target.value)}
                      className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-xl bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">
                      To Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={phFromDate}
                      value={phToDate}
                      onChange={e => setPhToDate(e.target.value)}
                      className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-xl bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">
                    Only Room Price (EP • ₹ / Night) *
                  </label>
                  <input
                    type="number"
                    min={100}
                    required
                    value={phRoomOnlyPrice}
                    onChange={e => {
                      const v = Number(e.target.value) || 0;
                      setPhRoomOnlyPrice(v);
                      setPhCpPrice(v + 300);
                      setPhMapPrice(v + 700);
                    }}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl bg-white font-mono font-bold text-luxury-brown-950"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">
                      With Breakfast (CP ₹)
                    </label>
                    <input
                      type="number"
                      min={100}
                      value={phCpPrice}
                      onChange={e => setPhCpPrice(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">
                      Breakfast+Dinner (MAP ₹)
                    </label>
                    <input
                      type="number"
                      min={100}
                      value={phMapPrice}
                      onChange={e => setPhMapPrice(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">
                    Occasion / Label
                  </label>
                  <input
                    type="text"
                    value={phLabel}
                    onChange={e => setPhLabel(e.target.value)}
                    placeholder="e.g. Diwali Festival / Weekend Offer"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl bg-white"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-luxury-brown-950 hover:bg-black text-luxury-gold-300 font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    {editingPhId ? 'Update Price History' : 'Save All Prices'}
                  </button>
                  {editingPhId && (
                    <button
                      type="button"
                      onClick={() => setEditingPhId(null)}
                      className="px-3 py-2.5 border border-luxury-brown-200 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Right 2 Columns: Date-Wise Category Rate Matrix & Saved Price History */}
            <div className="lg:col-span-2 space-y-5">
              {/* Date-wise Active Category Price Matrix */}
              <div className="bg-white border border-luxury-brown-100 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 bg-luxury-brown-950 text-white flex justify-between items-center">
                  <h3 className="font-serif text-sm font-semibold text-luxury-gold-200">
                    Date-Wise Room Category Tariff Matrix (Active Rates)
                  </h3>
                  <span className="text-[10px] font-mono text-luxury-gold-400">
                    Festival / Date Overrides Highlighted in Gold
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs border-collapse divide-y divide-luxury-brown-100">
                    <thead className="bg-luxury-beige-100/60 text-luxury-brown-800">
                      <tr>
                        <th className="p-3 font-serif font-bold border-r border-luxury-brown-100">Category</th>
                        {weeklyDates.map(d => {
                          const dStr = formatDateStr(d);
                          return (
                            <th key={dStr} className="p-2.5 text-center border-r border-luxury-brown-100 font-mono">
                              <div className="text-[10px] uppercase">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                              <div className="font-bold text-xs">{d.getDate()} {monthsArr[d.getMonth()].slice(0, 3)}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-luxury-brown-100">
                      {uniqueCategories.map(cat => {
                        const baseRoom = rooms.find(r => r.category === cat);
                        const baseRate = baseRoom?.rate || 2000;
                        return (
                          <tr key={cat}>
                            <td className="p-3 font-serif font-bold text-luxury-brown-950 border-r border-luxury-brown-100">
                              <div>{cat}</div>
                              <span className="text-[10px] font-mono text-luxury-brown-400">Standard: ₹{baseRate}/N</span>
                            </td>
                            {weeklyDates.map(d => {
                              const dStr = formatDateStr(d);
                              const eff = getEffectiveRateForCategoryOnDate(cat, dStr, baseRate);
                              const isOverridden = eff !== baseRate;
                              return (
                                <td
                                  key={dStr}
                                  className={`p-2.5 text-center font-mono border-r border-luxury-brown-100 ${
                                    isOverridden ? 'bg-amber-50 font-extrabold text-amber-900' : 'text-luxury-brown-800'
                                  }`}
                                >
                                  <div>₹{Number(eff || 0).toLocaleString('en-IN')}</div>
                                  <span className="text-[9px] text-luxury-brown-400 block">
                                    {isOverridden ? '★ Override' : 'Base Rate'}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price History Log Table */}
              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs space-y-3">
                <h4 className="font-serif font-bold text-sm text-luxury-brown-950">
                  Saved Price History & Date-Range Rate Overrides ({priceOverrides.length})
                </h4>
                {priceOverrides.length === 0 ? (
                  <p className="text-xs text-luxury-brown-400 italic py-4 text-center">
                    No custom date-range price overrides added yet. Use the form on the left to set festival or seasonal pricing.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-luxury-beige-50 border-b border-luxury-brown-100 font-mono text-[10px] uppercase text-luxury-brown-600">
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5">Date Range</th>
                          <th className="p-2.5">Room Only (EP)</th>
                          <th className="p-2.5">CP / MAP</th>
                          <th className="p-2.5">Label</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-luxury-brown-100 font-mono">
                        {priceOverrides.map(po => (
                          <tr key={po.id} className="hover:bg-luxury-beige-50/40">
                            <td className="p-2.5 font-serif font-bold text-luxury-brown-950">{po.category}</td>
                            <td className="p-2.5 text-luxury-brown-700">{po.fromDate} → {po.toDate}</td>
                            <td className="p-2.5 font-bold text-emerald-700">₹{Number(po.roomOnlyPrice || 0).toLocaleString('en-IN')}</td>
                            <td className="p-2.5 text-luxury-brown-600">
                              ₹{Number(po.cpPrice || Number(po.roomOnlyPrice || 0) + 300).toLocaleString('en-IN')} / ₹{Number(po.mapPrice || Number(po.roomOnlyPrice || 0) + 700).toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 font-sans text-luxury-brown-700">{po.label}</td>
                            <td className="p-2.5 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPhId(po.id);
                                  setPhCategory(po.category);
                                  setPhFromDate(po.fromDate);
                                  setPhToDate(po.toDate);
                                  setPhRoomOnlyPrice(po.roomOnlyPrice);
                                  setPhCpPrice(po.cpPrice || po.roomOnlyPrice + 300);
                                  setPhMapPrice(po.mapPrice || po.roomOnlyPrice + 700);
                                  setPhLabel(po.label || '');
                                }}
                                className="px-2.5 py-1 rounded bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 font-bold text-[10px] cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePriceOverride(po.id)}
                                className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: QUICK CALENDAR BOOKING POPUP */}
      {isBookModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-luxury-brown-100 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3 mb-4">
              <div>
                <h3 className="text-md font-serif font-bold text-luxury-brown-950">Direct Calendar Room Booking</h3>
                <p className="text-[10px] text-gray-500 font-mono">Pre-allocated on check-in date: {targetDateStr}</p>
              </div>
              <button 
                onClick={() => setIsBookModalOpen(false)}
                className="text-luxury-brown-405 hover:text-luxury-brown-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInstantBooking} className="space-y-4 text-xs font-sans">
              {/* Personal vs Corporate Booking Switch */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-luxury-beige-100/70 rounded-xl border border-luxury-brown-200">
                <button
                  type="button"
                  onClick={() => setBookingCustomerType('Personal')}
                  className={`py-1.5 rounded-lg font-serif font-bold text-xs cursor-pointer transition-all ${
                    bookingCustomerType === 'Personal'
                      ? 'bg-luxury-brown-950 text-luxury-gold-300 shadow-xs'
                      : 'text-luxury-brown-700'
                  }`}
                >
                  Personal Booking
                </button>
                <button
                  type="button"
                  onClick={() => setBookingCustomerType('Corporate')}
                  className={`py-1.5 rounded-lg font-serif font-bold text-xs cursor-pointer transition-all ${
                    bookingCustomerType === 'Corporate'
                      ? 'bg-luxury-brown-950 text-luxury-gold-300 shadow-xs'
                      : 'text-luxury-brown-700'
                  }`}
                >
                  Corporate Booking
                </button>
              </div>

              {bookingCustomerType === 'Corporate' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-luxury-beige-50 rounded-xl border border-luxury-gold-500/30">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="Business / Company Name"
                      className="w-full px-3 py-1.5 border rounded-lg bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Company GSTIN</label>
                    <input
                      type="text"
                      value={companyGst}
                      onChange={e => setCompanyGst(e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5"
                      className="w-full px-3 py-1.5 border rounded-lg bg-white font-mono uppercase"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-luxury-beige-100/50 rounded-xl grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                <div>
                  <span className="text-gray-400 block uppercase">Allocated Room</span>
                  <strong className="text-teal-700 text-sm">Suite {targetRoomNumber}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase">Category</span>
                  <strong className="text-luxury-brown-900 text-xs truncate capitalize block">{targetRoomType}</strong>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase">Nightly Rate (Editable)</span>
                  <input
                    type="number"
                    min={100}
                    value={targetRate}
                    onChange={e => setTargetRate(Number(e.target.value) || 0)}
                    className="w-24 mx-auto mt-0.5 px-2 py-0.5 border border-luxury-brown-300 rounded text-center font-bold text-luxury-brown-950 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {/* Guest Particulars */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Complete Name *</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Ramesh Chandra Das"
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Mobile Contact *</label>
                    <input
                      type="text"
                      required
                      value={guestMobile}
                      onChange={(e) => setGuestMobile(e.target.value)}
                      placeholder="10 digit number"
                      className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Stay Duration (Nights)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={nightsCount}
                      onChange={(e) => setNightsCount(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Meal Plan</label>
                    <select
                      value={mealPlanChoice}
                      onChange={e => setMealPlanChoice(e.target.value as any)}
                      className="w-full px-2.5 py-2 border rounded-lg bg-white"
                    >
                      <option value="EP">EP (Room Only)</option>
                      <option value="CP">CP (+₹300/N)</option>
                      <option value="MAP">MAP (+₹700/N)</option>
                      <option value="AP">AP (+₹1100/N)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Booking Channel</label>
                    <select
                      value={bkgSource}
                      onChange={(e) => setBkgSource(e.target.value as any)}
                      className="w-full px-2.5 py-2 border rounded-lg bg-white"
                    >
                      <option value="Walk-in">Walk-in</option>
                      <option value="Agoda">Agoda</option>
                      <option value="OYO">OYO</option>
                      <option value="MakeMyTrip">MakeMyTrip</option>
                      <option value="Booking.com">Booking.com</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Source Booking ID</label>
                    <input
                      type="text"
                      value={sourceBookingId}
                      onChange={e => setSourceBookingId(e.target.value)}
                      placeholder="OTA / Ref ID"
                      className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600 block">Advance Prepaid (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-luxury-beige-50 p-3 rounded-xl border border-luxury-brown-200">
                  <label className="flex items-center gap-2 font-bold text-luxury-brown-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyGstBooking}
                      onChange={e => setApplyGstBooking(e.target.checked)}
                      className="w-4 h-4 accent-luxury-gold-600"
                    />
                    <span>GST Booking (Apply 5% GST Tax)</span>
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="px-3 py-1.5 border rounded-lg bg-white font-bold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI (QR)</option>
                    <option value="Card">Visa / Card</option>
                    <option value="Online">Online Trans</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2.5 pt-3 border-t justify-end">
                {onOpenAdvanceBooking && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBookModalOpen(false);
                      onOpenAdvanceBooking({
                        roomNumber: targetRoomNumber,
                        roomType: targetRoomType,
                        date: targetDateStr
                      });
                    }}
                    className="px-4 py-2 rounded-xl bg-luxury-gold-500 hover:bg-luxury-gold-600 text-luxury-brown-950 font-bold text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    Open in Advance Booking Form →
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-serif font-bold text-xs cursor-pointer shadow-sm"
                >
                  ✓ Complete Instant Booking
                </button>
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-5 py-2 rounded-xl border hover:bg-gray-150 text-gray-750 font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
