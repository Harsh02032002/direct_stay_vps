import React, { useState, useEffect } from 'react';
import { Staff, Department, StaffStatus, RolePermission, CheckInRecord, Booking, Room, Invoice } from '../types';
import { sha256 } from '../utils/crypto';
import { showToast } from '../utils/toast';
import { 
  Users, UserPlus, Boxes, PackageCheck, AlertTriangle, ShieldCheck, 
  Trash2, Plus, Edit2, RotateCcw, ThumbsUp, Activity, Smartphone, MapPin,
  Lock, Settings, ShieldAlert, Key, UserCheck, Trash, Eye, EyeOff, Share2, Copy, CheckCircle2, Sparkles, X,
  CalendarDays, Clock, Check, Palmtree, Briefcase
} from 'lucide-react';
import StaffAttendanceView from './hrm/StaffAttendanceView';
import StaffRosterView from './hrm/StaffRosterView';
import StaffLeavesView from './hrm/StaffLeavesView';
import AllUsersView from './hrm/AllUsersView';
import RolePermissionsView from './hrm/RolePermissionsView';

interface StaffManagementViewProps {
  staff: Staff[];
  currentRole: string;
  rolePermissions: RolePermission[];
  hotelName?: string;
  activeSubTab?: string;
  onSelectSubTab?: (subTab: string) => void;
  onUpdateStaff: (updated: Staff[]) => void;
  onUpdateRolePermissions: (updated: RolePermission[]) => void;
  onUpdateAuditLogs?: (action: string, details: string) => void;
  checkins?: CheckInRecord[];
  bookings?: Booking[];
  rooms?: Room[];
  invoices?: Invoice[];
}

interface InventoryItem {
  id: string;
  name: string;
  category: 'supplies' | 'amenities' | 'kitchen' | 'water';
  stock: number;
  minThreshold: number;
  unit: string;
}

const DEFAULT_ROLES_TEMPLATES = [
  { roleName: 'Manager', canManageBookings: true, canManageRooms: true, canManageStaff: true, canManageExpenses: true, canManageHandovers: true, canViewReports: true, canManageOta: true, canManagePolicies: true },
  { roleName: 'Receptionist', canManageBookings: true, canManageRooms: true, canManageStaff: false, canManageExpenses: false, canManageHandovers: true, canViewReports: false, canManageOta: false, canManagePolicies: false },
  { roleName: 'Cashier', canManageBookings: true, canManageRooms: false, canManageStaff: false, canManageExpenses: false, canManageHandovers: true, canViewReports: false, canManageOta: false, canManagePolicies: false },
  { roleName: 'Accountant', canManageBookings: false, canManageRooms: false, canManageStaff: false, canManageExpenses: true, canManageHandovers: true, canViewReports: true, canManageOta: false, canManagePolicies: false },
  { roleName: 'Housekeeping', canManageBookings: false, canManageRooms: true, canManageStaff: false, canManageExpenses: false, canManageHandovers: false, canViewReports: false, canManageOta: false, canManagePolicies: false },
  { roleName: 'Kitchen', canManageBookings: false, canManageRooms: false, canManageStaff: false, canManageExpenses: false, canManageHandovers: false, canViewReports: false, canManageOta: false, canManagePolicies: false },
  { roleName: 'Security', canManageBookings: false, canManageRooms: false, canManageStaff: false, canManageExpenses: false, canManageHandovers: false, canViewReports: false, canManageOta: false, canManagePolicies: false },
  { roleName: 'Maintenance', canManageBookings: false, canManageRooms: true, canManageStaff: false, canManageExpenses: false, canManageHandovers: false, canViewReports: false, canManageOta: false, canManagePolicies: false }
];

export const PMS_MODULES_CATALOG: Array<{ id: string; label: string; desc: string }> = [
  { id: 'dashboard', label: 'PMS Overview', desc: 'Main dashboard & live stats' },
  { id: 'frontDesk', label: 'Front Desk', desc: 'Check-in, Check-out, Walk-in, Reservations & Reports' },
  { id: 'invoice', label: 'Invoice System', desc: 'Guest billing & GST invoices' },
  { id: 'rooms', label: 'Room Management', desc: 'Room inventory, status & categories' },
  { id: 'housekeeping', label: 'Housekeeping & Laundry', desc: 'Cleaning status, laundry & water logs' },
  { id: 'pos', label: 'POS Terminal & Food', desc: 'Restaurant, room service & food billing' },
  { id: 'inventory', label: 'Inventory Store', desc: 'Stock, suppliers & purchases' },
  { id: 'finance', label: 'Finance Hub', desc: 'Payment gateway tracking & settlements' },
  { id: 'staff', label: 'Staff Workspace', desc: 'Staff directory & permissions' },
  { id: 'auditLogs', label: 'Owner Audit Logs', desc: 'Security & activity logs' },
];

export function getDefaultModulesForRole(roleName: string): string[] {
  const r = (roleName || '').toLowerCase();
  if (r.includes('manager') || r.includes('admin')) {
    return PMS_MODULES_CATALOG.map((m) => m.id);
  }
  if (r.includes('account') || r.includes('cashier')) {
    return ['dashboard', 'frontDesk', 'invoice', 'pos', 'inventory', 'finance'];
  }
  if (r.includes('housekeeping') || r.includes('maintenance')) {
    return ['rooms', 'housekeeping', 'inventory'];
  }
  if (r.includes('kitchen')) {
    return ['pos', 'inventory'];
  }
  if (r.includes('security')) {
    return ['frontDesk', 'rooms'];
  }
  // Default Receptionist
  return ['dashboard', 'frontDesk', 'invoice', 'rooms', 'housekeeping', 'pos'];
}

