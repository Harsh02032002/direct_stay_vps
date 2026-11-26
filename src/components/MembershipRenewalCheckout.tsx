import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  AlertTriangle,
  Building2,
  X,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { Hotel, SaaSPackage, SystemWebsiteConfig } from '../types';
import { showToast } from '../utils/toast';
import WhatsAppSupportWidget, { DEFAULT_WHATSAPP_NUMBER } from './WhatsAppSupportWidget';

export const DEFAULT_SAAS_PACKAGES_CATALOG: SaaSPackage[] = [
  {
    id: 'pkg-full-pms',
    code: 'full-pms',
    name: 'Full PMS',
    tagline: 'Complete Hotel PMS — Unlimited Rooms',
    priceMonthly: 599,
    priceYearly: 5999,
    regularPriceYearly: 9999,
    discountPercent: 40,
    discountLabel: 'Annual Best Value',
    gstRate: 18,
    durationDays: 365,
    maxRooms: 999,
    roomTierLabel: 'Unlimited Rooms',
    otaLimit: 0,
    otaLimitLabel: 'Direct PMS Operations',
    badge: 'Full PMS',
    billingCycle: 'Yearly',
    isActive: true,
    isPopular: false,
    sortOrder: 1,
    trialEnabled: true,
    trialDays: 7,
    renewalGraceDays: 7,
    autoReminderDaysBefore: 7,
    renewalRulesText: 'Annual license renews for 365 days upon verified payment. Expired hotels retain all data safely.',
    description: 'Complete cloud Hotel PMS with Front Desk, GST Billing, POS, Inventory, Housekeeping, Staff & Reports for unlimited rooms.',
    features: [
      'Unlimited Rooms & Floors',
      'Front Desk, Reservations & Digital GRC',
      'GST Billing, Tax Invoices & Credit Notes',
      'POS Restaurant & Room Service Billing',
      'Housekeeping, Laundry & Lost/Found',
      'Staff Roles, Daily Collection & Reports',
    ],
    buttonText: 'Select Full PMS',
    modules: {
      ota: false,
      staff: true,
      reports: true,
      cashHandover: true,
      expenses: true,
      invoices: true,
      policies: true,
      website: true,
      pos: true,
      inventory: true,
    },
  },
  {
    id: 'pkg-pms-cm-starter',
    code: 'pms-cm-starter',
    name: 'PMS + Channel Manager Starter',
    tagline: 'Full PMS + OTA Sync for up to 10 Rooms',
    priceMonthly: 1299,
    priceYearly: 12999,
    regularPriceYearly: 15999,
    discountPercent: 19,
    discountLabel: 'Most Popular',
    gstRate: 18,
    durationDays: 365,
    maxRooms: 10,
    roomTierLabel: 'Up to 10 Rooms (OTA Sync)',
    otaLimit: 10,
    otaLimitLabel: 'OTA Sync up to 10 Rooms',
    badge: 'Popular',
    billingCycle: 'Yearly',
    isActive: true,
    isPopular: true,
    sortOrder: 2,
    trialEnabled: true,
    trialDays: 7,
    renewalGraceDays: 7,
    autoReminderDaysBefore: 7,
    renewalRulesText: 'Includes real-time OTA sync up to 10 rooms + Full PMS. Instant upgrade available anytime.',
    description: 'Full PMS paired with real-time OTA Channel Manager sync (MakeMyTrip, Goibibo, Booking.com, Agoda) for properties up to 10 rooms.',
    features: [
      'Everything in Full PMS',
      'Real-Time OTA Channel Manager (Up to 10 Rooms)',
      'Automated Rate & Inventory Push',
      'Instant OTA Booking Auto-Import',
      'Zero Overbooking Protection',
      'Priority WhatsApp & Onboarding Support',
    ],
    buttonText: 'Select Starter + OTA',
    modules: {
      ota: true,
      staff: true,
      reports: true,
      cashHandover: true,
      expenses: true,
      invoices: true,
      policies: true,
      website: true,
      pos: true,
      inventory: true,
    },
  },
  {
    id: 'pkg-pms-cm-growth',
    code: 'pms-cm-growth',
    name: 'PMS + Channel Manager Growth',
    tagline: 'Full PMS + Growth Channel Manager',
    priceMonthly: 1499,
    priceYearly: 14999,
    regularPriceYearly: 18999,
    discountPercent: 21,
    discountLabel: 'Growth Pro',
    gstRate: 18,
    durationDays: 365,
    maxRooms: 999,
    roomTierLabel: 'Unlimited Rooms + Growth OTA',
    otaLimit: 999,
    otaLimitLabel: 'Growth Channel Manager (Multi-OTA)',
    badge: 'Best Value',
    billingCycle: 'Yearly',
    isActive: true,
    isPopular: false,
    sortOrder: 3,
    trialEnabled: true,
    trialDays: 7,
    renewalGraceDays: 7,
    autoReminderDaysBefore: 7,
    renewalRulesText: 'Full PMS + Growth Channel Manager for expanding hotels & resorts with unlimited room scaling.',
    description: 'Full PMS + Growth Channel Manager built for high-occupancy hotels and resorts needing unrestricted OTA rate, inventory, and booking automation.',
    features: [
      'Everything in Full PMS (Unlimited Rooms)',
      'Growth Channel Manager (Full OTA Sync)',
      'Bulk Rate Plan & Seasonal Yield Updates',
      'Multi-Channel Settlement & Commission Ledger',
      'Direct Booking Engine + Digital QR Menu',
      'Dedicated Account & WhatsApp Support',
    ],
    buttonText: 'Select Growth + OTA',
    modules: {
      ota: true,
      staff: true,
      reports: true,
      cashHandover: true,
      expenses: true,
      invoices: true,
      policies: true,
      website: true,
      pos: true,
      inventory: true,
    },
  },
];

