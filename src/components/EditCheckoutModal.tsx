import React, { useState, useMemo } from 'react';
import {
  GuestCheckIn,
  Booking,
  Invoice,
  Room,
  HotelSettings,
  PosOrder,
  WaterBottleRecord,
  ExtraCharge,
  PaymentRecord,
} from '../types';
import {
  BillPayment,
  BillSettings,
  calculateBill,
  normalizeBillSettings,
  r2,
} from '../utils/billCalculator';
import { stayNights } from '../utils/folioCollector';
import {
  allocateInvoiceNumber,
  buildInvoiceRecord,
  buildStayBill,
} from '../utils/stayBilling';
import { deduplicateInvoicesByBooking } from '../utils/invoiceConditions';
import { showToast } from '../utils/toast';
import { invoiceRecordToPrintHtml } from '../utils/pdfDownload';
import { openPrintWindow } from '../utils/printDocument';
import { X, Plus, Trash2, Check, Sparkles, CreditCard, Wallet, Receipt, Printer, UtensilsCrossed, User, Building2 } from 'lucide-react';

interface EditCheckoutModalProps {
  guest: GuestCheckIn;
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  posOrders?: PosOrder[];
  waterBottles?: WaterBottleRecord[];
  hotelSettings?: HotelSettings;
  loggedInUser?: string;
  onUpdateCheckins: (checkins: GuestCheckIn[]) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdateInvoices: (invoices: Invoice[]) => void;
  onAddAuditLog?: (action: string, details: string, module?: any) => void;
  onClose: () => void;
}

interface EditablePaymentRow {
  id: string;
  date: string;
  method: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  paymentType: 'Advance Deposit' | 'Settle Balance' | 'Room Service';
  amount: number | '';
  notes: string;
}

const toLocalYmd = (raw?: string): string => {
  const s = String(raw || '').trim();
  if (!s) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return s.slice(0, 10);
};

const normalizeMode = (raw?: string): 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' => {
  const m = String(raw || '').toLowerCase();
  if (m.includes('cash')) return 'Cash';
  if (m.includes('card') || m.includes('pos')) return 'Card';
  if (m.includes('bank') || m.includes('neft') || m.includes('rtgs') || m.includes('imps') || m.includes('icici')) {
    return 'Bank Transfer';
  }
  return 'UPI';
};

