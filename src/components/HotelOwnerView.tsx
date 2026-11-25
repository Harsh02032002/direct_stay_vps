import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Bed,
  Users,
  Receipt,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Crown,
  Sparkles,
  Phone,
  Mail,
  Globe,
  MapPin,
  FileText,
  DollarSign,
  PieChart,
  Check,
  X,
  Plus,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react';
import {
  Hotel,
  Room,
  Booking,
  GuestCheckIn,
  Invoice,
  Expense,
  Staff,
  AuditLog,
  SaaSPackage,
  PosOrder,
  OwnerDirectorPayment,
  InventoryPurchase,
  PettyCashTransaction,
  CashBankAccount,
  FinanceVoucher,
  Vendor,
  StaffReimbursement,
  SubscriptionInvoice,
  SystemWebsiteConfig,
} from '../types';
import { computeHotelFinancialSummary, isCapitalContributionType } from '../utils/financeEngine';
import { showToast as triggerGlobalToast } from '../utils/toast';
import AuditLogsView, { formatAuditTimestamp, sortAuditLogsChronologically } from './AuditLogsView';
import SubscriptionInvoiceModal from './SubscriptionInvoiceModal';
import MembershipRenewalCheckout, {
  computeDaysRemaining,
  resolveEffectiveActivePackages,
} from './MembershipRenewalCheckout';
import WhatsAppSupportWidget, { DEFAULT_WHATSAPP_NUMBER } from './WhatsAppSupportWidget';

export type HotelOwnerSubTab =
  | 'dashboard'
  | 'property'
  | 'bookings'
  | 'financials'
  | 'occupancy'
  | 'staff'
  | 'subscription'
  | 'auditLogs';

interface HotelOwnerViewProps {
  activeSubTab: HotelOwnerSubTab;
  onSelectSubTab: (tab: HotelOwnerSubTab) => void;
  hotel: Hotel;
  packages: SaaSPackage[];
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  expenses: Expense[];
  posOrders: PosOrder[];
  inventoryPurchases?: InventoryPurchase[];
  pettyCash?: PettyCashTransaction[];
  cashBankAccounts?: CashBankAccount[];
  vouchers?: FinanceVoucher[];
  vendors?: Vendor[];
  reimbursements?: StaffReimbursement[];
  staff: Staff[];
  ownerPayments: OwnerDirectorPayment[];
  auditLogs: AuditLog[];
  systemWebsite?: SystemWebsiteConfig;
  onUpdateHotel: (updatedHotel: Hotel) => void;
  onUpdateExpenses: (updatedExpenses: Expense[]) => void;
  onUpdateOwnerPayments: (updatedPayments: OwnerDirectorPayment[]) => void;
  onAddAuditLog: (action: string, details: string) => void;
  onNavigateToProfile: () => void;
}

