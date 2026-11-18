import { useEffect, useState } from 'react';

export type PermissionRule = {
  view: boolean;
  createEdit: boolean;
  deleteCancel: boolean;
  approveExport: boolean;
};

export type RbacMatrix = Record<string, Record<string, PermissionRule>>;

export const PMS_MODULES_LIST = [
  { id: 'dashboard', name: '1. Live Command Center (Dashboard)' },
  { id: 'frontDesk', name: '2. Front Desk, Walk-In & Advance Bookings' },
  { id: 'calendar', name: '3. Room Calendar Matrix (Tape Chart)' },
  { id: 'invoices', name: '4. GST Invoices & Folio Billing' },
  { id: 'rooms', name: '5. Room Inventory, Blocks & Tariff Plans' },
  { id: 'housekeeping', name: '6. Housekeeping, Laundry & Lost/Found' },
  { id: 'pos', name: '7. Restaurant POS & Live KOT Display' },
  { id: 'inventory', name: '8. Store Inventory, POs & Suppliers' },
  { id: 'ota', name: '9. OTA Channel Manager & API Keys' },
  { id: 'finance', name: '10. Finance Hub, Vouchers & Shift Closing' },
  { id: 'reports', name: '11. 15 Statutory & MIS Reports (GSTR-1 / C-Form)' },
  { id: 'staff', name: '12. Staff Roster, RBAC & Audit Logs' },
];

export const DEFAULT_RBAC_MATRIX: RbacMatrix = {
  Manager: Object.fromEntries(
    PMS_MODULES_LIST.map((m) => [
      m.id,
      { view: true, createEdit: true, deleteCancel: true, approveExport: true },
    ])
  ),
  Receptionist: Object.fromEntries(
    PMS_MODULES_LIST.map((m) => [
      m.id,
      {
        view: !['ota', 'staff', 'finance', 'inventory'].includes(m.id),
        createEdit: ['dashboard', 'frontDesk', 'calendar', 'invoices', 'pos', 'housekeeping'].includes(m.id),
        deleteCancel: ['frontDesk'].includes(m.id),
        approveExport: ['invoices', 'reports'].includes(m.id),
      },
    ])
  ),
  Housekeeping: Object.fromEntries(
    PMS_MODULES_LIST.map((m) => [
      m.id,
      {
        view: ['dashboard', 'rooms', 'housekeeping', 'inventory'].includes(m.id),
        createEdit: ['housekeeping', 'rooms'].includes(m.id),
        deleteCancel: false,
        approveExport: false,
      },
    ])
  ),
  Accounts: Object.fromEntries(
    PMS_MODULES_LIST.map((m) => [
      m.id,
      {
        view: ['dashboard', 'invoices', 'pos', 'inventory', 'finance', 'reports'].includes(m.id),
        createEdit: ['invoices', 'finance', 'inventory'].includes(m.id),
        deleteCancel: ['finance'].includes(m.id),
        approveExport: ['invoices', 'finance', 'reports'].includes(m.id),
      },
    ])
  ),
  'Kitchen Chef': Object.fromEntries(
    PMS_MODULES_LIST.map((m) => [
      m.id,
      {
        view: ['pos', 'inventory'].includes(m.id),
        createEdit: ['pos', 'inventory'].includes(m.id),
        deleteCancel: false,
        approveExport: false,
      },
    ])
  ),
};

const STORAGE_KEY = 'directstay_rbac_matrix_v2';
const EVENT_NAME = 'directstay-rbac-updated';

export function normalizeRbacRole(rawRole?: string | null): string | null {
  if (!rawRole) return null;
  const r = rawRole.trim();
  if (r === 'Admin' || r === 'SuperAdmin' || r === 'Owner') return null; // Full access roles
  if (r === 'Reception' || r === 'Receptionist' || r === 'Front Office') return 'Receptionist';
  if (r === 'Housekeeping') return 'Housekeeping';
  if (r === 'Manager') return 'Manager';
  if (r === 'Accounts' || r === 'Accountant') return 'Accounts';
  if (r === 'Kitchen Chef' || r === 'Chef' || r === 'F&B Kitchen') return 'Kitchen Chef';
  return r;
}

export function mapTabIdToRbacModule(tabId: string): string | null {
  switch (tabId) {
    case 'dashboard':
      return 'dashboard';
    case 'frontDesk':
    case 'bookings':
    case 'checkin':
      return 'frontDesk';
    case 'calendar':
      return 'calendar';
    case 'invoice':
    case 'invoices':
      return 'invoices';
    case 'rooms':
      return 'rooms';
    case 'housekeeping':
      return 'housekeeping';
    case 'pos':
      return 'pos';
    case 'inventory':
      return 'inventory';
    case 'otaManager':
    case 'ota':
      return 'ota';
    case 'finance':
    case 'expenses':
      return 'finance';
    case 'reports':
      return 'reports';
    case 'staff':
    case 'auditLogs':
      return 'staff';
    default:
      return null;
  }
}

