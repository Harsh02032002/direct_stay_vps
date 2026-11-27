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

/**
 * Pure, deterministic cascade-delete helper for removing a guest booking / stay
 * and EVERY linked record across bookings, checkins, rooms, invoices, POS orders,
 * water bottles, laundry orders, allocated services, and finance vouchers.
 *
 * Scoped strictly to the matched bookingId / checkinId (never touches unrelated guests).
 */
export function computeGuestCascadeDelete(
  target: CascadeDeleteTarget,
  data: CascadeDeleteCollections
): CascadeDeleteResult {
  const targetBookingIds = new Set<string>();
  const targetCheckinIds = new Set<string>();
  const targetBookingRefs = new Set<string>();
  const affectedRoomNumbers = new Set<string>();

  if (target.bookingId) targetBookingIds.add(String(target.bookingId));
  if (target.checkinId) targetCheckinIds.add(String(target.checkinId));
  if (target.bookingRef) targetBookingRefs.add(norm(target.bookingRef));
  (target.roomNumbers || []).forEach((rn) => {
    if (rn && String(rn).trim()) affectedRoomNumbers.add(String(rn).trim());
  });

  // 1. Expand linked IDs across bookings <-> checkins so both sides are always matched
  for (const ck of data.checkins) {
    const ckId = String(ck.id || '');
    const ckBkgId = String(ck.bookingId || '');
    const ckGroupId = String((ck as any).groupBookingId || '');
    if (
      (ckId && targetCheckinIds.has(ckId)) ||
      (ckBkgId && targetBookingIds.has(ckBkgId)) ||
      (ckId && targetBookingIds.has(ckId)) ||
      (ckBkgId && targetCheckinIds.has(ckBkgId))
    ) {
      if (ckId) targetCheckinIds.add(ckId);
      if (ckBkgId) targetBookingIds.add(ckBkgId);
      if (ckGroupId && targetBookingIds.has(ckGroupId)) targetCheckinIds.add(ckId);
      if (ck.roomNumber) affectedRoomNumbers.add(String(ck.roomNumber).trim());
      if (Array.isArray(ck.bookedRooms)) {
        ck.bookedRooms.forEach((br) => {
          if (br?.roomNumber) affectedRoomNumbers.add(String(br.roomNumber).trim());
        });
      }
    }
  }

  for (const bk of data.bookings) {
    const bkId = String(bk.id || '');
    const bkNo = norm((bk as any).bookingNo || (bk as any).bookingNumber || bk.id);
    if (
      (bkId && (targetBookingIds.has(bkId) || targetCheckinIds.has(bkId))) ||
      (bkNo && targetBookingRefs.has(bkNo))
    ) {
      if (bkId) targetBookingIds.add(bkId);
      if (bkNo) targetBookingRefs.add(bkNo);
      if (bk.roomNumber) affectedRoomNumbers.add(String(bk.roomNumber).trim());
      if (Array.isArray((bk as any).bookedRooms)) {
        (bk as any).bookedRooms.forEach((br: any) => {
          if (br?.roomNumber) affectedRoomNumbers.add(String(br.roomNumber).trim());
        });
      }
      if (Array.isArray((bk as any).roomNumbers)) {
        (bk as any).roomNumbers.forEach((rn: any) => {
          if (rn) affectedRoomNumbers.add(String(rn).trim());
        });
      }
    }
  }

  // Re-scan checkins once more in case booking expansion discovered new booking IDs
  for (const ck of data.checkins) {
    const ckId = String(ck.id || '');
    const ckBkgId = String(ck.bookingId || '');
    if ((ckBkgId && targetBookingIds.has(ckBkgId)) || (ckId && targetBookingIds.has(ckId))) {
      if (ckId) targetCheckinIds.add(ckId);
      if (ck.roomNumber) affectedRoomNumbers.add(String(ck.roomNumber).trim());
    }
  }

  const matchesId = (id?: string | null): boolean => {
    const s = String(id || '');
    if (!s) return false;
    return targetBookingIds.has(s) || targetCheckinIds.has(s);
  };

  // 2. Filter bookings
  const nextBookings = data.bookings.filter((bk) => {
    const bkNo = norm((bk as any).bookingNo || (bk as any).bookingNumber || bk.id);
    if (matchesId(bk.id)) return false;
    if (bkNo && targetBookingRefs.has(bkNo)) return false;
    return true;
  });

  // 3. Filter checkins
  const nextCheckins = data.checkins.filter((ck) => {
    if (matchesId(ck.id) || matchesId(ck.bookingId)) return false;
    return true;
  });

  // 4. Collect invoice IDs to remove (for voucher cascade too)
  const removedInvoiceIds = new Set<string>();
  const nextInvoices = data.invoices.filter((inv) => {
    const invBkg = (inv as any).bookingId;
    const invCk = (inv as any).checkinId;
    if (matchesId(invBkg) || matchesId(invCk)) {
      if (inv.id) removedInvoiceIds.add(String(inv.id));
      return false;
    }
    return true;
  });

  // 5. Filter POS orders linked to this stay/booking
  const nextPosOrders = data.posOrders.filter((po) => {
    if (matchesId((po as any).checkinId) || matchesId((po as any).bookingId)) return false;
    return true;
  });

  // 6. Filter Water Bottle records linked to this stay/booking
  const nextWaterBottles = data.waterBottles.filter((wb) => {
    if (matchesId((wb as any).checkinId) || matchesId((wb as any).bookingId)) return false;
    return true;
  });

  // 7. Filter Laundry Orders linked to this stay/booking
  const nextLaundryOrders = data.laundryOrders.filter((lo) => {
    if (matchesId((lo as any).checkinId) || matchesId((lo as any).bookingId)) return false;
    return true;
  });

  // 8. Filter Allocated Guest Services linked to this stay/booking
  const nextAllocatedServices = data.allocatedServices.filter((as) => {
    if (matchesId((as as any).checkinId) || matchesId((as as any).bookingId)) return false;
    return true;
  });

  // 9. Filter Finance Vouchers linked to this booking/checkin/invoice
  const nextVouchers = data.vouchers.filter((v) => {
    const srcId = String((v as any).sourceId || '');
    const refNo = norm((v as any).referenceNumber || (v as any).referenceNo);
    const party = norm((v as any).partyName);
    if (srcId && (matchesId(srcId) || removedInvoiceIds.has(srcId))) return false;
    if (refNo && targetBookingRefs.has(refNo)) return false;
    for (const ref of targetBookingRefs) {
      if (ref && ref.length >= 6 && party.includes(ref)) return false;
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
