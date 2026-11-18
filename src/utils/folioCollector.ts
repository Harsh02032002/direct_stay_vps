/**
 * DirectStay — Folio Collector.
 * Gathers EVERY chargeable item of ONE stay (from both the legacy data model — Booking + GuestCheckIn
 * + extraCharges + WaterBottleRecord — and the /admin hub model — BookingRecord.otherServices/payments)
 * into a clean, de-duplicated list of BillCharge + BillPayment for calculateBill().
 *
 * Framework-free: the identical file is used by the Mobile Admin App.
 */
import {
  BillCharge,
  BillChargeKind,
  BillPayment,
  BillSettings,
  r2,
  sourceKeyFromId,
} from './billCalculator';

type AnyRec = Record<string, any>;

export interface CollectStayInput {
  booking?: AnyRec | null;
  checkin?: AnyRec | null;
  posOrders?: AnyRec[];
  laundryOrders?: AnyRec[];
  waterBottles?: AnyRec[];
  rooms?: AnyRec[];
  settings: BillSettings;
  /** New charges added on the checkout screen (only NEW ones, never existing). */
  additionalCharges?: BillCharge[];
  /** New payments being collected right now. */
  additionalPayments?: BillPayment[];
  /** Force the "☑ GST Invoice" tick (true/false). Undefined => derive from booking/check-in. */
  gstEnabledOverride?: boolean;
  discountOverride?: number;
}

