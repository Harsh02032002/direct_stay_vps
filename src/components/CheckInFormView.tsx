import React, { useState, useEffect, useMemo } from 'react';
import { Booking, GuestCheckIn, Room, RoomCategory, UserRole, Staff, BookedRoom, SecondaryGuest, HotelSettings, PaymentRecord, CFormData, WaterBottleRecord, AllocatedGuestService, ExtraCharge, Invoice, TravelAgent, MealPlanType, PaymentMethod, BookingSource, BookingStatus, InventoryProduct, InventoryStockMovement, PosOrder } from '../types';
import { 
  Contact, Printer, Check, Receipt, RefreshCw, FileCheck, Users, 
  Sparkles, DollarSign, Plus, Trash2, Landmark, Send, Download, 
  ClipboardList, Settings, Sliders, Hotel, Calendar, UserCheck, Inbox, ShieldCheck,
  Globe, Building, FileSpreadsheet, ShieldAlert, FileText, Layers, Eye, Search, Filter, Clock, PenTool, X, ChevronDown, ChevronUp, BedDouble, AlertCircle, GlassWater, Minus
} from 'lucide-react';
import { showToast } from '../utils/toast';
import QuickDateInput from './QuickDateInput';
import TimePicker12h from './TimePicker12h';
import { calculateEarlyCheckIn } from '../utils/stayTimeUtils';
import { evaluateAndBuildInvoice, normalizeInvoiceConditions } from '../utils/invoiceConditions';
import {
  BillCharge,
  calculateBill,
  normalizeBillSettings,
} from '../utils/billCalculator';
import { calculateCheckInExtraCharges } from '../utils/checkInExtraCharges';
import { allocateGrcNumber, toGrcPrintData } from '../utils/stayBilling';
import { collectStayCharges } from '../utils/folioCollector';
import { defaultGrcTerms, renderGrcHtml } from '../utils/printTemplates';
import { openPrintWindow } from '../utils/printDocument';

interface CheckInFormViewProps {
  mode?: 'walkin' | 'checkin';
  onSwitchTab?: (tab: 'walkin' | 'checkin') => void;
  bookings: Booking[];
  rooms: Room[];
  checkins: GuestCheckIn[];
  selectedBooking: Booking | null;
  setSelectedBooking: (booking: Booking | null) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateCheckins: (checkins: GuestCheckIn[]) => void;
  invoices?: Invoice[];
  onUpdateInvoices?: (invoices: Invoice[]) => void;
  currentRole: UserRole;
  staff: Staff[];
  onAddAuditLog: (action: string, details: string) => void;
  hotelSettings: HotelSettings;
  onUpdateHotelSettings: (settings: HotelSettings) => void;
  loggedInUser?: string;
  waterBottles?: WaterBottleRecord[];
  onUpdateWaterBottles?: (records: WaterBottleRecord[]) => void;
  posOrders?: PosOrder[];
  inventoryProducts?: InventoryProduct[];
  onUpdateInventoryProducts?: (prods: InventoryProduct[]) => void;
  inventoryStockMovements?: InventoryStockMovement[];
  onUpdateInventoryMovements?: (movements: InventoryStockMovement[]) => void;
  travelAgents?: TravelAgent[];
  onUpdateTravelAgents?: (agents: TravelAgent[]) => void;
}

const getIstNowParts = () => {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    let h24 = parseInt(get('hour'), 10);
    if (Number.isNaN(h24) || h24 >= 24) h24 = 0;
    const min = get('minute');
    const hh24 = String(h24).padStart(2, '0');
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return {
      ymd: `${year}-${month}-${day}`,
      hhmm: `${hh24}:${min}`,
      displayTime: `${String(h12).padStart(2, '0')}:${min} ${ampm}`,
    };
  } catch {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const h24 = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return {
      ymd: `${year}-${month}-${day}`,
      hhmm: `${String(h24).padStart(2, '0')}:${min}`,
      displayTime: `${String(h12).padStart(2, '0')}:${min} ${ampm}`,
    };
  }
};

const addDaysYmd = (baseYmd: string, daysAhead: number): string => {
  const m = String(baseYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return addDaysYmd(getIstNowParts().ymd, daysAhead);
  }
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + daysAhead));
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
};

const getTodayDateStr = () => getIstNowParts().ymd;

const getTomorrowDateStr = () => addDaysYmd(getIstNowParts().ymd, 1);

const getFutureDateStr = (daysAhead: number, baseDateStr?: string) => {
  return addDaysYmd(baseDateStr || getIstNowParts().ymd, daysAhead);
};

const formatDdmmyyyy = (ymd?: string): string => {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(ymd || '—');
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const to24hTime = (raw?: string, fallback = '11:00'): string => {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return fallback;
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2];
    const ap = m12[3];
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (m24) {
    return `${String(Math.min(23, Math.max(0, parseInt(m24[1], 10)))).padStart(2, '0')}:${m24[2]}`;
  }
  return fallback;
};

const to12hTime = (hhmm?: string, fallback = '11:00 AM'): string => {
  const s = String(hhmm || '').trim();
  if (!s) return fallback;
  if (/am|pm/i.test(s)) return s.toUpperCase();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  const h24 = parseInt(m[1], 10);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${m[2]} ${ampm}`;
};

const getCurrentTimeStr = () => getIstNowParts().displayTime;

export default function CheckInFormView({
  mode = 'checkin',
  onSwitchTab,
  bookings,
  rooms,
  checkins,
  selectedBooking,
  setSelectedBooking,
  onUpdateBookings,
  onUpdateRooms,
  onUpdateCheckins,
  invoices = [],
  onUpdateInvoices,
  currentRole,
  staff,
  onAddAuditLog,
  hotelSettings,
  onUpdateHotelSettings,
  loggedInUser,
  waterBottles,
  onUpdateWaterBottles,
  posOrders = [],
  inventoryProducts = [],
  onUpdateInventoryProducts,
  inventoryStockMovements = [],
  onUpdateInventoryMovements,
  travelAgents = [],
}: CheckInFormViewProps) {
  const allowBackDatedCheckIn = Boolean(hotelSettings?.allowBackDatedCheckIn);

  const waterBottleInventoryProduct = (inventoryProducts || []).find(
    p =>
      p.name?.toLowerCase().includes('water bottle') ||
      p.name?.toLowerCase().includes('mineral water') ||
      p.name?.toLowerCase() === 'water' ||
      ((p as any).sku && String((p as any).sku).toUpperCase().includes('WATER'))
  );
  const availableWaterStock = Math.max(0, Number(waterBottleInventoryProduct?.currentStock ?? 0));
  const defaultInventoryWaterRate = Number(
    (waterBottleInventoryProduct as any)?.sellingPrice ||
      (waterBottleInventoryProduct as any)?.unitPrice ||
      hotelSettings?.waterBottleRate ||
      20
  );
  const [complimentaryWaterBottles, setComplimentaryWaterBottles] = useState<number>(() =>
    Math.min(2, availableWaterStock)
  );
  const [chargeableWaterBottles, setChargeableWaterBottles] = useState<number>(0);
  const [chargeableWaterRateInput, setChargeableWaterRateInput] = useState<string>(() =>
    String(defaultInventoryWaterRate)
  );
  const waterRateManuallyEditedRef = React.useRef(false);
  const [showQuickAddWaterStock, setShowQuickAddWaterStock] = useState<boolean>(false);
  const [quickWaterAddQty, setQuickWaterAddQty] = useState<string>('24');
  const [quickWaterSellRate, setQuickWaterSellRate] = useState<string>(() =>
    String(defaultInventoryWaterRate)
  );
  const [quickWaterCostRate, setQuickWaterCostRate] = useState<string>('10');

  // Track booking ID created via "Save as Draft" / "Add to Waitlist" in this form session
  // so clicking Draft -> Waitlist -> Reserve & Check-In updates the SAME booking in-place (ZERO duplicates!)
  const [activeSessionBookingId, setActiveSessionBookingId] = useState<string | null>(null);

  useEffect(() => {
    const avail = Math.max(0, Number(waterBottleInventoryProduct?.currentStock ?? 0));
    setComplimentaryWaterBottles(prev => (prev > avail ? avail : prev));
    setChargeableWaterBottles(prev => {
      const maxChargeable = Math.max(0, avail - Math.min(complimentaryWaterBottles, avail));
      return prev > maxChargeable ? maxChargeable : prev;
    });
  }, [waterBottleInventoryProduct?.currentStock]);

  useEffect(() => {
    if (!waterRateManuallyEditedRef.current) {
      setChargeableWaterRateInput(String(defaultInventoryWaterRate));
      setQuickWaterSellRate(String(defaultInventoryWaterRate));
    }
  }, [defaultInventoryWaterRate]);

  const effectiveChargeableWaterRate = Math.max(
    0,
    Number(chargeableWaterRateInput === '' ? 0 : chargeableWaterRateInput) || 0
  );
  const chargeableWaterTotal =
    Math.max(0, Number(chargeableWaterBottles) || 0) * effectiveChargeableWaterRate;
  const totalRequestedWaterBottles =
    Math.max(0, Number(complimentaryWaterBottles) || 0) +
    Math.max(0, Number(chargeableWaterBottles) || 0);

  const handleQuickAddWaterStockToInventory = () => {
    const qtyToAdd = Math.max(0, Math.floor(Number(quickWaterAddQty) || 0));
    const sellRate = Math.max(0, Number(quickWaterSellRate) || 0);
    const costRate = Math.max(0, Number(quickWaterCostRate) || 0);
    if (qtyToAdd <= 0) {
      showToast('Please enter a valid quantity of water bottles to add (at least 1).', 'warning');
      return;
    }
    if (!onUpdateInventoryProducts) {
      showToast('Inventory update handler is not available on this screen.', 'error');
      return;
    }
    const currentHotelId =
      rooms[0]?.hotelId ||
      (hotelSettings as any)?.id ||
      'hotel-1';
    const prevStock = Number(waterBottleInventoryProduct?.currentStock || 0);
    const nextStock = prevStock + qtyToAdd;
    const prodId = waterBottleInventoryProduct?.id || `inv-prod-water-${currentHotelId}`;
    const updatedWaterProd: InventoryProduct = {
      ...(waterBottleInventoryProduct || {
        id: prodId,
        hotelId: currentHotelId,
        name: 'Packaged Drinking Water (1L)',
        code: 'WATER-1L',
        category: 'Housekeeping / F&B',
        sku: 'WATER-1L',
        unit: 'Bottles',
        minimumStock: 5,
        minStockAlert: 5,
      }),
      currentStock: nextStock,
      purchasePrice: costRate,
      costPrice: costRate,
      sellingPrice: sellRate,
      unitPrice: sellRate,
      status: nextStock <= 0 ? 'Out of Stock' : nextStock <= 5 ? 'Low Stock' : 'In Stock',
      lastRestockedDate: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString(),
    } as any;

    const exists = (inventoryProducts || []).some(p => p.id === updatedWaterProd.id);
    const nextProds = exists
      ? (inventoryProducts || []).map(p => (p.id === updatedWaterProd.id ? updatedWaterProd : p))
      : [updatedWaterProd, ...(inventoryProducts || [])];
    onUpdateInventoryProducts(nextProds);

    if (onUpdateInventoryMovements) {
      const inMov = {
        id: `MOV-WB-IN-${Date.now()}`,
        productId: updatedWaterProd.id,
        productName: updatedWaterProd.name,
        type: 'IN' as const,
        quantity: qtyToAdd,
        previousStock: prevStock,
        newStock: nextStock,
        date: getTodayDateStr(),
        time: new Date().toLocaleTimeString(),
        referenceType: 'Purchase' as any,
        referenceId: `QUICK-CI-${Date.now()}`,
        notes: `Quick restock from Check-In (+${qtyToAdd} bottles @ ₹${sellRate}/bottle)`,
        performedBy: loggedInUser || 'Admin',
        hotelId: currentHotelId,
      } as unknown as InventoryStockMovement;
      onUpdateInventoryMovements([inMov, ...(inventoryStockMovements || [])]);
    }

    if (sellRate > 0) {
      setChargeableWaterRateInput(String(sellRate));
    }
    setShowQuickAddWaterStock(false);
    showToast(
      `Added ${qtyToAdd} water bottles to Inventory (Stock: ${prevStock} → ${nextStock}, Rate: ₹${sellRate}/bottle).`,
      'success'
    );
  };
  const [resSearchQuery, setResSearchQuery] = useState('');
  const [hkOverrideApproved, setHkOverrideApproved] = useState(false);
  const [hkOverrideReason, setHkOverrideReason] = useState('');
  const canAuthoriseHkOverride = ['SuperAdmin', 'Owner', 'Admin', 'Manager'].includes(
    String(currentRole || '')
  );
  const isRoomDirtyForCheckIn = (r: Room): boolean => {
    const cs = String(r.cleaningStatus || '').toLowerCase();
    return (
      r.status === 'Dirty' ||
      cs === 'dirty' ||
      cs === 'in progress' ||
      cs === 'needs inspection' ||
      cs === 'inspection'
    );
  };
  const isRoomOutOfOrderForCheckIn = (r: Room): boolean => {
    const st = String(r.status || '').toLowerCase();
    return (
      st === 'maintenance' ||
      st === 'out of order' ||
      st === 'out of service' ||
      st === 'blocked'
    );
  };
  const [arrivalQueueFilter, setArrivalQueueFilter] = useState<'today' | 'all' | 'date'>('today');
  const [filterArrivalDate, setFilterArrivalDate] = useState<string>(getTodayDateStr());
  const [localMode, setLocalMode] = useState<'walkin' | 'checkin'>(mode);
  useEffect(() => {
    setLocalMode(mode);
  }, [mode]);
  const effectiveMode: 'walkin' | 'checkin' = onSwitchTab ? mode : localMode;
  const switchWorkflowTab = (target: 'walkin' | 'checkin') => {
    if (onSwitchTab) {
      onSwitchTab(target);
    } else {
      setLocalMode(target);
    }
  };
  const [checkInBookingKind, setCheckInBookingKind] = useState<'walkin' | 'reservation' | 'group'>('reservation');
  useEffect(() => {
    if (selectedBooking) {
      const hasMulti =
        (selectedBooking.bookedRooms && selectedBooking.bookedRooms.length > 1) ||
        String(selectedBooking.roomNumber || '').split(',').map(x => x.trim()).filter(Boolean).length > 1;
      setCheckInBookingKind(hasMulti ? 'group' : 'reservation');
    }
  }, [selectedBooking]);

  // Walk-In Booking Information state (Part 2.A & Part 3)
  const [walkInBookingDate, setWalkInBookingDate] = useState<string>(getTodayDateStr());
  const [walkInBookingSource, setWalkInBookingSource] = useState<BookingSource>('Walk-in');
  const [walkInBookingStatus, setWalkInBookingStatus] = useState<BookingStatus>('Confirmed');
  const [walkInReservationLookup, setWalkInReservationLookup] = useState<string>('');
  const [walkInIdSeed, setWalkInIdSeed] = useState<number>(() => Number(String(Date.now()).slice(-6)));

  const walkInPreviewBookingId = React.useMemo(() => {
    const existingIds = new Set([...bookings, ...checkins].map(item => String(item.id || '')));
    let candidateNum = Math.max(1001, walkInIdSeed);
    while (existingIds.has(`GP-BKG-${candidateNum}`)) {
      candidateNum += 1;
    }
    return `GP-BKG-${candidateNum}`;
  }, [bookings, checkins, walkInIdSeed]);

  // Optional hotel services (configured under Front Desk > Guest Services). Charged ONLY when the admin ticks them.
  const serviceCatalog = React.useMemo(
    () => (waterBottles || []).filter(w => w.recordType === 'service_catalog'),
    [waterBottles]
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const serviceAmountOf = (s: WaterBottleRecord) => Math.max(0, Number(s.configuredAmount ?? s.chargeAmount ?? 0));
  const [folioFilter, setFolioFilter] = useState<'active' | 'checkedout' | 'all'>('active');
  const [folioDatePreset, setFolioDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today');
  const [folioFromDate, setFolioFromDate] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  });
  const [folioToDate, setFolioToDate] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  });

  const applyFolioDatePreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all') => {
    setFolioDatePreset(preset);
    let today = '';
    try {
      today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      today = new Date().toISOString().slice(0, 10);
    }
    const now = new Date();
    if (preset === 'all') {
      setFolioFromDate('');
      setFolioToDate('');
    } else if (preset === 'today') {
      setFolioFromDate(today);
      setFolioToDate(today);
    } else if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      setFolioFromDate(y);
      setFolioToDate(y);
    } else if (preset === 'this_week') {
      const w = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      setFolioFromDate(w);
      setFolioToDate(today);
    } else if (preset === 'this_month') {
      setFolioFromDate(`${today.slice(0, 7)}-01`);
      setFolioToDate(today);
    }
  };

  const matchesFolioDate = (ci?: string, co?: string): boolean => {
    if (folioDatePreset === 'all' && !folioFromDate && !folioToDate) return true;
    const cIn = String(ci || '').slice(0, 10);
    const cOut = String(co || '').slice(0, 10);
    if (!cIn && !cOut) return folioDatePreset === 'all';
    if (folioFromDate && folioToDate && cIn && cOut) {
      return cIn <= folioToDate && cOut >= folioFromDate;
    }
    if (folioFromDate && cIn && cIn < folioFromDate && cOut && cOut < folioFromDate) return false;
    if (folioToDate && cIn && cIn > folioToDate) return false;
    return true;
  };
  const [showAllCheckedInGuests, setShowAllCheckedInGuests] = useState(false);
  
  // 1. Hotel Configuration state (direct edits)
  const [showConfig, setShowConfig] = useState(false);
  const [configLogo, setConfigLogo] = useState(hotelSettings.logoUrl);
  const [configName, setConfigName] = useState(hotelSettings.name);
  const [configAddress, setConfigAddress] = useState(hotelSettings.address);
  const [configGST, setConfigGST] = useState(hotelSettings.gstNumber);
  const [configPhone, setConfigPhone] = useState(hotelSettings.phoneNumber);
  const [configEmail, setConfigEmail] = useState(hotelSettings.emailAddress);
  const [configWebsite, setConfigWebsite] = useState(hotelSettings.website);

  useEffect(() => {
    // Sync with props when loaded/changed
    setConfigLogo(hotelSettings.logoUrl);
    setConfigName(hotelSettings.name);
    setConfigAddress(hotelSettings.address);
    setConfigGST(hotelSettings.gstNumber);
    setConfigPhone(hotelSettings.phoneNumber);
    setConfigEmail(hotelSettings.emailAddress);
    setConfigWebsite(hotelSettings.website);
  }, [hotelSettings]);

  const handleApplyBranding = () => {
    onUpdateHotelSettings({
      logoUrl: configLogo,
      name: configName,
      address: configAddress,
      gstNumber: configGST,
      phoneNumber: configPhone,
      emailAddress: configEmail,
      website: configWebsite
    });
    onAddAuditLog('Hotel Settings Updated', `Configured branding parameters: ${configName}`);
    setShowConfig(false);
  };

  // 2. Primary Guest Details state
  const [guestName, setGuestName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [nationality, setNationality] = useState('Indian');
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [comingFrom, setComingFrom] = useState('');
  const [goingTo, setGoingTo] = useState('');
  const [arrivalDateInIndia, setArrivalDateInIndia] = useState('');
  const [durationOfStayInIndia, setDurationOfStayInIndia] = useState('');
  const [idProofFileName, setIdProofFileName] = useState('');
  const [idProofFileData, setIdProofFileData] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // 3. ID Details state
  const [idType, setIdType] = useState('Aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [cformFromDate, setCformFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().substring(0, 10);
  });
  const [cformToDate, setCformToDate] = useState(() => new Date().toISOString().substring(0, 10));

  // 4. Additional Guests state (unlimited)
  const [secondaryGuests, setSecondaryGuests] = useState<SecondaryGuest[]>([]);
  const [selectedCheckInForView, setSelectedCheckInForView] = useState<GuestCheckIn | null>(null);

  const handleAddSecondaryGuest = () => {
    userCountTouchedRef.current = true;
    extraChargeTouchedRef.current = false;
    setSecondaryGuests(prev => {
      const next = [
        ...prev,
        { fullName: '', mobile: '', age: '', gender: '', idType: 'Aadhaar', idNumber: '', nationality: 'Indian' }
      ];
      setManualExtraPaxCount(next.length);
      return next;
    });
  };

  const handleRemoveSecondaryGuest = (index: number) => {
    userCountTouchedRef.current = true;
    extraChargeTouchedRef.current = false;
    setSecondaryGuests(prev => {
      const next = prev.filter((_, i) => i !== index);
      setManualExtraPaxCount(next.length);
      return next;
    });
  };

  const handleSecondaryGuestChange = (index: number, field: keyof SecondaryGuest, value: string) => {
    setSecondaryGuests(prev => prev.map((sg, i) => {
      if (i === index) {
        return { ...sg, [field]: value };
      }
      return sg;
    }));
  };

  const handleUpdateSecondaryGuest = (index: number, field: keyof SecondaryGuest, value: any) => {
    setSecondaryGuests(prev => prev.map((sg, i) => (i === index ? { ...sg, [field]: value } : sg)));
  };

  const handleSyncExtraGuestRows = (rawCount: number) => {
    const count = Math.min(20, Math.max(0, Math.floor(Number(rawCount) || 0)));
    extraChargeTouchedRef.current = false;
    setManualExtraPaxCount(count);
    setSecondaryGuests(prev => {
      if (prev.length === count) return prev;
      if (prev.length < count) {
        const added: SecondaryGuest[] = Array.from({ length: count - prev.length }, () => ({
          fullName: '',
          mobile: '',
          age: '',
          gender: '',
          idType: 'Aadhaar',
          idNumber: '',
          nationality: 'Indian',
        }));
        return [...prev, ...added];
      }
      return prev.slice(0, count);
    });
  };

  // v3 5-Step Guided Check-In Wizard, Custom Add-On, Discount/Settlement Switches & Hybrid Payment State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [primaryGender, setPrimaryGender] = useState<string>('');
  const [serviceQtyMap, setServiceQtyMap] = useState<Record<string, number>>({});
  const [customAddonLabel, setCustomAddonLabel] = useState<string>('');
  const [customAddonQty, setCustomAddonQty] = useState<number>(1);
  const [customAddonRate, setCustomAddonRate] = useState<number>(0);
  const [customAddonNotes, setCustomAddonNotes] = useState<string>('');
  const [customExtraRows, setCustomExtraRows] = useState<Array<{ id: string; label: string; qty: number | ''; rate: number | '' }>>([]);
  const [stayHours, setStayHours] = useState<number | ''>('');
  const [servicePriceMap, setServicePriceMap] = useState<Record<string, number | ''>>({});
  const [extraPersonRateOverride, setExtraPersonRateOverride] = useState<number | ''>('');
  const userCountTouchedRef = React.useRef(false);
  const extraChargeTouchedRef = React.useRef(false);
  const [discountEnabled, setDiscountEnabled] = useState<boolean>(false);
  const [discountMode, setDiscountMode] = useState<'percent' | 'fixed'>('fixed');
  const [discountInputValue, setDiscountInputValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [settlementEnabled, setSettlementEnabled] = useState<boolean>(false);
  const [settlementMode, setSettlementMode] = useState<'adjustment' | 'exact'>('adjustment');
  const [settlementAdjustmentInput, setSettlementAdjustmentInput] = useState<number>(0);
  const [settlementTargetInput, setSettlementTargetInput] = useState<number | ''>('');
  const [settlementReason, setSettlementReason] = useState<string>('');
  const [gstInvoiceCategory, setGstInvoiceCategory] = useState<'B2C' | 'B2B'>('B2C');
  const [isHybridCheckInPay, setIsHybridCheckInPay] = useState<boolean>(false);
  const [checkInSplitRows, setCheckInSplitRows] = useState<
    Array<{ id: string; method: PaymentMethod; amount: number | ''; ref: string }>
  >([
    { id: 'ci-sp-1', method: 'Cash', amount: '', ref: '' },
    { id: 'ci-sp-2', method: 'UPI', amount: '', ref: '' },
  ]);
  const [singlePaymentRef, setSinglePaymentRef] = useState<string>('');
  const [confirmGuestChecked, setConfirmGuestChecked] = useState<boolean>(true);
  const [confirmRoomChecked, setConfirmRoomChecked] = useState<boolean>(true);

  // 5. Room Details & Pricing variables
  const [isEditBannerExpanded, setIsEditBannerExpanded] = useState<boolean>(false);
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('');
  const [adults, setAdults] = useState<number | ''>(mode === 'walkin' ? 2 : '');
  const [children, setChildren] = useState<number | ''>(mode === 'walkin' ? 0 : '');
  const [maleCount, setMaleCount] = useState<number>(1);
  const [femaleCount, setFemaleCount] = useState<number>(1);
  const [childCount, setChildCount] = useState<number>(0);
  const [mealPlan, setMealPlan] = useState<MealPlanType>('EP');
  const [purposeOfVisit, setPurposeOfVisit] = useState('Leisure');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [commissionValue, setCommissionValue] = useState<number>(0);

  // Pricing State
  const [standardRate, setStandardRate] = useState(mode === 'walkin' ? 2000 : 0);
  const [roomRate, setRoomRate] = useState(mode === 'walkin' ? 2000 : 0); // Flexible room rate per night (Check-In page starts empty until a room is chosen)
  const [manualDiscount, setManualDiscount] = useState<number>(0); // Independent discount concession (Point 8)
  const [extraPersonCharge, setExtraPersonCharge] = useState(500);
  const [baseOccupancy, setBaseOccupancy] = useState(2);
  const [editingCheckIn, setEditingCheckIn] = useState<GuestCheckIn | null>(null);

  // Renew Price: resets adjusted room tariff back to standard catalog rack rate without touching separate discount
  const handleRenewPrice = () => {
    const selectedRoom = rooms.find(r => r.number === selectedRoomNumber);
    const catalogRate = selectedRoom?.rate || standardRate || 2000;
    setRoomRate(catalogRate);
    showToast(`Room tariff reset to fixed catalog rate (₹${catalogRate}/night).`, 'info');
  };

  // Sync prefill from PMS Overview Quick Walk-In / Check-In
  useEffect(() => {
    try {
      const preselectRaw = sessionStorage.getItem('pms_preselect_room');
      if (preselectRaw) {
        sessionStorage.removeItem('pms_preselect_room');
        const parsed = JSON.parse(preselectRaw);
        if (parsed?.roomNumber) {
          setSelectedRoomNumber(String(parsed.roomNumber));
        }
        if (parsed?.roomType) {
          setRoomType(parsed.roomType as RoomCategory);
        }
        if (parsed?.rate) {
          setStandardRate(Number(parsed.rate));
          setRoomRate(Number(parsed.rate));
        }
        if (parsed?.checkInDate) {
          setCheckInDate(String(parsed.checkInDate));
          setCheckOutDate(getFutureDateStr(1, String(parsed.checkInDate)));
        }
      }
      const savedCat = sessionStorage.getItem('pms_booking_category');
      if (savedCat) {
        sessionStorage.removeItem('pms_booking_category');
        if (savedCat === 'event') {
          setPurposeOfVisit('Event / Banquet Booking');
        }
      }
    } catch {
      // ignore storage errors
    }

    const handleSidebarCheckInNav = (evt: Event) => {
      const cat = (evt as CustomEvent)?.detail?.bookingCategory;
      if (cat === 'event') {
        setPurposeOfVisit('Event / Banquet Booking');
      } else if (cat === 'room') {
        setPurposeOfVisit('Leisure');
      }
    };
    window.addEventListener('directstay:checkin-nav', handleSidebarCheckInNav);
    return () => window.removeEventListener('directstay:checkin-nav', handleSidebarCheckInNav);
  }, []);

  // Sync pricing upon room selection (only when selectedRoomNumber or booking identity changes — never wipe manual edits on background polls)
  const lastSyncedSingleRoomRef = React.useRef<string>('');
  useEffect(() => {
    if (!selectedRoomNumber) {
      lastSyncedSingleRoomRef.current = '';
      if (effectiveMode !== 'walkin' && !editingCheckIn && !selectedBooking) {
        setRoomRate(0);
        setStandardRate(0);
      }
      return;
    }
    const selectedRoom = rooms.find(r => r.number === selectedRoomNumber);
    if (!selectedRoom) return;
    if (selectedRoom.allowExtraBed === false) {
      setHasExtraBed(false);
    }
    const syncKey = `${selectedRoomNumber}:${selectedBooking?.id || ''}:${editingCheckIn?.id || ''}`;
    if (lastSyncedSingleRoomRef.current === syncKey) return;
    lastSyncedSingleRoomRef.current = syncKey;

    setRoomType(selectedRoom.category);
    setStandardRate(selectedRoom.rate);
    if (editingCheckIn && editingCheckIn.roomNumber === selectedRoomNumber && editingCheckIn.roomRate) {
      setRoomRate(editingCheckIn.roomRate);
    } else if (selectedBooking && selectedBooking.roomNumber === selectedRoomNumber && (selectedBooking.roomSubtotal || selectedBooking.bookingAmount)) {
      const bNights = Math.max(1, Number(selectedBooking.nights) || 1);
      if (Number(selectedBooking.roomSubtotal) > 0) {
        setRoomRate(Math.round(Number(selectedBooking.roomSubtotal) / bNights));
      } else if (selectedBooking.bookedRooms?.[0]?.rate) {
        setRoomRate(Number(selectedBooking.bookedRooms[0].rate));
      } else {
        const embeddedBed =
          selectedBooking.hasExtraBed && (!selectedBooking.bookedRooms || selectedBooking.bookedRooms.length === 0)
            ? (Number(selectedBooking.extraBedCount) || 1) * (Number(selectedBooking.extraBedRate) || 500) * bNights
            : 0;
        const embeddedPax = Number(selectedBooking.extraPersonChargeApplied || 0);
        const embeddedEarly = Number(selectedBooking.earlyCheckInCharge || 0);
        const pureRoomTotal = Math.max(
          0,
          Number(selectedBooking.bookingAmount || 0) - embeddedBed - embeddedPax - embeddedEarly
        );
        setRoomRate(pureRoomTotal > 0 ? Math.round(pureRoomTotal / bNights) : selectedRoom.rate);
      }
    } else {
      setRoomRate(selectedRoom.rate);
    }
    // Resolve extraPersonCharge & baseOccupancy from Room, Category Definitions, or Sibling Rooms
    let catExtra = 0;
    let catBase = 0;
    let catMax = 0;
    try {
      const storedCats = typeof window !== 'undefined' ? localStorage.getItem('directstay_room_categories') : null;
      if (storedCats) {
        const parsed = JSON.parse(storedCats);
        if (Array.isArray(parsed)) {
          const match = parsed.find(
            (c: any) => String(c.name || '').trim().toLowerCase() === String(selectedRoom.category || '').trim().toLowerCase()
          );
          if (match) {
            catExtra = Number(match.extra || match.extraPaxFee || 0);
            catBase = Number(match.baseOcc || 0);
            catMax = Number(match.maxOcc || 0);
          }
        }
      }
    } catch {}

    const siblingRoom = rooms.find(
      r =>
        String(r.category || '').trim().toLowerCase() === String(selectedRoom.category || '').trim().toLowerCase() &&
        (Number(r.extraPersonCharge) > 0 || Number(r.baseOccupancy) > 0)
    );

    const configuredExtra =
      Number(selectedRoom.extraPersonCharge) > 0
        ? Number(selectedRoom.extraPersonCharge)
        : catExtra > 0
        ? catExtra
        : Number(siblingRoom?.extraPersonCharge) > 0
        ? Number(siblingRoom?.extraPersonCharge)
        : Number((hotelSettings as any)?.defaultExtraPersonCharge) > 0
        ? Number((hotelSettings as any).defaultExtraPersonCharge)
        : 500;

    const configuredExtraBed =
      Number((selectedRoom as any).extraBedRate) > 0
        ? Number((selectedRoom as any).extraBedRate)
        : Number(selectedRoom.extraPersonCharge) > 0
        ? Number(selectedRoom.extraPersonCharge)
        : catExtra > 0
        ? catExtra
        : Number(siblingRoom?.extraPersonCharge) > 0
        ? Number(siblingRoom?.extraPersonCharge)
        : Number((hotelSettings as any)?.defaultExtraBedRate) > 0
        ? Number((hotelSettings as any).defaultExtraBedRate)
        : configuredExtra > 0
        ? configuredExtra
        : 500;

    const resolvedBaseOcc =
      Number(selectedRoom.baseOccupancy) > 0
        ? Number(selectedRoom.baseOccupancy)
        : catBase > 0
        ? catBase
        : Number(siblingRoom?.baseOccupancy) > 0
        ? Number(siblingRoom?.baseOccupancy)
        : 2;

    setExtraPersonCharge(configuredExtra);
    setExtraPersonRateOverride(''); // Autofill newly selected room's extra pax rate
    setExtraBedRate(configuredExtraBed); // Autofill newly selected room's extra bed rate
    setBaseOccupancy(resolvedBaseOcc);
    extraChargeTouchedRef.current = false;
  }, [selectedRoomNumber, rooms, selectedBooking, editingCheckIn]);

  // Negotiated room rate is the direct base room tariff (e.g. ₹1800 instead of ₹2000 rack); discount applies ONLY when explicitly enabled
  const discountPerNight = discountEnabled && Number(discountInputValue) > 0
    ? Math.max(0, standardRate - roomRate)
    : 0;

  // 6. Stay Details state (Strict Asia/Kolkata timezone + hotel configured checkout time)
  const defaultHotelCheckOutTime = to12hTime(hotelSettings?.checkOutTime, '11:00 AM');
  const [checkInDate, setCheckInDate] = useState(getTodayDateStr());
  const [arrivalTime, setArrivalTime] = useState(getCurrentTimeStr());
  const [checkOutDate, setCheckOutDate] = useState(getTomorrowDateStr());
  const [departureTime, setDepartureTime] = useState(defaultHotelCheckOutTime);

  // Redesigned Single-Page Check-In / Reservation States
  const [bookingCategory, setBookingCategory] = useState<'individual' | 'group' | 'corporate' | 'event'>('individual');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');
  const [guestSearchTerm, setGuestSearchTerm] = useState<string>('');
  const [showPackagesSection, setShowPackagesSection] = useState<boolean>(false);
  const [showExtraChargesSection, setShowExtraChargesSection] = useState<boolean>(false);
  const isExtraBedAllowedForRoom = (roomNumber: string) =>
    rooms.find(r => r.number === roomNumber)?.allowExtraBed !== false;
  const [showSpecialReqSection, setShowSpecialReqSection] = useState<boolean>(false);
  const [specialRequestTags, setSpecialRequestTags] = useState<string[]>([]);
  const [specialRequestNotes, setSpecialRequestNotes] = useState<string>('');
  const [commEmail, setCommEmail] = useState<boolean>(true);
  const [commSms, setCommSms] = useState<boolean>(true);
  const [showQuickGroupPicker, setShowQuickGroupPicker] = useState<boolean>(false);
  const [quickGroupSelectedRooms, setQuickGroupSelectedRooms] = useState<string[]>([]);
  const [showAdvanceLookup, setShowAdvanceLookup] = useState<boolean>(false);
  const [eventVenueName, setEventVenueName] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [inlineBookingSuccess, setInlineBookingSuccess] = useState<{
    id: string;
    actionLabel: string;
    guestName: string;
    roomsLabel: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
  } | null>(null);

  const calcStayDays = (inDate: string, outDate: string) => {
    if (!inDate || !outDate) return 1;
    const m1 = String(inDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const m2 = String(outDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m1 || !m2) return 1;
    const u1 = Date.UTC(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
    const u2 = Date.UTC(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    const days = Math.round((u2 - u1) / 86400000);
    return Number.isNaN(days) || days <= 0 ? 1 : days;
  };

  const todayIstStr = getTodayDateStr();
  const stayNights = calcStayDays(checkInDate, checkOutDate);
  const isEditingExistingDates = Boolean(editingCheckIn || selectedBooking);
  const isFutureAdvanceArrival = Boolean(!editingCheckIn && !selectedBooking && checkInDate > todayIstStr);
  const isSameDayStay = Boolean(checkInDate && checkOutDate && checkInDate === checkOutDate);

  const computedStayHours = useMemo(() => {
    if (!isSameDayStay) return null;
    try {
      const nowIst = getIstNowParts();
      const in24 = to24hTime(arrivalTime, nowIst.hhmm);
      const out24 = to24hTime(departureTime, '18:00');
      const [inH, inM] = in24.split(':').map(Number);
      const [outH, outM] = out24.split(':').map(Number);
      const diffMin = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMin <= 0) return 3;
      return Math.max(1, Math.round(diffMin / 60));
    } catch {
      return 3;
    }
  }, [isSameDayStay, arrivalTime, departureTime]);

  const handleSelectStayHours = (hrs: number) => {
    setStayHours(hrs);
    try {
      const nowIst = getIstNowParts();
      const in24 = to24hTime(arrivalTime, nowIst.hhmm);
      const [inH, inM] = in24.split(':').map(Number);
      let outTotalMinutes = inH * 60 + inM + hrs * 60;
      if (outTotalMinutes >= 24 * 60) {
        outTotalMinutes = 23 * 60 + 59;
      }
      const outH = Math.floor(outTotalMinutes / 60);
      const outM = outTotalMinutes % 60;
      const hhmm = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
      setDepartureTime(to12hTime(hhmm, '06:00 PM'));
    } catch {
      // fallback
    }
  };

  // Sync bookingCategory when an existing booking is loaded (never altering its saved dates!)
  useEffect(() => {
    if (!selectedBooking) return;
    const multiCount =
      (selectedBooking.bookedRooms && selectedBooking.bookedRooms.length) ||
      String(selectedBooking.roomNumber || '').split(',').map(x => x.trim()).filter(Boolean).length;
    if (multiCount > 1) {
      setBookingCategory('group');
    } else if (selectedBooking.companyName || selectedBooking.gstNumber) {
      setBookingCategory('corporate');
    } else {
      setBookingCategory('individual');
    }
    setShowAdvanceLookup(true);
  }, [selectedBooking]);

  const handleArrivalDateChange = (rawNewDate: string) => {
    if (!rawNewDate) return;
    const nextIn = rawNewDate;
    setCheckInDate(nextIn);
    // Do NOT force-overwrite checkOutDate mid-typing if nextIn < checkOutDate!
    // Only advance checkOutDate if same-day mode is on or arrival moved strictly past checkout.
    if (isSameDayStay) {
      setCheckOutDate(nextIn);
    } else if (!checkOutDate || nextIn > checkOutDate) {
      setCheckOutDate(getFutureDateStr(1, nextIn));
    }
  };

  const handleArrivalDateBlur = () => {
    if (!checkInDate) return;
    if (checkOutDate && checkOutDate === checkInDate) {
      const in24 = to24hTime(arrivalTime, getIstNowParts().hhmm);
      const out24 = to24hTime(departureTime, '18:00');
      if (out24 <= in24) {
        handleSelectStayHours(Number(stayHours) || 3);
      }
    } else if (!checkOutDate || checkOutDate < checkInDate) {
      setCheckOutDate(getFutureDateStr(1, checkInDate));
    }
  };

  const handleArrivalTimeChange = (newHhmm: string) => {
    if (!newHhmm) return;
    const nextArr = to12hTime(newHhmm, getIstNowParts().displayTime);
    setArrivalTime(nextArr);
    if (isSameDayStay) {
      const out24 = to24hTime(departureTime, '18:00');
      if (out24 <= newHhmm) {
        const [inH, inM] = newHhmm.split(':').map(Number);
        const hrs = Number(stayHours) || 3;
        const outTotalMin = Math.min(23 * 60 + 59, inH * 60 + inM + hrs * 60);
        const hhmmOut = `${String(Math.floor(outTotalMin / 60)).padStart(2, '0')}:${String(outTotalMin % 60).padStart(2, '0')}`;
        setDepartureTime(to12hTime(hhmmOut, '06:00 PM'));
      }
    }
  };

  // Never clamp/force-reset checkOutDate inside onChange!
  // Browser date inputs emit partial values mid-typing (e.g. typing "2" of "21" emits "02").
  // Clamping in onChange snaps the field back and blocks keyboard typing. Validate on blur / submit instead.
  const handleDepartureDateChange = (rawNewOut: string) => {
    if (!rawNewOut) return;
    setCheckOutDate(rawNewOut);
    if (rawNewOut === checkInDate) {
      const hrs = Number(stayHours) || 3;
      if (!stayHours) setStayHours(hrs);
      const in24 = to24hTime(arrivalTime, getIstNowParts().hhmm);
      const out24 = to24hTime(departureTime, '18:00');
      if (out24 <= in24) {
        handleSelectStayHours(hrs);
      }
    }
  };

  const handleDepartureDateBlur = () => {
    if (!checkOutDate || !checkInDate) return;
    if (checkOutDate < checkInDate) {
      setCheckOutDate(checkInDate);
      const hrs = Number(stayHours) || 3;
      if (!stayHours) setStayHours(hrs);
      const in24 = to24hTime(arrivalTime, getIstNowParts().hhmm);
      const out24 = to24hTime(departureTime, '18:00');
      if (out24 <= in24) {
        handleSelectStayHours(hrs);
      }
      showToast('Departure date cannot be earlier than arrival date.', 'warning');
    } else if (checkOutDate === checkInDate) {
      const in24 = to24hTime(arrivalTime, getIstNowParts().hhmm);
      const out24 = to24hTime(departureTime, '18:00');
      if (out24 <= in24) {
        handleSelectStayHours(Number(stayHours) || 3);
      }
    }
  };

  const handleDepartureTimeChange = (newHhmm: string) => {
    if (!newHhmm) return;
    setDepartureTime(to12hTime(newHhmm, defaultHotelCheckOutTime));
  };

  // Switch booking category while strictly preserving selected dates!
  const handleSelectBookingCategory = (nextCat: 'individual' | 'group' | 'corporate' | 'event') => {
    setBookingCategory(nextCat);
    if (nextCat === 'individual') {
      setCheckInMode('single');
      setShowQuickGroupPicker(false);
    } else if (nextCat === 'group' || nextCat === 'event') {
      setCheckInMode('group');
      if (groupRooms.length === 0) {
        const firstRoom =
          (selectedRoomNumber && rooms.find(r => r.number === selectedRoomNumber)) ||
          rooms.find(r => isRoomTrulyAvailable(r));
        if (firstRoom) {
          setGroupRooms([
            {
              id: `GR-${Date.now()}-1`,
              roomNumber: firstRoom.number,
              category: firstRoom.category,
              rate: firstRoom.rate,
              originalRate: firstRoom.rate,
              adults: Number(adults) || 2,
              children: Number(children) || 0,
              assignedGuestName: guestName || '',
              assignedGuestMobile: mobile || '',
              hasExtraBed: false,
              extraBedCount: 1,
              extraBedRate: Number(firstRoom.extraPersonCharge) > 0 ? Number(firstRoom.extraPersonCharge) : 500,
            },
          ]);
        }
      }
      if (nextCat === 'event' && !groupName) {
        setGroupName('Event / Banquet Block');
      }
    } else if (nextCat === 'corporate') {
      setWalkInBookingSource('Corporate');
    }
  };

  // 7. Extra Person & Extra Bed/Mattress State (Both strictly OFF by default — independent checkboxes!)
  const [applyExtraPersonCharge, setApplyExtraPersonCharge] = useState<boolean>(false);
  const [extraPersonQty, setExtraPersonQty] = useState<number>(1);
  const [extraPersonNightsOverride, setExtraPersonNightsOverride] = useState<number | ''>('');
  const [manualExtraPaxCount, setManualExtraPaxCount] = useState<number | ''>('');
  const activeSelectedRoomObj = rooms.find(r => r.number === selectedRoomNumber);
  const selectedRoomMaxOccupancy = React.useMemo(() => {
    if (Number(activeSelectedRoomObj?.maxOccupancy) > 0) {
      return Number(activeSelectedRoomObj?.maxOccupancy);
    }
    try {
      const storedCats = typeof window !== 'undefined' ? localStorage.getItem('directstay_room_categories') : null;
      if (storedCats && activeSelectedRoomObj?.category) {
        const parsed = JSON.parse(storedCats);
        if (Array.isArray(parsed)) {
          const match = parsed.find(
            (c: any) => String(c.name || '').trim().toLowerCase() === String(activeSelectedRoomObj.category || '').trim().toLowerCase()
          );
          if (match && Number(match.maxOcc || match.maxOccupancy) > 0) {
            return Number(match.maxOcc || match.maxOccupancy);
          }
        }
      }
    } catch {}
    const sibling = rooms.find(
      r =>
        String(r.category || '').trim().toLowerCase() === String(activeSelectedRoomObj?.category || '').trim().toLowerCase() &&
        Number(r.maxOccupancy) > 0
    );
    if (sibling && Number(sibling.maxOccupancy) > 0) {
      return Number(sibling.maxOccupancy);
    }
    return Math.max(baseOccupancy, 3);
  }, [activeSelectedRoomObj, rooms, baseOccupancy]);
  const singleTotalOccupants = Math.max(
    (Number(adults) || 1) + (Number(children) || 0),
    1 + secondaryGuests.length
  );
  const totalOccupants = singleTotalOccupants;
  const extraGuestsCount = Math.max(0, singleTotalOccupants - baseOccupancy);
  const extraGuestExplicitCount =
    manualExtraPaxCount !== ''
      ? Math.max(0, Number(manualExtraPaxCount) || 0)
      : secondaryGuests.length;
  const effectiveExtraPaxRate =
    extraPersonRateOverride !== '' ? Math.max(0, Number(extraPersonRateOverride) || 0) : extraPersonCharge;
  const effectiveExtraPaxNights =
    extraPersonNightsOverride !== '' ? Math.max(1, Math.floor(Number(extraPersonNightsOverride) || 1)) : stayNights;

  // --- SUB-NAVIGATION TABS ---
  const [activeSubTab, setActiveSubTab] = useState<'form' | 'folios' | 'cform'>('form');

  // --- CHECK-IN MODE (SINGLE vs GROUP) ---
  const [checkInMode, setCheckInMode] = useState<'single' | 'group'>('single');

  // --- EXTRA BED / MATTRESS STATE (OFF BY DEFAULT) ---
  const [hasExtraBed, setHasExtraBed] = useState<boolean>(false);
  const [extraBedCount, setExtraBedCount] = useState<number>(1);
  const [extraBedRate, setExtraBedRate] = useState<number>(500);
  const [extraBedNightsOverride, setExtraBedNightsOverride] = useState<number | ''>('');
  const effectiveExtraBedNights =
    extraBedNightsOverride !== '' ? Math.max(1, Math.floor(Number(extraBedNightsOverride) || 1)) : stayNights;

  const singleExtraCalc = calculateCheckInExtraCharges({
    extraPerson: {
      enabled: applyExtraPersonCharge,
      quantity: extraPersonQty,
      ratePerNight: effectiveExtraPaxRate,
      applicableNights: effectiveExtraPaxNights,
    },
    extraBed: {
      enabled: hasExtraBed && activeSelectedRoomObj?.allowExtraBed !== false,
      quantity: extraBedCount,
      ratePerNight: extraBedRate,
      applicableNights: effectiveExtraBedNights,
    },
    roomNumber: selectedRoomNumber || '101',
  });
  const resolvedSingleExtraPaxCount = singleExtraCalc.extraPersonQty;
  const extraPersonChargesTotal = singleExtraCalc.extraPersonTotal;

  // --- C-FORM STATE (FOREIGN GUEST REGISTRATION) ---
  const [isCFormRequired, setIsCFormRequired] = useState<boolean>(false);
  const [cFormGender, setCFormGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [cFormDob, setCFormDob] = useState<string>('1992-05-15');
  const [cFormPassportNumber, setCFormPassportNumber] = useState<string>('');
  const [cFormPassportCountry, setCFormPassportCountry] = useState<string>('');
  const [cFormPassportIssueDate, setCFormPassportIssueDate] = useState<string>('2020-01-10');
  const [cFormPassportExpiryDate, setCFormPassportExpiryDate] = useState<string>('2030-01-09');
  const [cFormVisaNumber, setCFormVisaNumber] = useState<string>('');
  const [cFormVisaType, setCFormVisaType] = useState<string>('Tourist');
  const [cFormVisaIssueDate, setCFormVisaIssueDate] = useState<string>('2023-01-01');
  const [cFormVisaExpiryDate, setCFormVisaExpiryDate] = useState<string>('2028-01-01');
  const [cFormVisaPlaceOfIssue, setCFormVisaPlaceOfIssue] = useState<string>('Indian Embassy');
  const [cFormArrivalDateInIndia, setCFormArrivalDateInIndia] = useState<string>(getTodayDateStr());
  const [cFormPortOfArrival, setCFormPortOfArrival] = useState<string>('New Delhi Airport (DEL)');
  const [cFormHomeCountryAddress, setCFormHomeCountryAddress] = useState<string>('');
  const [cFormAddressInHomeCountry, setCFormAddressInHomeCountry] = useState<string>('');
  const [cFormCityInHomeCountry, setCFormCityInHomeCountry] = useState<string>('');
  const [cFormCountryInHomeCountry, setCFormCountryInHomeCountry] = useState<string>('');
  const [cFormPurposeOfVisit, setCFormPurposeOfVisit] = useState<string>('Tourism');
  const [cFormNextDestination, setCFormNextDestination] = useState<string>('Goa');

  // Auto-detect foreign guest nationality to enable C-Form
  useEffect(() => {
    if (nationality && nationality.toLowerCase() !== 'indian' && nationality.toLowerCase() !== 'india') {
      setIsCFormRequired(true);
      if (!cFormPassportCountry) setCFormPassportCountry(nationality);
      if (!cFormCountryInHomeCountry) setCFormCountryInHomeCountry(nationality);
    }
  }, [nationality]);

  // --- GROUP CHECK-IN STATE ---
  const [groupName, setGroupName] = useState<string>('');
  const [groupBookingId, setGroupBookingId] = useState<string>(() => `GRP-BKG-${Math.floor(1000 + Math.random() * 9000)}`);

  interface GroupRoomItem {
    id: string;
    roomNumber: string;
    category: string;
    rate: number;
    originalRate: number;
    adults: number;
    children: number;
    assignedGuestName: string;
    assignedGuestMobile: string;
    hasExtraBed: boolean;
    extraBedCount: number;
    extraBedRate: number;
  }

  const [groupRooms, setGroupRooms] = useState<GroupRoomItem[]>([]);

  // Check if a room has an active Advance Reservation overlapping [startStr, endStr]
  const getRoomOverlappingBooking = (
    roomNum: string,
    startStr: string = checkInDate,
    endStr: string = checkOutDate
  ): Booking | undefined => {
    if (!roomNum) return undefined;
    const targetRoom = String(roomNum).trim();
    const todayStr = getTodayDateStr();
    const effectiveStart = startStr || todayStr;
    const effectiveEnd = endStr || getFutureDateStr(1, effectiveStart);
    return bookings.find(b => {
      if (selectedBooking && b.id === selectedBooking.id) return false;
      if (activeSessionBookingId && b.id === activeSessionBookingId) return false;
      if (editingCheckIn && b.id === editingCheckIn.id) return false;
      const rawSt = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
      if (b.status === 'Cancelled' || rawSt === 'cancelled' || rawSt === 'noshow' || rawSt === 'draft' || rawSt === 'waiting') return false;
      if (b.isCompleted || (b as any).isCheckedOut || rawSt === 'checkedout' || rawSt === 'completed') return false;
      const matchingCheckIn = checkins.find(c => c.id === b.id || (c as any).bookingId === b.id);
      if (
        matchingCheckIn &&
        (matchingCheckIn.checkedOutDateTime ||
          String(matchingCheckIn.status || '').toLowerCase().replace(/[\s_-]/g, '') === 'checkedout')
      ) {
        return false;
      }
      const bRooms = String(b.roomNumber || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const inMulti = (b.bookedRooms || []).some(br => String(br.roomNumber || '').trim() === targetRoom);
      if (!bRooms.includes(targetRoom) && !inMulti) return false;
      if (!b.checkInDate) return false;
      const bEnd = b.checkOutDate || getFutureDateStr(1, b.checkInDate);
      // Ignore past un-checked-in reservations whose departure date has already passed
      if (!b.isCheckedIn && rawSt !== 'checkedin' && bEnd <= todayStr && b.checkInDate < todayStr) {
        return false;
      }
      return effectiveStart === b.checkInDate || (effectiveStart < bEnd && effectiveEnd > b.checkInDate);
    });
  };

  const isRoomTrulyAvailable = (
    r: Room,
    rangeStart: string = checkInDate,
    rangeEnd: string = checkOutDate
  ): boolean => {
    const isCurrentEditedRoom = Boolean(
      editingCheckIn &&
        (editingCheckIn.roomNumber === r.number ||
          (editingCheckIn.bookedRooms || []).some(br => br.roomNumber === r.number))
    );
    const activeSessionBkgObj = activeSessionBookingId
      ? bookings.find(b => b.id === activeSessionBookingId)
      : undefined;
    const isSelectedReservationRoom = Boolean(
      (selectedBooking &&
        (selectedBooking.roomNumber === r.number ||
          (selectedBooking.bookedRooms || []).some(br => br.roomNumber === r.number))) ||
      (activeSessionBkgObj &&
        (activeSessionBkgObj.roomNumber === r.number ||
          (activeSessionBkgObj.bookedRooms || []).some(br => br.roomNumber === r.number)))
    );
    if (isCurrentEditedRoom) return true;

    const todayStr = getTodayDateStr();
    const effStart = rangeStart || todayStr;
    const effEnd = rangeEnd && rangeEnd > effStart ? rangeEnd : getFutureDateStr(1, effStart);

    const isMaint = isRoomOutOfOrderForCheckIn(r);
    const isDirtyNow = effStart <= todayStr && isRoomDirtyForCheckIn(r);
    if ((isMaint || isDirtyNow) && !canAuthoriseHkOverride) return false;

    if (isSelectedReservationRoom) return true;

    // Validate active in-house occupant overlap against the FULL selected date range [effStart, effEnd)
    const hasOverlappingOccupant = checkins.some(c => {
      if (c.checkedOutDateTime) return false;
      const cSt = String(c.status || '').toLowerCase().replace(/[\s_-]/g, '');
      if (cSt === 'checkedout' || cSt === 'completed' || cSt === 'cancelled' || (c as any).isCheckedOut) return false;
      if (c.id === (selectedBooking?.id || '') || c.id === (editingCheckIn?.id || '')) return false;
      const matchesRoom =
        c.roomNumber === r.number || (c.bookedRooms || []).some(br => br.roomNumber === r.number);
      if (!matchesRoom) return false;
      const occStart = c.checkInDate || todayStr;
      const occEnd =
        c.checkOutDate && c.checkOutDate > occStart
          ? c.checkOutDate
          : getFutureDateStr(1, Math.max(0, occStart.localeCompare(todayStr)) ? occStart : todayStr);
      // Overlap check: [effStart, effEnd) intersects [occStart, occEnd)
      return effStart < occEnd && effEnd > occStart;
    });

    // If room is flagged Occupied in inventory without an active checkin record, block for current/today dates
    const isOccupiedNowWithoutRecord =
      r.status === 'Occupied' && effStart <= todayStr && effEnd > todayStr;

    const overlappingBooking = getRoomOverlappingBooking(r.number, effStart, effEnd);
    const isReservedToday =
      r.status === 'Reserved' &&
      effStart <= todayStr &&
      effEnd > todayStr &&
      Boolean(overlappingBooking);

    return !hasOverlappingOccupant && !isOccupiedNowWithoutRecord && !overlappingBooking && !isReservedToday;
  };

  useEffect(() => {
    if (effectiveMode !== 'walkin') return;
    if (!selectedRoomNumber || editingCheckIn) return;
    const rm = rooms.find(r => r.number === selectedRoomNumber);
    if (!rm || !isRoomTrulyAvailable(rm)) {
      setSelectedRoomNumber('');
    }
  }, [effectiveMode, checkInDate, checkOutDate, bookings, selectedBooking, editingCheckIn, rooms, selectedRoomNumber]);

  const handleAddGroupRoom = () => {
    const avail = rooms.find(r => isRoomTrulyAvailable(r) && !groupRooms.some(gr => gr.roomNumber === r.number));
    if (!avail) {
      showToast('No additional available rooms (free from advance bookings/occupancy) to add to group allocation.', 'warning');
      return;
    }
    setGroupRooms(prev => [
      ...prev,
      {
        id: `GR-${Date.now()}-${prev.length + 1}`,
        roomNumber: avail.number,
        category: avail.category,
        rate: avail.rate,
        originalRate: avail.rate,
        adults: 2,
        children: 0,
        assignedGuestName: guestName ? `${guestName} (Rm ${avail.number})` : '',
        assignedGuestMobile: mobile,
        hasExtraBed: false,
        extraBedCount: 1,
        extraBedRate: avail.extraPersonCharge || 0
      }
    ]);
  };

  const handleRemoveGroupRoom = (id: string) => {
    setGroupRooms(prev => prev.filter(gr => gr.id !== id));
  };

  const handleUpdateGroupRoom = (id: string, field: keyof GroupRoomItem, value: any) => {
    if (field === 'hasExtraBed' && value) {
      const target = groupRooms.find(g => g.id === id);
      if (target && rooms.find(r => r.number === target.roomNumber)?.allowExtraBed === false) {
        showToast(`Room ${target.roomNumber} does not allow an extra bed / mattress.`, 'warning');
        return;
      }
    }
    setGroupRooms(prev => prev.map(gr => {
      if (gr.id === id) {
        const updated = { ...gr, [field]: value };
        if (field === 'adults' || field === 'children' || field === 'roomNumber') {
          extraChargeTouchedRef.current = false;
        }
        if (field === 'roomNumber') {
          const rm = rooms.find(r => r.number === value);
          if (rm) {
            updated.category = rm.category;
            updated.rate = rm.rate;
            updated.originalRate = rm.rate;
            updated.extraBedRate = rm.extraPersonCharge || 0;
            if (rm.allowExtraBed === false) {
              updated.hasExtraBed = false;
            }
          }
        }
        return updated;
      }
      return gr;
    }));
  };

  // C-Form Search & Filters
  const [cFormSearch, setCFormSearch] = useState('');
  const [cFormStatusFilter, setCFormStatusFilter] = useState<'All' | 'Pending' | 'Generated' | 'Submitted'>('All');
  const [viewingCFormModal, setViewingCFormModal] = useState<GuestCheckIn | null>(null);

  // 8. Billing Section Live aggregates
  const [otherCharges, setOtherCharges] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');

  const roomChargesTotal = roomRate * stayNights;
  const extraBedTotal = singleExtraCalc.extraBedTotal;

  // Group mode totals
  const groupRoomChargesPerNight = groupRooms.reduce((sum, r) => sum + Number(r.rate || 0), 0);
  const groupExtraBedPerNight = groupRooms.reduce(
    (sum, r) => sum + (r.hasExtraBed ? Math.max(1, Number(r.extraBedCount) || 1) * Math.max(0, Number(r.extraBedRate) || 0) : 0),
    0
  );
  const groupRoomChargesTotal = groupRoomChargesPerNight * stayNights;
  const groupExtraBedChargesTotal = groupExtraBedPerNight * effectiveExtraBedNights;
  const groupTotalGuests = groupRooms.reduce((sum, r) => sum + Number(r.adults || 0) + Number(r.children || 0), 0);
  const groupBaseOccupancy = groupRooms.reduce((sum, r) => {
    const rmObj = rooms.find(rm => rm.number === r.roomNumber);
    return sum + (rmObj?.baseOccupancy ?? 2);
  }, 0);
  const groupExtraGuestsCount = groupRooms.reduce((sum, r) => {
    const rmObj = rooms.find(rm => rm.number === r.roomNumber);
    const base = rmObj?.baseOccupancy ?? 2;
    return sum + Math.max(0, Number(r.adults || 0) + Number(r.children || 0) - base);
  }, 0);
  const groupExtraPersonChargesTotal = applyExtraPersonCharge
    ? Math.max(1, Number(extraPersonQty) || 1) * effectiveExtraPaxRate * effectiveExtraPaxNights
    : 0;

  const effectiveTotalOccupants = checkInMode === 'single' ? totalOccupants : groupTotalGuests;
  const effectiveBaseOccupancy = checkInMode === 'single' ? baseOccupancy : Math.max(2, groupBaseOccupancy);
  const effectiveExtraGuestsCount = checkInMode === 'single' ? extraGuestsCount : groupExtraGuestsCount;
  const effectiveExtraPersonChargesTotal = applyExtraPersonCharge
    ? checkInMode === 'single'
      ? extraPersonChargesTotal
      : groupExtraPersonChargesTotal
    : 0;
  const effectiveRoomChargesTotal = checkInMode === 'single' ? roomChargesTotal : groupRoomChargesTotal;
  const effectiveExtraBedTotal = checkInMode === 'single' ? extraBedTotal : groupExtraBedChargesTotal;

  // Auto-apply Extra Person Charge when occupants exceed Room base occupancy
  useEffect(() => {
    if (editingCheckIn) return;
    const targetExtra = checkInMode === 'group' ? groupExtraGuestsCount : extraGuestsCount;
    if (!extraChargeTouchedRef.current) {
      if (targetExtra > 0) {
        setApplyExtraPersonCharge(true);
        setExtraPersonQty(targetExtra);
      } else {
        setApplyExtraPersonCharge(false);
        setExtraPersonQty(1);
      }
    }
  }, [checkInMode, extraGuestsCount, groupExtraGuestsCount, editingCheckIn]);

  // Ticked optional hotel services (exclude any service already billed on a separate invoice)
  const separatelyBilledServiceNames = React.useMemo(() => {
    const targetId = editingCheckIn?.id || selectedBooking?.id || '';
    if (!targetId) return new Set<string>();
    const names = new Set<string>();
    (invoices || []).forEach(inv => {
      if (
        (inv.isSeparateInvoice || String(inv.id || '').startsWith('INV-SEP-')) &&
        inv.invoiceStatus !== 'Cancelled' &&
        (inv.bookingId === targetId || inv.checkInId === targetId)
      ) {
        (((inv as any).items || (inv as any).ledgerLines || []) as any[]).forEach((ln: any) => {
          const desc = String(ln?.description || ln?.name || '').toLowerCase().trim();
          if (desc) names.add(desc);
        });
      }
    });
    return names;
  }, [invoices, editingCheckIn?.id, selectedBooking?.id]);

  const tickedServices = serviceCatalog.filter(s => {
    if (!selectedServiceIds.includes(String(s.id))) return false;
    const sLower = String(s.serviceName || '').toLowerCase().trim();
    for (const billedDesc of separatelyBilledServiceNames) {
      if (sLower && billedDesc.includes(sLower)) return false;
    }
    return true;
  });
  const serviceUnitOf = (s: WaterBottleRecord) => {
    const ov = servicePriceMap[String(s.id)];
    return ov !== undefined && ov !== '' ? Math.max(0, Number(ov) || 0) : serviceAmountOf(s);
  };
  const serviceLineTotalOf = (s: WaterBottleRecord) => {
    const qty = Math.max(1, Number(serviceQtyMap[String(s.id)] ?? 1) || 1);
    return serviceUnitOf(s) * qty;
  };
  const servicesTotal = tickedServices.reduce((sum, s) => sum + serviceLineTotalOf(s), 0);
  const customAddonSingleTotal =
    customAddonLabel.trim() && (Number(customAddonQty) || 0) > 0 && (Number(customAddonRate) || 0) > 0
      ? Math.round((Number(customAddonQty) || 1) * (Number(customAddonRate) || 0) * 100) / 100
      : 0;

  const customExtraRowCharges: BillCharge[] = customExtraRows
    .filter(r => String(r.label || '').trim() && (Number(r.qty) || 0) > 0 && (Number(r.rate) || 0) > 0)
    .map(r => ({
      id: `ci-cx-${r.id}`,
      kind: 'service' as const,
      description: `${String(r.label).trim()} × ${Math.max(1, Number(r.qty) || 1)}`,
      amount: Math.round(Math.max(1, Number(r.qty) || 1) * (Number(r.rate) || 0) * 100) / 100,
    }));
  const customExtraRowsTotal = customExtraRowCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const customAddonTotal = customAddonSingleTotal + customExtraRowsTotal;

  // Early check-in surcharge detection & customizable toggle (defaults to false so agreed tariff is not inflated)
  const [applyEarlyCheckInCharge, setApplyEarlyCheckInCharge] = useState<boolean>(() =>
    Boolean(editingCheckIn?.earlyCheckInCharge && Number(editingCheckIn.earlyCheckInCharge) > 0)
  );
  const [earlyCheckInCustomRate, setEarlyCheckInCustomRate] = useState<number | ''>(() =>
    editingCheckIn?.earlyCheckInCharge ? Number(editingCheckIn.earlyCheckInCharge) : ''
  );

  const earlyCheckInInfo = calculateEarlyCheckIn(arrivalTime, hotelSettings);
  const effectiveEarlyCheckInCharge = (earlyCheckInInfo.isEarly && applyEarlyCheckInCharge)
    ? (earlyCheckInCustomRate !== '' ? Math.max(0, Number(earlyCheckInCustomRate)) : earlyCheckInInfo.chargeAmount)
    : 0;
  const earlyCheckInCharge = effectiveEarlyCheckInCharge;

  const billSettings = normalizeBillSettings(hotelSettings);
  const configuredDefaultGst =
    hotelSettings?.isGstEnabled === false ? 0 : billSettings.roomGstRate;
  const [gstPercent, setGstPercent] = useState<number>(configuredDefaultGst);
  type GstOptionMode = 'non_gst' | 'gst_extra' | 'including_gst';
  const [checkInGstMode, setCheckInGstMode] = useState<GstOptionMode>(() => {
    if (hotelSettings?.isGstEnabled === false) return 'non_gst';
    if (hotelSettings?.roomRateIncludesGst) return 'including_gst';
    return 'gst_extra';
  });

  // Collect existing folio charges already attached to this booking/stay (POS Room Service orders, chargeable water, laundry, booking otherServices) — strictly deduplicated by sourceKey
  const existingStayFolioCharges: BillCharge[] = React.useMemo(() => {
    if (!selectedBooking && !editingCheckIn) return [];
    const existingOtherServiceIds = new Set(
      (Array.isArray((selectedBooking as any)?.otherServices)
        ? (selectedBooking as any).otherServices
        : []
      )
        .map((sv: any) => String(sv?.id || sv?.orderNumber || '').trim())
        .filter(Boolean)
    );
    const filteredPosOrders = (posOrders || []).filter(
      po =>
        !existingOtherServiceIds.has(String(po.id || '').trim()) &&
        !existingOtherServiceIds.has(String(po.orderNumber || '').trim())
    );
    const collected = collectStayCharges({
      booking: selectedBooking || null,
      checkin: editingCheckIn || null,
      posOrders: filteredPosOrders,
      waterBottles,
      rooms,
      settings: billSettings,
    });
    const seenKeys = new Set<string>();
    return collected.charges.filter(ch => {
      if (
        ch.kind === 'room' ||
        ch.kind === 'extra_bed' ||
        ch.kind === 'extra_person' ||
        ch.kind === 'early_checkin' ||
        String(ch.id || '').startsWith('ALLOC-CHK-') ||
        String(ch.id || '').startsWith('AUX-CHK-')
      ) {
        return false;
      }
      const dedupKey = String(ch.sourceKey || ch.id || ch.description || '');
      if (dedupKey && seenKeys.has(dedupKey)) return false;
      if (dedupKey) seenKeys.add(dedupKey);
      return true;
    });
  }, [selectedBooking, editingCheckIn, posOrders, waterBottles, rooms, billSettings]);

  const existingStayFolioSubtotal =
    Math.round(
      existingStayFolioCharges.reduce((sum, ch) => sum + (Number(ch.amount) || 0), 0) * 100
    ) / 100;

  const activeNetSubtotal = (checkInMode === 'single'
    ? (roomChargesTotal + extraPersonChargesTotal + extraBedTotal + otherCharges + servicesTotal + customAddonTotal + existingStayFolioSubtotal)
    : (groupRoomChargesTotal + groupExtraPersonChargesTotal + groupExtraBedChargesTotal + otherCharges + servicesTotal + customAddonTotal + existingStayFolioSubtotal)) + earlyCheckInCharge;

  const netSubtotal = activeNetSubtotal;

  useEffect(() => {
    if (!selectedBooking && !editingCheckIn) {
      if (hotelSettings?.isGstEnabled === false) {
        setGstPercent(0);
        setCheckInGstMode('non_gst');
      } else if (hotelSettings?.roomRateIncludesGst) {
        setGstPercent(normalizeBillSettings(hotelSettings).roomGstRate);
        setCheckInGstMode('including_gst');
      } else {
        setGstPercent(normalizeBillSettings(hotelSettings).roomGstRate);
        setCheckInGstMode('gst_extra');
      }
    }
  }, [hotelSettings?.isGstEnabled, hotelSettings?.defaultGstRate, hotelSettings?.roomRateIncludesGst, selectedBooking, editingCheckIn]);

  // Pick up quick walk-in draft from QuickAddBookingModal if navigated here
  useEffect(() => {
    try {
      const quickDraftRaw = sessionStorage.getItem('directstay_quick_booking_draft');
      if (!quickDraftRaw) return;
      const parsedDraft = JSON.parse(quickDraftRaw);
      if (parsedDraft?.bookingMode === 'walkin') {
        sessionStorage.removeItem('directstay_quick_booking_draft');
        if (parsedDraft.checkInDate) setCheckInDate(String(parsedDraft.checkInDate));
        if (parsedDraft.checkOutDate) setCheckOutDate(String(parsedDraft.checkOutDate));
        if (parsedDraft.numGuests) setAdults(Math.max(1, Number(parsedDraft.numGuests)));
        const firstReq = Array.isArray(parsedDraft.requirements) ? parsedDraft.requirements[0] : null;
        const assignedRmNo = firstReq?.assignedRooms?.[0] || parsedDraft?.preselectedRoom?.number || '';
        if (assignedRmNo) setSelectedRoomNumber(String(assignedRmNo));
        if (firstReq?.categoryName) setRoomType(String(firstReq.categoryName));
        if (firstReq?.unitPrice) setRoomRate(Number(firstReq.unitPrice));
        if (parsedDraft.withGst === false || Number(parsedDraft.gstRate) === 0) {
          setGstPercent(0);
          setCheckInGstMode('non_gst');
        } else if (parsedDraft.roomRateIncludesGst) {
          setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
          setCheckInGstMode('including_gst');
        } else {
          setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
          setCheckInGstMode('gst_extra');
        }
        setApplyExtraPersonCharge(Boolean(parsedDraft.hasExtraPerson));
        if (parsedDraft.hasExtraPerson) {
          setExtraPersonQty(Math.max(1, Number(parsedDraft.extraPersonCount) || 1));
          if (parsedDraft.extraPersonRate !== undefined) {
            setExtraPersonRateOverride(Math.max(0, Number(parsedDraft.extraPersonRate) || 0));
          }
        }
        setHasExtraBed(Boolean(parsedDraft.hasExtraBed));
        if (parsedDraft.hasExtraBed) {
          setExtraBedCount(Math.max(1, Number(parsedDraft.extraBeds) || 1));
          if (parsedDraft.extraBedRate !== undefined) {
            setExtraBedRate(Math.max(0, Number(parsedDraft.extraBedRate) || 0));
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [configuredDefaultGst]);

  const activeStayTargetId = editingCheckIn?.id || selectedBooking?.id || '';
  const existingStayPrimaryInvoice = activeStayTargetId
    ? (invoices || []).find(
        inv =>
          !inv.isSeparateInvoice &&
          (inv.bookingId === activeStayTargetId || inv.checkInId === activeStayTargetId)
      )
    : undefined;
  const isCheckInGstLockedByExistingInvoice = Boolean(editingCheckIn && existingStayPrimaryInvoice);

  // Live Billing Preview via single calculateBill() engine
  const liveCheckInCharges: BillCharge[] =
    checkInMode === 'single'
      ? [
          ...(roomChargesTotal > 0
            ? [
                {
                  id: 'ci-room',
                  kind: 'room' as const,
                  description: 'Room Charges',
                  amount: roomChargesTotal,
                  nights: stayNights,
                  rate: roomRate,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...(applyExtraPersonCharge && extraPersonChargesTotal > 0
            ? [
                {
                  id: 'ci-xpax',
                  kind: 'extra_person' as const,
                  description: `Extra Person (${singleExtraCalc.extraPersonQty} × ₹${singleExtraCalc.extraPersonRate} × ${singleExtraCalc.extraPersonNights}N)`,
                  amount: extraPersonChargesTotal,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...(hasExtraBed && extraBedTotal > 0
            ? [
                {
                  id: 'ci-xbed',
                  kind: 'extra_bed' as const,
                  description: `Extra Bed / Mattress (${singleExtraCalc.extraBedQty} × ₹${singleExtraCalc.extraBedRate} × ${singleExtraCalc.extraBedNights}N)`,
                  amount: extraBedTotal,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...tickedServices.map((s, idx) => {
            const qty = Math.max(1, Number(serviceQtyMap[String(s.id)] ?? 1) || 1);
            return {
              id: `ci-svc-${s.id || idx}`,
              kind: 'service' as const,
              description: qty > 1 ? `${String(s.serviceName || 'Service')} × ${qty}` : String(s.serviceName || 'Service'),
              amount: serviceLineTotalOf(s),
              roomNumber: selectedRoomNumber || '101',
            };
          }),
          ...(customAddonSingleTotal > 0
            ? [
                {
                  id: 'ci-custom-addon',
                  kind: 'service' as const,
                  description: `${customAddonLabel.trim()} × ${Math.max(1, Number(customAddonQty) || 1)}`,
                  amount: customAddonSingleTotal,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...customExtraRowCharges,
          ...(otherCharges > 0
            ? [
                {
                  id: 'ci-other',
                  kind: 'other' as const,
                  description: 'Auxiliary Charges',
                  amount: otherCharges,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...(earlyCheckInCharge > 0
            ? [
                {
                  id: 'ci-early',
                  kind: 'early_checkin' as const,
                  description: 'Early Check-In Charges',
                  amount: earlyCheckInCharge,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...(!editingCheckIn && chargeableWaterBottles > 0 && chargeableWaterTotal > 0
            ? [
                {
                  id: 'ci-water-chg',
                  kind: 'water' as const,
                  description: `Water Bottles (${chargeableWaterBottles} × ₹${effectiveChargeableWaterRate})`,
                  amount: chargeableWaterTotal,
                  quantity: chargeableWaterBottles,
                  rate: effectiveChargeableWaterRate,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...existingStayFolioCharges,
        ]
      : [
          ...groupRooms.map((gr, idx) => ({
            id: `ci-gr-room-${idx}`,
            kind: 'room' as const,
            description: 'Room Charges',
            amount: Number(gr.rate || 0) * stayNights,
            nights: stayNights,
            rate: Number(gr.rate || 0),
            roomNumber: gr.roomNumber,
          })),
          ...(applyExtraPersonCharge && groupExtraPersonChargesTotal > 0
            ? [
                {
                  id: 'ci-gr-xpax',
                  kind: 'extra_person' as const,
                  description: `Extra Person (${Math.max(1, Number(extraPersonQty) || 1)} × ₹${effectiveExtraPaxRate} × ${effectiveExtraPaxNights}N)`,
                  amount: groupExtraPersonChargesTotal,
                },
              ]
            : []),
          ...groupRooms
            .filter(gr => gr.hasExtraBed && Number(gr.extraBedRate) > 0)
            .map((gr, idx) => ({
              id: `ci-gr-xbed-${idx}`,
              kind: 'extra_bed' as const,
              description: `Extra Bed / Mattress (${Number(gr.extraBedCount) || 1} × ₹${Number(gr.extraBedRate) || 0} × ${effectiveExtraBedNights}N)`,
              amount: (Number(gr.extraBedCount) || 1) * Number(gr.extraBedRate || 0) * effectiveExtraBedNights,
              roomNumber: gr.roomNumber,
            })),
          ...tickedServices.map((s, idx) => {
            const qty = Math.max(1, Number(serviceQtyMap[String(s.id)] ?? 1) || 1);
            return {
              id: `ci-gr-svc-${s.id || idx}`,
              kind: 'service' as const,
              description: qty > 1 ? `${String(s.serviceName || 'Service')} × ${qty}` : String(s.serviceName || 'Service'),
              amount: serviceLineTotalOf(s),
            };
          }),
          ...(customAddonSingleTotal > 0
            ? [
                {
                  id: 'ci-gr-custom-addon',
                  kind: 'service' as const,
                  description: `${customAddonLabel.trim()} × ${Math.max(1, Number(customAddonQty) || 1)}`,
                  amount: customAddonSingleTotal,
                },
              ]
            : []),
          ...customExtraRowCharges,
          ...(otherCharges > 0
            ? [
                {
                  id: 'ci-gr-other',
                  kind: 'other' as const,
                  description: 'Auxiliary Charges',
                  amount: otherCharges,
                },
              ]
            : []),
          ...(earlyCheckInCharge > 0
            ? [
                {
                  id: 'ci-gr-early',
                  kind: 'early_checkin' as const,
                  description: 'Early Check-In Charges',
                  amount: earlyCheckInCharge,
                },
              ]
            : []),
          ...(!editingCheckIn && chargeableWaterBottles > 0 && chargeableWaterTotal > 0
            ? [
                {
                  id: 'ci-gr-water-chg',
                  kind: 'water' as const,
                  description: `Water Bottles (${chargeableWaterBottles} × ₹${effectiveChargeableWaterRate})`,
                  amount: chargeableWaterTotal,
                  quantity: chargeableWaterBottles,
                  rate: effectiveChargeableWaterRate,
                  roomNumber: groupRooms[0]?.roomNumber || '101',
                },
              ]
            : []),
          ...existingStayFolioCharges,
        ];

  // Compute v3 Discount (On/Off: % or Fixed) + Negotiated Settlement Adjustment (Subtract or Exact GST-inclusive Target)
  const rawChargesSubtotal = liveCheckInCharges.reduce((sum, ch) => sum + (Number(ch.amount) || 0), 0);
  const computedBaseDiscount = discountEnabled
    ? Math.min(
        rawChargesSubtotal,
        discountMode === 'percent'
          ? Math.round(((rawChargesSubtotal * Math.min(100, Math.max(0, Number(discountInputValue) || 0))) / 100) * 100) / 100
          : Math.max(0, Number(discountInputValue) || 0)
      )
    : Math.max(0, Number(manualDiscount) || 0);
  const afterBaseDiscount = Math.max(0, rawChargesSubtotal - computedBaseDiscount);
  const gstFactorForTarget = gstPercent > 0 ? 1 + gstPercent / 100 : 1;
  const standardPayableAfterDisc = Math.round(afterBaseDiscount * gstFactorForTarget * 100) / 100;
  const computedNegotiatedAdjustment = settlementEnabled
    ? settlementMode === 'exact' && settlementTargetInput !== ''
      ? Math.max(
          0,
          Math.round(
            (afterBaseDiscount - Math.min(Number(settlementTargetInput) || 0, standardPayableAfterDisc) / gstFactorForTarget) * 100
          ) / 100
        )
      : Math.min(afterBaseDiscount, Math.max(0, Number(settlementAdjustmentInput) || 0))
    : 0;
  const totalEffectiveDiscount = Math.min(
    rawChargesSubtotal,
    Math.round((computedBaseDiscount + computedNegotiatedAdjustment) * 100) / 100
  );

  // Hybrid / Split Payment live totals
  const activeCheckInSplits = isHybridCheckInPay
    ? checkInSplitRows.filter(r => (Number(r.amount) || 0) > 0)
    : [];
  const hybridCheckInReceivedSum =
    Math.round(activeCheckInSplits.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
  const effectiveDeskReceivedNow = isHybridCheckInPay ? hybridCheckInReceivedSum : Math.max(0, Number(paidAmount) || 0);

  const liveCheckInBill = calculateBill({
    charges: liveCheckInCharges,
    payments: [
      ...(advanceAmount > 0
        ? [{ id: 'ci-adv', amount: advanceAmount, method: selectedBooking?.paymentMethod || paymentMethod }]
        : []),
      ...(isHybridCheckInPay
        ? activeCheckInSplits.map((sp, i) => ({
            id: `ci-sp-${i}`,
            amount: Number(sp.amount) || 0,
            method: sp.method,
          }))
        : effectiveDeskReceivedNow > 0
        ? [{ id: 'ci-paid', amount: effectiveDeskReceivedNow, method: paymentMethod }]
        : []),
    ],
    discount: totalEffectiveDiscount,
    gstEnabled: checkInGstMode !== 'non_gst' && gstPercent > 0,
    settings: {
      ...billSettings,
      roomGstRate: checkInGstMode === 'non_gst' ? 0 : gstPercent,
      foodGstRate: checkInGstMode === 'non_gst' ? 0 : billSettings.foodGstRate,
      roomRateIncludesGst: checkInGstMode === 'including_gst',
    },
  });

  const gstTax = liveCheckInBill.totalTax;
  const finalAmount = liveCheckInBill.grandTotal;
  const balanceAmount = liveCheckInBill.balance;

  // Travel Agent Commission Calculation (Auto-calculated on Check-In / Confirmed booking)
  const selectedAgentObj = travelAgents.find(a => a.id === selectedAgentId);
  const computedAgentCommission = selectedAgentId
    ? commissionType === 'percentage'
      ? Math.round((Math.max(0, activeNetSubtotal) * Math.max(0, Number(commissionValue) || 0)) / 100)
      : Math.round(Math.max(0, Number(commissionValue) || 0))
    : 0;

  const handleSelectTravelAgent = (id: string) => {
    setSelectedAgentId(id);
    const ag = travelAgents.find(a => a.id === id);
    if (ag) {
      setCommissionType(ag.commissionType || 'percentage');
      setCommissionValue(Number(ag.commissionValue) || 0);
      setWalkInBookingSource('Travel Agent');
    } else if (walkInBookingSource === 'Travel Agent') {
      setWalkInBookingSource('Direct');
    }
  };

  useEffect(() => {
    if (selectedBooking?.travelAgentId) {
      setWalkInBookingSource('Travel Agent');
    }
  }, [selectedBooking?.id]);

  // Signature & Reception Verification Section meta
  const [checkedInBy, setCheckedInBy] = useState(loggedInUser || 'Front Desk Executive');
  const [registrationLoggedTime, setRegistrationLoggedTime] = useState(getCurrentTimeStr());
  const [guestSignatureData, setGuestSignatureData] = useState<string>('');
  const [receptionistSignatureData, setReceptionistSignatureData] = useState<string>('');

  useEffect(() => {
    if (loggedInUser && (!checkedInBy || checkedInBy === 'Raghu Sir (Owner)' || checkedInBy === 'Front Desk Executive')) {
      setCheckedInBy(loggedInUser);
    }
  }, [loggedInUser]);

  // Completed print document container
  const [activePrintDocument, setActivePrintDocument] = useState<GuestCheckIn | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);

  // Check if booking has already completed stay or checked out
  const isBookingCheckedOutOrCompleted = (b: Booking) => {
    const rawSt = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (b.isCompleted || (b as any).isCheckedOut || rawSt === 'checkedout' || rawSt === 'completed') return true;
    const matchingCheckin = checkins.find(
      c =>
        c.id === b.id ||
        ((c as any).bookingId && (c as any).bookingId === b.id) ||
        (c.roomNumber === b.roomNumber &&
          c.guestName === b.guestName &&
          (!b.checkInDate || !c.checkInDate || c.checkInDate === b.checkInDate))
    );
    if (
      matchingCheckin &&
      (matchingCheckin.checkedOutDateTime ||
        String(matchingCheckin.status || '').toLowerCase() === 'checked out')
    ) {
      return true;
    }
    // Only treat a Stay Checkout Invoice as completed when the guest had actually checked in
    if (b.isCheckedIn || matchingCheckin) {
      const matchingCheckoutInvoice = (invoices || []).find(
        inv =>
          !inv.isSeparateInvoice &&
          !String(inv.id || '').startsWith('INV-SEP-') &&
          inv.invoiceStatus !== 'Cancelled' &&
          inv.invoiceStatus !== 'Superseded' &&
          (inv.bookingId === b.id || (inv.checkInId && inv.checkInId === b.id)) &&
          inv.invoiceType === 'Stay Checkout Invoice' &&
          (inv.invoiceStatus === 'Finalized' || inv.isFinalInvoice)
      );
      if (matchingCheckoutInvoice) return true;
    }
    return false;
  };

  // Check if booking is currently checked in (active in-house)
  const isBookingAlreadyCheckedIn = (b: Booking) => {
    const rawSt = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (b.isCheckedIn || rawSt === 'checkedin') return true;
    return checkins.some(
      c =>
        !c.checkedOutDateTime &&
        (c.id === b.id || (c.roomNumber === b.roomNumber && c.guestName === b.guestName))
    );
  };

  // Eligible advance reservations (only pending advance reservations waiting to check in)
  const eligibleReservations = bookings
    .filter(b => {
      const rawSt = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
      if (b.status === 'Cancelled' || rawSt === 'cancelled') return false;
      // Do NOT show guests who have already completed checkout
      if (isBookingCheckedOutOrCompleted(b)) return false;
      // Do NOT show guests who are already checked in (in-house)
      if (isBookingAlreadyCheckedIn(b)) return false;
      return true;
    })
    .sort((a, b) => {
      const today = getTodayDateStr();
      const aToday = a.checkInDate === today ? 0 : 1;
      const bToday = b.checkInDate === today ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      return (a.checkInDate || '').localeCompare(b.checkInDate || '');
    });

  const todayEligibleReservations = eligibleReservations.filter(b => {
    const today = getTodayDateStr();
    return b.checkInDate === today;
  });

  const dateEligibleReservations = eligibleReservations.filter(b => {
    return b.checkInDate === filterArrivalDate;
  });

  const displayedQueueReservations =
    arrivalQueueFilter === 'today'
      ? todayEligibleReservations
      : arrivalQueueFilter === 'date'
      ? dateEligibleReservations
      : eligibleReservations;

  const filteredEligibleReservations = displayedQueueReservations.filter(b => {
    if (!resSearchQuery.trim()) return true;
    const q = resSearchQuery.trim().toLowerCase();
    return (
      (b.guestName || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q) ||
      (b.mobile || '').toLowerCase().includes(q) ||
      (b.roomNumber || '').toLowerCase().includes(q) ||
      (b.roomType || '').toLowerCase().includes(q)
    );
  });

  // Helper to compose address without duplicating city/state/country already present in address
  const composeFullAddress = (addr: string, cityVal: string, stateVal: string, countryVal?: string) => {
    const base = (addr || '').trim();
    const baseLower = base.toLowerCase();
    const parts: string[] = [];
    if (base) parts.push(base);
    if (cityVal && cityVal.trim() && !baseLower.includes(cityVal.trim().toLowerCase())) {
      parts.push(cityVal.trim());
    }
    if (stateVal && stateVal.trim() && !baseLower.includes(stateVal.trim().toLowerCase())) {
      parts.push(stateVal.trim());
    }
    if (countryVal && countryVal.trim() && !baseLower.includes(countryVal.trim().toLowerCase())) {
      parts.push(countryVal.trim());
    }
    return parts.join(', ');
  };

  // Detect if a guest being entered in Walk-in mode already has an eligible advance reservation (by Mobile Number or Booking Reference)
  const matchingExistingReservation = React.useMemo(() => {
    if (selectedBooking || editingCheckIn) return undefined;
    const lookupRaw = walkInReservationLookup.trim();
    const lookupLower = lookupRaw.toLowerCase();
    const lookupDigits = lookupRaw.replace(/\D/g, '');
    const mobileDigits = mobile.replace(/\D/g, '');
    const normalizedMobileTail = mobileDigits.length >= 10 ? mobileDigits.slice(-10) : mobileDigits;

    if (lookupRaw.length < 3 && mobileDigits.length < 5) return undefined;

    return eligibleReservations.find(b => {
      if (isBookingAlreadyCheckedIn(b)) return false;
      const bIdLower = String(b.id || '').toLowerCase();
      const bMobDigits = String(b.mobile || '').replace(/\D/g, '');
      const bMobTail = bMobDigits.length >= 10 ? bMobDigits.slice(-10) : bMobDigits;

      // 1. Match by Booking Reference / Booking ID or Mobile typed in lookup box
      if (lookupRaw.length >= 3) {
        if (bIdLower === lookupLower || bIdLower.includes(lookupLower)) return true;
        if (lookupDigits.length >= 5 && bMobDigits && (bMobDigits.includes(lookupDigits) || lookupDigits.includes(bMobTail))) {
          return true;
        }
      }

      // 2. Match by Guest Mobile Number typed in the registration form
      if (mobileDigits.length >= 5 && bMobDigits) {
        if (normalizedMobileTail.length === 10 && bMobTail === normalizedMobileTail) return true;
        if (bMobDigits.includes(mobileDigits)) return true;
      }

      return false;
    });
  }, [selectedBooking, editingCheckIn, walkInReservationLookup, mobile, eligibleReservations]);

  const populateFormFromBooking = (b: Booking, notify = false) => {
    const existingActiveCheckIn = checkins.find(c => c.id === b.id && !c.checkedOutDateTime);
    if (existingActiveCheckIn) {
      setEditingCheckIn(existingActiveCheckIn);
    } else {
      setEditingCheckIn(null);
    }
    setGuestName(b.guestName || '');
    setDob(b.dob || existingActiveCheckIn?.dob || '');
    setMobile(b.mobile || '');
    setEmailAddress(b.emailAddress || b.email || existingActiveCheckIn?.emailAddress || '');
    const rawAddr = (b.address || existingActiveCheckIn?.address || '').trim();
    const cleanedAddrParts = rawAddr
      ? rawAddr
          .split(',')
          .map(p => p.trim())
          .filter(p => Boolean(p) && !/^\d{5,6}$/.test(p) && p.toLowerCase() !== 'india')
      : [];
    setAddress(rawAddr);
    setCity(
      existingActiveCheckIn?.city ||
        (b as any).city ||
        (cleanedAddrParts.length >= 2
          ? cleanedAddrParts[cleanedAddrParts.length - 1]
          : cleanedAddrParts[0] || '')
    );
    setState(
      existingActiveCheckIn?.state ||
        (b as any).state ||
        (cleanedAddrParts.length >= 2
          ? cleanedAddrParts[cleanedAddrParts.length - 1]
          : '')
    );
    setCountry(existingActiveCheckIn?.country || 'India');
    setCheckInDate(b.checkInDate || getTodayDateStr());
    setCheckOutDate(b.checkOutDate || getTomorrowDateStr());
    setArrivalTime(getCurrentTimeStr());
    setRegistrationLoggedTime(getCurrentTimeStr());
    if (b.checkOutTime) setDepartureTime(b.checkOutTime);
    setAdvanceAmount(Number(b.advanceAmount) || 0);
    const loadedBookingDiscount = Number((b as any).discount || (b as any).discountAmount || 0);
    setManualDiscount(loadedBookingDiscount);
    setDiscountEnabled(loadedBookingDiscount > 0);
    setDiscountMode('fixed');
    setDiscountInputValue(loadedBookingDiscount);
    setSettlementEnabled(false);
    setSettlementAdjustmentInput(0);
    setSettlementTargetInput('');
    setSettlementReason('');
    setIsHybridCheckInPay(false);
    setCheckInSplitRows([
      { id: 'chk-split-1', method: 'Cash', amount: 0, reference: '' },
      { id: 'chk-split-2', method: 'UPI', amount: 0, reference: '' },
    ]);
    setPaidAmount(0);
    setNationality(b.nationality || existingActiveCheckIn?.nationality || 'Indian');
    setAdults(b.adults || 2);
    setChildren(b.children || 0);
    setMaleCount(b.maleCount ?? Math.max(1, (b.adults || 2) - 1));
    setFemaleCount(b.femaleCount ?? ((b.adults || 2) > 1 ? 1 : 0));
    setChildCount(b.childCount ?? (b.children || 0));
    setMealPlan(b.mealPlan || 'EP');
    setPurposeOfVisit(b.purposeOfVisit || 'Leisure');
    setComingFrom(b.comingFrom || existingActiveCheckIn?.comingFrom || '');
    setGoingTo(b.goingTo || existingActiveCheckIn?.goingTo || '');
    setArrivalDateInIndia(b.arrivalDateInIndia || existingActiveCheckIn?.arrivalDateInIndia || '');
    setDurationOfStayInIndia(b.durationOfStayInIndia || existingActiveCheckIn?.durationOfStayInIndia || '');
    setVoucherNumber(b.voucherNumber || '');
    setSelectedAgentId(b.travelAgentId || '');
    setCommissionType(b.commissionType || 'percentage');
    setCommissionValue(b.commissionValue || 0);
    setSelectedServiceIds((b.bookedServices || []).map(s => String(s.serviceId)));
    setPaymentMethod(b.paymentMethod || 'UPI');
    setCompanyName(b.companyName || '');
    setGstNumber(b.gstNumber || '');
    setHasExtraBed(Boolean(b.hasExtraBed));
    setExtraBedCount(Math.max(1, Number(b.extraBedCount) || 1));
    setExtraBedRate(b.extraBedRate !== undefined ? Number(b.extraBedRate) : 500);
    setExtraBedNightsOverride(b.extraBedNights ? Number(b.extraBedNights) : '');
    const savedExtraPaxAmt = Number(
      b.extraPersonChargeApplied || existingActiveCheckIn?.extraPersonChargeApplied || 0
    );
    const hasSavedExtraPerson = Boolean(
      b.hasExtraPerson || existingActiveCheckIn?.hasExtraPerson || savedExtraPaxAmt > 0
    );
    setApplyExtraPersonCharge(hasSavedExtraPerson);
    setExtraPersonQty(
      Math.max(
        1,
        Number(b.extraPersonCount || existingActiveCheckIn?.extraPersonCount) ||
          Math.max(1, (Number(b.adults) || 2) + (Number(b.children) || 0) - 2)
      )
    );
    if (b.extraPersonRate !== undefined && Number(b.extraPersonRate) >= 0) {
      setExtraPersonRateOverride(Number(b.extraPersonRate));
    } else if (existingActiveCheckIn?.extraPersonRate !== undefined) {
      setExtraPersonRateOverride(Number(existingActiveCheckIn.extraPersonRate));
    } else {
      setExtraPersonRateOverride('');
    }
    setExtraPersonNightsOverride(
      b.extraPersonNights
        ? Number(b.extraPersonNights)
        : existingActiveCheckIn?.extraPersonNights
        ? Number(existingActiveCheckIn.extraPersonNights)
        : ''
    );
    setManualExtraPaxCount('');
    setGuestSignatureData(existingActiveCheckIn?.guestSignatureData || b.guestSignatureData || '');
    setReceptionistSignatureData(existingActiveCheckIn?.receptionistSignatureData || b.receptionistSignatureData || '');
    const parsedCsvRoomNumbers = String(b.roomNumber || '')
      .split(',')
      .map(rn => rn.trim())
      .filter(Boolean);

    if (b.bookedRooms && b.bookedRooms.length > 1) {
      setCheckInMode('group');
      setGroupName(b.companyName || `${b.guestName} Corporate Group`);
      setGroupBookingId(b.groupBookingId || b.id);
      setGroupRooms(
        b.bookedRooms.map((br, idx) => {
          const matchedGroupRm = rooms.find(r => r.number === br.roomNumber);
          const defaultRmExtraRate =
            Number(matchedGroupRm?.extraPersonCharge) > 0 ? Number(matchedGroupRm?.extraPersonCharge) : 500;
          return {
            id: `GR-ADV-${idx}`,
            roomNumber: br.roomNumber,
            category: String((br as any).roomType || br.category || matchedGroupRm?.category || b.roomType || 'Standard'),
            rate: Number(br.rate) || Number(matchedGroupRm?.rate) || 2000,
            originalRate: Number(br.originalRate || br.rate || matchedGroupRm?.rate) || 2000,
            adults: Number(br.guestsCount) || 2,
            children: 0,
            assignedGuestName: br.guestName || b.guestName,
            assignedGuestMobile: br.guestMobile || b.mobile,
            hasExtraBed: Boolean(br.hasExtraBed),
            extraBedCount: Number(br.extraBedCount) || 1,
            extraBedRate: Number(br.extraBedRate) > 0 ? Number(br.extraBedRate) : defaultRmExtraRate,
          };
        })
      );
    } else if (parsedCsvRoomNumbers.length > 1) {
      const bNightsForGroup = b.nights || calcStayDays(b.checkInDate, b.checkOutDate) || 1;
      const avgPerRoomNight =
        b.bookingAmount && parsedCsvRoomNumbers.length > 0
          ? Math.round(b.bookingAmount / (bNightsForGroup * parsedCsvRoomNumbers.length))
          : 0;
      setCheckInMode('group');
      setGroupName(b.companyName || `${b.guestName} Group`);
      setGroupBookingId(b.groupBookingId || b.id);
      setGroupRooms(
        parsedCsvRoomNumbers.map((rn, idx) => {
          const rmObj = rooms.find(r => r.number === rn);
          const resolvedRate = Number(rmObj?.rate) || avgPerRoomNight || 2000;
          return {
            id: `GR-ADV-${idx}`,
            roomNumber: rn,
            category: String(rmObj?.category || b.roomType || 'Standard'),
            rate: resolvedRate,
            originalRate: resolvedRate,
            adults: 2,
            children: 0,
            assignedGuestName: b.guestName,
            assignedGuestMobile: b.mobile,
            hasExtraBed: idx === 0 ? Boolean(b.hasExtraBed) : false,
            extraBedCount: Number(b.extraBedCount) || 1,
            extraBedRate: Number(b.extraBedRate) || 500,
          };
        })
      );
    } else {
      setCheckInMode('single');
    }
    if (b.passportNumber && !b.aadhaarNumber) {
      setIdType('Passport');
      setIdNumber(b.passportNumber);
    } else if (b.aadhaarNumber) {
      setIdType('Aadhaar');
      setIdNumber(b.aadhaarNumber);
    } else {
      setIdType('Aadhaar');
      setIdNumber('');
    }
    setIdProofFileName('');
    setIdProofFileData('');

    const primaryRoomNum =
      String(b.bookedRooms?.[0]?.roomNumber || parsedCsvRoomNumbers[0] || b.roomNumber || '').trim();
    const matchingRoom = rooms.find(r => r.number === primaryRoomNum || r.number === b.roomNumber);
    const bNights = b.nights || calcStayDays(b.checkInDate, b.checkOutDate) || 1;
    let resolvedRoomNum = b.roomNumber || primaryRoomNum || '';

    if (matchingRoom) {
      resolvedRoomNum = b.bookedRooms && b.bookedRooms.length > 1 ? b.roomNumber : matchingRoom.number;
      setSelectedRoomNumber(matchingRoom.number);
      setRoomType(matchingRoom.category);
      setStandardRate(matchingRoom.rate);

      if (b.bookedRooms && b.bookedRooms.length > 0 && Number(b.bookedRooms[0].rate) > 0) {
        setRoomRate(Number(b.bookedRooms[0].rate));
      } else if (Number(b.roomSubtotal) > 0 && parsedCsvRoomNumbers.length <= 1) {
        setRoomRate(Math.round(Number(b.roomSubtotal) / bNights));
      } else if (b.bookingAmount && parsedCsvRoomNumbers.length <= 1) {
        const embeddedBed =
          b.hasExtraBed && (!b.bookedRooms || b.bookedRooms.length === 0)
            ? (Number(b.extraBedCount) || 1) * (Number(b.extraBedRate) || 500) * bNights
            : 0;
        const embeddedPax = Number(b.extraPersonChargeApplied || 0);
        const embeddedEarly = Number(b.earlyCheckInCharge || 0);
        const pureRoomTotal = Math.max(0, Number(b.bookingAmount) - embeddedBed - embeddedPax - embeddedEarly);
        setRoomRate(pureRoomTotal > 0 ? Math.round(pureRoomTotal / bNights) : matchingRoom.rate);
      } else {
        setRoomRate(matchingRoom.rate);
      }

      setExtraPersonCharge(
        Number(matchingRoom.extraPersonCharge) > 0 ? Number(matchingRoom.extraPersonCharge) : 500
      );
      setBaseOccupancy(matchingRoom.baseOccupancy ?? 2);
    } else {
      const fallbackRoom =
        rooms.find(r => r.category === b.roomType && r.status !== 'Occupied') ||
        rooms.find(r => r.status !== 'Occupied') ||
        rooms[0];
      resolvedRoomNum = b.roomNumber || fallbackRoom?.number || '';
      setSelectedRoomNumber(primaryRoomNum || fallbackRoom?.number || '');
      setRoomType(b.roomType || fallbackRoom?.category || 'Standard');
      const defaultRate = fallbackRoom?.rate || 2000;
      setStandardRate(defaultRate);
      if (b.bookedRooms && b.bookedRooms.length > 0 && Number(b.bookedRooms[0].rate) > 0) {
        setRoomRate(Number(b.bookedRooms[0].rate));
      } else if (b.bookingAmount && parsedCsvRoomNumbers.length <= 1) {
        setRoomRate(Math.round(b.bookingAmount / bNights));
      } else {
        setRoomRate(defaultRate);
      }
      setExtraPersonCharge(
        Number(fallbackRoom?.extraPersonCharge) > 0 ? Number(fallbackRoom?.extraPersonCharge) : 500
      );
      setBaseOccupancy(fallbackRoom?.baseOccupancy ?? 2);
    }

    const isBkgWithoutGst =
      b.isWithoutGst === true || (b.gstRate !== undefined && Number(b.gstRate) <= 0);
    if (isBkgWithoutGst) {
      setGstPercent(0);
      setCheckInGstMode('non_gst');
    } else if (b.roomRateIncludesGst) {
      setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : Number(b.gstRate) || 5);
      setCheckInGstMode('including_gst');
    } else {
      setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : Number(b.gstRate) || 5);
      setCheckInGstMode('gst_extra');
    }

    if (notify) {
      showToast(
        `Autofilled Advance Booking details for ${b.guestName}${resolvedRoomNum ? ` (Rooms: ${resolvedRoomNum})` : ''}!`,
        'success'
      );
    }
  };

  const lastPopulatedBookingRef = React.useRef<string>('');

  const handleSelectAdvanceBooking = (b: Booking) => {
    lastPopulatedBookingRef.current = `${b.id}:${rooms.length > 0 ? 'ready' : 'empty'}`;
    setActiveSessionBookingId(null);
    setSelectedBooking(b);
    populateFormFromBooking(b, true);
  };

  // Autofill dynamic template on selecting booking (without wiping typed fields on background room polls)
  useEffect(() => {
    if (!selectedBooking) {
      lastPopulatedBookingRef.current = '';
      return;
    }
    const key = `${selectedBooking.id}:${rooms.length > 0 ? 'ready' : 'empty'}`;
    if (lastPopulatedBookingRef.current !== key) {
      const shouldToast = !lastPopulatedBookingRef.current.startsWith(`${selectedBooking.id}:`);
      lastPopulatedBookingRef.current = key;
      populateFormFromBooking(selectedBooking, shouldToast);
    }
  }, [selectedBooking, rooms]);

  // When switching to Walk-In mode, ensure form is ready for direct walk-in check-in
  const prevEffectiveModeRef = React.useRef<'walkin' | 'checkin'>(effectiveMode);
  useEffect(() => {
    const prevMode = prevEffectiveModeRef.current;
    prevEffectiveModeRef.current = effectiveMode;
    if (effectiveMode === 'walkin') {
      if (prevMode !== 'walkin' && selectedBooking) {
        setSelectedBooking(null);
      }
      setEditingCheckIn(null);
      setWalkInBookingDate(getTodayDateStr());
      setWalkInBookingSource('Walk-in');
      setWalkInBookingStatus('Confirmed');
      if (!selectedRoomNumber) {
        const firstAvail = rooms.find(r => isRoomTrulyAvailable(r));
        if (firstAvail) {
          setSelectedRoomNumber(firstAvail.number);
        }
      }
    }
  }, [effectiveMode]);

  const triggerQuickFill = () => {
    const firstNames = ['Debasish', 'Chinmayee', 'Sulata', 'Saurav', 'Suchitra', 'Priyanka', 'Satyagyan'];
    const lastNames = ['Mishra', 'Pradhan', 'Nayak', 'Panigrahi', 'Patra', 'Choudhury', 'Hota'];
    const cities = ['Berhampur', 'Bhubaneswar', 'Gopalpur', 'Chhatrapur', 'Puri'];
    
    const randItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    
    setGuestName(`${randItem(firstNames)} ${randItem(lastNames)}`);
    setMobile(`94${Math.floor(10000000 + Math.random() * 90000000)}`);
    setEmailAddress('guest.pavilion@gmail.com');
    setAddress(`Ganesh Nagar, Courtpeta 3rd Lane, near Engineering School`);
    setCity(randItem(cities));
    setState('Odisha');
    setCountry('India');
    setNationality('Indian');
    setIdType('Aadhaar');
    setIdNumber(`${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`);
    setPurposeOfVisit('Sightseeing');
    
    // Add secondary companion
    setSecondaryGuests([
      {
        fullName: `${randItem(firstNames)} ${randItem(lastNames)}`,
        idType: 'Driving License',
        idNumber: `OD-07-${Math.floor(1000 + Math.random() * 9000)}`,
        nationality: 'Indian'
      }
    ]);

    // Pick first available room (free from advance reservations & occupancy)
    const avail = rooms.find(r => isRoomTrulyAvailable(r));
    if (avail) {
      setSelectedRoomNumber(avail.number);
    } else {
      setSelectedRoomNumber('');
    }
    setAdults(3);
    setChildren(0);
    setOtherCharges(200);
    setAdvanceAmount(1000);
    setCheckedInBy('Raghu Sir (Owner)');
  };

  const handleEditCheckIn = (c: GuestCheckIn) => {
    setEditingCheckIn(c);
    setSelectedBooking(null);
    setCheckInMode(c.isGroupCheckIn ? 'group' : 'single');
    setGuestName(c.guestName || '');
    setDob(c.dob || '');
    setMobile(c.mobile || '');
    setEmailAddress(c.emailAddress || '');
    setAddress(c.address || '');
    setCity(c.city || '');
    setState(c.state || '');
    setCountry(c.country || 'India');
    setNationality(c.nationality || 'Indian');
    setCompanyName(c.companyName || '');
    setGstNumber(c.gstNumber || '');
    setComingFrom(c.comingFrom || '');
    setGoingTo(c.goingTo || '');
    setArrivalDateInIndia(c.arrivalDateInIndia || '');
    setDurationOfStayInIndia(c.durationOfStayInIndia || '');
    setMealPlan(c.mealPlan || 'EP');
    setPurposeOfVisit(c.purposeOfVisit || 'Leisure');
    setVoucherNumber(c.voucherNumber || '');
    setSelectedAgentId(c.travelAgentId || '');
    setCommissionType(c.commissionType || 'percentage');
    setCommissionValue(c.commissionValue || 0);
    setMaleCount(c.maleCount ?? 1);
    setFemaleCount(c.femaleCount ?? 1);
    setChildCount(c.childCount ?? 0);
    setIdType(c.idType || (c.passportNumber ? 'Passport' : 'Aadhaar'));
    setIdNumber(c.idNumber || c.aadhaarNumber || c.passportNumber || '');
    setIdProofFileName(c.idProofFileName || '');
    setIdProofFileData(c.idProofFileData || '');
    setSecondaryGuests(c.secondaryGuests || []);
    setSelectedServiceIds((c.allocatedServices || []).filter(s => String(s.id).startsWith('ALLOC-CHK-')).map(s => String(s.serviceId)));
    setSelectedRoomNumber(c.roomNumber || '');
    setRoomRate(c.roomRate || 2000);
    const loadedCheckInDisc = Number(c.discount ?? c.discountAmount ?? 0);
    setManualDiscount(loadedCheckInDisc);
    setDiscountEnabled(loadedCheckInDisc > 0);
    setDiscountMode('fixed');
    setDiscountInputValue(loadedCheckInDisc);
    setSettlementEnabled(false);
    setSettlementAdjustmentInput(0);
    setSettlementTargetInput('');
    setSettlementReason('');
    setCheckInDate(c.checkInDate || getTodayDateStr());
    setCheckOutDate(c.checkOutDate || getTomorrowDateStr());
    setAdults(c.adults ?? Math.max(1, (c.numGuests || 2) - (c.secondaryGuests?.length || 0)));
    setChildren(c.children ?? 0);
    setAdvanceAmount(c.advanceAmount || 0);
    const existingDeskSplits = (c.payments || []).filter(
      (p) =>
        p &&
        Number(p.amount) > 0 &&
        p.paymentType !== 'Advance Deposit' &&
        !String(p.id || '').endsWith('-adv') &&
        !String(p.id || '').includes(`PAY-${c.id}-adv`)
    );
    if (existingDeskSplits.length >= 2) {
      setIsHybridCheckInPay(true);
      setCheckInSplitRows(
        existingDeskSplits.map((p, idx) => ({
          id: `chk-split-edit-${idx + 1}`,
          method: ((p as any).method || p.paymentMethod || 'Cash') as any,
          amount: Number(p.amount) || 0,
          reference: (p as any).referenceId || p.referenceNo || '',
        }))
      );
      setPaidAmount(existingDeskSplits.reduce((s, p) => s + (Number(p.amount) || 0), 0));
    } else {
      setIsHybridCheckInPay(false);
      setCheckInSplitRows([
        { id: 'chk-split-1', method: 'Cash', amount: 0, reference: '' },
        { id: 'chk-split-2', method: 'UPI', amount: 0, reference: '' },
      ]);
      setPaidAmount((c.cashAmountPaid || 0) + (c.onlineAmountPaid || 0));
    }
    setPaymentMethod((c.paymentMethod as any) || (c.onlineAmountPaid && !c.cashAmountPaid ? 'UPI' : 'Cash'));
    setWizardStep(1);
    const existingStayInv = (invoices || []).find(
      inv => !inv.isSeparateInvoice && (inv.bookingId === c.id || inv.checkInId === c.id)
    );
    if (existingStayInv) {
      const lockedNoGst =
        existingStayInv.isWithoutGst === true ||
        (existingStayInv.gstRate !== undefined && Number(existingStayInv.gstRate) <= 0) ||
        (existingStayInv.gstRate === undefined && Number(existingStayInv.gst || 0) <= 0);
      setGstPercent(lockedNoGst ? 0 : Number(existingStayInv.gstRate) || configuredDefaultGst || 5);
      setCheckInGstMode(lockedNoGst ? 'non_gst' : (existingStayInv as any).roomRateIncludesGst ? 'including_gst' : 'gst_extra');
    } else if (c.isWithoutGst === true || (c.gstRate !== undefined && Number(c.gstRate) <= 0)) {
      setGstPercent(0);
      setCheckInGstMode('non_gst');
    } else if (c.roomRateIncludesGst) {
      setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : Number(c.gstRate) || 5);
      setCheckInGstMode('including_gst');
    } else {
      setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : Number(c.gstRate) || 5);
      setCheckInGstMode('gst_extra');
    }
    setHasExtraBed(Boolean(c.hasExtraBed));
    setExtraBedCount(Math.max(1, Number(c.extraBedCount) || 1));
    setExtraBedRate(c.extraBedRate !== undefined ? Number(c.extraBedRate) : 500);
    setExtraBedNightsOverride(c.extraBedNights ? Number(c.extraBedNights) : '');
    const cSavedExtraPax = Number(c.extraPersonChargeApplied || c.extraPersonChargesApplied || 0);
    setApplyExtraPersonCharge(Boolean(c.hasExtraPerson || cSavedExtraPax > 0));
    setExtraPersonQty(Math.max(1, Number(c.extraPersonCount) || 1));
    setExtraPersonRateOverride(
      c.extraPersonRate !== undefined && Number(c.extraPersonRate) >= 0 ? Number(c.extraPersonRate) : ''
    );
    setExtraPersonNightsOverride(c.extraPersonNights ? Number(c.extraPersonNights) : '');
    setManualExtraPaxCount('');
    setCheckedInBy(c.checkedInBy || loggedInUser || 'Front Desk Executive');
    setGuestSignatureData(c.guestSignatureData || '');
    setReceptionistSignatureData(c.receptionistSignatureData || '');
    if (c.isGroupCheckIn && c.bookedRooms && c.bookedRooms.length > 0) {
      setGroupName(c.groupName || `${c.guestName} Group`);
      setGroupBookingId(c.groupBookingId || c.id);
      setGroupRooms(
        c.bookedRooms.map((br, idx) => ({
          id: `GR-EDIT-${idx}`,
          roomNumber: br.roomNumber,
          category: String(br.category || 'Standard'),
          rate: br.rate || c.roomRate || 2000,
          originalRate: br.originalRate || br.rate || 2000,
          adults: br.guestsCount || 2,
          children: 0,
          assignedGuestName: br.guestName || c.guestName,
          assignedGuestMobile: br.guestMobile || c.mobile,
          hasExtraBed: Boolean(br.hasExtraBed),
          extraBedCount: br.extraBedCount || 1,
          extraBedRate: br.extraBedRate || 500
        }))
      );
    }
    setActiveSubTab('form');
    showToast(`Editing Walk-In / Stay Record #${c.id} (${c.guestName}, Room ${c.roomNumber}).`, 'info');
  };

  const handleCancelEditCheckIn = () => {
    setEditingCheckIn(null);
    setGuestName('');
    setMobile('');
    setEmailAddress('');
    setAddress('');
    setCity('');
    setState('');
    setCountry('India');
    setNationality('Indian');
    setCompanyName('');
    setGstNumber('');
    setIdProofFileName('');
    setIdProofFileData('');
    setIdType('Aadhaar');
    setIdNumber('');
    setSecondaryGuests([]);
    setSelectedRoomNumber('');
    setApplyExtraPersonCharge(false);
    setManualExtraPaxCount('');
    setAdults(effectiveMode === 'walkin' ? 2 : '');
    setChildren(effectiveMode === 'walkin' ? 0 : '');
    setSelectedServiceIds([]);
    setOtherCharges(0);
    setAdvanceAmount(0);
    setPaidAmount(0);
    setManualDiscount(0);
    setDiscountEnabled(false);
    setDiscountInputValue(0);
    setSettlementEnabled(false);
    setSettlementAdjustmentInput(0);
    setSettlementTargetInput('');
    setSettlementReason('');
    setIsHybridCheckInPay(false);
    setCheckInSplitRows([
      { id: 'chk-split-1', method: 'Cash', amount: 0, reference: '' },
      { id: 'chk-split-2', method: 'UPI', amount: 0, reference: '' },
    ]);
    setWizardStep(1);
    setHasExtraBed(false);
    setExtraBedCount(1);
    setExtraBedRate(500);
    setExtraBedNightsOverride('');
    setApplyExtraPersonCharge(false);
    setExtraPersonQty(1);
    setExtraPersonRateOverride('');
    setExtraPersonNightsOverride('');
    setManualExtraPaxCount('');
    setIsCFormRequired(false);
    setGroupRooms([]);
    setGroupName('');
    setDob('');
    setComingFrom('');
    setGoingTo('');
    setArrivalDateInIndia('');
    setDurationOfStayInIndia('');
    setMaleCount(1);
    setFemaleCount(1);
    setChildCount(0);
    setMealPlan('EP');
    setVoucherNumber('');
    setSelectedAgentId('');
    setCommissionType('percentage');
    setCommissionValue(0);
    setGuestSignatureData('');
    setReceptionistSignatureData('');
    showToast('Edit cancelled.', 'info');
  };

  // Helper: Add multiple selected rooms to Group / Event / Corporate booking in 1 click
  const handleAddMultipleGroupRooms = (roomNumbersToAdd: string[]) => {
    const validAdds = roomNumbersToAdd
      .filter(rn => !groupRooms.some(gr => gr.roomNumber === rn))
      .map(rn => rooms.find(r => r.number === rn))
      .filter((r): r is Room => Boolean(r && isRoomTrulyAvailable(r)));
    if (validAdds.length === 0) {
      showToast('Select at least one available room to add to the group.', 'warning');
      return;
    }
    setGroupRooms(prev => [
      ...prev,
      ...validAdds.map((avail, idx) => ({
        id: `GR-${Date.now()}-${prev.length + idx + 1}`,
        roomNumber: avail.number,
        category: avail.category,
        rate: avail.rate,
        originalRate: avail.rate,
        adults: 2,
        children: 0,
        assignedGuestName: guestName ? `${guestName} (Rm ${avail.number})` : '',
        assignedGuestMobile: mobile || '',
        hasExtraBed: false,
        extraBedCount: 1,
        extraBedRate: Number(avail.extraPersonCharge) > 0 ? Number(avail.extraPersonCharge) : 500,
      })),
    ]);
    setQuickGroupSelectedRooms([]);
    setShowQuickGroupPicker(false);
    showToast(`Added ${validAdds.length} room(s) to Group Booking.`, 'success');
  };

  // Helper: convert an Individual single-room booking into a multi-room booking and add one more room
  const handleAddExtraRoomFromSingle = () => {
    userCountTouchedRef.current = true;
    const cur = rooms.find(r => r.number === selectedRoomNumber);
    const seed: GroupRoomItem[] = cur
      ? [
          {
            id: `GR-${Date.now()}-0`,
            roomNumber: cur.number,
            category: cur.category,
            rate: Number(roomRate) || cur.rate,
            originalRate: cur.rate,
            adults: Number(adults) || 2,
            children: Number(children) || 0,
            assignedGuestName: guestName,
            assignedGuestMobile: mobile,
            hasExtraBed: cur.allowExtraBed === false ? false : hasExtraBed,
            extraBedCount,
            extraBedRate,
          },
        ]
      : [];
    const next = rooms.find(r => r.number !== selectedRoomNumber && isRoomTrulyAvailable(r, checkInDate, checkOutDate));
    if (!next) {
      showToast('No other room is available for the selected dates.', 'warning');
      return;
    }
    seed.push({
      id: `GR-${Date.now()}-1`,
      roomNumber: next.number,
      category: next.category,
      rate: next.rate,
      originalRate: next.rate,
      adults: 2,
      children: 0,
      assignedGuestName: guestName ? `${guestName} (Rm ${next.number})` : '',
      assignedGuestMobile: mobile,
      hasExtraBed: false,
      extraBedCount: 1,
      extraBedRate: Number(next.extraPersonCharge) > 0 ? Number(next.extraPersonCharge) : 500,
    });
    setGroupRooms(seed);
    setCheckInMode('group');
    showToast('Extra room added. You can now manage all rooms in the rooming list.', 'success');
  };

  // Helper: Print Blank GRC form for front desk offline registration
  const handleBlankGrcPrint = () => {
    const blankCheckIn = {
      id: 'BLANK-GRC',
      guestName: '________________________________',
      mobile: '________________________',
      roomNumber: selectedRoomNumber || '______',
      roomType: roomType || '____________',
      roomRate: roomRate || 0,
      checkInDate: checkInDate || getTodayDateStr(),
      checkOutDate: checkOutDate || getTomorrowDateStr(),
      arrivalTime,
      departureTime,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      nationality: 'Indian',
      idType: 'Aadhaar / Passport',
      idNumber: '________________________',
      address: '________________________________________________',
      city: '________________',
      state: '________________',
      country: 'India',
    } as unknown as GuestCheckIn;
    handlePrintOfficialGrc(blankCheckIn);
  };

  // Helper: Confirm Advance Booking / Confirm Reservation Only / Save as Draft / Add to Waitlist
  // Never sets room status to Occupied! Persists to bookings & verifies backend sync before showing inline success.
  const handleCreateReservationAction = async (
    targetStatus: 'Confirmed' | 'Draft' | 'Waiting',
    actionLabelOverride?: string
  ) => {
    if (isSubmittingAction) return;
    if (!guestName.trim() || !mobile.trim()) {
      showToast('Guest Full Name and Mobile Number are required.', 'warning');
      return;
    }
    if (checkInMode === 'single' && !(Number(adults) >= 1)) {
      showToast('Please enter the number of adults (at least 1).', 'warning');
      return;
    }

    const todayIst = getTodayDateStr();
    if (!isEditingExistingDates && !allowBackDatedCheckIn && checkInDate < todayIst) {
      showToast('Past arrival dates cannot be selected for new bookings.', 'error');
      return;
    }
    if (!checkOutDate || checkOutDate < checkInDate) {
      showToast('Departure date cannot be earlier than arrival date.', 'error');
      return;
    }

    const isMulti = checkInMode === 'group' && groupRooms.length > 0;
    const allocatedRoomNumbers = isMulti
      ? groupRooms.map(r => r.roomNumber).filter(Boolean)
      : selectedRoomNumber
      ? [selectedRoomNumber]
      : [];

    const bedBlockedRoom = isMulti
      ? groupRooms.find(g => g.hasExtraBed && !isExtraBedAllowedForRoom(g.roomNumber))?.roomNumber
      : hasExtraBed && allocatedRoomNumbers[0] && !isExtraBedAllowedForRoom(allocatedRoomNumbers[0])
      ? allocatedRoomNumbers[0]
      : '';
    if (bedBlockedRoom) {
      showToast(`Room ${bedBlockedRoom} does not allow an extra bed / mattress. Please untick it.`, 'error');
      return;
    }

    if (targetStatus === 'Confirmed' && allocatedRoomNumbers.length === 0) {
      showToast('Please select at least one available room for the reservation.', 'warning');
      return;
    }

    if (targetStatus === 'Confirmed') {
      for (const rNum of allocatedRoomNumbers) {
        const rmObj = rooms.find(r => r.number === rNum);
        if (!rmObj || !isRoomTrulyAvailable(rmObj, checkInDate, checkOutDate)) {
          showToast(
            `Room ${rNum} is not available for ${formatDdmmyyyy(checkInDate)} → ${formatDdmmyyyy(checkOutDate)}. Please choose another room or date range.`,
            'error'
          );
          return;
        }
      }
    }

    if (isHybridCheckInPay && effectiveDeskReceivedNow > 0 && activeCheckInSplits.length < 2) {
      showToast('Hybrid payment requires at least two payment methods with amounts greater than ₹0.', 'error');
      return;
    }
    if (advanceAmount + effectiveDeskReceivedNow > finalAmount + 0.5) {
      showToast('Total received payment cannot exceed the final payable amount.', 'error');
      return;
    }
    if (settlementEnabled && !settlementReason.trim()) {
      showToast('Please enter a reason for the negotiated settlement adjustment.', 'warning');
      return;
    }

    setIsSubmittingAction(true);
    try {
      const existingIds = new Set([...bookings, ...checkins].map(item => String(item.id || '')));
      let nextNum = Math.max(1001, Number(String(Date.now()).slice(-6)));
      while (existingIds.has(`GP-BKG-${nextNum}`)) nextNum += 1;
      const newResId =
        selectedBooking?.id ||
        activeSessionBookingId ||
        (isMulti ? groupBookingId : !existingIds.has(walkInPreviewBookingId) ? walkInPreviewBookingId : `GP-BKG-${nextNum}`);

      const activeHotelId =
        selectedBooking?.hotelId ||
        rooms.find(r => r.number === allocatedRoomNumbers[0])?.hotelId ||
        hotelSettings?.id ||
        '';

      const combinedAddr = [address.trim(), addressLine2.trim(), pincode.trim() ? `PIN: ${pincode.trim()}` : '']
        .filter(Boolean)
        .join(', ');

      const payDateLocal = paymentDate || getTodayDateStr();
      const totalCollectedNow = Math.round((advanceAmount + effectiveDeskReceivedNow) * 100) / 100;
      const reservationPayments: any[] = [];
      if (isHybridCheckInPay && activeCheckInSplits.length > 0) {
        activeCheckInSplits.forEach((sp, idx) => {
          const amt = Number(sp.amount) || 0;
          if (amt <= 0) return;
          reservationPayments.push({
            id: `PAY-${newResId}-adv-${idx + 1}`,
            amount: amt,
            method: sp.method,
            paymentMethod: sp.method,
            paymentType: 'Advance Deposit',
            date: payDateLocal,
            dateTime: `${payDateLocal}T12:00:00`,
            referenceId: sp.ref || (sp as any).reference || undefined,
            notes: (sp.ref || (sp as any).reference)
              ? `Advance Hybrid (${sp.method}) • Ref: ${sp.ref || (sp as any).reference}`
              : `Advance Hybrid (${sp.method})`,
          });
        });
      } else if (totalCollectedNow > 0) {
        reservationPayments.push({
          id: `PAY-${newResId}-adv-1`,
          amount: totalCollectedNow,
          method: paymentMethod,
          paymentMethod,
          paymentType: 'Advance Deposit',
          date: payDateLocal,
          dateTime: `${payDateLocal}T12:00:00`,
          referenceId: singlePaymentRef || undefined,
          notes: singlePaymentRef ? `Advance Payment (${paymentMethod}) • Ref: ${singlePaymentRef}` : `Advance Payment (${paymentMethod})`,
        });
      }

      const resolvedMethodLabel =
        isHybridCheckInPay && activeCheckInSplits.length > 0
          ? activeCheckInSplits.map(sp => `${sp.method} ₹${sp.amount}`).join(' + ')
          : paymentMethod;

      const bookedRoomsPayload = isMulti
        ? groupRooms.map(gr => ({
            roomNumber: gr.roomNumber,
            category: gr.category as any,
            roomType: gr.category,
            rate: gr.rate,
            originalRate: gr.originalRate || gr.rate,
            guestsCount: (Number(gr.adults) || 1) + (Number(gr.children) || 0),
            guestName: gr.assignedGuestName || guestName.trim(),
            guestMobile: gr.assignedGuestMobile || mobile.trim(),
            hasExtraBed: gr.hasExtraBed,
            extraBedCount: gr.hasExtraBed ? gr.extraBedCount : 0,
            extraBedRate: gr.hasExtraBed ? gr.extraBedRate : 0,
          }))
        : allocatedRoomNumbers[0]
        ? [
            {
              roomNumber: allocatedRoomNumbers[0],
              category: (roomType || 'Standard') as any,
              roomType: roomType || 'Standard',
              rate: roomRate,
              originalRate: standardRate,
              guestsCount: (Number(adults) || 1) + (Number(children) || 0) + secondaryGuests.length,
              guestName: guestName.trim(),
              guestMobile: mobile.trim(),
              hasExtraBed,
              extraBedCount: hasExtraBed ? extraBedCount : 0,
              extraBedRate: hasExtraBed ? extraBedRate : 0,
            },
          ]
        : undefined;

      const bookedServicesPayload = tickedServices.map(s => ({
        serviceId: String(s.id),
        serviceName: String(s.serviceName || 'Hotel Service'),
        amount: serviceLineTotalOf(s),
        isChargeable: serviceLineTotalOf(s) > 0,
      }));

      const notesPieces = [
        bookingCategory === 'corporate' ? `Corporate Booking${companyName ? `: ${companyName}` : ''}` : '',
        bookingCategory === 'event' ? `Event / Banquet${eventVenueName ? `: ${eventVenueName}` : ''}` : '',
        specialRequestTags.length > 0 ? `Preferences: ${specialRequestTags.join(', ')}` : '',
        specialRequestNotes.trim() ? `Notes: ${specialRequestNotes.trim()}` : '',
      ].filter(Boolean);

      const newBookingRecord: Booking = {
        id: newResId,
        hotelId: activeHotelId,
        guestName: guestName.trim(),
        dob: dob || undefined,
        mobile: mobile.trim(),
        email: emailAddress.trim() || undefined,
        address: combinedAddr || undefined,
        nationality: nationality || 'Indian',
        aadhaarNumber: idType === 'Aadhaar' ? idNumber : undefined,
        passportNumber: idType === 'Passport' ? idNumber : undefined,
        companyName:
          companyName.trim() ||
          (bookingCategory === 'group' || bookingCategory === 'event' ? groupName.trim() : '') ||
          undefined,
        gstNumber: gstNumber.trim() || undefined,
        roomNumber: allocatedRoomNumbers.join(', '),
        roomType: (isMulti ? groupRooms[0]?.category : roomType) || 'Standard',
        checkInDate,
        checkOutDate,
        checkInTime: arrivalTime,
        checkOutTime: departureTime,
        nights: stayNights,
        adults: Number(adults) || 1,
        children: Number(children) || 0,
        mealPlan,
        purposeOfVisit: purposeOfVisit || 'Leisure',
        comingFrom: comingFrom || undefined,
        goingTo: goingTo || undefined,
        voucherNumber: voucherNumber || undefined,
        travelAgentId: selectedAgentId || undefined,
        commissionType: selectedAgentId ? commissionType : undefined,
        commissionValue: selectedAgentId ? commissionValue : undefined,
        commissionAmount: selectedAgentId ? computedAgentCommission : undefined,
        bookingDate: getTodayDateStr(),
        bookingSource:
          bookingCategory === 'corporate'
            ? 'Corporate'
            : walkInBookingSource || 'Direct',
        status: targetStatus as BookingStatus,
        isCheckedIn: false,
        isCompleted: false,
        roomSubtotal: effectiveRoomChargesTotal,
        bookingAmount: effectiveRoomChargesTotal,
        discount: totalEffectiveDiscount,
        advanceAmount: totalCollectedNow,
        amountPaid: totalCollectedNow,
        dueAmount: Math.max(0, Math.round((finalAmount - totalCollectedNow) * 100) / 100),
        totalAmount: finalAmount,
        gstRate: checkInGstMode === 'non_gst' ? 0 : gstPercent,
        isWithoutGst: checkInGstMode === 'non_gst',
        gstInvoice: checkInGstMode !== 'non_gst',
        roomRateIncludesGst: checkInGstMode === 'including_gst',
        paymentMethod: resolvedMethodLabel as any,
        paymentStatus:
          totalCollectedNow >= finalAmount && finalAmount > 0
            ? 'Paid'
            : totalCollectedNow > 0
            ? 'Partially Paid'
            : 'Unpaid',
        payments: reservationPayments,
        bookedRooms: bookedRoomsPayload,
        bookedServices: bookedServicesPayload.length > 0 ? bookedServicesPayload : undefined,
        hasExtraBed: !isMulti ? Boolean(hasExtraBed) : groupRooms.some(g => g.hasExtraBed),
        extraBedCount: !isMulti && hasExtraBed ? singleExtraCalc.extraBedQty : 0,
        extraBedRate: !isMulti && hasExtraBed ? singleExtraCalc.extraBedRate : 0,
        extraBedNights: !isMulti && hasExtraBed ? singleExtraCalc.extraBedNights : undefined,
        extraBedTotal: effectiveExtraBedTotal,
        hasExtraPerson: Boolean(applyExtraPersonCharge),
        extraPersonCount: applyExtraPersonCharge ? Math.max(1, Number(extraPersonQty) || 1) : 0,
        extraPersonRate: applyExtraPersonCharge ? effectiveExtraPaxRate : 0,
        extraPersonNights: applyExtraPersonCharge ? effectiveExtraPaxNights : undefined,
        extraPersonChargeApplied: effectiveExtraPersonChargesTotal,
        groupBookingId: isMulti ? newResId : undefined,
        specialRequests: notesPieces.join(' | ') || undefined,
        createdAt: new Date().toISOString(),
      } as Booking;

      // Verify backend health before confirming inline success
      try {
        const res = await fetch('/api/health');
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
      } catch (netErr: any) {
        showToast(
          `Backend server did not confirm the booking (${netErr?.message || 'connection failed'}). Please retry.`,
          'error'
        );
        return;
      }

      const nextBookings = bookings.some(b => b.id === newResId)
        ? bookings.map(b => (b.id === newResId ? newBookingRecord : b))
        : [newBookingRecord, ...bookings];
      onUpdateBookings(nextBookings);
      // Remember this booking ID for this form session so Draft -> Waitlist -> Confirm / Check-In
      // converts the SAME booking in-place instead of creating duplicate room bookings!
      setActiveSessionBookingId(newResId);

      const resolvedLabel =
        actionLabelOverride ||
        (targetStatus === 'Draft'
          ? 'Draft Saved'
          : targetStatus === 'Waiting'
          ? 'Added to Waitlist'
          : isFutureAdvanceArrival
          ? 'Advance Booking Confirmed'
          : 'Reservation Confirmed');

      onAddAuditLog(
        resolvedLabel,
        `${resolvedLabel} #${newResId} for ${guestName.trim()} (${allocatedRoomNumbers.join(', ') || 'Room TBD'}, ${formatDdmmyyyy(checkInDate)} → ${formatDdmmyyyy(checkOutDate)}, ₹${finalAmount}).`
      );

      setInlineBookingSuccess({
        id: newResId,
        actionLabel: resolvedLabel,
        guestName: guestName.trim(),
        roomsLabel: allocatedRoomNumbers.length > 0 ? allocatedRoomNumbers.join(', ') : 'Unassigned',
        checkInDate,
        checkOutDate,
        totalAmount: finalAmount,
        paidAmount: totalCollectedNow,
        status: targetStatus,
      });

      showToast(
        `${resolvedLabel}: #${newResId} for ${guestName.trim()} (${formatDdmmyyyy(checkInDate)} → ${formatDdmmyyyy(checkOutDate)}).`,
        'success'
      );

      if (targetStatus === 'Confirmed') {
        setSelectedBooking(null);
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSaveCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    // If new booking has a future arrival date, save as Confirmed Advance Booking (never occupy room early!)
    if (isFutureAdvanceArrival && effectiveMode !== 'walkin') {
      await handleCreateReservationAction('Confirmed', 'Advance Booking Confirmed');
      return;
    }

    if (!guestName.trim() || !mobile.trim()) {
      showToast('Missing primary guest attributes: Guest Name and Mobile are required.', 'warning');
      return;
    }

    if (effectiveMode !== 'walkin' && checkInMode === 'single' && !(Number(adults) >= 1)) {
      showToast('Please enter the number of adults (at least 1).', 'warning');
      return;
    }
    const todayIst = getTodayDateStr();
    if (!isEditingExistingDates && !allowBackDatedCheckIn && checkInDate < todayIst) {
      showToast('Past arrival dates cannot be selected for new check-ins.', 'error');
      return;
    }
    if (!checkOutDate || checkOutDate < checkInDate) {
      showToast('Departure date cannot be earlier than arrival date.', 'error');
      return;
    }

    if (!editingCheckIn && totalRequestedWaterBottles > 0) {
      const availWater = Number(waterBottleInventoryProduct?.currentStock ?? 0);
      if (availWater < totalRequestedWaterBottles) {
        showToast(
          availWater <= 0
            ? 'Water Bottle stock in Inventory is 0. Use "+ Add Water Stock to Inventory" in the Water Bottles section, or set bottles to 0.'
            : `Insufficient Water Bottle stock in Inventory (Available: ${availWater}, Requested: ${totalRequestedWaterBottles}). Use "+ Add Water Stock" or reduce bottle quantity.`,
          'error'
        );
        return;
      }
    }

    // 1. Validate Advance Reservation Status (Prevent Cancelled reservations)
    const activeLinkedBooking =
      selectedBooking ||
      (activeSessionBookingId ? bookings.find(b => b.id === activeSessionBookingId) || null : null);
    if (activeLinkedBooking && !editingCheckIn) {
      const currentBookingInState = bookings.find(b => b.id === activeLinkedBooking.id) || activeLinkedBooking;
      const rawSt = String(currentBookingInState.status || '').toLowerCase();
      if (currentBookingInState.status === 'Cancelled' || rawSt === 'cancelled') {
        showToast(`Check-In Blocked: Reservation #${currentBookingInState.id} has been Cancelled and cannot be checked in.`, 'error');
        return;
      }
    }

    // Validate Hybrid / Split Payment if enabled
    if (isHybridCheckInPay && effectiveDeskReceivedNow > 0 && activeCheckInSplits.length < 2) {
      showToast('Hybrid payment requires at least two payment methods with amounts greater than ₹0.', 'error');
      setWizardStep(4);
      return;
    }
    if (advanceAmount + effectiveDeskReceivedNow > finalAmount + 0.5) {
      showToast('Total received payment cannot exceed the final payable settlement amount.', 'error');
      setWizardStep(4);
      return;
    }
    if (settlementEnabled && !settlementReason.trim()) {
      showToast('Please enter Manager Approval / Reason for the negotiated settlement adjustment.', 'warning');
      setWizardStep(4);
      return;
    }

    {
      const badExtraBedRoom =
        checkInMode === 'single'
          ? hasExtraBed && selectedRoomNumber && !isExtraBedAllowedForRoom(selectedRoomNumber)
            ? selectedRoomNumber
            : ''
          : groupRooms.find(g => g.hasExtraBed && !isExtraBedAllowedForRoom(g.roomNumber))?.roomNumber || '';
      if (badExtraBedRoom) {
        showToast(`Room ${badExtraBedRoom} does not allow an extra bed / mattress. Please untick it.`, 'error');
        return;
      }
    }
    if (checkInMode === 'single' && !selectedRoomNumber) {
      showToast('Please select a room allocation.', 'warning');
      return;
    }

    if (checkInMode === 'group' && groupRooms.length === 0) {
      showToast('Group Check-in requires at least one room added to the group allocation.', 'warning');
      return;
    }

    // 2. Walk-In guests are fresh arrivals — never auto-link them to an advance reservation.
    //    Only an explicitly selected advance booking OR a Draft/Waitlist booking created in this exact form session is converted in-place.
    const effectiveBooking: Booking | null = editingCheckIn
      ? (bookings.find(b => b.id === editingCheckIn.id || (editingCheckIn.bookingId && b.id === editingCheckIn.bookingId) || (b.roomNumber === editingCheckIn.roomNumber && b.guestName === editingCheckIn.guestName && !b.isCompleted)) || null)
      : (selectedBooking || (activeSessionBookingId ? bookings.find(b => b.id === activeSessionBookingId) || null : null));

    const prevEditingRooms: string[] = editingCheckIn
      ? [
          editingCheckIn.roomNumber,
          ...(editingCheckIn.bookedRooms || []).map(br => br.roomNumber)
        ].filter(Boolean)
      : [];

    // 3. Validate Room Availability, Readiness, and Active Occupancy for all allocated rooms
    const allocatedRoomNumbers = checkInMode === 'single' ? [selectedRoomNumber] : groupRooms.map(r => r.roomNumber);
    for (const rNum of allocatedRoomNumbers) {
      const roomObj = rooms.find(r => r.number === rNum);
      if (!roomObj) {
        showToast(`Room ${rNum} does not exist in room inventory.`, 'error');
        return;
      }
      const activeOccupant = checkins.find(
        c =>
          !c.checkedOutDateTime &&
          c.id !== (effectiveBooking?.id || '') &&
          c.id !== (editingCheckIn?.id || '') &&
          (c.roomNumber === rNum || (c.bookedRooms || []).some(br => br.roomNumber === rNum))
      );
      if (
        activeOccupant ||
        (roomObj.status === 'Occupied' &&
          effectiveBooking?.roomNumber !== rNum &&
          !prevEditingRooms.includes(rNum))
      ) {
        showToast(
          `Room ${rNum} is currently Occupied${activeOccupant ? ` by ${activeOccupant.guestName}` : ''}. Please select an available room.`,
          'error'
        );
        return;
      }
      if (
        !prevEditingRooms.includes(rNum) &&
        (isRoomOutOfOrderForCheckIn(roomObj) || isRoomDirtyForCheckIn(roomObj))
      ) {
        const stateLabel = isRoomOutOfOrderForCheckIn(roomObj)
          ? roomObj.status
          : roomObj.cleaningStatus || 'Dirty';
        if (!canAuthoriseHkOverride) {
          showToast(
            `Check-In Blocked: Room ${rNum} is currently marked "${stateLabel}" in Housekeeping. Please clean/inspect the room first or request a Manager/Admin override.`,
            'error'
          );
          return;
        }
        if (!hkOverrideApproved || !hkOverrideReason.trim()) {
          showToast(
            `Authorised Override Required: Room ${rNum} is marked "${stateLabel}". Confirm the override checkbox and enter an override reason before checking in.`,
            'warning'
          );
          return;
        }
        onAddAuditLog(
          'Authorised Room Check-In Override',
          `${loggedInUser || currentRole} authorised check-in to Room ${rNum} (${stateLabel}). Reason: ${hkOverrideReason.trim()}`
        );
      }
      const conflictingAdvBooking = getRoomOverlappingBooking(rNum, checkInDate, checkOutDate);
      if (
        conflictingAdvBooking &&
        effectiveBooking?.id !== conflictingAdvBooking.id &&
        !prevEditingRooms.includes(rNum)
      ) {
        showToast(
          `Room ${rNum} is already Advance Booked for ${conflictingAdvBooking.guestName} (${conflictingAdvBooking.checkInDate} → ${conflictingAdvBooking.checkOutDate}). Please select another room or check in that reservation.`,
          'error'
        );
        return;
      }
    }

    const existingIds = new Set([...bookings, ...checkins].map(item => String(item.id || '')));
    const tsSuffix = Number(String(Date.now()).slice(-6));
    let nextCheckInNum = Math.max(1001, tsSuffix);
    while (existingIds.has(`GP-BKG-${nextCheckInNum}`)) {
      nextCheckInNum += 1;
    }

    const resolvedCheckInId = editingCheckIn
      ? editingCheckIn.id
      : effectiveBooking
      ? effectiveBooking.id
      : checkInMode === 'group'
      ? groupBookingId
      : !existingIds.has(walkInPreviewBookingId)
      ? walkInPreviewBookingId
      : `GP-BKG-${nextCheckInNum}`;

    // Build C-Form object if required or foreign nationality
    let cFormDataObj: CFormData | undefined = editingCheckIn?.cFormData;
    if (isCFormRequired || (nationality && nationality.toLowerCase() !== 'indian' && nationality.toLowerCase() !== 'india')) {
      cFormDataObj = {
        id: editingCheckIn?.cFormData?.id || `CFORM-${Date.now()}`,
        checkInId: resolvedCheckInId,
        guestName,
        gender: cFormGender,
        dob: cFormDob,
        nationality,
        passportNumber: idType === 'Passport' ? idNumber : (cFormPassportCountry ? (idNumber || 'PASS-SPECIFIED') : ''),
        passportCountry: cFormPassportCountry || nationality,
        passportIssueDate: cFormPassportIssueDate,
        passportExpiryDate: cFormPassportExpiryDate,
        visaNumber: cFormVisaNumber || 'VISA-PORT-ARRIVAL',
        visaType: cFormVisaType,
        visaIssueDate: cFormVisaIssueDate,
        visaExpiryDate: cFormVisaExpiryDate,
        visaPlaceOfIssue: cFormVisaPlaceOfIssue,
        arrivalDateInIndia: cFormArrivalDateInIndia,
        portOfArrivalInIndia: cFormPortOfArrival,
        addressInHomeCountry: `${cFormAddressInHomeCountry}, ${cFormCityInHomeCountry}, ${cFormCountryInHomeCountry}`,
        cityInHomeCountry: cFormCityInHomeCountry,
        countryInHomeCountry: cFormCountryInHomeCountry,
        purposeOfVisit: cFormPurposeOfVisit,
        nextDestination: cFormNextDestination,
        cFormNumber: editingCheckIn?.cFormData?.cFormNumber || `BOI-${Math.floor(100000 + Math.random() * 900000)}`,
        status: editingCheckIn?.cFormData?.status || 'Generated',
        generatedAt: editingCheckIn?.cFormData?.generatedAt || new Date().toISOString()
      };
    }

    // Convert secondary guests with backwards compatible tracking 
    const finalSecondaryGuests: SecondaryGuest[] = secondaryGuests
      .filter(sg => sg.fullName.trim().length > 0)
      .map(sg => ({
        fullName: sg.fullName.trim(),
        nationality: sg.nationality || 'Indian',
        idType: sg.idType || 'Aadhaar',
        idNumber: sg.idNumber || '',
        aadhaarNumber: sg.idType === 'Aadhaar' ? sg.idNumber : '',
        passportNumber: sg.idType === 'Passport' ? sg.idNumber : '',
        mobile: sg.mobile || '',
        age: sg.age,
        gender: sg.gender,
        address: ''
      }));

    const preservedInStayPayments: PaymentRecord[] = (editingCheckIn?.payments || []).filter(
      p =>
        p &&
        !String(p.id || '').endsWith('-adv') &&
        !String(p.id || '').includes(`PAY-${resolvedCheckInId}-adv`) &&
        !String(p.id || '').includes(`PAY-${resolvedCheckInId}-checkin`)
    );
    const preservedInStayPaidSum = preservedInStayPayments
      .filter(p => p.paymentType !== 'Advance Deposit')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const initialPayments: PaymentRecord[] = [];
    const existingAdvSplitList: any[] = Array.isArray((effectiveBooking as any)?.payments)
      ? (effectiveBooking as any).payments.filter((p: any) => Number(p?.amount) > 0)
      : [];
    const existingAdvSplitSum = existingAdvSplitList.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (advanceAmount > 0) {
      if (existingAdvSplitList.length > 1 && Math.abs(existingAdvSplitSum - advanceAmount) < 1) {
        existingAdvSplitList.forEach((p, idx) => {
          initialPayments.push({
            id: `PAY-${resolvedCheckInId}-adv-${idx + 1}`,
            amount: Number(p.amount) || 0,
            paymentMethod: (p.paymentMethod || effectiveBooking?.paymentMethod || paymentMethod) as any,
            paymentType: 'Advance Deposit',
            dateTime: p.date ? `${p.date}T00:00:00.000Z` : `${getTodayDateStr()}T00:00:00.000Z`,
            date: p.date || effectiveBooking?.bookingDate || getTodayDateStr(),
            notes: p.notes || `Advance carried forward (${p.paymentMethod})`,
          });
        });
      } else {
        initialPayments.push({
          id: `PAY-${resolvedCheckInId}-adv`,
          amount: advanceAmount,
          paymentMethod: (effectiveBooking?.paymentMethod || paymentMethod) as any,
          paymentType: 'Advance Deposit',
          dateTime: effectiveBooking?.bookingDate
            ? `${effectiveBooking.bookingDate}T00:00:00.000Z`
            : `${getTodayDateStr()}T00:00:00.000Z`,
          date: effectiveBooking?.bookingDate || getTodayDateStr(),
          notes: effectiveBooking
            ? `Advance carried forward from reservation ${effectiveBooking.id}`
            : 'Advance deposit during check-in',
        });
      }
    }

    const payDateLocal = paymentDate || getTodayDateStr();
    if (isHybridCheckInPay && activeCheckInSplits.length > 0) {
      activeCheckInSplits.forEach((sp, idx) => {
        initialPayments.push({
          id: `PAY-${resolvedCheckInId}-checkin-sp-${idx + 1}`,
          amount: Number(sp.amount) || 0,
          paymentMethod: sp.method as any,
          paymentType: 'Partial Payment',
          dateTime: `${payDateLocal}T12:00:00`,
          date: payDateLocal,
          notes: `Check-in Hybrid Payment (${sp.method}${(sp.ref || (sp as any).reference || '').trim() ? ` • Ref: ${(sp.ref || (sp as any).reference || '').trim()}` : ''})`,
        });
      });
    } else if (effectiveDeskReceivedNow > 0) {
      initialPayments.push({
        id: `PAY-${resolvedCheckInId}-checkin`,
        amount: effectiveDeskReceivedNow,
        paymentMethod: paymentMethod as any,
        paymentType: 'Partial Payment',
        dateTime: `${payDateLocal}T12:00:00`,
        date: payDateLocal,
        notes:
          paymentNotes.trim() ||
          (singlePaymentRef.trim()
            ? `Check-in payment received (Ref: ${singlePaymentRef.trim()})`
            : 'Check-in payment received at desk'),
      });
    }
    initialPayments.push(...preservedInStayPayments);

    const effectivePendingBalance = Math.max(
      0,
      Math.round((finalAmount - advanceAmount - effectiveDeskReceivedNow - preservedInStayPaidSum) * 100) / 100
    );
    const resolvedSummaryPaymentMethod: any =
      isHybridCheckInPay && activeCheckInSplits.length > 0
        ? activeCheckInSplits.map(sp => `${sp.method} ₹${sp.amount}`).join(' + ')
        : paymentMethod;
    const cashDeskNow = isHybridCheckInPay
      ? activeCheckInSplits
          .filter(sp => sp.method === 'Cash')
          .reduce((s, sp) => s + (Number(sp.amount) || 0), 0)
      : paymentMethod === 'Cash'
      ? effectiveDeskReceivedNow
      : 0;
    const onlineDeskNow = Math.max(0, effectiveDeskReceivedNow - cashDeskNow);

    // Construct booked rooms list with agreed negotiated rate directly as originalRate
    const finalBookedRooms: BookedRoom[] = checkInMode === 'single'
      ? [
          {
            roomNumber: selectedRoomNumber,
            category: roomType as any,
            rate: roomRate,
            originalRate: roomRate,
            discountAmountOfRoom: (discountEnabled || manualDiscount > 0) ? totalEffectiveDiscount : 0,
            guestsCount: totalOccupants,
            extraGuestsCount,
            extraPersonChargeApplied: extraPersonChargesTotal,
            totalRoomAmount: finalAmount,
            hasExtraBed,
            extraBedCount,
            extraBedRate,
            extraBedTotal
          }
        ]
      : groupRooms.map(gr => ({
          roomNumber: gr.roomNumber,
          category: gr.category as any,
          rate: gr.rate,
          originalRate: gr.rate,
          discountAmountOfRoom: 0,
          guestsCount: gr.adults + gr.children,
          extraGuestsCount: Math.max(0, (gr.adults + gr.children) - 2),
          extraPersonChargeApplied: 0,
          totalRoomAmount: (gr.rate + (gr.hasExtraBed ? gr.extraBedCount * gr.extraBedRate : 0)) * stayNights,
          hasExtraBed: gr.hasExtraBed,
          extraBedCount: gr.extraBedCount,
          extraBedRate: gr.extraBedRate,
          extraBedTotal: gr.hasExtraBed ? gr.extraBedCount * gr.extraBedRate * stayNights : 0,
          guestName: gr.assignedGuestName || guestName,
          guestMobile: gr.assignedGuestMobile || mobile
        }));

    const primaryRoom = checkInMode === 'single' ? selectedRoomNumber : (groupRooms[0]?.roomNumber || '101');

    // Optional hotel services ticked by the admin at check-in (added to the bill only when ticked)
    const nowIsoSrv = new Date().toISOString();
    const isFormService = (id?: string) => String(id || '').startsWith('ALLOC-CHK-');
    const isFormAux = (id?: string) => String(id || '').startsWith('AUX-CHK-') || String(id || '').startsWith('ADDON-CHK-');
    const preservedExtraCharges: ExtraCharge[] = (editingCheckIn?.extraCharges || []).filter(
      ec => !isFormService(ec.id) && !isFormAux(ec.id)
    );
    // Carry forward any pre-arrival folio / POS charges stored on selectedBooking.otherServices so they stay on the live GuestCheckIn folio
    const bookingOtherServicesList: any[] = Array.isArray((effectiveBooking as any)?.otherServices)
      ? (effectiveBooking as any).otherServices
      : [];
    bookingOtherServicesList.forEach(sv => {
      if (!sv || sv.isPaid === true) return;
      const svId = String(sv.id || sv.orderNumber || '').trim();
      if (!svId) return;
      const alreadyInExtra = preservedExtraCharges.some(
        ec => ec.id === svId || ec.sourceId === svId
      );
      if (!alreadyInExtra && Number(sv.amount) > 0) {
        const svTypeLower = String(sv.serviceType || sv.description || '').toLowerCase();
        const resolvedCat: ExtraCharge['category'] = svTypeLower.includes('food') || svTypeLower.includes('room service') || svId.startsWith('pos-')
          ? 'Food'
          : svTypeLower.includes('laundry')
          ? 'Laundry'
          : 'Other';
        preservedExtraCharges.push({
          id: svId,
          category: resolvedCat,
          description: String(sv.description || sv.itemsSummary || sv.serviceType || 'Room Service'),
          amount: Number(sv.amount) + (Number(sv.taxAmount) || 0),
          taxAmount: Number(sv.taxAmount) || 0,
          dateTime: String(sv.dateTime || nowIsoSrv),
          sourceType: resolvedCat === 'Food' ? 'pos_order' : undefined,
          sourceId: svId,
        } as any);
      }
    });
    const preservedAllocatedServices: AllocatedGuestService[] = (editingCheckIn?.allocatedServices || []).filter(s => !isFormService(s.id));
    const stayServiceAllocations: AllocatedGuestService[] = tickedServices.map(s => {
      const qty = Math.max(1, Number(serviceQtyMap[String(s.id)] ?? 1) || 1);
      return {
        id: `ALLOC-CHK-${s.id}`,
        serviceId: String(s.id),
        serviceName: qty > 1 ? `${String(s.serviceName || 'Service')} × ${qty}` : String(s.serviceName || 'Service'),
        configuredAmount: serviceAmountOf(s),
        chargedAmount: serviceLineTotalOf(s),
        isChargeable: true,
        roomNumber: primaryRoom,
        checkInId: resolvedCheckInId,
        guestName,
        allocatedBy: loggedInUser || 'Reception Desk',
        dateTime: nowIsoSrv
      };
    });
    const stayServiceExtraCharges: ExtraCharge[] = stayServiceAllocations
      .filter(a => a.chargedAmount > 0)
      .map(a => ({
        id: a.id,
        category: 'Other' as const,
        description: `${a.serviceName} (Room ${primaryRoom})`,
        amount: a.chargedAmount,
        dateTime: nowIsoSrv,
        sourceType: 'guest_service' as const,
        sourceId: a.id
      }));
    if (customAddonSingleTotal > 0) {
      stayServiceExtraCharges.push({
        id: `ADDON-CHK-${resolvedCheckInId}`,
        category: 'Other' as const,
        description: `${customAddonLabel.trim()} × ${Math.max(1, Number(customAddonQty) || 1)}${customAddonNotes.trim() ? ` (${customAddonNotes.trim()})` : ''}`,
        amount: customAddonSingleTotal,
        dateTime: nowIsoSrv,
      });
    }
    customExtraRowCharges.forEach(c => {
      stayServiceExtraCharges.push({
        id: `${c.id}-${resolvedCheckInId}`,
        category: 'Other' as const,
        description: c.description,
        amount: c.amount,
        dateTime: nowIsoSrv,
      });
    });
    if (otherCharges > 0) {
      stayServiceExtraCharges.push({
        id: `AUX-CHK-${resolvedCheckInId}`,
        category: 'Other' as const,
        description: `Auxiliary Charges (Room ${primaryRoom})`,
        amount: otherCharges,
        dateTime: nowIsoSrv
      });
    }
    const chgWaterRecordId =
      !editingCheckIn && chargeableWaterBottles > 0 && chargeableWaterTotal > 0
        ? `WB-CHG-${Date.now()}`
        : '';
    if (chgWaterRecordId && chargeableWaterBottles > 0 && chargeableWaterTotal > 0) {
      stayServiceExtraCharges.push({
        id: `EC-WB-${chgWaterRecordId}`,
        category: 'Water Bottle',
        description: `Water Bottles (${chargeableWaterBottles} × ₹${effectiveChargeableWaterRate})`,
        amount: chargeableWaterTotal,
        dateTime: nowIsoSrv,
        sourceType: 'water_bottle',
        sourceId: chgWaterRecordId,
      });
    }

    const activeHotelId = editingCheckIn?.hotelId || effectiveBooking?.hotelId || hotelSettings?.id || '';
    const resolvedAgentLabel = selectedAgentObj
      ? `${selectedAgentObj.name}${selectedAgentObj.agencyName && selectedAgentObj.agencyName !== selectedAgentObj.name ? ` (${selectedAgentObj.agencyName})` : ''}`
      : undefined;
    const rawSessionUser = (
      loggedInUser ||
      (typeof window !== 'undefined'
        ? sessionStorage.getItem('pms_user') || localStorage.getItem('pms_user') || ''
        : '')
    ).trim();
    const matchedStaffActor = rawSessionUser
      ? staff.find(
          s =>
            s.username?.toLowerCase() === rawSessionUser.toLowerCase() ||
            s.name?.toLowerCase() === rawSessionUser.toLowerCase()
        )
      : undefined;
    const autoDetectedCheckedInBy = editingCheckIn?.checkedInBy
      ? editingCheckIn.checkedInBy
      : matchedStaffActor
      ? `${matchedStaffActor.name} (${matchedStaffActor.username})`
      : rawSessionUser || currentRole || 'Admin';

    const autoNowIso = new Date().toISOString();
    const autoNowDateStr = getTodayDateStr();
    const autoNowTimeStr = getCurrentTimeStr();
    const combinedPrimaryAddr = [address.trim(), addressLine2.trim(), pincode.trim() ? `PIN: ${pincode.trim()}` : '']
      .filter(Boolean)
      .join(', ');
    const composedGuestAddress = composeFullAddress(combinedPrimaryAddr, city, state, country);
    const resolvedCheckInTimestamp = editingCheckIn?.checkInTimestamp || `${autoNowDateStr} • ${autoNowTimeStr}`;
    const resolvedWalkInSource: BookingSource =
      selectedAgentId && walkInBookingSource === 'Walk-in' ? 'Travel Agent' : walkInBookingSource;

    const existingGrcNums = [
      ...checkins.map(c => (c as any).grcNumber as string | undefined),
      ...bookings.map(b => (b as any).grcNumber as string | undefined),
    ];
    const allocatedGrcNo =
      String((editingCheckIn as any)?.grcNumber || (effectiveBooking as any)?.grcNumber || '').trim() ||
      allocateGrcNumber(existingGrcNums, billSettings);

    const newCheckIn: GuestCheckIn = {
      ...(editingCheckIn || {}),
      id: resolvedCheckInId,
      grcNumber: allocatedGrcNo,
      hotelId: activeHotelId,
      guestName,
      dob: dob || undefined,
      mobile,
      emailAddress: emailAddress || undefined,
      address: composedGuestAddress,
      city,
      state,
      nationality,
      country,
      idType,
      idNumber,
      aadhaarNumber: idType === 'Aadhaar' ? idNumber : '',
      passportNumber: idType === 'Passport' ? idNumber : (cFormDataObj?.passportNumber || ''),
      companyName: companyName || undefined,
      gstNumber: gstNumber || undefined,
      purposeOfVisit: purposeOfVisit || undefined,
      comingFrom: comingFrom || undefined,
      goingTo: goingTo || undefined,
      arrivalDateInIndia: arrivalDateInIndia || undefined,
      durationOfStayInIndia: durationOfStayInIndia || undefined,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      maleCount: Number(maleCount) || 0,
      femaleCount: Number(femaleCount) || 0,
      childCount: Number(childCount) || 0,
      roomType: roomType || undefined,
      paymentMethod: paymentMethod || undefined,
      mealPlan,
      voucherNumber: voucherNumber || undefined,
      travelAgentId: selectedAgentId || undefined,
      travelAgentName: resolvedAgentLabel,
      commissionType: selectedAgentId ? commissionType : undefined,
      commissionValue: selectedAgentId ? commissionValue : undefined,
      commissionAmount: selectedAgentId ? computedAgentCommission : undefined,
      idProofFileName: idProofFileName || undefined,
      idProofFileData: idProofFileData || undefined,
      depositBalance: editingCheckIn ? editingCheckIn.depositBalance : 0,
      payments: initialPayments,
      extraCharges: [...preservedExtraCharges, ...stayServiceExtraCharges],
      allocatedServices:
        preservedAllocatedServices.length + stayServiceAllocations.length > 0
          ? [...preservedAllocatedServices, ...stayServiceAllocations]
          : undefined,
      checkInDate,
      checkOutDate,
      arrivalTime,
      departureTime,
      isHourlyStay: checkInDate === checkOutDate,
      isBackDated: checkInDate < getTodayDateStr() || (checkInDate === getTodayDateStr() && to24hTime(arrivalTime, getIstNowParts().hhmm) < getIstNowParts().hhmm),
      actualLoggedAt: new Date().toISOString(),
      stayHours: checkInDate === checkOutDate ? (Number(stayHours) || computedStayHours || 3) : undefined,
      isEarlyCheckIn: earlyCheckInInfo.isEarly,
      earlyCheckInHours: earlyCheckInInfo.earlyHours,
      earlyCheckInCharge: earlyCheckInCharge,
      numGuests: checkInMode === 'single' ? Math.max(totalOccupants, 1 + finalSecondaryGuests.length) : groupTotalGuests,
      roomNumber: checkInMode === 'group' ? groupRooms.map(gr => gr.roomNumber).join(', ') : primaryRoom,
      roomRate: checkInMode === 'single' ? roomRate : (groupRoomChargesPerNight / (groupRooms.length || 1)),
      originalRate:
        checkInMode === 'single'
          ? roomRate
          : groupRooms.reduce((s, gr) => s + (Number(gr.rate) || 0), 0) /
            Math.max(1, groupRooms.length),
      discount: (discountEnabled || manualDiscount > 0 || settlementEnabled) ? totalEffectiveDiscount : 0,
      discountAmount: (discountEnabled || manualDiscount > 0 || settlementEnabled) ? totalEffectiveDiscount : 0,
      overrideReason: settlementEnabled
        ? settlementReason.trim()
        : discountEnabled && discountReason.trim()
        ? discountReason.trim()
        : editingCheckIn?.overrideReason,
      extraPersonChargeApplied: effectiveExtraPersonChargesTotal,
      extraPersonChargesApplied: effectiveExtraPersonChargesTotal,
      hasExtraPerson: Boolean(applyExtraPersonCharge),
      extraPersonCount: applyExtraPersonCharge ? Math.max(1, Number(extraPersonQty) || 1) : 0,
      extraPersonRate: applyExtraPersonCharge ? effectiveExtraPaxRate : 0,
      extraPersonNights: applyExtraPersonCharge ? effectiveExtraPaxNights : 0,
      roomSubtotal: effectiveRoomChargesTotal,
      totalAmount: finalAmount,
      gstRate: checkInGstMode === 'non_gst' ? 0 : gstPercent,
      gstAmount: gstTax,
      isWithoutGst: checkInGstMode === 'non_gst',
      roomRateIncludesGst: checkInGstMode === 'including_gst',
      advanceAmount: advanceAmount,
      cashAmountPaid: cashDeskNow,
      onlineAmountPaid: onlineDeskNow,
      pendingAmount: effectivePendingBalance,
      dateTime: editingCheckIn?.dateTime || autoNowIso,
      secondaryGuests: finalSecondaryGuests,
      bookedRooms: finalBookedRooms,
      checkedInBy: autoDetectedCheckedInBy,
      checkInTimestamp: resolvedCheckInTimestamp,
      bookingDate: effectiveBooking
        ? (effectiveBooking.bookingDate || checkInDate)
        : (editingCheckIn?.bookingDate || walkInBookingDate || getTodayDateStr()),
      bookingSource: effectiveBooking
        ? effectiveBooking.bookingSource
        : (editingCheckIn?.bookingSource || resolvedWalkInSource),
      bookingStatus: effectiveBooking
        ? ('Confirmed' as BookingStatus)
        : (editingCheckIn?.bookingStatus || walkInBookingStatus),
      // Group Details
      isGroupCheckIn: checkInMode === 'group',
      groupBookingId: checkInMode === 'group' ? groupBookingId : undefined,
      groupName: checkInMode === 'group' ? (groupName || `${guestName} Group`) : undefined,
      // Extra Bed Details (explicitly zeroed when unchecked so previous values never linger)
      hasExtraBed: checkInMode === 'single' ? Boolean(hasExtraBed) : groupRooms.some(g => g.hasExtraBed),
      extraBedCount: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedQty : 0,
      extraBedRate: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedRate : 0,
      extraBedNights: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedNights : 0,
      extraBedTotal: effectiveExtraBedTotal,
      // C-Form Details
      cFormData: cFormDataObj,
      isCFormRequired: !!cFormDataObj,
      isCFormSubmitted: editingCheckIn?.isCFormSubmitted || false,
      checkedOutDateTime: editingCheckIn ? editingCheckIn.checkedOutDateTime : undefined,
      checkedOutBy: editingCheckIn ? editingCheckIn.checkedOutBy : undefined,
    };

    // Update Room statuses: free previous rooms if room was changed during edit, and set new allocated rooms to Occupied (unless already checked out)
    const isAlreadyCheckedOut = Boolean(editingCheckIn?.checkedOutDateTime);
    const updatedRooms = rooms.map(r => {
      if (!isAlreadyCheckedOut && allocatedRoomNumbers.includes(r.number)) {
        return { ...r, status: 'Occupied' as const, cleaningStatus: 'Clean' as const };
      }
      if (
        editingCheckIn &&
        prevEditingRooms.includes(r.number) &&
        !allocatedRoomNumbers.includes(r.number)
      ) {
        return { ...r, status: 'Available' as const };
      }
      return r;
    });
    onUpdateRooms(updatedRooms);

    // Update existing reservation or create mirrored walk-in booking record (never duplicate an existing reservation)
    if (effectiveBooking) {
      const updatedBkgs = bookings.map(b => 
        b.id === effectiveBooking.id 
          ? { 
              ...b, 
              hotelId: b.hotelId || activeHotelId,
              isCheckedIn: true, 
              isCompleted: false,
              status: b.status === 'Cancelled' ? b.status : ('Confirmed' as const),
              guestName,
              dob: dob || b.dob,
              mobile,
              email: emailAddress || b.email,
              emailAddress: emailAddress || b.emailAddress,
              aadhaarNumber: idType === 'Aadhaar' ? idNumber : (b.aadhaarNumber || ''),
              passportNumber: idType === 'Passport' ? idNumber : (b.passportNumber || ''),
              address: composeFullAddress(address, city, state) || b.address,
              nationality: nationality || b.nationality,
              purposeOfVisit: purposeOfVisit || b.purposeOfVisit,
              comingFrom: comingFrom || b.comingFrom,
              goingTo: goingTo || b.goingTo,
              arrivalDateInIndia: arrivalDateInIndia || b.arrivalDateInIndia,
              durationOfStayInIndia: durationOfStayInIndia || b.durationOfStayInIndia,
              maleCount: Number(maleCount) || 0,
              femaleCount: Number(femaleCount) || 0,
              childCount: Number(childCount) || 0,
              mealPlan,
              voucherNumber: voucherNumber || b.voucherNumber,
              travelAgentId: selectedAgentId || b.travelAgentId,
              travelAgentName: resolvedAgentLabel || b.travelAgentName,
              commissionType: selectedAgentId ? commissionType : b.commissionType,
              commissionValue: selectedAgentId ? commissionValue : b.commissionValue,
              commissionAmount: selectedAgentId ? computedAgentCommission : b.commissionAmount,
              checkInDate,
              checkOutDate,
              nights: isSameDayStay ? 1 : stayNights,
              isHourlyStay: isSameDayStay,
              stayHours: isSameDayStay ? (Number(stayHours) || computedStayHours || 3) : undefined,
              adults: Number(adults) || 1,
              children: Number(children) || 0,
              roomNumber: checkInMode === 'group' ? groupRooms.map(gr => gr.roomNumber).join(', ') : primaryRoom,
              roomType: (roomType || b.roomType) as any,
              bookedRooms: finalBookedRooms,
              isGroupCheckIn: checkInMode === 'group',
              roomSubtotal: effectiveRoomChargesTotal,
              bookingAmount: effectiveRoomChargesTotal,
              hasExtraBed: checkInMode === 'single' ? Boolean(hasExtraBed) : groupRooms.some(g => g.hasExtraBed),
              extraBedCount: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedQty : 0,
              extraBedRate: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedRate : 0,
              extraBedNights: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedNights : 0,
              extraBedTotal: effectiveExtraBedTotal,
              hasExtraPerson: Boolean(applyExtraPersonCharge),
              extraPersonCount: applyExtraPersonCharge ? Math.max(1, Number(extraPersonQty) || 1) : 0,
              extraPersonRate: applyExtraPersonCharge ? effectiveExtraPaxRate : 0,
              extraPersonNights: applyExtraPersonCharge ? effectiveExtraPaxNights : 0,
              extraPersonChargeApplied: effectiveExtraPersonChargesTotal,
              earlyCheckInCharge: earlyCheckInCharge,
              gstRate: checkInGstMode === 'non_gst' ? 0 : gstPercent,
              gstAmount: gstTax,
              isWithoutGst: checkInGstMode === 'non_gst',
              gstInvoice: checkInGstMode !== 'non_gst',
              roomRateIncludesGst: checkInGstMode === 'including_gst',
              // Preserve existing reservation advance payment record without overwriting or double-charging
              advanceAmount: Number(b.advanceAmount) > 0 ? Number(b.advanceAmount) : advanceAmount,
              paymentMethod: b.paymentMethod || paymentMethod,
              payments: initialPayments.map((p, idx) => ({
                id: p.id || `pay-ci-${b.id}-${idx + 1}`,
                bookingId: b.id,
                amount: Number(p.amount) || 0,
                paymentMethod: p.paymentMethod,
                paymentType: p.paymentType,
                date: (p as any).date || getTodayDateStr(),
                notes: p.notes,
              })),
              paymentStatus: (
                effectivePendingBalance <= 0
                  ? 'Fully Paid'
                  : advanceAmount + effectiveDeskReceivedNow > 0
                  ? 'Partially Paid'
                  : 'Unpaid'
              ) as Booking['paymentStatus'],
              companyName: companyName || undefined, 
              gstNumber: gstNumber || undefined,
              checkedInBy: autoDetectedCheckedInBy,
              checkInTimestamp: resolvedCheckInTimestamp
            } 
          : b
      );
      onUpdateBookings(updatedBkgs);
    } else {
      // Create mirrored walk-in booking record
      const mirroredBooking: Booking = {
        id: newCheckIn.id,
        hotelId: activeHotelId,
        guestName,
        dob: dob || undefined,
        mobile,
        email: emailAddress || 'direct.walkin@grandpavilion.in',
        emailAddress: emailAddress || undefined,
        aadhaarNumber: idType === 'Aadhaar' ? idNumber : '',
        passportNumber: idType === 'Passport' ? idNumber : '',
        address: composeFullAddress(address, city, state),
        nationality,
        purposeOfVisit: purposeOfVisit || undefined,
        comingFrom: comingFrom || undefined,
        goingTo: goingTo || undefined,
        arrivalDateInIndia: arrivalDateInIndia || undefined,
        durationOfStayInIndia: durationOfStayInIndia || undefined,
        maleCount: Number(maleCount) || 0,
        femaleCount: Number(femaleCount) || 0,
        childCount: Number(childCount) || 0,
        mealPlan,
        voucherNumber: voucherNumber || undefined,
        travelAgentId: selectedAgentId || undefined,
        travelAgentName: resolvedAgentLabel,
        commissionType: selectedAgentId ? commissionType : undefined,
        commissionValue: selectedAgentId ? commissionValue : undefined,
        commissionAmount: selectedAgentId ? computedAgentCommission : undefined,
        checkInDate,
        checkOutDate,
        nights: stayNights,
        adults: Number(adults) || 1,
        children: Number(children) || 0,
        roomNumber: checkInMode === 'group' ? groupRooms.map(gr => gr.roomNumber).join(', ') : primaryRoom,
        roomType: roomType as any,
        bookedRooms: finalBookedRooms,
        isGroupCheckIn: checkInMode === 'group',
        bookingDate: walkInBookingDate || getTodayDateStr(),
        roomSubtotal: effectiveRoomChargesTotal,
        bookingAmount: effectiveRoomChargesTotal,
        hasExtraBed: checkInMode === 'single' ? Boolean(hasExtraBed) : groupRooms.some(g => g.hasExtraBed),
        extraBedCount: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedQty : 0,
        extraBedRate: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedRate : 0,
        extraBedNights: checkInMode === 'single' && hasExtraBed ? singleExtraCalc.extraBedNights : 0,
        extraBedTotal: effectiveExtraBedTotal,
        hasExtraPerson: Boolean(applyExtraPersonCharge),
        extraPersonCount: applyExtraPersonCharge ? Math.max(1, Number(extraPersonQty) || 1) : 0,
        extraPersonRate: applyExtraPersonCharge ? effectiveExtraPaxRate : 0,
        extraPersonNights: applyExtraPersonCharge ? effectiveExtraPaxNights : 0,
        extraPersonChargeApplied: effectiveExtraPersonChargesTotal,
        earlyCheckInCharge: earlyCheckInCharge,
        gstRate: checkInGstMode === 'non_gst' ? 0 : gstPercent,
        gstAmount: gstTax,
        isWithoutGst: checkInGstMode === 'non_gst',
        gstInvoice: checkInGstMode !== 'non_gst',
        roomRateIncludesGst: checkInGstMode === 'including_gst',
        advanceAmount: advanceAmount + effectiveDeskReceivedNow,
        paymentMethod: (isHybridCheckInPay && activeCheckInSplits.length > 0 ? activeCheckInSplits[0].method : paymentMethod) as PaymentMethod,
        payments: initialPayments.map((p, idx) => ({
          id: p.id || `pay-wi-${newCheckIn.id}-${idx + 1}`,
          bookingId: newCheckIn.id,
          amount: Number(p.amount) || 0,
          paymentMethod: p.paymentMethod,
          paymentType: p.paymentType,
          date: (p as any).date || getTodayDateStr(),
          notes: p.notes,
        })),
        bookingSource: resolvedWalkInSource,
        status: 'Confirmed',
        paymentStatus:
          effectivePendingBalance <= 0
            ? 'Fully Paid'
            : advanceAmount + effectiveDeskReceivedNow > 0
            ? 'Partially Paid'
            : 'Unpaid',
        isCheckedIn: true,
        companyName: companyName || undefined,
        gstNumber: gstNumber || undefined,
        checkedInBy: autoDetectedCheckedInBy,
        checkInTimestamp: resolvedCheckInTimestamp
      };
      onUpdateBookings([...bookings.filter(b => b.id !== mirroredBooking.id), mirroredBooking]);
    }

    // Save check-in (replace if same ID existed, otherwise append)
    const updatedCheckinsList = [
      ...checkins.filter(c => c.id !== newCheckIn.id),
      newCheckIn
    ];
    onUpdateCheckins(updatedCheckinsList);

    // Generate or update GST Tax Invoice / Folio immediately for this check-in
    // STRICT RULE: If an invoice was ALREADY generated for this booking with a different GST/No-GST mode,
    // NEVER edit or flip GST on that existing invoice — generate a SEPARATE invoice instead!
    const existingPrimaryInvForStay = (invoices || []).find(
      i => !i.isSeparateInvoice && (i.bookingId === newCheckIn.id || i.checkInId === newCheckIn.id)
    );
    const existingInvIsNoGst = existingPrimaryInvForStay
      ? existingPrimaryInvForStay.isWithoutGst === true ||
        (existingPrimaryInvForStay.gstRate !== undefined && Number(existingPrimaryInvForStay.gstRate) <= 0) ||
        (existingPrimaryInvForStay.gstRate === undefined && Number(existingPrimaryInvForStay.gst || 0) <= 0)
      : false;
    const requestedCheckInNoGst = checkInGstMode === 'non_gst' || gstPercent <= 0;
    const mustCreateSeparateInvAtCheckIn =
      Boolean(existingPrimaryInvForStay) && !editingCheckIn && existingInvIsNoGst !== requestedCheckInNoGst;

    const totalCollected = advanceAmount + effectiveDeskReceivedNow + preservedInStayPaidSum;
    const activeConditions = normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
      ...hotelSettings,
      isGstEnabled: hotelSettings?.isGstEnabled ?? true,
      defaultGstRate: gstPercent
    });

    const evalResult = evaluateAndBuildInvoice({
      hotelId: activeHotelId,
      hotelSettings,
      booking: effectiveBooking,
      checkin: newCheckIn,
      rooms,
      waterBottles,
      posOrders,
      existingInvoices: invoices || [],
      conditions: activeConditions,
      isManualAction: true,
      triggerContext: 'checkin',
      invoiceType: requestedCheckInNoGst ? 'Bill of Supply' : 'Booking Invoice',
      overrideGstRate: gstPercent,
      overrideDiscount: (discountEnabled || manualDiscount > 0 || settlementEnabled) ? totalEffectiveDiscount : 0,
      overrideAdvancePaid: totalCollected,
      overridePaymentMethod: String(resolvedSummaryPaymentMethod),
      createSeparateInvoice: mustCreateSeparateInvAtCheckIn,
      parentInvoiceId: mustCreateSeparateInvAtCheckIn ? existingPrimaryInvForStay?.id : undefined,
    });

    if (evalResult.invoice && onUpdateInvoices) {
      const invToSave: Invoice = {
        ...evalResult.invoice,
        hotelId: activeHotelId,
        advancePaid: totalCollected,
        amountPaid: totalCollected,
        pendingAmount: Math.max(0, parseFloat(((evalResult.invoice.finalAmount || finalAmount) - totalCollected).toFixed(2))),
        isPaid: (evalResult.invoice.finalAmount || finalAmount) - totalCollected <= 0,
        paymentStatus:
          (evalResult.invoice.finalAmount || finalAmount) - totalCollected <= 0
            ? 'Paid'
            : totalCollected > 0
            ? 'Partially Paid'
            : 'Unpaid',
        paymentMethod: resolvedSummaryPaymentMethod,
        ...(initialPayments.length >= 1
          ? {
              paymentHistory: initialPayments
                .filter(p => p && Number(p.amount) > 0)
                .map(p => ({
                  id: p.id,
                  amount: Number(p.amount) || 0,
                  paymentMethod: String(p.paymentMethod || 'Cash') as any,
                  date: String((p as any).date || getTodayDateStr()).slice(0, 10),
                  notes: p.notes,
                })),
            }
          : {}),
      };
      const updatedInvoicesList = mustCreateSeparateInvAtCheckIn
        ? [invToSave, ...(invoices || [])]
        : [
            ...(invoices || []).filter(
              i =>
                i.id !== invToSave.id &&
                (Boolean(i.isSeparateInvoice) || i.bookingId !== newCheckIn.id)
            ),
            invToSave
          ];
      onUpdateInvoices(updatedInvoicesList);
    }

    // Water Bottle (Complimentary + Chargeable) inventory deduction & logging
    if (!editingCheckIn && totalRequestedWaterBottles > 0) {
      if (waterBottleInventoryProduct && onUpdateInventoryProducts) {
        const prevStock = Number(waterBottleInventoryProduct.currentStock) || 0;
        const newStock = Math.max(0, prevStock - totalRequestedWaterBottles);
        const minAlert = Number((waterBottleInventoryProduct as any).minStockAlert ?? 5) || 5;
        const newStatus: InventoryProduct['status'] =
          newStock <= 0 ? 'Out of Stock' : newStock <= minAlert ? 'Low Stock' : 'In Stock';

        onUpdateInventoryProducts(
          (inventoryProducts || []).map(p =>
            p.id === waterBottleInventoryProduct.id
              ? { ...p, currentStock: newStock, status: newStatus, lastUpdated: new Date().toISOString() }
              : p
          )
        );

        if (onUpdateInventoryMovements && inventoryStockMovements) {
          const noteParts: string[] = [];
          if (complimentaryWaterBottles > 0) noteParts.push(`${complimentaryWaterBottles} Complimentary`);
          if (chargeableWaterBottles > 0) noteParts.push(`${chargeableWaterBottles} Chargeable @ ₹${effectiveChargeableWaterRate}`);
          const movement = {
            id: `MOV-WB-CI-${Date.now()}`,
            productId: waterBottleInventoryProduct.id,
            productName: waterBottleInventoryProduct.name,
            type: 'OUT' as const,
            quantity: totalRequestedWaterBottles,
            previousStock: prevStock,
            newStock,
            date: checkInDate,
            time: new Date().toLocaleTimeString(),
            referenceType: 'Housekeeping' as any,
            referenceId: newCheckIn.id,
            notes: `Water Bottles (${noteParts.join(' + ')}) issued at Check-In for Room ${primaryRoom} (${guestName})`,
            performedBy: autoDetectedCheckedInBy,
            hotelId: activeHotelId
          } as unknown as InventoryStockMovement;
          onUpdateInventoryMovements([movement, ...inventoryStockMovements]);
        }

        if (onUpdateWaterBottles && waterBottles) {
          const newWbRecords: WaterBottleRecord[] = [];
          if (complimentaryWaterBottles > 0) {
            newWbRecords.push({
              id: `WB-COMP-${Date.now()}`,
              hotelId: activeHotelId,
              roomNumber: primaryRoom,
              guestName,
              checkInId: newCheckIn.id,
              checkinId: newCheckIn.id,
              bookingId: effectiveBooking?.id,
              quantity: complimentaryWaterBottles,
              type: 'Complimentary',
              isChargeable: false,
              unitPrice: 0,
              totalAmount: 0,
              chargeAmount: 0,
              date: checkInDate,
              dateTime: `${checkInDate} ${arrivalTime}`,
              deliveredBy: autoDetectedCheckedInBy,
            } as WaterBottleRecord);
          }
          if (chargeableWaterBottles > 0) {
            newWbRecords.push({
              id: chgWaterRecordId || `WB-CHG-${Date.now() + 1}`,
              hotelId: activeHotelId,
              roomNumber: primaryRoom,
              guestName,
              checkInId: newCheckIn.id,
              checkinId: newCheckIn.id,
              bookingId: effectiveBooking?.id,
              quantity: chargeableWaterBottles,
              extraChargeableCount: chargeableWaterBottles,
              type: 'Chargeable',
              isChargeable: true,
              unitPrice: effectiveChargeableWaterRate,
              ratePerBottle: effectiveChargeableWaterRate,
              totalAmount: chargeableWaterTotal,
              chargeAmount: chargeableWaterTotal,
              date: checkInDate,
              dateTime: `${checkInDate} ${arrivalTime}`,
              deliveredBy: autoDetectedCheckedInBy,
            } as WaterBottleRecord);
          }
          if (newWbRecords.length > 0) {
            onUpdateWaterBottles([...newWbRecords, ...waterBottles]);
          }
        }

        if (newStock === 0) {
          showToast('Check-In completed! Note: Water Bottle stock in Inventory is now 0 — use "+ Add Water Stock" or Inventory Store to restock.', 'warning');
        } else if (newStock <= minAlert) {
          showToast(`Low Stock Alert: Only ${newStock} water bottle(s) remaining in Inventory.`, 'warning');
        }
      }
    }
    onAddAuditLog(
      editingCheckIn
        ? 'Guest Stay / Walk-In Record Edited'
        : effectiveBooking
        ? 'Advance Reservation Checked In'
        : 'Walk-In Guest Checked In',
      editingCheckIn
        ? `Updated stay details for ${guestName} (${newCheckIn.id}) in Room ${allocatedRoomNumbers.join(', ')} [By ${autoDetectedCheckedInBy}].`
        : `Guest ${guestName} (${newCheckIn.id}) checked in to Room ${allocatedRoomNumbers.join(', ')} for ${stayNights} night(s) [By ${autoDetectedCheckedInBy} at ${resolvedCheckInTimestamp}].`
    );

    if (editingCheckIn) {
      showToast(`Stay & Walk-In details updated for ${guestName} (Room ${primaryRoom}).`, 'success');
    } else if (effectiveBooking) {
      showToast(`Advance Reservation Check-In completed for ${guestName} (Room ${primaryRoom})!`, 'success');
    } else {
      showToast(`Walk-In Guest ${guestName} directly checked in to Room ${primaryRoom}!`, 'success');
    }

    // Set printable card active & inline confirmation after backend check
    setActivePrintDocument(newCheckIn);
    setInlineBookingSuccess({
      id: newCheckIn.id,
      actionLabel: editingCheckIn
        ? 'Stay Updated'
        : effectiveBooking
        ? 'Reservation Check-In Completed'
        : 'Guest Checked In',
      guestName: newCheckIn.guestName,
      roomsLabel: newCheckIn.roomNumber,
      checkInDate: newCheckIn.checkInDate,
      checkOutDate: newCheckIn.checkOutDate,
      totalAmount: newCheckIn.totalAmount || finalAmount,
      paidAmount: Number(newCheckIn.advanceAmount || 0) + Number(newCheckIn.cashAmountPaid || 0) + Number(newCheckIn.onlineAmountPaid || 0),
      status: 'Checked-In',
    });
    setSelectedBooking(null);
    setActiveSessionBookingId(null);
    setEditingCheckIn(null);
    setChargeableWaterBottles(0);
    setComplimentaryWaterBottles(Math.min(2, Math.max(0, availableWaterStock - totalRequestedWaterBottles)));
    setShowQuickAddWaterStock(false);
    waterRateManuallyEditedRef.current = false;
    setWalkInIdSeed(Number(String(Date.now()).slice(-6)) + 1);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Reset fields
    setGuestName('');
    setMobile('');
    setEmailAddress('');
    setAddress('');
    setCity('');
    setState('');
    setCountry('India');
    setNationality('Indian');
    setCompanyName('');
    setGstNumber('');
    setIdProofFileName('');
    setIdProofFileData('');
    setIdType('Aadhaar');
    setIdNumber('');
    setSecondaryGuests([]);
    setSelectedRoomNumber('');
    setApplyExtraPersonCharge(false);
    setManualExtraPaxCount('');
    setAdults(effectiveMode === 'walkin' ? 2 : '');
    setChildren(effectiveMode === 'walkin' ? 0 : '');
    setSelectedServiceIds([]);
    setOtherCharges(0);
    setAdvanceAmount(0);
    setPaidAmount(0);
    setManualDiscount(0);
    setDiscountEnabled(false);
    setDiscountInputValue(0);
    setSettlementEnabled(false);
    setSettlementAdjustmentInput(0);
    setSettlementTargetInput('');
    setSettlementReason('');
    setIsHybridCheckInPay(false);
    setCheckInSplitRows([
      { id: 'chk-split-1', method: 'Cash', amount: 0, reference: '' },
      { id: 'chk-split-2', method: 'UPI', amount: 0, reference: '' },
    ]);
    setWizardStep(1);
    setHasExtraBed(false);
    setExtraBedCount(1);
    setExtraBedRate(500);
    setExtraBedNightsOverride('');
    setApplyExtraPersonCharge(false);
    setExtraPersonQty(1);
    setExtraPersonRateOverride('');
    setExtraPersonNightsOverride('');
    setManualExtraPaxCount('');
    setIsCFormRequired(false);
    setGroupRooms([]);
    setGroupName('');
    setGroupBookingId(`GRP-BKG-${Math.floor(1000 + Math.random() * 9000)}`);
    setDob('');
    setComingFrom('');
    setGoingTo('');
    setArrivalDateInIndia('');
    setDurationOfStayInIndia('');
    setMaleCount(1);
    setFemaleCount(1);
    setChildCount(0);
    setMealPlan('EP');
    setVoucherNumber('');
    setSelectedAgentId('');
    setCommissionType('percentage');
    setCommissionValue(0);
    setGuestSignatureData('');
    setReceptionistSignatureData('');
    setWalkInReservationLookup('');
    setWalkInBookingDate(getTodayDateStr());
    setWizardStep(1);
    setPrimaryGender('');
    setServiceQtyMap({});
    setCustomAddonLabel('');
    setCustomAddonQty(1);
    setCustomAddonRate(0);
    setCustomAddonNotes('');
      setCustomExtraRows([]);
      setServicePriceMap({});
      setExtraPersonRateOverride('');
      userCountTouchedRef.current = false;
      extraChargeTouchedRef.current = false;
    setDiscountEnabled(false);
    setDiscountInputValue(0);
    setDiscountReason('');
    setSettlementEnabled(false);
    setSettlementAdjustmentInput(0);
    setSettlementTargetInput('');
    setSettlementReason('');
    setIsHybridCheckInPay(false);
    setCheckInSplitRows([
      { id: 'ci-sp-1', method: 'Cash', amount: '', ref: '' },
      { id: 'ci-sp-2', method: 'UPI', amount: '', ref: '' },
    ]);
    setSinglePaymentRef('');
    setWalkInBookingSource('Walk-in');
    setWalkInBookingStatus('Confirmed');
    setWalkInIdSeed(Number(String(Date.now()).slice(-6)));
  };

  const handlePrintOfficialGrc = (targetCheckIn?: GuestCheckIn | null) => {
    const docTarget = targetCheckIn || activePrintDocument;
    if (!docTarget) return;
    const liveDoc = checkins.find(c => c.id === docTarget.id) || docTarget;
    const matchedBk =
      bookings.find(
        b =>
          b.id === liveDoc.id ||
          ((liveDoc as any).bookingId && b.id === (liveDoc as any).bookingId)
      ) || null;
    const existingGrcNums = [
      ...checkins.map(c => (c as any).grcNumber as string | undefined),
      ...bookings.map(b => (b as any).grcNumber as string | undefined),
    ];
    const regNo =
      String((liveDoc as any).grcNumber || (matchedBk as any)?.grcNumber || '').trim() ||
      allocateGrcNumber(existingGrcNums, billSettings);
    const rmObj = rooms.find(r => r.number === liveDoc.roomNumber);
    const rawTerms = Array.isArray(hotelSettings?.grcTerms)
      ? hotelSettings.grcTerms.filter(t => String(t || '').trim().length > 0)
      : undefined;
    const grcData = toGrcPrintData({
      hotel: hotelSettings,
      regNo,
      booking: matchedBk,
      checkin: liveDoc,
      roomRate: Number(liveDoc.roomRate) || rmObj?.rate,
      roomType: liveDoc.roomType || rmObj?.category,
      settings: billSettings,
      terms: rawTerms && rawTerms.length > 0 ? rawTerms : defaultGrcTerms(),
    });
    openPrintWindow(renderGrcHtml(grcData), true);
  };

  const handlePrintCard = () => {
    handlePrintOfficialGrc(activePrintDocument);
  };

  const handleDownloadPDF = () => {
    handlePrintOfficialGrc(activePrintDocument);
  };

  const handleSendWhatsAppPDF = () => {
    if (!activePrintDocument) return;
    setWhatsappStatus('Processing digital layout and routing PDF via WhatsApp...');
    setTimeout(() => {
      setWhatsappStatus(`✅ Registration Form PDF compiled and sent successfully to ${activePrintDocument.guestName}'s WhatsApp on: +91 ${activePrintDocument.mobile}!`);
      setTimeout(() => setWhatsappStatus(null), 5000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic CSS Print Overrides */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #pms-print-frame, #pms-print-frame * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #pms-print-frame {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: #17120F !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
      `}</style>

      {/* A4 Portrait Luxury Printed GRC Slip Layout */}
      {activePrintDocument && (() => {
        const livePrintDoc = checkins.find(c => c.id === activePrintDocument.id) || activePrintDocument;
        const docAllocatedServices = livePrintDoc.allocatedServices || [];
        const docExtrasSum = (livePrintDoc.extraCharges || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const docPostCheckInExtrasSum = (livePrintDoc.extraCharges || [])
          .filter(e => !String(e.id || '').startsWith('ALLOC-CHK-') && !String(e.id || '').startsWith('AUX-CHK-'))
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);

        return (
        <div className="hidden print:block" id="pms-print-frame">
          <div className="p-7 bg-white border-2 border-[#C49A3A] text-[#17120F] font-sans text-xs space-y-3.5 rounded-xl max-w-[210mm] mx-auto min-h-[297mm] flex flex-col justify-between shadow-xs">
            <div>
              {/* Top Luxury Gradient Bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-[#8B691E] via-[#C49A3A] to-[#E0BD6B] rounded-full mb-3.5" />

              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-[#C49A3A]/40 pb-3.5">
                <div className="flex items-start gap-3.5 max-w-[68%]">
                  {hotelSettings.logoUrl ? (
                    <img
                      src={hotelSettings.logoUrl}
                      className="w-16 h-16 object-contain rounded-xl border border-[#C49A3A]/40 bg-white p-1 shadow-2xs shrink-0"
                      alt={hotelSettings.name}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FBF4E0] to-[#F3E2B3] border-2 border-[#C49A3A] flex flex-col items-center justify-center shrink-0 shadow-2xs">
                      <span className="text-base font-serif font-extrabold text-[#8B691E] leading-none">
                        {(hotelSettings.name || 'Hotel')
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w: string) => w[0]?.toUpperCase())
                          .join('')}
                      </span>
                      <span className="text-[7px] font-mono uppercase tracking-widest text-[#8B691E] font-bold mt-0.5">
                        HOTEL
                      </span>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <h1 className="text-2xl font-serif font-bold text-[#17120F] uppercase tracking-wide leading-tight">
                      {hotelSettings.name}
                    </h1>
                    {hotelSettings.address && (
                      <p className="text-[10.5px] leading-tight text-[#554637]">{hotelSettings.address}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] font-mono text-[#7A6B5D] pt-0.5">
                      {hotelSettings.gstNumber && (
                        <span className="font-bold text-[#8B691E] bg-[#FAF5EB] px-1.5 py-0.2 rounded border border-[#C49A3A]/40">
                          GSTIN: {hotelSettings.gstNumber}
                        </span>
                      )}
                      {hotelSettings.phoneNumber && <span>Ph: {hotelSettings.phoneNumber}</span>}
                      {hotelSettings.emailAddress && <span>• Email: {hotelSettings.emailAddress}</span>}
                      {hotelSettings.website && <span>• Web: {hotelSettings.website}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="border border-[#C49A3A] bg-gradient-to-r from-[#FAF5EB] to-[#F5EBD7] text-[#8B691E] font-serif font-bold px-3 py-1.5 rounded-lg text-center tracking-widest text-[11px] uppercase shadow-2xs">
                    GUEST REGISTRATION CARD
                  </div>
                  <p className="text-[10px] font-mono pt-0.5 text-[#17120F]">
                    <span className="text-[#7A6B5D]">Registration / Booking No.:</span>{' '}
                    <span className="font-bold text-sm text-[#17120F]">{livePrintDoc.id || livePrintDoc.bookingId}</span>
                  </p>
                  <p className="text-[9.5px] font-mono text-[#7A6B5D]">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-[9.5px] font-mono text-[#7A6B5D]">Desk: {livePrintDoc.checkedInBy || 'Front Desk Executive'}</p>

                </div>
              </div>

              {/* SECTION 1: PRIMARY GUEST DETAILS */}
              <div className="mt-3">
                <div className="bg-[#17120F] text-[#E5C378] px-3 py-1 rounded-t-md font-serif font-bold text-[10px] tracking-wider uppercase flex items-center justify-between border-b border-[#C49A3A]/40">
                  <span>1. Primary Guest Details</span>
                  <span className="text-[8.5px] font-mono text-[#D4AF37]/80 font-normal">Official Identification Record</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border border-[#E6DCCF] border-t-0 p-3 bg-[#FDFBF7] rounded-b-md text-xs">
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Full Guest Name</span>
                    <span className="font-bold text-[#17120F] text-xs">{livePrintDoc.guestName}</span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Mobile Number</span>
                    <span className="font-bold font-mono text-[#17120F] text-xs">{livePrintDoc.mobile}</span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Email Address</span>
                    <span className="text-xs text-[#17120F]">{livePrintDoc.emailAddress || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Nationality</span>
                    <span className="text-xs text-[#17120F]">{livePrintDoc.nationality || 'Indian'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Permanent Residential Address</span>
                    <span className="text-xs text-[#17120F] leading-tight block">{livePrintDoc.address}</span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">ID Type Verified</span>
                    <span className="text-xs font-semibold uppercase text-[#8B691E]">{livePrintDoc.idType || 'Aadhaar Card'}</span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">ID Document Number Reference</span>
                    <span className="font-mono font-bold text-xs text-[#17120F] tracking-wide">{livePrintDoc.idNumber || livePrintDoc.aadhaarNumber || livePrintDoc.passportNumber || livePrintDoc.idProofNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">D.O.B & Purpose of Visit</span>
                    <span className="text-xs text-[#17120F]">{livePrintDoc.dob || 'N/A'} • {livePrintDoc.purposeOfVisit || 'Leisure'}</span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Coming From → Going To</span>
                    <span className="text-xs text-[#17120F]">{livePrintDoc.comingFrom || '—'} → {livePrintDoc.goingTo || '—'}</span>
                  </div>
                  {(livePrintDoc.arrivalDateInIndia || livePrintDoc.durationOfStayInIndia) && (
                    <div className="col-span-2">
                      <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Arrival in India & Duration of Stay in India</span>
                      <span className="text-xs text-[#17120F]">{livePrintDoc.arrivalDateInIndia || '—'} • {livePrintDoc.durationOfStayInIndia || '—'}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">No. of Persons (M / F / Ch) & Plan</span>
                    <span className="text-xs font-mono font-bold text-[#17120F]">
                      M:{livePrintDoc.maleCount ?? 1} / F:{livePrintDoc.femaleCount ?? 0} / Ch:{livePrintDoc.childCount ?? 0} • Plan: {livePrintDoc.mealPlan || 'EP'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Agent / Voucher Reference</span>
                    <span className="text-xs text-[#17120F]">{livePrintDoc.travelAgentName || 'Direct'}{livePrintDoc.voucherNumber ? ` (Voucher: ${livePrintDoc.voucherNumber})` : ''}</span>
                  </div>
                  {livePrintDoc.companyName && (
                    <div className="col-span-2 border-t border-[#EFE8DE] pt-1 mt-0.5">
                      <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[#8A7A6D] font-semibold">Company / Corporate Entity</span>
                      <span className="text-xs font-bold text-[#17120F]">{livePrintDoc.companyName} {livePrintDoc.gstNumber ? `(GST: ${livePrintDoc.gstNumber})` : ''}</span>
                    </div>
                  )}

                </div>
              </div>

              {/* SECTION 2: ADDITIONAL COMPANION PARTICULARS */}
              <div className="mt-3">
                <div className="bg-[#17120F] text-[#E5C378] px-3 py-1 rounded-t-md font-serif font-bold text-[10px] tracking-wider uppercase flex items-center justify-between border-b border-[#C49A3A]/40">
                  <span>2. Additional Companions on Record</span>
                  <span className="text-[8.5px] font-mono text-[#D4AF37]/80 font-normal">Registered Roommates</span>
                </div>
                <div className="border border-[#E6DCCF] border-t-0 rounded-b-md overflow-hidden">
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F5EFE6] text-[#4A3B2C] border-b border-[#E6DCCF] font-bold">
                        <th className="p-1 px-2.5 border-r border-[#E6DCCF] text-center w-12">Index</th>
                        <th className="p-1 px-3 border-r border-[#E6DCCF]">Full Companion Name</th>
                        <th className="p-1 px-2.5 border-r border-[#E6DCCF] w-24">ID Type</th>
                        <th className="p-1 px-3 border-r border-[#E6DCCF]">ID Number Reference</th>
                        <th className="p-1 px-2.5">Nationality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE8DE]">
                      {livePrintDoc.secondaryGuests && livePrintDoc.secondaryGuests.length > 0 ? (
                        livePrintDoc.secondaryGuests.map((sg, idx) => (
                          <tr key={idx} className="even:bg-[#FAF7F2]">
                            <td className="p-1 px-2.5 border-r border-[#EFE8DE] text-center font-bold text-[#8B691E]">#{idx + 2}</td>
                            <td className="p-1 px-3 border-r border-[#EFE8DE] font-bold text-[#17120F]">{sg.fullName}</td>
                            <td className="p-1 px-2.5 border-r border-[#EFE8DE] uppercase text-[#554637]">{sg.idType || 'Aadhaar'}</td>
                            <td className="p-1 px-3 border-r border-[#EFE8DE] font-mono font-bold text-[#17120F]">{sg.idNumber || 'N/A'}</td>
                            <td className="p-1 px-2.5 text-[#554637]">{sg.nationality}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-2.5 text-center text-[#8A7A6D] italic font-mono uppercase text-[9px] bg-[#FDFBF7]">
                            No supplemental companion roommates registered on this check-in card
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                </div>
              </div>

              {/* SECTION 3: ROOM ALLOCATION & TIMELINES */}
              <div className="mt-3">
                <div className="bg-[#17120F] text-[#E5C378] px-3 py-1 rounded-t-md font-serif font-bold text-[10px] tracking-wider uppercase flex items-center justify-between border-b border-[#C49A3A]/40">
                  <span>3. Suite Allocation & Scheduled Stay Details</span>
                  <span className="text-[8.5px] font-mono text-[#D4AF37]/80 font-normal">Reservation Timelines</span>
                </div>
                <div className="p-3 border border-[#E6DCCF] border-t-0 bg-[#FDFBF7] rounded-b-md space-y-2">
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Room Number</strong>
                      <span className="text-sm font-serif font-bold text-[#8B691E]">Rm {livePrintDoc.roomNumber}</span>
                    </div>
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Room Category</strong>
                      <span className="text-xs font-bold text-[#17120F]">{livePrintDoc.bookedRooms?.[0]?.category || 'Standard'}</span>
                    </div>
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Room Charge</strong>
                      <span className="text-xs font-bold font-mono text-[#8B691E]">₹{(livePrintDoc.roomRate || livePrintDoc.rate || livePrintDoc.tariff || 0).toLocaleString('en-IN')}/N</span>
                    </div>
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Total Occupants</strong>
                      <span className="text-xs font-bold font-mono text-[#17120F]">{livePrintDoc.numGuests} registered</span>
                    </div>
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">{isSameDayStay ? 'Stay Duration' : 'Nights Count'}</strong>
                      <span className="text-xs font-bold font-mono text-[#8B691E]">{isSameDayStay ? `${stayHours || computedStayHours || 3} Hours (Day-Use)` : `${stayNights} Night(s)`}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EFE8DE]">
                    <div className="bg-white/80 border border-[#EBE3D5] rounded-md p-2">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono">Arrival Date / Check-In Time</strong>
                      <span className="text-xs font-bold text-[#17120F]">{livePrintDoc.checkInDate} • {arrivalTime}</span>
                    </div>
                    <div className="bg-white/80 border border-[#EBE3D5] rounded-md p-2">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono">Departure Date / Check-Out Time</strong>
                      <span className="text-xs font-bold text-[#17120F]">{livePrintDoc.checkOutDate} • {departureTime}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION 3B: ALLOCATED ROOM SERVICES */}
              <div className="mt-3">
                <div className="bg-[#17120F] text-[#E5C378] px-3 py-1 rounded-t-md font-serif font-bold text-[10px] tracking-wider uppercase flex items-center justify-between border-b border-[#C49A3A]/40">
                  <span>3B. Allocated Room Services (Guest Slip)</span>
                  <span className="text-[8.5px] font-mono text-[#D4AF37]/80 font-normal">Auxiliary Folio Amenities</span>
                </div>
                <div className="border border-[#E6DCCF] border-t-0 rounded-b-md overflow-hidden">
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F5EFE6] text-[#4A3B2C] border-b border-[#E6DCCF] font-bold">
                        <th className="p-1 px-3 border-r border-[#E6DCCF]">Service Name</th>
                        <th className="p-1 px-3 border-r border-[#E6DCCF]">Configured Price</th>
                        <th className="p-1 px-3 border-r border-[#E6DCCF]">Billing Status</th>
                        <th className="p-1 px-3 text-right">Charged to Guest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE8DE]">
                      {docAllocatedServices.length > 0 ? (
                        docAllocatedServices.map(srv => (
                          <tr key={srv.id} className="even:bg-[#FAF7F2]">
                            <td className="p-1 px-3 border-r border-[#EFE8DE] font-bold text-[#17120F]">{srv.serviceName}</td>
                            <td className="p-1 px-3 border-r border-[#EFE8DE] font-mono text-[#554637]">₹{Number(srv.configuredAmount || 0).toLocaleString()}</td>
                            <td className="p-1 px-3 border-r border-[#EFE8DE]">
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase ${srv.isChargeable ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                                {srv.isChargeable ? 'Chargeable' : 'Complimentary'}
                              </span>
                            </td>
                            <td className="p-1 px-3 text-right font-mono font-bold text-[#17120F]">
                              {srv.isChargeable ? `₹${Number(srv.chargedAmount || 0).toLocaleString()}` : '₹0 (Complimentary)'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-2 text-center text-[#8A7A6D] italic font-mono uppercase text-[9px] bg-[#FDFBF7]">
                            No additional room services allocated on this slip
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                </div>
              </div>

              {/* SECTION 4: FINANCIAL TARIFF SUMMARY */}
              <div className="mt-3">
                <div className="bg-[#17120F] text-[#E5C378] px-3 py-1 rounded-t-md font-serif font-bold text-[10px] tracking-wider uppercase flex items-center justify-between border-b border-[#C49A3A]/40">
                  <span>4. Financial Tariff Summary (GST Compliant)</span>
                  <span className="text-[8.5px] font-mono text-[#D4AF37]/80 font-normal">Statutory Hotel Billing</span>
                </div>
                <div className="border border-[#E6DCCF] border-t-0 rounded-b-md overflow-hidden">
                  <table className="w-full text-[10px] text-left border-collapse font-mono">
                    <tbody className="divide-y divide-[#EFE8DE]">
                      <tr className="bg-[#FDFBF7]">
                        <td className="p-1.5 px-3 border-r border-[#EFE8DE] w-1/2 text-[#554637]">Room Tariff Rate (Per Night):</td>
                        <td className="p-1.5 px-3 text-right font-semibold text-[#17120F]">₹{Number(livePrintDoc.roomRate || 0).toLocaleString()} / Night</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="p-1.5 px-3 border-r border-[#EFE8DE] text-[#554637]">Accommodations Total ({stayNights} Night{stayNights > 1 ? 's' : ''}):</td>
                        <td className="p-1.5 px-3 text-right font-semibold text-[#17120F]">₹{Number((livePrintDoc.roomRate || 0) * stayNights).toLocaleString()}</td>
                      </tr>
                      {extraPersonChargesTotal > 0 && (
                        <tr className="bg-[#FDFBF7]">
                          <td className="p-1.5 px-3 border-r border-[#EFE8DE] text-[#554637]">Extra Guest Charge Total:</td>
                          <td className="p-1.5 px-3 text-right font-semibold text-[#17120F]">+ ₹{extraPersonChargesTotal.toLocaleString()}</td>
                        </tr>
                      )}
                      {(docExtrasSum > 0 || otherCharges > 0) && (
                        <tr className="bg-white">
                          <td className="p-1.5 px-3 border-r border-[#EFE8DE] text-[#554637]">Auxiliary Services & Extra Charges:</td>
                          <td className="p-1.5 px-3 text-right font-semibold text-[#17120F]">+ ₹{(docExtrasSum || otherCharges).toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="bg-[#FDFBF7]">
                        <td className="p-1.5 px-3 border-r border-[#EFE8DE] text-[#554637]">GST Amount:</td>
                        <td className="p-1.5 px-3 text-right font-semibold text-[#17120F]">+ ₹{Number(gstTax || 0).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-[#17120F] text-[#E5C378] font-bold">
                        <td className="p-1.5 px-3 border-r border-[#2A201A] text-xs font-serif uppercase tracking-wider">GRAND TOTAL LIABILITY AMOUNT:</td>
                        <td className="p-1.5 px-3 text-right text-xs">₹{Number((livePrintDoc.totalAmount || 0) + docPostCheckInExtrasSum).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-emerald-50 text-emerald-900 font-bold">
                        <td className="p-1.5 px-3 border-r border-emerald-100">Pre-Advance / Check-In Amount Paid:</td>
                        <td className="p-1.5 px-3 text-right text-emerald-700">- ₹{Number((livePrintDoc.advanceAmount || 0) + (livePrintDoc.cashAmountPaid || 0) + (livePrintDoc.onlineAmountPaid || 0)).toLocaleString()}</td>
                      </tr>
                      <tr className={`${livePrintDoc.pendingAmount > 0 ? 'bg-amber-50 text-amber-950' : 'bg-emerald-50/60 text-emerald-950'} font-bold`}>
                        <td className="p-2 px-3 border-r border-amber-200 text-xs font-serif uppercase tracking-wider">OUTSTANDING BALANCE DUE AT DESK:</td>
                        <td className={`p-2 px-3 text-right text-sm font-bold ${livePrintDoc.pendingAmount > 0 ? 'text-[#8B691E]' : 'text-emerald-700'}`}>
                          ₹{Number(livePrintDoc.pendingAmount || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                </div>
              </div>

              {/* POLICIES / UNDERTAKING */}
              <div className="mt-3 p-2.5 border-l-4 border-[#C49A3A] bg-[#FAF6F0] rounded-r-md text-[8.5px] text-[#554637] leading-relaxed border border-[#E6DCCF]">
                <strong className="text-[#17120F]">GUEST UNDERTAKING & PRIVACY DECLARATION:</strong> I state that the personal details submitted above are true and complete under Indian Police verification guidelines. I assume 100% financial liability for all items consumed, room physical damages, phone line expenses, or other fees incurred during my stay. I pledge to leave standard room keys at the boutique reception desk during check-out.
              </div>
            </div>

            {/* SECTION 5: SIGNATURES */}
            <div className="mt-3 pt-2 border-t border-[#E6DCCF]">
              <div className="flex justify-between items-end text-[10px] text-[#17120F] font-mono">
                <div className="w-[44%] text-center leading-tight">
                  {livePrintDoc.guestSignatureData ? (
                    <img
                      src={livePrintDoc.guestSignatureData}
                      alt="Guest Signature"
                      className="max-h-14 max-w-[170px] object-contain mx-auto mb-1"
                    />
                  ) : (
                    <div className="h-10" />
                  )}
                  <div className="border-t-2 border-dashed border-[#C49A3A] pt-1.5">
                    <strong className="font-serif text-[#17120F] text-xs block">Primary Guest Signature</strong>
                    <span className="text-[8px] text-[#7A6B5D]">({livePrintDoc.checkInTimestamp || `Date: ${livePrintDoc.checkInDate}`})</span>
                  </div>
                </div>
                <div className="text-center pb-1">
                  <div className="w-14 h-14 rounded-full border border-dashed border-[#C49A3A]/40 flex items-center justify-center text-[7px] text-[#8A7A6D] uppercase text-center p-1 mx-auto">
                    Hotel Seal
                  </div>
                </div>
                <div className="w-[42%] text-center leading-tight">
                  {livePrintDoc.receptionistSignatureData ? (
                    <img
                      src={livePrintDoc.receptionistSignatureData}
                      alt="Receptionist Signature"
                      className="max-h-14 max-w-[170px] object-contain mx-auto mb-1"
                    />
                  ) : (
                    <div className="h-10" />
                  )}
                  <div className="border-t-2 border-dashed border-[#C49A3A] pt-1.5">
                    <strong className="font-serif text-[#17120F] text-xs block">Desk Officer Signature</strong>
                    <span className="text-[8px] text-[#7A6B5D]">(Checked-In By: {livePrintDoc.checkedInBy || 'Desk Executive'})</span>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Main Front Desk UI layout (Excluded during browser window printing) */}
      <div className="no-print space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-luxury-brown-100 pb-4 gap-3">
          <div>
            <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-[#9E2A2B]" /> Guest Registration & Booking Form
            </h1>
            <p className="text-xs text-luxury-brown-405">Configure guest records, handle tariffs, and generate sign-ready GRC compliance slips.</p>
          </div>
          {selectedBooking && (
            <button
              onClick={() => setSelectedBooking(null)}
              className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear Selected ({selectedBooking.guestName})
            </button>
          )}
        </div>

        {/* Hotel branding & GST settings centralized in Profile Settings */}
        {false && showConfig && (
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-5 shadow-inner space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs uppercase font-mono tracking-wider text-[#9E2A2B] font-bold flex items-center gap-1">
                <Hotel className="w-4 h-4" /> Hotel Admin - Configure Form Header Settings
              </span>
              <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-slate-600 text-xs">Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] uppercase font-mono text-slate-500 font-bold">Hotel Logo URL</label>
                <input
                  type="text"
                  value={configLogo}
                  onChange={(e) => setConfigLogo(e.target.value)}
                  placeholder="Insert image link or leave empty"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-slate-400 focus:outline-none font-mono"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] uppercase font-mono text-slate-500 font-bold">Hotel Name *</label>
                <input
                  type="text"
                  required
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                />
              </div>
              <div className="space-y-1 col-span-4">
                <label className="text-[10px] uppercase font-mono text-slate-500 font-bold">Hotel Physical Address *</label>
                <input
                  type="text"
                  required
                  value={configAddress}
                  onChange={(e) => setConfigAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 font-bold">GST Number *</label>
                <input
                  type="text"
                  required
                  value={configGST}
                  onChange={(e) => setConfigGST(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded uppercase font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 font-bold">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={configPhone}
                  onChange={(e) => setConfigPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 font-bold">Email Address *</label>
                <input
                  type="text"
                  required
                  value={configEmail}
                  onChange={(e) => setConfigEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 font-bold">Website *</label>
                <input
                  type="text"
                  required
                  value={configWebsite}
                  onChange={(e) => setConfigWebsite(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBranding}
                className="px-4 py-1.5 bg-slate-800 text-white hover:bg-slate-900 font-bold rounded flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Save Brand Details
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp success notification log */}
        {whatsappStatus && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2.5 text-xs font-bold font-mono rounded-lg animate-fade-in">
            {whatsappStatus}
          </div>
        )}

        {/* 2. ACTIONS PANEL FOR SAVED CHECKIN SLIPS */}
        {activePrintDocument && (() => {
          const liveDoc = checkins.find(c => c.id === activePrintDocument.id) || activePrintDocument;
          const docServices = liveDoc.allocatedServices || [];
          return (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 rounded-2xl text-white shadow-lg space-y-4 animate-fade-in no-print">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="bg-white/20 text-white font-mono text-[9px] font-bold tracking-widest px-2 py-0.5 rounded uppercase">Guest Registration Slip</span>
                <h3 className="text-base font-serif font-bold">Guest Slip & Registration Summary — Room {liveDoc.roomNumber}</h3>
                <p className="text-xs text-emerald-50 leading-relaxed max-w-xl">
                  Guest <span className="font-bold underline">{liveDoc.guestName}</span> is recorded in Room <span className="font-bold">{liveDoc.roomNumber}</span> ({liveDoc.checkInDate} to {liveDoc.checkOutDate}). Print this slip below or download A4 PDF.
                </p>
              </div>
              <button 
                onClick={() => setActivePrintDocument(null)} 
                className="text-white hover:text-emerald-100 text-xs font-bold bg-white/10 px-2.5 py-1 rounded border border-white/20"
              >
                Hide Slip
              </button>
            </div>

            {docServices.length > 0 && (
              <div className="bg-white/95 text-slate-900 rounded-xl p-3.5 border border-white/30 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-700">
                    Allocated Room Services on Guest Slip ({docServices.length})
                  </span>
                  <span className="text-[11px] font-mono font-bold text-emerald-800">
                    Total Charged to Guest: ₹{docServices.reduce((sum, s) => sum + (s.isChargeable ? Number(s.chargedAmount || 0) : 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left font-mono">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2">Service Name</th>
                        <th className="p-2 text-right">Service Price</th>
                        <th className="p-2 text-center">Billing Status</th>
                        <th className="p-2 text-right">Charged to Guest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {docServices.map((srv) => (
                        <tr key={srv.id}>
                          <td className="p-2 font-sans font-bold text-slate-900">{srv.serviceName}</td>
                          <td className="p-2 text-right text-slate-600">₹{Number(srv.configuredAmount ?? srv.amount ?? 0).toLocaleString()}</td>
                          <td className="p-2 text-center">
                            {srv.isChargeable ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">Chargeable</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Complimentary</span>
                            )}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {srv.isChargeable ? `₹${Number(srv.chargedAmount ?? srv.amount ?? 0).toLocaleString()}` : '₹0 (Complimentary)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/25">
              <button
                type="button"
                onClick={() => handlePrintOfficialGrc(liveDoc)}
                className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print GRC
              </button>
              <button
                type="button"
                onClick={() => handlePrintOfficialGrc(liveDoc)}
                className="px-4 py-2 bg-emerald-900 hover:bg-emerald-950 border border-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Save GRC as PDF
              </button>
              <button
                onClick={handleSendWhatsAppPDF}
                className="px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Send className="w-4 h-4" /> WhatsApp PDF to Guest
              </button>
              <button
                type="button"
                onClick={() => handleEditCheckIn(liveDoc)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Sliders className="w-4 h-4" /> Edit Guest & Stay Details
              </button>
            </div>
          </div>
          );
        })()}

        {/* Sub-Navigation Bar shown ONLY on Walk-In Booking page (kept unchanged as requested) */}
        {effectiveMode === 'walkin' && (
          <div className="flex border-b border-luxury-brown-200 bg-white rounded-t-xl overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('form');
              setSelectedBooking(null);
              if (effectiveMode === 'walkin') switchWorkflowTab('checkin');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'form' && selectedBooking !== null
                ? 'border-[#9E2A2B] text-[#9E2A2B] bg-luxury-beige-50/50'
                : activeSubTab === 'form' && effectiveMode !== 'walkin'
                ? 'border-[#9E2A2B] text-[#9E2A2B] bg-luxury-beige-50/50'
                : 'border-transparent text-luxury-brown-600 hover:text-luxury-brown-950 hover:bg-gray-50'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Advance Booking Check-In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('form');
              setSelectedBooking(null);
              if (effectiveMode !== 'walkin') switchWorkflowTab('walkin');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'form' && effectiveMode === 'walkin' && !selectedBooking
                ? 'border-[#9E2A2B] text-[#9E2A2B] bg-luxury-beige-50/50'
                : 'border-transparent text-luxury-brown-600 hover:text-luxury-brown-950 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" /> Walk-In Booking
          </button>
        </div>
        )}

        {/* TAB 1: CHECK-IN / WALK-IN FORM */}
        {activeSubTab === 'form' && (
          <div className={`bg-white border border-luxury-brown-100 ${effectiveMode === 'walkin' ? 'rounded-b-xl' : 'rounded-2xl'} p-6 shadow-sm space-y-6`}>

            {/* 1-CLICK QUICK EDIT AFTER CHECK-IN BAR */}
            {(() => {
              const activeCheckedInGuests = checkins.filter(c => !c.checkedOutDateTime);
              if (editingCheckIn || activeCheckedInGuests.length === 0) return null;

              if (!isEditBannerExpanded) {
                return (
                  <div className="bg-[#FDF8ED] border border-[#C49A3A]/40 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-[#17120F] text-[#C49A3A] font-mono text-[10px] font-bold uppercase rounded">
                        In-House Guests ({activeCheckedInGuests.length})
                      </span>
                      <span className="text-xs text-slate-700 font-medium">
                        Need to edit stay, transfer room, or update tariff for an in-house guest?
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsEditBannerExpanded(true)}
                        className="px-3 py-1 bg-[#17120F] hover:bg-[#2A211B] text-[#E0BD6B] border border-[#C49A3A]/50 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        Show In-House Guests ({activeCheckedInGuests.length}) <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('folios')}
                        className="px-3 py-1 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-[#263449] rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                      >
                        View All Folios & Services →
                      </button>
                    </div>
                  </div>
                );
              }

              const visibleCheckedInGuests = showAllCheckedInGuests
                ? activeCheckedInGuests
                : activeCheckedInGuests.slice(0, 4);
              const hiddenCount = Math.max(0, activeCheckedInGuests.length - 4);

              return (
                <div className="bg-[#FDF8ED] border border-[#C49A3A]/50 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-[#17120F] text-[#C49A3A] font-mono text-[10px] font-bold uppercase rounded">
                          After Check-In Edit
                        </span>
                        <h3 className="text-xs sm:text-sm font-serif font-bold text-[#263449]">
                          Currently Checked-In Guests ({activeCheckedInGuests.length}) — Click to Edit Stay, Transfer Room, or Update Tariff
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Need to change room number, extend/shorten check-out date, add extra bed/mattress, update ID proof, or record partial payment after check-in? Click any guest below:
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeCheckedInGuests.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setShowAllCheckedInGuests(prev => !prev)}
                          className="px-3 py-1.5 bg-[#17120F] hover:bg-[#2A211B] text-[#E0BD6B] border border-[#C49A3A]/50 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          {showAllCheckedInGuests ? (
                            <>
                              Show Less <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              View More (+{hiddenCount}) <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEditBannerExpanded(false)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold shrink-0 cursor-pointer inline-flex items-center gap-1"
                      >
                        Collapse List <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('folios')}
                        className="px-3 py-1.5 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 text-[#263449] rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                      >
                        View All Folios & Services →
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {visibleCheckedInGuests.map(c => (
                      <div
                        key={c.id}
                        className="inline-flex items-center gap-2 bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 shadow-2xs"
                      >
                        <span className="px-2 py-0.5 bg-[#17120F] text-[#C49A3A] font-mono font-bold text-[11px] rounded">
                          Room {c.roomNumber}
                        </span>
                        <div className="text-left">
                          <div className="text-xs font-bold text-[#263449] leading-tight">{c.guestName}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Out: {c.checkOutDate} • ₹{(c.roomRate || 0).toLocaleString()}/night
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePrintOfficialGrc(c)}
                          className="ml-1 px-2.5 py-1 bg-[#17120F] hover:bg-[#2A211B] text-[#C49A3A] font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Print Official Guest Registration Card (GRC)"
                        >
                          <Printer className="w-3 h-3" /> Print GRC
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditCheckIn(c)}
                          className="px-2.5 py-1 bg-[#C49A3A] hover:bg-[#a8822d] text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders className="w-3 h-3" /> Edit Stay
                        </button>
                      </div>
                    ))}

                    {activeCheckedInGuests.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllCheckedInGuests(prev => !prev)}
                        className="inline-flex items-center gap-1.5 bg-[#17120F] hover:bg-[#2A211B] text-[#E0BD6B] border border-[#C49A3A] rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        {showAllCheckedInGuests ? (
                          <>
                            Show Less <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            View More (+{hiddenCount} Guests) <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {editingCheckIn && (
              <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-fade-in">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-700 text-white text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded">Edit Mode Active</span>
                    <h3 className="text-sm font-serif font-bold text-amber-950">
                      Editing Walk-In / Stay Record #{editingCheckIn.id} — {editingCheckIn.guestName} (Room {editingCheckIn.roomNumber})
                    </h3>
                  </div>
                  <p className="text-xs text-amber-900">
                    Modify guest details, room allocation, stay dates, tariff, or payment details below and click <strong>Update Walk-In / Stay Details</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEditCheckIn}
                  className="px-3.5 py-1.5 bg-white border border-amber-400 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                >
                  Cancel Edit
                </button>
              </div>
            )}

            {effectiveMode === 'walkin' ? (
              <>
            {/* WORKFLOW CONTEXT BANNER */}
            {/* Mode Switcher Banner: Single vs Group vs C-Form Check-In */}
            <div className="bg-white p-4 rounded-xl text-[#263449] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#C49A3A]/15 border border-[#C49A3A]/30 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-[#C49A3A]" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#263449]">Select Check-In Category</h3>
                  <p className="text-[11px] text-slate-600">Choose Single Room, Group (Multi-Room), or Foreign Tourist C-Form Registration.</p>

                </div>
              </div>
              <div className="flex items-center bg-slate-50 p-1 rounded-lg border border-slate-200 flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCheckInMode('single');
                    setIsCFormRequired(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    checkInMode === 'single' && !isCFormRequired
                      ? 'bg-[#C49A3A] text-white shadow-sm'
                      : 'text-[#263449] hover:bg-slate-100'
                  }`}
                >
                  Single Room Check-In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckInMode('group');
                    setIsCFormRequired(false);
                    if (groupRooms.length === 0) handleAddGroupRoom();
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    checkInMode === 'group'
                      ? 'bg-[#C49A3A] text-white shadow-sm'
                      : 'text-[#263449] hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Group Check-In (Multi-Room)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckInMode('single');
                    setIsCFormRequired(true);
                    if (nationality === 'Indian') setNationality('Foreigner / Non-Indian');
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isCFormRequired
                      ? 'bg-[#9E2A2B] text-white shadow-sm'
                      : 'text-[#9E2A2B] hover:bg-rose-50 border border-rose-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" /> C-Form (Foreign Tourist)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveCheckIn} className="space-y-6">
              
              {/* PANEL I: ROOM DETAILS / GROUP ALLOCATION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-luxury-brown-100/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Hotel className="w-4 h-4 text-[#9E2A2B]" />
                    <h3 className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold">
                      {checkInMode === 'single' ? 'I. Room Allocation & Timelines' : 'I. Group Booking & Multi-Room Allocation'}
                    </h3>
                  </div>
                  {checkInMode === 'group' && (
                    <span className="text-xs font-mono font-bold text-[#9E2A2B] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      Group Booking Ref: {groupBookingId}
                    </span>
                  )}
                </div>

                {/* PART 1.A: ADVANCE BOOKING SELECTOR & EXISTING RESERVATION DETAILS SUMMARY */}
                {effectiveMode !== 'walkin' && !editingCheckIn && (
                  <div className="space-y-3 bg-[#FAF6EE] p-3.5 rounded-xl border border-[#D4AD50]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-mono text-[#8B691E] uppercase font-bold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[#8B691E]" />
                        <span>
                          {arrivalQueueFilter === 'today'
                            ? `Today's Advance Arrivals (${todayEligibleReservations.length})`
                            : arrivalQueueFilter === 'date'
                            ? `Advance Arrivals for ${filterArrivalDate} (${dateEligibleReservations.length})`
                            : `All Advance Bookings (${eligibleReservations.length})`}
                        </span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedBooking && (
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            ✓ Loaded: {selectedBooking.guestName} ({selectedBooking.id})
                          </span>
                        )}
                        <div className="inline-flex items-center gap-1 rounded-lg border border-[#C49A3A]/50 bg-white p-1 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => setArrivalQueueFilter('all')}
                            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                              arrivalQueueFilter === 'all'
                                ? 'bg-[#8B691E] text-white shadow-2xs'
                                : 'text-slate-700 hover:bg-amber-50'
                            }`}
                          >
                            All ({eligibleReservations.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setArrivalQueueFilter('today')}
                            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                              arrivalQueueFilter === 'today'
                                ? 'bg-[#8B691E] text-white shadow-2xs'
                                : 'text-slate-700 hover:bg-amber-50'
                            }`}
                          >
                            Today ({todayEligibleReservations.length})
                          </button>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${
                            arrivalQueueFilter === 'date'
                              ? 'border-[#8B691E] bg-amber-50 text-[#8B691E] font-bold'
                              : 'border-slate-200 text-slate-700 hover:border-amber-300'
                          }`}>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Date:</span>
                            <input
                              type="date"
                              value={filterArrivalDate}
                              onChange={(e) => {
                                setFilterArrivalDate(e.target.value);
                                setArrivalQueueFilter('date');
                              }}
                              className="bg-transparent border-none text-[11px] font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
                            />
                            {arrivalQueueFilter === 'date' && (
                              <span className="ml-0.5 text-[9px] bg-[#8B691E] text-white px-1.5 py-0.5 rounded-full font-mono font-extrabold">
                                {dateEligibleReservations.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={resSearchQuery}
                          onChange={(e) => setResSearchQuery(e.target.value)}
                          placeholder="Filter by Booking ID, Name or Mobile..."
                          className="w-full pl-8 pr-3 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-950 font-mono focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <select
                          value={selectedBooking?.id || ''}
                          onChange={(e) => {
                            const found = bookings.find((b) => b.id === e.target.value);
                            if (found) {
                              handleSelectAdvanceBooking(found);
                            } else {
                              setSelectedBooking(null);
                            }
                          }}
                          className="w-full px-3 py-2 border border-luxury-brown-300 rounded-lg text-sm bg-white text-luxury-brown-950 font-bold focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                        >
                          <option value="">
                            {filteredEligibleReservations.length === 0
                              ? arrivalQueueFilter === 'today'
                                ? "-- No Advance Bookings Arriving Today (Select Date or click 'All' to view others) --"
                                : arrivalQueueFilter === 'date'
                                ? `-- No Advance Bookings Arriving on ${filterArrivalDate} (Click 'All' or change Date) --`
                                : '-- No Matching Pending Advance Bookings Found --'
                              : '-- Choose Advance Booked Guest to Auto-fill Check-In Form --'}
                          </option>
                          {filteredEligibleReservations.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.id} — {b.guestName} • Rm {b.roomNumber || 'TBD'}{(b.bookedRooms || []).length > 1 ? ` [${(b.bookedRooms || []).length} Rooms]` : ''} ({b.checkInDate} to {b.checkOutDate || 'Open'}) • 📞 {b.mobile} (Adv: ₹{Number(b.advanceAmount || 0).toLocaleString('en-IN')}) [{b.status}]
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>



                    {/* Existing Reservation Details Read-Only Summary Card */}
                    {selectedBooking && (
                      <div className="bg-white border border-[#C49A3A]/50 rounded-xl p-3 space-y-2 animate-fade-in">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE8DE] pb-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#8B691E]">
                            Existing Advance Reservation Details (Auto-Loaded — No Duplicate Booking Created)
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Status: {selectedBooking.status || 'Confirmed'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Booking ID</span>
                            <span className="font-mono font-bold text-[#17120F]">{selectedBooking.id}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Booking Date</span>
                            <span className="font-mono font-semibold text-[#17120F]">{selectedBooking.bookingDate || selectedBooking.checkInDate || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Booking Source</span>
                            <span className="font-semibold text-[#17120F]">{selectedBooking.bookingSource || 'Direct'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Guest Name</span>
                            <span className="font-bold text-[#17120F]">{selectedBooking.guestName}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Mobile Number</span>
                            <span className="font-mono font-semibold text-[#17120F]">{selectedBooking.mobile}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Advance Already Paid</span>
                            <span className="font-mono font-bold text-emerald-700">₹{Number(selectedBooking.advanceAmount || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Arrival Date</span>
                            <span className="font-mono font-semibold text-[#17120F]">{selectedBooking.checkInDate}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Departure Date</span>
                            <span className="font-mono font-semibold text-[#17120F]">{selectedBooking.checkOutDate || 'Open Stay'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Room Type</span>
                            <span className="font-semibold text-[#17120F]">{selectedBooking.roomType || roomType || 'Standard'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">No. of Rooms</span>
                            <span className="font-mono font-bold text-[#17120F]">
                              {(selectedBooking.bookedRooms && selectedBooking.bookedRooms.length > 0)
                                ? selectedBooking.bookedRooms.length
                                : 1} Room(s)
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[9px] font-mono uppercase text-slate-500 block">Assigned Room(s)</span>
                            <span className="font-mono font-bold text-[#8B691E]">
                              {(selectedBooking.bookedRooms && selectedBooking.bookedRooms.length > 1)
                                ? selectedBooking.bookedRooms.map(br => `Rm ${br.roomNumber}`).join(', ')
                                : (selectedBooking.roomNumber ? `Rm ${selectedBooking.roomNumber}` : 'Select Available Room Below')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* PART 2.A & PART 3: WALK-IN BOOKING INFORMATION & EXISTING ADVANCE RESERVATION DETECTION */}
                {effectiveMode === 'walkin' && !editingCheckIn && (
                  <div className="space-y-3">
                    <div className="bg-[#FAF6F0] border border-[#E6DCCF] rounded-xl p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DCCF] pb-1.5">
                        <span className="text-xs font-mono text-[#8B691E] uppercase font-bold flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#9E2A2B]" /> Walk-In Booking Information
                        </span>
                        <div className="relative w-full sm:w-72">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={walkInReservationLookup}
                            onChange={(e) => setWalkInReservationLookup(e.target.value)}
                            placeholder="Check Advance Booking (Mobile / Ref ID)..."
                            className="w-full pl-8 pr-2.5 py-1 border border-luxury-brown-200 rounded-lg text-[11px] font-mono bg-white text-luxury-brown-950 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                            Booking ID (Auto-Generated)
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={checkInMode === 'group' ? groupBookingId : walkInPreviewBookingId}
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 bg-white/80 rounded-lg text-xs font-mono font-bold text-[#8B691E]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                            Booking Date *
                          </label>
                          <input
                            type="date"
                            value={walkInBookingDate}
                            onChange={(e) => setWalkInBookingDate(e.target.value)}
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-950 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                            Booking Source
                          </label>
                          <select
                            value={walkInBookingSource}
                            onChange={(e) => setWalkInBookingSource(e.target.value as BookingSource)}
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white text-luxury-brown-950"
                          >
                            <option value="Walk-in">Walk-in</option>
                            <option value="Direct">Direct</option>
                            <option value="Phone">Phone</option>
                            <option value="Website">Website</option>
                            <option value="Travel Agent">Travel Agent</option>
                            <option value="Corporate">Corporate</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* PART 3: EXISTING ADVANCE RESERVATION DETECTION BANNER */}
                    {matchingExistingReservation && (
                      <div className="bg-[#FDF8ED] border-2 border-[#C49A3A] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 bg-[#8B691E] text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded">
                              EXISTING ADVANCE RESERVATION FOUND
                            </span>
                            <span className="text-xs font-mono font-bold text-[#17120F]">
                              {matchingExistingReservation.id}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              Advance Paid: ₹{Number(matchingExistingReservation.advanceAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-xs text-[#263449]">
                            <strong>{matchingExistingReservation.guestName}</strong> ({matchingExistingReservation.mobile}) •{' '}
                            {matchingExistingReservation.roomNumber
                              ? `Room ${matchingExistingReservation.roomNumber}`
                              : matchingExistingReservation.roomType}{' '}
                            • Stay: <strong>{matchingExistingReservation.checkInDate}</strong> to{' '}
                            <strong>{matchingExistingReservation.checkOutDate || 'Open'}</strong>
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Click <strong>Load &amp; Autofill</strong> to switch to Advance Booking Check-In without creating a duplicate reservation or overwriting advance payments.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const matched = matchingExistingReservation;
                            setWalkInReservationLookup('');
                            switchWorkflowTab('checkin');
                            handleSelectAdvanceBooking(matched);
                          }}
                          className="px-4 py-2 bg-[#8B691E] hover:bg-[#735617] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer transition-colors"
                        >
                          <UserCheck className="w-4 h-4" /> Load &amp; Autofill
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {checkInMode === 'single' ? (
                  /* SINGLE ROOM ALLOCATION */
                  <div className="space-y-4">
                    {(() => {
                      const availableSelectableRooms = rooms.filter(
                        r =>
                          isRoomTrulyAvailable(r) ||
                          (selectedBooking && selectedBooking.roomNumber === r.number) ||
                          (editingCheckIn && editingCheckIn.roomNumber === r.number)
                      );

                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:col-span-4">
                            <div className="space-y-1">
                              <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">
                                Allocated Room *
                              </label>
                              <select
                                required
                                value={selectedRoomNumber}
                                onChange={(e) => setSelectedRoomNumber(e.target.value)}
                                className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-bold focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                              >
                                <option value="">
                                  {rooms.length === 0
                                    ? '-- No Rooms Configured Yet (Add Rooms in Room Management) --'
                                    : availableSelectableRooms.length === 0
                                    ? '-- No Rooms Available for Selected Dates --'
                                    : '-- Choose Room --'}
                                </option>
                                {availableSelectableRooms.map(r => {
                                  const isCurrentEditedRoom = Boolean(editingCheckIn && editingCheckIn.roomNumber === r.number);
                                  const isSelectedAdvRoom = Boolean(selectedBooking && selectedBooking.roomNumber === r.number);
                                  const statusLabel = isCurrentEditedRoom
                                    ? '(Current Room - Editing)'
                                    : isSelectedAdvRoom
                                    ? `(Advance Booked — ${selectedBooking?.guestName})`
                                    : `(Available - Std: ₹${r.rate})`;
                                  return (
                                    <option key={r.number} value={r.number}>
                                      Rm {r.number} - {r.category} {statusLabel}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Room Category</label>
                              <input
                                type="text"
                                disabled
                                value={roomType || 'Standard'}
                                className="w-full px-3 py-2 border border-luxury-brown-100 bg-gray-50 rounded-lg text-sm text-luxury-brown-700 font-semibold"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Adults Count *</label>
                              <input
                                type="number"
                                required
                                min={1}
                                value={adults}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  extraChargeTouchedRef.current = false;
                                  setAdults(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                                }}
                                onBlur={() => {
                                  if (adults === '' || Number(adults) < 1) setAdults(1);
                                }}
                                className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-bold focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Children Count *</label>
                              <input
                                type="number"
                                required
                                min={0}
                                value={children}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  extraChargeTouchedRef.current = false;
                                  setChildren(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                                }}
                                onBlur={() => {
                                  if (children === '' || Number(children) < 0) setChildren(0);
                                }}
                                className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-bold focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Point 1 Quick Room Tariff Edit + Separate Discount Bar right at Room Selection */}
                          <div className="p-3.5 rounded-xl bg-[#FDF8ED] border border-[#C49A3A]/50 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                                Fixed Room Rack Rate
                              </span>
                              <div className="px-3 py-2 rounded-lg bg-white/80 border border-slate-200 font-mono font-bold text-sm text-slate-600">
                                ₹{standardRate.toLocaleString('en-IN')} / Night
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <label className="text-[10px] font-mono uppercase font-bold text-[#9E2A2B]">
                                  Check-In Room Tariff (₹/Night) *
                                </label>
                                {roomRate !== standardRate && (
                                  <button
                                    type="button"
                                    onClick={handleRenewPrice}
                                    className="text-[9.5px] font-mono font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded cursor-pointer"
                                  >
                                    ↺ Reset
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={roomRate}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => setRoomRate(Math.max(0, Number(e.target.value) || 0))}
                                className="w-full px-3 py-2 border-2 border-[#9E2A2B] rounded-lg text-sm bg-white font-mono font-bold text-[#9E2A2B] focus:outline-none"
                                placeholder="Editable room tariff"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase font-bold text-emerald-800 block">
                                Additional Discount (₹)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={manualDiscount}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => setManualDiscount(Math.max(0, Number(e.target.value) || 0))}
                                className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm bg-white font-mono font-bold text-emerald-800 focus:outline-none"
                                placeholder="Separate flat discount"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-600 block">
                                Effective Room Total ({stayNights}N)
                              </span>
                              <div className="px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 flex items-center justify-between">
                                <span>₹{Math.max(0, roomRate * stayNights - manualDiscount).toLocaleString('en-IN')}</span>
                                {roomRate !== standardRate && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${roomRate < standardRate ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                                    {roomRate < standardRate ? `-₹${standardRate - roomRate}/N` : `+₹${roomRate - standardRate}/N`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* EXTRA BED SECTION FOR SINGLE ROOM */}
                    {(() => {
                      const selRoomObj = rooms.find(r => r.number === selectedRoomNumber);
                      const isExtraAllowed = selRoomObj ? selRoomObj.allowExtraBed !== false : true;
                      if (!isExtraAllowed) {
                        return (
                          <div className="bg-rose-50/80 border border-rose-200 p-3 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-900 font-mono">
                            <span className="flex items-center gap-1.5 font-bold">
                              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                              Extra Bed / Mattress: NOT ALLOWED
                            </span>
                            <span className="text-[11px] text-rose-700 italic">
                              Room {selectedRoomNumber || ''} is configured as a compact room (Room Setup: No Extra Bed).
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-xl space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="extra-bed-toggle"
                                checked={hasExtraBed}
                                onChange={(e) => setHasExtraBed(e.target.checked)}
                                className="w-4 h-4 text-[#9E2A2B] rounded focus:ring-[#C5A059]"
                              />
                              <label htmlFor="extra-bed-toggle" className="text-xs font-bold text-amber-950 uppercase font-mono cursor-pointer">
                                Provide Extra Mattress / Bed for Guest?
                              </label>
                            </div>
                            {hasExtraBed && (
                              <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                                Auto-added to Guest Bill: + ₹{extraBedTotal} ({stayNights} Nights)
                              </span>
                            )}
                          </div>

                          {hasExtraBed && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/80 animate-fade-in">
                              <div className="space-y-1">
                                <label className="text-[10px] font-mono text-amber-900 block uppercase font-bold">Extra Bed Quantity</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={4}
                                  value={extraBedCount}
                                  onChange={(e) => setExtraBedCount(Number(e.target.value))}
                                  className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs bg-white text-amber-950 font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-mono text-amber-900 block uppercase font-bold">Price per Bed / Night (₹)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={extraBedRate}
                                  onChange={(e) => setExtraBedRate(Number(e.target.value))}
                                  className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs bg-white text-amber-950 font-mono font-bold"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* GROUP CHECK-IN ALLOCATION TABLE */
                  <div className="space-y-4 bg-amber-50/20 border border-amber-200 p-4 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-luxury-brown-700 block uppercase font-bold">Group / Organization Name *</label>
                        <input
                          type="text"
                          required={checkInMode === 'group'}
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="e.g. Tata Motors Sales Team / Roy Family Wedding Group"
                          className="w-full px-3 py-2 border border-luxury-brown-300 rounded-lg text-sm bg-white font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-luxury-brown-700 block uppercase font-bold">Group Booking ID Reference</label>
                        <input
                          type="text"
                          value={groupBookingId}
                          onChange={(e) => setGroupBookingId(e.target.value)}
                          className="w-full px-3 py-2 border border-luxury-brown-200 bg-gray-50 rounded-lg text-sm font-mono font-bold text-luxury-brown-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center border-b pb-1">
                        <span className="text-xs font-mono font-bold uppercase text-luxury-brown-900">Allocated Rooms in Group ({groupRooms.length})</span>
                        <button
                          type="button"
                          onClick={handleAddGroupRoom}
                          className="px-3 py-1 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-luxury-gold-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Room to Group
                        </button>
                      </div>

                      <div className="overflow-x-auto border border-luxury-brown-200 rounded-lg bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-luxury-beige-100/50 border-b font-mono uppercase text-[10px] text-luxury-brown-800">
                            <tr>
                              <th className="p-2">Room #</th>
                              <th className="p-2">Category</th>
                              <th className="p-2">Rate/Night</th>
                              <th className="p-2">Extra Bed?</th>
                              <th className="p-2">Occupants</th>
                              <th className="p-2">Assigned Guest / Phone</th>
                              <th className="p-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {groupRooms.map((gr, idx) => (
                              <tr key={gr.id} className="hover:bg-amber-50/30">
                                <td className="p-2">
                                  <select
                                    value={gr.roomNumber}
                                    onChange={(e) => handleUpdateGroupRoom(gr.id, 'roomNumber', e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded font-bold text-xs"
                                  >
                                    {rooms
                                      .filter(r => isRoomTrulyAvailable(r) || gr.roomNumber === r.number)
                                      .map(r => (
                                        <option key={r.number} value={r.number}>
                                          Rm {r.number} ({r.category})
                                        </option>
                                      ))}
                                  </select>
                                </td>
                                <td className="p-2 text-gray-600 font-semibold">{gr.category}</td>
                                <td className="p-2 font-mono font-bold">
                                  <div className="flex items-center gap-1">
                                    <span>₹</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={gr.rate}
                                      onChange={(e) => handleUpdateGroupRoom(gr.id, 'rate', Math.max(0, Number(e.target.value) || 0))}
                                      className="w-20 px-1.5 py-0.5 border border-[#9E2A2B] rounded text-xs font-bold text-[#9E2A2B] bg-white"
                                      title={`Fixed Rack Rate: ₹${gr.originalRate}`}
                                    />
                                  </div>
                                  {gr.originalRate > 0 && gr.rate !== gr.originalRate && (
                                    <span className={`block text-[9.5px] mt-0.5 ${gr.rate < gr.originalRate ? 'text-rose-600' : 'text-blue-600'}`}>
                                      Fixed: ₹{gr.originalRate} ({gr.rate < gr.originalRate ? `-₹${gr.originalRate - gr.rate}` : `+₹${gr.rate - gr.originalRate}`})
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 font-mono">
                                  {(() => {
                                    const grRoomObj = rooms.find(r => r.number === gr.roomNumber);
                                    const canExtra = grRoomObj ? grRoomObj.allowExtraBed !== false : true;
                                    if (!canExtra) {
                                      return (
                                        <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="Extra bed not possible for this room">
                                          ✕ No Bed
                                        </span>
                                      );
                                    }
                                    return (
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(gr.hasExtraBed)}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setGroupRooms(prev =>
                                              prev.map(item => {
                                                if (item.id !== gr.id) return item;
                                                const fallbackRate =
                                                  Number(grRoomObj?.extraPersonCharge) > 0
                                                    ? Number(grRoomObj?.extraPersonCharge)
                                                    : 500;
                                                return {
                                                  ...item,
                                                  hasExtraBed: isChecked,
                                                  extraBedCount: Number(item.extraBedCount) > 0 ? item.extraBedCount : 1,
                                                  extraBedRate:
                                                    Number(item.extraBedRate) > 0 ? item.extraBedRate : fallbackRate,
                                                };
                                              })
                                            );
                                          }}
                                          className="w-4 h-4 rounded text-[#9E2A2B] cursor-pointer"
                                        />
                                        {gr.hasExtraBed && (
                                          <div className="flex items-center gap-0.5 text-[10px] text-amber-900 font-bold">
                                            <span>+₹</span>
                                            <input
                                              type="number"
                                              min={0}
                                              value={gr.extraBedRate}
                                              onChange={(e) =>
                                                handleUpdateGroupRoom(
                                                  gr.id,
                                                  'extraBedRate',
                                                  Math.max(0, Number(e.target.value) || 0)
                                                )
                                              }
                                              className="w-14 px-1 py-0.5 border border-amber-300 rounded bg-amber-50/60 text-[10px] font-mono font-bold text-amber-950"
                                              title="Extra Bed Rate per Night"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <span>A:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      value={gr.adults}
                                      onChange={(e) => handleUpdateGroupRoom(gr.id, 'adults', Number(e.target.value))}
                                      className="w-10 px-1 border rounded"
                                    />
                                    <span>C:</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={gr.children}
                                      onChange={(e) => handleUpdateGroupRoom(gr.id, 'children', Number(e.target.value))}
                                      className="w-10 px-1 border rounded"
                                    />
                                  </div>
                                </td>
                                <td className="p-2 space-y-1">
                                  <input
                                    type="text"
                                    placeholder="Guest Name in this room"
                                    value={gr.assignedGuestName}
                                    onChange={(e) => handleUpdateGroupRoom(gr.id, 'assignedGuestName', e.target.value)}
                                    className="w-full px-2 py-0.5 border rounded text-[11px]"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveGroupRoom(gr.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-2.5 bg-amber-100/60 border border-amber-300 rounded-lg flex flex-wrap justify-between items-center text-xs font-mono font-bold text-amber-950">
                        <span>Group Summary: {groupRooms.length} Room(s) | {groupTotalGuests} Guest(s)</span>
                        <span>Nightly Tariff: ₹{groupRoomChargesPerNight} | Extra Beds: +₹{groupExtraBedPerNight}</span>
                        <span>Stay Total ({stayNights} Nights): ₹{groupRoomChargesTotal + groupExtraBedChargesTotal}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Occupancy Limit Status</label>
                    <input
                      type="text"
                      disabled
                      value={checkInMode === 'single' ? `${totalOccupants} Occupant(s) (Room Capacity: ${baseOccupancy} Base / ${selectedRoomMaxOccupancy} Max)` : `${groupTotalGuests} Total Guests across ${groupRooms.length} Room(s)`}
                      className="w-full px-3 py-2 border border-luxury-brown-100 bg-gray-50 rounded-lg text-sm text-luxury-brown-600 font-mono"
                    />
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Purpose of Visit *</label>
                    <input
                      type="text"
                      required
                      value={purposeOfVisit}
                      onChange={(e) => setPurposeOfVisit(e.target.value)}
                      placeholder="Leisure, Sightseeing, Business conference, etc."
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Page 2 GRC: No. of Persons (M / F / Ch) & Travel Agent Selector */}
                <div className="p-3.5 bg-[#FAF6F0] border border-[#E6DCCF] rounded-xl space-y-3">
                  <div>
                    <label className="text-[11px] font-mono text-luxury-brown-700 block uppercase font-bold mb-1.5">
                      No. of Persons Breakdown (M / F / Child)
                    </label>
                    <div className="grid grid-cols-3 gap-2 max-w-md">
                      <div>
                        <span className="text-[10px] font-mono text-gray-500 block">Male (M)</span>
                        <input
                          type="number"
                          min={0}
                          value={maleCount}
                          onChange={(e) => {
                            const m = Math.max(0, Number(e.target.value) || 0);
                            setMaleCount(m);
                            setAdults(Math.max(1, m + (Number(femaleCount) || 0)));
                          }}
                          className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-gray-500 block">Female (F)</span>
                        <input
                          type="number"
                          min={0}
                          value={femaleCount}
                          onChange={(e) => {
                            const f = Math.max(0, Number(e.target.value) || 0);
                            setFemaleCount(f);
                            setAdults(Math.max(1, (Number(maleCount) || 0) + f));
                          }}
                          className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-gray-500 block">Child (Ch)</span>
                        <input
                          type="number"
                          min={0}
                          value={childCount}
                          onChange={(e) => {
                            const ch = Math.max(0, Number(e.target.value) || 0);
                            setChildCount(ch);
                            setChildren(ch);
                          }}
                          className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Travel Agent / OTA Partner & Commission */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#E6DCCF]">
                    <div>
                      <label className="text-[11px] font-mono text-luxury-brown-700 block uppercase font-bold mb-1">
                        Travel Agent / OTA Partner
                      </label>
                      <select
                        value={selectedAgentId}
                        onChange={(e) => {
                          const agId = e.target.value;
                          setSelectedAgentId(agId);
                          const ag = travelAgents.find(a => a.id === agId);
                          if (ag) {
                            setCommissionType(ag.commissionType || 'percentage');
                            setCommissionValue(Number(ag.commissionValue) || 0);
                          } else {
                            setCommissionValue(0);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white"
                      >
                        <option value="">Direct / No Agent</option>
                        {travelAgents.filter(a => a.status !== 'Inactive').map(ag => (
                          <option key={ag.id} value={ag.id}>
                            {ag.agencyName ? `${ag.agencyName} (${ag.name})` : ag.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedAgentId && (
                      <>
                        <div>
                          <label className="text-[11px] font-mono text-luxury-brown-700 block uppercase font-bold mb-1">
                            Commission Type &amp; Rate
                          </label>
                          <div className="flex gap-1.5">
                            <select
                              value={commissionType}
                              onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
                              className="px-2 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white"
                            >
                              <option value="percentage">% of Tariff</option>
                              <option value="fixed">Fixed ₹</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              value={commissionValue}
                              onChange={(e) => setCommissionValue(Math.max(0, Number(e.target.value) || 0))}
                              className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-end">
                          <div className="w-full px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-mono font-bold text-amber-900 flex justify-between items-center">
                            <span>Agent Comm.:</span>
                            <span>₹{computedAgentCommission.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* TIMELINES */}
                <div className="space-y-3 border-t border-dashed border-luxury-brown-100 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                      <div className="min-h-[20px] flex items-center">
                        <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Arrival Date *</label>
                      </div>
                      <input
                        type="date"
                        required
                        value={checkInDate}
                        onChange={(e) => handleArrivalDateChange(e.target.value)}
                        className="w-full h-10 px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-mono focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="min-h-[20px] flex items-center">
                        <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Arrival Time *</label>
                      </div>
                      <input
                        type="text"
                        required
                        value={arrivalTime}
                        onChange={(e) => setArrivalTime(e.target.value)}
                        placeholder="e.g. 12:00 PM"
                        className="w-full h-10 px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-mono focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="min-h-[20px] flex items-center justify-between gap-1">
                        <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">
                          Departure Date (Nights: {checkOutDate ? stayNights : 1})
                        </label>
                        {checkOutDate ? (
                          <button
                            type="button"
                            onClick={() => setCheckOutDate('')}
                            className="text-[10px] leading-none text-amber-700 hover:text-amber-900 underline font-mono cursor-pointer"
                          >
                            Leave Blank (Open Stay)
                          </button>
                        ) : (
                          <span className="text-[10px] leading-none text-amber-600 font-bold font-mono">
                            (Blank / Open Stay)
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        value={checkOutDate}
                        onChange={(e) => handleDepartureDateChange(e.target.value)}
                        className="w-full h-10 px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-mono focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Hourly / Same-Day Stay & Early Check-In Alerts */}
                  {checkOutDate && checkInDate === checkOutDate && (
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 text-xs flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <strong>Same-Day / Short Hourly Stay:</strong> Guest checking in and checking out on the same date ({checkInDate}) from <strong>{arrivalTime}</strong> to <strong>{departureTime}</strong>.
                      </div>
                    </div>
                  )}

                  {earlyCheckInInfo.isEarly && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                          <div>
                            <strong>⚡ Early Check-In Detected:</strong> Arrival at <strong>{arrivalTime}</strong> is before standard check-in ({hotelSettings?.checkInTime || '12:00 PM'}) by <strong>{earlyCheckInInfo.earlyHours} or(s)</strong>.
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white border border-amber-300 cursor-pointer font-bold text-amber-900 select-none shadow-2xs">
                          <input
                            type="checkbox"
                            checked={applyEarlyCheckInCharge}
                            onChange={(e) => setApplyEarlyCheckInCharge(e.target.checked)}
                            className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                          />
                          <span>Apply Early Check-In Surcharge</span>
                        </label>
                      </div>

                      {applyEarlyCheckInCharge ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-amber-200 text-xs font-mono">
                          <span className="text-amber-900 font-semibold">
                            Surcharge ({earlyCheckInInfo.earlyHours}h @ ₹{Number(hotelSettings?.earlyCheckInHourlyRate) || 0}/h):
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">₹</span>
                            <input
                              type="number"
                              min={0}
                              value={earlyCheckInCustomRate !== '' ? earlyCheckInCustomRate : earlyCheckInInfo.chargeAmount}
                              onChange={(e) => setEarlyCheckInCustomRate(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                              className="w-20 px-2 py-0.5 rounded border border-amber-400 bg-white font-bold text-amber-950"
                            />
                            <button
                              type="button"
                              onClick={() => setApplyEarlyCheckInCharge(false)}
                              className="text-[10px] text-rose-700 hover:text-rose-900 underline ml-1 cursor-pointer font-sans"
                            >
                              Waive Surcharge (₹0)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-800 font-medium italic pt-1 border-t border-amber-200/60 flex items-center justify-between">
                          <span>✓ Early check-in surcharge waived (Included in agreed room tariff at ₹0 extra).</span>
                          <button
                            type="button"
                            onClick={() => setApplyEarlyCheckInCharge(true)}
                            className="text-[10px] text-amber-800 hover:text-amber-950 underline font-bold cursor-pointer font-sans not-italic"
                          >
                            + Add Surcharge (+₹{earlyCheckInInfo.chargeAmount})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Water bottle section removed as requested by user - water bottles logged in Guest Services */}

                </div>
              </div>

            {/* PANEL II: PRIMARY GUEST DETAILS */}
            <div className="space-y-4 border-t border-luxury-brown-100/40 pt-5">
              <div className="flex items-center gap-2 border-b border-luxury-brown-100/60 pb-1.5">
                <Contact className="w-4 h-4 text-[#9E2A2B]" />
                <h3 className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold">II. Primary Guest Particulars</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="As registered in legal ID"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 font-medium focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="Phone Code"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="guest@gmail.com"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Company Name (Optional)</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">GST Number (Optional)</label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 21AAAAA1111A1Z1"
                    maxLength={15}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none font-mono"
                  />

                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Full Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Apartment, Street, Area coordinates"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Berhampur"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">State / Region</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Odisha"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />

                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNationality(val);
                      setCountry(val.trim().toLowerCase() === 'indian' ? 'India' : val.trim() || 'India');
                    }}
                    placeholder="e.g. Indian"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none capitalize font-bold"
                  />
                </div>

                {/* ID DETAILS */}
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Identity ID Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-bold focus:ring-1 focus:ring-[#C5A059]"
                  >
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID Card</option>
                    <option value="Other">Other Government ID</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">ID Card/Proof Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                    placeholder="Enter unique ID number"
                    className="w-full px-3 py-2 border border-[#C5A059] rounded-lg text-sm bg-emerald-50/10 text-luxury-brown-950 font-mono font-bold focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />

                </div>
              </div>

              {/* Page 2 GRC Travel & Birth Particulars: D.O.B, Coming From, Going To, Arrival in India, Duration in India */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Date of Birth (D.O.B)</label>
                  <QuickDateInput
                    value={dob}
                    onChange={setDob}
                    maxYear={new Date().getFullYear()}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-mono focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Coming From</label>
                  <input
                    type="text"
                    value={comingFrom}
                    onChange={(e) => setComingFrom(e.target.value)}
                    placeholder="e.g. Bhubaneswar"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Going To (Next Dest.)</label>
                  <input
                    type="text"
                    value={goingTo}
                    onChange={(e) => setGoingTo(e.target.value)}
                    placeholder="e.g. Puri / Kolkata"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Arrival Date in India</label>
                  <QuickDateInput
                    value={arrivalDateInIndia}
                    onChange={setArrivalDateInIndia}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-950 font-mono focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Duration in India</label>
                  <input
                    type="text"
                    value={durationOfStayInIndia}
                    onChange={(e) => setDurationOfStayInIndia(e.target.value)}
                    placeholder="e.g. 15 Days / Resident"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white text-luxury-brown-905 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
                  />

                </div>
              </div>

              {/* ID Proof File Drag-and-Drop and Upload Zone */}
              <div className="mt-4 p-4 border border-luxury-brown-100 rounded-xl bg-luxury-beige-50/20">
                <label className="text-xs font-mono text-[#9E2A2B] block uppercase font-bold mb-1.5">Save Guest ID Proof Document</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      setIdProofFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = () => {
                        setIdProofFileData(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDraggingFile 
                      ? 'border-[#C5A059] bg-[#C5A059]/10' 
                      : 'border-luxury-brown-200 hover:border-[#C5A059] bg-white hover:bg-luxury-beige-50/10'
                  }`}
                  onClick={() => document.getElementById('id-proof-file-input')?.click()}
                >
                  <input
                    id="id-proof-file-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        setIdProofFileName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => {
                          setIdProofFileData(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-2 bg-[#C5A059]/10 rounded-full text-[#C5A059]">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-luxury-brown-950">
                        {idProofFileName ? `✓ Selected: ${idProofFileName}` : 'Drag & Drop ID Proof File here'}
                      </p>
                      <p className="text-xs text-luxury-brown-500 mt-1">
                        {idProofFileName ? 'Click to change document' : 'or click to browse from local files'}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">PDF, JPG, PNG, DOCX (Max 5MB)</span>
                  </div>

                </div>
              </div>

              {/* Foreign Guest C-Form Data Section */}
              {(isCFormRequired || (nationality && nationality.toLowerCase() !== 'indian')) && (
                <div className="mt-4 p-4 border border-blue-200 bg-blue-50/40 rounded-xl space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-700" />
                      <h4 className="text-xs font-mono font-bold text-blue-900 uppercase tracking-wider">
                        Bureau of Immigration (BoI) C-Form Mandatory Foreign Guest Particulars
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                      Required for Foreign Nationals
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Passport Number *</label>
                      <input
                        type="text"
                        required={isCFormRequired}
                        value={cFormPassportNumber}
                        onChange={(e) => setCFormPassportNumber(e.target.value.toUpperCase())}
                        placeholder="Passport No."
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white text-blue-950 font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Passport Issue Date</label>
                      <input
                        type="date"
                        value={cFormPassportIssueDate}
                        onChange={(e) => setCFormPassportIssueDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Passport Expiry Date *</label>
                      <input
                        type="date"
                        required={isCFormRequired}
                        value={cFormPassportExpiryDate}
                        onChange={(e) => setCFormPassportExpiryDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Visa Number *</label>
                      <input
                        type="text"
                        required={isCFormRequired}
                        value={cFormVisaNumber}
                        onChange={(e) => setCFormVisaNumber(e.target.value.toUpperCase())}
                        placeholder="Visa No."
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white text-blue-950 font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Visa Type</label>
                      <select
                        value={cFormVisaType}
                        onChange={(e) => setCFormVisaType(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white font-semibold text-xs"
                      >
                        <option value="Tourist">Tourist (T-1)</option>
                        <option value="Business">Business (B-1)</option>
                        <option value="Employment">Employment (E-1)</option>
                        <option value="Student">Student (S-1)</option>
                        <option value="Medical">Medical (MED-1)</option>
                        <option value="Conference">Conference (C-1)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Visa Expiry Date *</label>
                      <input
                        type="date"
                        required={isCFormRequired}
                        value={cFormVisaExpiryDate}
                        onChange={(e) => setCFormVisaExpiryDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Port of Arrival in India</label>
                      <input
                        type="text"
                        value={cFormPortOfArrival}
                        onChange={(e) => setCFormPortOfArrival(e.target.value)}
                        placeholder="e.g. IGI Airport New Delhi"
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Next Destination in India</label>
                      <input
                        type="text"
                        value={cFormNextDestination}
                        onChange={(e) => setCFormNextDestination(e.target.value)}
                        placeholder="e.g. Mumbai / Puri"
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-mono text-blue-950 font-bold uppercase block">Permanent Home Address in Country of Origin</label>
                      <input
                        type="text"
                        value={cFormHomeCountryAddress}
                        onChange={(e) => setCFormHomeCountryAddress(e.target.value)}
                        placeholder="Full foreign residential address"
                        className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PANEL III: ADDITIONAL COMPANION GUESTS */}
            <div className="space-y-4 border-t border-luxury-brown-100/40 pt-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-luxury-brown-100/60 pb-1.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#9E2A2B]" />
                  <h3 className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold">III. Secondary Roommates / Companions</h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddSecondaryGuest}
                  className="px-3.5 py-1.5 bg-luxury-brown-900 border border-luxury-gold-450 hover:bg-luxury-brown-800 text-luxury-gold-300 font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Guest
                </button>
              </div>

              {secondaryGuests.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-300 p-6 text-center text-xs italic text-slate-500 rounded-xl">
                  No additional companions appended yet. Under-occupancy rules represent single check-in defaults.
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in pr-1">
                  {secondaryGuests.map((sg, idx) => (
                    <div key={idx} className="bg-luxury-beige-50/20 border border-luxury-brown-200 rounded-xl p-4 space-y-3 relative">
                      <div className="flex justify-between items-center border-b pb-1.5 border-dashed border-luxury-brown-200">
                        <span className="font-serif text-xs font-bold text-luxury-brown-950">Companion Profile #{idx + 2}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSecondaryGuest(idx)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-0.5 col-span-2">
                          <label className="text-[10px] font-mono text-luxury-brown-550 uppercase font-bold block">First & Last Name *</label>
                          <input
                            type="text"
                            required
                            value={sg.fullName}
                            onChange={(e) => handleSecondaryGuestChange(idx, 'fullName', e.target.value)}
                            placeholder="Full Companion Name"
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-950 font-bold"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <label className="text-[10px] font-mono text-luxury-brown-550 uppercase font-bold block">Nationality *</label>
                          <input
                            type="text"
                            required
                            value={sg.nationality}
                            onChange={(e) => handleSecondaryGuestChange(idx, 'nationality', e.target.value)}
                            placeholder="Indian / Foreigner"
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-950 font-bold uppercase font-mono"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <label className="text-[10px] font-mono text-luxury-brown-555 block uppercase font-bold">ID Document Type *</label>
                          <select
                            value={sg.idType || 'Aadhaar'}
                            onChange={(e) => handleSecondaryGuestChange(idx, 'idType', e.target.value)}
                            className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900 font-semibold"
                          >
                            <option value="Aadhaar">Aadhaar Card</option>
                            <option value="Passport">Passport</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Voter ID">Voter ID</option>
                            <option value="Other">Other ID</option>
                          </select>
                        </div>

                        <div className="space-y-0.5 col-span-4 md:col-span-2">
                          <label className="text-[10px] font-mono text-luxury-brown-555 block uppercase font-bold">ID Certificate Number *</label>
                          <input
                            type="text"
                            required
                            value={sg.idNumber || ''}
                            onChange={(e) => handleSecondaryGuestChange(idx, 'idNumber', e.target.value.toUpperCase())}
                            placeholder="Unique Document Index Code"
                            className="w-full px-3 py-1.5 border border-luxury-brown-250 rounded-lg text-xs bg-white text-luxury-brown-950 font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PANEL IV: BILLING & TARIFF MODEL */}
            <div className="space-y-4 border-t border-luxury-brown-100/40 pt-5">
              <div className="flex items-center gap-2 border-b border-luxury-brown-100/60 pb-1.5">
                <Receipt className="w-4 h-4 text-[#9E2A2B]" />
                <h3 className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold">IV. Dynamic Pricing, Extra Guests & Billing Ledger</h3>
              </div>

              {/* Flexible Pricing Model Section (Points 6 & 8) */}
              {checkInMode === 'single' ? (
                <div className="bg-luxury-beige-50/40 p-4 border border-luxury-brown-200 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Standard Catalog Rate</label>
                    <span className="w-full px-3 py-2 border border-luxury-brown-100 bg-gray-100 text-luxury-brown-500 rounded-lg text-sm block font-mono font-bold">
                      ₹{standardRate} / Night
                    </span>
                    <p className="text-[10px] text-gray-400 italic">Default category rack rate</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-[#9E2A2B] block uppercase font-bold" title="Owner Price / Final agreed room rate per night">Owner Price (Final Rate) *</label>
                      <button
                        type="button"
                        onClick={handleRenewPrice}
                        title="Renew/Reset room rate back to standard catalog rate (Point 6)"
                        className="text-[10px] font-mono font-bold text-amber-700 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-200/80 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        ↺ Renew Price
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={roomRate}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setRoomRate(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border-2 border-[#9E2A2B] rounded-lg text-sm bg-white font-mono font-bold text-[#9E2A2B] focus:ring-0 focus:outline-none"
                      placeholder="Adjust Room Tariff directly"
                    />
                    <p className="text-[10px] text-gray-500 italic">Reception can directly overwrite tariff.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-emerald-800 block uppercase font-bold">Discount Concession (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={manualDiscount}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setManualDiscount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm bg-white font-mono font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-500"
                      placeholder="Separate Discount Amount"
                    />
                    <p className="text-[10px] text-gray-500 italic">Extra discount in addition to tariff edit.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-700 block uppercase font-bold">Net Room Charges</label>
                    <span className="w-full px-3 py-2 border border-slate-200 bg-white text-slate-900 font-mono font-bold text-sm rounded-lg block">
                      ₹{Math.max(0, (roomRate * stayNights) - manualDiscount)} ({stayNights} N)
                    </span>
                    <p className="text-[10px] text-slate-500 italic">
                      {roomRate !== standardRate ? `Agreed room tariff: ₹${roomRate}/N` : 'Standard catalog rate'}
                      {manualDiscount > 0 ? ` | Extra Disc: -₹${manualDiscount}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-luxury-beige-50/40 p-4 border border-luxury-brown-200 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Group Nightly Room Tariff</label>
                    <span className="w-full px-3 py-2 border border-luxury-brown-100 bg-white text-luxury-brown-900 rounded-lg text-sm block font-mono font-bold">
                      ₹{groupRoomChargesPerNight.toLocaleString('en-IN')} / Night ({groupRooms.length} Rooms)
                    </span>
                    <p className="text-[10px] text-gray-500 italic">Edit per-room tariff in the Group Allocation table above.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-emerald-800 block uppercase font-bold">Discount Concession (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={manualDiscount}
                      onChange={(e) => setManualDiscount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm bg-white font-mono font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-500"
                      placeholder="Separate Discount Amount"
                    />
                    <p className="text-[10px] text-gray-500 italic">Extra group discount concession.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-700 block uppercase font-bold">Net Group Room Charges</label>
                    <span className="w-full px-3 py-2 border border-slate-200 bg-white text-slate-900 font-mono font-bold text-sm rounded-lg block">
                      ₹{Math.max(0, groupRoomChargesTotal - manualDiscount).toLocaleString('en-IN')} ({stayNights} N)
                    </span>
                    <p className="text-[10px] text-slate-500 italic">
                      {groupRooms.map(gr => `Rm ${gr.roomNumber}: ₹${gr.rate}`).join(' + ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Occupancy and Extra Guest charges review (Strictly Opt-In — ₹0 unless ticked) */}
              <div className="p-4 bg-gray-50 border border-slate-300 rounded-xl space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700 font-mono uppercase text-[10px]">
                      Extra Person Billing:
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        applyExtraPersonCharge && effectiveExtraPersonChargesTotal > 0
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {applyExtraPersonCharge && effectiveExtraPersonChargesTotal > 0
                        ? `+ ₹${effectiveExtraPersonChargesTotal} Added to Bill`
                        : '₹0 (Included in Room Tariff)'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-600 font-bold bg-white px-2 py-1 border border-gray-200 rounded">
                      {checkInMode === 'single'
                        ? `Guests: ${totalOccupants} · Capacity: ${baseOccupancy} Base / ${selectedRoomMaxOccupancy} Max`
                        : `Guests: ${effectiveTotalOccupants} · Base: ${effectiveBaseOccupancy} (${groupRooms.length} Rooms)`}
                    </span>
                    <label className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-purple-300 rounded-lg cursor-pointer font-bold text-xs select-none shadow-2xs hover:bg-purple-50">
                      <input
                        type="checkbox"
                        checked={applyExtraPersonCharge}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          extraChargeTouchedRef.current = true;
                          setApplyExtraPersonCharge(checked);
                          if (checked && manualExtraPaxCount === '') {
                            setManualExtraPaxCount(Math.max(1, effectiveExtraGuestsCount));
                            setExtraPersonQty(Math.max(1, effectiveExtraGuestsCount));
                          }
                        }}
                        className="w-4 h-4 accent-purple-700 cursor-pointer"
                      />
                      <span className="text-slate-800">
                        {applyExtraPersonCharge ? 'Extra Person Fee Applied' : 'Charge Extra Person Fee?'}
                      </span>
                    </label>
                  </div>
                </div>

                {applyExtraPersonCharge && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-xs font-mono">
                    {checkInMode === 'single' ? (
                      <div className="space-y-1">
                        <span className="text-gray-500 block text-[9px] uppercase font-bold">Extra Persons Count</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={resolvedSingleExtraPaxCount}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            extraChargeTouchedRef.current = true;
                            setManualExtraPaxCount(val);
                            setExtraPersonQty(Math.max(1, val));
                          }}
                          className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg bg-white font-bold text-slate-900"
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="text-gray-500 block text-[9px] uppercase font-bold">Extra Occupant Count</span>
                        <span className="text-sm font-bold block text-slate-900">{effectiveExtraGuestsCount} Persons</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="text-gray-500 block text-[9px] uppercase font-bold">Extra Person Rate / Night (₹)</span>
                      <input
                        type="number"
                        min={0}
                        value={extraPersonCharge}
                        onChange={(e) => setExtraPersonCharge(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <span className="text-teal-800 block text-[9px] font-sans font-bold uppercase">Extra Person Total ({stayNights}N)</span>
                      <span className="text-sm font-bold block text-teal-700 pt-1.5">+ ₹{effectiveExtraPersonChargesTotal}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Hotel Services: charged only when the admin ticks them */}
              {checkInMode === 'single' && (
                <div className="p-4 bg-[#FDF8ED] border border-[#C49A3A]/50 rounded-xl space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#263449] font-mono uppercase text-[10px] block">Optional Hotel Services</span>
                      <span className="text-[11px] text-slate-600">
                        Ask the guest first, then tick only the services they want. Ticked services are added to the bill.
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-teal-700 bg-white px-2 py-0.5 border border-teal-200 rounded">
                      Services Total: + ₹{servicesTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {serviceCatalog.length === 0 ? (
                    <p className="text-[11px] italic text-slate-500">
                      No hotel services configured yet. Add them under Front Desk, then Guest Services.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {serviceCatalog.map(s => {
                        const sid = String(s.id);
                        const checked = selectedServiceIds.includes(sid);
                        return (
                          <label
                            key={sid}
                            className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer ${
                              checked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-2 font-semibold text-[#263449] text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e =>
                                  setSelectedServiceIds(prev =>
                                    e.target.checked ? [...prev, sid] : prev.filter(x => x !== sid)
                                  )
                                }
                                className="w-4 h-4 accent-[#15805D]"
                              />
                              {s.serviceName}
                            </span>
                            <span className="font-mono font-bold text-[#263449] text-xs">
                              ₹{serviceAmountOf(s).toLocaleString('en-IN')}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Early Check-In Surcharge Row in Billing Ledger (Waived / Included by default) */}
              {earlyCheckInInfo.isEarly && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl flex items-center justify-between flex-wrap gap-2.5 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-950 font-mono uppercase text-[10.5px] flex items-center gap-1">
                        ⚡ Early Check-In ({earlyCheckInInfo.earlyHours}h before {hotelSettings?.checkInTime || '12:00 PM'})
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        applyEarlyCheckInCharge
                          ? 'bg-amber-200 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {applyEarlyCheckInCharge ? `+₹${effectiveEarlyCheckInCharge} Added to Bill` : 'Waived (₹0 / In Room Tariff)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Standard hourly rate is ₹{Number(hotelSettings?.earlyCheckInHourlyRate) || 0}/or. Default is waived so agreed room rate (₹{roomRate}) stays exact.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 rounded-lg cursor-pointer font-bold text-xs select-none shadow-2xs hover:bg-amber-50">
                    <input
                      type="checkbox"
                      checked={applyEarlyCheckInCharge}
                      onChange={(e) => setApplyEarlyCheckInCharge(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 cursor-pointer"
                    />
                    <span className="text-slate-800">
                      {applyEarlyCheckInCharge ? `Apply Surcharge (+₹${effectiveEarlyCheckInCharge})` : 'Keep Waived (₹0 Extra)'}
                    </span>
                  </label>
                </div>
              )}

              {/* Aux or Miscellaneous Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Other auxiliary charges</label>
                  <input
                    type="number"
                    min={0}
                    value={otherCharges || ''}
                    onChange={(e) => setOtherCharges(Number(e.target.value))}
                    placeholder="Food, Room costs, Laundry etc."
                    className="w-full px-3 py-2 border border-luxury-brown-250 rounded-lg text-sm bg-white font-mono font-bold"
                  />
                </div>

                <div className="space-y-1 font-mono">
                  <div className="flex items-center justify-between gap-1">
                    <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">
                      {selectedBooking ? 'Already Paid Advance' : 'Advance Deposit'}
                    </label>
                    {selectedBooking && Number(selectedBooking.advanceAmount) > 0 && (
                      <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Carried Forward
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    readOnly={Boolean(selectedBooking && Number(selectedBooking.advanceAmount) > 0)}
                    value={advanceAmount || ''}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    placeholder="0"
                    className={`w-full px-3 py-2 border border-luxury-brown-250 rounded-lg text-sm font-bold ${
                      selectedBooking && Number(selectedBooking.advanceAmount) > 0
                        ? 'bg-emerald-50/40 text-emerald-900 cursor-not-allowed'
                        : 'bg-white'
                    }`}
                  />
                </div>

                <div className="space-y-1 font-mono">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Paid Amount (Check-In Payment)</label>
                  <input
                    type="number"
                    min={0}
                    readOnly={isHybridCheckInPay}
                    value={isHybridCheckInPay ? effectiveDeskReceivedNow : (paidAmount || '')}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    placeholder="Enter amount paid now"
                    className={`w-full px-3 py-2 border border-luxury-brown-250 rounded-lg text-sm font-bold ${isHybridCheckInPay ? 'bg-emerald-50/50 text-emerald-900 cursor-not-allowed' : 'bg-white'}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Payment Date &amp; Mode *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-2 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-950 font-mono font-bold"
                    />
                    <select
                      value={isHybridCheckInPay ? 'Hybrid' : paymentMethod}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Hybrid') {
                          setIsHybridCheckInPay(true);
                          const targetRem = Math.max(0, finalAmount - advanceAmount);
                          const seedTotal = Number(paidAmount) > 0 ? Number(paidAmount) : targetRem;
                          const half = Math.floor(seedTotal / 2);
                          setCheckInSplitRows([
                            { id: 'chk-split-1', method: 'Cash', amount: half, reference: '' },
                            { id: 'chk-split-2', method: 'UPI', amount: Math.max(0, Math.round((seedTotal - half) * 100) / 100), reference: '' },
                          ]);
                        } else {
                          setIsHybridCheckInPay(false);
                          setPaymentMethod(val as any);
                        }
                      }}
                      className="w-full px-2 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-950 font-bold focus:ring-1 focus:ring-[#C5A059]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Hybrid">⇄ Hybrid / Split</option>
                      <option value="Voucher">Voucher</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                </div>
              </div>

              {isHybridCheckInPay && (
                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#C49A3A]/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-serif font-bold text-luxury-brown-950 block">
                        ⇄ Hybrid / Split Payment Breakdown
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Combine Cash, UPI, Card, or Bank Transfer. At least 2 methods with ₹ &gt; 0 required.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCheckInSplitRows((prev) => [
                          ...prev,
                          { id: `chk-split-${Date.now()}`, method: 'Card', amount: 0, reference: '' },
                        ])
                      }
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FFF6DF] border border-[#C49A3A] text-xs font-bold text-luxury-brown-900 cursor-pointer"
                    >
                      + Add Method
                    </button>
                  </div>

                  <div className="space-y-2">
                    {checkInSplitRows.map((sp, idx) => (
                      <div
                        key={sp.id}
                        className="grid grid-cols-1 sm:grid-cols-[150px_150px_1fr_auto] gap-2.5 items-end bg-white p-2.5 rounded-xl border border-luxury-brown-200/80"
                      >
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Method #{idx + 1}</label>
                          <select
                            value={sp.method}
                            onChange={(e) =>
                              setCheckInSplitRows((prev) =>
                                prev.map((r) => (r.id === sp.id ? { ...r, method: e.target.value as any } : r))
                              )
                            }
                            className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white"
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Received ₹</label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={sp.amount === '' ? '' : sp.amount}
                            onChange={(e) =>
                              setCheckInSplitRows((prev) =>
                                prev.map((r) =>
                                  r.id === sp.id ? { ...r, amount: e.target.value === '' ? '' : Number(e.target.value) } : r
                                )
                              )
                            }
                            placeholder="0"
                            className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Reference / UTR (Optional)</label>
                          <input
                            type="text"
                            value={sp.reference}
                            onChange={(e) =>
                              setCheckInSplitRows((prev) =>
                                prev.map((r) => (r.id === sp.id ? { ...r, reference: e.target.value } : r))
                              )
                            }
                            placeholder="UTR / Slip / Txn ID"
                            className="w-full px-2.5 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={checkInSplitRows.length <= 2}
                          onClick={() => setCheckInSplitRows((prev) => prev.filter((r) => r.id !== sp.id))}
                          className="px-2.5 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-30 text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-luxury-brown-200/70 text-xs font-mono">
                    <span className="text-slate-600">
                      Combined Check-In Payment: <strong className="text-emerald-700">₹{effectiveDeskReceivedNow.toLocaleString('en-IN')}</strong>
                    </span>
                    <span className={balanceAmount > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                      Remaining Balance Due: ₹{balanceAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}

              {/* Voucher No. + With GST vs Without GST Billing Mode Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5 bg-[#FAF6F0] border border-[#E6DCCF] rounded-xl">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-700 block uppercase font-bold">
                    Voucher / Tour Ref. No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={voucherNumber}
                    onChange={(e) => setVoucherNumber(e.target.value)}
                    placeholder="e.g. VCH-2026-109"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-mono text-luxury-brown-700 uppercase font-bold">
                      Check-In Tax / Billing Mode (With GST vs No GST)
                    </label>
                    {isCheckInGstLockedByExistingInvoice && existingStayPrimaryInvoice && (
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                        🔒 Locked by Invoice #{existingStayPrimaryInvoice.invoiceNumber}
                      </span>
                    )}
                  </div>
                  {isCheckInGstLockedByExistingInvoice && existingStayPrimaryInvoice ? (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                      Invoice <strong>#{existingStayPrimaryInvoice.invoiceNumber}</strong> is already generated ({gstPercent > 0 ? `With GST ${gstPercent}%` : 'No GST 0%'}). GST cannot be edited on a generated invoice — generate a separate invoice from Billing &amp; Invoices if needed.
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#FFFDF7] border border-luxury-brown-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-mono uppercase font-bold text-luxury-brown-900 block">
                            GST Billing Mode *
                          </label>
                          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                            checkInGstMode === 'non_gst'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : checkInGstMode === 'including_gst'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {checkInGstMode === 'non_gst'
                              ? 'Non-GST (0% Bill of Supply)'
                              : checkInGstMode === 'including_gst'
                              ? `Including GST (${gstPercent || configuredDefaultGst || 5}%)`
                              : `GST Extra (+${gstPercent || configuredDefaultGst || 5}%)`}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCheckInGstMode('non_gst');
                              setGstPercent(0);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              checkInGstMode === 'non_gst'
                                ? 'bg-amber-100 border-[#C49A3A] text-amber-950 font-bold shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-xs font-bold">1. Non-GST (0%)</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Bill of Supply • No Tax</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCheckInGstMode('gst_extra');
                              setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              checkInGstMode === 'gst_extra'
                                ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-xs font-bold">2. GST Extra (+{configuredDefaultGst > 0 ? configuredDefaultGst : 5}%)</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Rate + GST Added on Top</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCheckInGstMode('including_gst');
                              setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              checkInGstMode === 'including_gst'
                                ? 'bg-blue-100 border-blue-500 text-blue-950 font-bold shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-xs font-bold">3. Including GST ({configuredDefaultGst > 0 ? configuredDefaultGst : 5}%)</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Tariff Includes GST (Net ₹{roomRate || 0})</div>
                          </button>
                        </div>
                      </div>
                      {existingStayPrimaryInvoice && !editingCheckIn && (
                        <p className="text-[10px] text-amber-800 font-medium">
                          Note: Advance invoice #{existingStayPrimaryInvoice.invoiceNumber} already exists. Keeping the same tax mode preserves it; changing tax mode here will issue a separate new invoice without modifying #{existingStayPrimaryInvoice.invoiceNumber}.
                        </p>
                      )}
                    </>
                  )}

                </div>
              </div>

              {/* Existing POS / Room Service / Folio Charges Carried Forward */}
              {existingStayFolioCharges.length > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-900">
                    <span>Existing Booking / POS Room Folio Charges (Carried Forward)</span>
                    <span>+ ₹{existingStayFolioSubtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {existingStayFolioCharges.map((fc, idx) => (
                    <div key={`${fc.id}-${idx}`} className="flex items-center justify-between text-[11px] text-slate-700">
                      <span>• {fc.description}</span>
                      <span className="font-bold text-slate-900">₹{Number(fc.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Transparent Line-Items Billing Summary */}
              <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-xl border border-luxury-brown-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Room Tariff: <strong className="text-slate-900">₹{effectiveRoomChargesTotal.toLocaleString('en-IN')}</strong>{' '}
                    ({checkInMode === 'group'
                      ? `${groupRooms.length} Rooms × ${stayNights} Night${stayNights > 1 ? 's' : ''}`
                      : `${stayNights} Night${stayNights > 1 ? 's' : ''} × ₹${roomRate}`})
                  </span>
                  {earlyCheckInInfo.isEarly && (
                    effectiveEarlyCheckInCharge > 0 ? (
                      <span className="text-amber-700 font-semibold">+ Early Check-In: <strong>₹{effectiveEarlyCheckInCharge}</strong></span>
                    ) : (
                      <span className="text-emerald-700 font-medium">Early Check-In: <strong>₹0 (Waived)</strong></span>
                    )
                  )}
                  {effectiveExtraBedTotal > 0 && (
                    <span className="text-amber-800 font-semibold">+ Extra Bed: <strong>₹{effectiveExtraBedTotal}</strong></span>
                  )}
                  {effectiveExtraPersonChargesTotal > 0 && (
                    <span className="text-purple-700 font-semibold">+ Extra Person: <strong>₹{effectiveExtraPersonChargesTotal}</strong></span>
                  )}
                  {servicesTotal > 0 && (
                    <span className="text-teal-700 font-semibold">+ Services: <strong>₹{servicesTotal}</strong></span>
                  )}
                  {existingStayFolioSubtotal > 0 && (
                    <span className="text-orange-700 font-semibold">+ POS / Folio: <strong>₹{existingStayFolioSubtotal}</strong></span>
                  )}
                  {otherCharges > 0 && (
                    <span className="text-slate-700 font-semibold">+ Auxiliary: <strong>₹{otherCharges}</strong></span>
                  )}
                  {manualDiscount > 0 && (
                    <span className="text-rose-700 font-semibold">- Discount: <strong>₹{manualDiscount}</strong></span>
                  )}
                  {gstPercent > 0 && (
                    <span className="text-emerald-700 font-semibold">+ GST ({gstPercent}%): <strong>₹{gstTax}</strong></span>
                  )}
                </div>
                <div className="font-bold text-slate-900 border-l border-slate-300 pl-3">
                  Grand Total: <strong className="text-emerald-800 text-xs">₹{finalAmount.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* Complete calculations review block (Light Luxury Theme) */}
              <div className="p-4 bg-[#FAF7F2] text-slate-900 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs border border-luxury-brown-200/90 shadow-2xs">
                <div className="border-r border-slate-200/80 pr-3 text-center md:text-left">
                  <span className="text-luxury-brown-550 uppercase block text-[9px] font-bold">Final Amount</span>
                  <span className="text-lg font-bold text-slate-900">₹{finalAmount.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 block pt-0.5">Stay with {gstPercent > 0 ? 'GST' : 'no GST'} & extras</span>
                </div>
                <div className="border-r border-slate-200/80 pr-3 text-center md:text-left">
                  <span className="text-luxury-brown-550 uppercase block text-[9px] font-bold">Paid Amount</span>
                  <span className="text-lg font-bold text-emerald-700">₹{effectiveDeskReceivedNow.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 block pt-0.5">Paid at desk check-in</span>
                </div>
                <div className="border-r border-slate-200/80 pr-3 text-center md:text-left">
                  <span className="text-luxury-brown-550 uppercase block text-[9px] font-bold">Already Paid / Advance</span>
                  <span className="text-lg font-bold text-slate-800">₹{advanceAmount.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 block pt-0.5">Prepaid booking amount</span>
                </div>
                <div className="text-center md:text-left">
                  <span className="text-[#8B691E] uppercase block text-[9px] font-bold tracking-widest">Balance Due</span>
                  <span className="text-xl font-bold text-slate-900">₹{balanceAmount.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 block pt-0.5">Outstanding balance due</span>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-4 no-print">
              <button
                type="submit"
                className="w-full py-3.5 bg-[#F6DE98] hover:bg-[#E8CE84] border-2 border-[#C49A3A] text-[#17120F] font-bold text-sm tracking-wide rounded-xl flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-99"
              >
                <FileCheck className="w-5 h-5 text-[#8B691E]" />
                {editingCheckIn
                  ? `UPDATE WALK-IN / STAY DETAILS (${editingCheckIn.id}) & SAVE`
                  : selectedBooking
                  ? `COMPLETE RESERVATION CHECK-IN (${selectedBooking.id}) & GENERATE SLIP`
                  : effectiveMode === 'walkin'
                  ? 'COMPLETE WALK-IN REGISTRATION & CHECK-IN GUEST'
                  : 'SAVE HOTEL COMPLIANCE REGISTRATION & COMPLETE CHECK-IN'}
              </button>
            </div>
            
          </form>
              </>
            ) : (
              <>
            {/* REDESIGNED SINGLE-PAGE CHECK-IN & RESERVATION WORKSPACE (DirectStay Light Luxury Theme) */}
            <form onSubmit={handleSaveCheckIn} className="space-y-4">
              {/* TOP ACTION BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F4F6F9] border border-[#DCE3EC] rounded-2xl px-4 py-3 shadow-2xs no-print">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base sm:text-lg font-serif font-bold text-[#263449]">
                    {editingCheckIn
                      ? `Edit Stay — #${editingCheckIn.id}`
                      : selectedBooking
                      ? `Check-In Reservation — #${selectedBooking.id}`
                      : isFutureAdvanceArrival
                      ? 'New Advance Reservation'
                      : 'New Check-In & Reservation'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAdvanceLookup(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      showAdvanceLookup || selectedBooking
                        ? 'bg-[#FDF8ED] border-[#C49A3A] text-[#8B691E]'
                        : 'bg-white border-[#DCE3EC] text-[#263449] hover:bg-[#F4F6F9]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {selectedBooking
                      ? `Loaded: ${selectedBooking.id}`
                      : `Load Existing Booking (${eligibleReservations.length})`}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('folios')}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F4F6F9] border border-[#DCE3EC] text-xs font-bold text-[#263449] cursor-pointer"
                  >
                    ← Folios &amp; History
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingAction}
                    onClick={() => handleCreateReservationAction('Draft', 'Draft Saved')}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FDF8ED] border border-[#C2CDD9] text-xs font-bold text-[#263449] cursor-pointer disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-1.5 rounded-lg bg-[#C49A3A] hover:bg-[#A8812B] text-white border border-[#A8812B] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    {editingCheckIn
                      ? 'Update Stay'
                      : isFutureAdvanceArrival
                      ? 'Confirm Advance Booking'
                      : selectedBooking
                      ? 'Complete Check-In Now'
                      : 'Reserve & Check-In Now'}
                  </button>
                </div>
              </div>

              {/* INLINE BACKEND-CONFIRMED SUCCESS BANNER */}
              {inlineBookingSuccess && (
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in no-print">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-mono font-bold uppercase">
                        ✓ Confirmed by Server
                      </span>
                      <span className="text-sm font-serif font-bold text-emerald-950">
                        {inlineBookingSuccess.actionLabel} — #{inlineBookingSuccess.id}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 font-mono">
                      Guest: <strong>{inlineBookingSuccess.guestName}</strong> • Room(s):{' '}
                      <strong>{inlineBookingSuccess.roomsLabel}</strong> • Stay:{' '}
                      <strong>
                        {formatDdmmyyyy(inlineBookingSuccess.checkInDate)} → {formatDdmmyyyy(inlineBookingSuccess.checkOutDate)}
                      </strong>{' '}
                      • Total: <strong>₹{inlineBookingSuccess.totalAmount.toLocaleString('en-IN')}</strong> • Paid:{' '}
                      <strong>₹{inlineBookingSuccess.paidAmount.toLocaleString('en-IN')}</strong> ({inlineBookingSuccess.status})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeSessionBookingId && inlineBookingSuccess.status !== 'Checked-In' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSessionBookingId(null);
                          setSelectedBooking(null);
                          setInlineBookingSuccess(null);
                          setWalkInIdSeed(Number(String(Date.now()).slice(-6)) + 1);
                          showToast('Started a fresh booking session. Previous Draft/Waitlist stays saved.', 'info');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FDF8ED] border border-[#C49A3A] text-[#8B691E] text-xs font-bold hover:bg-[#F6E9C8] cursor-pointer"
                      >
                        + Start Fresh Booking
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setInlineBookingSuccess(null)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* MAIN 2-COLUMN WORKSPACE: LEFT STICKY SIDEBAR + RIGHT SINGLE-PAGE SECTIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)] gap-5 items-start">
                {/* ================= LEFT SIDEBAR ================= */}
                <div className="space-y-4 lg:sticky lg:top-4 no-print bg-transparent">
                  {/* CARD 1: LIVE GUEST PREVIEW */}
                  <div className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-[#F4F6F9] border-b border-[#DCE3EC]/80 flex items-center justify-between">
                      <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-[#263449] flex items-center gap-1.5">
                        <Contact className="w-3.5 h-3.5 text-[#C49A3A]" /> GUEST PREVIEW
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50 text-[9px] font-mono font-extrabold uppercase">
                        {bookingCategory === 'event' ? 'EVENT' : bookingCategory.toUpperCase()}
                      </span>
                    </div>

                    <div className="p-4 space-y-3 text-xs">
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                          PRIMARY GUEST / NAME
                        </span>
                        <p className={`text-sm font-serif font-bold mt-0.5 ${guestName.trim() ? 'text-[#263449]' : 'text-slate-400 italic'}`}>
                          {guestName.trim() || 'Not entered yet'}
                        </p>
                        {mobile.trim() && (
                          <span className="text-[11px] font-mono text-slate-600 block">{mobile}</span>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-[#DCE3EC] font-mono text-[11px]">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Dates:</span>
                          <strong className="text-[#263449] text-right">
                            {formatDdmmyyyy(checkInDate)} → {formatDdmmyyyy(checkOutDate)}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Duration:</span>
                          <strong className="text-[#263449]">
                            {stayNights} night{stayNights === 1 ? '' : 's'}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Guests (Pax):</span>
                          <strong className="text-[#263449] text-right">
                            {checkInMode === 'group'
                              ? `${groupRooms.reduce((s, r) => s + (Number(r.adults) || 0), 0)} Adult, ${groupRooms.reduce((s, r) => s + (Number(r.children) || 0), 0)} Child${secondaryGuests.length > 0 ? ` (+${secondaryGuests.length} Extra)` : ''}`
                              : `${Number(adults) || 0} Adult, ${Number(children) || 0} Child${secondaryGuests.length > 0 ? ` (+${secondaryGuests.length} Extra)` : ''}`}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Room(s):</span>
                          <strong className="text-[#263449] text-right truncate max-w-[140px]">
                            {checkInMode === 'group'
                              ? groupRooms.length > 0
                                ? `${groupRooms.length} Rm (${groupRooms.map(r => r.roomNumber).join(', ')})`
                                : 'Not selected'
                              : selectedRoomNumber
                              ? `Rm ${selectedRoomNumber} (${roomType || 'Std'})`
                              : 'Not selected'}
                          </strong>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-[#DCE3EC] space-y-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Room Tariff:</span>
                          <strong className="text-[#263449]">
                            ₹{effectiveRoomChargesTotal.toLocaleString('en-IN')}
                          </strong>
                        </div>

                        {applyExtraPersonCharge && (
                          <div className="flex items-center justify-between text-[#8B691E]">
                            <span className="truncate pr-1">
                              Extra Person ({Math.max(1, Number(extraPersonQty) || 1)}×₹{effectiveExtraPaxRate}×{effectiveExtraPaxNights}N):
                            </span>
                            <strong className="shrink-0">
                              ₹{effectiveExtraPersonChargesTotal.toLocaleString('en-IN')}
                            </strong>
                          </div>
                        )}

                        {((checkInMode === 'single' && hasExtraBed && activeSelectedRoomObj?.allowExtraBed !== false) ||
                          (checkInMode === 'group' && groupRooms.some(g => g.hasExtraBed))) && (
                          <div className="flex items-center justify-between text-amber-800">
                            <span className="truncate pr-1">
                              Extra Bed/Mattress
                              {checkInMode === 'single'
                                ? ` (${singleExtraCalc.extraBedQty}×₹${singleExtraCalc.extraBedRate}×${singleExtraCalc.extraBedNights}N)`
                                : ''}
                              :
                            </span>
                            <strong className="shrink-0">
                              ₹{effectiveExtraBedTotal.toLocaleString('en-IN')}
                            </strong>
                          </div>
                        )}

                        {!editingCheckIn && chargeableWaterBottles > 0 && chargeableWaterTotal > 0 && (
                          <div className="flex items-center justify-between text-sky-800">
                            <span>Water Bottles ({chargeableWaterBottles} × ₹{effectiveChargeableWaterRate}):</span>
                            <strong>₹{chargeableWaterTotal.toLocaleString('en-IN')}</strong>
                          </div>
                        )}

                        {(otherCharges + servicesTotal + customAddonTotal + earlyCheckInCharge + existingStayFolioSubtotal) > 0 && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Add-ons / Folio:</span>
                            <strong className="text-[#263449]">
                              ₹{(otherCharges + servicesTotal + customAddonTotal + earlyCheckInCharge + existingStayFolioSubtotal).toLocaleString('en-IN')}
                            </strong>
                          </div>
                        )}

                        {totalEffectiveDiscount > 0 && (
                          <div className="flex items-center justify-between text-rose-700">
                            <span>Discount / Adj.:</span>
                            <strong>− ₹{totalEffectiveDiscount.toLocaleString('en-IN')}</strong>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-slate-600">
                          <span>GST ({gstPercent}%):</span>
                          <strong className="text-[#263449]">₹{gstTax.toLocaleString('en-IN')}</strong>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-[#DCE3EC]">
                          <span className="text-xs font-bold text-[#263449]">Final Settlement:</span>
                          <strong className="text-base font-extrabold text-[#8B691E]">
                            ₹{finalAmount.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-700 font-semibold">
                            Paid: ₹{(advanceAmount + effectiveDeskReceivedNow).toLocaleString('en-IN')}
                          </span>
                          <span className={balanceAmount > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                            {balanceAmount > 0 ? `Pending: ₹${balanceAmount.toLocaleString('en-IN')}` : 'SETTLED'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: BOOKING TYPE SELECTOR */}
                  <div className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs p-3.5 space-y-2.5">
                    <span className="text-xs font-serif font-bold text-[#263449] block px-1">
                      Booking type
                    </span>
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                      {(
                        [
                          {
                            id: 'individual',
                            title: 'Individual',
                            sub: 'Single guest or family',
                            icon: UserCheck,
                          },
                          {
                            id: 'group',
                            title: 'Group',
                            sub: 'Block of rooms • rooming list',
                            icon: Users,
                          },
                          {
                            id: 'corporate',
                            title: 'Corporate',
                            sub: 'Negotiated rate • direct bill',
                            icon: Building,
                          },
                          {
                            id: 'event',
                            title: 'Event / Banquet',
                            sub: 'Venue • catering + AV',
                            icon: Sparkles,
                          },
                        ] as const
                      ).map(item => {
                        const Icon = item.icon;
                        const active = bookingCategory === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectBookingCategory(item.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                              active
                                ? 'bg-[#FDF8ED] border-[#C49A3A] shadow-2xs'
                                : 'bg-white border-transparent hover:bg-[#F4F6F9] hover:border-[#DCE3EC]/70'
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 mt-0.5 shrink-0 ${
                                active ? 'text-[#8B691E]' : 'text-slate-400'
                              }`}
                            />
                            <div>
                              <span
                                className={`text-xs font-bold block leading-tight ${
                                  active ? 'text-[#8B691E]' : 'text-[#263449]'
                                }`}
                              >
                                {item.title}
                              </span>
                              <span className="text-[10.5px] text-slate-500 block mt-0.5">
                                {item.sub}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ================= MAIN RIGHT SINGLE-PAGE FORM ================= */}
                <div className="space-y-4">
                  {/* SECTION 1: STAY & RATE */}
                  <section className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-serif font-bold text-[#263449]">
                          Stay &amp; rate
                        </h3>
                        <p className="text-xs text-slate-500">
                          Stay dates (Asia/Kolkata • DD-MM-YYYY), room allocation, meal plan &amp; rate plan
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isSameDayStay ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckOutDate(getFutureDateStr(1, checkInDate || todayIstStr));
                              setStayHours('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-300 text-indigo-900 text-xs font-mono font-bold hover:bg-indigo-100 transition-all cursor-pointer shadow-xs"
                            title="Switch to overnight stay (1 night)"
                          >
                            <span>🌙 Switch to Overnight (1 Night)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckOutDate(checkInDate);
                              setStayHours(3);
                              const in24 = to24hTime(arrivalTime, getIstNowParts().hhmm);
                              const out24 = to24hTime(departureTime, '18:00');
                              if (out24 <= in24) {
                                handleSelectStayHours(3);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-[#C49A3A]/60 text-amber-900 text-xs font-mono font-bold hover:bg-amber-100 transition-all cursor-pointer shadow-xs"
                            title="Set same-day hourly stay"
                          >
                            <span>⚡ Same-Day Stay</span>
                          </button>
                        )}
                        {isFutureAdvanceArrival && (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-mono font-bold">
                            Advance Booking Mode • Room stays Available until Check-In
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Optional Existing Advance Reservation Selector */}
                    {(showAdvanceLookup || selectedBooking) && !editingCheckIn && (
                      <div className="space-y-2.5 bg-[#FDF8ED] p-3.5 rounded-xl border border-[#D4AD50]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold uppercase text-[#8B691E] flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5" />
                            {arrivalQueueFilter === 'today'
                              ? `Today's Advance Arrivals (${todayEligibleReservations.length})`
                              : arrivalQueueFilter === 'date'
                              ? `Advance Arrivals for ${formatDdmmyyyy(filterArrivalDate)} (${dateEligibleReservations.length})`
                              : `All Advance Bookings (${eligibleReservations.length})`}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                            <button
                              type="button"
                              onClick={() => setArrivalQueueFilter('all')}
                              className={`px-2 py-1 rounded font-bold cursor-pointer ${
                                arrivalQueueFilter === 'all' ? 'bg-[#C49A3A] text-white' : 'bg-white border border-[#DCE3EC] text-slate-700'
                              }`}
                            >
                              All ({eligibleReservations.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setArrivalQueueFilter('today')}
                              className={`px-2 py-1 rounded font-bold cursor-pointer ${
                                arrivalQueueFilter === 'today' ? 'bg-[#C49A3A] text-white' : 'bg-white border border-[#DCE3EC] text-slate-700'
                              }`}
                            >
                              Today ({todayEligibleReservations.length})
                            </button>
                            <input
                              type="date"
                              value={filterArrivalDate}
                              onChange={e => {
                                setFilterArrivalDate(e.target.value);
                                setArrivalQueueFilter('date');
                              }}
                              className="px-2 py-0.5 rounded border border-[#DCE3EC] bg-white text-[11px] font-mono font-bold"
                            />
                            {selectedBooking && (
                              <button
                                type="button"
                                onClick={() => setSelectedBooking(null)}
                                className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-slate-200 font-bold cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={resSearchQuery}
                              onChange={e => setResSearchQuery(e.target.value)}
                              placeholder="Booking ID, Name or Mobile..."
                              className="w-full pl-8 pr-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white font-mono"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <select
                              value={selectedBooking?.id || ''}
                              onChange={e => {
                                const found = bookings.find(b => b.id === e.target.value);
                                if (found) handleSelectAdvanceBooking(found);
                                else setSelectedBooking(null);
                              }}
                              className="w-full px-3 py-1.5 border border-[#C2CDD9] rounded-lg text-xs bg-white font-bold text-[#263449]"
                            >
                              <option value="">
                                {filteredEligibleReservations.length === 0
                                  ? "-- No pending advance bookings found (switch to 'All' to view all dates) --"
                                  : '-- Select Advance Booking to Auto-Fill --'}
                              </option>
                              {filteredEligibleReservations.map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.id} — {b.guestName} • Rm {b.roomNumber || 'TBD'} ({formatDdmmyyyy(b.checkInDate)} → {formatDdmmyyyy(b.checkOutDate)}) • Adv ₹{Number(b.advanceAmount || 0).toLocaleString('en-IN')}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Row 1: Arrival Date & Time | Departure Date & Time (Spacious 2-Column Row — Zero Overlap!) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-[#263449]">
                            Choose Date <span className="text-[#A8812B]">*</span>
                          </label>
                          <span className="text-[10px] font-mono font-bold text-[#8B691E]">
                            {formatDdmmyyyy(checkInDate)} / {arrivalTime}
                          </span>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
                          <input
                            type="date"
                            required
                            value={checkInDate}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={e => handleArrivalDateChange(e.target.value)}
                            onBlur={handleArrivalDateBlur}
                            className="w-full min-w-0 px-2.5 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                          <TimePicker12h
                            value={arrivalTime}
                            onChange={(_, hhmm24) => handleArrivalTimeChange(hhmm24)}
                            title="Arrival Time (12-Hour AM / PM)"
                            className="py-0.5"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-[#263449] flex items-center gap-1.5">
                            <span>Departure</span>
                            <span className="text-[#A8812B]">*</span>
                            {isSameDayStay && (
                              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                                Same-Day
                              </span>
                            )}
                          </label>
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            {formatDdmmyyyy(checkOutDate)} / {departureTime}
                          </span>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
                          <input
                            type="date"
                            required
                            value={checkOutDate}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={e => handleDepartureDateChange(e.target.value)}
                            onBlur={handleDepartureDateBlur}
                            className="w-full min-w-0 px-2.5 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                          <TimePicker12h
                            value={departureTime}
                            onChange={(_, hhmm24) => handleDepartureTimeChange(hhmm24)}
                            title="Departure Time (12-Hour AM / PM)"
                            className="py-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 1b: Stay Duration (Nights/Hours) | Booking Source */}
                    <div className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">
                          {isSameDayStay ? 'Stay Duration (Hours)' : 'Stay Nights'}
                        </label>
                        <div className={`py-2 px-2.5 rounded-xl border text-center text-xs font-mono font-extrabold whitespace-nowrap ${
                          isSameDayStay
                            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                            : 'border-[#DCE3EC] bg-[#F4F6F9] text-[#263449]'
                        }`}>
                          {isSameDayStay
                            ? `${stayHours || computedStayHours || 3} hrs`
                            : `${stayNights} Night${stayNights > 1 ? 's' : ''}`}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">
                          Booking Source <span className="text-[#A8812B]">*</span>
                        </label>
                        <select
                          value={walkInBookingSource}
                          onChange={e => {
                            const v = e.target.value as BookingSource;
                            setWalkInBookingSource(v);
                            if (v !== 'Travel Agent') setSelectedAgentId('');
                          }}
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                        >
                          <option value="Walk-in">Walk-in / Direct</option>
                          <option value="Direct">Direct Desk</option>
                          <option value="Phone">Phone / WhatsApp</option>
                          <option value="Website">Hotel Website</option>
                          <option value="OTA">OTA (MakeMyTrip / Booking.com)</option>
                          <option value="Travel Agent">Travel Agent</option>
                          <option value="Corporate">Corporate</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Same-Day / Hourly Stay Duration Options (Shown when Check-In Date === Departure Date) */}
                    {isSameDayStay && (
                      <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50/80 via-indigo-50/60 to-purple-50/50 border border-indigo-200 space-y-2 animate-fadeIn">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10.5px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-700 text-white tracking-wider">
                              ⚡ Day-Use / Hourly Stay (Same Date)
                            </span>
                            <span className="text-[10px] font-mono text-slate-600">
                              (Check-in &amp; Check-out on {formatDdmmyyyy(checkInDate)})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-full">
                            Duration: {stayHours || computedStayHours || 3} Hours
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-mono font-bold uppercase text-slate-700 whitespace-nowrap">
                              Stay Hours:
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={stayHours}
                              onChange={e => {
                                const v = e.target.value;
                                if (v === '') {
                                  setStayHours('');
                                } else {
                                  handleSelectStayHours(Math.max(1, Math.min(24, parseInt(v, 10) || 1)));
                                }
                              }}
                              placeholder={String(computedStayHours || 3)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 focus:border-indigo-500 focus:outline-none"
                            />
                            <span className="text-xs font-mono text-slate-600">Hours</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-500 mr-1">Quick Select:</span>
                            {[2, 3, 4, 6, 8, 12].map(hrs => (
                              <button
                                key={hrs}
                                type="button"
                                onClick={() => handleSelectStayHours(hrs)}
                                className={`px-2 py-1 text-[10px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                                  (stayHours === hrs || (!stayHours && computedStayHours === hrs))
                                    ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                {hrs}h
                              </button>
                            ))}
                            {stayHours !== '' && (
                              <button
                                type="button"
                                onClick={() => setStayHours('')}
                                className="text-[10px] font-mono text-rose-600 hover:text-rose-800 underline ml-1 cursor-pointer"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Travel Agent / Partner (linked to Travel Agents master list) */}
                    {walkInBookingSource === 'Travel Agent' && (
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-3 p-3 rounded-xl bg-[#F4F6F9]/70 border border-[#DCE3EC] items-end">
                      <div className="col-span-2 md:col-span-5 space-y-1">
                        <label className="text-[11px] font-bold text-[#263449] block">Travel Agent / OTA Partner</label>
                        <select
                          value={selectedAgentId}
                          onChange={e => handleSelectTravelAgent(e.target.value)}
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-bold bg-white"
                        >
                          <option value="">Direct / No Agent</option>
                          {travelAgents
                            .filter(a => a.status !== 'Inactive' || a.id === selectedAgentId)
                            .map(a => (
                              <option key={a.id} value={a.id}>
                                {a.agencyName && a.agencyName !== a.name ? `${a.name} (${a.agencyName})` : a.name}
                              </option>
                            ))}
                        </select>
                        {travelAgents.length === 0 && (
                          <span className="text-[10px] text-amber-700 block">No agents found. Add agents under Front Desk → Travel Agents / Partners.</span>
                        )}
                      </div>
                      {selectedAgentId && (
                        <>
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Commission</label>
                            <select
                              value={commissionType}
                              onChange={e => setCommissionType(e.target.value as 'percentage' | 'fixed')}
                              className="w-full px-2 py-2 border border-[#DCE3EC] rounded-xl text-xs font-bold bg-white"
                            >
                              <option value="percentage">%</option>
                              <option value="fixed">Fixed ₹</option>
                            </select>
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Value</label>
                            <input
                              type="number"
                              min={0}
                              value={commissionValue}
                              onChange={e => setCommissionValue(Math.max(0, Number(e.target.value) || 0))}
                              className="w-full px-2 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white"
                            />
                          </div>
                          <div className="md:col-span-3 text-right text-xs font-mono font-bold text-[#8B691E] pb-2">
                            Agent commission: ₹{computedAgentCommission.toLocaleString('en-IN')}
                          </div>
                        </>
                      )}
                    </div>
                    )}

                    {/* Corporate Extra Row (shown when Corporate booking type selected) */}
                    {bookingCategory === 'corporate' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F4F6F9] border border-[#C49A3A]/40">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#263449] block">Company / Corporate Name *</label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={e => setCompanyName(e.target.value)}
                            placeholder="e.g. Tata Consultancy Services"
                            className="w-full px-3 py-2 border border-[#DCE3EC] rounded-lg text-xs bg-white font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#263449] block">Company GSTIN</label>
                          <input
                            type="text"
                            value={gstNumber}
                            onChange={e => setGstNumber(e.target.value.toUpperCase())}
                            placeholder="e.g. 27ABCDE1234F1Z5"
                            className="w-full px-3 py-2 border border-[#DCE3EC] rounded-lg text-xs font-mono bg-white font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#263449] block">Room Allocation Mode</label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCheckInMode('single')}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                                checkInMode === 'single'
                                  ? 'bg-[#C49A3A] text-white border-[#C49A3A]'
                                  : 'bg-white text-slate-700 border-[#DCE3EC]'
                              }`}
                            >
                              Single Room
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCheckInMode('group');
                                if (groupRooms.length === 0) handleAddGroupRoom();
                              }}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                                checkInMode === 'group'
                                  ? 'bg-[#C49A3A] text-white border-[#C49A3A]'
                                  : 'bg-white text-slate-700 border-[#DCE3EC]'
                              }`}
                            >
                              Multi-Room
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Event / Banquet Extra Row */}
                    {bookingCategory === 'event' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F4F6F9] border border-[#C49A3A]/40">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#263449] block">Event / Function Name</label>
                          <input
                            type="text"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="e.g. Sharma Wedding / Annual Conference"
                            className="w-full px-3 py-2 border border-[#DCE3EC] rounded-lg text-xs bg-white font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#263449] block">Venue / Hall &amp; Catering Notes</label>
                          <input
                            type="text"
                            value={eventVenueName}
                            onChange={e => setEventVenueName(e.target.value)}
                            placeholder="e.g. Grand Banquet Hall + Lawn + Projector AV"
                            className="w-full px-3 py-2 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* ROOM CONFIGURATION BOX — STRICT INDIVIDUAL vs GROUP LOGIC */}
                    {checkInMode === 'single' ? (
                      /* INDIVIDUAL / SINGLE-ROOM BOX: NO Add Room / Add Group Rooms buttons! */
                      <div className="p-4 rounded-xl bg-[#F4F6F9]/80 border border-[#DCE3EC] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">Need more than one room for this booking? Add extra rooms below.</span>
                          <button
                            type="button"
                            onClick={handleAddExtraRoomFromSingle}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FDF8ED] border border-[#C49A3A] text-xs font-bold text-[#8B691E] cursor-pointer"
                          >
                            + Add Extra Room
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-[11px] font-bold text-[#263449] block">
                              Select Room ({formatDdmmyyyy(checkInDate)} → {formatDdmmyyyy(checkOutDate)}) <span className="text-[#A8812B]">*</span>
                            </label>
                            <select
                              value={selectedRoomNumber}
                              onChange={e => setSelectedRoomNumber(e.target.value)}
                              className="w-full px-3 py-2 border border-[#C2CDD9] rounded-xl text-xs font-bold bg-white text-[#263449] focus:border-[#C49A3A] focus:outline-none"
                            >
                              <option value="">-- Choose Available Room --</option>
                              {rooms.map(r => {
                                const avail = isRoomTrulyAvailable(r, checkInDate, checkOutDate);
                                const conflictBkg = !avail ? getRoomOverlappingBooking(r.number, checkInDate, checkOutDate) : undefined;
                                const unreadyWarn =
                                  isRoomOutOfOrderForCheckIn(r) ||
                                  (checkInDate <= getTodayDateStr() && isRoomDirtyForCheckIn(r));
                                const statusSuffix = !avail
                                  ? conflictBkg
                                    ? `(Booked: ${conflictBkg.guestName})`
                                    : isRoomDirtyForCheckIn(r)
                                    ? `(Dirty - ${r.cleaningStatus || 'Needs Cleaning'})`
                                    : `(${r.status})`
                                  : unreadyWarn
                                  ? `(⚠ ${isRoomOutOfOrderForCheckIn(r) ? r.status : r.cleaningStatus || 'Dirty'} - Override Req.)`
                                  : '(Available • Clean)';
                                return (
                                  <option key={r.number} value={r.number} disabled={!avail}>
                                    Room {r.number} — {r.category} • ₹{r.rate}/nt {statusSuffix}
                                  </option>
                                );
                              })}
                            </select>
                            {(() => {
                              const selRm = rooms.find(rm => rm.number === selectedRoomNumber);
                              if (
                                !selRm ||
                                editingCheckIn ||
                                !(
                                  isRoomOutOfOrderForCheckIn(selRm) ||
                                  (checkInDate <= getTodayDateStr() && isRoomDirtyForCheckIn(selRm))
                                )
                              ) {
                                return null;
                              }
                              const stLabel = isRoomOutOfOrderForCheckIn(selRm)
                                ? selRm.status
                                : selRm.cleaningStatus || 'Dirty';
                              return (
                                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] space-y-1.5">
                                  <div className="font-bold text-amber-950">
                                    ⚠ Room {selRm.number} is marked "{stLabel}" in Housekeeping
                                  </div>
                                  {canAuthoriseHkOverride ? (
                                    <>
                                      <label className="flex items-center gap-2 font-semibold text-amber-900 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={hkOverrideApproved}
                                          onChange={e => setHkOverrideApproved(e.target.checked)}
                                          className="accent-amber-600"
                                        />
                                        <span>Authorise Room Readiness Override ({currentRole})</span>
                                      </label>
                                      {hkOverrideApproved && (
                                        <input
                                          type="text"
                                          value={hkOverrideReason}
                                          onChange={e => setHkOverrideReason(e.target.value)}
                                          placeholder="Enter mandatory override reason..."
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-900"
                                        />
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-rose-700 font-semibold">
                                      Check-in is blocked until Housekeeping marks Room {selRm.number} Clean &amp; Ready (or select another available room).
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">
                              Tariff / Night (₹)
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={roomRate || ''}
                                placeholder="Select room"
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => setRoomRate(Math.max(0, Number(e.target.value) || 0))}
                                className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white"
                              />
                              {roomRate !== standardRate && (
                                <button
                                  type="button"
                                  onClick={handleRenewPrice}
                                  title={`Reset to rack rate ₹${standardRate}`}
                                  className="p-2 rounded-lg bg-white border border-[#DCE3EC] hover:bg-amber-50 text-[#8B691E] cursor-pointer"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Meal Plan</label>
                            <select
                              value={mealPlan}
                              onChange={e => setMealPlan(e.target.value as MealPlanType)}
                              className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-bold bg-white"
                            >
                              <option value="EP">EP (Room Only)</option>
                              <option value="CP">CP (With Breakfast)</option>
                              <option value="MAP">MAP (Breakfast + 1 Meal)</option>
                              <option value="AP">AP (All Meals)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Adults</label>
                            <input
                              type="number"
                              min={1}
                              value={adults}
                              placeholder="Enter adults"
                              onChange={e => {
                                userCountTouchedRef.current = true;
                                extraChargeTouchedRef.current = false;
                                setAdults(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)));
                              }}
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Children</label>
                            <input
                              type="number"
                              min={0}
                              value={children}
                              placeholder="Enter children"
                              onChange={e => {
                                userCountTouchedRef.current = true;
                                extraChargeTouchedRef.current = false;
                                setChildren(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)));
                              }}
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                            />
                          </div>
                          <div className="col-span-2 flex flex-wrap items-center gap-4 pt-4">
                            <label className="inline-flex items-center gap-2 text-xs font-bold text-[#263449] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={applyExtraPersonCharge}
                                onChange={e => {
                                  const nextOn = e.target.checked;
                                  extraChargeTouchedRef.current = true;
                                  setApplyExtraPersonCharge(nextOn);
                                  if (nextOn) {
                                    setExtraPersonQty(prev => Math.max(1, prev || extraGuestsCount || 1));
                                  }
                                }}
                                className="w-4 h-4 accent-[#B5822D] rounded cursor-pointer"
                              />
                              <Users className="w-3.5 h-3.5 text-[#C49A3A]" />
                              <span>Extra Person</span>
                              {extraGuestsCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 font-bold rounded-full">
                                  Auto (+{extraGuestsCount} Extra)
                                </span>
                              )}
                            </label>

                            {(() => {
                              const bedBlocked = Boolean(selectedRoomNumber) && activeSelectedRoomObj?.allowExtraBed === false;
                              return (
                                <label
                                  title={bedBlocked ? `Room ${selectedRoomNumber} does not allow an extra bed` : undefined}
                                  className={`inline-flex items-center gap-2 text-xs font-bold select-none ${
                                    bedBlocked ? 'text-slate-400 cursor-not-allowed' : 'text-[#263449] cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={bedBlocked}
                                    checked={bedBlocked ? false : hasExtraBed}
                                    onChange={e => {
                                      const nextOn = e.target.checked;
                                      setHasExtraBed(nextOn);
                                      if (nextOn && extraBedCount < 1) {
                                        setExtraBedCount(1);
                                      }
                                    }}
                                    className={`w-4 h-4 accent-[#B5822D] rounded ${
                                      bedBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                    }`}
                                  />
                                  <BedDouble className="w-3.5 h-3.5 text-[#C49A3A]" />
                                  <span>Extra Bed / Mattress{bedBlocked ? ' (Not allowed)' : ''}</span>
                                </label>
                              );
                            })()}
                          </div>
                        </div>

                        {checkInMode === 'single' && Boolean(selectedRoomNumber) && singleTotalOccupants > selectedRoomMaxOccupancy && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>Capacity Alert:</strong> {singleTotalOccupants} Occupants exceeds Room {selectedRoomNumber} standard Max Capacity ({selectedRoomMaxOccupancy} Max). Extra person fee (₹{effectiveExtraPaxRate.toLocaleString('en-IN')}/night) applied automatically.
                            </span>
                          </div>
                        )}

                        {/* CONDITIONAL PANEL 1: EXTRA PERSON (SHOWN ONLY WHEN EXTRA PERSON CHECKBOX IS SELECTED) */}
                        {applyExtraPersonCharge && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-white border border-[#C49A3A]/50 text-xs shadow-2xs">
                            <div>
                              <label className="text-[10px] font-mono uppercase text-[#8B691E] font-bold block">
                                Extra Persons (Qty)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={extraPersonQty}
                                onChange={e => {
                                  extraChargeTouchedRef.current = true;
                                  setExtraPersonQty(Math.max(1, Math.floor(Number(e.target.value) || 1)));
                                }}
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-mono uppercase text-[#8B691E] font-bold">
                                  Price / Night (₹)
                                </label>
                                {extraPersonRateOverride !== '' && Number(extraPersonRateOverride) !== extraPersonCharge && (
                                  <button
                                    type="button"
                                    onClick={() => setExtraPersonRateOverride('')}
                                    className="text-[9.5px] font-mono text-[#8B691E] underline cursor-pointer"
                                    title={`Reset to default ₹${extraPersonCharge}`}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={extraPersonRateOverride !== '' ? extraPersonRateOverride : extraPersonCharge}
                                onChange={e =>
                                  setExtraPersonRateOverride(
                                    e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono uppercase text-[#8B691E] font-bold block">
                                Applicable Nights
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={extraPersonNightsOverride !== '' ? extraPersonNightsOverride : stayNights}
                                onChange={e =>
                                  setExtraPersonNightsOverride(
                                    e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value) || 1))
                                  )
                                }
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                              />
                            </div>
                            <div className="flex flex-col justify-end text-right font-mono pb-1">
                              <span className="text-[9.5px] text-slate-400">
                                {singleExtraCalc.extraPersonQty} × ₹{singleExtraCalc.extraPersonRate} × {singleExtraCalc.extraPersonNights}N
                              </span>
                              <strong className="text-sm font-extrabold text-[#8B691E]">
                                Total: ₹{extraPersonChargesTotal.toLocaleString('en-IN')}
                              </strong>
                            </div>
                          </div>
                        )}

                        {/* CONDITIONAL PANEL 2: EXTRA BED / MATTRESS (SHOWN ONLY WHEN EXTRA BED CHECKBOX IS SELECTED) */}
                        {hasExtraBed && activeSelectedRoomObj?.allowExtraBed !== false && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-white border border-amber-300/80 text-xs shadow-2xs">
                            <div>
                              <label className="text-[10px] font-mono uppercase text-amber-800 font-bold block">
                                Beds / Mattresses (Qty)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={extraBedCount}
                                onChange={e => setExtraBedCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-mono uppercase text-amber-800 font-bold">
                                  Price / Night (₹)
                                </label>
                                {extraBedRate !== (extraPersonCharge || 500) && (
                                  <button
                                    type="button"
                                    onClick={() => setExtraBedRate(extraPersonCharge > 0 ? extraPersonCharge : 500)}
                                    className="text-[9.5px] font-mono text-amber-800 underline cursor-pointer"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={extraBedRate}
                                onChange={e => setExtraBedRate(Math.max(0, Number(e.target.value) || 0))}
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono uppercase text-amber-800 font-bold block">
                                Applicable Nights
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={extraBedNightsOverride !== '' ? extraBedNightsOverride : stayNights}
                                onChange={e =>
                                  setExtraBedNightsOverride(
                                    e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value) || 1))
                                  )
                                }
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                              />
                            </div>
                            <div className="flex flex-col justify-end text-right font-mono pb-1">
                              <span className="text-[9.5px] text-slate-400">
                                {singleExtraCalc.extraBedQty} × ₹{singleExtraCalc.extraBedRate} × {singleExtraCalc.extraBedNights}N
                              </span>
                              <strong className="text-sm font-extrabold text-amber-800">
                                Total: ₹{extraBedTotal.toLocaleString('en-IN')}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* GROUP / MULTI-ROOM BOX: Shows + Add Room AND + Add Group Rooms + Rooming List */
                      <div className="p-4 rounded-xl bg-[#F4F6F9]/80 border border-[#DCE3EC] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#263449]">
                              {groupRooms.length === 0
                                ? 'No rooms added yet. Click + Add Room or + Add Group Rooms.'
                                : `Group Rooming List (${groupRooms.length} Room${groupRooms.length > 1 ? 's' : ''})`}
                            </span>
                            {bookingCategory === 'group' && (
                              <input
                                type="text"
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                                placeholder="Group / Family Name..."
                                className="px-2.5 py-1 border border-[#DCE3EC] rounded-lg text-xs bg-white font-semibold"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {bookingCategory === 'individual' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const first = groupRooms[0]?.roomNumber || '';
                                  setCheckInMode('single');
                                  if (first) setSelectedRoomNumber(first);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F4F6F9] border border-[#DCE3EC] text-xs font-bold text-[#263449] cursor-pointer"
                              >
                                ← Single Room
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleAddGroupRoom}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FDF8ED] border border-[#C2CDD9] text-xs font-bold text-[#263449] cursor-pointer"
                            >
                              + Add Room
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowQuickGroupPicker(prev => !prev)}
                              className="px-3 py-1.5 rounded-lg bg-[#C49A3A] hover:bg-[#A8812B] text-white border border-[#A8812B] text-xs font-bold cursor-pointer"
                            >
                              + Add Group Rooms
                            </button>
                          </div>
                        </div>

                        {/* Quick Multi-Room Picker Drawer */}
                        {showQuickGroupPicker && (
                          <div className="p-3 rounded-xl bg-white border-2 border-[#C49A3A] space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#263449]">
                                Select multiple available rooms for {formatDdmmyyyy(checkInDate)} → {formatDdmmyyyy(checkOutDate)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowQuickGroupPicker(false)}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {rooms
                                .filter(r => isRoomTrulyAvailable(r, checkInDate, checkOutDate) && !groupRooms.some(gr => gr.roomNumber === r.number))
                                .map(r => {
                                  const checked = quickGroupSelectedRooms.includes(r.number);
                                  return (
                                    <label
                                      key={r.number}
                                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold cursor-pointer inline-flex items-center gap-1.5 ${
                                        checked
                                          ? 'bg-[#FDF8ED] border-[#C49A3A] text-[#8B691E]'
                                          : 'bg-[#F4F6F9] border-[#DCE3EC] text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                          if (e.target.checked) {
                                            setQuickGroupSelectedRooms(prev => [...prev, r.number]);
                                          } else {
                                            setQuickGroupSelectedRooms(prev => prev.filter(n => n !== r.number));
                                          }
                                        }}
                                        className="accent-[#B5822D]"
                                      />
                                      Rm {r.number} ({r.category} • ₹{r.rate})
                                    </label>
                                  );
                                })}
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleAddMultipleGroupRooms(quickGroupSelectedRooms)}
                                className="px-3.5 py-1.5 rounded-lg bg-[#C49A3A] hover:bg-[#A8812B] border border-[#C49A3A] text-[#263449] text-xs font-bold cursor-pointer"
                              >
                                Add Selected Rooms ({quickGroupSelectedRooms.length})
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Group Rooms Table */}
                        {groupRooms.length > 0 && (
                          <div className="overflow-x-auto rounded-xl border border-[#DCE3EC] bg-white">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-[#F4F6F9] text-[#263449] font-mono text-[10px] uppercase border-b border-[#DCE3EC]">
                                <tr>
                                  <th className="p-2.5">Room #</th>
                                  <th className="p-2.5">Category</th>
                                  <th className="p-2.5">Rate / Night</th>
                                  <th className="p-2.5 text-center">Extra Bed</th>
                                  <th className="p-2.5">Pax (A / C)</th>
                                  <th className="p-2.5">Guest Name</th>
                                  <th className="p-2.5 text-right">Room Total</th>
                                  <th className="p-2.5 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-luxury-brown-100">
                                {groupRooms.map(gr => {
                                  const rmSubtotal =
                                    (Number(gr.rate) || 0) * stayNights +
                                    (gr.hasExtraBed ? (Number(gr.extraBedCount) || 1) * (Number(gr.extraBedRate) || 500) * stayNights : 0);
                                  return (
                                    <tr key={gr.id}>
                                      <td className="p-2">
                                        <select
                                          value={gr.roomNumber}
                                          onChange={e => handleUpdateGroupRoom(gr.id, 'roomNumber', e.target.value)}
                                          className="px-2 py-1 border border-[#DCE3EC] rounded-lg font-mono font-bold text-xs bg-white"
                                        >
                                          {rooms.map(r => {
                                            const takenByOtherRow = groupRooms.some(o => o.id !== gr.id && o.roomNumber === r.number);
                                            const avail =
                                              r.number === gr.roomNumber ||
                                              (!takenByOtherRow && isRoomTrulyAvailable(r, checkInDate, checkOutDate));
                                            return (
                                              <option key={r.number} value={r.number} disabled={!avail}>
                                                Rm {r.number} ({r.category})
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </td>
                                      <td className="p-2 font-semibold text-slate-700">{gr.category}</td>
                                      <td className="p-2">
                                        <input
                                          type="number"
                                          min={0}
                                          value={gr.rate}
                                          onChange={e => handleUpdateGroupRoom(gr.id, 'rate', Number(e.target.value) || 0)}
                                          className="w-20 px-2 py-1 border border-[#DCE3EC] rounded-lg font-mono font-bold text-xs"
                                        />
                                      </td>
                                      <td className="p-2 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                          <input
                                            type="checkbox"
                                            disabled={!isExtraBedAllowedForRoom(gr.roomNumber)}
                                            title={!isExtraBedAllowedForRoom(gr.roomNumber) ? `Room ${gr.roomNumber} does not allow an extra bed` : 'Add extra bed / mattress'}
                                            checked={isExtraBedAllowedForRoom(gr.roomNumber) ? gr.hasExtraBed : false}
                                            onChange={e => handleUpdateGroupRoom(gr.id, 'hasExtraBed', e.target.checked)}
                                            className={`w-4 h-4 accent-[#B5822D] ${isExtraBedAllowedForRoom(gr.roomNumber) ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                                          />
                                          {gr.hasExtraBed && isExtraBedAllowedForRoom(gr.roomNumber) && (
                                            <div className="flex items-center gap-1 pt-0.5">
                                              <input
                                                type="number"
                                                min={1}
                                                value={gr.extraBedCount}
                                                onChange={e => handleUpdateGroupRoom(gr.id, 'extraBedCount', Math.max(1, Number(e.target.value) || 1))}
                                                className="w-10 px-1 py-0.5 border border-amber-300 rounded font-mono text-[10px] text-center bg-amber-50/50"
                                                title="Extra Bed Qty"
                                              />
                                              <span className="text-[10px] text-slate-400">×</span>
                                              <input
                                                type="number"
                                                min={0}
                                                value={gr.extraBedRate}
                                                onChange={e => handleUpdateGroupRoom(gr.id, 'extraBedRate', Math.max(0, Number(e.target.value) || 0))}
                                                className="w-14 px-1 py-0.5 border border-amber-300 rounded font-mono text-[10px] font-bold bg-white"
                                                title="Extra Bed Rate / Night (₹)"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min={1}
                                            value={gr.adults}
                                            onChange={e => {
                                              userCountTouchedRef.current = true;
                                              handleUpdateGroupRoom(gr.id, 'adults', Math.max(1, Number(e.target.value) || 1));
                                            }}
                                            className="w-11 px-1.5 py-1 border border-[#DCE3EC] rounded font-mono text-center"
                                            title="Adults"
                                          />
                                          <span className="text-slate-400">/</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={gr.children}
                                            onChange={e => {
                                              userCountTouchedRef.current = true;
                                              handleUpdateGroupRoom(gr.id, 'children', Math.max(0, Number(e.target.value) || 0));
                                            }}
                                            className="w-11 px-1.5 py-1 border border-[#DCE3EC] rounded font-mono text-center"
                                            title="Children"
                                          />
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={gr.assignedGuestName}
                                          onChange={e => handleUpdateGroupRoom(gr.id, 'assignedGuestName', e.target.value)}
                                          placeholder="Guest name"
                                          className="w-full min-w-[110px] px-2 py-1 border border-[#DCE3EC] rounded-lg text-xs"
                                        />
                                      </td>
                                      <td className="p-2 text-right font-mono font-bold text-[#263449]">
                                        ₹{rmSubtotal.toLocaleString('en-IN')}
                                      </td>
                                      <td className="p-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveGroupRoom(gr.id)}
                                          className="text-slate-600 hover:bg-amber-50 p-1 rounded cursor-pointer"
                                          title="Remove Room"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="px-3 py-2 bg-[#FDF8ED] border-t border-[#DCE3EC] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                              <span className="text-[#263449] font-bold">
                                Combined Group Charges ({groupRooms.length} Room{groupRooms.length > 1 ? 's' : ''} × {stayNights} Night{stayNights > 1 ? 's' : ''})
                              </span>
                              <span className="text-[#8B691E] font-extrabold">
                                Rooms: ₹{effectiveRoomChargesTotal.toLocaleString('en-IN')}
                                {effectiveExtraPersonChargesTotal > 0 ? ` + Extra Person: ₹${effectiveExtraPersonChargesTotal.toLocaleString('en-IN')}` : ''}
                                {effectiveExtraBedTotal > 0 ? ` + Extra Beds: ₹${effectiveExtraBedTotal.toLocaleString('en-IN')}` : ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Group Mode Separate Extra Person Checkbox (OFF by default, fields hidden until checked) */}
                        {groupRooms.length > 0 && (
                          <div className="pt-1 space-y-2">
                            <label className="inline-flex items-center gap-2 text-xs font-bold text-[#263449] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={applyExtraPersonCharge}
                                onChange={e => {
                                  const nextOn = e.target.checked;
                                  extraChargeTouchedRef.current = true;
                                  setApplyExtraPersonCharge(nextOn);
                                  if (nextOn) {
                                    setExtraPersonQty(prev => Math.max(1, prev || groupExtraGuestsCount || 1));
                                  }
                                }}
                                className="w-4 h-4 accent-[#B5822D] rounded cursor-pointer"
                              />
                              <Users className="w-3.5 h-3.5 text-[#C49A3A]" />
                              <span>Extra Person</span>
                              {groupExtraGuestsCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 font-bold rounded-full">
                                  Auto (+{groupExtraGuestsCount} Extra)
                                </span>
                              )}
                            </label>

                            {applyExtraPersonCharge && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-white border border-[#C49A3A]/50 text-xs">
                                <div>
                                  <label className="text-[10px] font-mono uppercase text-[#8B691E] font-bold block">
                                    Extra Persons (Qty)
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={extraPersonQty}
                                    onChange={e => {
                                      extraChargeTouchedRef.current = true;
                                      setExtraPersonQty(Math.max(1, Math.floor(Number(e.target.value) || 1)));
                                    }}
                                    className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-mono uppercase text-[#8B691E] font-bold block">
                                    Price / Night (₹)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={extraPersonRateOverride !== '' ? extraPersonRateOverride : extraPersonCharge}
                                    onChange={e =>
                                      setExtraPersonRateOverride(
                                        e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0)
                                      )
                                    }
                                    className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-mono uppercase text-[#8B691E] font-bold block">
                                    Applicable Nights
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={extraPersonNightsOverride !== '' ? extraPersonNightsOverride : stayNights}
                                    onChange={e =>
                                      setExtraPersonNightsOverride(
                                        e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value) || 1))
                                      )
                                    }
                                    className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg font-mono font-bold bg-white"
                                  />
                                </div>
                                <div className="flex flex-col justify-end text-right font-mono pb-1">
                                  <strong className="text-sm font-extrabold text-[#8B691E]">
                                    Total: ₹{groupExtraPersonChargesTotal.toLocaleString('en-IN')}
                                  </strong>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* WATER BOTTLES (COMPLIMENTARY + CHARGEABLE + LIVE INVENTORY SYNC + INLINE QUICK STOCK ADD) */}
                  {!editingCheckIn && (
                    <section className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs p-5 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                            <GlassWater className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-serif font-bold text-[#263449] flex flex-wrap items-center gap-2">
                              <span>Water Bottles (Check-In Allocation)</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                  availableWaterStock <= 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : availableWaterStock <= 5
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {waterBottleInventoryProduct
                                  ? `Inventory Stock: ${availableWaterStock} Bottle${availableWaterStock === 1 ? '' : 's'}`
                                  : 'Not in Inventory (0 Stock)'}
                              </span>
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              Issue complimentary (₹0) and/or chargeable water bottles • Auto-deducts from Inventory on Check-In
                            </p>
                          </div>
                        </div>

                        {onUpdateInventoryProducts && (
                          <button
                            type="button"
                            onClick={() => setShowQuickAddWaterStock(prev => !prev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                              availableWaterStock <= 5 || showQuickAddWaterStock
                                ? 'bg-[#C49A3A] hover:bg-[#A8812B] text-white border-[#A8812B] shadow-2xs'
                                : 'bg-[#FDF8ED] hover:bg-[#F6E9C8] text-[#8B691E] border-[#C49A3A]/60'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {showQuickAddWaterStock ? 'Close Stock Panel' : 'Add Water Stock to Inventory'}
                          </button>
                        )}
                      </div>

                      {/* INLINE QUICK ADD WATER STOCK TO INVENTORY */}
                      {(showQuickAddWaterStock || (!waterBottleInventoryProduct && availableWaterStock === 0)) && onUpdateInventoryProducts && (
                        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-[#C49A3A]/60 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#263449]">
                              {waterBottleInventoryProduct
                                ? `Quick Restock: ${waterBottleInventoryProduct.name} (Current: ${availableWaterStock})`
                                : 'Water Bottle item not found in Inventory — Quick Add SKU (WATER-1L) directly here:'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                            <div>
                              <label className="text-[10px] font-mono font-bold uppercase text-[#8B691E] block">
                                Add Quantity (Bottles) *
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={quickWaterAddQty}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => setQuickWaterAddQty(e.target.value)}
                                placeholder="e.g. 24"
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono font-bold uppercase text-[#8B691E] block">
                                Selling Rate / Bottle (₹) *
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={quickWaterSellRate}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => setQuickWaterSellRate(e.target.value)}
                                placeholder="e.g. 20"
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono font-bold uppercase text-[#8B691E] block">
                                Cost Price / Bottle (₹)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={quickWaterCostRate}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => setQuickWaterCostRate(e.target.value)}
                                placeholder="e.g. 10"
                                className="w-full mt-1 px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleQuickAddWaterStockToInventory}
                              className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-xs"
                            >
                              + Add to Inventory
                            </button>
                          </div>
                        </div>
                      )}

                      {/* COMPLIMENTARY + CHARGEABLE CONTROLS */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. Complimentary Water Bottles */}
                        <div className="p-3.5 rounded-xl bg-[#F4F6F9] border border-[#DCE3EC] flex flex-col justify-between gap-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-[#263449] block">Complimentary Bottles</span>
                              <span className="text-[10.5px] text-slate-500">Free welcome water • Deducted from stock</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold border border-emerald-200">
                              ₹0 Free
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={complimentaryWaterBottles <= 0}
                                onClick={() => setComplimentaryWaterBottles(prev => Math.max(0, prev - 1))}
                                className="w-8 h-8 rounded-lg border border-[#C2CDD9] bg-white hover:bg-slate-100 disabled:opacity-40 inline-flex items-center justify-center text-[#263449] cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={Math.max(0, availableWaterStock - chargeableWaterBottles)}
                                value={complimentaryWaterBottles}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => {
                                  const maxAllowed = Math.max(0, availableWaterStock - chargeableWaterBottles);
                                  const parsed = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  setComplimentaryWaterBottles(Math.min(maxAllowed, parsed));
                                }}
                                className="w-16 py-1.5 px-2 text-center border border-[#DCE3EC] rounded-lg text-xs font-mono font-extrabold bg-white text-[#263449]"
                              />
                              <button
                                type="button"
                                disabled={totalRequestedWaterBottles >= availableWaterStock}
                                onClick={() =>
                                  setComplimentaryWaterBottles(prev =>
                                    Math.min(Math.max(0, availableWaterStock - chargeableWaterBottles), prev + 1)
                                  )
                                }
                                className="w-8 h-8 rounded-lg border border-[#C2CDD9] bg-white hover:bg-slate-100 disabled:opacity-40 inline-flex items-center justify-center text-[#263449] cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[11px] font-mono text-slate-600">
                              Max avail: <strong>{Math.max(0, availableWaterStock - chargeableWaterBottles)}</strong>
                            </span>
                          </div>
                        </div>

                        {/* 2. Chargeable Water Bottles */}
                        <div className="p-3.5 rounded-xl bg-[#FDF8ED]/60 border border-[#C49A3A]/40 flex flex-col justify-between gap-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-[#263449] block">Chargeable Bottles</span>
                              <span className="text-[10.5px] text-slate-500">Rate auto-fills from Inventory • Editable here</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-[#F6E9C8] text-[#8B691E] text-[10px] font-mono font-extrabold border border-[#C49A3A]/50">
                              Bill: ₹{chargeableWaterTotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={chargeableWaterBottles <= 0}
                                onClick={() => setChargeableWaterBottles(prev => Math.max(0, prev - 1))}
                                className="w-8 h-8 rounded-lg border border-[#C2CDD9] bg-white hover:bg-slate-100 disabled:opacity-40 inline-flex items-center justify-center text-[#263449] cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={Math.max(0, availableWaterStock - complimentaryWaterBottles)}
                                value={chargeableWaterBottles}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => {
                                  const maxAllowed = Math.max(0, availableWaterStock - complimentaryWaterBottles);
                                  const parsed = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  setChargeableWaterBottles(Math.min(maxAllowed, parsed));
                                }}
                                className="w-16 py-1.5 px-2 text-center border border-[#DCE3EC] rounded-lg text-xs font-mono font-extrabold bg-white text-[#263449]"
                              />
                              <button
                                type="button"
                                disabled={totalRequestedWaterBottles >= availableWaterStock}
                                onClick={() =>
                                  setChargeableWaterBottles(prev =>
                                    Math.min(Math.max(0, availableWaterStock - complimentaryWaterBottles), prev + 1)
                                  )
                                }
                                className="w-8 h-8 rounded-lg border border-[#C2CDD9] bg-white hover:bg-slate-100 disabled:opacity-40 inline-flex items-center justify-center text-[#263449] cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-[#8B691E] uppercase">Rate ₹</span>
                              <input
                                type="number"
                                min={0}
                                value={chargeableWaterRateInput}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => {
                                  waterRateManuallyEditedRef.current = true;
                                  setChargeableWaterRateInput(e.target.value);
                                }}
                                placeholder={String(defaultInventoryWaterRate)}
                                className="w-20 py-1.5 px-2 border border-[#C49A3A]/70 rounded-lg text-xs font-mono font-extrabold bg-white text-[#263449]"
                                title="Editable chargeable water bottle price (defaults from Inventory)"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* LIVE INVENTORY DEDUCTION FOOTER */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-slate-600 border-t border-[#DCE3EC]/70">
                        <span>
                          Total Issued: <strong className="text-[#263449]">{totalRequestedWaterBottles}</strong> bottle{totalRequestedWaterBottles === 1 ? '' : 's'} ({complimentaryWaterBottles} Free + {chargeableWaterBottles} Chargeable)
                        </span>
                        <span>
                          Stock after Check-In:{' '}
                          <strong className={availableWaterStock - totalRequestedWaterBottles <= 5 ? 'text-amber-700' : 'text-emerald-700'}>
                            {Math.max(0, availableWaterStock - totalRequestedWaterBottles)}
                          </strong>
                        </span>
                      </div>
                    </section>
                  )}

                  {/* AUXILIARY & CUSTOM CHARGES */}
                  <section className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowExtraChargesSection(prev => !prev)}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F6F9]/60 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#FDF8ED] border border-[#E6CE9A] text-[#9E6E24] flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-serif font-bold text-[#263449] block">Auxiliary &amp; custom charges</span>
                          <span className="text-xs text-slate-500 block">Optional miscellaneous or custom itemized charges</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(otherCharges + customExtraRowsTotal) > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold">
                            ₹{(otherCharges + customExtraRowsTotal).toLocaleString('en-IN')} added
                          </span>
                        )}
                        <span className="px-3 py-1 rounded-lg border border-[#DCE3EC] bg-white text-xs font-bold text-[#263449] inline-flex items-center gap-1">
                          {showExtraChargesSection ? 'Hide' : '+ Add Custom Charges'}
                          {showExtraChargesSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                    </button>
                    {showExtraChargesSection && (
                      <div className="px-5 pb-5 pt-3 border-t border-[#DCE3EC] space-y-3.5">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#263449] block">Other / auxiliary charge (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={otherCharges || ''}
                          placeholder="0"
                          onChange={e => setOtherCharges(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                        />
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <span className="text-[11px] text-slate-500">Meals, laundry, transport, decoration or any custom item with quantity &amp; price.</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomExtraRows(prev => [...prev, { id: String(Date.now()) + prev.length, label: '', qty: 1, rate: '' }])
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#C49A3A] hover:bg-[#A8812B] text-white border border-[#A8812B] text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          + Add Custom Charge
                        </button>
                      </div>
                    </div>

                    {customExtraRows.length > 0 && (
                      <div className="space-y-2">
                        {customExtraRows.map(row => (
                          <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                            <input
                              type="text"
                              value={row.label}
                              placeholder="Item (e.g. Dinner, Laundry, Cab)"
                              onChange={e => setCustomExtraRows(prev => prev.map(r => (r.id === row.id ? { ...r, label: e.target.value } : r)))}
                              className="col-span-12 sm:col-span-5 px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                            />
                            <input
                              type="number"
                              min={1}
                              value={row.qty}
                              placeholder="Qty"
                              onChange={e => setCustomExtraRows(prev => prev.map(r => (r.id === row.id ? { ...r, qty: e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1) } : r)))}
                              className="col-span-3 sm:col-span-2 px-2 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold text-center bg-white"
                            />
                            <input
                              type="number"
                              min={0}
                              value={row.rate}
                              placeholder="Price ₹"
                              onChange={e => setCustomExtraRows(prev => prev.map(r => (r.id === row.id ? { ...r, rate: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) } : r)))}
                              className="col-span-4 sm:col-span-3 px-2 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                            />
                            <span className="col-span-3 sm:col-span-1 text-right text-[11px] font-mono font-bold text-[#263449]">
                              ₹{((Number(row.qty) || 0) * (Number(row.rate) || 0)).toLocaleString('en-IN')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCustomExtraRows(prev => prev.filter(r => r.id !== row.id))}
                              className="col-span-2 sm:col-span-1 p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 cursor-pointer inline-flex justify-center"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                    )}
                  </section>

                  {/* SECTION 2: GUEST DETAILS */}
                  <section className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <h3 className="text-sm sm:text-base font-serif font-bold text-[#263449]">
                        Guest details
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-56 sm:w-64">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={guestSearchTerm}
                            onChange={e => setGuestSearchTerm(e.target.value)}
                            placeholder="Search guest by name, email or phone"
                            className="w-full pl-8 pr-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-[#F4F6F9]/60 focus:bg-white focus:border-[#C49A3A] focus:outline-none"
                          />
                          {guestSearchTerm.trim().length >= 2 && (() => {
                            const q = guestSearchTerm.trim().toLowerCase();
                            const matches = [
                              ...checkins.map(c => ({
                                id: c.id,
                                name: c.guestName,
                                mobile: c.mobile,
                                email: c.emailAddress || '',
                                address: c.address || '',
                                city: c.city || '',
                                state: c.state || '',
                                country: c.country || 'India',
                                idType: c.idType || 'Aadhaar',
                                idNumber: c.idNumber || c.aadhaarNumber || c.passportNumber || '',
                              })),
                              ...bookings.map(b => ({
                                id: b.id,
                                name: b.guestName,
                                mobile: b.mobile,
                                email: b.email || '',
                                address: b.address || '',
                                city: '',
                                state: '',
                                country: 'India',
                                idType: b.passportNumber ? 'Passport' : 'Aadhaar',
                                idNumber: b.aadhaarNumber || b.passportNumber || '',
                              })),
                            ]
                              .filter(
                                (item, idx, arr) =>
                                  (item.name.toLowerCase().includes(q) ||
                                    item.mobile.toLowerCase().includes(q) ||
                                    item.email.toLowerCase().includes(q)) &&
                                  arr.findIndex(x => x.mobile === item.mobile && x.name === item.name) === idx
                              )
                              .slice(0, 5);
                            if (matches.length === 0) return null;
                            return (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#C2CDD9] rounded-xl shadow-lg z-30 divide-y divide-slate-100 overflow-hidden">
                                {matches.map(m => (
                                  <button
                                    key={`${m.id}-${m.mobile}`}
                                    type="button"
                                    onClick={() => {
                                      setGuestName(m.name);
                                      setMobile(m.mobile);
                                      if (m.email) setEmailAddress(m.email);
                                      if (m.address) setAddress(m.address);
                                      if (m.city) setCity(m.city);
                                      if (m.state) setState(m.state);
                                      if (m.country) setCountry(m.country);
                                      if (m.idNumber) {
                                        setIdType(m.idType);
                                        setIdNumber(m.idNumber);
                                      }
                                      setGuestSearchTerm('');
                                      showToast(`Auto-filled returning guest profile: ${m.name}`, 'success');
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[#FDF8ED] text-xs cursor-pointer"
                                  >
                                    <div className="font-bold text-[#263449]">{m.name}</div>
                                    <div className="text-[10px] font-mono text-slate-500">
                                      {m.mobile} {m.email ? `• ${m.email}` : ''}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        <input
                          id="redesign-id-proof-input"
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={e => {
                            if (e.target.files && e.target.files.length > 0) {
                              const file = e.target.files[0];
                              setIdProofFileName(file.name);
                              const reader = new FileReader();
                              reader.onload = () => setIdProofFileData(reader.result as string);
                              reader.readAsDataURL(file);
                              showToast(`ID proof attached: ${file.name}`, 'success');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('redesign-id-proof-input')?.click()}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                            idProofFileName
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white hover:bg-[#F4F6F9] border-[#DCE3EC] text-[#263449]'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {idProofFileName ? 'ID Attached ✓' : 'Attach ID'}
                        </button>
                        <button
                          type="button"
                          onClick={handleBlankGrcPrint}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F4F6F9] border border-[#DCE3EC] text-xs font-bold text-[#263449] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Blank GRC
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextC = !isCFormRequired;
                            setIsCFormRequired(nextC);
                            if (nextC && nationality.toLowerCase() === 'indian') {
                              setNationality('Foreign');
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                            isCFormRequired
                              ? 'bg-[#C49A3A] text-white border-[#C49A3A]'
                              : 'bg-white text-[#8B691E] border-[#C49A3A]/50 hover:bg-[#FDF8ED]'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" /> C-Form
                        </button>
                      </div>
                    </div>

                    {/* Row 1: Full Name | Phone | Email */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">
                          Full name / First name <span className="text-[#A8812B]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={guestName}
                          onChange={e => setGuestName(e.target.value)}
                          placeholder="e.g. Rajesh Sharma"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white font-semibold focus:border-[#C49A3A] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">
                          Phone / Contact number <span className="text-[#A8812B]">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={mobile}
                          onChange={e => setMobile(e.target.value)}
                          placeholder="+91 98XXXXXXXX"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white focus:border-[#C49A3A] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Email</label>
                        <input
                          type="email"
                          value={emailAddress}
                          onChange={e => setEmailAddress(e.target.value)}
                          placeholder="guest@email.com"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white focus:border-[#C49A3A] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Row 2: Address Line 1 | Address Line 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Address Line 1</label>
                        <input
                          type="text"
                          value={address}
                          onChange={e => setAddress(e.target.value)}
                          placeholder="Flat / House No, Street name, Area"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white focus:border-[#C49A3A] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Address Line 2</label>
                        <input
                          type="text"
                          value={addressLine2}
                          onChange={e => setAddressLine2(e.target.value)}
                          placeholder="Landmark, Suite, Apartment (Optional)"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white focus:border-[#C49A3A] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Row 3: Country | State | City | Pincode */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Country *</label>
                        <input
                          type="text"
                          value={country}
                          onChange={e => setCountry(e.target.value)}
                          placeholder="India"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">State</label>
                        <input
                          type="text"
                          value={state}
                          onChange={e => setState(e.target.value)}
                          placeholder="e.g. Maharashtra"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">City</label>
                        <input
                          type="text"
                          value={city}
                          onChange={e => setCity(e.target.value)}
                          placeholder="e.g. Mumbai"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Pincode / Postal Code</label>
                        <input
                          type="text"
                          value={pincode}
                          onChange={e => setPincode(e.target.value)}
                          placeholder="e.g. 400001"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                        />
                      </div>
                    </div>

                    {/* Row 4: ID Proof Type | ID Number | Nationality | DOB */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">ID Proof Type</label>
                        <select
                          value={idType}
                          onChange={e => setIdType(e.target.value)}
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-bold bg-white"
                        >
                          <option value="Aadhaar">Aadhaar Card</option>
                          <option value="Passport">Passport</option>
                          <option value="Driving License">Driving Licence</option>
                          <option value="Voter ID">Voter ID</option>
                          <option value="Other">Other Gov ID</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">ID Number / Ref</label>
                        <input
                          type="text"
                          value={idNumber}
                          onChange={e => setIdNumber(e.target.value.toUpperCase())}
                          placeholder="Enter ID number"
                          className="w-full px-3 py-2 border border-[#C5A059] rounded-xl text-xs font-mono font-bold bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Nationality</label>
                        <input
                          type="text"
                          value={nationality}
                          onChange={e => setNationality(e.target.value)}
                          placeholder="Indian"
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#263449] block">Date of Birth</label>
                        <QuickDateInput
                          value={dob}
                          onChange={setDob}
                          maxYear={new Date().getFullYear()}
                          className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                        />
                      </div>
                    </div>

                    {idProofFileName && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                        <span className="font-mono font-bold text-emerald-900">✓ Attached ID Scan: {idProofFileName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIdProofFileName('');
                            setIdProofFileData('');
                          }}
                          className="text-slate-600 hover:underline font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {/* Foreign Guest C-Form / FRRO Details */}
                    {(isCFormRequired || (nationality && nationality.toLowerCase() !== 'indian' && nationality.toLowerCase() !== 'india')) && (
                      <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2.5">
                        <span className="text-[11px] font-mono font-bold uppercase text-blue-900 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" /> Bureau of Immigration (BoI) Form C / FRRO Details
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          <input
                            type="text"
                            value={cFormPassportCountry}
                            onChange={e => setCFormPassportCountry(e.target.value)}
                            placeholder="Passport Country *"
                            className="px-2.5 py-1.5 border border-blue-300 rounded-lg bg-white font-semibold"
                          />
                          <input
                            type="text"
                            value={cFormPassportNumber}
                            onChange={e => setCFormPassportNumber(e.target.value.toUpperCase())}
                            placeholder="Passport Number *"
                            className="px-2.5 py-1.5 border border-blue-300 rounded-lg bg-white font-mono font-bold"
                          />
                          <input
                            type="text"
                            value={cFormVisaNumber}
                            onChange={e => setCFormVisaNumber(e.target.value.toUpperCase())}
                            placeholder="Visa Number *"
                            className="px-2.5 py-1.5 border border-blue-300 rounded-lg bg-white font-mono font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {/* ADDITIONAL GUEST DETAILS HEADER & CARDS */}
                    <div className="pt-3 border-t border-[#DCE3EC] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#263449]">
                          ADDITIONAL GUEST DETAILS ({secondaryGuests.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleAddSecondaryGuest}
                          className="px-3 py-1.5 rounded-lg bg-[#C49A3A] hover:bg-[#A8812B] text-white border border-[#A8812B] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          Add Guest <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {secondaryGuests.length > 0 && (
                        <div className="space-y-2.5">
                          {secondaryGuests.map((sg, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-[#F4F6F9] border border-[#DCE3EC] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                            >
                              <div className="sm:col-span-3 space-y-1">
                                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">
                                  Guest #{idx + 1} Full Name *
                                </label>
                                <input
                                  type="text"
                                  value={sg.fullName}
                                  onChange={e => handleUpdateSecondaryGuest(idx, 'fullName', e.target.value)}
                                  placeholder="Accompanying guest name"
                                  className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white font-semibold"
                                />
                              </div>
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Mobile</label>
                                <input
                                  type="tel"
                                  value={sg.mobile || ''}
                                  onChange={e => handleUpdateSecondaryGuest(idx, 'mobile', e.target.value)}
                                  placeholder="Phone"
                                  className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono bg-white"
                                />
                              </div>
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Age / Gender</label>
                                <div className="grid grid-cols-2 gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    value={sg.age ?? ''}
                                    onChange={e => handleUpdateSecondaryGuest(idx, 'age', e.target.value)}
                                    placeholder="Age"
                                    className="w-full px-2 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono bg-white"
                                  />
                                  <select
                                    value={sg.gender || 'Male'}
                                    onChange={e => handleUpdateSecondaryGuest(idx, 'gender', e.target.value)}
                                    className="w-full px-1 py-1.5 border border-[#DCE3EC] rounded-lg text-[11px] bg-white"
                                  >
                                    <option value="Male">M</option>
                                    <option value="Female">F</option>
                                    <option value="Other">O</option>
                                  </select>
                                </div>
                              </div>
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">ID Type</label>
                                <select
                                  value={sg.idType || 'Aadhaar'}
                                  onChange={e => handleUpdateSecondaryGuest(idx, 'idType', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white font-semibold"
                                >
                                  <option value="Aadhaar">Aadhaar</option>
                                  <option value="Passport">Passport</option>
                                  <option value="Driving License">DL</option>
                                  <option value="Voter ID">Voter ID</option>
                                </select>
                              </div>
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-mono uppercase text-slate-500 font-bold block">ID Number</label>
                                <input
                                  type="text"
                                  value={sg.idNumber || ''}
                                  onChange={e => handleUpdateSecondaryGuest(idx, 'idNumber', e.target.value.toUpperCase())}
                                  placeholder="ID No."
                                  className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono bg-white"
                                />
                              </div>
                              <div className="sm:col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSecondaryGuest(idx)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 cursor-pointer"
                                  title="Remove Extra Guest"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* SECTION 3: COLLAPSIBLE PACKAGES & ADD-ONS */}
                  <section className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowPackagesSection(prev => !prev)}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F6F9]/60 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#FDF8ED] border border-[#E6CE9A] text-[#9E6E24] flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-serif font-bold text-[#263449] block">
                            Packages &amp; add-ons
                          </span>
                          <span className="text-xs text-slate-500 block">
                            Attach hotel services, early check-in &amp; custom add-ons (Optional)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(selectedServiceIds.length > 0 || customAddonTotal > 0 || earlyCheckInCharge > 0) && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold">
                            ₹{(servicesTotal + customAddonTotal + earlyCheckInCharge).toLocaleString('en-IN')} added
                          </span>
                        )}
                        <span className="px-3 py-1 rounded-lg border border-[#DCE3EC] bg-white text-xs font-bold text-[#263449] inline-flex items-center gap-1">
                          {showPackagesSection ? 'Hide' : '+ Add Packages & Add-ons'}
                          {showPackagesSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                    </button>

                    {showPackagesSection && (
                      <div className="px-5 pb-5 pt-2 border-t border-[#DCE3EC] space-y-4">
                        {/* Configured Hotel Services */}
                        {serviceCatalog.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {serviceCatalog.map(s => {
                              const sid = String(s.id);
                              const isSelected = selectedServiceIds.includes(sid);
                              const unitAmt = serviceUnitOf(s);
                              const qty = Math.max(1, Number(serviceQtyMap[sid] ?? 1) || 1);
                              return (
                                <div
                                  key={sid}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                                    isSelected ? 'bg-[#FDF8ED] border-[#C49A3A]' : 'bg-[#F4F6F9]/50 border-[#DCE3EC]'
                                  }`}
                                >
                                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={e => {
                                        if (e.target.checked) setSelectedServiceIds(prev => [...prev, sid]);
                                        else setSelectedServiceIds(prev => prev.filter(id => id !== sid));
                                      }}
                                      className="w-4 h-4 accent-[#B5822D] cursor-pointer"
                                    />
                                    <div>
                                      <span className="text-xs font-bold text-[#263449] block">{s.serviceName}</span>
                                      <span className="text-[10px] font-mono text-slate-600">
                                        {unitAmt > 0 ? `₹${unitAmt.toLocaleString('en-IN')} / unit` : 'Complimentary'}
                                      </span>
                                    </div>
                                  </label>
                                  {isSelected && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <input
                                        type="number"
                                        min={1}
                                        value={qty}
                                        title="Quantity"
                                        onChange={e =>
                                          setServiceQtyMap(prev => ({ ...prev, [sid]: Math.max(1, Number(e.target.value) || 1) }))
                                        }
                                        className="w-12 px-1.5 py-1 border border-[#C49A3A] rounded-lg text-xs font-mono font-bold text-center bg-white"
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        value={servicePriceMap[sid] ?? ''}
                                        placeholder={String(serviceAmountOf(s))}
                                        title="Unit price override (₹)"
                                        onChange={e =>
                                          setServicePriceMap(prev => ({
                                            ...prev,
                                            [sid]: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0),
                                          }))
                                        }
                                        className="w-16 px-1.5 py-1 border border-[#C49A3A] rounded-lg text-xs font-mono font-bold text-center bg-white"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Custom Add-Ons: Multi-item support */}
                        <div className="space-y-3 p-3.5 rounded-xl bg-[#F4F6F9] border border-[#DCE3EC]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#263449]">Custom Add-ons &amp; Extra Services</span>
                              {customAddonTotal > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                                  ₹{customAddonTotal.toLocaleString('en-IN')} total
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomExtraRows(prev => [
                                  ...prev,
                                  { id: `cx-${Date.now()}-${prev.length}`, label: '', qty: 1, rate: '' }
                                ])
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#C49A3A] text-[#8B691E] hover:bg-[#FDF8ED] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" /> + Add Another Custom Item
                            </button>
                          </div>

                          {/* Row 1: Primary custom add-on */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-2.5 rounded-lg border border-[#E5E7EB]">
                            <div className="md:col-span-6 space-y-1">
                              <label className="text-[11px] font-bold text-[#263449] block">Custom Add-on Label</label>
                              <input
                                type="text"
                                value={customAddonLabel}
                                onChange={e => setCustomAddonLabel(e.target.value)}
                                placeholder="e.g. Airport Pickup / Cake / Bouquet"
                                className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                              />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                              <label className="text-[11px] font-bold text-[#263449] block">Qty</label>
                              <input
                                type="number"
                                min={1}
                                value={customAddonQty}
                                onChange={e => setCustomAddonQty(Math.max(1, Number(e.target.value) || 1))}
                                className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white text-center"
                              />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                              <label className="text-[11px] font-bold text-[#263449] block">Rate (₹)</label>
                              <input
                                type="number"
                                min={0}
                                value={customAddonRate || ''}
                                onChange={e => setCustomAddonRate(Math.max(0, Number(e.target.value) || 0))}
                                placeholder="0"
                                className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white text-center"
                              />
                            </div>
                            <div className="md:col-span-1 text-right text-[11px] font-mono font-bold text-slate-700 py-1.5">
                              ₹{customAddonSingleTotal.toLocaleString('en-IN')}
                            </div>
                          </div>

                          {/* Additional Dynamic Custom Add-On Rows */}
                          {customExtraRows.map((row, idx) => {
                            const rowAmt = Math.round((Math.max(1, Number(row.qty) || 1)) * (Number(row.rate) || 0) * 100) / 100;
                            return (
                              <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-2.5 rounded-lg border border-[#E5E7EB]">
                                <div className="md:col-span-5 space-y-1">
                                  <label className="text-[11px] font-bold text-[#263449] block">Custom Item #{idx + 2}</label>
                                  <input
                                    type="text"
                                    value={row.label}
                                    placeholder="e.g. Candlelight Dinner, Laundry, City Cab"
                                    onChange={e =>
                                      setCustomExtraRows(prev =>
                                        prev.map(r => (r.id === row.id ? { ...r, label: e.target.value } : r))
                                      )
                                    }
                                    className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                  <label className="text-[11px] font-bold text-[#263449] block">Qty</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={row.qty}
                                    onChange={e =>
                                      setCustomExtraRows(prev =>
                                        prev.map(r =>
                                          r.id === row.id
                                            ? { ...r, qty: e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1) }
                                            : r
                                        )
                                      )
                                    }
                                    className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold text-center bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                  <label className="text-[11px] font-bold text-[#263449] block">Rate (₹)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={row.rate}
                                    placeholder="0"
                                    onChange={e =>
                                      setCustomExtraRows(prev =>
                                        prev.map(r =>
                                          r.id === row.id
                                            ? { ...r, rate: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) }
                                            : r
                                        )
                                      )
                                    }
                                    className="w-full px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold text-center bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2 text-right text-[11px] font-mono font-bold text-slate-700 py-1.5">
                                  ₹{rowAmt.toLocaleString('en-IN')}
                                </div>
                                <div className="md:col-span-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setCustomExtraRows(prev => prev.filter(r => r.id !== row.id))}
                                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* SECTION 4: COLLAPSIBLE SPECIAL REQUESTS & PREFERENCES */}
                  <section className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowSpecialReqSection(prev => !prev)}
                      className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F4F6F9]/60 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-[#DCE3EC] text-slate-700 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-serif font-bold text-[#263449] block">
                            Special requests &amp; preferences
                          </span>
                          <span className="text-xs text-slate-500 block">
                            Guest room preferences, travel agent, purpose of visit &amp; front office notes (Optional)
                          </span>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-lg border border-[#DCE3EC] bg-white text-xs font-bold text-[#263449] inline-flex items-center gap-1 shrink-0">
                        {showSpecialReqSection ? 'Hide' : '+ Add Requests & Preferences'}
                        {showSpecialReqSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    </button>

                    {showSpecialReqSection && (
                      <div className="px-5 pb-5 pt-2 border-t border-[#DCE3EC] space-y-3.5">
                        <div className="flex flex-wrap gap-2">
                          {['Early Check-In', 'Late Check-Out', 'High Floor', 'Quiet Room', 'King Bed', 'Airport Pickup', 'Extra Pillows'].map(tag => {
                            const active = specialRequestTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() =>
                                  setSpecialRequestTags(prev =>
                                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                  )
                                }
                                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                                  active
                                    ? 'bg-[#FDF8ED] border-[#C49A3A] text-[#8B691E]'
                                    : 'bg-white border-[#DCE3EC] text-slate-600 hover:bg-[#F4F6F9]'
                                }`}
                              >
                                {active ? '✓ ' : '+ '}
                                {tag}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Purpose of Visit</label>
                            <input
                              type="text"
                              value={purposeOfVisit}
                              onChange={e => setPurposeOfVisit(e.target.value)}
                              placeholder="Leisure / Business"
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Coming From</label>
                            <input
                              type="text"
                              value={comingFrom}
                              onChange={e => setComingFrom(e.target.value)}
                              placeholder="Origin city"
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Going To</label>
                            <input
                              type="text"
                              value={goingTo}
                              onChange={e => setGoingTo(e.target.value)}
                              placeholder="Next destination"
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#263449] block">Voucher / Tour Ref No.</label>
                            <input
                              type="text"
                              value={voucherNumber}
                              onChange={e => setVoucherNumber(e.target.value)}
                              placeholder="e.g. VCH-2026-109"
                              className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg font-mono bg-white"
                            />
                          </div>
                        </div>

                        {false && travelAgents.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-[#263449] block">Travel Agent / Partner</label>
                              <select
                                value={selectedAgentId}
                                onChange={e => handleSelectTravelAgent(e.target.value)}
                                className="w-full px-3 py-1.5 border border-[#DCE3EC] rounded-lg bg-white font-semibold"
                              >
                                <option value="">Direct / No Agent</option>
                                {travelAgents.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.agencyName || a.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#263449] block">Front Office Notes</label>
                          <textarea
                            rows={2}
                            value={specialRequestNotes}
                            onChange={e => setSpecialRequestNotes(e.target.value)}
                            placeholder="Any special dietary, room, or arrival instructions..."
                            className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* SECTION 5: PRICING REVIEW, PAYMENT & CONFIRMATION */}
                  <section className="bg-white border border-[#DCE3EC] rounded-2xl shadow-xs p-5 space-y-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-serif font-bold text-[#263449]">
                        Pricing review, payment &amp; confirmation
                      </h3>
                      <p className="text-xs text-slate-500">Live pricing summary, discount, GST, negotiated settlement &amp; payment collection</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                      {/* LEFT HALF: PRICE BREAKDOWN + DISCOUNT + SETTLEMENT + COMMUNICATION */}
                      <div className="space-y-3.5">
                        <div className="p-4 rounded-xl bg-[#F4F6F9] border border-[#DCE3EC] space-y-3">
                          <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#263449] flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-[#C49A3A]" /> PRICE BREAKDOWN
                          </span>

                          <div className="space-y-1.5 text-xs font-mono">
                            {liveCheckInCharges.map((ch, idx) => (
                              <div key={`${ch.id}-${idx}`} className="flex justify-between gap-2 text-slate-700">
                                <span className="truncate">
                                  {ch.description}
                                  {ch.roomNumber ? ` (${ch.roomNumber})` : ''}
                                </span>
                                <strong className="text-[#263449] shrink-0">
                                  ₹{Number(ch.amount || 0).toLocaleString('en-IN')}
                                </strong>
                              </div>
                            ))}

                            {totalEffectiveDiscount > 0 && (
                              <div className="flex justify-between gap-2 text-amber-700">
                                <span>Discount &amp; Adjustment</span>
                                <strong>− ₹{totalEffectiveDiscount.toLocaleString('en-IN')}</strong>
                              </div>
                            )}

                            <div className="flex justify-between gap-2 text-slate-700">
                              <span>
                                {checkInGstMode === 'including_gst'
                                  ? `GST Included (${gstPercent || configuredDefaultGst || 5}%)`
                                  : checkInGstMode === 'non_gst'
                                  ? 'GST (0% Non-GST)'
                                  : `GST (${gstPercent}%)`}
                              </span>
                              <strong className="text-[#263449]">₹{gstTax.toLocaleString('en-IN')}</strong>
                            </div>

                            <div className="flex justify-between gap-2 pt-2 border-t border-[#DCE3EC] text-sm">
                              <span className="font-sans font-bold text-[#263449]">
                                Total Amount{' '}
                                <span className="text-[11px] font-normal text-slate-500">
                                  {checkInGstMode === 'including_gst'
                                    ? `(Tariff includes ${gstPercent || 5}% GST)`
                                    : checkInGstMode === 'non_gst' || gstPercent <= 0
                                    ? '(Non-GST / 0% Tax)'
                                    : '(Inclusive of taxes)'}
                                </span>
                              </span>
                              <strong className="text-[#8B691E] font-extrabold">
                                ₹{finalAmount.toLocaleString('en-IN')}
                              </strong>
                            </div>
                          </div>

                          {/* Discount ON/OFF Toggle */}
                          <div className="pt-2.5 border-t border-[#DCE3EC]/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="inline-flex items-center gap-2 text-xs font-bold text-[#263449] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={discountEnabled}
                                  onChange={e => setDiscountEnabled(e.target.checked)}
                                  className="w-4 h-4 accent-[#B5822D] cursor-pointer"
                                />
                                <span>Apply Discount</span>
                              </label>
                              {discountEnabled && (
                                <div className="inline-flex rounded-lg border border-[#DCE3EC] bg-white overflow-hidden text-[11px] font-mono font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setDiscountMode('fixed')}
                                    className={`px-2 py-0.5 cursor-pointer ${discountMode === 'fixed' ? 'bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50' : 'text-slate-600'}`}
                                  >
                                    ₹ Flat
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDiscountMode('percent')}
                                    className={`px-2 py-0.5 cursor-pointer ${discountMode === 'percent' ? 'bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50' : 'text-slate-600'}`}
                                  >
                                    % Pct
                                  </button>
                                </div>
                              )}
                            </div>
                            {discountEnabled && (
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={discountInputValue || ''}
                                  onChange={e => setDiscountInputValue(Math.max(0, Number(e.target.value) || 0))}
                                  placeholder={discountMode === 'percent' ? 'Discount %' : 'Discount ₹'}
                                  className="px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                                />
                                <input
                                  type="text"
                                  value={discountReason}
                                  onChange={e => setDiscountReason(e.target.value)}
                                  placeholder="Discount reason (optional)"
                                  className="px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white"
                                />
                              </div>
                            )}

                            {/* Negotiated Settlement ON/OFF Toggle */}
                            <div className="flex items-center justify-between pt-1">
                              <label className="inline-flex items-center gap-2 text-xs font-bold text-[#263449] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={settlementEnabled}
                                  onChange={e => setSettlementEnabled(e.target.checked)}
                                  className="w-4 h-4 accent-[#B5822D] cursor-pointer"
                                />
                                <span>Negotiated Final Settlement</span>
                              </label>
                              {settlementEnabled && (
                                <div className="inline-flex rounded-lg border border-[#DCE3EC] bg-white overflow-hidden text-[11px] font-mono font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setSettlementMode('exact')}
                                    className={`px-2 py-0.5 cursor-pointer ${settlementMode === 'exact' ? 'bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50' : 'text-slate-600'}`}
                                  >
                                    Exact Total ₹
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSettlementMode('adjustment')}
                                    className={`px-2 py-0.5 cursor-pointer ${settlementMode === 'adjustment' ? 'bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50' : 'text-slate-600'}`}
                                  >
                                    Subtract ₹
                                  </button>
                                </div>
                              )}
                            </div>
                            {settlementEnabled && (
                              <div className="grid grid-cols-2 gap-2">
                                {settlementMode === 'exact' ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={settlementTargetInput}
                                    onChange={e =>
                                      setSettlementTargetInput(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
                                    }
                                    placeholder="Target final ₹"
                                    className="px-2.5 py-1.5 border border-[#C49A3A] rounded-lg text-xs font-mono font-bold bg-white"
                                  />
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    value={settlementAdjustmentInput || ''}
                                    onChange={e => setSettlementAdjustmentInput(Math.max(0, Number(e.target.value) || 0))}
                                    placeholder="Subtract ₹"
                                    className="px-2.5 py-1.5 border border-[#C49A3A] rounded-lg text-xs font-mono font-bold bg-white"
                                  />
                                )}
                                <input
                                  type="text"
                                  value={settlementReason}
                                  onChange={e => setSettlementReason(e.target.value)}
                                  placeholder="Manager approval reason *"
                                  className="px-2.5 py-1.5 border border-[#C49A3A] rounded-lg text-xs bg-white"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Communication Preferences */}
                        <div className="p-4 rounded-xl bg-white border border-[#DCE3EC] space-y-2.5">
                          <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#263449] block">
                            COMMUNICATION PREFERENCES
                          </span>
                          <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[#DCE3EC] hover:bg-[#F4F6F9]/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={commEmail}
                              onChange={e => setCommEmail(e.target.checked)}
                              className="w-4 h-4 mt-0.5 accent-[#B5822D] cursor-pointer"
                            />
                            <div>
                              <span className="text-xs font-bold text-[#263449] block">Email confirmation</span>
                              <span className="text-[11px] text-slate-500">Send booking &amp; GRC details to guest email</span>
                            </div>
                          </label>
                          <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[#DCE3EC] hover:bg-[#F4F6F9]/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={commSms}
                              onChange={e => setCommSms(e.target.checked)}
                              className="w-4 h-4 mt-0.5 accent-[#B5822D] cursor-pointer"
                            />
                            <div>
                              <span className="text-xs font-bold text-[#263449] block">SMS / WhatsApp confirmation</span>
                              <span className="text-[11px] text-slate-500">Send booking summary to guest mobile</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* RIGHT HALF: PAYMENT SUMMARY & 4 BOOKING ACTIONS */}
                      <div className="p-4 rounded-xl bg-[#F4F6F9] border border-[#C49A3A]/50 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#263449] flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-[#C49A3A]" /> PAYMENT SUMMARY
                          </span>
                        </div>

                        {/* 3-Way GST Billing Mode Selector */}
                        <div className="bg-white border border-[#DCE3EC] rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-mono uppercase font-bold text-[#263449] block">
                              GST Billing Mode *
                            </label>
                            {isCheckInGstLockedByExistingInvoice && existingStayPrimaryInvoice ? (
                              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                🔒 Locked #{existingStayPrimaryInvoice.invoiceNumber}
                              </span>
                            ) : (
                              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                                checkInGstMode === 'non_gst'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : checkInGstMode === 'including_gst'
                                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}>
                                {checkInGstMode === 'non_gst'
                                  ? 'Non-GST (0% Bill of Supply)'
                                  : checkInGstMode === 'including_gst'
                                  ? `Including GST (${gstPercent || configuredDefaultGst || 5}%)`
                                  : `GST Extra (+${gstPercent || configuredDefaultGst || 5}%)`}
                              </span>
                            )}
                          </div>
                          {isCheckInGstLockedByExistingInvoice && existingStayPrimaryInvoice ? (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                              Advance invoice <strong>#{existingStayPrimaryInvoice.invoiceNumber}</strong> is already generated ({gstPercent > 0 ? `With GST ${gstPercent}%` : 'No GST 0%'}). GST cannot be edited on a generated invoice.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckInGstMode('non_gst');
                                  setGstPercent(0);
                                }}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  checkInGstMode === 'non_gst'
                                    ? 'bg-amber-100 border-[#C49A3A] text-amber-950 font-bold shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="text-xs font-bold">1. Non-GST (0%)</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Bill of Supply • No Tax</div>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckInGstMode('gst_extra');
                                  setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                                }}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  checkInGstMode === 'gst_extra'
                                    ? 'bg-emerald-100 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="text-xs font-bold">2. GST Extra (+{configuredDefaultGst > 0 ? configuredDefaultGst : 5}%)</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Rate + GST Added on Top</div>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckInGstMode('including_gst');
                                  setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                                }}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  checkInGstMode === 'including_gst'
                                    ? 'bg-blue-100 border-blue-500 text-blue-950 font-bold shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="text-xs font-bold">3. Including GST ({configuredDefaultGst > 0 ? configuredDefaultGst : 5}%)</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">Tariff Includes GST (Net ₹{roomRate || 0})</div>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-end justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#DCE3EC]">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">
                              ESTIMATED TOTAL
                            </span>
                            <strong className="text-2xl font-mono font-black text-[#263449]">
                              ₹{finalAmount.toLocaleString('en-IN')}
                            </strong>
                            <span className="text-[10px] text-slate-500 block">
                              {checkInGstMode === 'including_gst'
                                ? `Tariff includes ${gstPercent || 5}% GST (Tax ₹${gstTax.toLocaleString('en-IN')})`
                                : checkInGstMode === 'non_gst' || gstPercent <= 0
                                ? 'Without GST (0% Bill of Supply)'
                                : `Inclusive of ${gstPercent}% GST`}
                            </span>
                          </div>
                          <div className="text-right font-mono text-xs space-y-0.5">
                            {advanceAmount > 0 && (
                              <div className="text-emerald-700 font-bold">
                                Pre-Paid Adv: ₹{advanceAmount.toLocaleString('en-IN')}
                              </div>
                            )}
                            <div className={balanceAmount > 0 ? 'text-amber-700 font-extrabold' : 'text-emerald-700 font-extrabold'}>
                              Balance Due: ₹{balanceAmount.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        {checkInGstMode !== 'non_gst' && gstPercent > 0 && (
                          <div className="p-3 rounded-xl bg-white border border-[#DCE3EC] space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono uppercase font-bold text-slate-600">GST INVOICE TYPE</span>
                              <div className="inline-flex rounded-lg border border-[#DCE3EC] overflow-hidden text-[11px] font-mono font-bold">
                                <button type="button" onClick={() => setGstInvoiceCategory('B2C')} className={`px-3 py-1 cursor-pointer ${gstInvoiceCategory === 'B2C' ? 'bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50' : 'text-slate-600'}`}>B2C</button>
                                <button type="button" onClick={() => setGstInvoiceCategory('B2B')} className={`px-3 py-1 cursor-pointer ${gstInvoiceCategory === 'B2B' ? 'bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50' : 'text-slate-600'}`}>B2B</button>
                              </div>
                            </div>
                            {gstInvoiceCategory === 'B2B' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className="px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs bg-white" />
                                <input type="text" value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())} placeholder="Company GSTIN" className="px-2.5 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono bg-white" />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Payment Method + Paid Amount (or Hybrid Split Rows) */}
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block">
                                PAYMENT METHOD
                              </label>
                              <select
                                value={isHybridCheckInPay ? 'Hybrid' : paymentMethod}
                                onChange={e => {
                                  const v = e.target.value;
                                  if (v === 'Hybrid') {
                                    setIsHybridCheckInPay(true);
                                    const rem = Math.max(0, finalAmount - advanceAmount);
                                    const seed = Number(paidAmount) > 0 ? Number(paidAmount) : rem;
                                    const half = Math.floor(seed / 2);
                                    setCheckInSplitRows([
                                      { id: 'ci-sp-1', method: 'Cash', amount: half, ref: '' },
                                      {
                                        id: 'ci-sp-2',
                                        method: 'UPI',
                                        amount: Math.max(0, Math.round((seed - half) * 100) / 100),
                                        ref: '',
                                      },
                                    ]);
                                  } else {
                                    setIsHybridCheckInPay(false);
                                    setPaymentMethod(v as PaymentMethod);
                                  }
                                }}
                                className="w-full px-3 py-2 border border-[#C2CDD9] rounded-xl text-xs font-bold bg-white"
                              >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Online">Virtual Payment / Online</option>
                                <option value="Hybrid">⇄ Hybrid / Split Payment</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-mono uppercase font-bold text-slate-600">
                                  PAID AMOUNT (₹)
                                </label>
                                {!isHybridCheckInPay && balanceAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setPaidAmount(Math.max(0, Math.round((finalAmount - advanceAmount) * 100) / 100))}
                                    className="text-[10px] font-mono font-bold text-[#8B691E] hover:underline cursor-pointer"
                                  >
                                    Fill Full (₹{Math.max(0, finalAmount - advanceAmount).toLocaleString('en-IN')})
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                readOnly={isHybridCheckInPay}
                                value={isHybridCheckInPay ? effectiveDeskReceivedNow : paidAmount || ''}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={e => setPaidAmount(Math.max(0, Number(e.target.value) || 0))}
                                placeholder="₹0.00"
                                className={`w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold ${
                                  isHybridCheckInPay ? 'bg-emerald-50 text-emerald-900 cursor-not-allowed' : 'bg-white'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Hybrid / Split Payment Rows */}
                          {isHybridCheckInPay ? (
                            <div className="p-3 rounded-xl bg-white border border-[#C49A3A]/60 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#263449]">⇄ Hybrid / Split Payment Rows</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCheckInSplitRows(prev => [
                                      ...prev,
                                      { id: `ci-sp-${Date.now()}`, method: 'Card', amount: '', ref: '' },
                                    ])
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#F4F6F9] hover:bg-[#FDF8ED] border border-[#C49A3A] text-[11px] font-bold text-[#8B691E] cursor-pointer"
                                >
                                  + Add Method
                                </button>
                              </div>
                              {checkInSplitRows.map((sp, idx) => (
                                <div key={sp.id} className="grid grid-cols-12 gap-1.5 items-center">
                                  <select
                                    value={sp.method}
                                    onChange={e =>
                                      setCheckInSplitRows(prev =>
                                        prev.map(r => (r.id === sp.id ? { ...r, method: e.target.value as PaymentMethod } : r))
                                      )
                                    }
                                    className="col-span-4 px-2 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-bold bg-white"
                                  >
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">Card</option>
                                    <option value="Bank Transfer">Bank</option>
                                    <option value="Online">Virtual</option>
                                  </select>
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={sp.amount}
                                    onChange={e =>
                                      setCheckInSplitRows(prev =>
                                        prev.map(r =>
                                          r.id === sp.id
                                            ? { ...r, amount: e.target.value === '' ? '' : Number(e.target.value) }
                                            : r
                                        )
                                      )
                                    }
                                    placeholder={`Amt #${idx + 1}`}
                                    className="col-span-3 px-2 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono font-bold bg-white"
                                  />
                                  <input
                                    type="text"
                                    value={sp.ref ?? (sp as any).reference ?? ''}
                                    onChange={e =>
                                      setCheckInSplitRows(prev =>
                                        prev.map(r => (r.id === sp.id ? { ...r, ref: e.target.value } : r))
                                      )
                                    }
                                    placeholder="UTR / Ref"
                                    className="col-span-4 px-2 py-1.5 border border-[#DCE3EC] rounded-lg text-xs font-mono bg-white"
                                  />
                                  <button
                                    type="button"
                                    disabled={checkInSplitRows.length <= 2}
                                    onClick={() => setCheckInSplitRows(prev => prev.filter(r => r.id !== sp.id))}
                                    className="col-span-1 py-1.5 rounded-lg text-slate-600 hover:bg-amber-50 disabled:opacity-30 font-bold text-xs cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <div className="flex justify-between text-[11px] font-mono pt-1 border-t border-[#DCE3EC]">
                                <span className="text-emerald-700 font-bold">
                                  Combined: ₹{effectiveDeskReceivedNow.toLocaleString('en-IN')}
                                </span>
                                <span className={balanceAmount > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                                  Due: ₹{balanceAmount.toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block">
                                PAYMENT REMARK / UTR (OPTIONAL)
                              </label>
                              <input
                                type="text"
                                value={singlePaymentRef}
                                onChange={e => setSinglePaymentRef(e.target.value)}
                                placeholder="Transaction ID / UTR / Notes"
                                className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono bg-white"
                              />
                            </div>
                          )}
                        </div>

                        {/* 4 BOOKING ACTION BUTTONS */}
                        <div className="space-y-2 pt-1">
                          <button
                            type="submit"
                            disabled={isSubmittingAction}
                            className="w-full py-3 rounded-xl bg-[#C49A3A] hover:bg-[#A8812B] text-white border border-[#A8812B] text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            <FileCheck className="w-4 h-4 text-white" />
                            {editingCheckIn
                              ? `Update Stay Details (${editingCheckIn.id})`
                              : isFutureAdvanceArrival
                              ? 'Confirm Advance Booking'
                              : selectedBooking
                              ? `Reserve & Check-In Now (${selectedBooking.id})`
                              : activeSessionBookingId
                              ? `Reserve & Check-In Now (${activeSessionBookingId})`
                              : 'Reserve & Check-In Now'}
                          </button>

                          {!editingCheckIn && (
                            <>
                              <button
                                type="button"
                                disabled={isSubmittingAction}
                                onClick={() => handleCreateReservationAction('Confirmed', 'Reservation Confirmed')}
                                className="w-full py-2.5 rounded-xl bg-white hover:bg-[#FDF8ED] border border-[#C2CDD9] text-[#263449] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-4 h-4 text-emerald-700" /> Confirm Reservation Only
                              </button>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={isSubmittingAction}
                                  onClick={() => handleCreateReservationAction('Draft', 'Draft Saved')}
                                  className="py-2 rounded-xl bg-white hover:bg-[#F4F6F9] border border-[#DCE3EC] text-[#263449] text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                  Save as Draft
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubmittingAction}
                                  onClick={() => handleCreateReservationAction('Waiting', 'Added to Waitlist')}
                                  className="py-2 rounded-xl bg-white hover:bg-amber-50 border border-[#DCE3EC] text-[#263449] text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                  Add to Waitlist
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
              {/* MOBILE STICKY TOTAL & ACTION BAR */}
              <div className="lg:hidden sticky bottom-0 z-20 -mx-1 px-3 py-2.5 bg-white/95 backdrop-blur border-t-2 border-[#C49A3A] rounded-t-2xl shadow-lg flex items-center justify-between gap-3 no-print">
                <div className="font-mono leading-tight">
                  <span className="text-[10px] uppercase text-slate-500 block">Total / Due</span>
                  <strong className="text-sm text-[#263449]">₹{finalAmount.toLocaleString('en-IN')}</strong>
                  <span className={`text-[11px] ml-2 font-bold ${balanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {balanceAmount > 0 ? `Due ₹${balanceAmount.toLocaleString('en-IN')}` : 'PAID'}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="px-4 py-2 rounded-xl bg-[#F6E9C8] text-[#8B691E] border border-[#C49A3A]/50 border border-[#C49A3A] text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {editingCheckIn ? 'Update Stay' : isFutureAdvanceArrival ? 'Confirm Advance Booking' : 'Reserve & Check-In'}
                </button>
              </div>
            </form>
              </>
            )}
        </div>
        )}

        {/* TAB 2: IN-HOUSE GUESTS & FOLIOS REGISTER */}
        {activeSubTab === 'folios' && (() => {
          const dateFiltered = checkins.filter(c => matchesFolioDate(c.checkInDate, c.checkOutDate || c.checkedOutDateTime));
          const activeInHouse = dateFiltered.filter(c => !c.checkedOutDateTime);
          const checkedOutRecords = dateFiltered.filter(c => Boolean(c.checkedOutDateTime));
          const displayedCheckins =
            folioFilter === 'active'
              ? activeInHouse
              : folioFilter === 'checkedout'
              ? checkedOutRecords
              : dateFiltered;

          return (
          <div className="bg-white border border-luxury-brown-100 rounded-b-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-luxury-brown-100 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#9E2A2B]" /> In-House Active Guest Register &amp; Folios
                </h3>
                <p className="text-xs text-luxury-brown-600">Currently checked-in guests, room allocations, extra bed logs, and live balance status.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('form')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#C49A3A] bg-[#F6DE98] hover:bg-[#E8CE84] text-[#17120F] transition-all cursor-pointer"
                >
                  ← Back to Check-In Form
                </button>
                <button
                  type="button"
                  onClick={() => setFolioFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    folioFilter === 'active'
                      ? 'bg-luxury-brown-950 text-luxury-gold-300 border-luxury-brown-950'
                      : 'bg-luxury-beige-50 text-luxury-brown-800 border-luxury-brown-200 hover:bg-luxury-beige-100'
                  }`}
                >
                  Active In-House ({activeInHouse.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFolioFilter('checkedout')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    folioFilter === 'checkedout'
                      ? 'bg-luxury-brown-950 text-luxury-gold-300 border-luxury-brown-950'
                      : 'bg-luxury-beige-50 text-luxury-brown-800 border-luxury-brown-200 hover:bg-luxury-beige-100'
                  }`}
                >
                  Checked-Out History ({checkedOutRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFolioFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    folioFilter === 'all'
                      ? 'bg-luxury-brown-950 text-luxury-gold-300 border-luxury-brown-950'
                      : 'bg-luxury-beige-50 text-luxury-brown-800 border-luxury-brown-200 hover:bg-luxury-beige-100'
                  }`}
                >
                  All Folios ({checkins.length})
                </button>
              </div>
            </div>

            {/* Date-Wise Filter Bar (Asia/Kolkata timezone, Default: Today) */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1 mr-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-700" />
                  Date Filter:
                </span>
                {(
                  [
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'all', label: 'All Dates' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyFolioDatePreset(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      folioDatePreset === p.id
                        ? 'bg-slate-900 text-amber-400 shadow-xs'
                        : 'bg-white hover:bg-amber-100/80 text-slate-700 border border-amber-200/80'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-600">From → To:</span>
                <input
                  type="date"
                  value={folioFromDate}
                  onChange={(e) => {
                    setFolioDatePreset('custom');
                    setFolioFromDate(e.target.value);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white font-bold text-slate-800 text-xs"
                />
                <span className="text-slate-400 font-bold">→</span>
                <input
                  type="date"
                  value={folioToDate}
                  onChange={(e) => {
                    setFolioDatePreset('custom');
                    setFolioToDate(e.target.value);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white font-bold text-slate-800 text-xs"
                />
                <button
                  type="button"
                  onClick={() => applyFolioDatePreset('today')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-[11px] cursor-pointer"
                >
                  Reset to Today
                </button>
              </div>
            </div>

            {displayedCheckins.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                {folioFilter === 'active'
                  ? 'No active checked-in guests at the moment. Use the Check-In Form tab to process walk-ins or reservations.'
                  : 'No guest folios match the selected filter.'}
              </div>
            ) : (
              <div className="overflow-x-auto border border-luxury-brown-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-luxury-brown-950 text-luxury-gold-300 font-mono uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Room / Group</th>
                      <th className="p-3">Primary Guest</th>
                      <th className="p-3">Contact / ID</th>
                      <th className="p-3">Dates & Nights</th>
                      <th className="p-3">Features & Badges</th>
                      <th className="p-3 text-right">Tariff & Extra Bed</th>
                      <th className="p-3 text-right">Paid / Balance</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {displayedCheckins.map((c) => {
                      const isGroup = c.isGroupCheckIn || (c.bookedRooms && c.bookedRooms.length > 1);
                      const hasExtraBed = c.hasExtraBed;
                      const isForeign = c.cFormData || (c.nationality && c.nationality.toLowerCase() !== 'indian');
                      const nights = calcStayDays(c.checkInDate, c.checkOutDate);
                      const extraPaid = (c.payments || [])
                        .filter(p => p.paymentType !== 'Advance Deposit')
                        .reduce((sum, p) => sum + p.amount, 0);
                      const totalPaid = (c.advanceAmount || 0) + extraPaid;
                      const extrasSum = (c.extraCharges || [])
                        .filter(e => !String(e.id || '').startsWith('ALLOC-CHK-') && !String(e.id || '').startsWith('AUX-CHK-'))
                        .reduce((sum, e) => sum + e.amount, 0);
                      const liveDue = c.checkedOutDateTime
                        ? (c.pendingAmount || 0)
                        : Math.max(0, ((c as any).finalAmount || c.totalAmount || 0) + extrasSum - totalPaid);

                      return (
                        <tr key={c.id} className="hover:bg-luxury-beige-50/40">
                          <td className="p-3">
                            <span className="font-bold text-sm text-luxury-brown-950 block">Room {c.roomNumber}</span>
                            {c.checkedOutDateTime ? (
                              <span className="inline-block text-[10px] font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5">
                                Checked Out
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded mt-0.5">
                                In-House
                              </span>
                            )}
                            {isGroup && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded mt-1">
                                <Users className="w-3 h-3" /> Group: {c.groupName || 'Multi-Room'}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-luxury-brown-900 block">{c.guestName}</span>
                            <span className="text-[11px] text-gray-500 block">{c.numGuests || 1} Occupants</span>
                          </td>
                          <td className="p-3 font-mono">
                            <span className="block font-bold text-gray-800">{c.mobile}</span>
                            <span className="text-[10px] text-gray-500">{c.idType || 'ID'}: {c.idNumber || c.aadhaarNumber || c.passportNumber}</span>
                          </td>
                          <td className="p-3 font-mono text-[11px]">
                            <div>In: <span className="font-bold">{c.checkInDate}</span></div>
                            <div>Out: <span className="font-bold">{c.checkOutDate}</span> ({nights} Nights)</div>
                          </td>
                          <td className="p-3 space-y-1">
                            {hasExtraBed && (
                              <span className="inline-block text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                Extra Bed ({c.extraBedCount || 1} Bed @ ₹{c.extraBedRate || 500})
                              </span>
                            )}
                            {isForeign && (
                              <span className="inline-block text-[10px] font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                                🌐 Foreign Guest (Form-C)
                              </span>
                            )}
                            {(c.allocatedServices || []).length > 0 && (
                              <div className="space-y-0.5">
                                {(c.allocatedServices || []).map((srv) => (
                                  <span
                                    key={srv.id}
                                    className={`block text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                      srv.isChargeable
                                        ? 'text-amber-900 bg-amber-50 border-amber-300'
                                        : 'text-emerald-900 bg-emerald-50 border-emerald-300'
                                    }`}
                                  >
                                    {srv.serviceName}: {srv.isChargeable ? `₹${Number(srv.chargedAmount ?? (srv as any).amount ?? 0).toLocaleString()} (Charged)` : '₹0 (Complimentary)'}
                                  </span>
                                ))}
                              </div>
                            )}
                            {!hasExtraBed && !isForeign && !isGroup && !(c.allocatedServices && c.allocatedServices.length > 0) && (
                              <span className="text-gray-400 italic text-[11px]">Standard Check-In</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            ₹{(c.roomRate || 0).toLocaleString()} / Nt
                            {hasExtraBed && c.extraBedTotal && (
                              <div className="text-[10px] text-amber-800">+ ₹{c.extraBedTotal} Bed Charge</div>
                            )}
                            {extrasSum > 0 && (
                              <div className="text-[10px] text-blue-800">+ ₹{extrasSum.toLocaleString()} Extras</div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono">
                            <div className="text-emerald-700 font-bold">Paid: ₹{totalPaid.toLocaleString()}</div>
                            <div className={`font-bold ${liveDue > 0 ? 'text-rose-700' : 'text-gray-600'}`}>
                              Due: ₹{liveDue.toLocaleString()}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedCheckInForView(c)}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditCheckIn(c)}
                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Sliders className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintOfficialGrc(c)}
                                className="px-2.5 py-1.5 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-luxury-gold-300 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                                title="Print Official Guest Registration Card (GRC)"
                              >
                                <Printer className="w-3.5 h-3.5" /> Print GRC
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* GUEST REGISTRATION & CHECK-IN DETAILS MODAL (VIEW BUTTON) */}
            {selectedCheckInForView && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
                <div className="bg-white rounded-2xl max-w-2xl w-full border border-luxury-gold-500/30 overflow-hidden shadow-2xl animate-in fade-in duration-200">
                  {/* Modal Header */}
                  <div className="bg-luxury-brown-950 p-4 text-white flex justify-between items-center border-b border-luxury-gold-500/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-luxury-gold-400" />
                      <h2 className="text-sm font-serif font-bold text-luxury-gold-200 uppercase tracking-wider">
                        Guest Registration & Check-In Particulars
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCheckInForView(null)}
                      className="text-luxury-brown-300 hover:text-white transition-colors p-1 rounded-lg cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh] text-xs">
                    {/* Top Summary Banner */}
                    <div className="flex items-center justify-between p-3.5 bg-luxury-beige-50 rounded-xl border border-luxury-brown-200">
                      <div>
                        <h3 className="text-base font-serif font-bold text-luxury-brown-950">{selectedCheckInForView.guestName}</h3>
                        <p className="text-xs text-luxury-brown-600 mt-0.5 font-mono">
                          Room {selectedCheckInForView.roomNumber} • {selectedCheckInForView.roomType || 'Standard'} • {selectedCheckInForView.numGuests || 1} Occupant(s)
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                        selectedCheckInForView.checkedOutDateTime
                          ? 'bg-gray-100 text-gray-800 border-gray-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {selectedCheckInForView.checkedOutDateTime ? 'Checked Out' : 'Active In-House'}
                      </span>
                    </div>

                    {/* Desk Officer Signature & Audit Metadata (Requested by User) */}
                    <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold uppercase tracking-wider text-[11px] border-b border-amber-200/80 pb-1">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span>Desk Officer Signature & Verification Details</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
                        <div>
                          <span className="text-[10px] text-amber-800 uppercase block font-semibold">Checked-In By:</span>
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                            {selectedCheckInForView.checkedInBy || loggedInUser || 'Desk Officer'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-800 uppercase block font-semibold">Checked-In Date:</span>
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                            {selectedCheckInForView.checkInDate}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-800 uppercase block font-semibold">Registration Logged Time:</span>
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                            {selectedCheckInForView.registrationLoggedTime || selectedCheckInForView.checkInTime || '12:00 PM'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Staying Logistics & Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block border-b pb-1">Stay Schedule</span>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">Check-In:</span><span className="font-bold">{selectedCheckInForView.checkInDate}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">Check-Out:</span><span className="font-bold">{selectedCheckInForView.checkOutDate}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">Duration:</span><span className="font-bold">{calcStayDays(selectedCheckInForView.checkInDate, selectedCheckInForView.checkOutDate)} Night(s)</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">Base Tariff:</span><span className="font-bold font-mono">₹{(selectedCheckInForView.roomRate || 0).toLocaleString()}/Nt</span></div>
                      </div>

                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block border-b pb-1">Contact & ID Proof</span>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">Mobile:</span><span className="font-bold">{selectedCheckInForView.mobile}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">Email:</span><span className="font-bold truncate max-w-[150px]">{selectedCheckInForView.email || 'N/A'}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">{selectedCheckInForView.idType || 'ID'}:</span><span className="font-bold font-mono">{selectedCheckInForView.idNumber || selectedCheckInForView.aadhaarNumber || 'Verified'}</span></div>
                        <div className="flex justify-between py-0.5"><span className="text-slate-500">Address:</span><span className="font-bold truncate max-w-[150px]">{selectedCheckInForView.address || 'N/A'}</span></div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="p-3.5 bg-luxury-brown-950 text-white rounded-xl space-y-2 font-mono">
                      <div className="flex justify-between items-center border-b border-white/20 pb-1.5">
                        <span className="text-luxury-gold-200 font-bold uppercase text-[10px]">Payment & Ledger Overview</span>
                        <span className="text-[10px] text-white/70">ID: {selectedCheckInForView.id}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div>
                          <span className="text-white/60 text-[9px] uppercase block">Total Charges</span>
                          <span className="font-bold text-xs">₹{(((selectedCheckInForView as any).finalAmount || selectedCheckInForView.totalAmount || 0)).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-emerald-400 text-[9px] uppercase block">Advance / Paid</span>
                          <span className="font-bold text-xs text-emerald-300">₹{(selectedCheckInForView.advanceAmount || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-rose-400 text-[9px] uppercase block">Balance Due</span>
                          <span className="font-bold text-xs text-rose-300">₹{(selectedCheckInForView.pendingAmount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedCheckInForView;
                        setSelectedCheckInForView(null);
                        handlePrintOfficialGrc(target);
                      }}
                      className="px-3.5 py-1.5 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-luxury-gold-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print GRC
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCheckInForView(null)}
                      className="px-3.5 py-1.5 border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* TAB 3: BUREAU OF IMMIGRATION C-FORM REGISTER */}
        {activeSubTab === 'cform' && (
          <div className="bg-white border border-luxury-brown-100 rounded-b-xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-blue-200 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-blue-950 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-700" /> Government Bureau of Immigration (BoI) C-Form Register
                </h3>
                <p className="text-xs text-blue-800">Mandatory Form-C compliance records for foreign nationals, passport tracking, visa details, and export for Indian BoI portal.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-blue-50/70 px-2.5 py-1.5 rounded-lg border border-blue-200 text-xs font-mono">
                  <span className="text-[10px] font-bold text-blue-900">From:</span>
                  <input
                    type="date"
                    value={cformFromDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCformFromDate(v);
                      if (cformToDate < v) setCformToDate(v);
                    }}
                    className="px-1.5 py-0.5 border rounded bg-white text-xs"
                  />
                  <span className="text-[10px] font-bold text-blue-900">To:</span>
                  <input
                    type="date"
                    value={cformToDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (cformFromDate > v) setCformFromDate(v);
                      setCformToDate(v);
                    }}
                    className="px-1.5 py-0.5 border rounded bg-white text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const foreignCheckins = checkins.filter(c => {
                      const isForeign = c.cFormData || (c.nationality && c.nationality.toLowerCase() !== 'indian');
                      if (!isForeign) return false;
                      const inDate = (c.checkInDate || '').substring(0, 10);
                      const outDate = (c.checkOutDate || inDate).substring(0, 10);
                      return (inDate <= cformToDate && outDate >= cformFromDate) || (inDate >= cformFromDate && inDate <= cformToDate);
                    });
                    if (foreignCheckins.length === 0) {
                      showToast(`No foreign guest records between ${cformFromDate} and ${cformToDate} to export.`, 'info');
                      return;
                    }
                    const headers = "Guest Name,Room No,Nationality,Passport No,Passport Expiry,Visa No,Visa Type,Visa Expiry,Port of Arrival,Next Destination,Check In Date,Check Out Date,Form C Status\n";
                    const rows = foreignCheckins.map(c => {
                      const f: Partial<CFormData> = c.cFormData || {};
                      return `"${c.guestName}","${c.roomNumber}","${c.nationality}","${f.passportNumber || c.idNumber || ''}","${f.passportExpiryDate || ''}","${f.visaNumber || ''}","${f.visaType || ''}","${f.visaExpiryDate || ''}","${f.portOfArrivalInIndia || ''}","${f.nextDestination || ''}","${c.checkInDate}","${c.checkOutDate}","Submitted"`;
                    }).join("\n");
                    const blob = new Blob([headers + rows], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `C-Form_Register_BoI_${cformFromDate}_to_${cformToDate}.csv`;
                    a.click();
                  }}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Export BoI C-Form CSV ({cformFromDate} to {cformToDate})
                </button>
              </div>
            </div>

            {/* Foreign Guest C-Form List (Filtered Date-to-Date) */}
            {checkins.filter(c => {
              const isForeign = c.cFormData || (c.nationality && c.nationality.toLowerCase() !== 'indian');
              if (!isForeign) return false;
              const inDate = (c.checkInDate || '').substring(0, 10);
              const outDate = (c.checkOutDate || inDate).substring(0, 10);
              return (inDate <= cformToDate && outDate >= cformFromDate) || (inDate >= cformFromDate && inDate <= cformToDate);
            }).length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 bg-blue-50/20 rounded-xl border border-dashed border-blue-200 space-y-2">
                <Globe className="w-8 h-8 text-blue-400 mx-auto" />
                <p className="font-bold text-blue-900">No Foreign Guest Registrations Recorded ({cformFromDate} to {cformToDate})</p>
                <p className="text-xs text-gray-500">When foreign guests check in with a non-Indian nationality within the selected date range, their mandatory Form-C data will automatically be populated here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-blue-200 rounded-xl bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-blue-950 text-blue-100 font-mono uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Foreign Guest</th>
                      <th className="p-3">Room & Dates</th>
                      <th className="p-3">Passport Details</th>
                      <th className="p-3">Visa Details</th>
                      <th className="p-3">Port & Next Destination</th>
                      <th className="p-3 text-center">BoI Status</th>
                      <th className="p-3 text-center">Form-C Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100">
                    {checkins
                      .filter(c => {
                        const isForeign = c.cFormData || (c.nationality && c.nationality.toLowerCase() !== 'indian');
                        if (!isForeign) return false;
                        const inDate = (c.checkInDate || '').substring(0, 10);
                        const outDate = (c.checkOutDate || inDate).substring(0, 10);
                        return (inDate <= cformToDate && outDate >= cformFromDate) || (inDate >= cformFromDate && inDate <= cformToDate);
                      })
                      .map((c) => {
                        const f: Partial<CFormData> = c.cFormData || {};
                        return (
                          <tr key={c.id} className="hover:bg-blue-50/30">
                            <td className="p-3">
                              <span className="font-bold text-blue-950 block">{c.guestName}</span>
                              <span className="text-[10px] font-mono font-bold text-blue-800 uppercase">{c.nationality}</span>
                            </td>
                            <td className="p-3 font-mono">
                              <span className="font-bold block text-gray-900">Room {c.roomNumber}</span>
                              <span className="text-[10px] text-gray-500">{c.checkInDate} to {c.checkOutDate}</span>
                            </td>
                            <td className="p-3 font-mono">
                              <span className="font-bold text-blue-900 block">{f.passportNumber || c.idNumber || c.passportNumber}</span>
                              <span className="text-[10px] text-gray-500">Exp: {f.passportExpiryDate || 'N/A'}</span>
                            </td>
                            <td className="p-3 font-mono">
                              <span className="font-bold text-gray-900 block">{f.visaNumber || 'N/A'} ({f.visaType || 'Tourist'})</span>
                              <span className="text-[10px] text-gray-500">Exp: {f.visaExpiryDate || 'N/A'}</span>
                            </td>
                            <td className="p-3 text-[11px]">
                              <div>Port: <span className="font-semibold">{f.portOfArrivalInIndia || 'India Airport'}</span></div>
                              <div>Next: <span className="font-semibold">{f.nextDestination || 'In Transit'}</span></div>
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-700" /> Compliant
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  showToast(`Official Form-C Compliance Slip generated for Guest: ${c.guestName}\nPassport: ${f.passportNumber || c.idNumber || c.passportNumber}\nVisa: ${f.visaNumber || 'N/A'}\nStatus: Verified for Bureau of Immigration.`, 'success');
                                }}
                                className="px-3 py-1 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-md shadow-xs cursor-pointer"
                              >
                                View Form-C
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
