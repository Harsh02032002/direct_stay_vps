import React, { useEffect, useMemo, useState } from 'react';
import {
  HybridSplitPaymentBox,
  HybridSplitRow,
  createInitialHybridRows,
  formatHybridLabel,
  getHybridTotal,
} from '../../components/HybridSplitPaymentBox';
import {
  getTodayIst,
  getYesterdayIst,
  formatDdmmyyyy,
  getPresetDateRange,
} from '../../utils/reportingDates';
import {
  BookingRecord,
  CashBankAccountRecord,
  DailyClosingEntry,
  FinanceExpenseRecord,
  FinanceVoucherRecord,
  InventoryPurchaseRecord,
  InventorySupplierRecord,
  InvoiceRecord,
  LaundryOrderRecord,
  MiscellaneousIncomeRecord,
  OtaSettlementRecord,
  OwnerPaymentRecord,
  PaymentMethod,
  PettyCashRecord,
  PosOrderRecord,
  StaffReimbursementRecord,
  VendorBillRecord,
} from '../types';
import {
  TrendingUp,
  TrendingDown,
  Coins,
  Landmark,
  Receipt,
  Building2,
  UserCheck,
  Wallet,
  Clock,
  LayoutDashboard,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  RefreshCw,
  DollarSign,
  FileText,
  ChevronRight,
  Eye,
  Trash2,
  Printer,
  ShieldCheck,
  XCircle,
  Layers,
  PieChart,
  BarChart3,
  Calendar,
  Check,
  X,
  ArrowLeftRight,
  HelpCircle,
  AlertCircle,
  Percent,
  Download,
} from 'lucide-react';
import { r2 } from '../../utils/billCalculator';
import { openPrintWindow } from '../../utils/printDocument';

interface FinanceModuleProps {
  activeSubTab: string;
  onSubTabChange: (sub: string) => void;
  bookings?: BookingRecord[];
  posOrders?: PosOrderRecord[];
  laundryOrders?: LaundryOrderRecord[];
  purchases?: InventoryPurchaseRecord[];
  suppliers?: InventorySupplierRecord[];
  invoices?: InvoiceRecord[];
  otaSettlements?: OtaSettlementRecord[];
  expenses: FinanceExpenseRecord[];
  vouchers: FinanceVoucherRecord[];
  accounts: CashBankAccountRecord[];
  pettyCash: PettyCashRecord[];
  ownerLedger: OwnerPaymentRecord[];
  reimbursements: StaffReimbursementRecord[];
  dailyClosings: DailyClosingEntry[];
  vendorBills?: VendorBillRecord[];
  miscIncome?: MiscellaneousIncomeRecord[];
  onAddExpense: (exp: Omit<FinanceExpenseRecord, 'id'>) => void;
  onUpdateExpense?: (id: string, updates: Partial<FinanceExpenseRecord>) => void;
  onDeleteExpense?: (id: string) => void;
  onAddPettyCash?: (entry: Omit<PettyCashRecord, 'id'>) => void;
  onDeletePettyCash?: (id: string) => void;
  onAddVoucher?: (voucher: Omit<FinanceVoucherRecord, 'id'>) => void;
  onAddAccount?: (account: Omit<CashBankAccountRecord, 'id'>) => void;
  onUpdateAccount?: (id: string, updates: Partial<CashBankAccountRecord>) => void;
  onAddOwnerPayment?: (entry: Omit<OwnerPaymentRecord, 'id'>) => void;
  onAddReimbursement?: (entry: Omit<StaffReimbursementRecord, 'id'>) => void;
  onUpdateReimbursementStatus?: (id: string, status: StaffReimbursementRecord['status']) => void;
  onAddDailyClosing?: (entry: Omit<DailyClosingEntry, 'id'>) => void;
  onAddVendorBill?: (bill: Omit<VendorBillRecord, 'id'>) => void;
  onPayVendorBill?: (
    billId: string,
    payment: { amount: number; paymentMethod: PaymentMethod; date: string; notes?: string }
  ) => void;
  onAddMiscIncome?: (income: Omit<MiscellaneousIncomeRecord, 'id'>) => void;
  onTransferFunds?: (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    referenceNo?: string;
    notes?: string;
  }) => void;
}

const EXPENSE_CATEGORIES = [
  'Electricity & Power',
  'Diesel / Generator Fuel',
  'Plumbing & AC Maintenance',
  'Kitchen & F&B Raw Material',
  'Housekeeping Supplies',
  'OTA Commission',
  'Laundry Vendor Bill',
  'Marketing',
  'Repairs & Maintenance',
  'Staff Salary & Daily Wages',
  'Wi-Fi, Cable & Telephone',
  'Security & Pest Control',
  'Other / Extra Expense (Custom)',
];

const PETTY_CASH_CATEGORIES = [
  'Tea / Coffee / Milk',
  'Auto / Rickshaw',
  'Drinking Water',
  'Stationery',
  'Electrical Items',
  'Cleaning Supplies',
  'Guest Emergency Expenses',
  'Newspaper',
  'Other Petty Expense (Custom)',
];

