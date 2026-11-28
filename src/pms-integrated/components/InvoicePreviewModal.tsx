import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, Download, Phone, Lock, FilePlus2 } from 'lucide-react';
import { BookingRecord, InvoiceRecord, InvoiceScope } from '../types';
import { openWhatsAppChat } from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import {
  amountToIndianWords,
  BillChargeKind,
  BillLedgerLine,
  BillPayment,
  BillResult,
  BillSettings,
  BillTaxRow,
  calculateBill,
  formatDateLabel,
  formatMoney,
  normalizeBillSettings,
  r2,
} from '../../utils/billCalculator';
import {
  buildStayBill,
  isActiveInvoice,
  reconcileScopedStayInvoice,
  resolveConsistentInvoiceTotals,
  resolveInvoiceScope,
  toInvoicePrintData,
} from '../../utils/stayBilling';
import { renderInvoiceHtml } from '../../utils/printTemplates';
import { openPrintWindow } from '../../utils/printDocument';
import {
  extractDetailedFoodLinesForStay,
  FOOD_LINE_REGEX,
  isGenericFoodSummaryLine,
} from '../../utils/pdfDownload';

interface InvoicePreviewModalProps {
  booking: BookingRecord | null;
  invoiceScope: InvoiceScope;
  invoiceRecord?: InvoiceRecord | null;
  rawInvoice?: Record<string, any> | null;
  rawBooking?: Record<string, any> | null;
  rawCheckin?: Record<string, any> | null;
  posOrders?: Record<string, any>[];
  laundryOrders?: Record<string, any>[];
  waterBottles?: Record<string, any>[];
  rooms?: Record<string, any>[];
  allInvoices?: InvoiceRecord[];
  hotelProfile: Record<string, any>;
  hotelSettings?: Record<string, any>;
  billSettings?: BillSettings;
  onClose: () => void;
  onCreateSeparateInvoice?: (
    booking: BookingRecord,
    targetWithGst: boolean,
    scope: InvoiceScope,
    confirmedRefundAmount?: number
  ) => void;
}

const ROOM_ONLY_KINDS: BillChargeKind[] = [
  'room',
  'extra_bed',
  'extra_person',
  'early_checkin',
  'late_checkout',
];

function capPaymentsToTarget(payments: BillPayment[], capAmount: number): BillPayment[] {
  let remaining = Math.max(0, r2(capAmount));
  const out: BillPayment[] = [];
  for (const p of payments) {
    const amt = r2(p.amount);
    if (amt < 0) {
      out.push(p);
      continue;
    }
    if (remaining <= 0) break;
    const take = Math.min(amt, remaining);
    if (take > 0) {
      out.push({ ...p, amount: r2(take) });
      remaining = r2(remaining - take);
    }
  }
  return out;
}

