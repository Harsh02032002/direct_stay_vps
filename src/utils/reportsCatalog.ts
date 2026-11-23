/**
 * DirectStay Reports & Graphs catalogue.
 * Every entry opens an EXISTING report / module (no placeholder cards):
 *  - `report`: a report view rendered inside ReportsModule (date filters, search, print, CSV export)
 *  - `module`: an existing PMS module / sub-tab (Stay Overview, Room Status, Financial Hub, ...)
 */

export type ReportCategory =
  | 'Front Office'
  | 'Occupancy'
  | 'Room Operations'
  | 'Guest Reports'
  | 'MIS'
  | 'Tax'
  | 'Cashier'
  | 'Night Audit'
  | 'Financial Reports';

export const REPORT_CATEGORIES: ReportCategory[] = [
  'Front Office',
  'Occupancy',
  'Room Operations',
  'Guest Reports',
  'MIS',
  'Tax',
  'Cashier',
  'Night Audit',
  'Financial Reports',
];

export type ReportTarget =
  | { type: 'report'; reportId: string }
  | { type: 'module'; tab: string; subTab?: string };

export interface ReportCatalogEntry {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  iconKey: string;
  target: ReportTarget;
  isNew?: boolean;
}

/** Report views implemented inside ReportsModule (id -> display title) */
export const REPORT_VIEW_TITLES: Record<string, string> = {
  daily_collection_sheet: 'Daily Collection & Kitchen Register',
  daily_sales: 'Daily Sales Report (GST & Payments)',
  daily_cash: 'Daily Cash Book',
  advance_reservations: 'Advance Reservations',
  arrivals_departures: 'Arrivals & Departures',
  inhouse_guests: 'In-House Guests',
  noshows_cancellations: 'No-Shows & Cancellations',
  advance_collections: 'Advance Collections',
  pending_dues: 'Outstanding Payments',
  daily_checkouts: 'Daily Checkouts',
  revenue_journal: 'Guest Bills & Revenue',
  housekeeping_pending: 'Housekeeping Pending',
  night_audit: 'Night Audit Flash',
  ota_payments: 'OTA Payout Reconciliation',
  gst_tax: 'GSTR-1 Tax (GST Register)',
  police_sarai: 'Police Sarai / C-Form',
  water_logs: 'Water Bottle Logs',
};

