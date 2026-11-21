import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Wallet,
  QrCode,
  Building,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  Globe,
  Coins,
  Receipt
} from 'lucide-react';
import { Hotel, HotelSettings } from '../../types';
import { showToast } from '../../utils/toast';

export interface PaymentMethodConfig {
  id: string;
  name: string;
  type: 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Gateway' | 'Corporate' | 'Custom';
  enabled: boolean;
  upiId?: string;
  merchantName?: string;
  terminalId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  payuKey?: string;
  payuSalt?: string;
  isTestMode?: boolean;
  surchargePercent?: number;
  notes?: string;
}

const DEFAULT_PAYMENT_MODES: PaymentMethodConfig[] = [
  {
    id: 'pay-cash',
    name: 'Cash Register',
    type: 'Cash',
    enabled: true,
    notes: 'Front Desk physical cash tender with cash drawer tracking',
  },
  {
    id: 'pay-upi',
    name: 'UPI & Instant QR Code',
    type: 'UPI',
    enabled: true,
    upiId: 'directstayhotel@upi',
    merchantName: 'Harsh Hotel DirectStay',
    notes: 'Dynamic BharatQR / PhonePe / GPay / Paytm QR code generator at Front Desk & POS',
  },
  {
    id: 'pay-card',
    name: 'Debit & Credit Cards',
    type: 'Card',
    enabled: true,
    terminalId: 'POS-TERM-8891',
    surchargePercent: 0,
    notes: 'EDC Swipe machine for Visa, Mastercard, RuPay & Amex',
  },
  {
    id: 'pay-bank',
    name: 'Bank Transfer (NEFT / RTGS / IMPS)',
    type: 'Bank',
    enabled: true,
    bankName: 'HDFC Bank Ltd',
    accountNumber: '50200088992211',
    ifscCode: 'HDFC0001234',
    notes: 'Direct hotel current account for corporate advance deposits',
  },
  {
    id: 'pay-gateway',
    name: 'Online Gateway (PayU)',
    type: 'Gateway',
    enabled: true,
    payuKey: 'PAYU_LIVE_KEY_99',
    payuSalt: 'PAYU_SALT_DIRECTSTAY',
    isTestMode: false,
    notes: 'Direct online checkout payments for DirectStay booking engine & digital links',
  },
  {
    id: 'pay-split',
    name: 'Split Multi-Tender Payments',
    type: 'Custom',
    enabled: true,
    notes: 'Permit settling guest folios with partial Cash + UPI + Card combination',
  },
  {
    id: 'pay-corp',
    name: 'Corporate Direct Billing Ledger',
    type: 'Corporate',
    enabled: true,
    notes: 'Credit ledger billing for registered corporate clients & travel partners',
  },
];

