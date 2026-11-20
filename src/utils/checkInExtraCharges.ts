import { BillCharge, BillSettings, calculateBill, r2 } from './billCalculator';

export interface ExtraChargeOptionInput {
  enabled: boolean;
  quantity: number;
  ratePerNight: number;
  applicableNights: number;
}

export interface CheckInExtraChargesResult {
  extraPersonActive: boolean;
  extraPersonQty: number;
  extraPersonRate: number;
  extraPersonNights: number;
  extraPersonTotal: number;

  extraBedActive: boolean;
  extraBedQty: number;
  extraBedRate: number;
  extraBedNights: number;
  extraBedTotal: number;

  combinedExtrasTotal: number;
  charges: BillCharge[];
}

/**
 * Pure calculation for Check-In Extra Person & Extra Bed/Mattress options:
 * 1. Both options are independent checkboxes (OFF by default).
 * 2. When unchecked, total is strictly 0 and no charge line is emitted.
 * 3. When checked, total = quantity * ratePerNight * applicableNights (supports manual rate override including 0).
 * 4. When both are checked, both charges are calculated and emitted separately without duplication.
 */
export function calculateCheckInExtraCharges(params: {
  extraPerson: ExtraChargeOptionInput;
  extraBed: ExtraChargeOptionInput;
  roomNumber?: string;
}): CheckInExtraChargesResult {
  const { extraPerson, extraBed, roomNumber = '' } = params;

  const extraPersonActive = Boolean(extraPerson.enabled);
  const extraPersonQty = extraPersonActive
    ? Math.max(1, Math.floor(Number(extraPerson.quantity) || 1))
    : 0;
  const extraPersonRate = extraPersonActive
    ? r2(Math.max(0, Number(extraPerson.ratePerNight) || 0))
    : 0;
  const extraPersonNights = extraPersonActive
    ? Math.max(1, Math.floor(Number(extraPerson.applicableNights) || 1))
    : 0;
  const extraPersonTotal = extraPersonActive
    ? r2(extraPersonQty * extraPersonRate * extraPersonNights)
    : 0;

  const extraBedActive = Boolean(extraBed.enabled);
  const extraBedQty = extraBedActive
    ? Math.max(1, Math.floor(Number(extraBed.quantity) || 1))
    : 0;
  const extraBedRate = extraBedActive
    ? r2(Math.max(0, Number(extraBed.ratePerNight) || 0))
    : 0;
  const extraBedNights = extraBedActive
    ? Math.max(1, Math.floor(Number(extraBed.applicableNights) || 1))
    : 0;
  const extraBedTotal = extraBedActive
    ? r2(extraBedQty * extraBedRate * extraBedNights)
    : 0;

  const charges: BillCharge[] = [];
  if (extraPersonActive && extraPersonTotal > 0) {
    charges.push({
      id: 'ci-xpax',
      kind: 'extra_person',
      description: `Extra Person (${extraPersonQty} × ₹${extraPersonRate} × ${extraPersonNights}N)`,
      amount: extraPersonTotal,
      roomNumber,
      sourceKey: `xpax:${roomNumber || 'stay'}`,
    });
  }
  if (extraBedActive && extraBedTotal > 0) {
    charges.push({
      id: 'ci-xbed',
      kind: 'extra_bed',
      description: `Extra Bed / Mattress (${extraBedQty} × ₹${extraBedRate} × ${extraBedNights}N)`,
      amount: extraBedTotal,
      roomNumber,
      sourceKey: `xbed:${roomNumber || 'stay'}`,
    });
  }

  return {
    extraPersonActive,
    extraPersonQty,
    extraPersonRate,
    extraPersonNights,
    extraPersonTotal,
    extraBedActive,
    extraBedQty,
    extraBedRate,
    extraBedNights,
    extraBedTotal,
    combinedExtrasTotal: r2(extraPersonTotal + extraBedTotal),
    charges,
  };
}

export function previewCheckInSettlementWithExtras(params: {
  roomRatePerNight: number;
  stayNights: number;
  roomNumber?: string;
  extraPerson: ExtraChargeOptionInput;
  extraBed: ExtraChargeOptionInput;
  otherCharges?: BillCharge[];
  discount?: number;
  gstPercent: number;
  advancePaid?: number;
  paidNow?: number;
  settings: BillSettings;
}) {
  const nights = Math.max(1, Math.floor(Number(params.stayNights) || 1));
  const roomTotal = r2(Math.max(0, Number(params.roomRatePerNight) || 0) * nights);
  const extras = calculateCheckInExtraCharges({
    extraPerson: params.extraPerson,
    extraBed: params.extraBed,
    roomNumber: params.roomNumber,
  });

  const allCharges: BillCharge[] = [
    ...(roomTotal > 0
      ? [
          {
            id: 'ci-room',
            kind: 'room' as const,
            description: 'Room Charges',
            amount: roomTotal,
            rate: Number(params.roomRatePerNight) || 0,
            nights,
            roomNumber: params.roomNumber || '101',
          },
        ]
      : []),
    ...extras.charges,
    ...(params.otherCharges || []),
  ];

  const payments = [
    ...(Number(params.advancePaid) > 0
      ? [{ id: 'adv', amount: Number(params.advancePaid), method: 'Advance' }]
      : []),
    ...(Number(params.paidNow) > 0
      ? [{ id: 'paid', amount: Number(params.paidNow), method: 'Cash' }]
      : []),
  ];

  const gstEnabled = Number(params.gstPercent) > 0;
  const effectiveSettings: BillSettings = gstEnabled
    ? { ...params.settings, roomGstRate: Number(params.gstPercent) }
    : { ...params.settings, roomGstRate: 0, foodGstRate: 0 };

  const bill = calculateBill({
    charges: allCharges,
    payments,
    discount: Math.max(0, Number(params.discount) || 0),
    gstEnabled,
    settings: effectiveSettings,
  });

  return {
    roomTotal,
    extras,
    subtotalBeforeTax: bill.subtotal,
    gstAmount: bill.totalTax,
    finalSettlement: bill.grandTotal,
    totalPaid: bill.receipts,
    pendingBalance: bill.balance,
    bill,
  };
}
