import React, { useMemo, useState } from 'react';
import {
  Download,
  Printer,
  Calendar,
  ShieldAlert,
  CreditCard,
  Droplets,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  Receipt,
  Search,
  ArrowLeft,
  Star,
} from 'lucide-react';
import {
  BookingRecord,
  HousekeepingTask,
  InvoiceRecord,
  OtaChannelRecord,
  RoomAsset,
  WaterBottleLogEntry,
} from '../types';
import { exportToCsv, formatCurrency, formatDate } from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import type { GuestCheckIn, PosItem, PosOrder, Room } from '../../types';
import DailyCollectionSheet from '../../components/DailyCollectionSheet';
import { ReportsHub } from './ReportsHub';
import {
  REPORTS_CATALOG,
  REPORT_VIEW_TITLES,
  ReportCatalogEntry,
  readFavouriteIds,
  toggleFavouriteId,
  writeFavouriteIds,
} from '../../utils/reportsCatalog';
import {
  getTodayIst,
  getYesterdayIst,
  formatDdmmyyyy,
  getPresetDateRange,
} from '../../utils/reportingDates';

interface ReportsModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  bookings: BookingRecord[];
  invoices: InvoiceRecord[];
  otaChannels: OtaChannelRecord[];
  waterLogs: WaterBottleLogEntry[];
  tasks?: HousekeepingTask[];
  rooms?: RoomAsset[];
  /** Raw app records used for Night Audit tariff & food price deviation register */
  appCheckins?: GuestCheckIn[];
  appBookings?: any[];
  appInvoices?: any[];
  appExpenses?: any[];
  appOwnerPayments?: any[];
  appHandovers?: any[];
  appDailyClosings?: any[];
  appWaterBottles?: any[];
  appLaundryOrders?: any[];
  appPosOrders?: PosOrder[];
  appPosItems?: PosItem[];
  appPosAdvanceBookings?: any[];
  appRooms?: Room[];
  appStaff?: any[];
  hotelSettings?: any;
  /** Property + user scope for per-user Favourite Reports */
  hotelId?: string;
  userKey?: string;
  /** Opens an existing PMS module / sub-tab (Stay Overview, Room Status, Financial Hub...) */
  onNavigateModule?: (tab: string, subTab?: string) => void;
  onOpenRecordPayment: (booking: BookingRecord) => void;
}

const REPORT_TABS = [
  { id: 'daily_collection_sheet', label: 'Daily Reception & Food Register' },
  { id: 'daily_sales', label: 'Daily Sales Report (GST & Payments)' },
  { id: 'daily_cash', label: 'Daily Cash Book' },
  { id: 'advance_reservations', label: 'Advance Reservations' },
  { id: 'arrivals_departures', label: 'Arrivals & Departures' },
  { id: 'inhouse_guests', label: 'In-House Guests' },
  { id: 'noshows_cancellations', label: 'No-Shows & Cancellations' },
  { id: 'advance_collections', label: 'Advance Collections' },
  { id: 'pending_dues', label: 'Outstanding Payments' },
  { id: 'daily_checkouts', label: 'Daily Checkouts' },
  { id: 'revenue_journal', label: 'Guest Bills & Revenue' },
  { id: 'housekeeping_pending', label: 'Housekeeping Pending' },
  { id: 'night_audit', label: 'Night Audit Flash' },
  { id: 'ota_payments', label: 'OTA Payout Reconciliation' },
  { id: 'gst_tax', label: 'GSTR-1 Tax (5% GST)' },
  { id: 'police_sarai', label: 'Police Sarai / C-Form' },
  { id: 'water_logs', label: 'Water Bottle Logs' },
];

// Helper: Normalize multiple date string representations to YYYY-MM-DD
const normalizeDateStr = (val: unknown): string => {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
    const [d, m, y] = s.slice(0, 10).split('-');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
};