export function resolveEffectiveActivePackages(packages?: SaaSPackage[]): SaaSPackage[] {
  if (Array.isArray(packages) && packages.length > 0) {
    return [...packages]
      .filter((p) => p && p.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }
  return DEFAULT_SAAS_PACKAGES_CATALOG;
}

export function computeDaysRemaining(endDate?: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((endMid - nowMid) / (1000 * 60 * 60 * 24));
}

interface MembershipRenewalCheckoutProps {
  hotel: Hotel;
  packages?: SaaSPackage[];
  systemWebsite?: SystemWebsiteConfig;
  initialPackageId?: string;
  requestedBy?: string;
  onClose?: () => void;
  onSubmitted?: (renewalRequest: any) => void;
  isModal?: boolean;
}

export default function MembershipRenewalCheckout({
  hotel,
  packages,
  systemWebsite,
  initialPackageId,
  requestedBy,
  onClose,
  onSubmitted,
  isModal = true,
}: MembershipRenewalCheckoutProps) {
  const activePackages = useMemo(() => resolveEffectiveActivePackages(packages), [packages]);

  const defaultSelectedPkg = useMemo(() => {
    if (initialPackageId) {
      const byInit = activePackages.find((p) => p.id === initialPackageId || p.code === initialPackageId);
      if (byInit) return byInit;
    }
    if (hotel?.packageId) {
      const byHotel = activePackages.find((p) => p.id === hotel.packageId);
      if (byHotel) return byHotel;
    }
    return activePackages[0];
  }, [activePackages, hotel?.packageId, initialPackageId]);

  const [selectedPkgId, setSelectedPkgId] = useState<string>(defaultSelectedPkg?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<'UPI QR / Direct UPI' | 'Bank Transfer (NEFT/IMPS)' | 'Payment Gateway'>('UPI QR / Direct UPI');
  const [utrRef, setUtrRef] = useState('');
  const [payerNotes, setPayerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<any | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [qrProviderIdx, setQrProviderIdx] = useState(0);

  const selectedPkg = useMemo(
    () => activePackages.find((p) => p.id === selectedPkgId) || activePackages[0],
    [activePackages, selectedPkgId]
  );

  const currentHotelPkg = useMemo(
    () => (packages || activePackages).find((p) => p.id === hotel?.packageId),
    [packages, activePackages, hotel?.packageId]
  );

  const baseAmount = Number(selectedPkg?.priceYearly || selectedPkg?.priceMonthly || 5999);
  const gstRate = Number(selectedPkg?.gstRate ?? systemWebsite?.paymentSettings?.defaultGstRate ?? 18);
  const gstAmount = Math.round(baseAmount * (gstRate / 100));
  const cgstAmount = Number((gstAmount / 2).toFixed(2));
  const sgstAmount = Number((gstAmount / 2).toFixed(2));
  const totalPayable = baseAmount + gstAmount;

  const rawConfiguredUpi = String(systemWebsite?.paymentSettings?.upiId || '').trim();
  const upiId =
    !rawConfiguredUpi || rawConfiguredUpi.toLowerCase() === 'directstay@upi'
      ? '7684023584-4@ybl'
      : rawConfiguredUpi;
  const upiPayeeName =
    systemWebsite?.paymentSettings?.upiPayeeName?.trim() ||
    systemWebsite?.businessName ||
    'DirectStay Hospitality SaaS';
  const whatsappNumber = systemWebsite?.whatsappNumber || systemWebsite?.supportPhone || DEFAULT_WHATSAPP_NUMBER;

  const txNote = `DirectStay ${selectedPkg?.name || 'PMS'} - ${hotel?.name || hotel?.id}`;
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    upiPayeeName
  )}&am=${totalPayable.toFixed(2)}&cu=INR&tn=${encodeURIComponent(txNote.slice(0, 60))}`;
  const qrUrls = [
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&format=png&data=${encodeURIComponent(upiDeepLink)}`,
    `https://quickchart.io/qr?size=240&margin=2&text=${encodeURIComponent(upiDeepLink)}`,
  ];
  const upiQrUrl = qrUrls[Math.min(qrProviderIdx, qrUrls.length - 1)];

  const isUpgrade =
    Boolean(currentHotelPkg) &&
    selectedPkg?.id !== currentHotelPkg?.id &&
    Number(selectedPkg?.priceYearly || 0) > Number(currentHotelPkg?.priceYearly || 0);

  const handleCopy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied`, 'success');
    } catch {
      showToast(`${label}: ${text}`, 'info');
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    const cleanUtr = utrRef.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      setSubmitError('Please enter a valid UTR / UPI Transaction Reference Number (minimum 6 characters) after completing payment.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/hotels/renewal-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotel.id,
          requestedPackageId: selectedPkg?.id,
          requestedPackageName: selectedPkg?.name || 'Full PMS',
          requestedPlan: 'Yearly',
          requestedAmount: baseAmount,
          baseAmount,
          gstRate,
          gstAmount,
          cgstAmount,
          sgstAmount,
          totalAmount: totalPayable,
          paymentMethod,
          upiIdUsed: paymentMethod === 'UPI QR / Direct UPI' ? upiId : undefined,
          transactionReference: cleanUtr,
          isUpgrade,
          previousPackageName: currentHotelPkg?.name || hotel.subscriptionPlan || 'Previous Plan',
          notes:
            payerNotes.trim() ||
            `${isUpgrade ? 'Plan Upgrade' : 'Membership Renewal'} via ${paymentMethod} • Base ₹${baseAmount} + ${gstRate}% GST ₹${gstAmount} = ₹${totalPayable}`,
          requestedBy: requestedBy || hotel.ownerName || hotel.username || 'Hotel Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setSubmitError(data?.error || 'Could not submit renewal payment for verification.');
        return;
      }

      setSubmittedRecord(data.renewalRequest);
      showToast('Payment reference submitted! Activation occurs automatically once verified by DirectStay billing.', 'success');
      if (onSubmitted) onSubmitted(data.renewalRequest);
    } catch (err: any) {
      setSubmitError(err?.message || 'Network error while submitting payment verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const innerContent = (
    <div className="bg-white rounded-3xl border border-luxury-brown-200 shadow-2xl w-full max-w-4xl overflow-hidden text-luxury-brown-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-luxury-brown-950 via-[#241710] to-luxury-brown-900 text-white px-6 py-4 flex items-center justify-between border-b border-luxury-gold-500/25">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-luxury-gold-500/20 border border-luxury-gold-500/40 text-luxury-gold-400">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold-400 font-bold block">
              DirectStay Membership Checkout
            </span>
            <h3 className="font-serif font-bold text-lg text-white">
              {isUpgrade ? 'Upgrade Plan & Verify Payment' : 'Renew Membership & Verify Payment'} — {hotel.name}
            </h3>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-luxury-brown-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
        {submittedRecord ? (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 tracking-wider">
                  Payment Submitted • Pending Verification
                </span>
                <h4 className="text-lg font-serif font-bold text-luxury-brown-950">
                  UTR Reference Recorded for {submittedRecord.requestedPackageName}
                </h4>
                <p className="text-xs text-luxury-brown-700 leading-relaxed">
                  Your payment reference <strong className="font-mono">{submittedRecord.transactionReference}</strong> for{' '}
                  <strong>₹{Number(submittedRecord.totalAmount || totalPayable).toLocaleString('en-IN')}</strong> (incl. {gstRate}% GST) has been queued for billing verification. As soon as our team verifies receipt, your license will automatically activate and your <strong>GST Tax Invoice & Payment Receipt</strong> will appear in your subscription history.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white rounded-xl p-4 border border-emerald-200">
              <div>
                <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">Selected Plan</span>
                <strong className="text-luxury-brown-950">{submittedRecord.requestedPackageName}</strong>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">UTR / Reference</span>
                <strong className="font-mono text-luxury-brown-950">{submittedRecord.transactionReference}</strong>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-luxury-brown-500 block">Verification Status</span>
                <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-700">
                  <Clock className="w-3.5 h-3.5" /> Pending Verification
                </span>
              </div>
            </div>

            <WhatsAppSupportWidget
              variant="banner"
              phone={whatsappNumber}
              context="renewal"
              hotelName={hotel.name}
              packageName={`${submittedRecord.requestedPackageName} (UTR: ${submittedRecord.transactionReference})`}
              label="Share UTR on WhatsApp for Faster Verification"
            />

            {onClose && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-luxury-brown-950 text-luxury-gold-400 font-bold text-xs cursor-pointer"
                >
                  Done & Return
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* SECTION 1: PAYMENT SECTION (UPI QR + DIRECT UPI + GATEWAY/BANK + VERIFICATION FORM) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Direct UPI & QR Box */}
              <div className="lg:col-span-5 rounded-2xl border border-luxury-brown-200 bg-luxury-beige-50/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-luxury-gold-700 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4" /> Step 1 — Pay via UPI / QR
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                    0% UPI Fee
                  </span>
                </div>

                {/* Direct UPI & QR Only (No Card / Bank / Gateway Tabs) */}
                <div className="space-y-3">
                  <div className="bg-white rounded-2xl border border-luxury-brown-200 p-4 flex flex-col items-center text-center space-y-2.5 shadow-xs">
                    <img
                      src={upiQrUrl}
                      referrerPolicy="no-referrer"
                      onError={() => {
                        if (qrProviderIdx < qrUrls.length - 1) setQrProviderIdx(qrProviderIdx + 1);
                      }}
                      alt={`DirectStay UPI QR Code for ${selectedPkg?.name}`}
                      className="w-44 h-44 rounded-xl border border-luxury-brown-100 object-contain bg-white"
                    />
                    <div>
                      <p className="text-[11px] font-bold text-luxury-brown-950">{upiPayeeName}</p>
                      <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg bg-luxury-beige-50 border border-luxury-brown-200 text-[11px] font-mono">
                        <span>{upiId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(upiId, 'UPI ID')}
                          className="text-luxury-gold-700 hover:text-luxury-brown-950 cursor-pointer"
                          title="Copy UPI ID"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-luxury-brown-500">
                      Scan with Google Pay, PhonePe, Paytm, BHIM or any UPI app for{' '}
                      <strong className="text-luxury-brown-950">₹{totalPayable.toLocaleString('en-IN')}</strong>
                    </p>
                  </div>

                  <a
                    href={upiDeepLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open UPI App (Pay ₹{totalPayable.toLocaleString('en-IN')})</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Right: Order Summary + Verified UTR Submission */}
              <form onSubmit={handleSubmitVerification} className="lg:col-span-7 flex flex-col justify-between space-y-4">
                <div className="rounded-2xl border border-luxury-brown-200 p-5 space-y-4 bg-white">
                  <div className="flex items-start justify-between gap-3 border-b border-luxury-brown-100 pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-luxury-gold-700">
                        Selected Package Summary
                      </span>
                      <h4 className="text-lg font-serif font-bold text-luxury-brown-950">
                        {selectedPkg?.name}
                      </h4>
                      <p className="text-[11px] text-luxury-brown-600">
                        {selectedPkg?.roomTierLabel || `Up to ${selectedPkg?.maxRooms} Rooms`}
                        {selectedPkg?.otaLimitLabel ? ` • ${selectedPkg.otaLimitLabel}` : ''}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-luxury-beige-100 border border-luxury-gold-400/50 text-luxury-brown-900 font-mono text-[10px] font-bold">
                      {selectedPkg?.durationDays || 365} Days License
                    </span>
                  </div>

                  {/* GST Tax Breakdown */}
                  <div className="space-y-1.5 text-xs font-mono bg-luxury-beige-50/60 rounded-xl p-3.5 border border-luxury-brown-100">
                    <div className="flex justify-between">
                      <span className="text-luxury-brown-600">Annual Package Tariff</span>
                      <span className="font-bold text-luxury-brown-950">₹{baseAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-luxury-brown-600">
                      <span>CGST ({(gstRate / 2).toFixed(1)}%)</span>
                      <span>₹{cgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-luxury-brown-600">
                      <span>SGST ({(gstRate / 2).toFixed(1)}%)</span>
                      <span>₹{sgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-2 mt-1 border-t border-luxury-brown-200 text-sm font-bold text-emerald-700">
                      <span>Total Payable (Incl. {gstRate}% GST)</span>
                      <span>₹{totalPayable.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Strict Verification Notice */}
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5 text-[11px] text-amber-950">
                    <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p>
                      <strong>Strict Payment Verification:</strong> Membership is activated only after payment verification (never solely from opening a UPI app). After paying, enter your <strong>UTR / Transaction Reference Number</strong> below — once verified, your plan activates and your GST Tax Invoice & Payment Receipt are generated automatically.
                    </p>
                  </div>

                  {/* UTR Input */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                        Step 2 — Enter UTR / UPI Transaction Reference *
                      </label>
                      <input
                        type="text"
                        required
                        minLength={6}
                        value={utrRef}
                        onChange={(e) => setUtrRef(e.target.value)}
                        placeholder="e.g. 432910485921 (12-digit UPI UTR / Bank Ref)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-luxury-brown-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-luxury-gold-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono uppercase font-bold text-luxury-brown-700 block mb-1">
                        Optional Note / GST Billing Remarks
                      </label>
                      <input
                        type="text"
                        value={payerNotes}
                        onChange={(e) => setPayerNotes(e.target.value)}
                        placeholder="e.g. Paid from hotel business UPI, please update GSTIN on invoice"
                        className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:outline-none focus:ring-2 focus:ring-luxury-gold-500"
                      />
                    </div>
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-luxury-brown-950 hover:bg-luxury-brown-900 disabled:opacity-60 text-luxury-gold-400 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'Submitting Payment for Verification...'
                        : `Submit Payment Reference (₹${totalPayable.toLocaleString('en-IN')}) for Verification`}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* SECTION 2: PACKAGE DETAILS & AVAILABLE UPGRADE PLANS (BELOW PAYMENT SECTION) */}
            <div className="pt-4 border-t border-luxury-brown-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold-700 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Package Details & Available Upgrade Plans
                  </span>
                  <h4 className="text-base font-serif font-bold text-luxury-brown-950">
                    Compare Plans or Upgrade Your Hotel License ({gstRate}% GST Extra)
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-luxury-brown-500">
                  Current Plan: <strong className="text-luxury-brown-900">{currentHotelPkg?.name || hotel.subscriptionPlan || 'Active'}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activePackages.map((pkg) => {
                  const isSelected = pkg.id === selectedPkg?.id;
                  const isCurrent = pkg.id === hotel?.packageId;
                  const pkgBase = Number(pkg.priceYearly || pkg.priceMonthly || 0);
                  const pkgGst = Number(pkg.gstRate ?? 18);
                  const pkgTotal = pkgBase + Math.round(pkgBase * (pkgGst / 100));
                  const featureLines =
                    Array.isArray(pkg.features) && pkg.features.length > 0
                      ? pkg.features
                      : [
                          pkg.roomTierLabel || `Up to ${pkg.maxRooms} Rooms`,
                          pkg.modules?.ota ? 'OTA Channel Manager Sync' : 'Full Cloud PMS Operations',
                          'GST Billing, POS & Daily Reports',
                        ];

                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'border-luxury-gold-500 bg-luxury-beige-50/70 shadow-md'
                          : 'border-luxury-brown-100 bg-white hover:border-luxury-brown-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full bg-luxury-brown-950 text-luxury-gold-400">
                            {pkg.badge || (pkg.isPopular ? 'Popular' : 'Annual Plan')}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Current
                            </span>
                          )}
                        </div>
                        <div>
                          <h5 className="font-serif font-bold text-base text-luxury-brown-950">{pkg.name}</h5>
                          <p className="text-[11px] text-luxury-brown-600">{pkg.tagline || pkg.description}</p>
                        </div>
                        <div className="pt-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-serif font-bold text-luxury-brown-950">
                              ₹{pkgBase.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[11px] font-mono text-luxury-brown-500">/ year</span>
                            {pkg.regularPriceYearly && pkg.regularPriceYearly > pkgBase && (
                              <span className="text-[11px] font-mono line-through text-luxury-brown-400">
                                ₹{pkg.regularPriceYearly.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-luxury-brown-500">
                            + {pkgGst}% GST (Total ₹{pkgTotal.toLocaleString('en-IN')})
                          </p>
                        </div>
                        <ul className="space-y-1 pt-2 border-t border-luxury-brown-100">
                          {featureLines.slice(0, 5).map((feat, i) => (
                            <li key={i} className="text-[11px] text-luxury-brown-700 flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-xs'
                            : 'bg-luxury-brown-950 text-white hover:bg-luxury-brown-900'
                        }`}
                      >
                        {isSelected ? 'Selected for Checkout ✓' : isCurrent ? 'Renew This Plan' : 'Upgrade / Switch'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 3: WHATSAPP SUPPORT BANNER */}
            <WhatsAppSupportWidget
              variant="banner"
              phone={whatsappNumber}
              context="renewal"
              hotelName={hotel.name}
              packageName={selectedPkg?.name}
            />
          </>
        )}
      </div>
    </div>
  );

  if (!isModal) return innerContent;

  return (
    <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      {innerContent}
    </div>
  );
}
