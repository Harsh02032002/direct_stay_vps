import React, { useState, useEffect } from 'react';
import {
  Building2,
  Receipt,
  CreditCard,
  MessageSquare,
  Clock,
  Tag,
  ShieldCheck,
  RefreshCw,
  FileCheck,
  User,
  Key,
  Save,
  CheckCircle2,
  AlertCircle,
  Building
} from 'lucide-react';
import { Hotel, HotelSettings, Staff, SubscriptionInvoice, UserRole } from '../types';
import SubscriptionInvoiceModal from './SubscriptionInvoiceModal';
import TaxSetupView from './profile/TaxSetupView';
import PaymentModeView from './profile/PaymentModeView';
import WhatsAppView from './profile/WhatsAppView';
import ShiftSetupView from './profile/ShiftSetupView';
import CouponsView from './profile/CouponsView';
import MasterSetupView from './profile/MasterSetupView';
import { showToast } from '../utils/toast';

export type ConfigurationSectionType =
  | 'general'
  | 'tax'
  | 'payment_mode'
  | 'whatsapp'
  | 'properties'
  | 'master'
  | 'shift'
  | 'coupons'
  | 'renewal'
  | 'compliance';

interface ProfileSettingsViewProps {
  currentRole: UserRole;
  loggedInUser: string;
  hotels: Hotel[];
  selectedHotelId: string;
  rawStaff: Staff[];
  hotelSettings?: HotelSettings;
  activeSection?: ConfigurationSectionType;
  onSelectSection?: (section: ConfigurationSectionType) => void;
  onUpdateHotelSettings?: (updated: HotelSettings) => void;
  onUpdateGlobalHotels: (updatedHotels: Hotel[]) => void;
  onUpdateGlobalStaff: (updatedStaff: Staff[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function ProfileSettingsView({
  currentRole,
  loggedInUser,
  hotels = [],
  selectedHotelId,
  rawStaff = [],
  hotelSettings,
  activeSection = 'tax',
  onSelectSection,
  onUpdateHotelSettings,
  onUpdateGlobalHotels,
  onUpdateGlobalStaff,
  onAddAuditLog,
}: ProfileSettingsViewProps) {
  // Normalize internal section
  const [internalSection, setInternalSection] = useState<ConfigurationSectionType>(() => {
    if (activeSection) return activeSection;
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('pms_profile_section');
      if (saved) return saved as ConfigurationSectionType;
    }
    return 'tax';
  });

  useEffect(() => {
    if (activeSection) {
      setInternalSection(activeSection);
    }
  }, [activeSection]);

  // Handle custom event from sidebar or other links
  useEffect(() => {
    const handleProfileNav = (e: any) => {
      const sec = e.detail?.section as ConfigurationSectionType;
      if (sec) {
        setInternalSection(sec);
        onSelectSection?.(sec);
      }
    };
    window.addEventListener('directstay:profile-nav', handleProfileNav);
    return () => window.removeEventListener('directstay:profile-nav', handleProfileNav);
  }, [onSelectSection]);

  const changeSection = (sec: ConfigurationSectionType) => {
    setInternalSection(sec);
    onSelectSection?.(sec);
    try {
      sessionStorage.setItem('pms_profile_section', sec);
      window.dispatchEvent(new CustomEvent('directstay:profile-nav', { detail: { section: sec } }));
    } catch {}
  };

  const activeHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  const isHotelAdminOrOwner =
    currentRole === 'Admin' ||
    (currentRole as string) === 'Owner' ||
    currentRole === 'SuperAdmin';

  // Admin Membership Renewal & Invoice Viewer State
  const [viewingSubInvoice, setViewingSubInvoice] = useState<SubscriptionInvoice | null>(null);
  const [adminRenewPlan, setAdminRenewPlan] = useState<'Monthly' | 'HalfYearly' | 'Yearly'>('Yearly');
  const [adminRenewPaymentMode, setAdminRenewPaymentMode] = useState<string>('UPI');
  const [adminRenewUtr, setAdminRenewUtr] = useState<string>('');
  const [isSubmittingAdminRenewal, setIsSubmittingAdminRenewal] = useState(false);
  const [renewalSuccessMsg, setRenewalSuccessMsg] = useState<string | null>(null);
  const [renewalErrorMsg, setRenewalErrorMsg] = useState<string | null>(null);

  const handleAdminSubmitRenewalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHotel) return;
    const baseAmt = adminRenewPlan === 'Monthly' ? 1899 : adminRenewPlan === 'HalfYearly' ? 7999 : 14000;
    const pkgName =
      adminRenewPlan === 'Monthly'
        ? 'Monthly Pro Package'
        : adminRenewPlan === 'HalfYearly'
        ? '6-Month Growth Package'
        : '1-Year Enterprise Package';
    const cleanRef = adminRenewUtr.trim() || `UTR${Date.now().toString().slice(-8)}`;
    setIsSubmittingAdminRenewal(true);
    setRenewalErrorMsg(null);
    setRenewalSuccessMsg(null);

    try {
      const res = await fetch('/api/hotels/renewal-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: activeHotel.id,
          requestedPackageName: pkgName,
          requestedPlan: adminRenewPlan,
          requestedAmount: baseAmt,
          paymentMethod: adminRenewPaymentMode,
          transactionReference: cleanRef,
          requestedBy: loggedInUser || activeHotel.username || 'Hotel Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRenewalErrorMsg(data.error || 'Failed to submit renewal request.');
        return;
      }
      if (data.renewalRequest) {
        const updatedHotels = hotels.map((h) =>
          h.id === activeHotel.id ? { ...h, renewalRequest: data.renewalRequest } : h
        );
        onUpdateGlobalHotels(updatedHotels);
      }
      onAddAuditLog?.(
        'Membership Renewal Requested',
        `Hotel Admin requested ${pkgName} (${adminRenewPlan}) renewal (₹${baseAmt.toLocaleString(
          'en-IN'
        )} + GST, Mode: ${adminRenewPaymentMode}, Ref: ${cleanRef}).`
      );
      setAdminRenewUtr('');
      const okMsg = `Membership renewal request (${pkgName} • Ref: ${cleanRef}) sent to Super Admin for payment approval & invoice generation!`;
      setRenewalSuccessMsg(okMsg);
      showToast(okMsg, 'success', 5000);
    } catch {
      setRenewalErrorMsg('Network error submitting membership renewal request.');
    } finally {
      setIsSubmittingAdminRenewal(false);
    }
  };

