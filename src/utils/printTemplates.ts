/**
 * DirectStay — Print templates (pure HTML strings, no DOM / React) shared by Web + Mobile.
 *  - renderInvoiceHtml(): exact replica of "HOTEL M M PRESTIGE" Tax Invoice (ledger layout)
 *  - renderGrcHtml():     exact replica of "HOTEL RAJ RESIDENCY" Guest Registration Card
 */
import { BillResult, formatDateLabel, formatMoney } from './billCalculator';

export interface PrintHotel {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  logoUrl?: string;
}

export interface InvoicePrintData {
  hotel: PrintHotel;
  invoiceNumber: string;
  invoiceDate: string; // "05-Nov-2025"
  reservationNo?: string;
  guestName: string;
  guestMobile?: string;
  guestEmail?: string;
  guestAddress?: string;
  guestCity?: string;
  guestState?: string;
  placeOfSupply?: string;
  companyName?: string;
  companyGstin?: string;
  roomLabel: string; // "402 (POD)"
  roomNumber?: string;
  roomType?: string;
  pax?: number | string;
  adults?: number | string;
  children?: number | string;
  bookingSource?: string;
  checkIn?: string; // "04-Nov-2025 01:33 PM"
  checkOut?: string;
  nights?: number;
  durationLabel?: string;
  isHourlyStay?: boolean;
  stayHours?: number | string;
  bill: BillResult;
  copyLabel?: string; // ORIGINAL FOR RECIPIENT
  footerNote?: string;
  documentTitle?: string;
  isCreditNote?: boolean;
  isSuperseded?: boolean;
  supersededByInvoiceNumber?: string;
  originalInvoiceNumber?: string;
  creditNoteReason?: string;
  reversedPayments?: Array<{ date: string; method: string; reference?: string; amount: number; note?: string }>;
}

export interface GrcPrintData {
  hotel: PrintHotel;
  regNo: string;
  date: string; // "01-11-2026"
  guestName: string;
  address?: string;
  city?: string;
  state?: string;
  nationality?: string;
  mobile?: string;
  adults?: number | string;
  children?: number | string;
  arrival?: string; // "01-11-2026, 09:11 AM"
  departure?: string;
  roomNo?: string;
  roomType?: string;
  roomCharge?: number | string;
  planName?: string;
  taxMode?: 'Include' | 'Exclude' | string;
  bookingNo?: string;
  company?: string;
  voucherNo?: string;
  guestIdType?: string;
  guestIdNumber?: string;
  checkInTime?: string; // "12pm noon"
  checkOutTime?: string; // "11am"
  terms?: string[];
}

export const esc = (v: unknown): string =>
  String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (v: number) => (v === 0 ? '0.00' : formatMoney(v));

const BASE_CSS = `
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 13.5px; line-height: 1.45; }
  .sheet { width: 100%; max-width: 190mm; margin: 0 auto; padding: 4mm 2mm; }
  table { border-collapse: collapse; width: 100%; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  @media screen { body { background: #eef1f5; } .sheet { background: #fff; margin: 12px auto; padding: 8mm; box-shadow: 0 2px 10px rgba(0,0,0,.14); } }
`;

