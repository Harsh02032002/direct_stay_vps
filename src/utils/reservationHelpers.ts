import { Booking, GuestCheckIn, Invoice, PosOrder, Room, UserRole, WaterBottleRecord } from '../types';
import { BillCharge, BillSettings, r2 } from './billCalculator';
import { buildStayBill, StayBill } from './stayBilling';

export type CanonicalReservationStatus =
  | 'Draft'
  | 'Confirmed'
  | 'Upcoming'
  | 'Checked-In'
  | 'Checked-Out'
  | 'Cancelled'
  | 'No-Show';

export type ReservationSegment =
  | 'Individual'
  | 'Group'
  | 'Event / Banquet'
  | 'Corporate'
  | 'Walk-in'
  | 'OTA'
  | 'Travel Agent';

export function isEventBanquetBooking(bk: any): boolean {
  if (!bk) return false;
  const rawCat = String(bk.bookingCategory || '').trim().toLowerCase();
  const rawType = String(bk.bookingType || '').trim().toLowerCase();
  const rawPurpose = String(bk.purposeOfVisit || '').trim().toLowerCase();
  const rawSpecial = String(bk.specialRequests || '').trim().toLowerCase();
  const rawId = String(bk.id || '').trim().toUpperCase();
  return (
    rawCat === 'event' ||
    rawCat.includes('event') ||
    rawCat.includes('banquet') ||
    rawType.includes('event') ||
    rawType.includes('banquet') ||
    rawPurpose.includes('event / banquet') ||
    rawSpecial.includes('event / banquet') ||
    rawId.startsWith('EVT-')
  );
}

export function extractEventVenueLabel(bk: any): string {
  if (!bk) return '';
  const pieces: string[] = [];
  const gn = String(bk.groupName || '').trim();
  if (gn && gn.toLowerCase() !== 'event / banquet block') {
    pieces.push(gn);
  }
  const vn = String(bk.eventVenueName || '').trim();
  if (vn) {
    pieces.push(vn);
  } else {
    const sr = String(bk.specialRequests || '');
    const m = sr.match(/Event\s*\/\s*Banquet\s*:\s*([^|]+)/i);
    if (m && m[1]?.trim()) {
      pieces.push(m[1].trim());
    }
  }
  return Array.from(new Set(pieces)).join(' • ');
}

export type ReservationActionType =
  | 'view'
  | 'edit'
  | 'checkIn'
  | 'checkOut'
  | 'roomChange'
  | 'payment'
  | 'invoice'
  | 'cancel'
  | 'noShow';

export const OTA_BOOKING_SOURCES = [
  'MakeMyTrip',
  'Goibibo',
  'Booking.com',
  'Agoda',
  'Airbnb',
  'OYO',
  'Expedia',
  'Yatra',
  'Cleartrip',
  'OTA',
  'Other OTA',
];

export interface EnrichedReservationItem {
  booking: Booking;
  linkedCheckin?: GuestCheckIn;
  linkedInvoice?: Invoice;
  isStandaloneCheckin: boolean;
  canonicalStatus: CanonicalReservationStatus;
  primarySegment: ReservationSegment;
  segments: ReservationSegment[];
  roomNumbers: string[];
  roomCount: number;
  displayRoomsLabel: string;
  categoryLabel: string;
  paxTotal: number;
  adultsCount: number;
  childrenCount: number;
  paxLabel: string;
  nightsCount: number;
  durationHoursLabel: string;
  bookedOnDate: string;
  bookedOnTime: string;
  financials: {
    stayBill: StayBill;
    totalPayable: number;
    receivedAmount: number;
    pendingAmount: number;
    settlementAmount: number;
    refundedAmount: number;
    taxAmount: number;
    roomSubtotal: number;
    extraServicesTotal: number;
    discountAmount: number;
    isFullySettled: boolean;
  };
}

