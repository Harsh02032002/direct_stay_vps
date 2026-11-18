import React, { useState, useEffect } from 'react';
import { HotelPolicy, HotelSettings, UserRole } from '../types';
import { ShieldAlert, BookOpen, Edit2, Check, Printer, AlertTriangle, Percent, Plus, X, Save, Clock, Building2 } from 'lucide-react';
import { showToast } from '../utils/toast';
import { normalizeInvoiceConditions } from '../utils/invoiceConditions';
import { useHotelTaxSettings } from '../pms-integrated/utils/taxSettings';

interface PolicyManagerProps {
  policies: HotelPolicy[];
  currentRole: UserRole;
  hotelSettings?: HotelSettings;
  onUpdateHotelSettings?: (updated: HotelSettings) => void;
  onUpdatePolicies: (policies: HotelPolicy[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function PolicyManager({
  policies,
  currentRole,
  hotelSettings,
  onUpdateHotelSettings,
  onUpdatePolicies,
  onAddAuditLog
}: PolicyManagerProps) {
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const [taxSettings, updateTaxSettings] = useHotelTaxSettings();
  const [roomCgst, setRoomCgst] = useState<number>(taxSettings.roomCgst);
  const [roomSgst, setRoomSgst] = useState<number>(taxSettings.roomSgst);
  const [fnbCgst, setFnbCgst] = useState<number>(taxSettings.fnbCgst);
  const [fnbSgst, setFnbSgst] = useState<number>(taxSettings.fnbSgst);

  // Dynamic GST & Hotel Tax Settings state
  const [isGstEnabled, setIsGstEnabled] = useState<boolean>(hotelSettings?.isGstEnabled ?? true);
  const [defaultGstRate, setDefaultGstRate] = useState<number>(
    +(taxSettings.roomCgst + taxSettings.roomSgst).toFixed(2) || (hotelSettings?.defaultGstRate ?? 5)
  );
  const [foodGstRate, setFoodGstRate] = useState<number>(
    +(taxSettings.fnbCgst + taxSettings.fnbSgst).toFixed(2) || (hotelSettings?.foodGstRate ?? 5)
  );
  const [gstNumber, setGstNumber] = useState<string>(hotelSettings?.gstNumber || '');
  const [checkInTime, setCheckInTime] = useState<string>(hotelSettings?.checkInTime || '12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState<string>(hotelSettings?.checkOutTime || '11:00 AM');
  const [earlyCheckInEnabled, setEarlyCheckInEnabled] = useState<boolean>(hotelSettings?.earlyCheckInEnabled ?? true);
  const [earlyCheckInType, setEarlyCheckInType] = useState<'hourly' | 'fixed'>(hotelSettings?.earlyCheckInType || 'hourly');
  const [earlyCheckInHourlyRate, setEarlyCheckInHourlyRate] = useState<number>(Number(hotelSettings?.earlyCheckInHourlyRate) || 0);
  const [earlyCheckInFixedRate, setEarlyCheckInFixedRate] = useState<number>(Number(hotelSettings?.earlyCheckInFixedRate) || 0);
  const [timeZone, setTimeZone] = useState<string>(hotelSettings?.timeZone || 'Asia/Kolkata');
  const [dateFormat, setDateFormat] = useState<string>(hotelSettings?.dateFormat || 'DD/MM/YYYY');
  const [businessDate, setBusinessDate] = useState<string>(
    hotelSettings?.businessDate || new Date().toISOString().split('T')[0]
  );
  const [gstSlabs, setGstSlabs] = useState<number[]>(
    Array.isArray(hotelSettings?.gstSlabs) && hotelSettings!.gstSlabs!.length > 0
      ? hotelSettings!.gstSlabs!
      : [0, 5, 12, 18]
  );
  const [newSlabInput, setNewSlabInput] = useState<string>('');

  useEffect(() => {
    if (hotelSettings) {
      setIsGstEnabled(hotelSettings.isGstEnabled ?? true);
      setDefaultGstRate(hotelSettings.defaultGstRate ?? 5);
      setFoodGstRate(hotelSettings.foodGstRate ?? 5);
      setGstNumber(hotelSettings.gstNumber || '');
      setCheckInTime(hotelSettings.checkInTime || '12:00 PM');
      setCheckOutTime(hotelSettings.checkOutTime || '11:00 AM');
      setEarlyCheckInEnabled(hotelSettings.earlyCheckInEnabled ?? true);
      setEarlyCheckInType(hotelSettings.earlyCheckInType || 'hourly');
      setEarlyCheckInHourlyRate(Number(hotelSettings.earlyCheckInHourlyRate) || 0);
      setEarlyCheckInFixedRate(Number(hotelSettings.earlyCheckInFixedRate) || 0);
      setTimeZone(hotelSettings.timeZone || 'Asia/Kolkata');
      setDateFormat(hotelSettings.dateFormat || 'DD/MM/YYYY');
      setBusinessDate(hotelSettings.businessDate || new Date().toISOString().split('T')[0]);
      setGstSlabs(
        Array.isArray(hotelSettings.gstSlabs) && hotelSettings.gstSlabs.length > 0
          ? hotelSettings.gstSlabs
          : [0, 5, 12, 18]
      );
    }
  }, [
    hotelSettings?.isGstEnabled,
    hotelSettings?.defaultGstRate,
    hotelSettings?.foodGstRate,
    hotelSettings?.gstNumber,
    hotelSettings?.checkInTime,
    hotelSettings?.checkOutTime,
    hotelSettings?.timeZone,
    hotelSettings?.dateFormat,
    hotelSettings?.businessDate,
    hotelSettings?.gstSlabs
  ]);

  const isRestrictedRole = currentRole === 'Receptionist';

  const handleAddGstSlab = () => {
    const parsed = parseFloat(newSlabInput);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      showToast('Please enter a valid GST percentage between 0 and 100.', 'warning');
      return;
    }
    if (gstSlabs.includes(parsed)) {
      showToast(`${parsed}% GST slab already exists.`, 'info');
      setNewSlabInput('');
      return;
    }
    const updated = [...gstSlabs, parsed].sort((a, b) => a - b);
    setGstSlabs(updated);
    setNewSlabInput('');
  };

  const handleRemoveGstSlab = (slabToRemove: number) => {
    if (gstSlabs.length <= 1) {
      showToast('At least one GST slab must remain configured.', 'warning');
      return;
    }
    const updated = gstSlabs.filter(s => s !== slabToRemove);
    setGstSlabs(updated);
    if (defaultGstRate === slabToRemove) {
      setDefaultGstRate(updated[0] ?? 0);
    }
  };

  const handleUpdateSlabValue = (index: number, newValueStr: string) => {
    const parsed = Math.max(0, Math.min(100, parseFloat(newValueStr) || 0));
    const oldVal = gstSlabs[index];
    const nextSlabs = [...gstSlabs];
    nextSlabs[index] = parsed;
    setGstSlabs(nextSlabs);
    if (defaultGstRate === oldVal) {
      setDefaultGstRate(parsed);
      setIsGstEnabled(parsed > 0);
    }
  };

  const handleSaveGstSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateHotelSettings || !hotelSettings) {
      showToast('Settings context unavailable.', 'error');
      return;
    }
    const cleanDefault = Math.max(0, Math.min(100, Number(defaultGstRate) || 0));
    const cleanFood = Math.max(0, Math.min(100, Number(foodGstRate) || 0));
    const finalSlabs = Array.from(new Set([0, ...gstSlabs, cleanDefault])).sort((a, b) => a - b);

    // Sync CGST & SGST to global HotelTaxSettings used across all PMS modules
    updateTaxSettings({
      roomCgst: isGstEnabled ? roomCgst : 0,
      roomSgst: isGstEnabled ? roomSgst : 0,
      fnbCgst: isGstEnabled ? fnbCgst : 0,
      fnbSgst: isGstEnabled ? fnbSgst : 0,
    });

    // Keep Invoice Conditions' tax settings in step with the GST settings (conditions themselves are edited in Invoices & Billing)
    const syncedInvoiceConditions = normalizeInvoiceConditions(
      {
        ...normalizeInvoiceConditions(hotelSettings.invoiceConditions, hotelSettings),
        applyTax: isGstEnabled,
        defaultGstRate: isGstEnabled ? cleanDefault : 0
      },
      { isGstEnabled, defaultGstRate: isGstEnabled ? cleanDefault : 0 }
    );

    onUpdateHotelSettings({
      ...hotelSettings,
      isGstEnabled,
      defaultGstRate: isGstEnabled ? cleanDefault : 0,
      foodGstRate: isGstEnabled ? cleanFood : 0,
      gstNumber: gstNumber.trim(),
      checkInTime: checkInTime.trim() || '12:00 PM',
      checkOutTime: checkOutTime.trim() || '11:00 AM',
      earlyCheckInEnabled,
      earlyCheckInType,
      earlyCheckInHourlyRate: Math.max(0, Number(earlyCheckInHourlyRate) || 0),
      earlyCheckInFixedRate: Math.max(0, Number(earlyCheckInFixedRate) || 0),
      timeZone: timeZone || 'Asia/Kolkata',
      dateFormat: dateFormat || 'DD/MM/YYYY',
      businessDate: businessDate || new Date().toISOString().split('T')[0],
      gstSlabs: finalSlabs,
      invoiceConditions: syncedInvoiceConditions
    });
  };

  const handleStartEdit = (p: HotelPolicy) => {
    setEditingPolicyId(p.id);
    setEditTitle(p.title);
    setEditContent(p.content);
  };

  const handleSaveEdit = (id: string) => {
    const targetPolicy = policies.find(p => p.id === id);
    const updated = policies.map(p => p.id === id ? { ...p, title: editTitle, content: editContent } : p);
    onUpdatePolicies(updated);
    onAddAuditLog?.(
      'Hotel Policy Updated',
      `Updated hotel policy "${editTitle}" (${targetPolicy?.category || 'General'} section).`
    );
    setEditingPolicyId(null);
  };

  const handlePrintPolicies = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Hidden layout element designed for clean vector screen prints of hotel rules */}
      <div className="print-only hidden p-10 bg-white text-black font-sans shrink-0 border">
        <div className="border-b pb-4 mb-6 text-center">
          <h1 className="text-3xl font-serif text-slate-900 font-bold tracking-wider">GRAND PAVILION</h1>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-mono">Boutique Luxury Accommodation Policies Code</p>
          <p className="text-[9px] text-slate-400 mt-1">Operational Regulatory Code of Conduct Directory</p>
        </div>

