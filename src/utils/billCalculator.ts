/**
 * DirectStay — SINGLE SOURCE OF TRUTH for every guest bill / invoice calculation.
 *
 * This file is intentionally framework-free (no React, no app types) so the exact same file
 * runs in the Web PMS (/admin + legacy screens) and the Mobile Admin App. The PHP backend
 * (api/bill_calculator.php) is a line-by-line port of this file and is verified against the
 * same fixtures (scripts/bill_calculator_fixtures.json).
 *
 * Rules:
 *  1. Every charge enters the bill exactly ONCE (folio de-duplication by source key).
 *  2. Food enters PRE-TAX. GST is applied exactly ONCE, by the bill, using Settings rates.
 *  3. Room-type charges (room / extra bed / extra person / early check-in / late check-out)
 *     use Room GST %. Food uses F&B GST %. Water / Services / Laundry use Room GST % only when
 *     "taxOnAncillary" is ON (else 0%). Damage fines are never taxed.
 *  4. When "roomRateIncludesGst" is ON, room-type amounts are GST-inclusive and are split
 *     back into taxable + GST (e.g. ₹1300 @5% => ₹1238.10 + ₹61.90).
 *  5. Discount reduces the room slab first, then the remaining slabs in order.
 *  6. All money is rounded to 2 decimals (paise). No hidden round-off.
 */

export type BillChargeKind =
  | 'room'
  | 'extra_bed'
  | 'extra_person'
  | 'early_checkin'
  | 'late_checkout'
  | 'food'
  | 'water'
  | 'laundry'
  | 'service'
  | 'fine'
  | 'other';

export interface BillCharge {
  id: string;
  kind: BillChargeKind;
  description: string;
  /** Amount as entered. Food = PRE-TAX amount. Room-type = inclusive/exclusive per settings. */
  amount: number;
  date?: string;
  roomNumber?: string;
  quantity?: number;
  rate?: number;
  nights?: number;
  /** De-duplication key, e.g. "pos:ORD-1", "water:WB-1", "laundry:LND-1". */
  sourceKey?: string;
  /** True when a KOT / food order was explicitly marked "Exclude GST" at KOT printing time. */
  gstExempt?: boolean;
}

export interface BillPayment {
  id: string;
  amount: number; // negative = refund
  method: string;
  date?: string;
  reference?: string;
  note?: string;
}

export interface BillSettings {
  roomGstRate: number;
  foodGstRate: number;
  taxOnAncillary: boolean;
  roomRateIncludesGst: boolean;
  roomSac: string;
  foodSac: string;
  laundrySac: string;
  otherSac: string;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  grcPrefix: string;
  nextGrcSequence: number;
  waterBottleRate: number;
}

export interface BillInput {
  charges: BillCharge[];
  payments: BillPayment[];
  discount?: number;
  /** Invoice-level "☑ GST Invoice" tick. false => Bill of Supply (0% everywhere). */
  gstEnabled: boolean;
  settings: BillSettings;
}

export interface BillLedgerLine {
  type: 'charge' | 'tax' | 'discount' | 'receipt';
  dateLabel: string;
  roomNumber: string;
  description: string;
  sac: string;
  charges: number;
  receipts: number;
  kind?: BillChargeKind;
  sourceId?: string;
}

export interface BillTaxRow {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  tax: number;
}

export interface BillResult {
  lines: BillLedgerLine[];
  chargeLines: BillLedgerLine[];
  taxRows: BillTaxRow[];
  totalsByKind: Record<BillChargeKind, number>;
  /** Chronological date-wise & mode-wise payment entries included in this bill. */
  paymentItems?: BillPayment[];
  /** Aggregated mode-wise payment totals for quick bill reconciliation. */
  paymentsByMode?: Array<{ method: string; amount: number; count: number }>;
  /** Sum of pre-tax charges before discount. */
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  grandTotal: number;
  receipts: number;
  balance: number;
  refundDue: number;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
  isGstInvoice: boolean;
  /** Effective headline GST rate (room slab) — for legacy single-rate fields. */
  headlineGstRate: number;
  amountInWords: string;
  /** Legacy Invoice breakdown fields (pre-tax, after discount NOT applied). */
  legacy: {
    roomCharges: number;
    extraBedCharges: number;
    extraPersonCharges: number;
    earlyCheckInCharges: number;
    lateCheckOutCharges: number;
    foodCharges: number;
    waterCharges: number;
    laundryCharges: number;
    serviceCharges: number;
    fineCharges: number;
    otherCharges: number;
  };
}

