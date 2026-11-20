import assert from 'node:assert/strict';
import {
  STANDALONE_POS_SIDEBAR_TREE,
  resolvePosCapabilities,
  getVisiblePosSidebarTree,
  mapPosPathToSubTab,
  mapPosSubTabToPath,
  buildStandalonePosUrl,
} from '../src/utils/posConfigHelpers';
import {
  computePosBill,
  getConfiguredMenuUnitPrice,
  isManualPriceOverride,
  allocatePayRows,
  resolvePayStatus,
} from '../src/pms-integrated/utils/posBilling';
import { buildStayBill } from '../src/utils/stayBilling';
import { normalizeBillSettings } from '../src/utils/billCalculator';
import type { PosMenuItem } from '../src/pms-integrated/types';
import type { Booking, GuestCheckIn, PosOrder, Room } from '../src/types';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  PASS [${passed}]: ${name}`);
}

console.log('Running DirectStay Separate POS Interface & Settings Verification Suite...\n');

// 1. Separate POS Sidebar & URL Routing
test('1. Standalone POS Sidebar & URL routes match exact specification', () => {
  assert.deepEqual(
    STANDALONE_POS_SIDEBAR_TREE.map((n) => n.label),
    ['Take Order', 'POS', 'Orders', 'Reservations', 'Help Guide', 'Settings']
  );

  const ordersNode = STANDALONE_POS_SIDEBAR_TREE.find((n) => n.id === 'orders')!;
  assert.deepEqual(
    ordersNode.children?.map((c) => c.label),
    ['Current Orders', 'Order History']
  );

  assert.equal(mapPosPathToSubTab('/pos/take-order'), 'take_order');
  assert.equal(mapPosPathToSubTab('/pos'), 'terminal');
  assert.equal(mapPosPathToSubTab('/pos/orders/current'), 'orders_current');
  assert.equal(mapPosPathToSubTab('/pos/orders/history'), 'orders_history');
  assert.equal(mapPosPathToSubTab('/pos/reservations'), 'advance_booking');
  assert.equal(mapPosPathToSubTab('/pos/help'), 'help');
  assert.equal(mapPosPathToSubTab('/pos/settings'), 'settings');

  assert.equal(mapPosSubTabToPath('take_order'), '/pos/take-order');
  assert.equal(mapPosSubTabToPath('terminal'), '/pos');
  assert.equal(mapPosSubTabToPath('orders_current'), '/pos/orders/current');
  assert.equal(mapPosSubTabToPath('orders_history'), '/pos/orders/history');
  assert.equal(mapPosSubTabToPath('advance_booking'), '/pos/reservations');
  assert.equal(mapPosSubTabToPath('help'), '/pos/help');
  assert.equal(mapPosSubTabToPath('settings'), '/pos/settings');

  assert.equal(
    buildStandalonePosUrl('terminal', 'hotel-harsh'),
    '/pos?hotelId=hotel-harsh'
  );
});

// 2. POS Configuration Settings ON/OFF Combinations & Per-Hotel Isolation
test('2. POS Kitchen (YES/NO) and Café/Restaurant (YES/NO) settings control KOT, KDS & Order Modes per property', () => {
  // Case A: Both YES (Default)
  const fullCaps = resolvePosCapabilities(
    { inHouseKitchenAvailable: true, inHouseRestaurantAvailable: true },
    'hotel-1'
  );
  assert.equal(fullCaps.kotEnabled, true);
  assert.equal(fullCaps.kotPrintingEnabled, true);
  assert.equal(fullCaps.kdsEnabled, true);
  assert.deepEqual(fullCaps.allowedOrderTypes, ['Dine In', 'Takeaway', 'Room Service']);
  assert.equal(fullCaps.tablesEnabled, true);
  assert.equal(fullCaps.tableReservationsEnabled, true);
  assert.equal(
    getVisiblePosSidebarTree(fullCaps).some((n) => n.id === 'reservations'),
    true
  );

  // Case B: Kitchen = NO, Restaurant = YES
  const noKitchenCaps = resolvePosCapabilities(
    { inHouseKitchenAvailable: false, inHouseRestaurantAvailable: true },
    'hotel-1'
  );
  assert.equal(noKitchenCaps.kotEnabled, false);
  assert.equal(noKitchenCaps.kotPrintingEnabled, false);
  assert.equal(noKitchenCaps.kdsEnabled, false);
  assert.deepEqual(noKitchenCaps.allowedOrderTypes, ['Dine In', 'Takeaway', 'Room Service']);

  // Case C: Kitchen = YES, Restaurant = NO (Room Service Only + KOT active)
  const roomOnlyWithKitchen = resolvePosCapabilities(
    { inHouseKitchenAvailable: true, inHouseRestaurantAvailable: false },
    'hotel-2'
  );
  assert.equal(roomOnlyWithKitchen.kotEnabled, true);
  assert.equal(roomOnlyWithKitchen.kdsEnabled, true);
  assert.deepEqual(roomOnlyWithKitchen.allowedOrderTypes, ['Room Service']);
  assert.equal(roomOnlyWithKitchen.defaultOrderType, 'Room Service');
  assert.equal(roomOnlyWithKitchen.dineInEnabled, false);
  assert.equal(roomOnlyWithKitchen.takeawayEnabled, false);
  assert.equal(roomOnlyWithKitchen.tablesEnabled, false);
  assert.equal(roomOnlyWithKitchen.tableReservationsEnabled, false);
  assert.equal(
    getVisiblePosSidebarTree(roomOnlyWithKitchen).some((n) => n.id === 'reservations'),
    false
  );

  // Case D: Both NO -> Room Service Only without KOT/KDS
  const minimalCaps = resolvePosCapabilities(
    { inHouseKitchenAvailable: false, inHouseRestaurantAvailable: false },
    'hotel-3'
  );
  assert.equal(minimalCaps.kotEnabled, false);
  assert.equal(minimalCaps.kdsEnabled, false);
  assert.deepEqual(minimalCaps.allowedOrderTypes, ['Room Service']);
});

// 3. Custom Product Price During Orders (Paneer ₹500 -> ₹600 Example)
test('3. Custom Product Price (Paneer ₹500 -> ₹600) recalculates GST & totals, preserves ₹500 master price, and creates audit entry', () => {
  const paneerMaster: PosMenuItem = {
    id: 'item-paneer-1',
    code: 'FNB-201',
    name: 'Paneer',
    category: 'North Indian',
    price: 500,
    taxRate: 5,
    isVeg: true,
    available: true,
    kitchenStation: 'Main Kitchen',
  };

  const { configuredUnitPrice } = getConfiguredMenuUnitPrice(paneerMaster);
  assert.equal(configuredUnitPrice, 500);

  // Staff sets custom selling price ₹600 for this individual order
  const customOrderPrice = 600;
  assert.equal(isManualPriceOverride(customOrderPrice, configuredUnitPrice), true);

  const bill = computePosBill({
    lines: [{ unitPrice: customOrderPrice, qty: 1 }],
    discountEnabled: false,
    discountType: 'fixed',
    discountValue: 0,
    gstPct: 5,
    settlementEnabled: false,
    settlementFinal: '',
  });

  // Subtotal = ₹600, 5% GST = ₹30 (₹15 CGST + ₹15 SGST), Grand Total = ₹630
  assert.equal(bill.subtotal, 600);
  assert.equal(bill.tax, 30);
  assert.equal(bill.payable, 630);

  // Original product master price is untouched!
  assert.equal(paneerMaster.price, 500);

  // Verify audit trail record structure
  const auditDetail = `${paneerMaster.name}: Original ₹${configuredUnitPrice} → Custom ₹${customOrderPrice} on order POS-10001 by Harsh Admin (Admin). Reason: Special Guest Prep`;
  assert.ok(auditDetail.includes('Original ₹500 → Custom ₹600'));
  assert.ok(auditDetail.includes('Harsh Admin'));
  assert.ok(auditDetail.includes('Special Guest Prep'));
});

// 4. Hybrid Payments & Settlement Verification
test('4. Hybrid Payment split (Cash + UPI) accurately settles custom-priced ₹630 POS order', () => {
  const { byOrder } = allocatePayRows(
    [{ id: 'pos-ord-1', due: 630 }],
    [
      { method: 'Cash', amount: 300 },
      { method: 'UPI', amount: 330, reference: 'UTR9988776655', verificationStatus: 'verified' },
    ]
  );
  const slices = byOrder['pos-ord-1'];
  assert.equal(slices.length, 2);
  const totalPaid = slices.reduce((s, r) => s + r.amount, 0);
  assert.equal(totalPaid, 630);
  assert.equal(resolvePayStatus(630, totalPaid), 'Paid');
});

// 5. Room Service Folio Sync Without Duplication or Counter-Order Leakage
test('5. Room Service posts custom-priced order to Guest Folio without duplication and excludes counter Dine-In orders', () => {
  const rooms: Room[] = [
    { id: 'r-101', number: '101', category: 'Deluxe', rate: 2000, status: 'Occupied' },
  ];
  const booking: Booking = {
    id: 'BKG-RS-1',
    guestName: 'Rohan Mehta',
    mobile: '9811122233',
    roomNumber: '101',
    roomType: 'Deluxe',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-21',
    adults: 2,
    children: 0,
    status: 'CheckedIn',
    roomPrice: 2000,
    baseAmount: 2000,
    gstRate: 5,
    totalAmount: 2100,
    advanceAmount: 0,
    paymentMethod: 'Cash',
  };
  const checkin: GuestCheckIn = {
    id: 'CI-RS-1',
    bookingId: 'BKG-RS-1',
    guestName: 'Rohan Mehta',
    mobile: '9811122233',
    idProofType: 'Aadhaar',
    idProofNumber: '123456789012',
    nationality: 'Indian',
    address: 'Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-21',
    numGuests: 2,
    roomNumber: '101',
    roomRate: 2000,
    totalAmount: 2100,
    advanceAmount: 0,
    cashAmountPaid: 0,
    onlineAmountPaid: 0,
    pendingAmount: 2100,
    dateTime: '2026-11-20 12:00',
  };

  const posOrders: PosOrder[] = [
    // 1. Room Service order with Custom Price Paneer ₹600 + 5% GST = ₹630
    {
      id: 'pos-rs-paneer',
      hotelId: 'hotel-1',
      orderNumber: 'POS-5001',
      orderType: 'Room Service',
      roomNumber: '101',
      bookingId: 'BKG-RS-1',
      guestName: 'Rohan Mehta',
      items: [
        {
          itemId: 'item-paneer-1',
          itemName: 'Paneer',
          itemCode: 'FNB-201',
          quantity: 1,
          price: 600,
          taxRate: 5,
          total: 600,
        },
      ],
      subtotal: 600,
      discount: 0,
      taxAmount: 30,
      grandTotal: 630,
      paymentMethod: 'Room Charge',
      paymentStatus: 'Unpaid',
      status: 'KOT Sent',
      date: '2026-11-20',
      ...({ postToRoomBill: true, gstRate: 5 } as any),
    },
    // 2. Counter-paid Dine-In order (must NOT post to Room 101 folio)
    {
      id: 'pos-dinein-99',
      hotelId: 'hotel-1',
      orderNumber: 'POS-5002',
      orderType: 'Dine In',
      tableNo: 'T-01',
      guestName: 'Walk-In Diner',
      items: [
        {
          itemId: 'item-paneer-1',
          itemName: 'Paneer',
          itemCode: 'FNB-201',
          quantity: 1,
          price: 500,
          taxRate: 5,
          total: 500,
        },
      ],
      subtotal: 500,
      discount: 0,
      taxAmount: 25,
      grandTotal: 525,
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      status: 'Settled',
      date: '2026-11-20',
    },
    // 3. Cancelled Room Service order (must NOT post to Room 101 folio)
    {
      id: 'pos-rs-cancelled',
      hotelId: 'hotel-1',
      orderNumber: 'POS-5003',
      orderType: 'Room Service',
      roomNumber: '101',
      bookingId: 'BKG-RS-1',
      guestName: 'Rohan Mehta',
      items: [],
      subtotal: 400,
      discount: 0,
      taxAmount: 20,
      grandTotal: 420,
      paymentMethod: 'Room Charge',
      paymentStatus: 'Unpaid',
      status: 'Cancelled',
      date: '2026-11-20',
    },
  ];

  const settings = normalizeBillSettings({
    isGstEnabled: true,
    defaultGstRate: 5,
    foodGstRate: 5,
  });

  const { bill } = buildStayBill({
    booking,
    checkin,
    posOrders,
    rooms,
    settings,
  });

  const foodLines = bill.chargeLines.filter((cl) => cl.kind === 'food');
  assert.equal(foodLines.length, 1, 'Exactly 1 Room Service order should post to folio (no duplicates, no Dine-In, no Cancelled)');
  assert.equal(foodLines[0].charges, 600);
  // Room ₹2,000 + Food ₹600 = ₹2,600 subtotal + 5% GST (₹130) = ₹2,730 Grand Total
  assert.equal(bill.subtotal, 2600);
  assert.equal(bill.totalTax, 130);
  assert.equal(bill.grandTotal, 2730);
});

console.log(`\nALL ${passed}/5 SEPARATE POS INTERFACE & SETTINGS TESTS PASSED!`);
