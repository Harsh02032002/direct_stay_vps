import React, { useState, useEffect } from 'react';
import { getPmsData, savePmsData, clearPmsMemoryCache, DEFAULT_HOTEL_SETTINGS, INITIAL_SYSTEM_WEBSITE, INITIAL_SAAS_PACKAGES, INITIAL_CUSTOM_PAGES, INITIAL_NOTIFICATIONS } from './utils/dummyData';
import {
  fetchAllFromSupabase,
  fetchPublicWebsiteConfig,
  syncAllToSupabase,
  hasPendingSync,
  waitForPendingSyncs,
  markDbHydrated,
  onboardHotelApi,
  appendAuditLogToCloud,
  fetchNotificationsApi,
  createNotificationApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  getNotificationStreamUrl,
  isBackendServerActive
} from './utils/supabaseClient';
import { showToast, dismissToast, subscribeToasts, ToastItem } from './utils/toast';
import { deduplicateInvoicesByBooking, normalizeInvoiceConditions } from './utils/invoiceConditions';
import { Room, Booking, GuestCheckIn, Invoice, Expense, CashHandover, HotelPolicy, UserRole, WaterBottleRecord, Staff, AuditLog, RoomVerification, HotelSettings, Hotel, SystemWebsiteConfig, Testimonial, RolePermission, SaaSPackage, CustomPage, InventoryProduct, InventoryCategory, InventorySupplier, InventoryPurchase, InventoryStockMovement, PosItem, PosOrder, PosCategory, PettyCashTransaction, CashBankAccount, FinanceVoucher, Vendor, OwnerDirectorPayment, StaffReimbursement, DailyClosingRecord, LaundryItemMaster, LaundryOrder, LostAndFoundItem, HousekeepingCleaningLog, AppNotification, NotificationEventType, DeletedItemRecord, TravelAgent, AgentCommissionPayment, FoodAdvanceBooking } from './types';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import TodayBookingsView from './components/TodayBookingsView';
import RoomManagementView from './components/RoomManagementView';
import CalendarBookingView from './components/CalendarBookingView';
import ReservationView from './components/ReservationView';
import CheckInFormView from './components/CheckInFormView';
import InvoiceView from './components/InvoiceView';
import ReportsView from './components/ReportsView';
import DailyReportView from './components/DailyReportView';
import PolicyManager from './components/PolicyManager';
import ExpenseView from './components/ExpenseView';
import CashHandoverView from './components/CashHandoverView';
import StaffManagementView from './components/StaffManagementView';
import GuestUserListView from './components/GuestUserListView';
import AuditLogsView from './components/AuditLogsView';
import OtaManagerView from './components/OtaManagerView';
import SuperAdminHub from './components/SuperAdminHub';
import HotelOwnerView, { HotelOwnerSubTab } from './components/HotelOwnerView';
import NotificationBellAndDrawer, {
  resolveNotificationActionLink,
  filterNotificationsForRoleAndHotel
} from './components/NotificationBellAndDrawer';
import ProfileSettingsView from './components/ProfileSettingsView';
import InventoryView from './components/InventoryView';
import PosView from './components/PosView';
import FinanceView from './components/FinanceView';
import FrontDeskView from './components/FrontDeskView';
import { HousekeepingView } from './components/HousekeepingView';

import IntegratedAdminPmsHub from './pms-integrated/IntegratedAdminPmsHub';
import { StandalonePosLayout } from './pms-integrated/components/StandalonePosLayout';
import {
  mapPosPathToSubTab,
  mapPosSubTabToPath,
  prefetchPosHandoffCode,
  resolvePosCapabilities,
} from './utils/posConfigHelpers';

import LoginView, { LoginPortalMode } from './components/LoginView';
import FrontWebsite from './components/FrontWebsite';
import FrontWebsitePrototype from './components/FrontWebsitePrototype';
import HotelPublicBookingPage from './components/HotelPublicBookingPage';
import DigitalMenuView from './components/DigitalMenuView';
import {
  PublicSeoPageKey,
  PUBLIC_SEO_PAGES,
  resolvePublicSeoPageFromPath,
  trackSeoConversionEvent
} from './utils/seoManager';
import { Sparkles, Calendar, Shield, RefreshCw, Cloud, Database, CheckCircle2, ChevronRight, AlertTriangle, ArrowLeft, Home, Bell, CheckCheck, Clock, ExternalLink, XCircle, Info, X } from 'lucide-react';


type SuperAdminSubTabType = 'dashboard' | 'hotels' | 'packages' | 'users' | 'leads' | 'website' | 'blogs' | 'pages';

const VALID_SUPERADMIN_SUBTABS = new Set<SuperAdminSubTabType>(['dashboard', 'hotels', 'packages', 'users', 'leads', 'website', 'blogs', 'pages']);
const VALID_OWNER_SUBTABS = new Set<HotelOwnerSubTab>(['dashboard', 'property', 'bookings', 'financials', 'occupancy', 'staff', 'subscription', 'auditLogs']);
const VALID_ADMIN_TABS = new Set<string>([
  'dashboard', 'frontDesk', 'todayBookings', 'rooms', 'housekeeping',
  'calendar', 'bookings', 'checkin', 'invoice', 'pos', 'inventory',
  'otaManager', 'bookingEngine', 'finance', 'expenses', 'handover', 'staff', 'userList', 'policies',
  'reports', 'dailyReport', 'auditLogs', 'notifications', 'profile'
]);

const SUPERADMIN_ROUTE_ALIASES: Record<string, SuperAdminSubTabType | 'profile' | 'notifications'> = {
  dashboard: 'dashboard',
  hotels: 'hotels',
  packages: 'packages',
  subscriptions: 'packages',
  users: 'users',
  leads: 'leads',
  crm: 'leads',
  website: 'website',
  'website-cms': 'website',
  blogs: 'blogs',
  blog: 'blogs',
  pages: 'pages',
  notifications: 'notifications',
  profile: 'profile'
};

const OWNER_ROUTE_ALIASES: Record<string, HotelOwnerSubTab | 'profile' | 'notifications'> = {
  dashboard: 'dashboard',
  property: 'property',
  bookings: 'bookings',
  financials: 'financials',
  finances: 'financials',
  occupancy: 'occupancy',
  reports: 'occupancy',
  staff: 'staff',
  subscription: 'subscription',
  auditLogs: 'auditLogs',
  notifications: 'notifications',
  profile: 'profile'
};

const ADMIN_ROUTE_ALIASES: Record<string, { tab: string; subTab?: string }> = {
  dashboard: { tab: 'dashboard' },
  reservations: { tab: 'frontDesk', subTab: 'reservations' },
  bookings: { tab: 'frontDesk', subTab: 'reservations' },
  prearrival: { tab: 'frontDesk', subTab: 'prearrival' },
  'pre-arrival': { tab: 'frontDesk', subTab: 'prearrival' },
  'check-in': { tab: 'frontDesk', subTab: 'checkin' },
  checkin: { tab: 'frontDesk', subTab: 'checkin' },
  walkin: { tab: 'frontDesk', subTab: 'walkin' },
  inhouse: { tab: 'frontDesk', subTab: 'inhouse' },
  'check-out': { tab: 'frontDesk', subTab: 'checkout' },
  checkout: { tab: 'frontDesk', subTab: 'checkout' },
  rooms: { tab: 'rooms' },
  'building-floor': { tab: 'rooms', subTab: 'buildingFloor' },
  buildingFloor: { tab: 'rooms', subTab: 'buildingFloor' },
  staff: { tab: 'staff' },
  hrm: { tab: 'staff' },
  attendance: { tab: 'staff', subTab: 'attendance' },
  payroll: { tab: 'staff', subTab: 'payroll' },
  roster: { tab: 'staff', subTab: 'roster' },
  leaves: { tab: 'staff', subTab: 'leaves' },
  users: { tab: 'staff', subTab: 'allUsers' },
  'all-users': { tab: 'staff', subTab: 'allUsers' },
  'user-roles': { tab: 'staff', subTab: 'roles' },
  roles: { tab: 'staff', subTab: 'roles' },
  userlist: { tab: 'userList' },
  'user-list': { tab: 'userList' },
  userList: { tab: 'userList' },
  guests: { tab: 'userList' },
  documents: { tab: 'userList', subTab: 'documents' },
  'guest-documents': { tab: 'userList', subTab: 'documents' },
  guestDocuments: { tab: 'userList', subTab: 'documents' },
  billing: { tab: 'invoice' },
  invoice: { tab: 'invoice' },
  invoices: { tab: 'invoice' },
  services: { tab: 'frontDesk', subTab: 'services' },
  agents: { tab: 'frontDesk', subTab: 'agents' },
  'travel-agents': { tab: 'frontDesk', subTab: 'agents' },
  deleted: { tab: 'frontDesk', subTab: 'deleted' },
  'deleted-folder': { tab: 'frontDesk', subTab: 'deleted' },
  trash: { tab: 'frontDesk', subTab: 'deleted' },
  reports: { tab: 'reports' },
  notifications: { tab: 'notifications' },
  profile: { tab: 'profile' },
  properties: { tab: 'profile', subTab: 'properties' },
  'profile-setup': { tab: 'profile', subTab: 'master' },
  'tax-setup': { tab: 'profile', subTab: 'tax' },
  tax: { tab: 'profile', subTab: 'tax' },
  'payment-mode': { tab: 'profile', subTab: 'payment_mode' },
  payment: { tab: 'profile', subTab: 'payment_mode' },
  whatsapp: { tab: 'profile', subTab: 'whatsapp' },
  'shift-setup': { tab: 'profile', subTab: 'shift' },
  shift: { tab: 'profile', subTab: 'shift' },
  coupons: { tab: 'profile', subTab: 'coupons' },
  coupon: { tab: 'profile', subTab: 'coupons' },
  'master-setup': { tab: 'profile', subTab: 'master' },
  master: { tab: 'profile', subTab: 'master' },
  frontDesk: { tab: 'frontDesk' },
  frontdesk: { tab: 'frontDesk' },
  todayBookings: { tab: 'todayBookings' },
  todaybookings: { tab: 'todayBookings' },
  housekeeping: { tab: 'housekeeping' },
  calendar: { tab: 'calendar' },
  'stay-overview': { tab: 'calendar' },
  stayoverview: { tab: 'calendar' },
  stayOverview: { tab: 'calendar' },
  pos: { tab: 'pos' },
  inventory: { tab: 'inventory' },
  finance: { tab: 'finance' },
  expenses: { tab: 'expenses' },
  handover: { tab: 'handover' },
  policies: { tab: 'policies' },
  otaManager: { tab: 'otaManager' },
  otamanager: { tab: 'otaManager' },
  'channel-manager': { tab: 'otaManager' },
  bookingEngine: { tab: 'bookingEngine' },
  bookingengine: { tab: 'bookingEngine' },
  'booking-engine': { tab: 'bookingEngine' },
  dailyReport: { tab: 'dailyReport' },
  dailyreport: { tab: 'dailyReport' },
  auditLogs: { tab: 'auditLogs' },
  auditlogs: { tab: 'auditLogs' }
};

function getRoleBasePath(role: UserRole): string {
  if (role === 'SuperAdmin') return '/superadmin';
  if (role === 'Owner') return '/hotelowner';
  return '/admin';
}

const FAST_SNAPSHOT_KEY = 'pms_fast_snapshot_v2';

function stripHeavyInlineBlobs(val: any, depth = 0): any {
  if (depth > 12 || val == null) return val;
  if (typeof val === 'string') {
    return val.length > 2048 && val.startsWith('data:') ? '' : val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripHeavyInlineBlobs(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = stripHeavyInlineBlobs(v, depth + 1);
    }
    return out;
  }
  return val;
}

function getScopedSnapshotKey(): string {
  const savedRole = sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role') || '';
  const savedHotel =
    savedRole === 'SuperAdmin'
      ? 'SUPERADMIN'
      : sessionStorage.getItem('pms_hotel_id') || localStorage.getItem('pms_hotel_id') || '';
  return savedRole ? `${FAST_SNAPSHOT_KEY}:${savedRole}:${savedHotel}` : '';
}

function readFastSessionSnapshot(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    const tok =
      sessionStorage.getItem('pms_session_token') ||
      sessionStorage.getItem('pms_auth_token') ||
      localStorage.getItem('pms_session_token') ||
      localStorage.getItem('pms_auth_token') ||
      '';
    if (!tok) return null;
    const scopedKey = getScopedSnapshotKey();
    if (!scopedKey) return null;
    const raw = sessionStorage.getItem(scopedKey) || localStorage.getItem(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data) {
      return parsed.data;
    }
  } catch {}
  return null;
}

function writeFastSessionSnapshot(data: Record<string, any>): void {
  if (typeof window === 'undefined' || !data) return;
  try {
    const scopedKey = getScopedSnapshotKey();
    if (!scopedKey) return;
    const slim = stripHeavyInlineBlobs(data);
    const serialized = JSON.stringify({ ts: Date.now(), data: slim });
    sessionStorage.setItem(scopedKey, serialized);
    localStorage.setItem(scopedKey, serialized);
  } catch {}
}

function clearFastSessionSnapshots(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const store of [sessionStorage, localStorage]) {
      for (let i = store.length - 1; i >= 0; i--) {
        const k = store.key(i);
        if (k && k.startsWith('pms_fast_snapshot')) {
          store.removeItem(k);
        }
      }
    }
  } catch {}
}

