import React, { useEffect, useState } from 'react';
import { Copy, Check, QrCode, Building2, CreditCard, Globe } from 'lucide-react';
import { getPmsData } from '../utils/dummyData';
import { showToast } from '../utils/toast';

/**
 * Reflects the hotel's own "Configuration → Payment Mode" setup (enabled tenders,
 * custom tenders, UPI VPA, Bank details…) inside Check-In / Check-Out payment selectors,
 * and shows the matching live UPI QR scanner / Bank account card for the selected mode.
 *
 * If the hotel has never configured Payment Modes, `configured` is false and every caller
 * keeps its original (legacy) dropdown — nothing changes for those hotels.
 */

export const PAYMENT_MODES_UPDATED_EVENT = 'directstay:payment-modes-updated';

export interface HotelPaymentMode {
  id: string;
  name: string;
  type: 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Gateway' | 'Corporate' | 'Custom' | string;
  enabled?: boolean;
  upiId?: string;
  merchantName?: string;
  terminalId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  surchargePercent?: number;
  notes?: string;
}

export type PaymentVariant = 'checkin' | 'checkout';

export interface PaymentOption {
  value: string;
  label: string;
  mode: HotelPaymentMode;
  isCustom: boolean;
}

/**
 * Old builds pre-filled Payment Mode setup with demo/sample values (fake UPI VPA, EDC terminal,
 * HDFC bank account, PayU key…). Those were never entered by the hotel, so any value that is an
 * EXACT leftover of that demo seed is treated as "not set" — no hotel ever collects money into a
 * fake UPI ID / bank account and every field starts blank for the hotel to fill in.
 * Values typed by the hotel itself are never touched.
 */
const SEED_DEMO_VALUES = {
  upiId: 'directstayhotel@upi',
  merchantName: 'Harsh Hotel DirectStay',
  terminalId: 'POS-TERM-8891',
  bankName: 'HDFC Bank Ltd',
  accountNumber: '50200088992211',
  ifscCode: 'HDFC0001234',
  payuKey: 'PAYU_LIVE_KEY_99',
  payuSalt: 'PAYU_SALT_DIRECTSTAY',
};

export function stripSeedDemoPaymentValues<T extends Record<string, any>>(mode: T): T {
  if (!mode || typeof mode !== 'object') return mode;
  const m: Record<string, any> = { ...mode };
  const eq = (k: keyof typeof SEED_DEMO_VALUES) =>
    String(m[k] ?? '').trim().toLowerCase() === SEED_DEMO_VALUES[k].toLowerCase();

  const upiIsSeed = eq('upiId');
  if (upiIsSeed) m.upiId = '';
  if (upiIsSeed && eq('merchantName')) m.merchantName = '';
  if (eq('terminalId')) m.terminalId = '';
  const bankIsSeed = eq('ifscCode') || eq('accountNumber');
  if (bankIsSeed) {
    if (eq('ifscCode')) m.ifscCode = '';
    if (eq('accountNumber')) m.accountNumber = '';
    if (eq('bankName')) m.bankName = '';
  }
  if (eq('payuKey')) m.payuKey = '';
  if (eq('payuSalt')) m.payuSalt = '';
  return m as T;
}

const cleanModes = (arr: any): HotelPaymentMode[] =>
  Array.isArray(arr)
    ? arr
        .filter((m) => m && typeof m === 'object' && m.id && m.name)
        .map((m) => stripSeedDemoPaymentValues(m))
    : [];

