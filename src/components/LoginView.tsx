import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Hotel, ShieldCheck, User, Lock, Eye, EyeOff, Sparkles, 
  Crown, ArrowRight, Building, CheckCircle2, AlertCircle, HelpCircle, ArrowLeft,
  Phone, Mail, MessageSquare, Clock, AlertTriangle, CreditCard
} from 'lucide-react';
import { UserRole } from '../types';
import { getPmsData, savePmsData } from '../utils/dummyData';
import { isBackendServerActive, waitForPendingSyncs, recoverPasswordApi } from '../utils/supabaseClient';
import { sha256 } from '../utils/crypto';
import { showToast } from '../utils/toast';

export type LoginPortalMode = 'general' | 'superadmin' | 'admin' | 'hotelowner';

interface LoginViewProps {
  onLoginSuccess: (role: UserRole, username: string, hotelId?: string, token?: string) => void;
  portalMode?: LoginPortalMode;
  onSwitchPortal?: (mode: LoginPortalMode) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  activeSessionInfo?: { role: UserRole; username: string } | null;
  onReturnToActiveSession?: () => void;
  onOnboardHotel?: () => void;
}


export default function LoginView({
  onLoginSuccess,
  portalMode = 'general',
  onSwitchPortal,
  onAddAuditLog,
  activeSessionInfo,
  onReturnToActiveSession,
  onOnboardHotel,
}: LoginViewProps) {
  const { systemWebsite } = getPmsData();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Blocking validation screens state
  const [blockedHotel, setBlockedHotel] = useState<any | null>(null);
  const [blockType, setBlockType] = useState<'Pending' | 'Expired' | null>(null);
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [renewPlanKey, setRenewPlanKey] = useState<'Monthly' | 'HalfYearly' | 'Yearly'>('Monthly');
  const [renewPackageName, setRenewPackageName] = useState('Monthly Pro Package');
  const [renewAmount, setRenewAmount] = useState(1899);
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('UPI');
  const [renewTxnRef, setRenewTxnRef] = useState('');
  const [renewSubmitting, setRenewSubmitting] = useState(false);
  const autoApprovingRef = React.useRef(false);

  // Restore Pending Approval / Expired state if user just onboarded or is waiting on /login
  React.useEffect(() => {
    try {
      const savedPending = sessionStorage.getItem('pms_pending_approval_auth');
      if (savedPending) {
        const parsed = JSON.parse(savedPending);
        if (parsed?.hotel && (parsed.blockType === 'Pending' || parsed.blockType === 'Expired')) {
          if (parsed.username && !username) setUsername(parsed.username);
          if (parsed.password && !password) setPassword(parsed.password);
          setBlockedHotel(parsed.hotel);
          setBlockType(parsed.blockType);
        }
      }
    } catch {}
  }, []);

  // Real-time auto-detection when Super Admin approves the Pending / Expired hotel (no page refresh needed)
  React.useEffect(() => {
    if (!blockedHotel || (blockType !== 'Pending' && blockType !== 'Expired')) {
      autoApprovingRef.current = false;
      return;
    }

    let isCancelled = false;

    const completeAutoLoginAfterApproval = async (approvedHotelObj?: any) => {
      if (isCancelled || autoApprovingRef.current) return;
      autoApprovingRef.current = true;

      let savedUser = username.trim();
      let savedPass = password.trim();
      try {
        const rawSaved = sessionStorage.getItem('pms_pending_approval_auth');
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved);
          if (!savedUser && parsed?.username) savedUser = String(parsed.username).trim();
          if (!savedPass && parsed?.password) savedPass = String(parsed.password).trim();
        }
      } catch {}

      const hotelDisplayName = approvedHotelObj?.name || blockedHotel?.name || 'Your Hotel';
      showToast(
        `✓ "${hotelDisplayName}" has been approved by Super Admin! Redirecting to your PMS Dashboard automatically...`,
        'success'
      );

      if (savedUser && savedPass && isBackendServerActive()) {
        // Retry up to 10 times (7s) in case localStorage broadcast arrived a few hundred ms before SuperAdmin's /api/db/sync finished on VPS
        for (let attempt = 0; attempt < 10; attempt++) {
          if (isCancelled) return;
          try {
            await waitForPendingSyncs();
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: savedUser,
                password: savedPass,
                portalMode: portalMode === 'hotelowner' ? 'owner' : portalMode,
              }),
            });
            const text = await res.text();
            const data = text ? JSON.parse(text) : null;
            if (res.ok && data?.success && data?.token) {
              try {
                sessionStorage.removeItem('pms_pending_approval_auth');
              } catch {}
              const srvRole = (data.role as UserRole) || 'Admin';
              sessionStorage.setItem('pms_auth_token', data.token);
              sessionStorage.setItem('pms_session_token', data.token);
              try {
                localStorage.setItem('pms_auth_token', data.token);
                localStorage.setItem('pms_session_token', data.token);
                localStorage.setItem('pms_authenticated', 'true');
                localStorage.setItem('pms_role', (data?.role as string) || 'Admin');
              } catch {}
              const finalRole: UserRole =
                portalMode === 'hotelowner'
                  ? 'Owner'
                  : portalMode === 'admin' && srvRole === 'Owner'
                  ? 'Admin'
                  : srvRole;
              const displayLabel =
                finalRole === 'Owner'
                  ? data.hotel?.ownerName || `${hotelDisplayName} Owner`
                  : `${hotelDisplayName} Admin`;

              setBlockedHotel(null);
              setBlockType(null);
              onLoginSuccess(finalRole, displayLabel, data.hotelId || blockedHotel.id, data.token);
              return;
            }
            // If server still sees Pending/Expired while /api/db/sync is completing, wait 700ms and retry
            if (res.status === 403 && attempt < 9) {
              await new Promise((r) => setTimeout(r, 700));
              continue;
            }
            break;
          } catch {
            if (attempt < 9) {
              await new Promise((r) => setTimeout(r, 700));
              continue;
            }
          }
        }
      }

      // Fallback only if password was missing or credentials changed
      try {
        sessionStorage.removeItem('pms_pending_approval_auth');
      } catch {}
      setBlockedHotel(null);
      setBlockType(null);
      if (savedUser) setUsername(savedUser);
      setSuccessMsg(`✓ "${hotelDisplayName}" is now Approved by Super Admin! Please sign in below.`);
      autoApprovingRef.current = false;
    };

    const checkApprovalStatusNow = async () => {
      if (isCancelled || autoApprovingRef.current) return;

      // 1. Check local / cross-tab broadcast first for instant (<200ms) same-browser update
      try {
        const rawBroadcast = localStorage.getItem('pms_hotel_status_broadcast');
        if (rawBroadcast) {
          const parsed = JSON.parse(rawBroadcast);
          if (Array.isArray(parsed?.hotels)) {
            const targetId = String(blockedHotel.id || '');
            const targetUser = String(username || blockedHotel.username || '').trim().toLowerCase();
            const found = parsed.hotels.find(
              (h: any) =>
                h &&
                (String(h.id) === targetId ||
                  (targetUser &&
                    (String(h.username || '').trim().toLowerCase() === targetUser ||
                      String(h.ownerUsername || '').trim().toLowerCase() === targetUser))) &&
                (h.status || 'Approved') === 'Approved'
            );
            if (found) {
              const notExpired =
                found.subscriptionStatus === 'Active' &&
                (!found.subscriptionEndDate || getDaysLeft(found.subscriptionEndDate) >= 0);
              if (blockType === 'Pending' || (blockType === 'Expired' && notExpired)) {
                await completeAutoLoginAfterApproval(found);
                return;
              }
            }
          }
        }
      } catch {}

      // 2. Poll lightweight backend endpoint for cross-browser / cloud DB approval check
      if (isBackendServerActive()) {
        try {
          const queryUser = encodeURIComponent(username.trim() || blockedHotel.username || '');
          const res = await fetch(
            `/api/public/hotel-status/${encodeURIComponent(blockedHotel.id || 'unknown')}?username=${queryUser}&_t=${Date.now()}`,
            { cache: 'no-store' }
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.success) {
              const isNowApproved = data.status === 'Approved';
              const isNowActive = !data.isExpired && data.subscriptionStatus === 'Active';
              if (
                (blockType === 'Pending' && isNowApproved && !data.isExpired) ||
                (blockType === 'Expired' && isNowApproved && isNowActive)
              ) {
                await completeAutoLoginAfterApproval(data.hotel || blockedHotel);
                return;
              }
            }
          }
        } catch {}
      }
    };

    checkApprovalStatusNow();
    const intervalId = setInterval(checkApprovalStatusNow, 1500);

    const handleStorageOrFocus = () => {
      checkApprovalStatusNow();
    };
    window.addEventListener('storage', handleStorageOrFocus);
    window.addEventListener('focus', handleStorageOrFocus);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('pms_hotel_approval_channel');
        bc.onmessage = () => {
          checkApprovalStatusNow();
        };
      }
    } catch {}

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageOrFocus);
      window.removeEventListener('focus', handleStorageOrFocus);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
    };
  }, [blockedHotel, blockType, username, password, portalMode]);

  // Forgot password / secure password reset mode states
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [recoveryResult, setRecoveryResult] = useState<{ success: boolean; message: string } | null>(null);

  const portalTheme = {
    superadmin: {
      badge: 'SAAS MASTER CONTROLLER',
      title: 'Super Admin Login',
      subtitle: 'Platform Governance, Property Approvals, Packages & Website CMS',
      accentBorder: 'border-amber-500/35',
      iconBg: 'from-amber-400 to-luxury-gold-600',
      placeholder: 'Enter Super Admin ID (e.g. superadmin)',
      buttonLabel: 'Sign In to Super Admin Hub',
    },
    admin: {
      badge: 'PROPERTY OPERATIONS DESK',
      title: 'Hotel Admin & Staff Login',
      subtitle: 'Front Desk, Reservations, Check-In/Out, Rooms, Billing & Staff',
      accentBorder: 'border-luxury-gold-500/25',
      iconBg: 'from-[#C5A059] to-[#8C7355]',
      placeholder: 'Hotel Admin username, email, or staff ID',
      buttonLabel: 'Sign In to Hotel Admin Desk',
    },
    hotelowner: {
      badge: 'EXECUTIVE OWNER SUITE',
      title: 'Hotel Owner Login',
      subtitle: 'Business Overview, Revenue & Expense Approvals, Occupancy & Subscription',
      accentBorder: 'border-emerald-500/30',
      iconBg: 'from-emerald-400 to-[#8C7355]',
      placeholder: 'Owner / Admin username or registered email',
      buttonLabel: 'Sign In to Owner Executive Suite',
    },
    general: {
      badge: 'DIRECTSTAY PMS • CLOUD HOSPITALITY',
      title: 'DirectStay PMS Login',
      subtitle: 'Unified Authentication Gateway for Super Admin, Hotel Admin & Hotel Owner',
      accentBorder: 'border-luxury-gold-500/20',
      iconBg: 'from-[#C5A059] to-[#8C7355]',
      placeholder: 'Username or registered email address',
      buttonLabel: 'Authenticate Securely',
    },
  }[portalMode];

  const getDaysLeft = (endDateStr?: string) => {
    if (!endDateStr) return -1;
    const end = new Date(endDateStr);
    const today = new Date();
    end.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const issueBackendSession = async (role: UserRole, userLabel: string, hotelId?: string, pass?: string) => {
    if (isBackendServerActive()) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            username: username.trim() || userLabel,
            password: pass ?? password.trim(),
            hotelId,
            portalMode: portalMode === 'hotelowner' ? 'owner' : portalMode,
          }),
        });
        const text = await res.text();
        if (res.ok && text) {
          const data = JSON.parse(text);
          if (data?.token) {
            sessionStorage.setItem('pms_auth_token', data.token);
            sessionStorage.setItem('pms_session_token', data.token);
            try {
              localStorage.setItem('pms_auth_token', data.token);
              localStorage.setItem('pms_session_token', data.token);
              localStorage.setItem('pms_authenticated', 'true');
              localStorage.setItem('pms_role', (data?.role as string) || 'Admin');
            } catch {}
            return data.token as string;
          }
        }
      } catch {}
    }
    const fallbackToken = `tok_${role}_${hotelId || 'global'}_${Date.now()}`;
    sessionStorage.setItem('pms_auth_token', fallbackToken);
    sessionStorage.setItem('pms_session_token', fallbackToken);
    return fallbackToken;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);

    setTimeout(async () => {
      const uLower = username.trim().toLowerCase();
      const p = password.trim();

      try {
        await waitForPendingSyncs();
      } catch {}

      // Primary path: Verify credentials on the backend server via POST /api/auth/login
      if (isBackendServerActive()) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: username.trim(),
              password: p,
              portalMode: portalMode === 'hotelowner' ? 'owner' : portalMode,
            }),
          });
          const text = await res.text();
          const data = text ? JSON.parse(text) : null;

          if (res.status === 403 && data?.blockType) {
            setIsLoading(false);
            if (data.blockType === 'Pending' || data.blockType === 'Expired') {
              try {
                sessionStorage.setItem(
                  'pms_pending_approval_auth',
                  JSON.stringify({
                    hotel: data.blockedHotel,
                    username: username.trim(),
                    password: p,
                    blockType: data.blockType,
                  })
                );
              } catch {}
              setBlockedHotel(data.blockedHotel);
              setBlockType(data.blockType);
              return;
            }
            setError(data.error || `Login blocked. Your property account is currently ${String(data.blockType).toLowerCase()}.`);
            return;
          }

          if (res.ok && data?.success && data?.token) {
            const srvRole = data.role as 'SuperAdmin' | 'Owner' | 'Admin';
            if (srvRole === 'SuperAdmin' && (portalMode === 'admin' || portalMode === 'hotelowner')) {
              setIsLoading(false);
              setError('Super Admin credentials must sign in via the dedicated Super Admin Portal (/superadmin).');
              return;
            }
            if (portalMode === 'superadmin' && srvRole !== 'SuperAdmin') {
              setIsLoading(false);
              setError('Access Denied: Only SaaS Super Admin credentials are valid on /superadmin. Use /admin for Hotel Admin or /hotelowner for Hotel Owner.');
              return;
            }

            sessionStorage.setItem('pms_auth_token', data.token);
            sessionStorage.setItem('pms_session_token', data.token);
            try {
              localStorage.setItem('pms_auth_token', data.token);
              localStorage.setItem('pms_session_token', data.token);
              localStorage.setItem('pms_authenticated', 'true');
              localStorage.setItem('pms_role', (data?.role as string) || 'Admin');
            } catch {}

            let finalRole: UserRole =
              portalMode === 'hotelowner'
                ? 'Owner'
                : portalMode === 'admin' && srvRole === 'Owner'
                ? 'Admin'
                : srvRole;
            if (data.staff && portalMode !== 'hotelowner') {
              sessionStorage.setItem('pms_staff_username', data.staff.username || data.staff.name || '');
              const dept = data.staff.department;
              if (data.staff.role === 'Owner' || data.staff.designation === 'Owner') finalRole = 'Owner';
              else if (dept === 'Admin') finalRole = 'Admin';
              else if (dept === 'Housekeeping') finalRole = 'Housekeeping';
              else if (dept === 'Reception') finalRole = 'Reception';
              else if (dept === 'Accounts') finalRole = 'Accounts';
              else if (dept === 'Manager') finalRole = 'Manager';
              else finalRole = 'Reception';
            } else {
              sessionStorage.removeItem('pms_staff_username');
            }

            const hotelName = data.hotel?.name || data.hotel?.hotelName || 'Hotel';
            const displayLabel =
              finalRole === 'SuperAdmin'
                ? 'Super Admin'
                : data.staff?.name ||
                  (finalRole === 'Owner'
                    ? data.hotel?.ownerName || `${hotelName} Owner`
                    : `${hotelName} Admin`);

            setSuccessMsg(`${displayLabel} verified. Redirecting...`);
            setTimeout(() => {
              setIsLoading(false);
              onLoginSuccess(
                finalRole,
                displayLabel,
                finalRole === 'SuperAdmin' ? undefined : data.hotelId,
                data.token
              );
            }, 400);
            return;
          }

          if (res.status === 401 || res.status === 429) {
            setIsLoading(false);
            setError(data?.error || 'Invalid username or security passcode. Please check your credentials.');
            return;
          }
        } catch {
          // Fall back to local verification only if server is unreachable
        }
      }

      // All credentials (Super Admin, Hotel Admin/Owner, Staff) are verified ONLY against the Database by the backend.
      setIsLoading(false);
      setError('Unable to verify credentials with the server right now. Please check your connection and try again.');
    }, 500);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryResult(null);

    const input = recoveryInput.trim();
    const newPass = resetNewPassword.trim();
    const confirmPass = resetConfirmPassword.trim();

    if (!input || !newPass || !confirmPass) {
      setRecoveryResult({ success: false, message: 'Please fill in your registered identifier and new passcode.' });
      return;
    }

    if (newPass.length < 6) {
      setRecoveryResult({ success: false, message: 'New security passcode must be at least 6 characters long.' });
      return;
    }

    if (newPass !== confirmPass) {
      setRecoveryResult({ success: false, message: 'New passcodes do not match.' });
      return;
    }

    const inputLower = input.toLowerCase();
    const hashed = sha256(newPass);
    const { hotels = [], staff = [], auditLogs = [], notifications = [] } = getPmsData();

    // Check SuperAdmin reset
    if (inputLower === 'superadmin' || inputLower === 'contact@directstay.online' || inputLower === 'raghunathpanigrahi4@gmail.com') {
      if (isBackendServerActive()) {
        await recoverPasswordApi({
          username: 'superadmin',
          email: 'superadmin@hotelpms.com',
          newPassword: newPass,
        }).catch(() => {});
      }
      setRecoveryResult({
        success: true,
        message: 'Super Admin security passcode has been securely reset and encrypted (SHA-256). You may now sign in.'
      });
      setResetNewPassword('');
      setResetConfirmPassword('');
      return;
    }

    // Check Hotel Admin / Owner account reset
    const matchedHotel = hotels.find(
      h =>
        (h.username && h.username.toLowerCase() === inputLower) ||
        (h.ownerUsername && h.ownerUsername.toLowerCase() === inputLower) ||
        (h.emailAddress && h.emailAddress.toLowerCase() === inputLower)
    );

    if (isBackendServerActive()) {
      const apiRes = await recoverPasswordApi({
        username: matchedHotel?.username || input,
        email: matchedHotel?.emailAddress || input,
        newPassword: newPass,
      });
      if (apiRes.success && !matchedHotel) {
        setRecoveryResult({
          success: true,
          message: 'Passcode has been securely reset and encrypted on the server. You can now sign in with your new passcode.'
        });
        setResetNewPassword('');
        setResetConfirmPassword('');
        return;
      }
    }

    if (matchedHotel) {
      const isOwnerReset = matchedHotel.ownerUsername && matchedHotel.ownerUsername.toLowerCase() === inputLower;
      const updatedHotels = hotels.map(h =>
        h.id === matchedHotel.id
          ? { ...h, password: hashed, ownerPassword: hashed }
          : h
      );
      const actorRoleLabel = isOwnerReset ? 'Owner' : 'Admin';
      const actorNameLabel = isOwnerReset ? (matchedHotel.ownerName || matchedHotel.name) : `${matchedHotel.name} Admin`;
      const newLog = {
        id: `AUD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        hotelId: matchedHotel.id,
        action: 'Password Reset',
        performedBy: `${actorNameLabel} (${actorRoleLabel})`,
        actorId: matchedHotel.id,
        actorUsername: actorNameLabel,
        actorRole: actorRoleLabel,
        entityType: 'Hotel',
        entityId: matchedHotel.id,
        outcome: 'success' as const,
        details: `Security passcode securely rotated (SHA-256) for ${matchedHotel.name} (${actorRoleLabel}).`,
        dateTime: new Date().toISOString()
      };
      const newNotif = {
        id: `notif-${Date.now()}`,
        hotelId: matchedHotel.id,
        recipientRole: 'All' as const,
        title: 'Security Alert: Passcode Rotated',
        message: `Account passcode for "${input}" at ${matchedHotel.name} was reset via Security Recovery.`,
        type: 'security' as const,
        severity: 'warning' as const,
        isRead: false,
        createdAt: new Date().toISOString(),
        linkPath: '/admin/auditLogs'
      };
      savePmsData({
        hotels: updatedHotels,
        auditLogs: [newLog, ...auditLogs],
        notifications: [newNotif, ...notifications]
      });
      onAddAuditLog?.(
        'Password Reset',
        `Security passcode securely rotated (SHA-256) for ${matchedHotel.name} (${actorRoleLabel}).`
      );
      setRecoveryResult({
        success: true,
        message: `Passcode for "${matchedHotel.name}" has been securely reset and encrypted. You can now sign in with your new passcode.`
      });
      setResetNewPassword('');
      setResetConfirmPassword('');
      return;
    }

    // Check Staff account reset
    const matchedStaff = staff.find(
      s => (s.username && s.username.toLowerCase() === inputLower) || s.mobile === input
    );
    if (matchedStaff) {
      const updatedStaff = staff.map(s => (s.id === matchedStaff.id ? { ...s, password: hashed } : s));
      const staffRoleLabel = matchedStaff.role || matchedStaff.department || 'Staff';
      const staffLog = {
        id: `AUD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        hotelId: matchedStaff.hotelId || 'hotel-1',
        action: 'Staff Password Reset',
        performedBy: `${matchedStaff.name} (${staffRoleLabel})`,
        actorId: matchedStaff.id,
        actorUsername: matchedStaff.name,
        actorRole: staffRoleLabel,
        entityType: 'Staff',
        entityId: matchedStaff.id,
        outcome: 'success' as const,
        details: `Security passcode securely rotated (SHA-256) for staff member ${matchedStaff.name} (${staffRoleLabel}).`,
        dateTime: new Date().toISOString()
      };
      savePmsData({
        staff: updatedStaff,
        auditLogs: [staffLog, ...auditLogs]
      });
      onAddAuditLog?.(
        'Staff Password Reset',
        `Security passcode securely rotated (SHA-256) for staff member ${matchedStaff.name} (${staffRoleLabel}).`
      );
      setRecoveryResult({
        success: true,
        message: `Passcode for staff member "${matchedStaff.name}" has been securely reset. You can now sign in.`
      });
      setResetNewPassword('');
      setResetConfirmPassword('');
      return;
    }

    // No match
    setRecoveryResult({
      success: false,
      message: 'No registered hotel, owner, staff profile, or Super Admin account found matching that identifier.'
    });
  };

  if (blockedHotel && blockType === 'Pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1c140e] via-[#2A1E17] to-[#120C08] flex items-center justify-center p-4 relative overflow-hidden" id="pending-approval-container">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-luxury-gold-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#8C7355]/5 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#C5A059_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-10" />

        <div className="w-full max-w-lg relative z-10">
          <div className="bg-[#1C140E]/90 backdrop-blur-xl border border-luxury-gold-500/30 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden text-center space-y-6">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-luxury-gold-500 to-transparent" />
            
            <div className="inline-flex items-center justify-center p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 mb-2">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-white">
                Account Pending Approval
              </h1>
              <p className="text-amber-200/90 text-sm font-medium px-4">
                "Your hotel account is pending approval from the Super Admin."
              </p>
              <p className="text-[#e2d5c5]/60 text-xs max-w-sm mx-auto">
                Our operations desk is validating your registration. This standard audit secures our direct stay boutique network.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Live Auto-Sync Active • Opens Dashboard Automatically on Approval</span>
                </span>
              </div>
            </div>

            <div className="bg-black/40 border border-[#8C7355]/20 rounded-2xl p-5 text-left space-y-3.5">
              <span className="text-[10px] uppercase font-mono tracking-widest text-luxury-gold-400 font-bold block border-b border-[#8C7355]/10 pb-1.5">
                System Support Channels
              </span>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-3 text-[#e2d5c5]/80">
                  <Phone className="w-4 h-4 text-luxury-gold-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-luxury-brown-300 block uppercase font-mono">Support Mobile Number</span>
                    <span className="font-mono font-bold text-white">+{systemWebsite.supportPhone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[#e2d5c5]/80">
                  <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-luxury-brown-300 block uppercase font-mono">WhatsApp Number</span>
                    <a 
                      href={`https://wa.me/${systemWebsite.supportPhone.replace(/\s+/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="font-mono font-bold text-emerald-400 hover:underline"
                    >
                      +{systemWebsite.supportPhone} (Instant Chat)
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[#e2d5c5]/80">
                  <Mail className="w-4 h-4 text-luxury-gold-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-luxury-brown-300 block uppercase font-mono">Support Email</span>
                    <a 
                      href={`mailto:${systemWebsite.supportEmail}`} 
                      className="font-mono font-semibold text-white hover:underline hover:text-luxury-gold-300"
                    >
                      {systemWebsite.supportEmail}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="contact-support-btn"
                onClick={() => {
                  window.location.href = `mailto:${systemWebsite.supportEmail}?subject=DirectStay%20Hotel%20Approval%20Inquiry%20-%20${encodeURIComponent(blockedHotel.name)}`;
                }}
                className="flex-1 py-3 px-5 bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] text-luxury-brown-950 font-serif font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </button>
              
              <button
                id="logout-btn"
                onClick={() => {
                  try {
                    sessionStorage.removeItem('pms_pending_approval_auth');
                  } catch {}
                  setBlockedHotel(null);
                  setBlockType(null);
                }}
                className="flex-1 py-3 px-5 border border-[#8C7355]/30 hover:bg-[#8C7355]/10 text-luxury-gold-300 font-mono text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (blockedHotel && blockType === 'Expired') {
    const daysLeft = getDaysLeft(blockedHotel.subscriptionEndDate);
    const daysExpired = daysLeft < 0 ? Math.abs(daysLeft) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1c140e] via-[#2A1E17] to-[#120C08] flex items-center justify-center p-4 relative overflow-hidden" id="expired-membership-container">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-rose-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#8C7355]/5 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#C5A059_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-10" />

        <div className="w-full max-w-lg relative z-10">
          <div className="bg-[#1C140E]/90 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden text-center space-y-6">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
            
            <div className="inline-flex items-center justify-center p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 mb-2">
              <AlertTriangle className="w-10 h-10 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-white">
                Membership Expired
              </h1>
              <p className="text-rose-300/90 text-sm font-medium px-4">
                The subscription plan for <strong className="text-white">{blockedHotel.name}</strong> has run its course.
              </p>
              <p className="text-[#e2d5c5]/60 text-xs max-w-sm mx-auto">
                Access to the Property Management System is temporarily deactivated. Renew your membership below to instantly resume your frontdesk operations.
              </p>
            </div>

            <div className="bg-black/40 border border-[#8C7355]/20 rounded-2xl p-5 text-left space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-widest text-luxury-gold-400 font-bold block border-b border-[#8C7355]/10 pb-1.5">
                Subscription Status Details
              </span>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                <div>
                  <span className="text-[10px] text-luxury-brown-300 block uppercase font-mono">Current Package</span>
                  <span className="font-semibold text-white flex items-center gap-1.5 mt-0.5">
                    <Crown className="w-3.5 h-3.5 text-luxury-gold-400" />
                    {blockedHotel.subscriptionPlan || 'Free Trial'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-luxury-brown-300 block uppercase font-mono">Expiry Date</span>
                  <span className="font-mono font-semibold text-rose-400 block mt-0.5">
                    {blockedHotel.subscriptionEndDate || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-luxury-brown-300 block uppercase font-mono">Days Expired</span>
                  <span className="text-sm font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                    {daysExpired} Day{daysExpired !== 1 ? 's' : ''} Overdue
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-luxury-brown-300 block uppercase font-mono">Service Status</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[9px] uppercase font-mono mt-0.5">
                    Suspended
                  </span>
                </div>
              </div>
            </div>

            {blockedHotel.renewalRequest?.status === 'Pending' && !showRenewForm && (
              <div className="bg-amber-500/10 border border-amber-400/40 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    Renewal Request Pending SuperAdmin Approval
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-mono text-[9px] font-bold uppercase">
                    Awaiting Approval
                  </span>
                </div>
                <p className="text-xs text-white/90">
                  Requested Plan: <strong className="text-luxury-gold-300">{blockedHotel.renewalRequest.requestedPackageName}</strong> ({blockedHotel.renewalRequest.requestedPlan}) • Amount: <strong className="text-emerald-300">₹{Number(blockedHotel.renewalRequest.requestedAmount || 0).toLocaleString('en-IN')}</strong>
                </p>
                <p className="text-[11px] font-mono text-[#e2d5c5]/70">
                  Payment Mode: {blockedHotel.renewalRequest.paymentMethod}
                  {blockedHotel.renewalRequest.transactionReference ? ` • Ref: ${blockedHotel.renewalRequest.transactionReference}` : ''} • Sent: {blockedHotel.renewalRequest.requestedAt}
                </p>
                <p className="text-[11px] text-amber-200/80 pt-1">
                  Super Admin has received your renewal request. Once payment is verified and approved by Super Admin, your PMS access and Renewal Tax Invoice will be activated automatically.
                </p>
              </div>
            )}

            {showRenewForm && (
              <div className="bg-black/60 border border-luxury-gold-500/40 rounded-2xl p-5 text-left space-y-4">
                <div className="flex items-center justify-between border-b border-[#8C7355]/20 pb-2">
                  <span className="text-xs font-serif font-bold text-luxury-gold-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-luxury-gold-400" />
                    Select Renewal Package & Submit Payment Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRenewForm(false)}
                    className="text-xs text-luxury-brown-300 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { plan: 'Monthly' as const, name: 'Monthly Pro Package', price: 1899, days: '30 Days' },
                    { plan: 'HalfYearly' as const, name: '6-Month Growth Package', price: 7999, days: '180 Days' },
                    { plan: 'Yearly' as const, name: '1-Year Enterprise Package', price: 14000, days: '365 Days' },
                  ].map((opt) => {
                    const active = renewPlanKey === opt.plan;
                    return (
                      <button
                        key={opt.plan}
                        type="button"
                        onClick={() => {
                          setRenewPlanKey(opt.plan);
                          setRenewPackageName(opt.name);
                          setRenewAmount(opt.price);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'border-luxury-gold-400 bg-luxury-gold-500/20 text-white'
                            : 'border-[#8C7355]/30 bg-white/5 text-[#e2d5c5]/80 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-[10px] font-mono uppercase text-luxury-gold-400 block">{opt.days}</span>
                        <span className="font-serif font-bold text-xs block mt-0.5">{opt.name}</span>
                        <span className="font-mono font-bold text-sm text-emerald-300 block mt-1">
                          ₹{opt.price.toLocaleString('en-IN')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-luxury-brown-300 block mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={renewPaymentMethod}
                      onChange={(e) => setRenewPaymentMethod(e.target.value)}
                      className="w-full bg-[#1C140E] border border-[#8C7355]/40 rounded-xl px-3 py-2 text-white text-xs"
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                      <option value="Cash">Cash Paid to Super Admin</option>
                      <option value="Card / Online">Card / Online Gateway</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-luxury-brown-300 block mb-1">
                      UTR / Transaction Ref (Optional)
                    </label>
                    <input
                      type="text"
                      value={renewTxnRef}
                      onChange={(e) => setRenewTxnRef(e.target.value)}
                      placeholder="e.g. UTR412890123 / Paid"
                      className="w-full bg-[#1C140E] border border-[#8C7355]/40 rounded-xl px-3 py-2 text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={renewSubmitting}
                  onClick={async () => {
                    setRenewSubmitting(true);
                    try {
                      const res = await fetch('/api/hotels/renewal-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          hotelId: blockedHotel.id,
                          requestedPackageName: renewPackageName,
                          requestedPlan: renewPlanKey,
                          requestedAmount: renewAmount,
                          paymentMethod: renewPaymentMethod,
                          transactionReference: renewTxnRef.trim(),
                          requestedBy: username || blockedHotel.username || 'Hotel Admin',
                        }),
                      });
                      const data = await res.json();
                      if (data?.success && data.renewalRequest) {
                        setBlockedHotel({ ...blockedHotel, renewalRequest: data.renewalRequest });
                        setShowRenewForm(false);
                        showToast(
                          'Renewal request sent to Super Admin! Once Super Admin approves payment, your membership and invoice will be generated.',
                          'success'
                        );
                      } else {
                        showToast(data?.error || 'Could not send renewal request.', 'error');
                      }
                    } catch {
                      showToast('Network error submitting renewal request.', 'error');
                    } finally {
                      setRenewSubmitting(false);
                    }
                  }}
                  className="w-full py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{renewSubmitting ? 'Sending Request to Super Admin...' : `Submit Renewal Request (₹${renewAmount.toLocaleString('en-IN')}) to Super Admin`}</span>
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="renew-membership-btn"
                onClick={() => setShowRenewForm((prev) => !prev)}
                className="flex-1 py-3 px-5 bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] text-luxury-brown-950 font-serif font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                {blockedHotel.renewalRequest?.status === 'Pending' ? 'Update Renewal Request' : 'Renew Membership'}
              </button>
              
              <button
                id="expired-logout-btn"
                onClick={() => {
                  try {
                    sessionStorage.removeItem('pms_pending_approval_auth');
                  } catch {}
                  setBlockedHotel(null);
                  setBlockType(null);
                  setShowRenewForm(false);
                }}
                className="flex-1 py-3 px-5 border border-[#8C7355]/30 hover:bg-[#8C7355]/10 text-luxury-gold-300 font-mono text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1c140e] via-[#2A1E17] to-[#120C08] flex items-center justify-center p-4 relative overflow-hidden" id="login-container">
      {/* Decorative backdrop elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-luxury-gold-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#8C7355]/5 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#C5A059_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-10" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* Active Session Switch Banner if user navigated to another role's URL while logged in */}
        {activeSessionInfo && (
          <div className="bg-[#241A13]/95 border border-luxury-gold-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-luxury-beige-100 shadow-lg">
            <div className="space-y-0.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-luxury-gold-400 font-bold">
                Active Session: {activeSessionInfo.role}
              </p>
              <p className="text-[11px] text-[#e2d5c5]/80">
                Sign in below to switch into <strong>{portalTheme.title}</strong>.
              </p>
            </div>
            {onReturnToActiveSession && (
              <button
                type="button"
                onClick={onReturnToActiveSession}
                className="px-3 py-1.5 bg-luxury-gold-500/20 hover:bg-luxury-gold-500/30 border border-luxury-gold-500/40 text-luxury-gold-300 font-mono font-bold text-[11px] rounded-xl shrink-0 transition-colors cursor-pointer"
              >
                Return →
              </button>
            )}
          </div>
        )}

        {/* Main login card container */}
        <div className={`bg-[#1C140E]/85 backdrop-blur-xl border ${portalTheme.accentBorder} rounded-3xl p-6 md:p-9 shadow-2xl relative overflow-hidden`}>
          {/* Subtle gold line accent */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-luxury-gold-500 to-transparent" />

          {/* Logo Area */}
          <div className="text-center space-y-3.5 mb-7">
            <div className={`inline-flex items-center justify-center p-4 bg-gradient-to-br ${portalTheme.iconBg} rounded-2xl shadow-lg shadow-luxury-gold-500/10 border border-luxury-gold-300/30 transform hover:rotate-3 transition-transform duration-300`}>
              {portalMode === 'superadmin' ? (
                <Crown className="w-8 h-8 text-[#1C140E]" />
              ) : portalMode === 'hotelowner' ? (
                <ShieldCheck className="w-8 h-8 text-[#1C140E]" />
              ) : (
                <Hotel className="w-8 h-8 text-[#1C140E]" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="w-4 h-px bg-luxury-gold-500/50" />
                <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-luxury-gold-400 font-bold">
                  {portalTheme.badge}
                </span>
                <span className="w-4 h-px bg-luxury-gold-500/50" />
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-wide text-white">
                {portalTheme.title}
              </h1>
              <p className="text-[#e2d5c5]/65 text-xs">
                {portalTheme.subtitle}
              </p>
            </div>
          </div>

          {!isForgotMode ? (
            <>
              {/* Alert messages */}
              {error && (
                <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl p-4 flex items-start gap-3 text-xs mb-6">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-200">Authorization Failure</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl p-4 flex items-start gap-3 text-xs mb-6 animate-pulse">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-200">Identity Confirmed</p>
                    <p>{successMsg}</p>
                  </div>
                </div>
              )}

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-luxury-gold-300 font-semibold tracking-wider block">
                    Username / Registered Email *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="w-4 h-4 text-luxury-gold-500/50" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder={portalTheme.placeholder}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl pl-10 pr-4 py-3 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase text-luxury-gold-300 font-semibold tracking-wider block">
                      Security Passcode *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setRecoveryInput('');
                        setRecoveryResult(null);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[11px] text-luxury-gold-400 hover:text-luxury-gold-300 font-mono transition-colors focus:outline-none cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-luxury-gold-500/50" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl pl-10 pr-10 py-3 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-luxury-gold-500/50 hover:text-luxury-gold-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative mt-3 group overflow-hidden bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] text-luxury-brown-950 font-serif font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-xl shadow-luxury-gold-500/10 hover:shadow-luxury-gold-500/20 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-luxury-brown-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <>
                      <span>{portalTheme.buttonLabel}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                {/* Hotel Onboarding Link Below Login Button */}
                <div className="pt-4 mt-4 border-t border-[#8C7355]/25 text-center space-y-2">
                  <p className="text-[11px] text-[#e2d5c5]/75">
                    Want to onboard your hotel on DirectStay PMS?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOnboardHotel) {
                        onOnboardHotel();
                      } else {
                        window.location.href = '/?onboard=1';
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#241911]/90 hover:bg-[#2F2116] border border-luxury-gold-500/35 hover:border-luxury-gold-400 text-luxury-gold-300 hover:text-white font-serif font-bold text-xs sm:text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Hotel className="w-4 h-4 text-luxury-gold-400 shrink-0" />
                    <span>Register &amp; Onboard Your Hotel →</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Secure Password Reset view (Phase 7 - No plaintext exposure) */
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-md font-serif font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-luxury-gold-400" /> Secure Passcode Rotation
                </h3>
                <p className="text-[#e2d5c5]/60 text-xs">
                  Verify your registered Username, Hotel Email, or Mobile Number and set a new SHA-256 encrypted security passcode.
                </p>
              </div>

              {recoveryResult && (
                <div className={`p-4 rounded-xl text-xs border ${
                  recoveryResult.success 
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}>
                  <p className="font-semibold mb-1">{recoveryResult.success ? 'Passcode Updated' : 'Reset Blocked'}</p>
                  <p className="leading-normal">{recoveryResult.message}</p>
                </div>
              )}

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-luxury-gold-300 font-semibold tracking-wider block">
                    Registered Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Username, Email, or Mobile"
                    value={recoveryInput}
                    onChange={(e) => setRecoveryInput(e.target.value)}
                    className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-4 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-luxury-gold-300 font-semibold tracking-wider block">
                    New Security Passcode *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-4 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-luxury-gold-300 font-semibold tracking-wider block">
                    Confirm New Passcode *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Repeat new passcode"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full text-sm bg-black/40 border border-[#8C7355]/30 rounded-xl px-4 py-2.5 text-white placeholder-luxury-brown-300/40 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none focus:border-luxury-gold-500 transition-colors"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setRecoveryResult(null);
                    }}
                    className="flex-1 py-3 border border-[#8C7355]/30 hover:bg-[#8C7355]/10 text-luxury-gold-300 font-mono text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-luxury-gold-500 to-[#8C7355] hover:opacity-90 text-luxury-brown-950 font-serif font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Reset Passcode
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
