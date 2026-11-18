/* End-to-end verification of folioCollector + stayBilling + printTemplates (Invoice & GRC). */
import assert from 'assert';
import { buildStayBill, toInvoicePrintData, toGrcPrintData, allocateInvoiceNumber, allocateGrcNumber } from '../src/utils/stayBilling';
import { renderInvoiceHtml, renderGrcHtml } from '../src/utils/printTemplates';

// 1. Test C1 + C2 + C3 + C5 + C6:
//    - POS order posted to room (grandTotal=525 incl 5% tax, subtotal=500)
//    - Duplicate EC-POS-ORD-101 in checkin.extraCharges AND duplicate in booking.otherServices
//    - Water bottle WB-77 (2 chargeable @ ₹20 = ₹40) + duplicate EC-WB-WB-77
//    - Extra bed (1 x 500 x 2 nights = 1000) + Early check-in ₹300
//    - Room 101 @ ₹2000 x 2 nights = ₹4000
//    - Another guest's unpaid POS order in Room 101 from last month MUST NOT leak!
const { folio, bill, settings } = buildStayBill({
  hotelSettings: {
    name: 'HOTEL M M PRESTIGE',
    address: 'Ramkrishna Care Hospital Road, Raipur',
    gstNumber: '22AENPJ9934P1ZR',
    panNumber: 'AENPJ9934P',
    phoneNumber: '9993264333',
    emailAddress: 'hotelmmprestigeraipur@gmail.com',
    website: 'hotelmmprestige.com',
    defaultGstRate: 5,
    foodGstRate: 5,
    taxOnAncillary: true,
    roomRateIncludesGst: false,
    invoicePrefix: 'MMPR',
    nextInvoiceSequence: 1014,
    grcPrefix: 'HRR',
    nextGrcSequence: 452,
    waterBottleRate: 20,
  },
  booking: {
    id: 'BKG-500',
    bookingNo: '001277',
    customerName: 'Mr. Jogdand Rushikesh Narayan',
    mobile: '9307848492',
    roomNumbers: ['101'],
    checkInDate: '2026-11-14',
    checkOutDate: '2026-11-16',
    nights: 2,
    gstInvoice: true,
    otherServices: [
      { id: 'ORD-101', orderNumber: 'ORD-101', serviceType: 'ROOM SERVICE', description: 'Dup POS', amount: 525, taxAmount: 25 },
      { id: 'ORD-101', orderNumber: 'ORD-101', serviceType: 'ROOM SERVICE', description: 'Dup POS C1', amount: 525, taxAmount: 25 },
    ],
  },
  checkin: {
    id: 'CHK-500',
    bookingId: 'BKG-500',
    guestName: 'Mr. Jogdand Rushikesh Narayan',
    mobile: '9307848492',
    roomNumber: '101',
    roomRate: 2000,
    checkInDate: '2026-11-14',
    checkOutDate: '2026-11-16',
    hasExtraBed: true,
    extraBedCount: 1,
    extraBedRate: 500,
    earlyCheckInCharge: 300,
    advanceAmount: 3000,
    paymentMethod: 'UPI',
    idType: 'Aadhaar Card',
    idNumber: '227873188243',
    extraCharges: [
      { id: 'EC-POS-ORD-101', category: 'Food', sourceType: 'pos_order', sourceId: 'ORD-101', amount: 525, description: 'POS #101' },
      { id: 'EC-WB-WB-77', category: 'Water Bottle', sourceType: 'water_bottle', sourceId: 'WB-77', amount: 40, description: 'Water' },
    ],
  },
  posOrders: [
    { id: 'ORD-101', orderNumber: 'ORD-101', bookingId: 'BKG-500', roomNumber: '101', subtotal: 500, taxAmount: 25, grandTotal: 525, paymentStatus: 'Pending', postToRoomBill: true },
    // Old guest in same room — MUST BE IGNORED!
    { id: 'ORD-OLD', orderNumber: 'ORD-OLD', bookingId: 'BKG-OLD', roomNumber: '101', subtotal: 999, taxAmount: 50, grandTotal: 1049, paymentStatus: 'Pending', postToRoomBill: true },
  ],
  waterBottles: [
    { id: 'WB-77', checkInId: 'CHK-500', roomNumber: '101', quantity: 2, isChargeable: true, unitPrice: 20, chargeAmount: 40, date: '2026-11-15', recordType: 'water' },
  ],
});

