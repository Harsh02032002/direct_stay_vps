import crypto from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';

try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

const BASE_URL = 'http://localhost:3000';
const SANDBOX_HOTEL_ID = 'hotel-qa-sandbox';
const SANDBOX_USER = 'qasandbox';
const SANDBOX_PASS = 'QaSandbox123!';

function resolveMongoUri(): string {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^MONGODB_URI=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  throw new Error('MONGODB_URI missing');
}

function extractDbName(uri: string): string {
  const noParams = uri.split('?')[0];
  const parts = noParams.split('/');
  return parts[parts.length - 1] || 'hotel';
}

async function httpJson(endpoint: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const resp = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

async function main() {
  const mode = process.argv[2] || 'setup';
  const uri = resolveMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(extractDbName(uri));

  const doc: any = await db.collection('pms_app_state').findOne({ _id: 'FULL_PMS_BACKUP' as any });
  const saPass = doc?.data?.superAdminPass || 'admin123';

  const saLogin = await httpJson('/api/auth/login', {
    method: 'POST',
    body: { username: 'superadmin', password: saPass, role: 'SuperAdmin', recordAuditLog: false },
  });
  if (saLogin.status !== 200) {
    throw new Error(`SuperAdmin login failed: ${saLogin.status}`);
  }
  const saToken = saLogin.data.sessionToken || saLogin.data.token;
  const saHeaders = {
    'x-session-token': saToken,
    'x-user-role': 'SuperAdmin',
    'x-hotel-id': 'SUPERADMIN',
  };

  if (mode === 'setup') {
    const passHash = crypto.createHash('sha256').update(SANDBOX_PASS).digest('hex');
    const stateResp = await httpJson('/api/db/state', { headers: saHeaders });
    const stateData = stateResp.data?.data || {};

    const cleanHotels = (stateData.hotels || []).filter((h: any) => h?.id !== SANDBOX_HOTEL_ID);
    cleanHotels.push({
      id: SANDBOX_HOTEL_ID,
      name: 'DirectStay QA Sandbox Hotel',
      city: 'Jaipur',
      address: 'QA Test Boulevard, Jaipur',
      phoneNumber: '9000088877',
      emailAddress: 'qa-sandbox-hotel@example.com',
      gstNumber: '08AABCU9603R1ZM',
      username: SANDBOX_USER,
      password: passHash,
      ownerUsername: 'qasandbox_owner',
      ownerPassword: passHash,
      status: 'Approved',
      subscriptionPlan: 'Yearly',
      subscriptionStatus: 'Active',
      subscriptionStartDate: '2026-01-01',
      subscriptionEndDate: '2027-12-31',
      isGstEnabled: true,
      defaultGstRate: 5,
      foodGstRate: 5,
      inHouseKitchenAvailable: true,
      inHouseRestaurantAvailable: true,
      autoMarkDirtyOnCheckout: true,
    });

    const cleanRooms = (stateData.rooms || []).filter((r: any) => r?.hotelId !== SANDBOX_HOTEL_ID);
    cleanRooms.push(
      {
        id: 'QASBX-RM-101',
        hotelId: SANDBOX_HOTEL_ID,
        number: '101',
        category: 'Standard',
        floor: '1st Floor',
        rate: 2000,
        status: 'Available',
        cleaningStatus: 'Clean',
        baseOccupancy: 2,
        maxOccupancy: 4,
        extraPersonCharge: 500,
      },
      {
        id: 'QASBX-RM-102',
        hotelId: SANDBOX_HOTEL_ID,
        number: '102',
        category: 'Standard',
        floor: '1st Floor',
        rate: 2000,
        status: 'Dirty',
        cleaningStatus: 'Dirty',
        baseOccupancy: 2,
        maxOccupancy: 4,
        extraPersonCharge: 500,
      },
      {
        id: 'QASBX-RM-201',
        hotelId: SANDBOX_HOTEL_ID,
        number: '201',
        category: 'Deluxe',
        floor: '2nd Floor',
        rate: 3000,
        status: 'Available',
        cleaningStatus: 'Clean',
        baseOccupancy: 2,
        maxOccupancy: 4,
        extraPersonCharge: 600,
      },
      {
        id: 'QASBX-RM-202',
        hotelId: SANDBOX_HOTEL_ID,
        number: '202',
        category: 'Suite',
        floor: '2nd Floor',
        rate: 4500,
        status: 'Available',
        cleaningStatus: 'Clean',
        baseOccupancy: 2,
        maxOccupancy: 5,
        extraPersonCharge: 800,
      }
    );

    const cleanPosItems = (stateData.posItems || []).filter((p: any) => p?.hotelId !== SANDBOX_HOTEL_ID);
    cleanPosItems.push(
      {
        id: 'QASBX-POS-PANEER',
        hotelId: SANDBOX_HOTEL_ID,
        code: 'FD-101',
        name: 'Paneer Tikka',
        category: 'North Indian',
        price: 500,
        taxRate: 5,
        isVeg: true,
        available: true,
        kitchenStation: 'Main Kitchen',
      },
      {
        id: 'QASBX-POS-BIRYANI',
        hotelId: SANDBOX_HOTEL_ID,
        code: 'BIR-001',
        name: 'Hyderabadi Chicken Biryani',
        category: 'Main Course',
        price: 280,
        taxRate: 5,
        isVeg: false,
        available: true,
        kitchenStation: 'Main Kitchen',
        variants: [
          { name: 'Half', price: 180 },
          { name: 'Full', price: 280 },
        ],
      }
    );

    const cleanStaff = (stateData.staff || []).filter((s: any) => s?.hotelId !== SANDBOX_HOTEL_ID);
    cleanStaff.push({
      id: 'QASBX-STF-HK1',
      hotelId: SANDBOX_HOTEL_ID,
      name: 'Ramesh Housekeeping',
      role: 'Housekeeping',
      designation: 'Housekeeping',
      department: 'Housekeeping',
      mobile: '9000088871',
      status: 'Active',
      salary: 15000,
      joiningDate: '2026-01-01',
    });

    const syncResp = await httpJson('/api/db/sync', {
      method: 'POST',
      headers: saHeaders,
      body: {
        data: {
          ...stateData,
          hotels: cleanHotels,
          rooms: cleanRooms,
          posItems: cleanPosItems,
          staff: cleanStaff,
          bookings: (stateData.bookings || []).filter((b: any) => b?.hotelId !== SANDBOX_HOTEL_ID),
          checkins: (stateData.checkins || []).filter((c: any) => c?.hotelId !== SANDBOX_HOTEL_ID),
          invoices: (stateData.invoices || []).filter((i: any) => i?.hotelId !== SANDBOX_HOTEL_ID),
          posOrders: (stateData.posOrders || []).filter((o: any) => o?.hotelId !== SANDBOX_HOTEL_ID),
        },
      },
    });
    if (syncResp.status !== 200) {
      throw new Error(`Sandbox setup sync failed: ${syncResp.status} ${JSON.stringify(syncResp.data)}`);
    }
    console.log(`✅ QA Sandbox Hotel "${SANDBOX_HOTEL_ID}" ready (login: ${SANDBOX_USER})`);
  } else if (mode === 'cleanup') {
    const stateResp = await httpJson('/api/db/state', { headers: saHeaders });
    const stateData = stateResp.data?.data || {};
    const cleaned: Record<string, any> = { ...stateData };
    for (const [k, v] of Object.entries(cleaned)) {
      if (Array.isArray(v)) {
        cleaned[k] = v.filter(
          (item: any) =>
            item?.id !== SANDBOX_HOTEL_ID &&
            item?.hotelId !== SANDBOX_HOTEL_ID &&
            !String(item?.id || '').startsWith('QASBX-')
        );
      }
    }
    const syncResp = await httpJson('/api/db/sync', {
      method: 'POST',
      headers: saHeaders,
      body: { data: cleaned },
    });
    if (syncResp.status !== 200) {
      throw new Error(`Sandbox cleanup sync failed: ${syncResp.status}`);
    }
    await db.collection('hotels').deleteMany({ id: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('rooms').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('bookings').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('checkins').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('invoices').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('pos_items').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('pos_orders').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('staff').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    await db.collection('pms_sessions').deleteMany({ hotelId: SANDBOX_HOTEL_ID }).catch(() => {});
    console.log(
      `✅ QA Sandbox Hotel "${SANDBOX_HOTEL_ID}" cleaned up! Post-cleanup counts: hotels=${cleaned.hotels?.length}, rooms=${cleaned.rooms?.length}, bookings=${cleaned.bookings?.length}`
    );
  }

  await httpJson('/api/auth/logout', { method: 'POST', headers: saHeaders }).catch(() => {});
  await client.close();
}

main().catch((err) => {
  console.error('❌ qa-sandbox-hotel error:', err);
  process.exit(1);
});
