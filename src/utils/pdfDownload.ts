import { Booking, Invoice, GuestCheckIn, HotelSettings, SubscriptionInvoice } from '../types';
import {
  amountToIndianWords,
  BillCharge,
  BillLedgerLine,
  BillPayment,
  BillResult,
  calculateBill,
  formatDateLabel,
  normalizeBillSettings,
  r2,
} from './billCalculator';
import { stayNights } from './folioCollector';
import { openPrintWindow } from './printDocument';
import { defaultGrcTerms, InvoicePrintData, renderGrcHtml, renderInvoiceHtml } from './printTemplates';
import { allocateGrcNumber, hotelToPrintHotel, toGrcPrintData } from './stayBilling';
import { showToast } from './toast';

function sanitizePdfText(input: unknown): string {
  const raw = String(input ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/→/g, 'to')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '');
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatInr(amount: unknown): string {
  const num = Number(amount || 0);
  return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function calcNights(inDate?: string, outDate?: string): number {
  if (!inDate || !outDate) return 1;
  const d1 = new Date(inDate);
  const d2 = new Date(outDate);
  const diff = Math.abs(d2.getTime() - d1.getTime());
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return isNaN(days) || days <= 0 ? 1 : days;
}

class PdfCanvasBuilder {
  private ops: string[] = [];

  setFillRgb(r: number, g: number, b: number) {
    this.ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  }

  setStrokeRgb(r: number, g: number, b: number) {
    this.ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`);
  }

  setLineWidth(w: number) {
    this.ops.push(`${w.toFixed(2)} w`);
  }

  fillRect(x: number, yTop: number, w: number, h: number) {
    const y = 841.89 - yTop - h;
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  strokeRect(x: number, yTop: number, w: number, h: number) {
    const y = 841.89 - yTop - h;
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }

  fillAndStrokeRect(x: number, yTop: number, w: number, h: number) {
    const y = 841.89 - yTop - h;
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B`);
  }

  line(x1: number, yTop1: number, x2: number, yTop2: number) {
    const y1 = 841.89 - yTop1;
    const y2 = 841.89 - yTop2;
    this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  text(
    str: unknown,
    x: number,
    yTop: number,
    size = 10,
    bold = false,
    color: [number, number, number] = [38, 52, 73],
    align: 'left' | 'right' | 'center' = 'left'
  ) {
    const clean = sanitizePdfText(str);
    if (!clean) return;
    const rawLen = String(str ?? '')
      .replace(/₹/g, 'Rs. ')
      .replace(/[^\x20-\x7E]/g, '').length;
    const approxWidth = rawLen * size * (bold ? 0.54 : 0.50);
    let drawX = x;
    if (align === 'right') drawX = x - approxWidth;
    if (align === 'center') drawX = x - approxWidth / 2;
    const y = 841.89 - yTop;
    this.setFillRgb(color[0], color[1], color[2]);
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${drawX.toFixed(2)} ${y.toFixed(2)} Td (${clean}) Tj ET`);
  }

  buildPdfBytes(): Uint8Array {
    const contentStream = this.ops.join('\n');
    const encoder = new TextEncoder();
    const streamBytes = encoder.encode(contentStream);

    const objects: string[] = [
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
      `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`,
      `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`,
      `6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    ];

    let fullStr = `%PDF-1.4\n`;
    const offsets: number[] = [];

    for (const obj of objects) {
      offsets.push(encoder.encode(fullStr).length);
      fullStr += obj;
    }

    const xrefOffset = encoder.encode(fullStr).length;
    fullStr += `xref\n0 ${objects.length + 1}\n`;
    fullStr += `0000000000 65535 f \n`;
    for (const off of offsets) {
      fullStr += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    fullStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return encoder.encode(fullStr);
  }
}

function triggerBlobDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 500);
}