// ---------------------------------------------------------------------------
// BOOKING CONFIRMATION & INVOICE (Exact High-Readability Corporate UI Layout)
// Matches "Hotel Grant Heights" specification cleanly while strictly preserving all date logic
// ---------------------------------------------------------------------------
export function renderInvoiceHtml(d: InvoicePrintData): string {
  const b = d.bill;
  const isCreditNote = Boolean(
    d.isCreditNote ||
      String(d.invoiceNumber || '').toUpperCase().startsWith('CN/') ||
      String(d.documentTitle || '').toUpperCase().includes('CREDIT NOTE')
  );
  const isTax = b.isGstInvoice || (isCreditNote && Math.abs(Number(b.totalTax || 0)) > 0);
  const h = d.hotel;
  const signedMoney = (v: number) => {
    const n = Number(v) || 0;
    if (Math.abs(n) < 0.005) return 'Rs. 0.00';
    return n < 0 ? `- Rs. ${money(Math.abs(n))}` : `Rs. ${money(n)}`;
  };
  const origInvoiceRef =
    d.originalInvoiceNumber ||
    (isCreditNote && String(d.invoiceNumber || '').toUpperCase().startsWith('CN/')
      ? String(d.invoiceNumber).slice(3)
      : '');

  const addressLine = String(h.address || '')
    .split(/\n/)
    .map(x => x.trim())
    .filter(Boolean)
    .join(', ');

  const guestLocation =
    [d.guestCity, d.guestState].filter(Boolean).join(', ') ||
    (d.guestAddress ? String(d.guestAddress).split(/\n|,/)[0]?.trim() : '') ||
    d.placeOfSupply ||
    'India';

  const formatCleanTime = (dt?: string) => {
    if (!dt) return '—';
    const trimmed = dt.trim();
    const m = trimmed.match(/^(\d{1,2}[\s-][A-Za-z]{3}[\s-]\d{4})\s+(.+)$/);
    if (m) {
      const timePart = m[2].trim();
      if (timePart.startsWith('(') && timePart.endsWith(')')) return trimmed;
      return `${m[1]} (${timePart})`;
    }
    return trimmed;
  };

  const checkInDisplay = formatCleanTime(d.checkIn);
  const checkOutDisplay = formatCleanTime(d.checkOut);

  const durationDisplay =
    d.durationLabel ||
    (d.isHourlyStay || (d.checkIn && d.checkOut && d.checkIn.slice(0, 10) === d.checkOut.slice(0, 10))
      ? `${d.stayHours ? `${d.stayHours} Hours (Day-Use)` : '1 Day-Use'}`
      : `${d.nights || 1} Night${(d.nights || 1) > 1 ? 's' : ''}`);

  const occupantsDisplay =
    d.adults !== undefined || d.children !== undefined
      ? `${Number(d.adults || 1)} Adult(s), ${Number(d.children || 0)} Child(ren)`
      : `${d.pax || 1} Guest(s)`;

  const shortDates = (cin?: string, cout?: string) => {
    try {
      const pIn = String(cin || '').match(/(\d{1,2})[\s-]([A-Za-z]{3}|\d{2})/);
      const pOut = String(cout || '').match(/(\d{1,2})[\s-]([A-Za-z]{3}|\d{2})/);
      if (pIn && pOut) return `${pIn[1]}/${pIn[2]} – ${pOut[1]}/${pOut[2]}`;
      if (pIn) return `${pIn[1]}/${pIn[2]}`;
    } catch {
      // fallback
    }
    return 'Stay Dates';
  };

  const isSeparateFoodInvoice = /RESTAURANT\s*&\s*FOOD/i.test(String(d.documentTitle || ''));
  // Charge lines mapping for ITEMIZED CHARGES table (for Credit Notes, show only reversed charge lines with consistent negative sign)
  const chargeLines = b.lines.filter(l => l.type !== 'receipt' && (!isCreditNote || l.type !== 'tax'));
  const itemizedChargeRows = chargeLines.length > 0
    ? chargeLines.map(l => {
        let rawDesc = l.description || '';
        // On combined stay bills, collapse food line to "Food Bill"; on Separate Food Invoices, show ALL item-wise dish details!
        if (!isSeparateFoodInvoice && (l.kind === 'food' || /Food & Beverage|Food & Restaurant|POS Room Charge|Food Bill/i.test(rawDesc))) {
          // Strip any parentheses containing item lists e.g. "(1x DAL TADKA, ...)"
          rawDesc = rawDesc.replace(/\s*\([^)]*(?:x|\d)[^)]*\)/gi, '').trim();
          rawDesc = rawDesc.replace(/^Food & (?:Beverage|Restaurant)(?:\s*Charges)?/i, 'Food Bill');
          if (!rawDesc.toLowerCase().includes('food bill')) {
            rawDesc = 'Food Bill';
          }
        }
        const itemDesc = esc(rawDesc).replace(/\n/g, '<br/>');
        const unitLabel = l.roomNumber ? `Room ${esc(l.roomNumber)}` : (d.roomNumber ? `Room ${esc(d.roomNumber)}` : 'Room Unit');
        const datesLabel = esc(l.dateLabel) || shortDates(d.checkIn, d.checkOut);
        const qtyNights = d.nights && d.nights > 1 ? String(d.nights) : '1';
        const lineAmt = isCreditNote ? -Math.abs(Number(l.charges || 0)) : Number(l.charges || 0);
        return `<tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:8px 10px; font-weight:600; color:#111;">${itemDesc}</td>
          <td style="padding:8px 10px; color:#222;">${unitLabel}</td>
          <td style="padding:8px 10px; text-align:center; color:#333;">${datesLabel}</td>
          <td style="padding:8px 10px; text-align:center; font-weight:600; color:#111;">${qtyNights}</td>
          <td style="padding:8px 10px; text-align:right; font-weight:700; color:${isCreditNote ? '#991B1B' : '#000'};">${signedMoney(lineAmt)}</td>
        </tr>`;
      }).join('')
    : `<tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px 10px; font-weight:600; color:#111;">${esc(d.roomType || 'Standard Room')}</td>
        <td style="padding:8px 10px; color:#222;">Room ${esc(d.roomNumber || d.roomLabel || '101')}</td>
        <td style="padding:8px 10px; text-align:center; color:#333;">${esc(shortDates(d.checkIn, d.checkOut))}</td>
        <td style="padding:8px 10px; text-align:center; font-weight:600; color:#111;">${d.nights || 1}</td>
        <td style="padding:8px 10px; text-align:right; font-weight:700; color:${isCreditNote ? '#991B1B' : '#000'};">${signedMoney(isCreditNote ? -Math.abs(b.netSubtotal ?? b.subtotal ?? b.grandTotal) : (b.taxableAmount || b.grandTotal))}</td>
      </tr>`;

  // Payment receipts rows (Credit Note strictly distinguishes reversed payments from new collections)
  const payItems = Array.isArray(b.paymentItems) ? b.paymentItems : [];
  const revPayItems = Array.isArray(d.reversedPayments) ? d.reversedPayments : [];
  const paymentRowsHtml = isCreditNote
    ? (revPayItems.length > 0
        ? revPayItems.map(p => {
            const dtLbl = formatDateLabel(p.date) || esc(p.date || d.invoiceDate);
            return `<tr style="border-bottom:1px solid #E5E7EB;">
              <td style="padding:6px 8px; color:#222; font-weight:500;">${esc(dtLbl)}</td>
              <td style="padding:6px 8px; color:#991B1B; font-weight:600;">${esc(p.method || 'Cash')} (Reversed)</td>
              <td style="padding:6px 8px; text-align:center; color:#555;">${esc(p.reference || p.note || 'Checkout Reversal')}</td>
              <td style="padding:6px 8px; text-align:right; font-weight:600; color:#991B1B;">${signedMoney(-Math.abs(Number(p.amount || 0)))}</td>
            </tr>`;
          }).join('')
        : `<tr style="border-bottom:1px solid #E5E7EB;">
            <td style="padding:6px 8px; color:#555;" colspan="3">Checkout invoice reversed via Credit Note (No new payment collected)</td>
            <td style="padding:6px 8px; text-align:right; font-weight:600; color:#555;">Rs. 0.00</td>
          </tr>`)
    : payItems.length > 0
    ? payItems.map(p => {
        const dtLbl = formatDateLabel(p.date) || esc(p.date || d.invoiceDate);
        return `<tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:6px 8px; color:#222; font-weight:500;">${esc(dtLbl)}</td>
          <td style="padding:6px 8px; color:#000; font-weight:600;">${esc(p.method || 'Cash')}</td>
          <td style="padding:6px 8px; text-align:center; color:#555;">${esc(p.reference || '—')}</td>
          <td style="padding:6px 8px; text-align:right; font-weight:600; color:#000;">Rs. ${money(p.amount)}</td>
        </tr>`;
      }).join('')
    : (b.receipts > 0
        ? `<tr style="border-bottom:1px solid #E5E7EB;">
            <td style="padding:6px 8px; color:#222; font-weight:500;">${esc(d.invoiceDate)}</td>
            <td style="padding:6px 8px; color:#000; font-weight:600;">Cash / Desk</td>
            <td style="padding:6px 8px; text-align:center; color:#555;">—</td>
            <td style="padding:6px 8px; text-align:right; font-weight:600; color:#000;">Rs. ${money(b.receipts)}</td>
          </tr>`
        : `<tr style="border-bottom:1px solid #E5E7EB;">
            <td style="padding:6px 8px; color:#666;" colspan="3">Payment Due at Front Desk</td>
            <td style="padding:6px 8px; text-align:right; font-weight:600; color:#666;">Rs. 0.00</td>
          </tr>`);

  // Taxes breakdown label
  const totalTaxRate = b.taxRows && b.taxRows.length > 0 ? b.taxRows.reduce((acc, r) => acc + Math.abs(Number(r.rate || 0)), 0) : Math.abs(Number(b.headlineGstRate || 0));
  const taxBreakdownLabel = totalTaxRate > 0
    ? `CGST ${(totalTaxRate / 2).toFixed(2)}%, SGST ${(totalTaxRate / 2).toFixed(2)}%`
    : (isTax ? 'CGST 2.50%, SGST 2.50%' : 'Taxes Exempt');

  const isSupersededInv = Boolean(!isCreditNote && d.isSuperseded);
  const balanceValue = isCreditNote ? 0 : (b.refundDue > 0 ? b.refundDue : b.balance);
  const statusLabel = isCreditNote
    ? 'CREDIT NOTE — REVERSAL ISSUED'
    : isSupersededInv
    ? 'SUPERSEDED (REVERSED)'
    : (balanceValue <= 0 ? 'CONFIRMED (PAID)' : 'CONFIRMED');
  const resolvedDocTitle = isCreditNote
    ? 'CREDIT NOTE / CHECKOUT REVERSAL'
    : (d.documentTitle || (isTax ? 'BOOKING CONFIRMATION & INVOICE' : 'BOOKING CONFIRMATION & BILL OF SUPPLY'));
  const displayBaseSubtotal = isCreditNote
    ? -Math.abs(Number(b.netSubtotal ?? (b.subtotal - b.discount)))
    : Number(b.netSubtotal ?? Math.max(0, b.subtotal - b.discount));
  const displayTaxableBase = isCreditNote
    ? -Math.abs(Number(b.taxableAmount || 0))
    : Number(b.taxableAmount || 0);
  const displayTaxTotal = isCreditNote
    ? -Math.abs(Number(b.totalTax || 0))
    : Number(b.totalTax || 0);
  const displayGrandTotal = isCreditNote
    ? -Math.abs(Number(b.grandTotal || 0))
    : Number(b.grandTotal || 0);
  const showSeparateTaxableRow =
    isTax && Math.abs(Math.abs(displayBaseSubtotal) - Math.abs(displayTaxableBase)) >= 0.01;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(resolvedDocTitle)} ${esc(d.invoiceNumber)}</title>
