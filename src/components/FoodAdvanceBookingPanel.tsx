import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FoodAdvanceBooking, FoodAdvancePaymentEntry } from '../types';
import { showToast } from '../utils/toast';
import { r2 } from '../utils/billCalculator';
import { openPrintWindow } from '../utils/printDocument';
import {
  Calendar,
  Plus,
  Edit,
  Trash2,
  Printer,
  CheckCircle2,
  Clock,
  Users,
  Search,
  UtensilsCrossed,
  X,
  Coins,
  CreditCard,
  Split,
} from 'lucide-react';

interface FoodAdvanceBookingPanelProps {
  bookings: FoodAdvanceBooking[];
  hotelName?: string;
  loggedInUser?: string;
  foodGstRate?: number;
  availableTables?: string[];
  onUpdateBookings: (updated: FoodAdvanceBooking[]) => void;
  onCreatePosOrderFromAdvance?: (adv: FoodAdvanceBooking) => void;
  initialEditBookingId?: string | null;
  onClearInitialEdit?: () => void;
}

interface SplitRowDraft {
  id: string;
  method: 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Voucher';
  amount: string;
  reference: string;
  date: string;
}

const getIstTodayStr = (): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}
  return new Date().toISOString().split('T')[0];
};

const PAYMENT_MODES: SplitRowDraft['method'][] = ['Cash', 'UPI', 'Card', 'Bank', 'Voucher'];

function resolveDominantPaymentMethod(payments: FoodAdvancePaymentEntry[]): string {
  const valid = payments.filter((p) => Number(p.amount) > 0);
  if (valid.length === 0) return 'Cash';
  const distinct = new Set(valid.map((p) => p.method));
  if (distinct.size > 1) return 'Split Payment';
  return valid[0].method;
}

