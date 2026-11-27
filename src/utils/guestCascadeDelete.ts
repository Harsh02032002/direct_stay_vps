import {
  Booking,
  GuestCheckIn,
  Room,
  Invoice,
  PosOrder,
  WaterBottleRecord,
  LaundryOrder,
  AllocatedGuestService,
  FinanceVoucher,
} from '../types';

export interface CascadeDeleteTarget {
  bookingId?: string;
  checkinId?: string;
  bookingRef?: string;
  guestName?: string;
  mobile?: string;
  roomNumbers?: string[];
  hotelId?: string;
  alsoRemoveGuestProfile?: boolean;
}

export interface CascadeDeleteCollections {
  bookings: Booking[];
  checkins: GuestCheckIn[];
  rooms: Room[];
  invoices: Invoice[];
  posOrders: PosOrder[];
  waterBottles: WaterBottleRecord[];
  laundryOrders: LaundryOrder[];
  allocatedServices: AllocatedGuestService[];
  vouchers: FinanceVoucher[];
}

export interface CascadeDeleteResult extends CascadeDeleteCollections {
  removedInvoiceIds: string[];
  removedBookingIds: string[];
  removedCheckinIds: string[];
  summary: {
    bookingsRemoved: number;
    checkinsRemoved: number;
    roomsReleased: string[];
    invoicesRemoved: number;
    posOrdersRemoved: number;
    waterBottlesRemoved: number;
    laundryOrdersRemoved: number;
    allocatedServicesRemoved: number;
    vouchersRemoved: number;
  };
}

const norm = (v?: string | null): string => String(v || '').trim().toLowerCase();
const normPhone = (v?: string | null): string => String(v || '').replace(/\D/g, '').slice(-10);
const normDate = (v?: string | null): string => String(v || '').trim().slice(0, 10);

/**
 * Pure, deterministic cascade-delete helper for removing a guest booking / stay
 * and EVERY linked record across bookings, checkins, rooms, invoices, POS orders,
 * water bottles, laundry orders, allocated services, and finance vouchers.
 *
 * Checks BOTH `checkInId` (capital I) and `checkinId` (lowercase i), plus `bookingId`
 * and `groupBookingId`, so zero orphan records remain in Reports, Finance, or Invoices.
 */