<style>
${BASE_CSS}
  @page {
    size: A4 portrait;
    margin: 8mm;
  }
  body {
    background: #fff;
    color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    margin: 0;
    padding: 0;
  }
  .invoice-container {
    position: relative;
    max-width: 196mm;
    min-height: 272mm;
    margin: 0 auto;
    padding: 4mm 6mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .superseded-watermark {
    position: absolute;
    top: 38%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 56px;
    font-weight: 900;
    letter-spacing: 6px;
    color: rgba(220, 38, 38, 0.13);
    border: 6px solid rgba(220, 38, 38, 0.16);
    padding: 10px 28px;
    border-radius: 12px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 10;
    text-transform: uppercase;
  }
  .invoice-top-body {
    flex: 1 1 auto;
  }
  @media print {
    body { margin: 0; }
    .invoice-container { max-width: 100%; padding: 0; min-height: 272mm; }
  }
</style>
</head>
<body>
<div class="invoice-container">
  ${isSupersededInv ? `<div class="superseded-watermark">SUPERSEDED</div>` : ''}
  <div class="invoice-top-body">

    <!-- HEADER SECTION -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
      <tr>
        <td style="vertical-align:top; width:58%;">
          <h1 style="margin:0 0 3px 0; font-size:24px; font-weight:800; color:#000; letter-spacing:-0.2px; line-height:1.2;">
            ${esc(h.name || 'Hotel Grant Heights')}
          </h1>
          ${addressLine ? `<div style="font-size:11px; color:#222; line-height:1.4; margin-bottom:3px;">${esc(addressLine)}</div>` : ''}
          <div style="font-size:11px; color:#222; line-height:1.4;">
            ${h.phone ? `Phone: ${esc(h.phone)}` : ''}
            ${h.phone && h.email ? ` &nbsp;|&nbsp; ` : ''}
            ${h.email ? `Email: ${esc(h.email)}` : ''}
            ${h.gstNumber && isTax ? ` &nbsp;|&nbsp; GSTIN: ${esc(h.gstNumber)}` : ''}
          </div>
        </td>
        <td style="vertical-align:top; width:42%; text-align:right;">
          <div style="font-size:14.5px; font-weight:800; color:${isCreditNote ? '#991B1B' : '#000'}; letter-spacing:0.3px; text-transform:uppercase; margin-bottom:4px;">
            ${esc(resolvedDocTitle)}
          </div>
          <div style="font-size:11.5px; color:#222; font-weight:600; margin-bottom:3px;">
            ${isCreditNote
              ? `Credit Note #: ${esc(d.invoiceNumber)} &nbsp;|&nbsp; Date: ${esc(d.invoiceDate)}`
              : `Conf #: ${esc(d.reservationNo || d.invoiceNumber || '52055852')} &nbsp;|&nbsp; Date: ${esc(d.invoiceDate)}`}
          </div>
          ${isCreditNote ? `
          <div style="font-size:11px; color:#333; font-weight:600; margin-bottom:3px;">
            Orig. Invoice: <strong>${esc(origInvoiceRef || '—')}</strong> &nbsp;|&nbsp; Booking #: <strong>${esc(d.reservationNo || '—')}</strong>
          </div>` : ''}
          <div style="font-size:12px; font-weight:800; color:${isCreditNote || isSupersededInv ? '#991B1B' : '#000'};">
            Status: <span style="text-transform:uppercase;">${esc(statusLabel)}</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- SOLID BLACK HORIZONTAL DIVIDER -->
    <div style="border-bottom:2px solid #000; margin:8px 0 16px 0;"></div>

    ${isSupersededInv ? `
    <div style="margin:0 0 14px 0; padding:10px 14px; background:#FEF2F2; border:2px solid #DC2626; border-radius:6px; color:#991B1B; font-size:12px; font-weight:800; line-height:1.45; letter-spacing:0.2px;">
      SUPERSEDED — REVERSED${d.supersededByInvoiceNumber ? ` BY ${esc(d.supersededByInvoiceNumber)}` : ''} &nbsp;|&nbsp; Historical audit record only. Excluded from active revenue &amp; daily collection.
    </div>` : ''}

    <!-- TWO-COLUMN GUEST INFO & STAY DETAILS -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <tr>
        <!-- Left: GUEST INFORMATION -->
        <td style="width:50%; vertical-align:top; padding-right:16px;">
          <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#000; margin-bottom:8px;">
            GUEST INFORMATION
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; line-height:1.65;">
            <tr>
              <td style="width:75px; font-weight:700; color:#222; vertical-align:top;">Name:</td>
              <td style="color:#000; font-weight:600;">${esc(d.guestName)}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Email:</td>
              <td style="color:#000;">${esc(d.guestEmail || (h.email ? d.guestName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@gmail.com' : '')) || '—'}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Phone:</td>
              <td style="color:#000;">${esc(d.guestMobile ? (d.guestMobile.startsWith('+') ? d.guestMobile : `(+91) ${d.guestMobile}`) : '—')}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Location:</td>
              <td style="color:#000;">${esc(guestLocation)}</td>
            </tr>
            ${d.companyName ? `
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Company:</td>
              <td style="color:#000; font-weight:600;">${esc(d.companyName)}</td>
            </tr>` : ''}
            ${d.companyGstin ? `
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">GSTIN:</td>
              <td style="color:#000; font-family:monospace; font-weight:700;">${esc(d.companyGstin)}</td>
            </tr>` : ''}
          </table>
        </td>

        <!-- Right: STAY DETAILS -->
        <td style="width:50%; vertical-align:top; padding-left:16px;">
          <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#000; margin-bottom:8px;">
            STAY DETAILS
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; line-height:1.65;">
            <tr>
              <td style="width:105px; font-weight:700; color:#222; vertical-align:top;">Check-In:</td>
              <td style="color:#000;">${esc(checkInDisplay)}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Check-Out:</td>
              <td style="color:#000;">${esc(checkOutDisplay)}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Duration:</td>
              <td style="color:#000; font-weight:600;">${esc(durationDisplay)}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Occupants:</td>
              <td style="color:#000;">${esc(occupantsDisplay)}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Booking Source:</td>
              <td style="color:#000;">${esc(d.bookingSource || 'Walkin')}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#222; vertical-align:top;">Room No:</td>
              <td style="color:#000; font-weight:700;">${esc(d.roomNumber || d.roomLabel)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ITEMIZED CHARGES TABLE -->
    <div style="margin-bottom:20px;">
      <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:${isCreditNote ? '#991B1B' : '#000'}; margin-bottom:6px;">
        ${isCreditNote ? 'REVERSED / CREDITED CHARGES' : 'ITEMIZED CHARGES'}
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#ECECEC; border-top:1px solid #D1D5DB; border-bottom:1px solid #D1D5DB;">
            <th style="padding:7px 10px; text-align:left; font-weight:700; color:#000; width:30%;">Item / Service</th>
            <th style="padding:7px 10px; text-align:left; font-weight:700; color:#000; width:22%;">Assigned Unit</th>
            <th style="padding:7px 10px; text-align:center; font-weight:700; color:#000; width:18%;">Dates</th>
            <th style="padding:7px 10px; text-align:center; font-weight:700; color:#000; width:12%;">Qty / Nights</th>
            <th style="padding:7px 10px; text-align:right; font-weight:700; color:#000; width:18%;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          ${itemizedChargeRows}
        </tbody>
      </table>
    </div>

    <!-- LOWER TWO-COLUMN: PAYMENT DETAILS & INVOICE SUMMARY -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
      <tr>
        <!-- Left Column: PAYMENT DETAILS & GUEST NOTES -->
        <td style="width:50%; vertical-align:top; padding-right:16px;">
          <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:${isCreditNote ? '#991B1B' : '#000'}; margin-bottom:6px;">
            ${isCreditNote ? 'REVERSED PAYMENTS (NON-REVENUE AUDIT)' : 'PAYMENT DETAILS'}
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:18px;">
            <thead>
              <tr style="background:#ECECEC; border-top:1px solid #D1D5DB; border-bottom:1px solid #D1D5DB;">
                <th style="padding:6px 8px; text-align:left; font-weight:700; color:#000;">${isCreditNote ? 'Date' : 'Date of Payment'}</th>
                <th style="padding:6px 8px; text-align:left; font-weight:700; color:#000;">Mode</th>
                <th style="padding:6px 8px; text-align:center; font-weight:700; color:#000;">Reference</th>
                <th style="padding:6px 8px; text-align:right; font-weight:700; color:#000;">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRowsHtml}
            </tbody>
          </table>

          <!-- GUEST NOTES -->
          <div>
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.4px; color:#000; margin-bottom:6px; display:inline-block; background:#ECECEC; padding:2px 8px; border-radius:2px;">
              ${isCreditNote ? 'CREDIT NOTE AUDIT NOTES' : 'GUEST NOTES'}
            </div>
            <ul style="margin:4px 0 0 16px; padding:0; font-size:11px; color:#333; line-height:1.65;">
              ${isCreditNote ? `
              <li>This Credit Note reverses Original Invoice <strong>${esc(origInvoiceRef || '—')}</strong> for Booking <strong>${esc(d.reservationNo || '—')}</strong>.</li>
              <li>Original finalized invoice remains preserved as Superseded for full audit compliance.</li>
              <li>This document is a non-revenue reversal record — no new payment was collected.</li>
              ${d.creditNoteReason ? `<li>${esc(d.creditNoteReason)}</li>` : ''}
              ` : `
              <li>Standard reservation guaranteed.</li>
              <li>Please present valid photo ID during check-in.</li>
              <li>Valid Government Photo ID (Aadhaar / Passport / DL) required at front desk.</li>
              ${d.footerNote ? `<li>${esc(d.footerNote)}</li>` : ''}
              `}
            </ul>
          </div>
        </td>

        <!-- Right Column: INVOICE SUMMARY -->
        <td style="width:50%; vertical-align:top; padding-left:16px;">
          <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:${isCreditNote ? '#991B1B' : '#000'}; margin-bottom:6px;">
            ${isCreditNote ? 'CREDIT NOTE SUMMARY' : 'INVOICE SUMMARY'}
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <tbody>
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">${isCreditNote ? 'Reversed Base Subtotal' : 'Base Subtotal'}</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:${isCreditNote ? '#991B1B' : '#000'};">${signedMoney(displayBaseSubtotal)}</td>
              </tr>
              ${showSeparateTaxableRow ? `
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#555;">${isCreditNote ? 'Reversed Taxable Value (excl. GST-Exempt)' : 'Taxable Value (excl. GST-Exempt)'}</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:#444;">${signedMoney(displayTaxableBase)}</td>
              </tr>` : ''}
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">${isCreditNote ? `Reversed Taxes (${esc(taxBreakdownLabel)})` : `Taxes (${esc(taxBreakdownLabel)})`}</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:${isCreditNote ? '#991B1B' : '#000'};">${signedMoney(displayTaxTotal)}</td>
              </tr>
              ${!isCreditNote && b.discount > 0 ? `
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">Discount</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:#000;">- Rs. ${money(b.discount)}</td>
              </tr>` : ''}
              <tr style="background:${isCreditNote ? '#FEF2F2' : '#ECECEC'}; border-top:1px solid ${isCreditNote ? '#FCA5A5' : '#9CA3AF'}; border-bottom:1px solid ${isCreditNote ? '#FCA5A5' : '#9CA3AF'};">
                <td style="padding:7.5px 8px; font-size:13px; font-weight:800; color:${isCreditNote ? '#991B1B' : '#000'};">${isCreditNote ? 'Total Credit / Reversal' : 'Grand Total'}</td>
                <td style="padding:7.5px 8px; text-align:right; font-size:13px; font-weight:800; color:${isCreditNote ? '#991B1B' : '#000'};">${signedMoney(displayGrandTotal)}</td>
              </tr>
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">${isCreditNote ? 'New Payment Collected' : 'Total Paid'}</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:#000;">${signedMoney(isCreditNote ? 0 : b.receipts)}</td>
              </tr>
              <tr style="background:#ECECEC; border-top:1px solid #9CA3AF; border-bottom:1px solid #9CA3AF;">
                <td style="padding:7.5px 8px; font-size:13px; font-weight:800; color:#000;">${isCreditNote ? 'Net Payable Balance' : 'Balance Due'}</td>
                <td style="padding:7.5px 8px; text-align:right; font-size:13px; font-weight:800; color:#000;">Rs. ${money(balanceValue)}</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </table>

  </div>

  <!-- BOTTOM: HOTEL POLICY & THANK YOU NOTE -->
  <div>
    <!-- HOTEL POLICY BANNER -->
    <div style="background:#ECECEC; padding:9px 12px; border-radius:2px; margin:16px 0 14px 0;">
      <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.4px; color:#000; margin-bottom:4px;">
        HOTEL POLICY
      </div>
      <div style="font-size:11px; color:#222; line-height:1.4;">
        Non-Refundable. If you lose any personal items, the hotel will not be responsible.
      </div>
    </div>

    <!-- CENTERED THANK YOU FOOTER -->
    <div style="text-align:center; font-style:italic; font-weight:700; font-size:13.5px; color:#111; margin:8px 0 4px 0;">
      Thank you for choosing ${esc(h.name || 'Hotel Grant Heights')}!
    </div>
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// GUEST REGISTRATION CARD (HOTEL RAJ RESIDENCY layout)
// ---------------------------------------------------------------------------
export function defaultGrcTerms(checkInTime = '12pm noon', checkOutTime = '11am'): string[] {
  return [
    `Check-in and Check-out time:- 'Check - in' time is ${checkInTime}. 'Check - out' time is ${checkOutTime}. Early check-in and late check-out are subject to availability and may incur additional charges.`,
    `Luggage Storage:- Luggage can be stored at the guest's sole risk.`,
    `Valuables:- Hotel guests are requested not to leave any valuables open. Any valuables left in the room will be at the guest's own risk and the hotel will not be responsible for any such losses.`,
    `Pets:- Pets are not allowed unless specifically permitted in writing at the time of booking.`,
    `Government Rules & Regulations:- Guests are requested to observe the government rules in force for registrations. Fire arms, alcoholic drinks etc.`,
    `Right of Admission:- Management reserves the right of admission and may ask any guest to vacate their room at any time without any notice or reason. Non-compliance may result in the guest's belongings being removed and the room being secured.`,
    `Use of Hotel Facilities:- The guest should abide by and follow the rules laid by the management. In case of the damage to the hotel property by the guest, they will be liable to compensate the hotel for the same.`,
    `I agree that my liability for the bill is not waived and agree to be held personally liable in the event that the indicated person, company or association fails to pay part or full amount of the charges on the bill.`,
    `Occupancy Policy:- Maximum two adults are allowed in the room. Children under the age of 6 stay free when sharing existing beds with parents. Extra beds are available on request at an additional charge. Unregistered guests are not allowed in the rooms.`,
    `Wifi:- Internet access is provided via the hotel's Wi-Fi. Guests are solely responsible for their use of the network.`,
  ];
}

export function renderGrcHtml(d: GrcPrintData): string {
  const h = d.hotel;
  const terms = d.terms && d.terms.length ? d.terms : defaultGrcTerms(d.checkInTime, d.checkOutTime);
  const row = (label: string, value: unknown, extraLabel?: string, extraValue?: unknown) => `
    <tr>
      <td style="width:190px;padding:3px 4px">${esc(label)}</td>
      <td style="padding:3px 4px">:&nbsp; ${esc(value)}</td>
      ${extraLabel !== undefined ? `<td class="right" style="padding:3px 4px;white-space:nowrap">${esc(extraLabel)}</td><td style="padding:3px 4px;width:120px">${esc(extraValue)}</td>` : '<td></td><td></td>'}
    </tr>`;
  const office = (l1: string, v1: unknown, l2: string, v2: unknown) => `
    <tr>
      <td style="width:150px;padding:3px 4px">${esc(l1)}</td><td style="padding:3px 4px">: ${esc(v1)}</td>
      <td style="width:150px;padding:3px 4px">${esc(l2)}</td><td style="padding:3px 4px">: ${esc(v2)}</td>
    </tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GRC ${esc(d.regNo)}</title>
<style>${BASE_CSS}
  .grc-box { border: 1px solid #000; }
  .terms { font-size: 10.5px; line-height: 1.4; }
</style></head><body><div class="sheet">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:70px">${h.logoUrl ? `<img src="${esc(h.logoUrl)}" alt="" style="max-width:70px;max-height:70px;object-fit:contain"/>` : ''}</div>
    <div class="center" style="flex:1;line-height:1.5">
      <div style="font-size:20px;font-weight:700">${esc(String(h.name || '').toUpperCase())}</div>
      ${h.address ? `<div>${esc(h.address)}</div>` : ''}
      ${h.phone ? `<div>Phone No. :- &nbsp;${esc(h.phone)}</div>` : ''}
      ${h.gstNumber ? `<div>GST No.:- &nbsp;${esc(h.gstNumber)}</div>` : ''}
    </div>
    <div style="width:70px"></div>
  </div>

  <div class="center bold" style="font-size:15px;margin:14px 0 8px;text-decoration:underline">GUEST REGISTRATION CARD</div>

  <table><tr>
    <td class="bold">REG No. - ${esc(d.regNo)}</td>
    <td class="right bold">Date :- ${esc(d.date)}</td>
  </tr></table>

  <table class="grc-box" style="margin-top:6px">
    ${row('Guest Name', String(d.guestName || '').toUpperCase())}
    ${row('Address', String(d.address || '').toUpperCase())}
    ${row('City/State', `${d.city || ''} / ${d.state || ''}`, 'Nationality :', d.nationality || 'India')}
    ${row('Mobile/Tel. No.', d.mobile || '')}
    ${row('No. of Person', `Adults : ${d.adults ?? ''}/ Child: ${d.children ?? ''}`)}
    ${row('Arrival Date', d.arrival || '')}
    ${row('Exp. Departure', d.departure || '')}
  </table>

  <div class="bold" style="margin-top:8px">FOR OFFICE USE ONLY</div>
  <table class="grc-box">
    ${office('Room No.', d.roomNo || '—', 'Room Type', d.roomType || 'Standard')}
    ${office('Room Charge', (d.roomCharge !== '' && d.roomCharge !== undefined && d.roomCharge !== null) ? (typeof d.roomCharge === 'number' || !isNaN(Number(d.roomCharge)) ? `₹${Number(d.roomCharge).toLocaleString('en-IN')}` : String(d.roomCharge)) : '—', 'Plan Name', d.planName || 'EP')}
    ${office('Tax', d.taxMode || '—', 'Booking No.', d.bookingNo || '—')}
    ${office('Company', d.company || 'Walk-in', 'Voucher No.', d.voucherNo || '—')}
    ${office('Guest ID', String(d.guestIdType || 'Government ID').toUpperCase(), 'ID Number', d.guestIdNumber || '—')}
  </table>

  <div class="terms" style="margin-top:18px">
    <div style="margin-bottom:4px">The following are the terms and conditions of the Agreement Under which rooms are permitted to be used by the guests and are binding on them :-</div>
    ${terms.map((t, i) => `<div>${i + 1}. ${esc(t)}</div>`).join('')}
  </div>

  <table style="margin-top:60px"><tr>
    <td class="center" style="width:33%"><div style="border-top:1px solid #000;margin:0 16px;padding-top:4px">Front Office Manager</div></td>
    <td class="center" style="width:34%"><div style="border-top:1px solid #000;margin:0 16px;padding-top:4px">FOA</div></td>
    <td class="center" style="width:33%"><div style="border-top:1px solid #000;margin:0 16px;padding-top:4px">Guest Signature</div></td>
  </tr></table>
</div></body></html>`;
}
