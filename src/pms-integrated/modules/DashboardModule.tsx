import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BedDouble,
  Calendar,
  Plus,
  Search,
  LogIn,
  LogOut,
  CheckCircle2,
  Clock,
  Ban,
  Sparkles,
  ShieldCheck,
  Bell,
  CalendarDays,
  ArrowRight,
  ArrowLeftRight,
  PlusCircle,
  UserPlus,
  Receipt,
  ChevronDown,
  GripVertical,
  RefreshCw,
  AlertTriangle,
  X,
  Utensils,
  Eye,
  ClipboardList,
} from 'lucide-react';
import { BookingRecord, HousekeepingTask, RoomAsset, RoomBlockRecord } from '../types';
import { getTodayIst, formatDdmmyyyy } from '../../utils/reportingDates';
import { formatCurrency } from '../utils/formatters';
import type { Booking, GuestCheckIn, Invoice, PosOrder, Room } from '../../types';
import {
  computeDashboardMetrics,
  KpiDeltaSummary,
} from '../../utils/dashboardMetrics';

const PREFERRED_CATEGORY_ORDER = ['Deluxe', 'Executive', 'Standard', 'Family'];

export const normalizeCategory = (cat?: string): string => {
  if (!cat) return 'Standard';
  const trimmed = cat.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'delux' || lower === 'deluxe') return 'Deluxe';
  if (lower === 'executive' || lower === 'executive room' || lower === 'executive suite') return 'Executive';
  if (lower === 'standard' || lower === 'standard room') return 'Standard';
  if (lower === 'family' || lower === 'family room' || lower === 'family suite' || lower === 'familyroom') return 'Family';
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

