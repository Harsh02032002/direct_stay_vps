export const DEFAULT_MONGODB_URI =
  (import.meta as any).env?.VITE_MONGODB_URI || 'mongodb+srv://***@cluster0.hddqr9e.mongodb.net/hotel';

let activeMongoUriMemory: string = DEFAULT_MONGODB_URI;

/**
 * Backend API is active on both Node/Express (`server.ts`) and Hostinger PHP (`api/index.php`).
 */
export function isBackendServerActive(): boolean {
  return typeof window !== 'undefined';
}

async function safeFetchJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  if (typeof window === 'undefined') {
    return { ok: false, status: 0, data: null };
  }
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!text) {
      return { ok: res.ok, status: res.status, data: null };
    }
    try {
      const data = JSON.parse(text);
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: res.status, data: null };
    }
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// Retrieve MongoDB Atlas credentials
export function getSupabaseCredentials() {
  return {
    url: activeMongoUriMemory || DEFAULT_MONGODB_URI,
    key: 'hotel',
    source: 'database'
  };
}

export function saveSupabaseCredentials(uri: string, _dbName?: string) {
  if (uri && uri.trim()) {
    activeMongoUriMemory = uri.trim();
  } else {
    activeMongoUriMemory = DEFAULT_MONGODB_URI;
  }
}

export async function testSupabaseConnection(
  uriInput?: string,
  _keyInput?: string,
  saveOnServer: boolean = false
): Promise<{ success: boolean; message: string; dbName?: string; collections?: string[] }> {
  const uri = (uriInput || getSupabaseCredentials().url || DEFAULT_MONGODB_URI).trim();

  if (!uri) {
    return {
      success: false,
      message: 'MongoDB Atlas Connection URI is missing. Please enter a valid mongodb+srv:// connection string.'
    };
  }

  const { ok, data } = await safeFetchJson('/api/db/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri, save: saveOnServer })
  });

  if (!ok || !data) {
    return {
      success: false,
      message: data?.message || 'Backend database endpoint unreachable'
    };
  }

  return {
    success: Boolean(data.success),
    message: data.message || (data.success ? 'MongoDB Atlas connected!' : 'Connection failed'),
    dbName: data.dbName,
    collections: data.collections || []
  };
}

export function generateSupabaseSqlSchema(): string {
  return `// ====================================================================
// HOTEL PMS & SAAS MONGODB ATLAS COLLECTIONS OVERVIEW
// Database Name: "hotel"
// Cluster: cluster0.hddqr9e.mongodb.net
// Collections are automatically created & indexed on sync!
// ====================================================================

const collections = [
  "pms_app_state",      // Full atomic PMS state snapshot (_id: "FULL_PMS_BACKUP")
  "hotels",             // Multi-property hotel profiles & credentials
  "packages",           // SaaS subscription packages & permissions
  "custom_pages",       // Public website custom pages
  "rooms",              // Room inventory, tariffs & housekeeping status
  "bookings",           // Reservations & OTA bookings
  "checkins",           // Active & past guest check-ins & folios
  "invoices",           // GST tax invoices & billing records
  "expenses",           // Operational hotel expenses
  "handovers",          // Shift cash handovers
  "policies",           // Hotel check-in/out & house policies
  "staff",              // Staff directory & role credentials
  "audit_logs",         // Security & activity audit trail
  "inventory_products", // Stock & housekeeping supplies
  "pos_items",          // Restaurant & room service menu items
  "pos_orders",         // POS billing orders
  "finance_vouchers",   // Accounting & finance vouchers
  "vendors",            // Supplier & vendor records
  "laundry_orders",     // Housekeeping laundry orders
  "cleaning_logs"       // Room cleaning & verification logs
];`;
}

