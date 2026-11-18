import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Hotel, Room, Booking, PaymentMethod } from '../types';
import { showToast } from '../utils/toast';
import {
  Hotel as HotelIcon,
  Calendar,
  Bed,
  Users,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  Copy,
  Share2,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileCheck,
  Building2,
  Check,
  X
} from 'lucide-react';

interface HotelPublicBookingPageProps {
  hotel: Hotel;
  rooms: Room[];
  bookings: Booking[];
  isAuthenticatedStaff?: boolean;
  onBackToDashboard?: () => void;
  onOpenAdvanceBookings?: () => void;
  onApprovePendingBooking?: (bookingId: string) => void;
  onRejectPendingBooking?: (bookingId: string) => void;
  onSubmitGuestBooking: (booking: Booking) => void;
}

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getTodayStr = () => formatDateStr(new Date());
const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateStr(d);
};

export default function HotelPublicBookingPage({
  hotel: propHotel,
  rooms: propRooms,
  bookings: propBookings,
  isAuthenticatedStaff = false,
  onBackToDashboard,
  onOpenAdvanceBookings,
  onApprovePendingBooking,
  onRejectPendingBooking,
  onSubmitGuestBooking
}: HotelPublicBookingPageProps) {
  const [liveHotel, setLiveHotel] = useState<Hotel | null>(null);
  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);

  const hotel = liveHotel || propHotel;
  const rooms = useMemo(() => {
    if (propRooms && propRooms.length > 0) return propRooms;
    return liveRooms;
  }, [propRooms, liveRooms]);

  const bookings = useMemo(() => {
    const map = new Map<string, Booking>();
    (liveBookings || []).forEach(b => {
      if (b && b.id) map.set(b.id, b);
    });
    (propBookings || []).forEach(b => {
      if (b && b.id) map.set(b.id, b);
    });
    return Array.from(map.values());
  }, [propBookings, liveBookings]);

  const fetchPublicHotelData = useCallback(async () => {
    if (!propHotel?.id) return;
    try {
      const res = await fetch(`/api/public/hotel-booking/${encodeURIComponent(propHotel.id)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json?.success && json.data) {
        if (json.data.hotel) setLiveHotel(json.data.hotel);
        if (Array.isArray(json.data.rooms)) setLiveRooms(json.data.rooms);
        if (Array.isArray(json.data.bookings)) setLiveBookings(json.data.bookings);
      }
    } catch {}
  }, [propHotel?.id]);

  useEffect(() => {
    fetchPublicHotelData();
    const timer = setInterval(fetchPublicHotelData, 10000);
    return () => clearInterval(timer);
  }, [fetchPublicHotelData]);

  const [calendarStartDate, setCalendarStartDate] = useState<Date>(new Date());
  const [checkInDate, setCheckInDate] = useState<string>(getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState<string>(getTomorrowStr());
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>(rooms[0]?.number || '');

  useEffect(() => {
    if (!selectedRoomNumber && rooms.length > 0) {
      setSelectedRoomNumber(rooms[0].number);
    }
  }, [rooms, selectedRoomNumber]);

  // Guest & Check-In Form State
  const [bookingCategoryType, setBookingCategoryType] = useState<'Personal' | 'Corporate'>('Personal');
  const [companyName, setCompanyName] = useState('');
  const [companyGst, setCompanyGst] = useState('');
  const [mealPlan, setMealPlan] = useState<'EP (Room Only)' | 'CP (With Breakfast)' | 'MAP (Breakfast + Dinner)' | 'AP (All Meals)'>('EP (Room Only)');
  const [guestName, setGuestName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [idType, setIdType] = useState<string>('Aadhaar Card');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [idProofDataUrl, setIdProofDataUrl] = useState<string>('');
  const [idProofFileName, setIdProofFileName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [specialRequests, setSpecialRequests] = useState('');
  const [submittedBooking, setSubmittedBooking] = useState<Booking | null>(null);

  // Shareable URL for this specific hotel
  const shareableBookingUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/?hotelBooking=${encodeURIComponent(hotel.id)}`;
  }, [hotel.id]);

  // 7-day calendar columns
  const calendarDays = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(calendarStartDate);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [calendarStartDate]);

  // Unique room categories for this hotel only
  const categories = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [rooms]);

  // Get exact calendar status for a room on a single date ('available' | 'pending' | 'booked')
  const getRoomDateState = (room: Room, dateStr: string): 'available' | 'pending' | 'booked' => {
    if (
      room.status === 'Maintenance' ||
      room.status === 'Out of Order' ||
      room.status === 'Blocked' ||
      room.status === 'Out of Service'
    ) {
      return 'booked';
    }
    const matchingBookings = bookings.filter(
      b =>
        b.roomNumber === room.number &&
        b.status !== 'Cancelled' &&
        !b.isCompleted &&
        dateStr >= b.checkInDate &&
        dateStr < b.checkOutDate
    );
    if (matchingBookings.some(b => b.status === 'Confirmed' || b.isCheckedIn)) {
      return 'booked';
    }
    if (matchingBookings.some(b => b.status === 'Pending')) {
      return 'pending';
    }
    return 'available';
  };

  // Check if a room is available on a given single date
  const isRoomAvailableOnDate = (room: Room, dateStr: string): boolean => {
    return getRoomDateState(room, dateStr) === 'available';
  };

  // Check if a room is available for the selected range [checkInDate, checkOutDate)
  const isRoomAvailableForRange = (room: Room, startStr: string, endStr: string): boolean => {
    if (
      room.status === 'Maintenance' ||
      room.status === 'Out of Order' ||
      room.status === 'Blocked' ||
      room.status === 'Out of Service'
    ) {
      return false;
    }
    const conflict = bookings.some(
      b =>
        b.roomNumber === room.number &&
        b.status !== 'Cancelled' &&
        !b.isCompleted &&
        startStr < b.checkOutDate &&
        endStr > b.checkInDate
    );
    return !conflict;
  };

  const pendingHotelBookings = useMemo(() => {
    return bookings.filter(b => b.status === 'Pending' && !b.isCompleted);
  }, [bookings]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => selectedCategory === 'All' || r.category === selectedCategory);
  }, [rooms, selectedCategory]);

  const availableRoomsForSelectedDates = useMemo(() => {
    return filteredRooms.filter(r => isRoomAvailableForRange(r, checkInDate, checkOutDate));
  }, [filteredRooms, bookings, checkInDate, checkOutDate]);

  const activeSelectedRoom = useMemo(() => {
    return (
      rooms.find(r => r.number === selectedRoomNumber) ||
      availableRoomsForSelectedDates[0] ||
      rooms[0] ||
      null
    );
  }, [rooms, selectedRoomNumber, availableRoomsForSelectedDates]);

  const nightsCount = useMemo(() => {
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return Number.isFinite(diff) && diff > 0 ? diff : 1;
  }, [checkInDate, checkOutDate]);

  const mealPlanExtraPerNight = useMemo(() => {
    if (mealPlan === 'CP (With Breakfast)') return 300;
    if (mealPlan === 'MAP (Breakfast + Dinner)') return 700;
    if (mealPlan === 'AP (All Meals)') return 1100;
    return 0;
  }, [mealPlan]);

  const nightlyRate = (activeSelectedRoom?.rate || 2000) + mealPlanExtraPerNight;
  const baseRoomTotal = nightlyRate * nightsCount;
  const gstRate = hotel.isGstEnabled === false ? 0 : Number(hotel.defaultGstRate ?? 5);
  const gstAmount = gstRate > 0 ? parseFloat(((baseRoomTotal * gstRate) / 100).toFixed(2)) : 0;
  const totalEstimatedAmount = parseFloat((baseRoomTotal + gstAmount).toFixed(2));

  const handleCopyBookingLink = () => {
    if (!shareableBookingUrl) return;
    navigator.clipboard.writeText(shareableBookingUrl).then(() => {
      showToast('Direct Guest Booking Link copied to clipboard!', 'success');
    });
  };

  const handleShareWhatsAppLink = () => {
    const text = `Welcome to *${hotel.name}*! 🏨\nBook your room or complete your direct guest check-in online using our official hotel booking link:\n${shareableBookingUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleSelectCellOnCalendar = (room: Room, dateStr: string) => {
    const state = getRoomDateState(room, dateStr);
    if (state !== 'available') {
      showToast(
        state === 'pending'
          ? `Room ${room.number} has a guest booking Pending Hotel Approval on ${dateStr}.`
          : `Room ${room.number} is already booked on ${dateStr}.`,
        'warning'
      );
      return;
    }
    setSelectedRoomNumber(room.number);
    setCheckInDate(dateStr);
    const nextDay = new Date(dateStr);
    nextDay.setDate(nextDay.getDate() + 1);
    setCheckOutDate(formatDateStr(nextDay));
    showToast(`Selected Room ${room.number} (${room.category}) for check-in on ${dateStr}`, 'info');
    const formEl = document.getElementById('guest-direct-booking-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleIdDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('Please upload an ID document smaller than 4 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIdProofDataUrl(reader.result);
        setIdProofFileName(file.name);
        showToast(`ID Document "${file.name}" attached!`, 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !mobile.trim()) {
      showToast('Please enter your Full Name and Mobile Number.', 'warning');
      return;
    }
    if (!activeSelectedRoom) {
      showToast('No rooms are currently available to book.', 'error');
      return;
    }
    if (!isRoomAvailableForRange(activeSelectedRoom, checkInDate, checkOutDate)) {
      showToast(`Room ${activeSelectedRoom.number} is not available from ${checkInDate} to ${checkOutDate}. Please pick another room or date.`, 'error');
      return;
    }

    const bkgId = `WEB-BKG-${Date.now().toString().slice(-6)}`;
    const notesParts = [
      '[Direct Guest Booking Link • Needs Hotel Approval]',
      `Booking Type: ${bookingCategoryType}`,
      `Meal Plan: ${mealPlan}`,
      bookingCategoryType === 'Corporate' && companyName.trim() ? `Company: ${companyName.trim()}` : '',
      bookingCategoryType === 'Corporate' && companyGst.trim() ? `GSTIN: ${companyGst.trim()}` : '',
      idType && aadhaarNumber.trim() ? `${idType}: ${aadhaarNumber.trim()}` : '',
      idProofFileName ? `ID Proof Attached: ${idProofFileName}` : '',
      specialRequests.trim() ? `Guest Note: ${specialRequests.trim()}` : ''
    ].filter(Boolean);

    const newBooking: Booking = {
      id: bkgId,
      hotelId: hotel.id,
      guestName: guestName.trim(),
      mobile: mobile.trim(),
      email: email.trim() || `${guestName.trim().toLowerCase().replace(/\s+/g, '')}@guest.com`,
      aadhaarNumber: aadhaarNumber.trim() || 'PENDING_VERIFICATION',
      address: address.trim() || 'Direct Online Guest Check-In',
      checkInDate,
      checkOutDate,
      nights: nightsCount,
      adults: Math.max(1, Number(adults) || 1),
      children: Math.max(0, Number(children) || 0),
      roomNumber: activeSelectedRoom.number,
      roomType: activeSelectedRoom.category,
      advanceAmount: 0,
      bookingAmount: baseRoomTotal,
      gstRate,
      gstAmount,
      paymentMethod,
      paymentStatus: 'Unpaid',
      bookingSource: 'Website',
      status: 'Pending',
      isCheckedIn: false,
      bookingDate: new Date().toLocaleString(),
      notes: notesParts.join(' • ')
    };

    // Persist uploaded ID document in localStorage so Front Desk Check-In can view it immediately
    if (idProofDataUrl) {
      try {
        localStorage.setItem(`pms_guest_id_doc_${bkgId}`, idProofDataUrl);
      } catch {}
    }

    try {
      await fetch(`/api/public/hotel-booking/${encodeURIComponent(hotel.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking: newBooking })
      });
    } catch {}

    setLiveBookings(prev => [...prev.filter(b => b.id !== newBooking.id), newBooking]);
    onSubmitGuestBooking(newBooking);
    setSubmittedBooking(newBooking);
    showToast('Direct Guest Booking Request submitted! Awaiting Hotel Approval.', 'success');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C140E] font-sans">
      {/* Top Luxury Hotel Header */}
      <header className="bg-[#17120F] text-white border-b border-[#C49A3A]/30 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {hotel.logoUrl ? (
              <img
                src={hotel.logoUrl}
                alt={hotel.name}
                className="w-12 h-12 rounded-xl object-cover border border-[#C49A3A]/50 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C49A3A] to-[#9A721C] flex items-center justify-center text-[#17120F] font-serif font-bold text-xl shrink-0 shadow-md">
                <HotelIcon className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-serif font-bold tracking-wide text-white">
                  {hotel.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#C49A3A]/20 border border-[#C49A3A]/40 text-[#E5C158] text-[10px] font-mono uppercase tracking-widest font-bold">
                  Direct Guest Booking & Check-In Portal
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#C7B8A5] mt-1">
                {hotel.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#C49A3A]" /> {hotel.address}
                  </span>
                )}
                {hotel.phoneNumber && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-[#C49A3A]" /> {hotel.phoneNumber}
                  </span>
                )}
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-[#C49A3A]" /> Check-In: {hotel.checkInTime || '12:00 PM'} • Check-Out: {hotel.checkOutTime || '11:00 AM'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyBookingLink}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-[#C49A3A]/30 text-[#E5C158] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy shareable booking link for this hotel"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Booking Link</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsAppLink}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Link on WhatsApp</span>
            </button>
            {isAuthenticatedStaff && onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-4 py-2 rounded-xl bg-[#C49A3A] hover:bg-[#d4a946] text-[#17120F] text-xs font-serif font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Hotel PMS</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Shareable Link Banner for Hotel Staff */}
        {isAuthenticatedStaff && (
          <div className="bg-gradient-to-r from-[#1C140E] via-[#281D14] to-[#1C140E] text-white rounded-2xl p-4 md:p-5 border border-[#C49A3A]/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#E5C158] text-xs font-mono uppercase tracking-wider font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Exclusive Hotel Booking & Self Check-In Link • {hotel.name} Only</span>
              </div>
              <p className="text-xs text-[#D6C7B2]">
                Send this link to your guests. Guests will only see <strong>{hotel.name}</strong> and its rooms. Every booking submitted here arrives with <strong>Pending Approval</strong> status so your hotel can approve it.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-black/40 border border-white/15 rounded-xl px-3 py-2 shrink-0">
              <code className="text-xs font-mono text-[#E5C158] select-all truncate max-w-[260px] sm:max-w-[340px]">
                {shareableBookingUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyBookingLink}
                className="px-3 py-1 bg-[#C49A3A] hover:bg-[#d4a946] text-[#17120F] font-bold text-xs rounded-lg cursor-pointer"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Hotel Staff Instant Approval Queue Banner (Visible to logged-in Hotel Staff when Pending Bookings exist) */}
        {isAuthenticatedStaff && pendingHotelBookings.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 md:p-5 shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                  Hotel Approval Required • {pendingHotelBookings.length} Pending Guest Booking{pendingHotelBookings.length > 1 ? 's' : ''}
                </span>
                <h3 className="text-sm font-serif font-bold text-[#17120F] mt-1">
                  Approve or Reject Direct Guest Booking Requests for {hotel.name}:
                </h3>
              </div>
              {onOpenAdvanceBookings && (
                <button
                  type="button"
                  onClick={onOpenAdvanceBookings}
                  className="px-3.5 py-1.5 rounded-xl bg-[#17120F] hover:bg-black text-[#E5C158] text-xs font-mono font-bold cursor-pointer shrink-0"
                >
                  Open Advance Bookings Ledger →
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingHotelBookings.map(pbk => (
                <div
                  key={pbk.id}
                  className="bg-white border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-0.5 text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="font-serif text-sm text-[#17120F]">{pbk.guestName}</strong>
                      <span className="font-mono text-[11px] text-slate-600">({pbk.mobile})</span>
                    </div>
                    <div className="font-mono text-[11px] text-[#5A4632]">
                      Room <strong>{pbk.roomNumber}</strong> ({pbk.roomType}) • {pbk.checkInDate} → {pbk.checkOutDate} ({pbk.nights}N)
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onApprovePendingBooking && (
                      <button
                        type="button"
                        onClick={() => {
                          onApprovePendingBooking(pbk.id);
                          setLiveBookings(prev =>
                            prev.map(b => (b.id === pbk.id ? { ...b, status: 'Confirmed' as const } : b))
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {onRejectPendingBooking && (
                      <button
                        type="button"
                        onClick={() => {
                          onRejectPendingBooking(pbk.id);
                          setLiveBookings(prev =>
                            prev.map(b => (b.id === pbk.id ? { ...b, status: 'Cancelled' as const } : b))
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submitted Confirmation Screen */}
        {submittedBooking ? (
          <div className="bg-white border-2 border-[#C49A3A] rounded-3xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-mono font-bold uppercase">
                Awaiting Hotel Approval
              </span>
              <h2 className="text-2xl font-serif font-bold text-[#17120F]">
                Booking & Check-In Request Submitted!
              </h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Thank you, <strong>{submittedBooking.guestName}</strong>! Your booking request at <strong>{hotel.name}</strong> has been sent to the hotel reception desk for approval.
              </p>
            </div>

            <div className="bg-[#FDF8ED] border border-[#C49A3A]/30 rounded-2xl p-5 text-left grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Booking Reference</span>
                <strong className="font-mono text-sm text-[#17120F]">{submittedBooking.id}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Approval Status</span>
                <strong className="font-mono text-amber-700">Pending Hotel Approval</strong>
              </div>
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Hotel Property</span>
                <strong className="font-serif text-[#17120F]">{hotel.name}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Allocated Room</span>
                <strong className="font-mono text-[#17120F]">Room {submittedBooking.roomNumber} ({submittedBooking.roomType})</strong>
              </div>
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Check-In Date</span>
                <strong className="font-mono text-emerald-700">{submittedBooking.checkInDate}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Check-Out Date</span>
                <strong className="font-mono text-rose-700">{submittedBooking.checkOutDate} ({submittedBooking.nights} Night{submittedBooking.nights > 1 ? 's' : ''})</strong>
              </div>
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Estimated Tariff</span>
                <strong className="font-mono text-sm text-[#17120F]">₹{totalEstimatedAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-mono uppercase text-[10px] block">Guest Contact</span>
                <strong className="font-mono text-[#17120F]">{submittedBooking.mobile}</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {hotel.phoneNumber && (
                <a
                  href={`https://wa.me/91${hotel.phoneNumber.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                    `Hi ${hotel.name}, I have submitted my Direct Booking Request (ID: ${submittedBooking.id}) for Room ${submittedBooking.roomNumber} from ${submittedBooking.checkInDate} to ${submittedBooking.checkOutDate} under name ${submittedBooking.guestName}. Kindly approve my booking.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md"
                >
                  <span>Notify Hotel on WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setSubmittedBooking(null)}
                className="px-5 py-2.5 rounded-xl bg-[#17120F] hover:bg-black text-[#E5C158] text-xs font-bold cursor-pointer"
              >
                Create Another Booking
              </button>
              {isAuthenticatedStaff && (onOpenAdvanceBookings || onBackToDashboard) && (
                <button
                  type="button"
                  onClick={onOpenAdvanceBookings || onBackToDashboard}
                  className="px-5 py-2.5 rounded-xl bg-[#C49A3A] hover:bg-[#d4a946] text-[#17120F] text-xs font-bold cursor-pointer"
                >
                  Approve in Advance Bookings →
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* SECTION 1: LIVE ROOM AVAILABILITY CALENDAR MATRIX FOR THIS HOTEL */}
            <section className="bg-white border border-[#E6DEC8] rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EFE8D5] pb-4">
                <div>
                  <div className="flex items-center gap-2 text-[#9E7822] text-xs font-mono uppercase tracking-widest font-bold">
                    <Calendar className="w-4 h-4" />
                    <span>Live Room Availability Calendar • {hotel.name}</span>
                  </div>
                  <h2 className="text-xl font-serif font-bold text-[#17120F] mt-0.5">
                    Click Any Available Green Date Cell to Select Room & Dates
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(calendarStartDate);
                      d.setDate(d.getDate() - 7);
                      setCalendarStartDate(d);
                    }}
                    className="p-2 rounded-xl border border-[#DCE3EC] hover:bg-[#FDF8ED] text-[#17120F] cursor-pointer"
                    title="Previous 7 Days"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarStartDate(new Date())}
                    className="px-3 py-1.5 rounded-xl bg-[#FDF8ED] border border-[#C49A3A]/40 text-xs font-mono font-bold text-[#8B691E] cursor-pointer"
                  >
                    Today ({getTodayStr()})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(calendarStartDate);
                      d.setDate(d.getDate() + 7);
                      setCalendarStartDate(d);
                    }}
                    className="p-2 rounded-xl border border-[#DCE3EC] hover:bg-[#FDF8ED] text-[#17120F] cursor-pointer"
                    title="Next 7 Days"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('All')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
                      selectedCategory === 'All'
                        ? 'bg-[#17120F] text-[#E5C158] shadow-xs'
                        : 'bg-[#FDF8ED] text-[#5A4632] border border-[#E6DEC8]'
                    }`}
                  >
                    All Rooms ({rooms.length})
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#17120F] text-[#E5C158] shadow-xs'
                          : 'bg-[#FDF8ED] text-[#5A4632] border border-[#E6DEC8]'
                      }`}
                    >
                      {cat} ({rooms.filter(r => r.category === cat).length})
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Available (Click to Book)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Pending Hotel Approval
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-rose-500 inline-block" /> Booked / Occupied
                  </span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-[#17120F] text-white">
                      <th className="p-3.5 font-serif font-bold border-r border-white/10 w-48">
                        Room & Category
                      </th>
                      {calendarDays.map(d => {
                        const dStr = formatDateStr(d);
                        const availCount = filteredRooms.filter(r => isRoomAvailableOnDate(r, dStr)).length;
                        return (
                          <th key={dStr} className="p-3 text-center border-r border-white/10 min-w-[95px]">
                            <div className="text-[10px] font-mono uppercase text-[#E5C158]">
                              {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                            </div>
                            <div className="text-sm font-serif font-bold">
                              {d.getDate()} {d.toLocaleDateString('en-IN', { month: 'short' })}
                            </div>
                            <div className="text-[9px] font-mono text-emerald-300 mt-0.5">
                              {availCount} Free
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE8D5]">
                    {filteredRooms.map(room => {
                      const isRoomSelected = activeSelectedRoom?.number === room.number;
                      return (
                        <tr
                          key={room.id}
                          className={isRoomSelected ? 'bg-[#FDF8ED]' : 'hover:bg-[#FDFBF7]'}
                        >
                          <td className="p-3 border-r border-[#EFE8D5]">
                            <div className="flex items-center justify-between">
                              <span className="font-serif font-bold text-sm text-[#17120F]">
                                Room {room.number}
                              </span>
                              <span className="font-mono font-bold text-xs text-[#9E7822]">
                                ₹{Number(room.rate || 0).toLocaleString('en-IN')}/N
                              </span>
                            </div>
                            <div className="text-[10px] font-mono uppercase text-slate-500 mt-0.5">
                              {room.category} • Max {room.maxOccupancy || 3} Guests
                            </div>
                          </td>
                          {calendarDays.map(d => {
                            const dStr = formatDateStr(d);
                            const cellState = getRoomDateState(room, dStr);
                            const available = cellState === 'available';
                            const inSelectedRange =
                              isRoomSelected && dStr >= checkInDate && dStr < checkOutDate;
                            return (
                              <td
                                key={dStr}
                                onClick={() => handleSelectCellOnCalendar(room, dStr)}
                                className={`p-2 text-center border-r border-[#EFE8D5] transition-all cursor-pointer ${
                                  inSelectedRange
                                    ? 'bg-[#C49A3A]/25 ring-2 ring-inset ring-[#C49A3A]'
                                    : available
                                    ? 'hover:bg-emerald-50'
                                    : cellState === 'pending'
                                    ? 'bg-amber-50/60 cursor-not-allowed'
                                    : 'bg-rose-50/40 cursor-not-allowed'
                                }`}
                              >
                                {available ? (
                                  <span
                                    className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${
                                      inSelectedRange
                                        ? 'bg-[#17120F] text-[#E5C158]'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                  >
                                    {inSelectedRange ? '✓ Selected' : 'Available'}
                                  </span>
                                ) : cellState === 'pending' ? (
                                  <span className="inline-block px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    Pending Approval
                                  </span>
                                ) : (
                                  <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    Booked
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 2: ROOMS SHOWCASE & DIRECT GUEST CHECK-IN / BOOKING FORM */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" id="guest-direct-booking-form">
              {/* Left 5 Columns: Available Rooms of This Hotel */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-[#E6DEC8] rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-[#EFE8D5] pb-3">
                    <h3 className="text-base font-serif font-bold text-[#17120F] flex items-center gap-2">
                      <Bed className="w-5 h-5 text-[#C49A3A]" /> Rooms at {hotel.name} ({availableRoomsForSelectedDates.length} Available)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Showing rooms exclusively for {hotel.name} from {checkInDate} to {checkOutDate}.
                    </p>
                  </div>

                  <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                    {filteredRooms.map(room => {
                      const isAvail = isRoomAvailableForRange(room, checkInDate, checkOutDate);
                      const isSelected = activeSelectedRoom?.number === room.number;
                      return (
                        <div
                          key={room.id}
                          onClick={() => {
                            if (isAvail) setSelectedRoomNumber(room.number);
                          }}
                          className={`p-4 rounded-2xl border transition-all ${
                            isSelected
                              ? 'border-2 border-[#C49A3A] bg-[#FDF8ED] shadow-md'
                              : isAvail
                              ? 'border-[#E6DEC8] bg-white hover:border-[#C49A3A]/60 cursor-pointer'
                              : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-serif font-bold text-base text-[#17120F]">
                                  Room {room.number}
                                </h4>
                                <span className="px-2 py-0.5 rounded bg-[#C49A3A]/15 text-[#8B691E] font-mono text-[10px] font-bold uppercase">
                                  {room.category}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {room.bedType || 'King Size Bed'} • Up to {room.maxOccupancy || 3} Guests • {room.floor || '1st Floor'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-extrabold text-base text-[#17120F]">
                                ₹{Number(room.rate || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="block text-[10px] font-mono text-slate-500">per night</span>
                            </div>
                          </div>

                          {room.amenities && room.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {room.amenities.slice(0, 5).map(am => (
                                <span
                                  key={am}
                                  className="px-2 py-0.5 rounded-md bg-white border border-[#E6DEC8] text-[10px] text-[#5A4632] font-medium"
                                >
                                  ✦ {am}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 pt-2.5 border-t border-[#EFE8D5] flex items-center justify-between text-xs">
                            {isAvail ? (
                              <span className="text-emerald-700 font-mono font-bold text-[11px]">
                                ● Available for selected dates
                              </span>
                            ) : (
                              <span className="text-rose-600 font-mono font-bold text-[11px]">
                                ● Booked for selected dates
                              </span>
                            )}
                            {isAvail && (
                              <button
                                type="button"
                                onClick={() => setSelectedRoomNumber(room.number)}
                                className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#17120F] text-[#E5C158]'
                                    : 'bg-[#C49A3A] text-[#17120F]'
                                }`}
                              >
                                {isSelected ? '✓ Selected' : 'Select Room'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right 7 Columns: Direct Guest Check-In & Simple Booking Form */}
              <div className="lg:col-span-7">
                <form
                  onSubmit={handleSubmitBooking}
                  className="bg-white border border-[#C49A3A]/40 rounded-3xl p-6 md:p-8 shadow-xl space-y-5"
                >
                  <div className="border-b border-[#EFE8D5] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#9E7822] font-bold">
                        Direct Hotel Booking & Self Check-In
                      </span>
                      <h3 className="text-xl font-serif font-bold text-[#17120F]">
                        Book Your Stay at {hotel.name}
                      </h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#FDF8ED] border border-[#C49A3A]/40 text-[#8B691E] font-mono text-[11px] font-bold">
                      Instant Request • Hotel Approval
                    </span>
                  </div>

                  {/* Personal vs Corporate Booking Toggle */}
                  <div className="grid grid-cols-2 gap-3 p-1 bg-[#FDF8ED] rounded-xl border border-[#E6DEC8]">
                    <button
                      type="button"
                      onClick={() => setBookingCategoryType('Personal')}
                      className={`py-2 rounded-lg text-xs font-serif font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        bookingCategoryType === 'Personal'
                          ? 'bg-[#17120F] text-[#E5C158] shadow-xs'
                          : 'text-[#5A4632]'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> Personal Booking
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingCategoryType('Corporate')}
                      className={`py-2 rounded-lg text-xs font-serif font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        bookingCategoryType === 'Corporate'
                          ? 'bg-[#17120F] text-[#E5C158] shadow-xs'
                          : 'text-[#5A4632]'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" /> Corporate Booking
                    </button>
                  </div>

                  {bookingCategoryType === 'Corporate' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FDF8ED]/70 p-3.5 rounded-2xl border border-[#C49A3A]/30">
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                          Company / Business Name
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          placeholder="e.g. Apex Infosystems Pvt Ltd"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                          Company GSTIN (Optional)
                        </label>
                        <input
                          type="text"
                          value={companyGst}
                          onChange={e => setCompanyGst(e.target.value.toUpperCase())}
                          placeholder="e.g. 22AAAAA0000A1Z5"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white font-mono uppercase"
                        />
                      </div>
                    </div>
                  )}

                  {/* Stay Dates & Selected Room */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Check-In Date *
                      </label>
                      <input
                        type="date"
                        required
                        min={getTodayStr()}
                        value={checkInDate}
                        onChange={e => {
                          const val = e.target.value;
                          setCheckInDate(val);
                          if (val >= checkOutDate) {
                            const next = new Date(val);
                            next.setDate(next.getDate() + 1);
                            setCheckOutDate(formatDateStr(next));
                          }
                        }}
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Check-Out Date *
                      </label>
                      <input
                        type="date"
                        required
                        min={checkInDate}
                        value={checkOutDate}
                        onChange={e => setCheckOutDate(e.target.value)}
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Select Room *
                      </label>
                      <select
                        value={activeSelectedRoom?.number || ''}
                        onChange={e => setSelectedRoomNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-bold bg-white"
                      >
                        {availableRoomsForSelectedDates.map(r => (
                          <option key={r.id} value={r.number}>
                            Room {r.number} — {r.category} (₹{r.rate}/N)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Meal Plan & Guest Count */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Meal Plan
                      </label>
                      <select
                        value={mealPlan}
                        onChange={e => setMealPlan(e.target.value as any)}
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                      >
                        <option value="EP (Room Only)">EP — Room Only (Base Rate)</option>
                        <option value="CP (With Breakfast)">CP — With Breakfast (+₹300/N)</option>
                        <option value="MAP (Breakfast + Dinner)">MAP — Breakfast & Dinner (+₹700/N)</option>
                        <option value="AP (All Meals)">AP — All Meals Included (+₹1100/N)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Adults *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={adults}
                        onChange={e => setAdults(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Children
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={children}
                        onChange={e => setChildren(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                      />
                    </div>
                  </div>

                  {/* Guest Contact Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Guest Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Mobile Number (WhatsApp) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={mobile}
                        onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        placeholder="10-digit mobile number"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="guest@example.com"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                        City / Address
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="Your city & address"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* Direct Guest Check-In ID Verification */}
                  <div className="bg-[#FDF8ED]/80 border border-[#E6DEC8] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#8B691E] flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-[#C49A3A]" /> Express Guest Check-In ID Details
                      </span>
                      <span className="text-[10px] text-slate-500">Speeds up arrival at reception</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase font-bold text-[#5A4632] block">
                          ID Document Type
                        </label>
                        <select
                          value={idType}
                          onChange={e => setIdType(e.target.value)}
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                        >
                          <option value="Aadhaar Card">Aadhaar Card</option>
                          <option value="PAN Card">PAN Card</option>
                          <option value="Passport">Passport</option>
                          <option value="Driving License">Driving License</option>
                          <option value="Voter ID">Voter ID</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase font-bold text-[#5A4632] block">
                          ID / Aadhaar Number
                        </label>
                        <input
                          type="text"
                          value={aadhaarNumber}
                          onChange={e => setAadhaarNumber(e.target.value)}
                          placeholder="Enter ID number"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase font-bold text-[#5A4632] block">
                          Upload ID Card (Optional)
                        </label>
                        <label className="w-full px-3 py-2 border border-dashed border-[#C49A3A] rounded-xl text-xs bg-white hover:bg-[#FDF8ED] text-[#8B691E] font-bold flex items-center justify-center gap-1.5 cursor-pointer truncate">
                          <Upload className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{idProofFileName || 'Upload Aadhaar / ID'}</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleIdDocumentUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Special Requests */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono uppercase font-bold text-[#5A4632] block">
                      Special Arrival Notes / Requests (Optional)
                    </label>
                    <input
                      type="text"
                      value={specialRequests}
                      onChange={e => setSpecialRequests(e.target.value)}
                      placeholder="e.g. Late evening check-in around 9 PM, extra pillows..."
                      className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                    />
                  </div>

                  {/* Tariff Summary Box */}
                  <div className="bg-[#17120F] text-white rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs text-[#C7B8A5]">
                      <span>
                        Room {activeSelectedRoom?.number || '-'} ({activeSelectedRoom?.category || 'Standard'}) × {nightsCount} Night{nightsCount > 1 ? 's' : ''} ({mealPlan})
                      </span>
                      <span className="font-mono font-bold text-white">₹{baseRoomTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-[#C7B8A5]">
                      <span>Applicable Hotel GST ({gstRate}%)</span>
                      <span className="font-mono font-bold text-white">₹{gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="border-t border-white/15 pt-2 flex justify-between items-center">
                      <div>
                        <span className="text-xs uppercase font-mono text-[#E5C158] font-bold block">
                          Total Estimated Stay Payable
                        </span>
                        <span className="text-[10px] text-[#C7B8A5]">
                          Payable at hotel / upon booking approval
                        </span>
                      </div>
                      <span className="text-xl font-mono font-extrabold text-[#E5C158]">
                        ₹{totalEstimatedAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#C49A3A] to-[#A67C20] hover:from-[#d4a946] hover:to-[#b88a24] text-[#17120F] font-serif font-bold text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Direct Booking & Check-In Request (Hotel Approval)</span>
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
