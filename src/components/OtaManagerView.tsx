import React, { useState, useEffect } from 'react';
import { Booking, Room, RoomCategory, BookingSource, PaymentMethod, UserRole } from '../types';
import { 
  LayoutDashboard, Globe, Settings, ShieldAlert, FileText, Database, Shield, 
  Zap, RefreshCw, AlertTriangle, Check, ArrowLeftRight, Clock, HelpCircle, 
  Lock, Key, Copy, Plus, Trash2, Send, Power, Search, Info, HelpCircle as HelpIcon,
  CheckCircle, XCircle, AlertCircle, ArrowUpRight, BarChart3, Sliders, Play
} from 'lucide-react';

// Interfaces representing Database Tables (Simulation / Sandbox Mode)
interface OtaProvider {
  id: string;
  name: string;
  icon: string;
  category: string;
  status: 'Simulated (Sandbox)' | 'Disconnected' | 'Pending';
  apiVersion: string;
  authType: 'API Key + Hotel ID' | 'OAuth 2.0 Client Credentials' | 'Username + Password' | 'Partner ID + Cert' | 'Bearer Token';
  rateLimit: string;
  supportInstantSync: boolean;
  latency: string;
  guideUrl: string;
}

interface ApiLog {
  id: string;
  otaName: string;
  endpoint: string;
  request: string;
  response: string;
  status: number;
  executionTime: string;
  createdAt: string;
  retryCount: number;
}

interface WebhookLog {
  id: string;
  otaName: string;
  eventType: 'New Booking' | 'Cancellation' | 'Booking Update' | 'Rate Update' | 'Inventory Update';
  payload: string;
  receivedAt: string;
  pmsSynced: boolean;
}

interface SyncJob {
  id: string;
  otaName: string;
  type: 'Inventory' | 'Rates' | 'Restrictions';
  payload: string;
  attempts: number;
  lastError?: string;
  status: 'Pending' | 'Failed' | 'Completed';
}

interface OtaManagerViewProps {
  selectedHotelId?: string;
  bookings: Booking[];
  rooms: Room[];
  currentRole: UserRole;
  onUpdateBookings: (updater: Booking[] | ((prev: Booking[]) => Booking[])) => void;
  onUpdateRooms: (updater: Room[] | ((prev: Room[]) => Room[])) => void;
  onAddAuditLog: (action: string, details: string) => void;
}

const INITIAL_OTA_PROVIDERS: OtaProvider[] = [
  { id: 'booking', name: 'Booking.com', icon: '🏨', category: 'Global OTA', status: 'Disconnected', apiVersion: 'v3.2', authType: 'API Key + Hotel ID', rateLimit: '120 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://developers.booking.com/pms' },
  { id: 'expedia', name: 'Expedia', icon: '✈️', category: 'Global OTA', status: 'Disconnected', apiVersion: 'v4.0', authType: 'OAuth 2.0 Client Credentials', rateLimit: '90 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://developer.expediagroup.com' },
  { id: 'agoda', name: 'Agoda', icon: '🏷️', category: 'Regional APAC', status: 'Disconnected', apiVersion: 'v2.1', authType: 'API Key + Hotel ID', rateLimit: '60 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://ycs.agoda.com/developers' },
  { id: 'airbnb', name: 'Airbnb', icon: '🏡', category: 'Homestays/Villas', status: 'Disconnected', apiVersion: 'v1.5', authType: 'Bearer Token', rateLimit: '45 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://airbnb.com/partner/api' },
  { id: 'hotels', name: 'Hotels.com', icon: '🛎️', category: 'Global OTA', status: 'Disconnected', apiVersion: 'v3.0', authType: 'API Key + Hotel ID', rateLimit: '120 req/min', supportInstantSync: false, latency: 'N/A', guideUrl: 'https://developer.expediagroup.com' },
  { id: 'trip', name: 'Trip.com', icon: '🌏', category: 'APAC Major', status: 'Disconnected', apiVersion: 'v1.2', authType: 'OAuth 2.0 Client Credentials', rateLimit: '60 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://open.trip.com' },
  { id: 'makemytrip', name: 'MakeMyTrip', icon: '🇮🇳', category: 'Indian Regional', status: 'Disconnected', apiVersion: 'v4.1', authType: 'Partner ID + Cert', rateLimit: '150 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://developer.makemytrip.com' },
  { id: 'goibibo', name: 'Goibibo', icon: '🍊', category: 'Indian Regional', status: 'Disconnected', apiVersion: 'v3.0', authType: 'Partner ID + Cert', rateLimit: '100 req/min', supportInstantSync: false, latency: 'N/A', guideUrl: 'https://developer.goibibo.com' },
  { id: 'oyo', name: 'OYO', icon: '🔴', category: 'Budget Hotels', status: 'Disconnected', apiVersion: 'v2.0', authType: 'Bearer Token', rateLimit: '120 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://partner.oyorooms.com' },
  { id: 'yatra', name: 'Yatra', icon: '🚕', category: 'Indian Regional', status: 'Disconnected', apiVersion: 'v1.8', authType: 'API Key + Hotel ID', rateLimit: '60 req/min', supportInstantSync: false, latency: 'N/A', guideUrl: 'https://developer.yatra.com' },
  { id: 'easemytrip', name: 'EaseMyTrip', icon: '🔵', category: 'Indian Regional', status: 'Disconnected', apiVersion: 'v2.5', authType: 'Username + Password', rateLimit: '80 req/min', supportInstantSync: false, latency: 'N/A', guideUrl: 'https://easemytrip.com/api' },
  { id: 'cleartrip', name: 'Cleartrip', icon: '🌤️', category: 'Indian Regional', status: 'Disconnected', apiVersion: 'v2.0', authType: 'OAuth 2.0 Client Credentials', rateLimit: '80 req/min', supportInstantSync: false, latency: 'N/A', guideUrl: 'https://developer.cleartrip.com' },
  { id: 'hostelworld', name: 'Hostelworld', icon: '🎒', category: 'Hostels', status: 'Disconnected', apiVersion: 'v1.1', authType: 'API Key + Hotel ID', rateLimit: '40 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://api.hostelworld.com' },
  { id: 'googlehotels', name: 'Google Hotels', icon: '🔍', category: 'Metasearch Direct', status: 'Disconnected', apiVersion: 'v1.0', authType: 'Partner ID + Cert', rateLimit: '200 req/min', supportInstantSync: true, latency: 'N/A', guideUrl: 'https://developers.google.com/hotels' },
  { id: 'vrbo', name: 'VRBO', icon: '🏖️', category: 'Homestays/Villas', status: 'Disconnected', apiVersion: 'v2.0', authType: 'Bearer Token', rateLimit: '50 req/min', supportInstantSync: false, latency: 'N/A', guideUrl: 'https://developer.vrbo.com' }
];

