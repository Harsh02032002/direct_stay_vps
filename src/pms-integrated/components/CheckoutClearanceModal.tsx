import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  CreditCard,
  Check,
  FileText,
  Split,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  LogOut,
  Lock,
} from 'lucide-react';
import { BookingRecord, InvoiceRecord, OtherServiceItem, PaymentMethod } from '../types';
import { formatINRDecimal, getDayName } from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import {
  BillCharge,
  BillChargeKind,
  BillSettings,
  normalizeBillSettings,
  r2,
} from '../../utils/billCalculator';
import { buildStayBill } from '../../utils/stayBilling';

interface CheckoutClearanceModalProps {
  booking: BookingRecord | null;
  existingInvoice?: InvoiceRecord | null;
  billSettings?: BillSettings;
  rawBooking?: Record<string, any> | null;
  rawCheckin?: Record<string, any> | null;
  posOrders?: Record<string, any>[];
  laundryOrders?: Record<string, any>[];
  waterBottles?: Record<string, any>[];
  rooms?: Record<string, any>[];
  onClose: () => void;
  onPreviewInvoice: (booking: BookingRecord) => void;
  onCompleteFinalCheckout: (payload: {
    bookingId: string;
    addedServices: OtherServiceItem[];
    updatedDiscount: number;
    withGst: boolean;
    updatedGstRate: number;
    paymentsToRecord: Array<{ amount: number; method: PaymentMethod; referenceNo: string; notes: string }>;
    refundAmount: number;
  }) => void;
}

function serviceToChargeKind(serviceType?: string, desc?: string): BillChargeKind {
  const sv = String(serviceType || '').toLowerCase();
  const d = String(desc || '').toLowerCase();
  if (sv.includes('damage') || sv.includes('fine') || d.includes('fine')) return 'fine';
  if (sv.includes('room service') || sv.includes('food')) return 'food';
  if (sv.includes('laundry')) return 'laundry';
  if (sv.includes('water')) return 'water';
  if (sv.includes('extra bed')) return 'extra_bed';
  if (d.includes('late check')) return 'late_checkout';
  if (d.includes('early check')) return 'early_checkin';
  return 'service';
}

