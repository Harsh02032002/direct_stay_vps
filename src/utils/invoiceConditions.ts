import {
  Booking,
  ExtraCharge,
  GuestCheckIn,
  HotelSettings,
  Invoice,
  InvoiceConditionsConfig,
  LaundryOrder,
  PaymentRecord,
  PosOrder,
  Room,
  WaterBottleRecord,
} from '../types';
import {
  BillCharge,
  BillPayment,
  BillSettings,
  calculateBill,
  normalizeBillSettings,
  r2,
} from './billCalculator';
import { collectStayCharges, stayNights } from './folioCollector';
import { allocateInvoiceNumber, buildInvoiceRecord, buildStayBill } from './stayBilling';

export const DEFAULT_INVOICE_CONDITIONS: InvoiceConditionsConfig = {
  // 1. Invoice Generation Trigger
  triggerEvent: 'checkin',
  // 2. Booking Status Condition
  allowedBookingStatuses: ['Confirmed', 'Checked In', 'CheckedOut'],
  // 3. Payment Status Condition
  allowedPaymentStatuses: ['Unpaid', 'Partially Paid', 'Paid'],
  // 4. Check-in / Check-out Condition
  requireCheckIn: false,
  requireCheckOutForFinal: true,
  // 5. Minimum Amount Condition
  minimumAmountEnabled: false,
  minimumInvoiceAmount: 0,
  // 6. Automatic / Manual Invoice Generation
  generationMode: 'auto_and_manual',
  autoGenerateOnCheckout: true,
  // 7. Duplicate Invoice Prevention
  preventDuplicateFinalInvoice: true,
  // 8. Tax Calculation Condition
  applyTax: true,
  defaultGstRate: 5,
  splitCgstSgst: true,
  taxOnRoom: true,
  taxOnExtraBed: true,
  taxOnFood: true,
  taxOnAncillary: true,
};

export function normalizeInvoiceConditions(
  raw?: Partial<InvoiceConditionsConfig> | null,
  hotelSettings?: Partial<HotelSettings> | null
): InvoiceConditionsConfig {
  const hasHotelGstEnabled = hotelSettings?.isGstEnabled !== undefined;
  const hotelGstEnabled = hotelSettings?.isGstEnabled !== false;
  const hasHotelDefaultRate =
    hotelSettings?.defaultGstRate !== undefined &&
    Number.isFinite(Number(hotelSettings.defaultGstRate));
  const hotelDefaultRate = hasHotelDefaultRate
    ? Number(hotelSettings!.defaultGstRate)
    : DEFAULT_INVOICE_CONDITIONS.defaultGstRate;

  const resolvedApplyTax = hasHotelGstEnabled
    ? hotelGstEnabled
    : raw?.applyTax !== undefined
    ? Boolean(raw.applyTax)
    : hotelGstEnabled;

  const resolvedDefaultGstRate = !resolvedApplyTax
    ? 0
    : hasHotelDefaultRate
    ? Math.max(0, Math.min(100, hotelDefaultRate))
    : raw?.defaultGstRate !== undefined && Number.isFinite(Number(raw.defaultGstRate))
    ? Math.max(0, Math.min(100, Number(raw.defaultGstRate)))
    : Math.max(0, Math.min(100, hotelDefaultRate));

  return {
    triggerEvent: raw?.triggerEvent || DEFAULT_INVOICE_CONDITIONS.triggerEvent,
    allowedBookingStatuses:
      Array.isArray(raw?.allowedBookingStatuses) && raw!.allowedBookingStatuses.length > 0
        ? raw!.allowedBookingStatuses
        : DEFAULT_INVOICE_CONDITIONS.allowedBookingStatuses,
    allowedPaymentStatuses:
      Array.isArray(raw?.allowedPaymentStatuses) && raw!.allowedPaymentStatuses.length > 0
        ? raw!.allowedPaymentStatuses
        : DEFAULT_INVOICE_CONDITIONS.allowedPaymentStatuses,
    requireCheckIn:
      raw?.requireCheckIn !== undefined
        ? Boolean(raw.requireCheckIn)
        : DEFAULT_INVOICE_CONDITIONS.requireCheckIn,
    requireCheckOutForFinal:
      raw?.requireCheckOutForFinal !== undefined
        ? Boolean(raw.requireCheckOutForFinal)
        : DEFAULT_INVOICE_CONDITIONS.requireCheckOutForFinal,
    minimumAmountEnabled:
      raw?.minimumAmountEnabled !== undefined
        ? Boolean(raw.minimumAmountEnabled)
        : DEFAULT_INVOICE_CONDITIONS.minimumAmountEnabled,
    minimumInvoiceAmount: Math.max(0, Number(raw?.minimumInvoiceAmount ?? 0) || 0),
    generationMode: raw?.generationMode || DEFAULT_INVOICE_CONDITIONS.generationMode,
    autoGenerateOnCheckout:
      raw?.autoGenerateOnCheckout !== undefined
        ? Boolean(raw.autoGenerateOnCheckout)
        : DEFAULT_INVOICE_CONDITIONS.autoGenerateOnCheckout,
    preventDuplicateFinalInvoice:
      raw?.preventDuplicateFinalInvoice !== undefined
        ? Boolean(raw.preventDuplicateFinalInvoice)
        : DEFAULT_INVOICE_CONDITIONS.preventDuplicateFinalInvoice,
    applyTax: resolvedApplyTax,
    defaultGstRate: resolvedDefaultGstRate,
    splitCgstSgst:
      raw?.splitCgstSgst !== undefined
        ? Boolean(raw.splitCgstSgst)
        : DEFAULT_INVOICE_CONDITIONS.splitCgstSgst,
    taxOnRoom: raw?.taxOnRoom !== undefined ? Boolean(raw.taxOnRoom) : true,
    taxOnExtraBed: raw?.taxOnExtraBed !== undefined ? Boolean(raw.taxOnExtraBed) : true,
    taxOnFood: raw?.taxOnFood !== undefined ? Boolean(raw.taxOnFood) : true,
    taxOnAncillary: raw?.taxOnAncillary !== undefined ? Boolean(raw.taxOnAncillary) : true,
  };
}

export function calculateStayNights(checkInDate?: string, checkOutDate?: string): number {
  if (!checkInDate || !checkOutDate) return 1;
  const d1 = new Date(checkInDate);
  const d2 = new Date(checkOutDate);
  const diff = Math.abs(d2.getTime() - d1.getTime());
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return isNaN(days) || days <= 0 ? 1 : days;
}