interface DashboardModuleProps {
  rooms: RoomAsset[];
  bookings: BookingRecord[];
  tasks: HousekeepingTask[];
  hotelName?: string;
  appRooms?: Room[];
  appBookings?: Booking[];
  appCheckins?: GuestCheckIn[];
  appPosOrders?: PosOrder[];
  appInvoices?: Invoice[];
  roomBlocks?: RoomBlockRecord[];
  hotelSettings?: any;
  onUpdateBookings?: (bookings: Booking[]) => void;
  onUpdateRooms?: (rooms: Room[]) => void;
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  onChangeRoom?: (
    bookingId: string,
    newRoomNumber: string,
    newRoomRate: number,
    preserveLockedTariff?: boolean
  ) => void;
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

function renderDeltaBadge(delta: KpiDeltaSummary): React.ReactNode {
  if (delta.pctChange === null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
        0%
      </span>
    );
  }
  if (delta.direction === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
        ↑ {delta.pctChange}%
      </span>
    );
  }
  if (delta.direction === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200/70">
        ↓ {delta.pctChange}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
      0%
    </span>
  );
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  rooms,
  bookings,
  tasks,
  appRooms = [],
  appBookings = [],
  appCheckins = [],
  appPosOrders = [],
  appInvoices = [],
  roomBlocks = [],
  hotelSettings,
  onUpdateBookings,
  onUpdateRooms,
  onChangeRoom,
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
  const todayIso = useMemo(() => getTodayIst(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  // Live Room Status Rack State
  const [roomFilter, setRoomFilter] = useState<'All' | 'Available' | 'Occupied' | 'Confirmed' | 'Dirty' | 'Out of Service'>('All');
  const [bookChoiceRoomId, setBookChoiceRoomId] = useState<string | null>(null);

  // Quick Action Modals: Assign Room & Room Move
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedUnassignedBookingId, setSelectedUnassignedBookingId] = useState<string>('');
  const [selectedAssignRoomNo, setSelectedAssignRoomNo] = useState<string>('');

  const [roomMoveModalOpen, setRoomMoveModalOpen] = useState<boolean>(false);
  const [selectedMoveBookingId, setSelectedMoveBookingId] = useState<string>('');
  const [selectedMoveTargetRoomNo, setSelectedMoveTargetRoomNo] = useState<string>('');
  const [keepOriginalRate, setKeepOriginalRate] = useState<boolean>(true);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Cmd+K / Ctrl+K shortcut for Dashboard global search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        selectedDate,
        rooms,
        bookings,
        tasks,
        appRooms,
        appBookings,
        appCheckins,
        appPosOrders,
        appInvoices,
        roomBlocks,
        standardCheckInTime: hotelSettings?.checkInTime || '12:00 PM',
        standardCheckOutTime: hotelSettings?.checkOutTime || '11:00 AM',
      }),
    [
      selectedDate,
      rooms,
      bookings,
      tasks,
      appRooms,
      appBookings,
      appCheckins,
      appPosOrders,
      appInvoices,
      roomBlocks,
      hotelSettings,
    ]
  );

  // Live search results across guests, rooms, and reservations
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchingBookings: [] as BookingRecord[], matchingRooms: [] as RoomAsset[] };
    const matchingBookings = bookings
      .filter(
        (b) =>
          b.customerName.toLowerCase().includes(q) ||
          b.bookingNo.toLowerCase().includes(q) ||
          b.mobile.toLowerCase().includes(q) ||
          b.roomNumbers.some((rn) => rn.toLowerCase().includes(q))
      )
      .slice(0, 6);
    const matchingRooms = rooms
      .filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      )
      .slice(0, 4);
    return { matchingBookings, matchingRooms };
  }, [searchQuery, bookings, rooms]);

  // Unallocated bookings eligible for Assign Room
  const unallocatedBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const st = String(b.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'no-show' || st === 'checked out' || b.isCheckedOut) {
          return false;
        }
        const validRooms = b.roomNumbers.filter(
          (rn) => rn && !/unassigned|tba|pending/i.test(rn)
        );
        return validRooms.length === 0;
      }),
    [bookings]
  );

  // Active in-house or confirmed stays eligible for Room Move
  const movableBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const st = String(b.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'no-show' || st === 'checked out' || b.isCheckedOut) {
          return false;
        }
        return b.roomNumbers.filter(Boolean).length > 0;
      }),
    [bookings]
  );

  const cleanAvailableRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.status === 'Available' &&
          r.cleaningStatus !== 'Dirty' &&
          String(r.status) !== 'Out of Service'
      ),
    [rooms]
  );

  const triggerOpenNewReservation = () => {
    onNavigate('frontDesk', 'checkin');
  };

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

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(rooms.map((r) => normalizeCategory(r.category)).filter(Boolean))
    );

    return unique.sort((a, b) => {
      const idxA = PREFERRED_CATEGORY_ORDER.indexOf(a);
      const idxB = PREFERRED_CATEGORY_ORDER.indexOf(b);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [rooms]);

  const handleAssignRoomSubmit = () => {
    if (!selectedUnassignedBookingId || !selectedAssignRoomNo) return;
    const targetRoom = rooms.find((r) => r.number === selectedAssignRoomNo);
    if (!targetRoom) return;

    if (onChangeRoom) {
      onChangeRoom(selectedUnassignedBookingId, targetRoom.number, targetRoom.rate, true);
    } else if (onUpdateBookings) {
      const updated = appBookings.map((bk) =>
        bk.id === selectedUnassignedBookingId
          ? { ...bk, roomNumber: targetRoom.number, roomType: targetRoom.category as any }
          : bk
      );
      onUpdateBookings(updated);
      if (onUpdateRooms) {
        onUpdateRooms(
          appRooms.map((rm) =>
            rm.number === targetRoom.number ? { ...rm, status: 'Reserved' as any } : rm
          )
        );
      }
    }
    setAssignModalOpen(false);
    setActionToast(`Assigned Room ${targetRoom.number} successfully.`);
    setTimeout(() => setActionToast(null), 3500);
  };

  const handleRoomMoveSubmit = () => {
    if (!selectedMoveBookingId || !selectedMoveTargetRoomNo) return;
    const targetRoom = rooms.find((r) => r.number === selectedMoveTargetRoomNo);
    if (!targetRoom) return;

    if (onChangeRoom) {
      onChangeRoom(selectedMoveBookingId, targetRoom.number, targetRoom.rate, keepOriginalRate);
    }
    setRoomMoveModalOpen(false);
    setActionToast(`Moved guest to Room ${targetRoom.number} successfully.`);
    setTimeout(() => setActionToast(null), 3500);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Subtle Confirmation Banner */}
      {actionToast && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-2xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {actionToast}
          </span>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            className="text-emerald-700 hover:text-emerald-950"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TOP BAR: Dashboard Title • Global Search • + New Reservation • Date  */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E8DEC8] px-4 py-3 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-serif font-extrabold text-[#17120F] shrink-0">
            Dashboard
          </h1>

          {/* Live Global Search */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-[#9E886B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guests, rooms, reservations..."
              className="w-full pl-9 pr-14 py-2 rounded-xl bg-[#FAF7F0] border border-[#E5DAC3] text-xs sm:text-[13px] text-[#17120F] placeholder:text-[#9E886B] focus:outline-none focus:border-[#C49A3A] focus:bg-white transition"
            />
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-[#E2D6BE] bg-white text-[10px] font-mono font-semibold text-[#8C7355] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              ⌘K
            </span>

            {searchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-2xl bg-white border border-[#E2D6BE] shadow-xl z-30 overflow-hidden max-h-80 overflow-y-auto">
                {searchResults.matchingBookings.length === 0 &&
                searchResults.matchingRooms.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs text-slate-500">
                    No matching guests, rooms, or reservations for &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {searchResults.matchingBookings.map((bk) => (
                      <button
                        key={bk.id}
                        type="button"
                        onMouseDown={() => {
                          onSelectBooking(bk);
                          setSearchQuery('');
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-[#FAF6EE] flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#17120F] truncate">
                            {bk.customerName}{' '}
                            <span className="font-mono text-[11px] text-[#8C7355]">
                              ({bk.bookingNo})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            Room {bk.roomNumbers.join(', ') || 'TBA'} • {bk.checkInDate} →{' '}
                            {bk.checkOutDate}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                          {bk.status}
                        </span>
                      </button>
                    ))}
                    {searchResults.matchingRooms.map((rm) => (
                      <button
                        key={rm.id}
                        type="button"
                        onMouseDown={() => {
                          onNavigate('rooms', 'status');
                          setSearchQuery('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-[#FAF6EE] flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-[#17120F]">
                          Room {rm.number} • <span className="text-slate-500">{rm.category}</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#8C7355]">{rm.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={triggerOpenNewReservation}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#1E1610] to-[#2C2017] hover:from-black hover:to-[#1E1610] text-[#F5D88A] border border-[#C49A3A]/50 font-bold text-xs shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#DFB962] stroke-[2.5]" />
            <span>New Reservation</span>
          </button>

          {/* Operational Date Pill */}
          <div className="relative flex items-center gap-1.5 bg-[#FAF7F0] hover:bg-[#F4EFE2] border border-[#E2D6BE] rounded-xl px-3 py-1.5 transition">
            <Calendar className="w-3.5 h-3.5 text-[#B08326] shrink-0 pointer-events-none" />
            <button
              type="button"
              onClick={() => {
                if (dateInputRef.current?.showPicker) {
                  dateInputRef.current.showPicker();
                } else {
                  dateInputRef.current?.focus();
                }
              }}
              className="text-xs font-semibold text-[#17120F] flex items-center gap-1.5 cursor-pointer"
            >
              <span>{metrics.formattedDateLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8C7355]" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              aria-label="Select operational date"
              className="sr-only"
            />
            {selectedDate !== todayIso && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso)}
                className="ml-1 px-1.5 py-0.5 rounded bg-[#DFB962]/25 text-[#6E5011] text-[10px] font-bold hover:bg-[#DFB962]/40 cursor-pointer"
                title="Reset to Today"
              >
                Today
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ROW 1: TOP 6 KPI CARDS                                               */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        {/* 1. Today's Revenue */}
        <div
          onClick={() => onNavigate('reports', 'daily_sales')}
          className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs hover:border-[#C49A3A] transition cursor-pointer flex flex-col justify-between min-h-[108px]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6A53]">
            Today&apos;s Revenue
          </div>
          <div className="text-2xl font-extrabold text-[#17120F] mt-1 tracking-tight">
            {formatCurrency(metrics.todaysRevenue)}
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="truncate">
              {metrics.revenueDelta.yesterdayValue > 0
                ? `vs Y'day ${formatCurrency(metrics.revenueDelta.yesterdayValue)}`
                : 'Room + F&B + Other'}
            </span>
            {metrics.revenueDelta.pctChange !== null && renderDeltaBadge(metrics.revenueDelta)}
          </div>
        </div>

        {/* 2. ADR Today */}
        <div
          onClick={() => onNavigate('reports', 'daily_sales')}
          className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs hover:border-[#C49A3A] transition cursor-pointer flex flex-col justify-between min-h-[108px]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6A53]">
            ADR Today
          </div>
          <div className="text-2xl font-extrabold text-[#17120F] mt-1 tracking-tight">
            {formatCurrency(metrics.adrToday)}
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="truncate">
              vs Y&apos;day {formatCurrency(metrics.adrDelta.yesterdayValue)}
            </span>
            {renderDeltaBadge(metrics.adrDelta)}
          </div>
        </div>

        {/* 3. RevPAR Today */}
        <div
          onClick={() => onNavigate('reports', 'daily_sales')}
          className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs hover:border-[#C49A3A] transition cursor-pointer flex flex-col justify-between min-h-[108px]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6A53]">
            RevPAR Today
          </div>
          <div className="text-2xl font-extrabold text-[#17120F] mt-1 tracking-tight">
            {formatCurrency(metrics.revParToday)}
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="truncate">
              vs Y&apos;day {formatCurrency(metrics.revParDelta.yesterdayValue)}
            </span>
            {renderDeltaBadge(metrics.revParDelta)}
          </div>
        </div>

        {/* 4. Arrivals Today */}
        <div
          onClick={() => onNavigate('reports', 'arrivals_departures')}
          className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs hover:border-[#C49A3A] transition cursor-pointer flex flex-col justify-between min-h-[108px]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6A53]">
            Arrivals Today
          </div>
          <div className="text-2xl font-extrabold text-[#17120F] mt-1 tracking-tight">
            {metrics.arrivalsTodayCount}
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Expected Today</span>
            {metrics.arrivalsCheckedInCount > 0 && (
              <span className="text-[10px] font-bold text-emerald-700">
                {metrics.arrivalsCheckedInCount} Checked In
              </span>
            )}
          </div>
        </div>

        {/* 5. Departures Today */}
        <div
          onClick={() => onNavigate('frontDesk', 'checkout')}
          className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs hover:border-[#C49A3A] transition cursor-pointer flex flex-col justify-between min-h-[108px]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6A53]">
            Departures Today
          </div>
          <div className="text-2xl font-extrabold text-[#17120F] mt-1 tracking-tight">
            {metrics.departuresTodayCount}
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span>Expected Today</span>
            {metrics.departuresCompletedCount > 0 && (
              <span className="text-[10px] font-bold text-slate-600">
                {metrics.departuresCompletedCount} Out
              </span>
            )}
          </div>
        </div>

        {/* 6. In-House Guests */}
        <div
          onClick={() => onNavigate('frontDesk', 'inhouse')}
          className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs hover:border-[#C49A3A] transition cursor-pointer flex flex-col justify-between min-h-[108px]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7A6A53]">
            In-House Guests
          </div>
          <div className="text-2xl font-extrabold text-[#17120F] mt-1 tracking-tight flex items-baseline gap-1.5">
            <span>{metrics.inHouseRoomsCount}</span>
            <span className="text-xs font-semibold text-slate-500">
              ({metrics.inHouseGuestsTotal} {metrics.inHouseGuestsTotal === 1 ? 'Guest' : 'Guests'})
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="truncate">
              {metrics.inHouseRoomsCount} {metrics.inHouseRoomsCount === 1 ? 'Active Stay' : 'Active Stays'} •{' '}
              {metrics.inHouseAdults}A, {metrics.inHouseChildren}C
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ROW 2: ROOM STATUS • HOUSEKEEPING • ALERTS & TASKS • SNAPSHOT        */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: ROOM STATUS */}
        <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#17120F]">
                  Room Status
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('rooms', 'status')}
                title="Open Room Status"
                className="text-slate-400 hover:text-[#17120F] cursor-pointer"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs mt-1">
              {[
                {
                  label: 'Vacant',
                  value: metrics.roomStatus.vacant,
                  icon: <BedDouble className="w-3.5 h-3.5 text-emerald-600" />,
                  onClick: () => onNavigate('rooms', 'status'),
                },
                {
                  label: 'Occupied',
                  value: metrics.roomStatus.occupied,
                  icon: <BedDouble className="w-3.5 h-3.5 text-blue-600" />,
                  onClick: () => onNavigate('frontDesk', 'inhouse'),
                },
                {
                  label: 'Dirty',
                  value: metrics.roomStatus.dirty,
                  icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
                  onClick: () => onNavigate('housekeeping', 'dashboard'),
                },
                {
                  label: 'Clean',
                  value: metrics.roomStatus.clean,
                  icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
                  onClick: () => onNavigate('housekeeping', 'dashboard'),
                },
                {
                  label: 'Out of Order',
                  value: metrics.roomStatus.outOfOrder,
                  icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />,
                  onClick: () => onNavigate('rooms', 'blockAssets'),
                },
                {
                  label: 'Inspected',
                  value: metrics.roomStatus.inspected,
                  icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />,
                  onClick: () => onNavigate('housekeeping', 'dashboard'),
                },
              ].map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="w-full py-2.5 flex items-center justify-between hover:bg-[#FAF7F0] px-1.5 rounded-lg transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-slate-700 font-medium">
                    {row.icon}
                    <span>{row.label}</span>
                  </span>
                  <span className="font-extrabold text-[#17120F]">{row.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200/80 flex items-center justify-between text-xs px-1.5">
            <span className="font-bold text-[#17120F]">Total Rooms</span>
            <span className="font-extrabold text-[#17120F]">{metrics.roomStatus.totalRooms}</span>
          </div>
        </div>

        {/* Card 2: HOUSEKEEPING STATUS */}
        <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C49A3A]" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#17120F]">
                  Housekeeping Status
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('housekeeping', 'dashboard')}
                title="Open Housekeeping"
                className="text-slate-400 hover:text-[#17120F] cursor-pointer"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs mt-1">
              {[
                {
                  label: 'Rooms to Clean',
                  value: metrics.housekeepingStatus.roomsToClean,
                  icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
                },
                {
                  label: 'Cleaning In Progress',
                  value: metrics.housekeepingStatus.cleaningInProgress,
                  icon: <RefreshCw className="w-3.5 h-3.5 text-blue-500" />,
                },
                {
                  label: 'Ready Rooms',
                  value: metrics.housekeepingStatus.readyRooms,
                  icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
                },
                {
                  label: 'Inspection Pending',
                  value: metrics.housekeepingStatus.inspectionPending,
                  icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
                },
              ].map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => onNavigate('housekeeping', 'dashboard')}
                  className="w-full py-2.5 flex items-center justify-between hover:bg-[#FAF7F0] px-1.5 rounded-lg transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-slate-700 font-medium">
                    {row.icon}
                    <span>{row.label}</span>
                  </span>
                  <span className="font-extrabold text-[#17120F]">{row.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200/80 flex items-center justify-between text-xs px-1.5">
            <span className="font-bold text-[#17120F]">Total Rooms</span>
            <span className="font-extrabold text-[#17120F]">
              {metrics.housekeepingStatus.totalRooms}
            </span>
          </div>
        </div>

        {/* Card 3: ALERTS & TASKS */}
        <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#C49A3A]" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#17120F]">
                  Alerts &amp; Tasks
                </h2>
              </div>
              <GripVertical className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="divide-y divide-slate-100 text-xs mt-1">
              {[
                {
                  label: 'Late Check-outs',
                  value: metrics.alertsAndTasks.lateCheckouts,
                  pillCls: 'bg-rose-50 text-rose-600 border-rose-200/70',
                  onClick: () => onNavigate('frontDesk', 'checkout'),
                },
                {
                  label: 'Early Arrivals',
                  value: metrics.alertsAndTasks.earlyArrivals,
                  pillCls: 'bg-amber-50 text-amber-700 border-amber-200/70',
                  onClick: () => onNavigate('reports', 'arrivals_departures'),
                },
                {
                  label: 'VIP Arrivals',
                  value: metrics.alertsAndTasks.vipArrivals,
                  pillCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
                  onClick: () => onNavigate('frontDesk', 'reservations'),
                },
                {
                  label: 'Pending Payments',
                  value: metrics.alertsAndTasks.pendingPayments,
                  pillCls: 'bg-rose-50 text-rose-600 border-rose-200/70',
                  onClick: () => onNavigate('reports', 'pending_dues'),
                },
                {
                  label: 'Open Maintenance',
                  value: metrics.alertsAndTasks.openMaintenance,
                  pillCls: 'bg-amber-50 text-amber-700 border-amber-200/70',
                  onClick: () => onNavigate('rooms', 'blockAssets'),
                },
                {
                  label: 'Overbookings',
                  value: metrics.alertsAndTasks.overbookings,
                  pillCls: 'bg-rose-50 text-rose-600 border-rose-200/70',
                  onClick: () => onNavigate('calendar'),
                },
              ].map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="w-full py-2.5 flex items-center justify-between hover:bg-[#FAF7F0] px-1.5 rounded-lg transition cursor-pointer"
                >
                  <span className="text-slate-700 font-medium">{row.label}</span>
                  <span
                    className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-extrabold border inline-flex items-center justify-center ${row.pillCls}`}
                  >
                    {row.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: RESERVATIONS SNAPSHOT */}
        <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#17120F]">
                  Reservations Snapshot
                </h2>
              </div>
              <GripVertical className="w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="divide-y divide-slate-100 text-xs mt-1">
              {[
                {
                  label: "Today's Bookings",
                  value: metrics.reservationsSnapshot.todaysBookings,
                  badge: null as string | null,
                  onClick: () => onNavigate('frontDesk', 'reservations'),
                },
                {
                  label: 'Walk-ins',
                  value: metrics.reservationsSnapshot.walkIns,
                  badge: null as string | null,
                  onClick: () => onNavigate('frontDesk', 'walkin'),
                },
                {
                  label: 'Cancelled',
                  value: metrics.reservationsSnapshot.cancelled,
                  badge: 'bg-rose-50 text-rose-600 border-rose-200/70',
                  onClick: () => onNavigate('reports', 'noshows_cancellations'),
                },
                {
                  label: 'No Shows',
                  value: metrics.reservationsSnapshot.noShows,
                  badge: 'bg-rose-50 text-rose-600 border-rose-200/70',
                  onClick: () => onNavigate('reports', 'noshows_cancellations'),
                },
              ].map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="w-full py-2.5 flex items-center justify-between hover:bg-[#FAF7F0] px-1.5 rounded-lg transition cursor-pointer"
                >
                  <span className="text-slate-700 font-medium">{row.label}</span>
                  {row.badge ? (
                    <span
                      className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-extrabold border inline-flex items-center justify-center ${row.badge}`}
                    >
                      {row.value}
                    </span>
                  ) : (
                    <span className="font-extrabold text-[#17120F]">{row.value}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div
            onClick={() => onNavigate('calendar')}
            className="mt-3 rounded-xl bg-emerald-50/85 border border-emerald-200/80 px-3.5 py-3 flex items-center justify-between cursor-pointer hover:bg-emerald-100/70 transition"
          >
            <div>
              <div className="text-xs font-bold text-slate-800">Expected Occ Tomorrow</div>
              <div className="text-[10px] text-emerald-700 font-medium">
                {metrics.reservationsSnapshot.expectedOccTomorrowRooms} of{' '}
                {metrics.roomStatus.totalRooms} rooms booked
              </div>
            </div>
            <span className="text-lg font-extrabold text-emerald-700">
              {metrics.reservationsSnapshot.expectedOccTomorrowPct}%
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* LIVE ROOM STATUS RACK (CLICK ROOM FOR ACTIONS / PROCEDURE)          */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#17120F] flex items-center gap-2 leading-snug">
              <BedDouble className="w-4 h-4 sm:w-5 sm:h-5 text-[#C49A3A] shrink-0" />
              <span>Live Room Status Rack (Click Room for Booking Details or Quick Book)</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed">
              Grouped by Asset Categories • Click any room card to book, view details, assign tasks, or settle folio.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(['All', 'Available', 'Occupied', 'Confirmed', 'Dirty', 'Out of Service'] as const).map((status) => {
              const count =
                status === 'All'
                  ? rooms.length
                  : status === 'Dirty'
                  ? rooms.filter((r) => r.status === 'Dirty' || r.cleaningStatus === 'Dirty').length
                  : rooms.filter((r) => r.status === status).length;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setRoomFilter(status)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center justify-between sm:justify-center gap-1.5 whitespace-nowrap border cursor-pointer ${
                    roomFilter === status
                      ? 'bg-gradient-to-r from-[#DFB962] via-[#CEA346] to-[#BE9032] text-[#17120F] font-bold shadow-2xs border-[#C49A3A]'
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

        <div className="space-y-5">
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
                type="button"
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

              return categories.map((category) => {
                const categoryRooms = rooms
                  .filter((r) => {
                    if (normalizeCategory(r.category) !== category) return false;
                    if (roomFilter === 'All') return true;
                    if (roomFilter === 'Dirty') return r.status === 'Dirty' || r.cleaningStatus === 'Dirty';
                    return r.status === roomFilter;
                  })
                  .sort((a, b) => {
                    const numA = parseInt(String(a.number).replace(/\D/g, ''), 10) || 0;
                    const numB = parseInt(String(b.number).replace(/\D/g, ''), 10) || 0;
                    return numA - numB;
                  });

                if (categoryRooms.length === 0) return null;

                return (
                  <div key={category} className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-2">
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

                            {/* Card Footer Actions */}
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
                              ) : (
                                <div className="flex items-center gap-1.5 w-full">
                                  <button
                                    type="button"
                                    onClick={() => onOpenQuickAddBooking(room, 'checkin')}
                                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-sm whitespace-nowrap"
                                    title="Book Room Now"
                                  >
                                    <Plus className="w-3 h-3 shrink-0" />
                                    <span>Book Room</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenRoomTasks(room)}
                                    className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-[11px] transition flex items-center justify-center cursor-pointer shrink-0"
                                    title="Assign Task or Note for Room"
                                  >
                                    <ClipboardList className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ROW 3: TODAY'S ARRIVALS & TODAY'S DEPARTURES TABLES                  */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
        {/* TODAY'S ARRIVALS */}
        <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#17120F]">
                  Today&apos;s Arrivals
                </h2>
              </div>
              {metrics.todaysArrivals.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF6EE] text-[#6E5011] border border-[#E2D6BE]">
                  {metrics.todaysArrivals.length} Scheduled
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                    <th className="py-2.5 pr-3">Guest Name</th>
                    <th className="py-2.5 px-2">ETA</th>
                    <th className="py-2.5 px-2">Room</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 pl-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {metrics.todaysArrivals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                        No arrivals scheduled for today
                      </td>
                    </tr>
                  ) : (
                    metrics.todaysArrivals.slice(0, 6).map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => {
                          if (row.hubBooking) {
                            if (!row.hubBooking.isCheckedIn) {
                              onOpenCheckIn(row.hubBooking);
                            } else {
                              onSelectBooking(row.hubBooking);
                            }
                          }
                        }}
                        className="hover:bg-[#FAF7F0] transition cursor-pointer"
                      >
                        <td className="py-2.5 pr-3 font-bold text-[#17120F]">
                          <div className="truncate max-w-[160px]">{row.guestName}</div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">{row.eta}</td>
                        <td className="py-2.5 px-2 font-semibold text-slate-800 whitespace-nowrap">
                          {row.roomLabel}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 truncate max-w-[120px]">
                          {row.roomType}
                        </td>
                        <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Checked In'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.status === 'VIP'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : row.status === 'Pending'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('reports', 'arrivals_departures')}
              className="text-xs font-bold text-[#17120F] hover:text-[#B08326] inline-flex items-center gap-1 transition cursor-pointer"
            >
              <span>View all arrivals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TODAY'S DEPARTURES */}
        <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-[#C49A3A]" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#17120F]">
                  Today&apos;s Departures
                </h2>
              </div>
              {metrics.todaysDepartures.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF6EE] text-[#6E5011] border border-[#E2D6BE]">
                  {metrics.todaysDepartures.length} Due Out
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                    <th className="py-2.5 pr-3">Guest Name</th>
                    <th className="py-2.5 px-2">Room</th>
                    <th className="py-2.5 px-2">Checkout Time</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 pl-2 text-right">Bill Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {metrics.todaysDepartures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                        No departures scheduled for today
                      </td>
                    </tr>
                  ) : (
                    metrics.todaysDepartures.slice(0, 6).map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => {
                          if (row.hubBooking) {
                            if (row.hubBooking.isCheckedIn && !row.hubBooking.isCheckedOut) {
                              onQuickCheckOut(row.hubBooking);
                            } else {
                              onSelectBooking(row.hubBooking);
                            }
                          }
                        }}
                        className="hover:bg-[#FAF7F0] transition cursor-pointer"
                      >
                        <td className="py-2.5 pr-3 font-bold text-[#17120F]">
                          <div className="truncate max-w-[160px]">{row.guestName}</div>
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-slate-800 whitespace-nowrap">
                          {row.roomLabel}
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
                          {row.checkoutTime}
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Checked Out'
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : row.status === 'Late'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.billStatus === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {row.billStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('frontDesk', 'checkout')}
              className="text-xs font-bold text-[#17120F] hover:text-[#B08326] inline-flex items-center gap-1 transition cursor-pointer"
            >
              <span>View all departures</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ROW 4: BOTTOM QUICK ACTIONS                                          */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E8DEC8] p-4 shadow-2xs">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A6A53] mb-3">
          Quick Actions
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {/* 1. New Reservation */}
          <button
            type="button"
            onClick={triggerOpenNewReservation}
            className="p-3 rounded-xl border border-[#E8DEC8] bg-[#FDFBF7] hover:bg-[#FAF3E3] hover:border-[#C49A3A] transition flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <PlusCircle className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-[#17120F] leading-snug">New Reservation</span>
          </button>

          {/* 2. Walk-in Check In */}
          <button
            type="button"
            onClick={() => onNavigate('frontDesk', 'checkin')}
            className="p-3 rounded-xl border border-[#E8DEC8] bg-[#FDFBF7] hover:bg-[#FAF3E3] hover:border-[#C49A3A] transition flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <UserPlus className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-[#17120F] leading-snug">Walk-in Check In</span>
          </button>

          {/* 3. Check Out */}
          <button
            type="button"
            onClick={() => onNavigate('frontDesk', 'checkout')}
            className="p-3 rounded-xl border border-[#E8DEC8] bg-[#FDFBF7] hover:bg-[#FAF3E3] hover:border-[#C49A3A] transition flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <LogOut className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-[#17120F] leading-snug">Check Out</span>
          </button>

          {/* 4. Assign Room */}
          <button
            type="button"
            onClick={() => {
              if (unallocatedBookings.length > 0 && cleanAvailableRooms.length > 0) {
                setSelectedUnassignedBookingId(unallocatedBookings[0].id);
                setSelectedAssignRoomNo(cleanAvailableRooms[0].number);
                setAssignModalOpen(true);
              } else {
                onNavigate('calendar');
              }
            }}
            className="p-3 rounded-xl border border-[#E8DEC8] bg-[#FDFBF7] hover:bg-[#FAF3E3] hover:border-[#C49A3A] transition flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <BedDouble className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-[#17120F] leading-snug">Assign Room</span>
          </button>

          {/* 5. Room Move */}
          <button
            type="button"
            onClick={() => {
              if (movableBookings.length > 0 && cleanAvailableRooms.length > 0) {
                setSelectedMoveBookingId(movableBookings[0].id);
                setSelectedMoveTargetRoomNo(cleanAvailableRooms[0].number);
                setKeepOriginalRate(true);
                setRoomMoveModalOpen(true);
              } else {
                onNavigate('calendar');
              }
            }}
            className="p-3 rounded-xl border border-[#E8DEC8] bg-[#FDFBF7] hover:bg-[#FAF3E3] hover:border-[#C49A3A] transition flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <ArrowLeftRight className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-[#17120F] leading-snug">Room Move</span>
          </button>

          {/* 6. POS Billing */}
          <button
            type="button"
            onClick={() => onNavigate('pos', 'terminal')}
            className="p-3 rounded-xl border border-[#E8DEC8] bg-[#FDFBF7] hover:bg-[#FAF3E3] hover:border-[#C49A3A] transition flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Receipt className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-[#17120F] leading-snug">POS Billing</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ASSIGN ROOM MODAL                                                    */}
      {/* ==================================================================== */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8DEC8] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-[#17120F] text-[#FBF4E0] flex items-center justify-between">
              <h3 className="text-sm font-serif font-bold">Assign Room to Reservation</h3>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-[#A89376] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Unallocated Reservation
                </label>
                <select
                  value={selectedUnassignedBookingId}
                  onChange={(e) => setSelectedUnassignedBookingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {unallocatedBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.customerName} ({b.bookingNo}) • {b.checkInDate} → {b.checkOutDate}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Clean Available Room
                </label>
                <select
                  value={selectedAssignRoomNo}
                  onChange={(e) => setSelectedAssignRoomNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {cleanAvailableRooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      Room {r.number} — {r.category} ({formatCurrency(r.rate)}/night)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignRoomSubmit}
                  className="px-4 py-2 rounded-xl bg-[#17120F] text-[#F5D88A] font-bold"
                >
                  Confirm Room Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ROOM MOVE MODAL                                                      */}
      {/* ==================================================================== */}
      {roomMoveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8DEC8] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-[#17120F] text-[#FBF4E0] flex items-center justify-between">
              <h3 className="text-sm font-serif font-bold">Room Move (Transfer Guest Room)</h3>
              <button
                type="button"
                onClick={() => setRoomMoveModalOpen(false)}
                className="text-[#A89376] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Active / Confirmed Guest Stay
                </label>
                <select
                  value={selectedMoveBookingId}
                  onChange={(e) => setSelectedMoveBookingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {movableBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.customerName} — Currently Room {b.roomNumbers.join(', ')} ({b.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Move To Clean Room</label>
                <select
                  value={selectedMoveTargetRoomNo}
                  onChange={(e) => setSelectedMoveTargetRoomNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  {cleanAvailableRooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      Room {r.number} — {r.category} ({formatCurrency(r.rate)}/night)
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepOriginalRate}
                  onChange={(e) => setKeepOriginalRate(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Keep guest&apos;s locked booking tariff (complimentary move)</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoomMoveModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRoomMoveSubmit}
                  className="px-4 py-2 rounded-xl bg-[#17120F] text-[#F5D88A] font-bold"
                >
                  Move Guest Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