export function getCallerSessionHeaders(): Record<string, string> {
  try {
    const headers: Record<string, string> = {};
    const token =
      sessionStorage.getItem('pms_session_token') ||
      sessionStorage.getItem('pms_auth_token') ||
      localStorage.getItem('pms_session_token') ||
      localStorage.getItem('pms_auth_token');
    const role = sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role');
    const hotelId = sessionStorage.getItem('pms_hotel_id') || localStorage.getItem('pms_hotel_id');
    const username = sessionStorage.getItem('pms_user') || localStorage.getItem('pms_user');

    if (token) headers['x-session-token'] = String(token);
    if (role) headers['x-user-role'] = String(role);
    if (hotelId) {
      headers['x-hotel-id'] = String(hotelId);
    } else if (role === 'SuperAdmin') {
      headers['x-hotel-id'] = 'SUPERADMIN';
    }
    if (username) headers['x-user-name'] = String(username);

    const raw = sessionStorage.getItem('pms_auth_session') || localStorage.getItem('pms_auth_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.sessionToken && !headers['x-session-token']) {
        headers['x-session-token'] = String(parsed.sessionToken);
      }
      if (parsed.role && !headers['x-user-role']) {
        headers['x-user-role'] = String(parsed.role);
      }
      if (parsed.hotelId && !headers['x-hotel-id']) {
        headers['x-hotel-id'] = String(parsed.hotelId);
      } else if (parsed.role === 'SuperAdmin' && !headers['x-hotel-id']) {
        headers['x-hotel-id'] = 'SUPERADMIN';
      }
      if (parsed.username && !headers['x-user-name']) {
        headers['x-user-name'] = String(parsed.username);
      }
    }
    return headers;
  } catch {}
  return {};
}

let syncQueuePromise: Promise<{ success: boolean; error?: string }> = Promise.resolve({ success: true });
let pendingCoalescedData: Record<string, any> | null = null;
let pendingDrainPromise: Promise<{ success: boolean; error?: string }> | null = null;

// Writes to the DB are blocked until this tab has successfully loaded the
// authoritative state from the DB. This guarantees an empty/fresh browser can
// never overwrite real database records with empty arrays.
let isDbHydrated = false;

export function markDbHydrated(value: boolean) {
  isDbHydrated = value;
  if (!value) {
    pendingCoalescedData = null;
  }
}

export function isDbStateHydrated(): boolean {
  return isDbHydrated;
}

async function postSyncPayload(payload: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  const sessionHeaders = getCallerSessionHeaders();
  if (!sessionHeaders['x-session-token']) {
    return {
      success: false,
      error: 'Skipped sync: No active authenticated session token'
    };
  }
  const callerRole = sessionHeaders['x-user-role'];
  const callerHotelId = sessionHeaders['x-hotel-id'];
  const isSuperAdmin = callerRole === 'SuperAdmin' || callerHotelId === 'SUPERADMIN';
  let sanitizedPayload: Record<string, any> = payload;
  if (!isSuperAdmin && callerHotelId) {
    sanitizedPayload = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k === 'hotels' && Array.isArray(v)) {
        sanitizedPayload[k] = v.filter((h: any) => h && h.id === callerHotelId);
      } else if (Array.isArray(v) && k !== 'customPages' && k !== 'packages' && k !== 'registeredHotels') {
        sanitizedPayload[k] = v
          .filter((item: any) => item && (!item.hotelId || item.hotelId === callerHotelId || (item.hotelId === 'hotel-1' && !item._preserveHotel1)))
          .map((item: any) => ({ ...item, hotelId: callerHotelId }));
      } else {
        sanitizedPayload[k] = v;
      }
    }
  }
  const { ok, data: result } = await safeFetchJson('/api/db/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...sessionHeaders
    },
    body: JSON.stringify({ data: sanitizedPayload })
  });
  if (!ok || !result?.success) {
    return {
      success: false,
      error: result?.error || 'Failed to sync to MongoDB Atlas'
    };
  }
  return { success: true };
}

