import React, { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  Download,
  Search,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2,
  FilePlus2,
  Lock,
  Calendar,
  Eye,
  UtensilsCrossed,
  Pencil,
} from 'lucide-react';
import { BookingRecord, InvoiceRecord, InvoiceScope } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import {
  BillCharge,
  BillSettings,
  BillChargeKind,
  BillPayment,
  calculateBill,
  normalizeBillSettings,
  r2,
} from '../../utils/billCalculator';
import {
  buildStayBill,
  buildInvoiceRecord,
  isActiveInvoice,
  reconcileScopedStayInvoice,
  resolveInvoiceScope,
} from '../../utils/stayBilling';
import {
  invoiceRecordToPrintHtml,
  extractDetailedFoodLinesForStay,
  isGenericFoodSummaryLine,
} from '../../utils/pdfDownload';
import { openPrintWindow } from '../../utils/printDocument';

interface InvoiceModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  invoices: InvoiceRecord[];
  appInvoices?: Record<string, any>[];
  bookings: BookingRecord[];
  billSettings?: BillSettings;
  hotelSettings?: Record<string, any>;
  appBookings?: Record<string, any>[];
  appCheckins?: Record<string, any>[];
  posOrders?: Record<string, any>[];
  laundryOrders?: Record<string, any>[];
  waterBottles?: Record<string, any>[];
  rooms?: Record<string, any>[];
  onOpenInvoiceModal: (
    booking: BookingRecord,
    scope: InvoiceScope,
    invoiceRecord?: InvoiceRecord
  ) => void;
  onOpenRecordPayment: (booking: BookingRecord) => void;
  onCreateSeparateInvoice?: (
    booking: BookingRecord,
    scope: InvoiceScope,
    withGst: boolean,
    gstRate: number,
    confirmedRefundAmount?: number
  ) => void;
  /** Opens the Edit Invoice popup (Room Bill / Food Bill / Combined Bill, split or not). */
  onEditInvoice?: (invoice: InvoiceRecord) => void;
}

const ROOM_ONLY_KINDS: BillChargeKind[] = [
  'room',
  'extra_bed',
  'extra_person',
  'early_checkin',
  'late_checkout',
];

function capPayments(payments: BillPayment[], cap: number): BillPayment[] {
  let rem = Math.max(0, r2(cap));
  const out: BillPayment[] = [];
  for (const p of payments) {
    const amt = r2(p.amount);
    if (amt < 0) {
      out.push(p);
      continue;
    }
    if (rem <= 0) break;
    const take = Math.min(amt, rem);
    if (take > 0) {
      out.push({ ...p, amount: r2(take) });
      rem = r2(rem - take);
    }
  }
  return out;
}

