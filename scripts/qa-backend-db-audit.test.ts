import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';

try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const QA_HOTEL_ID = 'qa-audit-isolated-hotel-99999';
const QA_ADMIN_USER = 'qa_isolated_auditor';
const QA_ADMIN_PASS = `QaPass!${crypto.randomBytes(6).toString('hex')}`;

function resolveMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^MONGODB_URI=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  const serverPath = path.resolve(process.cwd(), 'server.ts');
  const serverRaw = fs.readFileSync(serverPath, 'utf8');
  const match = serverRaw.match(/mongodb\+srv:\/\/[^\s"']+/);
  if (match) return match[0];
  throw new Error('Could not resolve MONGODB_URI for QA DB verification');
}

function extractDbName(uri: string): string {
  try {
    const noParams = uri.split('?')[0];
    const parts = noParams.split('/');
    const candidate = parts[parts.length - 1];
    if (candidate && !candidate.includes('@') && !candidate.includes(':')) {
      return candidate;
    }
  } catch {}
  return 'hotel_pms_db';
}

async function httpJson(
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; data: any }> {
  const resp = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

async function runAudit() {
  const results: Array<{ id: string; name: string; passed: boolean; detail: string }> = [];
  const record = (id: string, name: string, passed: boolean, detail: string) => {
    results.push({ id, name, passed, detail });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} [${id}] ${name} — ${detail}`);
  };

  const uri = resolveMongoUri();
  const dbName = extractDbName(uri);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Snapshot production record counts BEFORE any QA test runs
  const beforeDoc: any = await db.collection('pms_app_state').findOne({ _id: 'FULL_PMS_BACKUP' as any });
  const beforeData = beforeDoc?.data || {};
  const prodHotelIds = (beforeData.hotels || [])
    .map((h: any) => h?.id)
    .filter((id: string) => id && id !== QA_HOTEL_ID);
  const foreignHotelId = prodHotelIds[0] || 'hotel-1';

  const countNonQa = (arr: any[]) =>
    (Array.isArray(arr) ? arr : []).filter((x) => x?.hotelId !== QA_HOTEL_ID && x?.id !== QA_HOTEL_ID).length;

  const baselineCounts = {
    hotels: countNonQa(beforeData.hotels),
    rooms: countNonQa(beforeData.rooms),
    bookings: countNonQa(beforeData.bookings),
    invoices: countNonQa(beforeData.invoices),
    posOrders: countNonQa(beforeData.posOrders),
    staff: countNonQa(beforeData.staff),
  };

  let superAdminToken = '';
  let qaSessionToken = '';

  try {
    // 1. Health & MongoDB Status Redaction
    {
      const health = await httpJson('/api/health');
      assert.equal(health.status, 200);
      assert.equal(health.data.status, 'ok');

      const dbStatus = await httpJson('/api/db/status');
      assert.equal(dbStatus.status, 200);
      assert.equal(dbStatus.data.connected, true);
      assert.ok(String(dbStatus.data.uri || '').includes('***'), 'MongoDB URI credentials must be redacted');
      record('BE-01', 'Health & MongoDB Status (Redacted Credentials)', true, `DB "${dbStatus.data.dbName}" connected, URI redacted`);
    }

    // 2. Unauthenticated Access Blocked (401)
    {
      const r1 = await httpJson('/api/bookings');
      const r2 = await httpJson('/api/email/logs');
      const r3 = await httpJson('/api/pms/modules/bookings', { method: 'POST', body: { items: [] } });
      assert.equal(r1.status, 401);
      assert.equal(r2.status, 401);
      assert.equal(r3.status, 401);
      record('BE-02', 'Unauthenticated API Access Rejected (401)', true, `/api/bookings=${r1.status}, /api/email/logs=${r2.status}, /api/pms/modules=${r3.status}`);
    }

    // 3. Forged Session Token Rejected (Bug #1 Regression)
    {
      const forged = await httpJson('/api/bookings', {
        headers: {
          'x-session-token': 'ds_sess_forged_unissued_token_999999',
          'x-user-role': 'SuperAdmin',
          'x-hotel-id': 'SUPERADMIN',
        },
      });
      assert.equal(forged.status, 401, `Expected 401 for forged ds_sess_ token, got ${forged.status}`);
      record('BE-03', 'Forged ds_sess_* Session Token Rejected (401)', true, `Forged SuperAdmin token returned HTTP ${forged.status}`);
    }

    // 4. Passwordless Login Bypass Rejected (Bug #1B Regression)
    {
      const bypassAttempt = await httpJson('/api/auth/login', {
        method: 'POST',
        body: {
          username: 'superadmin',
          role: 'SuperAdmin',
          recordAuditLog: false,
        },
      });
      assert.equal(bypassAttempt.status, 401, `Expected 401 for passwordless login, got ${bypassAttempt.status}`);
      record('BE-04', 'Passwordless Silent Login Bypass Blocked (401)', true, `Passwordless login with recordAuditLog:false returned HTTP ${bypassAttempt.status}`);
    }

    // 5. Provision Isolated Synthetic Test Tenant Staff & Verify Real Login + MongoDB pms_sessions Persistence
    {
      const saLogin = await httpJson('/api/auth/login', {
        method: 'POST',
        body: {
          username: 'superadmin',
          password: beforeData.superAdminPass || 'admin123',
          role: 'SuperAdmin',
          recordAuditLog: false,
        },
      });
      assert.equal(saLogin.status, 200, `SuperAdmin bootstrap login failed: ${saLogin.status}`);
      superAdminToken = saLogin.data.sessionToken || saLogin.data.token;

      const passHash = crypto.createHash('sha256').update(QA_ADMIN_PASS).digest('hex');
      const provisionStaff = await httpJson('/api/pms/modules/staff', {
        method: 'POST',
        headers: {
          'x-session-token': superAdminToken,
          'x-user-role': 'SuperAdmin',
          'x-hotel-id': QA_HOTEL_ID,
          'x-target-hotel-id': QA_HOTEL_ID,
        },
        body: {
          hotelId: QA_HOTEL_ID,
          items: [
            {
              id: 'QA-STF-AUDITOR-1',
              hotelId: QA_HOTEL_ID,
              name: 'QA Isolated Auditor',
              username: QA_ADMIN_USER,
              password: passHash,
              role: 'Admin',
              designation: 'Admin',
              department: 'Admin',
              status: 'Active',
              mobile: '9000099999',
            },
          ],
        },
      });
      assert.equal(provisionStaff.status, 200);

      // Invalid password check -> 401
      const wrongPass = await httpJson('/api/auth/login', {
        method: 'POST',
        body: {
          username: QA_ADMIN_USER,
          password: 'WrongPassword123!',
          role: 'Admin',
          recordAuditLog: false,
        },
      });
      assert.equal(wrongPass.status, 401);

      // Valid password check -> 200
      const loginTry = await httpJson('/api/auth/login', {
        method: 'POST',
        body: {
          username: QA_ADMIN_USER,
          password: QA_ADMIN_PASS,
          role: 'Admin',
          hotelId: QA_HOTEL_ID,
          recordAuditLog: false,
        },
      });
      assert.equal(loginTry.status, 200, `QA isolated login returned ${loginTry.status}`);
      qaSessionToken = loginTry.data.sessionToken || loginTry.data.token;
      assert.ok(qaSessionToken && qaSessionToken.startsWith('ds_sess_'), 'Expected ds_sess_* session token');

      const storedSession = await db.collection('pms_sessions').findOne({ _id: qaSessionToken as any });
      assert.ok(storedSession, 'Session token must be persisted in MongoDB pms_sessions collection');
      assert.equal(storedSession.hotelId, QA_HOTEL_ID);

      // Verify privilege escalation attempt (Admin trying silent switch to SuperAdmin) -> 403
      const privEscalate = await httpJson('/api/auth/login', {
        method: 'POST',
        headers: { 'x-session-token': qaSessionToken },
        body: {
          username: QA_ADMIN_USER,
          role: 'SuperAdmin',
          recordAuditLog: false,
        },
      });
      assert.equal(privEscalate.status, 403, 'Non-SuperAdmin session must not escalate to SuperAdmin');

      record(
        'BE-05',
        'Valid Login, Invalid Password (401), Session Persistence & Anti-Escalation (403)',
        true,
        `Issued session for ${QA_HOTEL_ID}, persisted in pms_sessions, blocked SuperAdmin escalation (${privEscalate.status})`
      );
    }

    const authHeaders = {
      'x-session-token': qaSessionToken,
      'x-user-role': 'Admin',
      'x-hotel-id': QA_HOTEL_ID,
      'x-target-hotel-id': QA_HOTEL_ID,
      'x-user-name': QA_ADMIN_USER,
    };

    // 6. Multi-Tenant Property Isolation Enforcement (403 Forbidden on Cross-Hotel Reads/Writes)
    {
      const crossBookings = await httpJson(`/api/bookings?hotelId=${encodeURIComponent(foreignHotelId)}`, {
        headers: authHeaders,
      });
      const crossModuleRead = await httpJson(`/api/pms/modules/bookings?hotelId=${encodeURIComponent(foreignHotelId)}`, {
        headers: authHeaders,
      });
      const crossModuleWrite = await httpJson('/api/pms/modules/bookings', {
        method: 'POST',
        headers: authHeaders,
        body: { hotelId: foreignHotelId, items: [] },
      });
      const crossEmailSend = await httpJson('/api/bookings/send-email', {
        method: 'POST',
        headers: authHeaders,
        body: {
          hotelId: foreignHotelId,
          bookingId: 'BKG-CROSS-1',
          guestName: 'Test Guest',
          recipientEmail: 'qa-cross@example.com',
          checkInDate: '2026-11-25',
          dryRun: true,
        },
      });
      const superAdminOnly = await httpJson('/api/system/monitoring', {
        headers: authHeaders,
      });

      assert.equal(crossBookings.status, 403);
      assert.equal(crossModuleRead.status, 403);
      assert.equal(crossModuleWrite.status, 403);
      assert.equal(crossEmailSend.status, 403);
      assert.equal(superAdminOnly.status, 403);
      record(
        'BE-06',
        'Property-Level Multi-Tenant Isolation & RBAC (403 Forbidden)',
        true,
        `Cross-hotel bookings=${crossBookings.status}, moduleRead=${crossModuleRead.status}, moduleWrite=${crossModuleWrite.status}, email=${crossEmailSend.status}, monitoring=${superAdminOnly.status}`
      );
    }

    // 7. Input Validation & Proper 400 HTTP Status Codes
    {
      const badEmailMissing = await httpJson('/api/bookings/send-email', {
        method: 'POST',
        headers: authHeaders,
        body: { hotelId: QA_HOTEL_ID, bookingId: 'BKG-1', guestName: 'Guest' },
      });
      const badEmailFormat = await httpJson('/api/bookings/send-email', {
        method: 'POST',
        headers: authHeaders,
        body: {
          hotelId: QA_HOTEL_ID,
          bookingId: 'BKG-1',
          guestName: 'Guest',
          recipientEmail: 'invalid-email-format',
        },
      });
      const badNotification = await httpJson('/api/notifications', {
        method: 'POST',
        headers: authHeaders,
        body: { hotelId: QA_HOTEL_ID, title: '' },
      });
      const badModule = await httpJson('/api/pms/modules/nonExistentCollection', {
        headers: authHeaders,
      });

      assert.equal(badEmailMissing.status, 400);
      assert.equal(badEmailFormat.status, 400);
      assert.equal(badNotification.status, 400);
      assert.equal(badModule.status, 400);
      record(
        'BE-07',
        'Input Validation & 400 Bad Request Handling',
        true,
        `Missing email=${badEmailMissing.status}, invalid email=${badEmailFormat.status}, empty notif=${badNotification.status}, invalid module=${badModule.status}`
      );
    }

    // 8. Booking Email Trigger, Safe Dry-Run Protection, Deduplication & Email Logs Inspection
    {
      const emailResp = await httpJson('/api/bookings/send-email', {
        method: 'POST',
        headers: authHeaders,
        body: {
          hotelId: QA_HOTEL_ID,
          hotelName: 'QA Isolated Audit Hotel',
          eventType: 'booking_confirmation',
          bookingId: 'QA-BKG-EMAIL-101',
          guestName: 'Aarav QA Tester',
          recipientEmail: 'qa-guest-booking@example.com',
          roomNumber: '901',
          roomType: 'Deluxe',
          checkInDate: '2026-11-22',
          checkOutDate: '2026-11-24',
          nights: 2,
          totalAmount: 5250,
          advanceAmount: 2000,
          pendingAmount: 3250,
          status: 'Confirmed',
          dryRun: true,
        },
      });
      assert.equal(emailResp.status, 200);
      assert.equal(emailResp.data.success, true);
      assert.equal(emailResp.data.dryRun, true);
      assert.equal(emailResp.data.delivered, false, 'Must NEVER send real external email in dryRun/test mode');
      assert.equal(emailResp.data.status, 'logged_dry_run');

      // Test duplicate suppression
      const dupResp = await httpJson('/api/bookings/send-email', {
        method: 'POST',
        headers: authHeaders,
        body: {
          hotelId: QA_HOTEL_ID,
          hotelName: 'QA Isolated Audit Hotel',
          eventType: 'booking_confirmation',
          bookingId: 'QA-BKG-EMAIL-101',
          guestName: 'Aarav QA Tester',
          recipientEmail: 'qa-guest-booking@example.com',
          checkInDate: '2026-11-22',
          dryRun: true,
        },
      });
      assert.equal(dupResp.status, 200);
      assert.equal(dupResp.data.status, 'skipped_duplicate');

      // Inspect tenant-scoped email logs
      const logsResp = await httpJson(`/api/email/logs?hotelId=${encodeURIComponent(QA_HOTEL_ID)}`, {
        headers: authHeaders,
      });
      assert.equal(logsResp.status, 200);
      const matchedLog = (logsResp.data.logs || []).find((l: any) => l.bookingId === 'QA-BKG-EMAIL-101');
      assert.ok(matchedLog, 'Expected QA-BKG-EMAIL-101 in /api/email/logs');
      assert.equal(matchedLog.recipientEmail, 'qa-guest-booking@example.com');
      assert.equal(matchedLog.guestName, 'Aarav QA Tester');
      assert.equal(matchedLog.roomNumber, '901');
      assert.equal(matchedLog.totalAmount, 5250);
      assert.ok(String(matchedLog.bodyPreview || '').includes('5,250'));
      record(
        'BE-08',
        'Booking Email Trigger, Safe Dry-Run, Deduplication & Log Verification',
        true,
        `Logged ${matchedLog.id} (${matchedLog.status}), duplicate suppressed (${dupResp.data.status}), 0 external emails sent`
      );
    }

    // 9. Database Persistence & Paginated Query Verification (Rooms, Bookings, Housekeeping, POS Orders)
    {
      const saveRooms = await httpJson('/api/pms/modules/rooms', {
        method: 'POST',
        headers: authHeaders,
        body: {
          hotelId: QA_HOTEL_ID,
          items: [
            {
              id: 'QA-RM-901',
              hotelId: QA_HOTEL_ID,
              number: '901',
              category: 'Deluxe',
              floor: '9th Floor',
              rate: 2500,
              status: 'Dirty',
              cleaningStatus: 'Dirty',
              assignedStaff: 'Ramesh HK',
              housekeepingPriority: 'High',
              housekeepingNotes: 'QA deep clean verification',
            },
          ],
        },
      });
      assert.equal(saveRooms.status, 200);

      const saveBookings = await httpJson('/api/pms/modules/bookings', {
        method: 'POST',
        headers: authHeaders,
        body: {
          hotelId: QA_HOTEL_ID,
          items: [
            {
              id: 'QA-BKG-901',
              bookingNo: 'QA-BKG-901',
              hotelId: QA_HOTEL_ID,
              guestName: 'Aarav QA Tester',
              customerName: 'Aarav QA Tester',
              mobile: '9000011111',
              email: 'qa-guest-booking@example.com',
              roomNumber: '901',
              roomNumbers: ['901'],
              roomType: 'Deluxe',
              checkInDate: '2026-11-22',
              checkOutDate: '2026-11-24',
              nights: 2,
              bookingAmount: 5000,
              gstRate: 5,
              gstAmount: 250,
              advanceAmount: 2000,
              status: 'Confirmed',
              isCheckedIn: false,
            },
          ],
        },
      });
      assert.equal(saveBookings.status, 200);

      // Verify paginated GET /api/bookings & search
      const paged = await httpJson(
        `/api/bookings?hotelId=${encodeURIComponent(QA_HOTEL_ID)}&page=1&limit=10&search=Aarav`,
        { headers: authHeaders }
      );
      assert.equal(paged.status, 200);
      assert.equal(paged.data.pagination.total, 1);
      assert.equal(paged.data.bookings[0].id, 'QA-BKG-901');

      // Verify MongoDB persistence directly in domain collections
      const dbRoom = await db.collection('rooms').findOne({ id: 'QA-RM-901', hotelId: QA_HOTEL_ID });
      const dbBooking = await db.collection('bookings').findOne({ id: 'QA-BKG-901', hotelId: QA_HOTEL_ID });
      assert.ok(dbRoom, 'Room QA-RM-901 persisted in MongoDB rooms collection');
      assert.equal(dbRoom.assignedStaff, 'Ramesh HK');
      assert.ok(dbBooking, 'Booking QA-BKG-901 persisted in MongoDB bookings collection');
      assert.equal(dbBooking.bookingAmount, 5000);

      record(
        'BE-09',
        'MongoDB Persistence & Paginated Bookings Search Verification',
        true,
        `Verified rooms & bookings persisted in MongoDB collections ("${dbName}") and searchable via /api/bookings`
      );
    }

    // 10. Logout & Session Revocation Verification
    {
      const logoutResp = await httpJson('/api/auth/logout', {
        method: 'POST',
        headers: authHeaders,
      });
      assert.equal(logoutResp.status, 200);

      const postLogout = await httpJson('/api/bookings', {
        headers: authHeaders,
      });
      assert.equal(postLogout.status, 401, 'Revoked session token must return 401 after logout');
      record('BE-10', 'Session Logout & Token Revocation', true, `Post-logout /api/bookings returned HTTP ${postLogout.status}`);
    }
  } finally {
    // Clean up ONLY synthetic QA_HOTEL_ID records via API + MongoDB & verify zero unintended modifications
    if (superAdminToken) {
      const saCleanupHeaders = {
        'x-session-token': superAdminToken,
        'x-user-role': 'SuperAdmin',
        'x-hotel-id': QA_HOTEL_ID,
        'x-target-hotel-id': QA_HOTEL_ID,
      };
      for (const col of ['rooms', 'bookings', 'staff']) {
        await httpJson(`/api/pms/modules/${col}`, {
          method: 'POST',
          headers: saCleanupHeaders,
          body: { hotelId: QA_HOTEL_ID, items: [] },
        }).catch(() => {});
      }
      await httpJson('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-session-token': superAdminToken },
      }).catch(() => {});
    }

    if (qaSessionToken) {
      await db.collection('pms_sessions').deleteOne({ _id: qaSessionToken as any }).catch(() => {});
    }
    if (superAdminToken) {
      await db.collection('pms_sessions').deleteOne({ _id: superAdminToken as any }).catch(() => {});
    }

    const afterDoc: any = await db.collection('pms_app_state').findOne({ _id: 'FULL_PMS_BACKUP' as any });
    if (afterDoc?.data) {
      const afterCounts = {
        hotels: countNonQa(afterDoc.data.hotels),
        rooms: countNonQa(afterDoc.data.rooms),
        bookings: countNonQa(afterDoc.data.bookings),
        invoices: countNonQa(afterDoc.data.invoices),
        posOrders: countNonQa(afterDoc.data.posOrders),
        staff: countNonQa(afterDoc.data.staff),
      };
      assert.deepEqual(
        afterCounts,
        baselineCounts,
        `Production data integrity mismatch! Before=${JSON.stringify(baselineCounts)}, After=${JSON.stringify(afterCounts)}`
      );
      record(
        'BE-11',
        'Zero Unintended Database Modifications (Production Data Integrity)',
        true,
        `Baseline == Post-Audit counts: ${JSON.stringify(afterCounts)}`
      );
    }

    await client.close();
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log(`\n=== BACKEND & DATABASE QA AUDIT SUMMARY: ${passedCount}/${results.length} PASSED ===`);
  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('❌ QA Backend & DB Audit Failed:', err);
  process.exit(1);
});
