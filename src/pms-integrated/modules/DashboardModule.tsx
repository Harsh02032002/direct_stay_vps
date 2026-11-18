import React, { useState } from 'react';
import {
  BedDouble,
  CalendarCheck,
  CalendarDays,
  Sparkles,
  IndianRupee,
  AlertCircle,
  Plus,
  Search,
  Eye,
  LogIn,
  LogOut,
  CreditCard,
  FileText,
  ClipboardList,
  CheckCircle2,
  Clock,
  Ban,
  Users,
  ArrowUpRight,
  Utensils,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { BookingRecord, HousekeepingTask, RoomAsset } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import CalendarBookingView from '../../components/CalendarBookingView';
import type { Room, Booking } from '../../types';

interface DashboardModuleProps {
  rooms: RoomAsset[];
  bookings: BookingRecord[];
  tasks: HousekeepingTask[];
  hotelName?: string;
  appRooms?: Room[];
  appBookings?: Booking[];
  onUpdateBookings?: (bookings: Booking[]) => void;
  onUpdateRooms?: (rooms: Room[]) => void;
  onOpenQuickAddBooking: (preselectedRoom?: RoomAsset, bookingMode?: 'reservations' | 'walkin') => void;
  onSelectBooking: (booking: BookingRecord) => void;
  onOpenCheckIn: (booking: BookingRecord) => void;
  onQuickCheckOut: (booking: BookingRecord) => void;
  onOpenRecordPayment: (booking: BookingRecord) => void;
  onOpenInvoice: (booking: BookingRecord, scope: 'Only Booking' | 'Booking + Other Services') => void;
  onOpenRoomTasks: (room: RoomAsset) => void;
  onOpenRoomOrder: (booking: BookingRecord) => void;
  onNavigate: (module: string, subTab?: string) => void;
  onCancelBooking?: (booking: BookingRecord) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  rooms,
  bookings,
  tasks,
  hotelName,
  appRooms = [],
  appBookings = [],
  onUpdateBookings,
  onUpdateRooms,
  onOpenQuickAddBooking,
  onSelectBooking,
  onOpenCheckIn,
  onQuickCheckOut,
  onOpenRecordPayment,
  onOpenInvoice,
  onOpenRoomTasks,
  onOpenRoomOrder,
  onNavigate,
  onCancelBooking,
}) => {
  const [overviewMainTab, setOverviewMainTab] = useState<'rack' | 'matrix'>('rack');
  const [bookingTab, setBookingTab] = useState<'today' | 'upcoming' | 'checkin' | 'checkout'>('today');
  const [roomFilter, setRoomFilter] = useState<'All' | 'Available' | 'Occupied' | 'Confirmed' | 'Dirty' | 'Out of Service'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [bookChoiceRoomId, setBookChoiceRoomId] = useState<string | null>(null);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [bookingTab, searchQuery]);

  const totalRooms = rooms.length;
  const occupiedCount = rooms.filter((r) => r.status === 'Occupied').length;
  const confirmedCount = rooms.filter((r) => r.status === 'Confirmed').length;
  const availableCount = rooms.filter((r) => r.status === 'Available').length;
  const dirtyCount = rooms.filter((r) => r.status === 'Dirty' || r.cleaningStatus === 'Dirty').length;
  const blockedCount = rooms.filter((r) => r.status === 'Out of Service').length;
  const occupancyPct = totalRooms > 0 ? Math.round(((occupiedCount + confirmedCount) / totalRooms) * 100) : 0;

  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalPayable, 0);
  const totalCollected = bookings.reduce((sum, b) => sum + b.amountPaid, 0);
  const totalPendingDues = bookings.reduce((sum, b) => sum + b.dueAmount, 0);

  const isCheckedOutBooking = (b: BookingRecord) =>
    Boolean(b.isCheckedOut) ||
    b.status === 'Checked Out' ||
    String(b.status || '').toLowerCase() === 'checkedout' ||
    String(b.status || '').toLowerCase() === 'checked out' ||
    String(b.status || '').toLowerCase() === 'completed';

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      !searchQuery.trim() ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookingNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.mobile.includes(searchQuery) ||
      b.roomNumbers.some((rn) => rn.includes(searchQuery));

    if (!matchesSearch) return false;

    if (bookingTab === 'today') return !isCheckedOutBooking(b) && b.status !== 'Cancelled';
    if (bookingTab === 'upcoming') return !b.isCheckedIn && !isCheckedOutBooking(b) && b.status === 'Confirmed';
    if (bookingTab === 'checkin') return b.isCheckedIn && !b.isCheckedOut && !isCheckedOutBooking(b);
    if (bookingTab === 'checkout') return isCheckedOutBooking(b) || b.checkOutDate === selectedDate;
    return true;
  });

  const categories = Array.from(new Set(rooms.map((r) => r.category).filter(Boolean)));

  // Dynamic 7-day chart computed from actual bookings & rooms
  const chartData = React.useMemo(() => {
    const baseDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
    const days: Array<{ day: string; occupied: number; available: number; revenue: number; pos: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const activeDayBookings = bookings.filter(
        (b) => b.status !== 'Cancelled' && b.status !== 'No-Show' && b.checkInDate <= iso && b.checkOutDate >= iso
      );
      const occRooms = activeDayBookings.reduce((s, b) => s + Math.max(1, b.roomNumbers.length), 0);
      const clampedOcc = Math.min(totalRooms, occRooms);
      const availRooms = Math.max(0, totalRooms - clampedOcc);
      const dayRoomRev = activeDayBookings.reduce(
        (s, b) => s + Math.round(b.roomSubtotal / Math.max(1, b.nights)),
        0
      );
      const dayPosRev = activeDayBookings.reduce(
        (s, b) => s + Math.round(b.otherServicesTotal / Math.max(1, b.nights)),
        0
      );
      days.push({
        day: dayLabel,
        occupied: clampedOcc,
        available: availRooms,
        revenue: dayRoomRev,
        pos: dayPosRev,
      });
    }
    return days;
  }, [bookings, totalRooms, selectedDate]);

  const getRoomTasksCount = (room: RoomAsset) =>
    tasks.filter((t) => (t.roomId === room.id || t.roomNumber === room.number) && t.status !== 'Completed').length;

  const findBookingForRoom = (room: RoomAsset): BookingRecord | undefined => {
    if (room.currentBookingId) {
      const byId = bookings.find(
        (b) => b.id === room.currentBookingId && b.status !== 'Checked Out' && b.status !== 'Cancelled' && b.status !== 'No-Show'
      );
      if (byId) return byId;
    }
    const inHouse = bookings.find(
      (b) =>
        b.roomNumbers.includes(room.number) &&
        b.isCheckedIn &&
        !b.isCheckedOut &&
        b.status !== 'Checked Out' &&
        b.status !== 'Cancelled' &&
        b.status !== 'No-Show'
    );
    if (inHouse) return inHouse;

    return bookings.find(
      (b) =>
        b.roomNumbers.includes(room.number) &&
        b.status !== 'Checked Out' &&
        b.status !== 'Cancelled' &&
        b.status !== 'No-Show' &&
        (!b.checkInDate || b.checkInDate <= selectedDate) &&
        (!b.checkOutDate || b.checkOutDate >= selectedDate)
    );
  };

  const findUpcomingBookingForRoom = (room: RoomAsset): BookingRecord | undefined =>
    bookings
      .filter(
        (b) =>
          b.roomNumbers.includes(room.number) &&
          !b.isCheckedIn &&
          b.status !== 'Checked Out' &&
          b.status !== 'Cancelled' &&
          b.status !== 'No-Show' &&
          Boolean(b.checkInDate && b.checkInDate > selectedDate)
      )
      .sort((a, b) => (a.checkInDate || '').localeCompare(b.checkInDate || ''))[0];

  const totalBookings = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalBookings / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalBookings);
  const paginatedBookings = filteredBookings.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
              Live Operations Desk
            </span>
            <span className="text-xs text-slate-400 font-medium truncate">{hotelName || 'DirectStay Property'}</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 mt-1 leading-snug">
            PMS Property Overview & Live Room Rack
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Click any room card to book, view booking details, assign staff tasks, or settle guest bills.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 sm:hidden">Date:</span>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem('pms_open_water_modal', '1');
                } catch {}
                onNavigate('frontDesk', 'services');
              }}
              className="px-3 sm:px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] sm:text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Add Water Bottle & Inventory Log"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-200 shrink-0" />
              <span>+ Add Water Bottle</span>
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem('pms_open_advance_modal', '1');
                } catch {}
                onNavigate('frontDesk', 'reservations');
              }}
              className="px-3 sm:px-4 py-2.5 rounded-xl bg-[#17120F] hover:bg-black text-[#E0BD6B] font-bold text-[11px] sm:text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer border border-[#C49A3A]/40"
              title="Open Advance Booking / Reservation Form"
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C49A3A] shrink-0" />
              <span>+ Advance Booking</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('frontDesk', 'walkin')}
              className="px-3 sm:px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] sm:text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Open Instant Walk-In Booking Form"
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 stroke-[2.5] shrink-0" />
              <span>+ Walk-In Booking</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-2.5 sm:gap-3.5">
        <div
          onClick={() => setRoomFilter('All')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-amber-400 cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 leading-tight">Total Inventory</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-1.5 sm:mt-2 leading-tight">
              {totalRooms} Rooms
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 leading-snug">
              {categories.length} Asset Categories Active
            </div>
          </div>
        </div>

        <div
          onClick={() => setRoomFilter('Available')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-200 shadow-sm hover:border-emerald-400 cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 leading-tight">Available Now</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-emerald-700 mt-1.5 sm:mt-2 leading-tight">
              {availableCount} Rooms
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-600 mt-1 leading-snug">
              Ready for instant check-in
            </div>
          </div>
        </div>

        <div
          onClick={() => setRoomFilter('Occupied')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-blue-200 shadow-sm hover:border-blue-400 cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-blue-700 leading-tight">In-House / Occupied</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-blue-700 mt-1.5 sm:mt-2 leading-tight flex flex-wrap items-baseline gap-x-1">
              <span>{occupiedCount}</span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400">(+{confirmedCount} Booked)</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-blue-600 mt-1 leading-snug">
              {occupancyPct}% Occupancy Rate
            </div>
          </div>
        </div>

        <div
          onClick={() => setRoomFilter('Dirty')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-amber-200 shadow-sm hover:border-amber-400 cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-700 leading-tight">Dirty / Cleaning</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-amber-700 mt-1.5 sm:mt-2 leading-tight">
              {dirtyCount} Rooms
            </div>
            <div className="text-[10px] sm:text-[11px] text-amber-600 mt-1 leading-snug">
              {tasks.filter((t) => t.status !== 'Completed').length} active housekeeping tasks
            </div>
          </div>
        </div>

        <div
          onClick={() => onNavigate('finance', 'dashboard')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-amber-400 cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 leading-tight">Total Booking Revenue</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-1.5 sm:mt-2 leading-tight truncate">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-1 leading-snug truncate">
              Collected: {formatCurrency(totalCollected)}
            </div>
          </div>
        </div>

        <div
          onClick={() => onNavigate('reports', 'pending_dues')}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-rose-200 shadow-sm hover:border-rose-400 cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-700 leading-tight">Pending Guest Dues</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-rose-600 mt-1.5 sm:mt-2 leading-tight truncate">
              {formatCurrency(totalPendingDues)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-rose-500 mt-1 leading-snug">
              Across {bookings.filter((b) => b.dueAmount > 0).length} active bookings
            </div>
          </div>
        </div>
      </div>

      {/* 2 MAIN PMS TABS BELOW STATS CARDS */}
      <div className="flex border-b-2 border-slate-200 bg-white rounded-t-2xl px-3 pt-2 gap-2 shadow-2xs">
        <button
          type="button"
          onClick={() => setOverviewMainTab('rack')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            overviewMainTab === 'rack'
              ? 'border-amber-500 bg-amber-50/80 text-slate-900 shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BedDouble className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Live Room Status Rack (Click Room for Booking Details or Quick Book)</span>
        </button>

        <button
          type="button"
          onClick={() => setOverviewMainTab('matrix')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            overviewMainTab === 'matrix'
              ? 'border-amber-500 bg-amber-50/80 text-slate-900 shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Room Matrix</span>
        </button>
      </div>

      {overviewMainTab === 'matrix' ? (
        <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-sm p-4">
          <CalendarBookingView
            rooms={appRooms}
            bookings={appBookings}
            onUpdateBookings={onUpdateBookings || (() => {})}
            onUpdateRooms={onUpdateRooms || (() => {})}
          />
        </div>
      ) : (
        /* Live Room Status Rack (Video Reference Section) */
        <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-sm p-3.5 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3.5 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 leading-snug">
              <BedDouble className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
              <span>Live Room Status Rack (Click Room for Booking Details or Quick Book)</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed">
              Grouped by Asset Categories • Synchronized with Front Desk, Housekeeping & POS Room Service
            </p>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(['All', 'Available', 'Occupied', 'Confirmed', 'Dirty', 'Out of Service'] as const).map((status) => {
              const count =
                status === 'All'
                  ? rooms.length
                  : status === 'Dirty'
                  ? dirtyCount
                  : rooms.filter((r) => r.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setRoomFilter(status)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center justify-between sm:justify-center gap-1.5 whitespace-nowrap border cursor-pointer ${
                    roomFilter === status
                      ? 'bg-[#F5E3B8] text-[#6E5011] border-[#D4AD50] font-bold shadow-2xs'
                      : 'bg-[#FAF6EE] text-[#3E5068] border-[#E2D6BE] hover:bg-[#F2E8D2]'
                  }`}
                >
                  <span>{status === 'Confirmed' ? 'Booked' : status === 'Out of Service' ? 'Blocked' : status}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/85 text-[#263449] font-bold">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 mt-4">
          {rooms.length === 0 ? (
            <div className="py-7 px-4 text-center bg-[#FAF6EE]/60 rounded-2xl border border-dashed border-[#DFC078] space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-600 flex items-center justify-center mx-auto">
                <BedDouble className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-800">No Rooms Added Yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Add your hotel room inventory and categories in Room Management to start accepting bookings.
              </p>
              <button
                onClick={() => onNavigate('rooms', 'dashboard')}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add Rooms in Room Management</span>
              </button>
            </div>
          ) : (
            (() => {
              const matchingTotal = rooms.filter((r) => {
                if (roomFilter === 'All') return true;
                if (roomFilter === 'Dirty') return r.status === 'Dirty' || r.cleaningStatus === 'Dirty';
                return r.status === roomFilter;
              }).length;

              if (matchingTotal === 0) {
                const filterDisplay =
                  roomFilter === 'Confirmed' ? 'Booked' : roomFilter === 'Out of Service' ? 'Blocked' : roomFilter;
                return (
                  <div className="py-6 px-4 text-center bg-slate-50/80 rounded-xl border border-dashed border-slate-200 space-y-2">
                    <div className="text-xs sm:text-sm font-bold text-slate-700">
                      No rooms currently in &ldquo;{filterDisplay}&rdquo; status
                    </div>
                    <p className="text-[11px] text-slate-500">
                      All {rooms.length} room(s) in your inventory are under other operational statuses.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRoomFilter('All')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      Show All Rooms ({rooms.length})
                    </button>
                  </div>
                );
              }
              return null;
            })()
          )}
          {categories.map((category) => {
            const categoryRooms = rooms.filter((r) => {
              if (r.category !== category) return false;
              if (roomFilter === 'All') return true;
              if (roomFilter === 'Dirty') return r.status === 'Dirty' || r.cleaningStatus === 'Dirty';
              return r.status === roomFilter;
            });

            if (categoryRooms.length === 0) return null;

            return (
              <div key={category} className="space-y-2.5 sm:space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">{category}</h3>
                    <span className="text-[11px] sm:text-xs text-slate-400 font-medium">({categoryRooms.length} rooms)</span>
                  </div>
                  <span className="text-[11px] sm:text-xs text-slate-500">
                    Base Tariff: <strong className="text-slate-800">{formatCurrency(categoryRooms[0]?.rate || 2000)}</strong> / night
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                  {categoryRooms.map((room) => {
                    const activeBooking = findBookingForRoom(room);
                    const upcomingBooking = !activeBooking ? findUpcomingBookingForRoom(room) : undefined;
                    const pendingTasks = getRoomTasksCount(room);
                    const isDirty = room.status === 'Dirty' || room.cleaningStatus === 'Dirty';

                    let cardStyle = 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-400';
                    let badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                    let statusLabel = 'Available';

                    if (room.status === 'Occupied' || (activeBooking && activeBooking.isCheckedIn && !activeBooking.isCheckedOut)) {
                      cardStyle = 'border-blue-200 bg-blue-50/40 hover:border-blue-400';
                      badgeStyle = 'bg-blue-100 text-blue-800 border-blue-300';
                      statusLabel = 'Occupied';
                    } else if (room.status === 'Confirmed' || activeBooking) {
                      cardStyle = 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-400';
                      badgeStyle = 'bg-indigo-100 text-indigo-800 border-indigo-300';
                      statusLabel = 'Booked';
                    } else if (isDirty) {
                      cardStyle = 'border-amber-300 bg-amber-50/50 hover:border-amber-500';
                      badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                      statusLabel = 'Dirty';
                    } else if (room.status === 'Out of Service') {
                      cardStyle = 'border-rose-200 bg-rose-50/40 hover:border-rose-400';
                      badgeStyle = 'bg-rose-100 text-rose-800 border-rose-300';
                      statusLabel = 'Blocked';
                    }

                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          if (activeBooking) {
                            onSelectBooking(activeBooking);
                          }
                        }}
                        className={`rounded-xl border p-3.5 transition flex flex-col justify-between min-h-[148px] min-w-0 overflow-hidden ${cardStyle} ${
                          activeBooking ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-slate-900 truncate">{room.name}</div>
                              <div className="text-[11px] text-slate-500 truncate">{room.floor} • {room.bedType}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 whitespace-nowrap ${badgeStyle}`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* Body details */}
                          <div className="mt-2.5 min-w-0">
                            {activeBooking ? (
                              <div className="space-y-1 min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {activeBooking.customerName}
                                </div>
                                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600">
                                  <span className="truncate">{activeBooking.nights} Night(s)</span>
                                  <span
                                    className={`font-bold shrink-0 ${
                                      activeBooking.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'
                                    }`}
                                  >
                                    {activeBooking.dueAmount > 0
                                      ? `Due ₹${Number(activeBooking.dueAmount || 0).toLocaleString('en-IN')}`
                                      : 'Settled'}
                                  </span>
                                </div>
                              </div>
                            ) : room.status === 'Out of Service' ? (
                              <div className="text-[11px] text-rose-700 font-medium flex items-center gap-1 mt-1">
                                <Ban className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{room.blockedReason || 'Blocked for Maintenance'}</span>
                              </div>
                            ) : isDirty ? (
                              <div className="text-[11px] text-amber-800 font-medium mt-1">
                                Housekeeping required before next check-in
                              </div>
                            ) : (
                              <div className="space-y-1 mt-1">
                                <div className="text-xs font-bold text-slate-700">
                                  {formatCurrency(room.rate)}{' '}
                                  <span className="text-[10px] font-normal text-slate-500">/ night</span>
                                </div>
                                {upcomingBooking && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectBooking(upcomingBooking);
                                    }}
                                    className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-1.5 py-0.5 truncate cursor-pointer hover:bg-indigo-100"
                                    title={`Upcoming Advance Booking: ${upcomingBooking.customerName} (${upcomingBooking.checkInDate})`}
                                  >
                                    Next: {upcomingBooking.customerName} ({upcomingBooking.checkInDate})
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer Actions - Strictly Mutually Exclusive & Overflow-Safe */}
                        <div
                          className="mt-3 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 w-full min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {activeBooking ? (
                            activeBooking.isCheckedIn && !activeBooking.isCheckedOut ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onQuickCheckOut(activeBooking)}
                                  className="flex-1 min-w-0 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-sm whitespace-nowrap"
                                  title="Check-Out Guest & Settle Folio"
                                >
                                  <LogOut className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Check-Out</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenRoomOrder(activeBooking)}
                                  className="py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shrink-0 shadow-2xs whitespace-nowrap"
                                  title="Order Food (POS Room Service)"
                                >
                                  <Utensils className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Food</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSelectBooking(activeBooking)}
                                  className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-[11px] transition flex items-center justify-center cursor-pointer shrink-0"
                                  title="View Booking Details, GRC & Invoices"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onOpenCheckIn(activeBooking)}
                                  className="flex-1 min-w-0 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-sm whitespace-nowrap"
                                  title="Check-In Guest"
                                >
                                  <LogIn className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Check-In</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSelectBooking(activeBooking)}
                                  className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                                  title="View Booking Details & Print GRC"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>Details</span>
                                </button>
                              </>
                            )
                          ) : room.status === 'Out of Service' || isDirty ? (
                            <button
                              type="button"
                              onClick={() => onOpenRoomTasks(room)}
                              className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                                isDirty
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
                              }`}
                            >
                              <ClipboardList className="w-3 h-3 shrink-0" />
                              <span className="truncate">{isDirty ? 'Clean Room (Dirty)' : 'Maintenance Tasks'}</span>
                            </button>
                          ) : bookChoiceRoomId === room.id ? (
                            <div className="w-full space-y-1.5 bg-white/95 p-1.5 rounded-xl border border-emerald-300 shadow-md">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 truncate">
                                  Book {room.name} As:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setBookChoiceRoomId(null)}
                                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer px-1 shrink-0"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookChoiceRoomId(null);
                                    onOpenQuickAddBooking(room, 'reservations');
                                  }}
                                  className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                  title="Create Advance Reservation for this Room"
                                >
                                  <CalendarCheck className="w-3 h-3 shrink-0" />
                                  <span>Advance</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookChoiceRoomId(null);
                                    onOpenQuickAddBooking(room, 'walkin');
                                  }}
                                  className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                  title="Instant Walk-In Check-In for this Room"
                                >
                                  <UserCheck className="w-3 h-3 shrink-0" />
                                  <span>Walk-In</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setBookChoiceRoomId(room.id)}
                                className="flex-1 min-w-0 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-sm whitespace-nowrap"
                              >
                                <Plus className="w-3 h-3 shrink-0" />
                                <span className="truncate">Book</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenRoomTasks(room)}
                                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                                  pendingTasks > 0
                                    ? 'bg-amber-500 text-slate-950 font-bold'
                                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
                                }`}
                                title="Assign or View Housekeeping Task for this Room"
                              >
                                <ClipboardList className="w-3 h-3 shrink-0" />
                                <span>{pendingTasks > 0 ? `Task (${pendingTasks})` : 'Task'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Bookings Queue Table (Today's / Upcoming / Check-In / Check-Out) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
            {[
              {
                id: 'today',
                label: "Today's Bookings",
                mobileLabel: "Today's Bookings",
                count: bookings.filter((b) => !isCheckedOutBooking(b) && b.status !== 'Cancelled').length
              },
              {
                id: 'upcoming',
                label: 'Upcoming Arrival',
                mobileLabel: 'Upcoming Arrival',
                count: bookings.filter((b) => !b.isCheckedIn && !isCheckedOutBooking(b) && b.status === 'Confirmed').length,
              },
              {
                id: 'checkin',
                label: 'In-House (Checked-In)',
                mobileLabel: 'In-House',
                count: bookings.filter((b) => b.isCheckedIn && !b.isCheckedOut && !isCheckedOutBooking(b)).length,
              },
              {
                id: 'checkout',
                label: 'Checked-Out / Departures',
                mobileLabel: 'Checked-Out',
                count: bookings.filter((b) => isCheckedOutBooking(b) || b.checkOutDate === selectedDate).length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setBookingTab(tab.id as any)}
                className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-between sm:justify-center gap-1.5 sm:gap-2 whitespace-nowrap border cursor-pointer ${
                  bookingTab === tab.id
                    ? 'bg-[#F5E3B8] text-[#6E5011] border-[#D4AD50] shadow-2xs'
                    : 'bg-[#FAF6EE] text-[#3E5068] border-[#E2D6BE] hover:bg-[#F2E8D2]'
                }`}
              >
                <span className="sm:hidden truncate">{tab.mobileLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] shrink-0 ${
                    bookingTab === tab.id ? 'bg-[#C49A3A] text-white' : 'bg-white text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guest, mobile, room, #ID..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-4">Booking ID</th>
                <th className="py-3.5 px-4">Guest & Source</th>
                <th className="py-3.5 px-4">Assigned Rooms</th>
                <th className="py-3.5 px-4">Check-In / Out</th>
                <th className="py-3.5 px-4">Total Payable</th>
                <th className="py-3.5 px-4">Paid / Balance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-slate-500">
                    No bookings found for the selected filter. Click <strong>+ Advance Booking</strong> or{' '}
                    <strong>+ Walk-In Booking</strong> to create a booking.
                  </td>
                </tr>
              ) : null}
              {paginatedBookings.map((booking) => (
                <tr
                  key={booking.id}
                  onClick={() => onSelectBooking(booking)}
                  className="hover:bg-amber-50/30 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                    <div>#{booking.bookingNo}</div>
                    <div className="text-[10px] font-normal text-slate-400">{booking.billId}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                      {booking.customerName}
                      {booking.bookingType === 'Corporate' && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                          Corp
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 whitespace-nowrap">
                      +91 {booking.mobile} • <span className="font-semibold text-amber-700">{booking.source}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {booking.roomNumbers.map((rn) => (
                        <span
                          key={rn}
                          className="px-2 py-0.5 rounded-md bg-[#FBF0D4] text-[#7A5813] border border-[#DFC078] font-bold text-[11px] whitespace-nowrap"
                        >
                          Rm {rn}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">{booking.roomCategorySummary}</div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-800">
                      {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {booking.nights} Night(s) • {booking.numGuests} Guests
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-extrabold text-slate-900">{formatCurrency(booking.totalPayable)}</div>
                    {booking.otherServicesTotal > 0 && (
                      <div className="text-[10px] text-amber-700 font-medium">
                        Incl. POS/Add-ons {formatCurrency(booking.otherServicesTotal)}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-semibold text-emerald-700">Paid: {formatCurrency(booking.amountPaid)}</div>
                    <div
                      className={`text-[11px] font-bold ${
                        booking.dueAmount > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      {booking.dueAmount > 0 ? `Due: ${formatCurrency(booking.dueAmount)}` : 'Full Settled'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        booking.status === 'Checked In'
                          ? 'bg-emerald-100 text-emerald-800'
                          : booking.status === 'Confirmed'
                          ? 'bg-blue-100 text-blue-800'
                          : booking.status === 'Checked Out'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {booking.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {!booking.isCheckedIn && !isCheckedOutBooking(booking) && booking.status !== 'Cancelled' && booking.status !== 'No-Show' && (
                        <>
                          <button
                            onClick={() => onOpenCheckIn(booking)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <LogIn className="w-3 h-3" />
                            Check-In
                          </button>
                          {onCancelBooking && (
                            <button
                              onClick={() => onCancelBooking(booking)}
                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] cursor-pointer"
                              title="Cancel Advance Booking & Refund"
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      )}
                      {booking.isCheckedIn && !booking.isCheckedOut && !isCheckedOutBooking(booking) && (
                        <button
                          onClick={() => onQuickCheckOut(booking)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          Check-Out
                        </button>
                      )}
                      {booking.dueAmount > 0 && (
                        <button
                          onClick={() => onOpenRecordPayment(booking)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1"
                        >
                          <CreditCard className="w-3 h-3" />
                          Pay
                        </button>
                      )}
                      <button
                        onClick={() => onOpenInvoice(booking, 'Booking + Other Services')}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        title="Preview GST Invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectBooking(booking)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                        title="Open Booking Details Drawer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Bar */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-xs text-slate-500 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <span>
              Showing <strong className="text-slate-800">{totalBookings === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-slate-800">{endIndex}</strong> of{' '}
              <strong className="text-slate-800">{totalBookings}</strong> entries
            </span>
            <div className="flex items-center gap-1.5 ml-0 sm:ml-4">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 w-full sm:w-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1 ${
                currentPage <= 1
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
              }`}
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const isCurrent = p === currentPage;
                return (
                  <React.Fragment key={p}>
                    {prev && p - prev > 1 && <span className="px-1 text-slate-400">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg font-bold text-xs transition ${
                        isCurrent
                          ? 'bg-[#C49A3A] text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1 ${
                currentPage >= totalPages
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                Room Occupancy vs Availability (7-Day Window)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Daily occupied rooms vs available inventory
              </p>
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
              Live {occupancyPct}% Occupancy
            </span>
          </div>

          {totalRooms === 0 ? (
            <div className="h-40 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center justify-center p-4 text-center">
              <BedDouble className="w-6 h-6 text-slate-400 mb-1.5" />
              <div className="text-xs font-bold text-slate-700">No Occupancy Data Available</div>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                Add rooms in Room Management to visualize 7-day occupancy and availability trends.
              </p>
            </div>
          ) : (
            <div className="relative h-40 sm:h-44 flex items-end justify-between gap-1.5 sm:gap-3 pt-5 px-1 sm:px-2 border-b border-slate-200">
              {/* Subtle reference lines */}
              <div className="pointer-events-none absolute inset-x-0 top-5 bottom-6 flex flex-col justify-between">
                <div className="border-t border-dashed border-slate-100 w-full" />
                <div className="border-t border-dashed border-slate-100 w-full" />
              </div>
              {chartData.map((d) => {
                const denom = Math.max(1, totalRooms);
                const occHeight = d.occupied > 0 ? Math.max(10, Math.round((d.occupied / denom) * 108)) : 4;
                const avlHeight = d.available > 0 ? Math.max(10, Math.round((d.available / denom) * 108)) : 4;
                return (
                  <div key={d.day} className="relative z-10 flex-1 flex flex-col items-center gap-1.5 group min-w-0">
                    <div className="flex items-end justify-center gap-1 sm:gap-1.5 h-28 w-full">
                      <div className="flex flex-col items-center justify-end h-full">
                        {d.occupied > 0 && (
                          <span className="text-[9px] font-bold text-slate-700 mb-0.5 leading-none">{d.occupied}</span>
                        )}
                        <div
                          data-chart-bar="true"
                          style={{ height: `${occHeight}px`, backgroundColor: '#1E293B' }}
                          title={`${d.day}: ${d.occupied} Occupied`}
                          className="chart-bar w-3 sm:w-4 rounded-t-md transition-all"
                        />
                      </div>
                      <div className="flex flex-col items-center justify-end h-full">
                        {d.available > 0 && (
                          <span className="text-[9px] font-bold text-amber-700 mb-0.5 leading-none">{d.available}</span>
                        )}
                        <div
                          data-chart-bar="true"
                          style={{ height: `${avlHeight}px`, backgroundColor: '#F59E0B' }}
                          title={`${d.day}: ${d.available} Available`}
                          className="chart-bar w-3 sm:w-4 rounded-t-md transition-all"
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 pb-1.5 truncate">{d.day}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-3 text-[11px] sm:text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span
                data-chart-bar="true"
                style={{ backgroundColor: '#1E293B' }}
                className="chart-bar w-3 h-3 rounded inline-block shrink-0"
              />{' '}
              Occupied Rooms
            </span>
            <span className="flex items-center gap-1.5">
              <span
                data-chart-bar="true"
                style={{ backgroundColor: '#F59E0B' }}
                className="chart-bar w-3 h-3 rounded inline-block shrink-0"
              />{' '}
              Available Rooms
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                Room Tariff vs POS Food Revenue Trend
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Combined daily revenue across Front Desk & Restaurant
              </p>
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0">
              Total: {formatCurrency(totalRevenue)}
            </span>
          </div>

          {totalRevenue === 0 && chartData.every((d) => d.revenue === 0 && d.pos === 0) ? (
            <div className="h-40 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center justify-center p-4 text-center">
              <IndianRupee className="w-6 h-6 text-amber-500 mb-1.5" />
              <div className="text-xs font-bold text-slate-700">No Revenue Recorded in 7-Day Window</div>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                Room tariff and POS F&B collections will appear here automatically once bookings or orders are created.
              </p>
            </div>
          ) : (
            <div className="relative h-40 sm:h-44 flex items-end justify-between gap-1.5 sm:gap-3 pt-5 px-1 sm:px-2 border-b border-slate-200">
              <div className="pointer-events-none absolute inset-x-0 top-5 bottom-6 flex flex-col justify-between">
                <div className="border-t border-dashed border-slate-100 w-full" />
                <div className="border-t border-dashed border-slate-100 w-full" />
              </div>
              {chartData.map((d) => {
                const maxRev = Math.max(1000, ...chartData.map((x) => Math.max(x.revenue, x.pos)));
                const revHeight = d.revenue > 0 ? Math.max(10, Math.round((d.revenue / maxRev) * 108)) : 4;
                const posHeight = d.pos > 0 ? Math.max(10, Math.round((d.pos / maxRev) * 108)) : 4;
                return (
                  <div key={d.day} className="relative z-10 flex-1 flex flex-col items-center gap-1.5 group min-w-0">
                    <div className="flex items-end justify-center gap-1 sm:gap-1.5 h-28 w-full">
                      <div
                        data-chart-bar="true"
                        style={{ height: `${revHeight}px`, backgroundColor: '#D97706' }}
                        title={`${d.day} Rooms: ${formatCurrency(d.revenue)}`}
                        className="chart-bar w-3 sm:w-4 rounded-t-md transition-all"
                      />
                      <div
                        data-chart-bar="true"
                        style={{ height: `${posHeight}px`, backgroundColor: '#2563EB' }}
                        title={`${d.day} POS F&B: ${formatCurrency(d.pos)}`}
                        className="chart-bar w-3 sm:w-4 rounded-t-md transition-all"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 pb-1.5 truncate">{d.day}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-3 text-[11px] sm:text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span
                data-chart-bar="true"
                style={{ backgroundColor: '#D97706' }}
                className="chart-bar w-3 h-3 rounded inline-block shrink-0"
              />{' '}
              Room Tariff Revenue (₹)
            </span>
            <span className="flex items-center gap-1.5">
              <span
                data-chart-bar="true"
                style={{ backgroundColor: '#2563EB' }}
                className="chart-bar w-3 h-3 rounded inline-block shrink-0"
              />{' '}
              POS F&B Revenue (₹)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
