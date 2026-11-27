import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Scissors, Pencil, Undo2, AlertCircle } from 'lucide-react';
import {
  BillCharge,
  BillPayment,
  BillSettings,
  calculateBill,
  r2,
} from '../../utils/billCalculator';
import { allocateInvoiceNumber, buildInvoiceRecord, isActiveInvoice } from '../../utils/stayBilling';
import { extractDetailedFoodLinesForStay } from '../../utils/pdfDownload';

/**
 * Edit Invoice (Admin Hub → Invoices & Billing)
 *
 * - Works on ONE bill (Room Bill / Food Bill / Combined Bill) or on all three when the stay was split.
 * - If Room & Food were NOT split at Check-Out, the user can split them right here.
 * - Finalized invoices are immutable on the server (audit rule), so Save re-issues a corrected invoice and
 *   marks the old one "Superseded → Replaced by <new no.>" — the full history stays intact.
 */

type AnyRec = Record<string, any>;
type BillTab = 'room' | 'food' | 'combined';
type PayRow = { id: string; amount: string; method: string; date: string; reference: string };
type FoodLine = { id: string; description: string; amount: string };

interface EditInvoiceModalProps {
  invoiceId: string;
  invoices: AnyRec[];
  billSettings: BillSettings;
  appCheckins?: AnyRec[];
  appBookings?: AnyRec[];
  posOrders?: AnyRec[];
  onSave: (nextInvoices: AnyRec[], summary: string) => void;
  onClose: () => void;
}

