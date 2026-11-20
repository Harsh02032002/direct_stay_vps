import assert from 'node:assert/strict';
import {
  calculateCheckInExtraCharges,
  previewCheckInSettlementWithExtras,
} from '../src/utils/checkInExtraCharges';
import { normalizeBillSettings } from '../src/utils/billCalculator';
import { buildStayBill } from '../src/utils/stayBilling';
import { Booking, GuestCheckIn, Room } from '../src/types';

const settings = normalizeBillSettings(null, { defaultGstRate: 5, taxOnExtraBed: true });

const rooms: Room[] = [
  { id: 'r1', number: '101', category: 'Deluxe Room', floor: 1, rate: 2000, extraPersonCharge: 500, status: 'Available', cleaningStatus: 'Clean' } as Room,
  { id: 'r2', number: '102', category: 'Deluxe Room', floor: 1, rate: 2000, extraPersonCharge: 500, status: 'Available', cleaningStatus: 'Clean' } as Room,
];

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  PASS [${passed}]: ${name}`);
}

console.log('Running Check-In Extra Person & Extra Bed/Mattress Verification Suite...\n');

test('1. Both checkboxes OFF by default -> ₹0 extra charges, only Room + GST billed', () => {
  const res = previewCheckInSettlementWithExtras({
    roomRatePerNight: 2000,
    stayNights: 2,
    roomNumber: '101',
    extraPerson: { enabled: false, quantity: 2, ratePerNight: 500, applicableNights: 2 },
    extraBed: { enabled: false, quantity: 1, ratePerNight: 600, applicableNights: 2 },
    gstPercent: 5,
    advancePaid: 1000,
    settings,
  });
  assert.equal(res.extras.extraPersonTotal, 0);
  assert.equal(res.extras.extraBedTotal, 0);
  assert.equal(res.extras.charges.length, 0);
  assert.equal(res.roomTotal, 4000);
  assert.equal(res.gstAmount, 200);
  assert.equal(res.finalSettlement, 4200);
  assert.equal(res.pendingBalance, 3200);
});

test('2. Extra Person ON only -> calculates Qty × Rate × Nights and updates GST & Pending Balance', () => {
  const res = previewCheckInSettlementWithExtras({
    roomRatePerNight: 2000,
    stayNights: 3,
    roomNumber: '101',
    extraPerson: { enabled: true, quantity: 2, ratePerNight: 500, applicableNights: 3 },
    extraBed: { enabled: false, quantity: 1, ratePerNight: 600, applicableNights: 3 },
    gstPercent: 5,
    advancePaid: 2000,
    paidNow: 1000,
    settings,
  });
  // Room = 6000, Extra Person = 2 * 500 * 3 = 3000 -> Subtotal = 9000, GST 5% = 450, Total = 9450, Paid = 3000, Pending = 6450
  assert.equal(res.extras.extraPersonTotal, 3000);
  assert.equal(res.extras.extraBedTotal, 0);
  assert.equal(res.extras.charges.length, 1);
  assert.equal(res.extras.charges[0].kind, 'extra_person');
  assert.equal(res.gstAmount, 450);
  assert.equal(res.finalSettlement, 9450);
  assert.equal(res.pendingBalance, 6450);
});

test('3. Extra Bed/Mattress ON only -> calculates Qty × Rate × Nights independently', () => {
  const res = previewCheckInSettlementWithExtras({
    roomRatePerNight: 2000,
    stayNights: 2,
    roomNumber: '101',
    extraPerson: { enabled: false, quantity: 2, ratePerNight: 500, applicableNights: 2 },
    extraBed: { enabled: true, quantity: 2, ratePerNight: 600, applicableNights: 2 },
    gstPercent: 5,
    advancePaid: 1000,
    settings,
  });
  // Room = 4000, Extra Bed = 2 * 600 * 2 = 2400 -> Subtotal = 6400, GST 5% = 320, Total = 6720, Pending = 5720
  assert.equal(res.extras.extraPersonTotal, 0);
  assert.equal(res.extras.extraBedTotal, 2400);
  assert.equal(res.extras.charges.length, 1);
  assert.equal(res.extras.charges[0].kind, 'extra_bed');
  assert.equal(res.gstAmount, 320);
  assert.equal(res.finalSettlement, 6720);
  assert.equal(res.pendingBalance, 5720);
});

test('4. BOTH Extra Person AND Extra Bed/Mattress ON -> calculates both separately without merging or duplicating', () => {
  const res = previewCheckInSettlementWithExtras({
    roomRatePerNight: 2000,
    stayNights: 2,
    roomNumber: '101',
    extraPerson: { enabled: true, quantity: 1, ratePerNight: 500, applicableNights: 2 },
    extraBed: { enabled: true, quantity: 1, ratePerNight: 700, applicableNights: 2 },
    gstPercent: 5,
    advancePaid: 2000,
    settings,
  });
  // Room = 4000, Extra Person = 1000, Extra Bed = 1400 -> Subtotal = 6400, GST 5% = 320, Total = 6720, Pending = 4720
  assert.equal(res.extras.extraPersonTotal, 1000);
  assert.equal(res.extras.extraBedTotal, 1400);
  assert.equal(res.extras.combinedExtrasTotal, 2400);
  assert.equal(res.extras.charges.length, 2);
  assert.equal(res.bill.legacy.extraPersonCharges, 1000);
  assert.equal(res.bill.legacy.extraBedCharges, 1400);
  assert.equal(res.gstAmount, 320);
  assert.equal(res.finalSettlement, 6720);
  assert.equal(res.pendingBalance, 4720);
});

test('5. Unchecking removes charge immediately & Manual Price Overrides (custom & ₹0) work accurately', () => {
  const overridden = calculateCheckInExtraCharges({
    extraPerson: { enabled: true, quantity: 2, ratePerNight: 350, applicableNights: 1 },
    extraBed: { enabled: true, quantity: 1, ratePerNight: 0, applicableNights: 2 },
    roomNumber: '101',
  });
  assert.equal(overridden.extraPersonTotal, 700);
  assert.equal(overridden.extraBedTotal, 0);
  assert.equal(overridden.charges.length, 1);

  const afterUncheck = calculateCheckInExtraCharges({
    extraPerson: { enabled: false, quantity: 2, ratePerNight: 350, applicableNights: 1 },
    extraBed: { enabled: false, quantity: 1, ratePerNight: 600, applicableNights: 2 },
    roomNumber: '101',
  });
  assert.equal(afterUncheck.extraPersonTotal, 0);
  assert.equal(afterUncheck.extraBedTotal, 0);
  assert.equal(afterUncheck.charges.length, 0);
});

test('6. Folio Collector & StayBill prevent duplicate charges across Single Check-In, Group Check-In & Pre-Arrival Booking', () => {
  const bk: Booking = {
    id: 'GP-BKG-9001',
    guestName: 'Test Guest',
    mobile: '9999999999',
    email: '',
    aadhaarNumber: '',
    address: '',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    nights: 2,
    adults: 3,
    children: 0,
    roomNumber: '101',
    roomType: 'Deluxe Room',
    roomSubtotal: 4000,
    bookingAmount: 4000,
    hasExtraPerson: true,
    extraPersonCount: 1,
    extraPersonRate: 450,
    extraPersonNights: 2,
    extraPersonChargeApplied: 900,
    hasExtraBed: true,
    extraBedCount: 1,
    extraBedRate: 650,
    extraBedNights: 2,
    extraBedTotal: 1300,
    advanceAmount: 1000,
    paymentMethod: 'Cash',
    bookingSource: 'Walk-in',
    status: 'Checked-In',
    isCheckedIn: true,
    gstRate: 5,
  };

  // Pre-arrival (Booking only)
  const preArrivalBill = buildStayBill({ booking: bk, rooms, settings, gstEnabledOverride: true });
  assert.equal(preArrivalBill.bill.legacy.roomCharges, 4000);
  assert.equal(preArrivalBill.bill.legacy.extraPersonCharges, 900);
  assert.equal(preArrivalBill.bill.legacy.extraBedCharges, 1300);
  assert.equal(preArrivalBill.bill.subtotal, 6200);
  assert.equal(preArrivalBill.bill.grandTotal, 6510);

  // Checked-In (Booking + GuestCheckIn both present — must NOT double-charge!)
  const ci: GuestCheckIn = {
    id: 'GP-BKG-9001',
    guestName: 'Test Guest',
    mobile: '9999999999',
    roomNumber: '101',
    roomRate: 2000,
    roomSubtotal: 4000,
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    hasExtraPerson: true,
    extraPersonCount: 1,
    extraPersonRate: 450,
    extraPersonNights: 2,
    extraPersonChargeApplied: 900,
    hasExtraBed: true,
    extraBedCount: 1,
    extraBedRate: 650,
    extraBedNights: 2,
    extraBedTotal: 1300,
    advanceAmount: 1000,
  } as GuestCheckIn;

  const checkedInBill = buildStayBill({ booking: bk, checkin: ci, rooms, settings, gstEnabledOverride: true });
  assert.equal(checkedInBill.bill.legacy.roomCharges, 4000);
  assert.equal(checkedInBill.bill.legacy.extraPersonCharges, 900);
  assert.equal(checkedInBill.bill.legacy.extraBedCharges, 1300);
  assert.equal(checkedInBill.bill.subtotal, 6200);
  assert.equal(checkedInBill.bill.grandTotal, 6510);
  assert.equal(checkedInBill.bill.balance, 5510);

  // Group Check-In with both Extra Person & Extra Bed -> must collect both without duplication!
  const groupCi: GuestCheckIn = {
    ...ci,
    id: 'GRP-9002',
    roomNumber: '101, 102',
    isGroupCheckIn: true,
    bookedRooms: [
      { roomNumber: '101', category: 'Deluxe Room', rate: 2000, originalRate: 2000, discountAmountOfRoom: 0, guestsCount: 2, extraGuestsCount: 0, extraPersonChargeApplied: 0, totalRoomAmount: 4000, hasExtraBed: true, extraBedCount: 1, extraBedRate: 650 },
      { roomNumber: '102', category: 'Deluxe Room', rate: 2000, originalRate: 2000, discountAmountOfRoom: 0, guestsCount: 3, extraGuestsCount: 1, extraPersonChargeApplied: 0, totalRoomAmount: 4000, hasExtraBed: false, extraBedCount: 0, extraBedRate: 0 },
    ],
  } as GuestCheckIn;
  const groupBill = buildStayBill({ checkin: groupCi, rooms, settings, gstEnabledOverride: true });
  assert.equal(groupBill.bill.legacy.roomCharges, 8000);
  assert.equal(groupBill.bill.legacy.extraPersonCharges, 900);
  assert.equal(groupBill.bill.legacy.extraBedCharges, 1300);
  assert.equal(groupBill.bill.subtotal, 10200);
});

console.log(`\nALL ${passed}/6 CHECK-IN EXTRA PERSON & EXTRA BED TESTS PASSED!`);
