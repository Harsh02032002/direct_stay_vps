import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calculator,
  Percent,
  FileText,
  ShieldCheck,
  Droplets
} from 'lucide-react';
import { Hotel, HotelSettings } from '../../types';
import { getHotelTaxSettings, saveHotelTaxSettings } from '../../pms-integrated/utils/taxSettings';
import { formatGrcNumber, formatInvoiceNumber, r2 } from '../../utils/billCalculator';
import { defaultGrcTerms } from '../../utils/printTemplates';
import { showToast } from '../../utils/toast';

interface TaxSetupViewProps {
  activeHotel: Hotel;
  hotelSettings?: HotelSettings;
  onUpdateGlobalHotels: (updatedHotels: Hotel[]) => void;
  onUpdateHotelSettings?: (updated: HotelSettings) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function TaxSetupView({
  activeHotel,
  hotelSettings,
  onUpdateGlobalHotels,
  onUpdateHotelSettings,
  onAddAuditLog,
}: TaxSetupViewProps) {
  const safeHotel: Hotel = activeHotel || {
    id: 'hotel-1',
    name: 'DirectStay Hotel',
    gstNumber: hotelSettings?.gstNumber || '',
  } as unknown as Hotel;

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Tax States
  const [hotelGst, setHotelGst] = useState('');
  const [hotelPan, setHotelPan] = useState('');
  const [hotelPlaceOfSupply, setHotelPlaceOfSupply] = useState('');
  const [hotelIsGstEnabled, setHotelIsGstEnabled] = useState<boolean>(true);
  const [hotelDefaultGstRate, setHotelDefaultGstRate] = useState<number>(5);
  const [hotelFoodGstRate, setHotelFoodGstRate] = useState<number>(5);
  const [hotelRoomRateIncludesGst, setHotelRoomRateIncludesGst] = useState<boolean>(false);
  const [hotelTaxOnAncillary, setHotelTaxOnAncillary] = useState<boolean>(true);
  const [hotelWaterBottleRate, setHotelWaterBottleRate] = useState<number>(20);
  const [hotelInvoicePrefix, setHotelInvoicePrefix] = useState('INV');
  const [hotelNextInvoiceSequence, setHotelNextInvoiceSequence] = useState<number>(1001);
  const [hotelGrcPrefix, setHotelGrcPrefix] = useState('GRC');
  const [hotelNextGrcSequence, setHotelNextGrcSequence] = useState<number>(1);
  const [hotelGrcTermsText, setHotelGrcTermsText] = useState<string>(() => defaultGrcTerms().join('\n'));

  // Sample Calculator test tariff
  const [sampleTariff, setSampleTariff] = useState<number>(2000);

  useEffect(() => {
    const target = activeHotel || safeHotel;
    if (!target) return;
    setHotelGst(activeHotel.gstNumber || hotelSettings?.gstNumber || '');
    setHotelPan(activeHotel.panNumber || hotelSettings?.panNumber || '');
    setHotelPlaceOfSupply(activeHotel.placeOfSupply || hotelSettings?.placeOfSupply || '');
    setHotelIsGstEnabled(activeHotel.isGstEnabled ?? hotelSettings?.isGstEnabled ?? true);

    const savedTax = getHotelTaxSettings();
    const rTotal =
      activeHotel.defaultGstRate ??
      hotelSettings?.defaultGstRate ??
      +(savedTax.roomCgst + savedTax.roomSgst).toFixed(2);
    const fTotal =
      activeHotel.foodGstRate ??
      hotelSettings?.foodGstRate ??
      +(savedTax.fnbCgst + savedTax.fnbSgst).toFixed(2);
    setHotelDefaultGstRate(Number(rTotal) || 5);
    setHotelFoodGstRate(Number(fTotal) || 5);

    setHotelRoomRateIncludesGst(
      Boolean(activeHotel.roomRateIncludesGst ?? hotelSettings?.roomRateIncludesGst ?? false)
    );
    setHotelTaxOnAncillary(
      activeHotel.taxOnAncillary !== undefined
        ? Boolean(activeHotel.taxOnAncillary)
        : hotelSettings?.taxOnAncillary !== undefined
        ? Boolean(hotelSettings.taxOnAncillary)
        : true
    );
    setHotelWaterBottleRate(
      activeHotel.waterBottleRate !== undefined
        ? Number(activeHotel.waterBottleRate)
        : hotelSettings?.waterBottleRate !== undefined
        ? Number(hotelSettings.waterBottleRate)
        : 20
    );
    setHotelInvoicePrefix(
      (activeHotel.invoicePrefix || hotelSettings?.invoicePrefix || 'INV').replace(/[-/\s]+$/, '') || 'INV'
    );
    setHotelNextInvoiceSequence(
      activeHotel.nextInvoiceSequence
        ? Number(activeHotel.nextInvoiceSequence)
        : hotelSettings?.nextInvoiceSequence
        ? Number(hotelSettings.nextInvoiceSequence)
        : 1001
    );
    setHotelGrcPrefix(
      (activeHotel.grcPrefix || hotelSettings?.grcPrefix || 'GRC').replace(/[-/\s]+$/, '') || 'GRC'
    );
    setHotelNextGrcSequence(
      activeHotel.nextGrcSequence
        ? Number(activeHotel.nextGrcSequence)
        : hotelSettings?.nextGrcSequence
        ? Number(hotelSettings.nextGrcSequence)
        : 1
    );
    const loadedTerms =
      Array.isArray(activeHotel.grcTerms) && activeHotel.grcTerms.length > 0
        ? activeHotel.grcTerms
        : Array.isArray(hotelSettings?.grcTerms) && hotelSettings!.grcTerms!.length > 0
        ? hotelSettings!.grcTerms!
        : defaultGrcTerms();
    setHotelGrcTermsText(loadedTerms.join('\n'));
  }, [activeHotel, hotelSettings]);

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    setIsSaving(true);

    try {
      const cleanRoomGst = hotelIsGstEnabled ? Math.max(0, r2(Number(hotelDefaultGstRate) || 0)) : 0;
      const cleanFoodGst = hotelIsGstEnabled ? Math.max(0, r2(Number(hotelFoodGstRate) || 0)) : 0;
      const cleanPrefix = (hotelInvoicePrefix.trim() || 'INV').replace(/[-/\s]+$/, '') || 'INV';
      const cleanNextInvSeq = Math.max(1, Math.floor(Number(hotelNextInvoiceSequence) || 1001));
      const cleanWaterRate = Math.max(0, r2(Number(hotelWaterBottleRate ?? 20)));
      const cleanGrcPrefix = hotelGrcPrefix.trim().replace(/[-/\s]+$/, '') || 'GRC';
      const cleanNextGrcSeq = Math.max(1, Math.floor(Number(hotelNextGrcSequence) || 1));
      const cleanPan = hotelPan.trim().toUpperCase();
      const cleanPlaceOfSupply = hotelPlaceOfSupply.trim();
      const parsedTerms = hotelGrcTermsText
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\d+\s*[.)]\s*/, '').trim())
        .filter(Boolean);
      const cleanGrcTerms = parsedTerms.length > 0 ? parsedTerms : defaultGrcTerms();

      saveHotelTaxSettings(
        {
          roomCgst: r2(cleanRoomGst / 2),
          roomSgst: r2(cleanRoomGst - r2(cleanRoomGst / 2)),
          fnbCgst: r2(cleanFoodGst / 2),
          fnbSgst: r2(cleanFoodGst - r2(cleanFoodGst / 2)),
          invoicePrefix: cleanPrefix,
        },
        safeHotel.id
      );

      const updatedHotel: Hotel = {
        ...safeHotel,
        gstNumber: hotelGst.trim().toUpperCase(),
        panNumber: cleanPan,
        placeOfSupply: cleanPlaceOfSupply,
        isGstEnabled: hotelIsGstEnabled,
        defaultGstRate: cleanRoomGst,
        foodGstRate: cleanFoodGst,
        roomRateIncludesGst: hotelRoomRateIncludesGst,
        taxOnAncillary: hotelTaxOnAncillary,
        waterBottleRate: cleanWaterRate,
        invoicePrefix: cleanPrefix,
        nextInvoiceSequence: cleanNextInvSeq,
        grcPrefix: cleanGrcPrefix,
        nextGrcSequence: cleanNextGrcSeq,
        grcTerms: cleanGrcTerms,
      };

      onUpdateGlobalHotels([updatedHotel]);

      if (onUpdateHotelSettings) {
        onUpdateHotelSettings({
          ...(hotelSettings || {
            logoUrl: safeHotel.logoUrl || '',
            name: safeHotel.name || '',
            address: safeHotel.address || '',
            gstNumber: hotelGst.trim().toUpperCase(),
            phoneNumber: safeHotel.phoneNumber || '',
            emailAddress: safeHotel.emailAddress || '',
            website: safeHotel.website || '',
          }),
          id: safeHotel.id,
          gstNumber: hotelGst.trim().toUpperCase(),
          panNumber: cleanPan,
          placeOfSupply: cleanPlaceOfSupply,
          isGstEnabled: hotelIsGstEnabled,
          defaultGstRate: cleanRoomGst,
          foodGstRate: cleanFoodGst,
          roomRateIncludesGst: hotelRoomRateIncludesGst,
          taxOnAncillary: hotelTaxOnAncillary,
          waterBottleRate: cleanWaterRate,
          invoicePrefix: cleanPrefix,
          nextInvoiceSequence: cleanNextInvSeq,
          grcPrefix: cleanGrcPrefix,
          nextGrcSequence: cleanNextGrcSeq,
          grcTerms: cleanGrcTerms,
        });
      }

      onAddAuditLog?.(
        'Tax & GST Settings Updated',
        `GSTIN: ${hotelGst.toUpperCase() || 'None'}, Room GST: ${cleanRoomGst}%, Food GST: ${cleanFoodGst}%, Mode: ${
          hotelRoomRateIncludesGst ? 'Single Bill Inclusive' : 'Standard Exclusive'
        }, Prefix: ${cleanPrefix}/${cleanNextInvSeq}.`
      );

      const msg = `Tax & GST settings saved successfully! Invoice preview: ${formatInvoiceNumber(
        cleanPrefix,
        cleanNextInvSeq
      )} • GRC preview: ${formatGrcNumber(cleanGrcPrefix, cleanNextGrcSeq)}`;
      setSuccessMsg(msg);
      showToast(msg, 'success', 5000, 'Tax Setup Saved');
    } catch (err: any) {
      const eMsg = err?.message || 'Failed to save Tax settings.';
      setErrorMsg(eMsg);
      showToast(eMsg, 'error', 5000, 'Save Failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Compute live sample calculation
  const sampleCalc = () => {
    const rate = hotelIsGstEnabled ? Number(hotelDefaultGstRate) || 0 : 0;
    if (hotelRoomRateIncludesGst) {
      const base = r2(sampleTariff / (1 + rate / 100));
      const gst = r2(sampleTariff - base);
      return { base, cgst: r2(gst / 2), sgst: r2(gst - r2(gst / 2)), total: sampleTariff, mode: 'Inclusive (Single Bill)' };
    } else {
      const gst = r2((sampleTariff * rate) / 100);
      return { base: sampleTariff, cgst: r2(gst / 2), sgst: r2(gst - r2(gst / 2)), total: r2(sampleTariff + gst), mode: 'Exclusive (Added to bill)' };
    }
  };
  const calc = sampleCalc();

  return (
    <div className="space-y-6">
      {/* Sub-module Header Card */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-2">
              <Receipt className="w-3.5 h-3.5 text-luxury-gold-600" /> Compliance &amp; Taxation
            </div>
            <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              Tax Setup &amp; GST Compliance
            </h2>
            <p className="text-xs text-luxury-brown-500 mt-1">
              Configure Hotel GSTIN, PAN, tax slabs, Single-Bill inclusive/exclusive calculations, invoice numbering, and GRC policies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-2 rounded-xl bg-luxury-beige-50 border border-luxury-brown-100 text-right">
              <p className="text-[10px] font-mono uppercase text-luxury-brown-400 font-bold">Current Invoicing Mode</p>
              <p className="text-xs font-bold text-luxury-brown-900">
                {hotelIsGstEnabled ? (hotelRoomRateIncludesGst ? 'Single Bill (Inclusive GST)' : 'Standard (Exclusive GST)') : 'GST Exempt / Inactive'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Preview Pill Strip */}
        <div className="mt-4 pt-4 border-t border-luxury-brown-50 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[11px] font-mono font-bold text-luxury-brown-400 uppercase">Live Format Previews:</span>
          <span className="px-2.5 py-1 rounded-lg bg-luxury-brown-50 text-luxury-brown-800 font-mono text-[11px] font-semibold border border-luxury-brown-100">
            Invoice: <strong className="text-luxury-gold-700">{formatInvoiceNumber(hotelInvoicePrefix, hotelNextInvoiceSequence)}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-luxury-brown-50 text-luxury-brown-800 font-mono text-[11px] font-semibold border border-luxury-brown-100">
            GRC: <strong className="text-luxury-gold-700">{formatGrcNumber(hotelGrcPrefix, hotelNextGrcSequence)}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-luxury-brown-50 text-luxury-brown-800 font-mono text-[11px] font-semibold border border-luxury-brown-100">
            Room GST: <strong className="text-emerald-700">{hotelIsGstEnabled ? `${hotelDefaultGstRate}%` : '0%'}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-luxury-brown-50 text-luxury-brown-800 font-mono text-[11px] font-semibold border border-luxury-brown-100">
            F&amp;B GST: <strong className="text-emerald-700">{hotelIsGstEnabled ? `${hotelFoodGstRate}%` : '0%'}</strong>
          </span>
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

      <form onSubmit={handleSaveTax} className="space-y-6">
        {/* Section 1: GSTIN, PAN & Place of Supply */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <ShieldCheck className="w-4 h-4 text-luxury-gold-600" />
            1. Hotel Tax Identifiers &amp; Jurisdiction
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800 flex items-center gap-1">
                Hotel GSTIN Number
                <span className="text-[10px] font-normal text-luxury-brown-400 font-mono">(15 Characters)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 03ABCDE1234F1Z5"
                value={hotelGst}
                maxLength={15}
                onChange={(e) => setHotelGst(e.target.value.toUpperCase())}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800 flex items-center gap-1">
                PAN Number
                <span className="text-[10px] font-normal text-luxury-brown-400 font-mono">(10 Characters)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. ABCDE1234F"
                value={hotelPan}
                maxLength={10}
                onChange={(e) => setHotelPan(e.target.value.toUpperCase())}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">
                Place of Supply (State / City)
              </label>
              <input
                type="text"
                placeholder="e.g. Chandigarh (04) / Punjab"
                value={hotelPlaceOfSupply}
                onChange={(e) => setHotelPlaceOfSupply(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
              />
            </div>
          </div>
        </div>

        {/* Section 2: GST Rates & Calculation Logic */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-luxury-brown-50">
            <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              <Percent className="w-4 h-4 text-luxury-gold-600" />
              2. GST Slabs &amp; Single-Bill Calculation
            </h3>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hotelIsGstEnabled}
                onChange={(e) => setHotelIsGstEnabled(e.target.checked)}
                className="w-4 h-4 text-luxury-gold-600 rounded border-luxury-brown-300 focus:ring-luxury-gold-500"
              />
              <span className="text-xs font-bold text-luxury-brown-900">Enable GST Billing</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">
                Default Room Tariff GST Slab (%)
              </label>
              <select
                disabled={!hotelIsGstEnabled}
                value={hotelDefaultGstRate}
                onChange={(e) => setHotelDefaultGstRate(Number(e.target.value))}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 disabled:bg-luxury-beige-50 disabled:cursor-not-allowed"
              >
                <option value={0}>0% (Tax Exempt)</option>
                <option value={5}>5% (Standard Budget / DirectStay Default)</option>
                <option value={12}>12% (Rooms ₹1,000 to ₹7,500)</option>
                <option value={18}>18% (Luxury Rooms ₹7,500+)</option>
                <option value={28}>28% (Super Luxury Suites)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">
                Food / Restaurant / POS GST Slab (%)
              </label>
              <select
                disabled={!hotelIsGstEnabled}
                value={hotelFoodGstRate}
                onChange={(e) => setHotelFoodGstRate(Number(e.target.value))}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 disabled:bg-luxury-beige-50 disabled:cursor-not-allowed"
              >
                <option value={0}>0% (Tax Exempt)</option>
                <option value={5}>5% (Standard Restaurant / Room Service)</option>
                <option value={12}>12% (Composite Food &amp; Beverage)</option>
                <option value={18}>18% (Air Conditioned Dining / Banquets)</option>
              </select>
            </div>
          </div>

          {/* Inclusive vs Exclusive Switch */}
          <div className="p-4 rounded-2xl bg-luxury-beige-50/60 border border-luxury-brown-100 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-luxury-brown-950 flex items-center gap-1.5">
                  Single-Bill / Room Rate Includes GST (Inclusive Pricing)
                </label>
                <p className="text-[11px] text-luxury-brown-600 mt-0.5">
                  When enabled, the room tariff shown to guests already contains GST. Check-in and checkout invoices automatically reverse-calculate the base price + CGST/SGST without adding extra charges on top.
                </p>
              </div>
              <input
                type="checkbox"
                checked={hotelRoomRateIncludesGst}
                onChange={(e) => setHotelRoomRateIncludesGst(e.target.checked)}
                className="w-5 h-5 mt-1 text-luxury-gold-600 rounded border-luxury-brown-300 focus:ring-luxury-gold-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-luxury-brown-100/70">
              <div>
                <label className="text-xs font-bold text-luxury-brown-950">
                  Tax on Ancillary Services (Extra Person, Late Checkout, Laundry)
                </label>
                <p className="text-[11px] text-luxury-brown-600">
                  Apply room GST rate to additional guest charges and services.
                </p>
              </div>
              <input
                type="checkbox"
                checked={hotelTaxOnAncillary}
                onChange={(e) => setHotelTaxOnAncillary(e.target.checked)}
                className="w-5 h-5 text-luxury-gold-600 rounded border-luxury-brown-300 focus:ring-luxury-gold-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Interactive Calculator Box */}
          <div className="p-4 rounded-2xl bg-luxury-brown-950 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-luxury-gold-400 flex items-center gap-1.5">
                <Calculator className="w-4 h-4" /> Live Tax Breakdown Preview
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-luxury-brown-300 font-mono">Test Tariff: ₹</span>
                <input
                  type="number"
                  value={sampleTariff}
                  onChange={(e) => setSampleTariff(Number(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded bg-luxury-brown-900 border border-luxury-gold-500/30 text-white text-xs font-mono text-right"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="bg-luxury-brown-900/60 p-2.5 rounded-xl border border-luxury-brown-800">
                <p className="text-[10px] text-luxury-brown-400 uppercase font-mono">Mode</p>
                <p className="text-xs font-bold text-luxury-gold-300 truncate">{calc.mode}</p>
              </div>
              <div className="bg-luxury-brown-900/60 p-2.5 rounded-xl border border-luxury-brown-800">
                <p className="text-[10px] text-luxury-brown-400 uppercase font-mono">Base Tariff</p>
                <p className="text-xs font-bold font-mono text-white">₹{calc.base.toFixed(2)}</p>
              </div>
              <div className="bg-luxury-brown-900/60 p-2.5 rounded-xl border border-luxury-brown-800">
                <p className="text-[10px] text-luxury-brown-400 uppercase font-mono">CGST ({(hotelDefaultGstRate/2).toFixed(1)}%)</p>
                <p className="text-xs font-bold font-mono text-emerald-400">₹{calc.cgst.toFixed(2)}</p>
              </div>
              <div className="bg-luxury-brown-900/60 p-2.5 rounded-xl border border-luxury-brown-800">
                <p className="text-[10px] text-luxury-brown-400 uppercase font-mono">SGST ({(hotelDefaultGstRate/2).toFixed(1)}%)</p>
                <p className="text-xs font-bold font-mono text-emerald-400">₹{calc.sgst.toFixed(2)}</p>
              </div>
              <div className="bg-luxury-gold-500/20 p-2.5 rounded-xl border border-luxury-gold-500/40">
                <p className="text-[10px] text-luxury-gold-400 uppercase font-mono font-bold">Total Bill</p>
                <p className="text-sm font-bold font-mono text-luxury-gold-300">₹{calc.total.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Invoicing, Sequences & Minibar */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <FileText className="w-4 h-4 text-luxury-gold-600" />
            3. Document Sequences &amp; In-Room Tariffs
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">Invoice Prefix</label>
              <input
                type="text"
                placeholder="INV"
                value={hotelInvoicePrefix}
                onChange={(e) => setHotelInvoicePrefix(e.target.value.toUpperCase())}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">Next Invoice #</label>
              <input
                type="number"
                min={1}
                value={hotelNextInvoiceSequence}
                onChange={(e) => setHotelNextInvoiceSequence(Number(e.target.value))}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">GRC Prefix</label>
              <input
                type="text"
                placeholder="GRC"
                value={hotelGrcPrefix}
                onChange={(e) => setHotelGrcPrefix(e.target.value.toUpperCase())}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-luxury-brown-800">Next GRC #</label>
              <input
                type="number"
                min={1}
                value={hotelNextGrcSequence}
                onChange={(e) => setHotelNextGrcSequence(Number(e.target.value))}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs font-bold text-luxury-brown-800 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-600" />
              Standard Water Bottle / Minibar Rate (₹ per bottle)
            </label>
            <input
              type="number"
              min={0}
              value={hotelWaterBottleRate}
              onChange={(e) => setHotelWaterBottleRate(Number(e.target.value))}
              className="w-full md:w-60 text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono mt-1"
            />
          </div>
        </div>

        {/* Section 4: Guest Registration Card (GRC) Terms */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <FileCheck className="w-4 h-4 text-luxury-gold-600" />
            4. Guest Registration Card (GRC) Legal Terms &amp; Conditions
          </h3>
          <p className="text-[11px] text-luxury-brown-500">
            These terms print automatically at the footer of official Guest Registration Cards and Check-in Folios. Enter each clause on a new line.
          </p>
          <textarea
            rows={5}
            value={hotelGrcTermsText}
            onChange={(e) => setHotelGrcTermsText(e.target.value)}
            className="w-full text-xs bg-white border border-luxury-brown-100 rounded-2xl p-4 font-mono leading-relaxed focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-luxury-gold-400" />
            {isSaving ? 'Saving Tax Settings...' : 'Save Tax & GST Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
