import React, { useState, useEffect } from 'react';
import { Room, Booking, GuestCheckIn, Invoice, Expense, WaterBottleRecord, PaymentRecord, HotelSettings, PosOrder, PosItem, CashHandover, Staff } from '../types';
import { showToast } from '../utils/toast';
import {
  getTodayIst,
  getYesterdayIst,
  formatDdmmyyyy,
  getPresetDateRange,
} from '../utils/reportingDates';
import DailyCollectionSheet from './DailyCollectionSheet';
import DirtyRoomsPanel, { isRoomDirty } from './DirtyRoomsPanel';
import { 
  Calendar, BarChart3, TrendingUp, Sparkles, Download, Printer, 
  Percent, ArrowDownRight, Users, ShieldAlert, FileSpreadsheet, GlassWater, 
  Landmark, ClipboardList, CheckCircle, DollarSign, CreditCard, Clock, Receipt, HelpCircle, Activity,
  Search, Copy, Check, ExternalLink, CalendarDays, ChevronRight, AlertCircle, RefreshCw, Send, AlertTriangle
} from 'lucide-react';

interface ReportsViewProps {
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  expenses: Expense[];
  waterBottles?: WaterBottleRecord[];
  hotelSettings?: HotelSettings;
  posOrders?: PosOrder[];
  posItems?: PosItem[];
  handovers?: CashHandover[];
  staff?: Staff[];
  currentSubTab?: string;
  onSelectSubTab?: (tab: string) => void;
  onUpdateHotelSettings?: (settings: HotelSettings) => void;
  onUpdateInvoices?: (invoices: Invoice[]) => void;
  onUpdateBookings?: (bookings: Booking[]) => void;
  onAddAuditLog?: (action: string, details: string, module?: any) => void;
  onEditCheckout?: (guest: GuestCheckIn) => void;
}

type ReportType = 'dailyCollectionSheet' | 'cashReport' | 'nightAudit' | 'pendingReport' | 'otaReport' | 'gstReport' | 'revenueReport' | 'sarai' | 'waterLogs';

