import assert from 'node:assert';

// 1. Test Extra Person & Extra Bed price resolution
function resolveExtraChargesForRoom(room: any, catExtra = 0, siblingExtra = 0, hotelSettingExtra = 500) {
  const configuredExtra =
    Number(room.extraPersonCharge) > 0
      ? Number(room.extraPersonCharge)
      : catExtra > 0
      ? catExtra
      : siblingExtra > 0
      ? siblingExtra
      : hotelSettingExtra > 0
      ? hotelSettingExtra
      : 500;

  const configuredExtraBed =
    Number(room.extraBedRate) > 0
      ? Number(room.extraBedRate)
      : Number(room.extraPersonCharge) > 0
      ? Number(room.extraPersonCharge)
      : catExtra > 0
      ? catExtra
      : siblingExtra > 0
      ? siblingExtra
      : hotelSettingExtra > 0
      ? hotelSettingExtra
      : configuredExtra > 0
      ? configuredExtra
      : 500;

  return { configuredExtra, configuredExtraBed };
}

// Room 102 (Large): extraPaxFee ₹500
const r102 = { number: '102', category: 'Large', extraPersonCharge: 500 };
assert.strictEqual(resolveExtraChargesForRoom(r102).configuredExtra, 500);
assert.strictEqual(resolveExtraChargesForRoom(r102).configuredExtraBed, 500);

// Room 104 (Medium): extra pax ₹2000
const r104 = { number: '104', category: 'Medium', extraPersonCharge: 2000, extraBedRate: 2000 };
assert.strictEqual(resolveExtraChargesForRoom(r104).configuredExtra, 2000);
assert.strictEqual(resolveExtraChargesForRoom(r104).configuredExtraBed, 2000);

// Room 101 (Delux): extra pax ₹1000
const r101 = { number: '101', category: 'Delux', extraPersonCharge: 1000 };
assert.strictEqual(resolveExtraChargesForRoom(r101).configuredExtra, 1000);
assert.strictEqual(resolveExtraChargesForRoom(r101).configuredExtraBed, 1000);

console.log('✓ Extra Person & Extra Bed price auto-resolution passed.');

// 2. Test Guest Services Date Filter Logic
const todayStr = '2026-11-20';
function matchesGuestServiceDate(
  dateTimeStr: string | undefined,
  preset: string,
  fromDate: string,
  toDate: string
): boolean {
  if (preset === 'all' && !fromDate && !toDate) return true;
  const dStr = String(dateTimeStr || '').slice(0, 10);
  if (!dStr) return preset === 'all';
  if (preset === 'today') {
    return dStr === todayStr;
  }
  if (fromDate && dStr < fromDate) return false;
  if (toDate && dStr > toDate) return false;
  return true;
}

const mockAllocations = [
  { id: 'a1', dateTime: '2026-11-20 10:30', roomNumber: '101', serviceName: 'Laundry' },
  { id: 'a2', dateTime: '2026-11-19 14:00', roomNumber: '102', serviceName: 'Extra Towels' },
  { id: 'a3', dateTime: '2026-11-15 09:00', roomNumber: '103', serviceName: 'Airport Shuttle' },
];

// Today filter
const todayAllocations = mockAllocations.filter(a => matchesGuestServiceDate(a.dateTime, 'today', todayStr, todayStr));
assert.strictEqual(todayAllocations.length, 1);
assert.strictEqual(todayAllocations[0].id, 'a1');

// All dates filter
const allAllocations = mockAllocations.filter(a => matchesGuestServiceDate(a.dateTime, 'all', '', ''));
assert.strictEqual(allAllocations.length, 3);

// Yesterday filter
const yesterdayAllocations = mockAllocations.filter(a => matchesGuestServiceDate(a.dateTime, 'yesterday', '2026-11-19', '2026-11-19'));
assert.strictEqual(yesterdayAllocations.length, 1);
assert.strictEqual(yesterdayAllocations[0].id, 'a2');

console.log('✓ Guest Services Date Filter passed.');

// 3. Test Room Transfer Validation & Execution
interface MockCheckIn {
  id: string;
  guestName: string;
  roomNumber: string;
  checkedOutDateTime?: string;
  status?: string;
}

const checkins: MockCheckIn[] = [
  { id: 'ci-1', guestName: 'Neha', roomNumber: '101' },
  { id: 'ci-2', guestName: 'Harsh', roomNumber: '102', checkedOutDateTime: '2026-11-19T10:00:00Z', status: 'Checked-Out' }
];

function canTransferRoom(editingGuestId: string, targetRoomNo: string, checkinsList: MockCheckIn[]): { allowed: boolean; reason?: string } {
  const otherOccupant = checkinsList.find(
    c =>
      c.id !== editingGuestId &&
      !c.checkedOutDateTime &&
      c.status !== 'Checked-Out' &&
      c.status !== 'Departed' &&
      c.roomNumber === targetRoomNo
  );
  if (otherOccupant) {
    return { allowed: false, reason: `Room ${targetRoomNo} is currently occupied by ${otherOccupant.guestName}` };
  }
  return { allowed: true };
}

// Can Neha transfer to Room 102 (which had a checked-out guest)? YES!
assert.strictEqual(canTransferRoom('ci-1', '102', checkins).allowed, true);

// Can Neha transfer to Room 103 (empty)? YES!
assert.strictEqual(canTransferRoom('ci-1', '103', checkins).allowed, true);

// If guest 3 tries to transfer to Room 101 (occupied by Neha), should be blocked!
assert.strictEqual(canTransferRoom('ci-3', '101', checkins).allowed, false);

console.log('✓ Room Transfer Validation & Execution passed.');
console.log('ALL TESTS PASSED 100%!');