export function readHotelPaymentModes(hotelId?: string, fallback?: any[] | null): HotelPaymentMode[] {
  const fromFallback = cleanModes(fallback);
  if (fromFallback.length > 0) return fromFallback;

  try {
    if (hotelId) {
      const hotels: any[] = (getPmsData() as any)?.hotels || [];
      const h = Array.isArray(hotels) ? hotels.find((x) => x && x.id === hotelId) : null;
      const fromHotel = cleanModes(h?.paymentModes);
      if (fromHotel.length > 0) return fromHotel;
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`directstay_pm_${hotelId || 'default'}`);
      if (saved) {
        const parsed = cleanModes(JSON.parse(saved));
        if (parsed.length > 0) return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function useHotelPaymentModes(hotelId?: string, fallback?: any[] | null): HotelPaymentMode[] {
  let sig = '';
  try {
    sig = JSON.stringify(fallback || []);
  } catch {
    sig = '';
  }
  const [modes, setModes] = useState<HotelPaymentMode[]>(() => readHotelPaymentModes(hotelId, fallback));

  useEffect(() => {
    setModes(readHotelPaymentModes(hotelId, fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, sig]);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const d: any = (e as CustomEvent).detail || {};
      if (d.hotelId && hotelId && d.hotelId !== hotelId) return;
      if (Array.isArray(d.modes)) setModes(cleanModes(d.modes));
    };
    window.addEventListener(PAYMENT_MODES_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PAYMENT_MODES_UPDATED_EVENT, onUpdated);
  }, [hotelId]);

  return modes;
}

const BUILTIN_LABELS: Record<PaymentVariant, Record<string, string>> = {
  checkin: {
    Cash: 'Cash',
    UPI: 'UPI',
    Card: 'Card',
    'Bank Transfer': 'Bank Transfer',
    Online: 'Virtual Payment / Online',
  },
  checkout: {
    Cash: 'Cash Drawer',
    UPI: 'UPI / QR Scan',
    Card: 'POS Card Swipe',
    'Bank Transfer': 'NEFT / IMPS Bank Transfer',
    Online: 'Online Gateway / Virtual',
  },
};

export function buildPaymentOptions(
  modes: HotelPaymentMode[],
  variant: PaymentVariant
): { configured: boolean; options: PaymentOption[]; hybridAllowed: boolean } {
  const options: PaymentOption[] = [];
  const seen = new Set<string>();
  let hybridAllowed = true;

  for (const m of modes) {
    if (m.id === 'pay-split') {
      if (m.enabled === false) hybridAllowed = false;
      continue;
    }
    if (m.enabled === false) continue;
    if (m.id === 'pay-corp' || m.type === 'Corporate') continue;

    const isBuiltin = /^pay-(cash|upi|card|bank|gateway)$/.test(String(m.id));
    let value: string;
    if (isBuiltin) {
      value =
        m.type === 'Cash'
          ? 'Cash'
          : m.type === 'UPI'
          ? 'UPI'
          : m.type === 'Card'
          ? 'Card'
          : m.type === 'Bank'
          ? 'Bank Transfer'
          : 'Online';
    } else {
      value = String(m.name || '').trim();
    }
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({
      value,
      label: isBuiltin ? BUILTIN_LABELS[variant][value] || value : String(m.name).trim(),
      mode: m,
      isCustom: !isBuiltin,
    });
  }

  return { configured: modes.length > 0 && options.length > 0, options, hybridAllowed };
}

interface PaymentModeDetailsCardProps {
  modes: HotelPaymentMode[];
  value: string;
  amount?: number;
  variant?: PaymentVariant;
  className?: string;
}

export function PaymentModeDetailsCard({
  modes,
  value,
  amount = 0,
  variant = 'checkin',
  className = '',
}: PaymentModeDetailsCardProps) {
  const [qrIdx, setQrIdx] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { options } = buildPaymentOptions(modes, variant);
  const opt = options.find((o) => o.value === value);
  if (!opt) return null;
  const m = opt.mode;

  const copy = (text: string, key: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast(`${label} copied`, 'success');
      setTimeout(() => setCopiedKey((p) => (p === key ? null : p)), 1800);
    } catch {
      showToast(`${label}: ${text}`, 'info');
    }
  };

  const CopyBtn = ({ text, k, label }: { text: string; k: string; label: string }) => (
    <button
      type="button"
      onClick={() => copy(text, k, label)}
      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FDF8ED] hover:bg-[#F6E9C8] border border-[#C49A3A]/60 text-[10px] font-bold text-[#8B691E] cursor-pointer"
    >
      {copiedKey === k ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      <span>{copiedKey === k ? 'Copied' : 'Copy'}</span>
    </button>
  );

  const wrap = `p-3 rounded-xl bg-white border border-[#C49A3A]/50 space-y-2 ${className}`;
  const amt = Number(amount) || 0;

  // ---------- UPI: live scannable QR ----------
  if (m.type === 'UPI' || (m.upiId && m.type !== 'Bank')) {
    const vpa = String(m.upiId || '').trim();
    if (!vpa) {
      return (
        <div className={wrap}>
          <div className="text-[11px] font-bold text-amber-800">
            UPI ID is not set for "{m.name}" — add it in Configuration → Payment Mode.
          </div>
        </div>
      );
    }
    const payee = String(m.merchantName || m.name || 'Hotel').trim();
    const link =
      `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payee)}` +
      (amt > 0 ? `&am=${amt.toFixed(2)}` : '') +
      `&cu=INR&tn=${encodeURIComponent('Hotel stay payment')}`;
    const qrUrls = [
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&format=png&data=${encodeURIComponent(link)}`,
      `https://quickchart.io/qr?size=180&margin=2&text=${encodeURIComponent(link)}`,
    ];
    const qrUrl = qrUrls[Math.min(qrIdx, qrUrls.length - 1)];
    return (
      <div className={wrap}>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-[#8B691E]">
          <QrCode className="w-3.5 h-3.5" /> {m.name} — Scan &amp; Pay
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <div className="bg-white p-1.5 rounded-lg border border-[#C49A3A]/40 shrink-0">
            <img
              src={qrUrl}
              alt={`UPI QR ${vpa}`}
              referrerPolicy="no-referrer"
              onError={() => {
                if (qrIdx < qrUrls.length - 1) setQrIdx(qrIdx + 1);
              }}
              className="w-28 h-28 object-contain"
            />
          </div>
          <div className="min-w-[170px] flex-1 space-y-1.5 text-xs">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-500">UPI ID</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-[#17120F] [overflow-wrap:anywhere]">{vpa}</span>
                <CopyBtn text={vpa} k="upi" label="UPI ID" />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-500">Merchant</div>
              <div className="font-bold text-[#263449]">{payee}</div>
            </div>
            {amt > 0 && (
              <div className="font-mono font-extrabold text-[#15805D]">
                Amount: ₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Bank: account details ----------
  if (m.type === 'Bank' || m.bankName || m.accountNumber) {
    const rows: Array<{ k: string; label: string; val?: string }> = [
      { k: 'bank', label: 'Bank Name', val: m.bankName },
      { k: 'ifsc', label: 'IFSC Code', val: m.ifscCode },
      { k: 'acc', label: 'Account Number', val: m.accountNumber },
    ];
    return (
      <div className={wrap}>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-[#8B691E]">
          <Building2 className="w-3.5 h-3.5" /> {m.name} — Bank Account Details
        </div>
        <div className="space-y-1.5 text-xs">
          {rows.map((r) => (
            <div key={r.k} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500">{r.label}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-[#17120F] [overflow-wrap:anywhere]">{r.val || '—'}</span>
                {r.val ? <CopyBtn text={String(r.val)} k={r.k} label={r.label} /> : null}
              </span>
            </div>
          ))}
        </div>
        {amt > 0 && (
          <div className="font-mono font-extrabold text-[#15805D] text-xs">
            Amount to transfer: ₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
    );
  }

  // ---------- Card: EDC terminal ----------
  if (m.type === 'Card') {
    return (
      <div className={wrap}>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-[#8B691E]">
          <CreditCard className="w-3.5 h-3.5" /> {m.name} — EDC Swipe
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span>
            <span className="text-[10px] font-mono uppercase text-slate-500">Terminal ID: </span>
            <strong className="font-mono text-[#17120F]">{m.terminalId || '—'}</strong>
          </span>
          <span>
            <span className="text-[10px] font-mono uppercase text-slate-500">Card Surcharge: </span>
            <strong className="font-mono text-[#17120F]">{Number(m.surchargePercent || 0)}%</strong>
          </span>
        </div>
      </div>
    );
  }

  // ---------- Gateway ----------
  if (m.type === 'Gateway') {
    return (
      <div className={wrap}>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-[#8B691E]">
          <Globe className="w-3.5 h-3.5" /> {m.name}
        </div>
        <div className="text-[11px] text-slate-600">
          Online gateway is enabled for this property — collect the guest&apos;s online payment and enter the
          transaction reference.
        </div>
      </div>
    );
  }

  return null;
}

export default PaymentModeDetailsCard;