export default function HotelOwnerView({
  activeSubTab,
  onSelectSubTab,
  hotel,
  packages = [],
  rooms = [],
  bookings = [],
  checkins = [],
  invoices = [],
  expenses = [],
  posOrders = [],
  inventoryPurchases = [],
  pettyCash = [],
  cashBankAccounts = [],
  vouchers = [],
  vendors = [],
  reimbursements = [],
  staff = [],
  ownerPayments = [],
  auditLogs = [],
  systemWebsite,
  onUpdateHotel,
  onUpdateExpenses,
  onUpdateOwnerPayments,
  onAddAuditLog,
  onNavigateToProfile
}: HotelOwnerViewProps) {
  const [checkoutPkgId, setCheckoutPkgId] = useState<string | undefined>(undefined);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('All');
  const [staffSearch, setStaffSearch] = useState('');

  // Property Details Form State
  const [propName, setPropName] = useState(hotel?.name || '');
  const [propOwner, setPropOwner] = useState(hotel?.ownerName || '');
  const [propPhone, setPropPhone] = useState(hotel?.phoneNumber || '');
  const [propEmail, setPropEmail] = useState(hotel?.emailAddress || '');
  const [propGst, setPropGst] = useState(hotel?.gstNumber || '');
  const [propPan, setPropPan] = useState(hotel?.panNumber || '');
  const [propWebsite, setPropWebsite] = useState(hotel?.website || '');
  const [propAddress, setPropAddress] = useState(hotel?.address || '');
  const [propCheckIn, setPropCheckIn] = useState(hotel?.checkInTime || '12:00');
  const [propCheckOut, setPropCheckOut] = useState(hotel?.checkOutTime || '11:00');

  // Owner Drawing / Capital Modal State
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [drawingType, setDrawingType] = useState<OwnerDirectorPayment['type']>('Profit Share / Drawing');
  const [drawingAmount, setDrawingAmount] = useState('');
  const [drawingMethod, setDrawingMethod] = useState<OwnerDirectorPayment['paymentMethod']>('Bank Transfer');
  const [drawingNotes, setDrawingNotes] = useState('');

  const showToast = (msg: string) => {
    triggerGlobalToast(msg, 'success');
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Single Source of Truth Financial Summary (Shared with Finance Hub)
  const financeSummary = computeHotelFinancialSummary({
    hotelId: hotel?.id || 'hotel-1',
    invoices,
    checkins,
    bookings,
    posOrders,
    expenses,
    inventoryPurchases,
    pettyCash,
    cashBankAccounts,
    vouchers,
    vendors,
    ownerPayments,
    reimbursements,
    auditLogs,
  });

  const invoiceRevenue =
    financeSummary.revenue.roomRevenue +
    financeSummary.revenue.guestServicesRevenue +
    financeSummary.revenue.otherIncomeRevenue;
  const posRevenue = financeSummary.revenue.totalFnbRevenue;
  const totalRevenue = financeSummary.revenue.totalRecognizedRevenue;
  const totalExpenses = financeSummary.expenses.totalOperatingExpensesAccrued;
  const netProfit = financeSummary.profitability.netOperatingIncomeAccrual;
  const profitMargin = Math.round(financeSummary.profitability.operatingProfitMarginPct);

  // Pending Payments & Receivables (Deduplicated Single Source of Truth)
  const pendingCheckinDues = financeSummary.receivables.items
    .filter((r) => r.sourceType === 'inhouse_folio')
    .reduce((s, r) => s + r.outstandingAmount, 0);
  const unpaidInvoicesTotal = financeSummary.receivables.items
    .filter((r) => r.sourceType !== 'inhouse_folio')
    .reduce((s, r) => s + r.outstandingAmount, 0);
  const totalPendingReceivables = financeSummary.receivables.totalOutstanding;

  const pendingApprovalExpenses = expenses.filter(
    (e) => (e.approvalStatus || e.status) === 'Pending' && !e.isDemoData
  );
  const unpaidVendorExpenses = expenses.filter(
    (e) =>
      (e.approvalStatus || e.status || 'Approved') === 'Approved' &&
      (e.paymentStatus || 'Unpaid') !== 'Paid' &&
      !e.isDemoData
  );

  // Occupancy Metrics
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.status === 'Occupied').length;
  const reservedRooms = rooms.filter((r) => r.status === 'Reserved').length;
  const availableRooms = rooms.filter((r) => r.status === 'Available').length;
  const occupancyRate = totalRooms > 0 ? Math.round(((occupiedRooms + reservedRooms) / totalRooms) * 100) : 0;
  const avgRoomRate =
    totalRooms > 0 ? Math.round(rooms.reduce((sum, r) => sum + (Number(r.rate) || 0), 0) / totalRooms) : 0;
  const revPar = Math.round((avgRoomRate * occupancyRate) / 100);

  // Active Subscription Package
  const activePackage =
    packages.find((p) => p.id === hotel?.packageId) ||
    packages[0] || {
      id: 'pkg-premium',
      name: 'Premium Growth',
      priceMonthly: 1899,
      priceYearly: 14000,
      maxRooms: 30
    };

  const handleSavePropertyDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propName.trim()) {
      triggerGlobalToast('Property Name is required.', 'warning');
      return;
    }
    const updated: Hotel = {
      ...hotel,
      name: propName.trim(),
      ownerName: propOwner.trim(),
      phoneNumber: propPhone.trim(),
      emailAddress: propEmail.trim(),
      gstNumber: propGst.trim(),
      panNumber: propPan.trim(),
      website: propWebsite.trim(),
      address: propAddress.trim(),
      checkInTime: propCheckIn.trim(),
      checkOutTime: propCheckOut.trim()
    };
    onUpdateHotel(updated);
    onAddAuditLog('Owner Updated Property Details', `Updated property profile for ${updated.name}`);
    showToast('Property details saved and synced to MongoDB Atlas.');
  };

  const handleExpenseDecision = (expenseId: string, decision: 'Approved' | 'Rejected') => {
    const target = expenses.find((e) => e.id === expenseId);
    if (!target) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const nowDisplay = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const prevPayStatus = target.paymentStatus || 'Unpaid';
    const paidAmt = prevPayStatus === 'Paid' ? target.amount : Number(target.amountPaid || 0);
    const outAmt = decision === 'Rejected' ? 0 : Math.max(0, target.amount - paidAmt);

    const updated = expenses.map((e) =>
      e.id === expenseId
        ? {
            ...e,
            approvalStatus: decision,
            status: decision,
            approvedBy: `${hotel?.ownerName || 'Hotel Owner'} (Owner)`,
            approvedDate: todayStr,
            paymentStatus: decision === 'Rejected' ? 'Unpaid' : prevPayStatus,
            amountPaid: paidAmt,
            outstandingAmount: outAmt,
            auditHistory: [
              ...(Array.isArray(e.auditHistory) ? e.auditHistory : []),
              {
                action: `Owner ${decision} Expense`,
                status: `${decision} / ${decision === 'Rejected' ? 'Unpaid' : prevPayStatus}`,
                performedBy: `${hotel?.ownerName || 'Hotel Owner'} (Owner)`,
                dateTime: nowDisplay,
                notes:
                  decision === 'Approved'
                    ? 'Approved by Owner (Remains in Accounts Payable until paid)'
                    : 'Rejected by Owner',
              },
            ],
          }
        : e
    );
    onUpdateExpenses(updated);
    onAddAuditLog(
      `Owner ${decision} Expense`,
      `${decision} expense "${target.description}" of ₹${Number(target.amount || 0).toLocaleString('en-IN')} [Payment: ${decision === 'Rejected' ? 'Unpaid' : prevPayStatus}]`
    );
    showToast(
      decision === 'Approved'
        ? `Expense ${target.expenseNo || target.id} Approved (Queued in Accounts Payable).`
        : `Expense ${target.expenseNo || target.id} Rejected.`
    );
  };

  const handleAddOwnerPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(drawingAmount);
    if (!amt || amt <= 0) {
      triggerGlobalToast('Please enter a valid positive amount.', 'warning');
      return;
    }
    const isCapital = isCapitalContributionType(drawingType);
    const newRecord: OwnerDirectorPayment = {
      id: `own-pay-${Date.now()}`,
      hotelId: hotel.id,
      date: new Date().toISOString().split('T')[0],
      directorName: hotel.ownerName || 'Property Owner',
      category: isCapital ? 'Capital Contribution' : 'Owner Drawing',
      type: drawingType,
      amount: amt,
      paymentMethod: drawingMethod,
      notes: drawingNotes.trim() || `${drawingType} recorded by Owner`,
      referenceNo: `OWN-${Date.now().toString().slice(-6)}`,
      createdBy: `${hotel.ownerName || 'Property Owner'} (Owner)`,
    };
    onUpdateOwnerPayments([newRecord, ...ownerPayments]);
    onAddAuditLog(
      isCapital ? 'Owner Capital Contribution Recorded' : 'Owner Drawing Recorded',
      `${drawingType} of ₹${amt.toLocaleString('en-IN')} via ${drawingMethod} (Non-Operating Equity Movement)`
    );
    setDrawingAmount('');
    setDrawingNotes('');
    setShowDrawingModal(false);
    showToast(`${drawingType} of ₹${amt.toLocaleString('en-IN')} saved to Owner Equity Ledger.`);
  };

  const [viewingSubInvoice, setViewingSubInvoice] = useState<SubscriptionInvoice | null>(null);
  const [showRenewRequestModal, setShowRenewRequestModal] = useState(false);
  const [renewPlanCycle, setRenewPlanCycle] = useState<'Monthly' | 'HalfYearly' | 'Yearly'>('Yearly');
  const [renewPkgId, setRenewPkgId] = useState<string>(hotel?.packageId || '');
  const [renewPkgName, setRenewPkgName] = useState<string>('Premium Property Pack');
  const [renewBasePrice, setRenewBasePrice] = useState<number>(17000);
  const [renewPaymentMode, setRenewPaymentMode] = useState<string>('UPI');
  const [renewUtrRef, setRenewUtrRef] = useState<string>('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);

  const handleRenewSubscription = (plan: 'Monthly' | 'HalfYearly' | 'Yearly') => {
    const basePrice = plan === 'Monthly' ? 1899 : plan === 'HalfYearly' ? 5999 : 17000;
    const pkgLabel =
      plan === 'Monthly'
        ? 'Monthly Pack'
        : plan === 'HalfYearly'
        ? 'Annual Pack – Special Offer'
        : 'Premium Property Pack';
    setRenewPlanCycle(plan);
    setRenewPkgId(hotel?.packageId || '');
    setRenewPkgName(pkgLabel);
    setRenewBasePrice(basePrice);
    setRenewPaymentMode('UPI');
    setRenewUtrRef(`UTR${Date.now().toString().slice(-8)}`);
    setShowRenewRequestModal(true);
  };

  const handleSubmitRenewalRequestModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = renewUtrRef.trim() || `UTR${Date.now().toString().slice(-8)}`;
    setIsSubmittingRenewal(true);
    try {
      const res = await fetch('/api/hotels/renewal-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotel.id,
          requestedPackageId: renewPkgId || undefined,
          requestedPackageName: renewPkgName,
          requestedPlan: renewPlanCycle,
          requestedAmount: renewBasePrice,
          paymentMethod: renewPaymentMode,
          transactionReference: cleanUtr,
          requestedBy: hotel.ownerName || hotel.ownerUsername || 'Hotel Owner',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        triggerGlobalToast(data.error || 'Failed to submit subscription renewal request.', 'error');
        return;
      }
      if (data.renewalRequest) {
        onUpdateHotel({ ...hotel, renewalRequest: data.renewalRequest });
      }
      onAddAuditLog(
        'Owner Submitted Subscription Renewal',
        `Submitted ${renewPkgName} (${renewPlanCycle}) renewal request (₹${renewBasePrice.toLocaleString('en-IN')} + GST, Mode: ${renewPaymentMode}, Ref: ${cleanUtr}) to SuperAdmin for approval & invoice generation`
      );
      setShowRenewRequestModal(false);
      showToast(`Renewal request (Ref: ${cleanUtr}) sent to SuperAdmin for approval & invoice generation!`);
    } catch {
      triggerGlobalToast('Network error submitting subscription renewal request.', 'error');
    } finally {
      setIsSubmittingRenewal(false);
    }
  };

  const subTabs: { id: HotelOwnerSubTab; label: string; icon: any; badge?: number | null }[] = [
    { id: 'dashboard', label: 'Overview', icon: PieChart, badge: null },
    { id: 'property', label: 'Property Details', icon: Building2, badge: null },
    { id: 'bookings', label: 'Bookings', icon: FileText, badge: bookings.length },
    { id: 'financials', label: 'Revenue & Expenses', icon: DollarSign, badge: pendingApprovalExpenses.length > 0 ? pendingApprovalExpenses.length : null },
    { id: 'occupancy', label: 'Financial Reports', icon: Bed, badge: null },
    { id: 'staff', label: 'Staff Overview', icon: Users, badge: staff.length },
    { id: 'subscription', label: 'Subscription & Billing', icon: Crown, badge: null },
    { id: 'auditLogs', label: 'Security Audit Logs', icon: ShieldCheck, badge: null }
  ];

  // Real data channel & category breakdowns for Owner Analytics
  const directBookingsCount = bookings.filter(
    (b) => !b.bookingSource || b.bookingSource === 'Walk-in'
  ).length;
  const otaBookingsCount = Math.max(0, bookings.length - directBookingsCount);
  const directBookingPct = bookings.length > 0 ? Math.round((directBookingsCount / bookings.length) * 100) : 0;
  const otaBookingPct = bookings.length > 0 ? 100 - directBookingPct : 0;

  const invoiceSharePct = totalRevenue > 0 ? Math.round((invoiceRevenue / totalRevenue) * 100) : 0;
  const posSharePct = totalRevenue > 0 ? 100 - invoiceSharePct : 0;

  const roomCategories = Array.from(new Set(rooms.map((r) => r.category || 'Standard')));

  return (
    <div className="space-y-6">
      {/* Executive Owner Header Banner */}
      <div className="bg-gradient-to-r from-luxury-brown-900 via-luxury-brown-950 to-[#140D09] text-white rounded-2xl p-4 sm:p-6 md:p-7 border border-luxury-gold-500/25 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-luxury-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-luxury-gold-500/15 border border-luxury-gold-500/30 text-luxury-gold-300 text-[10px] font-mono uppercase tracking-[0.2em] font-bold">
            <Crown className="w-3.5 h-3.5 text-luxury-gold-400 shrink-0" /> Hotel Owner Executive Portal
          </div>
          <h1 className="text-lg sm:text-2xl md:text-3xl font-serif font-bold text-[#263449] leading-snug">
            {hotel?.name || 'GRAND PAVILION'} — Ownership & Financial Console
          </h1>
          <p className="text-xs text-luxury-brown-200 max-w-2xl leading-relaxed">
            Proprietor: <strong className="text-luxury-gold-300">{hotel?.ownerName || 'Property Owner'}</strong> • GSTIN:{' '}
            <span className="font-mono text-white">{hotel?.gstNumber || 'N/A'}</span> • Subscription:{' '}
            <span className="text-emerald-400 font-semibold">{hotel?.subscriptionPlan || 'Yearly'} ({hotel?.subscriptionStatus || 'Active'})</span>
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex flex-wrap items-center gap-2 sm:gap-3 relative z-10 shrink-0 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => onSelectSubTab('financials')}
            className="px-3 sm:px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-sans font-bold text-[11px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs"
          >
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Approve Expenses ({pendingApprovalExpenses.length})</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToProfile}
            className="px-3 sm:px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-luxury-gold-500/30 text-luxury-gold-300 font-mono text-[11px] sm:text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center"
          >
            Owner Security Settings
          </button>
        </div>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="bg-white border border-luxury-brown-100 rounded-2xl p-1.5 shadow-2xs grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 no-print">
        {subTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectSubTab(t.id)}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-sans font-bold flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0 truncate transition-all cursor-pointer ${
                isActive
                  ? 'bg-luxury-brown-900 text-white shadow-xs'
                  : 'text-luxury-brown-600 bg-slate-50 sm:bg-transparent hover:bg-luxury-beige-50 hover:text-luxury-brown-950'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-luxury-gold-400' : 'text-luxury-brown-400'}`} />
              <span className="truncate">{t.label}</span>
              {t.badge !== null && t.badge !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                  isActive ? 'bg-luxury-gold-500 text-luxury-brown-950' : 'bg-luxury-beige-100 text-luxury-brown-700'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toast Message */}
      {toastMsg && (
        <div className="bg-emerald-950 text-emerald-200 border border-emerald-700 rounded-2xl px-5 py-3 text-xs font-mono font-bold flex items-center justify-between shadow-md">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastMsg}
          </span>
          <button type="button" onClick={() => setToastMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 1. EXECUTIVE DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 8-Card Executive KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* KPI 1: Gross Property Revenue */}
            <div
              onClick={() => onSelectSubTab('financials')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-emerald-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Gross Property Revenue</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-luxury-brown-950">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-700 font-mono">
                Folios: ₹{invoiceRevenue.toLocaleString('en-IN')} • POS: ₹{posRevenue.toLocaleString('en-IN')}
              </p>
            </div>

            {/* KPI 2: Operating Expenses */}
            <div
              onClick={() => onSelectSubTab('financials')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-rose-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Operating Expenses</span>
                <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-luxury-brown-950">
                ₹{totalExpenses.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-amber-700 font-mono font-semibold">
                {pendingApprovalExpenses.length} awaiting Owner approval
              </p>
            </div>

            {/* KPI 3: Net Operating Profit */}
            <div
              onClick={() => onSelectSubTab('occupancy')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-luxury-gold-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Net Operating Profit</span>
                <div className="p-2.5 bg-luxury-gold-500/15 text-luxury-gold-700 rounded-xl">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-2xl font-serif font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{netProfit.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-luxury-brown-500 font-mono">
                Margin: {profitMargin}% • RevPAR: ₹{revPar.toLocaleString('en-IN')}
              </p>
            </div>

            {/* KPI 4: Occupancy Rate */}
            <div
              onClick={() => onSelectSubTab('occupancy')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-blue-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Occupancy Rate</span>
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                  <Bed className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-luxury-brown-950">
                {occupancyRate}% <span className="text-xs font-mono text-luxury-brown-500">({occupiedRooms + reservedRooms}/{totalRooms})</span>
              </p>
              <p className="text-[11px] text-luxury-brown-500 font-mono">
                ADR: ₹{avgRoomRate.toLocaleString('en-IN')} / night
              </p>
            </div>

            {/* KPI 5: Total Bookings */}
            <div
              onClick={() => onSelectSubTab('bookings')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-luxury-gold-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Total Bookings</span>
                <div className="p-2.5 bg-luxury-beige-100 text-luxury-brown-800 rounded-xl">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-luxury-brown-950">
                {bookings.length} <span className="text-xs font-mono text-luxury-brown-500">Reservations</span>
              </p>
              <p className="text-[11px] text-luxury-brown-600 font-mono">
                {checkins.filter((c) => !c.checkedOutDateTime).length} Active In-House Guests
              </p>
            </div>

            {/* KPI 6: Available Rooms */}
            <div
              onClick={() => onSelectSubTab('occupancy')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-emerald-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Available Rooms</span>
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-emerald-700">
                {availableRooms} <span className="text-xs font-mono text-luxury-brown-500">of {totalRooms} Ready</span>
              </p>
              <p className="text-[11px] text-luxury-brown-500 font-mono">
                {occupiedRooms} Occupied • {reservedRooms} Reserved
              </p>
            </div>

            {/* KPI 7: Pending Guest Dues */}
            <div
              onClick={() => onSelectSubTab('financials')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-amber-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Pending Receivables</span>
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-rose-700">
                ₹{totalPendingReceivables.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-luxury-brown-500 font-mono">
                Folios: ₹{pendingCheckinDues.toLocaleString('en-IN')} • Unpaid Bills: ₹{unpaidInvoicesTotal.toLocaleString('en-IN')}
              </p>
            </div>

            {/* KPI 8: Active Staff */}
            <div
              onClick={() => onSelectSubTab('staff')}
              className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-2xs hover:border-indigo-500/40 transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold">Property Workforce</span>
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-luxury-brown-950">
                {staff.filter((s) => s.status === 'Active').length}{' '}
                <span className="text-xs font-mono text-luxury-brown-500">/ {staff.length} Active</span>
              </p>
              <p className="text-[11px] text-luxury-brown-500 font-mono">
                Across Front Desk, Housekeeping & POS
              </p>
            </div>
          </div>

          {/* Revenue Breakdown & Room Category Occupancy Visuals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue & Booking Channel Breakdown */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-luxury-brown-100 pb-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                    Revenue Streams & Booking Channel Mix
                  </h3>
                  <p className="text-[11px] text-luxury-brown-500">
                    Live distribution of room folios, dining/POS orders, and booking sources.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-luxury-beige-50 border border-luxury-brown-100 text-[10px] font-mono font-bold text-luxury-brown-700">
                  Real-Time Ledger
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-luxury-brown-800">Room Tariff & GST Invoices</span>
                    <span className="font-mono font-bold text-luxury-brown-950">
                      ₹{invoiceRevenue.toLocaleString('en-IN')} ({invoiceSharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-luxury-beige-100 rounded-full overflow-hidden">
                    <div className="h-full bg-luxury-gold-500 rounded-full transition-all duration-500" style={{ width: `${invoiceSharePct}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-luxury-brown-800">Dining, Room Service & POS Orders</span>
                    <span className="font-mono font-bold text-emerald-700">
                      ₹{posRevenue.toLocaleString('en-IN')} ({posSharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-luxury-beige-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${posSharePct}%` }} />
                  </div>
                </div>

                <div className="pt-3 border-t border-luxury-brown-100 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-luxury-beige-50/60 border border-luxury-brown-100">
                    <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">Direct / Walk-In / Web</span>
                    <span className="text-base font-serif font-bold text-luxury-brown-950">
                      {directBookingsCount} Bookings ({directBookingPct}%)
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-luxury-beige-50/60 border border-luxury-brown-100">
                    <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">OTA / Agency Channels</span>
                    <span className="text-base font-serif font-bold text-luxury-brown-950">
                      {otaBookingsCount} Bookings ({otaBookingPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Room Category Occupancy Breakdown */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-luxury-brown-100 pb-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                    Inventory Occupancy by Room Category
                  </h3>
                  <p className="text-[11px] text-luxury-brown-500">
                    Category-level utilization across {totalRooms} configured property rooms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSubTab('occupancy')}
                  className="text-xs font-mono font-bold text-luxury-gold-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Room Matrix <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {roomCategories.length === 0 ? (
                <div className="p-6 text-center text-xs text-luxury-brown-500 bg-luxury-beige-50/50 rounded-xl">
                  No rooms configured for this property yet.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {roomCategories.map((cat) => {
                    const catRooms = rooms.filter((r) => (r.category || 'Standard') === cat);
                    const catBusy = catRooms.filter((r) => r.status === 'Occupied' || r.status === 'Reserved').length;
                    const catPct = catRooms.length > 0 ? Math.round((catBusy / catRooms.length) * 100) : 0;
                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-luxury-brown-900">{cat}</span>
                          <span className="font-mono text-luxury-brown-600">
                            <strong>{catBusy}</strong> / {catRooms.length} Occupied ({catPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-luxury-beige-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-luxury-brown-900 rounded-full transition-all duration-500"
                            style={{ width: `${catPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pending Expense Approvals & Recent Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-luxury-brown-100 pb-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                    Pending Owner Expense Approvals ({pendingApprovalExpenses.length})
                  </h3>
                  <p className="text-[11px] text-luxury-brown-500">
                    Review and authorize property expenditure requests submitted by hotel staff.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSubTab('financials')}
                  className="text-xs font-mono font-bold text-luxury-gold-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Full Ledger <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {pendingApprovalExpenses.length === 0 ? (
                <div className="p-6 text-center text-xs text-luxury-brown-500 bg-luxury-beige-50/50 rounded-xl">
                  All property expenses have been reviewed. No pending approvals.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovalExpenses.slice(0, 4).map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-luxury-brown-950">{exp.category}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-white border border-amber-200 rounded text-amber-800">
                            {exp.date}
                          </span>
                        </div>
                        <p className="text-xs text-luxury-brown-700">{exp.description}</p>
                        <p className="text-[11px] font-mono text-luxury-brown-500">
                          Vendor: {exp.vendorName || 'Direct'} • Amount:{' '}
                          <strong className="text-luxury-brown-950">₹{Number(exp.amount || 0).toLocaleString('en-IN')}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExpenseDecision(exp.id, 'Approved')}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExpenseDecision(exp.id, 'Rejected')}
                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Property Activity & Audit Stream */}
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-luxury-brown-100 pb-3">
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                    Recent Property Activity & Audit Trail
                  </h3>
                  <p className="text-[11px] text-luxury-brown-500">
                    Latest operational events, bookings, and security actions recorded on your property.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSubTab('auditLogs')}
                  className="text-xs font-mono font-bold text-luxury-gold-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  All Logs <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-luxury-brown-500 bg-luxury-beige-50/50 rounded-xl">
                  No recent audit events recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortAuditLogsChronologically(auditLogs).slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-luxury-beige-50/50 border border-luxury-brown-100 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-luxury-brown-950 truncate">{log.action}</p>
                        <p className="text-[11px] text-luxury-brown-600 line-clamp-1">{log.details}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-luxury-brown-100 text-luxury-brown-700 block">
                          {log.performedBy}
                        </span>
                        <span className="text-[10px] font-mono text-luxury-brown-400 block mt-0.5">
                          {formatAuditTimestamp(log.dateTime)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PROPERTY DETAILS */}
      {activeSubTab === 'property' && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-6">
          <div className="border-b border-luxury-brown-100 pb-4">
            <h3 className="text-lg font-serif font-bold text-luxury-brown-950">
              Property Identity & Statutory Registration
            </h3>
            <p className="text-xs text-luxury-brown-500">
              Manage official hotel details, GST/PAN registration numbers, and standard check-in/out timings.
            </p>
          </div>

          <form onSubmit={handleSavePropertyDetails} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Property Name *</label>
                <input
                  type="text"
                  required
                  value={propName}
                  onChange={(e) => setPropName(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Proprietor / Owner Name *</label>
                <input
                  type="text"
                  required
                  value={propOwner}
                  onChange={(e) => setPropOwner(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Official Phone *</label>
                <input
                  type="text"
                  required
                  value={propPhone}
                  onChange={(e) => setPropPhone(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Official Email *</label>
                <input
                  type="email"
                  required
                  value={propEmail}
                  onChange={(e) => setPropEmail(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">GSTIN Number</label>
                <input
                  type="text"
                  value={propGst}
                  onChange={(e) => setPropGst(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">PAN Number</label>
                <input
                  type="text"
                  value={propPan}
                  onChange={(e) => setPropPan(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Website URL</label>
                <input
                  type="text"
                  value={propWebsite}
                  onChange={(e) => setPropWebsite(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Check-In Time</label>
                <input
                  type="text"
                  value={propCheckIn}
                  onChange={(e) => setPropCheckIn(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Check-Out Time</label>
                <input
                  type="text"
                  value={propCheckOut}
                  onChange={(e) => setPropCheckOut(e.target.value)}
                  className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-bold uppercase text-luxury-brown-700">Registered Property Address</label>
              <input
                type="text"
                value={propAddress}
                onChange={(e) => setPropAddress(e.target.value)}
                className="w-full text-xs border border-luxury-brown-200 rounded-xl px-3.5 py-2.5"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-serif font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Save Property Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. BOOKING OVERVIEW */}
      {activeSubTab === 'bookings' && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-luxury-brown-100 pb-4">
            <div>
              <h3 className="text-lg font-serif font-bold text-luxury-brown-950">
                Property Bookings & Stay Registry ({bookings.length})
              </h3>
              <p className="text-xs text-luxury-brown-500">
                Complete audit overview of direct walk-ins and OTA reservations for {hotel?.name}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-luxury-brown-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search guest or room..."
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs border border-luxury-brown-200 rounded-xl"
                />
              </div>
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                className="text-xs border border-luxury-brown-200 rounded-xl px-3 py-2 bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Checked In">Checked In</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[11px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/60">
                  <th className="py-3 px-4">Booking ID</th>
                  <th className="py-3 px-4">Guest Name</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Check-In / Out</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Advance / Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {bookings
                  .filter((b) => {
                    const matchesStatus = bookingStatusFilter === 'All' || b.status === bookingStatusFilter;
                    const q = bookingSearch.toLowerCase();
                    const matchesSearch =
                      !q ||
                      b.guestName.toLowerCase().includes(q) ||
                      b.roomNumber.toLowerCase().includes(q) ||
                      b.id.toLowerCase().includes(q);
                    return matchesStatus && matchesSearch;
                  })
                  .map((b) => (
                    <tr key={b.id} className="hover:bg-luxury-beige-50/40">
                      <td className="py-3 px-4 font-mono font-bold text-luxury-brown-900">{b.id}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-luxury-brown-950">{b.guestName}</p>
                        <p className="text-[10px] font-mono text-luxury-brown-500">{b.mobile}</p>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        Room {b.roomNumber} ({b.roomType})
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {b.checkInDate} → {b.checkOutDate}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-luxury-beige-100 text-luxury-brown-800 font-mono text-[10px]">
                          {b.bookingSource}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        ₹{(b.bookingAmount || b.advanceAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            b.status === 'Confirmed' || b.status === 'Checked In'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : b.status === 'Cancelled'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-luxury-brown-400">
                      No bookings recorded for this property yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FINANCIALS: REVENUE, EXPENSES, PENDING PAYMENTS & OWNER DRAWINGS */}
      {activeSubTab === 'financials' && (
        <div className="space-y-6">
          {/* Single Source of Truth Financial KPI Row (Shared with Finance Hub) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold block">
                Recognized Operating Revenue
              </span>
              <span className="text-2xl font-serif font-bold text-luxury-brown-950 block">
                ₹{financeSummary.revenue.totalRecognizedRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] font-mono text-emerald-700 block">
                AR Due: ₹{financeSummary.receivables.totalOutstanding.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold block">
                Operating Expenses & COGS
              </span>
              <span className="text-2xl font-serif font-bold text-rose-700 block">
                ₹{financeSummary.expenses.totalOperatingExpensesAccrued.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] font-mono text-rose-600 block">
                AP Unpaid: ₹{financeSummary.payables.totalOutstanding.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold block">
                Net Operating Profit & Cash
              </span>
              <span
                className={`text-2xl font-serif font-bold block ${
                  financeSummary.profitability.netOperatingIncomeAccrual >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                ₹{financeSummary.profitability.netOperatingIncomeAccrual.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] font-mono text-luxury-brown-600 block">
                Cash & Bank: ₹{financeSummary.cashAndBank.totalLiquidFunds.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-luxury-brown-950 text-white border border-luxury-gold-500/30 rounded-2xl p-5 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-luxury-gold-400 font-bold block">
                Owner Capital & Drawings (Equity)
              </span>
              <span className="text-xl font-serif font-bold text-white block">
                Net: ₹{financeSummary.ownerEquity.netOwnerCapitalMovement.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-mono text-luxury-brown-300 block">
                In: ₹{financeSummary.ownerEquity.capitalContributionsTotal.toLocaleString('en-IN')} • Out: ₹
                {financeSummary.ownerEquity.ownerDrawingsTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Expense Approval Queue & Full Expense List */}
          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950">
                  Property Expense Ledger & Owner Approval Desk
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Approved Operating Expenses: ₹{totalExpenses.toLocaleString('en-IN')} • Pending Approval:{' '}
                  {pendingApprovalExpenses.length} • Unpaid Vendor Bills: {unpaidVendorExpenses.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawingModal(true)}
                className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-serif font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Record Owner Capital / Drawing
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-luxury-brown-100 text-[11px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/60">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category & Description</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">Owner Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-luxury-beige-50/40">
                      <td className="py-3 px-4 font-mono text-[11px]">{exp.date}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-luxury-brown-950">{exp.category}</p>
                        <p className="text-[11px] text-luxury-brown-600">{exp.description}</p>
                      </td>
                      <td className="py-3 px-4 text-luxury-brown-700">{exp.vendorName || 'Direct'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-luxury-brown-950">
                        ₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            exp.paymentStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {exp.paymentStatus || 'Unpaid'} ({exp.paymentMethod || 'Bank Transfer'})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {(exp.approvalStatus || exp.status) === 'Pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleExpenseDecision(exp.id, 'Approved')}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExpenseDecision(exp.id, 'Rejected')}
                              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              (exp.approvalStatus || exp.status) === 'Rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {exp.approvalStatus || exp.status || 'Approved'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Owner / Director Capital & Drawings History */}
          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-serif font-bold text-luxury-brown-950">
              Owner / Director Capital & Drawings Ledger ({ownerPayments.length})
            </h4>
            {ownerPayments.length === 0 ? (
              <p className="text-xs text-luxury-brown-500">
                No owner drawings or capital injections recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-luxury-brown-100 text-[11px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/60">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Director / Owner</th>
                      <th className="py-2.5 px-4">Transaction Type</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Amount</th>
                      <th className="py-2.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100">
                    {ownerPayments.map((op) => (
                      <tr key={op.id}>
                        <td className="py-2.5 px-4 font-mono">{op.date}</td>
                        <td className="py-2.5 px-4 font-bold">{op.directorName}</td>
                        <td className="py-2.5 px-4">{op.type}</td>
                        <td className="py-2.5 px-4 font-mono">{op.paymentMethod}</td>
                        <td className="py-2.5 px-4 font-mono font-bold">₹{Number(op.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-luxury-brown-600">{op.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. FINANCIAL & OCCUPANCY REPORTS */}
      {activeSubTab === 'occupancy' && (
        <div className="space-y-6">
          {/* Executive Financial & P&L Summary */}
          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-5 shadow-2xs">
            <div className="border-b border-luxury-brown-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950">
                  Executive Financial & Profit/Loss Statement
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Consolidated income, expenditure, receivables, and operating margins for {hotel?.name || 'Property'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white text-xs font-sans font-bold cursor-pointer self-start sm:self-auto no-print"
              >
                Print / Export Report
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1">
                <span className="text-[10px] font-mono uppercase text-emerald-800 font-bold block">Room Invoice Revenue</span>
                <span className="text-xl font-serif font-bold text-emerald-950 block">₹{invoiceRevenue.toLocaleString('en-IN')}</span>
                <span className="text-[11px] font-mono text-emerald-700 block">{invoices.length} GST Invoices Issued</span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1">
                <span className="text-[10px] font-mono uppercase text-emerald-800 font-bold block">Dining & POS Revenue</span>
                <span className="text-xl font-serif font-bold text-emerald-950 block">₹{posRevenue.toLocaleString('en-IN')}</span>
                <span className="text-[11px] font-mono text-emerald-700 block">{posOrders.length} POS Orders Recorded</span>
              </div>
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-1">
                <span className="text-[10px] font-mono uppercase text-rose-800 font-bold block">Total Operating Expenses</span>
                <span className="text-xl font-serif font-bold text-rose-950 block">₹{totalExpenses.toLocaleString('en-IN')}</span>
                <span className="text-[11px] font-mono text-rose-700 block">{unpaidVendorExpenses.length} Unpaid Vendor Bills</span>
              </div>
              <div className="p-4 rounded-xl bg-luxury-beige-50 border border-luxury-gold-500/30 space-y-1">
                <span className="text-[10px] font-mono uppercase text-luxury-brown-700 font-bold block">Net Operating Profit</span>
                <span className={`text-xl font-serif font-bold block ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  ₹{netProfit.toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] font-mono text-luxury-brown-600 block">
                  Net Margin: {profitMargin}% • RevPAR: ₹{revPar.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Room Inventory & Live Occupancy Matrix */}
          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-6 shadow-2xs">
            <div className="border-b border-luxury-brown-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950">
                  Room Inventory & Live Occupancy Matrix
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Occupancy: {occupancyRate}% • Available: {availableRooms} • Occupied: {occupiedRooms} • Reserved: {reservedRooms}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-luxury-beige-100 text-luxury-brown-800 text-xs font-mono font-bold">
                ADR: ₹{avgRoomRate.toLocaleString('en-IN')} / night
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl border border-luxury-brown-100 bg-luxury-beige-50/40 space-y-2 flex flex-col justify-between hover:border-luxury-gold-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-serif font-bold text-luxury-brown-950">Room {room.number}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        room.status === 'Available'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : room.status === 'Occupied'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {room.status}
                    </span>
                  </div>
                  <div className="text-xs text-luxury-brown-600 space-y-0.5">
                    <p className="font-semibold text-luxury-brown-900">{room.category}</p>
                    <p className="font-mono">Tariff: ₹{Number(room.rate || 0).toLocaleString('en-IN')} / night</p>
                    <p className="text-[11px] font-mono text-luxury-brown-500">
                      Housekeeping: {room.cleaningStatus || 'Clean'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. STAFF OVERVIEW */}
      {activeSubTab === 'staff' && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-luxury-brown-100 pb-4">
            <div>
              <h3 className="text-lg font-serif font-bold text-luxury-brown-950">
                Property Workforce & Department Roster ({staff.length})
              </h3>
              <p className="text-xs text-luxury-brown-500">
                Executive directory of hotel staff across Front Desk, Housekeeping, Accounts, and Administration.
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-luxury-brown-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff member..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs border border-luxury-brown-200 rounded-xl"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[11px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/60">
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">Department / Role</th>
                  <th className="py-3 px-4">Contact Mobile</th>
                  <th className="py-3 px-4">Login ID & Password</th>
                  <th className="py-3 px-4">Assigned Modules</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Share ID/Pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {staff
                  .filter(
                    (s) =>
                      !staffSearch ||
                      s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
                      s.department.toLowerCase().includes(staffSearch.toLowerCase())
                  )
                  .map((s) => (
                    <tr key={s.id} className="hover:bg-luxury-beige-50/40">
                      <td className="py-3 px-4">
                        <span className="font-bold text-luxury-brown-950 block">{s.name}</span>
                        <span className="text-[10px] text-luxury-brown-500">{s.designation}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-luxury-brown-800">{s.department}</span>
                        <span className="block text-[10px] font-mono text-luxury-gold-700 font-bold">🔑 {s.role || 'Staff'}</span>
                      </td>
                      <td className="py-3 px-4 font-mono">{s.mobile}</td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-[11px]">
                          <span className="text-luxury-brown-500">ID: </span>
                          <strong className="text-luxury-brown-950">{s.username}</strong>
                        </div>
                        <div className="text-[11px]">
                          <span className="text-luxury-brown-500">Pass: </span>
                          <strong className="text-emerald-700">{s.plainPassword || 'password123'}</strong>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {(s.allowedModules && s.allowedModules.length > 0 ? s.allowedModules : ['dashboard', 'frontDesk']).map(m => (
                            <span key={m} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-mono font-bold">
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            s.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const digits = String(s.mobile || '').replace(/\D/g, '');
                            if (digits.length < 10) return;
                            const phone = digits.length === 10 ? `91${digits}` : digits;
                            const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : '/admin';
                            const mods = (s.allowedModules && s.allowedModules.length > 0 ? s.allowedModules : ['dashboard', 'frontDesk']).join(', ');
                            const msg = [
                              `🏨 *${hotel?.name || 'Hotel'} — Staff PMS Login Credentials*`,
                              ``,
                              `Namaste *${s.name}* (${s.designation}),`,
                              `🌐 *Login Link:* ${loginUrl}`,
                              `👤 *Login ID:* ${s.username}`,
                              `🔑 *Password:* ${s.plainPassword || 'password123'}`,
                              `📂 *Assigned Modules:* ${mods}`
                            ].join('\n');
                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold cursor-pointer"
                        >
                          📲 WhatsApp ID/Pass
                        </button>
                      </td>
                    </tr>
                  ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-luxury-brown-400">
                      No staff members registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. SUBSCRIPTION & BILLING */}
      {activeSubTab === 'subscription' && (() => {
        const dynamicPlans = resolveEffectiveActivePackages(packages);
        const daysRemaining = computeDaysRemaining(hotel?.subscriptionEndDate);
        const isExpired = hotel?.subscriptionStatus === 'Expired' || (daysRemaining !== null && daysRemaining < 0);
        const isExpiringSoon = !isExpired && daysRemaining !== null && daysRemaining <= 30;
        const paymentHistory = Array.isArray(hotel?.subscriptionPayments) ? hotel.subscriptionPayments : [];
        const whatsappPhone = systemWebsite?.whatsappNumber || systemWebsite?.supportPhone || DEFAULT_WHATSAPP_NUMBER;

        return (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 space-y-6">
          <div className="border-b border-luxury-brown-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-serif font-bold text-luxury-brown-950">
                SaaS Membership, Renewal &amp; Billing History
              </h3>
              <p className="text-xs text-luxury-brown-500">
                Track active package validity, remaining days, verified payment history, GST tax invoices, and plan upgrades.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold border ${
                  isExpired
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : isExpiringSoon
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                Status: {isExpired ? 'Expired' : hotel?.subscriptionStatus || 'Active'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCheckoutPkgId(hotel?.packageId || dynamicPlans[0]?.id);
                  setShowCheckoutModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{isExpired || isExpiringSoon ? 'Renew Now' : 'Renew / Upgrade Plan'}</span>
              </button>
            </div>
          </div>

          {(isExpired || isExpiringSoon) && (
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isExpired ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="space-y-0.5 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {isExpired
                    ? `Membership expired ${Math.abs(daysRemaining || 0)} day(s) ago — your hotel data is safe, renew now to restore full access.`
                    : `Your membership expires in ${daysRemaining} day(s) (${hotel?.subscriptionEndDate}). Renew now for uninterrupted PMS & OTA access.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCheckoutPkgId(hotel?.packageId || dynamicPlans[0]?.id);
                  setShowCheckoutModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 text-xs font-bold shrink-0 cursor-pointer"
              >
                Renew Now →
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-luxury-beige-50/70 border border-luxury-brown-100 space-y-1">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold">Current Package</span>
              <p className="text-base font-serif font-bold text-luxury-brown-950">
                {activePackage.name}
              </p>
              <p className="text-xs font-mono text-luxury-gold-700">
                ₹{(hotel?.subscriptionPrice || activePackage.priceYearly || 5999).toLocaleString('en-IN')} / yr (+ 18% GST)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-luxury-beige-50/70 border border-luxury-brown-100 space-y-1">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold">Activation Date</span>
              <p className="text-base font-serif font-bold text-luxury-brown-950 font-mono">
                {hotel?.subscriptionActivatedAt || hotel?.trialStartDate || 'N/A'}
              </p>
              <p className="text-[11px] font-mono text-luxury-brown-500">
                Cycle: {hotel?.subscriptionPlan || 'Yearly'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-luxury-beige-50/70 border border-luxury-brown-100 space-y-1">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold">Expiry &amp; Remaining Days</span>
              <p className="text-base font-serif font-bold text-luxury-brown-950 font-mono">
                {hotel?.subscriptionEndDate || 'N/A'}
              </p>
              <p
                className={`text-xs font-mono font-bold ${
                  isExpired ? 'text-rose-700' : isExpiringSoon ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {daysRemaining === null
                  ? 'Active License'
                  : daysRemaining < 0
                  ? `${Math.abs(daysRemaining)} day(s) overdue`
                  : `${daysRemaining} day(s) remaining`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-luxury-beige-50/70 border border-luxury-brown-100 space-y-1">
              <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold">Room Capacity</span>
              <p className="text-base font-serif font-bold text-luxury-brown-950">
                {totalRooms} / {activePackage.maxRooms >= 999 ? 'Unlimited' : activePackage.maxRooms || 50} Rooms
              </p>
              <p className="text-[11px] font-mono text-emerald-700">
                {(activePackage as any).otaLimitLabel || ((activePackage as any).modules?.ota ? 'OTA Channel Manager Active' : 'Full PMS License')}
              </p>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-mono uppercase text-luxury-brown-700 font-bold">
                Available DirectStay Plans &amp; Upgrades (18% GST Extra)
              </h4>
              <span className="text-[11px] font-mono text-luxury-brown-500">
                Click any plan to open Direct UPI QR &amp; Verified Checkout
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dynamicPlans.map((pkg) => {
                const pkgPrice = Number(pkg.priceYearly || pkg.priceMonthly || 5999);
                const pkgGst = Number(pkg.gstRate ?? 18);
                const pkgTotal = pkgPrice + Math.round(pkgPrice * (pkgGst / 100));
                const isCurrent = pkg.id === hotel?.packageId;
                return (
                  <div
                    key={pkg.id}
                    className={`p-5 rounded-2xl flex flex-col justify-between space-y-4 ${
                      pkg.isPopular
                        ? 'border-2 border-luxury-gold-500 bg-luxury-beige-50/40'
                        : 'border border-luxury-brown-200 bg-white'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase text-luxury-gold-700 font-bold">
                          {pkg.badge || pkg.discountLabel || 'Annual Plan'}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                            Current Plan
                          </span>
                        )}
                      </div>
                      <h5 className="text-lg font-serif font-bold text-luxury-brown-950">{pkg.name}</h5>
                      <p className="text-[11px] text-luxury-brown-600">{pkg.tagline || pkg.roomTierLabel}</p>
                      <p className="text-2xl font-serif font-bold mt-2">
                        ₹{pkgPrice.toLocaleString('en-IN')} <span className="text-xs font-normal">/ Year</span>
                      </p>
                      <p className="text-[11px] font-mono text-luxury-brown-500">
                        + {pkgGst}% GST (Total ₹{pkgTotal.toLocaleString('en-IN')})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutPkgId(pkg.id);
                        setShowCheckoutModal(true);
                      }}
                      className={`w-full py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                        pkg.isPopular
                          ? 'bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 shadow-sm'
                          : 'bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white'
                      }`}
                    >
                      {isCurrent ? 'Renew Now (UPI / QR)' : `Upgrade to ${pkg.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {hotel?.renewalRequest?.status === 'Pending' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-amber-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  Payment Submitted • Pending Billing Verification
                </span>
                <p className="font-semibold text-luxury-brown-950">
                  Requested Plan: <strong>{hotel.renewalRequest.requestedPackageName}</strong> • Payable: ₹
                  {Number(hotel.renewalRequest.totalAmount || hotel.renewalRequest.requestedAmount || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] font-mono text-luxury-brown-600">
                  Mode: {hotel.renewalRequest.paymentMethod} • UTR: {hotel.renewalRequest.transactionReference || 'N/A'} • Submitted: {hotel.renewalRequest.requestedAt}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-200/70 text-amber-900 font-mono text-[10px] font-bold uppercase shrink-0">
                Pending Verification
              </span>
            </div>
          )}

          {/* Payment History Table */}
          {paymentHistory.length > 0 && (
            <div className="pt-4 border-t border-luxury-brown-100 space-y-3">
              <h4 className="text-sm font-serif font-bold text-luxury-brown-950">
                Membership Payment History ({paymentHistory.length})
              </h4>
              <div className="overflow-x-auto border border-luxury-brown-100 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-luxury-beige-50 border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-600">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Package</th>
                      <th className="py-2.5 px-4">Mode &amp; UTR</th>
                      <th className="py-2.5 px-4 text-right">Amount (Incl. GST)</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100">
                    {paymentHistory.map((pay) => (
                      <tr key={pay.id} className="hover:bg-luxury-beige-50/40">
                        <td className="py-2.5 px-4 font-mono text-[11px]">{pay.createdAt}</td>
                        <td className="py-2.5 px-4 font-semibold text-luxury-brown-950">{pay.packageName}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px]">
                          {pay.paymentMethod} {pay.utrNumber ? `(${pay.utrNumber})` : ''}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-right">
                          ₹{Number(pay.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              pay.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : pay.status === 'Pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {pay.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* WhatsApp Renewal & Billing Support */}
          <WhatsAppSupportWidget
            variant="banner"
            phone={whatsappPhone}
            context="renewal"
            hotelName={hotel?.name}
            packageName={activePackage.name}
          />

          {showCheckoutModal && (
            <MembershipRenewalCheckout
              hotel={hotel}
              packages={packages}
              systemWebsite={systemWebsite}
              initialPackageId={checkoutPkgId}
              requestedBy={hotel?.ownerName || hotel?.username || 'Hotel Owner'}
              onClose={() => setShowCheckoutModal(false)}
              onSubmitted={(reqObj) => {
                onUpdateHotel({ ...hotel, renewalRequest: reqObj });
                onAddAuditLog(
                  'Submitted Membership Renewal Payment',
                  `Submitted ${reqObj.requestedPackageName} renewal (UTR: ${reqObj.transactionReference}) for verification.`
                );
              }}
            />
          )}

          {/* Subscription Renewal Tax Invoices Table */}
          <div className="pt-4 border-t border-luxury-brown-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-serif font-bold text-luxury-brown-950">
                  SaaS Subscription Renewal Tax Invoices ({Array.isArray(hotel?.subscriptionInvoices) ? hotel.subscriptionInvoices.length : 0})
                </h4>
                <p className="text-[11px] text-luxury-brown-500">
                  Official GST tax invoices generated upon Super Admin approval of your membership renewals.
                </p>
              </div>
            </div>

            {Array.isArray(hotel?.subscriptionInvoices) && hotel.subscriptionInvoices.length > 0 ? (
              <div className="overflow-x-auto border border-luxury-brown-100 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-luxury-beige-50 border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-600">
                      <th className="py-3 px-4">Invoice No</th>
                      <th className="py-3 px-4">Selected Package</th>
                      <th className="py-3 px-4">Validity Period</th>
                      <th className="py-3 px-4">Payment Mode</th>
                      <th className="py-3 px-4 text-right">Total Paid</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100">
                    {hotel.subscriptionInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-luxury-beige-50/40">
                        <td className="py-3 px-4 font-mono font-bold text-luxury-brown-950">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-luxury-brown-950 block">{inv.packageName}</span>
                          <span className="text-[10px] font-mono text-luxury-gold-700">{inv.subscriptionPlan} • {inv.roomCapacityLabel}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-luxury-brown-700">
                          {inv.validFrom} → <strong className="text-emerald-700">{inv.validUntil}</strong>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {inv.paymentMethod}
                          {inv.transactionReference ? ` (${inv.transactionReference})` : ''}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-right text-emerald-700">
                          ₹{Number(inv.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setViewingSubInvoice(inv)}
                            className="px-3 py-1.5 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-mono text-[11px] font-bold rounded-xl cursor-pointer"
                          >
                            View / Print Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-luxury-beige-50/50 border border-luxury-brown-100 text-center text-xs text-luxury-brown-500">
                No subscription renewal invoices generated yet. Once Super Admin approves a renewal, your tax invoice will appear here.
              </div>
            )}
          </div>
        </div>
        );
      })()}

      <SubscriptionInvoiceModal
        invoice={viewingSubInvoice}
        onClose={() => setViewingSubInvoice(null)}
        businessName={systemWebsite?.businessName}
        supportPhone={systemWebsite?.supportPhone || DEFAULT_WHATSAPP_NUMBER}
        supportEmail={systemWebsite?.supportEmail}
        gstNumber={systemWebsite?.paymentSettings?.gstNumber}
        sacCode={systemWebsite?.paymentSettings?.sacCode}
      />

      {/* Membership Renewal Request Modal */}
      {showRenewRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-luxury-brown-200 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-8">
            <div className="bg-luxury-brown-950 text-white px-6 py-4 flex items-center justify-between border-b border-luxury-gold-500/20">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold-400 font-bold block">
                  DirectStay Membership Renewal
                </span>
                <h4 className="font-serif font-bold text-base text-luxury-beige-50">
                  Submit Renewal & Payment Details to Super Admin
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowRenewRequestModal(false)}
                className="text-luxury-brown-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRenewalRequestModal} className="p-6 space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-mono font-bold uppercase text-luxury-brown-700 block">
                  1. Select Membership Package & Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { cycle: 'Monthly' as const, label: 'Monthly Pack', price: 1899, days: 'Month' },
                    { cycle: 'HalfYearly' as const, label: 'Annual Offer', price: 5999, days: 'Year (50% OFF)' },
                    { cycle: 'Yearly' as const, label: 'Premium Pack', price: 17000, days: 'Year + OTA' },
                  ].map((opt) => (
                    <button
                      key={opt.cycle}
                      type="button"
                      onClick={() => {
                        setRenewPlanCycle(opt.cycle);
                        setRenewPkgName(opt.label);
                        setRenewBasePrice(opt.price);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer whitespace-normal ${
                        renewPlanCycle === opt.cycle
                          ? 'border-luxury-gold-500 bg-luxury-gold-500/15'
                          : 'border-luxury-brown-200 hover:bg-luxury-beige-50'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-luxury-gold-700 font-bold block">{opt.days}</span>
                      <span className="font-serif font-bold text-luxury-brown-950 block mt-0.5">{opt.label}</span>
                      <span className="font-mono font-bold text-emerald-700 block mt-1">
                        ₹{opt.price.toLocaleString('en-IN')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {packages.length > 0 && (
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block">
                    2. Package Tier Name
                  </label>
                  <select
                    value={renewPkgName}
                    onChange={(e) => setRenewPkgName(e.target.value)}
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2.5 font-semibold text-luxury-brown-950"
                  >
                    <option value="Monthly Pack">Monthly Pack (₹1,899 / Month)</option>
                    <option value="Annual Pack – Special Offer">Annual Pack – Special Offer (₹5,999 / Year)</option>
                    <option value="Premium Property Pack">Premium Property Pack (₹17,000 / Year)</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} (Up to {p.maxRooms} Rooms)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block">
                    Payment Mode *
                  </label>
                  <select
                    value={renewPaymentMode}
                    onChange={(e) => setRenewPaymentMode(e.target.value)}
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2.5"
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="Card / Online">Credit / Debit Card</option>
                    <option value="Cash">Cash Paid to Super Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-mono font-bold uppercase text-luxury-brown-700 block">
                    UTR / Payment Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={renewUtrRef}
                    onChange={(e) => setRenewUtrRef(e.target.value)}
                    placeholder="e.g. UTR92847102"
                    className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-luxury-beige-50 border border-luxury-brown-100 space-y-1.5 font-mono">
                <div className="flex justify-between text-luxury-brown-700">
                  <span>Base Package Amount ({renewPlanCycle}):</span>
                  <strong>₹{renewBasePrice.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between text-luxury-brown-600">
                  <span>GST @ 5% (2.5% CGST + 2.5% SGST):</span>
                  <span>₹{Math.round(renewBasePrice * 0.05).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-emerald-700 border-t border-luxury-brown-200 pt-1.5">
                  <span>Total Payable (Tax Invoice Amount):</span>
                  <span>₹{(renewBasePrice + Math.round(renewBasePrice * 0.05)).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenewRequestModal(false)}
                  className="px-4 py-2.5 border border-luxury-brown-200 rounded-xl text-luxury-brown-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRenewal}
                  className="px-5 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  {isSubmittingRenewal ? 'Sending Request...' : 'Send Renewal Request to Super Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. SECURITY AUDIT TRAIL */}
      {activeSubTab === 'auditLogs' && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6">
          <AuditLogsView auditLogs={auditLogs} hotelName={hotel?.name} />
        </div>
      )}

      {/* Owner Capital / Drawing Modal */}
      {showDrawingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-luxury-brown-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-luxury-brown-100 pb-3">
              <h4 className="font-serif font-bold text-base text-luxury-brown-950">
                Record Owner Capital / Drawing
              </h4>
              <button
                type="button"
                onClick={() => setShowDrawingModal(false)}
                className="text-luxury-brown-400 hover:text-luxury-brown-800"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddOwnerPayment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-luxury-brown-700 block">Transaction Type</label>
                <select
                  value={drawingType}
                  onChange={(e) => setDrawingType(e.target.value as OwnerDirectorPayment['type'])}
                  className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2.5"
                >
                  <option value="Profit Share / Drawing">Profit Share / Drawing</option>
                  <option value="Capital Injection">Capital Injection</option>
                  <option value="Director Salary">Director Salary</option>
                  <option value="Loan Repayment">Loan Repayment</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-luxury-brown-700 block">Amount (INR) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 25000"
                  value={drawingAmount}
                  onChange={(e) => setDrawingAmount(e.target.value)}
                  className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2.5 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-luxury-brown-700 block">Payment Mode</label>
                <select
                  value={drawingMethod}
                  onChange={(e) => setDrawingMethod(e.target.value as OwnerDirectorPayment['paymentMethod'])}
                  className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2.5"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-mono font-bold uppercase text-luxury-brown-700 block">Remarks / Reference</label>
                <input
                  type="text"
                  placeholder="Optional narration..."
                  value={drawingNotes}
                  onChange={(e) => setDrawingNotes(e.target.value)}
                  className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDrawingModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 rounded-xl text-luxury-brown-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-brown-950 text-luxury-gold-400 font-bold rounded-xl cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