export const DEFAULT_BILL_SETTINGS: BillSettings = {
  roomGstRate: 5,
  foodGstRate: 5,
  taxOnAncillary: true,
  roomRateIncludesGst: false,
  roomSac: '996311',
  foodSac: '996331',
  laundrySac: '999712',
  otherSac: '996311',
  invoicePrefix: 'INV',
  nextInvoiceSequence: 1001,
  grcPrefix: 'GRC',
  nextGrcSequence: 1,
  waterBottleRate: 20,
};

const ROOM_KINDS: BillChargeKind[] = ['room', 'extra_bed', 'extra_person', 'early_checkin', 'late_checkout'];
const ANCILLARY_KINDS: BillChargeKind[] = ['water', 'laundry', 'service', 'other'];
const KIND_ORDER: BillChargeKind[] = [
  'room',
  'extra_bed',
  'extra_person',
  'early_checkin',
  'late_checkout',
  'food',
  'water',
  'service',
  'laundry',
  'other',
  'fine',
];

export const r2 = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  // Half-up (away from zero) on paise with a tiny epsilon so 1.005 => 1.01 — identical rule in PHP port.
  const sign = v < 0 ? -1 : 1;
  return (sign * Math.floor(Math.abs(v) * 100 + 0.5 + 1e-6)) / 100;
};

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const firstDefined = (...vals: unknown[]): unknown => vals.find((v) => v !== undefined && v !== null && v !== '');

/**
 * Normalizes hotel settings coming from ANY source (Web HotelSettings / Hotel, hub taxSettings
 * localStorage {roomCgst, roomSgst, fnbCgst, fnbSgst}, Mobile hotel profile) into BillSettings.
 */
export function normalizeBillSettings(...sources: Array<Record<string, any> | null | undefined>): BillSettings {
  const merged: Record<string, any> = {};
  sources.filter(Boolean).forEach((s) => {
    Object.keys(s as object).forEach((k) => {
      const v = (s as any)[k];
      if (v !== undefined && v !== null && v !== '') merged[k] = v;
    });
  });

  const roomFromSplit =
    merged.roomCgst !== undefined || merged.roomSgst !== undefined
      ? num(merged.roomCgst) + num(merged.roomSgst)
      : undefined;
  const foodFromSplit =
    merged.fnbCgst !== undefined || merged.fnbSgst !== undefined
      ? num(merged.fnbCgst) + num(merged.fnbSgst)
      : undefined;

  const gstDisabled = merged.isGstEnabled === false;
  const roomGstRate = gstDisabled
    ? 0
    : num(firstDefined(merged.roomGstRate, merged.defaultGstRate, roomFromSplit), DEFAULT_BILL_SETTINGS.roomGstRate);
  const foodGstRate = gstDisabled
    ? 0
    : num(firstDefined(merged.foodGstRate, foodFromSplit, roomGstRate), DEFAULT_BILL_SETTINGS.foodGstRate);

  const prefixRaw = String(firstDefined(merged.invoicePrefix, DEFAULT_BILL_SETTINGS.invoicePrefix));
  return {
    roomGstRate: Math.max(0, r2(roomGstRate)),
    foodGstRate: Math.max(0, r2(foodGstRate)),
    taxOnAncillary: merged.taxOnAncillary !== undefined ? Boolean(merged.taxOnAncillary) : DEFAULT_BILL_SETTINGS.taxOnAncillary,
    roomRateIncludesGst: Boolean(merged.roomRateIncludesGst),
    roomSac: String(firstDefined(merged.roomSacCode, merged.roomSac, DEFAULT_BILL_SETTINGS.roomSac)),
    foodSac: String(firstDefined(merged.fnbSacCode, merged.foodSac, DEFAULT_BILL_SETTINGS.foodSac)),
    laundrySac: String(firstDefined(merged.laundrySacCode, merged.laundrySac, DEFAULT_BILL_SETTINGS.laundrySac)),
    otherSac: String(firstDefined(merged.otherSac, DEFAULT_BILL_SETTINGS.otherSac)),
    invoicePrefix: prefixRaw.replace(/[-/\s]+$/, '') || DEFAULT_BILL_SETTINGS.invoicePrefix,
    nextInvoiceSequence: Math.max(1, Math.floor(num(firstDefined(merged.nextInvoiceSequence, merged.startingInvoiceNumber), DEFAULT_BILL_SETTINGS.nextInvoiceSequence))),
    grcPrefix: String(firstDefined(merged.grcPrefix, DEFAULT_BILL_SETTINGS.grcPrefix)).replace(/[-/\s]+$/, ''),
    nextGrcSequence: Math.max(1, Math.floor(num(merged.nextGrcSequence, DEFAULT_BILL_SETTINGS.nextGrcSequence))),
    waterBottleRate: Math.max(0, num(merged.waterBottleRate, DEFAULT_BILL_SETTINGS.waterBottleRate)),
  };
}

