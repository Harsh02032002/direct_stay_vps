import assert from 'node:assert/strict';
import {
  getIstDateParts,
  getTodayIst,
  getYesterdayIst,
  addDaysIst,
  formatDdmmyyyy,
  parseDdmmyyyyToYmd,
  getPresetDateRange,
  isDateWithinRange,
} from '../src/utils/reportingDates';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  PASS [${passed}]: ${name}`);
}

console.log('Running DirectStay Reporting Date Logic Tests...\n');

test('getIstDateParts returns valid YMD in Asia/Kolkata timezone', () => {
  const parts = getIstDateParts();
  assert.match(parts.ymd, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(parts.dmy, /^\d{2}-\d{2}-\d{4}$/);
  assert.ok(parts.year.length === 4);
  assert.ok(parts.month.length === 2);
  assert.ok(parts.day.length === 2);
  assert.ok(['AM', 'PM'].includes(parts.ampm));
});

test('getTodayIst and getYesterdayIst work properly without timezone skew', () => {
  const today = getTodayIst();
  const yest = getYesterdayIst();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(yest, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(addDaysIst(yest, 1), today);
});

test('formatDdmmyyyy converts ISO and timestamp to DD-MM-YYYY', () => {
  assert.equal(formatDdmmyyyy('2026-11-20'), '20-11-2026');
  assert.equal(formatDdmmyyyy('20-11-2026'), '20-11-2026');
  assert.equal(formatDdmmyyyy('2026-11-20T10:00:00Z'), '20-11-2026');
  assert.equal(formatDdmmyyyy(null), '—');
});

test('parseDdmmyyyyToYmd converts DD-MM-YYYY back to YYYY-MM-DD', () => {
  assert.equal(parseDdmmyyyyToYmd('20-11-2026'), '2026-11-20');
  assert.equal(parseDdmmyyyyToYmd('2026-11-20'), '2026-11-20');
});

test('getPresetDateRange produces accurate boundaries', () => {
  const todayRange = getPresetDateRange('today');
  assert.equal(todayRange.fromDate, getTodayIst());
  assert.equal(todayRange.toDate, getTodayIst());

  const yestRange = getPresetDateRange('yesterday');
  assert.equal(yestRange.fromDate, getYesterdayIst());
  assert.equal(yestRange.toDate, getYesterdayIst());

  const last7 = getPresetDateRange('last7Days');
  assert.equal(last7.toDate, getTodayIst());
  assert.equal(last7.fromDate, addDaysIst(getTodayIst(), -6));

  const thisMonth = getPresetDateRange('thisMonth');
  assert.match(thisMonth.fromDate, /^\d{4}-\d{2}-01$/);
  assert.equal(thisMonth.toDate, getTodayIst());
});

test('isDateWithinRange checks inclusive range boundaries', () => {
  assert.equal(isDateWithinRange('2026-11-20', '2026-11-15', '2026-11-25'), true);
  assert.equal(isDateWithinRange('2026-11-14', '2026-11-15', '2026-11-25'), false);
  assert.equal(isDateWithinRange('2026-11-26', '2026-11-15', '2026-11-25'), false);
  assert.equal(isDateWithinRange('20-11-2026', '2026-11-15', '2026-11-25'), true);
});

console.log(`\nALL ${passed}/6 REPORTING DATE TESTS PASSED!`);
