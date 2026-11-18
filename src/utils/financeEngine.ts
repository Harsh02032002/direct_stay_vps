import {
  Invoice,
  Expense,
  PosOrder,
  GuestCheckIn,
  Booking,
  PettyCashTransaction,
  CashBankAccount,
  FinanceVoucher,
  Vendor,
  OwnerDirectorPayment,
  StaffReimbursement,
  DailyClosingRecord,
  InventoryPurchase,
  InventorySupplier,
  AuditLog,
  UserRole,
} from '../types';

export type PaymentMethodBucket = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Cheque' | 'Petty Cash' | 'Other';

export interface UnifiedFinancialTransaction {
  id: string;
  hotelId: string;
  date: string;
  dateTime?: string;
  type:
    | 'Invoice Revenue'
    | 'Invoice Payment'
    | 'Advance Deposit'
    | 'POS Sale'
    | 'Guest Service Charge'
    | 'Other Income'
    | 'Expense Accrual'
    | 'Expense Payment'
    | 'Inventory Purchase'
    | 'Supplier Payment'
    | 'Staff Reimbursement'
    | 'Petty Cash Movement'
    | 'Owner Capital Contribution'
    | 'Owner Drawing';
  direction: 'Inflow' | 'Outflow' | 'Accrual (Non-Cash)';
  category: string;
  partyName: string;
  referenceNo: string;
  sourceType: string;
  sourceId: string;
  amount: number;
  taxAmount: number;
  paymentMethod: PaymentMethodBucket | 'Credit / Unpaid';
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Completed';
  notes?: string;
}

export interface ReceivableItem {
  id: string;
  sourceType: 'invoice' | 'inhouse_folio' | 'pos_credit';
  sourceId: string;
  invoiceReference: string;
  bookingId: string;
  guestName: string;
  guestMobile?: string;
  roomNumber: string;
  date: string;
  dueDate: string;
  originalAmount: number;
  amountPaid: number;
  outstandingAmount: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  ageDays: number;
  notes?: string;
}

export interface PayableItem {
  id: string;
  sourceType: 'expense' | 'inventory_purchase' | 'reimbursement' | 'vendor_opening';
  sourceId: string;
  referenceNumber: string;
  vendorId?: string;
  vendorName: string;
  category: string;
  date: string;
  dueDate: string;
  originalAmount: number;
  amountPaid: number;
  outstandingAmount: number;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  ageDays: number;
  notes?: string;
}

export interface TaxSlabSummary {
  rateLabel: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

export interface HotelFinancialSummary {
  hotelId: string;
  isolatedDemoRecordsCount: number;

  // 1. Revenue (Accrual Basis - Single Source of Truth)
  revenue: {
    roomRevenue: number;
    posDirectRevenue: number;
    posRoomChargedRevenue: number; // Included inside room invoices or active folios (not double-added)
    totalFnbRevenue: number;
    guestServicesRevenue: number;
    complimentaryServicesCount: number;
    complimentaryServicesValue: number; // Always 0 revenue impact, tracked for audit
    inHouseUninvoicedFolioRevenue: number;
    otherIncomeRevenue: number;
    totalRecognizedRevenue: number; // Excludes advance deposits not yet invoiced, excludes owner capital
    advanceDepositsHeld: number; // Liability (unearned deposit on active stays without invoice)
  };

  // 2. Expenses (Separated by Approval & Payment Lifecycle)
  expenses: {
    pendingApprovalCount: number;
    pendingApprovalAmount: number; // Does NOT reduce cash or count in approved operating expenses
    approvedUnpaidCount: number;
    approvedUnpaidAmount: number; // Counts in Accounts Payable & Operating Expenses, does NOT reduce cash
    approvedPaidCount: number;
    approvedPaidAmount: number; // Counts in Operating Expenses & Cash/Bank outflow
    rejectedCount: number;
    rejectedAmount: number;
    inventoryPurchasesTotal: number;
    inventoryPurchasesPaid: number;
    inventoryPurchasesUnpaid: number;
    reimbursementsApprovedTotal: number;
    reimbursementsPaid: number;
    reimbursementsUnpaid: number;
    totalOperatingExpensesAccrued: number; // Approved expenses + Inventory purchases + Approved reimbursements
    totalOperatingExpensesPaidCash: number; // Paid approved expenses + Paid inventory purchases + Paid reimbursements
    byCategory: Record<string, { accrued: number; paid: number; unpaid: number; count: number }>;
  };

  // 3. Operating Result / Profit vs Cash Flow
  profitability: {
    grossOperatingRevenue: number;
    totalOperatingExpensesAccrued: number;
    netOperatingIncomeAccrual: number; // Revenue - Accrued Operating Expenses (Profit)
    operatingProfitMarginPct: number;
    totalOperatingCashInflow: number; // Actual cash/bank collected from guests & POS
    totalOperatingCashOutflow: number; // Actual cash/bank paid for expenses & inventory
    netOperatingCashFlow: number; // Operating Cash Inflow - Operating Cash Outflow
  };

  // 4. Receivables & Payables
  receivables: {
    totalOriginal: number;
    totalCollected: number;
    totalOutstanding: number;
    openCount: number;
    overdueCount: number;
    items: ReceivableItem[];
  };

  payables: {
    totalOriginal: number;
    totalPaid: number;
    totalOutstanding: number;
    openCount: number;
    overdueCount: number;
    items: PayableItem[];
  };

  // 5. Cash & Bank (Separated Physical Cash vs Bank/Digital)
  cashAndBank: {
    physicalCashOpening: number;
    physicalCashInflow: number;
    physicalCashOutflow: number;
    physicalCashClosing: number; // Front Desk Cash + Petty Cash
    pettyCashBalance: number;
    bankOpening: number;
    bankInflow: number;
    bankOutflow: number;
    bankClosing: number; // UPI + Card + Bank Transfer + Cheque
    totalLiquidFunds: number; // Physical Cash + Bank Closing
    byMethod: Record<PaymentMethodBucket, { inflow: number; outflow: number; net: number }>;
    reconciliationDiscrepancies: Array<{
      accountId: string;
      accountName: string;
      accountType: string;
      computedBalance: number;
      recordedBalance: number;
      variance: number;
    }>;
  };

  // 6. Taxes & GST
  taxes: {
    outputGstInvoices: number;
    outputGstPosDirect: number;
    totalOutputGst: number;
    outputCgst: number;
    outputSgst: number;
    outputIgst: number;
    inputTaxCreditExpenses: number;
    inputTaxCreditPurchases: number;
    totalInputTaxCredit: number;
    netGstPayable: number;
    slabs: TaxSlabSummary[];
  };

  // 7. Owner Drawings & Capital (Excluded from Operating Revenue/Expense)
  ownerEquity: {
    capitalContributionsTotal: number;
    ownerDrawingsTotal: number;
    netOwnerCapitalMovement: number;
    entriesCount: number;
    entries: Array<OwnerDirectorPayment & { resolvedCategory: 'Capital Contribution' | 'Owner Drawing' }>;
  };