function sacFor(kind: BillChargeKind, s: BillSettings): string {
  if (kind === 'food') return s.foodSac;
  if (kind === 'laundry') return s.laundrySac;
  if (kind === 'fine') return '';
  if (ROOM_KINDS.includes(kind)) return s.roomSac;
  return s.otherSac;
}

/** GST % that applies to a charge kind for this bill. */
export function gstRateFor(kind: BillChargeKind, gstEnabled: boolean, s: BillSettings): number {
  if (!gstEnabled) return 0;
  if (kind === 'fine') return 0;
  if (kind === 'food') return s.foodGstRate;
  if (ROOM_KINDS.includes(kind)) return s.roomGstRate;
  if (ANCILLARY_KINDS.includes(kind)) return s.taxOnAncillary ? s.roomGstRate : 0;
  return 0;
}

/** Removes duplicate charges that point to the same source (EC-POS-x ⇔ x, etc.). */
export function dedupeCharges(charges: BillCharge[]): BillCharge[] {
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const out: BillCharge[] = [];
  charges.forEach((c) => {
    if (!c || !(num(c.amount) > 0)) return;
    const key = c.sourceKey ? c.sourceKey.toLowerCase() : '';
    if (key && seenKeys.has(key)) return;
    if (c.id && seenIds.has(c.id)) return;
    if (key) seenKeys.add(key);
    if (c.id) seenIds.add(c.id);
    out.push(c);
  });
  return out;
}

/** Derives a canonical de-dup key from an id like "EC-POS-123", "EC-WB-WB-9", "EC-LND-4". */
export function sourceKeyFromId(id?: string, sourceType?: string, sourceId?: string): string | undefined {
  const st = String(sourceType || '').toLowerCase();
  if (sourceId) {
    if (st.includes('pos')) return `pos:${sourceId}`;
    if (st.includes('laundry')) return `laundry:${sourceId}`;
    if (st.includes('water')) return `water:${sourceId}`;
    if (st.includes('service')) return `service:${sourceId}`;
    return `${st || 'src'}:${sourceId}`;
  }
  const raw = String(id || '');
  const m = raw.match(/^EC-(POS|WB|LND|SRV|SVC)-(.+)$/i);
  if (m) {
    const t = m[1].toUpperCase();
    const map: Record<string, string> = { POS: 'pos', WB: 'water', LND: 'laundry', SRV: 'service', SVC: 'service' };
    return `${map[t]}:${m[2]}`;
  }
  return undefined;
}

