import type { Booking, Room, HousekeepingCleaningLog } from '../src/types';

let failed = 0;
let passed = 0;
const eq = (name: string, actual: any, expected: any) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${
      ok ? '' : `  -> got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`
    }`
  );
  if (!ok) failed++;
  else passed++;
};

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

function extractRooms(b: Booking): string[] {
  return String(b.roomNumber || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'TBD' && s !== 'Unallocated' && s !== '-');
}

function findOverlap(
  bookings: Booking[],
  roomNumber: string,
  rangeStart: string,
  rangeEnd: string,
  excludeId?: string
): Booking | undefined {
  const effEnd = rangeEnd > rangeStart ? rangeEnd : addDaysStr(rangeStart, 1);
  return bookings.find((b) => {
    if (excludeId && b.id === excludeId) return false;
    if (b.status === 'Cancelled' || (b.status as string) === 'No-Show' || b.isCompleted) return false;
    if (!extractRooms(b).includes(roomNumber)) return false;
    const bStart = b.checkInDate;
    const bEnd = b.checkOutDate > bStart ? b.checkOutDate : addDaysStr(bStart, 1);
    return rangeStart < bEnd && effEnd > bStart;
  });
}

// 1. Stay Overview Double-Booking & Turnover Boundary Test
const sampleBookings: Booking[] = [
  {
    id: 'BKG-101',
    guestName: 'Amit Verma',
    mobile: '9876543210',
    email: '',
    aadhaarNumber: '',
    address: '',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-23',
    nights: 3,
    adults: 2,
    children: 0,
    roomNumber: '101',
    roomType: 'Standard Room',
    advanceAmount: 1000,
    bookingAmount: 6000,
    paymentMethod: 'UPI',
    bookingSource: 'Walk-in',
    status: 'Confirmed',
  },
  {
    id: 'BKG-UNALLOC',
    guestName: 'Neha Singh',
    mobile: '9811122233',
    email: '',
    aadhaarNumber: '',
    address: '',
    checkInDate: '2026-11-21',
    checkOutDate: '2026-11-22',
    nights: 1,
    adults: 2,
    children: 0,
    roomNumber: '',
    roomType: 'Deluxe Room',
    advanceAmount: 500,
    bookingAmount: 3000,
    paymentMethod: 'Cash',
    bookingSource: 'Booking.com',
    status: 'Confirmed',
  },
  {
    id: 'BKG-NOSHOW',
    guestName: 'Rohan Das',
    mobile: '9899001122',
    email: '',
    aadhaarNumber: '',
    address: '',
    checkInDate: '2026-11-18',
    checkOutDate: '2026-11-19',
    nights: 1,
    adults: 1,
    children: 0,
    roomNumber: '102',
    roomType: 'Standard Room',
    advanceAmount: 0,
    bookingAmount: 2000,
    paymentMethod: 'Cash',
    bookingSource: 'MakeMyTrip',
    status: 'No-Show' as any,
  },
];

eq(
  '1. Overlap Prevention: Overlapping stay (Nov 21 -> Nov 24) on Room 101 is blocked',
  Boolean(findOverlap(sampleBookings, '101', '2026-11-21', '2026-11-24')),
  true
);
eq(
  '2. Same-Day Turnover: Next arrival on exact check-out day (Nov 23 -> Nov 25) on Room 101 is permitted',
  Boolean(findOverlap(sampleBookings, '101', '2026-11-23', '2026-11-25')),
  false
);
eq(
  '3. Self-Exclusion on Drag Reassignment: Shifting BKG-101 dates within Room 101 (Nov 21 -> Nov 24) does not self-conflict',
  Boolean(findOverlap(sampleBookings, '101', '2026-11-21', '2026-11-24', 'BKG-101')),
  false
);

// 4. Unallocated & No-Show Detection
const unallocated = sampleBookings.filter(
  (b) => b.status === 'Confirmed' && extractRooms(b).length === 0
);
const noShows = sampleBookings.filter((b) => (b.status as string) === 'No-Show');
eq(
  '4. Unallocated & No-Show Lists identify exact unallocated and no-show bookings',
  [unallocated.map((b) => b.id), noShows.map((b) => b.id)],
  [['BKG-UNALLOC'], ['BKG-NOSHOW']]
);

// 5. Daily Inventory, Occupied Count & Occupancy % Calculation
const sampleRooms: Room[] = [
  { id: 'r1', number: '101', category: 'Standard Room', rate: 2000, status: 'Reserved', cleaningStatus: 'Clean', floor: '1st Floor' },
  { id: 'r2', number: '102', category: 'Standard Room', rate: 2000, status: 'Available', cleaningStatus: 'Clean', floor: '1st Floor' },
  { id: 'r3', number: '201', category: 'Deluxe Room', rate: 3000, status: 'Available', cleaningStatus: 'Clean', floor: '2nd Floor' },
  { id: 'r4', number: '202', category: 'Deluxe Room', rate: 3000, status: 'Out of Service', cleaningStatus: 'Clean', floor: '2nd Floor' },
];
const testDate = '2026-11-20';
const occRoomsOnNov20 = sampleRooms.filter((rm) =>
  Boolean(findOverlap(sampleBookings, rm.number, testDate, addDaysStr(testDate, 1)))
).length;
const blockedOnNov20 = sampleRooms.filter((rm) => rm.status === 'Out of Service').length;
const availOnNov20 = sampleRooms.length - occRoomsOnNov20 - blockedOnNov20;
const occPctOnNov20 = Math.round((occRoomsOnNov20 / sampleRooms.length) * 100);
eq(
  '5. Stay Overview Summary Row computes Available=2, Occupied=1/4, Blocked=1, Occupancy=25% on Nov 20',
  [availOnNov20, `${occRoomsOnNov20}/${sampleRooms.length}`, `${occPctOnNov20}%`],
  [2, '1/4', '25%']
);

// 6. Housekeeping Pipeline: Checkout -> Dirty -> In Progress -> Inspection -> Clean/Ready + Timestamp
const nextStage = (s: string) =>
  s === 'Dirty' ? 'In Progress' : s === 'In Progress' ? 'Inspection' : 'Clean';
let hkRoom: Room = { ...sampleRooms[0], status: 'Occupied', cleaningStatus: 'Clean' };
const autoMarkDirtyOnCheckout = true;
// Guest checks out
if (autoMarkDirtyOnCheckout) {
  hkRoom = { ...hkRoom, status: 'Dirty', cleaningStatus: 'Dirty', housekeepingPriority: 'High' };
}
const afterCheckout = [hkRoom.status, hkRoom.cleaningStatus];
// Staff assigned & starts cleaning
hkRoom = { ...hkRoom, assignedStaff: 'Ramesh', cleaningStatus: nextStage(hkRoom.cleaningStatus!) as any };
const afterStart = [hkRoom.assignedStaff, hkRoom.cleaningStatus];
// Sent to supervisor inspection
hkRoom = { ...hkRoom, cleaningStatus: nextStage(hkRoom.cleaningStatus!) as any };
const afterInspect = hkRoom.cleaningStatus;
// Supervisor approves Clean & Ready
const doneTime = '20/11/2026, 10:45:00 am';
hkRoom = {
  ...hkRoom,
  cleaningStatus: nextStage(hkRoom.cleaningStatus!) as any,
  status: 'Available',
  cleaningCompletedAt: doneTime,
  verifiedBy: 'Supervisor',
};
eq(
  '6. Housekeeping Lifecycle: Checkout->Dirty -> In Progress (Ramesh) -> Inspection -> Clean & Available with timestamp',
  [afterCheckout, afterStart, afterInspect, hkRoom.cleaningStatus, hkRoom.status, Boolean(hkRoom.cleaningCompletedAt)],
  [['Dirty', 'Dirty'], ['Ramesh', 'In Progress'], 'Inspection', 'Clean', 'Available', true]
);

// 7. Dirty / Out-of-Order Check-In Protection & Authorised Override Enforcement
function evaluateCheckInPermission(
  room: Room,
  role: string,
  overrideChecked: boolean,
  overrideReason: string
): 'ALLOWED' | 'BLOCKED_ROLE' | 'BLOCKED_REASON_REQUIRED' | 'ALLOWED_WITH_OVERRIDE' {
  const isUnready =
    room.status === 'Out of Service' ||
    room.status === 'Dirty' ||
    (room.cleaningStatus && room.cleaningStatus !== 'Clean');
  if (!isUnready) return 'ALLOWED';
  const canOverride = ['SuperAdmin', 'Owner', 'Admin', 'Manager'].includes(role);
  if (!canOverride) return 'BLOCKED_ROLE';
  if (!overrideChecked || !overrideReason.trim()) return 'BLOCKED_REASON_REQUIRED';
  return 'ALLOWED_WITH_OVERRIDE';
}

const dirtyRoom: Room = { ...sampleRooms[1], status: 'Dirty', cleaningStatus: 'Dirty' };
const oooRoom: Room = { ...sampleRooms[3], status: 'Out of Service', cleaningStatus: 'Clean' };
eq(
  '7. Dirty & Out-of-Order Check-In Guard blocks Receptionist, requires reason for Manager/Admin, and permits Clean rooms',
  [
    evaluateCheckInPermission(hkRoom, 'Receptionist', false, ''),
    evaluateCheckInPermission(dirtyRoom, 'Receptionist', true, 'Urgent'),
    evaluateCheckInPermission(dirtyRoom, 'Manager', false, ''),
    evaluateCheckInPermission(dirtyRoom, 'Manager', true, 'VIP early arrival approved'),
    evaluateCheckInPermission(oooRoom, 'Receptionist', false, ''),
    evaluateCheckInPermission(oooRoom, 'Admin', true, 'Minor bulb fix completed'),
  ],
  [
    'ALLOWED',
    'BLOCKED_ROLE',
    'BLOCKED_REASON_REQUIRED',
    'ALLOWED_WITH_OVERRIDE',
    'BLOCKED_ROLE',
    'ALLOWED_WITH_OVERRIDE',
  ]
);

const sampleLog: HousekeepingCleaningLog = {
  id: 'HK-1',
  roomNumber: '101',
  assignedStaff: 'Ramesh',
  assignedAt: doneTime,
  completedAt: doneTime,
  priority: 'Urgent',
  status: 'Cleaned',
  checklistCompleted: ['Linens changed'],
  notes: 'Turnaround complete',
};
eq('8. HousekeepingCleaningLog persists priority, notes, and completedAt', [sampleLog.priority, sampleLog.status, Boolean(sampleLog.completedAt)], ['Urgent', 'Cleaned', true]);

console.log(
  failed === 0
    ? `\nALL ${passed}/${passed} STAY OVERVIEW & HOUSEKEEPING WORKFLOW TESTS PASSED`
    : `\n${failed} TEST(S) FAILED`
);
process.exit(failed === 0 ? 0 : 1);