function extractInvoicePaymentItems(
  invoice: Invoice,
  checkinRecord?: GuestCheckIn | null
): BillPayment[] {
  const out: BillPayment[] = [];
  const seen = new Set<string>();
  const pushPay = (p: BillPayment) => {
    if (!p || Number(p.amount || 0) === 0) return;
    const k = p.id || `${p.date}|${p.method}|${p.amount}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ ...p, amount: r2(Number(p.amount)) });
  };

  if (Array.isArray(invoice.paymentHistory) && invoice.paymentHistory.length > 0) {
    invoice.paymentHistory.forEach((ph, idx) => {
      pushPay({
        id: String(ph.id || `ph-${idx}`),
        amount: Number(ph.amount || 0),
        method: String(ph.paymentMethod || 'Cash'),
        date: String(ph.date || invoice.dateCreated || '').slice(0, 10),
        reference: ph.referenceNo,
        note: ph.notes,
      });
    });
  } else if (checkinRecord && Array.isArray(checkinRecord.payments) && checkinRecord.payments.length > 0) {
    checkinRecord.payments.forEach((cp, idx) => {
      pushPay({
        id: String(cp.id || `cp-${idx}`),
        amount: Number(cp.amount || 0),
        method: String(cp.paymentMethod || 'Cash'),
        date: String(cp.date || cp.dateTime || invoice.dateCreated || '').slice(0, 10),
        reference: cp.referenceNo,
        note: cp.notes || cp.paymentType,
      });
    });
  }

  out.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  return out;
}

function summarizePaymentsByMode(items: BillPayment[]): Array<{ method: string; amount: number; count: number }> {
  const m = new Map<string, { method: string; amount: number; count: number }>();
  items.forEach((p) => {
    const label = String(p.method || 'Cash').trim() || 'Cash';
    const key = label.toUpperCase();
    const cur = m.get(key) || { method: label, amount: 0, count: 0 };
    cur.amount = r2(cur.amount + Number(p.amount || 0));
    cur.count += 1;
    m.set(key, cur);
  });
  return Array.from(m.values());
}

function buildBillResultFromInvoice(
  invoice: Invoice,
  hotelSettings?: Partial<HotelSettings> | null,
  checkinRecord?: GuestCheckIn | null
): BillResult {
  const extractedPayments = extractInvoicePaymentItems(invoice, checkinRecord);
  const isNoGst =
    invoice.isWithoutGst === true ||
    (invoice.gstRate !== undefined && Number(invoice.gstRate) <= 0) ||
    (invoice.gstRate === undefined && Number(invoice.gst || 0) <= 0);

  if (
    invoice.billEngine === 'v2' &&
    Array.isArray(invoice.ledgerLines) &&
    invoice.ledgerLines.length > 0
  ) {
    const subtotal = r2(Number(invoice.subtotal || 0));
    const discount = r2(Number(invoice.discount || 0));
    const taxableAmount = r2(
      Number(invoice.taxableAmount ?? Math.max(0, subtotal - discount))
    );
    const cgst = r2(Number(invoice.cgst || 0));
    const sgst = r2(Number(invoice.sgst || 0));
    const totalTax = r2(Number(invoice.gst ?? (invoice as any).taxAmount ?? cgst + sgst));
    const grandTotal = r2(Number(invoice.finalAmount ?? invoice.totalAmount ?? taxableAmount + totalTax));
    const receipts = r2(Number(invoice.paidAmount ?? invoice.advancePaid ?? 0));
    const balance = r2(Number(invoice.pendingAmount ?? Math.max(0, grandTotal - receipts)));
    const refundDue = r2(Number(invoice.refundDue ?? Math.max(0, receipts - grandTotal)));
    const legacy = {
      roomCharges: r2(Number(invoice.roomCharges || 0)),
      extraBedCharges: r2(Number(invoice.extraBedCharges || 0)),
      extraPersonCharges: r2(Number(invoice.extraPersonCharges || 0)),
      earlyCheckInCharges: r2(Number(invoice.earlyCheckInCharges || 0)),
      lateCheckOutCharges: r2(Number(invoice.lateCheckOutCharges || 0)),
      foodCharges: r2(Number(invoice.foodCharges || 0)),
      waterCharges: r2(Number(invoice.waterCharges || 0)),
      laundryCharges: r2(Number(invoice.laundryCharges || 0)),
      serviceCharges: r2(Number(invoice.serviceCharges || 0)),
      fineCharges: r2(Number(invoice.fineCharges || 0)),
      otherCharges: r2(
        Math.max(0, Number(invoice.otherCharges || 0) - Number(invoice.fineCharges || 0))
      ),
    };
    const typedLines = invoice.ledgerLines as unknown as BillLedgerLine[];
    const fallbackItems: BillPayment[] =
      extractedPayments.length > 0
        ? extractedPayments
        : typedLines
            .filter((l) => l.type === 'receipt' && Number(l.receipts || 0) !== 0)
            .map((l, idx) => {
              const parts = String(l.description || '').split(/\n|—/);
              const modePart = parts.length > 1 ? parts[1].trim() : String(invoice.paymentMethod || 'Cash');
              return {
                id: String(l.sourceId || `rcpt-${idx}`),
                amount: r2(Number(l.receipts || 0)),
                method: modePart || 'Cash',
                date: l.dateLabel || invoice.dateCreated || '',
              };
            });
    const resolvedPayStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
      invoice.paymentStatus === 'Paid' ||
      invoice.paymentStatus === 'Partially Paid' ||
      invoice.paymentStatus === 'Unpaid'
        ? invoice.paymentStatus
        : grandTotal > 0 && balance <= 0
        ? 'Paid'
        : receipts > 0
        ? 'Partially Paid'
        : 'Unpaid';
    return {
      lines: typedLines,
      chargeLines: typedLines.filter((l) => l.type === 'charge'),
      taxRows: Array.isArray(invoice.taxRows)
        ? invoice.taxRows
        : totalTax > 0
        ? [
            {
              rate: Number(invoice.gstRate || 5),
              taxable: taxableAmount,
              cgst,
              sgst,
              tax: totalTax,
            },
          ]
        : [],
      totalsByKind: {
        room: legacy.roomCharges,
        extra_bed: legacy.extraBedCharges,
        extra_person: legacy.extraPersonCharges,
        early_checkin: legacy.earlyCheckInCharges,
        late_checkout: legacy.lateCheckOutCharges,
        food: legacy.foodCharges,
        water: legacy.waterCharges,
        laundry: legacy.laundryCharges,
        service: legacy.serviceCharges,
        fine: legacy.fineCharges,
        other: legacy.otherCharges,
      },
      paymentItems: fallbackItems,
      paymentsByMode: summarizePaymentsByMode(fallbackItems),
      subtotal,
      discount,
      taxableAmount,
      cgst,
      sgst,
      totalTax,
      grandTotal,
      receipts,
      balance,
      refundDue,
      paymentStatus: resolvedPayStatus,
      isGstInvoice: !isNoGst,
      headlineGstRate: isNoGst ? 0 : Number(invoice.gstRate || 5),
      amountInWords: invoice.amountInWords || amountToIndianWords(grandTotal),
      legacy,
    };
  }

  // Synthesize ledger lines via calculateBill for legacy/manually-created Invoice records
  const baseSettings = normalizeBillSettings(hotelSettings);
  const headlineRate =
    !isNoGst && invoice.gstRate !== undefined && Number(invoice.gstRate) > 0
      ? Number(invoice.gstRate)
      : baseSettings.roomGstRate || 5;
  const settings = {
    ...baseSettings,
    roomGstRate: isNoGst ? 0 : headlineRate,
    foodGstRate: isNoGst ? 0 : baseSettings.foodGstRate || headlineRate,
    roomRateIncludesGst: false, // Stored invoice breakdown fields are already pre-tax
  };

  const nights = Number(invoice.nights) || stayNights(invoice.checkInDate, invoice.checkOutDate);
  const roomNo = String(invoice.roomNumber || '');
  const charges: BillCharge[] = [];
  const addC = (ch: BillCharge) => {
    if (Number(ch.amount) > 0) charges.push({ ...ch, amount: r2(ch.amount) });
  };

  addC({
    id: `inv-room-${invoice.id}`,
    kind: 'room',
    description: `Room Charges (${nights} Night${nights > 1 ? 's' : ''})`,
    amount: Number(invoice.roomCharges || 0),
    date: invoice.checkInDate,
    roomNumber: roomNo,
    nights,
    rate: nights > 0 ? r2(Number(invoice.roomCharges || 0) / nights) : undefined,
  });
  addC({
    id: `inv-xbed-${invoice.id}`,
    kind: 'extra_bed',
    description: `Extra Bed Charges${invoice.extraBedCount ? ` (${invoice.extraBedCount} Bed)` : ''}`,
    amount: Number(invoice.extraBedCharges || 0),
    date: invoice.checkInDate,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-xpax-${invoice.id}`,
    kind: 'extra_person',
    description: 'Extra Person Charges',
    amount: Number(invoice.extraPersonCharges || 0),
    date: invoice.checkInDate,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-early-${invoice.id}`,
    kind: 'early_checkin',
    description: 'Early Check-In Charges',
    amount: Number(invoice.earlyCheckInCharges || 0),
    date: invoice.checkInDate,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-late-${invoice.id}`,
    kind: 'late_checkout',
    description: 'Late Check-Out Charges',
    amount: Number(invoice.lateCheckOutCharges || 0),
    date: invoice.checkOutDate,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-food-${invoice.id}`,
    kind: 'food',
    description: 'Food & Restaurant Charges',
    amount: Number(invoice.foodCharges || 0),
    date: invoice.checkOutDate || invoice.dateCreated,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-water-${invoice.id}`,
    kind: 'water',
    description: 'Water Bottle Charges',
    amount: Number(invoice.waterCharges || 0),
    date: invoice.checkOutDate || invoice.dateCreated,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-laundry-${invoice.id}`,
    kind: 'laundry',
    description: 'Laundry Charges',
    amount: Number(invoice.laundryCharges || 0),
    date: invoice.checkOutDate || invoice.dateCreated,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-svc-${invoice.id}`,
    kind: 'service',
    description: 'Extra Guest Services',
    amount: Number(invoice.serviceCharges || 0),
    date: invoice.checkOutDate || invoice.dateCreated,
    roomNumber: roomNo,
  });
  const fineAmt = Number(invoice.fineCharges || 0);
  const rawOtherAmt = Math.max(0, Number(invoice.otherCharges || 0) - fineAmt);
  addC({
    id: `inv-other-${invoice.id}`,
    kind: 'other',
    description: 'Other / Miscellaneous Charges',
    amount: rawOtherAmt,
    date: invoice.checkOutDate || invoice.dateCreated,
    roomNumber: roomNo,
  });
  addC({
    id: `inv-fine-${invoice.id}`,
    kind: 'fine',
    description: 'Damage / Fine Charges',
    amount: fineAmt,
    date: invoice.checkOutDate || invoice.dateCreated,
    roomNumber: roomNo,
  });

  const paidAmt = r2(
    Number(
      invoice.paidAmount ??
        invoice.advancePaid ??
        (invoice.isPaid ? invoice.finalAmount : 0)
    )
  );
  const payments: BillPayment[] =
    extractedPayments.length > 0
      ? extractedPayments
      : paidAmt > 0
      ? [
          {
            id: `inv-pay-${invoice.id}`,
            amount: paidAmt,
            method: String(invoice.paymentMethod || 'Cash'),
            date: invoice.dateCreated,
            note: 'Payment Received',
          },
        ]
      : [];

  return calculateBill({
    charges,
    payments,
    discount: Number(invoice.discount || 0),
    gstEnabled: !isNoGst,
    settings,
  });
}