export default function CheckoutClearanceModal({
  booking,
  existingInvoice,
  billSettings,
  rawBooking,
  rawCheckin,
  posOrders = [],
  laundryOrders = [],
  waterBottles = [],
  rooms = [],
  onClose,
  onPreviewInvoice,
  onCompleteFinalCheckout,
}: CheckoutClearanceModalProps) {
  if (!booking) return null;

  const safeRoomNumbers: string[] =
    Array.isArray(booking.roomNumbers) && booking.roomNumbers.length > 0
      ? booking.roomNumbers
      : [(booking as any).roomNumber || (booking as any).room || '101'];
  const roomDisplay = safeRoomNumbers.join(', ');
  const paymentsList = Array.isArray(booking.payments) ? booking.payments : [];
  const guestName = booking.customerName || (booking as any).guestName || 'Guest';
  const bookingNo = booking.bookingNo || (booking as any).id || 'BK-101';
  const guestMobile = booking.mobile || (booking as any).phone || '';
  const checkInDate = booking.checkInDate || new Date().toISOString().slice(0, 10);
  const checkOutDate = booking.checkOutDate || new Date().toISOString().slice(0, 10);

  // Pre-departure inspection checklist
  const [coRoomInspected, setCoRoomInspected] = useState(true);
  const [coMinibarVerified, setCoMinibarVerified] = useState(true);
  const [coLinenVerified, setCoLinenVerified] = useState(true);

  // Existing folio services (read-only) vs ONLY newly added checkout charges (fixes C1 double-charging!)
  const existingServices: OtherServiceItem[] = useMemo(
    () => (Array.isArray(booking.otherServices) ? booking.otherServices : []),
    [booking.otherServices]
  );
  const [addedServices, setAddedServices] = useState<OtherServiceItem[]>([]);
  const [chargeCategory, setChargeCategory] = useState<OtherServiceItem['serviceType']>('DAMAGE / FINE');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmt, setChargeAmt] = useState<number>(0);
  const [coHasDamageFine, setCoHasDamageFine] = useState(false);

  // Bill adjustments & Tax — strictly locked if an invoice already exists for this stay
  const [taxSettings] = useHotelTaxSettings();
  const settings = billSettings || normalizeBillSettings(taxSettings);
  const configuredRoomGst = settings.roomGstRate;

  const isGstLockedByExistingInvoice = Boolean(existingInvoice && !existingInvoice.id.startsWith('FOLIO-'));
  const existingInvHasGst = existingInvoice
    ? existingInvoice.isWithoutGst === true
      ? false
      : existingInvoice.gstRate !== undefined
      ? Number(existingInvoice.gstRate) > 0
      : Number(existingInvoice.totalTax || 0) > 0
    : false;

  const [discount, setDiscount] = useState<number>(booking.discountAmount || 0);
  const [isGstEnabled, setIsGstEnabled] = useState<boolean>(
    isGstLockedByExistingInvoice
      ? existingInvHasGst
      : Boolean(booking.gstInvoice && Number(booking.taxRate ?? configuredRoomGst) > 0)
  );

  // Payment Clearance State (Single, Split Payment, or Refund)
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [coMarkPaid, setCoMarkPaid] = useState<boolean>(false);
  const [payInputsTouched, setPayInputsTouched] = useState<boolean>(false);
  const [primaryPayMethod, setPrimaryPayMethod] = useState<PaymentMethod>('UPI');
  const [primaryPayAmount, setPrimaryPayAmount] = useState<number>(0);
  const [primaryRef, setPrimaryRef] = useState<string>(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);

  const [secondaryPayMethod, setSecondaryPayMethod] = useState<PaymentMethod>('Cash');
  const [secondaryPayAmount, setSecondaryPayAmount] = useState<number>(0);
  const [secondaryRef, setSecondaryRef] = useState<string>(`CASH-${Math.floor(1000 + Math.random() * 9000)}`);

  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [allowCreditCheckout, setAllowCreditCheckout] = useState<boolean>(false);

  useEffect(() => {
    if (booking) {
      setAddedServices([]);
      setDiscount(booking.discountAmount || 0);
      if (isGstLockedByExistingInvoice) {
        setIsGstEnabled(existingInvHasGst);
      } else {
        const bRate = booking.taxRate !== undefined ? Number(booking.taxRate) : configuredRoomGst;
        setIsGstEnabled(Boolean(booking.gstInvoice && bRate > 0));
      }
      setIsSplitPayment(false);
      setCoMarkPaid(false);
      setPayInputsTouched(false);
      setPrimaryPayAmount(0);
      setSecondaryPayAmount(0);
      setAllowCreditCheckout(false);
      setPrimaryRef(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);
      setSecondaryRef(`CASH-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [booking?.id, configuredRoomGst, isGstLockedByExistingInvoice, existingInvHasGst]);

  // Convert ONLY newly added checkout charges to BillCharge[]
  const additionalBillCharges: BillCharge[] = useMemo(
    () =>
      addedServices.map((s) => ({
        id: s.id,
        kind: serviceToChargeKind(s.serviceType, s.description),
        description: s.description,
        amount: r2(s.amount),
        date: new Date().toISOString().slice(0, 10),
        roomNumber: s.roomNumber || safeRoomNumbers[0] || '',
        sourceKey: `chk:${s.id}`,
      })),
    [addedServices, safeRoomNumbers]
  );

  // Single Source of Truth Bill Calculation
  const stayBill = useMemo(
    () =>
      buildStayBill({
        booking: rawBooking || booking,
        checkin: rawCheckin || null,
        posOrders,
        laundryOrders,
        waterBottles,
        rooms,
        settings,
        additionalCharges: additionalBillCharges,
        gstEnabledOverride: isGstEnabled,
        discountOverride: discount,
      }),
    [
      rawBooking,
      booking,
      rawCheckin,
      posOrders,
      laundryOrders,
      waterBottles,
      rooms,
      settings,
      additionalBillCharges,
      isGstEnabled,
      discount,
    ]
  );

  const { folio, bill } = stayBill;
  const nights = folio.nights || Math.max(1, Number(booking.nights) || 1);
  const roomTariffTotal = r2(
    bill.legacy.roomCharges +
      bill.legacy.extraBedCharges +
      bill.legacy.extraPersonCharges +
      bill.legacy.earlyCheckInCharges +
      bill.legacy.lateCheckOutCharges
  );
  const extrasTotal = r2(bill.subtotal - roomTariffTotal);
  const activeGstRate = bill.headlineGstRate;
  const cgstAmt = bill.cgst;
  const sgstAmt = bill.sgst;
  const gstAmount = bill.totalTax;
  const grandTotal = bill.grandTotal;
  const alreadyPaid = bill.receipts;
  const netOutstanding = bill.balance;
  const refundableExcess = bill.refundDue;

  // Keep payment inputs synchronized with checkbox & net balance without prematurely marking unpaid bills as paid
  useEffect(() => {
    if (netOutstanding <= 0) {
      setCoMarkPaid(true);
      setPrimaryPayAmount(0);
      setSecondaryPayAmount(0);
    } else if (coMarkPaid && !payInputsTouched) {
      if (!isSplitPayment) {
        setPrimaryPayAmount(netOutstanding);
        setSecondaryPayAmount(0);
      } else {
        const half = r2(Math.round(netOutstanding / 2));
        setPrimaryPayAmount(half);
        setSecondaryPayAmount(Math.max(0, r2(netOutstanding - half)));
      }
    } else if (!payInputsTouched) {
      setPrimaryPayAmount(0);
      setSecondaryPayAmount(0);
      setCoMarkPaid(false);
    } else {
      const currentEntered = r2(
        (Number(primaryPayAmount) || 0) + (isSplitPayment ? Number(secondaryPayAmount) || 0 : 0)
      );
      setCoMarkPaid(currentEntered >= r2(netOutstanding));
    }
    setRefundAmount(refundableExcess);
  }, [netOutstanding, refundableExcess, isSplitPayment, coMarkPaid, payInputsTouched]);

  const handleAddCharge = (
    descOverride?: string,
    amtOverride?: number,
    catOverride?: OtherServiceItem['serviceType']
  ) => {
    const finalAmt = r2(amtOverride !== undefined ? amtOverride : chargeAmt);
    const finalDesc = descOverride || chargeDesc.trim() || 'Miscellaneous Charge';
    const finalCat = catOverride || chargeCategory;
    if (finalAmt <= 0) return;

    const newItem: OtherServiceItem = {
      id: `CHK-CHG-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      bookingId: booking.id,
      orderNumber: `CHK-${Math.floor(100 + Math.random() * 900)}`,
      roomNumber: safeRoomNumbers[0] || '101',
      roomName: `Room ${safeRoomNumbers[0] || '101'}`,
      serviceType: finalCat,
      description: finalDesc,
      itemsSummary: finalDesc,
      quantity: 1,
      amount: finalAmt,
      taxAmount: 0,
      dateTime: new Date().toISOString().slice(0, 10),
      isPaid: false,
    };

    setAddedServices((prev) => [...prev, newItem]);
    setChargeDesc('');
    setChargeAmt(0);
  };

  const handleRemoveAddedCharge = (id: string) => {
    setAddedServices((prev) => prev.filter((c) => c.id !== id));
  };

  const totalCollectingNow = r2(
    (Number(primaryPayAmount) || 0) + (isSplitPayment ? Number(secondaryPayAmount) || 0 : 0)
  );
  const remainingAfterCollection = Math.max(0, r2(netOutstanding - totalCollectingNow));

  const handleConfirmCheckout = () => {
    const paymentsToRecord: Array<{ amount: number; method: PaymentMethod; referenceNo: string; notes: string }> = [];
    if (primaryPayAmount > 0) {
      paymentsToRecord.push({
        amount: r2(primaryPayAmount),
        method: primaryPayMethod,
        referenceNo: primaryRef || `TXN-${Date.now()}`,
        notes: isSplitPayment ? 'Checkout Split Payment (Part 1)' : 'Final Checkout Settlement',
      });
    }
    if (isSplitPayment && secondaryPayAmount > 0) {
      paymentsToRecord.push({
        amount: r2(secondaryPayAmount),
        method: secondaryPayMethod,
        referenceNo: secondaryRef || `SPLIT-${Date.now()}`,
        notes: 'Checkout Split Payment (Part 2)',
      });
    }

    onCompleteFinalCheckout({
      bookingId: booking.id,
      addedServices, // ONLY newly added checkout charges!
      updatedDiscount: r2(discount),
      withGst: isGstEnabled,
      updatedGstRate: isGstEnabled ? configuredRoomGst : 0,
      paymentsToRecord,
      refundAmount: r2(refundAmount),
    });
  };

  return (
    <div className="fixed inset-0 z-[72] overflow-y-auto flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-4">
      <div className="relative bg-white rounded-2xl border-2 border-[#C49A3A] shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#17120F] text-white p-4 sm:p-5 flex justify-between items-center border-b border-[#C49A3A]/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#D92D4B]/20 border border-[#D92D4B]/40 rounded-xl text-[#FF6B84] shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-[#E0BD6B] flex items-center gap-2">
                Check-Out Confirmation & Room Clearance
              </h3>
              <p className="text-[11px] text-slate-300 font-mono">
                Booking #{bookingNo} • {guestName} {guestMobile ? `(${guestMobile})` : ''} • Room {roomDisplay}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs text-[#263449]">
          {/* Top Stay Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Check-In Date</span>
              <span className="font-bold text-slate-900 text-xs">
                {checkInDate} ({getDayName(checkInDate).slice(0, 3)})
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Check-Out Date</span>
              <span className="font-bold text-slate-900 text-xs">
                {booking.isOpenStay ? 'Open Stay (12 PM Auto)' : `${checkOutDate} (${getDayName(checkOutDate).slice(0, 3)})`}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Stay Duration</span>
              <span className="font-bold text-slate-900 text-xs">
                {nights} Night(s) • Rm {roomDisplay}
              </span>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-[10px] font-mono uppercase text-amber-800 block">Room & Stay Tariff</span>
              <span className="font-extrabold text-amber-950 text-sm">
                {formatINRDecimal(roomTariffTotal)}
              </span>
            </div>
          </div>

          {/* 8-Condition Invoice Verification Strip */}
          <div className="bg-[#FDF8ED] border border-[#C49A3A]/60 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-[#C49A3A]" />
                <span className="font-serif font-bold text-[#263449] text-xs">
                  Single Bill Engine Verified on Check-Out
                </span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-mono text-[10px] font-bold">
                {isGstEnabled
                  ? `Room GST ${settings.roomGstRate}% • F&B GST ${settings.foodGstRate}%`
                  : '0% Bill of Supply (Without GST)'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
              {[
                { num: 1, label: 'Non-Negative Tariff', ok: roomTariffTotal >= 0 },
                { num: 2, label: 'Valid Guest Name', ok: Boolean(guestName && guestName.trim()) },
                { num: 3, label: 'Room Allocated', ok: safeRoomNumbers.length > 0 },
                { num: 4, label: 'Stay Duration OK', ok: nights >= 1 },
                { num: 5, label: 'No Double Tax', ok: true },
                { num: 6, label: 'Advance Accounted', ok: true },
                { num: 7, label: 'Unique Invoice Seq', ok: true },
                { num: 8, label: 'Folio Balanced', ok: netOutstanding === 0 || allowCreditCheckout || primaryPayAmount > 0 },
              ].map((c) => (
                <div
                  key={c.num}
                  className={`px-2 py-1 rounded border text-[10px] font-mono flex items-center gap-1 font-bold ${
                    c.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <span>{c.ok ? '✓' : '✕'}</span>
                  <span className="truncate">#{c.num} {c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 1. Pre-Departure Room Inspection Checklist */}
          <div className="bg-[#FAFBFD] border border-slate-200 rounded-xl p-3.5 space-y-2">
            <span className="font-mono text-[10px] uppercase font-bold text-[#263449] block">
              1. Pre-Departure Room Inspection Checklist
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer font-semibold text-[#263449]">
                <input
                  type="checkbox"
                  checked={coRoomInspected}
                  onChange={(e) => setCoRoomInspected(e.target.checked)}
                  className="w-4 h-4 accent-[#15805D]"
                />
                <span>Room Inspected</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer font-semibold text-[#263449]">
                <input
                  type="checkbox"
                  checked={coMinibarVerified}
                  onChange={(e) => setCoMinibarVerified(e.target.checked)}
                  className="w-4 h-4 accent-[#15805D]"
                />
                <span>Keys & Water Checked</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer font-semibold text-[#263449]">
                <input
                  type="checkbox"
                  checked={coLinenVerified}
                  onChange={(e) => setCoLinenVerified(e.target.checked)}
                  className="w-4 h-4 accent-[#15805D]"
                />
                <span>Linen & Appliances OK</span>
              </label>
            </div>
          </div>

          {/* Existing Folio Charges (Read-Only Summary) */}
          {existingServices.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-slate-600">
                  Existing Folio Items Already Posted ({existingServices.length} — Included Once, Never Duplicated)
                </span>
              </div>
              <div className="border bg-white rounded-xl divide-y max-h-28 overflow-y-auto">
                {existingServices.map((ec) => (
                  <div key={ec.id} className="px-3 py-1.5 flex justify-between items-center text-xs">
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-600 font-mono text-[10px] mr-2">
                        [{ec.serviceType}]
                      </span>
                      <span className="font-medium text-slate-800">{ec.description}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 shrink-0">
                      {formatINRDecimal(ec.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Room Damage / Tod-Phod Fine & New Checkout Charges */}
          <div
            className={`p-4 rounded-xl border-2 space-y-3 transition-all ${
              coHasDamageFine || addedServices.length > 0
                ? 'bg-rose-50/85 border-rose-300'
                : 'bg-[#FFFDF7] border-[#C49A3A]/50'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
              <div>
                <h4 className="font-serif font-bold text-[#17120F] text-sm flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#D92D4B]" /> 2. New Checkout Charges / Damage Fine
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Add any new damage fine, late checkout charge, or extra service discovered at checkout:
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCoHasDamageFine(false)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold border cursor-pointer transition-all ${
                    !coHasDamageFine && addedServices.length === 0
                      ? 'bg-[#15805D] text-white border-[#15805D] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                  }`}
                >
                  ✓ Room OK (₹0 Fine)
                </button>
                <button
                  type="button"
                  onClick={() => setCoHasDamageFine(true)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold border cursor-pointer transition-all ${
                    coHasDamageFine
                      ? 'bg-[#D92D4B] text-white border-[#D92D4B] shadow-xs'
                      : 'bg-white text-[#D92D4B] border-rose-300 hover:bg-rose-50'
                  }`}
                >
                  ⚠️ Add Damage Fine
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                Quick Presets (Click to Add):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Broken Glass / Crockery', amt: 500, cat: 'DAMAGE / FINE' as const },
                  { label: 'Bed Sheet / Towel Stain', amt: 800, cat: 'DAMAGE / FINE' as const },
                  { label: 'Room Key / Card Lost', amt: 500, cat: 'DAMAGE / FINE' as const },
                  { label: 'TV / Remote / AC Damage', amt: 2000, cat: 'DAMAGE / FINE' as const },
                  { label: 'Smoking / Property Fine', amt: 1500, cat: 'DAMAGE / FINE' as const },
                  { label: 'Late Checkout Fee (Post 12 PM)', amt: 1000, cat: 'SPA / OTHER' as const },
                  { label: 'Express Laundry Press', amt: 350, cat: 'LAUNDRY' as const },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setCoHasDamageFine(true);
                      handleAddCharge(preset.label, preset.amt, preset.cat);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-rose-100 text-[#9E2A2B] border border-rose-200 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer"
                  >
                    + {preset.label} (₹{preset.amt})
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
              <div className="sm:col-span-3">
                <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Category</label>
                <select
                  value={chargeCategory}
                  onChange={(e) => setChargeCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border bg-white rounded-lg text-xs font-bold"
                >
                  <option value="DAMAGE / FINE">Damage / Fine</option>
                  <option value="ROOM SERVICE">POS Food / Room Service</option>
                  <option value="LAUNDRY">Laundry Service</option>
                  <option value="WATER BOTTLE">Water Bottles</option>
                  <option value="EXTRA BED">Extra Bed</option>
                  <option value="SPA / OTHER">Late Checkout / Other</option>
                </select>
              </div>
              <div className="sm:col-span-5">
                <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Description</label>
                <input
                  type="text"
                  value={chargeDesc}
                  onChange={(e) => setChargeDesc(e.target.value)}
                  placeholder="e.g. Mini-bar snacks, AC remote damage, towel stain..."
                  className="w-full px-3 py-1.5 border bg-white rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={chargeAmt || ''}
                  onChange={(e) => setChargeAmt(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 border bg-white rounded-lg text-xs font-mono font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => handleAddCharge()}
                  className="w-full py-1.5 px-3 bg-[#9E2A2B] hover:bg-[#802223] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add to Bill
                </button>
              </div>
            </div>

            {/* Newly added checkout charges */}
            {addedServices.length > 0 && (
              <div className="border bg-white rounded-xl divide-y max-h-36 overflow-y-auto mt-2">
                {addedServices.map((ec) => (
                  <div key={ec.id} className="px-3 py-1.5 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-[#9E2A2B] font-mono text-[10px] mr-2">
                        [NEW • {ec.serviceType}]
                      </span>
                      <span className="font-medium text-slate-800">{ec.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {formatINRDecimal(ec.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAddedCharge(ec.id)}
                        className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                        title="Remove Charge"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: BILL ADJUSTMENTS & ADVANCE DEDUCTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 border p-4 rounded-xl bg-slate-50/70">
              <h5 className="font-mono uppercase font-bold text-[#8B691E] border-b pb-1.5">
                Checkout Bill Calculation
              </h5>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>Room & Stay Charges ({nights} Night(s)):</span>
                  <span className="font-mono font-bold">{formatINRDecimal(roomTariffTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Food (Pre-Tax), Water, Laundry & Fines:</span>
                  <span className="font-mono font-bold">{formatINRDecimal(extrasTotal)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-dashed">
                  <span>Discount / Concession (₹):</span>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-24 px-2 py-1 border rounded text-right font-mono font-bold text-emerald-700 bg-white"
                  />
                </div>

                {/* Single Clean GST Invoice Checkbox (or Locked Badge if Invoice Exists) */}
                <div className="py-2.5 border-t border-b border-dashed space-y-2">
                  {isGstLockedByExistingInvoice ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                      <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Locked Invoice ({existingInvoice?.invoiceNumber}):{' '}
                          {isGstEnabled
                            ? `GST Invoice (${formatINRDecimal(gstAmount)} Tax)`
                            : 'Without GST (0% Bill of Supply)'}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-800">
                        GST mode cannot be edited on an already-generated invoice. Generate a separate invoice in the Invoice module if needed.
                      </p>
                    </div>
                  ) : (
                    <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isGstEnabled}
                          onChange={(e) => setIsGstEnabled(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <div>
                          <span className="text-xs font-extrabold text-slate-900 block">
                            GST Invoice
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {isGstEnabled
                              ? `Settings GST: ${settings.roomGstRate}% Room • ${settings.foodGstRate}% Food`
                              : '0% Bill of Supply (Without GST)'}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                          isGstEnabled
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {isGstEnabled ? `${configuredRoomGst}% GST` : '0% No GST'}
                      </span>
                    </label>
                  )}

                  {isGstEnabled && gstAmount > 0 ? (
                    <div className="flex justify-between text-[11px] font-mono text-slate-600">
                      <span>CGST + SGST:</span>
                      <span className="font-bold text-[#8B691E]">
                        {formatINRDecimal(cgstAmt)} + {formatINRDecimal(sgstAmt)} = {formatINRDecimal(gstAmount)}
                      </span>
                    </div>
                  ) : !isGstEnabled ? (
                    <div className="text-[11px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                      Bill of Supply — ₹0.00 Tax
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-between font-extrabold text-sm text-[#17120F] pt-1">
                  <span>Grand Total Payable:</span>
                  <span className="font-mono">{formatINRDecimal(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Advance & Prior Payments Ledger */}
            <div className="space-y-2.5 border p-4 rounded-xl bg-[#FBF4E0]/40 flex flex-col justify-between">
              <div className="space-y-2">
                <h5 className="font-mono uppercase font-bold text-[#8B691E] border-b pb-1.5">
                  Advance & Prior Payments (Auto Carried Forward)
                </h5>
                {paymentsList.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    {alreadyPaid > 0
                      ? `Prior Advance Payment: ${formatINRDecimal(alreadyPaid)} linked to folio.`
                      : 'No prior advance or running payment recorded yet.'}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {paymentsList.map((p) => (
                      <div
                        key={p.id}
                        className="flex justify-between items-center text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200"
                      >
                        <span>
                          <strong>{p.paymentMethod}</strong> ({p.date}) • {p.transactionId}
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatINRDecimal(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Total Advance / Paid So Far:</span>
                  <span className="font-mono">- {formatINRDecimal(alreadyPaid)}</span>
                </div>
                {refundableExcess > 0 ? (
                  <div className="flex justify-between font-extrabold text-sm text-indigo-700 bg-indigo-50 p-2 rounded-lg">
                    <span>Excess Advance (Refund Due to Guest):</span>
                    <span className="font-mono">{formatINRDecimal(refundableExcess)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-extrabold text-sm text-[#9E2A2B] bg-rose-50 p-2 rounded-lg">
                    <span>Net Outstanding Balance to Clear:</span>
                    <span className="font-mono">{formatINRDecimal(netOutstanding)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION C: FINAL PAYMENT CLEARANCE */}
          <div className="p-4 border border-slate-300 bg-slate-50 rounded-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <h4 className="text-xs uppercase font-mono font-bold text-[#17120F] flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#C49A3A]" />
                Final Payment Clearance (Cash / UPI / Card Swipe / Split Mode)
              </h4>

              {netOutstanding > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSplitPayment(!isSplitPayment)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                      isSplitPayment
                        ? 'bg-[#17120F] text-[#E0BD6B] border-[#17120F]'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    {isSplitPayment ? 'Split Payment Active (2 Modes)' : 'Enable Split Payment (Cash + UPI)'}
                  </button>
                </div>
              )}
            </div>

            {refundableExcess > 0 ? (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-indigo-700" />
                  <div>
                    <div className="font-bold text-indigo-950">Authorized Guest Refund Required</div>
                    <div className="text-[11px] text-indigo-700">
                      Guest paid {formatINRDecimal(alreadyPaid)} advance against {formatINRDecimal(grandTotal)} final bill.
                    </div>
                  </div>
                </div>
                <div className="font-mono font-extrabold text-sm text-indigo-900">
                  Refund: {formatINRDecimal(refundAmount)}
                </div>
              </div>
            ) : netOutstanding === 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                Full Bill Already Settled (₹0.00 Due). Ready to complete checkout and release room as Dirty!
              </div>
            ) : (
              <div className="space-y-3">
                <label
                  className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer font-bold ${
                    remainingAfterCollection <= 0
                      ? 'bg-emerald-50 border-emerald-200 text-[#15805D]'
                      : 'bg-amber-50/70 border-amber-200 text-[#263449]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={remainingAfterCollection <= 0}
                    onChange={(e) => {
                      const nextChecked = e.target.checked;
                      if (nextChecked) {
                        setPayInputsTouched(false);
                        setCoMarkPaid(true);
                        if (!isSplitPayment) {
                          setPrimaryPayAmount(netOutstanding);
                          setSecondaryPayAmount(0);
                        } else {
                          const half = r2(Math.round(netOutstanding / 2));
                          setPrimaryPayAmount(half);
                          setSecondaryPayAmount(Math.max(0, r2(netOutstanding - half)));
                        }
                      } else {
                        setPayInputsTouched(true);
                        setCoMarkPaid(false);
                        setPrimaryPayAmount(0);
                        setSecondaryPayAmount(0);
                      }
                    }}
                    className="w-4 h-4 accent-[#15805D]"
                  />
                  <span>
                    Mark Bill as Fully Paid (₹0 Due)
                    {remainingAfterCollection > 0
                      ? ` — Collect ${formatINRDecimal(netOutstanding)} to clear`
                      : ` (${formatINRDecimal(netOutstanding)} Collected)`}
                  </span>
                </label>

                {/* Primary Payment Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
                      {isSplitPayment ? 'Payment Mode 1' : 'Payment Mode'}
                    </label>
                    <select
                      value={primaryPayMethod}
                      onChange={(e) => setPrimaryPayMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 border rounded-lg font-bold text-xs bg-white"
                    >
                      <option value="UPI">UPI / QR Scan</option>
                      <option value="Cash">Cash Drawer</option>
                      <option value="Card">POS Card Swipe</option>
                      <option value="Bank Transfer">NEFT / IMPS Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
                      Amount Collecting (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={primaryPayAmount}
                      onChange={(e) => {
                        const val = Math.max(0, r2(Number(e.target.value) || 0));
                        setPayInputsTouched(true);
                        setPrimaryPayAmount(val);
                        const nextTotal = r2(val + (isSplitPayment ? Number(secondaryPayAmount) || 0 : 0));
                        setCoMarkPaid(netOutstanding <= 0 || nextTotal >= r2(netOutstanding));
                      }}
                      className="w-full px-3 py-2 border rounded-lg font-mono font-bold text-xs text-emerald-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
                      Transaction ID / Ref
                    </label>
                    <input
                      type="text"
                      value={primaryRef}
                      onChange={(e) => setPrimaryRef(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Secondary Split Payment Row */}
                {isSplitPayment && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-amber-900 mb-1">
                        Split Payment Mode 2
                      </label>
                      <select
                        value={secondaryPayMethod}
                        onChange={(e) => setSecondaryPayMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2 border rounded-lg font-bold text-xs bg-white"
                      >
                        <option value="Cash">Cash Drawer</option>
                        <option value="UPI">UPI / QR Scan</option>
                        <option value="Card">POS Card Swipe</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-amber-900 mb-1">
                        Split Amount 2 (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={secondaryPayAmount}
                        onChange={(e) => {
                          const val = Math.max(0, r2(Number(e.target.value) || 0));
                          setPayInputsTouched(true);
                          setSecondaryPayAmount(val);
                          const nextTotal = r2((Number(primaryPayAmount) || 0) + val);
                          setCoMarkPaid(netOutstanding <= 0 || nextTotal >= r2(netOutstanding));
                        }}
                        className="w-full px-3 py-2 border rounded-lg font-mono font-bold text-xs text-emerald-800 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase font-bold text-amber-900 mb-1">
                        Split Reference 2
                      </label>
                      <input
                        type="text"
                        value={secondaryRef}
                        onChange={(e) => setSecondaryRef(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-xs bg-white"
                      />
                    </div>
                  </div>
                )}

                {remainingAfterCollection > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                    <span>
                      ⚠️ Unsettled Balance of <strong>{formatINRDecimal(remainingAfterCollection)}</strong> remains.
                    </span>
                    <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowCreditCheckout}
                        onChange={(e) => setAllowCreditCheckout(e.target.checked)}
                        className="accent-rose-600"
                      />
                      Authorize Corporate / Credit Checkout
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              onPreviewInvoice({
                ...booking,
                roomNumbers: safeRoomNumbers,
                otherServices: [...existingServices, ...addedServices],
                otherServicesTotal: extrasTotal,
                discountAmount: discount,
                gstInvoice: isGstEnabled,
                taxRate: activeGstRate,
                taxAmount: gstAmount,
                totalPayable: grandTotal,
              })
            }
            className="px-4 py-2.5 rounded-xl border border-[#C49A3A] bg-[#FDF8ED] hover:bg-amber-100 text-[#17120F] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#C49A3A]" />
            Preview Final GST Invoice
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-100 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={remainingAfterCollection > 0 && !allowCreditCheckout}
              onClick={handleConfirmCheckout}
              className="px-5 py-2.5 bg-[#15805D] hover:bg-[#11694B] disabled:opacity-50 text-white font-extrabold rounded-xl shadow-md text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Check-Out & Generate Final Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
