import React, { useState } from 'react';
import { HotelSettings, InvoiceConditionsConfig } from '../types';
import { DEFAULT_INVOICE_CONDITIONS, normalizeInvoiceConditions } from '../utils/invoiceConditions';
import { showToast } from '../utils/toast';
import { FileCheck2, X, Save } from 'lucide-react';

interface InvoiceConditionsModalProps {
  hotelSettings?: HotelSettings;
  onUpdateHotelSettings?: (updated: HotelSettings) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  onClose: () => void;
}

const cardCls = 'bg-[#FAFBFD] border border-luxury-brown-100 rounded-xl p-3.5 space-y-2';
const chipCls = (checked: boolean) =>
  `flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono cursor-pointer ${
    checked
      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
      : 'bg-white border-slate-200 text-slate-600'
  }`;

export default function InvoiceConditionsModal({
  hotelSettings,
  onUpdateHotelSettings,
  onAddAuditLog,
  onClose
}: InvoiceConditionsModalProps) {
  const gstEnabled = hotelSettings?.isGstEnabled !== false;
  const gstRate = gstEnabled ? Number(hotelSettings?.defaultGstRate ?? 5) : 0;

  const [cfg, setCfg] = useState<InvoiceConditionsConfig>(() =>
    normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
      isGstEnabled: gstEnabled,
      defaultGstRate: gstRate
    })
  );

  const set = (patch: Partial<InvoiceConditionsConfig>) => setCfg(prev => ({ ...prev, ...patch }));

  const toggleInList = <T extends string>(list: T[], item: T, on: boolean, label: string): T[] | null => {
    const next = on ? Array.from(new Set([...list, item])) : list.filter(i => i !== item);
    if (next.length === 0) {
      showToast(`At least one ${label} must remain allowed.`, 'warning');
      return null;
    }
    return next;
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('pms_session_token') || sessionStorage.getItem('pms_auth_token');
      if (token) {
        headers['x-session-token'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  };

  const handleSave = async () => {
    if (!hotelSettings || !onUpdateHotelSettings) {
      showToast('Hotel settings are unavailable.', 'error');
      return;
    }
    const saved = normalizeInvoiceConditions(cfg, { isGstEnabled: gstEnabled, defaultGstRate: gstRate });
    onUpdateHotelSettings({ ...hotelSettings, invoiceConditions: saved });

    if (hotelSettings.id) {
      try {
        await fetch('/api/invoices/conditions', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ hotelId: hotelSettings.id, invoiceConditions: saved })
        });
      } catch {
        // Local state is still persisted through the regular PMS state sync
      }
    }
    onAddAuditLog?.(
      'Invoice Conditions Updated',
      `Trigger: ${saved.triggerEvent}, Mode: ${saved.generationMode}, Min Amount: ${
        saved.minimumAmountEnabled ? `₹${saved.minimumInvoiceAmount}` : 'Off'
      }, Duplicate Prevention: ${saved.preventDuplicateFinalInvoice ? 'On' : 'Off'}.`
    );
    showToast('Invoice Conditions saved successfully', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
      <div className="bg-white rounded-2xl border border-[#C49A3A]/30 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#17120F] text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#C49A3A]/20 text-[#C49A3A] border border-[#C49A3A]/40">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-white">Invoice Conditions</h3>
              <p className="text-[11px] font-mono text-slate-300">
                All 8 rules in one place — 1 booking/stay = 1 final invoice. Invoice Status and Payment Status stay separate.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Trigger */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 1 • Trigger</span>
              <label className="text-xs font-bold text-[#263449] block">Invoice Generation Trigger</label>
              <select
                value={cfg.triggerEvent}
                onChange={e => set({ triggerEvent: e.target.value as InvoiceConditionsConfig['triggerEvent'] })}
                className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
              >
                <option value="checkout">On Guest Check-Out (Recommended)</option>
                <option value="checkin">From Guest Check-In onwards</option>
                <option value="booking_confirmation">From Booking Confirmation onwards</option>
                <option value="manual_only">Manual Admin Action Only</option>
              </select>
              <p className="text-[10px] text-slate-500">Business event that allows invoice creation.</p>
            </div>

            {/* 2. Booking status */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 2 • Booking Status</span>
              <label className="text-xs font-bold text-[#263449] block">Allowed Booking Statuses</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['Confirmed', 'Checked In', 'CheckedOut', 'Pending'] as const).map(st => {
                  const checked = cfg.allowedBookingStatuses.includes(st);
                  return (
                    <label key={st} className={chipCls(checked)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const next = toggleInList(cfg.allowedBookingStatuses, st, e.target.checked, 'booking status');
                          if (next) set({ allowedBookingStatuses: next });
                        }}
                      />
                      <span>{st === 'CheckedOut' ? 'Checked Out' : st}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500">Cancelled bookings are always blocked.</p>
            </div>

            {/* 3. Payment status */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 3 • Payment Status</span>
              <label className="text-xs font-bold text-[#263449] block">Allowed Payment Statuses</label>
              <div className="space-y-1">
                {(['Unpaid', 'Partially Paid', 'Paid'] as const).map(pst => {
                  const checked = cfg.allowedPaymentStatuses.includes(pst);
                  return (
                    <label key={pst} className={chipCls(checked)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const next = toggleInList(cfg.allowedPaymentStatuses, pst, e.target.checked, 'payment status');
                          if (next) set({ allowedPaymentStatuses: next });
                        }}
                      />
                      <span>{pst}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500">Generating an invoice never marks it Paid.</p>
            </div>

            {/* 4. Check-in / check-out */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 4 • Check-In / Check-Out</span>
              <label className="text-xs font-bold text-[#263449] block">Stay Validation</label>
              <label className="flex items-center gap-2 text-xs font-mono text-[#263449] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.requireCheckIn}
                  onChange={e => set({ requireCheckIn: e.target.checked })}
                />
                <span>Require Check-In</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-[#263449] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.requireCheckOutForFinal}
                  onChange={e => set({ requireCheckOutForFinal: e.target.checked })}
                />
                <span>Require Check-Out for Final Invoice</span>
              </label>
              <p className="text-[10px] text-slate-500">Final bill includes room, extra bed, food, laundry/water, services and fines.</p>
            </div>

            {/* 5. Minimum amount */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 5 • Minimum Amount</span>
              <label className="text-xs font-bold text-[#263449] block">Minimum Invoice Amount</label>
              <label className="flex items-center gap-2 text-xs font-mono text-[#263449] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.minimumAmountEnabled}
                  onChange={e => set({ minimumAmountEnabled: e.target.checked })}
                />
                <span>Enable (optional)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  disabled={!cfg.minimumAmountEnabled}
                  value={cfg.minimumInvoiceAmount}
                  onChange={e => set({ minimumInvoiceAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full px-2.5 py-1 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold disabled:opacity-50 bg-white"
                />
              </div>
              <p className="text-[10px] text-slate-500">Turn off if not required.</p>
            </div>

            {/* 6. Auto / manual */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 6 • Auto / Manual</span>
              <label className="text-xs font-bold text-[#263449] block">Generation Mode</label>
              <select
                value={cfg.generationMode}
                onChange={e => set({ generationMode: e.target.value as InvoiceConditionsConfig['generationMode'] })}
                className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
              >
                <option value="auto_and_manual">Automatic & Manual</option>
                <option value="auto_only">Automatic Only</option>
                <option value="manual_only">Manual Only</option>
              </select>
              <label className="flex items-center gap-2 text-xs font-mono text-[#263449] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.autoGenerateOnCheckout}
                  onChange={e => set({ autoGenerateOnCheckout: e.target.checked })}
                />
                <span>Auto-generate on checkout</span>
              </label>
            </div>

            {/* 7. Duplicate prevention */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 7 • Duplicate Prevention</span>
              <label className="text-xs font-bold text-[#263449] block">One Final Invoice per Stay</label>
              <label className="flex items-center gap-2 text-xs font-mono text-[#263449] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.preventDuplicateFinalInvoice}
                  onChange={e => set({ preventDuplicateFinalInvoice: e.target.checked })}
                />
                <span>Enforce 1 final invoice per booking</span>
              </label>
              <p className="text-[10px] text-slate-500">Checked on frontend and backend. Existing invoice is shown instead of a new one.</p>
            </div>

            {/* 8. Tax */}
            <div className={cardCls}>
              <span className="text-[10px] font-mono uppercase font-bold text-[#C49A3A]">Condition 8 • Tax</span>
              <label className="text-xs font-bold text-[#263449] block">Tax Applies On</label>
              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                {([
                  ['taxOnRoom', 'Room Tariff'],
                  ['taxOnExtraBed', 'Extra Bed'],
                  ['taxOnFood', 'POS / Food'],
                  ['taxOnAncillary', 'Services']
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg[key]}
                      onChange={e => set({ [key]: e.target.checked } as Partial<InvoiceConditionsConfig>)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs font-mono text-[#263449] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.splitCgstSgst}
                  onChange={e => set({ splitCgstSgst: e.target.checked })}
                />
                <span>Show CGST + SGST split</span>
              </label>
              <p className="text-[10px] text-slate-500">
                GST rate {gstRate}% comes from Settings. Tax is applied once on the pre-tax amount.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-luxury-brown-100 bg-[#FAFBFD] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              setCfg(
                normalizeInvoiceConditions(DEFAULT_INVOICE_CONDITIONS, {
                  isGstEnabled: gstEnabled,
                  defaultGstRate: gstRate
                })
              )
            }
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#263449] border border-luxury-brown-200 rounded-xl text-xs font-bold cursor-pointer"
          >
            Reset to Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-[#263449] border border-luxury-brown-200 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-[#15805D] hover:bg-[#11694B] !text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Invoice Conditions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
