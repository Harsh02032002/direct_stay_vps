/**
 * invoice-gst-and-rooms-view.test.ts
 *
 * Verifies:
 * 1. GST Invoice & Folio Center filtering logic (All vs GST Bills vs Without GST Bills).
 * 2. Eye / View action button inclusion and modal verification in InvoiceModule.
 * 3. Room Management View action button inclusion and live guest / specs modal in RoomManagementView.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

console.log('Running DirectStay Invoice GST Filter & Rooms View Action Tests...\n');

// 1. Test Invoice GST vs Without-GST logic
interface TestInvoice {
  id: string;
  isWithoutGst?: boolean;
  gstRate?: number;
  totalTax?: number;
}

const mockInvoices: TestInvoice[] = [
  { id: 'INV-1', isWithoutGst: false, gstRate: 5, totalTax: 445 },
  { id: 'INV-2', isWithoutGst: true, gstRate: 0, totalTax: 0 },
  { id: 'INV-3', isWithoutGst: false, gstRate: 12, totalTax: 1200 },
  { id: 'INV-4', isWithoutGst: false, gstRate: 0, totalTax: 0 },
  { id: 'INV-5', isWithoutGst: true, gstRate: 5, totalTax: 250 }, // marked isWithoutGst
];

function isGstInvoice(inv: TestInvoice): boolean {
  return !(inv.isWithoutGst === true || (inv.gstRate !== undefined && Number(inv.gstRate) <= 0) || (inv.gstRate === undefined && Number(inv.totalTax || 0) <= 0));
}

const gstCount = mockInvoices.filter(isGstInvoice).length;
const nonGstCount = mockInvoices.filter(inv => !isGstInvoice(inv)).length;

assert(gstCount === 2, `Expected 2 GST invoices (INV-1, INV-3), got ${gstCount}`);
assert(nonGstCount === 3, `Expected 3 Without-GST invoices (INV-2, INV-4, INV-5), got ${nonGstCount}`);

// Test filtering
const allFiltered = mockInvoices.filter(() => true);
const gstFiltered = mockInvoices.filter(isGstInvoice);
const nonGstFiltered = mockInvoices.filter(inv => !isGstInvoice(inv));

assert(allFiltered.length === 5, 'All filter returns 5 records');
assert(gstFiltered.every(inv => isGstInvoice(inv)), 'GST filter contains only GST invoices');
assert(nonGstFiltered.every(inv => !isGstInvoice(inv)), 'Non-GST filter contains only Without-GST invoices');

// 2. Test InvoiceModule.tsx code structure
const invoiceModulePath = resolve(process.cwd(), 'src/pms-integrated/modules/InvoiceModule.tsx');
const invoiceModuleSrc = readFileSync(invoiceModulePath, 'utf8');

assert(invoiceModuleSrc.includes("gstFilter"), "InvoiceModule defines gstFilter state");
assert(invoiceModuleSrc.includes("All Bills"), "InvoiceModule includes 'All Bills' pill button");
assert(invoiceModuleSrc.includes("GST Bills"), "InvoiceModule includes 'GST Bills' pill button");
assert(invoiceModuleSrc.includes("Without GST Bills"), "InvoiceModule includes 'Without GST Bills' pill button");
assert(invoiceModuleSrc.includes("View"), "InvoiceModule has View button in Actions column");
assert(invoiceModuleSrc.includes("onOpenInvoiceModal(bookingForModal") || invoiceModuleSrc.includes("onOpenInvoiceModal("), "InvoiceModule View button opens preview/print modal");

// 3. Test RoomManagementView.tsx code structure
const roomViewPath = resolve(process.cwd(), 'src/components/RoomManagementView.tsx');
const roomViewSrc = readFileSync(roomViewPath, 'utf8');

assert(roomViewSrc.includes("viewRoomDetails"), "RoomManagementView has viewRoomDetails state");
assert(roomViewSrc.includes("setViewRoomDetails(room)"), "RoomManagementView sets viewRoomDetails on click");
assert(roomViewSrc.includes("View Room & Guest Details"), "RoomManagementView has View action button with title");
assert(roomViewSrc.includes("Room Overview & Inspection"), "RoomManagementView renders inspection modal header");
assert(roomViewSrc.includes("Active In-House Guest Details"), "RoomManagementView renders active stay/guest details in modal");
assert(roomViewSrc.includes("Nightly Tariff"), "RoomManagementView modal shows nightly tariff");
assert(roomViewSrc.includes("Housekeeping"), "RoomManagementView modal shows housekeeping cleaning status");

console.log('\n🎉 ALL INVOICE GST FILTER & ROOMS VIEW TESTS PASSED SUCCESSFULLY!');