        <div className="space-y-6 text-xs text-slate-800">
          {policies.map(p => (
            <div key={p.id} className="border-b pb-4">
              <h2 className="text-sm font-bold font-serif text-slate-900 border-l-4 border-l-slate-800 pl-2 mb-2">
                {p.title} ({p.category})
              </h2>
              <p className="leading-relaxed text-slate-600 pl-3">{p.content}</p>
            </div>
          ))}
          <p className="text-[9px] text-slate-400 text-center pt-8">
            © 2026 Grand Pavilion resort rules are strictly subject to regional tourism board compliance codes.
          </p>
        </div>
      </div>

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-luxury-brown-100 pb-4 no-print">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-[#C49A3A] font-bold block mb-1">
            Property Configuration & Tax Controls
          </span>
          <h1 className="text-2xl font-serif text-[#263449] font-semibold tracking-wide">
            Dynamic GST Settings & Hotel Standards
          </h1>
          <p className="text-xs text-slate-500">
            Configure dynamic GST tax percentages, custom GST slabs, GSTIN, check-in timings, and hotel policies.
          </p>
        </div>
        <button
          onClick={handlePrintPolicies}
          className="mt-3 sm:mt-0 px-4 py-2 bg-[#C49A3A] hover:bg-[#B0862B] !text-[#17120F] font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Download Policy PDF / Print
        </button>
      </div>