// Sync app data to MongoDB Atlas via backend API (serialized & coalesced to prevent out-of-order race conditions)
export async function syncAllToSupabase(
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data || Object.keys(data).length === 0) {
    return { success: true };
  }
  const sessionHeaders = getCallerSessionHeaders();
  const isSuperAdminCaller =
    sessionHeaders['x-user-role'] === 'SuperAdmin' ||
    sessionHeaders['x-hotel-id'] === 'SUPERADMIN';
  const isGlobalCmsPayload = Boolean(
    data.systemWebsite !== undefined ||
    data.customPages !== undefined ||
    data.packages !== undefined ||
    data.registeredHotels !== undefined
  );

  if (!isDbHydrated && !isSuperAdminCaller && !isGlobalCmsPayload) {
    return {
      success: false,
      error: 'Skipped sync: Database state has not been loaded in this session yet'
    };
  }
  pendingCoalescedData = { ...(pendingCoalescedData || {}), ...data };
  if (pendingDrainPromise) {
    return pendingDrainPromise;
  }

  pendingDrainPromise = (async () => {
    let lastResult: { success: boolean; error?: string } = { success: true };
    while (pendingCoalescedData && Object.keys(pendingCoalescedData).length > 0) {
      const batch = pendingCoalescedData;
      pendingCoalescedData = null;
      syncQueuePromise = syncQueuePromise.then(() => postSyncPayload(batch)).catch(() => ({
        success: false,
        error: 'Failed to sync to MongoDB Atlas'
      }));
      lastResult = await syncQueuePromise;
    }
    pendingDrainPromise = null;
    return lastResult;
  })();

  return pendingDrainPromise;
}

export function hasPendingSync(): boolean {
  return Boolean(pendingDrainPromise || (pendingCoalescedData && Object.keys(pendingCoalescedData).length > 0));
}

export async function waitForPendingSyncs(): Promise<void> {
  try {
    if (pendingDrainPromise) {
      await pendingDrainPromise;
    }
    await syncQueuePromise;
  } catch {}
}

// Validated public hotel onboarding via backend API
export async function onboardHotelApi(payload: {
  hotel: any;
  rooms: any[];
  staff?: any[];
  policies?: any[];
  auditLog?: any;
  notification?: any;
}): Promise<{ success: boolean; hotelId?: string; error?: string }> {
  if (!isBackendServerActive()) {
    return {
      success: true,
      hotelId: payload?.hotel?.id
    };
  }
  const { ok, data: result } = await safeFetchJson('/api/public/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!ok || !result?.success) {
    return {
      success: false,
      error: result?.error || 'Failed to onboard hotel property on server.'
    };
  }
  return {
    success: true,
    hotelId: result.hotelId
  };
}

// Fetch public website CMS configuration and SaaS packages (unauthenticated)
export async function fetchPublicWebsiteConfig(): Promise<{
  systemWebsite?: any;
  customPages?: any[];
  packages?: any[];
} | null> {
  if (!isBackendServerActive()) return null;
  const { ok, data: result } = await safeFetchJson('/api/public/website-config');
  if (ok && result && result.success && result.data) {
    return result.data;
  }
  return null;
}

// Server-side password recovery API
export async function recoverPasswordApi(payload: {
  username: string;
  email: string;
  newPassword: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isBackendServerActive()) {
    return { success: false, error: 'Backend server inactive' };
  }
  const { ok, data: result } = await safeFetchJson('/api/auth/recover-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!ok || !result?.success) {
    return {
      success: false,
      error: result?.error || 'Password recovery failed.'
    };
  }
  return {
    success: true,
    message: result.message
  };
}

// In-flight deduplication so multiple components/events never trigger duplicate multi-KB state downloads concurrently
let inFlightStatePromise: Promise<Record<string, any> | null> | null = null;
let inFlightStateKey = '';