export function findLinkedCheckinForBooking(
  bk: Booking,
  checkins: GuestCheckIn[] = []
): GuestCheckIn | undefined {
  if (!checkins || checkins.length === 0) return undefined;
  const direct = checkins.find(
    c => c.id === bk.id || String((c as any).bookingId || '') === bk.id
  );
  if (direct) return direct;

  if (bk.groupBookingId) {
    const groupMatch = checkins.find(c => c.groupBookingId === bk.groupBookingId);
    if (groupMatch) return groupMatch;
  }

  const bkRooms = getReservationRoomNumbers(bk);
  const bkName = String(bk.guestName || '').trim().toLowerCase();
  if (!bkName || bkRooms.length === 0) return undefined;

  return checkins.find(c => {
    const cName = String(c.guestName || '').trim().toLowerCase();
    const cRooms = String(c.roomNumber || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const sharesRoom = cRooms.some(r => bkRooms.includes(r));
    if (!sharesRoom || cName !== bkName) return false;
    const cIn = String(c.checkInDate || '').slice(0, 10);
    const bIn = String(bk.checkInDate || '').slice(0, 10);
    return !cIn || !bIn || cIn === bIn;
  });
}

export function resolveCanonicalStatus(
  bk: Booking,
  linkedCheckin?: GuestCheckIn,
  todayStr?: string
): CanonicalReservationStatus {
  const effectiveToday = todayStr || new Date().toISOString().slice(0, 10);
  const raw = String(bk.status || '').trim().toLowerCase();

  if (raw === 'cancelled') return 'Cancelled';
  if (raw === 'no-show' || raw === 'no show' || raw === 'noshow') return 'No-Show';

  if (
    bk.isCompleted ||
    Boolean((bk as any).isCheckedOut) ||
    raw === 'checked-out' ||
    raw === 'checked out' ||
    raw === 'checkedout' ||
    Boolean(linkedCheckin?.checkedOutDateTime)
  ) {
    return 'Checked-Out';
  }

  if (
    bk.isCheckedIn ||
    raw === 'checked-in' ||
    raw === 'checked in' ||
    raw === 'checkedin' ||
    (Boolean(linkedCheckin) && !linkedCheckin?.checkedOutDateTime)
  ) {
    return 'Checked-In';
  }

  if (raw === 'draft') {
    return 'Draft';
  }

  if (
    (raw === 'in process' || raw === 'pending' || raw === 'waiting') &&
    Number(bk.advanceAmount || 0) <= 0
  ) {
    return 'Draft';
  }

  const checkInDate = String(bk.checkInDate || '').slice(0, 10);
  if (raw === 'upcoming' || (checkInDate && checkInDate > effectiveToday)) {
    return 'Upcoming';
  }

  return 'Confirmed';
}

export function getStatusPillClasses(status: CanonicalReservationStatus): {
  badge: string;
  dot: string;
} {
  switch (status) {
    case 'Draft':
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-300',
        dot: 'bg-slate-500',
      };
    case 'Confirmed':
      return {
        badge: 'bg-sky-100/90 text-sky-800 border-sky-300',
        dot: 'bg-sky-600',
      };
    case 'Upcoming':
      return {
        badge: 'bg-indigo-50 text-indigo-800 border-indigo-300',
        dot: 'bg-indigo-600',
      };
    case 'Checked-In':
      return {
        badge: 'bg-emerald-100/90 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-600',
      };
    case 'Checked-Out':
      return {
        badge: 'bg-teal-50 text-teal-800 border-teal-300',
        dot: 'bg-teal-600',
      };
    case 'Cancelled':
      return {
        badge: 'bg-rose-100/90 text-rose-800 border-rose-300',
        dot: 'bg-rose-600',
      };
    case 'No-Show':
      return {
        badge: 'bg-amber-100/95 text-amber-900 border-amber-300',
        dot: 'bg-amber-600',
      };
  }
}

export function getReservationRoomNumbers(bk: Booking): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const addNum = (val: unknown) => {
    const clean = String(val || '').trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    ordered.push(clean);
  };

  if (Array.isArray(bk.bookedRooms) && bk.bookedRooms.length > 0) {
    bk.bookedRooms.forEach(br => addNum(br?.roomNumber));
  }
  if (bk.roomNumber) {
    String(bk.roomNumber)
      .split(',')
      .forEach(part => addNum(part));
  }
  return ordered;
}

