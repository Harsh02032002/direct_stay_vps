import React, { useState, useEffect } from 'react';
import {
  Clock,
  Users,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Moon,
  Sun,
  Sunset,
  Coins,
  FileCheck
} from 'lucide-react';
import { Hotel, Staff } from '../../types';
import { showToast } from '../../utils/toast';

export interface ShiftTimingConfig {
  id: string;
  name: string;
  type: 'Morning' | 'Evening' | 'NightAudit';
  startTime: string; // "07:00"
  endTime: string;   // "15:00"
  enabled: boolean;
  assignedRoles: string[];
  description: string;
}

const DEFAULT_SHIFTS: ShiftTimingConfig[] = [
  {
    id: 'shift-morning',
    name: 'Morning Shift (1st Shift)',
    type: 'Morning',
    startTime: '07:00',
    endTime: '15:00',
    enabled: true,
    assignedRoles: ['Receptionist', 'Housekeeping', 'Manager'],
    description: 'Handles morning check-outs, breakfast dining billing, and initial room departures & turn-downs.',
  },
  {
    id: 'shift-evening',
    name: 'Evening Shift (2nd Shift)',
    type: 'Evening',
    startTime: '15:00',
    endTime: '23:00',
    enabled: true,
    assignedRoles: ['Receptionist', 'Front Desk', 'Room Service'],
    description: 'Handles peak arrival check-ins, walk-ins, restaurant dinner orders, and daily collection reconciliations.',
  },
  {
    id: 'shift-night',
    name: 'Night Audit Shift (Overnight)',
    type: 'NightAudit',
    startTime: '23:00',
    endTime: '07:00',
    enabled: true,
    assignedRoles: ['Night Auditor', 'Admin', 'Security'],
    description: 'Performs midnight guest folio auditing, room tariff charges posting, no-show processing, and date rollover.',
  },
];

