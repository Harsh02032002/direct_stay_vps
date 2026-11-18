import React, { useEffect, useState } from 'react';
import {
  Users,
  ShieldCheck,
  Clock,
  IndianRupee,
  CheckCircle2,
  Trash2,
  Download,
  Printer,
  LogIn,
  LogOut,
  Save,
  MessageCircle,
  KeyRound,
} from 'lucide-react';
import { PaymentMethod, StaffMemberRecord } from '../types';
import { exportToCsv, formatCurrency } from '../utils/formatters';
import {
  PMS_MODULES_LIST,
  DEFAULT_RBAC_MATRIX,
  PermissionRule,
  RbacMatrix,
  useRbacMatrix,
} from '../utils/rbacPermissions';

interface StaffModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  staff: StaffMemberRecord[];
  hotelName?: string;
  onAddStaff: (member: Omit<StaffMemberRecord, 'id'>) => void;
  onUpdateStaffMember?: (id: string, updates: Partial<StaffMemberRecord>) => void;
  onDeleteStaffMember?: (id: string) => void;
  onSaveRbacMatrix?: (matrix: RbacMatrix) => void;
  onDisburseSalary?: (payload: {
    staffId: string;
    staffName: string;
    role: string;
    month: string;
    netAmount: number;
    paymentMethod: PaymentMethod;
  }) => void;
}

const SUB_TABS = [
  { id: 'directory', label: 'Staff Roster & Shifts' },
  { id: 'roles', label: 'RBAC Module Permissions' },
  { id: 'attendance', label: 'Biometric Attendance' },
  { id: 'payroll', label: 'Monthly Payroll & KPIs' },
];

interface AttendanceEntry {
  staffId: string;
  date: string;
  punchIn: string;
  punchOut: string;
  status: 'Present' | 'Late' | 'Half Day' | 'On Leave' | 'Not Punched';
  remarks: string;
}

interface PayrollAdjustment {
  incentive: number;
  deduction: number;
  paidStatus: 'Pending' | 'Paid';
  paidDate?: string;
  paidMode?: PaymentMethod;
}