function reconstructSavedInvoiceBill(
  inv: Record<string, any>,
  record: InvoiceRecord,
  booking: BookingRecord,
  settings: BillSettings
): BillResult {
  const mergedSource = {
    ...record,
    ...inv,
    taxRows: Array.isArray(inv?.taxRows) && inv.taxRows.length > 0 ? inv.taxRows : record.taxRows,
    paidAmount:
      inv?.paidAmount !== undefined
        ? inv.paidAmount
        : inv?.advancePaid !== undefined
        ? inv.advancePaid
        : record.amountPaid,
  };
  const resolved = resolveConsistentInvoiceTotals(mergedSource, settings.roomGstRate);
  const {
    isNoGst,
    subtotal,
    discount,
    netSubtotal,
    taxableAmount,
    cgst,
    sgst,
    totalTax,
    grandTotal,
    receipts,
    balance,
    refundDue,
    headlineGstRate,
    paymentStatus,
  } = resolved;

  const firstRoom =
    (Array.isArray(record.roomNumbers) && record.roomNumbers[0]) ||
    (Array.isArray(booking.roomNumbers) && booking.roomNumbers[0]) ||
    String(inv?.roomNumber || '');
  const nights = Math.max(1, Number(inv?.nights ?? record.nights ?? booking.nights) || 1);

  const roomCharges = r2(inv?.roomCharges ?? record.roomCharges ?? 0);
  const extraBedCharges = r2(inv?.extraBedCharges ?? record.extraBedCharges ?? 0);
  const extraPersonCharges = r2(inv?.extraPersonCharges ?? record.extraPersonCharges ?? 0);
  const earlyCheckInCharges = r2(inv?.earlyCheckInCharges ?? record.earlyCheckInCharges ?? 0);
  const lateCheckOutCharges = r2(inv?.lateCheckOutCharges ?? record.lateCheckOutCharges ?? 0);
  const foodCharges = r2(inv?.foodCharges ?? record.foodCharges ?? 0);
  const waterCharges = r2(inv?.waterCharges ?? record.waterCharges ?? 0);
  const laundryCharges = r2(inv?.laundryCharges ?? record.laundryCharges ?? 0);
  const serviceCharges = r2(inv?.serviceCharges ?? record.serviceCharges ?? 0);
  const fineCharges = r2(inv?.fineCharges ?? record.fineCharges ?? 0);
  const rawOther = r2(
    (Number(inv?.otherCharges ?? record.otherCharges) || 0) +
      (Number(inv?.extraChargesTotal) || 0) -
      (inv?.fineCharges !== undefined && inv?.otherCharges !== undefined ? 0 : 0)
  );

  // If saved with v2 ledgerLines, reuse exact saved lines & taxRows!
  const savedLines: BillLedgerLine[] | null =
    Array.isArray(inv?.ledgerLines) && inv.ledgerLines.length > 0
      ? inv.ledgerLines
      : Array.isArray(record.ledgerLines) && record.ledgerLines.length > 0
      ? record.ledgerLines
      : null;

  let chargeLines: BillLedgerLine[] = [];
  let lines: BillLedgerLine[] = [];

  if (savedLines) {
    lines = savedLines;
    chargeLines = savedLines.filter((l) => l.type === 'charge');
  } else {
    const pushCharge = (
      kind: BillChargeKind,
      desc: string,
      sac: string,
      amt: number,
      dateLbl = ''
    ) => {
      if (amt > 0) {
        chargeLines.push({
          type: 'charge',
          dateLabel: dateLbl,
          roomNumber: firstRoom,
          description: desc,
          sac,
          charges: r2(amt),
          receipts: 0,
          kind,
        });
      }
    };

    if (roomCharges > 0) {
      pushCharge(
        'room',
        `Room Charges @ ${formatMoney(r2(roomCharges / nights))}`,
        settings.roomSac,
        roomCharges,
        `${nights} Night${nights > 1 ? 's' : ''}`
      );
    }
    pushCharge('extra_bed', 'Extra Bed Charges', settings.roomSac, extraBedCharges);
    pushCharge('extra_person', 'Extra Person Charges', settings.roomSac, extraPersonCharges);
    pushCharge('early_checkin', 'Early Check-In Charges', settings.roomSac, earlyCheckInCharges);
    pushCharge('late_checkout', 'Late Check-Out Charges', settings.roomSac, lateCheckOutCharges);
    pushCharge('food', 'Food & Beverage Charges', settings.foodSac, foodCharges);
    pushCharge('water', 'Mineral Water Charges', settings.otherSac, waterCharges);
    pushCharge('laundry', 'Laundry Charges', settings.laundrySac, laundryCharges);
    pushCharge('service', 'Extra Guest Services', settings.otherSac, serviceCharges);

    const accountedSoFar = r2(chargeLines.reduce((s, l) => s + l.charges, 0));
    const remainingForOther = Math.max(0, r2(subtotal - accountedSoFar));
    if (fineCharges > 0 && rawOther >= fineCharges) {
      pushCharge('other', 'Other Charges', settings.otherSac, Math.max(0, r2(remainingForOther - fineCharges)));
      pushCharge('fine', 'Damage / Fine Charges', '', fineCharges);
    } else if (remainingForOther > 0) {
      pushCharge('other', 'Ancillary / Other Services', settings.otherSac, remainingForOther);
    }

    lines = [...chargeLines];
    if (discount > 0) {
      lines.push({
        type: 'discount',
        dateLabel: '',
        roomNumber: firstRoom,
        description: 'Less: Discount',
        sac: '',
        charges: -discount,
        receipts: 0,
      });
    }
    if (totalTax > 0) {
      const half = r2(headlineGstRate / 2);
      lines.push({
        type: 'tax',
        dateLabel: '',
        roomNumber: firstRoom,
        description: `CGST @ ${half}%`,
        sac: '',
        charges: cgst,
        receipts: 0,
      });
      lines.push({
        type: 'tax',
        dateLabel: '',
        roomNumber: firstRoom,
        description: `SGST @ ${half}%`,
        sac: '',
        charges: sgst,
        receipts: 0,
      });
    }
    if (receipts > 0) {
      lines.push({
        type: 'receipt',
        dateLabel: formatDateLabel(inv?.dateCreated || inv?.date || record.createdAt),
        roomNumber: firstRoom,
        description: `Receipt\n${inv?.paymentMethod || record.paymentMethod || 'Cash'}`,
        sac: '',
        charges: 0,
        receipts,
      });
    }
  }

  const taxRows: BillTaxRow[] =
    Array.isArray(inv?.taxRows) && inv.taxRows.length > 0
      ? inv.taxRows
      : Array.isArray(record.taxRows) && record.taxRows.length > 0
      ? record.taxRows
      : Math.abs(totalTax) > 0
      ? [{ rate: headlineGstRate, taxable: taxableAmount, cgst, sgst, tax: totalTax }]
      : [];

  const extractedPaymentItems: BillPayment[] = resolved.isCreditNote
    ? []
    : Array.isArray(inv?.paymentHistory) && inv.paymentHistory.length > 0
    ? inv.paymentHistory
        .filter((ph: any) => ph && Number(ph.amount || 0) !== 0)
        .map((ph: any, idx: number) => ({
          id: String(ph.id || `ph-${idx}`),
          amount: r2(Number(ph.amount || 0)),
          method: String(ph.paymentMethod || ph.method || 'Cash'),
          date: String(ph.date || ph.dateTime || inv?.dateCreated || '').slice(0, 10),
          reference: ph.referenceNo || ph.reference || undefined,
          note: ph.notes || ph.note || undefined,
        }))
    : lines
        .filter((l) => l.type === 'receipt' && Number(l.receipts || 0) !== 0)
        .map((l, idx) => {
          const parts = String(l.description || '').split(/\n|—/);
          const modePart = parts.length > 1 ? parts[1].trim() : String(inv?.paymentMethod || record.paymentMethod || 'Cash');
          return {
            id: String(l.sourceId || `rcpt-${idx}`),
            amount: r2(Number(l.receipts || 0)),
            method: modePart || 'Cash',
            date: l.dateLabel || inv?.dateCreated || record.createdAt || '',
          };
        });

  return {
    lines,
    chargeLines,
    taxRows,
    paymentItems: extractedPaymentItems,
    totalsByKind: {
      room: roomCharges,
      extra_bed: extraBedCharges,
      extra_person: extraPersonCharges,
      early_checkin: earlyCheckInCharges,
      late_checkout: lateCheckOutCharges,
      food: foodCharges,
      water: waterCharges,
      laundry: laundryCharges,
      service: serviceCharges,
      fine: fineCharges,
      other: Math.max(0, r2(rawOther - fineCharges)),
    },
    subtotal,
    discount,
    netSubtotal,
    taxableAmount,
    cgst,
    sgst,
    totalTax,
    grandTotal,
    receipts,
    balance,
    refundDue,
    paymentStatus,
    isGstInvoice: !isNoGst && Math.abs(totalTax) > 0,
    headlineGstRate: isNoGst ? 0 : headlineGstRate,
    amountInWords: inv?.amountInWords || record.amountInWords || amountToIndianWords(grandTotal),
    legacy: {
      roomCharges,
      extraBedCharges,
      extraPersonCharges,
      earlyCheckInCharges,
      lateCheckOutCharges,
      foodCharges,
      waterCharges,
      laundryCharges,
      serviceCharges,
      fineCharges,
      otherCharges: Math.max(0, r2(rawOther - fineCharges)),
    },
  };
}

