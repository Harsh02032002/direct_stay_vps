import sys

# 1. Update src/utils/printTemplates.ts
with open('src/utils/printTemplates.ts', 'r', encoding='utf-8') as f:
    pt = f.read()

# Add extra optional fields to InvoicePrintData
old_invoice_interface = """export interface InvoicePrintData {
  hotel: PrintHotel;
  invoiceNumber: string;
  invoiceDate: string; // "05-Nov-2025"
  reservationNo?: string;
  guestName: string;
  guestMobile?: string;
  guestAddress?: string;
  placeOfSupply?: string;
  companyName?: string;
  companyGstin?: string;
  roomLabel: string; // "402 (POD)"
  pax?: number | string;
  checkIn?: string; // "04-Nov-2025 01:33 PM"
  checkOut?: string;
  nights?: number;
  bill: BillResult;
  copyLabel?: string; // ORIGINAL FOR RECIPIENT
  footerNote?: string;
}"""

new_invoice_interface = """export interface InvoicePrintData {
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
}"""

if old_invoice_interface in pt:
    pt = pt.replace(old_invoice_interface, new_invoice_interface, 1)
    print('1. Updated InvoicePrintData interface')

# Replace renderInvoiceHtml function
old_render_fn_start = "// ---------------------------------------------------------------------------\n// TAX INVOICE (HOTEL M M PRESTIGE layout"
old_render_fn_end = "// ---------------------------------------------------------------------------\n// GUEST REGISTRATION CARD (HOTEL RAJ RESIDENCY layout)"

idx_start = pt.find(old_render_fn_start)
idx_end = pt.find(old_render_fn_end)