// Fetch all app data from MongoDB Atlas via backend API (requires active session token)
export async function fetchAllFromSupabase(): Promise<Record<string, any> | null> {
  if (!isBackendServerActive()) return null;
  const sessionHeaders = getCallerSessionHeaders();
  if (!sessionHeaders['x-session-token']) {
    if (
      typeof window !== 'undefined' &&
      (sessionStorage.getItem('pms_authenticated') === 'true' || localStorage.getItem('pms_authenticated') === 'true')
    ) {
      sessionStorage.removeItem('pms_authenticated');
      localStorage.removeItem('pms_authenticated');
      window.dispatchEvent(new Event('pms-session-expired'));
    }
    return null;
  }
  const reqKey = `${sessionHeaders['x-session-token']}|${sessionHeaders['x-user-role'] || ''}|${sessionHeaders['x-hotel-id'] || ''}`;
  if (inFlightStatePromise && inFlightStateKey === reqKey) {
    return inFlightStatePromise;
  }

  inFlightStateKey = reqKey;
  inFlightStatePromise = (async () => {
    try {
      const qs = new URLSearchParams();
      qs.set('token', sessionHeaders['x-session-token']);
      if (sessionHeaders['x-user-role']) qs.set('role', sessionHeaders['x-user-role']);
      if (sessionHeaders['x-user-role'] !== 'SuperAdmin' && sessionHeaders['x-hotel-id']) {
        qs.set('hotelId', sessionHeaders['x-hotel-id']);
      }
      qs.set('_ts', String(Date.now()));
      const { ok, status, data: result } = await safeFetchJson(`/api/db/state?${qs.toString()}`, {
        cache: 'no-store',
        headers: {
          ...sessionHeaders
        }
      });
      if (status === 401 && typeof window !== 'undefined') {
        for (const k of ['pms_authenticated', 'pms_session_token', 'pms_auth_token', 'pms_auth_session']) {
          sessionStorage.removeItem(k);
          localStorage.removeItem(k);
        }
        window.dispatchEvent(new Event('pms-session-expired'));
        return null;
      }
      if (ok && result && result.success) {
        isDbHydrated = true;
        return result.data && typeof result.data === 'object' ? result.data : {};
      }
      return null;
    } finally {
      inFlightStatePromise = null;
      inFlightStateKey = '';
    }
  })();

  return inFlightStatePromise;
}

// Append a single immutable audit log event directly via /api/audit-logs
export async function appendAuditLogToCloud(payload: {
  id?: string;
  hotelId?: string;
  action: string;
  details: string;
  entityType?: string;
  entityId?: string;
  outcome?: 'success' | 'failure';
  requestId?: string;
}): Promise<{ success: boolean; auditLog?: any; error?: string }> {
  if (!isBackendServerActive()) {
    return { success: false, error: 'Backend server inactive' };
  }
  const { ok, data: json } = await safeFetchJson('/api/audit-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getCallerSessionHeaders()
    },
    body: JSON.stringify(payload)
  });
  if (!ok || !json?.success) {
    return { success: false, error: json?.error || 'Failed to append audit log' };
  }
  return { success: true, auditLog: json.auditLog };
}

// Fetch hotel-scoped audit logs directly via /api/audit-logs
export async function fetchAuditLogsFromCloud(params?: {
  hotelId?: string;
  search?: string;
  action?: string;
  performedBy?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  logs: any[];
}> {
  if (!isBackendServerActive()) {
    return { success: false, total: 0, page: 1, limit: 100, totalPages: 1, logs: [] };
  }
  const qs = new URLSearchParams();
  if (params?.hotelId) qs.set('hotelId', params.hotelId);
  if (params?.search) qs.set('search', params.search);
  if (params?.action) qs.set('action', params.action);
  if (params?.performedBy) qs.set('performedBy', params.performedBy);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const url = `/api/audit-logs${qs.toString() ? `?${qs.toString()}` : ''}`;
  const { ok, data: json } = await safeFetchJson(url, {
    headers: {
      ...getCallerSessionHeaders()
    }
  });
  if (!ok || !json?.success) {
    return { success: false, total: 0, page: 1, limit: 100, totalPages: 1, logs: [] };
  }
  return {
    success: true,
    total: Number(json.total || 0),
    page: Number(json.page || 1),
    limit: Number(json.limit || 100),
    totalPages: Number(json.totalPages || 1),
    logs: Array.isArray(json.logs) ? json.logs : []
  };
}

// =========================================================================
// PHASE 4: CENTRALIZED NOTIFICATION REST & SSE CLIENT HELPERS
// =========================================================================

export async function fetchNotificationsApi(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}): Promise<{
  success: boolean;
  unreadCount: number;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  notifications: any[];
  error?: string;
}> {
  if (!isBackendServerActive()) {
    return {
      success: false,
      unreadCount: 0,
      totalCount: 0,
      page: 1,
      limit: params?.limit || 50,
      totalPages: 1,
      notifications: []
    };
  }

  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.unreadOnly) qs.set('unreadOnly', 'true');
  if (params?.type) qs.set('type', params.type);

  const url = `/api/notifications${qs.toString() ? `?${qs.toString()}` : ''}`;
  const { ok, status, data: json } = await safeFetchJson(url, {
    headers: {
      ...getCallerSessionHeaders()
    }
  });
  if (!ok || !json?.success) {
    return {
      success: false,
      unreadCount: 0,
      totalCount: 0,
      page: 1,
      limit: params?.limit || 50,
      totalPages: 1,
      notifications: [],
      error: json?.error || (status ? `HTTP ${status}` : undefined)
    };
  }
  return {
    success: true,
    unreadCount: Number(json.unreadCount || 0),
    totalCount: Number(json.totalCount || 0),
    page: Number(json.page || 1),
    limit: Number(json.limit || 50),
    totalPages: Number(json.totalPages || 1),
    notifications: Array.isArray(json.notifications) ? json.notifications : []
  };
}