function normalizeIsoDate(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function syntheticBookingFromInvoice(inv: InvoiceRecord): BookingRecord {
  const ci = normalizeIsoDate(inv.checkInDateTime) || new Date().toISOString().slice(0, 10);
  const co = normalizeIsoDate(inv.checkOutDateTime) || ci;
  const hasGst = !(
    inv.isWithoutGst === true ||
    (inv.gstRate !== undefined && Number(inv.gstRate) <= 0) ||
    (inv.gstRate === undefined && Number(inv.totalTax || 0) <= 0)
  );
  return {
    id: inv.bookingId || inv.id,
    bookingNo: inv.bookingNo || inv.bookingId || inv.invoiceNumber,
    billId: inv.invoiceNumber,
    bookingType: inv.companyName ? 'Corporate' : 'Personal',
    companyName: inv.companyName,
    companyGst: inv.gstNumber,
    gstInvoice: hasGst,
    customerName: inv.customerName || 'Guest',
    mobile: inv.mobile || '',
    email: '',
    address: '',
    numGuests: 1,
    adults: 1,
    children: 0,
    checkInDate: ci,
    checkOutDate: co,
    nights: Math.max(1, Number(inv.nights) || 1),
    status: 'Checked Out',
    paymentStatus: inv.paymentStatus === 'Paid' ? 'Fully Paid' : inv.amountPaid > 0 ? 'Partially Paid' : 'Unpaid',
    isCheckedIn: false,
    isCheckedOut: true,
    source: 'WALK-IN',
    bookedOn: normalizeIsoDate(inv.bookedOnDateTime) || ci,
    requirements: [],
    roomNumbers: Array.isArray(inv.roomNumbers) && inv.roomNumbers.length > 0 ? inv.roomNumbers : [''],
    roomCategorySummary: `Room ${(inv.roomNumbers || []).join(', ')}`,
    roomSubtotal: Number(inv.roomCharges) || 0,
    otherServicesTotal: Number(inv.otherServicesCharges) || 0,
    discountType: 'flat',
    discountValue: Number(inv.discount) || 0,
    discountAmount: Number(inv.discount) || 0,
    taxRate: hasGst ? Number(inv.gstRate) || 5 : 0,
    taxAmount: Number(inv.totalTax) || 0,
    totalPayable: Number(inv.grandTotal) || 0,
    amountPaid: Number(inv.amountPaid) || 0,
    dueAmount: Number(inv.balanceDue) || 0,
    guests: [],
    payments: [],
    otherServices: [],
  };
}

export const InvoiceModule: React.FC<InvoiceModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  invoices,
  appInvoices = [],
  bookings,
  billSettings,
  hotelSettings,
  appBookings = [],
  appCheckins = [],
  posOrders = [],
  laundryOrders = [],
  waterBottles = [],
  rooms = [],
  onOpenInvoiceModal,
  onOpenRecordPayment,
  onCreateSeparateInvoice,
  onEditInvoice,
}) => {
  const [taxSettings] = useHotelTaxSettings();
  const settings = billSettings || normalizeBillSettings(taxSettings);
  const configuredRoomGst = settings.roomGstRate;

  // Normalize sub-tab ('settings' was removed -> belong ONLY in Profile Settings)
  const effectiveSubTab = activeSubTab === 'settings' ? 'all' : activeSubTab || 'all';

  const todayStr = new Date().toISOString().slice(0, 10);
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const applyDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month') => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      setFromDate(y);
      setToDate(y);
    } else if (preset === 'this_week') {
      const w = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      setFromDate(w);
      setToDate(todayStr);
    } else if (preset === 'this_month') {
      setFromDate(`${todayStr.slice(0, 7)}-01`);
      setToDate(todayStr);
    }
  };

  const matchesDateRange = (inv: InvoiceRecord): boolean => {
    if (datePreset === 'all' && !fromDate && !toDate) return true;
    const candidateDates = [
      normalizeIsoDate(inv.createdAt),
      normalizeIsoDate(inv.checkOutDateTime),
      normalizeIsoDate(inv.checkInDateTime),
    ].filter(Boolean);
    if (candidateDates.length === 0) return true;
    return candidateDates.some((d) => {
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  };

  const [search, setSearch] = useState('');
  const [gstFilter, setGstFilter] = useState<'all' | 'gst' | 'non_gst'>('all');
  const [selectedBookingId, setSelectedBookingId] = useState(bookings[0]?.id || '');
  const [selectedScope, setSelectedScope] = useState<InvoiceScope>(
    'Booking + Other Services'
  );
  const [createWithGst, setCreateWithGst] = useState<boolean>(true);
  const [confirmExcessRefund, setConfirmExcessRefund] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedBookingId && bookings[0]) {
      setSelectedBookingId(bookings[0].id);
    }
  }, [bookings, selectedBookingId]);

  useEffect(() => {
    if (effectiveSubTab === 'booking_only') {
      setSelectedScope('Only Booking');
    } else if (effectiveSubTab === 'combined') {
      setSelectedScope('Booking + Other Services');
    }
  }, [effectiveSubTab]);

  // Strict booking lookup by bookingId / bookingNo ONLY (no fuzzy room+name match, no bookings[0] fallback!)
  const findStrictBooking = (bookingId?: string, bookingNo?: string): BookingRecord | undefined => {
    const idNorm = String(bookingId || '').replace(/^#/, '');
    const noNorm = String(bookingNo || '').replace(/^#/, '');
    return bookings.find((b) => {
      const bId = String(b.id || '').replace(/^#/, '');
      const bNo = String(b.bookingNo || '').replace(/^#/, '');
      return (
        (bookingId && (b.id === bookingId || bId === idNorm || bNo === idNorm)) ||
        (bookingNo && (b.bookingNo === bookingNo || bNo === noNorm || bId === noNorm))
      );
    });
  };

  // Build unified list combining finalized Invoices (preserving saved amounts 100%) AND live Booking Folios
  const allFolioInvoices: InvoiceRecord[] = useMemo(() => {
    const invoiceBookingIds = new Set<string>();
    const preservedExisting: InvoiceRecord[] = invoices.map((inv) => {
      const linked = findStrictBooking(inv.bookingId, inv.bookingNo);
      if (linked && isActiveInvoice(inv)) {
        invoiceBookingIds.add(linked.id);
      }
      // NEVER recompute already-issued invoices! Preserve saved grandTotal, balanceDue, cgst, sgst, totalTax.
      return {
        ...inv,
        bookingId: linked ? linked.id : inv.bookingId,
        bookingNo: linked ? linked.bookingNo : inv.bookingNo,
      };
    });

    const liveBookingFolios: InvoiceRecord[] = bookings
      .filter((b) => b.status !== 'Cancelled' && b.status !== 'No-Show' && !invoiceBookingIds.has(b.id))
      .map((b) => {
        const rawBkg = appBookings.find((ab) => ab.id === b.id);
        const linkedChk = appCheckins.find(
          (c) => c.id === b.id || c.bookingId === b.id || c.id === b.bookingNo
        );
        const { folio, bill } = buildStayBill({
          booking: rawBkg || b,
          checkin: linkedChk || null,
          posOrders,
          laundryOrders,
          waterBottles,
          rooms,
          settings,
        });
        const roomTotal = r2(
          bill.legacy.roomCharges +
            bill.legacy.extraBedCharges +
            bill.legacy.extraPersonCharges +
            bill.legacy.earlyCheckInCharges +
            bill.legacy.lateCheckOutCharges
        );
        const servicesTotal = r2(bill.subtotal - roomTotal);
        return {
          id: `FOLIO-${b.id}`,
          invoiceNumber: `FOLIO/${String(b.bookingNo || b.id).replace(/^#/, '')}`,
          bookingId: b.id,
          bookingNo: b.bookingNo,
          gstRate: bill.headlineGstRate,
          isWithoutGst: !bill.isGstInvoice,
          invoiceScope: servicesTotal > 0 ? 'Booking + Other Services' : 'Only Booking',
          customerName: b.customerName,
          mobile: b.mobile || '',
          companyName: b.companyName,
          gstNumber: b.companyGst,
          roomNumbers: folio.roomNumbers.length > 0 ? folio.roomNumbers : b.roomNumbers,
          checkInDateTime: `${b.checkInDate} ${b.checkInTime || ''}`.trim(),
          checkOutDateTime: `${b.checkOutDate} ${b.checkOutTime || ''}`.trim(),
          bookedOnDateTime: b.bookedOn || b.checkInDate,
          nights: folio.nights,
          roomCharges: roomTotal,
          otherServicesCharges: servicesTotal,
          discount: bill.discount,
          cgst: bill.cgst,
          sgst: bill.sgst,
          totalTax: bill.totalTax,
          grandTotal: bill.grandTotal,
          amountPaid: bill.receipts,
          balanceDue: bill.balance,
          paymentStatus: bill.paymentStatus,
          paymentMethod: (b.payments?.[0]?.paymentMethod as any) || 'Cash',
          createdAt: b.checkOutDate || b.checkInDate,
        };
      });

    return [...preservedExisting, ...liveBookingFolios];
  }, [invoices, bookings, appBookings, appCheckins, posOrders, laundryOrders, waterBottles, rooms, settings]);

  const getInvoiceHasServices = (inv: InvoiceRecord): boolean => {
    if (!inv.id.startsWith('FOLIO-')) {
      return Number(inv.otherServicesCharges || 0) > 0 || inv.invoiceScope === 'Booking + Other Services';
    }
    return Number(inv.otherServicesCharges || 0) > 0;
  };

  const filteredInvoices = useMemo(() => {
    return allFolioInvoices.filter((inv) => {
      if (!matchesDateRange(inv)) return false;

      const hasGst = !(
        inv.isWithoutGst === true ||
        (inv.gstRate !== undefined && Number(inv.gstRate) <= 0) ||
        (inv.gstRate === undefined && Number(inv.totalTax || 0) <= 0)
      );

      if (gstFilter === 'gst' && !hasGst) return false;
      if (gstFilter === 'non_gst' && hasGst) return false;

      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        String(inv.bookingNo || '').toLowerCase().includes(q) ||
        (inv.roomNumbers || []).some((r) => String(r).toLowerCase().includes(q));
      if (!matchesSearch) return false;

      if (effectiveSubTab === 'booking_only') {
        return isActiveInvoice(inv) && !getInvoiceHasServices(inv);
      }
      if (effectiveSubTab === 'combined') {
        return isActiveInvoice(inv) && getInvoiceHasServices(inv);
      }
      if (effectiveSubTab === 'unpaid') {
        return isActiveInvoice(inv) && (inv.balanceDue > 0 || inv.paymentStatus !== 'Paid');
      }
      if (effectiveSubTab === 'corporate') {
        return isActiveInvoice(inv) && Boolean(inv.companyName || inv.gstNumber);
      }
      return true;
    });
  }, [allFolioInvoices, search, effectiveSubTab, datePreset, fromDate, toDate, gstFilter]);

  const gstCounts = useMemo(() => {
    let withGst = 0;
    let withoutGst = 0;
    allFolioInvoices.forEach((inv) => {
      if (!matchesDateRange(inv)) return;
      const hasGst = !(
        inv.isWithoutGst === true ||
        (inv.gstRate !== undefined && Number(inv.gstRate) <= 0) ||
        (inv.gstRate === undefined && Number(inv.totalTax || 0) <= 0)
      );
      if (hasGst) withGst++;
      else withoutGst++;
    });
    return { all: withGst + withoutGst, withGst, withoutGst };
  }, [allFolioInvoices, datePreset, fromDate, toDate]);

  const targetBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || bookings[0] || null,
    [bookings, selectedBookingId]
  );

  // Accurate Option A reconciled preview for "+ Generate New Invoice"
  const createPreview = useMemo(() => {
    if (!targetBooking) return null;
    const rawBkg = appBookings.find((ab) => ab.id === targetBooking.id);
    const linkedChk = appCheckins.find(
      (c) =>
        c.id === targetBooking.id ||
        c.bookingId === targetBooking.id ||
        c.id === targetBooking.bookingNo
    );
    const stay = buildStayBill({
      booking: rawBkg || targetBooking,
      checkin: linkedChk || null,
      posOrders,
      laundryOrders,
      waterBottles,
      rooms,
      settings,
      gstEnabledOverride: createWithGst,
    });

    const existingForStay = invoices.filter(
      (inv) =>
        !inv.id.startsWith('FOLIO-') &&
        (inv.bookingId === targetBooking.id || inv.bookingNo === targetBooking.bookingNo)
    );

    const checkRec = reconcileScopedStayInvoice({
      folio: stay.folio,
      scope: selectedScope,
      withGst: createWithGst,
      settings,
      existingInvoicesForStay: existingForStay,
      confirmedRefundAmount: 0,
    });

    const reconciled =
      confirmExcessRefund && checkRec.potentialExcessOverTarget > 0
        ? reconcileScopedStayInvoice({
            folio: stay.folio,
            scope: selectedScope,
            withGst: createWithGst,
            settings,
            existingInvoicesForStay: existingForStay,
            confirmedRefundAmount: checkRec.potentialExcessOverTarget,
          })
        : checkRec;

    const detailedFoodItems = extractDetailedFoodLinesForStay({
      checkinRecord: (linkedChk || null) as any,
      bookingRecord: (rawBkg || targetBooking) as any,
      posOrders,
    });

    return {
      stay,
      bill: reconciled.bill,
      roomTotal: reconciled.roomChargesTotal,
      servicesTotal: reconciled.otherServicesTotal,
      supersededIds: reconciled.supersededInvoiceIds,
      potentialExcess: checkRec.potentialExcessOverTarget,
      hasCharges: reconciled.scopedCharges.length > 0,
      detailedFoodItems,
    };
  }, [
    targetBooking,
    appBookings,
    appCheckins,
    posOrders,
    laundryOrders,
    waterBottles,
    rooms,
    settings,
    createWithGst,
    selectedScope,
    invoices,
    confirmExcessRefund,
  ]);

  return (
    <div className="space-y-5">
      {/* Header & Prominent Date-Wise Filter Bar */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              GST Invoice & Folio Billing Center
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Room GST: <strong>{settings.roomGstRate}%</strong> • F&B GST:{' '}
              <strong>{settings.foodGstRate}%</strong> • Prefix:{' '}
              <strong>{settings.invoicePrefix}</strong> (Configured in Profile Settings)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {effectiveSubTab === 'create' || effectiveSubTab === 'corporate' ? (
              <button
                type="button"
                onClick={() => onSubTabChange('all')}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                ← Back to All Invoices
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onSubTabChange('corporate')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                effectiveSubTab === 'corporate'
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>B2B Corporate GST</span>
            </button>

            <button
              type="button"
              onClick={() => onSubTabChange('create')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                effectiveSubTab === 'create'
                  ? 'bg-amber-600 text-slate-950 shadow-sm'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>+ Generate New Invoice</span>
            </button>
          </div>
        </div>

        {/* PROMINENT DATE-WISE FILTER BAR */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5" />
              Date Filter:
            </span>
            {(
              [
                { id: 'all', label: `All Dates (${allFolioInvoices.length})` },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-slate-900 text-amber-400 shadow-xs'
                    : 'bg-white hover:bg-amber-100/80 text-slate-700 border border-amber-200/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-bold text-slate-600">From → To:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setDatePreset('custom');
                setFromDate(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-bold text-slate-800 text-xs"
            />
            <span className="text-slate-400 font-bold">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setDatePreset('custom');
                setToDate(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-bold text-slate-800 text-xs"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-[11px] cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB: SIMPLIFIED + GENERATE NEW INVOICE (`create`)                 */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'create' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FilePlus2 className="w-5 h-5 text-amber-500" />
              Generate New / Separate Invoice
            </h3>
            <p className="text-xs text-slate-500">
              Select a guest booking, choose Full Bill or Room Only, and tick GST Invoice to apply Settings GST ({configuredRoomGst}%).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Select Guest Booking / Folio
                </label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedBookingId(nextId);
                    const b = bookings.find((bk) => bk.id === nextId);
                    if (b) {
                      const existingInvs = invoices.filter(
                        (inv) =>
                          !inv.id.startsWith('FOLIO-') &&
                          (inv.bookingId === b.id || inv.bookingNo === b.bookingNo)
                      );
                      if (existingInvs.length > 0) {
                        const firstNoGst =
                          existingInvs[0].isWithoutGst === true ||
                          (existingInvs[0].gstRate !== undefined && Number(existingInvs[0].gstRate) <= 0) ||
                          (existingInvs[0].gstRate === undefined && Number(existingInvs[0].totalTax || 0) <= 0);
                        setCreateWithGst(firstNoGst);
                      } else {
                        setCreateWithGst(Boolean(b.gstInvoice && Number(b.taxRate ?? configuredRoomGst) > 0));
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{String(b.bookingNo).replace(/^#/, '')} — {b.customerName} (Rm {b.roomNumbers.join(', ')}) •{' '}
                      {formatCurrency(b.totalPayable)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  2. Scope (Full Bill / Room Only / Food &amp; Services Bill)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'Booking + Other Services', label: 'Full Bill' },
                      { value: 'Only Booking', label: 'Room Only' },
                      { value: 'Only Other Services', label: 'Food / Services Bill' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedScope(opt.value);
                        setConfirmExcessRefund(false);
                      }}
                      className={`py-2.5 px-3 rounded-xl font-bold border text-center cursor-pointer transition ${
                        selectedScope === opt.value
                          ? 'bg-slate-900 text-amber-400 border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single Clean Checkbox: GST Invoice */}
              <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={createWithGst}
                    onChange={(e) => setCreateWithGst(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 block">
                      GST Invoice
                    </span>
                    <span className="text-[11px] text-slate-600">
                      {createWithGst
                        ? `Applies ${settings.roomGstRate}% Room GST & ${settings.foodGstRate}% Food GST from Settings`
                        : '0% Without GST (Bill of Supply)'}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                    createWithGst
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {createWithGst ? `${configuredRoomGst}% GST` : '0% No GST'}
                </span>
              </label>
            </div>

            {targetBooking && createPreview && (() => {
              const existingActiveForTarget = invoices.filter(
                (inv) =>
                  !inv.id.startsWith('FOLIO-') &&
                  isActiveInvoice(inv) &&
                  (inv.bookingId === targetBooking.id || inv.bookingNo === targetBooking.bookingNo)
              );
              const { bill, roomTotal, servicesTotal, supersededIds, potentialExcess, hasCharges } =
                createPreview;
              const supersededInvs = existingActiveForTarget.filter((i) =>
                supersededIds.includes(i.id)
              );
              const retainedInvs = existingActiveForTarget.filter(
                (i) => !supersededIds.includes(i.id)
              );

              return (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="font-extrabold text-slate-900 text-sm">
                    Live Invoice Preview — #{String(targetBooking.bookingNo).replace(/^#/, '')} ({targetBooking.customerName})
                  </div>

                  {supersededInvs.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] font-semibold">
                      🔄 Overlapping invoice(s) ({supersededInvs.map((i) => i.invoiceNumber).join(', ')}) will be marked{' '}
                      <strong>Superseded</strong> (audit history preserved, excluded from active revenue) and a{' '}
                      <strong>new sequential Invoice Number</strong> will be issued.
                    </div>
                  )}

                  {retainedInvs.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-semibold">
                      ✅ Non-overlapping split invoice(s) ({retainedInvs.map((i) => i.invoiceNumber).join(', ')}) remain active with zero duplicate charges or receipts.
                    </div>
                  )}

                  {selectedScope !== 'Only Other Services' && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room & Stay Charges ({createPreview.stay.folio.nights}N):</span>
                      <strong className="font-mono">{formatCurrency(roomTotal)}</strong>
                    </div>
                  )}
                  {selectedScope !== 'Only Booking' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Food (Pre-Tax) / Water / Laundry / Add-Ons:</span>
                        <strong className="font-mono">{formatCurrency(servicesTotal)}</strong>
                      </div>
                      {createPreview.detailedFoodItems.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1">
                          <div className="text-[10px] font-extrabold uppercase text-amber-900 flex items-center justify-between">
                            <span>Item-Wise Food Details Included ({createPreview.detailedFoodItems.length} item{createPreview.detailedFoodItems.length > 1 ? 's' : ''})</span>
                            <span>SAC 996331</span>
                          </div>
                          <div className="max-h-28 overflow-y-auto space-y-0.5 text-[11px] font-mono">
                            {createPreview.detailedFoodItems.map((it, idx) => (
                              <div key={idx} className="flex justify-between gap-2 text-slate-700">
                                <span className="truncate" title={it.description}>
                                  {it.itemName} <span className="text-slate-400">({it.qty}×₹{it.rate.toFixed(2)}) [#{it.orderNo}]</span>
                                </span>
                                <strong className="shrink-0 text-slate-900">{formatCurrency(it.amount)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {bill.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Less Discount:</span>
                      <strong className="font-mono">-{formatCurrency(bill.discount)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {bill.isGstInvoice
                        ? `GST (CGST ${formatCurrency(bill.cgst)} + SGST ${formatCurrency(bill.sgst)}):`
                        : 'Tax Mode (0% Bill of Supply):'}
                    </span>
                    <strong className="font-mono">{formatCurrency(bill.totalTax)}</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="font-extrabold text-slate-900">Invoice Grand Total:</span>
                    <strong className="font-extrabold text-emerald-700 font-mono">
                      {formatCurrency(bill.grandTotal)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Receipts Applied: {formatCurrency(bill.receipts)}</span>
                    {bill.refundDue > 0 ? (
                      <span className="font-bold text-indigo-700">Refund Due: {formatCurrency(bill.refundDue)}</span>
                    ) : (
                      <span className="font-bold text-rose-600">Balance: {formatCurrency(bill.balance)}</span>
                    )}
                  </div>

                  {potentialExcess > 0 && (
                    <label className="flex items-start gap-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-[11px] font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmExcessRefund}
                        onChange={(e) => setConfirmExcessRefund(e.target.checked)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <span>
                        Confirm actual guest refund of <strong>{formatCurrency(potentialExcess)}</strong> (leave unchecked to cap receipts at {formatCurrency(bill.grandTotal - (confirmExcessRefund ? 0 : 0))} with ₹0 Refund Due)
                      </span>
                    </label>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!hasCharges}
                      onClick={() => {
                        const effRate = createWithGst ? configuredRoomGst : 0;
                        const confirmedRef = confirmExcessRefund ? potentialExcess : 0;
                        if (onCreateSeparateInvoice) {
                          onCreateSeparateInvoice(
                            targetBooking,
                            selectedScope,
                            createWithGst,
                            effRate,
                            confirmedRef
                          );
                          setConfirmExcessRefund(false);
                        } else {
                          onOpenInvoiceModal(targetBooking, selectedScope);
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <FilePlus2 className="w-4 h-4" />
                      {supersededInvs.length > 0
                        ? `Supersede & Re-Issue (${createWithGst ? `${configuredRoomGst}% GST` : 'No GST'})`
                        : existingActiveForTarget.length > 0
                        ? `Generate Split Invoice (${createWithGst ? `${configuredRoomGst}% GST` : 'No GST'})`
                        : `Generate Official Invoice (${createWithGst ? `${configuredRoomGst}% GST` : 'No GST'})`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TABS: ALL, ONLY BOOKING, BOOKING + POS / EXTRA, UNPAID, CORPORATE */}
      {/* ===================================================================== */}
      {['all', 'booking_only', 'combined', 'unpaid', 'corporate'].includes(effectiveSubTab) && (
        <>
          {/* Quick Preview Bar */}
          {bookings.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 text-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                  {effectiveSubTab === 'booking_only'
                    ? 'Only Booking Bills (Pure Room Booking Folios)'
                    : effectiveSubTab === 'combined'
                    ? 'Booking + POS / Food / Extra Services Invoices'
                    : effectiveSubTab === 'unpaid'
                    ? 'Unpaid & Pending Folio Balances'
                    : 'All GST Invoices & Active Guest Folios'}
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Quick Folio Preview & Print PDF
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-bold text-slate-900 shadow-xs"
                >
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{String(b.bookingNo).replace(/^#/, '')} — {b.customerName} (Rm {b.roomNumbers.join(', ')})
                    </option>
                  ))}
                </select>

                <div className="flex items-center bg-white p-1 rounded-xl border border-amber-300 shadow-xs">
                  {(['Only Booking', 'Booking + Other Services'] as const).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setSelectedScope(scope)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        selectedScope === scope ? 'bg-amber-500 text-slate-950' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {scope === 'Only Booking' ? 'Room Only' : 'Full Bill'}
                    </button>
                  ))}
                </div>

                {targetBooking && (
                  <button
                    type="button"
                    onClick={() => onOpenInvoiceModal(targetBooking, selectedScope)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    Preview & Print PDF
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64 sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search Invoice #, Guest, Room #, Booking #..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                {/* GST Bills vs Without GST Bills Filter Bar */}
                <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold gap-1">
                  <button
                    type="button"
                    onClick={() => setGstFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      gstFilter === 'all'
                        ? 'bg-slate-900 text-amber-400 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Bills ({gstCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstFilter('gst')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      gstFilter === 'gst'
                        ? 'bg-emerald-700 text-white shadow-2xs font-extrabold'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                    GST Bills ({gstCounts.withGst})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstFilter('non_gst')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      gstFilter === 'non_gst'
                        ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                    Without GST Bills ({gstCounts.withoutGst})
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Showing <strong>{filteredInvoices.length}</strong> of <strong>{allFolioInvoices.length}</strong> records • SAC:{' '}
                <strong>{settings.roomSac} (Room)</strong> • <strong>{settings.foodSac} (F&B)</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3.5 px-4">Invoice / Folio No.</th>
                    <th className="py-3.5 px-4">Booking & Room</th>
                    <th className="py-3.5 px-4">Customer / Corporate</th>
                    <th className="py-3.5 px-4">Scope</th>
                    <th className="py-3.5 px-4">Room + Add-Ons</th>
                    <th className="py-3.5 px-4">GST (CGST + SGST)</th>
                    <th className="py-3.5 px-4">Grand Total</th>
                    <th className="py-3.5 px-4">Payment Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 px-4 text-center text-slate-500">
                        <div className="font-bold text-slate-700 text-sm mb-1">
                          No Invoices or Folios matched your filter
                        </div>
                        <div className="text-xs">
                          Try clicking &ldquo;All Dates&rdquo; or clearing the search box above.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isFolioRow = inv.id.startsWith('FOLIO-');
                      // Strict match ONLY by bookingId / bookingNo — NEVER fallback to bookings[0]!
                      const linkedBooking = findStrictBooking(inv.bookingId, inv.bookingNo);
                      const bookingForModal = linkedBooking || syntheticBookingFromInvoice(inv);

                      // For already-issued invoices (!isFolioRow), ALWAYS display saved totals consistently!
                      const effectiveRoomCharges = r2(inv.roomCharges || 0);
                      const effectiveServicesCharges = r2(inv.otherServicesCharges || 0);
                      const hasGst = !(
                        inv.isWithoutGst === true ||
                        (inv.gstRate !== undefined && Number(inv.gstRate) <= 0) ||
                        (inv.gstRate === undefined && Number(inv.totalTax || 0) <= 0)
                      );
                      const rowGstRate = hasGst
                        ? Number(inv.gstRate) > 0
                          ? Number(inv.gstRate)
                          : configuredRoomGst
                        : 0;
                      const effectiveCgst = hasGst ? r2(inv.cgst || 0) : 0;
                      const effectiveSgst = hasGst ? r2(inv.sgst || 0) : 0;
                      const effectiveGrandTotal = r2(inv.grandTotal || 0);
                      const effectiveBalanceDue = r2(inv.balanceDue || 0);
                      const displayScope = resolveInvoiceScope(inv);
                      const isRowCreditNote = Boolean(
                        !isFolioRow &&
                          (inv.isCreditNote ||
                            String(inv.invoiceType || '').toLowerCase() === 'credit note' ||
                            String(inv.invoiceNumber || '').toUpperCase().startsWith('CN/'))
                      );
                      const isRowSuperseded = !isFolioRow && !isRowCreditNote && !isActiveInvoice(inv);
                      const rawScopeLower = String(inv.rawInvoiceScope || (inv as any).invoiceScope || '').toLowerCase();
                      const isRowFoodBill = Boolean(
                        !isFolioRow &&
                          !isRowCreditNote &&
                          (rawScopeLower === 'food_only' ||
                            String(inv.invoiceNumber || '').toUpperCase().endsWith('-F') ||
                            (displayScope === 'Only Other Services' && Number(inv.foodCharges || 0) > 0))
                      );
                      const isRowRoomBill = Boolean(
                        !isFolioRow &&
                          !isRowCreditNote &&
                          (rawScopeLower === 'room_only' ||
                            (displayScope === 'Only Booking' && inv.isFoodRoomSplitSettled === true))
                      );
                      const sameStayActive =
                        !isFolioRow && !isRowCreditNote && !isRowSuperseded
                          ? invoices.filter(
                              (other) =>
                                !other.id.startsWith('FOLIO-') &&
                                isActiveInvoice(other) &&
                                ((inv.bookingId && other.bookingId === inv.bookingId) ||
                                  (inv.bookingNo && other.bookingNo === inv.bookingNo))
                            )
                          : [];
                      const companionFoodInv =
                        sameStayActive.find((other) => {
                          const rs = String(other.rawInvoiceScope || (other as any).invoiceScope || '').toLowerCase();
                          const ds = resolveInvoiceScope(other);
                          return (
                            rs === 'food_only' ||
                            String(other.invoiceNumber || '').toUpperCase().endsWith('-F') ||
                            (ds === 'Only Other Services' && Number(other.foodCharges || 0) > 0)
                          );
                        }) || null;
                      const companionRoomInv =
                        sameStayActive.find((other) => {
                          const rs = String(other.rawInvoiceScope || (other as any).invoiceScope || '').toLowerCase();
                          const ds = resolveInvoiceScope(other);
                          return rs === 'room_only' || ds === 'Only Booking';
                        }) || null;
                      const isSplitFoodRoomActive = Boolean(
                        !isRowCreditNote &&
                          !isRowSuperseded &&
                          !isFolioRow &&
                          (inv.isFoodRoomSplitSettled === true ||
                            isRowFoodBill ||
                            isRowRoomBill ||
                            Boolean(companionFoodInv))
                      );
                      const savedFoodChargeLines = Array.isArray(inv.ledgerLines)
                        ? inv.ledgerLines.filter(
                            (l: any) =>
                              l &&
                              l.type === 'charge' &&
                              (l.kind === 'food' ||
                                /food|restaurant|room service|kot|pos/i.test(String(l.description || '')))
                          )
                        : [];
                      const serviceList = isFolioRow ? linkedBooking?.otherServices || [] : [];

                      return (
                        <tr
                          key={inv.id}
                          className={
                            isRowCreditNote
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : isRowSuperseded
                              ? 'bg-slate-50/70 opacity-65'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-3.5 px-4 font-extrabold text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={
                                  isRowCreditNote
                                    ? 'text-rose-800'
                                    : isRowSuperseded
                                    ? 'line-through text-slate-500'
                                    : ''
                                }
                              >
                                {inv.invoiceNumber}
                              </span>
                              {isRowCreditNote && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[9px] font-bold"
                                  title="Checkout Reversal Credit Note (Non-Revenue Audit Document)"
                                >
                                  CREDIT NOTE
                                </span>
                              )}
                              {isRowSuperseded && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold"
                                  title={
                                    inv.supersededByInvoiceNumber
                                      ? `Superseded by ${inv.supersededByInvoiceNumber}`
                                      : 'Superseded / Cancelled'
                                  }
                                >
                                  SUPERSEDED{inv.supersededByInvoiceNumber ? ` → ${inv.supersededByInvoiceNumber}` : ''}
                                </span>
                              )}
                              {!isRowSuperseded && !isRowCreditNote && inv.isSeparateInvoice && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold">
                                  SPLIT SCOPE
                                </span>
                              )}
                              {isFolioRow && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                  LIVE FOLIO
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-normal text-slate-400">
                              {inv.createdAt}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">
                              #{String(inv.bookingNo || inv.bookingId).replace(/^#/, '')}
                            </div>
                            <div className="text-[11px] font-semibold text-amber-700">
                              Room {(inv.roomNumbers || []).join(', ')}
                            </div>
                            {linkedBooking && (
                              <span
                                className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  linkedBooking.isCheckedOut
                                    ? 'bg-slate-100 text-slate-600'
                                    : linkedBooking.isCheckedIn
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {linkedBooking.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{inv.customerName}</div>
                            {inv.companyName ? (
                              <div className="text-[10px] text-indigo-700 font-semibold flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {inv.companyName} {inv.gstNumber ? `(${inv.gstNumber})` : ''}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500">
                                {inv.mobile ? `+91 ${inv.mobile}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                isRowFoodBill
                                  ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                  : isRowRoomBill
                                  ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                  : displayScope === 'Booking + Other Services'
                                  ? 'bg-amber-100 text-amber-900'
                                  : displayScope === 'Only Other Services'
                                  ? 'bg-purple-100 text-purple-900'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isRowFoodBill
                                ? 'Food Bill'
                                : isRowRoomBill
                                ? 'Room Bill'
                                : displayScope === 'Only Booking'
                                ? 'Room Only'
                                : displayScope === 'Only Other Services'
                                ? 'Services Only'
                                : 'Full Bill'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {isRowFoodBill && effectiveRoomCharges <= 0 ? (
                              <div className="font-bold text-amber-900">
                                Food Bill: {formatCurrency(effectiveServicesCharges || Number(inv.foodCharges || 0))}
                              </div>
                            ) : (
                              <>
                                <div className="font-semibold text-slate-800">
                                  Room: {formatCurrency(effectiveRoomCharges)}
                                </div>
                                {effectiveServicesCharges > 0 && (
                                  <div className="text-[11px] text-amber-700 font-bold mt-0.5">
                                    + Add-Ons: {formatCurrency(effectiveServicesCharges)}
                                  </div>
                                )}
                              </>
                            )}
                            {isRowFoodBill && savedFoodChargeLines.length > 0 && (
                              <div className="mt-1 space-y-0.5 max-w-xs">
                                {savedFoodChargeLines.slice(0, 3).map((fl: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="text-[10px] bg-amber-50/90 border border-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded flex items-center justify-between gap-2"
                                  >
                                    <span className="truncate" title={String(fl.description || '')}>
                                      {String(fl.description || 'Food Item')}
                                    </span>
                                    <span className="font-mono font-bold shrink-0">
                                      {formatCurrency(Number(fl.charges || 0))}
                                    </span>
                                  </div>
                                ))}
                                {savedFoodChargeLines.length > 3 && (
                                  <div className="text-[9.5px] font-bold text-amber-800 pl-1">
                                    +{savedFoodChargeLines.length - 3} more food item(s)
                                  </div>
                                )}
                              </div>
                            )}
                            {serviceList.length > 0 && (
                              <div className="mt-1 space-y-0.5 max-w-xs">
                                {serviceList.map((srv) => (
                                  <div
                                    key={srv.id}
                                    className="text-[10px] bg-amber-50/80 border border-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded flex items-center justify-between gap-2"
                                  >
                                    <span className="truncate" title={srv.description}>
                                      {srv.itemsSummary || srv.description}
                                    </span>
                                    <span className="font-mono font-bold shrink-0">
                                      {formatCurrency(srv.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {hasGst ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  {!isFolioRow && <Lock className="w-2.5 h-2.5" />} GST ({rowGstRate}%)
                                </span>
                                <div>CGST: {formatCurrency(effectiveCgst)}</div>
                                <div>SGST: {formatCurrency(effectiveSgst)}</div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                {!isFolioRow && <Lock className="w-2.5 h-2.5" />} No GST (0%)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-slate-900 font-mono">
                            {formatCurrency(effectiveGrandTotal)}
                          </td>
                          <td className="py-3.5 px-4">
                            {isRowSuperseded ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-slate-200 text-slate-600">
                                Superseded
                              </span>
                            ) : (
                              <>
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                    inv.paymentStatus === 'Paid'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {inv.paymentStatus === 'Paid' ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    <Clock className="w-3 h-3" />
                                  )}
                                  {inv.paymentStatus}
                                </span>
                                {Number(inv.refundDue || 0) > 0 && (
                                  <div className="text-[10px] font-bold text-indigo-700 mt-0.5">
                                    Refund Due: {formatCurrency(Number(inv.refundDue || 0))}
                                  </div>
                                )}
                                {effectiveBalanceDue > 0 && (
                                  <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                                    Due: {formatCurrency(effectiveBalanceDue)}
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenInvoiceModal(
                                    bookingForModal,
                                    displayScope,
                                    isFolioRow ? undefined : inv
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                title="View Folio & Invoice Breakdown"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                                View
                              </button>
                              {onEditInvoice && !isFolioRow && !isRowCreditNote && !isRowSuperseded && (
                                <button
                                  type="button"
                                  onClick={() => onEditInvoice(inv)}
                                  className="px-2.5 py-1.5 rounded-lg border border-[#C49A3A] bg-[#FDF8ED] hover:bg-amber-100 text-[#17120F] font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                  title="Edit Invoice — Room Bill, Food Bill or Combined Bill (split / unsplit)"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-[#C49A3A]" />
                                  Edit
                                </button>
                              )}
                              {(() => {
                                const rawAppBkg =
                                  appBookings.find((b) => String(b?.id || '') === String(inv.bookingId || '')) || null;
                                const rawAppCk =
                                  appCheckins.find(
                                    (c) =>
                                      String(c?.id || '') === String(inv.bookingId || '') ||
                                      String(c?.bookingId || '') === String(inv.bookingId || '')
                                  ) || null;

                                const rawCurrentInv =
                                  appInvoices.find((ai) => String(ai?.id || '') === String(inv.id)) || null;
                                const rawFoodInv = companionFoodInv
                                  ? appInvoices.find((ai) => String(ai?.id || '') === String(companionFoodInv.id)) || null
                                  : isRowFoodBill
                                  ? rawCurrentInv
                                  : null;
                                const rawRoomInv = companionRoomInv
                                  ? appInvoices.find((ai) => String(ai?.id || '') === String(companionRoomInv.id)) || null
                                  : isRowRoomBill
                                  ? rawCurrentInv
                                  : null;

                                const isRecGst = (rec: any): boolean =>
                                  !(
                                    rec?.isWithoutGst === true ||
                                    (rec?.gstRate !== undefined && Number(rec.gstRate) <= 0) ||
                                    (rec?.gstRate === undefined &&
                                      Number(rec?.gst ?? rec?.taxAmount ?? rec?.totalTax ?? 0) <= 0)
                                  );

                                const printScopedPdf = (filterKind: 'all' | 'room_only' | 'food_only') => {
                                  // 1. Prefer the actual saved split invoice record (preserves exact INV/...-F number,
                                  //    itemized edited food dishes, GST mode & Food/Room payment breakdown).
                                  if (filterKind === 'food_only' && rawFoodInv) {
                                    const foodGstOn = isRecGst(rawFoodInv);
                                    openPrintWindow(
                                      invoiceRecordToPrintHtml(
                                        { ...(rawFoodInv as any), isWithoutGst: !foodGstOn },
                                        (hotelSettings || settings) as any,
                                        rawAppCk as any,
                                        rawAppBkg as any,
                                        'food_only',
                                        posOrders
                                      ),
                                      true
                                    );
                                    return;
                                  }

                                  if (filterKind === 'room_only' && rawRoomInv) {
                                    const roomGstOn = isRecGst(rawRoomInv);
                                    openPrintWindow(
                                      invoiceRecordToPrintHtml(
                                        { ...(rawRoomInv as any), isWithoutGst: !roomGstOn },
                                        (hotelSettings || settings) as any,
                                        rawAppCk as any,
                                        rawAppBkg as any,
                                        'room_only',
                                        posOrders
                                      ),
                                      true
                                    );
                                    return;
                                  }

                                  // Combined Bill for a stay split into separate Room + Food invoices:
                                  // merge both saved records so edits to either bill appear cleanly together.
                                  if (
                                    filterKind === 'all' &&
                                    rawRoomInv &&
                                    rawFoodInv &&
                                    String(rawRoomInv.id) !== String(rawFoodInv.id)
                                  ) {
                                    const roomFallback =
                                      (Array.isArray(rawRoomInv.roomNumbers) && rawRoomInv.roomNumbers[0]) ||
                                      rawRoomInv.roomNumber ||
                                      inv.roomNumbers?.[0] ||
                                      '';
                                    const extractChargesFromSaved = (
                                      src: any,
                                      mode: 'room' | 'food'
                                    ): BillCharge[] => {
                                      const lines = Array.isArray(src?.ledgerLines)
                                        ? src.ledgerLines.filter((l: any) => l && l.type === 'charge' && Number(l.charges) > 0)
                                        : [];
                                      if (mode === 'food') {
                                        const foodL = lines.filter(
                                          (l: any) =>
                                            l.kind === 'food' ||
                                            /food|restaurant|room service|kot|pos/i.test(String(l.description || ''))
                                        );
                                        const hasDetailed =
                                          foodL.length > 0 && foodL.some((l: any) => !isGenericFoodSummaryLine(l.description));
                                        if (hasDetailed) {
                                          return foodL.map((l: any, idx: number) => ({
                                            id: `cmb-f-${idx}`,
                                            kind: 'food' as const,
                                            description: String(l.description || 'Food Item'),
                                            amount: r2(Number(l.charges || 0)),
                                            date: l.date || src.checkOutDate || src.dateCreated,
                                            roomNumber: String(l.roomNumber || roomFallback),
                                          }));
                                        }
                                        const det = extractDetailedFoodLinesForStay({
                                          invoice: src as any,
                                          checkinRecord: rawAppCk as any,
                                          bookingRecord: rawAppBkg as any,
                                          posOrders,
                                        });
                                        if (det.length > 0) {
                                          return det.map((it, idx) => ({
                                            id: `cmb-fd-${idx}`,
                                            kind: 'food' as const,
                                            description: it.description,
                                            amount: r2(it.amount),
                                            date: it.dateIso || src.checkOutDate || src.dateCreated,
                                            roomNumber: String(roomFallback),
                                          }));
                                        }
                                        if (foodL.length > 0) {
                                          return foodL.map((l: any, idx: number) => ({
                                            id: `cmb-fg-${idx}`,
                                            kind: 'food' as const,
                                            description: String(l.description || 'Restaurant & Food Charges'),
                                            amount: r2(Number(l.charges || 0)),
                                            date: l.date || src.checkOutDate || src.dateCreated,
                                            roomNumber: String(l.roomNumber || roomFallback),
                                          }));
                                        }
                                        const fa = r2(Number(src?.foodCharges || 0));
                                        return fa > 0
                                          ? [
                                              {
                                                id: 'cmb-f-legacy',
                                                kind: 'food' as const,
                                                description: 'Restaurant & Food Charges',
                                                amount: fa,
                                                date: src.checkOutDate || src.dateCreated,
                                                roomNumber: String(roomFallback),
                                              },
                                            ]
                                          : [];
                                      }
                                      if (lines.length > 0) {
                                        return lines
                                          .filter((l: any) => l.kind !== 'food')
                                          .map((l: any, idx: number) => ({
                                            id: `cmb-r-${idx}`,
                                            kind: (l.kind || 'room') as BillChargeKind,
                                            description: String(l.description || 'Room Charges'),
                                            amount: r2(Number(l.charges || 0)),
                                            date: l.date || src.checkInDate || src.dateCreated,
                                            roomNumber: String(l.roomNumber || roomFallback),
                                          }));
                                      }
                                      const out: BillCharge[] = [];
                                      const pushIf = (kind: BillChargeKind, desc: string, amt: number) => {
                                        if (amt > 0) {
                                          out.push({
                                            id: `cmb-r-${kind}`,
                                            kind,
                                            description: desc,
                                            amount: r2(amt),
                                            roomNumber: String(roomFallback),
                                          });
                                        }
                                      };
                                      pushIf('room', 'Room Charges', Number(src?.roomCharges || 0));
                                      pushIf('extra_bed', 'Extra Bed Charges', Number(src?.extraBedCharges || 0));
                                      pushIf('extra_person', 'Extra Person Charges', Number(src?.extraPersonCharges || 0));
                                      pushIf('early_checkin', 'Early Check-In Charges', Number(src?.earlyCheckInCharges || 0));
                                      pushIf('late_checkout', 'Late Check-Out Charges', Number(src?.lateCheckOutCharges || 0));
                                      pushIf('water', 'Water Bottle Charges', Number(src?.waterCharges || 0));
                                      pushIf('laundry', 'Laundry Charges', Number(src?.laundryCharges || 0));
                                      pushIf('service', 'Extra Guest Services', Number(src?.serviceCharges || 0));
                                      pushIf('fine', 'Damage / Fine', Number(src?.fineCharges || 0));
                                      return out;
                                    };
                                    const extractPaysFromSaved = (src: any, tag: string): BillPayment[] => {
                                      const hist = Array.isArray(src?.paymentHistory)
                                        ? src.paymentHistory.filter((p: any) => p && Number(p.amount) > 0)
                                        : [];
                                      if (hist.length > 0) {
                                        return hist.map((p: any, idx: number) => ({
                                          id: String(p.id || `cmb-p-${tag}-${idx}`),
                                          amount: r2(Number(p.amount || 0)),
                                          method: String(p.paymentMethod || p.method || 'Cash'),
                                          date: String(p.date || src.dateCreated || '').slice(0, 10),
                                          reference: p.referenceNo || p.reference || undefined,
                                          note: p.notes || p.note || `${tag} Settlement`,
                                        }));
                                      }
                                      const paid = r2(Number(src?.paidAmount ?? src?.amountPaid ?? src?.advancePaid ?? 0));
                                      return paid > 0
                                        ? [
                                            {
                                              id: `cmb-p-${tag}-sum`,
                                              amount: paid,
                                              method: String(src?.paymentMethod || 'Cash'),
                                              date: String(src?.dateCreated || '').slice(0, 10),
                                              note: `${tag} Settlement`,
                                            },
                                          ]
                                        : [];
                                    };

                                    const mergedCharges = [
                                      ...extractChargesFromSaved(rawRoomInv, 'room'),
                                      ...extractChargesFromSaved(rawFoodInv, 'food'),
                                    ];
                                    const mergedPays = [
                                      ...extractPaysFromSaved(rawRoomInv, 'Room Bill'),
                                      ...extractPaysFromSaved(rawFoodInv, 'Food Bill'),
                                    ];
                                    const combinedGstOn = isRecGst(rawRoomInv) || isRecGst(rawFoodInv);
                                    const combinedBill = calculateBill({
                                      charges: mergedCharges,
                                      payments: mergedPays,
                                      discount: r2(Number(rawRoomInv.discount || 0)),
                                      gstEnabled: combinedGstOn,
                                      settings: { ...settings, roomRateIncludesGst: false },
                                    });
                                    const combinedPrintable = buildInvoiceRecord({
                                      id: String(rawRoomInv.id),
                                      invoiceNumber: String(rawRoomInv.invoiceNumber || inv.invoiceNumber),
                                      hotelId: (hotelSettings as any)?.id || rawRoomInv.hotelId || 'hotel-1',
                                      bookingId: String(rawRoomInv.bookingId || inv.bookingId),
                                      checkInId: String(rawRoomInv.checkInId || (rawAppCk as any)?.id || inv.bookingId),
                                      guestName: String(rawRoomInv.guestName || inv.customerName),
                                      guestMobile: String(rawRoomInv.guestMobile || rawRoomInv.mobile || inv.mobile || ''),
                                      companyName: rawRoomInv.companyName || inv.companyName,
                                      guestGstNumber: rawRoomInv.guestGstNumber || rawRoomInv.gstNumber || inv.gstNumber,
                                      roomNumbers:
                                        Array.isArray(rawRoomInv.roomNumbers) && rawRoomInv.roomNumbers.length > 0
                                          ? rawRoomInv.roomNumbers
                                          : inv.roomNumbers || bookingForModal.roomNumbers || [],
                                      checkInDate: String(rawRoomInv.checkInDate || bookingForModal.checkInDate),
                                      checkOutDate: String(rawRoomInv.checkOutDate || bookingForModal.checkOutDate),
                                      nights: Number(rawRoomInv.nights || bookingForModal.nights || 1),
                                      bill: combinedBill,
                                      paymentMethod: (rawRoomInv.paymentMethod as any) || (inv.paymentMethod as any) || 'UPI',
                                      dateCreated: String(rawRoomInv.dateCreated || inv.createdAt || new Date().toISOString().slice(0, 10)),
                                      invoiceStatus: 'Finalized',
                                      extra: {
                                        paymentHistory: mergedPays.map((p) => ({
                                          id: p.id,
                                          amount: p.amount,
                                          paymentMethod: p.method,
                                          date: p.date,
                                          referenceNo: p.reference,
                                          notes: p.note,
                                        })),
                                      },
                                    });
                                    openPrintWindow(
                                      invoiceRecordToPrintHtml(
                                        { ...(combinedPrintable as any), isWithoutGst: !combinedGstOn },
                                        (hotelSettings || settings) as any,
                                        rawAppCk as any,
                                        rawAppBkg as any,
                                        'all',
                                        posOrders
                                      ),
                                      true
                                    );
                                    return;
                                  }

                                  // 2. Fallback for single combined checkout split-settled invoice (no separate -F record)
                                  if (rawCurrentInv && !isFolioRow) {
                                    const curGstOn = isRecGst(rawCurrentInv);
                                    openPrintWindow(
                                      invoiceRecordToPrintHtml(
                                        { ...(rawCurrentInv as any), isWithoutGst: !curGstOn },
                                        (hotelSettings || settings) as any,
                                        rawAppCk as any,
                                        rawAppBkg as any,
                                        filterKind,
                                        posOrders
                                      ),
                                      true
                                    );
                                    return;
                                  }

                                  const liveStay = buildStayBill({
                                    booking: (rawAppBkg || bookingForModal) as any,
                                    checkin: rawAppCk as any,
                                    posOrders: posOrders as any,
                                    laundryOrders: laundryOrders as any,
                                    waterBottles: waterBottles as any,
                                    rooms: rooms as any,
                                    settings,
                                    gstEnabledOverride: hasGst,
                                  });
                                  const realPaymentHistory = (bookingForModal.payments || [])
                                    .filter((p) => p && Number(p.amount) > 0)
                                    .map((p) => ({
                                      id: p.id,
                                      amount: Number(p.amount) || 0,
                                      paymentMethod: String(p.paymentMethod || 'Cash'),
                                      date: String(p.date || inv.createdAt || '').slice(0, 10),
                                      referenceNo: p.transactionId,
                                      notes: p.notes,
                                    }));
                                  const printableInv = buildInvoiceRecord({
                                    id: inv.id,
                                    invoiceNumber: inv.invoiceNumber,
                                    hotelId: (hotelSettings as any)?.id || 'hotel-1',
                                    bookingId: inv.bookingId,
                                    checkInId: String((rawAppCk as any)?.id || inv.bookingId),
                                    guestName: inv.customerName,
                                    guestMobile: inv.mobile || '',
                                    companyName: inv.companyName,
                                    guestGstNumber: inv.gstNumber,
                                    roomNumbers: inv.roomNumbers || bookingForModal.roomNumbers || [],
                                    checkInDate: bookingForModal.checkInDate,
                                    checkOutDate: bookingForModal.checkOutDate,
                                    nights: bookingForModal.nights || 1,
                                    bill: liveStay.bill,
                                    paymentMethod: (inv.paymentMethod as any) || 'UPI',
                                    dateCreated: inv.createdAt || new Date().toISOString().slice(0, 10),
                                    invoiceStatus: isFolioRow ? 'Generated' : 'Finalized',
                                    extra: {
                                      ...(realPaymentHistory.length > 0 ? { paymentHistory: realPaymentHistory } : {}),
                                    },
                                  });
                                  openPrintWindow(
                                    invoiceRecordToPrintHtml(
                                      { ...(printableInv as any), isWithoutGst: !hasGst },
                                      (hotelSettings || settings) as any,
                                      rawAppCk as any,
                                      rawAppBkg as any,
                                      filterKind,
                                      posOrders
                                    ),
                                    true
                                  );
                                };

                                if (isSplitFoodRoomActive) {
                                  return (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => printScopedPdf('room_only')}
                                        className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                                        title="Print Room Bill Only (Zero Food details & ₹0 Food amount)"
                                      >
                                        <Printer className="w-3 h-3" />
                                        Room Bill
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => printScopedPdf('food_only')}
                                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                                        title="Print Separate Food Bill (All item-wise dishes & Food GST)"
                                      >
                                        <UtensilsCrossed className="w-3 h-3" />
                                        Food Bill
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => printScopedPdf('all')}
                                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                                        title="Print Combined Room + Food Tax Invoice"
                                      >
                                        <Download className="w-3 h-3" />
                                        Combined Bill
                                      </button>
                                    </>
                                  );
                                }

                                return (
                                  <>
                                    {isFolioRow && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onOpenInvoiceModal(bookingForModal, 'Only Booking', undefined)
                                        }
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] cursor-pointer"
                                      >
                                        Room Only
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenInvoiceModal(
                                          bookingForModal,
                                          displayScope,
                                          isFolioRow ? undefined : inv
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                    >
                                      <Download className="w-3 h-3" />
                                      {hasGst ? 'Print Tax Invoice' : 'Print Bill PDF'}
                                    </button>
                                  </>
                                );
                              })()}
                              {onCreateSeparateInvoice && linkedBooking && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBookingId(linkedBooking.id);
                                    setSelectedScope(displayScope);
                                    setCreateWithGst(!hasGst);
                                    onSubTabChange('create');
                                  }}
                                  className="px-2 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                  title="Generate a brand-new separate invoice"
                                >
                                  <FilePlus2 className="w-3 h-3" />
                                  + Separate
                                </button>
                              )}
                              {effectiveBalanceDue > 0 && linkedBooking && (
                                <button
                                  type="button"
                                  onClick={() => onOpenRecordPayment(linkedBooking)}
                                  className="p-1.5 rounded-lg bg-amber-500 text-slate-950 cursor-pointer"
                                  title="Settle Balance"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                              )}
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
        </>
      )}
    </div>
  );
};
