import { r2 } from '../../utils/billCalculator';

export type PosDiscountType = 'percent' | 'fixed';

export interface PosBillInput {
  lines: { unitPrice: number; qty: number }[];
  discountEnabled: boolean;
  discountType: PosDiscountType;
  discountValue: number;
  /** Effective GST % for this order (0 when GST is switched off). Comes from hotel settings - never hardcoded. */
  gstPct: number;
  settlementEnabled: boolean;
  /** Agreed final GST-inclusive payable amount ('' = not used). */
  settlementFinal: number | '';
}

export interface PosBillResult {
  subtotal: number;
  /** Discount actually entered by the cashier (before any negotiated settlement). */
  discountEntered: number;
  taxableBeforeSettlement: number;
  taxBeforeSettlement: number;
  grandBeforeSettlement: number;
  settlementApplied: boolean;
  /** Reduction caused by the negotiated settlement (0 when not applied). */
  settlementAdjustment: number;
  /** Final taxable value after discount + settlement. */
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  /** Effective pre-tax discount = subtotal - taxable (never negative). */
  discount: number;
  payable: number;
}

export function computePosBill(input: PosBillInput): PosBillResult {
  const subtotal = r2(input.lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0), 0));
  const rawDisc = input.discountEnabled
    ? input.discountType === 'percent'
      ? r2((subtotal * Math.min(100, Math.max(0, Number(input.discountValue) || 0))) / 100)
      : Math.max(0, Number(input.discountValue) || 0)
    : 0;
  const discountEntered = r2(Math.min(subtotal, rawDisc));
  const gst = Math.max(0, Number(input.gstPct) || 0);
  const taxableBefore = r2(Math.max(0, subtotal - discountEntered));
  const taxBefore = r2((taxableBefore * gst) / 100);
  const grandBefore = r2(taxableBefore + taxBefore);

  const finalNum = input.settlementFinal === '' ? NaN : Number(input.settlementFinal);
  const settlementApplied =
    input.settlementEnabled && Number.isFinite(finalNum) && finalNum >= 0 && finalNum < grandBefore - 0.004;

  if (!settlementApplied) {
    const cgst = r2(taxBefore / 2);
    const sgst = r2(taxBefore - cgst);
    return {
      subtotal,
      discountEntered,
      taxableBeforeSettlement: taxableBefore,
      taxBeforeSettlement: taxBefore,
      grandBeforeSettlement: grandBefore,
      settlementApplied: false,
      settlementAdjustment: 0,
      taxable: taxableBefore,
      tax: taxBefore,
      cgst,
      sgst,
      discount: discountEntered,
      payable: grandBefore,
    };
  }

  // Negotiated final amount is GST-inclusive: re-derive taxable value + tax from it so the tax stays correct.
  const payable = r2(finalNum);
  const taxable = gst > 0 ? r2(payable / (1 + gst / 100)) : payable;
  const tax = r2(payable - taxable);
  const cgst = r2(tax / 2);
  const sgst = r2(tax - cgst);
  return {
    subtotal,
    discountEntered,
    taxableBeforeSettlement: taxableBefore,
    taxBeforeSettlement: taxBefore,
    grandBeforeSettlement: grandBefore,
    settlementApplied: true,
    settlementAdjustment: r2(grandBefore - payable),
    taxable,
    tax,
    cgst,
    sgst,
    discount: r2(Math.max(0, subtotal - taxable)),
    payable,
  };
}

export interface PayRow {
  method: string;
  amount: number;
  reference?: string;
  upiUtr?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationStatus?: 'unverified' | 'verified';
  cardNetwork?: string;
  cardLast4?: string;
  cardTerminal?: string;
  bankName?: string;
  bankRef?: string;
  cashTendered?: number;
  changeReturned?: number;
  notes?: string;
}

export const sumPayRows = (rows: PayRow[]): number => r2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));

export type PosPayStatus = 'Paid' | 'Partially Paid' | 'Unpaid';

export function resolvePayStatus(payable: number, received: number): PosPayStatus {
  if (payable <= 0.004) return 'Paid';
  if (received >= payable - 0.5) return 'Paid';
  if (received > 0.004) return 'Partially Paid';
  return 'Unpaid';
}