export function deduplicateStayExtraCharges(rawCharges: ExtraCharge[] = []): ExtraCharge[] {
  const seenIds = new Set<string>();
  const seenSources = new Set<string>();
  const result: ExtraCharge[] = [];
  for (const ec of rawCharges) {
    if (!ec || !(Number(ec.amount) > 0)) continue;
    const cid = String(ec.id || '').trim();
    const srcKey = ec.sourceType && ec.sourceId ? `${ec.sourceType}:${ec.sourceId}` : '';
    if (cid && seenIds.has(cid)) continue;
    if (srcKey && seenSources.has(srcKey)) continue;
    if (cid) seenIds.add(cid);
    if (srcKey) seenSources.add(srcKey);
    result.push(ec);
  }
  return result;
}

/**
 * Computes verified advance and partial payments without creating or counting duplicate payment records.
 * Ignores any non-payment marker records (such as "Marked as Due").
 */
export function computeVerifiedPaymentsTotal(params: {
  checkin?: GuestCheckIn | null;
  booking?: Booking | null;
  overrideAdvancePaid?: number;
  additionalSettlementNow?: number;
}): {
  verifiedPaidAmount: number;
  deduplicatedPayments: PaymentRecord[];
} {
  const { checkin, booking, overrideAdvancePaid, additionalSettlementNow = 0 } = params;

  const rawPayments: PaymentRecord[] = Array.isArray(checkin?.payments) ? checkin!.payments! : [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const deduplicatedPayments: PaymentRecord[] = [];

  for (const p of rawPayments) {
    if (!p || !(Number(p.amount) > 0)) continue;
    const notesLower = String(p.notes || '').toLowerCase();
    // Never count a "Marked as Due" placeholder note as a received payment
    if (notesLower.includes('marked as due')) continue;

    const pid = String(p.id || '').trim();
    const fingerprint = `${p.paymentType || ''}:${Number(p.amount)}:${String(p.dateTime || '').slice(0, 16)}:${p.paymentMethod || ''}`;
    if (pid && seenIds.has(pid)) continue;
    if (seenFingerprints.has(fingerprint)) continue;
    if (pid) seenIds.add(pid);
    seenFingerprints.add(fingerprint);
    deduplicatedPayments.push(p);
  }

  if (overrideAdvancePaid !== undefined && Number.isFinite(Number(overrideAdvancePaid))) {
    const cleanOverride = Math.max(0, parseFloat(Number(overrideAdvancePaid).toFixed(2)));
    return {
      verifiedPaidAmount: cleanOverride,
      deduplicatedPayments,
    };
  }

  if (checkin) {
    const baseAdvance = Math.max(0, Number(checkin.advanceAmount) || 0);
    if (deduplicatedPayments.length > 0) {
      const nonAdvanceSum = deduplicatedPayments
        .filter((p) => p.paymentType !== 'Advance Deposit')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const total = parseFloat((baseAdvance + nonAdvanceSum + Math.max(0, Number(additionalSettlementNow) || 0)).toFixed(2));
      return { verifiedPaidAmount: total, deduplicatedPayments };
    }
    const fallbackPaid =
      baseAdvance +
      Math.max(0, Number(checkin.cashAmountPaid) || 0) +
      Math.max(0, Number(checkin.onlineAmountPaid) || 0) +
      Math.max(0, Number(additionalSettlementNow) || 0);
    return {
      verifiedPaidAmount: parseFloat(fallbackPaid.toFixed(2)),
      deduplicatedPayments,
    };
  }

  if (booking) {
    const bAdv = Math.max(0, Number(booking.advanceAmount) || 0) + Math.max(0, Number(additionalSettlementNow) || 0);
    return {
      verifiedPaidAmount: parseFloat(bAdv.toFixed(2)),
      deduplicatedPayments,
    };
  }

  return {
    verifiedPaidAmount: Math.max(0, parseFloat(Number(additionalSettlementNow || 0).toFixed(2))),
    deduplicatedPayments,
  };
}

export interface InvoiceConditionCheckResult {
  conditionNumber: number;
  conditionName: string;
  passed: boolean;
  reason: string;
}

export interface EvaluateInvoiceInput {
  hotelId?: string;
  hotelSettings?: Partial<HotelSettings> | null;
  conditions?: Partial<InvoiceConditionsConfig> | null;
  booking?: Booking | null;
  checkin?: GuestCheckIn | null;
  rooms?: Room[];
  posOrders?: PosOrder[];
  laundryOrders?: LaundryOrder[];
  waterBottles?: WaterBottleRecord[];
  taxSettings?: Record<string, any> | null;
  existingInvoices?: Invoice[];
  generationMethod?: 'automatic' | 'manual';
  triggerContext?: 'checkout' | 'checkin' | 'booking_confirmation' | 'manual';
  // Aliases supported for caller convenience
  isManualAction?: boolean;
  isCheckoutTrigger?: boolean;
  invoiceType?: 'Booking Invoice' | 'Stay Checkout Invoice' | 'Proforma Invoice' | 'Tax Invoice' | 'Bill of Supply';
  isFinalInvoiceRequest?: boolean;
  // Optional overrides from manual or checkout form
  overrideGuestName?: string;
  overrideMobile?: string;
  overrideRoomNumber?: string;
  overrideCheckInDate?: string;
  overrideCheckOutDate?: string;
  overrideRoomCharges?: number;
  overrideExtraBedCharges?: number;
  overrideExtraPersonCharges?: number;
  overrideFoodCharges?: number;
  overrideWaterOrLaundryCharges?: number;
  overrideOtherCharges?: number;
  overrideDiscount?: number;
  overrideGstRate?: number;
  overrideAdvancePaid?: number;
  additionalSettlementNow?: number;
  overridePaymentMethod?: string;
  overrideInvoiceType?: 'Booking Invoice' | 'Stay Checkout Invoice' | 'Proforma Invoice' | 'Tax Invoice' | 'Bill of Supply';
  overrideNotes?: string;
  allowUpdateExistingFinalOnCheckout?: boolean;
  createSeparateInvoice?: boolean;
  parentInvoiceId?: string;
}

export interface EvaluateInvoiceOutput {
  allowed: boolean;
  duplicatePrevented: boolean;
  updatedExistingInvoice: boolean;
  blockedReason?: string;
  blockingReasons: string[];
  conditionResults: InvoiceConditionCheckResult[];
  taxBreakdown: {
    taxableAmount: number;
    gstRate: number;
    cgstRate: number;
    sgstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    totalTax: number;
  };
  invoice?: Invoice;
  existingInvoice?: Invoice;
}

/**
 * Centralized 8-Condition Invoice Evaluation & Single-Invoice Builder Engine.
 * Used identically on both Frontend and Backend.
 */
export function evaluateAndBuildInvoice(rawInput: EvaluateInvoiceInput): EvaluateInvoiceOutput {
  const resolvedGenMethod: 'automatic' | 'manual' =
    rawInput.generationMethod ||
    (rawInput.isManualAction ? 'manual' : 'automatic');
  const resolvedTriggerContext: 'checkout' | 'checkin' | 'booking_confirmation' | 'manual' =
    rawInput.triggerContext ||
    (rawInput.isCheckoutTrigger
      ? 'checkout'
      : rawInput.isManualAction
      ? 'manual'
      : rawInput.checkin
      ? rawInput.checkin.checkedOutDateTime
        ? 'checkout'
        : 'checkin'
      : 'booking_confirmation');
  const resolvedOverrideInvoiceType =
    rawInput.overrideInvoiceType || rawInput.invoiceType;

  const input = {
    ...rawInput,
    generationMethod: resolvedGenMethod,
    triggerContext: resolvedTriggerContext,
    overrideInvoiceType: resolvedOverrideInvoiceType,
  };

  const config = normalizeInvoiceConditions(
    input.conditions || input.hotelSettings?.invoiceConditions,
    input.hotelSettings
  );
  const { booking, checkin, rooms = [], existingInvoices = [] } = input;
  const conditionResults: InvoiceConditionCheckResult[] = [];

  const targetBookingId = String(
    checkin?.id || booking?.id || ''
  ).trim();
  const effectiveHotelId = String(
    input.hotelId || checkin?.hotelId || booking?.hotelId || input.hotelSettings?.id || 'hotel-1'
  ).trim();

  // Determine whether this is a final invoice request
  const isFinalRequest =
    input.isFinalInvoiceRequest !== undefined
      ? input.isFinalInvoiceRequest
      : input.triggerContext === 'checkout' ||
        Boolean(checkin?.checkedOutDateTime) ||
        String(booking?.status || '').toLowerCase() === 'checkedout' ||
        input.overrideInvoiceType === 'Tax Invoice' ||
        input.overrideInvoiceType === 'Stay Checkout Invoice';

  // =========================================================================
  // CONDITION 7: DUPLICATE INVOICE PREVENTION LOOKUP
  // =========================================================================
  const matchingInvoices =
    targetBookingId && !input.createSeparateInvoice
      ? existingInvoices.filter(
          (inv) =>
            inv &&
            !inv.isSeparateInvoice &&
            !inv.isSuperseded &&
            !(inv as any).isCreditNote &&
            inv.invoiceType !== 'Credit Note' &&
            inv.invoiceStatus !== 'Superseded' &&
            inv.invoiceStatus !== 'Cancelled' &&
            (!inv.hotelId || !effectiveHotelId || inv.hotelId === effectiveHotelId) &&
            (inv.bookingId === targetBookingId || (inv.checkInId && inv.checkInId === targetBookingId))
        )
      : [];

  const existingFinalInv = input.createSeparateInvoice
    ? undefined
    : matchingInvoices.find(
        (inv) =>
          inv.invoiceStatus === 'Finalized' ||
          inv.isFinalInvoice === true ||
          inv.invoiceType === 'Tax Invoice' ||
          inv.invoiceType === 'Stay Checkout Invoice' ||
          inv.invoiceType === 'Bill of Supply'
      );
  const existingAnyInv = input.createSeparateInvoice
    ? undefined
    : existingFinalInv || matchingInvoices[0] || undefined;

  // =========================================================================
  // CONDITION 2: BOOKING STATUS CONDITION
  // =========================================================================
  let effectiveBookingStatus = 'Confirmed';
  if (booking?.status === 'Cancelled') {
    effectiveBookingStatus = 'Cancelled';
  } else if (
    input.triggerContext === 'checkout' ||
    Boolean(checkin?.checkedOutDateTime) ||
    String(booking?.status || '').toLowerCase() === 'checkedout' ||
    Boolean(booking?.isCompleted)
  ) {
    effectiveBookingStatus = 'CheckedOut';
  } else if (
    Boolean(checkin) ||
    Boolean(booking?.isCheckedIn) ||
    booking?.status === 'Checked In' ||
    input.triggerContext === 'checkin'
  ) {
    effectiveBookingStatus = 'Checked In';
  } else if (booking?.status) {
    effectiveBookingStatus = booking.status;
  }

  const isGuestCheckedIn =
    Boolean(checkin) ||
    Boolean(booking?.isCheckedIn) ||
    booking?.status === 'Checked In' ||
    effectiveBookingStatus === 'Checked In' ||
    effectiveBookingStatus === 'CheckedOut' ||
    input.triggerContext === 'checkin' ||
    input.triggerContext === 'checkout';

  const isGuestCheckedOut =
    effectiveBookingStatus === 'CheckedOut' ||
    Boolean(checkin?.checkedOutDateTime) ||
    Boolean(booking?.isCompleted) ||
    input.triggerContext === 'checkout';

  // =========================================================================
  // CONDITION 1: INVOICE GENERATION TRIGGER
  // =========================================================================
  let cond1Passed = true;
  let cond1Reason = `Trigger '${input.triggerContext}' satisfies configured trigger '${config.triggerEvent}'.`;

  if (config.triggerEvent === 'manual_only' && input.generationMethod === 'automatic') {
    cond1Passed = false;
    cond1Reason = 'Invoice Generation Trigger is set to Manual Only; automatic invoice generation is disabled.';
  } else if (config.triggerEvent === 'checkout' && isFinalRequest && !isGuestCheckedOut && Boolean(booking || checkin)) {
    cond1Passed = false;
    cond1Reason = 'Invoice Generation Trigger is configured for Checkout, and guest has not checked out yet.';
  } else if (config.triggerEvent === 'checkin' && !isGuestCheckedIn && Boolean(booking || checkin)) {
    cond1Passed = false;
    cond1Reason = 'Invoice Generation Trigger requires Check-In or Checkout before generating an invoice.';
  }
  conditionResults.push({
    conditionNumber: 1,
    conditionName: 'Invoice Generation Trigger',
    passed: cond1Passed,
    reason: cond1Reason,
  });

  const allowedStatusesNorm = config.allowedBookingStatuses.map((s) => s.toLowerCase().trim());
  const statusNorm = effectiveBookingStatus.toLowerCase().trim();
  const cond2Passed =
    statusNorm !== 'cancelled' &&
    (allowedStatusesNorm.includes(statusNorm) ||
      (statusNorm === 'checkedout' && allowedStatusesNorm.includes('checked out')) ||
      (statusNorm === 'checked in' && allowedStatusesNorm.includes('checkedin')));

  const cond2Reason = cond2Passed
    ? `Booking status '${effectiveBookingStatus}' is permitted.`
    : `Booking Status Condition not met: status is '${effectiveBookingStatus}', allowed statuses are [${config.allowedBookingStatuses.join(', ')}].`;

  conditionResults.push({
    conditionNumber: 2,
    conditionName: 'Booking Status Condition',
    passed: cond2Passed,
    reason: cond2Reason,
  });

  // =========================================================================
  // CONDITION 4: CHECK-IN / CHECK-OUT CONDITION & STAY BILLING AGGREGATION
  // =========================================================================
  let cond4Passed = true;
  let cond4Reason = 'Check-in / Check-out status validated for billing.';

  if (config.requireCheckIn && !isGuestCheckedIn && Boolean(booking || checkin)) {
    cond4Passed = false;
    cond4Reason = 'Check-in Condition failed: Guest must be checked in before generating an invoice.';
  } else if (
    config.requireCheckOutForFinal &&
    isFinalRequest &&
    !isGuestCheckedOut &&
    Boolean(booking || checkin)
  ) {
    cond4Passed = false;
    cond4Reason = 'Check-out Condition failed: Final invoice requires guest check-out.';
  }

  conditionResults.push({
    conditionNumber: 4,
    conditionName: 'Check-in / Check-out Condition',
    passed: cond4Passed,
    reason: cond4Reason,
  });

  // =========================================================================
  // CALCULATE STAY CHARGES & CONDITION 8: TAX CALCULATION CONDITION
  // (Single Source of Truth: buildStayBill / calculateBill + buildInvoiceRecord)
  // =========================================================================
  const todayIso = new Date().toISOString().split('T')[0];
  const checkInDate =
    input.overrideCheckInDate || checkin?.checkInDate || booking?.checkInDate || todayIso;
  const checkOutDate =
    input.overrideCheckOutDate || checkin?.checkOutDate || booking?.checkOutDate || todayIso;
  const nights =
    booking?.nights && !checkin && !input.overrideCheckInDate && !input.overrideCheckOutDate
      ? Math.max(1, Number(booking.nights) || 1)
      : stayNights(checkInDate, checkOutDate);

  const roomNumber =
    input.overrideRoomNumber || checkin?.roomNumber || booking?.roomNumber || '101';
  const guestName =
    input.overrideGuestName || checkin?.guestName || booking?.guestName || 'Guest';
  const guestMobile =
    input.overrideMobile ?? checkin?.mobile ?? booking?.mobile ?? '';

  const baseBillSettings = normalizeBillSettings(
    input.taxSettings,
    input.hotelSettings,
    {
      taxOnAncillary:
        input.hotelSettings?.taxOnAncillary !== undefined
          ? Boolean(input.hotelSettings.taxOnAncillary)
          : config.taxOnAncillary,
    }
  );

  // Condition 8: Tax Calculation Condition
  // IMMUTABILITY RULE: Once an invoice is generated (existingAnyInv exists & !createSeparateInvoice),
  // its GST / No-GST mode and GST rate CANNOT be edited on that invoice. A separate invoice must be created instead.
  let effectiveGstRate = 0;
  if (existingAnyInv && !input.createSeparateInvoice) {
    const existingLockedWithoutGst =
      existingAnyInv.isWithoutGst === true ||
      (existingAnyInv.gstRate !== undefined && Number(existingAnyInv.gstRate) <= 0) ||
      (existingAnyInv.gstRate === undefined && Number(existingAnyInv.gst || 0) <= 0);
    effectiveGstRate = existingLockedWithoutGst
      ? 0
      : Math.max(
          0.01,
          Math.min(
            100,
            Number(existingAnyInv.gstRate) ||
              baseBillSettings.roomGstRate ||
              Number(config.defaultGstRate) ||
              5
          )
        );
  } else if (input.overrideGstRate !== undefined && Number.isFinite(Number(input.overrideGstRate))) {
    effectiveGstRate = Math.max(0, Math.min(100, Number(input.overrideGstRate)));
  } else if (checkin?.isWithoutGst === true || (checkin?.gstRate !== undefined && Number(checkin.gstRate) <= 0)) {
    effectiveGstRate = 0;
  } else if (checkin?.gstRate !== undefined && Number.isFinite(Number(checkin.gstRate))) {
    effectiveGstRate = Math.max(0, Math.min(100, Number(checkin.gstRate)));
  } else if (booking?.isWithoutGst === true || (booking?.gstRate !== undefined && Number(booking.gstRate) <= 0)) {
    effectiveGstRate = 0;
  } else if (booking?.gstRate !== undefined && Number.isFinite(Number(booking.gstRate))) {
    effectiveGstRate = Math.max(0, Math.min(100, Number(booking.gstRate)));
  } else if (!config.applyTax) {
    effectiveGstRate = 0;
  } else if (baseBillSettings.roomGstRate > 0) {
    effectiveGstRate = Math.max(0, Math.min(100, baseBillSettings.roomGstRate));
  } else if (config.defaultGstRate !== undefined && Number.isFinite(Number(config.defaultGstRate))) {
    effectiveGstRate = Math.max(0, Math.min(100, Number(config.defaultGstRate)));
  } else {
    effectiveGstRate = 5;
  }

  const shouldApplyTax =
    effectiveGstRate > 0 &&
    (config.applyTax ||
      Boolean(existingAnyInv && !input.createSeparateInvoice) ||
      (input.overrideGstRate !== undefined && Number(input.overrideGstRate) > 0));

  const effectiveSettings: BillSettings = {
    ...baseBillSettings,
    roomGstRate: config.taxOnRoom === false ? 0 : shouldApplyTax ? effectiveGstRate : 0,
    foodGstRate:
      config.taxOnFood === false
        ? 0
        : shouldApplyTax
        ? input.overrideGstRate !== undefined && Number.isFinite(Number(input.overrideGstRate))
          ? effectiveGstRate
          : baseBillSettings.foodGstRate > 0
          ? baseBillSettings.foodGstRate
          : effectiveGstRate
        : 0,
    taxOnAncillary: config.taxOnAncillary === false ? false : baseBillSettings.taxOnAncillary,
  };

  // Prepare folio inputs (ensuring fallback roomRate / non-due payments / legacy bookedServices)
  const fallbackRoomRate =
    rooms.find((r) => r.number === roomNumber || (booking?.roomType && r.category === booking.roomType))?.rate ||
    2000;

  const checkinForFolio: GuestCheckIn | null = checkin
    ? {
        ...checkin,
        roomNumber,
        checkInDate,
        checkOutDate,
        roomRate:
          checkin.isGroupCheckIn && Array.isArray(checkin.bookedRooms) && checkin.bookedRooms.length > 0
            ? checkin.roomRate
            : Number(checkin.roomRate) > 0
            ? Number(checkin.roomRate)
            : fallbackRoomRate,
        payments: Array.isArray(checkin.payments)
          ? checkin.payments.filter(
              (p) => p && Number(p.amount) > 0 && !String(p.notes || '').toLowerCase().includes('marked as due')
            )
          : undefined,
      }
    : null;

  const bookingForFolio: Booking | null = booking
    ? {
        ...booking,
        roomNumber: input.overrideRoomNumber || booking.roomNumber,
        checkInDate,
        checkOutDate,
        nights,
        bookingAmount:
          Number(booking.bookingAmount) > 0 ||
          Number((booking as any).roomSubtotal) > 0 ||
          (Array.isArray((booking as any).requirements) && (booking as any).requirements.length > 0) ||
          (Array.isArray(booking.bookedRooms) && booking.bookedRooms.length > 0)
            ? booking.bookingAmount
            : fallbackRoomRate * nights,
      }
    : null;

  const extraFolioCharges: BillCharge[] = [];
  if (!checkinForFolio && bookingForFolio && Array.isArray(bookingForFolio.bookedServices)) {
    bookingForFolio.bookedServices.forEach((sv, idx) => {
      if (sv && Number(sv.amount) > 0) {
        extraFolioCharges.push({
          id: `bsvc-${sv.serviceId || idx}`,
          kind: 'service',
          description: sv.serviceName || 'Booked Service',
          amount: Number(sv.amount),
          roomNumber,
          sourceKey: `bsvc:${sv.serviceId || idx}`,
        });
      }
    });
  }

  const extraFolioPayments: BillPayment[] = [];
  if (
    checkinForFolio &&
    (!Array.isArray(checkinForFolio.payments) || checkinForFolio.payments.length === 0)
  ) {
    const deskPaid =
      Math.max(0, Number(checkinForFolio.cashAmountPaid) || 0) +
      Math.max(0, Number(checkinForFolio.onlineAmountPaid) || 0);
    if (deskPaid > 0) {
      extraFolioPayments.push({
        id: `desk-${checkinForFolio.id}`,
        amount: r2(deskPaid),
        method: String(checkinForFolio.paymentMethod || 'Cash'),
        date: checkInDate,
        note: 'Check-In Desk Payment',
      });
    }
  }
  if (
    input.overrideAdvancePaid === undefined &&
    input.additionalSettlementNow !== undefined &&
    Number(input.additionalSettlementNow) > 0
  ) {
    extraFolioPayments.push({
      id: `settle-${Date.now()}`,
      amount: r2(Math.max(0, Number(input.additionalSettlementNow))),
      method: String(
        input.overridePaymentMethod ||
          checkin?.paymentMethod ||
          booking?.paymentMethod ||
          'Cash'
      ),
      date: todayIso,
      note: 'Settlement',
    });
  }

  const stayBill = buildStayBill({
    booking: bookingForFolio,
    checkin: checkinForFolio,
    posOrders: input.posOrders,
    laundryOrders: input.laundryOrders,
    waterBottles: input.waterBottles,
    rooms,
    settings: effectiveSettings,
    additionalCharges: extraFolioCharges,
    additionalPayments: extraFolioPayments,
    gstEnabledOverride: shouldApplyTax,
    discountOverride:
      input.overrideDiscount !== undefined && Number.isFinite(Number(input.overrideDiscount))
        ? Math.max(0, Number(input.overrideDiscount))
        : undefined,
  });

  const hasChargeOverrides =
    (input.overrideRoomCharges !== undefined && Number.isFinite(Number(input.overrideRoomCharges))) ||
    (input.overrideExtraBedCharges !== undefined && Number.isFinite(Number(input.overrideExtraBedCharges))) ||
    (input.overrideExtraPersonCharges !== undefined && Number.isFinite(Number(input.overrideExtraPersonCharges))) ||
    (input.overrideFoodCharges !== undefined && Number.isFinite(Number(input.overrideFoodCharges))) ||
    (input.overrideWaterOrLaundryCharges !== undefined && Number.isFinite(Number(input.overrideWaterOrLaundryCharges))) ||
    (input.overrideOtherCharges !== undefined && Number.isFinite(Number(input.overrideOtherCharges)));
  const hasPaymentOverride =
    input.overrideAdvancePaid !== undefined && Number.isFinite(Number(input.overrideAdvancePaid));

  let finalBill = stayBill.bill;
  if (hasChargeOverrides || hasPaymentOverride) {
    let adjustedCharges = [...stayBill.folio.charges];
    let adjustedPayments = [...stayBill.folio.payments];

    if (input.overrideRoomCharges !== undefined && Number.isFinite(Number(input.overrideRoomCharges))) {
      adjustedCharges = adjustedCharges.filter((ch) => ch.kind !== 'room');
      const amt = Math.max(0, Number(input.overrideRoomCharges));
      if (amt > 0) {
        adjustedCharges.push({
          id: `ovr-room-${roomNumber}`,
          kind: 'room',
          description: 'Room Charges',
          amount: amt,
          rate: r2(amt / Math.max(1, nights)),
          nights,
          roomNumber,
          sourceKey: `ovr-room:${roomNumber}`,
        });
      }
    }

    if (input.overrideExtraBedCharges !== undefined && Number.isFinite(Number(input.overrideExtraBedCharges))) {
      adjustedCharges = adjustedCharges.filter((ch) => ch.kind !== 'extra_bed');
      const amt = Math.max(0, Number(input.overrideExtraBedCharges));
      if (amt > 0) {
        adjustedCharges.push({
          id: `ovr-xbed-${roomNumber}`,
          kind: 'extra_bed',
          description: 'Extra Bed Charges',
          amount: amt,
          roomNumber,
          sourceKey: `ovr-xbed:${roomNumber}`,
        });
      }
    }

    if (input.overrideExtraPersonCharges !== undefined && Number.isFinite(Number(input.overrideExtraPersonCharges))) {
      adjustedCharges = adjustedCharges.filter((ch) => ch.kind !== 'extra_person');
      const amt = Math.max(0, Number(input.overrideExtraPersonCharges));
      if (amt > 0) {
        adjustedCharges.push({
          id: `ovr-xpax-${roomNumber}`,
          kind: 'extra_person',
          description: 'Extra Person Charges',
          amount: amt,
          roomNumber,
          sourceKey: `ovr-xpax:${roomNumber}`,
        });
      }
    }

    if (input.overrideFoodCharges !== undefined && Number.isFinite(Number(input.overrideFoodCharges))) {
      adjustedCharges = adjustedCharges.filter((ch) => ch.kind !== 'food');
      const amt = Math.max(0, Number(input.overrideFoodCharges));
      if (amt > 0) {
        adjustedCharges.push({
          id: `ovr-food-${roomNumber}`,
          kind: 'food',
          description: 'Food & Restaurant Charges',
          amount: amt,
          roomNumber,
          sourceKey: `ovr-food:${roomNumber}`,
        });
      }
    }

    if (
      input.overrideWaterOrLaundryCharges !== undefined &&
      Number.isFinite(Number(input.overrideWaterOrLaundryCharges))
    ) {
      adjustedCharges = adjustedCharges.filter((ch) => ch.kind !== 'water' && ch.kind !== 'laundry');
      const amt = Math.max(0, Number(input.overrideWaterOrLaundryCharges));
      if (amt > 0) {
        adjustedCharges.push({
          id: `ovr-water-${roomNumber}`,
          kind: 'water',
          description: 'Water / Laundry Charges',
          amount: amt,
          roomNumber,
          sourceKey: `ovr-water:${roomNumber}`,
        });
      }
    }

    if (input.overrideOtherCharges !== undefined && Number.isFinite(Number(input.overrideOtherCharges))) {
      adjustedCharges = adjustedCharges.filter(
        (ch) => ch.kind !== 'service' && ch.kind !== 'other' && ch.kind !== 'fine'
      );
      const amt = Math.max(0, Number(input.overrideOtherCharges));
      if (amt > 0) {
        adjustedCharges.push({
          id: `ovr-other-${roomNumber}`,
          kind: 'other',
          description: 'Other Services / Misc Charges',
          amount: amt,
          roomNumber,
          sourceKey: `ovr-other:${roomNumber}`,
        });
      }
    }

    if (hasPaymentOverride) {
      const cleanPaid = r2(Math.max(0, Number(input.overrideAdvancePaid)));
      adjustedPayments =
        cleanPaid > 0
          ? [
              {
                id: 'ovr-paid',
                amount: cleanPaid,
                method: String(
                  input.overridePaymentMethod ||
                    checkin?.paymentMethod ||
                    booking?.paymentMethod ||
                    'Cash'
                ),
                date: todayIso,
                note: 'Advance / Paid',
              },
            ]
          : [];
    }

    // If caller passed explicit overrideRoomCharges, treat that override amount as pre-tax unless no override was passed
    const overrideBillSettings: BillSettings =
      input.overrideRoomCharges !== undefined
        ? { ...effectiveSettings, roomRateIncludesGst: false }
        : effectiveSettings;

    finalBill = calculateBill({
      charges: adjustedCharges,
      payments: adjustedPayments,
      discount: stayBill.folio.discount,
      gstEnabled: shouldApplyTax,
      settings: overrideBillSettings,
    });
  }

  let extraBedCount = 0;
  let extraBedRate = 500;
  if (checkin) {
    if (checkin.isGroupCheckIn && Array.isArray(checkin.bookedRooms) && checkin.bookedRooms.length > 0) {
      checkin.bookedRooms.forEach((br) => {
        if (br.hasExtraBed) {
          extraBedCount += Number(br.extraBedCount || 1);
          extraBedRate = Number(br.extraBedRate || 500);
        }
      });
    } else if (checkin.hasExtraBed) {
      extraBedCount = Number(checkin.extraBedCount || 1);
      extraBedRate = Number(checkin.extraBedRate || 500);
    }
  } else if (booking?.hasExtraBed) {
    extraBedCount = Number(booking.extraBedCount || 1);
    extraBedRate = Number(booking.extraBedRate || 500);
  }
  if (extraBedCount === 0 && finalBill.legacy.extraBedCharges > 0) {
    extraBedCount = 1;
  }

  const netTaxableAmount = finalBill.taxableAmount;
  const gst = finalBill.totalTax;
  const cgst = config.splitCgstSgst ? finalBill.cgst : 0;
  const sgst = config.splitCgstSgst ? finalBill.sgst : 0;
  const finalAmount = finalBill.grandTotal;
  const verifiedPaidAmount = finalBill.receipts;
  const pendingAmount = finalBill.balance;
  const computedPaymentStatus = finalBill.paymentStatus;
  const isPaid = computedPaymentStatus === 'Paid';

  conditionResults.push({
    conditionNumber: 8,
    conditionName: 'Tax Calculation Condition',
    passed: true,
    reason: shouldApplyTax
      ? `Tax calculated at ${finalBill.headlineGstRate}% on taxable base ₹${netTaxableAmount} -> GST ₹${gst} (CGST ₹${cgst} + SGST ₹${sgst}).`
      : 'Tax disabled by configuration or No-GST mode (GST ₹0).',
  });

  // =========================================================================
  // CONDITION 3: PAYMENT STATUS CONDITION (SEPARATE FROM INVOICE STATUS)
  // =========================================================================
  const hasPaymentFailure =
    booking?.paymentStatus === 'Payment Failed';

  const cond3Passed =
    !hasPaymentFailure &&
    config.allowedPaymentStatuses.includes(computedPaymentStatus);

  const cond3Reason = hasPaymentFailure
    ? 'Payment Status Condition failed: Booking has an unresolved Payment Failure.'
    : cond3Passed
    ? `Payment status '${computedPaymentStatus}' (Paid: ₹${verifiedPaidAmount}, Due: ₹${pendingAmount}) is allowed.`
    : `Payment Status Condition failed: Payment status is '${computedPaymentStatus}', but configuration requires [${config.allowedPaymentStatuses.join(', ')}].`;

  conditionResults.push({
    conditionNumber: 3,
    conditionName: 'Payment Status Condition',
    passed: cond3Passed,
    reason: cond3Reason,
  });

  // =========================================================================
  // CONDITION 5: MINIMUM AMOUNT CONDITION
  // =========================================================================
  const cond5Passed =
    !config.minimumAmountEnabled || finalAmount >= config.minimumInvoiceAmount;
  const cond5Reason = !config.minimumAmountEnabled
    ? 'Minimum Amount Condition is disabled.'
    : cond5Passed
    ? `Invoice total ₹${finalAmount} meets minimum threshold ₹${config.minimumInvoiceAmount}.`
    : `Minimum Amount Condition failed: Invoice total ₹${finalAmount} is below minimum required amount ₹${config.minimumInvoiceAmount}.`;

  conditionResults.push({
    conditionNumber: 5,
    conditionName: 'Minimum Amount Condition',
    passed: cond5Passed,
    reason: cond5Reason,
  });

  // =========================================================================
  // CONDITION 6: AUTOMATIC / MANUAL INVOICE GENERATION MODE
  // =========================================================================
  let cond6Passed = true;
  let cond6Reason = `Generation method '${input.generationMethod}' is permitted under mode '${config.generationMode}'.`;
  if (input.generationMethod === 'automatic' && config.generationMode === 'manual_only') {
    cond6Passed = false;
    cond6Reason = 'Automatic invoice generation is disabled (Mode: Manual Only).';
  } else if (
    input.generationMethod === 'automatic' &&
    input.triggerContext === 'checkout' &&
    !config.autoGenerateOnCheckout
  ) {
    cond6Passed = false;
    cond6Reason = 'Automatic invoice generation on checkout is disabled in Invoice Conditions.';
  } else if (input.generationMethod === 'manual' && config.generationMode === 'auto_only') {
    cond6Passed = false;
    cond6Reason = 'Manual invoice generation is disabled (Mode: Automatic Only).';
  }

  conditionResults.push({
    conditionNumber: 6,
    conditionName: 'Automatic / Manual Invoice Generation',
    passed: cond6Passed,
    reason: cond6Reason,
  });

  // Record Condition 7 result
  // Strictly finalized invoices (isFinalInvoice === true or invoiceStatus === 'Finalized') are IMMUTABLE.
  // Provisional / draft invoices (invoiceStatus === 'Generated' && !isFinalInvoice) may be upgraded to Finalized on checkout.
  const isStrictlyFinalized =
    Boolean(existingFinalInv) &&
    (existingFinalInv!.isFinalInvoice === true ||
      existingFinalInv!.invoiceStatus === 'Finalized');

  const isAlreadyFinalized =
    isStrictlyFinalized ||
    (Boolean(existingFinalInv) &&
      (existingFinalInv!.invoiceType === 'Tax Invoice' ||
        existingFinalInv!.invoiceType === 'Stay Checkout Invoice'));

  conditionResults.push({
    conditionNumber: 7,
    conditionName: 'Duplicate Invoice Prevention',
    passed: true,
    reason:
      isStrictlyFinalized && !input.createSeparateInvoice
        ? `Finalized invoice ${existingFinalInv!.invoiceNumber} is immutable and cannot be overwritten. Use a separate adjustment/credit invoice workflow for authorized corrections.`
        : config.preventDuplicateFinalInvoice && isAlreadyFinalized && !input.allowUpdateExistingFinalOnCheckout
        ? `Final invoice ${existingFinalInv!.invoiceNumber} already exists for booking/stay ${targetBookingId}. Returning existing invoice without creating a duplicate.`
        : existingAnyInv
        ? `Existing provisional invoice ${existingAnyInv.invoiceNumber} will be updated in-place to prevent duplicate invoices for booking/stay ${targetBookingId}.`
        : `No existing invoice found for booking/stay ${targetBookingId || 'direct'}; safe to create single invoice.`,
  });

  // Sort conditionResults 1..8 for clear reporting
  conditionResults.sort((a, b) => a.conditionNumber - b.conditionNumber);

  const blockingReasons = conditionResults
    .filter((c) => !c.passed)
    .map((c) => `Condition ${c.conditionNumber} (${c.conditionName}): ${c.reason}`);

  const headlineRate = shouldApplyTax ? finalBill.headlineGstRate || effectiveGstRate : 0;
  const taxBreakdown = {
    taxableAmount: netTaxableAmount,
    gstRate: headlineRate,
    cgstRate: config.splitCgstSgst ? r2(headlineRate / 2) : 0,
    sgstRate: config.splitCgstSgst ? r2(headlineRate / 2) : 0,
    cgstAmount: cgst,
    sgstAmount: sgst,
    totalTax: gst,
  };

  // HARD IMMUTABILITY GUARD: Strictly finalized invoices can NEVER be overwritten in-place,
  // even if allowUpdateExistingFinalOnCheckout is passed. Authorized corrections must use createSeparateInvoice.
  if (isStrictlyFinalized && existingFinalInv && !input.createSeparateInvoice) {
    return {
      allowed: true,
      duplicatePrevented: true,
      updatedExistingInvoice: false,
      blockingReasons: [],
      conditionResults,
      taxBreakdown,
      invoice: existingFinalInv,
      existingInvoice: existingFinalInv,
    };
  }

  // If a final invoice already exists and duplicate prevention is enabled, return the existing invoice
  if (
    config.preventDuplicateFinalInvoice &&
    isAlreadyFinalized &&
    existingFinalInv &&
    !input.allowUpdateExistingFinalOnCheckout
  ) {
    return {
      allowed: true,
      duplicatePrevented: true,
      updatedExistingInvoice: false,
      blockingReasons: [],
      conditionResults,
      taxBreakdown,
      invoice: existingFinalInv,
      existingInvoice: existingFinalInv,
    };
  }

  const firstFailed = conditionResults.find((c) => !c.passed);
  if (firstFailed) {
    return {
      allowed: false,
      duplicatePrevented: false,
      updatedExistingInvoice: false,
      blockedReason: firstFailed.reason,
      blockingReasons,
      conditionResults,
      taxBreakdown,
      existingInvoice: existingAnyInv,
    };
  }

  // =========================================================================
  // CONSTRUCT SINGLE AUTHORITATIVE INVOICE OBJECT (PREFIX/1014/2026-27)
  // =========================================================================
  const allocated = allocateInvoiceNumber(existingInvoices, baseBillSettings);
  const invoiceNumber =
    (!input.createSeparateInvoice && existingAnyInv?.invoiceNumber) ||
    allocated.invoiceNumber;
  const baseStayInvoiceId = targetBookingId ? `INV-STAY-${targetBookingId}` : `INV-${Date.now()}`;
  const baseIdAlreadyExists = existingInvoices.some((inv) => inv && inv.id === baseStayInvoiceId);
  const invoiceId = input.createSeparateInvoice
    ? `INV-SEP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
    : existingAnyInv?.id ||
      (baseIdAlreadyExists ? `${baseStayInvoiceId}-R${Date.now()}` : baseStayInvoiceId);

  const isWithoutGst = !finalBill.isGstInvoice;
  const resolvedInvoiceType =
    input.overrideInvoiceType ||
    (existingAnyInv?.invoiceType && !input.createSeparateInvoice
      ? existingAnyInv.invoiceType
      : isWithoutGst
      ? 'Bill of Supply'
      : isFinalRequest
      ? 'Tax Invoice'
      : 'Booking Invoice');

  const resolvedInvoiceStatus: 'Draft' | 'Generated' | 'Finalized' | 'Cancelled' =
    isFinalRequest ? 'Finalized' : 'Generated';

  const resolvedRoomNumbers = input.overrideRoomNumber
    ? input.overrideRoomNumber
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : stayBill.folio.roomNumbers.length > 0
    ? stayBill.folio.roomNumbers
    : [roomNumber];

  const guestAddressParts = [
    checkin?.address || booking?.address,
    [checkin?.city || (booking as any)?.city, checkin?.state || (booking as any)?.state]
      .filter(Boolean)
      .join(', '),
    (checkin as any)?.pincode || (booking as any)?.pincode,
  ]
    .filter(Boolean)
    .join('\n');

  const recordFromBill = buildInvoiceRecord({
    id: invoiceId,
    invoiceNumber,
    hotelId: effectiveHotelId,
    bookingId: targetBookingId || `BKG-DIR-${Date.now()}`,
    checkInId: checkin?.id || existingAnyInv?.checkInId,
    guestName,
    guestMobile,
    guestAddress: guestAddressParts || existingAnyInv?.guestAddress,
    companyName: checkin?.companyName || (booking as any)?.companyName || existingAnyInv?.companyName,
    guestGstNumber: checkin?.gstNumber || booking?.gstNumber || existingAnyInv?.guestGstNumber,
    roomNumbers: resolvedRoomNumbers,
    checkInDate,
    checkOutDate,
    nights,
    bill: finalBill,
    paymentMethod:
      input.overridePaymentMethod ||
      (checkin?.paymentMethod as any) ||
      (booking?.paymentMethod as any) ||
      existingAnyInv?.paymentMethod ||
      'UPI',
    isSeparateInvoice: input.createSeparateInvoice ? true : existingAnyInv?.isSeparateInvoice,
    parentInvoiceId: input.parentInvoiceId || existingAnyInv?.parentInvoiceId,
    dateCreated: (!input.createSeparateInvoice && existingAnyInv?.dateCreated) || todayIso,
    invoiceStatus: resolvedInvoiceStatus,
  });

  const builtInvoice: Invoice = {
    ...(existingAnyInv && !input.createSeparateInvoice ? existingAnyInv : {}),
    ...(recordFromBill as Invoice),
    cgst,
    sgst,
    gst,
    extraBedCount,
    extraBedRate,
    isGroupCheckIn: checkin?.isGroupCheckIn ?? existingAnyInv?.isGroupCheckIn,
    groupBookingId: checkin?.groupBookingId ?? existingAnyInv?.groupBookingId,
    bookedRooms: checkin?.bookedRooms ?? existingAnyInv?.bookedRooms,
    amountPaid: verifiedPaidAmount,
    outstandingAmount: pendingAmount,
    invoiceType: resolvedInvoiceType,
    invoiceStatus: resolvedInvoiceStatus,
    isFinalInvoice: isFinalRequest,
    isPaid,
    notes: input.overrideNotes !== undefined ? input.overrideNotes : existingAnyInv?.notes,
  };

  return {
    allowed: true,
    duplicatePrevented: false,
    updatedExistingInvoice: Boolean(existingAnyInv && !input.createSeparateInvoice),
    blockingReasons: [],
    conditionResults,
    taxBreakdown,
    invoice: builtInvoice,
    existingInvoice: existingAnyInv,
  };
}

/**
 * Deduplicates an array of invoices by (hotelId, bookingId) for automatic stay syncs,
 * while strictly preserving separate manually-generated invoices (`isSeparateInvoice === true`
 * or distinct invoices with different GST modes).
 */
export function deduplicateInvoicesByBooking(invoices: Invoice[] = []): Invoice[] {
  const byKey = new Map<string, Invoice>();
  const resultOrder: string[] = [];

  const isInvWithoutGst = (inv: Invoice): boolean =>
    inv.isWithoutGst === true ||
    (inv.gstRate !== undefined && Number(inv.gstRate) <= 0) ||
    (inv.gstRate === undefined && Number(inv.gst || 0) <= 0);

  for (const inv of invoices) {
    if (!inv || !inv.id) continue;
    const bId = String(inv.bookingId || inv.checkInId || '').trim();
    const hId = String(inv.hotelId || 'hotel-1').trim();
    const isSupersededOrCancelled =
      Boolean(inv.isSuperseded) ||
      Boolean((inv as any).isCreditNote) ||
      inv.invoiceType === 'Credit Note' ||
      inv.invoiceStatus === 'Superseded' ||
      inv.invoiceStatus === 'Cancelled';
    const isSep =
      isSupersededOrCancelled ||
      Boolean(inv.isSeparateInvoice) ||
      String(inv.id).startsWith('INV-SEP-') ||
      String(inv.id).startsWith('CN-');
    let key = isSep || !bId ? `${hId}::id::${inv.id}` : `${hId}::booking::${bId}`;

    if (byKey.has(key)) {
      const prev = byKey.get(key)!;
      // Never collapse two distinct invoice IDs that have different GST modes (With GST vs No GST)
      if (prev.id !== inv.id && isInvWithoutGst(prev) !== isInvWithoutGst(inv)) {
        key = `${hId}::id::${inv.id}`;
      }
    }

    if (!byKey.has(key)) {
      byKey.set(key, inv);
      resultOrder.push(key);
    } else {
      const prev = byKey.get(key)!;
      const prevIsFinal =
        prev.invoiceStatus === 'Finalized' ||
        prev.isFinalInvoice === true ||
        prev.invoiceType === 'Tax Invoice' ||
        prev.invoiceType === 'Bill of Supply';
      const currIsFinal =
        inv.invoiceStatus === 'Finalized' ||
        inv.isFinalInvoice === true ||
        inv.invoiceType === 'Tax Invoice' ||
        inv.invoiceType === 'Bill of Supply';

      if (currIsFinal && !prevIsFinal) {
        byKey.set(key, {
          ...prev,
          ...inv,
          id: prev.id || inv.id,
          invoiceNumber: prev.invoiceNumber || inv.invoiceNumber,
        });
      } else if (currIsFinal === prevIsFinal) {
        byKey.set(key, {
          ...prev,
          ...inv,
          id: prev.id || inv.id,
          invoiceNumber: prev.invoiceNumber || inv.invoiceNumber,
        });
      }
    }
  }

  return resultOrder.map((k) => byKey.get(k)!);
}