// Helper: Checks if a date falls strictly within [from, to] inclusive
const isDateInRange = (dateVal: unknown, from: string, to: string): boolean => {
  if (!dateVal) return false;
  const d = normalizeDateStr(dateVal);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

// Helper: Checks if booking dates (checkIn..checkOut or bookedOn) overlap [from, to]
const isBookingInStayRange = (b: BookingRecord, from: string, to: string): boolean => {
  const inD = normalizeDateStr(b.checkInDate);
  const outD = normalizeDateStr(b.checkOutDate) || inD;
  const bookedD = normalizeDateStr(b.bookedOn);
  if (inD) {
    if (from && outD < from) return false;
    if (to && inD > to) return false;
    return true;
  }
  if (bookedD) {
    if (from && bookedD < from) return false;
    if (to && bookedD > to) return false;
    return true;
  }
  return true;
};

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  bookings: allBookings,
  invoices = [],
  otaChannels,
  waterLogs: allWaterLogs,
  tasks: allTasks = [],
  rooms = [],
  appCheckins = [],
  appBookings = [],
  appInvoices = [],
  appExpenses = [],
  appOwnerPayments = [],
  appHandovers = [],
  appDailyClosings = [],
  appWaterBottles = [],
  appLaundryOrders = [],
  appPosOrders = [],
  appPosItems = [],
  appPosAdvanceBookings = [],
  appRooms = [],
  appStaff = [],
  hotelSettings,
  hotelId,
  userKey,
  onNavigateModule,
  onOpenRecordPayment,
}) => {
  const [fromDate, setFromDate] = useState(() => getTodayIst());
  const [toDate, setToDate] = useState(() => getTodayIst());
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'allTime' | 'custom'>('today');
  const [searchQuery, setSearchQuery] = useState('');

  // Favourite Reports (per property + user)
  const [favouriteIds, setFavouriteIds] = useState<string[]>(() => readFavouriteIds(hotelId, userKey));
  React.useEffect(() => {
    setFavouriteIds(readFavouriteIds(hotelId, userKey));
  }, [hotelId, userKey]);
  const handleToggleFavourite = (id: string) => {
    setFavouriteIds((prev) => {
      const next = toggleFavouriteId(prev, id);
      writeFavouriteIds(next, hotelId, userKey);
      return next;
    });
  };

  // Report-level search applies to every report's underlying records
  const bookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allBookings;
    return allBookings.filter(
      (b) =>
        String(b.customerName || '').toLowerCase().includes(q) ||
        String(b.bookingNo || '').toLowerCase().includes(q) ||
        String(b.mobile || '').includes(q) ||
        (b.roomNumbers || []).some((rn) => String(rn).toLowerCase().includes(q))
    );
  }, [allBookings, searchQuery]);
  const waterLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allWaterLogs;
    return allWaterLogs.filter(
      (w) =>
        String(w.roomNumber || '').toLowerCase().includes(q) ||
        String(w.guestName || '').toLowerCase().includes(q)
    );
  }, [allWaterLogs, searchQuery]);
  const tasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allTasks;
    return allTasks.filter(
      (t) =>
        String(t.roomName || '').toLowerCase().includes(q) ||
        String(t.assignedTo || '').toLowerCase().includes(q) ||
        String(t.description || '').toLowerCase().includes(q)
    );
  }, [allTasks, searchQuery]);

  const [taxSettings] = useHotelTaxSettings();
  const configuredRoomGst = +(taxSettings.roomCgst + taxSettings.roomSgst).toFixed(2);
  const isReportsLanding =
    !activeSubTab || activeSubTab === 'dashboard' || !REPORT_VIEW_TITLES[activeSubTab];
  const currentTab = isReportsLanding ? 'daily_sales' : activeSubTab;
  const currentReportEntry = REPORTS_CATALOG.find(
    (r) => r.target.type === 'report' && r.target.reportId === currentTab
  );

  // Dedicated Daily Sales Report State & Computations (as per Raghunath Sir's Video Reference)
  const [gstBillFilter, setGstBillFilter] = useState<'ALL' | 'WITH_GST' | 'WITHOUT_GST'>('ALL');
  const [cashBookModeFilter, setCashBookModeFilter] = useState<'Cash' | 'UPI' | 'Card' | 'All'>('Cash');

  // Night Audit Operational Workflow
  const [showNightAuditModal, setShowNightAuditModal] = useState(false);
  const [nightAuditDrawerCash, setNightAuditDrawerCash] = useState<number | ''>('');
  const [nightAuditRemarks, setNightAuditRemarks] = useState('');
  const [nightAuditSuccessBanner, setNightAuditSuccessBanner] = useState<string | null>(null);

  const dailySalesRecords = useMemo(() => {
    return bookings
      .filter((b) => {
        const bookingDate = normalizeDateStr(b.checkInDate || b.bookedOn);
        const matchesDate = (!fromDate || bookingDate >= fromDate) && (!toDate || bookingDate <= toDate);
        if (!matchesDate) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesQuery =
            b.customerName.toLowerCase().includes(q) ||
            b.bookingNo.toLowerCase().includes(q) ||
            b.mobile.includes(q) ||
            b.roomNumbers.some((rn) => rn.includes(q));
          if (!matchesQuery) return false;
        }
        return true;
      })
      .map((b, idx) => {
        const inv = invoices.find((i) => i.bookingId === b.id || i.roomNumber === b.roomNumbers[0]);
        const gstAmt = inv ? Number(inv.taxAmount || 0) : Number(b.taxAmount || 0);
        const hasGst = gstAmt > 0;

        const bookingPayments = b.paymentHistory || [];
        const cashPaid = bookingPayments
          .filter((p) => p.method === 'Cash')
          .reduce((sum, p) => sum + p.amount, 0);
        const onlinePaid = bookingPayments
          .filter((p) => p.method === 'UPI' || p.method === 'Bank Transfer' || p.method === 'Card')
          .reduce((sum, p) => sum + p.amount, 0);
        const otherPaid = bookingPayments
          .filter((p) => p.method !== 'Cash' && p.method !== 'UPI' && p.method !== 'Bank Transfer' && p.method !== 'Card')
          .reduce((sum, p) => sum + p.amount, 0);

        const totalAmount = inv ? Number(inv.grandTotal || b.totalPayable) : b.totalPayable;
        const itemsList = [
          ...(b.otherServices || []).map((s) => s.description),
          ...(b.extraCharges || []).map((e) => e.description),
        ].join(', ') || 'Room Stay';

        return {
          id: b.id,
          srNo: idx + 1,
          date: normalizeDateStr(b.checkInDate),
          customerName: b.customerName,
          roomNumbers: b.roomNumbers.join(', ') || 'Rm ' + (b.roomType || '101'),
          mobile: b.mobile,
          email: b.email || '--',
          itemsList,
          cashPaid: cashPaid > 0 ? cashPaid : (b.amountPaid > 0 && b.paymentMethod === 'Cash' ? b.amountPaid : 0),
          onlinePaid: onlinePaid > 0 ? onlinePaid : (b.amountPaid > 0 && b.paymentMethod !== 'Cash' ? b.amountPaid : 0),
          otherPaid,
          gstAmount: gstAmt,
          hasGst,
          totalAmount,
          balanceDue: b.dueAmount,
          invoiceId: inv?.invoiceNumber || inv?.id || b.bookingNo,
        };
      })
      .filter((row) => {
        if (gstBillFilter === 'WITH_GST') return row.hasGst;
        if (gstBillFilter === 'WITHOUT_GST') return !row.hasGst;
        return true;
      });
  }, [bookings, invoices, fromDate, toDate, searchQuery, gstBillFilter]);

  const salesTotals = useMemo(() => {
    const totalTransactions = dailySalesRecords.length;
    const totalSales = dailySalesRecords.reduce((s, r) => s + r.totalAmount, 0);
    const totalCash = dailySalesRecords.reduce((s, r) => s + r.cashPaid, 0);
    const totalOnline = dailySalesRecords.reduce((s, r) => s + r.onlinePaid, 0);
    const totalOther = dailySalesRecords.reduce((s, r) => s + r.otherPaid, 0);
    const totalGst = dailySalesRecords.reduce((s, r) => s + r.gstAmount, 0);
    const totalDue = dailySalesRecords.reduce((s, r) => s + r.balanceDue, 0);

    const cashPct = totalSales > 0 ? Math.round((totalCash / totalSales) * 100) : 0;
    const onlinePct = totalSales > 0 ? Math.round((totalOnline / totalSales) * 100) : 0;
    const otherPct = totalSales > 0 ? Math.round((totalOther / totalSales) * 100) : 0;

    return { totalTransactions, totalSales, totalCash, totalOnline, totalOther, totalGst, totalDue, cashPct, onlinePct, otherPct };
  }, [dailySalesRecords]);

  // Quick Preset Handlers (IST-based)
  const handleSetToday = () => {
    const range = getPresetDateRange('today');
    setFromDate(range.from);
    setToDate(range.to);
    setActiveDatePreset('today');
  };
  const handleSetYesterday = () => {
    const range = getPresetDateRange('yesterday');
    setFromDate(range.from);
    setToDate(range.to);
    setActiveDatePreset('yesterday');
  };
  const handleSetLast7Days = () => {
    const range = getPresetDateRange('last7days');
    setFromDate(range.from);
    setToDate(range.to);
    setActiveDatePreset('last7days');
  };
  const handleSetThisWeek = () => {
    const range = getPresetDateRange('thisWeek');
    setFromDate(range.from);
    setToDate(range.to);
    setActiveDatePreset('custom');
  };
  const handleSetThisMonth = () => {
    const range = getPresetDateRange('thisMonth');
    setFromDate(range.from);
    setToDate(range.to);
    setActiveDatePreset('thisMonth');
  };
  const handleSetAllTime = () => {
    setFromDate('2020-01-01');
    setToDate('2030-12-31');
    setActiveDatePreset('allTime');
  };
  const handleResetToToday = () => {
    handleSetToday();
  };

  // 1. All Payments filtered strictly by receipt date
  const allPayments = bookings.flatMap((b) =>
    (b.payments || []).map((p) => ({
      ...p,
      bookingNo: b.bookingNo,
      customerName: b.customerName,
      roomNumbers: b.roomNumbers.join(', '),
    }))
  );
  const filteredPayments = allPayments.filter((p) => isDateInRange(p.date, fromDate, toDate));

  // 2. Bookings overlapping the selected date range
  const rangeBookings = bookings.filter((b) => isBookingInStayRange(b, fromDate, toDate));

  // 3. Advance Reservations: Confirmed upcoming bookings overlapping range
  const advanceBookings = bookings.filter(
    (b) => !b.isCheckedIn && b.status === 'Confirmed' && isBookingInStayRange(b, fromDate, toDate)
  );

  // 4. Expected Arrivals in range
  const expectedArrivals = bookings.filter(
    (b) =>
      !b.isCheckedIn &&
      b.status !== 'Cancelled' &&
      b.status !== 'No-Show' &&
      isDateInRange(b.checkInDate, fromDate, toDate)
  );

  // 5. Scheduled Departures in range
  const scheduledDepartures = bookings.filter(
    (b) => b.isCheckedIn && isDateInRange(b.checkOutDate, fromDate, toDate)
  );

  // 6. In-House Guests active in range
  const inhouseBookings = bookings.filter(
    (b) => b.isCheckedIn && !b.isCheckedOut && isBookingInStayRange(b, fromDate, toDate)
  );

  // 7. Completed Checkouts in range
  const checkedOutBookings = bookings.filter(
    (b) =>
      (b.isCheckedOut || b.status === 'Checked Out') &&
      (isDateInRange(b.checkOutDate, fromDate, toDate) || isDateInRange(b.checkOutTime, fromDate, toDate))
  );

  // 8. Cancellations & No-Shows in range
  const cancelledOrNoShow = bookings.filter(
    (b) =>
      (b.status === 'Cancelled' || b.status === 'No-Show') &&
      isBookingInStayRange(b, fromDate, toDate)
  );

  // 9. Advance Collections in range
  const advanceCollections = bookings.filter(
    (b) =>
      b.amountPaid > 0 &&
      (isDateInRange(b.bookedOn, fromDate, toDate) || isDateInRange(b.checkInDate, fromDate, toDate))
  );

  // 10. Outstanding Payments / Pending Dues (always include ALL active in-house & unsettled bookings with balance > 0)
  const pendingDuesBookings = bookings.filter(
    (b) =>
      b.dueAmount > 0 &&
      b.status !== 'Cancelled' &&
      b.status !== 'No-Show' &&
      (b.isCheckedIn || b.status === 'Checked In' || activeDatePreset === 'allTime' || isBookingInStayRange(b, fromDate, toDate))
  );

  // 11. Water Logs filtered by date
  const filteredWaterLogs = waterLogs.filter((w) => isDateInRange(w.date, fromDate, toDate));

  // 12. Pending Housekeeping tasks
  const pendingHousekeeping = tasks.filter((t) => t.status !== 'Completed');

  // Export current report respecting the date filter and columns
  const handleExportCurrentReport = () => {
    const periodSuffix = `${fromDate}_to_${toDate}`;

    if (currentTab === 'daily_sales') {
      exportToCsv(
        `Dasrath_Palace_Daily_Sales_Report_${periodSuffix}.csv`,
        dailySalesRecords.map((r, i) => ({
          '#': i + 1,
          'Date': r.date,
          'Guest Name': r.customerName,
          'Room Number': r.roomNumbers,
          'Mobile': r.mobile,
          'Email': r.email,
          'Services / Water Bottle': r.itemsList,
          'Cash (INR)': r.cashPaid,
          'Online / UPI (INR)': r.onlinePaid,
          'Other (INR)': r.otherPaid,
          'GST Amount (INR)': r.gstAmount,
          'Total Amount (INR)': r.totalAmount,
          'Bill Category': r.hasGst ? 'With GST Bill' : 'Without GST Bill',
          'Invoice Ref': r.invoiceId,
        }))
      );
      return;
    }

    if (currentTab === 'daily_cash') {
      exportToCsv(
        `DirectStay_Daily_Cash_Book_${periodSuffix}.csv`,
        filteredPayments.map((p) => ({
          'Receipt Date': normalizeDateStr(p.date),
          'Receipt Time': p.time || '12:00 PM',
          'Booking #': p.bookingNo,
          'Room(s)': p.roomNumbers,
          'Guest Name': p.customerName,
          'Payment Mode': p.paymentMethod,
          'Transaction / UTR Ref': p.transactionId,
          'Remarks': p.notes || 'Folio Receipt',
          'Amount Received (INR)': p.amount,
        }))
      );
      return;
    }

    if (currentTab === 'advance_reservations') {
      exportToCsv(
        `DirectStay_Advance_Reservations_${periodSuffix}.csv`,
        advanceBookings.map((b) => ({
          'Booking #': b.bookingNo,
          'Guest Name': b.customerName,
          'Mobile': b.mobile,
          'Allocated Rooms': b.roomNumbers.join(', '),
          'Check-In': b.checkInDate,
          'Check-Out': b.checkOutDate,
          'Nights': b.nights,
          'Source': b.source,
          'Total Tariff (5% GST)': b.totalPayable,
          'Advance Paid': b.amountPaid,
          'Balance Due': b.dueAmount,
        }))
      );
      return;
    }

    if (currentTab === 'arrivals_departures') {
      const arrList = expectedArrivals.map((b) => ({
        'Type': 'Expected Arrival',
        'Booking #': b.bookingNo,
        'Guest Name': b.customerName,
        'Room': b.roomNumbers.join(', '),
        'Arrival Date': b.checkInDate,
        'Advance Paid': b.amountPaid,
        'Balance Due': b.dueAmount,
      }));
      const depList = scheduledDepartures.map((b) => ({
        'Type': 'Scheduled Departure',
        'Booking #': b.bookingNo,
        'Guest Name': b.customerName,
        'Room': b.roomNumbers.join(', '),
        'Departure Date': b.checkOutDate,
        'Advance Paid': b.amountPaid,
        'Balance Due': b.dueAmount,
      }));
      exportToCsv(`DirectStay_Arrivals_Departures_${periodSuffix}.csv`, [...arrList, ...depList]);
      return;
    }

    if (currentTab === 'inhouse_guests') {
      exportToCsv(
        `DirectStay_In_House_Guests_${periodSuffix}.csv`,
        inhouseBookings.map((b) => ({
          'Room #': b.roomNumbers.join(', '),
          'Guest Name': b.customerName,
          'Num Guests': b.numGuests,
          'Stay Type': b.isOpenStay ? 'Open Stay' : 'Fixed Stay',
          'Check-In Time': b.checkInTime,
          'Departure Date': b.checkOutDate,
          'Room Subtotal': b.roomSubtotal,
          'POS / Extra Charges': b.otherServicesTotal,
          'Total Payable': b.totalPayable,
          'Paid So Far': b.amountPaid,
          'Running Balance Due': b.dueAmount,
        }))
      );
      return;
    }

    if (currentTab === 'noshows_cancellations') {
      exportToCsv(
        `DirectStay_Cancellations_NoShows_${periodSuffix}.csv`,
        cancelledOrNoShow.map((b) => ({
          'Booking #': b.bookingNo,
          'Guest Name': b.customerName,
          'Check-In': b.checkInDate,
          'Check-Out': b.checkOutDate,
          'Source': b.source,
          'Status': b.status,
          'Advance Collected': b.amountPaid,
          'Refund Issued': b.refundAmount || 0,
          'Reason': b.cancellationReason || 'Guest schedule change',
        }))
      );
      return;
    }

    if (currentTab === 'advance_collections') {
      exportToCsv(
        `DirectStay_Advance_Collections_${periodSuffix}.csv`,
        advanceCollections.map((b) => ({
          'Booking #': b.bookingNo,
          'Guest Name': b.customerName,
          'Booking Date': b.bookedOn || b.checkInDate,
          'Total Booking Value': b.totalPayable,
          'Advance Deposit Paid': b.amountPaid,
          'Folio Bill ID': b.billId,
        }))
      );
      return;
    }

    if (currentTab === 'pending_dues') {
      exportToCsv(
        `DirectStay_Outstanding_Dues_${periodSuffix}.csv`,
        pendingDuesBookings.map((b) => ({
          'Booking #': b.bookingNo,
          'Guest Name': b.customerName,
          'Room #': b.roomNumbers.join(', '),
          'Total Payable': b.totalPayable,
          'Paid So Far': b.amountPaid,
          'Balance Due': b.dueAmount,
        }))
      );
      return;
    }

    if (currentTab === 'daily_checkouts') {
      exportToCsv(
        `DirectStay_Daily_Checkouts_${periodSuffix}.csv`,
        checkedOutBookings.map((b) => ({
          'Invoice / Bill ID': `INV-${b.billId}`,
          'Booking #': b.bookingNo,
          'Guest Name': b.customerName,
          'Rooms Vacated': b.roomNumbers.join(', '),
          'Check-Out Timestamp': b.checkOutTime,
          'Final Bill': b.totalPayable,
          'Total Paid': b.amountPaid,
        }))
      );
      return;
    }

    if (currentTab === 'revenue_journal') {
      exportToCsv(
        `DirectStay_Revenue_Journal_${periodSuffix}.csv`,
        rangeBookings.map((b) => ({
          'Booking #': b.bookingNo,
          'Guest Name': b.customerName,
          'Source': b.source,
          'Rooms': b.roomNumbers.join(', '),
          'Room Tariff': b.roomSubtotal,
          'POS & Add-Ons': b.otherServicesTotal,
          'GST (5%)': b.taxAmount,
          'Grand Total': b.totalPayable,
          'Collected Paid': b.amountPaid,
          'Balance Due': b.dueAmount,
        }))
      );
      return;
    }

    if (currentTab === 'gst_tax') {
      exportToCsv(
        `DirectStay_GSTR1_Tax_${periodSuffix}.csv`,
        rangeBookings.map((b) => {
          const taxable = Math.max(0, b.roomSubtotal + b.otherServicesTotal - b.discountAmount);
          const cgstVal =
            configuredRoomGst > 0
              ? Math.round(b.taxAmount * (taxSettings.roomCgst / configuredRoomGst) * 100) / 100
              : Math.round((b.taxAmount / 2) * 100) / 100;
          const sgstVal =
            configuredRoomGst > 0
              ? Math.round(b.taxAmount * (taxSettings.roomSgst / configuredRoomGst) * 100) / 100
              : Math.round((b.taxAmount / 2) * 100) / 100;
          return {
            'Invoice #': `${taxSettings.invoicePrefix}${b.billId}`,
            'Customer / Company': b.companyName || b.customerName,
            'GSTIN': b.companyGst || 'B2C Unregistered',
            'Taxable Value': taxable,
            'GST Slab': `${b.taxRate ?? configuredRoomGst}%`,
            'CGST': cgstVal,
            'SGST': sgstVal,
            'Invoice Total': b.totalPayable,
          };
        })
      );
      return;
    }

    if (currentTab === 'police_sarai') {
      exportToCsv(
        `DirectStay_Police_Sarai_Register_${periodSuffix}.csv`,
        rangeBookings.flatMap((b) =>
          b.guests.map((g) => ({
            'Booking #': b.bookingNo,
            'Room #': b.roomNumbers.join(', '),
            'Guest Name': g.name,
            'Gender': g.gender,
            'Age': g.age,
            'Mobile': g.phone,
            'Govt ID Type': g.documentType,
            'Govt ID Number': g.documentNumber,
            'Check-In': b.checkInDate,
            'Check-Out': b.checkOutDate,
            'Address': b.address,
          }))
        )
      );
      return;
    }

    if (currentTab === 'water_logs') {
      exportToCsv(
        `DirectStay_Water_Bottle_Logs_${periodSuffix}.csv`,
        filteredWaterLogs.map((w) => ({
          'Date': w.date,
          'Room #': w.roomNumber,
          'Guest Name': w.guestName,
          'Bottle Qty': w.qty,
          'Billing Type': w.isChargeable ? 'Chargeable' : 'Complimentary',
          'Delivered By': w.deliveredBy,
          'Charge (INR)': w.amount,
        }))
      );
      return;
    }

    if (currentTab === 'ota_payments') {
      exportToCsv(
        `DirectStay_OTA_Reconciliation_${periodSuffix}.csv`,
        otaChannels.map((ch) => {
          const matchingRangeBookings = rangeBookings.filter(
            (b) => b.source && b.source.toLowerCase().includes(ch.name.toLowerCase().slice(0, 4))
          );
          const periodGmv =
            matchingRangeBookings.length > 0
              ? matchingRangeBookings.reduce((s, b) => s + b.totalPayable, 0)
              : ch.revenueGenerated;
          const comm = Math.round((periodGmv * ch.commissionPercent) / 100);
          const tds = Math.round(periodGmv * 0.01);
          const netPayout = periodGmv - comm - tds;
          return {
            'OTA Channel': ch.name,
            'Hotel Code': ch.hotelCode,
            'Bookings Count': matchingRangeBookings.length || ch.bookingsCount,
            'Gross GMV': periodGmv,
            'Commission': comm,
            'TDS / TCS': tds,
            'Net Receivable Payout': netPayout,
          };
        })
      );
      return;
    }

    if (currentTab === 'housekeeping_pending') {
      exportToCsv(
        `DirectStay_Housekeeping_Pending_${periodSuffix}.csv`,
        pendingHousekeeping.map((t) => ({
          'Task ID': t.id,
          'Room': t.roomName,
          'Category': t.category,
          'Task Type': t.taskType,
          'Description': t.description,
          'Assigned To': t.assignedTo,
          'Status': t.status,
          'Timing': t.timing,
        }))
      );
      return;
    }

    // Default export
    exportToCsv(
      `DirectStay_${currentTab}_Report_${periodSuffix}.csv`,
      rangeBookings.map((b) => ({
        'Booking #': b.bookingNo,
        'Guest': b.customerName,
        'Rooms': b.roomNumbers.join(', '),
        'Check-In': b.checkInDate,
        'Check-Out': b.checkOutDate,
        'Status': b.status,
        'Source': b.source,
        'Total Payable': b.totalPayable,
        'Paid': b.amountPaid,
        'Balance Due': b.dueAmount,
      }))
    );
  };

  if (isReportsLanding) {
    return (
      <ReportsHub
        favouriteIds={favouriteIds}
        onToggleFavourite={handleToggleFavourite}
        onOpenReport={(entry: ReportCatalogEntry) => {
          if (entry.target.type === 'report') {
            onSubTabChange(entry.target.reportId);
          } else if (onNavigateModule) {
            onNavigateModule(entry.target.tab, entry.target.subTab);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Report breadcrumb: back to Reports & Graphs + favourite toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <button
          type="button"
          onClick={() => onSubTabChange('dashboard')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-xs font-bold text-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Reports
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-900 truncate">
            {REPORT_VIEW_TITLES[currentTab] || currentTab}
          </span>
          {currentReportEntry && (
            <button
              type="button"
              onClick={() => handleToggleFavourite(currentReportEntry.id)}
              className="p-1.5 rounded-lg hover:bg-amber-50 cursor-pointer"
              title={
                favouriteIds.includes(currentReportEntry.id)
                  ? 'Remove from favourite reports'
                  : 'Add to favourite reports'
              }
              aria-pressed={favouriteIds.includes(currentReportEntry.id)}
            >
              <Star
                className={`w-4 h-4 ${
                  favouriteIds.includes(currentReportEntry.id)
                    ? 'fill-amber-400 text-amber-500'
                    : 'text-slate-400'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Header & Date-to-Date Filter (Daily Collection Sheet has its own dedicated single-date toolbar & Excel export) */}
      {currentTab !== 'daily_collection_sheet' && (
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Audits, Lifecycle MIS & Statutory Compliance Reports
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              All 9 Guest Lifecycle Reports + Financial Registers, Night Audit Flash, 5% GSTR-1 & Police Sarai C-Form
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            {/* Search within this report */}
            <div className="relative w-full sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guest, booking, room..."
                className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                aria-label="Search within report"
              />
            </div>

            {/* Quick Date Presets (IST Real-Time) */}
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-1 bg-slate-100 p-1 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSetToday}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                  activeDatePreset === 'today' ? 'bg-amber-500 text-white shadow-2xs font-extrabold' : 'hover:bg-white text-slate-700'
                }`}
                title="Filter for today (IST)"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                  activeDatePreset === 'yesterday' ? 'bg-amber-500 text-white shadow-2xs font-extrabold' : 'hover:bg-white text-slate-700'
                }`}
                title="Filter for yesterday (IST)"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={handleSetLast7Days}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                  activeDatePreset === 'last7days' ? 'bg-amber-500 text-white shadow-2xs font-extrabold' : 'hover:bg-white text-slate-700'
                }`}
                title="Filter for last 7 days"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={handleSetThisMonth}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                  activeDatePreset === 'thisMonth' ? 'bg-amber-500 text-white shadow-2xs font-extrabold' : 'hover:bg-white text-slate-700'
                }`}
                title="Filter for entire current month"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={handleSetAllTime}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                  activeDatePreset === 'allTime' ? 'bg-amber-500 text-white shadow-2xs font-extrabold' : 'hover:bg-white text-slate-700'
                }`}
                title="Show all records without date bounds"
              >
                All Time
              </button>
              <button
                type="button"
                onClick={handleResetToToday}
                className="px-2 py-1 rounded-lg hover:bg-white text-amber-800 text-[10px] font-extrabold transition cursor-pointer shrink-0 border border-amber-200/60"
                title="Reset date filter back to today"
              >
                Reset to Today
              </button>
            </div>

            {/* Date-to-Date Pickers (DD-MM-YYYY format aware) */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActiveDatePreset('custom');
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none min-w-0"
                title={`From Date: ${formatDdmmyyyy(fromDate)}`}
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActiveDatePreset('custom');
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none min-w-0"
                title={`To Date: ${formatDdmmyyyy(toDate)}`}
              />
              <span className="hidden xl:inline text-[10px] font-mono text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {formatDdmmyyyy(fromDate)} → {formatDdmmyyyy(toDate)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 sm:px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Print Register</span>
              </button>

              <button
                type="button"
                onClick={handleExportCurrentReport}
                className="px-3 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Export CSV / Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 0. DAILY RECEPTION COLLECTION & SETTLEMENT SHEET */}
      {currentTab === 'daily_collection_sheet' && (
        <DailyCollectionSheet
          rooms={(appRooms || []) as any}
          bookings={(appBookings && appBookings.length > 0 ? appBookings : bookings) as any}
          checkins={(appCheckins || []) as any}
          invoices={(appInvoices && appInvoices.length > 0 ? appInvoices : invoices) as any}
          expenses={(appExpenses || []) as any}
          posOrders={(appPosOrders || []) as any}
          posAdvanceBookings={(appPosAdvanceBookings || []) as any}
          handovers={(appHandovers || []) as any}
          ownerPayments={(appOwnerPayments || []) as any}
          dailyClosings={(appDailyClosings || []) as any}
          waterBottles={(appWaterBottles || []) as any}
          laundryOrders={(appLaundryOrders || []) as any}
          staff={(appStaff || []) as any}
          hotelSettings={hotelSettings}
        />
      )}

      {/* 0. DEDICATED DAILY SALES REPORT (Exact layout from Raghunath Sir's Video Reference) */}
      {currentTab === 'daily_sales' && (
        <div className="space-y-4">
          {/* Top Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Transactions</span>
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 block">{salesTotals.totalTransactions}</span>
              <span className="text-[10px] text-slate-400">Bills Generated</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-amber-300 shadow-2xs bg-gradient-to-br from-white to-amber-50/40">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">Total Sales</span>
              <span className="text-xl sm:text-2xl font-extrabold text-amber-950 mt-1 block">{formatCurrency(salesTotals.totalSales)}</span>
              <span className="text-[10px] text-amber-700 font-semibold">Gross Property Revenue</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Cash Collection</span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1 block">{formatCurrency(salesTotals.totalCash)}</span>
              <span className="text-[10px] text-emerald-600 font-bold">{salesTotals.cashPct}% of Total</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Online / UPI / Bank</span>
              <span className="text-xl sm:text-2xl font-extrabold text-blue-700 mt-1 block">{formatCurrency(salesTotals.totalOnline)}</span>
              <span className="text-[10px] text-blue-600 font-bold">{salesTotals.onlinePct}% of Total</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-2xs">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">Total GST Collected</span>
              <span className="text-xl sm:text-2xl font-extrabold text-purple-900 mt-1 block">{formatCurrency(salesTotals.totalGst)}</span>
              <span className="text-[10px] text-purple-700 font-semibold">Tax Liability</span>
            </div>
          </div>

          {/* Detailed Sales Register Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Daily Sales & Revenue Report</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold font-mono">
                    {dailySalesRecords.length} Entries
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filtered records from {formatDate(fromDate)} to {formatDate(toDate)}
                </p>
              </div>

              {/* RAGHUNATH SIR'S EXACT FILTER: All Bills | With GST Bill | Without GST Bill */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setGstBillFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    gstBillFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Bills
                </button>
                <button
                  type="button"
                  onClick={() => setGstBillFilter('WITH_GST')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    gstBillFilter === 'WITH_GST'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-purple-800 hover:bg-purple-50'
                  }`}
                >
                  <Receipt className="w-3 h-3" />
                  <span>With GST Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGstBillFilter('WITHOUT_GST')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    gstBillFilter === 'WITHOUT_GST'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <span>Without GST Bill</span>
                </button>
              </div>
            </div>

            {/* Sales Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Guest Name</th>
                    <th className="py-3 px-3.5">Room No.</th>
                    <th className="py-3 px-3.5">Contact</th>
                    <th className="py-3 px-3.5">Items / Water Bottle</th>
                    <th className="py-3 px-3.5 text-right">Cash (₹)</th>
                    <th className="py-3 px-3.5 text-right">Online / UPI (₹)</th>
                    <th className="py-3 px-3.5 text-right">GST (₹)</th>
                    <th className="py-3 px-3.5 text-right">Total Amount (₹)</th>
                    <th className="py-3 px-3.5 text-center">Bill Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailySalesRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400 font-medium">
                        No sales transactions found for the selected date range and filter.
                      </td>
                    </tr>
                  ) : (
                    dailySalesRecords.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 text-slate-400 font-mono font-bold">{i + 1}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap">{r.date}</td>
                        <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">{r.customerName}</td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-900 text-amber-400">
                            {r.roomNumbers}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          <div>📞 {r.mobile}</div>
                          {r.email !== '--' && <div className="text-[10px] text-slate-400">{r.email}</div>}
                        </td>
                        <td className="py-3 px-3.5 text-slate-700 max-w-[160px] truncate" title={r.itemsList}>
                          {r.itemsList}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(r.cashPaid)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                          {formatCurrency(r.onlinePaid)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-purple-700 whitespace-nowrap">
                          {formatCurrency(r.gstAmount)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-extrabold text-slate-950 whitespace-nowrap">
                          {formatCurrency(r.totalAmount)}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {r.hasGst ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              GST Bill
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Non-GST
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dailySalesRecords.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={6} className="py-3 px-3.5 text-right uppercase text-[11px] text-slate-700">
                        Total Period Collections:
                      </td>
                      <td className="py-3 px-3.5 text-right text-emerald-800 font-mono text-xs">
                        {formatCurrency(salesTotals.totalCash)}
                      </td>
                      <td className="py-3 px-3.5 text-right text-blue-800 font-mono text-xs">
                        {formatCurrency(salesTotals.totalOnline)}
                      </td>
                      <td className="py-3 px-3.5 text-right text-purple-900 font-mono text-xs">
                        {formatCurrency(salesTotals.totalGst)}
                      </td>
                      <td className="py-3 px-3.5 text-right text-slate-950 font-mono text-sm font-extrabold">
                        {formatCurrency(salesTotals.totalSales)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 1. DAILY CASH BOOK (PAYMENT TRANSACTIONS BY MODE) */}
      {currentTab === 'daily_cash' && (() => {
        const cashOnlyList = filteredPayments.filter((p) => p.paymentMethod === 'Cash');
        const upiOnlyList = filteredPayments.filter((p) => p.paymentMethod === 'UPI');
        const cardOnlyList = filteredPayments.filter((p) => p.paymentMethod === 'Card' || p.paymentMethod === 'Bank');
        const displayedPayments =
          cashBookModeFilter === 'Cash'
            ? cashOnlyList
            : cashBookModeFilter === 'UPI'
            ? upiOnlyList
            : cashBookModeFilter === 'Card'
            ? cardOnlyList
            : filteredPayments;

        return (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daily Cash Book &amp; Collection Register
                </h3>
                <p className="text-xs text-slate-500">
                  {cashBookModeFilter === 'Cash'
                    ? 'Pure Cash receipts recorded at Front Desk'
                    : cashBookModeFilter === 'UPI'
                    ? 'Digital UPI receipts'
                    : 'Collections register'}{' '}
                  between {formatDate(fromDate)} and {formatDate(toDate)}
                </p>
              </div>

              {/* Filter Tabs to isolate Cash from UPI */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setCashBookModeFilter('Cash')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    cashBookModeFilter === 'Cash'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  💵 Pure Cash ({cashOnlyList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCashBookModeFilter('UPI')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    cashBookModeFilter === 'UPI'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  📱 UPI Register ({upiOnlyList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCashBookModeFilter('Card')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    cashBookModeFilter === 'Card'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  💳 Card / Bank ({cardOnlyList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCashBookModeFilter('All')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    cashBookModeFilter === 'All'
                      ? 'bg-slate-900 text-amber-400 shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  📑 All Modes ({filteredPayments.length})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Cash: {formatCurrency(cashOnlyList.reduce((s, p) => s + p.amount, 0))}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                  UPI: {formatCurrency(upiOnlyList.reduce((s, p) => s + p.amount, 0))}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400">
                  Total: {formatCurrency(filteredPayments.reduce((s, p) => s + p.amount, 0))}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Receipt Date &amp; Time</th>
                    <th className="py-3 px-4">Booking &amp; Room</th>
                    <th className="py-3 px-4">Guest Name</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4">Transaction / UTR Ref</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-right">Amount Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        No {cashBookModeFilter === 'Cash' ? 'Cash' : cashBookModeFilter === 'UPI' ? 'UPI' : ''} receipts recorded between <strong>{formatDate(fromDate)}</strong> and{' '}
                        <strong>{formatDate(toDate)}</strong>.
                      </td>
                    </tr>
                  ) : (
                    displayedPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {p.date} • {p.time}
                        </td>
                        <td className="py-3 px-4 font-bold">
                          {p.bookingNo} (Rm {p.roomNumbers})
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{p.customerName}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            p.paymentMethod === 'Cash'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : p.paymentMethod === 'UPI'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : 'bg-amber-100 text-amber-900'
                          }`}>
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{p.transactionId}</td>
                        <td className="py-3 px-4 text-slate-500">{p.notes || 'Folio Receipt'}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 2. ADVANCE RESERVATIONS REPORT */}
      {currentTab === 'advance_reservations' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              1. Advance Reservations Register (Confirmed Upcoming Bookings)
            </h3>
            <span className="text-xs font-bold text-blue-700">
              {advanceBookings.length} Confirmed Advance Bookings in Range
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Booking #</th>
                <th className="py-3 px-4">Guest & Mobile</th>
                <th className="py-3 px-4">Allocated Rooms</th>
                <th className="py-3 px-4">Check-In → Check-Out</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Total Tariff (5% GST)</th>
                <th className="py-3 px-4">Advance Paid</th>
                <th className="py-3 px-4">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {advanceBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No confirmed advance bookings found in the selected date range ({formatDate(fromDate)} to{' '}
                    {formatDate(toDate)}).
                  </td>
                </tr>
              ) : (
                advanceBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-bold">{b.bookingNo}</td>
                    <td className="py-3 px-4 font-bold">
                      {b.customerName} <div className="text-[10px] text-slate-500">+91 {b.mobile}</div>
                    </td>
                    <td className="py-3 px-4 font-extrabold">Rm {b.roomNumbers.join(', ')}</td>
                    <td className="py-3 px-4">
                      {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)} ({b.nights}N)
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-800">{b.source}</td>
                    <td className="py-3 px-4 font-bold">{formatCurrency(b.totalPayable)}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {formatCurrency(b.amountPaid)}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600">{formatCurrency(b.dueAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 3. ARRIVALS AND DEPARTURES REPORT */}
      {currentTab === 'arrivals_departures' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-emerald-50/60 flex items-center justify-between">
              <h3 className="text-sm font-bold text-emerald-950">Expected Arrivals in Period</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                {expectedArrivals.length} Arrivals
              </span>
            </div>
            <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3">Booking</th>
                  <th className="py-2.5 px-3">Guest</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Arrival Date</th>
                  <th className="py-2.5 px-3">Advance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expectedArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No arrivals scheduled between {formatDate(fromDate)} and {formatDate(toDate)}.
                    </td>
                  </tr>
                ) : (
                  expectedArrivals.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-bold">{b.bookingNo}</td>
                      <td className="py-2.5 px-3 font-bold">{b.customerName}</td>
                      <td className="py-2.5 px-3 font-bold">Rm {b.roomNumbers.join(', ')}</td>
                      <td className="py-2.5 px-3">{formatDate(b.checkInDate)}</td>
                      <td className="py-2.5 px-3 text-emerald-700 font-bold">
                        {formatCurrency(b.amountPaid)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-rose-50/60 flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-950">Scheduled Departures in Period</h3>
              <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[10px]">
                {scheduledDepartures.length} Departures
              </span>
            </div>
            <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3">Booking</th>
                  <th className="py-2.5 px-3">Guest</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Departure Date</th>
                  <th className="py-2.5 px-3">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduledDepartures.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No departures scheduled between {formatDate(fromDate)} and {formatDate(toDate)}.
                    </td>
                  </tr>
                ) : (
                  scheduledDepartures.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-bold">{b.bookingNo}</td>
                      <td className="py-2.5 px-3 font-bold">{b.customerName}</td>
                      <td className="py-2.5 px-3 font-bold">Rm {b.roomNumbers.join(', ')}</td>
                      <td className="py-2.5 px-3">{formatDate(b.checkOutDate)}</td>
                      <td className="py-2.5 px-3 text-rose-600 font-extrabold">
                        {formatCurrency(b.dueAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* 4. IN-HOUSE GUESTS REPORT */}
      {currentTab === 'inhouse_guests' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              In-House Occupied Rooms & Guest Folio Register
            </h3>
            <span className="text-xs font-bold text-emerald-700">
              {inhouseBookings.length} Active In-House Folios in Range
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Room #</th>
                <th className="py-3 px-4">Guest Name & Occupants</th>
                <th className="py-3 px-4">Check-In Time</th>
                <th className="py-3 px-4">Departure Date</th>
                <th className="py-3 px-4">Room + POS Charges</th>
                <th className="py-3 px-4">Paid</th>
                <th className="py-3 px-4">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inhouseBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No active in-house guests for the selected date range ({formatDate(fromDate)} to{' '}
                    {formatDate(toDate)}).
                  </td>
                </tr>
              ) : (
                inhouseBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      Room {b.roomNumbers.join(', ')}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {b.customerName} ({b.numGuests} Guests)
                      {b.isOpenStay && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                          Open Stay (12 PM Auto)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{b.checkInTime}</td>
                    <td className="py-3 px-4">{formatDate(b.checkOutDate)}</td>
                    <td className="py-3 px-4 font-bold">{formatCurrency(b.totalPayable)}</td>
                    <td className="py-3 px-4 text-emerald-700 font-bold">
                      {formatCurrency(b.amountPaid)}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-rose-600">
                      {formatCurrency(b.dueAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 5. NO-SHOWS AND CANCELLATIONS REPORT */}
      {currentTab === 'noshows_cancellations' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              No-Shows, Cancellations & Authorized Refund Audit Report
            </h3>
            <span className="text-xs font-bold text-rose-600">
              {cancelledOrNoShow.length} Cancelled / No-Show Records in Range
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Booking #</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Stay Dates</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Advance Collected</th>
                <th className="py-3 px-4">Refund Issued</th>
                <th className="py-3 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cancelledOrNoShow.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Zero cancellations or no-shows in the selected period ({formatDate(fromDate)} to{' '}
                    {formatDate(toDate)}).
                  </td>
                </tr>
              ) : (
                cancelledOrNoShow.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-bold">{b.bookingNo}</td>
                    <td className="py-3 px-4 font-bold">{b.customerName}</td>
                    <td className="py-3 px-4">
                      {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                    </td>
                    <td className="py-3 px-4">{b.source}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold">{formatCurrency(b.amountPaid)}</td>
                    <td className="py-3 px-4 font-bold text-amber-700">
                      {formatCurrency(b.refundAmount || 0)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {b.cancellationReason || 'Guest travel plan changed'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 6. ADVANCE COLLECTIONS REPORT */}
      {currentTab === 'advance_collections' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Advance Booking Deposits & Pre-Check-In Collection Ledger
            </h3>
            <span className="text-xs font-bold text-emerald-700">
              Total Deposits in Range:{' '}
              {formatCurrency(advanceCollections.reduce((s, b) => s + b.amountPaid, 0))}
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Booking #</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Booking Date</th>
                <th className="py-3 px-4">Total Booking Value</th>
                <th className="py-3 px-4">Advance Deposit Paid</th>
                <th className="py-3 px-4">Carried Forward to Checkout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {advanceCollections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No advance deposits collected between {formatDate(fromDate)} and {formatDate(toDate)}.
                  </td>
                </tr>
              ) : (
                advanceCollections.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-bold">{b.bookingNo}</td>
                    <td className="py-3 px-4 font-bold">{b.customerName}</td>
                    <td className="py-3 px-4">{b.bookedOn || b.checkInDate}</td>
                    <td className="py-3 px-4 font-bold">{formatCurrency(b.totalPayable)}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">
                      {formatCurrency(b.amountPaid)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        ✓ Linked to Folio #{b.billId}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 7. OUTSTANDING PAYMENTS / PENDING DUES REPORT */}
      {currentTab === 'pending_dues' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-sm text-rose-700 flex items-center justify-between">
            <span>Outstanding Payments & Unsettled Guest Folios in Period</span>
            <span>
              Total Pending Recovery:{' '}
              {formatCurrency(pendingDuesBookings.reduce((s, b) => s + b.dueAmount, 0))}
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Booking #</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Room #</th>
                <th className="py-3 px-4">Total Payable</th>
                <th className="py-3 px-4">Paid So Far</th>
                <th className="py-3 px-4">Balance Due</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingDuesBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Zero outstanding payment balances found for bookings in the period ({formatDate(fromDate)} to{' '}
                    {formatDate(toDate)}).
                  </td>
                </tr>
              ) : (
                pendingDuesBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-bold">{b.bookingNo}</td>
                    <td className="py-3 px-4 font-bold">{b.customerName}</td>
                    <td className="py-3 px-4 font-bold">Room {b.roomNumbers.join(', ')}</td>
                    <td className="py-3 px-4">{formatCurrency(b.totalPayable)}</td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold">
                      {formatCurrency(b.amountPaid)}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-rose-600">
                      {formatCurrency(b.dueAmount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenRecordPayment(b)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CreditCard className="w-3 h-3" />
                        Settle Now
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 8. DAILY CHECKOUTS REPORT */}
      {currentTab === 'daily_checkouts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Completed Daily Checkouts & Final Bill Clearance Register
            </h3>
            <span className="text-xs font-bold text-slate-600">
              {checkedOutBookings.length} Completed Checkouts in Range
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Invoice / Bill ID</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Rooms Vacated</th>
                <th className="py-3 px-4">Check-Out Timestamp</th>
                <th className="py-3 px-4">Final Bill (Incl. 5% GST)</th>
                <th className="py-3 px-4">Total Paid</th>
                <th className="py-3 px-4">Post-Checkout Room Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {checkedOutBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No guest checkouts recorded between {formatDate(fromDate)} and {formatDate(toDate)}.
                  </td>
                </tr>
              ) : (
                checkedOutBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-mono font-bold">INV-{b.billId}</td>
                    <td className="py-3 px-4 font-bold">{b.customerName}</td>
                    <td className="py-3 px-4 font-bold">Rm {b.roomNumbers.join(', ')}</td>
                    <td className="py-3 px-4 text-slate-600">{b.checkOutTime}</td>
                    <td className="py-3 px-4 font-bold">{formatCurrency(b.totalPayable)}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">
                      {formatCurrency(b.amountPaid)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                        Dirty → Housekeeping Queued
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 9. HOUSEKEEPING PENDING REPORT */}
      {currentTab === 'housekeeping_pending' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Pending Housekeeping & Post-Checkout Turnaround Report
            </h3>
            <span className="text-xs font-bold text-amber-700">
              {pendingHousekeeping.length} Rooms Awaiting Cleaning / Inspection
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Task #</th>
                <th className="py-3 px-4">Room & Category</th>
                <th className="py-3 px-4">Task Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Assigned Staff</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingHousekeeping.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    All housekeeping tasks completed! No pending room cleanings.
                  </td>
                </tr>
              ) : (
                pendingHousekeeping.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 px-4 font-bold">{t.id}</td>
                    <td className="py-3 px-4 font-extrabold">
                      {t.roomName} <span className="text-slate-400">({t.category})</span>
                    </td>
                    <td className="py-3 px-4 font-semibold">{t.taskType}</td>
                    <td className="py-3 px-4 text-slate-600">{t.description}</td>
                    <td className="py-3 px-4 font-bold">{t.assignedTo}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 10. NIGHT AUDIT FLASH REPORT */}
      {currentTab === 'night_audit' && (() => {
        const pureCashCollected = filteredPayments
          .filter((p) => p.paymentType === 'Cash' || (p as any).method === 'Cash')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const openingCashFloat = 5000;
        const expectedClosingCash = openingCashFloat + pureCashCollected;

        // Night Audit: Room Tariff & Food Price Deviation (fixed catalog vs actually charged)
        const naStays = appCheckins.filter((c) => {
          const ci = normalizeDateStr(c.checkInDate);
          const co = normalizeDateStr(c.checkedOutDateTime || c.checkOutDate) || ci;
          if (!ci) return false;
          return (!toDate || ci <= toDate) && (!fromDate || co >= fromDate);
        });
        const tariffDeviations = naStays
          .map((c) => {
            const rm = appRooms.find((r) => r.number === c.roomNumber);
            const standardRate =
              Number((c as any).originalRate) > 0 ? Number((c as any).originalRate) : Number(rm?.rate || 0);
            const chargedRate = Number(c.roomRate || 0);
            const ci = normalizeDateStr(c.checkInDate);
            const co = normalizeDateStr(c.checkOutDate) || ci;
            const nightsCount = Math.max(
              1,
              Number((c as any).nights || (c as any).stayNights) ||
                (ci && co ? Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000) : 1)
            );
            const discountVal = Number((c as any).discount ?? (c as any).discountAmount ?? 0);
            const perNightDiff = standardRate > 0 ? chargedRate - standardRate : 0;
            const stayTariffDiff = perNightDiff * nightsCount;
            return {
              id: c.id,
              date: ci,
              guestName: c.guestName,
              roomNumber: c.roomNumber,
              nights: nightsCount,
              standardRate,
              chargedRate,
              perNightDiff,
              discountAmount: discountVal,
              stayTariffDiff,
              netVariance: stayTariffDiff - discountVal,
            };
          })
          .filter((d) => Math.abs(d.perNightDiff) >= 0.5 || d.discountAmount > 0);
        const totalTariffConcession = tariffDeviations.reduce(
          (s, d) => s + (d.stayTariffDiff < 0 ? Math.abs(d.stayTariffDiff) : 0) + d.discountAmount,
          0
        );

        const naPosOrders = appPosOrders.filter(
          (o) => o && o.status !== 'Cancelled' && isDateInRange(o.date, fromDate, toDate)
        );
        const gstExcludedKots = naPosOrders.filter((o) => (o as any).isWithoutGst === true);
        const foodDeviations = naPosOrders.flatMap((o) =>
          (o.items || [])
            .map((it: any) => {
              const catItem = appPosItems.find(
                (p) =>
                  p.id === it.itemId ||
                  p.name.trim().toLowerCase() === String(it.itemName || '').trim().toLowerCase()
              );
              const menuPrice =
                it.menuPrice !== undefined ? Number(it.menuPrice) : Number(catItem?.price ?? it.price);
              const chargedPrice = Number(it.price || 0);
              const unitDiff = chargedPrice - menuPrice;
              const qty = Number(it.quantity || 1);
              return {
                orderNumber: o.orderNumber,
                label: o.roomNumber
                  ? `Room ${o.roomNumber}`
                  : (o as any).tableNo
                  ? `Table ${(o as any).tableNo}`
                  : o.guestName || 'Walk-in',
                itemName: it.itemName,
                quantity: qty,
                menuPrice,
                chargedPrice,
                lineDiff: unitDiff * qty,
                unitDiff,
                isWithoutGst: Boolean((o as any).isWithoutGst),
              };
            })
            .filter((f) => Math.abs(f.unitDiff) >= 0.5)
        );
        const totalFoodConcession = foodDeviations.reduce(
          (s, f) => s + (f.lineDiff < 0 ? Math.abs(f.lineDiff) : 0),
          0
        );

        return (
          <div className="space-y-4">
            {/* Night Audit Operational Action Bar */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-indigo-900/60">
              <div>
                <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                  🌙 Operational Night Audit &amp; Business Day Closing
                </span>
                <h3 className="text-base font-serif font-bold text-white mt-0.5">
                  Daily Cash Drawer Reconciliation &amp; Flash Ledger
                </h3>
                <p className="text-xs text-slate-300">
                  Verify pure cash balance, audit occupancy snapshot, reconcile drawer variance, and finalize the business day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNightAuditDrawerCash(expectedClosingCash);
                  setShowNightAuditModal(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <span>🌙 Run Night Audit / Close Day</span>
              </button>
            </div>

            {nightAuditSuccessBanner && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-mono font-bold flex items-center justify-between">
                <span>{nightAuditSuccessBanner}</span>
                <button
                  type="button"
                  onClick={() => setNightAuditSuccessBanner(null)}
                  className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Cash Drawer Reconciliation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200">
              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 block font-bold">1. Opening Cash Float</span>
                <span className="text-lg font-serif font-bold text-slate-900 mt-0.5 block">{formatCurrency(openingCashFloat)}</span>
                <span className="text-[9.5px] text-slate-400 block">Drawer float balance</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-mono uppercase text-emerald-700 block font-bold">2. Pure Cash Inflows (+)</span>
                <span className="text-lg font-serif font-bold text-emerald-700 mt-0.5 block">+{formatCurrency(pureCashCollected)}</span>
                <span className="text-[9.5px] text-emerald-600 block">Cash collected in period</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 block font-bold">3. Digital / UPI Payments</span>
                <span className="text-lg font-serif font-bold text-indigo-700 mt-0.5 block">
                  {formatCurrency(
                    filteredPayments
                      .filter((p) => p.paymentType !== 'Cash' && (p as any).method !== 'Cash')
                      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
                  )}
                </span>
                <span className="text-[9.5px] text-indigo-500 block">Bank / UPI / Card settlements</span>
              </div>
              <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-2xs">
                <span className="text-[10px] font-mono uppercase text-amber-400 block font-bold">4. Expected Drawer Cash</span>
                <span className="text-lg font-serif font-bold text-white mt-0.5 block">{formatCurrency(expectedClosingCash)}</span>
                <span className="text-[9.5px] text-slate-300 block">System calculated total</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Occupancy in Range</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {rooms && rooms.length > 0
                    ? Math.round(
                        (inhouseBookings.length / Math.max(1, rooms.length)) * 100
                      )
                    : 0}
                  %
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">
                  {inhouseBookings.length} / {rooms ? rooms.length : 0} Rooms
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Room Tariff Revenue</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {formatCurrency(rangeBookings.reduce((s, b) => s + b.roomSubtotal, 0))}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Excl. Taxes &amp; POS</div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">POS &amp; Add-On Charges</div>
                <div className="text-2xl font-extrabold text-amber-700 mt-1">
                  {formatCurrency(rangeBookings.reduce((s, b) => s + b.otherServicesTotal, 0))}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Posted to Room Folios</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl text-white">
                <div className="text-xs text-amber-400 font-semibold">5% GST Tax Liability</div>
                <div className="text-2xl font-extrabold text-white mt-1">
                  {formatCurrency(rangeBookings.reduce((s, b) => s + b.taxAmount, 0))}
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">2.5% CGST + 2.5% SGST</div>
              </div>
            </div>

            {/* Night Audit: Room Tariff & Food Price Deviation Register */}
            <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-2xs space-y-4" data-testid="night-audit-deviation">
              <div className="border-b border-amber-100 pb-3 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Room Tariff &amp; Food Price Deviation Report (Fixed vs Charged)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Check-In room tariff / discount changes and KOT food price / GST-excluded changes versus fixed catalog rates.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg">
                    Room Deviations: {tariffDeviations.length} (-{formatCurrency(totalTariffConcession)})
                  </span>
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-900 border border-orange-200 rounded-lg">
                    Food Deviations: {foodDeviations.length} (-{formatCurrency(totalFoodConcession)})
                  </span>
                  {gstExcludedKots.length > 0 && (
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg">
                      GST-Excluded KOTs: {gstExcludedKots.length}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono uppercase text-slate-800">1. Room Tariff &amp; Discount Deviations</h4>
                  {tariffDeviations.length === 0 ? (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-700">
                      ✓ All stays in this period were billed at the fixed rack tariff with no extra discount.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-[11px] divide-y divide-slate-200">
                        <thead className="bg-slate-50 font-mono uppercase text-[9.5px] font-bold text-slate-600">
                          <tr>
                            <th className="p-2">Guest &amp; Room</th>
                            <th className="p-2 text-right">Fixed Rack</th>
                            <th className="p-2 text-right">Charged</th>
                            <th className="p-2 text-right">Extra Disc.</th>
                            <th className="p-2 text-right">Net Deviation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tariffDeviations.map((d) => (
                            <tr key={d.id}>
                              <td className="p-2">
                                <div className="font-bold text-slate-900">{d.guestName} (Rm {d.roomNumber})</div>
                                <div className="text-[9.5px] font-mono text-slate-500">{d.date} • {d.nights}N</div>
                              </td>
                              <td className="p-2 text-right font-mono">{formatCurrency(d.standardRate)}/N</td>
                              <td className="p-2 text-right font-mono font-bold">{formatCurrency(d.chargedRate)}/N</td>
                              <td className="p-2 text-right font-mono text-amber-800">
                                {d.discountAmount > 0 ? `-${formatCurrency(d.discountAmount)}` : '₹0'}
                              </td>
                              <td className="p-2 text-right font-mono font-bold">
                                <span className={d.netVariance < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                  {d.netVariance < 0 ? '-' : '+'}
                                  {formatCurrency(Math.abs(d.netVariance))}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono uppercase text-slate-800">2. Food Item Price &amp; KOT GST Deviations</h4>
                  {foodDeviations.length === 0 && gstExcludedKots.length === 0 ? (
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-700">
                      ✓ All KOT food items in this period were billed at fixed menu prices with standard GST.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {foodDeviations.length > 0 && (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-[11px] divide-y divide-slate-200">
                            <thead className="bg-slate-50 font-mono uppercase text-[9.5px] font-bold text-slate-600">
                              <tr>
                                <th className="p-2">KOT &amp; Food Item</th>
                                <th className="p-2 text-right">Menu Fixed</th>
                                <th className="p-2 text-right">KOT Price</th>
                                <th className="p-2 text-right">Deviation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {foodDeviations.map((f, idx) => (
                                <tr key={`${f.orderNumber}-${idx}`}>
                                  <td className="p-2">
                                    <div className="font-bold text-slate-900">{f.itemName} × {f.quantity}</div>
                                    <div className="text-[9.5px] font-mono text-slate-500">
                                      #{f.orderNumber} • {f.label} {f.isWithoutGst ? '• [GST Excluded]' : ''}
                                    </div>
                                  </td>
                                  <td className="p-2 text-right font-mono">{formatCurrency(f.menuPrice)}</td>
                                  <td className="p-2 text-right font-mono font-bold">{formatCurrency(f.chargedPrice)}</td>
                                  <td className="p-2 text-right font-mono font-bold">
                                    <span className={f.lineDiff < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                      {f.lineDiff < 0 ? '-' : '+'}
                                      {formatCurrency(Math.abs(f.lineDiff))}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {gstExcludedKots.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] space-y-1">
                          <div className="font-mono font-bold uppercase text-[10px] text-amber-900">
                            KOT Orders Printed with GST Excluded:
                          </div>
                          {gstExcludedKots.map((ko) => (
                            <div key={ko.id} className="flex justify-between font-mono text-slate-700">
                              <span>#{ko.orderNumber} • {ko.roomNumber ? `Room ${ko.roomNumber}` : (ko as any).tableNo ? `Table ${(ko as any).tableNo}` : ko.guestName || 'Walk-in'}</span>
                              <span className="font-bold text-amber-900">{formatCurrency(Number(ko.grandTotal || 0))} (No GST)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Night Audit Modal */}
            {showNightAuditModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-indigo-700 block">
                        Night Audit Finalization
                      </span>
                      <h3 className="text-base font-serif font-bold text-slate-900">
                        Close Business Day &amp; Verify Cash Drawer
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNightAuditModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Audit Date Range:</span>
                        <strong className="text-slate-900 text-xs">{formatDate(toDate)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Expected Drawer Cash:</span>
                        <strong className="text-slate-900 text-xs">{formatCurrency(expectedClosingCash)}</strong>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-mono font-bold text-slate-700 block uppercase">
                        Actual Physical Cash in Drawer (₹) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={nightAuditDrawerCash}
                        onChange={(e) => setNightAuditDrawerCash(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-900"
                      />
                    </div>

                    {(() => {
                      const counted = Number(nightAuditDrawerCash) || 0;
                      const diff = counted - expectedClosingCash;
                      return (
                        <div
                          className={`p-2.5 rounded-lg border font-mono text-xs flex justify-between items-center ${
                            diff === 0
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : diff > 0
                              ? 'bg-blue-50 border-blue-200 text-blue-800'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          <span>Cash Variance:</span>
                          <strong>
                            {diff === 0
                              ? '✓ Balanced (₹0 Variance)'
                              : diff > 0
                              ? `+${formatCurrency(diff)} (Excess Cash)`
                              : `-${formatCurrency(Math.abs(diff))} (Cash Shortage)`}
                          </strong>
                        </div>
                      );
                    })()}

                    <div className="space-y-1">
                      <label className="text-xs font-mono font-bold text-slate-700 block uppercase">
                        Auditor Remarks / Notes
                      </label>
                      <textarea
                        rows={2}
                        value={nightAuditRemarks}
                        onChange={(e) => setNightAuditRemarks(e.target.value)}
                        placeholder="e.g. Day closed. All room tariffs posted to guest folios. Drawer verified."
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowNightAuditModal(false)}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const counted = Number(nightAuditDrawerCash) || 0;
                        const diff = counted - expectedClosingCash;
                        const timestamp = new Date().toISOString();
                        try {
                          sessionStorage.setItem('directstay_last_night_audit', timestamp);
                          sessionStorage.setItem('directstay_last_audit_cash', String(counted));
                        } catch (_) {}
                        setShowNightAuditModal(false);
                        setNightAuditSuccessBanner(
                          `✓ Business Day Successfully Closed (Night Audit Run). Audit Date: ${formatDate(toDate)} | Counted Cash: ${formatCurrency(counted)} | Variance: ${diff === 0 ? 'Balanced' : formatCurrency(diff)}`
                        );
                        alert(`🌙 Night Audit Complete!\n\nBusiness Day ${formatDate(toDate)} has been closed.\nDrawer Cash: ${formatCurrency(counted)}\nVariance: ${diff === 0 ? '₹0 Balanced' : `${formatCurrency(diff)}`}\nNight Audit flash report logged.`);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                    >
                      Confirm &amp; Close Business Day
                    </button>
                  </div>
                </div>
              </div>
            )}

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Night Audit Manager Flash Breakdown by Room Category
            </h3>
            <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Room Category</th>
                  <th className="py-3 px-4">Total Inventory</th>
                  <th className="py-3 px-4">Occupied</th>
                  <th className="py-3 px-4">Available</th>
                  <th className="py-3 px-4">Dirty / Cleaning</th>
                  <th className="py-3 px-4">Blocked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {['AC Rooms', 'Non-AC Rooms', 'Special Room', 'Delux', 'Standard', 'Deluxe AC'].map((cat) => {
                  const catRms = rooms.filter(
                    (r) => r.category === cat || (cat === 'Delux' && r.category?.toLowerCase().includes('delux'))
                  );
                  if (catRms.length === 0) return null;
                  return (
                    <tr key={cat}>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{cat}</td>
                      <td className="py-3 px-4 font-bold">{catRms.length}</td>
                      <td className="py-3 px-4 font-bold text-blue-700">
                        {catRms.filter((r) => r.status === 'Occupied').length}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {catRms.filter((r) => r.status === 'Available').length}
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-700">
                        {catRms.filter((r) => r.status === 'Dirty').length}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600">
                        {catRms.filter((r) => r.status === 'Out of Service').length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        </div>
      );
    })()}

      {/* 11. OTA PAYOUT RECONCILIATION */}
      {currentTab === 'ota_payments' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                OTA Channel Commission, TDS & Net Bank Settlement Reconciliation
              </h3>
              <p className="text-xs text-slate-500">
                Calculated for {formatDate(fromDate)} to {formatDate(toDate)}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-700">FY 2026–27 OTA Ledger</span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">OTA Channel</th>
                <th className="py-3 px-4">Hotel ID</th>
                <th className="py-3 px-4">Bookings Count</th>
                <th className="py-3 px-4">Gross Booking GMV</th>
                <th className="py-3 px-4">OTA Commission</th>
                <th className="py-3 px-4">1% TCS / TDS</th>
                <th className="py-3 px-4 text-right">Net Receivable Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {otaChannels.map((ch) => {
                const matchingRangeBookings = rangeBookings.filter(
                  (b) => b.source && b.source.toLowerCase().includes(ch.name.toLowerCase().slice(0, 4))
                );
                const periodGmv =
                  matchingRangeBookings.length > 0
                    ? matchingRangeBookings.reduce((s, b) => s + b.totalPayable, 0)
                    : ch.revenueGenerated;
                const bkgCount = matchingRangeBookings.length || ch.bookingsCount;
                const comm = Math.round((periodGmv * ch.commissionPercent) / 100);
                const tds = Math.round(periodGmv * 0.01);
                const netPayout = periodGmv - comm - tds;
                return (
                  <tr key={ch.id}>
                    <td className="py-3 px-4 font-extrabold text-slate-900">{ch.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{ch.hotelCode}</td>
                    <td className="py-3 px-4 font-bold">{bkgCount} Bookings</td>
                    <td className="py-3 px-4 font-bold">{formatCurrency(periodGmv)}</td>
                    <td className="py-3 px-4 text-rose-600 font-semibold">
                      - {formatCurrency(comm)} ({ch.commissionPercent}%)
                    </td>
                    <td className="py-3 px-4 text-rose-600 font-semibold">- {formatCurrency(tds)}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                      {formatCurrency(netPayout)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 12. GSTR-1 TAX REGISTER (DYNAMIC CGST + SGST SPLIT) */}
      {currentTab === 'gst_tax' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              GSTR-1 B2B & B2C SAC {taxSettings.roomSacCode} Tax Register ({configuredRoomGst}% GST = {taxSettings.roomCgst}% CGST + {taxSettings.roomSgst}% SGST)
            </h3>
            <span className="text-xs font-bold text-emerald-700">
              Total GST Output in Period:{' '}
              {formatCurrency(rangeBookings.reduce((s, b) => s + b.taxAmount, 0))}
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer / Company & GSTIN</th>
                <th className="py-3 px-4">Taxable Value</th>
                <th className="py-3 px-4">GST Slab</th>
                <th className="py-3 px-4">CGST ({taxSettings.roomCgst}%)</th>
                <th className="py-3 px-4">SGST ({taxSettings.roomSgst}%)</th>
                <th className="py-3 px-4 text-right">Invoice Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rangeBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No tax invoices generated between {formatDate(fromDate)} and {formatDate(toDate)}.
                  </td>
                </tr>
              ) : (
                rangeBookings.map((b) => {
                  const taxable = Math.max(
                    0,
                    b.roomSubtotal + b.otherServicesTotal - b.discountAmount
                  );
                  const cgstVal =
                    configuredRoomGst > 0
                      ? Math.round(b.taxAmount * (taxSettings.roomCgst / configuredRoomGst) * 100) / 100
                      : Math.round((b.taxAmount / 2) * 100) / 100;
                  const sgstVal =
                    configuredRoomGst > 0
                      ? Math.round(b.taxAmount * (taxSettings.roomSgst / configuredRoomGst) * 100) / 100
                      : Math.round((b.taxAmount / 2) * 100) / 100;
                  return (
                    <tr key={b.id}>
                      <td className="py-3 px-4 font-mono font-bold">
                        {taxSettings.invoicePrefix}
                        {b.billId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {b.companyName || b.customerName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {b.companyGst ? `B2B GSTIN: ${b.companyGst}` : 'B2C Unregistered'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold">{formatCurrency(taxable)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {b.taxRate ?? configuredRoomGst}% GST
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{formatCurrency(cgstVal)}</td>
                      <td className="py-3 px-4 font-mono">{formatCurrency(sgstVal)}</td>
                      <td className="py-3 px-4 text-right font-extrabold">
                        {formatCurrency(b.totalPayable)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 13. POLICE SARAI / FRRO GUEST REGISTER */}
      {currentTab === 'police_sarai' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Statutory Police Sarai & Foreigner Form-C Verification Register
            </h3>
            <span className="text-xs text-emerald-700 font-bold">
              {rangeBookings.length} Registered Stays in Range
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Booking #</th>
                <th className="py-3 px-4">Room #</th>
                <th className="py-3 px-4">Guest Full Name & Age</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4">Govt ID Type & Number</th>
                <th className="py-3 px-4">Check-In / Out</th>
                <th className="py-3 px-4">Origin Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rangeBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No guest stays found between {formatDate(fromDate)} and {formatDate(toDate)}.
                  </td>
                </tr>
              ) : (
                rangeBookings.flatMap((b) =>
                  b.guests.map((g) => (
                    <tr key={`${b.id}-${g.id}`}>
                      <td className="py-3 px-4 font-bold">{b.bookingNo}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        Rm {b.roomNumbers.join(', ')}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {g.name} ({g.gender}, {g.age}y)
                      </td>
                      <td className="py-3 px-4">+91 {g.phone}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {g.documentType}: {g.documentNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{b.address}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 14. WATER BOTTLE CONSUMPTION LOGS */}
      {currentTab === 'water_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-600" />
              Mineral Water Bottle & Room Amenity Consumption Register
            </h3>
            <span className="text-xs font-bold text-blue-700">
              Total Bottles Delivered in Period:{' '}
              {filteredWaterLogs.reduce((s, w) => s + w.qty, 0)} Bottles
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Room #</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">Bottle Qty</th>
                <th className="py-3 px-4">Billing Type</th>
                <th className="py-3 px-4">Delivered By</th>
                <th className="py-3 px-4 text-right">Folio Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWaterLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No water bottle logs recorded between {formatDate(fromDate)} and {formatDate(toDate)}.
                  </td>
                </tr>
              ) : (
                filteredWaterLogs.map((w) => (
                  <tr key={w.id}>
                    <td className="py-3 px-4 text-slate-500">{w.date}</td>
                    <td className="py-3 px-4 font-extrabold">Room {w.roomNumber}</td>
                    <td className="py-3 px-4 font-bold">{w.guestName}</td>
                    <td className="py-3 px-4 font-bold">{w.qty} x 1L Bisleri</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          w.isChargeable
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {w.isChargeable ? 'Chargeable' : 'Complimentary'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{w.deliveredBy}</td>
                    <td className="py-3 px-4 text-right font-extrabold">{formatCurrency(w.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* 15. GUEST FOLIOS & REVENUE JOURNAL */}
      {currentTab === 'revenue_journal' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Master Guest Folios & Consolidated Revenue Journal (5% GST)
            </h3>
            <span className="text-xs text-slate-500">
              Period: {formatDate(fromDate)} to {formatDate(toDate)}
            </span>
          </div>
          <div className="overflow-x-auto w-full"><table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Folio / Booking #</th>
                <th className="py-3 px-4">Guest & Source</th>
                <th className="py-3 px-4">Rooms</th>
                <th className="py-3 px-4">Room Tariff</th>
                <th className="py-3 px-4">Owner Price</th>
                <th className="py-3 px-4">POS / Add-Ons</th>
                <th className="py-3 px-4">GST (5%)</th>
                <th className="py-3 px-4">Grand Total</th>
                <th className="py-3 px-4">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rangeBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No guest folios or revenue recorded between {formatDate(fromDate)} and {formatDate(toDate)}.
                  </td>
                </tr>
              ) : (
                rangeBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-bold">{b.bookingNo}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold">{b.customerName}</div>
                      <div className="text-[10px] text-amber-700 font-semibold">{b.source}</div>
                    </td>
                    <td className="py-3 px-4 font-bold">Rm {b.roomNumbers.join(', ')}</td>
                    <td className="py-3 px-4">{formatCurrency((b as any).rackTariff || b.roomSubtotal)}</td>
                    <td className="py-3 px-4 font-bold text-amber-900">{formatCurrency(b.roomSubtotal)}</td>
                    <td className="py-3 px-4">{formatCurrency(b.otherServicesTotal)}</td>
                    <td className="py-3 px-4">{formatCurrency(b.taxAmount)}</td>
                    <td className="py-3 px-4 font-extrabold">{formatCurrency(b.totalPayable)}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">{formatCurrency(b.amountPaid)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
};
