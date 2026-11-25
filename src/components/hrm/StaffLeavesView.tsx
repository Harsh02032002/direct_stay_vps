import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  AlertCircle,
  FileText,
  Palmtree,
  X,
  RefreshCw,
  Search,
  UserX,
} from 'lucide-react';
import { Staff, StaffLeaveRequest, RolePermission } from '../../types';
import { showToast } from '../../utils/toast';
import { isBackendServerActive } from '../../utils/supabaseClient';

interface StaffLeavesViewProps {
  staff: Staff[];
  leaveRequests?: StaffLeaveRequest[];
  onUpdateLeaveRequests?: (updated: StaffLeaveRequest[]) => void;
  currentRole?: string;
  loggedInUser?: string;
  hotelId?: string;
  hotelName?: string;
  rolePermissions?: RolePermission[];
  onAddAuditLog?: (action: string, details: string) => void;
}

const LEAVE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Earned Leave',
  'Emergency Leave',
  'Unpaid Leave',
] as const;

export default function StaffLeavesView({
  staff = [],
  leaveRequests = [],
  onUpdateLeaveRequests,
  currentRole = 'Admin',
  loggedInUser = '',
  hotelId = 'hotel-1',
  hotelName = 'DirectStay Hotel',
  rolePermissions = [],
  onAddAuditLog,
}: StaffLeavesViewProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [leaveType, setLeaveType] = useState<string>('Casual Leave');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  // Identify if logged-in user is a staff member vs Admin/Owner/Manager
  const matchedStaff = useMemo(() => {
    const u = String(loggedInUser || '').trim().toLowerCase();
    const storedUsername =
      typeof window !== 'undefined'
        ? String(sessionStorage.getItem('pms_staff_username') || '').trim().toLowerCase()
        : '';
    return staff.find(
      (s) =>
        (storedUsername && String(s.username || '').trim().toLowerCase() === storedUsername) ||
        (u && String(s.username || '').trim().toLowerCase() === u) ||
        (u && String(s.name || '').trim().toLowerCase() === u)
    );
  }, [staff, loggedInUser]);

  const roleLower = String(matchedStaff?.role || currentRole || 'Admin').trim().toLowerCase();
  const matchedRolePerm = useMemo(
    () => rolePermissions.find((rp) => String(rp.roleName || '').trim().toLowerCase() === roleLower),
    [rolePermissions, roleLower]
  );

  const canApproveLeaves = useMemo(() => {
    if (['admin', 'owner', 'superadmin', 'manager', 'hoteladmin'].includes(roleLower)) return true;
    return Boolean(
      matchedRolePerm?.canManageStaff ||
        matchedRolePerm?.modulePermissions?.leaves?.approve ||
        matchedRolePerm?.modulePermissions?.staff?.approve ||
        matchedRolePerm?.modulePermissions?.staff?.manage
    );
  }, [roleLower, matchedRolePerm]);

  // Sync default selected staff when modal opens
  useEffect(() => {
    if (matchedStaff && !canApproveLeaves) {
      setSelectedStaffId(matchedStaff.id);
    } else if (!selectedStaffId && staff.length > 0) {
      setSelectedStaffId(staff[0].id);
    }
  }, [staff, matchedStaff, canApproveLeaves, selectedStaffId]);

  const fetchLeavesFromServer = async () => {
    if (!isBackendServerActive() || !onUpdateLeaveRequests) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = sessionStorage.getItem('pms_session_token') || localStorage.getItem('pms_session_token') || '';
      const resp = await fetch(`/api/pms/modules/leaveRequests?hotelId=${encodeURIComponent(hotelId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load leave requests (${resp.status})`);
      }
      const json = await resp.json();
      if (json?.success && Array.isArray(json.items)) {
        onUpdateLeaveRequests(json.items);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to sync leave requests from database.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial database refresh on mount
  useEffect(() => {
    void fetchLeavesFromServer();
  }, [hotelId]);

  // Visible leave requests: admins/approvers see all; regular staff see their own
  const visibleLeaves = useMemo(() => {
    const base = canApproveLeaves
      ? leaveRequests
      : matchedStaff
      ? leaveRequests.filter((lr) => lr.staffId === matchedStaff.id)
      : leaveRequests;

    const q = searchQuery.trim().toLowerCase();
    return base
      .filter((lr) => {
        if (statusFilter !== 'All' && lr.status !== statusFilter) return false;
        if (!q) return true;
        return (
          String(lr.staffName || '').toLowerCase().includes(q) ||
          String(lr.department || '').toLowerCase().includes(q) ||
          String(lr.leaveType || '').toLowerCase().includes(q) ||
          String(lr.reason || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(b.appliedAt || '').localeCompare(String(a.appliedAt || '')));
  }, [leaveRequests, canApproveLeaves, matchedStaff, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const base = canApproveLeaves
      ? leaveRequests
      : matchedStaff
      ? leaveRequests.filter((lr) => lr.staffId === matchedStaff.id)
      : leaveRequests;
    return {
      total: base.length,
      pending: base.filter((l) => l.status === 'Pending').length,
      approved: base.filter((l) => l.status === 'Approved').length,
      rejected: base.filter((l) => l.status === 'Rejected').length,
    };
  }, [leaveRequests, canApproveLeaves, matchedStaff]);

  const computeDays = (s: string, e: string): number => {
    const d1 = new Date(`${s}T00:00:00`);
    const d2 = new Date(`${e}T00:00:00`);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) return 0;
    return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
  };

  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaffId = !canApproveLeaves && matchedStaff ? matchedStaff.id : selectedStaffId;
    const stf = staff.find((s) => s.id === targetStaffId);
    if (!stf) {
      showToast('Please select a registered staff member first. Onboard staff in HRM → Staff Directory.', 'warning');
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      showToast('End date must be on or after the start date.', 'warning');
      return;
    }
    if (!reason.trim()) {
      showToast('Please provide a reason for the leave request.', 'warning');
      return;
    }

    const days = computeDays(startDate, endDate);
    const nowIso = new Date().toISOString();
    const actor = loggedInUser || stf.name;
    const newReq: StaffLeaveRequest = {
      id: `LEV-${Date.now()}`,
      hotelId,
      staffId: stf.id,
      staffName: stf.name,
      employeeId: stf.employeeId,
      department: stf.department,
      designation: stf.designation,
      role: stf.role || stf.department,
      leaveType,
      startDate,
      endDate,
      days,
      reason: reason.trim(),
      status: 'Pending',
      appliedAt: nowIso.slice(0, 10),
      appliedBy: actor,
      auditHistory: [
        {
          action: 'Submitted',
          status: 'Pending',
          performedBy: actor,
          dateTime: nowIso,
          notes: `${leaveType} for ${days} day(s) (${startDate} to ${endDate})`,
        },
      ],
    };

    const nextList = [newReq, ...leaveRequests];
    onUpdateLeaveRequests?.(nextList);
    setShowApplyModal(false);
    setReason('');
    const log = `Leave request submitted for ${stf.name} (${leaveType}, ${days} day(s): ${startDate} to ${endDate}).`;
    onAddAuditLog?.('Leave Request Submitted', log);
    showToast(log, 'success', 4000, 'Leave Applied');
  };

  const handleApprove = (req: StaffLeaveRequest) => {
    if (!canApproveLeaves) {
      showToast('You do not have permission to approve leave requests.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const reviewer = loggedInUser || currentRole || 'Admin';
    const nextList = leaveRequests.map((l) =>
      l.id === req.id
        ? {
            ...l,
            status: 'Approved' as const,
            reviewedBy: reviewer,
            reviewedAt: nowIso,
            auditHistory: [
              ...(l.auditHistory || []),
              {
                action: 'Approved',
                status: 'Approved',
                performedBy: reviewer,
                dateTime: nowIso,
                notes: 'Approved by authorized reviewer',
              },
            ],
          }
        : l
    );
    onUpdateLeaveRequests?.(nextList);
    onAddAuditLog?.(
      'Leave Request Approved',
      `Approved ${req.leaveType} (${req.days}d: ${req.startDate} to ${req.endDate}) for ${req.staffName}.`
    );
    showToast(`Approved leave request for ${req.staffName}.`, 'success');
  };

  const handleConfirmReject = () => {
    if (!rejectingId) return;
    if (!canApproveLeaves) {
      showToast('You do not have permission to reject leave requests.', 'error');
      return;
    }
    const target = leaveRequests.find((l) => l.id === rejectingId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const reviewer = loggedInUser || currentRole || 'Admin';
    const cleanReason = rejectionNote.trim() || 'Operational staffing requirement';

    const nextList = leaveRequests.map((l) =>
      l.id === rejectingId
        ? {
            ...l,
            status: 'Rejected' as const,
            reviewedBy: reviewer,
            reviewedAt: nowIso,
            rejectionReason: cleanReason,
            auditHistory: [
              ...(l.auditHistory || []),
              {
                action: 'Rejected',
                status: 'Rejected',
                performedBy: reviewer,
                dateTime: nowIso,
                notes: cleanReason,
              },
            ],
          }
        : l
    );
    onUpdateLeaveRequests?.(nextList);
    onAddAuditLog?.(
      'Leave Request Rejected',
      `Rejected ${target.leaveType} (${target.startDate} to ${target.endDate}) for ${target.staffName}. Reason: ${cleanReason}`
    );
    showToast(`Rejected leave request for ${target.staffName}.`, 'info');
    setRejectingId(null);
    setRejectionNote('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <Palmtree className="w-3.5 h-3.5 text-purple-600" /> Live Database Leave Management
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Staff Leave Requests &amp; Approvals
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            {canApproveLeaves
              ? `Review, approve, or reject live leave applications for ${hotelName} staff (synced to MongoDB).`
              : `Submit leave requests and track real-time approval status for ${matchedStaff?.name || loggedInUser}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchLeavesFromServer()}
            disabled={isLoading}
            className="px-3 py-2 bg-luxury-beige-50 hover:bg-luxury-beige-100 border border-luxury-brown-200 text-luxury-brown-800 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            disabled={staff.length === 0}
            onClick={() => {
              if (staff.length === 0) {
                showToast('No staff members found. Onboard staff in HRM → Staff Directory first.', 'warning');
                return;
              }
              setShowApplyModal(true);
            }}
            className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 disabled:opacity-50 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Apply Staff Leave
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchLeavesFromServer()}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg font-bold text-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-luxury-brown-100 p-4 rounded-2xl shadow-3xs">
          <span className="text-[10px] font-mono uppercase text-luxury-brown-500 font-bold">Total Requests</span>
          <div className="text-2xl font-serif font-black text-luxury-brown-950 mt-1">{stats.total}</div>
        </div>
        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl shadow-3xs">
          <span className="text-[10px] font-mono uppercase text-amber-800 font-bold">Pending Review</span>
          <div className="text-2xl font-serif font-black text-amber-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl shadow-3xs">
          <span className="text-[10px] font-mono uppercase text-emerald-800 font-bold">Approved</span>
          <div className="text-2xl font-serif font-black text-emerald-900 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-2xl shadow-3xs">
          <span className="text-[10px] font-mono uppercase text-rose-800 font-bold">Rejected</span>
          <div className="text-2xl font-serif font-black text-rose-900 mt-1">{stats.rejected}</div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-luxury-brown-50">
          <span className="text-xs font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            <FileText className="w-4 h-4 text-luxury-gold-600" />
            Database Leave Requests ({visibleLeaves.length})
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-luxury-brown-400 absolute left-3 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff, type, reason..."
                className="pl-8 pr-3 py-1.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex items-center bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl p-0.5 text-[11px] font-bold">
              {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                    statusFilter === st
                      ? 'bg-luxury-brown-950 text-luxury-gold-400'
                      : 'text-luxury-brown-600 hover:text-luxury-brown-950'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && visibleLeaves.length === 0 ? (
          <div className="py-12 text-center text-xs text-luxury-brown-500">
            Loading live leave requests from database...
          </div>
        ) : visibleLeaves.length === 0 ? (
          <div className="py-12 text-center space-y-2 rounded-2xl bg-luxury-beige-50/40 border border-dashed border-luxury-brown-200">
            {staff.length === 0 ? (
              <>
                <UserX className="w-8 h-8 text-luxury-brown-400 mx-auto" />
                <p className="text-sm font-serif font-bold text-luxury-brown-900">No Staff Members Onboarded Yet</p>
                <p className="text-xs text-luxury-brown-500">
                  Add staff accounts in <strong>HRM → Staff Directory &amp; Onboarding</strong> to start tracking real leave requests.
                </p>
              </>
            ) : (
              <>
                <Calendar className="w-8 h-8 text-luxury-gold-500 mx-auto" />
                <p className="text-sm font-serif font-bold text-luxury-brown-900">No Leave Requests Found</p>
                <p className="text-xs text-luxury-brown-500">
                  All leave applications submitted by staff will appear here in real time. Click <strong>Apply Staff Leave</strong> to create one.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                  <th className="py-2.5 px-4">Staff Member</th>
                  <th className="py-2.5 px-4">Leave Type</th>
                  <th className="py-2.5 px-4">Date Range</th>
                  <th className="py-2.5 px-4">Reason</th>
                  <th className="py-2.5 px-4">Status &amp; Review</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {visibleLeaves.map((req) => (
                  <tr key={req.id} className="hover:bg-luxury-beige-50/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-luxury-brown-950">{req.staffName}</div>
                      <div className="text-[10px] font-mono text-luxury-brown-500">
                        {req.employeeId ? `${req.employeeId} • ` : ''}
                        {req.designation || req.department || 'Staff'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-luxury-brown-800">{req.leaveType}</span>
                      <div className="text-[10px] font-mono text-luxury-brown-400">Applied: {req.appliedAt}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div>
                        {req.startDate} → {req.endDate}
                      </div>
                      <div className="text-[10px] text-luxury-gold-700 font-bold">
                        {req.days || computeDays(req.startDate, req.endDate)} day(s)
                      </div>
                    </td>
                    <td className="py-3 px-4 text-luxury-brown-600 max-w-[240px]">
                      <div className="line-clamp-2">{req.reason}</div>
                      {req.rejectionReason && (
                        <div className="text-[10px] text-rose-700 font-semibold mt-0.5">
                          Note: {req.rejectionReason}
                        </div>
                      )}
                    </td>
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
                        {req.status === 'Pending' && <Clock className="w-3 h-3 text-amber-600" />}
                        {req.status}
                      </span>
                      {req.reviewedBy && (
                        <div className="text-[10px] text-luxury-brown-500 mt-1">
                          By {req.reviewedBy}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {req.status === 'Pending' && canApproveLeaves ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(req.id);
                              setRejectionNote('');
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-mono text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : req.status === 'Pending' ? (
                        <span className="text-[10px] font-mono text-amber-700 font-bold">Awaiting Approval</span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400">
                          {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString('en-IN') : 'Processed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-rose-950 text-white p-5 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">Reject Leave Request</h3>
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Reason for Rejection (visible to staff)
                </label>
                <textarea
                  rows={3}
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="e.g. High occupancy weekend — please reschedule dates."
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingId(null)}
                  className="px-4 py-2 border border-luxury-brown-200 rounded-xl font-bold text-luxury-brown-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  Staff Member *
                </label>
                <select
                  required
                  disabled={!canApproveLeaves && Boolean(matchedStaff)}
                  value={!canApproveLeaves && matchedStaff ? matchedStaff.id : selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium disabled:opacity-75"
                >
                  <option value="">-- Select Staff Member --</option>
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
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium"
                >
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {lt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      if (endDate < val) setEndDate(val);
                    }}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    To Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-luxury-beige-50 border border-luxury-brown-100 text-[11px] font-mono text-luxury-brown-700">
                Total Leave Duration: <strong>{computeDays(startDate, endDate)} day(s)</strong>
              </div>

              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for leave request..."
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-luxury-brown-100">
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
                  Submit Leave Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