export function computeGuestCascadeDelete(
  target: CascadeDeleteTarget,
  data: CascadeDeleteCollections
): CascadeDeleteResult {
  const targetBookingIds = new Set<string>();
  const targetCheckinIds = new Set<string>();
  const targetGroupIds = new Set<string>();
  const targetBookingRefs = new Set<string>();
  const affectedRoomNumbers = new Set<string>();
  const targetStaySignatures = new Set<string>(); // `${guestName}|${roomNumber}|${checkInDate}`

  if (target.bookingId) targetBookingIds.add(String(target.bookingId));
  if (target.checkinId) targetCheckinIds.add(String(target.checkinId));
  if (target.bookingRef) targetBookingRefs.add(norm(target.bookingRef));
  (target.roomNumbers || []).forEach((rn) => {
    if (rn && String(rn).trim()) affectedRoomNumbers.add(String(rn).trim());
  });

  const addSignature = (guestName?: string, roomNumber?: string, checkInDate?: string) => {
    const g = norm(guestName);
    const r = norm(roomNumber);
    const d = normDate(checkInDate);
    if (g && r && d) targetStaySignatures.add(`${g}|${r}|${d}`);
  };

  // 1. Expand linked IDs across bookings <-> checkins so both sides are always matched
  for (const ck of data.checkins) {
    const ckId = String(ck.id || '');
    const ckBkgId = String(ck.bookingId || '');
    const ckGroupId = String((ck as any).groupBookingId || '');
    if (
      (ckId && (targetCheckinIds.has(ckId) || targetBookingIds.has(ckId))) ||
      (ckBkgId && (targetBookingIds.has(ckBkgId) || targetCheckinIds.has(ckBkgId))) ||
      (ckGroupId && targetGroupIds.has(ckGroupId))
    ) {
      if (ckId) targetCheckinIds.add(ckId);
      if (ckBkgId) targetBookingIds.add(ckBkgId);
      if (ckGroupId) targetGroupIds.add(ckGroupId);
      if (ck.roomNumber) affectedRoomNumbers.add(String(ck.roomNumber).trim());
      addSignature(ck.guestName, ck.roomNumber, ck.checkInDate);
      if (Array.isArray(ck.bookedRooms)) {
        ck.bookedRooms.forEach((br) => {
          if (br?.roomNumber) {
            affectedRoomNumbers.add(String(br.roomNumber).trim());
            addSignature(ck.guestName, br.roomNumber, ck.checkInDate);
          }
        });
      }
    }
  }

  for (const bk of data.bookings) {
    const bkId = String(bk.id || '');
    const bkNo = norm((bk as any).bookingNo || (bk as any).bookingNumber || bk.id);
    const bkGroupId = String((bk as any).groupBookingId || '');
    if (
      (bkId && (targetBookingIds.has(bkId) || targetCheckinIds.has(bkId))) ||
      (bkNo && targetBookingRefs.has(bkNo)) ||
      (bkGroupId && targetGroupIds.has(bkGroupId))
    ) {
      if (bkId) targetBookingIds.add(bkId);
      if (bkNo) targetBookingRefs.add(bkNo);
      if (bkGroupId) targetGroupIds.add(bkGroupId);
      if (bk.roomNumber) affectedRoomNumbers.add(String(bk.roomNumber).trim());
      addSignature(bk.guestName, bk.roomNumber, bk.checkInDate);
      if (Array.isArray((bk as any).bookedRooms)) {
        (bk as any).bookedRooms.forEach((br: any) => {
          if (br?.roomNumber) {
            affectedRoomNumbers.add(String(br.roomNumber).trim());
            addSignature(bk.guestName, br.roomNumber, bk.checkInDate);
          }
        });
      }
      if (Array.isArray((bk as any).roomNumbers)) {
        (bk as any).roomNumbers.forEach((rn: any) => {
          if (rn) {
            affectedRoomNumbers.add(String(rn).trim());
            addSignature(bk.guestName, String(rn), bk.checkInDate);
          }
        });
      }
    }
  }

  // Re-scan checkins once more in case booking expansion discovered new booking/group IDs
  for (const ck of data.checkins) {
    const ckId = String(ck.id || '');
    const ckBkgId = String(ck.bookingId || '');
    const ckGroupId = String((ck as any).groupBookingId || '');
    if (
      (ckBkgId && targetBookingIds.has(ckBkgId)) ||
      (ckId && targetBookingIds.has(ckId)) ||
      (ckGroupId && targetGroupIds.has(ckGroupId))
    ) {
      if (ckId) targetCheckinIds.add(ckId);
      if (ck.roomNumber) affectedRoomNumbers.add(String(ck.roomNumber).trim());
      addSignature(ck.guestName, ck.roomNumber, ck.checkInDate);
    }
  }

  const matchesId = (id?: string | null): boolean => {
    const s = String(id || '');
    if (!s) return false;
    return targetBookingIds.has(s) || targetCheckinIds.has(s) || targetGroupIds.has(s);
  };

  const matchesRecordIds = (rec: any): boolean => {
    if (!rec) return false;
    return (
      matchesId(rec.bookingId) ||
      matchesId(rec.checkInId) ||
      matchesId(rec.checkinId) ||
      matchesId(rec.groupBookingId)
    );
  };

  // 2. Filter bookings
  const removedBookingIds: string[] = [];
  const nextBookings = data.bookings.filter((bk) => {
    const bkNo = norm((bk as any).bookingNo || (bk as any).bookingNumber || bk.id);
    if (matchesId(bk.id) || (bkNo && targetBookingRefs.has(bkNo))) {
      if (bk.id) removedBookingIds.push(String(bk.id));
      return false;
    }
    return true;
  });

  // 3. Filter checkins
  const removedCheckinIds: string[] = [];
  const nextCheckins = data.checkins.filter((ck) => {
    if (matchesId(ck.id) || matchesId(ck.bookingId) || matchesId((ck as any).groupBookingId)) {
      if (ck.id) removedCheckinIds.push(String(ck.id));
      return false;
    }
    return true;
  });

  // 4. Filter invoices (matches bookingId, checkInId, checkinId, groupBookingId, OR exact stay signature)
  const removedInvoiceIds = new Set<string>();
  const removedInvoiceNumbers = new Set<string>();
  const nextInvoices = data.invoices.filter((inv) => {
    const invSig = `${norm(inv.guestName)}|${norm(inv.roomNumber)}|${normDate(inv.checkInDate)}`;
    const matchedBySig = invSig.length > 4 && targetStaySignatures.has(invSig);
    if (matchesRecordIds(inv) || matchedBySig) {
      if (inv.id) removedInvoiceIds.add(String(inv.id));
      if (inv.invoiceNumber) removedInvoiceNumbers.add(norm(inv.invoiceNumber));
      return false;
    }
    return true;
  });

  // 5. Filter POS orders linked to this stay/booking
  const nextPosOrders = data.posOrders.filter((po) => !matchesRecordIds(po));

  // 6. Filter Water Bottle records linked to this stay/booking
  const nextWaterBottles = data.waterBottles.filter((wb) => !matchesRecordIds(wb));

  // 7. Filter Laundry Orders linked to this stay/booking
  const nextLaundryOrders = data.laundryOrders.filter((lo) => !matchesRecordIds(lo));

  // 8. Filter Allocated Guest Services linked to this stay/booking
  const nextAllocatedServices = data.allocatedServices.filter((as) => !matchesRecordIds(as));

  // 9. Filter Finance Vouchers linked to this booking/checkin/invoice
  const nextVouchers = data.vouchers.filter((v) => {
    const srcId = String((v as any).sourceId || '');
    const refNo = norm((v as any).referenceNumber || (v as any).referenceNo);
    const party = norm((v as any).partyName);
    if (matchesRecordIds(v)) return false;
    if (srcId && (matchesId(srcId) || removedInvoiceIds.has(srcId))) return false;
    if (refNo && (targetBookingRefs.has(refNo) || removedInvoiceNumbers.has(refNo))) return false;
    for (const ref of targetBookingRefs) {
      if (ref && ref.length >= 6 && party.includes(ref)) return false;
    }
    for (const invNo of removedInvoiceNumbers) {
      if (invNo && invNo.length >= 5 && party.includes(invNo)) return false;
    }
    return true;
  });

  // 10. Release affected rooms ONLY if no other active in-house stay occupies them
  const stillOccupiedRooms = new Set<string>();
  for (const ck of nextCheckins) {
    if (!ck.checkedOutDateTime) {
      if (ck.roomNumber) stillOccupiedRooms.add(String(ck.roomNumber).trim());
      if (Array.isArray(ck.bookedRooms)) {
        ck.bookedRooms.forEach((br) => {
          if (br?.roomNumber) stillOccupiedRooms.add(String(br.roomNumber).trim());
        });
      }
    }
  }

  const roomsReleased: string[] = [];
  const nextRooms = data.rooms.map((rm) => {
    const rn = String(rm.number || '').trim();
    if (
      affectedRoomNumbers.has(rn) &&
      !stillOccupiedRooms.has(rn) &&
      (!target.hotelId || !rm.hotelId || rm.hotelId === target.hotelId)
    ) {
      if (rm.status === 'Occupied' || rm.status === 'Reserved') {
        roomsReleased.push(rn);
        return { ...rm, status: 'Available' as const };
      }
    }
    return rm;
  });

  return {
    bookings: nextBookings,
    checkins: nextCheckins,
    rooms: nextRooms,
    invoices: nextInvoices,
    posOrders: nextPosOrders,
    waterBottles: nextWaterBottles,
    laundryOrders: nextLaundryOrders,
    allocatedServices: nextAllocatedServices,
    vouchers: nextVouchers,
    removedInvoiceIds: Array.from(removedInvoiceIds),
    removedBookingIds,
    removedCheckinIds,
    summary: {
      bookingsRemoved: data.bookings.length - nextBookings.length,
      checkinsRemoved: data.checkins.length - nextCheckins.length,
      roomsReleased,
      invoicesRemoved: data.invoices.length - nextInvoices.length,
      posOrdersRemoved: data.posOrders.length - nextPosOrders.length,
      waterBottlesRemoved: data.waterBottles.length - nextWaterBottles.length,
      laundryOrdersRemoved: data.laundryOrders.length - nextLaundryOrders.length,
      allocatedServicesRemoved: data.allocatedServices.length - nextAllocatedServices.length,
      vouchersRemoved: data.vouchers.length - nextVouchers.length,
    },
  };
}

/**
 * Helper to remove a guest from customGuests localStorage + hotel object if requested.
 */
export function removeGuestFromCustomProfiles(
  customGuests: any[],
  guestName?: string,
  mobile?: string
): any[] {
  const targetPhone = normPhone(mobile);
  const targetName = norm(guestName);
  if (!targetPhone && !targetName) return customGuests;
  return (customGuests || []).filter((g) => {
    const gPhone = normPhone(g?.phone || g?.mobile);
    const gName = norm(g?.fullName || g?.name);
    if (targetPhone && gPhone && targetPhone === gPhone) return false;
    if (!targetPhone && targetName && gName && targetName === gName) return false;
    return true;
  });
}