// Expected pre-tax: Room 4000 + ExtraBed 1000 + EarlyCheckIn 300 + Food 500 + Water 40 = 5840
assert.strictEqual(bill.legacy.roomCharges, 4000, 'roomCharges');
assert.strictEqual(bill.legacy.extraBedCharges, 1000, 'extraBedCharges');
assert.strictEqual(bill.legacy.earlyCheckInCharges, 300, 'earlyCheckInCharges');
assert.strictEqual(bill.legacy.foodCharges, 500, 'foodCharges (pre-tax, deduped, no old guest leak)');
assert.strictEqual(bill.legacy.waterCharges, 40, 'waterCharges (deduped)');
assert.strictEqual(bill.subtotal, 5840, 'subtotal');
assert.strictEqual(bill.totalTax, 292, '5% GST applied ONCE');
assert.strictEqual(bill.grandTotal, 6132, 'grandTotal');
assert.strictEqual(bill.receipts, 3000, 'receipts');
assert.strictEqual(bill.balance, 3132, 'balance');
assert.strictEqual(bill.paymentStatus, 'Partially Paid', 'paymentStatus');

// 2. Verify Invoice Number & GRC Number formatting + HTML templates
const { invoiceNumber } = allocateInvoiceNumber([], settings, new Date('2025-11-05'));
assert.strictEqual(invoiceNumber, 'MMPR/1014/2025-26');
const grcNo = allocateGrcNumber([], settings, new Date('2026-11-01'));
assert.strictEqual(grcNo, 'HRR/452/26');

const invHtml = renderInvoiceHtml(
  toInvoicePrintData({
    hotel: { name: 'HOTEL M M PRESTIGE', gstNumber: '22AENPJ9934P1ZR', panNumber: 'AENPJ9934P', phoneNumber: '9993264333' },
    invoiceNumber,
    invoiceDate: '2025-11-05',
    booking: { bookingNo: '001277' },
    checkin: { guestName: 'Mr. Jogdand Rushikesh Narayan', mobile: '9307848492', checkInTime: '01:33 PM', checkOutTime: '10:07 AM' },
    folio,
    bill,
    roomType: 'POD',
  })
);
assert(invHtml.includes('TAX INVOICE') && invHtml.includes('ORIGINAL FOR RECIPIENT'), 'Tax Invoice headings');
assert(invHtml.includes('GST : 22AENPJ9934P1ZR') && invHtml.includes('PAN : AENPJ9934P'), 'GST & PAN printed');
assert(invHtml.includes('Invoice Amount In Words:'), 'Amount in words printed');

const grcHtml = renderGrcHtml(
  toGrcPrintData({
    hotel: { name: 'HOTEL RAJ RESIDENCY', gstNumber: '22ACTPJ2554P2Z2', phoneNumber: '7393819381' },
    regNo: grcNo,
    checkin: { guestName: 'Abhishek Anand', address: 'Mumbai', mobile: '8207307178', roomNumber: '102', roomRate: 3600, idType: 'Aadhaar Card', idNumber: '227873188243', checkInDate: '2026-11-01', checkOutDate: '2026-11-03' },
    roomType: 'Deluxe',
    settings,
  })
);
assert(grcHtml.includes('GUEST REGISTRATION CARD') && grcHtml.includes('FOR OFFICE USE ONLY'), 'GRC sections');
assert(grcHtml.includes('Front Office Manager') && grcHtml.includes('Guest Signature'), 'GRC sign strip');

console.log('ALL FOLIO + TEMPLATE TESTS PASSED!');