const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Online', 'Cheque'];

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const scopeOf = (i: AnyRec | null | undefined): string => String(i?.invoiceScope || '').toLowerCase();
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const nightsBetween = (a: string, b: string): number => {
  if (!isIsoDate(a) || !isIsoDate(b)) return 1;
  const d = Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
  return Math.max(1, d || 1);
};
const money = (n: number) =>
  `₹${r2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function rowsFromInvoice(inv: AnyRec | null | undefined, today: string): PayRow[] {
  if (!inv) return [];
  const hist: AnyRec[] = Array.isArray(inv.paymentHistory) ? inv.paymentHistory : [];
  const valid = hist
    .filter((p) => p && num(p.amount) > 0)
    .map((p, i) => ({
      id: String(p.id || `pay-${i}-${Date.now()}`),
      amount: String(r2(num(p.amount))),
      method: String(p.paymentMethod || p.method || 'Cash'),
      date: String(p.date || inv.dateCreated || today).slice(0, 10),
      reference: String(p.referenceNo || p.reference || ''),
    }));
  if (valid.length > 0) return valid;
  const paid = num(inv.amountPaid ?? inv.paidAmount ?? inv.advancePaid);
  return paid > 0
    ? [
        {
          id: `pay-existing-${Date.now()}`,
          amount: String(r2(paid)),
          method: String(inv.paymentMethod || 'Cash'),
          date: String(inv.dateCreated || today).slice(0, 10),
          reference: '',
        },
      ]
    : [];
}

/** Room-first allocation of existing payment rows between the Room Bill and the Food Bill. */
function allocateRows(rows: PayRow[], roomCap: number): { room: PayRow[]; food: PayRow[] } {
  let remaining = Math.max(0, r2(roomCap));
  const room: PayRow[] = [];
  const food: PayRow[] = [];
  rows.forEach((r, idx) => {
    const amt = r2(num(r.amount));
    if (amt <= 0) return;
    if (remaining >= amt) {
      room.push(r);
      remaining = r2(remaining - amt);
    } else if (remaining > 0) {
      room.push({ ...r, id: `${r.id}-r`, amount: String(r2(remaining)) });
      food.push({ ...r, id: `${r.id}-f${idx}`, amount: String(r2(amt - remaining)) });
      remaining = 0;
    } else {
      food.push(r);
    }
  });
  return { room, food };
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500';
const labelCls = 'block text-[10px] font-mono uppercase font-bold text-slate-600 mb-0.5';

const methodSummaryOf = (rows: BillPayment[], fallback: string) =>
  rows.length > 0 ? Array.from(new Set(rows.map((p) => p.method))).join(' + ') : fallback;

export interface AssembleReissueArgs {
  clicked: AnyRec;
  invoices: AnyRec[];
  billSettings: BillSettings;
  group: { isSplit: boolean; roomInv: AnyRec | null; foodInv: AnyRec | null };
  form: {
    guestName: string;
    guestMobile: string;
    roomNoList: string[];
    primaryRoom: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    notes: string;
  };
  bills: { roomBill: AnyRec; foodBill: AnyRec; combinedUnsplitBill: AnyRec };
  chargeCounts: { room: number; food: number };
  pays: { roomPays: BillPayment[]; foodPays: BillPayment[] };
  splitActive: boolean;
  wantSplit: boolean;
  tab: BillTab;
  totals: { grand: number; paid: number; due: number };
  today: string;
}

/**
 * Pure re-issue logic (no React): validates, builds the corrected invoice record(s) and marks the replaced
 * invoice(s) as Superseded. Exported so it can be unit-tested.
 */
export function assembleReissue(
  a: AssembleReissueArgs
): { error: string } | { next: AnyRec[]; summary: string; created: AnyRec[] } {
  const { clicked, invoices, billSettings, group, form, bills, chargeCounts, pays, splitActive, wantSplit, tab, totals } = a;
  if (!form.guestName.trim()) return { error: 'Guest name is required.' };
  if (!isIsoDate(form.checkInDate) || !isIsoDate(form.checkOutDate)) {
    return { error: 'Valid Check-In and Check-Out dates are required.' };
  }
  if (form.checkOutDate < form.checkInDate) return { error: 'Check-Out date cannot be before Check-In date.' };

  const converting = !group.isSplit && wantSplit;
  const issueRoom = splitActive ? tab !== 'food' || converting : true;
  const issueFood = splitActive ? tab !== 'room' || converting : false;
  if (issueRoom && chargeCounts.room === 0 && !(splitActive === false && chargeCounts.food > 0)) {
    return { error: 'Room Bill needs at least one charge greater than ₹0.' };
  }
  if (issueFood && chargeCounts.food === 0) {
    return { error: 'Add at least one food line (amount above ₹0) to issue a Food Bill.' };
  }

  const nowIso = new Date().toISOString();
  const keepDate = String(clicked.dateCreated || a.today).slice(0, 10);
  const supersedeIds = new Set<string>();
  if (!splitActive || converting) supersedeIds.add(clicked.id);
  else {
    if (issueRoom && group.roomInv) supersedeIds.add(group.roomInv.id);
    if (issueFood && group.foodInv) supersedeIds.add(group.foodInv.id);
  }
  const oldNumbers = invoices.filter((i) => supersedeIds.has(i.id)).map((i) => i.invoiceNumber);

  const baseMeta = {
    hotelId: clicked.hotelId,
    bookingId: clicked.bookingId,
    checkInId: clicked.checkInId,
    guestName: form.guestName.trim(),
    guestMobile: form.guestMobile.trim(),
    guestAddress: clicked.guestAddress,
    companyName: clicked.companyName,
    guestGstNumber: clicked.guestGstNumber || clicked.gstNumber,
    roomNumbers: form.roomNoList.length > 0 ? form.roomNoList : [form.primaryRoom],
    checkInDate: form.checkInDate,
    checkOutDate: form.checkOutDate,
    nights: form.nights,
    dateCreated: keepDate,
    invoiceStatus: 'Finalized',
  };
  const commonExtra = {
    isFinalInvoice: true,
    bookingNo: clicked.bookingNo,
    notes: form.notes.trim(),
    revisedFromInvoiceNumber: oldNumbers.join(', ') || undefined,
    revisedAt: nowIso,
  };

  const stamp = Date.now();
  const created: AnyRec[] = [];
  let roomNo = '';
  let roomId = '';

  if (issueRoom) {
    roomId = `INV-${stamp}-${Math.floor(100 + Math.random() * 900)}`;
    roomNo = allocateInvoiceNumber(invoices, billSettings).invoiceNumber;
    const rec = buildInvoiceRecord({
      ...baseMeta,
      id: roomId,
      invoiceNumber: roomNo,
      bill: (splitActive ? bills.roomBill : bills.combinedUnsplitBill) as any,
      paymentMethod: methodSummaryOf(pays.roomPays, String(clicked.paymentMethod || 'Cash')),
      isSeparateInvoice: splitActive ? false : Boolean(clicked.isSeparateInvoice),
      parentInvoiceId: splitActive ? undefined : clicked.parentInvoiceId,
      invoiceScope: (['Only Booking', 'Only Other Services', 'Booking + Other Services'].includes(String(clicked.invoiceScope))
        ? clicked.invoiceScope
        : 'Booking + Other Services') as any,
      extra: {
        ...commonExtra,
        ...(splitActive ? { isFoodRoomSplitSettled: true, invoiceScope: 'room_only' } : {}),
      },
    }) as AnyRec;
    if (splitActive) rec.foodCharges = 0;
    created.push(rec);
  }

  if (issueFood) {
    const seqBase = allocateInvoiceNumber(roomNo ? [{ invoiceNumber: roomNo }, ...invoices] : invoices, billSettings).invoiceNumber;
    const rec = buildInvoiceRecord({
      ...baseMeta,
      id: `INV-FOOD-${stamp}-${Math.floor(100 + Math.random() * 900)}`,
      invoiceNumber: `${seqBase}-F`,
      bill: bills.foodBill as any,
      paymentMethod: methodSummaryOf(pays.foodPays, String(clicked.paymentMethod || 'Cash')),
      isSeparateInvoice: true,
      parentInvoiceId: roomId || group.roomInv?.id,
      invoiceScope: 'Only Other Services',
      extra: {
        ...commonExtra,
        isFoodRoomSplitSettled: true,
        isSeparateInvoice: true,
        invoiceScope: 'food_only',
      },
    }) as AnyRec;
    rec.roomCharges = 0;
    created.push(rec);
  }

  const newRef = created[0];
  const next = [
    ...created,
    ...invoices.map((inv) =>
      supersedeIds.has(inv.id)
        ? {
            ...inv,
            isSuperseded: true,
            invoiceStatus: 'Superseded',
            supersededByInvoiceId: newRef.id,
            supersededByInvoiceNumber: newRef.invoiceNumber,
            supersededAt: nowIso,
          }
        : inv
    ),
  ];

  const label = !splitActive
    ? 'Combined Bill'
    : converting
    ? 'Split into Room Bill + Food Bill'
    : tab === 'room'
    ? 'Room Bill'
    : tab === 'food'
    ? 'Food Bill'
    : 'Room + Food Bills';
  return {
    next,
    created,
    summary: `${label} edited for ${form.guestName.trim()} — ${oldNumbers.join(', ')} → ${created
      .map((c) => c.invoiceNumber)
      .join(' & ')} (Total ${money(totals.grand)}, Paid ${money(totals.paid)}, Due ${money(totals.due)}).`,
  };
}

export default function EditInvoiceModal({
  invoiceId,
  invoices,
  billSettings,
  appCheckins = [],
  appBookings = [],
  posOrders = [],
  onSave,
  onClose,
}: EditInvoiceModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const clicked = invoices.find((i) => i.id === invoiceId) || null;

  const group = useMemo(() => {
    if (!clicked) return null;
    const sameStay = invoices.filter(
      (i) =>
        isActiveInvoice(i) &&
        !String(i.id).startsWith('FOLIO-') &&
        String(i.bookingId || '') === String(clicked.bookingId || '')
    );
    const clickedScope = scopeOf(clicked);
    const isSplit = clickedScope === 'room_only' || clickedScope === 'food_only';
    const roomInv = isSplit ? (clickedScope === 'room_only' ? clicked : sameStay.find((i) => scopeOf(i) === 'room_only') || null) : null;
    const foodInv = isSplit ? (clickedScope === 'food_only' ? clicked : sameStay.find((i) => scopeOf(i) === 'food_only') || null) : null;
    const checkin =
      appCheckins.find(
        (c) =>
          String(c?.id || '') === String(clicked.checkInId || '') ||
          String(c?.id || '') === String(clicked.bookingId || '') ||
          String(c?.bookingId || '') === String(clicked.bookingId || '')
      ) || null;
    const booking = appBookings.find((b) => String(b?.id || '') === String(clicked.bookingId || '')) || null;
    return { isSplit, roomInv, foodInv, checkin, booking, clickedScope };
  }, [clicked, invoices, appCheckins, appBookings]);

  const roomSource: AnyRec | null = group ? (group.isSplit ? group.roomInv : clicked) : null;

  // Older invoices sometimes keep restaurant / room-service lines inside "other services" (foodCharges = 0).
  // Pull those out so they show as Food lines and can be split into a separate Food Bill.
  const hiddenFoodLines: AnyRec[] =
    clicked && group && !group.isSplit && num(clicked.foodCharges) <= 0 && Array.isArray(clicked.ledgerLines)
      ? clicked.ledgerLines.filter(
          (l: AnyRec) =>
            l &&
            l.type === 'charge' &&
            !['food', 'room', 'extra_bed', 'extra_person', 'early_checkin', 'late_checkout', 'fine', 'water', 'laundry'].includes(
              String(l.kind || '')
            ) &&
            /food|restaurant|room service|f&b|kot|pos/i.test(String(l.description || '')) &&
            num(l.charges) > 0
        )
      : [];
  const hiddenFoodSum = r2(hiddenFoodLines.reduce((s, l) => s + num(l.charges), 0));

  const initialFoodLines = (): FoodLine[] => {
    if (!clicked || !group) return [];
    const mk = (d: string, a: number, i: number): FoodLine => ({
      id: `fl-${i}-${Date.now()}`,
      description: d,
      amount: String(r2(a)),
    });
    if (group.isSplit) {
      const fi = group.foodInv;
      if (!fi) return [];
      const lines: AnyRec[] = Array.isArray(fi.ledgerLines)
        ? fi.ledgerLines.filter((l: AnyRec) => l && l.type === 'charge' && (l.kind === 'food' || /food|restaurant/i.test(String(l.description || ''))))
        : [];
      if (lines.length > 0) return lines.map((l, i) => mk(String(l.description || 'Food'), num(l.charges), i));
      return num(fi.foodCharges) > 0 ? [mk('Restaurant & Food Charges', num(fi.foodCharges), 0)] : [];
    }
    const foodTotal = num(clicked.foodCharges);
    if (foodTotal <= 0) {
      return hiddenFoodLines.map((l, i) => mk(String(l.description || 'Food'), num(l.charges), i));
    }
    const detailed = extractDetailedFoodLinesForStay({
      invoice: clicked as any,
      checkinRecord: group.checkin as any,
      bookingRecord: group.booking as any,
      posOrders,
    });
    const dSum = r2(detailed.reduce((s, it) => s + num(it.amount), 0));
    if (detailed.length > 0 && Math.abs(dSum - foodTotal) <= 0.05) {
      return detailed.map((it, i) => mk(it.description, num(it.amount), i));
    }
    const ledger: AnyRec[] = Array.isArray(clicked.ledgerLines)
      ? clicked.ledgerLines.filter((l: AnyRec) => l && l.type === 'charge' && l.kind === 'food')
      : [];
    if (ledger.length > 0) return ledger.map((l, i) => mk(String(l.description || 'Food'), num(l.charges), i));
    return [mk('Restaurant & Food Charges', foodTotal, 0)];
  };

  const rs = roomSource || {};
  const rsIsV2 = rs.billEngine === 'v2';
  const rsFine = num(rs.fineCharges);

  const [guestName, setGuestName] = useState<string>(String(clicked?.guestName || ''));
  const [guestMobile, setGuestMobile] = useState<string>(String(clicked?.guestMobile || clicked?.mobile || ''));
  const [roomNumbers, setRoomNumbers] = useState<string>(
    Array.isArray(clicked?.roomNumbers) && clicked!.roomNumbers.length > 0
      ? clicked!.roomNumbers.join(', ')
      : String(clicked?.roomNumber || '')
  );
  const [checkInDate, setCheckInDate] = useState<string>(String(clicked?.checkInDate || '').slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState<string>(String(clicked?.checkOutDate || '').slice(0, 10));
  const [notes, setNotes] = useState<string>(String(clicked?.notes || ''));

  const [roomCharges, setRoomCharges] = useState<string>(String(num(rs.roomCharges)));
  const [extraBed, setExtraBed] = useState<string>(String(num(rs.extraBedCharges)));
  const [extraPerson, setExtraPerson] = useState<string>(String(num(rs.extraPersonCharges)));
  const [earlyLate, setEarlyLate] = useState<string>(String(num(rs.earlyCheckInCharges) + num(rs.lateCheckOutCharges)));
  const [services, setServices] = useState<string>(
    String(
      Math.max(
        0,
        r2(
          num(rs.waterCharges) +
            num(rs.laundryCharges) +
            num(rs.serviceCharges) +
            Math.max(0, num(rs.otherCharges) - (rsIsV2 ? rsFine : 0)) -
            hiddenFoodSum
        )
      )
    )
  );
  const [fine, setFine] = useState<string>(String(rsFine));
  const [discount, setDiscount] = useState<string>(String(num(rs.discount)));

  const [foodLines, setFoodLines] = useState<FoodLine[]>(initialFoodLines);

  const wasNoGst = Boolean(
    clicked &&
      (clicked.isWithoutGst === true ||
        (clicked.gstRate !== undefined && num(clicked.gstRate) <= 0) ||
        (clicked.gstRate === undefined && num(clicked.gst ?? clicked.taxAmount) <= 0))
  );
  const [gstOn, setGstOn] = useState<boolean>(!wasNoGst);

  const [wantSplit, setWantSplit] = useState<boolean>(false);
  const splitActive = Boolean(group?.isSplit) || wantSplit;
  const [tab, setTab] = useState<BillTab>(group?.isSplit ? (group.clickedScope === 'food_only' ? 'food' : 'room') : 'combined');
  const effTab: BillTab = splitActive ? tab : 'combined';

  const [roomPay, setRoomPay] = useState<PayRow[]>(() =>
    rowsFromInvoice(group?.isSplit ? group.roomInv : clicked, today)
  );
  const [foodPay, setFoodPay] = useState<PayRow[]>(() => (group?.isSplit ? rowsFromInvoice(group.foodInv, today) : []));
  const [error, setError] = useState<string>('');

  if (!clicked || !group) return null;

  const nights = nightsBetween(checkInDate, checkOutDate);
  const roomNoList = roomNumbers
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const primaryRoom = roomNoList[0] || 'N/A';

  const settingsForBill: BillSettings = { ...billSettings, roomRateIncludesGst: false };

  const buildRoomCharges = (): BillCharge[] => {
    const c: BillCharge[] = [];
    const push = (id: string, kind: BillCharge['kind'], description: string, amt: number, extra: Partial<BillCharge> = {}) => {
      if (amt > 0) c.push({ id, kind, description, amount: r2(amt), roomNumber: primaryRoom, ...extra });
    };
    const rc = Math.max(0, num(roomCharges));
    push('edit-room', 'room', 'Room Charges', rc, { nights, rate: r2(rc / nights) });
    push('edit-xbed', 'extra_bed', 'Extra Bed Charges', Math.max(0, num(extraBed)));
    push('edit-xpax', 'extra_person', 'Extra Person Charges', Math.max(0, num(extraPerson)));
    push('edit-early', 'early_checkin', 'Early Check-In / Late Check-Out Charges', Math.max(0, num(earlyLate)));
    push('edit-svc', 'service', 'Water / Laundry / Other Services', Math.max(0, num(services)));
    push('edit-fine', 'fine', 'Room Damage / Fine', Math.max(0, num(fine)));
    return c;
  };
  const buildFoodCharges = (): BillCharge[] =>
    foodLines
      .filter((l) => num(l.amount) > 0)
      .map((l, i) => ({
        id: `edit-food-${i}`,
        kind: 'food' as const,
        description: l.description.trim() || 'Restaurant & Food Charges',
        amount: r2(num(l.amount)),
        roomNumber: primaryRoom,
      }));
  const toPayments = (rows: PayRow[], tag: string): BillPayment[] =>
    rows
      .filter((r) => num(r.amount) > 0)
      .map((r, i) => ({
        id: r.id || `${tag}-${i}`,
        amount: r2(num(r.amount)),
        method: r.method || 'Cash',
        date: r.date || today,
        reference: r.reference || undefined,
        note: tag === 'food' ? 'Food Bill Settlement' : tag === 'room' ? 'Room Bill Settlement' : undefined,
      }));

  const disc = Math.max(0, num(discount));
  const roomCh = buildRoomCharges();
  const foodCh = buildFoodCharges();
  const roomPays = toPayments(roomPay, splitActive ? 'room' : 'pay');
  const foodPays = toPayments(foodPay, 'food');

  const calc = (charges: BillCharge[], payments: BillPayment[], discountAmt: number) =>
    calculateBill({ charges, payments, discount: discountAmt, gstEnabled: gstOn, settings: settingsForBill });

  const roomBill = calc(roomCh, roomPays, disc);
  const foodBill = calc(foodCh, foodPays, 0);
  const combinedUnsplitBill = calc([...roomCh, ...foodCh], roomPays, disc);

  const grandAll = splitActive ? r2(roomBill.grandTotal + foodBill.grandTotal) : combinedUnsplitBill.grandTotal;
  const paidAll = splitActive ? r2(roomBill.receipts + foodBill.receipts) : combinedUnsplitBill.receipts;
  const dueAll = splitActive ? r2(roomBill.balance + foodBill.balance) : combinedUnsplitBill.balance;

  const enableSplit = () => {
    const a = allocateRows(roomPay, roomBill.grandTotal);
    setRoomPay(a.room);
    setFoodPay(a.food);
    setWantSplit(true);
    // No food detected on this invoice? Give an empty food line so the Food Bill can be filled right away.
    if (foodLines.length === 0) {
      setFoodLines([{ id: `fl-split-${Date.now()}`, description: '', amount: '' }]);
    }
    setTab('room');
  };
  const disableSplit = () => {
    setRoomPay([...roomPay, ...foodPay]);
    setFoodPay([]);
    setWantSplit(false);
    setTab('combined');
  };

  const updateRow = (which: 'room' | 'food', id: string, patch: Partial<PayRow>) => {
    const setter = which === 'room' ? setRoomPay : setFoodPay;
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const addRow = (which: 'room' | 'food', amount = '') => {
    const setter = which === 'room' ? setRoomPay : setFoodPay;
    setter((prev) => [
      ...prev,
      { id: `pay-new-${Date.now()}-${prev.length}`, amount, method: 'Cash', date: today, reference: '' },
    ]);
  };
  const removeRow = (which: 'room' | 'food', id: string) => {
    const setter = which === 'room' ? setRoomPay : setFoodPay;
    setter((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = () => {
    setError('');
    const res = assembleReissue({
      clicked,
      invoices,
      billSettings,
      group: { isSplit: group.isSplit, roomInv: group.roomInv, foodInv: group.foodInv },
      form: { guestName, guestMobile, roomNoList, primaryRoom, checkInDate, checkOutDate, nights, notes },
      bills: { roomBill, foodBill, combinedUnsplitBill },
      chargeCounts: { room: roomCh.length, food: foodCh.length },
      pays: { roomPays, foodPays },
      splitActive,
      wantSplit,
      tab: effTab,
      totals: { grand: grandAll, paid: paidAll, due: dueAll },
      today,
    });
    if ('error' in res) {
      setError(res.error);
      return;
    }
    onSave(res.next, res.summary);
  };

  const renderPayEditor = (
    which: 'room' | 'food',
    rows: PayRow[],
    bill: { grandTotal: number; receipts: number; balance: number },
    title: string
  ) => (
    <div key={`pay-${which}`} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase text-slate-800">{title}</span>
        <div className="flex items-center gap-2">
          {bill.balance > 0 && (
            <button
              type="button"
              onClick={() => addRow(which, String(r2(bill.balance)))}
              className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
            >
              Settle Full Due {money(bill.balance)}
            </button>
          )}
          <button
            type="button"
            onClick={() => addRow(which)}
            className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Payment
          </button>
        </div>
      </div>
      {rows.length === 0 && <p className="text-[11px] text-slate-500 italic">No payment recorded on this bill — it will show as Unpaid / Due.</p>}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-12 gap-1.5 items-center">
          <input
            type="number"
            step="any"
            min={0}
            value={r.amount}
            onChange={(e) => updateRow(which, r.id, { amount: e.target.value })}
            className={`${inputCls} col-span-3 font-mono`}
            placeholder="Amount ₹"
          />
          <select
            value={r.method}
            onChange={(e) => updateRow(which, r.id, { method: e.target.value })}
            className={`${inputCls} col-span-3`}
          >
            {(PAY_MODES.includes(r.method) ? PAY_MODES : [r.method, ...PAY_MODES]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={r.date}
            onChange={(e) => updateRow(which, r.id, { date: e.target.value })}
            className={`${inputCls} col-span-3`}
          />
          <input
            type="text"
            value={r.reference}
            onChange={(e) => updateRow(which, r.id, { reference: e.target.value })}
            className={`${inputCls} col-span-2`}
            placeholder="Ref"
          />
          <button
            type="button"
            onClick={() => removeRow(which, r.id)}
            className="col-span-1 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
            title="Remove payment"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap justify-between text-[11px] font-mono font-bold pt-1 border-t border-slate-200">
        <span>Bill: {money(bill.grandTotal)}</span>
        <span className="text-emerald-700">Paid: {money(bill.receipts)}</span>
        <span className={bill.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
          {bill.balance > 0 ? `Due: ${money(bill.balance)}` : '✓ Settled'}
        </span>
      </div>
    </div>
  );

  const showRoomSection = effTab !== 'food';
  const showFoodSection = effTab !== 'room';
  const tabBtn = (key: BillTab, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setTab(key)}
      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer border transition ${
        effTab === key ? 'bg-[#17120F] text-[#E0BD6B] border-[#17120F]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto flex items-start justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 no-print">
      <div className="relative bg-white rounded-2xl border-2 border-[#C49A3A] shadow-2xl max-w-3xl w-full overflow-hidden my-4">
        <div className="bg-[#FFF9EB] border-b-2 border-[#E6D9B3] p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-800">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-[#17120F] text-base">
                Edit Invoice {clicked.invoiceNumber}
                {group.isSplit ? ' (Split: Room + Food)' : ''}
              </h3>
              <p className="text-[11px] font-mono font-bold text-[#8B691E]">
                {clicked.guestName} • Room {roomNumbers || '—'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-amber-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs max-h-[74vh] overflow-y-auto">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Finalized invoices are locked for audit. <strong>Save &amp; Re-Issue</strong> creates the corrected invoice with a new number and keeps the
              old one as <strong>Superseded → Replaced by …</strong> (original invoice date is kept).
            </span>
          </div>

          {/* Bill selector */}
          {/* Always available: even if no food line was detected on the invoice, food can be added here and split out */}
          {(
            <div className="flex flex-wrap items-center gap-2">
              {splitActive ? (
                <>
                  {tabBtn('room', 'Room Bill')}
                  {tabBtn('food', 'Food Bill')}
                  {tabBtn('combined', 'Combined Bill')}
                </>
              ) : (
                <span className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-[#17120F] text-[#E0BD6B]">Combined Bill</span>
              )}
              {!group.isSplit && (
                <button
                  type="button"
                  onClick={wantSplit ? disableSplit : enableSplit}
                  className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                    wantSplit ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {wantSplit ? <Undo2 className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />}
                  {wantSplit ? 'Undo Split (back to one Combined Bill)' : 'Split Food & Room Bill'}
                </button>
              )}
            </div>
          )}
          {splitActive && effTab === 'combined' && (
            <p className="text-[11px] text-slate-600">
              Combined Bill = Room Bill + Food Bill together. Edit both sections below; saving re-issues <strong>both</strong> bills.
            </p>
          )}

          {/* Guest & stay */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className={labelCls}>Guest Name *</label>
              <input className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Mobile</label>
              <input className={inputCls} value={guestMobile} onChange={(e) => setGuestMobile(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Room No(s)</label>
              <input className={inputCls} value={roomNumbers} onChange={(e) => setRoomNumbers(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Check-In</label>
              <input type="date" className={inputCls} value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Check-Out</label>
              <input type="date" className={inputCls} value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Tax Mode</label>
              <select className={inputCls} value={gstOn ? 'gst' : 'nogst'} onChange={(e) => setGstOn(e.target.value === 'gst')}>
                <option value="gst">GST Invoice (Room {billSettings.roomGstRate}% • Food {billSettings.foodGstRate}%)</option>
                <option value="nogst">No GST — Bill of Supply (0%)</option>
              </select>
            </div>
          </div>

          {showRoomSection && (
            <div className="p-3 rounded-xl border border-slate-300 bg-white space-y-2">
              <div className="text-[11px] font-extrabold uppercase text-slate-800">
                {splitActive ? 'Room Bill (No Food)' : 'Room & Stay Charges'}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {([
                  ['Room Charges (₹) — total', roomCharges, setRoomCharges],
                  ['Extra Bed (₹)', extraBed, setExtraBed],
                  ['Extra Person (₹)', extraPerson, setExtraPerson],
                  ['Early / Late (₹)', earlyLate, setEarlyLate],
                  ['Water / Laundry / Services (₹)', services, setServices],
                  ['Damage / Fine (₹, GST-exempt)', fine, setFine],
                  ['Discount (₹)', discount, setDiscount],
                ] as Array<[string, string, (v: string) => void]>).map(([label, val, setter]) => (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                ))}
              </div>
              {splitActive && (
                <div className="flex flex-wrap justify-between text-[11px] font-mono font-bold pt-1 border-t border-slate-200">
                  <span>Subtotal: {money(roomBill.subtotal - roomBill.discount)}</span>
                  <span>GST: {money(roomBill.totalTax)}</span>
                  <span>Room Bill Total: {money(roomBill.grandTotal)}</span>
                </div>
              )}
            </div>
          )}

          {showFoodSection && (
            <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-amber-950">
                  {splitActive ? 'Food Bill (Item-Wise, pre-tax)' : 'Food & Restaurant Charges (pre-tax)'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFoodLines((prev) => [...prev, { id: `fl-new-${Date.now()}-${prev.length}`, description: '', amount: '' }])
                  }
                  className="px-2 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Food Line
                </button>
              </div>
              {foodLines.length === 0 && <p className="text-[11px] text-slate-500 italic">No food on this bill. Add a line to bill food.</p>}
              {foodLines.map((l) => (
                <div key={l.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    className={`${inputCls} col-span-8`}
                    value={l.description}
                    placeholder="Dish / description"
                    onChange={(e) => setFoodLines((p) => p.map((x) => (x.id === l.id ? { ...x, description: e.target.value } : x)))}
                  />
                  <input
                    type="number"
                    step="any"
                    min={0}
                    className={`${inputCls} col-span-3 font-mono`}
                    value={l.amount}
                    placeholder="₹"
                    onChange={(e) => setFoodLines((p) => p.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)))}
                  />
                  <button
                    type="button"
                    onClick={() => setFoodLines((p) => p.filter((x) => x.id !== l.id))}
                    className="col-span-1 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="Remove line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {splitActive && (
                <div className="flex flex-wrap justify-between text-[11px] font-mono font-bold pt-1 border-t border-amber-200">
                  <span>Food Subtotal: {money(foodBill.subtotal)}</span>
                  <span>Food GST: {money(foodBill.totalTax)}</span>
                  <span>Food Bill Total: {money(foodBill.grandTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* Payments */}
          {!splitActive && renderPayEditor('room', roomPay, combinedUnsplitBill, 'Payments Received')}
          {splitActive && showRoomSection && renderPayEditor('room', roomPay, roomBill, 'Room Bill Payments')}
          {splitActive && showFoodSection && renderPayEditor('food', foodPay, foodBill, 'Food Bill Payments')}

          <div>
            <label className={labelCls}>Notes (printed on invoice)</label>
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="p-3 rounded-xl bg-[#FFFDF7] border-2 border-[#E6D9B3] flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-extrabold">
            <span>{splitActive ? 'Room + Food' : 'Invoice'} Total: {money(grandAll)}</span>
            <span className="text-emerald-700">Paid: {money(paidAll)}</span>
            <span className={dueAll > 0 ? 'text-rose-700' : 'text-emerald-700'}>{dueAll > 0 ? `Due: ${money(dueAll)}` : '✓ Fully Settled'}</span>
          </div>

          {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">{error}</div>}
        </div>

        <div className="bg-[#FAFBFD] px-4 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#15805D] hover:bg-[#11694B] text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer"
          >
            Save &amp; Re-Issue Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
