export interface SidebarNavTarget {
  activeTab: string;
  frontDeskSubTab?: string;
  roomSubTab?: string;
  housekeepingSubTab?: string;
  otaSubTab?: string;
  reportsSubTab?: string;
  staffSubTab?: string;
  invoiceSubTab?: string;
  financeSubTab?: string;
  inventorySubTab?: string;
  /** When true, the target opens in a separate browser tab (standalone POS) instead of in-page navigation */
  openInNewTab?: boolean;
  /** Optional preset flags dispatched via sessionStorage + CustomEvent */
  openNewReservationModal?: boolean;
  reservationSegment?: 'All' | 'Group' | 'Event / Banquet' | 'Corporate' | 'Individual' | 'Walk-in' | 'OTA' | 'Travel Agent';
  bookingCategory?: 'room' | 'event';
  profileSection?: 'general' | 'tax' | 'payment_mode' | 'whatsapp' | 'properties' | 'master' | 'shift' | 'coupons';
}

export interface SidebarMenuNode {
  id: string;
  label: string;
  iconKey: string;
  /** RBAC module tab ID used for role permission checks */
  rbacTab: string;
  target?: SidebarNavTarget;
  children?: SidebarMenuNode[];
}

/**
 * Exact Left Sidebar structure for DirectStay PMS.
 * Strict rules:
 * - Does NOT include Financial Hub or Point of Sale.
 * - Does NOT include any extra menu items beyond the approved specification.
 * - Availability and Guest Status remain nested expandable sections inside Front Office.
 */
