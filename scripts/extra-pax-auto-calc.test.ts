import assert from 'node:assert/strict';
import { calculateCheckInExtraCharges } from '../src/utils/checkInExtraCharges';
import { calculateBill } from '../src/utils/billCalculator';

console.log('--- Testing Extra Pax Auto-Calculation & Capacity Logic ---');

// 1. Room 102 Config: Category Large, Rate ₹3000, Base Occ 1, Max Occ 3, Extra Pax ₹500
const room102 = {
  number: '102',
  category: 'Large',
  rate: 3000,
  baseOccupancy: 1,
  maxOccupancy: 3,
  extraPersonCharge: 500,
  allowExtraBed: false,
};

// Case A: 4 Adults in Room 102 (Base Occ = 1) -> 3 Extra Persons
const adultsA = 4;
const baseOccA = room102.baseOccupancy;
const maxOccA = room102.maxOccupancy;
const extraGuestsCountA = Math.max(0, adultsA - baseOccA);
assert.equal(extraGuestsCountA, 3, 'Extra guests count should be 3 for 4 adults in Room 102');

// Over capacity check
const isOverCapacityA = adultsA > maxOccA;
assert.equal(isOverCapacityA, true, '4 adults exceeds Max Occupancy 3');

// Auto extra charges calculation (1 night)
const extraChargesA = calculateCheckInExtraCharges({
  extraPerson: {
    enabled: extraGuestsCountA > 0,
    quantity: extraGuestsCountA,
    ratePerNight: room102.extraPersonCharge,
    applicableNights: 1,
  },
  extraBed: {
    enabled: false,
    quantity: 1,
    ratePerNight: 500,
    applicableNights: 1,
  },
  roomNumber: '102',
});

assert.equal(extraChargesA.extraPersonQty, 3, 'Extra person qty should be 3');
assert.equal(extraChargesA.extraPersonTotal, 1500, '3 extra persons @ ₹500 should be ₹1,500');

// Bill Calculation with Room Rate ₹3000 + Extra Pax ₹1500
const billA = calculateBill({
  charges: [
    {
      id: 'ci-room',
      kind: 'room',
      description: 'Room 102 Charges (1N)',
      amount: room102.rate,
      rate: room102.rate,
      nights: 1,
      roomNumber: '102',
    },
    ...extraChargesA.charges,
  ],
  payments: [],
  settings: {
    taxType: 'gst',
    gstRate: 0,
    isWithoutGst: true,
  },
});

assert.equal(billA.subtotal, 4500, 'Total bill should be ₹4,500 (₹3,000 Room + ₹1,500 Extra Pax)');
console.log('Case A (4 Adults in Room 102): Total ₹4,500 (Room ₹3,000 + Extra Pax ₹1,500) -> PASSED');

// Case B: 2 Adults in Room 102 (Base Occ = 1) -> 1 Extra Person (within Max 3)
const adultsB = 2;
const extraGuestsCountB = Math.max(0, adultsB - baseOccA);
assert.equal(extraGuestsCountB, 1, 'Extra guests count should be 1');
const isOverCapacityB = adultsB > maxOccA;
assert.equal(isOverCapacityB, false, '2 adults is within Max Occupancy 3');

const extraChargesB = calculateCheckInExtraCharges({
  extraPerson: {
    enabled: extraGuestsCountB > 0,
    quantity: extraGuestsCountB,
    ratePerNight: room102.extraPersonCharge,
    applicableNights: 1,
  },
  extraBed: { enabled: false, quantity: 1, ratePerNight: 500, applicableNights: 1 },
  roomNumber: '102',
});

assert.equal(extraChargesB.extraPersonQty, 1);
assert.equal(extraChargesB.extraPersonTotal, 500, '1 extra person @ ₹500 should be ₹500');
console.log('Case B (2 Adults in Room 102): Total Extra Pax ₹500 -> PASSED');

// Case C: 1 Adult in Room 102 (Base Occ = 1) -> 0 Extra Persons
const adultsC = 1;
const extraGuestsCountC = Math.max(0, adultsC - baseOccA);
assert.equal(extraGuestsCountC, 0, 'Extra guests count should be 0');
const extraChargesC = calculateCheckInExtraCharges({
  extraPerson: {
    enabled: extraGuestsCountC > 0,
    quantity: Math.max(1, extraGuestsCountC),
    ratePerNight: room102.extraPersonCharge,
    applicableNights: 1,
  },
  extraBed: { enabled: false, quantity: 1, ratePerNight: 500, applicableNights: 1 },
  roomNumber: '102',
});
assert.equal(extraChargesC.extraPersonTotal, 0, '0 extra persons should be ₹0');
console.log('Case C (1 Adult in Room 102): Total Extra Pax ₹0 -> PASSED');

console.log('All Extra Pax Auto-Calculation tests passed successfully!');
