import assert from 'node:assert/strict';
import {
  buildReservationsCsv,
  canPerformReservationAction,
  computeReservationFinancials,
  computeStayDurationInfo,
  getReservationRoomSummary,
  getStatusPillClasses,
  mergeBookingsAndStandaloneWalkIns,
  resolveCanonicalStatus,
  resolveReservationSegments,
  validateRoomAllocationForDates,
} from '../src/utils/reservationHelpers';
import { normalizeBillSettings } from '../src/utils/billCalculator';
import { renderGrcHtml } from '../src/utils/printTemplates';
import { Booking, GuestCheckIn, PosOrder, Room } from '../src/types';

const TODAY = '2026-11-20';

const sampleRooms: Room[] = [
  { id: 'r1', number: '002A', category: 'Standard Room', floor: 1, rate: 2000, status: 'Available', cleaningStatus: 'Clean' } as Room,
  { id: 'r2', number: '101', category: 'Deluxe Room', floor: 1, rate: 3000, status: 'Available', cleaningStatus: 'Clean' } as Room,
  { id: 'r3', number: '102', category: 'Deluxe Room', floor: 1, rate: 3000, status: 'Available', cleaningStatus: 'Clean' } as Room,
  { id: 'r4', number: '205', category: 'Suite', floor: 2, rate: 5000, status: 'Out of Order', cleaningStatus: 'Dirty' } as Room,
];

function makeBaseBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'GP-BKG-1001',
    guestName: 'Sambit Nayak',
    mobile: '9938994886',
    email: 'sambit@example.com',
    aadhaarNumber: '123456789012',
    address: 'Khorda, Odisha',
    checkInDate: '2026-11-19',
    checkOutDate: '2026-11-20',
    checkInTime: '12:00 PM',
    checkOutTime: '10:00 AM',
    nights: 1,
    adults: 2,
    children: 0,
    roomNumber: '002A',
    roomType: 'Standard Room',
    advanceAmount: 1000,
    paymentMethod: 'UPI',
    bookingSource: 'Walk-in',
    status: 'Confirmed',
    bookingAmount: 2000,
    gstRate: 5,
    bookingDate: '2026-11-17',
    ...overrides,
  };
}

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  PASS [${passed}]: ${name}`);
}

console.log('Running Reservation List Redesign Verification Suite...\n');

test('1. Resolves all 7 canonical statuses with distinct badge classes', () => {
  const draft = makeBaseBooking({ status: 'In Process', advanceAmount: 0, checkInDate: TODAY });
  const confirmed = makeBaseBooking({ status: 'Confirmed', advanceAmount: 500, checkInDate: TODAY });
  const upcoming = makeBaseBooking({ status: 'Confirmed', advanceAmount: 500, checkInDate: '2026-11-25' });
  const checkedIn = makeBaseBooking({ status: 'Confirmed', isCheckedIn: true, checkInDate: TODAY });
  const checkedOut = makeBaseBooking({ status: 'Confirmed', isCompleted: true, checkInDate: '2026-11-18' });
  const cancelled = makeBaseBooking({ status: 'Cancelled' });
  const noShow = makeBaseBooking({ status: 'No-Show' });

  assert.equal(resolveCanonicalStatus(draft, undefined, TODAY), 'Draft');
  assert.equal(resolveCanonicalStatus(confirmed, undefined, TODAY), 'Confirmed');
  assert.equal(resolveCanonicalStatus(upcoming, undefined, TODAY), 'Upcoming');
  assert.equal(resolveCanonicalStatus(checkedIn, undefined, TODAY), 'Checked-In');
  assert.equal(resolveCanonicalStatus(checkedOut, undefined, TODAY), 'Checked-Out');
  assert.equal(resolveCanonicalStatus(cancelled, undefined, TODAY), 'Cancelled');
  assert.equal(resolveCanonicalStatus(noShow, undefined, TODAY), 'No-Show');

  const uniqueBadges = new Set(
    (['Draft', 'Confirmed', 'Upcoming', 'Checked-In', 'Checked-Out', 'Cancelled', 'No-Show'] as const).map(
      st => getStatusPillClasses(st).badge
    )
  );
  assert.equal(uniqueBadges.size, 7, 'Each of the 7 statuses must have a unique colour style');
});

test('2. Classifies Individual, Group, Corporate, Walk-in, OTA & Travel Agent segments accurately', () => {
  assert.equal(resolveReservationSegments(makeBaseBooking({ bookingSource: 'Direct' })).primarySegment, 'Individual');
  assert.equal(resolveReservationSegments(makeBaseBooking({ bookingSource: 'Walk-in' })).primarySegment, 'Walk-in');
  assert.equal(resolveReservationSegments(makeBaseBooking({ bookingSource: 'MakeMyTrip' })).primarySegment, 'OTA');
  assert.equal(resolveReservationSegments(makeBaseBooking({ bookingSource: 'Travel Agent', travelAgentName: 'Apex Tours' })).primarySegment, 'Travel Agent');
  assert.equal(resolveReservationSegments(makeBaseBooking({ bookingSource: 'Direct', companyName: 'Infosys Ltd' })).primarySegment, 'Corporate');

  const groupCorp = makeBaseBooking({
    roomNumber: '101, 102',
    companyName: 'Tata Steel',
    bookedRooms: [
      { roomNumber: '101', category: 'Deluxe Room', rate: 3000, originalRate: 3000, discountAmountOfRoom: 0, guestsCount: 2, extraGuestsCount: 0, extraPersonChargeApplied: 0, totalRoomAmount: 3000 },
      { roomNumber: '102', category: 'Deluxe Room', rate: 3000, originalRate: 3000, discountAmountOfRoom: 0, guestsCount: 2, extraGuestsCount: 0, extraPersonChargeApplied: 0, totalRoomAmount: 3000 },
    ],
  });
  const seg = resolveReservationSegments(groupCorp);
  assert.equal(seg.primarySegment, 'Group');
  assert.ok(seg.segments.includes('Group') && seg.segments.includes('Corporate'));
});

test('3. Displays multiple rooms within one group booking cleanly without row duplication', () => {
  const groupBk = makeBaseBooking({
    roomNumber: '101, 102',
    roomType: 'Deluxe Room',
    bookedRooms: [
      { roomNumber: '101', category: 'Deluxe Room', rate: 3000, originalRate: 3000, discountAmountOfRoom: 0, guestsCount: 2, extraGuestsCount: 0, extraPersonChargeApplied: 0, totalRoomAmount: 3000 },
      { roomNumber: '102', category: 'Deluxe Room', rate: 3000, originalRate: 3000, discountAmountOfRoom: 0, guestsCount: 2, extraGuestsCount: 0, extraPersonChargeApplied: 0, totalRoomAmount: 3000 },
    ],
  });
  const summary = getReservationRoomSummary(groupBk, sampleRooms);
  assert.equal(summary.roomCount, 2);
  assert.equal(summary.displayRoomsLabel, '101, 102 (2 Rooms)');
  assert.equal(summary.categoryLabel, 'DELUXE ROOM');

  const duration = computeStayDurationInfo(makeBaseBooking());
  assert.equal(duration.nightsCount, 1);
  assert.equal(duration.durationHoursLabel, '22 hr');
});

test('4. Enforces status-based action guards (prevents invalid status changes)', () => {
  assert.equal(canPerformReservationAction('checkIn', 'Confirmed', 'Reception'), true);
  assert.equal(canPerformReservationAction('checkIn', 'Checked-In', 'Admin'), false);
  assert.equal(canPerformReservationAction('checkIn', 'Cancelled', 'Admin'), false);
  assert.equal(canPerformReservationAction('checkIn', 'No-Show', 'Admin'), false);

  assert.equal(canPerformReservationAction('checkOut', 'Checked-In', 'Reception'), true);
  assert.equal(canPerformReservationAction('checkOut', 'Confirmed', 'Admin'), false);

  assert.equal(canPerformReservationAction('cancel', 'Checked-In', 'Admin'), false);
  assert.equal(canPerformReservationAction('cancel', 'Checked-Out', 'Admin'), false);
  assert.equal(canPerformReservationAction('noShow', 'Checked-In', 'Admin'), false);
  assert.equal(canPerformReservationAction('noShow', 'Upcoming', 'Reception'), true);
});

test('5. Prevents double bookings, Out-of-Order assignment, and releases No-Show rooms', () => {
  const activeBk = makeBaseBooking({
    id: 'GP-BKG-2001',
    roomNumber: '101',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    status: 'Confirmed',
  });
  const noShowBk = makeBaseBooking({
    id: 'GP-BKG-2002',
    roomNumber: '102',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    status: 'No-Show',
  });

  // Double-booking Room 101 must fail
  const overlapRes = validateRoomAllocationForDates({
    targetRoomNumbers: ['101'],
    checkInDate: '2026-11-21',
    checkOutDate: '2026-11-23',
    rooms: sampleRooms,
    bookings: [activeBk, noShowBk],
    todayStr: TODAY,
  });
  assert.equal(overlapRes.valid, false);

  // Out of Order Room 205 must fail
  const oooRes = validateRoomAllocationForDates({
    targetRoomNumbers: ['205'],
    checkInDate: '2026-11-21',
    checkOutDate: '2026-11-23',
    rooms: sampleRooms,
    bookings: [activeBk, noShowBk],
    todayStr: TODAY,
  });
  assert.equal(oooRes.valid, false);

  // Room 102 had a No-Show -> must be released & available!
  const releasedRes = validateRoomAllocationForDates({
    targetRoomNumbers: ['102'],
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    rooms: sampleRooms,
    bookings: [activeBk, noShowBk],
    todayStr: TODAY,
  });
  assert.equal(releasedRes.valid, true);
});

test('6. Calculates accurate Received, Pending & Settlement amounts including POS Room Service', () => {
  const bk = makeBaseBooking({
    id: 'GP-BKG-3001',
    roomNumber: '101',
    bookingAmount: 3000,
    advanceAmount: 1000,
    gstRate: 5,
    isCheckedIn: true,
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-21',
  });
  const checkin: GuestCheckIn = {
    id: 'GP-BKG-3001',
    guestName: bk.guestName,
    mobile: bk.mobile,
    roomNumber: '101',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-21',
    roomRate: 3000,
    advanceAmount: 1000,
    numberOfGuests: 2,
    idType: 'Aadhaar',
    idNumber: '1234',
  } as GuestCheckIn;
  const posOrder: PosOrder = {
    id: 'POS-99',
    roomNumber: '101',
    bookingId: 'GP-BKG-3001',
    orderType: 'Room Service',
    paymentMethod: 'Room Folio',
    paymentStatus: 'Posted to Room',
    isPaid: false,
    subtotal: 400,
    gstAmount: 20,
    totalAmount: 420,
    items: [{ itemId: 'm1', name: 'Biryani', price: 400, quantity: 1 }],
    createdAt: '2026-11-20T13:00:00Z',
    status: 'Served',
  } as unknown as PosOrder;

  const settings = normalizeBillSettings(null, { defaultGstRate: 5 });
  const fin = computeReservationFinancials({
    booking: bk,
    linkedCheckin: checkin,
    posOrders: [posOrder],
    rooms: sampleRooms,
    billSettings: settings,
    configuredDefaultGst: 5,
  });

  // Room 3000 + 5% GST (150) = 3150; POS = 400 + 5% (20) = 420 -> Grand Total = 3570
  assert.equal(fin.totalPayable, 3570);
  assert.equal(fin.receivedAmount, 1000);
  assert.equal(fin.pendingAmount, 2570);
  assert.equal(fin.settlementAmount, 3570);
});

test('7. Merges standalone walk-in check-ins without duplicating linked bookings', () => {
  const bk = makeBaseBooking({ id: 'GP-BKG-4001', roomNumber: '002A', isCheckedIn: true });
  const linkedCi = { id: 'GP-BKG-4001', guestName: 'Sambit Nayak', mobile: '9938994886', roomNumber: '002A', checkInDate: '2026-11-19', checkOutDate: '2026-11-20', roomRate: 2000, advanceAmount: 1000 } as GuestCheckIn;
  const standaloneWalkin = { id: 'WALKIN-501', guestName: 'Rahul Verma', mobile: '9876543210', roomNumber: '101', checkInDate: '2026-11-20', checkOutDate: '2026-11-21', roomRate: 3000, advanceAmount: 3000 } as GuestCheckIn;

  const merged = mergeBookingsAndStandaloneWalkIns([bk], [linkedCi, standaloneWalkin], sampleRooms);
  assert.equal(merged.length, 2, 'Linked booking + standalone walk-in should yield 2 unique rows');
  assert.equal(merged[1].isStandaloneCheckin, true);
  assert.equal(merged[1].booking.bookingSource, 'Walk-in');
});

test('8. Generates UTF-8 BOM Excel CSV & Blank GRC HTML cleanly', () => {
  const bk = makeBaseBooking();
  const settings = normalizeBillSettings(null, { defaultGstRate: 5 });
  const fin = computeReservationFinancials({
    booking: bk,
    rooms: sampleRooms,
    billSettings: settings,
    configuredDefaultGst: 5,
  });
  const csv = buildReservationsCsv([
    {
      booking: bk,
      isStandaloneCheckin: false,
      canonicalStatus: 'Confirmed',
      primarySegment: 'Walk-in',
      segments: ['Walk-in'],
      roomNumbers: ['002A'],
      roomCount: 1,
      displayRoomsLabel: '002A (1 Room)',
      categoryLabel: 'STANDARD ROOM',
      paxTotal: 2,
      adultsCount: 2,
      childrenCount: 0,
      paxLabel: '2 Pax (2A)',
      nightsCount: 1,
      durationHoursLabel: '22 hr',
      bookedOnDate: 'Nov 17, 2026',
      bookedOnTime: '03:52 PM',
      financials: fin,
    },
  ]);
  assert.ok(csv.startsWith('\uFEFFBooking ID,Guest Name'));
  assert.ok(csv.includes('Sambit Nayak'));

  const blankGrc = renderGrcHtml({
    hotel: { name: 'Harsh Hotel', gstNumber: '21AAAAA0000A1Z5' },
    regNo: '____________',
    date: '20-11-2026',
    guestName: '',
  });
  assert.ok(blankGrc.includes('GUEST REGISTRATION CARD'));
  assert.ok(blankGrc.includes('HARSH HOTEL'));
});

console.log(`\nALL ${passed}/8 RESERVATION LIST TESTS PASSED!`);