/** Method that received the largest amount (used for legacy single-mode readers). */
export function dominantMethod(rows: PayRow[], fallback = 'Cash'): string {
  const totals: Record<string, number> = {};
  rows.forEach((r) => {
    totals[r.method] = (totals[r.method] || 0) + (Number(r.amount) || 0);
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? entries[0][0] : fallback;
}

/**
 * Allocate payment rows across several open orders (oldest first) so every rupee is applied exactly once.
 * Returns the payment slices for each order id and any unallocated remainder.
 */
export function allocatePayRows(
  orders: { id: string; due: number }[],
  rows: PayRow[]
): { byOrder: Record<string, PayRow[]>; unallocated: number } {
  const pool = rows
    .filter((r) => (Number(r.amount) || 0) > 0)
    .map((r) => ({ ...r, remaining: r2(Number(r.amount) || 0) }));
  const byOrder: Record<string, PayRow[]> = {};
  orders.forEach((o) => {
    let need = r2(Math.max(0, o.due));
    byOrder[o.id] = [];
    for (const p of pool) {
      if (need <= 0.004) break;
      if (p.remaining <= 0.004) continue;
      const take = r2(Math.min(p.remaining, need));
      p.remaining = r2(p.remaining - take);
      need = r2(need - take);
      byOrder[o.id].push({
        method: p.method,
        amount: take,
        reference: p.reference,
        upiUtr: p.upiUtr,
        verifiedBy: p.verifiedBy,
        verifiedAt: p.verifiedAt,
        verificationStatus: p.verificationStatus,
        cardNetwork: p.cardNetwork,
        cardLast4: p.cardLast4,
        cardTerminal: p.cardTerminal,
        bankName: p.bankName,
        bankRef: p.bankRef,
        cashTendered: p.cashTendered,
        changeReturned: p.changeReturned,
        notes: p.notes,
      });
    }
  });
  const unallocated = r2(pool.reduce((s, p) => s + p.remaining, 0));
  return { byOrder, unallocated };
}

/** 4-decimal precision rounding for raw material BOM / stock weights (e.g. 0.291 PCS, 0.25 KG). */
export const r4 = (n: number): number => Math.round((Number(n) || 0) * 10000) / 10000;

/**
 * Parse menu portion/variant or add-on text like "Half:180, Full:280" or "Half: ₹180, Full - ₹280".
 */
export function parseMenuPairText(raw: string): { id: string; name: string; price: number }[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair, idx) => {
      const m = pair.match(/^([^:=\-]+)[:=\-]\s*(.+)$/);
      const rawName = (m ? m[1] : pair).trim();
      const rawPrice = m ? m[2].replace(/[^\d.]/g, '') : '';
      return {
        id: `opt-${idx + 1}`,
        name: rawName || `Option ${idx + 1}`,
        price: r2(Math.max(0, Number(rawPrice) || 0)),
      };
    });
}

/**
 * Compute configured selling price for a menu item given its selected portion (variant) and optional add-ons.
 * Predefined portion prices (e.g. Half ₹180 vs Full ₹280) are configured prices — NEVER manual price overrides.
 */
export function getConfiguredMenuUnitPrice(
  item: { price: number; variants?: { name: string; price: number }[]; addons?: { name: string; price: number }[] },
  variantName?: string,
  selectedAddons?: string[]
): { basePortionPrice: number; addonTotal: number; configuredUnitPrice: number } {
  const cleanVar = String(variantName || '').trim().toLowerCase();
  const matchedVariant = cleanVar
    ? item.variants?.find((v) => String(v.name || '').trim().toLowerCase() === cleanVar)
    : undefined;
  const basePortionPrice =
    matchedVariant && Number(matchedVariant.price) > 0
      ? r2(Number(matchedVariant.price))
      : r2(Number(item.price) || 0);

  const addonTotal = r2(
    (selectedAddons || []).reduce((sum, aName) => {
      const cleanAddon = String(aName || '').trim().toLowerCase();
      const foundAddon = item.addons?.find(
        (a) => String(a.name || '').trim().toLowerCase() === cleanAddon
      );
      return sum + (foundAddon ? Math.max(0, Number(foundAddon.price) || 0) : 0);
    }, 0)
  );

  return {
    basePortionPrice,
    addonTotal,
    configuredUnitPrice: r2(basePortionPrice + addonTotal),
  };
}

/**
 * Returns true ONLY when an authorized user explicitly set a custom selling price that differs from
 * the item's configured portion + add-on price. Selecting Half (₹180) vs Full (₹280) returns false.
 */
export function isManualPriceOverride(
  customUnitPrice: number | undefined,
  configuredUnitPrice: number
): boolean {
  if (customUnitPrice === undefined || !Number.isFinite(customUnitPrice)) return false;
  return Math.abs(customUnitPrice - configuredUnitPrice) >= 0.005;
}

/**
 * Strip duplicate trailing " (Variant)" suffix from historical order item names so KDS/KOT/Invoices
 * never render "Chicken Biryani (Half) (Half)".
 */
export function cleanOrderItemBaseName(rawName: string, variant?: string): string {
  let clean = String(rawName || '').trim();
  const v = String(variant || '').trim();
  if (v) {
    const suffix = ` (${v})`;
    while (clean.toLowerCase().endsWith(suffix.toLowerCase())) {
      clean = clean.slice(0, clean.length - suffix.length).trim();
    }
  }
  return clean;
}