export function mapRbacModuleToSidebarTabs(rbacModId: string): string[] {
  switch (rbacModId) {
    case 'dashboard':
      return ['dashboard'];
    case 'frontDesk':
      return ['frontDesk', 'bookings', 'checkin'];
    case 'calendar':
      return ['calendar'];
    case 'invoices':
      return ['invoice'];
    case 'rooms':
      return ['rooms'];
    case 'housekeeping':
      return ['housekeeping'];
    case 'pos':
      return ['pos'];
    case 'inventory':
      return ['inventory'];
    case 'ota':
      return ['otaManager'];
    case 'finance':
      return ['finance', 'expenses'];
    case 'reports':
      return ['reports'];
    case 'staff':
      return ['staff', 'auditLogs'];
    default:
      return [rbacModId];
  }
}

export function loadRbacMatrix(): RbacMatrix {
  if (typeof window === 'undefined') return DEFAULT_RBAC_MATRIX;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RBAC_MATRIX;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_RBAC_MATRIX;
    const merged: RbacMatrix = { ...DEFAULT_RBAC_MATRIX };
    for (const roleKey of Object.keys(DEFAULT_RBAC_MATRIX)) {
      if (parsed[roleKey] && typeof parsed[roleKey] === 'object') {
        merged[roleKey] = {
          ...DEFAULT_RBAC_MATRIX[roleKey],
          ...parsed[roleKey],
        };
      }
    }
    // Also copy any custom keys (e.g. staff-specific keys like `staff:username`)
    for (const key of Object.keys(parsed)) {
      if (!merged[key] && parsed[key] && typeof parsed[key] === 'object') {
        merged[key] = parsed[key];
      }
    }
    return merged;
  } catch {
    return DEFAULT_RBAC_MATRIX;
  }
}

export function saveRbacMatrix(nextMatrix: RbacMatrix): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMatrix));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextMatrix }));
  } catch {
    // Ignore storage errors
  }
}

export function getRoleModulePermission(
  matrix: RbacMatrix,
  rawRole: string | undefined | null,
  tabOrModuleId: string,
  staffUsername?: string | null
): PermissionRule {
  const fullAccess: PermissionRule = {
    view: true,
    createEdit: true,
    deleteCancel: true,
    approveExport: true,
  };
  const roleKey = normalizeRbacRole(rawRole);
  if (!roleKey) return fullAccess; // Admin / Owner / SuperAdmin

  const modKey = mapTabIdToRbacModule(tabOrModuleId) || tabOrModuleId;
  if (!PMS_MODULES_LIST.some((m) => m.id === modKey)) {
    return fullAccess; // Always allow profile / notifications
  }

  // Check staff-specific override first if present
  if (staffUsername) {
    const userKey = `user:${staffUsername.toLowerCase()}`;
    if (matrix[userKey]?.[modKey]) {
      return matrix[userKey][modKey];
    }
  }

  const roleRules = matrix[roleKey] || DEFAULT_RBAC_MATRIX[roleKey] || DEFAULT_RBAC_MATRIX.Receptionist;
  return (
    roleRules?.[modKey] || {
      view: false,
      createEdit: false,
      deleteCancel: false,
      approveExport: false,
    }
  );
}

export function getAllowedSidebarTabsForRole(
  matrix: RbacMatrix,
  rawRole: string,
  staffUsername?: string | null
): string[] {
  const roleKey = normalizeRbacRole(rawRole);
  if (!roleKey) return PMS_MODULES_LIST.flatMap((m) => mapRbacModuleToSidebarTabs(m.id));
  const allowedTabs: string[] = [];
  PMS_MODULES_LIST.forEach((mod) => {
    const rule = getRoleModulePermission(matrix, roleKey, mod.id, staffUsername);
    if (rule.view) {
      allowedTabs.push(...mapRbacModuleToSidebarTabs(mod.id));
    }
  });
  return Array.from(new Set([...allowedTabs, 'notifications', 'profile']));
}

export function useRbacMatrix(): [RbacMatrix, (next: RbacMatrix) => void] {
  const [matrix, setMatrix] = useState<RbacMatrix>(() => loadRbacMatrix());

  useEffect(() => {
    const handleUpdate = () => {
      setMatrix(loadRbacMatrix());
    };
    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updateMatrix = (next: RbacMatrix) => {
    setMatrix(next);
    saveRbacMatrix(next);
  };

  return [matrix, updateMatrix];
}
