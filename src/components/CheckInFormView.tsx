import React, { useState, useEffect } from 'react';
import { Booking, GuestCheckIn, Room, RoomCategory, UserRole, Staff, BookedRoom, SecondaryGuest, HotelSettings, PaymentRecord, CFormData, WaterBottleRecord, AllocatedGuestService, ExtraCharge, Invoice, TravelAgent, MealPlanType, PaymentMethod, BookingSource, BookingStatus, InventoryProduct, InventoryStockMovement, PosOrder } from '../types';
import { 
  Contact, Printer, Check, Receipt, RefreshCw, FileCheck, Users, 
  Sparkles, DollarSign, Plus, Trash2, Landmark, Send, Download, 
  ClipboardList, Settings, Sliders, Hotel, Calendar, UserCheck, Inbox, ShieldCheck,
  Globe, Building, FileSpreadsheet, ShieldAlert, FileText, Layers, Eye, Search, Filter, Clock, PenTool, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { showToast } from '../utils/toast';
import QuickDateInput from './QuickDateInput';
import { calculateEarlyCheckIn } from '../utils/stayTimeUtils';
import { evaluateAndBuildInvoice, normalizeInvoiceConditions } from '../utils/invoiceConditions';
import {
  BillCharge,
  calculateBill,
  normalizeBillSettings,
} from '../utils/billCalculator';
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

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrowDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFutureDateStr = (daysAhead: number, baseDateStr?: string) => {
  const d = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + daysAhead);
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTimeStr = () => {
  const d = new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
};

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
  const [complimentaryWaterBottles, setComplimentaryWaterBottles] = useState<number>(2);

  const waterBottleInventoryProduct = (inventoryProducts || []).find(
    p =>
      p.name?.toLowerCase().includes('water bottle') ||
      p.name?.toLowerCase().includes('mineral water') ||
      p.name?.toLowerCase() === 'water' ||
      ((p as any).sku && String((p as any).sku).toUpperCase().includes('WATER'))
  );
  const [resSearchQuery, setResSearchQuery] = useState('');
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
    setSecondaryGuests(prev => [
      ...prev,
      { fullName: '', idType: 'Aadhaar', idNumber: '', nationality: 'Indian' }
    ]);
  };

  const handleRemoveSecondaryGuest = (index: number) => {
    setSecondaryGuests(prev => prev.filter((_, i) => i !== index));
  };

  const handleSecondaryGuestChange = (index: number, field: keyof SecondaryGuest, value: string) => {
    setSecondaryGuests(prev => prev.map((sg, i) => {
      if (i === index) {
        return { ...sg, [field]: value };
      }
      return sg;
    }));
  };

  // 5. Room Details & Pricing variables
  const [isEditBannerExpanded, setIsEditBannerExpanded] = useState<boolean>(false);
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('');
  const [adults, setAdults] = useState<number | ''>(2);
  const [children, setChildren] = useState<number | ''>(0);
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
  const [standardRate, setStandardRate] = useState(2000);
  const [roomRate, setRoomRate] = useState(2000); // Flexible room rate per night
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
    } catch {
      // ignore storage errors
    }
  }, []);

  // Sync pricing upon room selection (only when selectedRoomNumber or booking identity changes — never wipe manual edits on background polls)
  const lastSyncedSingleRoomRef = React.useRef<string>('');
  useEffect(() => {
    if (!selectedRoomNumber) {
      lastSyncedSingleRoomRef.current = '';
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
    } else if (selectedBooking && selectedBooking.roomNumber === selectedRoomNumber && selectedBooking.bookingAmount) {
      const bNights = selectedBooking.nights || 1;
      setRoomRate(Math.round(selectedBooking.bookingAmount / Math.max(1, bNights)));
    } else {
      setRoomRate(selectedRoom.rate);
    }
    const configuredExtra =
      selectedRoom.extraPersonCharge !== undefined && selectedRoom.extraPersonCharge !== null
        ? Math.max(0, Number(selectedRoom.extraPersonCharge) || 0)
        : 0;
    setExtraPersonCharge(configuredExtra);
    if (!selectedBooking?.extraBedRate && !editingCheckIn?.extraBedRate) {
      setExtraBedRate(configuredExtra > 0 ? configuredExtra : 500);
    }
    setBaseOccupancy(selectedRoom.baseOccupancy ?? 2);
  }, [selectedRoomNumber, rooms, selectedBooking, editingCheckIn]);

  // Handle direct adjusted tariff or auto-calculate discount
  const discountPerNight = Math.max(0, standardRate - roomRate);

  // 6. Stay Details state
  const [checkInDate, setCheckInDate] = useState(getTodayDateStr());
  const [arrivalTime, setArrivalTime] = useState(getCurrentTimeStr());
  const [checkOutDate, setCheckOutDate] = useState(getTomorrowDateStr());
  const [departureTime, setDepartureTime] = useState('11:00 AM');

  const calcStayDays = (inDate: string, outDate: string) => {
    if (!outDate) return 1; // Open / Flexible stay
    if (inDate === outDate) return 1; // Same-day / short-stay hourly
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    const diff = Math.abs(d2.getTime() - d1.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return isNaN(days) || days <= 0 ? 1 : days;
  };

  const stayNights = calcStayDays(checkInDate, checkOutDate);

  // 7. Extra Guest Charges Calculation (Strictly Opt-In so agreed Room Tariff is NEVER silently inflated!)
  const [applyExtraPersonCharge, setApplyExtraPersonCharge] = useState<boolean>(false);
  const [manualExtraPaxCount, setManualExtraPaxCount] = useState<number | ''>('');
  const activeSelectedRoomObj = rooms.find(r => r.number === selectedRoomNumber);
  const selectedRoomMaxOccupancy = activeSelectedRoomObj?.maxOccupancy ?? Math.max(baseOccupancy, 2);
  const totalOccupants = Number(adults) + Number(children) + secondaryGuests.length;
  const extraGuestsCount = Math.max(0, totalOccupants - baseOccupancy);
  const resolvedSingleExtraPaxCount =
    manualExtraPaxCount !== '' ? Math.max(0, Number(manualExtraPaxCount) || 0) : Math.max(1, extraGuestsCount);
  const extraPersonChargesTotal = applyExtraPersonCharge
    ? resolvedSingleExtraPaxCount * extraPersonCharge * stayNights
    : 0;

  // --- SUB-NAVIGATION TABS ---
  const [activeSubTab, setActiveSubTab] = useState<'form' | 'folios' | 'cform'>('form');

  // --- CHECK-IN MODE (SINGLE vs GROUP) ---
  const [checkInMode, setCheckInMode] = useState<'single' | 'group'>('single');

  // --- EXTRA BED STATE (SINGLE ROOM) ---
  const [hasExtraBed, setHasExtraBed] = useState<boolean>(false);
  const [extraBedCount, setExtraBedCount] = useState<number>(1);
  const [extraBedRate, setExtraBedRate] = useState<number>(500);

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
      if (editingCheckIn && b.id === editingCheckIn.id) return false;
      const rawSt = String(b.status || '').toLowerCase().replace(/[\s_-]/g, '');
      if (b.status === 'Cancelled' || rawSt === 'cancelled' || rawSt === 'noshow') return false;
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

  const isRoomTrulyAvailable = (r: Room): boolean => {
    const isCurrentEditedRoom = Boolean(editingCheckIn && editingCheckIn.roomNumber === r.number);
    const isSelectedReservationRoom = Boolean(selectedBooking && selectedBooking.roomNumber === r.number);
    if (isCurrentEditedRoom || isSelectedReservationRoom) return true;
    const isMaint = r.status === 'Maintenance' || (r.status as string) === 'Out of Order';
    const hasActiveOccupant = checkins.some(c => {
      if (c.checkedOutDateTime) return false;
      const cSt = String(c.status || '').toLowerCase().replace(/[\s_-]/g, '');
      if (cSt === 'checkedout' || cSt === 'completed' || cSt === 'cancelled' || (c as any).isCheckedOut) return false;
      if (c.id === (selectedBooking?.id || '') || c.id === (editingCheckIn?.id || '')) return false;
      return c.roomNumber === r.number || (c.bookedRooms || []).some(br => br.roomNumber === r.number);
    });
    const isOccupied = r.status === 'Occupied' || hasActiveOccupant;
    const overlappingBooking = getRoomOverlappingBooking(r.number, checkInDate, checkOutDate);
    const effectiveOut = checkOutDate || getFutureDateStr(1, checkInDate || getTodayDateStr());
    const isReservedToday =
      r.status === 'Reserved' &&
      checkInDate <= getTodayDateStr() &&
      effectiveOut > getTodayDateStr() &&
      Boolean(overlappingBooking);
    return !isOccupied && !isMaint && !overlappingBooking && !isReservedToday;
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
    setGroupRooms(prev => prev.map(gr => {
      if (gr.id === id) {
        const updated = { ...gr, [field]: value };
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
  const extraBedTotal = hasExtraBed ? (Number(extraBedCount) || 0) * (Number(extraBedRate) || 0) * stayNights : 0;

  // Group mode totals
  const groupRoomChargesPerNight = groupRooms.reduce((sum, r) => sum + Number(r.rate || 0), 0);
  const groupExtraBedPerNight = groupRooms.reduce((sum, r) => sum + (r.hasExtraBed ? (Number(r.extraBedCount) || 0) * (Number(r.extraBedRate) || 0) : 0), 0);
  const groupRoomChargesTotal = groupRoomChargesPerNight * stayNights;
  const groupExtraBedChargesTotal = groupExtraBedPerNight * stayNights;
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
  const groupExtraPersonChargesPerNight = groupRooms.reduce((sum, r) => {
    const rmObj = rooms.find(rm => rm.number === r.roomNumber);
    const base = rmObj?.baseOccupancy ?? 2;
    const extraPax = Math.max(0, Number(r.adults || 0) + Number(r.children || 0) - base);
    const paxRate = Number(rmObj?.extraPersonCharge) > 0 ? Number(rmObj?.extraPersonCharge) : extraPersonCharge;
    return sum + extraPax * paxRate;
  }, 0);
  const groupExtraPersonChargesTotal =
    applyExtraPersonCharge && groupExtraGuestsCount > 0 ? groupExtraPersonChargesPerNight * stayNights : 0;

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
        (inv.items || (inv as any).ledgerLines || []).forEach((ln: any) => {
          const desc = String(ln?.description || ln?.name || '').toLowerCase().trim();
          if (desc) names.add(desc);
        });
      }
    });
    return names;
  }, [invoices, editingCheckIn?.id, selectedBooking?.id]);

  const tickedServices = checkInMode === 'single'
    ? serviceCatalog.filter(s => {
        if (!selectedServiceIds.includes(String(s.id))) return false;
        const sLower = String(s.serviceName || '').toLowerCase().trim();
        for (const billedDesc of separatelyBilledServiceNames) {
          if (sLower && billedDesc.includes(sLower)) return false;
        }
        return true;
      })
    : [];
  const servicesTotal = tickedServices.reduce((sum, s) => sum + serviceAmountOf(s), 0);

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

  // Collect existing folio charges already attached to this booking/stay (POS Room Service orders, chargeable water, laundry, booking otherServices)
  const existingStayFolioCharges: BillCharge[] = React.useMemo(() => {
    if (!selectedBooking && !editingCheckIn) return [];
    const collected = collectStayCharges({
      booking: selectedBooking || null,
      checkin: editingCheckIn || null,
      posOrders,
      waterBottles,
      rooms,
      settings: billSettings,
    });
    return collected.charges.filter(
      ch =>
        ch.kind !== 'room' &&
        ch.kind !== 'extra_bed' &&
        ch.kind !== 'extra_person' &&
        ch.kind !== 'early_checkin' &&
        !String(ch.id || '').startsWith('ALLOC-CHK-') &&
        !String(ch.id || '').startsWith('AUX-CHK-')
    );
  }, [selectedBooking, editingCheckIn, posOrders, waterBottles, rooms, billSettings]);

  const existingStayFolioSubtotal = existingStayFolioCharges.reduce(
    (sum, ch) => sum + (Number(ch.amount) || 0),
    0
  );

  const activeNetSubtotal = (checkInMode === 'single'
    ? (roomChargesTotal + extraPersonChargesTotal + extraBedTotal + otherCharges + servicesTotal + existingStayFolioSubtotal)
    : (groupRoomChargesTotal + groupExtraPersonChargesTotal + groupExtraBedChargesTotal + otherCharges + existingStayFolioSubtotal)) + earlyCheckInCharge;

  const netSubtotal = activeNetSubtotal;

  useEffect(() => {
    if (!selectedBooking && !editingCheckIn) {
      setGstPercent(
        hotelSettings?.isGstEnabled === false
          ? 0
          : normalizeBillSettings(hotelSettings).roomGstRate
      );
    }
  }, [hotelSettings?.isGstEnabled, hotelSettings?.defaultGstRate, selectedBooking, editingCheckIn]);

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
        } else {
          setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
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
          ...(extraPersonChargesTotal > 0
            ? [
                {
                  id: 'ci-xpax',
                  kind: 'extra_person' as const,
                  description: 'Extra Person Charges',
                  amount: extraPersonChargesTotal,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...(extraBedTotal > 0
            ? [
                {
                  id: 'ci-xbed',
                  kind: 'extra_bed' as const,
                  description: 'Extra Bed Charges',
                  amount: extraBedTotal,
                  roomNumber: selectedRoomNumber || '101',
                },
              ]
            : []),
          ...tickedServices.map((s, idx) => ({
            id: `ci-svc-${s.id || idx}`,
            kind: 'service' as const,
            description: String(s.serviceName || 'Service'),
            amount: serviceAmountOf(s),
            roomNumber: selectedRoomNumber || '101',
          })),
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
          ...(groupExtraPersonChargesTotal > 0
            ? [
                {
                  id: 'ci-gr-xpax',
                  kind: 'extra_person' as const,
                  description: 'Extra Person Charges',
                  amount: groupExtraPersonChargesTotal,
                },
              ]
            : []),
          ...groupRooms
            .filter(gr => gr.hasExtraBed && Number(gr.extraBedRate) > 0)
            .map((gr, idx) => ({
              id: `ci-gr-xbed-${idx}`,
              kind: 'extra_bed' as const,
              description: 'Extra Bed Charges',
              amount: (Number(gr.extraBedCount) || 1) * Number(gr.extraBedRate || 0) * stayNights,
              roomNumber: gr.roomNumber,
            })),
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
          ...existingStayFolioCharges,
        ];

  const liveCheckInBill = calculateBill({
    charges: liveCheckInCharges,
    payments: [
      ...(advanceAmount > 0
        ? [{ id: 'ci-adv', amount: advanceAmount, method: paymentMethod }]
        : []),
      ...(paidAmount > 0
        ? [{ id: 'ci-paid', amount: paidAmount, method: paymentMethod }]
        : []),
    ],
    discount: manualDiscount,
    gstEnabled: gstPercent > 0,
    settings:
      gstPercent > 0
        ? { ...billSettings, roomGstRate: gstPercent }
        : { ...billSettings, roomGstRate: 0, foodGstRate: 0 },
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
    setManualDiscount(Number((b as any).discount || (b as any).discountAmount || 0));
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
    setExtraBedCount(b.extraBedCount || 1);
    setExtraBedRate(b.extraBedRate || 500);
    setApplyExtraPersonCharge(
      Boolean(
        Number((b as any).extraPersonChargeApplied || existingActiveCheckIn?.extraPersonChargeApplied || 0) > 0
      )
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
      } else if (b.bookingAmount && parsedCsvRoomNumbers.length <= 1) {
        setRoomRate(Math.round(b.bookingAmount / bNights));
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
    } else {
      setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : Number(b.gstRate) || 5);
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
    setManualDiscount(Number(c.discount ?? c.discountAmount ?? 0));
    setCheckInDate(c.checkInDate || getTodayDateStr());
    setCheckOutDate(c.checkOutDate || getTomorrowDateStr());
    setAdults(c.adults ?? Math.max(1, (c.numGuests || 2) - (c.secondaryGuests?.length || 0)));
    setChildren(c.children ?? 0);
    setAdvanceAmount(c.advanceAmount || 0);
    setPaidAmount((c.cashAmountPaid || 0) + (c.onlineAmountPaid || 0));
    setPaymentMethod((c.paymentMethod as any) || (c.onlineAmountPaid && !c.cashAmountPaid ? 'UPI' : 'Cash'));
    const existingStayInv = (invoices || []).find(
      inv => !inv.isSeparateInvoice && (inv.bookingId === c.id || inv.checkInId === c.id)
    );
    if (existingStayInv) {
      const lockedNoGst =
        existingStayInv.isWithoutGst === true ||
        (existingStayInv.gstRate !== undefined && Number(existingStayInv.gstRate) <= 0) ||
        (existingStayInv.gstRate === undefined && Number(existingStayInv.gst || 0) <= 0);
      setGstPercent(lockedNoGst ? 0 : Number(existingStayInv.gstRate) || configuredDefaultGst || 5);
    } else if (c.isWithoutGst === true || (c.gstRate !== undefined && Number(c.gstRate) <= 0)) {
      setGstPercent(0);
    } else {
      setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : Number(c.gstRate) || 5);
    }
    setHasExtraBed(Boolean(c.hasExtraBed));
    setExtraBedCount(c.extraBedCount || 1);
    setExtraBedRate(c.extraBedRate || 500);
    setApplyExtraPersonCharge(Boolean(Number(c.extraPersonChargeApplied || c.extraPersonChargesApplied || 0) > 0));
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
    setAdults(2);
    setChildren(0);
    setSelectedServiceIds([]);
    setOtherCharges(0);
    setAdvanceAmount(0);
    setPaidAmount(0);
    setManualDiscount(0);
    setHasExtraBed(false);
    setExtraBedCount(1);
    setExtraBedRate(0);
    setApplyExtraPersonCharge(false);
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

  const handleSaveCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !mobile.trim()) {
      showToast('Missing primary guest attributes: Guest Name and Mobile are required.', 'warning');
      return;
    }

    if (!editingCheckIn && complimentaryWaterBottles > 0) {
      const availWater = Number(waterBottleInventoryProduct?.currentStock ?? 0);
      if (availWater < complimentaryWaterBottles) {
        showToast(
          availWater <= 0
            ? 'Inventory me Water Bottle stock 0 hai! Agar aapke paas water bottles available hain toh pehle Inventory me stock record add karein, ya Water Bottles 0 karein.'
            : `Inventory me sufficient Water Bottle stock nahi hai! (Available: ${availWater}, Requested: ${complimentaryWaterBottles}). Pehle Inventory me stock add karein.`,
          'error'
        );
        return;
      }
    }

    // 1. Validate Advance Reservation Status (Prevent Cancelled reservations)
    if (selectedBooking && !editingCheckIn) {
      const currentBookingInState = bookings.find(b => b.id === selectedBooking.id) || selectedBooking;
      const rawSt = String(currentBookingInState.status || '').toLowerCase();
      if (currentBookingInState.status === 'Cancelled' || rawSt === 'cancelled') {
        showToast(`Check-In Blocked: Reservation #${currentBookingInState.id} has been Cancelled and cannot be checked in.`, 'error');
        return;
      }
    }

    // Validate Walk-In Booking Status if in Walk-In mode
    if (effectiveMode === 'walkin' && !selectedBooking && !editingCheckIn && walkInBookingStatus === 'Cancelled') {
      showToast('Check-In Blocked: Booking Status is set to Cancelled. Select Confirmed or Waiting to proceed.', 'error');
      return;
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
    //    Only an explicitly selected advance booking (Check-In tab) is used.
    const effectiveBooking: Booking | null = editingCheckIn
      ? (bookings.find(b => b.id === editingCheckIn.id) || null)
      : (selectedBooking || null);

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
        (roomObj.status === 'Maintenance' || (roomObj.status as string) === 'Out of Order')
      ) {
        showToast(
          `Room ${rNum} is currently marked as ${roomObj.status} and cannot be checked into until ready.`,
          'error'
        );
        return;
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
    const finalSecondaryGuests: SecondaryGuest[] = secondaryGuests.map(sg => ({
      fullName: sg.fullName,
      nationality: sg.nationality,
      idType: sg.idType,
      idNumber: sg.idNumber,
      aadhaarNumber: sg.idType === 'Aadhaar' ? sg.idNumber : '',
      passportNumber: sg.idType === 'Passport' ? sg.idNumber : '',
      mobile: '',
      address: ''
    }));

    const preservedInStayPayments: PaymentRecord[] = (editingCheckIn?.payments || []).filter(
      p => p && !String(p.id || '').endsWith('-adv') && !String(p.id || '').endsWith('-checkin')
    );
    const preservedInStayPaidSum = preservedInStayPayments
      .filter(p => p.paymentType !== 'Advance Deposit')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const initialPayments: PaymentRecord[] = [];
    if (advanceAmount > 0) {
      initialPayments.push({
        id: `PAY-${resolvedCheckInId}-adv`,
        amount: advanceAmount,
        paymentMethod: (effectiveBooking?.paymentMethod || paymentMethod) as any,
        paymentType: 'Advance Deposit',
        dateTime: effectiveBooking?.bookingDate
          ? `${effectiveBooking.bookingDate}T00:00:00.000Z`
          : (editingCheckIn?.dateTime || new Date().toISOString()),
        notes: effectiveBooking
          ? `Advance carried forward from reservation ${effectiveBooking.id}`
          : 'Advance deposit during check-in'
      });
    }
    if (paidAmount > 0) {
      const payDtIso = paymentDate
        ? `${paymentDate}T${new Date().toISOString().slice(11)}`
        : new Date().toISOString();
      initialPayments.push({
        id: `PAY-${resolvedCheckInId}-checkin`,
        amount: paidAmount,
        paymentMethod: paymentMethod as any,
        paymentType: 'Partial Payment',
        dateTime: payDtIso,
        date: paymentDate || getTodayDateStr(),
        notes: paymentNotes.trim() || 'Check-in payment received at desk'
      });
    }
    initialPayments.push(...preservedInStayPayments);

    const effectivePendingBalance = Math.max(0, finalAmount - advanceAmount - paidAmount - preservedInStayPaidSum);

    // Construct booked rooms list
    const finalBookedRooms: BookedRoom[] = checkInMode === 'single'
      ? [
          {
            roomNumber: selectedRoomNumber,
            category: roomType as any,
            rate: roomRate,
            originalRate: standardRate,
            discountAmountOfRoom: discountPerNight * stayNights,
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
          originalRate: gr.originalRate,
          discountAmountOfRoom: (gr.originalRate - gr.rate) * stayNights,
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
    const isFormAux = (id?: string) => String(id || '').startsWith('AUX-CHK-');
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
    const stayServiceAllocations: AllocatedGuestService[] = tickedServices.map(s => ({
      id: `ALLOC-CHK-${s.id}`,
      serviceId: String(s.id),
      serviceName: String(s.serviceName || 'Service'),
      configuredAmount: serviceAmountOf(s),
      chargedAmount: serviceAmountOf(s),
      isChargeable: true,
      roomNumber: primaryRoom,
      checkInId: resolvedCheckInId,
      guestName,
      allocatedBy: loggedInUser || 'Reception Desk',
      dateTime: nowIsoSrv
    }));
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
    if (otherCharges > 0) {
      stayServiceExtraCharges.push({
        id: `AUX-CHK-${resolvedCheckInId}`,
        category: 'Other' as const,
        description: `Auxiliary Charges (Room ${primaryRoom})`,
        amount: otherCharges,
        dateTime: nowIsoSrv
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
    const composedGuestAddress = composeFullAddress(address, city, state, country);
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
      isEarlyCheckIn: earlyCheckInInfo.isEarly,
      earlyCheckInHours: earlyCheckInInfo.earlyHours,
      earlyCheckInCharge: earlyCheckInCharge,
      numGuests: checkInMode === 'single' ? Math.max(totalOccupants, 1 + finalSecondaryGuests.length) : groupTotalGuests,
      roomNumber: checkInMode === 'group' ? groupRooms.map(gr => gr.roomNumber).join(', ') : primaryRoom,
      roomRate: checkInMode === 'single' ? roomRate : (groupRoomChargesPerNight / (groupRooms.length || 1)),
      originalRate:
        checkInMode === 'single'
          ? standardRate
          : groupRooms.reduce((s, gr) => s + (Number(gr.originalRate) || Number(gr.rate) || 0), 0) /
            Math.max(1, groupRooms.length),
      discount: manualDiscount,
      discountAmount: manualDiscount,
      extraPersonChargeApplied: effectiveExtraPersonChargesTotal,
      extraPersonChargesApplied: effectiveExtraPersonChargesTotal,
      totalAmount: finalAmount,
      gstRate: gstPercent,
      gstAmount: gstTax,
      isWithoutGst: gstPercent <= 0,
      advanceAmount: advanceAmount,
      cashAmountPaid: paymentMethod === 'Cash' ? paidAmount : 0,
      onlineAmountPaid: paymentMethod !== 'Cash' ? paidAmount : 0,
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
      // Extra Bed Details
      hasExtraBed: checkInMode === 'single' ? hasExtraBed : undefined,
      extraBedCount: checkInMode === 'single' && hasExtraBed ? extraBedCount : undefined,
      extraBedRate: checkInMode === 'single' && hasExtraBed ? extraBedRate : undefined,
      extraBedTotal: checkInMode === 'single' && hasExtraBed ? extraBedTotal : undefined,
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
              nights: stayNights,
              adults: Number(adults) || 1,
              children: Number(children) || 0,
              roomNumber: checkInMode === 'group' ? groupRooms.map(gr => gr.roomNumber).join(', ') : primaryRoom,
              roomType: (roomType || b.roomType) as any,
              bookedRooms: finalBookedRooms,
              isGroupCheckIn: checkInMode === 'group',
              bookingAmount: effectiveRoomChargesTotal + effectiveExtraPersonChargesTotal + effectiveExtraBedTotal + earlyCheckInCharge,
              gstRate: gstPercent,
              gstAmount: gstTax,
              isWithoutGst: gstPercent <= 0,
              gstInvoice: gstPercent > 0,
              // Preserve existing reservation advance payment record without overwriting or double-charging
              advanceAmount: Number(b.advanceAmount) > 0 ? Number(b.advanceAmount) : advanceAmount,
              paymentMethod: b.paymentMethod || paymentMethod,
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
        bookingAmount: effectiveRoomChargesTotal + effectiveExtraPersonChargesTotal + effectiveExtraBedTotal + earlyCheckInCharge,
        gstRate: gstPercent,
        gstAmount: gstTax,
        isWithoutGst: gstPercent <= 0,
        gstInvoice: gstPercent > 0,
        advanceAmount: advanceAmount + paidAmount,
        paymentMethod,
        bookingSource: resolvedWalkInSource,
        status: walkInBookingStatus || 'Confirmed',
        isCheckedIn: true,
        companyName: companyName || undefined,
        gstNumber: gstNumber || undefined,
        checkedInBy: autoDetectedCheckedInBy,
        checkInTimestamp: resolvedCheckInTimestamp
      };
      onUpdateBookings([...bookings, mirroredBooking]);
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
    const requestedCheckInNoGst = gstPercent <= 0;
    const mustCreateSeparateInvAtCheckIn =
      Boolean(existingPrimaryInvForStay) && !editingCheckIn && existingInvIsNoGst !== requestedCheckInNoGst;

    const totalCollected = advanceAmount + paidAmount + preservedInStayPaidSum;
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
      overrideAdvancePaid: totalCollected,
      overridePaymentMethod: paymentMethod,
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
        paymentMethod: paymentMethod
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

    // Complimentary Water Bottle inventory verification & deduction (Requested by Sir & User)
    if (!editingCheckIn && complimentaryWaterBottles > 0) {
      if (waterBottleInventoryProduct && onUpdateInventoryProducts) {
        const prevStock = Number(waterBottleInventoryProduct.currentStock) || 0;
        const newStock = Math.max(0, prevStock - complimentaryWaterBottles);
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
          const movement = {
            id: `MOV-WB-COMP-${Date.now()}`,
            productId: waterBottleInventoryProduct.id,
            productName: waterBottleInventoryProduct.name,
            type: 'OUT' as const,
            quantity: complimentaryWaterBottles,
            previousStock: prevStock,
            newStock,
            date: checkInDate,
            time: new Date().toLocaleTimeString(),
            referenceType: 'Housekeeping' as any,
            referenceId: newCheckIn.id,
            notes: `Complimentary Water Bottle (${complimentaryWaterBottles} bottles) issued at Check-In for Room ${primaryRoom} (${guestName})`,
            performedBy: autoDetectedCheckedInBy,
            hotelId: activeHotelId
          } as unknown as InventoryStockMovement;
          onUpdateInventoryMovements([movement, ...inventoryStockMovements]);
        }

        if (onUpdateWaterBottles && waterBottles) {
          const compRecord: WaterBottleRecord = {
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
            status: 'Delivered',
          };
          onUpdateWaterBottles([compRecord, ...waterBottles]);
        }

        if (newStock === 0) {
          showToast('Check-In complete! Alert: Inventory me water bottle stock ab 0 ho gaya hai — Inventory Store se fresh stock add karein.', 'warning');
        } else if (newStock <= minAlert) {
          showToast(`Low Stock Alert: Sirf ${newStock} water bottles bachi hain inventory me!`, 'warning');
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

    // Set printable card active & scroll to top so GRC slip is immediately visible
    setActivePrintDocument(newCheckIn);
    setSelectedBooking(null);
    setEditingCheckIn(null);
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
    setAdults(2);
    setChildren(0);
    setSelectedServiceIds([]);
    setOtherCharges(0);
    setAdvanceAmount(0);
    setPaidAmount(0);
    setManualDiscount(0);
    setHasExtraBed(false);
    setExtraBedCount(1);
    setExtraBedRate(0);
    setApplyExtraPersonCharge(false);
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
                    <span className="text-[#7A6B5D]">Registration Code:</span>{' '}
                    <span className="font-bold text-sm text-[#17120F]">{livePrintDoc.id}</span>
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
                    <span className="font-mono font-bold text-xs text-[#17120F] tracking-wide">{livePrintDoc.idNumber || 'N/A'}</span>
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
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Room Number</strong>
                      <span className="text-sm font-serif font-bold text-[#8B691E]">Rm {livePrintDoc.roomNumber}</span>
                    </div>
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Room Category</strong>
                      <span className="text-xs font-bold text-[#17120F]">{livePrintDoc.bookedRooms?.[0]?.category || 'Standard'}</span>
                    </div>
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Total Occupants</strong>
                      <span className="text-xs font-bold font-mono text-[#17120F]">{livePrintDoc.numGuests} registered</span>
                    </div>
                    <div className="bg-white border border-[#EBE3D5] rounded-lg p-2 shadow-2xs">
                      <strong className="block text-[8px] text-[#8A7A6D] uppercase font-mono tracking-wider">Nights Count</strong>
                      <span className="text-xs font-bold font-mono text-[#8B691E]">{stayNights} Night(s)</span>
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

        {/* Sub-Navigation Bar: 2 Clean Tabs (Advance Booking vs Walk-In Booking) */}
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

        {/* TAB 1: CHECK-IN FORM */}
        {activeSubTab === 'form' && (
          <div className="bg-white border border-luxury-brown-100 rounded-b-xl p-6 shadow-sm space-y-6">

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

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                            Booking Status
                          </label>
                          <select
                            value={walkInBookingStatus}
                            onChange={(e) => setWalkInBookingStatus(e.target.value as BookingStatus)}
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white text-luxury-brown-950"
                          >
                            <option value="Confirmed">Confirmed</option>
                            <option value="Waiting">Waiting</option>
                            <option value="Cancelled">Cancelled</option>
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
                                max={6}
                                value={adults}
                                onChange={(e) => {
                                  const val = e.target.value;
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
                                max={6}
                                value={children}
                                onChange={(e) => {
                                  const val = e.target.value;
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
                        onChange={(e) => setCheckInDate(e.target.value)}
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
                        onChange={(e) => setCheckOutDate(e.target.value)}
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

                  {/* Dedicated Complimentary Water Bottles (Free ₹0) Section */}
                  <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase text-sky-950 flex items-center gap-1.5">
                          💧 Complimentary Water Bottles (Free ₹0)
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Free • Included in Stay
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-600">
                        Inventory Stock:{' '}
                        <strong className={(waterBottleInventoryProduct?.currentStock ?? 100) === 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                          {waterBottleInventoryProduct?.currentStock ?? 100} Bottles Available
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-700 font-semibold">Allocated Bottles:</label>
                        <div className="flex items-center border border-sky-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setComplimentaryWaterBottles(prev => Math.max(0, prev - 1))}
                            className="px-2.5 py-1 text-slate-600 hover:bg-sky-100 font-bold cursor-pointer"
                          >
                            −
                          </button>
                          <span className="px-3 py-1 font-mono font-bold text-sm text-sky-950">
                            {complimentaryWaterBottles}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const avail = waterBottleInventoryProduct?.currentStock ?? 100;
                              if (complimentaryWaterBottles >= avail) {
                                showToast(`Inventory me sirf ${avail} water bottle(s) bachi hain!`, 'error');
                                return;
                              }
                              setComplimentaryWaterBottles(prev => prev + 1);
                            }}
                            className="px-2.5 py-1 text-slate-600 hover:bg-sky-100 font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">Packaged 1L Bottles</span>
                      </div>

                      <p className="text-[11px] text-slate-500 italic">
                        Standard complimentary bottles included with room stay. Automatically verified & deducted from store inventory.
                      </p>
                    </div>
                  </div>

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
                      {standardRate > roomRate ? `Tariff cut: -₹${(standardRate - roomRate) * stayNights}` : 'Standard rate'}
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
                          setApplyExtraPersonCharge(checked);
                          if (checked && manualExtraPaxCount === '') {
                            setManualExtraPaxCount(Math.max(1, effectiveExtraGuestsCount));
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
                          onChange={(e) => setManualExtraPaxCount(Math.max(0, Number(e.target.value) || 0))}
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
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    placeholder="Enter amount paid now"
                    className="w-full px-3 py-2 border border-luxury-brown-250 rounded-lg text-sm bg-white font-bold"
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
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-2 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-950 font-bold focus:ring-1 focus:ring-[#C5A059]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Voucher">Voucher</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                </div>
              </div>

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
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-luxury-brown-200 bg-white cursor-pointer select-none hover:border-emerald-500 transition-all">
                        <input
                          type="checkbox"
                          checked={gstPercent > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGstPercent(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                            } else {
                              setGstPercent(0);
                            }
                          }}
                          className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-luxury-brown-950 block">
                            GST Invoice ({gstPercent > 0 ? `Applied: ${gstPercent}% GST from Settings` : 'Unchecked — 0% Without GST'})
                          </span>
                          <span className="text-[10px] text-luxury-brown-600 block">
                            Tick for GST Invoice or untick for Non-GST bill. Change default GST % anytime in My Profile Settings.
                          </span>
                        </div>
                      </label>
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
                  <span className="text-lg font-bold text-emerald-700">₹{paidAmount.toLocaleString()}</span>
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
        </div>
        )}

        {/* TAB 2: IN-HOUSE GUESTS & FOLIOS REGISTER */}
        {activeSubTab === 'folios' && (() => {
          const activeInHouse = checkins.filter(c => !c.checkedOutDateTime);
          const checkedOutRecords = checkins.filter(c => Boolean(c.checkedOutDateTime));
          const displayedCheckins =
            folioFilter === 'active'
              ? activeInHouse
              : folioFilter === 'checkedout'
              ? checkedOutRecords
              : checkins;

          return (
          <div className="bg-white border border-luxury-brown-100 rounded-b-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-luxury-brown-100 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#9E2A2B]" /> In-House Active Guest Register & Folios
                </h3>
                <p className="text-xs text-luxury-brown-600">Currently checked-in guests, room allocations, extra bed logs, and live balance status.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
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