/**
 * Renders any stored Guest Invoice record into the exact client PDF HTML replica
 * ("HOTEL M M PRESTIGE" Tax Invoice / Bill of Supply ledger layout).
 */
export function invoiceRecordToPrintHtml(
  invoice: Invoice,
  hotelSettings?: Partial<HotelSettings> | Record<string, any> | null,
  checkinRecord?: GuestCheckIn | null,
  bookingRecord?: Booking | null
): string {
  const bill = buildBillResultFromInvoice(invoice, hotelSettings as Partial<HotelSettings>, checkinRecord);
  const nights = Number(invoice.nights) || stayNights(invoice.checkInDate, invoice.checkOutDate);
  const roomType = String(
    checkinRecord?.roomType || bookingRecord?.roomType || ''
  ).trim();
  const roomBase =
    Array.isArray(invoice.roomNumbers) && invoice.roomNumbers.length > 0
      ? invoice.roomNumbers.join(', ')
      : String(
          invoice.roomNumber ||
            checkinRecord?.roomNumber ||
            bookingRecord?.roomNumber ||
            ''
        );
  const roomLabel = `${roomBase}${roomType ? ` (${roomType})` : ''}`;
  const guestAddr =
    invoice.guestAddress ||
    [
      checkinRecord?.address || bookingRecord?.address,
      [checkinRecord?.city, checkinRecord?.state].filter(Boolean).join(', '),
      (checkinRecord as any)?.pincode,
    ]
      .filter(Boolean)
      .join('\n');

  const checkInTime = String(
    invoice.arrivalTime ||
      checkinRecord?.arrivalTime ||
      bookingRecord?.checkInTime ||
      ''
  ).trim();
  const checkOutTime = String(
    invoice.departureTime ||
      (checkinRecord?.checkedOutDateTime
        ? new Date(checkinRecord.checkedOutDateTime).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : checkinRecord?.departureTime || bookingRecord?.checkOutTime || '')
  ).trim();

  const pax =
    Number(checkinRecord?.adults || 0) + Number(checkinRecord?.children || 0) ||
    Number((bookingRecord as any)?.numGuests || 0) +
      Number(bookingRecord?.adults || 0) +
      Number(bookingRecord?.children || 0) ||
    1;

  const printData: InvoicePrintData = {
    hotel: hotelToPrintHotel(hotelSettings),
    invoiceNumber: String(invoice.invoiceNumber || invoice.id || ''),
    invoiceDate: formatDateLabel(
      invoice.dateCreated || (invoice as any).date || new Date().toISOString().slice(0, 10)
    ),
    reservationNo: String(
      (bookingRecord as any)?.bookingNo ||
        invoice.bookingId ||
        checkinRecord?.bookingId ||
        checkinRecord?.id ||
        ''
    ),
    guestName: String(
      invoice.guestName || checkinRecord?.guestName || bookingRecord?.guestName || 'Guest'
    ),
    guestMobile: String(
      invoice.guestMobile ||
        (invoice as any).mobile ||
        checkinRecord?.mobile ||
        bookingRecord?.mobile ||
        ''
    ),
    guestAddress: guestAddr,
    placeOfSupply: String(
      checkinRecord?.state ||
        (bookingRecord as any)?.state ||
        (hotelSettings as any)?.placeOfSupply ||
        (hotelSettings as any)?.state ||
        ''
    ),
    companyName: String(
      invoice.companyName || checkinRecord?.companyName || (bookingRecord as any)?.companyName || ''
    ),
    companyGstin: String(
      invoice.guestGstNumber ||
        invoice.gstNumber ||
        checkinRecord?.gstNumber ||
        bookingRecord?.gstNumber ||
        ''
    ),
    roomLabel,
    pax,
    checkIn: [
      formatDateLabel(invoice.checkInDate || checkinRecord?.checkInDate || bookingRecord?.checkInDate),
      checkInTime,
    ]
      .filter(Boolean)
      .join(' '),
    checkOut: [
      formatDateLabel(invoice.checkOutDate || checkinRecord?.checkOutDate || bookingRecord?.checkOutDate),
      checkOutTime,
    ]
      .filter(Boolean)
      .join(' '),
    nights,
    bill,
    footerNote: invoice.notes || undefined,
  };

  return renderInvoiceHtml(printData);
}