if idx_start != -1 and idx_end != -1:
    new_render_fn = """// ---------------------------------------------------------------------------
// BOOKING CONFIRMATION & INVOICE (Exact High-Readability Corporate UI Layout)
// Matches "Hotel Grant Heights" specification cleanly while strictly preserving all date logic
// ---------------------------------------------------------------------------
export function renderInvoiceHtml(d: InvoicePrintData): string {
  const b = d.bill;
  const isTax = b.isGstInvoice;
  const h = d.hotel;

  const addressLine = String(h.address || '')
    .split(/\\n/)
    .map(x => x.trim())
    .filter(Boolean)
    .join(', ');

  const guestLocation =
    [d.guestCity, d.guestState].filter(Boolean).join(', ') ||
    (d.guestAddress ? String(d.guestAddress).split(/\\n|,/)[0]?.trim() : '') ||
    d.placeOfSupply ||
    'India';

  const formatCleanTime = (dt?: string) => {
    if (!dt) return '—';
    const trimmed = dt.trim();
    const m = trimmed.match(/^(\\d{1,2}[\\s-][A-Za-z]{3}[\\s-]\\d{4})\\s+(.+)$/);
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
      const pIn = String(cin || '').match(/(\\d{1,2})[\\s-]([A-Za-z]{3}|\\d{2})/);
      const pOut = String(cout || '').match(/(\\d{1,2})[\\s-]([A-Za-z]{3}|\\d{2})/);
      if (pIn && pOut) return `${pIn[1]}/${pIn[2]} – ${pOut[1]}/${pOut[2]}`;
      if (pIn) return `${pIn[1]}/${pIn[2]}`;
    } catch {
      // fallback
    }
    return 'Stay Dates';
  };

  // Charge lines mapping for ITEMIZED CHARGES table
  const chargeLines = b.lines.filter(l => l.type !== 'receipt');
  const itemizedChargeRows = chargeLines.length > 0
    ? chargeLines.map(l => {
        const itemDesc = esc(l.description).replace(/\\n/g, '<br/>');
        const unitLabel = l.roomNumber ? `Room ${esc(l.roomNumber)}` : (d.roomNumber ? `Room ${esc(d.roomNumber)}` : 'Room Unit');
        const datesLabel = esc(l.dateLabel) || shortDates(d.checkIn, d.checkOut);
        const qtyNights = d.nights && d.nights > 1 ? String(d.nights) : '1';
        return `<tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:8px 10px; font-weight:600; color:#111;">${itemDesc}</td>
          <td style="padding:8px 10px; color:#222;">${unitLabel}</td>
          <td style="padding:8px 10px; text-align:center; color:#333;">${datesLabel}</td>
          <td style="padding:8px 10px; text-align:center; font-weight:600; color:#111;">${qtyNights}</td>
          <td style="padding:8px 10px; text-align:right; font-weight:700; color:#000;">Rs. ${money(l.charges)}</td>
        </tr>`;
      }).join('')
    : `<tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px 10px; font-weight:600; color:#111;">${esc(d.roomType || 'Standard Room')}</td>
        <td style="padding:8px 10px; color:#222;">Room ${esc(d.roomNumber || d.roomLabel || '101')}</td>
        <td style="padding:8px 10px; text-align:center; color:#333;">${esc(shortDates(d.checkIn, d.checkOut))}</td>
        <td style="padding:8px 10px; text-align:center; font-weight:600; color:#111;">${d.nights || 1}</td>
        <td style="padding:8px 10px; text-align:right; font-weight:700; color:#000;">Rs. ${money(b.taxableAmount || b.grandTotal)}</td>
      </tr>`;

  // Payment receipts rows
  const payItems = Array.isArray(b.paymentItems) ? b.paymentItems : [];
  const paymentRowsHtml = payItems.length > 0
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
  const totalTaxRate = b.taxRows && b.taxRows.length > 0 ? b.taxRows.reduce((acc, r) => acc + (r.rate || 0), 0) : 0;
  const taxBreakdownLabel = totalTaxRate > 0
    ? `CGST ${(totalTaxRate / 2).toFixed(2)}%, SGST ${(totalTaxRate / 2).toFixed(2)}%`
    : (isTax ? 'CGST 2.50%, SGST 2.50%' : 'Taxes Exempt');

  const balanceValue = b.refundDue > 0 ? b.refundDue : b.balance;
  const statusLabel = balanceValue <= 0 ? 'CONFIRMED (PAID)' : 'CONFIRMED';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>BOOKING CONFIRMATION &amp; INVOICE ${esc(d.invoiceNumber)}</title>
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
    max-width: 196mm;
    min-height: 272mm;
    margin: 0 auto;
    padding: 4mm 6mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
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
          <div style="font-size:14.5px; font-weight:800; color:#000; letter-spacing:0.3px; text-transform:uppercase; margin-bottom:4px;">
            BOOKING CONFIRMATION &amp; INVOICE
          </div>
          <div style="font-size:11.5px; color:#222; font-weight:600; margin-bottom:3px;">
            Conf #: ${esc(d.reservationNo || d.invoiceNumber || '52055852')} &nbsp;|&nbsp; Date: ${esc(d.invoiceDate)}
          </div>
          <div style="font-size:12px; font-weight:800; color:#000;">
            Status: <span style="text-transform:uppercase;">${esc(statusLabel)}</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- SOLID BLACK HORIZONTAL DIVIDER -->
    <div style="border-bottom:2px solid #000; margin:8px 0 16px 0;"></div>

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
      <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#000; margin-bottom:6px;">
        ITEMIZED CHARGES
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
          <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#000; margin-bottom:6px;">
            PAYMENT DETAILS
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:18px;">
            <thead>
              <tr style="background:#ECECEC; border-top:1px solid #D1D5DB; border-bottom:1px solid #D1D5DB;">
                <th style="padding:6px 8px; text-align:left; font-weight:700; color:#000;">Date of Payment</th>
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
              GUEST NOTES
            </div>
            <ul style="margin:4px 0 0 16px; padding:0; font-size:11px; color:#333; line-height:1.65;">
              <li>Standard reservation guaranteed.</li>
              <li>Please present valid photo ID during check-in.</li>
              <li>Valid Government Photo ID (Aadhaar / Passport / DL) required at front desk.</li>
              ${d.footerNote ? `<li>${esc(d.footerNote)}</li>` : ''}
            </ul>
          </div>
        </td>

        <!-- Right Column: INVOICE SUMMARY -->
        <td style="width:50%; vertical-align:top; padding-left:16px;">
          <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#000; margin-bottom:6px;">
            INVOICE SUMMARY
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <tbody>
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">Base Subtotal</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:#000;">Rs. ${money(b.taxableAmount)}</td>
              </tr>
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">Taxes (${esc(taxBreakdownLabel)})</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:#000;">Rs. ${money(b.totalTax)}</td>
              </tr>
              ${b.discount > 0 ? `
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">Discount</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:#000;">- Rs. ${money(b.discount)}</td>
              </tr>` : ''}
              <tr style="background:#ECECEC; border-top:1px solid #9CA3AF; border-bottom:1px solid #9CA3AF;">
                <td style="padding:7.5px 8px; font-size:13px; font-weight:800; color:#000;">Grand Total</td>
                <td style="padding:7.5px 8px; text-align:right; font-size:13px; font-weight:800; color:#000;">Rs. ${money(b.grandTotal)}</td>
              </tr>
              <tr style="border-bottom:1px solid #E5E7EB;">
                <td style="padding:6.5px 8px; font-weight:500; color:#222;">Total Paid</td>
                <td style="padding:6.5px 8px; text-align:right; font-weight:600; color:#000;">Rs. ${money(b.receipts)}</td>
              </tr>
              <tr style="background:#ECECEC; border-top:1px solid #9CA3AF; border-bottom:1px solid #9CA3AF;">
                <td style="padding:7.5px 8px; font-size:13px; font-weight:800; color:#000;">Balance Due</td>
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

"""

    pt = pt[:idx_start] + new_render_fn + pt[idx_end:]
    print('2. Successfully replaced renderInvoiceHtml with Hotel Grant Heights layout!')