export async function fetchUnreadCountApi(): Promise<{ success: boolean; unreadCount: number }> {
  if (!isBackendServerActive()) {
    return { success: false, unreadCount: 0 };
  }
  const { ok, data: json } = await safeFetchJson('/api/notifications/unread-count', {
    headers: {
      ...getCallerSessionHeaders()
    }
  });
  if (!ok || !json?.success) {
    return { success: false, unreadCount: 0 };
  }
  return { success: true, unreadCount: Number(json.unreadCount || 0) };
}

export async function createNotificationApi(payload: {
  id?: string;
  hotelId: string;
  recipientRole: 'SuperAdmin' | 'Admin' | 'Owner' | 'All';
  title: string;
  message: string;
  type: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  linkPath?: string;
  entityId?: string;
  dedupeKey?: string;
}): Promise<{ success: boolean; notification?: any; deduplicated?: boolean; error?: string }> {
  if (!isBackendServerActive()) {
    return { success: true };
  }
  const { ok, status, data: json } = await safeFetchJson('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getCallerSessionHeaders()
    },
    body: JSON.stringify(payload)
  });
  if (!ok || !json?.success) {
    return { success: false, error: json?.error || (status ? `HTTP ${status}` : undefined) };
  }
  return {
    success: true,
    notification: json.notification,
    deduplicated: Boolean(json.deduplicated)
  };
}

export async function markNotificationReadApi(
  notificationId: string
): Promise<{ success: boolean; unreadCount?: number; error?: string }> {
  if (!isBackendServerActive()) {
    return { success: true };
  }
  const { ok, status, data: json } = await safeFetchJson(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getCallerSessionHeaders()
    }
  });
  if (!ok || !json?.success) {
    return { success: false, error: json?.error || (status ? `HTTP ${status}` : undefined) };
  }
  return { success: true, unreadCount: json.unreadCount };
}

export async function markAllNotificationsReadApi(): Promise<{
  success: boolean;
  markedCount?: number;
  error?: string;
}> {
  if (!isBackendServerActive()) {
    return { success: true };
  }
  const { ok, status, data: json } = await safeFetchJson('/api/notifications/read-all', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getCallerSessionHeaders()
    }
  });
  if (!ok || !json?.success) {
    return { success: false, error: json?.error || (status ? `HTTP ${status}` : undefined) };
  }
  return { success: true, markedCount: json.markedCount };
}

export function getNotificationStreamUrl(): string {
  const headers = getCallerSessionHeaders();
  const qs = new URLSearchParams();
  if (headers['x-session-token']) qs.set('token', headers['x-session-token']);
  if (headers['x-user-role']) qs.set('role', headers['x-user-role']);
  if (headers['x-hotel-id']) qs.set('hotelId', headers['x-hotel-id']);
  return `/api/notifications/stream?${qs.toString()}`;
}