      {/* DYNAMIC GST & TAX BILLING CONFIGURATION CARD */}
      {hotelSettings && onUpdateHotelSettings && (
        <form
          onSubmit={handleSaveGstSettings}
          className="bg-white border border-luxury-brown-100 rounded-2xl overflow-hidden shadow-sm no-print"
        >
          <div className="bg-[#17120F] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#C49A3A]/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C49A3A]/20 text-[#C49A3A] border border-[#C49A3A]/40">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-serif font-bold text-white">
                  Dynamic GST & Tax Billing Configuration
                </h2>
                <p className="text-[11px] font-mono text-slate-300">
                  Set default GST % for Room Bookings, Check-In, Checkout & Invoices — zero hardcoded rates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsGstEnabled(true);
                  if (defaultGstRate <= 0) {
                    const firstNonZero = gstSlabs.find(s => s > 0) ?? 5;
                    setDefaultGstRate(firstNonZero);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                  isGstEnabled
                    ? 'bg-[#15805D] !text-white border-[#15805D] shadow-xs'
                    : 'bg-white/10 !text-slate-300 border-white/20 hover:bg-white/15'
                }`}
              >
                ✓ Apply GST ({isGstEnabled ? defaultGstRate : (gstSlabs.find(s => s > 0) ?? 5)}%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsGstEnabled(false);
                  setDefaultGstRate(0);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                  !isGstEnabled
                    ? 'bg-[#D92D4B] !text-white border-[#D92D4B] shadow-xs'
                    : 'bg-white/10 !text-slate-300 border-white/20 hover:bg-white/15'
                }`}
              >
                0% (No GST)
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Explicit Room CGST / SGST and POS Food CGST / SGST Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase font-bold text-[#263449]">
                    1. Room Tariff CGST & SGST Split (%)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#17120F] text-[#E0BD6B] font-mono font-bold text-xs">
                    Total Room GST = {isGstEnabled ? +(roomCgst + roomSgst).toFixed(2) : 0}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Room CGST (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      disabled={!isGstEnabled}
                      value={isGstEnabled ? roomCgst : 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setRoomCgst(val);
                        const tot = +(val + roomSgst).toFixed(2);
                        setDefaultGstRate(tot);
                        updateTaxSettings({ roomCgst: val, roomSgst });
                      }}
                      className="w-full px-3 py-2 border border-amber-300 bg-white rounded-xl text-sm font-mono font-bold text-[#263449]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Room SGST (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      disabled={!isGstEnabled}
                      value={isGstEnabled ? roomSgst : 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setRoomSgst(val);
                        const tot = +(roomCgst + val).toFixed(2);
                        setDefaultGstRate(tot);
                        updateTaxSettings({ roomCgst, roomSgst: val });
                      }}
                      className="w-full px-3 py-2 border border-amber-300 bg-white rounded-xl text-sm font-mono font-bold text-[#263449]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase font-bold text-[#263449]">
                    2. Food / POS CGST & SGST Split (%)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-900 text-white font-mono font-bold text-xs">
                    Total Food GST = {isGstEnabled ? +(fnbCgst + fnbSgst).toFixed(2) : 0}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Food / POS CGST (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      disabled={!isGstEnabled}
                      value={isGstEnabled ? fnbCgst : 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setFnbCgst(val);
                        const tot = +(val + fnbSgst).toFixed(2);
                        setFoodGstRate(tot);
                        updateTaxSettings({ fnbCgst: val, fnbSgst });
                      }}
                      className="w-full px-3 py-2 border border-blue-300 bg-white rounded-xl text-sm font-mono font-bold text-[#263449]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Food / POS SGST (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      disabled={!isGstEnabled}
                      value={isGstEnabled ? fnbSgst : 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setFnbSgst(val);
                        const tot = +(fnbCgst + val).toFixed(2);
                        setFoodGstRate(tot);
                        updateTaxSettings({ fnbCgst, fnbSgst: val });
                      }}
                      className="w-full px-3 py-2 border border-blue-300 bg-white rounded-xl text-sm font-mono font-bold text-[#263449]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 1. Default Room & Booking GST % */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase font-bold text-[#263449] block">
                  Total Room / Booking GST (%) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={isGstEnabled ? defaultGstRate : 0}
                    onChange={e => {
                      const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                      setDefaultGstRate(val);
                      const half = +(val / 2).toFixed(2);
                      setRoomCgst(half);
                      setRoomSgst(half);
                      setIsGstEnabled(val > 0);
                      updateTaxSettings({ roomCgst: half, roomSgst: half });
                    }}
                    className="w-full px-3.5 py-2 border border-luxury-brown-200 rounded-xl text-sm font-mono font-bold text-[#263449]"
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 shrink-0">%</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Applied across Bookings, Check-In, Checkout & Invoices (CGST {isGstEnabled ? roomCgst : 0}% + SGST {isGstEnabled ? roomSgst : 0}%).
                </p>
              </div>

