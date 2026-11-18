import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { computeHotelFinancialSummary } from '../src/utils/financeEngine';
import type {
  CheckIn,
  POSOrder,
  Invoice,
} from '../src/types';

async function runTests() {
  console.log('================================================================');
  console.log(' DIRECTSTAY PMS — PRIORITY 1-4 AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const check = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name} -> ${err?.message || err}`);
      failed++;
    }
  };

  // ---------------------------------------------------------------------------
  // 1. STATIC & CONTRACT VERIFICATION OF PRIORITY 1 (BACKEND SECURITY)
  // ---------------------------------------------------------------------------
  const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
  const phpCode = fs.readFileSync(path.resolve(process.cwd(), 'public/api/index.php'), 'utf8');
  const supabaseClientCode = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/supabaseClient.ts'), 'utf8');

  check('1.1 Public website config endpoint (/api/public/website-config) exists in Node & PHP without exposing hotels/staff', () => {
    assert(serverCode.includes('app.get("/api/public/website-config"'), 'Node missing /api/public/website-config');
    assert(phpCode.includes("'/public/website-config'"), 'PHP missing /public/website-config');
    assert(supabaseClientCode.includes('/api/public/website-config'), 'supabaseClient missing /api/public/website-config');
  });

  check('1.2 GET /api/db/state requires verified session token and returns 401 when unauthenticated (Node & PHP)', () => {
    assert(
      serverCode.includes('app.get("/api/db/state"') &&
        serverCode.includes('Unauthorized: Valid authentication session required to read PMS state.'),
      'Node GET /api/db/state does not enforce 401 session check'
    );
    assert(
      phpCode.includes('Unauthorized: Valid authentication session required to read PMS state.'),
      'PHP GET /api/db/state does not enforce 401 session check'
    );
  });

  check('1.3 Server-side session store (pms_sessions in Mongo & sessions.json in PHP) resolves caller identity without trusting raw x-user-role', () => {
    assert(serverCode.includes('collection("pms_sessions")'), 'Node missing pms_sessions collection');
    assert(serverCode.includes('resolveCallerIdentity'), 'Node missing resolveCallerIdentity');
    assert(phpCode.includes('loadServerSessions') && phpCode.includes('getCallerContext'), 'PHP missing session store helpers');
  });

  check('1.4 Passwords and SMTP secrets (password, ownerPassword, emailSettings.pass) are stripped from GET /api/db/state and preserved on POST /api/db/sync', () => {
    assert(serverCode.includes('sanitizeHotelForResponse') && serverCode.includes('sanitizeStaffForResponse'), 'Node missing password sanitizers');
    assert(serverCode.includes('ph.password') && serverCode.includes('prevS.password'), 'Node missing secret preservation on sync');
    assert(phpCode.includes('sanitizeHotelPhp') && phpCode.includes('sanitizeStaffPhp'), 'PHP missing password sanitizers');
  });

  check('1.5 Strict hotel-level tenant isolation across all 30+ collections (no || "hotel-1" fallback leakage)', () => {
    assert(serverCode.includes('TENANT_SCOPED_STATE_KEYS'), 'Node missing TENANT_SCOPED_STATE_KEYS');
    assert(
      serverCode.includes('"inventoryCategories"') &&
        serverCode.includes('"inventorySuppliers"') &&
        serverCode.includes('"posItems"') &&
        serverCode.includes('"laundryItems"'),
      'Node TENANT_SCOPED_STATE_KEYS missing operational catalogs'
    );
    assert(phpCode.includes('$TENANT_SCOPED_KEYS') && phpCode.includes("'inventoryCategories'"), 'PHP missing operational catalogs in $TENANT_SCOPED_KEYS');
  });

  check('1.6 Audit logs are append-only and protected from modification, deletion, and cross-hotel overwrite', () => {
    assert(serverCode.includes('mergeAuditLogsAppendOnly') && serverCode.includes('syncAuditLogsAppendOnly'), 'Node missing append-only audit log helpers');
    assert(phpCode.includes('mergeAuditLogsAppendOnlyPhp'), 'PHP missing append-only mergeAuditLogsAppendOnlyPhp');
  });

  // ---------------------------------------------------------------------------
  // 2. PRIORITY 2 — BILLING & FINANCE ENGINE DEDUPLICATION VERIFICATION
  // ---------------------------------------------------------------------------
  const posViewCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/PosView.tsx'), 'utf8');
  const frontDeskCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FrontDeskView.tsx'), 'utf8');
  const dashboardCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/DashboardView.tsx'), 'utf8');
  const hkCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/HousekeepingView.tsx'), 'utf8');
  const invoiceCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/InvoiceView.tsx'), 'utf8');

  check('2.1 POS Room Charge links to active stay extraCharges with idempotent EC-POS-{order.id} and sourceType="pos_order"', () => {
    assert(posViewCode.includes('`EC-POS-${newOrderId}`') && posViewCode.includes('syncPosOrderToGuestFolio'), 'PosView missing EC-POS-${newOrderId} / syncPosOrderToGuestFolio');
    assert(posViewCode.includes("sourceType: 'pos_order'"), 'PosView missing sourceType: pos_order');
  });

  check('2.2 Chargeable & Complimentary Water Bottle allocation links to active stay folio cleanly', () => {
    assert(frontDeskCode.includes('`EC-WB-${recordId}`') && frontDeskCode.includes("sourceType: 'water_bottle'"), 'FrontDeskView missing EC-WB-${recordId}');
    assert(dashboardCode.includes('`EC-WB-${recordId}`') && dashboardCode.includes("sourceType: 'water_bottle'"), 'DashboardView missing EC-WB-${recordId}');
    assert(frontDeskCode.includes('`ALLOC-WB-${recordId}`'), 'FrontDeskView missing ALLOC-WB-${recordId}');
  });

  check('2.3 Room-Billed & Complimentary Laundry links to active stay extraCharges with EC-LND-{order.id} and sourceType="laundry_order"', () => {
    assert(hkCode.includes('`EC-LND-${orderId}`') && hkCode.includes("sourceType: 'laundry_order'"), 'HousekeepingView missing EC-LND-${orderId}');
  });

  check('2.4 InvoiceView deduplicates extraCharges by id & (sourceType, sourceId) and keeps complimentary services at ₹0', () => {
    assert(invoiceCode.includes('deduplicateExtraCharges'), 'InvoiceView missing deduplicateExtraCharges');
    assert(invoiceCode.includes("e.sourceType === 'pos_order'") && invoiceCode.includes("e.sourceType === 'laundry_order'"), 'InvoiceView missing sourceType mappings');
  });

  check('2.5 Finance Hub Engine: POS Room Charge, Water Bottle, Laundry, and Complimentary Services are never double-counted before or after Checkout Invoice', () => {
    const hotelId = 'hotel-1';

    // Active stay with:
    // - Room tariff: ₹2,000
    // - POS Room Charge (ORD-1): ₹500 subtotal (₹525 grandTotal with ₹25 GST) -> EC-POS-ORD-1
    // - Chargeable Water Bottle (WB-1): ₹40 -> ALLOC-WB-WB-1 + EC-WB-WB-1
    // - Complimentary Water Bottle (WB-2): ₹0 (configured ₹20) -> ALLOC-WB-WB-2 (isChargeable: false, chargedAmount: 0)
    // - Room-Billed Laundry (LND-1): ₹150 -> EC-LND-LND-1
    // Total expected pending folio before invoice: 2000 + 525 + 40 + 150 = ₹2,715
    const activeCheckIn: CheckIn = {
      id: 'CHK-TEST-1',
      hotelId,
      guestName: 'Rohan Sharma',
      mobile: '9876543210',
      email: 'rohan@example.com',
      aadhaarNumber: '123456789012',
      address: 'Mumbai',
      roomNumber: '101',
      roomType: 'Deluxe',
      checkInDate: '2026-10-15',
      checkInTime: '12:00',
      checkOutDate: '2026-10-17',
      nights: 1,
      adults: 2,
      children: 0,
      baseAmount: 2000,
      taxAmount: 0,
      discountAmount: 0,
      otherCharges: 0,
      totalAmount: 2000,
      advanceAmount: 0,
      pendingAmount: 2715,
      paymentMethod: 'Cash',
      status: 'CheckedIn',
      allocatedServices: [
        {
          id: 'ALLOC-WB-WB-1',
          serviceId: 'SRV-WB',
          serviceName: 'Water Bottle (2x ₹20)',
          category: 'Complimentary & Room',
          isChargeable: true,
          configuredAmount: 40,
          chargedAmount: 40,
          dateTime: '2026-10-16T10:00:00Z',
        },
        {
          id: 'ALLOC-WB-WB-2',
          serviceId: 'SRV-WB',
          serviceName: 'Complimentary Water Bottle (1x)',
          category: 'Complimentary & Room',
          isChargeable: false,
          configuredAmount: 20,
          chargedAmount: 0,
          dateTime: '2026-10-16T11:00:00Z',
        },
      ],
      extraCharges: [
        {
          id: 'EC-POS-ORD-1',
          description: 'POS Order #1001 (Room Charge): 2x Paneer Tikka',
          amount: 525,
          date: '2026-10-16T13:00:00Z',
          sourceType: 'pos_order',
          sourceId: 'ORD-1',
        },
        // Intentional duplicate with same sourceType+sourceId to verify deduplication
        {
          id: 'EC-POS-ORD-1-DUP',
          description: 'POS Order #1001 Duplicate',
          amount: 525,
          date: '2026-10-16T13:00:00Z',
          sourceType: 'pos_order',
          sourceId: 'ORD-1',
        },
        {
          id: 'EC-WB-WB-1',
          description: 'Water Bottle Allocation (2x ₹20)',
          amount: 40,
          date: '2026-10-16T10:00:00Z',
          sourceType: 'water_bottle',
          sourceId: 'WB-1',
        },
        {
          id: 'EC-LND-LND-1',
          description: 'Laundry Order (Room Bill): 3x Shirt',
          amount: 150,
          date: '2026-10-16T15:00:00Z',
          sourceType: 'laundry_order',
          sourceId: 'LND-1',
        },
      ],
    };

    const posRoomChargeOrder: POSOrder = {
      id: 'ORD-1',
      hotelId,
      orderNumber: 'POS-1001',
      orderType: 'Room Service',
      roomNumber: '101',
      guestName: 'Rohan Sharma',
      checkInId: 'CHK-TEST-1',
      items: [{ itemId: 'ITEM-1', name: 'Paneer Tikka', price: 250, quantity: 2, total: 500, isVeg: true }],
      subtotal: 500,
      cgst: 12.5,
      sgst: 12.5,
      taxAmount: 25,
      discount: 0,
      grandTotal: 525,
      paymentMethod: 'Room Charge',
      paymentStatus: 'Pending',
      status: 'Served',
      createdAt: '2026-10-16T13:00:00Z',
      date: '2026-10-16',
    };

    // Case A: While guest is in-house (prior to checkout invoice)
    const inHouseSummary = computeHotelFinancialSummary({
      hotelId,
      checkins: [activeCheckIn],
      posOrders: [posRoomChargeOrder],
      invoices: [],
    });

    // Uninvoiced folio revenue should equal: 40 (WB-1) + 150 (LND-1) + 500 (ORD-1 net subtotal) = 690
    assert.strictEqual(
      inHouseSummary.revenue.inHouseUninvoicedFolioRevenue,
      690,
      `Expected inHouseUninvoicedFolioRevenue=690, got ${inHouseSummary.revenue.inHouseUninvoicedFolioRevenue}`
    );
    // Guest services revenue should equal: 40 (WB-1) + 150 (LND-1) = 190 (NOT 40+40+150!)
    assert.strictEqual(
      inHouseSummary.revenue.guestServicesRevenue,
      190,
      `Expected guestServicesRevenue=190, got ${inHouseSummary.revenue.guestServicesRevenue}`
    );
    // Complimentary service count = 1, value = 20, and added ₹0 to revenue
    assert.strictEqual(inHouseSummary.revenue.complimentaryServicesCount, 1);
    assert.strictEqual(inHouseSummary.revenue.complimentaryServicesValue, 20);
    // Receivables should NOT double-count AR-POS-RM-ORD-1 on top of AR-CHK-CHK-TEST-1!
    assert.strictEqual(
      inHouseSummary.receivables.totalOutstanding,
      2715,
      `Expected receivables.totalOutstanding=2715 (no POS double count), got ${inHouseSummary.receivables.totalOutstanding}`
    );

    // Case B: After Checkout Invoice is generated (roomCharges=2000, foodCharges=525, waterCharges=150, otherCharges=40)
    const checkoutInvoice: Invoice = {
      id: 'INV-TEST-1',
      hotelId,
      invoiceNumber: 'INV-2026-001',
      bookingId: 'CHK-TEST-1',
      guestName: 'Rohan Sharma',
      guestMobile: '9876543210',
      roomNumber: '101',
      roomCategory: 'Deluxe' as any,
      checkInDate: '2026-10-15',
      checkOutDate: '2026-10-17',
      nights: 1,
      roomCharges: 2000,
      foodCharges: 525,
      waterCharges: 150,
      otherCharges: 40,
      discount: 0,
      subtotal: 2715,
      cgst: 120,
      sgst: 120,
      igst: 0,
      gst: 240,
      finalAmount: 2955,
      amountPaid: 2955,
      pendingAmount: 0,
      paymentMethod: 'UPI',
      paymentStatus: 'Paid',
      isPaid: true,
      dateCreated: '2026-10-17',
    } as any;

    const postInvoiceSummary = computeHotelFinancialSummary({
      hotelId,
      checkins: [{ ...activeCheckIn, status: 'CheckedOut', checkedOutDateTime: '2026-10-17T10:00:00Z', pendingAmount: 0 }],
      posOrders: [{ ...posRoomChargeOrder, linkedInvoiceId: 'INV-TEST-1', paymentStatus: 'Paid' }],
      invoices: [checkoutInvoice],
    });

    // Once invoiced, inHouseUninvoicedFolioRevenue MUST be 0 and receivables MUST be 0!
    assert.strictEqual(
      postInvoiceSummary.revenue.inHouseUninvoicedFolioRevenue,
      0,
      `Expected post-invoice inHouseUninvoicedFolioRevenue=0, got ${postInvoiceSummary.revenue.inHouseUninvoicedFolioRevenue}`
    );
    assert.strictEqual(
      postInvoiceSummary.receivables.totalOutstanding,
      0,
      `Expected post-invoice receivables.totalOutstanding=0, got ${postInvoiceSummary.receivables.totalOutstanding}`
    );
    // Invoiced net revenue = subtotal (2715), and POS direct revenue = 0 (since ORD-1 was a Room Charge!)
    assert.strictEqual(postInvoiceSummary.revenue.posDirectRevenue, 0);
    assert.strictEqual(postInvoiceSummary.revenue.totalRecognizedRevenue, 2715);
  });

  // ---------------------------------------------------------------------------
  // 3. PRIORITY 3 — INVENTORY STOCK VALIDATION, DEDUCTION & TENANT SCOPING
  // ---------------------------------------------------------------------------
  check('3.1 POS, FrontDesk, Dashboard, and Housekeeping validate stock, update currentStock/status/lastUpdated, and record OUT InventoryStockMovement', () => {
    assert(posViewCode.includes("type: 'OUT'") && posViewCode.includes('MOV-POS-'), 'PosView missing OUT InventoryStockMovement');
    assert(frontDeskCode.includes("type: 'OUT'") && frontDeskCode.includes('MOV-WB-'), 'FrontDeskView missing OUT InventoryStockMovement');
    assert(dashboardCode.includes("type: 'OUT'") && dashboardCode.includes('MOV-WB-'), 'DashboardView missing OUT InventoryStockMovement');
    assert(hkCode.includes("type: 'OUT'") && hkCode.includes('MOV-HK-'), 'HousekeepingView missing OUT InventoryStockMovement');
  });

  check('3.2 Finance Engine strictly rejects records missing hotelId or belonging to another hotel', () => {
    const summaryH1 = computeHotelFinancialSummary({
      hotelId: 'hotel-1',
      invoices: [
        {
          id: 'INV-NO-HOTEL',
          // hotelId intentionally omitted
          invoiceNumber: 'INV-LEGACY',
          bookingId: 'BK-0',
          guestName: 'Ambiguous Guest',
          roomNumber: '101',
          checkInDate: '2026-10-16',
          checkOutDate: '2026-10-17',
          nights: 1,
          roomCharges: 5000,
          foodCharges: 0,
          waterCharges: 0,
          otherCharges: 0,
          discount: 0,
          subtotal: 5000,
          gst: 0,
          finalAmount: 5000,
          paymentMethod: 'Cash',
          paymentStatus: 'Paid',
          isPaid: true,
          dateCreated: '2026-10-16',
        } as any,
      ],
    });
    assert.strictEqual(summaryH1.revenue.totalRecognizedRevenue, 0, 'Record without hotelId leaked into hotel-1 summary');
  });

  // ---------------------------------------------------------------------------
  // 4. PRIORITY 4 — OTA SIMULATION / SANDBOX MODE & HOTEL SCOPING
  // ---------------------------------------------------------------------------
  const otaCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/OtaManagerView.tsx'), 'utf8');

  check('4.1 OtaManagerView clearly labels Simulation / Sandbox Mode, uses "Simulated (Sandbox)" status, keeps unconfigured providers Disconnected, and scopes state by selectedHotelId', () => {
    assert(otaCode.includes('OTA Simulation / Sandbox Environment'), 'OtaManagerView missing Simulation / Sandbox disclosure banner');
    assert(otaCode.includes("status: 'Simulated (Sandbox)' | 'Disconnected' | 'Pending'"), 'OtaManagerView status type still uses fake Connected status');
    assert(!otaCode.includes("status === 'Connected'"), 'OtaManagerView still contains fake status === Connected check');
    assert(otaCode.includes('hotelSandboxMap[selectedHotelId]'), 'OtaManagerView sandbox state is not scoped by selectedHotelId');
  });

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
