import React, { useState, useEffect } from 'react';
import {
  Building2,
  Building,
  User,
  Smartphone,
  Mail,
  Globe,
  Upload,
  Clock,
  Key,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { Hotel, HotelSettings, UserRole } from '../../types';
import { showToast } from '../../utils/toast';
import { syncAllToSupabase, isBackendServerActive } from '../../utils/supabaseClient';

interface MasterSetupViewProps {
  activeHotel: Hotel;
  hotelSettings?: HotelSettings;
  currentRole: UserRole;
  onUpdateGlobalHotels: (updatedHotels: Hotel[]) => void;
  onUpdateHotelSettings?: (updated: HotelSettings) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function MasterSetupView({
  activeHotel,
  hotelSettings,
  currentRole,
  onUpdateGlobalHotels,
  onUpdateHotelSettings,
  onAddAuditLog,
}: MasterSetupViewProps) {
  const safeHotel: Hotel = activeHotel || {
    id: 'hotel-1',
    name: 'DirectStay Hotel',
    ownerName: 'Property Owner',
    phoneNumber: '+91 9876543210',
    whatsappNumber: '+91 9876543210',
    emailAddress: 'owner@directstay.online',
    address: 'India',
    checkInTime: '12:00 PM',
    checkOutTime: '11:00 AM',
    earlyCheckInEnabled: true,
    allowBackDatedCheckIn: false,
    earlyCheckInType: 'hourly',
    earlyCheckInHourlyRate: 0,
    earlyCheckInFixedRate: 0,
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    username: 'admin',
  } as unknown as Hotel;

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Identity Form States
  const [hotelName, setHotelName] = useState('');
  const [hotelOwnerName, setHotelOwnerName] = useState('');
  const [hotelPhone, setHotelPhone] = useState('');
  const [hotelWhatsAppNumber, setHotelWhatsAppNumber] = useState('');
  const [hotelEmail, setHotelEmail] = useState('');
  const [hotelWebsite, setHotelWebsite] = useState('');
  const [hotelLogoUrl, setHotelLogoUrl] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');

  // Operational Timings & Policies
  const [hotelCheckInTime, setHotelCheckInTime] = useState('12:00 PM');
  const [hotelCheckOutTime, setHotelCheckOutTime] = useState('11:00 AM');
  const [hotelEarlyCheckInEnabled, setHotelEarlyCheckInEnabled] = useState<boolean>(true);
  const [hotelAllowBackDatedCheckIn, setHotelAllowBackDatedCheckIn] = useState<boolean>(false);
  const [hotelEarlyCheckInType, setHotelEarlyCheckInType] = useState<'hourly' | 'fixed'>('hourly');
  const [hotelEarlyCheckInHourlyRate, setHotelEarlyCheckInHourlyRate] = useState<number>(0);
  const [hotelEarlyCheckInFixedRate, setHotelEarlyCheckInFixedRate] = useState<number>(0);
  const [hotelCurrency, setHotelCurrency] = useState('INR');
  const [hotelTimeZone, setHotelTimeZone] = useState('Asia/Kolkata');
  const [hotelDateFormat, setHotelDateFormat] = useState('DD/MM/YYYY');

  // Credentials & Passcode
  const [hotelUsername, setHotelUsername] = useState('admin');
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscodes, setShowPasscodes] = useState(false);

  useEffect(() => {
    const target = activeHotel || safeHotel;
    if (!target) return;
    setHotelName(target.name || '');
    setHotelOwnerName(target.ownerName || '');
    setHotelPhone(target.phoneNumber || '');
    setHotelWhatsAppNumber(target.whatsappNumber || target.phoneNumber || '');
    setHotelEmail(target.emailAddress || '');
    setHotelWebsite(target.website || '');
    setHotelLogoUrl(target.logoUrl || '');
    setHotelAddress(target.address || '');

    setHotelCheckInTime(target.checkInTime || '12:00 PM');
    setHotelCheckOutTime(target.checkOutTime || '11:00 AM');
    setHotelEarlyCheckInEnabled(target.earlyCheckInEnabled ?? true);
    setHotelAllowBackDatedCheckIn(target.allowBackDatedCheckIn ?? false);
    setHotelEarlyCheckInType(target.earlyCheckInType || 'hourly');
    setHotelEarlyCheckInHourlyRate(
      target.earlyCheckInHourlyRate !== undefined ? Number(target.earlyCheckInHourlyRate) : 0
    );
    setHotelEarlyCheckInFixedRate(
      target.earlyCheckInFixedRate !== undefined ? Number(target.earlyCheckInFixedRate) : 0
    );
    setHotelCurrency(target.currency || 'INR');
    setHotelTimeZone(target.timeZone || 'Asia/Kolkata');
    setHotelDateFormat(target.dateFormat || 'DD/MM/YYYY');

    setHotelUsername(target.username || 'admin');
  }, [activeHotel]);

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    // Validate passcode change if entered
    let updatedPassword: string | undefined = undefined;
    const isPasswordChanged = Boolean(newPasscode.trim() || confirmPasscode.trim());
    if (isPasswordChanged) {
      if (safeHotel.password && currentPasscode !== safeHotel.password) {
        const msg = 'Incorrect current hotel admin password.';
        setErrorMsg(msg);
        showToast(msg, 'error', 5000, 'Password Mismatch');
        return;
      }
      if (!newPasscode.trim()) {
        const msg = 'New passcode cannot be empty.';
        setErrorMsg(msg);
        showToast(msg, 'warning', 5000, 'Password Required');
        return;
      }
      if (newPasscode !== confirmPasscode) {
        const msg = 'New passcodes do not match.';
        setErrorMsg(msg);
        showToast(msg, 'error', 5000, 'Password Mismatch');
        return;
      }
      updatedPassword = newPasscode;
    }

    setIsSaving(true);

    try {
      const updatedHotel: Hotel = {
        ...safeHotel,
        name: hotelName.trim(),
        ownerName: hotelOwnerName.trim(),
        phoneNumber: hotelPhone.trim(),
        whatsappNumber: hotelWhatsAppNumber.trim(),
        emailAddress: hotelEmail.trim(),
        website: hotelWebsite.trim(),
        logoUrl: hotelLogoUrl.trim() || safeHotel.logoUrl,
        address: hotelAddress.trim(),
        checkInTime: hotelCheckInTime.trim(),
        checkOutTime: hotelCheckOutTime.trim(),
        earlyCheckInEnabled: hotelEarlyCheckInEnabled,
        allowBackDatedCheckIn: hotelAllowBackDatedCheckIn,
        earlyCheckInType: hotelEarlyCheckInType,
        earlyCheckInHourlyRate: Math.max(0, Number(hotelEarlyCheckInHourlyRate) || 0),
        earlyCheckInFixedRate: Math.max(0, Number(hotelEarlyCheckInFixedRate) || 0),
        currency: hotelCurrency.trim(),
        timeZone: hotelTimeZone.trim(),
        dateFormat: hotelDateFormat,
        username: hotelUsername.trim() || 'admin',
        ...(isPasswordChanged && updatedPassword ? { password: updatedPassword } : {}),
      };

      onUpdateGlobalHotels([updatedHotel]);

      if (onUpdateHotelSettings) {
        onUpdateHotelSettings({
          ...(hotelSettings || {
            logoUrl: hotelLogoUrl.trim() || safeHotel.logoUrl || '',
            name: hotelName.trim(),
            address: hotelAddress.trim(),
            gstNumber: safeHotel.gstNumber || '',
            phoneNumber: hotelPhone.trim(),
            emailAddress: hotelEmail.trim(),
            website: hotelWebsite.trim(),
          }),
          id: safeHotel.id,
          name: hotelName.trim(),
          address: hotelAddress.trim(),
          phoneNumber: hotelPhone.trim(),
          emailAddress: hotelEmail.trim(),
          website: hotelWebsite.trim(),
          logoUrl: hotelLogoUrl.trim() || safeHotel.logoUrl || '',
          checkInTime: hotelCheckInTime.trim(),
          checkOutTime: hotelCheckOutTime.trim(),
          earlyCheckInEnabled: hotelEarlyCheckInEnabled,
          allowBackDatedCheckIn: hotelAllowBackDatedCheckIn,
          earlyCheckInType: hotelEarlyCheckInType,
          earlyCheckInHourlyRate: Math.max(0, Number(hotelEarlyCheckInHourlyRate) || 0),
          earlyCheckInFixedRate: Math.max(0, Number(hotelEarlyCheckInFixedRate) || 0),
          timeZone: hotelTimeZone.trim(),
          dateFormat: hotelDateFormat,
        });
      }

      onAddAuditLog?.(
        'Master Setup Updated',
        `Updated core property details for "${hotelName.trim()}" (Phone: ${hotelPhone.trim()}, Check-In: ${hotelCheckInTime}, Back-Date Check-In: ${
          hotelAllowBackDatedCheckIn ? 'ON' : 'OFF'
        }${isPasswordChanged ? ', Password Rotated' : ''}).`
      );

      if (isBackendServerActive()) {
        await syncAllToSupabase({ hotels: [updatedHotel] });
      }

      const msg = `Master Property Setup saved successfully! (${hotelName.trim()})`;
      setSuccessMsg(msg);
      showToast(msg, 'success', 5000, 'Master Setup Saved');

      if (isPasswordChanged) {
        setCurrentPasscode('');
        setNewPasscode('');
        setConfirmPasscode('');
      }
    } catch (err: any) {
      const eMsg = err?.message || 'Failed to save master settings.';
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
              <Building2 className="w-3.5 h-3.5 text-luxury-gold-600" /> Core Property Profile
            </div>
            <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              Master Property Setup
            </h2>
            <p className="text-xs text-luxury-brown-500 mt-1">
              Configure core hotel identity, address, logo, default check-in/out hours, back-dated check-in activation, and administrator credentials.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luxury-beige-50 border border-luxury-brown-100 text-luxury-brown-800 text-xs font-mono font-bold">
              Property ID: {safeHotel.id}
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

      <form onSubmit={handleSaveMaster} className="space-y-6">
        {/* Section 1: Property Contact & Identity Cards */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <Building className="w-4 h-4 text-luxury-gold-600" />
            1. Property Contact &amp; Identity Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Hotel Property Name *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                  <Building className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Property Owner Name *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  value={hotelOwnerName}
                  onChange={(e) => setHotelOwnerName(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Primary Contact Phone *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                  <Smartphone className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  value={hotelPhone}
                  onChange={(e) => setHotelPhone(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">WhatsApp Notification Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                  <Smartphone className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={hotelWhatsAppNumber}
                  onChange={(e) => setHotelWhatsAppNumber(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Registered Email Address *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                  <Mail className="w-3.5 h-3.5" />
                </span>
                <input
                  type="email"
                  required
                  value={hotelEmail}
                  onChange={(e) => setHotelEmail(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Brand Web Portal Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                  <Globe className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={hotelWebsite}
                  onChange={(e) => setHotelWebsite(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <label className="text-xs font-bold text-luxury-brown-800">Brand Logo URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://... or /api/media/..."
                value={hotelLogoUrl}
                onChange={(e) => setHotelLogoUrl(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 font-mono"
              />
              {hotelLogoUrl && (
                <div className="w-10 h-10 rounded-xl border border-luxury-brown-200 overflow-hidden bg-luxury-beige-50 shrink-0 flex items-center justify-center">
                  <img src={hotelLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <label className="text-xs font-bold text-luxury-brown-800">Physical Property Address *</label>
            <textarea
              required
              rows={2}
              value={hotelAddress}
              onChange={(e) => setHotelAddress(e.target.value)}
              className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl p-3"
            />
          </div>
        </div>

        {/* Section 2: Operational Localization & Policies */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <Clock className="w-4 h-4 text-luxury-gold-600" />
            2. Operational Timings, Back-Date &amp; Check-In Policies
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Standard Check-In Time</label>
              <input
                type="text"
                value={hotelCheckInTime}
                onChange={(e) => setHotelCheckInTime(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Standard Check-Out Time</label>
              <input
                type="text"
                value={hotelCheckOutTime}
                onChange={(e) => setHotelCheckOutTime(e.target.value)}
                className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2 font-mono"
              />
            </div>
          </div>

          {/* Back-Dated Check-In Policy Card */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-luxury-brown-950 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  Allow Back-Dated &amp; Past-Time Check-In
                </label>
                <p className="text-[11px] text-luxury-brown-600 mt-0.5">
                  When enabled, Front Desk staff can select past arrival dates and past check-in times in check-in forms and advance reservation modals for late entries and manual book syncing.
                </p>
              </div>
              <input
                type="checkbox"
                checked={hotelAllowBackDatedCheckIn}
                onChange={(e) => setHotelAllowBackDatedCheckIn(e.target.checked)}
                className="w-5 h-5 mt-1 text-amber-600 rounded border-luxury-brown-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Early Check-In Policy */}
          <div className="p-4 rounded-2xl bg-luxury-beige-50/60 border border-luxury-brown-100 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-luxury-brown-950">
                  Allow Early Check-In Billing
                </label>
                <p className="text-[11px] text-luxury-brown-600">
                  Charge guests an additional rate if arriving prior to standard check-in hour.
                </p>
              </div>
              <input
                type="checkbox"
                checked={hotelEarlyCheckInEnabled}
                onChange={(e) => setHotelEarlyCheckInEnabled(e.target.checked)}
                className="w-5 h-5 text-luxury-gold-600 rounded border-luxury-brown-300 focus:ring-luxury-gold-500 cursor-pointer"
              />
            </div>

            {hotelEarlyCheckInEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-luxury-brown-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-luxury-brown-800">Early Check-In Type</label>
                  <select
                    value={hotelEarlyCheckInType}
                    onChange={(e) => setHotelEarlyCheckInType(e.target.value as any)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-1.5"
                  >
                    <option value="hourly">Hourly Surcharge (₹ / hr)</option>
                    <option value="fixed">Fixed Single Flat Fee (₹)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-luxury-brown-800">
                    {hotelEarlyCheckInType === 'hourly' ? 'Hourly Surcharge Rate (₹)' : 'Fixed Flat Fee (₹)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={hotelEarlyCheckInType === 'hourly' ? hotelEarlyCheckInHourlyRate : hotelEarlyCheckInFixedRate}
                    onChange={(e) =>
                      hotelEarlyCheckInType === 'hourly'
                        ? setHotelEarlyCheckInHourlyRate(Number(e.target.value))
                        : setHotelEarlyCheckInFixedRate(Number(e.target.value))
                    }
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-1.5 font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Credentials & Passcode */}
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2 pb-2 border-b border-luxury-brown-50">
            <Key className="w-4 h-4 text-luxury-gold-600" />
            3. Hotel Admin Username &amp; Passcode Key
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-luxury-brown-800">Hotel Admin Username</label>
              <input
                type="text"
                disabled
                value={hotelUsername}
                className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-4 py-2 font-mono text-luxury-brown-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-luxury-brown-50 space-y-3">
            <h4 className="text-xs font-bold text-luxury-brown-800">Rotate Hotel Admin Passcode (Optional)</h4>
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
            <button
              type="button"
              onClick={() => setShowPasscodes(!showPasscodes)}
              className="text-[11px] text-luxury-brown-500 hover:text-luxury-brown-800 font-mono underline cursor-pointer"
            >
              {showPasscodes ? 'Hide characters' : 'Show character keys'}
            </button>
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
            {isSaving ? 'Saving Master Setup...' : 'Save Master Property Setup'}
          </button>
        </div>
      </form>
    </div>
  );
}