export const DIRECTSTAY_PMS_SIDEBAR_TREE: SidebarMenuNode[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    iconKey: 'dashboard',
    rbacTab: 'dashboard',
    target: { activeTab: 'dashboard' },
  },
  {
    id: 'stay-overview',
    label: 'Stay Overview',
    iconKey: 'stayOverview',
    rbacTab: 'calendar',
    target: { activeTab: 'calendar' },
  },
  {
    id: 'housekeeping',
    label: 'Housekeeping',
    iconKey: 'housekeeping',
    rbacTab: 'housekeeping',
    target: { activeTab: 'housekeeping', housekeepingSubTab: 'dashboard' },
  },
  {
    id: 'front-office',
    label: 'Front Office',
    iconKey: 'frontOffice',
    rbacTab: 'frontDesk',
    children: [
      {
        id: 'fo-reservation-list',
        label: 'Reservation List',
        iconKey: 'reservationList',
        rbacTab: 'frontDesk',
        target: {
          activeTab: 'frontDesk',
          frontDeskSubTab: 'reservations',
          reservationSegment: 'All',
        },
      },
      {
        id: 'fo-new-reservation',
        label: 'New Reservation',
        iconKey: 'newReservation',
        rbacTab: 'frontDesk',
        target: {
          activeTab: 'frontDesk',
          frontDeskSubTab: 'checkin',
        },
      },
      {
        id: 'fo-rates-inventory',
        label: 'Inventory Management',
        iconKey: 'inventory',
        rbacTab: 'frontDesk',
        target: { activeTab: 'inventory', inventorySubTab: 'products' },
      },
      {
        id: 'fo-group-bookings',
        label: 'Group Bookings',
        iconKey: 'groupBookings',
        rbacTab: 'frontDesk',
        target: {
          activeTab: 'frontDesk',
          frontDeskSubTab: 'reservations',
          reservationSegment: 'Group',
        },
      },
      {
        id: 'fo-event-bookings',
        label: 'Event Bookings',
        iconKey: 'eventBookings',
        rbacTab: 'frontDesk',
        target: {
          activeTab: 'frontDesk',
          frontDeskSubTab: 'reservations',
          reservationSegment: 'Event / Banquet',
        },
      },
      {
        id: 'fo-guest-profiles',
        label: 'Guest Profiles',
        iconKey: 'guestProfiles',
        rbacTab: 'frontDesk',
        target: { activeTab: 'userList' },
      },
      {
        id: 'fo-guest-self-service',
        label: 'Guest Self Service',
        iconKey: 'guestSelfService',
        rbacTab: 'frontDesk',
        target: { activeTab: 'frontDesk', frontDeskSubTab: 'prearrival' },
      },
      {
        id: 'fo-invoices-billing',
        label: 'Invoices & Billing',
        iconKey: 'invoicesBilling',
        rbacTab: 'invoice',
        target: { activeTab: 'invoice', invoiceSubTab: 'all' },
      },
      {
        id: 'fo-guest-services',
        label: 'Guest Services',
        iconKey: 'guestServices',
        rbacTab: 'frontDesk',
        target: { activeTab: 'frontDesk', frontDeskSubTab: 'services' },
      },
      {
        id: 'fo-lost-found',
        label: 'Lost & Found',
        iconKey: 'lostFound',
        rbacTab: 'housekeeping',
        target: { activeTab: 'housekeeping', housekeepingSubTab: 'lost_found' },
      },
      {
        id: 'fo-availability',
        label: 'Availability',
        iconKey: 'availability',
        rbacTab: 'frontDesk',
        children: [
          {
            id: 'avail-room-status',
            label: 'Room Status',
            iconKey: 'dot',
            rbacTab: 'rooms',
            target: { activeTab: 'rooms', roomSubTab: 'status' },
          },
          {
            id: 'avail-occupancy-forecast',
            label: 'Occupancy Forecast',
            iconKey: 'dot',
            rbacTab: 'calendar',
            target: { activeTab: 'calendar' },
          },
          {
            id: 'avail-blocked-rooms',
            label: 'Blocked Rooms',
            iconKey: 'dot',
            rbacTab: 'rooms',
            target: { activeTab: 'rooms', roomSubTab: 'blockAssets' },
          },
          {
            id: 'avail-no-show-report',
            label: 'No Show Report',
            iconKey: 'dot',
            rbacTab: 'reports',
            target: { activeTab: 'reports', reportsSubTab: 'noshows_cancellations' },
          },
          {
            id: 'avail-arrival-report',
            label: 'Arrival Report',
            iconKey: 'dot',
            rbacTab: 'reports',
            target: { activeTab: 'reports', reportsSubTab: 'arrivals_departures' },
          },
          {
            id: 'avail-due-out-today',
            label: 'Due Out Today',
            iconKey: 'dot',
            rbacTab: 'frontDesk',
            target: { activeTab: 'frontDesk', frontDeskSubTab: 'checkout' },
          },
          {
            id: 'avail-night-audit',
            label: 'Night Audit Process',
            iconKey: 'dot',
            rbacTab: 'reports',
            target: { activeTab: 'reports', reportsSubTab: 'night_audit' },
          },
        ],
      },
      {
        id: 'fo-guest-status',
        label: 'Guest Status',
        iconKey: 'guestStatus',
        rbacTab: 'frontDesk',
        children: [
          {
            id: 'gs-checked-in-guest',
            label: 'Checked In Guest',
            iconKey: 'dot',
            rbacTab: 'frontDesk',
            target: { activeTab: 'frontDesk', frontDeskSubTab: 'checkin' },
          },
          {
            id: 'gs-in-house-guest',
            label: 'In House Guest',
            iconKey: 'dot',
            rbacTab: 'frontDesk',
            target: { activeTab: 'frontDesk', frontDeskSubTab: 'inhouse' },
          },
          {
            id: 'gs-settlement-pending',
            label: 'Settlement Pending',
            iconKey: 'dot',
            rbacTab: 'reports',
            target: { activeTab: 'reports', reportsSubTab: 'pending_dues' },
          },
          {
            id: 'gs-opened-folio',
            label: 'Opened Folio',
            iconKey: 'dot',
            rbacTab: 'invoice',
            target: { activeTab: 'invoice', invoiceSubTab: 'unpaid' },
          },
          {
            id: 'gs-collection-report',
            label: 'Collection Report',
            iconKey: 'dot',
            rbacTab: 'reports',
            target: { activeTab: 'reports', reportsSubTab: 'daily_collection_sheet' },
          },
          {
            id: 'gs-checkout-pending',
            label: 'Checkout Pending',
            iconKey: 'dot',
            rbacTab: 'frontDesk',
            target: { activeTab: 'frontDesk', frontDeskSubTab: 'checkout' },
          },
          {
            id: 'gs-checked-out-rooms',
            label: 'Checked Out Rooms',
            iconKey: 'dot',
            rbacTab: 'reports',
            target: { activeTab: 'reports', reportsSubTab: 'daily_checkouts' },
          },
        ],
      },
    ],
  },
  {
    id: 'reports-graphs',
    label: 'Reports & Graphs',
    iconKey: 'reportsGraphs',
    rbacTab: 'reports',
    target: { activeTab: 'reports', reportsSubTab: 'dashboard' },
  },
  {
    id: 'booking-engine',
    label: 'Booking Engine',
    iconKey: 'bookingEngine',
    rbacTab: 'frontDesk',
    target: { activeTab: 'bookingEngine' },
  },
  {
    id: 'channel-manager',
    label: 'Channel Manager',
    iconKey: 'channelManager',
    rbacTab: 'otaManager',
    target: { activeTab: 'otaManager', otaSubTab: 'channels' },
  },
  {
    id: 'financial-hub',
    label: 'Financial Hub',
    iconKey: 'financialHub',
    rbacTab: 'finance',
    children: [
      {
        id: 'fin-overview',
        label: 'Finance Overview',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'dashboard' },
      },
      {
        id: 'fin-income',
        label: 'Income Ledger',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'income' },
      },
      {
        id: 'fin-expenses',
        label: 'Expense Register',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'expenses' },
      },
      {
        id: 'fin-petty-cash',
        label: 'Petty Cash Drawer',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'petty_cash' },
      },
      {
        id: 'fin-cash-bank',
        label: 'Cash & Bank A/c',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'cash_bank' },
      },
      {
        id: 'fin-vouchers',
        label: 'Vouchers',
        iconKey: 'none',
        rbacTab: 'finance',
        children: [
          {
            id: 'fin-voucher-payment',
            label: 'Payment Voucher',
            iconKey: 'none',
            rbacTab: 'finance',
            target: { activeTab: 'finance', financeSubTab: 'vouchers_payment' },
          },
          {
            id: 'fin-voucher-receipt',
            label: 'Receipt Voucher',
            iconKey: 'none',
            rbacTab: 'finance',
            target: { activeTab: 'finance', financeSubTab: 'vouchers_receipt' },
          },
        ],
      },
      {
        id: 'fin-vendors',
        label: 'Vendor Payments',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'vendors' },
      },
      {
        id: 'fin-owner-payments',
        label: 'Owner/Director Payments',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'owner_payments' },
      },
      {
        id: 'fin-reimbursements',
        label: 'Staff Reimbursements',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'reimbursements' },
      },
      {
        id: 'fin-daily-closing',
        label: 'Daily Shift Closing',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'daily_closing' },
      },
      {
        id: 'fin-pl-gst',
        label: 'P&L & 5% GST Summary',
        iconKey: 'none',
        rbacTab: 'finance',
        target: { activeTab: 'finance', financeSubTab: 'pl_reports' },
      },
    ],
  },
  {
    id: 'hrm-module',
    label: 'HRM Module',
    iconKey: 'hrmModule',
    rbacTab: 'staff',
    children: [
      {
        id: 'hrm-staff-directory',
        label: 'Staff Directory & Onboarding',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'directory' },
      },
      {
        id: 'hrm-staff-roles',
        label: 'Staff Roles & RBAC',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'roles' },
      },
      {
        id: 'hrm-attendance',
        label: 'Staff Attendance & Daily Logs',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'attendance' },
      },
      {
        id: 'hrm-payroll',
        label: 'Monthly Payroll & Salaries',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'payroll' },
      },
      {
        id: 'hrm-shift-roster',
        label: 'Shift Roster & Timings',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'roster' },
      },
      {
        id: 'hrm-leaves',
        label: 'Leave Management',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'leaves' },
      },
    ],
  },
  {
    id: 'point-of-sale',
    label: 'Point of Sale',
    iconKey: 'pointOfSale',
    rbacTab: 'pos',
    target: { activeTab: 'pos', openInNewTab: true },
  },
  {
    id: 'property-setup',
    label: 'Property Setup',
    iconKey: 'propertySetup',
    rbacTab: 'rooms',
    children: [
      {
        id: 'ps-rooms-category',
        label: 'Rooms & Category',
        iconKey: 'dot',
        rbacTab: 'rooms',
        target: { activeTab: 'rooms', roomSubTab: 'dashboard' },
      },
      {
        id: 'ps-room-rate-plan',
        label: 'Room Rate Plan',
        iconKey: 'dot',
        rbacTab: 'rooms',
        target: { activeTab: 'rooms', roomSubTab: 'categories' },
      },
      {
        id: 'ps-amenities',
        label: 'Amenities',
        iconKey: 'dot',
        rbacTab: 'rooms',
        target: { activeTab: 'rooms', roomSubTab: 'amenities' },
      },
      {
        id: 'ps-packages',
        label: 'Packages',
        iconKey: 'dot',
        rbacTab: 'rooms',
        target: { activeTab: 'rooms', roomSubTab: 'settings' },
      },
      {
        id: 'ps-services',
        label: 'Services',
        iconKey: 'dot',
        rbacTab: 'frontDesk',
        target: { activeTab: 'frontDesk', frontDeskSubTab: 'services' },
      },
      {
        id: 'ps-corporate-client',
        label: 'Corporate Client',
        iconKey: 'dot',
        rbacTab: 'frontDesk',
        target: {
          activeTab: 'frontDesk',
          frontDeskSubTab: 'reservations',
          reservationSegment: 'Corporate',
        },
      },
      {
        id: 'ps-travel-agent',
        label: 'Travel Agent',
        iconKey: 'dot',
        rbacTab: 'frontDesk',
        target: { activeTab: 'frontDesk', frontDeskSubTab: 'agents' },
      },
      {
        id: 'ps-business-source',
        label: 'Business Source',
        iconKey: 'dot',
        rbacTab: 'otaManager',
        target: { activeTab: 'otaManager', otaSubTab: 'channels' },
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    iconKey: 'configuration',
    rbacTab: 'profile',
    children: [
      {
        id: 'cfg-tax-setup',
        label: 'Tax Setup',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'tax' },
      },
      {
        id: 'cfg-payment-mode',
        label: 'Payment Mode',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'payment_mode' },
      },
      {
        id: 'cfg-whatsapp',
        label: 'WhatsApp',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'whatsapp' },
      },
      {
        id: 'cfg-department-setup',
        label: 'Department Setup',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'directory' },
      },
      {
        id: 'cfg-shift-setup',
        label: 'Shift Setup',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'shift' },
      },
      {
        id: 'cfg-coupons',
        label: 'Coupons',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'coupons' },
      },
      {
        id: 'cfg-master-setup',
        label: 'Master Setup',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'master' },
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    iconKey: 'administration',
    rbacTab: 'staff',
    children: [
      {
        id: 'adm-properties',
        label: 'Properties',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'properties' },
      },
      {
        id: 'adm-building-floor',
        label: 'Building & Floor',
        iconKey: 'dot',
        rbacTab: 'rooms',
        target: { activeTab: 'rooms', roomSubTab: 'buildingFloor' },
      },
      {
        id: 'adm-users',
        label: 'Users',
        iconKey: 'dot',
        rbacTab: 'staff',
        target: { activeTab: 'staff', staffSubTab: 'allUsers' },
      },
      {
        id: 'adm-audit-logs',
        label: 'Audit Logs',
        iconKey: 'dot',
        rbacTab: 'auditLogs',
        target: { activeTab: 'auditLogs' },
      },
      {
        id: 'adm-profile-setup',
        label: 'Profile Setup',
        iconKey: 'dot',
        rbacTab: 'profile',
        target: { activeTab: 'profile', profileSection: 'master' },
      },
    ],
  },
];