export const StaffModule: React.FC<StaffModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  staff,
  hotelName = 'Grand Pavilion Hotel',
  onAddStaff,
  onUpdateStaffMember,
  onDeleteStaffMember,
  onSaveRbacMatrix,
  onDisburseSalary,
}) => {
  const currentTab =
    activeSubTab === 'dashboard' || !SUB_TABS.some((t) => t.id === activeSubTab)
      ? 'directory'
      : activeSubTab;

  // Sub-Tab 1: Roster & Onboarding form state
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffMemberRecord['role']>('Receptionist');
  const [department, setDepartment] = useState<StaffMemberRecord['department']>('Front Office');
  const [shift, setShift] = useState('Morning (7AM–3PM)');
  const [mobile, setMobile] = useState('');
  const [salary, setSalary] = useState(22000);
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [autoShareWhatsapp, setAutoShareWhatsapp] = useState(true);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Sub-Tab 2: RBAC Matrix state (persisted globally & synced to Sidebar + Modules)
  const [selectedRoleForRbac, setSelectedRoleForRbac] = useState<string>('Receptionist');
  const [rbacMatrix, setRbacMatrix] = useRbacMatrix();

  // Sub-Tab 3: Biometric Attendance state
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceEntry>>({});

  // Sub-Tab 4: Monthly Payroll & KPIs state
  const [payrollMonth, setPayrollMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrollAdjustments, setPayrollAdjustments] = useState<Record<string, PayrollAdjustment>>({});
  const [salaryPaymentMode, setSalaryPaymentMode] = useState<PaymentMethod>('UPI');

  // Helper to open WhatsApp with pre-filled Login ID & Password on the staff member's phone number
  const handleShareCredentialsOnWhatsApp = (member: {
    id?: string;
    name: string;
    role: string;
    department: string;
    shift: string;
    mobile: string;
    username: string;
    password?: string;
  }) => {
    let rawPhone = (member.mobile || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) {
      const entered = window.prompt(
        `Enter 10-digit WhatsApp mobile number for ${member.name}:`,
        member.mobile || ''
      );
      if (!entered) return;
      rawPhone = entered.replace(/\D/g, '');
      if (member.id && onUpdateStaffMember && rawPhone.length >= 10) {
        onUpdateStaffMember(member.id, { mobile: rawPhone.slice(-10) });
      }
    }
    if (!rawPhone) return;

    const formattedPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const loginUrl = `${window.location.origin}/admin`;
    const staffPassword =
      member.password || `${member.name.trim().split(' ')[0] || 'Staff'}@123`;

    const messageText = [
      `🏨 *${hotelName} — Staff PMS Login Credentials*`,
      ``,
      `Hello *${member.name}*,`,
      `Your Hotel PMS Staff Portal account is active. Please use the login details below:`,
      ``,
      `🔹 *Role*: ${member.role} (${member.department})`,
      `🔹 *Shift*: ${member.shift}`,
      `🌐 *Portal Link*: ${loginUrl}`,
      `👤 *Login Username*: ${member.username}`,
      `🔑 *Password*: ${staffPassword}`,
      ``,
      `Please keep your login credentials confidential.`,
    ].join('\n');

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setActionBanner(
      `Opened WhatsApp chat for ${member.name} (+${formattedPhone}) with pre-filled Login ID & Password.`
    );
  };

  // Initialize default attendance rows for any staff member
  useEffect(() => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      staff.forEach((s) => {
        const key = `${s.id}_${attendanceDate}`;
        if (!next[key]) {
          next[key] = {
            staffId: s.id,
            date: attendanceDate,
            punchIn: s.status === 'Active' ? '07:02 AM' : '--',
            punchOut: '--',
            status: s.status === 'On Leave' ? 'On Leave' : 'Present',
            remarks: s.status === 'Active' ? 'Biometric Verified' : 'Approved Leave',
          };
        }
      });
      return next;
    });
  }, [staff, attendanceDate]);

  const derivedUsername =
    customUsername.trim() || name.trim().toLowerCase().replace(/\s+/g, '.') || 'staff.user';
  const derivedPassword =
    customPassword.trim() ||
    (name.trim() ? `${name.trim().split(' ')[0]}@123` : 'Staff@123');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newMemberPayload: Omit<StaffMemberRecord, 'id'> = {
      name: name.trim(),
      role,
      department,
      mobile: mobile.trim(),
      username: derivedUsername,
      password: derivedPassword,
      shift,
      salary,
      joiningDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      checkInsHandled: 0,
      roomsCleaned: 0,
    };
    onAddStaff(newMemberPayload);
    setActionBanner(
      `Added staff member ${name.trim()} (Login: ${derivedUsername} / Pass: ${derivedPassword}).`
    );

    if (autoShareWhatsapp && mobile.trim()) {
      handleShareCredentialsOnWhatsApp(newMemberPayload);
    }

    setName('');
    setMobile('');
    setCustomUsername('');
    setCustomPassword('');
  };

  const handleTogglePermission = (
    roleName: string,
    modId: string,
    field: keyof PermissionRule
  ) => {
    const rolePerms = rbacMatrix[roleName] || DEFAULT_RBAC_MATRIX[roleName] || DEFAULT_RBAC_MATRIX.Receptionist;
    const currentMod = rolePerms[modId] || {
      view: false,
      createEdit: false,
      deleteCancel: false,
      approveExport: false,
    };
    const nextValue = !currentMod[field];
    const updatedMod: PermissionRule = {
      ...currentMod,
      [field]: nextValue,
    };
    // If view is unchecked, also uncheck action permissions; if an action is checked, ensure view is true
    if (field === 'view' && !nextValue) {
      updatedMod.createEdit = false;
      updatedMod.deleteCancel = false;
      updatedMod.approveExport = false;
    } else if (field !== 'view' && nextValue) {
      updatedMod.view = true;
    }

    const nextMatrix: RbacMatrix = {
      ...rbacMatrix,
      [roleName]: {
        ...rolePerms,
        [modId]: updatedMod,
      },
    };
    setRbacMatrix(nextMatrix);
    if (onSaveRbacMatrix) {
      onSaveRbacMatrix(nextMatrix);
    }
  };

  const handlePunchAction = (
    member: StaffMemberRecord,
    action: 'PUNCH_IN' | 'PUNCH_OUT' | 'LATE' | 'HALF_DAY' | 'LEAVE'
  ) => {
    const key = `${member.id}_${attendanceDate}`;
    const nowTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setAttendanceMap((prev) => {
      const existing = prev[key] || {
        staffId: member.id,
        date: attendanceDate,
        punchIn: '--',
        punchOut: '--',
        status: 'Not Punched',
        remarks: '',
      };
      if (action === 'PUNCH_IN') {
        return {
          ...prev,
          [key]: {
            ...existing,
            punchIn: nowTime,
            status: 'Present',
            remarks: `Punched In at ${nowTime}`,
          },
        };
      }
      if (action === 'PUNCH_OUT') {
        return {
          ...prev,
          [key]: {
            ...existing,
            punchOut: nowTime,
            remarks: `Shift Completed (${existing.punchIn} - ${nowTime})`,
          },
        };
      }
      if (action === 'LATE') {
        return {
          ...prev,
          [key]: {
            ...existing,
            punchIn: existing.punchIn === '--' ? nowTime : existing.punchIn,
            status: 'Late',
            remarks: 'Late Arrival Logged',
          },
        };
      }
      if (action === 'HALF_DAY') {
        return {
          ...prev,
          [key]: {
            ...existing,
            status: 'Half Day',
            remarks: 'Half-Day Shift',
          },
        };
      }
      return {
        ...prev,
        [key]: {
          ...existing,
          punchIn: '--',
          punchOut: '--',
          status: 'On Leave',
          remarks: 'Marked On Leave',
        },
      };
    });
    if (action === 'LEAVE' && onUpdateStaffMember) {
      onUpdateStaffMember(member.id, { status: 'On Leave' });
    } else if (action === 'PUNCH_IN' && onUpdateStaffMember) {
      onUpdateStaffMember(member.id, { status: 'Active' });
    }
    setActionBanner(`Updated biometric attendance for ${member.name}.`);
  };

  const getAdjustment = (staffId: string): PayrollAdjustment => {
    const key = `${staffId}_${payrollMonth}`;
    return (
      payrollAdjustments[key] || {
        incentive: 0,
        deduction: 0,
        paidStatus: 'Pending',
      }
    );
  };

  const updateAdjustment = (staffId: string, patch: Partial<PayrollAdjustment>) => {
    const key = `${staffId}_${payrollMonth}`;
    setPayrollAdjustments((prev) => ({
      ...prev,
      [key]: {
        ...getAdjustment(staffId),
        ...patch,
      },
    }));
  };

  const totalBasePayroll = staff.reduce((s, m) => s + (Number(m.salary) || 0), 0);
  const totalNetPayroll = staff.reduce((s, m) => {
    const adj = getAdjustment(m.id);
    return s + Math.max(0, (Number(m.salary) || 0) + adj.incentive - adj.deduction);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Header & Sub-Tab Navigation */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Staff Workspace, Shifts & RBAC Control
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Employee Roster, Shift Allocation, Role-Based Access Permissions, Biometric Attendance & Monthly Payroll
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 text-[11px] sm:text-xs w-full md:w-auto">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-center">
              Active On-Duty: {staff.filter((s) => s.status === 'Active').length} Staff
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-center truncate">
              Payroll: {formatCurrency(totalBasePayroll)}
            </span>
          </div>
        </div>

        {actionBanner && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 font-bold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {actionBanner}
            </span>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="text-emerald-700 hover:underline text-[11px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: STAFF ROSTER & SHIFTS (`directory`)                            */}
      {/* ===================================================================== */}
      {currentTab === 'directory' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreate}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit"
          >
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              Onboard Hotel Staff Member
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rohit Meena"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    <option value="Receptionist">Receptionist</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Manager">Manager</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Kitchen Chef">Kitchen Chef</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    <option value="Front Office">Front Office</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="F&B Kitchen">F&B Kitchen</option>
                    <option value="Accounts">Accounts</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Assigned Shift</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  <option value="Morning (7AM–3PM)">Morning (7AM–3PM)</option>
                  <option value="Evening (3PM–11PM)">Evening (3PM–11PM)</option>
                  <option value="Night (11PM–7AM)">Night (11PM–7AM)</option>
                  <option value="General (9AM–6PM)">General (9AM–6PM)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    WhatsApp Mobile *
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="9829044556"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              {/* Portal Login Username & Password */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-600" />
                  Staff Portal Login Credentials
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Login Username
                    </label>
                    <input
                      type="text"
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value)}
                      placeholder={derivedUsername}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Login Password
                    </label>
                    <input
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder={derivedPassword}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoShareWhatsapp}
                    onChange={(e) => setAutoShareWhatsapp(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-600 rounded"
                  />
                  <span className="text-[11px] font-bold text-emerald-800">
                    Auto-open WhatsApp with Login ID & Password on save
                  </span>
                </label>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              + Add Staff & Issue Login
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[740px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Login ID & Pass</th>
                    <th className="py-3 px-4">Role & Dept</th>
                    <th className="py-3 px-4">Shift Allocation</th>
                    <th className="py-3 px-4">Salary</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">WhatsApp & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((m) => {
                    const staffPass =
                      m.password || `${m.name.trim().split(' ')[0] || 'Staff'}@123`;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <div className="text-[10px] text-slate-500">
                            +91 {m.mobile || 'No Phone'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-800 text-[11px]">
                            👤 @{m.username}
                          </div>
                          <div className="font-mono text-[10px] text-amber-800 bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 rounded inline-flex items-center gap-1 mt-0.5">
                            🔑 {staffPass}
                            {onUpdateStaffMember && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextPass = window.prompt(
                                    `Set new login password for ${m.name} (@${m.username}):`,
                                    staffPass
                                  );
                                  if (nextPass && nextPass.trim()) {
                                    onUpdateStaffMember(m.id, { password: nextPass.trim() });
                                    setActionBanner(
                                      `Updated password for ${m.name} (@${m.username}).`
                                    );
                                  }
                                }}
                                className="text-[9px] text-blue-700 hover:underline ml-1 cursor-pointer"
                                title="Change Password"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{m.role}</div>
                          <div className="text-[10px] text-slate-500">{m.department}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={m.shift}
                            onChange={(e) => {
                              if (onUpdateStaffMember) {
                                onUpdateStaffMember(m.id, { shift: e.target.value });
                                setActionBanner(
                                  `Updated shift for ${m.name} to ${e.target.value}.`
                                );
                              }
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-[11px]"
                          >
                            <option value="Morning">Morning</option>
                            <option value="Morning (7AM–3PM)">Morning (7AM–3PM)</option>
                            <option value="Evening (3PM–11PM)">Evening (3PM–11PM)</option>
                            <option value="Night (11PM–7AM)">Night (11PM–7AM)</option>
                            <option value="General (9AM–6PM)">General (9AM–6PM)</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold">{formatCurrency(m.salary)}</td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus = m.status === 'Active' ? 'On Leave' : 'Active';
                              if (onUpdateStaffMember) {
                                onUpdateStaffMember(m.id, { status: nextStatus });
                                setActionBanner(`${m.name} marked as ${nextStatus}.`);
                              }
                            }}
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] cursor-pointer ${
                              m.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {m.status}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleShareCredentialsOnWhatsApp({
                                  ...m,
                                  password: staffPass,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] inline-flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
                              title={`Send Login ID & Password to +91 ${m.mobile} on WhatsApp`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp Login</span>
                            </button>
                            {onDeleteStaffMember && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Remove ${m.name} from staff roster?`)) {
                                    onDeleteStaffMember(m.id);
                                    setActionBanner(`Removed ${m.name} from staff roster.`);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title="Delete Staff"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* ===================================================================== */}
      {/* TAB 2: RBAC MODULE PERMISSIONS (`roles`)                              */}
      {/* ===================================================================== */}
      {currentTab === 'roles' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                Role-Based Access Control (RBAC) & Module Permission Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Configure granular View, Create/Edit, Delete/Cancel, and Export privileges for each hotel designation
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['Receptionist', 'Housekeeping', 'Manager', 'Accounts', 'Kitchen Chef'] as const).map(
                (rName) => (
                  <button
                    key={rName}
                    type="button"
                    onClick={() => setSelectedRoleForRbac(rName)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedRoleForRbac === rName
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {rName}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => {
                  setRbacMatrix(rbacMatrix);
                  if (onSaveRbacMatrix) {
                    onSaveRbacMatrix(rbacMatrix);
                  }
                  setActionBanner(
                    `Saved & applied RBAC Module Permissions for ${selectedRoleForRbac} role across Sidebar & all PMS Modules.`
                  );
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Role Policy
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3.5 px-5">PMS Module / Workspace</th>
                  <th className="py-3.5 px-4 text-center">View Module</th>
                  <th className="py-3.5 px-4 text-center">Create & Edit</th>
                  <th className="py-3.5 px-4 text-center">Cancel / Delete</th>
                  <th className="py-3.5 px-4 text-center">Approve & CSV Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PMS_MODULES_LIST.map((mod) => {
                  const rule = rbacMatrix[selectedRoleForRbac]?.[mod.id] || {
                    view: false,
                    createEdit: false,
                    deleteCancel: false,
                    approveExport: false,
                  };
                  return (
                    <tr key={mod.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-5 font-bold text-slate-900">{mod.name}</td>
                      {(['view', 'createEdit', 'deleteCancel', 'approveExport'] as const).map(
                        (field) => (
                          <td key={field} className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={rule[field]}
                              onChange={() =>
                                handleTogglePermission(selectedRoleForRbac, mod.id, field)
                              }
                              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                            />
                          </td>
                        )
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: BIOMETRIC ATTENDANCE (`attendance`)                            */}
      {/* ===================================================================== */}
      {currentTab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500">Total Roster Staff</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{staff.length}</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
              <div className="text-[11px] font-bold text-emerald-700">Present Today</div>
              <div className="text-2xl font-extrabold text-emerald-900 mt-1">
                {
                  staff.filter(
                    (s) => attendanceMap[`${s.id}_${attendanceDate}`]?.status === 'Present'
                  ).length
                }
              </div>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
              <div className="text-[11px] font-bold text-amber-700">Late / Half-Day</div>
              <div className="text-2xl font-extrabold text-amber-900 mt-1">
                {
                  staff.filter((s) =>
                    ['Late', 'Half Day'].includes(
                      attendanceMap[`${s.id}_${attendanceDate}`]?.status || ''
                    )
                  ).length
                }
              </div>
            </div>
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
              <div className="text-[11px] font-bold text-rose-700">On Leave / Absent</div>
              <div className="text-2xl font-extrabold text-rose-900 mt-1">
                {
                  staff.filter(
                    (s) => attendanceMap[`${s.id}_${attendanceDate}`]?.status === 'On Leave'
                  ).length
                }
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Daily Biometric Punch-In / Punch-Out Register
                </h3>
                <p className="text-xs text-slate-500">
                  Log real-time shift attendance, late arrivals, half-days, and leaves
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold"
                />
                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      `DirectStay_Attendance_${attendanceDate}.csv`,
                      staff.map((s) => {
                        const att = attendanceMap[`${s.id}_${attendanceDate}`];
                        return {
                          Date: attendanceDate,
                          Employee: s.name,
                          Role: s.role,
                          Department: s.department,
                          Shift: s.shift,
                          PunchIn: att?.punchIn || '--',
                          PunchOut: att?.punchOut || '--',
                          Status: att?.status || 'Present',
                          Remarks: att?.remarks || '',
                        };
                      })
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Attendance CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[740px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role & Shift</th>
                    <th className="py-3 px-4">Punch-In Time</th>
                    <th className="py-3 px-4">Punch-Out Time</th>
                    <th className="py-3 px-4">Attendance Status</th>
                    <th className="py-3 px-4">Biometric / Shift Notes</th>
                    <th className="py-3 px-4 text-right">Quick Punch Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((m) => {
                    const att = attendanceMap[`${m.id}_${attendanceDate}`] || {
                      staffId: m.id,
                      date: attendanceDate,
                      punchIn: '07:02 AM',
                      punchOut: '--',
                      status: 'Present',
                      remarks: 'Biometric Verified',
                    };
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <div className="text-[10px] text-slate-400">@{m.username}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{m.role}</div>
                          <div className="text-[10px] text-slate-500">{m.shift}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                          {att.punchIn}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {att.punchOut}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              att.status === 'Present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.status === 'Late' || att.status === 'Half Day'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{att.remarks}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePunchAction(m, 'PUNCH_IN')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <LogIn className="w-3 h-3" />
                              Punch In
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePunchAction(m, 'PUNCH_OUT')}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <LogOut className="w-3 h-3" />
                              Punch Out
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePunchAction(m, 'LATE')}
                              className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] cursor-pointer"
                            >
                              Late
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePunchAction(m, 'LEAVE')}
                              className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[10px] cursor-pointer"
                            >
                              Leave
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
      )}

      {/* ===================================================================== */}
      {/* TAB 4: MONTHLY PAYROLL & KPIs (`payroll`)                             */}
      {/* ===================================================================== */}
      {currentTab === 'payroll' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500">Base Monthly Payroll</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {formatCurrency(totalBasePayroll)}
              </div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
              <div className="text-[11px] font-bold text-emerald-700">
                Total Net Payable ({payrollMonth})
              </div>
              <div className="text-xl font-extrabold text-emerald-900 mt-1">
                {formatCurrency(totalNetPayroll)}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
              <div className="text-[11px] font-bold text-blue-700">Front Desk Check-Ins KPI</div>
              <div className="text-xl font-extrabold text-blue-900 mt-1">
                {staff.reduce((s, m) => s + (Number(m.checkInsHandled) || 0), 0)} Check-Ins
              </div>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
              <div className="text-[11px] font-bold text-amber-700">Housekeeping Turnovers KPI</div>
              <div className="text-xl font-extrabold text-amber-900 mt-1">
                {staff.reduce((s, m) => s + (Number(m.roomsCleaned) || 0), 0)} Rooms Cleaned
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-amber-500" />
                  Monthly Payroll Sheet, Incentives & Staff Productivity KPIs
                </h3>
                <p className="text-xs text-slate-500">
                  Add performance bonuses, deduct salary advances, and disburse monthly salaries directly into Finance Hub
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold"
                />
                <select
                  value={salaryPaymentMode}
                  onChange={(e) => setSalaryPaymentMode(e.target.value as PaymentMethod)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  <option value="UPI">Pay via UPI</option>
                  <option value="Bank Transfer">Pay via NEFT / Bank</option>
                  <option value="Cash">Pay via Cash</option>
                </select>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Payroll
                </button>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[740px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role & Shift</th>
                    <th className="py-3 px-4">Productivity KPI</th>
                    <th className="py-3 px-4">Base Salary</th>
                    <th className="py-3 px-4">Incentive / Bonus (+)</th>
                    <th className="py-3 px-4">Advance / Deduction (-)</th>
                    <th className="py-3 px-4">Net Payable</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Disburse Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((m) => {
                    const adj = getAdjustment(m.id);
                    const netPay = Math.max(0, (Number(m.salary) || 0) + adj.incentive - adj.deduction);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <div className="text-[10px] text-slate-400">+91 {m.mobile || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{m.role}</div>
                          <div className="text-[10px] text-slate-500">{m.department}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {m.department === 'Housekeeping' ? (
                              <>
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                                  {m.roomsCleaned} Rooms
                                </span>
                                {onUpdateStaffMember && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateStaffMember(m.id, {
                                        roomsCleaned: (m.roomsCleaned || 0) + 1,
                                      })
                                    }
                                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-[10px] cursor-pointer"
                                    title="Increment Rooms Cleaned KPI"
                                  >
                                    +1
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                                  {m.checkInsHandled} Check-Ins
                                </span>
                                {onUpdateStaffMember && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateStaffMember(m.id, {
                                        checkInsHandled: (m.checkInsHandled || 0) + 1,
                                      })
                                    }
                                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-[10px] cursor-pointer"
                                    title="Increment Check-Ins Handled KPI"
                                  >
                                    +1
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold">{formatCurrency(m.salary)}</td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            min={0}
                            value={adj.incentive}
                            onChange={(e) =>
                              updateAdjustment(m.id, {
                                incentive: Math.max(0, Number(e.target.value)),
                              })
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50/40 font-bold text-emerald-800"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            min={0}
                            value={adj.deduction}
                            onChange={(e) =>
                              updateAdjustment(m.id, {
                                deduction: Math.max(0, Number(e.target.value)),
                              })
                            }
                            className="w-20 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50/40 font-bold text-rose-800"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">
                          {formatCurrency(netPay)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              adj.paidStatus === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {adj.paidStatus === 'Paid'
                              ? `Paid (${adj.paidMode || 'UPI'})`
                              : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {adj.paidStatus === 'Paid' ? (
                            <span className="text-[11px] font-bold text-emerald-700">
                              ✓ Disbursed
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                updateAdjustment(m.id, {
                                  paidStatus: 'Paid',
                                  paidDate: new Date().toISOString().slice(0, 10),
                                  paidMode: salaryPaymentMode,
                                });
                                if (onDisburseSalary) {
                                  onDisburseSalary({
                                    staffId: m.id,
                                    staffName: m.name,
                                    role: m.role,
                                    month: payrollMonth,
                                    netAmount: netPay,
                                    paymentMethod: salaryPaymentMode,
                                  });
                                }
                                setActionBanner(
                                  `Disbursed ₹${netPay.toLocaleString('en-IN')} salary to ${m.name} via ${salaryPaymentMode} & recorded in Finance Hub.`
                                );
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] cursor-pointer"
                            >
                              Pay Salary
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