export const REPORTS_CATALOG: ReportCatalogEntry[] = [
  // ---------------- FRONT OFFICE ----------------
  {
    id: 'arrivals_departures',
    title: 'Arrivals & Departures',
    description: 'Expected guest arrivals and scheduled departures with advance and dues.',
    category: 'Front Office',
    iconKey: 'arrivals',
    target: { type: 'report', reportId: 'arrivals_departures' },
  },
  {
    id: 'advance_reservations',
    title: 'Reservations',
    description: 'Confirmed upcoming reservations with source, advance paid and balance.',
    category: 'Front Office',
    iconKey: 'reservations',
    target: { type: 'report', reportId: 'advance_reservations' },
  },
  {
    id: 'noshows_cancellations',
    title: 'No-Show & Cancellations',
    description: 'Reservations marked no-show or cancelled with refunds and reasons.',
    category: 'Front Office',
    iconKey: 'noshow',
    target: { type: 'report', reportId: 'noshows_cancellations' },
  },
  {
    id: 'daily_checkouts',
    title: 'Checked Out Rooms',
    description: 'Departures completed in the period with final bill and settlement.',
    category: 'Front Office',
    iconKey: 'checkout',
    target: { type: 'report', reportId: 'daily_checkouts' },
  },
  {
    id: 'checkout_pending',
    title: 'Checkout Pending / Due Out',
    description: 'In-house guests due to check out with bill clearance status.',
    category: 'Front Office',
    iconKey: 'dueout',
    target: { type: 'module', tab: 'frontDesk', subTab: 'checkout' },
  },

  // ---------------- OCCUPANCY ----------------
  {
    id: 'occupancy_forecast',
    title: 'Occupancy Forecast',
    description: 'Stay Overview timeline with occupied, available rooms and occupancy % per date.',
    category: 'Occupancy',
    iconKey: 'forecast',
    target: { type: 'module', tab: 'calendar' },
  },
  {
    id: 'inhouse_guests',
    title: 'In-House Guests',
    description: 'Currently checked-in guests with room, running bill and balance due.',
    category: 'Occupancy',
    iconKey: 'inhouse',
    target: { type: 'report', reportId: 'inhouse_guests' },
  },

  // ---------------- ROOM OPERATIONS ----------------
  {
    id: 'room_status',
    title: 'Room Status',
    description: 'Real-time room occupancy and housekeeping status for every room.',
    category: 'Room Operations',
    iconKey: 'roomStatus',
    target: { type: 'module', tab: 'rooms', subTab: 'status' },
  },
  {
    id: 'blocked_rooms',
    title: 'Blocked Rooms',
    description: 'Rooms held for maintenance or management use.',
    category: 'Room Operations',
    iconKey: 'blocked',
    target: { type: 'module', tab: 'rooms', subTab: 'blockAssets' },
  },
  {
    id: 'housekeeping_pending',
    title: 'Housekeeping Pending',
    description: 'Open housekeeping tasks with assignee, priority and timing.',
    category: 'Room Operations',
    iconKey: 'housekeeping',
    target: { type: 'report', reportId: 'housekeeping_pending' },
  },
  {
    id: 'water_logs',
    title: 'Water Bottle Logs',
    description: 'Water bottles delivered per room, chargeable and complimentary.',
    category: 'Room Operations',
    iconKey: 'water',
    target: { type: 'report', reportId: 'water_logs' },
  },

  // ---------------- GUEST REPORTS ----------------
  {
    id: 'police_sarai',
    title: 'Police Sarai / C-Form',
    description: 'Guest register with ID type, ID number and address for statutory filing.',
    category: 'Guest Reports',
    iconKey: 'police',
    target: { type: 'report', reportId: 'police_sarai' },
  },
  {
    id: 'guest_profiles',
    title: 'Guest Profiles',
    description: 'Master directory of guests with stay history and documents.',
    category: 'Guest Reports',
    iconKey: 'guests',
    target: { type: 'module', tab: 'userList' },
  },

  // ---------------- MIS ----------------
  {
    id: 'daily_operator',
    title: 'Daily Operator Report',
    description:
      'Daily Reception Collection & Settlement Sheet — Cash/UPI/ICICI collections, water bottle, laundry, extra bed, kitchen amount and counter cash drawer reconciliation.',
    category: 'MIS',
    iconKey: 'operator',
    target: { type: 'module', tab: 'frontDesk', subTab: 'reports' },
  },
  {
    id: 'daily_sales',
    title: 'Daily Sales Report',
    description: 'Day-wise sales with cash, online, GST and with/without GST bill split.',
    category: 'MIS',
    iconKey: 'sales',
    target: { type: 'report', reportId: 'daily_sales' },
  },
  {
    id: 'revenue_journal',
    title: 'Revenue & Guest Bills',
    description: 'Room tariff, add-ons, GST and collected vs balance for each booking.',
    category: 'MIS',
    iconKey: 'revenue',
    target: { type: 'report', reportId: 'revenue_journal' },
  },
  {
    id: 'ota_payments',
    title: 'OTA Payout Reconciliation',
    description: 'OTA gross value, commission, TDS and net receivable payout.',
    category: 'MIS',
    iconKey: 'ota',
    target: { type: 'report', reportId: 'ota_payments' },
  },

  // ---------------- TAX ----------------
  {
    id: 'gst_tax',
    title: 'GSTR-1 Tax Register',
    description: 'Invoice-wise taxable value with CGST / SGST split for filing.',
    category: 'Tax',
    iconKey: 'gst',
    target: { type: 'report', reportId: 'gst_tax' },
  },

  // ---------------- CASHIER ----------------
  {
    id: 'daily_collection_sheet',
    title: 'Daily Collection & Kitchen Register',
    description: 'Day-end reception ledger: room tariff, GST, payment modes, kitchen food bill breakdown (UPI, Cash, Due), and cash drawer reconciliation.',
    category: 'Cashier',
    iconKey: 'sales',
    target: { type: 'report', reportId: 'daily_collection_sheet' },
    isNew: true,
  },
  {
    id: 'daily_cash',
    title: 'Daily Cash Book',
    description: 'All receipts by date and payment mode with UTR / transaction reference.',
    category: 'Cashier',
    iconKey: 'cash',
    target: { type: 'report', reportId: 'daily_cash' },
  },
  {
    id: 'advance_collections',
    title: 'Advance Collections',
    description: 'Advance deposits collected against bookings in the period.',
    category: 'Cashier',
    iconKey: 'advance',
    target: { type: 'report', reportId: 'advance_collections' },
  },
  {
    id: 'pending_dues',
    title: 'Pending Settlements',
    description: 'Unpaid guest folios and outstanding receivables.',
    category: 'Cashier',
    iconKey: 'dues',
    target: { type: 'report', reportId: 'pending_dues' },
  },

  // ---------------- NIGHT AUDIT ----------------
  {
    id: 'night_audit',
    title: 'Night Audit Flash',
    description: 'Cash drawer reconciliation, occupancy snapshot and tariff / food deviation.',
    category: 'Night Audit',
    iconKey: 'night',
    target: { type: 'report', reportId: 'night_audit' },
  },

  // ---------------- FINANCIAL REPORTS ----------------
  {
    id: 'fin_overview',
    title: 'Finance Overview',
    description: 'Financial Hub dashboard with income, expenses and cash position.',
    category: 'Financial Reports',
    iconKey: 'finance',
    target: { type: 'module', tab: 'finance', subTab: 'dashboard' },
  },
  {
    id: 'fin_pl',
    title: 'P&L and GST Summary',
    description: 'Profit & loss statement with GST summary from the Financial Hub.',
    category: 'Financial Reports',
    iconKey: 'pl',
    target: { type: 'module', tab: 'finance', subTab: 'pl_reports' },
  },
  {
    id: 'fin_income',
    title: 'Income Ledger',
    description: 'Every income transaction across rooms, POS and other income.',
    category: 'Financial Reports',
    iconKey: 'income',
    target: { type: 'module', tab: 'finance', subTab: 'income' },
  },
  {
    id: 'fin_expenses',
    title: 'Expense Register',
    description: 'Operational expenses with category, vendor and approval status.',
    category: 'Financial Reports',
    iconKey: 'expense',
    target: { type: 'module', tab: 'finance', subTab: 'expenses' },
  },
  {
    id: 'fin_cash_bank',
    title: 'Cash & Bank Accounts',
    description: 'Cash drawer, bank, UPI and card account balances.',
    category: 'Financial Reports',
    iconKey: 'bank',
    target: { type: 'module', tab: 'finance', subTab: 'cash_bank' },
  },
];