export default function StaffManagementView({
  staff,
  currentRole,
  rolePermissions,
  hotelName = 'Grand Pavilion Hotel',
  activeSubTab = 'directory',
  onSelectSubTab,
  onUpdateStaff,
  onUpdateRolePermissions,
  onUpdateAuditLogs,
  checkins = [],
  bookings = [],
  rooms = [],
  invoices = []
}: StaffManagementViewProps) {
  const [internalSubTab, setInternalSubTab] = useState<string>(() => {
    if (activeSubTab) return activeSubTab;
    return 'directory';
  });
  const [salaryFilter, setSalaryFilter] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [salaryMonth, setSalaryMonth] = useState(() => new Date().toISOString().substring(0, 7));

  useEffect(() => {
    if (activeSubTab) {
      setInternalSubTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleSubTabChange = (t: string) => {
    setInternalSubTab(t);
    if (onSelectSubTab) {
      onSelectSubTab(t);
    }
  };
  
  // New Staff Local Form States
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [department, setDepartment] = useState<Department>('Reception');
  const [designation, setDesignation] = useState('');
  const [salaryInput, setSalaryInput] = useState<number>(15000);
  const [selectedRole, setSelectedRole] = useState('Receptionist');
  const [allowedModules, setAllowedModules] = useState<string[]>(() => getDefaultModulesForRole('Receptionist'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(true);
  const [revealedCardPasswords, setRevealedCardPasswords] = useState<Record<string, boolean>>({});
  const [credentialModalStaff, setCredentialModalStaff] = useState<Staff | null>(null);

  // Edit Local Selected State
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Role Permission configuration states
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedConfigRoleName, setSelectedConfigRoleName] = useState('Receptionist');

  // Auto-initialize role permissions if empty for tenant
  useEffect(() => {
    if (rolePermissions.length === 0) {
      const initialPerms: RolePermission[] = DEFAULT_ROLES_TEMPLATES.map((tpl, index) => ({
        id: `perm-${Date.now()}-${index}`,
        hotelId: '', // mapped on parent save
        roleName: tpl.roleName,
        isCustom: false,
        canManageBookings: tpl.canManageBookings,
        canManageRooms: tpl.canManageRooms,
        canManageStaff: tpl.canManageStaff,
        canManageExpenses: tpl.canManageExpenses,
        canManageHandovers: tpl.canManageHandovers,
        canViewReports: tpl.canViewReports,
        canManageOta: tpl.canManageOta,
        canManagePolicies: tpl.canManagePolicies
      }));
      onUpdateRolePermissions(initialPerms);
    }
  }, [rolePermissions, onUpdateRolePermissions]);

  // Local Inventory State (starts empty)
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [replenishId, setReplenishId] = useState('');
  const [replenishQty, setReplenishQty] = useState(20);
  const [successMsg, setSuccessMsg] = useState('');

  const handleOpenEditStaff = (member: Staff) => {
    setEditingStaffId(member.id);
    setName(member.name);
    setMobile(member.mobile);
    setAddress(member.address || '');
    setDepartment(member.department);
    setDesignation(member.designation);
    setSalaryInput(Number(member.salary ?? 15000) || 0);
    const roleVal = member.role || 'Receptionist';
    setSelectedRole(roleVal);
    setAllowedModules(
      Array.isArray(member.allowedModules) && member.allowedModules.length > 0
        ? member.allowedModules
        : getDefaultModulesForRole(roleVal)
    );
    setUsername(member.username || '');
    setPassword(member.plainPassword || '');
    setShowFormPassword(true);
    setIsAddingStaff(true);
  };

  const handleAutoGenerateCredentials = () => {
    const cleanName = (name.trim() || 'staff').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'staff';
    const roleSlug = (selectedRole || 'desk').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const randDigits = Math.floor(100 + Math.random() * 900);
    const genUser = `${cleanName}_${roleSlug}${randDigits.toString().slice(0, 2)}`;
    const capName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1, 5);
    const genPass = `${capName}@${randDigits}`;
    setUsername(genUser);
    setPassword(genPass);
    setShowFormPassword(true);
    showToast(`Generated ID: ${genUser} | Pass: ${genPass}`, 'info');
  };

  const buildStaffWhatsAppMessage = (member: Staff) => {
    const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : 'http://localhost:3000/admin';
    const mods = (member.allowedModules && member.allowedModules.length > 0
      ? member.allowedModules
      : getDefaultModulesForRole(member.role || 'Receptionist')
    )
      .map(id => PMS_MODULES_CATALOG.find(m => m.id === id)?.label || id)
      .join(', ');
    const displayPass = member.plainPassword || 'password123 (or contact Admin to reset)';

    return [
      `🏨 *${hotelName} — Staff PMS Login Credentials*`,
      ``,
      `Namaste *${member.name}* (${member.designation} • ${member.role || member.department}),`,
      `Your Hotel PMS Staff Account is active. Below are your login details:`,
      ``,
      `🌐 *Login Link:* ${loginUrl}`,
      `👤 *Login ID (Username):* ${member.username}`,
      `🔑 *Password:* ${displayPass}`,
      `🛡️ *Role / Dept:* ${member.role || 'Staff'} (${member.department})`,
      `📂 *Assigned Modules:* ${mods}`,
      ``,
      `Please sign in at the link above using your Login ID & Password.`
    ].join('\n');
  };

  const handleSendWhatsAppCredentials = (member: Staff) => {
    const digits = String(member.mobile || '').replace(/\D/g, '');
    if (digits.length < 10) {
      showToast('Valid 10-digit staff mobile number is required to send on WhatsApp.', 'warning');
      return;
    }
    const phoneWithCountry = digits.length === 10 ? `91${digits}` : digits;
    const text = buildStaffWhatsAppMessage(member);
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (onUpdateAuditLogs) {
      onUpdateAuditLogs('Staff Credentials Shared', `Shared login ID (${member.username}) & module access with ${member.name} via WhatsApp (${member.mobile}).`);
    }
    showToast(`Opening WhatsApp to send Login ID & Password to ${member.name}...`, 'success');
  };

  const handleCopyCredentials = (member: Staff) => {
    const text = buildStaffWhatsAppMessage(member).replace(/\*/g, '');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast(`Copied Login ID & Password for ${member.name} to clipboard!`, 'success');
  };

  // 1. ADD OR UPDATE STAFF SUBMIT
  const saveStaffRecord = (sendOnWhatsAppAfterSave: boolean) => {
    if (!name.trim() || !mobile.trim() || !designation.trim() || !username.trim()) {
      showToast('Kindly fill in all required personnel fields (Name, Mobile, Designation, Login ID).', 'warning');
      return;
    }
    if (allowedModules.length === 0) {
      showToast('Please select at least one module to grant access.', 'warning');
      return;
    }

    let savedMember: Staff | null = null;

    if (editingStaffId) {
      const updated = staff.map(s => {
        if (s.id === editingStaffId) {
          const nextPlain = password.trim() ? password.trim() : (s.plainPassword || '');
          const updatedStaffObj: Staff = {
            ...s,
            name: name.trim(),
            mobile: mobile.trim(),
            address: address.trim(),
            department,
            designation: designation.trim(),
            salary: Math.max(0, Number(salaryInput) || 0),
            role: selectedRole,
            allowedModules,
            username: username.trim(),
            password: password.trim() ? sha256(password.trim()) : s.password,
            plainPassword: nextPlain
          };
          savedMember = updatedStaffObj;
          return updatedStaffObj;
        }
        return s;
      });
      onUpdateStaff(updated);
      if (onUpdateAuditLogs) {
        onUpdateAuditLogs('Staff Updated', `Updated personnel record for ${name.trim()} (${selectedRole}) with ${allowedModules.length} module(s).`);
      }
      triggerSuccess(`Updated personnel profile for ${name.trim()}.`);
    } else {
      const rawPass = password.trim() || 'password123';
      const newStaff: Staff = {
        id: `STF-${Date.now()}`,
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        department,
        designation: designation.trim(),
        salary: Math.max(0, Number(salaryInput) || 0),
        salaryStatus: 'Pending',
        role: selectedRole,
        allowedModules,
        username: username.trim(),
        password: sha256(rawPass),
        plainPassword: rawPass,
        status: 'Active',
        joiningDate: new Date().toISOString().substring(0, 10),
        checkInsCount: 0,
        checkOutsCount: 0,
        roomsCleanedCount: 0,
        bookingsCreatedCount: 0,
        revenueGeneratedSum: 0
      };
      savedMember = newStaff;

      const updated = [newStaff, ...staff];
      onUpdateStaff(updated);
      
      // Log audit tracking
      if (onUpdateAuditLogs) {
        onUpdateAuditLogs('Staff Addition', `Added staff member ${name.trim()} as ${selectedRole} with access to ${allowedModules.length} module(s).`);
      }
      triggerSuccess(`Registered staff member ${name.trim()} into PMS.`);
    }

    if (savedMember) {
      setCredentialModalStaff(savedMember);
      if (sendOnWhatsAppAfterSave) {
        handleSendWhatsAppCredentials(savedMember);
      }
    }

    // Reset local state
    setEditingStaffId(null);
    setName('');
    setMobile('');
    setAddress('');
    setDepartment('Reception');
    setDesignation('');
    setSelectedRole('Receptionist');
    setAllowedModules(getDefaultModulesForRole('Receptionist'));
    setUsername('');
    setPassword('');
    setIsAddingStaff(false);
  };

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStaffRecord(false);
  };

  // Role Permissions Modifiers
  const handleCreateCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    
    // Check duplicate
    const exists = rolePermissions.some(rp => rp.roleName.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast('A role with this name already exists.', 'warning');
      return;
    }
    
    const newRole: RolePermission = {
      id: `perm-${Date.now()}`,
      hotelId: '',
      roleName: trimmed,
      isCustom: true,
      canManageBookings: false,
      canManageRooms: false,
      canManageStaff: false,
      canManageExpenses: false,
      canManageHandovers: false,
      canViewReports: false,
      canManageOta: false,
      canManagePolicies: false
    };
    
    const updated = [...rolePermissions, newRole];
    onUpdateRolePermissions(updated);
    if (onUpdateAuditLogs) {
      onUpdateAuditLogs('Custom Role Created', `Created custom access role "${newRole.roleName}".`);
    }
    setSelectedConfigRoleName(newRole.roleName);
    setNewRoleName('');
    triggerSuccess(`Custom role "${newRole.roleName}" added successfully.`);
  };

  const handleTogglePermission = (roleName: string, permissionKey: keyof RolePermission) => {
    let nextState = false;
    const updated = rolePermissions.map(rp => {
      if (rp.roleName === roleName) {
        nextState = !rp[permissionKey];
        return {
          ...rp,
          [permissionKey]: nextState
        };
      }
      return rp;
    });
    onUpdateRolePermissions(updated);
    if (onUpdateAuditLogs) {
      onUpdateAuditLogs(
        'Role Permissions Updated',
        `Updated permission "${String(permissionKey)}" to ${nextState ? 'Enabled' : 'Disabled'} for role "${roleName}".`
      );
    }
    triggerSuccess(`Updated permission for role: ${roleName}`);
  };

  const handleDeleteCustomRole = (roleName: string) => {
    if (!window.confirm(`Are you sure you want to delete the custom role "${roleName}"?`)) return;
    const updated = rolePermissions.filter(rp => rp.roleName !== roleName);
    onUpdateRolePermissions(updated);
    if (onUpdateAuditLogs) {
      onUpdateAuditLogs('Custom Role Deleted', `Deleted custom access role "${roleName}".`);
    }
    setSelectedConfigRoleName('Receptionist');
    triggerSuccess(`Custom role "${roleName}" deleted.`);
  };

  // 2. TOGGLE STATUS ACTIVE / INACTIVE
  const handleToggleStatus = (id: string) => {
    const matched = staff.find(s => s.id === id);
    if (!matched) return;
    const newStatus: StaffStatus = matched.status === 'Active' ? 'Inactive' : 'Active';
    
    const updated = staff.map(s => {
      if (s.id === id) {
        return { ...s, status: newStatus };
      }
      return s;
    });
    
    onUpdateStaff(updated);
    if (onUpdateAuditLogs) {
      onUpdateAuditLogs('Staff Status Toggle', `Updated staff ${matched.name} duty status to ${newStatus}.`);
    }
    triggerSuccess(`Personnel ${matched.name} is now flagged as ${newStatus}.`);
  };

  const triggerSuccess = (msg: string) => {
    showToast(msg, 'success');
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // 3. REPLENISH INVENTORY METHOD
  const handleAddInventoryStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishId) {
      showToast('Locate target supplies category.', 'warning');
      return;
    }
    const updated = inventory.map(item => {
      if (item.id === replenishId) {
        return { ...item, stock: item.stock + Number(replenishQty) };
      }
      return item;
    });
    setInventory(updated);
    const item = inventory.find(i => i.id === replenishId);
    triggerSuccess(`Added ${replenishQty} ${item?.unit} to ${item?.name} physical inventory.`);
    setReplenishId('');
  };

  // Filter staff by department if Admin clicks
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const filteredStaff = deptFilter === 'All' ? staff : staff.filter(s => s.department === deptFilter);

  return (
    <div className="space-y-6">
      {/* Dynamic Sub-Module Navigation Header */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4 no-print">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
              {['allUsers', 'roles'].includes(internalSubTab) ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> Administration Central
                </>
              ) : (
                <>
                  <Briefcase className="w-3.5 h-3.5 text-luxury-gold-600" /> Human Resource Management (HRM)
                </>
              )}
            </div>
            <h1 className="text-2xl font-serif text-luxury-brown-950 font-bold tracking-wide flex items-center gap-2">
              {['allUsers', 'roles'].includes(internalSubTab)
                ? 'System Administration & User Governance'
                : 'Hotel Human Resources & Personnel Hub'}
            </h1>
            <p className="text-xs text-luxury-brown-500 mt-0.5">
              {['allUsers', 'roles'].includes(internalSubTab)
                ? 'Centralized access control, employee credentials, RBAC module rights, and guest customer accounts.'
                : 'Employee directory, biometric shift clock-ins, monthly salary payouts, weekly duty rosters, and leave approvals.'}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 bg-luxury-beige-50 border border-luxury-brown-100 px-3.5 py-1.5 rounded-xl text-xs shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-luxury-brown-700 font-bold">{hotelName}</span>
          </div>
        </div>

        {/* Sub-Tabs Pill Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-luxury-brown-50 scrollbar-thin">
          {['allUsers', 'roles'].includes(internalSubTab) ? (
            <>
              <button
                type="button"
                onClick={() => handleSubTabChange('allUsers')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  internalSubTab === 'allUsers'
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-luxury-gold-500" />
                <span>Users Directory (Staff + Guests)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubTabChange('roles')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  internalSubTab === 'roles'
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-500" />
                <span>User Roles &amp; RBAC Matrix</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSubTabChange('directory')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  internalSubTab === 'directory' || internalSubTab === 'staff'
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-luxury-gold-500" />
                <span>Staff Directory &amp; Onboarding</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubTabChange('attendance')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  internalSubTab === 'attendance'
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-luxury-gold-500" />
                <span>Attendance &amp; Daily Logs</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubTabChange('payroll')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  internalSubTab === 'payroll' || internalSubTab === 'salary'
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5 text-luxury-gold-500" />
                <span>Monthly Payroll &amp; Salaries</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubTabChange('roster')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  internalSubTab === 'roster'
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-luxury-gold-500" />
                <span>Shift Roster &amp; Timings</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubTabChange('leaves')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  internalSubTab === 'leaves'
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <Palmtree className="w-3.5 h-3.5 text-luxury-gold-500" />
                <span>Leave Management</span>
              </button>
            </>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-lg font-mono font-bold text-center">
          🛎️ PMS Alert: {successMsg}
        </div>
      )}

      {/* --- HRM SUB-VIEWS --- */}
      {internalSubTab === 'attendance' && (
        <StaffAttendanceView
          staff={staff}
          hotelName={hotelName}
          onAddAuditLog={onUpdateAuditLogs}
        />
      )}

      {internalSubTab === 'roster' && (
        <StaffRosterView
          staff={staff}
          hotelName={hotelName}
          onAddAuditLog={onUpdateAuditLogs}
        />
      )}

      {internalSubTab === 'leaves' && (
        <StaffLeavesView
          staff={staff}
          hotelName={hotelName}
          onAddAuditLog={onUpdateAuditLogs}
        />
      )}

      {/* --- ADMINISTRATION SUB-VIEWS --- */}
      {internalSubTab === 'allUsers' && (
        <AllUsersView
          staff={staff}
          checkins={checkins}
          bookings={bookings}
          hotelName={hotelName}
          onOpenAddStaff={() => {
            setIsAddingStaff(true);
            setEditingStaffId(null);
          }}
          onOpenEditStaff={handleOpenEditStaff}
          onSendWhatsAppCredentials={handleSendWhatsAppCredentials}
          onAddAuditLog={onUpdateAuditLogs}
        />
      )}

      {internalSubTab === 'roles' && (
        <RolePermissionsView
          rolePermissions={rolePermissions}
          onUpdateRolePermissions={onUpdateRolePermissions}
          onAddAuditLog={onUpdateAuditLogs}
        />
      )}

      {/* --- RENDER TAB 1: PERSONNEL SETUP --- */}
      {(internalSubTab === 'directory' || internalSubTab === 'staff') && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white border rounded-xl p-4 shadow-3xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-luxury-brown-500 uppercase">Filter Department:</span>
              <select 
                value={deptFilter} 
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3.5 py-1 border rounded-lg bg-luxury-beige-50/50 text-xs text-luxury-brown-900 focus:outline-none"
              >
                <option value="All">All Departments</option>
                <option value="Admin">Admin</option>
                <option value="Reception">Reception</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Accounts">Accounts</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
            
            <button
              onClick={() => {
                if (isAddingStaff) {
                  setIsAddingStaff(false);
                  setEditingStaffId(null);
                } else {
                  setEditingStaffId(null);
                  setName('');
                  setMobile('');
                  setAddress('');
                  setDepartment('Reception');
                  setDesignation('');
                  setSelectedRole('Receptionist');
                  setAllowedModules(getDefaultModulesForRole('Receptionist'));
                  setUsername('');
                  setPassword('');
                  setIsAddingStaff(true);
                }
              }}
              className="px-3.5 py-1.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-lg shadow-sm flex items-center gap-1"
            >
              <UserPlus className="w-4 h-4" /> {isAddingStaff ? 'Close Form' : 'Register New Staff'}
            </button>
          </div>

          {/* Add / Edit Staff Modal block */}
          {isAddingStaff && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto no-print">
              <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-fade-in">
                <div className="bg-luxury-brown-950 text-white p-5 flex items-center justify-between">
                  <h2 className="font-serif font-bold text-base text-luxury-gold-400 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    {editingStaffId ? 'Update Staff Portfolio' : 'Register New Staff Portfolio'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingStaff(false);
                      setEditingStaffId(null);
                    }}
                    className="text-luxury-brown-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddStaffSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-600 block uppercase">Complete Name *</label>
                  <input
                    type="text" required
                    placeholder="e.g. Ram Kumar"
                    value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-luxury-brown-950 font-sans text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-600 block uppercase">Mobile Number *</label>
                  <input
                    type="text" required
                    placeholder="e.g. 98612XXXXX"
                    value={mobile} onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-luxury-brown-950 font-sans text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-600 block uppercase">Department *</label>
                  <select
                    value={department} onChange={(e) => setDepartment(e.target.value as Department)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-luxury-brown-950 text-sm"
                  >
                    <option value="Reception">Reception Desk</option>
                    <option value="Housekeeping">Housekeeping Operations</option>
                    <option value="Accounts">Accounts & Cashiering</option>
                    <option value="Manager">Management Office</option>
                    <option value="Kitchen">Food & Beverage (Kitchen)</option>
                    <option value="Security">Security Patrol</option>
                    <option value="Maintenance">Engineering & Maintenance</option>
                    <option value="Other">Other Ancillary Services</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-600 block uppercase">System Security Role *</label>
                  <select
                    value={selectedRole} onChange={(e) => {
                      const rName = e.target.value;
                      setSelectedRole(rName);
                      if (!editingStaffId) {
                        setAllowedModules(getDefaultModulesForRole(rName));
                      }
                      // Auto department selection helper based on role templates
                      if (rName === 'Manager') setDepartment('Manager');
                      else if (rName === 'Receptionist' || rName === 'Cashier') setDepartment('Reception');
                      else if (rName === 'Accountant') setDepartment('Accounts');
                      else if (rName === 'Housekeeping') setDepartment('Housekeeping');
                      else if (rName === 'Kitchen') setDepartment('Kitchen');
                      else if (rName === 'Security') setDepartment('Security');
                      else if (rName === 'Maintenance') setDepartment('Maintenance');
                    }}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-luxury-brown-950 text-sm font-semibold text-luxury-gold-700"
                  >
                    {rolePermissions.map(rp => (
                      <option key={rp.id} value={rp.roleName}>{rp.roleName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-600 block uppercase">Designation / Title *</label>
                  <input
                    type="text" required
                    placeholder="e.g. Senior Reception Supervisor"
                    value={designation} onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-luxury-brown-950 font-sans text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-600 block uppercase">Monthly Salary (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    placeholder="15000"
                    value={salaryInput}
                    onChange={(e) => setSalaryInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-luxury-brown-950 font-mono font-bold text-sm"
                  />
                </div>
                <div className="col-span-2 bg-luxury-beige-50/70 border border-luxury-gold-500/30 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-luxury-brown-200/60 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-luxury-gold-600" />
                      <span className="text-xs font-serif font-bold text-luxury-brown-950">
                        Staff Portal Login ID & Password Setup
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoGenerateCredentials}
                      className="px-2.5 py-1 rounded-lg bg-luxury-brown-950 hover:bg-luxury-brown-800 text-luxury-gold-400 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-Generate ID & Pass
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-luxury-brown-700 block uppercase">Staff Login ID (Username) *</label>
                      <input
                        type="text" required
                        placeholder="e.g. ram_reception"
                        value={username} onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-luxury-brown-300 rounded-lg bg-white text-luxury-brown-950 text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-luxury-brown-700 block uppercase">
                        {editingStaffId ? 'Login Password (View / Reset) *' : 'Staff Login Password *'}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showFormPassword ? 'text' : 'password'}
                          required={!editingStaffId}
                          placeholder={editingStaffId ? 'Enter new password to change' : 'e.g. Ram@2026'}
                          value={password} onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-3 pr-9 py-2 border border-luxury-brown-300 rounded-lg bg-white text-luxury-brown-950 text-sm font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPassword(v => !v)}
                          className="absolute right-2.5 text-luxury-brown-500 hover:text-luxury-brown-900 cursor-pointer"
                          title={showFormPassword ? 'Hide Password' : 'Show Password'}
                        >
                          {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* MODULE ACCESS CONTROL CHECKBOXES */}
              <div className="space-y-2.5 pt-2 border-t border-luxury-brown-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-luxury-brown-800 block uppercase font-mono">
                      Allowed PMS Modules (Select Module Access) *
                    </label>
                    <span className="text-[11px] text-luxury-brown-500">
                      Choose which sidebar modules this staff member can access ({allowedModules.length} of {PMS_MODULES_CATALOG.length} selected)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setAllowedModules(PMS_MODULES_CATALOG.map(m => m.id))}
                      className="px-2.5 py-1 rounded-lg bg-luxury-beige-100 hover:bg-luxury-gold-500/20 text-luxury-brown-900 font-bold cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowedModules(getDefaultModulesForRole(selectedRole))}
                      className="px-2.5 py-1 rounded-lg bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-700 font-semibold cursor-pointer"
                    >
                      Role Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllowedModules([])}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PMS_MODULES_CATALOG.map((mod) => {
                    const isChecked = allowedModules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-50/60 border-emerald-300 text-luxury-brown-950'
                            : 'bg-luxury-beige-50/40 border-luxury-brown-200/60 text-luxury-brown-600 hover:bg-luxury-beige-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedModules((prev) =>
                                prev.includes(mod.id) ? prev : [...prev, mod.id]
                              );
                            } else {
                              setAllowedModules((prev) => prev.filter((id) => id !== mod.id));
                            }
                          }}
                          className="mt-0.5 rounded border-luxury-brown-300 text-emerald-600 focus:ring-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight">{mod.label}</div>
                          <div className="text-[10px] text-luxury-brown-500 leading-snug mt-0.5">
                            {mod.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <label className="text-[10px] font-bold text-luxury-brown-600 block uppercase font-mono">Permanent Home Address</label>
                <textarea
                  placeholder="e.g. Plot No 12, Berhampur City"
                  value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-luxury-brown-950 text-sm h-16"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 text-xs pt-2 border-t border-luxury-brown-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAddingStaff(false);
                    setEditingStaffId(null);
                  }} 
                  className="px-4 py-2 border rounded-lg hover:bg-luxury-beige-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-luxury-brown-950 text-white hover:bg-luxury-brown-900 rounded-lg font-bold cursor-pointer"
                >
                  {editingStaffId ? 'Update Staff Record' : 'Save Staff Record'}
                </button>
                <button 
                  type="button"
                  onClick={() => saveStaffRecord(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{editingStaffId ? 'Update & Send ID/Pass on WhatsApp' : 'Save & Send ID/Pass on WhatsApp'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

          {/* Post-Save / Share Staff Credentials Modal */}
          {credentialModalStaff && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
              <div className="bg-white border-2 border-luxury-gold-500 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-fade-in">
                <div className="bg-luxury-brown-950 text-white px-5 py-4 flex items-center justify-between border-b border-luxury-gold-500/30">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold-400 font-bold block">
                      Staff Login Credentials Ready
                    </span>
                    <h3 className="font-serif font-bold text-base text-luxury-beige-50">
                      {credentialModalStaff.name} ({credentialModalStaff.role || credentialModalStaff.department})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCredentialModalStaff(null)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl p-3.5 space-y-2 font-mono">
                    <div className="flex justify-between items-center border-b border-luxury-brown-200/60 pb-1.5">
                      <span className="text-luxury-brown-500 uppercase text-[10px] font-bold">Portal URL:</span>
                      <span className="font-bold text-luxury-brown-950">{typeof window !== 'undefined' ? `${window.location.origin}/admin` : '/admin'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-luxury-brown-200/60 pb-1.5">
                      <span className="text-luxury-brown-500 uppercase text-[10px] font-bold">Login ID (Username):</span>
                      <span className="font-extrabold text-sm text-luxury-brown-950 bg-white px-2 py-0.5 rounded border">{credentialModalStaff.username}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-luxury-brown-200/60 pb-1.5">
                      <span className="text-luxury-brown-500 uppercase text-[10px] font-bold">Password:</span>
                      <span className="font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {credentialModalStaff.plainPassword || 'password123'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-luxury-brown-500 uppercase text-[10px] font-bold">WhatsApp Mobile:</span>
                      <span className="font-bold text-luxury-brown-900">{credentialModalStaff.mobile}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-luxury-brown-500 block mb-1.5">
                      Assigned PMS Modules ({(credentialModalStaff.allowedModules || []).length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(credentialModalStaff.allowedModules && credentialModalStaff.allowedModules.length > 0
                        ? credentialModalStaff.allowedModules
                        : getDefaultModulesForRole(credentialModalStaff.role || 'Receptionist')
                      ).map(modId => {
                        const found = PMS_MODULES_CATALOG.find(m => m.id === modId);
                        return (
                          <span key={modId} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                            {found ? found.label : modId}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(credentialModalStaff)}
                      className="flex-1 py-2.5 px-3 rounded-xl border border-luxury-brown-200 bg-luxury-beige-50 hover:bg-luxury-beige-100 text-luxury-brown-900 font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy ID & Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppCredentials(credentialModalStaff)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" /> 📲 Send on WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Staff Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredStaff.map(member => {
              const isInactive = member.status === 'Inactive';
              return (
                <div 
                  key={member.id} 
                  className={`bg-white border rounded-2xl p-5 shadow-3xs relative overflow-hidden flex flex-col justify-between ${
                    isInactive ? 'opacity-60 border-rose-300' : 'border-luxury-brown-200/50'
                  }`}
                >
                  {/* Status Indicator */}
                  <span className={`absolute top-4 right-4 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                    isInactive ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {member.status}
                  </span>

                  <div>
                    {/* User profile card */}
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="w-12 h-12 rounded-full border-2 border-luxury-gold-400 bg-luxury-beige-100 flex items-center justify-center text-luxury-brown-900 font-serif font-bold text-lg uppercase shrink-0">
                        {member.name.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-serif font-bold text-luxury-brown-950 text-base leading-tight truncate">{member.name}</h2>
                        <span className="text-[10px] uppercase font-mono text-[#C5A059] block tracking-wider font-semibold mt-0.5">{member.designation}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="px-2 py-0.5 bg-luxury-beige-100 text-luxury-brown-700 font-mono text-[9px] rounded font-extrabold">
                            {member.department}
                          </span>
                          <span className="px-2 py-0.5 bg-luxury-gold-500/10 text-luxury-brown-950 font-mono text-[9px] rounded font-extrabold flex items-center gap-0.5">
                            🔑 {member.role || 'Receptionist'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational details */}
                    <div className="space-y-1.5 text-xs pt-3 border-t border-dotted border-luxury-brown-150">
                      <div className="flex items-center gap-1.5 text-luxury-brown-600">
                        <Smartphone className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-mono">{member.mobile}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-luxury-brown-600">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{member.address || 'Berhampur, Odisha'}</span>
                      </div>
                    </div>

                    {/* Staff Login ID & Password Box */}
                    <div className="mt-3 p-2.5 rounded-xl bg-luxury-beige-50/80 border border-luxury-brown-200/70 space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-luxury-brown-500 flex items-center gap-1">
                          <Key className="w-3 h-3 text-luxury-gold-600" /> Staff Login Credentials
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(member)}
                          className="text-[9px] font-bold text-luxury-gold-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                          title="Copy Login ID & Password"
                        >
                          <Copy className="w-2.5 h-2.5" /> Copy
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-luxury-brown-100">
                        <span className="text-[10px] text-luxury-brown-500">ID:</span>
                        <span className="font-bold text-luxury-brown-950">{member.username}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-luxury-brown-100">
                        <span className="text-[10px] text-luxury-brown-500">Pass:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-emerald-700">
                            {revealedCardPasswords[member.id]
                              ? (member.plainPassword || 'password123')
                              : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedCardPasswords(prev => ({
                                ...prev,
                                [member.id]: !prev[member.id]
                              }))
                            }
                            className="text-luxury-brown-400 hover:text-luxury-brown-900 cursor-pointer"
                            title={revealedCardPasswords[member.id] ? 'Hide Password' : 'Show Password'}
                          >
                            {revealedCardPasswords[member.id] ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Allowed Modules Badges */}
                    <div className="mt-3 pt-2.5 border-t border-luxury-brown-100">
                      <span className="text-[9px] font-mono font-bold uppercase text-luxury-brown-400 block mb-1.5">
                        Module Access ({(member.allowedModules && member.allowedModules.length > 0 ? member.allowedModules : getDefaultModulesForRole(member.role || 'Receptionist')).length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(member.allowedModules && member.allowedModules.length > 0
                          ? member.allowedModules
                          : getDefaultModulesForRole(member.role || 'Receptionist')
                        ).map((modId) => {
                          const found = PMS_MODULES_CATALOG.find((m) => m.id === modId);
                          return (
                            <span
                              key={modId}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[9px] font-mono font-bold"
                            >
                              {found ? found.label : modId}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Metrics */}
                    {!isInactive && member.department !== 'Admin' && (
                      <div className="mt-4 p-3 bg-luxury-beige-50/50 rounded-xl border space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-luxury-brown-500 border-b pb-1">
                          <span>DUTY SCORECARD</span>
                          <Activity className="w-3 h-3 text-luxury-gold-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-luxury-brown-700">
                          {member.department === 'Housekeeping' ? (
                            <>
                              <div>Rooms Cleaned: <strong className="text-luxury-brown-950">{member.roomsCleanedCount || 12}</strong></div>
                              <div>Rating: <strong className="text-emerald-700">9.5/10</strong></div>
                            </>
                          ) : (
                            <>
                              <div>Check-ins: <strong className="text-luxury-brown-950">{member.checkInsCount || 0}</strong></div>
                              <div>Bookings: <strong className="text-luxury-brown-950">{member.bookingsCreatedCount || 0}</strong></div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="mt-5 pt-3.5 border-t border-luxury-brown-100 space-y-2 no-print">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppCredentials(member)}
                      className="w-full py-2 px-3 text-[11px] font-mono font-bold rounded-xl uppercase tracking-wider text-center cursor-pointer transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" /> 📲 Send ID & Pass on WhatsApp
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditStaff(member)}
                        className="px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg uppercase tracking-wider text-center cursor-pointer transition-colors border bg-luxury-beige-50 hover:bg-luxury-beige-100 text-luxury-brown-800 border-luxury-brown-200 flex items-center justify-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Edit / Modules
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(member.id)}
                        className={`flex-1 py-1.5 text-[10px] font-mono font-bold rounded-lg uppercase tracking-wider text-center cursor-pointer transition-colors border ${
                          isInactive
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isInactive ? 'Reinstate Active Duty' : 'Cease Duty (Inactive)'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- RENDER TAB 2: MONTHLY SALARY & PAYROLL --- */}
      {(internalSubTab === 'payroll' || internalSubTab === 'salary') && (() => {
        const getSalary = (m: Staff) => Number(m.salary ?? 15000) || 0;
        const getPayStatus = (m: Staff): 'Paid' | 'Pending' => m.salaryStatus === 'Paid' ? 'Paid' : 'Pending';
        const filteredSalaryStaff = staff.filter(m => salaryFilter === 'All' ? true : getPayStatus(m) === salaryFilter);
        const totalMonthlyPayroll = staff.reduce((sum, m) => sum + getSalary(m), 0);
        const totalPaidPayroll = staff.filter(m => getPayStatus(m) === 'Paid').reduce((sum, m) => sum + getSalary(m), 0);
        const totalPendingPayroll = Math.max(0, totalMonthlyPayroll - totalPaidPayroll);

        const handleUpdateMemberSalary = (staffId: string, nextSalary: number) => {
          const updated = staff.map(s => s.id === staffId ? { ...s, salary: Math.max(0, nextSalary) } : s);
          onUpdateStaff(updated);
        };

        const handleToggleSalaryPaid = (member: Staff) => {
          const nextSt: 'Paid' | 'Pending' = getPayStatus(member) === 'Paid' ? 'Pending' : 'Paid';
          const todayStr = new Date().toISOString().substring(0, 10);
          const updated = staff.map(s =>
            s.id === member.id
              ? { ...s, salary: getSalary(s), salaryStatus: nextSt, lastSalaryPaidDate: nextSt === 'Paid' ? todayStr : s.lastSalaryPaidDate }
              : s
          );
          onUpdateStaff(updated);
          if (onUpdateAuditLogs) {
            onUpdateAuditLogs('Staff Salary Updated', `${member.name} salary (₹${getSalary(member)}) marked ${nextSt} for ${salaryMonth}.`);
          }
          triggerSuccess(`${member.name} salary marked as ${nextSt}.`);
        };

        return (
          <div className="space-y-6">
            {/* Top Controls & Filter */}
            <div className="bg-white rounded-2xl p-5 border border-luxury-brown-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-luxury-brown-950">Monthly Staff Salary & Payroll</h2>
                <p className="text-xs text-luxury-brown-500">Configure monthly salary per staff member and track Paid vs Pending payouts</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-luxury-beige-50 px-3 py-1.5 rounded-xl border border-luxury-brown-200 text-xs">
                  <span className="font-bold text-luxury-brown-700">Month:</span>
                  <input
                    type="month"
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(e.target.value)}
                    className="bg-white border border-luxury-brown-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-luxury-brown-900 focus:outline-none"
                  />
                </div>
                {(['All', 'Paid', 'Pending'] as const).map(flt => (
                  <button
                    key={flt}
                    type="button"
                    onClick={() => setSalaryFilter(flt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                      salaryFilter === flt
                        ? 'bg-luxury-brown-950 text-white border-luxury-brown-950'
                        : 'bg-white text-luxury-brown-700 border-luxury-brown-200 hover:bg-luxury-beige-50'
                    }`}
                  >
                    {flt}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-luxury-brown-100 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-luxury-brown-500">Total Staff</span>
                <p className="text-2xl font-serif font-bold text-luxury-brown-950 mt-1">{staff.length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-luxury-gold-300 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-luxury-gold-700">Total Monthly Payroll</span>
                <p className="text-2xl font-mono font-bold text-luxury-brown-950 mt-1">₹{totalMonthlyPayroll.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Paid Salary</span>
                <p className="text-2xl font-mono font-bold text-emerald-600 mt-1">₹{totalPaidPayroll.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Salary</span>
                <p className="text-2xl font-mono font-bold text-amber-600 mt-1">₹{totalPendingPayroll.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Salary Ledger Table */}
            <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-luxury-brown-950 text-white text-[11px] font-mono uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Staff Name</th>
                      <th className="py-3.5 px-4">Department & Role</th>
                      <th className="py-3.5 px-4">Monthly Salary (₹)</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100">
                    {filteredSalaryStaff.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-luxury-brown-400 font-mono font-bold">
                          No staff salary records match this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredSalaryStaff.map(member => {
                        const sal = getSalary(member);
                        const st = getPayStatus(member);
                        return (
                          <tr key={member.id} className="hover:bg-luxury-beige-50/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-serif font-bold text-luxury-brown-950 text-sm">{member.name}</div>
                              <div className="text-[11px] font-mono text-luxury-brown-500">{member.mobile}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-luxury-brown-800">{member.designation}</div>
                              <div className="text-[10px] font-mono text-luxury-brown-500">{member.department} • {member.role || 'Staff'}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="inline-flex items-center gap-1.5">
                                <span className="font-mono font-bold text-luxury-brown-500">₹</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={500}
                                  value={sal}
                                  onChange={(e) => handleUpdateMemberSalary(member.id, parseInt(e.target.value, 10) || 0)}
                                  className="w-28 px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg font-mono font-bold text-luxury-brown-950 bg-white focus:outline-none focus:border-luxury-gold-500"
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                st === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {st === 'Paid' ? `✓ Paid${member.lastSalaryPaidDate ? ` (${member.lastSalaryPaidDate})` : ''}` : '⏳ Pending'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleSalaryPaid(member)}
                                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer ${
                                  st === 'Paid'
                                    ? 'bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-800 border border-luxury-brown-200'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                                }`}
                              >
                                {st === 'Paid' ? 'Mark Pending' : '✓ Mark Salary Paid'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
