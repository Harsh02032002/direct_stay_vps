import assert from 'assert';

console.log('--- Testing QR Standee Direct Booking Form & Guest Self-Service Desk ---');

// Test 1: Self-Service Booking Identification logic
interface MockBooking {
  id: string;
  hotelId: string;
  guestName: string;
  mobile: string;
  roomNumber: string;
  bookingSource?: string;
  isSelfService?: boolean;
  notes?: string;
  status: string;
  isCheckedIn: boolean;
  isCompleted?: boolean;
  idProofUrl?: string;
}

const isGuestSelfService = (b: MockBooking) => {
  return (
    Boolean(b.isSelfService) ||
    b.bookingSource === 'Guest Self Service' ||
    b.bookingSource === 'Website' ||
    b.bookingSource === 'Online' ||
    b.bookingSource === 'Direct Link' ||
    (Boolean(b.id) && b.id.startsWith('WEB-')) ||
    (Boolean(b.notes) && (
      b.notes.includes('Direct Guest Booking') ||
      b.notes.includes('Self Check-In') ||
      b.notes.includes('QR Standee') ||
      b.notes.includes('Needs Hotel Approval')
    ))
  );
};

const bookingsList: MockBooking[] = [
  {
    id: 'WEB-BKG-881204',
    hotelId: 'hotel-1',
    guestName: 'Pooja Sharma',
    mobile: '9876543210',
    roomNumber: '101',
    bookingSource: 'Guest Self Service',
    isSelfService: true,
    status: 'Pending',
    isCheckedIn: false,
    idProofUrl: 'data:image/png;base64,mockdata'
  },
  {
    id: 'GP-BKG-203608',
    hotelId: 'hotel-1',
    guestName: 'Rajesh Gupta',
    mobile: '9811122233',
    roomNumber: '102',
    bookingSource: 'Walk-in / Direct',
    status: 'Confirmed',
    isCheckedIn: false
  },
  {
    id: 'WEB-BKG-992110',
    hotelId: 'hotel-1',
    guestName: 'Amit Verma',
    mobile: '9844455566',
    roomNumber: '103',
    bookingSource: 'Direct Link',
    notes: '[Direct Guest Booking Link • Needs Hotel Approval]',
    status: 'Pending',
    isCheckedIn: false
  }
];

const selfServiceBookings = bookingsList.filter(isGuestSelfService);
console.log(`Found ${selfServiceBookings.length} Self-Service Bookings out of ${bookingsList.length}`);
assert.strictEqual(selfServiceBookings.length, 2, 'Should identify both Pooja and Amit as Self-Service');
assert.strictEqual(selfServiceBookings[0].guestName, 'Pooja Sharma');
assert.strictEqual(selfServiceBookings[1].guestName, 'Amit Verma');
console.log('✓ Test 1 Passed: Self-Service Bookings accurately filtered');

// Test 2: Room tariff extraction with room.rate vs room.price
const mockRoom1 = { number: '101', category: 'Delux', price: 2000 };
const mockRoom2 = { number: '102', category: 'Large', rate: 3000 };

const getTariff = (room: any) => Number(room?.rate || room?.price || 0);
assert.strictEqual(getTariff(mockRoom1), 2000, 'Should fall back to price when rate is undefined');
assert.strictEqual(getTariff(mockRoom2), 3000, 'Should use rate when present');
console.log('✓ Test 2 Passed: Room tariff correctly handles both price and rate');

// Test 3: Standee Room Query Pre-selection
const urlParams = new URLSearchParams('hotelBooking=hotel-1795019869154&room=101');
const queryRoom = urlParams.get('room');
assert.strictEqual(queryRoom, '101', 'Should extract room=101 from standee QR URL');
console.log('✓ Test 3 Passed: Standee Room Query parsed successfully');

// Test 4: Quick Approve Booking
const approveBooking = (bkgId: string, list: MockBooking[]) => {
  return list.map(b => b.id === bkgId ? { ...b, status: 'Confirmed' } : b);
};
const updated = approveBooking('WEB-BKG-881204', bookingsList);
assert.strictEqual(updated.find(b => b.id === 'WEB-BKG-881204')?.status, 'Confirmed');
console.log('✓ Test 4 Passed: 1-click Quick Approve updates status to Confirmed');

console.log('All Unit Tests Passed Successfully!');