              {/* 2. Default Food / POS GST % */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase font-bold text-[#263449] block">
                  Total Food / POS GST (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    disabled={!isGstEnabled}
                    value={isGstEnabled ? foodGstRate : 0}
                    onChange={e => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setFoodGstRate(val);
                      const half = +(val / 2).toFixed(2);
                      setFnbCgst(half);
                      setFnbSgst(half);
                      updateTaxSettings({ fnbCgst: half, fnbSgst: half });
                    }}
                    className="w-full px-3.5 py-2 border border-luxury-brown-200 rounded-xl text-sm font-mono font-bold text-[#263449]"
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 shrink-0">%</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Default tax percentage for restaurant & room service food orders (CGST {isGstEnabled ? fnbCgst : 0}% + SGST {isGstEnabled ? fnbSgst : 0}%).
                </p>
              </div>

              {/* 3. Hotel GSTIN Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase font-bold text-[#263449] block">
                  Hotel GSTIN Number
                </label>
                <input
                  type="text"
                  placeholder="e.g., 21AAAHP0562K1Z9"
                  value={gstNumber}
                  onChange={e => setGstNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 border border-luxury-brown-200 rounded-xl text-sm font-mono font-bold text-[#263449] uppercase"
                />
                <p className="text-[11px] text-slate-500">
                  Printed automatically on all GST Tax Invoices and GRC cards.
                </p>
              </div>
            </div>

            {/* Dynamic GST Slabs Builder & Standard Timings */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 border-t border-luxury-brown-100">
              <div className="lg:col-span-7 bg-[#FAFBFD] border border-luxury-brown-100 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono uppercase font-bold text-[#263449] block">
                      Configured GST Slabs (Click any slab to set as Default):
                    </span>
                    <span className="text-[11px] text-slate-500">
                      These slabs appear as quick-select buttons in Invoices, Check-In & Checkout.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="Custom %"
                      value={newSlabInput}
                      onChange={e => setNewSlabInput(e.target.value)}
                      className="w-24 px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddGstSlab}
                      className="px-3 py-1.5 bg-[#C49A3A] hover:bg-[#B0862B] !text-white border border-[#B0862B] rounded-lg text-xs font-mono font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Slab
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {gstSlabs.map((slab, idx) => {
                    const isDefault = (isGstEnabled ? defaultGstRate : 0) === slab;
                    return (
                      <div
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-mono text-xs font-bold transition-all ${
                          isDefault
                            ? 'bg-[#C49A3A] !text-white border-[#B0862B] shadow-xs'
                            : 'bg-white !text-[#263449] border-luxury-brown-200'
                        }`}
                      >
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={slab}
                          onChange={e => handleUpdateSlabValue(idx, e.target.value)}
                          className={`w-12 px-1 py-0.5 rounded border text-center text-xs font-mono font-bold ${
                            isDefault
                              ? 'bg-white/20 !text-white border-white/40'
                              : 'bg-slate-50 !text-[#263449] border-slate-200'
                          }`}
                          title="Directly edit this GST slab value (%)"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (slab === 0) {
                              setIsGstEnabled(false);
                              setDefaultGstRate(0);
                            } else {
                              setIsGstEnabled(true);
                              setDefaultGstRate(slab);
                            }
                          }}
                          className={`cursor-pointer ${isDefault ? '!text-white' : '!text-[#263449]'}`}
                          title="Click to make this the default GST rate"
                        >
                          {slab === 0 ? '% (No GST)' : '% GST'}
                          {isDefault && ' ★ Default'}
                        </button>
                        {gstSlabs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGstSlab(slab)}
                            className="ml-0.5 text-slate-400 hover:text-[#D92D4B] cursor-pointer"
                            title={`Remove ${slab}% slab`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Standard Check-In & Check-Out Time + Timezone & Date Format */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-[#FAFBFD] border border-luxury-brown-100 rounded-xl p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-[#263449] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#C49A3A]" /> Check-In Time
                  </label>
                  <input
                    type="text"
                    value={checkInTime}
                    onChange={e => setCheckInTime(e.target.value)}
                    placeholder="12:00 PM"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-[#263449] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#C49A3A]" /> Check-Out Time
                  </label>
                  <input
                    type="text"
                    value={checkOutTime}
                    onChange={e => setCheckOutTime(e.target.value)}
                    placeholder="11:00 AM"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-[#263449] flex items-center gap-1">
                    🌍 Hotel Timezone
                  </label>
                  <select
                    value={timeZone}
                    onChange={e => setTimeZone(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs font-mono font-bold bg-white"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                    <option value="UTC">UTC (Universal +00:00)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-[#263449] flex items-center gap-1">
                    📅 Date Format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={e => setDateFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs font-mono font-bold bg-white"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (28/10/2026)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (10/28/2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-28)</option>
                  </select>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-[#263449] flex items-center justify-between">
                    <span>🌙 Active Business Date (Night Audit)</span>
                    <span className="text-[10px] text-emerald-700 font-bold">
                      Format Preview: {(() => {
                        const [y, m, d] = (businessDate || '2026-10-28').split('-');
                        if (dateFormat === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
                        if (dateFormat === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
                        return `${d}/${m}/${y}`;
                      })()} ({timeZone})
                    </span>
                  </label>
                  <input
                    type="date"
                    value={businessDate}
                    onChange={e => setBusinessDate(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs font-mono font-bold bg-white"
                  />
                </div>

                <div className="col-span-2 p-3 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-amber-100 text-amber-800"><Clock className="w-3.5 h-3.5" /></span>
                      <div>
                        <span className="text-xs font-mono uppercase font-bold text-[#263449] block">
                          Early Check-In Surcharge & Rules (Before {checkInTime || '12:00 PM'})
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Auto-detects when guest arrives before {checkInTime || '12:00 PM'} and calculates extra tariff.
                        </span>
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer font-mono font-bold text-xs text-[#263449]">
                      <input
                        type="checkbox"
                        checked={earlyCheckInEnabled}
                        onChange={e => setEarlyCheckInEnabled(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#C49A3A]"
                      />
                      <span>Enable Surcharge</span>
                    </label>
                  </div>

                  {earlyCheckInEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Surcharge Calculation Model
                        </label>
                        <select
                          value={earlyCheckInType}
                          onChange={e => setEarlyCheckInType(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 border border-amber-300 bg-white rounded-lg text-xs font-bold text-[#263449]"
                        >
                          <option value="hourly">Hourly Rate (₹ per Hour Early)</option>
                          <option value="fixed">Flat Fixed Rate (Fixed Price)</option>
                        </select>
                      </div>
                      {earlyCheckInType === 'hourly' ? (
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            Rate per Early Hour (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={earlyCheckInHourlyRate}
                            onChange={e => setEarlyCheckInHourlyRate(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full px-2.5 py-1.5 border border-amber-300 bg-white rounded-lg text-xs font-mono font-bold text-[#263449]"
                            placeholder="0"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                            Flat Early Surcharge (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={earlyCheckInFixedRate}
                            onChange={e => setEarlyCheckInFixedRate(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full px-2.5 py-1.5 border border-amber-300 bg-white rounded-lg text-xs font-mono font-bold text-[#263449]"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-2 flex justify-end pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#15805D] hover:bg-[#11694B] !text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> Save Dynamic GST, Timezone & Early Check-In Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Main card grid of policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
        {policies.map(p => {
          const isEditing = editingPolicyId === p.id;
          return (
            <div 
              key={p.id} 
              className="bg-white border border-luxury-brown-200/50 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-luxury-gold-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-luxury-beige-100/60 text-luxury-brown-800 px-2.5 py-1 rounded">
                    {p.category} Section
                  </span>
                  {!isRestrictedRole && !isEditing && (
                    <button
                      onClick={() => handleStartEdit(p)}
                      className="p-1 text-luxury-brown-600 hover:bg-luxury-beige-100 rounded border border-luxury-brown-100 transition-colors"
                      title="Edit Clause"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3 pt-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs text-luxury-brown-905 border border-luxury-brown-200 rounded-lg focus:outline-none focus:border-luxury-gold-500 font-bold"
                    />
                    <textarea
                      rows={5}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs text-luxury-brown-905 border border-luxury-brown-200 rounded-lg focus:outline-none focus:border-luxury-gold-500 font-mono leading-relaxed"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-luxury-gold-500" /> {p.title}
                    </h3>
                    <p className="text-xs text-luxury-brown-700 leading-relaxed font-sans">{p.content}</p>
                  </div>
                )}
              </div>

              {/* Editing Controls bar */}
              {isEditing && (
                <div className="flex gap-2 justify-end pt-3 mt-3 border-t border-dashed">
                  <button
                    onClick={() => setEditingPolicyId(null)}
                    className="px-3 py-1 border border-luxury-brown-200 text-luxury-brown-700 text-xs rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(p.id)}
                    className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 flex items-center gap-1 font-semibold"
                  >
                    <Check className="w-3.5 h-3.5" /> Commit Rule
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isRestrictedRole && (
        <div className="bg-luxury-beige-50 border border-luxury-gold-500/10 p-4 rounded-xl flex items-start gap-2.5 max-w-2xl no-print">
          <AlertTriangle className="w-5 h-5 text-luxury-gold-500 shrink-0 mt-0.5" />
          <div className="text-xs text-luxury-brown-600 leading-normal">
            <strong>Staff policy authorization:</strong> You are currently logged in as a receptionist. You are fully authorized to read checkin/checkout standards, print legal visitor leaflets, or copy policies for guests, but lack administrative override permissions to alter contract codes.
          </div>
        </div>
      )}
    </div>
  );
}
