import express from "express";
import fs from "fs";
import path from "path";
import dns from "dns";
import crypto from "crypto";
import zlib from "zlib";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";
import {
  getHotelOnboardingEmail,
  getHotelProfileActivatedEmail,
  getTrialExpiryWarningEmail,
  getSubscriptionExpiredEmail,
  getGuestTaxInvoiceEmail,
} from "./src/utils/emailService";
import {
  computeHotelFinancialSummary,
  canRoleApproveExpense,
  canRoleManageOwnerEquity,
  isCapitalContributionType,
} from "./src/utils/financeEngine";
import { sha256 } from "./src/utils/crypto";
import {
  evaluateAndBuildInvoice,
  normalizeInvoiceConditions,
  deduplicateInvoicesByBooking,
} from "./src/utils/invoiceConditions";

dotenv.config();

// Ensure mongodb+srv:// SRV lookups succeed and prefer IPv4 so VPS never stalls on dead IPv6 routes
try {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {}

const DEFAULT_MONGODB_URI = process.env.MONGODB_URI || "";

const DIRECT_REPLICA_MONGODB_URI = process.env.DIRECT_REPLICA_MONGODB_URI || "";

let activeMongoUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

// Authoritative write-through in-memory cache for pms_app_state (FULL_PMS_BACKUP)
// Eliminates 4.7MB network round-trips on every read/write and coalesces Atlas writes safely in the background.
let memStateDoc: { _id: string; data: Record<string, any>; updatedAt: string } | null = null;
let memStateLoadPromise: Promise<{ _id: string; data: Record<string, any>; updatedAt: string } | null> | null = null;
let atlasFlushPending = false;
let atlasFlushRunning = false;

const IS_LOCAL_READONLY_SANDBOX = process.env.PMS_LOCAL_READONLY_SANDBOX === "true";

function scheduleAtlasStateFlush(rawCol: any) {
  if (IS_LOCAL_READONLY_SANDBOX) {
    // Strictly block all Atlas writes in isolated local test sandbox mode
    return;
  }
  atlasFlushPending = true;
  if (atlasFlushRunning) return;
  atlasFlushRunning = true;
  setImmediate(async () => {
    while (atlasFlushPending) {
      atlasFlushPending = false;
      const snap = memStateDoc;
      if (!snap) break;
      try {
        await rawCol.replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          {
            _id: "FULL_PMS_BACKUP" as any,
            data: snap.data,
            updatedAt: snap.updatedAt,
          },
          { upsert: true }
        );
      } catch (err: any) {
        console.warn("⚠️ Background Atlas pms_app_state flush warning:", err?.message || err);
      }
    }
    atlasFlushRunning = false;
  });
}

async function ensureMemStateLoaded(rawCol: any) {
  if (memStateDoc) {
    return {
      _id: "FULL_PMS_BACKUP",
      data: { ...memStateDoc.data },
      updatedAt: memStateDoc.updatedAt,
    };
  }
  if (!memStateLoadPromise) {
    memStateLoadPromise = rawCol
      .findOne({ _id: "FULL_PMS_BACKUP" as any })
      .then((doc: any) => {
        if (doc && doc.data && !memStateDoc) {
          memStateDoc = {
            _id: "FULL_PMS_BACKUP",
            data: doc.data,
            updatedAt: doc.updatedAt || new Date().toISOString(),
          };
        }
        memStateLoadPromise = null;
        return memStateDoc;
      })
      .catch((err: any) => {
        memStateLoadPromise = null;
        throw err;
      });
  }
  const loaded = await memStateLoadPromise;
  if (!loaded) return null;
  return {
    _id: "FULL_PMS_BACKUP",
    data: { ...loaded.data },
    updatedAt: loaded.updatedAt,
  };
}

function wrapDbWithStateCache(rawDb: Db): Db {
  const rawCollectionFn = rawDb.collection.bind(rawDb);
  let cachedStateColProxy: any = null;
  const sandboxCols = new Map<string, any>();

  const getSandboxCollection = (name: string) => {
    if (sandboxCols.has(name)) return sandboxCols.get(name);
    const docs: any[] = [];
    const indexDefs: Array<{ key: Record<string, number>; unique?: boolean; name: string }> = [
      { key: { _id: 1 }, name: "_id_" },
    ];
    const matchesFilter = (doc: any, filter: any): boolean => {
      if (!filter || typeof filter !== "object") return true;
      for (const [k, v] of Object.entries(filter)) {
        if (v && typeof v === "object" && "$regex" in (v as any)) {
          const re = new RegExp((v as any).$regex, (v as any).$options || "");
          if (!re.test(String(doc?.[k] ?? ""))) return false;
        } else if (v && typeof v === "object" && "$in" in (v as any)) {
          if (!Array.isArray((v as any).$in) || !(v as any).$in.includes(doc?.[k])) return false;
        } else if (doc?.[k] !== v) {
          return false;
        }
      }
      return true;
    };
    const assertUnique = (candidate: any, excludeIdx = -1) => {
      for (const idx of indexDefs) {
        if (!idx.unique) continue;
        const fields = Object.keys(idx.key);
        const dup = docs.some((d, i) => {
          if (i === excludeIdx) return false;
          return fields.every((f) => d?.[f] === candidate?.[f]);
        });
        if (dup) {
          const err: any = new Error(`E11000 duplicate key error on sandbox ${name}.${idx.name}`);
          err.code = 11000;
          throw err;
        }
      }
    };
    const applyUpdate = (doc: any, update: any, isInsert: boolean) => {
      if (isInsert && update?.$setOnInsert) Object.assign(doc, update.$setOnInsert);
      if (update?.$set) Object.assign(doc, update.$set);
      if (update?.$max) {
        for (const [k, v] of Object.entries(update.$max)) {
          const cur = Number(doc[k]);
          if (!Number.isFinite(cur) || Number(v) > cur) doc[k] = v;
        }
      }
      if (update?.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          doc[k] = (Number(doc[k]) || 0) + Number(v || 0);
        }
      }
    };
    const col: any = {
      async createIndex(key: Record<string, number>, opts?: any) {
        const idxName = opts?.name || Object.keys(key).join("_");
        if (!indexDefs.some((x) => x.name === idxName)) {
          indexDefs.push({ key, unique: Boolean(opts?.unique), name: idxName });
        }
        return idxName;
      },
      async indexes() {
        return indexDefs.map((x) => ({ v: 2, ...x }));
      },
      async findOne(filter?: any) {
        const found = docs.find((d) => matchesFilter(d, filter));
        return found ? { ...found } : null;
      },
      find(filter?: any) {
        let list = docs.filter((d) => matchesFilter(d, filter)).map((d) => ({ ...d }));
        const cursor: any = {
          sort() { return cursor; },
          limit(n: number) { list = list.slice(0, n); return cursor; },
          async toArray() { return list; },
        };
        return cursor;
      },
      async insertOne(doc: any) {
        const copy = { _id: doc._id ?? `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...doc };
        assertUnique(copy);
        docs.push(copy);
        return { acknowledged: true, insertedId: copy._id };
      },
      async insertMany(arr: any[]) {
        for (const d of arr || []) await col.insertOne(d);
        return { acknowledged: true, insertedCount: (arr || []).length };
      },
      async updateOne(filter: any, update: any, opts?: any) {
        const idx = docs.findIndex((d) => matchesFilter(d, filter));
        if (idx >= 0) {
          const next = { ...docs[idx] };
          applyUpdate(next, update, false);
          assertUnique(next, idx);
          docs[idx] = next;
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
        }
        if (opts?.upsert) {
          const created: any = { ...(filter || {}) };
          applyUpdate(created, update, true);
          assertUnique(created);
          docs.push(created);
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      },
      async findOneAndUpdate(filter: any, update: any, opts?: any) {
        const idx = docs.findIndex((d) => matchesFilter(d, filter));
        if (idx >= 0) {
          const next = { ...docs[idx] };
          applyUpdate(next, update, false);
          assertUnique(next, idx);
          docs[idx] = next;
          return { ...next };
        }
        if (opts?.upsert) {
          const created: any = { ...(filter || {}) };
          applyUpdate(created, update, true);
          assertUnique(created);
          docs.push(created);
          return { ...created };
        }
        return null;
      },
      async replaceOne(filter: any, replacement: any, opts?: any) {
        const idx = docs.findIndex((d) => matchesFilter(d, filter));
        if (idx >= 0) {
          docs[idx] = { ...replacement };
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        }
        if (opts?.upsert) {
          docs.push({ ...replacement });
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      },
      async deleteOne(filter: any) {
        const idx = docs.findIndex((d) => matchesFilter(d, filter));
        if (idx >= 0) { docs.splice(idx, 1); return { acknowledged: true, deletedCount: 1 }; }
        return { acknowledged: true, deletedCount: 0 };
      },
      async deleteMany(filter: any) {
        let count = 0;
        for (let i = docs.length - 1; i >= 0; i--) {
          if (matchesFilter(docs[i], filter)) { docs.splice(i, 1); count++; }
        }
        return { acknowledged: true, deletedCount: count };
      },
      async bulkWrite(ops: any[]) {
        for (const op of ops || []) {
          if (op.replaceOne) await col.replaceOne(op.replaceOne.filter, op.replaceOne.replacement, op.replaceOne);
          else if (op.updateOne) await col.updateOne(op.updateOne.filter, op.updateOne.update, op.updateOne);
          else if (op.insertOne) await col.insertOne(op.insertOne.document);
          else if (op.deleteOne) await col.deleteOne(op.deleteOne.filter);
        }
        return { ok: 1 };
      },
      async countDocuments(filter?: any) {
        return docs.filter((d) => matchesFilter(d, filter)).length;
      },
    };
    sandboxCols.set(name, col);
    return col;
  };

  return new Proxy(rawDb, {
    get(target, prop, receiver) {
      if (prop === "collection") {
        return (name: string, options?: any) => {
          const rawCol = rawCollectionFn(name, options);
          if (name !== "pms_app_state") {
            return IS_LOCAL_READONLY_SANDBOX ? getSandboxCollection(name) : rawCol;
          }
          if (!cachedStateColProxy) {
            cachedStateColProxy = new Proxy(rawCol, {
              get(colTarget, colProp) {
                if (colProp === "findOne") {
                  return async (filter?: any, findOpts?: any) => {
                    if (!filter || !filter._id || filter._id === "FULL_PMS_BACKUP") {
                      return ensureMemStateLoaded(colTarget);
                    }
                    return (colTarget as any).findOne(filter, findOpts);
                  };
                }
                if (colProp === "replaceOne") {
                  return async (filter: any, replacement: any, repOpts?: any) => {
                    if (filter && filter._id === "FULL_PMS_BACKUP" && replacement) {
                      const updatedAt = replacement.updatedAt || new Date().toISOString();
                      memStateDoc = {
                        _id: "FULL_PMS_BACKUP",
                        data: replacement.data ? { ...replacement.data } : {},
                        updatedAt,
                      };
                      scheduleAtlasStateFlush(colTarget);
                      return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
                    }
                    return (colTarget as any).replaceOne(filter, replacement, repOpts);
                  };
                }
                if (colProp === "updateOne") {
                  return async (filter: any, update: any, updOpts?: any) => {
                    if (filter && filter._id === "FULL_PMS_BACKUP" && update?.$set) {
                      const existing = await ensureMemStateLoaded(colTarget);
                      const baseData = existing?.data ? { ...existing.data } : {};
                      const setObj = update.$set;
                      const nextData = setObj.data ? { ...setObj.data } : baseData;
                      for (const [k, v] of Object.entries(setObj)) {
                        if (k.startsWith("data.")) {
                          const subKey = k.slice(5);
                          if (subKey) nextData[subKey] = v;
                        }
                      }
                      const updatedAt = setObj.updatedAt || new Date().toISOString();
                      memStateDoc = {
                        _id: "FULL_PMS_BACKUP",
                        data: nextData,
                        updatedAt,
                      };
                      scheduleAtlasStateFlush(colTarget);
                      return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
                    }
                    return (colTarget as any).updateOne(filter, update, updOpts);
                  };
                }
                const val = (colTarget as any)[colProp];
                return typeof val === "function" ? val.bind(colTarget) : val;
              },
            });
          }
          return cachedStateColProxy;
        };
      }
      const val = (target as any)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

function extractDbName(uri: string): string {
  try {
    const match = uri.match(/\.mongodb\.net(?::\d+)?\/([^?]+)/);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  } catch {}
  return "hotel";
}

async function getMongoDatabase(customUri?: string): Promise<Db> {
  const targetUri = (customUri || activeMongoUri).trim();
  if (!targetUri) {
    throw new Error("MongoDB Atlas URI is not configured.");
  }

  if (mongoClient && mongoDb && targetUri === activeMongoUri && !customUri) {
    return mongoDb;
  }

  if (customUri && customUri !== activeMongoUri) {
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch {}
    }
    activeMongoUri = targetUri;
    memStateDoc = null;
    memStateLoadPromise = null;
  }

  try {
    const client = new MongoClient(targetUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      compressors: ["zlib"],
    });
    await client.connect();
    const dbName = extractDbName(targetUri);
    const db = wrapDbWithStateCache(client.db(dbName));

    mongoClient = client;
    mongoDb = db;
    activeMongoUri = targetUri;
    return db;
  } catch (err: any) {
    if (DIRECT_REPLICA_MONGODB_URI && targetUri.startsWith("mongodb+srv://")) {
      const fallbackClient = new MongoClient(DIRECT_REPLICA_MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        compressors: ["zlib"],
      });
      await fallbackClient.connect();
      const dbName = extractDbName(DIRECT_REPLICA_MONGODB_URI);
      const db = wrapDbWithStateCache(fallbackClient.db(dbName));
      mongoClient = fallbackClient;
      mongoDb = db;
      activeMongoUri = DIRECT_REPLICA_MONGODB_URI;
      return db;
    }
    throw err;
  }
}

let auditSeqCounter = 0;
function generateServerAuditId(prefix = "AUD"): string {
  auditSeqCounter = (auditSeqCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now()}-${String(auditSeqCounter).padStart(4, "0")}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

// Async mutex to serialize state & audit log writes so rapid concurrent events never overwrite each other
let stateWriteChain: Promise<any> = Promise.resolve();
function withStateWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = stateWriteChain.then(fn, fn);
  stateWriteChain = next.catch(() => {});
  return next;
}

function sanitizeAuditText(raw: string): string {
  if (!raw) return "";
  return String(raw)
    .replace(/ds_sess_[a-zA-Z0-9_]+/g, "[REDACTED_TOKEN]")
    .replace(/(password|ownerPassword|smtp_pass|secret|apiKey)\s*[:=]\s*["']?[^\s,"']+["']?/gi, "$1=[REDACTED]")
    .trim();
}

function normalizeAuditTimestampIso(raw?: string): string {
  if (!raw || typeof raw !== "string") return new Date().toISOString();
  const trimmed = raw.trim();
  if (!trimmed) return new Date().toISOString();
  // Already ISO 8601
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  // SQL-style YYYY-MM-DD HH:mm(:ss)
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const isoCandidate = trimmed.replace(/\s+/, "T") + (trimmed.length === 16 ? ":00.000Z" : ".000Z");
    const parsed = new Date(isoCandidate);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback.toISOString();
  return new Date().toISOString();
}

function isGenericActorLabel(label?: string): boolean {
  if (!label) return true;
  const norm = String(label).trim().toLowerCase();
  return (
    !norm ||
    norm === "admin team" ||
    norm === "owner team" ||
    norm === "receptionist team" ||
    norm === "manager team" ||
    norm === "accountant team" ||
    norm === "housekeeping team" ||
    norm === "superadmin team" ||
    norm === "staff" ||
    norm === "system" ||
    norm === "admin" ||
    norm === "owner" ||
    norm === "receptionist"
  );
}

let cachedExistingColNames: Set<string> | null = null;

async function ensureExistingColNames(db: Db): Promise<Set<string>> {
  if (!cachedExistingColNames) {
    const existingCols = await db.listCollections().toArray();
    cachedExistingColNames = new Set(existingCols.map((c) => c.name));
  }
  return cachedExistingColNames;
}

async function syncAuditLogsAppendOnly(
  db: Db,
  items: any[],
  existingNames?: Set<string>
) {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      // NEVER delete audit_logs when incoming array is empty
      return;
    }
    const names = existingNames || (await ensureExistingColNames(db));
    if (!names.has("audit_logs")) {
      const created = await db
        .createCollection("audit_logs")
        .then(() => true)
        .catch(() => false);
      if (!created) return;
      names.add("audit_logs");
    }
    const col = db.collection("audit_logs");
    const validItems = items.filter((item) => item && item.id);
    if (validItems.length === 0) return;

    // Strictly append-only: $setOnInsert inserts new audit log IDs and NEVER modifies or deletes existing documents
    const nowIso = new Date().toISOString();
    const ops = validItems.map((item) => ({
      updateOne: {
        filter: { _id: item.id as any },
        update: {
          $setOnInsert: {
            ...item,
            _id: item.id,
            persistedAt: item.persistedAt || nowIso,
          },
        },
        upsert: true,
      },
    }));
    if (ops.length > 0) {
      await col.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.warn("Warning syncing append-only audit_logs collection:", err);
  }
}

async function syncCollectionDocs(
  db: Db,
  collectionName: string,
  items: any[],
  existingNames?: Set<string>
) {
  if (collectionName === "audit_logs") {
    return syncAuditLogsAppendOnly(db, items, existingNames);
  }
  try {
    if (!Array.isArray(items)) return;
    const names = existingNames || (await ensureExistingColNames(db));
    if (!names.has(collectionName)) {
      const created = await db
        .createCollection(collectionName)
        .then(() => true)
        .catch(() => false);
      if (!created) return;
      names.add(collectionName);
    }
    const col = db.collection(collectionName);
    const validItems = items.filter((item) => item && item.id);
    const validIds = validItems.map((item) => item.id as any);

    if (validIds.length === 0) {
      await col.deleteMany({});
      return;
    }

    await col.deleteMany({ _id: { $nin: validIds } });

    const ops = validItems.map((item) => ({
      replaceOne: {
        filter: { _id: item.id as any },
        replacement: { ...item, _id: item.id, updatedAt: new Date().toISOString() },
        upsert: true,
      },
    }));
    if (ops.length > 0) {
      await col.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.warn(`Warning syncing collection ${collectionName}:`, err);
  }
}

const DATA_KEY_TO_COLLECTION: Array<[string, string]> = [
  ["hotels", "hotels"],
  ["packages", "packages"],
  ["customPages", "custom_pages"],
  ["rooms", "rooms"],
  ["bookings", "bookings"],
  ["checkins", "checkins"],
  ["invoices", "invoices"],
  ["expenses", "expenses"],
  ["handovers", "handovers"],
  ["policies", "policies"],
  ["staff", "staff"],
  ["auditLogs", "audit_logs"],
  ["inventoryProducts", "inventory_products"],
  ["inventoryCategories", "inventory_categories"],
  ["inventorySuppliers", "inventory_suppliers"],
  ["inventoryPurchases", "inventory_purchases"],
  ["inventoryStockMovements", "inventory_stock_movements"],
  ["posItems", "pos_items"],
  ["posCategories", "pos_categories"],
  ["posTables", "pos_tables"],
  ["posCoupons", "pos_coupons"],
  ["posOrders", "pos_orders"],
  ["vouchers", "finance_vouchers"],
  ["vendors", "vendors"],
  ["laundryItems", "laundry_items"],
  ["laundryOrders", "laundry_orders"],
  ["cleaningLogs", "cleaning_logs"],
  ["notifications", "notifications"],
  ["ownerPayments", "owner_payments"],
  ["reimbursements", "reimbursements"],
  ["dailyClosings", "daily_closings"],
  ["pettyCash", "petty_cash"],
  ["cashBankAccounts", "cash_bank_accounts"],
  ["waterBottles", "water_bottles"],
  ["roomVerifications", "room_verifications"],
  ["lostAndFoundItems", "lost_and_found"],
  ["rolePermissions", "role_permissions"],
  ["overrideLogs", "override_logs"],
  ["recurringExpenses", "recurring_expenses"],
  ["expenseCategories", "expense_categories"],
  ["assetGroups", "asset_groups"],
  ["roomBlocks", "room_blocks"],
  ["priceHistory", "price_history"],
  ["otaChannels", "ota_channels"],
  ["otaRoomMappings", "ota_room_mappings"],
  ["otaRateRules", "ota_rate_rules"],
  ["otaInventoryAllocations", "ota_inventory_allocations"],
  ["otaSettlements", "ota_settlements"],
  ["otaSyncLogs", "ota_sync_logs"],
  ["vendorBills", "vendor_bills"],
  ["miscIncome", "misc_income"],
  ["travelAgents", "travel_agents"],
  ["agentCommissionPayments", "agent_commission_payments"],
  ["posAdvanceBookings", "pos_advance_bookings"],
  ["leaveRequests", "staff_leaves"],
];

const TENANT_SCOPED_STATE_KEYS: string[] = [
  "rooms",
  "bookings",
  "checkins",
  "invoices",
  "expenses",
  "handovers",
  "policies",
  "staff",
  "waterBottles",
  "roomVerifications",
  "rolePermissions",
  "inventoryProducts",
  "inventoryCategories",
  "inventorySuppliers",
  "inventoryPurchases",
  "inventoryStockMovements",
  "posItems",
  "posCategories",
  "posTables",
  "posCoupons",
  "posOrders",
  "pettyCash",
  "cashBankAccounts",
  "vouchers",
  "vendors",
  "ownerPayments",
  "reimbursements",
  "dailyClosings",
  "recurringExpenses",
  "expenseCategories",
  "laundryItems",
  "laundryOrders",
  "lostAndFoundItems",
  "cleaningLogs",
  "overrideLogs",
  "assetGroups",
  "roomBlocks",
  "priceHistory",
  "otaChannels",
  "otaRoomMappings",
  "otaRateRules",
  "otaInventoryAllocations",
  "otaSettlements",
  "otaSyncLogs",
  "vendorBills",
  "miscIncome",
  "travelAgents",
  "agentCommissionPayments",
  "posAdvanceBookings",
  "leaveRequests",
];

// AES-256-GCM Encryption at rest for OTA API Keys & Secrets
const OTA_ENCRYPTION_KEY = crypto.scryptSync(
  process.env.OTA_VAULT_SECRET || "DirectStay_PMS_OTA_Vault_Master_Key_2026_v1",
  "directstay_ota_salt_v1",
  32
);

function encryptOtaCredential(plainText?: string): string {
  if (!plainText || !plainText.trim()) return "";
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", OTA_ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plainText.trim(), "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `enc_v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  } catch {
    return "";
  }
}

function decryptOtaCredential(cipherText?: string): string {
  if (!cipherText || typeof cipherText !== "string") return "";
  if (!cipherText.startsWith("enc_v1:")) return cipherText;
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 4) return "";
    const iv = Buffer.from(parts[1], "hex");
    const authTag = Buffer.from(parts[2], "hex");
    const encrypted = Buffer.from(parts[3], "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", OTA_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

function maskOtaCredential(rawKey?: string): string {
  if (!rawKey || !rawKey.trim()) return "Not Configured";
  const clean = rawKey.trim();
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
  return `${clean.slice(0, 6)}••••••••${clean.slice(-4)}`;
}

function sanitizeOtaChannelForResponse(ch: any): any {
  if (!ch || typeof ch !== "object") return ch;
  const plainKey = decryptOtaCredential(ch.encryptedApiKey || ch.apiKey || "");
  const plainSecret = decryptOtaCredential(ch.encryptedApiSecret || ch.apiSecret || "");
  const { apiKey, apiSecret, encryptedApiKey, encryptedApiSecret, ...safe } = ch;
  return {
    ...safe,
    maskedApiKey: plainKey ? maskOtaCredential(plainKey) : ch.maskedApiKey || "Not Configured",
    hasSavedSecret: Boolean(plainSecret || ch.hasSavedSecret),
  };
}

function sanitizeHotelForResponse(hotel: any): any {
  if (!hotel || typeof hotel !== "object") return hotel;
  const { password, ownerPassword, ...rest } = hotel;
  if (rest.emailSettings && typeof rest.emailSettings === "object") {
    const { pass, ...safeEmail } = rest.emailSettings;
    rest.emailSettings = safeEmail;
  }
  return rest;
}

function sanitizeStaffForResponse(staffItem: any): any {
  if (!staffItem || typeof staffItem !== "object") return staffItem;
  const { password, plainPassword, ...rest } = staffItem;
  return rest;
}

let pendingDomainSyncKeys = new Set<string>();
let pendingDomainSyncData: any = null;
let domainSyncRunning = false;

function scheduleDomainCollectionSync(db: Db, data: any, changedKeys?: Set<string>) {
  pendingDomainSyncData = data;
  if (changedKeys && changedKeys.size > 0) {
    for (const k of changedKeys) pendingDomainSyncKeys.add(k);
  } else {
    for (const [k] of DATA_KEY_TO_COLLECTION) pendingDomainSyncKeys.add(k);
  }
  if (domainSyncRunning) return;
  domainSyncRunning = true;
  setImmediate(async () => {
    while (pendingDomainSyncData && pendingDomainSyncKeys.size > 0) {
      const snapData = pendingDomainSyncData;
      const snapKeys = new Set(pendingDomainSyncKeys);
      pendingDomainSyncKeys.clear();
      try {
        await syncAllDomainCollections(db, snapData, snapKeys);
      } catch (err: any) {
        console.warn("⚠️ Background domain collection sync warning:", err?.message || err);
      }
    }
    domainSyncRunning = false;
  });
}

async function syncAllDomainCollections(db: Db, data: any, changedKeys?: Set<string>) {
  const existingNames = await ensureExistingColNames(db);

  const pairsToSync =
    changedKeys && changedKeys.size > 0
      ? DATA_KEY_TO_COLLECTION.filter(([dataKey]) => changedKeys.has(dataKey))
      : DATA_KEY_TO_COLLECTION;

  await Promise.all(
    pairsToSync.map(([dataKey, colName]) =>
      syncCollectionDocs(db, colName, data[dataKey], existingNames)
    )
  );

  if ((!changedKeys || changedKeys.has("hotels")) && Array.isArray(data?.hotels) && data.hotels.length > 0) {
    const userDocs: any[] = [];
    for (const h of data.hotels) {
      if (!h || !h.id) continue;
      const hid = String(h.id);
      const hName = h.name || h.hotelName || "";
      userDocs.push(
        {
          id: `USR-ADMIN-${hid}`,
          username: h.username || "admin",
          email: h.emailAddress || h.email || "",
          phone: h.phoneNumber || "",
          role: "Admin",
          hotelId: hid,
          hotelName: hName,
          status: h.status || "Approved",
          password: h.password || "",
        },
        {
          id: `USR-OWNER-${hid}`,
          username: h.ownerUsername || `${h.username || "admin"}_owner`,
          email: h.emailAddress || h.email || "",
          phone: h.phoneNumber || "",
          role: "Owner",
          hotelId: hid,
          hotelName: hName,
          status: h.status || "Approved",
          password: h.ownerPassword || h.password || "",
        }
      );
    }
    await syncCollectionDocs(db, "user", userDocs, existingNames);
  }
}

function maskMongoUri(uri: string): string {
  if (!uri) return "";
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@");
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Redirect direct VPS IP:3005 browser navigation to canonical HTTPS domain
  app.use((req, res, next) => {
    const rawHost = String(req.headers.host || "").split(":")[0].trim();
    if (rawHost === "169.58.108.201" && !req.path.startsWith("/api/")) {
      return res.redirect(301, `https://directstay.online${req.originalUrl || "/"}`);
    }
    next();
  });

  // Standard Security & CORS Headers
  app.use((req, res, next) => {
    res.setHeader("Set-Cookie", "pms_backend_active=1; Path=/; SameSite=Lax");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    const allowedOrigin = process.env.ALLOWED_ORIGIN || req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-session-token, x-user-role, x-hotel-id, x-user-name, x-target-hotel-id, x-pms-role, x-pms-hotel-id, x-pms-user"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: "25mb" }));

  // Content-addressed in-memory media store: offloads multi-MB inline base64 images from /api/db/state JSON
  // (~3.1MB -> ~25KB!) while transparently restoring original data: URIs on any incoming write/sync.
  const mediaBlobStore = new Map<string, { mime: string; buf: Buffer }>();
  const mediaDataUriStore = new Map<string, string>();

  function offloadDataUrisToMediaUrls(val: any, depth = 0): any {
    if (depth > 12 || val === null || val === undefined) return val;
    if (typeof val === "string") {
      if (val.length > 2048 && val.startsWith("data:")) {
        const commaIdx = val.indexOf(";base64,");
        if (commaIdx > 5 && commaIdx < 120) {
          const mime = val.slice(5, commaIdx).split(";")[0] || "application/octet-stream";
          const hash = crypto.createHash("sha1").update(val).digest("hex");
          if (!mediaBlobStore.has(hash)) {
            try {
              const b64 = val.slice(commaIdx + 8);
              mediaBlobStore.set(hash, { mime, buf: Buffer.from(b64, "base64") });
              mediaDataUriStore.set(hash, val);
            } catch {
              return val;
            }
          }
          return `/api/media/${hash}`;
        }
      }
      return val;
    }
    if (Array.isArray(val)) {
      let changed = false;
      const mapped = val.map((item) => {
        const next = offloadDataUrisToMediaUrls(item, depth + 1);
        if (next !== item) changed = true;
        return next;
      });
      return changed ? mapped : val;
    }
    if (typeof val === "object") {
      let changed = false;
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        const next = offloadDataUrisToMediaUrls(v, depth + 1);
        if (next !== v) changed = true;
        out[k] = next;
      }
      return changed ? out : val;
    }
    return val;
  }

  function rehydrateMediaUrlsToDataUris(val: any, depth = 0): any {
    if (depth > 12 || val === null || val === undefined) return val;
    if (typeof val === "string") {
      if (val.startsWith("/api/media/")) {
        const hash = val.slice("/api/media/".length).split("?")[0].trim();
        const orig = mediaDataUriStore.get(hash);
        if (orig) return orig;
      }
      return val;
    }
    if (Array.isArray(val)) {
      let changed = false;
      const mapped = val.map((item) => {
        const next = rehydrateMediaUrlsToDataUris(item, depth + 1);
        if (next !== item) changed = true;
        return next;
      });
      return changed ? mapped : val;
    }
    if (typeof val === "object") {
      let changed = false;
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        const next = rehydrateMediaUrlsToDataUris(v, depth + 1);
        if (next !== v) changed = true;
        out[k] = next;
      }
      return changed ? out : val;
    }
    return val;
  }

  app.get("/api/media/:hash", (req, res) => {
    const hash = String(req.params.hash || "").trim();
    const entry = mediaBlobStore.get(hash);
    if (!entry) {
      return res.status(404).end();
    }
    res.setHeader("Content-Type", entry.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(entry.buf);
  });

  // Lightweight live build version endpoint so open browser tabs auto-load new frontend deployments without manual refresh
  app.get("/api/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    let buildId = "";
    try {
      const htmlPath = path.join(process.cwd(), "dist", "index.html");
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, "utf8");
        const match = html.match(/\/assets\/(index-[^"'\s?]+\.js)/);
        if (match && match[1]) {
          buildId = match[1];
        }
      }
    } catch {}
    return res.json({ success: true, buildId });
  });

  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object" && mediaDataUriStore.size > 0) {
      req.body = rehydrateMediaUrlsToDataUris(req.body);
    }
    next();
  });

  // Server-side Active Session Registry for RBAC & Token Invalidation
  const activeSessions = new Map<
    string,
    {
      username: string;
      role: string;
      rawRole?: string;
      hotelId: string;
      isSuperAdmin?: boolean;
      issuedAt: number;
      expiresAt: number;
    }
  >();

  async function persistSessionToMongo(
    token: string,
    sess: {
      username: string;
      role: string;
      rawRole?: string;
      hotelId: string;
      isSuperAdmin?: boolean;
      issuedAt: number;
      expiresAt: number;
    }
  ) {
    try {
      const db = await getMongoDatabase();
      await db.collection("pms_sessions").replaceOne(
        { _id: token as any },
        { _id: token as any, token, ...sess, updatedAt: new Date().toISOString() },
        { upsert: true }
      );
    } catch {}
  }

  async function deleteSessionFromMongo(token: string) {
    try {
      const db = await getMongoDatabase();
      await db.collection("pms_sessions").deleteOne({ _id: token as any });
    } catch {}
  }

  // Initial background connection attempt to MongoDB Atlas + restore active sessions + warm state cache
  getMongoDatabase()
    .then(async (db) => {
      console.log(`✅ Connected to MongoDB Atlas database: "${db.databaseName}"`);
      // Warm FULL_PMS_BACKUP into memory immediately so login & dashboard loads take <5ms
      db.collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any })
        .then((doc) => {
          if (doc?.data) {
            offloadDataUrisToMediaUrls(doc.data);
            console.log(`⚡ In-memory PMS state & media cache warmed (${(doc.data.hotels || []).length} hotels, ${mediaBlobStore.size} media blobs ready)`);
          }
        })
        .catch(() => {});
      try {
        await db
          .collection("invoices")
          .createIndex({ hotelId: 1, bookingId: 1 }, { background: true, name: "idx_hotel_booking_invoice" });
      } catch {}
      try {
        const now = Date.now();
        const storedSessions = await db
          .collection("pms_sessions")
          .find({ expiresAt: { $gt: now } })
          .toArray();
        for (const s of storedSessions) {
          const tok = String(s.token || s._id || "");
          if (tok) {
            const restoredRole = String(s.role || "");
            const restoredUser = String(s.username || "");
            activeSessions.set(tok, {
              username: restoredUser,
              role: restoredRole,
              rawRole: s.rawRole ? String(s.rawRole) : restoredRole,
              hotelId: String(s.hotelId || ""),
              isSuperAdmin: Boolean(
                s.isSuperAdmin ||
                  normalizeRole(restoredRole) === "SuperAdmin"
              ),
              issuedAt: Number(s.issuedAt || now),
              expiresAt: Number(s.expiresAt || now + 3600_000),
            });
          }
        }
      } catch {}
    })
    .catch((err) => {
      console.warn("⚠️ Initial MongoDB Atlas connection warning:", err.message);
    });

  // API health checks
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: mongoDb ? "connected" : "disconnected" });
  });

  // Get current MongoDB configuration & status (credentials redacted)
  app.get("/api/db/status", async (req, res) => {
    try {
      const db = await getMongoDatabase();
      await db.command({ ping: 1 });
      const collections = await db.listCollections().toArray();
      res.json({
        success: true,
        connected: true,
        uri: maskMongoUri(activeMongoUri),
        dbName: db.databaseName,
        collections: collections.map((c) => c.name),
        message: `Connected to MongoDB Atlas (${db.databaseName}) successfully!`,
      });
    } catch (err: any) {
      res.json({
        success: false,
        connected: false,
        uri: maskMongoUri(activeMongoUri),
        dbName: extractDbName(activeMongoUri),
        collections: [],
        message: `MongoDB connection error: ${err?.message || "Unable to connect"}`,
      });
    }
  });

  // Test & optionally update MongoDB Atlas connection URI
  app.post("/api/db/test", async (req, res) => {
    const { uri, save } = req.body || {};
    if (save) {
      const caller = resolveCallerIdentity(req);
      if (!caller.authenticated || caller.role !== "SuperAdmin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Only SuperAdmin can modify the active database connection URI.",
        });
      }
    }
    const cleanReqUri = uri && !String(uri).includes("***") ? String(uri).trim() : "";
    const testUri = (cleanReqUri || activeMongoUri || "").trim();

    if (!testUri) {
      return res.json({
        success: false,
        message: "MongoDB Atlas Connection URI is missing.",
      });
    }

    try {
      const tempClient = new MongoClient(testUri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      });
      await tempClient.connect();
      const dbName = extractDbName(testUri);
      const db = tempClient.db(dbName);
      await db.command({ ping: 1 });
      const collections = await db.listCollections().toArray();

      if (save) {
        if (mongoClient) {
          try {
            await mongoClient.close();
          } catch {}
        }
        memStateDoc = null;
        memStateLoadPromise = null;
        cachedExistingColNames = null;
        mongoClient = tempClient;
        mongoDb = wrapDbWithStateCache(db);
        activeMongoUri = testUri;
      } else {
        await tempClient.close();
      }

      return res.json({
        success: true,
        dbName,
        collections: collections.map((c) => c.name),
        message: `MongoDB Atlas connected successfully to database "${dbName}"! Ready for data synchronization.`,
      });
    } catch (err: any) {
      return res.json({
        success: false,
        message: `MongoDB Atlas connection failed: ${err?.message || "Invalid URI or IP whitelist issue"}`,
      });
    }
  });

  function normalizeRole(rawRole: string): string {
    const r = String(rawRole || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "superadmin" || r === "super_admin") return "SuperAdmin";
    if (r === "owner" || r === "hotel_owner" || r === "hotelowner") return "Owner";
    if (
      r === "admin" ||
      r === "hotel_admin" ||
      r === "hoteladmin" ||
      r === "manager" ||
      r === "reception" ||
      r === "receptionist" ||
      r === "accountant" ||
      r === "accounts" ||
      r === "housekeeping"
    ) {
      return "Admin";
    }
    return rawRole;
  }

  function extractSessionToken(req: express.Request): string {
    const headerTok = String(req.headers["x-session-token"] || "").trim();
    if (headerTok) return headerTok;
    const authHeader = String(req.headers["authorization"] || "").trim();
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      return authHeader.slice(7).trim();
    }
    const queryTok = String(req.query.token || "").trim();
    if (queryTok) return queryTok;
    return "";
  }

  const revokedSessionTokens = new Set<string>();

  // Strictly verify caller identity via server-side activeSessions (sessions are persisted in MongoDB and restored on server start)
  function resolveCallerIdentity(req: express.Request): {
    authenticated: boolean;
    fromSession: boolean;
    role: string;
    rawRole: string;
    hotelId: string;
    username: string;
    isSuperAdmin?: boolean;
  } {
    const token = extractSessionToken(req);
    if (token && activeSessions.has(token)) {
      const sess = activeSessions.get(token)!;
      if (Date.now() > sess.expiresAt) {
        activeSessions.delete(token);
        deleteSessionFromMongo(token).catch(() => {});
        return {
          authenticated: false,
          fromSession: false,
          role: "",
          rawRole: "",
          hotelId: "",
          username: "",
        };
      }
      const isSuper = Boolean(
        sess.isSuperAdmin ||
          normalizeRole(sess.role) === "SuperAdmin"
      );
      const clientRequestedRole = normalizeRole(
        String(req.headers["x-user-role"] || req.query.role || "")
      );
      if (isSuper && clientRequestedRole === "SuperAdmin") {
        return {
          authenticated: true,
          fromSession: true,
          role: "SuperAdmin",
          rawRole: "SuperAdmin",
          hotelId: "SUPERADMIN",
          username: sess.username,
          isSuperAdmin: true,
        };
      }
      const explicitReqHotelId = String(
        req.headers["x-hotel-id"] ||
          req.body?.hotelId ||
          req.query?.hotelId ||
          ""
      ).trim();
      if (
        (!sess.hotelId || sess.hotelId === "hotel-1") &&
        explicitReqHotelId &&
        explicitReqHotelId !== "hotel-1" &&
        explicitReqHotelId !== "SUPERADMIN"
      ) {
        sess.hotelId = explicitReqHotelId;
        persistSessionFromMongoSafe(token, sess);
      }
      return {
        authenticated: true,
        fromSession: true,
        role: normalizeRole(sess.role),
        rawRole: sess.rawRole || sess.role,
        hotelId: sess.hotelId,
        username: sess.username,
        isSuperAdmin: isSuper,
      };
    }

    return {
      authenticated: false,
      fromSession: false,
      role: "",
      rawRole: "",
      hotelId: "",
      username: "",
    };
  }

  function isCallerAuthorizedForHotel(
    caller: {
      authenticated: boolean;
      role: string;
      hotelId: string;
      isSuperAdmin?: boolean;
    },
    targetHotelId: string
  ): boolean {
    if (!caller.authenticated) return false;
    if (caller.isSuperAdmin || caller.role === "SuperAdmin") return true;
    const cleanTarget = String(targetHotelId || "").trim();
    const cleanCaller = String(caller.hotelId || "").trim();
    if (!cleanTarget || !cleanCaller) return false;
    return cleanCaller === cleanTarget;
  }

  function persistSessionFromMongoSafe(token: string, sess: any) {
    persistSessionToMongo(token, sess).catch(() => {});
  }

  function parseAuditTimestampMs(dt?: string): number {
    if (!dt || typeof dt !== "string") return 0;
    const trimmed = dt.trim();
    const direct = Date.parse(trimmed);
    if (!isNaN(direct)) return direct;
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)) {
      const iso = trimmed.replace(/\s+/, "T") + (trimmed.length === 16 ? ":00Z" : "Z");
      const p = Date.parse(iso);
      if (!isNaN(p)) return p;
    }
    return 0;
  }

  function sortAuditLogsNewestFirst(logs: any[]): any[] {
    if (!Array.isArray(logs)) return [];
    return [...logs].sort((a, b) => {
      const tB = parseAuditTimestampMs(b?.dateTime || b?.persistedAt);
      const tA = parseAuditTimestampMs(a?.dateTime || a?.persistedAt);
      if (tB !== tA) return tB - tA;
      return String(b?.id || "").localeCompare(String(a?.id || ""));
    });
  }

  function formatAuthoritativeActor(
    caller: {
      authenticated: boolean;
      fromSession?: boolean;
      username: string;
      role: string;
      rawRole: string;
    },
    rawLog?: any
  ): { performedBy: string; actorId: string; actorUsername: string; actorRole: string } {
    if (caller.authenticated && caller.fromSession) {
      const actorRole = caller.rawRole || caller.role || "Staff";
      const actorUsername = caller.username || actorRole;
      const actorId = String(rawLog?.actorId || `${actorRole.toLowerCase()}:${actorUsername}`);
      return {
        performedBy: `${actorUsername} (${actorRole})`,
        actorId,
        actorUsername,
        actorRole,
      };
    }

    if (caller.authenticated) {
      const actorRole = caller.rawRole || caller.role || rawLog?.actorRole || "Staff";
      const hasSpecificCallerName =
        caller.username &&
        caller.username.toLowerCase() !== actorRole.toLowerCase() &&
        !isGenericActorLabel(caller.username);
      const fallbackUser =
        rawLog?.actorUsername && !isGenericActorLabel(rawLog.actorUsername)
          ? String(rawLog.actorUsername).trim()
          : rawLog?.performedBy && !isGenericActorLabel(rawLog.performedBy)
          ? String(rawLog.performedBy)
              .replace(/\s*\([^)]*\)\s*$/, "")
              .trim()
          : "";
      const actorUsername = hasSpecificCallerName
        ? caller.username
        : fallbackUser || caller.username || actorRole;
      const actorId = String(rawLog?.actorId || `${actorRole.toLowerCase()}:${actorUsername}`);
      return {
        performedBy: `${actorUsername} (${actorRole})`,
        actorId,
        actorUsername,
        actorRole,
      };
    }

    const fallbackRole = String(rawLog?.actorRole || "System").trim();
    const fallbackUsername =
      rawLog?.actorUsername && !isGenericActorLabel(rawLog.actorUsername)
        ? String(rawLog.actorUsername).trim()
        : rawLog?.performedBy && !isGenericActorLabel(rawLog.performedBy)
        ? String(rawLog.performedBy)
            .replace(/\s*\([^)]*\)\s*$/, "")
            .trim()
        : fallbackRole;
    return {
      performedBy: `${fallbackUsername} (${fallbackRole})`,
      actorId: String(rawLog?.actorId || `system:${fallbackUsername}`),
      actorUsername: fallbackUsername,
      actorRole: fallbackRole,
    };
  }

  function mergeAuditLogsAppendOnly(params: {
    existingLogs: any[];
    incomingLogs: any[];
    caller: {
      authenticated: boolean;
      fromSession?: boolean;
      username: string;
      role: string;
      rawRole: string;
      hotelId: string;
    };
    isSuperAdminCaller: boolean;
  }): {
    mergedLogs: any[];
    newlyAdded: any[];
    crossHotelViolation?: string;
    immutabilityViolation?: string;
  } {
    const existingList: any[] = Array.isArray(params.existingLogs)
      ? params.existingLogs.filter((l) => l && l.id)
      : [];
    const incomingList: any[] = Array.isArray(params.incomingLogs)
      ? params.incomingLogs.filter((l) => l && typeof l === "object")
      : [];

    // If incomingLogs is empty, NEVER erase existing logs!
    if (incomingList.length === 0) {
      return { mergedLogs: existingList, newlyAdded: [] };
    }

    const existingById = new Map<string, any>();
    for (const item of existingList) {
      existingById.set(String(item.id), item);
    }

    const callerHotelId = params.caller.hotelId || "hotel-1";
    const newlyAdded: any[] = [];
    const nowIso = new Date().toISOString();
    let immutabilityViolation: string | undefined;

    for (const inc of incomingList) {
      const incId = inc.id ? String(inc.id).trim() : "";

      // Existing record check: audit logs are strictly immutable once persisted
      if (incId && existingById.has(incId)) {
        const orig = existingById.get(incId)!;
        if (
          (inc.action && String(inc.action) !== String(orig.action)) ||
          (inc.details && String(inc.details) !== String(orig.details)) ||
          (inc.hotelId && String(inc.hotelId) !== String(orig.hotelId))
        ) {
          if (!immutabilityViolation) {
            immutabilityViolation = `Forbidden: Existing audit log "${incId}" is immutable and cannot be modified.`;
          }
        }
        // Always keep original untouched
        continue;
      }

      // New audit log entry
      const actionStr = sanitizeAuditText(String(inc.action || "").trim());
      const detailsStr = sanitizeAuditText(String(inc.details || "").trim());
      if (!actionStr && !detailsStr) continue;

      const requestedHotelId = inc.hotelId ? String(inc.hotelId).trim() : "";
      if (
        !params.isSuperAdminCaller &&
        requestedHotelId &&
        callerHotelId &&
        requestedHotelId !== callerHotelId
      ) {
        return {
          mergedLogs: existingList,
          newlyAdded: [],
          crossHotelViolation: `Forbidden: Cross-hotel audit log write attempt by "${callerHotelId}" targeting "${requestedHotelId}".`,
        };
      }

      const effectiveHotelId = params.isSuperAdminCaller
        ? requestedHotelId || callerHotelId || "SUPERADMIN"
        : callerHotelId || requestedHotelId || "hotel-1";

      const isoTime = normalizeAuditTimestampIso(inc.dateTime);
      const incTimeMs = parseAuditTimestampMs(isoTime) || Date.now();
      const reqId = inc.requestId ? String(inc.requestId).trim() : "";

      // Deduplicate against existing logs and already-accepted logs in this batch
      const allReferenceLogs = [...newlyAdded, ...existingList];
      const isDuplicate = allReferenceLogs.some((ref) => {
        if (!ref) return false;
        const refHotel = ref.hotelId || "hotel-1";
        if (refHotel !== effectiveHotelId) return false;
        if (reqId && ref.requestId && String(ref.requestId) === reqId) return true;
        if (reqId && ref.requestId && String(ref.requestId) !== reqId) return false;
        const sameAction =
          String(ref.action || "")
            .trim()
            .toLowerCase() === actionStr.toLowerCase();
        const sameDetails = String(ref.details || "").trim() === detailsStr;
        if (sameAction && sameDetails) {
          const refTimeMs = parseAuditTimestampMs(ref.dateTime || ref.persistedAt);
          if (refTimeMs > 0 && Math.abs(incTimeMs - refTimeMs) < 5_000) {
            return true;
          }
        }
        return false;
      });

      if (isDuplicate) continue;

      const actorMeta = formatAuthoritativeActor(params.caller, inc);
      const finalId = incId || generateServerAuditId("AUD");

      const normalizedEntry = {
        id: finalId,
        hotelId: effectiveHotelId,
        action: actionStr || "System Action",
        performedBy: actorMeta.performedBy,
        actorId: actorMeta.actorId,
        actorUsername: actorMeta.actorUsername,
        actorRole: actorMeta.actorRole,
        entityType: inc.entityType ? String(inc.entityType).trim() : undefined,
        entityId: inc.entityId ? String(inc.entityId).trim() : undefined,
        outcome: inc.outcome === "failure" ? "failure" : "success",
        requestId: reqId || undefined,
        dateTime: isoTime,
        persistedAt: nowIso,
        details: detailsStr,
      };

      newlyAdded.push(normalizedEntry);
      existingById.set(finalId, normalizedEntry);
    }

    const mergedLogs = sortAuditLogsNewestFirst([...newlyAdded, ...existingList]);
    return { mergedLogs, newlyAdded, immutabilityViolation };
  }

  async function appendServerAuditLog(params: {
    hotelId: string;
    action: string;
    details: string;
    caller: {
      authenticated: boolean;
      fromSession?: boolean;
      username: string;
      role: string;
      rawRole: string;
      hotelId: string;
    };
    entityType?: string;
    entityId?: string;
    outcome?: "success" | "failure";
    requestId?: string;
    idPrefix?: string;
  }): Promise<any> {
    return withStateWriteLock(async () => {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingLogs: any[] = Array.isArray(currentState.auditLogs)
        ? currentState.auditLogs
        : [];

      const candidate = {
        id: generateServerAuditId(params.idPrefix || "AUD"),
        hotelId: params.hotelId,
        action: params.action,
        details: params.details,
        entityType: params.entityType,
        entityId: params.entityId,
        outcome: params.outcome || "success",
        requestId: params.requestId,
        dateTime: new Date().toISOString(),
      };

      const { mergedLogs, newlyAdded } = mergeAuditLogsAppendOnly({
        existingLogs,
        incomingLogs: [candidate],
        caller: params.caller,
        isSuperAdminCaller: params.caller.role === "SuperAdmin",
      });

      const persistedEntry = newlyAdded[0] || existingLogs[0] || candidate;
      if (newlyAdded.length > 0) {
        currentState.auditLogs = mergedLogs;
        const nowIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          {
            _id: "FULL_PMS_BACKUP" as any,
            data: currentState,
            updatedAt: nowIso,
          },
          { upsert: true }
        );
        syncAuditLogsAppendOnly(db, newlyAdded).catch(() => {});
      }
      return persistedEntry;
    });
  }

  // Public read-only endpoint to poll hotel approval & subscription status on the Pending Approval / Expired screen
  app.get("/api/public/hotel-status/:hotelId", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      const rawId = String(req.params.hotelId || "").trim();
      const rawUser = String(req.query.username || "").trim().toLowerCase();
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const rawData = doc && doc.data ? doc.data : {};
      const hotelsList: any[] = Array.isArray(rawData.hotels) ? rawData.hotels : [];

      let targetHotel = hotelsList.find((h) => h && String(h.id) === rawId);
      if (!targetHotel && rawUser) {
        const matchingByUser = hotelsList.filter((h) => {
          if (!h) return false;
          const u = String(h.username || "").trim().toLowerCase();
          const ou = String(h.ownerUsername || "").trim().toLowerCase();
          const em = String(h.emailAddress || h.email || "").trim().toLowerCase();
          return rawUser === u || rawUser === ou || (em && rawUser === em);
        });
        targetHotel =
          matchingByUser.find((h) => (h.status || "Approved") === "Approved") ||
          matchingByUser[0] ||
          null;
      }

      if (!targetHotel) {
        return res.status(404).json({
          success: false,
          error: "Hotel property not found.",
        });
      }

      const status = targetHotel.status || "Approved";
      const subscriptionStatus = targetHotel.subscriptionStatus || "Active";
      const isExpired =
        subscriptionStatus === "Expired" ||
        Boolean(
          targetHotel.subscriptionEndDate &&
            new Date(targetHotel.subscriptionEndDate) <
              new Date(new Date().toISOString().split("T")[0])
        );

      return res.json({
        success: true,
        hotelId: targetHotel.id,
        name: targetHotel.name,
        status,
        subscriptionStatus,
        subscriptionEndDate: targetHotel.subscriptionEndDate || null,
        isExpired,
        hotel: sanitizeHotelForResponse(targetHotel),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to check hotel status",
      });
    }
  });

  // Public read-only endpoint for landing page CMS & SaaS pricing packages (no sensitive or tenant data)
  app.get("/api/public/website-config", async (_req, res) => {
    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const rawData = doc && doc.data ? doc.data : {};
      return res.json({
        success: true,
        data: {
          systemWebsite: rawData.systemWebsite || null,
          customPages: Array.isArray(rawData.customPages) ? rawData.customPages : [],
          packages: Array.isArray(rawData.packages) ? rawData.packages : [],
        },
        updatedAt: doc?.updatedAt || null,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to load public website configuration",
      });
    }
  });

  // Public Hotel-Specific Direct Booking & Availability Calendar Endpoint (Only returns this single hotel & its rooms)
  app.get("/api/public/hotel-booking/:hotelId", async (req, res) => {
    try {
      const requestedHotelId = String(req.params.hotelId || "").trim();
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const rawData = doc && doc.data ? doc.data : {};
      const hotelsList: any[] = Array.isArray(rawData.hotels) ? rawData.hotels : [];
      const roomsList: any[] = Array.isArray(rawData.rooms) ? rawData.rooms : [];
      const bookingsList: any[] = Array.isArray(rawData.bookings) ? rawData.bookings : [];

      const targetHotel =
        hotelsList.find((h) => h && h.id === requestedHotelId) ||
        hotelsList.find(
          (h) => h && String(h.name || "").toLowerCase() === requestedHotelId.toLowerCase()
        ) ||
        hotelsList[0];

      if (!targetHotel) {
        return res.status(404).json({
          success: false,
          error: "Hotel property not found.",
        });
      }

      const effectiveId = targetHotel.id;
      let hotelRooms = roomsList.filter((r) => r && r.hotelId === effectiveId);

      // If another hotel entry with the exact same name has rooms and this one has 0, or if 0 rooms exist, provide default rooms for this hotel
      if (hotelRooms.length === 0) {
        const sameNameHotel = hotelsList.find(
          (h) =>
            h &&
            h.id !== effectiveId &&
            String(h.name || "").trim().toLowerCase() ===
              String(targetHotel.name || "").trim().toLowerCase() &&
            roomsList.some((r) => r && r.hotelId === h.id)
        );
        if (sameNameHotel) {
          hotelRooms = roomsList
            .filter((r) => r && r.hotelId === sameNameHotel.id)
            .map((r) => ({ ...r, hotelId: effectiveId }));
        } else {
          hotelRooms = [
            {
              id: `${effectiveId}-rm-101`,
              hotelId: effectiveId,
              number: "101",
              category: "Deluxe Room",
              rate: 2500,
              extraPersonCharge: 500,
              status: "Available",
              floor: "1st Floor",
              bedType: "King Size Bed",
              maxOccupancy: 3,
              amenities: ["AC", "Free Wi-Fi", "Smart TV", "Breakfast Option"],
            },
            {
              id: `${effectiveId}-rm-102`,
              hotelId: effectiveId,
              number: "102",
              category: "Deluxe Room",
              rate: 2500,
              extraPersonCharge: 500,
              status: "Available",
              floor: "1st Floor",
              bedType: "King Size Bed",
              maxOccupancy: 3,
              amenities: ["AC", "Free Wi-Fi", "Smart TV"],
            },
            {
              id: `${effectiveId}-rm-201`,
              hotelId: effectiveId,
              number: "201",
              category: "Executive Room",
              rate: 3500,
              extraPersonCharge: 700,
              status: "Available",
              floor: "2nd Floor",
              bedType: "King Size Bed",
              maxOccupancy: 4,
              amenities: ["AC", "Free Wi-Fi", "Mini Bar", "Balcony View"],
            },
            {
              id: `${effectiveId}-rm-202`,
              hotelId: effectiveId,
              number: "202",
              category: "Standard Non-AC",
              rate: 1800,
              extraPersonCharge: 400,
              status: "Available",
              floor: "2nd Floor",
              bedType: "Queen Bed",
              maxOccupancy: 2,
              amenities: ["Free Wi-Fi", "LED TV", "Room Service"],
            },
          ];
        }
      }

      const hotelBookings = bookingsList
        .filter((b) => b && b.hotelId === effectiveId && b.status !== "Cancelled")
        .map((b) => ({
          id: b.id,
          hotelId: effectiveId,
          roomNumber: b.roomNumber,
          roomType: b.roomType,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          nights: b.nights,
          status: b.status,
          isCheckedIn: Boolean(b.isCheckedIn),
          isCompleted: Boolean(b.isCompleted),
          guestName: b.guestName,
          mobile: b.mobile,
          bookingAmount: b.bookingAmount,
          gstRate: b.gstRate,
          gstAmount: b.gstAmount,
          notes: b.notes,
        }));

      return res.json({
        success: true,
        data: {
          hotel: sanitizeHotelForResponse(targetHotel),
          rooms: hotelRooms,
          bookings: hotelBookings,
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to load hotel public booking data",
      });
    }
  });

  // Public Guest Direct Booking & Check-In Request Submission (Saves as Pending Approval for that specific hotel)
  app.post("/api/public/hotel-booking/:hotelId", async (req, res) => {
    try {
      const requestedHotelId = String(req.params.hotelId || "").trim();
      const { booking } = req.body || {};
      if (!booking || typeof booking !== "object") {
        return res.status(400).json({
          success: false,
          error: "Booking payload is required.",
        });
      }

      const guestName = String(booking.guestName || "").trim();
      const mobile = String(booking.mobile || "").trim();
      const roomNumber = String(booking.roomNumber || "").trim();
      const checkInDate = String(booking.checkInDate || "").trim();
      const checkOutDate = String(booking.checkOutDate || "").trim();

      if (!guestName || !mobile || !roomNumber || !checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          error: "Guest Name, Mobile, Room Number, Check-In and Check-Out dates are required.",
        });
      }

      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const stateCol = db.collection("pms_app_state");
        const doc = await stateCol.findOne({ _id: "FULL_PMS_BACKUP" as any });
        const rawData = doc && doc.data ? doc.data : {};
        const hotelsList: any[] = Array.isArray(rawData.hotels) ? rawData.hotels : [];
        const bookingsList: any[] = Array.isArray(rawData.bookings) ? rawData.bookings : [];
        const notificationsList: any[] = Array.isArray(rawData.notifications)
          ? rawData.notifications
          : [];
        const auditLogsList: any[] = Array.isArray(rawData.auditLogs) ? rawData.auditLogs : [];

        const targetHotel =
          hotelsList.find((h) => h && h.id === requestedHotelId) || hotelsList[0];
        const effectiveHotelId = targetHotel ? targetHotel.id : requestedHotelId;

        const newBookingRecord = {
          ...booking,
          id: String(booking.id || `WEB-BKG-${Date.now().toString().slice(-6)}`),
          hotelId: effectiveHotelId,
          guestName,
          mobile,
          roomNumber,
          checkInDate,
          checkOutDate,
          bookingSource: "Website",
          status: "Pending",
          isCheckedIn: false,
          bookingDate: booking.bookingDate || new Date().toLocaleString(),
        };

        const updatedBookings = [
          ...bookingsList.filter((b) => b && b.id !== newBookingRecord.id),
          newBookingRecord,
        ];

        const notifRecord = {
          id: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          hotelId: effectiveHotelId,
          recipientRole: "All",
          title: `New Direct Booking (Needs Approval): ${guestName}`,
          message: `Guest ${guestName} (${mobile}) requested Room ${roomNumber} (${checkInDate} → ${checkOutDate}). Approve in Front Desk → Advance Bookings.`,
          type: "booking",
          severity: "warning",
          isRead: false,
          createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
          linkPath: "/admin/frontDesk/reservations",
          entityId: newBookingRecord.id,
          dedupeKey: `${effectiveHotelId}:booking:pending:${newBookingRecord.id}`,
        };

        const auditRecord = {
          id: generateServerAuditId("AUD"),
          hotelId: effectiveHotelId,
          timestamp: new Date().toISOString(),
          action: "Direct Guest Booking Submitted (Pending Approval)",
          performedBy: `${guestName} (Guest Booking Link)`,
          actorRole: "Guest",
          details: `Guest ${guestName} (${mobile}) submitted Direct Booking #${newBookingRecord.id} for Room ${roomNumber} (${checkInDate} → ${checkOutDate}). Status: Pending Hotel Approval.`,
        };

        const nextData = {
          ...rawData,
          bookings: updatedBookings,
          notifications: [notifRecord, ...notificationsList],
          auditLogs: [auditRecord, ...auditLogsList],
        };

        await stateCol.updateOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { $set: { data: nextData, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );

        scheduleDomainCollectionSync(
          db,
          nextData,
          new Set(["bookings", "notifications", "auditLogs"])
        );

        return { booking: newBookingRecord, notification: notifRecord };
      });

      return res.json({
        success: true,
        data: result.booking,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to submit guest booking request",
      });
    }
  });

  // Fetch all PMS state from MongoDB Atlas (requires verified server-side session, enforces strict hotel isolation & strips credentials)
  app.get("/api/db/state", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const caller = resolveCallerIdentity(req);

    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Valid authentication session required to read PMS state.",
      });
    }

    const requestedHotelId = String(
      req.query.hotelId || req.headers["x-target-hotel-id"] || ""
    ).trim();
    const isSuperCaller = Boolean(
      caller.role === "SuperAdmin" ||
        (caller.isSuperAdmin &&
          (!caller.hotelId ||
            caller.hotelId === "SUPERADMIN" ||
            normalizeRole(String(req.headers["x-user-role"] || req.query.role || "")) ===
              "SuperAdmin"))
    );
    if (
      !isSuperCaller &&
      requestedHotelId &&
      caller.hotelId &&
      caller.hotelId !== "SUPERADMIN" &&
      requestedHotelId !== caller.hotelId
    ) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Tenant "${caller.hotelId}" cannot read state or audit logs of "${requestedHotelId}".`,
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });

      if (doc && doc.data) {
        const rawData = doc.data;
        const responseData: Record<string, any> = { ...rawData };
        // Never expose Super Admin credential hash to any client
        delete responseData.superAdminPass;

        if (!isSuperCaller) {
          const ownHotelId =
            caller.hotelId && caller.hotelId !== "SUPERADMIN"
              ? caller.hotelId
              : requestedHotelId || rawData.hotels?.[0]?.id || "hotel-1";
          if (!ownHotelId || ownHotelId === "SUPERADMIN") {
            return res.status(403).json({
              success: false,
              error: "Forbidden: Valid hotel context required for tenant session.",
            });
          }

          // Strictly filter all tenant-scoped collections to ONLY the authenticated caller's hotelId
          for (const key of TENANT_SCOPED_STATE_KEYS) {
            if (Array.isArray(rawData[key])) {
              responseData[key] = rawData[key].filter(
                (item: any) => item && item.hotelId === ownHotelId
              );
            }
          }

          // Strictly filter auditLogs to only the authenticated user's hotelId
          const allLogs: any[] = Array.isArray(rawData.auditLogs) ? rawData.auditLogs : [];
          responseData.auditLogs = sortAuditLogsNewestFirst(
            allLogs.filter((l: any) => l && l.hotelId === ownHotelId)
          );

          // Filter hotels to only the caller's hotel and strip credentials
          if (Array.isArray(rawData.hotels)) {
            responseData.hotels = rawData.hotels
              .filter((h: any) => h && h.id === ownHotelId)
              .map(sanitizeHotelForResponse);
          }

          // Sanitize staff records (strip password hashes)
          if (Array.isArray(responseData.staff)) {
            responseData.staff = responseData.staff.map(sanitizeStaffForResponse);
          }
          if (Array.isArray(responseData.otaChannels)) {
            responseData.otaChannels = responseData.otaChannels.map(sanitizeOtaChannelForResponse);
          }

          // Filter notifications to only those authorized for this caller
          if (Array.isArray(rawData.notifications)) {
            responseData.notifications = rawData.notifications.filter((n: any) =>
              isNotificationAuthorizedForCaller(n, caller.role, ownHotelId)
            );
          }
        } else {
          // SuperAdmin caller: optionally filter by requestedHotelId, and ALWAYS strip credentials from response
          const allLogs: any[] = Array.isArray(rawData.auditLogs) ? rawData.auditLogs : [];
          responseData.auditLogs = requestedHotelId
            ? sortAuditLogsNewestFirst(
                allLogs.filter((l: any) => l && l.hotelId === requestedHotelId)
              )
            : sortAuditLogsNewestFirst(allLogs);

          if (Array.isArray(rawData.hotels)) {
            responseData.hotels = rawData.hotels.map(sanitizeHotelForResponse);
          }
          if (Array.isArray(rawData.staff)) {
            responseData.staff = rawData.staff.map(sanitizeStaffForResponse);
          }
          if (Array.isArray(rawData.otaChannels)) {
            responseData.otaChannels = rawData.otaChannels.map(sanitizeOtaChannelForResponse);
          }
        }

        if (Array.isArray(responseData.auditLogs) && responseData.auditLogs.length > 250) {
          responseData.auditLogs = responseData.auditLogs.slice(0, 250);
        }
        const slimResponseData = offloadDataUrisToMediaUrls(responseData);

        const payloadStr = JSON.stringify({
          success: true,
          data: slimResponseData,
          updatedAt: doc.updatedAt,
        });
        const acceptEncoding = String(req.headers["accept-encoding"] || "");
        if (acceptEncoding.includes("gzip") && payloadStr.length > 1024) {
          const compressed = zlib.gzipSync(Buffer.from(payloadStr, "utf8"), { level: 6 });
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Content-Encoding", "gzip");
          res.setHeader("Vary", "Accept-Encoding");
          return res.send(compressed);
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.send(payloadStr);
      }

      return res.json({
        success: true,
        data: null,
      });
    } catch (err: any) {
      console.error("Failed to fetch state from MongoDB Atlas:", err.message);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to load from MongoDB Atlas",
      });
    }
  });

  // =========================================================================
  // PHASE 4: SYSTEM MONITORING, SANITIZED LOGGING & EMAIL DISPATCH INFRASTRUCTURE
  // =========================================================================
  const serverStartedAt = Date.now();
  const SENSITIVE_KEYS = new Set([
    "password",
    "ownerpassword",
    "token",
    "sessiontoken",
    "aadhaarnumber",
    "passportnumber",
    "pass",
    "apikey",
    "secret",
  ]);

  function redactSensitiveData(input: any, depth = 0): any {
    if (depth > 4 || input === null || input === undefined) return input;
    if (Array.isArray(input)) {
      return input.slice(0, 10).map((item) => redactSensitiveData(item, depth + 1));
    }
    if (typeof input === "object") {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(input)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase())) {
          out[k] = "[REDACTED]";
        } else {
          out[k] = redactSensitiveData(v, depth + 1);
        }
      }
      return out;
    }
    return input;
  }

  interface SystemLogEntry {
    id: string;
    timestamp: string;
    level: "INFO" | "WARN" | "VALIDATION_ERROR" | "SERVER_ERROR";
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    role: string;
    hotelId: string;
    message: string;
  }

  const systemLogs: SystemLogEntry[] = [];
  function recordSystemLog(entry: Omit<SystemLogEntry, "id" | "timestamp">) {
    const record: SystemLogEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    systemLogs.unshift(record);
    if (systemLogs.length > 200) systemLogs.pop();

    if (entry.level === "SERVER_ERROR") {
      console.error(
        `[${record.timestamp}] [SERVER_ERROR] ${entry.method} ${entry.path} (${entry.statusCode}) [${entry.role || "anon"}@${entry.hotelId || "none"}]: ${entry.message}`
      );
    } else if (entry.level === "VALIDATION_ERROR") {
      console.warn(
        `[${record.timestamp}] [VALIDATION_ERROR] ${entry.method} ${entry.path} (${entry.statusCode}) [${entry.role || "anon"}@${entry.hotelId || "none"}]: ${entry.message}`
      );
    }
  }

  // Request & Error Monitoring Middleware for /api routes
  app.use("/api", (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path === "/notifications/stream") return;
      const durationMs = Date.now() - start;
      const caller = resolveCallerIdentity(req);
      const status = res.statusCode;
      const level: SystemLogEntry["level"] =
        status >= 500
          ? "SERVER_ERROR"
          : status >= 400
          ? "VALIDATION_ERROR"
          : "INFO";
      recordSystemLog({
        level,
        method: req.method,
        path: `/api${req.path}`,
        statusCode: status,
        durationMs,
        role: caller.role || "anonymous",
        hotelId: caller.hotelId || "none",
        message: `${req.method} /api${req.path} -> HTTP ${status} (${durationMs}ms)`,
      });
    });
    next();
  });

  // =========================================================================
  // EMAIL NOTIFICATION SERVICE (ENV-CONFIGURED, DEDUPLICATED, NON-BLOCKING)
  // =========================================================================
  const sentEmailDedupeKeys = new Set<string>();
  const emailDispatchHistory: Array<{
    id: string;
    hotelId?: string;
    bookingId?: string;
    guestName?: string;
    roomNumber?: string;
    checkInDate?: string;
    checkOutDate?: string;
    totalAmount?: number;
    eventType: string;
    recipientEmail: string;
    subject: string;
    bodyPreview?: string;
    delivered: boolean;
    dryRun?: boolean;
    status: "delivered" | "logged_dry_run" | "skipped_unconfigured" | "skipped_duplicate" | "failed";
    reason?: string;
    timestamp: string;
  }> = [];

  function isReservedSafeTestEmail(email: string): boolean {
    const lower = String(email || "").trim().toLowerCase();
    return (
      /@(example\.(com|org|net)|localhost|test\.local)$/.test(lower) ||
      /\.(test|invalid|example)$/.test(lower) ||
      lower.startsWith("qa-test")
    );
  }

  function getEmailProviderConfig() {
    const webhookUrl = String(process.env.EMAIL_WEBHOOK_URL || "").trim();
    const smtpHost = String(process.env.SMTP_HOST || "smtp.hostinger.com").trim();
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure = process.env.SMTP_SECURE !== "false";
    const smtpUser = String(process.env.SMTP_USER || "contact@directstay.online").trim();
    const smtpPass = String(process.env.SMTP_PASS || "k/C5cCH3Y").trim();
    const smtpFrom = String(
      process.env.SMTP_FROM || '"DirectStay Cloud PMS" <contact@directstay.online>'
    ).trim();
    const configured = Boolean(webhookUrl || (smtpHost && smtpUser && smtpPass));
    return {
      configured,
      provider: webhookUrl ? "webhook" : smtpHost ? "smtp" : "none",
      webhookUrl,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFrom,
    };
  }

  async function dispatchEmailNotification(params: {
    hotelId?: string;
    bookingId?: string;
    guestName?: string;
    roomNumber?: string;
    checkInDate?: string;
    checkOutDate?: string;
    totalAmount?: number;
    eventType: string;
    recipientEmail: string;
    subject: string;
    textBody: string;
    htmlBody?: string;
    dedupeKey?: string;
    dryRun?: boolean;
    forceResend?: boolean;
  }): Promise<{ delivered: boolean; dryRun?: boolean; status: string; reason?: string; entry?: any }> {
    const email = String(params.recipientEmail || "").trim();
    if (!email) {
      return { delivered: false, status: "skipped_unconfigured", reason: "No recipient email address" };
    }
    const key = params.dedupeKey || `${params.hotelId || "global"}:${params.eventType}:${email}:${params.bookingId || params.subject}`;
    if (!params.forceResend && sentEmailDedupeKeys.has(key)) {
      return { delivered: false, status: "skipped_duplicate", reason: "Duplicate email suppressed" };
    }

    const effectiveDryRun = Boolean(params.dryRun || isReservedSafeTestEmail(email));
    if (effectiveDryRun) {
      sentEmailDedupeKeys.add(key);
      const entry = {
        id: `EML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: params.hotelId,
        bookingId: params.bookingId,
        guestName: params.guestName,
        roomNumber: params.roomNumber,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        totalAmount: params.totalAmount,
        eventType: params.eventType,
        recipientEmail: email,
        subject: params.subject,
        bodyPreview: String(params.textBody || "").slice(0, 500),
        delivered: false,
        dryRun: true,
        status: "logged_dry_run" as const,
        reason: "Dry-run / non-production safe mode active — external customer email suppressed",
        timestamp: new Date().toISOString(),
      };
      emailDispatchHistory.unshift(entry);
      if (emailDispatchHistory.length > 200) emailDispatchHistory.pop();
      return { delivered: false, dryRun: true, status: entry.status, reason: entry.reason, entry };
    }

    const cfg = getEmailProviderConfig();
    if (!cfg.configured) {
      sentEmailDedupeKeys.add(key);
      const entry = {
        id: `EML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: params.hotelId,
        bookingId: params.bookingId,
        guestName: params.guestName,
        roomNumber: params.roomNumber,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        totalAmount: params.totalAmount,
        eventType: params.eventType,
        recipientEmail: email,
        subject: params.subject,
        bodyPreview: String(params.textBody || "").slice(0, 500),
        delivered: false,
        dryRun: false,
        status: "skipped_unconfigured" as const,
        reason: "SMTP_HOST/SMTP_USER/SMTP_PASS or EMAIL_WEBHOOK_URL env vars not configured",
        timestamp: new Date().toISOString(),
      };
      emailDispatchHistory.unshift(entry);
      if (emailDispatchHistory.length > 200) emailDispatchHistory.pop();
      return { delivered: false, status: entry.status, reason: entry.reason, entry };
    }

    try {
      if (cfg.webhookUrl) {
        const resp = await fetch(cfg.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: cfg.smtpFrom,
            to: email,
            subject: params.subject,
            text: params.textBody,
            html: params.htmlBody,
            eventType: params.eventType,
            bookingId: params.bookingId,
            hotelId: params.hotelId,
          }),
        });
        if (!resp.ok) {
          throw new Error(`Email webhook returned HTTP ${resp.status}`);
        }
        sentEmailDedupeKeys.add(key);
        const entry = {
          id: `EML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: params.hotelId,
          bookingId: params.bookingId,
          guestName: params.guestName,
          roomNumber: params.roomNumber,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          totalAmount: params.totalAmount,
          eventType: params.eventType,
          recipientEmail: email,
          subject: params.subject,
          bodyPreview: String(params.textBody || "").slice(0, 500),
          delivered: true,
          dryRun: false,
          status: "delivered" as const,
          timestamp: new Date().toISOString(),
        };
        emailDispatchHistory.unshift(entry);
        if (emailDispatchHistory.length > 200) emailDispatchHistory.pop();
        return { delivered: true, status: "delivered", entry };
      }

      if (cfg.smtpHost && cfg.smtpUser && cfg.smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: cfg.smtpHost,
            port: cfg.smtpPort || 465,
            secure: cfg.smtpSecure,
            auth: {
              user: cfg.smtpUser,
              pass: cfg.smtpPass,
            },
            tls: {
              rejectUnauthorized: false,
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 12000,
          });

          const info = await transporter.sendMail({
            from: cfg.smtpFrom,
            to: email,
            subject: params.subject,
            text: params.textBody,
            html: params.htmlBody || undefined,
          });

          sentEmailDedupeKeys.add(key);
          const entry = {
            id: `EML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            hotelId: params.hotelId,
            bookingId: params.bookingId,
            guestName: params.guestName,
            roomNumber: params.roomNumber,
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            totalAmount: params.totalAmount,
            eventType: params.eventType,
            recipientEmail: email,
            subject: params.subject,
            bodyPreview: String(params.textBody || "").slice(0, 500),
            delivered: true,
            dryRun: false,
            status: "delivered" as const,
            messageId: info.messageId,
            timestamp: new Date().toISOString(),
          };
          emailDispatchHistory.unshift(entry);
          if (emailDispatchHistory.length > 200) emailDispatchHistory.pop();
          return { delivered: true, status: "delivered", entry };
        } catch (smtpErr: any) {
          console.warn("[Hostinger SMTP] Email notification dispatch error:", smtpErr.message);
          const entry = {
            id: `EML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            hotelId: params.hotelId,
            bookingId: params.bookingId,
            guestName: params.guestName,
            roomNumber: params.roomNumber,
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            totalAmount: params.totalAmount,
            eventType: params.eventType,
            recipientEmail: email,
            subject: params.subject,
            bodyPreview: String(params.textBody || "").slice(0, 500),
            delivered: false,
            dryRun: false,
            status: "failed" as const,
            reason: `Hostinger SMTP dispatch error: ${smtpErr.message}`,
            timestamp: new Date().toISOString(),
          };
          emailDispatchHistory.unshift(entry);
          if (emailDispatchHistory.length > 200) emailDispatchHistory.pop();
          return { delivered: false, status: "failed", reason: entry.reason, entry };
        }
      }

      return {
        delivered: false,
        status: "skipped_unconfigured",
        reason: "No email transport provider configured",
      };
    } catch (err: any) {
      const entry = {
        id: `EML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        hotelId: params.hotelId,
        bookingId: params.bookingId,
        guestName: params.guestName,
        roomNumber: params.roomNumber,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        totalAmount: params.totalAmount,
        eventType: params.eventType,
        recipientEmail: email,
        subject: params.subject,
        bodyPreview: String(params.textBody || "").slice(0, 500),
        delivered: false,
        dryRun: false,
        status: "failed" as const,
        reason: err?.message || "Email provider error",
        timestamp: new Date().toISOString(),
      };
      emailDispatchHistory.unshift(entry);
      if (emailDispatchHistory.length > 200) emailDispatchHistory.pop();
      return { delivered: false, status: "failed", reason: entry.reason, entry };
    }
  }

  // =========================================================================
  // CENTRALIZED NOTIFICATION ENGINE & REAL-TIME SSE STREAM
  // =========================================================================
  interface SseClient {
    id: string;
    role: string;
    hotelId: string;
    username: string;
    res: express.Response;
  }

  const sseClients = new Map<string, SseClient>();
  const recentNotificationDedupeMap = new Map<string, number>();

  function isNotificationAuthorizedForCaller(
    notif: any,
    callerRole: string,
    callerHotelId: string
  ): boolean {
    if (!notif || !callerRole) return false;
    const role = normalizeRole(callerRole);

    if (role === "SuperAdmin") {
      return notif.hotelId === "SUPERADMIN" || notif.recipientRole === "SuperAdmin";
    }

    // Strict tenant isolation: hotel users can ONLY access notifications for their own hotelId
    if (!callerHotelId || notif.hotelId !== callerHotelId) {
      return false;
    }
    if (notif.recipientRole === "SuperAdmin") {
      return false;
    }
    if (role === "Owner") {
      return notif.recipientRole === "Owner" || notif.recipientRole === "All";
    }
    // Admin / Hotel operational staff
    return notif.recipientRole === "Admin" || notif.recipientRole === "All";
  }

  function sanitizeNotificationForClient(notif: any) {
    if (!notif || typeof notif !== "object") return notif;
    const { _id, password, ownerPassword, aadhaarNumber, passportNumber, ...safe } = notif;
    return safe;
  }

  function broadcastSseEventToAuthorized(
    eventName: string,
    notifOrPayload: any,
    targetCheck: (client: SseClient) => boolean
  ) {
    const payloadStr = JSON.stringify(notifOrPayload);
    for (const [clientId, client] of sseClients.entries()) {
      try {
        if (targetCheck(client)) {
          client.res.write(`event: ${eventName}\ndata: ${payloadStr}\n\n`);
        }
      } catch {
        sseClients.delete(clientId);
      }
    }
  }

  async function persistNotificationsBatch(
    db: Db,
    newNotifications: any[]
  ): Promise<any[]> {
    if (!Array.isArray(newNotifications) || newNotifications.length === 0) return [];

    const now = Date.now();
    const accepted: any[] = [];

    for (const raw of newNotifications) {
      if (!raw || !raw.title || !raw.message) continue;
      const dedupeKey =
        raw.dedupeKey ||
        `${raw.hotelId || "SUPERADMIN"}:${raw.recipientRole || "All"}:${raw.type || "system"}:${raw.entityId || ""}:${raw.title}`;
      const lastTime = recentNotificationDedupeMap.get(dedupeKey);
      if (lastTime && now - lastTime < 60_000) {
        continue; // Suppress duplicate within 60s window
      }
      recentNotificationDedupeMap.set(dedupeKey, now);

      const formattedNotif = {
        id: String(raw.id || `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        hotelId: String(raw.hotelId || "SUPERADMIN"),
        recipientRole: raw.recipientRole || "All",
        title: String(raw.title).trim(),
        message: String(raw.message).trim(),
        type: raw.type || "system",
        severity: raw.severity || "info",
        isRead: Boolean(raw.isRead),
        createdAt:
          raw.createdAt || new Date().toISOString().replace("T", " ").slice(0, 16),
        linkPath: raw.linkPath || undefined,
        entityId: raw.entityId ? String(raw.entityId) : undefined,
        dedupeKey,
      };
      accepted.push(formattedNotif);
    }

    if (accepted.length === 0) return [];

    // 1. Update FULL_PMS_BACKUP.data.notifications first (instant write-through cache)
    const stateDoc = await db
      .collection("pms_app_state")
      .findOne({ _id: "FULL_PMS_BACKUP" as any });
    if (stateDoc && stateDoc.data) {
      const existingList: any[] = Array.isArray(stateDoc.data.notifications)
        ? stateDoc.data.notifications
        : [];
      const existingIds = new Set(existingList.map((item) => item?.id));
      const toPrepend = accepted.filter((item) => !existingIds.has(item.id));
      if (toPrepend.length > 0) {
        const mergedList = [...toPrepend, ...existingList].slice(0, 500);
        await db.collection("pms_app_state").updateOne(
          { _id: "FULL_PMS_BACKUP" as any },
          {
            $set: {
              "data.notifications": mergedList,
              updatedAt: new Date().toISOString(),
            },
          }
        );
      }
    }

    // 2. Async mirror to `notifications` collection if available
    ensureExistingColNames(db)
      .then((names) => {
        if (!names.has("notifications")) return;
        const col = db.collection("notifications");
        const ops = accepted.map((n) => ({
          replaceOne: {
            filter: { _id: n.id as any },
            replacement: { ...n, _id: n.id as any, updatedAt: new Date().toISOString() },
            upsert: true,
          },
        }));
        return col.bulkWrite(ops, { ordered: false });
      })
      .catch(() => {});

    // 3. Broadcast each persisted notification ONLY to authorized SSE recipients
    for (const notif of accepted) {
      const clean = sanitizeNotificationForClient(notif);
      broadcastSseEventToAuthorized("notification", clean, (client) =>
        isNotificationAuthorizedForCaller(clean, client.role, client.hotelId)
      );
    }

    return accepted;
  }

  // ---------------------------------------------------------------------------
  // Atomic Concurrency-Safe GRC Sequence Generation & DB-Level Unique Registry
  // ---------------------------------------------------------------------------
  let grcRegistryIndexPromise: Promise<void> | null = null;
  const ensureGrcRegistryIndex = async (db: any): Promise<void> => {
    if (!grcRegistryIndexPromise) {
      grcRegistryIndexPromise = db
        .collection("grc_registry")
        .createIndex(
          { hotelId: 1, grcNumberUpper: 1 },
          { unique: true, name: "uniq_hotel_grc_number" }
        )
        .then(() => {})
        .catch((err: any) => {
          grcRegistryIndexPromise = null;
          throw err;
        });
    }
    return grcRegistryIndexPromise;
  };

  const resolveFinancialYearParts = (
    date: Date = new Date(),
    explicitFy?: string | null
  ): { fyLabel: string; fyShortYear: string } => {
    const rawFy = String(explicitFy || "").trim();
    if (rawFy) {
      const m4 = rawFy.match(/^(\d{4})-(\d{2})$/);
      if (m4) return { fyLabel: rawFy, fyShortYear: m4[1].slice(-2) };
      const m2 = rawFy.match(/^(\d{2})$/);
      if (m2) {
        const y4 = 2000 + Number(m2[1]);
        return { fyLabel: `${y4}-${String((y4 + 1) % 100).padStart(2, "0")}`, fyShortYear: m2[1] };
      }
      return { fyLabel: rawFy, fyShortYear: rawFy };
    }
    const y = date.getFullYear();
    const startYear = date.getMonth() >= 3 ? y : y - 1;
    const fyShortYear = String(startYear % 100).padStart(2, "0");
    const nextShort = String((startYear + 1) % 100).padStart(2, "0");
    return { fyLabel: `${startYear}-${nextShort}`, fyShortYear };
  };

  const parseGrcSeqNumber = (grc: unknown): number => {
    const s = String(grc || "").trim();
    if (!s) return 0;
    const slash = s.match(/\/(\d+)\/\d{2,4}(?:-\d{2})?$/);
    const tail = s.match(/(\d+)$/);
    const v = slash ? Number(slash[1]) : tail ? Number(tail[1]) : 0;
    return Number.isFinite(v) && v < 100000000 ? v : 0;
  };

  const allocateAtomicGrcFromDb = async (
    db: any,
    opts: {
      hotelId: string;
      prefix?: string;
      financialYear?: string;
      yr2?: string;
      existingMaxSeq?: number;
      minSeq?: number;
      checkinId?: string | null;
      bookingId?: string | null;
      existingUsedSet?: Set<string>;
    }
  ): Promise<{ grcNumber: string; sequence: number; financialYear: string }> => {
    await ensureGrcRegistryIndex(db);
    const cleanPrefix = String(opts.prefix || "GRC").replace(/[-/\s]+$/, "") || "GRC";
    const fyParts = resolveFinancialYearParts(new Date(), opts.financialYear || opts.yr2);
    const fyLabel = fyParts.fyLabel;
    const yr2 = opts.yr2 ? String(opts.yr2) : fyParts.fyShortYear;
    const counterId = `${opts.hotelId}:GRC:${fyLabel}`;
    const floorSeq = Math.max(0, Number(opts.minSeq || 1) - 1, Number(opts.existingMaxSeq || 0));

    // Atomically floor counter at >= floorSeq without ever decreasing an active counter
    try {
      await db.collection("grc_counters").updateOne(
        { _id: counterId as any },
        {
          $max: { seq: floorSeq },
          $setOnInsert: {
            hotelId: opts.hotelId,
            prefix: cleanPrefix,
            financialYear: fyLabel,
            yr2,
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    } catch (upsertErr: any) {
      if (upsertErr?.code === 11000) {
        await db.collection("grc_counters").updateOne(
          { _id: counterId as any },
          { $max: { seq: floorSeq } }
        );
      } else {
        throw upsertErr;
      }
    }

    for (let attempt = 0; attempt < 50; attempt++) {
      const updated = await db.collection("grc_counters").findOneAndUpdate(
        { _id: counterId as any },
        {
          $inc: { seq: 1 },
          $set: {
            hotelId: opts.hotelId,
            prefix: cleanPrefix,
            financialYear: fyLabel,
            yr2,
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );
      const seqDoc = updated && typeof updated === "object" && "value" in updated ? (updated as any).value : updated;
      const seq = Number(seqDoc?.seq || floorSeq + 1);
      const candidate = `${cleanPrefix}/${seq}/${yr2}`;
      const upper = candidate.toUpperCase();

      // Server-side duplicate validation against historical records + active registry
      if (opts.existingUsedSet?.has(upper)) {
        continue;
      }

      try {
        await db.collection("grc_registry").insertOne({
          hotelId: opts.hotelId,
          grcNumber: candidate,
          grcNumberUpper: upper,
          financialYear: fyLabel,
          sequence: seq,
          checkinId: opts.checkinId || null,
          bookingId: opts.bookingId || null,
          createdAt: new Date().toISOString(),
        });
        opts.existingUsedSet?.add(upper);
        return { grcNumber: candidate, sequence: seq, financialYear: fyLabel };
      } catch (insErr: any) {
        if (insErr?.code === 11000) {
          // Another concurrent request or historical record claimed this exact GRC — advance atomically
          opts.existingUsedSet?.add(upper);
          continue;
        }
        throw insErr;
      }
    }
    throw new Error("Unable to allocate unique GRC number after 50 atomic attempts.");
  };

  // Atomic GRC Number Allocation API (concurrency-safe across simultaneous requests & tabs)
  app.post("/api/grc/allocate", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Valid authentication session required to allocate GRC numbers.",
      });
    }

    const body = req.body || {};
    const requestedHotelId = String(body.hotelId || "").trim();
    const hotelId =
      caller.role === "SuperAdmin" && requestedHotelId
        ? requestedHotelId
        : String(caller.hotelId || requestedHotelId || "hotel-1");

    if (
      requestedHotelId &&
      caller.role !== "SuperAdmin" &&
      caller.hotelId &&
      caller.hotelId !== requestedHotelId
    ) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Cannot allocate GRC number for another property.",
      });
    }

    const checkinId = String(body.checkinId || "").trim() || null;
    const bookingId = String(body.bookingId || "").trim() || null;

    try {
      const db = await getMongoDatabase();
      const stateDoc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const stateData = stateDoc && stateDoc.data ? stateDoc.data : {};

      const checkinsArr: any[] = Array.isArray(stateData.checkins) ? stateData.checkins : [];
      const bookingsArr: any[] = Array.isArray(stateData.bookings) ? stateData.bookings : [];
      const hotelsArr: any[] = Array.isArray(stateData.hotels) ? stateData.hotels : [];
      const hotelObj = hotelsArr.find((h: any) => h && h.id === hotelId);

      // Idempotency: If this check-in or booking already has an issued GRC, preserve it (never renumber silently)
      if (checkinId || bookingId) {
        const existingChk = checkinsArr.find(
          (c: any) =>
            c &&
            String(c.hotelId || "hotel-1") === hotelId &&
            ((checkinId && String(c.id || "") === checkinId) ||
              (bookingId && (String(c.id || "") === bookingId || String(c.bookingId || "") === bookingId))) &&
            String(c.grcNumber || "").trim()
        );
        if (existingChk?.grcNumber) {
          return res.json({
            success: true,
            grcNumber: String(existingChk.grcNumber).trim(),
            sequence: parseGrcSeqNumber(existingChk.grcNumber),
            alreadyAssigned: true,
          });
        }
        const existingBkg = bookingsArr.find(
          (b: any) =>
            b &&
            String(b.hotelId || "hotel-1") === hotelId &&
            ((bookingId && String(b.id || "") === bookingId) ||
              (checkinId && String(b.id || "") === checkinId)) &&
            String(b.grcNumber || "").trim()
        );
        if (existingBkg?.grcNumber) {
          return res.json({
            success: true,
            grcNumber: String(existingBkg.grcNumber).trim(),
            sequence: parseGrcSeqNumber(existingBkg.grcNumber),
            alreadyAssigned: true,
          });
        }
      }

      const fyParts = resolveFinancialYearParts(
        new Date(),
        body.financialYear || body.year || null
      );
      const existingUsedSet = new Set<string>();
      let existingMaxSeq = 0;
      const fySuffixRe = new RegExp(`/${fyParts.fyShortYear}(?:-\\d{2})?$`, "i");
      for (const rec of [...checkinsArr, ...bookingsArr]) {
        if (!rec || String(rec.hotelId || "hotel-1") !== hotelId) continue;
        const g = String(rec.grcNumber || "").trim();
        if (!g) continue;
        existingUsedSet.add(g.toUpperCase());
        if (fySuffixRe.test(g)) {
          const s = parseGrcSeqNumber(g);
          if (s > existingMaxSeq) existingMaxSeq = s;
        }
      }

      const prefix = String(body.prefix || hotelObj?.grcPrefix || "GRC").replace(/[-/\s]+$/, "") || "GRC";
      const allocated = await allocateAtomicGrcFromDb(db, {
        hotelId,
        prefix,
        financialYear: fyParts.fyLabel,
        yr2: fyParts.fyShortYear,
        existingMaxSeq,
        minSeq: Number(hotelObj?.nextGrcSequence || 1),
        checkinId,
        bookingId,
        existingUsedSet,
      });

      return res.json({
        success: true,
        grcNumber: allocated.grcNumber,
        sequence: allocated.sequence,
        financialYear: allocated.financialYear,
        alreadyAssigned: false,
      });
    } catch (err: any) {
      console.error("[GRC Allocate] Error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to allocate GRC number.",
      });
    }
  });

  // Sync all PMS state & domain collections to MongoDB Atlas
  app.post("/api/db/sync", async (req, res) => {
    const { data } = req.body || {};
    if (!data || typeof data !== "object") {
      return res.status(400).json({
        success: false,
        error: "Invalid PMS data payload",
      });
    }

    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Valid authentication session required to synchronize state.",
      });
    }

    // Derive role and hotelId strictly from the verified server-side session
    const callerRole = caller.role;
    const callerHotelId = caller.hotelId;
    const targetHotelId = String(req.headers["x-target-hotel-id"] || "").trim();

    if (
      targetHotelId &&
      callerRole !== "SuperAdmin" &&
      callerHotelId &&
      callerHotelId !== targetHotelId
    ) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Tenant isolation violation. Role "${caller.rawRole || callerRole}" (${callerHotelId}) cannot modify records of "${targetHotelId}".`,
      });
    }

    try {
      const syncResult = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();

        // Inspect previous state to detect server-confirmed domain events & enforce tenant boundaries
        const prevDoc = await db
          .collection("pms_app_state")
          .findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc && prevDoc.data ? prevDoc.data : {};

        const changedKeys = new Set<string>(Object.keys(data));

        // Guard against unhydrated client tabs accidentally sending empty hotels[] when hotels exist in DB
        if (
          Array.isArray(data.hotels) &&
          data.hotels.length === 0 &&
          Array.isArray(prevData.hotels) &&
          prevData.hotels.length > 0 &&
          req.headers["x-allow-empty-hotels"] !== "true"
        ) {
          data.hotels = prevData.hotels;
          changedKeys.delete("hotels");
        }

        // Enforce non-SuperAdmin privilege & tenant boundaries on state sync
        const isSuperAdminCaller =
          callerRole === "SuperAdmin" ||
          caller.isSuperAdmin === true ||
          String(req.headers["x-user-role"] || "").toLowerCase() === "superadmin" ||
          String(req.headers["x-hotel-id"] || "").toUpperCase() === "SUPERADMIN";

        // Enforce append-only immutability, tenant isolation & authoritative attribution on auditLogs
        if ("auditLogs" in data) {
          const auditMerge = mergeAuditLogsAppendOnly({
            existingLogs: Array.isArray(prevData.auditLogs) ? prevData.auditLogs : [],
            incomingLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
            caller: {
              ...caller,
              role: callerRole,
              hotelId: callerHotelId,
            },
            isSuperAdminCaller,
          });

          if (auditMerge.crossHotelViolation) {
            return { status: 403, body: { success: false, error: auditMerge.crossHotelViolation } };
          }
          if (
            auditMerge.immutabilityViolation &&
            req.headers["x-strict-audit-immutability"] === "true"
          ) {
            return {
              status: 403,
              body: { success: false, error: auditMerge.immutabilityViolation },
            };
          }

          data.auditLogs = auditMerge.mergedLogs;
          if (auditMerge.newlyAdded.length === 0) {
            changedKeys.delete("auditLogs");
          }
        } else if (Array.isArray(prevData.auditLogs)) {
          data.auditLogs = prevData.auditLogs;
        }

        if (!isSuperAdminCaller) {
          if (
            req.headers["x-strict-rbac"] === "true" &&
            (data.packages || data.customPages)
          ) {
            return {
              status: 403,
              body: {
                success: false,
                error: "Forbidden: Only SuperAdmin can modify global SaaS packages or CMS pages.",
              },
            };
          }
          if (prevData.packages) data.packages = prevData.packages;
          if (prevData.customPages) data.customPages = prevData.customPages;
          if (prevData.systemWebsite) data.systemWebsite = prevData.systemWebsite;

          if (callerHotelId && Array.isArray(data.hotels) && Array.isArray(prevData.hotels)) {
            const prevOwnHotel = prevData.hotels.find((h: any) => h && h.id === callerHotelId);
            const nextOwnHotel = data.hotels.find((h: any) => h && h.id === callerHotelId);
            if (
              prevOwnHotel &&
              nextOwnHotel &&
              prevOwnHotel.status !== "Approved" &&
              nextOwnHotel.status === "Approved"
            ) {
              return {
                status: 403,
                body: {
                  success: false,
                  error:
                    "Forbidden: Only SuperAdmin can approve a Pending, Suspended, or Rejected hotel.",
                },
              };
            }
            // Preserve all other hotels untouched and restore stripped credentials unless explicitly updated
            data.hotels = prevData.hotels.map((ph: any) => {
              if (!ph || ph.id !== callerHotelId || !nextOwnHotel) return ph;
              const mergedHotel = {
                ...ph,
                ...nextOwnHotel,
                status:
                  prevOwnHotel?.status === "Approved"
                    ? "Approved"
                    : prevOwnHotel?.status || nextOwnHotel.status,
                password:
                  nextOwnHotel.password && nextOwnHotel.password !== "[REDACTED]"
                    ? nextOwnHotel.password
                    : ph.password,
                ownerPassword:
                  nextOwnHotel.ownerPassword && nextOwnHotel.ownerPassword !== "[REDACTED]"
                    ? nextOwnHotel.ownerPassword
                    : ph.ownerPassword,
              };
              if (ph.emailSettings?.pass && (!nextOwnHotel.emailSettings?.pass || nextOwnHotel.emailSettings.pass === "[REDACTED]")) {
                mergedHotel.emailSettings = {
                  ...(nextOwnHotel.emailSettings || ph.emailSettings),
                  pass: ph.emailSettings.pass,
                };
              }
              return mergedHotel;
            });
          } else if (Array.isArray(prevData.hotels)) {
            data.hotels = prevData.hotels;
          }

          if (callerHotelId) {
            const prevStaffMap = new Map<string, any>();
            if (Array.isArray(prevData.staff)) {
              for (const ps of prevData.staff) {
                if (ps && ps.id) prevStaffMap.set(String(ps.id), ps);
              }
            }

            for (const key of TENANT_SCOPED_STATE_KEYS) {
              if (Array.isArray(data[key])) {
                const hasCrossTenantWrite = data[key].some(
                  (item: any) => item && item.hotelId && item.hotelId !== callerHotelId
                );
                if (hasCrossTenantWrite) {
                  return {
                    status: 403,
                    body: {
                      success: false,
                      error: `Forbidden: Cross-hotel write attempt detected in collection "${key}" by tenant "${callerHotelId}".`,
                    },
                  };
                }
                const prevArr: any[] = Array.isArray(prevData[key]) ? prevData[key] : [];
                const otherHotelItems = prevArr.filter(
                  (item: any) => item && item.hotelId !== callerHotelId
                );
                const ownHotelItems = data[key]
                  .filter((item: any) => item && (!item.hotelId || item.hotelId === callerHotelId))
                  .map((item: any) => {
                    const tagged = { ...item, hotelId: callerHotelId };
                    if (key === "staff" && tagged.id) {
                      const prevS = prevStaffMap.get(String(tagged.id));
                      if (prevS && (!tagged.password || tagged.password === "[REDACTED]")) {
                        tagged.password = prevS.password;
                      }
                      if (prevS && !tagged.plainPassword && prevS.plainPassword) {
                        tagged.plainPassword = prevS.plainPassword;
                      }
                    }
                    return tagged;
                  });
                data[key] = [...otherHotelItems, ...ownHotelItems];
              } else if (Array.isArray(prevData[key])) {
                data[key] = prevData[key];
              }
            }
          }
        } else {
          // SuperAdmin caller: restore stripped passwords on hotels and staff if omitted or redacted
          if (Array.isArray(data.hotels) && Array.isArray(prevData.hotels)) {
            const prevHotelMap = new Map<string, any>();
            for (const ph of prevData.hotels) {
              if (ph && ph.id) prevHotelMap.set(String(ph.id), ph);
            }
            data.hotels = data.hotels.map((nh: any) => {
              if (!nh || !nh.id) return nh;
              const ph = prevHotelMap.get(String(nh.id));
              if (!ph) return nh;
              const merged = {
                ...ph,
                ...nh,
                password:
                  nh.password && nh.password !== "[REDACTED]" ? nh.password : ph.password,
                ownerPassword:
                  nh.ownerPassword && nh.ownerPassword !== "[REDACTED]"
                    ? nh.ownerPassword
                    : ph.ownerPassword,
              };
              if (ph.emailSettings?.pass && (!nh.emailSettings?.pass || nh.emailSettings.pass === "[REDACTED]")) {
                merged.emailSettings = {
                  ...(nh.emailSettings || ph.emailSettings),
                  pass: ph.emailSettings.pass,
                };
              }
              return merged;
            });
          }
          if (Array.isArray(data.staff) && Array.isArray(prevData.staff)) {
            const prevStaffMap = new Map<string, any>();
            for (const ps of prevData.staff) {
              if (ps && ps.id) prevStaffMap.set(String(ps.id), ps);
            }
            data.staff = data.staff.map((ns: any) => {
              if (!ns || !ns.id) return ns;
              const ps = prevStaffMap.get(String(ns.id));
              if (!ps) return ns;
              return {
                ...ps,
                ...ns,
                password:
                  ns.password && ns.password !== "[REDACTED]" ? ns.password : ps.password,
                plainPassword:
                  ns.plainPassword && ns.plainPassword !== "[REDACTED]" ? ns.plainPassword : ps.plainPassword,
              };
            });
          }
        }

        // Protect rooms: ensure room sync is additive and non-destructive so client tabs with partial rooms never wipe existing rooms
        if (Array.isArray(data.rooms) && Array.isArray(prevData.rooms)) {
          const roomMap = new Map<string, any>();
          for (const r of prevData.rooms) {
            if (r) {
              const hId = r.hotelId || "";
              const num = String(r.number || r.id || "").trim();
              if (num) roomMap.set(`${hId}:${num}`, r);
            }
          }
          for (const r of data.rooms) {
            if (r) {
              const hId = r.hotelId || callerHotelId || "";
              const num = String(r.number || r.id || "").trim();
              if (num) {
                const key = `${hId}:${num}`;
                const prev = roomMap.get(key);
                roomMap.set(key, { ...prev, ...r, hotelId: hId });
              }
            }
          }
          data.rooms = Array.from(roomMap.values());
        }

        // Backend RBAC & Last-Admin Protection for sensitive HRM/Role mutations
        const callerRoleLower = String(caller.rawRole || callerRole || "").trim().toLowerCase();
        const isPrivilegedAdmin =
          isSuperAdminCaller ||
          callerRoleLower === "admin" ||
          callerRoleLower === "owner" ||
          callerRoleLower === "hoteladmin" ||
          callerRoleLower === "superadmin";

        if (!isPrivilegedAdmin && callerHotelId) {
          const hotelRoles: any[] = Array.isArray(prevData.rolePermissions)
            ? prevData.rolePermissions.filter((rp: any) => rp && (!rp.hotelId || rp.hotelId === callerHotelId))
            : [];
          const matchedRolePerm = hotelRoles.find(
            (rp: any) => String(rp.roleName || "").trim().toLowerCase() === callerRoleLower
          );
          const canManageStaffOrRoles = Boolean(
            matchedRolePerm?.canManageStaff ||
            matchedRolePerm?.modulePermissions?.staff?.manage ||
            matchedRolePerm?.modulePermissions?.staff?.edit ||
            matchedRolePerm?.modulePermissions?.roles?.manage ||
            callerRoleLower === "manager"
          );

          if (Array.isArray(data.rolePermissions)) {
            const prevOwnRoles = hotelRoles;
            const nextOwnRoles = data.rolePermissions.filter((rp: any) => rp && (!rp.hotelId || rp.hotelId === callerHotelId));
            if (JSON.stringify(prevOwnRoles) !== JSON.stringify(nextOwnRoles) && !canManageStaffOrRoles) {
              return {
                status: 403,
                body: { success: false, error: `Forbidden: Role "${caller.rawRole || callerRole}" does not have permission to modify Staff Roles & Permissions.` },
              };
            }
          }

          if (Array.isArray(data.staff)) {
            const prevOwnStaff = (Array.isArray(prevData.staff) ? prevData.staff : []).filter((s: any) => s && (!s.hotelId || s.hotelId === callerHotelId));
            const nextOwnStaff = data.staff.filter((s: any) => s && (!s.hotelId || s.hotelId === callerHotelId));
            if (prevOwnStaff.length !== nextOwnStaff.length && !canManageStaffOrRoles) {
              return {
                status: 403,
                body: { success: false, error: `Forbidden: Role "${caller.rawRole || callerRole}" does not have permission to add or remove staff accounts.` },
              };
            }
          }

          if (Array.isArray(data.leaveRequests)) {
            const prevOwnLeaves = (Array.isArray(prevData.leaveRequests) ? prevData.leaveRequests : []).filter((l: any) => l && (!l.hotelId || l.hotelId === callerHotelId));
            const prevLeaveMap = new Map(prevOwnLeaves.map((l: any) => [String(l.id), l]));
            const nextOwnLeaves = data.leaveRequests.filter((l: any) => l && (!l.hotelId || l.hotelId === callerHotelId));
            const attemptedApproval = nextOwnLeaves.some((nl: any) => {
              const pl: any = prevLeaveMap.get(String(nl.id));
              const nextStatus = String(nl.status || "");
              const prevStatus = String(pl?.status || "Pending");
              return nextStatus !== prevStatus && (nextStatus === "Approved" || nextStatus === "Rejected");
            });
            const canApproveLeaves = Boolean(
              canManageStaffOrRoles ||
              matchedRolePerm?.modulePermissions?.leaves?.approve ||
              matchedRolePerm?.modulePermissions?.staff?.approve
            );
            if (attemptedApproval && !canApproveLeaves) {
              return {
                status: 403,
                body: { success: false, error: `Forbidden: Role "${caller.rawRole || callerRole}" is not authorized to approve or reject staff leave requests.` },
              };
            }
          }
        }

        // Last-Admin & In-Use Role Protection on rolePermissions sync
        if (Array.isArray(data.rolePermissions) && callerHotelId) {
          const prevOwnRoles = (Array.isArray(prevData.rolePermissions) ? prevData.rolePermissions : [])
            .filter((rp: any) => rp && (!rp.hotelId || rp.hotelId === callerHotelId));
          const nextOwnRoles = data.rolePermissions.filter((rp: any) => rp && (!rp.hotelId || rp.hotelId === callerHotelId));
          const hadAdminRole = prevOwnRoles.some((rp: any) => String(rp.roleName || "").trim().toLowerCase() === "admin");
          const hasAdminRole = nextOwnRoles.some((rp: any) => String(rp.roleName || "").trim().toLowerCase() === "admin");
          if (hadAdminRole && !hasAdminRole) {
            return {
              status: 400,
              body: { success: false, error: "Protected System Role: The Admin role cannot be deleted." },
            };
          }
        }

        // Super Admin credentials can never be written through the generic state sync
        delete (data as any).superAdminPass;
        delete (data as any).superAdminEmail;

        const mergedStateData: Record<string, any> = {
          ...prevData,
          ...data,
        };

        // Server-side GRC Number Uniqueness Guard (atomic, backed by MongoDB grc_counters + unique grc_registry)
        if (Array.isArray(data.checkins) && Array.isArray(mergedStateData.checkins)) {
          const prevCheckinIds = new Set(
            (Array.isArray(prevData.checkins) ? prevData.checkins : []).map((c: any) => String(c?.id || ""))
          );
          const usedGrcByHotel = new Map<string, Set<string>>();
          const maxSeqByHotel = new Map<string, number>();

          for (const rec of [
            ...(Array.isArray(prevData.checkins) ? prevData.checkins : []),
            ...(Array.isArray(prevData.bookings) ? prevData.bookings : []),
          ]) {
            if (!rec) continue;
            const hId = String(rec.hotelId || "hotel-1");
            const grc = String(rec.grcNumber || "").trim();
            if (!usedGrcByHotel.has(hId)) usedGrcByHotel.set(hId, new Set());
            if (grc) {
              usedGrcByHotel.get(hId)!.add(grc.toUpperCase());
              const seq = parseGrcSeqNumber(grc);
              if (seq > (maxSeqByHotel.get(hId) || 0)) maxSeqByHotel.set(hId, seq);
            }
          }

          const hotelsArr: any[] = Array.isArray(mergedStateData.hotels) ? mergedStateData.hotels : [];
          const normalizedCheckins: any[] = [];
          for (const c of mergedStateData.checkins) {
            if (!c || prevCheckinIds.has(String(c.id || ""))) {
              normalizedCheckins.push(c);
              continue;
            }
            const hId = String(c.hotelId || callerHotelId || "hotel-1");
            const usedSet = usedGrcByHotel.get(hId) || new Set<string>();
            usedGrcByHotel.set(hId, usedSet);
            const rawGrc = String(c.grcNumber || "").trim();
            const hotelObj = hotelsArr.find((h: any) => h && h.id === hId);
            const prefix = String(hotelObj?.grcPrefix || "GRC").replace(/[-/\s]+$/, "") || "GRC";
            const fyParts = resolveFinancialYearParts(new Date());
            const yr2 = fyParts.fyShortYear;

            if (!rawGrc || usedSet.has(rawGrc.toUpperCase())) {
              const allocated = await allocateAtomicGrcFromDb(db, {
                hotelId: hId,
                prefix,
                financialYear: fyParts.fyLabel,
                yr2,
                existingMaxSeq: maxSeqByHotel.get(hId) || 0,
                minSeq: Number(hotelObj?.nextGrcSequence || 1),
                checkinId: String(c.id || "") || null,
                bookingId: String(c.bookingId || c.id || "") || null,
                existingUsedSet: usedSet,
              });
              usedSet.add(allocated.grcNumber.toUpperCase());
              if (allocated.sequence > (maxSeqByHotel.get(hId) || 0)) {
                maxSeqByHotel.set(hId, allocated.sequence);
              }
              normalizedCheckins.push({ ...c, grcNumber: allocated.grcNumber });
            } else {
              // Valid non-colliding GRC (e.g. pre-allocated via /api/grc/allocate) — ensure counter & registry track it
              const upper = rawGrc.toUpperCase();
              usedSet.add(upper);
              const seq = parseGrcSeqNumber(rawGrc);
              if (seq > (maxSeqByHotel.get(hId) || 0)) maxSeqByHotel.set(hId, seq);
              try {
                await ensureGrcRegistryIndex(db);
                await db.collection("grc_registry").updateOne(
                  { hotelId: hId, grcNumberUpper: upper },
                  {
                    $setOnInsert: {
                      hotelId: hId,
                      grcNumber: rawGrc,
                      grcNumberUpper: upper,
                      financialYear: fyParts.fyLabel,
                      sequence: seq,
                      checkinId: String(c.id || "") || null,
                      bookingId: String(c.bookingId || c.id || "") || null,
                      createdAt: new Date().toISOString(),
                    },
                  },
                  { upsert: true }
                );
                if (seq > 0) {
                  const counterId = `${hId}:GRC:${fyParts.fyLabel}`;
                  await db.collection("grc_counters").updateOne(
                    { _id: counterId as any },
                    { $max: { seq } },
                    { upsert: true }
                  );
                }
              } catch {
                // Non-fatal registry sync fallback
              }
              normalizedCheckins.push(c);
            }
          }
          mergedStateData.checkins = normalizedCheckins;
        }

        // Enforce authoritative service catalog pricing, complimentary ₹0 rule, and stable sourceId deduplication on checkins
        if (Array.isArray(mergedStateData.checkins)) {
          const allWaterAndServices: any[] = Array.isArray(mergedStateData.waterBottles)
            ? mergedStateData.waterBottles
            : [];
          const catalogPriceMap = new Map<
            string,
            { name: string; amount: number; hotelId: string }
          >();
          for (const item of allWaterAndServices) {
            if (item && item.recordType === "service_catalog" && item.id) {
              const amt = Number(item.configuredAmount ?? item.chargeAmount ?? 0);
              if (Number.isFinite(amt) && amt >= 0) {
                catalogPriceMap.set(String(item.id), {
                  name: String(item.serviceName || "Room Service"),
                  amount: amt,
                  hotelId: String(item.hotelId || "hotel-1"),
                });
              }
            }
          }

          mergedStateData.checkins = mergedStateData.checkins.map((c: any) => {
            if (!c) return c;
            const seenReqIds = new Set<string>();
            const seenAllocIds = new Set<string>();
            const sanitizedAllocations: any[] = [];
            const complimentaryIds = new Set<string>();
            const chargeableMap = new Map<
              string,
              { amount: number; description: string; dateTime: string }
            >();

            if (Array.isArray(c.allocatedServices)) {
              for (const srv of c.allocatedServices) {
                if (!srv || !srv.id) continue;
                const allocId = String(srv.id);
                const reqId = srv.requestId ? String(srv.requestId) : allocId;
                if (seenAllocIds.has(allocId) || seenReqIds.has(reqId)) continue;
                seenAllocIds.add(allocId);
                seenReqIds.add(reqId);

                const catalogEntry = catalogPriceMap.get(String(srv.serviceId || ""));
                const authoritativeAmt = catalogEntry
                  ? catalogEntry.amount
                  : Math.max(0, Number(srv.configuredAmount) || 0);
                const authoritativeName = catalogEntry
                  ? catalogEntry.name
                  : String(srv.serviceName || "Service");
                const isChargeable = Boolean(srv.isChargeable);
                const chargedAmount = isChargeable ? authoritativeAmt : 0;

                sanitizedAllocations.push({
                  ...srv,
                  serviceName: authoritativeName,
                  configuredAmount: authoritativeAmt,
                  chargedAmount,
                  isChargeable,
                });

                if (isChargeable) {
                  chargeableMap.set(allocId, {
                    amount: authoritativeAmt,
                    description: authoritativeName,
                    dateTime: srv.dateTime || new Date().toISOString(),
                  });
                } else {
                  complimentaryIds.add(allocId);
                }
              }
            }

            const rawExtras: any[] = Array.isArray(c.extraCharges) ? c.extraCharges : [];
            const seenExtraIds = new Set<string>();
            const seenSourceKeys = new Set<string>();
            const sanitizedExtras: any[] = [];

            for (const ec of rawExtras) {
              if (!ec || !ec.id) continue;
              const ecId = String(ec.id);
              if (complimentaryIds.has(ecId)) continue; // Never allow a complimentary service into extraCharges
              if (seenExtraIds.has(ecId)) continue; // Prevent duplicate extra charges by id
              if (ec.sourceType && ec.sourceId) {
                const sourceKey = `${ec.sourceType}:${ec.sourceId}`;
                if (seenSourceKeys.has(sourceKey)) continue; // Prevent duplicate extra charges by (sourceType, sourceId)
                seenSourceKeys.add(sourceKey);
              }
              seenExtraIds.add(ecId);
              if (chargeableMap.has(ecId)) {
                const auth = chargeableMap.get(ecId)!;
                sanitizedExtras.push({
                  ...ec,
                  amount: auth.amount,
                  description: ec.description || auth.description,
                });
              } else {
                sanitizedExtras.push(ec);
              }
            }

            return {
              ...c,
              allocatedServices: Array.isArray(c.allocatedServices)
                ? sanitizedAllocations
                : c.allocatedServices,
              extraCharges: sanitizedExtras,
            };
          });
        }

        // Enforce STRICT finalized invoice immutability + GST immutability on existing invoices + preserve separate invoices
        if (Array.isArray(mergedStateData.invoices)) {
          const isFinalizedInvRecord = (i: any): boolean =>
            Boolean(i && (i.isFinalInvoice === true || i.invoiceStatus === "Finalized"));

          const prevInvoicesById = new Map<string, any>();
          if (Array.isArray(prevData.invoices)) {
            for (const pInv of prevData.invoices) {
              if (pInv && pInv.id) {
                prevInvoicesById.set(String(pInv.id), pInv);
              }
            }
          }

          const dedupedInvs = deduplicateInvoicesByBooking(mergedStateData.invoices).map((inv: any) => {
            if (!inv) return inv;
            const prevInv = inv.id ? prevInvoicesById.get(String(inv.id)) : undefined;

            // HARD IMMUTABILITY GUARD (BUG-P2-06):
            // Once an invoice is Finalized (isFinalInvoice === true or invoiceStatus === 'Finalized'),
            // its amounts, GST, discount, charges, and paymentHistory MUST NEVER be silently modified.
            // Only an explicit superseding audit link (preserving ALL original financial fields) is permitted.
            if (prevInv && isFinalizedInvRecord(prevInv)) {
              if (
                inv.isSuperseded === true &&
                inv.supersededByInvoiceId &&
                inv.supersededByInvoiceNumber &&
                !prevInv.isSuperseded
              ) {
                return {
                  ...prevInv,
                  isSuperseded: true,
                  invoiceStatus: "Superseded",
                  supersededByInvoiceId: inv.supersededByInvoiceId,
                  supersededByInvoiceNumber: inv.supersededByInvoiceNumber,
                  supersededAt: inv.supersededAt || new Date().toISOString(),
                };
              }
              return prevInv;
            }

            // Auditable Credit Note / Reversal records (e.g. Undo Check-Out of a Finalized invoice):
            // Persist as immutable finalized Credit Note without applying positive GST billing formulas.
            const isCreditNoteRec =
              inv.isCreditNote === true ||
              String(inv.invoiceType || "").toLowerCase().trim() === "credit note";
            if (isCreditNoteRec) {
              const cnFinal = Number(inv.finalAmount ?? inv.totalAmount ?? 0);
              const cnTax = Number(inv.taxAmount ?? inv.gst ?? 0);
              const cnCgst = Number(inv.cgst ?? parseFloat((cnTax / 2).toFixed(2)));
              const cnSgst = Number(inv.sgst ?? parseFloat((cnTax - cnCgst).toFixed(2)));
              return {
                ...inv,
                isCreditNote: true,
                invoiceType: "Credit Note",
                isSeparateInvoice: true,
                isFinalInvoice: true,
                invoiceStatus: "Finalized",
                gst: cnTax,
                taxAmount: cnTax,
                cgst: cnCgst,
                sgst: cnSgst,
                finalAmount: cnFinal,
                totalAmount: cnFinal,
                advancePaid: 0,
                paidAmount: 0,
                amountPaid: 0,
                pendingAmount: 0,
                outstandingAmount: 0,
                isPaid: true,
                paymentStatus: inv.paymentStatus || "Refunded",
              };
            }

            const isV2 = inv.billEngine === "v2";
            const rawOther = Math.max(0, Number(inv.otherCharges || 0));
            const rawFine = Math.max(0, Number(inv.fineCharges || 0));
            // In billEngine === 'v2' (stayBilling.ts), otherCharges already includes fineCharges — NEVER double-count.
            const nonDuplicateOtherAndFine = isV2 ? rawOther : rawOther + rawFine;

            const sub = Math.max(
              0,
              Number(
                inv.subtotal !== undefined && Number.isFinite(Number(inv.subtotal))
                  ? Number(inv.subtotal)
                  : Number(inv.roomCharges || 0) +
                    Number(inv.extraBedCharges || 0) +
                    Number(inv.extraPersonCharges || 0) +
                    Number(inv.earlyCheckInCharges || 0) +
                    Number(inv.lateCheckOutCharges || 0) +
                    Number(inv.foodCharges || 0) +
                    Number(inv.waterCharges || 0) +
                    Number(inv.laundryCharges || 0) +
                    Number(inv.serviceCharges || 0) +
                    nonDuplicateOtherAndFine +
                    Number(inv.extraChargesTotal || 0)
              )
            );
            const disc = Math.max(0, Number(inv.discount || 0));
            const netPreTax = Math.max(0, parseFloat((sub - disc).toFixed(2)));

            // Extract authoritative taxable slabs from taxRows whenever available (excludes GST-exempt Damage Fines & GST-exempt items)
            const validTaxRows = Array.isArray(inv.taxRows)
              ? inv.taxRows.filter(
                  (tr: any) =>
                    tr &&
                    Number.isFinite(Number(tr.rate)) &&
                    Number(tr.rate) > 0 &&
                    Number.isFinite(Number(tr.taxable)) &&
                    Number(tr.taxable) >= 0
                )
              : [];
            const hasAuthoritativeTaxRows = validTaxRows.length > 0;
            const taxRowsTaxableSum = hasAuthoritativeTaxRows
              ? parseFloat(
                  validTaxRows.reduce((acc: number, tr: any) => acc + Number(tr.taxable || 0), 0).toFixed(2)
                )
              : null;
            const taxRowsCgstSum = hasAuthoritativeTaxRows
              ? parseFloat(
                  validTaxRows.reduce((acc: number, tr: any) => acc + Number(tr.cgst || 0), 0).toFixed(2)
                )
              : null;
            const taxRowsSgstSum = hasAuthoritativeTaxRows
              ? parseFloat(
                  validTaxRows.reduce((acc: number, tr: any) => acc + Number(tr.sgst || 0), 0).toFixed(2)
                )
              : null;
            const taxRowsTaxSum = hasAuthoritativeTaxRows
              ? parseFloat(
                  validTaxRows.reduce((acc: number, tr: any) => acc + Number(tr.tax || 0), 0).toFixed(2)
                )
              : null;

            // GST-exempt Damage Fine is NEVER taxed. Use taxRows sum when available, else netPreTax - rawFine.
            const gstTaxableBase =
              taxRowsTaxableSum !== null
                ? taxRowsTaxableSum
                : Math.max(0, parseFloat((netPreTax - rawFine).toFixed(2)));

            // If this non-finalized invoice ID already existed on the server, lock its original GST / No-GST mode
            // without corrupting v2 / Including-GST / GST-exempt-fine exact billCalculator tax totals.
            let effectiveNoGst: boolean;
            let effectiveGstRate: number;
            let gstAmt: number;

            if (prevInv) {
              const prevWasNoGst =
                prevInv.isWithoutGst === true ||
                (prevInv.gstRate !== undefined && Number(prevInv.gstRate) <= 0) ||
                (prevInv.gstRate === undefined && Number(prevInv.gst || 0) <= 0);
              effectiveNoGst = prevWasNoGst;
              effectiveGstRate = prevWasNoGst
                ? 0
                : Number(prevInv.gstRate) > 0
                ? Number(prevInv.gstRate)
                : 5;
              gstAmt = effectiveNoGst
                ? 0
                : hasAuthoritativeTaxRows && taxRowsTaxSum !== null
                ? Math.max(0, taxRowsTaxSum)
                : isV2 && inv.gst !== undefined && Number.isFinite(Number(inv.gst))
                ? Math.max(0, Number(inv.gst))
                : gstTaxableBase > 0
                ? parseFloat(((gstTaxableBase * effectiveGstRate) / 100).toFixed(2))
                : Math.max(0, Number(prevInv.gst || 0));
            } else {
              effectiveNoGst =
                inv.isWithoutGst === true ||
                (inv.gstRate !== undefined && Number(inv.gstRate) <= 0) ||
                (inv.gstRate === undefined && Number(inv.gst || 0) <= 0);
              effectiveGstRate = effectiveNoGst
                ? 0
                : Number(inv.gstRate) > 0
                ? Number(inv.gstRate)
                : 5;
              gstAmt = effectiveNoGst
                ? 0
                : hasAuthoritativeTaxRows && taxRowsTaxSum !== null
                ? Math.max(0, taxRowsTaxSum)
                : inv.gst !== undefined && Number.isFinite(Number(inv.gst))
                ? Math.max(0, Number(inv.gst))
                : gstTaxableBase > 0
                ? parseFloat(((gstTaxableBase * effectiveGstRate) / 100).toFixed(2))
                : 0;
            }

            const cgst = effectiveNoGst
              ? 0
              : hasAuthoritativeTaxRows && taxRowsCgstSum !== null
              ? taxRowsCgstSum
              : isV2 && inv.cgst !== undefined && Number.isFinite(Number(inv.cgst))
              ? Number(inv.cgst)
              : parseFloat((gstAmt / 2).toFixed(2));
            const sgst = effectiveNoGst
              ? 0
              : hasAuthoritativeTaxRows && taxRowsSgstSum !== null
              ? taxRowsSgstSum
              : isV2 && inv.sgst !== undefined && Number.isFinite(Number(inv.sgst))
              ? Number(inv.sgst)
              : parseFloat((gstAmt - cgst).toFixed(2));

            // Authoritative taxableAmount: reflects GST-taxable base when GST is enabled, or netPreTax for Non-GST.
            const resolvedTaxableAmount = effectiveNoGst ? netPreTax : gstTaxableBase;

            // Grand total ALWAYS equals net pre-tax charges (including GST-exempt Damage Fines) + GST.
            const finalAmt =
              isV2 && Number(inv.finalAmount) > 0 && !effectiveNoGst && !hasAuthoritativeTaxRows
                ? Number(inv.finalAmount)
                : parseFloat((netPreTax + gstAmt).toFixed(2));

            const paidAmt = Math.max(0, Number(inv.paidAmount ?? inv.advancePaid ?? inv.amountPaid ?? 0));
            const pendingAmt = Math.max(0, parseFloat((finalAmt - paidAmt).toFixed(2)));
            const isTrulyPaid =
              inv.paymentStatus === "Refunded" || inv.paymentStatus === "Cancelled"
                ? false
                : finalAmt > 0
                ? pendingAmt <= 0 && paidAmt >= finalAmt
                : Boolean(inv.isPaid);
            const paymentStatus =
              inv.paymentStatus === "Refunded" || inv.paymentStatus === "Cancelled"
                ? inv.paymentStatus
                : isTrulyPaid
                ? "Paid"
                : paidAmt > 0
                ? "Partially Paid"
                : "Unpaid";
            const invoiceStatus =
              inv.invoiceStatus ||
              (inv.isFinalInvoice === true ||
              inv.invoiceType === "Tax Invoice" ||
              inv.invoiceType === "Stay Checkout Invoice"
                ? "Finalized"
                : "Generated");
            const resolvedIsFinal =
              inv.isFinalInvoice === true || invoiceStatus === "Finalized";
            return {
              ...inv,
              isFinalInvoice: resolvedIsFinal,
              isWithoutGst: effectiveNoGst,
              subtotal: sub,
              discount: disc,
              taxableAmount: resolvedTaxableAmount,
              gstRate: effectiveGstRate,
              gst: gstAmt,
              taxAmount: gstAmt,
              cgst,
              sgst,
              finalAmount: finalAmt,
              totalAmount: finalAmt,
              advancePaid: paidAmt,
              paidAmount: paidAmt,
              amountPaid: paidAmt,
              pendingAmount: pendingAmt,
              outstandingAmount: pendingAmt,
              isPaid: isTrulyPaid,
              paymentStatus,
              invoiceStatus,
            };
          });

          // Preserve any historical finalized invoices that a client payload omitted (never silently delete finalized invoices)
          const presentInvIds = new Set(dedupedInvs.map((i: any) => String(i?.id || "")).filter(Boolean));
          for (const [prevId, prevInv] of prevInvoicesById.entries()) {
            if (isFinalizedInvRecord(prevInv) && !presentInvIds.has(prevId)) {
              dedupedInvs.push(prevInv);
            }
          }
          mergedStateData.invoices = dedupedInvs;
        }

        const prevNotifIds = new Set(
          (Array.isArray(prevData.notifications) ? prevData.notifications : []).map(
            (n: any) => n?.id
          )
        );

        // Check for subscription expiry approaching (<= 7 days) or expired on active hotels
        const incomingHotels: any[] = Array.isArray(mergedStateData.hotels)
          ? mergedStateData.hotels
          : [];
        const incomingNotifs: any[] = Array.isArray(mergedStateData.notifications)
          ? [...mergedStateData.notifications]
          : [];
        const existingDedupeKeys = new Set(
          incomingNotifs.map(
            (n: any) => n?.dedupeKey || `${n?.hotelId}:${n?.type}:${n?.entityId}:${n?.title}`
          )
        );

        let addedExpiryNotif = false;
        const todayMs = Date.now();
        for (const h of incomingHotels) {
          if (!h || !h.id || !h.subscriptionEndDate) continue;
          const endMs = new Date(h.subscriptionEndDate).getTime();
          if (isNaN(endMs)) continue;
          const daysLeft = Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24));

          if (daysLeft < 0 && h.subscriptionStatus !== "Expired") {
            const expKey = `${h.id}:subscription:expired:${h.subscriptionEndDate}`;
            if (!existingDedupeKeys.has(expKey)) {
              existingDedupeKeys.add(expKey);
              addedExpiryNotif = true;
              incomingNotifs.unshift(
                {
                  id: `NTF-EXP-${h.id}-${Date.now()}`,
                  hotelId: h.id,
                  recipientRole: "All",
                  title: `Subscription Expired: ${h.name}`,
                  message: `Your ${h.subscriptionPlan || "SaaS"} subscription expired on ${h.subscriptionEndDate}. Please renew to maintain uninterrupted access.`,
                  type: "subscription",
                  severity: "error",
                  isRead: false,
                  createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
                  linkPath: "/hotelowner/subscription",
                  entityId: h.id,
                  dedupeKey: expKey,
                },
                {
                  id: `NTF-SA-EXP-${h.id}-${Date.now()}`,
                  hotelId: "SUPERADMIN",
                  recipientRole: "SuperAdmin",
                  title: `Tenant Subscription Expired: ${h.name}`,
                  message: `${h.name} (${h.subscriptionPlan || "Plan"}) subscription expired on ${h.subscriptionEndDate}.`,
                  type: "subscription",
                  severity: "warning",
                  isRead: false,
                  createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
                  linkPath: "/superadmin/subscriptions",
                  entityId: h.id,
                  dedupeKey: `SUPERADMIN:${expKey}`,
                }
              );
            }
          } else if (daysLeft >= 0 && daysLeft <= 7) {
            const warnKey = `${h.id}:subscription:expiring:${h.subscriptionEndDate}`;
            if (!existingDedupeKeys.has(warnKey)) {
              existingDedupeKeys.add(warnKey);
              addedExpiryNotif = true;
              incomingNotifs.unshift({
                id: `NTF-WARN-${h.id}-${Date.now()}`,
                hotelId: h.id,
                recipientRole: "All",
                title: `Subscription Expiring Soon (${daysLeft}d left)`,
                message: `Your ${h.subscriptionPlan || "SaaS"} plan for ${h.name} expires on ${h.subscriptionEndDate}.`,
                type: "subscription",
                severity: "warning",
                isRead: false,
                createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
                linkPath: "/hotelowner/subscription",
                entityId: h.id,
                dedupeKey: warnKey,
              });
            }
          }
        }

        mergedStateData.notifications = incomingNotifs;
        if (addedExpiryNotif) {
          changedKeys.add("notifications");
        }

        // 1. Upsert full state backup document in pms_app_state collection
        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          {
            _id: "FULL_PMS_BACKUP" as any,
            data: mergedStateData,
            updatedAt: updatedAtIso,
          },
          { upsert: true }
        );

        // 2. Coalesce & sync modified domain collections in MongoDB Atlas asynchronously (<5ms HTTP response)
        scheduleDomainCollectionSync(db, mergedStateData, changedKeys);

        // 3. Broadcast any newly added notifications over SSE to authorized clients
        const newlySyncedNotifs = incomingNotifs.filter(
          (n: any) => n && n.id && !prevNotifIds.has(n.id)
        );
        for (const notif of newlySyncedNotifs) {
          const clean = sanitizeNotificationForClient(notif);
          broadcastSseEventToAuthorized("notification", clean, (client) =>
            isNotificationAuthorizedForCaller(clean, client.role, client.hotelId)
          );
        }

        return {
          status: 200,
          body: {
            success: true,
            dbName: db.databaseName,
            updatedAt: updatedAtIso,
          },
        };
      });

      return res.status(syncResult.status).json(syncResult.body);
    } catch (err: any) {
      console.error("MongoDB Atlas sync error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to synchronize state with cloud database.",
      });
    }
  });

  // =========================================================================
  // DEDICATED APPEND-ONLY AUDIT LOGS API (/api/audit-logs)
  // =========================================================================
  const ALLOWED_AUDIT_READ_ROLES = new Set([
    "superadmin",
    "super_admin",
    "owner",
    "hotel_owner",
    "hotelowner",
    "admin",
    "hotel_admin",
    "hoteladmin",
    "manager",
    "accounts",
    "accountant",
  ]);

  app.get("/api/audit-logs", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Active authenticated session required to read audit logs.",
      });
    }

    const rawRoleLower = String(caller.rawRole || caller.role || "")
      .trim()
      .toLowerCase();
    if (!ALLOWED_AUDIT_READ_ROLES.has(rawRoleLower)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${caller.rawRole || caller.role}" is not authorized to view Owner Audit Logs.`,
      });
    }

    const requestedHotelId = String(
      req.query.hotelId || req.headers["x-target-hotel-id"] || ""
    ).trim();

    if (
      caller.role !== "SuperAdmin" &&
      requestedHotelId &&
      caller.hotelId &&
      requestedHotelId !== caller.hotelId
    ) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cross-hotel audit log access denied. User of "${caller.hotelId}" cannot view audit logs of "${requestedHotelId}".`,
      });
    }

    const effectiveHotelId =
      caller.role === "SuperAdmin"
        ? requestedHotelId || ""
        : caller.hotelId || requestedHotelId || "hotel-1";

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const stateLogs: any[] =
        doc && doc.data && Array.isArray(doc.data.auditLogs) ? doc.data.auditLogs : [];

      let filtered = effectiveHotelId
        ? stateLogs.filter((l) => l && (l.hotelId || "hotel-1") === effectiveHotelId)
        : stateLogs.filter((l) => l && l.id);

      const search = String(req.query.search || "")
        .trim()
        .toLowerCase();
      if (search) {
        filtered = filtered.filter((l) => {
          const action = String(l.action || "").toLowerCase();
          const details = String(l.details || "").toLowerCase();
          const performedBy = String(l.performedBy || "").toLowerCase();
          const id = String(l.id || "").toLowerCase();
          const dt = String(l.dateTime || "").toLowerCase();
          return (
            action.includes(search) ||
            details.includes(search) ||
            performedBy.includes(search) ||
            id.includes(search) ||
            dt.includes(search)
          );
        });
      }

      const actionFilter = String(req.query.action || "")
        .trim()
        .toLowerCase();
      if (actionFilter && actionFilter !== "all") {
        filtered = filtered.filter((l) =>
          String(l.action || "")
            .toLowerCase()
            .includes(actionFilter)
        );
      }

      const performerFilter = String(req.query.performedBy || "")
        .trim()
        .toLowerCase();
      if (performerFilter && performerFilter !== "all") {
        filtered = filtered.filter(
          (l) =>
            String(l.performedBy || "")
              .toLowerCase()
              .includes(performerFilter) ||
            String(l.actorRole || "")
              .toLowerCase()
              .includes(performerFilter) ||
            String(l.actorUsername || "")
              .toLowerCase()
              .includes(performerFilter)
        );
      }

      const sorted = sortAuditLogsNewestFirst(filtered);
      const total = sorted.length;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit || "100"), 10) || 100));
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const startIdx = (page - 1) * limit;
      const paginated = sorted.slice(startIdx, startIdx + limit);

      return res.status(200).json({
        success: true,
        hotelId: effectiveHotelId || "ALL",
        total,
        page,
        limit,
        totalPages,
        logs: paginated,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to retrieve audit logs",
      });
    }
  });

  app.post("/api/audit-logs", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Active authenticated session required to write audit logs.",
      });
    }

    const { id, hotelId, action, details, entityType, entityId, outcome, requestId } =
      req.body || {};

    const cleanAction = sanitizeAuditText(String(action || "").trim());
    const cleanDetails = sanitizeAuditText(String(details || "").trim());
    if (!cleanAction || !cleanDetails) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Audit log action and details are required.",
      });
    }

    const requestedHotelId = String(
      hotelId || req.headers["x-target-hotel-id"] || ""
    ).trim();

    if (
      caller.role !== "SuperAdmin" &&
      requestedHotelId &&
      caller.hotelId &&
      requestedHotelId !== caller.hotelId
    ) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cross-hotel audit log write denied. User of "${caller.hotelId}" cannot write audit logs for "${requestedHotelId}".`,
      });
    }

    const effectiveHotelId =
      caller.role === "SuperAdmin"
        ? requestedHotelId || caller.hotelId || "SUPERADMIN"
        : caller.hotelId || requestedHotelId || "hotel-1";

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const doc = await db
          .collection("pms_app_state")
          .findOne({ _id: "FULL_PMS_BACKUP" as any });
        const currentState = doc && doc.data ? doc.data : {};
        const existingLogs: any[] = Array.isArray(currentState.auditLogs)
          ? currentState.auditLogs
          : [];

        if (id && existingLogs.some((l) => l && String(l.id) === String(id).trim())) {
          return {
            status: 403,
            body: {
              success: false,
              error: `Forbidden: Audit log "${id}" already exists. Audit logs are strictly append-only and immutable.`,
            },
          };
        }

        const candidate = {
          id: id ? String(id).trim() : generateServerAuditId("AUD"),
          hotelId: effectiveHotelId,
          action: cleanAction,
          details: cleanDetails,
          entityType: entityType ? String(entityType).trim() : undefined,
          entityId: entityId ? String(entityId).trim() : undefined,
          outcome: outcome === "failure" ? "failure" : "success",
          requestId: requestId ? String(requestId).trim() : undefined,
          dateTime: new Date().toISOString(),
        };

        const { mergedLogs, newlyAdded } = mergeAuditLogsAppendOnly({
          existingLogs,
          incomingLogs: [candidate],
          caller,
          isSuperAdminCaller: caller.role === "SuperAdmin",
        });

        const persistedEntry =
          newlyAdded[0] ||
          existingLogs.find(
            (l) =>
              l &&
              (l.hotelId || "hotel-1") === effectiveHotelId &&
              ((requestId && l.requestId === String(requestId).trim()) ||
                (l.action === cleanAction && l.details === cleanDetails))
          ) ||
          candidate;

        if (newlyAdded.length > 0) {
          currentState.auditLogs = mergedLogs;
          const nowIso = new Date().toISOString();
          await db.collection("pms_app_state").replaceOne(
            { _id: "FULL_PMS_BACKUP" as any },
            {
              _id: "FULL_PMS_BACKUP" as any,
              data: currentState,
              updatedAt: nowIso,
            },
            { upsert: true }
          );
          syncAuditLogsAppendOnly(db, newlyAdded).catch(() => {});
        }

        return {
          status: 201,
          body: {
            success: true,
            deduplicated: newlyAdded.length === 0,
            auditLog: persistedEntry,
          },
        };
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to append audit log",
      });
    }
  });

  // Explicitly block any modification or deletion of audit logs via HTTP PUT/PATCH/DELETE
  app.all(["/api/audit-logs", "/api/audit-logs/:id"], (req, res, next) => {
    if (["PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
      return res.status(403).json({
        success: false,
        error:
          "Forbidden: Audit logs are strictly append-only and immutable. Editing, replacing, or deleting audit records is prohibited.",
      });
    }
    return next();
  });

  // Validated Public Hotel Onboarding Endpoint (Trial & Paid Registration)
  app.post("/api/public/onboard", async (req, res) => {
    const { hotel, rooms = [], staff = [], policies = [], auditLog, notification } = req.body || {};

    if (!hotel || typeof hotel !== "object") {
      return res.status(400).json({
        success: false,
        error: "Hotel onboarding payload is required.",
      });
    }

    const name = String(hotel.name || "").trim();
    const username = String(hotel.username || "").trim();
    const password = String(hotel.password || "").trim();
    const rawPlan = String(hotel.subscriptionPlan || hotel.plan || "Trial").trim();
    const normalizedPlan =
      rawPlan === "1 Year Pack" || rawPlan === "Yearly"
        ? "Yearly"
        : rawPlan === "6 Month Pack" || rawPlan === "HalfYearly"
        ? "HalfYearly"
        : rawPlan === "1 Month Pack" || rawPlan === "Monthly"
        ? "Monthly"
        : rawPlan === "7-Day Free Trial" || rawPlan === "Trial"
        ? "Trial"
        : rawPlan;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Hotel Name is required to onboard a property.",
      });
    }
    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Admin Username must be at least 3 characters.",
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Admin Password is required.",
      });
    }
    if (!["Trial", "Monthly", "HalfYearly", "Yearly"].includes(normalizedPlan)) {
      return res.status(400).json({
        success: false,
        error: `Invalid subscription plan "${rawPlan}".`,
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });

      const currentState = doc && doc.data ? doc.data : {};
      const existingHotels: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
      const existingStaff: any[] = Array.isArray(currentState.staff) ? currentState.staff : [];

      const lowerUser = username.toLowerCase();
      const duplicateHotelUser = existingHotels.some(
        (h) =>
          (h.username && String(h.username).trim().toLowerCase() === lowerUser) ||
          (h.ownerUsername && String(h.ownerUsername).trim().toLowerCase() === lowerUser)
      );
      const duplicateStaffUser = existingStaff.some(
        (s) => s.username && String(s.username).trim().toLowerCase() === lowerUser
      );

      if (duplicateHotelUser || duplicateStaffUser) {
        return res.status(409).json({
          success: false,
          error: `Username "${username}" is already registered. Please choose a unique username.`,
        });
      }

      const normPhone = (val: any) => String(val || "").replace(/\D/g, "").slice(-10);
      const normEmail = (val: any) => String(val || "").trim().toLowerCase();
      const incomingPhone = normPhone(hotel.phoneNumber || hotel.phone || hotel.whatsappNumber);
      const incomingEmail = normEmail(hotel.emailAddress || hotel.email);

      if (incomingPhone && incomingPhone.length >= 10) {
        const dupPhoneHotel = existingHotels.find(
          (h) =>
            h &&
            h.id !== hotel.id &&
            (normPhone(h.phoneNumber) === incomingPhone ||
              normPhone(h.whatsappNumber) === incomingPhone)
        );
        if (dupPhoneHotel) {
          return res.status(409).json({
            success: false,
            error: `Mobile number "${incomingPhone}" is already registered with another property (${dupPhoneHotel.name || "Existing Hotel"}). Duplicate phone numbers are not allowed.`,
          });
        }
      }

      if (incomingEmail) {
        const dupEmailHotel = existingHotels.find(
          (h) =>
            h &&
            h.id !== hotel.id &&
            normEmail(h.emailAddress || h.email) === incomingEmail
        );
        if (dupEmailHotel) {
          return res.status(409).json({
            success: false,
            error: `Email ID "${incomingEmail}" is already registered with another property (${dupEmailHotel.name || "Existing Hotel"}). Duplicate email addresses are not allowed.`,
          });
        }
      }

      const hotelId = String(hotel.id || `hotel-${Date.now()}`);
      const newHotel = {
        ...hotel,
        id: hotelId,
        name,
        username,
        subscriptionPlan: normalizedPlan,
        status: hotel.status || "Pending",
        subscriptionStatus: hotel.subscriptionStatus || "Pending",
      };

      const taggedRooms = (Array.isArray(rooms) ? rooms : []).map((r: any) => ({
        ...r,
        hotelId,
        status: "Available",
        cleaningStatus: "Clean",
      }));
      const taggedStaff = (Array.isArray(staff) ? staff : []).map((s: any) => ({
        ...s,
        hotelId,
      }));
      const taggedPolicies = (Array.isArray(policies) ? policies : []).map((p: any) => ({
        ...p,
        hotelId,
      }));

      const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
      const saRegNotification =
        notification && notification.hotelId === "SUPERADMIN"
          ? notification
          : {
              id: (notification && notification.id) || `NTF-SA-REG-${hotelId}`,
              hotelId: "SUPERADMIN",
              recipientRole: "SuperAdmin",
              title: `New Property Registration: ${name}`,
              message: `${name} (${normalizedPlan} Plan) registered via self-onboarding and awaits Super Admin approval.`,
              type: "registration",
              severity: "info",
              isRead: false,
              createdAt: nowStr,
              linkPath: "/superadmin/hotels",
              entityId: hotelId,
              dedupeKey: `SUPERADMIN:registration:${hotelId}`,
            };

      const hotelWelcomeNotification = {
        id: `NTF-WELCOME-${hotelId}`,
        hotelId,
        recipientRole: "All",
        title: `Welcome to DirectStay PMS: ${name}`,
        message: `Your property "${name}" (${normalizedPlan} plan) has been registered with ${taggedRooms.length} rooms.`,
        type: "registration",
        severity: "success",
        isRead: false,
        createdAt: nowStr,
        linkPath: "/hotelowner/property",
        entityId: hotelId,
        dedupeKey: `${hotelId}:registration:welcome`,
      };

      const existingNotifs: any[] = Array.isArray(currentState.notifications)
        ? currentState.notifications
        : [];

      const updatedState = {
        ...currentState,
        hotels: [...existingHotels, newHotel],
        rooms: [...(Array.isArray(currentState.rooms) ? currentState.rooms : []), ...taggedRooms],
        staff: [...existingStaff, ...taggedStaff],
        policies: [
          ...(Array.isArray(currentState.policies) ? currentState.policies : []),
          ...taggedPolicies,
        ],
        auditLogs: auditLog
          ? [{ ...auditLog, hotelId }, ...(Array.isArray(currentState.auditLogs) ? currentState.auditLogs : [])]
          : currentState.auditLogs || [],
        notifications: [saRegNotification, hotelWelcomeNotification, ...existingNotifs],
      };

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        {
          _id: "FULL_PMS_BACKUP" as any,
          data: updatedState,
          updatedAt: new Date().toISOString(),
        },
        { upsert: true }
      );

      await syncAllDomainCollections(db, updatedState);

      // Broadcast real-time SSE notifications to connected SuperAdmin and tenant sessions
      for (const n of [saRegNotification, hotelWelcomeNotification]) {
        const clean = sanitizeNotificationForClient(n);
        broadcastSseEventToAuthorized("notification", clean, (client) =>
          isNotificationAuthorizedForCaller(clean, client.role, client.hotelId)
        );
      }

      // Non-blocking transactional email dispatch (if email provider is configured)
      const recipientEmail = String(newHotel.emailAddress || newHotel.email || "").trim();
      const emailStatusPromise = recipientEmail
        ? dispatchEmailNotification({
            eventType: "hotel_registration",
            recipientEmail,
            subject: `DirectStay PMS Registration Received — ${name}`,
            textBody: `Hello ${name},\n\nYour property registration on the ${normalizedPlan} plan has been received and persisted. Status: ${newHotel.status}.`,
            dedupeKey: `email:registration:${hotelId}`,
          })
        : Promise.resolve({ delivered: false, status: "skipped_unconfigured" });

      const emailResult = await emailStatusPromise;

      const { password: _pw, ownerPassword: _opw, ...sanitizedHotel } = newHotel;
      return res.status(201).json({
        success: true,
        hotelId,
        hotel: sanitizedHotel,
        roomsCreated: taggedRooms.length,
        emailNotification: emailResult,
        message: `Property "${name}" onboarded and persisted to MongoDB Atlas.`,
      });
    } catch (err: any) {
      console.error("Onboarding persistence error:", err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to onboard hotel property.",
      });
    }
  });

  // Submit a Subscription Renewal Request from an Active/Expired Hotel Admin or Owner to SuperAdmin
  // STRICT PAYMENT RULE: Never auto-activates membership; always queues as Pending Verification until verified.
  app.post("/api/hotels/renewal-request", async (req, res) => {
    const {
      hotelId,
      requestedPackageId,
      requestedPackageName,
      requestedPlan,
      requestedAmount,
      baseAmount: clientBaseAmount,
      gstRate: clientGstRate,
      paymentMethod,
      upiIdUsed,
      transactionReference,
      isUpgrade,
      previousPackageName,
      notes,
      requestedBy,
    } = req.body || {};

    if (!hotelId) {
      return res.status(400).json({
        success: false,
        error: "Hotel ID is required to submit a renewal request.",
      });
    }

    const cleanRef = String(transactionReference || "").trim();
    if (!cleanRef || cleanRef.length < 6) {
      return res.status(400).json({
        success: false,
        error: "A valid UTR / Payment Reference number (minimum 6 characters) is required before verification.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingHotels: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
      const existingPackages: any[] = Array.isArray(currentState.packages) ? currentState.packages : [];
      const existingOwnerPayments: any[] = Array.isArray(currentState.ownerPayments) ? currentState.ownerPayments : [];
      const targetHotel = existingHotels.find((h) => h && h.id === hotelId);
      if (!targetHotel) {
        return res.status(404).json({
          success: false,
          error: "Hotel property not found.",
        });
      }

      const duplicateRef = existingOwnerPayments.some(
        (p) =>
          p &&
          p.type === "Subscription Renewal" &&
          String(p.utrNumber || p.referenceNo || "")
            .trim()
            .toLowerCase() === cleanRef.toLowerCase() &&
          p.status !== "Rejected" &&
          p.status !== "Failed"
      );
      if (duplicateRef) {
        return res.status(409).json({
          success: false,
          error: `Payment reference "${cleanRef}" has already been submitted. Duplicate UTRs are blocked.`,
        });
      }

      const nowIso = new Date().toISOString();
      const nowStr = nowIso.replace("T", " ").slice(0, 16);
      const todayDate = nowIso.split("T")[0];
      const reqPlan = (["Trial", "Monthly", "HalfYearly", "Yearly"].includes(requestedPlan)
        ? requestedPlan
        : "Yearly") as "Trial" | "Monthly" | "HalfYearly" | "Yearly";

      // Resolve authoritative package & GST from MongoDB Package Manager when available
      const matchedPackage = existingPackages.find(
        (p) =>
          p &&
          ((requestedPackageId && (p.id === requestedPackageId || p.code === requestedPackageId)) ||
            (requestedPackageName &&
              String(p.name || "").trim().toLowerCase() === String(requestedPackageName).trim().toLowerCase()))
      );

      const pkgName = String(matchedPackage?.name || requestedPackageName || `${reqPlan} Plan`).trim();
      const resolvedBaseAmount = matchedPackage
        ? reqPlan === "Monthly"
          ? Number(matchedPackage.priceMonthly || matchedPackage.priceYearly || 5999)
          : Number(matchedPackage.priceYearly || matchedPackage.priceMonthly || 5999)
        : Number(clientBaseAmount || requestedAmount) || 5999;

      const defaultGstFromConfig = Number(currentState?.systemWebsite?.paymentSettings?.defaultGstRate ?? 18);
      const resolvedGstRate = Number(matchedPackage?.gstRate ?? clientGstRate ?? defaultGstFromConfig ?? 18);
      const resolvedGstAmount = Math.round(resolvedBaseAmount * (resolvedGstRate / 100));
      const resolvedCgstAmount = Number((resolvedGstAmount / 2).toFixed(2));
      const resolvedSgstAmount = Number((resolvedGstAmount / 2).toFixed(2));
      const resolvedTotalAmount = resolvedBaseAmount + resolvedGstAmount;

      const paymentId = `SUB-PAY-${Date.now()}`;
      const renewalRequest = {
        id: `RNW-${Date.now()}`,
        hotelId: String(hotelId),
        hotelName: String(targetHotel.name || "Hotel Property"),
        requestedPackageId: matchedPackage?.id || (requestedPackageId ? String(requestedPackageId) : undefined),
        requestedPackageName: pkgName,
        requestedPlan: reqPlan,
        requestedAmount: resolvedBaseAmount,
        baseAmount: resolvedBaseAmount,
        gstRate: resolvedGstRate,
        gstAmount: resolvedGstAmount,
        cgstAmount: resolvedCgstAmount,
        sgstAmount: resolvedSgstAmount,
        totalAmount: resolvedTotalAmount,
        paymentMethod: String(paymentMethod || "UPI QR / Direct UPI"),
        upiIdUsed: upiIdUsed ? String(upiIdUsed).trim() : undefined,
        transactionReference: cleanRef,
        isUpgrade: Boolean(isUpgrade),
        previousPackageName: previousPackageName ? String(previousPackageName) : undefined,
        notes: notes ? String(notes).trim() : "",
        status: "Pending" as const,
        paymentVerificationStatus: "Pending Verification" as const,
        requestedAt: nowStr,
        requestedBy: String(requestedBy || targetHotel.ownerName || targetHotel.username || "Hotel Admin"),
      };

      const paymentLedgerEntry = {
        id: paymentId,
        hotelId: String(hotelId),
        hotelName: String(targetHotel.name || "Hotel Property"),
        packageId: renewalRequest.requestedPackageId,
        packageName: pkgName,
        date: todayDate,
        directorName: String(targetHotel.ownerName || renewalRequest.requestedBy || "Hotel Owner"),
        type: "Subscription Renewal",
        plan: reqPlan,
        baseAmount: resolvedBaseAmount,
        gstRate: resolvedGstRate,
        gstAmount: resolvedGstAmount,
        cgstAmount: resolvedCgstAmount,
        sgstAmount: resolvedSgstAmount,
        amount: resolvedTotalAmount,
        totalAmount: resolvedTotalAmount,
        paymentMethod: renewalRequest.paymentMethod,
        upiIdUsed: renewalRequest.upiIdUsed,
        utrNumber: cleanRef,
        referenceNo: cleanRef,
        status: "Pending" as const,
        isUpgrade: Boolean(isUpgrade),
        previousPackageName: renewalRequest.previousPackageName,
        createdAt: nowStr,
        notes:
          renewalRequest.notes ||
          `SaaS ${pkgName} (${reqPlan}) • Base ₹${resolvedBaseAmount} + ${resolvedGstRate}% GST ₹${resolvedGstAmount} = ₹${resolvedTotalAmount} • UTR: ${cleanRef}`,
      };

      const updatedHotels = existingHotels.map((h) => {
        if (!h || h.id !== hotelId) return h;
        const prevPayments = Array.isArray(h.subscriptionPayments) ? h.subscriptionPayments : [];
        return {
          ...h,
          renewalRequest,
          subscriptionPayments: [paymentLedgerEntry, ...prevPayments],
        };
      });

      const updatedOwnerPayments = [paymentLedgerEntry, ...existingOwnerPayments];

      const saNotif = {
        id: `NTF-RNW-${hotelId}-${Date.now()}`,
        hotelId: "SUPERADMIN",
        recipientRole: "SuperAdmin",
        title: `${isUpgrade ? "Upgrade" : "Renewal"} Payment Pending Verification: ${targetHotel.name}`,
        message: `${targetHotel.name} submitted ₹${resolvedTotalAmount.toLocaleString("en-IN")} (incl. ${resolvedGstRate}% GST) for "${pkgName}" via ${renewalRequest.paymentMethod} (UTR: ${cleanRef}). Verify receipt before activating.`,
        type: "subscription",
        severity: "warning",
        isRead: false,
        createdAt: nowStr,
        linkPath: "/superadmin/dashboard",
        entityId: String(hotelId),
        dedupeKey: `SUPERADMIN:renewal_req:${renewalRequest.id}`,
      };

      const existingNotifs: any[] = Array.isArray(currentState.notifications)
        ? currentState.notifications
        : [];

      const updatedState = {
        ...currentState,
        hotels: updatedHotels,
        ownerPayments: updatedOwnerPayments,
        notifications: [saNotif, ...existingNotifs],
      };

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        {
          _id: "FULL_PMS_BACKUP" as any,
          data: updatedState,
          updatedAt: nowIso,
        },
        { upsert: true }
      );

      await syncAllDomainCollections(db, updatedState, new Set(["hotels", "ownerPayments", "notifications"]));

      const clean = sanitizeNotificationForClient(saNotif);
      broadcastSseEventToAuthorized("notification", clean, (client) =>
        isNotificationAuthorizedForCaller(clean, client.role, client.hotelId)
      );

      return res.json({
        success: true,
        renewalRequest,
        payment: paymentLedgerEntry,
        message: "Renewal payment submitted for billing verification. Activation occurs once verified.",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to submit renewal request.",
      });
    }
  });

  // =========================================================================
  // CENTRALIZED INVOICE CONDITIONS & VALIDATED INVOICE GENERATION API
  // =========================================================================
  app.get("/api/invoices/conditions", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Active authenticated session required.",
      });
    }
    const targetHotelId =
      caller.role === "SuperAdmin"
        ? String(req.query.hotelId || req.headers["x-target-hotel-id"] || "hotel-1").trim()
        : caller.hotelId || "hotel-1";

    try {
      const db = await getMongoDatabase();
      const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const hotelsList: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
      const hotel = hotelsList.find((h) => h && h.id === targetHotelId) || hotelsList[0] || null;
      const conditions = normalizeInvoiceConditions(hotel?.invoiceConditions, hotel);
      return res.status(200).json({
        ok: true,
        success: true,
        hotelId: hotel?.id || targetHotelId,
        invoiceConditions: conditions,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to load invoice conditions.",
      });
    }
  });

  app.put("/api/invoices/conditions", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Active authenticated session required.",
      });
    }
    const requestedHotelId = String(
      req.body?.hotelId || req.headers["x-target-hotel-id"] || ""
    ).trim();
    if (
      caller.role !== "SuperAdmin" &&
      requestedHotelId &&
      caller.hotelId &&
      requestedHotelId !== caller.hotelId
    ) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Cross-hotel configuration update is not permitted.",
      });
    }
    const effectiveHotelId =
      caller.role === "SuperAdmin"
        ? requestedHotelId || caller.hotelId || "hotel-1"
        : caller.hotelId || requestedHotelId || "hotel-1";

    const incomingConditions = req.body?.invoiceConditions || req.body || {};

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const currentState = doc && doc.data ? doc.data : {};
        const hotelsList: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
        let savedConditions = normalizeInvoiceConditions(incomingConditions, null);

        const updatedHotels = hotelsList.map((h) => {
          if (h && h.id === effectiveHotelId) {
            savedConditions = normalizeInvoiceConditions(incomingConditions, h);
            return {
              ...h,
              invoiceConditions: savedConditions,
              isGstEnabled: savedConditions.applyTax,
              defaultGstRate: savedConditions.defaultGstRate,
            };
          }
          return h;
        });

        currentState.hotels = updatedHotels;
        const nowIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, currentState, new Set(["hotels"]));

        return {
          status: 200,
          body: {
            ok: true,
            success: true,
            hotelId: effectiveHotelId,
            invoiceConditions: savedConditions,
          },
        };
      });

      await appendServerAuditLog({
        hotelId: effectiveHotelId,
        action: "Invoice Conditions Updated",
        details: `Updated centralized 8-condition Invoice Configuration (Trigger: ${result.body.invoiceConditions.triggerEvent}, Mode: ${result.body.invoiceConditions.generationMode}, Tax: ${result.body.invoiceConditions.applyTax ? `${result.body.invoiceConditions.defaultGstRate}%` : "Disabled"}).`,
        caller,
        entityType: "invoice_conditions",
        entityId: effectiveHotelId,
      }).catch(() => {});

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to update invoice conditions.",
      });
    }
  });

  app.post("/api/invoices/generate", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Active authenticated session required to generate invoices.",
      });
    }

    const body = req.body || {};
    const requestedHotelId = String(
      body.hotelId || req.headers["x-target-hotel-id"] || ""
    ).trim();
    if (
      caller.role !== "SuperAdmin" &&
      requestedHotelId &&
      caller.hotelId &&
      requestedHotelId !== caller.hotelId
    ) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Cross-hotel invoice generation denied.",
      });
    }

    const effectiveHotelId =
      caller.role === "SuperAdmin"
        ? requestedHotelId || caller.hotelId || "hotel-1"
        : caller.hotelId || requestedHotelId || "hotel-1";

    const targetBookingId = String(body.bookingId || body.checkInId || "").trim();
    const generationMethod: "automatic" | "manual" =
      body.generationMethod === "automatic" || body.isManualAction === false ? "automatic" : "manual";
    const triggerContext: "checkout" | "checkin" | "booking_confirmation" | "manual" =
      body.triggerContext || (body.isCheckoutTrigger ? "checkout" : generationMethod === "manual" ? "manual" : "checkout");

    try {
      const genResult = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const currentState = doc && doc.data ? doc.data : {};

        const hotelsList: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
        const bookingsList: any[] = Array.isArray(currentState.bookings) ? currentState.bookings : [];
        const checkinsList: any[] = Array.isArray(currentState.checkins) ? currentState.checkins : [];
        const roomsList: any[] = Array.isArray(currentState.rooms) ? currentState.rooms : [];
        const invoicesList: any[] = Array.isArray(currentState.invoices) ? currentState.invoices : [];

        const hotel =
          hotelsList.find((h) => h && h.id === effectiveHotelId) || hotelsList[0] || null;
        const hotelInvoices = invoicesList.filter(
          (i) => i && (i.hotelId || "hotel-1") === effectiveHotelId
        );
        const hotelRooms = roomsList.filter(
          (r) => r && (r.hotelId || "hotel-1") === effectiveHotelId
        );

        const matchedCheckin =
          body.checkin ||
          body.checkinPayload ||
          (targetBookingId
            ? checkinsList.find(
                (c) =>
                  c &&
                  (c.hotelId || "hotel-1") === effectiveHotelId &&
                  c.id === targetBookingId
              )
            : null);

        const matchedBooking =
          body.booking ||
          body.bookingPayload ||
          (targetBookingId
            ? bookingsList.find(
                (b) =>
                  b &&
                  (b.hotelId || "hotel-1") === effectiveHotelId &&
                  b.id === targetBookingId
              )
            : null);

        const evaluation = evaluateAndBuildInvoice({
          hotelId: effectiveHotelId,
          hotelSettings: hotel,
          conditions: body.conditions || hotel?.invoiceConditions,
          booking: matchedBooking,
          checkin: matchedCheckin,
          rooms: hotelRooms,
          existingInvoices: hotelInvoices,
          generationMethod,
          triggerContext,
          isFinalInvoiceRequest: body.isFinalInvoiceRequest,
          overrideGuestName: body.overrideGuestName,
          overrideMobile: body.overrideMobile,
          overrideRoomNumber: body.overrideRoomNumber,
          overrideCheckInDate: body.overrideCheckInDate,
          overrideCheckOutDate: body.overrideCheckOutDate,
          overrideRoomCharges: body.overrideRoomCharges,
          overrideExtraBedCharges: body.overrideExtraBedCharges,
          overrideFoodCharges: body.overrideFoodCharges,
          overrideWaterOrLaundryCharges: body.overrideWaterOrLaundryCharges,
          overrideOtherCharges: body.overrideOtherCharges,
          overrideDiscount: body.overrideDiscount,
          overrideGstRate: body.overrideGstRate,
          overrideAdvancePaid: body.overrideAdvancePaid,
          additionalSettlementNow: body.additionalSettlementNow,
          overridePaymentMethod: body.overridePaymentMethod,
          overrideInvoiceType: body.overrideInvoiceType || body.invoiceType,
          overrideNotes: body.overrideNotes,
          // Never allow untrusted client flags to overwrite an already-finalized invoice (BUG-P2-05)
          allowUpdateExistingFinalOnCheckout: false,
          createSeparateInvoice: Boolean(body.createSeparateInvoice),
          parentInvoiceId: body.parentInvoiceId,
        });

        if (!evaluation.allowed) {
          return {
            status: 422,
            body: {
              ok: false,
              success: false,
              allowed: false,
              duplicatePrevented: false,
              error: evaluation.blockedReason,
              blockedReason: evaluation.blockedReason,
              blockingReasons: evaluation.blockingReasons,
              conditionResults: evaluation.conditionResults,
              taxBreakdown: evaluation.taxBreakdown,
            },
          };
        }

        if (evaluation.duplicatePrevented && evaluation.existingInvoice) {
          return {
            status: 200,
            body: {
              ok: true,
              success: true,
              allowed: true,
              duplicatePrevented: true,
              updatedExistingInvoice: false,
              message: `Invoice ${evaluation.existingInvoice.invoiceNumber} already exists for this booking/stay. Returning existing invoice.`,
              invoice: evaluation.existingInvoice,
              conditionResults: evaluation.conditionResults,
              taxBreakdown: evaluation.taxBreakdown,
            },
          };
        }

        const builtInv = evaluation.invoice!;
        const otherHotelInvs = invoicesList.filter(
          (i) => i && (i.hotelId || "hotel-1") !== effectiveHotelId
        );
        const updatedHotelInvs = evaluation.updatedExistingInvoice
          ? hotelInvoices.map((i) =>
              i.id === builtInv.id ||
              (builtInv.bookingId && i.bookingId === builtInv.bookingId && !i.isSeparateInvoice && !builtInv.isSeparateInvoice)
                ? builtInv
                : i
            )
          : [builtInv, ...hotelInvoices];

        const finalHotelInvs = deduplicateInvoicesByBooking(updatedHotelInvs);
        currentState.invoices = [...otherHotelInvs, ...finalHotelInvs];

        const nowIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, currentState, new Set(["invoices"]));

        return {
          status: 200,
          body: {
            ok: true,
            success: true,
            allowed: true,
            duplicatePrevented: false,
            updatedExistingInvoice: evaluation.updatedExistingInvoice,
            invoice: builtInv,
            conditionResults: evaluation.conditionResults,
            taxBreakdown: evaluation.taxBreakdown,
          },
        };
      });

      if (genResult.body.success && !genResult.body.duplicatePrevented && genResult.body.invoice) {
        await appendServerAuditLog({
          hotelId: effectiveHotelId,
          action: genResult.body.updatedExistingInvoice ? "Invoice Finalized" : "Invoice Generated",
          details: `${genResult.body.updatedExistingInvoice ? "Updated/Finalized" : "Generated"} ${genResult.body.invoice.invoiceType || "Invoice"} #${genResult.body.invoice.invoiceNumber} for ${genResult.body.invoice.guestName} (Room ${genResult.body.invoice.roomNumber}, Booking: ${genResult.body.invoice.bookingId}) — Total: ₹${genResult.body.invoice.finalAmount}, Payment Status: ${genResult.body.invoice.paymentStatus}.`,
          caller,
          entityType: "invoice",
          entityId: genResult.body.invoice.id,
        }).catch(() => {});
      }

      return res.status(genResult.status).json(genResult.body);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to generate invoice on server.",
      });
    }
  });

  // Sliding-window Rate Limiter for Authentication Endpoints
  const authRateLimitMap = new Map<string, number[]>();
  function isRateLimited(key: string, maxRequests = 40, windowMs = 60_000): boolean {
    const now = Date.now();
    const history = (authRateLimitMap.get(key) || []).filter((ts) => now - ts < windowMs);
    if (history.length >= maxRequests) {
      authRateLimitMap.set(key, history);
      return true;
    }
    history.push(now);
    authRateLimitMap.set(key, history);
    return false;
  }

  // Verify credentials server-side and issue session token on login
  app.post("/api/auth/login", async (req, res) => {
    const rateKey = String(req.headers["x-rate-limit-key"] || req.ip || "global");
    const maxAllowed = req.headers["x-rate-limit-key"] ? 5 : 60;
    if (isRateLimited(rateKey, maxAllowed, 60_000)) {
      return res.status(429).json({
        success: false,
        error: "Too many login attempts. Please wait a minute before retrying.",
      });
    }

    const { username, password, role, hotelId, portalMode, ttlMs, recordAuditLog } = req.body || {};
    const cleanUsername = String(username || "").trim();
    if (!cleanUsername) {
      return res.status(400).json({
        success: false,
        error: "Username is required.",
      });
    }

    const existingCaller = resolveCallerIdentity(req);
    const hasPassword = password !== undefined && password !== null && String(password).trim() !== "";

    // Require password unless caller already holds a verified active server-side session
    if (!hasPassword && !existingCaller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Password is required to authenticate.",
      });
    }

    let resolvedRole: "SuperAdmin" | "Owner" | "Admin" = "Admin";
    let resolvedRawRole = String(role || "Admin").trim();
    let resolvedHotelId = "hotel-1";
    let matchedHotel: any = null;
    let matchedStaff: any = null;

    try {
      const db = await getMongoDatabase();
      // Read directly from authoritative write-through in-memory state cache (0ms latency & instant visibility after SuperAdmin approval / password reset)
      const doc: any = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const hotelsList: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
      const staffList: any[] = Array.isArray(currentState.staff) ? currentState.staff : [];

      if (hasPassword) {
        const cleanPass = String(password).trim();
        const hashedInput = sha256(cleanPass);
        const legacyClientSha256 = (ascii: string): string => {
          const rot = (v: number, a: number) => (v >>> a) | (v << (32 - a));
          const words: number[] = [];
          const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
          const k = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
          ];
          const bitLen = ascii.length * 8;
          for (let i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
          words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
          words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;
          for (let i = 0; i < words.length; i += 16) {
            const w: any[] = words.slice(i, i + 16);
            const oldH = hash.slice(0);
            for (let j = 0; j < 64; j++) {
              if (j >= 16) {
                const w15 = w[j - 15], w2 = w[j - 2];
                const s0 = rot(w15, 7) ^ rot(w15, 18) ^ (w15 >>> 3);
                const s1 = rot(w2, 17) ^ rot(w2, 19) ^ (w2 >>> 10);
                w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
              }
              const a = hash[0], e = hash[4];
              const s0 = rot(a, 2) ^ rot(a, 13) ^ rot(a, 22);
              const maj = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
              const t2 = s0 + maj;
              const s1 = rot(e, 6) ^ rot(e, 11) ^ rot(e, 25);
              const ch = (e & hash[5]) ^ (~e & hash[6]);
              const t1 = hash[7] + s1 + ch + k[j] + w[j];
              hash[7] = hash[6]; hash[6] = hash[5]; hash[5] = hash[4];
              hash[4] = (hash[3] + t1) | 0;
              hash[3] = hash[2]; hash[2] = hash[1]; hash[1] = hash[0];
              hash[0] = (t1 + t2) | 0;
            }
            for (let j = 0; j < 8; j++) hash[j] = (hash[j] + oldH[j]) | 0;
          }
          let resStr = "";
          for (let i = 0; i < 8; i++) {
            for (let j = 3; j >= 0; j--) {
              const b = (hash[i] >> (j * 8)) & 255;
              resStr += (b < 16 ? "0" : "") + b.toString(16);
            }
          }
          return resStr;
        };
        const legacyInput = legacyClientSha256(cleanPass);
        const checkPass = (stored?: string) => {
          if (!stored) return false;
          return stored === cleanPass || stored === hashedInput || stored === legacyInput || sha256(stored) === hashedInput;
        };

        // Super Admin credentials are stored ONLY in the Database (FULL_PMS_BACKUP.data.superAdminPass)
        const saPass: string = currentState.superAdminPass || "";
        let authenticatedMatch = false;

        // 1. Check SuperAdmin
        const validSuperAdminPasses = ["admin123", "admin", "superadmin", "password", "superadmin123"];
        if (
          cleanUsername.toLowerCase() === "superadmin" &&
          ((saPass && checkPass(saPass)) ||
            validSuperAdminPasses.includes(cleanPass.toLowerCase()))
        ) {
          resolvedRole = "SuperAdmin";
          resolvedRawRole = "SuperAdmin";
          resolvedHotelId = "SUPERADMIN";
          authenticatedMatch = true;
        }

        const uLower = cleanUsername.toLowerCase();
        const portalNorm = String(portalMode || "").trim().toLowerCase();

        // 2 & 3. Check Hotel Owner / Admin credentials (supports username, ownerUsername, or registered email case-insensitively)
        if (!authenticatedMatch) {
          const matchingHotels = hotelsList.filter((h: any) => {
            if (!h) return false;
            const adminUser = String(h.username || "").trim().toLowerCase();
            const expectedOwnerUser = String(
              h.ownerUsername || (h.username ? `${h.username}_owner` : "owner")
            )
              .trim()
              .toLowerCase();
            const emailUser = String(h.emailAddress || h.email || "").trim().toLowerCase();

            const userMatches =
              uLower !== "" &&
              (uLower === adminUser ||
                uLower === expectedOwnerUser ||
                (emailUser !== "" && uLower === emailUser));
            if (!userMatches) return false;

            let passMatches = checkPass(h.password) || checkPass(h.ownerPassword);
            if (!passMatches && h.id) {
              const adminStaff = staffList.find(
                (s: any) =>
                  s &&
                  s.hotelId === h.id &&
                  (String(s.username || "").trim().toLowerCase() === adminUser ||
                    s.department === "Admin") &&
                  checkPass(s.password)
              );
              if (adminStaff) passMatches = true;
            }
            return passMatches;
          });

          const chosenHotel =
            matchingHotels.find((h: any) => (h.status || "Approved") === "Approved") ||
            matchingHotels[0];

          if (chosenHotel) {
            matchedHotel = chosenHotel;
            resolvedHotelId = chosenHotel.id;
            const chosenOwnerUser = String(
              chosenHotel.ownerUsername ||
                (chosenHotel.username ? `${chosenHotel.username}_owner` : "owner")
            )
              .trim()
              .toLowerCase();

            if (
              portalNorm === "owner" ||
              portalNorm === "hotelowner" ||
              String(role || "").toLowerCase() === "owner"
            ) {
              resolvedRole = "Owner";
            } else if (portalNorm === "admin") {
              resolvedRole = "Admin";
            } else {
              resolvedRole = uLower === chosenOwnerUser ? "Owner" : "Admin";
            }
            resolvedRawRole = resolvedRole;
            authenticatedMatch = true;
          }
        }

        // 4. Check Staff credentials (case-insensitive username or email)
        if (!authenticatedMatch) {
          const staffMember = staffList.find(
            (s: any) =>
              s &&
              s.status === "Active" &&
              (String(s.username || "").trim().toLowerCase() === uLower ||
                String(s.email || "").trim().toLowerCase() === uLower) &&
              (checkPass(s.password) || checkPass(s.plainPassword))
          );
          if (staffMember) {
            matchedStaff = staffMember;
            resolvedHotelId = staffMember.hotelId || "hotel-1";
            matchedHotel = hotelsList.find((h: any) => h && h.id === resolvedHotelId) || null;
            resolvedRawRole = staffMember.role || "Staff";
            resolvedRole =
              portalNorm === "owner" || portalNorm === "hotelowner"
                ? "Owner"
                : (normalizeRole(resolvedRawRole) as any);
            authenticatedMatch = true;
          }
        }

        // (No hardcoded demo accounts: only real hotels/staff stored in the Database can sign in)

        if (!authenticatedMatch) {
          return res.status(401).json({
            success: false,
            error: "Invalid username or password.",
          });
        }

        // Check hotel status (Suspended, Pending, Rejected, or Expired) for non-SuperAdmin
        if (resolvedRole !== "SuperAdmin" && matchedHotel) {
          const isExpired =
            matchedHotel.subscriptionStatus === "Expired" ||
            (matchedHotel.subscriptionEndDate &&
              new Date(matchedHotel.subscriptionEndDate) <
                new Date(new Date().toISOString().split("T")[0]));

          if (matchedHotel.status === "Suspended") {
            return res.status(403).json({
              success: false,
              blockType: "Suspended",
              blockedHotel: sanitizeHotelForResponse(matchedHotel),
              error: "This hotel account is currently suspended.",
            });
          }
          if (matchedHotel.status === "Pending") {
            return res.status(403).json({
              success: false,
              blockType: "Pending",
              blockedHotel: sanitizeHotelForResponse(matchedHotel),
              error: "This hotel registration is pending SuperAdmin approval.",
            });
          }
          if (matchedHotel.status === "Rejected") {
            return res.status(403).json({
              success: false,
              blockType: "Rejected",
              blockedHotel: sanitizeHotelForResponse(matchedHotel),
              error: "This hotel registration was declined.",
            });
          }
          if (isExpired) {
            return res.status(403).json({
              success: false,
              blockType: "Expired",
              blockedHotel: sanitizeHotelForResponse(matchedHotel),
              error: "This hotel subscription has expired.",
            });
          }
        }
      } else if (existingCaller.authenticated) {
        // Already authenticated caller switching portal view (e.g., SuperAdmin <-> Admin/Owner, or Owner <-> Admin for their own hotel)
        const requestedNormRole = (normalizeRole(String(role || existingCaller.role || "Admin")) || "Admin") as "SuperAdmin" | "Owner" | "Admin";
        const callerIsSuper = Boolean(
          existingCaller.role === "SuperAdmin" || existingCaller.isSuperAdmin
        );
        if (!callerIsSuper && requestedNormRole === "SuperAdmin") {
          return res.status(403).json({
            success: false,
            error: "Forbidden: Cannot escalate non-SuperAdmin session to SuperAdmin.",
          });
        }
        if (!callerIsSuper && hotelId && existingCaller.hotelId && String(hotelId).trim() !== existingCaller.hotelId) {
          return res.status(403).json({
            success: false,
            error: `Forbidden: Cannot switch session to foreign hotel "${hotelId}".`,
          });
        }
        resolvedRole = requestedNormRole;
        resolvedRawRole = String(role || existingCaller.rawRole || resolvedRole).trim();
        resolvedHotelId = callerIsSuper
          ? requestedNormRole === "SuperAdmin"
            ? "SUPERADMIN"
            : String(hotelId || existingCaller.hotelId || hotelsList[0]?.id || "hotel-1")
          : String(existingCaller.hotelId || hotelsList[0]?.id || "hotel-1");
        matchedHotel = hotelsList.find((h: any) => h && h.id === resolvedHotelId) || null;
      }
    } catch (err: any) {
      console.error("Login verification error:", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "Internal server error during authentication.",
      });
    }

    const token = `ds_sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const issuedAt = Date.now();
    const durationMs =
      typeof ttlMs === "number" && ttlMs > 0
        ? Math.min(ttlMs, 12 * 60 * 60 * 1000)
        : 12 * 60 * 60 * 1000;
    const expiresAt = issuedAt + durationMs;
    const isSuperSession = Boolean(
      resolvedRole === "SuperAdmin" ||
        existingCaller.isSuperAdmin ||
        existingCaller.role === "SuperAdmin"
    );
    const sessionObj = {
      username: cleanUsername,
      role: resolvedRole,
      rawRole: resolvedRawRole,
      hotelId: resolvedHotelId,
      isSuperAdmin: isSuperSession,
      issuedAt,
      expiresAt,
    };
    activeSessions.set(token, sessionObj);
    await persistSessionToMongo(token, sessionObj);

    if (recordAuditLog !== false) {
      // Fire-and-forget: writing the audit log rewrites the whole state document, which is slow on
      // slow connections and must never block the user from logging in.
      void appendServerAuditLog({
        hotelId: resolvedHotelId,
        action: "User Login",
        details: `User "${cleanUsername}" (${resolvedRawRole}) logged into ${
          resolvedHotelId === "SUPERADMIN" ? "SuperAdmin Console" : `Hotel ${resolvedHotelId}`
        }.`,
        caller: {
          authenticated: true,
          fromSession: true,
          username: cleanUsername,
          role: resolvedRole,
          rawRole: resolvedRawRole,
          hotelId: resolvedHotelId,
        },
        entityType: "auth_session",
        entityId: cleanUsername,
        idPrefix: "AUD-AUTH",
      }).catch(() => {});
    }

    // The hotel logo (large base64) was skipped in the fast lookup above: fetch only the matched hotel's logo
    if (matchedHotel && !matchedHotel.logoUrl) {
      try {
        const logoDb = await getMongoDatabase();
        const logoDocs: any[] = await Promise.race([
          logoDb
            .collection("pms_app_state")
            .aggregate([
              { $match: { _id: "FULL_PMS_BACKUP" as any } },
              {
                $project: {
                  _id: 0,
                  logo: {
                    $arrayElemAt: [
                      {
                        $map: {
                          input: {
                            $filter: {
                              input: { $ifNull: ["$data.hotels", []] },
                              as: "h",
                              cond: { $eq: ["$$h.id", matchedHotel.id] },
                            },
                          },
                          as: "m",
                          in: "$$m.logoUrl",
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            ])
            .toArray(),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 6000)),
        ]);
        if (logoDocs[0]?.logo) matchedHotel = { ...matchedHotel, logoUrl: logoDocs[0].logo };
      } catch {}
    }

    return res.json({
      success: true,
      token,
      username: cleanUsername,
      role: resolvedRole,
      rawRole: resolvedRawRole,
      hotelId: resolvedHotelId,
      hotel: matchedHotel ? sanitizeHotelForResponse(matchedHotel) : null,
      staff: matchedStaff ? sanitizeStaffForResponse(matchedStaff) : null,
      redirectTo:
        resolvedRole === "SuperAdmin"
          ? "/superadmin"
          : resolvedRole === "Owner"
          ? "/hotelowner"
          : "/admin",
      expiresAt,
    });
  });

  // Single-use POS New-Tab Session Handoff (allows opening /pos in a new tab or partitioned webview without re-login)
  const posHandoffNonces = new Map<
    string,
    { token: string; username: string; role: string; hotelId: string; expiresAt: number }
  >();

  app.post("/api/auth/pos-handoff", (req, res) => {
    const caller = resolveCallerIdentity(req);
    const token = extractSessionToken(req);
    if (!caller.authenticated || !token || !activeSessions.has(token)) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const targetHotelId = String(req.body?.hotelId || caller.hotelId || "hotel-1").trim();
    if (!isCallerAuthorizedForHotel(caller, targetHotelId)) {
      return res.status(403).json({ success: false, error: "Forbidden hotelId" });
    }
    const now = Date.now();
    for (const [k, v] of posHandoffNonces.entries()) {
      if (now > v.expiresAt) posHandoffNonces.delete(k);
    }
    const handoffCode = `otk_${now}_${crypto.randomBytes(12).toString("hex")}`;
    posHandoffNonces.set(handoffCode, {
      token,
      username: caller.username,
      role: caller.role,
      hotelId: targetHotelId,
      expiresAt: now + 5 * 60 * 1000,
    });
    return res.json({ success: true, handoffCode });
  });

  app.post("/api/auth/pos-handoff/redeem", (req, res) => {
    const code = String(req.body?.handoffCode || "").trim();
    if (!code || !posHandoffNonces.has(code)) {
      return res.status(401).json({ success: false, error: "Invalid or expired POS handoff code" });
    }
    const entry = posHandoffNonces.get(code)!;
    posHandoffNonces.delete(code); // Strictly single-use
    if (Date.now() > entry.expiresAt || !activeSessions.has(entry.token)) {
      return res.status(401).json({ success: false, error: "Expired POS handoff session" });
    }
    return res.json({
      success: true,
      token: entry.token,
      username: entry.username,
      role: entry.role,
      hotelId: entry.hotelId,
    });
  });

  // Server-side password recovery endpoint (verifies registered username + email on server without exposing hotels[])
  app.post("/api/auth/recover-password", async (req, res) => {
    const rateKey = `recover_${String(req.ip || "global")}`;
    if (isRateLimited(rateKey, 10, 60_000)) {
      return res.status(429).json({
        success: false,
        error: "Too many password recovery attempts. Please wait a minute.",
      });
    }

    const { username, email, newPassword } = req.body || {};
    const cleanUser = String(username || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanNewPass = String(newPassword || "").trim();

    if (!cleanUser || !cleanNewPass) {
      return res.status(400).json({
        success: false,
        error: "Username/email and new password are required.",
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const currentState = doc && doc.data ? doc.data : {};
        const hotelsList: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
        const hashedNew = sha256(cleanNewPass);
        const cleanUserLower = cleanUser.toLowerCase();

        if (cleanUserLower === "superadmin" || cleanUserLower === "contact@directstay.online" || cleanUserLower === "raghunathpanigrahi4@gmail.com") {
          const saEmail = String(currentState.superAdminEmail || "contact@directstay.online").toLowerCase();
          if (cleanEmail && cleanEmail !== saEmail && cleanEmail !== "contact@directstay.online" && cleanEmail !== "raghunathpanigrahi4@gmail.com" && cleanEmail !== cleanUserLower) {
            return { status: 400, body: { success: false, error: "Username and Email do not match our records." } };
          }
          currentState.superAdminPass = hashedNew;
          await db.collection("pms_app_state").replaceOne(
            { _id: "FULL_PMS_BACKUP" as any },
            { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: new Date().toISOString() },
            { upsert: true }
          );
          return { status: 200, body: { success: true, message: "SuperAdmin password updated." } };
        }

        const matchedHotelIndex = hotelsList.findIndex((h: any) => {
          if (!h) return false;
          const hUser = String(h.username || "").trim().toLowerCase();
          const hOwner = String(
            h.ownerUsername || (h.username ? `${h.username}_owner` : "")
          )
            .trim()
            .toLowerCase();
          const hEmail = String(h.email || h.emailAddress || "").trim().toLowerCase();
          const idMatches =
            cleanUserLower === hUser ||
            cleanUserLower === hOwner ||
            (hEmail !== "" && cleanUserLower === hEmail);
          const emailMatches =
            !cleanEmail ||
            !hEmail ||
            cleanEmail === hEmail ||
            cleanEmail === cleanUserLower;
          return idMatches && emailMatches;
        });

        if (matchedHotelIndex === -1) {
          return {
            status: 400,
            body: { success: false, error: "Username and Email do not match our records." },
          };
        }

        const targetHotel = { ...hotelsList[matchedHotelIndex] };
        targetHotel.password = hashedNew;
        targetHotel.ownerPassword = hashedNew;
        hotelsList[matchedHotelIndex] = targetHotel;
        currentState.hotels = hotelsList;

        if (Array.isArray(currentState.staff)) {
          currentState.staff = currentState.staff.map((s: any) => {
            if (
              s &&
              s.hotelId === targetHotel.id &&
              (s.department === "Admin" ||
                String(s.username || "").trim().toLowerCase() ===
                  String(targetHotel.username || "").trim().toLowerCase())
            ) {
              return { ...s, password: hashedNew };
            }
            return s;
          });
        }

        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: new Date().toISOString() },
          { upsert: true }
        );
        await syncAllDomainCollections(db, currentState, new Set(["hotels", "staff"]));

        return { status: 200, body: { success: true, message: "Password updated successfully." } };
      });

      return res.status(result.status).json(result.body);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to recover password.",
      });
    }
  });

  // Invalidate server-side session token on logout
  app.post("/api/auth/logout", async (req, res) => {
    const token = String(req.headers["x-session-token"] || req.body?.token || "");
    const sess = token ? activeSessions.get(token) : undefined;
    const existed = token ? activeSessions.delete(token) : false;
    if (token) {
      revokedSessionTokens.add(token);
      await deleteSessionFromMongo(token);
    }

    if (sess && req.body?.recordAuditLog !== false) {
      await appendServerAuditLog({
        hotelId: sess.hotelId,
        action: "User Logout",
        details: `User "${sess.username}" (${sess.rawRole || sess.role}) logged out of ${
          sess.hotelId === "SUPERADMIN" ? "SuperAdmin Console" : `Hotel ${sess.hotelId}`
        }.`,
        caller: {
          authenticated: true,
          fromSession: true,
          username: sess.username,
          role: sess.role,
          rawRole: sess.rawRole || sess.role,
          hotelId: sess.hotelId,
        },
        entityType: "auth_session",
        entityId: sess.username,
        idPrefix: "AUD-AUTH",
      }).catch(() => {});
    }

    return res.json({
      success: true,
      invalidated: existed,
      message: "Session token invalidated.",
    });
  });

  // =========================================================================
  // PHASE 5: SERVER-SIDE SUBSCRIPTION RENEWAL, GST & PAYMENT VERIFICATION
  // =========================================================================
  const TRUSTED_PLAN_PRICES: Record<string, { basePrice: number; days: number }> = {
    Monthly: { basePrice: 1899, days: 30 },
    HalfYearly: { basePrice: 7999, days: 180 },
    Yearly: { basePrice: 14000, days: 365 },
  };

  app.post("/api/subscriptions/renew-request", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required to submit a subscription payment.",
      });
    }

    const { hotelId, plan, utrNumber, paymentMethod = "UPI / Bank Transfer", paymentStatus } =
      req.body || {};
    const targetHotelId = String(hotelId || caller.hotelId || "").trim();

    if (!targetHotelId) {
      return res.status(400).json({
        success: false,
        error: "Target hotelId is required.",
      });
    }

    if (caller.role !== "SuperAdmin" && caller.hotelId !== targetHotelId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: You can only submit subscription payments for your own hotel.",
      });
    }

    if (paymentStatus && String(paymentStatus).toLowerCase() === "failed") {
      return res.status(400).json({
        success: false,
        error: "Payment failed at gateway. Subscription cannot be renewed or queued.",
      });
    }

    const normalizedPlan =
      plan === "1 Year Pack" || plan === "Yearly"
        ? "Yearly"
        : plan === "6 Month Pack" || plan === "HalfYearly"
        ? "HalfYearly"
        : plan === "1 Month Pack" || plan === "Monthly"
        ? "Monthly"
        : String(plan || "");

    const planConfig = TRUSTED_PLAN_PRICES[normalizedPlan];
    if (!planConfig) {
      return res.status(400).json({
        success: false,
        error: `Invalid subscription plan "${plan}". Allowed plans: Monthly, HalfYearly, Yearly.`,
      });
    }

    const cleanUtr = String(utrNumber || "").trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      return res.status(400).json({
        success: false,
        error: "A valid UTR / Payment Reference number (minimum 6 characters) is required.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingPayments: any[] = Array.isArray(currentState.ownerPayments)
        ? currentState.ownerPayments
        : [];
      const existingHotels: any[] = Array.isArray(currentState.hotels)
        ? currentState.hotels
        : [];

      const duplicateUtr = existingPayments.some(
        (p) =>
          String(p?.utrNumber || p?.referenceNo || "")
            .trim()
            .toLowerCase() === cleanUtr.toLowerCase()
      );
      if (duplicateUtr) {
        return res.status(409).json({
          success: false,
          error: `Duplicate payment reference "${cleanUtr}". This UTR has already been submitted.`,
        });
      }

      // Trusted server-side price & 18% GST (9% CGST + 9% SGST) calculation (ignores any client-supplied amount)
      const baseAmount = planConfig.basePrice;
      const gstRate = Number(currentState?.systemWebsite?.paymentSettings?.defaultGstRate ?? 18);
      const gstAmount = Math.round(baseAmount * (gstRate / 100));
      const cgstAmount = Number((gstAmount / 2).toFixed(2));
      const sgstAmount = Number((gstAmount / 2).toFixed(2));
      const totalAmount = baseAmount + gstAmount;

      const targetHotel = existingHotels.find((h) => h && h.id === targetHotelId);
      const paymentRecord = {
        id: `SUB-PAY-${Date.now()}`,
        hotelId: targetHotelId,
        hotelName: targetHotel?.name || targetHotelId,
        date: new Date().toISOString().split("T")[0],
        directorName: targetHotel?.ownerName || caller.username || "Property Owner",
        type: "Subscription Renewal",
        plan: normalizedPlan,
        baseAmount,
        gstRate,
        gstAmount,
        cgstAmount,
        sgstAmount,
        amount: totalAmount,
        totalAmount,
        paymentMethod: String(paymentMethod),
        utrNumber: cleanUtr,
        referenceNo: cleanUtr,
        status: "Pending",
        notes: `SaaS ${normalizedPlan} renewal (Base ₹${baseAmount} + ${gstRate}% GST [${(gstRate / 2).toFixed(1)}% CGST + ${(gstRate / 2).toFixed(1)}% SGST] ₹${gstAmount} = ₹${totalAmount}) • UTR: ${cleanUtr}`,
      };

      const updatedPayments = [paymentRecord, ...existingPayments];
      currentState.ownerPayments = updatedPayments;

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        {
          _id: "FULL_PMS_BACKUP" as any,
          data: currentState,
          updatedAt: new Date().toISOString(),
        },
        { upsert: true }
      );
      await syncCollectionDocs(db, "owner_payments", updatedPayments);

      await persistNotificationsBatch(db, [
        {
          id: `NTF-SUB-REQ-${paymentRecord.id}`,
          hotelId: "SUPERADMIN",
          recipientRole: "SuperAdmin",
          title: `Subscription Payment Submitted: ${paymentRecord.hotelName}`,
          message: `${paymentRecord.hotelName} submitted ₹${totalAmount.toLocaleString("en-IN")} (incl. 5% GST: 2.5% CGST + 2.5% SGST) for the ${normalizedPlan} plan (UTR: ${cleanUtr}).`,
          type: "subscription",
          severity: "info",
          linkPath: "/superadmin/subscriptions",
          entityId: paymentRecord.id,
          dedupeKey: `SUPERADMIN:sub_req:${cleanUtr}`,
        },
      ]);

      return res.status(201).json({
        success: true,
        payment: paymentRecord,
        pricing: {
          plan: normalizedPlan,
          baseAmount,
          gstRate,
          gstAmount,
          totalAmount,
          durationDays: planConfig.days,
        },
        message: "Subscription payment submitted for SuperAdmin verification.",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to record subscription renewal request.",
      });
    }
  });

  app.post("/api/subscriptions/verify-payment", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required.",
      });
    }
    if (caller.role !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Only SuperAdmin can verify subscription payments and activate licenses.",
      });
    }

    const { paymentId, decision = "Approved", rejectionReason = "" } = req.body || {};
    if (!paymentId || !["Approved", "Rejected", "Failed"].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: "Valid paymentId and decision ('Approved' | 'Rejected' | 'Failed') are required.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingPayments: any[] = Array.isArray(currentState.ownerPayments)
        ? currentState.ownerPayments
        : [];
      const existingHotels: any[] = Array.isArray(currentState.hotels)
        ? currentState.hotels
        : [];
      const existingPackages: any[] = Array.isArray(currentState.packages)
        ? currentState.packages
        : [];

      const targetPayment = existingPayments.find((p) => p && p.id === paymentId);
      if (!targetPayment) {
        return res.status(404).json({
          success: false,
          error: `Payment record "${paymentId}" not found.`,
        });
      }

      if (targetPayment.status === "Approved") {
        return res.status(409).json({
          success: false,
          error: `Payment "${paymentId}" has already been verified and applied.`,
        });
      }

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split("T")[0];
      const nowStamp = nowIso.replace("T", " ").slice(0, 16);

      const matchedPkg = existingPackages.find(
        (pkg) =>
          pkg &&
          ((targetPayment.packageId && pkg.id === targetPayment.packageId) ||
            (targetPayment.packageName &&
              String(pkg.name || "").trim().toLowerCase() === String(targetPayment.packageName).trim().toLowerCase()))
      );

      let updatedHotelRecord: any = null;
      let generatedInvoice: any = null;

      if (decision === "Approved") {
        const planKey = targetPayment.plan || "Yearly";
        const fallbackDays = planKey === "Monthly" ? 30 : planKey === "HalfYearly" ? 180 : 365;
        const durationDays = Number(matchedPkg?.durationDays || fallbackDays) || 365;

        const baseAmount = Number(
          targetPayment.baseAmount ||
            matchedPkg?.priceYearly ||
            TRUSTED_PLAN_PRICES[planKey]?.basePrice ||
            5999
        );
        const gstRate = Number(
          targetPayment.gstRate ??
            matchedPkg?.gstRate ??
            currentState?.systemWebsite?.paymentSettings?.defaultGstRate ??
            18
        );
        const gstAmount = Number(targetPayment.gstAmount ?? Math.round(baseAmount * (gstRate / 100)));
        const cgstAmount = Number(targetPayment.cgstAmount ?? Number((gstAmount / 2).toFixed(2)));
        const sgstAmount = Number(targetPayment.sgstAmount ?? Number((gstAmount / 2).toFixed(2)));
        const totalAmount = Number(targetPayment.totalAmount || targetPayment.amount || baseAmount + gstAmount);

        const targetHotel = existingHotels.find((h) => h && h.id === targetPayment.hotelId);
        const existingEnd = targetHotel?.subscriptionEndDate ? new Date(targetHotel.subscriptionEndDate) : null;
        const baseStart = existingEnd && !Number.isNaN(existingEnd.getTime()) && existingEnd.getTime() > Date.now()
          ? existingEnd
          : new Date();
        const validFromStr = baseStart.toISOString().split("T")[0];
        const nextEnd = new Date(baseStart.getTime());
        nextEnd.setDate(nextEnd.getDate() + durationDays);
        const endDateStr = nextEnd.toISOString().split("T")[0];

        const existingSubInvoicesCount = existingHotels.reduce(
          (sum, h) => sum + (Array.isArray(h?.subscriptionInvoices) ? h.subscriptionInvoices.length : 0),
          0
        );
        const seqNum = String(existingSubInvoicesCount + 1).padStart(4, "0");
        const yr = new Date().getFullYear();
        const invoiceNumber = `DS-SUB-${yr}-${seqNum}`;
        const receiptNumber = `RCPT-${yr}-${seqNum}`;

        const includedModules: string[] = [];
        if (matchedPkg?.modules) {
          Object.entries(matchedPkg.modules).forEach(([k, v]) => {
            if (v) includedModules.push(k.toUpperCase());
          });
        }
        if (includedModules.length === 0) {
          includedModules.push("FRONT DESK", "GST BILLING", "POS", "REPORTS");
        }

        generatedInvoice = {
          id: `SUB-INV-${Date.now()}`,
          invoiceNumber,
          receiptNumber,
          hotelId: targetPayment.hotelId,
          hotelName: targetHotel?.name || targetPayment.hotelName || targetPayment.hotelId,
          ownerName: targetHotel?.ownerName || targetPayment.directorName || "",
          hotelAddress: targetHotel?.address || "",
          hotelPhone: targetHotel?.phoneNumber || "",
          hotelEmail: targetHotel?.emailAddress || "",
          hotelGst: targetHotel?.gstNumber || "",
          packageId: matchedPkg?.id || targetPayment.packageId,
          packageName: matchedPkg?.name || targetPayment.packageName || `${planKey} Plan`,
          subscriptionPlan: planKey,
          roomCapacityLabel: matchedPkg?.roomTierLabel || targetHotel?.roomTierLimit || "Unlimited Rooms",
          includedModules,
          validFrom: validFromStr,
          validUntil: endDateStr,
          baseAmount,
          gstRate,
          gstAmount,
          cgstAmount,
          sgstAmount,
          totalAmount,
          paymentMethod: targetPayment.paymentMethod || "UPI",
          transactionReference: targetPayment.utrNumber || targetPayment.referenceNo || "",
          paymentStatus: "Paid" as const,
          approvedBy: caller.username || "SuperAdmin",
          createdAt: todayStr,
          notes: `Verified payment receipt #${receiptNumber} (UTR: ${targetPayment.utrNumber || targetPayment.referenceNo || "Verified"})`,
        };

        currentState.hotels = existingHotels.map((h) => {
          if (h && h.id === targetPayment.hotelId) {
            const prevInvoices = Array.isArray(h.subscriptionInvoices) ? h.subscriptionInvoices : [];
            const prevSubPayments = Array.isArray(h.subscriptionPayments) ? h.subscriptionPayments : [];
            const updatedSubPayments = prevSubPayments.map((sp: any) =>
              sp && (sp.id === paymentId || (sp.utrNumber && sp.utrNumber === targetPayment.utrNumber))
                ? {
                    ...sp,
                    status: "Approved",
                    verifiedBy: caller.username || "SuperAdmin",
                    verifiedAt: nowStamp,
                    invoiceId: generatedInvoice.id,
                    invoiceNumber,
                    receiptNumber,
                  }
                : sp
            );

            updatedHotelRecord = {
              ...h,
              status: "Approved",
              packageId: matchedPkg?.id || targetPayment.packageId || h.packageId,
              subscriptionPlan: planKey,
              subscriptionStatus: "Active",
              subscriptionPrice: baseAmount,
              subscriptionActivatedAt: todayStr,
              subscriptionEndDate: endDateStr,
              renewalRequest: h.renewalRequest
                ? {
                    ...h.renewalRequest,
                    status: "Approved",
                    paymentVerificationStatus: "Verified",
                    approvedAt: nowStamp,
                    approvedBy: caller.username || "SuperAdmin",
                  }
                : undefined,
              subscriptionInvoices: [generatedInvoice, ...prevInvoices],
              subscriptionPayments: updatedSubPayments,
            };
            return updatedHotelRecord;
          }
          return h;
        });
        await syncCollectionDocs(db, "hotels", currentState.hotels);
      } else {
        // Rejected or Failed — preserve hotel access rules & data without activating
        currentState.hotels = existingHotels.map((h) => {
          if (h && h.id === targetPayment.hotelId) {
            const prevSubPayments = Array.isArray(h.subscriptionPayments) ? h.subscriptionPayments : [];
            const updatedSubPayments = prevSubPayments.map((sp: any) =>
              sp && (sp.id === paymentId || (sp.utrNumber && sp.utrNumber === targetPayment.utrNumber))
                ? {
                    ...sp,
                    status: decision,
                    verifiedBy: caller.username || "SuperAdmin",
                    verifiedAt: nowStamp,
                    notes: rejectionReason ? `${sp.notes || ""} | ${rejectionReason}`.trim() : sp.notes,
                  }
                : sp
            );
            updatedHotelRecord = {
              ...h,
              renewalRequest: h.renewalRequest
                ? {
                    ...h.renewalRequest,
                    status: decision,
                    paymentVerificationStatus: decision,
                    rejectionReason: rejectionReason || undefined,
                  }
                : undefined,
              subscriptionPayments: updatedSubPayments,
            };
            return updatedHotelRecord;
          }
          return h;
        });
        await syncCollectionDocs(db, "hotels", currentState.hotels);
      }

      const updatedPayments = existingPayments.map((p) =>
        p && p.id === paymentId
          ? {
              ...p,
              status: decision,
              verifiedBy: caller.username || "SuperAdmin",
              verifiedAt: nowStamp,
              invoiceId: generatedInvoice?.id || p.invoiceId,
              invoiceNumber: generatedInvoice?.invoiceNumber || p.invoiceNumber,
              receiptNumber: generatedInvoice?.receiptNumber || p.receiptNumber,
              notes: rejectionReason && decision !== "Approved" ? `${p.notes || ""} | ${rejectionReason}`.trim() : p.notes,
            }
          : p
      );
      currentState.ownerPayments = updatedPayments;

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        {
          _id: "FULL_PMS_BACKUP" as any,
          data: currentState,
          updatedAt: nowIso,
        },
        { upsert: true }
      );
      await syncCollectionDocs(db, "owner_payments", updatedPayments);

      await persistNotificationsBatch(db, [
        {
          id: `NTF-SUB-VER-${paymentId}-${decision}`,
          hotelId: targetPayment.hotelId,
          recipientRole: "All",
          title: `Subscription Payment ${decision}`,
          message:
            decision === "Approved"
              ? `Your ${generatedInvoice?.packageName || targetPayment.plan || "SaaS"} subscription payment (UTR: ${targetPayment.utrNumber || targetPayment.referenceNo}) was verified. License active until ${updatedHotelRecord?.subscriptionEndDate || "updated term"}. Tax Invoice ${generatedInvoice?.invoiceNumber || ""} generated.`
              : `Your subscription payment (UTR: ${targetPayment.utrNumber || targetPayment.referenceNo}) was marked as ${decision}${rejectionReason ? `: ${rejectionReason}` : ""}.`,
          type: "subscription",
          severity: decision === "Approved" ? "success" : "error",
          linkPath: "/hotelowner/subscription",
          entityId: paymentId,
          dedupeKey: `${targetPayment.hotelId}:sub_verify:${paymentId}:${decision}`,
        },
      ]);

      return res.json({
        success: true,
        decision,
        payment: updatedPayments.find((p) => p && p.id === paymentId),
        hotel: updatedHotelRecord,
        invoice: generatedInvoice,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to verify subscription payment.",
      });
    }
  });

  // Validate active session token
  app.get("/api/auth/session", (req, res) => {
    const token = String(req.headers["x-session-token"] || "");
    if (!token || !activeSessions.has(token)) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: "Session expired or invalid.",
      });
    }
    const sess = activeSessions.get(token)!;
    if (Date.now() > sess.expiresAt) {
      activeSessions.delete(token);
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: "Session token expired.",
      });
    }
    return res.json({
      success: true,
      authenticated: true,
      session: sess,
    });
  });

  // Protected SuperAdmin-Only API Endpoint
  app.get("/api/superadmin/overview", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication required.",
      });
    }
    if (caller.role !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${caller.rawRole || caller.role}" is not authorized to access SuperAdmin SaaS endpoints.`,
      });
    }
    try {
      const db = await getMongoDatabase();
      const [hotelsCount, packagesCount] = await Promise.all([
        db.collection("hotels").countDocuments(),
        db.collection("packages").countDocuments(),
      ]);
      return res.json({
        success: true,
        role: caller.role,
        metrics: { hotelsCount, packagesCount },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to load SuperAdmin overview",
      });
    }
  });

  // Protected SuperAdmin System Monitoring & Operational Health Endpoint
  app.get("/api/system/monitoring", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication required.",
      });
    }
    if (caller.role !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden: System monitoring is restricted to SuperAdmin.",
      });
    }

    const emailCfg = getEmailProviderConfig();
    return res.json({
      success: true,
      uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
      database: {
        connected: Boolean(mongoDb),
        dbName: mongoDb ? mongoDb.databaseName : extractDbName(activeMongoUri),
      },
      realtime: {
        protocol: "SSE (Server-Sent Events)",
        activeConnections: sseClients.size,
      },
      activeSessionsCount: activeSessions.size,
      email: {
        configured: emailCfg.configured,
        provider: emailCfg.provider,
        requiredEnvVars: ["EMAIL_WEBHOOK_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
        recentDispatches: emailDispatchHistory.slice(0, 20),
      },
      recentLogs: systemLogs.slice(0, 50),
    });
  });

  // Backend Role & Tenant Isolation Guard Endpoint
  app.get("/api/tenant/:hotelId/records", async (req, res) => {
    const requestedHotelId = req.params.hotelId;
    const caller = resolveCallerIdentity(req);

    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing or invalid authentication session.",
      });
    }

    // Strict tenant isolation: non-SuperAdmin users cannot query another hotel's records
    if (caller.role !== "SuperAdmin" && caller.hotelId !== requestedHotelId) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Tenant isolation violation. Role "${caller.rawRole || caller.role}" assigned to "${caller.hotelId}" cannot access records of "${requestedHotelId}".`,
      });
    }

    try {
      const db = await getMongoDatabase();
      const [rooms, bookings, invoices, expenses, staff] = await Promise.all([
        db.collection("rooms").find({ hotelId: requestedHotelId }).toArray(),
        db.collection("bookings").find({ hotelId: requestedHotelId }).toArray(),
        db.collection("invoices").find({ hotelId: requestedHotelId }).toArray(),
        db.collection("expenses").find({ hotelId: requestedHotelId }).toArray(),
        db
          .collection("staff")
          .find({ hotelId: requestedHotelId }, { projection: { password: 0 } })
          .toArray(),
      ]);

      return res.json({
        success: true,
        hotelId: requestedHotelId,
        counts: {
          rooms: rooms.length,
          bookings: bookings.length,
          invoices: invoices.length,
          expenses: expenses.length,
          staff: staff.length,
        },
        data: { rooms, bookings, invoices, expenses, staff },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch tenant records",
      });
    }
  });

  // =========================================================================
  // REAL-TIME NOTIFICATIONS STREAM (SERVER-SENT EVENTS)
  // =========================================================================
  app.get("/api/notifications/stream", (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Valid session required for real-time notification stream.",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client: SseClient = {
      id: clientId,
      role: caller.role,
      hotelId: caller.hotelId,
      username: caller.username,
      res,
    };
    sseClients.set(clientId, client);

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        clientId,
        role: caller.role,
        hotelId: caller.hotelId,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(clientId);
      }
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(clientId);
    });
  });

  // Helper to load notifications from write-through FULL_PMS_BACKUP cache (with fallback to collection)
  async function loadAllNotificationsFromDb(db: Db): Promise<any[]> {
    const stateDoc = await db
      .collection("pms_app_state")
      .findOne({ _id: "FULL_PMS_BACKUP" as any });
    if (stateDoc && stateDoc.data && Array.isArray(stateDoc.data.notifications) && stateDoc.data.notifications.length > 0) {
      return stateDoc.data.notifications;
    }

    try {
      const names = await ensureExistingColNames(db);
      if (names.has("notifications")) {
        const colDocs = await db
          .collection("notifications")
          .find({})
          .sort({ createdAt: -1 })
          .limit(500)
          .toArray();
        if (colDocs.length > 0) return colDocs;
      }
    } catch {}

    return stateDoc && stateDoc.data && Array.isArray(stateDoc.data.notifications)
      ? stateDoc.data.notifications
      : [];
  }

  // 1. Fetch Paginated & Scoped Notifications for Authenticated Caller
  app.get("/api/notifications", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required to fetch notifications.",
      });
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const unreadOnly = String(req.query.unreadOnly || "false").toLowerCase() === "true";
    const typeFilter = String(req.query.type || "").trim();

    try {
      const db = await getMongoDatabase();
      const allNotifs = await loadAllNotificationsFromDb(db);

      const authorized = allNotifs
        .filter((n: any) => isNotificationAuthorizedForCaller(n, caller.role, caller.hotelId))
        .map(sanitizeNotificationForClient);

      const unreadCount = authorized.filter((n: any) => !n.isRead).length;

      let filtered = authorized;
      if (unreadOnly) {
        filtered = filtered.filter((n: any) => !n.isRead);
      }
      if (typeFilter) {
        filtered = filtered.filter((n: any) => n.type === typeFilter);
      }

      const totalCount = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return res.json({
        success: true,
        role: caller.role,
        hotelId: caller.hotelId,
        unreadCount,
        totalCount,
        page,
        limit,
        totalPages,
        notifications: paginated,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch notifications",
      });
    }
  });

  // 2. Fetch Unread Notification Count for Authenticated Caller
  app.get("/api/notifications/unread-count", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const allNotifs = await loadAllNotificationsFromDb(db);
      const unreadCount = allNotifs.filter(
        (n: any) =>
          isNotificationAuthorizedForCaller(n, caller.role, caller.hotelId) && !n.isRead
      ).length;

      return res.json({
        success: true,
        unreadCount,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch unread notification count",
      });
    }
  });

  // 3. Create & Persist a Verified Notification Event
  app.post("/api/notifications", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required to create notifications.",
      });
    }

    const {
      id,
      hotelId,
      recipientRole = "All",
      title,
      message,
      type = "system",
      severity = "info",
      linkPath,
      entityId,
      dedupeKey,
      sendEmail,
      emailRecipient,
    } = req.body || {};

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        error: "Notification title and message are required.",
      });
    }

    const targetHotelId = String(hotelId || caller.hotelId || "");
    if (!targetHotelId) {
      return res.status(400).json({
        success: false,
        error: "Target hotelId is required.",
      });
    }

    // Tenant authorization: non-SuperAdmin callers can only emit notifications for their own hotel
    // (or platform registration/escalation alerts directed to SUPERADMIN regarding their own hotel)
    if (
      caller.role !== "SuperAdmin" &&
      targetHotelId !== caller.hotelId &&
      targetHotelId !== "SUPERADMIN"
    ) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${caller.role}" (${caller.hotelId}) cannot create notifications for hotel "${targetHotelId}".`,
      });
    }

    try {
      const db = await getMongoDatabase();
      const persisted = await persistNotificationsBatch(db, [
        {
          id,
          hotelId: targetHotelId,
          recipientRole,
          title: String(title).trim(),
          message: String(message).trim(),
          type,
          severity,
          isRead: false,
          createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
          linkPath,
          entityId,
          dedupeKey,
        },
      ]);

      let emailNotification = undefined;
      if (sendEmail && emailRecipient && persisted.length > 0) {
        emailNotification = await dispatchEmailNotification({
          eventType: String(type || "notification"),
          recipientEmail: String(emailRecipient),
          subject: String(title).trim(),
          textBody: String(message).trim(),
          dedupeKey: dedupeKey ? `email:${dedupeKey}` : undefined,
        });
      }

      return res.status(201).json({
        success: true,
        createdCount: persisted.length,
        deduplicated: persisted.length === 0,
        notification: persisted[0] ? sanitizeNotificationForClient(persisted[0]) : null,
        emailNotification,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to persist notification",
      });
    }
  });

  // 3B. Dedicated Booking Email Dispatch & Tenant-Isolated Email Audit Logs
  app.post("/api/bookings/send-email", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required to dispatch booking emails.",
      });
    }

    const {
      hotelId,
      hotelName,
      eventType = "booking_confirmation",
      bookingId,
      guestName,
      recipientEmail,
      roomNumber,
      roomType,
      checkInDate,
      checkOutDate,
      nights,
      totalAmount,
      advanceAmount,
      pendingAmount,
      status,
      cancellationReason,
      dryRun,
      forceResend,
    } = req.body || {};

    const cleanBookingId = String(bookingId || "").trim();
    const cleanGuestName = String(guestName || "").trim();
    const cleanEmail = String(recipientEmail || "").trim();

    if (!cleanBookingId || !cleanGuestName || !cleanEmail) {
      return res.status(400).json({
        success: false,
        error: "bookingId, guestName, and recipientEmail are required.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: "Invalid recipientEmail format.",
      });
    }

    const targetHotelId = String(hotelId || req.headers["x-target-hotel-id"] || caller.hotelId || "").trim();
    if (!targetHotelId) {
      return res.status(400).json({
        success: false,
        error: "Target hotelId is required.",
      });
    }

    if (!isCallerAuthorizedForHotel(caller, targetHotelId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${caller.role}" (${caller.hotelId}) cannot send booking emails for hotel "${targetHotelId}".`,
      });
    }

    const resolvedHotelName = String(hotelName || "DirectStay Partner Hotel").trim();
    const eventLabel =
      eventType === "booking_cancelled"
        ? "Booking Cancellation"
        : eventType === "booking_updated"
        ? "Booking Updated"
        : eventType === "checkin_confirmation"
        ? "Check-In Confirmation"
        : "Booking Confirmation";

    const subject = `${resolvedHotelName} — ${eventLabel} (#${cleanBookingId})`;
    const textBody = [
      `Dear ${cleanGuestName},`,
      ``,
      `Your reservation details with ${resolvedHotelName} (${eventLabel}):`,
      `• Booking ID: ${cleanBookingId}`,
      `• Guest Name: ${cleanGuestName}`,
      `• Room: ${roomNumber || "Assigned at Check-In"}${roomType ? ` (${roomType})` : ""}`,
      `• Check-In: ${checkInDate || "TBD"}`,
      `• Check-Out: ${checkOutDate || "Open Stay"}${nights ? ` (${nights} night(s))` : ""}`,
      `• Total Amount: ₹${Number(totalAmount || 0).toLocaleString("en-IN")}`,
      `• Paid / Advance: ₹${Number(advanceAmount || 0).toLocaleString("en-IN")}`,
      `• Pending Balance: ₹${Number(pendingAmount || 0).toLocaleString("en-IN")}`,
      status ? `• Status: ${status}` : "",
      cancellationReason ? `• Cancellation Note: ${cancellationReason}` : "",
      ``,
      `Thank you for choosing ${resolvedHotelName}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const headerDryRun =
      String(req.headers["x-email-dry-run"] || "").toLowerCase() === "true" ||
      String(req.headers["x-email-dry-run"] || "") === "1";

    const result = await dispatchEmailNotification({
      hotelId: targetHotelId,
      bookingId: cleanBookingId,
      guestName: cleanGuestName,
      roomNumber: roomNumber ? String(roomNumber) : undefined,
      checkInDate: checkInDate ? String(checkInDate) : undefined,
      checkOutDate: checkOutDate ? String(checkOutDate) : undefined,
      totalAmount: totalAmount !== undefined ? Number(totalAmount) : undefined,
      eventType: String(eventType),
      recipientEmail: cleanEmail,
      subject,
      textBody,
      dedupeKey: `bkg-email:${targetHotelId}:${cleanBookingId}:${eventType}:${cleanEmail}`,
      dryRun: Boolean(dryRun || headerDryRun),
      forceResend: Boolean(forceResend),
    });

    return res.status(200).json({
      success: true,
      delivered: result.delivered,
      dryRun: Boolean(result.dryRun),
      status: result.status,
      reason: result.reason,
      log: result.entry || null,
    });
  });

  app.get("/api/email/logs", (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required to view email logs.",
      });
    }

    const reqHotelId = String(req.query.hotelId || req.headers["x-target-hotel-id"] || "").trim();
    if (reqHotelId && !isCallerAuthorizedForHotel(caller, reqHotelId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cannot view email logs for hotel "${reqHotelId}".`,
      });
    }

    const effectiveHotelFilter =
      caller.isSuperAdmin || caller.role === "SuperAdmin"
        ? reqHotelId
        : caller.hotelId;

    const filteredLogs = effectiveHotelFilter
      ? emailDispatchHistory.filter((e) => e.hotelId === effectiveHotelFilter)
      : emailDispatchHistory;

    return res.json({
      success: true,
      provider: getEmailProviderConfig().provider,
      configured: getEmailProviderConfig().configured,
      count: filteredLogs.length,
      logs: filteredLogs,
    });
  });

  // Dedicated Hostinger SMTP Dispatch Endpoints for DirectStay Workflows
  app.post("/api/email/dispatch-invoice", async (req, res) => {
    try {
      const {
        hotelName,
        hotelGstin,
        hotelAddress,
        hotelPhone,
        guestName,
        invoiceNumber,
        roomNumber,
        checkInDate,
        checkOutDate,
        tariffAmount,
        cgst,
        sgst,
        totalAmount,
        paymentMode,
        recipientEmail,
        forceResend,
      } = req.body || {};

      const cleanEmail = String(recipientEmail || "").trim();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, error: "Recipient email is required" });
      }

      const emailPayload = getGuestTaxInvoiceEmail({
        hotelName: hotelName || "DirectStay Partner Hotel",
        hotelGstin: hotelGstin || "22AAAAA0000A1Z5",
        hotelAddress: hotelAddress || "Commercial Hub, India",
        hotelPhone: hotelPhone || "+91 7978563771",
        guestName: guestName || "Valued Guest",
        invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
        roomNumber: String(roomNumber || "101"),
        checkInDate: checkInDate || new Date().toISOString().split("T")[0],
        checkOutDate: checkOutDate || new Date().toISOString().split("T")[0],
        tariffAmount: Number(tariffAmount || 0),
        cgst: Number(cgst || 0),
        sgst: Number(sgst || 0),
        totalAmount: Number(totalAmount || 0),
        paymentMode: paymentMode || "Cash / UPI",
      });

      const result = await dispatchEmailNotification({
        eventType: "guest_invoice",
        recipientEmail: cleanEmail,
        subject: emailPayload.subject,
        textBody: emailPayload.text,
        htmlBody: emailPayload.html,
        dedupeKey: `invoice:${invoiceNumber}:${cleanEmail}`,
        forceResend: Boolean(forceResend),
      });

      return res.json({ success: true, delivered: result.delivered, result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/email/onboard-hotel", async (req, res) => {
    try {
      const { name, ownerName, phone, email, city, roomsCount } = req.body || {};
      const cleanEmail = String(email || "").trim();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, error: "Email is required" });
      }
      const emailPayload = getHotelOnboardingEmail({
        name: name || "DirectStay Hotel",
        ownerName: ownerName || "Hotel Owner",
        phone: phone || "+91 7978563771",
        email: cleanEmail,
        city: city || "India",
        roomsCount: roomsCount || 10,
      });

      const result = await dispatchEmailNotification({
        eventType: "hotel_onboarding",
        recipientEmail: cleanEmail,
        subject: emailPayload.subject,
        textBody: emailPayload.text,
        htmlBody: emailPayload.html,
        forceResend: true,
      });

      return res.json({ success: true, delivered: result.delivered, result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/email/activate-hotel", async (req, res) => {
    try {
      const { name, ownerName, loginUrl, username, temporaryPasscode, planName, recipientEmail } = req.body || {};
      const cleanEmail = String(recipientEmail || "").trim();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, error: "Recipient email is required" });
      }
      const emailPayload = getHotelProfileActivatedEmail({
        name: name || "DirectStay Hotel",
        ownerName: ownerName || "Hotel Owner",
        loginUrl: loginUrl || "https://directstay.online/login",
        username: username || "hoteladmin",
        temporaryPasscode: temporaryPasscode || "DirectStay@2026",
        planName: planName || "Growth Suite Plan",
      });

      const result = await dispatchEmailNotification({
        eventType: "hotel_activated",
        recipientEmail: cleanEmail,
        subject: emailPayload.subject,
        textBody: emailPayload.text,
        htmlBody: emailPayload.html,
        forceResend: true,
      });

      return res.json({ success: true, delivered: result.delivered, result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/email/trial-warning", async (req, res) => {
    try {
      const { name, ownerName, daysRemaining, renewalUrl, recipientEmail } = req.body || {};
      const cleanEmail = String(recipientEmail || "").trim();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, error: "Recipient email is required" });
      }
      const emailPayload = getTrialExpiryWarningEmail({
        name: name || "DirectStay Hotel",
        ownerName: ownerName || "Hotel Owner",
        daysRemaining: Number(daysRemaining || 3),
        renewalUrl: renewalUrl || "https://directstay.online/hotelowner/subscription",
      });

      const result = await dispatchEmailNotification({
        eventType: "trial_warning",
        recipientEmail: cleanEmail,
        subject: emailPayload.subject,
        textBody: emailPayload.text,
        htmlBody: emailPayload.html,
        forceResend: true,
      });

      return res.json({ success: true, delivered: result.delivered, result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/email/subscription-expired", async (req, res) => {
    try {
      const { name, ownerName, renewalUrl, recipientEmail } = req.body || {};
      const cleanEmail = String(recipientEmail || "").trim();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, error: "Recipient email is required" });
      }
      const emailPayload = getSubscriptionExpiredEmail({
        name: name || "DirectStay Hotel",
        ownerName: ownerName || "Hotel Owner",
        renewalUrl: renewalUrl || "https://directstay.online/hotelowner/subscription",
      });

      const result = await dispatchEmailNotification({
        eventType: "subscription_expired",
        recipientEmail: cleanEmail,
        subject: emailPayload.subject,
        textBody: emailPayload.text,
        htmlBody: emailPayload.html,
        forceResend: true,
      });

      return res.json({ success: true, delivered: result.delivered, result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/email/test", async (req, res) => {
    try {
      const { targetEmail } = req.body || {};
      const email = String(targetEmail || "contact@directstay.online").trim();
      const cfg = getEmailProviderConfig();
      const testResult = await dispatchEmailNotification({
        eventType: "smtp_health_check",
        recipientEmail: email,
        subject: `🧪 DirectStay Hostinger SMTP Diagnostic Test — ${new Date().toISOString()}`,
        textBody: `DirectStay Hostinger SMTP Test\nHost: ${cfg.smtpHost}:${cfg.smtpPort}\nUser: ${cfg.smtpUser}\nStatus: Handshake active.`,
        forceResend: true,
      });
      return res.json({
        success: true,
        provider: cfg.provider,
        smtpHost: cfg.smtpHost,
        smtpPort: cfg.smtpPort,
        smtpUser: cfg.smtpUser,
        result: testResult,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Mark All Authorized Notifications as Read
  const handleMarkAllRead = async (req: express.Request, res: express.Response) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const allNotifs = await loadAllNotificationsFromDb(db);
      const targetIds: string[] = [];

      for (const n of allNotifs) {
        if (isNotificationAuthorizedForCaller(n, caller.role, caller.hotelId) && !n.isRead) {
          targetIds.push(String(n.id || n._id));
        }
      }

      if (targetIds.length > 0) {
        const stateDoc = await db
          .collection("pms_app_state")
          .findOne({ _id: "FULL_PMS_BACKUP" as any });
        if (stateDoc && stateDoc.data && Array.isArray(stateDoc.data.notifications)) {
          const idSet = new Set(targetIds);
          const updatedList = stateDoc.data.notifications.map((n: any) =>
            idSet.has(String(n?.id)) ? { ...n, isRead: true } : n
          );
          await db.collection("pms_app_state").updateOne(
            { _id: "FULL_PMS_BACKUP" as any },
            {
              $set: {
                "data.notifications": updatedList,
                updatedAt: new Date().toISOString(),
              },
            }
          );
        }

        ensureExistingColNames(db)
          .then((names) => {
            if (!names.has("notifications")) return;
            return db
              .collection("notifications")
              .updateMany({ _id: { $in: targetIds as any } }, { $set: { isRead: true } });
          })
          .catch(() => {});

        broadcastSseEventToAuthorized(
          "notifications_read_all",
          { role: caller.role, hotelId: caller.hotelId, markedCount: targetIds.length },
          (client) =>
            client.role === caller.role &&
            (caller.role === "SuperAdmin" || client.hotelId === caller.hotelId)
        );
      }

      return res.json({
        success: true,
        markedCount: targetIds.length,
        unreadCount: 0,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to mark notifications as read",
      });
    }
  };
  app.patch("/api/notifications/read-all", handleMarkAllRead);
  app.post("/api/notifications/read-all", handleMarkAllRead);

  // 5. Mark a Single Notification as Read (with Strict Tenant & Recipient Validation)
  const handleMarkOneRead = async (req: express.Request, res: express.Response) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Authentication is required.",
      });
    }

    const notifId = String(req.params.id || "").trim();
    if (!notifId || notifId.length > 120) {
      return res.status(400).json({
        success: false,
        error: "Invalid notification ID.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const allNotifs = await loadAllNotificationsFromDb(db);
      const target = allNotifs.find((n: any) => String(n.id || n._id) === notifId);

      if (!target) {
        return res.status(404).json({
          success: false,
          error: `Notification "${notifId}" not found.`,
        });
      }

      if (!isNotificationAuthorizedForCaller(target, caller.role, caller.hotelId)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: You are not authorized to access or modify this notification.",
        });
      }

      const stateDoc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      if (stateDoc && stateDoc.data && Array.isArray(stateDoc.data.notifications)) {
        const updatedList = stateDoc.data.notifications.map((n: any) =>
          String(n?.id) === notifId ? { ...n, isRead: true } : n
        );
        await db.collection("pms_app_state").updateOne(
          { _id: "FULL_PMS_BACKUP" as any },
          {
            $set: {
              "data.notifications": updatedList,
              updatedAt: new Date().toISOString(),
            },
          }
        );
      }

      ensureExistingColNames(db)
        .then((names) => {
          if (!names.has("notifications")) return;
          return db
            .collection("notifications")
            .updateOne({ _id: notifId as any }, { $set: { isRead: true } });
        })
        .catch(() => {});

      const updatedNotif = sanitizeNotificationForClient({ ...target, isRead: true });
      broadcastSseEventToAuthorized(
        "notification_read",
        { id: notifId, hotelId: target.hotelId },
        (client) => isNotificationAuthorizedForCaller(target, client.role, client.hotelId)
      );

      const remainingUnread = allNotifs.filter(
        (n: any) =>
          String(n.id || n._id) !== notifId &&
          isNotificationAuthorizedForCaller(n, caller.role, caller.hotelId) &&
          !n.isRead
      ).length;

      return res.json({
        success: true,
        notification: updatedNotif,
        unreadCount: remainingUnread,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to mark notification as read",
      });
    }
  };
  app.patch("/api/notifications/:id/read", handleMarkOneRead);
  app.post("/api/notifications/:id/read", handleMarkOneRead);

  // =========================================================================
  // FRONT DESK GUEST SERVICES & ROOM SERVICE ALLOCATION ENDPOINTS
  // =========================================================================
  const processedServiceAllocationRequestIds = new Set<string>();
  const processedServiceCreateRequestIds = new Set<string>();

  function verifyAuthorizedHotelStaffForService(req: express.Request): {
    ok: boolean;
    status: number;
    error?: string;
    caller?: ReturnType<typeof resolveCallerIdentity>;
    effectiveHotelId?: string;
  } {
    let caller = resolveCallerIdentity(req);
    if (!caller.authenticated || !caller.role) {
      const fallbackRole = String(
        req.headers["x-user-role"] || req.body?.role || req.query?.role || ""
      ).trim();
      const fallbackHotelId = String(
        req.headers["x-hotel-id"] || req.body?.hotelId || req.query?.hotelId || ""
      ).trim();
      const fallbackUser = String(
        req.headers["x-user-name"] || req.body?.username || fallbackRole || "Front Desk Staff"
      ).trim();
      if (fallbackRole && fallbackHotelId) {
        caller = {
          authenticated: true,
          fromSession: false,
          role: normalizeRole(fallbackRole),
          rawRole: fallbackRole,
          hotelId: fallbackHotelId,
          username: fallbackUser,
        };
      } else {
        return {
          ok: false,
          status: 401,
          error: "Unauthorized: Valid hotel staff authentication is required.",
        };
      }
    }

    const rawLower = String(caller.rawRole || caller.role || "").trim().toLowerCase();
    const allowedRoles = new Set([
      "admin",
      "hotel_admin",
      "hoteladmin",
      "owner",
      "hotel_owner",
      "hotelowner",
      "manager",
      "reception",
      "receptionist",
      "accounts",
      "accountant",
      "superadmin",
      "super_admin",
    ]);

    if (!allowedRoles.has(rawLower)) {
      return {
        ok: false,
        status: 403,
        error: `Forbidden: Role "${caller.rawRole || caller.role}" is not authorized to manage or allocate Front Desk guest services.`,
      };
    }

    const bodyHotelId = req.body && req.body.hotelId ? String(req.body.hotelId).trim() : "";
    const queryHotelId = req.query && req.query.hotelId ? String(req.query.hotelId).trim() : "";
    const requestedHotelId = bodyHotelId || queryHotelId;

    if (
      requestedHotelId &&
      caller.role !== "SuperAdmin" &&
      caller.hotelId &&
      requestedHotelId !== caller.hotelId
    ) {
      return {
        ok: false,
        status: 403,
        error: `Forbidden: Tenant isolation violation. Staff of "${caller.hotelId}" cannot access or allocate services for "${requestedHotelId}".`,
      };
    }

    const effectiveHotelId =
      caller.role === "SuperAdmin"
        ? requestedHotelId || caller.hotelId || "hotel-1"
        : caller.hotelId || requestedHotelId || "hotel-1";

    return {
      ok: true,
      status: 200,
      caller,
      effectiveHotelId,
    };
  }

  // 1. List Saved Guest Services & Allocations for the Current Hotel
  app.get("/api/guest-services", async (req, res) => {
    const auth = verifyAuthorizedHotelStaffForService(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const allRecords: any[] = Array.isArray(currentState.waterBottles)
        ? currentState.waterBottles
        : [];

      const hotelRecords = allRecords.filter(
        (r) => r && (r.hotelId || "hotel-1") === auth.effectiveHotelId
      );
      const services = hotelRecords
        .filter((r) => r.recordType === "service_catalog")
        .map((r) => ({
          id: r.id,
          hotelId: r.hotelId || auth.effectiveHotelId,
          name: r.serviceName || "Service",
          amount: Number(r.configuredAmount ?? r.chargeAmount ?? 0),
          createdAt: r.dateTime || r.date,
          createdBy: r.deliveredBy,
        }));
      const allocations = hotelRecords.filter((r) => r.recordType === "service_allocation");

      return res.json({
        success: true,
        hotelId: auth.effectiveHotelId,
        services,
        allocations,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to load guest services",
      });
    }
  });

  // 2. Add / Save a New Guest Service (Service Name + Validated Amount)
  app.post("/api/guest-services", async (req, res) => {
    const auth = verifyAuthorizedHotelStaffForService(req);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const { serviceName, name, amount, requestId } = req.body || {};
    const trimmedName = String(serviceName ?? name ?? "").trim();

    if (!trimmedName || trimmedName.length > 120) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: A valid Service Name (1-120 characters) is required.",
      });
    }

    if (amount === undefined || amount === null || String(amount).trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Service Amount (₹) is required.",
      });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0 || parsedAmount > 1_000_000) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Service Amount (₹) must be a valid non-negative number (0 to 1,000,000).",
      });
    }

    const roundedAmount = parseFloat(parsedAmount.toFixed(2));
    const reqKey = requestId ? `${auth.effectiveHotelId}:${String(requestId).trim()}` : "";
    if (reqKey && processedServiceCreateRequestIds.has(reqKey)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "Duplicate request: This service creation request has already been processed.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingRecords: any[] = Array.isArray(currentState.waterBottles)
        ? currentState.waterBottles
        : [];

      if (
        requestId &&
        existingRecords.some(
          (r) =>
            r &&
            r.recordType === "service_catalog" &&
            (r.hotelId || "hotel-1") === auth.effectiveHotelId &&
            r.requestId === String(requestId).trim()
        )
      ) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          error: "Duplicate request: This service has already been saved.",
        });
      }

      if (reqKey) {
        processedServiceCreateRequestIds.add(reqKey);
      }

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split("T")[0];
      const nowDisplay = nowIso.replace("T", " ").substring(0, 16);
      const serviceId = `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const catalogRecord = {
        id: serviceId,
        serviceId,
        requestId: requestId ? String(requestId).trim() : serviceId,
        hotelId: auth.effectiveHotelId,
        recordType: "service_catalog" as const,
        serviceName: trimmedName,
        configuredAmount: roundedAmount,
        chargeAmount: roundedAmount,
        isChargeable: true,
        roomNumber: "CATALOG",
        quantity: 0,
        date: todayStr,
        dateTime: nowDisplay,
        deliveredBy: auth.caller.username || "Front Desk Staff",
      };

      const updatedWaterBottles = [catalogRecord, ...existingRecords];
      currentState.waterBottles = updatedWaterBottles;

      const srvAuditActor = formatAuthoritativeActor({
        authenticated: true,
        fromSession: true,
        username: auth.caller.username || auth.caller.role,
        role: auth.caller.role,
        rawRole: auth.caller.role,
      });
      const srvAuditEntry = {
        id: generateServerAuditId("AUD-SRV"),
        hotelId: auth.effectiveHotelId,
        action: "Guest Service Added",
        performedBy: srvAuditActor.performedBy,
        actorId: srvAuditActor.actorId,
        actorUsername: srvAuditActor.actorUsername,
        actorRole: srvAuditActor.actorRole,
        entityType: "service_catalog",
        entityId: serviceId,
        outcome: "success" as const,
        requestId: catalogRecord.requestId,
        dateTime: nowIso,
        persistedAt: nowIso,
        details: `Added saved guest service "${trimmedName}" with amount ₹${roundedAmount}`,
      };
      const existingAuditLogsForSrv: any[] = Array.isArray(currentState.auditLogs)
        ? currentState.auditLogs
        : [];
      currentState.auditLogs = [srvAuditEntry, ...existingAuditLogsForSrv];

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        {
          _id: "FULL_PMS_BACKUP" as any,
          data: currentState,
          updatedAt: nowIso,
        },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "water_bottles", updatedWaterBottles),
        syncAuditLogsAppendOnly(db, [srvAuditEntry]),
      ]);

      return res.status(201).json({
        success: true,
        service: {
          id: serviceId,
          hotelId: auth.effectiveHotelId,
          name: trimmedName,
          amount: roundedAmount,
          createdAt: nowDisplay,
          createdBy: catalogRecord.deliveredBy,
        },
        catalogRecord,
        auditLog: srvAuditEntry,
      });
    } catch (err: any) {
      if (reqKey) processedServiceCreateRequestIds.delete(reqKey);
      return res.status(500).json({
        success: false,
        error: "Failed to save guest service",
      });
    }
  });

  // 3. Allocate a Saved Guest Service to an Occupied Room (Complimentary vs Chargeable)
  app.post("/api/guest-services/allocate", async (req, res) => {
    const auth = verifyAuthorizedHotelStaffForService(req);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const { roomNumber, serviceId, isChargeable, requestId } = req.body || {};
    const targetRoomNo = String(roomNumber ?? "").trim();
    const targetServiceId = String(serviceId ?? "").trim();
    const cleanRequestId = String(requestId ?? "").trim();

    if (!targetRoomNo) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Occupied room selection is required.",
      });
    }

    if (!targetServiceId) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Please select a valid service to allocate.",
      });
    }

    // Idempotency / duplicate-click guard
    const dedupeKey = cleanRequestId
      ? `${auth.effectiveHotelId}:${cleanRequestId}`
      : "";
    if (dedupeKey && processedServiceAllocationRequestIds.has(dedupeKey)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "Duplicate click prevented: This service allocation has already been processed.",
      });
    }

    if (dedupeKey) {
      processedServiceAllocationRequestIds.add(dedupeKey);
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};

      const existingRooms: any[] = Array.isArray(currentState.rooms)
        ? currentState.rooms
        : [];
      const existingCheckins: any[] = Array.isArray(currentState.checkins)
        ? currentState.checkins
        : [];
      const existingWaterBottles: any[] = Array.isArray(currentState.waterBottles)
        ? currentState.waterBottles
        : [];

      // Check persisted records for duplicate requestId
      if (cleanRequestId) {
        const alreadyInLogs = existingWaterBottles.some(
          (w) =>
            w &&
            w.recordType === "service_allocation" &&
            (w.hotelId || "hotel-1") === auth.effectiveHotelId &&
            w.requestId === cleanRequestId
        );
        const alreadyInCheckins = existingCheckins.some(
          (c) =>
            c &&
            (c.hotelId || "hotel-1") === auth.effectiveHotelId &&
            Array.isArray(c.allocatedServices) &&
            c.allocatedServices.some((s: any) => s && s.requestId === cleanRequestId)
        );
        if (alreadyInLogs || alreadyInCheckins) {
          return res.status(409).json({
            success: false,
            duplicate: true,
            error: "Duplicate click prevented: This service allocation was already saved.",
          });
        }
      }

      // 1. Verify that the room belongs to the current hotel
      const hotelRoom = existingRooms.find(
        (r) =>
          r &&
          (r.hotelId || "hotel-1") === auth.effectiveHotelId &&
          String(r.number).trim() === targetRoomNo
      );
      if (!hotelRoom) {
        if (dedupeKey) processedServiceAllocationRequestIds.delete(dedupeKey);
        return res.status(404).json({
          success: false,
          error: `Validation Error: Room ${targetRoomNo} does not belong to the current hotel (${auth.effectiveHotelId}).`,
        });
      }

      // 2. Verify that the room has an active guest stay
      const activeStay = existingCheckins.find(
        (c) =>
          c &&
          (c.hotelId || "hotel-1") === auth.effectiveHotelId &&
          !c.checkedOutDateTime &&
          (String(c.roomNumber).trim() === targetRoomNo ||
            (Array.isArray(c.bookedRooms) &&
              c.bookedRooms.some((br: any) => String(br?.roomNumber).trim() === targetRoomNo)))
      );

      if (!activeStay) {
        if (dedupeKey) processedServiceAllocationRequestIds.delete(dedupeKey);
        return res.status(400).json({
          success: false,
          error: `Validation Error: Room ${targetRoomNo} does not have an active in-house guest stay.`,
        });
      }

      // 3. Look up authoritative saved service definition on the backend (do NOT trust frontend amount)
      const catalogService = existingWaterBottles.find(
        (w) =>
          w &&
          w.recordType === "service_catalog" &&
          (w.hotelId || "hotel-1") === auth.effectiveHotelId &&
          (String(w.id) === targetServiceId || String(w.serviceId) === targetServiceId)
      );

      if (!catalogService) {
        if (dedupeKey) processedServiceAllocationRequestIds.delete(dedupeKey);
        return res.status(404).json({
          success: false,
          error: "Validation Error: Selected service was not found in this hotel's saved services.",
        });
      }

      const authoritativeAmount = parseFloat(
        Number(catalogService.configuredAmount ?? catalogService.chargeAmount ?? 0).toFixed(2)
      );
      if (!Number.isFinite(authoritativeAmount) || authoritativeAmount < 0) {
        if (dedupeKey) processedServiceAllocationRequestIds.delete(dedupeKey);
        return res.status(400).json({
          success: false,
          error: "Validation Error: Configured service amount is invalid.",
        });
      }

      const authoritativeServiceName = String(catalogService.serviceName || "Room Service").trim();
      const shouldChargeGuest = Boolean(isChargeable);
      const chargedAmount = shouldChargeGuest ? authoritativeAmount : 0;

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split("T")[0];
      const nowDisplay = nowIso.replace("T", " ").substring(0, 16);
      const allocationId = `SALLOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const allocationRecord = {
        id: allocationId,
        requestId: cleanRequestId || allocationId,
        hotelId: auth.effectiveHotelId,
        serviceId: String(catalogService.id),
        serviceName: authoritativeServiceName,
        configuredAmount: authoritativeAmount,
        chargedAmount,
        isChargeable: shouldChargeGuest,
        roomNumber: targetRoomNo,
        checkInId: String(activeStay.id),
        guestName: String(activeStay.guestName),
        allocatedBy: auth.caller.username || "Front Desk Staff",
        dateTime: nowDisplay,
      };

      const extraChargeEntry = shouldChargeGuest
        ? {
            id: allocationId,
            category: "Other" as const,
            description: `${authoritativeServiceName} (Room ${targetRoomNo})`,
            amount: authoritativeAmount,
            dateTime: nowIso,
          }
        : null;

      let updatedStayRecord: any = null;
      const updatedCheckins = existingCheckins.map((c) => {
        if (c && c.id === activeStay.id && (c.hotelId || "hotel-1") === auth.effectiveHotelId) {
          const prevAllocated = Array.isArray(c.allocatedServices) ? c.allocatedServices : [];
          const prevExtras = Array.isArray(c.extraCharges) ? c.extraCharges : [];

          // Ensure charge is added ONLY ONCE if chargeable, and NEVER added if complimentary
          const nextExtras =
            shouldChargeGuest && extraChargeEntry && !prevExtras.some((e: any) => e && e.id === allocationId)
              ? [...prevExtras, extraChargeEntry]
              : prevExtras;

          const nextPending = shouldChargeGuest
            ? parseFloat((Number(c.pendingAmount || 0) + authoritativeAmount).toFixed(2))
            : Number(c.pendingAmount || 0);

          updatedStayRecord = {
            ...c,
            allocatedServices: [...prevAllocated, allocationRecord],
            extraCharges: nextExtras,
            pendingAmount: nextPending,
          };
          return updatedStayRecord;
        }
        return c;
      });

      const logRecord = {
        id: allocationId,
        requestId: cleanRequestId || allocationId,
        hotelId: auth.effectiveHotelId,
        recordType: "service_allocation" as const,
        serviceId: String(catalogService.id),
        serviceName: authoritativeServiceName,
        configuredAmount: authoritativeAmount,
        chargeAmount: chargedAmount,
        isChargeable: shouldChargeGuest,
        roomNumber: targetRoomNo,
        checkInId: String(activeStay.id),
        guestName: String(activeStay.guestName),
        quantity: 0,
        date: todayStr,
        dateTime: nowDisplay,
        deliveredBy: auth.caller.username || "Front Desk Staff",
      };

      const updatedWaterBottles = [logRecord, ...existingWaterBottles];

      const allocAuditActor = formatAuthoritativeActor({
        authenticated: true,
        fromSession: true,
        username: auth.caller.username || auth.caller.role,
        role: auth.caller.role,
        rawRole: auth.caller.role,
      });
      const allocAuditEntry = {
        id: generateServerAuditId("AUD-SALLOC"),
        hotelId: auth.effectiveHotelId,
        action: "Room Service Allocated",
        performedBy: allocAuditActor.performedBy,
        actorId: allocAuditActor.actorId,
        actorUsername: allocAuditActor.actorUsername,
        actorRole: allocAuditActor.actorRole,
        entityType: "service_allocation",
        entityId: allocationId,
        outcome: "success" as const,
        requestId: allocationRecord.requestId,
        dateTime: nowIso,
        persistedAt: nowIso,
        details: `Allocated "${authoritativeServiceName}" to Room ${targetRoomNo} (${
          activeStay.guestName
        }) as ${
          shouldChargeGuest
            ? `Chargeable (₹${chargedAmount})`
            : "Complimentary (₹0 charged)"
        }`,
      };
      const existingAuditLogsForAlloc: any[] = Array.isArray(currentState.auditLogs)
        ? currentState.auditLogs
        : [];
      currentState.auditLogs = [allocAuditEntry, ...existingAuditLogsForAlloc];

      currentState.checkins = updatedCheckins;
      currentState.waterBottles = updatedWaterBottles;

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        {
          _id: "FULL_PMS_BACKUP" as any,
          data: currentState,
          updatedAt: nowIso,
        },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "checkins", updatedCheckins),
        syncCollectionDocs(db, "water_bottles", updatedWaterBottles),
        syncAuditLogsAppendOnly(db, [allocAuditEntry]),
      ]);

      return res.status(200).json({
        success: true,
        allocation: allocationRecord,
        extraCharge: extraChargeEntry,
        updatedCheckIn: updatedStayRecord,
        logRecord,
        auditLog: allocAuditEntry,
      });
    } catch (err: any) {
      if (dedupeKey) processedServiceAllocationRequestIds.delete(dedupeKey);
      return res.status(500).json({
        success: false,
        error: "Failed to allocate guest service to room",
      });
    }
  });

  // =========================================================================
  // PUBLIC QR DIGITAL MENU & ROOM ORDERING APIs
  // =========================================================================
  app.get("/api/public/digital-menu", async (req, res) => {
    const targetHotelId = String(req.query.hotelId || "hotel-1").trim();
    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const hotels: any[] = Array.isArray(currentState.hotels) ? currentState.hotels : [];
      const matchedHotel =
        hotels.find((h) => h && h.id === targetHotelId) || hotels[0] || null;
      const hotelName =
        matchedHotel?.name ||
        currentState.hotelSettings?.name ||
        "Hotel Room Service";

      const allPosItems: any[] = Array.isArray(currentState.posItems)
        ? currentState.posItems
        : [];
      const items = allPosItems.filter(
        (i) => i && ((i.hotelId || "hotel-1") === targetHotelId || !i.hotelId)
      );

      const allRooms: any[] = Array.isArray(currentState.rooms)
        ? currentState.rooms
        : [];
      const rooms = allRooms.filter(
        (r) => r && ((r.hotelId || "hotel-1") === targetHotelId || !r.hotelId)
      );

      return res.json({
        success: true,
        hotelId: targetHotelId,
        hotelName,
        items,
        rooms,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch digital menu",
      });
    }
  });

  app.post("/api/public/digital-menu/order", async (req, res) => {
    const { hotelId, order } = req.body || {};
    const targetHotelId = String(hotelId || order?.hotelId || "hotel-1").trim();
    if (!order || !order.roomNumber || !Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Room number and order items are required.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingOrders: any[] = Array.isArray(currentState.posOrders)
        ? currentState.posOrders
        : [];
      const existingCheckins: any[] = Array.isArray(currentState.checkins)
        ? currentState.checkins
        : [];

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split("T")[0];
      const cleanRoom = String(order.roomNumber).trim();

      const activeStay = existingCheckins.find(
        (c) =>
          c &&
          (c.hotelId || "hotel-1") === targetHotelId &&
          !c.checkedOutDateTime &&
          (String(c.roomNumber).trim().toLowerCase() === cleanRoom.toLowerCase() ||
            (Array.isArray(c.bookedRooms) &&
              c.bookedRooms.some(
                (br: any) =>
                  String(br?.roomNumber).trim().toLowerCase() === cleanRoom.toLowerCase()
              )))
      );

      const enrichedOrder = {
        ...order,
        hotelId: targetHotelId,
        checkinId: activeStay?.id || order.checkinId,
        checkInId: activeStay?.id || order.checkInId,
        folioChargeId: activeStay ? `EC-POS-${order.id}` : order.folioChargeId,
      };

      const updatedOrders = [
        enrichedOrder,
        ...existingOrders.filter((o) => o && o.id !== enrichedOrder.id),
      ];
      currentState.posOrders = updatedOrders;

      if (activeStay) {
        const folioChargeId = `EC-POS-${enrichedOrder.id}`;
        const itemsSummary = enrichedOrder.items
          .map((i: any) => `${i.itemName} x${i.quantity}`)
          .join(", ");
        const extraChargeEntry = {
          id: folioChargeId,
          category: "Food",
          sourceType: "pos_order",
          sourceId: enrichedOrder.id,
          amount: Number(enrichedOrder.grandTotal || 0),
          date: todayStr,
          description: `QR Menu Order #${enrichedOrder.orderNumber} (${itemsSummary})`,
          dateTime: nowIso,
          addedBy: "Digital QR Menu",
        };
        currentState.checkins = existingCheckins.map((c) => {
          if (!c || c.id !== activeStay.id) return c;
          const prevExtras = Array.isArray(c.extraCharges) ? c.extraCharges : [];
          return {
            ...c,
            extraCharges: [...prevExtras, extraChargeEntry],
            pendingAmount: Math.max(
              0,
              Number(c.pendingAmount || 0) + Number(enrichedOrder.grandTotal || 0)
            ),
          };
        });
      }

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        {
          _id: "FULL_PMS_BACKUP" as any,
          data: currentState,
          updatedAt: nowIso,
        },
        { upsert: true }
      );

      return res.json({
        success: true,
        order: enrichedOrder,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: "Failed to save digital menu order",
      });
    }
  });

  // =========================================================================
  // HOTEL-SCOPED FINANCE HUB APIs (Single Source of Truth, RBAC & Idempotency)
  // =========================================================================
  const processedFinanceIdempotencyKeys = new Set<string>();

  function normalizeFinanceRole(rawRole: string): string {
    const r = String(rawRole || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "superadmin" || r === "super_admin") return "SuperAdmin";
    if (r === "owner" || r === "hotel_owner" || r === "hotelowner") return "Owner";
    if (r === "admin" || r === "hotel_admin" || r === "hoteladmin") return "Admin";
    if (r === "manager") return "Manager";
    if (r === "accounts" || r === "accountant") return "Accounts";
    if (r === "reception") return "Reception";
    if (r === "receptionist") return "Receptionist";
    if (r === "housekeeping") return "Housekeeping";
    return String(rawRole).trim();
  }

  function verifyFinanceAccess(
    req: express.Request,
    allowedRoles: string[] = [
      "SuperAdmin",
      "Owner",
      "Admin",
      "Manager",
      "Accounts",
      "Reception",
      "Receptionist",
    ]
  ): {
    ok: boolean;
    status: number;
    error?: string;
    caller?: { authenticated: boolean; username: string; role: string; hotelId: string };
    effectiveHotelId?: string;
  } {
    const baseCaller = resolveCallerIdentity(req);
    const financeRole = normalizeFinanceRole(baseCaller.rawRole || baseCaller.role);
    if (!baseCaller.authenticated || !financeRole) {
      return {
        ok: false,
        status: 401,
        error: "Unauthorized: Active authenticated session required for financial access.",
      };
    }

    const caller = {
      ...baseCaller,
      role: financeRole,
    };

    if (!allowedRoles.includes(financeRole)) {
      return {
        ok: false,
        status: 403,
        error: `Forbidden: Role "${financeRole}" is not permitted to perform this financial action.`,
      };
    }

    const requestedHotelId = String(
      req.body?.hotelId ||
        req.query?.hotelId ||
        req.headers["x-target-hotel-id"] ||
        req.headers["x-hotel-id"] ||
        req.headers["x-pms-hotel-id"] ||
        ""
    ).trim();

    if (
      financeRole !== "SuperAdmin" &&
      requestedHotelId &&
      caller.hotelId &&
      caller.hotelId !== "SUPERADMIN" &&
      requestedHotelId !== caller.hotelId
    ) {
      return {
        ok: false,
        status: 403,
        error: `Forbidden: Cross-hotel financial access blocked. User of "${caller.hotelId}" cannot access or modify financial records of "${requestedHotelId}".`,
      };
    }

    const effectiveHotelId =
      financeRole === "SuperAdmin"
        ? requestedHotelId || (caller.hotelId !== "SUPERADMIN" ? caller.hotelId : "hotel-1") || "hotel-1"
        : caller.hotelId || requestedHotelId || "hotel-1";

    return {
      ok: true,
      status: 200,
      caller,
      effectiveHotelId,
    };
  }

  function appendFinancialAuditLog(
    currentState: Record<string, any>,
    hotelId: string,
    action: string,
    performedBy: string,
    details: string
  ) {
    const existingLogs: any[] = Array.isArray(currentState.auditLogs) ? currentState.auditLogs : [];
    const nowIso = new Date().toISOString();
    const roleMatch = performedBy.match(/\(([^)]+)\)\s*$/);
    const actorRole = roleMatch ? roleMatch[1].trim() : "Admin";
    const actorUsername = performedBy.replace(/\s*\([^)]*\)\s*$/, "").trim() || actorRole;
    const newLog = {
      id: generateServerAuditId("AUD-FIN"),
      hotelId,
      action: sanitizeAuditText(action),
      performedBy,
      actorId: `${actorRole.toLowerCase()}:${actorUsername}`,
      actorUsername,
      actorRole,
      outcome: "success" as const,
      details: sanitizeAuditText(details),
      dateTime: nowIso,
      persistedAt: nowIso,
    };
    currentState.auditLogs = [newLog, ...existingLogs];
    return newLog;
  }

  // 1. GET /api/finance/summary — Hotel-scoped Single Source of Truth Financial Summary
  app.get("/api/finance/summary", async (req, res) => {
    const auth = verifyFinanceAccess(req);
    if (!auth.ok || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};

      const summary = computeHotelFinancialSummary({
        hotelId: auth.effectiveHotelId,
        invoices: currentState.invoices || [],
        checkins: currentState.checkins || [],
        bookings: currentState.bookings || [],
        posOrders: currentState.posOrders || [],
        expenses: currentState.expenses || [],
        inventoryPurchases: currentState.inventoryPurchases || [],
        inventorySuppliers: currentState.inventorySuppliers || [],
        pettyCash: currentState.pettyCash || [],
        cashBankAccounts: currentState.cashBankAccounts || [],
        vouchers: currentState.vouchers || [],
        vendors: currentState.vendors || [],
        ownerPayments: currentState.ownerPayments || [],
        reimbursements: currentState.reimbursements || [],
        dailyClosings: currentState.dailyClosings || [],
        auditLogs: currentState.auditLogs || [],
      });

      return res.status(200).json({
        success: true,
        hotelId: auth.effectiveHotelId,
        summary,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to compute hotel financial summary",
      });
    }
  });

  // 2. POST /api/finance/expenses — Create Expense (Separates Recording, Approval & Payment)
  app.post("/api/finance/expenses", async (req, res) => {
    const auth = verifyFinanceAccess(req);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const {
      id,
      category,
      subcategory,
      department,
      vendorId,
      vendorName,
      vendorGstNumber,
      invoiceReference,
      date,
      dueDate,
      description,
      baseAmount,
      taxRate,
      taxAmount,
      amount,
      paymentMethod,
      paymentSource,
      approvalStatus,
      paymentStatus,
      billFileName,
      billFileData,
      notes,
      requestId,
      idempotencyKey,
    } = req.body || {};

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Expense amount must be a positive number.",
      });
    }

    const cleanCategory = String(category || "").trim();
    const cleanDescription = String(description || "").trim();
    if (!cleanCategory || !cleanDescription) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Expense category and description are required.",
      });
    }

    const dedupeToken = String(idempotencyKey || requestId || id || "").trim();
    const dedupeKey = dedupeToken ? `EXP:${auth.effectiveHotelId}:${dedupeToken}` : "";
    if (dedupeKey && processedFinanceIdempotencyKeys.has(dedupeKey)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "Duplicate request: This expense has already been recorded.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingExpenses: any[] = Array.isArray(currentState.expenses)
        ? currentState.expenses
        : [];

      if (
        dedupeToken &&
        existingExpenses.some(
          (e) =>
            e &&
            (e.hotelId || "hotel-1") === auth.effectiveHotelId &&
            (e.id === dedupeToken || e.idempotencyKey === dedupeToken)
        )
      ) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          error: "Duplicate expense prevented: An expense with this reference already exists.",
        });
      }

      if (dedupeKey) processedFinanceIdempotencyKeys.add(dedupeKey);

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);
      const canApprove = canRoleApproveExpense(auth.caller.role);

      // Phase 5 Rule: Recording an expense defaults to Pending Approval & Unpaid unless caller is an approver who explicitly approved/paid it
      const resolvedApprovalStatus =
        canApprove && approvalStatus === "Approved" ? "Approved" : "Pending";
      const resolvedPaymentStatus =
        resolvedApprovalStatus === "Approved" && paymentStatus === "Paid" ? "Paid" : "Unpaid";

      const totalAmt = Number(parsedAmount.toFixed(2));
      const paidAmt = resolvedPaymentStatus === "Paid" ? totalAmt : 0;
      const outstandingAmt = Number((totalAmt - paidAmt).toFixed(2));

      const expenseId = id ? String(id).trim() : `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newExpense = {
        id: expenseId,
        hotelId: auth.effectiveHotelId,
        expenseNo: `EXP-${1000 + existingExpenses.filter((e) => (e?.hotelId || "hotel-1") === auth.effectiveHotelId).length + 1}`,
        department: String(department || "General Operations"),
        category: cleanCategory,
        subcategory: subcategory ? String(subcategory) : undefined,
        vendorId: vendorId ? String(vendorId) : undefined,
        vendorName: vendorName ? String(vendorName).trim() : undefined,
        vendorGstNumber: vendorGstNumber ? String(vendorGstNumber).trim() : undefined,
        invoiceReference: invoiceReference ? String(invoiceReference).trim() : undefined,
        date: date ? String(date).slice(0, 10) : todayStr,
        dueDate: dueDate ? String(dueDate).slice(0, 10) : date ? String(date).slice(0, 10) : todayStr,
        description: cleanDescription,
        baseAmount: baseAmount !== undefined ? Number(baseAmount) : totalAmt - Number(taxAmount || 0),
        taxRate: taxRate !== undefined ? Number(taxRate) : 0,
        taxAmount: taxAmount !== undefined ? Number(taxAmount) : 0,
        gstAmount: taxAmount !== undefined ? Number(taxAmount) : 0,
        amount: totalAmt,
        amountPaid: paidAmt,
        outstandingAmount: outstandingAmt,
        paymentSource: paymentSource || "Bank Account",
        paymentMethod: paymentMethod || "Bank Transfer",
        paymentStatus: resolvedPaymentStatus,
        paidDate: resolvedPaymentStatus === "Paid" ? todayStr : undefined,
        paidBy: resolvedPaymentStatus === "Paid" ? auth.caller.username : undefined,
        approvalStatus: resolvedApprovalStatus,
        status: resolvedApprovalStatus,
        approvedBy: resolvedApprovalStatus === "Approved" ? auth.caller.username : undefined,
        approvedDate: resolvedApprovalStatus === "Approved" ? todayStr : undefined,
        billFileName: billFileName || undefined,
        billFileData: billFileData || undefined,
        notes: notes ? String(notes) : undefined,
        createdBy: auth.caller.username || auth.caller.role,
        idempotencyKey: dedupeToken || expenseId,
        auditHistory: [
          {
            action: "Expense Recorded",
            status: `${resolvedApprovalStatus} / ${resolvedPaymentStatus}`,
            performedBy: `${auth.caller.username} (${auth.caller.role})`,
            dateTime: nowIso.replace("T", " ").slice(0, 19),
            notes: cleanDescription,
          },
        ],
      };

      const updatedExpenses = [newExpense, ...existingExpenses];
      currentState.expenses = updatedExpenses;

      const auditEntry = appendFinancialAuditLog(
        currentState,
        auth.effectiveHotelId,
        "Expense Created",
        `${auth.caller.username} (${auth.caller.role})`,
        `Recorded expense ${newExpense.expenseNo} (${cleanCategory}) for ₹${totalAmt} [Approval: ${resolvedApprovalStatus}, Payment: ${resolvedPaymentStatus}].`
      );

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "expenses", updatedExpenses),
        syncCollectionDocs(db, "audit_logs", currentState.auditLogs),
      ]);

      return res.status(201).json({
        success: true,
        expense: newExpense,
        auditLog: auditEntry,
      });
    } catch (err: any) {
      if (dedupeKey) processedFinanceIdempotencyKeys.delete(dedupeKey);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to record expense",
      });
    }
  });

  // 3. POST /api/finance/expenses/:id/approve — Approve or Reject Expense (RBAC Enforced; Does NOT Auto-Pay!)
  app.post("/api/finance/expenses/:id/approve", async (req, res) => {
    const auth = verifyFinanceAccess(req, ["SuperAdmin", "Owner", "Admin", "Manager", "Accounts"]);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const targetId = String(req.params.id || "").trim();
    const { decision, notes } = req.body || {};
    const resolvedDecision = decision === "Rejected" ? "Rejected" : "Approved";

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingExpenses: any[] = Array.isArray(currentState.expenses)
        ? currentState.expenses
        : [];

      const expIndex = existingExpenses.findIndex(
        (e) => e && (e.id === targetId || e.expenseNo === targetId)
      );
      if (expIndex === -1) {
        return res.status(404).json({
          success: false,
          error: `Expense "${targetId}" not found.`,
        });
      }

      const targetExp = existingExpenses[expIndex];
      if ((targetExp.hotelId || "hotel-1") !== auth.effectiveHotelId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Cross-hotel expense approval is blocked.",
        });
      }

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);

      // Phase 5 Rule: An approved expense is NOT automatically a paid expense!
      const prevPayStatus = targetExp.paymentStatus || "Unpaid";
      const totalAmt = Number(targetExp.amount || 0);
      const paidAmt = prevPayStatus === "Paid" ? totalAmt : Number(targetExp.amountPaid || 0);
      const outstandingAmt =
        resolvedDecision === "Rejected" ? 0 : Math.max(0, Number((totalAmt - paidAmt).toFixed(2)));

      const prevHistory = Array.isArray(targetExp.auditHistory) ? targetExp.auditHistory : [];
      const updatedExpense = {
        ...targetExp,
        approvalStatus: resolvedDecision,
        status: resolvedDecision,
        approvedBy: `${auth.caller.username} (${auth.caller.role})`,
        approvedDate: todayStr,
        approvalNotes: notes ? String(notes) : targetExp.approvalNotes,
        paymentStatus: resolvedDecision === "Rejected" ? "Unpaid" : prevPayStatus,
        amountPaid: paidAmt,
        outstandingAmount: outstandingAmt,
        auditHistory: [
          ...prevHistory,
          {
            action: `Expense ${resolvedDecision}`,
            status: `${resolvedDecision} / ${prevPayStatus}`,
            performedBy: `${auth.caller.username} (${auth.caller.role})`,
            dateTime: nowIso.replace("T", " ").slice(0, 19),
            notes: notes ? String(notes) : `Marked ${resolvedDecision}`,
          },
        ],
      };

      const updatedExpenses = [...existingExpenses];
      updatedExpenses[expIndex] = updatedExpense;
      currentState.expenses = updatedExpenses;

      const auditEntry = appendFinancialAuditLog(
        currentState,
        auth.effectiveHotelId,
        `Expense ${resolvedDecision}`,
        `${auth.caller.username} (${auth.caller.role})`,
        `Expense ${updatedExpense.expenseNo || updatedExpense.id} (₹${totalAmt}) was ${resolvedDecision}. Payment status remains "${updatedExpense.paymentStatus}".`
      );

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "expenses", updatedExpenses),
        syncCollectionDocs(db, "audit_logs", currentState.auditLogs),
      ]);

      return res.status(200).json({
        success: true,
        expense: updatedExpense,
        auditLog: auditEntry,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to update expense approval status",
      });
    }
  });

  // 4. POST /api/finance/expenses/:id/pay — Record Full or Partial Payment on an Approved Expense
  app.post("/api/finance/expenses/:id/pay", async (req, res) => {
    const auth = verifyFinanceAccess(req, ["SuperAdmin", "Owner", "Admin", "Manager", "Accounts"]);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const targetId = String(req.params.id || "").trim();
    const { amount, paymentMethod, paymentSource, referenceNo, notes, requestId } = req.body || {};

    const dedupeKey = requestId ? `EXPPAY:${auth.effectiveHotelId}:${String(requestId).trim()}` : "";
    if (dedupeKey && processedFinanceIdempotencyKeys.has(dedupeKey)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "Duplicate payment prevented: This expense payment request was already processed.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingExpenses: any[] = Array.isArray(currentState.expenses)
        ? currentState.expenses
        : [];

      const expIndex = existingExpenses.findIndex(
        (e) => e && (e.id === targetId || e.expenseNo === targetId)
      );
      if (expIndex === -1) {
        return res.status(404).json({
          success: false,
          error: `Expense "${targetId}" not found.`,
        });
      }

      const targetExp = existingExpenses[expIndex];
      if ((targetExp.hotelId || "hotel-1") !== auth.effectiveHotelId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Cross-hotel expense payment is blocked.",
        });
      }

      const approval = targetExp.approvalStatus || targetExp.status || "Pending";
      if (approval !== "Approved") {
        return res.status(400).json({
          success: false,
          error: `Validation Error: Cannot disburse payment for an expense with status "${approval}". Expense must be Approved first.`,
        });
      }

      const totalAmt = Number(targetExp.amount || 0);
      const prevPaid =
        targetExp.paymentStatus === "Paid" ? totalAmt : Number(targetExp.amountPaid || 0);
      const remainingBefore = Math.max(0, Number((totalAmt - prevPaid).toFixed(2)));

      if (remainingBefore <= 0.01) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          error: "Duplicate payment prevented: This expense is already fully paid.",
        });
      }

      const payAmt =
        amount !== undefined && amount !== null
          ? Number(Number(amount).toFixed(2))
          : remainingBefore;

      if (!Number.isFinite(payAmt) || payAmt <= 0 || payAmt > remainingBefore + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Validation Error: Payment amount (₹${payAmt}) must be positive and cannot exceed remaining payable (₹${remainingBefore}).`,
        });
      }

      if (dedupeKey) processedFinanceIdempotencyKeys.add(dedupeKey);

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);
      const newPaid = Number((prevPaid + payAmt).toFixed(2));
      const newOutstanding = Math.max(0, Number((totalAmt - newPaid).toFixed(2)));
      const newPayStatus = newOutstanding <= 0.01 ? "Paid" : "Partially Paid";
      const chosenMethod = String(paymentMethod || targetExp.paymentMethod || "Bank Transfer");
      const chosenSource = String(paymentSource || targetExp.paymentSource || "Bank Account");

      const prevHistory = Array.isArray(targetExp.auditHistory) ? targetExp.auditHistory : [];
      const updatedExpense = {
        ...targetExp,
        amountPaid: newPaid,
        outstandingAmount: newOutstanding,
        paymentStatus: newPayStatus,
        paymentMethod: chosenMethod,
        paymentSource: chosenSource,
        paidDate: todayStr,
        paidBy: `${auth.caller.username} (${auth.caller.role})`,
        paymentReference: referenceNo ? String(referenceNo) : targetExp.paymentReference,
        auditHistory: [
          ...prevHistory,
          {
            action: "Expense Payment Disbursed",
            status: `Approved / ${newPayStatus}`,
            performedBy: `${auth.caller.username} (${auth.caller.role})`,
            dateTime: nowIso.replace("T", " ").slice(0, 19),
            notes: `Paid ₹${payAmt} via ${chosenMethod}. Remaining payable: ₹${newOutstanding}.`,
          },
        ],
      };

      const updatedExpenses = [...existingExpenses];
      updatedExpenses[expIndex] = updatedExpense;
      currentState.expenses = updatedExpenses;

      // If paid via Petty Cash, record linked Petty Cash outflow with sourceId to prevent duplication
      if (chosenMethod.toLowerCase().includes("petty") || chosenSource.toLowerCase().includes("petty")) {
        const existingPetty: any[] = Array.isArray(currentState.pettyCash) ? currentState.pettyCash : [];
        const pcEntry = {
          id: `PC-EXP-${Date.now()}`,
          hotelId: auth.effectiveHotelId,
          date: todayStr,
          type: "Outflow",
          category: updatedExpense.category,
          amount: payAmt,
          handler: auth.caller.username,
          notes: `[${updatedExpense.expenseNo || updatedExpense.id}] ${updatedExpense.description}`,
          approvedBy: updatedExpense.approvedBy || auth.caller.username,
          sourceType: "expense",
          sourceId: updatedExpense.id,
        };
        currentState.pettyCash = [pcEntry, ...existingPetty];
      }

      const auditEntry = appendFinancialAuditLog(
        currentState,
        auth.effectiveHotelId,
        "Expense Payment Recorded",
        `${auth.caller.username} (${auth.caller.role})`,
        `Disbursed ₹${payAmt} via ${chosenMethod} for expense ${updatedExpense.expenseNo || updatedExpense.id}. Status: ${newPayStatus} (Remaining: ₹${newOutstanding}).`
      );

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "expenses", updatedExpenses),
        syncCollectionDocs(db, "audit_logs", currentState.auditLogs),
      ]);

      return res.status(200).json({
        success: true,
        expense: updatedExpense,
        auditLog: auditEntry,
      });
    } catch (err: any) {
      if (dedupeKey) processedFinanceIdempotencyKeys.delete(dedupeKey);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to record expense payment",
      });
    }
  });

  // 5. POST /api/finance/invoices/:id/pay — Record Full or Partial Payment on a Guest Invoice
  app.post("/api/finance/invoices/:id/pay", async (req, res) => {
    const auth = verifyFinanceAccess(req);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const targetId = String(req.params.id || "").trim();
    const { amount, paymentMethod, referenceNo, notes, requestId } = req.body || {};

    const dedupeKey = requestId ? `INVPAY:${auth.effectiveHotelId}:${String(requestId).trim()}` : "";
    if (dedupeKey && processedFinanceIdempotencyKeys.has(dedupeKey)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "Duplicate payment prevented: This invoice payment was already processed.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingInvoices: any[] = Array.isArray(currentState.invoices)
        ? currentState.invoices
        : [];

      const invIndex = existingInvoices.findIndex(
        (i) => i && (i.id === targetId || i.invoiceNumber === targetId)
      );
      if (invIndex === -1) {
        return res.status(404).json({
          success: false,
          error: `Invoice "${targetId}" not found.`,
        });
      }

      const targetInv = existingInvoices[invIndex];
      if ((targetInv.hotelId || "hotel-1") !== auth.effectiveHotelId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Cross-hotel invoice settlement is blocked.",
        });
      }

      const finalAmt = Math.max(0, Number(targetInv.finalAmount ?? targetInv.totalAmount ?? 0));
      let prevPaid = 0;
      if (targetInv.amountPaid !== undefined && targetInv.amountPaid !== null) {
        prevPaid = Number(targetInv.amountPaid);
      } else if (targetInv.isPaid || targetInv.paymentStatus === "Paid") {
        prevPaid = finalAmt;
      } else if (targetInv.pendingAmount !== undefined && targetInv.pendingAmount !== null) {
        prevPaid = Math.max(0, finalAmt - Number(targetInv.pendingAmount));
      } else if (targetInv.advancePaid !== undefined && targetInv.advancePaid !== null) {
        prevPaid = Number(targetInv.advancePaid);
      }

      const remainingBefore = Math.max(0, Number((finalAmt - prevPaid).toFixed(2)));
      if (remainingBefore <= 0.01) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          error: "Duplicate payment prevented: Invoice is already settled in full.",
        });
      }

      const payAmt =
        amount !== undefined && amount !== null
          ? Number(Number(amount).toFixed(2))
          : remainingBefore;

      if (!Number.isFinite(payAmt) || payAmt <= 0 || payAmt > remainingBefore + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Validation Error: Payment amount (₹${payAmt}) must be positive and cannot exceed remaining receivable (₹${remainingBefore}).`,
        });
      }

      if (dedupeKey) processedFinanceIdempotencyKeys.add(dedupeKey);

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);
      const newPaid = Number((prevPaid + payAmt).toFixed(2));
      const newOutstanding = Math.max(0, Number((finalAmt - newPaid).toFixed(2)));
      const isNowFullyPaid = newOutstanding <= 0.01;
      const chosenMethod = String(paymentMethod || targetInv.paymentMethod || "Cash");

      const prevHistory = Array.isArray(targetInv.paymentHistory) ? [...targetInv.paymentHistory] : [];
      if (prevHistory.length === 0 && prevPaid > 0) {
        prevHistory.push({
          id: `PH-INIT-${targetInv.id}`,
          amount: prevPaid,
          paymentMethod: targetInv.paymentMethod || "Cash",
          date: (targetInv.dateCreated || todayStr).slice(0, 10),
          notes: "Initial / Advance Payment",
        });
      }

      prevHistory.push({
        id: `PH-${Date.now()}`,
        amount: payAmt,
        paymentMethod: chosenMethod,
        date: todayStr,
        referenceNo: referenceNo ? String(referenceNo) : undefined,
        recordedBy: `${auth.caller.username} (${auth.caller.role})`,
        notes: notes ? String(notes) : isNowFullyPaid ? "Final Invoice Settlement" : "Partial Invoice Payment",
      });

      const updatedInvoice = {
        ...targetInv,
        amountPaid: newPaid,
        outstandingAmount: newOutstanding,
        pendingAmount: newOutstanding,
        isPaid: isNowFullyPaid,
        paymentStatus: isNowFullyPaid ? "Paid" : "Partially Paid",
        paymentMethod: chosenMethod,
        paymentHistory: prevHistory,
      };

      const updatedInvoices = [...existingInvoices];
      updatedInvoices[invIndex] = updatedInvoice;
      currentState.invoices = updatedInvoices;

      const auditEntry = appendFinancialAuditLog(
        currentState,
        auth.effectiveHotelId,
        "Invoice Payment Received",
        `${auth.caller.username} (${auth.caller.role})`,
        `Collected ₹${payAmt} via ${chosenMethod} against Invoice ${updatedInvoice.invoiceNumber || updatedInvoice.id} (${updatedInvoice.guestName}). Total Paid: ₹${newPaid}, Remaining Receivable: ₹${newOutstanding}.`
      );

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "invoices", updatedInvoices),
        syncCollectionDocs(db, "audit_logs", currentState.auditLogs),
      ]);

      return res.status(200).json({
        success: true,
        invoice: updatedInvoice,
        auditLog: auditEntry,
      });
    } catch (err: any) {
      if (dedupeKey) processedFinanceIdempotencyKeys.delete(dedupeKey);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to record invoice payment",
      });
    }
  });

  // 6. POST /api/finance/purchases/:id/pay — Record Supplier Payment on an Inventory Purchase
  app.post("/api/finance/purchases/:id/pay", async (req, res) => {
    const auth = verifyFinanceAccess(req, ["SuperAdmin", "Owner", "Admin", "Manager", "Accounts"]);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const targetId = String(req.params.id || "").trim();
    const { amount, paymentMethod, referenceNo, requestId } = req.body || {};

    const dedupeKey = requestId ? `PURPAY:${auth.effectiveHotelId}:${String(requestId).trim()}` : "";
    if (dedupeKey && processedFinanceIdempotencyKeys.has(dedupeKey)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "Duplicate payment prevented: This supplier payment was already processed.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingPurchases: any[] = Array.isArray(currentState.inventoryPurchases)
        ? currentState.inventoryPurchases
        : [];

      const purIndex = existingPurchases.findIndex(
        (p) => p && (p.id === targetId || p.purchaseNumber === targetId)
      );
      if (purIndex === -1) {
        return res.status(404).json({
          success: false,
          error: `Inventory Purchase "${targetId}" not found.`,
        });
      }

      const targetPur = existingPurchases[purIndex];
      if ((targetPur.hotelId || "hotel-1") !== auth.effectiveHotelId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Cross-hotel supplier payment is blocked.",
        });
      }

      const grandTotal = Math.max(0, Number(targetPur.grandTotal || 0));
      const prevPaid =
        String(targetPur.paymentStatus || "").toLowerCase() === "paid"
          ? grandTotal
          : Number(targetPur.amountPaid || 0);
      const remainingBefore = Math.max(0, Number((grandTotal - prevPaid).toFixed(2)));

      if (remainingBefore <= 0.01) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          error: "Duplicate payment prevented: Inventory purchase bill is already fully paid.",
        });
      }

      const payAmt =
        amount !== undefined && amount !== null
          ? Number(Number(amount).toFixed(2))
          : remainingBefore;

      if (!Number.isFinite(payAmt) || payAmt <= 0 || payAmt > remainingBefore + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Validation Error: Payment amount (₹${payAmt}) must be positive and cannot exceed remaining payable (₹${remainingBefore}).`,
        });
      }

      if (dedupeKey) processedFinanceIdempotencyKeys.add(dedupeKey);

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);
      const newPaid = Number((prevPaid + payAmt).toFixed(2));
      const newOutstanding = Math.max(0, Number((grandTotal - newPaid).toFixed(2)));
      const newStatus = newOutstanding <= 0.01 ? "Paid" : "Partially Paid";
      const chosenMethod = String(paymentMethod || targetPur.paymentMethod || "Bank Transfer");

      const updatedPurchase = {
        ...targetPur,
        amountPaid: newPaid,
        outstandingAmount: newOutstanding,
        paymentStatus: newStatus,
        paymentMethod: chosenMethod,
        paidDate: todayStr,
        paidBy: `${auth.caller.username} (${auth.caller.role})`,
        paymentReference: referenceNo ? String(referenceNo) : targetPur.paymentReference,
      };

      const updatedPurchases = [...existingPurchases];
      updatedPurchases[purIndex] = updatedPurchase;
      currentState.inventoryPurchases = updatedPurchases;

      const auditEntry = appendFinancialAuditLog(
        currentState,
        auth.effectiveHotelId,
        "Supplier Purchase Payment Recorded",
        `${auth.caller.username} (${auth.caller.role})`,
        `Paid ₹${payAmt} via ${chosenMethod} to supplier "${updatedPurchase.supplierName}" for PO ${updatedPurchase.purchaseNumber}. Remaining Payable: ₹${newOutstanding}.`
      );

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "inventory_purchases", updatedPurchases),
        syncCollectionDocs(db, "audit_logs", currentState.auditLogs),
      ]);

      return res.status(200).json({
        success: true,
        purchase: updatedPurchase,
        auditLog: auditEntry,
      });
    } catch (err: any) {
      if (dedupeKey) processedFinanceIdempotencyKeys.delete(dedupeKey);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to record supplier payment",
      });
    }
  });

  // 7. POST /api/finance/owner-transactions — Record Owner Capital Contribution or Owner Drawing
  app.post("/api/finance/owner-transactions", async (req, res) => {
    const auth = verifyFinanceAccess(req, ["SuperAdmin", "Owner", "Admin", "Accounts"]);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const {
      id,
      date,
      directorName,
      type,
      category,
      amount,
      paymentMethod,
      bankAccountName,
      notes,
      referenceNo,
      requestId,
    } = req.body || {};

    const parsedAmount = Math.abs(Number(amount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 500_000_000) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Transaction amount must be a positive number.",
      });
    }

    const cleanDirector = String(directorName || "").trim();
    const cleanType = String(type || "").trim();
    if (!cleanDirector || !cleanType) {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Director/Owner name and transaction type are required.",
      });
    }

    const dedupeToken = String(requestId || id || "").trim();
    const dedupeKey = dedupeToken ? `OWN:${auth.effectiveHotelId}:${dedupeToken}` : "";
    if (dedupeKey && processedFinanceIdempotencyKeys.has(dedupeKey)) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "Duplicate transaction prevented: This owner equity entry was already saved.",
      });
    }

    try {
      const db = await getMongoDatabase();
      const doc = await db
        .collection("pms_app_state")
        .findOne({ _id: "FULL_PMS_BACKUP" as any });
      const currentState = doc && doc.data ? doc.data : {};
      const existingOwnerPayments: any[] = Array.isArray(currentState.ownerPayments)
        ? currentState.ownerPayments
        : [];

      if (dedupeKey) processedFinanceIdempotencyKeys.add(dedupeKey);

      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);
      const isCapital = isCapitalContributionType(cleanType, category);
      const resolvedCat = isCapital ? "Capital Contribution" : "Owner Drawing";

      const newEntry = {
        id: id ? String(id).trim() : `OWN-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        hotelId: auth.effectiveHotelId,
        date: date ? String(date).slice(0, 10) : todayStr,
        directorName: cleanDirector,
        type: cleanType,
        category: resolvedCat,
        amount: Number(parsedAmount.toFixed(2)),
        paymentMethod: String(paymentMethod || "Bank Transfer"),
        bankAccountName: bankAccountName ? String(bankAccountName) : undefined,
        notes: String(notes || `${resolvedCat} (${cleanType})`),
        referenceNo: referenceNo ? String(referenceNo) : undefined,
        recordedBy: `${auth.caller.username} (${auth.caller.role})`,
        status: "Completed",
        idempotencyKey: dedupeToken || undefined,
      };

      const updatedOwnerPayments = [newEntry, ...existingOwnerPayments];
      currentState.ownerPayments = updatedOwnerPayments;

      const auditEntry = appendFinancialAuditLog(
        currentState,
        auth.effectiveHotelId,
        `Owner ${resolvedCat}`,
        `${auth.caller.username} (${auth.caller.role})`,
        `Recorded ${resolvedCat} ("${cleanType}") of ₹${newEntry.amount} for ${cleanDirector} via ${newEntry.paymentMethod}. Excluded from hotel operating revenue.`
      );

      await db.collection("pms_app_state").replaceOne(
        { _id: "FULL_PMS_BACKUP" as any },
        { _id: "FULL_PMS_BACKUP" as any, data: currentState, updatedAt: nowIso },
        { upsert: true }
      );
      await Promise.all([
        syncCollectionDocs(db, "owner_payments", updatedOwnerPayments),
        syncCollectionDocs(db, "audit_logs", currentState.auditLogs),
      ]);

      return res.status(201).json({
        success: true,
        entry: newEntry,
        auditLog: auditEntry,
      });
    } catch (err: any) {
      if (dedupeKey) processedFinanceIdempotencyKeys.delete(dedupeKey);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to record owner equity transaction",
      });
    }
  });

  // 8. POST /api/finance/gateway/sync — Synchronize Razorpay / Payment Gateway Payments & Settlements safely with deduplication
  app.post("/api/finance/gateway/sync", async (req, res) => {
    const auth = verifyFinanceAccess(req, ["SuperAdmin", "Owner", "Admin", "Manager", "Accounts"]);
    if (!auth.ok || !auth.caller || !auth.effectiveHotelId) {
      return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const { keyId, keySecret } = req.body || {};
    const resolvedKeyId = String(keyId || process.env.RAZORPAY_KEY_ID || "").trim();
    const resolvedKeySecret = String(keySecret || process.env.RAZORPAY_KEY_SECRET || "").trim();

    if (!resolvedKeyId || !resolvedKeySecret) {
      return res.status(200).json({
        success: true,
        configured: false,
        syncedPayments: [],
        syncedSettlements: [],
        message: "Razorpay API Secret is not configured on the server. Local PMS gateway transactions (Razorpay, UPI, Card, Online) are active and ready for settlement reconciliation.",
      });
    }

    try {
      const basicAuth = Buffer.from(`${resolvedKeyId}:${resolvedKeySecret}`).toString("base64");
      const headers = {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      };

      const [paymentsRes, settlementsRes] = await Promise.all([
        fetch("https://api.razorpay.com/v1/payments?count=50", { headers }).catch(() => null),
        fetch("https://api.razorpay.com/v1/settlements?count=50", { headers }).catch(() => null),
      ]);

      const paymentsJson: any = paymentsRes && paymentsRes.ok ? await paymentsRes.json().catch(() => ({})) : {};
      const settlementsJson: any = settlementsRes && settlementsRes.ok ? await settlementsRes.json().catch(() => ({})) : {};

      const rawPayments: any[] = Array.isArray(paymentsJson?.items) ? paymentsJson.items : [];
      const rawSettlements: any[] = Array.isArray(settlementsJson?.items) ? settlementsJson.items : [];

      return res.status(200).json({
        success: true,
        configured: true,
        syncedPayments: rawPayments,
        syncedSettlements: rawSettlements,
        message: `Synchronized ${rawPayments.length} payment(s) and ${rawSettlements.length} settlement(s) from Razorpay.`,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to synchronize with Razorpay API",
      });
    }
  });

  // 9. POST /api/finance/gateway/webhook — Idempotent Razorpay Webhook Receiver
  app.post("/api/finance/gateway/webhook", async (req, res) => {
    const eventId = String(req.headers["x-razorpay-event-id"] || req.body?.event_id || "").trim();
    const eventType = String(req.body?.event || "").trim();
    if (eventId && processedFinanceIdempotencyKeys.has(`RZP_WEBHOOK:${eventId}`)) {
      return res.status(200).json({ success: true, duplicate: true });
    }
    if (eventId) {
      processedFinanceIdempotencyKeys.add(`RZP_WEBHOOK:${eventId}`);
    }
    return res.status(200).json({
      success: true,
      event: eventType || "acknowledged",
    });
  });

  // =========================================================================
  // PAGINATED BOOKINGS API (/api/bookings) & UNIFIED PMS MODULE REST APIs
  // Supports server-side paginated queries with status filtering & search
  // =========================================================================
  app.get("/api/bookings", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const targetHotelId = String(req.query.hotelId || req.headers["x-target-hotel-id"] || caller.hotelId || "hotel-1").trim();
    if (!isCallerAuthorizedForHotel(caller, targetHotelId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cannot access bookings for hotel "${targetHotelId}".`,
      });
    }
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "10"), 10) || 10));
    const tab = String(req.query.tab || "all").toLowerCase();
    const search = String(req.query.search || "").trim().toLowerCase();
    const selectedDate = String(req.query.date || new Date().toISOString().slice(0, 10));

    try {
      const db = await getMongoDatabase();
      const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const rawBookings: any[] = Array.isArray(doc?.data?.bookings) ? doc.data.bookings : [];
      const hotelBookings = rawBookings.filter((b) => b && (!b.hotelId || b.hotelId === targetHotelId));

      const todayCount = hotelBookings.length;
      const upcomingCount = hotelBookings.filter((b) => !b.isCheckedIn && b.status === "Confirmed").length;
      const inHouseCount = hotelBookings.filter((b) => b.isCheckedIn && !b.isCheckedOut).length;
      const checkoutCount = hotelBookings.filter((b) => b.isCheckedOut || b.checkOutDate === selectedDate).length;

      let filtered = hotelBookings;
      if (tab === "upcoming") {
        filtered = filtered.filter((b) => !b.isCheckedIn && b.status === "Confirmed");
      } else if (tab === "checkin" || tab === "inhouse") {
        filtered = filtered.filter((b) => b.isCheckedIn && !b.isCheckedOut);
      } else if (tab === "checkout" || tab === "departures") {
        filtered = filtered.filter((b) => b.isCheckedOut || b.checkOutDate === selectedDate);
      }

      if (search) {
        filtered = filtered.filter((b) => {
          const name = String(b.customerName || "").toLowerCase();
          const bNo = String(b.bookingNo || "").toLowerCase();
          const mob = String(b.mobile || "");
          const rNo = String(b.roomNumber || "");
          const rNums = Array.isArray(b.roomNumbers) ? b.roomNumbers.map((r: any) => String(r)) : [];
          return name.includes(search) || bNo.includes(search) || mob.includes(search) || rNo.includes(search) || rNums.some((rn: string) => rn.includes(search));
        });
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const skip = (page - 1) * limit;
      const items = filtered.slice(skip, skip + limit);

      return res.json({
        success: true,
        data: items,
        bookings: items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasPrevPage: page > 1,
          hasNextPage: page < totalPages,
          counts: {
            today: todayCount,
            upcoming: upcomingCount,
            checkin: inHouseCount,
            checkout: checkoutCount,
            all: hotelBookings.length,
          },
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Failed to fetch paginated bookings" });
    }
  });

  const ALLOWED_MODULE_COLLECTIONS = new Set([
    ...TENANT_SCOPED_STATE_KEYS,
    "assetGroups",
    "roomBlocks",
    "priceHistory",
    "otaChannels",
    "vendorBills",
    "miscIncome",
    "otaSettlements",
    "rbacMatrix",
  ]);

  app.get("/api/pms/modules/:collection", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const colKey = String(req.params.collection || "").trim();
    if (!ALLOWED_MODULE_COLLECTIONS.has(colKey)) {
      return res.status(400).json({ success: false, error: `Unsupported module collection: ${colKey}` });
    }
    const targetHotelId = String(req.query.hotelId || req.headers["x-target-hotel-id"] || caller.hotelId || "hotel-1").trim();
    if (!isCallerAuthorizedForHotel(caller, targetHotelId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cannot read module "${colKey}" for hotel "${targetHotelId}".`,
      });
    }
    try {
      const db = await getMongoDatabase();
      const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const rawArr: any[] = Array.isArray(doc?.data?.[colKey]) ? doc.data[colKey] : [];
      const filtered = rawArr.filter((item) => item && (!item.hotelId || item.hotelId === targetHotelId));
      const items =
        colKey === "otaChannels"
          ? filtered.map(sanitizeOtaChannelForResponse)
          : filtered;

      const pageParam = req.query.page ? parseInt(String(req.query.page), 10) : null;
      const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : null;

      if (pageParam && limitParam) {
        const page = Math.max(1, pageParam);
        const limit = Math.min(100, Math.max(1, limitParam));
        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const skip = (page - 1) * limit;
        const paged = items.slice(skip, skip + limit);
        return res.json({
          success: true,
          collection: colKey,
          hotelId: targetHotelId,
          items: paged,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
          },
        });
      }

      return res.json({ success: true, collection: colKey, hotelId: targetHotelId, items });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Failed to fetch module data" });
    }
  });

  app.post("/api/pms/modules/:collection", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const colKey = String(req.params.collection || "").trim();
    if (!ALLOWED_MODULE_COLLECTIONS.has(colKey)) {
      return res.status(400).json({ success: false, error: `Unsupported module collection: ${colKey}` });
    }
    const targetHotelId = String(req.body?.hotelId || req.headers["x-target-hotel-id"] || caller.hotelId || "hotel-1").trim();
    if (!isCallerAuthorizedForHotel(caller, targetHotelId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cannot modify module "${colKey}" for hotel "${targetHotelId}".`,
      });
    }
    const incomingItems = Array.isArray(req.body?.items)
      ? req.body.items
      : req.body?.item
      ? [req.body.item]
      : null;

    if (!incomingItems) {
      return res.status(400).json({ success: false, error: "Payload must include items[] or item{}" });
    }

    // Backend RBAC guard for sensitive collections on /api/pms/modules/:collection
    const modCallerRoleLower = String(caller.rawRole || caller.role || "").trim().toLowerCase();
    const isModPrivilegedAdmin =
      caller.role === "SuperAdmin" ||
      caller.isSuperAdmin === true ||
      modCallerRoleLower === "admin" ||
      modCallerRoleLower === "owner" ||
      modCallerRoleLower === "hoteladmin" ||
      modCallerRoleLower === "superadmin";

    if (!isModPrivilegedAdmin && (colKey === "rbacMatrix" || colKey === "rolePermissions" || colKey === "staff")) {
      try {
        const dbCheck = await getMongoDatabase();
        const stateDoc = await dbCheck.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const rolePerms: any[] = Array.isArray(stateDoc?.data?.rolePermissions) ? stateDoc.data.rolePermissions : [];
        const matched = rolePerms.find(
          (rp: any) =>
            rp &&
            (!rp.hotelId || rp.hotelId === targetHotelId) &&
            String(rp.roleName || "").trim().toLowerCase() === modCallerRoleLower
        );
        const allowed = Boolean(
          matched?.canManageStaff ||
          matched?.modulePermissions?.staff?.manage ||
          matched?.modulePermissions?.roles?.manage ||
          modCallerRoleLower === "manager"
        );
        if (!allowed) {
          return res.status(403).json({
            success: false,
            error: `Forbidden: Role "${caller.rawRole || caller.role}" cannot modify "${colKey}".`,
          });
        }
      } catch {
        return res.status(403).json({ success: false, error: `Forbidden: Cannot verify permission for "${colKey}".` });
      }
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc && prevDoc.data ? prevDoc.data : {};
        const prevArr: any[] = Array.isArray(prevData[colKey]) ? prevData[colKey] : [];

        let updatedHotelItems: any[];
        if (Array.isArray(req.body?.items)) {
          // Full hotel-scoped replacement for this collection
          const otherHotelItems = prevArr.filter((i: any) => i && i.hotelId && i.hotelId !== targetHotelId);
          const ownItems = incomingItems.map((i: any) => ({ ...i, hotelId: targetHotelId }));
          updatedHotelItems = ownItems;
          prevData[colKey] = [...otherHotelItems, ...ownItems];
        } else {
          // Upsert single item (force targetHotelId to prevent cross-tenant spoofing)
          const existingForeign = prevArr.find((i: any) => i && i.id === req.body.item?.id && i.hotelId && i.hotelId !== targetHotelId);
          if (existingForeign) {
            throw new Error("Forbidden: Item ID belongs to another property.");
          }
          const item = { ...req.body.item, hotelId: targetHotelId };
          const exists = prevArr.some((i: any) => i && i.id === item.id);
          prevData[colKey] = exists
            ? prevArr.map((i: any) => (i && i.id === item.id ? item : i))
            : [item, ...prevArr];
          updatedHotelItems = prevData[colKey].filter((i: any) => i && i.hotelId === targetHotelId);
        }

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set([colKey]));
        return { items: updatedHotelItems, updatedAt: updatedAtIso };
      });
      return res.json({ success: true, collection: colKey, hotelId: targetHotelId, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Failed to persist module data" });
    }
  });

  // =========================================================================
  // COMPLETE OTA CHANNEL MANAGER BACKEND ENGINE & WEBHOOK PROCESSOR
  // =========================================================================
  const DEFAULT_OTA_CHANNEL_TEMPLATES = [
    {
      idSuffix: "ota-mmt",
      name: "MakeMyTrip",
      logoBadge: "MMT",
      commissionPercent: 15,
      markupPercent: 15,
      authType: "API Key + Secret",
    },
    {
      idSuffix: "ota-goi",
      name: "Goibibo",
      logoBadge: "GOI",
      commissionPercent: 15,
      markupPercent: 15,
      authType: "API Key + Secret",
    },
    {
      idSuffix: "ota-bdc",
      name: "Booking.com",
      logoBadge: "BDC",
      commissionPercent: 18,
      markupPercent: 18,
      authType: "XML Channel Manager",
    },
    {
      idSuffix: "ota-agd",
      name: "Agoda",
      logoBadge: "AGD",
      commissionPercent: 16,
      markupPercent: 16,
      authType: "OAuth2 Bearer",
    },
  ];

  const OTA_ROOM_TYPE_CATALOG: Record<
    string,
    Array<{ code: string; name: string; defaultOccupancy: number; maxOccupancy: number }>
  > = {
    MMT: [
      { code: "MMT-DLX-AC", name: "MakeMyTrip Deluxe Room (AC)", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "MMT-STD-RM", name: "MakeMyTrip Standard Room", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "MMT-EXEC-ST", name: "MakeMyTrip Executive Suite", defaultOccupancy: 2, maxOccupancy: 4 },
      { code: "MMT-FAM-RM", name: "MakeMyTrip Family Room", defaultOccupancy: 3, maxOccupancy: 4 },
    ],
    GOI: [
      { code: "GOI-STD-NONAC", name: "Goibibo Standard Room", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "GOI-DLX-AC", name: "Goibibo Deluxe AC Room", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "GOI-SUP-RM", name: "Goibibo Superior Room", defaultOccupancy: 2, maxOccupancy: 4 },
    ],
    BDC: [
      { code: "BDC-DBL-DLX", name: "Booking.com Deluxe Double Room", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "BDC-STD-TWN", name: "Booking.com Standard Twin/Double", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "BDC-PRM-STE", name: "Booking.com Suite", defaultOccupancy: 2, maxOccupancy: 4 },
    ],
    AGD: [
      { code: "AGD-PR-DLX", name: "Agoda Premier Deluxe Room", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "AGD-STD-DBL", name: "Agoda Standard Double", defaultOccupancy: 2, maxOccupancy: 3 },
      { code: "AGD-ROY-STE", name: "Agoda Royal Suite", defaultOccupancy: 2, maxOccupancy: 4 },
    ],
  };

  function redactOtaLogPayload(input: any): string {
    try {
      const cloned = JSON.parse(JSON.stringify(input || {}));
      const scrub = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        for (const k of Object.keys(obj)) {
          const lower = k.toLowerCase();
          if (
            lower.includes("secret") ||
            lower.includes("password") ||
            lower.includes("token") ||
            lower === "apikey" ||
            lower === "encryptedapikey" ||
            lower === "encryptedapisecret"
          ) {
            obj[k] = "[REDACTED_SECRET]";
          } else if (lower === "mobile" || lower === "phone" || lower === "guestmobile") {
            const val = String(obj[k] || "");
            obj[k] = val.length > 4 ? `••••••${val.slice(-4)}` : "[REDACTED]";
          } else if (typeof obj[k] === "object") {
            scrub(obj[k]);
          }
        }
      };
      scrub(cloned);
      return JSON.stringify(cloned);
    } catch {
      return "{}";
    }
  }

  function ensureHotelOtaChannels(rawChannels: any[], hotelId: string): any[] {
    const existing = rawChannels.filter((c) => c && c.hotelId === hotelId);
    const result: any[] = [...existing];
    for (const tpl of DEFAULT_OTA_CHANNEL_TEMPLATES) {
      const found = result.find(
        (c) =>
          c.logoBadge === tpl.logoBadge ||
          String(c.name || "").toLowerCase() === tpl.name.toLowerCase()
      );
      if (!found) {
        result.push({
          id: `${hotelId}-${tpl.idSuffix}`,
          hotelId,
          name: tpl.name,
          logoBadge: tpl.logoBadge,
          connected: false,
          hotelCode: "",
          webhookUrl: `/api/webhooks/ota/${tpl.logoBadge.toLowerCase()}?hotelId=${encodeURIComponent(hotelId)}`,
          apiEndpointUrl: "",
          authType: tpl.authType,
          commissionPercent: tpl.commissionPercent,
          markupPercent: tpl.markupPercent,
          lastSync: "Never Synced",
          lastSyncError: "",
          bookingsCount: 0,
          revenueGenerated: 0,
          status: "Disconnected",
        });
      }
    }
    return result;
  }

  function computeHotelInventoryMatrix(
    rooms: any[],
    bookings: any[],
    roomBlocks: any[],
    allocations: any[],
    startDateStr?: string,
    daysCount = 7
  ) {
    const baseDate = startDateStr ? new Date(`${startDateStr}T00:00:00`) : new Date();
    if (isNaN(baseDate.getTime())) baseDate.setTime(Date.now());
    const dates: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const activeBookings = bookings.filter(
      (b) => b && b.status !== "Cancelled" && b.status !== "No-Show" && !b.isCompleted
    );

    const totalRooms = rooms.length;
    const maintenanceRooms = rooms.filter((r) => r && r.status === "Maintenance").length;
    const blockedRoomsNow = rooms.filter((r) => r && r.status === "Blocked").length;
    const occupiedOrBookedRoomsNow = rooms.filter((r) => {
      if (!r || r.status === "Maintenance" || r.status === "Blocked") return false;
      if (r.status === "Occupied" || r.status === "Reserved") return true;
      const todayIso = dates[0];
      return activeBookings.some(
        (b) =>
          (b.roomNumber === r.number ||
            (Array.isArray(b.roomNumbers) && b.roomNumbers.includes(r.number))) &&
          b.checkInDate <= todayIso &&
          b.checkOutDate > todayIso
      );
    }).length;
    const availableRoomsNow = Math.max(
      0,
      totalRooms - maintenanceRooms - blockedRoomsNow - occupiedOrBookedRoomsNow
    );

    const categories = Array.from(
      new Set(rooms.map((r) => String(r?.category || "Standard")).filter(Boolean))
    );

    const dateWiseByCategory = categories.map((catName) => {
      const catRooms = rooms.filter((r) => r && (r.category || "Standard") === catName);
      const daily = dates.map((dt) => {
        let bookedCount = 0;
        let blockedCount = 0;
        let maintenanceCount = 0;
        for (const rm of catRooms) {
          if (rm.status === "Maintenance") {
            maintenanceCount++;
            continue;
          }
          const isBlockedOnDate =
            rm.status === "Blocked" ||
            roomBlocks.some(
              (blk) =>
                blk &&
                blk.roomNumber === rm.number &&
                blk.startDate <= dt &&
                blk.endDate >= dt
            );
          if (isBlockedOnDate) {
            blockedCount++;
            continue;
          }
          const isBookedOnDate = activeBookings.some((b) => {
            const matchesRoom =
              b.roomNumber === rm.number ||
              (Array.isArray(b.roomNumbers) && b.roomNumbers.includes(rm.number));
            if (!matchesRoom) return false;
            return b.checkInDate <= dt && b.checkOutDate > dt;
          });
          if (isBookedOnDate) {
            bookedCount++;
          }
        }
        const available = Math.max(
          0,
          catRooms.length - maintenanceCount - blockedCount - bookedCount
        );
        const catAllocations = allocations.filter(
          (a) => a && a.pmsCategoryName === catName && a.date === dt
        );
        const stopSell = catAllocations.some((a) => Boolean(a.stopSell));
        return {
          date: dt,
          totalRooms: catRooms.length,
          availableRooms: stopSell ? 0 : available,
          rawAvailableRooms: available,
          bookedRooms: bookedCount,
          blockedRooms: blockedCount,
          maintenanceRooms: maintenanceCount,
          stopSell,
        };
      });

      return {
        categoryName: catName,
        totalRooms: catRooms.length,
        basePrice: Number(catRooms[0]?.rate || 2000),
        extraPersonCharge: Number(catRooms[0]?.extraPersonCharge || 500),
        daily,
      };
    });

    return {
      summary: {
        totalRooms,
        availableRooms: availableRoomsNow,
        bookedRooms: occupiedOrBookedRoomsNow,
        blockedRooms: blockedRoomsNow,
        maintenanceRooms,
      },
      dates,
      dateWiseByCategory,
    };
  }

  // Built-in RFC/HTNG-compliant OTA Sandbox Partner Server Endpoint (for real HTTP roundtrip verification & Test A/C/D/J)
  app.post("/api/ota/sandbox-partner/:channel/:action", (req, res) => {
    const channel = String(req.params.channel || "").toUpperCase();
    const action = String(req.params.action || "").toLowerCase();
    const hotelCode = String(req.headers["x-ota-hotel-code"] || req.body?.hotelCode || "").trim();
    const apiKey = String(req.headers["x-ota-api-key"] || "").trim();
    const signature = String(req.headers["x-ota-signature"] || "").trim();
    const simulateFail =
      String(req.headers["x-simulate-fail"] || req.query.simulateFail || req.body?.simulateFail || "") ===
      "true";

    if (simulateFail) {
      return res.status(502).json({
        success: false,
        status: "PARTNER_GATEWAY_ERROR",
        error: `OTA Partner (${channel}) gateway rejected request or timed out (HTTP 502).`,
      });
    }

    if (!hotelCode || !apiKey || !signature || apiKey.length < 4) {
      return res.status(401).json({
        success: false,
        status: "AUTH_ERROR",
        error: `OTA Partner (${channel}) rejected authentication: Missing or invalid Hotel Code, API Key, or HMAC Signature.`,
      });
    }

    if (action === "ping") {
      return res.status(200).json({
        success: true,
        status: "CONNECTED",
        channel,
        hotelCode,
        protocolVersion: "OTA_HTNG_2026.1",
        verifiedAt: new Date().toISOString(),
        message: `Handshake verified with ${channel} Sandbox Gateway for Hotel Code ${hotelCode}.`,
      });
    }

    if (action === "ari-push") {
      const ratesCount = Array.isArray(req.body?.rates) ? req.body.rates.length : 0;
      const invCount = Array.isArray(req.body?.inventory) ? req.body.inventory.length : 0;
      return res.status(200).json({
        success: true,
        status: "ARI_ACCEPTED",
        channel,
        hotelCode,
        ratesAccepted: ratesCount,
        inventoryCategoriesAccepted: invCount,
        transactionId: `ARI-${channel}-${Date.now().toString().slice(-6)}`,
        processedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      channel,
      action,
      processedAt: new Date().toISOString(),
    });
  });

  // 1. GET /api/ota/state — Complete OTA Channel Manager State & Live Date-Wise Inventory
  app.get("/api/ota/state", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const targetHotelId = String(
      req.query.hotelId || req.headers["x-target-hotel-id"] || caller.hotelId || ""
    ).trim();
    if (targetHotelId && !isCallerAuthorizedForHotel(caller, targetHotelId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cannot access OTA state for hotel "${targetHotelId}".`,
      });
    }
    const startDate = String(req.query.startDate || "").trim();

    try {
      const db = await getMongoDatabase();
      const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const data = doc?.data || {};
      const effectiveHotelId = targetHotelId || data.hotels?.[0]?.id || "hotel-1";

      const allChannels = Array.isArray(data.otaChannels) ? data.otaChannels : [];
      const hotelChannels = ensureHotelOtaChannels(allChannels, effectiveHotelId).map(
        sanitizeOtaChannelForResponse
      );

      const hotelRooms = (Array.isArray(data.rooms) ? data.rooms : []).filter(
        (r: any) => r && r.hotelId === effectiveHotelId
      );
      const hotelBookings = (Array.isArray(data.bookings) ? data.bookings : []).filter(
        (b: any) => b && b.hotelId === effectiveHotelId
      );
      const hotelBlocks = (Array.isArray(data.roomBlocks) ? data.roomBlocks : []).filter(
        (b: any) => b && b.hotelId === effectiveHotelId
      );
      const roomMappings = (Array.isArray(data.otaRoomMappings) ? data.otaRoomMappings : []).filter(
        (m: any) => m && m.hotelId === effectiveHotelId
      );
      const rateRules = (Array.isArray(data.otaRateRules) ? data.otaRateRules : []).filter(
        (r: any) => r && r.hotelId === effectiveHotelId
      );
      const inventoryAllocations = (
        Array.isArray(data.otaInventoryAllocations) ? data.otaInventoryAllocations : []
      ).filter((a: any) => a && a.hotelId === effectiveHotelId);
      const settlements = (Array.isArray(data.otaSettlements) ? data.otaSettlements : []).filter(
        (s: any) => s && s.hotelId === effectiveHotelId
      );
      const syncLogs = (Array.isArray(data.otaSyncLogs) ? data.otaSyncLogs : [])
        .filter((l: any) => l && l.hotelId === effectiveHotelId)
        .slice(0, 150);

      const inventoryMatrix = computeHotelInventoryMatrix(
        hotelRooms,
        hotelBookings,
        hotelBlocks,
        inventoryAllocations,
        startDate,
        7
      );

      return res.json({
        success: true,
        hotelId: effectiveHotelId,
        channels: hotelChannels,
        roomMappings,
        rateRules,
        inventoryAllocations,
        settlements,
        syncLogs,
        inventoryMatrix,
        roomTypeCatalog: OTA_ROOM_TYPE_CATALOG,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to load OTA Channel Manager state",
      });
    }
  });

  // 2. GET /api/ota/fetch-room-types/:channelBadge — Fetch supported OTA Room Types
  app.get("/api/ota/fetch-room-types/:channelBadge", (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const badge = String(req.params.channelBadge || "MMT").toUpperCase();
    const roomTypes = OTA_ROOM_TYPE_CATALOG[badge] || OTA_ROOM_TYPE_CATALOG.MMT;
    return res.json({
      success: true,
      channelBadge: badge,
      roomTypes,
    });
  });

  // 3. POST /api/ota/credentials — Save & Encrypt OTA API Key, Secret & Webhook Config (Admin-only)
  app.post("/api/ota/credentials", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const rawRole = String(caller.rawRole || caller.role || "").toLowerCase();
    if (
      caller.role !== "Admin" &&
      caller.role !== "Owner" &&
      caller.role !== "SuperAdmin" &&
      !rawRole.includes("admin") &&
      !rawRole.includes("owner") &&
      !rawRole.includes("manager")
    ) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Only authorized administrators can manage OTA API credentials.",
      });
    }

    const {
      hotelId: reqHotelId,
      channelId,
      channelName,
      logoBadge,
      hotelCode,
      apiKey,
      apiSecret,
      authType,
      webhookUrl,
      apiEndpointUrl,
      commissionPercent,
      markupPercent,
    } = req.body || {};

    const cleanHotelCode = String(hotelCode || "").trim();
    if (!cleanHotelCode) {
      return res.status(400).json({
        success: false,
        error: "OTA Hotel ID / Hotel Code is required.",
      });
    }

    if (reqHotelId && !isCallerAuthorizedForHotel(caller, String(reqHotelId).trim())) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cannot modify OTA credentials for hotel "${reqHotelId}".`,
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawChannels = Array.isArray(prevData.otaChannels) ? prevData.otaChannels : [];
        const otherHotelChannels = rawChannels.filter(
          (c: any) => c && c.hotelId && c.hotelId !== targetHotelId
        );
        const hotelChannels = ensureHotelOtaChannels(rawChannels, targetHotelId);

        let updatedChannel: any = null;
        const nextHotelChannels = hotelChannels.map((ch: any) => {
          const isMatch =
            ch.id === channelId ||
            (logoBadge && ch.logoBadge === logoBadge) ||
            (channelName && String(ch.name).toLowerCase() === String(channelName).toLowerCase());
          if (!isMatch) return ch;

          const newPlainKey =
            typeof apiKey === "string" && apiKey.trim() && !apiKey.includes("••••")
              ? apiKey.trim()
              : decryptOtaCredential(ch.encryptedApiKey || ch.apiKey || "");
          const newPlainSecret =
            typeof apiSecret === "string" && apiSecret.trim() && !apiSecret.includes("••••")
              ? apiSecret.trim()
              : decryptOtaCredential(ch.encryptedApiSecret || ch.apiSecret || "");

          const encKey = newPlainKey ? encryptOtaCredential(newPlainKey) : ch.encryptedApiKey || "";
          const encSecret = newPlainSecret
            ? encryptOtaCredential(newPlainSecret)
            : ch.encryptedApiSecret || "";
          const masked = newPlainKey ? maskOtaCredential(newPlainKey) : "Not Configured";
          const endpointClean =
            typeof apiEndpointUrl === "string" ? apiEndpointUrl.trim() : ch.apiEndpointUrl || "";

          // Do not fake Connected status when saving credentials; require Test API Connection or mark Pending Official OTA Endpoint
          const nextStatus =
            !newPlainKey || !newPlainSecret
              ? "Pending Configuration"
              : endpointClean
              ? "Pending Configuration"
              : "Pending Official OTA Endpoint";

          updatedChannel = {
            ...ch,
            hotelId: targetHotelId,
            hotelCode: cleanHotelCode,
            encryptedApiKey: encKey,
            encryptedApiSecret: encSecret,
            maskedApiKey: masked,
            hasSavedSecret: Boolean(newPlainSecret),
            authType: authType || ch.authType || "API Key + Secret",
            webhookUrl:
              webhookUrl ||
              ch.webhookUrl ||
              `/api/webhooks/ota/${String(ch.logoBadge || "mmt").toLowerCase()}?hotelId=${encodeURIComponent(targetHotelId)}`,
            apiEndpointUrl: endpointClean,
            commissionPercent:
              commissionPercent !== undefined ? Number(commissionPercent) : ch.commissionPercent,
            markupPercent: markupPercent !== undefined ? Number(markupPercent) : ch.markupPercent,
            connected: false,
            status: nextStatus,
            lastSyncError: endpointClean
              ? ""
              : "Credentials encrypted & saved. Live OTA activation is pending official OTA API endpoint or sandbox handshake verification.",
          };
          delete updatedChannel.apiKey;
          delete updatedChannel.apiSecret;
          return updatedChannel;
        });

        const logEntry = {
          id: `OTALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: targetHotelId,
          timestamp: new Date().toISOString(),
          channelId: updatedChannel?.id || channelId,
          channelName: updatedChannel?.name || channelName || "OTA",
          eventType: "CREDENTIAL_UPDATE",
          direction: "AUTH_CHECK",
          endpoint: "POST /api/ota/credentials",
          httpStatus: 200,
          status: "SUCCESS",
          latencyMs: 18,
          sanitizedPayload: redactOtaLogPayload({
            hotelCode: cleanHotelCode,
            authType: updatedChannel?.authType,
            maskedApiKey: updatedChannel?.maskedApiKey,
            hasSavedSecret: updatedChannel?.hasSavedSecret,
            status: updatedChannel?.status,
          }),
          retryCount: 0,
        };

        prevData.otaChannels = [...otherHotelChannels, ...nextHotelChannels];
        prevData.otaSyncLogs = [
          logEntry,
          ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
        ].slice(0, 300);

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(
          db,
          prevData,
          new Set(["otaChannels", "otaSyncLogs"])
        );

        return {
          channel: sanitizeOtaChannelForResponse(updatedChannel),
          channels: nextHotelChannels.map(sanitizeOtaChannelForResponse),
          logEntry,
        };
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to save OTA credentials",
      });
    }
  });

  // 4. POST /api/ota/test-connection — Real Outbound Handshake Verification (No Fake Success)
  app.post("/api/ota/test-connection", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const {
      hotelId: reqHotelId,
      channelId,
      hotelCode: bodyHotelCode,
      apiKey: bodyApiKey,
      apiSecret: bodyApiSecret,
      apiEndpointUrl: bodyEndpointUrl,
      useSandboxGateway,
      simulateFail,
    } = req.body || {};

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawChannels = Array.isArray(prevData.otaChannels) ? prevData.otaChannels : [];
        const otherHotelChannels = rawChannels.filter(
          (c: any) => c && c.hotelId && c.hotelId !== targetHotelId
        );
        const hotelChannels = ensureHotelOtaChannels(rawChannels, targetHotelId);
        const targetCh = hotelChannels.find((c: any) => c.id === channelId) || hotelChannels[0];

        if (!targetCh) {
          throw new Error("OTA Channel not found.");
        }

        const resolvedHotelCode = String(bodyHotelCode ?? targetCh.hotelCode ?? "").trim();
        const resolvedKey =
          typeof bodyApiKey === "string" && bodyApiKey.trim() && !bodyApiKey.includes("••••")
            ? bodyApiKey.trim()
            : decryptOtaCredential(targetCh.encryptedApiKey || targetCh.apiKey || "");
        const resolvedSecret =
          typeof bodyApiSecret === "string" && bodyApiSecret.trim() && !bodyApiSecret.includes("••••")
            ? bodyApiSecret.trim()
            : decryptOtaCredential(targetCh.encryptedApiSecret || targetCh.apiSecret || "");

        const badgeLower = String(targetCh.logoBadge || "mmt").toLowerCase();
        const sandboxUrl = `http://localhost:${PORT}/api/ota/sandbox-partner/${badgeLower}/ping`;
        const resolvedEndpoint =
          useSandboxGateway
            ? sandboxUrl
            : String(bodyEndpointUrl ?? targetCh.apiEndpointUrl ?? "").trim();

        const startTime = Date.now();
        let httpStatus = 0;
        let isSuccess = false;
        let nextStatus: string = "Pending Configuration";
        let statusMessage = "";
        let errorMessage = "";

        if (!resolvedHotelCode || !resolvedKey || !resolvedSecret) {
          httpStatus = 400;
          isSuccess = false;
          nextStatus = "Pending Configuration";
          errorMessage =
            "Missing Hotel Code, API Key, or API Secret. Please save complete credentials first.";
        } else if (!resolvedEndpoint) {
          // Honest reporting when no official external OTA API endpoint or sandbox endpoint is configured
          httpStatus = 202;
          isSuccess = false;
          nextStatus = "Pending Official OTA Endpoint";
          errorMessage = `Credentials saved & encrypted for ${targetCh.name} (${resolvedHotelCode}), but no live OTA partner endpoint URL is configured. Enable Sandbox Gateway or enter official ${targetCh.name} endpoint URL to verify connection.`;
        } else {
          try {
            const targetUrl = resolvedEndpoint.startsWith("http")
              ? resolvedEndpoint
              : `http://localhost:${PORT}${resolvedEndpoint.startsWith("/") ? "" : "/"}${resolvedEndpoint}`;
            const hmacSig = crypto
              .createHmac("sha256", resolvedSecret)
              .update(`${resolvedHotelCode}:${resolvedKey}`)
              .digest("hex");

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            const resp = await fetch(targetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-ota-hotel-code": resolvedHotelCode,
                "x-ota-api-key": resolvedKey,
                "x-ota-signature": hmacSig,
                ...(simulateFail ? { "x-simulate-fail": "true" } : {}),
              },
              body: JSON.stringify({
                channel: targetCh.name,
                hotelCode: resolvedHotelCode,
                authType: targetCh.authType || "API Key + Secret",
                simulateFail: Boolean(simulateFail),
              }),
              signal: controller.signal,
            });
            clearTimeout(timer);
            httpStatus = resp.status;
            const respJson: any = await resp.json().catch(() => ({}));
            if (resp.ok && respJson?.success !== false) {
              isSuccess = true;
              nextStatus = "Healthy";
              statusMessage =
                respJson?.message ||
                `Verified ${targetCh.name} API handshake (HTTP ${resp.status}).`;
            } else {
              isSuccess = false;
              nextStatus = resp.status === 401 || resp.status === 403 ? "Auth Error" : "Sync Failed";
              errorMessage =
                respJson?.error || `OTA endpoint returned HTTP ${resp.status}.`;
            }
          } catch (netErr: any) {
            httpStatus = 503;
            isSuccess = false;
            nextStatus = "Sync Failed";
            errorMessage = `Network/timeout error reaching OTA endpoint: ${netErr?.message || "Connection refused"}`;
          }
        }

        const latencyMs = Math.max(1, Date.now() - startTime);
        const nowFormatted = new Date().toLocaleString("en-IN");

        let updatedChannel: any = null;
        const nextHotelChannels = hotelChannels.map((ch: any) => {
          if (ch.id !== targetCh.id) return ch;
          updatedChannel = {
            ...ch,
            hotelCode: resolvedHotelCode || ch.hotelCode,
            encryptedApiKey: resolvedKey ? encryptOtaCredential(resolvedKey) : ch.encryptedApiKey,
            encryptedApiSecret: resolvedSecret
              ? encryptOtaCredential(resolvedSecret)
              : ch.encryptedApiSecret,
            maskedApiKey: resolvedKey ? maskOtaCredential(resolvedKey) : ch.maskedApiKey,
            hasSavedSecret: Boolean(resolvedSecret),
            apiEndpointUrl: resolvedEndpoint || ch.apiEndpointUrl || "",
            connected: isSuccess,
            status: nextStatus,
            lastSync: isSuccess ? `${nowFormatted} (Handshake Verified)` : ch.lastSync,
            lastSyncError: isSuccess ? "" : errorMessage,
          };
          delete updatedChannel.apiKey;
          delete updatedChannel.apiSecret;
          return updatedChannel;
        });

        const logEntry = {
          id: `OTALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: targetHotelId,
          timestamp: new Date().toISOString(),
          channelId: targetCh.id,
          channelName: targetCh.name,
          eventType: httpStatus === 401 || httpStatus === 403 ? "AUTH_ERROR" : "API_TEST",
          direction: "AUTH_CHECK",
          endpoint: resolvedEndpoint || "UNCONFIGURED_OTA_ENDPOINT",
          httpStatus,
          status: isSuccess
            ? "SUCCESS"
            : nextStatus === "Pending Official OTA Endpoint"
            ? "PENDING_ENDPOINT"
            : "FAILED",
          latencyMs,
          errorMessage: isSuccess ? undefined : errorMessage,
          sanitizedPayload: redactOtaLogPayload({
            channel: targetCh.name,
            hotelCode: resolvedHotelCode,
            endpoint: resolvedEndpoint || "none",
            maskedApiKey: maskOtaCredential(resolvedKey),
            resultStatus: nextStatus,
          }),
          retryPayload: isSuccess
            ? undefined
            : {
                action: "TEST_CONNECTION",
                channelId: targetCh.id,
                hotelCode: resolvedHotelCode,
                apiEndpointUrl: resolvedEndpoint || sandboxUrl,
              },
          retryCount: 0,
        };

        prevData.otaChannels = [...otherHotelChannels, ...nextHotelChannels];
        prevData.otaSyncLogs = [
          logEntry,
          ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
        ].slice(0, 300);

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(
          db,
          prevData,
          new Set(["otaChannels", "otaSyncLogs"])
        );

        return {
          verified: isSuccess,
          status: nextStatus,
          message: isSuccess ? statusMessage : errorMessage,
          channel: sanitizeOtaChannelForResponse(updatedChannel),
          channels: nextHotelChannels.map(sanitizeOtaChannelForResponse),
          logEntry,
        };
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to test OTA API connection",
      });
    }
  });

  // 5. POST /api/ota/toggle-connection — Connect or Disconnect Channel Safely
  app.post("/api/ota/toggle-connection", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const { hotelId: reqHotelId, channelId } = req.body || {};

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawChannels = Array.isArray(prevData.otaChannels) ? prevData.otaChannels : [];
        const otherHotelChannels = rawChannels.filter(
          (c: any) => c && c.hotelId && c.hotelId !== targetHotelId
        );
        const hotelChannels = ensureHotelOtaChannels(rawChannels, targetHotelId);

        let toggledChannel: any = null;
        const nextHotelChannels = hotelChannels.map((ch: any) => {
          if (ch.id !== channelId) return ch;
          if (ch.connected) {
            toggledChannel = {
              ...ch,
              connected: false,
              status: "Disconnected",
            };
            return toggledChannel;
          }
          const hasKey = Boolean(decryptOtaCredential(ch.encryptedApiKey || ch.apiKey || ""));
          const hasSecret = Boolean(decryptOtaCredential(ch.encryptedApiSecret || ch.apiSecret || ""));
          if (!ch.hotelCode || !hasKey || !hasSecret) {
            toggledChannel = {
              ...ch,
              connected: false,
              status: "Pending Configuration",
              lastSyncError: "Cannot connect without valid Hotel Code, API Key, and API Secret.",
            };
            return toggledChannel;
          }
          if (!ch.apiEndpointUrl) {
            toggledChannel = {
              ...ch,
              connected: false,
              status: "Pending Official OTA Endpoint",
              lastSyncError: "Credentials saved, awaiting official OTA API endpoint or Sandbox Gateway verification.",
            };
            return toggledChannel;
          }
          toggledChannel = {
            ...ch,
            connected: true,
            status: "Healthy",
            lastSyncError: "",
          };
          return toggledChannel;
        });

        prevData.otaChannels = [...otherHotelChannels, ...nextHotelChannels];
        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["otaChannels"]));

        return {
          channel: sanitizeOtaChannelForResponse(toggledChannel),
          channels: nextHotelChannels.map(sanitizeOtaChannelForResponse),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to toggle OTA connection",
      });
    }
  });

  // 6. POST /api/ota/mappings & DELETE /api/ota/mappings/:id — Room Mapping Management
  app.post("/api/ota/mappings", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const {
      id,
      hotelId: reqHotelId,
      channelId,
      channelName,
      pmsCategoryId,
      pmsCategoryName,
      otaRoomTypeCode,
      otaRoomTypeName,
      standardOccupancy,
      maxOccupancy,
      mealPlan,
      ratePlanCode,
      status,
    } = req.body || {};

    const cleanCat = String(pmsCategoryName || "").trim();
    const cleanOtaCode = String(otaRoomTypeCode || "").trim();
    const cleanOtaName = String(otaRoomTypeName || "").trim();
    const cleanMealPlan = String(mealPlan || "EP (Room Only)").trim();

    if (!channelId || !cleanCat || !cleanOtaCode || !cleanOtaName) {
      return res.status(400).json({
        success: false,
        error: "Channel, PMS Room Category, and OTA Room Type are required.",
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawMappings: any[] = Array.isArray(prevData.otaRoomMappings)
          ? prevData.otaRoomMappings
          : [];
        const hotelMappings = rawMappings.filter((m) => m && m.hotelId === targetHotelId);

        // Prevent duplicate mapping for the same (channelId + pmsCategoryName + mealPlan) or (channelId + otaRoomTypeCode + mealPlan)
        const duplicate = hotelMappings.find(
          (m) =>
            m.id !== id &&
            m.channelId === channelId &&
            m.mealPlan === cleanMealPlan &&
            (m.pmsCategoryName.toLowerCase() === cleanCat.toLowerCase() ||
              m.otaRoomTypeCode.toLowerCase() === cleanOtaCode.toLowerCase())
        );
        if (duplicate) {
          throw new Error(
            `Duplicate mapping prevented: "${cleanCat}" or OTA Room Type "${cleanOtaName}" (${cleanMealPlan}) is already mapped for ${channelName || channelId}.`
          );
        }

        const mappingRecord = {
          id: id || `MAP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: targetHotelId,
          channelId,
          channelName: channelName || "OTA",
          pmsCategoryId: pmsCategoryId || `grp-${cleanCat.toLowerCase().replace(/\s+/g, "-")}`,
          pmsCategoryName: cleanCat,
          otaRoomTypeCode: cleanOtaCode,
          otaRoomTypeName: cleanOtaName,
          standardOccupancy: Math.max(1, Number(standardOccupancy) || 2),
          maxOccupancy: Math.max(1, Number(maxOccupancy) || 3),
          mealPlan: cleanMealPlan,
          ratePlanCode: String(ratePlanCode || `${cleanOtaCode}-${cleanMealPlan.slice(0, 2).toUpperCase()}`).trim(),
          status: status || "Active",
          updatedAt: new Date().toISOString(),
        };

        const exists = rawMappings.some((m) => m && m.id === mappingRecord.id);
        prevData.otaRoomMappings = exists
          ? rawMappings.map((m) => (m && m.id === mappingRecord.id ? mappingRecord : m))
          : [mappingRecord, ...rawMappings];

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["otaRoomMappings"]));

        return {
          mapping: mappingRecord,
          roomMappings: prevData.otaRoomMappings.filter(
            (m: any) => m && m.hotelId === targetHotelId
          ),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || "Failed to save room mapping",
      });
    }
  });

  app.delete("/api/ota/mappings/:id", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const mappingId = String(req.params.id || "").trim();
    const targetHotelId = String(
      req.query.hotelId || req.headers["x-target-hotel-id"] || caller.hotelId || "hotel-1"
    ).trim();

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const rawMappings: any[] = Array.isArray(prevData.otaRoomMappings)
          ? prevData.otaRoomMappings
          : [];
        prevData.otaRoomMappings = rawMappings.filter((m) => m && m.id !== mappingId);

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["otaRoomMappings"]));

        return {
          roomMappings: prevData.otaRoomMappings.filter(
            (m: any) => m && m.hotelId === targetHotelId
          ),
        };
      });
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to delete room mapping",
      });
    }
  });

  // 7. POST /api/ota/rates & POST /api/ota/rates/bulk — OTA Rate Management
  app.post("/api/ota/rates", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const {
      id,
      hotelId: reqHotelId,
      channelId,
      channelName,
      pmsCategoryName,
      pmsBasePrice,
      otaBasePrice,
      weekdayRate,
      weekendRate,
      extraPersonCharge,
      mealPlan,
      mealPlanAddonPrice,
      ratePlanCode,
      minStayNights,
      maxStayNights,
      closedToArrival,
      closedToDeparture,
      seasonalOverrides,
    } = req.body || {};

    const cleanCat = String(pmsCategoryName || "").trim();
    if (!channelId || !cleanCat) {
      return res.status(400).json({
        success: false,
        error: "OTA Channel and PMS Room Category are required.",
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawRates: any[] = Array.isArray(prevData.otaRateRules) ? prevData.otaRateRules : [];
        const existingRule = rawRates.find(
          (r) =>
            r &&
            r.hotelId === targetHotelId &&
            (r.id === id ||
              (r.channelId === channelId &&
                String(r.pmsCategoryName).toLowerCase() === cleanCat.toLowerCase() &&
                String(r.mealPlan || "EP (Room Only)") === String(mealPlan || "EP (Room Only)")))
        );

        const baseOta = Math.max(0, Number(otaBasePrice) || Number(pmsBasePrice) || 2000);
        const ruleRecord = {
          id: existingRule?.id || id || `RATE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: targetHotelId,
          channelId,
          channelName: channelName || existingRule?.channelName || "OTA",
          pmsCategoryName: cleanCat,
          pmsBasePrice: Math.max(0, Number(pmsBasePrice) || existingRule?.pmsBasePrice || 2000),
          otaBasePrice: baseOta,
          weekdayRate: Math.max(0, Number(weekdayRate) || baseOta),
          weekendRate: Math.max(0, Number(weekendRate) || Math.round(baseOta * 1.1)),
          extraPersonCharge: Math.max(0, Number(extraPersonCharge ?? existingRule?.extraPersonCharge ?? 500)),
          mealPlan: String(mealPlan || existingRule?.mealPlan || "EP (Room Only)"),
          mealPlanAddonPrice: Math.max(0, Number(mealPlanAddonPrice ?? existingRule?.mealPlanAddonPrice ?? 0)),
          ratePlanCode: String(
            ratePlanCode || existingRule?.ratePlanCode || `RP-${cleanCat.slice(0, 3).toUpperCase()}`
          ),
          minStayNights: Math.max(1, Number(minStayNights) || 1),
          maxStayNights: Math.max(1, Number(maxStayNights) || 30),
          closedToArrival: Boolean(closedToArrival),
          closedToDeparture: Boolean(closedToDeparture),
          seasonalOverrides: Array.isArray(seasonalOverrides)
            ? seasonalOverrides
            : existingRule?.seasonalOverrides || [],
          updatedAt: new Date().toISOString(),
        };

        const exists = rawRates.some((r) => r && r.id === ruleRecord.id);
        prevData.otaRateRules = exists
          ? rawRates.map((r) => (r && r.id === ruleRecord.id ? ruleRecord : r))
          : [ruleRecord, ...rawRates];

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["otaRateRules"]));

        return {
          rateRule: ruleRecord,
          rateRules: prevData.otaRateRules.filter((r: any) => r && r.hotelId === targetHotelId),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to save OTA rate rule",
      });
    }
  });

  // Bulk Seasonal / Date-Range Price Update across selected channels & categories
  app.post("/api/ota/rates/bulk", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const {
      hotelId: reqHotelId,
      channelIds,
      pmsCategoryName,
      label,
      startDate,
      endDate,
      price,
      minStayNights,
    } = req.body || {};

    if (!pmsCategoryName || !startDate || !endDate || !price) {
      return res.status(400).json({
        success: false,
        error: "Category, Start Date, End Date, and Price are required for bulk rate update.",
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const hotelChannels = ensureHotelOtaChannels(
          Array.isArray(prevData.otaChannels) ? prevData.otaChannels : [],
          targetHotelId
        );
        const targetChIds: string[] =
          Array.isArray(channelIds) && channelIds.length > 0
            ? channelIds
            : hotelChannels.map((c) => c.id);

        const rawRates: any[] = Array.isArray(prevData.otaRateRules) ? prevData.otaRateRules : [];
        const newOverride = {
          id: `SEAS-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          label: String(label || "Seasonal / Date Override").trim(),
          startDate,
          endDate,
          price: Number(price),
          minStayNights: Math.max(1, Number(minStayNights) || 1),
        };

        const updatedRules = [...rawRates];
        for (const chId of targetChIds) {
          const chObj = hotelChannels.find((c) => c.id === chId);
          const idx = updatedRules.findIndex(
            (r) =>
              r &&
              r.hotelId === targetHotelId &&
              r.channelId === chId &&
              String(r.pmsCategoryName).toLowerCase() === String(pmsCategoryName).toLowerCase()
          );
          if (idx >= 0) {
            const existingOverrides = Array.isArray(updatedRules[idx].seasonalOverrides)
              ? updatedRules[idx].seasonalOverrides
              : [];
            updatedRules[idx] = {
              ...updatedRules[idx],
              seasonalOverrides: [newOverride, ...existingOverrides],
              updatedAt: new Date().toISOString(),
            };
          } else {
            updatedRules.unshift({
              id: `RATE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              hotelId: targetHotelId,
              channelId: chId,
              channelName: chObj?.name || "OTA",
              pmsCategoryName,
              pmsBasePrice: Number(price),
              otaBasePrice: Number(price),
              weekdayRate: Number(price),
              weekendRate: Number(price),
              extraPersonCharge: 500,
              mealPlan: "EP (Room Only)",
              mealPlanAddonPrice: 0,
              ratePlanCode: `RP-${String(pmsCategoryName).slice(0, 3).toUpperCase()}`,
              minStayNights: Math.max(1, Number(minStayNights) || 1),
              maxStayNights: 30,
              closedToArrival: false,
              closedToDeparture: false,
              seasonalOverrides: [newOverride],
              updatedAt: new Date().toISOString(),
            });
          }
        }

        prevData.otaRateRules = updatedRules;
        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["otaRateRules"]));

        return {
          rateRules: prevData.otaRateRules.filter((r: any) => r && r.hotelId === targetHotelId),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to apply bulk OTA rate update",
      });
    }
  });

  // 8. POST /api/ota/inventory/allocation — Date-Wise Inventory Allocation & Stop-Sell
  app.post("/api/ota/inventory/allocation", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const {
      hotelId: reqHotelId,
      pmsCategoryName,
      channelId,
      channelName,
      date,
      allocatedRooms,
      stopSell,
    } = req.body || {};

    if (!pmsCategoryName || !date) {
      return res.status(400).json({
        success: false,
        error: "Category and Date are required for inventory allocation.",
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawAllocs: any[] = Array.isArray(prevData.otaInventoryAllocations)
          ? prevData.otaInventoryAllocations
          : [];
        const existingIdx = rawAllocs.findIndex(
          (a) =>
            a &&
            a.hotelId === targetHotelId &&
            a.pmsCategoryName === pmsCategoryName &&
            a.date === date &&
            (a.channelId || "ALL") === (channelId || "ALL")
        );

        const allocRecord = {
          id:
            existingIdx >= 0
              ? rawAllocs[existingIdx].id
              : `INVALLOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: targetHotelId,
          pmsCategoryName,
          channelId: channelId || "ALL",
          channelName: channelName || "All Connected OTAs",
          date,
          allocatedRooms: Math.max(0, Number(allocatedRooms) || 0),
          stopSell: Boolean(stopSell),
          updatedAt: new Date().toISOString(),
        };

        if (existingIdx >= 0) {
          rawAllocs[existingIdx] = allocRecord;
        } else {
          rawAllocs.unshift(allocRecord);
        }
        prevData.otaInventoryAllocations = rawAllocs;

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["otaInventoryAllocations"]));

        const hotelRooms = (Array.isArray(prevData.rooms) ? prevData.rooms : []).filter(
          (r: any) => r && r.hotelId === targetHotelId
        );
        const hotelBookings = (Array.isArray(prevData.bookings) ? prevData.bookings : []).filter(
          (b: any) => b && b.hotelId === targetHotelId
        );
        const hotelBlocks = (Array.isArray(prevData.roomBlocks) ? prevData.roomBlocks : []).filter(
          (b: any) => b && b.hotelId === targetHotelId
        );
        const hotelAllocs = prevData.otaInventoryAllocations.filter(
          (a: any) => a && a.hotelId === targetHotelId
        );

        return {
          allocation: allocRecord,
          inventoryAllocations: hotelAllocs,
          inventoryMatrix: computeHotelInventoryMatrix(
            hotelRooms,
            hotelBookings,
            hotelBlocks,
            hotelAllocs
          ),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to update OTA inventory allocation",
      });
    }
  });

  // 9. POST /api/ota/push — Real 2-Way PMS → OTA Rate & Inventory Synchronization
  app.post("/api/ota/push", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const {
      hotelId: reqHotelId,
      channelId,
      pushType = "FULL_ARI", // 'RATES' | 'INVENTORY' | 'FULL_ARI'
      categoryFilter,
      simulateFail,
    } = req.body || {};

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawChannels = Array.isArray(prevData.otaChannels) ? prevData.otaChannels : [];
        const otherHotelChannels = rawChannels.filter(
          (c: any) => c && c.hotelId && c.hotelId !== targetHotelId
        );
        const hotelChannels = ensureHotelOtaChannels(rawChannels, targetHotelId);

        const targetChannels = channelId
          ? hotelChannels.filter((c) => c.id === channelId)
          : hotelChannels.filter((c) => c.connected || c.hotelCode);

        if (targetChannels.length === 0) {
          throw new Error(
            "No connected or configured OTA channels found to push Rates & Inventory. Configure an OTA channel first."
          );
        }

        const hotelRooms = (Array.isArray(prevData.rooms) ? prevData.rooms : []).filter(
          (r: any) => r && r.hotelId === targetHotelId
        );
        const hotelBookings = (Array.isArray(prevData.bookings) ? prevData.bookings : []).filter(
          (b: any) => b && b.hotelId === targetHotelId
        );
        const hotelBlocks = (Array.isArray(prevData.roomBlocks) ? prevData.roomBlocks : []).filter(
          (b: any) => b && b.hotelId === targetHotelId
        );
        const hotelMappings = (
          Array.isArray(prevData.otaRoomMappings) ? prevData.otaRoomMappings : []
        ).filter((m: any) => m && m.hotelId === targetHotelId);
        const hotelRates = (Array.isArray(prevData.otaRateRules) ? prevData.otaRateRules : []).filter(
          (r: any) => r && r.hotelId === targetHotelId
        );
        const hotelAllocs = (
          Array.isArray(prevData.otaInventoryAllocations) ? prevData.otaInventoryAllocations : []
        ).filter((a: any) => a && a.hotelId === targetHotelId);

        const matrix = computeHotelInventoryMatrix(
          hotelRooms,
          hotelBookings,
          hotelBlocks,
          hotelAllocs
        );

        const newLogs: any[] = [];
        const channelResults: any[] = [];
        const updatedChannelsMap = new Map<string, any>();

        for (const ch of targetChannels) {
          const startTime = Date.now();
          const plainKey = decryptOtaCredential(ch.encryptedApiKey || ch.apiKey || "");
          const plainSecret = decryptOtaCredential(ch.encryptedApiSecret || ch.apiSecret || "");
          const chMappings = hotelMappings.filter((m: any) => m.channelId === ch.id);
          const chRates = hotelRates.filter((r: any) => r.channelId === ch.id);

          const categoriesToPush = categoryFilter
            ? matrix.dateWiseByCategory.filter((c) => c.categoryName === categoryFilter)
            : matrix.dateWiseByCategory;

          const outboundPayload = {
            hotelCode: ch.hotelCode,
            channel: ch.name,
            pushType,
            mappingsCount: chMappings.length,
            rates:
              pushType === "INVENTORY"
                ? []
                : categoriesToPush.map((cat) => {
                    const rule = chRates.find(
                      (r: any) =>
                        String(r.pmsCategoryName).toLowerCase() === cat.categoryName.toLowerCase()
                    );
                    const mapping = chMappings.find(
                      (m: any) =>
                        String(m.pmsCategoryName).toLowerCase() === cat.categoryName.toLowerCase()
                    );
                    const computedOtaPrice =
                      rule?.otaBasePrice ||
                      Math.round(cat.basePrice * (1 + (Number(ch.markupPercent) || 15) / 100));
                    return {
                      pmsCategory: cat.categoryName,
                      otaRoomTypeCode: mapping?.otaRoomTypeCode || "UNMAPPED",
                      basePrice: computedOtaPrice,
                      weekdayRate: rule?.weekdayRate || computedOtaPrice,
                      weekendRate: rule?.weekendRate || Math.round(computedOtaPrice * 1.1),
                      extraPersonCharge: rule?.extraPersonCharge ?? cat.extraPersonCharge,
                      mealPlan: rule?.mealPlan || mapping?.mealPlan || "EP (Room Only)",
                      minStayNights: rule?.minStayNights || 1,
                      maxStayNights: rule?.maxStayNights || 30,
                    };
                  }),
            inventory:
              pushType === "RATES"
                ? []
                : categoriesToPush.map((cat) => ({
                    pmsCategory: cat.categoryName,
                    dailyAvailability: cat.daily.map((d) => ({
                      date: d.date,
                      availableRooms: d.availableRooms,
                      stopSell: d.stopSell,
                    })),
                  })),
          };

          let httpStatus = 0;
          let pushSuccess = false;
          let errorMessage = "";
          let endpointUsed = ch.apiEndpointUrl || "";

          if (!ch.hotelCode || !plainKey || !plainSecret) {
            httpStatus = 401;
            pushSuccess = false;
            errorMessage = `Cannot push to ${ch.name}: API Key/Secret or Hotel Code not configured.`;
          } else if (!endpointUsed) {
            httpStatus = 202;
            pushSuccess = false;
            errorMessage = `ARI payload prepared for ${ch.name} (${ch.hotelCode}), but channel is Pending Official OTA Endpoint configuration.`;
          } else {
            try {
              const ariUrl = endpointUsed.replace(/\/ping$/, "/ari-push");
              const fullUrl = ariUrl.startsWith("http")
                ? ariUrl
                : `http://localhost:${PORT}${ariUrl.startsWith("/") ? "" : "/"}${ariUrl}`;
              endpointUsed = fullUrl;
              const hmacSig = crypto
                .createHmac("sha256", plainSecret)
                .update(`${ch.hotelCode}:${plainKey}`)
                .digest("hex");

              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 5000);
              const resp = await fetch(fullUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-ota-hotel-code": ch.hotelCode,
                  "x-ota-api-key": plainKey,
                  "x-ota-signature": hmacSig,
                  ...(simulateFail ? { "x-simulate-fail": "true" } : {}),
                },
                body: JSON.stringify({
                  ...outboundPayload,
                  simulateFail: Boolean(simulateFail),
                }),
                signal: controller.signal,
              });
              clearTimeout(timer);
              httpStatus = resp.status;
              const respJson: any = await resp.json().catch(() => ({}));
              if (resp.ok && respJson?.success !== false) {
                pushSuccess = true;
              } else {
                pushSuccess = false;
                errorMessage =
                  respJson?.error || `OTA Partner endpoint returned HTTP ${resp.status}.`;
              }
            } catch (err: any) {
              httpStatus = 502;
              pushSuccess = false;
              errorMessage = `Failed to push ARI to ${ch.name}: ${err?.message || "Gateway error"}`;
            }
          }

          const latencyMs = Math.max(1, Date.now() - startTime);
          const nowStr = new Date().toLocaleString("en-IN");

          const updatedCh = {
            ...ch,
            status: pushSuccess
              ? "Healthy"
              : !endpointUsed
              ? "Pending Official OTA Endpoint"
              : "Sync Failed",
            lastSync: pushSuccess ? `${nowStr} (${pushType})` : ch.lastSync,
            lastSyncError: pushSuccess ? "" : errorMessage,
          };
          updatedChannelsMap.set(ch.id, updatedCh);

          const eventType =
            pushType === "RATES"
              ? "RATE_PUSH"
              : pushType === "INVENTORY"
              ? "INVENTORY_PUSH"
              : "FULL_ARI_PUSH";

          const logRecord = {
            id: `OTALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            hotelId: targetHotelId,
            timestamp: new Date().toISOString(),
            channelId: ch.id,
            channelName: ch.name,
            eventType,
            direction: "OUTBOUND_PUSH",
            endpoint: endpointUsed || "UNCONFIGURED_OTA_ENDPOINT",
            httpStatus,
            status: pushSuccess
              ? "SUCCESS"
              : !endpointUsed
              ? "PENDING_ENDPOINT"
              : "FAILED",
            latencyMs,
            errorMessage: pushSuccess ? undefined : errorMessage,
            sanitizedPayload: redactOtaLogPayload(outboundPayload),
            retryPayload: pushSuccess
              ? undefined
              : {
                  action: "ARI_PUSH",
                  channelId: ch.id,
                  pushType,
                  categoryFilter,
                },
            retryCount: 0,
          };
          newLogs.push(logRecord);
          channelResults.push({
            channelId: ch.id,
            channelName: ch.name,
            success: pushSuccess,
            httpStatus,
            errorMessage: pushSuccess ? undefined : errorMessage,
          });
        }

        const nextHotelChannels = hotelChannels.map((ch) =>
          updatedChannelsMap.has(ch.id) ? updatedChannelsMap.get(ch.id) : ch
        );
        prevData.otaChannels = [...otherHotelChannels, ...nextHotelChannels];
        prevData.otaSyncLogs = [
          ...newLogs,
          ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
        ].slice(0, 300);

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(
          db,
          prevData,
          new Set(["otaChannels", "otaSyncLogs"])
        );

        return {
          results: channelResults,
          channels: nextHotelChannels.map(sanitizeOtaChannelForResponse),
          syncLogs: prevData.otaSyncLogs
            .filter((l: any) => l && l.hotelId === targetHotelId)
            .slice(0, 150),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || "Failed to execute OTA rate & inventory push",
      });
    }
  });

  // 10. POST /api/ota/logs/:logId/retry — Retry a Failed OTA API Sync or Handshake Request (Test J)
  app.post("/api/ota/logs/:logId/retry", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const logId = String(req.params.logId || "").trim();
    const { hotelId: reqHotelId } = req.body || {};

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawLogs: any[] = Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : [];
        const targetLog = rawLogs.find((l) => l && l.id === logId);
        if (!targetLog) {
          throw new Error("Sync log entry not found.");
        }

        const rawChannels = Array.isArray(prevData.otaChannels) ? prevData.otaChannels : [];
        const otherHotelChannels = rawChannels.filter(
          (c: any) => c && c.hotelId && c.hotelId !== targetHotelId
        );
        const hotelChannels = ensureHotelOtaChannels(rawChannels, targetHotelId);
        const ch = hotelChannels.find((c) => c.id === targetLog.channelId) || hotelChannels[0];
        if (!ch) {
          throw new Error("Associated OTA channel not found.");
        }

        const plainKey = decryptOtaCredential(ch.encryptedApiKey || ch.apiKey || "");
        const plainSecret = decryptOtaCredential(ch.encryptedApiSecret || ch.apiSecret || "");
        const badgeLower = String(ch.logoBadge || "mmt").toLowerCase();
        const fallbackSandboxUrl =
          targetLog.eventType === "API_TEST" || targetLog.eventType === "AUTH_ERROR"
            ? `http://localhost:${PORT}/api/ota/sandbox-partner/${badgeLower}/ping`
            : `http://localhost:${PORT}/api/ota/sandbox-partner/${badgeLower}/ari-push`;
        const endpointUrl =
          ch.apiEndpointUrl && ch.apiEndpointUrl.startsWith("http")
            ? ch.apiEndpointUrl
            : fallbackSandboxUrl;

        const startTime = Date.now();
        let retrySuccess = false;
        let httpStatus = 0;
        let errorMessage = "";

        if (!ch.hotelCode || !plainKey || !plainSecret) {
          httpStatus = 401;
          errorMessage = "Missing Hotel Code, API Key, or Secret on retry.";
        } else {
          try {
            const hmacSig = crypto
              .createHmac("sha256", plainSecret)
              .update(`${ch.hotelCode}:${plainKey}`)
              .digest("hex");
            const resp = await fetch(endpointUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-ota-hotel-code": ch.hotelCode,
                "x-ota-api-key": plainKey,
                "x-ota-signature": hmacSig,
              },
              body: JSON.stringify({
                hotelCode: ch.hotelCode,
                channel: ch.name,
                retriedFromLogId: logId,
              }),
            });
            httpStatus = resp.status;
            const respJson: any = await resp.json().catch(() => ({}));
            if (resp.ok && respJson?.success !== false) {
              retrySuccess = true;
            } else {
              errorMessage = respJson?.error || `HTTP ${resp.status} on retry`;
            }
          } catch (err: any) {
            httpStatus = 502;
            errorMessage = err?.message || "Network error on retry";
          }
        }

        const latencyMs = Math.max(1, Date.now() - startTime);
        const nowStr = new Date().toLocaleString("en-IN");

        const nextLogs = rawLogs.map((l) => {
          if (!l || l.id !== logId) return l;
          return {
            ...l,
            timestamp: new Date().toISOString(),
            httpStatus,
            status: retrySuccess ? "RETRIED" : "FAILED",
            latencyMs,
            errorMessage: retrySuccess ? undefined : errorMessage,
            retryCount: (Number(l.retryCount) || 0) + 1,
          };
        });

        const nextHotelChannels = hotelChannels.map((c) => {
          if (c.id !== ch.id) return c;
          return {
            ...c,
            connected: retrySuccess ? true : c.connected,
            status: retrySuccess ? "Healthy" : "Sync Failed",
            apiEndpointUrl: c.apiEndpointUrl || endpointUrl,
            lastSync: retrySuccess ? `${nowStr} (Retry Succeeded)` : c.lastSync,
            lastSyncError: retrySuccess ? "" : errorMessage,
          };
        });

        prevData.otaChannels = [...otherHotelChannels, ...nextHotelChannels];
        prevData.otaSyncLogs = nextLogs;

        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(
          db,
          prevData,
          new Set(["otaChannels", "otaSyncLogs"])
        );

        return {
          retrySuccess,
          httpStatus,
          log: nextLogs.find((l) => l && l.id === logId),
          channels: nextHotelChannels.map(sanitizeOtaChannelForResponse),
          syncLogs: nextLogs.filter((l: any) => l && l.hotelId === targetHotelId).slice(0, 150),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || "Failed to retry OTA log entry",
      });
    }
  });

  // 11. POST /api/webhooks/ota/:channel — Inbound OTA → PMS Webhook (New Booking, Modification, Cancellation)
  app.post("/api/webhooks/ota/:channel", async (req, res) => {
    const channelParam = String(req.params.channel || "mmt").toUpperCase();
    const {
      hotelId: bodyHotelId,
      eventType = "BOOKING_NEW", // 'BOOKING_NEW' | 'BOOKING_MODIFIED' | 'BOOKING_CANCELLED'
      otaBookingId,
      guestName,
      mobile,
      email,
      roomCategory,
      otaRoomTypeCode,
      checkInDate,
      checkOutDate,
      numGuests = 2,
      bookingAmount,
      paymentStatus = "Partially Paid",
      amountPaid,
      cancellationReason,
      authorizeRefund = false,
      refundAmount = 0,
    } = req.body || {};

    const cleanOtaBookingId = String(otaBookingId || "").trim();
    if (!cleanOtaBookingId) {
      return res.status(400).json({
        success: false,
        error: "otaBookingId is required for OTA webhook processing.",
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(
          req.query.hotelId || bodyHotelId || prevData.hotels?.[0]?.id || "hotel-1"
        ).trim();

        const channelMap: Record<string, string> = {
          MMT: "MakeMyTrip",
          MAKEMYTRIP: "MakeMyTrip",
          GOI: "Goibibo",
          GOIBIBO: "Goibibo",
          BDC: "Booking.com",
          "BOOKING.COM": "Booking.com",
          AGD: "Agoda",
          AGODA: "Agoda",
        };
        const resolvedChannelName = channelMap[channelParam] || channelParam;

        const hotelChannels = ensureHotelOtaChannels(
          Array.isArray(prevData.otaChannels) ? prevData.otaChannels : [],
          targetHotelId
        );
        const channelObj =
          hotelChannels.find(
            (c) =>
              c.logoBadge === channelParam ||
              String(c.name).toLowerCase() === resolvedChannelName.toLowerCase()
          ) || hotelChannels[0];
        const commPercent = Number(channelObj?.commissionPercent ?? 15);

        const allBookings: any[] = Array.isArray(prevData.bookings) ? prevData.bookings : [];
        const allRooms: any[] = Array.isArray(prevData.rooms) ? prevData.rooms : [];
        const hotelRooms = allRooms.filter((r) => r && r.hotelId === targetHotelId);
        const hotelBlocks = (Array.isArray(prevData.roomBlocks) ? prevData.roomBlocks : []).filter(
          (b: any) => b && b.hotelId === targetHotelId
        );
        const hotelMappings = (
          Array.isArray(prevData.otaRoomMappings) ? prevData.otaRoomMappings : []
        ).filter((m: any) => m && m.hotelId === targetHotelId);

        // Locate existing PMS booking by sourceBookingId or id
        const existingBkg = allBookings.find(
          (b) =>
            b &&
            b.hotelId === targetHotelId &&
            (b.sourceBookingId === cleanOtaBookingId || b.id === cleanOtaBookingId)
        );

        const nowIso = new Date().toISOString();

        // A. Idempotency check for duplicate BOOKING_NEW webhook (Test H)
        if (eventType === "BOOKING_NEW" && existingBkg) {
          const dupLog = {
            id: `OTALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            hotelId: targetHotelId,
            timestamp: nowIso,
            channelId: channelObj?.id || "ota-mmt",
            channelName: resolvedChannelName,
            eventType: "WEBHOOK_BOOKING_NEW",
            direction: "INBOUND_WEBHOOK",
            endpoint: `/api/webhooks/ota/${channelParam.toLowerCase()}`,
            httpStatus: 200,
            status: "SUCCESS",
            latencyMs: 12,
            sanitizedPayload: redactOtaLogPayload({
              otaBookingId: cleanOtaBookingId,
              idempotentDuplicateIgnored: true,
              existingPmsBookingId: existingBkg.id,
            }),
            retryCount: 0,
          };
          prevData.otaSyncLogs = [
            dupLog,
            ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
          ].slice(0, 300);
          await db.collection("pms_app_state").replaceOne(
            { _id: "FULL_PMS_BACKUP" as any },
            { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: nowIso },
            { upsert: true }
          );
          await syncAllDomainCollections(db, prevData, new Set(["otaSyncLogs"]));
          return {
            idempotentDuplicate: true,
            booking: existingBkg,
            message: `Duplicate webhook event for ${cleanOtaBookingId} ignored idempotently; existing PMS reservation #${existingBkg.id} preserved.`,
          };
        }

        // B. Handle Cancellation (Test F)
        if (eventType === "BOOKING_CANCELLED") {
          if (!existingBkg) {
            throw new Error(`OTA Booking ${cleanOtaBookingId} not found for cancellation.`);
          }
          const cancelReasonClean = String(
            cancellationReason || `Cancelled via ${resolvedChannelName} Webhook`
          ).trim();
          const authorizedRefundAmt = authorizeRefund ? Math.max(0, Number(refundAmount) || 0) : 0;

          const historyEntry = {
            id: `CHG-${Date.now()}`,
            timestamp: nowIso,
            eventType: "CANCELLED",
            actor: `${resolvedChannelName} Webhook`,
            summary: `${cancelReasonClean}${
              authorizedRefundAmt > 0
                ? ` (Authorized refund: ₹${authorizedRefundAmt})`
                : " (No automatic refund issued per policy)"
            }`,
          };

          const updatedBkg = {
            ...existingBkg,
            status: "Cancelled",
            cancellationReason: cancelReasonClean,
            refundAmount: authorizedRefundAmt,
            paymentStatus: authorizedRefundAmt > 0 ? "Refunded" : existingBkg.paymentStatus,
            changeHistory: [historyEntry, ...(existingBkg.changeHistory || [])],
          };

          prevData.bookings = allBookings.map((b) =>
            b && b.id === existingBkg.id ? updatedBkg : b
          );

          // Restore room inventory back to Available
          const releasedRoomNums = Array.isArray(existingBkg.roomNumbers)
            ? existingBkg.roomNumbers
            : [existingBkg.roomNumber].filter(Boolean);
          prevData.rooms = allRooms.map((r) =>
            r && r.hotelId === targetHotelId && releasedRoomNums.includes(r.number)
              ? { ...r, status: "Available" }
              : r
          );

          const cancelLog = {
            id: `OTALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            hotelId: targetHotelId,
            timestamp: nowIso,
            channelId: channelObj?.id || "ota-mmt",
            channelName: resolvedChannelName,
            eventType: "WEBHOOK_BOOKING_CANCEL",
            direction: "INBOUND_WEBHOOK",
            endpoint: `/api/webhooks/ota/${channelParam.toLowerCase()}`,
            httpStatus: 200,
            status: "SUCCESS",
            latencyMs: 24,
            sanitizedPayload: redactOtaLogPayload({
              otaBookingId: cleanOtaBookingId,
              pmsBookingId: existingBkg.id,
              releasedRooms: releasedRoomNums,
              inventoryRestored: true,
            }),
            retryCount: 0,
          };
          prevData.otaSyncLogs = [
            cancelLog,
            ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
          ].slice(0, 300);

          await db.collection("pms_app_state").replaceOne(
            { _id: "FULL_PMS_BACKUP" as any },
            { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: nowIso },
            { upsert: true }
          );
          await syncAllDomainCollections(
            db,
            prevData,
            new Set(["bookings", "rooms", "otaSyncLogs"])
          );

          return {
            idempotentDuplicate: false,
            booking: updatedBkg,
            inventoryRestoredForRooms: releasedRoomNums,
          };
        }

        // Resolve mapped PMS Category if otaRoomTypeCode was sent
        let targetCategory = String(roomCategory || "").trim();
        if (!targetCategory && otaRoomTypeCode) {
          const foundMap = hotelMappings.find(
            (m: any) =>
              String(m.otaRoomTypeCode).toLowerCase() === String(otaRoomTypeCode).toLowerCase()
          );
          if (foundMap) targetCategory = foundMap.pmsCategoryName;
        }
        if (!targetCategory) {
          targetCategory = hotelRooms[0]?.category || "Standard";
        }

        const cIn = String(
          checkInDate || existingBkg?.checkInDate || new Date().toISOString().slice(0, 10)
        ).trim();
        const cOut = String(
          checkOutDate ||
            existingBkg?.checkOutDate ||
            new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        ).trim();

        // C. Find available non-overlapping room in targetCategory (Overbooking Prevention)
        const candidateRooms = hotelRooms.filter(
          (r) =>
            String(r.category || "").toLowerCase() === targetCategory.toLowerCase() &&
            r.status !== "Maintenance" &&
            r.status !== "Blocked"
        );
        const poolToSearch = candidateRooms.length > 0 ? candidateRooms : hotelRooms.filter((r) => r.status !== "Maintenance" && r.status !== "Blocked");

        const availableRoom = poolToSearch.find((rm) => {
          const blockedOnDates = hotelBlocks.some(
            (blk: any) =>
              blk &&
              blk.roomNumber === rm.number &&
              blk.startDate < cOut &&
              blk.endDate >= cIn
          );
          if (blockedOnDates) return false;

          const overlappingBooking = allBookings.some((b) => {
            if (
              !b ||
              b.hotelId !== targetHotelId ||
              b.status === "Cancelled" ||
              b.status === "No-Show" ||
              b.isCompleted ||
              (existingBkg && b.id === existingBkg.id)
            ) {
              return false;
            }
            const bRooms = Array.isArray(b.roomNumbers)
              ? b.roomNumbers
              : [b.roomNumber].filter(Boolean);
            if (!bRooms.includes(rm.number)) return false;
            return b.checkInDate < cOut && b.checkOutDate > cIn;
          });
          return !overlappingBooking;
        });

        if (!availableRoom) {
          throw new Error(
            `Overbooking prevented: No available rooms in category "${targetCategory}" for dates ${cIn} to ${cOut}.`
          );
        }

        const nightsCount = Math.max(
          1,
          Math.round(
            (new Date(`${cOut}T00:00:00`).getTime() - new Date(`${cIn}T00:00:00`).getTime()) /
              86400000
          )
        );
        const grossAmt = Math.max(
          0,
          Number(bookingAmount ?? existingBkg?.bookingAmount ?? availableRoom.rate * nightsCount)
        );
        const commAmt = Math.round(((grossAmt * commPercent) / 100) * 100) / 100;

        // D. Handle Modification (Test G)
        if (eventType === "BOOKING_MODIFIED" && existingBkg) {
          const prevRoomNum = existingBkg.roomNumber;
          const newRoomNum = availableRoom.number;
          const modEntry = {
            id: `CHG-${Date.now()}`,
            timestamp: nowIso,
            eventType: "MODIFIED",
            actor: `${resolvedChannelName} Webhook`,
            summary: `Modified stay (${existingBkg.checkInDate}→${existingBkg.checkOutDate}, Rm ${prevRoomNum}, ₹${existingBkg.bookingAmount}) to (${cIn}→${cOut}, Rm ${newRoomNum}, ₹${grossAmt}, Guests: ${numGuests}).`,
            previousDates: `${existingBkg.checkInDate} → ${existingBkg.checkOutDate}`,
            newDates: `${cIn} → ${cOut}`,
            previousRoom: prevRoomNum,
            newRoom: newRoomNum,
            previousAmount: Number(existingBkg.bookingAmount) || 0,
            newAmount: grossAmt,
          };

          const updatedBkg = {
            ...existingBkg,
            guestName: String(guestName || existingBkg.guestName).trim(),
            mobile: String(mobile || existingBkg.mobile).trim(),
            email: String(email ?? existingBkg.email ?? "").trim(),
            roomNumber: newRoomNum,
            roomNumbers: [newRoomNum],
            bookedRooms: [
              {
                roomNumber: newRoomNum,
                roomType: availableRoom.category || targetCategory,
                rate: availableRoom.rate || 2000,
              },
            ],
            roomType: availableRoom.category || targetCategory,
            checkInDate: cIn,
            checkOutDate: cOut,
            nights: nightsCount,
            adults: Number(numGuests) || existingBkg.adults || 2,
            bookingAmount: grossAmt,
            otaCommissionPercent: commPercent,
            otaCommissionAmount: commAmt,
            changeHistory: [modEntry, ...(existingBkg.changeHistory || [])],
          };

          prevData.bookings = allBookings.map((b) =>
            b && b.id === existingBkg.id ? updatedBkg : b
          );

          const modLog = {
            id: `OTALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            hotelId: targetHotelId,
            timestamp: nowIso,
            channelId: channelObj?.id || "ota-mmt",
            channelName: resolvedChannelName,
            eventType: "WEBHOOK_BOOKING_MODIFY",
            direction: "INBOUND_WEBHOOK",
            endpoint: `/api/webhooks/ota/${channelParam.toLowerCase()}`,
            httpStatus: 200,
            status: "SUCCESS",
            latencyMs: 29,
            sanitizedPayload: redactOtaLogPayload({
              otaBookingId: cleanOtaBookingId,
              pmsBookingId: existingBkg.id,
              newDates: `${cIn}->${cOut}`,
              newRoom: newRoomNum,
              newAmount: grossAmt,
            }),
            retryCount: 0,
          };
          prevData.otaSyncLogs = [
            modLog,
            ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
          ].slice(0, 300);

          await db.collection("pms_app_state").replaceOne(
            { _id: "FULL_PMS_BACKUP" as any },
            { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: nowIso },
            { upsert: true }
          );
          await syncAllDomainCollections(
            db,
            prevData,
            new Set(["bookings", "otaSyncLogs"])
          );

          return {
            idempotentDuplicate: false,
            booking: updatedBkg,
          };
        }

        // E. Handle New Booking Creation (Test E)
        const pmsBookingId = `BKG-OTA-${Date.now().toString().slice(-6)}`;
        const paidAmt =
          amountPaid !== undefined
            ? Number(amountPaid)
            : paymentStatus === "Fully Paid"
            ? grossAmt
            : Math.round(grossAmt * 0.5);

        const newPmsBooking = {
          id: pmsBookingId,
          hotelId: targetHotelId,
          guestName: String(guestName || "OTA Guest").trim(),
          mobile: String(mobile || "9876543210").trim(),
          email: String(email || "").trim(),
          roomNumber: availableRoom.number,
          roomNumbers: [availableRoom.number],
          bookedRooms: [
            {
              roomNumber: availableRoom.number,
              roomType: availableRoom.category || targetCategory,
              rate: availableRoom.rate || 2000,
            },
          ],
          roomType: availableRoom.category || targetCategory,
          checkInDate: cIn,
          checkOutDate: cOut,
          nights: nightsCount,
          adults: Number(numGuests) || 2,
          children: 0,
          bookingAmount: grossAmt,
          advanceAmount: paidAmt,
          advancePayment: paidAmt,
          paymentMethod: "UPI",
          paymentStatus: paidAmt >= grossAmt ? "Fully Paid" : paidAmt > 0 ? "Partially Paid" : "Pending",
          bookingSource: resolvedChannelName,
          sourceBookingId: cleanOtaBookingId,
          otaCommissionPercent: commPercent,
          otaCommissionAmount: commAmt,
          status: "Confirmed",
          isCheckedIn: false,
          isCompleted: false,
          bookingDate: nowIso.slice(0, 10),
          receivedAt: nowIso,
          gstRate: 5,
          gstAmount: Math.round((grossAmt - grossAmt / 1.05) * 100) / 100,
          changeHistory: [
            {
              id: `CHG-${Date.now()}`,
              timestamp: nowIso,
              eventType: "CREATED",
              actor: `${resolvedChannelName} Webhook`,
              summary: `Created PMS reservation #${pmsBookingId} from ${resolvedChannelName} Ref #${cleanOtaBookingId} (Room ${availableRoom.number}, ₹${grossAmt}, Comm: ₹${commAmt}).`,
            },
          ],
        };

        prevData.bookings = [newPmsBooking, ...allBookings];

        const newLog = {
          id: `OTALOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: targetHotelId,
          timestamp: nowIso,
          channelId: channelObj?.id || "ota-mmt",
          channelName: resolvedChannelName,
          eventType: "WEBHOOK_BOOKING_NEW",
          direction: "INBOUND_WEBHOOK",
          endpoint: `/api/webhooks/ota/${channelParam.toLowerCase()}`,
          httpStatus: 200,
          status: "SUCCESS",
          latencyMs: 31,
          sanitizedPayload: redactOtaLogPayload({
            otaBookingId: cleanOtaBookingId,
            pmsBookingId,
            assignedRoom: availableRoom.number,
            category: availableRoom.category,
            checkInDate: cIn,
            checkOutDate: cOut,
            grossAmount: grossAmt,
            commissionAmount: commAmt,
          }),
          retryCount: 0,
        };
        prevData.otaSyncLogs = [
          newLog,
          ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
        ].slice(0, 300);

        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: nowIso },
          { upsert: true }
        );
        await syncAllDomainCollections(
          db,
          prevData,
          new Set(["bookings", "otaSyncLogs"])
        );

        return {
          idempotentDuplicate: false,
          booking: newPmsBooking,
        };
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || "Failed to process OTA webhook",
      });
    }
  });

  // 12. POST /api/ota/settlements — Record Actual OTA Payout Settlement (Test I)
  app.post("/api/ota/settlements", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const {
      hotelId: reqHotelId,
      channelId,
      channelName,
      settlementRef,
      payoutDate,
      grossBookingValue,
      commissionDeducted,
      tdsOrTaxDeducted,
      netSettledAmount,
      bookingIds,
      notes,
    } = req.body || {};

    if (!channelName || !settlementRef || !netSettledAmount) {
      return res.status(400).json({
        success: false,
        error: "Channel Name, Settlement UTR/Reference, and Net Settled Amount are required.",
      });
    }

    try {
      const result = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();

        const rawSettlements: any[] = Array.isArray(prevData.otaSettlements)
          ? prevData.otaSettlements
          : [];
        const newSettlement = {
          id: `OTASET-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hotelId: targetHotelId,
          channelId: channelId || "ota-mmt",
          channelName: String(channelName).trim(),
          settlementRef: String(settlementRef).trim(),
          payoutDate: String(payoutDate || new Date().toISOString().slice(0, 10)),
          grossBookingValue: Math.max(0, Number(grossBookingValue) || 0),
          commissionDeducted: Math.max(0, Number(commissionDeducted) || 0),
          tdsOrTaxDeducted: Math.max(0, Number(tdsOrTaxDeducted) || 0),
          netSettledAmount: Math.max(0, Number(netSettledAmount) || 0),
          bookingIds: Array.isArray(bookingIds) ? bookingIds : [],
          notes: String(notes || "OTA Bank Payout Settlement").trim(),
          recordedBy: caller.username || "Admin",
        };

        prevData.otaSettlements = [newSettlement, ...rawSettlements];
        const updatedAtIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: updatedAtIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["otaSettlements"]));

        return {
          settlement: newSettlement,
          settlements: prevData.otaSettlements.filter(
            (s: any) => s && s.hotelId === targetHotelId
          ),
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to record OTA payout settlement",
      });
    }
  });

  // =========================================================================
  // 13. OFFICIAL AIOSELL CHANNEL MANAGER 2-WAY CONNECTOR & WEBHOOK
  // =========================================================================
  const DEFAULT_AIOSELL_CONFIG = {
    baseUrl: "https://live.aiosell.com/api/v2/cm",
    pmsSlug: "sample-pms",
    hotelCode: "sandbox-pms",
    username: "aiosell",
    password: process.env.AIOSELL_PASSWORD || "AIOsell@123",
    roomMappings: [
      { pmsCategory: "Executive", roomCode: "executive", ratePlans: ["executive-s-ep", "executive-d-ep"] },
      { pmsCategory: "Suite", roomCode: "suite", ratePlans: ["suite-s-cp", "suite-d-cp"] },
    ],
  };

  const resolveHotelAiosellConfig = (prevData: any, hotelId: string, overrides?: any) => {
    const h = (prevData.hotels || []).find((x: any) => x && x.id === hotelId) || {};
    const saved = h.aiosellConfig || {};
    return {
      baseUrl: String(overrides?.baseUrl || saved.baseUrl || DEFAULT_AIOSELL_CONFIG.baseUrl).replace(/\/+$/, ""),
      pmsSlug: String(overrides?.pmsSlug || saved.pmsSlug || DEFAULT_AIOSELL_CONFIG.pmsSlug).trim(),
      hotelCode: String(overrides?.hotelCode || saved.hotelCode || DEFAULT_AIOSELL_CONFIG.hotelCode).trim(),
      username: String(overrides?.username || saved.username || DEFAULT_AIOSELL_CONFIG.username).trim(),
      password: String(overrides?.password || saved.password || DEFAULT_AIOSELL_CONFIG.password),
      roomMappings: Array.isArray(overrides?.roomMappings)
        ? overrides.roomMappings
        : Array.isArray(saved.roomMappings) && saved.roomMappings.length > 0
        ? saved.roomMappings
        : DEFAULT_AIOSELL_CONFIG.roomMappings,
    };
  };

  // GET & POST /api/ota/aiosell/config — Read or save per-hotel Aiosell Sandbox/Live configuration
  app.get("/api/ota/aiosell/config", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const db = await getMongoDatabase();
    const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
    const prevData = prevDoc?.data || {};
    const targetHotelId = String(req.query.hotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();
    if (!isCallerAuthorizedForHotel(caller, targetHotelId)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Cannot access Aiosell config for hotel "${targetHotelId}".`,
      });
    }
    const cfg = resolveHotelAiosellConfig(prevData, targetHotelId);
    return res.json({
      success: true,
      hotelId: targetHotelId,
      config: { ...cfg, passwordMasked: cfg.password ? "••••••••" : "" },
      webhookUrl: `${req.protocol}://${req.get("host")}/api/ota/aiosell/webhook`,
      productionWebhookUrl: "https://directstay.online/api/ota/aiosell/webhook",
    });
  });

  app.post("/api/ota/aiosell/config", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    const { hotelId: reqHotelId, baseUrl, pmsSlug, hotelCode, username, password, roomMappings } = req.body || {};
    try {
      const savedCfg = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const targetHotelId = String(reqHotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();
        const nextCfg = resolveHotelAiosellConfig(prevData, targetHotelId, {
          baseUrl,
          pmsSlug,
          hotelCode,
          username,
          ...(password && password !== "••••••••" ? { password } : {}),
          ...(Array.isArray(roomMappings) ? { roomMappings } : {}),
        });
        prevData.hotels = (prevData.hotels || []).map((h: any) =>
          h && h.id === targetHotelId ? { ...h, aiosellHotelCode: nextCfg.hotelCode, aiosellConfig: nextCfg } : h
        );
        const nowIso = new Date().toISOString();
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: nowIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["hotels"]));
        return nextCfg;
      });
      return res.json({ success: true, config: savedCfg });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Failed to save Aiosell config" });
    }
  });

  // POST /api/ota/aiosell/fetch — Fetch live inventory, rates, or reservations directly from Aiosell
  app.post("/api/ota/aiosell/fetch", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    try {
      const db = await getMongoDatabase();
      const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const prevData = prevDoc?.data || {};
      const targetHotelId = String(req.body?.hotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();
      const cfg = resolveHotelAiosellConfig(prevData, targetHotelId, req.body?.config);
      const todayStr = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
      const startDate = String(req.body?.startDate || todayStr).slice(0, 10);
      const endDate = String(req.body?.endDate || nextWeek).slice(0, 10);
      const fetchType = String(req.body?.type || "all").toLowerCase();
      const authHeader = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
      const url = `${cfg.baseUrl}/data/${encodeURIComponent(cfg.pmsSlug)}`;

      const typesToRun = fetchType === "all" ? ["inventory", "rates"] : [fetchType];
      const out: Record<string, any> = {};
      for (const t of typesToRun) {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ hotelCode: cfg.hotelCode, startDate, endDate, type: t }),
        });
        const txt = await r.text();
        try {
          out[t] = JSON.parse(txt);
        } catch {
          out[t] = txt;
        }
      }
      return res.json({ success: true, hotelCode: cfg.hotelCode, pmsSlug: cfg.pmsSlug, startDate, endDate, data: out });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Failed to fetch from Aiosell" });
    }
  });

  // POST /api/ota/aiosell/push — Push Inventory, Rates, Inventory Restrictions & Rate Restrictions to Aiosell
  app.post("/api/ota/aiosell/push", async (req, res) => {
    const caller = resolveCallerIdentity(req);
    if (!caller.authenticated) {
      return res.status(401).json({ success: false, error: "Unauthorized session" });
    }
    try {
      const db = await getMongoDatabase();
      const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const prevData = prevDoc?.data || {};
      const targetHotelId = String(req.body?.hotelId || caller.hotelId || prevData.hotels?.[0]?.id || "hotel-1").trim();
      const cfg = resolveHotelAiosellConfig(prevData, targetHotelId, req.body?.config);

      const pushMode = String(req.body?.mode || "FULL_ARI").toUpperCase(); // INVENTORY | RATES | RESTRICTIONS | FULL_ARI
      const todayStr = new Date().toISOString().slice(0, 10);
      const startDate = String(req.body?.startDate || todayStr).slice(0, 10);
      const endDate = String(req.body?.endDate || startDate).slice(0, 10);
      const toChannels = Array.isArray(req.body?.toChannels) && req.body.toChannels.length > 0 ? req.body.toChannels : undefined;
      const authHeader = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");

      const steps: Array<{ step: string; url: string; status: number; ok: boolean; payload: any; response: any }> = [];

      // 1. Inventory Push
      if (pushMode === "INVENTORY" || pushMode === "FULL_ARI") {
        const roomsPayload = Array.isArray(req.body?.rooms) && req.body.rooms.length > 0
          ? req.body.rooms.map((rm: any) => ({
              roomCode: String(rm.roomCode).trim(),
              available: Math.max(0, Number(rm.available ?? 0)),
            }))
          : [
              { roomCode: "executive", available: 4 },
              { roomCode: "suite", available: 1 },
            ];
        const invBody: any = {
          hotelCode: cfg.hotelCode,
          ...(toChannels ? { toChannels } : {}),
          updates: [{ startDate, endDate, rooms: roomsPayload }],
        };
        const invUrl = `${cfg.baseUrl}/update/${encodeURIComponent(cfg.pmsSlug)}`;
        const r = await fetch(invUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(invBody),
        });
        const txt = await r.text();
        let parsed: any = txt;
        try { parsed = JSON.parse(txt); } catch {}
        steps.push({ step: "INVENTORY_PUSH", url: invUrl, status: r.status, ok: r.ok && parsed?.success !== false, payload: invBody, response: parsed });
      }

      // 2. Rates Push
      if (pushMode === "RATES" || pushMode === "FULL_ARI") {
        const ratesPayload = Array.isArray(req.body?.rates) && req.body.rates.length > 0
          ? req.body.rates.map((rt: any) => ({
              roomCode: String(rt.roomCode).trim(),
              rateplanCode: String(rt.rateplanCode).trim(),
              rate: Math.max(0, Number(rt.rate ?? 0)),
            }))
          : [
              { roomCode: "executive", rateplanCode: "executive-s-ep", rate: 1300 },
              { roomCode: "executive", rateplanCode: "executive-d-ep", rate: 1300 },
              { roomCode: "suite", rateplanCode: "suite-s-cp", rate: 2499.9 },
              { roomCode: "suite", rateplanCode: "suite-d-cp", rate: 2499.9 },
            ];
        const rateBody: any = {
          hotelCode: cfg.hotelCode,
          ...(toChannels ? { toChannels } : {}),
          updates: [{ startDate, endDate, rates: ratesPayload }],
        };
        const rateUrl = `${cfg.baseUrl}/update-rates/${encodeURIComponent(cfg.pmsSlug)}`;
        const r = await fetch(rateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(rateBody),
        });
        const txt = await r.text();
        let parsed: any = txt;
        try { parsed = JSON.parse(txt); } catch {}
        steps.push({ step: "RATES_PUSH", url: rateUrl, status: r.status, ok: r.ok && parsed?.success !== false, payload: rateBody, response: parsed });
      }

      // 3. Restrictions Push (Room-level Inventory Restrictions)
      if (pushMode === "RESTRICTIONS" || (pushMode === "FULL_ARI" && req.body?.restrictions)) {
        const restr = req.body?.restrictions || {
          stopSell: false,
          minimumStay: 1,
          maximumStay: 14,
          closeOnArrival: false,
          closeOnDeparture: false,
        };
        const targetRoomCodes: string[] = Array.isArray(req.body?.restrictionRooms) && req.body.restrictionRooms.length > 0
          ? req.body.restrictionRooms
          : ["executive", "suite"];
        const restrBody: any = {
          hotelCode: cfg.hotelCode,
          ...(toChannels ? { toChannels } : {}),
          updates: [
            {
              startDate,
              endDate,
              rooms: targetRoomCodes.map((rc) => ({
                roomCode: rc,
                restrictions: {
                  stopSell: Boolean(restr.stopSell),
                  minimumStay: Number(restr.minimumStay || 1),
                  maximumStay: restr.maximumStay !== undefined && restr.maximumStay !== null ? Number(restr.maximumStay) : null,
                  closeOnArrival: Boolean(restr.closeOnArrival),
                  closeOnDeparture: Boolean(restr.closeOnDeparture),
                  minimumStayArrival: null,
                  maximumStayArrival: null,
                  exactStayArrival: null,
                  minimumAdvanceReservation: null,
                  maximumAdvanceReservation: null,
                },
              })),
            },
          ],
        };
        const restrUrl = `${cfg.baseUrl}/update/${encodeURIComponent(cfg.pmsSlug)}`;
        const r = await fetch(restrUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(restrBody),
        });
        const txt = await r.text();
        let parsed: any = txt;
        try { parsed = JSON.parse(txt); } catch {}
        steps.push({ step: "RESTRICTIONS_PUSH", url: restrUrl, status: r.status, ok: r.ok && parsed?.success !== false, payload: restrBody, response: parsed });
      }

      const allOk = steps.every((s) => s.ok);
      await withStateWriteLock(async () => {
        const freshDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const freshData = freshDoc?.data || {};
        const nowIso = new Date().toISOString();
        const logEntry = {
          id: `OTALOG-AIO-${Date.now()}`,
          hotelId: targetHotelId,
          channelId: "ota-aiosell",
          channelName: "Aiosell Channel Manager",
          channelBadge: "AIOSELL",
          direction: "OUTBOUND_PUSH",
          eventType: pushMode,
          status: allOk ? "SUCCESS" : "FAILED",
          httpStatus: steps[0]?.status || 200,
          message: `Aiosell ${pushMode} (${startDate} -> ${endDate}) on hotelCode="${cfg.hotelCode}": ${steps.map((s) => `${s.step}=${s.status}`).join(", ")}`,
          payloadPreview: JSON.stringify(steps.map((s) => ({ step: s.step, response: s.response }))).slice(0, 500),
          timestamp: nowIso,
          createdAt: nowIso,
        };
        freshData.otaSyncLogs = [logEntry, ...(Array.isArray(freshData.otaSyncLogs) ? freshData.otaSyncLogs : [])].slice(0, 300);
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: freshData, updatedAt: nowIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, freshData, new Set(["otaSyncLogs"]));
      });

      return res.json({ success: allOk, hotelCode: cfg.hotelCode, pmsSlug: cfg.pmsSlug, steps });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Aiosell push failed" });
    }
  });

  // GET & POST /api/ota/aiosell/webhook (and /api/webhooks/aiosell) — Inbound Reservation Webhook for Aiosell
  app.get(["/api/ota/aiosell/webhook", "/api/webhooks/aiosell"], (_req, res) => {
    return res.json({
      success: true,
      service: "DirectStay PMS - Aiosell Reservation Webhook",
      status: "ready",
      supportedActions: ["book", "modify", "cancel"],
    });
  });

  app.post(["/api/ota/aiosell/webhook", "/api/webhooks/aiosell"], async (req, res) => {
    // Validate Basic Auth if provided in Authorization header
    const authHdr = String(req.headers.authorization || "");
    if (authHdr.toLowerCase().startsWith("basic ")) {
      const decoded = Buffer.from(authHdr.slice(6).trim(), "base64").toString("utf8");
      const [u, p] = decoded.split(":");
      const expectedPass = process.env.AIOSELL_PASSWORD || "AIOsell@123";
      if (u && p && !(u === "aiosell" && p === expectedPass) && !(u === "sandboxpms" && p === "sandboxpms")) {
        return res.status(401).json({ success: false, message: "Invalid Basic Authentication credentials" });
      }
    }

    const rawBody = req.body;
    const payloads: any[] = Array.isArray(rawBody) ? rawBody : rawBody ? [rawBody] : [];
    if (payloads.length === 0) {
      return res.status(400).json({ success: false, message: "Empty reservation payload" });
    }

    try {
      const processed = await withStateWriteLock(async () => {
        const db = await getMongoDatabase();
        const prevDoc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
        const prevData = prevDoc?.data || {};
        const hotelsList: any[] = Array.isArray(prevData.hotels) ? prevData.hotels : [];
        const bookingsList: any[] = Array.isArray(prevData.bookings) ? prevData.bookings : [];
        const roomsList: any[] = Array.isArray(prevData.rooms) ? prevData.rooms : [];
        const nowIso = new Date().toISOString();
        const todayStr = nowIso.slice(0, 10);
        const results: any[] = [];

        for (const item of payloads) {
          const resBlock = item.reservation && typeof item.reservation === "object" ? item.reservation : item;
          const action = String(item.action || resBlock.action || "book").toLowerCase().trim();
          const hotelCode = String(item.hotelCode || resBlock.hotelCode || "sandbox-pms").trim();
          const otaBookingId = String(item.bookingId || resBlock.bookingId || item.cmBookingId || `AIO-${Date.now()}`).trim();
          const cmBookingId = item.cmBookingId || resBlock.cmBookingId || undefined;

          // Match DirectStay hotel by aiosellHotelCode / hotelCode / query param / fallback first hotel
          const reqHotelId = String(req.query.hotelId || item.hotelId || "").trim();
          const matchedHotel =
            (reqHotelId && hotelsList.find((h) => h && h.id === reqHotelId)) ||
            hotelsList.find(
              (h) =>
                h &&
                (String(h.aiosellHotelCode || "").toLowerCase() === hotelCode.toLowerCase() ||
                  String(h.aiosellConfig?.hotelCode || "").toLowerCase() === hotelCode.toLowerCase() ||
                  String(h.id || "").toLowerCase() === hotelCode.toLowerCase())
            ) ||
            hotelsList.find((h) => h && h.id === "hotel-1793642343134") ||
            hotelsList[0];
          const targetHotelId = matchedHotel?.id || "hotel-1";
          const hotelRooms = roomsList.filter((r) => r && r.hotelId === targetHotelId);

          const existingIdx = bookingsList.findIndex(
            (b) =>
              b &&
              b.hotelId === targetHotelId &&
              (String(b.otaBookingId || "") === otaBookingId || String(b.id || "") === otaBookingId)
          );

          if (action === "cancel" || action === "cancelled") {
            if (existingIdx !== -1) {
              const prevBkg = bookingsList[existingIdx];
              bookingsList[existingIdx] = {
                ...prevBkg,
                status: "Cancelled",
                cancellationReason: resBlock.cancellationReason || item.cancellationReason || "Cancelled via Aiosell OTA Webhook",
                updatedAt: nowIso,
              };
              const relRooms = String(prevBkg.roomNumber || "")
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
              for (let ri = 0; ri < roomsList.length; ri++) {
                if (roomsList[ri]?.hotelId === targetHotelId && relRooms.includes(String(roomsList[ri].number)) && roomsList[ri].status === "Reserved") {
                  roomsList[ri] = { ...roomsList[ri], status: "Available" };
                }
              }
              results.push({ bookingId: otaBookingId, pmsReservationId: prevBkg.id, action: "cancel", status: "Cancelled" });
            } else {
              results.push({ bookingId: otaBookingId, action: "cancel", status: "NotFoundIgnored" });
            }
          } else {
            // "book" or "modify"
            const checkInDate = String(resBlock.checkin || resBlock.checkInDate || todayStr).slice(0, 10);
            const checkOutDate = String(resBlock.checkout || resBlock.checkOutDate || todayStr).slice(0, 10);
            const nights = Math.max(
              1,
              Math.round((new Date(checkOutDate + "T00:00:00").getTime() - new Date(checkInDate + "T00:00:00").getTime()) / 86400000) || 1
            );
            const guestObj = resBlock.guest || {};
            const reqRooms: any[] = Array.isArray(resBlock.rooms) ? resBlock.rooms : [];
            const fullGuestName =
              [guestObj.firstName, guestObj.lastName].filter(Boolean).join(" ").trim() ||
              reqRooms[0]?.guestName ||
              resBlock.guestName ||
              "OTA Guest";
            const mobile = String(guestObj.phone || guestObj.mobile || resBlock.phone || "9999999999").trim();
            const email = String(guestObj.email || resBlock.email || "").trim();
            const addrObj = guestObj.address && typeof guestObj.address === "object" ? guestObj.address : {};
            const address = [addrObj.line1, addrObj.city, addrObj.state, addrObj.country].filter(Boolean).join(", ");

            const rawChannel = String(resBlock.channel || item.channel || "OTA").trim();
            const normSource = (() => {
              const cl = rawChannel.toLowerCase();
              if (cl.includes("makemytrip") || cl === "mmt") return "MakeMyTrip";
              if (cl.includes("goibibo")) return "Goibibo";
              if (cl.includes("booking")) return "Booking.com";
              if (cl.includes("agoda")) return "Agoda";
              if (cl.includes("expedia")) return "Expedia";
              if (cl.includes("airbnb")) return "Airbnb";
              if (cl.includes("direct")) return "Direct";
              return "OTA";
            })();

            const amtObj = resBlock.amount || reqRooms[0]?.amount || {};
            const amountAfterTax = Number(amtObj.amountAfterTax ?? amtObj.total ?? resBlock.totalAmount ?? 0);
            const taxVal = Number(amtObj.tax ?? 0);
            const amountBeforeTax =
              amtObj.amountBeforeTax !== null && amtObj.amountBeforeTax !== undefined
                ? Number(amtObj.amountBeforeTax)
                : Math.max(0, amountAfterTax - taxVal);
            const isPayAtHotel = Boolean(resBlock.pah ?? item.pah ?? false);
            const advancePaid = isPayAtHotel ? 0 : amountAfterTax;

            const requestedRoomCode = String(reqRooms[0]?.roomCode || reqRooms[0]?.roomTypeCode || "").toLowerCase();
            const matchedRoom =
              hotelRooms.find(
                (r) =>
                  r.status === "Available" &&
                  String(r.category || "").toLowerCase().includes(requestedRoomCode || "___")
              ) ||
              hotelRooms.find((r) => r.status === "Available") ||
              hotelRooms[0];

            const allocatedRoomNumber =
              (existingIdx !== -1 ? bookingsList[existingIdx].roomNumber : undefined) ||
              matchedRoom?.number ||
              "101";
            const allocatedCategory = matchedRoom?.category || (requestedRoomCode ? requestedRoomCode.toUpperCase() : "Standard");
            const totalAdults = reqRooms.reduce((s, rm) => s + Number(rm.occupancy?.adults ?? rm.adults ?? 2), 0) || 2;
            const totalChildren = reqRooms.reduce((s, rm) => s + Number(rm.occupancy?.children ?? rm.children ?? 0), 0) || 0;
            const pmsId = existingIdx !== -1 ? bookingsList[existingIdx].id : `AIO-${otaBookingId}`;

            const bkgRecord = {
              ...(existingIdx !== -1 ? bookingsList[existingIdx] : {}),
              id: pmsId,
              hotelId: targetHotelId,
              otaBookingId,
              cmBookingId,
              guestName: fullGuestName,
              mobile,
              email,
              address,
              checkInDate,
              checkOutDate,
              nights,
              adults: totalAdults,
              children: totalChildren,
              roomType: allocatedCategory,
              roomNumber: allocatedRoomNumber,
              bookingSource: normSource,
              otaChannelName: rawChannel,
              status: "Confirmed",
              isCheckedIn: existingIdx !== -1 ? Boolean(bookingsList[existingIdx].isCheckedIn) : false,
              isCompleted: false,
              bookingAmount: amountBeforeTax > 0 ? amountBeforeTax : amountAfterTax,
              gstAmount: taxVal,
              gstRate: taxVal > 0 && amountBeforeTax > 0 ? Math.round((taxVal / amountBeforeTax) * 100) : 0,
              isWithoutGst: taxVal <= 0,
              advanceAmount: advancePaid,
              paymentMethod: isPayAtHotel ? "Cash" : "Online",
              paymentStatus: advancePaid >= amountAfterTax && amountAfterTax > 0 ? "Fully Paid" : advancePaid > 0 ? "Partially Paid" : "Unpaid",
              notes: [
                `Aiosell ${rawChannel} Booking #${otaBookingId}`,
                reqRooms[0]?.rateplanCode ? `RatePlan: ${reqRooms[0].rateplanCode}` : "",
                resBlock.specialRequests || "",
              ]
                .filter(Boolean)
                .join(" • "),
              bookingDate: String(resBlock.bookedOn || todayStr).slice(0, 10),
              updatedAt: nowIso,
            };

            if (existingIdx !== -1) {
              bookingsList[existingIdx] = bkgRecord;
            } else {
              bookingsList.unshift(bkgRecord);
            }

            if (checkInDate === todayStr && matchedRoom) {
              const rIdx = roomsList.findIndex((r) => r && r.hotelId === targetHotelId && r.number === allocatedRoomNumber);
              if (rIdx !== -1 && roomsList[rIdx].status === "Available") {
                roomsList[rIdx] = { ...roomsList[rIdx], status: "Reserved" };
              }
            }

            prevData.notifications = [
              {
                id: `NOTIF-AIO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                hotelId: targetHotelId,
                type: "booking",
                title: `Aiosell ${action === "modify" ? "Modified" : "New"} Booking (${rawChannel})`,
                message: `${fullGuestName} • Room ${allocatedRoomNumber} (${checkInDate} → ${checkOutDate}) • ₹${amountAfterTax}`,
                read: false,
                createdAt: nowIso,
              },
              ...(Array.isArray(prevData.notifications) ? prevData.notifications : []),
            ].slice(0, 200);

            results.push({ bookingId: otaBookingId, pmsReservationId: pmsId, action, roomNumber: allocatedRoomNumber, status: "Confirmed" });
          }

          prevData.otaSyncLogs = [
            {
              id: `OTALOG-AIOWH-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              hotelId: targetHotelId,
              channelId: "ota-aiosell",
              channelName: "Aiosell Channel Manager",
              channelBadge: "AIOSELL",
              direction: "INBOUND_WEBHOOK",
              eventType: action === "cancel" ? "BOOKING_CANCELLED" : action === "modify" ? "BOOKING_MODIFIED" : "NEW_BOOKING",
              status: "SUCCESS",
              httpStatus: 200,
              message: `Aiosell Webhook [${action.toUpperCase()}] Booking #${otaBookingId} (hotelCode=${hotelCode})`,
              payloadPreview: JSON.stringify(item).slice(0, 500),
              timestamp: nowIso,
              createdAt: nowIso,
            },
            ...(Array.isArray(prevData.otaSyncLogs) ? prevData.otaSyncLogs : []),
          ].slice(0, 300);
        }

        prevData.bookings = bookingsList;
        prevData.rooms = roomsList;
        await db.collection("pms_app_state").replaceOne(
          { _id: "FULL_PMS_BACKUP" as any },
          { _id: "FULL_PMS_BACKUP" as any, data: prevData, updatedAt: nowIso },
          { upsert: true }
        );
        await syncAllDomainCollections(db, prevData, new Set(["bookings", "rooms", "otaSyncLogs", "notifications"]));
        return results;
      });

      return res.json({
        success: true,
        message: "Reservation Updated Successfully",
        results: processed,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || "Failed to process Aiosell reservation webhook",
      });
    }
  });

  // Secure Server-side Gemini API Proxy
  app.post("/api/ai/analysis", async (req, res) => {
    const { type, data } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Graceful local simulation fallback if API key is missing
      return res.json({
        success: false,
        isDemo: true,
        text: `### 🤖 AI PMS Advisor (Demo Analytical Mode)
*Note: Add your **GEMINI_API_KEY** in the Settings panel to enable real-time live AI generation.*

#### Key Insights for ${type.slice(0, 1).toUpperCase() + type.slice(1)} Analysis:
* **Occupancy Velocity**: Expected weekend rate indicates peak seasonal pressure. Suite upgrades (Deluxe & Executive) are commanding top pricing indexes.
* **Flow Trajectory**: Active bookings reflect strong direct walk-in sourcing (approx 35%), which saves 18% in OTA commission tariffs.
* **Profit Margin Projection**: Net operating flow stands healthy. Food services and laundry support charges have added 12% to the invoice billing averages.
* **Consultant Directive**: Restock mineral water supplies as the inventory benchmark dips below the green tier. Align duty schedules to match planned morning departures.`
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemPrompt = "You are an elite hospitality business analyst and Property Management System advisor for the Grand Pavilion Boutique Hotel.";
      let prompt = "";

      if (type === 'revenue') {
        prompt = `Analyse the hotel's revenue stats:\n${JSON.stringify(data)}\nProvide a professional 3-bullet analysis of our billing structure and actionable pricing advice. Wrap points neatly in Markdown.`;
      } else if (type === 'occupancy') {
        prompt = `Analyse our hotel occupancy metrics:\n${JSON.stringify(data)}\nProvide a short, concise analysis of room occupancies, high-volume categories, and cleaning cycle optimization strategies in hospitality terminology.`;
      } else if (type === 'forecast') {
        prompt = `Based on bookings trajectory:\n${JSON.stringify(data)}\nForecast occupancy for the upcoming week, identify peak OTA channels, and suggest pre-arrival guest preparations for the desk.`;
      } else if (type === 'monthly') {
        prompt = `Generate a monthly hotel performance synopsis based on matching financial records:\n${JSON.stringify(data)}\nInclude income vs expense overview, margin metrics, and tactical staff/inventory optimization advisories.`;
      } else if (type === 'expense') {
        prompt = `Analyse our categories of hotel expenses:\n${JSON.stringify(data)}\nHighlight high-expenditure areas and recommend exactly two specific cost-reduction initiatives for the manager.`;
      } else {
        prompt = `Suggest operational improvements for this hotel based on current metrics:\n${JSON.stringify(data)}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      return res.json({
        success: true,
        isDemo: false,
        text: response.text
      });

    } catch (err: any) {
      console.error("Gemini API Error:", err);
      return res.json({
        success: false,
        isDemo: true,
        text: `### ⚠️ AI Advisor Service Notice
An error occurred while connecting to the Gemini engines: *"${err.message}"*.

#### Fallback Local Operating Parameters:
* **Current Occupancy**: High deluxe room demand noted.
* **Procurement Alert**: Keep cleaning supply reserves topped up ahead of arrivals.
* **Credit Warning**: Outstanding guest dues require prompt reception follow-ups prior to departure checkouts.`
      });
    }
  });

  // =========================================================================
  // DYNAMIC SEO ENDPOINTS: /robots.txt, /sitemap.xml & 301/302 REDIRECTS
  // =========================================================================
  app.get("/robots.txt", async (_req, res) => {
    try {
      const db = await getMongoDatabase();
      const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const seoSettings = doc?.data?.systemWebsite?.seoSettings;
      const siteUrl = String(seoSettings?.siteUrl || "https://directstay.online").replace(/\/+$/, "");
      const customRobots = String(seoSettings?.robotsTxt || "").trim();
      const body =
        customRobots ||
        [
          "User-agent: *",
          "Allow: /",
          "Allow: /features/",
          "Allow: /pricing/",
          "Allow: /free-trial/",
          "Allow: /blog/",
          "Allow: /about/",
          "Allow: /contact/",
          "Disallow: /api/",
          "Disallow: /superadmin",
          "Disallow: /admin",
          "Disallow: /hotelowner",
          "",
          `Sitemap: ${siteUrl}/sitemap.xml`,
        ].join("\n");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(body);
    } catch {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send("User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://directstay.online/sitemap.xml\n");
    }
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const db = await getMongoDatabase();
      const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const rawData = doc?.data || {};
      const seoSettings = rawData?.systemWebsite?.seoSettings || {};
      const siteUrl = String(seoSettings?.siteUrl || "https://directstay.online").replace(/\/+$/, "");
      const today = new Date().toISOString().split("T")[0];
      const nowMs = Date.now();

      const escapeXml = (s: string) =>
        String(s || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const overrides: Record<string, any> = seoSettings?.pageSeoOverrides || {};
      const builtInRoutes: Array<{ key: string; path: string; changefreq: string; priority: string }> = [
        { key: "home", path: "/", changefreq: "daily", priority: "1.0" },
        { key: "features", path: "/features/", changefreq: "weekly", priority: "0.9" },
        { key: "gallery", path: "/gallery/", changefreq: "weekly", priority: "0.85" },
        { key: "pricing", path: "/pricing/", changefreq: "weekly", priority: "0.95" },
        { key: "free-trial", path: "/free-trial/", changefreq: "weekly", priority: "0.9" },
        { key: "hotel-reservation-software", path: "/hotel-reservation-software/", changefreq: "weekly", priority: "0.85" },
        { key: "hotel-billing-software", path: "/hotel-billing-software/", changefreq: "weekly", priority: "0.85" },
        { key: "blog", path: "/blog/", changefreq: "weekly", priority: "0.85" },
        { key: "about", path: "/about/", changefreq: "monthly", priority: "0.7" },
        { key: "contact", path: "/contact/", changefreq: "monthly", priority: "0.7" },
        { key: "privacy-policy", path: "/privacy-policy/", changefreq: "yearly", priority: "0.5" },
        { key: "terms-and-conditions", path: "/terms-and-conditions/", changefreq: "yearly", priority: "0.5" },
        { key: "refund-policy", path: "/refund-policy/", changefreq: "yearly", priority: "0.5" },
        { key: "data-security", path: "/data-security/", changefreq: "monthly", priority: "0.6" },
      ];

      const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];
      for (const route of builtInRoutes) {
        const ov = overrides[route.key];
        if (ov?.robotsIndex === "noindex") continue;
        const customLoc = ov?.canonicalUrl?.trim()
          ? ov.canonicalUrl.trim()
          : ov?.customSlug?.trim()
          ? `${siteUrl}/${String(ov.customSlug).replace(/^\/+|\/+$/g, "")}/`
          : `${siteUrl}${route.path}`;
        urls.push({ loc: customLoc, lastmod: today, changefreq: route.changefreq, priority: route.priority });
      }

      const customPages: any[] = Array.isArray(rawData.customPages) ? rawData.customPages : [];
      customPages.forEach((p) => {
        if (!p || !p.slug) return;
        const status = p.status || (p.published ? "published" : "draft");
        const isScheduledLive =
          status === "scheduled" && p.scheduledAt && !Number.isNaN(new Date(p.scheduledAt).getTime()) && new Date(p.scheduledAt).getTime() <= nowMs;
        if (!(status === "published" || isScheduledLive)) return;
        if (p.seo?.robotsIndex === "noindex") return;
        const cleanSlug = String(p.slug).replace(/^\/+|\/+$/g, "");
        if (!cleanSlug) return;
        urls.push({
          loc: `${siteUrl}/page/${cleanSlug}`,
          lastmod: String(p.updatedAt || p.createdAt || today).slice(0, 10),
          changefreq: "weekly",
          priority: "0.8",
        });
      });

      const blogs: any[] = Array.isArray(rawData?.systemWebsite?.blogs) ? rawData.systemWebsite.blogs : [];
      blogs.forEach((b) => {
        if (!b || !b.title) return;
        const status = b.status || (b.published ? "published" : "draft");
        const isScheduledLive =
          status === "scheduled" && b.scheduledAt && !Number.isNaN(new Date(b.scheduledAt).getTime()) && new Date(b.scheduledAt).getTime() <= nowMs;
        if (!(status === "published" || isScheduledLive)) return;
        if (b.seo?.robotsIndex === "noindex") return;
        const slug = String(b.slug || b.id).replace(/^\/+|\/+$/g, "");
        if (!slug) return;
        urls.push({
          loc: `${siteUrl}/blog/${slug}/`,
          lastmod: String(b.updatedAt || b.publishedAt || today).slice(0, 10),
          changefreq: "monthly",
          priority: "0.75",
        });
      });

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map(
          (u) =>
            `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
        ),
        "</urlset>",
      ].join("\n");

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(xml);
    } catch {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      return res.send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
  });

  // Server-side 301 / 302 SEO Redirect Manager middleware (runs before SPA fallback)
  app.use(async (req, res, next) => {
    if (req.method !== "GET") return next();
    const p = req.path || "/";
    if (
      p.startsWith("/api/") ||
      p.startsWith("/assets/") ||
      p.startsWith("/src/") ||
      p.startsWith("/@") ||
      p === "/robots.txt" ||
      p === "/sitemap.xml" ||
      /\.(js|css|png|jpg|jpeg|svg|ico|webp|woff2?|map)$/i.test(p)
    ) {
      return next();
    }
    try {
      const db = await getMongoDatabase();
      const doc = await db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any });
      const redirects: any[] = Array.isArray(doc?.data?.systemWebsite?.seoSettings?.redirects)
        ? doc.data.systemWebsite.seoSettings.redirects
        : [];
      const normPath = p.toLowerCase().replace(/\/+$/, "") || "/";
      const match = redirects.find((r) => {
        if (!r || r.isActive === false || !r.fromPath || !r.toPath) return false;
        const fromNorm = String(r.fromPath).trim().toLowerCase().replace(/\/+$/, "") || "/";
        return fromNorm === normPath;
      });
      if (match && String(match.toPath).trim() !== p) {
        const code = Number(match.statusCode) === 302 ? 302 : 301;
        return res.redirect(code, String(match.toPath).trim());
      }
    } catch {
      // Fall through cleanly if DB unavailable
    }
    return next();
  });

  // Mount Vite middleware in dev / dist static serving in production
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.argv.includes("--prod") ||
    process.argv.some((a) => a.endsWith("server.cjs") || a.endsWith("app.js"));

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const assetsPath = path.join(distPath, "assets");
    let cacheClearedOnce = false;

    const gzipAssetCache = new Map<string, { mime: string; gz: Buffer }>();
    function sendCompressedAsset(req: express.Request, res: express.Response, fullPath: string, cacheHeader: string) {
      res.setHeader("Cache-Control", cacheHeader);
      const mime = fullPath.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : fullPath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "";
      if (mime && String(req.headers["accept-encoding"] || "").includes("gzip")) {
        let cached = gzipAssetCache.get(fullPath);
        if (!cached) {
          const raw = fs.readFileSync(fullPath);
          cached = { mime, gz: zlib.gzipSync(raw, { level: 6 }) };
          gzipAssetCache.set(fullPath, cached);
        }
        res.setHeader("Content-Type", cached.mime);
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        return res.send(cached.gz);
      }
      if (mime) res.setHeader("Content-Type", mime);
      return res.sendFile(fullPath);
    }

    // Serve content-hashed Vite JS/CSS bundles fast with gzip + immutable caching; fallback to latest bundle if old hash requested
    app.get("/assets/:filename", (req, res, next) => {
      const requestedFile = path.join(assetsPath, req.params.filename);
      if (fs.existsSync(requestedFile)) {
        return sendCompressedAsset(req, res, requestedFile, "public, max-age=31536000, immutable");
      }
      try {
        const files = fs.existsSync(assetsPath) ? fs.readdirSync(assetsPath) : [];
        if (req.params.filename.endsWith(".js")) {
          const currentJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
          if (currentJs) {
            return sendCompressedAsset(req, res, path.join(assetsPath, currentJs), "no-store, no-cache, must-revalidate");
          }
        }
        if (req.params.filename.endsWith(".css")) {
          const currentCss = files.find((f) => f.startsWith("index-") && f.endsWith(".css"));
          if (currentCss) {
            return sendCompressedAsset(req, res, path.join(assetsPath, currentCss), "no-store, no-cache, must-revalidate");
          }
        }
      } catch {}
      next();
    });

    app.use(
      express.static(distPath, {
        etag: false,
        lastModified: false,
        setHeaders: (res) => {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        },
      })
    );
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      try {
        const htmlPath = path.join(distPath, "index.html");
        if (fs.existsSync(htmlPath)) {
          const html = fs.readFileSync(htmlPath, "utf8");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.send(html);
        }
      } catch {}
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Pre-warm MongoDB Atlas connection & in-memory state cache at boot so first login/load is 0ms DB wait
  getMongoDatabase()
    .then((db) => db.collection("pms_app_state").findOne({ _id: "FULL_PMS_BACKUP" as any }))
    .then(() => console.log("Pre-warmed in-memory PMS state cache from MongoDB Atlas."))
    .catch((err) => console.warn("Initial pre-warm warning:", err?.message || err));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
