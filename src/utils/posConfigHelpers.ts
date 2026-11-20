import type { HotelSettings } from '../types';

export interface PosFacilitySettings {
  inHouseKitchenAvailable: boolean;
  inHouseRestaurantAvailable: boolean;
  posOutletName: string;
}

export interface PosResolvedCapabilities extends PosFacilitySettings {
  kotEnabled: boolean;
  kotPrintingEnabled: boolean;
  kdsEnabled: boolean;
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
  tablesEnabled: boolean;
  tableReservationsEnabled: boolean;
  roomServiceEnabled: boolean;
  allowedOrderTypes: Array<'Dine In' | 'Takeaway' | 'Room Service'>;
  defaultOrderType: 'Dine In' | 'Room Service';
}

export type StandalonePosNavId =
  | 'take_order'
  | 'pos'
  | 'orders_current'
  | 'orders_history'
  | 'reservations'
  | 'help'
  | 'settings';

export interface StandalonePosSidebarNode {
  id: string;
  label: string;
  path: string;
  subTab?: string;
  requiresRestaurant?: boolean;
  children?: StandalonePosSidebarNode[];
}

export const STANDALONE_POS_SIDEBAR_TREE: StandalonePosSidebarNode[] = [
  {
    id: 'take_order',
    label: 'Take Order',
    path: '/pos/take-order',
    subTab: 'take_order',
  },
  {
    id: 'pos',
    label: 'POS',
    path: '/pos',
    subTab: 'terminal',
  },
  {
    id: 'orders',
    label: 'Orders',
    path: '/pos/orders/current',
    children: [
      {
        id: 'orders_current',
        label: 'Current Orders',
        path: '/pos/orders/current',
        subTab: 'orders_current',
      },
      {
        id: 'orders_history',
        label: 'Order History',
        path: '/pos/orders/history',
        subTab: 'orders_history',
      },
    ],
  },
  {
    id: 'reservations',
    label: 'Reservations',
    path: '/pos/reservations',
    subTab: 'advance_booking',
    requiresRestaurant: true,
  },
  {
    id: 'help',
    label: 'Help Guide',
    path: '/pos/help',
    subTab: 'help',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/pos/settings',
    subTab: 'settings',
  },
];

export function getPosFacilityStorageKey(hotelId?: string): string {
  return `directstay_pos_facility_cfg_${hotelId || 'hotel-1'}`;
}

export function readStoredPosFacilityFallback(
  hotelId?: string
): Partial<PosFacilitySettings> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getPosFacilityStorageKey(hotelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore storage errors
  }
  return null;
}