  // Personal Staff Profile (for non-admin staff roles)
  const activeStaff = rawStaff.find(
    (s) => s.name === loggedInUser && s.hotelId === selectedHotelId
  );
  const [staffName, setStaffName] = useState('');
  const [staffMobile, setStaffMobile] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscodes, setShowPasscodes] = useState(false);
  const [staffSuccessMsg, setStaffSuccessMsg] = useState<string | null>(null);
  const [staffErrorMsg, setStaffErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeStaff) {
      setStaffName(activeStaff.name || '');
      setStaffMobile(activeStaff.mobile || '');
      setStaffUsername(activeStaff.username || '');
    }
  }, [activeStaff]);

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffSuccessMsg(null);
    setStaffErrorMsg(null);

    if (!activeStaff) {
      setStaffErrorMsg('Active staff context not found in the property registry.');
      return;
    }

    let updatedPassword = activeStaff.password || 'password';
    const isPasswordChanged = Boolean(newPasscode.trim() || confirmPasscode.trim());
    if (isPasswordChanged) {
      if (currentPasscode !== (activeStaff.password || 'password')) {
        setStaffErrorMsg('Incorrect current passcode.');
        return;
      }
      if (!newPasscode.trim()) {
        setStaffErrorMsg('New passcode cannot be empty.');
        return;
      }
      if (newPasscode !== confirmPasscode) {
        setStaffErrorMsg('New passcodes do not match.');
        return;
      }
      updatedPassword = newPasscode;
    }

    const updatedStaffList = rawStaff.map((s) => {
      if (s.id === activeStaff.id) {
        return {
          ...s,
          username: staffUsername.trim() || s.username,
          ...(isPasswordChanged ? { password: updatedPassword } : {}),
          mobile: staffMobile.trim() || s.mobile,
        };
      }
      return s;
    });

    onUpdateGlobalStaff(updatedStaffList);
    onAddAuditLog?.(
      'Staff Credentials Updated',
      `Personal staff passcode and credentials updated for ${staffUsername || activeStaff.name}.`
    );
    const stfMsg = 'Your personal staff profile and security passcode have been updated successfully!';
    setStaffSuccessMsg(stfMsg);
    showToast(stfMsg, 'success', 4500, 'Profile Saved');

    setCurrentPasscode('');
    setNewPasscode('');
    setConfirmPasscode('');
  };

  // If not admin/owner/superadmin, render personal staff profile
  if (!isHotelAdminOrOwner) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto" id="profile-settings-desk">
        <div className="bg-white border border-luxury-brown-100 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-brown-950/5 text-luxury-brown-800 border border-luxury-brown-100 text-[9px] font-mono uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3 text-luxury-gold-600" /> Identity Management
            </div>
            <h2 className="text-2xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              Personal Staff Profile Desk
            </h2>
            <p className="text-xs text-luxury-brown-500">
              Manage your personal staff contact information and rotate your shift login passcode.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 bg-luxury-beige-50 border border-luxury-brown-100 px-4 py-2.5 rounded-xl text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-luxury-brown-700 font-bold">
              Role: <span className="text-luxury-gold-600 uppercase">{currentRole}</span>
            </span>
          </div>
        </div>

        {staffSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Settings Saved</p>
              <p>{staffSuccessMsg}</p>
            </div>
          </div>
        )}

        {staffErrorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Save Failed</p>
              <p>{staffErrorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleStaffSubmit} className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Staff Full Name</label>
              <input
                type="text"
                disabled
                value={staffName}
                className="w-full text-xs bg-luxury-beige-50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 text-luxury-brown-500 font-medium cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Duty Department / Role</label>
              <input
                type="text"
                disabled
                value={activeStaff?.role || currentRole}
                className="w-full text-xs bg-luxury-beige-50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 text-luxury-brown-500 font-medium cursor-not-allowed uppercase font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Contact Mobile Number</label>
              <input
                type="text"
                value={staffMobile}
                onChange={(e) => setStaffMobile(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Login Username</label>
              <input
                type="text"
                value={staffUsername}
                onChange={(e) => setStaffUsername(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-luxury-brown-50 space-y-3">
            <h4 className="text-xs font-bold text-luxury-brown-800 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-luxury-gold-600" />
              Rotate Personal Passcode
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type={showPasscodes ? 'text' : 'password'}
                placeholder="Current Passcode"
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
              />
              <input
                type={showPasscodes ? 'text' : 'password'}
                placeholder="New Passcode"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
              />
              <input
                type={showPasscodes ? 'text' : 'password'}
                placeholder="Confirm New Passcode"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2 font-mono"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowPasscodes(!showPasscodes)}
                className="text-[11px] text-luxury-brown-500 hover:text-luxury-brown-800 font-mono underline cursor-pointer"
              >
                {showPasscodes ? 'Hide characters' : 'Show character keys'}
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Active sub-module navigation tabs config
  const navTabs: { id: ConfigurationSectionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'master', label: 'Master Setup', icon: Building2 },
    { id: 'tax', label: 'Tax Setup', icon: Receipt },
    { id: 'payment_mode', label: 'Payment Mode', icon: CreditCard },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'shift', label: 'Shift Setup', icon: Clock },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'renewal', label: 'SaaS Invoices & Renewal', icon: RefreshCw },
    { id: 'compliance', label: 'Regulatory Docs', icon: FileCheck },
  ];

  if (currentRole === 'SuperAdmin') {
    navTabs.push({ id: 'properties', label: 'Properties', icon: Building });
  }

  const effectiveSec = internalSection === 'general' ? 'master' : internalSection;

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="profile-settings-desk">
      {/* Top Banner & Sub-Tabs Navigation */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> DirectStay Configuration Central
            </div>
            <h1 className="text-2xl font-serif font-bold text-luxury-brown-950">
              System Configuration &amp; Property Setup
            </h1>
            <p className="text-xs text-luxury-brown-500 mt-0.5">
              Dedicated configuration consoles for Tax &amp; GST compliance, Payment tenders, WhatsApp automation, Staff shift hours, Discount coupons, and Master property profile.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 bg-luxury-beige-50 border border-luxury-brown-100 px-4 py-2 rounded-xl text-xs shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-luxury-brown-700 font-bold">
              {activeHotel?.name || 'DirectStay Hotel'} • <span className="text-luxury-gold-600 uppercase">{currentRole}</span>
            </span>
          </div>
        </div>

        {/* Sub-Tabs Pill Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-luxury-brown-50 scrollbar-thin">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = effectiveSec === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeSection(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm border border-luxury-brown-950'
                    : 'bg-luxury-beige-50/70 hover:bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-luxury-gold-400' : 'text-luxury-gold-600'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dedicated View Routing */}
      {effectiveSec === 'tax' && (
        <TaxSetupView
          activeHotel={activeHotel}
          hotelSettings={hotelSettings}
          onUpdateGlobalHotels={onUpdateGlobalHotels}
          onUpdateHotelSettings={onUpdateHotelSettings}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {effectiveSec === 'payment_mode' && (
        <PaymentModeView
          activeHotel={activeHotel}
          hotelSettings={hotelSettings}
          onUpdateGlobalHotels={onUpdateGlobalHotels}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {effectiveSec === 'whatsapp' && (
        <WhatsAppView
          activeHotel={activeHotel}
          onUpdateGlobalHotels={onUpdateGlobalHotels}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {effectiveSec === 'shift' && (
        <ShiftSetupView
          activeHotel={activeHotel}
          rawStaff={rawStaff}
          onUpdateGlobalHotels={onUpdateGlobalHotels}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {effectiveSec === 'coupons' && (
        <CouponsView
          activeHotel={activeHotel}
          onUpdateGlobalHotels={onUpdateGlobalHotels}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {effectiveSec === 'master' && (
        <MasterSetupView
          activeHotel={activeHotel}
          hotelSettings={hotelSettings}
          currentRole={currentRole}
          onUpdateGlobalHotels={onUpdateGlobalHotels}
          onUpdateHotelSettings={onUpdateHotelSettings}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {effectiveSec === 'renewal' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-luxury-brown-50">
              <div>
                <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-luxury-gold-600" />
                  SaaS Membership Renewal &amp; Tax Invoices
                </h3>
                <p className="text-xs text-luxury-brown-500 mt-0.5">
                  Current Plan: <strong>{activeHotel.subscriptionPlan || 'Yearly'}</strong> • Valid Until:{' '}
                  <strong className="font-mono">{activeHotel.subscriptionEndDate || 'N/A'}</strong> • Status:{' '}
                  <strong className="text-emerald-700">{activeHotel.subscriptionStatus || 'Active'}</strong>
                </p>
              </div>
              {activeHotel.renewalRequest?.status === 'Pending' && (
                <span className="px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-[10px] font-bold flex items-center gap-1.5 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span>Renewal Pending Approval ({activeHotel.renewalRequest.requestedPackageName})</span>
                </span>
              )}
            </div>

            {renewalSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Request Dispatched</p>
                  <p>{renewalSuccessMsg}</p>
                </div>
              </div>
            )}

            {renewalErrorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Request Failed</p>
                  <p>{renewalErrorMsg}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleAdminSubmitRenewalRequest} className="bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-2xl p-5 space-y-4 text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-luxury-gold-700 block">
                Request Membership Renewal / Package Upgrade
              </span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-600 block mb-1">
                    Select Package Plan
                  </label>
                  <select
                    value={adminRenewPlan}
                    onChange={(e) => setAdminRenewPlan(e.target.value as any)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-bold text-luxury-brown-950"
                  >
                    <option value="Monthly">Monthly Pro — ₹1,899 (30 Days)</option>
                    <option value="HalfYearly">6-Month Growth — ₹7,999 (180 Days)</option>
                    <option value="Yearly">1-Year Enterprise — ₹14,000 (365 Days)</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-600 block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={adminRenewPaymentMode}
                    onChange={(e) => setAdminRenewPaymentMode(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2"
                  >
                    <option value="UPI">UPI (GPay / PhonePe)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                    <option value="Card / Online">Credit / Debit Card</option>
                    <option value="Cash">Cash Paid to Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono font-bold uppercase text-[10px] text-luxury-brown-600 block mb-1">
                    UTR / Transaction Ref
                  </label>
                  <input
                    type="text"
                    value={adminRenewUtr}
                    onChange={(e) => setAdminRenewUtr(e.target.value)}
                    placeholder="e.g. UTR82910421"
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSubmittingAdminRenewal}
                    className="w-full py-2.5 px-4 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    {isSubmittingAdminRenewal ? 'Sending...' : 'Request Renewal'}
                  </button>
                </div>
              </div>
            </form>

            {Array.isArray(activeHotel.subscriptionInvoices) && activeHotel.subscriptionInvoices.length > 0 && (
              <div className="bg-white border border-luxury-brown-100 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-luxury-beige-50 border-b border-luxury-brown-100 flex items-center justify-between">
                  <span className="text-xs font-serif font-bold text-luxury-brown-950">
                    Subscription Renewal Tax Invoices ({activeHotel.subscriptionInvoices.length})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500">
                        <th className="py-2.5 px-4">Invoice No</th>
                        <th className="py-2.5 px-4">Package</th>
                        <th className="py-2.5 px-4">Validity</th>
                        <th className="py-2.5 px-4 text-right">Total Paid</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-luxury-brown-100">
                      {activeHotel.subscriptionInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-luxury-beige-50/40">
                          <td className="py-2.5 px-4 font-mono font-bold text-luxury-brown-950">{inv.invoiceNumber}</td>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-luxury-brown-900">{inv.packageName}</span> ({inv.subscriptionPlan})
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px]">
                            {inv.validFrom} → <strong className="text-emerald-700">{inv.validUntil}</strong>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-right text-emerald-700">
                            ₹{Number(inv.totalAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setViewingSubInvoice(inv)}
                              className="px-3 py-1 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-luxury-gold-400 font-mono text-[11px] font-bold rounded-lg cursor-pointer"
                            >
                              View / Print Invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <SubscriptionInvoiceModal
            invoice={viewingSubInvoice}
            onClose={() => setViewingSubInvoice(null)}
          />
        </div>
      )}

      {effectiveSec === 'compliance' && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-luxury-brown-100 pb-3">
            <div>
              <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-luxury-gold-600" />
                Property Regulatory &amp; Compliance Documents
              </h3>
              <p className="text-xs text-luxury-brown-500 mt-0.5">
                Archived statutory licenses, GSTIN certificate, Police Sarai registration &amp; property documents.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
              ✓ Regulatory Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-luxury-beige-50/50 border border-luxury-brown-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-luxury-brown-900 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-luxury-gold-600" />
                  GSTIN Registration
                </span>
                <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-800">
                {activeHotel?.gstNumber || '22AAAAA0000A1Z5'}
              </div>
              <div className="text-[10px] text-slate-500">
                Official 5% GST certificate registered under Central Goods &amp; Services Tax.
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-luxury-beige-50/50 border border-luxury-brown-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-luxury-brown-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Police Sarai Act
                </span>
                <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Verified</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-800">
                SARAI-ACT-{selectedHotelId || '101'}
              </div>
              <div className="text-[10px] text-slate-500">
                Daily guest identity logging &amp; C-Form compliance enabled.
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-luxury-beige-50/50 border border-luxury-brown-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-luxury-brown-900 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  Trade &amp; Municipal License
                </span>
                <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Valid</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-800">
                MUNICIPAL-HOTEL-2026
              </div>
              <div className="text-[10px] text-slate-500">
                Commercial hospitality lodging permit &amp; fire safety clearance.
              </div>
            </div>
          </div>
        </div>
      )}

      {effectiveSec === 'properties' && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-luxury-brown-100">
            <div>
              <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                <Building className="w-4 h-4 text-luxury-gold-600" />
                Properties Portfolio &amp; Multi-Property Onboarding
              </h3>
              <p className="text-xs text-luxury-brown-500 mt-0.5">
                Centralized registry of hotel tenant properties managed under this account.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-luxury-brown-700 bg-luxury-beige-100 px-3 py-1 rounded-xl">
              {hotels.length} Properties Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {hotels.map((h) => (
              <div
                key={h.id}
                className={`p-4 rounded-2xl border transition-all ${
                  h.id === activeHotel.id
                    ? 'bg-luxury-beige-50/70 border-luxury-gold-500/50 ring-1 ring-luxury-gold-500/20'
                    : 'bg-white border-luxury-brown-100 hover:border-luxury-brown-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-luxury-brown-950">{h.name}</h4>
                    <p className="text-xs text-luxury-brown-500 mt-0.5">{h.address}</p>
                    <p className="text-[11px] font-mono text-luxury-gold-700 mt-1">Phone: {h.phoneNumber}</p>
                  </div>
                  {h.id === activeHotel.id && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                      Active Context
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