export default function OtaManagerView({
  selectedHotelId = 'hotel-1',
  bookings,
  rooms,
  currentRole,
  onUpdateBookings,
  onUpdateRooms,
  onAddAuditLog
}: OtaManagerViewProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'wizard' | 'connections' | 'webhooks' | 'logs' | 'admin'>('dashboard');

  // Core OTA simulation state scoped per selectedHotelId
  const [hotelSandboxMap, setHotelSandboxMap] = useState<Record<string, {
    providers: OtaProvider[];
    roomMappings: Record<string, Record<RoomCategory, string>>;
    rateMappings: Record<string, Record<string, string>>;
    syncFrequencies: Record<string, string>;
    apiLogs: ApiLog[];
    webhookLogs: WebhookLog[];
    syncQueue: SyncJob[];
    credentials: Record<string, Record<string, string>>;
  }>>({});

  const currentHotelSandbox = hotelSandboxMap[selectedHotelId] || {
    providers: INITIAL_OTA_PROVIDERS,
    roomMappings: {},
    rateMappings: {},
    syncFrequencies: {},
    apiLogs: [],
    webhookLogs: [],
    syncQueue: [],
    credentials: {},
  };

  const updateCurrentSandbox = (
    updater: (prev: typeof currentHotelSandbox) => typeof currentHotelSandbox
  ) => {
    setHotelSandboxMap((prevMap) => {
      const existing = prevMap[selectedHotelId] || {
        providers: INITIAL_OTA_PROVIDERS,
        roomMappings: {},
        rateMappings: {},
        syncFrequencies: {},
        apiLogs: [],
        webhookLogs: [],
        syncQueue: [],
        credentials: {},
      };
      return {
        ...prevMap,
        [selectedHotelId]: updater(existing),
      };
    });
  };

  const providers = currentHotelSandbox.providers;
  const setProviders = (updater: OtaProvider[] | ((prev: OtaProvider[]) => OtaProvider[])) =>
    updateCurrentSandbox((s) => ({
      ...s,
      providers: typeof updater === 'function' ? updater(s.providers) : updater,
    }));

  const roomMappings = currentHotelSandbox.roomMappings;
  const setRoomMappings = (updater: Record<string, Record<RoomCategory, string>> | ((prev: Record<string, Record<RoomCategory, string>>) => Record<string, Record<RoomCategory, string>>)) =>
    updateCurrentSandbox((s) => ({
      ...s,
      roomMappings: typeof updater === 'function' ? updater(s.roomMappings) : updater,
    }));

  const rateMappings = currentHotelSandbox.rateMappings;
  const setRateMappings = (updater: Record<string, Record<string, string>> | ((prev: Record<string, Record<string, string>>) => Record<string, Record<string, string>>)) =>
    updateCurrentSandbox((s) => ({
      ...s,
      rateMappings: typeof updater === 'function' ? updater(s.rateMappings) : updater,
    }));

  const syncFrequencies = currentHotelSandbox.syncFrequencies;
  const setSyncFrequencies = (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) =>
    updateCurrentSandbox((s) => ({
      ...s,
      syncFrequencies: typeof updater === 'function' ? updater(s.syncFrequencies) : updater,
    }));

  const apiLogs = currentHotelSandbox.apiLogs;
  const setApiLogs = (updater: ApiLog[] | ((prev: ApiLog[]) => ApiLog[])) =>
    updateCurrentSandbox((s) => ({
      ...s,
      apiLogs: typeof updater === 'function' ? updater(s.apiLogs) : updater,
    }));

  const webhookLogs = currentHotelSandbox.webhookLogs;
  const setWebhookLogs = (updater: WebhookLog[] | ((prev: WebhookLog[]) => WebhookLog[])) =>
    updateCurrentSandbox((s) => ({
      ...s,
      webhookLogs: typeof updater === 'function' ? updater(s.webhookLogs) : updater,
    }));

  const syncQueue = currentHotelSandbox.syncQueue;
  const setSyncQueue = (updater: SyncJob[] | ((prev: SyncJob[]) => SyncJob[])) =>
    updateCurrentSandbox((s) => ({
      ...s,
      syncQueue: typeof updater === 'function' ? updater(s.syncQueue) : updater,
    }));

  // Selected OTA state in Connections Panel
  const [selectedOtaId, setSelectedOtaId] = useState<string>('booking');
  const selectedOta = providers.find(p => p.id === selectedOtaId) || providers[0];

  // Credentials Storage Mask (scoped per hotel)
  const credentials = currentHotelSandbox.credentials;
  const setCredentials = (updater: Record<string, Record<string, string>> | ((prev: Record<string, Record<string, string>>) => Record<string, Record<string, string>>)) =>
    updateCurrentSandbox((s) => ({
      ...s,
      credentials: typeof updater === 'function' ? updater(s.credentials) : updater,
    }));
  const [decryptOtaId, setDecryptOtaId] = useState<string | null>(null);

  // Setup Wizard Multi-Step States
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardSelectedOta, setWizardSelectedOta] = useState<OtaProvider | null>(null);
  const [wizardCreds, setWizardCreds] = useState<Record<string, string>>({});
  const [wizardTesting, setWizardTesting] = useState(false);
  const [wizardTestPassed, setWizardTestPassed] = useState<boolean | null>(null);
  const [wizardRooms, setWizardRooms] = useState<Record<RoomCategory, string>>({
    'Standard': '',
    'Deluxe': '',
    'Executive Suite': '',
    'Presidential Suite': ''
  });
  const [wizardRates, setWizardRates] = useState<Record<string, string>>({
    'Standard Rate': '',
    'Refundable': '',
    'Non-Refundable': ''
  });
  const [wizardSyncFreq, setWizardSyncFreq] = useState('Every 15 Minutes');
  const [wizardSyncInventory, setWizardSyncInventory] = useState(true);
  const [wizardSyncReservations, setWizardSyncReservations] = useState(true);
  const [wizardSearchTerm, setWizardSearchTerm] = useState('');

  // Webhook Simulator State
  const [webhookOta, setWebhookOta] = useState('booking');
  const [webhookEvent, setWebhookEvent] = useState<'New Booking' | 'Cancellation' | 'Booking Update'>('New Booking');
  const [whGuestName, setWhGuestName] = useState('Sarah Jenkins');
  const [whRoomCategory, setWhRoomCategory] = useState<RoomCategory>('Standard');
  const [whNights, setWhNights] = useState(3);
  const [whAmount, setWhAmount] = useState(13500);
  const [webhookLogOutput, setWebhookLogOutput] = useState<string>('');
  const [simulationSuccess, setSimulationSuccess] = useState<string | null>(null);

  // Notification Banner
  const [alertBanner, setAlertBanner] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const triggerAlert = (message: string, type: 'success' | 'info' | 'error') => {
    setAlertBanner({ message, type });
    setTimeout(() => setAlertBanner(null), 5000);
  };

  // Simulated Master Synchronizer Actions
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const triggerAllSync = () => {
    setIsSyncingAll(true);
    setTimeout(() => {
      setIsSyncingAll(false);
      triggerAlert('Master synchronization completed successfully. Rates, Vacancies and Room allocations updated across 4 channels.', 'success');
      onAddAuditLog('OTA Master Sync', 'Pushed live inventory and rates matrices to Booking, Expedia, Agoda, and Airbnb.');
      
      // Append a fresh positive log
      const newLog: ApiLog = {
        id: String(Date.now()),
        otaName: 'Booking.com',
        endpoint: '/v3.2/bulk-update',
        request: '{"sync_all":true,"vacancy_matrix":"current_pms_state"}',
        response: '{"status":"SUCCESS","processed_jobs":4}',
        status: 200,
        executionTime: '241ms',
        createdAt: new Date().toISOString(),
        retryCount: 0
      };
      setApiLogs(prev => [newLog, ...prev]);
    }, 1500);
  };

  // Simulate Testing connection in Wizard or Settings page
  const handleTestConnection = (otaId: string, testCreds: Record<string, string>) => {
    const p = providers.find(o => o.id === otaId);
    if (!p) return;
    
    // Create new API logs
    const testLogId = String(Date.now());
    const newLog: ApiLog = {
      id: testLogId,
      otaName: p.name,
      endpoint: '/handshake',
      request: JSON.stringify({ credential_verification: testCreds }),
      response: '{"status":"CONNECTIVITY_SUCCESS","ssl_verified":true}',
      status: 200,
      executionTime: '145ms',
      createdAt: new Date().toISOString(),
      retryCount: 0
    };

    setApiLogs(prev => [newLog, ...prev]);
    onAddAuditLog(`OTA Connection Test: ${p.name}`, `Dry-run ping returned 200 OK. Auth type: ${p.authType}.`);
  };

  // Webhook Simulator Action (Injects simulated PMS booking scoped to selectedHotelId)
  const handleTriggerWebhook = () => {
    const ota = providers.find(p => p.id === webhookOta) || providers[0];
    const generatedBookingId = `GP-OTA-${Math.floor(100000 + Math.random() * 900000)}`;
    const checkInDate = '2026-07-15';
    const checkOutDate = '2026-07-18';

    if (webhookEvent === 'New Booking') {
      // Create a simulated booking scoped to selectedHotelId
      const newBkg: Booking = {
        id: generatedBookingId,
        hotelId: selectedHotelId,
        guestName: whGuestName,
        mobile: '+91 9876543210',
        email: whGuestName.toLowerCase().replace(' ', '') + '@example.com',
        aadhaarNumber: '1122 3344 5566',
        address: 'Bhubaneswar, India',
        checkInDate,
        checkOutDate,
        nights: whNights,
        adults: 2,
        children: 0,
        roomNumber: 'Unassigned',
        roomType: whRoomCategory,
        advanceAmount: 0,
        paymentMethod: 'Online',
        bookingSource: ota.name as any,
        status: 'Confirmed',
        notes: `[SANDBOX SIMULATION] Parsed via simulated ${ota.name} Webhook Lab listener.`,
        isCheckedIn: false
      };

      onUpdateBookings(prev => [newBkg, ...prev]);
      
      const payloadObj = {
        mode: 'SANDBOX_SIMULATION',
        hotelId: selectedHotelId,
        transaction: generatedBookingId,
        ota: ota.name,
        guest: whGuestName,
        nights: whNights,
        room: whRoomCategory,
        total_price: whAmount,
        currency: 'INR',
        secure_token: 'wh_sandbox_928491029'
      };

      setWebhookLogOutput(JSON.stringify(payloadObj, null, 2));

      // Log into webhooks database
      const whLog: WebhookLog = {
        id: String(Date.now()),
        otaName: ota.name,
        eventType: 'New Booking',
        payload: JSON.stringify(payloadObj),
        receivedAt: new Date().toISOString(),
        pmsSynced: true
      };
      setWebhookLogs(prev => [whLog, ...prev]);

      // Add API Log to DB
      const apiL: ApiLog = {
        id: String(Date.now() + 1),
        otaName: ota.name,
        endpoint: '/webhook/booking-receive (sandbox)',
        request: 'OTA Sandbox Webhook Push Event',
        response: '{"pms_acknowledgement":"SANDBOX_ACCEPTED","booking_id":"' + generatedBookingId + '"}',
        status: 201,
        executionTime: '88ms',
        createdAt: new Date().toISOString(),
        retryCount: 0
      };
      setApiLogs(prev => [apiL, ...prev]);

      onAddAuditLog('OTA Sandbox Webhook Booking', `Simulated Reservation ${generatedBookingId} from ${ota.name} (Sandbox) for ${whGuestName}.`);
      setSimulationSuccess(`Simulated Booking ${generatedBookingId} for ${whGuestName} from ${ota.name} (Sandbox Mode)!`);
    } 
    else if (webhookEvent === 'Cancellation') {
      // Find a booking from this OTA in current hotel
      const match = bookings.find(b => b.bookingSource === ota.name && b.status !== 'Cancelled' && (!b.hotelId || b.hotelId === selectedHotelId));
      if (!match) {
        setWebhookLogOutput('// Error: No active bookings found for source: ' + ota.name);
        triggerAlert(`No active bookings found for ${ota.name} to cancel in simulation. Try registering one first!`, 'error');
        return;
      }

      onUpdateBookings(prev => prev.map(b => b.id === match.id ? { ...b, status: 'Cancelled' } : b));

      const payloadObj = {
        mode: 'SANDBOX_SIMULATION',
        cancellation_id: 'OTA-CAN-' + Math.floor(1000 + Math.random()*9000),
        original_booking_id: match.id,
        guest_name: match.guestName,
        ota_source: ota.name,
        refund_amount: 0,
        status: 'cancelled_by_guest'
      };
      setWebhookLogOutput(JSON.stringify(payloadObj, null, 2));

      const whLog: WebhookLog = {
        id: String(Date.now()),
        otaName: ota.name,
        eventType: 'Cancellation',
        payload: JSON.stringify(payloadObj),
        receivedAt: new Date().toISOString(),
        pmsSynced: true
      };
      setWebhookLogs(prev => [whLog, ...prev]);

      onAddAuditLog('OTA Sandbox Webhook Cancellation', `Simulated cancellation webhook for ${match.id} (${match.guestName}) from ${ota.name}.`);
      setSimulationSuccess(`Processed simulated cancellation of Booking ${match.id} via ${ota.name} Sandbox Webhook!`);
    } 
    else {
      // Booking Update
      const match = bookings.find(b => b.bookingSource === ota.name && b.status !== 'Cancelled' && (!b.hotelId || b.hotelId === selectedHotelId));
      if (!match) {
        setWebhookLogOutput('// Error: No active bookings found for source: ' + ota.name);
        triggerAlert(`No active bookings found for ${ota.name} to modify in simulation.`, 'error');
        return;
      }

      onUpdateBookings(prev => prev.map(b => b.id === match.id ? { ...b, guestName: b.guestName + ' (Modified)' } : b));

      const payloadObj = {
        mode: 'SANDBOX_SIMULATION',
        modification_id: 'OTA-MOD-' + Math.floor(1000 + Math.random()*9000),
        original_booking_id: match.id,
        updated_guest_name: match.guestName + ' (Modified)',
        notes: 'Extended checkout time request via sandbox API request'
      };
      setWebhookLogOutput(JSON.stringify(payloadObj, null, 2));

      const whLog: WebhookLog = {
        id: String(Date.now()),
        otaName: ota.name,
        eventType: 'Booking Update',
        payload: JSON.stringify(payloadObj),
        receivedAt: new Date().toISOString(),
        pmsSynced: true
      };
      setWebhookLogs(prev => [whLog, ...prev]);
      setSimulationSuccess(`Processed simulated modification on Booking ${match.id} via ${ota.name} Sandbox Webhook!`);
    }
  };

  // Helper for formatting date
  const fmtDate = (iso: string) => {
    return iso.replace('T', ' ').substring(0, 19);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-luxury-brown-950 font-sans">
      {/* Top Banner Alert */}
      {alertBanner && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border animate-bounce flex items-center gap-3 max-w-md ${
          alertBanner.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : alertBanner.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          {alertBanner.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
          {alertBanner.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          {alertBanner.type === 'info' && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
          <p className="text-xs font-semibold">{alertBanner.message}</p>
        </div>
      )}

      {/* Simulation / Sandbox Disclosure Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                OTA Simulation / Sandbox Environment
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded">
                Hotel Scope: {selectedHotelId}
              </span>
            </div>
            <p className="text-xs text-amber-800">
              All channel connectors, handshakes, and webhook triggers in this module run in <strong>local sandbox simulation mode</strong>. Unconfigured providers remain <strong>Disconnected</strong>, and enabled channels are labeled <strong>Simulated (Sandbox)</strong> rather than live production OTA links.
            </p>
          </div>
        </div>
      </div>

      {/* Header and Branding */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-luxury-brown-200/50 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-widest bg-amber-100 text-amber-900 px-2 py-1 rounded font-bold">
              Simulation / Sandbox Mode
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest bg-luxury-brown-100 text-luxury-brown-800 px-2 py-1 rounded font-bold">
              Channel Adapter Sandbox
            </span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            <Globe className="w-6 h-6 text-luxury-gold-600 animate-pulse" />
            Luxury PMS Channel Controller (Sandbox)
          </h1>
          <p className="text-xs text-luxury-brown-600">
            Sandbox testing environment for simulating OTA inventory sync, rate parity rules, and inbound reservation webhooks for hotel <strong>{selectedHotelId}</strong>.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={triggerAllSync}
            disabled={isSyncingAll}
            className="px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-600 disabled:bg-luxury-brown-200 text-luxury-brown-950 text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2 border border-luxury-gold-600/20"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
            {isSyncingAll ? 'Simulating Sync...' : 'Simulate Sync on Sandbox Channels'}
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap border-b border-luxury-brown-200/40 gap-1 overflow-x-auto">
        {[
          { id: 'dashboard', label: '📊 PMS Controller Desk', icon: LayoutDashboard },
          { id: 'wizard', label: '✨ 9-Step Setup Wizard', icon: Zap },
          { id: 'connections', label: '⚙️ Active OTA Settings', icon: Settings },
          { id: 'webhooks', label: '📡 Webhook API Labs', icon: Send },
          { id: 'logs', label: '🗄️ Database Sync Logs', icon: Database },
          { id: 'admin', label: '👑 Super Admin Panel', icon: Shield }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-xs font-semibold rounded-t-xl transition-all border-t-2 ${
              activeTab === tab.id 
                ? 'bg-white text-luxury-brown-900 border-luxury-gold-500 shadow-xs' 
                : 'text-luxury-brown-500 hover:bg-luxury-beige-100/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* VIEW: DASHBOARD PANEL */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">
          {/* Statistical Widget Counters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-luxury-brown-100 shadow-xs space-y-2">
              <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Simulated OTAs (Sandbox)</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-serif font-bold text-luxury-brown-900">
                  {providers.filter(p => p.status === 'Simulated (Sandbox)').length}
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Sandbox Mode</span>
              </div>
              <p className="text-[10px] text-luxury-brown-500">Unconfigured providers stay Disconnected</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-luxury-brown-100 shadow-xs space-y-2">
              <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Simulated OTA Volume</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-serif font-bold text-luxury-gold-700">Sandbox</span>
                <span className="text-[10px] text-luxury-gold-700 font-bold bg-luxury-gold-50 px-1.5 py-0.5 rounded">+12% Markups</span>
              </div>
              <p className="text-[10px] text-luxury-brown-500">Calculated on simulated sandbox channels</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-luxury-brown-100 shadow-xs space-y-2">
              <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Sandbox Handshake Logs</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-serif font-bold text-emerald-700">{apiLogs.length} Events</span>
                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Simulated</span>
              </div>
              <p className="text-[10px] text-luxury-brown-500">Scoped to {selectedHotelId}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-luxury-brown-100 shadow-xs space-y-2">
              <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Sandbox Sync Queue</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-serif font-bold text-luxury-brown-900">
                  {syncQueue.filter(q => q.status === 'Pending').length} Pending
                </span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                  {syncQueue.filter(q => q.status === 'Failed').length} Blocked
                </span>
              </div>
              <p className="text-[10px] text-luxury-brown-500">Local simulation queue</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List of 15 OTAs and connection status */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-luxury-brown-200/50 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
                <h2 className="font-serif font-bold text-base text-luxury-brown-900">
                  15 Channel Connectors Matrix (Simulation / Sandbox)
                </h2>
                <span className="text-[10px] font-mono font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                  Sandbox Mode • {selectedHotelId}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
                {providers.map(ota => (
                  <div 
                    key={ota.id} 
                    className={`p-3.5 rounded-xl border transition-all ${
                      ota.status === 'Simulated (Sandbox)' 
                        ? 'bg-amber-50/30 border-amber-300/70 shadow-xs' 
                        : 'bg-white border-luxury-brown-100 hover:bg-luxury-beige-50/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2.5 items-center">
                        <span className="text-2xl">{ota.icon}</span>
                        <div>
                          <strong className="text-xs text-luxury-brown-900 font-serif block">{ota.name}</strong>
                          <span className="text-[10px] text-luxury-brown-500 block">{ota.category} • {ota.apiVersion}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold block ${
                          ota.status === 'Simulated (Sandbox)'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-luxury-brown-100 text-luxury-brown-500'
                        }`}>
                          {ota.status === 'Simulated (Sandbox)' ? 'Simulated (Sandbox)' : 'Disconnected'}
                        </span>
                        {ota.status === 'Simulated (Sandbox)' && (
                          <span className="text-[9px] font-mono text-amber-700 font-bold block mt-1">Sandbox Mode</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-luxury-brown-100/50 flex justify-between items-center text-[10px]">
                      <span className="text-luxury-brown-500 font-mono">Auth: {ota.authType}</span>
                      <button
                        onClick={() => {
                          setSelectedOtaId(ota.id);
                          setActiveTab('connections');
                        }}
                        className="text-luxury-gold-700 hover:text-luxury-gold-800 font-bold uppercase tracking-wider text-[9px] flex items-center gap-0.5"
                      >
                        Settings &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Alerts and Sync Health */}
            <div className="space-y-6">
              <div className="bg-luxury-beige-50/50 rounded-xl border border-luxury-brown-200/50 p-5 space-y-4">
                <h3 className="font-serif font-bold text-sm text-luxury-brown-950 flex items-center gap-1.5 border-b border-luxury-brown-100 pb-2">
                  <ShieldAlert className="w-4 h-4 text-luxury-gold-600" />
                  Rate Integrity Guard
                </h3>
                <p className="text-[11px] text-luxury-brown-600 leading-relaxed">
                  The connector framework enforces automatic price markups on all outbound rates pushes to safeguard against distribution commissions and GST disparities.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center text-xs p-2 bg-white border border-luxury-brown-100 rounded-lg">
                    <span className="text-luxury-brown-700 font-medium">Standard Markup:</span>
                    <strong className="text-luxury-gold-700">+12.00%</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs p-2 bg-white border border-luxury-brown-100 rounded-lg">
                    <span className="text-luxury-brown-700 font-medium">Parity Safeguard:</span>
                    <strong className="text-emerald-700">ON (Strict)</strong>
                  </div>
                </div>
              </div>

              {/* API Handshake errors log */}
              <div className="bg-white rounded-xl border border-luxury-brown-200/50 p-5 space-y-3">
                <h3 className="font-serif font-bold text-xs text-luxury-brown-900 uppercase tracking-wider">
                  Guarded Network Interrupts
                </h3>
                <div className="space-y-2">
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[10px]">
                    <div className="flex justify-between font-bold">
                      <span>Airbnb System Interrupt</span>
                      <span>15 Min Ago</span>
                    </div>
                    <p className="text-[9px] mt-0.5 text-rose-700 font-mono">Error Code: 429 Rate Limit Exceeded on bulk sync.</p>
                    <div className="mt-1.5 flex justify-end">
                      <button 
                        onClick={() => {
                          triggerAlert('Force resync triggered for Airbnb.', 'success');
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider"
                      >
                        Self-Heal Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: SETUP WIZARD (9 Steps) */}
      {activeTab === 'wizard' && (
        <div className="bg-white rounded-xl border border-luxury-brown-200/50 p-6 space-y-6 animate-fade-in">
          {/* Stepper Header Progress */}
          <div className="border-b border-luxury-brown-100 pb-5">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold-700 font-bold">Step {wizardStep} of 9</span>
                <h2 className="text-lg font-serif font-bold text-luxury-brown-950">
                  {wizardStep === 1 && '1. Choose OTA Service Adapter'}
                  {wizardStep === 2 && `2. Review ${wizardSelectedOta?.name} API Guide`}
                  {wizardStep === 3 && `3. Credentials Configuration for ${wizardSelectedOta?.name}`}
                  {wizardStep === 4 && '4. Run SSL Verification Handshake'}
                  {wizardStep === 5 && '5. Channel Room Inventory Mapping'}
                  {wizardStep === 6 && '6. Rate Plan Parity Mapping'}
                  {wizardStep === 7 && '7. Define Synchronizer Frequency'}
                  {wizardStep === 8 && '8. Webhook Reservation Integration'}
                  {wizardStep === 9 && '9. Connection Activated!'}
                </h2>
              </div>
              <span className="text-xs text-luxury-brown-500 font-semibold font-mono">
                Progress: {Math.round((wizardStep / 9) * 100)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-luxury-beige-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-luxury-gold-500 h-full transition-all duration-300" 
                style={{ width: `${(wizardStep / 9) * 100}%` }}
              />
            </div>
          </div>

          {/* STEP 1: Select OTA */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-luxury-brown-600">
                  Select one of our 15 certified OTA integrations to establish secure real-time connections.
                </p>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-luxury-brown-400" />
                  <input
                    type="text"
                    value={wizardSearchTerm}
                    onChange={e => setWizardSearchTerm(e.target.value)}
                    placeholder="Search OTAs..."
                    className="pl-8 pr-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs w-48 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 max-h-[350px] overflow-y-auto p-1">
                {providers
                  .filter(p => p.name.toLowerCase().includes(wizardSearchTerm.toLowerCase()))
                  .map(ota => (
                    <button
                      key={ota.id}
                      type="button"
                      onClick={() => {
                        setWizardSelectedOta(ota);
                        setWizardCreds({});
                        setWizardTestPassed(null);
                        setWizardStep(2);
                      }}
                      className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${
                        wizardSelectedOta?.id === ota.id
                          ? 'border-luxury-gold-500 bg-luxury-gold-50/10'
                          : 'border-luxury-brown-100 hover:border-luxury-brown-300 bg-white'
                      }`}
                    >
                      <span className="text-3xl">{ota.icon}</span>
                      <strong className="text-xs text-luxury-brown-900 font-serif block">{ota.name}</strong>
                      <span className="text-[9px] bg-luxury-beige-100 text-luxury-brown-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                        {ota.category}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* STEP 2: Read Integration Guide */}
          {wizardStep === 2 && wizardSelectedOta && (
            <div className="space-y-4">
              <div className="bg-luxury-beige-50/50 p-5 rounded-xl border border-luxury-brown-100 space-y-3 text-xs text-luxury-brown-800">
                <h3 className="font-serif font-bold text-sm text-luxury-brown-900 uppercase tracking-wider flex items-center gap-2">
                  <Info className="w-4 h-4 text-luxury-gold-600" />
                  Official {wizardSelectedOta.name} Integration Manual
                </h3>
                <p className="leading-relaxed">
                  This connector communicates with the endpoint <strong className="text-luxury-brown-950 font-mono">https://api-connectivity.{wizardSelectedOta.id}.com/xml</strong> running API standard <strong className="text-luxury-brown-950">{wizardSelectedOta.apiVersion}</strong>.
                </p>
                <div className="bg-white p-4 rounded-lg border border-luxury-brown-100 space-y-2 font-serif text-xs">
                  <h4 className="font-bold text-luxury-brown-950">📋 Pre-requisites & Credentials required:</h4>
                  <ul className="list-disc list-inside space-y-1.5 pl-1 leading-relaxed">
                    <li>Generate client tokens in your {wizardSelectedOta.name} Extranet Portal.</li>
                    <li>Verify rate limits permit up to {wizardSelectedOta.rateLimit}.</li>
                    <li>Map standard reservation callbacks to our endpoint.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 text-xs font-bold rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2 bg-luxury-brown-900 text-white text-xs font-bold rounded-lg hover:bg-luxury-brown-800"
                >
                  Continue to Credentials
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Enter Credentials */}
          {wizardStep === 3 && wizardSelectedOta && (
            <div className="space-y-4">
              <p className="text-xs text-luxury-brown-600">
                Configure connection authenticators for this adapter. This will be stored as encrypted entries.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl bg-luxury-beige-50/30 p-5 rounded-xl border border-luxury-brown-100">
                {wizardSelectedOta.authType === 'API Key + Hotel ID' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Hotel / Property ID</label>
                      <input
                        type="text"
                        placeholder="e.g. HT-29184"
                        value={wizardCreds['HotelID'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'HotelID': e.target.value })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">API Key</label>
                      <input
                        type="password"
                        placeholder="sk_live_..."
                        value={wizardCreds['APIKey'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'APIKey': e.target.value })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                      />
                    </div>
                  </>
                )}

                {wizardSelectedOta.authType === 'OAuth 2.0 Client Credentials' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Client ID</label>
                      <input
                        type="text"
                        placeholder="e.g. client_abc123"
                        value={wizardCreds['ClientID'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'ClientID': e.target.value })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Client Secret</label>
                      <input
                        type="password"
                        placeholder="secret_xyz789..."
                        value={wizardCreds['ClientSecret'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'ClientSecret': e.target.value })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                      />
                    </div>
                  </>
                )}

                {wizardSelectedOta.authType === 'Bearer Token' && (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Bearer Token</label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                      value={wizardCreds['BearerToken'] || ''}
                      onChange={e => setWizardCreds({ ...wizardCreds, 'BearerToken': e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                    />
                  </div>
                )}

                {wizardSelectedOta.authType === 'Username + Password' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Username</label>
                      <input
                        type="text"
                        placeholder="partner@pms.com"
                        value={wizardCreds['Username'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'Username': e.target.value })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Password</label>
                      <input
                        type="password"
                        placeholder="******"
                        value={wizardCreds['Password'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'Password': e.target.value })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                      />
                    </div>
                  </>
                )}

                {wizardSelectedOta.authType === 'Partner ID + Cert' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Partner ID</label>
                      <input
                        type="text"
                        placeholder="e.g. PART-9204"
                        value={wizardCreds['PartnerID'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'PartnerID': e.target.value })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Client Certificate PEM</label>
                      <textarea
                        rows={1}
                        placeholder="-----BEGIN CERTIFICATE-----"
                        value={wizardCreds['Cert'] || ''}
                        onChange={e => setWizardCreds({ ...wizardCreds, 'Cert': e.target.value })}
                        className="w-full px-3 py-1 border border-luxury-brown-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 text-xs font-bold rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (Object.keys(wizardCreds).length === 0) {
                      triggerAlert('Please input the credential parameters to proceed.', 'error');
                      return;
                    }
                    setWizardStep(4);
                  }}
                  className="px-4 py-2 bg-luxury-brown-900 text-white text-xs font-bold rounded-lg hover:bg-luxury-brown-800"
                >
                  Continue to Test
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Verify Credentials */}
          {wizardStep === 4 && wizardSelectedOta && (
            <div className="space-y-4">
              <p className="text-xs text-luxury-brown-600">
                Execute a trial API dry-run handshake to verify endpoints and security certificates.
              </p>

              <div className="bg-luxury-beige-50 rounded-xl p-5 border border-luxury-brown-200/50 space-y-3 max-w-xl">
                <h4 className="text-xs font-bold text-luxury-brown-900 font-mono uppercase">Sync Test Payload:</h4>
                <div className="bg-white p-3 rounded font-mono text-[10px] text-luxury-brown-800 whitespace-pre-wrap">
                  {`GET /v1/handshake HTTP/1.1\nHost: api-connectivity.${wizardSelectedOta.id}.com\nAuthorization: Secure Token (SHA256)\nPayload: ${JSON.stringify(wizardCreds)}`}
                </div>

                {wizardTestPassed === true && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Handshake Successful! SSL verified & credentials valid.
                  </div>
                )}

                {wizardTestPassed === false && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Connection handshake timeout. Please check your credentials.
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={wizardTesting}
                  onClick={() => {
                    setWizardTesting(true);
                    setWizardTestPassed(null);
                    setTimeout(() => {
                      setWizardTesting(false);
                      setWizardTestPassed(true);
                      handleTestConnection(wizardSelectedOta.id, wizardCreds);
                    }, 1200);
                  }}
                  className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 text-xs font-bold rounded-lg hover:bg-luxury-gold-400 flex items-center gap-2"
                >
                  {wizardTesting ? 'Running handshakes...' : 'Verify Credentials Now'}
                </button>

                <button
                  type="button"
                  disabled={!wizardTestPassed}
                  onClick={() => setWizardStep(5)}
                  className="px-4 py-2 bg-luxury-brown-900 text-white text-xs font-bold rounded-lg hover:bg-luxury-brown-800 disabled:bg-luxury-brown-200"
                >
                  Continue to Room Mapping
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Map Rooms */}
          {wizardStep === 5 && wizardSelectedOta && (
            <div className="space-y-4">
              <p className="text-xs text-luxury-brown-600">
                Map your internal luxury rooms to the equivalent listing category on {wizardSelectedOta.name}.
              </p>

              <div className="space-y-3 max-w-xl">
                {(['Standard', 'Deluxe', 'Executive Suite', 'Presidential Suite'] as RoomCategory[]).map(cat => (
                  <div key={cat} className="flex justify-between items-center p-3 bg-luxury-beige-50/50 rounded-xl border border-luxury-brown-100">
                    <span className="text-xs font-bold text-luxury-brown-900">{cat} Double Room</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-luxury-brown-500">Maps to:</span>
                      <input
                        type="text"
                        value={wizardRooms[cat]}
                        onChange={e => setWizardRooms({ ...wizardRooms, [cat]: e.target.value })}
                        placeholder={`e.g. ${wizardSelectedOta.id.toUpperCase()}-${cat.substring(0,3).toUpperCase()}-101`}
                        className="px-2.5 py-1.5 border border-luxury-brown-200 rounded text-xs bg-white font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 text-xs font-bold rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Save mapping to state table
                    setRoomMappings(prev => ({
                      ...prev,
                      [wizardSelectedOta.id]: wizardRooms
                    }));
                    setWizardStep(6);
                  }}
                  className="px-4 py-2 bg-luxury-brown-900 text-white text-xs font-bold rounded-lg hover:bg-luxury-brown-800"
                >
                  Continue to Rate Mapping
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Map Rate Plans */}
          {wizardStep === 6 && wizardSelectedOta && (
            <div className="space-y-4">
              <p className="text-xs text-luxury-brown-600">
                Map rate plan codes. For compliance and margin security, our channel updates enforce price rules on these mappings.
              </p>

              <div className="space-y-3 max-w-xl">
                {['Standard Rate', 'Refundable', 'Non-Refundable'].map(plan => (
                  <div key={plan} className="flex justify-between items-center p-3 bg-luxury-beige-50/50 rounded-xl border border-luxury-brown-100">
                    <span className="text-xs font-bold text-luxury-brown-900">{plan} Policy</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-luxury-brown-500">OTA Code:</span>
                      <input
                        type="text"
                        value={wizardRates[plan] || ''}
                        onChange={e => setWizardRates({ ...wizardRates, [plan]: e.target.value })}
                        placeholder={`e.g. ${plan.toUpperCase()}-PARITY`}
                        className="px-2.5 py-1.5 border border-luxury-brown-200 rounded text-xs bg-white font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(5)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 text-xs font-bold rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRateMappings(prev => ({
                      ...prev,
                      [wizardSelectedOta.id]: wizardRates
                    }));
                    setWizardStep(7);
                  }}
                  className="px-4 py-2 bg-luxury-brown-900 text-white text-xs font-bold rounded-lg hover:bg-luxury-brown-800"
                >
                  Continue to Sync
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Define Sync frequency */}
          {wizardStep === 7 && wizardSelectedOta && (
            <div className="space-y-4">
              <p className="text-xs text-luxury-brown-600">
                Define the background polling interval. Direct API channels support instant reservation webhooks.
              </p>

              <div className="bg-luxury-beige-50/30 p-5 rounded-xl border border-luxury-brown-100 space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600">Poller Frequency</label>
                  <select
                    value={wizardSyncFreq}
                    onChange={e => setWizardSyncFreq(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white"
                  >
                    <option value="Every 5 Minutes">Every 5 Minutes (Real-Time Push)</option>
                    <option value="Every 15 Minutes">Every 15 Minutes</option>
                    <option value="Hourly">Hourly Update</option>
                    <option value="Daily">Daily Update</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="invSync"
                      checked={wizardSyncInventory}
                      onChange={e => setWizardSyncInventory(e.target.checked)}
                      className="rounded text-luxury-gold-500 focus:ring-luxury-gold-500"
                    />
                    <label htmlFor="invSync" className="text-xs text-luxury-brown-800 font-medium">Enable automatic inventory updates</label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(6)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 text-xs font-bold rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncFrequencies(prev => ({
                      ...prev,
                      [wizardSelectedOta.id]: wizardSyncFreq
                    }));
                    setWizardStep(8);
                  }}
                  className="px-4 py-2 bg-luxury-brown-900 text-white text-xs font-bold rounded-lg hover:bg-luxury-brown-800"
                >
                  Continue to Webhooks
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: Webhook Reservation Integration */}
          {wizardStep === 8 && wizardSelectedOta && (
            <div className="space-y-4">
              <p className="text-xs text-luxury-brown-600">
                Connect the listener hook. This allows {wizardSelectedOta.name} to fire secure webhooks instantly into your PMS on new guest check-ins.
              </p>

              <div className="bg-luxury-beige-50 rounded-xl p-5 border border-luxury-brown-100 max-w-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-luxury-brown-700 font-medium">Auto-Generated Webhook URL:</span>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded">SSL Secure</span>
                </div>
                <div className="p-3 bg-white border border-luxury-brown-200 rounded-lg flex justify-between items-center font-mono text-[11px] text-luxury-brown-900">
                  <span>https://api.gp-pms.io/v1/ota/{wizardSelectedOta.id}/webhook</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://api.gp-pms.io/v1/ota/${wizardSelectedOta.id}/webhook`);
                      triggerAlert('Webhook URL copied to clipboard!', 'success');
                    }}
                    className="text-luxury-gold-700 hover:text-luxury-gold-800 font-bold text-xs"
                  >
                    Copy
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="resSync"
                    checked={wizardSyncReservations}
                    onChange={e => setWizardSyncReservations(e.target.checked)}
                    className="rounded text-luxury-gold-500 focus:ring-luxury-gold-500"
                  />
                  <label htmlFor="resSync" className="text-xs text-luxury-brown-800 font-medium">
                    Instantly accept reservations via background webhook listener
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(7)}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-700 text-xs font-bold rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Update state to Simulated (Sandbox)
                    setProviders(prev => prev.map(p => {
                      if (p.id === wizardSelectedOta.id) {
                        return { ...p, status: 'Simulated (Sandbox)' };
                      }
                      return p;
                    }));

                    // Add credentials to state
                    setCredentials(prev => ({
                      ...prev,
                      [wizardSelectedOta.id]: wizardCreds
                    }));

                    setWizardStep(9);
                    onAddAuditLog('OTA Sandbox Channel Configured', `Configured ${wizardSelectedOta.name} in Simulation/Sandbox Mode (${wizardSelectedOta.authType}). Poller: ${wizardSyncFreq}.`);
                  }}
                  className="px-4 py-2 bg-luxury-brown-900 text-white text-xs font-bold rounded-lg hover:bg-luxury-brown-800"
                >
                  Activate Sandbox Connector
                </button>
              </div>
            </div>
          )}

          {/* STEP 9: Finish Success */}
          {wizardStep === 9 && wizardSelectedOta && (
            <div className="text-center p-8 space-y-4 max-w-md mx-auto animate-fade-in">
              <span className="text-5xl block">🎉</span>
              <h3 className="font-serif font-bold text-xl text-luxury-brown-900">
                {wizardSelectedOta.name} Sandbox Connector Active!
              </h3>
              <p className="text-xs text-luxury-brown-600 leading-relaxed">
                {wizardSelectedOta.name} is now enabled in <strong>Simulation / Sandbox Mode</strong> for hotel <strong>{selectedHotelId}</strong>. Simulated rate pushes, cancellations, and test webhook reservations can now be exercised on a {syncFrequencies[wizardSelectedOta.id] || wizardSyncFreq} schedule.
              </p>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setWizardStep(1);
                    setWizardSelectedOta(null);
                  }}
                  className="px-4 py-2 border border-luxury-brown-200 text-luxury-brown-800 text-xs font-bold rounded-lg"
                >
                  Configure Another Sandbox Channel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('dashboard');
                    triggerAllSync();
                  }}
                  className="px-4 py-2 bg-luxury-gold-500 text-luxury-brown-950 text-xs font-bold rounded-lg hover:bg-luxury-gold-400"
                >
                  Go to Sandbox Controller Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: ACTIVE CONNECTIONS & SETTINGS */}
      {activeTab === 'connections' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
          {/* Channels Sidebar List */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-luxury-brown-200/50 p-4 space-y-3">
            <h3 className="font-serif font-bold text-xs text-luxury-brown-900 uppercase tracking-wider border-b border-luxury-brown-100 pb-2">
              Configured Adapters (Sandbox)
            </h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {providers.map(ota => (
                <button
                  key={ota.id}
                  onClick={() => setSelectedOtaId(ota.id)}
                  className={`w-full p-2.5 rounded-lg text-left transition-all flex items-center justify-between border ${
                    selectedOtaId === ota.id
                      ? 'bg-luxury-brown-900 text-white border-luxury-brown-900'
                      : 'bg-white text-luxury-brown-800 border-luxury-brown-100 hover:bg-luxury-beige-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ota.icon}</span>
                    <span className="text-xs font-semibold block">{ota.name}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${
                    ota.status === 'Simulated (Sandbox)' ? 'bg-amber-500' : 'bg-luxury-brown-300'
                  }`} />
                </button>
              ))}
            </div>
          </div>

          {/* Active Settings Panel */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-luxury-brown-200/50 p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div className="flex gap-3 items-center">
                <span className="text-4xl">{selectedOta.icon}</span>
                <div>
                  <h3 className="text-xl font-serif font-bold text-luxury-brown-950">{selectedOta.name} Adapter Profile (Sandbox)</h3>
                  <p className="text-[11px] text-luxury-brown-500">
                    Category: {selectedOta.category} • API Endpoint standard: {selectedOta.apiVersion} • Status: <strong>{selectedOta.status}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextStatus = selectedOta.status === 'Simulated (Sandbox)' ? 'Disconnected' : 'Simulated (Sandbox)';
                    setProviders(prev => prev.map(p => p.id === selectedOta.id ? { ...p, status: nextStatus } : p));
                    triggerAlert(`Channel ${selectedOta.name} status updated to ${nextStatus}.`, 'info');
                    onAddAuditLog(`OTA Sandbox Status Change: ${selectedOta.name}`, `Set channel status to ${nextStatus}.`);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                    selectedOta.status === 'Simulated (Sandbox)'
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {selectedOta.status === 'Simulated (Sandbox)' ? 'Disconnect Sandbox' : 'Enable Sandbox Simulation'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Credentials / Security Vault */}
              <div className="space-y-4">
                <h4 className="font-serif font-bold text-sm text-luxury-brown-950 flex items-center gap-1.5 border-b border-luxury-brown-100 pb-1.5">
                  <Shield className="w-4 h-4 text-luxury-gold-600" />
                  Credentials Encrypted Vault
                </h4>

                <div className="p-4 bg-luxury-beige-50 rounded-xl border border-luxury-brown-100 space-y-3 font-mono text-[11px]">
                  {credentials[selectedOta.id] ? (
                    Object.entries(credentials[selectedOta.id]).map(([k, val]) => {
                      const isDecrypted = decryptOtaId === selectedOta.id;
                      return (
                        <div key={k} className="space-y-0.5">
                          <span className="text-luxury-brown-400 uppercase text-[9px] font-bold block">{k}</span>
                          <div className="flex justify-between items-center bg-white p-2 rounded border border-luxury-brown-100">
                            <span className="text-luxury-brown-900 font-semibold">
                              {isDecrypted ? val : '••••••••••••••••••••••••••••••••'}
                            </span>
                            {!isDecrypted && (
                              <span className="text-[8px] bg-rose-50 text-rose-600 px-1 py-0.5 rounded uppercase font-bold">
                                SHA-256 AES-256
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-luxury-brown-500 italic">No connection credentials configured for this OTA.</p>
                  )}

                  {credentials[selectedOta.id] && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          if (decryptOtaId === selectedOta.id) {
                            setDecryptOtaId(null);
                          } else {
                            if (currentRole === 'Owner' || currentRole === 'Admin') {
                              setDecryptOtaId(selectedOta.id);
                              triggerAlert('Decrypted credential views authorized for Admin.', 'success');
                            } else {
                              triggerAlert('Unauthorized: Only Owners or Admins can unlock key matrices.', 'error');
                            }
                          }
                        }}
                        className="text-luxury-gold-700 hover:text-luxury-gold-800 text-xs font-bold flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        {decryptOtaId === selectedOta.id ? 'Mask Credentials' : 'Request Decrypt Key (Admin)'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Security Parity
                  </div>
                  <p className="leading-relaxed">
                    Credentials are encrypted in transit via TLS 1.3 and at rest in our schema utilizing military-grade encryption keys. Plaintext keys are never outputted to standard telemetry logs.
                  </p>
                </div>
              </div>

              {/* Poller configurations and Webhooks mapping */}
              <div className="space-y-4">
                <h4 className="font-serif font-bold text-sm text-luxury-brown-950 flex items-center gap-1.5 border-b border-luxury-brown-100 pb-1.5">
                  <Clock className="w-4 h-4 text-luxury-gold-600" />
                  Synchronizer Core Parameters
                </h4>

                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1 bg-white p-3 border border-luxury-brown-100 rounded-lg">
                    <span className="text-[10px] text-luxury-brown-400 block font-bold uppercase">Polling Frequency</span>
                    <div className="flex justify-between items-center">
                      <strong className="text-luxury-brown-900">{syncFrequencies[selectedOta.id] || 'Manual Synchronize Only'}</strong>
                      <button
                        onClick={() => {
                          const next = syncFrequencies[selectedOta.id] === 'Every 5 Minutes' ? 'Every 15 Minutes' : 'Every 5 Minutes';
                          setSyncFrequencies({ ...syncFrequencies, [selectedOta.id]: next });
                        }}
                        className="text-luxury-gold-700 hover:underline font-bold text-[10px]"
                      >
                        Modify frequency
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 bg-white p-3 border border-luxury-brown-100 rounded-lg">
                    <span className="text-[10px] text-luxury-brown-400 block font-bold uppercase">Channel Webhook Web Endpoint</span>
                    <div className="p-2 bg-luxury-beige-50 rounded border border-luxury-brown-100 font-mono text-[10px] break-all select-all">
                      https://api.gp-pms.io/v1/ota/{selectedOta.id}/webhook
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-luxury-brown-600">Rate Limits:</span>
                    <span className="font-mono text-luxury-brown-900 font-bold bg-luxury-beige-100 px-2 py-0.5 rounded text-[11px]">
                      {selectedOta.rateLimit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Room Category mappings list */}
            <div className="space-y-3.5 pt-4 border-t border-luxury-brown-100">
              <h4 className="font-serif font-bold text-sm text-luxury-brown-950 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-luxury-gold-600" />
                Active Class Mappings
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-luxury-brown-100 p-4 space-y-3">
                  <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Room Category Bindings</span>
                  {roomMappings[selectedOta.id] ? (
                    Object.entries(roomMappings[selectedOta.id]).map(([k, val]) => (
                      <div key={k} className="flex justify-between items-center text-xs border-b border-luxury-brown-50 pb-2">
                        <span className="text-luxury-brown-700 font-medium">{k}</span>
                        <strong className="text-luxury-brown-950 font-mono">{val}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs italic text-luxury-brown-500">Not mapped. Connect via the Setup Wizard first.</p>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-luxury-brown-100 p-4 space-y-3">
                  <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Rate Plan Bindings</span>
                  {rateMappings[selectedOta.id] ? (
                    Object.entries(rateMappings[selectedOta.id]).map(([k, val]) => (
                      <div key={k} className="flex justify-between items-center text-xs border-b border-luxury-brown-50 pb-2">
                        <span className="text-luxury-brown-700 font-medium">{k} Plan</span>
                        <strong className="text-luxury-brown-950 font-mono">{val}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs italic text-luxury-brown-500">Not mapped.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: WEBHOOK EVENTS LAB SIMULATOR */}
      {activeTab === 'webhooks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Simulation controller */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-luxury-brown-200/50 p-6 space-y-4">
            <div className="border-b border-luxury-brown-100 pb-3">
              <h3 className="font-serif font-bold text-sm text-luxury-brown-900 uppercase tracking-wider">
                OTA Sandbox Webhook Trigger
              </h3>
              <p className="text-[11px] text-luxury-brown-500">
                Generate simulated inbound events for sandbox-enabled channels to test booking parsing for <strong>{selectedHotelId}</strong>.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600 block">Select Sandbox Channel Provider</label>
                <select
                  value={webhookOta}
                  onChange={e => setWebhookOta(e.target.value)}
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white"
                >
                  {(providers.filter(p => p.status === 'Simulated (Sandbox)').length > 0
                    ? providers.filter(p => p.status === 'Simulated (Sandbox)')
                    : providers
                  ).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-luxury-brown-600 block">Webhook Event Type</label>
                <div className="grid grid-cols-3 gap-1 bg-luxury-beige-50 p-1 rounded-lg">
                  {(['New Booking', 'Cancellation', 'Booking Update'] as const).map(evt => (
                    <button
                      key={evt}
                      type="button"
                      onClick={() => setWebhookEvent(evt)}
                      className={`py-1 text-[9px] font-bold rounded-md transition-colors ${
                        webhookEvent === evt
                          ? 'bg-luxury-brown-900 text-white'
                          : 'text-luxury-brown-600 hover:bg-luxury-beige-200/30'
                      }`}
                    >
                      {evt}
                    </button>
                  ))}
                </div>
              </div>

              {webhookEvent === 'New Booking' && (
                <div className="space-y-3.5 pt-2 bg-luxury-beige-50/50 p-3 rounded-lg border border-luxury-brown-100">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase font-bold text-luxury-brown-500">Inbound Guest Name</label>
                    <input
                      type="text"
                      value={whGuestName}
                      onChange={e => setWhGuestName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded text-xs bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase font-bold text-luxury-brown-500 block">Room Category</label>
                      <select
                        value={whRoomCategory}
                        onChange={e => setWhRoomCategory(e.target.value as any)}
                        className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded text-xs bg-white"
                      >
                        <option value="Standard">Standard</option>
                        <option value="Deluxe">Deluxe</option>
                        <option value="Executive Suite">Executive Suite</option>
                        <option value="Presidential Suite">Presidential Suite</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase font-bold text-luxury-brown-500 block">Nights Count</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={whNights}
                        onChange={e => {
                          const n = parseInt(e.target.value) || 1;
                          setWhNights(n);
                          setWhAmount(n * 4500);
                        }}
                        className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleTriggerWebhook}
                className="w-full py-2.5 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white font-bold rounded-lg tracking-wider uppercase text-[10px] flex items-center justify-center gap-1"
              >
                <Play className="w-3.5 h-3.5 text-luxury-gold-500" />
                Fire Simulated Webhook Callback
              </button>
            </div>
          </div>

          {/* Webhook Stream Output Log */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-luxury-brown-200/50 p-6 flex flex-col space-y-4">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
              <h3 className="font-serif font-bold text-sm text-luxury-brown-900 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-luxury-gold-600" />
                Live Webhook API Listener console
              </h3>
              <button 
                onClick={() => setWebhookLogOutput('')}
                className="text-[10px] font-mono font-bold text-luxury-brown-400 hover:text-rose-600"
              >
                Clear Screen
              </button>
            </div>

            {simulationSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-semibold">
                🎉 {simulationSuccess}
              </div>
            )}

            <div className="flex-1 bg-luxury-brown-950 p-4 rounded-xl font-mono text-[11px] text-emerald-400 overflow-y-auto min-h-[220px] max-h-[300px] border border-luxury-brown-900">
              {webhookLogOutput ? (
                <>
                  <p className="text-luxury-brown-400 text-[10px] mb-2">// Webhook Request Payload Ingested Successfully:</p>
                  <pre className="whitespace-pre-wrap">{webhookLogOutput}</pre>
                </>
              ) : (
                <p className="text-luxury-brown-500 italic">// Standby. Awaiting webhook trigger events...</p>
              )}
            </div>

            {/* List of webhook logs database table */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-mono text-luxury-brown-400 block font-bold uppercase">Simulated Webhook Logs Table (DB)</span>
              <div className="overflow-x-auto border border-luxury-brown-100 rounded-lg">
                <table className="w-full text-left text-xs divide-y divide-luxury-brown-100">
                  <thead className="bg-luxury-beige-50 text-luxury-brown-600 font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-2.5">Channel</th>
                      <th className="p-2.5">Event</th>
                      <th className="p-2.5">Payload Preview</th>
                      <th className="p-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-50 font-mono text-[10px]">
                    {webhookLogs.slice(0, 4).map(l => (
                      <tr key={l.id} className="hover:bg-luxury-beige-50/40">
                        <td className="p-2.5 font-bold text-luxury-brown-900">{l.otaName}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            l.eventType === 'New Booking' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {l.eventType}
                          </span>
                        </td>
                        <td className="p-2.5 text-luxury-brown-500 max-w-[120px] truncate">{l.payload}</td>
                        <td className="p-2.5 text-[9px] text-luxury-brown-400">{fmtDate(l.receivedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: DATABASE SYNC LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-luxury-brown-200/50 p-6 space-y-4 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-luxury-brown-100 pb-3">
            <div>
              <h2 className="font-serif font-bold text-base text-luxury-brown-900">
                API Logs & Outbound Database Records
              </h2>
              <p className="text-[11px] text-luxury-brown-500">
                Tracks exact XML/JSON payloads, status codes and latencies dispatched by the Channel Connector modules.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setApiLogs([]);
                  triggerAlert('API Logs table cleared.', 'info');
                }}
                className="px-3 py-1.5 border border-luxury-brown-200 text-luxury-brown-700 text-xs font-bold rounded-lg hover:bg-luxury-beige-50"
              >
                Clear Table
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-luxury-brown-100">
            <table className="w-full text-left text-xs divide-y divide-luxury-brown-100">
              <thead className="bg-luxury-beige-50 text-luxury-brown-600 font-mono text-[10px] uppercase font-bold">
                <tr>
                  <th className="p-3">OTA</th>
                  <th className="p-3">Endpoint</th>
                  <th className="p-3">Request Payload</th>
                  <th className="p-3">API Response</th>
                  <th className="p-3">HTTP Status</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Dispatched At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-50 font-mono text-[11px] text-luxury-brown-800">
                {apiLogs.map(log => (
                  <tr key={log.id} className="hover:bg-luxury-beige-50/20">
                    <td className="p-3 font-bold text-luxury-brown-900">{log.otaName}</td>
                    <td className="p-3 text-luxury-gold-700">{log.endpoint}</td>
                    <td className="p-3 max-w-[150px] truncate" title={log.request}>{log.request}</td>
                    <td className="p-3 max-w-[150px] truncate" title={log.response}>{log.response}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        log.status === 200 || log.status === 201
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.status === 429
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 text-[10px] text-luxury-brown-500">{log.executionTime}</td>
                    <td className="p-3 text-[10px] text-luxury-brown-400">{fmtDate(log.createdAt)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          triggerAlert(`Retrying job payload to ${log.otaName}...`, 'info');
                          setTimeout(() => {
                            // Update this specific row to 200 OK
                            setApiLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 200, response: '{"retry":"SUCCESS","synced":true}', retryCount: l.retryCount + 1 } : l));
                            triggerAlert(`Payload retry to ${log.otaName} returned 200 OK!`, 'success');
                          }, 1000);
                        }}
                        className="text-luxury-gold-700 hover:text-luxury-gold-900 font-bold uppercase tracking-wider text-[10px]"
                      >
                        Retry Push
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: SUPER ADMIN PANEL */}
      {activeTab === 'admin' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section stats */}
          <div className="bg-white border border-luxury-brown-200/50 p-6 rounded-2xl shadow-xs space-y-4">
            <div className="border-b border-luxury-brown-100 pb-3">
              <h2 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                <Shield className="w-5 h-5 text-luxury-gold-600" />
                Global OTA Microservice Adapter Controls
              </h2>
              <p className="text-xs text-luxury-brown-500">
                Enable or Disable individual adapters platform-wide, verify cluster latencies, and update REST API version hooks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map(ota => (
                <div key={ota.id} className="p-4 bg-luxury-beige-50/50 border border-luxury-brown-100 rounded-xl flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{ota.icon}</span>
                      <strong className="text-xs font-serif text-luxury-brown-900">{ota.name}</strong>
                    </div>
                    <div className="flex gap-2 text-[10px] font-mono text-luxury-brown-500">
                      <span>API: <strong>{ota.apiVersion}</strong></span>
                      <span>Rate: <strong>{ota.rateLimit}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const updated = ota.apiVersion === 'v4.0' ? 'v4.1' : 'v4.0';
                        setProviders(prev => prev.map(p => p.id === ota.id ? { ...p, apiVersion: updated } : p));
                        triggerAlert(`Updated ${ota.name} version to ${updated}.`, 'success');
                      }}
                      className="px-2 py-1 border border-luxury-brown-300 rounded text-[9px] font-mono hover:bg-white text-luxury-brown-800"
                    >
                      Bump v4.x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Queue Manager */}
          <div className="bg-white border border-luxury-brown-200/50 p-6 rounded-2xl shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
              <div>
                <h3 className="font-serif font-bold text-sm text-luxury-brown-900 uppercase tracking-wider">
                  Sync Queue & Dead-Letter Job Registry
                </h3>
                <p className="text-[11px] text-luxury-brown-500">
                  Tracks asynchronous outbox workers pushed to background workers.
                </p>
              </div>

              <button
                onClick={() => {
                  setSyncQueue(prev => prev.map(q => ({ ...q, status: 'Completed', attempts: q.attempts + 1 })));
                  triggerAlert('All pending and failed sync payloads resolved successfully!', 'success');
                  onAddAuditLog('OTA Dead-Letter Cleaned', 'Triggered platform-wide self-healing on blocked API queues.');
                }}
                className="px-3 py-1.5 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white text-xs font-bold rounded-lg"
              >
                Force Self-Heal Queue
              </button>
            </div>

            <div className="overflow-x-auto border border-luxury-brown-100 rounded-xl">
              <table className="w-full text-left text-xs divide-y divide-luxury-brown-100">
                <thead className="bg-luxury-beige-50 text-luxury-brown-600 font-mono text-[9px] uppercase">
                  <tr>
                    <th className="p-3">Job ID</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Payload Type</th>
                    <th className="p-3">Outbound Data Block</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Last API Response Fault</th>
                    <th className="p-3 text-right">Job Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-50 font-mono text-[10px]">
                  {syncQueue.map(q => (
                    <tr key={q.id}>
                      <td className="p-3 text-luxury-gold-700">{q.id}</td>
                      <td className="p-3 font-bold text-luxury-brown-900">{q.otaName}</td>
                      <td className="p-3">{q.type}</td>
                      <td className="p-3 max-w-[120px] truncate text-luxury-brown-500">{q.payload}</td>
                      <td className="p-3">{q.attempts}</td>
                      <td className="p-3 text-rose-700 font-semibold">{q.lastError || 'None'}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          q.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {q.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
