import assert from 'assert';
import { HotelSettings, Booking, GuestCheckIn } from '../src/types';

console.log('--- Testing Back-Dated Check-In & Past-Time Logic ---');

// 1. Verify types
const defaultSettings: HotelSettings = {
  logoUrl: '',
  name: 'Harsh Hotel',
  address: 'Test Address',
  gstNumber: '07AAAAA0000A1Z5',
  phoneNumber: '9876543210',
  emailAddress: 'test@example.com',
  website: 'https://directstay.online',
  allowBackDatedCheckIn: false,
};

assert.strictEqual(defaultSettings.allowBackDatedCheckIn, false, 'Default allowBackDatedCheckIn should be false');

// 2. Simulated validation rule function
function validateCheckInArrival(
  arrivalDate: string,
  arrivalTimeHhmm: string,
  settings: HotelSettings,
  nowDate: string,
  nowHhmm: string
): { allowed: boolean; error?: string; isBackDated: boolean } {
  const isBackDate = arrivalDate < nowDate;
  const isBackTime = arrivalDate === nowDate && arrivalTimeHhmm < nowHhmm;
  const isRetrospective = isBackDate || isBackTime;

  if (isRetrospective && !settings.allowBackDatedCheckIn) {
    return {
      allowed: false,
      error: 'Past arrival date/time blocked. Enable back-dated check-in in Property Setup.',
      isBackDated: false,
    };
  }

  return {
    allowed: true,
    isBackDated: isRetrospective,
  };
}

const todayStr = '2026-11-21';
const currentHhmm = '20:30';

// Test Case A: Toggle OFF -> Past date rejected
const r1 = validateCheckInArrival('2026-11-20', '14:00', defaultSettings, todayStr, currentHhmm);
assert.strictEqual(r1.allowed, false, 'Should block past date when toggle is OFF');

// Test Case B: Toggle OFF -> Past time on today rejected
const r2 = validateCheckInArrival('2026-11-21', '10:00', defaultSettings, todayStr, currentHhmm);
assert.strictEqual(r2.allowed, false, 'Should block past time today when toggle is OFF');

// Test Case C: Toggle OFF -> Future or current time on today allowed
const r3 = validateCheckInArrival('2026-11-21', '21:00', defaultSettings, todayStr, currentHhmm);
assert.strictEqual(r3.allowed, true, 'Should allow future time today when toggle is OFF');
assert.strictEqual(r3.isBackDated, false);

// Test Case D: Toggle ON -> Past date allowed and flagged
const activeSettings: HotelSettings = { ...defaultSettings, allowBackDatedCheckIn: true };
const r4 = validateCheckInArrival('2026-11-19', '11:00', activeSettings, todayStr, currentHhmm);
assert.strictEqual(r4.allowed, true, 'Should allow past date when toggle is ON');
assert.strictEqual(r4.isBackDated, true, 'Should flag as isBackDated');

// Test Case E: Toggle ON -> Past time today allowed and flagged
const r5 = validateCheckInArrival('2026-11-21', '09:15', activeSettings, todayStr, currentHhmm);
assert.strictEqual(r5.allowed, true, 'Should allow past time today when toggle is ON');
assert.strictEqual(r5.isBackDated, true, 'Should flag as isBackDated');

console.log('✅ ALL BACK-DATED CHECK-IN & BACK-TIME UNIT TESTS PASSED!');