const MISC_INCOME_CATEGORIES = [
  'Banquet Hall',
  'Conference Hall',
  'Extra Mattress',
  'Walk-in Laundry',
  'Scrap Sale',
  'Other Income (Custom)',
];

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  bookings = [],
  posOrders = [],
  laundryOrders = [],
  purchases = [],
  suppliers = [],
  invoices = [],
  otaSettlements = [],
  expenses,
  vouchers,
  accounts,
  pettyCash,
  ownerLedger,
  reimbursements,
  dailyClosings,
  vendorBills = [],
  miscIncome = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddPettyCash,
  onDeletePettyCash,
  onAddVoucher,
  onAddAccount,
  onUpdateAccount,
  onAddOwnerPayment,
  onAddReimbursement,
  onUpdateReimbursementStatus,
  onAddDailyClosing,
  onAddVendorBill,
  onPayVendorBill,
  onAddMiscIncome,
  onTransferFunds,
}) => {
  const todayStr = getTodayIst();

  // Normalize Sidebar sub-tab IDs to FinanceModule internal sub-tab IDs
  const effectiveSubTab =
    activeSubTab === 'transactions'
      ? 'income'
      : activeSubTab === 'accounts'
      ? 'cash_bank'
      : activeSubTab === 'vouchers'
      ? 'vouchers_payment'
      : activeSubTab === 'owner_ledger'
      ? 'owner_payments'
      : activeSubTab === 'gst_compliance'
      ? 'pl_reports'
      : activeSubTab || 'dashboard';

  // Global Date Filter across ALL Finance Hub Menus & Submenus (Defaults to Today's IST Date, with 1-click Today/Yesterday/Week/Month/All/Custom filters)
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today');
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [daybookSearch, setDaybookSearch] = useState<string>('');
  const [daybookTypeFilter, setDaybookTypeFilter] = useState<'all' | 'in' | 'out'>('all');

  const normalizeFinanceDate = (val?: unknown): string => {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (/^\d{2}[/-]\d{2}[/-]\d{4}/.test(s)) {
      const [d, m, y] = s.slice(0, 10).split(/[/-]/);
      return `${y}-${m}-${d}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return '';
  };

  const inSelectedRange = (rawDate?: unknown): boolean => {
    if (datePreset === 'all' && !fromDate && !toDate) return true;
    const d = normalizeFinanceDate(rawDate);
    if (!d) return false;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const applyDatePreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all') => {
    setDatePreset(preset);
    if (preset === 'today') {
      const range = getPresetDateRange('today');
      setFromDate(range.from);
      setToDate(range.to);
    } else if (preset === 'yesterday') {
      const range = getPresetDateRange('yesterday');
      setFromDate(range.from);
      setToDate(range.to);
    } else if (preset === 'this_week') {
      const range = getPresetDateRange('last7days');
      setFromDate(range.from);
      setToDate(range.to);
    } else if (preset === 'this_month') {
      const range = getPresetDateRange('thisMonth');
      setFromDate(range.from);
      setToDate(range.to);
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // Local synced state
  const [localExpenses, setLocalExpenses] = useState<FinanceExpenseRecord[]>(expenses);
  const [localPettyCash, setLocalPettyCash] = useState<PettyCashRecord[]>(pettyCash);
  const [localVouchers, setLocalVouchers] = useState<FinanceVoucherRecord[]>(vouchers);
  const [localAccounts, setLocalAccounts] = useState<CashBankAccountRecord[]>(accounts);
  const [localOwnerLedger, setLocalOwnerLedger] = useState<OwnerPaymentRecord[]>(ownerLedger);
  const [localReimbursements, setLocalReimbursements] = useState<StaffReimbursementRecord[]>(reimbursements);
  const [localDailyClosings, setLocalDailyClosings] = useState<DailyClosingEntry[]>(dailyClosings);
  const [localVendorBills, setLocalVendorBills] = useState<VendorBillRecord[]>(vendorBills);
  const [localMiscIncome, setLocalMiscIncome] = useState<MiscellaneousIncomeRecord[]>(miscIncome);

  useEffect(() => setLocalExpenses(expenses), [expenses]);
  useEffect(() => setLocalPettyCash(pettyCash), [pettyCash]);
  useEffect(() => setLocalVouchers(vouchers), [vouchers]);
  useEffect(() => setLocalAccounts(accounts), [accounts]);
  useEffect(() => setLocalOwnerLedger(ownerLedger), [ownerLedger]);
  useEffect(() => setLocalReimbursements(reimbursements), [reimbursements]);
  useEffect(() => setLocalDailyClosings(dailyClosings), [dailyClosings]);
  useEffect(() => setLocalVendorBills(vendorBills), [vendorBills]);
  useEffect(() => setLocalMiscIncome(miscIncome), [miscIncome]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // BASE CASH & BANK ACCOUNTS (Cleaned of any old dummy static balances)
  // ---------------------------------------------------------------------------
  const baseAccounts: CashBankAccountRecord[] = useMemo(() => {
    const cleaned = localAccounts.map((a) => {
      const isOldSeedCash =
        (a.id === 'acc-cash-drawer' || a.accountNumber === 'CASH-DRAWER-01') &&
        Number(a.openingBalance) === 10000;
      const isOldSeedBank =
        (a.id === 'acc-hdfc-current' || a.accountNumber === '50200088991122') &&
        Number(a.openingBalance) === 50000;
      if (isOldSeedCash || isOldSeedBank) {
        return { ...a, openingBalance: 0, currentBalance: 0 };
      }
      return a;
    });
    if (cleaned.length > 0) return cleaned;
    return [
      {
        id: 'acc-cash-drawer',
        accountName: 'Cash Counter (Reception Drawer)',
        accountType: 'Cash Drawer',
        bankName: 'Hotel Cash Ledger',
        accountNumber: 'CASH-COUNTER',
        accountReference: 'LIVE-CASH',
        openingBalance: 0,
        openingDate: todayStr,
        inflowTotal: 0,
        outflowTotal: 0,
        currentBalance: 0,
        lastReconciled: todayStr,
        status: 'Active',
      },
      {
        id: 'acc-bank-current',
        accountName: 'Bank Transfer Counter',
        accountType: 'Bank Account',
        bankName: 'Hotel Bank Ledger',
        accountNumber: 'BANK-COUNTER',
        accountReference: 'LIVE-BANK',
        openingBalance: 0,
        openingDate: todayStr,
        inflowTotal: 0,
        outflowTotal: 0,
        currentBalance: 0,
        lastReconciled: todayStr,
        status: 'Active',
      },
      {
        id: 'acc-upi-merchant',
        accountName: 'UPI Counter (QR & Digital)',
        accountType: 'UPI Merchant',
        bankName: 'Hotel UPI Ledger',
        accountNumber: 'UPI-COUNTER',
        accountReference: 'LIVE-UPI',
        openingBalance: 0,
        openingDate: todayStr,
        inflowTotal: 0,
        outflowTotal: 0,
        currentBalance: 0,
        lastReconciled: todayStr,
        status: 'Active',
      },
      {
        id: 'acc-card-pos',
        accountName: 'Card Counter (POS Terminal)',
        accountType: 'POS Card Terminal',
        bankName: 'Hotel Card Ledger',
        accountNumber: 'CARD-COUNTER',
        accountReference: 'LIVE-CARD',
        openingBalance: 0,
        openingDate: todayStr,
        inflowTotal: 0,
        outflowTotal: 0,
        currentBalance: 0,
        lastReconciled: todayStr,
        status: 'Active',
      },
    ];
  }, [localAccounts, todayStr]);

  // ===========================================================================
  // 1. LIVE REVENUE & INCOME DATA SOURCE INTEGRATION (NO DUPLICATES)
  // ===========================================================================
  // Normal hotel income flows automatically:
  // A. Front Desk: booking advance, room payment, checkout payment, additional charges, refunds
  // B. POS Restaurant: paid restaurant bills (not room folio)
  // C. Housekeeping: paid laundry services
  // D. OTA: settlements received
  // E. Miscellaneous: manual miscellaneous hotel income entries
  const allIncomeTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      sourceModule: 'Front Desk' | 'POS Restaurant' | 'Laundry & Guest Services' | 'OTA Settlement' | 'Miscellaneous Income';
      refNo: string;
      partyName: string;
      category: string;
      paymentMode: string;
      amount: number;
      isRefund?: boolean;
      narration: string;
    }> = [];

    // A. Front Desk Booking Payments & Authorized Refunds
    const bookingPaymentRefNos = new Set<string>();
    bookings.forEach((b) => {
      const rawBkgNo = String(b.bookingNo || b.id || '');
      const formattedBkgNo = rawBkgNo.startsWith('#') ? rawBkgNo : `#${rawBkgNo}`;
      const fallbackDate = (b.bookedOn || b.checkInDate || todayStr).slice(0, 10);

      // 1. Installment / Checkin / Checkout Payments
      if (Array.isArray(b.payments) && b.payments.length > 0) {
        b.payments.forEach((p) => {
          const amt = Number(p.amount) || 0;
          if (amt !== 0) {
            if (p.transactionId) bookingPaymentRefNos.add(p.transactionId);
            const rawPayDate = (p.date || fallbackDate).slice(0, 10);
            const effectivePayDate =
              rawPayDate === '2026-10-31' && fallbackDate > '2026-10-31'
                ? fallbackDate
                : rawPayDate;
            list.push({
              id: p.id || `PAY-${b.id}-${p.transactionId || Math.random().toString(36).slice(2, 6)}`,
              date: effectivePayDate,
              sourceModule: 'Front Desk',
              refNo: p.transactionId || formattedBkgNo,
              partyName: `${b.customerName} (${b.roomNumbers.length > 0 ? `Rm ${b.roomNumbers.join(', ')}` : b.roomCategorySummary || 'Room'})`,
              category: p.notes || (amt < 0 ? 'Guest Refund' : 'Room Booking / Stay Settlement'),
              paymentMode: p.paymentMethod || 'UPI',
              amount: amt,
              isRefund: amt < 0,
              narration: `Booking ${formattedBkgNo} • ${b.status} (${b.source || 'Direct'})`,
            });
          }
        });
      } else if ((Number(b.amountPaid) || 0) > 0) {
        list.push({
          id: `BKG-PAY-${b.id}`,
          date: fallbackDate,
          sourceModule: 'Front Desk',
          refNo: formattedBkgNo,
          partyName: `${b.customerName} (${b.roomNumbers.length > 0 ? `Rm ${b.roomNumbers.join(', ')}` : 'Room'})`,
          category: 'Room Advance / Stay Payment',
          paymentMode: (b.payments?.[0]?.paymentMethod as any) || 'UPI',
          amount: Number(b.amountPaid) || 0,
          narration: `Booking ${formattedBkgNo} • ${b.status} (${b.source || 'Direct'})`,
        });
      }

      // Explicit refund recorded on booking
      if (Number(b.refundAmount || 0) > 0 && (!b.payments || !b.payments.some((p) => Number(p.amount) < 0))) {
        list.push({
          id: `BKG-REF-${b.id}`,
          date: (b.checkOutDate || b.bookedOn || todayStr).slice(0, 10),
          sourceModule: 'Front Desk',
          refNo: `REF-${rawBkgNo.replace(/^#/, '')}`,
          partyName: `${b.customerName} (${b.roomNumbers.join(', ')})`,
          category: `Cancellation Refund: ${b.cancellationReason || 'Authorized guest refund'}`,
          paymentMode: 'UPI',
          amount: -Number(b.refundAmount),
          isRefund: true,
          narration: `Booking ${formattedBkgNo} Cancellation Refund`,
        });
      }
    });

    // B. POS Restaurant Paid Orders (exclude 'Room Charge' / Room Folio to prevent double counting!)
    posOrders.forEach((po) => {
      if (
        po.paymentStatus === 'Paid' &&
        po.paymentMethod !== 'Room Charge' &&
        (Number(po.grandTotal) || 0) > 0
      ) {
        list.push({
          id: po.id,
          date: (po.dateTime || todayStr).slice(0, 10),
          sourceModule: 'POS Restaurant',
          refNo: po.orderNumber,
          partyName: po.customerName || (po.roomNumber ? `Room ${po.roomNumber}` : 'Walk-In Diner'),
          category: `F&B ${po.orderType || 'Dining'}`,
          paymentMode: po.paymentMethod || 'Cash',
          amount: Number(po.grandTotal) || 0,
          narration: po.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
        });
      }
    });

    // C. Housekeeping & Laundry Paid Orders (exclude Billed to Room)
    laundryOrders.forEach((lo) => {
      if (lo.paymentStatus === 'Paid' && (Number(lo.totalAmount) || 0) > 0) {
        list.push({
          id: lo.id,
          date: (lo.date || todayStr).slice(0, 10),
          sourceModule: 'Laundry & Guest Services',
          refNo: lo.orderNumber || lo.id,
          partyName: lo.guestName || (lo.roomNumber ? `Room ${lo.roomNumber}` : 'Walk-In Guest'),
          category: `${lo.orderType || 'Guest Laundry'}`,
          paymentMode: 'Cash',
          amount: Number(lo.totalAmount) || 0,
          narration: lo.itemsSummary || 'Paid laundry & dry cleaning service',
        });
      }
    });

    // D. Actual OTA Settlements Received
    otaSettlements.forEach((os) => {
      if (Number(os.netSettledAmount || 0) > 0) {
        list.push({
          id: os.id,
          date: (os.payoutDate || todayStr).slice(0, 10),
          sourceModule: 'OTA Settlement',
          refNo: os.settlementRef,
          partyName: `${os.channelName} Payout`,
          category: `Net Bank Payout (${os.channelName})`,
          paymentMode: 'Bank Transfer',
          amount: Number(os.netSettledAmount) || 0,
          narration: `Gross GMV: ₹${os.grossBookingValue}, Comm: ₹${os.commissionDeducted}, TDS: ₹${os.tdsOrTaxDeducted} (${os.bookingIds.length} bookings)`,
        });
      }
    });

    // E. Miscellaneous Hotel Income (Banquet, Conference, Scrap, etc.)
    const miscVoucherNos = new Set<string>();
    localMiscIncome.forEach((mi) => {
      if (mi.voucherNumber) miscVoucherNos.add(mi.voucherNumber);
      list.push({
        id: mi.id,
        date: (mi.transactionDate || todayStr).slice(0, 10),
        sourceModule: 'Miscellaneous Income',
        refNo: mi.referenceNumber || mi.voucherNumber,
        partyName: mi.description,
        category: mi.incomeCategory === 'Other Income (Custom)' ? mi.customCategory || 'Other Income' : mi.incomeCategory,
        paymentMode: mi.paymentMode,
        amount: Number(mi.amount) || 0,
        narration: mi.remarks ? `${mi.remarks} (Voucher ${mi.voucherNumber})` : `Voucher ${mi.voucherNumber}`,
      });
    });

    // F. Standalone Manual Receipt Vouchers (exclude Booking Payments, Misc Income & Owner Capital to prevent double counting!)
    localVouchers.forEach((v) => {
      const isBookingReceiptVoucher =
        v.sourceType === 'booking_payment' ||
        v.category === 'Room & Folio Settlement' ||
        v.category === 'Checkout Final Bill Settlement' ||
        /\(Booking\s+#?/i.test(v.partyName || '') ||
        Boolean(v.referenceNo && bookingPaymentRefNos.has(v.referenceNo));

      if (
        v.type === 'Receipt Voucher' &&
        v.sourceType !== 'misc_income' &&
        v.sourceType !== 'owner_equity' &&
        !isBookingReceiptVoucher &&
        !miscVoucherNos.has(v.voucherNo) &&
        (Number(v.amount) || 0) > 0
      ) {
        list.push({
          id: v.id,
          date: (v.date || todayStr).slice(0, 10),
          sourceModule: 'Miscellaneous Income',
          refNo: v.voucherNo,
          partyName: v.partyName || 'Receipt Voucher',
          category: v.category || 'Receipt Voucher',
          paymentMode: v.paymentMethod || 'Cash',
          amount: Number(v.amount) || 0,
          narration: v.narration || `Receipt Voucher ${v.voucherNo}`,
        });
      }
    });

    return list
      .filter((tx) => inSelectedRange(tx.date))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [bookings, posOrders, laundryOrders, otaSettlements, localMiscIncome, localVouchers, todayStr, datePreset, fromDate, toDate]);

  // Date-filtered collections for all Finance Hub views
  const filteredExpenses = useMemo(() => {
    return localExpenses.filter((e) => inSelectedRange(e.date)).sort((a, b) => b.date.localeCompare(a.date));
  }, [localExpenses, datePreset, fromDate, toDate]);

  const filteredPettyCash = useMemo(() => {
    return localPettyCash.filter((p) => inSelectedRange(p.date));
  }, [localPettyCash, datePreset, fromDate, toDate]);

  const filteredVouchers = useMemo(() => {
    return localVouchers.filter((v) => inSelectedRange(v.date));
  }, [localVouchers, datePreset, fromDate, toDate]);

  const filteredOwnerLedger = useMemo(() => {
    return localOwnerLedger.filter((o) => inSelectedRange(o.date));
  }, [localOwnerLedger, datePreset, fromDate, toDate]);

  const filteredReimbursements = useMemo(() => {
    return localReimbursements.filter((r) => inSelectedRange(r.date));
  }, [localReimbursements, datePreset, fromDate, toDate]);

  const filteredDailyClosings = useMemo(() => {
    return localDailyClosings.filter((dc) => inSelectedRange(dc.date));
  }, [localDailyClosings, datePreset, fromDate, toDate]);

  const filteredVendorBills = useMemo(() => {
    return localVendorBills.filter((vb) => inSelectedRange(vb.invoiceDate || vb.dueDate));
  }, [localVendorBills, datePreset, fromDate, toDate]);

  const filteredBookingsForPl = useMemo(() => {
    return bookings.filter((b) => inSelectedRange(b.checkInDate || b.bookedOn));
  }, [bookings, datePreset, fromDate, toDate]);

  const filteredPosOrdersForPl = useMemo(() => {
    return posOrders.filter((po) => inSelectedRange(po.dateTime));
  }, [posOrders, datePreset, fromDate, toDate]);

  const filteredLaundryForPl = useMemo(() => {
    return laundryOrders.filter((lo) => inSelectedRange(lo.date));
  }, [laundryOrders, datePreset, fromDate, toDate]);

  const filteredMiscIncomeForPl = useMemo(() => {
    return localMiscIncome.filter((mi) => inSelectedRange(mi.transactionDate));
  }, [localMiscIncome, datePreset, fromDate, toDate]);

  // ===========================================================================
  // 2. LIVE OPERATIONAL EXPENSES & PURCHASES AGGREGATION
  // ===========================================================================
  // Combines:
  // - Operational Expenses from Expense Register
  // - Paid Store Inventory Purchases
  // - Settled Staff Reimbursements
  // - Unpaid Vendor Bills (as Payables, not immediate cash outflows!)
  const allOperationalExpenses = useMemo(() => {
    return filteredExpenses;
  }, [filteredExpenses]);

  // Total paid expenses (actual cash/bank outflows)
  const totalPaidExpensesOutflow = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.paymentStatus !== 'Pending / Payable')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  // Total unpaid expenses (outstanding accounts payable)
  const totalUnpaidExpensesPayable = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.paymentStatus === 'Pending / Payable')
      .reduce((s, e) => s + (Number(e.amount) || 0) - (Number(e.amountPaid) || 0), 0);
  }, [filteredExpenses]);

  // Input Tax Credit (ITC) from eligible paid expenses & bills
  const totalExpenseGstItc = useMemo(() => {
    return filteredExpenses.reduce((s, e) => s + (Number(e.gstAmount) || 0), 0);
  }, [filteredExpenses]);

  // ===========================================================================
  // 3. PETTY CASH DRAWER (REAL IMPREST SYSTEM & PASSBOOK)
  // ===========================================================================
  // Replenishments are internal transfers! They add float to drawer.
  // Spend entries are small cash disbursements (including expenses auto-deducted from Petty Cash).
  const pettyCashReplenishments = useMemo(() => {
    return filteredPettyCash
      .filter((p) => p.type === 'Inflow' || p.isReplenishment || p.category.toLowerCase().includes('float'))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [filteredPettyCash]);

  const pettyCashSpends = useMemo(() => {
    return filteredPettyCash
      .filter((p) => p.type === 'Outflow' && !p.isReplenishment && !p.category.toLowerCase().includes('float'))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [filteredPettyCash]);

  const directPettyCashSpendsOnly = useMemo(() => {
    return filteredPettyCash
      .filter(
        (p) =>
          p.type === 'Outflow' &&
          !p.isReplenishment &&
          !p.category.toLowerCase().includes('float') &&
          !String(p.notes || '').startsWith('Expense #')
      )
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [filteredPettyCash]);

  const availablePettyCashBalance = pettyCashReplenishments - pettyCashSpends;

  // Running balance passbook
  const pettyCashPassbook = useMemo(() => {
    const chronological = [...filteredPettyCash].reverse();
    let run = 0;
    const items = chronological.map((p) => {
      const isIn = p.type === 'Inflow' || Boolean(p.isReplenishment) || p.category.toLowerCase().includes('float');
      run += isIn ? Number(p.amount) || 0 : -(Number(p.amount) || 0);
      return { ...p, isIn, runningBalance: run };
    });
    return items.reverse();
  }, [filteredPettyCash]);

  // ===========================================================================
  // 4. OWNER DRAWINGS & CAPITAL LEDGER (SEPARATE FROM OPERATING P&L)
  // ===========================================================================
  const totalCapitalInjections = useMemo(() => {
    return filteredOwnerLedger
      .filter((o) => o.type === 'Capital Injection')
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
  }, [filteredOwnerLedger]);

  const totalOwnerDrawingsOutflow = useMemo(() => {
    return filteredOwnerLedger
      .filter((o) => o.type !== 'Capital Injection')
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
  }, [filteredOwnerLedger]);

  // ===========================================================================
  // 5. STAFF REIMBURSEMENTS (PENDING VS PAID)
  // ===========================================================================
  const totalPaidReimbursements = useMemo(() => {
    return filteredReimbursements
      .filter((r) => r.status === 'Paid')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [filteredReimbursements]);

  const totalPendingReimbursements = useMemo(() => {
    return filteredReimbursements
      .filter((r) => r.status === 'Pending' || r.status === 'Approved')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [filteredReimbursements]);

  // ===========================================================================
  // 6. TOTAL COLLECTIONS, REVENUE, EXPENSES & NET LIQUIDITY
  // ===========================================================================
  // Total Hotel Collections (Actual money collected across all modules)
  const totalHotelCollections = useMemo(() => {
    return r2(allIncomeTransactions.reduce((s, t) => s + t.amount, 0));
  }, [allIncomeTransactions]);

  // Accurate Pre-Tax Operating Revenue Breakdown (F1–F4 fixed: includes Room, Extra Bed/Pax, Early Check-In, Water, Room-Billed POS Pre-Tax, Counter POS Pre-Tax, Laundry, Services, Misc — NO double tax!)
  const operatingRevenueBreakdown = useMemo(() => {
    let roomPreTax = 0;
    let roomAddOnsPreTax = 0;
    let refunds = 0;

    filteredBookingsForPl.forEach((b) => {
      refunds += Number(b.refundAmount) || 0;
      if (b.status === 'Cancelled' || b.status === 'No-Show') return;
      const rm = Number(b.roomSubtotal) || 0;
      const srv = Number(b.otherServicesTotal) || 0;
      const disc = Number(b.discountAmount) || 0;
      const roomCut = Math.min(rm, disc);
      const srvCut = Math.min(srv, Math.max(0, disc - roomCut));
      roomPreTax += Math.max(0, rm - roomCut);
      roomAddOnsPreTax += Math.max(0, srv - srvCut);
    });

    // Counter-paid POS ONLY (exclude Room Charge so room-billed POS is never double-counted!)
    const counterPosPreTax = filteredPosOrdersForPl
      .filter((p) => p.paymentStatus === 'Paid' && p.paymentMethod !== 'Room Charge')
      .reduce((s, p) => {
        const sub = Number(p.subtotal) || 0;
        const disc = Number(p.discount) || 0;
        if (sub > 0) return s + Math.max(0, sub - disc);
        return s + Math.max(0, (Number(p.grandTotal) || 0) - (Number(p.taxAmount) || 0));
      }, 0);

    // Counter-paid Laundry ONLY (exclude Billed to Room)
    const counterLaundryPreTax = filteredLaundryForPl
      .filter((l) => l.paymentStatus === 'Paid')
      .reduce((s, l) => s + (Number(l.totalAmount) || 0), 0);

    const miscPreTax = filteredMiscIncomeForPl.reduce((s, m) => {
      const gross = Number(m.amount) || 0;
      const gst =
        Number(m.gstAmount) > 0
          ? Number(m.gstAmount)
          : Number(m.gstRate) > 0
          ? r2((gross * Number(m.gstRate)) / (100 + Number(m.gstRate)))
          : 0;
      return s + Math.max(0, gross - gst);
    }, 0);

    const totalPreTax = Math.max(
      0,
      r2(roomPreTax + roomAddOnsPreTax + counterPosPreTax + counterLaundryPreTax + miscPreTax - refunds)
    );

    return {
      roomPreTax: r2(roomPreTax),
      roomAddOnsPreTax: r2(roomAddOnsPreTax),
      counterPosPreTax: r2(counterPosPreTax),
      counterLaundryPreTax: r2(counterLaundryPreTax),
      miscPreTax: r2(miscPreTax),
      refunds: r2(refunds),
      totalPreTax,
    };
  }, [filteredBookingsForPl, filteredPosOrdersForPl, filteredLaundryForPl, filteredMiscIncomeForPl]);

  const totalOperatingRevenue = operatingRevenueBreakdown.totalPreTax;

  // Pending Guest / Room Balance Due in selected date range
  const pendingDueBookings = useMemo(() => {
    return filteredBookingsForPl.filter(
      (b) => b.status !== 'Cancelled' && b.status !== 'No-Show' && (Number(b.dueAmount) || 0) > 0
    );
  }, [filteredBookingsForPl]);

  const totalPendingBalanceDue = useMemo(() => {
    return r2(pendingDueBookings.reduce((s, b) => s + (Number(b.dueAmount) || 0), 0));
  }, [pendingDueBookings]);

  // Total Operating Expenses (Paid operational expenses + paid staff claims + direct petty spend)
  // CRITICAL: Owner drawings are excluded, and expenses already deducted from Petty Cash are not double-counted!
  const totalOperatingExpenses = useMemo(() => {
    return r2(totalPaidExpensesOutflow + directPettyCashSpendsOnly + totalPaidReimbursements);
  }, [totalPaidExpensesOutflow, directPettyCashSpendsOnly, totalPaidReimbursements]);

  // GOP & EBITDA
  const grossOperatingProfit = r2(totalOperatingRevenue - totalOperatingExpenses);
  const ebitdaMarginPercent =
    totalOperatingRevenue > 0 ? Math.round((grossOperatingProfit / totalOperatingRevenue) * 100) : 0;

  // Mode-wise Inflows & Outflows
  const modeBreakdown = useMemo(() => {
    const map: Record<string, { inflow: number; outflow: number }> = {
      Cash: { inflow: 0, outflow: 0 },
      UPI: { inflow: 0, outflow: 0 },
      Card: { inflow: 0, outflow: 0 },
      'Bank Transfer': { inflow: 0, outflow: 0 },
    };

    const normalizeMode = (m?: string): 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' => {
      if (!m) return 'Cash';
      const low = m.toLowerCase();
      if (low.includes('upi')) return 'UPI';
      if (low.includes('card')) return 'Card';
      if (low.includes('bank') || low.includes('neft') || low.includes('cheque') || low.includes('online'))
        return 'Bank Transfer';
      return 'Cash';
    };

    // Inflows from all income transactions
    allIncomeTransactions.forEach((t) => {
      const mode = normalizeMode(t.paymentMode);
      if (t.amount >= 0) {
        map[mode].inflow += t.amount;
      } else {
        // Refund outflow
        map[mode].outflow += Math.abs(t.amount);
      }
    });

    // Inflows from Owner Capital Injections
    filteredOwnerLedger.forEach((ol) => {
      const mode = normalizeMode(ol.paymentMethod);
      if (ol.type === 'Capital Injection') {
        map[mode].inflow += Number(ol.amount) || 0;
      } else {
        map[mode].outflow += Number(ol.amount) || 0;
      }
    });

    // Outflows from Paid Operational Expenses
    filteredExpenses.forEach((e) => {
      if (e.paymentStatus !== 'Pending / Payable') {
        const mode = normalizeMode(e.paymentMethod);
        map[mode].outflow += Number(e.amount) || 0;
      }
    });

    // Outflows from Direct Petty Cash Spend (excluding expense-synced entries so they aren't double-counted)
    map.Cash.outflow += directPettyCashSpendsOnly;

    // Outflows from Paid Staff Reimbursements
    filteredReimbursements.forEach((r) => {
      if (r.status === 'Paid') {
        map.Cash.outflow += Number(r.amount) || 0;
      }
    });

    // Outflows from Paid Vendor Bills
    filteredVendorBills.forEach((vb) => {
      if (Array.isArray(vb.payments) && vb.payments.length > 0) {
        vb.payments.forEach((p) => {
          const mode = normalizeMode(p.paymentMethod);
          map[mode].outflow += Number(p.amount) || 0;
        });
      } else if ((Number(vb.paidAmount) || 0) > 0) {
        map['Bank Transfer'].outflow += Number(vb.paidAmount) || 0;
      }
    });

    // Outflows from Standalone Manual Payment Vouchers
    filteredVouchers.forEach((v) => {
      if (
        v.type === 'Payment Voucher' &&
        v.sourceType === 'manual_voucher' &&
        (Number(v.amount) || 0) > 0
      ) {
        const mode = normalizeMode(v.paymentMethod);
        map[mode].outflow += Number(v.amount) || 0;
      }
    });

    return map;
  }, [
    allIncomeTransactions,
    filteredOwnerLedger,
    filteredExpenses,
    directPettyCashSpendsOnly,
    filteredReimbursements,
    filteredVendorBills,
    filteredVouchers,
  ]);

  // Live effective accounts with real-time Inflows, Outflows & Current Balance from modeBreakdown
  const effectiveAccounts: CashBankAccountRecord[] = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    baseAccounts.forEach((a) => {
      typeCounts[a.accountType] = (typeCounts[a.accountType] || 0) + 1;
    });

    const firstIdByType: Record<string, string> = {};
    baseAccounts.forEach((a) => {
      if (!firstIdByType[a.accountType]) firstIdByType[a.accountType] = a.id;
    });

    return baseAccounts.map((acc) => {
      const isPrimaryForType = firstIdByType[acc.accountType] === acc.id;
      let modeIn = 0;
      let modeOut = 0;
      if (isPrimaryForType) {
        if (acc.accountType === 'Cash Drawer') {
          modeIn = modeBreakdown.Cash.inflow;
          modeOut = modeBreakdown.Cash.outflow;
        } else if (acc.accountType === 'Bank Account') {
          modeIn = modeBreakdown['Bank Transfer'].inflow;
          modeOut = modeBreakdown['Bank Transfer'].outflow;
        } else if (acc.accountType === 'UPI Merchant') {
          modeIn = modeBreakdown.UPI.inflow;
          modeOut = modeBreakdown.UPI.outflow;
        } else if (acc.accountType === 'POS Card Terminal') {
          modeIn = modeBreakdown.Card.inflow;
          modeOut = modeBreakdown.Card.outflow;
        }
      }

      const totalIn = (Number(acc.inflowTotal) || 0) + modeIn;
      const totalOut = (Number(acc.outflowTotal) || 0) + modeOut;
      const openBal = Number(acc.openingBalance) || 0;
      const liveBal = openBal + totalIn - totalOut;

      return {
        ...acc,
        openingBalance: openBal,
        inflowTotal: totalIn,
        outflowTotal: totalOut,
        currentBalance: liveBal,
      };
    });
  }, [baseAccounts, modeBreakdown]);

  // Cash Balance & Bank Balance
  const totalCashBalance = useMemo(() => {
    const cashOpening = baseAccounts
      .filter((a) => a.accountType === 'Cash Drawer')
      .reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
    return cashOpening + modeBreakdown.Cash.inflow - modeBreakdown.Cash.outflow;
  }, [baseAccounts, modeBreakdown.Cash]);

  const totalBankBalance = useMemo(() => {
    const bankOpening = baseAccounts
      .filter((a) => a.accountType === 'Bank Account' || a.accountType === 'UPI Merchant' || a.accountType === 'POS Card Terminal')
      .reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
    const bankIn = modeBreakdown['Bank Transfer'].inflow + modeBreakdown.UPI.inflow + modeBreakdown.Card.inflow;
    const bankOut = modeBreakdown['Bank Transfer'].outflow + modeBreakdown.UPI.outflow + modeBreakdown.Card.outflow;
    return bankOpening + bankIn - bankOut;
  }, [baseAccounts, modeBreakdown]);

  const netLiquidity = totalCashBalance + totalBankBalance + availablePettyCashBalance;

  // ===========================================================================
  // 7. VOUCHERS LISTS (PAYMENT & RECEIPT)
  // ===========================================================================
  const paymentVouchers = useMemo(() => {
    return filteredVouchers.filter((v) => v.type === 'Payment Voucher').sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredVouchers]);

  const receiptVouchers = useMemo(() => {
    return filteredVouchers.filter((v) => v.type === 'Receipt Voucher').sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredVouchers]);

  // ===========================================================================
  // 8. VENDOR BILLS & OUTSTANDING PAYABLES
  // ===========================================================================
  const totalOutstandingVendorPayables = useMemo(() => {
    return filteredVendorBills.reduce((s, b) => s + (Number(b.remainingPayable) || 0), 0);
  }, [filteredVendorBills]);

  // ===========================================================================
  // 9. DAILY SHIFT CLOSING CALCULATIONS
  // ===========================================================================
  const [dcDate, setDcDate] = useState(todayStr);
  const [dcOpeningCash, setDcOpeningCash] = useState<number>(0);
  const [dcPhysicalCash, setDcPhysicalCash] = useState<number>(0);
  const [dcClosedBy, setDcClosedBy] = useState('Front Desk Cashier');
  const [dcRemarks, setDcRemarks] = useState('');
  const [dcDenominations, setDcDenominations] = useState<{ [denom: string]: number }>({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    coins: 0,
  });

  // Calculate actual shift cash flows for dcDate
  const shiftCashInflows = useMemo(() => {
    const roomCash = allIncomeTransactions
      .filter((t) => t.date === dcDate && t.sourceModule === 'Front Desk' && t.paymentMode.toLowerCase() === 'cash' && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    const posCash = allIncomeTransactions
      .filter((t) => t.date === dcDate && t.sourceModule === 'POS Restaurant' && t.paymentMode.toLowerCase() === 'cash')
      .reduce((s, t) => s + t.amount, 0);
    const miscCash = allIncomeTransactions
      .filter((t) => t.date === dcDate && (t.sourceModule === 'Miscellaneous Income' || t.sourceModule === 'Laundry & Guest Services') && t.paymentMode.toLowerCase() === 'cash')
      .reduce((s, t) => s + t.amount, 0);
    return { roomCash, posCash, miscCash, total: roomCash + posCash + miscCash };
  }, [allIncomeTransactions, dcDate]);

  const shiftCashOutflows = useMemo(() => {
    const refundsCash = Math.abs(
      allIncomeTransactions
        .filter((t) => t.date === dcDate && t.isRefund && t.paymentMode.toLowerCase() === 'cash')
        .reduce((s, t) => s + t.amount, 0)
    );
    const expensesCash = localExpenses
      .filter((e) => e.date === dcDate && e.paymentStatus !== 'Pending / Payable' && e.paymentMethod.toLowerCase() === 'cash')
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const pettyCashDisbursed = localPettyCash
      .filter((p) => p.date === dcDate && p.type === 'Outflow')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return { refundsCash, expensesCash, pettyCashDisbursed, total: refundsCash + expensesCash + pettyCashDisbursed };
  }, [allIncomeTransactions, localExpenses, localPettyCash, dcDate]);

  const expectedShiftCash = dcOpeningCash + shiftCashInflows.total - shiftCashOutflows.total;
  const shiftCashVariance = dcPhysicalCash - expectedShiftCash;

  // Auto-calculate counted cash from denominations if entered
  const computedDenominationsTotal = useMemo(() => {
    return (
      (dcDenominations['500'] || 0) * 500 +
      (dcDenominations['200'] || 0) * 200 +
      (dcDenominations['100'] || 0) * 100 +
      (dcDenominations['50'] || 0) * 50 +
      (dcDenominations['20'] || 0) * 20 +
      (dcDenominations['10'] || 0) * 10 +
      (dcDenominations.coins || 0)
    );
  }, [dcDenominations]);

  // ===========================================================================
  // 10. GST SUMMARY & INPUT TAX CREDIT (F1–F4 ACCURATE — NO POS DOUBLE COUNT!)
  // ===========================================================================
  const gstBreakdown = useMemo(() => {
    let outputTaxable = 0;
    let outputCgst = 0;
    let outputSgst = 0;

    // 1. Bookings (includes Room + Extra Bed/Person + Early Check-In + Water + Room-Billed POS + Services; b.taxAmount comes from single bill calculator!)
    filteredBookingsForPl.forEach((b) => {
      if (b.status === 'Cancelled' || b.status === 'No-Show') return;
      const bkgTaxable = Math.max(
        0,
        r2((Number(b.roomSubtotal) || 0) + (Number(b.otherServicesTotal) || 0) - (Number(b.discountAmount) || 0))
      );
      const tax = b.gstInvoice ? r2(Number(b.taxAmount) || 0) : 0;
      const halfCgst = r2(tax / 2);
      const halfSgst = r2(tax - halfCgst);
      outputTaxable = r2(outputTaxable + bkgTaxable);
      outputCgst = r2(outputCgst + halfCgst);
      outputSgst = r2(outputSgst + halfSgst);
    });

    // 2. Counter-Paid POS Orders ONLY (exclude Room Charge so room-billed POS GST is NEVER double-counted!)
    filteredPosOrdersForPl.forEach((po) => {
      if (po.paymentStatus === 'Paid' && po.paymentMethod !== 'Room Charge') {
        const sub = Number(po.subtotal) || 0;
        const disc = Number(po.discount) || 0;
        const tax = r2(Number(po.taxAmount) || 0);
        const taxable =
          sub > 0 ? Math.max(0, r2(sub - disc)) : Math.max(0, r2((Number(po.grandTotal) || 0) - tax));
        const halfCgst = r2(tax / 2);
        const halfSgst = r2(tax - halfCgst);
        outputTaxable = r2(outputTaxable + taxable);
        outputCgst = r2(outputCgst + halfCgst);
        outputSgst = r2(outputSgst + halfSgst);
      }
    });

    // 3. Miscellaneous Hotel Income
    filteredMiscIncomeForPl.forEach((mi) => {
      const amt = r2(Number(mi.amount) || 0);
      const rate = Number(mi.gstRate || 0);
      if (rate > 0) {
        const tax = Number(mi.gstAmount) > 0 ? r2(mi.gstAmount) : r2((amt * rate) / (100 + rate));
        const taxable = Math.max(0, r2(amt - tax));
        const halfCgst = r2(tax / 2);
        const halfSgst = r2(tax - halfCgst);
        outputTaxable = r2(outputTaxable + taxable);
        outputCgst = r2(outputCgst + halfCgst);
        outputSgst = r2(outputSgst + halfSgst);
      } else {
        outputTaxable = r2(outputTaxable + amt);
      }
    });

    const totalOutputGst = r2(outputCgst + outputSgst);

    // Input GST from eligible expense bills & vendor purchases
    let inputTaxable = 0;
    let inputCgst = 0;
    let inputSgst = 0;

    filteredExpenses.forEach((e) => {
      const gross = r2(Number(e.amount) || 0);
      const itc = r2(Number(e.gstAmount) || 0);
      if (itc > 0) {
        inputTaxable = r2(inputTaxable + Math.max(0, gross - itc));
        const half = r2(itc / 2);
        inputCgst = r2(inputCgst + half);
        inputSgst = r2(inputSgst + r2(itc - half));
      }
    });

    filteredVendorBills.forEach((vb) => {
      const itc = r2(Number(vb.gstAmount) || 0);
      if (itc > 0) {
        const half = r2(itc / 2);
        inputCgst = r2(inputCgst + half);
        inputSgst = r2(inputSgst + r2(itc - half));
      }
    });

    const totalInputItc = r2(inputCgst + inputSgst);
    const netGstPayable = Math.max(0, r2(totalOutputGst - totalInputItc));
    const itcCarriedForward = Math.max(0, r2(totalInputItc - totalOutputGst));

    return {
      outputTaxable: r2(outputTaxable),
      outputCgst,
      outputSgst,
      totalOutputGst,
      inputTaxable: r2(inputTaxable),
      inputCgst,
      inputSgst,
      totalInputItc,
      netGstPayable,
      itcCarriedForward,
    };
  }, [filteredBookingsForPl, filteredPosOrdersForPl, filteredMiscIncomeForPl, filteredExpenses, filteredVendorBills]);

  // Hotel Hisaab Totals & Date-Wise Daybook Ledger
  const totalBillingGross = useMemo(
    () => r2(totalOperatingRevenue + gstBreakdown.totalOutputGst),
    [totalOperatingRevenue, gstBreakdown.totalOutputGst]
  );
  const netReceivedMinusExpenses = useMemo(
    () => r2(totalHotelCollections - totalOperatingExpenses),
    [totalHotelCollections, totalOperatingExpenses]
  );

  const daybookEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      date: string;
      particulars: string;
      subDetail: string;
      refNo: string;
      paymentMode: string;
      moneyIn: number;
      moneyOut: number;
    }> = [];

    // 1. All Income & Guest Refunds
    allIncomeTransactions.forEach((tx) => {
      if (tx.amount >= 0) {
        entries.push({
          id: `in-${tx.id}`,
          date: tx.date,
          particulars: tx.partyName,
          subDetail: `${tx.category} (${tx.sourceModule})`,
          refNo: tx.refNo,
          paymentMode: tx.paymentMode || 'Cash',
          moneyIn: r2(tx.amount),
          moneyOut: 0,
        });
      } else {
        entries.push({
          id: `ref-${tx.id}`,
          date: tx.date,
          particulars: tx.partyName,
          subDetail: tx.category || 'Guest Refund',
          refNo: tx.refNo,
          paymentMode: tx.paymentMode || 'UPI',
          moneyIn: 0,
          moneyOut: r2(Math.abs(tx.amount)),
        });
      }
    });

    // 2. Paid Operational Expenses
    filteredExpenses.forEach((e) => {
      if (e.paymentStatus === 'Pending / Payable') return;
      entries.push({
        id: `exp-${e.id}`,
        date: e.date,
        particulars: `${e.category} — ${e.vendorName}`,
        subDetail: e.description || e.department,
        refNo: e.invoiceNumber || e.expenseNo,
        paymentMode: e.paymentMethod || 'Cash',
        moneyIn: 0,
        moneyOut: r2(Number(e.amount) || 0),
      });
    });

    // 3. Direct Petty Cash Outflows (not already synced from an Expense)
    filteredPettyCash.forEach((pc) => {
      if (
        pc.type === 'Outflow' &&
        !pc.isReplenishment &&
        !pc.category.toLowerCase().includes('float') &&
        !String(pc.notes || '').startsWith('Expense #')
      ) {
        entries.push({
          id: `pc-${pc.id}`,
          date: pc.date,
          particulars: `Petty Cash: ${pc.category}${pc.paidTo ? ` — ${pc.paidTo}` : ''}`,
          subDetail: pc.notes || `Handled by ${pc.handler}`,
          refNo: pc.receiptReference || pc.id,
          paymentMode: 'Cash',
          moneyIn: 0,
          moneyOut: r2(Number(pc.amount) || 0),
        });
      }
    });

    // 4. Paid Staff Reimbursements
    filteredReimbursements.forEach((rm) => {
      if (rm.status !== 'Paid') return;
      entries.push({
        id: `rm-${rm.id}`,
        date: rm.date,
        particulars: `Staff Claim: ${rm.staffName} (${rm.department})`,
        subDetail: rm.title,
        refNo: rm.id,
        paymentMode: 'Cash',
        moneyIn: 0,
        moneyOut: r2(Number(rm.amount) || 0),
      });
    });

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [allIncomeTransactions, filteredExpenses, filteredPettyCash, filteredReimbursements]);

  const filteredDaybookEntries = useMemo(() => {
    const q = daybookSearch.toLowerCase().trim();
    return daybookEntries.filter((row) => {
      if (daybookTypeFilter === 'in' && !(row.moneyIn > 0)) return false;
      if (daybookTypeFilter === 'out' && !(row.moneyOut > 0)) return false;
      if (!q) return true;
      return (
        row.particulars.toLowerCase().includes(q) ||
        row.subDetail.toLowerCase().includes(q) ||
        row.refNo.toLowerCase().includes(q) ||
        row.paymentMode.toLowerCase().includes(q) ||
        row.date.includes(q)
      );
    });
  }, [daybookEntries, daybookSearch, daybookTypeFilter]);

  const handleExportDaybookCsv = () => {
    const headers = ['Date', 'Particulars', 'Category / Details', 'Bill / Ref No.', 'Payment Mode', 'Money In (+)', 'Money Out (-)'];
    const escCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvRows = [
      headers.join(','),
      ...filteredDaybookEntries.map((r) =>
        [
          escCsv(r.date),
          escCsv(r.particulars),
          escCsv(r.subDetail),
          escCsv(r.refNo),
          escCsv(r.paymentMode),
          r.moneyIn.toFixed(2),
          r.moneyOut.toFixed(2),
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hotel-Daybook-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintDaybook = () => {
    const totIn = r2(filteredDaybookEntries.reduce((s, r) => s + r.moneyIn, 0));
    const totOut = r2(filteredDaybookEntries.reduce((s, r) => s + r.moneyOut, 0));
    const rowsHtml = filteredDaybookEntries
      .map(
        (r) => `<tr>
          <td style="padding:5px 6px;border-bottom:1px solid #ddd">${r.date}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #ddd"><strong>${r.particulars}</strong><div style="font-size:10px;color:#555">${r.subDetail}</div></td>
          <td style="padding:5px 6px;border-bottom:1px solid #ddd">${r.refNo}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #ddd">${r.paymentMode}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #ddd;text-align:right;color:#047857;font-weight:700">${r.moneyIn > 0 ? `Rs ${r.moneyIn.toFixed(2)}` : '-'}</td>
          <td style="padding:5px 6px;border-bottom:1px solid #ddd;text-align:right;color:#be123c;font-weight:700">${r.moneyOut > 0 ? `Rs ${r.moneyOut.toFixed(2)}` : '-'}</td>
        </tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Hotel Daybook</title>
      <style>body{font-family:Arial,sans-serif;padding:16px;font-size:12px;color:#111}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#111;color:#fff;padding:6px;text-align:left}</style>
      </head><body>
      <h2 style="margin:0">Hotel Hisaab — Date-Wise Daybook Ledger</h2>
      <p style="margin:4px 0 10px;color:#555">Total Billing: Rs ${totalBillingGross.toFixed(2)} | Total Received: Rs ${totalHotelCollections.toFixed(2)} | Pending Due: Rs ${totalPendingBalanceDue.toFixed(2)} | Expenses: Rs ${totalOperatingExpenses.toFixed(2)} | Net Balance: Rs ${netReceivedMinusExpenses.toFixed(2)}</p>
      <table><thead><tr><th>Date</th><th>Particulars</th><th>Bill / Ref No.</th><th>Mode</th><th style="text-align:right">Money In (+)</th><th style="text-align:right">Money Out (-)</th></tr></thead>
      <tbody>${rowsHtml}
      <tr style="font-weight:700;background:#f8fafc"><td colspan="4" style="padding:6px">TOTAL</td><td style="padding:6px;text-align:right;color:#047857">Rs ${totIn.toFixed(2)}</td><td style="padding:6px;text-align:right;color:#be123c">Rs ${totOut.toFixed(2)}</td></tr>
      </tbody></table></body></html>`;
    openPrintWindow(html, true);
  };

  // ===========================================================================
  // FORM STATES & ACTION HANDLERS
  // ===========================================================================
  // Hybrid / Split Payment state for Finance Hub forms
  const [finHybridRows, setFinHybridRows] = useState<Record<string, HybridSplitRow[]>>({});
  const [finHybridActive, setFinHybridActive] = useState<Record<string, boolean>>({});

  // Form 1: Miscellaneous Income
  const [miscForm, setMiscForm] = useState({
    incomeCategory: MISC_INCOME_CATEGORIES[0],
    customCategory: '',
    description: '',
    amount: 0,
    gstRate: 5,
    paymentMode: 'Cash' as PaymentMethod,
    transactionDate: todayStr,
    referenceNumber: '',
    remarks: '',
  });

  const handleMiscIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!miscForm.description.trim() || miscForm.amount <= 0) {
      triggerToast('Please enter a valid description and amount.');
      return;
    }

    const calcGstAmt =
      miscForm.gstRate > 0
        ? Math.round(((miscForm.amount * miscForm.gstRate) / (100 + miscForm.gstRate)) * 100) / 100
        : 0;

    const voucherNum = `RV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const newMisc: MiscellaneousIncomeRecord = {
      id: `MISC-${Date.now()}`,
      incomeCategory: miscForm.incomeCategory,
      customCategory: miscForm.customCategory.trim(),
      description: miscForm.description.trim(),
      amount: miscForm.amount,
      gstRate: miscForm.gstRate,
      gstAmount: calcGstAmt,
      paymentMode: miscForm.paymentMode,
      transactionDate: miscForm.transactionDate || todayStr,
      referenceNumber: miscForm.referenceNumber.trim() || `REF-${Date.now().toString().slice(-5)}`,
      voucherNumber: voucherNum,
      remarks: miscForm.remarks.trim(),
      createdAt: new Date().toISOString(),
    };

    setLocalMiscIncome((prev) => [newMisc, ...prev]);
    if (onAddMiscIncome) onAddMiscIncome(newMisc);

    // Auto-generate Receipt Voucher RV-XXXX
    const newVoucher: FinanceVoucherRecord = {
      id: `VCH-${Date.now()}`,
      voucherNo: voucherNum,
      type: 'Receipt Voucher',
      date: newMisc.transactionDate,
      partyName: newMisc.description,
      category: newMisc.incomeCategory === 'Other Income (Custom)' ? newMisc.customCategory || 'Other Income' : newMisc.incomeCategory,
      amount: newMisc.amount,
      paymentMethod: newMisc.paymentMode,
      referenceNo: newMisc.referenceNumber,
      narration: `Misc Hotel Income: ${newMisc.description}${newMisc.remarks ? ` • ${newMisc.remarks}` : ''}`,
      preparedBy: 'Accounts / Front Desk',
      sourceType: 'misc_income',
      sourceId: newMisc.id,
    };
    setLocalVouchers((prev) => [newVoucher, ...prev]);
    if (onAddVoucher) onAddVoucher(newVoucher);

    setMiscForm({
      incomeCategory: MISC_INCOME_CATEGORIES[0],
      customCategory: '',
      description: '',
      amount: 0,
      gstRate: 5,
      paymentMode: 'Cash',
      transactionDate: todayStr,
      referenceNumber: '',
      remarks: '',
    });
    triggerToast(`Recorded ₹${Number(newMisc.amount || 0).toLocaleString('en-IN')} income & generated Receipt Voucher ${voucherNum}!`);
  };

  // Form 2: Operational & Extra Expense
  const [expForm, setExpForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    customCategory: '',
    department: 'Front Office & Operations',
    vendorName: '',
    invoiceNumber: '',
    invoiceDate: todayStr,
    amount: 0,
    gstRate: 5,
    gstAmount: 0,
    paymentMethod: 'Cash' as PaymentMethod,
    paymentStatus: 'Paid' as 'Paid' | 'Pending / Payable',
    remarks: '',
    billAttachment: '',
  });

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expForm.amount <= 0 || (!expForm.vendorName.trim() && !expForm.remarks.trim())) {
      triggerToast('Please enter bill amount and vendor/details.');
      return;
    }

    const expNo = `EXP-${Date.now().toString().slice(-5)}`;
    const finalCategory =
      expForm.category === 'Other / Extra Expense (Custom)'
        ? expForm.customCategory.trim() || 'Custom Extra Expense'
        : expForm.category;

    const calcGstAmt =
      expForm.gstAmount > 0
        ? expForm.gstAmount
        : expForm.gstRate > 0
        ? Math.round(((expForm.amount * expForm.gstRate) / (100 + expForm.gstRate)) * 100) / 100
        : 0;

    const isPaid = expForm.paymentStatus === 'Paid';
    const newExp: FinanceExpenseRecord = {
      id: `EXP-${Date.now()}`,
      expenseNo: expNo,
      date: expForm.invoiceDate || todayStr,
      category: finalCategory,
      customCategory: expForm.customCategory.trim(),
      department: expForm.department,
      vendorName: expForm.vendorName.trim() || 'Direct Vendor / Store',
      description: expForm.remarks.trim() || `${finalCategory} bill #${expForm.invoiceNumber || expNo}`,
      amount: expForm.amount,
      gstRate: expForm.gstRate,
      gstAmount: calcGstAmt,
      paymentMethod: expForm.paymentMethod,
      paymentStatus: expForm.paymentStatus,
      amountPaid: isPaid ? expForm.amount : 0,
      outstandingAmount: isPaid ? 0 : expForm.amount,
      paidDate: isPaid ? expForm.invoiceDate || todayStr : undefined,
      invoiceNumber: expForm.invoiceNumber.trim() || expNo,
      billAttachment: expForm.billAttachment.trim(),
      approvalStatus: 'Approved',
      recordedBy: 'Accounts / Manager',
      remarks: expForm.remarks.trim(),
      sourceType: 'manual_expense',
    };

    setLocalExpenses((prev) => [newExp, ...prev]);
    onAddExpense(newExp);

    // If payment status is Paid, generate Payment Voucher PV-XXXX AND deduct from Petty Cash Drawer
    if (isPaid) {
      const vchNo = `PV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const newVch: FinanceVoucherRecord = {
        id: `VCH-${Date.now()}`,
        voucherNo: vchNo,
        type: 'Payment Voucher',
        date: newExp.date,
        partyName: newExp.vendorName,
        category: newExp.category,
        amount: newExp.amount,
        paymentMethod: newExp.paymentMethod,
        referenceNo: newExp.expenseNo,
        narration: `Paid from Petty Cash for ${newExp.description}`,
        preparedBy: newExp.recordedBy,
        sourceType: 'expense',
        sourceId: newExp.id,
      };
      setLocalVouchers((prev) => [newVch, ...prev]);
      if (onAddVoucher) onAddVoucher(newVch);

      // Automatically deduct Expense from Petty Cash Drawer ("exprense hamerh petty cash se aaye")
      const newPcOutflow: PettyCashRecord = {
        id: `PC-EXP-${Date.now()}`,
        date: newExp.date,
        type: 'Outflow',
        isReplenishment: false,
        category: newExp.category,
        amount: newExp.amount,
        paidTo: newExp.vendorName,
        handler: newExp.recordedBy,
        receiptReference: newExp.expenseNo,
        notes: `Expense #${newExp.expenseNo}: ${newExp.description}`,
      };
      setLocalPettyCash((prev) => [newPcOutflow, ...prev]);
      if (onAddPettyCash) onAddPettyCash(newPcOutflow);

      triggerToast(`Expense ₹${Number(newExp.amount || 0).toLocaleString('en-IN')} deducted from Petty Cash & Payment Voucher ${vchNo} issued!`);
    } else {
      triggerToast(`Recorded payable expense ₹${Number(newExp.amount || 0).toLocaleString('en-IN')} under ${newExp.vendorName}. Petty Cash will deduct upon settlement.`);
    }

    setExpForm({
      category: EXPENSE_CATEGORIES[0],
      customCategory: '',
      department: 'Front Office & Operations',
      vendorName: '',
      invoiceNumber: '',
      invoiceDate: todayStr,
      amount: 0,
      gstRate: 5,
      gstAmount: 0,
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      remarks: '',
      billAttachment: '',
    });
  };

  // Pay/Settle an unpaid expense
  const handleSettleUnpaidExpense = (exp: FinanceExpenseRecord) => {
    const payAmt = exp.outstandingAmount || exp.amount;
    const vchNo = `PV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const updated: Partial<FinanceExpenseRecord> = {
      paymentStatus: 'Paid',
      amountPaid: exp.amount,
      outstandingAmount: 0,
      paidDate: todayStr,
    };

    setLocalExpenses((prev) =>
      prev.map((e) => (e.id === exp.id ? { ...e, ...updated } : e))
    );
    if (onUpdateExpense) onUpdateExpense(exp.id, updated);

    // Issue payment voucher
    const newVch: FinanceVoucherRecord = {
      id: `VCH-${Date.now()}`,
      voucherNo: vchNo,
      type: 'Payment Voucher',
      date: todayStr,
      partyName: exp.vendorName,
      category: exp.category,
      amount: payAmt,
      paymentMethod: exp.paymentMethod || 'Bank Transfer',
      referenceNo: exp.expenseNo,
      narration: `Settled payable for ${exp.description}`,
      preparedBy: 'Accounts',
      sourceType: 'expense',
      sourceId: exp.id,
    };
    setLocalVouchers((prev) => [newVch, ...prev]);
    if (onAddVoucher) onAddVoucher(newVch);

    // Deduct settled expense from Petty Cash Drawer
    const newPcOutflow: PettyCashRecord = {
      id: `PC-EXP-${Date.now()}`,
      date: todayStr,
      type: 'Outflow',
      isReplenishment: false,
      category: exp.category,
      amount: payAmt,
      paidTo: exp.vendorName,
      handler: 'Accounts',
      receiptReference: exp.expenseNo,
      notes: `Expense #${exp.expenseNo}: ${exp.description}`,
    };
    setLocalPettyCash((prev) => [newPcOutflow, ...prev]);
    if (onAddPettyCash) onAddPettyCash(newPcOutflow);

    triggerToast(`Settled ₹${payAmt.toLocaleString('en-IN')} from Petty Cash for ${exp.vendorName} & issued Payment Voucher ${vchNo}!`);
  };

  // Form 3: Petty Cash Drawer (Replenishment vs Spend)
  const [pcTab, setPcTab] = useState<'Spend' | 'Replenish'>('Spend');
  const [pcForm, setPcForm] = useState({
    category: PETTY_CASH_CATEGORIES[0],
    customCategory: '',
    amount: 0,
    date: todayStr,
    paidTo: '',
    receiptReference: '',
    description: '',
    handler: 'Reception Cashier',
    // Replenishment specific
    sourceAccount: 'Reception Cash Drawer',
  });

  const handlePettyCashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pcForm.amount <= 0) {
      triggerToast('Please enter a positive amount.');
      return;
    }

    if (pcTab === 'Replenish') {
      // Internal Fund Transfer from Main Cash/Bank into Petty Cash Drawer!
      const newPc: PettyCashRecord = {
        id: `PC-${Date.now()}`,
        date: pcForm.date || todayStr,
        type: 'Inflow',
        isReplenishment: true,
        category: 'Cash Float Replenishment',
        amount: pcForm.amount,
        handler: pcForm.handler.trim() || 'Accounts / Cashier',
        sourceAccount: pcForm.sourceAccount,
        receiptReference: pcForm.receiptReference.trim() || `TOPUP-${Date.now().toString().slice(-4)}`,
        notes: `Internal Fund Transfer from ${pcForm.sourceAccount} to Petty Cash Drawer: ${pcForm.description || 'Replenish float'}`,
      };

      setLocalPettyCash((prev) => [newPc, ...prev]);
      if (onAddPettyCash) onAddPettyCash(newPc);

      triggerToast(`Added ₹${Number(pcForm.amount || 0).toLocaleString('en-IN')} float from ${pcForm.sourceAccount} to Petty Cash Drawer! (Internal Transfer, excluded from P&L revenue)`);
    } else {
      // Petty Cash Spend
      const finalCat =
        pcForm.category === 'Other Petty Expense (Custom)'
          ? pcForm.customCategory.trim() || 'Other Petty Expense'
          : pcForm.category;

      const newPc: PettyCashRecord = {
        id: `PC-${Date.now()}`,
        date: pcForm.date || todayStr,
        type: 'Outflow',
        isReplenishment: false,
        category: finalCat,
        amount: pcForm.amount,
        paidTo: pcForm.paidTo.trim() || 'Local Vendor',
        handler: pcForm.handler.trim() || 'Reception Cashier',
        receiptReference: pcForm.receiptReference.trim(),
        notes: pcForm.description.trim() || `${finalCat} paid from petty cash`,
      };

      setLocalPettyCash((prev) => [newPc, ...prev]);
      if (onAddPettyCash) onAddPettyCash(newPc);

      triggerToast(`Recorded ₹${Number(pcForm.amount || 0).toLocaleString('en-IN')} petty cash spend for ${finalCat}!`);
    }

    setPcForm({
      category: PETTY_CASH_CATEGORIES[0],
      customCategory: '',
      amount: 0,
      date: todayStr,
      paidTo: '',
      receiptReference: '',
      description: '',
      handler: 'Reception Cashier',
      sourceAccount: 'Reception Cash Drawer',
    });
  };

  // Form 4: Add Cash / Bank Account & Fund Transfer
  const [accForm, setAccForm] = useState({
    accountName: '',
    accountType: 'Bank Account' as CashBankAccountRecord['accountType'],
    bankName: '',
    accountNumber: '',
    openingBalance: 0,
    openingDate: todayStr,
  });

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accForm.accountName.trim()) return;

    const rawNum = accForm.accountNumber.trim();
    const masked = rawNum.length > 4 ? `••••${rawNum.slice(-4)}` : rawNum || '••••';

    const newAcc: CashBankAccountRecord = {
      id: `ACC-${Date.now()}`,
      accountName: accForm.accountName.trim(),
      accountType: accForm.accountType,
      bankName: accForm.bankName.trim() || accForm.accountName.trim(),
      accountNumber: rawNum || 'N/A',
      accountReference: masked,
      openingBalance: Math.max(0, accForm.openingBalance),
      openingDate: accForm.openingDate || todayStr,
      inflowTotal: 0,
      outflowTotal: 0,
      currentBalance: Math.max(0, accForm.openingBalance),
      lastReconciled: todayStr,
      status: 'Active',
    };

    setLocalAccounts((prev) => [...prev, newAcc]);
    if (onAddAccount) onAddAccount(newAcc);

    setAccForm({
      accountName: '',
      accountType: 'Bank Account',
      bankName: '',
      accountNumber: '',
      openingBalance: 0,
      openingDate: todayStr,
    });
    triggerToast(`Added account "${newAcc.accountName}" with ₹${Number(newAcc.openingBalance || 0).toLocaleString('en-IN')} opening balance!`);
  };

  // Modal: Internal Transfer Between Accounts
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferState, setTransferState] = useState({
    fromAccId: effectiveAccounts[0]?.id || '',
    toAccId: effectiveAccounts[1]?.id || '',
    amount: 0,
    referenceNo: '',
    notes: '',
  });

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferState.amount <= 0 || transferState.fromAccId === transferState.toAccId) {
      triggerToast('Please select two distinct accounts and a positive transfer amount.');
      return;
    }

    const fromAcc = effectiveAccounts.find((a) => a.id === transferState.fromAccId);
    const toAcc = effectiveAccounts.find((a) => a.id === transferState.toAccId);
    if (!fromAcc || !toAcc) return;

    if (onTransferFunds) {
      onTransferFunds({
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        amount: transferState.amount,
        date: todayStr,
        referenceNo: transferState.referenceNo,
        notes: transferState.notes,
      });
    }

    // Also update local accounts
    setLocalAccounts((prev) =>
      prev.map((a) => {
        if (a.id === fromAcc.id) {
          return { ...a, currentBalance: a.currentBalance - transferState.amount, outflowTotal: a.outflowTotal + transferState.amount };
        }
        if (a.id === toAcc.id) {
          return { ...a, currentBalance: a.currentBalance + transferState.amount, inflowTotal: a.inflowTotal + transferState.amount };
        }
        return a;
      })
    );

    setTransferModalOpen(false);
    triggerToast(`Transferred ₹${Number(transferState.amount || 0).toLocaleString('en-IN')} from ${fromAcc.accountName} to ${toAcc.accountName}!`);
  };

  // Form 5: Manual Vouchers (Payment & Receipt)
  const [vchForm, setVchForm] = useState({
    partyName: '',
    category: 'Operational Payout',
    amount: 0,
    paymentMethod: 'Cash' as PaymentMethod,
    referenceNo: '',
    narration: '',
    preparedBy: 'Accounts Desk',
  });

  const handleManualVoucherSubmit = (
    e: React.FormEvent,
    voucherType: 'Payment Voucher' | 'Receipt Voucher'
  ) => {
    e.preventDefault();
    if (!vchForm.partyName.trim() || vchForm.amount <= 0) {
      triggerToast('Please enter party name and amount.');
      return;
    }

    const prefix = voucherType === 'Payment Voucher' ? 'PV' : 'RV';
    const vchNo = `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const newVch: FinanceVoucherRecord = {
      id: `VCH-${Date.now()}`,
      voucherNo: vchNo,
      type: voucherType,
      date: todayStr,
      partyName: vchForm.partyName.trim(),
      category: vchForm.category.trim() || 'General Ledger',
      amount: vchForm.amount,
      paymentMethod: vchForm.paymentMethod,
      referenceNo: vchForm.referenceNo.trim() || `REF-${Date.now().toString().slice(-4)}`,
      narration: vchForm.narration.trim() || `${voucherType} issued to ${vchForm.partyName.trim()}`,
      preparedBy: vchForm.preparedBy.trim() || 'Accounts Desk',
      sourceType: 'manual_voucher',
    };

    setLocalVouchers((prev) => [newVch, ...prev]);
    if (onAddVoucher) onAddVoucher(newVch);

    setVchForm({
      partyName: '',
      category: 'Operational Payout',
      amount: 0,
      paymentMethod: 'Cash',
      referenceNo: '',
      narration: '',
      preparedBy: 'Accounts Desk',
    });
    triggerToast(`Issued ${voucherType} ${vchNo} for ₹${Number(newVch.amount || 0).toLocaleString('en-IN')}!`);
  };

  // Form 6: Vendor Bill & Settle Bill
  const [vendorBillForm, setVendorBillForm] = useState({
    vendorName: '',
    vendorCategory: 'Laundry & Linen Supply',
    invoiceNumber: '',
    invoiceDate: todayStr,
    dueDate: '',
    purchaseOrderRef: '',
    invoiceAmount: 0,
    gstRate: 5,
    paymentTerms: 'Net 15 Days',
    initialPaidAmount: 0,
    paymentMethod: 'Bank Transfer' as PaymentMethod,
  });

  const [settleBillModal, setSettleBillModal] = useState<VendorBillRecord | null>(null);
  const [settlePayAmount, setSettlePayAmount] = useState<number>(0);
  const [settlePayMethod, setSettlePayMethod] = useState<PaymentMethod>('Bank Transfer');
  const [settlePayNotes, setSettlePayNotes] = useState('');

  const handleVendorBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorBillForm.vendorName.trim() || vendorBillForm.invoiceAmount <= 0) {
      triggerToast('Please provide vendor name and bill amount.');
      return;
    }

    const calcGstAmt =
      vendorBillForm.gstRate > 0
        ? Math.round(((vendorBillForm.invoiceAmount * vendorBillForm.gstRate) / (100 + vendorBillForm.gstRate)) * 100) / 100
        : 0;

    const paidAmt = Math.min(vendorBillForm.invoiceAmount, Math.max(0, vendorBillForm.initialPaidAmount));
    const remPayable = vendorBillForm.invoiceAmount - paidAmt;
    const billStatus: VendorBillRecord['status'] = remPayable <= 0 ? 'Paid' : paidAmt > 0 ? 'Partially Paid' : 'Unpaid';

    const billId = `VB-${Date.now()}`;
    const initialPayments = paidAmt > 0 ? [
      {
        id: `VBP-${Date.now()}`,
        date: vendorBillForm.invoiceDate || todayStr,
        amount: paidAmt,
        paymentMethod: vendorBillForm.paymentMethod,
        voucherNo: `PV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        referenceNo: vendorBillForm.invoiceNumber,
        notes: 'Initial payment upon bill entry',
      },
    ] : [];

    const newBill: VendorBillRecord = {
      id: billId,
      vendorName: vendorBillForm.vendorName.trim(),
      vendorCategory: vendorBillForm.vendorCategory,
      invoiceNumber: vendorBillForm.invoiceNumber.trim() || `BILL-${Date.now().toString().slice(-4)}`,
      invoiceDate: vendorBillForm.invoiceDate || todayStr,
      dueDate: vendorBillForm.dueDate || undefined,
      purchaseOrderRef: vendorBillForm.purchaseOrderRef.trim() || undefined,
      invoiceAmount: vendorBillForm.invoiceAmount,
      gstRate: vendorBillForm.gstRate,
      gstAmount: calcGstAmt,
      paymentTerms: vendorBillForm.paymentTerms,
      paidAmount: paidAmt,
      remainingPayable: remPayable,
      status: billStatus,
      payments: initialPayments,
      createdAt: new Date().toISOString(),
    };

    setLocalVendorBills((prev) => [newBill, ...prev]);
    if (onAddVendorBill) onAddVendorBill(newBill);

    // If initial payment was made, generate Payment Voucher
    if (paidAmt > 0) {
      const vchNo = initialPayments[0].voucherNo || `PV-${Date.now().toString().slice(-4)}`;
      const newVch: FinanceVoucherRecord = {
        id: `VCH-${Date.now()}`,
        voucherNo: vchNo,
        type: 'Payment Voucher',
        date: newBill.invoiceDate,
        partyName: newBill.vendorName,
        category: `Vendor Payment - ${newBill.vendorCategory}`,
        amount: paidAmt,
        paymentMethod: vendorBillForm.paymentMethod,
        referenceNo: newBill.invoiceNumber,
        narration: `Paid vendor bill #${newBill.invoiceNumber} (${newBill.vendorCategory})`,
        preparedBy: 'Accounts',
        sourceType: 'vendor_bill',
        sourceId: newBill.id,
      };
      setLocalVouchers((prev) => [newVch, ...prev]);
      if (onAddVoucher) onAddVoucher(newVch);
    }

    setVendorBillForm({
      vendorName: '',
      vendorCategory: 'Laundry & Linen Supply',
      invoiceNumber: '',
      invoiceDate: todayStr,
      dueDate: '',
      purchaseOrderRef: '',
      invoiceAmount: 0,
      gstRate: 5,
      paymentTerms: 'Net 15 Days',
      initialPaidAmount: 0,
      paymentMethod: 'Bank Transfer',
    });

    triggerToast(`Recorded vendor bill #${newBill.invoiceNumber} (₹${newBill.invoiceAmount}). Remaining Payable: ₹${newBill.remainingPayable}`);
  };

  const handleExecuteSettleBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleBillModal || settlePayAmount <= 0) return;

    const remaining = settleBillModal.remainingPayable;
    const payAmt = Math.min(remaining, settlePayAmount);
    const newPaidTotal = settleBillModal.paidAmount + payAmt;
    const newRemaining = Math.max(0, settleBillModal.invoiceAmount - newPaidTotal);
    const nextStatus: VendorBillRecord['status'] = newRemaining <= 0 ? 'Paid' : 'Partially Paid';

    const vchNo = `PV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const paymentItem = {
      id: `VBP-${Date.now()}`,
      date: todayStr,
      amount: payAmt,
      paymentMethod: settlePayMethod,
      voucherNo: vchNo,
      referenceNo: settleBillModal.invoiceNumber,
      notes: settlePayNotes || `Disbursed payment for bill #${settleBillModal.invoiceNumber}`,
    };

    const updatedBills = localVendorBills.map((b) => {
      if (b.id !== settleBillModal.id) return b;
      return {
        ...b,
        paidAmount: newPaidTotal,
        remainingPayable: newRemaining,
        status: nextStatus,
        payments: [...(b.payments || []), paymentItem],
        updatedAt: new Date().toISOString(),
      };
    });

    setLocalVendorBills(updatedBills);
    if (onPayVendorBill) {
      onPayVendorBill(settleBillModal.id, {
        amount: payAmt,
        paymentMethod: settlePayMethod,
        date: todayStr,
        notes: settlePayNotes,
      });
    }

    // Auto-generate Payment Voucher
    const newVch: FinanceVoucherRecord = {
      id: `VCH-${Date.now()}`,
      voucherNo: vchNo,
      type: 'Payment Voucher',
      date: todayStr,
      partyName: settleBillModal.vendorName,
      category: `Vendor Payment - ${settleBillModal.vendorCategory}`,
      amount: payAmt,
      paymentMethod: settlePayMethod,
      referenceNo: settleBillModal.invoiceNumber,
      narration: `Paid ₹${payAmt} for bill #${settleBillModal.invoiceNumber}. Remaining: ₹${newRemaining}`,
      preparedBy: 'Accounts',
      sourceType: 'vendor_bill',
      sourceId: settleBillModal.id,
    };
    setLocalVouchers((prev) => [newVch, ...prev]);
    if (onAddVoucher) onAddVoucher(newVch);

    setSettleBillModal(null);
    setSettlePayAmount(0);
    setSettlePayNotes('');
    triggerToast(`Disbursed ₹${payAmt.toLocaleString('en-IN')} to ${settleBillModal.vendorName} & issued Payment Voucher ${vchNo}!`);
  };

  // Form 7: Owner Drawings & Capital Injection
  const [ownForm, setOwnForm] = useState({
    directorName: '',
    type: 'Owner Withdrawal / Drawing' as OwnerPaymentRecord['type'],
    amount: 0,
    paymentMethod: 'Bank Transfer' as PaymentMethod,
    referenceNo: '',
    notes: '',
  });

  const handleOwnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownForm.directorName.trim() || ownForm.amount <= 0) {
      triggerToast('Please provide owner/director name and amount.');
      return;
    }

    const newOwn: OwnerPaymentRecord = {
      id: `OWN-${Date.now()}`,
      date: todayStr,
      directorName: ownForm.directorName.trim(),
      type: ownForm.type,
      amount: ownForm.amount,
      paymentMethod: ownForm.paymentMethod,
      referenceNo: ownForm.referenceNo.trim() || `OWN-${Date.now().toString().slice(-4)}`,
      notes: ownForm.notes.trim() || ownForm.type,
    };

    setLocalOwnerLedger((prev) => [newOwn, ...prev]);
    if (onAddOwnerPayment) onAddOwnerPayment(newOwn);

    // If Drawing or Remuneration, issue Payment Voucher; if Capital Injection, issue Receipt Voucher
    if (newOwn.type === 'Capital Injection') {
      const vchNo = `RV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const newVch: FinanceVoucherRecord = {
        id: `VCH-${Date.now()}`,
        voucherNo: vchNo,
        type: 'Receipt Voucher',
        date: newOwn.date,
        partyName: newOwn.directorName,
        category: 'Owner Capital Contribution',
        amount: newOwn.amount,
        paymentMethod: newOwn.paymentMethod,
        referenceNo: newOwn.referenceNo,
        narration: `Capital injected by ${newOwn.directorName}: ${newOwn.notes}`,
        preparedBy: 'Accounts Desk',
        sourceType: 'owner_equity',
        sourceId: newOwn.id,
      };
      setLocalVouchers((prev) => [newVch, ...prev]);
      if (onAddVoucher) onAddVoucher(newVch);
      triggerToast(`Capital injection of ₹${Number(newOwn.amount || 0).toLocaleString('en-IN')} recorded & Receipt Voucher ${vchNo} issued! (Excluded from operating revenue)`);
    } else {
      const vchNo = `PV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const newVch: FinanceVoucherRecord = {
        id: `VCH-${Date.now()}`,
        voucherNo: vchNo,
        type: 'Payment Voucher',
        date: newOwn.date,
        partyName: newOwn.directorName,
        category: newOwn.type,
        amount: newOwn.amount,
        paymentMethod: newOwn.paymentMethod,
        referenceNo: newOwn.referenceNo,
        narration: `${newOwn.type} for ${newOwn.directorName}: ${newOwn.notes}`,
        preparedBy: 'Accounts Desk',
        sourceType: 'owner_equity',
        sourceId: newOwn.id,
      };
      setLocalVouchers((prev) => [newVch, ...prev]);
      if (onAddVoucher) onAddVoucher(newVch);
      triggerToast(`Saved ${newOwn.type} of ₹${Number(newOwn.amount || 0).toLocaleString('en-IN')} & issued Payment Voucher ${vchNo}! (Excluded from operating expenses)`);
    }

    setOwnForm({
      directorName: '',
      type: 'Owner Withdrawal / Drawing',
      amount: 0,
      paymentMethod: 'Bank Transfer',
      referenceNo: '',
      notes: '',
    });
  };

  // Form 8: Staff Reimbursements
  const [rmForm, setRmForm] = useState({
    staffName: '',
    department: 'Housekeeping',
    title: '',
    amount: 0,
  });

  const handleStaffClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rmForm.staffName.trim() || !rmForm.title.trim() || rmForm.amount <= 0) {
      triggerToast('Please fill all claim fields.');
      return;
    }

    const newClaim: StaffReimbursementRecord = {
      id: `RM-${Date.now()}`,
      date: todayStr,
      staffName: rmForm.staffName.trim(),
      department: rmForm.department,
      title: rmForm.title.trim(),
      amount: rmForm.amount,
      status: 'Pending',
    };

    setLocalReimbursements((prev) => [newClaim, ...prev]);
    if (onAddReimbursement) onAddReimbursement(newClaim);

    setRmForm({
      staffName: '',
      department: 'Housekeeping',
      title: '',
      amount: 0,
    });
    triggerToast(`Logged reimbursement claim of ₹${Number(newClaim.amount || 0).toLocaleString('en-IN')} for ${newClaim.staffName}. (Pending approval, no cash deducted yet)`);
  };

  const handleApproveStaffClaim = (rm: StaffReimbursementRecord) => {
    setLocalReimbursements((prev) =>
      prev.map((item) => (item.id === rm.id ? { ...item, status: 'Approved' } : item))
    );
    if (onUpdateReimbursementStatus) onUpdateReimbursementStatus(rm.id, 'Approved');
    triggerToast(`Claim by ${rm.staffName} marked Approved. Ready for payment.`);
  };

  const handlePayStaffClaim = (rm: StaffReimbursementRecord, method: PaymentMethod = 'Cash') => {
    setLocalReimbursements((prev) =>
      prev.map((item) => (item.id === rm.id ? { ...item, status: 'Paid' } : item))
    );
    if (onUpdateReimbursementStatus) onUpdateReimbursementStatus(rm.id, 'Paid');

    const vchNo = `PV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const newVch: FinanceVoucherRecord = {
      id: `VCH-${Date.now()}`,
      voucherNo: vchNo,
      type: 'Payment Voucher',
      date: todayStr,
      partyName: `${rm.staffName} (${rm.department})`,
      category: 'Staff Expense Reimbursement',
      amount: rm.amount,
      paymentMethod: method,
      referenceNo: rm.id,
      narration: `Paid out-of-pocket claim: ${rm.title}`,
      preparedBy: 'Accounts',
      sourceType: 'reimbursement',
      sourceId: rm.id,
    };
    setLocalVouchers((prev) => [newVch, ...prev]);
    if (onAddVoucher) onAddVoucher(newVch);

    triggerToast(`Disbursed ₹${Number(rm.amount || 0).toLocaleString('en-IN')} to ${rm.staffName} & issued Payment Voucher ${vchNo}!`);
  };

  // Form 9: Daily Shift Closing
  const handleShiftClosingSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const actualCounted = computedDenominationsTotal > 0 ? computedDenominationsTotal : dcPhysicalCash;
    const diff = actualCounted - expectedShiftCash;
    const closingStatus: DailyClosingEntry['status'] = diff === 0 ? 'Balanced' : 'Discrepancy Logged';

    const newClosing: DailyClosingEntry = {
      id: `DC-${Date.now()}`,
      date: dcDate || todayStr,
      openingCash: dcOpeningCash,
      roomCashIn: shiftCashInflows.roomCash,
      posCashIn: shiftCashInflows.posCash + shiftCashInflows.miscCash,
      cashExpensesOut: shiftCashOutflows.total,
      expectedClosing: expectedShiftCash,
      physicalCounted: actualCounted,
      discrepancy: diff,
      closedBy: dcClosedBy.trim() || 'Reception Cashier',
      status: closingStatus,
    };

    setLocalDailyClosings((prev) => [newClosing, ...prev]);
    if (onAddDailyClosing) onAddDailyClosing(newClosing);

    triggerToast(`Shift Cash Closing completed for ${newClosing.date}! Status: ${closingStatus} (Variance: ₹${diff.toLocaleString('en-IN')})`);
  };

  const SUB_TABS = [
    { id: 'dashboard', label: 'Finance Overview' },
    { id: 'income', label: `Income Ledger (${allIncomeTransactions.length})` },
    { id: 'expenses', label: `Expense Register (${filteredExpenses.length})` },
    { id: 'petty_cash', label: `Petty Cash Drawer (₹${availablePettyCashBalance.toLocaleString('en-IN')})` },
    { id: 'cash_bank', label: `Cash & Bank A/c (${effectiveAccounts.length})` },
    { id: 'vouchers_payment', label: `Payment Vouchers (${paymentVouchers.length})` },
    { id: 'vouchers_receipt', label: `Receipt Vouchers (${receiptVouchers.length})` },
    { id: 'vendors', label: `Vendor Payments (${filteredVendorBills.length})` },
    { id: 'owner_payments', label: `Owner Drawings & Capital (${filteredOwnerLedger.length})` },
    { id: 'reimbursements', label: `Staff Reimbursements (${filteredReimbursements.length})` },
    { id: 'daily_closing', label: `Daily Shift Closing (${filteredDailyClosings.length})` },
    { id: 'pl_reports', label: 'P&L & 5% GST Summary' },
  ];

  return (
    <div className="space-y-5">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="bg-slate-900 text-amber-300 px-5 py-3 rounded-2xl border border-amber-500/40 shadow-xl flex items-center justify-between text-xs font-bold animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-white font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Module Title, Global Date Filter & Action Quick Buttons */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-amber-700 truncate">
                DirectStay Financial Management & Accounting Hub
              </span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-serif font-bold text-slate-900 mt-1 leading-snug">
              Integrated Hotel Accounting, Cashbook, Vouchers & P&L Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Live double-entry hotel financial management — Front Desk Advances, POS Inflows, Vendor Bills, Petty Cash Imprest, Owner Capital & Night Shift Cash Handover
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={() => onSubTabChange('income')}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] sm:text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center"
            >
              + Misc Income
            </button>
            <button
              onClick={() => onSubTabChange('expenses')}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-[11px] sm:text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center"
            >
              + Extra Expense
            </button>
            <button
              onClick={() => onSubTabChange('vendors')}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] sm:text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center"
            >
              + Vendor Bill
            </button>
            <button
              onClick={() => onSubTabChange('daily_closing')}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-[11px] sm:text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center"
            >
              Shift Closing
            </button>
          </div>
        </div>

        {/* GLOBAL DATE FILTER BAR FOR ALL FINANCE MENUS & SUBMENUS (IST Default: Today) */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 mr-1">
              Date Filter:
            </span>
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'all', label: 'All Dates' },
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
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 transition cursor-pointer ml-1"
              title="Reset back to today's date"
            >
              Reset to Today
            </button>
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
              title={`From: ${formatDdmmyyyy(fromDate)}`}
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
              title={`To: ${formatDdmmyyyy(toDate)}`}
            />
            {fromDate && toDate && (
              <span className="text-[10px] font-mono text-slate-600 font-bold bg-white px-2 py-1 rounded border border-amber-200">
                {formatDdmmyyyy(fromDate)} → {formatDdmmyyyy(toDate)}
              </span>
            )}
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

      {/* =====================================================================
          1. FINANCE OVERVIEW DASHBOARD — SIMPLE CRYSTAL-CLEAR HOTEL HISAAB
         ===================================================================== */}
      {effectiveSubTab === 'dashboard' && (
        <div className="space-y-5">
          {/* 5 BIG CRYSTAL-CLEAR HOTEL HISAAB CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5">
            {/* 1. Total Billing (Invoices) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1.5 flex flex-col justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                1. Total Billing (Invoices)
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-slate-900">
                ₹{totalBillingGross.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Pre-Tax: <strong>₹{totalOperatingRevenue.toLocaleString('en-IN')}</strong> + GST:{' '}
                <strong>₹{gstBreakdown.totalOutputGst.toLocaleString('en-IN')}</strong>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Room + Food/POS + Water + Extra Services
                </div>
              </div>
            </div>

            {/* 2. Total Payment Received */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-1.5 flex flex-col justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                2. Total Payment Received
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-emerald-700">
                ₹{totalHotelCollections.toLocaleString('en-IN')}
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-bold">
                  Cash: ₹{r2(modeBreakdown.Cash.inflow).toLocaleString('en-IN')}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-bold">
                  UPI: ₹{r2(modeBreakdown.UPI.inflow).toLocaleString('en-IN')}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-900 text-[10px] font-bold">
                  Card: ₹{r2(modeBreakdown.Card.inflow).toLocaleString('en-IN')}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold">
                  Bank: ₹{r2(modeBreakdown['Bank Transfer'].inflow).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* 3. Pending Balance Due */}
            <div className="bg-white p-4 rounded-2xl border border-amber-300 shadow-sm space-y-1.5 flex flex-col justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
                3. Pending Balance Due
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-amber-800">
                ₹{totalPendingBalanceDue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                <strong>{pendingDueBookings.length}</strong> Guest / Room bill(s) remaining to collect
              </div>
            </div>

            {/* 4. Total Hotel Expenses */}
            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm space-y-1.5 flex flex-col justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
                4. Total Hotel Expenses
              </div>
              <div className="text-xl sm:text-2xl font-serif font-bold text-rose-700">
                ₹{totalOperatingExpenses.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Expenses: ₹{r2(totalPaidExpensesOutflow).toLocaleString('en-IN')} • Petty Cash: ₹
                {r2(directPettyCashSpendsOnly).toLocaleString('en-IN')}
              </div>
            </div>

            {/* 5. Net Balance (Received − Expenses) */}
            <div
              className={`p-4 rounded-2xl border shadow-sm space-y-1.5 flex flex-col justify-between ${
                netReceivedMinusExpenses >= 0
                  ? 'bg-emerald-50/60 border-emerald-300'
                  : 'bg-rose-50/60 border-rose-300'
              }`}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                5. Net Balance (Received − Expenses)
              </div>
              <div
                className={`text-xl sm:text-2xl font-serif font-bold ${
                  netReceivedMinusExpenses >= 0 ? 'text-emerald-800' : 'text-rose-800'
                }`}
              >
                {netReceivedMinusExpenses < 0 ? '-' : ''}₹
                {Math.abs(netReceivedMinusExpenses).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-600 leading-snug">
                Net cash &amp; bank surplus in selected date range
              </div>
            </div>
          </div>

          {/* DATE-WISE DAYBOOK / LEDGER TABLE (EVERY RUPEE IN & OUT) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FAFBFD]">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  Date-Wise Hotel Daybook / Hisaab Ledger ({filteredDaybookEntries.length} Entries)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Every rupee received from Guests / POS / Misc (+) and every Hotel Expense / Refund (-) in one simple ledger
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={daybookSearch}
                    onChange={(e) => setDaybookSearch(e.target.value)}
                    placeholder="Search Guest, Room, Ref, Mode..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                  />
                </div>

                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'in', label: 'Money In (+)' },
                      { id: 'out', label: 'Money Out (-)' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDaybookTypeFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                        daybookTypeFilter === f.id
                          ? 'bg-slate-900 text-amber-400'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExportDaybookCsv}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrintDaybook}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Daybook
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4 whitespace-nowrap">Date</th>
                    <th className="py-3 px-4">Particulars (Guest &amp; Room / Expense)</th>
                    <th className="py-3 px-4 whitespace-nowrap">Bill / Ref No.</th>
                    <th className="py-3 px-4 whitespace-nowrap">Payment Mode</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap text-emerald-700">Money In (+)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap text-rose-700">Money Out (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDaybookEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-slate-400">
                        No transactions recorded in the selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredDaybookEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">{row.particulars}</div>
                          <div className="text-[11px] text-slate-500">{row.subDetail}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {row.refNo}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                            {row.paymentMode}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {row.moneyIn > 0 ? `+₹${row.moneyIn.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {row.moneyOut > 0 ? `-₹${row.moneyOut.toLocaleString('en-IN')}` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Secondary Accounting Indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-400">Petty Cash Drawer</div>
              <div className="text-xl font-bold text-slate-800 mt-1">
                ₹{availablePettyCashBalance.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Float In: ₹{pettyCashReplenishments.toLocaleString('en-IN')} • Spent: ₹{pettyCashSpends.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-400">Outstanding Payables</div>
              <div className="text-xl font-bold text-rose-700 mt-1">
                ₹{totalOutstandingVendorPayables.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Unpaid vendor bills & expenses
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-400">Gross Operating Profit (GOP)</div>
              <div className={`text-xl font-bold mt-1 ${grossOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{grossOperatingProfit.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Operating margin: {ebitdaMarginPercent}%
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-[10px] font-bold uppercase text-slate-400">Net GST Payable (5% Slabs)</div>
              <div className="text-xl font-bold text-amber-800 mt-1">
                ₹{Number(gstBreakdown.netGstPayable || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Output: ₹{Number(gstBreakdown.totalOutputGst || 0).toLocaleString('en-IN')} • ITC: ₹{Number(gstBreakdown.totalInputItc || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Payment Mode-wise Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" />
              Live Payment Mode Liquidity & Flow Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {(['Cash', 'UPI', 'Card', 'Bank Transfer'] as const).map((mode) => {
                const info = modeBreakdown[mode];
                const net = info.inflow - info.outflow;
                return (
                  <div key={mode} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{mode} Counter</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${net >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {net >= 0 ? 'Surplus' : 'Deficit'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      ₹{net.toLocaleString('en-IN')}
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                      <span className="text-emerald-700 font-semibold">+₹{Number(info.inflow || 0).toLocaleString('en-IN')} In</span>
                      <span className="text-rose-700 font-semibold">-₹{Number(info.outflow || 0).toLocaleString('en-IN')} Out</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Inflows vs Recent Expenses Two-Column Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Collections */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recent Collections ({allIncomeTransactions.length})</h3>
                  <p className="text-[11px] text-slate-500">Auto-synced from Front Desk, POS, Laundry & OTA</p>
                </div>
                <button
                  onClick={() => onSubTabChange('income')}
                  className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  View Ledger →
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {allIncomeTransactions.slice(0, 6).map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{item.partyName}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.category} • <span className="font-semibold">{item.sourceModule}</span> ({item.date})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${item.isRefund ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {item.amount >= 0 ? '+' : ''}₹{Number(item.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">{item.paymentMode}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recent Expenses ({filteredExpenses.length})</h3>
                  <p className="text-[11px] text-slate-500">Bills, maintenance, utilities, fuel & supplies (Petty Cash)</p>
                </div>
                <button
                  onClick={() => onSubTabChange('expenses')}
                  className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  View Register →
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {filteredExpenses.slice(0, 6).map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{item.category}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.description} • {item.vendorName} ({item.date})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-rose-700">
                        -₹{Number(item.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${item.paymentStatus === 'Pending / Payable' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        {item.paymentStatus || 'Paid'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. INCOME LEDGER (AUTOMATIC + MISCELLANEOUS INCOME FORM)
         ===================================================================== */}
      {effectiveSubTab === 'income' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Manual Entry Form */}
          <form
            onSubmit={handleMiscIncomeSubmit}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">+ Record Other / Miscellaneous Hotel Income</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Auto RV Voucher</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Front Desk, POS & Laundry auto-populate on the right. Use this form to record Banquet Hall, Conference, Extra Mattress, Walk-in Laundry or Scrap Sale.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Income Category *</label>
              <select
                value={miscForm.incomeCategory}
                onChange={(e) => setMiscForm({ ...miscForm, incomeCategory: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold bg-white"
              >
                {MISC_INCOME_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {miscForm.incomeCategory === 'Other Income (Custom)' && (
              <div>
                <label className="block font-bold text-amber-900 mb-1">Custom Category Name *</label>
                <input
                  type="text"
                  required
                  value={miscForm.customCategory}
                  onChange={(e) => setMiscForm({ ...miscForm, customCategory: e.target.value })}
                  placeholder="e.g. Lawn Event Rental / Parking Charges"
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/50"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Particulars / Description *</label>
              <input
                type="text"
                required
                value={miscForm.description}
                onChange={(e) => setMiscForm({ ...miscForm, description: e.target.value })}
                placeholder="e.g., Rotary Club Half-Day Seminar"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={miscForm.amount || ''}
                  onChange={(e) => setMiscForm({ ...miscForm, amount: Number(e.target.value) })}
                  placeholder="5000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Rate</label>
                <select
                  value={miscForm.gstRate}
                  onChange={(e) => setMiscForm({ ...miscForm, gstRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5% (Standard PMS)</option>
                  <option value={12}>12% (Banquet / Hall)</option>
                  <option value={18}>18% (Commercial)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={finHybridActive.misc ? '__HYBRID__' : miscForm.paymentMode}
                  onChange={(e) => {
                    if (e.target.value === '__HYBRID__') {
                      const rows = createInitialHybridRows(Number(miscForm.amount) || 0);
                      setFinHybridActive((p) => ({ ...p, misc: true }));
                      setFinHybridRows((p) => ({ ...p, misc: rows }));
                      setMiscForm({ ...miscForm, paymentMode: formatHybridLabel(rows) as PaymentMethod });
                    } else {
                      setFinHybridActive((p) => ({ ...p, misc: false }));
                      setMiscForm({ ...miscForm, paymentMode: e.target.value as PaymentMethod });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="__HYBRID__">⇄ Hybrid / Split Payment</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transaction Date</label>
                <input
                  type="date"
                  value={miscForm.transactionDate}
                  onChange={(e) => setMiscForm({ ...miscForm, transactionDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>
            {finHybridActive.misc && (
              <HybridSplitPaymentBox
                rows={finHybridRows.misc || createInitialHybridRows(Number(miscForm.amount) || 0)}
                onChange={(rows) => {
                  setFinHybridRows((p) => ({ ...p, misc: rows }));
                  setMiscForm({ ...miscForm, amount: getHybridTotal(rows), paymentMode: formatHybridLabel(rows) as PaymentMethod });
                }}
                targetAmount={Number(miscForm.amount) || 0}
                compact
              />
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Reference / UTR / Slip No.</label>
              <input
                type="text"
                value={miscForm.referenceNumber}
                onChange={(e) => setMiscForm({ ...miscForm, referenceNumber: e.target.value })}
                placeholder="e.g., UTR-998822"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Remarks</label>
              <input
                type="text"
                value={miscForm.remarks}
                onChange={(e) => setMiscForm({ ...miscForm, remarks: e.target.value })}
                placeholder="Optional notes"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              + Save Miscellaneous Income & Generate RV
            </button>
          </form>

          {/* Income Transactions Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Hotel Income Ledger (Total: ₹{totalHotelCollections.toLocaleString('en-IN')})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Every booking advance, room collection, POS bill, laundry payment & misc receipt
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Date & Ref</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Guest / Party</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allIncomeTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No income entries found. Checkouts, advances, POS orders and misc income appear here automatically.
                      </td>
                    </tr>
                  ) : (
                    allIncomeTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{tx.refNo}</div>
                          <div className="text-[10px] text-slate-400">{tx.date}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.sourceModule === 'Front Desk'
                                ? 'bg-blue-100 text-blue-800'
                                : tx.sourceModule === 'POS Restaurant'
                                ? 'bg-amber-100 text-amber-800'
                                : tx.sourceModule === 'Laundry & Guest Services'
                                ? 'bg-indigo-100 text-indigo-800'
                                : tx.sourceModule === 'OTA Settlement'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {tx.sourceModule}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{tx.partyName}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{tx.category}</div>
                          <div className="text-[10px] text-slate-400">{tx.narration}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{tx.paymentMode}</td>
                        <td className={`py-3 px-4 text-right font-bold ${tx.isRefund ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {tx.amount >= 0 ? '+' : ''}₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. EXPENSE REGISTER (OPERATIONAL & EXTRA EXPENSES)
         ===================================================================== */}
      {effectiveSubTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Record Hotel / Extra Expense Form */}
          <form
            onSubmit={handleExpenseSubmit}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">+ Record Hotel / Extra Expense</h3>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">Petty Cash Outflow</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
              <select
                value={expForm.category}
                onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold bg-white"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {expForm.category === 'Other / Extra Expense (Custom)' && (
              <div>
                <label className="block font-bold text-amber-900 mb-1">Specify Custom Expense Head *</label>
                <input
                  type="text"
                  required
                  value={expForm.customCategory}
                  onChange={(e) => setExpForm({ ...expForm, customCategory: e.target.value })}
                  placeholder="e.g. Lift Servicing / Sound System / Pest AMC"
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/50"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={expForm.department}
                  onChange={(e) => setExpForm({ ...expForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Front Office & Operations">Front Office & Operations</option>
                  <option value="Housekeeping & Laundry">Housekeeping & Laundry</option>
                  <option value="F&B Kitchen & Restaurant">F&B Kitchen & Restaurant</option>
                  <option value="Maintenance & Engineering">Maintenance & Engineering</option>
                  <option value="Staff & HR Welfare">Staff & HR Welfare</option>
                  <option value="Accounts & Admin">Accounts & Admin</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Invoice / Bill Date</label>
                <input
                  type="date"
                  value={expForm.invoiceDate}
                  onChange={(e) => setExpForm({ ...expForm, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor / Payee Name</label>
                <input
                  type="text"
                  value={expForm.vendorName}
                  onChange={(e) => setExpForm({ ...expForm, vendorName: e.target.value })}
                  placeholder="e.g. Torrent Power / Metro Cash"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Invoice / Bill Number</label>
                <input
                  type="text"
                  value={expForm.invoiceNumber}
                  onChange={(e) => setExpForm({ ...expForm, invoiceNumber: e.target.value })}
                  placeholder="INV-5541"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Bill Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={expForm.amount || ''}
                  onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })}
                  placeholder="2500"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Rate</label>
                <select
                  value={expForm.gstRate}
                  onChange={(e) => setExpForm({ ...expForm, gstRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5% (Standard)</option>
                  <option value={12}>12%</option>
                  <option value={18}>18% (Services/AMC)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Status</label>
                <select
                  value={expForm.paymentStatus}
                  onChange={(e) => setExpForm({ ...expForm, paymentStatus: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="Paid">Paid Immediately</option>
                  <option value="Pending / Payable">Pending / Payable (Unpaid)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Source (Petty Cash)</label>
                <select
                  value={finHybridActive.exp ? '__HYBRID__' : expForm.paymentMethod}
                  onChange={(e) => {
                    if (e.target.value === '__HYBRID__') {
                      const rows = createInitialHybridRows(Number(expForm.amount) || 0);
                      setFinHybridActive((p) => ({ ...p, exp: true }));
                      setFinHybridRows((p) => ({ ...p, exp: rows }));
                      setExpForm({ ...expForm, paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                    } else {
                      setFinHybridActive((p) => ({ ...p, exp: false }));
                      setExpForm({ ...expForm, paymentMethod: e.target.value as PaymentMethod });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="Cash">Petty Cash Drawer (Default)</option>
                  <option value="Bank Transfer">Bank Transfer (Reimbursed to Petty Cash)</option>
                  <option value="UPI">UPI (Petty Cash)</option>
                  <option value="Card">Card</option>
                  <option value="__HYBRID__">⇄ Hybrid / Split Payment</option>
                </select>
              </div>
            </div>
            {finHybridActive.exp && (
              <HybridSplitPaymentBox
                rows={finHybridRows.exp || createInitialHybridRows(Number(expForm.amount) || 0)}
                onChange={(rows) => {
                  setFinHybridRows((p) => ({ ...p, exp: rows }));
                  setExpForm({ ...expForm, amount: getHybridTotal(rows), paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                }}
                targetAmount={Number(expForm.amount) || 0}
                compact
              />
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Remarks / Particulars</label>
              <input
                type="text"
                value={expForm.remarks}
                onChange={(e) => setExpForm({ ...expForm, remarks: e.target.value })}
                placeholder="e.g. AC capacitor replacement in Room 201"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              + Save Expense & Issue Payment Voucher
            </button>
          </form>

          {/* Expense Register Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Operational & Extra Expense Register (Total: ₹{totalPaidExpensesOutflow.toLocaleString('en-IN')})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Eligible Input Tax Credit (ITC): ₹{totalExpenseGstItc.toLocaleString('en-IN')} • Payables: ₹{totalUnpaidExpensesPayable.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Ref & Date</th>
                    <th className="py-3 px-4">Category & Dept</th>
                    <th className="py-3 px-4">Vendor & Details</th>
                    <th className="py-3 px-4">Status & Mode</th>
                    <th className="py-3 px-4 text-right">GST ITC</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allOperationalExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No expenses logged yet. Use the form on the left to record operational expenses.
                      </td>
                    </tr>
                  ) : (
                    allOperationalExpenses.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{ex.expenseNo}</div>
                          <div className="text-[10px] text-slate-400">{ex.date}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{ex.category}</div>
                          <div className="text-[10px] text-slate-400">{ex.department}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{ex.vendorName}</div>
                          <div className="text-[11px] text-slate-500">{ex.description}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ex.paymentStatus === 'Pending / Payable'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {ex.paymentStatus || 'Paid'}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">{ex.paymentMethod}</div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">
                          ₹{(ex.gstAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-700">
                          ₹{Number(ex.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          {ex.paymentStatus === 'Pending / Payable' && (
                            <button
                              onClick={() => handleSettleUnpaidExpense(ex)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Settle / Pay
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setLocalExpenses((prev) => prev.filter((i) => i.id !== ex.id));
                              if (onDeleteExpense) onDeleteExpense(ex.id);
                              triggerToast(`Deleted expense ${ex.expenseNo}`);
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 text-rose-700 text-[10px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. PETTY CASH DRAWER (IMPREST FLOAT & PASSBOOK)
         ===================================================================== */}
      {effectiveSubTab === 'petty_cash' && (
        <div className="space-y-5">
          {/* Petty Cash Balances */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Opening Float & Replenishments
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-700">
                +₹{pettyCashReplenishments.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">
                Internal transfers from main cash & bank accounts
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Total Petty Cash Spent
              </div>
              <div className="text-2xl font-serif font-bold text-rose-700">
                -₹{pettyCashSpends.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500">
                Tea, auto fare, drinking water, stationery & emergencies
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-300 shadow-sm space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Available Cash in Petty Drawer
              </div>
              <div className="text-2xl font-serif font-bold text-slate-900">
                ₹{availablePettyCashBalance.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-amber-800 font-semibold">
                Live physical drawer float balance
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Petty Cash Form */}
            <form
              onSubmit={handlePettyCashSubmit}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Petty Cash Drawer System</h3>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                  Bal: ₹{availablePettyCashBalance.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Mode Toggle: Spend vs Replenish */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPcTab('Spend')}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    pcTab === 'Spend'
                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  - Petty Cash Spend
                </button>
                <button
                  type="button"
                  onClick={() => setPcTab('Replenish')}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    pcTab === 'Replenish'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  + Float Replenishment
                </button>
              </div>

              {pcTab === 'Replenish' ? (
                <>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-700" />
                      Internal Fund Transfer Rule
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Replenishment transfers money from Main Cash / Bank to the Petty Cash drawer. It is NOT new hotel revenue.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Source Account *</label>
                    <select
                      value={pcForm.sourceAccount}
                      onChange={(e) => setPcForm({ ...pcForm, sourceAccount: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      {effectiveAccounts.map((a) => (
                        <option key={a.id} value={a.accountName}>
                          {a.accountName} (Bal: ₹{Number(a.currentBalance || 0).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Replenish Amount (₹) *</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={pcForm.amount || ''}
                        onChange={(e) => setPcForm({ ...pcForm, amount: Number(e.target.value) })}
                        placeholder="5000"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={pcForm.date}
                        onChange={(e) => setPcForm({ ...pcForm, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Reference / Slip No.</label>
                    <input
                      type="text"
                      value={pcForm.receiptReference}
                      onChange={(e) => setPcForm({ ...pcForm, receiptReference: e.target.value })}
                      placeholder="e.g. SLIP-102"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer transition shadow-sm"
                  >
                    + Add Float to Petty Cash Drawer
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
                    <select
                      value={pcForm.category}
                      onChange={(e) => setPcForm({ ...pcForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      {PETTY_CASH_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {pcForm.category === 'Other Petty Expense (Custom)' && (
                    <div>
                      <label className="block font-bold text-amber-900 mb-1">Custom Category *</label>
                      <input
                        type="text"
                        required
                        value={pcForm.customCategory}
                        onChange={(e) => setPcForm({ ...pcForm, customCategory: e.target.value })}
                        placeholder="e.g. Bellboy Tip / Broom / Emergency Courier"
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/50"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={pcForm.amount || ''}
                        onChange={(e) => setPcForm({ ...pcForm, amount: Number(e.target.value) })}
                        placeholder="150"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={pcForm.date}
                        onChange={(e) => setPcForm({ ...pcForm, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Paid To / Shop</label>
                      <input
                        type="text"
                        value={pcForm.paidTo}
                        onChange={(e) => setPcForm({ ...pcForm, paidTo: e.target.value })}
                        placeholder="e.g. Local Tea Stall"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Receipt Ref</label>
                      <input
                        type="text"
                        value={pcForm.receiptReference}
                        onChange={(e) => setPcForm({ ...pcForm, receiptReference: e.target.value })}
                        placeholder="Voucher #11"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Description / Particulars</label>
                    <input
                      type="text"
                      value={pcForm.description}
                      onChange={(e) => setPcForm({ ...pcForm, description: e.target.value })}
                      placeholder="e.g. Tea & biscuits for afternoon lobby arrivals"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition shadow-sm"
                  >
                    - Record Petty Cash Spend
                  </button>
                </>
              )}
            </form>

            {/* Petty Cash Passbook Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">
                  Petty Cash Passbook & Running Balance ({pettyCashPassbook.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Category & Details</th>
                      <th className="py-3 px-4">Handler</th>
                      <th className="py-3 px-4 text-right">Inflow / Outflow</th>
                      <th className="py-3 px-4 text-right">Running Balance</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pettyCashPassbook.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Petty cash drawer is empty. Add a replenishment float on the left to start.
                        </td>
                      </tr>
                    ) : (
                      pettyCashPassbook.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 text-slate-500 font-semibold">{p.date}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {p.isIn ? 'Float Top-up' : 'Petty Spend'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{p.category}</div>
                            <div className="text-[11px] text-slate-500">{p.notes}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{p.handler}</td>
                          <td className={`py-3 px-4 text-right font-bold ${p.isIn ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {p.isIn ? '+' : '-'}₹{Number(p.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ₹{Number(p.runningBalance || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setLocalPettyCash((prev) => prev.filter((i) => i.id !== p.id));
                                if (onDeletePettyCash) onDeletePettyCash(p.id);
                                triggerToast('Removed petty cash slip');
                              }}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. CASH & BANK ACCOUNTS (SETUP & BALANCES)
         ===================================================================== */}
      {effectiveSubTab === 'cash_bank' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Add Account Form */}
          <form
            onSubmit={handleAccountSubmit}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">+ Add Hotel Bank / Cash Account</h3>
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 font-bold text-[10px] cursor-pointer"
              >
                Transfer Funds ⇄
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Register reception cash drawer, current bank accounts, UPI merchant accounts or card POS swipe machines.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Account / Drawer Name *</label>
              <input
                type="text"
                required
                value={accForm.accountName}
                onChange={(e) => setAccForm({ ...accForm, accountName: e.target.value })}
                placeholder="e.g. ICICI Hotel Current Account"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Type</label>
                <select
                  value={accForm.accountType}
                  onChange={(e) => setAccForm({ ...accForm, accountType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Cash Drawer">Cash Drawer</option>
                  <option value="Bank Account">Bank Account</option>
                  <option value="UPI Merchant">UPI Merchant</option>
                  <option value="POS Card Terminal">POS Card Terminal</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={accForm.bankName}
                  onChange={(e) => setAccForm({ ...accForm, bankName: e.target.value })}
                  placeholder="e.g. ICICI Bank"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Number / UPI ID</label>
                <input
                  type="text"
                  value={accForm.accountNumber}
                  onChange={(e) => setAccForm({ ...accForm, accountNumber: e.target.value })}
                  placeholder="XXXX-1234"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={accForm.openingBalance || ''}
                  onChange={(e) => setAccForm({ ...accForm, openingBalance: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              + Register Account
            </button>
          </form>

          {/* Accounts Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hotel Accounts & Drawers ({effectiveAccounts.length})</h3>
                <p className="text-[11px] text-slate-500">Live aggregated balances from collections, payments & transfers</p>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Transfer Funds
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {effectiveAccounts.map((acc) => {
                const isDeficit = acc.currentBalance < 0;
                return (
                  <div key={acc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {acc.accountType}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1">{acc.accountName}</h4>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {acc.bankName} • {acc.accountReference || acc.accountNumber}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Current Balance</div>
                        <div className={`text-xl font-bold ${isDeficit ? 'text-rose-600' : 'text-emerald-700'}`}>
                          ₹{Number(acc.currentBalance || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px]">Opening Bal:</span>
                        <div className="font-semibold text-slate-800">₹{Number(acc.openingBalance || 0).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="text-center">
                        <span className="text-slate-400 text-[10px]">Live Flow:</span>
                        <div className="flex items-center justify-center gap-2 font-bold text-[11px]">
                          <span className="text-emerald-700">+₹{(acc.inflowTotal || 0).toLocaleString('en-IN')}</span>
                          <span className="text-rose-600">-₹{(acc.outflowTotal || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px]">Reconciled:</span>
                        <div className="font-semibold text-slate-800">{acc.lastReconciled || todayStr}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6 & 7. PAYMENT VOUCHERS & RECEIPT VOUCHERS
         ===================================================================== */}
      {(effectiveSubTab === 'vouchers_payment' || effectiveSubTab === 'vouchers_receipt') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Manual Voucher Generation Form */}
          <form
            onSubmit={(e) =>
              handleManualVoucherSubmit(
                e,
                effectiveSubTab === 'vouchers_payment' ? 'Payment Voucher' : 'Receipt Voucher'
              )
            }
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                + Issue {effectiveSubTab === 'vouchers_payment' ? 'Manual Payment Voucher (PV)' : 'Manual Receipt Voucher (RV)'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Vouchers are auto-generated from verified transactions. Use this to issue manual authorized voucher slips.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {effectiveSubTab === 'vouchers_payment' ? 'Paid To (Payee Name) *' : 'Received From (Payer Name) *'}
              </label>
              <input
                type="text"
                required
                value={vchForm.partyName}
                onChange={(e) => setVchForm({ ...vchForm, partyName: e.target.value })}
                placeholder="Enter party / guest name"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Category / Purpose *</label>
              <input
                type="text"
                required
                value={vchForm.category}
                onChange={(e) => setVchForm({ ...vchForm, category: e.target.value })}
                placeholder="e.g. Vendor Settlement / Advance Deposit"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={vchForm.amount || ''}
                  onChange={(e) => setVchForm({ ...vchForm, amount: Number(e.target.value) })}
                  placeholder="2500"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={finHybridActive.vch ? '__HYBRID__' : vchForm.paymentMethod}
                  onChange={(e) => {
                    if (e.target.value === '__HYBRID__') {
                      const rows = createInitialHybridRows(Number(vchForm.amount) || 0);
                      setFinHybridActive((p) => ({ ...p, vch: true }));
                      setFinHybridRows((p) => ({ ...p, vch: rows }));
                      setVchForm({ ...vchForm, paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                    } else {
                      setFinHybridActive((p) => ({ ...p, vch: false }));
                      setVchForm({ ...vchForm, paymentMethod: e.target.value as PaymentMethod });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="__HYBRID__">⇄ Hybrid / Split Payment</option>
                </select>
              </div>
            </div>
            {finHybridActive.vch && (
              <HybridSplitPaymentBox
                rows={finHybridRows.vch || createInitialHybridRows(Number(vchForm.amount) || 0)}
                onChange={(rows) => {
                  setFinHybridRows((p) => ({ ...p, vch: rows }));
                  setVchForm({ ...vchForm, amount: getHybridTotal(rows), paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                }}
                targetAmount={Number(vchForm.amount) || 0}
                compact
              />
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Reference / Bill / UTR No.</label>
              <input
                type="text"
                value={vchForm.referenceNo}
                onChange={(e) => setVchForm({ ...vchForm, referenceNo: e.target.value })}
                placeholder="Slip # or UTR"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Narration / Particulars</label>
              <input
                type="text"
                value={vchForm.narration}
                onChange={(e) => setVchForm({ ...vchForm, narration: e.target.value })}
                placeholder="Being payment/receipt towards..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              + Issue {effectiveSubTab === 'vouchers_payment' ? 'Payment' : 'Receipt'} Voucher
            </button>
          </form>

          {/* Vouchers Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {effectiveSubTab === 'vouchers_payment'
                  ? `Payment Vouchers Register (${paymentVouchers.length})`
                  : `Receipt Vouchers Register (${receiptVouchers.length})`}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Voucher No & Date</th>
                    <th className="py-3 px-4">Party Name</th>
                    <th className="py-3 px-4">Category & Narration</th>
                    <th className="py-3 px-4">Mode & Ref</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(effectiveSubTab === 'vouchers_payment' ? paymentVouchers : receiptVouchers).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No vouchers issued yet. Vouchers generate automatically upon payments and receipts.
                      </td>
                    </tr>
                  ) : (
                    (effectiveSubTab === 'vouchers_payment' ? paymentVouchers : receiptVouchers).map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{v.voucherNo}</div>
                          <div className="text-[10px] text-slate-400">{v.date}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{v.partyName}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{v.category}</div>
                          <div className="text-[10px] text-slate-400">{v.narration}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-700">{v.paymentMethod}</div>
                          <div className="text-[10px] text-slate-400">{v.referenceNo}</div>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${v.type === 'Receipt Voucher' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {v.type === 'Receipt Voucher' ? '+' : '-'}₹{Number(v.amount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          8. VENDOR PAYMENTS & BILLS (CONNECTED WITH INVENTORY & PURCHASES)
         ===================================================================== */}
      {effectiveSubTab === 'vendors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Record Vendor Bill Form */}
          <form
            onSubmit={handleVendorBillSubmit}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">+ Record Vendor Bill</h3>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">Payables</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Connected with Store Inventory & Expense Register. Supports Full, Partial or Pending Payments.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vendor / Supplier Name *</label>
              <input
                type="text"
                required
                value={vendorBillForm.vendorName}
                onChange={(e) => setVendorBillForm({ ...vendorBillForm, vendorName: e.target.value })}
                placeholder="e.g. Metro Food Wholesale / Royal Linen"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor Category</label>
                <select
                  value={vendorBillForm.vendorCategory}
                  onChange={(e) => setVendorBillForm({ ...vendorBillForm, vendorCategory: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Laundry & Linen Supply">Laundry & Linen Supply</option>
                  <option value="Kitchen & F&B Raw Material">Kitchen & F&B Raw Material</option>
                  <option value="Housekeeping Supplies">Housekeeping Supplies</option>
                  <option value="Electrical, AC & Plumbing AMC">Electrical, AC & Plumbing AMC</option>
                  <option value="Generator Diesel & Gas">Generator Diesel & Gas</option>
                  <option value="General Supplier">General Supplier</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Invoice / Bill No. *</label>
                <input
                  type="text"
                  required
                  value={vendorBillForm.invoiceNumber}
                  onChange={(e) => setVendorBillForm({ ...vendorBillForm, invoiceNumber: e.target.value })}
                  placeholder="INV-9921"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bill Date</label>
                <input
                  type="date"
                  value={vendorBillForm.invoiceDate}
                  onChange={(e) => setVendorBillForm({ ...vendorBillForm, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={vendorBillForm.dueDate}
                  onChange={(e) => setVendorBillForm({ ...vendorBillForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Bill Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={vendorBillForm.invoiceAmount || ''}
                  onChange={(e) => setVendorBillForm({ ...vendorBillForm, invoiceAmount: Number(e.target.value) })}
                  placeholder="10000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Rate</label>
                <select
                  value={vendorBillForm.gstRate}
                  onChange={(e) => setVendorBillForm({ ...vendorBillForm, gstRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Paid Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={vendorBillForm.initialPaidAmount || ''}
                  onChange={(e) => setVendorBillForm({ ...vendorBillForm, initialPaidAmount: Number(e.target.value) })}
                  placeholder="0 (Unpaid)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={finHybridActive.vendor ? '__HYBRID__' : vendorBillForm.paymentMethod}
                  onChange={(e) => {
                    if (e.target.value === '__HYBRID__') {
                      const rows = createInitialHybridRows(Number(vendorBillForm.amount) || 0);
                      setFinHybridActive((p) => ({ ...p, vendor: true }));
                      setFinHybridRows((p) => ({ ...p, vendor: rows }));
                      setVendorBillForm({ ...vendorBillForm, paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                    } else {
                      setFinHybridActive((p) => ({ ...p, vendor: false }));
                      setVendorBillForm({ ...vendorBillForm, paymentMethod: e.target.value as PaymentMethod });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="__HYBRID__">⇄ Hybrid / Split Payment</option>
                </select>
              </div>
            </div>
            {finHybridActive.vendor && (
              <HybridSplitPaymentBox
                rows={finHybridRows.vendor || createInitialHybridRows(Number(vendorBillForm.amount) || 0)}
                onChange={(rows) => {
                  setFinHybridRows((p) => ({ ...p, vendor: rows }));
                  setVendorBillForm({ ...vendorBillForm, paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                }}
                targetAmount={Number(vendorBillForm.amount) || 0}
                compact
              />
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              + Record Vendor Bill & Update Payables
            </button>
          </form>

          {/* Vendor Bills & Payables Ledger */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Vendor Bills & Payables Ledger ({filteredVendorBills.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Outstanding Payables: ₹{totalOutstandingVendorPayables.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Invoice & Date</th>
                    <th className="py-3 px-4">Vendor & Category</th>
                    <th className="py-3 px-4 text-right">Bill Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Remaining Payable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVendorBills.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No vendor bills logged yet for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredVendorBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{bill.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-400">{bill.invoiceDate}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{bill.vendorName}</div>
                          <div className="text-[10px] text-slate-400">{bill.vendorCategory}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">
                          ₹{Number(bill.invoiceAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                          ₹{Number(bill.paidAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-700">
                          ₹{Number(bill.remainingPayable || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              bill.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bill.status === 'Partially Paid'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {bill.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {bill.remainingPayable > 0 ? (
                            <button
                              onClick={() => {
                                setSettleBillModal(bill);
                                setSettlePayAmount(bill.remainingPayable);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Settle / Pay
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-bold">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          9. OWNER DRAWINGS & CAPITAL (SEPARATED FROM OPERATING P&L)
         ===================================================================== */}
      {effectiveSubTab === 'owner_payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Owner Transaction Form */}
          <form
            onSubmit={handleOwnerSubmit}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">+ Owner Drawing / Capital Entry</h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Owner Capital increases hotel equity without creating taxable revenue. Drawings decrease equity without inflating operational expenses.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Owner / Director Name *</label>
              <input
                type="text"
                required
                value={ownForm.directorName}
                onChange={(e) => setOwnForm({ ...ownForm, directorName: e.target.value })}
                placeholder="e.g. Harsh Singhania / Managing Partner"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transaction Type</label>
              <select
                value={ownForm.type}
                onChange={(e) => setOwnForm({ ...ownForm, type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
              >
                <option value="Owner Withdrawal / Drawing">Owner Withdrawal / Drawing (Outflow from Bank)</option>
                <option value="Capital Injection">Capital Injection into Hotel (Inflow into Bank)</option>
                <option value="Director Remuneration">Director Remuneration (Administrative Payout)</option>
                <option value="Profit Distribution">Profit Distribution (Outflow)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={ownForm.amount || ''}
                  onChange={(e) => setOwnForm({ ...ownForm, amount: Number(e.target.value) })}
                  placeholder="25000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={finHybridActive.own ? '__HYBRID__' : ownForm.paymentMethod}
                  onChange={(e) => {
                    if (e.target.value === '__HYBRID__') {
                      const rows = createInitialHybridRows(Number(ownForm.amount) || 0, ['Bank Transfer', 'Cash', 'UPI']);
                      setFinHybridActive((p) => ({ ...p, own: true }));
                      setFinHybridRows((p) => ({ ...p, own: rows }));
                      setOwnForm({ ...ownForm, paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                    } else {
                      setFinHybridActive((p) => ({ ...p, own: false }));
                      setOwnForm({ ...ownForm, paymentMethod: e.target.value as PaymentMethod });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="__HYBRID__">⇄ Hybrid / Split Payment</option>
                </select>
              </div>
            </div>
            {finHybridActive.own && (
              <HybridSplitPaymentBox
                rows={finHybridRows.own || createInitialHybridRows(Number(ownForm.amount) || 0, ['Bank Transfer', 'Cash', 'UPI'])}
                onChange={(rows) => {
                  setFinHybridRows((p) => ({ ...p, own: rows }));
                  setOwnForm({ ...ownForm, amount: getHybridTotal(rows), paymentMethod: formatHybridLabel(rows) as PaymentMethod });
                }}
                modes={['Bank Transfer', 'Cash', 'UPI']}
                targetAmount={Number(ownForm.amount) || 0}
                compact
              />
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Reference / UTR No.</label>
              <input
                type="text"
                value={ownForm.referenceNo}
                onChange={(e) => setOwnForm({ ...ownForm, referenceNo: e.target.value })}
                placeholder="e.g. UTR-88119"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Notes / Purpose</label>
              <input
                type="text"
                value={ownForm.notes}
                onChange={(e) => setOwnForm({ ...ownForm, notes: e.target.value })}
                placeholder="e.g. Monthly owner drawing transferred to personal account"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              + Save Owner Equity / Drawing Entry
            </button>
          </form>

          {/* Owner Ledger Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Owner Drawings & Capital Ledger ({filteredOwnerLedger.length})
              </h3>
              <div className="text-xs font-bold">
                <span className="text-emerald-700 mr-3">Capital In: +₹{totalCapitalInjections.toLocaleString('en-IN')}</span>
                <span className="text-rose-700">Drawings Out: -₹{totalOwnerDrawingsOutflow.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Owner / Director</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4">Mode & Notes</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOwnerLedger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No owner capital or drawing entries logged yet for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredOwnerLedger.map((ol) => (
                      <tr key={ol.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-500">{ol.date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{ol.directorName}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ol.type === 'Capital Injection' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ol.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {ol.paymentMethod} — {ol.notes}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${ol.type === 'Capital Injection' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {ol.type === 'Capital Injection' ? '+' : '-'}₹{Number(ol.amount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          10. STAFF REIMBURSEMENTS (CONNECTS WITH STAFF WORKSPACE)
         ===================================================================== */}
      {effectiveSubTab === 'reimbursements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Submit Claim Form */}
          <form
            onSubmit={handleStaffClaimSubmit}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">+ Submit Staff Expense Claim</h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Staff members submit claims here. Only after approval and actual payment are funds deducted from cash/bank and added to P&L expenses.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Staff Member Name *</label>
              <input
                type="text"
                required
                value={rmForm.staffName}
                onChange={(e) => setRmForm({ ...rmForm, staffName: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Department</label>
              <select
                value={rmForm.department}
                onChange={(e) => setRmForm({ ...rmForm, department: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="Housekeeping">Housekeeping</option>
                <option value="Front Office">Front Office</option>
                <option value="F&B Kitchen">F&B Kitchen</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Expense Description / Particulars *</label>
              <input
                type="text"
                required
                value={rmForm.title}
                onChange={(e) => setRmForm({ ...rmForm, title: e.target.value })}
                placeholder="e.g. Purchased urgent plumbing valve for Room 204"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Claim Amount (₹) *</label>
              <input
                type="number"
                min={1}
                required
                value={rmForm.amount || ''}
                onChange={(e) => setRmForm({ ...rmForm, amount: Number(e.target.value) })}
                placeholder="350"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              + Submit Staff Claim (Pending Review)
            </button>
          </form>

          {/* Staff Reimbursements Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Staff Reimbursement Registry ({filteredReimbursements.length})
              </h3>
              <div className="text-xs font-bold text-slate-600">
                Paid: ₹{totalPaidReimbursements.toLocaleString('en-IN')} • Pending: ₹{totalPendingReimbursements.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Particulars</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReimbursements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No staff reimbursement claims submitted yet for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredReimbursements.map((rm) => (
                      <tr key={rm.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-500">{rm.date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {rm.staffName}
                          <div className="text-[10px] text-slate-400 font-normal">{rm.department}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{rm.title}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₹{Number(rm.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              rm.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rm.status === 'Approved'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rm.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {rm.status === 'Pending' && (
                            <button
                              onClick={() => handleApproveStaffClaim(rm)}
                              className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {rm.status !== 'Paid' && (
                            <button
                              onClick={() => handlePayStaffClaim(rm)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Pay Cash
                            </button>
                          )}
                          {rm.status === 'Paid' && (
                            <span className="text-emerald-700 text-[11px] font-bold">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          11. DAILY SHIFT CLOSING (ACTUAL CASH RECONCILIATION)
         ===================================================================== */}
      {effectiveSubTab === 'daily_closing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Shift Closing Form */}
          <form
            onSubmit={handleShiftClosingSubmit}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 h-fit text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Close Shift & Verify Drawer Cash</h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Pulls actual Cash Room Collections, Cash POS Sales, Cash Refunds & Cash Expenses for the selected date. Never includes UPI/Card.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Shift Date</label>
                <input
                  type="date"
                  value={dcDate}
                  onChange={(e) => setDcDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Opening Cash Float (₹) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={dcOpeningCash || ''}
                  onChange={(e) => setDcOpeningCash(Number(e.target.value))}
                  placeholder="5000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
            </div>

            {/* Shift Breakdown Box */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">+ Room Booking Cash In:</span>
                <span className="font-bold text-emerald-700">+₹{Number(shiftCashInflows.roomCash || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">+ POS & Misc Cash In:</span>
                <span className="font-bold text-emerald-700">+₹{(shiftCashInflows.posCash + shiftCashInflows.miscCash).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">- Cash Expenses & Refunds Out:</span>
                <span className="font-bold text-rose-700">-₹{Number(shiftCashOutflows.total || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Expected System Cash:</span>
                <span>₹{expectedShiftCash.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Denomination Breakdown (Optional) */}
            <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50 space-y-2">
              <div className="text-[11px] font-bold text-slate-700 uppercase">Cash Denomination Count:</div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400">₹500 x</span>
                  <input
                    type="number"
                    min={0}
                    value={dcDenominations['500'] || ''}
                    onChange={(e) => setDcDenominations({ ...dcDenominations, '500': Number(e.target.value) })}
                    className="w-full px-2 py-1 border rounded bg-white font-bold"
                  />
                </div>
                <div>
                  <span className="text-slate-400">₹200 x</span>
                  <input
                    type="number"
                    min={0}
                    value={dcDenominations['200'] || ''}
                    onChange={(e) => setDcDenominations({ ...dcDenominations, '200': Number(e.target.value) })}
                    className="w-full px-2 py-1 border rounded bg-white font-bold"
                  />
                </div>
                <div>
                  <span className="text-slate-400">₹100 x</span>
                  <input
                    type="number"
                    min={0}
                    value={dcDenominations['100'] || ''}
                    onChange={(e) => setDcDenominations({ ...dcDenominations, '100': Number(e.target.value) })}
                    className="w-full px-2 py-1 border rounded bg-white font-bold"
                  />
                </div>
              </div>
              {computedDenominationsTotal > 0 && (
                <div className="text-[11px] font-bold text-blue-700">
                  Denominations Total: ₹{computedDenominationsTotal.toLocaleString('en-IN')}
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Physical Cash Counted in Drawer (₹) *</label>
              <input
                type="number"
                min={0}
                required
                value={computedDenominationsTotal > 0 ? computedDenominationsTotal : (dcPhysicalCash || '')}
                onChange={(e) => setDcPhysicalCash(Number(e.target.value))}
                placeholder={String(expectedShiftCash)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Shift Handover Closed By *</label>
              <input
                type="text"
                required
                value={dcClosedBy}
                onChange={(e) => setDcClosedBy(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition shadow-sm"
            >
              ✓ Complete Shift Cash Closing
            </button>
          </form>

          {/* Daily Shift Closing Registry */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Daily Shift Cash Closing & Handover Register ({filteredDailyClosings.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Shift Date</th>
                    <th className="py-3 px-4 text-right">Opening</th>
                    <th className="py-3 px-4 text-right">Cash In</th>
                    <th className="py-3 px-4 text-right">Cash Out</th>
                    <th className="py-3 px-4 text-right">Expected</th>
                    <th className="py-3 px-4 text-right">Physical</th>
                    <th className="py-3 px-4 text-center">Variance / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDailyClosings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No shift closings saved yet for the selected date range. Complete today's drawer count on the left.
                      </td>
                    </tr>
                  ) : (
                    filteredDailyClosings.map((dc) => (
                      <tr key={dc.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {dc.date}
                          <div className="text-[10px] text-slate-400 font-normal">{dc.closedBy}</div>
                        </td>
                        <td className="py-3 px-4 text-right">₹{Number(dc.openingCash || 0).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                          +₹{((dc.roomCashIn || 0) + (dc.posCashIn || 0)).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-rose-700">
                          -₹{Number(dc.cashExpensesOut || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₹{Number(dc.expectedClosing || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-700">
                          ₹{Number(dc.physicalCounted || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              dc.discrepancy === 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {dc.discrepancy === 0 ? 'Exact Balanced' : `Var: ₹${Number(dc.discrepancy || 0).toLocaleString('en-IN')}`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          12. P&L & 5% GST SUMMARY (READ-ONLY REPORTING)
         ===================================================================== */}
      {effectiveSubTab === 'pl_reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* P&L Statement */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-slate-900">Hotel Profit & Loss Statement</h3>
                <p className="text-xs text-slate-500">Live dynamic accounting statement (Filtered by Date Range)</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                GOP: ₹{grossOperatingProfit.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider text-slate-400">
                Operating Revenue Inflows:
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Room &amp; Stay Revenue (Pre-Tax)</span>
                <span className="font-bold text-emerald-700">
                  ₹{operatingRevenueBreakdown.roomPreTax.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Room-Billed Food, Water &amp; Add-Ons (Pre-Tax)</span>
                <span className="font-bold text-emerald-700">
                  ₹{operatingRevenueBreakdown.roomAddOnsPreTax.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Counter POS Food &amp; Beverage (Pre-Tax)</span>
                <span className="font-bold text-emerald-700">
                  ₹{operatingRevenueBreakdown.counterPosPreTax.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Counter Laundry &amp; Misc Income (Pre-Tax)</span>
                <span className="font-bold text-emerald-700">
                  ₹{r2(operatingRevenueBreakdown.counterLaundryPreTax + operatingRevenueBreakdown.miscPreTax).toLocaleString('en-IN')}
                </span>
              </div>
              {operatingRevenueBreakdown.refunds > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-rose-700">
                  <span>Less: Guest Refunds</span>
                  <span className="font-bold">-₹{operatingRevenueBreakdown.refunds.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between py-2 bg-emerald-50/70 px-3 rounded-xl font-bold text-emerald-900">
                <span>Total Operating Revenue (Pre-Tax)</span>
                <span>₹{totalOperatingRevenue.toLocaleString('en-IN')}</span>
              </div>

              <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider text-slate-400 pt-3">
                Operating Expenses:
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Operational & Extra Expenses Paid</span>
                <span className="font-bold text-rose-700">-₹{totalPaidExpensesOutflow.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Petty Cash Daily Outflows</span>
                <span className="font-bold text-rose-700">-₹{pettyCashSpends.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Settled Staff Reimbursements</span>
                <span className="font-bold text-rose-700">-₹{totalPaidReimbursements.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-2 bg-rose-50/70 px-3 rounded-xl font-bold text-rose-900">
                <span>Total Operating Expenses</span>
                <span>-₹{totalOperatingExpenses.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between py-3 bg-slate-900 text-white px-4 rounded-xl font-bold text-sm mt-3">
                <span>Net Operating Profit / EBITDA</span>
                <span className={grossOperatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  ₹{grossOperatingProfit.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* GST Tax Summary (0%, 5%, 12%, 18% Slabs) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-slate-900">GST Output vs Input Tax Credit (ITC)</h3>
                <p className="text-xs text-slate-500">Tax compliance calculation based on actual invoices</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs">
                Payable: ₹{Number(gstBreakdown.netGstPayable || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Taxable Operating Revenue Base</span>
                <span className="font-bold text-slate-800">₹{Number(gstBreakdown.outputTaxable || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Output CGST (Central Tax)</span>
                <span className="font-semibold text-slate-800">₹{Number(gstBreakdown.outputCgst || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Output SGST (State Tax)</span>
                <span className="font-semibold text-slate-800">₹{Number(gstBreakdown.outputSgst || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-2 bg-slate-50 px-3 rounded-xl font-bold text-slate-900">
                <span>Total Output GST Collected</span>
                <span>₹{Number(gstBreakdown.totalOutputGst || 0).toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100 pt-3">
                <span className="text-slate-600">Input CGST Credit on Purchases</span>
                <span className="font-semibold text-emerald-700">₹{Number(gstBreakdown.inputCgst || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Input SGST Credit on Purchases</span>
                <span className="font-semibold text-emerald-700">₹{Number(gstBreakdown.inputSgst || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-xl font-bold text-emerald-900">
                <span>Total Eligible Input Tax Credit (ITC)</span>
                <span>-₹{Number(gstBreakdown.totalInputItc || 0).toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between py-3 bg-amber-500 text-slate-950 px-4 rounded-xl font-extrabold text-sm mt-3">
                <span>Net GST Payable to Government</span>
                <span>₹{Number(gstBreakdown.netGstPayable || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settle Bill Modal */}
      {settleBillModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Settle Vendor Bill #{settleBillModal.invoiceNumber}</h3>
              <button onClick={() => setSettleBillModal(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-1 bg-slate-50 p-3 rounded-xl">
              <div>Vendor: <strong>{settleBillModal.vendorName}</strong></div>
              <div>Total Bill: ₹{Number(settleBillModal.invoiceAmount || 0).toLocaleString('en-IN')}</div>
              <div>Already Paid: ₹{Number(settleBillModal.paidAmount || 0).toLocaleString('en-IN')}</div>
              <div className="text-rose-700 font-bold">Remaining Payable: ₹{Number(settleBillModal.remainingPayable || 0).toLocaleString('en-IN')}</div>
            </div>
            <form onSubmit={handleExecuteSettleBill} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Disbursement Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  max={settleBillModal.remainingPayable}
                  required
                  value={settlePayAmount || ''}
                  onChange={(e) => setSettlePayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={finHybridActive.settle ? '__HYBRID__' : settlePayMethod}
                  onChange={(e) => {
                    if (e.target.value === '__HYBRID__') {
                      const rows = createInitialHybridRows(Number(settlePayAmount) || 0);
                      setFinHybridActive((p) => ({ ...p, settle: true }));
                      setFinHybridRows((p) => ({ ...p, settle: rows }));
                      setSettlePayMethod(formatHybridLabel(rows) as PaymentMethod);
                    } else {
                      setFinHybridActive((p) => ({ ...p, settle: false }));
                      setSettlePayMethod(e.target.value as PaymentMethod);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-semibold"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash Drawer</option>
                  <option value="Card">Card</option>
                  <option value="__HYBRID__">⇄ Hybrid / Split Payment</option>
                </select>
                {finHybridActive.settle && (
                  <HybridSplitPaymentBox
                    rows={finHybridRows.settle || createInitialHybridRows(Number(settlePayAmount) || 0)}
                    onChange={(rows) => {
                      setFinHybridRows((p) => ({ ...p, settle: rows }));
                      setSettlePayAmount(getHybridTotal(rows));
                      setSettlePayMethod(formatHybridLabel(rows) as PaymentMethod);
                    }}
                    targetAmount={Number(settlePayAmount) || 0}
                    compact
                  />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Notes / UTR</label>
                <input
                  type="text"
                  value={settlePayNotes}
                  onChange={(e) => setSettlePayNotes(e.target.value)}
                  placeholder="e.g. UTR-991182"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleBillModal(null)}
                  className="px-4 py-2 border rounded-xl text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  Disburse Payment & Issue PV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal Transfer Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Transfer Funds Between Hotel Accounts</h3>
              <button onClick={() => setTransferModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleExecuteTransfer} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">From Account (Source) *</label>
                <select
                  value={transferState.fromAccId}
                  onChange={(e) => setTransferState({ ...transferState, fromAccId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-semibold"
                >
                  {effectiveAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} (Bal: ₹{Number(a.currentBalance || 0).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">To Account (Destination) *</label>
                <select
                  value={transferState.toAccId}
                  onChange={(e) => setTransferState({ ...transferState, toAccId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-semibold"
                >
                  {effectiveAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} (Bal: ₹{Number(a.currentBalance || 0).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transfer Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={transferState.amount || ''}
                  onChange={(e) => setTransferState({ ...transferState, amount: Number(e.target.value) })}
                  placeholder="10000"
                  className="w-full px-3 py-2 border rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reference / Cheque No.</label>
                <input
                  type="text"
                  value={transferState.referenceNo}
                  onChange={(e) => setTransferState({ ...transferState, referenceNo: e.target.value })}
                  placeholder="e.g. CASH-DEP-101"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl font-bold cursor-pointer"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default FinanceModule;