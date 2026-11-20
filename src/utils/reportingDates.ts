/**
 * DirectStay Reporting & System Date Utilities (Asia/Kolkata - IST)
 *
 * Ensures all reports, dashboards, and registers automatically display
 * the current business date in Asia/Kolkata (IST), format in DD-MM-YYYY,
 * handle rollover at midnight, and support Today, Yesterday, Last 7 Days,
 * This Month, Custom Range, and Reset to Today.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface DateRange {
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  from: string;     // convenience alias for fromDate
  to: string;       // convenience alias for toDate
}

export type ReportingDatePreset =
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'last7days'
  | 'thisWeek'
  | 'thisMonth'
  | 'allTime'
  | 'custom';

/**
 * Returns current date/time parts in Asia/Kolkata (IST).
 */
export function getIstDateParts(date: Date = new Date()): {
  year: string;
  month: string;
  day: string;
  ymd: string;
  dmy: string;
  hour: string;
  minute: string;
  hour12: number;
  ampm: 'AM' | 'PM';
  display12h: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    const year = get('year');
    const month = get('month');
    const day = get('day');
    let h24 = parseInt(get('hour'), 10);
    if (Number.isNaN(h24) || h24 >= 24) h24 = 0;
    const minute = get('minute');
    const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;

    return {
      year,
      month,
      day,
      ymd: `${year}-${month}-${day}`,
      dmy: `${day}-${month}-${year}`,
      hour: String(h24).padStart(2, '0'),
      minute,
      hour12,
      ampm,
      display12h: `${String(hour12).padStart(2, '0')}:${minute} ${ampm}`,
    };
  } catch {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const h24 = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, '0');
    const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return {
      year,
      month,
      day,
      ymd: `${year}-${month}-${day}`,
      dmy: `${day}-${month}-${year}`,
      hour: String(h24).padStart(2, '0'),
      minute,
      hour12,
      ampm,
      display12h: `${String(hour12).padStart(2, '0')}:${minute} ${ampm}`,
    };
  }
}

/** Current today in Asia/Kolkata (YYYY-MM-DD) */
export function getTodayIst(): string {
  return getIstDateParts().ymd;
}

/** Yesterday in Asia/Kolkata (YYYY-MM-DD) */
export function getYesterdayIst(): string {
  const parts = getIstDateParts();
  const d = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add or subtract days from a YYYY-MM-DD date string */
export function addDaysIst(baseYmd: string, days: number): string {
  const m = String(baseYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return getTodayIst();
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Converts any date string to DD-MM-YYYY */
export function formatDdmmyyyy(raw?: unknown): string {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (!s) return '—';

  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

  // YYYY-MM-DD or ISO timestamp
  const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[3]}-${ymdMatch[2]}-${ymdMatch[1]}`;
  }

  // Fallback via Date parser
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const parts = getIstDateParts(dt);
    return parts.dmy;
  }
  return s;
}

/** Converts DD-MM-YYYY to YYYY-MM-DD */
export function parseDdmmyyyyToYmd(raw?: unknown): string {
  if (!raw) return getTodayIst();
  const s = String(raw).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return getTodayIst();
}

/** Computes DateRange for a given preset in Asia/Kolkata (IST) */
export function getPresetDateRange(
  preset: ReportingDatePreset,
  customFrom?: string,
  customTo?: string
): DateRange {
  const today = getTodayIst();
  const yesterday = getYesterdayIst();

  const wrapRange = (fromDate: string, toDate: string): DateRange => ({
    fromDate,
    toDate,
    from: fromDate,
    to: toDate,
  });

  switch (preset) {
    case 'today':
      return wrapRange(today, today);
    case 'yesterday':
      return wrapRange(yesterday, yesterday);
    case 'last7Days':
    case 'last7days':
      return wrapRange(addDaysIst(today, -6), today);
    case 'thisWeek': {
      const parts = getIstDateParts();
      const dt = new Date(`${parts.ymd}T00:00:00`);
      const day = dt.getDay();
      const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
      dt.setDate(diff);
      const monStr = dt.toISOString().slice(0, 10);
      return wrapRange(monStr, today);
    }
    case 'thisMonth': {
      const parts = getIstDateParts();
      const firstDay = `${parts.year}-${parts.month}-01`;
      return wrapRange(firstDay, today);
    }
    case 'allTime':
      return wrapRange('2020-01-01', '2030-12-31');
    case 'custom':
      return wrapRange(customFrom || today, customTo || today);
    default:
      return wrapRange(today, today);
  }
}

/** Check if date falls in inclusive YYYY-MM-DD range */
export function isDateWithinRange(
  rawDate: unknown,
  fromDate: string,
  toDate: string
): boolean {
  if (!rawDate) return false;
  const s = String(rawDate).trim().slice(0, 10);
  let cmp = s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    cmp = parseDdmmyyyyToYmd(s);
  }
  if (!cmp) return false;
  return (!fromDate || cmp >= fromDate) && (!toDate || cmp <= toDate);
}
