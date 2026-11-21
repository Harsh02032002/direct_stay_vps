import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  AlertCircle,
  FileText,
  UserCheck,
  Palmtree,
  Check,
  X
} from 'lucide-react';
import { Staff } from '../../types';
import { showToast } from '../../utils/toast';

interface StaffLeavesViewProps {
  staff: Staff[];
  hotelName?: string;
  onAddAuditLog?: (action: string, details: string) => void;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  leaveType: 'Casual Leave' | 'Sick Leave' | 'Paid Leave' | 'Emergency';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  appliedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export default function StaffLeavesView({
  staff = [],
  hotelName = 'DirectStay Hotel',
  onAddAuditLog,
}: StaffLeavesViewProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id || '');
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('Casual Leave');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  // Initial leave requests
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: 'LEV-101',
      staffId: staff[0]?.id || 'stf-1',
      staffName: staff[0]?.name || 'Rohit Meena',
      department: staff[0]?.department || 'Reception',
      leaveType: 'Casual Leave',
      startDate: '2026-11-24',
      endDate: '2026-11-25',
      daysCount: 2,
      reason: 'Family function in hometown',
      appliedDate: '2026-11-21',
      status: 'Pending',
    },
    {
      id: 'LEV-102',
      staffId: staff[1]?.id || 'stf-2',
      staffName: staff[1]?.name || 'Priya Sharma',
      department: staff[1]?.department || 'Accounts',
      leaveType: 'Sick Leave',
      startDate: '2026-11-20',
      endDate: '2026-11-21',
      daysCount: 1,
      reason: 'Doctor prescribed rest for fever',
      appliedDate: '2026-11-19',
      status: 'Approved',
    },
  ]);

  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const stf = staff.find((s) => s.id === selectedStaffId);
    if (!stf) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.max(0, end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const newReq: LeaveRequest = {
      id: `LEV-${Date.now()}`,
      staffId: stf.id,
      staffName: stf.name,
      department: stf.department,
      leaveType,
      startDate,
      endDate,
      daysCount: days,
      reason: reason.trim() || 'Personal commitments',
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
    };

    setLeaveRequests([newReq, ...leaveRequests]);
    setShowApplyModal(false);
    setReason('');
    const log = `Leave request submitted by ${stf.name} (${leaveType}, ${days} day(s): ${startDate} to ${endDate}).`;
    onAddAuditLog?.('Leave Request Submitted', log);
    showToast(log, 'success', 4000, 'Leave Applied');
  };

  const handleApprove = (id: string) => {
    setLeaveRequests(
      leaveRequests.map((l) => (l.id === id ? { ...l, status: 'Approved' } : l))
    );
    showToast('Leave request approved!', 'success');
  };

  const handleReject = (id: string) => {
    setLeaveRequests(
      leaveRequests.map((l) => (l.id === id ? { ...l, status: 'Rejected' } : l))
    );
    showToast('Leave request rejected.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <Palmtree className="w-3.5 h-3.5 text-purple-600" /> Statutory &amp; Casual Leave Management
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Leave Requests &amp; Entitlements
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Track annual leave quotas, apply for emergency or planned time-off, and review manager approvals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowApplyModal(true)}
          className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Apply Staff Leave
        </button>
      </div>

      {/* Quotas Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-luxury-brown-100 p-4 rounded-2xl shadow-3xs">
          <div className="flex items-center justify-between pb-2 border-b border-luxury-brown-50">
            <span className="text-xs font-bold text-luxury-brown-950">Casual Leave (CL)</span>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">12 Days / Yr</span>
          </div>
          <p className="text-[11px] text-luxury-brown-500 mt-2">Short personal emergency or family commitments.</p>
        </div>

        <div className="bg-white border border-luxury-brown-100 p-4 rounded-2xl shadow-3xs">
          <div className="flex items-center justify-between pb-2 border-b border-luxury-brown-50">
            <span className="text-xs font-bold text-luxury-brown-950">Sick Leave (SL)</span>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">10 Days / Yr</span>
          </div>
          <p className="text-[11px] text-luxury-brown-500 mt-2">Medical health rest with doctor certificate verification.</p>
        </div>

        <div className="bg-white border border-luxury-brown-100 p-4 rounded-2xl shadow-3xs">
          <div className="flex items-center justify-between pb-2 border-b border-luxury-brown-50">
            <span className="text-xs font-bold text-luxury-brown-950">Paid / Earned Leave (PL)</span>
            <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">15 Days / Yr</span>
          </div>
          <p className="text-[11px] text-luxury-brown-500 mt-2">Annual privilege vacations and festive holidays.</p>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-luxury-brown-50">
          <span className="text-xs font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            <FileText className="w-4 h-4 text-luxury-gold-600" />
            Submitted Leave Requests ({leaveRequests.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4">Leave Type</th>
                <th className="py-2.5 px-4">Duration</th>
                <th className="py-2.5 px-4">Reason</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-luxury-brown-100">
              {leaveRequests.map((req) => (
                <tr key={req.id} className="hover:bg-luxury-beige-50/40">
                  <td className="py-3 px-4">
                    <div className="font-bold text-luxury-brown-950">{req.staffName}</div>
                    <div className="text-[10px] font-mono text-luxury-brown-500">{req.department}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-luxury-brown-800">{req.leaveType}</span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <div>
                      {req.startDate} → {req.endDate}
                    </div>
                    <div className="text-[10px] text-luxury-gold-700 font-bold">{req.daysCount} day(s)</div>
                  </td>
                  <td className="py-3 px-4 text-luxury-brown-600 max-w-[200px] truncate">{req.reason}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        req.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : req.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {req.status === 'Approved' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {req.status === 'Rejected' && <XCircle className="w-3 h-3 text-rose-600" />}
                      {req.status === 'Pending' && <Clock className="w-3 h-3 text-amber-600 animate-pulse" />}
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {req.status === 'Pending' ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApprove(req.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(req.id)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-mono text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-luxury-brown-950 text-white p-5 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <Palmtree className="w-4 h-4 text-luxury-gold-400" /> Apply Staff Leave Request
              </h3>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="text-luxury-brown-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Employee *
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.department} • {s.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Leave Type *
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2"
                >
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick Leave">Sick Leave (SL)</option>
                  <option value="Paid Leave">Paid / Earned Leave (PL)</option>
                  <option value="Emergency">Emergency Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Reason / Remarks *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain reason for leave..."
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl p-3"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-luxury-brown-50">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 rounded-xl text-luxury-brown-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl cursor-pointer"
                >
                  Submit Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
