import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  UserCheck,
  UserX,
  FileSpreadsheet,
  Check,
  RotateCcw
} from 'lucide-react';
import { Staff } from '../../types';
import { showToast } from '../../utils/toast';

interface StaffAttendanceViewProps {
  staff: Staff[];
  hotelName?: string;
  onAddAuditLog?: (action: string, details: string) => void;
}

export interface AttendanceRecord {
  staffId: string;
  staffName: string;
  department: string;
  shift: string;
  date: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'On Leave';
  punchIn?: string;
  punchOut?: string;
  notes?: string;
}

export default function StaffAttendanceView({
  staff = [],
  hotelName = 'DirectStay Hotel',
  onAddAuditLog,
}: StaffAttendanceViewProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  // Simulated in-memory attendance state with defaults for all staff
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>(() => {
    const initial: Record<string, AttendanceRecord> = {};
    staff.forEach((s, idx) => {
      initial[s.id] = {
        staffId: s.id,
        staffName: s.name,
        department: s.department,
        shift: s.designation?.includes('Night') ? 'Night (11PM–7AM)' : idx % 2 === 0 ? 'Morning (7AM–3PM)' : 'Evening (3PM–11PM)',
        date: todayStr,
        status: idx === 2 ? 'Half Day' : idx === 4 ? 'On Leave' : 'Present',
        punchIn: idx === 4 ? undefined : idx === 2 ? '10:15 AM' : '07:05 AM',
        punchOut: idx === 2 ? '02:00 PM' : undefined,
        notes: idx === 2 ? 'Approved medical half-day' : idx === 4 ? 'Pre-applied causal leave' : 'Normal duty punch',
      };
    });
    return initial;
  });

  // Quick punch form
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id || '');
  const [punchAction, setPunchAction] = useState<'Clock In' | 'Clock Out'>('Clock In');
  const [punchTime, setPunchTime] = useState('09:00 AM');
  const [punchStatus, setPunchStatus] = useState<AttendanceRecord['status']>('Present');
  const [punchNote, setPunchNote] = useState('');

  const handleRecordPunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    const targetStaff = staff.find((s) => s.id === selectedStaffId);
    if (!targetStaff) return;

    const existing = attendanceRecords[selectedStaffId] || {
      staffId: targetStaff.id,
      staffName: targetStaff.name,
      department: targetStaff.department,
      shift: 'Morning (7AM–3PM)',
      date: selectedDate,
      status: 'Present',
    };

    const updated: AttendanceRecord = {
      ...existing,
      status: punchStatus,
      punchIn: punchAction === 'Clock In' ? punchTime : existing.punchIn || '07:00 AM',
      punchOut: punchAction === 'Clock Out' ? punchTime : existing.punchOut,
      notes: punchNote || existing.notes,
    };

    setAttendanceRecords((prev) => ({ ...prev, [selectedStaffId]: updated }));
    const logMsg = `Attendance punch recorded: ${targetStaff.name} (${punchAction} at ${punchTime}, Status: ${punchStatus}).`;
    onAddAuditLog?.('Staff Attendance Recorded', logMsg);
    showToast(logMsg, 'success', 4000, 'Attendance Logged');
    setPunchNote('');
  };

  const setStaffStatusQuick = (staffId: string, status: AttendanceRecord['status']) => {
    const s = staff.find((m) => m.id === staffId);
    if (!s) return;
    const rec = attendanceRecords[staffId] || {
      staffId,
      staffName: s.name,
      department: s.department,
      shift: 'Morning (7AM–3PM)',
      date: selectedDate,
      status,
    };
    const updated: AttendanceRecord = {
      ...rec,
      status,
      punchIn: status === 'Present' || status === 'Half Day' ? (rec.punchIn || '07:30 AM') : undefined,
    };
    setAttendanceRecords((prev) => ({ ...prev, [staffId]: updated }));
    showToast(`Marked ${s.name} as ${status}.`, 'info', 3000);
  };

  const filteredStaff = staff.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.mobile && s.mobile.includes(searchTerm)) ||
      (s.department && s.department.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchDept = deptFilter === 'All' || s.department === deptFilter;
    return matchSearch && matchDept;
  });

  const totalCount = staff.length;
  const presentCount = Object.values(attendanceRecords).filter((r: AttendanceRecord) => r.status === 'Present').length;
  const halfDayCount = Object.values(attendanceRecords).filter((r: AttendanceRecord) => r.status === 'Half Day').length;
  const leaveCount = Object.values(attendanceRecords).filter((r: AttendanceRecord) => r.status === 'On Leave').length;
  const absentCount = Object.values(attendanceRecords).filter((r: AttendanceRecord) => r.status === 'Absent').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Daily Duty Punch &amp; Attendance Desk
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Staff Attendance &amp; Shift Logs
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Real-time biometric &amp; manual shift clock-ins, daily logs, and duty presence records for {hotelName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-luxury-beige-50 border border-luxury-brown-200 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2">
            <Calendar className="w-4 h-4 text-luxury-gold-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-mono font-bold text-luxury-brown-900 focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-luxury-brown-100 p-4 rounded-2xl shadow-3xs text-center">
          <span className="text-[10px] font-mono uppercase font-bold text-luxury-brown-400 block mb-1">Total Staff</span>
          <span className="text-2xl font-serif font-bold text-luxury-brown-950">{totalCount}</span>
        </div>
        <div className="bg-white border border-emerald-200 p-4 rounded-2xl shadow-3xs text-center">
          <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 block mb-1">Present Today</span>
          <span className="text-2xl font-serif font-bold text-emerald-700">{presentCount}</span>
        </div>
        <div className="bg-white border border-amber-200 p-4 rounded-2xl shadow-3xs text-center">
          <span className="text-[10px] font-mono uppercase font-bold text-amber-600 block mb-1">Half Day</span>
          <span className="text-2xl font-serif font-bold text-amber-700">{halfDayCount}</span>
        </div>
        <div className="bg-white border border-indigo-200 p-4 rounded-2xl shadow-3xs text-center">
          <span className="text-[10px] font-mono uppercase font-bold text-indigo-600 block mb-1">On Leave</span>
          <span className="text-2xl font-serif font-bold text-indigo-700">{leaveCount}</span>
        </div>
        <div className="bg-white border border-rose-200 p-4 rounded-2xl shadow-3xs text-center">
          <span className="text-[10px] font-mono uppercase font-bold text-rose-600 block mb-1">Absent</span>
          <span className="text-2xl font-serif font-bold text-rose-700">{absentCount}</span>
        </div>
      </div>

      {/* Quick Punch In/Out Form */}
      <form onSubmit={handleRecordPunch} className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-luxury-brown-50">
          <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-luxury-brown-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-luxury-gold-600" />
            Quick Punch Simulator / Manual Override
          </h3>
          <span className="text-[10px] font-mono text-luxury-brown-400">Date: {selectedDate}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">Employee</label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium text-luxury-brown-900"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.designation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">Action</label>
            <select
              value={punchAction}
              onChange={(e) => setPunchAction(e.target.value as any)}
              className="w-full bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium"
            >
              <option value="Clock In">Clock In (Duty Start)</option>
              <option value="Clock Out">Clock Out (Duty End)</option>
            </select>
          </div>

          <div>
            <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">Time</label>
            <input
              type="text"
              value={punchTime}
              onChange={(e) => setPunchTime(e.target.value)}
              placeholder="e.g. 07:15 AM"
              className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
            />
          </div>

          <div>
            <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">Status</label>
            <select
              value={punchStatus}
              onChange={(e) => setPunchStatus(e.target.value as any)}
              className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium"
            >
              <option value="Present">Present</option>
              <option value="Half Day">Half Day</option>
              <option value="On Leave">On Leave</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Save Punch
            </button>
          </div>
        </div>
      </form>

      {/* Staff Attendance Registry Table */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl shadow-sm overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-luxury-brown-50">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-luxury-brown-400" />
            <input
              type="text"
              placeholder="Search staff by name/mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-luxury-beige-50/50 border border-luxury-brown-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-luxury-brown-500 uppercase">Dept:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-1.5 border border-luxury-brown-200 rounded-xl bg-white text-xs text-luxury-brown-800"
            >
              <option value="All">All Departments</option>
              <option value="Front Office">Front Office</option>
              <option value="Housekeeping">Housekeeping</option>
              <option value="Accounts">Accounts</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Security">Security</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/60">
                <th className="py-2.5 px-4">Staff Member</th>
                <th className="py-2.5 px-4">Department &amp; Shift</th>
                <th className="py-2.5 px-4">Punch In</th>
                <th className="py-2.5 px-4">Punch Out</th>
                <th className="py-2.5 px-4">Attendance Status</th>
                <th className="py-2.5 px-4 text-right">Quick Mark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-luxury-brown-100">
              {filteredStaff.map((s) => {
                const rec = attendanceRecords[s.id] || {
                  staffId: s.id,
                  staffName: s.name,
                  department: s.department,
                  shift: 'Morning (7AM–3PM)',
                  date: selectedDate,
                  status: 'Present',
                  punchIn: '07:05 AM',
                };
                return (
                  <tr key={s.id} className="hover:bg-luxury-beige-50/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-luxury-brown-950">{s.name}</div>
                      <div className="text-[11px] font-mono text-luxury-brown-500">{s.mobile || 'No Mobile'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-luxury-brown-800">{s.department}</div>
                      <div className="text-[10px] font-mono text-luxury-gold-700">{rec.shift}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {rec.punchIn ? (
                        <span className="text-emerald-700 font-bold">{rec.punchIn}</span>
                      ) : (
                        <span className="text-slate-400">--:--</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {rec.punchOut ? (
                        <span className="text-luxury-brown-800 font-bold">{rec.punchOut}</span>
                      ) : (
                        <span className="text-slate-400">On Duty</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                          rec.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : rec.status === 'Half Day'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : rec.status === 'On Leave'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {rec.status === 'Present' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {rec.status === 'Absent' && <XCircle className="w-3 h-3 text-rose-600" />}
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setStaffStatusQuick(s.id, 'Present')}
                          className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                            rec.status === 'Present' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffStatusQuick(s.id, 'Half Day')}
                          className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                            rec.status === 'Half Day' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          HD
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffStatusQuick(s.id, 'On Leave')}
                          className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                            rec.status === 'On Leave' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          }`}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffStatusQuick(s.id, 'Absent')}
                          className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                            rec.status === 'Absent' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          A
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