export default function FoodAdvanceBookingPanel({
  bookings = [],
  hotelName = 'Hotel Restaurant & Banquet',
  loggedInUser = 'Admin',
  foodGstRate = 5,
  availableTables = [],
  onUpdateBookings,
  onCreatePosOrderFromAdvance,
  initialEditBookingId,
  onClearInitialEdit,
}: FoodAdvanceBookingPanelProps) {
  const todayStr = getIstTodayStr();
  const saveLockRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodAdvanceBooking | null>(null);
  const [settlingItem, setSettlingItem] = useState<FoodAdvanceBooking | null>(null);
  const [settleSplitRows, setSettleSplitRows] = useState<SplitRowDraft[]>([]);

  // Form fields
  const [bookingNumber, setBookingNumber] = useState('');
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [guestOrGroupName, setGuestOrGroupName] = useState('');
  const [mobile, setMobile] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tableNumber, setTableNumber] = useState(() => availableTables[0] || '');
  const [bookingType, setBookingType] = useState('Table Reservation');
  const [meals, setMeals] = useState<Array<'Breakfast' | 'Lunch' | 'Dinner'>>(['Lunch']);
  const [eventDate, setEventDate] = useState(todayStr);
  const [eventTime, setEventTime] = useState('01:00 PM');
  const [pax, setPax] = useState<string>('4');
  const [menuCuisine, setMenuCuisine] = useState('');
  const [mealTypes, setMealTypes] = useState<Array<'Veg' | 'Non-Veg'>>(['Veg']);
  const [ratePerPax, setRatePerPax] = useState<string>('350');
  const [focPax, setFocPax] = useState<string>('0');
  const [manualSubtotalOverride, setManualSubtotalOverride] = useState<string>('');
  const [gstEnabled, setGstEnabled] = useState<boolean>(true);
  const [gstRateInput, setGstRateInput] = useState<string>(String(foodGstRate || 5));
  const [splitRows, setSplitRows] = useState<SplitRowDraft[]>([
    { id: `sp-init`, method: 'Cash', amount: '0', reference: '', date: todayStr },
  ]);
  const [status, setStatus] = useState<FoodAdvanceBooking['status']>('Confirmed');
  const [specialRequest, setSpecialRequest] = useState('');
  const [confirmedBy, setConfirmedBy] = useState(loggedInUser || 'Manager');

  // Tax & totals calculation
  const computedSubtotal = useMemo(() => {
    if (manualSubtotalOverride.trim() !== '') {
      return r2(Math.max(0, Number(manualSubtotalOverride) || 0));
    }
    const chargeablePax = Math.max(0, (Number(pax) || 0) - (Number(focPax) || 0));
    return r2(chargeablePax * (Number(ratePerPax) || 0));
  }, [pax, focPax, ratePerPax, manualSubtotalOverride]);

  const effectiveGstRate = gstEnabled ? Math.max(0, Number(gstRateInput) || 0) : 0;
  const computedGst = useMemo(() => r2((computedSubtotal * effectiveGstRate) / 100), [computedSubtotal, effectiveGstRate]);
  const computedCgst = useMemo(() => r2(computedGst / 2), [computedGst]);
  const computedSgst = useMemo(() => r2(computedGst - computedCgst), [computedGst, computedCgst]);
  const computedTotal = useMemo(() => r2(computedSubtotal + computedGst), [computedSubtotal, computedGst]);

  const totalSplitPaid = useMemo(
    () => r2(splitRows.reduce((s, r) => s + Math.max(0, Number(r.amount) || 0), 0)),
    [splitRows]
  );

  const computedBalance = useMemo(() => r2(Math.max(0, computedTotal - totalSplitPaid)), [computedTotal, totalSplitPaid]);
  const isOverpaid = totalSplitPaid > computedTotal + 0.01;

  const generateNextBookingNo = () => {
    const nums = bookings.map((b) => {
      const m = String(b.bookingNumber || '').match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 1000;
    });
    const maxN = nums.length > 0 ? Math.max(1000, ...nums) : 1000;
    return `FAB-${maxN + 1}`;
  };

  const openAddModal = () => {
    setEditingItem(null);
    setBookingNumber(generateNextBookingNo());
    setBookingDate(todayStr);
    setGuestOrGroupName('');
    setMobile('');
    setCompanyName('');
    setTableNumber(availableTables[0] || '');
    setBookingType('Table Reservation');
    setMeals(['Lunch']);
    setEventDate(todayStr);
    setEventTime('01:00 PM');
    setPax('4');
    setMenuCuisine('');
    setMealTypes(['Veg']);
    setRatePerPax('350');
    setFocPax('0');
    setManualSubtotalOverride('');
    setGstEnabled(true);
    setGstRateInput(String(foodGstRate || 5));
    setSplitRows([
      { id: `sp-${Date.now()}-1`, method: 'Cash', amount: '0', reference: '', date: todayStr },
    ]);
    setStatus('Confirmed');
    setSpecialRequest('');
    setConfirmedBy(loggedInUser || 'Manager');
    setShowModal(true);
  };

  const openEditModal = (item: FoodAdvanceBooking) => {
    setEditingItem(item);
    setBookingNumber(item.bookingNumber);
    setBookingDate(item.bookingDate || todayStr);
    setGuestOrGroupName(item.guestOrGroupName);
    setMobile(item.mobile || '');
    setCompanyName(item.companyName || '');
    setTableNumber(item.tableNumber || availableTables[0] || '');
    setBookingType(item.bookingType || 'Table Reservation');
    setMeals(item.meals?.length ? item.meals : ['Lunch']);
    setEventDate(item.eventDate || todayStr);
    setEventTime(item.eventTime || '');
    setPax(String(item.pax || 1));
    setMenuCuisine(item.menuCuisine || '');
    setMealTypes(item.mealTypes?.length ? item.mealTypes : ['Veg']);
    setRatePerPax(String(item.ratePerPax || 0));
    setFocPax(String(item.focPax || 0));

    const itemSub = item.subtotal !== undefined ? Number(item.subtotal) : Number(item.totalAmount || 0);
    const expectedAuto = r2(Math.max(0, (item.pax || 0) - (item.focPax || 0)) * (item.ratePerPax || 0));
    setManualSubtotalOverride(Math.abs(itemSub - expectedAuto) > 0.5 ? String(itemSub) : '');
    setGstEnabled(item.gstEnabled ?? Boolean(Number(item.gstAmount || 0) > 0));
    setGstRateInput(String(item.gstRate ?? foodGstRate ?? 5));

    if (Array.isArray(item.payments) && item.payments.length > 0) {
      setSplitRows(
        item.payments.map((p) => ({
          id: p.id || `sp-${Math.random().toString(36).slice(2, 6)}`,
          method: (PAYMENT_MODES.includes(p.method as any) ? p.method : 'Cash') as SplitRowDraft['method'],
          amount: String(p.amount || 0),
          reference: p.reference || '',
          date: p.date || item.bookingDate || todayStr,
        }))
      );
    } else {
      setSplitRows([
        {
          id: `sp-${Date.now()}-1`,
          method: (PAYMENT_MODES.includes(item.paymentMethod as any) ? item.paymentMethod : 'Cash') as SplitRowDraft['method'],
          amount: String(item.advanceAmount || 0),
          reference: '',
          date: item.bookingDate || todayStr,
        },
      ]);
    }

    setStatus(item.status || 'Confirmed');
    setSpecialRequest(item.specialRequest || '');
    setConfirmedBy(item.confirmedBy || loggedInUser || 'Manager');
    setShowModal(true);
  };

  useEffect(() => {
    if (!initialEditBookingId) return;
    const found = bookings.find((b) => b.id === initialEditBookingId);
    if (found) {
      openEditModal(found);
    }
    if (onClearInitialEdit) onClearInitialEdit();
  }, [initialEditBookingId, bookings]);

  const toggleMeal = (m: 'Breakfast' | 'Lunch' | 'Dinner') => {
    setMeals((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const toggleMealType = (mt: 'Veg' | 'Non-Veg') => {
    setMealTypes((prev) => (prev.includes(mt) ? prev.filter((x) => x !== mt) : [...prev, mt]));
  };

  const addSplitRow = (setter: React.Dispatch<React.SetStateAction<SplitRowDraft[]>>, defaultMethod: SplitRowDraft['method'] = 'UPI', defaultAmt = '') => {
    setter((prev) => [
      ...prev,
      {
        id: `sp-${Date.now()}-${prev.length + 1}`,
        method: defaultMethod,
        amount: defaultAmt,
        reference: '',
        date: todayStr,
      },
    ]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;
    if (!guestOrGroupName.trim()) {
      showToast('Please enter Guest / Group Name.', 'warning');
      return;
    }
    if (meals.length === 0) {
      showToast('Please select at least one Meal (Breakfast / Lunch / Dinner).', 'warning');
      return;
    }
    if (!editingItem && eventDate < todayStr) {
      showToast(`Cannot book a past date (${eventDate}). Please select today (${todayStr}) or a future date.`, 'error');
      return;
    }
    if (isOverpaid) {
      showToast(`Total split payment (₹${totalSplitPaid}) cannot exceed Total Payable (₹${computedTotal}).`, 'error');
      return;
    }

    const cleanTbl = tableNumber.trim().toUpperCase();
    if (cleanTbl && cleanTbl !== 'BANQUET') {
      const conflict = bookings.find(
        (b) =>
          b.id !== editingItem?.id &&
          b.status !== 'Cancelled' &&
          b.status !== 'Completed' &&
          b.status !== 'No-Show' &&
          String(b.tableNumber || '').toUpperCase() === cleanTbl &&
          b.eventDate === eventDate &&
          ((eventTime.trim() && String(b.eventTime || '').trim().toUpperCase() === eventTime.trim().toUpperCase()) ||
            b.meals.some((m) => meals.includes(m)))
      );
      if (conflict) {
        showToast(
          `Double-booking prevented: Table ${cleanTbl} is already reserved on ${eventDate} (${conflict.eventTime || conflict.meals.join('/')}) for ${conflict.guestOrGroupName}.`,
          'error'
        );
        return;
      }
    }

    saveLockRef.current = true;
    try {
      const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const validPayments: FoodAdvancePaymentEntry[] = splitRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          id: r.id || `FAP-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          method: r.method,
          amount: r2(Number(r.amount)),
          reference: r.reference.trim() || undefined,
          date: r.date || bookingDate || todayStr,
          time: nowTime,
          recordedBy: loggedInUser || confirmedBy || 'Front Desk',
          paymentType: 'Advance',
        }));

      const totalPaid = r2(validPayments.reduce((s, p) => s + p.amount, 0));
      const balance = r2(Math.max(0, computedTotal - totalPaid));
      const payStatus: FoodAdvanceBooking['paymentStatus'] =
        totalPaid <= 0 ? 'Unpaid' : balance <= 0.01 ? 'Paid' : 'Partially Paid';

      const bNo = bookingNumber.trim() || generateNextBookingNo();
      const record: FoodAdvanceBooking = {
        id: editingItem?.id || `FAB-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        bookingNumber: bNo,
        receiptNumber: editingItem?.receiptNumber || `RCP-${bNo.replace(/[^0-9A-Za-z]/g, '')}`,
        bookingDate,
        guestOrGroupName: guestOrGroupName.trim(),
        mobile: mobile.trim() || undefined,
        companyName: companyName.trim() || undefined,
        tableNumber: cleanTbl || 'BANQUET',
        bookingType,
        meals,
        eventDate,
        eventTime: eventTime.trim() || undefined,
        pax: Math.max(1, Number(pax) || 1),
        menuCuisine: menuCuisine.trim() || 'Standard Buffet / Ala Carte',
        mealTypes: mealTypes.length > 0 ? mealTypes : ['Veg'],
        ratePerPax: Math.max(0, Number(ratePerPax) || 0),
        focPax: Math.max(0, Number(focPax) || 0),
        subtotal: computedSubtotal,
        gstEnabled,
        gstRate: effectiveGstRate,
        gstAmount: computedGst,
        cgst: computedCgst,
        sgst: computedSgst,
        totalAmount: computedTotal,
        advanceAmount: totalPaid,
        balanceAmount: balance,
        paymentMethod: resolveDominantPaymentMethod(validPayments),
        paymentStatus: payStatus,
        payments: validPayments,
        status,
        specialRequest: specialRequest.trim() || undefined,
        confirmedBy: confirmedBy.trim() || loggedInUser || 'Manager',
        convertedPosOrderId: editingItem?.convertedPosOrderId,
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingItem) {
        onUpdateBookings(bookings.map((b) => (b.id === editingItem.id ? record : b)));
        showToast(`Food Advance Booking ${record.bookingNumber} updated!`, 'success');
      } else {
        onUpdateBookings([record, ...bookings]);
        showToast(
          `Food Advance Booking ${record.bookingNumber} created (${record.paymentMethod}, Paid ₹${totalPaid}, Balance ₹${balance})!`,
          'success'
        );
      }
      setShowModal(false);
    } finally {
      setTimeout(() => {
        saveLockRef.current = false;
      }, 250);
    }
  };

  const openSettleModal = (item: FoodAdvanceBooking) => {
    setSettlingItem(item);
    setSettleSplitRows([
      {
        id: `settle-${Date.now()}-1`,
        method: 'Cash',
        amount: String(r2(item.balanceAmount || 0)),
        reference: '',
        date: todayStr,
      },
    ]);
  };

  const handleConfirmSettleBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingItem) return;
    const balanceRemaining = r2(settlingItem.balanceAmount || 0);
    const validRows = settleSplitRows.filter((r) => Number(r.amount) > 0);
    const settleSum = r2(validRows.reduce((s, r) => s + Number(r.amount), 0));

    if (settleSum <= 0) {
      showToast('Enter a positive settlement amount.', 'warning');
      return;
    }
    if (settleSum > balanceRemaining + 0.01) {
      showToast(`Settlement amount (₹${settleSum}) exceeds balance due (₹${balanceRemaining}).`, 'error');
      return;
    }

    const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const existingPayments: FoodAdvancePaymentEntry[] =
      Array.isArray(settlingItem.payments) && settlingItem.payments.length > 0
        ? settlingItem.payments
        : Number(settlingItem.advanceAmount || 0) > 0
        ? [
            {
              id: `FAP-LEG-${settlingItem.id}`,
              method: settlingItem.paymentMethod || 'Cash',
              amount: r2(settlingItem.advanceAmount),
              date: settlingItem.bookingDate || todayStr,
              paymentType: 'Advance',
            },
          ]
        : [];

    const newPayments: FoodAdvancePaymentEntry[] = validRows.map((r) => ({
      id: `FAP-SET-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      method: r.method,
      amount: r2(Number(r.amount)),
      reference: r.reference.trim() || undefined,
      date: r.date || todayStr,
      time: nowTime,
      recordedBy: loggedInUser || 'Front Desk',
      paymentType: 'Balance Settlement',
    }));

    const mergedPayments = [...existingPayments, ...newPayments];
    const nextAdvance = r2(mergedPayments.reduce((s, p) => s + Number(p.amount || 0), 0));
    const nextBalance = r2(Math.max(0, Number(settlingItem.totalAmount || 0) - nextAdvance));
    const nextPayStatus: FoodAdvanceBooking['paymentStatus'] = nextBalance <= 0.01 ? 'Paid' : 'Partially Paid';

    const updated: FoodAdvanceBooking = {
      ...settlingItem,
      payments: mergedPayments,
      advanceAmount: nextAdvance,
      balanceAmount: nextBalance,
      paymentMethod: resolveDominantPaymentMethod(mergedPayments),
      paymentStatus: nextPayStatus,
      status: nextBalance <= 0.01 ? 'Completed' : settlingItem.status,
      updatedAt: new Date().toISOString(),
    };

    onUpdateBookings(bookings.map((b) => (b.id === settlingItem.id ? updated : b)));
    showToast(
      `Recorded ₹${settleSum} balance settlement (${validRows.map((r) => `${r.method}: ₹${r.amount}`).join(' + ')}) for ${settlingItem.bookingNumber}!`,
      'success'
    );
    setSettlingItem(null);
  };

  const handlePrintReceipt = (item: FoodAdvanceBooking) => {
    const payments =
      Array.isArray(item.payments) && item.payments.length > 0
        ? item.payments
        : Number(item.advanceAmount || 0) > 0
        ? [{ id: '1', method: item.paymentMethod || 'Cash', amount: item.advanceAmount, date: item.bookingDate, paymentType: 'Advance' as const }]
        : [];

    const paymentRowsHtml =
      payments.length > 0
        ? payments
            .map(
              (p) => `
          <tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.date || item.bookingDate}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:700;">${p.method}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.paymentType || 'Advance'} ${p.reference ? `(${p.reference})` : ''}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">₹${Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>`
            )
            .join('')
        : `<tr><td colspan="4" style="padding:8px;text-align:center;color:#777;">No payments collected yet</td></tr>`;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Advance Food Receipt - ${item.bookingNumber}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 20px auto; max-width: 680px; font-size: 12px; }
    .box { border: 1.5px solid #222; border-radius: 10px; padding: 20px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; border-bottom: 1.5px solid #ccc; }
    .totals { margin-top: 14px; border-top: 1.5px solid #222; padding-top: 10px; }
    .totals-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .grand { font-size: 15px; font-weight: 800; border-top: 1px dashed #999; padding-top: 6px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <div>
        <div style="font-size:18px;font-weight:800;">${hotelName}</div>
        <div style="font-size:11px;color:#555;">POS Advance Food Booking &amp; Payment Receipt</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800;">Booking #: ${item.bookingNumber}</div>
        <div style="font-size:11px;color:#555;">Receipt #: ${item.receiptNumber || `RCP-${item.bookingNumber}`}</div>
        <div style="font-size:11px;color:#555;">Date: ${item.bookingDate}</div>
      </div>
    </div>
    <div class="grid">
      <div><strong>Guest / Group:</strong> ${item.guestOrGroupName}</div>
      <div><strong>Contact:</strong> ${item.mobile || 'N/A'}</div>
      <div><strong>Event Date &amp; Time:</strong> ${item.eventDate} ${item.eventTime || ''}</div>
      <div><strong>Table / Venue:</strong> ${item.tableNumber || 'Banquet'} (${item.bookingType || 'Reservation'})</div>
      <div><strong>Meals &amp; Pax:</strong> ${(item.meals || []).join(', ')} • ${item.pax} Pax (FOC: ${item.focPax || 0})</div>
      <div><strong>Cuisine:</strong> ${item.menuCuisine} (${(item.mealTypes || []).join('/')})</div>
    </div>

    <div style="font-weight:700;margin-top:10px;">Payment Breakdown (Hybrid / Split Receipt)</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Method</th>
          <th>Type / Reference</th>
          <th style="text-align:right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>${paymentRowsHtml}</tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Food Subtotal (${Math.max(0, (item.pax || 0) - (item.focPax || 0))} Pax × ₹${item.ratePerPax || 0})</span><span>₹${Number(item.subtotal ?? item.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
      ${
        Number(item.gstAmount || 0) > 0
          ? `<div class="totals-row"><span>CGST (${(Number(item.gstRate || 0) / 2).toFixed(1)}%) + SGST (${(Number(item.gstRate || 0) / 2).toFixed(1)}%)</span><span>₹${Number(item.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>`
          : ''
      }
      <div class="totals-row grand"><span>Total Booking Value</span><span>₹${Number(item.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
      <div class="totals-row" style="color:#065f46;font-weight:700;"><span>Total Paid (Advance + Settlements)</span><span>₹${Number(item.advanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
      <div class="totals-row" style="color:#b91c1c;font-weight:800;"><span>Balance Due</span><span>₹${Number(item.balanceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
    </div>
    <div style="margin-top:18px;font-size:10.5px;color:#666;display:flex;justify-content:space-between;">
      <span>Confirmed By: ${item.confirmedBy || loggedInUser}</span>
      <span>Thank you for choosing ${hotelName}!</span>
    </div>
  </div>
</body>
</html>`;
    openPrintWindow(html, true);
  };

  const handleDelete = (item: FoodAdvanceBooking) => {
    if (!confirm(`Delete Food Advance Booking ${item.bookingNumber} for ${item.guestOrGroupName}?`)) return;
    onUpdateBookings(bookings.filter((b) => b.id !== item.id));
    showToast(`Food advance booking ${item.bookingNumber} deleted.`, 'info');
  };

  const filteredList = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        b.bookingNumber.toLowerCase().includes(q) ||
        b.guestOrGroupName.toLowerCase().includes(q) ||
        (b.companyName || '').toLowerCase().includes(q) ||
        (b.mobile || '').includes(q)
      );
    });
  }, [bookings, statusFilter, searchQuery]);

  const kpis = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'Cancelled');
    return {
      count: active.length,
      totalPax: active.reduce((s, b) => s + Number(b.pax || 0), 0),
      totalVal: r2(active.reduce((s, b) => s + Number(b.totalAmount || 0), 0)),
      advCollected: r2(active.reduce((s, b) => s + Number(b.advanceAmount || 0), 0)),
      pendingBal: r2(active.reduce((s, b) => s + Number(b.balanceAmount || 0), 0)),
    };
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-600 font-bold">
            POS Banquet, Group Meal &amp; Hybrid Payment Advance Reservations
          </span>
          <h3 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600" />
            Advance Food Booking Register (Hybrid Split Payments)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Accept Cash + UPI + Card + Bank split payments in a single advance booking, track partial balance dues, apply F&amp;B GST, and print clean itemized receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> + New Advance Food Booking
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Active Bookings</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{kpis.count}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Total Pax</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{kpis.totalPax}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">Booking Value</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">₹{kpis.totalVal.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-mono uppercase text-emerald-700 font-bold">Total Paid</div>
          <div className="text-xl font-extrabold text-emerald-900 mt-0.5">₹{kpis.advCollected.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-mono uppercase text-rose-700 font-bold">Balance Due</div>
          <div className="text-xl font-extrabold text-rose-900 mt-0.5">₹{kpis.pendingBal.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search booking #, guest, company, mobile..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(['ALL', 'Confirmed', 'Advance', 'In Process', 'Completed', 'Cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-amber-400'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-mono uppercase text-slate-500">
                <th className="py-3 px-4">Booking # &amp; Guest</th>
                <th className="py-3 px-4">Event / Table</th>
                <th className="py-3 px-4">Pax &amp; Menu</th>
                <th className="py-3 px-4">Total (incl. GST)</th>
                <th className="py-3 px-4">Hybrid Payments</th>
                <th className="py-3 px-4">Balance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No advance food bookings found. Click <strong>+ New Advance Food Booking</strong> to create one.
                  </td>
                </tr>
              ) : (
                filteredList.map((b) => {
                  const splits = Array.isArray(b.payments) ? b.payments : [];
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-amber-700">{b.bookingNumber}</div>
                        <div className="font-bold text-slate-900">{b.guestOrGroupName}</div>
                        {b.mobile && <div className="text-[10.5px] font-mono text-slate-500">{b.mobile}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">
                          {b.eventDate} {b.eventTime ? `• ${b.eventTime}` : ''}
                        </div>
                        <div className="text-[10.5px] text-slate-500">
                          Table: <strong>{b.tableNumber || 'Banquet'}</strong> • {(b.meals || []).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {b.pax} Pax {Number(b.focPax) > 0 ? `(${b.focPax} FOC)` : ''}
                        </div>
                        <div className="text-[10.5px] text-slate-500">{b.menuCuisine}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-extrabold text-slate-900">
                          ₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}
                        </div>
                        {Number(b.gstAmount || 0) > 0 && (
                          <div className="text-[10px] text-slate-500">
                            incl. ₹{Number(b.gstAmount).toLocaleString('en-IN')} GST ({b.gstRate}%)
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-emerald-700">
                          ₹{Number(b.advanceAmount || 0).toLocaleString('en-IN')}
                        </div>
                        {splits.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {splits.map((sp) => (
                              <span
                                key={sp.id}
                                className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9.5px] font-mono font-bold"
                              >
                                {sp.method}: ₹{Number(sp.amount).toLocaleString('en-IN')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">{b.paymentMethod}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`font-extrabold ${
                            Number(b.balanceAmount || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          ₹{Number(b.balanceAmount || 0).toLocaleString('en-IN')}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {b.paymentStatus || (Number(b.balanceAmount || 0) <= 0 ? 'Paid' : Number(b.advanceAmount || 0) > 0 ? 'Partially Paid' : 'Unpaid')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[10px]">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {Number(b.balanceAmount || 0) > 0.01 && b.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => openSettleModal(b)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] cursor-pointer"
                            >
                              Settle
                            </button>
                          )}
                          {onCreatePosOrderFromAdvance && !b.convertedPosOrderId && b.status !== 'Cancelled' && b.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={() => onCreatePosOrderFromAdvance(b)}
                              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10.5px] cursor-pointer"
                            >
                              Seat / KOT
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(b)}
                            title="Print Advance Receipt"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(b)}
                            title="Edit Booking"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(b)}
                            title="Delete Booking"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT ADVANCE BOOKING MODAL WITH HYBRID SPLIT PAYMENTS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 block">
                  {editingItem ? `Edit ${editingItem.bookingNumber}` : `New Booking ${bookingNumber}`}
                </span>
                <h3 className="font-serif font-bold text-base">
                  Advance Food Booking &amp; Hybrid Payment Collection
                </h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Guest / Group Name *</label>
                  <input
                    type="text"
                    required
                    value={guestOrGroupName}
                    onChange={(e) => setGuestOrGroupName(e.target.value)}
                    placeholder="e.g., Sharma Family / Acme Corp"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Table / Hall</label>
                  <input
                    type="text"
                    list="fab-dynamic-tables"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder={availableTables[0] || 'e.g. T-01 or Banquet Hall'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                  />
                  <datalist id="fab-dynamic-tables">
                    {availableTables.map((t) => (
                      <option key={t} value={t} />
                    ))}
                    <option value="BANQUET" />
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Event Date *</label>
                  <input
                    type="date"
                    required
                    min={editingItem ? undefined : todayStr}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Event Time</label>
                  <input
                    type="text"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    placeholder="01:00 PM"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Pax *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={pax}
                    onChange={(e) => setPax(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Rate / Pax (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={ratePerPax}
                    onChange={(e) => setRatePerPax(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Meals *</label>
                  <div className="flex gap-1.5">
                    {(['Breakfast', 'Lunch', 'Dinner'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMeal(m)}
                        className={`flex-1 py-1.5 rounded-lg font-bold border cursor-pointer ${
                          meals.includes(m)
                            ? 'bg-slate-900 text-amber-400 border-slate-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Menu / Cuisine</label>
                  <input
                    type="text"
                    value={menuCuisine}
                    onChange={(e) => setMenuCuisine(e.target.value)}
                    placeholder="e.g., North Indian Thali + Mocktails"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">FOC Pax / Custom Subtotal</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={focPax}
                      onChange={(e) => setFocPax(e.target.value)}
                      placeholder="FOC"
                      className="px-2.5 py-2 border border-slate-200 rounded-xl font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      value={manualSubtotalOverride}
                      onChange={(e) => setManualSubtotalOverride(e.target.value)}
                      placeholder="Override ₹"
                      className="px-2.5 py-2 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* GST & Summary Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 font-bold text-amber-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(e) => setGstEnabled(e.target.checked)}
                    />
                    Apply F&amp;B GST
                  </label>
                  {gstEnabled && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-amber-900">GST %:</span>
                      <input
                        type="number"
                        min={0}
                        max={28}
                        step={0.5}
                        value={gstRateInput}
                        onChange={(e) => setGstRateInput(e.target.value)}
                        className="w-16 px-2 py-1 rounded-lg border border-amber-300 bg-white font-mono font-bold text-right"
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-amber-200/80 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Subtotal</span>
                    <strong className="text-slate-900">₹{computedSubtotal.toLocaleString('en-IN')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">GST ({effectiveGstRate}%)</span>
                    <strong className="text-slate-900">
                      ₹{computedGst.toLocaleString('en-IN')} (CGST ₹{computedCgst} + SGST ₹{computedSgst})
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Total Payable</span>
                    <strong className="text-base text-slate-950">₹{computedTotal.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              {/* HYBRID / SPLIT PAYMENT ROWS */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Split className="w-4 h-4 text-emerald-700" /> Hybrid / Split Advance Payment
                    </span>
                    <span className="text-[10.5px] text-emerald-800">
                      Add multiple modes (e.g., Cash + UPI + Card) in one transaction. Supports partial or full payment.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addSplitRow(setSplitRows, splitRows.length === 1 ? 'UPI' : 'Card', '')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    + Add Split Payment
                  </button>
                </div>

                <div className="space-y-2">
                  {splitRows.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={row.method}
                        onChange={(e) =>
                          setSplitRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, method: e.target.value as any } : r))
                          )
                        }
                        className="col-span-3 px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-white font-bold"
                      >
                        {PAYMENT_MODES.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.amount}
                        onChange={(e) =>
                          setSplitRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r))
                          )
                        }
                        placeholder="Amount ₹"
                        className="col-span-3 px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-white font-mono font-bold"
                      />
                      <input
                        type="text"
                        value={row.reference}
                        onChange={(e) =>
                          setSplitRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, reference: e.target.value } : r))
                          )
                        }
                        placeholder="UTR / Ref / Card Last 4"
                        className="col-span-4 px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-white"
                      />
                      <div className="col-span-2 flex justify-end">
                        {splitRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSplitRows((prev) => prev.filter((r) => r.id !== row.id))}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                            title={`Remove split #${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200 font-mono text-xs">
                  <span className="font-bold text-emerald-900">
                    Total Collected: ₹{totalSplitPaid.toLocaleString('en-IN')}
                  </span>
                  <span className={`font-extrabold ${isOverpaid ? 'text-rose-700' : 'text-slate-900'}`}>
                    {isOverpaid
                      ? `⚠ Overpaid by ₹${r2(totalSplitPaid - computedTotal)}`
                      : `Balance Due: ₹${computedBalance.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Special Request / Menu Notes</label>
                <input
                  type="text"
                  value={specialRequest}
                  onChange={(e) => setSpecialRequest(e.target.value)}
                  placeholder="Jain food, birthday cake setup, extra seating..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOverpaid}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-amber-400 font-bold cursor-pointer"
                >
                  {editingItem ? 'Update Advance Booking' : 'Save Advance Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HYBRID BALANCE SETTLEMENT MODAL */}
      {settlingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-emerald-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-200 block">
                  {settlingItem.bookingNumber} • Balance Due: ₹{Number(settlingItem.balanceAmount || 0).toLocaleString('en-IN')}
                </span>
                <h3 className="font-serif font-bold text-base">Settle Balance — {settlingItem.guestOrGroupName}</h3>
              </div>
              <button type="button" onClick={() => setSettlingItem(null)} className="text-emerald-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettleBalance} className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Settlement Payment Splits</span>
                <button
                  type="button"
                  onClick={() => addSplitRow(setSettleSplitRows, 'UPI', '')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10.5px] cursor-pointer"
                >
                  + Add Mode
                </button>
              </div>

              <div className="space-y-2">
                {settleSplitRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={row.method}
                      onChange={(e) =>
                        setSettleSplitRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, method: e.target.value as any } : r))
                        )
                      }
                      className="col-span-3 px-2 py-1.5 rounded-xl border border-slate-200 bg-white font-bold"
                    >
                      {PAYMENT_MODES.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={row.amount}
                      onChange={(e) =>
                        setSettleSplitRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r))
                        )
                      }
                      placeholder="₹ Amount"
                      className="col-span-4 px-2 py-1.5 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                    <input
                      type="text"
                      value={row.reference}
                      onChange={(e) =>
                        setSettleSplitRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, reference: e.target.value } : r))
                        )
                      }
                      placeholder="UTR / Ref"
                      className="col-span-4 px-2 py-1.5 rounded-xl border border-slate-200"
                    />
                    <div className="col-span-1 flex justify-end">
                      {settleSplitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSettleSplitRows((prev) => prev.filter((r) => r.id !== row.id))}
                          className="text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettlingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Confirm Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