export default function ReportsView({ 
  rooms, 
  bookings, 
  checkins, 
  invoices, 
  expenses, 
  waterBottles = [],
  hotelSettings,
  posOrders = [],
  posItems = [],
  handovers = [],
  staff = [],
  currentSubTab,
  onSelectSubTab,
  onEditCheckout
}: ReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>(() => {
    if (currentSubTab === 'daily_cash') return 'cashReport';
    if (currentSubTab === 'night_audit') return 'nightAudit';
    if (currentSubTab === 'pending_dues') return 'pendingReport';
    if (currentSubTab === 'ota_payments') return 'otaReport';
    if (currentSubTab === 'gst_tax') return 'gstReport';
    if (currentSubTab === 'revenue_journal') return 'revenueReport';
    if (currentSubTab === 'police_sarai') return 'sarai';
    if (currentSubTab === 'water_logs') return 'waterLogs';
    return 'dailyCollectionSheet';
  });

  useEffect(() => {
    if (currentSubTab === 'daily_collection_sheet') {
      setReportType('dailyCollectionSheet');
    } else if (currentSubTab === 'daily_cash') {
      setReportType('cashReport');
    } else if (currentSubTab === 'night_audit') {
      setReportType('nightAudit');
    } else if (currentSubTab === 'pending_dues') {
      setReportType('pendingReport');
    } else if (currentSubTab === 'ota_payments') {
      setReportType('otaReport');
    } else if (currentSubTab === 'gst_tax') {
      setReportType('gstReport');
    } else if (currentSubTab === 'revenue_journal') {
      setReportType('revenueReport');
    } else if (currentSubTab === 'police_sarai') {
      setReportType('sarai');
    } else if (currentSubTab === 'water_logs') {
      setReportType('waterLogs');
    }
  }, [currentSubTab]);
  
  // helper function to notify exporting/downloading reports via DirectStay toast
  const triggerToast = (msg: string) => {
    showToast(msg, 'info');
  };
  
  // --- DYNAMIC SYSTEM REFERENCE TIME (IST Default: Today) ---
  const [refTodayDate, setRefTodayDate] = useState(() => getTodayIst());

  // --- FILTER RANGE PRESETS & STATES ---
  const [dateFilterPreset, setDateFilterPreset] = useState<'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(() => getTodayIst());
  const [customEndDate, setCustomEndDate] = useState(() => getTodayIst());
  
  // Excluded dates within the active range (allows toggling individual dates)
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  
  // GST Tax Report Month (IST Current Month YYYY-MM)
  const [taxMonth, setTaxMonth] = useState(() => getTodayIst().substring(0, 7));

  // Search input inside ledger tables
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Active guest selection for Pending Payment Reminders
  const [selectedPendingGuestId, setSelectedPendingGuestId] = useState<string>('');
  const [copiedReminderId, setCopiedReminderId] = useState<string | null>(null);

  // Night Audit Operational Workflow
  const [showNightAuditModal, setShowNightAuditModal] = useState(false);
  const [auditCountedCash, setAuditCountedCash] = useState<number | ''>('');
  const [auditRemarks, setAuditRemarks] = useState('');
  const [auditSuccessBanner, setAuditSuccessBanner] = useState<string | null>(null);

  // --- HELPERS FOR DATES ---
  const yesterdayOf = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().substring(0, 10);
  };

  const startOfWeekOf = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    // We adjust so Monday is start of the week.
    // If Sunday (0), go back 6 days. If Monday (1) to Saturday (6), go back (day - 1) days.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().substring(0, 10);
  };

  const endOfWeekOf = (dateStr: string) => {
    const d = new Date(startOfWeekOf(dateStr));
    d.setDate(d.getDate() + 6);
    return d.toISOString().substring(0, 10);
  };

  const startOfMonthOf = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().substring(0, 10);
  };

  const endOfMonthOf = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().substring(0, 10);
  };

  const getDatesBetween = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return [startStr];
    }
    const current = new Date(start);
    let limit = 0;
    while (current <= end && limit < 3660) { // Safety limit: max 10 years
      dates.push(current.toISOString().substring(0, 10));
      current.setDate(current.getDate() + 1);
      limit++;
    }
    return dates;
  };

  // Compute boundaries of active range based on preset and reference date
  const computedRangeStart = 
    dateFilterPreset === 'today' ? refTodayDate :
    dateFilterPreset === 'yesterday' ? yesterdayOf(refTodayDate) :
    dateFilterPreset === 'thisWeek' ? startOfWeekOf(refTodayDate) :
    dateFilterPreset === 'thisMonth' ? startOfMonthOf(refTodayDate) :
    customStartDate;

  const computedRangeEnd = 
    dateFilterPreset === 'today' ? refTodayDate :
    dateFilterPreset === 'yesterday' ? yesterdayOf(refTodayDate) :
    dateFilterPreset === 'thisWeek' ? endOfWeekOf(refTodayDate) :
    dateFilterPreset === 'thisMonth' ? endOfMonthOf(refTodayDate) :
    customEndDate;

  const datesInRange = getDatesBetween(computedRangeStart, computedRangeEnd);
  
  // Selected/Active dates are those inside datesInRange that are NOT in excludedDates
  const selectedDates = datesInRange.filter(d => !excludedDates.includes(d));

  const toggleDateSelection = (dateStr: string) => {
    if (excludedDates.includes(dateStr)) {
      setExcludedDates(excludedDates.filter(d => d !== dateStr));
    } else {
      setExcludedDates([...excludedDates, dateStr]);
    }
  };

  const selectAllDates = () => {
    setExcludedDates([]);
  };

  const deselectAllDates = () => {
    setExcludedDates([...datesInRange]);
  };

  // Helper for nights count
  const calcNightsCount = (inDate: string, outDate: string) => {
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    const diff = Math.abs(d2.getTime() - d1.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return isNaN(days) || days <= 0 ? 1 : days;
  };

  // Extract all payments on a list of specific dates (YYYY-MM-DD)
  const getPaymentsForSelectedDates = (dates: string[]): { checkin: GuestCheckIn; payment: PaymentRecord }[] => {
    const list: { checkin: GuestCheckIn; payment: PaymentRecord }[] = [];
    checkins.forEach(c => {
      if (c.payments) {
        c.payments.forEach(p => {
          const pDate = p.dateTime.substring(0, 10);
          if (dates.includes(pDate)) {
            list.push({ checkin: c, payment: p });
          }
        });
      }
    });
    return list;
  };

  // --- REPORT AGGREGATIONS ---

  // --- REPORT A: DAILY CASH REPORT ---
  const INITIAL_DESK_VAULT = 0; // 100% real cash balance (zero hardcoded starting drawer balance)

  // Determine chronological earliest date selected to calculate cash opening balance before it
  const earliestSelectedDate = selectedDates.length > 0 ? [...selectedDates].sort()[0] : computedRangeStart;

  // 1. Sum cash collected BEFORE the earliest selected date
  let totalCashCollectedBefore = 0;
  checkins.forEach(c => {
    if (c.payments) {
      c.payments.forEach(p => {
        const pDate = p.dateTime.substring(0, 10);
        if (p.paymentMethod === 'Cash' && pDate < earliestSelectedDate) {
          totalCashCollectedBefore += p.amount;
        }
      });
    }
  });

  // 2. Sum cash expenses BEFORE the earliest selected date
  const totalCashExpensesBefore = expenses
    .filter(exp => exp.date < earliestSelectedDate && exp.description.toLowerCase().includes('cash'))
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Computed starting cash opening balance
  const netCashOpeningBalance = INITIAL_DESK_VAULT + totalCashCollectedBefore - totalCashExpensesBefore;

  // Payments collected inside selected dates
  const selectedPayments = getPaymentsForSelectedDates(selectedDates);

  // Cash Collections inside range
  const cashPaymentsSelected = selectedPayments.filter(item => item.payment.paymentMethod === 'Cash');
  const totalCashCollectedSelected = cashPaymentsSelected.reduce((sum, item) => sum + item.payment.amount, 0);

  // UPI Collections inside range
  const upiPaymentsSelected = selectedPayments.filter(item => item.payment.paymentMethod === 'UPI');
  const totalUpiCollectedSelected = upiPaymentsSelected.reduce((sum, item) => sum + item.payment.amount, 0);

  // Card/Bank Collections inside range
  const otherOnlinePaymentsSelected = selectedPayments.filter(item => item.payment.paymentMethod === 'Card' || item.payment.paymentMethod === 'Bank');
  const totalOtherOnlineCollectedSelected = otherOnlinePaymentsSelected.reduce((sum, item) => sum + item.payment.amount, 0);

  // Cash Expenses inside range
  const cashExpensesSelected = expenses.filter(exp => selectedDates.includes(exp.date) && exp.description.toLowerCase().includes('cash'));
  const totalCashExpensesSelected = cashExpensesSelected.reduce((sum, exp) => sum + exp.amount, 0);

  // Expected cash in drawer at end of range
  const netCashInDrawer = netCashOpeningBalance + totalCashCollectedSelected - totalCashExpensesSelected;

  // Day-by-Day Cash Drawer Reconciliation Log
  const dayByDayCashLogs = [...selectedDates].sort().map(date => {
    // 1. Cash collected before this date
    let priorCashIn = 0;
    checkins.forEach(c => {
      if (c.payments) {
        c.payments.forEach(p => {
          const pDate = p.dateTime.substring(0, 10);
          if (p.paymentMethod === 'Cash' && pDate < date) {
            priorCashIn += p.amount;
          }
        });
      }
    });

    // 2. Cash expenses before this date
    const priorCashOut = expenses
      .filter(exp => exp.date < date && exp.description.toLowerCase().includes('cash'))
      .reduce((sum, exp) => sum + exp.amount, 0);

    const dayOpening = INITIAL_DESK_VAULT + priorCashIn - priorCashOut;

    // Today's collections and expenses
    const dayCashPayments = selectedPayments.filter(item => item.payment.paymentMethod === 'Cash' && item.payment.dateTime.startsWith(date));
    const dayInflow = dayCashPayments.reduce((sum, item) => sum + item.payment.amount, 0);

    const dayCashExpenses = expenses.filter(exp => exp.date === date && exp.description.toLowerCase().includes('cash'));
    const dayOutflow = dayCashExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const dayClosing = dayOpening + dayInflow - dayOutflow;

    return {
      date,
      opening: dayOpening,
      inflow: dayInflow,
      outflow: dayOutflow,
      closing: dayClosing,
      entriesCount: dayCashPayments.length
    };
  });


  // --- REPORT B: NIGHT AUDIT RECONCILIATION ---
  const checkedInSelected = checkins.filter(c => {
    const dtSub = c.dateTime ? String(c.dateTime).substring(0, 10) : '';
    const ciSub = c.checkInDate ? String(c.checkInDate).substring(0, 10) : '';
    return (dtSub && selectedDates.includes(dtSub)) || (ciSub && selectedDates.includes(ciSub));
  });
  const checkedOutSelected = checkins.filter(c => {
    if (!c.checkedOutDateTime) return false;
    const outDate = c.checkedOutDateTime.substring(0, 10);
    return selectedDates.includes(outDate);
  });
  
  const totalPaymentsSelected = selectedPayments.reduce((sum, item) => sum + item.payment.amount, 0);
  const totalOnlineCollectedSelected = totalUpiCollectedSelected + totalOtherOnlineCollectedSelected;

  const occupiedRoomsCount = rooms.filter(r => r.status === 'Occupied').length;
  const dirtyRoomsCount = rooms.filter(isRoomDirty).length;
  const availableRoomsCount = rooms.filter(r => r.status === 'Available').length;

  // Point 5: Night Audit Tariff & Food Price Deviation calculations (covers arrivals, departures & active stays overlapping selected dates)
  const nightAuditStays = checkins.filter(c => {
    const ci = String(c.checkInDate || '').slice(0, 10);
    const co = String((c.checkedOutDateTime || c.checkOutDate || ci)).slice(0, 10);
    const dt = String(c.dateTime || '').slice(0, 10);
    return selectedDates.some(d => d === ci || d === co || d === dt || (ci && co && d >= ci && d <= co));
  });

  const tariffDeviations = nightAuditStays
    .map(c => {
      const rm = rooms.find(r => r.number === c.roomNumber);
      const standardRate = Number(c.originalRate) > 0 ? Number(c.originalRate) : Number(rm?.rate || 0);
      const chargedRate = Number(c.roomRate || 0);
      const nightsCount = Math.max(
        1,
        Number(c.nights || c.stayNights) ||
          (c.checkInDate && c.checkOutDate
            ? Math.max(1, Math.round((new Date(c.checkOutDate).getTime() - new Date(c.checkInDate).getTime()) / 86400000))
            : 1)
      );
      const discountVal = Number(c.discount ?? c.discountAmount ?? 0);
      const perNightDiff = standardRate > 0 ? chargedRate - standardRate : 0; // negative = lower than fixed rack rate
      const stayTariffDiff = perNightDiff * nightsCount;
      const netVariance = stayTariffDiff - discountVal;
      return {
        id: c.id,
        date: String(c.checkInDate || c.dateTime || '').slice(0, 10),
        guestName: c.guestName,
        roomNumber: c.roomNumber,
        nights: nightsCount,
        standardRate,
        chargedRate,
        perNightDiff,
        stayTariffDiff,
        discountAmount: discountVal,
        netVariance,
        staffName: c.checkedInBy || c.overriddenBy || 'Reception',
      };
    })
    .filter(d => Math.abs(d.perNightDiff) >= 0.5 || d.discountAmount > 0);

  const totalTariffConcession = tariffDeviations.reduce(
    (sum, d) => sum + (d.stayTariffDiff < 0 ? Math.abs(d.stayTariffDiff) : 0) + d.discountAmount,
    0
  );
  const totalTariffUpsell = tariffDeviations.reduce(
    (sum, d) => sum + (d.stayTariffDiff > 0 ? d.stayTariffDiff : 0),
    0
  );

  const selectedPosOrders = posOrders.filter(
    o => o && o.status !== 'Cancelled' && o.date && selectedDates.includes(String(o.date).slice(0, 10))
  );
  const gstExcludedKotOrders = selectedPosOrders.filter(o => o.isWithoutGst === true);
  const foodDeviations = selectedPosOrders.flatMap(o => {
    return (o.items || []).map(it => {
      const catItem = posItems?.find(
        p => p.id === it.itemId || p.name.trim().toLowerCase() === String(it.itemName || '').trim().toLowerCase()
      );
      const menuPrice = it.menuPrice !== undefined ? Number(it.menuPrice) : Number(catItem?.price ?? it.price);
      const chargedPrice = Number(it.price || 0);
      const unitDiff = chargedPrice - menuPrice; // negative = discounted below menu price, positive = above menu price
      const lineDiff = unitDiff * Number(it.quantity || 1);
      return {
        orderNumber: o.orderNumber,
        date: o.date,
        guestLabel: o.roomNumber ? `Room ${o.roomNumber}${o.guestName ? ` (${o.guestName})` : ''}` : o.tableNo ? `Table ${o.tableNo}` : (o.guestName || 'Walk-in'),
        itemName: it.itemName,
        quantity: Number(it.quantity || 1),
        menuPrice,
        chargedPrice,
        unitDiff,
        lineDiff,
        isWithoutGst: Boolean(o.isWithoutGst),
      };
    }).filter(f => Math.abs(f.unitDiff) >= 0.5);
  });
  const totalFoodConcession = foodDeviations.reduce((s, f) => s + (f.lineDiff < 0 ? Math.abs(f.lineDiff) : 0), 0);


  // --- REPORT C: PENDING PAYMENTS REPORT (STRICTLY FILTERED BY SELECTED DATE-TO-DATE RANGE) ---
  // Active stayed guests with pending dues (not yet checked out) inside selected date range
  const activePendingGuests = checkins.filter(c => {
    const due = c.pendingAmount ?? (c.totalAmount - c.advanceAmount);
    const inDate = (c.checkInDate || '').substring(0, 10);
    const outDate = (c.checkOutDate || inDate).substring(0, 10);
    const overlapsRange = selectedDates.some(d => d >= inDate && d <= outDate) || selectedDates.includes(inDate);
    return due > 0 && !c.checkedOutDateTime && overlapsRange;
  });

  // Historical checked-out guests with pending dues inside selected date range
  const checkedOutPendingGuests = checkins.filter(c => {
    const due = c.pendingAmount ?? 0;
    if (!(due > 0 && !!c.checkedOutDateTime)) return false;
    const outDate = (c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate || '').substring(0, 10);
    const inDate = (c.checkInDate || '').substring(0, 10);
    return selectedDates.includes(outDate) || selectedDates.includes(inDate) || (outDate >= computedRangeStart && outDate <= computedRangeEnd);
  });

  const totalOutstandingActiveDues = activePendingGuests.reduce((sum, c) => {
    const due = c.pendingAmount ?? (c.totalAmount - c.advanceAmount);
    return sum + due;
  }, 0);

  const totalOutstandingHistoricalDues = checkedOutPendingGuests.reduce((sum, c) => sum + (c.pendingAmount ?? 0), 0);


  // --- REPORT D: OTA PAYMENT REPORT ---
  const bookingSourcesList: ('Walk-in' | 'OYO' | 'Agoda' | 'Booking.com' | 'Goibibo' | 'MakeMyTrip')[] = [
    'Walk-in', 'OYO', 'Agoda', 'Booking.com', 'Goibibo', 'MakeMyTrip'
  ];

  const otaSummary = bookingSourcesList.map(source => {
    // We match bookings where check-in date falls inside our selected dates
    const matchedBookings = bookings.filter(b => b.bookingSource === source && selectedDates.includes(b.checkInDate));
    const count = matchedBookings.length;
    const roomRevenue = matchedBookings.reduce((sum, b) => sum + b.advanceAmount, 0); // Advance/Total paid of OTA booking
    
    // Check-ins mapped to this source
    const checkinsForSource = checkins.filter(c => {
      const bk = bookings.find(b => b.id === c.id);
      return bk && bk.bookingSource === source && selectedDates.includes(c.checkInDate);
    });

    const extraRevenue = checkinsForSource.reduce((sum, c) => {
      const paymentsSum = (c.payments || [])
        .filter(p => selectedDates.includes(p.dateTime.substring(0, 10)))
        .reduce((pSum, p) => pSum + p.amount, 0);
      return sum + paymentsSum;
    }, 0);

    const totalRevenue = roomRevenue + extraRevenue;
    const commissionRate = source === 'Walk-in' ? 0 : 0.15; // 15% OTA commission
    const commissionPaid = Math.round(totalRevenue * commissionRate);
    const netRevenue = totalRevenue - commissionPaid;

    return {
      source,
      count,
      totalRevenue,
      commissionPaid,
      netRevenue
    };
  });

  // Max OTA net revenue for styling comparison
  const maxOtaNetRevenue = Math.max(...otaSummary.map(o => o.netRevenue), 1);


  // --- REPORT E: GST REPORT (TAX DECLARATIONS - FILTERED BY SELECTED DATE-TO-DATE RANGE OR FILING MONTH) ---
  const gstInvoicesThisMonth = invoices.filter(inv => {
    const invDate = (inv.dateCreated || '').substring(0, 10);
    if (dateFilterPreset === 'custom') {
      return selectedDates.includes(invDate);
    }
    return selectedDates.includes(invDate) || invDate.startsWith(taxMonth);
  });
  
  // GST 5% Lodging Slab
  const lodgingInvoices5 = gstInvoicesThisMonth.filter(inv => inv.gstRate === 5);
  const lodgingTaxableSum5 = lodgingInvoices5.reduce((sum, inv) => sum + inv.roomCharges, 0);
  const lodgingCGST5 = parseFloat((lodgingTaxableSum5 * 0.025).toFixed(2));
  const lodgingSGST5 = parseFloat((lodgingTaxableSum5 * 0.025).toFixed(2));

  // GST 18% Lodging Slab
  const lodgingInvoices18 = gstInvoicesThisMonth.filter(inv => inv.gstRate === 18 || !inv.gstRate);
  const lodgingTaxableSum18 = lodgingInvoices18.reduce((sum, inv) => sum + inv.roomCharges, 0);
  const lodgingCGST18 = parseFloat((lodgingTaxableSum18 * 0.09).toFixed(2));
  const lodgingSGST18 = parseFloat((lodgingTaxableSum18 * 0.09).toFixed(2));

  // Aggregated Lodging Base
  const lodgingTaxableSum = lodgingTaxableSum5 + lodgingTaxableSum18;
  const totalLodgingCGST = lodgingCGST5 + lodgingCGST18;
  const totalLodgingSGST = lodgingSGST5 + lodgingSGST18;

  // Restaurant Food standard 5% GST
  const foodTaxableSum = gstInvoicesThisMonth.reduce((sum, inv) => sum + inv.foodCharges, 0);
  const foodCGST = parseFloat((foodTaxableSum * 0.025).toFixed(2));
  const foodSGST = parseFloat((foodTaxableSum * 0.025).toFixed(2));

  // Ancillary services standard 18% GST
  const ancillaryTaxableSum = gstInvoicesThisMonth.reduce((sum, inv) => sum + (inv.waterCharges + inv.otherCharges), 0);
  const ancillaryCGST = parseFloat((ancillaryTaxableSum * 0.09).toFixed(2));
  const ancillarySGST = parseFloat((ancillaryTaxableSum * 0.09).toFixed(2));

  // Overall tax compiled
  const totalGstInvoicesCollected = totalLodgingCGST + totalLodgingSGST + foodCGST + foodSGST + ancillaryCGST + ancillarySGST;


  // --- REPORT F: DAILY REVENUE JOURNAL (DAY-BY-DAY STRICTLY WITHIN SELECTED DATE RANGE) ---
  const uniqueDatesInLedger = Array.from(new Set([
    ...checkins.map(c => (c.checkInDate || '').substring(0, 10)),
    ...invoices.map(i => (i.dateCreated || '').substring(0, 10)),
    ...expenses.map(e => (e.date || '').substring(0, 10)),
    ...selectedDates
  ])).filter(d => d && selectedDates.includes(d)).sort((a,b) => b.localeCompare(a));

  const dailyRevenueLogs = uniqueDatesInLedger.map(date => {
    // Lodging revenue
    const activeCheckedInDate = checkins.filter(c => c.checkInDate === date);
    const baseLodgingVal = activeCheckedInDate.reduce((sum, c) => sum + c.roomRate, 0);

    // Dynamic payments received on this date
    const paymentsReceivedOnDay = checkins.flatMap(c => c.payments || [])
      .filter(p => p.dateTime.startsWith(date));
    const totalPaymentsReceived = paymentsReceivedOnDay.reduce((sum, p) => sum + p.amount, 0);

    // Invoices generated on this date
    const invoicesGeneratedOnDay = invoices.filter(inv => inv.dateCreated === date);
    const totalBilledValue = invoicesGeneratedOnDay.reduce((sum, inv) => sum + inv.finalAmount, 0);
    const gstCollected = invoicesGeneratedOnDay.reduce((sum, inv) => sum + inv.gst, 0);
    const discountAllowed = invoicesGeneratedOnDay.reduce((sum, inv) => sum + inv.discount, 0);

    // Expenses paid on this date
    const expensesOnDay = expenses.filter(exp => exp.date === date);
    const totalExpenses = expensesOnDay.reduce((sum, exp) => sum + exp.amount, 0);

    return {
      date,
      baseLodgingVal,
      totalPaymentsReceived,
      totalBilledValue,
      gstCollected,
      discountAllowed,
      totalExpenses
    };
  });


  // --- REPORT H: WATER BOTTLES AUDIT LOG ---
  const waterBottlesSelected = waterBottles.filter(wb => selectedDates.includes(wb.date));
  const totalWaterBottlesIssuedSelected = waterBottlesSelected.reduce((sum, wb) => sum + wb.quantity, 0);


  // --- EXCEL & PDF EXPORT UTILITIES ---
  const handleExportPDF = () => {
    window.print();
  };

  const handleExportExcel = () => {
    let csvContent = "";
    let filename = `directstay_${reportType}_report_${computedRangeStart}_to_${computedRangeEnd}.csv`;
    
    if (reportType === 'cashReport') {
      csvContent += "DIRECTSTAY GRAND RESORT,DAILY CASH REPORT\n";
      csvContent += `Selected Dates,${selectedDates.join('; ')}\n\n`;
      csvContent += "CASH RECONCILIATION SUMMARY\n";
      csvContent += `Opening Cash Balance,₹${netCashOpeningBalance}\n`;
      csvContent += `Cash Collected Today,₹${totalCashCollectedSelected}\n`;
      csvContent += `UPI Collected Today,₹${totalUpiCollectedSelected}\n`;
      csvContent += `Other Online Collected Today,₹${totalOtherOnlineCollectedSelected}\n`;
      csvContent += `Cash Expenses Paid Today,₹${totalCashExpensesSelected}\n`;
      csvContent += `Expected Cash in Drawer,₹${netCashInDrawer}\n\n`;
      
      csvContent += "DAY BY DAY RECONCILIATION HISTORY\n";
      csvContent += "Date,Opening Balance,Cash Collected,Cash Expenses,Closing Drawer Cash,Transaction Count\n";
      dayByDayCashLogs.forEach(row => {
        csvContent += `${row.date},₹${row.opening},₹${row.inflow},₹${row.outflow},₹${row.closing},${row.entriesCount}\n`;
      });
      csvContent += "\n";

      csvContent += "ITEMIZED CASH TRANSACTIONS LEDGER\n";
      csvContent += "Time,Date,Guest Name,Room Number,Payment Category,Notes,Amount\n";
      cashPaymentsSelected.forEach(item => {
        const time = new Date(item.payment.dateTime).toLocaleTimeString();
        const date = item.payment.dateTime.substring(0, 10);
        csvContent += `"${time}","${date}","${item.checkin.guestName}","Room ${item.checkin.roomNumber}","${item.payment.paymentType}","${item.payment.notes || ''}",₹${item.payment.amount}\n`;
      });
    } else if (reportType === 'nightAudit') {
      csvContent += "DIRECTSTAY GRAND RESORT,NIGHT AUDIT RECONCILIATION REPORT\n";
      csvContent += `Selected Audit Dates,${selectedDates.join('; ')}\n\n`;
      csvContent += `Operational Metrics,Count / Value\n`;
      csvContent += `Total Stay Arrivals,${checkedInSelected.length} Guests\n`;
      csvContent += `Total Departures Settled,${checkedOutSelected.length} Guests\n`;
      csvContent += `Total Receipts Collected,₹${totalPaymentsSelected}\n`;
      csvContent += `Total Online Receipts,₹${totalOnlineCollectedSelected}\n`;
      csvContent += `Total Cash Receipts,₹${totalCashCollectedSelected}\n\n`;
      
      csvContent += "CHRONOLOGICAL ARRIVALS REGISTER\n";
      csvContent += "Check-In Date,Guest Name,Room Number,Mobile Contact,Identity Credentials\n";
      checkedInSelected.forEach(c => {
        csvContent += `"${c.checkInDate}","${c.guestName}","Room ${c.roomNumber}","${c.mobile}","${c.idType || 'Aadhaar'}: ${c.idNumber || c.aadhaarNumber || 'N/A'}"\n`;
      });
      
      csvContent += "\nCHRONOLOGICAL DEPARTURES REGISTER\n";
      csvContent += "Departure Date,Guest Name,Room Number,Mobile Contact,Pending Balance\n";
      checkedOutSelected.forEach(c => {
        csvContent += `"${c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate}","${c.guestName}","Room ${c.roomNumber}","${c.mobile}",₹${c.pendingAmount ?? 0}\n`;
      });
    } else if (reportType === 'pendingReport') {
      csvContent += "DIRECTSTAY GRAND RESORT,PENDING RECEIVABLES AUDIT REPORT\n\n";
      csvContent += `Active Stay Dues,₹${totalOutstandingActiveDues}\n`;
      csvContent += `Historical Checked-Out Dues,₹${totalOutstandingHistoricalDues}\n`;
      csvContent += `Total Overall Outstanding,₹${totalOutstandingActiveDues + totalOutstandingHistoricalDues}\n\n`;

      csvContent += "ACTIVE GUEST OUTSTANDING RECEIVABLES\n";
      csvContent += "Guest Name,Room Number,Stay Dates,Mobile,Total Bill,Paid Amount,Pending Dues\n";
      activePendingGuests.forEach(c => {
        const due = c.pendingAmount ?? (c.totalAmount - c.advanceAmount);
        csvContent += `"${c.guestName}","Room ${c.roomNumber}","${c.checkInDate} to ${c.checkOutDate}","${c.mobile}",₹${c.totalAmount},₹${c.totalAmount - due},₹${due}\n`;
      });

      csvContent += "\nHISTORICAL CHECKED OUT OUTSTANDING RECEIVABLES\n";
      csvContent += "Guest Name,Room Number,Check-Out Date,Mobile,Unresolved Balance\n";
      checkedOutPendingGuests.forEach(c => {
        csvContent += `"${c.guestName}","Room ${c.roomNumber}","${c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate}","${c.mobile}",₹${c.pendingAmount ?? 0}\n`;
      });
    } else if (reportType === 'otaReport') {
      csvContent += "DIRECTSTAY GRAND RESORT,OTA CHANNELS COMMISSION & REVENUE STATEMENT\n";
      csvContent += `Audit Period,${computedRangeStart} to ${computedRangeEnd}\n\n`;
      csvContent += "OTA Platform Platform Name,Reservations Volume,Gross Tariffs Collected,Agency Commission Deducted (15%),Net Realized Revenue\n";
      otaSummary.forEach(row => {
        csvContent += `"${row.source}",${row.count} Bookings,₹${row.totalRevenue},₹${row.commissionPaid},₹${row.netRevenue}\n`;
      });
    } else if (reportType === 'gstReport') {
      csvContent += "DIRECTSTAY GRAND RESORT,INDIA GST-1 RETURN LEDGER FILE\n";
      csvContent += `Filing Month,${taxMonth}\n\n`;
      csvContent += "Taxable category & Slab,Turnover Base (INR),Central CGST Pool,State SGST Pool,Grand Tax Collected\n";
      csvContent += `"Room Lodging (5% Budget)","${lodgingTaxableSum5}","${lodgingCGST5}","${lodgingSGST5}","${lodgingCGST5 + lodgingSGST5}"\n`;
      csvContent += `"Room Lodging (18% Luxury)","${lodgingTaxableSum18}","${lodgingCGST18}","${lodgingSGST18}","${lodgingCGST18 + lodgingSGST18}"\n`;
      csvContent += `"Kitchen Food Meals (5%)","${foodTaxableSum}","${foodCGST}","${foodSGST}","${foodCGST + foodSGST}"\n`;
      csvContent += `"Ancillary Services (18%)","${ancillaryTaxableSum}","${ancillaryCGST}","${ancillarySGST}","${ancillaryCGST + ancillarySGST}"\n`;
      csvContent += `"MONTHLY FILING TOTALS","${lodgingTaxableSum + foodTaxableSum + ancillaryTaxableSum}","${totalLodgingCGST + foodCGST + ancillaryCGST}","${totalLodgingSGST + foodSGST + ancillarySGST}","${totalGstInvoicesCollected}"\n`;
    } else if (reportType === 'revenueReport') {
      csvContent += "DIRECTSTAY GRAND RESORT,REVENUE JOURNAL AND OPERATIONS AUDIT\n\n";
      csvContent += "Reference Date,Estimated Lodging,Payments Collected,Billed Turnover,GST Collected,Discounts Allowed,Expenses Paid\n";
      dailyRevenueLogs.forEach(row => {
        csvContent += `"${row.date}",₹${row.baseLodgingVal},₹${row.totalPaymentsReceived},₹${row.totalBilledValue},₹${row.gstCollected},₹${row.discountAllowed},₹${row.totalExpenses}\n`;
      });
    } else if (reportType === 'sarai') {
      csvContent += `${(hotelSettings as any)?.hotelName || hotelSettings?.name || 'DIRECTSTAY GRAND RESORT'},REGULATORY POLICE SARAI ACT REGISTRY\n`;
      csvContent += `Audit Date Range,${computedRangeStart} to ${computedRangeEnd}\n\n`;
      csvContent += "S.No,Guest Full Name,Origin Address,Nationality,ID Credentials,Arrival Date,Departure Date,Room,Companions\n";
      
      const saraiGuests = checkins.filter(c => {
        const inDateStr = (c.checkInDate || '').substring(0, 10);
        const outDateStr = (c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate || inDateStr).substring(0, 10);
        return selectedDates.some(d => inDateStr <= d && outDateStr >= d) || (inDateStr >= computedRangeStart && inDateStr <= computedRangeEnd);
      });
      saraiGuests.forEach((c, idx) => {
        const outDateStr = c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate;
        csvContent += `${idx + 1},"${c.guestName}","${c.address || ''} ${c.city || ''} ${c.state || ''}","${c.nationality || 'Indian'}","${c.idType || 'Aadhaar'}: ${c.idNumber || c.aadhaarNumber || 'N/A'}","${c.checkInDate}","${outDateStr || ''}","Room ${c.roomNumber}",${c.secondaryGuests?.length || 0}\n`;
      });
    } else if (reportType === 'waterLogs') {
      csvContent += "DIRECTSTAY GRAND RESORT,DAILY WATER CONSUMPTION LOG AUDIT\n";
      csvContent += `Audit Period,${computedRangeStart} to ${computedRangeEnd}\n\n`;
      csvContent += "Filing Date,Room Number,Bottles Issued,Duty Officer Sign\n";
      waterBottlesSelected.forEach(record => {
        csvContent += `"${record.date}","Room ${record.roomNumber}",${record.quantity},"Duty Officer Signature"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Construct Polite WhatsApp Reminder Draft
  const getWhatsAppReminderText = (c: GuestCheckIn) => {
    const due = c.pendingAmount ?? (c.totalAmount - c.advanceAmount);
    return `Dear ${c.guestName},\n\nWarm greetings from DirectStay Grand Resort.\n\nWe hope you are enjoying your stay in Room ${c.roomNumber} (Stay: ${c.checkInDate} to ${c.checkOutDate}).\n\nThis is a friendly reminder that your guest ledger account currently holds an outstanding balance of *₹${due.toLocaleString()}*.\n\nWe kindly request you to stop by the front reception desk or settle this balance online at your earliest convenience.\n\nIf you have already processed this payment, please disregard this note.\n\nThank you for choosing DirectStay.\n\nSincerely,\nGuest Services Management\nDirectStay Grand Resort`;
  };

  const handleCopyReminder = (c: GuestCheckIn) => {
    const text = getWhatsAppReminderText(c);
    navigator.clipboard.writeText(text);
    setCopiedReminderId(c.id);
    setTimeout(() => setCopiedReminderId(null), 3000);
  };

  // Filter list of cash transactions by search string
  const filteredCashPayments = cashPaymentsSelected.filter(item => {
    const searchLower = ledgerSearch.toLowerCase();
    return (
      item.checkin.guestName.toLowerCase().includes(searchLower) ||
      item.checkin.roomNumber.toLowerCase().includes(searchLower) ||
      (item.payment.notes || '').toLowerCase().includes(searchLower) ||
      item.payment.paymentType.toLowerCase().includes(searchLower)
    );
  });


  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* ----------------- BRANDING HEADER (PRINT ONLY) ----------------- */}
      <div className="hidden print:block mb-6 border-b-2 border-luxury-brown-900 pb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif text-luxury-brown-900 font-bold tracking-tight">DirectStay Grand Resort</h1>
            <p className="text-[10px] uppercase font-mono tracking-widest text-luxury-gold-600 font-bold mt-1">Official Management Audit & Compliance Statement</p>
          </div>
          <div className="text-right text-[10px] font-mono text-gray-600">
            <p>System Time: {new Date().toLocaleString()}</p>
            <p>Audit Mode: Live Database Pull</p>
            <p>Audit Officer: Duty Manager</p>
          </div>
        </div>
      </div>

      {/* ----------------- TAB SELECTOR (NO PRINT) ----------------- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-luxury-beige-100 pb-4 no-print gap-4">
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold block mb-1">DirectStay Financial Intelligence</span>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide">Operations Audit & Compliance Reports</h1>
          <p className="text-xs text-luxury-brown-500">Examine daily ledger journals, audit night reconciliations, track pending guest payments, and download tax GST files.</p>
        </div>

        {/* Categories Scroller */}
        <div className="flex flex-wrap gap-1 p-1 bg-luxury-beige-100/60 rounded-xl max-w-full border">
          {[
            { id: 'dailyCollectionSheet', label: 'Daily Collection Sheet (Manager)', icon: FileSpreadsheet, color: 'text-amber-600', isHighlight: true },
            { id: 'cashReport', label: 'Daily Cash', icon: DollarSign, color: 'text-emerald-600' },
            { id: 'nightAudit', label: 'Night Audit', icon: Clock, color: 'text-indigo-600' },
            { id: 'pendingReport', label: 'Pending Dues', icon: ShieldAlert, color: 'text-rose-600' },
            { id: 'otaReport', label: 'OTA Payments', icon: Activity, color: 'text-blue-500' },
            { id: 'gstReport', label: 'GST Tax', icon: Receipt, color: 'text-amber-600' },
            { id: 'revenueReport', label: 'Revenue Journal', icon: TrendingUp, color: 'text-emerald-700' },
            { id: 'sarai', label: 'Police Sarai', icon: Landmark, color: 'text-luxury-brown-600' },
            { id: 'waterLogs', label: 'Water Logs', icon: GlassWater, color: 'text-sky-500' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setReportType(tab.id as ReportType);
                setLedgerSearch('');
              }}
              className={`px-3 py-2 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                reportType === tab.id 
                  ? 'bg-luxury-brown-950 text-white font-bold shadow-xs' 
                  : 'text-luxury-brown-700 hover:bg-white/60'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${reportType === tab.id ? 'text-luxury-gold-400' : tab.color}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ----------------- SYSTEM DATE TOGGLE & INFO (NO PRINT) ----------------- */}
      <div className="bg-luxury-beige-50/50 border border-luxury-beige-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-luxury-gold-600" />
          <div className="text-xs">
            <p className="font-bold text-luxury-brown-950">Active Database Clock Reference</p>
            <p className="text-luxury-brown-500">All reports are generated based on this reference "Today" date.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-luxury-brown-700 font-mono">Custom Ref:</span>
            <input
              type="date"
              value={refTodayDate}
              onChange={(e) => setRefTodayDate(e.target.value)}
              className="px-2.5 py-1.5 border border-luxury-brown-200 bg-white rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
            />
          </div>
        </div>
      </div>

      {/* ----------------- DYNAMIC FILTERS PANEL (NO PRINT) ----------------- */}
      <div className="bg-white border rounded-xl p-5 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          {/* Preset Buttons */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Report Filter Preset</span>
            <div className="flex flex-wrap gap-1 bg-gray-100 p-0.5 rounded-lg border">
              {[
                { id: 'today', label: 'Today Only' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'thisWeek', label: 'This Week' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'custom', label: 'Custom Date Range' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setDateFilterPreset(preset.id as any);
                    setExcludedDates([]); // reset exclusions
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    dateFilterPreset === preset.id
                      ? 'bg-white text-luxury-brown-950 font-bold shadow-xs border'
                      : 'text-gray-600 hover:text-luxury-brown-950'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date-to-Date Range Inputs (Always visible so any report can be filtered & exported From Date to To Date) */}
          <div className="flex items-center gap-3 bg-luxury-beige-50 p-2.5 rounded-lg border border-luxury-gold-300/60">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-mono font-bold text-luxury-brown-700">From Date</span>
              <input
                type="date"
                value={computedRangeStart}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomStartDate(val);
                  if (dateFilterPreset !== 'custom') {
                    setCustomEndDate(computedRangeEnd >= val ? computedRangeEnd : val);
                  } else if (customEndDate < val) {
                    setCustomEndDate(val);
                  }
                  setDateFilterPreset('custom');
                  setExcludedDates([]);
                }}
                className="px-2 py-1 border rounded-md text-xs font-mono bg-white focus:outline-none"
              />
            </div>
            <ChevronRight className="w-4 h-4 text-luxury-brown-400 mt-3" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-mono font-bold text-luxury-brown-700">To Date</span>
              <input
                type="date"
                value={computedRangeEnd}
                onChange={(e) => {
                  const val = e.target.value;
                  if (dateFilterPreset !== 'custom') {
                    setCustomStartDate(computedRangeStart <= val ? computedRangeStart : val);
                  } else if (customStartDate > val) {
                    setCustomStartDate(val);
                  }
                  setCustomEndDate(val);
                  setDateFilterPreset('custom');
                  setExcludedDates([]);
                }}
                className="px-2 py-1 border rounded-md text-xs font-mono bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* GST Specific selection */}
          {reportType === 'gstReport' && (
            <div className="flex flex-col bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
              <span className="text-[9px] uppercase font-mono text-amber-800 font-bold">Select Active Tax Filing Month</span>
              <input
                type="month"
                value={taxMonth}
                onChange={(e) => setTaxMonth(e.target.value)}
                className="px-2 py-1 border border-amber-200 bg-white rounded-md text-xs font-mono focus:outline-none mt-1"
              />
            </div>
          )}

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 self-stretch lg:self-auto">
            <button 
              onClick={handleExportPDF}
              className="flex-1 lg:flex-none px-4 py-2 border rounded-lg text-xs font-bold font-sans bg-white hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-luxury-brown-300 text-luxury-brown-900"
            >
              <Printer className="w-4 h-4 text-[#9E2A2B]" /> 
              Print PDF
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex-1 lg:flex-none px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-luxury-gold-400" /> 
              Export Excel
            </button>
          </div>

        </div>

        {/* ----------------- MULTIPLE DATES SELECTOR / COMPLIANCE (NO PRINT) ----------------- */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-luxury-brown-500 block">Select Multiple Dates to Include in Audit Report</span>
              <p className="text-[11px] text-luxury-brown-500">
                Currently analyzing <strong className="text-luxury-brown-950">{selectedDates.length} of {datesInRange.length}</strong> dates in range ({computedRangeStart} to {computedRangeEnd}).
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={selectAllDates}
                className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono rounded cursor-pointer"
              >
                ✓ Select All
              </button>
              <button 
                onClick={deselectAllDates}
                className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono rounded cursor-pointer"
              >
                ✗ Deselect All
              </button>
            </div>
          </div>

          {/* Date Pills Scrolling Selection Wrapper */}
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-luxury-brown-50/50 rounded-xl border border-luxury-brown-100 scrollbar">
            {datesInRange.map(date => {
              const isSelected = !excludedDates.includes(date);
              return (
                <button
                  key={date}
                  onClick={() => toggleDateSelection(date)}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold' 
                      : 'bg-white border-gray-200 text-gray-400 font-medium hover:border-gray-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                  {date}
                </button>
              );
            })}
          </div>
        </div>

      </div>


      {/* ========================================================================= */}
      {/* 0. DAILY RECEPTION COLLECTION & SETTLEMENT SHEET (RAGHUNATH SIR FORMAT) */}
      {/* ========================================================================= */}
      {reportType === 'dailyCollectionSheet' && (
        <DailyCollectionSheet
          rooms={rooms}
          bookings={bookings}
          checkins={checkins}
          invoices={invoices}
          expenses={expenses}
          posOrders={posOrders}
          handovers={handovers}
          staff={staff}
          hotelSettings={hotelSettings}
          onEditCheckout={onEditCheckout}
        />
      )}

      {/* ========================================================================= */}
      {/* ==================== 1. DAILY CASH REPORT PANEL ========================= */}
      {/* ========================================================================= */}
      {reportType === 'cashReport' && (
        <div className="space-y-6 print:space-y-6">
          
          {/* Header section (Print styled) */}
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">I. Daily Cash Drawer & Vault Reconciliation</h2>
            <p className="text-[10px] text-gray-600">Audit interval from {computedRangeStart} to {computedRangeEnd}. Analysis conducted across {selectedDates.length} selected working dates.</p>
          </div>

          {/* KPI Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs">
              <span className="text-gray-400 text-[10px] uppercase block font-mono">Opening Cash Balance</span>
              <span className="text-xl font-bold font-serif text-luxury-brown-950 mt-1 block">₹{netCashOpeningBalance.toLocaleString()}</span>
              <span className="text-[9px] text-emerald-700 italic font-mono block">Prior cumulative floor</span>
            </div>
            <div className="bg-white border border-emerald-200 p-4 rounded-xl text-center shadow-2xs">
              <span className="text-emerald-600 text-[10px] uppercase block font-mono">Cash Collected (Inflow)</span>
              <span className="text-xl font-bold font-serif text-emerald-700 mt-1 block">₹{totalCashCollectedSelected.toLocaleString()}</span>
              <span className="text-[9px] text-gray-400 block">{cashPaymentsSelected.length} receipt events</span>
            </div>
            <div className="bg-white border border-blue-200 p-4 rounded-xl text-center shadow-2xs">
              <span className="text-blue-600 text-[10px] uppercase block font-mono">UPI Collected</span>
              <span className="text-xl font-bold font-serif text-blue-700 mt-1 block">₹{totalUpiCollectedSelected.toLocaleString()}</span>
              <span className="text-[9px] text-gray-400 block">{upiPaymentsSelected.length} digital UPI receipts</span>
            </div>
            <div className="bg-white border border-rose-200 p-4 rounded-xl text-center shadow-2xs">
              <span className="text-rose-600 text-[10px] uppercase block font-mono">Cash Expenses (Outflow)</span>
              <span className="text-xl font-bold font-serif text-rose-700 mt-1 block">₹{totalCashExpensesSelected.toLocaleString()}</span>
              <span className="text-[9px] text-gray-400 block">{cashExpensesSelected.length} logged payouts</span>
            </div>
            <div className="bg-white border border-luxury-gold-500/30 p-4 rounded-xl text-center shadow-2xs bg-amber-50/10">
              <span className="text-luxury-brown-950 text-[10px] uppercase block font-mono">Expected Drawer Cash</span>
              <span className="text-xl font-bold font-serif text-luxury-brown-950 mt-1 block">₹{netCashInDrawer.toLocaleString()}</span>
              <span className="text-[9px] text-luxury-gold-700 font-semibold block">Opening + Inflow - Outflow</span>
            </div>
          </div>

          {/* Reconciliation Ledger Logic & Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-4">
            
            {/* Reconciliation summary card */}
            <div className="bg-white border rounded-2xl p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-luxury-brown-950 border-b pb-2 flex justify-between items-center">
                <span>Cash Drawer Activity Statement</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold">Audited Ledger</span>
              </h3>
              <div className="text-xs space-y-2 font-mono">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">A. Base Floor Cash Reserve (Initial starting desk vault):</span>
                  <span>₹{INITIAL_DESK_VAULT.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">B. Cumulative Past Cash Inflows (Prior to {earliestSelectedDate}):</span>
                  <span className="text-emerald-700">+₹{totalCashCollectedBefore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">C. Cumulative Past Cash Expenses (Prior to {earliestSelectedDate}):</span>
                  <span className="text-rose-700">-₹{totalCashExpensesBefore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b bg-slate-50 p-2 rounded">
                  <span className="font-bold text-luxury-brown-950 text-[11px]">D. Opening Cash Balance on Audit Start:</span>
                  <span className="font-bold text-luxury-brown-950">₹{netCashOpeningBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">E. Period Cash Inflows (In Selected Range):</span>
                  <span className="text-emerald-700 font-bold">+₹{totalCashCollectedSelected.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">F. Period Cash Outflows (In Selected Range):</span>
                  <span className="text-rose-700 font-bold">-₹{totalCashExpensesSelected.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2.5 border-t border-double bg-luxury-beige-100/40 p-2.5 rounded">
                  <span className="font-bold text-luxury-brown-950">G. AUDITED NET CLOSING DRAWER CASH (D + E - F):</span>
                  <span className="font-bold text-base text-[#9E2A2B]">₹{netCashInDrawer.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Inflow/Outflow summary and chart overview */}
            <div className="bg-white border rounded-2xl p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-luxury-brown-950 border-b pb-2 flex justify-between items-center">
                <span>Revenue Payment Channels Summary</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold">Total Intake</span>
              </h3>
              <div className="text-xs space-y-3">
                <p className="text-luxury-brown-500 leading-relaxed text-[11px]">
                  All check-ins and billing transactions aggregated across selected active days.
                </p>
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between p-2 rounded bg-emerald-50/50 border border-emerald-100">
                    <span className="font-sans font-medium text-emerald-800">Physical Cash Inflows:</span>
                    <span className="font-bold text-emerald-700">₹{totalCashCollectedSelected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-blue-50/50 border border-blue-100">
                    <span className="font-sans font-medium text-blue-800">Digital UPI Apps (GPay/PhonePe):</span>
                    <span className="font-bold text-blue-700">₹{totalUpiCollectedSelected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-purple-50/50 border border-purple-100">
                    <span className="font-sans font-medium text-purple-800">Card Terminals & Bank Wire:</span>
                    <span className="font-bold text-purple-700">₹{totalOtherOnlineCollectedSelected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-luxury-brown-950 text-white font-sans font-bold">
                    <span>Grand Total Income (All channels):</span>
                    <span className="font-mono text-luxury-gold-400 text-sm">₹{(totalCashCollectedSelected + totalUpiCollectedSelected + totalOtherOnlineCollectedSelected).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Day-by-Day Cash Drawer Audit Log */}
          {selectedDates.length > 1 && (
            <div className="bg-white border rounded-2xl p-5 shadow-2xs">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-luxury-brown-950 mb-3 border-b pb-2">
                📂 Chronological Day-by-Day Cash Drawer Reconciliation
              </h3>
              <div className="overflow-x-auto text-xs font-mono">
                <table className="w-full text-left divide-y border">
                  <thead className="bg-slate-50 uppercase text-[10px] font-bold text-gray-600">
                    <tr>
                      <th className="p-3">Reference Date</th>
                      <th className="p-3 text-right">Opening Balance</th>
                      <th className="p-3 text-right text-emerald-700">Cash Inflows (+)</th>
                      <th className="p-3 text-right text-rose-700">Cash Outflows (-)</th>
                      <th className="p-3 text-right font-bold">Expected Closing Balance</th>
                      <th className="p-3 text-center">Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-luxury-brown-900">
                    {dayByDayCashLogs.map(row => (
                      <tr key={row.date} className="hover:bg-slate-50">
                        <td className="p-3 font-bold">{row.date}</td>
                        <td className="p-3 text-right">₹{row.opening.toLocaleString()}</td>
                        <td className="p-3 text-right text-emerald-700">+₹{row.inflow.toLocaleString()}</td>
                        <td className="p-3 text-right text-rose-700">-₹{row.outflow.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-luxury-brown-950">₹{row.closing.toLocaleString()}</td>
                        <td className="p-3 text-center text-gray-500">{row.entriesCount} entries</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Itemized Cash Ledger */}
          <div className="bg-white border rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 border-b pb-2">
              <h3 className="text-sm font-serif font-bold text-luxury-brown-950">Itemized Physical Cash Transactions Ledger</h3>
              <div className="relative w-full sm:w-64 no-print">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter cash table..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs focus:outline-none bg-white font-mono"
                />
              </div>
            </div>
            {filteredCashPayments.length === 0 ? (
              <p className="text-xs italic text-gray-400 text-center py-6">No cash transactions match the selected dates/search filter.</p>
            ) : (
              <div className="overflow-x-auto text-xs font-mono">
                <table className="w-full text-left divide-y">
                  <thead className="bg-slate-50 uppercase text-[10px] font-bold text-gray-600">
                    <tr>
                      <th className="p-3">Receipt Time</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Guest Name</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Payment Category</th>
                      <th className="p-3">Reference Notes</th>
                      <th className="p-3 text-right">Cash Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCashPayments.map(item => (
                      <tr key={item.payment.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-gray-500">{new Date(item.payment.dateTime).toLocaleTimeString()}</td>
                        <td className="p-3 text-gray-700 font-bold">{item.payment.dateTime.substring(0, 10)}</td>
                        <td className="p-3 font-sans font-bold text-luxury-brown-950">{item.checkin.guestName}</td>
                        <td className="p-3 font-bold text-luxury-brown-900">Room {item.checkin.roomNumber}</td>
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700">
                            {item.payment.paymentType}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 italic max-w-xs truncate">{item.payment.notes || '-'}</td>
                        <td className="p-3 text-right font-bold text-emerald-700">₹{Number(item.payment.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* ===================== 2. NIGHT AUDIT REPORT PANEL ======================== */}
      {/* ========================================================================= */}
      {reportType === 'nightAudit' && (
        <div className="space-y-6">
          
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">II. End of Day Night Audit & Operations Summary</h2>
            <p className="text-[10px] text-gray-600">Reconciliation interval from {computedRangeStart} to {computedRangeEnd}. Analysis conducted across {selectedDates.length} selected working dates.</p>
          </div>

          {(() => {
            const selectedCashExpenses = expenses.filter(e => {
              const isSelected = selectedDates.includes(e.date);
              const isCash = (e.paymentMethod === 'Cash' || (e as any).paymentMode === 'Cash');
              return isSelected && isCash;
            }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const openingCashFloat = 5000;
            const expectedClosingDrawerCash = openingCashFloat + totalCashCollectedSelected - selectedCashExpenses;

            return (
              <>
                {/* Night Audit Operational Action Bar */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-indigo-900/60 no-print">
                  <div>
                    <span className="text-[10.5px] font-mono text-indigo-300 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                      🌙 Operational Night Audit &amp; Cash Drawer Reconciliation
                    </span>
                    <h3 className="text-base font-serif font-bold text-white mt-0.5">
                      Daily Business Closing &amp; Cashier Reconciliation
                    </h3>
                    <p className="text-xs text-slate-300">
                      Balance front-desk cash drawer, verify ledger postings, reconcile discrepancies, and close the business day.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuditCountedCash(expectedClosingDrawerCash);
                      setShowNightAuditModal(true);
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>🌙 Run Night Audit / Close Day</span>
                  </button>
                </div>

                {auditSuccessBanner && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-mono font-bold flex items-center justify-between">
                    <span>{auditSuccessBanner}</span>
                    <button type="button" onClick={() => setAuditSuccessBanner(null)} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">✕</button>
                  </div>
                )}

                {/* Cash Drawer Reconciliation Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block font-bold">1. Opening Cash Float</span>
                    <span className="text-lg font-serif font-bold text-slate-900 mt-0.5 block">₹{openingCashFloat.toLocaleString()}</span>
                    <span className="text-[9.5px] text-slate-400 block">Drawer float balance</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-mono uppercase text-emerald-700 block font-bold">2. Pure Cash Inflows (+)</span>
                    <span className="text-lg font-serif font-bold text-emerald-700 mt-0.5 block">+₹{totalCashCollectedSelected.toLocaleString()}</span>
                    <span className="text-[9.5px] text-emerald-600 block">Stays &amp; front-desk cash</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-mono uppercase text-rose-700 block font-bold">3. Petty Cash Outflows (-)</span>
                    <span className="text-lg font-serif font-bold text-rose-700 mt-0.5 block">-₹{selectedCashExpenses.toLocaleString()}</span>
                    <span className="text-[9.5px] text-rose-600 block">Cash expenses in period</span>
                  </div>
                  <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-2xs">
                    <span className="text-[10px] font-mono uppercase text-amber-400 block font-bold">4. Expected Drawer Cash</span>
                    <span className="text-lg font-serif font-bold text-white mt-0.5 block">₹{expectedClosingDrawerCash.toLocaleString()}</span>
                    <span className="text-[9.5px] text-slate-300 block">System calculated total</span>
                  </div>
                </div>

                {/* Night Audit Modal */}
                {showNightAuditModal && (
                  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-indigo-700 block">
                            Night Audit Finalization
                          </span>
                          <h3 className="text-base font-serif font-bold text-slate-900">
                            Close Business Day &amp; Verify Cash
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowNightAuditModal(false)}
                          className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 font-mono">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Audit Closing Date:</span>
                            <strong className="text-slate-900 text-xs">{computedRangeEnd || refTodayDate}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Expected Drawer Cash:</span>
                            <strong className="text-slate-900 text-xs">₹{expectedClosingDrawerCash.toLocaleString()}</strong>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-mono font-bold text-slate-700 block uppercase">
                            Actual Cash Counted in Drawer (₹) *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={auditCountedCash}
                            onChange={(e) => setAuditCountedCash(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm text-slate-900"
                          />
                        </div>

                        {(() => {
                          const counted = Number(auditCountedCash) || 0;
                          const diff = counted - expectedClosingDrawerCash;
                          return (
                            <div className={`p-2.5 rounded-lg border font-mono text-xs flex justify-between items-center ${
                              diff === 0
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : diff > 0
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                            }`}>
                              <span>Cash Variance:</span>
                              <strong>
                                {diff === 0 ? '✓ Balanced (₹0 Variance)' : diff > 0 ? `+₹${diff.toLocaleString()} (Excess Cash)` : `-₹${Math.abs(diff).toLocaleString()} (Cash Shortage)`}
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
                            value={auditRemarks}
                            onChange={(e) => setAuditRemarks(e.target.value)}
                            placeholder="e.g. All rooms reconciled. Shift handover complete."
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
                            const counted = Number(auditCountedCash) || 0;
                            const diff = counted - expectedClosingDrawerCash;
                            const timestamp = new Date().toISOString();
                            try {
                              sessionStorage.setItem('directstay_last_night_audit', timestamp);
                              sessionStorage.setItem('directstay_last_audit_cash', String(counted));
                            } catch (_) {}
                            setShowNightAuditModal(false);
                            setAuditSuccessBanner(
                              `✓ Business Day Successfully Closed (Night Audit Run). Audit Date: ${computedRangeEnd || refTodayDate} | Counted Cash: ₹${counted.toLocaleString()} | Variance: ${diff === 0 ? 'Balanced' : `₹${diff}`} | Tariff Deviations: ${tariffDeviations.length} | Food Deviations: ${foodDeviations.length}`
                            );
                            showToast(
                              `Night Audit Complete for ${computedRangeEnd || refTodayDate}! Drawer Cash: ₹${counted.toLocaleString()} (${diff === 0 ? 'Balanced' : `Variance ₹${diff}`}).`,
                              'success'
                            );
                          }}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                        >
                          Confirm &amp; Close Business Day
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs">
              <span className="text-gray-400 text-[10px] uppercase font-mono block">Arrivals (Check-Ins)</span>
              <span className="text-xl font-bold font-serif text-luxury-brown-950 block mt-1">{checkedInSelected.length} Stays</span>
              <span className="text-[9px] text-gray-400 block">Checked-in in selected dates</span>
            </div>
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs">
              <span className="text-gray-400 text-[10px] uppercase font-mono block">Departures (Checkouts)</span>
              <span className="text-xl font-bold font-serif text-luxury-brown-950 block mt-1">{checkedOutSelected.length} Departures</span>
              <span className="text-[9px] text-gray-400 block">Finalized out of system</span>
            </div>
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs border-emerald-100">
              <span className="text-emerald-600 text-[10px] uppercase font-mono block">Total Revenue Intake</span>
              <span className="text-xl font-bold font-serif text-emerald-700 block mt-1">₹{totalPaymentsSelected.toLocaleString()}</span>
              <span className="text-[9px] text-gray-500 block">Cash: ₹{totalCashCollectedSelected.toLocaleString()} | Online: ₹{totalOnlineCollectedSelected.toLocaleString()}</span>
            </div>
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs">
              <span className="text-gray-400 text-[10px] uppercase font-mono block">Occupancy snapshot</span>
              <span className="text-xs font-mono font-bold block mt-1.5 text-luxury-brown-900">
                {occupiedRoomsCount} Occ / {dirtyRoomsCount} Dirty / {availableRoomsCount} Avail
              </span>
              <span className="text-[9px] text-luxury-gold-700 font-semibold block">Active Housekeeping States</span>
            </div>
          </div>

          <DirtyRoomsPanel rooms={rooms} checkins={checkins} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Arrivals register */}
            <div className="bg-white border rounded-2xl p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-luxury-brown-950 border-b pb-2 flex justify-between items-center">
                <span>Arrival Register (Check-Ins in selected range)</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold">Inflow Log</span>
              </h3>
              {checkedInSelected.length === 0 ? (
                <p className="text-xs italic text-gray-400 text-center py-6">No arrivals recorded in selected range.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto scrollbar">
                  <ul className="divide-y text-xs space-y-2">
                    {checkedInSelected.map(c => (
                      <li key={c.id} className="pt-2 flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-luxury-brown-950">{c.guestName}</span>
                            <span className="text-[9px] px-1 bg-slate-100 text-gray-500 rounded font-mono">ID: {c.idType || 'Aadhaar'}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 block mt-0.5">Contact: {c.mobile} | Aadhaar: {c.aadhaarNumber || 'N/A'}</span>
                          <span className="text-[10px] text-luxury-gold-600 block font-mono">Checked In: {c.checkInDate} | Out Expected: {c.checkOutDate}</span>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 bg-luxury-beige-100 text-luxury-brown-950 rounded text-[10px] font-bold font-mono">Room {c.roomNumber}</span>
                          <span className="text-[10px] block text-emerald-700 font-bold mt-1">₹{Number(c.roomRate || 0).toLocaleString()}/N</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Departures register */}
            <div className="bg-white border rounded-2xl p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-luxury-brown-950 border-b pb-2 flex justify-between items-center">
                <span>Departures & Settlements (Checkouts in selected range)</span>
                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold">Outflow Log</span>
              </h3>
              {checkedOutSelected.length === 0 ? (
                <p className="text-xs italic text-gray-400 text-center py-6">No departures finalized in selected range.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto scrollbar">
                  <ul className="divide-y text-xs space-y-2">
                    {checkedOutSelected.map(c => (
                      <li key={c.id} className="pt-2 flex justify-between items-start">
                        <div>
                          <span className="font-bold text-luxury-brown-950 block">{c.guestName}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">Checked out with final invoice billing.</span>
                          <span className="text-[10px] text-luxury-gold-600 block font-mono">Checked Out On: {c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate}</span>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold font-mono block">Room {c.roomNumber}</span>
                          <span className="text-[10px] text-emerald-700 font-bold block mt-1">Settled</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

          {/* Point 5: Night Audit Room Tariff & Food Price Deviation Register */}
          <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="border-b border-amber-100 pb-3 flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Room Tariff &amp; Food Price Deviation Report (Fixed vs Charged Audit)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tracks every deviation in Check-In Room Tariffs (plus separate discounts) and KOT Food Item Prices / GST Exclusions from fixed catalog rates.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-mono font-bold">
                  Room Deviations: {tariffDeviations.length} (-₹{totalTariffConcession.toLocaleString('en-IN')}{totalTariffUpsell > 0 ? ` / +₹${totalTariffUpsell.toLocaleString('en-IN')}` : ''})
                </span>
                <span className="px-2.5 py-1 bg-orange-50 text-orange-900 border border-orange-200 rounded-lg text-xs font-mono font-bold">
                  Food KOT Deviations: {foodDeviations.length} (-₹{totalFoodConcession.toLocaleString('en-IN')})
                </span>
                {gstExcludedKotOrders.length > 0 && (
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs font-mono font-bold">
                    GST-Excluded KOTs: {gstExcludedKotOrders.length}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Room Tariff & Discount Deviations Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold font-mono uppercase text-slate-800">1. Room Tariff &amp; Discount Deviations</h4>
                  <span className="text-[10px] text-slate-600 font-mono font-bold">
                    Total Concession: ₹{totalTariffConcession.toLocaleString('en-IN')}
                  </span>
                </div>
                {tariffDeviations.length === 0 ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-700">
                    ✓ All stays in selected dates were billed at fixed catalog rack tariff with ₹0 extra discount.
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
                        {tariffDeviations.map(d => (
                          <tr key={d.id} className="hover:bg-amber-50/30">
                            <td className="p-2">
                              <div className="font-bold text-slate-900">{d.guestName} (Rm {d.roomNumber})</div>
                              <div className="text-[9.5px] font-mono text-slate-500">
                                {d.date} • {d.nights}N • By: {d.staffName}
                              </div>
                            </td>
                            <td className="p-2 text-right font-mono text-slate-600">₹{d.standardRate.toLocaleString('en-IN')}/N</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">₹{d.chargedRate.toLocaleString('en-IN')}/N</td>
                            <td className="p-2 text-right font-mono text-amber-800">
                              {d.discountAmount > 0 ? `-₹${d.discountAmount.toLocaleString('en-IN')}` : '₹0'}
                            </td>
                            <td className="p-2 text-right font-mono font-bold">
                              <span className={d.netVariance < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                {d.netVariance < 0
                                  ? `-₹${Math.abs(d.netVariance).toLocaleString('en-IN')}`
                                  : `+₹${d.netVariance.toLocaleString('en-IN')}`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. Food & Beverage KOT Price & GST Deviations Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold font-mono uppercase text-slate-800">2. Food Item Price &amp; KOT GST Deviations</h4>
                  <span className="text-[10px] text-slate-600 font-mono font-bold">
                    Price Deviations: {foodDeviations.length} | Non-GST KOTs: {gstExcludedKotOrders.length}
                  </span>
                </div>
                {foodDeviations.length === 0 && gstExcludedKotOrders.length === 0 ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-700">
                    ✓ All KOT food items in selected dates were billed at fixed menu prices with standard GST.
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
                              <tr key={idx} className="hover:bg-orange-50/30">
                                <td className="p-2">
                                  <div className="font-bold text-slate-900">
                                    {f.itemName} × {f.quantity}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-500">
                                    #{f.orderNumber} • {f.guestLabel} {f.isWithoutGst ? '• [GST Excluded]' : ''}
                                  </div>
                                </td>
                                <td className="p-2 text-right font-mono text-slate-600">₹{f.menuPrice.toLocaleString('en-IN')}</td>
                                <td className="p-2 text-right font-mono font-bold text-slate-900">₹{f.chargedPrice.toLocaleString('en-IN')}</td>
                                <td className="p-2 text-right font-mono font-bold">
                                  <span className={f.lineDiff < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                    {f.lineDiff < 0
                                      ? `-₹${Math.abs(f.lineDiff).toLocaleString('en-IN')}`
                                      : `+₹${f.lineDiff.toLocaleString('en-IN')}`}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {gstExcludedKotOrders.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] space-y-1">
                        <div className="font-mono font-bold uppercase text-[10px] text-amber-900">
                          KOT Orders Printed with GST Excluded (0% Tax):
                        </div>
                        {gstExcludedKotOrders.map(ko => (
                          <div key={ko.id} className="flex justify-between items-center font-mono text-slate-700">
                            <span>
                              #{ko.orderNumber} • {ko.roomNumber ? `Room ${ko.roomNumber}` : ko.tableNo ? `Table ${ko.tableNo}` : (ko.guestName || 'Walk-in')}
                            </span>
                            <span className="font-bold text-amber-900">₹{Number(ko.grandTotal || 0).toLocaleString('en-IN')} (No GST)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* ==================== 3. PENDING PAYMENTS PANEL ========================= */}
      {/* ========================================================================= */}
      {reportType === 'pendingReport' && (
        <div className="space-y-6">
          
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">III. Pending Receivables & Outstanding Accounts Audit</h2>
            <p className="text-[10px] text-gray-600">Audit interval from {computedRangeStart} to {computedRangeEnd}. Analysis conducted across {selectedDates.length} selected working dates.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-rose-200 p-4 rounded-xl shadow-2xs text-center bg-rose-50/5">
              <span className="text-rose-600 text-[10px] uppercase font-mono block font-bold">Outstanding Active Guest Dues</span>
              <span className="text-2xl font-bold font-serif text-rose-700 mt-1 block">₹{totalOutstandingActiveDues.toLocaleString()}</span>
              <span className="text-[11px] text-gray-400">Across {activePendingGuests.length} currently residing accounts</span>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-2xs text-center">
              <span className="text-gray-500 text-[10px] uppercase font-mono block font-bold">Outstanding Historical Dues</span>
              <span className="text-2xl font-bold font-serif text-gray-700 mt-1 block">₹{totalOutstandingHistoricalDues.toLocaleString()}</span>
              <span className="text-[11px] text-gray-400 font-mono">Across {checkedOutPendingGuests.length} checked-out accounts</span>
            </div>
          </div>

          {/* WhatsApp Payment Reminder Assistant (No Print) */}
          <div className="bg-luxury-beige-50/70 border border-luxury-beige-200 p-5 rounded-2xl shadow-xs space-y-3 no-print">
            <div className="flex items-center gap-2 text-luxury-brown-950">
              <Activity className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold">DirectStay Polite Payment Reminder Assistant</h3>
            </div>
            <p className="text-xs text-luxury-brown-700 leading-relaxed">
              Generate customizable, professional, and compliant payment reminder messages in one click. Choose an outstanding guest from the active ledger list below, copy the text or launch direct WhatsApp messaging.
            </p>

            {selectedPendingGuestId ? (() => {
              const activeGuest = checkins.find(c => c.id === selectedPendingGuestId);
              if (!activeGuest) return <p className="text-xs italic text-gray-400">Select a guest from the table to write draft.</p>;
              const messageText = getWhatsAppReminderText(activeGuest);
              return (
                <div className="space-y-3 bg-white p-4 rounded-xl border border-luxury-beige-200 font-mono text-xs">
                  <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <span className="font-sans font-bold text-luxury-brown-950">Message Draft for {activeGuest.guestName}</span>
                    <span className="text-[10px] text-gray-400">Cell: +91 {activeGuest.mobile}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-[11px] text-luxury-brown-800 bg-slate-50 p-3 rounded-lg border max-h-48 overflow-y-auto leading-normal">
                    {messageText}
                  </pre>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => handleCopyReminder(activeGuest)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedReminderId === activeGuest.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedReminderId === activeGuest.id ? 'Copied Draft!' : 'Copy to Clipboard'}
                    </button>
                    <a
                      href={`https://wa.me/${activeGuest.mobile.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(messageText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Send on WhatsApp
                    </a>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-6 bg-white/50 rounded-xl border border-dashed border-luxury-beige-200">
                <p className="text-xs italic text-gray-400">💡 Click "Draft Reminder" on any guest record in the tables below to automatically compile their customized template.</p>
              </div>
            )}
          </div>

          {/* Active outstanding table */}
          <div className="bg-white border rounded-2xl p-5 shadow-2xs">
            <h3 className="text-sm font-serif font-bold text-luxury-brown-950 mb-3 border-b pb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#9E2A2B]" /> Active Staying Guest Outstanding Ledger
            </h3>
            
            {activePendingGuests.length === 0 ? (
              <p className="text-xs italic text-gray-400 text-center py-6">✓ Perfect! No active staying guests currently carry outstanding balances.</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left divide-y">
                  <thead className="bg-slate-50 uppercase text-[10px] font-bold text-gray-600">
                    <tr>
                      <th className="p-3">Guest Stay Profile</th>
                      <th className="p-3 font-mono">Room</th>
                      <th className="p-3">Stay Term</th>
                      <th className="p-3 text-right">Total Tariff</th>
                      <th className="p-3 text-right text-emerald-700">Paid Base</th>
                      <th className="p-3 text-right text-rose-700">Dues Outstanding</th>
                      <th className="p-3 text-right no-print">Collection Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-luxury-brown-900">
                    {activePendingGuests.map(c => {
                      const due = c.pendingAmount ?? (c.totalAmount - c.advanceAmount);
                      const isSelectedForReminder = selectedPendingGuestId === c.id;
                      return (
                        <tr key={c.id} className={`hover:bg-slate-50/50 ${isSelectedForReminder ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-3">
                            <span className="font-bold text-luxury-brown-950 block">{c.guestName}</span>
                            <span className="text-[10px] font-mono text-gray-400">Tel: {c.mobile}</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-[#9E2A2B]">Room {c.roomNumber}</td>
                          <td className="p-3 text-gray-600">{c.checkInDate} to {c.checkOutDate}</td>
                          <td className="p-3 text-right">₹{Number(c.totalAmount || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-700">₹{(c.totalAmount - due).toLocaleString()}</td>
                          <td className="p-3 text-right text-rose-700 font-mono font-bold text-sm">₹{due.toLocaleString()}</td>
                          <td className="p-3 text-right no-print">
                            <button
                              onClick={() => setSelectedPendingGuestId(c.id)}
                              className={`px-2.5 py-1 text-[10px] font-bold border rounded transition-all cursor-pointer ${
                                isSelectedForReminder 
                                  ? 'bg-[#C5A059] border-[#C5A059] text-white' 
                                  : 'bg-white hover:bg-slate-50 text-luxury-brown-900'
                              }`}
                            >
                              Draft Reminder
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checked out outstanding table */}
          <div className="bg-white border rounded-2xl p-5 shadow-2xs">
            <h3 className="text-sm font-serif font-bold text-luxury-brown-950 mb-3 border-b pb-2 flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-gray-500" /> Unresolved Historical Checked Out Guest Ledger
            </h3>
            
            {checkedOutPendingGuests.length === 0 ? (
              <p className="text-xs italic text-gray-400 text-center py-6">✓ Good! No historic checked-out accounts have unresolved balances.</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left divide-y">
                  <thead className="bg-slate-50 uppercase text-[10px] font-bold text-gray-600">
                    <tr>
                      <th className="p-3">Guest Profile</th>
                      <th className="p-3 font-mono">Room Number</th>
                      <th className="p-3">Departure Date</th>
                      <th className="p-3 text-right text-rose-700">Unresolved Dues</th>
                      <th className="p-3 text-right no-print font-sans">Draft Helper</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-luxury-brown-900">
                    {checkedOutPendingGuests.map(c => {
                      const isSelectedForReminder = selectedPendingGuestId === c.id;
                      const due = c.pendingAmount ?? 0;
                      return (
                        <tr key={c.id} className={`hover:bg-slate-50/50 ${isSelectedForReminder ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-3">
                            <span className="font-bold text-luxury-brown-950 block">{c.guestName}</span>
                            <span className="text-[10px] font-mono text-gray-400">Tel: {c.mobile}</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-gray-500">Room {c.roomNumber}</td>
                          <td className="p-3 text-gray-600">{c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate}</td>
                          <td className="p-3 text-right text-rose-700 font-mono font-bold text-sm">₹{due.toLocaleString()}</td>
                          <td className="p-3 text-right no-print">
                            <button
                              onClick={() => setSelectedPendingGuestId(c.id)}
                              className={`px-2.5 py-1 text-[10px] font-bold border rounded transition-all cursor-pointer ${
                                isSelectedForReminder 
                                  ? 'bg-[#C5A059] border-[#C5A059] text-white' 
                                  : 'bg-white hover:bg-slate-50 text-luxury-brown-900'
                              }`}
                            >
                              Draft Reminder
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* ===================== 4. OTA PAYMENT REPORT PANEL ======================== */}
      {/* ========================================================================= */}
      {reportType === 'otaReport' && (
        <div className="space-y-6">
          
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">IV. Online Travel Agency (OTA) Channel & Commission Statement</h2>
            <p className="text-[10px] text-gray-600">Analysis period from {computedRangeStart} to {computedRangeEnd}. Analysis conducted across {selectedDates.length} selected working dates.</p>
          </div>

          <div className="bg-white border rounded-2xl p-6 shadow-2xs space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-serif font-bold text-luxury-brown-950">Booking Channels Performance Breakdown</h3>
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">Commission Base Rate: 15.0%</span>
            </div>

            <div className="overflow-x-auto text-xs font-mono">
              <table className="w-full text-left divide-y">
                <thead className="bg-slate-50 uppercase text-[10px] font-bold text-gray-600">
                  <tr>
                    <th className="p-3">Booking Source Agency</th>
                    <th className="p-3 text-center">Reservations Count</th>
                    <th className="p-3 text-right">Gross Channel Tariff</th>
                    <th className="p-3 text-right text-rose-600">Agency Commission (15%)</th>
                    <th className="p-3 text-right text-emerald-700">Net Realized Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-luxury-brown-900">
                  {otaSummary.map(row => (
                    <tr key={row.source} className="hover:bg-slate-50/50">
                      <td className="p-3 font-sans font-bold text-luxury-brown-950 flex items-center gap-2">
                        {/* Channel visual marker */}
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          row.source === 'Walk-in' ? 'bg-slate-400' :
                          row.source === 'OYO' ? 'bg-red-500' :
                          row.source === 'Agoda' ? 'bg-purple-500' :
                          row.source === 'Booking.com' ? 'bg-blue-600' :
                          row.source === 'Goibibo' ? 'bg-orange-500' : 'bg-pink-500'
                        }`}></span>
                        {row.source}
                      </td>
                      <td className="p-3 text-center font-bold font-mono">{row.count} Bookings</td>
                      <td className="p-3 text-right">₹{row.totalRevenue.toLocaleString()}</td>
                      <td className="p-3 text-right text-rose-600">₹{row.commissionPaid.toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-700 font-bold text-sm">₹{row.netRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Visual Contribution Progress Bars */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h4 className="text-[11px] font-bold text-luxury-brown-950 uppercase tracking-widest font-mono">Channel net revenue contribution share</h4>
              <div className="space-y-3.5">
                {otaSummary.map(row => {
                  const percentWidth = Math.round((row.netRevenue / maxOtaNetRevenue) * 100);
                  const shareColor = 
                    row.source === 'Walk-in' ? 'bg-slate-500' :
                    row.source === 'OYO' ? 'bg-red-500' :
                    row.source === 'Agoda' ? 'bg-purple-500' :
                    row.source === 'Booking.com' ? 'bg-blue-600' :
                    row.source === 'Goibibo' ? 'bg-orange-500' : 'bg-pink-500';

                  return (
                    <div key={row.source} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-luxury-brown-900">{row.source}</span>
                        <span className="font-mono text-gray-500">Net: ₹{row.netRevenue.toLocaleString()} ({row.count} bookings)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${shareColor}`} 
                          style={{ width: `${Math.max(percentWidth, row.netRevenue > 0 ? 3 : 0)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* ==================== 5. GST TAX DECLARATION PANEL ======================= */}
      {/* ========================================================================= */}
      {reportType === 'gstReport' && (
        <div className="space-y-6">
          
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">V. India GSTR-1 Inbound Return Compilation</h2>
            <p className="text-[10px] text-gray-600">Official filing reconciliation log for taxable month: {taxMonth}.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs">
              <span className="text-gray-400 text-[10px] uppercase font-mono block">Taxable Lodging base</span>
              <span className="text-xl font-bold text-luxury-brown-950 mt-1 block">₹{lodgingTaxableSum.toLocaleString()}</span>
            </div>
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs">
              <span className="text-gray-400 text-[10px] uppercase font-mono block">Kitchen Meals Base (5%)</span>
              <span className="text-xl font-bold text-luxury-brown-950 mt-1 block">₹{foodTaxableSum.toLocaleString()}</span>
            </div>
            <div className="bg-white border p-4 rounded-xl text-center shadow-2xs">
              <span className="text-gray-400 text-[10px] uppercase font-mono block">Ancillary Services Base</span>
              <span className="text-xl font-bold text-luxury-brown-950 mt-1 block">₹{ancillaryTaxableSum.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-[#9E2A2B]/40 p-4 rounded-xl text-center shadow-2xs bg-rose-50/5">
              <span className="text-[#9E2A2B] text-[10px] uppercase font-mono block font-bold">Total CGST+SGST pool</span>
              <span className="text-xl font-bold text-[#9E2A2B] mt-1 block">₹{totalGstInvoicesCollected.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5 shadow-2xs">
            <h3 className="text-sm font-serif font-bold text-luxury-brown-950 mb-3 border-b pb-2">Central & State Tax returns Statement</h3>
            <div className="text-xs text-luxury-brown-700 space-y-4">
              <p>This report documents tax pools generated from final guest stays compiled inside month <strong>{taxMonth}</strong>. Rates correspond to Indian hotel taxation rules.</p>
              <div className="overflow-x-auto font-mono">
                <table className="w-full text-left divide-y border">
                  <thead className="bg-slate-50 uppercase text-[9px] font-bold text-gray-600">
                    <tr>
                      <th className="p-3">Service Pool Type & Slab</th>
                      <th className="p-3 text-right">Taxable Turnover (INR)</th>
                      <th className="p-3 text-right">CGST Pool</th>
                      <th className="p-3 text-right">SGST Pool</th>
                      <th className="p-3 text-right text-luxury-brown-950">Grand GST Total Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-xs">
                    <tr>
                      <td className="p-3 font-sans font-semibold text-[#9E2A2B]">Room Lodging (5% Budget/Sarai Slab)</td>
                      <td className="p-3 text-right">₹{lodgingTaxableSum5.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-500">₹{lodgingCGST5.toLocaleString()} <span className="text-[9px]">(2.5%)</span></td>
                      <td className="p-3 text-right text-slate-500">₹{lodgingSGST5.toLocaleString()} <span className="text-[9px]">(2.5%)</span></td>
                      <td className="p-3 text-right font-bold text-luxury-brown-950">₹{(lodgingCGST5 + lodgingSGST5).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-semibold text-luxury-brown-950">Room Lodging (18% Luxury Slab)</td>
                      <td className="p-3 text-right">₹{lodgingTaxableSum18.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-500">₹{lodgingCGST18.toLocaleString()} <span className="text-[9px]">(9.0%)</span></td>
                      <td className="p-3 text-right text-slate-500">₹{lodgingSGST18.toLocaleString()} <span className="text-[9px]">(9.0%)</span></td>
                      <td className="p-3 text-right font-bold text-luxury-brown-950">₹{(lodgingCGST18 + lodgingSGST18).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-semibold text-emerald-800">Kitchen Food Charges (5% Slab)</td>
                      <td className="p-3 text-right">₹{foodTaxableSum.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-500">₹{foodCGST.toLocaleString()} <span className="text-[9px]">(2.5%)</span></td>
                      <td className="p-3 text-right text-slate-500">₹{foodSGST.toLocaleString()} <span className="text-[9px]">(2.5%)</span></td>
                      <td className="p-3 text-right font-bold text-luxury-brown-950">₹{(foodCGST + foodSGST).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-semibold text-amber-800">Ancillary Services (18% Slab)</td>
                      <td className="p-3 text-right">₹{ancillaryTaxableSum.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-500">₹{ancillaryCGST.toLocaleString()} <span className="text-[9px]">(9.0%)</span></td>
                      <td className="p-3 text-right text-slate-500">₹{ancillarySGST.toLocaleString()} <span className="text-[9px]">(9.0%)</span></td>
                      <td className="p-3 text-right font-bold text-luxury-brown-950">₹{(ancillaryCGST + ancillarySGST).toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-sm text-luxury-brown-950">
                      <td className="p-3 font-sans">AGGREGATED RETURN SUMS</td>
                      <td className="p-3 text-right">₹{(lodgingTaxableSum + foodTaxableSum + ancillaryTaxableSum).toLocaleString()}</td>
                      <td className="p-3 text-right">₹{(totalLodgingCGST + foodCGST + ancillaryCGST).toLocaleString()}</td>
                      <td className="p-3 text-right">₹{(totalLodgingSGST + foodSGST + ancillarySGST).toLocaleString()}</td>
                      <td className="p-3 text-right text-[#9E2A2B]">₹{totalGstInvoicesCollected.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* =================== 6. DAILY REVENUE JOURNAL PANEL ====================== */}
      {/* ========================================================================= */}
      {reportType === 'revenueReport' && (
        <div className="space-y-6">
          
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">VI. Day-by-Day Historical Revenue & Ledger Journal</h2>
            <p className="text-[10px] text-gray-600">System database logs covering recent active operations.</p>
          </div>

          <div className="bg-white border rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-serif font-bold text-luxury-brown-950 border-b pb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Day-by-Day Financial Revenue Ledger
            </h3>
            <div className="overflow-x-auto text-xs font-mono">
              <table className="w-full text-left divide-y">
                <thead className="bg-slate-50 uppercase text-[9px] font-bold text-gray-600">
                  <tr>
                    <th className="p-3">Reference Date</th>
                    <th className="p-3 text-right">Estimated Lodging Sold</th>
                    <th className="p-3 text-right text-emerald-700">Actual Payments Collected</th>
                    <th className="p-3 text-right text-luxury-brown-950">Invoiced Turnover</th>
                    <th className="p-3 text-right">GST Taxes Collected</th>
                    <th className="p-3 text-right text-rose-600">Discounts Allowed</th>
                    <th className="p-3 text-right text-rose-700">Expenses Deducted</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-luxury-brown-900">
                  {dailyRevenueLogs.map(row => (
                    <tr key={row.date} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-luxury-brown-950">{row.date}</td>
                      <td className="p-3 text-right">₹{row.baseLodgingVal.toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-700 font-bold">₹{row.totalPaymentsReceived.toLocaleString()}</td>
                      <td className="p-3 text-right text-luxury-brown-950 font-bold">₹{row.totalBilledValue.toLocaleString()}</td>
                      <td className="p-3 text-right text-gray-500">₹{row.gstCollected.toLocaleString()}</td>
                      <td className="p-3 text-right text-rose-600">₹{row.discountAllowed.toLocaleString()}</td>
                      <td className="p-3 text-right text-rose-700">₹{row.totalExpenses.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* ===================== 7. POLICE SARAI ACT PANEL ========================== */}
      {/* ========================================================================= */}
      {reportType === 'sarai' && (
        <div className="space-y-6">
          
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">VII. Police Sarai Act Regulatory Register</h2>
            <p className="text-[10px] text-gray-600">Regulatory compliance register generated on reference date: {refTodayDate}.</p>
          </div>

          <div className="bg-white border rounded-2xl p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-serif font-bold text-luxury-brown-950 border-b pb-2 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-luxury-gold-500" /> State police Sarai Guest Registry
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Official regulatory resident log containing legal personal profiles, Aadhaar/Passport credential details, and verified companion counts required for state police compliance audits.
            </p>
            
            <div className="overflow-x-auto text-xs font-mono">
              <table className="w-full text-left divide-y border">
                <thead className="bg-slate-50 uppercase text-[9px] font-bold text-gray-600">
                  <tr>
                    <th className="p-3">S.No</th>
                    <th className="p-3">Guest Profile Name & Origin Address</th>
                    <th className="p-3">Nationality</th>
                    <th className="p-3">Identity Credentials</th>
                    <th className="p-3">Arrival Date</th>
                    <th className="p-3">Room</th>
                    <th className="p-3 text-center">Companions</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-luxury-brown-900">
                  {(() => {
                    const saraiGuests = checkins.filter(c => {
                      const inDateStr = (c.checkInDate || '').substring(0, 10);
                      const outDateStr = (c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate || inDateStr).substring(0, 10);
                      return selectedDates.some(d => inDateStr <= d && outDateStr >= d) || (inDateStr >= computedRangeStart && inDateStr <= computedRangeEnd);
                    });
                    if (saraiGuests.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-8 text-center italic text-gray-400">
                            No staying residents recorded between {computedRangeStart} and {computedRangeEnd}. Adjust From Date / To Date to view audits.
                          </td>
                        </tr>
                      );
                    }
                    return saraiGuests.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold">{idx + 1}</td>
                        <td className="p-3 font-sans">
                          <span className="font-bold block text-luxury-brown-950">{c.guestName}</span>
                          <span className="text-[10px] text-gray-400 block max-w-xs truncate">{c.address}, {c.city}, {c.state}</span>
                        </td>
                        <td className="p-3">{c.nationality || 'Indian'}</td>
                        <td className="p-3 uppercase text-[10px] text-rose-800 font-bold">
                          {c.idType || 'Aadhaar'}: {c.idNumber || c.aadhaarNumber || 'N/A'}
                        </td>
                        <td className="p-3">{c.checkInDate}</td>
                        <td className="p-3 font-bold text-luxury-brown-900">Room {c.roomNumber}</td>
                        <td className="p-3 text-center font-bold">{c.secondaryGuests?.length || 0}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* ===================== 8. WATER BOTTLES AUDIT LOGS ======================== */}
      {/* ========================================================================= */}
      {reportType === 'waterLogs' && (
        <div className="space-y-6">
          
          <div className="border-b pb-2 hidden print:block mb-4">
            <h2 className="text-lg font-serif font-bold text-luxury-brown-950 uppercase tracking-wider">VIII. Daily Room Water Bottle Inventory Issue Audit</h2>
            <p className="text-[10px] text-gray-600">Inventory audit from {computedRangeStart} to {computedRangeEnd}. Analysis conducted across {selectedDates.length} selected working dates.</p>
          </div>

          <div className="bg-white border rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                <GlassWater className="w-5 h-5 text-sky-500" /> Water Bottle Issue & Inventory Ledger
              </h3>
              <span className="px-3 py-1 bg-sky-50 text-sky-700 font-mono font-bold rounded-lg text-xs">
                Total bottles Issued: {totalWaterBottlesIssuedSelected} Units
              </span>
            </div>

            {waterBottlesSelected.length === 0 ? (
              <p className="text-xs italic text-gray-400 text-center py-8">No water bottle issuance records found for the selected dates.</p>
            ) : (
              <div className="overflow-x-auto text-xs font-mono">
                <table className="w-full text-left divide-y border">
                  <thead className="bg-slate-50 uppercase text-[10px] font-bold text-gray-600">
                    <tr>
                      <th className="p-3">Reference Date</th>
                      <th className="p-3">Room Number</th>
                      <th className="p-3">Quantity Issued (Units)</th>
                      <th className="p-3">Officer Sign-off</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-luxury-brown-900">
                    {waterBottlesSelected.map(record => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold">{record.date}</td>
                        <td className="p-3 font-sans font-semibold">Room {record.roomNumber}</td>
                        <td className="p-3 text-sky-600 font-bold text-sm">{record.quantity} Bottles</td>
                        <td className="p-3 text-gray-500 italic">Duty Manager Authorized</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}


      {/* ----------------- SYSTEM REPORT COMPLIANCE FOOTER (PRINT ONLY) ----------------- */}
      <div className="hidden print:block mt-12 pt-4 border-t border-dashed border-gray-400 text-[10px] text-center font-mono text-gray-500">
        <p>This statement constitutes an official operations and ledger report of DirectStay Grand Resort.</p>
        <p className="mt-1">Generated electronically via DirectStay HMS Financial Intelligence Engine. Certified Copy.</p>
        <div className="flex justify-between mt-12 text-xs font-sans font-bold pt-8">
          <div className="border-t border-gray-400 w-48 pt-2">Audit Lead Signature</div>
          <div className="border-t border-gray-400 w-48 pt-2">General Manager Sign</div>
        </div>
      </div>

    </div>
  );
}