interface PaymentModeViewProps {
  activeHotel: Hotel;
  hotelSettings?: HotelSettings;
  onUpdateGlobalHotels: (updatedHotels: Hotel[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function PaymentModeView({
  activeHotel,
  onUpdateGlobalHotels,
  onAddAuditLog,
}: PaymentModeViewProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const storageKey = `directstay_pm_${activeHotel?.id || 'default'}`;

  const [modes, setModes] = useState<PaymentMethodConfig[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
      if (Array.isArray(activeHotel?.paymentModes) && activeHotel.paymentModes.length > 0) {
        return activeHotel.paymentModes;
      }
    } catch {}
    return DEFAULT_PAYMENT_MODES;
  });

  // Modal for new custom payment mode
  const [showAddModal, setShowAddModal] = useState(false);
  const [newModeName, setNewModeName] = useState('');
  const [newModeType, setNewModeType] = useState<'Cash' | 'UPI' | 'Card' | 'Bank' | 'Custom'>('Custom');
  const [newModeNotes, setNewModeNotes] = useState('');

  const toggleMode = (id: string) => {
    setModes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const updateModeField = (id: string, field: keyof PaymentMethodConfig, val: any) => {
    setModes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  const handleAddCustomMode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModeName.trim()) return;
    const newEntry: PaymentMethodConfig = {
      id: `pay-custom-${Date.now()}`,
      name: newModeName.trim(),
      type: newModeType,
      enabled: true,
      notes: newModeNotes.trim() || 'Custom hotel tender mode',
    };
    setModes((prev) => [...prev, newEntry]);
    setShowAddModal(false);
    setNewModeName('');
    setNewModeNotes('');
    showToast(`Added "${newEntry.name}" payment mode`, 'success');
  };

  const handleDeleteMode = (id: string) => {
    setModes((prev) => prev.filter((m) => m.id !== id));
    showToast('Payment mode removed', 'info');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      localStorage.setItem(storageKey, JSON.stringify(modes));
      const updatedHotel: Hotel = {
        ...activeHotel,
        paymentModes: modes,
      };
      onUpdateGlobalHotels([updatedHotel]);

      const activeCount = modes.filter((m) => m.enabled).length;
      onAddAuditLog?.(
        'Payment Modes Updated',
        `Updated hotel payment methods: ${activeCount} active modes (Cash, UPI: ${
          modes.find((m) => m.type === 'UPI')?.upiId || 'N/A'
        }, PayU Gateway: ${modes.find((m) => m.type === 'Gateway')?.enabled ? 'Enabled' : 'Disabled'}).`
      );

      const sMsg = `Payment modes saved successfully! (${activeCount} active tenders ready for Front Desk & POS)`;
      setSuccessMsg(sMsg);
      showToast(sMsg, 'success', 4500, 'Payment Setup Saved');
    } catch (err: any) {
      const eMsg = err?.message || 'Failed to save payment modes.';
      setErrorMsg(eMsg);
      showToast(eMsg, 'error', 5000, 'Save Failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-module Header Card */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-2">
              <CreditCard className="w-3.5 h-3.5 text-luxury-gold-600" /> Payment Infrastructure
            </div>
            <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              Payment Modes &amp; Gateway Setup
            </h2>
            <p className="text-xs text-luxury-brown-500 mt-1">
              Configure accepted payment tenders, UPI VPA addresses, Card EDC terminals, bank accounts, and PayU integration for Front Desk, POS, and online reservations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-luxury-beige-50 hover:bg-luxury-beige-100 text-luxury-brown-900 border border-luxury-brown-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-luxury-gold-600" /> Add Custom Tender
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-luxury-gold-400" />
              {isSaving ? 'Saving...' : 'Save Payment Modes'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Settings Saved</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Save Failed</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Payment Modes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {modes.map((mode) => (
          <div
            key={mode.id}
            className={`border rounded-3xl p-5 transition-all shadow-sm ${
              mode.enabled
                ? 'bg-white border-luxury-brown-200'
                : 'bg-luxury-beige-50/40 border-luxury-brown-100 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-luxury-brown-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    mode.type === 'Cash'
                      ? 'bg-amber-100 text-amber-800'
                      : mode.type === 'UPI'
                      ? 'bg-emerald-100 text-emerald-800'
                      : mode.type === 'Card'
                      ? 'bg-blue-100 text-blue-800'
                      : mode.type === 'Bank'
                      ? 'bg-purple-100 text-purple-800'
                      : mode.type === 'Gateway'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-luxury-beige-100 text-luxury-brown-800'
                  }`}
                >
                  {mode.type === 'Cash' && <Coins className="w-5 h-5" />}
                  {mode.type === 'UPI' && <QrCode className="w-5 h-5" />}
                  {mode.type === 'Card' && <CreditCard className="w-5 h-5" />}
                  {mode.type === 'Bank' && <Building className="w-5 h-5" />}
                  {mode.type === 'Gateway' && <Globe className="w-5 h-5" />}
                  {(mode.type === 'Custom' || mode.type === 'Corporate') && <Wallet className="w-5 h-5" />}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-luxury-brown-950 flex items-center gap-2">
                    {mode.name}
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        mode.enabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {mode.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-luxury-brown-500 mt-0.5">{mode.notes}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mode.enabled}
                    onChange={() => toggleMode(mode.id)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>

                {mode.id.startsWith('pay-custom-') && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMode(mode.id)}
                    className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mode-specific Configuration Inputs */}
            <div className="pt-4 space-y-3">
              {mode.type === 'UPI' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-luxury-brown-700">UPI VPA ID (Virtual Payment Address)</label>
                    <input
                      type="text"
                      placeholder="e.g. hotel@okhdfcbank"
                      value={mode.upiId || ''}
                      onChange={(e) => updateModeField(mode.id, 'upiId', e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-luxury-brown-700">Merchant Business Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Harsh Hotel DirectStay"
                      value={mode.merchantName || ''}
                      onChange={(e) => updateModeField(mode.id, 'merchantName', e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              )}

              {mode.type === 'Card' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-luxury-brown-700">EDC Terminal ID</label>
                    <input
                      type="text"
                      placeholder="e.g. TERM-8891"
                      value={mode.terminalId || ''}
                      onChange={(e) => updateModeField(mode.id, 'terminalId', e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-luxury-brown-700">Card Surcharge (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={mode.surchargePercent || 0}
                      onChange={(e) => updateModeField(mode.id, 'surchargePercent', Number(e.target.value))}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                </div>
              )}

              {mode.type === 'Bank' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-luxury-brown-700">Bank Name</label>
                      <input
                        type="text"
                        placeholder="HDFC Bank"
                        value={mode.bankName || ''}
                        onChange={(e) => updateModeField(mode.id, 'bankName', e.target.value)}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-1.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-luxury-brown-700">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="HDFC0001234"
                        value={mode.ifscCode || ''}
                        onChange={(e) => updateModeField(mode.id, 'ifscCode', e.target.value.toUpperCase())}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-1.5 font-mono uppercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-luxury-brown-700">Current Account Number</label>
                    <input
                      type="text"
                      placeholder="50200088992211"
                      value={mode.accountNumber || ''}
                      onChange={(e) => updateModeField(mode.id, 'accountNumber', e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-1.5 font-mono"
                    />
                  </div>
                </div>
              )}

              {mode.type === 'Gateway' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-luxury-brown-700">PayU Merchant Key</label>
                      <input
                        type="text"
                        placeholder="Key"
                        value={mode.payuKey || ''}
                        onChange={(e) => updateModeField(mode.id, 'payuKey', e.target.value)}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-1.5 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-luxury-brown-700">PayU Merchant Salt</label>
                      <input
                        type="password"
                        placeholder="Salt"
                        value={mode.payuSalt || ''}
                        onChange={(e) => updateModeField(mode.id, 'payuSalt', e.target.value)}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[11px] text-luxury-brown-600 font-medium">Gateway Environment</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mode.isTestMode}
                        onChange={(e) => updateModeField(mode.id, 'isTestMode', e.target.checked)}
                        className="rounded text-luxury-gold-600"
                      />
                      <span className="text-[11px] font-mono font-bold text-amber-700">
                        {mode.isTestMode ? 'Sandbox / Test Mode' : 'Production Live Mode'}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-luxury-brown-100 space-y-4">
            <h3 className="text-base font-serif font-bold text-luxury-brown-950">Add Custom Payment Tender</h3>
            <form onSubmit={handleAddCustomMode} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-luxury-brown-800">Tender Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Travel Agent Voucher / Sodexo"
                  value={newModeName}
                  onChange={(e) => setNewModeName(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-100 rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-luxury-brown-800">Tender Category</label>
                <select
                  value={newModeType}
                  onChange={(e) => setNewModeType(e.target.value as any)}
                  className="w-full bg-white border border-luxury-brown-100 rounded-xl px-3 py-2"
                >
                  <option value="Custom">Custom / Other Voucher</option>
                  <option value="UPI">UPI / Digital Wallet</option>
                  <option value="Card">Card Terminal</option>
                  <option value="Bank">Bank Deposit</option>
                  <option value="Cash">Cash Ledger</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-luxury-brown-800">Operational Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Requires authorization voucher"
                  value={newModeNotes}
                  onChange={(e) => setNewModeNotes(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-100 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-luxury-brown-200 text-luxury-brown-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-luxury-brown-950 text-white font-bold"
                >
                  Add Tender
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
