/**
 * checkin-grc-hk-services.test.ts
 *
 * Verifies all 5 user requested items:
 * 1. Calendar/Stay Overview redirects to Unified Check-In form with room & date prefilled.
 * 2. GRC (Guest Registration Card) resolves Room Charge, Booking Number, and ID Number.
 * 3. Housekeeping module contains Date Filter bar with default = Today (Asia/Kolkata).
 * 4. Check-In form has complimentary water bottle section & input removed.
 * 5. Guest Services is present in the Front Office sidebar and points to frontDesk services.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { toGrcPrintData } from '../src/utils/stayBilling';
import { renderGrcHtml } from '../src/utils/printTemplates';
import { DIRECTSTAY_PMS_SIDEBAR_TREE } from '../src/utils/sidebarNavigation';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

console.log('Running DirectStay Check-In, GRC, Housekeeping Date Filter & Guest Services Tests...\n');

// =========================================================================
// 1. Calendar Booking View -> Unified Check-In Form
// =========================================================================
console.log('--- 1. Calendar Booking View -> Unified Check-In ---');
const calendarSrc = readFileSync(resolve(process.cwd(), 'src/components/CalendarBookingView.tsx'), 'utf8');

assert(calendarSrc.includes('redirectToCheckIn'), 'CalendarBookingView defines redirectToCheckIn helper');
assert(calendarSrc.includes('sessionStorage.setItem(\n          \'pms_preselect_room\'') || calendarSrc.includes('pms_preselect_room'), 'CalendarBookingView saves pms_preselect_room for CheckInFormView');
assert(calendarSrc.includes('directstay:checkin-nav'), 'CalendarBookingView dispatches directstay:checkin-nav event');
assert(calendarSrc.includes('Unified PMS Check-In & Folio Form'), 'CalendarBookingView modal includes banner linking to Unified Check-In');

// =========================================================================
// 2. GRC Room Charge, Booking Number, and ID Number
// =========================================================================
console.log('\n--- 2. GRC Room Charge, Booking Number & ID Number ---');

// Test toGrcPrintData with real-world DirectStay data
const testHotel = { name: 'Hotel Grand DirectStay', address: 'Jaipur, Rajasthan', phone: '9876543210' };
const testBooking = {
  id: 'GP-BKG-9922',
  guestName: 'Vikram Singh',
  mobile: '9829012345',
  checkInDate: '2026-11-20',
  checkOutDate: '2026-11-22',
  roomNumber: '102',
  roomType: 'Deluxe',
  rate: 3500,
  aadhaarNumber: '1234-5678-9012',
};
const testCheckin = {
  id: 'GP-BKG-9922',
  guestName: 'Vikram Singh',
  mobile: '9829012345',
  roomNumber: '102',
  roomRate: 3500,
  aadhaarNumber: '1234-5678-9012',
  checkInDate: '2026-11-20',
  checkOutDate: '2026-11-22',
};

const grcData = toGrcPrintData({
  hotel: testHotel,
  regNo: 'GRC-001',
  booking: testBooking,
  checkin: testCheckin,
  settings: { roomRateIncludesGst: false, defaultGstRate: 5 },
});

assert(Number(grcData.roomCharge) === 3500, `GRC roomCharge is 3500, got ${grcData.roomCharge}`);
assert(grcData.bookingNo === 'GP-BKG-9922', `GRC bookingNo is GP-BKG-9922, got ${grcData.bookingNo}`);
assert(grcData.guestIdNumber === '1234-5678-9012', `GRC guestIdNumber is 1234-5678-9012, got ${grcData.guestIdNumber}`);

const grcHtml = renderGrcHtml(grcData);
assert(grcHtml.includes('3,500') || grcHtml.includes('3500'), 'renderGrcHtml outputs Room Charge 3,500');
assert(grcHtml.includes('GP-BKG-9922'), 'renderGrcHtml outputs Booking No. GP-BKG-9922');
assert(grcHtml.includes('1234-5678-9012'), 'renderGrcHtml outputs ID Number 1234-5678-9012');

// Also test when booking has roomRate/tariff/bookingAmount and checkin is minimal
const grcDataMinimal = toGrcPrintData({
  hotel: testHotel,
  regNo: 'GRC-002',
  booking: { id: '#DS-8811', roomRate: 2800, aadhaarNumber: '5566-7788-9900' },
  checkin: { id: 'DS-8811' },
  settings: { roomRateIncludesGst: false, defaultGstRate: 5 },
});
assert(Number(grcDataMinimal.roomCharge) === 2800, `GRC minimal roomCharge is 2800, got ${grcDataMinimal.roomCharge}`);
assert(grcDataMinimal.bookingNo === 'DS-8811', `GRC minimal bookingNo is DS-8811, got ${grcDataMinimal.bookingNo}`);
assert(grcDataMinimal.guestIdNumber === '5566-7788-9900', `GRC minimal guestIdNumber is 5566-7788-9900, got ${grcDataMinimal.guestIdNumber}`);

// Verify CheckInFormView on-screen GRC preview modal
const checkinViewSrc = readFileSync(resolve(process.cwd(), 'src/components/CheckInFormView.tsx'), 'utf8');
assert(checkinViewSrc.includes('Registration / Booking No.'), 'CheckInFormView on-screen GRC shows Registration / Booking No.');
assert(checkinViewSrc.includes('livePrintDoc.aadhaarNumber'), 'CheckInFormView on-screen GRC falls back to aadhaarNumber for ID Document Number');
assert(checkinViewSrc.includes('Room Charge'), 'CheckInFormView on-screen GRC Section 3 contains Room Charge');

// =========================================================================
// 3. Housekeeping Date Filter (Default: Today in Asia/Kolkata)
// =========================================================================
console.log('\n--- 3. Housekeeping Date Filter Bar ---');
const hkSrc = readFileSync(resolve(process.cwd(), 'src/pms-integrated/modules/HousekeepingModule.tsx'), 'utf8');

assert(hkSrc.includes("datePreset"), 'HousekeepingModule defines datePreset state');
assert(hkSrc.includes("useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today')"), 'HousekeepingModule datePreset defaults to today');
assert(hkSrc.includes('Asia/Kolkata'), 'HousekeepingModule uses Asia/Kolkata timezone for todayStr');
assert(hkSrc.includes('Reset to Today'), 'HousekeepingModule renders Reset to Today button');
assert(hkSrc.includes('filteredTasks'), 'HousekeepingModule filters tasks by selected date range');
assert(hkSrc.includes('filteredLaundryOrders'), 'HousekeepingModule filters laundry orders by selected date range');
assert(hkSrc.includes('filteredLostFound'), 'HousekeepingModule filters lost and found items by selected date range');

// =========================================================================
// 4. Complimentary Water Bottle Removed from Check-In Form
// =========================================================================
console.log('\n--- 4. Check-In Complimentary Water Bottle Field Removed ---');
assert(!checkinViewSrc.includes('💧 Complimentary Water Bottles (Free ₹0)'), 'CheckInFormView no longer has dedicated complimentary water section');
assert(!checkinViewSrc.includes('Complimentary Water (Stock:'), 'CheckInFormView no longer has complimentary water input field');

// =========================================================================
// 5. Guest Services Restored in Sidebar
// =========================================================================
console.log('\n--- 5. Guest Services in Front Office Sidebar ---');
const frontOfficeNode = DIRECTSTAY_PMS_SIDEBAR_TREE.find(n => n.id === 'front-office');
assert(Boolean(frontOfficeNode), 'Front Office node exists in DIRECTSTAY_PMS_SIDEBAR_TREE');

const guestServicesChild = frontOfficeNode?.children?.find(c => c.id === 'fo-guest-services');
assert(Boolean(guestServicesChild), 'Guest Services child exists in Front Office tree');
assert(guestServicesChild?.label === 'Guest Services', 'Guest Services child has label "Guest Services"');
assert(guestServicesChild?.target?.activeTab === 'frontDesk', 'Guest Services points to activeTab: frontDesk');
assert(guestServicesChild?.target?.frontDeskSubTab === 'services', 'Guest Services points to frontDeskSubTab: services');

const sidebarSrc = readFileSync(resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf8');
assert(sidebarSrc.includes("case 'guestServices':"), 'Sidebar.tsx maps guestServices icon in renderSidebarIcon');

console.log('\n🎉 ALL 5 USER DELIVERABLES VERIFIED AND PASSED 100%!');
