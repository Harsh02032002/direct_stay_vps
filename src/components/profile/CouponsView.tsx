import React, { useState, useEffect } from 'react';
import {
  Tag,
  Ticket,
  Plus,
  Trash2,
  Copy,
  Check,
  Save,
  CheckCircle2,
  AlertCircle,
  Percent,
  Sparkles,
  Calendar,
  Gift
} from 'lucide-react';
import { Hotel, PosCoupon } from '../../types';
import { showToast } from '../../utils/toast';

const SEEDED_COUPONS: PosCoupon[] = [
  {
    id: 'cpn-1',
    code: 'WELCOME10',
    discountType: 'Percentage',
    discountValue: 10,
    minOrderValue: 1000,
    active: true,
  },
  {
    id: 'cpn-2',
    code: 'DIRECTSTAY20',
    discountType: 'Percentage',
    discountValue: 20,
    minOrderValue: 2500,
    active: true,
  },
  {
    id: 'cpn-3',
    code: 'FLAT500',
    discountType: 'Fixed',
    discountValue: 500,
    minOrderValue: 3000,
    active: true,
  },
  {
    id: 'cpn-4',
    code: 'WEEKEND15',
    discountType: 'Percentage',
    discountValue: 15,
    minOrderValue: 1800,
    active: false,
  },
];

interface CouponsViewProps {
  activeHotel: Hotel;
  onUpdateGlobalHotels: (updatedHotels: Hotel[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function CouponsView({
  activeHotel,
  onUpdateGlobalHotels,
  onAddAuditLog,
}: CouponsViewProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const storageKey = `directstay_coupons_${activeHotel?.id || 'default'}`;

  const [coupons, setCoupons] = useState<PosCoupon[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
      if (Array.isArray(activeHotel?.coupons) && activeHotel.coupons.length > 0) {
        return activeHotel.coupons;
      }
    } catch {}
    return SEEDED_COUPONS;
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<'Percentage' | 'Fixed'>('Percentage');
  const [newValue, setNewValue] = useState<number>(10);
  const [newMinOrder, setNewMinOrder] = useState<number>(1000);
  const [newActive, setNewActive] = useState<boolean>(true);

  const handleCopy = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast(`Coupon "${code}" copied to clipboard!`, 'info');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  };

  const toggleCouponStatus = (id: string) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  const handleDeleteCoupon = (id: string, code: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    showToast(`Coupon "${code}" deleted`, 'info');
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      showToast('Please enter a valid coupon code.', 'error');
      return;
    }

    if (coupons.some((c) => c.code === cleanCode)) {
      showToast(`Coupon code "${cleanCode}" already exists!`, 'error');
      return;
    }

    const created: PosCoupon = {
      id: `cpn-${Date.now()}`,
      code: cleanCode,
      discountType: newType,
      discountValue: Math.max(1, Number(newValue) || 10),
      minOrderValue: Math.max(0, Number(newMinOrder) || 0),
      active: newActive,
      hotelId: activeHotel?.id,
    };

    setCoupons((prev) => [created, ...prev]);
    setShowModal(false);
    setNewCode('');
    setNewValue(10);
    setNewMinOrder(1000);
    showToast(`Coupon "${cleanCode}" created successfully!`, 'success');
  };

  const handleSaveAll = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(coupons));
      const updatedHotel: Hotel = {
        ...activeHotel,
        coupons,
      };
      onUpdateGlobalHotels([updatedHotel]);

      const activeCount = coupons.filter((c) => c.active).length;
      onAddAuditLog?.(
        'Coupons Manager Updated',
        `Saved ${coupons.length} promotional coupons (${activeCount} active).`
      );