/**
 * Renders any Guest Check-In / Booking into the exact client GRC PDF HTML replica
 * ("HOTEL RAJ RESIDENCY" Guest Registration Card layout).
 */
export function buildGuestGrcHtml(params: {
  checkin?: GuestCheckIn | Record<string, any> | null;
  booking?: Booking | Record<string, any> | null;
  hotelSettings?: Partial<HotelSettings> | Record<string, any> | null;
  taxSettings?: Record<string, any> | null;
  existingGrcNumbers?: Array<string | undefined>;
  roomRate?: number;
  roomType?: string;
}): string {
  const settings = normalizeBillSettings(params.taxSettings, params.hotelSettings);
  const existingReg = String(
    (params.checkin as any)?.grcNumber || (params.booking as any)?.grcNumber || ''
  ).trim();
  const regNo =
    existingReg || allocateGrcNumber(params.existingGrcNumbers || [], settings);
  const rawTerms = Array.isArray((params.hotelSettings as any)?.grcTerms)
    ? ((params.hotelSettings as any).grcTerms as string[]).filter(
        (t) => String(t || '').trim().length > 0
      )
    : undefined;
  const grcData = toGrcPrintData({
    hotel: params.hotelSettings,
    regNo,
    booking: params.booking,
    checkin: params.checkin,
    roomRate: params.roomRate,
    roomType: params.roomType,
    settings,
    terms: rawTerms && rawTerms.length > 0 ? rawTerms : defaultGrcTerms(),
  });
  return renderGrcHtml(grcData);
}