  // 8. Unified Ledger & Audit
  transactions: UnifiedFinancialTransaction[];
}

export function normalizePaymentMethod(rawMethod?: string, rawSource?: string): PaymentMethodBucket {
  const combined = `${rawMethod || ''} ${rawSource || ''}`.toLowerCase();
  if (combined.includes('petty')) return 'Petty Cash';
  if (combined.includes('upi') || combined.includes('gpay') || combined.includes('phonepe') || combined.includes('paytm') || combined.includes('qr')) {
    return 'UPI';
  }
  if (combined.includes('card') || combined.includes('pos machine') || combined.includes('visa') || combined.includes('mastercard')) {
    return 'Card';
  }
  if (combined.includes('cheque') || combined.includes('check') || combined.includes('dd')) {
    return 'Cheque';
  }
  if (combined.includes('bank') || combined.includes('neft') || combined.includes('rtgs') || combined.includes('imps') || combined.includes('online')) {
    return 'Bank Transfer';
  }
  if (combined.includes('cash')) {
    return 'Cash';
  }
  return 'Bank Transfer';
}

export function isCapitalContributionType(type?: string, category?: string): boolean {
  if (category === 'Capital Contribution') return true;
  if (category === 'Owner Drawing') return false;
  const t = (type || '').toLowerCase();
  return (
    t.includes('capital') ||
    t.includes('injection') ||
    t.includes('introduced') ||
    t.includes('loan in') ||
    t.includes('contribution')
  );
}

export function canRoleApproveExpense(role?: UserRole | string): boolean {
  return (
    role === 'SuperAdmin' ||
    role === 'Owner' ||
    role === 'Admin' ||
    role === 'Manager' ||
    role === 'Accounts'
  );
}

export function canRoleManageOwnerEquity(role?: UserRole | string): boolean {
  return (
    role === 'SuperAdmin' ||
    role === 'Owner' ||
    role === 'Admin' ||
    role === 'Accounts'
  );
}

function computeAgeDays(dateStr?: string): number {
  if (!dateStr) return 0;
  const parsed = new Date(dateStr).getTime();
  if (Number.isNaN(parsed)) return 0;
  const diff = Date.now() - parsed;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export interface ComputeFinanceInput {
  hotelId: string;
  invoices?: Invoice[];
  checkins?: GuestCheckIn[];
  bookings?: Booking[];
  posOrders?: PosOrder[];
  expenses?: Expense[];
  inventoryPurchases?: InventoryPurchase[];
  inventorySuppliers?: InventorySupplier[];
  pettyCash?: PettyCashTransaction[];
  cashBankAccounts?: CashBankAccount[];
  vouchers?: FinanceVoucher[];
  vendors?: Vendor[];
  ownerPayments?: OwnerDirectorPayment[];
  reimbursements?: StaffReimbursement[];
  dailyClosings?: DailyClosingRecord[];
  auditLogs?: AuditLog[];
}

export function computeHotelFinancialSummary(input: ComputeFinanceInput): HotelFinancialSummary {
  const hotelId = input.hotelId || 'hotel-1';
  let isolatedDemoRecordsCount = 0;

  const filterScope = <T extends { hotelId?: string; isDemoData?: boolean }>(items?: T[]): T[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => {
      if (!item) return false;
      if (!item.hotelId || item.hotelId !== hotelId) return false;
      if (item.isDemoData === true) {
        isolatedDemoRecordsCount += 1;
        return false;
      }
      return true;
    });
  };

  const invoices = filterScope(input.invoices);
  const checkins = filterScope(input.checkins);
  const bookings = filterScope(input.bookings);
  const posOrders = filterScope(input.posOrders);
  const expenses = filterScope(input.expenses);
  const inventoryPurchases = filterScope(input.inventoryPurchases);
  const pettyCash = filterScope(input.pettyCash);
  const cashBankAccounts = filterScope(input.cashBankAccounts);
  const vouchers = filterScope(input.vouchers);
  const vendors = filterScope(input.vendors);
  const ownerPayments = filterScope(input.ownerPayments);
  const reimbursements = filterScope(input.reimbursements);

  const byMethod: Record<PaymentMethodBucket, { inflow: number; outflow: number; net: number }> = {
    Cash: { inflow: 0, outflow: 0, net: 0 },
    UPI: { inflow: 0, outflow: 0, net: 0 },
    Card: { inflow: 0, outflow: 0, net: 0 },
    'Bank Transfer': { inflow: 0, outflow: 0, net: 0 },
    Cheque: { inflow: 0, outflow: 0, net: 0 },
    'Petty Cash': { inflow: 0, outflow: 0, net: 0 },
    Other: { inflow: 0, outflow: 0, net: 0 },
  };

  const addMethodInflow = (method: PaymentMethodBucket, amount: number) => {
    if (amount <= 0) return;
    byMethod[method].inflow += amount;
    byMethod[method].net = byMethod[method].inflow - byMethod[method].outflow;
  };

  const addMethodOutflow = (method: PaymentMethodBucket, amount: number) => {
    if (amount <= 0) return;
    byMethod[method].outflow += amount;
    byMethod[method].net = byMethod[method].inflow - byMethod[method].outflow;
  };

  const transactions: UnifiedFinancialTransaction[] = [];
  const receivableItems: ReceivableItem[] = [];
  const payableItems: PayableItem[] = [];

  // Track which bookings/check-ins already have finalized invoices to prevent double-counting
  const invoicedBookingIds = new Set<string>();
  const invoicedRoomNumbersWithFood = new Set<string>();

  let roomRevenue = 0;
  let invoicedFoodRevenue = 0;
  let guestServicesRevenue = 0;
  let complimentaryServicesCount = 0;
  let complimentaryServicesValue = 0;
  let otherIncomeRevenue = 0;
  let advanceDepositsHeld = 0;
  let inHouseUninvoicedFolioRevenue = 0;

  let outputGstInvoices = 0;
  let outputCgst = 0;
  let outputSgst = 0;
  let outputIgst = 0;

  const slabMap = new Map<string, TaxSlabSummary>();
  const recordTaxSlab = (ratePct: number, taxable: number, tax: number, isIgst = false) => {
    if (taxable <= 0 && tax <= 0) return;
    const key = `${ratePct}% GST`;
    const existing = slabMap.get(key) || {
      rateLabel: key,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
    };
    existing.taxableValue += Math.max(0, taxable);
    if (isIgst) {
      existing.igst += tax;
    } else {
      existing.cgst += tax / 2;
      existing.sgst += tax / 2;
    }
    existing.totalTax += tax;
    slabMap.set(key, existing);
  };

  // ---------------------------------------------------------------------------
  // 1. PROCESS INVOICES (Single Source of Truth for Invoiced Stays)
  // ---------------------------------------------------------------------------
  for (const inv of invoices) {
    if (inv.paymentStatus === 'Cancelled') continue;

    if (inv.bookingId) invoicedBookingIds.add(inv.bookingId);
    if (inv.checkInId) invoicedBookingIds.add(inv.checkInId);
    if ((inv as any).checkinId) invoicedBookingIds.add((inv as any).checkinId);
    if ((inv.foodCharges || 0) > 0 && inv.roomNumber) {
      invoicedRoomNumbersWithFood.add(`${inv.roomNumber}::${inv.bookingId || ''}`);
      invoicedRoomNumbersWithFood.add(inv.roomNumber);
    }

    const finalAmt = Math.max(0, Number(inv.finalAmount ?? inv.totalAmount ?? 0));
    const roomChg = Math.max(0, Number(inv.roomCharges || 0)) + Math.max(0, Number(inv.extraBedCharges || 0)) + Math.max(0, Number(inv.extraPersonCharges || 0));
    const foodChg = Math.max(0, Number(inv.foodCharges || 0));
    const serviceChg =
      Math.max(0, Number(inv.waterCharges || 0)) +
      Math.max(0, Number(inv.otherCharges || 0)) +
      Math.max(0, Number(inv.additionalCharges || 0)) +
      Math.max(0, Number(inv.serviceCharges || 0)) +
      Math.max(0, Number(inv.laundryCharges || 0));
    const gstAmt = Math.max(0, Number(inv.gst ?? (inv as any).tax ?? 0));
    const discountAmt = Math.max(0, Number(inv.discount || 0));

    // Reconcile component breakdown with finalAmount
    const rawParts = roomChg + foodChg + serviceChg + gstAmt - discountAmt;
    const adjustment = finalAmt - rawParts;
    roomRevenue += Math.max(0, roomChg + (adjustment > 0 && roomChg === 0 && foodChg === 0 && serviceChg === 0 ? adjustment : 0));
    invoicedFoodRevenue += foodChg;
    guestServicesRevenue += serviceChg;

    outputGstInvoices += gstAmt;
    if (inv.igst && inv.igst > 0) {
      outputIgst += Number(inv.igst);
      recordTaxSlab(inv.gstRate || 12, inv.subtotal || finalAmt - gstAmt, gstAmt, true);
    } else {
      const half = gstAmt / 2;
      outputCgst += Number(inv.cgst ?? half);
      outputSgst += Number(inv.sgst ?? half);
      recordTaxSlab(inv.gstRate || 12, inv.subtotal || finalAmt - gstAmt, gstAmt, false);
    }

    // Determine exact amount paid vs outstanding receivable (never double-counting advancePaid!)
    let paidAmt = 0;
    if (inv.amountPaid !== undefined && inv.amountPaid !== null) {
      paidAmt = Math.min(finalAmt, Math.max(0, Number(inv.amountPaid)));
    } else if (inv.isPaid || inv.paymentStatus === 'Paid') {
      paidAmt = finalAmt;
    } else if (inv.pendingAmount !== undefined && inv.pendingAmount !== null) {
      paidAmt = Math.min(finalAmt, Math.max(0, finalAmt - Number(inv.pendingAmount)));
    } else if (inv.advancePaid !== undefined && inv.advancePaid !== null) {
      paidAmt = Math.min(finalAmt, Math.max(0, Number(inv.advancePaid)));
    }

    const outstandingAmt = Math.max(0, Number((finalAmt - paidAmt).toFixed(2)));
    const resolvedStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
      outstandingAmt <= 0.01 ? 'Paid' : paidAmt > 0 ? 'Partially Paid' : 'Unpaid';

    const invDate = (inv.dateCreated || inv.date || inv.checkOutDate || new Date().toISOString()).slice(0, 10);
    const dueDate = inv.dueDate || inv.checkOutDate || invDate;

    receivableItems.push({
      id: `AR-INV-${inv.id}`,
      sourceType: 'invoice',
      sourceId: inv.id,
      invoiceReference: inv.invoiceNumber || inv.id,
      bookingId: inv.bookingId || '',
      guestName: inv.guestName || 'Guest',
      guestMobile: inv.guestMobile,
      roomNumber: inv.roomNumber || '-',
      date: invDate,
      dueDate,
      originalAmount: finalAmt,
      amountPaid: paidAmt,
      outstandingAmount: outstandingAmt,
      status: resolvedStatus,
      ageDays: resolvedStatus === 'Paid' ? 0 : computeAgeDays(dueDate),
      notes: inv.notes,
    });

    // Record Revenue Accrual transaction
    transactions.push({
      id: `TX-REV-INV-${inv.id}`,
      hotelId,
      date: invDate,
      type: 'Invoice Revenue',
      direction: 'Accrual (Non-Cash)',
      category: 'Room & Stay Invoice',
      partyName: `${inv.guestName} (Room ${inv.roomNumber})`,
      referenceNo: inv.invoiceNumber || inv.id,
      sourceType: 'invoice',
      sourceId: inv.id,
      amount: finalAmt,
      taxAmount: gstAmt,
      paymentMethod: resolvedStatus === 'Paid' ? normalizePaymentMethod(inv.paymentMethod) : 'Credit / Unpaid',
      status: resolvedStatus,
      notes: `Room: ₹${roomChg}, F&B: ₹${foodChg}, Services: ₹${serviceChg}, GST: ₹${gstAmt}`,
    });

    // Record actual Cash/Bank payment inflows for this invoice (using paymentHistory if present, else paidAmt)
    if (Array.isArray(inv.paymentHistory) && inv.paymentHistory.length > 0) {
      let historySum = 0;
      inv.paymentHistory.forEach((ph, idx) => {
        const phAmt = Math.max(0, Number(ph.amount || 0));
        if (phAmt <= 0) return;
        historySum += phAmt;
        const mBucket = normalizePaymentMethod(ph.paymentMethod);
        addMethodInflow(mBucket, phAmt);
        transactions.push({
          id: `TX-PAY-INV-${inv.id}-${ph.id || idx}`,
          hotelId,
          date: (ph.date || invDate).slice(0, 10),
          type: 'Invoice Payment',
          direction: 'Inflow',
          category: 'Invoice Settlement',
          partyName: inv.guestName,
          referenceNo: ph.referenceNo || inv.invoiceNumber || inv.id,
          sourceType: 'invoice_payment',
          sourceId: inv.id,
          amount: phAmt,
          taxAmount: 0,
          paymentMethod: mBucket,
          status: 'Paid',
          notes: ph.notes || `Payment against Invoice ${inv.invoiceNumber || inv.id}`,
        });
      });
      // If paidAmt exceeds paymentHistory sum (e.g. advancePaid at check-in prior to history), attribute remainder once
      const remainderPaid = Math.max(0, paidAmt - historySum);
      if (remainderPaid > 0.01) {
        const mBucket = normalizePaymentMethod(inv.paymentMethod || 'Cash');
        addMethodInflow(mBucket, remainderPaid);
        transactions.push({
          id: `TX-PAY-INV-REM-${inv.id}`,
          hotelId,
          date: invDate,
          type: 'Invoice Payment',
          direction: 'Inflow',
          category: 'Advance / Settlement Applied',
          partyName: inv.guestName,
          referenceNo: inv.invoiceNumber || inv.id,
          sourceType: 'invoice',
          sourceId: inv.id,
          amount: remainderPaid,
          taxAmount: 0,
          paymentMethod: mBucket,
          status: 'Paid',
          notes: `Settled portion on Invoice ${inv.invoiceNumber || inv.id}`,
        });
      }
    } else if (paidAmt > 0) {
      // Check if linked check-in has explicit cashAmountPaid / onlineAmountPaid breakdown
      const linkedCheckin = checkins.find((c) => c.id === inv.bookingId || c.id === inv.checkInId || c.id === (inv as any).checkinId);
      if (linkedCheckin && !inv.isPaid && paidAmt === Number(linkedCheckin.advanceAmount || 0)) {
        const cashPart = Math.max(0, Number(linkedCheckin.cashAmountPaid || 0));
        const onlinePart = Math.max(0, Number(linkedCheckin.onlineAmountPaid || 0));
        if (cashPart + onlinePart === paidAmt && (cashPart > 0 || onlinePart > 0)) {
          if (cashPart > 0) addMethodInflow('Cash', cashPart);
          if (onlinePart > 0) addMethodInflow('UPI', onlinePart);
        } else {
          addMethodInflow(normalizePaymentMethod(inv.paymentMethod || 'Cash'), paidAmt);
        }
      } else {
        const mBucket = normalizePaymentMethod(inv.paymentMethod || 'Cash');
        addMethodInflow(mBucket, paidAmt);
      }

      transactions.push({
        id: `TX-PAY-INV-${inv.id}`,
        hotelId,
        date: invDate,
        type: 'Invoice Payment',
        direction: 'Inflow',
        category: 'Guest Invoice Receipt',
        partyName: inv.guestName,
        referenceNo: inv.invoiceNumber || inv.id,
        sourceType: 'invoice',
        sourceId: inv.id,
        amount: paidAmt,
        taxAmount: 0,
        paymentMethod: normalizePaymentMethod(inv.paymentMethod || 'Cash'),
        status: resolvedStatus,
        notes:
          resolvedStatus === 'Partially Paid'
            ? `Partial settlement (₹${outstandingAmt} pending)`
            : `Full settlement for Invoice ${inv.invoiceNumber || inv.id}`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. PROCESS CHECK-INS & GUEST SERVICES (Avoid duplicating invoiced stays!)
  // ---------------------------------------------------------------------------
  const folioPosOrderIds = new Set<string>();

  for (const chk of checkins) {
    const isAlreadyInvoiced = invoicedBookingIds.has(chk.id);
    const countedFolioServiceIds = new Set<string>();

    // Inspect allocated guest services on the check-in
    if (Array.isArray(chk.allocatedServices)) {
      for (const svc of chk.allocatedServices) {
        if (svc.id) {
          countedFolioServiceIds.add(svc.id);
          countedFolioServiceIds.add(svc.id.replace(/^ALLOC-(WB|SRV|LND)-/, ''));
        }
        if (!svc.isChargeable || Number(svc.chargedAmount || 0) <= 0) {
          complimentaryServicesCount += 1;
          complimentaryServicesValue += Math.max(0, Number(svc.configuredAmount ?? (svc as any).defaultAmount ?? 0));
        } else if (!isAlreadyInvoiced) {
          // If the stay is NOT yet invoiced, track chargeable service under in-house folio revenue
          const svcAmt = Math.max(0, Number(svc.chargedAmount || 0));
          guestServicesRevenue += svcAmt;
          inHouseUninvoicedFolioRevenue += svcAmt;
          transactions.push({
            id: `TX-SVC-${svc.id}`,
            hotelId,
            date: (svc.dateTime || (svc as any).allocatedAt || chk.checkInDate || new Date().toISOString()).slice(0, 10),
            type: 'Guest Service Charge',
            direction: 'Accrual (Non-Cash)',
            category: 'Guest Services',
            partyName: `${chk.guestName} (Room ${chk.roomNumber})`,
            referenceNo: svc.id,
            sourceType: 'guest_service',
            sourceId: svc.id,
            amount: svcAmt,
            taxAmount: 0,
            paymentMethod: 'Credit / Unpaid',
            status: 'Unpaid',
            notes: `${svc.serviceName} allocated to Room ${chk.roomNumber} (In-House Folio)`,
          });
        }
      }
    }

    // Inspect extraCharges on the check-in (e.g., Room-Billed Laundry EC-LND-*, POS Room Charge EC-POS-*, Water Bottle EC-WB-*)
    if (Array.isArray(chk.extraCharges)) {
      const seenExtraIds = new Set<string>();
      for (const ec of chk.extraCharges) {
        if (!ec) continue;
        const ecKey = ec.sourceType && ec.sourceId ? `${ec.sourceType}:${ec.sourceId}` : ec.id;
        if (ecKey && seenExtraIds.has(ecKey)) continue;
        if (ecKey) seenExtraIds.add(ecKey);

        if (ec.sourceType === 'pos_order' && ec.sourceId) {
          folioPosOrderIds.add(ec.sourceId);
          // POS Room Charge revenue is processed once in section 3 (PROCESS POS ORDERS)
          continue;
        }

        const ecAmt = Math.max(0, Number(ec.amount || 0));
        if (ecAmt <= 0 || isAlreadyInvoiced) continue;

        // Skip if already counted via chk.allocatedServices (such as ALLOC-WB-* or ALLOC-SRV-*)
        if (
          (ec.sourceId && countedFolioServiceIds.has(ec.sourceId)) ||
          (ec.id && countedFolioServiceIds.has(ec.id)) ||
          (ec.id && countedFolioServiceIds.has(ec.id.replace(/^EC-(WB|SRV|LND)-/, '')))
        ) {
          continue;
        }

        guestServicesRevenue += ecAmt;
        inHouseUninvoicedFolioRevenue += ecAmt;
        transactions.push({
          id: `TX-EC-${ec.id || ec.sourceId}`,
          hotelId,
          date: ((ec as any).date || chk.checkInDate || new Date().toISOString()).slice(0, 10),
          type: 'Guest Service Charge',
          direction: 'Accrual (Non-Cash)',
          category: ec.sourceType === 'laundry_order' ? 'Laundry Service' : 'Guest Services',
          partyName: `${chk.guestName} (Room ${chk.roomNumber})`,
          referenceNo: ec.sourceId || ec.id,
          sourceType: 'guest_service',
          sourceId: ec.sourceId || ec.id,
          amount: ecAmt,
          taxAmount: 0,
          paymentMethod: 'Credit / Unpaid',
          status: 'Unpaid',
          notes: `${ec.description || 'Extra room charge'} on Room ${chk.roomNumber} (In-House Folio)`,
        });
      }
    }

    // If the check-in is NOT yet invoiced, handle advance deposits & in-house folio receivables
    if (!isAlreadyInvoiced) {
      const advAmt = Math.max(0, Number(chk.advanceAmount || 0));
      if (advAmt > 0) {
        advanceDepositsHeld += advAmt;
        const cashPart = Math.max(0, Number(chk.cashAmountPaid || 0));
        const onlinePart = Math.max(0, Number(chk.onlineAmountPaid || 0));
        if (cashPart + onlinePart === advAmt && (cashPart > 0 || onlinePart > 0)) {
          if (cashPart > 0) addMethodInflow('Cash', cashPart);
          if (onlinePart > 0) addMethodInflow('UPI', onlinePart);
        } else {
          addMethodInflow('Cash', advAmt);
        }
        transactions.push({
          id: `TX-ADV-CHK-${chk.id}`,
          hotelId,
          date: (chk.checkInDate || new Date().toISOString()).slice(0, 10),
          type: 'Advance Deposit',
          direction: 'Inflow',
          category: 'Guest Advance Deposit (Unearned)',
          partyName: `${chk.guestName} (Room ${chk.roomNumber})`,
          referenceNo: chk.id,
          sourceType: 'checkin_advance',
          sourceId: chk.id,
          amount: advAmt,
          taxAmount: 0,
          paymentMethod: onlinePart > cashPart ? 'UPI' : 'Cash',
          status: 'Paid',
          notes: `Advance deposit held prior to checkout invoice`,
        });
      }

      // Active in-house folio receivable (pending dues on uninvoiced active stay)
      const pendingFolio = Math.max(0, Number(chk.pendingAmount || 0));
      if (!chk.checkedOutDateTime && !chk.checkedOutBy && pendingFolio > 0) {
        const origFolio = Math.max(pendingFolio + advAmt, Number(chk.totalAmount || 0));
        receivableItems.push({
          id: `AR-CHK-${chk.id}`,
          sourceType: 'inhouse_folio',
          sourceId: chk.id,
          invoiceReference: `FOLIO-${chk.roomNumber}-${chk.id}`,
          bookingId: chk.id,
          guestName: chk.guestName,
          guestMobile: chk.mobile,
          roomNumber: chk.roomNumber,
          date: (chk.checkInDate || new Date().toISOString()).slice(0, 10),
          dueDate: (chk.checkOutDate || chk.checkInDate || new Date().toISOString()).slice(0, 10),
          originalAmount: origFolio,
          amountPaid: advAmt,
          outstandingAmount: pendingFolio,
          status: advAmt > 0 ? 'Partially Paid' : 'Unpaid',
          ageDays: computeAgeDays(chk.checkOutDate || chk.checkInDate),
          notes: 'Active In-House Guest Folio (Awaiting Checkout Invoice)',
        });
      }
    }
  }

  // Also check standalone advance bookings that have not checked in or been invoiced yet
  for (const bk of bookings) {
    const bkSt = String(bk.status || '');
    if (bkSt === 'Cancelled' || bkSt === 'Checked In' || bkSt === 'CheckedIn' || bkSt === 'CheckedOut') continue;
    if (invoicedBookingIds.has(bk.id)) continue;
    if (checkins.some((c) => c.id === bk.id)) continue;
    const adv = Math.max(0, Number(bk.advanceAmount ?? (bk as any).advancePaid ?? 0));
    if (adv > 0) {
      advanceDepositsHeld += adv;
      const mBucket = normalizePaymentMethod(bk.paymentMethod || 'UPI');
      addMethodInflow(mBucket, adv);
      transactions.push({
        id: `TX-ADV-BK-${bk.id}`,
        hotelId,
        date: (bk.checkInDate || new Date().toISOString()).slice(0, 10),
        type: 'Advance Deposit',
        direction: 'Inflow',
        category: 'Reservation Advance Deposit',
        partyName: bk.guestName,
        referenceNo: bk.id,
        sourceType: 'booking_advance',
        sourceId: bk.id,
        amount: adv,
        taxAmount: 0,
        paymentMethod: mBucket,
        status: 'Paid',
        notes: `Advance on reservation for Room ${bk.roomNumber}`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. PROCESS POS ORDERS (Deduplicating Room-Charged Orders Included on Invoices)
  // ---------------------------------------------------------------------------
  let posDirectRevenue = 0;
  let posRoomChargedRevenue = 0;
  let outputGstPosDirect = 0;

  for (const order of posOrders) {
    if (order.status === 'Cancelled' || order.isHeld) continue;

    const grandTotal = Math.max(0, Number(order.grandTotal || 0));
    const taxAmt = Math.max(
      0,
      Number(order.taxAmount ?? ((Number((order as any).cgst || 0) + Number((order as any).sgst || 0)) || 0))
    );
    const netPosSubtotal = Math.max(0, Number(order.subtotal ?? (grandTotal - taxAmt)));
    if (grandTotal <= 0) continue;

    const rawPosPayMethod = order.paymentMethod || (order as any).paymentMode || '';
    const orderDate = (order.date || (order as any).createdAt || new Date().toISOString()).slice(0, 10);

    const isRoomCharge =
      rawPosPayMethod === 'Room Charge' ||
      order.orderType === 'Room Charge' ||
      (order.status as string) === 'Charged to Room' ||
      Boolean((order as any).postedToRoomBill) ||
      Boolean(order.linkedInvoiceId) ||
      folioPosOrderIds.has(order.id) ||
      (order.orderType === 'Room Service' &&
        Boolean(order.roomNumber) &&
        (order.paymentStatus === 'Unpaid' ||
          (order.paymentStatus as string) === 'Pending' ||
          invoicedRoomNumbersWithFood.has(order.roomNumber)));

    if (isRoomCharge) {
      // Tracked for visibility, but NOT added a second time on top of Invoice foodCharges!
      posRoomChargedRevenue += netPosSubtotal;
      const isCoveredByInvoice =
        (order.linkedInvoiceId && invoices.some((i) => i.id === order.linkedInvoiceId)) ||
        (order.checkInId && invoicedBookingIds.has(order.checkInId)) ||
        (order.roomNumber && invoicedRoomNumbersWithFood.has(order.roomNumber));

      if (!isCoveredByInvoice) {
        // Guest is still in-house (no checkout invoice with foodCharges yet)
        inHouseUninvoicedFolioRevenue += netPosSubtotal;
        // Only push standalone AR-POS-RM receivable if NOT already included in active stay's AR-CHK pendingAmount
        if (!folioPosOrderIds.has(order.id)) {
          receivableItems.push({
            id: `AR-POS-RM-${order.id}`,
            sourceType: 'inhouse_folio',
            sourceId: order.id,
            invoiceReference: order.orderNumber || order.id,
            bookingId: order.checkInId || (order as any).guestId || '',
            guestName: order.guestName || `Room ${order.roomNumber} Guest`,
            roomNumber: order.roomNumber || '-',
            date: orderDate,
            dueDate: orderDate,
            originalAmount: grandTotal,
            amountPaid: 0,
            outstandingAmount: grandTotal,
            status: 'Unpaid',
            ageDays: computeAgeDays(orderDate),
            notes: `Room-charged POS order awaiting checkout invoice`,
          });
        }
      }
      continue;
    }

    // Direct POS order (not charged to a room folio)
    posDirectRevenue += netPosSubtotal;
    outputGstPosDirect += taxAmt;
    outputCgst += taxAmt / 2;
    outputSgst += taxAmt / 2;
    recordTaxSlab(5, netPosSubtotal, taxAmt, false);

    if (order.paymentStatus === 'Paid') {
      const mBucket = normalizePaymentMethod(rawPosPayMethod);
      addMethodInflow(mBucket, grandTotal);
      transactions.push({
        id: `TX-POS-${order.id}`,
        hotelId,
        date: orderDate,
        type: 'POS Sale',
        direction: 'Inflow',
        category: `POS (${order.orderType})`,
        partyName: order.guestName || (order.tableNo ? `Table ${order.tableNo}` : 'Walk-in Diner'),
        referenceNo: order.orderNumber || order.id,
        sourceType: 'pos_order',
        sourceId: order.id,
        amount: grandTotal,
        taxAmount: taxAmt,
        paymentMethod: mBucket,
        status: 'Paid',
        notes: `${order.items?.length || 0} items settled via ${rawPosPayMethod}`,
      });
    } else {
      // Unpaid direct POS bill (e.g. Credit customer)
      receivableItems.push({
        id: `AR-POS-${order.id}`,
        sourceType: 'pos_credit',
        sourceId: order.id,
        invoiceReference: order.orderNumber || order.id,
        bookingId: '',
        guestName: order.guestName || 'POS Credit Customer',
        guestMobile: order.customerPhone,
        roomNumber: order.roomNumber || '-',
        date: order.date,
        dueDate: order.date,
        originalAmount: grandTotal,
        amountPaid: 0,
        outstandingAmount: grandTotal,
        status: 'Unpaid',
        ageDays: computeAgeDays(order.date),
        notes: `Unpaid POS Order (${order.orderType})`,
      });
      transactions.push({
        id: `TX-POS-UNPAID-${order.id}`,
        hotelId,
        date: order.date,
        type: 'POS Sale',
        direction: 'Accrual (Non-Cash)',
        category: `POS (${order.orderType})`,
        partyName: order.guestName || 'POS Credit Customer',
        referenceNo: order.orderNumber || order.id,
        sourceType: 'pos_order',
        sourceId: order.id,
        amount: grandTotal,
        taxAmount: taxAmt,
        paymentMethod: 'Credit / Unpaid',
        status: 'Unpaid',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4. PROCESS STANDALONE RECEIPT VOUCHERS (Exclude invoice/equity duplicates)
  // ---------------------------------------------------------------------------
  const invoiceIdsAndNums = new Set<string>();
  invoices.forEach((i) => {
    invoiceIdsAndNums.add(i.id);
    if (i.invoiceNumber) invoiceIdsAndNums.add(i.invoiceNumber);
  });

  for (const v of vouchers) {
    if (v.status === 'Cancelled' || v.status === 'Pending Approval') continue;
    if (v.voucherType === 'Receipt Voucher') {
      // Skip if this receipt voucher is linked to an already-counted invoice or owner capital entry
      if (
        v.sourceType === 'invoice' ||
        v.sourceType === 'owner_equity' ||
        (v.sourceId && invoiceIdsAndNums.has(v.sourceId)) ||
        (v.referenceNo && invoiceIdsAndNums.has(v.referenceNo))
      ) {
        continue;
      }
      const amt = Math.max(0, Number(v.amount || 0));
      if (amt <= 0) continue;
      otherIncomeRevenue += amt;
      const mBucket = normalizePaymentMethod(v.paymentMethod, v.accountName);
      addMethodInflow(mBucket, amt);
      transactions.push({
        id: `TX-RV-${v.id}`,
        hotelId,
        date: v.date,
        type: 'Other Income',
        direction: 'Inflow',
        category: v.category || 'Miscellaneous Income',
        partyName: v.partyName,
        referenceNo: v.voucherNumber || v.id,
        sourceType: 'voucher',
        sourceId: v.id,
        amount: amt,
        taxAmount: Number(v.taxAmount || 0),
        paymentMethod: mBucket,
        status: 'Paid',
        notes: v.narration,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. PROCESS EXPENSES (Strict Separation: Pending -> Approved -> Paid)
  // ---------------------------------------------------------------------------
  let pendingApprovalCount = 0;
  let pendingApprovalAmount = 0;
  let approvedUnpaidCount = 0;
  let approvedUnpaidAmount = 0;
  let approvedPaidCount = 0;
  let approvedPaidAmount = 0;
  let rejectedCount = 0;
  let rejectedAmount = 0;
  let inputTaxCreditExpenses = 0;

  const expensesByCategory: Record<string, { accrued: number; paid: number; unpaid: number; count: number }> = {};
  const recordCategoryExpense = (cat: string, accrued: number, paid: number, unpaid: number) => {
    const key = cat || 'Miscellaneous';
    if (!expensesByCategory[key]) {
      expensesByCategory[key] = { accrued: 0, paid: 0, unpaid: 0, count: 0 };
    }
    expensesByCategory[key].accrued += accrued;
    expensesByCategory[key].paid += paid;
    expensesByCategory[key].unpaid += unpaid;
    expensesByCategory[key].count += 1;
  };

  const canonicalPurchaseIds = new Set<string>(inventoryPurchases.map((p) => p.id));

  for (const exp of expenses) {
    // If this expense is a mirrored copy of an existing InventoryPurchase record, skip here so the canonical purchase record is processed once
    if (exp.sourceType === 'inventory_purchase' && exp.sourceId && canonicalPurchaseIds.has(exp.sourceId)) {
      continue;
    }

    const totalAmt = Math.max(0, Number(exp.amount || 0));
    if (totalAmt <= 0) continue;

    const approval = (exp.approvalStatus || exp.status || 'Approved') as 'Pending' | 'Approved' | 'Rejected';
    const rawPayStatus = (exp.paymentStatus || 'Unpaid').toLowerCase();
    const isMarkedPaid = rawPayStatus === 'paid';
    const isPartPaid = rawPayStatus === 'partial' || rawPayStatus === 'partially paid';

    if (approval === 'Rejected') {
      rejectedCount += 1;
      rejectedAmount += totalAmt;
      continue;
    }

    if (approval === 'Pending') {
      // Rule 8: Pending expense does NOT reduce cash and is NOT an approved payable yet
      pendingApprovalCount += 1;
      pendingApprovalAmount += totalAmt;
      transactions.push({
        id: `TX-EXP-PEND-${exp.id}`,
        hotelId,
        date: exp.date,
        type: 'Expense Accrual',
        direction: 'Accrual (Non-Cash)',
        category: exp.category,
        partyName: exp.vendorName || exp.department || 'Staff / Vendor',
        referenceNo: exp.expenseNo || exp.id,
        sourceType: 'expense',
        sourceId: exp.id,
        amount: totalAmt,
        taxAmount: Number(exp.taxAmount ?? exp.gstAmount ?? 0),
        paymentMethod: 'Credit / Unpaid',
        status: 'Pending Approval',
        notes: exp.description,
      });
      continue;
    }

    // Approved Expense!
    const taxAmt = Math.max(0, Number(exp.taxAmount ?? exp.gstAmount ?? 0));
    inputTaxCreditExpenses += taxAmt;

    let paidAmt = 0;
    if (isMarkedPaid) {
      paidAmt = totalAmt;
    } else if (isPartPaid || (exp.amountPaid !== undefined && Number(exp.amountPaid) > 0)) {
      paidAmt = Math.min(totalAmt, Math.max(0, Number(exp.amountPaid || 0)));
    }

    const unpaidAmt = Math.max(0, Number((totalAmt - paidAmt).toFixed(2)));
    const resolvedPayStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
      unpaidAmt <= 0.01 ? 'Paid' : paidAmt > 0 ? 'Partially Paid' : 'Unpaid';

    recordCategoryExpense(exp.category, totalAmt, paidAmt, unpaidAmt);

    if (unpaidAmt > 0) {
      // Rule 9: Approved unpaid expense appears in Accounts Payable, NOT cash outflow
      approvedUnpaidCount += 1;
      approvedUnpaidAmount += unpaidAmt;
    }
    if (paidAmt > 0) {
      // Rule 10: Paid expense updates cash/bank and clears payable
      approvedPaidCount += 1;
      approvedPaidAmount += paidAmt;
      const mBucket = normalizePaymentMethod(exp.paymentMethod, exp.paymentSource);
      addMethodOutflow(mBucket, paidAmt);
      transactions.push({
        id: `TX-EXP-PAID-${exp.id}`,
        hotelId,
        date: exp.paidDate || exp.date,
        type: 'Expense Payment',
        direction: 'Outflow',
        category: exp.category,
        partyName: exp.vendorName || exp.department || 'Vendor',
        referenceNo: exp.paymentReference || exp.expenseNo || exp.id,
        sourceType: 'expense',
        sourceId: exp.id,
        amount: paidAmt,
        taxAmount: taxAmt,
        paymentMethod: mBucket,
        status: resolvedPayStatus,
        notes: exp.description,
      });
    } else {
      transactions.push({
        id: `TX-EXP-APPR-${exp.id}`,
        hotelId,
        date: exp.date,
        type: 'Expense Accrual',
        direction: 'Accrual (Non-Cash)',
        category: exp.category,
        partyName: exp.vendorName || exp.department || 'Vendor',
        referenceNo: exp.expenseNo || exp.id,
        sourceType: 'expense',
        sourceId: exp.id,
        amount: totalAmt,
        taxAmount: taxAmt,
        paymentMethod: 'Credit / Unpaid',
        status: 'Unpaid',
        notes: `${exp.description} (Approved - Awaiting Payment)`,
      });
    }

    payableItems.push({
      id: `AP-EXP-${exp.id}`,
      sourceType: 'expense',
      sourceId: exp.id,
      referenceNumber: exp.invoiceReference || exp.expenseNo || exp.id,
      vendorId: exp.vendorId,
      vendorName: exp.vendorName || exp.department || 'Operational Vendor',
      category: exp.category,
      date: exp.date,
      dueDate: exp.dueDate || exp.date,
      originalAmount: totalAmt,
      amountPaid: paidAmt,
      outstandingAmount: unpaidAmt,
      approvalStatus: 'Approved',
      status: resolvedPayStatus,
      ageDays: resolvedPayStatus === 'Paid' ? 0 : computeAgeDays(exp.dueDate || exp.date),
      notes: exp.description,
    });
  }

  // ---------------------------------------------------------------------------
  // 6. PROCESS INVENTORY PURCHASES (Rule 11: Supplier Payable / Expense without duplication)
  // ---------------------------------------------------------------------------
  let inventoryPurchasesTotal = 0;
  let inventoryPurchasesPaid = 0;
  let inventoryPurchasesUnpaid = 0;
  let inputTaxCreditPurchases = 0;

  for (const pur of inventoryPurchases) {
    const grandTotal = Math.max(0, Number(pur.grandTotal || 0));
    if (grandTotal <= 0) continue;

    const taxAmt = Math.max(0, Number(pur.taxAmount ?? (pur as any).taxTotal ?? 0));
    const purRef = pur.purchaseNumber || (pur as any).invoiceNumber || pur.id;
    const purDate = (pur.date || (pur as any).purchaseDate || new Date().toISOString()).slice(0, 10);
    inputTaxCreditPurchases += taxAmt;
    inventoryPurchasesTotal += grandTotal;

    const rawPayStatus = (pur.paymentStatus || 'Unpaid').toLowerCase();
    let paidAmt = 0;
    if (rawPayStatus === 'paid') {
      paidAmt = grandTotal;
    } else if (pur.amountPaid !== undefined && Number(pur.amountPaid) > 0) {
      paidAmt = Math.min(grandTotal, Math.max(0, Number(pur.amountPaid)));
    }

    const unpaidAmt = Math.max(0, Number((grandTotal - paidAmt).toFixed(2)));
    const resolvedPayStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
      unpaidAmt <= 0.01 ? 'Paid' : paidAmt > 0 ? 'Partially Paid' : 'Unpaid';

    inventoryPurchasesPaid += paidAmt;
    inventoryPurchasesUnpaid += unpaidAmt;
    recordCategoryExpense('Inventory Purchases', grandTotal, paidAmt, unpaidAmt);

    payableItems.push({
      id: `AP-PUR-${pur.id}`,
      sourceType: 'inventory_purchase',
      sourceId: pur.id,
      referenceNumber: purRef,
      vendorId: pur.supplierId,
      vendorName: pur.supplierName || 'Inventory Supplier',
      category: 'Inventory Purchases',
      date: purDate,
      dueDate: pur.dueDate || purDate,
      originalAmount: grandTotal,
      amountPaid: paidAmt,
      outstandingAmount: unpaidAmt,
      approvalStatus: 'Approved',
      status: resolvedPayStatus,
      ageDays: resolvedPayStatus === 'Paid' ? 0 : computeAgeDays(pur.dueDate || purDate),
      notes: pur.notes || `${pur.items?.length || 0} stock items purchased`,
    });

    if (paidAmt > 0) {
      const mBucket = normalizePaymentMethod(pur.paymentMethod || 'Bank Transfer');
      addMethodOutflow(mBucket, paidAmt);
      transactions.push({
        id: `TX-PUR-PAID-${pur.id}`,
        hotelId,
        date: pur.paidDate || purDate,
        type: 'Supplier Payment',
        direction: 'Outflow',
        category: 'Inventory Purchases',
        partyName: pur.supplierName || 'Supplier',
        referenceNo: pur.paymentReference || purRef,
        sourceType: 'inventory_purchase',
        sourceId: pur.id,
        amount: paidAmt,
        taxAmount: taxAmt,
        paymentMethod: mBucket,
        status: resolvedPayStatus,
        notes: `Inventory Purchase ${purRef}`,
      });
    } else {
      transactions.push({
        id: `TX-PUR-ACC-${pur.id}`,
        hotelId,
        date: purDate,
        type: 'Inventory Purchase',
        direction: 'Accrual (Non-Cash)',
        category: 'Inventory Purchases',
        partyName: pur.supplierName || 'Supplier',
        referenceNo: purRef,
        sourceType: 'inventory_purchase',
        sourceId: pur.id,
        amount: grandTotal,
        taxAmount: taxAmt,
        paymentMethod: 'Credit / Unpaid',
        status: 'Unpaid',
        notes: `Supplier bill payable (${pur.items?.length || 0} items)`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. PROCESS STAFF REIMBURSEMENTS & VENDOR OPENING BALANCES
  // ---------------------------------------------------------------------------
  let reimbursementsApprovedTotal = 0;
  let reimbursementsPaid = 0;
  let reimbursementsUnpaid = 0;

  for (const rmb of reimbursements) {
    if (rmb.status === 'Rejected' || rmb.status === 'Pending') continue;
    const amt = Math.max(0, Number(rmb.amount || 0));
    if (amt <= 0) continue;

    reimbursementsApprovedTotal += amt;
    if (rmb.status === 'Paid') {
      reimbursementsPaid += amt;
      const mBucket = normalizePaymentMethod(rmb.paymentMethod || 'Cash');
      addMethodOutflow(mBucket, amt);
      recordCategoryExpense(rmb.category || 'Staff Reimbursement', amt, amt, 0);
      transactions.push({
        id: `TX-RMB-${rmb.id}`,
        hotelId,
        date: rmb.date,
        type: 'Staff Reimbursement',
        direction: 'Outflow',
        category: rmb.category || 'Staff Reimbursement',
        partyName: rmb.staffName,
        referenceNo: rmb.id,
        sourceType: 'reimbursement',
        sourceId: rmb.id,
        amount: amt,
        taxAmount: 0,
        paymentMethod: mBucket,
        status: 'Paid',
        notes: rmb.expenseTitle,
      });
    } else {
      // Approved but not yet paid -> Payable to staff
      reimbursementsUnpaid += amt;
      recordCategoryExpense(rmb.category || 'Staff Reimbursement', amt, 0, amt);
      payableItems.push({
        id: `AP-RMB-${rmb.id}`,
        sourceType: 'reimbursement',
        sourceId: rmb.id,
        referenceNumber: rmb.id,
        vendorName: `${rmb.staffName} (Staff Reimbursement)`,
        category: rmb.category || 'Staff Reimbursement',
        date: rmb.date,
        dueDate: rmb.date,
        originalAmount: amt,
        amountPaid: 0,
        outstandingAmount: amt,
        approvalStatus: 'Approved',
        status: 'Unpaid',
        ageDays: computeAgeDays(rmb.date),
        notes: rmb.expenseTitle,
      });
    }
  }

  // Vendor opening balances and standalone vendor payment vouchers
  const expenseAndPurchaseIds = new Set<string>([
    ...expenses.map((e) => e.id),
    ...expenses.map((e) => e.expenseNo || ''),
    ...inventoryPurchases.map((p) => p.id),
    ...inventoryPurchases.map((p) => p.purchaseNumber || ''),
  ]);

  const standalonePaymentVouchers = vouchers.filter(
    (v) =>
      v.voucherType === 'Payment Voucher' &&
      v.status === 'Issued' &&
      v.sourceType !== 'expense' &&
      v.sourceType !== 'inventory_purchase' &&
      v.sourceType !== 'owner_equity' &&
      (!v.sourceId || !expenseAndPurchaseIds.has(v.sourceId)) &&
      (!v.referenceNo || !expenseAndPurchaseIds.has(v.referenceNo))
  );

  for (const vnd of vendors) {
    const openBal = Math.max(0, Number(vnd.openingBalance || 0));
    if (openBal <= 0) continue;
    const paidVouchers = standalonePaymentVouchers.filter(
      (pv) => pv.partyName.toLowerCase() === vnd.name.toLowerCase()
    );
    const paidAgainstOpening = Math.min(
      openBal,
      paidVouchers.reduce((sum, pv) => sum + Math.max(0, Number(pv.amount || 0)), 0)
    );
    const remOpening = Math.max(0, openBal - paidAgainstOpening);
    payableItems.push({
      id: `AP-VND-OPEN-${vnd.id}`,
      sourceType: 'vendor_opening',
      sourceId: vnd.id,
      referenceNumber: `OPEN-${vnd.id}`,
      vendorId: vnd.id,
      vendorName: vnd.name,
      category: vnd.category || 'Vendor Opening Balance',
      date: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      originalAmount: openBal,
      amountPaid: paidAgainstOpening,
      outstandingAmount: remOpening,
      approvalStatus: 'Approved',
      status: remOpening <= 0 ? 'Paid' : paidAgainstOpening > 0 ? 'Partially Paid' : 'Unpaid',
      ageDays: 0,
      notes: 'Brought-forward vendor opening balance',
    });
  }

  for (const pv of standalonePaymentVouchers) {
    const amt = Math.max(0, Number(pv.amount || 0));
    if (amt <= 0) continue;
    const mBucket = normalizePaymentMethod(pv.paymentMethod, pv.accountName);
    addMethodOutflow(mBucket, amt);
    transactions.push({
      id: `TX-PV-${pv.id}`,
      hotelId,
      date: pv.date,
      type: 'Supplier Payment',
      direction: 'Outflow',
      category: pv.category || 'Vendor Payment Voucher',
      partyName: pv.partyName,
      referenceNo: pv.voucherNumber || pv.id,
      sourceType: 'voucher',
      sourceId: pv.id,
      amount: amt,
      taxAmount: 0,
      paymentMethod: mBucket,
      status: 'Paid',
      notes: pv.narration,
    });
  }

  // ---------------------------------------------------------------------------
  // 8. PROCESS PETTY CASH STANDALONE MOVEMENTS (Avoid duplicating Expense Petty Cash)
  // ---------------------------------------------------------------------------
  const pettyCashOpeningOrTopups = pettyCash.filter((pc) => pc.type === 'Inflow');
  const pettyCashInflowSum = pettyCashOpeningOrTopups.reduce((s, p) => s + Math.max(0, Number(p.amount || 0)), 0);
  const pettyCashDirectOutflows = pettyCash.filter(
    (pc) =>
      pc.type === 'Outflow' &&
      pc.sourceType !== 'expense' &&
      !expenses.some((e) => e.id === pc.sourceId || e.description === pc.notes)
  );
  const pettyCashDirectOutflowSum = pettyCashDirectOutflows.reduce(
    (s, p) => s + Math.max(0, Number(p.amount || 0)),
    0
  );

  // Add standalone petty cash outflows to Petty Cash method bucket
  if (pettyCashDirectOutflowSum > 0) {
    addMethodOutflow('Petty Cash', pettyCashDirectOutflowSum);
  }
  const pettyCashBalance = Math.max(
    0,
    pettyCashInflowSum - byMethod['Petty Cash'].outflow
  );

  // ---------------------------------------------------------------------------
  // 9. PROCESS OWNER DRAWINGS & CAPITAL CONTRIBUTIONS (Rule 12: Excluded from Operating Revenue/Expense)
  // ---------------------------------------------------------------------------
  let capitalContributionsTotal = 0;
  let ownerDrawingsTotal = 0;
  const resolvedOwnerEntries: Array<OwnerDirectorPayment & { resolvedCategory: 'Capital Contribution' | 'Owner Drawing' }> = [];

  // Capture operating cash inflows/outflows BEFORE adding owner equity cash movements
  const totalOperatingCashInflow =
    byMethod.Cash.inflow +
    byMethod.UPI.inflow +
    byMethod.Card.inflow +
    byMethod['Bank Transfer'].inflow +
    byMethod.Cheque.inflow +
    byMethod['Petty Cash'].inflow +
    byMethod.Other.inflow;

  const totalOperatingCashOutflow =
    byMethod.Cash.outflow +
    byMethod.UPI.outflow +
    byMethod.Card.outflow +
    byMethod['Bank Transfer'].outflow +
    byMethod.Cheque.outflow +
    byMethod['Petty Cash'].outflow +
    byMethod.Other.outflow;

  for (const op of ownerPayments) {
    if (op.status === 'Cancelled' || op.status === 'Pending Approval') continue;
    const amt = Math.max(0, Math.abs(Number(op.amount || 0)));
    if (amt <= 0) continue;

    const isCapital = isCapitalContributionType(op.type, op.category);
    const resolvedCategory = isCapital ? 'Capital Contribution' : 'Owner Drawing';
    resolvedOwnerEntries.push({ ...op, resolvedCategory });

    const mBucket = normalizePaymentMethod(op.paymentMethod, op.bankAccountName);

    if (isCapital) {
      capitalContributionsTotal += amt;
      addMethodInflow(mBucket, amt);
      transactions.push({
        id: `TX-OWN-CAP-${op.id}`,
        hotelId,
        date: op.date,
        type: 'Owner Capital Contribution',
        direction: 'Inflow',
        category: op.type || 'Capital Contribution',
        partyName: op.directorName || 'Hotel Owner',
        referenceNo: op.referenceNo || op.id,
        sourceType: 'owner_equity',
        sourceId: op.id,
        amount: amt,
        taxAmount: 0,
        paymentMethod: mBucket,
        status: 'Completed',
        notes: `${op.notes || 'Owner capital injection'} (Equity Inflow - Non-Operating)`,
      });
    } else {
      ownerDrawingsTotal += amt;
      addMethodOutflow(mBucket, amt);
      transactions.push({
        id: `TX-OWN-DRW-${op.id}`,
        hotelId,
        date: op.date,
        type: 'Owner Drawing',
        direction: 'Outflow',
        category: op.type || 'Owner Drawing',
        partyName: op.directorName || 'Hotel Owner',
        referenceNo: op.referenceNo || op.id,
        sourceType: 'owner_equity',
        sourceId: op.id,
        amount: amt,
        taxAmount: 0,
        paymentMethod: mBucket,
        status: 'Completed',
        notes: `${op.notes || 'Owner withdrawal / drawing'} (Equity Outflow - Non-Operating)`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 10. COMPUTE CASH & BANK BALANCES (Separating Physical Cash from Bank/Digital)
  // ---------------------------------------------------------------------------
  const physicalCashAccounts = cashBankAccounts.filter((a) => a.accountType === 'Cash Drawer');
  const bankDigitalAccounts = cashBankAccounts.filter((a) => a.accountType !== 'Cash Drawer');

  const physicalCashOpening =
    physicalCashAccounts.reduce((s, a) => s + Number(a.openingBalance ?? 0), 0) + pettyCashInflowSum;
  const bankOpening = bankDigitalAccounts.reduce((s, a) => s + Number(a.openingBalance ?? 0), 0);

  const physicalCashInflow = byMethod.Cash.inflow + byMethod['Petty Cash'].inflow;
  const physicalCashOutflow = byMethod.Cash.outflow + byMethod['Petty Cash'].outflow;
  const physicalCashClosing = physicalCashOpening + physicalCashInflow - physicalCashOutflow;

  const bankInflow =
    byMethod.UPI.inflow +
    byMethod.Card.inflow +
    byMethod['Bank Transfer'].inflow +
    byMethod.Cheque.inflow +
    byMethod.Other.inflow;
  const bankOutflow =
    byMethod.UPI.outflow +
    byMethod.Card.outflow +
    byMethod['Bank Transfer'].outflow +
    byMethod.Cheque.outflow +
    byMethod.Other.outflow;
  const bankClosing = bankOpening + bankInflow - bankOutflow;

  const reconciliationDiscrepancies = cashBankAccounts
    .filter((acc) => acc.reconciledBalance !== undefined && acc.reconciledBalance !== null)
    .map((acc) => {
      const computed = Number(acc.currentBalance || 0);
      const recorded = Number(acc.reconciledBalance ?? computed);
      return {
        accountId: acc.id,
        accountName: acc.accountName,
        accountType: acc.accountType,
        computedBalance: computed,
        recordedBalance: recorded,
        variance: Number((recorded - computed).toFixed(2)),
      };
    })
    .filter((d) => Math.abs(d.variance) > 0.01);

  // ---------------------------------------------------------------------------
  // 11. FINALIZE TOTALS & OPERATING RESULT
  // ---------------------------------------------------------------------------
  const totalFnbRevenue = invoicedFoodRevenue + posDirectRevenue;
  const totalRecognizedRevenue =
    roomRevenue + invoicedFoodRevenue + posDirectRevenue + guestServicesRevenue + otherIncomeRevenue;

  const totalOperatingExpensesAccrued =
    approvedPaidAmount +
    approvedUnpaidAmount +
    inventoryPurchasesTotal +
    reimbursementsApprovedTotal;

  const totalOperatingExpensesPaidCash =
    approvedPaidAmount + inventoryPurchasesPaid + reimbursementsPaid + pettyCashDirectOutflowSum;

  const netOperatingIncomeAccrual = totalRecognizedRevenue - totalOperatingExpensesAccrued;
  const operatingProfitMarginPct =
    totalRecognizedRevenue > 0
      ? Number(((netOperatingIncomeAccrual / totalRecognizedRevenue) * 100).toFixed(2))
      : 0;

  const netOperatingCashFlow = totalOperatingCashInflow - totalOperatingCashOutflow;

  const totalOutputGst = outputGstInvoices + outputGstPosDirect;
  const totalInputTaxCredit = inputTaxCreditExpenses + inputTaxCreditPurchases;
  const netGstPayable = Number((totalOutputGst - totalInputTaxCredit).toFixed(2));

  const openReceivables = receivableItems.filter((r) => r.outstandingAmount > 0.01);
  const openPayables = payableItems.filter((p) => p.outstandingAmount > 0.01);

  // Sort transactions newest first
  transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    hotelId,
    isolatedDemoRecordsCount,
    revenue: {
      roomRevenue: Number(roomRevenue.toFixed(2)),
      posDirectRevenue: Number(posDirectRevenue.toFixed(2)),
      posRoomChargedRevenue: Number(posRoomChargedRevenue.toFixed(2)),
      totalFnbRevenue: Number(totalFnbRevenue.toFixed(2)),
      guestServicesRevenue: Number(guestServicesRevenue.toFixed(2)),
      complimentaryServicesCount,
      complimentaryServicesValue: Number(complimentaryServicesValue.toFixed(2)),
      inHouseUninvoicedFolioRevenue: Number(inHouseUninvoicedFolioRevenue.toFixed(2)),
      otherIncomeRevenue: Number(otherIncomeRevenue.toFixed(2)),
      totalRecognizedRevenue: Number(totalRecognizedRevenue.toFixed(2)),
      advanceDepositsHeld: Number(advanceDepositsHeld.toFixed(2)),
    },
    expenses: {
      pendingApprovalCount,
      pendingApprovalAmount: Number(pendingApprovalAmount.toFixed(2)),
      approvedUnpaidCount,
      approvedUnpaidAmount: Number(approvedUnpaidAmount.toFixed(2)),
      approvedPaidCount,
      approvedPaidAmount: Number(approvedPaidAmount.toFixed(2)),
      rejectedCount,
      rejectedAmount: Number(rejectedAmount.toFixed(2)),
      inventoryPurchasesTotal: Number(inventoryPurchasesTotal.toFixed(2)),
      inventoryPurchasesPaid: Number(inventoryPurchasesPaid.toFixed(2)),
      inventoryPurchasesUnpaid: Number(inventoryPurchasesUnpaid.toFixed(2)),
      reimbursementsApprovedTotal: Number(reimbursementsApprovedTotal.toFixed(2)),
      reimbursementsPaid: Number(reimbursementsPaid.toFixed(2)),
      reimbursementsUnpaid: Number(reimbursementsUnpaid.toFixed(2)),
      totalOperatingExpensesAccrued: Number(totalOperatingExpensesAccrued.toFixed(2)),
      totalOperatingExpensesPaidCash: Number(totalOperatingExpensesPaidCash.toFixed(2)),
      byCategory: expensesByCategory,
    },
    profitability: {
      grossOperatingRevenue: Number(totalRecognizedRevenue.toFixed(2)),
      totalOperatingExpensesAccrued: Number(totalOperatingExpensesAccrued.toFixed(2)),
      netOperatingIncomeAccrual: Number(netOperatingIncomeAccrual.toFixed(2)),
      operatingProfitMarginPct,
      totalOperatingCashInflow: Number(totalOperatingCashInflow.toFixed(2)),
      totalOperatingCashOutflow: Number(totalOperatingCashOutflow.toFixed(2)),
      netOperatingCashFlow: Number(netOperatingCashFlow.toFixed(2)),
    },
    receivables: {
      totalOriginal: Number(receivableItems.reduce((s, r) => s + r.originalAmount, 0).toFixed(2)),
      totalCollected: Number(receivableItems.reduce((s, r) => s + r.amountPaid, 0).toFixed(2)),
      totalOutstanding: Number(openReceivables.reduce((s, r) => s + r.outstandingAmount, 0).toFixed(2)),
      openCount: openReceivables.length,
      overdueCount: openReceivables.filter((r) => r.ageDays > 0).length,
      items: receivableItems,
    },
    payables: {
      totalOriginal: Number(payableItems.reduce((s, p) => s + p.originalAmount, 0).toFixed(2)),
      totalPaid: Number(payableItems.reduce((s, p) => s + p.amountPaid, 0).toFixed(2)),
      totalOutstanding: Number(openPayables.reduce((s, p) => s + p.outstandingAmount, 0).toFixed(2)),
      openCount: openPayables.length,
      overdueCount: openPayables.filter((p) => p.ageDays > 0).length,
      items: payableItems,
    },
    cashAndBank: {
      physicalCashOpening: Number(physicalCashOpening.toFixed(2)),
      physicalCashInflow: Number(physicalCashInflow.toFixed(2)),
      physicalCashOutflow: Number(physicalCashOutflow.toFixed(2)),
      physicalCashClosing: Number(physicalCashClosing.toFixed(2)),
      pettyCashBalance: Number(pettyCashBalance.toFixed(2)),
      bankOpening: Number(bankOpening.toFixed(2)),
      bankInflow: Number(bankInflow.toFixed(2)),
      bankOutflow: Number(bankOutflow.toFixed(2)),
      bankClosing: Number(bankClosing.toFixed(2)),
      totalLiquidFunds: Number((physicalCashClosing + bankClosing).toFixed(2)),
      byMethod,
      reconciliationDiscrepancies,
    },
    taxes: {
      outputGstInvoices: Number(outputGstInvoices.toFixed(2)),
      outputGstPosDirect: Number(outputGstPosDirect.toFixed(2)),
      totalOutputGst: Number(totalOutputGst.toFixed(2)),
      outputCgst: Number(outputCgst.toFixed(2)),
      outputSgst: Number(outputSgst.toFixed(2)),
      outputIgst: Number(outputIgst.toFixed(2)),
      inputTaxCreditExpenses: Number(inputTaxCreditExpenses.toFixed(2)),
      inputTaxCreditPurchases: Number(inputTaxCreditPurchases.toFixed(2)),
      totalInputTaxCredit: Number(totalInputTaxCredit.toFixed(2)),
      netGstPayable,
      slabs: Array.from(slabMap.values()),
    },
    ownerEquity: {
      capitalContributionsTotal: Number(capitalContributionsTotal.toFixed(2)),
      ownerDrawingsTotal: Number(ownerDrawingsTotal.toFixed(2)),
      netOwnerCapitalMovement: Number((capitalContributionsTotal - ownerDrawingsTotal).toFixed(2)),
      entriesCount: resolvedOwnerEntries.length,
      entries: resolvedOwnerEntries,
    },
    transactions,
  };
}