export interface ActiveNavigationSnapshot {
  activeTab: string;
  frontDeskSubTab?: string;
  roomSubTab?: string;
  housekeepingSubTab?: string;
  otaSubTab?: string;
  reportsSubTab?: string;
  staffSubTab?: string;
  invoiceSubTab?: string;
  financeSubTab?: string;
  inventorySubTab?: string;
  profileSection?: string;
  lastSelectedSidebarId?: string | null;
}

export function flattenSidebarLeafNodes(
  nodes: SidebarMenuNode[] = DIRECTSTAY_PMS_SIDEBAR_TREE
): SidebarMenuNode[] {
  const result: SidebarMenuNode[] = [];
  for (const node of nodes) {
    if (node.target) {
      result.push(node);
    }
    if (node.children?.length) {
      result.push(...flattenSidebarLeafNodes(node.children));
    }
  }
  return result;
}

export function filterSidebarTreeByAllowedTabs(
  nodes: SidebarMenuNode[],
  canAccessRbacTab: (rbacTab: string) => boolean
): SidebarMenuNode[] {
  const filtered: SidebarMenuNode[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const visibleChildren = filterSidebarTreeByAllowedTabs(node.children, canAccessRbacTab);
      if (visibleChildren.length > 0) {
        filtered.push({ ...node, children: visibleChildren });
      }
    } else if (canAccessRbacTab(node.rbacTab)) {
      filtered.push(node);
    }
  }
  return filtered;
}

