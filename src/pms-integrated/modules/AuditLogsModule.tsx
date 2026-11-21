import React, { useState } from 'react';
import { ShieldAlert, Search, Download, Calendar } from 'lucide-react';
import { AuditLogEntry } from '../types';
import { exportToCsv } from '../utils/formatters';

interface AuditLogsModuleProps {
  logs: AuditLogEntry[];
}

const normalizeDateStr = (val: unknown): string => {
  if (!val) return '';
  const s = String(val).trim();
  const isoMatch = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const dmyMatch = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
};

const DEFAULT_SAMPLE_LOGS: AuditLogEntry[] = [
  {
    id: 'AUD-001',
    timestamp: '2026-11-05, 02:45 PM',
    actorName: 'Harsh Vardhan (Owner)',
    actorRole: 'Owner',
    module: 'Finance',
    action: 'Payment Voucher Settled',
    details: 'Verified and approved vendor laundry settlement bill ₹2,400 via HDFC Current A/c',
    severity: 'info',
  },
  {
    id: 'AUD-002',
    timestamp: '2026-11-05, 01:15 PM',
    actorName: 'Priyadarshini Sahu',
    actorRole: 'Receptionist',
    module: 'Front Desk',
    action: 'Walk-In Check-In Completed',
    details: 'Guest checked in to Room 102. 5% GST bill generated and key card issued.',
    severity: 'info',
  },
  {
    id: 'AUD-003',
    timestamp: '2026-11-05, 11:30 AM',
    actorName: 'Super Admin',
    actorRole: 'Admin',
    module: 'Security',
    action: 'Staff Shift Roster Updated',
    details: 'Shift roster and department assignments updated for active on-duty staff.',
    severity: 'info',
  },
];

export const AuditLogsModule: React.FC<AuditLogsModuleProps> = ({ logs }) => {
  const effectiveLogs = logs && logs.length > 0 ? logs : DEFAULT_SAMPLE_LOGS;
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const filtered = effectiveLogs.filter((l) => {
    const matchText =
      !search ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase());
    const matchMod = moduleFilter === 'ALL' || l.module === moduleFilter;
    const logDate = normalizeDateStr(l.timestamp);
    const matchDate = !logDate || ((!fromDate || logDate >= fromDate) && (!toDate || logDate <= toDate));
    return matchText && matchMod && matchDate;
  });

  const handleExport = () => {
    const periodSuffix = `${fromDate}_to_${toDate}`;
    exportToCsv(
      `DirectStay_Audit_Logs_${periodSuffix}.csv`,
      filtered.map((l) => ({
        'Timestamp': l.timestamp,
        'Staff / Actor': l.actorName,
        'Role': l.actorRole,
        'Module': l.module,
        'Action Event': l.action,
        'Detailed Audit Payload': l.details,
      }))
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3.5 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 leading-snug">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            <span>Owner Security & Tamper-Proof Activity Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Every booking modification, discount override, payment entry, and room block is logged with actor identity
          </p>
        </div>

        <button
          onClick={handleExport}
          className="w-full md:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Export Audit Trail CSV</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actor, action, details..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
              />
            </div>

            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
            >
              <option value="ALL">All PMS Modules</option>
              <option value="Front Desk">Front Desk</option>
              <option value="Payments">Payments</option>
              <option value="Room Management">Room Management</option>
              <option value="POS Terminal">POS Terminal</option>
              <option value="Housekeeping">Housekeeping</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Quick Presets */}
            <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setFromDate(today);
                  setToDate(today);
                }}
                className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer text-center"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const startM = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                  const endM = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                  setFromDate(startM);
                  setToDate(endM);
                }}
                className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer text-center"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate('2020-01-01');
                  setToDate('2030-12-31');
                }}
                className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer text-center"
              >
                All Time
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none min-w-0"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none min-w-0"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Staff / Actor</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Detailed Audit Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                    No audit log entries found for the selected period ({fromDate} to {toDate}).
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.actorName}</div>
                      <div className="text-[10px] text-slate-400">{log.actorRole}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">{log.action}</td>
                    <td className="py-3.5 px-4 text-slate-600">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
