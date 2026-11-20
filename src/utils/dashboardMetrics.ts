import type { Booking, GuestCheckIn, Invoice, PosOrder, Room } from '../types';
import type {
  BookingRecord,
  HousekeepingTask,
  RoomAsset,
  RoomBlockRecord,
} from '../pms-integrated/types';

export interface KpiDeltaSummary {
  yesterdayValue: number;
  pctChange: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface ArrivalTableRow {
  id: string;
  bookingNo: string;
  guestName: string;
  mobile: string;
  eta: string;
  roomLabel: string;
  roomType: string;
  status: 'Arriving' | 'Confirmed' | 'Checked In' | 'VIP' | 'Pending';
  isVip: boolean;
  hubBooking?: BookingRecord;
}

export interface DepartureTableRow {
  id: string;
  bookingNo: string;
  guestName: string;
  mobile: string;
  roomLabel: string;
  checkoutTime: string;
  status: 'Checked In' | 'Confirmed' | 'Checked Out' | 'Late';
  billStatus: 'Paid' | 'Pending';
  dueAmount: number;
  hubBooking?: BookingRecord;
}

export interface DashboardMetricsResult {
  selectedDate: string;
  yesterdayDate: string;
  tomorrowDate: string;
  formattedDateLabel: string;

  // Top 6 KPI Cards
  todaysRevenue: number;
  todaysRoomRevenue: number;
  todaysFnbRevenue: number;
  todaysOtherRevenue: number;
  revenueDelta: KpiDeltaSummary;

  adrToday: number;
  adrDelta: KpiDeltaSummary;

  revParToday: number;
  revParDelta: KpiDeltaSummary;

  arrivalsTodayCount: number;
  arrivalsCheckedInCount: number;
  departuresTodayCount: number;
  departuresCompletedCount: number;

  inHouseRoomsCount: number;
  inHouseGuestsTotal: number;
  inHouseAdults: number;
  inHouseChildren: number;

  // Second Row — 4 Operational Cards
  roomStatus: {
    vacant: number;
    occupied: number;
    dirty: number;
    clean: number;
    outOfOrder: number;
    inspected: number;
    totalRooms: number;
  };

  housekeepingStatus: {
    roomsToClean: number;
    cleaningInProgress: number;
    readyRooms: number;
    inspectionPending: number;
    totalRooms: number;
  };

  alertsAndTasks: {
    lateCheckouts: number;
    earlyArrivals: number;
    vipArrivals: number;
    pendingPayments: number;
    openMaintenance: number;
    overbookings: number;
  };

  reservationsSnapshot: {
    todaysBookings: number;
    walkIns: number;
    cancelled: number;
    noShows: number;
    expectedOccTomorrowPct: number;
    expectedOccTomorrowRooms: number;
  };