export function isSidebarLeafActive(
  node: SidebarMenuNode,
  state: ActiveNavigationSnapshot
): boolean {
  const t = node.target;
  if (!t) return false;

  // Disambiguate items that map to the same underlying tab/subTab when the user explicitly clicked one
  if (state.lastSelectedSidebarId) {
    const exactNode = flattenSidebarLeafNodes().find((n) => n.id === state.lastSelectedSidebarId);
    if (
      exactNode?.target &&
      exactNode.target.activeTab === state.activeTab &&
      (!exactNode.target.frontDeskSubTab || exactNode.target.frontDeskSubTab === state.frontDeskSubTab) &&
      (!exactNode.target.roomSubTab || exactNode.target.roomSubTab === state.roomSubTab) &&
      (!exactNode.target.housekeepingSubTab || exactNode.target.housekeepingSubTab === state.housekeepingSubTab) &&
      (!exactNode.target.otaSubTab || exactNode.target.otaSubTab === state.otaSubTab) &&
      (!exactNode.target.reportsSubTab || exactNode.target.reportsSubTab === state.reportsSubTab) &&
      (!exactNode.target.staffSubTab || exactNode.target.staffSubTab === state.staffSubTab) &&
      (!exactNode.target.invoiceSubTab || exactNode.target.invoiceSubTab === state.invoiceSubTab) &&
      (!exactNode.target.financeSubTab || exactNode.target.financeSubTab === state.financeSubTab) &&
      (!exactNode.target.profileSection || exactNode.target.profileSection === state.profileSection)
    ) {
      return node.id === state.lastSelectedSidebarId;
    }
  }

  if (t.activeTab !== state.activeTab) {
    // Handle bookings alias -> frontDesk/reservations
    if (state.activeTab === 'bookings' && node.id === 'fo-reservation-list') return true;
    if (state.activeTab === 'checkin' && node.id === 'gs-checked-in-guest') return true;
    return false;
  }

  if (t.openNewReservationModal) return false;
  if (t.reservationSegment && t.reservationSegment !== 'All') return false;
  if (t.bookingCategory === 'event') return false;

  if (t.frontDeskSubTab && t.frontDeskSubTab !== state.frontDeskSubTab) return false;
  if (t.roomSubTab && t.roomSubTab !== state.roomSubTab) return false;
  if (t.housekeepingSubTab && t.housekeepingSubTab !== state.housekeepingSubTab) return false;
  if (t.otaSubTab && t.otaSubTab !== state.otaSubTab) return false;
  if (t.reportsSubTab && t.reportsSubTab !== state.reportsSubTab) return false;
  if (t.staffSubTab && t.staffSubTab !== state.staffSubTab) return false;
  if (t.invoiceSubTab && t.invoiceSubTab !== state.invoiceSubTab) return false;
  if (t.financeSubTab && t.financeSubTab !== (state.financeSubTab || 'dashboard')) return false;
  if (t.inventorySubTab && t.inventorySubTab !== (state.inventorySubTab || 'dashboard')) return false;

  if (t.activeTab === 'profile') {
    const curSec = state.profileSection || 'tax';
    const targetSec = t.profileSection || 'master';
    if ((curSec === 'general' || curSec === 'master') && (targetSec === 'general' || targetSec === 'master')) {
      return node.id === 'cfg-master-setup' || node.id === 'adm-profile-setup';
    }
    return targetSec === curSec;
  }

  // Default canonical winners when no lastSelectedSidebarId disambiguates
  if (t.activeTab === 'inventory' && node.id !== 'fo-rates-inventory') return false;
  if (t.activeTab === 'calendar' && node.id !== 'stay-overview') return false;
  if (t.activeTab === 'otaManager' && node.id !== 'channel-manager') return false;
  if (t.activeTab === 'rooms' && t.roomSubTab === 'dashboard' && node.id !== 'ps-rooms-category') {
    return false;
  }
  if (t.activeTab === 'frontDesk' && t.frontDeskSubTab === 'checkout' && node.id !== 'avail-due-out-today') {
    return false;
  }
  if (t.activeTab === 'frontDesk' && t.frontDeskSubTab === 'settings' && node.id !== 'cfg-payment-mode') {
    return false;
  }
  if (t.activeTab === 'staff' && t.staffSubTab === 'directory' && node.id !== 'adm-users') {
    return false;
  }

  return true;
}

export function isSidebarBranchActive(
  node: SidebarMenuNode,
  state: ActiveNavigationSnapshot
): boolean {
  if (isSidebarLeafActive(node, state)) return true;
  if (!node.children) return false;
  return node.children.some((child) => isSidebarBranchActive(child, state));
}
