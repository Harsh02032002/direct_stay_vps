import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  Check,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { GranularModuleAccess, RolePermission, Staff } from '../../types';
import { showToast } from '../../utils/toast';

interface RolePermissionsViewProps {
  rolePermissions: RolePermission[];
  staff?: Staff[];
  onUpdateRolePermissions: (updated: RolePermission[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export interface HrmRbacModuleDef {
  id: string;
  label: string;
  desc: string;
  sidebarTabs: string[];
  legacyKey?: keyof RolePermission;
  actions: Array<keyof GranularModuleAccess>;
}

export const HRM_RBAC_MODULES: HrmRbacModuleDef[] = [
  { id: 'dashboard', label: 'Dashboard', desc: 'KPI cards, occupancy & shift overview', sidebarTabs: ['dashboard'], actions: ['view'] },
  { id: 'frontDesk', label: 'Front Desk & Reservations', desc: 'Bookings, check-in, in-house, checkout', sidebarTabs: ['frontDesk', 'todayBookings', 'bookingEngine', 'userList'], legacyKey: 'canManageBookings', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { id: 'calendar', label: 'Stay Overview (Calendar)', desc: 'Room grid, drag-drop & quick bookings', sidebarTabs: ['calendar'], legacyKey: 'canManageBookings', actions: ['view', 'create', 'edit'] },
  { id: 'rooms', label: 'Room Management & Floors', desc: 'Rooms, bulk creation, custom floors, blocked rooms', sidebarTabs: ['rooms'], legacyKey: 'canManageRooms', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { id: 'housekeeping', label: 'Housekeeping & Lost/Found', desc: 'Cleaning logs, laundry, Lost & Found register', sidebarTabs: ['housekeeping'], legacyKey: 'canManageRooms', actions: ['view', 'create', 'edit', 'manage'] },
  { id: 'pos', label: 'POS & Restaurant', desc: 'POS terminal, tables, menu categories, advance food', sidebarTabs: ['pos'], actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { id: 'inventory', label: 'Inventory Store', desc: 'Stock, suppliers, purchases & movements', sidebarTabs: ['inventory'], actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'invoice', label: 'Billing & Invoices', desc: 'GST invoices, payments, credit notes', sidebarTabs: ['invoice'], legacyKey: 'canManageBookings', actions: ['view', 'create', 'edit', 'manage'] },
  { id: 'reports', label: 'Reports & Daily Collection', desc: 'Daily collection sheet, sales, pending dues', sidebarTabs: ['reports', 'dailyReport'], legacyKey: 'canViewReports', actions: ['view', 'manage'] },
  { id: 'finance', label: 'Finance & Expenses', desc: 'Expenses, cash handovers, vouchers', sidebarTabs: ['finance', 'expenses', 'handover'], legacyKey: 'canManageExpenses', actions: ['view', 'create', 'edit', 'approve'] },
  { id: 'otaManager', label: 'Channel Manager (OTA)', desc: 'OTA mappings, rate rules & sync', sidebarTabs: ['otaManager'], legacyKey: 'canManageOta', actions: ['view', 'edit', 'manage'] },
  { id: 'staff', label: 'HRM & Staff Directory', desc: 'Staff onboarding, work timing, attendance, payroll', sidebarTabs: ['staff'], legacyKey: 'canManageStaff', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { id: 'leaves', label: 'Staff Leave Requests', desc: 'View, apply, approve & reject staff leaves', sidebarTabs: ['staff'], legacyKey: 'canManageStaff', actions: ['view', 'create', 'approve'] },
  { id: 'roles', label: 'Staff Roles & RBAC', desc: 'Create roles & configure module permissions', sidebarTabs: ['staff'], legacyKey: 'canManageStaff', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { id: 'profile', label: 'Hotel Settings & Policies', desc: 'Master setup, custom floors, GST, policies', sidebarTabs: ['profile', 'policies'], legacyKey: 'canManagePolicies', actions: ['view', 'edit', 'manage'] },
  { id: 'auditLogs', label: 'Audit Logs', desc: 'Immutable operational & security audit logs', sidebarTabs: ['auditLogs'], legacyKey: 'canViewReports', actions: ['view'] },
];

const ALL_ACTIONS: Array<{ key: keyof GranularModuleAccess; label: string }> = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'approve', label: 'Approve' },
  { key: 'manage', label: 'Manage' },
];

export function deriveModulePermissionsFromRole(rp: RolePermission): Record<string, GranularModuleAccess> {
  if (rp.modulePermissions && Object.keys(rp.modulePermissions).length > 0) {
    return rp.modulePermissions;
  }
  const roleLower = String(rp.roleName || '').toLowerCase();
  const isFullAdmin = roleLower === 'admin' || roleLower === 'manager' || roleLower === 'owner';
  const result: Record<string, GranularModuleAccess> = {};
  for (const mod of HRM_RBAC_MODULES) {
    const legacyOn = mod.legacyKey ? Boolean(rp[mod.legacyKey]) : false;
    const isPosRole = mod.id === 'pos' && (roleLower.includes('kitchen') || roleLower.includes('cashier') || roleLower.includes('reception') || isFullAdmin);
    const isDash = mod.id === 'dashboard';
    const enabled = isFullAdmin || legacyOn || isPosRole || isDash;
    const access: GranularModuleAccess = {};
    for (const act of mod.actions) {
      if (isFullAdmin) {
        access[act] = true;
      } else if (enabled) {
        access[act] = act === 'delete' ? false : act === 'approve' ? Boolean(rp.canManageStaff || rp.canManageExpenses) : true;
      } else {
        access[act] = false;
      }
    }
    result[mod.id] = access;
  }
  return result;
}

export function deriveAllowedSidebarTabsFromRolePerm(rp: RolePermission): string[] {
  const mp = deriveModulePermissionsFromRole(rp);
  const tabs = new Set<string>();
  for (const mod of HRM_RBAC_MODULES) {
    const access = mp[mod.id];
    if (access && Object.values(access).some(Boolean)) {
      mod.sidebarTabs.forEach((t) => tabs.add(t));
    }
  }
  return Array.from(tabs);
}

export default function RolePermissionsView({
  rolePermissions = [],
  staff = [],
  onUpdateRolePermissions,
  onAddAuditLog,
}: RolePermissionsViewProps) {
  const [selectedRole, setSelectedRole] = useState(rolePermissions[0]?.roleName || 'Manager');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const currentRoleObj =
    rolePermissions.find((r) => r.roleName === selectedRole) || rolePermissions[0];

  const isAdminRole = String(currentRoleObj?.roleName || '').trim().toLowerCase() === 'admin';

  const currentModulePerms = useMemo(
    () => (currentRoleObj ? deriveModulePermissionsFromRole(currentRoleObj) : {}),
    [currentRoleObj]
  );

  const staffCountByRole = useMemo(() => {
    const map = new Map<string, Staff[]>();
    staff.forEach((s) => {
      const k = String(s.role || s.department || '').trim().toLowerCase();
      if (!k) return;
      const arr = map.get(k) || [];
      arr.push(s);
      map.set(k, arr);
    });
    return map;
  }, [staff]);

  const commitUpdatedRole = (nextRole: RolePermission, auditDetail: string) => {
    const mp = deriveModulePermissionsFromRole(nextRole);
    const syncedAllowedModules = deriveAllowedSidebarTabsFromRolePerm({ ...nextRole, modulePermissions: mp });
    const syncedRole: RolePermission = {
      ...nextRole,
      modulePermissions: mp,
      allowedModules: syncedAllowedModules,
      canManageBookings: Boolean(mp.frontDesk?.view || mp.frontDesk?.create || mp.calendar?.view),
      canManageRooms: Boolean(mp.rooms?.view || mp.rooms?.edit || mp.housekeeping?.view),
      canManageStaff: Boolean(mp.staff?.manage || mp.staff?.create || mp.roles?.manage || mp.leaves?.approve),
      canManageExpenses: Boolean(mp.finance?.create || mp.finance?.edit || mp.finance?.approve),
      canManageHandovers: Boolean(mp.finance?.view || mp.frontDesk?.view),
      canViewReports: Boolean(mp.reports?.view || mp.auditLogs?.view),
      canManageOta: Boolean(mp.otaManager?.view || mp.otaManager?.manage),
      canManagePolicies: Boolean(mp.profile?.edit || mp.profile?.manage),
    };
    const updated = rolePermissions.map((r) =>
      r.roleName === nextRole.roleName ? syncedRole : r
    );
    onUpdateRolePermissions(updated);
    onAddAuditLog?.('Staff Role Permissions Updated', auditDetail);
  };

  const handleToggleAction = (modId: string, action: keyof GranularModuleAccess) => {
    if (!currentRoleObj) return;
    if (isAdminRole) {
      showToast('Admin is a protected system role and retains full access across all modules.', 'info');
      return;
    }
    const prevMod = currentModulePerms[modId] || {};
    const nextVal = !prevMod[action];
    const nextMod: GranularModuleAccess = { ...prevMod, [action]: nextVal };
    // Enabling any write/manage/approve action automatically grants view
    if (nextVal && action !== 'view') {
      nextMod.view = true;
    }
    // Disabling view disables all dependent actions on that module
    if (!nextVal && action === 'view') {
      ALL_ACTIONS.forEach((a) => {
        nextMod[a.key] = false;
      });
    }
    const nextMap = { ...currentModulePerms, [modId]: nextMod };
    commitUpdatedRole(
      { ...currentRoleObj, modulePermissions: nextMap },
      `Role "${currentRoleObj.roleName}": set ${modId}.${action} = ${nextVal ? 'ON' : 'OFF'}.`
    );
  };

  const handleToggleFullModule = (mod: HrmRbacModuleDef) => {
    if (!currentRoleObj) return;
    if (isAdminRole) {
      showToast('Admin retains full module access.', 'info');
      return;
    }
    const prevMod = currentModulePerms[mod.id] || {};
    const anyOn = mod.actions.some((a) => Boolean(prevMod[a]));
    const nextMod: GranularModuleAccess = {};
    mod.actions.forEach((a) => {
      nextMod[a] = !anyOn;
    });
    const nextMap = { ...currentModulePerms, [mod.id]: nextMod };
    commitUpdatedRole(
      { ...currentRoleObj, modulePermissions: nextMap },
      `Role "${currentRoleObj.roleName}": toggled entire module "${mod.label}" ${!anyOn ? 'ON' : 'OFF'}.`
    );
  };

  const handleAddCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRoleName.trim();
    if (!clean) {
      showToast('Please enter a role name (e.g., Front Desk Executive, POS Cashier, Housekeeping Supervisor).', 'warning');
      return;
    }
    if (rolePermissions.some((r) => r.roleName.toLowerCase() === clean.toLowerCase())) {
      showToast(`Role "${clean}" already exists.`, 'warning');
      return;
    }
    const defaultMp: Record<string, GranularModuleAccess> = {
      dashboard: { view: true },
      frontDesk: { view: true, create: true, edit: false, delete: false, manage: false },
      leaves: { view: true, create: true, approve: false },
    };
    const newRole: RolePermission = {
      id: `perm-${Date.now()}`,
      hotelId: currentRoleObj?.hotelId || '',
      roleName: clean,
      description: newRoleDesc.trim() || `Custom staff role for ${clean}`,
      isCustom: true,
      canManageBookings: true,
      canManageRooms: false,
      canManageStaff: false,
      canManageExpenses: false,
      canManageHandovers: false,
      canViewReports: false,
      canManageOta: false,
      canManagePolicies: false,
      modulePermissions: defaultMp,
      allowedModules: ['dashboard', 'frontDesk', 'staff'],
    };
    onUpdateRolePermissions([...rolePermissions, newRole]);
    onAddAuditLog?.('Staff Role Created', `Created new HRM staff role "${clean}".`);
    setSelectedRole(clean);
    setNewRoleName('');
    setNewRoleDesc('');
    showToast(`Staff role "${clean}" created! Configure its module permissions below.`, 'success');
  };

  const handleDeleteRole = (rp: RolePermission) => {
    const rLower = String(rp.roleName || '').trim().toLowerCase();
    if (rLower === 'admin' || rp.isSystemRole) {
      showToast('Protected System Role: The Admin role cannot be deleted.', 'error');
      return;
    }
    const assignedStaff = staffCountByRole.get(rLower) || [];
    if (assignedStaff.length > 0) {
      showToast(
        `Cannot delete role "${rp.roleName}": currently assigned to ${assignedStaff.length} staff member(s) (${assignedStaff.map((s) => s.name).join(', ')}). Reassign them first.`,
        'error',
        6000
      );
      return;
    }
    if (!confirm(`Delete staff role "${rp.roleName}" permanently?`)) return;
    const updated = rolePermissions.filter((r) => r.roleName !== rp.roleName);
    onUpdateRolePermissions(updated);
    onAddAuditLog?.('Staff Role Deleted', `Deleted unused HRM staff role "${rp.roleName}".`);
    setSelectedRole(updated[0]?.roleName || 'Manager');
    showToast(`Role "${rp.roleName}" deleted safely.`, 'info');
  };

  const assignedToCurrent = currentRoleObj
    ? staffCountByRole.get(String(currentRoleObj.roleName || '').trim().toLowerCase()) || []
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Create Role Form */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> HRM Staff Roles &amp; Module-Level RBAC
            </div>
            <h2 className="text-xl font-serif font-bold text-luxury-brown-950">
              Staff Roles &amp; Granular Permission Matrix
            </h2>
            <p className="text-xs text-luxury-brown-500 mt-0.5">
              Create custom hotel roles, configure View / Create / Edit / Delete / Approve / Manage permissions per module, and enforce access on both sidebar navigation and backend APIs.
            </p>
          </div>

          <form onSubmit={handleAddCustomRole} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="New role name (e.g. Night Auditor)"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="px-3.5 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-900 focus:outline-none focus:border-luxury-gold-500"
            />
            <input
              type="text"
              placeholder="Short description (optional)"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              className="px-3.5 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-900 focus:outline-none focus:border-luxury-gold-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Create Staff Role
            </button>
          </form>
        </div>
      </div>

      {/* Role Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {rolePermissions.map((rp) => {
          const isActive = rp.roleName === currentRoleObj?.roleName;
          const cnt = (staffCountByRole.get(String(rp.roleName || '').trim().toLowerCase()) || []).length;
          return (
            <button
              key={rp.id || rp.roleName}
              type="button"
              onClick={() => setSelectedRole(rp.roleName)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                  : 'bg-white border border-luxury-brown-200 text-luxury-brown-700 hover:bg-luxury-beige-50'
              }`}
            >
              <span>{rp.roleName}</span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/15 text-luxury-gold-300' : 'bg-luxury-beige-100 text-luxury-brown-600'
                }`}
              >
                {cnt} staff
              </span>
            </button>
          );
        })}
      </div>

      {/* Granular Permissions Matrix Table */}
      {currentRoleObj && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-luxury-brown-50">
            <div>
              <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                <span>Role:</span>
                <span className="text-luxury-gold-700 uppercase">{currentRoleObj.roleName}</span>
                {isAdminRole && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-mono">
                    <Lock className="w-3 h-3" /> Protected System Role
                  </span>
                )}
              </h3>
              <p className="text-xs text-luxury-brown-500 mt-0.5">
                {currentRoleObj.description || 'Toggle module-level and action-level access below. Changes persist immediately to MongoDB.'}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-luxury-brown-600 mt-1">
                <Users className="w-3.5 h-3.5 text-luxury-gold-600" />
                <span>
                  Assigned Staff ({assignedToCurrent.length}):{' '}
                  {assignedToCurrent.length > 0
                    ? assignedToCurrent.map((s) => s.name).join(', ')
                    : 'No staff assigned yet'}
                </span>
              </div>
            </div>

            {!isAdminRole && (
              <button
                type="button"
                onClick={() => handleDeleteRole(currentRoleObj)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono text-[11px] font-bold rounded-xl border border-rose-200 flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Role
              </button>
            )}
          </div>

          {assignedToCurrent.length > 0 && !isAdminRole && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                This role is assigned to <strong>{assignedToCurrent.length}</strong> staff member(s). Reassign them in Staff Directory before deleting this role.
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-200 bg-luxury-beige-50/80 text-[10px] font-mono uppercase text-luxury-brown-600">
                  <th className="py-2.5 px-3">Module</th>
                  {ALL_ACTIONS.map((a) => (
                    <th key={a.key} className="py-2.5 px-2 text-center">
                      {a.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right">Quick Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {HRM_RBAC_MODULES.map((mod) => {
                  const access = currentModulePerms[mod.id] || {};
                  const anyEnabled = mod.actions.some((a) => Boolean(access[a]));
                  return (
                    <tr key={mod.id} className={anyEnabled ? 'bg-emerald-50/20' : 'hover:bg-luxury-beige-50/30'}>
                      <td className="py-3 px-3">
                        <div className="font-bold text-luxury-brown-950">{mod.label}</div>
                        <div className="text-[10px] text-luxury-brown-500">{mod.desc}</div>
                      </td>
                      {ALL_ACTIONS.map((a) => {
                        const supported = mod.actions.includes(a.key);
                        const checked = isAdminRole ? supported : Boolean(access[a.key]);
                        return (
                          <td key={a.key} className="py-3 px-2 text-center">
                            {supported ? (
                              <button
                                type="button"
                                disabled={isAdminRole}
                                onClick={() => handleToggleAction(mod.id, a.key)}
                                className={`w-6 h-6 rounded-lg border inline-flex items-center justify-center transition-all ${
                                  checked
                                    ? 'bg-emerald-600 border-emerald-700 text-white'
                                    : 'bg-white border-luxury-brown-200 text-transparent hover:border-luxury-gold-500'
                                } ${isAdminRole ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={`${mod.label} — ${a.label}`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-300 font-mono text-[10px]">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          disabled={isAdminRole}
                          onClick={() => handleToggleFullModule(mod)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                            anyEnabled
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          } ${isAdminRole ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {anyEnabled ? 'All On' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