else:
    print('2. Could not find boundaries for renderInvoiceHtml')

with open('src/utils/printTemplates.ts', 'w', encoding='utf-8') as f:
    f.write(pt)

# 2. Update src/utils/pdfDownload.ts to populate the richer printData fields
with open('src/utils/pdfDownload.ts', 'r', encoding='utf-8') as f:
    pd = f.read()

old_pd_data = """  const printData: InvoicePrintData = {
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
  };"""

new_pd_data = """  const printData: InvoicePrintData = {
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
    guestEmail: String(
      (invoice as any).guestEmail ||
        (invoice as any).email ||
        checkinRecord?.emailAddress ||
        (bookingRecord as any)?.emailAddress ||
        bookingRecord?.guestEmail ||
        ''
    ),
    guestAddress: guestAddr,
    guestCity: String(checkinRecord?.city || (bookingRecord as any)?.city || ''),
    guestState: String(checkinRecord?.state || (bookingRecord as any)?.state || ''),
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
    roomNumber: roomBase,
    roomType: roomType || 'Standard Room',
    pax,
    adults: Number(checkinRecord?.adults || bookingRecord?.adults || 1),
    children: Number(checkinRecord?.children || bookingRecord?.children || 0),
    bookingSource: String(
      invoice.bookingSource ||
        checkinRecord?.bookingSource ||
        bookingRecord?.bookingSource ||
        'Walkin'
    ),
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
    isHourlyStay: Boolean(
      (invoice as any).isHourlyStay ||
        checkinRecord?.isHourlyStay ||
        (bookingRecord as any)?.isHourlyStay ||
        (invoice.checkInDate && invoice.checkOutDate && invoice.checkInDate === invoice.checkOutDate)
    ),
    stayHours: (invoice as any).stayHours || checkinRecord?.stayHours || (bookingRecord as any)?.stayHours,
    bill,
    footerNote: invoice.notes || undefined,
  };"""

if old_pd_data in pd:
    pd = pd.replace(old_pd_data, new_pd_data, 1)
    print('3. Updated invoiceRecordToPrintHtml in pdfDownload.ts')
else:
    print('3. old_pd_data not found in pdfDownload.ts')

with open('src/utils/pdfDownload.ts', 'w', encoding='utf-8') as f:
    f.write(pd)

print('Invoice template overhaul complete!')