export function writeStoredPosFacilityFallback(
  hotelId: string | undefined,
  settings: PosFacilitySettings
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getPosFacilityStorageKey(hotelId), JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function normalizePosFacilitySettings(
  hotelSettings?: Partial<HotelSettings> | Record<string, any> | null,
  hotelId?: string
): PosFacilitySettings {
  const stored = readStoredPosFacilityFallback(hotelId || (hotelSettings as any)?.id);

  const inHouseKitchenAvailable =
    hotelSettings?.inHouseKitchenAvailable !== undefined
      ? Boolean(hotelSettings.inHouseKitchenAvailable)
      : stored?.inHouseKitchenAvailable !== undefined
      ? Boolean(stored.inHouseKitchenAvailable)
      : true;

  const inHouseRestaurantAvailable =
    hotelSettings?.inHouseRestaurantAvailable !== undefined
      ? Boolean(hotelSettings.inHouseRestaurantAvailable)
      : stored?.inHouseRestaurantAvailable !== undefined
      ? Boolean(stored.inHouseRestaurantAvailable)
      : true;

  const defaultOutlet = inHouseRestaurantAvailable
    ? 'Main Restaurant & Room Service'
    : 'In-Room Dining (Room Service)';

  const posOutletName =
    (typeof hotelSettings?.posOutletName === 'string' && hotelSettings.posOutletName.trim()) ||
    (typeof stored?.posOutletName === 'string' && stored.posOutletName.trim()) ||
    defaultOutlet;

  return {
    inHouseKitchenAvailable,
    inHouseRestaurantAvailable,
    posOutletName,
  };
}

export function resolvePosCapabilities(
  hotelSettings?: Partial<HotelSettings> | Record<string, any> | null,
  hotelId?: string
): PosResolvedCapabilities {
  const base = normalizePosFacilitySettings(hotelSettings, hotelId);
  const kitchen = base.inHouseKitchenAvailable;
  const restaurant = base.inHouseRestaurantAvailable;

  const allowedOrderTypes: Array<'Dine In' | 'Takeaway' | 'Room Service'> = restaurant
    ? ['Dine In', 'Takeaway', 'Room Service']
    : ['Room Service'];

  return {
    ...base,
    kotEnabled: kitchen,
    kotPrintingEnabled: kitchen,
    kdsEnabled: kitchen,
    dineInEnabled: restaurant,
    takeawayEnabled: restaurant,
    tablesEnabled: restaurant,
    tableReservationsEnabled: restaurant,
    roomServiceEnabled: true,
    allowedOrderTypes,
    defaultOrderType: restaurant ? 'Dine In' : 'Room Service',
  };
}

export function getVisiblePosSidebarTree(
  capabilities: PosResolvedCapabilities
): StandalonePosSidebarNode[] {
  return STANDALONE_POS_SIDEBAR_TREE.filter((node) => {
    if (node.requiresRestaurant && !capabilities.inHouseRestaurantAvailable) {
      return false;
    }
    return true;
  });
}

export function mapPosPathToSubTab(pathname: string): string {
  const clean = (pathname || '/pos').replace(/\/+$/, '').toLowerCase();
  const segs = clean.split('/').filter(Boolean);
  if (segs[0] !== 'pos') return 'terminal';
  const s1 = segs[1] || '';
  const s2 = segs[2] || '';

  if (!s1 || s1 === 'billing' || s1 === 'terminal') return 'terminal';
  if (s1 === 'take-order' || s1 === 'take_order') return 'take_order';
  if (s1 === 'orders') {
    if (s2 === 'history') return 'orders_history';
    return 'orders_current';
  }
  if (s1 === 'orders_current') return 'orders_current';
  if (s1 === 'orders_history') return 'orders_history';
  if (s1 === 'reservations' || s1 === 'advance_booking' || s1 === 'advance-booking') {
    return 'advance_booking';
  }
  if (s1 === 'help' || s1 === 'help-guide') return 'help';
  if (s1 === 'settings') return 'settings';
  if (s1 === 'kds') return 'kds';
  if (s1 === 'tables') return 'tables';
  if (s1 === 'catalog' || s1 === 'menu') return 'catalog';
  if (s1 === 'qr_menu' || s1 === 'qr-menu') return 'qr_menu';
  if (s1 === 'reports') return 'reports';
  return 'terminal';
}

export function mapPosSubTabToPath(subTab: string): string {
  switch (subTab) {
    case 'take_order':
      return '/pos/take-order';
    case 'terminal':
    case 'dashboard':
      return '/pos';
    case 'orders_current':
    case 'orders':
      return '/pos/orders/current';
    case 'orders_history':
      return '/pos/orders/history';
    case 'advance_booking':
      return '/pos/reservations';
    case 'help':
      return '/pos/help';
    case 'settings':
      return '/pos/settings';
    case 'kds':
      return '/pos/kds';
    case 'tables':
      return '/pos/tables';
    case 'catalog':
      return '/pos/catalog';
    case 'qr_menu':
      return '/pos/qr-menu';
    case 'reports':
      return '/pos/reports';
    default:
      return '/pos';
  }
}

export function buildStandalonePosUrl(
  subTab = 'terminal',
  hotelId?: string,
  handoffCode?: string
): string {
  const basePath = mapPosSubTabToPath(subTab);
  const params = new URLSearchParams();
  if (hotelId) params.set('hotelId', hotelId);
  if (handoffCode) params.set('posHandoff', handoffCode);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export async function prefetchPosHandoffCode(hotelId?: string): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const token =
      sessionStorage.getItem('pms_session_token') ||
      sessionStorage.getItem('pms_auth_token') ||
      localStorage.getItem('pms_session_token') ||
      localStorage.getItem('pms_auth_token') ||
      '';
    if (!token) return '';
    const role = sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role') || 'Admin';
    const resolvedHotel =
      hotelId || sessionStorage.getItem('pms_hotel_id') || localStorage.getItem('pms_hotel_id') || '';
    const resp = await fetch('/api/auth/pos-handoff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
        'x-user-role': role,
        ...(resolvedHotel ? { 'x-hotel-id': resolvedHotel } : {}),
      },
      body: JSON.stringify({ hotelId: resolvedHotel || undefined }),
    });
    if (!resp.ok) return '';
    const data = await resp.json().catch(() => null);
    if (data?.success && data?.handoffCode) {
      sessionStorage.setItem('pms_pos_handoff_code', String(data.handoffCode));
      return String(data.handoffCode);
    }
  } catch {}
  return '';
}

export function openStandalonePosInNewTab(subTab = 'terminal', hotelId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of [
      'pms_session_token',
      'pms_auth_token',
      'pms_authenticated',
      'pms_role',
      'pms_user',
      'pms_hotel_id',
      'pms_staff_username',
    ]) {
      const sessVal = sessionStorage.getItem(key);
      if (sessVal) {
        localStorage.setItem(key, sessVal);
      }
    }
    if (hotelId) {
      localStorage.setItem('pms_hotel_id', hotelId);
      sessionStorage.setItem('pms_hotel_id', hotelId);
    }
    const handoffCode = sessionStorage.getItem('pms_pos_handoff_code') || '';
    if (handoffCode) {
      sessionStorage.removeItem('pms_pos_handoff_code');
    }
    void prefetchPosHandoffCode(hotelId);
    const url = buildStandalonePosUrl(subTab, hotelId, handoffCode || undefined);
    const opened = window.open(url, '_blank');
    if (!opened) {
      // Fallback if browser popup blocker intercepts synthetic click
      window.location.assign(url);
    }
  } catch {
    window.location.assign(buildStandalonePosUrl(subTab, hotelId));
  }
}