  // Third Row — Tables
  todaysArrivals: ArrivalTableRow[];
  todaysDepartures: DepartureTableRow[];
}

export interface DashboardMetricsInput {
  selectedDate: string;
  rooms: RoomAsset[];
  bookings: BookingRecord[];
  tasks?: HousekeepingTask[];
  appRooms?: Room[];
  appBookings?: Booking[];
  appCheckins?: GuestCheckIn[];
  appPosOrders?: PosOrder[];
  appInvoices?: Invoice[];
  roomBlocks?: RoomBlockRecord[];
  standardCheckInTime?: string;
  standardCheckOutTime?: string;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? new Date(`${isoDate}T00:00:00`)
    : new Date();
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + deltaDays);
    return fallback.toISOString().slice(0, 10);
  }
  base.setDate(base.getDate() + deltaDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDashboardHeaderDate(isoDate: string, todayIso?: string): string {
  const actualToday = todayIso || new Date().toISOString().slice(0, 10);
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? new Date(`${isoDate}T00:00:00`)
    : new Date();
  const formatted = dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return isoDate === actualToday ? `Today • ${formatted}` : formatted;
}

function buildDelta(todayVal: number, yesterdayVal: number): KpiDeltaSummary {
  const t = Math.round(todayVal);
  const y = Math.round(yesterdayVal);
  if (y <= 0) {
    if (t <= 0) {
      return { yesterdayValue: 0, pctChange: null, direction: 'flat' };
    }
    return { yesterdayValue: 0, pctChange: 100, direction: 'up' };
  }
  const rawPct = Math.round(((t - y) / y) * 100);
  return {
    yesterdayValue: y,
    pctChange: Math.abs(rawPct),
    direction: rawPct > 0 ? 'up' : rawPct < 0 ? 'down' : 'flat',
  };
}

function normalizeDatePrefix(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function parseTimeMinutes(timeStr?: string | null, fallbackMinutes = 720): number {
  if (!timeStr) return fallbackMinutes;
  const s = String(timeStr).trim().toUpperCase();
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let hr = Number(m12[1]);
    const mn = Number(m12[2]);
    const mer = m12[3];
    if (mer === 'PM' && hr < 12) hr += 12;
    if (mer === 'AM' && hr === 12) hr = 0;
    return hr * 60 + mn;
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (m24) {
    return Number(m24[1]) * 60 + Number(m24[2]);
  }
  return fallbackMinutes;
}

function formatTime12h(raw?: string | null, fallback = '12:00 PM'): string {
  if (!raw) return fallback;
  const s = String(raw).trim();
  if (/AM|PM/i.test(s)) return s.toUpperCase();
  const m24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (m24) {
    let hr = Number(m24[1]);
    const mn = m24[2];
    const mer = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    return `${String(hr).padStart(2, '0')}:${mn} ${mer}`;
  }
  return fallback;
}

function isCancelledStatus(status?: string | null): boolean {
  const s = String(status || '').trim().toLowerCase();
  return s === 'cancelled' || s === 'canceled' || s === 'rejected';
}

function isNoShowStatus(status?: string | null): boolean {
  const s = String(status || '').trim().toLowerCase();
  return s === 'no-show' || s === 'noshow' || s === 'no show';
}

function isCheckedOutBooking(b: BookingRecord): boolean {
  const s = String(b.status || '').trim().toLowerCase();
  return (
    Boolean(b.isCheckedOut) ||
    s === 'checked out' ||
    s === 'checkedout' ||
    s === 'completed'
  );
}

function isStayCoveringNight(b: BookingRecord, targetIso: string): boolean {
  if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) return false;
  const inDate = normalizeDatePrefix(b.checkInDate);
  const outDate = normalizeDatePrefix(b.checkOutDate);
  if (!inDate) return false;
  if (!outDate || outDate <= inDate) {
    // Same-day / day-use stay counts on checkInDate
    return inDate === targetIso;
  }
  // Standard hotel night rule: checkInDate <= targetIso < checkOutDate
  return inDate <= targetIso && targetIso < outDate;
}

function computeDayRevenueBreakdown(
  targetIso: string,
  bookings: BookingRecord[],
  appPosOrders: PosOrder[]
): {
  roomRevenue: number;
  fnbRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  occupiedRoomsForAdr: number;
} {
  const stayingBookings = bookings.filter((b) => isStayCoveringNight(b, targetIso));

  let roomRevenue = 0;
  let folioOtherRevenue = 0;
  let occupiedRoomsForAdr = 0;

  for (const b of stayingBookings) {
    const nights = Math.max(1, Number(b.nights) || 1);
    const roomsCount = Math.max(1, b.roomNumbers.filter(Boolean).length || 1);
    occupiedRoomsForAdr += roomsCount;

    // Room subtotal + room GST prorated per stay night
    const totalTaxAmt =
      Number(b.taxAmount) ||
      (Number((b as any).cgst) || 0) +
        (Number((b as any).sgst) || 0) +
        (Number((b as any).igst) || 0);
    const totalDiscAmt = Number(b.discountAmount ?? (b as any).discount ?? 0) || 0;
    const totalRoomSide = Math.max(
      0,
      (Number(b.roomSubtotal) || 0) + totalTaxAmt - totalDiscAmt
    );
    roomRevenue += totalRoomSide / nights;

    // Non-POS other services recorded on targetIso (or prorated if undated)
    if (Array.isArray(b.otherServices) && b.otherServices.length > 0) {
      for (const srv of b.otherServices) {
        if (srv.serviceType === 'POS_FOOD' || srv.serviceType === 'ROOM SERVICE') continue;
        const srvDate = normalizeDatePrefix(srv.dateTime);
        if (srvDate === targetIso) {
          folioOtherRevenue += (Number(srv.amount) || 0) + (Number(srv.taxAmount) || 0);
        } else if (!srvDate) {
          folioOtherRevenue += ((Number(srv.amount) || 0) + (Number(srv.taxAmount) || 0)) / nights;
        }
      }
    }
  }

  // Standalone & Room-Service POS Orders placed on targetIso (excluding Cancelled / Voided / Held)
  let fnbRevenue = 0;
  const countedPosIds = new Set<string>();
  for (const ord of appPosOrders) {
    const st = String(ord.status || '').toLowerCase();
    const kotSt = String((ord as any).kotStatus || '').toLowerCase();
    if (
      st === 'cancelled' ||
      st === 'voided' ||
      st === 'held' ||
      kotSt === 'cancelled' ||
      Boolean((ord as any).voidedAt) ||
      Boolean((ord as any).isHeld)
    ) {
      continue;
    }
    const ordDate =
      normalizeDatePrefix(ord.date) || normalizeDatePrefix((ord as any).createdAt);
    if (ordDate === targetIso) {
      const amt = Number(ord.grandTotal ?? (ord as any).totalAmount ?? 0) || 0;
      fnbRevenue += Math.max(0, amt);
      countedPosIds.add(ord.id);
    }
  }

  // Also include any POS_FOOD / ROOM SERVICE items on bookings if not already in appPosOrders
  for (const b of bookings) {
    if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) continue;
    for (const srv of b.otherServices || []) {
      if (srv.serviceType !== 'POS_FOOD' && srv.serviceType !== 'ROOM SERVICE') continue;
      if (srv.id && countedPosIds.has(srv.id)) continue;
      const srvDate = normalizeDatePrefix(srv.dateTime);
      if (srvDate === targetIso && appPosOrders.length === 0) {
        fnbRevenue += (Number(srv.amount) || 0) + (Number(srv.taxAmount) || 0);
      }
    }
  }

  const roundedRoom = Math.round(roomRevenue);
  const roundedFnb = Math.round(fnbRevenue);
  const roundedOther = Math.round(folioOtherRevenue);

  return {
    roomRevenue: roundedRoom,
    fnbRevenue: roundedFnb,
    otherRevenue: roundedOther,
    totalRevenue: roundedRoom + roundedFnb + roundedOther,
    occupiedRoomsForAdr,
  };
}