export function downloadHotelInvoicePdf(
  invoice: Invoice,
  hotelSettings?: HotelSettings,
  checkinRecord?: GuestCheckIn,
  bookingRecord?: Booking
) {
  try {
    const html = invoiceRecordToPrintHtml(
      invoice,
      hotelSettings,
      checkinRecord,
      bookingRecord
    );
    openPrintWindow(html, true);
  } catch (err) {
    console.error('Failed to open hotel invoice print/PDF view:', err);
    showToast('Could not open invoice print view. Using browser print instead.', 'warning');
    window.print();
  }
}

export function downloadSubscriptionInvoicePdf(
  invoice: SubscriptionInvoice,
  businessName = 'DirectStay SaaS Hub',
  supportPhone = '+91 7978563771',
  supportEmail = 'raghunathpanigrahi4@gmail.com'
) {
  try {
    const pdf = new PdfCanvasBuilder();

    // Header
    pdf.setFillRgb(23, 18, 15);
    pdf.fillRect(36, 36, 523.28, 90);
    pdf.setFillRgb(196, 154, 58);
    pdf.fillRect(36, 36, 523.28, 5);

    pdf.text(businessName.toUpperCase(), 52, 62, 16, true, [255, 255, 255]);
    pdf.text('Official SaaS Subscription Renewal & Cloud License Tax Invoice', 52, 78, 9, false, [224, 189, 107]);
    pdf.text(`GSTIN: 21AABCU9603R1ZM  |  SAC Code: 998315 (Cloud SaaS License)`, 52, 93, 8.5, false, [220, 210, 195]);
    pdf.text(`Support: ${supportPhone}  |  ${supportEmail}`, 52, 107, 8.5, false, [210, 200, 185]);

    pdf.text('SAAS TAX INVOICE', 543, 62, 12, true, [224, 189, 107], 'right');
    pdf.text(`Invoice #: ${invoice.invoiceNumber}`, 543, 79, 10, true, [255, 255, 255], 'right');
    pdf.text(`Date: ${invoice.createdAt}`, 543, 93, 9, false, [220, 210, 195], 'right');
    pdf.text('Status: PAID & VERIFIED', 543, 107, 9, true, [74, 222, 128], 'right');

    // Billed To & Package Validity
    pdf.setFillRgb(250, 251, 253);
    pdf.setStrokeRgb(215, 222, 232);
    pdf.setLineWidth(0.8);
    pdf.fillAndStrokeRect(36, 140, 255, 96);
    pdf.fillAndStrokeRect(304, 140, 255.28, 96);

    pdf.text('BILLED TO (LICENSED HOTEL PROPERTY)', 48, 156, 8, true, [158, 120, 34]);
    pdf.text(invoice.hotelName || 'Hotel Property', 48, 172, 12, true, [23, 18, 15]);
    if (invoice.ownerName) {
      pdf.text(`Owner: ${invoice.ownerName}`, 48, 186, 9, false, [38, 52, 73]);
    }
    pdf.text(`Phone: ${invoice.hotelPhone || 'N/A'}`, 48, 200, 8.5, false, [75, 85, 99]);
    pdf.text(`Customer GSTIN: ${invoice.hotelGst || 'Unregistered / B2C'}`, 48, 214, 8.5, true, [38, 52, 73]);
    pdf.text(`Property ID: ${invoice.hotelId}`, 48, 227, 8, false, [100, 116, 139]);

    pdf.text('SELECTED PACKAGE & LICENSE SCHEDULE', 316, 156, 8, true, [158, 120, 34]);
    pdf.text(`Package: ${invoice.packageName}`, 316, 172, 11, true, [23, 18, 15]);
    pdf.text(`Billing Cycle: ${invoice.subscriptionPlan}`, 316, 186, 9, true, [158, 120, 34]);
    pdf.text(`Valid From: ${invoice.validFrom}  to  ${invoice.validUntil}`, 316, 200, 9, true, [21, 128, 93]);
    pdf.text(`Room Capacity: ${invoice.roomCapacityLabel}`, 316, 214, 8.5, false, [38, 52, 73]);
    pdf.text(`Payment Mode: ${invoice.paymentMethod} (${invoice.transactionReference || 'VERIFIED'})`, 316, 227, 8, false, [75, 85, 99]);

    // Line item table
    let y = 252;
    pdf.setFillRgb(23, 18, 15);
    pdf.fillRect(36, y, 523.28, 24);
    pdf.text('#', 48, y + 15, 9, true, [224, 189, 107]);
    pdf.text('PACKAGE & SUBSCRIPTION DESCRIPTION', 78, y + 15, 9, true, [255, 255, 255]);
    pdf.text('VALIDITY', 350, y + 15, 9, true, [224, 189, 107]);
    pdf.text('BASE TARIFF', 545, y + 15, 9, true, [224, 189, 107], 'right');
    y += 24;

    pdf.setFillRgb(255, 255, 255);
    pdf.setStrokeRgb(215, 222, 232);
    pdf.fillAndStrokeRect(36, y, 523.28, 48);
    pdf.text('01', 48, y + 18, 9, true, [100, 116, 139]);
    pdf.text(`${invoice.packageName} (${invoice.subscriptionPlan} Plan)`, 78, y + 18, 10, true, [23, 18, 15]);
    pdf.text(`Room Limit: ${invoice.roomCapacityLabel}`, 78, y + 33, 8.5, false, [75, 85, 99]);
    pdf.text(`${invoice.validFrom} to ${invoice.validUntil}`, 350, y + 18, 8.5, true, [21, 128, 93]);
    pdf.text(formatInr(invoice.baseAmount), 545, y + 18, 10, true, [23, 18, 15], 'right');
    y += 62;

    // Totals Summary
    const summaryX = 304;
    const summaryW = 255.28;
    const drawRow = (label: string, val: string, bold = false, bg?: [number, number, number], color: [number, number, number] = [38, 52, 73]) => {
      if (bg) {
        pdf.setFillRgb(bg[0], bg[1], bg[2]);
        pdf.setStrokeRgb(215, 222, 232);
        pdf.fillAndStrokeRect(summaryX, y, summaryW, 22);
      } else {
        pdf.setStrokeRgb(226, 232, 240);
        pdf.strokeRect(summaryX, y, summaryW, 22);
      }
      pdf.text(label, summaryX + 12, y + 14, bold ? 9.5 : 9, bold, color);
      pdf.text(val, summaryX + summaryW - 12, y + 14, bold ? 10 : 9, bold, color, 'right');
      y += 22;
    };

    drawRow('Package Base Tariff', formatInr(invoice.baseAmount), true, [248, 250, 252]);
    drawRow(`CGST (${(invoice.gstRate / 2).toFixed(1)}%)`, formatInr(invoice.cgstAmount));
    drawRow(`SGST (${(invoice.gstRate / 2).toFixed(1)}%)`, formatInr(invoice.sgstAmount));
    drawRow('GRAND TOTAL PAID', formatInr(invoice.totalAmount), true, [23, 18, 15], [224, 189, 107]);
    drawRow('PAYMENT STATUS', 'PAID IN FULL (RS. 0 DUE)', true, [236, 253, 245], [21, 128, 93]);

    // Footer
    const footerY = 720;
    pdf.setStrokeRgb(203, 213, 225);
    pdf.line(36, footerY, 559.28, footerY);
    pdf.text(`Approved & Verified By: ${invoice.approvedBy || 'Super Admin'}`, 36, footerY + 18, 8.5, true, [21, 128, 93]);
    pdf.text('Computer Generated SaaS Subscription License Tax Invoice.', 36, footerY + 32, 8, false, [100, 116, 139]);
    pdf.line(410, footerY + 48, 559.28, footerY + 48);
    pdf.text(`For ${businessName}`, 485, footerY + 38, 8.5, true, [38, 52, 73], 'center');
    pdf.text('Digitally Authorized Signatory', 485, footerY + 60, 8, false, [100, 116, 139], 'center');

    const pdfBytes = pdf.buildPdfBytes();
    const safeName = `SaaS-Invoice-${invoice.invoiceNumber || invoice.id}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    triggerBlobDownload(pdfBytes, safeName);
    showToast(`Downloaded ${safeName} successfully!`, 'success');
  } catch (err) {
    console.error('Failed to generate SaaS invoice PDF:', err);
    window.print();
  }
}