export function getReservationRoomSummary(bk: Booking, rooms: Room[] = []) {
  const roomNumbers = getReservationRoomNumbers(bk);
  const roomCount = Math.max(1, roomNumbers.length || (Array.isArray(bk.bookedRooms) ? bk.bookedRooms.length : 1));
  const displayRoomsLabel =
    roomNumbers.length === 0
      ? `Unassigned (${roomCount} Room${roomCount > 1 ? 's' : ''})`
      : roomNumbers.length <= 3
      ? `${roomNumbers.join(', ')} (${roomNumbers.length} Room${roomNumbers.length > 1 ? 's' : ''})`
      : `${roomNumbers.slice(0, 2).join(', ')} +${roomNumbers.length - 2} (${roomNumbers.length} Rooms)`;

  const categories: string[] = [];
  const addCat = (c: unknown) => {
    const clean = String(c || '').trim();
    if (clean && !categories.includes(clean)) categories.push(clean);
  };
  if (Array.isArray(bk.bookedRooms) && bk.bookedRooms.length > 0) {
    bk.bookedRooms.forEach(br => addCat((br as any).roomType || br.category));
  }
  roomNumbers.forEach(rn => {
    const matched = rooms.find(r => String(r.number).trim() === rn);
    if (matched?.category) addCat(matched.category);
  });
  if (bk.roomType) addCat(bk.roomType);

  const primaryCat = (categories[0] || 'Standard Room').toUpperCase();
  const categoryLabel =
    categories.length > 1 ? `${primaryCat} +${categories.length - 1}` : primaryCat;

  return {
    roomNumbers,
    roomCount,
    displayRoomsLabel,
    categoryLabel,
    categories,
  };
}

export function resolveReservationSegments(bk: Booking): {
  primarySegment: ReservationSegment;
  segments: ReservationSegment[];
} {
  const segments: ReservationSegment[] = [];
  const roomNums = getReservationRoomNumbers(bk);
  const src = String(bk.bookingSource || '').trim();
  const srcLower = src.toLowerCase();

  const isEvent = isEventBanquetBooking(bk);
  if (isEvent) segments.push('Event / Banquet');

  const isGroup =
    roomNums.length > 1 ||
    (Array.isArray(bk.bookedRooms) && bk.bookedRooms.length > 1) ||
    Boolean(bk.isGroupCheckIn) ||
    Boolean(bk.groupBookingId);
  if (isGroup) segments.push('Group');

  const isCorporate =
    Boolean(bk.isCorporateBooking) ||
    srcLower === 'corporate' ||
    Boolean(bk.companyName && bk.companyName.trim());
  if (isCorporate) segments.push('Corporate');

  const isAgent =
    srcLower === 'travel agent' ||
    Boolean(bk.travelAgentId) ||
    Boolean(bk.travelAgentName && bk.travelAgentName.trim());
  if (isAgent) segments.push('Travel Agent');

  const isOta = OTA_BOOKING_SOURCES.some(o => o.toLowerCase() === srcLower);
  if (isOta) segments.push('OTA');

  const isWalkIn =
    srcLower === 'walk-in' ||
    srcLower === 'walkin' ||
    srcLower === 'walk in' ||
    Boolean((bk as any).isStandaloneWalkin);
  if (isWalkIn) segments.push('Walk-in');

  if (!isEvent && !isGroup && !isCorporate && !isAgent && !isOta && !isWalkIn) {
    segments.push('Individual');
  } else if (!isEvent && !isGroup) {
    // Non-group stays are also single/individual room stays when filtering Individual if direct/walkin
    if (srcLower === 'direct' || srcLower === 'phone' || srcLower === 'website') {
      segments.push('Individual');
    }
  }

  const primarySegment: ReservationSegment = isEvent
    ? 'Event / Banquet'
    : isGroup
    ? 'Group'
    : isCorporate
    ? 'Corporate'
    : isAgent
    ? 'Travel Agent'
    : isOta
    ? 'OTA'
    : isWalkIn
    ? 'Walk-in'
    : 'Individual';

  return { primarySegment, segments };
}

export function parseTimeMinutes(timeStr?: string, fallbackMinutes = 12 * 60): number {
  if (!timeStr) return fallbackMinutes;
  const clean = String(timeStr).trim().toUpperCase();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hr = Number(ampmMatch[1]);
    const min = Number(ampmMatch[2]);
    const mer = ampmMatch[3];
    if (mer === 'PM' && hr < 12) hr += 12;
    if (mer === 'AM' && hr === 12) hr = 0;
    return hr * 60 + min;
  }
  const h24Match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (h24Match) {
    return Number(h24Match[1]) * 60 + Number(h24Match[2]);
  }
  return fallbackMinutes;
}

