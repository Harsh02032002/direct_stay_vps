import React, { useMemo, useState } from 'react';
import { AuditLog } from '../types';
import {
  ShieldCheck,
  Search,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

export function parseAuditTimestampMs(raw?: string): number {
  const s = String(raw || '').trim();
  if (!s) return 0;

  const direct = Date.parse(s);
  if (Number.isFinite(direct)) return direct;

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const isoCandidate = s.replace(/\s+/, 'T') + (s.split(':').length === 2 ? ':00Z' : 'Z');
    const parsedIso = Date.parse(isoCandidate);
    if (Number.isFinite(parsedIso)) return parsedIso;
  }

  // Legacy en-IN format e.g. "15/6/2026, 10:30:00 am"
  const inMatch = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i
  );
  if (inMatch) {
    const day = Number(inMatch[1]);
    const month = Number(inMatch[2]) - 1;
    const year = Number(inMatch[3]);
    let hour = Number(inMatch[4]);
    const minute = Number(inMatch[5]);
    const second = Number(inMatch[6] || 0);
    const ampm = (inMatch[7] || '').toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return Date.UTC(year, month, day, hour, minute, second);
  }

  return 0;
}

export function formatAuditTimestamp(raw?: string): string {
  const ms = parseAuditTimestampMs(raw);
  if (!ms) {
    return String(raw || '').replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function sortAuditLogsChronologically(logs: AuditLog[]): AuditLog[] {
  return [...(logs || [])].sort((a, b) => {
    const tDiff = parseAuditTimestampMs(b?.dateTime) - parseAuditTimestampMs(a?.dateTime);
    if (tDiff !== 0) return tDiff;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}

function matchesActionCategory(action: string, selectedFilter: string): boolean {
  if (selectedFilter === 'All') return true;
  const actLower = (action || '').toLowerCase();
  if (selectedFilter === 'CAT:BOOKINGS') {
    return (
      actLower.includes('booking') ||
      actLower.includes('reservation') ||
      actLower.includes('check-in') ||
      actLower.includes('check-out') ||
      actLower.includes('stay') ||
      actLower.includes('ota')
    );
  }
  if (selectedFilter === 'CAT:ROOMS') {
    return (
      actLower.includes('room') ||
      actLower.includes('housekeeping') ||
      actLower.includes('cleaning') ||
      actLower.includes('laundry') ||
      actLower.includes('lost & found') ||
      actLower.includes('water') ||
      actLower.includes('service')
    );
  }
  if (selectedFilter === 'CAT:POS') {
    return actLower.includes('pos') || actLower.includes('kot') || actLower.includes('kitchen');
  }
  if (selectedFilter === 'CAT:FINANCE') {
    return (
      actLower.includes('invoice') ||
      actLower.includes('expense') ||
      actLower.includes('handover') ||
      actLower.includes('voucher') ||
      actLower.includes('vendor') ||
      actLower.includes('petty') ||
      actLower.includes('owner') ||
      actLower.includes('reimbursement') ||
      actLower.includes('closing') ||
      actLower.includes('payment')
    );
  }
  if (selectedFilter === 'CAT:INVENTORY') {
    return (
      actLower.includes('inventory') ||
      actLower.includes('stock') ||
      actLower.includes('purchase') ||
      actLower.includes('supplier')
    );
  }
  if (selectedFilter === 'CAT:STAFF_SECURITY') {
    return (
      actLower.includes('staff') ||
      actLower.includes('role') ||
      actLower.includes('permission') ||
      actLower.includes('login') ||
      actLower.includes('logout') ||
      actLower.includes('password') ||
      actLower.includes('credential')
    );
  }
  if (selectedFilter === 'CAT:SETTINGS') {
    return (
      actLower.includes('policy') ||
      actLower.includes('setting') ||
      actLower.includes('profile') ||
      actLower.includes('hotel') ||
      actLower.includes('package') ||
      actLower.includes('website')
    );
  }
  return action === selectedFilter;
}

interface AuditLogsViewProps {
  auditLogs: AuditLog[];
  hotelName?: string;
}

export default function AuditLogsView({ auditLogs, hotelName }: AuditLogsViewProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [actorFilter, setActorFilter] = useState('All');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sort newest-first reliably using UTC epoch timestamps
  const sortedLogs = useMemo(() => sortAuditLogsChronologically(auditLogs), [auditLogs]);

  // Distinct action names present in data
  const distinctActions = useMemo(
    () => Array.from(new Set(sortedLogs.map((log) => log.action).filter(Boolean))),
    [sortedLogs]
  );

  // Extract clean performer names AND full performer labels
  const getCleanPerformerName = (perfStr: string) => {
    return String(perfStr || 'System').split(' (')[0].trim();
  };

  const performersList = useMemo(() => {
    const names = Array.from(
      new Set(sortedLogs.map((log) => getCleanPerformerName(log.performedBy)).filter(Boolean))
    );
    return ['All', ...names];
  }, [sortedLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedLogs.filter((log) => {
      const formattedDate = formatAuditTimestamp(log.dateTime);
      const matchesSearch =
        !q ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q) ||
        (log.performedBy || '').toLowerCase().includes(q) ||
        (log.actorUsername || '').toLowerCase().includes(q) ||
        (log.actorRole || '').toLowerCase().includes(q) ||
        (log.id || '').toLowerCase().includes(q) ||
        (log.dateTime || '').toLowerCase().includes(q) ||
        formattedDate.toLowerCase().includes(q);

      const matchesAction = matchesActionCategory(log.action, actionFilter);
      const matchesActor =
        actorFilter === 'All' ||
        getCleanPerformerName(log.performedBy) === actorFilter ||
        log.performedBy === actorFilter ||
        log.actorRole === actorFilter;

      return matchesSearch && matchesAction && matchesActor;
    });
  }, [sortedLogs, search, actionFilter, actorFilter]);

  const totalRecords = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIdx, startIdx + pageSize);

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('All');
    setActorFilter('All');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-luxury-brown-100 pb-4 no-print gap-2">
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold block mb-1">
            Security & Accountability
          </span>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#C5A059]" /> Immutable Owner Audit Logs
          </h1>
          <p className="text-xs text-luxury-brown-500">
            Real-time, append-only ledger recording all reservations, check-ins, room changes, POS, inventory, billing, and security events{hotelName ? ` for ${hotelName}` : ''}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-luxury-beige-100 text-luxury-brown-800 px-2.5 py-1 rounded border border-luxury-brown-200 font-bold">
            Total Ledger: {sortedLogs.length} Events
          </span>
          <span className="text-[10px] font-mono bg-luxury-brown-950 text-[#C5A059] px-2.5 py-1 rounded border border-[#C5A059]/20 uppercase tracking-widest">
            🔐 Ledger State: Immutable Append-Only
          </span>
        </div>
      </div>

      <div className="bg-amber-50/40 border border-amber-300 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-800">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-serif font-bold text-[#b45309]">Ledger Auditing Security Notice</h3>
          <p className="mt-0.5 text-luxury-brown-700 leading-relaxed font-sans">
            According to standard boutique security compliance guidelines,{' '}
            <strong>all logs registered are final, non-editable, and cannot be permanently deleted.</strong>{' '}
            This ensures full transaction accountability for taxes, police Sarai, and owner auditing controls.
          </p>
        </div>
      </div>

      {/* Audit Log Filters */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl p-4 shadow-3xs grid grid-cols-1 md:grid-cols-12 gap-4 no-print">
        {/* Search */}
        <div className="relative md:col-span-5 text-xs">
          <label className="block text-[10px] uppercase font-mono font-bold text-luxury-brown-500 mb-1">
            Search Action, Details, User, Audit ID, or Date
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-luxury-brown-400" />
            <input
              type="text"
              placeholder="Search action, details, user, audit ID (AUD-...), or YYYY-MM-DD..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-luxury-brown-200 rounded-lg focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-905"
            />
          </div>
        </div>

        {/* Action Type Filter */}
        <div className="text-xs md:col-span-3">
          <label className="block text-[10px] uppercase font-mono font-bold text-luxury-brown-500 mb-1">
            Filter Action Type
          </label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs"
          >
            <option value="All">All Actions ({sortedLogs.length})</option>
            <optgroup label="Operational Categories">
              <option value="CAT:BOOKINGS">Bookings, Check-In & Stays</option>
              <option value="CAT:ROOMS">Rooms, Housekeeping & Services</option>
              <option value="CAT:POS">POS Terminal & Kitchen (KOT)</option>
              <option value="CAT:FINANCE">Invoices, Expenses & Finance</option>
              <option value="CAT:INVENTORY">Inventory, Purchases & Stock</option>
              <option value="CAT:STAFF_SECURITY">Staff, Roles & Authentication</option>
              <option value="CAT:SETTINGS">Hotel Profile, Policies & Settings</option>
            </optgroup>
            <optgroup label="Specific Event Actions">
              {distinctActions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Performed By Filter */}
        <div className="text-xs md:col-span-3">
          <label className="block text-[10px] uppercase font-mono font-bold text-luxury-brown-500 mb-1">
            Filter Performed By
          </label>
          <select
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs"
          >
            {performersList.map((item) => (
              <option key={item} value={item}>
                {item === 'All' ? 'All Operators / Roles' : item}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        <div className="text-xs md:col-span-1 flex items-end">
          <button
            type="button"
            onClick={handleResetFilters}
            title="Reset search and filters"
            className="w-full px-2.5 py-2 border border-luxury-brown-200 hover:bg-luxury-beige-50 text-luxury-brown-700 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="md:hidden lg:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Master Audit Log List */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl shadow-3xs overflow-hidden">
        <div className="p-4 border-b bg-luxury-beige-50/50 font-serif font-bold text-sm text-luxury-brown-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span>Official Event Registry Ledger (Newest First)</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-luxury-brown-600">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-white border border-luxury-brown-200 rounded text-[11px] font-mono font-bold"
              >
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <span className="text-[10px] font-mono text-luxury-brown-450 bg-luxury-beige-100/80 px-2.5 py-1 rounded font-extrabold">
              {totalRecords === 0
                ? '0 Records Matched'
                : `Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, totalRecords)} of ${totalRecords} Records`}
            </span>
          </div>
        </div>

        {paginatedLogs.length === 0 ? (
          <div className="p-12 text-center text-luxury-brown-405 italic text-sm">
            No audit records matching specified query constraints.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs text-slate-800">
            <table className="w-full text-left divide-y text-slate-755 border-collapse">
              <thead className="bg-[#fcfaf4] font-mono text-[9px] font-bold uppercase text-luxury-brown-700">
                <tr>
                  <th className="p-3.5 border-r">Log ID</th>
                  <th className="p-3.5 border-r">Event Action</th>
                  <th className="p-3.5 border-r">Operator / Performed By</th>
                  <th className="p-3.5 border-r">Audit Details & Description</th>
                  <th className="p-3.5 text-right">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium select-none">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-luxury-beige-50/15">
                    <td className="p-3.5 border-r font-mono font-bold text-gray-500 whitespace-nowrap">
                      {log.id}
                    </td>
                    <td className="p-3.5 border-r">
                      <span className="px-2.5 py-0.5 bg-luxury-beige-100 text-luxury-brown-950 rounded-md font-mono text-[9px] font-bold uppercase tracking-wide inline-block">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 border-r font-serif font-bold text-luxury-brown-900 whitespace-nowrap">
                      {log.performedBy}
                    </td>
                    <td className="p-3.5 border-r leading-relaxed text-luxury-brown-800 text-[11px] font-sans">
                      {log.details}
                    </td>
                    <td className="p-3.5 text-right text-gray-500 font-mono text-[10px] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0 text-gray-300" />
                        {formatAuditTimestamp(log.dateTime)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalRecords > 0 && (
          <div className="p-3.5 border-t border-luxury-brown-100 bg-[#fcfaf4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono no-print">
            <span className="text-luxury-brown-600 text-[11px]">
              Page <strong>{safePage}</strong> of <strong>{totalPages}</strong> • Total Matching:{' '}
              <strong>{totalRecords}</strong> (Hotel Ledger: {sortedLogs.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-luxury-brown-200 bg-white hover:bg-luxury-beige-50 disabled:opacity-40 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-luxury-brown-200 bg-white hover:bg-luxury-beige-50 disabled:opacity-40 font-bold flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

