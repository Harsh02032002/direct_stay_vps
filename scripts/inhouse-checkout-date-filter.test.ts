import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS: ${msg}`);
}

console.log('Testing Date Filter for In-House Guest, Checkout Pending, Express Check-Out, and Departure Settlement...\n');

// 1. FrontDeskView.tsx
console.log('--- 1. FrontDeskView In-House & Check-Out Date Filters ---');
const fdView = readFileSync(resolve(process.cwd(), 'src/components/FrontDeskView.tsx'), 'utf8');

assert(fdView.includes('inHouseDatePreset'), 'FrontDeskView defines inHouseDatePreset');
assert(fdView.includes("inHouseDatePreset, setInHouseDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today')"), 'inHouseDatePreset defaults to today');
assert(fdView.includes('inHouseFromDate'), 'FrontDeskView defines inHouseFromDate');
assert(fdView.includes('matchesInHouseDate'), 'FrontDeskView defines matchesInHouseDate filter helper');
assert(fdView.includes('applyInHouseDatePreset'), 'FrontDeskView defines applyInHouseDatePreset handler');
assert(fdView.includes("applyInHouseDatePreset('today')"), 'FrontDeskView has Reset to Today for In-House guests');
assert(fdView.includes('activeInHouseGuests = activeCheckins.filter'), 'activeInHouseGuests filters checkins by search and date');

assert(fdView.includes('checkoutDatePreset'), 'FrontDeskView defines checkoutDatePreset');
assert(fdView.includes("checkoutDatePreset, setCheckoutDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today')"), 'checkoutDatePreset defaults to today');
assert(fdView.includes('checkoutFromDate'), 'FrontDeskView defines checkoutFromDate');
assert(fdView.includes('matchesCheckoutDate'), 'FrontDeskView defines matchesCheckoutDate filter helper');
assert(fdView.includes('applyCheckoutDatePreset'), 'FrontDeskView defines applyCheckoutDatePreset handler');
assert(fdView.includes("applyCheckoutDatePreset('today')"), 'FrontDeskView has Reset to Today for Check-Out / Departures');
assert(fdView.includes('filteredCheckoutGuests = activeCheckins.filter'), 'filteredCheckoutGuests filters departures by search and date');
assert(fdView.includes('filteredCheckoutGuests.map'), 'Express Check-Out table renders filteredCheckoutGuests');

// 2. FrontDeskModule.tsx
console.log('\n--- 2. FrontDeskModule Date Filter Defaults & Weekly Preset ---');
const fdMod = readFileSync(resolve(process.cwd(), 'src/pms-integrated/modules/FrontDeskModule.tsx'), 'utf8');

assert(fdMod.includes("fdDatePreset, setFdDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today')"), 'FrontDeskModule fdDatePreset defaults to today');
assert(fdMod.includes('fdFromDate, setFdFromDate] = useState<string>(todayIsoStr)'), 'FrontDeskModule fdFromDate defaults to todayIsoStr');
assert(fdMod.includes("preset === 'this_week'"), 'FrontDeskModule applyFdDatePreset handles this_week');
assert(fdMod.includes("applyFdDatePreset('today')"), 'FrontDeskModule Date Filter bar has Reset to Today');

// 3. CheckInFormView.tsx
console.log('\n--- 3. CheckInFormView Folios Date Filter ---');
const ciView = readFileSync(resolve(process.cwd(), 'src/components/CheckInFormView.tsx'), 'utf8');

assert(ciView.includes('folioDatePreset'), 'CheckInFormView defines folioDatePreset');
assert(ciView.includes("folioDatePreset, setFolioDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today')"), 'folioDatePreset defaults to today');
assert(ciView.includes('folioFromDate'), 'CheckInFormView defines folioFromDate');
assert(ciView.includes('matchesFolioDate'), 'CheckInFormView defines matchesFolioDate helper');
assert(ciView.includes('applyFolioDatePreset'), 'CheckInFormView defines applyFolioDatePreset handler');
assert(ciView.includes("applyFolioDatePreset('today')"), 'CheckInFormView has Reset to Today for folios');

console.log('\n🎉 ALL DATE FILTER CHECKS PASSED 100%!');
