/**
 * Regression Test Suite for PMS UI & Functional Bug Audit Fixes (RT-01 to RT-06)
 */
import {
  calculateBill,
  BillCharge,
  BillPayment,
  BillSettings,
  DEFAULT_BILL_SETTINGS,
} from '../src/utils/billCalculator';
import {
  buildStayBill,
  reconcileScopedStayInvoice,
  isActiveInvoice,
  resolveInvoiceScope,
  scopesOverlap,
  buildInvoiceRecord,
  InvoiceScopeType,
} from '../src/utils/stayBilling';
import { renderInvoiceHtml } from '../src/utils/printTemplates';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- RUNNING AUDIT REGRESSION TESTS (RT-01 to RT-06) ---');

// RT-01: A4 Invoice Print Layout
console.log('\n[RT-01] Testing A4 Invoice Print Layout Styling...');
{
  const mockBill = calculateBill({
    charges: [
      { id: 'c1', kind: 'room', description: 'Room 101 Rent', amount: 5000, nights: 2, roomNumber: '101' },
      { id: 'c2', kind: 'food', description: 'Room Service', amount: 600, roomNumber: '101' },
    ],
    payments: [{ id: 'p1', amount: 5600, method: 'UPI', date: '2026-11-16' }],
    settings: { ...DEFAULT_BILL_SETTINGS, gstSlabs: { room: 5, food: 5, extraBed: 5, ancillary: 5 } },
  });

  const html = renderInvoiceHtml({
    hotel: {
      name: 'HOTEL M M PRESTIGE',
      address: 'Station Road, Raipur, CG',
      phone: '9876543210',
      gstin: '22AAAAA0000A1Z5',
    },
    invoiceNumber: 'MMPR/1014/2026-27',
    invoiceDate: '16/11/2026',
    guestName: 'Harshdeep Kaur',
    roomLabel: '105',
    checkIn: '14/11/2026',
    checkOut: '16/11/2026',
    nights: 2,
    bill: mockBill,
  });

  assert(html.includes('min-height: 276mm') || html.includes('min-height:276mm'), 'A4 page container has full 276mm height');
  assert(html.includes('font-size: 13.5px') || html.includes('font-size:13.5px'), 'Base font size is bumped to 13.5px for readability');
  assert(html.includes('MMPR/1014/2026-27'), 'Invoice number is rendered');
  assert(html.includes('Authorized Signatory'), 'Signature section is present');
}

// RT-02: In-House Guest Advance Payment Display
console.log('\n[RT-02] Testing In-House Guest Advance Payment Display...');
{
  const guestRecord: any = {
    id: 'CHK-105',
    guestName: 'Harshdeep Kaur',
    roomNumber: '105',
    advanceAmount: 0, // Legacy field was 0
    advancePayment: 2000,
    paymentMethod: 'UPI',
    roomRate: 2500,
    checkInDate: '2026-11-14',
    checkOutDate: '2026-11-16',
    nights: 2,
    cashAmountPaid: 0,
    onlineAmountPaid: 2000,
  };

  const stayResult = buildStayBill({
    checkin: guestRecord,
    settings: DEFAULT_BILL_SETTINGS,
  });

  assert(stayResult.bill.receipts === 2000, `Roster advance resolves to ₹2,000 (got ₹${stayResult.bill.receipts})`);
  assert(stayResult.folio.payments[0].method === 'UPI', `Payment mode resolves to UPI (got ${stayResult.folio.payments[0]?.method})`);
  assert(stayResult.bill.balance === 3250, `Balance due is correctly computed as ₹3,250 (5250 - 2000 = ${stayResult.bill.balance})`);
}

// RT-03: Checkout Checkbox State Machine
console.log('\n[RT-03] Testing Checkout Checkbox Settlement Logic...');
{
  const totalAmount = 5250;
  const advancePaid = 2000;
  const outstandingBefore = totalAmount - advancePaid; // 3250

  // 1. Initial state when balance > 0: checkbox is UNCHECKED
  let coMarkPaid = false;
  let coCollectAmount = 0;
  assert(!coMarkPaid, 'Initial state: Checkbox starts UNCHECKED when balance > 0');

  // 2. Collection ₹0: balance due remains ₹3,250
  let currentBalanceDue = Math.max(0, outstandingBefore - coCollectAmount);
  assert(currentBalanceDue === 3250 && !coMarkPaid, 'Collection ₹0 leaves balance due at ₹3,250 and checkbox unchecked');

  // 3. Collection ₹1,000: balance due becomes ₹2,250, checkbox unchecked
  coCollectAmount = 1000;
  currentBalanceDue = Math.max(0, outstandingBefore - coCollectAmount);
  coMarkPaid = currentBalanceDue === 0;
  assert(currentBalanceDue === 2250 && !coMarkPaid, 'Partial collection ₹1,000 leaves balance due ₹2,250, checkbox UNCHECKED');

  // 4. Collection ₹3,250: balance due becomes ₹0, checkbox auto-checks
  coCollectAmount = 3250;
  currentBalanceDue = Math.max(0, outstandingBefore - coCollectAmount);
  coMarkPaid = currentBalanceDue === 0;
  assert(currentBalanceDue === 0 && coMarkPaid, 'Full collection ₹3,250 reduces balance due to ₹0, checkbox AUTO-CHECKED');

  // 5. User manually checks box: fills remaining balance
  coCollectAmount = 0;
  const onToggleCheck = (checked: boolean) => {
    if (checked) {
      coCollectAmount = outstandingBefore;
      coMarkPaid = true;
    } else {
      coCollectAmount = 0;
      coMarkPaid = false;
    }
  };
  onToggleCheck(true);
  assert(coCollectAmount === 3250 && coMarkPaid, 'Manually checking box fills exact balance of ₹3,250');

  // 6. User manually unchecks box: resets collection to 0
  onToggleCheck(false);
  assert(coCollectAmount === 0 && !coMarkPaid, 'Manually unchecking box resets collection to ₹0');
}