export type ReportCategoryFilter = 'All' | 'Favourites' | ReportCategory;

export interface ReportFilterOptions {
  query?: string;
  category?: ReportCategoryFilter;
  favouriteIds?: string[];
}

/** Search + category / favourites filter (pure, unit-tested) */
export function filterReportCatalog(
  catalog: ReportCatalogEntry[],
  opts: ReportFilterOptions = {}
): ReportCatalogEntry[] {
  const q = String(opts.query || '').trim().toLowerCase();
  const fav = new Set(opts.favouriteIds || []);
  const cat = opts.category || 'All';
  return catalog.filter((r) => {
    if (cat === 'Favourites') {
      if (!fav.has(r.id)) return false;
    } else if (cat !== 'All' && r.category !== cat) {
      return false;
    }
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });
}

export function groupReportsByCategory(
  entries: ReportCatalogEntry[]
): Array<{ category: ReportCategory; reports: ReportCatalogEntry[] }> {
  return REPORT_CATEGORIES.map((category) => ({
    category,
    reports: entries.filter((e) => e.category === category),
  })).filter((g) => g.reports.length > 0);
}

export function toggleFavouriteId(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}

export function getFavouriteStorageKey(hotelId?: string, userKey?: string): string {
  return `directstay_fav_reports:${hotelId || 'default'}:${userKey || 'user'}`;
}

export function readFavouriteIds(hotelId?: string, userKey?: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getFavouriteStorageKey(hotelId, userKey));
    const parsed = raw ? JSON.parse(raw) : [];
    const valid = new Set(REPORTS_CATALOG.map((r) => r.id));
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && valid.has(id)) : [];
  } catch {
    return [];
  }
}

export function writeFavouriteIds(ids: string[], hotelId?: string, userKey?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getFavouriteStorageKey(hotelId, userKey), JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}
