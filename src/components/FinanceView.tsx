import React, { useState, useMemo } from 'react';
import { 
  Booking, Invoice, Expense, ExpenseCategory, PosOrder, PettyCashTransaction, CashBankAccount, 
  FinanceVoucher, Vendor, OwnerDirectorPayment, StaffReimbursement, DailyClosingRecord,
  HotelSettings, UserRole, InventoryPurchase, RecurringExpenseSchedule, ExpenseCategoryDefinition
} from '../types';
import { INITIAL_RECURRING_EXPENSES, INITIAL_EXPENSE_CATEGORIES } from '../utils/dummyData';
import { 
  TrendingUp, TrendingDown, Coins, Landmark, Receipt, Building2, UserCheck, 
  Wallet, Clock, LayoutDashboard, Plus, Search, Filter, Download, CheckCircle, 
  AlertTriangle, ArrowUpRight, ArrowDownRight, CreditCard, FileCheck, RefreshCw, 
  DollarSign, FileText, ChevronRight, Eye, Trash2, Printer, Paperclip, ShieldCheck,
  XCircle, Layers, PieChart, BarChart3, Sliders, Calendar, Edit3, Check, X,
  ExternalLink, FileSpreadsheet
} from 'lucide-react';

interface FinanceViewProps {
  hotelId?: string;
  initialSubTab?: string;
  currentSubTab?: string;
  onSelectSubTab?: (subTab: string) => void;
  bookings: Booking[];
  checkins?: any[];
  invoices: Invoice[];
  expenses: Expense[];
  posOrders: PosOrder[];
  pettyCash: PettyCashTransaction[];
  cashBankAccounts: CashBankAccount[];
  vouchers: FinanceVoucher[];
  vendors: Vendor[];
  ownerPayments: OwnerDirectorPayment[];
  reimbursements: StaffReimbursement[];
  dailyClosings: DailyClosingRecord[];
  inventoryPurchases?: InventoryPurchase[];
  inventorySuppliers?: any[];
  auditLogs?: any[];
  hotelSettings?: HotelSettings;
  currentRole: UserRole;
  onUpdatePettyCash: (list: PettyCashTransaction[]) => void;
  onUpdateCashBankAccounts: (list: CashBankAccount[]) => void;
  onUpdateVouchers: (list: FinanceVoucher[]) => void;
  onUpdateVendors: (list: Vendor[]) => void;
  onUpdateOwnerPayments: (list: OwnerDirectorPayment[]) => void;
  onUpdateReimbursements: (list: StaffReimbursement[]) => void;
  onUpdateDailyClosings: (list: DailyClosingRecord[]) => void;
  onUpdateExpenses: (list: Expense[]) => void;
  onUpdateInvoices?: (list: Invoice[]) => void;
  onUpdateInventoryPurchases?: (list: InventoryPurchase[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function FinanceView({
  currentSubTab = 'dashboard',
  onSelectSubTab,
  bookings = [],
  invoices = [],
  expenses = [],
  posOrders = [],
  pettyCash = [],
  cashBankAccounts = [],
  vouchers = [],
  vendors = [],
  ownerPayments = [],
  reimbursements = [],
  dailyClosings = [],
  hotelSettings,
  currentRole,
  onUpdatePettyCash,
  onUpdateCashBankAccounts,
  onUpdateVouchers,
  onUpdateVendors,
  onUpdateOwnerPayments,
  onUpdateReimbursements,
  onUpdateDailyClosings,
  onUpdateExpenses
}: FinanceViewProps) {
  const [subTab, setSubTab] = useState<string>(currentSubTab);
  const activeSubTab = currentSubTab || subTab;

  const changeSubTab = (tab: string) => {
    setSubTab(tab);
    if (onSelectSubTab) onSelectSubTab(tab);
  };

  // --- GLOBAL DATE FILTER STATE (Default: Today Only) ---
  const [refTodayDate, setRefTodayDate] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [dateFilterPreset, setDateFilterPreset] = useState<'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().substring(0, 10));

  const yesterdayOf = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().substring(0, 10);
  };

  const startOfWeekOf = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().substring(0, 10);
  };

  const endOfWeekOf = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const sunday = new Date(d.setDate(diff + 6));
    return sunday.toISOString().substring(0, 10);
  };

  const startOfMonthOf = (dateStr: string) => {
    return dateStr.substring(0, 8) + '01';
  };

  const endOfMonthOf = (dateStr: string) => {
    const d = new Date(dateStr);
    const endMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return endMonth.toISOString().substring(0, 10);
  };

  const computedRangeStart = useMemo(() => {
    if (dateFilterPreset === 'all') return '1970-01-01';
    if (dateFilterPreset === 'today') return refTodayDate;
    if (dateFilterPreset === 'yesterday') return yesterdayOf(refTodayDate);
    if (dateFilterPreset === 'thisWeek') return startOfWeekOf(refTodayDate);
    if (dateFilterPreset === 'thisMonth') return startOfMonthOf(refTodayDate);
    return customStartDate || refTodayDate;
  }, [dateFilterPreset, refTodayDate, customStartDate]);

  const computedRangeEnd = useMemo(() => {
    if (dateFilterPreset === 'all') return '2099-12-31';
    if (dateFilterPreset === 'today') return refTodayDate;
    if (dateFilterPreset === 'yesterday') return yesterdayOf(refTodayDate);
    if (dateFilterPreset === 'thisWeek') return endOfWeekOf(refTodayDate);
    if (dateFilterPreset === 'thisMonth') return endOfMonthOf(refTodayDate);
    return customEndDate || refTodayDate;
  }, [dateFilterPreset, refTodayDate, customEndDate]);

  const isRecordInDateRange = (dateStr?: string) => {
    if (dateFilterPreset === 'all') return true;
    if (!dateStr) return false;
    const d = dateStr.substring(0, 10);
    return d >= computedRangeStart && d <= computedRangeEnd;
  };