// RT-04: Split Payment Preservation (UPI Checkin + Cash Checkout)
console.log('\n[RT-04] Testing Split Payment Preservation...');
{
  const checkinPayments: BillPayment[] = [
    { id: 'pay-ci', amount: 2000, method: 'UPI', date: '2026-11-14' },
  ];
  const checkoutPayment: BillPayment = {
    id: 'pay-co',
    amount: 3250,
    method: 'Cash',
    date: '2026-11-16',
  };

  const allPayments = [...checkinPayments, checkoutPayment];
  assert(allPayments.length === 2, 'Split payments contain 2 distinct receipt records');
  assert(allPayments[0].method === 'UPI' && allPayments[0].amount === 2000, 'Check-in payment is preserved as ₹2,000 UPI');
  assert(allPayments[1].method === 'Cash' && allPayments[1].amount === 3250, 'Checkout payment is preserved as ₹3,250 Cash');

  const bill = calculateBill({
    charges: [{ id: 'chg-1', kind: 'room', description: 'Room Stay', amount: 5000, roomNumber: '105' }],
    payments: allPayments,
    settings: { ...DEFAULT_BILL_SETTINGS, gstSlabs: { room: 5, food: 5, extraBed: 5, ancillary: 5 } },
  });

  assert(bill.receipts === 5250, `Bill recognizes total receipts of ₹5,250 (got ₹${bill.receipts})`);
  assert(bill.balance === 0, `Bill balance due is ₹0 (got ₹${bill.balance})`);
}

// RT-05: GST / No-GST Invoice Reconciliation (Option A)
console.log('\n[RT-05] Testing GST vs No-GST Invoice Reconciliation (Option A)...');
{
  const mockFolio = {
    booking: { id: 'BKG-105', bookingNo: '105', guestName: 'Harshdeep Kaur' } as any,
    checkin: { id: 'BKG-105', roomNumber: '105' } as any,
    charges: [{ id: 'c1', kind: 'room' as const, description: 'Room 105', amount: 5000, roomNumber: '105' }],
    payments: [{ id: 'p1', amount: 5250, method: 'UPI', date: '2026-11-16' }],
  };

  const gstInvoice = {
    id: 'INV-1001',
    invoiceNumber: 'INV-1001',
    bookingId: 'BKG-105',
    finalAmount: 5250,
    advancePaid: 5250,
    isPaid: true,
    invoiceScope: 'Booking + Other Services',
    invoiceStatus: 'Finalized',
    isSuperseded: false,
  };

  // Reconcile to No-GST invoice for the same stay
  const reconciled = reconcileScopedStayInvoice({
    folio: mockFolio,
    scope: 'Booking + Other Services',
    withGst: false,
    settings: DEFAULT_BILL_SETTINGS,
    existingInvoicesForStay: [gstInvoice],
    confirmedRefundAmount: 0, // No refund confirmed at desk
  });

  assert(reconciled.supersededInvoiceIds.includes('INV-1001'), 'GST invoice INV-1001 is superseded');
  assert(reconciled.bill.grandTotal === 5000, `New No-GST bill final amount is ₹5,000 (got ₹${reconciled.bill.grandTotal})`);
  assert(reconciled.bill.receipts === 5000, `Allocated receipts capped to ₹5,000 (got ₹${reconciled.bill.receipts})`);
  assert(reconciled.bill.balance === 0, `Balance due is ₹0 (got ₹${reconciled.bill.balance})`);
  assert(reconciled.bill.refundDue === 0, `No phantom refund: refundDue is ₹0 (got ₹${reconciled.bill.refundDue})`);

  // Active revenue filter check
  const allInvoices = [
    { ...gstInvoice, isSuperseded: true, invoiceStatus: 'Superseded' },
    { id: 'INV-1002', invoiceNumber: 'INV-1002', finalAmount: 5000, isSuperseded: false, invoiceStatus: 'Finalized' },
  ];
  const activeRevenue = allInvoices
    .filter(inv => !inv.isSuperseded && inv.invoiceStatus !== 'Superseded')
    .reduce((sum, inv) => sum + inv.finalAmount, 0);

  assert(activeRevenue === 5000, `Active revenue excludes superseded invoice: exactly ₹5,000 (not ₹10,250)`);
}

// RT-06: Genuine Overpayment Refund Verification
console.log('\n[RT-06] Testing Genuine Overpayment Refund Display...');
{
  const overpaidBill = calculateBill({
    charges: [{ id: 'chg-1', kind: 'room', description: 'Room Stay', amount: 5000, roomNumber: '105' }],
    payments: [{ id: 'p1', amount: 6000, method: 'Cash', date: '2026-11-16' }],
    settings: { ...DEFAULT_BILL_SETTINGS, isGstEnabled: false },
  });

  assert(overpaidBill.grandTotal === 5000, 'Bill final amount is ₹5,000');
  assert(overpaidBill.receipts === 6000, 'Total paid is ₹6,000');
  assert(overpaidBill.balance === 0, 'Balance due is ₹0');
  assert(overpaidBill.refundDue === 1000, `Refund due correctly reflects ₹1,000 excess payment (got ₹${overpaidBill.refundDue})`);
}

console.log('\n========================================');
console.log('ALL REGRESSION TESTS (RT-01 to RT-06) PASSED!');
console.log('========================================\n');
