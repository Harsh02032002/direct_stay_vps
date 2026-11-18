import React, { useState, useEffect } from 'react';
import { 
  User, Key, Save, Building, CheckCircle2, AlertCircle, 
  ShieldCheck, Smartphone, Mail, FileText, Globe, Lock, RefreshCw, Clock, Receipt, Droplets,
  FileCheck, Download, Eye, Upload
} from 'lucide-react';
import { Hotel, HotelSettings, Staff, SubscriptionInvoice, UserRole } from '../types';
import SubscriptionInvoiceModal from './SubscriptionInvoiceModal';
import InvoiceConditionsModal from './InvoiceConditionsModal';
import { getHotelTaxSettings, saveHotelTaxSettings } from '../pms-integrated/utils/taxSettings';
import { formatGrcNumber, formatInvoiceNumber, r2 } from '../utils/billCalculator';
import { defaultGrcTerms } from '../utils/printTemplates';
import { showToast } from '../utils/toast';
import { syncAllToSupabase, isBackendServerActive } from '../utils/supabaseClient';

interface ProfileSettingsViewProps {
  currentRole: UserRole;
  loggedInUser: string;
  hotels: Hotel[];
  selectedHotelId: string;
  rawStaff: Staff[];
  hotelSettings?: HotelSettings;
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
  onUpdateHotelSettings,
  onUpdateGlobalHotels,
  onUpdateGlobalStaff,
  onAddAuditLog
}: ProfileSettingsViewProps) {
  // Alert/Status states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Common Passcode change fields
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscodes, setShowPasscodes] = useState(false);

  // SuperAdmin Profile Form States
  const [superAdminName, setSuperAdminName] = useState(loggedInUser || 'Super Admin');
  const [superAdminUsername, setSuperAdminUsername] = useState('superadmin');

  // Hotel Admin States
  const activeHotel = hotels.find(h => h.id === selectedHotelId) || hotels[0];
  const [hotelName, setHotelName] = useState('');
  const [hotelPhone, setHotelPhone] = useState('');
  const [hotelEmail, setHotelEmail] = useState('');
  const [hotelWebsite, setHotelWebsite] = useState('');
  const [hotelGst, setHotelGst] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelUsername, setHotelUsername] = useState('');

  // New Hotel Profile fields
  const [hotelOwnerName, setHotelOwnerName] = useState('');
  const [hotelPan, setHotelPan] = useState('');
  const [hotelCheckInTime, setHotelCheckInTime] = useState('');
  const [hotelCheckOutTime, setHotelCheckOutTime] = useState('');
  const [hotelEarlyCheckInEnabled, setHotelEarlyCheckInEnabled] = useState<boolean>(true);
  const [hotelEarlyCheckInType, setHotelEarlyCheckInType] = useState<'hourly' | 'fixed'>('hourly');
  const [hotelEarlyCheckInHourlyRate, setHotelEarlyCheckInHourlyRate] = useState<number>(0);
  const [hotelEarlyCheckInFixedRate, setHotelEarlyCheckInFixedRate] = useState<number>(0);
  const [hotelCurrency, setHotelCurrency] = useState('');
  const [hotelTimeZone, setHotelTimeZone] = useState('');
  const [hotelDateFormat, setHotelDateFormat] = useState('DD/MM/YYYY');
  const [hotelWhatsAppNumber, setHotelWhatsAppNumber] = useState('');
  const [hotelEmailSettings, setHotelEmailSettings] = useState('');
  const [hotelInvoicePrefix, setHotelInvoicePrefix] = useState('INV');
  const [hotelNextInvoiceSequence, setHotelNextInvoiceSequence] = useState<number>(1001);
  const [hotelLogoUrl, setHotelLogoUrl] = useState('');
  const [hotelIsGstEnabled, setHotelIsGstEnabled] = useState<boolean>(true);
  const [hotelDefaultGstRate, setHotelDefaultGstRate] = useState<number>(5);
  const [hotelFoodGstRate, setHotelFoodGstRate] = useState<number>(5);
  const [hotelRoomRateIncludesGst, setHotelRoomRateIncludesGst] = useState<boolean>(false);
  const [hotelTaxOnAncillary, setHotelTaxOnAncillary] = useState<boolean>(true);
  const [hotelPlaceOfSupply, setHotelPlaceOfSupply] = useState<string>('');
  const [hotelWaterBottleRate, setHotelWaterBottleRate] = useState<number>(20);
  const [hotelGrcPrefix, setHotelGrcPrefix] = useState<string>('GRC');
  const [hotelNextGrcSequence, setHotelNextGrcSequence] = useState<number>(1);
  const [hotelGrcTermsText, setHotelGrcTermsText] = useState<string>(() => defaultGrcTerms().join('\n'));
  const isHotelAdminOrOwner =
    currentRole === 'Admin' ||
    (currentRole as string) === 'Owner' ||
    currentRole === 'SuperAdmin';

  // Admin Membership Renewal Request & Invoice Viewer State
  const [viewingSubInvoice, setViewingSubInvoice] = useState<SubscriptionInvoice | null>(null);
  const [isConditionsModalOpen, setIsConditionsModalOpen] = useState(false);
  const [adminRenewPlan, setAdminRenewPlan] = useState<'Monthly' | 'HalfYearly' | 'Yearly'>('Yearly');
  const [adminRenewPaymentMode, setAdminRenewPaymentMode] = useState<string>('UPI');
  const [adminRenewUtr, setAdminRenewUtr] = useState<string>('');
  const [isSubmittingAdminRenewal, setIsSubmittingAdminRenewal] = useState(false);

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
    setErrorMsg(null);
    setSuccessMsg(null);
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
        setErrorMsg(data.error || 'Failed to submit renewal request.');
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
        `Hotel Admin requested ${pkgName} (${adminRenewPlan}) renewal (₹${baseAmt.toLocaleString('en-IN')} + GST, Mode: ${adminRenewPaymentMode}, Ref: ${cleanRef}).`
      );
      setAdminRenewUtr('');
      setSuccessMsg(`Membership renewal request (${pkgName} • Ref: ${cleanRef}) sent to Super Admin for payment approval & invoice generation!`);
    } catch {
      setErrorMsg('Network error submitting membership renewal request.');
    } finally {
      setIsSubmittingAdminRenewal(false);
    }
  };

  // Staff States
  // Try to find the matching staff member in rawStaff who is logged in
  const activeStaff = rawStaff.find(
    s => s.name === loggedInUser && s.hotelId === selectedHotelId
  );
  const [staffName, setStaffName] = useState('');
  const [staffMobile, setStaffMobile] = useState('');
  const [staffUsername, setStaffUsername] = useState('');

  // Load initial fields on mount/role shift
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);

    if (currentRole === 'SuperAdmin') {
      setSuperAdminUsername('superadmin');
    }
    if (isHotelAdminOrOwner && activeHotel) {
      setHotelName(activeHotel.name || '');
      setHotelPhone(activeHotel.phoneNumber || '');
      setHotelEmail(activeHotel.emailAddress || '');
      setHotelWebsite(activeHotel.website || '');
      setHotelGst(activeHotel.gstNumber || '');
      setHotelAddress(activeHotel.address || '');
      setHotelUsername(activeHotel.username || 'admin');

      setHotelOwnerName(activeHotel.ownerName || '');
      setHotelPan(activeHotel.panNumber || hotelSettings?.panNumber || '');
      setHotelPlaceOfSupply(activeHotel.placeOfSupply || hotelSettings?.placeOfSupply || '');
      setHotelCheckInTime(activeHotel.checkInTime || '12:00 PM');
      setHotelCheckOutTime(activeHotel.checkOutTime || '11:00 AM');
      setHotelEarlyCheckInEnabled(activeHotel.earlyCheckInEnabled ?? true);
      setHotelEarlyCheckInType(activeHotel.earlyCheckInType || 'hourly');
      setHotelEarlyCheckInHourlyRate(activeHotel.earlyCheckInHourlyRate !== undefined ? Number(activeHotel.earlyCheckInHourlyRate) : 0);
      setHotelEarlyCheckInFixedRate(activeHotel.earlyCheckInFixedRate !== undefined ? Number(activeHotel.earlyCheckInFixedRate) : 0);
      setHotelCurrency(activeHotel.currency || 'INR');
      setHotelTimeZone(activeHotel.timeZone || 'Asia/Kolkata');
      setHotelDateFormat(activeHotel.dateFormat || 'DD/MM/YYYY');
      setHotelWhatsAppNumber(activeHotel.whatsappNumber || '');
      if (activeHotel.emailSettings && typeof activeHotel.emailSettings === 'object') {
        setHotelEmailSettings(activeHotel.emailSettings.host ? `${activeHotel.emailSettings.host}:${activeHotel.emailSettings.port || 587}` : 'smtp.directstay.com');
      } else {
        setHotelEmailSettings(activeHotel.emailSettings || 'smtp.directstay.com');
      }
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
      setHotelLogoUrl(activeHotel.logoUrl || '');
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
      setHotelDefaultGstRate(Number(rTotal));
      setHotelFoodGstRate(Number(fTotal));
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
    } else if (!isHotelAdminOrOwner) {
      // General staff profile
      if (activeStaff) {
        setStaffName(activeStaff.name || '');
        setStaffMobile(activeStaff.mobile || '');
        setStaffUsername(activeStaff.username || '');
      }
    }
  }, [currentRole, isHotelAdminOrOwner, selectedHotelId, activeHotel, activeStaff]);

  // Handle SuperAdmin Passcode Save
  const handleSuperAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const correctCurrent = 'admin123';
    if (currentPasscode !== correctCurrent) {
      setErrorMsg('Incorrect current password.');
      return;
    }

    if (!newPasscode.trim()) {
      setErrorMsg('New passcode cannot be empty.');
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setErrorMsg('New passcodes do not match.');
      return;
    }

    onAddAuditLog?.(
      'Profile Credentials Updated',
      `Updated Super Admin profile and security passcode for ${superAdminUsername}.`
    );
    const saMsg = 'Super Admin security credentials updated successfully!';
    setSuccessMsg(saMsg);
    showToast(saMsg, 'success', 4500, 'Settings Saved');
    
    // Clear fields
    setCurrentPasscode('');
    setNewPasscode('');
    setConfirmPasscode('');
  };

  // Save Hotel Profile, GST, Invoice, Water & GRC Settings (optionally with password rotation)
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const saveHotelProfileSettings = async (includePasswordUpdate: boolean) => {
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!activeHotel) {
      const msg = 'No active hotel context found.';
      setErrorMsg(msg);
      showToast(msg, 'error', 5000, 'Save Failed');
      return;
    }

    // Only validate/update password when explicitly submitting the full form AND a new password is entered
    let updatedPassword: string | undefined = undefined;
    const isPasswordChanged = includePasswordUpdate && Boolean(newPasscode.trim() || confirmPasscode.trim());
    if (isPasswordChanged) {
      if (activeHotel.password && currentPasscode !== activeHotel.password) {
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

    setIsSavingSettings(true);

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
      .map(line => line.replace(/^\s*\d+\s*[.)]\s*/, '').trim())
      .filter(Boolean);
    const cleanGrcTerms = parsedTerms.length > 0 ? parsedTerms : defaultGrcTerms();

    // Create updated hotel entry (never overwrite stripped password unless explicitly changed)
    const updatedHotels = hotels.map(h => {
      if (h.id === activeHotel.id) {
        return {
          ...h,
          name: hotelName.trim(),
          phoneNumber: hotelPhone.trim(),
          emailAddress: hotelEmail.trim(),
          website: hotelWebsite.trim(),
          gstNumber: hotelGst.trim().toUpperCase(),
          address: hotelAddress.trim(),
          username: hotelUsername.trim() || 'admin',
          ...(isPasswordChanged && updatedPassword ? { password: updatedPassword } : {}),
          ownerName: hotelOwnerName.trim(),
          panNumber: cleanPan,
          placeOfSupply: cleanPlaceOfSupply,
          checkInTime: hotelCheckInTime.trim(),
          checkOutTime: hotelCheckOutTime.trim(),
          earlyCheckInEnabled: hotelEarlyCheckInEnabled,
          earlyCheckInType: hotelEarlyCheckInType,
          earlyCheckInHourlyRate: Math.max(0, Number(hotelEarlyCheckInHourlyRate) || 0),
          earlyCheckInFixedRate: Math.max(0, Number(hotelEarlyCheckInFixedRate) || 0),
          currency: hotelCurrency.trim(),
          timeZone: hotelTimeZone.trim(),
          dateFormat: hotelDateFormat,
          whatsappNumber: hotelWhatsAppNumber.trim(),
          emailSettings: hotelEmailSettings.trim(),
          invoicePrefix: cleanPrefix,
          nextInvoiceSequence: cleanNextInvSeq,
          logoUrl: hotelLogoUrl.trim() || h.logoUrl,
          isGstEnabled: hotelIsGstEnabled,
          defaultGstRate: cleanRoomGst,
          foodGstRate: cleanFoodGst,
          roomRateIncludesGst: hotelRoomRateIncludesGst,
          taxOnAncillary: hotelTaxOnAncillary,
          waterBottleRate: cleanWaterRate,
          grcPrefix: cleanGrcPrefix,
          nextGrcSequence: cleanNextGrcSeq,
          grcTerms: cleanGrcTerms,
        };
      }
      return h;
    });

    // Sync immediately to /admin hub taxSettings + MongoDB taxSettings module
    saveHotelTaxSettings(
      {
        roomCgst: r2(cleanRoomGst / 2),
        roomSgst: r2(cleanRoomGst - r2(cleanRoomGst / 2)),
        fnbCgst: r2(cleanFoodGst / 2),
        fnbSgst: r2(cleanFoodGst - r2(cleanFoodGst / 2)),
        invoicePrefix: cleanPrefix,
      },
      activeHotel.id
    );

    if (onUpdateHotelSettings) {
      onUpdateHotelSettings({
        ...(hotelSettings || {
          logoUrl: hotelLogoUrl.trim() || activeHotel.logoUrl || '',
          name: hotelName.trim(),
          address: hotelAddress.trim(),
          gstNumber: hotelGst.trim().toUpperCase(),
          phoneNumber: hotelPhone.trim(),
          emailAddress: hotelEmail.trim(),
          website: hotelWebsite.trim(),
        }),
        id: activeHotel.id,
        name: hotelName.trim(),
        address: hotelAddress.trim(),
        gstNumber: hotelGst.trim().toUpperCase(),
        panNumber: cleanPan,
        placeOfSupply: cleanPlaceOfSupply,
        phoneNumber: hotelPhone.trim(),
        emailAddress: hotelEmail.trim(),
        website: hotelWebsite.trim(),
        logoUrl: hotelLogoUrl.trim() || activeHotel.logoUrl || '',
        checkInTime: hotelCheckInTime.trim(),
        checkOutTime: hotelCheckOutTime.trim(),
        earlyCheckInEnabled: hotelEarlyCheckInEnabled,
        earlyCheckInType: hotelEarlyCheckInType,
        earlyCheckInHourlyRate: Math.max(0, Number(hotelEarlyCheckInHourlyRate) || 0),
        earlyCheckInFixedRate: Math.max(0, Number(hotelEarlyCheckInFixedRate) || 0),
        invoicePrefix: cleanPrefix,
        nextInvoiceSequence: cleanNextInvSeq,
        isGstEnabled: hotelIsGstEnabled,
        defaultGstRate: cleanRoomGst,
        foodGstRate: cleanFoodGst,
        roomRateIncludesGst: hotelRoomRateIncludesGst,
        taxOnAncillary: hotelTaxOnAncillary,
        waterBottleRate: cleanWaterRate,
        grcPrefix: cleanGrcPrefix,
        nextGrcSequence: cleanNextGrcSeq,
        grcTerms: cleanGrcTerms,
      });
    }

    onUpdateGlobalHotels(updatedHotels);
    onAddAuditLog?.(
      'Hotel Profile & GST Settings Updated',
      `Updated "${hotelName.trim()}" — Room GST: ${cleanRoomGst}%, Food GST: ${cleanFoodGst}%, Inclusive: ${hotelRoomRateIncludesGst ? 'ON' : 'OFF'}, Ancillary GST: ${hotelTaxOnAncillary ? 'ON' : 'OFF'}, Prefix: ${cleanPrefix}/${cleanNextInvSeq}, Water: ₹${cleanWaterRate}, GRC: ${cleanGrcPrefix}.`
    );

    try {
      if (isBackendServerActive()) {
        const syncRes = await syncAllToSupabase({ hotels: updatedHotels });
        if (!syncRes.success) {
          const errText = syncRes.error || 'Failed to save settings to server. Please sign in again.';
          setErrorMsg(errText);
          showToast(errText, 'error', 6000, 'Settings Save Failed');
          setIsSavingSettings(false);
          return;
        }
      }

      const summaryMsg = `Saved! Invoice ${formatInvoiceNumber(cleanPrefix, cleanNextInvSeq)} • Room GST ${cleanRoomGst}% (${hotelRoomRateIncludesGst ? 'Inclusive' : 'Exclusive'}) • Water ₹${cleanWaterRate}/bottle • GRC ${formatGrcNumber(cleanGrcPrefix, cleanNextGrcSeq)}`;
      setSuccessMsg(summaryMsg);
      showToast(summaryMsg, 'success', 5000, 'Settings Saved Successfully');

      if (includePasswordUpdate) {
        setCurrentPasscode('');
        setNewPasscode('');
        setConfirmPasscode('');
      }
    } catch (err: any) {
      const errText = err?.message || 'Unexpected error while saving settings.';
      setErrorMsg(errText);
      showToast(errText, 'error', 6000, 'Settings Save Failed');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Hotel Level Profile & Password Save
  const handleHotelAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveHotelProfileSettings(true);
  };

  // Handle Staff Level Personal Password Save
  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!activeStaff) {
      setErrorMsg('Active staff context not found in the property registry.');
      return;
    }

    let updatedPassword = activeStaff.password || 'password';
    const isPasswordChanged = Boolean(newPasscode.trim() || confirmPasscode.trim());
    if (isPasswordChanged) {
      if (currentPasscode !== (activeStaff.password || 'password')) {
        setErrorMsg('Incorrect current passcode.');
        return;
      }
      if (!newPasscode.trim()) {
        setErrorMsg('New passcode cannot be empty.');
        return;
      }
      if (newPasscode !== confirmPasscode) {
        setErrorMsg('New passcodes do not match.');
        return;
      }
      updatedPassword = newPasscode;
    }

    // Create updated staff list
    const updatedStaffList = rawStaff.map(s => {
      if (s.id === activeStaff.id) {
        return {
          ...s,
          username: staffUsername.trim() || s.username,
          ...(isPasswordChanged ? { password: updatedPassword } : {}),
          mobile: staffMobile.trim() || s.mobile
        };
      }
      return s;
    });

    onUpdateGlobalStaff(updatedStaffList);
    onAddAuditLog?.(
      'Staff Profile Updated',
      `Updated personal profile for staff member ${activeStaff.name}${isPasswordChanged ? ' (passcode rotated)' : ''}.`
    );
    const stfMsg = 'Personal profile and security passcode updated successfully!';
    setSuccessMsg(stfMsg);
    showToast(stfMsg, 'success', 4500, 'Profile Saved');

    // Reset passcode inputs
    setCurrentPasscode('');
    setNewPasscode('');
    setConfirmPasscode('');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto" id="profile-settings-desk">
      {/* Page Header */}
      <div className="bg-white border border-luxury-brown-100 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-brown-950/5 text-luxury-brown-800 border border-luxury-brown-100 text-[9px] font-mono uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3 text-luxury-gold-600" /> Identity Management
          </div>
          <h2 className="text-2xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            My Profile Settings Desk
          </h2>
          <p className="text-xs text-luxury-brown-500">
            Review your dynamic credentials, manage physical contact cards, and rotate security passcodes.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 bg-luxury-beige-50 border border-luxury-brown-100 px-4 py-2.5 rounded-xl text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-luxury-brown-700 font-bold">
            Authenticated as: <span className="text-luxury-gold-600 uppercase">{currentRole}</span>
          </span>
        </div>
      </div>

      {/* Alert Status */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-start gap-3 text-xs">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Settings Saved</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 text-xs">
          <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Update Rejected</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Content Form based on role */}
      {currentRole === 'SuperAdmin' && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 border-b border-luxury-gold-500/10">
            <h3 className="font-serif font-bold text-md flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-luxury-gold-400" /> Core Super Admin Security Console
            </h3>
            <p className="text-luxury-brown-300 text-[11px] mt-1">
              Configure SaaS Imperial root administrative identity, support profiles, and rotate master security passcode keys.
            </p>
          </div>

          <form onSubmit={handleSuperAdminSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-600 tracking-wide block">
                  SaaS Owner Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    disabled
                    value={superAdminName}
                    className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 text-luxury-brown-400 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-600 tracking-wide block">
                  Core Login Principal / Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    disabled
                    value={superAdminUsername}
                    className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 text-luxury-brown-400 cursor-not-allowed font-medium font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Password rotation section */}
            <div className="pt-6 border-t border-luxury-brown-50 space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase text-luxury-gold-600 tracking-wide flex items-center gap-1.5">
                <Key className="w-4 h-4 text-luxury-gold-500" /> Rotate Security Passcode Key
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">Current Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    required
                    placeholder="Current key (e.g. admin123)"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">New Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    required={!!currentPasscode}
                    placeholder="New security key"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">Confirm New Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    required={!!currentPasscode}
                    placeholder="Repeat new key"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodes(!showPasscodes)}
                  className="text-[10px] text-luxury-brown-500 hover:text-luxury-brown-800 font-mono underline focus:outline-none cursor-pointer"
                >
                  {showPasscodes ? 'Hide characters' : 'Show character keys'}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Rotate Core Passcode
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isHotelAdminOrOwner && activeHotel && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 border-b border-luxury-gold-500/10">
            <h3 className="font-serif font-bold text-md flex items-center gap-2">
              <Building className="w-5 h-5 text-luxury-gold-400" /> Hotel Tenant Profile &amp; Centralized Billing Configuration
            </h3>
            <p className="text-luxury-brown-300 text-[11px] mt-1">
              Configure Hotel Identity, GST, Invoice Numbering, Water Bottle Rate, Guest Registration Card (GRC) Settings, and Login Credentials.
            </p>
          </div>

          <form onSubmit={handleHotelAdminSubmit} className="p-6 space-y-6">
            {/* Business brand inputs */}
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-mono font-bold uppercase text-luxury-gold-600 tracking-wide pb-1.5 border-b border-luxury-brown-50">
                  1. Property Contact & Identity Cards
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Hotel Property Name *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                        <Building className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        required
                        value={hotelName}
                        onChange={(e) => setHotelName(e.target.value)}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Property Owner Name *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        required
                        value={hotelOwnerName}
                        onChange={(e) => setHotelOwnerName(e.target.value)}
                        placeholder="Owner full name"
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Primary Contact Phone *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                        <Smartphone className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        required
                        value={hotelPhone}
                        onChange={(e) => setHotelPhone(e.target.value)}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">WhatsApp Notification Number</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald-600">
                        💬
                      </span>
                      <input
                        type="text"
                        value={hotelWhatsAppNumber}
                        onChange={(e) => setHotelWhatsAppNumber(e.target.value)}
                        placeholder="e.g. +91 99999 88888"
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Registered Email Address *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="email"
                        required
                        value={hotelEmail}
                        onChange={(e) => setHotelEmail(e.target.value)}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Brand Web Portal Address</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                        <Globe className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={hotelWebsite}
                        onChange={(e) => setHotelWebsite(e.target.value)}
                        className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl pl-9 pr-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Brand Logo URL</label>
                    <input
                      type="text"
                      value={hotelLogoUrl}
                      onChange={(e) => setHotelLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Physical Property Address *</label>
                    <textarea
                      rows={2}
                      required
                      value={hotelAddress}
                      onChange={(e) => setHotelAddress(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* CENTRALIZED GST, INVOICE NUMBER, WATER BOTTLE & GRC SETTINGS CARD */}
              <div className="rounded-2xl border-2 border-[#C49A3A]/60 bg-gradient-to-br from-[#FFFDF7] via-white to-[#FBF4E0]/40 p-5 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C49A3A]/30 pb-3.5">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#17120F] text-[#E0BD6B] font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                      <Receipt className="w-3 h-3" /> Single Source of Truth • Web &amp; /admin Hub
                    </span>
                    <h4 className="text-base font-serif font-bold text-luxury-brown-950">
                      GST, Invoice Number, Water Bottle &amp; GRC Settings
                    </h4>
                    <p className="text-[11px] text-luxury-brown-600">
                      Applied automatically across Check-In, Advance Booking, Checkout, POS Restaurant, Invoices, and GRC Printing.
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={() => saveHotelProfileSettings(false)}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                    >
                      {isSavingSettings ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Save GST, Invoice &amp; GRC Settings
                        </>
                      )}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#17120F] text-[#E0BD6B] border border-[#C49A3A] font-mono text-[11px] font-bold shadow-xs">
                        Preview: {formatInvoiceNumber((hotelInvoicePrefix || 'INV').replace(/[-/\s]+$/, '') || 'INV', Math.max(1, Number(hotelNextInvoiceSequence) || 1001))}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-luxury-brown-600">
                        GRC: {formatGrcNumber((hotelGrcPrefix || 'GRC').replace(/[-/\s]+$/, '') || 'GRC', Math.max(1, Number(hotelNextGrcSequence) || 1))}
                      </span>
                    </div>
                  </div>
                </div>

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Row A: GSTIN, PAN, Place of Supply */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-800">
                      Hotel GSTIN Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-luxury-brown-400">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={hotelGst}
                        onChange={(e) => setHotelGst(e.target.value.toUpperCase())}
                        placeholder="e.g. 22AAAAA0000A1Z5"
                        className="w-full text-xs bg-white border border-luxury-brown-200 rounded-xl pl-9 pr-3 py-2.5 font-mono uppercase font-bold text-luxury-brown-950 focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-800">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={hotelPan}
                      onChange={(e) => setHotelPan(e.target.value.toUpperCase())}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-mono uppercase font-bold text-luxury-brown-950 focus:outline-none focus:border-luxury-gold-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-800">
                      Place of Supply (City / State)
                    </label>
                    <input
                      type="text"
                      value={hotelPlaceOfSupply}
                      onChange={(e) => setHotelPlaceOfSupply(e.target.value)}
                      placeholder="e.g. Raipur, Chhattisgarh"
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-xl px-3.5 py-2.5 font-semibold text-luxury-brown-950 focus:outline-none focus:border-luxury-gold-500"
                    />
                  </div>
                </div>

                {/* Row B: Default Room GST % & Food / Restaurant GST % + Water Bottle Price */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-luxury-brown-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-luxury-brown-900">
                        Default Room GST %
                      </label>
                      <span className="text-[10px] font-mono font-bold text-emerald-700">
                        {hotelIsGstEnabled && hotelDefaultGstRate > 0
                          ? `CGST ${r2(hotelDefaultGstRate / 2)}% + SGST ${r2(hotelDefaultGstRate - r2(hotelDefaultGstRate / 2))}%`
                          : '0% Exempt'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={hotelIsGstEnabled ? hotelDefaultGstRate : 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setHotelIsGstEnabled(val > 0 || hotelFoodGstRate > 0);
                          setHotelDefaultGstRate(val);
                        }}
                        className="w-24 text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 font-mono font-bold text-luxury-brown-950"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[5, 12, 18, 0].map((slab) => (
                          <button
                            key={slab}
                            type="button"
                            onClick={() => {
                              if (slab === 0) {
                                setHotelDefaultGstRate(0);
                                if (hotelFoodGstRate <= 0) setHotelIsGstEnabled(false);
                              } else {
                                setHotelIsGstEnabled(true);
                                setHotelDefaultGstRate(slab);
                              }
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10.5px] font-mono font-bold border cursor-pointer transition-all ${
                              (hotelIsGstEnabled ? hotelDefaultGstRate : 0) === slab
                                ? 'bg-[#17120F] text-[#E0BD6B] border-[#17120F]'
                                : 'bg-luxury-beige-50 text-luxury-brown-800 border-luxury-brown-200 hover:bg-luxury-beige-100'
                            }`}
                          >
                            {slab}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-luxury-brown-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-luxury-brown-900">
                        Food / Restaurant GST %
                      </label>
                      <span className="text-[10px] font-mono font-bold text-emerald-700">
                        {hotelIsGstEnabled && hotelFoodGstRate > 0
                          ? `CGST ${r2(hotelFoodGstRate / 2)}% + SGST ${r2(hotelFoodGstRate - r2(hotelFoodGstRate / 2))}%`
                          : '0% Exempt'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={hotelIsGstEnabled ? hotelFoodGstRate : 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setHotelIsGstEnabled(val > 0 || hotelDefaultGstRate > 0);
                          setHotelFoodGstRate(val);
                        }}
                        className="w-24 text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 font-mono font-bold text-luxury-brown-950"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[5, 12, 18, 0].map((slab) => (
                          <button
                            key={slab}
                            type="button"
                            onClick={() => {
                              if (slab === 0) {
                                setHotelFoodGstRate(0);
                                if (hotelDefaultGstRate <= 0) setHotelIsGstEnabled(false);
                              } else {
                                setHotelIsGstEnabled(true);
                                setHotelFoodGstRate(slab);
                              }
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10.5px] font-mono font-bold border cursor-pointer transition-all ${
                              (hotelIsGstEnabled ? hotelFoodGstRate : 0) === slab
                                ? 'bg-[#17120F] text-[#E0BD6B] border-[#17120F]'
                                : 'bg-luxury-beige-50 text-luxury-brown-800 border-luxury-brown-200 hover:bg-luxury-beige-100'
                            }`}
                          >
                            {slab}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-luxury-brown-200">
                    <label className="text-[11px] font-bold text-luxury-brown-900 flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-600" />
                      Water Bottle Price (₹ / bottle)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-luxury-brown-600 text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={hotelWaterBottleRate}
                        onChange={(e) => setHotelWaterBottleRate(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="20"
                        className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg pl-7 pr-3 py-2 font-mono font-bold text-luxury-brown-950"
                      />
                    </div>
                    <p className="text-[10px] text-luxury-brown-500">
                      Default chargeable unit rate in Front Desk Water Log (default ₹20).
                    </p>
                  </div>
                </div>

                {/* Row C: Inclusive Tariff Toggle & Ancillary GST Toggle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      hotelRoomRateIncludesGst
                        ? 'bg-emerald-50/80 border-emerald-400 shadow-2xs'
                        : 'bg-white border-luxury-brown-200 hover:border-luxury-gold-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={hotelRoomRateIncludesGst}
                      onChange={(e) => setHotelRoomRateIncludesGst(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-emerald-700 rounded cursor-pointer shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-luxury-brown-950 block">
                        Room Tariff Includes GST ({hotelRoomRateIncludesGst ? 'ON — Inclusive' : 'OFF — Exclusive'})
                      </span>
                      <span className="text-[10.5px] text-luxury-brown-600 block font-mono">
                        e.g. ₹1,300 inclusive @ 5% = ₹1,238.10 Room + ₹61.90 GST
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      hotelTaxOnAncillary
                        ? 'bg-emerald-50/80 border-emerald-400 shadow-2xs'
                        : 'bg-white border-luxury-brown-200 hover:border-luxury-gold-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={hotelTaxOnAncillary}
                      onChange={(e) => setHotelTaxOnAncillary(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-emerald-700 rounded cursor-pointer shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-luxury-brown-950 block">
                        Apply GST on Water / Extra Services / Laundry ({hotelTaxOnAncillary ? 'ON' : 'OFF'})
                      </span>
                      <span className="text-[10.5px] text-luxury-brown-600 block">
                        When ON, chargeable water bottles, extra guest services, and laundry attract Room GST %. Damage fines remain 0% GST.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Row D: Invoice Prefix + Next Invoice Number & GRC Prefix + Next GRC Number */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-luxury-brown-200">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-800">
                      Invoice Prefix
                    </label>
                    <input
                      type="text"
                      value={hotelInvoicePrefix}
                      onChange={(e) => setHotelInvoicePrefix(e.target.value.toUpperCase())}
                      placeholder="e.g. MMPR or INV"
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 font-mono font-bold uppercase text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-800">
                      Starting / Next Invoice Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={hotelNextInvoiceSequence}
                      onChange={(e) => setHotelNextInvoiceSequence(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      placeholder="1014"
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 font-mono font-bold text-luxury-brown-950"
                    />
                    <span className="inline-block text-[10px] font-mono font-bold text-[#8B691E] bg-[#FBF4E0] border border-[#C49A3A]/50 px-2 py-0.5 rounded">
                      Preview: {formatInvoiceNumber((hotelInvoicePrefix || 'INV').replace(/[-/\s]+$/, '') || 'INV', Math.max(1, Number(hotelNextInvoiceSequence) || 1001))}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-800">
                      GRC Prefix
                    </label>
                    <input
                      type="text"
                      value={hotelGrcPrefix}
                      onChange={(e) => setHotelGrcPrefix(e.target.value.toUpperCase())}
                      placeholder="e.g. HRR or GRC"
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 font-mono font-bold uppercase text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-800">
                      Next GRC Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={hotelNextGrcSequence}
                      onChange={(e) => setHotelNextGrcSequence(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      placeholder="1"
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 font-mono font-bold text-luxury-brown-950"
                    />
                    <span className="inline-block text-[10px] font-mono font-bold text-luxury-brown-700 bg-luxury-beige-50 border border-luxury-brown-200 px-2 py-0.5 rounded">
                      Preview: {formatGrcNumber((hotelGrcPrefix || 'GRC').replace(/[-/\s]+$/, '') || 'GRC', Math.max(1, Number(hotelNextGrcSequence) || 1))}
                    </span>
                  </div>
                </div>

                {/* Row E: Editable GRC Terms & Conditions (1–10) */}
                <div className="space-y-1.5 bg-white p-4 rounded-xl border border-luxury-brown-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-luxury-brown-900 block">
                        GRC Terms &amp; Conditions (1–10, one clause per line)
                      </label>
                      <span className="text-[10px] text-luxury-brown-500">
                        Printed automatically as numbered clauses 1..N on every Guest Registration Card (GRC).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHotelGrcTermsText(defaultGrcTerms().join('\n'))}
                      className="px-2.5 py-1 rounded-lg bg-luxury-beige-50 hover:bg-luxury-beige-100 text-luxury-brown-800 border border-luxury-brown-200 text-[10.5px] font-mono font-bold cursor-pointer"
                    >
                      Reset Default Terms (1–10)
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={hotelGrcTermsText}
                    onChange={(e) => setHotelGrcTermsText(e.target.value)}
                    placeholder="Enter GRC Terms & Conditions (one line per point)..."
                    className="w-full text-xs bg-white border border-luxury-brown-200 rounded-xl p-3 font-sans text-luxury-brown-950 leading-relaxed focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>

                <div className="pt-3 border-t border-[#C49A3A]/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-luxury-brown-600">
                      Click Save to apply GST %, Invoice Number, Water Rate &amp; GRC Terms across all modules immediately.
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {onUpdateHotelSettings && (
                        <button
                          type="button"
                          onClick={() => setIsConditionsModalOpen(true)}
                          className="inline-flex items-center gap-1.5 bg-[#B8862B] hover:bg-[#9A7020] text-white border border-[#8A6218] font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                        >
                          <FileCheck className="w-4 h-4" /> Invoice &amp; Checkout Conditions
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isSavingSettings}
                        onClick={() => saveHotelProfileSettings(false)}
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                      >
                        {isSavingSettings ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" /> Save GST, Invoice, Water &amp; GRC Settings
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {successMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}
                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-mono font-bold uppercase text-luxury-gold-600 tracking-wide pb-1.5 border-b border-luxury-brown-50">
                  3. Operational Localization
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Check-In Time</label>
                    <input
                      type="text"
                      value={hotelCheckInTime}
                      onChange={(e) => setHotelCheckInTime(e.target.value)}
                      placeholder="e.g. 12:00 PM"
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Check-Out Time</label>
                    <input
                      type="text"
                      value={hotelCheckOutTime}
                      onChange={(e) => setHotelCheckOutTime(e.target.value)}
                      placeholder="e.g. 11:00 AM"
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                    />
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Currency Code</label>
                    <input
                      type="text"
                      value={hotelCurrency}
                      onChange={(e) => setHotelCurrency(e.target.value)}
                      placeholder="e.g. INR, USD"
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-mono font-bold uppercase"
                    />
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Time Zone</label>
                    <select
                      value={hotelTimeZone}
                      onChange={(e) => setHotelTimeZone(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                      <option value="UTC">UTC (GMT+0:00)</option>
                      <option value="America/New_York">America/New_York (GMT-5:00)</option>
                      <option value="Europe/London">Europe/London (GMT+0:00)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GMT+4:00)</option>
                      <option value="Asia/Singapore">Asia/Singapore (GMT+8:00)</option>
                    </select>
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] font-semibold text-luxury-brown-700">Date Format</label>
                    <select
                      value={hotelDateFormat}
                      onChange={(e) => setHotelDateFormat(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 font-mono font-bold"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 28/10/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/28/2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-28)</option>
                    </select>
                  </div>

                  {/* Early Check-In Surcharge & Pricing Policy */}
                  <div className="col-span-2 md:col-span-5 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3 mt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-800">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-mono uppercase font-bold text-luxury-brown-900 block">
                            Early Check-In Surcharge & Pricing Policy (Standard: {hotelCheckInTime || '12:00 PM'})
                          </span>
                          <span className="text-[11px] text-luxury-brown-600">
                            Automatically adds surcharge when guest arrives before standard check-in time during Front Desk Check-In & Walk-In.
                          </span>
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-amber-300 text-xs font-bold text-luxury-brown-900 shadow-xs">
                        <input
                          type="checkbox"
                          checked={hotelEarlyCheckInEnabled}
                          onChange={(e) => setHotelEarlyCheckInEnabled(e.target.checked)}
                          className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                        />
                        <span>Enable Early Check-In Surcharge</span>
                      </label>
                    </div>

                    {hotelEarlyCheckInEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-luxury-brown-700">Surcharge Calculation Model</label>
                          <select
                            value={hotelEarlyCheckInType}
                            onChange={(e) => setHotelEarlyCheckInType(e.target.value as 'hourly' | 'fixed')}
                            className="w-full text-xs bg-white border border-amber-300 rounded-xl px-3 py-2.5 font-bold text-luxury-brown-950 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            <option value="hourly">Hourly Rate (₹ per Hour Early)</option>
                            <option value="fixed">Flat Fixed Rate (Fixed Surcharge)</option>
                          </select>
                        </div>

                        {hotelEarlyCheckInType === 'hourly' ? (
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-luxury-brown-700">Hourly Rate per Early Hour (₹)</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-amber-700 text-xs">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={hotelEarlyCheckInHourlyRate}
                                onChange={(e) => setHotelEarlyCheckInHourlyRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0"
                                className="w-full text-xs bg-white border border-amber-300 rounded-xl pl-8 pr-3 py-2.5 font-mono font-bold text-luxury-brown-950 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                              />
                            </div>
                            <p className="text-[10px] text-amber-800 font-mono">Example: 2 hrs early = 2 × ₹{hotelEarlyCheckInHourlyRate} = ₹{2 * hotelEarlyCheckInHourlyRate}</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-luxury-brown-700">Flat Fixed Rate (₹)</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-amber-700 text-xs">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={hotelEarlyCheckInFixedRate}
                                onChange={(e) => setHotelEarlyCheckInFixedRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0"
                                className="w-full text-xs bg-white border border-amber-300 rounded-xl pl-8 pr-3 py-2.5 font-mono font-bold text-luxury-brown-950 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                              />
                            </div>
                            <p className="text-[10px] text-amber-800 font-mono">Flat surcharge ₹{hotelEarlyCheckInFixedRate} added regardless of arrival hours.</p>
                          </div>
                        )}

                        <div className="bg-white/90 border border-amber-200 rounded-xl p-3 flex flex-col justify-center text-xs">
                          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Active Policy</span>
                          <span className="font-bold text-luxury-brown-950 text-sm mt-0.5">
                            {hotelEarlyCheckInType === 'hourly'
                              ? `₹${hotelEarlyCheckInHourlyRate} / early hour`
                              : `Flat ₹${hotelEarlyCheckInFixedRate} surcharge`}
                          </span>
                          <span className="text-[10px] text-luxury-brown-500 mt-0.5">Applied prior to standard {hotelCheckInTime || '12:00 PM'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Login Account Parameters */}
            <div className="pt-6 border-t border-luxury-brown-50 space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase text-luxury-gold-600 tracking-wide pb-1.5 border-b border-luxury-brown-50">
                4. Hotel Direct Login Username
              </h4>

              <div className="space-y-1.5 max-w-md">
                <label className="text-[11px] text-luxury-brown-700 font-semibold block">Primary Login Username *</label>
                <input
                  type="text"
                  required
                  value={hotelUsername}
                  onChange={(e) => setHotelUsername(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono font-bold"
                />
                <p className="text-[10px] text-luxury-brown-400 leading-normal mt-1">
                  You can use this custom identifier to log in directly into this hotel workspace.
                </p>
              </div>
            </div>

            {/* Password rotation section */}
            <div className="pt-6 border-t border-luxury-brown-50 space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase text-luxury-gold-600 tracking-wide flex items-center gap-1.5">
                <Key className="w-4 h-4 text-luxury-gold-500" /> Rotate Hotel Admin Passcode
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">Current Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Enter current passcode (only if changing)"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">New Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep existing passcode"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">Confirm New Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat new passcode"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodes(!showPasscodes)}
                  className="text-[10px] text-luxury-brown-500 hover:text-luxury-brown-800 font-mono underline focus:outline-none cursor-pointer"
                >
                  {showPasscodes ? 'Hide characters' : 'Show character keys'}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Save Profile & Passcode
                </button>
              </div>
            </div>
          </form>

          {/* SaaS Membership & Subscription Renewal Section for Hotel Admin */}
          {activeHotel && (
            <div className="p-6 border-t border-luxury-brown-100 bg-luxury-beige-50/40 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-luxury-gold-600" />
                    <span>SaaS Membership Renewal & Tax Invoices</span>
                  </h4>
                  <p className="text-xs text-luxury-brown-600">
                    Current Plan: <strong>{activeHotel.subscriptionPlan || 'Yearly'}</strong> • Valid Until:{' '}
                    <strong className="font-mono">{activeHotel.subscriptionEndDate || 'N/A'}</strong> • Status:{' '}
                    <strong className="text-emerald-700">{activeHotel.subscriptionStatus || 'Active'}</strong>
                  </p>
                </div>
                {activeHotel.renewalRequest?.status === 'Pending' && (
                  <span className="px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-[10px] font-bold flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    <span>Renewal Request Pending Super Admin Approval ({activeHotel.renewalRequest.requestedPackageName})</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleAdminSubmitRenewalRequest} className="bg-white border border-luxury-brown-100 rounded-2xl p-5 space-y-4 text-xs">
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
                      className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2 font-bold text-luxury-brown-950"
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
                      className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2"
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
                      className="w-full border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isSubmittingAdminRenewal}
                      className="w-full py-2 px-4 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl shadow-xs cursor-pointer"
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
          )}

          {/* Hotel Legal & Regulatory Documents / Compliance Section */}
          <div className="p-6 rounded-2xl bg-luxury-beige-50/60 border border-luxury-brown-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-luxury-brown-200/60 pb-3">
              <div>
                <h4 className="text-sm font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-luxury-gold-600" />
                  Property Regulatory &amp; Compliance Documents
                </h4>
                <p className="text-xs text-luxury-brown-500 mt-0.5">
                  Archived statutory licenses, GSTIN certificate, Police Sarai registration &amp; property documents.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
                ✓ Regulatory Compliant
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* GST Certificate */}
              <div className="p-3.5 rounded-xl bg-white border border-luxury-brown-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-luxury-brown-900 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-luxury-gold-600" />
                    GSTIN Registration Certificate
                  </span>
                  <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-800">
                  {hotelGst || '22AAAAA0000A1Z5'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Official 5% GST certificate registered under Central Goods &amp; Services Tax.
                </div>
              </div>

              {/* Police Sarai Act License */}
              <div className="p-3.5 rounded-xl bg-white border border-luxury-brown-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-luxury-brown-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Police Sarai Act Registration
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

              {/* Trade & Food License (FSSAI) */}
              <div className="p-3.5 rounded-xl bg-white border border-luxury-brown-200 space-y-2">
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

          <SubscriptionInvoiceModal
            invoice={viewingSubInvoice}
            onClose={() => setViewingSubInvoice(null)}
          />
        </div>
      )}

      {!isHotelAdminOrOwner && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-luxury-brown-900 to-luxury-brown-950 text-white p-6 border-b border-luxury-gold-500/10">
            <h3 className="font-serif font-bold text-md flex items-center gap-2">
              <User className="w-5 h-5 text-luxury-gold-400" /> Personal Staff Profile Desk
            </h3>
            <p className="text-luxury-brown-300 text-[11px] mt-1">
              Review your department metadata card, registered mobile number, and rotate your personal login credentials.
            </p>
          </div>

          <form onSubmit={handleStaffSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-600 tracking-wide block">
                  Staff Member Name
                </label>
                <input
                  type="text"
                  disabled
                  value={staffName}
                  className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 text-luxury-brown-400 cursor-not-allowed font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-600 tracking-wide block">
                  Staff Department & Role
                </label>
                <input
                  type="text"
                  disabled
                  value={`${currentRole} Department`}
                  className="w-full text-xs bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl px-4 py-2.5 text-luxury-brown-400 cursor-not-allowed font-medium uppercase font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-600 tracking-wide block">
                  Registered Contact Mobile *
                </label>
                <input
                  type="text"
                  required
                  value={staffMobile}
                  onChange={(e) => setStaffMobile(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-luxury-brown-600 tracking-wide block">
                  Staff Login ID / Username *
                </label>
                <input
                  type="text"
                  required
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                />
              </div>
            </div>

            {/* Password rotation section */}
            <div className="pt-6 border-t border-luxury-brown-50 space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase text-luxury-gold-600 tracking-wide flex items-center gap-1.5">
                <Key className="w-4 h-4 text-luxury-gold-500" /> Rotate Personal Passcode
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">Current Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Enter current passcode (only if changing)"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">New Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep existing passcode"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-luxury-brown-700 font-semibold block">Confirm New Passcode</label>
                  <input
                    type={showPasscodes ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat new passcode"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    className="w-full text-xs bg-white border border-luxury-brown-100 rounded-xl px-4 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodes(!showPasscodes)}
                  className="text-[10px] text-luxury-brown-500 hover:text-luxury-brown-800 font-mono underline focus:outline-none cursor-pointer"
                >
                  {showPasscodes ? 'Hide characters' : 'Show character keys'}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Update Passcode & Profile
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isConditionsModalOpen && (
        <InvoiceConditionsModal
          hotelSettings={hotelSettings}
          onUpdateHotelSettings={onUpdateHotelSettings}
          onAddAuditLog={onAddAuditLog}
          onClose={() => setIsConditionsModalOpen(false)}
        />
      )}
    </div>
  );
}