export function formatDisplayTime12h(timeStr?: string, fallback = '12:00 PM'): string {
  if (!timeStr) return fallback;
  const clean = String(timeStr).trim();
  if (/AM|PM/i.test(clean)) return clean.toUpperCase();
  const m = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return clean;
  let hr = Number(m[1]);
  const min = m[2];
  const mer = hr >= 12 ? 'PM' : 'AM';
  if (hr === 0) hr = 12;
  else if (hr > 12) hr -= 12;
  return `${String(hr).padStart(2, '0')}:${min} ${mer}`;
}

export function formatShortHumanDate(dateStr?: string): string {
  if (!dateStr) return 'Open Stay';
  const clean = String(dateStr).slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }
  return String(dateStr);
}

export function computeStayDurationInfo(
  bk: Booking,
  defaultCheckInTime = '12:00 PM',
  defaultCheckOutTime = '11:00 AM'
): { nightsCount: number; durationHoursLabel: string } {
  const inDate = String(bk.checkInDate || '').slice(0, 10);
  const outDate = String(bk.checkOutDate || '').slice(0, 10);
  if (bk.isHourlyStay && Number(bk.stayHours) > 0) {
    return {
      nightsCount: 1,
      durationHoursLabel: `${Number(bk.stayHours)} hr`,
    };
  }
  let nights = Math.max(1, Number(bk.nights) || 1);
  if (inDate && outDate) {
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        const hrs = Number(bk.stayHours) || 6;
        return { nightsCount: 1, durationHoursLabel: `${hrs} hr` };
      }
      if (diffDays > 0) nights = diffDays;
    }
  }
  const inMins = parseTimeMinutes(bk.checkInTime || defaultCheckInTime, 12 * 60);
  const outMins = parseTimeMinutes(bk.checkOutTime || defaultCheckOutTime, 11 * 60);
  const totalMinutes = Math.max(60, nights * 24 * 60 + (outMins - inMins));
  const totalHours = Math.round(totalMinutes / 60);
  return {
    nightsCount: nights,
    durationHoursLabel: `${totalHours} hr`,
  };
}

export function canPerformReservationAction(
  action: ReservationActionType,
  status: CanonicalReservationStatus,
  role: UserRole = 'Admin'
): boolean {
  const isSupervisor = role === 'Admin' || role === 'SuperAdmin' || role === 'Manager' || role === 'Owner';
  switch (action) {
    case 'view':
    case 'invoice':
      return true;
    case 'edit':
      return true;
    case 'checkIn':
      return status === 'Draft' || status === 'Confirmed' || status === 'Upcoming';
    case 'checkOut':
      return status === 'Checked-In';
    case 'roomChange':
      return (
        status === 'Draft' ||
        status === 'Confirmed' ||
        status === 'Upcoming' ||
        status === 'Checked-In'
      );
    case 'payment':
      return status !== 'Cancelled' && status !== 'No-Show';
    case 'cancel':
      return (
        (status === 'Draft' || status === 'Confirmed' || status === 'Upcoming') &&
        (isSupervisor || role === 'Reception' || role === 'Receptionist')
      );
    case 'noShow':
      return status === 'Draft' || status === 'Confirmed' || status === 'Upcoming';
    default:
      return false;
  }
}

