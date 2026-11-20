import assert from 'node:assert/strict';
import {
  DIRECTSTAY_PMS_SIDEBAR_TREE,
  flattenSidebarLeafNodes,
  filterSidebarTreeByAllowedTabs,
  isSidebarLeafActive,
  isSidebarBranchActive,
} from '../src/utils/sidebarNavigation';
import { computeDashboardMetrics } from '../src/utils/dashboardMetrics';
import type { BookingRecord, HousekeepingTask, RoomAsset } from '../src/pms-integrated/types';
import type { Booking, GuestCheckIn, PosOrder, Room } from '../src/types';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  PASS [${passed}]: ${name}`);
}

console.log('Running DirectStay Dashboard & Sidebar Redesign Tests...\n');

// 1. Exact Top-Level & Nested Sidebar Structure
test('Left Sidebar matches approved structure including Financial Hub & Point of Sale entries', () => {
  const topLabels = DIRECTSTAY_PMS_SIDEBAR_TREE.map((n) => n.label);
  assert.deepEqual(topLabels, [
    'Dashboard',
    'Stay Overview',
    'Housekeeping',
    'Front Office',
    'Reports & Graphs',
    'Booking Engine',
    'Channel Manager',
    'Financial Hub',
    'Point of Sale',
    'Property Setup',
    'Configuration',
    'Administration',
  ]);

  const frontOffice = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.label === 'Front Office')!;
  assert.ok(frontOffice.children);
  assert.deepEqual(
    frontOffice.children.map((c) => c.label),
    [
      'Reservation List',
      'New Reservation',
      'Rates & Inventory',
      'Group Bookings',
      'Event Bookings',
      'Guest Profiles',
      'Guest Self Service',
      'Invoices & Billing',
      'Lost & Found',
      'Availability',
      'Guest Status',
    ]
  );

  const availability = frontOffice.children.find((c) => c.label === 'Availability')!;
  assert.deepEqual(
    availability.children?.map((c) => c.label),
    [
      'Room Status',
      'Occupancy Forecast',
      'Blocked Rooms',
      'No Show Report',
      'Arrival Report',
      'Due Out Today',
      'Night Audit Process',
    ]
  );

  const guestStatus = frontOffice.children.find((c) => c.label === 'Guest Status')!;
  assert.deepEqual(
    guestStatus.children?.map((c) => c.label),
    [
      'Checked In Guest',
      'In House Guest',
      'Settlement Pending',
      'Opened Folio',
      'Collection Report',
      'Checkout Pending',
      'Checked Out Rooms',
    ]
  );

  const propertySetup = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.label === 'Property Setup')!;
  assert.deepEqual(
    propertySetup.children?.map((c) => c.label),
    [
      'Rooms & Category',
      'Room Rate Plan',
      'Amenities',
      'Packages',
      'Services',
      'Corporate Client',
      'Travel Agent',
      'Business Source',
    ]
  );

  const configuration = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.label === 'Configuration')!;
  assert.deepEqual(
    configuration.children?.map((c) => c.label),
    [
      'Tax Setup',
      'Payment Mode',
      'WhatsApp',
      'Department Setup',
      'Shift Setup',
      'Coupons',
      'Master Setup',
    ]
  );

  const administration = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.label === 'Administration')!;
  assert.deepEqual(
    administration.children?.map((c) => c.label),
    ['Properties', 'Building & Floor', 'Users', 'User Roles', 'Audit Logs', 'Profile Setup']
  );

  // Financial Hub opens in-page; Point of Sale opens the standalone POS in a new browser tab
  const finNode = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.label === 'Financial Hub')!;
  assert.equal(finNode.target?.activeTab, 'finance');
  const posNode = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.label === 'Point of Sale')!;
  assert.equal(posNode.target?.activeTab, 'pos');
  assert.equal(posNode.target?.openInNewTab, true);
});

// 2. Every Leaf Item Connects to a Valid Existing Module & Active Highlighting Works
test('All 52 leaf sidebar items resolve to valid DirectStay modules and active state highlights cleanly', () => {
  const validTabs = new Set([
    'dashboard',
    'calendar',
    'housekeeping',
    'frontDesk',
    'rooms',
    'userList',
    'invoice',
    'reports',
    'bookingEngine',
    'otaManager',
    'profile',
    'staff',
    'auditLogs',
    'finance',
    'pos',
  ]);

  const leaves = flattenSidebarLeafNodes();
  assert.equal(leaves.length, 52);
  for (const leaf of leaves) {
    assert.ok(leaf.target?.activeTab, `Missing target on ${leaf.label}`);
    assert.equal(
      validTabs.has(leaf.target!.activeTab),
      true,
      `Unexpected target tab ${leaf.target!.activeTab} on ${leaf.label}`
    );
  }

  // Nested active branch check: Front Office -> Availability -> Night Audit Process
  const frontOffice = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.id === 'front-office')!;
  const availNode = frontOffice.children!.find((n) => n.id === 'fo-availability')!;
  const nightAuditLeaf = availNode.children!.find((n) => n.id === 'avail-night-audit')!;
  const snap = {
    activeTab: 'reports',
    reportsSubTab: 'night_audit',
    lastSelectedSidebarId: 'avail-night-audit',
  };
  assert.equal(isSidebarLeafActive(nightAuditLeaf, snap), true);
  assert.equal(isSidebarBranchActive(availNode, snap), true);
  assert.equal(isSidebarBranchActive(frontOffice, snap), true);

  // RBAC filtering: Housekeeping role sees Dashboard, Housekeeping, Property Setup/Front Office room items
  const hkTree = filterSidebarTreeByAllowedTabs(DIRECTSTAY_PMS_SIDEBAR_TREE, (tab) =>
    ['dashboard', 'housekeeping', 'rooms'].includes(tab)
  );
  assert.equal(hkTree.some((n) => n.id === 'dashboard'), true);
  assert.equal(hkTree.some((n) => n.id === 'housekeeping'), true);
  assert.equal(hkTree.some((n) => n.id === 'channel-manager'), false);
});

// 3. Zero-Dummy-Numbers Verification on Fresh / Empty Bookings State
test('Dashboard metrics show real 0 values (no dummy numbers) when no bookings exist', () => {
  const rooms: RoomAsset[] = Array.from({ length: 20 }, (_, idx) => ({
    id: `rm-${idx + 1}`,
    number: `10${idx + 1}`,
    name: `Room 10${idx + 1}`,
    categoryId: 'cat-std',
    category: 'Standard Room',
    floor: '1st Floor',
    bedType: 'Queen',
    capacity: 2,
    rate: 2000,
    isLive: true,
    status: idx === 0 ? 'Dirty' : 'Available',
    cleaningStatus: idx === 0 ? 'Dirty' : 'Clean',
    amenities: [],
  }));

  const m = computeDashboardMetrics({
    selectedDate: '2026-11-20',
    rooms,
    bookings: [],
    tasks: [],
    appRooms: [],
    appBookings: [],
    appCheckins: [],
    appPosOrders: [],
  });

  assert.equal(m.todaysRevenue, 0);
  assert.equal(m.adrToday, 0);
  assert.equal(m.revParToday, 0);
  assert.equal(m.arrivalsTodayCount, 0);
  assert.equal(m.departuresTodayCount, 0);
  assert.equal(m.inHouseGuestsTotal, 0);
  assert.equal(m.roomStatus.totalRooms, 20);
  assert.equal(m.roomStatus.vacant, 20);
  assert.equal(m.roomStatus.dirty, 1);
  assert.equal(m.roomStatus.clean, 19);
  assert.equal(m.housekeepingStatus.roomsToClean, 1);
  assert.equal(m.housekeepingStatus.readyRooms, 19);
  assert.equal(m.reservationsSnapshot.expectedOccTomorrowPct, 0);
  assert.equal(m.todaysArrivals.length, 0);
  assert.equal(m.todaysDepartures.length, 0);
});

// 4. Full Live Dashboard Calculations (Revenue, ADR, RevPAR, vs Y'day %, Statuses, Arrivals & Departures)
test('Dashboard metrics accurately calculate Revenue, ADR, RevPAR, vs Yesterday %, Statuses, Alerts & Tomorrow Occ', () => {
  const rooms: RoomAsset[] = [
    {
      id: 'r1',
      number: '101',
      name: 'Room 101',
      categoryId: 'c1',
      category: 'Deluxe',
      floor: '1st Floor',
      bedType: 'King',
      capacity: 2,
      rate: 3000,
      isLive: true,
      status: 'Occupied',
      cleaningStatus: 'Clean',
      amenities: [],
    },
    {
      id: 'r2',
      number: '102',
      name: 'Room 102',
      categoryId: 'c1',
      category: 'Deluxe',
      floor: '1st Floor',
      bedType: 'King',
      capacity: 2,
      rate: 3000,
      isLive: true,
      status: 'Dirty',
      cleaningStatus: 'Dirty',
      amenities: [],
    },
    {
      id: 'r3',
      number: '103',
      name: 'Room 103',
      categoryId: 'c2',
      category: 'Executive Suite',
      floor: '2nd Floor',
      bedType: 'King',
      capacity: 3,
      rate: 5000,
      isLive: true,
      status: 'Available',
      cleaningStatus: 'Clean',
      amenities: [],
    },
    {
      id: 'r4',
      number: '104',
      name: 'Room 104',
      categoryId: 'c1',
      category: 'Deluxe',
      floor: '2nd Floor',
      bedType: 'Queen',
      capacity: 2,
      rate: 2500,
      isLive: true,
      status: 'Out of Service',
      cleaningStatus: 'Clean',
      blockedReason: 'AC Repair',
      amenities: [],
    },
  ];

  const appRooms: Room[] = [
    { id: 'r1', number: '101', category: 'Deluxe', status: 'Occupied', rate: 3000, housekeepingStatus: 'Clean' } as any,
    { id: 'r2', number: '102', category: 'Deluxe', status: 'Dirty', rate: 3000, housekeepingStatus: 'Dirty' } as any,
    { id: 'r3', number: '103', category: 'Executive Suite', status: 'Available', rate: 5000, housekeepingStatus: 'Inspected', lastInspectedAt: '2026-11-20T08:00:00Z' } as any,
    { id: 'r4', number: '104', category: 'Deluxe', status: 'Maintenance', rate: 2500 } as any,
  ];

  const bookings: BookingRecord[] = [
    // Yesterday stay (checked out today -> Departure Today, Pending ₹500 bill)
    {
      id: 'BKG-Y1',
      bookingNo: 'BKG-Y1',
      createdAt: '2026-11-18',
      customerName: 'Sambit Nayak',
      mobile: '9938994886',
      source: 'Walk-In',
      status: 'Confirmed',
      isCheckedIn: false,
      isCheckedOut: false,
      checkInDate: '2026-11-19',
      checkInTime: '12:00 PM',
      checkOutDate: '2026-11-20',
      checkOutTime: '11:00 AM',
      nights: 1,
      isOpenStay: false,
      numGuests: 2,
      extraBeds: 0,
      extraPersonRate: 0,
      roomNumbers: ['102'],
      requirements: [],
      guests: [],
      otherServices: [],
      payments: [],
      roomSubtotal: 2000,
      otherServicesTotal: 0,
      discount: 0,
      cgst: 50,
      sgst: 50,
      igst: 0,
      totalPayable: 2100,
      amountPaid: 1600,
      dueAmount: 500,
      withGst: true,
    },
    // Today arrival & checked-in stay covering 2026-11-20 -> 2026-11-22 (2 nights, covers tomorrow too!)
    {
      id: 'BKG-T1',
      bookingNo: 'BKG-T1',
      createdAt: '2026-11-20',
      customerName: 'Aarav Sharma',
      mobile: '9876543210',
      companyName: 'Infosys Ltd',
      source: 'Direct',
      status: 'Checked In',
      isCheckedIn: true,
      isCheckedOut: false,
      checkInDate: '2026-11-20',
      checkInTime: '09:30 AM', // Early arrival (< 12:00 PM) + Corporate VIP!
      checkOutDate: '2026-11-22',
      checkOutTime: '11:00 AM',
      nights: 2,
      isOpenStay: false,
      numGuests: 3,
      extraBeds: 0,
      extraPersonRate: 0,
      roomNumbers: ['101'],
      requirements: [],
      guests: [],
      otherServices: [
        {
          id: 'SRV-LAUNDRY-1',
          bookingId: 'BKG-T1',
          roomNumber: '101',
          roomName: 'Room 101',
          serviceType: 'LAUNDRY',
          description: 'Express Laundry',
          quantity: 1,
          amount: 300,
          taxAmount: 0,
          dateTime: '2026-11-20 14:00',
          isPaid: true,
        },
      ],
      payments: [],
      roomSubtotal: 6000, // 3000/night
      otherServicesTotal: 300,
      discount: 0,
      cgst: 150, // 75/night
      sgst: 150, // 75/night
      igst: 0,
      totalPayable: 6600,
      amountPaid: 6600,
      dueAmount: 0,
      withGst: true,
    },
  ];

  const appBookings: Booking[] = [
    {
      id: 'BKG-T1',
      guestName: 'Aarav Sharma',
      mobile: '9876543210',
      adults: 2,
      children: 1,
      bookingDate: '2026-11-20',
      checkInDate: '2026-11-20',
      checkInTime: '09:30 AM',
      checkOutDate: '2026-11-22',
      roomType: 'Deluxe',
      roomNumber: '101',
      status: 'CheckedIn',
      source: 'Direct',
      companyName: 'Infosys Ltd',
      totalAmount: 6300,
      advanceAmount: 6300,
    } as any,
  ];

  const appCheckins: GuestCheckIn[] = [
    {
      id: 'BKG-T1',
      bookingId: 'BKG-T1',
      guestName: 'Aarav Sharma',
      adults: 2,
      children: 1,
      roomNumber: '101',
      checkInDate: '2026-11-20',
      checkOutDate: '2026-11-22',
      status: 'Active',
    } as any,
  ];

  const appPosOrders: PosOrder[] = [
    {
      id: 'POS-1',
      hotelId: 'hotel-1',
      orderNumber: 'ORD-101',
      orderType: 'Dine In',
      date: '2026-11-20',
      items: [],
      subtotal: 500,
      gstAmount: 25,
      totalAmount: 525,
      grandTotal: 525,
      status: 'Settled',
      paymentStatus: 'Paid',
    } as any,
  ];

  const tasks: HousekeepingTask[] = [];

  const m = computeDashboardMetrics({
    selectedDate: '2026-11-20',
    rooms,
    bookings,
    tasks,
    appRooms,
    appBookings,
    appCheckins,
    appPosOrders,
  });

  // Today Room Rev = (6000 + 300) / 2 nights = 3150; POS = 525; Laundry Other = 300 -> Total = 3975
  assert.equal(m.todaysRoomRevenue, 3150);
  assert.equal(m.todaysFnbRevenue, 525);
  assert.equal(m.todaysOtherRevenue, 300);
  assert.equal(m.todaysRevenue, 3975);

  // Yesterday Room Rev = 2100 -> Revenue went UP from 2100 to 3975 (+89%)
  assert.equal(m.revenueDelta.yesterdayValue, 2100);
  assert.equal(m.revenueDelta.direction, 'up');
  assert.equal(m.revenueDelta.pctChange, 89);

  // ADR Today = 3150 / 1 occupied room = 3150 (vs Y'day 2100 -> +50%)
  assert.equal(m.adrToday, 3150);
  assert.equal(m.adrDelta.yesterdayValue, 2100);
  assert.equal(m.adrDelta.pctChange, 50);

  // RevPAR Today = 3150 / 3 sellable rooms (4 total - 1 Out of Order) = 1050
  assert.equal(m.revParToday, 1050);

  // Arrivals, Departures & In-House Pax (2A / 1C = 3 total)
  assert.equal(m.arrivalsTodayCount, 1);
  assert.equal(m.departuresTodayCount, 1);
  assert.equal(m.todaysDepartures[0].guestName, 'Sambit Nayak');
  assert.equal(m.todaysDepartures[0].billStatus, 'Pending');

  // Room Status & Housekeeping Status
  assert.equal(m.roomStatus.totalRooms, 4);
  assert.equal(m.roomStatus.dirty, 1);
  assert.equal(m.roomStatus.outOfOrder, 1);
  assert.equal(m.roomStatus.inspected, 1);

  // Alerts: Early Arrival (09:30 AM < 12:00 PM), VIP Arrival (Corporate), Pending Payment (BKG-Y1 ₹500), Open Maintenance (Room 104)
  assert.equal(m.alertsAndTasks.earlyArrivals, 1);
  assert.equal(m.alertsAndTasks.vipArrivals, 1);
  assert.equal(m.alertsAndTasks.pendingPayments, 1);
  assert.equal(m.alertsAndTasks.openMaintenance, 1);

  // Tomorrow (2026-11-21): BKG-T1 stays over -> 1 of 4 rooms = 25%
  assert.equal(m.reservationsSnapshot.expectedOccTomorrowPct, 25);
});

console.log(`\nAll ${passed} Dashboard & Sidebar tests PASSED!`);