      const msg = `Coupons updated successfully! (${activeCount} active promo codes ready for booking engine & front desk)`;
      setSuccessMsg(msg);
      showToast(msg, 'success', 4500, 'Coupons Saved');
    } catch (err: any) {
      const eMsg = err?.message || 'Failed to save coupons.';
      setErrorMsg(eMsg);
      showToast(eMsg, 'error', 5000, 'Save Failed');
    }
  };

  const activeCount = coupons.filter((c) => c.active).length;

  return (
    <div className="space-y-6">
      {/* Sub-module Header Card */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-700 border border-rose-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-2">
              <Gift className="w-3.5 h-3.5 text-rose-600" /> Marketing &amp; Promotions
            </div>
            <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              Discount Coupons &amp; Promo Codes
            </h2>
            <p className="text-xs text-luxury-brown-500 mt-1">
              Create and manage promotional discount coupons for Front Desk walk-in bookings, direct booking engine website visitors, and POS food orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-luxury-beige-50 hover:bg-luxury-beige-100 text-luxury-brown-900 border border-luxury-brown-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-luxury-gold-600" /> Create Coupon
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-luxury-gold-400" /> Save Coupons
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-luxury-brown-50">
          <div className="bg-luxury-beige-50/50 p-3 rounded-2xl border border-luxury-brown-100">
            <p className="text-[10px] font-mono uppercase text-luxury-brown-400 font-bold">Total Promo Codes</p>
            <p className="text-lg font-serif font-bold text-luxury-brown-950">{coupons.length}</p>
          </div>
          <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
            <p className="text-[10px] font-mono uppercase text-emerald-600 font-bold">Active Right Now</p>
            <p className="text-lg font-serif font-bold text-emerald-900">{activeCount}</p>
          </div>
          <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
            <p className="text-[10px] font-mono uppercase text-blue-600 font-bold">Average Discount</p>
            <p className="text-lg font-serif font-bold text-blue-900">
              {coupons.length > 0
                ? `${Math.round(
                    coupons.reduce((acc, c) => acc + (c.discountType === 'Percentage' ? c.discountValue : 15), 0) /
                      coupons.length
                  )}%`
                : '0%'}
            </p>
          </div>
          <div className="bg-luxury-gold-50/50 p-3 rounded-2xl border border-luxury-gold-200">
            <p className="text-[10px] font-mono uppercase text-luxury-gold-700 font-bold">Direct Channels</p>
            <p className="text-lg font-serif font-bold text-luxury-gold-900">Front Desk + Web</p>
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

      {/* Coupons Table Card */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-luxury-brown-100 flex items-center justify-between">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-luxury-gold-600" />
            Configured Promo Codes Registry
          </h3>
          <span className="text-[11px] text-luxury-brown-500 font-mono">
            {coupons.length} total codes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-luxury-beige-50/70 text-luxury-brown-600 font-mono uppercase text-[10px] border-b border-luxury-brown-100">
              <tr>
                <th className="py-3 px-4">Coupon Code</th>
                <th className="py-3 px-4">Benefit Type</th>
                <th className="py-3 px-4">Discount Amount</th>
                <th className="py-3 px-4">Min. Spend</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-luxury-brown-50">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-luxury-beige-50/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-luxury-brown-950 text-luxury-gold-300 font-mono font-bold text-xs tracking-wider shadow-2xs">
                        {c.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(c.code)}
                        title="Copy coupon code"
                        className="p-1 rounded hover:bg-luxury-brown-100 text-luxury-brown-500 transition-colors cursor-pointer"
                      >
                        {copiedCode === c.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-luxury-brown-800">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        c.discountType === 'Percentage'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {c.discountType === 'Percentage' ? <Percent className="w-3 h-3" /> : '₹ Flat'}
                      {c.discountType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-luxury-brown-950">
                    {c.discountType === 'Percentage' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-luxury-brown-600">
                    {c.minOrderValue > 0 ? `₹${c.minOrderValue.toLocaleString('en-IN')}` : 'None'}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleCouponStatus(c.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                        c.active
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}
                    >
                      {c.active ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(c.id, c.code)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                      title="Delete coupon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-luxury-brown-100 space-y-4">
            <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              <Gift className="w-5 h-5 text-luxury-gold-600" />
              Create Promotional Coupon
            </h3>

            <form onSubmit={handleCreateCoupon} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-luxury-brown-800">Coupon Promo Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MONSOON25 / FESTIVE500"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-luxury-brown-800">Discount Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-white border border-luxury-brown-100 rounded-xl px-3 py-2"
                  >
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Fixed">Flat Amount (₹)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-luxury-brown-800">Discount Value *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newValue}
                    onChange={(e) => setNewValue(Number(e.target.value))}
                    className="w-full bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-luxury-brown-800">Minimum Booking / Order Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={newMinOrder}
                  onChange={(e) => setNewMinOrder(Number(e.target.value))}
                  className="w-full bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newActiveCheck"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="rounded text-luxury-gold-600"
                />
                <label htmlFor="newActiveCheck" className="font-bold text-luxury-brown-900 cursor-pointer">
                  Activate this promo code immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-luxury-brown-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-luxury-brown-200 text-luxury-brown-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-luxury-brown-950 text-white font-bold"
                >
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