export interface CollectStayResult {
  charges: BillCharge[];
  payments: BillPayment[];
  gstEnabled: boolean;
  discount: number;
  roomNumbers: string[];
  nights: number;
  checkInDate: string;
  checkOutDate: string;
  stayIds: string[];
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function stayNights(checkIn?: string, checkOut?: string, fallback?: number): number {
  if (checkIn && checkOut) {
    const a = new Date(String(checkIn).slice(0, 10) + 'T00:00:00');
    const b = new Date(String(checkOut).slice(0, 10) + 'T00:00:00');
    const d = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (Number.isFinite(d) && d > 0) return d;
  }
  return Math.max(1, Math.floor(n(fallback)) || 1);
}

const splitRooms = (v: unknown): string[] =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function kindFromLabel(category?: string, sourceType?: string, serviceType?: string, desc?: string): BillChargeKind {
  const c = String(category || '').toLowerCase();
  const st = String(sourceType || '').toLowerCase();
  const sv = String(serviceType || '').toLowerCase();
  const d = String(desc || '').toLowerCase();
  if (st.includes('pos') || c === 'food' || sv.includes('room service') || sv.includes('food') || d.startsWith('pos ')) return 'food';
  if (st.includes('water') || c.includes('water') || sv.includes('water') || d.includes('water bottle')) return 'water';
  if (st.includes('laundry') || c === 'laundry' || sv.includes('laundry')) return 'laundry';
  if (c === 'damage' || sv.includes('damage') || sv.includes('fine') || d.includes('fine')) return 'fine';
  if (c.includes('late') || d.includes('late check')) return 'late_checkout';
  if (d.includes('early check')) return 'early_checkin';
  if (st.includes('service') || sv.includes('service') || c === 'other') return 'service';
  return 'other';
}

/** POS order pre-tax amount (food enters the bill PRE-TAX; GST is applied once by the bill). */
function posPreTax(po: AnyRec, foodRate: number): number {
  const sub = n(po.subtotal);
  const disc = n(po.discount);
  if (sub > 0) return r2(Math.max(0, sub - disc));
  const gross = n(po.grandTotal ?? po.totalAmount);
  const tax = n(po.taxAmount ?? po.gstAmount);
  if (gross > 0 && tax > 0) return r2(gross - tax);
  return foodRate > 0 ? r2(gross / (1 + foodRate / 100)) : r2(gross);
}

const isPaidAtCounter = (po: AnyRec): boolean => {
  const method = String(po.paymentMethod || '').toLowerCase();
  const paid = String(po.paymentStatus || '').toLowerCase() === 'paid';
  const toRoom = po.postToRoomBill === true || method.includes('room');
  return paid && !toRoom;
};

export function collectStayCharges(input: CollectStayInput): CollectStayResult {
  const b = input.booking || null;
  const c = input.checkin || null;
  const s = input.settings;

  const stayIds = Array.from(
    new Set([b?.id, b?.bookingNo, c?.id, c?.bookingId, (c as AnyRec)?.checkInId].filter(Boolean).map(String))
  );

  const checkInDate = String(c?.checkInDate || b?.checkInDate || '').slice(0, 10);
  const checkOutDate = String(c?.checkOutDate || b?.checkOutDate || '').slice(0, 10);
  const nights = stayNights(checkInDate, checkOutDate, c?.nights ?? b?.nights);

  const roomNumbers: string[] = Array.from(
    new Set(
      [
        ...(Array.isArray(b?.roomNumbers) ? b!.roomNumbers : []),
        ...(Array.isArray(c?.bookedRooms) ? c!.bookedRooms.map((r: AnyRec) => r.roomNumber) : []),
        ...splitRooms(c?.roomNumber),
        ...splitRooms(b?.roomNumber),
      ]
        .filter(Boolean)
        .map(String)
    )
  );
  const primaryRoom = roomNumbers[0] || '';
  const roomRateOf = (rn: string) => n((input.rooms || []).find((r) => String(r.number) === rn)?.rate);

  const charges: BillCharge[] = [];
  const push = (ch: BillCharge) => {
    if (n(ch.amount) > 0) charges.push({ ...ch, amount: r2(ch.amount) });
  };

  // ---------------------------------------------------------------- 1. ROOM CHARGES
  const reqs: AnyRec[] = Array.isArray(b?.requirements) ? b!.requirements : [];
  if (c && Array.isArray(c.bookedRooms) && c.bookedRooms.length > 0 && c.isGroupCheckIn) {
    c.bookedRooms.forEach((br: AnyRec, i: number) => {
      const rate = n(br.rate) || roomRateOf(String(br.roomNumber));
      push({ id: `room-${br.roomNumber || i}`, kind: 'room', description: 'Room Charges', amount: rate * nights, rate, nights, roomNumber: String(br.roomNumber || primaryRoom), sourceKey: `room:${br.roomNumber || i}` });
      if (br.hasExtraBed) {
        const cnt = n(br.extraBedCount) || 1;
        const er = n(br.extraBedRate);
        push({ id: `xbed-${br.roomNumber || i}`, kind: 'extra_bed', description: `Extra Bed (${cnt} x ${er} x ${nights}N)`, amount: cnt * er * nights, roomNumber: String(br.roomNumber || primaryRoom), sourceKey: `xbed:${br.roomNumber || i}` });
      }
    });
  } else if (c && n(c.roomRate) > 0) {
    const rate = n(c.roomRate);
    push({ id: `room-${primaryRoom}`, kind: 'room', description: 'Room Charges', amount: rate * nights, rate, nights, roomNumber: primaryRoom, sourceKey: `room:${primaryRoom}` });
  } else if (reqs.length > 0) {
    let base = 0;
    reqs.forEach((r, i) => {
      const assigned: string[] = Array.isArray(r.assignedRooms) && r.assignedRooms.length ? r.assignedRooms : [primaryRoom];
      const perRoomCount = Math.max(1, assigned.length || n(r.qty));
      const rate = n(r.unitPrice);
      assigned.slice(0, perRoomCount).forEach((rn: string) => {
        base += rate * nights;
        push({ id: `room-${rn || i}`, kind: 'room', description: 'Room Charges', amount: rate * nights, rate, nights, roomNumber: String(rn || primaryRoom), sourceKey: `room:${rn || i}` });
      });
    });
    const recorded = n(b?.roomSubtotal);
    if (recorded > r2(base) + 0.5) {
      push({ id: `xpax-${b?.id}`, kind: 'extra_person', description: 'Extra Person / Extra Bed Charges', amount: recorded - base, roomNumber: primaryRoom, sourceKey: `xpax:${b?.id}` });
    }
  } else if (b && Array.isArray(b.bookedRooms) && b.bookedRooms.length > 0) {
    b.bookedRooms.forEach((br: AnyRec, i: number) => {
      const rate = n(br.rate) || roomRateOf(String(br.roomNumber));
      push({ id: `room-${br.roomNumber || i}`, kind: 'room', description: 'Room Charges', amount: rate * nights, rate, nights, roomNumber: String(br.roomNumber || primaryRoom), sourceKey: `room:${br.roomNumber || i}` });
    });
  } else if (b) {
    const total = n(b.roomSubtotal ?? b.bookingAmount) || roomRateOf(primaryRoom) * nights;
    push({ id: `room-${primaryRoom}`, kind: 'room', description: 'Room Charges', amount: total, rate: r2(total / nights), nights, roomNumber: primaryRoom, sourceKey: `room:${primaryRoom}` });
  }

  // Extra bed / extra person / early check-in (single-room check-in or legacy booking)
  if (c && !c.isGroupCheckIn) {
    if (c.hasExtraBed) {
      const cnt = n(c.extraBedCount) || 1;
      const er = n(c.extraBedRate);
      push({ id: `xbed-${c.id}`, kind: 'extra_bed', description: `Extra Bed (${cnt} x ${er} x ${nights}N)`, amount: cnt * er * nights, roomNumber: primaryRoom, sourceKey: `xbed:${primaryRoom}` });
    }
    if (n(c.extraPersonChargeApplied) > 0) {
      push({ id: `xpax-${c.id}`, kind: 'extra_person', description: 'Extra Person Charges', amount: n(c.extraPersonChargeApplied), roomNumber: primaryRoom, sourceKey: `xpax:${c.id}` });
    }
  } else if (!c && b && b.hasExtraBed && reqs.length === 0) {
    const cnt = n(b.extraBedCount) || 1;
    const er = n(b.extraBedRate);
    push({ id: `xbed-${b.id}`, kind: 'extra_bed', description: `Extra Bed (${cnt} x ${er} x ${nights}N)`, amount: cnt * er * nights, roomNumber: primaryRoom, sourceKey: `xbed:${primaryRoom}` });
  }
  const early = n(c?.earlyCheckInCharge ?? b?.earlyCheckInCharge);
  if (early > 0) {
    push({ id: `early-${c?.id || b?.id}`, kind: 'early_checkin', description: 'Early Check-In Charges', amount: early, roomNumber: primaryRoom, sourceKey: `early:${c?.id || b?.id}` });
  }

  // ---------------------------------------------------------------- 2. FOLIO ITEMS
  const belongsToStay = (rec: AnyRec): boolean => {
    const ids = [rec.bookingId, rec.checkInId, rec.checkinId].filter(Boolean).map(String);
    if (ids.length > 0) return ids.some((id) => stayIds.includes(id));
    // No explicit link: same room AND date inside the stay window AND (if both known) same guest
    const rn = String(rec.roomNumber || '');
    if (!rn || !roomNumbers.includes(rn)) return false;
    const d = String(rec.date || rec.createdAt || rec.dateTime || '').slice(0, 10);
    if (d && checkInDate && d < checkInDate) return false;
    if (d && checkOutDate && d > checkOutDate) return false;
    const g = String(rec.guestName || rec.customerName || '').toLowerCase().trim();
    const stayGuest = String(c?.guestName || b?.guestName || b?.customerName || '').toLowerCase().trim();
    if (g && stayGuest && g.length > 1 && !g.includes(stayGuest) && !stayGuest.includes(g)) return false;
    return true;
  };

  // 2a. POS orders (accurate pre-tax) — first, so they win de-dup
  (input.posOrders || []).forEach((po) => {
    if (!po || isPaidAtCounter(po) || !belongsToStay(po)) return;
    if (String(po.status || '').toLowerCase() === 'cancelled') return;
    const items = Array.isArray(po.items)
      ? po.items.map((it: AnyRec) => `${n(it.quantity ?? it.qty) || 1}x ${it.itemName || it.name || 'Item'}`).join(', ')
      : '';
    push({
      id: String(po.id || po.orderNumber),
      kind: 'food',
      description: `Food & Beverage — Order #${po.orderNumber || po.id}${items ? ` (${items})` : ''}${po.isWithoutGst ? ' [GST Exempt]' : ''}`,
      amount: posPreTax(po, po.isWithoutGst ? 0 : s.foodGstRate),
      date: String(po.date || po.createdAt || po.dateTime || '').slice(0, 10),
      roomNumber: String(po.roomNumber || primaryRoom),
      sourceKey: `pos:${po.id || po.orderNumber}`,
      gstExempt: Boolean(po.isWithoutGst),
    });
  });

  // 2b. Water bottles & service allocations (record = source of truth, so edits reflect)
  (input.waterBottles || []).forEach((wb) => {
    if (!wb || wb.recordType === 'service_catalog' || !belongsToStay(wb)) return;
    if (wb.recordType === 'service_allocation') {
      if (wb.isChargeable === false) return;
      const amt = n(wb.chargeAmount ?? wb.configuredAmount);
      push({ id: String(wb.id), kind: 'service', description: String(wb.serviceName || 'Extra Service'), amount: amt, date: String(wb.date || '').slice(0, 10), roomNumber: String(wb.roomNumber || primaryRoom), sourceKey: `id:${wb.id}` });
      return;
    }
    const qty = n(wb.quantity) || n(wb.extraChargeableCount);
    const chargeable = wb.isChargeable === true || n(wb.extraChargeableCount) > 0;
    if (!chargeable) return;
    const amt = n(wb.chargeAmount ?? wb.totalAmount ?? wb.totalCharge);
    const rate = n(wb.unitPrice ?? wb.ratePerBottle) || (qty > 0 ? r2(amt / qty) : 0);
    push({
      id: String(wb.id),
      kind: 'water',
      description: `Water Bottles (${qty} x ${rate})`,
      amount: amt,
      quantity: qty,
      rate,
      date: String(wb.date || '').slice(0, 10),
      roomNumber: String(wb.roomNumber || primaryRoom),
      sourceKey: `water:${wb.id}`,
    });
  });

  // 2c. Guest laundry billed to room
  (input.laundryOrders || []).forEach((lo) => {
    if (!lo || lo.orderType === 'Hotel Linen Laundry' || !belongsToStay(lo)) return;
    if (String(lo.paymentStatus || '').toLowerCase() === 'paid' && !String(lo.paymentStatus).toLowerCase().includes('room')) return;
    if (String(lo.paymentStatus || '').toLowerCase().includes('complimentary')) return;
    push({
      id: String(lo.id || lo.orderNumber),
      kind: 'laundry',
      description: `Laundry — Order #${lo.orderNumber || lo.id}`,
      amount: n(lo.totalAmount),
      date: String(lo.date || '').slice(0, 10),
      roomNumber: String(lo.roomNumber || primaryRoom),
      sourceKey: `laundry:${lo.id || lo.orderNumber}`,
    });
  });

  // 2d. Legacy check-in folio extraCharges
  (Array.isArray(c?.extraCharges) ? c!.extraCharges : []).forEach((ec: AnyRec) => {
    if (!ec) return;
    const kind = kindFromLabel(ec.category, ec.sourceType, undefined, ec.description);
    const key = sourceKeyFromId(ec.id, ec.sourceType, ec.sourceId) || `id:${ec.id}`;
    const ecNoGst = Boolean(ec.isWithoutGst || ec.gstExempt || /\[GST Exempt\]/i.test(String(ec.description || '')));
    // POS folio lines carry GST-inclusive grand total unless explicitly marked GST-exempt
    const amount =
      kind === 'food' && !ecNoGst && s.foodGstRate > 0
        ? ec.taxAmount !== undefined && n(ec.taxAmount) >= 0
          ? r2(Math.max(0, n(ec.amount) - n(ec.taxAmount)))
          : r2(n(ec.amount) / (1 + s.foodGstRate / 100))
        : n(ec.amount);
    push({
      id: String(ec.id),
      kind,
      description: String(ec.description || ec.category || 'Charge'),
      amount,
      date: String(ec.date || ec.dateTime || '').slice(0, 10),
      roomNumber: primaryRoom,
      sourceKey: key,
      gstExempt: ecNoGst,
    });
  });

  // 2e. /admin hub booking services (deduped by id, so the old C1 double entries collapse)
  (Array.isArray(b?.otherServices) ? b!.otherServices : []).forEach((sv: AnyRec) => {
    if (!sv) return;
    const kind = kindFromLabel(undefined, undefined, sv.serviceType, sv.description);
    const id = String(sv.id || sv.orderNumber || '');
    const fromEc = sourceKeyFromId(id);
    const key =
      fromEc ||
      (kind === 'food' ? `pos:${id}` : kind === 'laundry' ? `laundry:${id}` : kind === 'water' ? `water:${id}` : `id:${id}`);
    const amount =
      kind === 'food'
        ? n(sv.taxAmount) > 0
          ? r2(n(sv.amount) - n(sv.taxAmount))
          : s.foodGstRate > 0 && /^POS|ORD|KOT/i.test(String(sv.orderNumber || ''))
          ? r2(n(sv.amount) / (1 + s.foodGstRate / 100))
          : n(sv.amount)
        : n(sv.amount);
    push({ id, kind, description: String(sv.description || sv.itemsSummary || sv.serviceType || 'Service'), amount, date: String(sv.dateTime || '').slice(0, 10), roomNumber: String(sv.roomNumber || primaryRoom), sourceKey: key });
  });

  // 2f. Brand-new checkout charges
  (input.additionalCharges || []).forEach((ch) => push(ch));

  // ---------------------------------------------------------------- 3. PAYMENTS
  const payments: BillPayment[] = [];
  const seenPay = new Set<string>();
  const addPay = (p: BillPayment) => {
    if (!p || n(p.amount) === 0) return;
    const key = p.id || `${p.date}|${p.amount}|${p.method}`;
    if (seenPay.has(key)) return;
    seenPay.add(key);
    payments.push({ ...p, amount: r2(p.amount) });
  };
  const hubPayments: AnyRec[] = Array.isArray(b?.payments) ? b!.payments : [];
  if (hubPayments.length > 0) {
    hubPayments.forEach((p, i) =>
      addPay({ id: String(p.id || `bp-${i}`), amount: n(p.amount), method: String(p.paymentMethod || p.method || 'Cash'), date: String(p.date || p.dateTime || '').slice(0, 10), reference: p.transactionId || p.reference, note: p.notes })
    );
    // Check-in payments made in legacy screens after the hub list was saved
    (Array.isArray(c?.payments) ? c!.payments : []).forEach((p: AnyRec, i: number) => {
      if (p.paymentType === 'Advance Deposit') return;
      addPay({ id: String(p.id || `cp-${i}`), amount: n(p.amount), method: String(p.paymentMethod || p.method || 'Cash'), date: String(p.dateTime || p.date || '').slice(0, 10), reference: p.reference, note: p.notes });
    });
  } else {
    const deskPaid = (n(c?.cashAmountPaid) + n(c?.onlineAmountPaid)) > 0
      ? n(c?.cashAmountPaid) + n(c?.onlineAmountPaid)
      : undefined;
    const advance = n(
      c?.advanceAmount && n(c.advanceAmount) > 0
        ? c.advanceAmount
        : c?.advancePayment && n(c.advancePayment) > 0
        ? c.advancePayment
        : c?.advancePaid && n(c.advancePaid) > 0
        ? c.advancePaid
        : deskPaid !== undefined
        ? deskPaid
        : b?.advanceAmount
    );
    const resolvedMethod = String(
      c?.paymentMethod ||
      (n(c?.onlineAmountPaid) > 0 ? 'UPI' : n(c?.cashAmountPaid) > 0 ? 'Cash' : b?.paymentMethod || 'Cash')
    );
    // Hybrid / split advance: when several 'Advance Deposit' records (one per mode) add up to the advance,
    // list each mode separately instead of one lump-sum advance.
    const advSplitRecs: AnyRec[] = (Array.isArray(c?.payments) ? c!.payments : []).filter(
      (p: AnyRec) => p && p.paymentType === 'Advance Deposit' && n(p.amount) > 0
    );
    const advSplitSum = advSplitRecs.reduce((s: number, p: AnyRec) => s + n(p.amount), 0);
    if (advance > 0 && advSplitRecs.length >= 1 && Math.abs(advSplitSum - advance) < 1) {
      advSplitRecs.forEach((p: AnyRec, i: number) =>
        addPay({
          id: String(p.id || `adv-split-${i}`),
          amount: n(p.amount),
          method: String(p.paymentMethod || p.method || resolvedMethod),
          date: String(p.date || p.dateTime || b?.bookingDate || checkInDate || '').slice(0, 10),
          reference: p.referenceNo || p.reference,
          note: p.notes || 'Advance',
        })
      );
    } else if (advance > 0) {
      addPay({ id: `adv-${c?.id || b?.id}`, amount: advance, method: resolvedMethod, date: String(b?.bookingDate || checkInDate || '').slice(0, 10), note: 'Advance' });
    }
    (Array.isArray(c?.payments) ? c!.payments : []).forEach((p: AnyRec, i: number) => {
      if (p.paymentType === 'Advance Deposit') return;
      addPay({ id: String(p.id || `cp-${i}`), amount: n(p.amount), method: String(p.paymentMethod || p.method || 'Cash'), date: String(p.date || p.dateTime || '').slice(0, 10), reference: p.referenceNo || p.reference, note: p.notes });
    });
    if (n(b?.refundAmount) > 0) {
      addPay({ id: `ref-${b?.id}`, amount: -n(b?.refundAmount), method: String(b?.paymentMethod || 'Cash'), date: checkOutDate, note: 'Refund' });
    }
  }
  (input.additionalPayments || []).forEach(addPay);

  // ---------------------------------------------------------------- 4. GST TICK & DISCOUNT
  const explicitNoGst =
    b?.isWithoutGst === true ||
    c?.isWithoutGst === true ||
    b?.gstInvoice === false ||
    (b?.gstRate !== undefined && b?.gstRate !== null && n(b.gstRate) <= 0 && b?.gstInvoice !== true) ||
    (c?.gstRate !== undefined && c?.gstRate !== null && n(c.gstRate) <= 0);
  const gstEnabled = input.gstEnabledOverride !== undefined ? input.gstEnabledOverride : !explicitNoGst && s.roomGstRate > 0;

  const discount =
    input.discountOverride !== undefined
      ? n(input.discountOverride)
      : n(b?.discountAmount ?? c?.discount ?? c?.discountAmount ?? b?.discount);

  return {
    charges,
    payments,
    gstEnabled,
    discount: Math.max(0, r2(discount)),
    roomNumbers,
    nights,
    checkInDate,
    checkOutDate,
    stayIds,
  };
}
