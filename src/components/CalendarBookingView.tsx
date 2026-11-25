import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Room,
  Booking,
  GuestCheckIn,
  RoomCategory,
  BookingSource,
  PaymentMethod,
} from '../types';
import type { BookingRecord, RoomBlockRecord } from '../pms-integrated/types';
import { showToast } from '../utils/toast';
import { getTodayIst, parseDdmmyyyyToYmd } from '../utils/reportingDates';
import {
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Move,
  Sparkles,
  Plus,
  Clock,
  Users,
  Maximize2,
  Minimize2,
  Info,
  X,
  Search,
  LogIn,
  LogOut,
  Edit3,
  Eye,
  Ban,
  UserX,
  BedDouble,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export interface CalendarBookingViewProps {
  rooms: Room[];
  bookings: Booking[];
  checkins?: GuestCheckIn[];
  roomBlocks?: RoomBlockRecord[];
  hubBookings?: BookingRecord[];
  currentRole?: string;
  loggedInUser?: string;
  autoMarkDirtyOnCheckout?: boolean;
  allowBackDatedCheckIn?: boolean;
  setActiveTab?: (tab: string) => void;
  setFrontDeskSubTab?: (sub: string) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  onOpenAdvanceBooking?: (prefill: { roomNumber: string; roomType: string; date: string }) => void;
  onSelectHubBooking?: (booking: BookingRecord) => void;
  onOpenCheckInHub?: (booking: BookingRecord) => void;
  onOpenCheckOutHub?: (booking: BookingRecord) => void;
  onCancelOrNoShowHub?: (
    bookingId: string,
    mode: 'Cancelled' | 'No-Show',
    refundAmount: number,
    reason: string
  ) => void;
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

interface PendingDropMove {
  booking: Booking;
  sourceRoomNumber: string;
  targetRoom: Room;
  newCheckInDate: string;
  newCheckOutDate: string;
  nights: number;
}

interface TimelineBarItem {
  booking: Booking;
  startColIdx: number;
  spanCols: number;
  startsBeforeMonth: boolean;
  endsAfterMonth: boolean;
  barStatus: 'checked_in' | 'due_out' | 'confirmed' | 'checked_out';
}

const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return formatDateStr(dt);
}

function diffDaysStr(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 1;
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  const t1 = new Date(y1, (m1 || 1) - 1, d1 || 1).getTime();
  const t2 = new Date(y2, (m2 || 1) - 1, d2 || 1).getTime();
  const diff = Math.round((t2 - t1) / 86400000);
  return Math.max(1, diff);
}

function formatHumanDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTHS_FULL[m - 1]?.slice(0, 3) || ''} ${y}`;
}

function extractBookingRooms(b: Booking): string[] {
  const set = new Set<string>();
  String(b.roomNumber || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'TBD' && s !== 'Unallocated' && s !== '-')
    .forEach((s) => set.add(s));
  if (Array.isArray((b as any).roomNumbers)) {
    (b as any).roomNumbers
      .map((s: any) => String(s || '').trim())
      .filter((s: string) => s && s !== 'TBD' && s !== 'Unallocated' && s !== '-')
      .forEach((s: string) => set.add(s));
  }
  if (Array.isArray(b.bookedRooms)) {
    b.bookedRooms.forEach((br) => {
      const rn = String(br?.roomNumber || '').trim();
      if (rn && rn !== 'TBD' && rn !== 'Unallocated' && rn !== '-') set.add(rn);
    });
  }
  return Array.from(set);
}

function isRoomDirtyState(room: Room): boolean {
  const cs = String(room.cleaningStatus || '').toLowerCase();
  const st = String(room.status || '').toLowerCase();
  return (
    st === 'dirty' ||
    cs === 'dirty' ||
    cs === 'in progress' ||
    cs === 'needs inspection' ||
    cs === 'inspection'
  );
}

function isRoomOutOfOrderState(room: Room): boolean {
  const st = String(room.status || '').toLowerCase();
  return st === 'maintenance' || st === 'out of order' || st === 'out of service' || st === 'blocked';
}

export default function CalendarBookingView({
  rooms,
  bookings,
  checkins = [],
  roomBlocks = [],
  hubBookings = [],
  currentRole = 'Admin',
  loggedInUser = 'Front Desk',
  autoMarkDirtyOnCheckout = true,
  allowBackDatedCheckIn = false,
  setActiveTab,
  setFrontDeskSubTab,
  onOpenAdvanceBooking,
  onUpdateBookings,
  onUpdateRooms,
  onUpdateCheckins,
  onAddAuditLog,
  onSelectHubBooking,
  onOpenCheckInHub,
  onOpenCheckOutHub,
  onCancelOrNoShowHub,
}: CalendarBookingViewProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'daily' | 'priceHistory'>('monthly');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [roomSearch, setRoomSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modals for Unallocated & No-Show lists
  const [showUnallocatedModal, setShowUnallocatedModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowTab, setNoShowTab] = useState<'noshow' | 'overdue'>('noshow');
  const [allocatingBookingId, setAllocatingBookingId] = useState<Record<string, string>>({});

  // Selected Booking Modal (View / Edit / Check In / Check Out)
  const [activeBookingModal, setActiveBookingModal] = useState<Booking | null>(null);
  const [bookingModalMode, setBookingModalMode] = useState<'details' | 'edit'>('details');
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestMobile, setEditGuestMobile] = useState('');
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editCheckInDate, setEditCheckInDate] = useState('');
  const [editCheckOutDate, setEditCheckOutDate] = useState('');
  const [editRoomAmount, setEditRoomAmount] = useState<number>(0);
  const [editAdvanceAmount, setEditAdvanceAmount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');
  const [checkInOverrideConfirmed, setCheckInOverrideConfirmed] = useState(false);
  const [checkInOverrideReason, setCheckInOverrideReason] = useState('');

  // Drag-and-Drop Reassignment Confirmation State
  const [draggingBookingInfo, setDraggingBookingInfo] = useState<{
    bookingId: string;
    sourceRoomNumber: string;
  } | null>(null);
  const [dragHoverKey, setDragHoverKey] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDropMove | null>(null);
  const [recalcRateOnDrop, setRecalcRateOnDrop] = useState(false);
  const [dropOverrideConfirmed, setDropOverrideConfirmed] = useState(false);
  const [dropOverrideReason, setDropOverrideReason] = useState('');

  // Quick Create Reservation Modal (including Unallocated option)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isUnallocatedCreate, setIsUnallocatedCreate] = useState(false);
  const [targetRoomNumber, setTargetRoomNumber] = useState('');
  const [targetRoomType, setTargetRoomType] = useState<RoomCategory>('Standard');
  const [targetRate, setTargetRate] = useState(2000);
  const [targetDateStr, setTargetDateStr] = useState(() => formatDateStr(new Date()));
  const [bookingCustomerType, setBookingCustomerType] = useState<'Personal' | 'Corporate'>('Personal');
  const [companyName, setCompanyName] = useState('');
  const [companyGst, setCompanyGst] = useState('');
  const [mealPlanChoice, setMealPlanChoice] = useState<'EP' | 'CP' | 'MAP' | 'AP'>('EP');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [applyGstBooking, setApplyGstBooking] = useState<boolean>(true);
  const [sourceBookingId, setSourceBookingId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [nightsCount, setNightsCount] = useState(1);
  const [adultsCount, setAdultsCount] = useState(2);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [bkgSource, setBkgSource] = useState<BookingSource>('Walk-in');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [instantCheckInNow, setInstantCheckInNow] = useState(false);
  const [createDirtyOverride, setCreateDirtyOverride] = useState(false);
  const [createDirtyReason, setCreateDirtyReason] = useState('');

  // Seasonal Price Overrides (preserved existing feature)
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
  const [phFromDate, setPhFromDate] = useState<string>(() => formatDateStr(new Date()));
  const [phToDate, setPhToDate] = useState<string>(() => addDaysStr(formatDateStr(new Date()), 5));
  const [phRoomOnlyPrice, setPhRoomOnlyPrice] = useState<number>(2000);
  const [phCpPrice, setPhCpPrice] = useState<number>(2300);
  const [phMapPrice, setPhMapPrice] = useState<number>(2700);
  const [phLabel, setPhLabel] = useState<string>('Festival / Seasonal Rate');
  const [editingPhId, setEditingPhId] = useState<string | null>(null);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const todayColRef = useRef<HTMLTableCellElement | null>(null);

  const todayStr = useMemo(() => getTodayIst(), []);
  const canAuthoriseRoomOverride = useMemo(() => {
    const r = String(currentRole || '').trim().toLowerCase();
    return r === 'superadmin' || r === 'owner' || r === 'admin' || r === 'manager';
  }, [currentRole]);

  // Escape exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Synthesize standalone active checkins that aren't in `bookings` so zero stays are invisible on the timeline
  const unifiedBookings = useMemo<Booking[]>(() => {
    const list: Booking[] = [...bookings];
    checkins.forEach((c) => {
      const cGuest = String(c.guestName || '').trim().toLowerCase();
      const cRoom = String(c.roomNumber || '').trim();
      const cInDate = parseDdmmyyyyToYmd(c.checkInDate || todayStr);
      const alreadyLinked = list.some((b) => {
        if (
          b.id === c.id ||
          b.id === (c as any).bookingId ||
          (c as any).bookingNo === b.id ||
          (b as any).checkInId === c.id
        ) {
          return true;
        }
        const bGuest = String(b.guestName || '').trim().toLowerCase();
        const bInDate = parseDdmmyyyyToYmd(b.checkInDate || todayStr);
        const bRooms = extractBookingRooms(b);
        const matchRoom = bRooms.includes(cRoom) || String(b.roomNumber || '').trim() === cRoom;
        return (
          matchRoom &&
          bInDate === cInDate &&
          (bGuest === cGuest ||
            (bGuest.length > 2 && cGuest.startsWith(bGuest)) ||
            (cGuest.length > 2 && bGuest.startsWith(cGuest)))
        );
      });
      if (!alreadyLinked) {
        const isOut = Boolean(c.checkedOutDateTime || c.status === 'Checked Out');
        list.push({
          id: c.id,
          hotelId: c.hotelId,
          guestName: c.guestName || 'In-House Guest',
          mobile: c.mobile || '',
          email: c.emailAddress || (c as any).email || '',
          aadhaarNumber: c.aadhaarNumber || (c as any).idNumber || '',
          address: c.address || '',
          checkInDate: (c.checkInDate || todayStr).slice(0, 10),
          checkOutDate: (c.checkOutDate || addDaysStr((c.checkInDate || todayStr).slice(0, 10), 1)).slice(0, 10),
          nights: Math.max(
            1,
            diffDaysStr(
              (c.checkInDate || todayStr).slice(0, 10),
              (c.checkOutDate || addDaysStr((c.checkInDate || todayStr).slice(0, 10), 1)).slice(0, 10)
            )
          ),
          adults: (c as any).adults || c.numGuests || 2,
          children: (c as any).children || 0,
          roomNumber: c.roomNumber,
          roomType: (rooms.find((r) => r.number === c.roomNumber)?.category || 'Standard') as RoomCategory,
          advanceAmount: Number(c.advanceAmount) || 0,
          bookingAmount: Number(c.baseAmount || (c as any).roomAmount || c.totalAmount) || 0,
          paymentMethod: ((c as any).paymentMethod as PaymentMethod) || 'Cash',
          bookingSource: 'Walk-in',
          status: isOut ? ('CheckedOut' as any) : 'Confirmed',
          isCheckedIn: !isOut,
          isCompleted: isOut,
          bookedRooms: c.bookedRooms,
        });
      }
    });
    return list;
  }, [bookings, checkins, rooms, todayStr]);

  const isBookingCheckedOut = (b: Booking): boolean => {
    const st = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (b.isCompleted || (b as any).isCheckedOut || st === 'checkedout' || st === 'completed') return true;
    const linkedChk = checkins.find((c) => c.id === b.id || (c as any).bookingId === b.id);
    if (linkedChk && (linkedChk.checkedOutDateTime || linkedChk.status === 'Checked Out')) return true;
    return false;
  };

  const isBookingCheckedIn = (b: Booking): boolean => {
    if (isBookingCheckedOut(b)) return false;
    const st = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (b.isCheckedIn || st === 'checkedin') return true;
    const linkedChk = checkins.find((c) => c.id === b.id || (c as any).bookingId === b.id);
    if (linkedChk && !linkedChk.checkedOutDateTime && linkedChk.status === 'Active') return true;
    return false;
  };

  const isBookingCancelledOrNoShow = (b: Booking): boolean => {
    const st = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
    return st === 'cancelled' || st === 'noshow';
  };

  // Unallocated Bookings & No-Show Bookings Lists
  const unallocatedBookings = useMemo(() => {
    return unifiedBookings.filter((b) => {
      if (isBookingCancelledOrNoShow(b) || isBookingCheckedOut(b)) return false;
      const assigned = extractBookingRooms(b);
      return assigned.length === 0;
    });
  }, [unifiedBookings, checkins]);

  const noShowBookings = useMemo(() => {
    return unifiedBookings.filter(
      (b) => String(b.status || '').toLowerCase().replace(/[\s_-]/g, '') === 'noshow'
    );
  }, [unifiedBookings]);

  const overdueBookings = useMemo(() => {
    return unifiedBookings.filter((b) => {
      if (isBookingCancelledOrNoShow(b) || isBookingCheckedOut(b) || isBookingCheckedIn(b)) return false;
      const inD = String(b.checkInDate || '').slice(0, 10);
      return Boolean(inD && inD < todayStr);
    });
  }, [unifiedBookings, checkins, todayStr]);

  // Categories & Filtered Rooms
  const uniqueCategories = useMemo(() => {
    const list: string[] = [];
    rooms.forEach((r) => {
      const c = String(r.category || 'Standard').trim();
      if (c && !list.includes(c)) list.push(c);
    });
    return list;
  }, [rooms]);

  const filteredRoomsByCat = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    const map = new Map<string, Room[]>();
    uniqueCategories.forEach((cat) => {
      if (categoryFilter !== 'ALL' && cat !== categoryFilter) return;
      const catRooms = rooms.filter((r) => {
        if (String(r.category || 'Standard').trim() !== cat) return false;
        if (!q) return true;
        return (
          r.number.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          String(r.floor || '').toLowerCase().includes(q)
        );
      });
      if (catRooms.length > 0) map.set(cat, catRooms);
    });
    return map;
  }, [rooms, uniqueCategories, categoryFilter, roomSearch]);

  // Month Dates Array (`1` .. `totalDaysInMonth`)
  const monthDates = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, idx) => {
      const dt = new Date(year, month, idx + 1);
      const iso = formatDateStr(dt);
      const dow = dt.getDay();
      return {
        date: dt,
        iso,
        dayNum: idx + 1,
        monthShort: MONTHS_SHORT[month],
        dayShort: DAYS_SHORT[dow],
        isWeekend: dow === 0 || dow === 6,
        isToday: iso === todayStr,
        isPast: iso < todayStr,
      };
    });
  }, [selectedDate, todayStr]);

  const scrollToTodayColumn = () => {
    setTimeout(() => {
      if (todayColRef.current && timelineScrollRef.current) {
        const container = timelineScrollRef.current;
        const cell = todayColRef.current;
        const targetScroll = Math.max(0, cell.offsetLeft - container.clientWidth / 2 + 120);
        container.scrollTo({ left: targetScroll, behavior: 'smooth' });
      }
    }, 60);
  };

  useEffect(() => {
    if (viewMode === 'monthly') {
      scrollToTodayColumn();
    }
  }, [viewMode]);

  const getEffectiveRateForCategoryOnDate = (cat: string, dateStr: string, defaultRate: number): number => {
    const matched = priceOverrides.find(
      (po) => po.category === cat && dateStr >= po.fromDate && dateStr <= po.toDate
    );
    return matched ? matched.roomOnlyPrice : defaultRate;
  };

  // Room Block check for a given room and [rangeStart, rangeEnd)
  const getRoomBlockOverlap = (room: Room, rangeStart: string, rangeEnd: string): string | null => {
    if (isRoomOutOfOrderState(room) && rangeStart <= todayStr && rangeEnd > todayStr) {
      return room.outOfOrderReason || `Room ${room.number} is marked ${room.status}`;
    }
    const blk = roomBlocks.find(
      (rb) =>
        (rb.roomNumber === room.number || rb.roomId === room.id) &&
        rangeStart <= rb.endDate &&
        rangeEnd > rb.startDate
    );
    return blk ? `${blk.reason} (${blk.startDate} → ${blk.endDate})` : null;
  };

  // Overlap check across [rangeStart, rangeEnd) against all active bookings (excluding optional `excludeBookingId`)
  const findOverlappingBooking = (
    roomNumber: string,
    rangeStart: string,
    rangeEnd: string,
    excludeBookingId?: string
  ): Booking | undefined => {
    const effEnd = rangeEnd > rangeStart ? rangeEnd : addDaysStr(rangeStart, 1);
    return unifiedBookings.find((b) => {
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (isBookingCancelledOrNoShow(b)) return false;
      if (isBookingCheckedOut(b)) return false;
      const bRooms = extractBookingRooms(b);
      if (!bRooms.includes(roomNumber)) return false;
      const bStart = String(b.checkInDate || '').slice(0, 10);
      if (!bStart) return false;
      const rawEnd = String(b.checkOutDate || '').slice(0, 10);
      const bEnd = rawEnd && rawEnd > bStart ? rawEnd : addDaysStr(bStart, 1);
      return rangeStart < bEnd && effEnd > bStart;
    });
  };

  // Is room occupied on night `dateStr` (for KPI & inventory counters, including historical checked-out stays for past dates!)
  const isRoomOccupiedOnNight = (room: Room, dateStr: string): boolean => {
    return unifiedBookings.some((b) => {
      if (isBookingCancelledOrNoShow(b)) return false;
      // If checked out early BEFORE `dateStr`, do not count future nights after early checkout
      if (isBookingCheckedOut(b) && dateStr >= todayStr) return false;
      const bRooms = extractBookingRooms(b);
      if (!bRooms.includes(room.number)) return false;
      const bStart = String(b.checkInDate || '').slice(0, 10);
      if (!bStart) return false;
      const rawEnd = String(b.checkOutDate || '').slice(0, 10);
      const bEnd = rawEnd && rawEnd > bStart ? rawEnd : addDaysStr(bStart, 1);
      return dateStr >= bStart && dateStr < bEnd;
    });
  };

  const isRoomBlockedOnNight = (room: Room, dateStr: string): boolean => {
    if (isRoomOutOfOrderState(room) && dateStr === todayStr) return true;
    return roomBlocks.some(
      (rb) =>
        (rb.roomNumber === room.number || rb.roomId === room.id) &&
        dateStr >= rb.startDate &&
        dateStr <= rb.endDate
    );
  };

  // Precompute Daily Availability & Occupancy Metrics across `monthDates`
  const dailySummaryByDate = useMemo(() => {
    const totalRoomsCount = rooms.length;
    const summary: Record<
      string,
      {
        occupied: number;
        blocked: number;
        available: number;
        occupancyPct: number;
        byCategoryAvailable: Record<string, number>;
      }
    > = {};

    monthDates.forEach((md) => {
      let occupied = 0;
      let blocked = 0;
      const byCategoryAvailable: Record<string, number> = {};
      uniqueCategories.forEach((c) => {
        byCategoryAvailable[c] = 0;
      });

      rooms.forEach((rm) => {
        const cat = String(rm.category || 'Standard').trim();
        const occ = isRoomOccupiedOnNight(rm, md.iso);
        const blk = !occ && isRoomBlockedOnNight(rm, md.iso);
        if (occ) {
          occupied += 1;
        } else if (blk) {
          blocked += 1;
        } else {
          byCategoryAvailable[cat] = (byCategoryAvailable[cat] || 0) + 1;
        }
      });

      const available = Math.max(0, totalRoomsCount - occupied - blocked);
      const occupancyPct = totalRoomsCount > 0 ? Math.round((occupied / totalRoomsCount) * 100) : 0;
      summary[md.iso] = { occupied, blocked, available, occupancyPct, byCategoryAvailable };
    });
    return summary;
  }, [rooms, monthDates, unifiedBookings, roomBlocks, uniqueCategories, checkins, todayStr]);

  // Precompute Continuous Booking Bars per Room for the visible Month `[monthStartIso, monthEndExclusiveIso)`
  const roomTimelineBars = useMemo<Map<string, TimelineBarItem[]>>(() => {
    const map = new Map<string, TimelineBarItem[]>();

    if (monthDates.length === 0) return map;
    const monthStartIso = monthDates[0].iso;
    const monthEndExclusiveIso = addDaysStr(monthDates[monthDates.length - 1].iso, 1);

    rooms.forEach((rm) => map.set(rm.number, []));

    unifiedBookings.forEach((b) => {
      if (isBookingCancelledOrNoShow(b)) return;
      const bRooms = extractBookingRooms(b);
      if (bRooms.length === 0) return;

      const bStart = String(b.checkInDate || '').slice(0, 10);
      if (!bStart) return;
      const rawEnd = String(b.checkOutDate || '').slice(0, 10);
      const bEnd = rawEnd && rawEnd > bStart ? rawEnd : addDaysStr(bStart, 1);

      if (bEnd <= monthStartIso || bStart >= monthEndExclusiveIso) return;

      const clampedStart = bStart < monthStartIso ? monthStartIso : bStart;
      const clampedEnd = bEnd > monthEndExclusiveIso ? monthEndExclusiveIso : bEnd;
      const startColIdx = monthDates.findIndex((d) => d.iso === clampedStart);
      if (startColIdx < 0) return;
      const spanCols = Math.max(1, diffDaysStr(clampedStart, clampedEnd));

      const checkedOut = isBookingCheckedOut(b);
      const checkedIn = isBookingCheckedIn(b);
      const barStatus: 'checked_in' | 'due_out' | 'confirmed' | 'checked_out' = checkedOut
        ? 'checked_out'
        : checkedIn && rawEnd === todayStr
        ? 'due_out'
        : checkedIn
        ? 'checked_in'
        : 'confirmed';

      bRooms.forEach((rn) => {
        const arr = map.get(rn);
        if (arr) {
          arr.push({
            booking: b,
            startColIdx,
            spanCols,
            startsBeforeMonth: bStart < monthStartIso,
            endsAfterMonth: bEnd > monthEndExclusiveIso,
            barStatus,
          });
        }
      });
    });

    return map;
  }, [rooms, unifiedBookings, monthDates, checkins, todayStr]);

  // Navigation Handlers
  const handlePrevPeriod = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'monthly') {
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setSelectedDate(d);
  };

  const handleNextPeriod = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'monthly') {
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setSelectedDate(d);
  };

  const handleJumpToday = () => {
    setSelectedDate(new Date());
    if (viewMode === 'monthly') scrollToTodayColumn();
  };

  const toggleAllCategories = () => {
    const allCollapsed = uniqueCategories.every((c) => collapsedCategories[c]);
    const next: Record<string, boolean> = {};
    uniqueCategories.forEach((c) => {
      next[c] = !allCollapsed;
    });
    setCollapsedCategories(next);
  };

  // Open Booking Modal for View / Edit / Check-In / Check-Out
  const openBookingActionModal = (b: Booking, initialMode: 'details' | 'edit' = 'details') => {
    setActiveBookingModal(b);
    setBookingModalMode(initialMode);
    const assigned = extractBookingRooms(b);
    setEditGuestName(b.guestName || '');
    setEditGuestMobile(b.mobile || '');
    setEditRoomNumber(assigned[0] || '');
    setEditCheckInDate(String(b.checkInDate || todayStr).slice(0, 10));
    const endD = String(b.checkOutDate || '').slice(0, 10);
    setEditCheckOutDate(
      endD && endD > String(b.checkInDate || todayStr).slice(0, 10)
        ? endD
        : addDaysStr(String(b.checkInDate || todayStr).slice(0, 10), Math.max(1, Number(b.nights) || 1))
    );
    setEditRoomAmount(Number(b.bookingAmount) || 0);
    setEditAdvanceAmount(Number(b.advanceAmount) || 0);
    setEditNotes(b.notes || '');
    setCheckInOverrideConfirmed(false);
    setCheckInOverrideReason('');
  };

  // Redirect directly to Unified Check-In / Walk-In Form with preselected room & dates
  const redirectToCheckIn = (roomNum?: string, roomCat?: string, rateVal?: number, inDate?: string) => {
    try {
      if (roomNum || inDate) {
        sessionStorage.setItem(
          'pms_preselect_room',
          JSON.stringify({
            roomNumber: roomNum || '',
            roomType: roomCat || '',
            rate: rateVal || 0,
            checkInDate: inDate || todayStr,
          })
        );
        sessionStorage.setItem(
          'directstay_quick_booking_draft',
          JSON.stringify({
            roomNumber: roomNum || '',
            roomType: roomCat || '',
            checkInDate: inDate || todayStr,
            checkOutDate: inDate ? addDaysStr(inDate, 1) : addDaysStr(todayStr, 1),
            roomRate: rateVal || 0,
          })
        );
      }
    } catch {}

    if (onOpenAdvanceBooking && roomNum) {
      try {
        onOpenAdvanceBooking({
          roomNumber: roomNum,
          roomType: roomCat || '',
          date: inDate || todayStr,
        });
      } catch {}
    }

    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/admin/frontDesk/checkin');
        window.dispatchEvent(
          new CustomEvent('directstay:checkin-nav', {
            detail: {
              bookingCategory: 'standard',
              roomNumber: roomNum,
              checkInDate: inDate || todayStr,
            },
          })
        );
      }
    } catch {}

    if (setFrontDeskSubTab) {
      setFrontDeskSubTab('checkin');
    }
    if (setActiveTab) {
      setActiveTab('frontDesk');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/admin/frontDesk/checkin';
    }
  };

  // Open Quick Create Modal on Empty Cell Click -> routes to Unified Check-In Form
  const handleEmptyCellClick = (room: Room, dateStr: string) => {
    if (!allowBackDatedCheckIn && dateStr < todayStr) {
      showToast('Backdated bookings are disabled in Hotel Settings. Enable "Allow Back-Dated Check-In" in Administration to book past dates.', 'warning');
      return;
    }
    const blkReason = getRoomBlockOverlap(room, dateStr, addDaysStr(dateStr, 1));
    if (blkReason) {
      showToast(`Blocked: ${blkReason}`, 'warning');
      return;
    }
    const existing = findOverlappingBooking(room.number, dateStr, addDaysStr(dateStr, 1));
    if (existing) {
      openBookingActionModal(existing, 'details');
      return;
    }
    const effectiveRate = getEffectiveRateForCategoryOnDate(room.category, dateStr, room.rate);
    redirectToCheckIn(room.number, room.category, effectiveRate, dateStr);
  };

  const handleOpenCreateModal = (room: Room, dateStr: string) => {
    const effectiveRate = getEffectiveRateForCategoryOnDate(room.category, dateStr, room.rate);
    redirectToCheckIn(room.number, room.category, effectiveRate, dateStr);
  };

  // Create Booking from Stay Overview Modal
  const handleSaveCalendarBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestMobile.trim()) {
      showToast('Guest full name and mobile number are required.', 'warning');
      return;
    }

    const nights = Math.max(1, Number(nightsCount) || 1);
    const checkInStr = targetDateStr;
    if (!allowBackDatedCheckIn && checkInStr < todayStr) {
      showToast('Backdated bookings are disabled in Hotel Settings. Enable "Allow Back-Dated Check-In" to select past dates.', 'warning');
      return;
    }
    const checkOutStr = addDaysStr(checkInStr, nights);
    if (checkOutStr <= checkInStr) {
      showToast('Check-out date must be after check-in date.', 'warning');
      return;
    }

    if (!isUnallocatedCreate) {
      if (!targetRoomNumber) {
        showToast('Please select a room or switch to Unallocated Category Reservation.', 'warning');
        return;
      }
      const rmObj = rooms.find((r) => r.number === targetRoomNumber);
      if (rmObj) {
        const blk = getRoomBlockOverlap(rmObj, checkInStr, checkOutStr);
        if (blk && !instantCheckInNow) {
          showToast(`Cannot book Room ${rmObj.number}: ${blk}`, 'error');
          return;
        }
        const overlap = findOverlappingBooking(rmObj.number, checkInStr, checkOutStr);
        if (overlap) {
          showToast(
            `Double-Booking Prevented: Room ${rmObj.number} is already reserved/occupied by ${overlap.guestName} (${overlap.checkInDate} → ${overlap.checkOutDate}).`,
            'error'
          );
          return;
        }

        // Dirty / Out-of-Order protection when checking in immediately
        if (instantCheckInNow && (isRoomDirtyState(rmObj) || isRoomOutOfOrderState(rmObj))) {
          if (!canAuthoriseRoomOverride) {
            showToast(
              `Room ${rmObj.number} is marked "${rmObj.cleaningStatus || rmObj.status}" in Housekeeping. Only Clean rooms can be checked in (or request Manager/Admin override).`,
              'error'
            );
            return;
          }
          if (!createDirtyOverride || !createDirtyReason.trim()) {
            showToast(
              `Please confirm Authorised Room Override and enter a reason to check in to ${rmObj.cleaningStatus || rmObj.status} Room ${rmObj.number}.`,
              'warning'
            );
            return;
          }
        }
      }
    }

    const mealExtra =
      mealPlanChoice === 'CP' ? 300 : mealPlanChoice === 'MAP' ? 700 : mealPlanChoice === 'AP' ? 1100 : 0;
    const grossRoomAmt = (Number(targetRate) + mealExtra) * nights;
    const netRoomAmt = Math.max(0, grossRoomAmt - Math.max(0, Number(discountAmount) || 0));
    const gstRateVal = applyGstBooking ? 12 : 0;
    const gstAmtVal = applyGstBooking ? Number(((netRoomAmt * gstRateVal) / 100).toFixed(2)) : 0;

    const existingIds = new Set(unifiedBookings.map((item) => String(item.id || '')));
    let seq = Math.max(1001, bookings.length + 1001);
    while (existingIds.has(`GP-BKG-${seq}`)) seq += 1;
    const newId = `GP-BKG-${seq}`;

    const noteParts = [
      `Booked via Stay Overview (${bookingCustomerType} • Plan: ${mealPlanChoice})`,
      bookingCustomerType === 'Corporate' && companyName.trim() ? `Company: ${companyName.trim()}` : '',
      bookingCustomerType === 'Corporate' && companyGst.trim() ? `GSTIN: ${companyGst.trim()}` : '',
      sourceBookingId.trim() ? `OTA/Ref ID: ${sourceBookingId.trim()}` : '',
      discountAmount > 0 ? `Discount: ₹${discountAmount}` : '',
      instantCheckInNow && createDirtyOverride && createDirtyReason.trim()
        ? `[ROOM OVERRIDE by ${loggedInUser}: ${createDirtyReason.trim()}]`
        : '',
    ]
      .filter(Boolean)
      .join(' • ');

    const checkNow = Boolean(instantCheckInNow && !isUnallocatedCreate && checkInStr <= todayStr);
    const newBooking: Booking = {
      id: newId,
      hotelId: rooms[0]?.hotelId,
      guestName: guestName.trim(),
      mobile: guestMobile.trim(),
      email: '',
      aadhaarNumber: 'PENDING_VERIFICATION',
      address: bookingCustomerType === 'Corporate' && companyName ? companyName : 'Stay Overview Reservation',
      checkInDate: checkInStr,
      checkOutDate: checkOutStr,
      nights,
      adults: Math.max(1, Number(adultsCount) || 2),
      children: 0,
      roomNumber: isUnallocatedCreate ? '' : targetRoomNumber,
      roomType: targetRoomType,
      advanceAmount: Math.max(0, Number(advancePaid) || 0),
      bookingAmount: netRoomAmt,
      gstRate: gstRateVal,
      gstAmount: gstAmtVal,
      paymentMethod: payMethod,
      bookingSource: bkgSource,
      transactionId: sourceBookingId.trim() || undefined,
      status: checkNow ? ('Checked In' as any) : 'Confirmed',
      isCheckedIn: checkNow,
      notes: noteParts,
    };

    onUpdateBookings([newBooking, ...bookings]);

    if (checkNow && targetRoomNumber) {
      if (onUpdateCheckins) {
        const newChk: GuestCheckIn = {
          id: newId,
          hotelId: rooms[0]?.hotelId,
          bookingId: newId,
          guestName: newBooking.guestName,
          mobile: newBooking.mobile,
          emailAddress: '',
          aadhaarNumber: '',
          nationality: 'Indian',
          address: newBooking.address,
          city: '',
          state: '',
          roomNumber: targetRoomNumber,
          roomRate: Number(targetRate) || 0,
          checkInDate: checkInStr,
          checkOutDate: checkOutStr,
          nights,
          numGuests: newBooking.adults,
          baseAmount: netRoomAmt,
          advanceAmount: newBooking.advanceAmount,
          cashAmountPaid: payMethod === 'Cash' ? newBooking.advanceAmount : 0,
          onlineAmountPaid: payMethod !== 'Cash' ? newBooking.advanceAmount : 0,
          totalAmount: netRoomAmt + gstAmtVal,
          pendingAmount: Math.max(0, netRoomAmt + gstAmtVal - newBooking.advanceAmount),
          gstRate: gstRateVal,
          gstAmount: gstAmtVal,
          dateTime: new Date().toISOString(),
          status: 'Active',
        };
        onUpdateCheckins([newChk, ...checkins]);
      }
      onUpdateRooms(
        rooms.map((r) =>
          r.number === targetRoomNumber
            ? { ...r, status: 'Occupied', cleaningStatus: 'Clean' }
            : r
        )
      );
      if (createDirtyOverride && createDirtyReason.trim()) {
        onAddAuditLog?.(
          'Authorised Room Check-In Override',
          `${loggedInUser} (${currentRole}) authorised check-in to Dirty/Blocked Room ${targetRoomNumber} for ${newBooking.guestName}. Reason: ${createDirtyReason.trim()}`
        );
      }
    } else if (!isUnallocatedCreate && targetRoomNumber && checkInStr <= todayStr && checkOutStr > todayStr) {
      onUpdateRooms(
        rooms.map((r) =>
          r.number === targetRoomNumber && r.status === 'Available'
            ? { ...r, status: 'Reserved' }
            : r
        )
      );
    }

    onAddAuditLog?.(
      isUnallocatedCreate ? 'Unallocated Booking Created' : checkNow ? 'Direct Calendar Check-In' : 'Calendar Reservation Created',
      `${newBooking.guestName} • ${isUnallocatedCreate ? `Unallocated (${targetRoomType})` : `Room ${targetRoomNumber}`} • ${checkInStr} → ${checkOutStr} (${nights}N)`
    );

    showToast(
      isUnallocatedCreate
        ? `Created unallocated ${targetRoomType} reservation (${newId}).`
        : checkNow
        ? `Checked in ${newBooking.guestName} to Room ${targetRoomNumber}!`
        : `Reserved Room ${targetRoomNumber} for ${newBooking.guestName} (${checkInStr} → ${checkOutStr}).`,
      'success'
    );
    setIsBookModalOpen(false);
  };

  // Drag & Drop Handlers (with Double-Booking Prevention & Confirmation Modal)
  const handleDragStart = (e: React.DragEvent, booking: Booking, sourceRoomNumber: string) => {
    if (isBookingCheckedOut(booking) || isBookingCancelledOrNoShow(booking)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ bookingId: booking.id, sourceRoomNumber })
    );
    e.dataTransfer.effectAllowed = 'move';
    setDraggingBookingInfo({ bookingId: booking.id, sourceRoomNumber });
  };

  const handleDragEnd = () => {
    setDraggingBookingInfo(null);
    setDragHoverKey(null);
  };

  const handleDragOverCell = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragHoverKey !== cellKey) setDragHoverKey(cellKey);
  };

  const handleDropOnCell = (e: React.DragEvent, targetRoom: Room, targetDateStr: string) => {
    e.preventDefault();
    setDragHoverKey(null);
    let payload: { bookingId: string; sourceRoomNumber: string } | null = draggingBookingInfo;
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) {
        payload = raw.startsWith('{')
          ? JSON.parse(raw)
          : { bookingId: raw, sourceRoomNumber: '' };
      }
    } catch {}
    setDraggingBookingInfo(null);

    if (!payload?.bookingId) return;
    const draggedBkg = unifiedBookings.find((b) => b.id === payload!.bookingId);
    if (!draggedBkg) return;

    const oldRooms = extractBookingRooms(draggedBkg);
    const sourceRm = payload.sourceRoomNumber || oldRooms[0] || '';
    const nights = Math.max(
      1,
      diffDaysStr(
        String(draggedBkg.checkInDate || todayStr).slice(0, 10),
        String(draggedBkg.checkOutDate || addDaysStr(todayStr, 1)).slice(0, 10)
      )
    );
    const newCheckInDate = targetDateStr;
    if (!allowBackDatedCheckIn && newCheckInDate < todayStr) {
      showToast('Cannot move bookings to past dates while Back-Dated Check-In is disabled.', 'warning');
      return;
    }
    const newCheckOutDate = addDaysStr(newCheckInDate, nights);

    if (
      sourceRm === targetRoom.number &&
      String(draggedBkg.checkInDate || '').slice(0, 10) === newCheckInDate
    ) {
      return;
    }

    // 1. Check Maintenance / Room Blocks
    const blkConflict = getRoomBlockOverlap(targetRoom, newCheckInDate, newCheckOutDate);
    if (blkConflict && !canAuthoriseRoomOverride) {
      showToast(`Cannot reassign to Room ${targetRoom.number}: ${blkConflict}`, 'error');
      return;
    }

    // 2. Strict Overlap / Double-Booking Check across all nights [newCheckInDate, newCheckOutDate)
    const conflict = findOverlappingBooking(
      targetRoom.number,
      newCheckInDate,
      newCheckOutDate,
      draggedBkg.id
    );
    if (conflict) {
      showToast(
        `Double-Booking Prevented: Room ${targetRoom.number} is already booked/occupied by ${conflict.guestName} (${conflict.checkInDate} → ${conflict.checkOutDate}).`,
        'error'
      );
      return;
    }

    // 3. If Checked-In guest is being moved to a Dirty / Out-of-Order room and user is NOT authorised
    if (
      isBookingCheckedIn(draggedBkg) &&
      (isRoomDirtyState(targetRoom) || isRoomOutOfOrderState(targetRoom)) &&
      !canAuthoriseRoomOverride
    ) {
      showToast(
        `Room ${targetRoom.number} is marked "${targetRoom.cleaningStatus || targetRoom.status}" in Housekeeping. Clean the room first or request Manager/Admin override.`,
        'error'
      );
      return;
    }

    setRecalcRateOnDrop(false);
    setDropOverrideConfirmed(false);
    setDropOverrideReason('');
    setPendingDrop({
      booking: draggedBkg,
      sourceRoomNumber: sourceRm,
      targetRoom,
      newCheckInDate,
      newCheckOutDate,
      nights,
    });
  };

  // Confirm Drag-and-Drop Move
  const handleConfirmPendingDrop = () => {
    if (!pendingDrop) return;
    const { booking, sourceRoomNumber, targetRoom, newCheckInDate, newCheckOutDate, nights } = pendingDrop;
    const isInHouse = isBookingCheckedIn(booking);
    const targetNeedsOverride =
      (isInHouse && (isRoomDirtyState(targetRoom) || isRoomOutOfOrderState(targetRoom))) ||
      Boolean(getRoomBlockOverlap(targetRoom, newCheckInDate, newCheckOutDate));

    if (targetNeedsOverride) {
      if (!canAuthoriseRoomOverride) {
        showToast('Manager / Admin authorisation is required to assign an uncleaned or blocked room.', 'error');
        return;
      }
      if (!dropOverrideConfirmed || !dropOverrideReason.trim()) {
        showToast('Please tick the Authorised Override confirmation and enter a reason.', 'warning');
        return;
      }
    }

    const oldRooms = extractBookingRooms(booking);
    const updatedRoomList =
      oldRooms.length > 1
        ? oldRooms.map((rn) => (rn === sourceRoomNumber ? targetRoom.number : rn))
        : [targetRoom.number];
    const nextRoomStr = updatedRoomList.join(', ');

    const newBookingAmt = recalcRateOnDrop
      ? getEffectiveRateForCategoryOnDate(targetRoom.category, newCheckInDate, targetRoom.rate) * nights
      : booking.bookingAmount;

    const existsInBookings = bookings.some((b) => b.id === booking.id);
    const updatedBkgObj: Booking = {
      ...booking,
      roomNumber: nextRoomStr,
      roomType: targetRoom.category,
      checkInDate: newCheckInDate,
      checkOutDate: newCheckOutDate,
      nights,
      bookingAmount: newBookingAmt,
      bookedRooms: Array.isArray(booking.bookedRooms)
        ? booking.bookedRooms.map((br) =>
            br.roomNumber === sourceRoomNumber
              ? { ...br, roomNumber: targetRoom.number, roomType: targetRoom.category }
              : br
          )
        : booking.bookedRooms,
      notes: [
        booking.notes || '',
        `Reassigned via Stay Overview to Room ${targetRoom.number} (${newCheckInDate} → ${newCheckOutDate}) by ${loggedInUser}`,
        targetNeedsOverride && dropOverrideReason.trim()
          ? `[OVERRIDE: ${dropOverrideReason.trim()}]`
          : '',
      ]
        .filter(Boolean)
        .join(' • '),
    };

    onUpdateBookings(
      existsInBookings
        ? bookings.map((b) => (b.id === booking.id ? updatedBkgObj : b))
        : [updatedBkgObj, ...bookings]
    );

    if (onUpdateCheckins && checkins.length > 0) {
      const hasChk = checkins.some((c) => c.id === booking.id || (c as any).bookingId === booking.id);
      if (hasChk) {
        onUpdateCheckins(
          checkins.map((c) =>
            c.id === booking.id || (c as any).bookingId === booking.id
              ? {
                  ...c,
                  roomNumber: nextRoomStr,
                  checkInDate: newCheckInDate,
                  checkOutDate: newCheckOutDate,
                  baseAmount: recalcRateOnDrop ? newBookingAmt : c.baseAmount,
                }
              : c
          )
        );
      }
    }

    // Sync Room Rack & Housekeeping statuses immediately
    if (sourceRoomNumber !== targetRoom.number || isInHouse) {
      onUpdateRooms(
        rooms.map((rm) => {
          if (sourceRoomNumber && rm.number === sourceRoomNumber && sourceRoomNumber !== targetRoom.number) {
            if (isInHouse && autoMarkDirtyOnCheckout) {
              return {
                ...rm,
                status: 'Dirty',
                cleaningStatus: 'Dirty',
                housekeepingPriority: 'High',
                housekeepingNotes: `Guest shifted to Room ${targetRoom.number} — turnaround cleaning required`,
              };
            }
            return { ...rm, status: rm.cleaningStatus === 'Dirty' ? 'Dirty' : 'Available' };
          }
          if (rm.number === targetRoom.number) {
            if (isInHouse) {
              return { ...rm, status: 'Occupied', cleaningStatus: 'Clean' };
            }
            if (newCheckInDate <= todayStr && newCheckOutDate > todayStr && rm.status === 'Available') {
              return { ...rm, status: 'Reserved' };
            }
          }
          return rm;
        })
      );
    }

    onAddAuditLog?.(
      'Stay Overview Reassignment',
      `Reassigned Booking ${booking.id} (${booking.guestName}) from Room ${sourceRoomNumber || 'Unallocated'} (${booking.checkInDate} → ${booking.checkOutDate}) to Room ${targetRoom.number} (${newCheckInDate} → ${newCheckOutDate}).${
        targetNeedsOverride ? ` Authorised Override: ${dropOverrideReason.trim()}` : ''
      }`
    );

    showToast(
      `Reassigned ${booking.guestName} to Room ${targetRoom.number} (${formatHumanDate(newCheckInDate)} → ${formatHumanDate(newCheckOutDate)}).`,
      'success'
    );
    setPendingDrop(null);
  };

  // Save Booking Edits from Stay Overview Booking Modal
  const handleSaveBookingEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBookingModal) return;
    if (!editCheckInDate || !editCheckOutDate || editCheckOutDate <= editCheckInDate) {
      showToast('Check-out date must be after check-in date.', 'warning');
      return;
    }
    if (editRoomNumber) {
      const targetRm = rooms.find((r) => r.number === editRoomNumber);
      if (targetRm) {
        const conflict = findOverlappingBooking(
          targetRm.number,
          editCheckInDate,
          editCheckOutDate,
          activeBookingModal.id
        );
        if (conflict) {
          showToast(
            `Double-Booking Prevented: Room ${targetRm.number} is already reserved/occupied by ${conflict.guestName} (${conflict.checkInDate} → ${conflict.checkOutDate}).`,
            'error'
          );
          return;
        }
      }
    }

    const nights = diffDaysStr(editCheckInDate, editCheckOutDate);
    const oldRooms = extractBookingRooms(activeBookingModal);
    const prevPrimaryRoom = oldRooms[0] || '';
    const isInHouse = isBookingCheckedIn(activeBookingModal);

    const updatedBkg: Booking = {
      ...activeBookingModal,
      guestName: editGuestName.trim() || activeBookingModal.guestName,
      mobile: editGuestMobile.trim() || activeBookingModal.mobile,
      roomNumber: editRoomNumber,
      roomType: rooms.find((r) => r.number === editRoomNumber)?.category || activeBookingModal.roomType,
      checkInDate: editCheckInDate,
      checkOutDate: editCheckOutDate,
      nights,
      bookingAmount: Math.max(0, Number(editRoomAmount) || 0),
      advanceAmount: Math.max(0, Number(editAdvanceAmount) || 0),
      notes: editNotes,
    };

    const existsInBookings = bookings.some((b) => b.id === activeBookingModal.id);
    onUpdateBookings(
      existsInBookings
        ? bookings.map((b) => (b.id === activeBookingModal.id ? updatedBkg : b))
        : [updatedBkg, ...bookings]
    );

    if (onUpdateCheckins && checkins.length > 0) {
      onUpdateCheckins(
        checkins.map((c) =>
          c.id === activeBookingModal.id || (c as any).bookingId === activeBookingModal.id
            ? {
                ...c,
                guestName: updatedBkg.guestName,
                mobile: updatedBkg.mobile,
                roomNumber: editRoomNumber || c.roomNumber,
                checkInDate: editCheckInDate,
                checkOutDate: editCheckOutDate,
                baseAmount: updatedBkg.bookingAmount,
                advanceAmount: updatedBkg.advanceAmount,
              }
            : c
        )
      );
    }

    if (prevPrimaryRoom !== editRoomNumber) {
      onUpdateRooms(
        rooms.map((rm) => {
          if (prevPrimaryRoom && rm.number === prevPrimaryRoom) {
            return isInHouse && autoMarkDirtyOnCheckout
              ? { ...rm, status: 'Dirty', cleaningStatus: 'Dirty' }
              : { ...rm, status: rm.cleaningStatus === 'Dirty' ? 'Dirty' : 'Available' };
          }
          if (editRoomNumber && rm.number === editRoomNumber && isInHouse) {
            return { ...rm, status: 'Occupied', cleaningStatus: 'Clean' };
          }
          return rm;
        })
      );
    }

    onAddAuditLog?.(
      'Booking Edited from Stay Overview',
      `Updated Booking ${updatedBkg.id} (${updatedBkg.guestName}) -> Room ${editRoomNumber || 'Unallocated'}, ${editCheckInDate} → ${editCheckOutDate} (${nights}N).`
    );
    showToast(`Updated reservation for ${updatedBkg.guestName}.`, 'success');
    setActiveBookingModal(updatedBkg);
    setBookingModalMode('details');
  };

  // Check-In Action from Stay Overview Modal (with Dirty / Out-of-Order Guard + Authorised Override)
  const handleCheckInFromModal = (useFullGrcDesk: boolean) => {
    if (!activeBookingModal) return;
    const assignedRooms = extractBookingRooms(activeBookingModal);
    if (assignedRooms.length === 0) {
      showToast('Please assign an available room first before checking in.', 'warning');
      setBookingModalMode('edit');
      return;
    }

    const unreadyRooms = assignedRooms
      .map((rn) => rooms.find((r) => r.number === rn))
      .filter((r): r is Room => Boolean(r && (isRoomDirtyState(r) || isRoomOutOfOrderState(r))));

    if (unreadyRooms.length > 0) {
      const roomLabels = unreadyRooms
        .map((r) => `Room ${r.number} (${r.cleaningStatus || r.status})`)
        .join(', ');
      if (!canAuthoriseRoomOverride) {
        showToast(
          `Check-In Blocked: ${roomLabels} is not Clean/Ready. Please mark it Clean in Housekeeping or request Manager/Admin override.`,
          'error'
        );
        return;
      }
      if (!checkInOverrideConfirmed || !checkInOverrideReason.trim()) {
        showToast(
          `${roomLabels} requires Authorised Override confirmation and reason before check-in.`,
          'warning'
        );
        return;
      }
      onAddAuditLog?.(
        'Authorised Room Check-In Override',
        `${loggedInUser} (${currentRole}) overrode housekeeping/maintenance block on ${roomLabels} for ${activeBookingModal.guestName}. Reason: ${checkInOverrideReason.trim()}`
      );
    }

    const matchedHub = hubBookings.find((hb) => hb.id === activeBookingModal.id);
    if (useFullGrcDesk && matchedHub && onOpenCheckInHub) {
      setActiveBookingModal(null);
      onOpenCheckInHub(matchedHub);
      return;
    }

    // Direct instant check-in
    const updatedBkg: Booking = {
      ...activeBookingModal,
      status: 'Checked In' as any,
      isCheckedIn: true,
    };
    onUpdateBookings(bookings.map((b) => (b.id === activeBookingModal.id ? updatedBkg : b)));

    if (onUpdateCheckins) {
      const existsChk = checkins.some(
        (c) => c.id === activeBookingModal.id || (c as any).bookingId === activeBookingModal.id
      );
      if (!existsChk) {
        const newChk: GuestCheckIn = {
          id: activeBookingModal.id,
          hotelId: activeBookingModal.hotelId || rooms[0]?.hotelId,
          bookingId: activeBookingModal.id,
          guestName: activeBookingModal.guestName,
          mobile: activeBookingModal.mobile,
          emailAddress: activeBookingModal.email || '',
          aadhaarNumber: activeBookingModal.aadhaarNumber || '',
          nationality: 'Indian',
          address: activeBookingModal.address || '',
          city: '',
          state: '',
          roomNumber: assignedRooms.join(', '),
          roomRate: rooms.find((r) => r.number === assignedRooms[0])?.rate || 0,
          checkInDate: activeBookingModal.checkInDate,
          checkOutDate: activeBookingModal.checkOutDate,
          nights: activeBookingModal.nights || 1,
          numGuests: activeBookingModal.adults || 2,
          baseAmount: Number(activeBookingModal.bookingAmount) || 0,
          advanceAmount: Number(activeBookingModal.advanceAmount) || 0,
          cashAmountPaid:
            (activeBookingModal.paymentMethod || 'Cash') === 'Cash'
              ? Number(activeBookingModal.advanceAmount) || 0
              : 0,
          onlineAmountPaid:
            (activeBookingModal.paymentMethod || 'Cash') !== 'Cash'
              ? Number(activeBookingModal.advanceAmount) || 0
              : 0,
          totalAmount:
            (Number(activeBookingModal.bookingAmount) || 0) +
            (Number(activeBookingModal.gstAmount) || 0),
          pendingAmount: Math.max(
            0,
            (Number(activeBookingModal.bookingAmount) || 0) +
              (Number(activeBookingModal.gstAmount) || 0) -
              (Number(activeBookingModal.advanceAmount) || 0)
          ),
          gstRate: activeBookingModal.gstRate || 0,
          gstAmount: activeBookingModal.gstAmount || 0,
          dateTime: new Date().toISOString(),
          status: 'Active',
        };
        onUpdateCheckins([newChk, ...checkins]);
      }
    }

    onUpdateRooms(
      rooms.map((rm) =>
        assignedRooms.includes(rm.number)
          ? { ...rm, status: 'Occupied', cleaningStatus: 'Clean' }
          : rm
      )
    );
    onAddAuditLog?.(
      'Guest Checked In via Stay Overview',
      `Checked in ${activeBookingModal.guestName} into Room ${assignedRooms.join(', ')}.`
    );
    showToast(`Checked in ${activeBookingModal.guestName} to Room ${assignedRooms.join(', ')}!`, 'success');
    setActiveBookingModal(null);
  };

  // Check-Out Action from Stay Overview Modal
  const handleCheckOutFromModal = () => {
    if (!activeBookingModal) return;
    const matchedHub = hubBookings.find((hb) => hb.id === activeBookingModal.id);
    if (matchedHub && onOpenCheckOutHub) {
      setActiveBookingModal(null);
      onOpenCheckOutHub(matchedHub);
      return;
    }

    // Fallback standalone checkout (marks room Dirty if autoMarkDirtyOnCheckout is enabled)
    const assignedRooms = extractBookingRooms(activeBookingModal);
    const nowIso = new Date().toISOString();
    onUpdateBookings(
      bookings.map((b) =>
        b.id === activeBookingModal.id
          ? { ...b, status: 'CheckedOut' as any, isCompleted: true, isCheckedIn: false }
          : b
      )
    );
    if (onUpdateCheckins) {
      onUpdateCheckins(
        checkins.map((c) =>
          c.id === activeBookingModal.id || (c as any).bookingId === activeBookingModal.id
            ? { ...c, status: 'Checked Out', checkedOutDateTime: nowIso, checkedOutBy: loggedInUser }
            : c
        )
      );
    }
    onUpdateRooms(
      rooms.map((rm) =>
        assignedRooms.includes(rm.number)
          ? {
              ...rm,
              status: autoMarkDirtyOnCheckout ? 'Dirty' : 'Available',
              cleaningStatus: autoMarkDirtyOnCheckout ? 'Dirty' : 'Clean',
            }
          : rm
      )
    );
    onAddAuditLog?.(
      'Guest Checked Out via Stay Overview',
      `Checked out ${activeBookingModal.guestName} from Room ${assignedRooms.join(', ')}.${
        autoMarkDirtyOnCheckout ? ' Room marked Dirty for Housekeeping.' : ''
      }`
    );
    showToast(
      `Checked out ${activeBookingModal.guestName} from Room ${assignedRooms.join(', ')}.`,
      'success'
    );
    setActiveBookingModal(null);
  };

  // Mark No-Show or Cancel Booking
  const handleMarkStatus = (b: Booking, nextStatus: 'No-Show' | 'Cancelled') => {
    const matchedHub = hubBookings.find((hb) => hb.id === b.id);
    if (matchedHub && onCancelOrNoShowHub) {
      onCancelOrNoShowHub(
        b.id,
        nextStatus,
        0,
        `Marked ${nextStatus} from Stay Overview Calendar by ${loggedInUser}`
      );
    } else {
      const assigned = extractBookingRooms(b);
      onUpdateBookings(
        bookings.map((item) =>
          item.id === b.id ? { ...item, status: nextStatus as any, isCheckedIn: false } : item
        )
      );
      if (assigned.length > 0) {
        onUpdateRooms(
          rooms.map((rm) =>
            assigned.includes(rm.number) && rm.status === 'Reserved'
              ? { ...rm, status: rm.cleaningStatus === 'Dirty' ? 'Dirty' : 'Available' }
              : rm
          )
        );
      }
      onAddAuditLog?.(
        `Booking Marked ${nextStatus}`,
        `Marked Booking ${b.id} (${b.guestName}) as ${nextStatus} from Stay Overview.`
      );
    }
    showToast(`Marked ${b.guestName} (${b.id}) as ${nextStatus}.`, 'info');
    if (activeBookingModal?.id === b.id) setActiveBookingModal(null);
  };

  // Allocate Room to an Unallocated Booking
  const handleAssignUnallocatedRoom = (b: Booking, roomNum: string) => {
    if (!roomNum) {
      showToast('Select an available room to assign.', 'warning');
      return;
    }
    const rm = rooms.find((r) => r.number === roomNum);
    if (!rm) return;
    const inD = String(b.checkInDate || todayStr).slice(0, 10);
    const outD =
      b.checkOutDate && b.checkOutDate > inD
        ? b.checkOutDate.slice(0, 10)
        : addDaysStr(inD, Math.max(1, Number(b.nights) || 1));

    const conflict = findOverlappingBooking(rm.number, inD, outD, b.id);
    if (conflict) {
      showToast(
        `Room ${rm.number} is already booked by ${conflict.guestName} (${conflict.checkInDate} → ${conflict.checkOutDate}).`,
        'error'
      );
      return;
    }

    onUpdateBookings(
      bookings.map((item) =>
        item.id === b.id ? { ...item, roomNumber: rm.number, roomType: rm.category } : item
      )
    );
    if (inD <= todayStr && outD > todayStr && rm.status === 'Available') {
      onUpdateRooms(rooms.map((r) => (r.number === rm.number ? { ...r, status: 'Reserved' } : r)));
    }
    onAddAuditLog?.(
      'Unallocated Booking Assigned',
      `Allocated Room ${rm.number} (${rm.category}) to Booking ${b.id} (${b.guestName}).`
    );
    showToast(`Assigned Room ${rm.number} to ${b.guestName}!`, 'success');
  };

  // Reinstate No-Show Booking
  const handleReinstateNoShow = (b: Booking) => {
    const assigned = extractBookingRooms(b);
    const inD = String(b.checkInDate || '').slice(0, 10) < todayStr ? todayStr : b.checkInDate;
    const nights = Math.max(1, Number(b.nights) || 1);
    const outD = addDaysStr(inD, nights);

    let finalRoom = assigned[0] || '';
    if (finalRoom && findOverlappingBooking(finalRoom, inD, outD, b.id)) {
      finalRoom = ''; // Move to Unallocated if old room is now occupied
    }

    onUpdateBookings(
      bookings.map((item) =>
        item.id === b.id
          ? {
              ...item,
              status: 'Confirmed',
              roomNumber: finalRoom,
              checkInDate: inD,
              checkOutDate: outD,
              nights,
            }
          : item
      )
    );
    onAddAuditLog?.(
      'No-Show Booking Reinstated',
      `Reinstated Booking ${b.id} (${b.guestName}) for ${inD} → ${outD} (${finalRoom ? `Room ${finalRoom}` : 'Unallocated'}).`
    );
    showToast(
      finalRoom
        ? `Reinstated ${b.guestName} in Room ${finalRoom} (${inD} → ${outD}).`
        : `Reinstated ${b.guestName} to Unallocated Bookings (previous room occupied).`,
      'success'
    );
  };

  // Seasonal Price Override handlers
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
      label: phLabel.trim() || 'Seasonal / Festival Rate',
    };
    const nextList = editingPhId
      ? priceOverrides.map((p) => (p.id === editingPhId ? entry : p))
      : [entry, ...priceOverrides];
    setPriceOverrides(nextList);
    try {
      localStorage.setItem(hotelStorageKey, JSON.stringify(nextList));
    } catch {}
    onAddAuditLog?.(
      'Price Override Saved',
      `Set ${phCategory} rate to ₹${phRoomOnlyPrice}/N from ${phFromDate} to ${phToDate} (${entry.label}).`
    );
    showToast(`Saved ${phCategory} price ₹${phRoomOnlyPrice}/N for ${phFromDate} → ${phToDate}`, 'success');
    setEditingPhId(null);
  };

  const handleDeletePriceOverride = (id: string) => {
    const nextList = priceOverrides.filter((p) => p.id !== id);
    setPriceOverrides(nextList);
    try {
      localStorage.setItem(hotelStorageKey, JSON.stringify(nextList));
    } catch {}
    showToast('Removed seasonal price override.', 'info');
  };

  const selectedDateIso = formatDateStr(selectedDate);
  const monthHeaderTitle = `${MONTHS_FULL[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  const monthRangeLabel =
    monthDates.length > 0
      ? `1 ${MONTHS_FULL[selectedDate.getMonth()].slice(0, 3)} → ${monthDates.length} ${MONTHS_FULL[
          selectedDate.getMonth()
        ].slice(0, 3)} ${selectedDate.getFullYear()}`
      : '';

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-50 overflow-y-auto p-3 sm:p-5 space-y-4'
          : 'space-y-4'
      }
    >
      {/* ===================================================================== */}
      {/* TOP CONTROL BAR (Screenshot Reference Layout + DirectStay Gold Theme) */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs px-4 py-3.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mr-1">
            Rooms Availability
          </h1>

          {/* Unallocated Bookings Pill Button */}
          <button
            type="button"
            onClick={() => setShowUnallocatedModal(true)}
            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Unallocated Bookings</span>
            <span
              className={`ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold inline-flex items-center justify-center ${
                unallocatedBookings.length > 0
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-700 text-slate-200'
              }`}
            >
              {unallocatedBookings.length}
            </span>
          </button>

          {/* No-Show Bookings List Pill Button */}
          <button
            type="button"
            onClick={() => {
              setNoShowTab(noShowBookings.length > 0 ? 'noshow' : overdueBookings.length > 0 ? 'overdue' : 'noshow');
              setShowNoShowModal(true);
            }}
            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#C49A3A] hover:bg-[#b0882e] text-[#17120F] font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <UserX className="w-3.5 h-3.5 shrink-0" />
            <span>No-Show Bookings List</span>
            <span className="ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-white text-slate-900 text-[11px] font-extrabold inline-flex items-center justify-center shadow-2xs">
              {noShowBookings.length + overdueBookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              redirectToCheckIn(undefined, undefined, undefined, todayStr);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Reservation</span>
          </button>
        </div>

        {/* Right View Switcher + Month/Date Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'monthly'
                  ? 'bg-slate-900 text-amber-400 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-slate-900 text-amber-400 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('priceHistory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'priceHistory'
                  ? 'bg-slate-900 text-amber-400 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Seasonal Rates
            </button>
          </div>

          <button
            type="button"
            onClick={handleJumpToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            Today
          </button>

          <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1">
            <button
              type="button"
              onClick={handlePrevPeriod}
              className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-700 cursor-pointer"
              title={viewMode === 'monthly' ? 'Previous Month' : 'Previous Day'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-900 min-w-[132px] text-center">
              {viewMode === 'monthly' ? monthHeaderTitle : formatHumanDate(selectedDateIso)}
            </span>
            <button
              type="button"
              onClick={handleNextPeriod}
              className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-700 cursor-pointer"
              title={viewMode === 'monthly' ? 'Next Month' : 'Next Day'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              showLegend
                ? 'bg-slate-900 text-amber-400 border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Colour Legend"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Legend Strip */}
      {showLegend && (
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-4 text-xs shadow-2xs">
          <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            Status Legend:
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-sky-900">
            <span className="w-3.5 h-3.5 rounded bg-sky-200 border-l-4 border-sky-600 inline-block" />
            In-House (Checked In)
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
            <span className="w-3.5 h-3.5 rounded bg-amber-200 border-l-4 border-[#C49A3A] inline-block" />
            Confirmed Reservation
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-orange-900">
            <span className="w-3.5 h-3.5 rounded bg-orange-200 border-l-4 border-orange-600 inline-block" />
            Checking Out Today
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
            <span className="w-3.5 h-3.5 rounded bg-slate-200 border-l-4 border-slate-500 inline-block" />
            Checked Out (Completed)
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            Dirty / Needs Cleaning
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Clean &amp; Guest Ready
          </span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 1: FULL-WIDTH MONTHLY ROOM AVAILABILITY TIMELINE (TAPE CHART)    */}
      {/* ===================================================================== */}
      {viewMode === 'monthly' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Timeline Subheader */}
          <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-slate-50/50">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {monthHeaderTitle} Timeline
              </h2>
              <p className="text-[11px] text-slate-500">
                {monthRangeLabel} • Drag reservation bars to reassign rooms and dates • Click any bar to View, Edit, Check In or Check Out
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Search room or floor..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 w-40 sm:w-44"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Categories ({uniqueCategories.length})</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Timeline'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Horizontally Scrollable Full-Month Matrix */}
          <div ref={timelineScrollRef} className="overflow-x-auto w-full relative">
            <table className="w-full border-collapse table-fixed select-none" style={{ minWidth: `${210 + monthDates.length * 56}px` }}>
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="sticky left-0 z-40 bg-white w-[210px] min-w-[210px] max-w-[210px] px-3.5 py-2.5 text-left border-r border-slate-200 shadow-[3px_0_6px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Room Type</span>
                      <button
                        type="button"
                        onClick={toggleAllCategories}
                        className="w-6 h-6 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 inline-flex items-center justify-center cursor-pointer border border-amber-200/70"
                        title="Expand / Collapse All Categories"
                      >
                        {uniqueCategories.every((c) => collapsedCategories[c]) ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronUp className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </th>

                  {monthDates.map((md) => (
                    <th
                      key={md.iso}
                      ref={md.isToday ? todayColRef : undefined}
                      onClick={() => {
                        setSelectedDate(md.date);
                        setViewMode('daily');
                      }}
                      title={`Open Daily View for ${formatHumanDate(md.iso)}`}
                      className={`w-[56px] min-w-[56px] max-w-[56px] z-20 py-2 px-1 text-center border-r border-slate-100 cursor-pointer transition ${
                        md.isToday
                          ? 'bg-amber-50/90 border-x-2 border-x-[#C49A3A]'
                          : md.isWeekend
                          ? 'bg-[#FBF8F1]'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`text-[9.5px] font-bold tracking-wider ${
                          md.isToday
                            ? 'text-[#9A7420]'
                            : md.isWeekend
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {md.monthShort}
                      </div>
                      <div className="my-0.5 flex items-center justify-center">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-extrabold ${
                            md.isToday
                              ? 'bg-[#C49A3A] text-white shadow-xs'
                              : md.isWeekend
                              ? 'text-amber-800'
                              : 'text-slate-900'
                          }`}
                        >
                          {md.dayNum}
                        </span>
                      </div>
                      <div
                        className={`text-[9px] font-bold ${
                          md.isToday
                            ? 'text-[#9A7420]'
                            : md.isWeekend
                            ? 'text-amber-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {md.dayShort}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={monthDates.length + 1}
                      className="py-14 text-center text-xs text-slate-400"
                    >
                      No rooms configured yet. Add rooms in Room Management to view the availability timeline.
                    </td>
                  </tr>
                ) : (
                  Array.from(filteredRoomsByCat.entries()).map(([catName, catRooms]) => {
                    const isCollapsed = Boolean(collapsedCategories[catName]);
                    return (
                      <React.Fragment key={`cat-grp-${catName}`}>
                        {/* Category Header Row with Available Inventory Count per Date */}
                        <tr className="bg-slate-100/85 border-y border-slate-200/90">
                          <td
                            onClick={() =>
                              setCollapsedCategories((prev) => ({
                                ...prev,
                                [catName]: !prev[catName],
                              }))
                            }
                            className="sticky left-0 z-30 w-[210px] min-w-[210px] max-w-[210px] bg-slate-100 px-3.5 py-2 border-r border-slate-200 cursor-pointer hover:bg-slate-200/70 transition shadow-[3px_0_6px_rgba(15,23,42,0.06)]"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                )}
                                <span className="text-xs font-extrabold text-slate-900 truncate">
                                  {catName}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 shrink-0">
                                ({catRooms.length})
                              </span>
                            </div>
                          </td>

                          {monthDates.map((md) => {
                            const availInCat =
                              dailySummaryByDate[md.iso]?.byCategoryAvailable[catName] ?? catRooms.length;
                            return (
                              <td
                                key={`cat-${catName}-${md.iso}`}
                                className={`w-[56px] min-w-[56px] max-w-[56px] py-1.5 text-center border-r border-slate-200/60 ${
                                  md.isToday ? 'bg-amber-100/50 border-x border-x-[#C49A3A]/50' : ''
                                }`}
                              >
                                <span
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold ${
                                    availInCat === 0
                                      ? 'bg-rose-100 text-rose-700'
                                      : md.isPast
                                      ? 'bg-slate-300/80 text-slate-700'
                                      : availInCat <= 2
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                  title={`${availInCat} of ${catRooms.length} ${catName} available on ${formatHumanDate(md.iso)}`}
                                >
                                  {availInCat}
                                </span>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Individual Room Rows */}
                        {!isCollapsed &&
                          catRooms.map((room) => {
                            const barsForRoom: TimelineBarItem[] =
                              roomTimelineBars.get(room.number) || [];
                            const barsByStartCol = new Map<number, TimelineBarItem>(
                              barsForRoom.map((b) => [b.startColIdx, b] as [number, TimelineBarItem])
                            );
                            const dirtyNow = isRoomDirtyState(room);
                            const oooNow = isRoomOutOfOrderState(room);

                            return (
                              <tr
                                key={room.id}
                                className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors"
                              >
                                {/* Sticky Room Label Cell */}
                                <td className="sticky left-0 z-30 w-[210px] min-w-[210px] max-w-[210px] bg-white px-3.5 py-2 border-r border-slate-200 shadow-[3px_0_6px_rgba(15,23,42,0.06)] overflow-hidden">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-800 truncate">
                                        Room {room.number}
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {room.floor || '1st Floor'} • ₹{room.rate}
                                      </div>
                                    </div>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0 ${
                                        oooNow
                                          ? 'bg-rose-100 text-rose-700'
                                          : dirtyNow
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-emerald-50 text-emerald-700'
                                      }`}
                                      title={`Housekeeping: ${room.cleaningStatus || 'Clean'} • Status: ${room.status}`}
                                    >
                                      {oooNow
                                        ? 'Blocked'
                                        : room.cleaningStatus === 'In Progress'
                                        ? 'Cleaning'
                                        : room.cleaningStatus === 'Needs Inspection' ||
                                          room.cleaningStatus === 'Inspection'
                                        ? 'Inspect'
                                        : dirtyNow
                                        ? 'Dirty'
                                        : 'Clean'}
                                    </span>
                                  </div>
                                </td>

                                {/* Date Cells + Continuous Multi-Day Booking Bars */}
                                {monthDates.map((md, colIdx) => {
                                  const cellKey = `${room.number}:${md.iso}`;
                                  const barStartingHere = barsByStartCol.get(colIdx);
                                  const blkToday = isRoomBlockedOnNight(room, md.iso);
                                  const isHoverTarget = dragHoverKey === cellKey;
                                  const isPastDate = md.iso < todayStr;
                                  const isPastDateBlocked = isPastDate && !allowBackDatedCheckIn;

                                  return (
                                    <td
                                      key={cellKey}
                                      onDragOver={isPastDateBlocked ? undefined : (e) => handleDragOverCell(e, cellKey)}
                                      onDrop={isPastDateBlocked ? undefined : (e) => handleDropOnCell(e, room, md.iso)}
                                      onClick={() => {
                                        if (isPastDateBlocked) {
                                          showToast('Backdated bookings are disabled in Hotel Settings. Enable "Allow Back-Dated Check-In" to book past dates.', 'warning');
                                          return;
                                        }
                                        handleEmptyCellClick(room, md.iso);
                                      }}
                                      title={
                                        isPastDateBlocked
                                          ? `${formatHumanDate(md.iso)} (Past Date — Booking Closed)`
                                          : isPastDate
                                          ? `${formatHumanDate(md.iso)} (Backdated Booking Enabled)`
                                          : undefined
                                      }
                                      className={`relative h-11 w-[56px] min-w-[56px] max-w-[56px] p-0 border-r border-slate-100 transition-colors ${
                                        isHoverTarget
                                          ? 'bg-emerald-100/80 ring-2 ring-inset ring-emerald-500'
                                          : md.isToday
                                          ? 'bg-amber-50/45 border-x border-x-[#C49A3A]/40'
                                          : blkToday
                                          ? 'bg-rose-50/50'
                                          : isPastDateBlocked
                                          ? 'bg-slate-100/40 text-slate-400 cursor-not-allowed select-none'
                                          : isPastDate
                                          ? 'bg-amber-50/25 hover:bg-emerald-50/40 cursor-pointer'
                                          : md.isWeekend
                                          ? 'bg-[#FBF8F1]/40 hover:bg-emerald-50/40 cursor-pointer'
                                          : 'hover:bg-emerald-50/40 cursor-pointer'
                                      }`}
                                    >
                                      {/* Today subtle vertical centerline */}
                                      {md.isToday && (
                                        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[1.5px] bg-[#C49A3A]/35 z-0" />
                                      )}

                                      {/* Maintenance / Blocked Indicator when no booking bar */}
                                      {blkToday && !barStartingHere && (
                                        <div
                                          className="mx-0.5 my-1.5 h-7 rounded bg-rose-100/90 border border-rose-300 text-[9px] font-bold text-rose-800 flex items-center justify-center truncate px-1"
                                          title={room.outOfOrderReason || 'Blocked / Maintenance'}
                                        >
                                          Blocked
                                        </div>
                                      )}

                                      {/* Continuous Multi-Day Booking Bar */}
                                      {barStartingHere && (() => {
                                        const { booking: bk, spanCols, barStatus, startsBeforeMonth, endsAfterMonth } =
                                          barStartingHere;
                                        const isDraggable = barStatus !== 'checked_out';
                                        const colorStyles =
                                          barStatus === 'checked_in'
                                            ? 'bg-sky-100 hover:bg-sky-200/95 border-sky-400 border-l-4 border-l-sky-600 text-sky-950'
                                            : barStatus === 'due_out'
                                            ? 'bg-orange-100 hover:bg-orange-200/95 border-orange-400 border-l-4 border-l-orange-600 text-orange-950'
                                            : barStatus === 'confirmed'
                                            ? 'bg-amber-100 hover:bg-amber-200/95 border-amber-400 border-l-4 border-l-[#C49A3A] text-amber-950'
                                            : 'bg-slate-200/95 hover:bg-slate-300/90 border-slate-300 border-l-4 border-l-slate-500 text-slate-700';

                                        return (
                                          <div
                                            draggable={isDraggable}
                                            onDragStart={(e) => handleDragStart(e, bk, room.number)}
                                            onDragEnd={handleDragEnd}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openBookingActionModal(bk, 'details');
                                            }}
                                            style={{
                                              width: `calc(${spanCols * 100}% - 6px)`,
                                              left: '3px',
                                            }}
                                            title={`${bk.guestName} (${bk.id})\nRoom ${room.number} • ${bk.checkInDate} → ${bk.checkOutDate} (${bk.nights || 1}N)\nStatus: ${
                                              barStatus === 'checked_in'
                                                ? 'Checked In'
                                                : barStatus === 'due_out'
                                                ? 'Due Out Today'
                                                : barStatus === 'checked_out'
                                                ? 'Checked Out'
                                                : 'Confirmed'
                                            }${isDraggable ? '\nDrag to reassign room or dates • Click for actions' : ''}`}
                                            className={`absolute top-1.5 bottom-1.5 z-10 border shadow-2xs px-2 flex items-center gap-1.5 overflow-hidden transition ${colorStyles} ${
                                              startsBeforeMonth ? 'rounded-r-lg' : endsAfterMonth ? 'rounded-l-lg' : 'rounded-lg'
                                            } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                                          >
                                            <span className="w-4 h-4 rounded-full bg-slate-900/80 text-white text-[9px] font-extrabold inline-flex items-center justify-center shrink-0">
                                              {bk.guestName?.trim()?.[0]?.toUpperCase() || 'G'}
                                            </span>
                                            <span className="text-[11px] font-bold truncate leading-tight min-w-0">
                                              {bk.guestName}
                                            </span>
                                            {spanCols >= 2 && (
                                              <span className="ml-auto text-[9.5px] font-semibold opacity-75 shrink-0">
                                                {bk.nights || spanCols}N
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* Bottom Summary Rows: Available Inventory, Total Occupied & Occupancy % */}
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-[11px]">
                <tr className="border-b border-slate-200/80">
                  <td className="sticky left-0 z-30 w-[210px] min-w-[210px] max-w-[210px] bg-slate-100 px-3.5 py-2 font-bold text-emerald-800 border-r border-slate-200 shadow-[3px_0_6px_rgba(15,23,42,0.06)]">
                    Available Inventory
                  </td>
                  {monthDates.map((md) => {
                    const s = dailySummaryByDate[md.iso];
                    return (
                      <td
                        key={`ft-avail-${md.iso}`}
                        className={`w-[56px] min-w-[56px] max-w-[56px] py-2 text-center font-extrabold border-r border-slate-200/60 ${
                          md.isToday ? 'bg-amber-100/60 text-amber-950' : 'text-emerald-700'
                        }`}
                      >
                        {s?.available ?? rooms.length}
                      </td>
                    );
                  })}
                </tr>

                <tr className="border-b border-slate-200/80">
                  <td className="sticky left-0 z-30 w-[210px] min-w-[210px] max-w-[210px] bg-slate-100 px-3.5 py-2 font-bold text-slate-800 border-r border-slate-200 shadow-[3px_0_6px_rgba(15,23,42,0.06)]">
                    Total Occupied
                  </td>
                  {monthDates.map((md) => {
                    const s = dailySummaryByDate[md.iso];
                    return (
                      <td
                        key={`ft-occ-${md.iso}`}
                        className={`w-[56px] min-w-[56px] max-w-[56px] py-2 text-center font-bold border-r border-slate-200/60 ${
                          md.isToday ? 'bg-amber-100/60 text-amber-950' : 'text-slate-700'
                        }`}
                      >
                        {s?.occupied ?? 0}/{rooms.length}
                      </td>
                    );
                  })}
                </tr>

                <tr>
                  <td className="sticky left-0 z-30 w-[210px] min-w-[210px] max-w-[210px] bg-slate-100 px-3.5 py-2 font-bold text-slate-800 border-r border-slate-200 shadow-[3px_0_6px_rgba(15,23,42,0.06)]">
                    Occupancy%
                  </td>
                  {monthDates.map((md) => {
                    const pct = dailySummaryByDate[md.iso]?.occupancyPct ?? 0;
                    return (
                      <td
                        key={`ft-pct-${md.iso}`}
                        className={`w-[56px] min-w-[56px] max-w-[56px] py-2 text-center font-extrabold border-r border-slate-200/60 ${
                          md.isToday
                            ? 'bg-amber-100/60 text-[#9A7420]'
                            : pct >= 70
                            ? 'text-emerald-700'
                            : pct > 0
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {pct}%
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: DAILY OPERATIONAL ROOM AVAILABILITY & ROSTER VIEW             */}
      {/* ===================================================================== */}
      {viewMode === 'daily' && (() => {
        const dayRooms = rooms.map((rm) => {
          const activeStay = unifiedBookings.find((b) => {
            if (isBookingCancelledOrNoShow(b)) return false;
            if (isBookingCheckedOut(b) && selectedDateIso >= todayStr) return false;
            const rns = extractBookingRooms(b);
            if (!rns.includes(rm.number)) return false;
            const inD = String(b.checkInDate || '').slice(0, 10);
            const rawOut = String(b.checkOutDate || '').slice(0, 10);
            const outD = rawOut && rawOut > inD ? rawOut : addDaysStr(inD, 1);
            return selectedDateIso >= inD && selectedDateIso < outD;
          });
          const departingStay = unifiedBookings.find((b) => {
            if (isBookingCancelledOrNoShow(b)) return false;
            const rns = extractBookingRooms(b);
            return rns.includes(rm.number) && String(b.checkOutDate || '').slice(0, 10) === selectedDateIso;
          });
          const blk = isRoomBlockedOnNight(rm, selectedDateIso);
          return { room: rm, activeStay, departingStay, blk };
        });

        const occCount = dayRooms.filter((x) => Boolean(x.activeStay)).length;
        const blkCount = dayRooms.filter((x) => !x.activeStay && x.blk).length;
        const availCount = Math.max(0, rooms.length - occCount - blkCount);
        const arrivalsCount = dayRooms.filter(
          (x) => x.activeStay && String(x.activeStay.checkInDate || '').slice(0, 10) === selectedDateIso
        ).length;
        const departuresCount = dayRooms.filter((x) => Boolean(x.departingStay)).length;
        const dirtyCount = rooms.filter((r) => isRoomDirtyState(r)).length;
        const occPct = rooms.length > 0 ? Math.round((occCount / rooms.length) * 100) : 0;

        return (
          <div className="space-y-4">
            {/* Daily KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-400">Available Rooms</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">{availCount}</div>
                <div className="text-[11px] text-slate-500">Out of {rooms.length} units</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-400">Occupied / Booked</div>
                <div className="text-2xl font-extrabold text-sky-700 mt-0.5">{occCount}</div>
                <div className="text-[11px] text-slate-500">{occPct}% Occupancy</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-400">Arrivals</div>
                <div className="text-2xl font-extrabold text-amber-700 mt-0.5">{arrivalsCount}</div>
                <div className="text-[11px] text-slate-500">{formatHumanDate(selectedDateIso)}</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-400">Departures</div>
                <div className="text-2xl font-extrabold text-orange-600 mt-0.5">{departuresCount}</div>
                <div className="text-[11px] text-slate-500">Scheduled checkouts</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-400">Housekeeping Dirty</div>
                <div className="text-2xl font-extrabold text-rose-600 mt-0.5">{dirtyCount}</div>
                <div className="text-[11px] text-slate-500">Needs cleaning</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-slate-400">Blocked / OOO</div>
                <div className="text-2xl font-extrabold text-slate-700 mt-0.5">{blkCount}</div>
                <div className="text-[11px] text-slate-500">Maintenance hold</div>
              </div>
            </div>

            {/* Daily Room Cards Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Daily Room Schedule — {formatHumanDate(selectedDateIso)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click any room to create a booking or manage the active guest stay
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('monthly')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  ← Back to Monthly Timeline
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {dayRooms.map(({ room, activeStay, departingStay, blk }) => {
                  const dirty = isRoomDirtyState(room);
                  return (
                    <div
                      key={room.id}
                      className={`rounded-2xl border p-4 flex flex-col justify-between transition shadow-2xs ${
                        activeStay
                          ? isBookingCheckedIn(activeStay)
                            ? 'border-l-4 border-l-sky-600 border-slate-200 bg-sky-50/25'
                            : 'border-l-4 border-l-[#C49A3A] border-slate-200 bg-amber-50/25'
                          : blk
                          ? 'border-l-4 border-l-rose-500 border-slate-200 bg-rose-50/25'
                          : 'border-l-4 border-l-emerald-500 border-slate-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-base font-extrabold text-slate-900">
                              Room {room.number}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {room.category} • {room.floor || '1st Floor'} • ₹{room.rate}/N
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              activeStay
                                ? isBookingCheckedIn(activeStay)
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-amber-100 text-amber-900'
                                : blk
                                ? 'bg-rose-100 text-rose-800'
                                : dirty
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {activeStay
                              ? isBookingCheckedIn(activeStay)
                                ? 'Checked In'
                                : 'Reserved'
                              : blk
                              ? 'Blocked'
                              : dirty
                              ? `HK: ${room.cleaningStatus || 'Dirty'}`
                              : 'Available • Clean'}
                          </span>
                        </div>

                        {departingStay && !activeStay && (
                          <div className="text-[11px] bg-orange-50 border border-orange-200 text-orange-800 px-2.5 py-1.5 rounded-xl font-semibold">
                            Departure Today: {departingStay.guestName}
                          </div>
                        )}

                        {activeStay ? (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1 text-xs">
                            <div className="font-bold text-slate-900 flex items-center justify-between">
                              <span className="truncate">{activeStay.guestName}</span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {activeStay.mobile}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatHumanDate(activeStay.checkInDate)} → {formatHumanDate(activeStay.checkOutDate)} ({activeStay.nights || 1}N)
                            </div>
                            <div className="flex items-center justify-between pt-1 text-[11px]">
                              <span className="text-slate-500">{activeStay.bookingSource}</span>
                              <span className="font-bold text-amber-800">
                                Paid ₹{activeStay.advanceAmount || 0}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 py-2">
                            {blk
                              ? room.outOfOrderReason || 'Blocked for maintenance'
                              : dirty
                              ? `Needs cleaning (${room.assignedStaff || 'Unassigned'})`
                              : 'Vacant and ready for reservation or walk-in'}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-2">
                        {activeStay ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openBookingActionModal(activeStay, 'details')}
                              className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs cursor-pointer"
                            >
                              Manage Stay
                            </button>
                            <button
                              type="button"
                              onClick={() => openBookingActionModal(activeStay, 'edit')}
                              className="py-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                            >
                              Edit
                            </button>
                          </>
                        ) : !blk ? (
                          allowBackDatedCheckIn || selectedDateIso >= todayStr ? (
                            <button
                              type="button"
                              onClick={() => handleEmptyCellClick(room, selectedDateIso)}
                              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                            >
                              + {selectedDateIso < todayStr ? 'Backdated Book' : 'Book'} Room {room.number}
                            </button>
                          ) : (
                            <div className="w-full py-1.5 px-2 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs text-center select-none">
                              Past Date (Booking Closed)
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* VIEW 3: SEASONAL RATES & PRICE OVERRIDES (Preserved Existing Feature) */}
      {/* ===================================================================== */}
      {viewMode === 'priceHistory' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <form
            onSubmit={handleSavePriceOverride}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 h-fit"
          >
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C49A3A]" />
                {editingPhId ? 'Edit Date-Range Price Override' : 'Add Seasonal / Festival Rate'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Override room category tariffs for specific dates on the availability calendar
              </p>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Room Category *</label>
                <select
                  value={phCategory}
                  onChange={(e) => setPhCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-bold"
                >
                  {(uniqueCategories.length > 0 ? uniqueCategories : ['Standard']).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">From Date *</label>
                  <input
                    type="date"
                    value={phFromDate}
                    onChange={(e) => setPhFromDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">To Date *</label>
                  <input
                    type="date"
                    value={phToDate}
                    min={phFromDate}
                    onChange={(e) => setPhToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Room Only Rate (₹ / Night) *</label>
                <input
                  type="number"
                  min={100}
                  value={phRoomOnlyPrice}
                  onChange={(e) => setPhRoomOnlyPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">CP Rate (₹)</label>
                  <input
                    type="number"
                    value={phCpPrice}
                    onChange={(e) => setPhCpPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">MAP Rate (₹)</label>
                  <input
                    type="number"
                    value={phMapPrice}
                    onChange={(e) => setPhMapPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Occasion / Label</label>
                <input
                  type="text"
                  value={phLabel}
                  onChange={(e) => setPhLabel(e.target.value)}
                  placeholder="Weekend / Peak Season"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl cursor-pointer"
              >
                {editingPhId ? 'Update Seasonal Rate' : 'Save Seasonal Rate'}
              </button>
            </div>
          </form>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900">
              Configured Seasonal Rate Overrides ({priceOverrides.length})
            </h3>
            {priceOverrides.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No seasonal rate overrides configured yet. Standard category rates apply on all dates.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Date Range</th>
                      <th className="py-2.5 px-3">EP Rate</th>
                      <th className="py-2.5 px-3">CP / MAP</th>
                      <th className="py-2.5 px-3">Label</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {priceOverrides.map((po) => (
                      <tr key={po.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{po.category}</td>
                        <td className="py-2.5 px-3">
                          {po.fromDate} → {po.toDate}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-emerald-700">
                          ₹{po.roomOnlyPrice}/N
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          ₹{po.cpPrice || '-'} / ₹{po.mapPrice || '-'}
                        </td>
                        <td className="py-2.5 px-3">{po.label}</td>
                        <td className="py-2.5 px-3 text-right space-x-1.5">
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
                            className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePriceOverride(po.id)}
                            className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold cursor-pointer"
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
      )}

      {/* ===================================================================== */}
      {/* MODAL A: UNALLOCATED BOOKINGS LIST & 1-CLICK ROOM ASSIGNMENT          */}
      {/* ===================================================================== */}
      {showUnallocatedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-400">
                  Unallocated Bookings ({unallocatedBookings.length})
                </h3>
                <p className="text-[11px] text-slate-300">
                  Confirmed reservations awaiting room number allocation — conflict-free rooms shown per stay
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnallocatedModal(false);
                    redirectToCheckIn(undefined, uniqueCategories[0] || 'Standard', rooms[0]?.rate || 2000, todayStr);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  + Add Unallocated
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnallocatedModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {unallocatedBookings.length === 0 ? (
                <div className="py-12 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <div className="text-sm font-bold text-slate-800">All Reservations Have Rooms Assigned</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    There are zero unallocated bookings right now. You can log a category-only reservation anytime using "+ Add Unallocated".
                  </p>
                </div>
              ) : (
                unallocatedBookings.map((b) => {
                  const inD = String(b.checkInDate || todayStr).slice(0, 10);
                  const outD =
                    b.checkOutDate && b.checkOutDate > inD
                      ? b.checkOutDate.slice(0, 10)
                      : addDaysStr(inD, Math.max(1, Number(b.nights) || 1));
                  const availRoomsForStay = rooms.filter(
                    (r) =>
                      !isRoomOutOfOrderState(r) && !findOverlappingBooking(r.number, inD, outD, b.id)
                  );
                  const chosen = allocatingBookingId[b.id] || availRoomsForStay[0]?.number || '';

                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{b.guestName}</span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                            {b.roomType || 'Any Category'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">{b.id}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          {formatHumanDate(inD)} → {formatHumanDate(outD)} ({b.nights || 1}N) • {b.mobile} • {b.bookingSource}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={chosen}
                          onChange={(e) =>
                            setAllocatingBookingId((prev) => ({ ...prev, [b.id]: e.target.value }))
                          }
                          className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
                        >
                          <option value="">-- Select Room --</option>
                          {availRoomsForStay.map((rm) => (
                            <option key={rm.number} value={rm.number}>
                              Room {rm.number} ({rm.category} • {isRoomDirtyState(rm) ? 'Dirty' : 'Clean'})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAssignUnallocatedRoom(b, chosen)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Assign Room
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL B: NO-SHOW BOOKINGS & OVERDUE ARRIVALS LIST                     */}
      {/* ===================================================================== */}
      {showNoShowModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-400">
                  No-Show &amp; Overdue Arrivals Register
                </h3>
                <p className="text-[11px] text-slate-300">
                  Manage marked No-Show bookings and overdue un-checked-in reservations
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNoShowTab('noshow')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  noShowTab === 'noshow'
                    ? 'border-[#C49A3A] text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                No-Show Bookings ({noShowBookings.length})
              </button>
              <button
                type="button"
                onClick={() => setNoShowTab('overdue')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                  noShowTab === 'overdue'
                    ? 'border-[#C49A3A] text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Overdue Arrivals ({overdueBookings.length})
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {noShowTab === 'noshow' ? (
                noShowBookings.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                    No reservations are marked as No-Show.
                  </div>
                ) : (
                  noShowBookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{b.guestName}</span>
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                            No-Show
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">{b.id}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Room {b.roomNumber || 'Unallocated'} • {formatHumanDate(b.checkInDate)} → {formatHumanDate(b.checkOutDate)} • Advance ₹{b.advanceAmount || 0}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReinstateNoShow(b)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs cursor-pointer"
                        >
                          Reinstate Booking
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : overdueBookings.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  Zero overdue un-checked-in arrivals.
                </div>
              ) : (
                overdueBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{b.guestName}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-bold">
                          Missed Check-In: {formatHumanDate(b.checkInDate)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Room {b.roomNumber || 'Unallocated'} • {b.mobile} • {b.bookingSource}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNoShowModal(false);
                          openBookingActionModal(b, 'edit');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs cursor-pointer"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkStatus(b, 'No-Show')}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                      >
                        Mark No-Show
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL C: DRAG-AND-DROP ROOM & DATE REASSIGNMENT CONFIRMATION          */}
      {/* ===================================================================== */}
      {pendingDrop && (() => {
        const isInHouse = isBookingCheckedIn(pendingDrop.booking);
        const targetDirtyOrBlocked =
          (isInHouse &&
            (isRoomDirtyState(pendingDrop.targetRoom) ||
              isRoomOutOfOrderState(pendingDrop.targetRoom))) ||
          Boolean(
            getRoomBlockOverlap(
              pendingDrop.targetRoom,
              pendingDrop.newCheckInDate,
              pendingDrop.newCheckOutDate
            )
          );

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-400">
                    Confirm Room &amp; Date Reassignment
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {pendingDrop.booking.guestName} • {pendingDrop.booking.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDrop(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Current</div>
                    <div className="font-extrabold text-slate-800 text-sm mt-0.5">
                      Room {pendingDrop.sourceRoomNumber || 'Unallocated'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatHumanDate(pendingDrop.booking.checkInDate)} →{' '}
                      {formatHumanDate(pendingDrop.booking.checkOutDate)}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#C49A3A]" />
                  <div>
                    <div className="text-[10px] font-bold uppercase text-emerald-700">New Target</div>
                    <div className="font-extrabold text-emerald-900 text-sm mt-0.5">
                      Room {pendingDrop.targetRoom.number}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                      {formatHumanDate(pendingDrop.newCheckInDate)} →{' '}
                      {formatHumanDate(pendingDrop.newCheckOutDate)} ({pendingDrop.nights}N)
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recalcRateOnDrop}
                    onChange={(e) => setRecalcRateOnDrop(e.target.checked)}
                    className="mt-0.5 accent-amber-600"
                  />
                  <div>
                    <div className="font-bold text-slate-800">
                      Recalculate room tariff to Room {pendingDrop.targetRoom.number} ({pendingDrop.targetRoom.category}) rate
                    </div>
                    <div className="text-[11px] text-slate-500">
                      New tariff: ₹{pendingDrop.targetRoom.rate * pendingDrop.nights} (₹{pendingDrop.targetRoom.rate}/night × {pendingDrop.nights}N). Leave unchecked to keep ₹{pendingDrop.booking.bookingAmount}.
                    </div>
                  </div>
                </label>

                {targetDirtyOrBlocked && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Authorised Override Required — Room {pendingDrop.targetRoom.number} is{' '}
                        {pendingDrop.targetRoom.cleaningStatus || pendingDrop.targetRoom.status}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 font-semibold text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dropOverrideConfirmed}
                        onChange={(e) => setDropOverrideConfirmed(e.target.checked)}
                        className="accent-amber-600"
                      />
                      <span>I authorise moving this in-house stay despite room status</span>
                    </label>
                    <input
                      type="text"
                      value={dropOverrideReason}
                      onChange={(e) => setDropOverrideReason(e.target.value)}
                      placeholder="Enter override reason (logged to Audit Trail)..."
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPendingDrop(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPendingDrop}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold cursor-pointer"
                  >
                    Confirm Reassignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL D: CLICK BOOKING BAR -> VIEW / EDIT / CHECK-IN / CHECK-OUT      */}
      {/* ===================================================================== */}
      {activeBookingModal && (() => {
        const assignedRooms = extractBookingRooms(activeBookingModal);
        const checkedIn = isBookingCheckedIn(activeBookingModal);
        const checkedOut = isBookingCheckedOut(activeBookingModal);
        const matchedHub = hubBookings.find((hb) => hb.id === activeBookingModal.id);
        const unreadyAssignedRooms = assignedRooms
          .map((rn) => rooms.find((r) => r.number === rn))
          .filter((r): r is Room => Boolean(r && (isRoomDirtyState(r) || isRoomOutOfOrderState(r))));

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-amber-400">
                      {activeBookingModal.guestName}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-200">
                      {checkedOut ? 'Checked Out' : checkedIn ? 'In-House' : activeBookingModal.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Booking #{activeBookingModal.id} • Room {assignedRooms.join(', ') || 'Unallocated'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveBookingModal(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="px-5 pt-2.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setBookingModalMode('details')}
                  className={`pb-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                    bookingModalMode === 'details'
                      ? 'border-[#C49A3A] text-slate-900'
                      : 'border-transparent text-slate-500'
                  }`}
                >
                  Stay Summary &amp; Actions
                </button>
                {!checkedOut && (
                  <button
                    type="button"
                    onClick={() => setBookingModalMode('edit')}
                    className={`pb-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                      bookingModalMode === 'edit'
                        ? 'border-[#C49A3A] text-slate-900'
                        : 'border-transparent text-slate-500'
                    }`}
                  >
                    Edit Dates / Room / Rate
                  </button>
                )}
              </div>

              {bookingModalMode === 'details' ? (
                <div className="p-5 overflow-y-auto space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Check-In</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatHumanDate(activeBookingModal.checkInDate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Check-Out</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatHumanDate(activeBookingModal.checkOutDate)} ({activeBookingModal.nights || 1}N)
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Contact &amp; Source</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {activeBookingModal.mobile || '-'} • {activeBookingModal.bookingSource}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Room Tariff &amp; Advance</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        ₹{activeBookingModal.bookingAmount || 0} (Paid ₹{activeBookingModal.advanceAmount || 0})
                      </div>
                    </div>
                  </div>

                  {/* Dirty / Out-of-Order Warning + Authorised Override for Pending Check-In */}
                  {!checkedIn && !checkedOut && unreadyAssignedRooms.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-rose-900">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          Housekeeping Alert:{' '}
                          {unreadyAssignedRooms
                            .map((r) => `Room ${r.number} is ${r.cleaningStatus || r.status}`)
                            .join(', ')}
                        </span>
                      </div>
                      {canAuthoriseRoomOverride ? (
                        <div className="space-y-2 pt-1">
                          <label className="flex items-center gap-2 font-semibold text-rose-900 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checkInOverrideConfirmed}
                              onChange={(e) => setCheckInOverrideConfirmed(e.target.checked)}
                              className="accent-rose-600"
                            />
                            <span>Authorised Override ({currentRole}): Permit check-in before cleaning</span>
                          </label>
                          {checkInOverrideConfirmed && (
                            <input
                              type="text"
                              value={checkInOverrideReason}
                              onChange={(e) => setCheckInOverrideReason(e.target.value)}
                              placeholder="Mandatory override reason..."
                              className="w-full px-3 py-1.5 rounded-lg border border-rose-300 bg-white text-xs"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-rose-700">
                          Check-in is locked until Housekeeping marks this room Clean &amp; Ready, or a Manager/Admin authorises an override.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Primary Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {matchedHub && onSelectHubBooking && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBookingModal(null);
                          onSelectHubBooking(matchedHub);
                        }}
                        className="col-span-2 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-amber-600" />
                        <span>View Full Folio, Payments &amp; Documents</span>
                      </button>
                    )}

                    {!checkedIn && !checkedOut && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCheckInFromModal(false)}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Quick Check In</span>
                        </button>
                        {matchedHub && onOpenCheckInHub ? (
                          <button
                            type="button"
                            onClick={() => handleCheckInFromModal(true)}
                            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <BedDouble className="w-4 h-4" />
                            <span>Full GRC Check-In</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setBookingModalMode('edit')}
                            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>Edit Booking</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(activeBookingModal, 'No-Show')}
                          className="py-2 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold cursor-pointer"
                        >
                          Mark No-Show
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(activeBookingModal, 'Cancelled')}
                          className="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                        >
                          Cancel Reservation
                        </button>
                      </>
                    )}

                    {checkedIn && !checkedOut && (
                      <>
                        <button
                          type="button"
                          onClick={() => setBookingModalMode('edit')}
                          className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Extend / Shift Room</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCheckOutFromModal}
                          className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Check Out &amp; Bill</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveBookingEdit} className="p-5 overflow-y-auto space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Guest Name *</label>
                      <input
                        type="text"
                        required
                        value={editGuestName}
                        onChange={(e) => setEditGuestName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Mobile *</label>
                      <input
                        type="text"
                        required
                        value={editGuestMobile}
                        onChange={(e) => setEditGuestMobile(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Check-In Date *</label>
                      <input
                        type="date"
                        required
                        value={editCheckInDate}
                        onChange={(e) => {
                          setEditCheckInDate(e.target.value);
                          if (editCheckOutDate <= e.target.value) {
                            setEditCheckOutDate(addDaysStr(e.target.value, 1));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Check-Out Date *</label>
                      <input
                        type="date"
                        required
                        min={addDaysStr(editCheckInDate, 1)}
                        value={editCheckOutDate}
                        onChange={(e) => setEditCheckOutDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Assigned Room</label>
                    <select
                      value={editRoomNumber}
                      onChange={(e) => setEditRoomNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                    >
                      <option value="">-- Unallocated (Assign Later) --</option>
                      {rooms.map((rm) => {
                        const overlap = findOverlappingBooking(
                          rm.number,
                          editCheckInDate,
                          editCheckOutDate,
                          activeBookingModal.id
                        );
                        return (
                          <option key={rm.number} value={rm.number} disabled={Boolean(overlap)}>
                            Room {rm.number} — {rm.category} (₹{rm.rate}/N){' '}
                            {overlap
                              ? `[Booked: ${overlap.guestName}]`
                              : isRoomDirtyState(rm)
                              ? '[Dirty]'
                              : '[Available]'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Room Subtotal (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={editRoomAmount}
                        onChange={(e) => setEditRoomAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Advance Paid (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={editAdvanceAmount}
                        onChange={(e) => setEditAdvanceAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Notes</label>
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setBookingModalMode('details')}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold cursor-pointer"
                    >
                      Save Reservation Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL E: NEW RESERVATION / WALK-IN FROM CALENDAR CELL                 */}
      {/* ===================================================================== */}
      {isBookModalOpen && (() => {
        const chosenRm = rooms.find((r) => r.number === targetRoomNumber);
        const chosenUnready = Boolean(
          chosenRm && (isRoomDirtyState(chosenRm) || isRoomOutOfOrderState(chosenRm))
        );

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-400">
                    {isUnallocatedCreate
                      ? 'Create Unallocated Category Reservation'
                      : `Book Room ${targetRoomNumber} (${targetRoomType})`}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Check-In: {formatHumanDate(targetDateStr)} • Conflict-validated availability
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCalendarBooking} className="p-5 overflow-y-auto space-y-3.5 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">Unified PMS Check-In & Folio Form</span>
                    <span className="text-[11px] text-slate-600 block">Open complete guest check-in with ID verification, GST billing & guest folio</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBookModalOpen(false);
                      redirectToCheckIn(targetRoomNumber, targetRoomType, targetRate, targetDateStr);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg shadow-xs cursor-pointer shrink-0"
                  >
                    Open Check-In Form →
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setIsUnallocatedCreate(false)}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      !isUnallocatedCreate ? 'bg-slate-900 text-amber-400' : 'text-slate-600'
                    }`}
                  >
                    Assign Specific Room
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnallocatedCreate(true);
                      setInstantCheckInNow(false);
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      isUnallocatedCreate ? 'bg-slate-900 text-amber-400' : 'text-slate-600'
                    }`}
                  >
                    Unallocated (Assign Later)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Check-In Date *</label>
                    <input
                      type="date"
                      required
                      min={allowBackDatedCheckIn ? undefined : todayStr}
                      value={targetDateStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!allowBackDatedCheckIn && val < todayStr) {
                          showToast('Backdated bookings are disabled in Hotel Settings.', 'warning');
                          setTargetDateStr(todayStr);
                          return;
                        }
                        setTargetDateStr(val);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Nights *</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      value={nightsCount}
                      onChange={(e) => setNightsCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                </div>

                {!isUnallocatedCreate ? (
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Select Room *</label>
                    <select
                      value={targetRoomNumber}
                      onChange={(e) => {
                        const rm = rooms.find((r) => r.number === e.target.value);
                        setTargetRoomNumber(e.target.value);
                        if (rm) {
                          setTargetRoomType(rm.category);
                          setTargetRate(
                            getEffectiveRateForCategoryOnDate(rm.category, targetDateStr, rm.rate)
                          );
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                    >
                      <option value="">-- Choose Available Room --</option>
                      {rooms.map((rm) => {
                        const outStr = addDaysStr(targetDateStr, Math.max(1, nightsCount));
                        const overlap = findOverlappingBooking(rm.number, targetDateStr, outStr);
                        return (
                          <option key={rm.number} value={rm.number} disabled={Boolean(overlap)}>
                            Room {rm.number} — {rm.category} • ₹{rm.rate}/N{' '}
                            {overlap
                              ? `(Booked: ${overlap.guestName})`
                              : isRoomDirtyState(rm)
                              ? '(Dirty)'
                              : '(Available)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Room Category *</label>
                    <select
                      value={targetRoomType}
                      onChange={(e) => setTargetRoomType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                    >
                      {(uniqueCategories.length > 0 ? uniqueCategories : ['Standard']).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Guest Full Name *</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      value={guestMobile}
                      onChange={(e) => setGuestMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Rate / Night (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={targetRate}
                      onChange={(e) => setTargetRate(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Meal Plan</label>
                    <select
                      value={mealPlanChoice}
                      onChange={(e) => setMealPlanChoice(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                    >
                      <option value="EP">EP (Room Only)</option>
                      <option value="CP">CP (+₹300/N)</option>
                      <option value="MAP">MAP (+₹700/N)</option>
                      <option value="AP">AP (+₹1100/N)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Advance (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Booking Source</label>
                    <select
                      value={bkgSource}
                      onChange={(e) => setBkgSource(e.target.value as BookingSource)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                    >
                      <option value="Walk-in">Walk-in / Direct</option>
                      <option value="MakeMyTrip">MakeMyTrip</option>
                      <option value="Booking.com">Booking.com</option>
                      <option value="Goibibo">Goibibo</option>
                      <option value="Agoda">Agoda</option>
                      <option value="Corporate">Corporate</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Payment Mode</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                {!isUnallocatedCreate && targetDateStr <= todayStr && (
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={instantCheckInNow}
                      onChange={(e) => setInstantCheckInNow(e.target.checked)}
                      className="accent-emerald-600"
                    />
                    <span>Mark guest as Checked In immediately (Walk-In / Arrival)</span>
                  </label>
                )}

                {instantCheckInNow && chosenUnready && chosenRm && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span>
                        Room {chosenRm.number} is marked "{chosenRm.cleaningStatus || chosenRm.status}"
                      </span>
                    </div>
                    {canAuthoriseRoomOverride ? (
                      <>
                        <label className="flex items-center gap-2 font-semibold text-rose-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createDirtyOverride}
                            onChange={(e) => setCreateDirtyOverride(e.target.checked)}
                            className="accent-rose-600"
                          />
                          <span>Authorised Override ({currentRole}): Allow immediate check-in</span>
                        </label>
                        {createDirtyOverride && (
                          <input
                            type="text"
                            value={createDirtyReason}
                            onChange={(e) => setCreateDirtyReason(e.target.value)}
                            placeholder="Enter override reason..."
                            className="w-full px-3 py-1.5 rounded-lg border border-rose-300 bg-white"
                          />
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] text-rose-700">
                        Uncheck immediate check-in to save as a reservation, or clean the room in Housekeeping first.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBookModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold cursor-pointer"
                  >
                    {instantCheckInNow ? 'Confirm & Check In Now' : 'Confirm Reservation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
