import assert from 'node:assert/strict';
import {
  REPORTS_CATALOG,
  REPORT_CATEGORIES,
  REPORT_VIEW_TITLES,
  filterReportCatalog,
  groupReportsByCategory,
  toggleFavouriteId,
} from '../src/utils/reportsCatalog';
import { DIRECTSTAY_PMS_SIDEBAR_TREE } from '../src/utils/sidebarNavigation';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS [${passed}]: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log('Running DirectStay Reports & Graphs Catalogue Tests...\n');

test('Catalogue covers all 9 required categories with unique ids', () => {
  assert.deepEqual(REPORT_CATEGORIES, [
    'Front Office',
    'Occupancy',
    'Room Operations',
    'Guest Reports',
    'MIS',
    'Tax',
    'Cashier',
    'Night Audit',
    'Financial Reports',
  ]);
  const ids = REPORTS_CATALOG.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const cat of REPORT_CATEGORIES) {
    assert.ok(REPORTS_CATALOG.some((r) => r.category === cat), `No report in category ${cat}`);
  }
});

test('Every card opens an EXISTING report view or PMS module (no placeholders)', () => {
  const validModuleTabs = new Set(['frontDesk', 'calendar', 'rooms', 'userList', 'finance']);
  for (const r of REPORTS_CATALOG) {
    if (r.target.type === 'report') {
      assert.ok(REPORT_VIEW_TITLES[r.target.reportId], `Unknown report view ${r.target.reportId} on ${r.title}`);
    } else {
      assert.ok(validModuleTabs.has(r.target.tab), `Unknown module tab ${r.target.tab} on ${r.title}`);
    }
    assert.ok(r.title.length > 0 && r.description.length > 10);
  }
  // All 16 existing ReportsModule views are reachable from at least one card
  for (const reportId of Object.keys(REPORT_VIEW_TITLES)) {
    assert.ok(
      REPORTS_CATALOG.some((r) => r.target.type === 'report' && r.target.reportId === reportId),
      `Report view ${reportId} has no card`
    );
  }
});

test('Required existing reports are present (Occupancy Forecast, Reservations, Room Status, Arrivals, Daily Sales, GST, Collections, Pending Settlements, Night Audit)', () => {
  const titles = REPORTS_CATALOG.map((r) => r.title.toLowerCase()).join(' | ');
  for (const t of [
    'occupancy forecast',
    'reservations',
    'room status',
    'arrivals',
    'daily sales',
    'revenue',
    'gstr-1',
    'advance collections',
    'pending settlements',
    'night audit',
  ]) {
    assert.ok(titles.includes(t), `Missing report: ${t}`);
  }
});

test('Search and category filters work', () => {
  const gst = filterReportCatalog(REPORTS_CATALOG, { query: 'gst' });
  assert.ok(gst.some((r) => r.id === 'gst_tax'));
  assert.ok(gst.every((r) => /gst/i.test(r.title + r.description + r.category)));

  const cashier = filterReportCatalog(REPORTS_CATALOG, { category: 'Cashier' });
  assert.deepEqual(
    cashier.map((r) => r.id).sort(),
    ['advance_collections', 'daily_cash', 'pending_dues']
  );

  const none = filterReportCatalog(REPORTS_CATALOG, { query: 'zzzz-not-a-report' });
  assert.equal(none.length, 0);

  const combo = filterReportCatalog(REPORTS_CATALOG, { category: 'Night Audit', query: 'night' });
  assert.equal(combo.length, 1);
});

test('Favourites toggle on/off and Favourites filter shows only pinned reports', () => {
  let fav: string[] = [];
  fav = toggleFavouriteId(fav, 'daily_sales');
  fav = toggleFavouriteId(fav, 'night_audit');
  assert.deepEqual(fav, ['daily_sales', 'night_audit']);
  const shown = filterReportCatalog(REPORTS_CATALOG, { category: 'Favourites', favouriteIds: fav });
  assert.deepEqual(shown.map((r) => r.id).sort(), ['daily_sales', 'night_audit']);
  fav = toggleFavouriteId(fav, 'daily_sales');
  assert.deepEqual(fav, ['night_audit']);
  assert.equal(filterReportCatalog(REPORTS_CATALOG, { category: 'Favourites', favouriteIds: [] }).length, 0);
});

test('Grouping keeps category order and sidebar Reports & Graphs opens the Reports landing page', () => {
  const op = REPORTS_CATALOG.find((r) => r.id === 'daily_operator')!;
  assert.equal(op.category, 'MIS');
  assert.deepEqual(op.target, { type: 'module', tab: 'frontDesk', subTab: 'reports' });
  const groups = groupReportsByCategory(REPORTS_CATALOG);
  assert.deepEqual(
    groups.map((g) => g.category),
    REPORT_CATEGORIES
  );
  const reportsNode = DIRECTSTAY_PMS_SIDEBAR_TREE.find((n) => n.id === 'reports-graphs')!;
  assert.equal(reportsNode.target?.activeTab, 'reports');
  assert.equal(reportsNode.target?.reportsSubTab, 'dashboard');
});

console.log(`\nALL ${passed}/6 REPORTS & GRAPHS TESTS PASSED!`);