export default function App() {
  const [bootSnap] = useState<Record<string, any> | null>(() => readFastSessionSnapshot());
  // SaaS Multi-Hotel States
  const [hotels, setHotels] = useState<Hotel[]>(() => (Array.isArray(bootSnap?.hotels) ? bootSnap.hotels : []));
  const [packages, setPackages] = useState<SaaSPackage[]>(() => (Array.isArray(bootSnap?.packages) ? bootSnap.packages : []));
  const [customPages, setCustomPages] = useState<CustomPage[]>(() => (Array.isArray(bootSnap?.customPages) ? bootSnap.customPages : []));
  const [selectedHotelId, setSelectedHotelId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const qHotel = new URLSearchParams(window.location.search).get('hotelId');
      if (qHotel) return qHotel;
    }
    return (
      sessionStorage.getItem('pms_hotel_id') ||
      localStorage.getItem('pms_hotel_id') ||
      bootSnap?.hotels?.[0]?.id ||
      ''
    );
  });
  const [isStandalonePosMode, setIsStandalonePosMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.toLowerCase().startsWith('/pos');
  });
  const [systemWebsite, setSystemWebsite] = useState<SystemWebsiteConfig>(() =>
    bootSnap?.systemWebsite ? { ...INITIAL_SYSTEM_WEBSITE, ...bootSnap.systemWebsite } : INITIAL_SYSTEM_WEBSITE
  );
  const [superAdminSubTab, setSuperAdminSubTab] = useState<SuperAdminSubTabType>('dashboard');
  const [ownerSubTab, setOwnerSubTab] = useState<HotelOwnerSubTab>('dashboard');
  const [rawNotifications, setRawNotifications] = useState<AppNotification[]>(() =>
    Array.isArray(bootSnap?.notifications) ? bootSnap.notifications : INITIAL_NOTIFICATIONS
  );
  const [isNotFoundRoute, setIsNotFoundRoute] = useState<boolean>(false);
  const [publicHotelBookingId, setPublicHotelBookingId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('hotelBooking')) return sp.get('hotelBooking');
    const cleanPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const segs = cleanPath.split('/').filter(Boolean);
    if (segs[0]?.toLowerCase() === 'book' && segs[1]) return segs[1];
    return null;
  });
  const [publicDigitalMenuHotelId, setPublicDigitalMenuHotelId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    if (sp.has('digitalMenu')) return sp.get('digitalMenu') || 'hotel-1';
    const cleanPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const segs = cleanPath.split('/').filter(Boolean);
    if (segs[0]?.toLowerCase() === 'digital-menu' || segs[0]?.toLowerCase() === 'menu') {
      return segs[1] || 'hotel-1';
    }
    return null;
  });
  const getStoredAuthToken = (): string => {
    if (typeof window === 'undefined') return '';
    return (
      sessionStorage.getItem('pms_session_token') ||
      sessionStorage.getItem('pms_auth_token') ||
      localStorage.getItem('pms_session_token') ||
      localStorage.getItem('pms_auth_token') ||
      ''
    );
  };
  const hasStoredValidAuth = (): boolean => {
    if (typeof window === 'undefined') return false;
    const flag =
      sessionStorage.getItem('pms_authenticated') === 'true' ||
      localStorage.getItem('pms_authenticated') === 'true';
    const tok = getStoredAuthToken();
    if (flag && !tok) {
      sessionStorage.removeItem('pms_authenticated');
      localStorage.removeItem('pms_authenticated');
      return false;
    }
    return Boolean(flag && tok);
  };

  const [isPublicWebsiteForced, setIsPublicWebsiteForced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isAuth = hasStoredValidAuth();
    if (!isAuth) return false;
    const cleanPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const segs = cleanPath.split('/').filter(Boolean);
    if (cleanPath === '/' || segs[0]?.toLowerCase() === 'prototype' || segs[0]?.toLowerCase() === 'mobile-prototype') return true;
    const seoRoute = resolvePublicSeoPageFromPath(cleanPath);
    return Boolean(seoRoute.pageKey);
  });
  const [isPrototypeWebsite, setIsPrototypeWebsite] = useState<boolean>(true);
  const [portalLoginMode, setPortalLoginMode] = useState<LoginPortalMode | null>(() => {
    if (typeof window === 'undefined') return null;
    const isAuth = hasStoredValidAuth();
    const role = ((sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role')) as UserRole) || 'SuperAdmin';
    const cleanPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const firstSeg = cleanPath.split('/').filter(Boolean)[0]?.toLowerCase();
    if (firstSeg === 'superadmin' || firstSeg === 'superamdin') {
      return (!isAuth || role !== 'SuperAdmin') ? 'superadmin' : null;
    }
    if (firstSeg === 'hotelowner') {
      return (!isAuth || role !== 'Owner') ? 'hotelowner' : null;
    }
    if (firstSeg === 'admin') {
      const sp = new URLSearchParams(window.location.search);
      const isImpersonating = isAuth && (role === 'SuperAdmin' || sessionStorage.getItem('pms_role') === 'SuperAdmin' || localStorage.getItem('pms_role') === 'SuperAdmin') && (Boolean(sp.get('hotelId')) || sp.get('asAdmin') === 'true');
      if (isImpersonating) return null;
      return (!isAuth || role === 'SuperAdmin' || role === 'Owner') ? 'admin' : null;
    }
    return null;
  });
  const [notificationPageFilter, setNotificationPageFilter] = useState<'all' | 'unread'>('all');

  // Authentication States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => hasStoredValidAuth());
  const [isRedeemingPosHandoff, setIsRedeemingPosHandoff] = useState<boolean>(() => {
    if (typeof window === 'undefined' || hasStoredValidAuth()) return false;
    return Boolean(new URLSearchParams(window.location.search).get('posHandoff'));
  });
  const [loggedInUser, setLoggedInUser] = useState<string>(() => sessionStorage.getItem('pms_user') || localStorage.getItem('pms_user') || '');
  const [unauthView, setUnauthView] = useState<'front-website' | 'login'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      if (
        searchParams.get('view') === 'login' || 
        searchParams.has('login') || 
        hash === '#login' || 
        hash.includes('login') ||
        path === '/login'
      ) {
        return 'login';
      }
    }
    return 'front-website';
  });
  const [publicSeoPage, setPublicSeoPage] = useState<PublicSeoPageKey>(() => {
    if (typeof window !== 'undefined') {
      return resolvePublicSeoPageFromPath(window.location.pathname).pageKey || 'home';
    }
    return 'home';
  });
  const [selectedBlogSlug, setSelectedBlogSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return resolvePublicSeoPageFromPath(window.location.pathname).blogSlug || null;
    }
    return null;
  });

  // Raw states containing all records across all properties (hydrated synchronously from fast session cache when available)
  const [isInitialHydrating, setIsInitialHydrating] = useState<boolean>(() => hasStoredValidAuth() && !bootSnap);
  const [rawRooms, setRawRooms] = useState<Room[]>(() => (Array.isArray(bootSnap?.rooms) ? bootSnap.rooms : []));
  const [rawBookings, setRawBookings] = useState<Booking[]>(() => (Array.isArray(bootSnap?.bookings) ? bootSnap.bookings : []));
  const [rawCheckins, setRawCheckins] = useState<GuestCheckIn[]>(() => (Array.isArray(bootSnap?.checkins) ? bootSnap.checkins : []));
  const [rawInvoices, setRawInvoices] = useState<Invoice[]>(() => (Array.isArray(bootSnap?.invoices) ? bootSnap.invoices : []));
  const [rawExpenses, setRawExpenses] = useState<Expense[]>(() => (Array.isArray(bootSnap?.expenses) ? bootSnap.expenses : []));
  const [rawHandovers, setRawHandovers] = useState<CashHandover[]>(() => (Array.isArray(bootSnap?.handovers) ? bootSnap.handovers : []));
  const [rawPolicies, setRawPolicies] = useState<HotelPolicy[]>(() => (Array.isArray(bootSnap?.policies) ? bootSnap.policies : []));
  const [rawWaterBottles, setRawWaterBottles] = useState<WaterBottleRecord[]>(() => (Array.isArray(bootSnap?.waterBottles) ? bootSnap.waterBottles : []));
  const [rawStaff, setRawStaff] = useState<Staff[]>(() => (Array.isArray(bootSnap?.staff) ? bootSnap.staff : []));
  const [rawAuditLogs, setRawAuditLogs] = useState<AuditLog[]>(() => (Array.isArray(bootSnap?.auditLogs) ? bootSnap.auditLogs : []));
  const [rawRoomVerifications, setRawRoomVerifications] = useState<RoomVerification[]>(() => (Array.isArray(bootSnap?.roomVerifications) ? bootSnap.roomVerifications : []));
  const [rawRolePermissions, setRawRolePermissions] = useState<RolePermission[]>(() => (Array.isArray(bootSnap?.rolePermissions) ? bootSnap.rolePermissions : []));
  const [rawInventoryProducts, setRawInventoryProducts] = useState<InventoryProduct[]>(() => (Array.isArray(bootSnap?.inventoryProducts) ? bootSnap.inventoryProducts : []));
  const [rawInventoryCategories, setRawInventoryCategories] = useState<InventoryCategory[]>(() => (Array.isArray(bootSnap?.inventoryCategories) ? bootSnap.inventoryCategories : []));
  const [rawInventorySuppliers, setRawInventorySuppliers] = useState<InventorySupplier[]>(() => (Array.isArray(bootSnap?.inventorySuppliers) ? bootSnap.inventorySuppliers : []));
  const [rawInventoryPurchases, setRawInventoryPurchases] = useState<InventoryPurchase[]>(() => (Array.isArray(bootSnap?.inventoryPurchases) ? bootSnap.inventoryPurchases : []));
  const [rawInventoryStockMovements, setRawInventoryStockMovements] = useState<InventoryStockMovement[]>(() => (Array.isArray(bootSnap?.inventoryStockMovements) ? bootSnap.inventoryStockMovements : []));
  const [rawPosItems, setRawPosItems] = useState<PosItem[]>(() => (Array.isArray(bootSnap?.posItems) ? bootSnap.posItems : []));
  const [rawPosOrders, setRawPosOrders] = useState<PosOrder[]>(() => (Array.isArray(bootSnap?.posOrders) ? bootSnap.posOrders : []));
  const [rawPettyCash, setRawPettyCash] = useState<PettyCashTransaction[]>(() => (Array.isArray(bootSnap?.pettyCash) ? bootSnap.pettyCash : []));
  const [rawCashBankAccounts, setRawCashBankAccounts] = useState<CashBankAccount[]>(() => (Array.isArray(bootSnap?.cashBankAccounts) ? bootSnap.cashBankAccounts : []));
  const [rawFinanceVouchers, setRawFinanceVouchers] = useState<FinanceVoucher[]>(() => (Array.isArray(bootSnap?.vouchers) ? bootSnap.vouchers : []));
  const [rawVendors, setRawVendors] = useState<Vendor[]>(() => (Array.isArray(bootSnap?.vendors) ? bootSnap.vendors : []));
  const [rawOwnerPayments, setRawOwnerPayments] = useState<OwnerDirectorPayment[]>(() => (Array.isArray(bootSnap?.ownerPayments) ? bootSnap.ownerPayments : []));
  const [rawReimbursements, setRawReimbursements] = useState<StaffReimbursement[]>(() => (Array.isArray(bootSnap?.reimbursements) ? bootSnap.reimbursements : []));
  const [rawDailyClosings, setRawDailyClosings] = useState<DailyClosingRecord[]>(() => (Array.isArray(bootSnap?.dailyClosings) ? bootSnap.dailyClosings : []));
  const [rawLaundryItems, setRawLaundryItems] = useState<LaundryItemMaster[]>(() => (Array.isArray(bootSnap?.laundryItems) ? bootSnap.laundryItems : []));
  const [rawLaundryOrders, setRawLaundryOrders] = useState<LaundryOrder[]>(() => (Array.isArray(bootSnap?.laundryOrders) ? bootSnap.laundryOrders : []));
  const [rawLostAndFoundItems, setRawLostAndFoundItems] = useState<LostAndFoundItem[]>(() => (Array.isArray(bootSnap?.lostAndFoundItems) ? bootSnap.lostAndFoundItems : []));
  const [rawCleaningLogs, setRawCleaningLogs] = useState<HousekeepingCleaningLog[]>(() => (Array.isArray(bootSnap?.cleaningLogs) ? bootSnap.cleaningLogs : []));
  const [rawDeletedItems, setRawDeletedItems] = useState<DeletedItemRecord[]>(() => (Array.isArray(bootSnap?.deletedItems) ? bootSnap.deletedItems : []));
  const [rawTravelAgents, setRawTravelAgents] = useState<TravelAgent[]>(() => (Array.isArray(bootSnap?.travelAgents) ? bootSnap.travelAgents : []));
  const [rawAgentCommissionPayments, setRawAgentCommissionPayments] = useState<AgentCommissionPayment[]>(() => (Array.isArray(bootSnap?.agentCommissionPayments) ? bootSnap.agentCommissionPayments : []));
  const [rawPosAdvanceBookings, setRawPosAdvanceBookings] = useState<FoodAdvanceBooking[]>(() => (Array.isArray(bootSnap?.posAdvanceBookings) ? bootSnap.posAdvanceBookings : []));
  const [rawPosCategories, setRawPosCategories] = useState<PosCategory[]>(() => (Array.isArray(bootSnap?.posCategories) ? bootSnap.posCategories : []));

  // Derive initial route tab/subtabs synchronously so deep-links & page reloads never flash or redirect to /admin
  const initialRouteInfo = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return { tab: '', sub: '' };
    }
    const cleanPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const segs = cleanPath.split('/').filter(Boolean);
    const root = (segs[0] || '').toLowerCase();
    if (root === 'pos') {
      return { tab: 'pos', sub: mapPosPathToSubTab(cleanPath) };
    }
    if (root === 'admin') {
      const rawTab = segs[1] || 'dashboard';
      const mapped = ADMIN_ROUTE_ALIASES[rawTab] || ADMIN_ROUTE_ALIASES[rawTab.toLowerCase()];
      if (mapped) {
        const sub = segs[2] || mapped.subTab || '';
        if (mapped.tab === 'frontDesk' && sub === 'billing') {
          return { tab: 'invoice', sub: 'all' };
        }
        return { tab: mapped.tab, sub };
      }
    }
    return { tab: '', sub: '' };
  }, []);

  // Module Navigation SubTabs
  const [financeSubTab, setFinanceSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'finance' && initialRouteInfo.sub ? initialRouteInfo.sub : 'dashboard'
  );
  const [frontDeskSubTab, setFrontDeskSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'frontDesk' && initialRouteInfo.sub ? initialRouteInfo.sub : 'dashboard'
  );
  const [guestUserListSubTab, setGuestUserListSubTab] = useState<'directory' | 'documents'>(() =>
    initialRouteInfo.tab === 'userList' && initialRouteInfo.sub === 'documents' ? 'documents' : 'directory'
  );
  const [roomSubTab, setRoomSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'rooms' && initialRouteInfo.sub ? initialRouteInfo.sub : 'dashboard'
  );
  const [housekeepingSubTab, setHousekeepingSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'housekeeping' && initialRouteInfo.sub ? initialRouteInfo.sub : 'dashboard'
  );
  const [posSubTab, setPosSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'pos' && initialRouteInfo.sub ? initialRouteInfo.sub : 'terminal'
  );
  const [inventorySubTab, setInventorySubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'inventory' && initialRouteInfo.sub ? initialRouteInfo.sub : 'dashboard'
  );
  const [otaSubTab, setOtaSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'otaManager' && initialRouteInfo.sub ? initialRouteInfo.sub : 'channels'
  );
  const [reportsSubTab, setReportsSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'reports' && initialRouteInfo.sub ? initialRouteInfo.sub : 'dashboard'
  );
  const [staffSubTab, setStaffSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'staff' && initialRouteInfo.sub ? initialRouteInfo.sub : 'directory'
  );
  const [invoiceSubTab, setInvoiceSubTab] = useState<string>(() =>
    initialRouteInfo.tab === 'invoice' && initialRouteInfo.sub ? initialRouteInfo.sub : 'all'
  );
  const [profileSection, setProfileSection] = useState<
    'general' | 'tax' | 'payment_mode' | 'whatsapp' | 'properties' | 'master' | 'shift' | 'coupons' | 'renewal' | 'compliance'
  >(() => {
    if (initialRouteInfo.tab === 'profile' && initialRouteInfo.sub) {
      return initialRouteInfo.sub as any;
    }
    const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pms_profile_section') : null;
    if (saved) return saved as any;
    return 'tax';
  });

  // Navigation and Role
  const [activeTab, setActiveTab] = useState(() => {
    if (initialRouteInfo.tab) return initialRouteInfo.tab;
    const savedRole = sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role');
    if (savedRole === 'SuperAdmin') return 'superAdminHub';
    if (savedRole === 'Owner') return 'hotelOwnerHub';
    if (savedRole === 'Housekeeping' || savedRole === 'Reception' || savedRole === 'Receptionist') return 'frontDesk';
    return 'dashboard';
  });
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const savedRole = (sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role')) as UserRole;
    if (typeof window !== 'undefined' && savedRole === 'SuperAdmin') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('hotelId') || sp.get('asAdmin') === 'true') return 'Admin';
    }
    return savedRole || 'SuperAdmin';
  });
  const prevRoleRef = React.useRef<UserRole>(currentRole);
  const hasSyncedInitialLocationRef = React.useRef<boolean>(false);

  // Deep Link States
  const [selectedBookingForCheckin, setSelectedBookingForCheckin] = useState<Booking | null>(null);
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<Booking | null>(null);

  // Cloud Sync, Notification Stream & Toast States
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<string>('all');
  const [notificationPage, setNotificationPage] = useState<number>(1);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts((toasts) => setActiveToasts(toasts));
  }, []);

  useEffect(() => {
    const onProfileNav = (e: any) => {
      if (e.detail?.section) {
        setProfileSection(e.detail.section);
      }
    };
    window.addEventListener('directstay:profile-nav', onProfileNav);
    return () => window.removeEventListener('directstay:profile-nav', onProfileNav);
  }, []);

  // Zero-touch live deployment auto-updater: seamlessly loads new frontend builds without manual refresh
  useEffect(() => {
    if (typeof window === 'undefined' || !isBackendServerActive()) return;

    const getLoadedBundleId = (): string => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      for (const s of scripts) {
        const src = s.getAttribute('src') || '';
        const m = src.match(/\/assets\/(index-[^"'\s?]+\.js)/);
        if (m && m[1]) return m[1];
      }
      return '';
    };

    const loadedBundleId = getLoadedBundleId();
    if (!loadedBundleId) return; // Dev mode (Vite HMR handles updates)

    let reloadScheduled = false;
    const performSafeReload = (targetBuildId: string) => {
      if (reloadScheduled) return;
      if (sessionStorage.getItem('pms_auto_reloaded_build') === targetBuildId) return;
      reloadScheduled = true;

      const tryReloadNow = () => {
        if (hasPendingSync()) {
          setTimeout(tryReloadNow, 1500);
          return;
        }
        const activeTag = (document.activeElement?.tagName || '').toUpperCase();
        const isTyping =
          activeTag === 'INPUT' ||
          activeTag === 'TEXTAREA' ||
          activeTag === 'SELECT' ||
          (document.activeElement as HTMLElement | null)?.isContentEditable;
        if (isTyping) {
          window.addEventListener('focusout', () => setTimeout(tryReloadNow, 300), { once: true });
          return;
        }
        sessionStorage.setItem('pms_auto_reloaded_build', targetBuildId);
        window.location.reload();
      };

      tryReloadNow();
    };

    const checkServerBuildVersion = async () => {
      if (reloadScheduled || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/version?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const serverBuildId = String(json?.buildId || '').trim();
        if (serverBuildId && serverBuildId !== loadedBundleId) {
          performSafeReload(serverBuildId);
        }
      } catch {}
    };

    const interval = setInterval(checkServerBuildVersion, 20000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkServerBuildVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkServerBuildVersion);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkServerBuildVersion);
    };
  }, []);

  const refreshNotificationsFromServer = React.useCallback(async () => {
    if (!isAuthenticated || !isBackendServerActive()) return;
    setIsLoadingNotifications(true);
    setNotificationError(null);
    try {
      const res = await fetchNotificationsApi({ page: 1, limit: 100 });
      if (res.success && Array.isArray(res.notifications)) {
        setRawNotifications((prev) => {
          const serverMap = new Map(res.notifications.map((n: AppNotification) => [n.id, n]));
          const merged = [
            ...res.notifications,
            ...prev.filter((p) => !serverMap.has(p.id))
          ];
          savePmsData({ notifications: merged }, true);
          return merged;
        });
      }
    } catch {
      // Quietly fall back to local notifications
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [isAuthenticated, currentRole, selectedHotelId]);

  // Lightweight non-blocking notification polling (avoids holding persistent HTTP/1.1 proxy sockets open across tabs)
  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined' || !isBackendServerActive()) {
      setIsRealtimeConnected(false);
      return;
    }

    setIsRealtimeConnected(true);
    refreshNotificationsFromServer();

    const fallbackPoll = setInterval(() => {
      if (isBackendServerActive() && document.visibilityState === 'visible') {
        refreshNotificationsFromServer();
      }
    }, 20000);

    return () => {
      clearInterval(fallbackPoll);
      setIsRealtimeConnected(false);
    };
  }, [isAuthenticated, currentRole, selectedHotelId, refreshNotificationsFromServer]);

  const emitNotification = (params: {
    hotelId: string;
    recipientRole: 'SuperAdmin' | 'Admin' | 'Owner' | 'All';
    title: string;
    message: string;
    type: NotificationEventType;
    severity?: 'info' | 'success' | 'warning' | 'error';
    linkPath?: string;
    entityId?: string;
    dedupeKey?: string;
  }) => {
    const dedupeKey =
      params.dedupeKey ||
      `${params.hotelId}:${params.recipientRole}:${params.type}:${params.entityId || ''}:${params.title}`;

    const newNotif: AppNotification = {
      id: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hotelId: params.hotelId,
      recipientRole: params.recipientRole,
      title: params.title,
      message: params.message,
      type: params.type,
      severity: params.severity || 'info',
      isRead: false,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      linkPath: params.linkPath,
      entityId: params.entityId,
      dedupeKey,
    };

    setRawNotifications(prev => {
      if (prev.some(n => n.dedupeKey && n.dedupeKey === dedupeKey)) {
        return prev;
      }
      const updated = [newNotif, ...prev];
      savePmsData({ notifications: updated }, true);
      return updated;
    });

    // Persist & broadcast via centralized backend notification service
    createNotificationApi({
      id: newNotif.id,
      hotelId: newNotif.hotelId,
      recipientRole: newNotif.recipientRole,
      title: newNotif.title,
      message: newNotif.message,
      type: newNotif.type,
      severity: newNotif.severity,
      linkPath: newNotif.linkPath,
      entityId: newNotif.entityId,
      dedupeKey,
    }).catch(() => {});
  };

  const handleMarkNotificationAsRead = (notificationId: string) => {
    setRawNotifications(prev => {
      const updated = prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n);
      savePmsData({ notifications: updated });
      return updated;
    });
    markNotificationReadApi(notificationId).catch(() => {});
  };

  const handleMarkAllNotificationsAsRead = () => {
    setRawNotifications(prev => {
      const visibleIds = new Set(
        filterNotificationsForRoleAndHotel(prev, currentRole, selectedHotelId).map(n => n.id)
      );
      const updated = prev.map(n => visibleIds.has(n.id) ? { ...n, isRead: true } : n);
      savePmsData({ notifications: updated });
      return updated;
    });
    markAllNotificationsReadApi().catch(() => {});
    showToast('All notifications marked as read', 'success');
  };


  const applyAllPmsData = (data: Record<string, any>, isClear = false) => {
    if (data && (Array.isArray(data.hotels) || data.systemWebsite || Array.isArray(data.bookings) || Array.isArray(data.rooms))) {
      markDbHydrated(true);
      if (!isClear) {
        writeFastSessionSnapshot(data);
        setIsInitialHydrating(false);
      }
    }
    if (Array.isArray(data.hotels)) {
      setHotels(data.hotels);
      if (data.hotels.length > 0) {
        setSelectedHotelId(prev =>
          data.hotels.some((h: Hotel) => h.id === prev) ? prev : data.hotels[0].id
        );
      }
    }
    if (Array.isArray(data.packages) && data.packages.length > 0) setPackages(data.packages);
    if (Array.isArray(data.customPages)) setCustomPages(data.customPages);
    if (Array.isArray(data.rooms)) {
      const cleanedRooms = data.rooms.filter((r: Room) =>
        !(
          !r.bedType &&
          !r.floor &&
          ((r.category === 'Standard' && r.rate === 1800 && r.extraPersonCharge === 400) ||
            (r.category === 'Deluxe' && r.rate === 3500 && r.extraPersonCharge === 600) ||
            (r.category === 'Executive Suite' && r.rate === 6500 && r.extraPersonCharge === 1000) ||
            (r.category === 'Presidential Suite' && r.rate === 12000 && r.extraPersonCharge === 1500))
        )
      );
      setRawRooms(cleanedRooms);
      if (cleanedRooms.length !== data.rooms.length) {
        savePmsData({ rooms: cleanedRooms }, true);
      }
    }
    if (Array.isArray(data.bookings)) setRawBookings(data.bookings);
    if (Array.isArray(data.checkins)) setRawCheckins(data.checkins);
    if (Array.isArray(data.invoices)) setRawInvoices(data.invoices);
    if (Array.isArray(data.expenses)) setRawExpenses(data.expenses);
    if (Array.isArray(data.handovers)) setRawHandovers(data.handovers);
    if (Array.isArray(data.policies)) setRawPolicies(data.policies);
    if (Array.isArray(data.waterBottles)) setRawWaterBottles(data.waterBottles);
    if (Array.isArray(data.staff)) setRawStaff(data.staff);
    if (Array.isArray(data.auditLogs)) setRawAuditLogs(data.auditLogs);
    if (Array.isArray(data.roomVerifications)) setRawRoomVerifications(data.roomVerifications);
    if (Array.isArray(data.rolePermissions) && data.rolePermissions.length > 0) setRawRolePermissions(data.rolePermissions);
    if (Array.isArray(data.inventoryProducts)) {
      let prods = [...data.inventoryProducts];
      const hasWater = prods.some(p => p.name?.toLowerCase().includes('water') || p.name?.toLowerCase().includes('mineral'));
      if (!hasWater) {
        prods = [
          {
            id: 'inv-prod-water-1',
            hotelId: data.hotelSettings?.id || 'hotel-1',
            name: 'Packaged Drinking Water (1L)',
            category: 'Housekeeping / F&B',
            sku: 'WATER-1L',
            unit: 'Bottles',
            currentStock: 0,
            minStockAlert: 5,
            costPrice: 0,
            sellingPrice: 0,
            supplierName: '',
            lastRestockedDate: new Date().toISOString().split('T')[0],
          },
          ...prods,
        ];
      }
      setRawInventoryProducts(prods);
    }
    if (Array.isArray(data.inventoryCategories) && data.inventoryCategories.length > 0) setRawInventoryCategories(data.inventoryCategories);
    if (Array.isArray(data.inventorySuppliers)) setRawInventorySuppliers(data.inventorySuppliers);
    if (Array.isArray(data.inventoryPurchases)) setRawInventoryPurchases(data.inventoryPurchases);
    if (Array.isArray(data.inventoryStockMovements)) setRawInventoryStockMovements(data.inventoryStockMovements);
    if (Array.isArray(data.posItems)) setRawPosItems(data.posItems);
    if (Array.isArray(data.posOrders)) setRawPosOrders(data.posOrders);
    if (Array.isArray(data.pettyCash)) setRawPettyCash(data.pettyCash);
    if (Array.isArray(data.cashBankAccounts)) setRawCashBankAccounts(data.cashBankAccounts);
    if (Array.isArray(data.vouchers)) setRawFinanceVouchers(data.vouchers);
    if (Array.isArray(data.vendors)) setRawVendors(data.vendors);
    if (Array.isArray(data.ownerPayments)) setRawOwnerPayments(data.ownerPayments);
    if (Array.isArray(data.reimbursements)) setRawReimbursements(data.reimbursements);
    if (Array.isArray(data.dailyClosings)) setRawDailyClosings(data.dailyClosings);
    if (Array.isArray(data.laundryItems) && data.laundryItems.length > 0) setRawLaundryItems(data.laundryItems);
    if (Array.isArray(data.laundryOrders)) setRawLaundryOrders(data.laundryOrders);
    if (Array.isArray(data.lostAndFoundItems)) setRawLostAndFoundItems(data.lostAndFoundItems);
    if (Array.isArray(data.cleaningLogs)) setRawCleaningLogs(data.cleaningLogs);
    if (data.systemWebsite) setSystemWebsite({ ...INITIAL_SYSTEM_WEBSITE, ...data.systemWebsite });
    if (Array.isArray(data.notifications)) setRawNotifications(data.notifications);
    if (Array.isArray(data.deletedItems)) setRawDeletedItems(data.deletedItems);
    if (Array.isArray(data.travelAgents)) setRawTravelAgents(data.travelAgents);
    if (Array.isArray(data.agentCommissionPayments)) setRawAgentCommissionPayments(data.agentCommissionPayments);
    if (Array.isArray(data.posAdvanceBookings)) setRawPosAdvanceBookings(data.posAdvanceBookings);
    if (Array.isArray(data.posCategories)) setRawPosCategories(data.posCategories);
  };

  const handleClearCacheAndSync = async () => {
    setIsSyncingCloud(true);
    setSyncToastMessage(null);
    try {
      const cloudData = await fetchAllFromSupabase();
      if (cloudData && Object.keys(cloudData).length > 0) {
        savePmsData(cloudData, true);
        applyAllPmsData(cloudData);
        setSyncToastMessage('Latest MongoDB Atlas Cloud database data synchronized.');
      } else {
        const currentState = getPmsData();
        await syncAllToSupabase(currentState);
        setSyncToastMessage('Database state synchronized to MongoDB Atlas Cloud.');
      }
    } catch (e) {
      setSyncToastMessage('Database state refreshed.');
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setSyncToastMessage(null), 4500);
    }
  };

  // Evaluate and apply browser URL route
  const syncStateFromLocation = (pathInput?: string, authOverride?: boolean, roleOverride?: UserRole) => {
    if (typeof window === 'undefined') return;
    const isAuth = authOverride !== undefined ? authOverride : hasStoredValidAuth();
    const role = (roleOverride || (sessionStorage.getItem('pms_role') as UserRole) || (localStorage.getItem('pms_role') as UserRole) || 'SuperAdmin') as UserRole;

    const rawPath = pathInput ?? window.location.pathname;
    const cleanPath = (rawPath || '/').replace(/\/+$/, '') || '/';
    const segments = cleanPath.split('/').filter(Boolean);
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.toLowerCase();
    const hasLoginQuery = searchParams.get('view') === 'login' || searchParams.has('login') || hash === '#login' || hash.includes('login');
    const hotelBookingQuery = searchParams.get('hotelBooking');
    const digitalMenuQuery = searchParams.get('digitalMenu');

    // Direct Hotel Digital Menu Page (`/?digitalMenu=<id>`, `/digital-menu/<id>`, `/menu/<id>`)
    if (
      digitalMenuQuery !== null ||
      segments[0]?.toLowerCase() === 'digital-menu' ||
      segments[0]?.toLowerCase() === 'menu'
    ) {
      const targetMenuHotelId = digitalMenuQuery || segments[1] || selectedHotelId || 'hotel-1';
      setIsNotFoundRoute(false);
      setPortalLoginMode(null);
      setPublicDigitalMenuHotelId(targetMenuHotelId);
      return;
    } else {
      setPublicDigitalMenuHotelId(null);
    }

    // Direct Hotel Booking Page (`/?hotelBooking=<id>` or `/book/<id>`)
    if (hotelBookingQuery || (segments[0]?.toLowerCase() === 'book' && segments[1])) {
      const targetBookHotelId = hotelBookingQuery || segments[1];
      setIsNotFoundRoute(false);
      setPortalLoginMode(null);
      setPublicHotelBookingId(targetBookHotelId);
      return;
    } else {
      setPublicHotelBookingId(null);
    }

    // 1. Root '/' or '/login' or '/prototype'
    if (segments[0]?.toLowerCase() === 'prototype' || segments[0]?.toLowerCase() === 'mobile-prototype') {
      setIsNotFoundRoute(false);
      setPortalLoginMode(null);
      setIsPrototypeWebsite(true);
      sessionStorage.setItem('pms_website_prototype', 'true');
      const subPath = '/' + segments.slice(1).join('/');
      const protoSeoRoute = segments.length > 1 ? resolvePublicSeoPageFromPath(subPath) : null;
      setPublicSeoPage(protoSeoRoute?.pageKey || 'home');
      if (!isAuth) {
        setUnauthView('front-website');
        setIsPublicWebsiteForced(false);
      } else {
        setIsPublicWebsiteForced(true);
      }
      return;
    }

    if (segments.length === 0) {
      setIsNotFoundRoute(false);
      setPortalLoginMode(null);
      setIsPrototypeWebsite(true);
      setPublicSeoPage('home');
      if (hasLoginQuery) {
        if (isAuth) {
          const target = getRoleBasePath(role);
          window.history.replaceState({}, '', target);
          setIsPublicWebsiteForced(false);
          syncStateFromLocation(target, isAuth, role);
        } else {
          window.history.replaceState({}, '', '/login');
          setUnauthView('login');
        }
        return;
      }
      if (window.location.hash) {
        window.history.replaceState({}, '', '/');
      }
      if (!isAuth) {
        setUnauthView('front-website');
        setIsPublicWebsiteForced(false);
      } else {
        setIsPublicWebsiteForced(true);
      }
      return;
    }

    // 1b. Public SEO Pages (/features/, /pricing/, /free-trial/, /hotel-reservation-software/, /hotel-billing-software/, /about/, /contact/, /gallery/, /privacy-policy/, /blog/, /blog/:slug, etc.)
    const seoRoute = resolvePublicSeoPageFromPath(cleanPath);
    if (seoRoute.pageKey) {
      setIsNotFoundRoute(false);
      setPortalLoginMode(null);
      setIsPrototypeWebsite(true);
      setPublicSeoPage(seoRoute.pageKey);
      if (seoRoute.blogSlug) {
        setSelectedBlogSlug(seoRoute.blogSlug);
      } else if (seoRoute.pageKey === 'blog') {
        setSelectedBlogSlug(null);
      }
      if (seoRoute.redirectToPath) {
        window.history.replaceState({}, '', seoRoute.redirectToPath);
      }
      if (seoRoute.pageKey === 'pricing') {
        trackSeoConversionEvent('pricing_page_view', { pagePath: PUBLIC_SEO_PAGES.pricing.path });
      }
      if (!isAuth) {
        setUnauthView('front-website');
        setIsPublicWebsiteForced(false);
      } else {
        setIsPublicWebsiteForced(true);
      }
      return;
    }

    if (segments[0].toLowerCase() === 'login' && segments.length === 1) {
      setIsNotFoundRoute(false);
      setIsPublicWebsiteForced(false);
      setPortalLoginMode('general');
      setUnauthView('login');
      return;
    }

    let rootSeg = segments[0].toLowerCase();
    if (rootSeg === 'superamdin') {
      const normalized = ['/superadmin', ...segments.slice(1)].join('/');
      window.history.replaceState({}, '', normalized);
      rootSeg = 'superadmin';
    }

    if (rootSeg === 'superadmin') {
      if (segments.length > 2) {
        setIsNotFoundRoute(true);
        setPortalLoginMode(null);
        return;
      }
      const rawSub = (segments[1] || 'dashboard').toLowerCase();
      const mappedSub = SUPERADMIN_ROUTE_ALIASES[rawSub];
      if (!mappedSub) {
        setIsNotFoundRoute(true);
        setPortalLoginMode(null);
        return;
      }
      setIsNotFoundRoute(false);
      setIsPublicWebsiteForced(false);

      if (mappedSub === 'profile') {
        setActiveTab('profile');
      } else if (mappedSub === 'notifications') {
        setActiveTab('notifications');
      } else {
        setActiveTab('superAdminHub');
        setSuperAdminSubTab(mappedSub);
      }

      if (!isAuth || role !== 'SuperAdmin') {
        setPortalLoginMode('superadmin');
        return;
      }
      setPortalLoginMode(null);
      return;
    }

    if (rootSeg === 'hotelowner') {
      if (segments.length > 2) {
        setIsNotFoundRoute(true);
        setPortalLoginMode(null);
        return;
      }
      const rawSub = segments[1] || 'dashboard';
      const mappedSub = OWNER_ROUTE_ALIASES[rawSub] || OWNER_ROUTE_ALIASES[rawSub.toLowerCase()];
      if (!mappedSub) {
        setIsNotFoundRoute(true);
        setPortalLoginMode(null);
        return;
      }
      setIsNotFoundRoute(false);
      setIsPublicWebsiteForced(false);

      if (mappedSub === 'profile') {
        setActiveTab('profile');
      } else if (mappedSub === 'notifications') {
        setActiveTab('notifications');
      } else {
        setActiveTab('hotelOwnerHub');
        setOwnerSubTab(mappedSub);
      }

      if (!isAuth || role !== 'Owner') {
        setPortalLoginMode('hotelowner');
        return;
      }
      setPortalLoginMode(null);
      return;
    }

    if (rootSeg === 'pos') {
      const mappedPosSub = mapPosPathToSubTab(cleanPath);
      const queryHotelId = searchParams.get('hotelId');
      const hasHandoffParam = Boolean(searchParams.get('posHandoff'));
      if (queryHotelId) {
        setSelectedHotelId(queryHotelId);
        sessionStorage.setItem('pms_hotel_id', queryHotelId);
        localStorage.setItem('pms_hotel_id', queryHotelId);
      }
      setIsNotFoundRoute(false);
      setIsPublicWebsiteForced(false);
      setIsStandalonePosMode(true);
      setActiveTab('pos');
      setPosSubTab(mappedPosSub);
      if (!isAuth && !hasHandoffParam) {
        setPortalLoginMode('admin');
        return;
      }
      setPortalLoginMode(null);
      return;
    }

    setIsStandalonePosMode(false);

    if (rootSeg === 'admin') {
      if (segments.length > 3) {
        setIsNotFoundRoute(true);
        setPortalLoginMode(null);
        return;
      }
      const rawTab = segments[1] || 'dashboard';
      const mapped = ADMIN_ROUTE_ALIASES[rawTab] || ADMIN_ROUTE_ALIASES[rawTab.toLowerCase()];
      if (!mapped) {
        setIsNotFoundRoute(true);
        setPortalLoginMode(null);
        return;
      }
      const sub = segments[2] || mapped.subTab;
      setIsNotFoundRoute(false);
      setIsPublicWebsiteForced(false);

      if (mapped.tab === 'frontDesk' && sub === 'billing') {
        setActiveTab('invoice');
        setFrontDeskSubTab('billing');
      } else {
        setActiveTab(mapped.tab);
        if (mapped.tab === 'frontDesk') setFrontDeskSubTab(sub || 'dashboard');
        if (mapped.tab === 'userList') setGuestUserListSubTab((sub as any) === 'documents' ? 'documents' : 'directory');
        if (mapped.tab === 'finance') setFinanceSubTab(sub || 'dashboard');
        if (mapped.tab === 'invoice' && sub) setInvoiceSubTab(sub);
        if (mapped.tab === 'rooms' && sub) setRoomSubTab(sub);
        if (mapped.tab === 'housekeeping' && sub) setHousekeepingSubTab(sub);
        if (mapped.tab === 'pos' && sub) setPosSubTab(sub === 'billing' ? 'terminal' : sub);
        if (mapped.tab === 'inventory' && sub) setInventorySubTab(sub);
        if (mapped.tab === 'otaManager' && sub) setOtaSubTab(sub);
        if (mapped.tab === 'reports' && sub) setReportsSubTab(sub);
        if (mapped.tab === 'staff' && sub) setStaffSubTab(sub);
        if (mapped.tab === 'profile' && sub) setProfileSection(sub as any);
      }

      const queryHotelId = searchParams.get('hotelId');
      if (queryHotelId) {
        setSelectedHotelId(queryHotelId);
        sessionStorage.setItem('pms_hotel_id', queryHotelId);
      }

      const isSuperAdminImpersonating = isAuth && (role === 'SuperAdmin' || sessionStorage.getItem('pms_role') === 'SuperAdmin' || localStorage.getItem('pms_role') === 'SuperAdmin') && (Boolean(queryHotelId) || searchParams.get('asAdmin') === 'true');

      if (isSuperAdminImpersonating) {
        setCurrentRole('Admin');
        setPortalLoginMode(null);
        return;
      }

      if (!isAuth || role === 'SuperAdmin' || role === 'Owner') {
        setPortalLoginMode('admin');
        return;
      }
      setPortalLoginMode(null);
      return;
    }

    setPortalLoginMode(null);
    setIsNotFoundRoute(true);
  };

  // Load state on mount
  useEffect(() => {
    const data = getPmsData();
    applyAllPmsData(data);

    const validSession = hasStoredValidAuth();
    const token = getStoredAuthToken();
    if (validSession && token) {
      setIsAuthenticated(true);
      sessionStorage.setItem('pms_session_token', token);
      sessionStorage.setItem('pms_auth_token', token);
      sessionStorage.setItem('pms_authenticated', 'true');
      const u = sessionStorage.getItem('pms_user') || localStorage.getItem('pms_user');
      if (u) setLoggedInUser(u);
    } else {
      setIsAuthenticated(false);
    }

    const searchParams = new URLSearchParams(window.location.search);
    const queryHotelId = searchParams.get('hotelId');
    const posHandoffParam = searchParams.get('posHandoff');
    if (queryHotelId) {
      setSelectedHotelId(queryHotelId);
      sessionStorage.setItem('pms_hotel_id', queryHotelId);
    }

    const savedRole = (sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role')) as UserRole;
    if (validSession && savedRole === 'SuperAdmin' && queryHotelId) {
      prevRoleRef.current = 'Admin';
      setCurrentRole('Admin');
    } else if (validSession && savedRole) {
      prevRoleRef.current = savedRole;
      setCurrentRole(savedRole);
    }

    syncStateFromLocation(undefined, validSession || Boolean(posHandoffParam), savedRole);
    hasSyncedInitialLocationRef.current = true;

    // Fetch remote data depending on whether an authenticated session token exists
    if (isBackendServerActive()) {
      if (validSession && token) {
        if (posHandoffParam) {
          searchParams.delete('posHandoff');
          const cleanQs = searchParams.toString();
          window.history.replaceState({}, '', `${window.location.pathname}${cleanQs ? `?${cleanQs}` : ''}`);
        }
        void prefetchPosHandoffCode(queryHotelId || selectedHotelId);
        fetchAllFromSupabase()
          .then(cloudData => {
            if (cloudData && Object.keys(cloudData).length > 0) {
              savePmsData(cloudData, true);
              applyAllPmsData(cloudData);
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsInitialHydrating(false);
          });
      } else if (posHandoffParam) {
        searchParams.delete('posHandoff');
        const cleanQs = searchParams.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${cleanQs ? `?${cleanQs}` : ''}`);
        fetch('/api/auth/pos-handoff/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handoffCode: posHandoffParam }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then(redeemed => {
            if (redeemed?.success && redeemed?.token) {
              const rRole = (redeemed.role === 'SuperAdmin' && queryHotelId ? 'Admin' : redeemed.role || 'Admin') as UserRole;
              const rHotel = queryHotelId || redeemed.hotelId || 'hotel-1';
              const rUser = redeemed.username || 'Admin';
              for (const store of [sessionStorage, localStorage]) {
                store.setItem('pms_authenticated', 'true');
                store.setItem('pms_session_token', redeemed.token);
                store.setItem('pms_auth_token', redeemed.token);
                store.setItem('pms_role', rRole);
                store.setItem('pms_user', rUser);
                store.setItem('pms_hotel_id', rHotel);
              }
              prevRoleRef.current = rRole;
              setCurrentRole(rRole);
              setLoggedInUser(rUser);
              setSelectedHotelId(rHotel);
              setIsAuthenticated(true);
              setPortalLoginMode(null);
              setIsInitialHydrating(true);
              void prefetchPosHandoffCode(rHotel);
              return fetchAllFromSupabase().then(cloudData => {
                if (cloudData && Object.keys(cloudData).length > 0) {
                  savePmsData(cloudData, true);
                  applyAllPmsData(cloudData);
                }
              });
            } else {
              setPortalLoginMode('admin');
            }
          })
          .catch(() => {
            setPortalLoginMode('admin');
          })
          .finally(() => {
            setIsRedeemingPosHandoff(false);
            setIsInitialHydrating(false);
          });
      } else {
        fetchPublicWebsiteConfig().then(pubConfig => {
          if (pubConfig) {
            if (pubConfig.systemWebsite) {
              setSystemWebsite({ ...INITIAL_SYSTEM_WEBSITE, ...pubConfig.systemWebsite });
            }
            if (Array.isArray(pubConfig.customPages)) {
              setCustomPages(pubConfig.customPages);
            }
            if (Array.isArray(pubConfig.packages) && pubConfig.packages.length > 0) {
              setPackages(pubConfig.packages);
            }
          }
        }).catch(() => {});
      }
    }

    // Listen to hash, popstate, and cross-tab storage/focus changes so 2 tabs can test simultaneously
    const handleUrlChange = () => {
      syncStateFromLocation();
    };
    let lastCrossTabSyncAt = 0;
    const handleCrossTabSync = () => {
      const now = Date.now();
      if (now - lastCrossTabSyncAt < 15000) return;
      if (hasPendingSync()) return;
      if (isBackendServerActive()) {
        const hasToken = Boolean(
          sessionStorage.getItem('pms_session_token') || sessionStorage.getItem('pms_auth_token')
        );
        if (hasToken) {
          lastCrossTabSyncAt = now;
          fetchAllFromSupabase()
            .then(cloudData => {
              if (hasPendingSync()) return;
              if (cloudData && Object.keys(cloudData).length > 0) {
                savePmsData(cloudData, true);
                applyAllPmsData(cloudData);
              }
            })
            .catch(() => {});
        }
      }
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('storage', handleCrossTabSync);
    window.addEventListener('focus', handleCrossTabSync);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('storage', handleCrossTabSync);
      window.removeEventListener('focus', handleCrossTabSync);
    };
  }, []);

  // Keep browser URL synchronized with active dashboard navigation state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasSyncedInitialLocationRef.current) return;
    if (isNotFoundRoute || isPublicWebsiteForced || publicHotelBookingId !== null || portalLoginMode !== null) return;

    const currentCleanPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const firstSeg = currentCleanPath.split('/').filter(Boolean)[0]?.toLowerCase();

    if (!isAuthenticated) {
      if (
        firstSeg === 'superadmin' ||
        firstSeg === 'superamdin' ||
        firstSeg === 'admin' ||
        firstSeg === 'hotelowner' ||
        firstSeg === 'pos'
      ) {
        return;
      }
      if (unauthView === 'login') {
        if (currentCleanPath !== '/login') {
          window.history.pushState({}, '', '/login');
        }
        return;
      }
      if (
        firstSeg === 'prototype' ||
        firstSeg === 'mobile-prototype' ||
        Boolean(resolvePublicSeoPageFromPath(currentCleanPath).pageKey)
      ) {
        return;
      }
      if (currentCleanPath !== '/') {
        window.history.pushState({}, '', '/');
      }
      return;
    }

    let targetPath = '/admin';
    if (isStandalonePosMode && activeTab === 'pos') {
      targetPath = mapPosSubTabToPath(posSubTab);
    } else if (currentRole === 'SuperAdmin') {
      if (activeTab === 'profile') {
        targetPath = '/superadmin/profile';
      } else if (activeTab === 'notifications') {
        targetPath = '/superadmin/notifications';
      } else {
        if (superAdminSubTab === 'packages' && currentCleanPath === '/superadmin/subscriptions') {
          targetPath = '/superadmin/subscriptions';
        } else if (superAdminSubTab === 'website' && currentCleanPath === '/superadmin/website-cms') {
          targetPath = '/superadmin/website-cms';
        } else if (superAdminSubTab === 'dashboard' && currentCleanPath === '/superadmin/dashboard') {
          targetPath = '/superadmin/dashboard';
        } else {
          targetPath = superAdminSubTab === 'dashboard' ? '/superadmin' : `/superadmin/${superAdminSubTab}`;
        }
      }
    } else if (currentRole === 'Owner') {
      if (activeTab === 'profile') {
        targetPath = '/hotelowner/profile';
      } else if (activeTab === 'notifications') {
        targetPath = '/hotelowner/notifications';
      } else {
        if (ownerSubTab === 'financials' && currentCleanPath === '/hotelowner/finances') {
          targetPath = '/hotelowner/finances';
        } else if (ownerSubTab === 'occupancy' && currentCleanPath === '/hotelowner/reports') {
          targetPath = '/hotelowner/reports';
        } else if (ownerSubTab === 'dashboard' && currentCleanPath === '/hotelowner/dashboard') {
          targetPath = '/hotelowner/dashboard';
        } else {
          targetPath = ownerSubTab === 'dashboard' ? '/hotelowner' : `/hotelowner/${ownerSubTab}`;
        }
      }
    } else {
      if (activeTab === 'dashboard') {
        targetPath = currentCleanPath === '/admin/dashboard' ? '/admin/dashboard' : '/admin';
      } else if (activeTab === 'bookings' && currentCleanPath === '/admin/reservations') {
        targetPath = '/admin/reservations';
      } else if (activeTab === 'checkin' && currentCleanPath === '/admin/check-in') {
        targetPath = '/admin/check-in';
      } else if (activeTab === 'invoice' && currentCleanPath === '/admin/billing') {
        targetPath = '/admin/billing';
      } else if (activeTab === 'frontDesk') {
        if (frontDeskSubTab === 'checkout' && (currentCleanPath === '/admin/check-out' || currentCleanPath === '/admin/checkout')) {
          targetPath = currentCleanPath;
        } else {
          targetPath = frontDeskSubTab && frontDeskSubTab !== 'dashboard'
            ? `/admin/frontDesk/${frontDeskSubTab}`
            : '/admin/frontDesk';
        }
      } else if (activeTab === 'finance') {
        targetPath = financeSubTab && financeSubTab !== 'dashboard'
          ? `/admin/finance/${financeSubTab}`
          : '/admin/finance';
      } else if (activeTab === 'rooms') {
        targetPath = roomSubTab && roomSubTab !== 'dashboard'
          ? `/admin/rooms/${roomSubTab}`
          : '/admin/rooms';
      } else if (activeTab === 'staff') {
        targetPath = staffSubTab && staffSubTab !== 'directory'
          ? `/admin/staff/${staffSubTab}`
          : '/admin/staff';
      } else if (activeTab === 'profile') {
        targetPath = profileSection && profileSection !== 'general'
          ? `/admin/profile/${profileSection}`
          : '/admin/profile';
      } else if (VALID_ADMIN_TABS.has(activeTab)) {
        targetPath = `/admin/${activeTab}`;
      } else {
        targetPath = '/admin';
      }
    }

    if (currentCleanPath !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [isAuthenticated, unauthView, currentRole, activeTab, superAdminSubTab, ownerSubTab, frontDeskSubTab, financeSubTab, roomSubTab, staffSubTab, posSubTab, profileSection, isStandalonePosMode, isNotFoundRoute, isPublicWebsiteForced, publicHotelBookingId, portalLoginMode]);

  const handleUpdatePackages = (updatedPackages: SaaSPackage[]) => {
    setPackages(updatedPackages);
    savePmsData({ packages: updatedPackages });
    handleAddAuditLogDirectly(
      'SaaS Packages Updated',
      `Updated SaaS subscription packages catalog (${updatedPackages.length} active packages).`
    );
  };

  const handleUpdateCustomPages = (updatedPages: CustomPage[]) => {
    setCustomPages(updatedPages);
    savePmsData({ customPages: updatedPages });
    handleAddAuditLogDirectly(
      'CMS Custom Pages Updated',
      `Updated platform CMS custom pages (${updatedPages.length} pages).`
    );
  };

  const handleUpdateInventoryProducts = (updatedProds: InventoryProduct[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const otherProds = rawInventoryProducts.filter(p => (p.hotelId || 'hotel-1') !== targetHotel);
    const newRaw = [...otherProds, ...updatedProds.map(p => ({ ...p, hotelId: p.hotelId || targetHotel }))];
    setRawInventoryProducts(newRaw);
    savePmsData({ inventoryProducts: newRaw });
  };

  const handleUpdateInventoryCategories = (updatedCats: InventoryCategory[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const otherCats = rawInventoryCategories.filter(c => (c.hotelId || 'hotel-1') !== targetHotel);
    const newRaw = [...otherCats, ...updatedCats.map(c => ({ ...c, hotelId: c.hotelId || targetHotel }))];
    setRawInventoryCategories(newRaw);
    savePmsData({ inventoryCategories: newRaw });
  };

  const handleUpdateInventorySuppliers = (updatedSups: InventorySupplier[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const otherSups = rawInventorySuppliers.filter(s => (s.hotelId || 'hotel-1') !== targetHotel);
    const newRaw = [...otherSups, ...updatedSups.map(s => ({ ...s, hotelId: s.hotelId || targetHotel }))];
    setRawInventorySuppliers(newRaw);
    savePmsData({ inventorySuppliers: newRaw });
  };

  const handleUpdateInventoryPurchases = (updatedPurs: InventoryPurchase[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const otherPurs = rawInventoryPurchases.filter(p => (p.hotelId || 'hotel-1') !== targetHotel);
    const newRaw = [...otherPurs, ...updatedPurs.map(p => ({ ...p, hotelId: p.hotelId || targetHotel }))];
    setRawInventoryPurchases(newRaw);
    savePmsData({ inventoryPurchases: newRaw });
  };

  const handleUpdateInventoryMovements = (updatedMovs: InventoryStockMovement[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const otherMovs = rawInventoryStockMovements.filter(m => (m.hotelId || 'hotel-1') !== targetHotel);
    const newRaw = [...otherMovs, ...updatedMovs.map(m => ({ ...m, hotelId: m.hotelId || targetHotel }))];
    setRawInventoryStockMovements(newRaw);
    savePmsData({ inventoryStockMovements: newRaw });
  };

  const handleUpdatePosItems = (updatedItems: PosItem[]) => {
    const targetHotelId = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const otherItems = rawPosItems.filter(i => (i.hotelId || 'hotel-1') !== targetHotelId);
    const newRaw = [...otherItems, ...updatedItems.map(i => ({ ...i, hotelId: i.hotelId || targetHotelId }))];
    setRawPosItems(newRaw);
    savePmsData({ posItems: newRaw });
  };

  const handleUpdatePosOrders = (updatedOrders: PosOrder[]) => {
    const targetHotelId = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const otherOrders = rawPosOrders.filter(o => (o.hotelId || 'hotel-1') !== targetHotelId);
    const newRaw = [...otherOrders, ...updatedOrders.map(o => ({ ...o, hotelId: o.hotelId || targetHotelId }))];
    setRawPosOrders(newRaw);
    savePmsData({ posOrders: newRaw });
  };

  const handleUpdatePettyCash = (updated: PettyCashTransaction[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const other = rawPettyCash.filter(p => (p.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(p => ({ ...p, hotelId: p.hotelId || targetHotel }))];
    setRawPettyCash(merged);
    savePmsData({ pettyCash: merged });
  };

  const handleUpdateCashBankAccounts = (updated: CashBankAccount[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const other = rawCashBankAccounts.filter(a => (a.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(a => ({ ...a, hotelId: a.hotelId || targetHotel }))];
    setRawCashBankAccounts(merged);
    savePmsData({ cashBankAccounts: merged });
  };

  const handleUpdateVouchers = (updated: FinanceVoucher[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const other = rawFinanceVouchers.filter(v => (v.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(v => ({ ...v, hotelId: v.hotelId || targetHotel }))];
    setRawFinanceVouchers(merged);
    savePmsData({ vouchers: merged });
  };

  const handleUpdateVendors = (updated: Vendor[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const other = rawVendors.filter(v => (v.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(v => ({ ...v, hotelId: v.hotelId || targetHotel }))];
    setRawVendors(merged);
    savePmsData({ vendors: merged });
  };

  const handleUpdateOwnerPayments = (updated: OwnerDirectorPayment[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const prevIds = new Set(rawOwnerPayments.map(o => o.id));
    const newEntry = updated.find(o => !prevIds.has(o.id));
    if (newEntry) {
      emitNotification({
        hotelId: newEntry.hotelId || targetHotel,
        recipientRole: 'Owner',
        title: `Owner Ledger Entry: ${newEntry.type}`,
        message: `₹${Math.abs(newEntry.amount || 0).toLocaleString('en-IN')} recorded under "${newEntry.type}" (${newEntry.paymentMethod}).`,
        type: 'payment',
        severity: 'success',
        linkPath: '/hotelowner/financials',
        entityId: newEntry.id,
        dedupeKey: `${newEntry.hotelId || targetHotel}:owner_payment:${newEntry.id}`,
      });
      showToast('Owner ledger entry saved successfully', 'success');
    }
    const other = rawOwnerPayments.filter(o => (o.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(o => ({ ...o, hotelId: o.hotelId || targetHotel }))];
    setRawOwnerPayments(merged);
    savePmsData({ ownerPayments: merged });
  };

  const handleUpdateReimbursements = (updated: StaffReimbursement[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const other = rawReimbursements.filter(r => (r.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(r => ({ ...r, hotelId: r.hotelId || targetHotel }))];
    setRawReimbursements(merged);
    savePmsData({ reimbursements: merged });
  };

  const handleUpdateDailyClosings = (updated: DailyClosingRecord[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const other = rawDailyClosings.filter(d => (d.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(d => ({ ...d, hotelId: d.hotelId || targetHotel }))];
    setRawDailyClosings(merged);
    savePmsData({ dailyClosings: merged });
  };

  // Soft pivot default tab when currentRole actually changes
  useEffect(() => {
    if (!isAuthenticated) return;
    if (prevRoleRef.current === currentRole) return;
    prevRoleRef.current = currentRole;
    sessionStorage.setItem('pms_role', currentRole);
    if (currentRole === 'SuperAdmin') {
      sessionStorage.removeItem('pms_hotel_id');
    } else if (selectedHotelId) {
      sessionStorage.setItem('pms_hotel_id', selectedHotelId);
    } else if (hotels[0]?.id) {
      setSelectedHotelId(hotels[0].id);
      sessionStorage.setItem('pms_hotel_id', hotels[0].id);
    }

    const existingToken =
      sessionStorage.getItem('pms_session_token') ||
      sessionStorage.getItem('pms_auth_token') ||
      localStorage.getItem('pms_session_token') ||
      localStorage.getItem('pms_auth_token') ||
      '';
    if (isBackendServerActive() && existingToken) {
      const targetHotel = currentRole === 'SuperAdmin' ? 'SUPERADMIN' : (selectedHotelId || hotels[0]?.id || 'hotel-1');
      fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': existingToken,
          'x-user-role': currentRole,
          'x-hotel-id': targetHotel,
          'x-user-name': loggedInUser || currentRole
        },
        body: JSON.stringify({
          username: loggedInUser || currentRole,
          role: currentRole,
          hotelId: targetHotel,
          recordAuditLog: false
        })
      })
        .then(r => (r.ok && (r.headers.get('content-type') || '').includes('application/json') ? r.json() : null))
        .then(res => {
          if (res?.token) {
            sessionStorage.setItem('pms_session_token', res.token);
            sessionStorage.setItem('pms_auth_token', res.token);
          }
          return fetchAllFromSupabase();
        })
        .then(cloudData => {
          if (cloudData && Object.keys(cloudData).length > 0) {
            savePmsData(cloudData, true);
            applyAllPmsData(cloudData);
          }
        })
        .catch(() => {});
    }

    if (currentRole === 'SuperAdmin') {
      setActiveTab('superAdminHub');
      setSuperAdminSubTab('dashboard');
    } else if (currentRole === 'Owner') {
      setActiveTab('hotelOwnerHub');
      setOwnerSubTab('dashboard');
    } else if (currentRole === 'Housekeeping') {
      setActiveTab('housekeeping');
    } else if (currentRole === 'Reception' || currentRole === 'Receptionist') {
      setActiveTab('frontDesk');
    } else {
      setActiveTab('dashboard');
    }
  }, [currentRole, isAuthenticated]);

  useEffect(() => {
    const onExpired = () => {
      setIsAuthenticated(false);
      setLoggedInUser('');
      if (typeof window !== 'undefined') {
        const seg = (window.location.pathname || '/').split('/').filter(Boolean)[0]?.toLowerCase();
        if (seg === 'admin') {
          setPortalLoginMode('admin');
        } else if (seg === 'superadmin') {
          setPortalLoginMode('superadmin');
        } else if (seg === 'hotelowner') {
          setPortalLoginMode('hotelowner');
        } else {
          setUnauthView('login');
          if (!window.location.pathname.startsWith('/login')) {
            window.history.replaceState({}, '', '/login');
          }
        }
      }
    };
    window.addEventListener('pms-session-expired', onExpired);
    return () => window.removeEventListener('pms-session-expired', onExpired);
  }, []);

  const handleLoginSuccess = (role: UserRole, username: string, hotelId?: string, issuedToken?: string) => {
    prevRoleRef.current = role;
    setCurrentRole(role);
    setIsAuthenticated(true);
    setLoggedInUser(username);
    setIsNotFoundRoute(false);
    setIsPublicWebsiteForced(false);
    setPortalLoginMode(null);
    sessionStorage.setItem('pms_authenticated', 'true');
    sessionStorage.setItem('pms_user', username);
    sessionStorage.setItem('pms_role', role);
    localStorage.setItem('pms_authenticated', 'true');
    localStorage.setItem('pms_user', username);
    localStorage.setItem('pms_role', role);

    const targetHotelId = role === 'SuperAdmin' ? 'SUPERADMIN' : (hotelId || selectedHotelId || 'hotel-1');
    if (hotelId) {
      setSelectedHotelId(hotelId);
      sessionStorage.setItem('pms_hotel_id', hotelId);
      localStorage.setItem('pms_hotel_id', hotelId);
    } else if (role === 'SuperAdmin') {
      sessionStorage.removeItem('pms_hotel_id');
      localStorage.removeItem('pms_hotel_id');
    }

    if (issuedToken) {
      sessionStorage.setItem('pms_session_token', issuedToken);
      sessionStorage.setItem('pms_auth_token', issuedToken);
      localStorage.setItem('pms_session_token', issuedToken);
      localStorage.setItem('pms_auth_token', issuedToken);
      void prefetchPosHandoffCode(targetHotelId === 'SUPERADMIN' ? undefined : targetHotelId);
    }

    // Immediately hydrate authenticated state from backend using the verified session token (gate initial paint so 0s never flash)
    if (isBackendServerActive()) {
      setIsInitialHydrating(true);
      fetchAllFromSupabase()
        .then(cloudData => {
          if (cloudData && Object.keys(cloudData).length > 0) {
            savePmsData(cloudData, true);
            applyAllPmsData(cloudData);
            if (hotelId) {
              setSelectedHotelId(hotelId);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsInitialHydrating(false);
        });
    }

    handleAddAuditLogDirectly(
      'User Login',
      `User "${username}" (${role}) logged into ${targetHotelId === 'SUPERADMIN' ? 'SuperAdmin Console' : `Hotel ${targetHotelId}`}.`,
      targetHotelId,
      { username, role }
    );

    const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const firstSeg = currentPath.split('/').filter(Boolean)[0]?.toLowerCase();

    if (role === 'SuperAdmin') {
      if (firstSeg === 'superadmin') {
        syncStateFromLocation(currentPath, true, 'SuperAdmin');
      } else {
        setActiveTab('superAdminHub');
        setSuperAdminSubTab('dashboard');
        window.history.pushState({}, '', '/superadmin');
      }
    } else if (role === 'Owner') {
      if (firstSeg === 'hotelowner') {
        syncStateFromLocation(currentPath, true, 'Owner');
      } else {
        setActiveTab('hotelOwnerHub');
        setOwnerSubTab('dashboard');
        window.history.pushState({}, '', '/hotelowner');
      }
    } else {
      if (firstSeg === 'admin' || firstSeg === 'pos') {
        syncStateFromLocation(currentPath, true, role);
      } else {
        setActiveTab(role === 'Housekeeping' ? 'housekeeping' : (role === 'Reception' || role === 'Receptionist') ? 'frontDesk' : 'dashboard');
        window.history.pushState({}, '', '/admin');
      }
    }
  };

  const handleLogout = () => {
    const activeUser = loggedInUser || sessionStorage.getItem('pms_user') || currentRole;
    const activeRole = currentRole;
    const activeHotel = activeRole === 'SuperAdmin' ? 'SUPERADMIN' : selectedHotelId;

    handleAddAuditLogDirectly(
      'User Logout',
      `User "${activeUser}" (${activeRole}) logged out of ${activeHotel === 'SUPERADMIN' ? 'SuperAdmin Console' : `Hotel ${activeHotel}`}.`,
      activeHotel,
      { username: activeUser, role: activeRole }
    );

    const token = sessionStorage.getItem('pms_session_token') || sessionStorage.getItem('pms_auth_token') || '';
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-Session-Token': token }
    }).catch(() => {});

    const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const firstSeg = currentPath.split('/').filter(Boolean)[0]?.toLowerCase();

    setIsAuthenticated(false);
    setLoggedInUser('');
    setIsNotFoundRoute(false);
    setIsPublicWebsiteForced(false);
    for (const k of [
      'pms_authenticated',
      'pms_user',
      'pms_role',
      'pms_hotel_id',
      'pms_session_token',
      'pms_auth_token',
      'pms_auth_session',
      'pms_staff_username',
    ]) {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    }
    clearFastSessionSnapshots();

    // Wipe all DB-fetched data from memory so the next user starts clean
    setIsInitialHydrating(false);
    markDbHydrated(false);
    clearPmsMemoryCache();
    applyAllPmsData({
      hotels: [], customPages: [], rooms: [], bookings: [], checkins: [], invoices: [], expenses: [],
      handovers: [], policies: [], waterBottles: [], staff: [], auditLogs: [], roomVerifications: [],
      inventoryProducts: [], inventorySuppliers: [], inventoryPurchases: [], inventoryStockMovements: [],
      posItems: [], posOrders: [], pettyCash: [], cashBankAccounts: [], vouchers: [], vendors: [],
      ownerPayments: [], reimbursements: [], dailyClosings: [], laundryOrders: [], lostAndFoundItems: [],
      cleaningLogs: [], notifications: [], travelAgents: [], agentCommissionPayments: [], posAdvanceBookings: []
    }, true);
    setSelectedHotelId('');
    if (firstSeg === 'superadmin') {
      setPortalLoginMode('superadmin');
      window.history.pushState({}, '', '/superadmin');
    } else if (firstSeg === 'hotelowner') {
      setPortalLoginMode('hotelowner');
      window.history.pushState({}, '', '/hotelowner');
    } else if (firstSeg === 'admin') {
      setPortalLoginMode('admin');
      window.history.pushState({}, '', '/admin');
    } else {
      setPortalLoginMode(null);
      setUnauthView('login');
      window.history.pushState({}, '', '/login');
    }
  };

  const handleOnboardComplete = async (newHotel: Hotel, _generatedRooms: Room[]): Promise<{ success: boolean; error?: string }> => {
    const incomingPhone = String(newHotel.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const incomingEmail = String(newHotel.emailAddress || '').trim().toLowerCase();
    if (incomingPhone.length === 10) {
      const dupPhoneHotel = hotels.find(
        h => h.id !== newHotel.id && String(h.phoneNumber || '').replace(/\D/g, '').slice(-10) === incomingPhone
      );
      if (dupPhoneHotel) {
        const msg = `Mobile number ${incomingPhone} is already registered with another hotel property ("${dupPhoneHotel.name}"). Duplicate mobile numbers are not allowed.`;
        showToast(msg, 'error', 'Duplicate Mobile Number');
        return { success: false, error: msg };
      }
    }
    if (incomingEmail) {
      const dupEmailHotel = hotels.find(
        h => h.id !== newHotel.id && String(h.emailAddress || '').trim().toLowerCase() === incomingEmail
      );
      if (dupEmailHotel) {
        const msg = `Email ID "${incomingEmail}" is already registered with another hotel property ("${dupEmailHotel.name}"). Duplicate email addresses are not allowed.`;
        showToast(msg, 'error', 'Duplicate Email ID');
        return { success: false, error: msg };
      }
    }

    // Start newly onboarded hotel completely clean with zero static rooms, staff, or policies
    const seedRooms: Room[] = [];
    const seedStaffList: Staff[] = [];
    const seedPolicies: HotelPolicy[] = [];

    // Seed initial Audit Log
    const seedLog: AuditLog = {
      id: `AUD-${Date.now()}`,
      hotelId: newHotel.id,
      action: 'Property Onboarded',
      performedBy: 'SaaS Onboarding Wizard',
      details: `Self-onboarded property "${newHotel.name}" on ${newHotel.subscriptionPlan} package with ${newHotel.roomTierLimit} room tier limit.`,
      dateTime: new Date().toISOString()
    };

    const regNotification: AppNotification = {
      id: `NTF-${Date.now()}`,
      hotelId: 'SUPERADMIN',
      recipientRole: 'SuperAdmin',
      title: `New Property Registration: ${newHotel.name}`,
      message: `${newHotel.name} (${newHotel.subscriptionPlan} Plan, ${newHotel.roomTierLimit} rooms) registered via self-onboarding and awaits Super Admin approval.`,
      type: 'registration',
      severity: 'info',
      isRead: false,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      linkPath: '/superadmin/hotels',
      entityId: newHotel.id,
    };

    // Confirm creation with backend onboarding API first
    const apiResult = await onboardHotelApi({
      hotel: newHotel,
      rooms: seedRooms,
      staff: seedStaffList,
      policies: seedPolicies,
      auditLog: seedLog,
      notification: regNotification,
    });

    if (!apiResult.success) {
      showToast(`Onboarding Failed: ${apiResult.error || 'Could not register property with the server.'}`, 'error', 'Onboarding Failed');
      return { success: false, error: apiResult.error };
    }

    // Track verified conversion event ONLY after successful account creation
    trackSeoConversionEvent(
      newHotel.subscriptionPlan === 'Trial' ? 'trial_registration' : 'subscription_purchase',
      {
        plan: newHotel.subscriptionPlan,
        roomTier: newHotel.roomTierLimit,
        value: Number(newHotel.subscriptionPrice || 0),
        currency: 'INR'
      }
    );

    const updatedHotels = [...hotels, newHotel];
    setHotels(updatedHotels);

    const updatedRooms = [...rawRooms, ...seedRooms];
    setRawRooms(updatedRooms);

    const updatedStaff = [...rawStaff, ...seedStaffList];
    setRawStaff(updatedStaff);

    const updatedPolicies = [...rawPolicies, ...seedPolicies];
    setRawPolicies(updatedPolicies);

    const updatedLogs = [seedLog, ...rawAuditLogs];
    setRawAuditLogs(updatedLogs);

    const updatedNotifications = [regNotification, ...rawNotifications];
    setRawNotifications(updatedNotifications);

    // Save locally without calling authenticated /api/db/sync (since /api/public/onboard already persisted on server)
    savePmsData({
      hotels: updatedHotels,
      rooms: updatedRooms,
      staff: updatedStaff,
      policies: updatedPolicies,
      auditLogs: updatedLogs,
      notifications: updatedNotifications,
    }, true);

    showToast(`Registration Submitted & Confirmed!\n\n"${newHotel.name}" has been registered in the cloud database. Your status is currently "PENDING".\n\nOnce the Super Admin approves your property, you can log in using:\n• Admin Portal (/admin): ${newHotel.username || 'admin'} (with your registered password)\n• Owner Portal (/hotelowner): ${newHotel.ownerUsername || `${newHotel.username || 'admin'}_owner`} (with your registered password)`, 'success', 'Registration Confirmed', 10000);
    setUnauthView('login');
    window.history.pushState({}, '', '/login');
    return { success: true };
  };

  // Compute active tenant's strictly isolated state (fallback to first hotel if SuperAdmin switched role without picking hotel)
  const effectiveTenantHotelId = selectedHotelId || hotels[0]?.id || '';
  const bookings = rawBookings.filter(b => b.hotelId === effectiveTenantHotelId || (!b.hotelId && effectiveTenantHotelId === hotels[0]?.id));
  const checkins: GuestCheckIn[] = (() => {
    const baseList = rawCheckins
      .filter(c => c.hotelId === effectiveTenantHotelId || (!c.hotelId && effectiveTenantHotelId === hotels[0]?.id))
      .map(c => {
        if (c.checkedOutDateTime) return c;
        const cSt = String(c.status || '').toLowerCase().replace(/[\s_-]/g, '');
        const matchedBkg = bookings.find(b => b.id === c.id || (c as any).bookingId === b.id);
        const bSt = String(matchedBkg?.status || '').toLowerCase().replace(/[\s_-]/g, '');
        const isAlreadyOut =
          cSt === 'checkedout' ||
          cSt === 'completed' ||
          cSt === 'cancelled' ||
          Boolean((c as any).isCheckedOut) ||
          Boolean(c.checkedOutBy) ||
          Boolean(
            matchedBkg &&
              (matchedBkg.isCompleted ||
                (matchedBkg as any).isCheckedOut ||
                bSt === 'checkedout' ||
                bSt === 'completed' ||
                bSt === 'cancelled') &&
              !(c as any).checkoutUndoneAt
          );
        if (!isAlreadyOut) return c;
        const fallbackOutIso = c.checkOutDate
          ? `${String(c.checkOutDate).slice(0, 10)}T11:00:00.000Z`
          : c.checkInDate
          ? `${String(c.checkInDate).slice(0, 10)}T11:00:00.000Z`
          : '2026-01-01T11:00:00.000Z';
        return {
          ...c,
          status: 'Checked Out' as any,
          checkedOutDateTime: fallbackOutIso,
        };
      });
    const list = [...baseList];
    const tenantRooms = rawRooms.filter(r => r.hotelId === effectiveTenantHotelId || (!r.hotelId && effectiveTenantHotelId === hotels[0]?.id));
    bookings.forEach(b => {
      const rawSt = String(b.status || '').toLowerCase();
      const isCheckedOut = Boolean(
        b.isCompleted || (b as any).isCheckedOut || rawSt === 'checked out' || rawSt === 'checkedout'
      );
      const isCheckedIn = Boolean(
        !isCheckedOut && b.status !== 'Cancelled' && (b.isCheckedIn || rawSt === 'checked in')
      );
      if (isCheckedIn) {
        const bNameNorm = String(b.guestName || (b as any).customerName || '').trim().toLowerCase();
        const exists = list.some(c => {
          if (c.id === b.id || (c as any).bookingId === b.id) return true;
          const cNameNorm = String(c.guestName || '').trim().toLowerCase();
          if (c.roomNumber === b.roomNumber && cNameNorm && cNameNorm === bNameNorm) {
            if (!c.checkedOutDateTime || !b.checkInDate || c.checkInDate === b.checkInDate) {
              return true;
            }
          }
          return false;
        });
        if (!exists) {
          const matchedRm = tenantRooms.find(r => r.number === b.roomNumber);
          list.push({
            id: b.id,
            hotelId: b.hotelId || effectiveTenantHotelId,
            guestName: b.guestName || (b as any).customerName || 'Guest',
            mobile: b.mobile || '',
            emailAddress: b.email || '',
            address: b.address || '',
            idType: 'Aadhaar',
            idNumber: b.aadhaarNumber || '',
            roomNumber:
              b.roomNumber ||
              (Array.isArray((b as any).roomNumbers) ? (b as any).roomNumbers[0] : '') ||
              '101',
            roomType: b.roomType || matchedRm?.category || 'Standard',
            roomRate:
              matchedRm?.rate ||
              (b.bookingAmount && b.nights
                ? Math.round(b.bookingAmount / Math.max(1, b.nights))
                : 2000),
            checkInDate: b.checkInDate,
            arrivalTime: (b as any).checkInTime || '12:00 PM',
            checkOutDate: b.checkOutDate,
            departureTime: '11:00 AM',
            numGuests: (Number(b.adults) || 2) + (Number(b.children) || 0),
            adults: Number(b.adults) || 2,
            children: Number(b.children) || 0,
            advanceAmount: Number(b.advanceAmount ?? (b as any).amountPaid) || 0,
            paymentMethod: b.paymentMethod || (b as any).paymentMode || 'Cash',
            status: 'Active',
            hasExtraBed: b.hasExtraBed,
            extraBedCount: b.extraBedCount,
            extraBedRate: b.extraBedRate,
            bookedRooms: b.bookedRooms,
            isGroupCheckIn: b.isGroupCheckIn,
            groupBookingId: b.groupBookingId,
          });
        }
      }
    });
    return list;
  })();
  const rooms = rawRooms
    .filter(r => r.hotelId === effectiveTenantHotelId || (!r.hotelId && effectiveTenantHotelId === hotels[0]?.id))
    .map(r => {
      const hasActiveStay = checkins.some(
        c =>
          !c.checkedOutDateTime &&
          (c.roomNumber === r.number || (c.bookedRooms || []).some(br => br.roomNumber === r.number))
      );
      if (hasActiveStay) {
        return r.status === 'Occupied' ? r : { ...r, status: 'Occupied' as const };
      }
      if (r.status === 'Occupied') {
        return { ...r, status: 'Available' as const };
      }
      return r;
    });
  const invoices = deduplicateInvoicesByBooking(rawInvoices.filter(i => i.hotelId === effectiveTenantHotelId || (!i.hotelId && effectiveTenantHotelId === hotels[0]?.id)));
  const expenses = rawExpenses.filter(e => e.hotelId === effectiveTenantHotelId);
  const handovers = rawHandovers.filter(h => h.hotelId === effectiveTenantHotelId);
  const policies = rawPolicies.filter(p => p.hotelId === effectiveTenantHotelId);
  const waterBottles = rawWaterBottles.filter(
    w => w.hotelId === effectiveTenantHotelId || (!w.hotelId && (effectiveTenantHotelId === hotels[0]?.id || effectiveTenantHotelId === 'hotel-1'))
  );
  const staff = rawStaff.filter(s => s.hotelId === effectiveTenantHotelId);
  const roomVerifications = rawRoomVerifications.filter(v => v.hotelId === effectiveTenantHotelId);
  const pettyCash = rawPettyCash.filter(p => p.hotelId === effectiveTenantHotelId);
  const cashBankAccounts = rawCashBankAccounts.filter(a => a.hotelId === effectiveTenantHotelId);
  const vouchers = rawFinanceVouchers.filter(v => v.hotelId === effectiveTenantHotelId);
  const vendors = rawVendors.filter(v => v.hotelId === effectiveTenantHotelId);
  const ownerPayments = rawOwnerPayments.filter(o => o.hotelId === effectiveTenantHotelId);
  const reimbursements = rawReimbursements.filter(r => r.hotelId === effectiveTenantHotelId);
  const dailyClosings = rawDailyClosings.filter(d => d.hotelId === effectiveTenantHotelId);
  const auditLogs = currentRole === 'SuperAdmin'
    ? rawAuditLogs
    : rawAuditLogs.filter(
        a => !a.hotelId || a.hotelId === effectiveTenantHotelId || a.hotelId === 'GLOBAL' || a.hotelId === 'ALL' || a.hotelId === 'SUPERADMIN' || a.hotelId === 'hotel-1'
      );
  const deletedItems = currentRole === 'SuperAdmin'
    ? rawDeletedItems
    : rawDeletedItems.filter(
        d => !d.hotelId || d.hotelId === effectiveTenantHotelId || d.hotelId === 'hotel-1'
      );
  const laundryItems = rawLaundryItems.some(l => l.hotelId === effectiveTenantHotelId)
    ? rawLaundryItems.filter(l => l.hotelId === effectiveTenantHotelId)
    : rawLaundryItems.filter(l => !l.hotelId || l.hotelId === effectiveTenantHotelId);
  const laundryOrders = rawLaundryOrders.filter(l => l.hotelId === effectiveTenantHotelId);
  const lostAndFoundItems = rawLostAndFoundItems.filter(l => l.hotelId === effectiveTenantHotelId);
  const cleaningLogs = rawCleaningLogs.filter(c => c.hotelId === effectiveTenantHotelId);
  const travelAgents = rawTravelAgents.filter(
    a => a.hotelId === effectiveTenantHotelId || (!a.hotelId && effectiveTenantHotelId === hotels[0]?.id)
  );
  const agentCommissionPayments = rawAgentCommissionPayments.filter(
    p => p.hotelId === effectiveTenantHotelId || (!p.hotelId && effectiveTenantHotelId === hotels[0]?.id)
  );
  const posAdvanceBookings = rawPosAdvanceBookings.filter(
    fb => fb.hotelId === effectiveTenantHotelId || (!fb.hotelId && effectiveTenantHotelId === hotels[0]?.id)
  );
  const posCategories = rawPosCategories.filter(
    c => c.hotelId === effectiveTenantHotelId || (!c.hotelId && effectiveTenantHotelId === hotels[0]?.id)
  );

  const activeHotel = hotels.find(h => h.id === selectedHotelId) || hotels[0];
  const hotelSettings: HotelSettings = activeHotel ? {
    id: activeHotel.id,
    logoUrl: activeHotel.logoUrl,
    name: activeHotel.name,
    address: activeHotel.address,
    gstNumber: activeHotel.gstNumber,
    phoneNumber: activeHotel.phoneNumber,
    emailAddress: activeHotel.emailAddress,
    website: activeHotel.website,
    checkInTime: activeHotel.checkInTime || '12:00 PM',
    checkOutTime: activeHotel.checkOutTime || '11:00 AM',
    earlyCheckInEnabled: activeHotel.earlyCheckInEnabled ?? true,
    earlyCheckInType: activeHotel.earlyCheckInType || 'hourly',
    earlyCheckInHourlyRate: activeHotel.earlyCheckInHourlyRate !== undefined ? Number(activeHotel.earlyCheckInHourlyRate) : 150,
    earlyCheckInFixedRate: activeHotel.earlyCheckInFixedRate !== undefined ? Number(activeHotel.earlyCheckInFixedRate) : 500,
    timeZone: activeHotel.timeZone || 'Asia/Kolkata',
    dateFormat: activeHotel.dateFormat || 'DD/MM/YYYY',
    businessDate: activeHotel.businessDate || new Date().toISOString().split('T')[0],
    lastNightAuditAt: activeHotel.lastNightAuditAt,
    invoicePrefix: activeHotel.invoicePrefix || 'DS',
    nextInvoiceSequence: activeHotel.nextInvoiceSequence || 1,
    isGstEnabled: activeHotel.isGstEnabled ?? true,
    defaultGstRate: activeHotel.defaultGstRate ?? 5,
    foodGstRate: activeHotel.foodGstRate ?? 5,
    roomRateIncludesGst: activeHotel.roomRateIncludesGst ?? false,
    taxOnAncillary: activeHotel.taxOnAncillary ?? true,
    waterBottleRate: activeHotel.waterBottleRate !== undefined ? Number(activeHotel.waterBottleRate) : 20,
    grcPrefix: activeHotel.grcPrefix || 'GRC',
    nextGrcSequence: activeHotel.nextGrcSequence || 1,
    autoMarkDirtyOnCheckout: activeHotel.autoMarkDirtyOnCheckout ?? true,
    allowBackDatedCheckIn: activeHotel.allowBackDatedCheckIn ?? true,
    allowBackDatedFoodBill: activeHotel.allowBackDatedFoodBill ?? true,
    grcTerms: Array.isArray(activeHotel.grcTerms) ? activeHotel.grcTerms : undefined,
    placeOfSupply: activeHotel.placeOfSupply || '',
    panNumber: activeHotel.panNumber || '',
    gstSlabs: Array.isArray(activeHotel.gstSlabs) && activeHotel.gstSlabs.length > 0
      ? activeHotel.gstSlabs
      : [0, 5, 12, 18],
    invoiceConditions: normalizeInvoiceConditions(activeHotel.invoiceConditions, {
      isGstEnabled: activeHotel.isGstEnabled ?? true,
      defaultGstRate: activeHotel.defaultGstRate ?? 5
    })
  } : {
    ...DEFAULT_HOTEL_SETTINGS,
    timeZone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    businessDate: new Date().toISOString().split('T')[0],
    isGstEnabled: true,
    defaultGstRate: 5,
    foodGstRate: 5,
    gstSlabs: [0, 5, 12, 18],
    autoMarkDirtyOnCheckout: true,
    allowBackDatedCheckIn: false,
    invoiceConditions: normalizeInvoiceConditions(undefined, {
      isGstEnabled: true,
      defaultGstRate: 5
    })
  };

  // Onboard new SaaS property by Super Admin (automatically Approved & Active)
  const handleAddHotel = (inputHotel: Hotel, template: 'Boutique' | 'Luxury' | 'Budget') => {
    const incomingPhone = String(inputHotel.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const incomingEmail = String(inputHotel.emailAddress || '').trim().toLowerCase();
    if (incomingPhone.length === 10) {
      const dupPhoneHotel = hotels.find(
        h => h.id !== inputHotel.id && String(h.phoneNumber || '').replace(/\D/g, '').slice(-10) === incomingPhone
      );
      if (dupPhoneHotel) {
        showToast(
          `Mobile number ${incomingPhone} is already registered with "${dupPhoneHotel.name}". Duplicate mobile numbers are not allowed.`,
          'error',
          'Duplicate Mobile Number'
        );
        return;
      }
    }
    if (incomingEmail) {
      const dupEmailHotel = hotels.find(
        h => h.id !== inputHotel.id && String(h.emailAddress || '').trim().toLowerCase() === incomingEmail
      );
      if (dupEmailHotel) {
        showToast(
          `Email ID "${incomingEmail}" is already registered with "${dupEmailHotel.name}". Duplicate email addresses are not allowed.`,
          'error',
          'Duplicate Email ID'
        );
        return;
      }
    }

    const adminUser = inputHotel.username || 'admin';
    const adminPass = inputHotel.password || 'password';
    const newHotel: Hotel = {
      ...inputHotel,
      status: 'Approved',
      subscriptionStatus: 'Active',
      username: adminUser,
      password: adminPass,
      ownerUsername: inputHotel.ownerUsername || `${adminUser}_owner`,
      ownerPassword: inputHotel.ownerPassword || adminPass
    };

    const updatedHotels = [...hotels, newHotel];
    setHotels(updatedHotels);
    setSelectedHotelId(newHotel.id);

    // Start new hotel with zero static rooms, staff, or policies
    const seedRooms: Room[] = [];
    const mergedRooms = [...rawRooms, ...seedRooms];
    setRawRooms(mergedRooms);

    const mergedStaff = [...rawStaff];
    setRawStaff(mergedStaff);

    const seedPolicies: HotelPolicy[] = [];
    const mergedPolicies = [...rawPolicies, ...seedPolicies];
    setRawPolicies(mergedPolicies);

    // Add Audit Log
    const actorUser = loggedInUser || 'SuperAdmin';
    const newLog: AuditLog = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hotelId: newHotel.id,
      action: 'Property Onboarded',
      performedBy: `${actorUser} (${currentRole})`,
      actorUsername: actorUser,
      actorRole: currentRole,
      outcome: 'success',
      details: `Onboarded & approved property "${newHotel.name}" with a ${template} inventory template.`,
      dateTime: new Date().toISOString()
    };
    setRawAuditLogs(prev => {
      const mergedLogs = [newLog, ...prev];
      savePmsData({
        hotels: updatedHotels,
        rooms: mergedRooms,
        staff: mergedStaff,
        policies: mergedPolicies,
        auditLogs: mergedLogs
      });
      return mergedLogs;
    });
    appendAuditLogToCloud({
      id: newLog.id,
      hotelId: newHotel.id,
      action: newLog.action,
      details: newLog.details
    }).catch(() => {});

    emitNotification({
      hotelId: 'SUPERADMIN',
      recipientRole: 'SuperAdmin',
      title: `Hotel Onboarded & Approved: ${newHotel.name}`,
      message: `${newHotel.name} was provisioned and approved on the ${newHotel.subscriptionPlan || 'Trial'} package (${template} template).`,
      type: 'registration',
      severity: 'success',
      linkPath: '/superadmin/hotels',
      entityId: newHotel.id,
      dedupeKey: `SUPERADMIN:registration:${newHotel.id}`,
    });
    emitNotification({
      hotelId: newHotel.id,
      recipientRole: 'All',
      title: `Property Activated: ${newHotel.name}`,
      message: `Welcome to DirectStay PMS. Your ${template} room inventory (${seedRooms.length} rooms) is active and approved.`,
      type: 'registration',
      severity: 'success',
      linkPath: '/hotelowner/property',
      entityId: newHotel.id,
      dedupeKey: `${newHotel.id}:registration:welcome`,
    });
    showToast(`Hotel "${newHotel.name}" created & auto-approved!`, 'success');
  };

  const handleDeleteHotel = (hotelId: string) => {
    const targetHotel = hotels.find(h => h.id === hotelId);
    // Remove hotel from list
    const updatedHotels = hotels.filter(h => h.id !== hotelId);
    setHotels(updatedHotels);
    savePmsData({ hotels: updatedHotels });

    // Remove operational records while preserving append-only audit logs
    const newRooms = rawRooms.filter(r => r.hotelId !== hotelId);
    const newBookings = rawBookings.filter(b => b.hotelId !== hotelId);
    const newCheckins = rawCheckins.filter(c => c.hotelId !== hotelId);
    const newInvoices = rawInvoices.filter(i => i.hotelId !== hotelId);
    const newExpenses = rawExpenses.filter(e => e.hotelId !== hotelId);
    const newHandovers = rawHandovers.filter(h => h.hotelId !== hotelId);
    const newPolicies = rawPolicies.filter(p => p.hotelId !== hotelId);
    const newWaterBottles = rawWaterBottles.filter(w => w.hotelId !== hotelId);
    const newStaff = rawStaff.filter(s => s.hotelId !== hotelId);
    const newRoomVerifications = rawRoomVerifications.filter(v => v.hotelId !== hotelId);

    setRawRooms(newRooms);
    setRawBookings(newBookings);
    setRawCheckins(newCheckins);
    setRawInvoices(newInvoices);
    setRawExpenses(newExpenses);
    setRawHandovers(newHandovers);
    setRawPolicies(newPolicies);
    setRawWaterBottles(newWaterBottles);
    setRawStaff(newStaff);
    setRawRoomVerifications(newRoomVerifications);

    savePmsData({
      rooms: newRooms,
      bookings: newBookings,
      checkins: newCheckins,
      invoices: newInvoices,
      expenses: newExpenses,
      handovers: newHandovers,
      policies: newPolicies,
      waterBottles: newWaterBottles,
      staff: newStaff,
      roomVerifications: newRoomVerifications
    });

    handleAddAuditLogDirectly(
      'Hotel Property Deleted',
      `Removed hotel property "${targetHotel?.name || hotelId}" (${hotelId}) from active platform registry.`,
      hotelId
    );

    if (selectedHotelId === hotelId) {
      setSelectedHotelId('hotel-1');
    }
    showToast('Hotel property removed', 'info');
  };

  // Sync state helpers
  const handleUpdateRooms = (updated: Room[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId;
    const merged = [
      ...rawRooms.filter(r => r.hotelId !== targetHotel),
      ...updated.map(r => ({ ...r, hotelId: targetHotel }))
    ];
    setRawRooms(merged);
    savePmsData({ rooms: merged });
  };

  const handleUpdateBookings = (updated: Booking[]) => {
    const prevIds = new Set(bookings.map(b => b.id));
    const newlyCreated = updated.filter(b => !prevIds.has(b.id));
    if (newlyCreated.length > 0) {
      const firstNew = newlyCreated[0];
      if (firstNew.bookingSource === 'Website' || (firstNew as any).source === 'Website') {
        handleAddAuditLogDirectly(
          'Website Booking Created',
          `Online website booking #${firstNew.id} created for ${firstNew.guestName} (Room ${firstNew.roomNumber}, ${firstNew.checkInDate} to ${firstNew.checkOutDate}).`
        );
      }
      emitNotification({
        hotelId: selectedHotelId,
        recipientRole: 'All',
        title: `New Reservation: ${firstNew.guestName}`,
        message: `Booking #${firstNew.id} created for Room ${firstNew.roomNumber} (${firstNew.checkInDate} → ${firstNew.checkOutDate}).`,
        type: 'booking',
        severity: 'success',
        linkPath: '/admin/frontDesk/reservations',
        entityId: firstNew.id,
        dedupeKey: `${selectedHotelId}:booking:create:${firstNew.id}`,
      });
      showToast('Booking saved successfully', 'success');
    } else {
      updated.forEach(ub => {
        const oldB = bookings.find(b => b.id === ub.id);
        if (!oldB) return;
        if (oldB.status !== 'Cancelled' && ub.status === 'Cancelled') {
          emitNotification({
            hotelId: selectedHotelId,
            recipientRole: 'All',
            title: `Booking Cancelled: #${ub.id}`,
            message: `Reservation for ${ub.guestName} (Room ${ub.roomNumber}) was marked as Cancelled.`,
            type: 'booking',
            severity: 'warning',
            linkPath: '/admin/frontDesk/reservations',
            entityId: ub.id,
            dedupeKey: `${selectedHotelId}:booking:cancel:${ub.id}`,
          });
          showToast('Booking cancelled', 'warning');
        } else if (
          oldB.roomNumber !== ub.roomNumber ||
          oldB.checkInDate !== ub.checkInDate ||
          oldB.checkOutDate !== ub.checkOutDate ||
          oldB.paymentStatus !== ub.paymentStatus
        ) {
          emitNotification({
            hotelId: selectedHotelId,
            recipientRole: 'All',
            title: `Booking Modified: #${ub.id}`,
            message: `Reservation for ${ub.guestName} updated (Room ${ub.roomNumber}, ${ub.checkInDate} → ${ub.checkOutDate}).`,
            type: 'booking',
            severity: 'info',
            linkPath: '/admin/frontDesk/reservations',
            entityId: ub.id,
            dedupeKey: `${selectedHotelId}:booking:mod:${ub.id}:${ub.roomNumber}:${ub.checkOutDate}:${ub.paymentStatus}`,
          });
          showToast('Booking saved successfully', 'success');
        }
      });
    }

    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || '';
    const merged = [
      ...rawBookings.filter(b => b.hotelId && b.hotelId !== targetHotel),
      ...updated.map(b => ({ ...b, hotelId: targetHotel }))
    ];
    setRawBookings(merged);
    savePmsData({ bookings: merged });
  };

  const handleUpdateCheckins = (updated: GuestCheckIn[]) => {
    const prevIds = new Set(checkins.map(c => c.id));
    const newlyCheckedIn = updated.filter(c => !prevIds.has(c.id));
    if (newlyCheckedIn.length > 0) {
      const firstNew = newlyCheckedIn[0];
      emitNotification({
        hotelId: selectedHotelId,
        recipientRole: 'All',
        title: `Guest Checked In: Room ${firstNew.roomNumber}`,
        message: `${firstNew.guestName} checked into Room ${firstNew.roomNumber}. Advance collected: ₹${(firstNew.advanceAmount || 0).toLocaleString('en-IN')}.`,
        type: 'checkin',
        severity: 'success',
        linkPath: '/admin/frontDesk/inhouse',
        entityId: firstNew.id,
        dedupeKey: `${selectedHotelId}:checkin:${firstNew.id}`,
      });
      showToast('Guest checked in successfully', 'success');
    } else {
      const checkedOutRoomNums = new Set<string>();
      updated.forEach(uc => {
        const oldC = checkins.find(c => c.id === uc.id);
        const justCheckedOut =
          oldC &&
          ((!oldC.checkedOutBy && uc.checkedOutBy) ||
            (oldC.status !== 'Checked Out' && uc.status === 'Checked Out'));
        if (justCheckedOut) {
          String(uc.roomNumber || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(rn => checkedOutRoomNums.add(rn));
          if (Array.isArray(uc.bookedRooms)) {
            uc.bookedRooms.forEach(br => {
              if (br?.roomNumber) checkedOutRoomNums.add(String(br.roomNumber).trim());
            });
          }
          if (hotelSettings?.autoMarkDirtyOnCheckout !== false) {
            emitNotification({
              hotelId: selectedHotelId,
              recipientRole: 'All',
              title: `🧹 Room ${uc.roomNumber} Checked Out — Marked Dirty`,
              message: `${uc.guestName} checked out from Room ${uc.roomNumber}. Housekeeping alert: please clean Room ${uc.roomNumber} immediately.`,
              type: 'housekeeping',
              severity: 'warning',
              linkPath: '/admin/housekeeping/dashboard',
              entityId: uc.id,
              dedupeKey: `${selectedHotelId}:checkout:${uc.id}`,
            });
            showToast(`Room ${uc.roomNumber} checked out & marked Dirty for Housekeeping`, 'info');
          }
        }
      });

      if (checkedOutRoomNums.size > 0 && hotelSettings?.autoMarkDirtyOnCheckout !== false) {
        const targetHotelForHk = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || '';
        const nextHotelRooms = rooms.map(r =>
          checkedOutRoomNums.has(r.number)
            ? {
                ...r,
                status: 'Dirty' as const,
                cleaningStatus: 'Dirty' as const,
                housekeepingPriority: r.housekeepingPriority || ('High' as const),
                housekeepingNotes: r.housekeepingNotes || 'Post-checkout room turnaround required',
              }
            : r
        );
        const mergedRooms = [
          ...rawRooms.filter(r => r.hotelId && r.hotelId !== targetHotelForHk),
          ...nextHotelRooms.map(r => ({ ...r, hotelId: targetHotelForHk })),
        ];
        setRawRooms(mergedRooms);

        const nowLabel = new Date().toLocaleString('en-IN');
        const newHkLogs: HousekeepingCleaningLog[] = [];
        checkedOutRoomNums.forEach(rn => {
          const alreadyOpen = cleaningLogs.some(
            cl =>
              cl.roomNumber === rn &&
              cl.status !== 'Cleaned' &&
              cl.status !== 'Inspected'
          );
          if (!alreadyOpen) {
            const rmMeta = rooms.find(rm => rm.number === rn);
            newHkLogs.push({
              id: `HK-CO-${Date.now()}-${rn}`,
              hotelId: targetHotelForHk,
              roomNumber: rn,
              category: rmMeta?.category,
              floor: rmMeta?.floor,
              assignedStaff: rmMeta?.assignedStaff || 'Unassigned',
              assignedAt: nowLabel,
              priority: 'High',
              status: 'Pending',
              checklistCompleted: [],
              notes: 'Auto-queued post-checkout room cleaning & sanitization',
            });
          }
        });
        if (newHkLogs.length > 0) {
          const mergedLogs = [
            ...newHkLogs,
            ...rawCleaningLogs,
          ];
          setRawCleaningLogs(mergedLogs);
          savePmsData({ checkins: [
            ...rawCheckins.filter(c => c.hotelId && c.hotelId !== targetHotelForHk),
            ...updated.map(c => ({ ...c, hotelId: targetHotelForHk }))
          ], rooms: mergedRooms, cleaningLogs: mergedLogs });
          setRawCheckins([
            ...rawCheckins.filter(c => c.hotelId && c.hotelId !== targetHotelForHk),
            ...updated.map(c => ({ ...c, hotelId: targetHotelForHk }))
          ]);
          return;
        }
        savePmsData({ rooms: mergedRooms });
      }
    }

    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || '';
    const merged = [
      ...rawCheckins.filter(c => c.hotelId && c.hotelId !== targetHotel),
      ...updated.map(c => ({ ...c, hotelId: targetHotel }))
    ];
    setRawCheckins(merged);
    savePmsData({ checkins: merged });
  };

  const handleUpdateInvoices = (updated: Invoice[]) => {
    const prevIds = new Set(invoices.map(i => i.id));
    const newlyGenerated = updated.filter(i => !prevIds.has(i.id));
    if (newlyGenerated.length > 0) {
      const inv = newlyGenerated[0];
      emitNotification({
        hotelId: selectedHotelId,
        recipientRole: 'All',
        title: `Invoice Generated: #${inv.id}`,
        message: `Tax invoice generated for ${inv.guestName} (Room ${inv.roomNumber}) totaling ₹${(inv.finalAmount || 0).toLocaleString('en-IN')}.`,
        type: 'invoice',
        severity: 'info',
        linkPath: '/admin/frontDesk/billing',
        entityId: inv.id,
        dedupeKey: `${selectedHotelId}:invoice:create:${inv.id}`,
      });
      showToast('Invoice generated successfully', 'success');
    } else {
      updated.forEach(ui => {
        const oldI = invoices.find(i => i.id === ui.id);
        if (oldI && !oldI.isPaid && ui.isPaid) {
          emitNotification({
            hotelId: selectedHotelId,
            recipientRole: 'All',
            title: `Payment Settled: Invoice #${ui.id}`,
            message: `Full settlement of ₹${(ui.finalAmount || 0).toLocaleString('en-IN')} verified for ${ui.guestName} (${ui.paymentMethod || 'Settled'}).`,
            type: 'payment',
            severity: 'success',
            linkPath: '/admin/finance/transactions',
            entityId: ui.id,
            dedupeKey: `${selectedHotelId}:payment:settled:${ui.id}`,
          });
          showToast('Payment settled successfully', 'success');
        }
      });
    }

    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || '';
    const merged = deduplicateInvoicesByBooking([
      ...rawInvoices.filter(i => i.hotelId && i.hotelId !== targetHotel),
      ...updated.map(i => ({ ...i, hotelId: i.hotelId || targetHotel }))
    ]);
    setRawInvoices(merged);
    savePmsData({ invoices: merged });
  };

  const handleUpdateExpenses = (updated: Expense[]) => {
    const prevIds = new Set(expenses.map(e => e.id));
    const newExpensesList = updated.filter(e => !prevIds.has(e.id));
    if (newExpensesList.length > 0) {
      const exp = newExpensesList[0];
      emitNotification({
        hotelId: selectedHotelId,
        recipientRole: 'All',
        title: `New Expense Logged: ${exp.category}`,
        message: `Expense of ₹${(exp.amount || 0).toLocaleString('en-IN')} recorded (${exp.description || exp.category}).`,
        type: 'expense',
        severity: 'info',
        linkPath: '/hotelowner/financials',
        entityId: exp.id,
        dedupeKey: `${selectedHotelId}:expense:new:${exp.id}`,
      });
      showToast('Expense recorded successfully', 'success');
    } else {
      updated.forEach(ue => {
        const oldE = expenses.find(e => e.id === ue.id);
        const prevStatus = oldE?.approvalStatus || oldE?.status;
        const nextStatus = ue.approvalStatus || ue.status;
        if (oldE && prevStatus !== nextStatus && nextStatus) {
          emitNotification({
            hotelId: selectedHotelId,
            recipientRole: 'All',
            title: `Expense ${nextStatus}: ${ue.category}`,
            message: `Expense "${ue.description || ue.category}" (₹${(ue.amount || 0).toLocaleString('en-IN')}) was marked as ${nextStatus}.`,
            type: 'expense',
            severity: nextStatus === 'Approved' ? 'success' : 'warning',
            linkPath: '/admin/expenses',
            entityId: ue.id,
            dedupeKey: `${selectedHotelId}:expense:status:${ue.id}:${nextStatus}`,
          });
          showToast(`Expense marked as ${nextStatus}`, nextStatus === 'Approved' ? 'success' : 'warning');
        }
      });
    }

    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawExpenses.filter(e => (e.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(e => ({ ...e, hotelId: e.hotelId || targetHotel }))
    ];
    setRawExpenses(merged);
    savePmsData({ expenses: merged });
  };

  const handleUpdateHandovers = (updated: CashHandover[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawHandovers.filter(h => (h.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(h => ({ ...h, hotelId: h.hotelId || targetHotel }))
    ];
    setRawHandovers(merged);
    savePmsData({ handovers: merged });
  };

  const handleUpdatePolicies = (updated: HotelPolicy[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawPolicies.filter(p => (p.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(p => ({ ...p, hotelId: p.hotelId || targetHotel }))
    ];
    setRawPolicies(merged);
    savePmsData({ policies: merged });
  };

  const handleUpdateWaterBottles = (updated: WaterBottleRecord[]) => {
    const targetHotelId = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawWaterBottles.filter(w => (w.hotelId || 'hotel-1') !== targetHotelId),
      ...updated.map(w => ({ ...w, hotelId: targetHotelId }))
    ];
    setRawWaterBottles(merged);
    savePmsData({ waterBottles: merged });
  };

  const handleUpdateStaff = (updated: Staff[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    if (updated.length > staff.length) {
      const prevIds = new Set(staff.map(s => s.id));
      const newMember = updated.find(s => !prevIds.has(s.id));
      if (newMember) {
        emitNotification({
          hotelId: targetHotel,
          recipientRole: 'All',
          title: `Staff Member Added: ${newMember.name}`,
          message: `${newMember.name} joined ${newMember.department} as ${newMember.designation}.`,
          type: 'staff',
          severity: 'info',
          linkPath: '/admin/staff',
          entityId: newMember.id,
          dedupeKey: `${targetHotel}:staff:add:${newMember.id}`,
        });
        showToast('Staff account created successfully', 'success');
      }
    } else {
      updated.forEach(us => {
        const oldS = staff.find(s => s.id === us.id);
        if (
          oldS &&
          (oldS.status !== us.status || oldS.designation !== us.designation || oldS.department !== us.department)
        ) {
          emitNotification({
            hotelId: targetHotel,
            recipientRole: 'All',
            title: `Staff Account Updated: ${us.name}`,
            message: `${us.name}'s profile updated (${us.designation}, Status: ${us.status}).`,
            type: 'staff',
            severity: 'info',
            linkPath: '/admin/staff',
            entityId: us.id,
            dedupeKey: `${targetHotel}:staff:mod:${us.id}:${us.status}:${us.designation}`,
          });
          showToast('Staff account updated successfully', 'success');
        }
      });
    }
    const merged = [
      ...rawStaff.filter(s => (s.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(s => ({ ...s, hotelId: s.hotelId || targetHotel }))
    ];
    setRawStaff(merged);
    savePmsData({ staff: merged });
  };

  const auditSeqRef = React.useRef(0);

  const handleUpdateGlobalHotels = (updatedHotels: Hotel[]) => {
    const prevHotels = hotels;
    setHotels(updatedHotels);
    savePmsData({ hotels: updatedHotels });

    const broadcastHotelApproval = () => {
      try {
        const approvalPayload = {
          ts: Date.now(),
          hotels: updatedHotels.map(h => ({
            id: h.id,
            name: h.name,
            username: h.username,
            ownerUsername: h.ownerUsername,
            emailAddress: h.emailAddress,
            status: h.status,
            subscriptionStatus: h.subscriptionStatus,
            subscriptionEndDate: h.subscriptionEndDate,
          })),
        };
        localStorage.setItem('pms_hotel_status_broadcast', JSON.stringify(approvalPayload));
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('pms_hotel_approval_channel');
          bc.postMessage(approvalPayload);
          bc.close();
        }
      } catch {}
    };

    broadcastHotelApproval();
    waitForPendingSyncs().then(() => broadcastHotelApproval()).catch(() => {});

    updatedHotels.forEach(uh => {
      const oldH = prevHotels.find(h => h.id === uh.id);
      if (oldH && oldH.status !== uh.status) {
        const eventType = uh.status === 'Suspended' || uh.status === 'Rejected' ? 'suspension' : 'approval';
        const sev = uh.status === 'Approved' ? 'success' : 'warning';
        handleAddAuditLogDirectly(
          `Hotel ${uh.status}`,
          `Property "${uh.name}" (${uh.id}) status changed from "${oldH.status}" to "${uh.status}".`,
          uh.id
        );
        emitNotification({
          hotelId: uh.id,
          recipientRole: 'All',
          title: `Property Status Updated: ${uh.name}`,
          message: `${uh.name} status changed from "${oldH.status}" to "${uh.status}".`,
          type: eventType,
          severity: sev,
          linkPath: '/hotelowner/property',
          entityId: uh.id,
          dedupeKey: `${uh.id}:status:${uh.status}`,
        });
        emitNotification({
          hotelId: 'SUPERADMIN',
          recipientRole: 'SuperAdmin',
          title: `Hotel ${uh.status}: ${uh.name}`,
          message: `Platform status for ${uh.name} updated from "${oldH.status}" to "${uh.status}".`,
          type: eventType,
          severity: sev,
          linkPath: '/superadmin/hotels',
          entityId: uh.id,
          dedupeKey: `SUPERADMIN:${uh.id}:status:${uh.status}`,
        });
        showToast(`Hotel "${uh.name}" marked as ${uh.status}`, sev === 'success' ? 'success' : 'warning');
      } else if (
        oldH &&
        (oldH.subscriptionEndDate !== uh.subscriptionEndDate ||
          oldH.packageId !== uh.packageId ||
          oldH.subscriptionPlan !== uh.subscriptionPlan ||
          (Array.isArray(uh.subscriptionInvoices) ? uh.subscriptionInvoices.length : 0) >
            (Array.isArray(oldH.subscriptionInvoices) ? oldH.subscriptionInvoices.length : 0))
      ) {
        const latestSubInv =
          Array.isArray(uh.subscriptionInvoices) && uh.subscriptionInvoices.length > 0
            ? uh.subscriptionInvoices[0]
            : null;
        const invSuffix = latestSubInv
          ? ` Tax Invoice #${latestSubInv.invoiceNumber} (${latestSubInv.packageName} • ₹${Number(latestSubInv.totalAmount || 0).toLocaleString('en-IN')}) generated.`
          : '';
        handleAddAuditLogDirectly(
          'Subscription Plan Updated',
          `Property "${uh.name}" (${uh.id}) subscription updated to ${uh.subscriptionPlan} (Expires: ${uh.subscriptionEndDate || 'N/A'}).${invSuffix}`,
          uh.id
        );
        emitNotification({
          hotelId: uh.id,
          recipientRole: 'All',
          title: `Membership Renewed: ${uh.name}`,
          message: `${uh.name} membership is active on ${latestSubInv?.packageName || uh.subscriptionPlan} (Valid until ${uh.subscriptionEndDate || 'N/A'}).${invSuffix}`,
          type: 'subscription',
          severity: 'success',
          linkPath: '/hotelowner/subscription',
          entityId: uh.id,
          dedupeKey: `${uh.id}:sub:${uh.subscriptionPlan}:${uh.subscriptionEndDate}:${latestSubInv?.id || ''}`,
        });
        emitNotification({
          hotelId: 'SUPERADMIN',
          recipientRole: 'SuperAdmin',
          title: `Subscription Renewed: ${uh.name}`,
          message: `${uh.name} subscription updated to ${latestSubInv?.packageName || uh.subscriptionPlan} (Expires: ${uh.subscriptionEndDate || 'N/A'}).${invSuffix}`,
          type: 'subscription',
          severity: 'success',
          linkPath: '/superadmin/subscriptions',
          entityId: uh.id,
          dedupeKey: `SUPERADMIN:${uh.id}:sub:${uh.subscriptionPlan}:${uh.subscriptionEndDate}:${latestSubInv?.id || ''}`,
        });
        showToast('Subscription updated successfully', 'success');
      }
    });
  };

  const handleUpdateSingleHotel = (updatedHotel: Hotel) => {
    const updatedList = hotels.map(h => h.id === updatedHotel.id ? updatedHotel : h);
    handleUpdateGlobalHotels(updatedList);
    showToast('Property profile saved successfully', 'success');
  };

  const handleUpdateGlobalStaff = (updatedStaff: Staff[]) => {
    setRawStaff(updatedStaff);
    savePmsData({ staff: updatedStaff });
    showToast('Profile credentials updated successfully', 'success');
  };

  const handleUpdateAuditLogs = (updated: AuditLog[]) => {
    setRawAuditLogs(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const newlyAdded = updated
        .filter(a => a && a.id && !existingIds.has(a.id))
        .map(a => ({ ...a, hotelId: a.hotelId || selectedHotelId }));
      const merged = [...newlyAdded, ...prev];
      savePmsData({ auditLogs: merged });
      return merged;
    });
  };

  const handleUpdateRoomVerifications = (updated: RoomVerification[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawRoomVerifications.filter(v => (v.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(v => ({ ...v, hotelId: v.hotelId || targetHotel }))
    ];
    setRawRoomVerifications(merged);
    savePmsData({ roomVerifications: merged });
  };

  const handleUpdateRolePermissions = (updated: RolePermission[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawRolePermissions.filter(rp => (rp.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(rp => ({ ...rp, hotelId: rp.hotelId || targetHotel }))
    ];
    setRawRolePermissions(merged);
    savePmsData({ rolePermissions: merged });
  };

  const handleUpdateHotelSettings = (updated: HotelSettings) => {
    handleUpdateHotelSettingsState(updated);
  };

  const handleUpdateHotelSettingsState = (updated: HotelSettings) => {
    const updatedHotels = hotels.map(h => {
      if (h.id === selectedHotelId) {
        return {
          ...h,
          name: updated.name ?? h.name,
          logoUrl: updated.logoUrl ?? h.logoUrl,
          address: updated.address ?? h.address,
          gstNumber: updated.gstNumber ?? h.gstNumber,
          phoneNumber: updated.phoneNumber ?? h.phoneNumber,
          emailAddress: updated.emailAddress ?? h.emailAddress,
          website: updated.website ?? h.website,
          checkInTime: updated.checkInTime ?? h.checkInTime,
          checkOutTime: updated.checkOutTime ?? h.checkOutTime,
          earlyCheckInEnabled: updated.earlyCheckInEnabled !== undefined ? updated.earlyCheckInEnabled : (h.earlyCheckInEnabled ?? true),
          earlyCheckInType: updated.earlyCheckInType || h.earlyCheckInType || 'hourly',
          earlyCheckInHourlyRate: updated.earlyCheckInHourlyRate !== undefined ? Number(updated.earlyCheckInHourlyRate) : (h.earlyCheckInHourlyRate ?? 150),
          earlyCheckInFixedRate: updated.earlyCheckInFixedRate !== undefined ? Number(updated.earlyCheckInFixedRate) : (h.earlyCheckInFixedRate ?? 500),
          timeZone: updated.timeZone ?? h.timeZone,
          dateFormat: updated.dateFormat ?? h.dateFormat,
          businessDate: updated.businessDate ?? h.businessDate,
          lastNightAuditAt: updated.lastNightAuditAt ?? h.lastNightAuditAt,
          isGstEnabled: updated.isGstEnabled !== undefined ? updated.isGstEnabled : h.isGstEnabled,
          defaultGstRate: updated.defaultGstRate !== undefined ? Number(updated.defaultGstRate) : h.defaultGstRate,
          foodGstRate: updated.foodGstRate !== undefined ? Number(updated.foodGstRate) : h.foodGstRate,
          inHouseKitchenAvailable:
            updated.inHouseKitchenAvailable !== undefined
              ? Boolean(updated.inHouseKitchenAvailable)
              : h.inHouseKitchenAvailable,
          inHouseRestaurantAvailable:
            updated.inHouseRestaurantAvailable !== undefined
              ? Boolean(updated.inHouseRestaurantAvailable)
              : h.inHouseRestaurantAvailable,
          posOutletName:
            updated.posOutletName !== undefined ? updated.posOutletName : h.posOutletName,
          gstSlabs: Array.isArray(updated.gstSlabs) && updated.gstSlabs.length > 0 ? updated.gstSlabs : h.gstSlabs,
          // Single Bill Calculator settings (My Profile Settings → Billing)
          invoicePrefix: updated.invoicePrefix !== undefined ? updated.invoicePrefix : h.invoicePrefix,
          nextInvoiceSequence: updated.nextInvoiceSequence !== undefined ? Number(updated.nextInvoiceSequence) : h.nextInvoiceSequence,
          roomRateIncludesGst: updated.roomRateIncludesGst !== undefined ? Boolean(updated.roomRateIncludesGst) : h.roomRateIncludesGst,
          taxOnAncillary: updated.taxOnAncillary !== undefined ? Boolean(updated.taxOnAncillary) : h.taxOnAncillary,
          waterBottleRate: updated.waterBottleRate !== undefined ? Number(updated.waterBottleRate) : h.waterBottleRate,
          grcPrefix: updated.grcPrefix !== undefined ? updated.grcPrefix : h.grcPrefix,
          nextGrcSequence: updated.nextGrcSequence !== undefined ? Number(updated.nextGrcSequence) : h.nextGrcSequence,
          autoMarkDirtyOnCheckout:
            updated.autoMarkDirtyOnCheckout !== undefined
              ? Boolean(updated.autoMarkDirtyOnCheckout)
              : (h.autoMarkDirtyOnCheckout ?? true),
          allowBackDatedCheckIn:
            updated.allowBackDatedCheckIn !== undefined
              ? Boolean(updated.allowBackDatedCheckIn)
              : (h.allowBackDatedCheckIn ?? false),
          grcTerms: Array.isArray(updated.grcTerms) ? updated.grcTerms : h.grcTerms,
          placeOfSupply: updated.placeOfSupply !== undefined ? updated.placeOfSupply : h.placeOfSupply,
          panNumber: updated.panNumber !== undefined ? updated.panNumber : h.panNumber,
          invoiceConditions: updated.invoiceConditions
            ? normalizeInvoiceConditions(updated.invoiceConditions, {
                isGstEnabled: updated.isGstEnabled ?? h.isGstEnabled ?? true,
                defaultGstRate: updated.defaultGstRate ?? h.defaultGstRate ?? 5
              })
            : h.invoiceConditions
        };
      }
      return h;
    });
    setHotels(updatedHotels);
    savePmsData({ hotels: updatedHotels });
    handleAddAuditLogDirectly(
      'Hotel Settings Updated',
      `Updated hotel profile & dynamic GST configuration for "${updated.name}" (GST Enabled: ${updated.isGstEnabled !== false ? 'Yes' : 'No'}, Default Room GST: ${updated.defaultGstRate ?? 5}%, GSTIN: ${updated.gstNumber || 'N/A'}).`
    );
    showToast('Dynamic GST & Hotel Settings saved successfully', 'success');
  };

  const handleAddAuditLogDirectly = (
    action: string,
    details: string,
    targetHotelIdOverride?: string,
    actorOverride?: { username?: string; role?: string }
  ) => {
    const cleanAction = String(action || '').trim();
    const cleanDetails = String(details || '').trim();
    if (!cleanAction && !cleanDetails) return;

    const effectiveRole = String(
      actorOverride?.role || currentRole || sessionStorage.getItem('pms_role') || 'Admin'
    ).trim();
    const rawUser = String(
      actorOverride?.username || loggedInUser || sessionStorage.getItem('pms_user') || effectiveRole
    ).trim();
    const effectiveUser = rawUser || effectiveRole;
    const performedBy = `${effectiveUser} (${effectiveRole})`;
    const effectiveHotelId =
      targetHotelIdOverride ||
      (effectiveRole === 'SuperAdmin' ? selectedHotelId || 'SUPERADMIN' : selectedHotelId || 'hotel-1');

    auditSeqRef.current = (auditSeqRef.current + 1) % 1_000_000;
    const seqStr = String(auditSeqRef.current).padStart(4, '0');
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const newId = `AUD-${nowMs}-${seqStr}-${Math.random().toString(36).slice(2, 6)}`;

    const newLog: AuditLog = {
      id: newId,
      hotelId: effectiveHotelId,
      action: cleanAction || 'System Action',
      performedBy,
      actorId: `${effectiveRole.toLowerCase()}:${effectiveUser}`,
      actorUsername: effectiveUser,
      actorRole: effectiveRole,
      outcome: 'success',
      details: cleanDetails,
      dateTime: nowIso,
      persistedAt: nowIso
    };

    setRawAuditLogs(prev => {
      // Prevent duplicate entries within 3-second window for identical (hotelId, action, details)
      const isDup = prev.some(existing => {
        if (!existing) return false;
        if ((existing.hotelId || 'hotel-1') !== effectiveHotelId) return false;
        if (
          String(existing.action || '').trim().toLowerCase() === cleanAction.toLowerCase() &&
          String(existing.details || '').trim() === cleanDetails
        ) {
          const existingMs = Date.parse(existing.dateTime || '');
          if (!isNaN(existingMs) && Math.abs(nowMs - existingMs) < 3000) {
            return true;
          }
        }
        return false;
      });
      if (isDup) return prev;

      const updated = [newLog, ...prev];
      savePmsData({ auditLogs: updated });
      return updated;
    });

    appendAuditLogToCloud({
      id: newLog.id,
      hotelId: effectiveHotelId,
      action: newLog.action,
      details: newLog.details
    }).catch(() => {});
  };

  const handleMoveToDeletedFolder = (item: Omit<DeletedItemRecord, 'id' | 'deletedAt' | 'deletedBy'>) => {
    const actorUser = String(loggedInUser || sessionStorage.getItem('pms_user') || currentRole).trim();
    const newRecord: DeletedItemRecord = {
      id: `DEL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hotelId: effectiveTenantHotelId,
      deletedAt: new Date().toLocaleString(),
      deletedBy: `${actorUser} (${currentRole})`,
      ...item
    };
    const updated = [newRecord, ...rawDeletedItems];
    setRawDeletedItems(updated);
    savePmsData({ deletedItems: updated });
    handleAddAuditLogDirectly(
      `${item.itemType} Moved to Deleted Folder`,
      `Moved ${item.itemType} #${item.itemId} (${item.guestName || item.title}) to Deleted Folder. Data preserved safely.`
    );
    showToast(`${item.itemType} #${item.itemId} moved to Deleted Folder. You can restore it anytime.`, 'info');
  };

  const handleRestoreDeletedItem = (deletedItem: DeletedItemRecord) => {
    if (deletedItem.itemType === 'Booking' && deletedItem.data) {
      const restoredBooking: Booking = deletedItem.data;
      const linked = (deletedItem as any)?.metadata?.linkedCheckin || (restoredBooking as any)?.linkedCheckin;
      setRawBookings(prev => [restoredBooking, ...prev.filter(b => b.id !== restoredBooking.id)]);
      if (linked) {
        setRawCheckins(prev => [linked, ...prev.filter(c => c.id !== linked.id)]);
        savePmsData({
          bookings: [restoredBooking, ...rawBookings.filter(b => b.id !== restoredBooking.id)],
          checkins: [linked, ...rawCheckins.filter(c => c.id !== linked.id)],
        });
      } else {
        savePmsData({ bookings: [restoredBooking, ...rawBookings.filter(b => b.id !== restoredBooking.id)] });
      }
      if (restoredBooking.roomNumber && restoredBooking.checkInDate === new Date().toISOString().split('T')[0]) {
        const updatedRooms = rooms.map(r => r.number === restoredBooking.roomNumber && r.status === 'Available' ? { ...r, status: 'Reserved' as const } : r);
        handleUpdateRooms(updatedRooms);
      }
    } else if (deletedItem.itemType === 'Guest' && deletedItem.data) {
      const restoredGuest: GuestCheckIn = deletedItem.data;
      setRawCheckins(prev => [restoredGuest, ...prev.filter(c => c.id !== restoredGuest.id)]);
      savePmsData({ checkins: [restoredGuest, ...rawCheckins.filter(c => c.id !== restoredGuest.id)] });
    } else if (deletedItem.itemType === 'Invoice' && deletedItem.data) {
      const restoredInv: Invoice = deletedItem.data;
      setRawInvoices(prev => [restoredInv, ...prev.filter(i => i.id !== restoredInv.id)]);
      savePmsData({ invoices: [restoredInv, ...rawInvoices.filter(i => i.id !== restoredInv.id)] });
    }

    const updated = rawDeletedItems.filter(d => d.id !== deletedItem.id);
    setRawDeletedItems(updated);
    savePmsData({ deletedItems: updated });
    handleAddAuditLogDirectly(
      `${deletedItem.itemType} Restored from Deleted Folder`,
      `Restored ${deletedItem.itemType} #${deletedItem.itemId} (${deletedItem.guestName || deletedItem.title}) back to active records.`
    );
    showToast(`Successfully restored ${deletedItem.itemType} #${deletedItem.itemId}!`, 'success');
  };

  const handlePermanentDelete = (deletedId: string) => {
    const item = rawDeletedItems.find(d => d.id === deletedId);
    const updated = rawDeletedItems.filter(d => d.id !== deletedId);
    setRawDeletedItems(updated);
    savePmsData({ deletedItems: updated });
    if (item) {
      handleAddAuditLogDirectly(
        `Permanent Delete Executed`,
        `Authorized permanent erase of ${item.itemType} #${item.itemId} (${item.guestName || item.title}) from Deleted Folder.`
      );
    }
    showToast('Record permanently deleted from Recycle Bin.', 'info');
  };

  const handleAddRoomVerification = (verification: RoomVerification) => {
    const updated = [verification, ...rawRoomVerifications];
    setRawRoomVerifications(updated);
    savePmsData({ roomVerifications: updated });
  };

  const handleUpdateSystemWebsite = (updated: SystemWebsiteConfig) => {
    setSystemWebsite(updated);
    savePmsData({ systemWebsite: updated });
    handleAddAuditLogDirectly(
      'Website CMS Updated',
      `Updated public website CMS configuration for "${updated.businessName || 'DirectStay'}".`
    );
  };

  const handleUpdateLaundryItems = (updated: LaundryItemMaster[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const other = rawLaundryItems.filter(l => (l.hotelId || 'hotel-1') !== targetHotel);
    const merged = [...other, ...updated.map(l => ({ ...l, hotelId: l.hotelId || targetHotel }))];
    setRawLaundryItems(merged);
    savePmsData({ laundryItems: merged });
  };

  const handleUpdateLaundryOrders = (updated: LaundryOrder[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawLaundryOrders.filter(o => (o.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(o => ({ ...o, hotelId: o.hotelId || targetHotel }))
    ];
    setRawLaundryOrders(merged);
    savePmsData({ laundryOrders: merged });
  };

  const handleUpdateLostAndFoundItems = (updated: LostAndFoundItem[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawLostAndFoundItems.filter(i => (i.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(i => ({ ...i, hotelId: i.hotelId || targetHotel }))
    ];
    setRawLostAndFoundItems(merged);
    savePmsData({ lostAndFoundItems: merged });
  };

  const handleUpdateCleaningLogs = (updated: HousekeepingCleaningLog[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawCleaningLogs.filter(l => (l.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(l => ({ ...l, hotelId: l.hotelId || targetHotel }))
    ];
    setRawCleaningLogs(merged);
    savePmsData({ cleaningLogs: merged });
  };

  const handleUpdateTravelAgents = (updated: TravelAgent[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawTravelAgents.filter(a => (a.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(a => ({ ...a, hotelId: a.hotelId || targetHotel }))
    ];
    setRawTravelAgents(merged);
    savePmsData({ travelAgents: merged });
  };

  const handleUpdateAgentCommissionPayments = (updated: AgentCommissionPayment[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawAgentCommissionPayments.filter(p => (p.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(p => ({ ...p, hotelId: p.hotelId || targetHotel }))
    ];
    setRawAgentCommissionPayments(merged);
    savePmsData({ agentCommissionPayments: merged });
  };

  const handleUpdatePosAdvanceBookings = (updated: FoodAdvanceBooking[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawPosAdvanceBookings.filter(fb => (fb.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(fb => ({ ...fb, hotelId: fb.hotelId || targetHotel }))
    ];
    setRawPosAdvanceBookings(merged);
    savePmsData({ posAdvanceBookings: merged });
  };

  const handleUpdatePosCategories = (updated: PosCategory[]) => {
    const targetHotel = effectiveTenantHotelId || selectedHotelId || hotels[0]?.id || 'hotel-1';
    const merged = [
      ...rawPosCategories.filter(c => (c.hotelId || 'hotel-1') !== targetHotel),
      ...updated.map(c => ({ ...c, hotelId: c.hotelId || targetHotel }))
    ];
    setRawPosCategories(merged);
    savePmsData({ posCategories: merged });
  };

  // Nav tab router
  const renderTabContent = () => {
    const activeHotelObj = hotels.find(h => h.id === selectedHotelId) || hotels[0];
    const activePackageObj = packages.find(p => p.id === activeHotelObj?.packageId) || packages[0];
    const activeMaxRooms = activePackageObj?.maxRooms || 9999;
    const activePackageName = activePackageObj?.name || 'Starter';

    const tenantProds = rawInventoryProducts.filter(p => p.hotelId === effectiveTenantHotelId);
    const hasWaterInTenant = tenantProds.some(p => p.name?.toLowerCase().includes('water') || p.name?.toLowerCase().includes('mineral'));
    const inventoryProducts = hasWaterInTenant
      ? tenantProds
      : [
          {
            id: `inv-prod-water-${effectiveTenantHotelId || '1'}`,
            hotelId: effectiveTenantHotelId || 'hotel-1',
            name: 'Packaged Drinking Water (1L)',
            category: 'Housekeeping / F&B',
            sku: 'WATER-1L',
            unit: 'Bottles',
            currentStock: 0,
            minStockAlert: 5,
            costPrice: 0,
            sellingPrice: 0,
            supplierName: '',
            lastRestockedDate: new Date().toISOString().split('T')[0],
          },
          ...tenantProds,
        ];
    const inventoryCategories = rawInventoryCategories.some(c => c.hotelId === effectiveTenantHotelId)
      ? rawInventoryCategories.filter(c => c.hotelId === effectiveTenantHotelId)
      : rawInventoryCategories.filter(c => !c.hotelId || c.hotelId === effectiveTenantHotelId);
    const inventorySuppliers = rawInventorySuppliers.filter(s => s.hotelId === effectiveTenantHotelId);
    const inventoryPurchases = rawInventoryPurchases.filter(p => p.hotelId === effectiveTenantHotelId);
    const inventoryStockMovements = rawInventoryStockMovements.filter(m => m.hotelId === effectiveTenantHotelId);
    const posItems = rawPosItems.filter(i => i.hotelId === effectiveTenantHotelId);
    const posOrders = rawPosOrders.filter(o => o.hotelId === effectiveTenantHotelId);

    if (currentRole === 'Owner' && activeTab !== 'profile' && activeTab !== 'notifications' && activeTab !== 'calendar' && activeTab !== 'pos') {
      return (
        <HotelOwnerView
          activeSubTab={ownerSubTab}
          onSelectSubTab={setOwnerSubTab}
          hotel={activeHotelObj}
          packages={packages}
          rooms={rooms}
          bookings={bookings}
          checkins={checkins}
          invoices={invoices}
          expenses={expenses}
          posOrders={posOrders}
          inventoryPurchases={inventoryPurchases}
          pettyCash={pettyCash}
          cashBankAccounts={cashBankAccounts}
          vouchers={vouchers}
          vendors={vendors}
          reimbursements={reimbursements}
          staff={staff}
          ownerPayments={ownerPayments}
          auditLogs={auditLogs}
          onUpdateHotel={handleUpdateSingleHotel}
          onUpdateExpenses={handleUpdateExpenses}
          onUpdateOwnerPayments={handleUpdateOwnerPayments}
          onAddAuditLog={handleAddAuditLogDirectly}
          onNavigateToProfile={() => setActiveTab('profile')}
        />
      );
    }

    const INTEGRATED_PMS_TABS = new Set([
      'dashboard',
      'todayBookings',
      'calendar',
      'invoice',
      'rooms',
      'housekeeping',
      'pos',
      'inventory',
      'otaManager',
      'bookingEngine',
      'finance',
      'expenses',
      'reports',
      'auditLogs',
    ]);

    if (INTEGRATED_PMS_TABS.has(activeTab)) {
      return (
        <IntegratedAdminPmsHub
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          frontDeskSubTab={frontDeskSubTab}
          setFrontDeskSubTab={setFrontDeskSubTab}
          financeSubTab={financeSubTab}
          setFinanceSubTab={setFinanceSubTab}
          roomSubTab={roomSubTab}
          setRoomSubTab={setRoomSubTab}
          housekeepingSubTab={housekeepingSubTab}
          setHousekeepingSubTab={setHousekeepingSubTab}
          posSubTab={posSubTab}
          setPosSubTab={setPosSubTab}
          inventorySubTab={inventorySubTab}
          setInventorySubTab={setInventorySubTab}
          otaSubTab={otaSubTab}
          setOtaSubTab={setOtaSubTab}
          reportsSubTab={reportsSubTab}
          setReportsSubTab={setReportsSubTab}
          staffSubTab={staffSubTab}
          setStaffSubTab={setStaffSubTab}
          invoiceSubTab={invoiceSubTab}
          setInvoiceSubTab={setInvoiceSubTab}
          selectedHotelId={effectiveTenantHotelId}
          hotelName={activeHotelObj?.name || hotelSettings.name}
          hotelAddress={activeHotelObj?.address || hotelSettings.address}
          hotelGst={activeHotelObj?.gstNumber || hotelSettings.gstNumber}
          hotelPhone={activeHotelObj?.phoneNumber || hotelSettings.phoneNumber}
          hotelEmail={activeHotelObj?.emailAddress || hotelSettings.emailAddress}
          hotelSettings={activeHotelObj ? { ...hotelSettings, ...activeHotelObj } : hotelSettings}
          onUpdateHotelSettings={handleUpdateHotelSettings}
          currentRole={currentRole}
          loggedInUser={loggedInUser}
          onAddAuditLog={handleAddAuditLogDirectly}
          setSelectedBookingForCheckin={handleSetSelectedForCheckin}
          appRooms={rooms}
          appBookings={bookings}
          appCheckins={checkins}
          appInvoices={invoices}
          appExpenses={expenses}
          appStaff={staff}
          appAuditLogs={auditLogs}
          appWaterBottles={waterBottles}
          appPosItems={posItems}
          appPosOrders={posOrders}
          appInventoryProducts={inventoryProducts}
          appInventoryCategories={inventoryCategories}
          appInventorySuppliers={inventorySuppliers}
          appInventoryPurchases={inventoryPurchases}
          appInventoryStockMovements={inventoryStockMovements}
          appPettyCash={pettyCash}
          appCashBankAccounts={cashBankAccounts}
          appVouchers={vouchers}
          appOwnerPayments={ownerPayments}
          appReimbursements={reimbursements}
          appDailyClosings={dailyClosings}
          appLaundryOrders={laundryOrders}
          appLostAndFoundItems={lostAndFoundItems}
          appCleaningLogs={cleaningLogs}
          appTravelAgents={travelAgents}
          appAgentCommissionPayments={agentCommissionPayments}
          appPosAdvanceBookings={posAdvanceBookings}
          onUpdateRooms={handleUpdateRooms}
          onUpdateBookings={handleUpdateBookings}
          onUpdateCheckins={handleUpdateCheckins}
          onUpdateInvoices={handleUpdateInvoices}
          onUpdateExpenses={handleUpdateExpenses}
          onUpdateStaff={handleUpdateStaff}
          onUpdateWaterBottles={handleUpdateWaterBottles}
          onUpdatePosItems={handleUpdatePosItems}
          onUpdatePosOrders={handleUpdatePosOrders}
          onUpdateInventoryProducts={handleUpdateInventoryProducts}
          onUpdateInventoryCategories={handleUpdateInventoryCategories}
          onUpdateInventorySuppliers={handleUpdateInventorySuppliers}
          onUpdateInventoryPurchases={handleUpdateInventoryPurchases}
          onUpdateInventoryMovements={handleUpdateInventoryMovements}
          onUpdatePettyCash={handleUpdatePettyCash}
          onUpdateCashBankAccounts={handleUpdateCashBankAccounts}
          onUpdateVouchers={handleUpdateVouchers}
          onUpdateOwnerPayments={handleUpdateOwnerPayments}
          onUpdateReimbursements={handleUpdateReimbursements}
          onUpdateDailyClosings={handleUpdateDailyClosings}
          onUpdateLaundryOrders={handleUpdateLaundryOrders}
          onUpdateLostAndFoundItems={handleUpdateLostAndFoundItems}
          onUpdateCleaningLogs={handleUpdateCleaningLogs}
          onUpdateTravelAgents={handleUpdateTravelAgents}
          onUpdateAgentCommissionPayments={handleUpdateAgentCommissionPayments}
          onUpdatePosAdvanceBookings={handleUpdatePosAdvanceBookings}
        />
      );
    }

    switch (activeTab) {
      case 'hotelOwnerHub':
        return (
          <HotelOwnerView
            activeSubTab={ownerSubTab}
            onSelectSubTab={setOwnerSubTab}
            hotel={activeHotelObj}
            packages={packages}
            rooms={rooms}
            bookings={bookings}
            checkins={checkins}
            invoices={invoices}
            expenses={expenses}
            posOrders={posOrders}
            inventoryPurchases={inventoryPurchases}
            pettyCash={pettyCash}
            cashBankAccounts={cashBankAccounts}
            vouchers={vouchers}
            vendors={vendors}
            reimbursements={reimbursements}
            staff={staff}
            ownerPayments={ownerPayments}
            auditLogs={auditLogs}
            onUpdateHotel={handleUpdateSingleHotel}
            onUpdateExpenses={handleUpdateExpenses}
            onUpdateOwnerPayments={handleUpdateOwnerPayments}
            onAddAuditLog={handleAddAuditLogDirectly}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        );
      case 'pos':
        return (
          <PosView
            items={posItems}
            onUpdateItems={handleUpdatePosItems}
            orders={posOrders}
            onUpdateOrders={handleUpdatePosOrders}
            rooms={rooms}
            bookings={bookings}
            checkins={checkins}
            onUpdateCheckins={handleUpdateCheckins}
            inventoryProducts={inventoryProducts}
            onUpdateInventoryProducts={handleUpdateInventoryProducts}
            inventoryStockMovements={inventoryStockMovements}
            onUpdateInventoryMovements={handleUpdateInventoryMovements}
            posAdvanceBookings={posAdvanceBookings}
            onUpdatePosAdvanceBookings={handleUpdatePosAdvanceBookings}
            categories={posCategories}
            onUpdateCategories={handleUpdatePosCategories}
            selectedHotelId={effectiveTenantHotelId}
            hotelName={activeHotelObj?.name || hotelSettings.name}
            currentSubTab={posSubTab}
            onSelectSubTab={setPosSubTab}
            staff={staff}
            auditLogs={auditLogs}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            products={inventoryProducts}
            onUpdateProducts={handleUpdateInventoryProducts}
            categories={inventoryCategories}
            onUpdateCategories={handleUpdateInventoryCategories}
            suppliers={inventorySuppliers}
            onUpdateSuppliers={handleUpdateInventorySuppliers}
            purchases={inventoryPurchases}
            onUpdatePurchases={handleUpdateInventoryPurchases}
            stockMovements={inventoryStockMovements}
            onUpdateStockMovements={handleUpdateInventoryMovements}
            selectedHotelId={selectedHotelId}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'superAdminHub':
        return (
          <SuperAdminHub
            hotels={hotels}
            packages={packages}
            onUpdatePackages={handleUpdatePackages}
            customPages={customPages}
            onUpdateCustomPages={handleUpdateCustomPages}
            activeSubTab={superAdminSubTab}
            onSubTabChange={setSuperAdminSubTab}
            rawRooms={rawRooms}
            rawBookings={rawBookings}
            rawInvoices={rawInvoices}
            rawStaff={rawStaff}
            selectedHotelId={selectedHotelId}
            onSelectHotel={setSelectedHotelId}
            onAddHotel={handleAddHotel}
            onDeleteHotel={handleDeleteHotel}
            setCurrentRole={setCurrentRole}
            setActiveTab={setActiveTab}
            systemWebsite={systemWebsite}
            onUpdateSystemWebsite={handleUpdateSystemWebsite}
            onUpdateHotels={handleUpdateGlobalHotels}
          />
        );
      case 'frontDesk':
        return (
          <FrontDeskView
            currentSubTab={frontDeskSubTab}
            onSelectSubTab={(sub) => {
              setFrontDeskSubTab(sub);
            }}
            rooms={rooms}
            bookings={bookings}
            checkins={checkins}
            invoices={invoices}
            expenses={expenses}
            staff={staff}
            policies={policies}
            waterBottles={waterBottles}
            posOrders={posOrders}
            posItems={posItems}
            inventoryProducts={inventoryProducts}
            onUpdateInventoryProducts={handleUpdateInventoryProducts}
            inventoryStockMovements={inventoryStockMovements}
            onUpdateInventoryMovements={handleUpdateInventoryMovements}
            selectedHotelId={selectedHotelId}
            auditLogs={auditLogs}
            deletedItems={deletedItems}
            onMoveToDeletedFolder={handleMoveToDeletedFolder}
            onRestoreDeletedItem={handleRestoreDeletedItem}
            onPermanentDelete={handlePermanentDelete}
            roomVerifications={rawRoomVerifications.filter(rv => rv.hotelId === selectedHotelId)}
            hotelSettings={hotelSettings}
            currentRole={currentRole}
            loggedInUser={loggedInUser}
            selectedBookingForCheckin={selectedBookingForCheckin}
            setSelectedBookingForCheckin={setSelectedBookingForCheckin}
            selectedBookingForInvoice={selectedBookingForInvoice}
            setSelectedBookingForInvoice={setSelectedBookingForInvoice}
            onUpdateRooms={handleUpdateRooms}
            onUpdateBookings={handleUpdateBookings}
            onUpdateCheckins={handleUpdateCheckins}
            onUpdateInvoices={handleUpdateInvoices}
            onUpdatePolicies={handleUpdatePolicies}
            onUpdateHotelSettings={handleUpdateHotelSettings}
            onAddAuditLog={handleAddAuditLogDirectly}
            onAddRoomVerification={handleAddRoomVerification}
            onUpdateWaterBottles={handleUpdateWaterBottles}
            travelAgents={travelAgents}
            agentCommissionPayments={agentCommissionPayments}
            onUpdateTravelAgents={handleUpdateTravelAgents}
            onUpdateAgentCommissionPayments={handleUpdateAgentCommissionPayments}
          />
        );
      case 'dashboard':
        return (
          <DashboardView
            rooms={rooms}
            bookings={bookings}
            checkins={checkins}
            onUpdateCheckins={handleUpdateCheckins}
            invoices={invoices}
            expenses={expenses}
            staff={staff}
            currentRole={currentRole}
            setActiveTab={setActiveTab}
            setSelectedBookingForCheckin={handleSetSelectedForCheckin}
            setSelectedBookingForInvoice={handleSetSelectedForInvoice}
            waterBottles={waterBottles}
            onUpdateWaterBottles={handleUpdateWaterBottles}
            inventoryProducts={inventoryProducts}
            onUpdateInventoryProducts={handleUpdateInventoryProducts}
            inventoryStockMovements={inventoryStockMovements}
            onUpdateInventoryMovements={handleUpdateInventoryMovements}
            selectedHotelId={selectedHotelId}
            hotelName={hotels.find(h => h.id === selectedHotelId)?.name || hotelSettings?.name}
            onUpdateRooms={handleUpdateRooms}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'todayBookings':
        return (
          <TodayBookingsView
            rooms={rooms}
            bookings={bookings}
            checkins={checkins}
            staff={staff}
            invoices={invoices}
            hotelSettings={hotelSettings}
            onCheckIn={handleSetSelectedForCheckin}
            onCheckOut={handleSetSelectedForInvoice}
            onUpdateBookings={handleUpdateBookings}
            onUpdateCheckins={handleUpdateCheckins}
            onUpdateRooms={handleUpdateRooms}
            onUpdateInvoices={handleUpdateInvoices}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'rooms':
        return (
          <RoomManagementView
            rooms={rooms}
            currentRole={currentRole}
            activeSubTab={roomSubTab}
            onSubTabChange={setRoomSubTab}
            onUpdateRooms={handleUpdateRooms}
            maxRoomsLimit={activeMaxRooms}
            packageName={activePackageName}
            bookings={bookings}
            onUpdateBookings={handleUpdateBookings}
            hotelSettings={hotelSettings}
            onUpdateHotelSettings={handleUpdateHotelSettings}
            auditLogs={auditLogs}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'housekeeping':
        return (
          <HousekeepingView
            rooms={rooms}
            onUpdateRooms={handleUpdateRooms}
            staff={staff}
            bookings={bookings}
            checkins={checkins}
            onUpdateCheckins={handleUpdateCheckins}
            inventoryProducts={inventoryProducts}
            onUpdateInventoryProducts={handleUpdateInventoryProducts}
            inventoryStockMovements={inventoryStockMovements}
            onUpdateInventoryMovements={handleUpdateInventoryMovements}
            selectedHotelId={selectedHotelId}
            hotelSettings={hotelSettings}
            onUpdateHotelSettings={handleUpdateHotelSettings}
            laundryItems={laundryItems}
            onUpdateLaundryItems={handleUpdateLaundryItems}
            laundryOrders={laundryOrders}
            onUpdateLaundryOrders={handleUpdateLaundryOrders}
            lostAndFoundItems={lostAndFoundItems}
            onUpdateLostAndFoundItems={handleUpdateLostAndFoundItems}
            cleaningLogs={cleaningLogs}
            onUpdateCleaningLogs={handleUpdateCleaningLogs}
            auditLogs={auditLogs}
            onAddAuditLog={handleAddAuditLogDirectly}
            currentRole={currentRole}
            loggedInUser={loggedInUser}
            subTab={housekeepingSubTab}
            onSelectSubTab={setHousekeepingSubTab}
          />
        );
      case 'calendar':
        return (
          <CalendarBookingView
            rooms={rooms}
            bookings={bookings}
            setActiveTab={setActiveTab}
            setFrontDeskSubTab={setFrontDeskSubTab}
            onUpdateBookings={handleUpdateBookings}
            onUpdateRooms={handleUpdateRooms}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'bookings':
        return (
          <ReservationView
            waterBottles={waterBottles}
            onUpdateWaterBottles={handleUpdateWaterBottles}
            bookings={bookings}
            rooms={rooms}
            checkins={checkins}
            onUpdateCheckins={handleUpdateCheckins}
            posOrders={posOrders}
            loggedInUser={loggedInUser}
            currentRole={currentRole}
            onUpdateBookings={handleUpdateBookings}
            onUpdateRooms={handleUpdateRooms}
            onCheckIn={handleSetSelectedForCheckin}
            onCheckOut={handleSetSelectedForInvoice}
            onOpenCalendar={() => setActiveTab('calendar')}
            hotelSettings={hotelSettings}
            invoices={invoices}
            onUpdateInvoices={handleUpdateInvoices}
            onAddAuditLog={handleAddAuditLogDirectly}
            onMoveToDeletedFolder={handleMoveToDeletedFolder}
            travelAgents={travelAgents}
            onUpdateTravelAgents={handleUpdateTravelAgents}
          />
        );
      case 'checkin':
        return (
          <CheckInFormView
            waterBottles={waterBottles}
            bookings={bookings}
            rooms={rooms}
            checkins={checkins}
            selectedBooking={selectedBookingForCheckin}
            setSelectedBooking={setSelectedBookingForCheckin}
            onUpdateBookings={handleUpdateBookings}
            onUpdateRooms={handleUpdateRooms}
            onUpdateCheckins={handleUpdateCheckins}
            invoices={invoices}
            onUpdateInvoices={handleUpdateInvoices}
            currentRole={currentRole}
            staff={staff}
            onAddAuditLog={handleAddAuditLogDirectly}
            hotelSettings={hotelSettings}
            onUpdateHotelSettings={handleUpdateHotelSettings}
            loggedInUser={loggedInUser}
            travelAgents={travelAgents}
            onUpdateTravelAgents={handleUpdateTravelAgents}
          />
        );
      case 'invoice':
        return (
          <InvoiceView
            invoices={invoices}
            bookings={bookings}
            checkins={checkins}
            rooms={rooms}
            currentRole={currentRole}
            hotelSettings={hotelSettings}
            onUpdateHotelSettings={handleUpdateHotelSettings}
            selectedBookingForInvoice={selectedBookingForInvoice}
            setSelectedBookingForInvoice={setSelectedBookingForInvoice}
            onUpdateInvoices={handleUpdateInvoices}
            onUpdateCheckins={handleUpdateCheckins}
            onUpdateRooms={handleUpdateRooms}
            onUpdateBookings={handleUpdateBookings}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'reports':
        return (
          <ReportsView
            rooms={rooms}
            bookings={bookings}
            checkins={checkins}
            invoices={invoices}
            expenses={expenses}
            waterBottles={waterBottles}
            hotelSettings={hotelSettings}
            posOrders={posOrders}
            posItems={posItems}
            handovers={handovers}
            staff={staff}
            currentSubTab={reportsSubTab}
            onSelectSubTab={setReportsSubTab}
            onUpdateHotelSettings={handleUpdateHotelSettings}
            onUpdateInvoices={handleUpdateInvoices}
            onUpdateBookings={handleUpdateBookings}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'dailyReport':
        return (
          <DailyReportView
            rooms={rooms}
            bookings={bookings}
            checkins={checkins}
            invoices={invoices}
            expenses={expenses}
            staff={staff}
            hotelSettings={hotelSettings}
          />
        );
      case 'policies':
        return (
          <PolicyManager
            policies={policies}
            currentRole={currentRole}
            hotelSettings={hotelSettings}
            onUpdateHotelSettings={handleUpdateHotelSettings}
            onUpdatePolicies={handleUpdatePolicies}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'expenses':
        return (
          <ExpenseView
            expenses={expenses}
            currentRole={currentRole}
            onUpdateExpenses={handleUpdateExpenses}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'handover':
        return (
          <CashHandoverView
            handovers={handovers}
            currentRole={currentRole}
            onUpdateHandovers={handleUpdateHandovers}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'staff':
        return (
          <StaffManagementView
            staff={staff}
            currentRole={currentRole}
            hotelName={hotelSettings.name}
            rolePermissions={rawRolePermissions.filter(rp => rp.hotelId === selectedHotelId)}
            activeSubTab={staffSubTab}
            onSelectSubTab={setStaffSubTab}
            onUpdateStaff={handleUpdateStaff}
            onUpdateRolePermissions={handleUpdateRolePermissions}
            onUpdateAuditLogs={handleAddAuditLogDirectly}
            checkins={checkins}
            bookings={bookings}
            rooms={rooms}
            invoices={rawInvoices.filter(i => !i.hotelId || i.hotelId === effectiveTenantHotelId)}
          />
        );
      case 'userList':
        return (
          <GuestUserListView
            checkins={checkins}
            bookings={bookings}
            rooms={rooms}
            invoices={rawInvoices.filter(i => !i.hotelId || i.hotelId === effectiveTenantHotelId)}
            hotelId={selectedHotelId || effectiveTenantHotelId}
            hotelName={hotelSettings.name}
            initialSubTab={guestUserListSubTab}
            onNavigateToCheckIn={(prefill) => {
              setActiveTab('frontDesk');
              setFrontDeskSubTab('checkin');
            }}
            onNavigateToBooking={(prefill) => {
              setActiveTab('frontDesk');
              setFrontDeskSubTab('reservations');
            }}
          />
        );
      case 'auditLogs':
        return (
          <AuditLogsView
            auditLogs={currentRole === 'SuperAdmin' ? rawAuditLogs : auditLogs}
            hotelName={currentRole === 'SuperAdmin' ? 'All SaaS Properties' : hotelSettings.name}
          />
        );
      case 'otaManager':
        return (
          <OtaManagerView
            bookings={bookings}
            rooms={rooms}
            currentRole={currentRole}
            selectedHotelId={selectedHotelId}
            onUpdateBookings={handleUpdateBookings}
            onUpdateRooms={handleUpdateRooms}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'finance':
        return (
          <FinanceView
            hotelId={selectedHotelId}
            currentSubTab={financeSubTab}
            onSelectSubTab={setFinanceSubTab}
            bookings={bookings}
            checkins={checkins}
            invoices={invoices}
            expenses={expenses}
            posOrders={posOrders}
            pettyCash={pettyCash}
            cashBankAccounts={cashBankAccounts}
            vouchers={vouchers}
            vendors={vendors}
            ownerPayments={ownerPayments}
            reimbursements={reimbursements}
            dailyClosings={dailyClosings}
            inventoryPurchases={inventoryPurchases}
            inventorySuppliers={inventorySuppliers}
            auditLogs={auditLogs}
            hotelSettings={hotelSettings}
            currentRole={currentRole}
            onUpdatePettyCash={handleUpdatePettyCash}
            onUpdateCashBankAccounts={handleUpdateCashBankAccounts}
            onUpdateVouchers={handleUpdateVouchers}
            onUpdateVendors={handleUpdateVendors}
            onUpdateOwnerPayments={handleUpdateOwnerPayments}
            onUpdateReimbursements={handleUpdateReimbursements}
            onUpdateDailyClosings={handleUpdateDailyClosings}
            onUpdateExpenses={handleUpdateExpenses}
            onUpdateInvoices={handleUpdateInvoices}
            onUpdateInventoryPurchases={handleUpdateInventoryPurchases}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      case 'notifications': {
        const visibleRoleNotifications = filterNotificationsForRoleAndHotel(
          rawNotifications,
          currentRole,
          selectedHotelId
        );
        const unreadCount = visibleRoleNotifications.filter(n => !n.isRead).length;
        const statusFiltered = notificationPageFilter === 'unread'
          ? visibleRoleNotifications.filter(n => !n.isRead)
          : visibleRoleNotifications;
        const typeFiltered = notificationTypeFilter === 'all'
          ? statusFiltered
          : statusFiltered.filter(n => n.type === notificationTypeFilter);

        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(typeFiltered.length / pageSize));
        const safePage = Math.min(notificationPage, totalPages);
        const paginatedList = typeFiltered.slice((safePage - 1) * pageSize, safePage * pageSize);
        const selectedNotification = visibleRoleNotifications.find(n => n.id === selectedNotificationId) || null;
        const selectedTargetLink = selectedNotification
          ? resolveNotificationActionLink(selectedNotification, currentRole)
          : undefined;

        return (
          <div className="space-y-6">
            <div className="bg-luxury-brown-950 text-white rounded-3xl p-6 md:p-8 border border-luxury-gold-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-luxury-gold-400 text-xs font-mono uppercase tracking-widest font-bold">
                  <Bell className="w-4 h-4" />
                  <span>{currentRole === 'SuperAdmin' ? 'SaaS Platform Notification Center' : `${hotelSettings.name} • ${currentRole} Alerts`}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-luxury-beige-50">
                  Notifications & Real-Time Activity Alerts
                </h2>
                <p className="text-xs text-luxury-brown-300">
                  Strict tenant-isolated notification stream for your authenticated role ({currentRole}).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={refreshNotificationsFromServer}
                  disabled={isLoadingNotifications}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-luxury-beige-100 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNotifications ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationPageFilter('all');
                    setNotificationPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    notificationPageFilter === 'all'
                      ? 'bg-luxury-gold-500 text-luxury-brown-950'
                      : 'bg-white/10 text-luxury-beige-100 hover:bg-white/15'
                  }`}
                >
                  All ({visibleRoleNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationPageFilter('unread');
                    setNotificationPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    notificationPageFilter === 'unread'
                      ? 'bg-luxury-gold-500 text-luxury-brown-950'
                      : 'bg-white/10 text-luxury-beige-100 hover:bg-white/15'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsAsRead}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark All Read</span>
                  </button>
                )}
              </div>
            </div>

            {/* Opened / Selected Notification Full Detail Card */}
            {selectedNotification && (
              <div className="bg-gradient-to-br from-[#1C140E] via-[#261B13] to-[#1C140E] text-white rounded-3xl p-6 md:p-7 border-2 border-luxury-gold-500 shadow-2xl space-y-4 animate-fade-in">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-luxury-gold-500/20 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-luxury-gold-500 text-luxury-brown-950 text-[10px] font-mono uppercase tracking-widest font-bold">
                        Opened Notification
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-luxury-gold-300 text-[10px] font-mono uppercase font-bold">
                        {selectedNotification.type}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                          selectedNotification.severity === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : selectedNotification.severity === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : selectedNotification.severity === 'error'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {selectedNotification.severity || 'info'}
                      </span>
                    </div>
                    <h3 className="text-lg md:text-xl font-serif font-bold text-luxury-beige-50">
                      {selectedNotification.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedNotificationId(null)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-luxury-beige-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Close</span>
                  </button>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 md:p-5">
                  <p className="text-sm text-luxury-beige-100 leading-relaxed whitespace-pre-line">
                    {selectedNotification.message}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs font-mono text-luxury-brown-300">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5 text-luxury-gold-300">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Timestamp: {selectedNotification.createdAt}</span>
                    </span>
                    <span>ID: {selectedNotification.id}</span>
                    {selectedNotification.entityId && (
                      <span>Reference: {selectedNotification.entityId}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {selectedTargetLink && (
                      <button
                        type="button"
                        onClick={() => handleNavigateNotificationLink(selectedTargetLink)}
                        className="px-4 py-2 rounded-xl bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <span>Go to Related Section ({selectedTargetLink})</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Event Type Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {(currentRole === 'SuperAdmin'
                ? ['all', 'registration', 'approval', 'suspension', 'subscription']
                : ['all', 'booking', 'checkin', 'checkout', 'invoice', 'payment', 'expense', 'staff', 'subscription']
              ).map((typeKey) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => {
                    setNotificationTypeFilter(typeKey);
                    setNotificationPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-colors cursor-pointer ${
                    notificationTypeFilter === typeKey
                      ? 'bg-luxury-brown-900 text-luxury-gold-300 shadow-xs'
                      : 'bg-white border border-luxury-brown-200 text-luxury-brown-600 hover:bg-luxury-beige-100'
                  }`}
                >
                  {typeKey}
                </button>
              ))}
            </div>

            {notificationError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-xs text-rose-800">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{notificationError}</span>
                </div>
                <button
                  type="button"
                  onClick={refreshNotificationsFromServer}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-mono font-bold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-sm divide-y divide-luxury-brown-100 overflow-hidden">
              {isLoadingNotifications && paginatedList.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-luxury-gold-500 animate-spin mx-auto" />
                  <p className="text-base font-serif font-bold text-luxury-brown-900">
                    Syncing Notification History...
                  </p>
                </div>
              ) : paginatedList.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <Bell className="w-8 h-8 text-luxury-brown-300 mx-auto" />
                  <p className="text-base font-serif font-bold text-luxury-brown-900">
                    {notificationPageFilter === 'unread' ? 'No unread notifications' : 'No notifications found'}
                  </p>
                  <p className="text-xs text-luxury-brown-500">
                    You are all caught up on alerts for this portal.
                  </p>
                </div>
              ) : (
                paginatedList.map((item) => {
                  const targetLink = resolveNotificationActionLink(item, currentRole);
                  const isCurrentlySelected = item.id === selectedNotificationId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (!item.isRead) handleMarkNotificationAsRead(item.id);
                        setSelectedNotificationId(item.id);
                      }}
                      className={`p-5 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                        isCurrentlySelected
                          ? 'bg-luxury-gold-500/15 ring-2 ring-inset ring-luxury-gold-500'
                          : item.isRead
                          ? 'bg-white hover:bg-luxury-beige-50/60'
                          : 'bg-luxury-gold-500/5 hover:bg-luxury-gold-500/10'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!item.isRead && <span className="w-2 h-2 rounded-full bg-luxury-gold-500 shrink-0" />}
                          <h4 className={`text-sm ${item.isRead ? 'font-semibold text-luxury-brown-800' : 'font-bold text-luxury-brown-950'}`}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-luxury-beige-100 text-luxury-brown-700 font-bold">
                            {item.type}
                          </span>
                          {isCurrentlySelected && (
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-luxury-brown-950 text-luxury-gold-400 font-bold">
                              Opened
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-luxury-brown-600 leading-relaxed">{item.message}</p>
                        <div className="flex items-center gap-4 pt-1 text-[11px] font-mono text-luxury-brown-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {item.createdAt}
                          </span>
                          {targetLink && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!item.isRead) handleMarkNotificationAsRead(item.id);
                                handleNavigateNotificationLink(targetLink);
                              }}
                              className="text-luxury-gold-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              Go to Module <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!item.isRead) handleMarkNotificationAsRead(item.id);
                            setSelectedNotificationId(item.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-luxury-brown-950 hover:bg-luxury-brown-800 text-luxury-gold-300 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                        >
                          {isCurrentlySelected ? 'Viewing' : 'View'}
                        </button>
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkNotificationAsRead(item.id);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-luxury-beige-100 hover:bg-luxury-gold-500 hover:text-luxury-brown-950 text-luxury-brown-800 text-[11px] font-mono font-bold shrink-0 transition-colors cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-luxury-brown-100 text-xs font-mono">
                <span className="text-luxury-brown-600">
                  Page <strong>{safePage}</strong> of <strong>{totalPages}</strong> ({typeFiltered.length} notifications)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setNotificationPage(Math.max(1, safePage - 1))}
                    className="px-3 py-1.5 rounded-lg border border-luxury-brown-200 disabled:opacity-40 hover:bg-luxury-beige-50 font-bold cursor-pointer"
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setNotificationPage(Math.min(totalPages, safePage + 1))}
                    className="px-3 py-1.5 rounded-lg border border-luxury-brown-200 disabled:opacity-40 hover:bg-luxury-beige-50 font-bold cursor-pointer"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'profile':
        return (
          <ProfileSettingsView
            activeSection={profileSection}
            onSelectSection={(sec) => {
              setProfileSection(sec as any);
              try {
                sessionStorage.setItem('pms_profile_section', sec);
              } catch {}
            }}
            currentRole={currentRole}
            loggedInUser={loggedInUser}
            hotels={hotels}
            selectedHotelId={selectedHotelId}
            onSelectHotel={setSelectedHotelId}
            rawStaff={rawStaff}
            hotelSettings={hotelSettings}
            onUpdateGlobalHotels={handleUpdateGlobalHotels}
            onUpdateGlobalStaff={handleUpdateGlobalStaff}
            onAddAuditLog={handleAddAuditLogDirectly}
          />
        );
      default:
        return <div className="p-8 text-center text-luxury-brown-500">Selection Tab under construction.</div>;
    }
  };

  // Safe binders for deep check-ins
  const handleSetSelectedForCheckin = (bk: Booking | null) => {
    setSelectedBookingForCheckin(bk);
    setActiveTab('frontDesk');
    setFrontDeskSubTab('checkin');
    try {
      if (window.location.pathname !== '/admin/frontDesk/checkin') {
        window.history.pushState({}, '', '/admin/frontDesk/checkin');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore navigation history errors
    }
  };

  const handleSetSelectedForInvoice = (bk: Booking | null) => {
    setSelectedBookingForInvoice(bk);
    setActiveTab('frontDesk');
    setFrontDeskSubTab('billing');
  };

  const handleNavigateNotificationLink = (linkPath: string) => {
    if (!linkPath) return;
    window.history.pushState({}, '', linkPath);
    syncStateFromLocation(linkPath, isAuthenticated, currentRole);
  };

  const handleOpenSingleNotification = (notif: AppNotification) => {
    if (!notif) return;
    if (!notif.isRead) {
      handleMarkNotificationAsRead(notif.id);
    }
    setNotificationPageFilter('all');
    setNotificationTypeFilter('all');

    const visibleList = filterNotificationsForRoleAndHotel(
      rawNotifications,
      currentRole,
      selectedHotelId
    );
    const idx = visibleList.findIndex(n => n.id === notif.id);
    if (idx >= 0) {
      setNotificationPage(Math.floor(idx / 10) + 1);
    } else {
      setNotificationPage(1);
    }

    setSelectedNotificationId(notif.id);
    setActiveTab('notifications');

    const notifCenterPath =
      currentRole === 'SuperAdmin'
        ? '/superadmin/notifications'
        : currentRole === 'Owner'
        ? '/hotelowner/notifications'
        : '/admin/notifications';
    window.history.pushState({}, '', notifCenterPath);
  };

  const handleSwitchPortalLogin = (mode: LoginPortalMode) => {
    if (mode === 'superadmin') {
      window.history.pushState({}, '', '/superadmin');
      syncStateFromLocation('/superadmin', isAuthenticated, currentRole);
    } else if (mode === 'hotelowner') {
      window.history.pushState({}, '', '/hotelowner');
      syncStateFromLocation('/hotelowner', isAuthenticated, currentRole);
    } else if (mode === 'admin') {
      window.history.pushState({}, '', '/admin');
      syncStateFromLocation('/admin', isAuthenticated, currentRole);
    } else {
      setPortalLoginMode(null);
      setUnauthView('login');
      window.history.pushState({}, '', '/login');
    }
  };

  const renderGlobalToastOverlay = () => {
    if (activeToasts.length === 0) return null;

    return (
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-[calc(100vw-2.5rem)] sm:w-full pointer-events-none no-print">
        {activeToasts.map((t) => {
          const isSuccess = t.severity === 'success';
          const isError = t.severity === 'error';
          const isWarning = t.severity === 'warning';

          const badgeLabel =
            t.title ||
            (isSuccess
              ? 'Success'
              : isError
              ? 'Action Blocked'
              : isWarning
              ? 'Attention Required'
              : 'System Notice');

          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-fade-in ${
                isSuccess
                  ? 'bg-gradient-to-r from-[#0B261C]/95 via-[#0F3325]/95 to-[#0A2018]/95 text-emerald-50 border-emerald-500/40 shadow-emerald-950/50'
                  : isError
                  ? 'bg-gradient-to-r from-[#2D0C12]/95 via-[#3B1018]/95 to-[#24090E]/95 text-rose-50 border-rose-500/40 shadow-rose-950/50'
                  : isWarning
                  ? 'bg-gradient-to-r from-[#2E1E08]/95 via-[#3B270B]/95 to-[#241705]/95 text-amber-50 border-amber-500/40 shadow-amber-950/50'
                  : 'bg-gradient-to-r from-[#1C140E]/95 via-[#261B13]/95 to-[#160F0A]/95 text-luxury-beige-50 border-luxury-gold-500/40 shadow-black/60'
              }`}
            >
              {/* Subtle top accent glow bar */}
              <div
                className={`h-1 w-full ${
                  isSuccess
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500'
                    : isError
                    ? 'bg-gradient-to-r from-rose-500 via-red-400 to-rose-600'
                    : isWarning
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500'
                    : 'bg-gradient-to-r from-luxury-gold-400 via-amber-200 to-luxury-gold-600'
                }`}
              />

              <div className="p-4 flex items-start gap-3.5">
                {/* Icon Badge */}
                <div
                  className={`p-2.5 rounded-xl shrink-0 border ${
                    isSuccess
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      : isError
                      ? 'bg-rose-500/15 border-rose-400/30 text-rose-300'
                      : isWarning
                      ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                      : 'bg-luxury-gold-500/15 border-luxury-gold-400/30 text-luxury-gold-300'
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isError ? (
                    <XCircle className="w-5 h-5" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-[0.18em] font-bold ${
                        isSuccess
                          ? 'text-emerald-300'
                          : isError
                          ? 'text-rose-300'
                          : isWarning
                          ? 'text-amber-300'
                          : 'text-luxury-gold-400'
                      }`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="text-[9px] font-mono opacity-50">DirectStay</span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-medium leading-relaxed whitespace-pre-line break-words text-white/95">
                    {t.message}
                  </p>
                  {t.onConfirm && (
                    <div className="pt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => t.onConfirm && t.onConfirm()}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-[#1C140E] shadow-sm transition-colors cursor-pointer"
                      >
                        {t.confirmLabel || 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => (t.onCancel ? t.onCancel() : dismissToast(t.id))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 transition-colors cursor-pointer"
                      >
                        {t.cancelLabel || 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors shrink-0 cursor-pointer"
                  aria-label="Close notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isNotFoundRoute) {
    return (
      <div className="min-h-screen bg-[#1C140E] flex items-center justify-center p-6 text-luxury-beige-50 font-sans">
        {renderGlobalToastOverlay()}
        <div className="max-w-lg w-full bg-[#241A13] border border-luxury-gold-500/20 rounded-3xl p-8 md:p-10 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-luxury-gold-500/15 border border-luxury-gold-500/30 rounded-2xl flex items-center justify-center mx-auto text-luxury-gold-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-luxury-gold-500 font-bold">Error 404 • Route Not Found</p>
            <h1 className="text-3xl font-serif font-bold text-white">Page Does Not Exist</h1>
            <p className="text-sm text-[#B8A590] leading-relaxed">
              The requested path <code className="px-2 py-0.5 bg-black/40 rounded text-luxury-gold-400 font-mono text-xs">{typeof window !== 'undefined' ? window.location.pathname : ''}</code> is not registered in the DirectStay PMS routing directory.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setIsNotFoundRoute(false);
                const dest = isAuthenticated ? getRoleBasePath(currentRole) : '/';
                window.history.pushState({}, '', dest);
                syncStateFromLocation(dest, isAuthenticated, currentRole);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isAuthenticated ? `Return to ${currentRole} Portal` : 'Return to Public Website'}</span>
            </button>
            <button
              onClick={() => {
                setIsNotFoundRoute(false);
                setPortalLoginMode(null);
                if (isAuthenticated) {
                  setIsPublicWebsiteForced(true);
                } else {
                  setUnauthView('front-website');
                }
                window.history.pushState({}, '', '/');
              }}
              className="w-full sm:w-auto px-5 py-3 bg-white/5 hover:bg-white/10 text-luxury-beige-200 border border-white/10 font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Public Homepage (/)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dedicated Hotel-Specific Public Booking & Calendar Page (`/?hotelBooking=<id>` or `/book/<id>`)
  const renderPublicHotelBookingPage = (embedded = false) => {
    const targetHotel: Hotel =
      hotels.find(h => h.id === publicHotelBookingId) ||
      hotels.find(h => h.id === selectedHotelId) ||
      hotels[0] ||
      {
        id: publicHotelBookingId || selectedHotelId || 'hotel-1',
        name: 'Loading hotel...',
        address: '',
        gstNumber: '',
        phoneNumber: '',
        emailAddress: '',
        website: '',
        logoUrl: '',
      };
    const effectiveBookHotelId = targetHotel?.id || publicHotelBookingId || selectedHotelId || 'hotel-1';
    const hotelMatchingRooms = rawRooms.filter(r => r.hotelId === effectiveBookHotelId);
    const targetRooms = hotelMatchingRooms.length > 0 ? hotelMatchingRooms : rawRooms;
    const hotelMatchingBookings = rawBookings.filter(b => b.hotelId === effectiveBookHotelId);
    const targetBookings = hotelMatchingBookings.length > 0 ? hotelMatchingBookings : rawBookings;
    const targetSettings: HotelSettings = targetHotel
      ? {
          id: targetHotel.id,
          logoUrl: targetHotel.logoUrl,
          name: targetHotel.name,
          address: targetHotel.address,
          gstNumber: targetHotel.gstNumber,
          phoneNumber: targetHotel.phoneNumber,
          emailAddress: targetHotel.emailAddress,
          website: targetHotel.website,
          checkInTime: targetHotel.checkInTime || '12:00 PM',
          checkOutTime: targetHotel.checkOutTime || '11:00 AM',
          isGstEnabled: targetHotel.isGstEnabled ?? true,
          defaultGstRate: targetHotel.defaultGstRate ?? 5,
        }
      : hotelSettings;

    return (
      <div className="relative">
        {!embedded && renderGlobalToastOverlay()}
        {!embedded && isAuthenticated && (
          <div className="fixed bottom-6 left-6 z-[60] bg-[#1C140E]/95 backdrop-blur-md border border-luxury-gold-500/40 px-4 py-2.5 rounded-2xl shadow-2xl flex flex-wrap items-center gap-2.5 text-xs text-luxury-beige-100 no-print">
            <div className="flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                <strong>{loggedInUser}</strong> ({currentRole})
              </span>
            </div>
            <button
              onClick={() => {
                setPublicHotelBookingId(null);
                const dest = getRoleBasePath(currentRole);
                window.history.pushState({}, '', dest);
                syncStateFromLocation(dest, isAuthenticated, currentRole);
              }}
              className="px-3 py-1 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-lg transition-all cursor-pointer"
            >
              ← Return to {currentRole} PMS
            </button>
            <button
              onClick={() => {
                setPublicHotelBookingId(null);
                setIsPublicWebsiteForced(true);
                window.history.pushState({}, '', '/');
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-luxury-gold-300 border border-luxury-gold-500/30 font-bold rounded-lg transition-all cursor-pointer"
            >
              SaaS Homepage
            </button>
          </div>
        )}
        <HotelPublicBookingPage
          hotel={targetHotel}
          rooms={targetRooms}
          bookings={targetBookings}
          isAuthenticatedStaff={isAuthenticated}
          onBackToDashboard={() => {
            setPublicHotelBookingId(null);
            if (isAuthenticated) {
              const dest = getRoleBasePath(currentRole);
              window.history.pushState({}, '', dest);
              syncStateFromLocation(dest, isAuthenticated, currentRole);
            } else {
              setUnauthView('front-website');
              window.history.pushState({}, '', '/');
            }
          }}
          onOpenAdvanceBookings={() => {
            setPublicHotelBookingId(null);
            if (currentRole === 'Owner') {
              setActiveTab('hotelOwnerHub');
              setOwnerSubTab('bookings');
              window.history.pushState({}, '', '/hotelowner/bookings');
            } else {
              setActiveTab('frontDesk');
              setFrontDeskSubTab('reservations');
              window.history.pushState({}, '', '/admin/frontDesk/reservations');
            }
          }}
          onApprovePendingBooking={bkId => {
            const updatedBookings = rawBookings.map(b =>
              b.id === bkId
                ? {
                    ...b,
                    status: 'Confirmed' as const,
                    notes: b.notes
                      ? b.notes.replace('[Direct Guest Booking Link • Needs Hotel Approval]', '[Approved by Hotel]')
                      : 'Approved by Hotel',
                  }
                : b
            );
            setRawBookings(updatedBookings);
            savePmsData({ bookings: updatedBookings });
            const targetBk = rawBookings.find(b => b.id === bkId);
            if (targetBk) {
              handleAddAuditLogDirectly(
                'Guest Booking Approved',
                `Approved direct guest booking #${targetBk.id} for ${targetBk.guestName} (Room ${targetBk.roomNumber}, ${targetBk.checkInDate} → ${targetBk.checkOutDate}).`,
                effectiveBookHotelId
              );
            }
            showToast('Direct guest booking APPROVED & confirmed!', 'success');
          }}
          onRejectPendingBooking={bkId => {
            const updatedBookings = rawBookings.map(b =>
              b.id === bkId
                ? {
                    ...b,
                    status: 'Cancelled' as const,
                    cancellationReason: 'Rejected by Hotel',
                  }
                : b
            );
            setRawBookings(updatedBookings);
            savePmsData({ bookings: updatedBookings });
            const targetBk = rawBookings.find(b => b.id === bkId);
            if (targetBk) {
              handleAddAuditLogDirectly(
                'Guest Booking Rejected',
                `Rejected direct guest booking #${targetBk.id} for ${targetBk.guestName} (Room ${targetBk.roomNumber}).`,
                effectiveBookHotelId
              );
            }
            showToast('Direct guest booking rejected.', 'info');
          }}
          onSubmitGuestBooking={newBooking => {
            const bookingWithHotel: Booking = {
              ...newBooking,
              hotelId: effectiveBookHotelId,
              status: 'Pending',
              bookingSource: 'Guest Self Service',
            };
            const mergedBookings = [
              ...rawBookings.filter(b => b.id !== bookingWithHotel.id),
              bookingWithHotel,
            ];
            setRawBookings(mergedBookings);
            // Always persist to local and cloud PMS store so reception sees it immediately
            savePmsData({ bookings: mergedBookings });
            try {
              localStorage.setItem('GP_PMS_BOOKINGS', JSON.stringify(mergedBookings));
            } catch {}

            if (isAuthenticated) {
              handleAddAuditLogDirectly(
                'Direct Guest Booking Submitted (Pending Approval)',
                `Guest ${bookingWithHotel.guestName} (${bookingWithHotel.mobile}) submitted Direct Booking #${bookingWithHotel.id} for Room ${bookingWithHotel.roomNumber} (${bookingWithHotel.checkInDate} → ${bookingWithHotel.checkOutDate}). Awaiting hotel approval.`,
                effectiveBookHotelId
              );
              emitNotification({
                hotelId: effectiveBookHotelId,
                recipientRole: 'All',
                title: `New Direct Booking (Needs Approval): ${bookingWithHotel.guestName}`,
                message: `Direct guest booking #${bookingWithHotel.id} for Room ${bookingWithHotel.roomNumber} (${bookingWithHotel.checkInDate} → ${bookingWithHotel.checkOutDate}) awaits your approval in Advance Bookings.`,
                type: 'booking',
                severity: 'warning',
                linkPath: '/admin/frontDesk/reservations',
                entityId: bookingWithHotel.id,
                dedupeKey: `${effectiveBookHotelId}:booking:pending:${bookingWithHotel.id}`,
              });
            }
          }}
        />
      </div>
    );
  };

  // Standalone Direct Guest Digital Menu (`/?digitalMenu=<id>`, `/digital-menu/<id>`, `/menu/<id>`)
  if (publicDigitalMenuHotelId !== null) {
    const targetMenuHotel =
      hotels.find(h => h.id === publicDigitalMenuHotelId) ||
      hotels[0] || {
        id: publicDigitalMenuHotelId || selectedHotelId || 'hotel-1',
        name: hotelSettings.name || 'Hotel Room Service'
      };
    const menuHotelId = targetMenuHotel.id || publicDigitalMenuHotelId || 'hotel-1';
    const hotelMenuItems = rawPosItems.filter(
      i => (i.hotelId || 'hotel-1') === menuHotelId || !i.hotelId
    );
    const hotelRooms = rawRooms.filter(
      r => (r.hotelId || 'hotel-1') === menuHotelId || !r.hotelId
    );
    const hotelCheckins = rawCheckins.filter(
      c => (c.hotelId || 'hotel-1') === menuHotelId || !c.hotelId
    );
    const hotelOrders = rawPosOrders.filter(
      o => (o.hotelId || 'hotel-1') === menuHotelId || !o.hotelId
    );

    return (
      <div className="relative">
        {renderGlobalToastOverlay()}
        <DigitalMenuView
          hotelId={menuHotelId}
          hotelName={targetMenuHotel.name || hotelSettings.name}
          items={hotelMenuItems}
          rooms={hotelRooms}
          checkins={hotelCheckins}
          orders={hotelOrders}
          onUpdateOrders={updated => {
            const others = rawPosOrders.filter(o => (o.hotelId || 'hotel-1') !== menuHotelId);
            const merged = [...others, ...updated.map(o => ({ ...o, hotelId: menuHotelId }))];
            setRawPosOrders(merged);
            savePmsData({ posOrders: merged });
          }}
          onUpdateCheckins={updated => {
            const others = rawCheckins.filter(c => (c.hotelId || 'hotel-1') !== menuHotelId);
            const merged = [...others, ...updated.map(c => ({ ...c, hotelId: menuHotelId }))];
            setRawCheckins(merged);
            savePmsData({ checkins: merged });
          }}
          onBackToAdmin={
            isAuthenticated
              ? () => {
                  setPublicDigitalMenuHotelId(null);
                  const dest = getRoleBasePath(currentRole);
                  window.history.pushState({}, '', dest);
                }
              : undefined
          }
        />
      </div>
    );
  }

  // Standalone Direct Guest Booking & Check-In Portal (`/?hotelBooking=<id>` or `/book/<id>`)
  if (publicHotelBookingId !== null) {
    return renderPublicHotelBookingPage(false);
  }

  // Dedicated role-specific Login Page when visiting /superadmin, /admin, or /hotelowner without matching role session
  if (portalLoginMode !== null) {
    return (
      <div className="relative">
        {renderGlobalToastOverlay()}
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          portalMode={portalLoginMode}
          onSwitchPortal={handleSwitchPortalLogin}
          onAddAuditLog={handleAddAuditLogDirectly}
          activeSessionInfo={isAuthenticated ? { username: loggedInUser, role: currentRole } : null}
          onReturnToActiveSession={
            isAuthenticated
              ? () => {
                  setPortalLoginMode(null);
                  const dest = getRoleBasePath(currentRole);
                  window.history.pushState({}, '', dest);
                  syncStateFromLocation(dest, isAuthenticated, currentRole);
                }
              : undefined
          }
          onOnboardHotel={() => {
            setPortalLoginMode(null);
            if (isAuthenticated) {
              setIsPublicWebsiteForced(true);
            } else {
              setUnauthView('front-website');
            }
            setPublicSeoPage('home');
            window.history.pushState({}, '', '/?onboard=1');
          }}
        />
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => {
              setPortalLoginMode(null);
              if (isAuthenticated) {
                setIsPublicWebsiteForced(true);
              } else {
                setUnauthView('front-website');
              }
              window.history.pushState({}, '', '/');
            }}
            className="px-4 py-2 bg-[#1C140E] border border-luxury-gold-500/20 text-luxury-gold-400 font-bold text-xs rounded-xl hover:bg-black/80 transition-colors cursor-pointer"
          >
            ← Back to Public Website
          </button>
        </div>
      </div>
    );
  }

  if (isRedeemingPosHandoff) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center">
        <div className="text-center space-y-2">
          <RefreshCw className="w-7 h-7 text-[#C49A3A] animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#17120F]">Opening DirectStay POS Terminal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (isPublicWebsiteForced && publicHotelBookingId === null)) {
    if (unauthView === 'front-website' || isPublicWebsiteForced) {
      return (
        <div className="relative">
          {renderGlobalToastOverlay()}
          {isAuthenticated && isPublicWebsiteForced && (
            <div className="fixed bottom-6 left-6 z-[60] bg-[#1C140E]/95 backdrop-blur-md border border-luxury-gold-500/40 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs text-luxury-beige-100">
              <div className="flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span><strong>{loggedInUser}</strong> ({currentRole})</span>
              </div>
              <button
                onClick={() => {
                  setIsPublicWebsiteForced(false);
                  const dest = getRoleBasePath(currentRole);
                  window.history.pushState({}, '', dest);
                  syncStateFromLocation(dest, isAuthenticated, currentRole);
                }}
                className="px-3 py-1 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-lg transition-all cursor-pointer"
              >
                Open {currentRole} Dashboard →
              </button>
            </div>
          )}

          {isPrototypeWebsite ? (
            <FrontWebsitePrototype
              onOnboardComplete={handleOnboardComplete}
              onNavigateToLogin={() => {
                setIsPublicWebsiteForced(false);
                setPortalLoginMode('general');
                setUnauthView('login');
                window.history.pushState({}, '', '/login');
              }}
              systemWebsite={systemWebsite}
              customPages={customPages}
              activeSeoPage={publicSeoPage}
              activeBlogSlug={selectedBlogSlug}
              onNavigateSeoPage={(pageKey, blogSlug) => {
                let targetPath = PUBLIC_SEO_PAGES[pageKey]?.path || '/';
                if (pageKey === 'blog-article' && blogSlug) {
                  targetPath = `/blog/${blogSlug}/`;
                  setSelectedBlogSlug(blogSlug);
                } else if (pageKey === 'blog') {
                  setSelectedBlogSlug(null);
                }
                setPublicSeoPage(pageKey);
                window.history.pushState({}, '', targetPath);
                if (!['features', 'pricing', 'about', 'contact'].includes(pageKey)) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                if (pageKey === 'pricing') {
                  trackSeoConversionEvent('pricing_page_view', { pagePath: targetPath });
                }
              }}
            />
          ) : (
            <FrontWebsite 
              onOnboardComplete={handleOnboardComplete} 
              onNavigateToLogin={() => {
                setIsPublicWebsiteForced(false);
                setPortalLoginMode('general');
                setUnauthView('login');
                window.history.pushState({}, '', '/login');
              }} 
              systemWebsite={systemWebsite}
              customPages={customPages}
              activeSeoPage={publicSeoPage}
              activeBlogSlug={selectedBlogSlug}
              onNavigateSeoPage={(pageKey, blogSlug) => {
                let targetPath = PUBLIC_SEO_PAGES[pageKey]?.path || '/';
                if (pageKey === 'blog-article' && blogSlug) {
                  targetPath = `/blog/${blogSlug}/`;
                  setSelectedBlogSlug(blogSlug);
                } else if (pageKey === 'blog') {
                  setSelectedBlogSlug(null);
                }
                setPublicSeoPage(pageKey);
                window.history.pushState({}, '', targetPath);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (pageKey === 'pricing') {
                  trackSeoConversionEvent('pricing_page_view', { pagePath: targetPath });
                }
              }}
            />
          )}
        </div>
      );
    }
    return (
      <div className="relative">
        {renderGlobalToastOverlay()}
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          portalMode="general"
          onSwitchPortal={handleSwitchPortalLogin}
          onAddAuditLog={handleAddAuditLogDirectly}
          onOnboardHotel={() => {
            setPortalLoginMode(null);
            setUnauthView('front-website');
            setPublicSeoPage('home');
            window.history.pushState({}, '', '/?onboard=1');
          }}
        />
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => {
              setUnauthView('front-website');
              window.history.pushState({}, '', '/');
            }}
            className="px-4 py-2 bg-[#1C140E] border border-luxury-gold-500/20 text-luxury-gold-400 font-bold text-xs rounded-xl hover:bg-black/80 transition-colors cursor-pointer"
          >
            ← Back to Public Website
          </button>
        </div>
      </div>
    );
  }

  const currentPortalLabel =
    currentRole === 'SuperAdmin'
      ? 'Super Admin Console'
      : currentRole === 'Owner'
      ? 'Hotel Owner Portal'
      : `${hotelSettings.name} PMS`;

  const superAdminSectionNames: Record<string, string> = {
    dashboard: 'SaaS Operations Dashboard',
    hotels: 'Hotel Properties',
    packages: 'Packages & Subscriptions',
    users: 'User Credentials',
    leads: 'Salesperson Lead Management & CRM',
    website: 'Website CMS',
    pages: 'Custom Pages'
  };

  const ownerSectionNames: Record<string, string> = {
    dashboard: 'Executive Overview',
    property: 'Property Details',
    bookings: 'Booking Registry',
    financials: 'Revenue & Expenses',
    occupancy: 'Financial & Occupancy Reports',
    staff: 'Staff Overview',
    subscription: 'Subscription & Billing',
    auditLogs: 'Security Audit Logs'
  };

  const adminSectionNames: Record<string, string> = {
    dashboard: 'Dashboard',
    calendar: 'Stay Overview',
    frontDesk: 'Front Office',
    invoice: 'Invoices & Billing',
    rooms: 'Property Setup',
    housekeeping: 'Housekeeping',
    pos: 'POS Terminal & Food',
    inventory: 'Inventory Store',
    otaManager: 'Channel Manager',
    bookingEngine: 'Booking Engine',
    finance: 'Finance Hub',
    reports: 'Reports & Graphs',
    staff: 'Administration & Users',
    userList: 'Guest Profiles',
    auditLogs: 'Audit Logs',
    notifications: 'Notifications Center',
    profile: 'Configuration & Profile'
  };

  const leavePublicBookingView = () => {
    if (publicHotelBookingId !== null) setPublicHotelBookingId(null);
  };

  const currentSectionLabel =
    publicHotelBookingId !== null
      ? 'Public Website (/)'
      : activeTab === 'profile'
      ? 'Profile Settings'
      : activeTab === 'notifications'
      ? 'Notifications Center'
      : currentRole === 'SuperAdmin'
      ? superAdminSectionNames[superAdminSubTab] || superAdminSubTab
      : currentRole === 'Owner'
      ? ownerSectionNames[ownerSubTab] || ownerSubTab
      : adminSectionNames[activeTab] || activeTab;

  const unreadRoleNotificationCount = filterNotificationsForRoleAndHotel(
    rawNotifications,
    currentRole,
    selectedHotelId
  ).filter((n) => !n.isRead).length;

  const handleOpenPublicWebsitePreview = () => {
    const targetHotelId = selectedHotelId || hotels[0]?.id || 'hotel-1';
    setPublicHotelBookingId(targetHotelId);
    window.history.pushState({}, '', `/?hotelBooking=${encodeURIComponent(targetHotelId)}`);
  };

  if (isStandalonePosMode && activeTab === 'pos' && publicHotelBookingId === null) {
    const activePosHotelObj = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
    const mergedPosHotelSettings = activePosHotelObj
      ? { ...hotelSettings, ...activePosHotelObj }
      : hotelSettings;
    const posCaps = resolvePosCapabilities(mergedPosHotelSettings, selectedHotelId);
    const scopedPosItems = rawPosItems.filter(
      (i) => (i.hotelId || 'hotel-1') === (selectedHotelId || 'hotel-1')
    );
    const scopedPosOrders = rawPosOrders.filter(
      (o) => (o.hotelId || 'hotel-1') === (selectedHotelId || 'hotel-1')
    );

    return (
      <>
        <StandalonePosLayout
          activeSubTab={posSubTab}
          onSelectSubTab={(sub) => setPosSubTab(sub)}
          hotels={hotels}
          selectedHotelId={selectedHotelId}
          onSelectHotel={(id) => {
            setSelectedHotelId(id);
            sessionStorage.setItem('pms_hotel_id', id);
            localStorage.setItem('pms_hotel_id', id);
          }}
          hotelName={activePosHotelObj?.name || hotelSettings.name || 'DirectStay Property'}
          posCapabilities={posCaps}
          posItems={scopedPosItems}
          posOrders={scopedPosOrders}
          loggedInUser={loggedInUser}
          currentRole={currentRole}
          onBackToPms={() => {
            setIsStandalonePosMode(false);
            setActiveTab('dashboard');
            const dest = getRoleBasePath(currentRole);
            window.history.pushState({}, '', dest);
          }}
          onLogout={handleLogout}
          notificationBellNode={
            <NotificationBellAndDrawer
              notifications={rawNotifications}
              currentRole={currentRole}
              selectedHotelId={selectedHotelId}
              onMarkAsRead={handleMarkNotificationAsRead}
              onMarkAllAsRead={handleMarkAllNotificationsAsRead}
              onNavigateLink={handleNavigateNotificationLink}
              onOpenNotification={handleOpenSingleNotification}
              isLoading={isLoadingNotifications}
              error={notificationError}
              isRealtimeConnected={isRealtimeConnected}
              onRefresh={refreshNotificationsFromServer}
            />
          }
        >
          {renderTabContent()}
        </StandalonePosLayout>
        {renderGlobalToastOverlay()}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-luxury-beige-50 flex flex-col md:flex-row text-luxury-brown-950 font-sans selection:bg-luxury-gold-300 selection:text-luxury-brown-900">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab: any) => { leavePublicBookingView(); setActiveTab(tab); }} 
        superAdminSubTab={superAdminSubTab}
        onSelectSuperAdminSubTab={(t: any) => { leavePublicBookingView(); setSuperAdminSubTab(t); }}
        ownerSubTab={ownerSubTab}
        onSelectOwnerSubTab={(t: any) => { leavePublicBookingView(); setOwnerSubTab(t); }}
        financeSubTab={financeSubTab}
        onSelectFinanceSubTab={(t: any) => { leavePublicBookingView(); setFinanceSubTab(t); }}
        frontDeskSubTab={frontDeskSubTab}
        onSelectFrontDeskSubTab={(t: any) => { leavePublicBookingView(); setFrontDeskSubTab(t); }}
        roomSubTab={roomSubTab}
        onSelectRoomSubTab={(t: any) => { leavePublicBookingView(); setRoomSubTab(t); }}
        housekeepingSubTab={housekeepingSubTab}
        onSelectHousekeepingSubTab={(t: any) => { leavePublicBookingView(); setHousekeepingSubTab(t); }}
        posSubTab={posSubTab}
        onSelectPosSubTab={(t: any) => { leavePublicBookingView(); setPosSubTab(t); }}
        inventorySubTab={inventorySubTab}
        onSelectInventorySubTab={(t: any) => { leavePublicBookingView(); setInventorySubTab(t); }}
        otaSubTab={otaSubTab}
        onSelectOtaSubTab={(t: any) => { leavePublicBookingView(); setOtaSubTab(t); }}
        reportsSubTab={reportsSubTab}
        onSelectReportsSubTab={(t: any) => { leavePublicBookingView(); setReportsSubTab(t); }}
        staffSubTab={staffSubTab}
        onSelectStaffSubTab={(t: any) => { leavePublicBookingView(); setStaffSubTab(t); }}
        invoiceSubTab={invoiceSubTab}
        onSelectInvoiceSubTab={(t: any) => { leavePublicBookingView(); setInvoiceSubTab(t); }}
        profileSection={profileSection}
        onSelectProfileSection={(sec: any) => {
          leavePublicBookingView();
          setProfileSection(sec);
          try {
            sessionStorage.setItem('pms_profile_section', sec);
          } catch {}
        }}
        currentRole={currentRole} 
        setCurrentRole={(r: any) => { leavePublicBookingView(); setCurrentRole(r); }}
        hotels={hotels}
        selectedHotelId={selectedHotelId}
        onSelectHotel={(id: any) => {
          setSelectedHotelId(id);
          if (publicHotelBookingId !== null) {
            setPublicHotelBookingId(id);
            window.history.pushState({}, '', `/?hotelBooking=${encodeURIComponent(id)}`);
          }
        }}
        onLogout={handleLogout}
        isSuperAdminUser={loggedInUser === 'Super Admin'}
        loggedInUser={loggedInUser}
        unreadNotificationsCount={unreadRoleNotificationCount}
        onOpenPublicWebsite={handleOpenPublicWebsitePreview}
        staff={staff}
      />

      {/* Workspace Panel */}
      <div className="flex-1 flex flex-col overflow-y-auto h-screen relative min-w-0">
        {/* Upper Header bar - visible on desktop & tablet */}
        <header className="hidden md:flex justify-between items-center h-16 px-6 lg:px-8 bg-white border-b border-luxury-brown-100 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 text-xs text-luxury-brown-500 font-mono font-semibold truncate">
              <span className="w-2 h-2 bg-luxury-gold-500 rounded-full shrink-0" />
              <span className="text-luxury-brown-900 font-bold truncate">{currentPortalLabel}</span>
              <ChevronRight className="w-3.5 h-3.5 text-luxury-brown-400 shrink-0" />
              <span className="px-2.5 py-1 bg-luxury-beige-100 text-luxury-brown-900 border border-luxury-brown-200/60 rounded-lg text-[11px] font-serif font-bold tracking-wide truncate">
                {currentSectionLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-luxury-brown-600 font-medium shrink-0">
            {(loggedInUser === 'Super Admin' || sessionStorage.getItem('pms_role') === 'SuperAdmin') && currentRole !== 'SuperAdmin' && (
              <button
                type="button"
                onClick={() => {
                  setCurrentRole('SuperAdmin');
                  setActiveTab('superAdminHub');
                }}
                className="flex items-center gap-1.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                title="Return to Super Admin SaaS Console"
              >
                ← Return to Super Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => { leavePublicBookingView(); setActiveTab('profile'); }}
              className="flex items-center gap-2 bg-luxury-beige-50 hover:bg-luxury-beige-100 py-1.5 px-3 rounded-xl border border-luxury-brown-200/70 transition-colors cursor-pointer"
              title="View Account & Session Profile"
            >
              <Shield className="w-3.5 h-3.5 text-luxury-gold-600 shrink-0" />
              <span className="font-serif font-bold text-luxury-brown-950 truncate max-w-[130px]">
                {loggedInUser || currentRole}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-luxury-brown-900 text-luxury-gold-300 font-mono text-[10px] font-bold uppercase">
                {currentRole}
              </span>
            </button>

            <NotificationBellAndDrawer
              notifications={rawNotifications}
              currentRole={currentRole}
              selectedHotelId={selectedHotelId}
              onMarkAsRead={handleMarkNotificationAsRead}
              onMarkAllAsRead={handleMarkAllNotificationsAsRead}
              onNavigateLink={handleNavigateNotificationLink}
              onOpenNotification={handleOpenSingleNotification}
              isLoading={isLoadingNotifications}
              error={notificationError}
              isRealtimeConnected={isRealtimeConnected}
              onRefresh={refreshNotificationsFromServer}
            />
          </div>
        </header>

        {/* Dynamic active viewport */}
        <main
          className={
            publicHotelBookingId !== null
              ? 'flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-0'
              : 'flex-1 p-3 sm:p-4 pb-28 md:p-8 overflow-y-auto overflow-x-hidden'
          }
        >
          {publicHotelBookingId !== null ? (
            renderPublicHotelBookingPage(true)
          ) : isInitialHydrating ? (
            <div className="max-w-7xl mx-auto py-10 space-y-5 animate-pulse">
              <div className="h-28 rounded-2xl bg-white border border-luxury-brown-100 shadow-xs p-6 flex items-center justify-between">
                <div className="space-y-3 w-2/3">
                  <div className="h-3.5 w-36 bg-luxury-beige-200 rounded" />
                  <div className="h-6 w-72 bg-luxury-beige-200 rounded" />
                </div>
                <div className="h-10 w-36 bg-luxury-gold-200/60 rounded-xl" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="h-28 rounded-2xl bg-white border border-luxury-brown-100 shadow-xs" />
                <div className="h-28 rounded-2xl bg-white border border-luxury-brown-100 shadow-xs" />
                <div className="h-28 rounded-2xl bg-white border border-luxury-brown-100 shadow-xs" />
              </div>
              <div className="h-64 rounded-2xl bg-white border border-luxury-brown-100 shadow-xs" />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
              {renderTabContent()}
            </div>
          )}

          {/* DirectStay Unified Backend Footer */}
          <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-luxury-brown-100 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#8C7355] no-print">
            <div className="flex items-center gap-2.5">
              {systemWebsite.logoUrl ? (
                <img src={systemWebsite.logoUrl} alt="SaaS Logo" className="w-5 h-5 object-cover rounded shadow-xs" />
              ) : (
                <span className="p-1 bg-luxury-gold-500 text-luxury-brown-950 rounded font-bold text-[9px] shrink-0">DS</span>
              )}
              <span className="font-serif font-bold text-luxury-brown-950">{systemWebsite.businessName || 'DirectStay'}</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-luxury-gold-500/10 border border-luxury-gold-500/30 text-luxury-brown-700">Software Version 2.0</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <a href={`mailto:${systemWebsite.supportEmail || 'contact@directstay.online'}`} className="hover:text-luxury-brown-900 transition-colors flex items-center gap-1">
                <span>✉ {systemWebsite.supportEmail || 'contact@directstay.online'}</span>
              </a>
              <a href={`tel:${systemWebsite.supportPhone}`} className="hover:text-luxury-brown-900 transition-colors flex items-center gap-1">
                <span>📞 {systemWebsite.supportPhone}</span>
              </a>
              {systemWebsite.hasWhatsapp && (
                <a 
                  href={`https://wa.me/91${systemWebsite.supportPhone}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-emerald-700 font-bold transition-colors flex items-center gap-1 text-emerald-600"
                >
                  <span>💬 WhatsApp Chat</span>
                </a>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-1.5 text-luxury-brown-400 text-center md:text-right">
              <span>© 2026 DirectStay Luxury Cloud PMS. Powered by DirectStay SaaS.</span>
            </div>
          </div>
        </main>

        {/* Standardized Global Luxury Toast Stack */}
        {renderGlobalToastOverlay()}
      </div>
    </div>
  );
}

