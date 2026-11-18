import { BookingRecord } from '../types';

export const formatINR = (amount: number): string => {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatCurrency = formatINR;

export const formatINRDecimal = (amount: number): string => {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const calculateNights = (checkIn: string, checkOut: string): number => {
  if (!checkIn || !checkOut) return 1;
  const d1 = new Date(checkIn + 'T00:00:00');
  const d2 = new Date(checkOut + 'T00:00:00');
  const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
};

export const getDayName = (dateStr: string): string => {
  if (!dateStr) return 'Open (12:00 PM Daily)';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
};

export const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return 'Open (12:00 PM Daily)';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDate = formatShortDate;

export const isDateInRange = (dateStr: string, startStr: string, endStr: string): boolean => {
  return dateStr >= startStr && dateStr < endStr;
};

export const hasDateOverlap = (startA: string, endA: string, startB: string, endB: string): boolean => {
  if (!startA || !startB) return false;
  const effEndA = endA || addDaysStr(startA, 1);
  const effEndB = endB || addDaysStr(startB, 1);
  return startA < effEndB && effEndA > startB;
};

export const addDaysStr = (baseDateStr: string, days: number): string => {
  const d = new Date((baseDateStr || '2026-10-31') + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const exportToCsv = (filename: string, rows: Record<string, any>[]) => {
  if (!rows || rows.length === 0) {
    if (typeof window !== 'undefined') {
      alert('No data records found to export for the selected date range and filter.');
    }
    return;
  }
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const cell = r[h] === null || r[h] === undefined ? '' : String(r[h]);
          return `"${cell.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  // Prefix with UTF-8 BOM (\uFEFF) so Excel on Windows properly displays Unicode characters
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Classic DirectStay Binary PDF Invoice Generator (Old Invoice Design)
function sanitizePdfText(input: unknown): string {
  const raw = String(input ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/→/g, 'to')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
  return raw.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatInrPdf(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function downloadClassicInvoicePdf(
  booking: BookingRecord,
  scope: 'Only Booking' | 'Booking + Other Services',
  hotelProfile: { name: string; address: string; phone: string; gstNumber: string; email: string },
  overrideGstRate?: number,
  customInvoiceNumber?: string
) {
  const includeServices = scope === 'Booking + Other Services';
  const otherTotal = includeServices ? booking.otherServices.reduce((s, o) => s + o.amount, 0) : 0;
  const sub = booking.roomSubtotal + otherTotal;
  const disc = booking.discountAmount || 0;
  const taxable = Math.max(0, sub - disc);
  const gstRate = overrideGstRate !== undefined ? overrideGstRate : booking.gstInvoice ? booking.taxRate : 0;
  const gstAmt = +(taxable * (gstRate / 100)).toFixed(2);
  const grandTotal = +(taxable + gstAmt).toFixed(2);
  const paidAmt = booking.amountPaid;
  const dueAmt = Math.max(0, +(grandTotal - paidAmt).toFixed(2));

  const ops: string[] = [];
  const setFill = (r: number, g: number, b: number) =>
    ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  const setStroke = (r: number, g: number, b: number) =>
    ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`);
  const fillRect = (x: number, yTop: number, w: number, h: number) =>
    ops.push(`${x.toFixed(2)} ${(841.89 - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const fillAndStrokeRect = (x: number, yTop: number, w: number, h: number) =>
    ops.push(`${x.toFixed(2)} ${(841.89 - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B`);
  const text = (
    str: unknown,
    x: number,
    yTop: number,
    size = 10,
    bold = false,
    color: [number, number, number] = [38, 52, 73],
    align: 'left' | 'right' = 'left'
  ) => {
    const clean = sanitizePdfText(str);
    if (!clean) return;
    const w = clean.length * size * (bold ? 0.54 : 0.5);
    const drawX = align === 'right' ? x - w : x;
    setFill(color[0], color[1], color[2]);
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${drawX.toFixed(2)} ${(841.89 - yTop).toFixed(2)} Td (${clean}) Tj ET`);
  };

  // 1. Dark Espresso & Gold Classic Header
  setFill(23, 18, 15);
  fillRect(36, 36, 523.28, 86);
  setFill(196, 154, 58);
  fillRect(36, 36, 523.28, 5);

  text(hotelProfile.name.toUpperCase(), 52, 62, 16, true, [255, 255, 255]);
  text(hotelProfile.address.slice(0, 75), 52, 78, 9, false, [220, 210, 195]);
  text(`Phone: ${hotelProfile.phone}  |  Email: ${hotelProfile.email}`, 52, 92, 8.5, false, [210, 200, 185]);
  if (gstRate > 0 && hotelProfile.gstNumber) {
    text(`GSTIN: ${hotelProfile.gstNumber}`, 52, 106, 9, true, [224, 189, 107]);
  }

  const displayInvNo = customInvoiceNumber || `DSG-INV-${booking.billId}`;
  text(gstRate > 0 ? 'TAX INVOICE' : 'ROOM BILL', 543, 62, 12, true, [224, 189, 107], 'right');
  text(`Invoice No: ${displayInvNo}`, 543, 79, 10, true, [255, 255, 255], 'right');
  text(`Booking Ref: ${booking.bookingNo}`, 543, 93, 9, false, [220, 210, 195], 'right');
  text(
    `Status: ${dueAmt <= 0 ? 'PAID IN FULL' : 'BALANCE DUE'}`,
    543,
    107,
    9,
    true,
    dueAmt <= 0 ? [74, 222, 128] : [251, 113, 133],
    'right'
  );

  // 2. Guest & Stay Boxes
  setFill(250, 251, 253);
  setStroke(215, 222, 232);
  fillAndStrokeRect(36, 136, 255, 92);
  fillAndStrokeRect(304, 136, 255.28, 92);

  text('BILLED TO (GUEST PARTICULARS)', 48, 152, 8, true, [158, 120, 34]);
  text(booking.customerName, 48, 168, 12, true, [23, 18, 15]);
  text(`Room(s): Room ${booking.roomNumbers.join(', ')}`, 48, 183, 9.5, true, [38, 52, 73]);
  text(`Mobile: +91 ${booking.mobile}`, 48, 197, 9, false, [75, 85, 99]);
  if (booking.companyName) {
    text(`Company: ${booking.companyName} (${booking.companyGst || ''})`, 48, 211, 8.5, true, [55, 65, 81]);
  }

  text('STAY & BOOKING DETAILS', 316, 152, 8, true, [158, 120, 34]);
  text(`Check-In: ${booking.checkInDate} (${getDayName(booking.checkInDate)})`, 316, 168, 9, false, [38, 52, 73]);
  text(`Check-Out: ${booking.isOpenStay ? 'Open Stay (12:00 PM Daily)' : `${booking.checkOutDate} (${getDayName(booking.checkOutDate)})`}`, 316, 183, 9, false, [38, 52, 73]);
  text(`Stay Duration: ${booking.nights} Night(s)  |  Guests: ${booking.numGuests}`, 316, 197, 9.5, true, [38, 52, 73]);
  text(`Scope: ${scope}  |  Source: ${booking.source}`, 316, 211, 8.5, false, [75, 85, 99]);

  // 3. Table Header
  let y = 244;
  setFill(23, 18, 15);
  fillRect(36, y, 523.28, 24);
  text('#', 48, y + 15, 9, true, [224, 189, 107]);
  text('PARTICULARS / STAY CHARGE DESCRIPTION', 78, y + 15, 9, true, [255, 255, 255]);
  text('AMOUNT (INR)', 545, y + 15, 9, true, [224, 189, 107], 'right');
  y += 24;

  const lineItems: Array<{ title: string; amount: string }> = [
    {
      title: `1. Room Rent / Tariff - Room ${booking.roomNumbers.join(', ')} (${booking.nights} Night(s))`,
      amount: formatInrPdf(booking.roomSubtotal),
    },
  ];

  if (includeServices && booking.otherServices.length > 0) {
    booking.otherServices.forEach((srv, idx) => {
      lineItems.push({
        title: `${idx + 2}. ${srv.serviceType}: ${srv.description} (${srv.orderNumber})`,
        amount: formatInrPdf(srv.amount),
      });
    });
  }

  lineItems.forEach((item, idx) => {
    setFill(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    setStroke(226, 232, 240);
    fillAndStrokeRect(36, y, 523.28, 24);
    text(String(idx + 1).padStart(2, '0'), 48, y + 15, 9, true, [100, 116, 139]);
    text(item.title.slice(0, 75), 78, y + 15, 9.5, false, [30, 41, 59]);
    text(item.amount, 545, y + 15, 9.5, true, [23, 18, 15], 'right');
    y += 24;
  });

  // 4. Summary Box
  y += 16;
  const drawRow = (label: string, val: string, bold = false, bg?: [number, number, number], col: [number, number, number] = [38, 52, 73]) => {
    setFill(bg ? bg[0] : 255, bg ? bg[1] : 255, bg ? bg[2] : 255);
    setStroke(215, 222, 232);
    fillAndStrokeRect(290, y, 269.28, 22);
    text(label, 300, y + 14, bold ? 9.5 : 9, bold, col);
    text(val, 547, y + 14, bold ? 10 : 9, bold, col, 'right');
    y += 22;
  };

  drawRow('Subtotal (Before Discount & Tax)', formatInrPdf(sub), true, [248, 250, 252]);
  if (disc > 0) drawRow('Less: Discount (-)', `- ${formatInrPdf(disc)}`, true, undefined, [21, 128, 93]);
  if (gstRate > 0) {
    const halfRate = (gstRate / 2).toFixed(1).replace(/\.0$/, '');
    const halfGst = +(gstAmt / 2).toFixed(2);
    drawRow(`Add: CGST (${halfRate}%)`, formatInrPdf(halfGst));
    drawRow(`Add: SGST (${halfRate}%)`, formatInrPdf(halfGst));
    drawRow(`Total GST (${gstRate}% = CGST + SGST)`, formatInrPdf(gstAmt), true, [254, 249, 235], [139, 105, 30]);
  }
  drawRow('GRAND TOTAL BILL', formatInrPdf(grandTotal), true, [23, 18, 15], [224, 189, 107]);
  drawRow('Less: Advance / Amount Paid (-)', `- ${formatInrPdf(paidAmt)}`, true, undefined, [21, 128, 93]);
  drawRow(
    'NET BALANCE DUE',
    dueAmt <= 0 ? 'Rs. 0 (SETTLED IN FULL)' : `${formatInrPdf(dueAmt)} DUE`,
    true,
    dueAmt <= 0 ? [236, 253, 245] : [255, 241, 242],
    dueAmt <= 0 ? [21, 128, 93] : [190, 18, 60]
  );

  const contentStream = ops.join('\n');
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
  fullStr += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    fullStr += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  fullStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([encoder.encode(fullStr)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DirectStay_Invoice_${(customInvoiceNumber || booking.bookingNo).replace(/[^A-Za-z0-9_-]/g, '')}.pdf`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 400);
}

/**
 * Normalizes an Indian mobile number for WhatsApp sharing (E.164 digits without '+'):
 * - Strips non-digit characters
 * - Removes any leading zeros (e.g., 09464165010 -> 9464165010)
 * - Removes existing or duplicated country code '91' (e.g., +91 09464165010, 91919464165010 -> 9464165010)
 * - Prepends '91' (e.g., 919464165010)
 */
export function normalizeIndianWhatsAppNumber(rawPhone?: string): string {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';

  while (digits.length > 10) {
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '');
    } else if (digits.startsWith('91')) {
      digits = digits.slice(2);
    } else {
      break;
    }
  }

  digits = digits.replace(/^0+/, '');
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits ? `91${digits}` : '';
}

/**
 * Opens WhatsApp (Desktop WhatsApp Web / App or Mobile WhatsApp App) in a clean
 * top-level browsing context (rel="noopener noreferrer") using official wa.me universal link
 * so "Continue to WhatsApp Web" redirects cleanly without any blank screen.
 */
export function openWhatsAppChat(rawPhone: string | undefined, message: string): void {
  const cleanPhone = normalizeIndianWhatsAppNumber(rawPhone);
  const encodedMsg = encodeURIComponent(message);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
    : `https://wa.me/?text=${encodedMsg}`;

  if (typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = waUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } else if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }
}