export default function EditCheckoutModal({
  guest,
  rooms,
  bookings,
  checkins,
  invoices,
  posOrders = [],
  waterBottles = [],
  hotelSettings,
  loggedInUser,
  onUpdateCheckins,
  onUpdateBookings,
  onUpdateInvoices,
  onAddAuditLog,
  onClose,
}: EditCheckoutModalProps) {
  const matchedBooking = useMemo(
    () =>
      bookings.find(
        (b) =>
          b.id === guest.id ||
          ((guest as any).bookingId && b.id === (guest as any).bookingId)
      ) || null,
    [bookings, guest]
  );

  const existingStayInv = useMemo(
    () =>
      invoices.find(
        (inv) =>
          !inv.isSeparateInvoice &&
          inv.invoiceStatus !== 'Superseded' &&
          inv.invoiceStatus !== 'Cancelled' &&
          (inv.bookingId === guest.id ||
            inv.checkInId === guest.id ||
            (matchedBooking && inv.bookingId === matchedBooking.id))
      ) || null,
    [invoices, guest, matchedBooking]
  );

  const [editGuestName, setEditGuestName] = useState<string>(() => guest.guestName || matchedBooking?.guestName || '');
  const [editGuestMobile, setEditGuestMobile] = useState<string>(() => guest.mobile || matchedBooking?.mobile || '');
  const [editGuestEmail, setEditGuestEmail] = useState<string>(
    () => guest.emailAddress || (guest as any).email || matchedBooking?.email || ''
  );
  const [editGuestCompanyName, setEditGuestCompanyName] = useState<string>(
    () => guest.companyName || matchedBooking?.companyName || existingStayInv?.companyName || ''
  );
  const [editGuestGstNumber, setEditGuestGstNumber] = useState<string>(
    () => guest.gstNumber || matchedBooking?.gstNumber || existingStayInv?.guestGstNumber || ''
  );
  const [editGuestAddress, setEditGuestAddress] = useState<string>(
    () => guest.address || matchedBooking?.address || (existingStayInv as any)?.billingAddress || ''
  );
  const [editGuestIdType, setEditGuestIdType] = useState<string>(() => guest.idType || 'Aadhaar');
  const [editGuestIdNumber, setEditGuestIdNumber] = useState<string>(
    () => guest.idNumber || matchedBooking?.aadhaarNumber || ''
  );
  const [editGuestNumGuests, setEditGuestNumGuests] = useState<number>(
    () => Number((guest as any).numberOfGuests || guest.adults || matchedBooking?.adults || 1)
  );

  const [editCheckInDate, setEditCheckInDate] = useState<string>(() =>
    toLocalYmd(guest.checkInDate)
  );
  const [editCheckOutDate, setEditCheckOutDate] = useState<string>(() =>
    toLocalYmd(guest.checkOutDate || guest.checkedOutDateTime)
  );
  const [editRoomRate, setEditRoomRate] = useState<number>(() => {
    const fallback = rooms.find((r) => r.number === guest.roomNumber)?.rate || 2000;
    return Number(guest.roomRate) > 0 ? Number(guest.roomRate) : fallback;
  });
  const [editDiscount, setEditDiscount] = useState<number>(() =>
    Math.max(
      0,
      Number(existingStayInv?.discount ?? guest.discount ?? (matchedBooking as any)?.discount ?? 0) || 0
    )
  );

  type GstOptionMode = 'non_gst' | 'gst_extra' | 'including_gst';

  const [editGstMode, setEditGstMode] = useState<GstOptionMode>(() => {
    const isNoGst =
      guest.isWithoutGst === true ||
      (guest.gstRate !== undefined && Number(guest.gstRate) <= 0) ||
      (existingStayInv &&
        (existingStayInv.isWithoutGst === true ||
          (existingStayInv.gstRate !== undefined && Number(existingStayInv.gstRate) <= 0) ||
          (existingStayInv.gstRate === undefined && Number(existingStayInv.gst || 0) <= 0)));
    if (isNoGst) return 'non_gst';
    if (guest.roomRateIncludesGst || (existingStayInv as any)?.roomRateIncludesGst) return 'including_gst';
    return 'gst_extra';
  });

  const [editExtraCharges, setEditExtraCharges] = useState<ExtraCharge[]>(() =>
    Array.isArray(guest.extraCharges) ? [...guest.extraCharges] : []
  );
  const [newChargeCategory, setNewChargeCategory] = useState<
    'Laundry' | 'Water Bottle' | 'Food' | 'Extra Bed' | 'Late Checkout' | 'Damage' | 'Other'
  >('Laundry');
  const [newChargeDesc, setNewChargeDesc] = useState<string>('');
  const [newChargeAmt, setNewChargeAmt] = useState<number | ''>('');

  // Hydrate initial payment rows without duplicates
  const [paymentRows, setPaymentRows] = useState<EditablePaymentRow[]>(() => {
    const rows: EditablePaymentRow[] = [];
    const seenKeys = new Set<string>();
    const defaultOutDate = toLocalYmd(guest.checkedOutDateTime || guest.checkOutDate);

    if (Array.isArray(guest.payments) && guest.payments.length > 0) {
      guest.payments.forEach((p, i) => {
        const amt = Number(p?.amount) || 0;
        if (amt <= 0) return;
        const dt = toLocalYmd(p.dateTime || guest.checkInDate || defaultOutDate);
        const mode = normalizeMode(p.paymentMethod);
        const pType: EditablePaymentRow['paymentType'] =
          p.paymentType === 'Advance Deposit'
            ? 'Advance Deposit'
            : p.paymentType === 'Room Service'
            ? 'Room Service'
            : 'Settle Balance';
        const key = `${p.id || i}:${amt}:${mode}:${dt}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        rows.push({
          id: p.id || `edit-pay-${i + 1}`,
          date: dt,
          method: mode,
          paymentType: pType,
          amount: amt,
          notes: p.notes || p.referenceId || '',
        });
      });
    } else if (existingStayInv && Array.isArray((existingStayInv as any).paymentHistory)) {
      ((existingStayInv as any).paymentHistory as any[]).forEach((ph, i) => {
        const amt = Number(ph?.amount) || 0;
        if (amt <= 0) return;
        const dt = toLocalYmd(ph.date || ph.dateTime || defaultOutDate);
        const mode = normalizeMode(ph.paymentMethod || ph.method);
        const isAdv = String(ph.id || ph.notes || '').toLowerCase().includes('adv');
        rows.push({
          id: ph.id || `edit-ph-${i + 1}`,
          date: dt,
          method: mode,
          paymentType: isAdv ? 'Advance Deposit' : 'Settle Balance',
          amount: amt,
          notes: ph.notes || ph.note || '',
        });
      });
    }

    if (rows.length === 0) {
      const adv = Number(guest.advanceAmount || matchedBooking?.advanceAmount || 0);
      if (adv > 0) {
        rows.push({
          id: `PAY-${guest.id}-adv`,
          date: toLocalYmd(guest.checkInDate),
          method: normalizeMode(matchedBooking?.paymentMethod || guest.paymentMethod || 'Cash'),
          paymentType: 'Advance Deposit',
          amount: adv,
          notes: 'Advance Deposit',
        });
      }
      const invPaid = Number(existingStayInv?.paidAmount || 0);
      const extraPaid = Math.max(0, r2(invPaid - adv));
      if (extraPaid > 0) {
        rows.push({
          id: `PAY-CO-${guest.id}`,
          date: defaultOutDate,
          method: normalizeMode(existingStayInv?.paymentMethod || guest.paymentMethod || 'Cash'),
          paymentType: 'Settle Balance',
          amount: extraPaid,
          notes: 'Checkout Settlement',
        });
      }
    }

    if (rows.length === 0) {
      rows.push({
        id: `PAY-CO-${Date.now()}`,
        date: defaultOutDate,
        method: 'Cash',
        paymentType: 'Settle Balance',
        amount: 0,
        notes: 'Checkout Settlement',
      });
    }

    return rows;
  });

  // Live recalculated bill
  const liveCalc = useMemo(() => {
    const baseSettings = normalizeBillSettings(hotelSettings);
    const configuredGst = Number(hotelSettings?.defaultGstRate ?? baseSettings.roomGstRate ?? 5) || 5;
    const resolvedGstRate = editGstMode === 'non_gst' ? 0 : (Number(existingStayInv?.gstRate) || configuredGst);
    const gstEnabled = editGstMode !== 'non_gst' && resolvedGstRate > 0;
    const roomRateIncludesGst = editGstMode === 'including_gst';

    const effectiveSettings: BillSettings = {
      ...baseSettings,
      roomGstRate: gstEnabled ? resolvedGstRate : 0,
      foodGstRate: gstEnabled ? (baseSettings.foodGstRate || resolvedGstRate) : 0,
      roomRateIncludesGst,
    };

    const tempCheckin: GuestCheckIn = {
      ...guest,
      guestName: editGuestName.trim() || guest.guestName,
      mobile: editGuestMobile.trim() || guest.mobile,
      companyName: editGuestCompanyName.trim(),
      gstNumber: editGuestGstNumber.trim(),
      checkInDate: editCheckInDate,
      checkOutDate: editCheckOutDate,
      roomRate: editRoomRate,
      roomRateIncludesGst,
      isWithoutGst: editGstMode === 'non_gst',
      gstRate: resolvedGstRate,
      extraCharges: editExtraCharges,
      payments: [],
      advanceAmount: 0,
      cashAmountPaid: 0,
      onlineAmountPaid: 0,
    };

    const tempBooking = matchedBooking
      ? ({
          ...matchedBooking,
          guestName: editGuestName.trim() || matchedBooking.guestName,
          mobile: editGuestMobile.trim() || matchedBooking.mobile,
          companyName: editGuestCompanyName.trim(),
          gstNumber: editGuestGstNumber.trim(),
          checkInDate: editCheckInDate,
          checkOutDate: editCheckOutDate,
          roomRateIncludesGst,
          isWithoutGst: editGstMode === 'non_gst',
          gstRate: resolvedGstRate,
          advanceAmount: 0,
          payments: [],
        } as Booking)
      : null;

    const stayBill = buildStayBill({
      booking: tempBooking,
      checkin: tempCheckin,
      posOrders,
      waterBottles,
      rooms,
      settings: effectiveSettings,
      gstEnabledOverride: gstEnabled,
      discountOverride: Math.max(0, Number(editDiscount) || 0),
    });

    const activePayItems: BillPayment[] = paymentRows
      .filter((r) => (Number(r.amount) || 0) > 0)
      .map((r, i) => ({
        id: r.id || `ep-${i}`,
        amount: r2(Number(r.amount) || 0),
        method: r.method,
        date: r.date,
        note: r.notes,
      }));

    const finalBill = calculateBill({
      charges: stayBill.folio.charges,
      payments: activePayItems,
      discount: Math.max(0, Number(editDiscount) || 0),
      gstEnabled,
      settings: effectiveSettings,
    });

    let cashTotal = 0;
    let upiTotal = 0;
    let cardBankTotal = 0;
    activePayItems.forEach((p) => {
      const m = p.method.toLowerCase();
      if (m.includes('cash')) cashTotal += p.amount;
      else if (m.includes('upi')) upiTotal += p.amount;
      else cardBankTotal += p.amount;
    });

    return {
      nights: stayNights(guest.checkInDate, editCheckOutDate),
      charges: stayBill.folio.charges,
      roomNumbers:
        stayBill.folio.roomNumbers.length > 0 ? stayBill.folio.roomNumbers : [guest.roomNumber],
      bill: finalBill,
      settings: effectiveSettings,
      baseSettings,
      gstEnabled,
      gstRate: finalBill.isGstInvoice ? finalBill.headlineGstRate || resolvedGstRate : 0,
      grandTotal: finalBill.grandTotal,
      totalPaid: finalBill.receipts,
      balanceDue: finalBill.balance,
      cashTotal: r2(cashTotal),
      upiTotal: r2(upiTotal),
      cardBankTotal: r2(cardBankTotal),
    };
  }, [
    guest,
    matchedBooking,
    existingStayInv,
    hotelSettings,
    posOrders,
    waterBottles,
    rooms,
    editCheckOutDate,
    editRoomRate,
    editDiscount,
    editGstMode,
    editExtraCharges,
    paymentRows,
  ]);

  const handleAddExtraCharge = () => {
    const amt = Math.max(0, Number(newChargeAmt) || 0);
    if (amt <= 0) {
      showToast('Please enter a charge amount greater than ₹0.', 'warning');
      return;
    }
    const mappedCat: ExtraCharge['category'] =
      newChargeCategory === 'Water Bottle' || newChargeCategory === 'Extra Bed'
        ? 'Other'
        : newChargeCategory;
    const desc =
      newChargeDesc.trim() ||
      (newChargeCategory === 'Water Bottle'
        ? 'Water Bottle Charge'
        : newChargeCategory === 'Extra Bed'
        ? 'Extra Bed / Mattress Charge'
        : `${newChargeCategory} Charge`);

    const item: ExtraCharge = {
      id: `EC-EDIT-${Date.now()}`,
      category: mappedCat,
      description: desc,
      amount: amt,
      dateTime: new Date().toISOString(),
    };
    setEditExtraCharges((prev) => [...prev, item]);
    setNewChargeDesc('');
    setNewChargeAmt('');
    showToast(`Added ${desc} (₹${amt.toLocaleString('en-IN')})`, 'success');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = paymentRows.filter((r) => (Number(r.amount) || 0) > 0);
    const totalPaidNow = r2(validRows.reduce((s, r) => s + (Number(r.amount) || 0), 0));

    if (totalPaidNow > liveCalc.grandTotal + 0.5) {
      showToast(
        `Total paid amount (₹${totalPaidNow.toLocaleString('en-IN')}) cannot exceed Final Payable Bill (₹${liveCalc.grandTotal.toLocaleString('en-IN')}).`,
        'error'
      );
      return;
    }

    const nextPayments: PaymentRecord[] = validRows.map((r, idx) => ({
      id: r.id || `PAY-EDIT-${guest.id}-${idx + 1}`,
      amount: r2(Number(r.amount) || 0),
      paymentMethod: r.method as any,
      paymentType: r.paymentType,
      dateTime: r.date || editCheckOutDate,
      referenceId: r.notes || undefined,
      notes:
        r.notes?.trim() ||
        (r.paymentType === 'Advance Deposit'
          ? `Advance Payment (${r.method})`
          : `Checkout Settlement (${r.method})`),
    }));

    const advSum = r2(
      nextPayments
        .filter((p) => p.paymentType === 'Advance Deposit')
        .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    );
    const nonAdvCash = r2(
      nextPayments
        .filter((p) => p.paymentType !== 'Advance Deposit' && p.paymentMethod === 'Cash')
        .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    );
    const nonAdvOnline = r2(
      nextPayments
        .filter((p) => p.paymentType !== 'Advance Deposit' && p.paymentMethod !== 'Cash')
        .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    );

    // Build clean summary label (e.g. "Cash ₹9000 + UPI ₹345" or "Cash")
    const modeBuckets: Record<string, number> = {};
    nextPayments.forEach((p) => {
      modeBuckets[p.paymentMethod] = r2((modeBuckets[p.paymentMethod] || 0) + Number(p.amount || 0));
    });
    const modeKeys = Object.keys(modeBuckets);
    const summaryMethod =
      modeKeys.length > 1
        ? modeKeys.map((k) => `${k} ₹${modeBuckets[k]}`).join(' + ')
        : modeKeys[0] || String(guest.paymentMethod || 'Cash');

    const prevOutYmd = toLocalYmd(guest.checkedOutDateTime);
    const resolvedCheckedOutIso =
      guest.checkedOutDateTime && prevOutYmd === editCheckOutDate
        ? guest.checkedOutDateTime
        : `${editCheckOutDate}T12:00:00`;

    const updatedGuest: GuestCheckIn = {
      ...guest,
      guestName: editGuestName.trim() || guest.guestName,
      mobile: editGuestMobile.trim() || guest.mobile,
      emailAddress: editGuestEmail.trim(),
      companyName: editGuestCompanyName.trim(),
      gstNumber: editGuestGstNumber.trim(),
      address: editGuestAddress.trim(),
      idType: editGuestIdType,
      idNumber: editGuestIdNumber.trim(),
      numberOfGuests: editGuestNumGuests,
      adults: editGuestNumGuests,
      checkInDate: editCheckInDate,
      checkOutDate: editCheckOutDate,
      roomRate: editRoomRate,
      roomRateIncludesGst: editGstMode === 'including_gst',
      isWithoutGst: editGstMode === 'non_gst',
      gstRate: editGstMode === 'non_gst' ? 0 : liveCalc.gstRate,
      discount: r2(Math.max(0, Number(editDiscount) || 0)),
      extraCharges: editExtraCharges,
      advanceAmount: advSum,
      cashAmountPaid: nonAdvCash,
      onlineAmountPaid: nonAdvOnline,
      payments: nextPayments,
      paymentMethod: (modeKeys[0] || guest.paymentMethod || 'Cash') as any,
      totalAmount: liveCalc.grandTotal,
      pendingAmount: liveCalc.balanceDue,
      checkedOutDateTime: guest.checkedOutDateTime ? resolvedCheckedOutIso : `${editCheckOutDate}T12:00:00`,
      checkedOutBy: guest.checkedOutBy || loggedInUser || 'Front Desk',
    } as any;

    if (checkins.some((c) => c.id === guest.id)) {
      onUpdateCheckins(checkins.map((c) => (c.id === guest.id ? updatedGuest : c)));
    } else {
      onUpdateCheckins([updatedGuest, ...checkins]);
    }

    // Sync linked Booking
    onUpdateBookings(
      bookings.map((b) => {
        const isMatch =
          b.id === guest.id ||
          ((guest as any).bookingId && b.id === (guest as any).bookingId) ||
          (matchedBooking && b.id === matchedBooking.id);
        if (!isMatch) return b;
        return {
          ...b,
          guestName: editGuestName.trim() || b.guestName,
          mobile: editGuestMobile.trim() || b.mobile,
          email: editGuestEmail.trim() || b.email,
          companyName: editGuestCompanyName.trim(),
          gstNumber: editGuestGstNumber.trim(),
          address: editGuestAddress.trim() || b.address,
          aadhaarNumber: editGuestIdNumber.trim() || b.aadhaarNumber,
          adults: editGuestNumGuests,
          checkInDate: editCheckInDate,
          checkOutDate: editCheckOutDate,
          nights: liveCalc.nights,
          roomRateIncludesGst: editGstMode === 'including_gst',
          isWithoutGst: editGstMode === 'non_gst',
          gstRate: editGstMode === 'non_gst' ? 0 : liveCalc.gstRate,
          discount: r2(Math.max(0, Number(editDiscount) || 0)),
          advanceAmount: advSum > 0 ? advSum : b.advanceAmount,
          amountPaid: totalPaidNow,
          dueAmount: liveCalc.balanceDue,
          isCheckedIn: false,
          isCompleted: true,
          isCheckedOut: true,
          status: 'CheckedOut' as any,
          paymentStatus:
            liveCalc.balanceDue <= 0 ? 'Paid' : totalPaidNow > 0 ? 'Partially Paid' : 'Unpaid',
          payments: nextPayments.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.paymentMethod,
            paymentMethod: p.paymentMethod,
            paymentType: p.paymentType,
            date: toLocalYmd(p.dateTime),
            notes: p.notes,
          })),
        } as any;
      })
    );

    // Sync Official Stay Invoice & structured paymentHistory
    const fallbackAllocated = allocateInvoiceNumber(invoices, liveCalc.baseSettings);
    const invNum = existingStayInv?.invoiceNumber || fallbackAllocated.invoiceNumber;

    const rebuiltInvoice = buildInvoiceRecord({
      id: existingStayInv?.id || `INV-STAY-${guest.id}`,
      invoiceNumber: invNum,
      hotelId: guest.hotelId || hotelSettings?.id,
      bookingId: matchedBooking?.id || guest.id,
      checkInId: guest.id,
      guestName: editGuestName.trim() || guest.guestName,
      guestMobile: editGuestMobile.trim() || guest.mobile,
      guestAddress: editGuestAddress.trim() || [guest.address, guest.city, guest.state].filter(Boolean).join(', '),
      companyName: editGuestCompanyName.trim(),
      guestGstNumber: editGuestGstNumber.trim(),
      roomNumbers: liveCalc.roomNumbers,
      checkInDate: editCheckInDate,
      checkOutDate: editCheckOutDate,
      nights: liveCalc.nights,
      bill: liveCalc.bill,
      paymentMethod: summaryMethod,
      dateCreated: existingStayInv?.dateCreated || editCheckOutDate,
      invoiceStatus: 'Finalized',
      extra: {
        extraBedCount: guest.hasExtraBed ? guest.extraBedCount || 1 : 0,
        extraBedRate: guest.extraBedRate || 500,
        isFinalInvoice: true,
        notes: existingStayInv?.notes,
      },
    });

    const syncedInvoice: Invoice = {
      ...(existingStayInv || {}),
      ...(rebuiltInvoice as Invoice),
      guestName: editGuestName.trim() || guest.guestName,
      guestPhone: editGuestMobile.trim() || guest.mobile,
      guestEmail: editGuestEmail.trim() || (guest as any).emailAddress,
      companyName: editGuestCompanyName.trim(),
      guestGstNumber: editGuestGstNumber.trim(),
      billingAddress: editGuestAddress.trim() || (existingStayInv as any)?.billingAddress,
      checkInDate: editCheckInDate,
      checkOutDate: editCheckOutDate,
      isWithoutGst: editGstMode === 'non_gst',
      gstRate: editGstMode === 'non_gst' ? 0 : liveCalc.gstRate,
      roomRateIncludesGst: editGstMode === 'including_gst',
      invoiceType: editGstMode === 'non_gst' ? 'Bill of Supply' : 'Tax Invoice',
      extraCharges: editExtraCharges,
      paymentMethod: summaryMethod as any,
      paymentHistory: nextPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod as any,
        date: toLocalYmd(p.dateTime),
        notes: p.notes,
      })),
    };

    const nextInvoices = deduplicateInvoicesByBooking(
      invoices.some(
        (inv) =>
          inv.id === syncedInvoice.id ||
          (existingStayInv && inv.id === existingStayInv.id) ||
          (!inv.isSeparateInvoice && inv.bookingId && inv.bookingId === syncedInvoice.bookingId)
      )
        ? invoices.map((inv) =>
            inv.id === syncedInvoice.id ||
            (existingStayInv && inv.id === existingStayInv.id) ||
            (!inv.isSeparateInvoice && inv.bookingId && inv.bookingId === syncedInvoice.bookingId)
              ? syncedInvoice
              : inv
          )
        : [syncedInvoice, ...invoices]
    );
    onUpdateInvoices(nextInvoices);

    if (onAddAuditLog) {
      onAddAuditLog(
        'Check-Out Edited',
        `Updated Check-Out settlement for ${guest.guestName} (Room ${guest.roomNumber}). Final Bill: ₹${liveCalc.grandTotal}, Paid: ₹${totalPaidNow} (${summaryMethod}), Balance: ₹${liveCalc.balanceDue}.`
      );
    }

    showToast(
      `Check-Out settlement updated for ${guest.guestName} (Room ${guest.roomNumber}) and synced to Reports & Invoices.`,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-[#C49A3A]/50 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#17120F] to-[#2B211A] text-white px-5 py-4 flex items-center justify-between border-b border-[#C49A3A]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C49A3A]/20 border border-[#C49A3A]/50 flex items-center justify-center text-[#F2CF88]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8BD6F] font-bold block">
                Post Check-Out Settlement &amp; Folio Editor
              </span>
              <h3 className="text-base font-serif font-bold text-white" style={{ color: '#FFFFFF' }}>
                Edit Check-Out — {editGuestName || guest.guestName} (Room {guest.roomNumber})
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Guest Information & Corporate GST Details */}
          <div className="bg-[#FAF7F2] p-4 rounded-xl border border-luxury-brown-200 space-y-3">
            <div className="flex items-center justify-between border-b border-luxury-brown-200/70 pb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-luxury-brown-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#C49A3A]" /> Guest Information &amp; Corporate GST Details
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Invoice Recipient &amp; Tax Info</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  Guest Name *
                </label>
                <input
                  type="text"
                  required
                  value={editGuestName}
                  onChange={(e) => setEditGuestName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={editGuestMobile}
                  onChange={(e) => setEditGuestMobile(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editGuestEmail}
                  onChange={(e) => setEditGuestEmail(e.target.value)}
                  placeholder="direct.walkin@grandpavilion.in"
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449]"
                />
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  Company Name (Optional GST Bill)
                </label>
                <input
                  type="text"
                  value={editGuestCompanyName}
                  onChange={(e) => setEditGuestCompanyName(e.target.value)}
                  placeholder="Corporate / Company Name"
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449]"
                />
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  Customer GSTIN Number
                </label>
                <input
                  type="text"
                  value={editGuestGstNumber}
                  onChange={(e) => setEditGuestGstNumber(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  Occupants (Guests)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={editGuestNumGuests}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => setEditGuestNumGuests(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  ID Document Type
                </label>
                <select
                  value={editGuestIdType}
                  onChange={(e) => setEditGuestIdType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449]"
                >
                  <option value="Aadhaar">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Other">Other ID</option>
                </select>
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  ID Proof Number
                </label>
                <input
                  type="text"
                  value={editGuestIdNumber}
                  onChange={(e) => setEditGuestIdNumber(e.target.value.toUpperCase())}
                  placeholder="1234569870"
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={editGuestAddress}
                  onChange={(e) => setEditGuestAddress(e.target.value)}
                  placeholder="BHATAGAON R, C.G."
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449]"
                />
              </div>
            </div>
          </div>

          {/* Top Stay & Tariff Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 bg-[#FAF7F2] p-4 rounded-xl border border-luxury-brown-200">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-800 block">
                Check-In Date *
              </label>
              <input
                type="date"
                value={editCheckInDate}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setEditCheckInDate(e.target.value)}
                className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-950"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-800 block">
                Check-Out Date *
              </label>
              <input
                type="date"
                min={editCheckInDate}
                value={editCheckOutDate}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setEditCheckOutDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#C49A3A] rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-950"
              />
            </div>

            {!guest.isGroupCheckIn && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-800 block">
                  Room Tariff / Night (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editRoomRate}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => setEditRoomRate(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase font-bold text-rose-800 block">
                Discount / Adjustment (₹)
              </label>
              <input
                type="number"
                min={0}
                value={editDiscount || ''}
                placeholder="0"
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs font-mono font-bold bg-white text-rose-800"
              />
            </div>
          </div>

          {/* GST Billing Mode: Non-GST (0%), GST Extra, Including GST */}
          <div className="p-4 rounded-xl border border-luxury-brown-200 bg-[#FFFDF7] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono uppercase font-bold text-luxury-brown-900 block">
                GST Billing Mode *
              </label>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                editGstMode === 'non_gst'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : editGstMode === 'including_gst'
                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}>
                {editGstMode === 'non_gst' ? 'Non-GST (0% Bill of Supply)' : editGstMode === 'including_gst' ? `Including GST (${liveCalc.gstRate}%)` : `GST Extra (+${liveCalc.gstRate}%)`}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditGstMode('non_gst')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  editGstMode === 'non_gst'
                    ? 'bg-amber-100 border-[#C49A3A] text-amber-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">1. Non-GST (0%)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Bill of Supply • No Tax</div>
              </button>
              <button
                type="button"
                onClick={() => setEditGstMode('gst_extra')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  editGstMode === 'gst_extra'
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">2. GST Extra (+{Number(hotelSettings?.defaultGstRate ?? 5)}%)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Rate + GST Added on Top</div>
              </button>
              <button
                type="button"
                onClick={() => setEditGstMode('including_gst')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  editGstMode === 'including_gst'
                    ? 'bg-blue-100 border-blue-500 text-blue-950 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">3. Including GST ({Number(hotelSettings?.defaultGstRate ?? 5)}%)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tariff Includes GST (Net ₹{editRoomRate})</div>
              </button>
            </div>
          </div>

          {/* Extra Charges / Laundry / Water / Late Checkout / Fine Editor */}
          <div className="p-4 rounded-xl border border-luxury-brown-200 bg-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-serif font-bold text-luxury-brown-950 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#9E2A2B]" /> Extra Charges &amp; Add-ons (Laundry, Water, Late Check-Out, Fine)
              </span>
              {existingStayInv && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  Invoice #{existingStayInv.invoiceNumber} ({liveCalc.gstRate > 0 ? `GST ${liveCalc.gstRate}%` : '0% No GST'})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Category</label>
                <select
                  value={newChargeCategory}
                  onChange={(e) => setNewChargeCategory(e.target.value as any)}
                  className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white"
                >
                  <option value="Laundry">Laundry</option>
                  <option value="Water Bottle">Water Bottle</option>
                  <option value="Food">Food / Kitchen</option>
                  <option value="Extra Bed">Extra Bed</option>
                  <option value="Late Checkout">Late Check-Out</option>
                  <option value="Damage">Damage / Fine</option>
                  <option value="Other">Other Charge</option>
                </select>
              </div>
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Description</label>
                <input
                  type="text"
                  value={newChargeDesc}
                  onChange={(e) => setNewChargeDesc(e.target.value)}
                  placeholder="e.g. Laundry x2, Late departure..."
                  className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Amount ₹</label>
                <input
                  type="number"
                  min={0}
                  value={newChargeAmt}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => setNewChargeAmt(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddExtraCharge}
                  className="w-full py-2 px-3 rounded-lg bg-[#F6DE98] hover:bg-[#E8CE84] border border-[#C49A3A] text-[#17120F] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {editExtraCharges.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-[#FAF7F2]/60">
                {editExtraCharges.map((ec) => (
                  <div key={ec.id} className="px-3 py-1.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase text-[#8B691E] mr-2">
                        [{ec.category}]
                      </span>
                      <span className="font-medium text-slate-800">{ec.description}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-slate-900">
                        ₹{Number(ec.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditExtraCharges((prev) => prev.filter((x) => x.id !== ec.id))}
                        className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                        title="Remove charge"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Modes & Hybrid Split Ledger */}
          <div className="p-4 rounded-xl border-2 border-[#C49A3A]/60 bg-[#FDF8ED] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C49A3A]/30 pb-2.5">
              <div>
                <h4 className="text-sm font-serif font-bold text-[#17120F] flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#8B691E]" /> Payment Modes &amp; Hybrid Split Settlement
                </h4>
                <p className="text-[11px] text-slate-600">
                  Edit Cash / UPI / Card / Bank Transfer rows or add split rows. Report columns update automatically.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {liveCalc.balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentRows((prev) => [
                        ...prev,
                        {
                          id: `PAY-CO-${Date.now()}`,
                          date: editCheckOutDate,
                          method: 'UPI',
                          paymentType: 'Settle Balance',
                          amount: liveCalc.balanceDue,
                          notes: 'Balance Settlement',
                        },
                      ])
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                  >
                    + Settle Due (₹{liveCalc.balanceDue.toLocaleString('en-IN')})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setPaymentRows((prev) => [
                      ...prev,
                      {
                        id: `PAY-SPLIT-${Date.now()}`,
                        date: editCheckOutDate,
                        method: 'UPI',
                        paymentType: 'Settle Balance',
                        amount: 0,
                        notes: 'Checkout Split Payment',
                      },
                    ])
                  }
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FFF6DF] border border-[#C49A3A] text-xs font-bold text-[#17120F] cursor-pointer"
                >
                  + Add Payment / Split Row
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {paymentRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-2.5 rounded-xl border border-luxury-brown-200/80"
                >
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Date</label>
                    <input
                      type="date"
                      value={row.date}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) =>
                        setPaymentRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, date: e.target.value } : r))
                        )
                      }
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Stage</label>
                    <select
                      value={row.paymentType}
                      onChange={(e) =>
                        setPaymentRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, paymentType: e.target.value as any } : r))
                        )
                      }
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
                    >
                      <option value="Advance Deposit">Advance Deposit</option>
                      <option value="Settle Balance">Checkout / Stay Settlement</option>
                      <option value="Room Service">Room Service</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Mode</label>
                    <select
                      value={row.method}
                      onChange={(e) =>
                        setPaymentRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, method: e.target.value as any } : r))
                        )
                      }
                      className="w-full px-2 py-1.5 border border-[#C49A3A] rounded-lg text-xs font-bold bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Amount ₹</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row.amount}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) =>
                        setPaymentRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, amount: e.target.value === '' ? '' : Number(e.target.value) }
                              : r
                          )
                        )
                      }
                      placeholder="0"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Ref / Note</label>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) =>
                        setPaymentRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, notes: e.target.value } : r))
                        )
                      }
                      placeholder="UTR / Note"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPaymentRows((prev) => prev.filter((r) => r.id !== row.id))}
                      className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete payment row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Mode Breakdown */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#C49A3A]/30 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold inline-flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> Cash: ₹{liveCalc.cashTotal.toLocaleString('en-IN')}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-bold">
                  UPI: ₹{liveCalc.upiTotal.toLocaleString('en-IN')}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold">
                  Card / Bank: ₹{liveCalc.cardBankTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="font-bold text-slate-700">
                {liveCalc.nights} Night{liveCalc.nights === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Bottom Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs bg-[#17120F] text-white p-4 rounded-xl">
            <div>
              <span className="text-[10px] uppercase text-[#D6C7B2] block">Taxable + GST ({liveCalc.gstRate}%)</span>
              <strong className="text-sm text-white block mt-0.5">
                ₹{liveCalc.bill.taxableAmount.toLocaleString('en-IN')} + ₹{liveCalc.bill.totalTax.toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-[10px] uppercase text-[#E8BD6F] block">Final Payable Bill</span>
              <strong className="text-lg text-[#F6DE98] block mt-0.5">
                ₹{liveCalc.grandTotal.toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-[10px] uppercase text-emerald-300 block">Total Collected</span>
              <strong className="text-lg text-emerald-400 block mt-0.5">
                ₹{liveCalc.totalPaid.toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span className="text-[10px] uppercase text-rose-300 block">Pending Balance Due</span>
              <strong className={`text-lg block mt-0.5 ${liveCalc.balanceDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {liveCalc.balanceDue > 0 ? `₹${liveCalc.balanceDue.toLocaleString('en-IN')}` : '₹0 (PAID)'}
              </strong>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              {liveCalc.charges.some(c => c.kind === 'food') && (
                <button
                  type="button"
                  onClick={() => {
                    const invToPrint = existingStayInv || {
                      id: `INV-TEMP-${guest.id}`,
                      invoiceNumber: existingStayInv?.invoiceNumber || 'TEMP',
                      bookingId: guest.id,
                      hotelId: guest.hotelId,
                      roomNumber: guest.roomNumber,
                      guestName: guest.guestName,
                      checkInDate: guest.checkInDate,
                      checkOutDate: editCheckOutDate,
                      isWithoutGst: editGstMode === 'non_gst',
                      gstRate: editGstMode === 'non_gst' ? 0 : liveCalc.gstRate,
                      subtotal: liveCalc.bill.subtotal,
                      totalAmount: liveCalc.grandTotal,
                      paidAmount: liveCalc.totalPaid,
                      pendingAmount: liveCalc.balanceDue,
                      billEngine: 'v2',
                      ledgerLines: liveCalc.charges.map(c => ({
                        type: 'charge',
                        sourceId: c.id,
                        kind: c.kind,
                        description: c.description,
                        charges: c.amount,
                        dateLabel: c.date,
                        roomNumber: c.roomNumber,
                      })),
                    };
                    openPrintWindow(invoiceRecordToPrintHtml(invToPrint as any, hotelSettings, guest, matchedBooking, 'food_only'));
                  }}
                  className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-900 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Print Separate Food & Beverage Bill"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700" /> Print Separate Food Bill
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const invToPrint = existingStayInv || {
                    id: `INV-TEMP-${guest.id}`,
                    invoiceNumber: existingStayInv?.invoiceNumber || 'TEMP',
                    bookingId: guest.id,
                    hotelId: guest.hotelId,
                    roomNumber: guest.roomNumber,
                    guestName: guest.guestName,
                    checkInDate: guest.checkInDate,
                    checkOutDate: editCheckOutDate,
                    isWithoutGst: editGstMode === 'non_gst',
                    gstRate: editGstMode === 'non_gst' ? 0 : liveCalc.gstRate,
                    subtotal: liveCalc.bill.subtotal,
                    totalAmount: liveCalc.grandTotal,
                    paidAmount: liveCalc.totalPaid,
                    pendingAmount: liveCalc.balanceDue,
                    billEngine: 'v2',
                    ledgerLines: liveCalc.charges.map(c => ({
                      type: 'charge',
                      sourceId: c.id,
                      kind: c.kind,
                      description: c.description,
                      charges: c.amount,
                      dateLabel: c.date,
                      roomNumber: c.roomNumber,
                    })),
                  };
                  openPrintWindow(invoiceRecordToPrintHtml(invToPrint as any, hotelSettings, guest, matchedBooking, 'room_only'));
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Print Room Charges Only"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Room Bill
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#F6DE98] hover:bg-[#E8CE84] border-2 border-[#C49A3A] text-[#17120F] text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4 text-[#8B691E]" /> Save Edited Check-Out &amp; Sync Report
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