export function computeDashboardMetrics(input: DashboardMetricsInput): DashboardMetricsResult {
  const {
    selectedDate,
    rooms = [],
    bookings = [],
    tasks = [],
    appRooms = [],
    appBookings = [],
    appCheckins = [],
    appPosOrders = [],
    roomBlocks = [],
    standardCheckInTime = '12:00 PM',
    standardCheckOutTime = '11:00 AM',
  } = input;

  const todayActualIso = new Date().toISOString().slice(0, 10);
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : todayActualIso;
  const yesterdayDate = shiftIsoDate(effectiveDate, -1);
  const tomorrowDate = shiftIsoDate(effectiveDate, 1);

  const totalRooms = rooms.length;

  // Map raw appRooms by room number for granular housekeepingStatus ('Clean' | 'Dirty' | 'In Progress' | 'Inspecting')
  const appRoomByNo = new Map<string, Room>();
  for (const ar of appRooms) {
    appRoomByNo.set(String(ar.number), ar);
  }

  // Active blocks covering effectiveDate
  const blockedRoomNos = new Set<string>();
  for (const blk of roomBlocks) {
    const s = normalizeDatePrefix(blk.startDate);
    const e = normalizeDatePrefix(blk.endDate);
    if ((!s || s <= effectiveDate) && (!e || e >= effectiveDate)) {
      if (blk.roomNumber) blockedRoomNos.add(String(blk.roomNumber));
    }
  }

  // Room & Housekeeping Status Breakdown
  let vacantCount = 0;
  let occupiedCount = 0;
  let dirtyCount = 0;
  let cleanCount = 0;
  let outOfOrderCount = 0;
  let inspectedCount = 0;
  let cleaningInProgressCount = 0;
  let inspectionPendingCount = 0;

  // Determine rooms occupied on effectiveDate (real-time if viewing today, date-aware otherwise)
  const occupiedRoomNosOnDate = new Set<string>();
  for (const b of bookings) {
    if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) continue;
    if (effectiveDate === todayActualIso) {
      if (b.isCheckedIn && !isCheckedOutBooking(b)) {
        b.roomNumbers.forEach((rn) => rn && occupiedRoomNosOnDate.add(String(rn)));
      }
    } else if (isStayCoveringNight(b, effectiveDate)) {
      b.roomNumbers.forEach((rn) => rn && occupiedRoomNosOnDate.add(String(rn)));
    }
  }

  for (const rm of rooms) {
    const rawRoom = appRoomByNo.get(String(rm.number));
    const rawHk = String((rawRoom as any)?.housekeepingStatus || rm.cleaningStatus || '').trim();
    const rawStatus = String(rawRoom?.status || rm.status || '').trim();

    const isOutOfOrder =
      rm.status === 'Out of Service' ||
      rawStatus === 'Maintenance' ||
      blockedRoomNos.has(String(rm.number));

    const isOccupied =
      !isOutOfOrder &&
      (occupiedRoomNosOnDate.has(String(rm.number)) ||
        (effectiveDate === todayActualIso && rm.status === 'Occupied'));

    if (isOutOfOrder) {
      outOfOrderCount += 1;
    } else if (isOccupied) {
      occupiedCount += 1;
    } else {
      vacantCount += 1;
    }

    const activeRoomTasks = tasks.filter(
      (t) =>
        (t.roomId === rm.id || String(t.roomNumber) === String(rm.number)) &&
        t.status !== 'Completed'
    );
    const hasInProgressTask = activeRoomTasks.some((t) => t.status === 'In Progress');

    const isDirty =
      !isOutOfOrder &&
      (rm.status === 'Dirty' ||
        rm.cleaningStatus === 'Dirty' ||
        rawStatus === 'Dirty' ||
        rawHk === 'Dirty');

    const isInspecting =
      !isOutOfOrder &&
      !isDirty &&
      (rawHk === 'Inspecting' || rawHk === 'Inspection Pending');

    const isInProgress =
      !isOutOfOrder &&
      (rawHk === 'In Progress' ||
        rm.cleaningStatus === 'In Progress' ||
        hasInProgressTask);

    const isInspected =
      !isOutOfOrder &&
      !isDirty &&
      !isInspecting &&
      !isInProgress &&
      (rawHk === 'Inspected' || Boolean((rawRoom as any)?.lastInspectedAt));

    if (isDirty) {
      dirtyCount += 1;
    } else if (isInspecting) {
      inspectionPendingCount += 1;
    } else if (isInProgress) {
      cleaningInProgressCount += 1;
    } else if (!isOutOfOrder) {
      cleanCount += 1;
      if (isInspected) {
        inspectedCount += 1;
      }
    }
  }

  const readyRoomsCount = cleanCount; // Clean + Inspected guest-ready units
  const sellableRooms = Math.max(0, totalRooms - outOfOrderCount);

  // Revenue, ADR & RevPAR (Today vs Yesterday)
  const todayRev = computeDayRevenueBreakdown(effectiveDate, bookings, appPosOrders);
  const yesterdayRev = computeDayRevenueBreakdown(yesterdayDate, bookings, appPosOrders);

  const effectiveOccupiedToday = Math.max(todayRev.occupiedRoomsForAdr, occupiedCount);
  const adrToday =
    effectiveOccupiedToday > 0 ? Math.round(todayRev.roomRevenue / effectiveOccupiedToday) : 0;
  const adrYesterday =
    yesterdayRev.occupiedRoomsForAdr > 0
      ? Math.round(yesterdayRev.roomRevenue / yesterdayRev.occupiedRoomsForAdr)
      : 0;

  const revParDenominator = sellableRooms > 0 ? sellableRooms : totalRooms;
  const revParToday =
    revParDenominator > 0 ? Math.round(todayRev.roomRevenue / revParDenominator) : 0;
  const revParYesterday =
    revParDenominator > 0 ? Math.round(yesterdayRev.roomRevenue / revParDenominator) : 0;

  // Map raw bookings & check-ins for Adult/Child pax breakdown,bookingDate, ETA, VIP
  const rawBookingById = new Map<string, Booking>();
  for (const ab of appBookings) {
    rawBookingById.set(String(ab.id), ab);
  }
  const rawCheckinById = new Map<string, GuestCheckIn>();
  for (const ci of appCheckins) {
    rawCheckinById.set(String(ci.id), ci);
    if (ci.bookingId) rawCheckinById.set(String(ci.bookingId), ci);
  }

  // In-House Guests (Currently Checked-In on Today, or Staying on selectedDate)
  const inHouseBookings = bookings.filter((b) => {
    if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) return false;
    if (effectiveDate === todayActualIso) {
      return Boolean(b.isCheckedIn && !isCheckedOutBooking(b));
    }
    return isStayCoveringNight(b, effectiveDate);
  });

  let inHouseRoomsCount = 0;
  let inHouseAdults = 0;
  let inHouseChildren = 0;

  for (const b of inHouseBookings) {
    const rmCnt = Math.max(1, b.roomNumbers.filter(Boolean).length || 1);
    inHouseRoomsCount += rmCnt;
    const rawBk = rawBookingById.get(String(b.id));
    const rawCi = rawCheckinById.get(String(b.id));
    if (rawCi && (Number(rawCi.adults) > 0 || Number(rawCi.children) > 0)) {
      inHouseAdults += Math.max(1, Number(rawCi.adults) || 1);
      inHouseChildren += Math.max(0, Number(rawCi.children) || 0);
    } else if (rawBk && (Number(rawBk.adults) > 0 || Number(rawBk.children) > 0)) {
      inHouseAdults += Math.max(1, Number(rawBk.adults) || 1);
      inHouseChildren += Math.max(0, Number(rawBk.children) || 0);
    } else if (Number(b.adults) > 0 || Number(b.children) > 0) {
      inHouseAdults += Math.max(1, Number(b.adults) || 1);
      inHouseChildren += Math.max(0, Number(b.children) || 0);
    } else {
      const childGuests = (b.guests || []).filter(
        (g) => Number(g.age) > 0 && Number(g.age) < 12
      ).length;
      const totalPax = Math.max(1, Number(b.numGuests) || (b.guests?.length ?? 1));
      inHouseChildren += Math.min(totalPax - 1, childGuests);
      inHouseAdults += Math.max(1, totalPax - childGuests);
    }
  }
  const inHouseGuestsTotal = inHouseAdults + inHouseChildren;

  // Today's Arrivals
  const stdInMins = parseTimeMinutes(standardCheckInTime, 12 * 60);
  const stdOutMins = parseTimeMinutes(standardCheckOutTime, 11 * 60);
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const arrivalsBookings = bookings.filter((b) => {
    if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) return false;
    return normalizeDatePrefix(b.checkInDate) === effectiveDate;
  });

  let earlyArrivalsCount = 0;
  let vipArrivalsCount = 0;
  let arrivalsCheckedInCount = 0;

  const todaysArrivals: ArrivalTableRow[] = arrivalsBookings.map((b) => {
    const rawBk = rawBookingById.get(String(b.id));
    const etaStr = formatTime12h(
      rawBk?.checkInTime || b.expectedArrivalTime || b.checkInTime,
      standardCheckInTime
    );
    const etaMins = parseTimeMinutes(etaStr, stdInMins);
    if (etaMins < stdInMins) {
      earlyArrivalsCount += 1;
    }

    const notesLower = `${b.remarks || ''} ${rawBk?.notes || ''}`.toLowerCase();
    const catLabel =
      b.roomCategorySummary ||
      b.requirements?.map((r) => r.categoryName).filter(Boolean).join(', ') ||
      rawBk?.roomType ||
      rooms.find((r) => b.roomNumbers.includes(r.number))?.category ||
      'Standard';

    const isVip =
      notesLower.includes('vip') ||
      b.bookingType === 'Corporate' ||
      Boolean(b.companyName || rawBk?.companyName) ||
      /suite|presidential/i.test(catLabel);
    if (isVip) vipArrivalsCount += 1;

    const alreadyIn = Boolean(b.isCheckedIn);
    if (alreadyIn) arrivalsCheckedInCount += 1;

    const roomLabel =
      b.roomNumbers.filter(Boolean).length > 0
        ? b.roomNumbers.filter(Boolean).join(', ')
        : 'Unassigned';

    let rowStatus: ArrivalTableRow['status'] = 'Confirmed';
    if (alreadyIn) rowStatus = 'Checked In';
    else if (isVip) rowStatus = 'VIP';
    else if (String(rawBk?.status || '') === 'Pending') rowStatus = 'Pending';

    return {
      id: b.id,
      bookingNo: b.bookingNo || b.id,
      guestName: b.customerName,
      mobile: b.mobile,
      eta: etaStr,
      roomLabel,
      roomType: catLabel,
      status: rowStatus,
      isVip,
      hubBooking: b,
    };
  });

  // Today's Departures
  const departuresBookings = bookings.filter((b) => {
    if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) return false;
    return normalizeDatePrefix(b.checkOutDate) === effectiveDate;
  });

  let departuresCompletedCount = 0;
  const todaysDepartures: DepartureTableRow[] = departuresBookings.map((b) => {
    const rawBk = rawBookingById.get(String(b.id));
    const rawCi = rawCheckinById.get(String(b.id));
    const outTimeStr = formatTime12h(
      (rawCi as any)?.checkOutTime || rawBk?.checkOutTime || b.checkOutTime,
      standardCheckOutTime
    );
    const checkedOut = isCheckedOutBooking(b);
    if (checkedOut) departuresCompletedCount += 1;

    const isLateToday =
      !checkedOut &&
      Boolean(b.isCheckedIn) &&
      effectiveDate === todayActualIso &&
      nowMins > stdOutMins + 30;

    let depStatus: DepartureTableRow['status'] = 'Confirmed';
    if (checkedOut) depStatus = 'Checked Out';
    else if (isLateToday) depStatus = 'Late';
    else if (b.isCheckedIn) depStatus = 'Checked In';

    const dueAmt = Math.max(0, Math.round(Number(b.dueAmount) || 0));
    const billStatus: 'Paid' | 'Pending' = dueAmt <= 0 && b.totalPayable > 0 ? 'Paid' : dueAmt <= 0 ? 'Paid' : 'Pending';

    return {
      id: b.id,
      bookingNo: b.bookingNo || b.id,
      guestName: b.customerName,
      mobile: b.mobile,
      roomLabel:
        b.roomNumbers.filter(Boolean).length > 0
          ? b.roomNumbers.filter(Boolean).join(', ')
          : 'Unassigned',
      checkoutTime: outTimeStr,
      status: depStatus,
      billStatus,
      dueAmount: dueAmt,
      hubBooking: b,
    };
  });

  // Alerts & Tasks
  // 1. Late Check-outs: stays still checked-in whose checkOutDate < effectiveDate OR due out today past standard check-out time
  const lateCheckoutsCount = bookings.filter((b) => {
    if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) return false;
    if (!b.isCheckedIn || isCheckedOutBooking(b)) return false;
    const outIso = normalizeDatePrefix(b.checkOutDate);
    if (!outIso) return false;
    if (outIso < effectiveDate) return true;
    if (outIso === effectiveDate && effectiveDate === todayActualIso && nowMins > stdOutMins + 30) {
      return true;
    }
    return false;
  }).length;

  // 2. Pending Payments: non-cancelled, non-noshow bookings with positive dueAmount
  const pendingPaymentsCount = bookings.filter((b) => {
    if (isCancelledStatus(b.status) || isNoShowStatus(b.status)) return false;
    return Math.round(Number(b.dueAmount) || 0) > 0;
  }).length;

  // 3. Open Maintenance: out-of-order rooms + active maintenance tasks on non-OOO rooms
  const openMaintenanceTasks = tasks.filter(
    (t) =>
      t.status !== 'Completed' &&
      /maint|repair|plumb|ac|electr/i.test(`${t.taskType} ${t.notes || ''}`)
  );
  const maintRoomSet = new Set<string>();
  rooms.forEach((rm) => {
    const rawRoom = appRoomByNo.get(String(rm.number));
    if (
      rm.status === 'Out of Service' ||
      rawRoom?.status === 'Maintenance' ||
      blockedRoomNos.has(String(rm.number))
    ) {
      maintRoomSet.add(String(rm.number));
    }
  });
  openMaintenanceTasks.forEach((t) => maintRoomSet.add(String(t.roomNumber)));
  const openMaintenanceCount = maintRoomSet.size;

  // 4. Overbookings: double-booked room numbers on effectiveDate OR category demand > category room supply
  let overbookingsCount = 0;
  const roomAllocationCount = new Map<string, number>();
  const categoryDemandCount = new Map<string, number>();
  const categorySupplyCount = new Map<string, number>();
  rooms.forEach((r) => {
    categorySupplyCount.set(r.category, (categorySupplyCount.get(r.category) || 0) + 1);
  });
  bookings
    .filter((b) => isStayCoveringNight(b, effectiveDate))
    .forEach((b) => {
      b.roomNumbers.filter(Boolean).forEach((rn) => {
        roomAllocationCount.set(rn, (roomAllocationCount.get(rn) || 0) + 1);
      });
      b.requirements?.forEach((req) => {
        categoryDemandCount.set(
          req.categoryName,
          (categoryDemandCount.get(req.categoryName) || 0) +
            Math.max(1, Number(req.qty ?? (req as any).quantity) || 1)
        );
      });
    });
  roomAllocationCount.forEach((cnt) => {
    if (cnt > 1) overbookingsCount += cnt - 1;
  });
  categoryDemandCount.forEach((demand, cat) => {
    const supply = categorySupplyCount.get(cat);
    if (supply !== undefined && demand > supply) {
      overbookingsCount += demand - supply;
    }
  });

  // Reservations Snapshot for effectiveDate
  let todaysBookingsCount = 0;
  let walkInsCount = 0;
  let cancelledCount = 0;
  let noShowsCount = 0;

  for (const b of bookings) {
    const rawBk = rawBookingById.get(String(b.id));
    const bookedDateIso =
      normalizeDatePrefix(rawBk?.bookingDate) ||
      normalizeDatePrefix(rawBk?.createdAt) ||
      normalizeDatePrefix(b.bookedOn) ||
      normalizeDatePrefix((b as any).createdAt) ||
      normalizeDatePrefix(b.checkInDate);
    const checkInIso = normalizeDatePrefix(b.checkInDate);
    const touchesDate = bookedDateIso === effectiveDate || checkInIso === effectiveDate;

    if (isCancelledStatus(b.status)) {
      if (touchesDate) cancelledCount += 1;
      continue;
    }
    if (isNoShowStatus(b.status)) {
      if (touchesDate) noShowsCount += 1;
      continue;
    }

    const srcLower = String(b.source || (rawBk as any)?.bookingSource || (rawBk as any)?.source || '').toLowerCase();
    const isWalkIn = srcLower.includes('walk');

    if (bookedDateIso === effectiveDate) {
      todaysBookingsCount += 1;
    }
    if (isWalkIn && checkInIso === effectiveDate) {
      walkInsCount += 1;
    }
  }

  // Expected Occupancy Tomorrow
  const tomorrowStays = bookings.filter((b) => isStayCoveringNight(b, tomorrowDate));
  const tomorrowRoomsBooked = Math.min(
    totalRooms,
    tomorrowStays.reduce((sum, b) => sum + Math.max(1, b.roomNumbers.filter(Boolean).length || 1), 0)
  );
  const expectedOccTomorrowPct =
    totalRooms > 0 ? Math.round((tomorrowRoomsBooked / totalRooms) * 100) : 0;

  return {
    selectedDate: effectiveDate,
    yesterdayDate,
    tomorrowDate,
    formattedDateLabel: formatDashboardHeaderDate(effectiveDate, todayActualIso),

    todaysRevenue: todayRev.totalRevenue,
    todaysRoomRevenue: todayRev.roomRevenue,
    todaysFnbRevenue: todayRev.fnbRevenue,
    todaysOtherRevenue: todayRev.otherRevenue,
    revenueDelta: buildDelta(todayRev.totalRevenue, yesterdayRev.totalRevenue),

    adrToday,
    adrDelta: buildDelta(adrToday, adrYesterday),

    revParToday,
    revParDelta: buildDelta(revParToday, revParYesterday),

    arrivalsTodayCount: todaysArrivals.length,
    arrivalsCheckedInCount,
    departuresTodayCount: todaysDepartures.length,
    departuresCompletedCount,

    inHouseRoomsCount,
    inHouseGuestsTotal,
    inHouseAdults,
    inHouseChildren,

    roomStatus: {
      vacant: vacantCount,
      occupied: occupiedCount,
      dirty: dirtyCount,
      clean: cleanCount,
      outOfOrder: outOfOrderCount,
      inspected: inspectedCount,
      totalRooms,
    },

    housekeepingStatus: {
      roomsToClean: dirtyCount,
      cleaningInProgress: cleaningInProgressCount,
      readyRooms: readyRoomsCount,
      inspectionPending: inspectionPendingCount,
      totalRooms,
    },

    alertsAndTasks: {
      lateCheckouts: lateCheckoutsCount,
      earlyArrivals: earlyArrivalsCount,
      vipArrivals: vipArrivalsCount,
      pendingPayments: pendingPaymentsCount,
      openMaintenance: openMaintenanceCount,
      overbookings: overbookingsCount,
    },

    reservationsSnapshot: {
      todaysBookings: todaysBookingsCount,
      walkIns: walkInsCount,
      cancelled: cancelledCount,
      noShows: noShowsCount,
      expectedOccTomorrowPct,
      expectedOccTomorrowRooms: tomorrowRoomsBooked,
    },

    todaysArrivals,
    todaysDepartures,
  };
}