export default function InvoicePreviewModal({
  booking,
  invoiceScope,
  invoiceRecord,
  rawInvoice,
  rawBooking,
  rawCheckin,
  posOrders = [],
  laundryOrders = [],
  waterBottles = [],
  rooms = [],
  allInvoices = [],
  hotelProfile,
  hotelSettings,
  billSettings,
  onClose,
  onCreateSeparateInvoice,
}: InvoicePreviewModalProps) {
  const [taxSettings] = useHotelTaxSettings();
  const settings = billSettings || normalizeBillSettings(taxSettings, hotelSettings);
  const [activeScope, setActiveScope] = useState<InvoiceScope>(invoiceScope);

  const isSavedIssuedInvoice = Boolean(invoiceRecord && !invoiceRecord.id.startsWith('FOLIO-'));
  const isViewingSuperseded = Boolean(invoiceRecord && !isActiveInvoice(invoiceRecord));

  useEffect(() => {
    if (isSavedIssuedInvoice && invoiceRecord?.invoiceScope) {
      setActiveScope(invoiceRecord.invoiceScope);
    } else {
      setActiveScope(invoiceScope);
    }
  }, [booking?.id, invoiceScope, invoiceRecord?.id, isSavedIssuedInvoice]);

  useEffect(() => {
    if (!booking) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [booking, onClose]);

  // Locked GST status
  const isLockedWithGst = useMemo(() => {
    if (isSavedIssuedInvoice && invoiceRecord) {
      return !(
        invoiceRecord.isWithoutGst === true ||
        (invoiceRecord.gstRate !== undefined && Number(invoiceRecord.gstRate) <= 0) ||
        (invoiceRecord.gstRate === undefined && Number(invoiceRecord.totalTax || 0) <= 0)
      );
    }
    if (!booking) return false;
    return Boolean(booking.gstInvoice && Number(booking.taxRate ?? settings.roomGstRate) > 0);
  }, [isSavedIssuedInvoice, invoiceRecord, booking, settings.roomGstRate]);

  const previewData = useMemo(() => {
    if (!booking) return null;

    const liveStay = buildStayBill({
      booking: rawBooking || booking,
      checkin: rawCheckin || null,
      posOrders,
      laundryOrders,
      waterBottles,
      rooms,
      settings,
      gstEnabledOverride: isLockedWithGst,
    });

    const savedScope: InvoiceScope = invoiceRecord
      ? resolveInvoiceScope(invoiceRecord)
      : Number(booking?.otherServicesTotal || 0) > 0
      ? 'Booking + Other Services'
      : 'Only Booking';

    let effectiveBill: BillResult;
    let effectiveFolio = liveStay.folio;

    if (isSavedIssuedInvoice && invoiceRecord && activeScope === savedScope) {
      effectiveBill = reconstructSavedInvoiceBill(
        rawInvoice || invoiceRecord,
        invoiceRecord,
        booking,
        settings
      );
      effectiveFolio = {
        ...liveStay.folio,
        roomNumbers:
          Array.isArray(invoiceRecord.roomNumbers) && invoiceRecord.roomNumbers.length > 0
            ? invoiceRecord.roomNumbers
            : liveStay.folio.roomNumbers,
        nights: Number(invoiceRecord.nights) > 0 ? Number(invoiceRecord.nights) : liveStay.folio.nights,
        checkInDate: (invoiceRecord.checkInDateTime || booking.checkInDate || '').slice(0, 10),
        checkOutDate: (invoiceRecord.checkOutDateTime || booking.checkOutDate || '').slice(0, 10),
      };
    } else if (activeScope === 'Only Booking' || activeScope === 'Only Other Services') {
      const existingForStay = allInvoices.filter(
        (inv) =>
          !inv.id.startsWith('FOLIO-') &&
          inv.id !== invoiceRecord?.id &&
          (inv.bookingId === booking.id || inv.bookingNo === booking.bookingNo)
      );
      effectiveBill = reconcileScopedStayInvoice({
        folio: liveStay.folio,
        scope: activeScope,
        withGst: isLockedWithGst,
        settings,
        existingInvoicesForStay: existingForStay,
        confirmedRefundAmount: 0,
      }).bill;
    } else {
      effectiveBill = liveStay.bill;
    }

    const displayInvoiceNumber =
      invoiceRecord?.invoiceNumber || `FOLIO/${booking.bookingNo.replace(/^#/, '')}`;

    const rawScopeStr = String(
      invoiceRecord?.rawInvoiceScope || (rawInvoice as any)?.invoiceScope || ''
    ).toLowerCase();
    const isFoodBillView = Boolean(
      rawScopeStr === 'food_only' ||
        String(displayInvoiceNumber || '').toUpperCase().endsWith('-F') ||
        (activeScope === 'Only Other Services' &&
          effectiveBill.chargeLines.length > 0 &&
          effectiveBill.chargeLines.every((l) => l.kind === 'food' || FOOD_LINE_REGEX.test(l.description || '')))
    );
    const isRoomBillView = Boolean(rawScopeStr === 'room_only');

    // Expand generic POS food summary lines ("Food Bill — Order #POS-xxx" / "Food & Beverage Charges")
    // into item-wise dish rows so Separate Food Bill previews match Checkout's Separate Food Bill.
    if (isFoodBillView || activeScope === 'Only Other Services') {
      const isFoodChargeLine = (l: BillLedgerLine) =>
        l.type === 'charge' && (l.kind === 'food' || FOOD_LINE_REGEX.test(l.description || ''));
      const existingFoodLines = effectiveBill.chargeLines.filter(isFoodChargeLine);
      const onlyGenericFood =
        existingFoodLines.length > 0 && existingFoodLines.every((l) => isGenericFoodSummaryLine(l.description));
      if (onlyGenericFood) {
        const detailedFoodItems = extractDetailedFoodLinesForStay({
          invoice: (rawInvoice || invoiceRecord || null) as any,
          checkinRecord: (rawCheckin || null) as any,
          bookingRecord: (rawBooking || booking) as any,
          posOrders,
        });
        if (detailedFoodItems.length > 0) {
          const existingFoodSum = r2(existingFoodLines.reduce((s, l) => s + (Number(l.charges) || 0), 0));
          const detSum = r2(detailedFoodItems.reduce((s, it) => s + (Number(it.amount) || 0), 0));
          const shouldScale =
            existingFoodSum > 0 && detSum > 0 && Math.abs(detSum - existingFoodSum) > 0.05;
          const fallbackRoom =
            effectiveFolio.roomNumbers[0] ||
            existingFoodLines[0]?.roomNumber ||
            (Array.isArray(booking.roomNumbers) ? booking.roomNumbers[0] : '') ||
            '';
          let running = 0;
          const expandedFoodLedger: BillLedgerLine[] = detailedFoodItems.map((it, idx) => {
            let amt = r2(it.amount);
            if (shouldScale) {
              amt =
                idx === detailedFoodItems.length - 1
                  ? Math.max(0, r2(existingFoodSum - running))
                  : r2((amt / detSum) * existingFoodSum);
            }
            running = r2(running + amt);
            return {
              type: 'charge' as const,
              kind: 'food' as const,
              dateLabel: it.dateLabel,
              roomNumber: fallbackRoom,
              description: it.description,
              sac: settings.foodSac || '996331',
              charges: amt,
              receipts: 0,
            };
          });

          const firstFoodIdx = effectiveBill.lines.findIndex(isFoodChargeLine);
          const nonFoodLines = effectiveBill.lines.filter((l) => !isFoodChargeLine(l));
          const insertAt = firstFoodIdx >= 0 ? Math.min(firstFoodIdx, nonFoodLines.length) : 0;
          const nextLines = [
            ...nonFoodLines.slice(0, insertAt),
            ...expandedFoodLedger,
            ...nonFoodLines.slice(insertAt),
          ];
          effectiveBill = {
            ...effectiveBill,
            lines: nextLines,
            chargeLines: nextLines.filter((l) => l.type === 'charge'),
          };
        }
      }
    }

    const isCreditNoteModal = Boolean(
      (invoiceRecord as any)?.isCreditNote ||
        (rawInvoice as any)?.isCreditNote ||
        String((invoiceRecord as any)?.invoiceType || (rawInvoice as any)?.invoiceType || '').toLowerCase() === 'credit note' ||
        String(displayInvoiceNumber || '').toUpperCase().startsWith('CN/')
    );
    const origInvNoModal =
      String((rawInvoice as any)?.originalInvoiceNumber || '').trim() ||
      (isCreditNoteModal && String(displayInvoiceNumber || '').toUpperCase().startsWith('CN/')
        ? String(displayInvoiceNumber).slice(3)
        : '');

    const scopedDocTitle = isFoodBillView
      ? effectiveBill.isGstInvoice
        ? 'RESTAURANT & FOOD TAX INVOICE'
        : 'RESTAURANT & FOOD BILL OF SUPPLY'
      : isRoomBillView
      ? effectiveBill.isGstInvoice
        ? 'ROOM TARIFF TAX INVOICE'
        : 'ROOM TARIFF BILL OF SUPPLY'
      : undefined;

    const html = renderInvoiceHtml({
      ...toInvoicePrintData({
        hotel: { ...hotelProfile, ...(hotelSettings || {}) },
        invoiceNumber: displayInvoiceNumber,
        invoiceDate:
          invoiceRecord?.createdAt ||
          rawInvoice?.dateCreated ||
          rawInvoice?.date ||
          booking.checkOutDate,
        booking: rawBooking || booking,
        checkin: rawCheckin || null,
        folio: effectiveFolio,
        bill: effectiveBill,
      }),
      ...(scopedDocTitle && !isCreditNoteModal ? { documentTitle: scopedDocTitle } : {}),
      ...(isCreditNoteModal
        ? {
            isCreditNote: true,
            documentTitle: 'CREDIT NOTE / CHECKOUT REVERSAL',
            originalInvoiceNumber: origInvNoModal || undefined,
            creditNoteReason: String((rawInvoice as any)?.notes || '').trim() || undefined,
            reversedPayments: Array.isArray((rawInvoice as any)?.reversedPayments)
              ? (rawInvoice as any).reversedPayments.map((p: any) => ({
                  date: String(p.date || p.dateTime || '').slice(0, 10),
                  method: String(p.paymentMethod || p.method || 'Cash'),
                  reference: p.referenceNo || p.reference || undefined,
                  amount: Math.abs(Number(p.amount || 0)),
                  note: p.notes || p.note || undefined,
                }))
              : [],
          }
        : isViewingSuperseded
        ? {
            isSuperseded: true,
            supersededByInvoiceNumber:
              invoiceRecord?.supersededByInvoiceNumber ||
              (rawInvoice as any)?.supersededByInvoiceNumber ||
              undefined,
          }
        : {}),
    });

    return { html, bill: effectiveBill, displayInvoiceNumber };
  }, [
    booking,
    rawBooking,
    rawCheckin,
    rawInvoice,
    invoiceRecord,
    isSavedIssuedInvoice,
    activeScope,
    isLockedWithGst,
    posOrders,
    laundryOrders,
    waterBottles,
    rooms,
    settings,
    hotelProfile,
    hotelSettings,
  ]);

  if (!booking || !previewData) return null;

  const { html, bill, displayInvoiceNumber } = previewData;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-[#C49A3A]/40 shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Top Controls Bar */}
        <div className="bg-[#FAFBFD] border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                bill.isGstInvoice
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title="GST mode is locked on generated invoices."
            >
              <Lock className="w-3.5 h-3.5" />
              {bill.isGstInvoice
                ? `Tax Invoice (${bill.headlineGstRate}% GST)`
                : 'Bill of Supply (0% No GST)'}
            </span>

            {isViewingSuperseded && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border bg-rose-50 text-rose-800 border-rose-200">
                SUPERSEDED
                {invoiceRecord?.supersededByInvoiceNumber
                  ? ` → ${invoiceRecord.supersededByInvoiceNumber}`
                  : ''}
              </span>
            )}

            {onCreateSeparateInvoice && !isViewingSuperseded && (
              <button
                type="button"
                onClick={() => {
                  const targetWithGst = !isLockedWithGst;
                  const liveStayForSwitch = buildStayBill({
                    booking: rawBooking || booking,
                    checkin: rawCheckin || null,
                    posOrders,
                    laundryOrders,
                    waterBottles,
                    rooms,
                    settings,
                    gstEnabledOverride: targetWithGst,
                  });
                  const existingForStay = allInvoices.filter(
                    (inv) =>
                      !inv.id.startsWith('FOLIO-') &&
                      (inv.bookingId === booking.id || inv.bookingNo === booking.bookingNo)
                  );
                  const checkRec = reconcileScopedStayInvoice({
                    folio: liveStayForSwitch.folio,
                    scope: activeScope,
                    withGst: targetWithGst,
                    settings,
                    existingInvoicesForStay: existingForStay,
                    confirmedRefundAmount: 0,
                  });
                  let confirmedRefund = 0;
                  if (checkRec.potentialExcessOverTarget > 0) {
                    const wantsRefund = window.confirm(
                      `Switching this invoice to ${
                        targetWithGst ? 'With GST' : 'No GST (Bill of Supply)'
                      } lowers the bill to ₹${checkRec.bill.grandTotal.toLocaleString(
                        'en-IN'
                      )}, leaving ₹${checkRec.potentialExcessOverTarget.toLocaleString(
                        'en-IN'
                      )} excess from previous receipts.\n\nClick OK ONLY if you have actually refunded ₹${checkRec.potentialExcessOverTarget.toLocaleString(
                        'en-IN'
                      )} to the guest.\nClick Cancel to cap receipts at ₹${checkRec.bill.grandTotal.toLocaleString(
                        'en-IN'
                      )} (₹0 Refund Due).`
                    );
                    if (wantsRefund) {
                      confirmedRefund = checkRec.potentialExcessOverTarget;
                    }
                  }
                  onCreateSeparateInvoice(booking, targetWithGst, activeScope, confirmedRefund);
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Re-issue under new invoice number (superseding overlapping scope) or create non-overlapping split invoice"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                {isSavedIssuedInvoice
                  ? `Re-Issue (${isLockedWithGst ? 'No GST' : `With GST ${settings.roomGstRate}%`})`
                  : `+ Separate Invoice (${isLockedWithGst ? 'No GST' : `With GST ${settings.roomGstRate}%`})`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isSavedIssuedInvoice && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(
                  [
                    'Booking + Other Services',
                    'Only Booking',
                    'Only Other Services',
                  ] as const
                ).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setActiveScope(sc)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      activeScope === sc ? 'bg-[#17120F] text-[#E0BD6B]' : 'text-slate-600'
                    }`}
                  >
                    {sc === 'Only Booking'
                      ? 'Room Only'
                      : sc === 'Only Other Services'
                      ? 'Services Only'
                      : 'Full Bill'}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
              title="Close Invoice Preview (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Exact HOTEL M M PRESTIGE PDF Replica in Responsive Iframe */}
        <div className="bg-slate-100 flex-1 overflow-hidden">
          <iframe
            srcDoc={html}
            className="w-full h-[72vh] bg-white border-0"
            title="Invoice Preview"
          />
        </div>

        {/* Bottom Action Buttons */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                const msg =
                  `Hello *${booking.customerName}*,\n\n` +
                  `Here is your ${bill.isGstInvoice ? 'Tax Invoice' : 'Bill of Supply'} *${displayInvoiceNumber}* from *${hotelProfile.name}*:\n` +
                  `• Room(s): ${booking.roomNumbers.join(', ')}\n` +
                  `• Stay: ${booking.checkInDate} to ${booking.checkOutDate} (${booking.nights} Nights)\n` +
                  `• Invoice Amount: ₹${bill.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
                  `• Paid: ₹${bill.receipts.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Balance: ₹${bill.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n` +
                  `Thank you for staying with us!`;
                openWhatsAppChat(booking.mobile, msg);
              }}
              className="px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp Invoice
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openPrintWindow(html, true)}
              className="px-4 py-2.5 rounded-xl bg-[#17120F] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#E0BD6B]" />
              Print {bill.isGstInvoice ? 'Tax Invoice' : 'Bill of Supply'}
            </button>

            <button
              type="button"
              onClick={() => openPrintWindow(html, true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C49A3A] to-[#B0862B] hover:from-[#d4aa47] hover:to-[#C49A3A] text-[#17120F] font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download PDF (
              {activeScope === 'Only Booking'
                ? 'Room Only'
                : activeScope === 'Only Other Services'
                ? 'Services Only'
                : 'Full Bill'}
              )
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