export function validateRoomAllocationForDates(params: {
  targetRoomNumbers: string[];
  checkInDate: string;
  checkOutDate: string;
  excludeBookingId?: string;
  excludeCheckinId?: string;
  rooms: Room[];
  bookings: Booking[];
  checkins?: GuestCheckIn[];
  todayStr?: string;
}): { valid: boolean; error?: string } {
  const {
    targetRoomNumbers,
    checkInDate,
    checkOutDate,
    excludeBookingId,
    excludeCheckinId,
    rooms,
    bookings,
    checkins = [],
    todayStr = new Date().toISOString().slice(0, 10),
  } = params;

  const cleanTargets = Array.from(
    new Set(targetRoomNumbers.map(s => String(s || '').trim()).filter(Boolean))
  );
  if (cleanTargets.length === 0) {
    return { valid: false, error: 'Please select at least one valid room.' };
  }

  const startStr = String(checkInDate || '').slice(0, 10);
  const effectiveEnd =
    String(checkOutDate || '').slice(0, 10) ||
    (() => {
      const d = new Date(startStr || todayStr);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

  for (const roomNum of cleanTargets) {
    const rm = rooms.find(r => String(r.number).trim() === roomNum);
    if (!rm) {
      return { valid: false, error: `Room ${roomNum} does not exist in hotel inventory.` };
    }
    if (
      rm.status === 'Out of Order' ||
      rm.status === 'Maintenance' ||
      rm.status === 'Blocked' ||
      rm.status === 'Out of Service'
    ) {
      return {
        valid: false,
        error: `Room ${roomNum} is currently marked ${rm.status} and cannot be assigned.`,
      };
    }

    // Check active in-house checkins overlap
    const overlappingCheckin = checkins.find(c => {
      if (c.checkedOutDateTime) return false;
      if (excludeCheckinId && c.id === excludeCheckinId) return false;
      if (excludeBookingId && (c.id === excludeBookingId || (c as any).bookingId === excludeBookingId)) {
        return false;
      }
      const cRooms = String(c.roomNumber || '')
        .split(',')
        .map(s => s.trim());
      if (!cRooms.includes(roomNum)) return false;
      const cStart = String(c.checkInDate || todayStr).slice(0, 10);
      const cEnd = String(c.checkOutDate || '').slice(0, 10) || '9999-12-31';
      return startStr === cStart || (startStr < cEnd && effectiveEnd > cStart);
    });
    if (overlappingCheckin) {
      return {
        valid: false,
        error: `Room ${roomNum} is currently occupied by ${overlappingCheckin.guestName} (${overlappingCheckin.checkInDate} → ${overlappingCheckin.checkOutDate || 'In-House'}).`,
      };
    }

    if (startStr <= todayStr && effectiveEnd > todayStr && rm.status === 'Occupied') {
      // Allow only if the room belongs to the excluded booking itself
      const belongsToExcluded = bookings.some(
        b =>
          b.id === excludeBookingId &&
          getReservationRoomNumbers(b).includes(roomNum)
      );
      if (!belongsToExcluded) {
        return {
          valid: false,
          error: `Room ${roomNum} is currently Occupied and cannot be double-booked.`,
        };
      }
    }

    const conflictingBooking = bookings.find(b => {
      if (excludeBookingId && b.id === excludeBookingId) return false;
      const st = resolveCanonicalStatus(b, undefined, todayStr);
      if (st === 'Cancelled' || st === 'No-Show' || st === 'Checked-Out') return false;
      const bRooms = getReservationRoomNumbers(b);
      if (!bRooms.includes(roomNum)) return false;
      const bStart = String(b.checkInDate || '').slice(0, 10);
      const bEnd =
        String(b.checkOutDate || '').slice(0, 10) ||
        (() => {
          const d = new Date(bStart || todayStr);
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })();
      return startStr === bStart || (startStr < bEnd && effectiveEnd > bStart);
    });

    if (conflictingBooking) {
      return {
        valid: false,
        error: `Room ${roomNum} is already reserved for ${conflictingBooking.guestName} (#${conflictingBooking.id}, ${conflictingBooking.checkInDate} → ${conflictingBooking.checkOutDate || 'Open'}).`,
      };
    }
  }

  return { valid: true };
}

export function mergeBookingsAndStandaloneWalkIns(
  bookings: Booking[] = [],
  checkins: GuestCheckIn[] = [],
  rooms: Room[] = []
): Array<{ booking: Booking; linkedCheckin?: GuestCheckIn; isStandaloneCheckin: boolean }> {
  const result: Array<{ booking: Booking; linkedCheckin?: GuestCheckIn; isStandaloneCheckin: boolean }> = [];
  const consumedCheckinIds = new Set<string>();

  for (const bk of bookings) {
    const linked = findLinkedCheckinForBooking(bk, checkins);
    if (linked) {
      consumedCheckinIds.add(linked.id);
      if (linked.groupBookingId) {
        checkins
          .filter(c => c.groupBookingId === linked.groupBookingId)
          .forEach(gc => consumedCheckinIds.add(gc.id));
      }
    }
    result.push({ booking: bk, linkedCheckin: linked, isStandaloneCheckin: false });
  }

  // Group remaining standalone walk-in check-ins (e.g. group walk-ins share groupBookingId)
  const groupedWalkins = new Map<string, GuestCheckIn[]>();
  for (const ci of checkins) {
    if (consumedCheckinIds.has(ci.id)) continue;
    // Also skip if a booking shares exact ID
    if (bookings.some(b => b.id === ci.id || b.id === (ci as any).bookingId)) continue;
    const key = ci.groupBookingId ? `grp:${ci.groupBookingId}` : `ci:${ci.id}`;
    const arr = groupedWalkins.get(key) || [];
    arr.push(ci);
    groupedWalkins.set(key, arr);
  }

  for (const [, groupList] of groupedWalkins.entries()) {
    const primary = groupList[0];
    const allRoomNums = Array.from(
      new Set(
        groupList
          .flatMap(g => String(g.roomNumber || '').split(',').map(s => s.trim()))
          .filter(Boolean)
      )
    );
    const primaryRoomObj = rooms.find(r => String(r.number).trim() === allRoomNums[0]);
    const inDate = String(primary.checkInDate || '').slice(0, 10);
    const outDate = String(primary.checkOutDate || '').slice(0, 10);
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    const calcNights =
      !isNaN(d1.getTime()) && !isNaN(d2.getTime())
        ? Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
        : 1;

    const bookedRooms =
      groupList.length > 1
        ? groupList.map(g => {
            const gAny = g as any;
            const rmObj = rooms.find(r => String(r.number).trim() === String(g.roomNumber).trim());
            const nightly = Number(g.roomRate) || Number(rmObj?.rate) || 2000;
            return {
              roomNumber: g.roomNumber,
              category: rmObj?.category || 'Standard Room',
              rate: nightly,
              originalRate: Number(g.originalRate || gAny.originalRoomRate) || nightly,
              discountAmountOfRoom: Number(g.discount) || 0,
              guestsCount: Number(gAny.numberOfGuests || g.adults) || 2,
              extraGuestsCount: Number(gAny.extraGuestsCount) || 0,
              extraPersonChargeApplied: Number(g.extraPersonChargeApplied) || 0,
              totalRoomAmount: nightly * calcNights,
              hasExtraBed: g.hasExtraBed,
              extraBedCount: g.extraBedCount,
              extraBedRate: g.extraBedRate,
            };
          })
        : primary.bookedRooms;

    const totalRoomAmt = groupList.reduce(
      (sum, g) => sum + (Number(g.roomRate) || Number(primaryRoomObj?.rate) || 0) * calcNights,
      0
    );
    const totalAdvAmt = groupList.reduce((sum, g) => sum + (Number(g.advanceAmount) || 0), 0);
    const totalGuests = groupList.reduce(
      (sum, g) => sum + (Number((g as any).numberOfGuests || g.adults) || 1),
      0
    );
    const allCheckedOut = groupList.every(g => Boolean(g.checkedOutDateTime));
    const pAny = primary as any;

    const syntheticBooking: Booking = {
      id: primary.groupBookingId || primary.id,
      hotelId: primary.hotelId,
      guestName: primary.guestName || 'Walk-in Guest',
      mobile: primary.mobile || '',
      email: primary.emailAddress || '',
      aadhaarNumber: primary.idNumber || '',
      address: primary.address || '',
      checkInDate: inDate,
      checkOutDate: outDate,
      checkInTime: pAny.checkInTime,
      checkOutTime: pAny.checkOutTime,
      nights: calcNights,
      adults: Math.max(1, totalGuests - (Number(primary.childCount) || 0)),
      children: Number(primary.childCount) || 0,
      roomNumber: allRoomNums.join(', '),
      roomType: primaryRoomObj?.category || 'Standard Room',
      bookedRooms,
      isGroupCheckIn: groupList.length > 1 || Boolean(primary.isGroupCheckIn),
      groupBookingId: primary.groupBookingId,
      groupName: primary.groupName,
      advanceAmount: totalAdvAmt,
      paymentMethod: primary.paymentMethod || 'Cash',
      bookingSource: primary.companyName ? 'Corporate' : 'Walk-in',
      status: allCheckedOut ? 'Checked-Out' : 'Checked-In',
      isCheckedIn: !allCheckedOut,
      isCompleted: allCheckedOut,
      bookingAmount: totalRoomAmt,
      bookingDate: inDate,
      companyName: primary.companyName,
      gstNumber: primary.gstNumber,
      nationality: primary.nationality,
      mealPlan: primary.mealPlan,
      travelAgentId: primary.travelAgentId,
      travelAgentName: primary.travelAgentName,
      hasExtraBed: primary.hasExtraBed,
      extraBedCount: primary.extraBedCount,
      extraBedRate: primary.extraBedRate,
      purposeOfVisit: primary.purposeOfVisit,
      specialRequests: pAny.specialRequests,
      ...({
        bookingCategory: pAny.bookingCategory,
        bookingType: pAny.bookingType,
        eventVenueName: pAny.eventVenueName,
      } as any),
    };
    (syntheticBooking as any).isStandaloneWalkin = true;

    result.push({
      booking: syntheticBooking,
      linkedCheckin: primary,
      isStandaloneCheckin: true,
    });
  }

  return result;
}

export function computeReservationFinancials(params: {
  booking: Booking;
  linkedCheckin?: GuestCheckIn;
  invoices?: Invoice[];
  posOrders?: PosOrder[];
  waterBottles?: WaterBottleRecord[];
  rooms?: Room[];
  billSettings: BillSettings;
  configuredDefaultGst: number;
}): EnrichedReservationItem['financials'] {
  const {
    booking: bk,
    linkedCheckin,
    invoices = [],
    posOrders = [],
    waterBottles = [],
    rooms = [],
    billSettings,
    configuredDefaultGst,
  } = params;

  const { nightsCount } = computeStayDurationInfo(bk);
  const primaryRoom = rooms.find(
    r => String(r.number).trim() === (getReservationRoomNumbers(bk)[0] || '')
  );
  const fallbackRate = Number(primaryRoom?.rate) || 2000;

  const isWithoutGst =
    Boolean(bk.isWithoutGst) ||
    (bk.gstRate !== undefined && Number(bk.gstRate) <= 0);
  const effectiveGstRate = isWithoutGst
    ? 0
    : Number(bk.gstRate) > 0
    ? Number(bk.gstRate)
    : configuredDefaultGst;

  const effectiveSettings: BillSettings = {
    ...billSettings,
    roomGstRate: isWithoutGst ? 0 : effectiveGstRate,
    foodGstRate: isWithoutGst ? 0 : billSettings.foodGstRate || effectiveGstRate,
  };

  const rawBookingAmt = Number(bk.bookingAmount) || fallbackRate * nightsCount;
  const exBedTotal =
    bk.hasExtraBed && (!Array.isArray(bk.bookedRooms) || bk.bookedRooms.length === 0)
      ? (Number(bk.extraBedCount) || 1) * (Number(bk.extraBedRate) || 500) * nightsCount
      : 0;
  const adjustedRoomAmt =
    exBedTotal > 0 && rawBookingAmt > exBedTotal ? r2(rawBookingAmt - exBedTotal) : rawBookingAmt;

  const bookingForFolio: Booking = {
    ...bk,
    nights: nightsCount,
    bookingAmount: adjustedRoomAmt,
  };

  const serviceCharges: BillCharge[] = (bk.bookedServices || [])
    .filter(sv => sv && Number(sv.amount) > 0)
    .map((sv, idx) => ({
      id: `bsvc-${sv.serviceId || idx}`,
      kind: 'service' as const,
      description: sv.serviceName || 'Booked Service',
      amount: Number(sv.amount),
      roomNumber: bk.roomNumber || 'TBD',
      sourceKey: `bsvc:${sv.serviceId || idx}`,
    }));

  const stayBill = buildStayBill({
    booking: bookingForFolio,
    checkin: linkedCheckin || null,
    posOrders,
    waterBottles,
    rooms,
    settings: effectiveSettings,
    additionalCharges: serviceCharges,
    gstEnabledOverride: !isWithoutGst && effectiveGstRate > 0,
  });

  const linkedInvoice = invoices.find(
    inv =>
      !inv.isSeparateInvoice &&
      !(inv as any).isSuperseded &&
      (inv.bookingId === bk.id ||
        (linkedCheckin && (inv.bookingId === linkedCheckin.id || (inv as any).checkInId === linkedCheckin.id)))
  );

  let totalPayable = r2(stayBill.bill.grandTotal);
  let receivedAmount = r2(stayBill.bill.receipts);

  // If official invoice was settled at checkout or has recorded paidAmount > receipts, sync accurately
  if (linkedInvoice) {
    const invTotal = Number(linkedInvoice.totalAmount || (linkedInvoice as any).grandTotal || 0);
    const invPaid = Number((linkedInvoice as any).paidAmount || (linkedInvoice as any).receivedAmount || 0);
    if (invTotal > 0 && (bk.isCompleted || linkedCheckin?.checkedOutDateTime)) {
      totalPayable = r2(invTotal);
    }
    if (invPaid > receivedAmount) {
      receivedAmount = r2(invPaid);
    } else if (
      ((linkedInvoice as any).paymentStatus === 'Paid' ||
        (linkedInvoice as any).invoiceStatus === 'Settled' ||
        bk.paymentStatus === 'Fully Paid') &&
      receivedAmount < totalPayable
    ) {
      receivedAmount = totalPayable;
    }
  } else if (bk.paymentStatus === 'Fully Paid' && receivedAmount < totalPayable) {
    receivedAmount = totalPayable;
  }

  const refundedAmount = r2(Number(bk.refundAmount || 0));
  const isCancelledOrNoShow =
    bk.status === 'Cancelled' ||
    String(bk.status || '').toLowerCase() === 'no-show' ||
    String(bk.status || '').toLowerCase() === 'no show';

  const pendingAmount = isCancelledOrNoShow
    ? 0
    : r2(Math.max(0, totalPayable - receivedAmount));

  const settlementAmount = isCancelledOrNoShow
    ? r2(Math.max(0, receivedAmount - refundedAmount))
    : bk.isCompleted || linkedCheckin?.checkedOutDateTime
    ? receivedAmount
    : totalPayable;

  const roomSubtotal = r2(
    stayBill.folio.charges
      .filter(c => c.kind === 'room' || c.kind === 'extra_bed' || c.kind === 'early_checkin')
      .reduce((s, c) => s + Number(c.amount || 0), 0)
  );
  const extraServicesTotal = r2(
    stayBill.folio.charges
      .filter(c => c.kind !== 'room' && c.kind !== 'extra_bed' && c.kind !== 'early_checkin')
      .reduce((s, c) => s + Number(c.amount || 0), 0)
  );

  return {
    stayBill,
    totalPayable,
    receivedAmount,
    pendingAmount,
    settlementAmount,
    refundedAmount,
    taxAmount: r2(stayBill.bill.totalTax),
    roomSubtotal,
    extraServicesTotal,
    discountAmount: r2(stayBill.bill.discount),
    isFullySettled: pendingAmount <= 0.5 && totalPayable > 0,
  };
}

export function buildReservationsCsv(items: EnrichedReservationItem[]): string {
  const headers = [
    'Booking ID',
    'Guest Name',
    'Mobile',
    'Guests (Pax)',
    'Segment',
    'Rooms',
    'Room Count',
    'Category',
    'Check-In Date',
    'Check-In Time',
    'Check-Out Date',
    'Check-Out Time',
    'Nights',
    'Booking Source',
    'Company / Agent',
    'Booked On',
    'Status',
    'Total Payable (INR)',
    'Received Amount (INR)',
    'Pending Balance (INR)',
    'Settlement / Retained (INR)',
    'Refunded (INR)',
    'Payment Mode',
  ];

  const escapeCsvCell = (v: unknown) => {
    const str = String(v ?? '').replace(/"/g, '""');
    return /[",\n\r]/.test(str) ? `"${str}"` : str;
  };

  const rows = items.map(item => {
    const bk = item.booking;
    const companyOrAgent = [bk.companyName, bk.travelAgentName].filter(Boolean).join(' / ');
    return [
      bk.id,
      bk.guestName,
      bk.mobile,
      item.paxLabel,
      item.primarySegment,
      item.roomNumbers.join(', ') || 'Unassigned',
      item.roomCount,
      item.categoryLabel,
      bk.checkInDate,
      formatDisplayTime12h(bk.checkInTime, '12:00 PM'),
      bk.checkOutDate || 'Open',
      formatDisplayTime12h(bk.checkOutTime, '11:00 AM'),
      item.nightsCount,
      bk.bookingSource,
      companyOrAgent,
      item.bookedOnDate,
      item.canonicalStatus,
      item.financials.totalPayable.toFixed(2),
      item.financials.receivedAmount.toFixed(2),
      item.financials.pendingAmount.toFixed(2),
      item.financials.settlementAmount.toFixed(2),
      item.financials.refundedAmount.toFixed(2),
      bk.paymentMethod || '',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}
