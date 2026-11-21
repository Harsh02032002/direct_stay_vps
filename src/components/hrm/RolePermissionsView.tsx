import React, { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Lock,
  Layers,
  Check,
  RotateCcw
} from 'lucide-react';
import { RolePermission } from '../../types';
import { showToast } from '../../utils/toast';

interface RolePermissionsViewProps {
  rolePermissions: RolePermission[];
  onUpdateRolePermissions: (updated: RolePermission[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export const PERMISSION_MODULES: Array<{ key: keyof RolePermission; label: string; desc: string }> = [
  { key: 'canManageBookings', label: 'Front Office & Check-In', desc: 'Create, modify and check-in guests' },
  { key: 'canManageRooms', label: 'Room Inventory & Housekeeping', desc: 'Change room status, mark clean/dirty' },
  { key: 'canManageStaff', label: 'Staff & Personnel Directory', desc: 'Add staff and assign duties' },
  { key: 'canManageExpenses', label: 'Financials & Expense Entry', desc: 'Record bills, payments, vouchers' },
  { key: 'canManageHandovers', label: 'Cash Shift Handover', desc: 'Shift cash close & safe drop logs' },
  { key: 'canViewReports', label: 'Reports & Revenue Analytics', desc: 'Daily sales, ADR, occupancy graphs' },
  { key: 'canManageOta', label: 'OTA & Channel Manager', desc: 'Manage MakeMyTrip, Agoda, Booking.com' },
  { key: 'canManagePolicies', label: 'Master Hotel Configuration', desc: 'Edit GSTIN, logo, policies & taxes' },
];

export default function RolePermissionsView({
  rolePermissions = [],
  onUpdateRolePermissions,
  onAddAuditLog,
}: RolePermissionsViewProps) {
  const [selectedRole, setSelectedRole] = useState(rolePermissions[0]?.roleName || 'Receptionist');
  const [newRoleName, setNewRoleName] = useState('');

  const currentRoleObj = rolePermissions.find((r) => r.roleName === selectedRole) || rolePermissions[0];

  const handleTogglePermission = (permKey: keyof RolePermission) => {
    if (!currentRoleObj) return;
    const nextVal = !currentRoleObj[permKey];
    const updated = rolePermissions.map((r) =>
      r.roleName === selectedRole ? { ...r, [permKey]: nextVal } : r
    );
    onUpdateRolePermissions(updated);
    const log = `RBAC Permission "${String(permKey)}" changed to ${nextVal ? 'Granted' : 'Revoked'} for ${selectedRole}.`;
    onAddAuditLog?.('Role Permissions Updated', log);
    showToast(`Updated "${String(permKey)}" for ${selectedRole}`, 'info', 2500);
  };

  const handleAddCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRoleName.trim();
    if (!clean) return;
    if (rolePermissions.some((r) => r.roleName.toLowerCase() === clean.toLowerCase())) {
      showToast('A role with this name already exists.', 'warning');
      return;
    }
    const newRole: RolePermission = {
      id: `perm-${Date.now()}`,
      hotelId: '',
      roleName: clean,
      isCustom: true,
      canManageBookings: true,
      canManageRooms: true,
      canManageStaff: false,
      canManageExpenses: false,
      canManageHandovers: true,
      canViewReports: false,
      canManageOta: false,
      canManagePolicies: false,
    };
    const updated = [...rolePermissions, newRole];
    onUpdateRolePermissions(updated);
    setSelectedRole(clean);
    setNewRoleName('');
    showToast(`Custom role "${clean}" created!`, 'success');
  };

  const handleDeleteCustomRole = (name: string) => {
    if (!confirm(`Are you sure you want to delete custom role "${name}"?`)) return;
    const updated = rolePermissions.filter((r) => r.roleName !== name);
    onUpdateRolePermissions(updated);
    setSelectedRole('Receptionist');
    showToast(`Custom role "${name}" deleted.`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> Granular Access Control
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            User Roles &amp; RBAC Module Permissions
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Define system roles (Manager, Receptionist, Cashier, Housekeeping) and grant or restrict access to PMS modules.
          </p>
        </div>

        <form onSubmit={handleAddCustomRole} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New custom role name..."
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="px-3.5 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-900 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Add Role
          </button>
        </form>
      </div>

      {/* Role Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {rolePermissions.map((rp) => {
          const isActive = rp.roleName === selectedRole;
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
              {rp.isCustom && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-luxury-gold-500/20 text-luxury-gold-400">
                  Custom
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Permissions Matrix for Selected Role */}
      {currentRoleObj && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-luxury-brown-50">
            <div>
              <h3 className="text-sm font-serif font-bold text-luxury-brown-950">
                Configuring Access for: <span className="text-luxury-gold-700 uppercase">{currentRoleObj.roleName}</span>
              </h3>
              <p className="text-xs text-luxury-brown-500 mt-0.5">
                Toggle permission flags below to grant or revoke features for this role.
              </p>
            </div>

            {currentRoleObj.isCustom && (
              <button
                type="button"
                onClick={() => handleDeleteCustomRole(currentRoleObj.roleName)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono text-[11px] font-bold rounded-xl border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Role
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERMISSION_MODULES.map((mod) => {
              const isEnabled = Boolean(currentRoleObj[mod.key]);
              return (
                <div
                  key={String(mod.key)}
                  onClick={() => handleTogglePermission(mod.key)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isEnabled
                      ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-200'
                      : 'bg-white border-luxury-brown-100 hover:border-luxury-brown-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-luxury-brown-950 block">{mod.label}</span>
                    <span className="text-[11px] text-luxury-brown-500 block leading-tight">{mod.desc}</span>
                  </div>

                  <div
                    className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 ${
                      isEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