  // State for modals
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [pettyForm, setPettyForm] = useState<{ type: 'Inflow' | 'Outflow'; category: string; amount: number; handler: string; notes: string }>({
    type: 'Outflow', category: 'Miscellaneous', amount: 0, handler: 'Reception Desk', notes: ''
  });

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromAccId: '', toAccId: '', amount: 0, notes: '' });

  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    voucherType: 'Payment Voucher' as 'Payment Voucher' | 'Receipt Voucher',
    partyName: '', paymentMethod: 'Cash' as 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque',
    accountName: 'Main Front Desk Cash Drawer', amount: 0, narration: '', referenceNo: '', category: 'General'
  });

  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', companyName: '', category: 'General', mobile: '', email: '', gstNumber: '', address: '', openingBalance: 0 });

  const [showDirectorModal, setShowDirectorModal] = useState(false);
  const [directorForm, setDirectorForm] = useState({
    directorName: 'Raghu Sir (Managing Director)', type: 'Capital Injection' as 'Capital Injection' | 'Director Salary' | 'Profit Drawing' | 'Loan Repayment',
    amount: 0, paymentMethod: 'Bank Transfer' as 'Cash' | 'Bank Transfer' | 'Cheque', bankAccountName: 'HDFC Bank Primary Operating Account', notes: '', referenceNo: ''
  });

  const [showReimbModal, setShowReimbModal] = useState(false);
  const [reimbForm, setReimbForm] = useState({ staffName: '', staffRole: 'Staff', expenseTitle: '', category: 'Local Transport', amount: 0 });

  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingForm, setClosingForm] = useState({
    openingCash: 30000, actualCash: 0, notes: ''
  });

  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<FinanceVoucher | null>(null);

  // --- EXPENSE MODULE EXTENDED STATES ---
  const [expenseInnerTab, setExpenseInnerTab] = useState<'all' | 'approval' | 'categories' | 'recurring' | 'reports'>('all');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    id: '',
    expenseNo: '',
    branchName: 'GRAND PAVILION',
    department: 'Utilities',
    category: 'Utilities',
    subcategory: 'Electricity Bill',
    vendorName: '',
    vendorId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    baseAmount: 0,
    taxRate: 18,
    taxAmount: 0,
    amount: 0,
    paymentSource: 'Petty Cash' as const,
    paymentMethod: 'Cash' as const,
    paymentStatus: 'Paid' as const,
    approvalStatus: 'Approved' as const,
    billFileName: '',
    billFileData: '',
    isRecurring: false,
    recurringFrequency: 'Monthly' as const,
    notes: ''
  });

  // Expense Filters
  const [expSearch, setExpSearch] = useState('');
  const [expDeptFilter, setExpDeptFilter] = useState('All');
  const [expCatFilter, setExpCatFilter] = useState('All');
  const [expSourceFilter, setExpSourceFilter] = useState('All');
  const [expApprovalFilter, setExpApprovalFilter] = useState('All');
  const [expDateFrom, setExpDateFrom] = useState('');
  const [expDateTo, setExpDateTo] = useState('');

  // Bulk actions selection
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);

  // Preview & Print Expense Voucher Modal
  const [selectedExpForPrint, setSelectedExpForPrint] = useState<Expense | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<Expense | null>(null);

  // Recurring schedules & Categories state
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringExpenseSchedule[]>(INITIAL_RECURRING_EXPENSES);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringForm, setRecurringForm] = useState<Partial<RecurringExpenseSchedule>>({
    title: '',
    department: 'Utilities',
    category: 'Utilities',
    vendorName: '',
    estimatedAmount: 0,
    frequency: 'Monthly',
    dueDayOfMonth: 5,
    paymentSource: 'Bank Account',
    notes: ''
  });

  const [categoryDefs, setCategoryDefs] = useState<ExpenseCategoryDefinition[]>(INITIAL_EXPENSE_CATEGORIES);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState<Partial<ExpenseCategoryDefinition>>({
    department: 'Room Operations',
    categoryName: '',
    subcategories: ['General'],
    monthlyBudgetLimit: 25000,
    notes: ''
  });
  const [newSubcatInput, setNewSubcatInput] = useState('');

  // Standard Departments
  const HOTEL_DEPARTMENTS = [
    'Room Operations',
    'Housekeeping',
    'Laundry',
    'Restaurant & Kitchen',
    'Grocery',
    'Inventory Purchases',
    'Maintenance',
    'Utilities',
    'Staff Salary & Welfare',
    'Marketing',
    'Office Expenses',
    'Fuel & Transport',
    'Taxes & Licenses',
    'Miscellaneous'
  ];

  // Reset Expense Form
  const resetExpenseForm = () => {
    setExpenseForm({
      id: '',
      expenseNo: '',
      branchName: 'GRAND PAVILION',
      department: 'Utilities',
      category: 'Utilities',
      subcategory: 'Electricity Bill',
      vendorName: '',
      vendorId: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      baseAmount: 0,
      taxRate: 18,
      taxAmount: 0,
      amount: 0,
      paymentSource: 'Petty Cash',
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      approvalStatus: 'Approved',
      billFileName: '',
      billFileData: '',
      isRecurring: false,
      recurringFrequency: 'Monthly',
      notes: ''
    });
    setEditingExpense(null);
  };

  // Open Edit Expense
  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseForm({
      id: exp.id,
      expenseNo: exp.expenseNo || exp.id,
      branchName: exp.branchName || 'GRAND PAVILION',
      department: exp.department || 'Utilities',
      category: exp.category || 'Utilities',
      subcategory: exp.subcategory || '',
      vendorName: exp.vendorName || '',
      vendorId: exp.vendorId || '',
      date: exp.date || new Date().toISOString().split('T')[0],
      description: exp.description || '',
      baseAmount: exp.baseAmount || exp.amount || 0,
      taxRate: exp.taxRate || 0,
      taxAmount: exp.taxAmount || 0,
      amount: exp.amount || 0,
      paymentSource: (exp.paymentSource as any) || 'Bank Account',
      paymentMethod: (exp.paymentMethod as any) || 'Online Transfer',
      paymentStatus: (exp.paymentStatus as any) || 'Paid',
      approvalStatus: (exp.approvalStatus as any) || 'Approved',
      billFileName: exp.billFileName || '',
      billFileData: exp.billFileData || '',
      isRecurring: exp.isRecurring || false,
      recurringFrequency: (exp.recurringFrequency as any) || 'Monthly',
      notes: exp.notes || ''
    });
    setShowExpenseModal(true);
  };

  // Save Expense Handler
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || expenseForm.amount <= 0) {
      alert('Please enter a valid description and expense amount.');
      return;
    }

    const expNo = expenseForm.expenseNo || `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalApproval = expenseForm.approvalStatus || (['Admin', 'Owner', 'Manager', 'Accounts'].includes(currentRole) ? 'Approved' : 'Pending');

    const expItem: Expense = {
      id: editingExpense ? editingExpense.id : `exp-${Date.now()}`,
      expenseNo: expNo,
      branchName: expenseForm.branchName || 'GRAND PAVILION',
      department: expenseForm.department,
      category: expenseForm.category,
      subcategory: expenseForm.subcategory,
      vendorName: expenseForm.vendorName,
      vendorId: expenseForm.vendorId,
      date: expenseForm.date,
      description: expenseForm.description,
      baseAmount: expenseForm.baseAmount,
      taxRate: expenseForm.taxRate,
      taxAmount: expenseForm.taxAmount,
      amount: expenseForm.amount,
      paymentSource: expenseForm.paymentSource,
      paymentMethod: expenseForm.paymentMethod,
      paymentStatus: expenseForm.paymentStatus,
      approvalStatus: finalApproval,
      approvedBy: finalApproval === 'Approved' ? currentRole : undefined,
      approvedDate: finalApproval === 'Approved' ? new Date().toISOString().split('T')[0] : undefined,
      billFileName: expenseForm.billFileName,
      billFileData: expenseForm.billFileData,
      isRecurring: expenseForm.isRecurring,
      recurringFrequency: expenseForm.recurringFrequency,
      notes: expenseForm.notes,
      createdBy: currentRole
    };

    let updatedList = [...expenses];
    if (editingExpense) {
      updatedList = updatedList.map(item => item.id === editingExpense.id ? expItem : item);
    } else {
      updatedList = [expItem, ...updatedList];
    }

    onUpdateExpenses(updatedList);

    // Always log a Petty Cash Outflow for expenses (as requested: expense hamesha petty cash se aaye)
    if (finalApproval === 'Approved') {
      const pcEntry: PettyCashTransaction = {
        id: `PC-EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: expenseForm.date,
        type: 'Outflow',
        category: expenseForm.category || 'Hotel Expense',
        amount: Number(expenseForm.amount) || 0,
        handler: currentRole || 'Reception Desk',
        notes: `Expense [${expNo}]: ${expenseForm.description} (${expenseForm.category || 'General'})`,
        approvedBy: currentRole || 'Admin'
      };
      onUpdatePettyCash([pcEntry, ...pettyCash]);
    }

    setShowExpenseModal(false);
    resetExpenseForm();
  };

  // Delete Expense Handler
  const handleDeleteExpense = (expId: string) => {
    if (confirm('Are you sure you want to delete this expense entry?')) {
      onUpdateExpenses(expenses.filter(e => e.id !== expId));
    }
  };

  // Bulk Approve / Reject
  const handleBulkApprove = () => {
    if (selectedExpIds.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const newPettyEntries: PettyCashTransaction[] = [];

    const updated = expenses.map(item => {
      if (selectedExpIds.includes(item.id)) {
        if (item.paymentSource === 'Petty Cash' && item.approvalStatus !== 'Approved') {
          newPettyEntries.push({
            id: `PC-EXP-${Date.now()}-${Math.random()}`,
            date: today,
            type: 'Outflow',
            category: item.category,
            amount: item.amount,
            handler: currentRole,
            notes: `Bulk Approved Expense [${item.expenseNo || item.id}]: ${item.description}`,
            approvedBy: currentRole
          });
        }
        return {
          ...item,
          approvalStatus: 'Approved' as const,
          approvedBy: currentRole,
          approvedDate: today
        };
      }
      return item;
    });

    onUpdateExpenses(updated);
    if (newPettyEntries.length > 0) {
      onUpdatePettyCash([...newPettyEntries, ...pettyCash]);
    }
    setSelectedExpIds([]);
    alert(`Successfully approved ${selectedExpIds.length} expense(s)!`);
  };

  const handleBulkReject = () => {
    if (selectedExpIds.length === 0) return;
    const today = new Date().toISOString().split('T')[0];

    const updated = expenses.map(item => {
      if (selectedExpIds.includes(item.id)) {
        return {
          ...item,
          approvalStatus: 'Rejected' as const,
          approvedBy: currentRole,
          approvedDate: today
        };
      }
      return item;
    });

    onUpdateExpenses(updated);
    setSelectedExpIds([]);
    alert(`Rejected ${selectedExpIds.length} expense(s).`);
  };

  // Export Expenses CSV (Strictly filters by selected Date-to-Date range and active filters)
  const getDateFilteredExpenses = () => {
    return expenses.filter(e => {
      const matchesSearch = !expSearch || 
        (e.expenseNo || e.id).toLowerCase().includes(expSearch.toLowerCase()) ||
        (e.vendorName || '').toLowerCase().includes(expSearch.toLowerCase()) ||
        (e.description || '').toLowerCase().includes(expSearch.toLowerCase());
      const matchesDept = expDeptFilter === 'All' || e.department === expDeptFilter;
      const matchesSource = expSourceFilter === 'All' || e.paymentSource === expSourceFilter;
      const matchesApproval = expApprovalFilter === 'All' || (e.approvalStatus || 'Approved') === expApprovalFilter;
      const matchesFrom = !expDateFrom || e.date >= expDateFrom;
      const matchesTo = !expDateTo || e.date <= expDateTo;
      return matchesSearch && matchesDept && matchesSource && matchesApproval && matchesFrom && matchesTo;
    });
  };

  const handleExportExpensesCSV = (dataToExport?: Expense[]) => {
    const targetData = dataToExport || getDateFilteredExpenses();
    const headers = [
      'Expense No', 'Date', 'Branch', 'Department', 'Category', 'Subcategory', 
      'Vendor', 'Description', 'Base Amount (INR)', 'GST Tax %', 'Tax Amount (INR)', 
      'Total Amount (INR)', 'Payment Source', 'Payment Method', 'Payment Status', 'Approval Status'
    ];

    const rows = targetData.map(e => [
      `"${e.expenseNo || e.id}"`,
      `"${e.date}"`,
      `"${e.branchName || 'GRAND PAVILION'}"`,
      `"${e.department || 'General'}"`,
      `"${e.category}"`,
      `"${e.subcategory || '-'}"`,
      `"${e.vendorName || 'Direct Expense'}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.baseAmount || e.amount,
      e.taxRate || 0,
      e.taxAmount || 0,
      e.amount,
      `"${e.paymentSource || 'Cash'}"`,
      `"${e.paymentMethod || 'Cash'}"`,
      `"${e.paymentStatus || 'Paid'}"`,
      `"${e.approvalStatus || 'Approved'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const rangeSuffix = expDateFrom || expDateTo ? `${expDateFrom || 'start'}_to_${expDateTo || 'end'}` : new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Hotel_Expense_Ledger_${rangeSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate Due Recurring Expenses
  const handleGenerateDueRecurring = () => {
    const today = new Date().toISOString().split('T')[0];
    const dueDay = new Date().getDate();
    let count = 0;
    const newExpList = [...expenses];

    const updatedSchedules = recurringSchedules.map(sch => {
      if (sch.isActive) {
        const currentMonthYear = today.substring(0, 7);
        if (!sch.lastGeneratedDate || !sch.lastGeneratedDate.startsWith(currentMonthYear)) {
          count++;
          const expNo = `EXP-REC-${Date.now().toString().slice(-4)}`;
          newExpList.unshift({
            id: `exp-${Date.now()}-${Math.random()}`,
            expenseNo: expNo,
            branchName: 'GRAND PAVILION',
            department: sch.department,
            category: sch.category,
            vendorName: sch.vendorName || 'Recurring Vendor',
            date: today,
            description: `[Auto Recurring Schedule] ${sch.title}`,
            baseAmount: sch.estimatedAmount,
            taxRate: 0,
            taxAmount: 0,
            amount: sch.estimatedAmount,
            paymentSource: sch.paymentSource || 'Bank Account',
            paymentMethod: 'Online Transfer',
            paymentStatus: 'Unpaid',
            approvalStatus: 'Pending',
            isRecurring: true,
            notes: sch.notes || 'Auto-generated bill entry from recurring expense manager.'
          });
          return { ...sch, lastGeneratedDate: today };
        }
      }
      return sch;
    });

    if (count > 0) {
      onUpdateExpenses(newExpList);
      setRecurringSchedules(updatedSchedules);
      alert(`Generated ${count} due recurring expense bill(s)! Please review them under the Pending Approvals Desk.`);
    } else {
      alert('All active recurring expense schedules are up-to-date for this month.');
    }
  };

  // Searches & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  // --- Filtered Datasets According to Date Filter (Default: Today Only) ---
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (
        inv.isSuperseded ||
        (inv as any).isCreditNote ||
        inv.invoiceType === 'Credit Note' ||
        inv.invoiceStatus === 'Superseded' ||
        inv.invoiceStatus === 'Cancelled'
      )
        return false;
      return isRecordInDateRange(inv.dateCreated || (inv as any).createdAt || (inv as any).invoiceDate);
    });
  }, [invoices, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  const filteredPosOrders = useMemo(() => {
    return posOrders.filter(po => isRecordInDateRange(po.date || (po as any).createdAt || (po as any).orderDate));
  }, [posOrders, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => isRecordInDateRange(v.date));
  }, [vouchers, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  const filteredPettyCash = useMemo(() => {
    return pettyCash.filter(p => isRecordInDateRange(p.date));
  }, [pettyCash, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  const filteredExpensesList = useMemo(() => {
    return expenses.filter(exp => isRecordInDateRange(exp.date));
  }, [expenses, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  const filteredOwnerPayments = useMemo(() => {
    return ownerPayments.filter(op => isRecordInDateRange(op.date));
  }, [ownerPayments, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter(rb => isRecordInDateRange(rb.date));
  }, [reimbursements, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  const filteredDailyClosings = useMemo(() => {
    return dailyClosings.filter(dc => isRecordInDateRange(dc.date));
  }, [dailyClosings, computedRangeStart, computedRangeEnd, dateFilterPreset]);

  // --- Calculations (Filtered by Date: Default Today) ---
  // Total Income Calculation (Invoices + Paid POS Orders + Receipt Vouchers)
  const totalInvoiceIncome = filteredInvoices.reduce((sum, inv) => sum + (inv.finalAmount || 0), 0);
  const totalPosIncome = filteredPosOrders.filter(o => o.paymentStatus === 'Paid').reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const totalReceiptVouchers = filteredVouchers.filter(v => v.voucherType === 'Receipt Voucher').reduce((sum, v) => sum + (v.amount || 0), 0);
  const totalGrossIncome = totalInvoiceIncome + totalPosIncome + totalReceiptVouchers;

  // Total Expenses Calculation (Expense Ledger + Payment Vouchers + Paid Reimbursements)
  const totalExpenseLedger = filteredExpensesList.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const pendingExpensesList = expenses.filter(e => e.approvalStatus === 'Pending');
  const totalPaymentVouchers = filteredVouchers.filter(v => v.voucherType === 'Payment Voucher').reduce((sum, v) => sum + (v.amount || 0), 0);
  const totalReimbursementsPaid = filteredReimbursements.filter(r => r.status === 'Paid').reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalGrossExpenses = totalExpenseLedger + totalPaymentVouchers + totalReimbursementsPaid;

  const netProfitLoss = totalGrossIncome - totalGrossExpenses;

  // Petty Cash Balance Calculation
  const pettyInflow = filteredPettyCash.filter(p => p.type === 'Inflow').reduce((sum, p) => sum + p.amount, 0);
  const pettyOutflow = filteredPettyCash.filter(p => p.type === 'Outflow').reduce((sum, p) => sum + p.amount, 0);
  const currentPettyCashBalance = pettyCash.filter(p => p.type === 'Inflow').reduce((sum, p) => sum + p.amount, 0) - pettyCash.filter(p => p.type === 'Outflow').reduce((sum, p) => sum + p.amount, 0);

  // Total Cash & Bank Balance
  const totalCashBankBalance = cashBankAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  // Vendor Total Payables
  const totalVendorPayables = vendors.reduce((sum, v) => sum + v.openingBalance, 0);

  // Handlers for Modals
  const handleAddPettyCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (pettyForm.amount <= 0) return;
    const newTx: PettyCashTransaction = {
      id: `PC-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: pettyForm.type,
      category: pettyForm.category,
      amount: Number(pettyForm.amount),
      handler: pettyForm.handler || 'Reception',
      notes: pettyForm.notes,
      approvedBy: currentRole
    };
    onUpdatePettyCash([newTx, ...pettyCash]);
    setShowPettyModal(false);
    setPettyForm({ type: 'Outflow', category: 'Miscellaneous', amount: 0, handler: 'Reception Desk', notes: '' });
  };

  const handleAccountTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromAccId || !transferForm.toAccId || transferForm.amount <= 0) return;
    if (transferForm.fromAccId === transferForm.toAccId) return;

    const updated = cashBankAccounts.map(acc => {
      if (acc.id === transferForm.fromAccId) {
        return { ...acc, currentBalance: acc.currentBalance - Number(transferForm.amount) };
      }
      if (acc.id === transferForm.toAccId) {
        return { ...acc, currentBalance: acc.currentBalance + Number(transferForm.amount) };
      }
      return acc;
    });

    onUpdateCashBankAccounts(updated);
    setShowTransferModal(false);
    setTransferForm({ fromAccId: '', toAccId: '', amount: 0, notes: '' });
  };

  const handleAddVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherForm.partyName || voucherForm.amount <= 0) return;
    const prefix = voucherForm.voucherType === 'Payment Voucher' ? 'PV' : 'RV';
    const newVoucher: FinanceVoucher = {
      id: `vch-${Date.now()}`,
      voucherNumber: `${prefix}-2026-${Math.floor(100 + Math.random() * 900)}`,
      voucherType: voucherForm.voucherType,
      date: new Date().toISOString().split('T')[0],
      partyName: voucherForm.partyName,
      paymentMethod: voucherForm.paymentMethod,
      accountName: voucherForm.accountName,
      amount: Number(voucherForm.amount),
      narration: voucherForm.narration,
      referenceNo: voucherForm.referenceNo || `REF-${Math.floor(10000 + Math.random() * 90000)}`,
      category: voucherForm.category,
      preparedBy: currentRole,
      status: 'Issued'
    };

    onUpdateVouchers([newVoucher, ...vouchers]);

    // Update account balance
    const accountName = voucherForm.accountName;
    const updatedAccs = cashBankAccounts.map(acc => {
      if (acc.accountName === accountName) {
        const delta = voucherForm.voucherType === 'Receipt Voucher' ? Number(voucherForm.amount) : -Number(voucherForm.amount);
        return { ...acc, currentBalance: acc.currentBalance + delta };
      }
      return acc;
    });
    onUpdateCashBankAccounts(updatedAccs);

    setShowVoucherModal(false);
    setVoucherForm({
      voucherType: 'Payment Voucher', partyName: '', paymentMethod: 'Cash', accountName: 'Main Front Desk Cash Drawer', amount: 0, narration: '', referenceNo: '', category: 'General'
    });
  };

  const handleAddVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name) return;
    const newVen: Vendor = {
      id: `ven-${Date.now()}`,
      name: vendorForm.name,
      companyName: vendorForm.companyName || vendorForm.name,
      category: vendorForm.category,
      mobile: vendorForm.mobile,
      email: vendorForm.email,
      gstNumber: vendorForm.gstNumber,
      address: vendorForm.address,
      openingBalance: Number(vendorForm.openingBalance || 0),
      status: 'Active'
    };
    onUpdateVendors([newVen, ...vendors]);
    setShowVendorModal(false);
    setVendorForm({ name: '', companyName: '', category: 'General', mobile: '', email: '', gstNumber: '', address: '', openingBalance: 0 });
  };

  const handleAddDirectorPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (directorForm.amount <= 0) return;
    const newDp: OwnerDirectorPayment = {
      id: `dir-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      directorName: directorForm.directorName,
      type: directorForm.type,
      amount: Number(directorForm.amount),
      paymentMethod: directorForm.paymentMethod,
      bankAccountName: directorForm.bankAccountName,
      notes: directorForm.notes,
      referenceNo: directorForm.referenceNo || `UTR-${Math.floor(1000000 + Math.random() * 9000000)}`
    };
    onUpdateOwnerPayments([newDp, ...ownerPayments]);
    setShowDirectorModal(false);
    setDirectorForm({
      directorName: 'Raghu Sir (Managing Director)', type: 'Capital Injection', amount: 0, paymentMethod: 'Bank Transfer', bankAccountName: 'HDFC Bank Primary Operating Account', notes: '', referenceNo: ''
    });
  };

  const handleAddReimbursement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reimbForm.staffName || reimbForm.amount <= 0) return;
    const newRb: StaffReimbursement = {
      id: `reimb-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      staffName: reimbForm.staffName,
      staffRole: reimbForm.staffRole,
      expenseTitle: reimbForm.expenseTitle,
      category: reimbForm.category,
      amount: Number(reimbForm.amount),
      receiptAttached: true,
      status: 'Pending'
    };
    onUpdateReimbursements([newRb, ...reimbursements]);
    setShowReimbModal(false);
    setReimbForm({ staffName: '', staffRole: 'Staff', expenseTitle: '', category: 'Local Transport', amount: 0 });
  };

  const handleApproveReimbursement = (id: string) => {
    const updated = reimbursements.map(r => r.id === id ? { ...r, status: 'Paid' as const, approvedBy: currentRole, paidDate: new Date().toISOString().split('T')[0] } : r);
    onUpdateReimbursements(updated);
  };

  const handleAddDailyClosing = (e: React.FormEvent) => {
    e.preventDefault();
    const systemCash = 34500; // Expected from Front Desk Cash Drawer
    const actualCash = Number(closingForm.actualCash);
    const disc = actualCash - systemCash;
    const newClosing: DailyClosingRecord = {
      id: `dc-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      closedBy: `${currentRole} User`,
      openingCash: Number(closingForm.openingCash),
      roomCashCollected: 12500,
      posCashCollected: 1800,
      otherCashInflow: 2800,
      pettyCashOutflow: 1120,
      cashHandedOver: actualCash,
      closingCashSystem: systemCash,
      closingCashActual: actualCash,
      discrepancy: disc,
      upiCollected: 18400,
      cardCollected: 15200,
      bankTransferCollected: 18500,
      status: disc === 0 ? 'Balanced' : 'Discrepancy Logged',
      notes: closingForm.notes || 'End of day shift audit completed.'
    };
    onUpdateDailyClosings([newClosing, ...dailyClosings]);
    setShowClosingModal(false);
    setClosingForm({ openingCash: 30000, actualCash: 0, notes: '' });
  };

  const navTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'income', label: 'Income', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown },
    { id: 'petty_cash', label: 'Petty Cash', icon: Coins },
    { id: 'cash_bank', label: 'Cash & Bank', icon: Landmark },
    { id: 'vouchers_payment', label: 'Payment Vouchers', icon: CreditCard },
    { id: 'vouchers_receipt', label: 'Receipt Vouchers', icon: FileCheck },
    { id: 'vendors', label: 'Vendor Management', icon: Building2 },
    { id: 'owner_payments', label: 'Owner Payments', icon: UserCheck },
    { id: 'reimbursements', label: 'Reimbursements', icon: Wallet },
    { id: 'daily_closing', label: 'Daily Closing', icon: Clock }
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-luxury-brown-950 p-6 rounded-2xl border border-luxury-gold-500/30 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-luxury-gold-500/20 rounded-xl border border-luxury-gold-500/40 text-luxury-gold-400">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-white tracking-wide">
                Financial Management & Accounting Engine
              </h1>
              <p className="text-xs text-luxury-gold-300 mt-1">
                Multi-Property Ledger • GST Tax Compliance • Real-time Cash Flow • Daily Shift Reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => { setVoucherForm(v => ({ ...v, voucherType: 'Payment Voucher' })); setShowVoucherModal(true); }}
            className="px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Issue Payment Voucher
          </button>
          <button 
            onClick={() => { setVoucherForm(v => ({ ...v, voucherType: 'Receipt Voucher' })); setShowVoucherModal(true); }}
            className="px-4 py-2.5 bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-gold-300 border border-luxury-gold-500/40 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Issue Receipt Voucher
          </button>
        </div>
      </div>

      {/* Horizontal Sub-Nav Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-luxury-gold-500/20 border-b border-luxury-brown-800">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => changeSubTab(tab.id)}
              className={`
                flex items-center gap-2 px-3.5 py-2 text-xs font-serif font-bold rounded-xl whitespace-nowrap transition-all shrink-0
                ${isActive 
                  ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-md scale-102' 
                  : 'bg-luxury-brown-950/60 text-luxury-brown-200 hover:bg-luxury-brown-800 hover:text-white border border-luxury-brown-800'
                }
              `}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-luxury-brown-950' : 'text-luxury-gold-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* GLOBAL FINANCE DATE & TIMELINE FILTER BAR (Visible on all sub-tabs) */}
      <div className="bg-luxury-brown-950 p-4 rounded-2xl border border-luxury-gold-500/30 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left: Heading + Presets */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-luxury-gold-500/20 text-luxury-gold-400 border border-luxury-gold-500/30">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-serif font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Finance Date Filter</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-luxury-gold-500 text-luxury-brown-950 font-bold">
                  {dateFilterPreset === 'today' ? 'TODAY (DEFAULT)' : dateFilterPreset.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] text-luxury-brown-300">
                Data filtered for selected timeline across all finance sub-tabs
              </p>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-luxury-brown-900/80 p-1 rounded-xl border border-luxury-brown-800">
            {[
              { id: 'today', label: 'Today Only' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'thisWeek', label: 'This Week' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
              { id: 'all', label: 'All Dates' }
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDateFilterPreset(preset.id as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  dateFilterPreset === preset.id
                    ? 'bg-luxury-gold-500 text-luxury-brown-950 font-bold shadow-xs'
                    : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Date Range Inputs + Active Range pill */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-luxury-brown-900/90 px-3 py-1.5 rounded-xl border border-luxury-brown-800 text-xs">
            <span className="text-luxury-gold-400 font-medium">From:</span>
            <input
              type="date"
              value={dateFilterPreset === 'custom' ? customStartDate : computedRangeStart}
              onChange={e => {
                setCustomStartDate(e.target.value);
                setDateFilterPreset('custom');
              }}
              className="bg-luxury-brown-950 border border-luxury-brown-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-luxury-gold-500"
            />
            <span className="text-luxury-gold-400 font-medium">To:</span>
            <input
              type="date"
              value={dateFilterPreset === 'custom' ? customEndDate : computedRangeEnd}
              onChange={e => {
                setCustomEndDate(e.target.value);
                setDateFilterPreset('custom');
              }}
              className="bg-luxury-brown-950 border border-luxury-brown-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:ring-1 focus:ring-luxury-gold-500"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luxury-gold-500/10 border border-luxury-gold-500/20 text-[11px] font-mono text-luxury-gold-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Range: {computedRangeStart} ➔ {computedRangeEnd}</span>
          </div>

          {dateFilterPreset !== 'today' && (
            <button
              type="button"
              onClick={() => {
                setDateFilterPreset('today');
                setRefTodayDate(new Date().toISOString().substring(0, 10));
              }}
              className="px-3 py-1.5 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-luxury-gold-300 hover:text-white text-xs font-semibold rounded-xl border border-luxury-gold-500/30 transition-all flex items-center gap-1 cursor-pointer"
              title="Reset date filter back to today"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Today
            </button>
          )}
        </div>
      </div>

      {/* SUB-VIEW 1: DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Executive KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-medium text-luxury-gold-300 uppercase tracking-wider">Gross Income</span>
                <span className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400"><TrendingUp className="w-4 h-4" /></span>
              </div>
              <p className="text-xl font-bold text-white mt-2 font-mono">₹{totalGrossIncome.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">Invoices + POS + Receipts</p>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-medium text-luxury-gold-300 uppercase tracking-wider">Total Expenses</span>
                <span className="p-1.5 bg-rose-500/20 rounded-lg text-rose-400"><TrendingDown className="w-4 h-4" /></span>
              </div>
              <p className="text-xl font-bold text-white mt-2 font-mono">₹{totalGrossExpenses.toLocaleString()}</p>
              <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">Bills + Pay Vouchers</p>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-medium text-luxury-gold-300 uppercase tracking-wider">Net Margin</span>
                <span className={`p-1.5 rounded-lg ${netProfitLoss >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <p className={`text-xl font-bold mt-2 font-mono ${netProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{netProfitLoss.toLocaleString()}
              </p>
              <p className="text-[10px] text-luxury-brown-300 mt-1">Income - Expenses</p>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-medium text-luxury-gold-300 uppercase tracking-wider">Petty Cash Float</span>
                <span className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400"><Coins className="w-4 h-4" /></span>
              </div>
              <p className="text-xl font-bold text-white mt-2 font-mono">₹{currentPettyCashBalance.toLocaleString()}</p>
              <p className="text-[10px] text-luxury-gold-300 mt-1">Available Till Cash</p>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-medium text-luxury-gold-300 uppercase tracking-wider">Cash & Bank Liquidity</span>
                <span className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400"><Landmark className="w-4 h-4" /></span>
              </div>
              <p className="text-xl font-bold text-white mt-2 font-mono">₹{totalCashBankBalance.toLocaleString()}</p>
              <p className="text-[10px] text-blue-400 mt-1">4 Linked Accounts</p>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-medium text-luxury-gold-300 uppercase tracking-wider">Vendor Payables</span>
                <span className="p-1.5 bg-orange-500/20 rounded-lg text-orange-400"><Building2 className="w-4 h-4" /></span>
              </div>
              <p className="text-xl font-bold text-white mt-2 font-mono">₹{totalVendorPayables.toLocaleString()}</p>
              <p className="text-[10px] text-orange-400 mt-1">Outstanding Balances</p>
            </div>
          </div>

          {/* Revenue & Expenses Breakdown Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Streams */}
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
              <h3 className="text-sm font-serif font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue Stream Channels
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-luxury-brown-900 rounded-xl border border-luxury-brown-800">
                  <div>
                    <p className="text-xs font-bold text-white">Guest Room Tariff Invoices</p>
                    <p className="text-[10px] text-luxury-brown-300">{filteredInvoices.length} Invoices in Selected Range</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-emerald-400">₹{totalInvoiceIncome.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-luxury-brown-900 rounded-xl border border-luxury-brown-800">
                  <div>
                    <p className="text-xs font-bold text-white">POS Restaurant & Bar Food Sales</p>
                    <p className="text-[10px] text-luxury-brown-300">{filteredPosOrders.length} Settled POS Orders in Range</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-emerald-400">₹{totalPosIncome.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-luxury-brown-900 rounded-xl border border-luxury-brown-800">
                  <div>
                    <p className="text-xs font-bold text-white">Direct Receipt Vouchers & Advances</p>
                    <p className="text-[10px] text-luxury-brown-300">Corporate deposits & scrap sales in range</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-emerald-400">₹{totalReceiptVouchers.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Expense Channels */}
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
              <h3 className="text-sm font-serif font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400" /> Outflow & Expense Channels
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-luxury-brown-900 rounded-xl border border-luxury-brown-800">
                  <div>
                    <p className="text-xs font-bold text-white">Property Operational Expense Ledger</p>
                    <p className="text-[10px] text-luxury-brown-300">{filteredExpensesList.length} Expenses logged in Selected Range</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-rose-400">₹{totalExpenseLedger.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-luxury-brown-900 rounded-xl border border-luxury-brown-800">
                  <div>
                    <p className="text-xs font-bold text-white">Payment Vouchers Issued</p>
                    <p className="text-[10px] text-luxury-brown-300">Vendor disbursements & utility bills in range</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-rose-400">₹{totalPaymentVouchers.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-luxury-brown-900 rounded-xl border border-luxury-brown-800">
                  <div>
                    <p className="text-xs font-bold text-white">Staff Expense Reimbursements Paid</p>
                    <p className="text-[10px] text-luxury-brown-300">{filteredReimbursements.length} Claims in Selected Range</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-rose-400">₹{totalReimbursementsPaid.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Financial Vouchers Table */}
          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-serif font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-luxury-gold-400" /> Recent Vouchers & Financial Activity (in range)
              </h3>
              <button onClick={() => changeSubTab('vouchers_payment')} className="text-xs text-luxury-gold-400 hover:underline flex items-center gap-1">
                View All Vouchers <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Voucher #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Party Name</th>
                    <th className="p-3">Payment Account</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {filteredVouchers.slice(0, 5).map(v => (
                    <tr key={v.id} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3 font-mono font-bold text-white">{v.voucherNumber}</td>
                      <td className="p-3">{v.date}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.voucherType === 'Payment Voucher' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {v.voucherType}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-white">{v.partyName}</td>
                      <td className="p-3 text-luxury-brown-300">{v.accountName}</td>
                      <td className={`p-3 text-right font-mono font-bold ${v.voucherType === 'Receipt Voucher' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{Number(v.amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-luxury-brown-400">No financial vouchers found for this date range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: INCOME REGISTER */}
      {activeSubTab === 'income' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Consolidated Income Register</h2>
              <p className="text-xs text-luxury-brown-300">Tracks All Invoices, POS Food Orders, & Direct Receipt Vouchers</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-luxury-brown-300 font-mono">Gross Total: <strong className="text-emerald-400 text-sm">₹{totalGrossIncome.toLocaleString()}</strong></span>
            </div>
          </div>

          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Source Channel</th>
                    <th className="p-3">Ref / Invoice #</th>
                    <th className="p-3">Customer / Guest</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Payment Mode</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {/* GST Invoices */}
                  {filteredInvoices.map(inv => (
                    <tr key={`inv-${inv.id}`} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-bold">GST Invoice</span></td>
                      <td className="p-3 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="p-3 font-medium text-white">{inv.guestName}</td>
                      <td className="p-3">{inv.dateCreated}</td>
                      <td className="p-3 text-luxury-brown-300">{inv.isPaid ? 'Paid' : 'Unpaid'}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(inv.finalAmount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* POS Orders */}
                  {filteredPosOrders.map(po => (
                    <tr key={`po-${po.id}`} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">POS Food Order</span></td>
                      <td className="p-3 font-mono font-bold text-white">{po.orderNumber}</td>
                      <td className="p-3 font-medium text-white">{po.guestName || po.orderType}</td>
                      <td className="p-3">{po.date}</td>
                      <td className="p-3 text-luxury-brown-300">{po.paymentMethod}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(po.grandTotal || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* Receipt Vouchers */}
                  {filteredVouchers.filter(v => v.voucherType === 'Receipt Voucher').map(rv => (
                    <tr key={`rv-${rv.id}`} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">Receipt Voucher</span></td>
                      <td className="p-3 font-mono font-bold text-white">{rv.voucherNumber}</td>
                      <td className="p-3 font-medium text-white">{rv.partyName}</td>
                      <td className="p-3">{rv.date}</td>
                      <td className="p-3 text-luxury-brown-300">{rv.paymentMethod}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(rv.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && filteredPosOrders.length === 0 && filteredVouchers.filter(v => v.voucherType === 'Receipt Voucher').length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-luxury-brown-400">
                        No income records found for the selected date range ({computedRangeStart} to {computedRangeEnd}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: ENTERPRISE HOTEL EXPENSE MANAGEMENT */}
      {(activeSubTab === 'expenses' || activeSubTab === 'add_expense' || activeSubTab === 'categories' || activeSubTab === 'recurring' || activeSubTab === 'approvals') && (
        <div className="space-y-6">
          {/* Top Expense Header Card */}
          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                  <TrendingDown className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-xl font-serif font-bold text-white tracking-wide">Enterprise Hotel Expense Management</h2>
                  <p className="text-xs text-luxury-brown-300">Departmental Overheads, Vendor Invoices, Approvals, GST Tax Credit & Auto-Schedules</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button 
                onClick={handleGenerateDueRecurring}
                className="px-3.5 py-2 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-luxury-gold-300 border border-luxury-gold-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                title="Run automatic schedule scanner for utility bills & SaaS"
              >
                <RefreshCw className="w-3.5 h-3.5 text-luxury-gold-400" /> Auto-Generate Due Bills
              </button>

              <button 
                onClick={() => handleExportExpensesCSV()}
                className="px-3.5 py-2 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white border border-luxury-brown-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-luxury-gold-400" /> Export CSV
              </button>

              <button 
                onClick={() => { resetExpenseForm(); setShowExpenseModal(true); }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> + Log New Expense
              </button>
            </div>
          </div>

          {/* Sub-Navigation Pills Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-luxury-brown-950 p-2 rounded-xl border border-luxury-brown-800 text-xs font-serif">
            <button
              onClick={() => setExpenseInnerTab('all')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                expenseInnerTab === 'all'
                  ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-md'
                  : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> All Expenses Ledger ({expenses.length})
            </button>

            <button
              onClick={() => setExpenseInnerTab('approval')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all relative ${
                expenseInnerTab === 'approval'
                  ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-md'
                  : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Approval Desk
              {pendingExpensesList.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white font-mono font-bold rounded-full animate-pulse">
                  {pendingExpensesList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setExpenseInnerTab('categories')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                expenseInnerTab === 'categories'
                  ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-md'
                  : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Categories & Budgets
            </button>

            <button
              onClick={() => setExpenseInnerTab('recurring')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                expenseInnerTab === 'recurring'
                  ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-md'
                  : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Recurring Schedules
            </button>

            <button
              onClick={() => setExpenseInnerTab('reports')}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                expenseInnerTab === 'reports'
                  ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-md'
                  : 'text-luxury-brown-300 hover:text-white hover:bg-luxury-brown-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Reports & GST Tax ITC
            </button>
          </div>

          {/* KPI SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <span className="text-[10px] font-serif uppercase tracking-wider text-luxury-brown-300 block">Total Gross Expenses</span>
              <p className="text-2xl font-mono font-bold text-rose-400 mt-1">₹{totalExpenseLedger.toLocaleString()}</p>
              <span className="text-[10px] text-luxury-brown-400 mt-1 block">Across all {HOTEL_DEPARTMENTS.length} hotel departments</span>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <span className="text-[10px] font-serif uppercase tracking-wider text-luxury-brown-300 block">GST Input Tax Credit (ITC)</span>
              <p className="text-2xl font-mono font-bold text-amber-400 mt-1">
                ₹{expenses.reduce((sum, e) => sum + (e.taxAmount || 0), 0).toLocaleString()}
              </p>
              <span className="text-[10px] text-amber-300/80 mt-1 block">Claimable input tax credit on vendor bills</span>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <span className="text-[10px] font-serif uppercase tracking-wider text-luxury-brown-300 block">Pending Sign-off Queue</span>
              <p className="text-2xl font-mono font-bold text-rose-300 mt-1">
                ₹{expenses.filter(e => (e.approvalStatus || 'Approved') === 'Pending').reduce((s, e) => s + e.amount, 0).toLocaleString()}
              </p>
              <span className="text-[10px] text-rose-300/70 mt-1 block">{pendingExpensesList.length} expense(s) awaiting manager approval</span>
            </div>

            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20 shadow-md">
              <span className="text-[10px] font-serif uppercase tracking-wider text-luxury-brown-300 block">Credit / Vendor Payables</span>
              <p className="text-2xl font-mono font-bold text-sky-400 mt-1">
                ₹{expenses.filter(e => e.paymentSource === 'Credit/Vendor Payable' && e.paymentStatus !== 'Paid').reduce((s, e) => s + e.amount, 0).toLocaleString()}
              </p>
              <span className="text-[10px] text-sky-300/80 mt-1 block">Unsettled vendor invoices</span>
            </div>
          </div>

          {/* TAB 1: ALL EXPENSES LEDGER TABLE */}
          {expenseInnerTab === 'all' && (
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-4">
              {/* Filter Controls Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                <div className="relative lg:col-span-2">
                  <Search className="w-3.5 h-3.5 text-luxury-brown-400 absolute left-3 top-3" />
                  <input 
                    type="text"
                    value={expSearch}
                    onChange={e => setExpSearch(e.target.value)}
                    placeholder="Search Expense No, Vendor or Description..."
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-xl pl-9 pr-3 py-2 text-white placeholder-luxury-brown-400 focus:outline-hidden focus:border-luxury-gold-500"
                  />
                </div>

                <div>
                  <select 
                    value={expDeptFilter}
                    onChange={e => setExpDeptFilter(e.target.value)}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-xl p-2 text-white focus:outline-hidden"
                  >
                    <option value="All">All Departments</option>
                    {HOTEL_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select 
                    value={expSourceFilter}
                    onChange={e => setExpSourceFilter(e.target.value)}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-xl p-2 text-white focus:outline-hidden"
                  >
                    <option value="All">All Payment Sources</option>
                    <option value="Petty Cash">Petty Cash</option>
                    <option value="Bank Account">Bank Account</option>
                    <option value="UPI">UPI Merchant</option>
                    <option value="Card">Card Terminal</option>
                    <option value="Owner/Director">Owner / Director</option>
                    <option value="Credit/Vendor Payable">Credit / Vendor</option>
                  </select>
                </div>

                <div>
                  <select 
                    value={expApprovalFilter}
                    onChange={e => setExpApprovalFilter(e.target.value)}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-xl p-2 text-white focus:outline-hidden"
                  >
                    <option value="All">All Approval Status</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <input 
                    type="date"
                    value={expDateFrom}
                    onChange={e => setExpDateFrom(e.target.value)}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-xl p-2 text-white text-[11px]"
                  />
                  <span className="text-luxury-brown-400">-</span>
                  <input 
                    type="date"
                    value={expDateTo}
                    onChange={e => setExpDateTo(e.target.value)}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-xl p-2 text-white text-[11px]"
                  />
                </div>
              </div>

              {/* Bulk Action Bar if items selected */}
              {selectedExpIds.length > 0 && (
                <div className="bg-luxury-brown-900 border border-luxury-gold-500/40 p-3 rounded-xl flex items-center justify-between text-xs animate-fade-in">
                  <span className="text-white font-bold">
                    {selectedExpIds.length} expense item(s) selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleBulkApprove}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve Selected
                    </button>
                    <button 
                      onClick={handleBulkReject}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject Selected
                    </button>
                    <button 
                      onClick={() => handleExportExpensesCSV(expenses.filter(e => selectedExpIds.includes(e.id)))}
                      className="px-3 py-1.5 bg-luxury-brown-800 text-luxury-gold-300 hover:text-white font-bold rounded-lg flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Selected CSV
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-luxury-brown-200">
                  <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3 w-8">
                        <input 
                          type="checkbox"
                          checked={selectedExpIds.length > 0 && selectedExpIds.length === expenses.length}
                          onChange={e => {
                            if (e.target.checked) setSelectedExpIds(expenses.map(x => x.id));
                            else setSelectedExpIds([]);
                          }}
                          className="rounded border-luxury-brown-700 bg-luxury-brown-950"
                        />
                      </th>
                      <th className="p-3">Expense No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Department & Category</th>
                      <th className="p-3">Vendor / Payee</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Source & Method</th>
                      <th className="p-3 text-right">Base / Tax</th>
                      <th className="p-3 text-right">Total Amount</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-800">
                    {expenses
                      .filter(e => {
                        const matchesSearch = !expSearch || 
                          (e.expenseNo || e.id).toLowerCase().includes(expSearch.toLowerCase()) ||
                          (e.vendorName || '').toLowerCase().includes(expSearch.toLowerCase()) ||
                          (e.description || '').toLowerCase().includes(expSearch.toLowerCase());
                        const matchesDept = expDeptFilter === 'All' || e.department === expDeptFilter;
                        const matchesSource = expSourceFilter === 'All' || e.paymentSource === expSourceFilter;
                        const matchesApproval = expApprovalFilter === 'All' || (e.approvalStatus || 'Approved') === expApprovalFilter;
                        const matchesFrom = !expDateFrom || e.date >= expDateFrom;
                        const matchesTo = !expDateTo || e.date <= expDateTo;
                        const matchesGlobalDate = isRecordInDateRange(e.date);
                        return matchesSearch && matchesDept && matchesSource && matchesApproval && matchesFrom && matchesTo && matchesGlobalDate;
                      })
                      .map(exp => {
                        const isApproved = (exp.approvalStatus || 'Approved') === 'Approved';
                        const isPending = exp.approvalStatus === 'Pending';
                        const isRejected = exp.approvalStatus === 'Rejected';

                        return (
                          <tr key={exp.id} className="hover:bg-luxury-brown-900/50 transition-colors">
                            <td className="p-3">
                              <input 
                                type="checkbox"
                                checked={selectedExpIds.includes(exp.id)}
                                onChange={e => {
                                  if (e.target.checked) setSelectedExpIds(prev => [...prev, exp.id]);
                                  else setSelectedExpIds(prev => prev.filter(x => x !== exp.id));
                                }}
                                className="rounded border-luxury-brown-700 bg-luxury-brown-950"
                              />
                            </td>
                            <td className="p-3 font-mono font-bold text-white">
                              {exp.expenseNo || exp.id}
                              {exp.isRecurring && (
                                <span className="ml-1 px-1 py-0.2 rounded text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">REC</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-luxury-brown-300">{exp.date}</td>
                            <td className="p-3">
                              <span className="font-semibold text-white block">{exp.department || 'General'}</span>
                              <span className="text-[10px] text-luxury-gold-300/80">{exp.category} {exp.subcategory ? `• ${exp.subcategory}` : ''}</span>
                            </td>
                            <td className="p-3 font-medium text-white">
                              {exp.vendorName || 'Direct Cash Disburse'}
                            </td>
                            <td className="p-3 text-luxury-brown-200 max-w-xs truncate" title={exp.description}>
                              {exp.description}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-luxury-brown-800 text-luxury-gold-300 font-bold block w-fit">
                                {exp.paymentSource || 'Cash'}
                              </span>
                              <span className="text-[10px] text-luxury-brown-400 block mt-0.5">{exp.paymentMethod || 'Cash'}</span>
                            </td>
                            <td className="p-3 text-right font-mono text-luxury-brown-300">
                              ₹{(exp.baseAmount || exp.amount).toLocaleString()}
                              {exp.taxAmount ? <span className="block text-[9px] text-amber-400">+₹{exp.taxAmount} GST ({exp.taxRate}%)</span> : null}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-rose-400 text-sm">
                              ₹{Number(exp.amount || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {isApproved && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                  Approved
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                  Pending
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                  Rejected
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                {exp.billFileName && (
                                  <button 
                                    onClick={() => setViewingAttachment(exp)}
                                    className="p-1 bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-gold-300 rounded"
                                    title="View Bill Attachment"
                                  >
                                    <Paperclip className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => setSelectedExpForPrint(exp)}
                                  className="p-1 bg-luxury-brown-800 hover:bg-luxury-brown-700 text-sky-300 rounded"
                                  title="Print Official Expense Voucher"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => openEditExpense(exp)}
                                  className="p-1 bg-luxury-brown-800 hover:bg-luxury-brown-700 text-amber-300 rounded"
                                  title="Edit Expense"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="p-1 bg-luxury-brown-800 hover:bg-rose-950 text-rose-400 rounded"
                                  title="Delete Expense"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-luxury-brown-400">
                          No expense records found. Click "+ Log New Expense" to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: APPROVAL DESK */}
          {expenseInnerTab === 'approval' && (
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-luxury-brown-800 pb-3">
                <div>
                  <h3 className="text-base font-serif font-bold text-white">Pending Manager Approval Queue</h3>
                  <p className="text-xs text-luxury-brown-300">Authorize operational expense claims and disburse payments</p>
                </div>

                {pendingExpensesList.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setSelectedExpIds(pendingExpensesList.map(p => p.id));
                        handleBulkApprove();
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve All Pending ({pendingExpensesList.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingExpensesList.map(exp => (
                  <div key={exp.id} className="bg-luxury-brown-900 p-4 rounded-xl border border-amber-500/30 space-y-3 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">{exp.expenseNo || exp.id}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{exp.description}</h4>
                        <p className="text-xs text-luxury-brown-300 mt-1">Department: <strong className="text-luxury-gold-300">{exp.department}</strong> • Vendor: <strong>{exp.vendorName || 'Direct'}</strong></p>
                      </div>
                      <span className="text-lg font-mono font-bold text-rose-400 bg-luxury-brown-950 px-3 py-1 rounded-lg border border-luxury-brown-800">
                        ₹{Number(exp.amount || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-luxury-brown-300 bg-luxury-brown-950/60 p-2.5 rounded-lg border border-luxury-brown-800/80 font-mono">
                      <div>Source: <span className="text-white font-semibold">{exp.paymentSource || 'Cash'}</span></div>
                      <div>Method: <span className="text-white font-semibold">{exp.paymentMethod || 'Cash'}</span></div>
                      <div>Base: ₹{(exp.baseAmount || exp.amount).toLocaleString()}</div>
                      <div>GST Tax: ₹{exp.taxAmount || 0} ({exp.taxRate || 0}%)</div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] text-luxury-brown-400">Created by: {exp.createdBy || 'Staff'} on {exp.date}</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedExpIds([exp.id]);
                            handleBulkReject();
                          }}
                          className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-xs rounded-lg border border-rose-800/50 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedExpIds([exp.id]);
                            handleBulkApprove();
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve & Post
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {pendingExpensesList.length === 0 && (
                  <div className="col-span-full p-8 text-center bg-luxury-brown-900/40 rounded-xl border border-luxury-brown-800">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-white font-bold text-sm">All Expenses Approved!</p>
                    <p className="text-xs text-luxury-brown-300 mt-1">There are no pending expense authorization claims waiting for sign-off.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CATEGORIES & BUDGET LIMITS */}
          {expenseInnerTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
                <div>
                  <h3 className="text-base font-serif font-bold text-white">Hotel Department Categories & Monthly Budgets</h3>
                  <p className="text-xs text-luxury-brown-300">Set monthly spend thresholds and subcategories across operational modules</p>
                </div>
                <button 
                  onClick={() => { setCategoryForm({ department: 'Room Operations', categoryName: '', subcategories: ['General'], monthlyBudgetLimit: 30000 }); setShowCategoryModal(true); }}
                  className="px-3.5 py-2 bg-luxury-gold-500 text-luxury-brown-950 font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Category / Budget Rule
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryDefs.map(cat => {
                  const spent = expenses
                    .filter(e => e.department === cat.department || e.category === cat.categoryName)
                    .reduce((sum, e) => sum + e.amount, 0);
                  const limit = cat.monthlyBudgetLimit || 30000;
                  const pct = Math.min(100, Math.round((spent / limit) * 100));
                  const isOverBudget = spent > limit;

                  return (
                    <div key={cat.id} className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-brown-800 shadow space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] uppercase font-mono font-bold text-luxury-gold-300">{cat.department}</span>
                          <h4 className="text-sm font-serif font-bold text-white">{cat.categoryName}</h4>
                        </div>
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isOverBudget ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {pct}% Used
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-mono mb-1">
                          <span className="text-luxury-brown-300">Spent: ₹{spent.toLocaleString()}</span>
                          <span className="text-luxury-gold-300 font-bold">Limit: ₹{limit.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-luxury-brown-900 h-2 rounded-full overflow-hidden border border-luxury-brown-800">
                          <div 
                            className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-luxury-brown-900">
                        <span className="text-[10px] text-luxury-brown-400 font-bold uppercase block mb-1">Subcategories:</span>
                        <div className="flex flex-wrap gap-1">
                          {cat.subcategories.map(s => (
                            <span key={s} className="px-2 py-0.5 bg-luxury-brown-900 text-luxury-brown-200 text-[10px] rounded border border-luxury-brown-800">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: RECURRING EXPENSE SCHEDULES */}
          {expenseInnerTab === 'recurring' && (
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b border-luxury-brown-800 pb-3">
                <div>
                  <h3 className="text-base font-serif font-bold text-white">Automated Recurring Expense Schedules</h3>
                  <p className="text-xs text-luxury-brown-300">Schedule monthly electricity, water, internet, SaaS & rent bills</p>
                </div>
                <button 
                  onClick={() => { setRecurringForm({ title: '', department: 'Utilities', category: 'Utilities', vendorName: '', estimatedAmount: 0, frequency: 'Monthly', dueDayOfMonth: 5, paymentSource: 'Bank Account' }); setShowRecurringModal(true); }}
                  className="px-3.5 py-2 bg-luxury-gold-500 text-luxury-brown-950 font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> + New Recurring Schedule
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-luxury-brown-200">
                  <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Schedule Title</th>
                      <th className="p-3">Department & Category</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3">Frequency & Due Day</th>
                      <th className="p-3">Source</th>
                      <th className="p-3 text-right">Est. Amount</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Last Generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-800">
                    {recurringSchedules.map(sch => (
                      <tr key={sch.id} className="hover:bg-luxury-brown-900/50">
                        <td className="p-3 font-semibold text-white">{sch.title}</td>
                        <td className="p-3">
                          <span className="text-white block">{sch.department}</span>
                          <span className="text-[10px] text-luxury-gold-300/80">{sch.category}</span>
                        </td>
                        <td className="p-3 font-medium text-white">{sch.vendorName || 'General'}</td>
                        <td className="p-3 font-mono text-luxury-brown-300">
                          {sch.frequency} (Every {sch.dueDayOfMonth}th)
                        </td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-luxury-brown-900 text-luxury-gold-300 text-[10px]">{sch.paymentSource}</span></td>
                        <td className="p-3 text-right font-mono font-bold text-rose-400">₹{Number(sch.estimatedAmount || 0).toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sch.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                            {sch.isActive ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-luxury-brown-400">
                          {sch.lastGeneratedDate || 'Not yet'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: EXPENSE REPORTS & GST ITC */}
          {expenseInnerTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-4">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-luxury-gold-400" /> GST Input Tax Credit (ITC) Filing Breakdown
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="bg-luxury-brown-900 p-3.5 rounded-xl border border-luxury-brown-800">
                    <span className="text-[10px] text-luxury-brown-400 uppercase font-bold block">5% GST Input</span>
                    <p className="text-lg font-mono font-bold text-amber-300 mt-1">
                      ₹{expenses.filter(e => e.taxRate === 5).reduce((s, e) => s + (e.taxAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-luxury-brown-900 p-3.5 rounded-xl border border-luxury-brown-800">
                    <span className="text-[10px] text-luxury-brown-400 uppercase font-bold block">12% GST Input</span>
                    <p className="text-lg font-mono font-bold text-amber-300 mt-1">
                      ₹{expenses.filter(e => e.taxRate === 12).reduce((s, e) => s + (e.taxAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-luxury-brown-900 p-3.5 rounded-xl border border-luxury-brown-800">
                    <span className="text-[10px] text-luxury-brown-400 uppercase font-bold block">18% GST Input</span>
                    <p className="text-lg font-mono font-bold text-amber-300 mt-1">
                      ₹{expenses.filter(e => e.taxRate === 18).reduce((s, e) => s + (e.taxAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-luxury-brown-900 p-3.5 rounded-xl border border-luxury-brown-800">
                    <span className="text-[10px] text-luxury-brown-400 uppercase font-bold block">28% GST Input</span>
                    <p className="text-lg font-mono font-bold text-amber-300 mt-1">
                      ₹{expenses.filter(e => e.taxRate === 28).reduce((s, e) => s + (e.taxAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-luxury-brown-900 p-3.5 rounded-xl border border-luxury-gold-500/40">
                    <span className="text-[10px] text-luxury-gold-300 uppercase font-bold block">Total GST Credit</span>
                    <p className="text-xl font-mono font-bold text-emerald-400 mt-1">
                      ₹{expenses.reduce((s, e) => s + (e.taxAmount || 0), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Department Spending Chart Visualizer */}
              <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-4">
                <h3 className="text-base font-serif font-bold text-white">Department-wise Expense Distribution</h3>
                <div className="space-y-3">
                  {HOTEL_DEPARTMENTS.map(dept => {
                    const deptSpent = expenses.filter(e => e.department === dept).reduce((s, e) => s + e.amount, 0);
                    const pct = totalExpenseLedger > 0 ? Math.round((deptSpent / totalExpenseLedger) * 100) : 0;
                    if (deptSpent === 0) return null;

                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-white font-bold">{dept}</span>
                          <span className="font-mono text-rose-400 font-bold">₹{deptSpent.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-luxury-brown-900 h-2.5 rounded-full overflow-hidden border border-luxury-brown-800">
                          <div className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 4: PETTY CASH */}
      {activeSubTab === 'petty_cash' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
              <span className="text-xs font-serif uppercase tracking-wider text-luxury-gold-300">Active Petty Cash Float</span>
              <p className="text-3xl font-mono font-bold text-white mt-2">₹{currentPettyCashBalance.toLocaleString()}</p>
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={() => { setPettyForm({ type: 'Outflow', category: 'Miscellaneous', amount: 0, handler: 'Reception Desk', notes: '' }); setShowPettyModal(true); }}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-500 flex-1 text-center"
                >
                  Log Disbursement
                </button>
                <button 
                  onClick={() => { setPettyForm({ type: 'Inflow', category: 'Bank Top Up', amount: 0, handler: 'Hotel Manager', notes: '' }); setShowPettyModal(true); }}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 flex-1 text-center"
                >
                  Top Up Float
                </button>
              </div>
            </div>

            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
              <span className="text-xs font-serif uppercase tracking-wider text-emerald-400">Total Inflow (Top-Ups)</span>
              <p className="text-2xl font-mono font-bold text-white mt-2">₹{pettyInflow.toLocaleString()}</p>
              <p className="text-[10px] text-luxury-brown-300 mt-2">Funds transferred into cash drawer</p>
            </div>

            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
              <span className="text-xs font-serif uppercase tracking-wider text-rose-400">Total Outflow (Disbursements)</span>
              <p className="text-2xl font-mono font-bold text-white mt-2">₹{pettyOutflow.toLocaleString()}</p>
              <p className="text-[10px] text-luxury-brown-300 mt-2">Snacks, cabs, emergency repairs</p>
            </div>
          </div>

          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
            <h3 className="text-sm font-serif font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" /> Petty Cash Ledger History
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                  <tr>
                    <th className="p-3">TX ID</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Handler</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {filteredPettyCash.map(pc => (
                    <tr key={pc.id} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3 font-mono font-bold text-white">{pc.id}</td>
                      <td className="p-3">{pc.date}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pc.type === 'Inflow' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                          {pc.type}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-white">{pc.category}</td>
                      <td className="p-3 text-luxury-brown-300">{pc.handler}</td>
                      <td className="p-3 text-luxury-brown-300 max-w-xs truncate">{pc.notes}</td>
                      <td className={`p-3 text-right font-mono font-bold ${pc.type === 'Inflow' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pc.type === 'Inflow' ? '+' : '-'}₹{Number(pc.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredPettyCash.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-luxury-brown-400">
                        No petty cash transactions found for the selected date range ({computedRangeStart} to {computedRangeEnd}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: CASH & BANK */}
      {activeSubTab === 'cash_bank' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Cash & Bank Accounts Matrix</h2>
              <p className="text-xs text-luxury-brown-300">Manage Liquid Assets, Card Machine Settlements & UPI Merchant Gateways</p>
            </div>
            <button 
              onClick={() => setShowTransferModal(true)}
              className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Account Balance Transfer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cashBankAccounts.map(acc => (
              <div key={acc.id} className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-3">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 bg-luxury-gold-500/20 text-luxury-gold-300 text-[10px] font-bold rounded uppercase">
                    {acc.accountType}
                  </span>
                  <Landmark className="w-4 h-4 text-luxury-gold-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-serif">{acc.accountName}</h4>
                  {acc.accountNumber && <p className="text-[10px] font-mono text-luxury-brown-300 mt-0.5">Acc: {acc.accountNumber} ({acc.ifsc})</p>}
                </div>
                <div className="pt-2 border-t border-luxury-brown-800">
                  <span className="text-[10px] text-luxury-brown-300">Current Balance</span>
                  <p className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">₹{Number(acc.currentBalance || 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW 6 & 7: VOUCHERS (PAYMENT & RECEIPT) */}
      {(activeSubTab === 'vouchers_payment' || activeSubTab === 'vouchers_receipt') && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">
                {activeSubTab === 'vouchers_payment' ? 'Payment Vouchers (Outflow)' : 'Receipt Vouchers (Inflow)'}
              </h2>
              <p className="text-xs text-luxury-brown-300">Formal Accounting Vouchers with Audit Trail & Digital Signatures</p>
            </div>
            <button 
              onClick={() => {
                setVoucherForm(v => ({ ...v, voucherType: activeSubTab === 'vouchers_payment' ? 'Payment Voucher' : 'Receipt Voucher' }));
                setShowVoucherModal(true);
              }}
              className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Issue New Voucher
            </button>
          </div>

          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Voucher #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Party / Person</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Ref / Bill #</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {filteredVouchers
                    .filter(v => activeSubTab === 'vouchers_payment' ? v.voucherType === 'Payment Voucher' : (activeSubTab === 'vouchers_receipt' ? v.voucherType === 'Receipt Voucher' : true))
                    .map(v => (
                      <tr key={v.id} className="hover:bg-luxury-brown-900/50">
                        <td className="p-3 font-mono font-bold text-white">{v.voucherNumber}</td>
                        <td className="p-3">{v.date}</td>
                        <td className="p-3 font-medium text-white">{v.partyName}</td>
                        <td className="p-3 text-luxury-brown-300">{v.paymentMethod}</td>
                        <td className="p-3 text-luxury-brown-300">{v.accountName}</td>
                        <td className="p-3 font-mono text-luxury-brown-400">{v.referenceNo || '-'}</td>
                        <td className={`p-3 text-right font-mono font-bold ${v.voucherType === 'Receipt Voucher' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{Number(v.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => setSelectedVoucherForPrint(v)}
                            className="p-1.5 bg-luxury-brown-800 hover:bg-luxury-gold-500/20 text-luxury-gold-300 rounded-lg transition-colors"
                            title="View / Print Voucher"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {filteredVouchers.filter(v => activeSubTab === 'vouchers_payment' ? v.voucherType === 'Payment Voucher' : v.voucherType === 'Receipt Voucher').length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-luxury-brown-400">
                        No {activeSubTab === 'vouchers_payment' ? 'payment' : 'receipt'} vouchers found for the selected date range ({computedRangeStart} to {computedRangeEnd}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 8: VENDOR MANAGEMENT */}
      {activeSubTab === 'vendors' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Vendor Management Directory</h2>
              <p className="text-xs text-luxury-brown-300">Supplier Profiles, GST Identifiers & Outstanding Payables</p>
            </div>
            <button 
              onClick={() => setShowVendorModal(true)}
              className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add New Vendor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vendors.map(ven => (
              <div key={ven.id} className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-3">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 bg-luxury-brown-800 text-luxury-gold-300 text-[10px] font-bold rounded">
                    {ven.category}
                  </span>
                  <Building2 className="w-4 h-4 text-luxury-gold-400" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white font-serif">{ven.name}</h4>
                  <p className="text-xs text-luxury-brown-300">{ven.companyName}</p>
                </div>
                <div className="text-xs text-luxury-brown-300 space-y-1 font-sans">
                  {ven.gstNumber && <p><strong className="text-luxury-gold-300">GST:</strong> {ven.gstNumber}</p>}
                  <p><strong className="text-luxury-gold-300">Mobile:</strong> {ven.mobile}</p>
                </div>
                <div className="pt-3 border-t border-luxury-brown-800 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-luxury-brown-400">Balance Payable</span>
                    <p className="text-sm font-mono font-bold text-rose-400">₹{Number(ven.openingBalance || 0).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setVoucherForm(v => ({
                        ...v,
                        voucherType: 'Payment Voucher',
                        partyName: ven.name,
                        amount: ven.openingBalance,
                        category: 'Vendor Payment'
                      }));
                      setShowVoucherModal(true);
                    }}
                    className="px-3 py-1 bg-luxury-brown-800 hover:bg-luxury-gold-500 hover:text-luxury-brown-950 text-luxury-gold-300 text-xs font-bold rounded transition-colors"
                  >
                    Pay Vendor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-VIEW 9: OWNER/DIRECTOR PAYMENTS */}
      {activeSubTab === 'owner_payments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Owner & Director Transactions</h2>
              <p className="text-xs text-luxury-brown-300">Capital Injections, Director Salaries, Drawings & Equity Transfers</p>
            </div>
            <button 
              onClick={() => setShowDirectorModal(true)}
              className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Record Director Transaction
            </button>
          </div>

          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Director Name</th>
                    <th className="p-3">Transaction Type</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Bank Account</th>
                    <th className="p-3">Ref UTR</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {filteredOwnerPayments.map(op => (
                    <tr key={op.id} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3">{op.date}</td>
                      <td className="p-3 font-bold text-white">{op.directorName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${op.type === 'Capital Injection' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {op.type}
                        </span>
                      </td>
                      <td className="p-3 text-luxury-brown-300">{op.paymentMethod}</td>
                      <td className="p-3 text-luxury-brown-300">{op.bankAccountName}</td>
                      <td className="p-3 font-mono text-luxury-brown-400">{op.referenceNo || '-'}</td>
                      <td className={`p-3 text-right font-mono font-bold ${op.type === 'Capital Injection' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        ₹{Number(op.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredOwnerPayments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-luxury-brown-400">
                        No owner/director transactions logged for the selected date range ({computedRangeStart} to {computedRangeEnd}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 10: REIMBURSEMENTS */}
      {activeSubTab === 'reimbursements' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Staff Expense Reimbursements</h2>
              <p className="text-xs text-luxury-brown-300">Review & Approve Out-of-pocket Staff Expense Claims</p>
            </div>
            <button 
              onClick={() => setShowReimbModal(true)}
              className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Submit Claim
            </button>
          </div>

          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Claim Date</th>
                    <th className="p-3">Staff Name</th>
                    <th className="p-3">Expense Title</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {filteredReimbursements.map(rb => (
                    <tr key={rb.id} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3">{rb.date}</td>
                      <td className="p-3 font-bold text-white">{rb.staffName} <span className="text-[10px] text-luxury-brown-400 font-normal">({rb.staffRole})</span></td>
                      <td className="p-3 text-white">{rb.expenseTitle}</td>
                      <td className="p-3 text-luxury-brown-300">{rb.category}</td>
                      <td className="p-3 text-right font-mono font-bold text-white">₹{Number(rb.amount || 0).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rb.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {rb.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {rb.status === 'Pending' && (
                          <button 
                            onClick={() => handleApproveReimbursement(rb.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded transition-colors"
                          >
                            Approve & Pay
                          </button>
                        )}
                        {rb.status === 'Paid' && <span className="text-[10px] text-emerald-400">Paid on {rb.paidDate}</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredReimbursements.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-luxury-brown-400">
                        No staff reimbursements filed for the selected date range ({computedRangeStart} to {computedRangeEnd}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 11: DAILY CLOSING */}
      {activeSubTab === 'daily_closing' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Daily EOD Closing & Audit Signoff</h2>
              <p className="text-xs text-luxury-brown-300">Reconcile Cash Drawers, Digital UPI Payments & Shift Handovers</p>
            </div>
            <button 
              onClick={() => setShowClosingModal(true)}
              className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2"
            >
              <Clock className="w-4 h-4" /> Submit EOD Closing
            </button>
          </div>

          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg">
            <h3 className="text-sm font-serif font-bold text-white uppercase tracking-wider mb-4">Daily Closing History Records</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Closed By</th>
                    <th className="p-3 text-right">System Expected Cash</th>
                    <th className="p-3 text-right">Physical Counted Cash</th>
                    <th className="p-3 text-right">Discrepancy</th>
                    <th className="p-3 text-right">UPI Total</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {filteredDailyClosings.map(dc => (
                    <tr key={dc.id} className="hover:bg-luxury-brown-900/50">
                      <td className="p-3 font-mono font-bold text-white">{dc.date}</td>
                      <td className="p-3">{dc.closedBy}</td>
                      <td className="p-3 text-right font-mono">₹{Number(dc.closingCashSystem || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(dc.closingCashActual || 0).toLocaleString()}</td>
                      <td className={`p-3 text-right font-mono font-bold ${dc.discrepancy === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{Number(dc.discrepancy || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono">₹{Number(dc.upiCollected || 0).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dc.status === 'Balanced' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                          {dc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredDailyClosings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-luxury-brown-400">
                        No shift closings logged for the selected date range ({computedRangeStart} to {computedRangeEnd}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 11: P&L & 5% GST SUMMARY */}
      {activeSubTab === 'pl_reports' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Profit & Loss Statement & 5% GST Reconciliation</h2>
              <p className="text-xs text-luxury-brown-300">Audited P&L financials and GST compliance for {computedRangeStart} to {computedRangeEnd}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                netProfitLoss >= 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                Net: {netProfitLoss >= 0 ? '+' : ''}₹{netProfitLoss.toLocaleString()}
              </span>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
              <span className="text-[11px] font-mono text-luxury-brown-400 uppercase block font-bold">Total Gross Revenue</span>
              <span className="text-xl font-mono font-bold text-emerald-400 block mt-1">₹{totalGrossIncome.toLocaleString()}</span>
              <span className="text-[10px] text-luxury-brown-400 mt-1 block">Invoices + POS + Receipts</span>
            </div>
            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
              <span className="text-[11px] font-mono text-luxury-brown-400 uppercase block font-bold">Total Outflows & Expenses</span>
              <span className="text-xl font-mono font-bold text-rose-400 block mt-1">₹{totalGrossExpenses.toLocaleString()}</span>
              <span className="text-[10px] text-luxury-brown-400 mt-1 block">Ledger + Vouchers + Reimbursements</span>
            </div>
            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
              <span className="text-[11px] font-mono text-luxury-brown-400 uppercase block font-bold">Net Operating Profit</span>
              <span className={`text-xl font-mono font-bold block mt-1 ${netProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netProfitLoss >= 0 ? '+' : ''}₹{netProfitLoss.toLocaleString()}
              </span>
              <span className="text-[10px] text-luxury-brown-400 mt-1 block">Margin: {totalGrossIncome > 0 ? ((netProfitLoss / totalGrossIncome) * 100).toFixed(1) : '0'}%</span>
            </div>
            <div className="bg-luxury-brown-950 p-4 rounded-xl border border-luxury-gold-500/20">
              <span className="text-[11px] font-mono text-luxury-gold-300 uppercase block font-bold">5% GST Output Tax</span>
              <span className="text-xl font-mono font-bold text-luxury-gold-300 block mt-1">
                ₹{filteredInvoices.reduce((s, inv) => s + (inv.taxAmount || 0), 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-luxury-brown-400 mt-1 block">CGST 2.5% + SGST 2.5%</span>
            </div>
          </div>

          {/* P&L Statement Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Inflows */}
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-emerald-500/20 shadow-lg space-y-3">
              <div className="flex justify-between items-center border-b border-luxury-brown-800 pb-2">
                <h4 className="text-sm font-serif font-bold text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Operational Income
                </h4>
                <span className="text-xs font-mono font-bold text-emerald-300">₹{totalGrossIncome.toLocaleString()}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-luxury-brown-900">
                  <span className="text-luxury-brown-300">Room Accommodation Invoices ({filteredInvoices.length})</span>
                  <span className="font-mono font-bold text-white">₹{totalInvoiceIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-luxury-brown-900">
                  <span className="text-luxury-brown-300">Food & Beverage (POS Orders) ({filteredPosOrders.length})</span>
                  <span className="font-mono font-bold text-white">₹{totalPosIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-luxury-brown-900">
                  <span className="text-luxury-brown-300">Direct Receipt Vouchers & Advances</span>
                  <span className="font-mono font-bold text-white">₹{totalReceiptVouchers.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Expense Outflows */}
            <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-rose-500/20 shadow-lg space-y-3">
              <div className="flex justify-between items-center border-b border-luxury-brown-800 pb-2">
                <h4 className="text-sm font-serif font-bold text-rose-400 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Operational Expenses
                </h4>
                <span className="text-xs font-mono font-bold text-rose-300">₹{totalGrossExpenses.toLocaleString()}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-luxury-brown-900">
                  <span className="text-luxury-brown-300">Expense Ledger Postings ({filteredExpensesList.length})</span>
                  <span className="font-mono font-bold text-white">₹{totalExpenseLedger.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-luxury-brown-900">
                  <span className="text-luxury-brown-300">Payment Vouchers Issued</span>
                  <span className="font-mono font-bold text-white">₹{totalPaymentVouchers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-luxury-brown-900">
                  <span className="text-luxury-brown-300">Staff Expense Reimbursements Paid</span>
                  <span className="font-mono font-bold text-white">₹{totalReimbursementsPaid.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5% GST Breakdown Table */}
          <div className="bg-luxury-brown-950 p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-4">
            <div className="flex justify-between items-center border-b border-luxury-brown-800 pb-3">
              <div>
                <h4 className="text-sm font-serif font-bold text-luxury-gold-300 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-luxury-gold-400" /> 5% GST Compliance Journal
                </h4>
                <p className="text-[11px] text-luxury-brown-400">Detailed tax liability on hotel room invoices for selected dates</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-luxury-brown-200">
                <thead className="bg-luxury-brown-900 text-luxury-gold-300 font-serif uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Guest Name</th>
                    <th className="p-3 text-right">Taxable Base</th>
                    <th className="p-3 text-right">CGST (2.5%)</th>
                    <th className="p-3 text-right">SGST (2.5%)</th>
                    <th className="p-3 text-right">Total GST</th>
                    <th className="p-3 text-right">Gross Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-800">
                  {filteredInvoices.map(inv => {
                    const gst = inv.taxAmount || 0;
                    const cgst = parseFloat((gst / 2).toFixed(2));
                    const sgst = parseFloat((gst - cgst).toFixed(2));
                    const base = (inv.finalAmount || 0) - gst;
                    return (
                      <tr key={`gst-${inv.id}`} className="hover:bg-luxury-brown-900/50">
                        <td className="p-3 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                        <td className="p-3 font-mono text-luxury-brown-300">{inv.dateCreated}</td>
                        <td className="p-3 font-medium text-white">{inv.guestName}</td>
                        <td className="p-3 text-right font-mono text-luxury-brown-200">₹{base.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-luxury-gold-400">₹{cgst.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-luxury-gold-400">₹{sgst.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-bold text-luxury-gold-300">₹{gst.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{(inv.finalAmount || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-luxury-brown-400">
                        No taxable invoices recorded in selected date range ({computedRangeStart} to {computedRangeEnd}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {/* 1. PETTY CASH MODAL */}
      {showPettyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Log Petty Cash Transaction</h3>
            <form onSubmit={handleAddPettyCash} className="space-y-3 text-xs">
              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Transaction Type</label>
                <select 
                  value={pettyForm.type} 
                  onChange={e => setPettyForm(p => ({ ...p, type: e.target.value as 'Inflow' | 'Outflow' }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                >
                  <option value="Outflow">Outflow (Disbursal / Expense)</option>
                  <option value="Inflow">Inflow (Top Up / Cash Deposit)</option>
                </select>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Amount (₹)</label>
                <input 
                  type="number" required 
                  value={pettyForm.amount || ''}
                  onChange={e => setPettyForm(p => ({ ...p, amount: Number(e.target.value) }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Category</label>
                <input 
                  type="text" required 
                  value={pettyForm.category}
                  onChange={e => setPettyForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  placeholder="e.g. Tea & Snacks, Cabs, Hardware"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Handler / Person</label>
                <input 
                  type="text" required 
                  value={pettyForm.handler}
                  onChange={e => setPettyForm(p => ({ ...p, handler: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Notes / Description</label>
                <textarea 
                  value={pettyForm.notes}
                  onChange={e => setPettyForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPettyModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 rounded-lg font-bold">Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Account Balance Transfer</h3>
            <form onSubmit={handleAccountTransfer} className="space-y-3 text-xs">
              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">From Account</label>
                <select 
                  value={transferForm.fromAccId} 
                  onChange={e => setTransferForm(t => ({ ...t, fromAccId: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  required
                >
                  <option value="">Select Origin Account...</option>
                  {cashBankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.accountName} (Bal: ₹{Number(acc.currentBalance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">To Account</label>
                <select 
                  value={transferForm.toAccId} 
                  onChange={e => setTransferForm(t => ({ ...t, toAccId: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  required
                >
                  <option value="">Select Destination Account...</option>
                  {cashBankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.accountName} (Bal: ₹{Number(acc.currentBalance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Transfer Amount (₹)</label>
                <input 
                  type="number" required 
                  value={transferForm.amount || ''}
                  onChange={e => setTransferForm(t => ({ ...t, amount: Number(e.target.value) }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 rounded-lg font-bold">Transfer Funds</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VOUCHER MODAL */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Issue {voucherForm.voucherType}</h3>
            <form onSubmit={handleAddVoucher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Voucher Type</label>
                  <select 
                    value={voucherForm.voucherType} 
                    onChange={e => setVoucherForm(v => ({ ...v, voucherType: e.target.value as 'Payment Voucher' | 'Receipt Voucher' }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="Payment Voucher">Payment Voucher (Outflow)</option>
                    <option value="Receipt Voucher">Receipt Voucher (Inflow)</option>
                  </select>
                </div>
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Amount (₹)</label>
                  <input 
                    type="number" required 
                    value={voucherForm.amount || ''}
                    onChange={e => setVoucherForm(v => ({ ...v, amount: Number(e.target.value) }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Party / Recipient / Payer Name</label>
                <input 
                  type="text" required 
                  value={voucherForm.partyName}
                  onChange={e => setVoucherForm(v => ({ ...v, partyName: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  placeholder="e.g. Fresh Farm Dairy, Electricity Board, Corporate Client"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Payment Method</label>
                  <select 
                    value={voucherForm.paymentMethod} 
                    onChange={e => setVoucherForm(v => ({ ...v, paymentMethod: e.target.value as 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI Digital Payment</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Settlement Account</label>
                  <select 
                    value={voucherForm.accountName} 
                    onChange={e => setVoucherForm(v => ({ ...v, accountName: e.target.value }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  >
                    {cashBankAccounts.map(acc => (
                      <option key={acc.id} value={acc.accountName}>{acc.accountName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Narration / Reason</label>
                <textarea 
                  value={voucherForm.narration}
                  onChange={e => setVoucherForm(v => ({ ...v, narration: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  rows={2}
                  placeholder="e.g. Payment for weekly milk delivery bill #8891"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowVoucherModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 rounded-lg font-bold">Issue Voucher</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. VENDOR MODAL */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Add New Vendor Profile</h3>
            <form onSubmit={handleAddVendor} className="space-y-3 text-xs">
              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Vendor / Person Name</label>
                <input 
                  type="text" required 
                  value={vendorForm.name}
                  onChange={e => setVendorForm(v => ({ ...v, name: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Mobile</label>
                  <input 
                    type="text" 
                    value={vendorForm.mobile}
                    onChange={e => setVendorForm(v => ({ ...v, mobile: e.target.value }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">GST Number</label>
                  <input 
                    type="text" 
                    value={vendorForm.gstNumber}
                    onChange={e => setVendorForm(v => ({ ...v, gstNumber: e.target.value }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowVendorModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 rounded-lg font-bold">Save Vendor Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DIRECTOR TRANSACTION MODAL */}
      {showDirectorModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Record Director Transaction</h3>
            <form onSubmit={handleAddDirectorPayment} className="space-y-3 text-xs">
              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Director Name</label>
                <input 
                  type="text" required 
                  value={directorForm.directorName}
                  onChange={e => setDirectorForm(d => ({ ...d, directorName: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Type of Transaction</label>
                <select 
                  value={directorForm.type} 
                  onChange={e => setDirectorForm(d => ({ ...d, type: e.target.value as any }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                >
                  <option value="Capital Injection">Capital Injection (Capital Inflow)</option>
                  <option value="Director Salary">Director Salary (Monthly Remuneration)</option>
                  <option value="Profit Drawing">Profit Drawing / Dividend</option>
                  <option value="Loan Repayment">Loan Repayment</option>
                </select>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Amount (₹)</label>
                <input 
                  type="number" required 
                  value={directorForm.amount || ''}
                  onChange={e => setDirectorForm(d => ({ ...d, amount: Number(e.target.value) }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDirectorModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 rounded-lg font-bold">Record Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. REIMBURSEMENT MODAL */}
      {showReimbModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Submit Staff Reimbursement Claim</h3>
            <form onSubmit={handleAddReimbursement} className="space-y-3 text-xs">
              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Staff Member Name</label>
                <input 
                  type="text" required 
                  value={reimbForm.staffName}
                  onChange={e => setReimbForm(r => ({ ...r, staffName: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Expense Description / Title</label>
                <input 
                  type="text" required 
                  value={reimbForm.expenseTitle}
                  onChange={e => setReimbForm(r => ({ ...r, expenseTitle: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  placeholder="e.g. Taxi fare for guest airport drop"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Claim Amount (₹)</label>
                <input 
                  type="number" required 
                  value={reimbForm.amount || ''}
                  onChange={e => setReimbForm(r => ({ ...r, amount: Number(e.target.value) }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowReimbModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 rounded-lg font-bold">Submit Claim</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. DAILY CLOSING MODAL */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-serif font-bold text-white">Daily Shift EOD Reconciliation</h3>
            <form onSubmit={handleAddDailyClosing} className="space-y-3 text-xs">
              <div className="p-3 bg-luxury-brown-900 rounded-lg border border-luxury-brown-800 text-luxury-gold-300 font-mono">
                System Expected Till Cash: <strong>₹34,500</strong>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Actual Physical Cash Counted (₹)</label>
                <input 
                  type="number" required 
                  value={closingForm.actualCash || ''}
                  onChange={e => setClosingForm(c => ({ ...c, actualCash: Number(e.target.value) }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono text-base font-bold"
                  placeholder="34500"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Closing Audit Remarks</label>
                <textarea 
                  value={closingForm.notes}
                  onChange={e => setClosingForm(c => ({ ...c, notes: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowClosingModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 rounded-lg font-bold">Submit EOD Signoff</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE VOUCHER MODAL */}
      {selectedVoucherForPrint && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white text-gray-900 rounded-2xl p-8 max-w-xl w-full space-y-6 shadow-2xl relative border-4 border-amber-600">
            <button 
              onClick={() => setSelectedVoucherForPrint(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-black font-bold text-lg"
            >
              ✕
            </button>

            <div className="border-b-2 border-gray-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold font-serif uppercase tracking-wider text-amber-900">GRAND PAVILION HOTEL & SUITES</h2>
                <p className="text-xs text-gray-600">123 Luxury Avenue, Sector 5, Mumbai • GSTIN: 27AAAAA0000A1Z5</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 font-bold text-xs uppercase tracking-widest rounded border border-amber-300">
                  {selectedVoucherForPrint.voucherType}
                </span>
                <p className="text-xs font-mono font-bold mt-1 text-gray-800">{selectedVoucherForPrint.voucherNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Date</span>
                <p className="font-semibold text-gray-900">{selectedVoucherForPrint.date}</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Payment Account</span>
                <p className="font-semibold text-gray-900">{selectedVoucherForPrint.accountName}</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Party Name / Recipient</span>
                <p className="font-semibold text-gray-900">{selectedVoucherForPrint.partyName}</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Payment Method & Ref</span>
                <p className="font-semibold text-gray-900">{selectedVoucherForPrint.paymentMethod} ({selectedVoucherForPrint.referenceNo})</p>
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <span className="text-gray-500 font-bold uppercase text-[10px]">Narration / Reason</span>
              <p className="text-sm italic font-serif text-gray-800 mt-1">{selectedVoucherForPrint.narration || 'Official accounting transaction settlement.'}</p>
            </div>

            <div className="flex justify-between items-center bg-gray-100 p-4 rounded-xl border border-gray-300">
              <span className="font-bold text-gray-700 uppercase tracking-wider text-xs">Total Voucher Amount</span>
              <span className="text-2xl font-mono font-bold text-amber-900">₹{Number(selectedVoucherForPrint.amount || 0).toLocaleString()}</span>
            </div>

            <div className="pt-8 flex justify-between items-end border-t border-gray-300 text-[10px] text-gray-500 font-mono">
              <div>
                <p>Prepared By: <strong>{selectedVoucherForPrint.preparedBy || 'Accounts Dept'}</strong></p>
                <p>Status: Verified & Posted</p>
              </div>
              <div className="text-center border-t border-gray-400 pt-1 w-32">
                Authorized Signature
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button 
                onClick={() => window.print()} 
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" /> Print Accounting Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EXPENSE MODULE MODALS --- */}
      {/* 1. ADD / EDIT EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-2xl w-full my-8 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-luxury-brown-800 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-white">
                  {editingExpense ? 'Edit Hotel Expense Record' : 'Log New Hotel Expense'}
                </h3>
                <p className="text-xs text-luxury-brown-300">Departmental expenditure, vendor bill & tax claim entry</p>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="text-luxury-brown-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Expense Voucher No</label>
                  <input 
                    type="text" 
                    value={expenseForm.expenseNo}
                    onChange={e => setExpenseForm(f => ({ ...f, expenseNo: e.target.value }))}
                    placeholder="Auto-generated (e.g. EXP-2026-8812)"
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Expense Date *</label>
                  <input 
                    type="date" required
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Department *</label>
                  <select 
                    value={expenseForm.department}
                    onChange={e => setExpenseForm(f => ({ ...f, department: e.target.value, category: e.target.value }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  >
                    {HOTEL_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Category / Subcategory</label>
                  <input 
                    type="text"
                    value={expenseForm.subcategory}
                    onChange={e => setExpenseForm(f => ({ ...f, subcategory: e.target.value }))}
                    placeholder="e.g. Electricity Bill, Linen Wash, Kitchen Spices"
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Vendor / Payee Name</label>
                  <input 
                    type="text"
                    value={expenseForm.vendorName}
                    onChange={e => setExpenseForm(f => ({ ...f, vendorName: e.target.value }))}
                    placeholder="e.g. Adani Electricity Ltd / Metro Cash & Carry"
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Payment Source *</label>
                  <select 
                    value={expenseForm.paymentSource}
                    onChange={e => setExpenseForm(f => ({ ...f, paymentSource: e.target.value as any }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="Petty Cash">Petty Cash Float</option>
                    <option value="Bank Account">HDFC Corporate Bank Account</option>
                    <option value="UPI">UPI Merchant Business QR</option>
                    <option value="Card">HDFC Corporate Credit Card</option>
                    <option value="Owner/Director">Owner / Director Capital Account</option>
                    <option value="Credit/Vendor Payable">Credit / Vendor Accounts Payable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Expense Description / Purpose *</label>
                <input 
                  type="text" required
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Monthly Commercial Power Bill for Main Hotel Wing"
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              {/* Financial Amount & GST Calculation Box */}
              <div className="bg-luxury-brown-900/80 p-3.5 rounded-xl border border-luxury-brown-800 space-y-3">
                <span className="text-[10px] text-luxury-gold-300 font-bold uppercase tracking-wider block">Financial & GST Tax Computation</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-luxury-brown-300 block mb-1 font-bold">Base Amount (₹)</label>
                    <input 
                      type="number" required min="0" step="0.01"
                      value={expenseForm.baseAmount || ''}
                      onChange={e => {
                        const base = Number(e.target.value);
                        const taxAmt = Math.round((base * (expenseForm.taxRate / 100)) * 100) / 100;
                        setExpenseForm(f => ({
                          ...f,
                          baseAmount: base,
                          taxAmount: taxAmt,
                          amount: base + taxAmt
                        }));
                      }}
                      className="w-full bg-luxury-brown-950 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-luxury-brown-300 block mb-1 font-bold">GST Rate (%)</label>
                    <select 
                      value={expenseForm.taxRate}
                      onChange={e => {
                        const rate = Number(e.target.value);
                        const base = expenseForm.baseAmount || 0;
                        const taxAmt = Math.round((base * (rate / 100)) * 100) / 100;
                        setExpenseForm(f => ({
                          ...f,
                          taxRate: rate,
                          taxAmount: taxAmt,
                          amount: base + taxAmt
                        }));
                      }}
                      className="w-full bg-luxury-brown-950 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono"
                    >
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5% GST Input</option>
                      <option value="12">12% GST Input</option>
                      <option value="18">18% GST Input</option>
                      <option value="28">28% GST Input</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-rose-400 block mb-1 font-bold">Total Gross Payable (₹)</label>
                    <input 
                      type="number" required min="0" step="0.01"
                      value={expenseForm.amount || ''}
                      onChange={e => setExpenseForm(f => ({ ...f, amount: Number(e.target.value) }))}
                      className="w-full bg-luxury-brown-950 border border-rose-500/40 rounded-lg p-2.5 text-rose-300 font-mono font-bold text-base"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Approval Status</label>
                  <select 
                    value={expenseForm.approvalStatus}
                    onChange={e => setExpenseForm(f => ({ ...f, approvalStatus: e.target.value as any }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="Approved">Approved (Post to General Ledger)</option>
                    <option value="Pending">Pending Manager Approval</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Bill / Invoice Reference Attachment</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={expenseForm.billFileName}
                      onChange={e => setExpenseForm(f => ({ ...f, billFileName: e.target.value }))}
                      placeholder="e.g. Electric_Bill_July2026.pdf"
                      className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                    />
                    <label className="px-3 py-2.5 bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-gold-300 rounded-lg cursor-pointer font-bold flex items-center gap-1 shrink-0">
                      <Paperclip className="w-4 h-4" /> Attach
                      <input 
                        type="file" accept="image/*,.pdf" 
                        className="hidden" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setExpenseForm(f => ({ ...f, billFileName: file.name, billFileData: URL.createObjectURL(file) }));
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Audit Remarks / Notes</label>
                <textarea 
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                  rows={2}
                  placeholder="Additional accounting notes or approval remarks..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-luxury-brown-800">
                <button 
                  type="button" 
                  onClick={() => setShowExpenseModal(false)} 
                  className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold hover:bg-luxury-brown-700"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-lg flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Save Expense Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ATTACHMENT LIGHTBOX PREVIEW MODAL */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-xl w-full space-y-4 relative shadow-2xl">
            <button 
              onClick={() => setViewingAttachment(null)}
              className="absolute top-4 right-4 text-luxury-brown-400 hover:text-white font-bold text-lg"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="border-b border-luxury-brown-800 pb-2">
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-luxury-gold-400" /> Expense Bill Attachment Preview
              </h3>
              <p className="text-xs text-luxury-brown-300">{viewingAttachment.expenseNo || viewingAttachment.id} • {viewingAttachment.billFileName}</p>
            </div>

            <div className="bg-luxury-brown-900 p-4 rounded-xl text-center min-h-[220px] flex flex-col items-center justify-center border border-luxury-brown-800">
              {viewingAttachment.billFileData ? (
                <img 
                  src={viewingAttachment.billFileData} 
                  alt="Bill Document Preview" 
                  className="max-h-80 object-contain rounded border border-luxury-brown-700" 
                />
              ) : (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 text-luxury-gold-400 mx-auto opacity-80" />
                  <p className="text-white font-bold text-sm">{viewingAttachment.billFileName || 'Vendor_Invoice.pdf'}</p>
                  <p className="text-xs text-luxury-brown-300">Verified Uploaded Vendor Bill Document</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-luxury-brown-300">
              <span>Vendor: <strong className="text-white">{viewingAttachment.vendorName || 'N/A'}</strong></span>
              <span>Amount: <strong className="text-rose-400 font-bold text-sm">₹{Number(viewingAttachment.amount || 0).toLocaleString()}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* 3. PRINTABLE OFFICIAL EXPENSE VOUCHER */}
      {selectedExpForPrint && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white text-gray-900 rounded-2xl p-8 max-w-xl w-full space-y-6 shadow-2xl relative border-4 border-rose-600">
            <button 
              onClick={() => setSelectedExpForPrint(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-black font-bold text-lg"
            >
              ✕
            </button>

            <div className="border-b-2 border-gray-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold font-serif uppercase tracking-wider text-rose-900">GRAND PAVILION HOTEL & SUITES</h2>
                <p className="text-xs text-gray-600">123 Luxury Avenue, Sector 5, Mumbai • GSTIN: 27AAAAA0000A1Z5</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-rose-100 text-rose-900 font-bold text-xs uppercase tracking-widest rounded border border-rose-300">
                  OFFICIAL EXPENSE VOUCHER
                </span>
                <p className="text-xs font-mono font-bold mt-1 text-gray-800">{selectedExpForPrint.expenseNo || selectedExpForPrint.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Expense Date</span>
                <p className="font-semibold text-gray-900">{selectedExpForPrint.date}</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Department & Category</span>
                <p className="font-semibold text-gray-900">{selectedExpForPrint.department} ({selectedExpForPrint.category})</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Vendor / Payee</span>
                <p className="font-semibold text-gray-900">{selectedExpForPrint.vendorName || 'Direct Cash Disburse'}</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold uppercase text-[10px]">Payment Source & Method</span>
                <p className="font-semibold text-gray-900">{selectedExpForPrint.paymentSource} ({selectedExpForPrint.paymentMethod})</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
              <span className="text-gray-500 font-bold uppercase text-[10px]">Description & Purpose</span>
              <p className="text-sm italic font-serif text-gray-800">{selectedExpForPrint.description}</p>
            </div>

            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 space-y-2 font-mono">
              <div className="flex justify-between text-xs text-gray-700">
                <span>Base Amount:</span>
                <span>₹{(selectedExpForPrint.baseAmount || selectedExpForPrint.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-800">
                <span>GST Input Tax ({selectedExpForPrint.taxRate || 0}%):</span>
                <span>+₹{selectedExpForPrint.taxAmount || 0}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-rose-900 pt-2 border-t border-rose-300">
                <span>Total Disbursed Amount:</span>
                <span>₹{Number(selectedExpForPrint.amount || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-8 flex justify-between items-end border-t border-gray-300 text-[10px] text-gray-500 font-mono">
              <div>
                <p>Logged By: <strong>{selectedExpForPrint.createdBy || 'Accounts Dept'}</strong></p>
                <p>Status: <strong className="text-emerald-700">{selectedExpForPrint.approvalStatus || 'Approved'}</strong></p>
              </div>
              <div className="text-center border-t border-gray-400 pt-1 w-36">
                Accounts Sign & Stamp
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button 
                onClick={() => window.print()} 
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" /> Print Expense Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. RECURRING EXPENSE MODAL */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-serif font-bold text-white">New Recurring Expense Schedule</h3>
            <form onSubmit={e => {
              e.preventDefault();
              if (!recurringForm.title || !recurringForm.estimatedAmount) return;
              const newSch: RecurringExpenseSchedule = {
                id: `rec-${Date.now()}`,
                title: recurringForm.title || 'Recurring Utility',
                department: recurringForm.department || 'Utilities',
                category: recurringForm.category || 'Utilities',
                vendorName: recurringForm.vendorName || '',
                estimatedAmount: Number(recurringForm.estimatedAmount),
                frequency: recurringForm.frequency || 'Monthly',
                dueDayOfMonth: Number(recurringForm.dueDayOfMonth) || 5,
                paymentSource: recurringForm.paymentSource || 'Bank Account',
                isActive: true,
                notes: recurringForm.notes || ''
              };
              setRecurringSchedules([newSch, ...recurringSchedules]);
              setShowRecurringModal(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Schedule Title *</label>
                <input 
                  type="text" required
                  value={recurringForm.title}
                  onChange={e => setRecurringForm(r => ({ ...r, title: e.target.value }))}
                  placeholder="e.g. Monthly Electricity Bill"
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Department</label>
                  <select 
                    value={recurringForm.department}
                    onChange={e => setRecurringForm(r => ({ ...r, department: e.target.value, category: e.target.value }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2 text-white"
                  >
                    {HOTEL_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-luxury-gold-300 font-bold block mb-1">Due Day of Month</label>
                  <input 
                    type="number" min="1" max="31" required
                    value={recurringForm.dueDayOfMonth}
                    onChange={e => setRecurringForm(r => ({ ...r, dueDayOfMonth: Number(e.target.value) }))}
                    className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Estimated Monthly Amount (₹) *</label>
                <input 
                  type="number" required min="1"
                  value={recurringForm.estimatedAmount || ''}
                  onChange={e => setRecurringForm(r => ({ ...r, estimatedAmount: Number(e.target.value) }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Vendor / Provider Name</label>
                <input 
                  type="text"
                  value={recurringForm.vendorName}
                  onChange={e => setRecurringForm(r => ({ ...r, vendorName: e.target.value }))}
                  placeholder="e.g. Tata Power / Airtel Commercial"
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-luxury-brown-800">
                <button type="button" onClick={() => setShowRecurringModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 font-bold rounded-lg shadow">Save Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ADD CATEGORY & BUDGET MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-luxury-brown-950 border border-luxury-gold-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-serif font-bold text-white">Add Expense Category & Budget Rule</h3>
            <form onSubmit={e => {
              e.preventDefault();
              if (!categoryForm.categoryName) return;
              const newCat: ExpenseCategoryDefinition = {
                id: `cat-${Date.now()}`,
                department: categoryForm.department || 'Room Operations',
                categoryName: categoryForm.categoryName,
                subcategories: categoryForm.subcategories || ['General'],
                monthlyBudgetLimit: Number(categoryForm.monthlyBudgetLimit) || 30000,
                notes: categoryForm.notes || ''
              };
              setCategoryDefs([newCat, ...categoryDefs]);
              setShowCategoryModal(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Hotel Department *</label>
                <select 
                  value={categoryForm.department}
                  onChange={e => setCategoryForm(c => ({ ...c, department: e.target.value }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                >
                  {HOTEL_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Category Name *</label>
                <input 
                  type="text" required
                  value={categoryForm.categoryName}
                  onChange={e => setCategoryForm(c => ({ ...c, categoryName: e.target.value }))}
                  placeholder="e.g. Guest Amenities & Toiletry Supplies"
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-luxury-gold-300 font-bold block mb-1">Monthly Budget Threshold Limit (₹)</label>
                <input 
                  type="number" required min="1000" step="5000"
                  value={categoryForm.monthlyBudgetLimit || ''}
                  onChange={e => setCategoryForm(c => ({ ...c, monthlyBudgetLimit: Number(e.target.value) }))}
                  className="w-full bg-luxury-brown-900 border border-luxury-brown-700 rounded-lg p-2.5 text-white font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-luxury-brown-800">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-4 py-2 bg-luxury-brown-800 text-luxury-brown-300 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 font-bold rounded-lg shadow">Create Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