export function calculateBill(input: BillInput): BillResult {
  const s = input.settings || DEFAULT_BILL_SETTINGS;
  const gstEnabled = Boolean(input.gstEnabled);
  const charges = dedupeCharges(input.charges || []).sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
  );

  // 1. Pre-tax value per charge
  type Priced = BillCharge & { preTax: number; gstRate: number };
  const priced: Priced[] = charges.map((c) => {
    const rate = c.gstExempt ? 0 : gstRateFor(c.kind, gstEnabled, s);
    const amt = r2(c.amount);
    const inclusive = s.roomRateIncludesGst && ROOM_KINDS.includes(c.kind) && rate > 0;
    const preTax = inclusive ? r2(amt / (1 + rate / 100)) : amt;
    return { ...c, amount: amt, preTax, gstRate: rate };
  });

  const totalsByKind = KIND_ORDER.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as Record<BillChargeKind, number>);
  priced.forEach((p) => {
    totalsByKind[p.kind] = r2(totalsByKind[p.kind] + p.preTax);
  });

  const subtotal = r2(priced.reduce((sum, p) => sum + p.preTax, 0));
  const discount = Math.min(subtotal, Math.max(0, r2(input.discount || 0)));

  // 2. Group taxable by GST rate (slab), room slab first
  const roomRate = gstRateFor('room', gstEnabled, s);
  const slabOrder: number[] = [];
  const slabBase = new Map<number, number>();
  priced.forEach((p) => {
    if (!slabBase.has(p.gstRate)) {
      slabBase.set(p.gstRate, 0);
      slabOrder.push(p.gstRate);
    }
    slabBase.set(p.gstRate, r2((slabBase.get(p.gstRate) || 0) + p.preTax));
  });
  slabOrder.sort((a, b) => (a === roomRate ? -1 : b === roomRate ? 1 : b - a));

  // 3. Apply discount (room slab first)
  let remainingDisc = discount;
  const slabTaxable = new Map<number, number>();
  slabOrder.forEach((rate) => {
    const base = slabBase.get(rate) || 0;
    const cut = Math.min(base, remainingDisc);
    remainingDisc = r2(remainingDisc - cut);
    slabTaxable.set(rate, r2(base - cut));
  });

  // 4. Tax per slab (inclusive room slab keeps the exact gross)
  const taxRows: BillTaxRow[] = [];
  slabOrder.forEach((rate) => {
    if (rate <= 0) return;
    const taxable = slabTaxable.get(rate) || 0;
    let tax: number;
    const grossInclusive =
      s.roomRateIncludesGst && rate === roomRate && discount === 0
        ? r2(priced.filter((p) => p.gstRate === rate && ROOM_KINDS.includes(p.kind)).reduce((x, p) => x + p.amount, 0))
        : 0;
    const exclusivePart = r2(
      priced.filter((p) => p.gstRate === rate && !ROOM_KINDS.includes(p.kind)).reduce((x, p) => x + p.preTax, 0)
    );
    if (grossInclusive > 0) {
      const inclTaxable = r2(taxable - exclusivePart);
      tax = r2(grossInclusive - inclTaxable + (exclusivePart * rate) / 100);
    } else {
      tax = r2((taxable * rate) / 100);
    }
    const cgst = r2(tax / 2);
    const sgst = r2(tax - cgst);
    taxRows.push({ rate, taxable, cgst, sgst, tax });
  });

  const taxableAmount = r2(subtotal - discount);
  const cgst = r2(taxRows.reduce((x, t) => x + t.cgst, 0));
  const sgst = r2(taxRows.reduce((x, t) => x + t.sgst, 0));
  const totalTax = r2(cgst + sgst);
  const grandTotal = r2(taxableAmount + totalTax);

  const payments = (input.payments || [])
    .filter((p) => p && num(p.amount) !== 0)
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const modeMap = new Map<string, { method: string; amount: number; count: number }>();
  payments.forEach((p) => {
    const mLabel = String(p.method || 'Cash').trim() || 'Cash';
    const key = mLabel.toUpperCase();
    const cur = modeMap.get(key) || { method: mLabel, amount: 0, count: 0 };
    cur.amount = r2(cur.amount + num(p.amount));
    cur.count += 1;
    modeMap.set(key, cur);
  });
  const paymentsByMode = Array.from(modeMap.values());
  const receipts = r2(payments.reduce((x, p) => x + num(p.amount), 0));
  const diff = r2(grandTotal - receipts);
  const balance = Math.max(0, diff);
  const refundDue = Math.max(0, r2(-diff));
  const paymentStatus: BillResult['paymentStatus'] =
    grandTotal > 0 && balance <= 0 ? 'Paid' : receipts > 0 ? 'Partially Paid' : grandTotal <= 0 ? 'Paid' : 'Unpaid';

  // 5. Ledger lines (PDF layout: Date | Room | Description | HSN/SAC | Charges | Receipts)
  const chargeLines: BillLedgerLine[] = priced.map((p) => {
    let dateLabel = p.date || '';
    let description = p.description;
    if (p.kind === 'room') {
      const n = Math.max(1, num(p.nights, 1));
      dateLabel = `${n} Night${n > 1 ? 's' : ''}`;
      const perNight = p.rate !== undefined ? r2(num(p.rate) / (s.roomRateIncludesGst && p.gstRate > 0 ? 1 + p.gstRate / 100 : 1)) : r2(p.preTax / n);
      description = `Room Charges @ ${formatMoney(perNight)}`;
    }
    return {
      type: 'charge',
      dateLabel,
      roomNumber: p.roomNumber || '',
      description,
      sac: sacFor(p.kind, s),
      charges: p.preTax,
      receipts: 0,
      kind: p.kind,
      sourceId: p.id,
    };
  });

  const lines: BillLedgerLine[] = [...chargeLines];
  const firstRoom = priced.find((p) => p.roomNumber)?.roomNumber || '';
  if (discount > 0) {
    lines.push({ type: 'discount', dateLabel: '', roomNumber: firstRoom, description: 'Less: Discount', sac: '', charges: -discount, receipts: 0 });
  }
  taxRows.forEach((t) => {
    const half = r2(t.rate / 2);
    lines.push({ type: 'tax', dateLabel: '', roomNumber: firstRoom, description: `CGST @ ${half}%`, sac: '', charges: t.cgst, receipts: 0 });
    lines.push({ type: 'tax', dateLabel: '', roomNumber: firstRoom, description: `SGST @ ${half}%`, sac: '', charges: t.sgst, receipts: 0 });
  });
  payments.forEach((p) => {
    const amt = r2(p.amount);
    const modeStr = p.method ? String(p.method).trim() : 'Cash';
    const metaParts = [
      p.reference ? `Ref: ${p.reference}` : '',
      p.note && p.note !== 'Payment Received' ? p.note : '',
    ].filter(Boolean);
    lines.push({
      type: 'receipt',
      dateLabel: formatDateLabel(p.date),
      roomNumber: firstRoom,
      description:
        amt < 0
          ? `Refund (${modeStr})${metaParts.length ? ` — ${metaParts.join(' • ')}` : ''}`
          : `Receipt — ${modeStr}${metaParts.length ? `\n${metaParts.join(' • ')}` : ''}`,
      sac: '',
      charges: 0,
      receipts: amt,
      sourceId: p.id,
    });
  });

  const sumKind = (...k: BillChargeKind[]) => r2(k.reduce((x, kk) => x + totalsByKind[kk], 0));
  return {
    lines,
    chargeLines,
    taxRows,
    totalsByKind,
    paymentItems: payments,
    paymentsByMode,
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
    paymentStatus,
    isGstInvoice: gstEnabled && totalTax > 0,
    headlineGstRate: gstEnabled ? roomRate : 0,
    amountInWords: amountToIndianWords(grandTotal),
    legacy: {
      roomCharges: sumKind('room'),
      extraBedCharges: sumKind('extra_bed'),
      extraPersonCharges: sumKind('extra_person'),
      earlyCheckInCharges: sumKind('early_checkin'),
      lateCheckOutCharges: sumKind('late_checkout'),
      foodCharges: sumKind('food'),
      waterCharges: sumKind('water'),
      laundryCharges: sumKind('laundry'),
      serviceCharges: sumKind('service'),
      fineCharges: sumKind('fine'),
      otherCharges: sumKind('other'),
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (shared by print templates)
// ---------------------------------------------------------------------------

export function formatMoney(n: number): string {
  return r2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-11-04" | ISO | "04/11/2025" => "04-Nov-2025" */
export function formatDateLabel(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  let y = 0;
  let m = 0;
  let d = 0;
  let mm: RegExpMatchArray | null;
  if ((mm = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    y = +mm[1];
    m = +mm[2];
    d = +mm[3];
  } else if ((mm = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/))) {
    d = +mm[1];
    m = +mm[2];
    y = +mm[3];
  } else {
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return s;
    y = dt.getFullYear();
    m = dt.getMonth() + 1;
    d = dt.getDate();
  }
  if (!y || !m || !d) return s;
  return `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${y}`;
}

/** Indian financial year label for a date: Apr–Mar => "2025-26". */
export function financialYearLabel(date: Date = new Date()): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** PREFIX/1014/2025-26 */
export function formatInvoiceNumber(prefix: string, seq: number, date: Date = new Date()): string {
  const p = String(prefix || 'INV').replace(/[-/\s]+$/, '');
  return `${p}/${seq}/${financialYearLabel(date)}`;
}

/** GRC: PREFIX/452/26 */
export function formatGrcNumber(prefix: string, seq: number, date: Date = new Date()): string {
  const p = String(prefix || 'GRC').replace(/[-/\s]+$/, '');
  return `${p}/${seq}/${String(date.getFullYear() % 100).padStart(2, '0')}`;
}

/**
 * Next free sequence number for a hotel: max(settings.nextInvoiceSequence, highest existing seq + 1).
 * Existing numbers in any legacy format ("INV-2026-0012", "MMPR/1014/2025-26") are parsed.
 */
export function nextInvoiceSequence(existingNumbers: Array<string | undefined>, settingsNext: number): number {
  let maxSeq = 0;
  existingNumbers.forEach((n) => {
    const s = String(n || '');
    const slash = s.match(/\/(\d+)\/\d{4}-\d{2}$/);
    const tail = s.match(/(\d+)$/);
    const v = slash ? +slash[1] : tail ? +tail[1] : 0;
    if (v > maxSeq && v < 100000000) maxSeq = v;
  });
  return Math.max(Math.floor(settingsNext) || 1, maxSeq + 1);
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

export function amountToIndianWords(amount: number): string {
  const total = r2(Math.abs(amount));
  let rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only.';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupees) parts.push(threeDigits(rupees));
  let words = parts.length ? `Rupees ${parts.join(' ')}` : 'Rupees Zero';
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only.`;
}