interface ShiftSetupViewProps {
  activeHotel: Hotel;
  rawStaff?: Staff[];
  onUpdateGlobalHotels: (updatedHotels: Hotel[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function ShiftSetupView({
  activeHotel,
  rawStaff = [],
  onUpdateGlobalHotels,
  onAddAuditLog,
}: ShiftSetupViewProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const storageKey = `directstay_shifts_${activeHotel?.id || 'default'}`;

  const [shifts, setShifts] = useState<ShiftTimingConfig[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
      if (activeHotel?.shiftSettings?.shifts) {
        return activeHotel.shiftSettings.shifts;
      }
    } catch {}
    return DEFAULT_SHIFTS;
  });

  // Policies
  const [requireCashHandover, setRequireCashHandover] = useState(true);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [nightAuditRunTime, setNightAuditRunTime] = useState('02:00');
  const [maxDrawerLimit, setMaxDrawerLimit] = useState(25000);
  const [autoCloseShift, setAutoCloseShift] = useState(true);

  const updateShiftTime = (id: string, field: 'startTime' | 'endTime', val: string) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const toggleShiftEnabled = (id: string) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload = {
        shifts,
        requireCashHandover,
        gracePeriodMinutes,
        nightAuditRunTime,
        maxDrawerLimit,
        autoCloseShift,
      };

      localStorage.setItem(storageKey, JSON.stringify(payload));

      const updatedHotel: Hotel = {
        ...activeHotel,
        shiftSettings: payload,
      };
      onUpdateGlobalHotels([updatedHotel]);

      onAddAuditLog?.(
        'Shift Timings & Policies Updated',
        `Configured shift timings: Morning (${shifts[0].startTime}-${shifts[0].endTime}), Evening (${shifts[1].startTime}-${shifts[1].endTime}), Night (${shifts[2].startTime}-${shifts[2].endTime}). Cash handover mandatory: ${requireCashHandover ? 'YES' : 'NO'}.`
      );

      const msg = 'Shift timings and handover configuration saved successfully!';
      setSuccessMsg(msg);
      showToast(msg, 'success', 4500, 'Shift Setup Saved');
    } catch (err: any) {
      const eMsg = err?.message || 'Failed to save shift configuration.';
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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-2">
              <Clock className="w-3.5 h-3.5 text-blue-600" /> Operational Rostering
            </div>
            <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              Shift Setup &amp; Duty Timings
            </h2>
            <p className="text-xs text-luxury-brown-500 mt-1">
              Configure front office and housekeeping operational shifts, physical cash handover reconciliations, grace periods, and night audit automation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luxury-beige-50 border border-luxury-brown-100 text-luxury-brown-800 text-xs font-mono font-bold">
              Total Staff Registered: {rawStaff.length}
            </span>
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Shift Timings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {shifts.map((s) => (
            <div
              key={s.id}
              className={`bg-white border rounded-3xl p-5 shadow-sm space-y-4 transition-all ${
                s.enabled ? 'border-luxury-brown-200' : 'border-luxury-brown-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between pb-3 border-b border-luxury-brown-50">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                      s.type === 'Morning'
                        ? 'bg-amber-100 text-amber-800'
                        : s.type === 'Evening'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-luxury-brown-900 text-luxury-gold-400'
                    }`}
                  >
                    {s.type === 'Morning' && <Sun className="w-4.5 h-4.5" />}
                    {s.type === 'Evening' && <Sunset className="w-4.5 h-4.5" />}
                    {s.type === 'NightAudit' && <Moon className="w-4.5 h-4.5" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-luxury-brown-950">{s.name}</h4>
                    <span className="text-[10px] font-mono text-luxury-brown-400 uppercase">
                      {s.type}
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => toggleShiftEnabled(s.id)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-luxury-gold-600"></div>
                </label>
              </div>

              <p className="text-[11px] text-luxury-brown-600 min-h-[34px] leading-relaxed">
                {s.description}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-700 uppercase font-mono">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={s.startTime}
                    onChange={(e) => updateShiftTime(s.id, 'startTime', e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-luxury-brown-700 uppercase font-mono">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={s.endTime}
                    onChange={(e) => updateShiftTime(s.id, 'endTime', e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-mono uppercase text-luxury-brown-400 font-bold mb-1">
                  Assigned Departments:
                </p>
                <div className="flex flex-wrap gap-1">
                  {s.assignedRoles.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded-md bg-luxury-beige-100 text-luxury-brown-800 text-[10px] font-medium"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Shift Policies & Audit Rules */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <ShieldCheck className="w-4 h-4 text-luxury-gold-600" />
            Shift Cash Drawer &amp; Handover Security Policies
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="p-4 rounded-2xl bg-luxury-beige-50/60 border border-luxury-brown-100 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <label className="font-bold text-luxury-brown-950">
                    Mandatory Cash Handover Reconciliation
                  </label>
                  <p className="text-[11px] text-luxury-brown-600 mt-0.5">
                    Outgoing cashier must enter counted cash before handing over the drawer to the incoming shift.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={requireCashHandover}
                  onChange={(e) => setRequireCashHandover(e.target.checked)}
                  className="w-4.5 h-4.5 mt-0.5 text-luxury-gold-600 rounded"
                />
              </div>

              <div className="flex items-start justify-between gap-3 pt-2 border-t border-luxury-brown-100">
                <div>
                  <label className="font-bold text-luxury-brown-950">
                    Auto-Close Shift on Next Check-In
                  </label>
                  <p className="text-[11px] text-luxury-brown-600 mt-0.5">
                    Automatically archive shift statistics when the next shift duty officer clocks in.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoCloseShift}
                  onChange={(e) => setAutoCloseShift(e.target.checked)}
                  className="w-4.5 h-4.5 mt-0.5 text-luxury-gold-600 rounded"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-luxury-beige-50/60 border border-luxury-brown-100 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="font-bold text-luxury-brown-950">Max Cash Drawer Limit (Safe Drop Alert)</label>
                  <p className="text-[11px] text-luxury-brown-600">Threshold for mandatory cash transfer to property safe.</p>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <span>₹</span>
                  <input
                    type="number"
                    value={maxDrawerLimit}
                    onChange={(e) => setMaxDrawerLimit(Number(e.target.value))}
                    className="w-24 bg-white border border-luxury-brown-200 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-luxury-brown-100">
                <div>
                  <label className="font-bold text-luxury-brown-950">Night Audit Automatic Run Time</label>
                  <p className="text-[11px] text-luxury-brown-600">Scheduled automated midnight rollover process.</p>
                </div>
                <input
                  type="time"
                  value={nightAuditRunTime}
                  onChange={(e) => setNightAuditRunTime(e.target.value)}
                  className="bg-white border border-luxury-brown-200 rounded-lg px-2 py-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-luxury-gold-400" />
            {isSaving ? 'Saving Shift Setup...' : 'Save Shift Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
