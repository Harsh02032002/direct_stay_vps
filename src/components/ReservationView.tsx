import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Booking, Room, RoomCategory, BookingSource, PaymentMethod, BookingStatus, UserRole, Invoice, WaterBottleRecord, BookedServiceSelection, DeletedItemRecord, TravelAgent, MealPlanType, BookedRoom, GuestCheckIn, PosOrder } from '../types';
import {
  Search,
  Plus,
  Trash2,
  CalendarCheck,
  FileText,
  CheckCircle2,
  Send,
  Check,
  Printer,
  Receipt,
  Download,
  X,
  Mail,
  Clock,
  Sparkles,
  AlertTriangle,
  Edit,
  Building2,
  Users,
  Globe,
  MoreVertical,
  LayoutList,
  Table2,
  LayoutGrid,
  BedDouble,
  ArrowRight,
  Moon,
  Phone,
  LogIn,
  LogOut,
  ArrowLeftRight,
  CreditCard,
  Ban,
  UserX,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  ShieldAlert,
  FileSpreadsheet,
  UserCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { openWhatsAppChat } from '../pms-integrated/utils/formatters';
import { getCurrentTimeStr, calculateEarlyCheckIn } from '../utils/stayTimeUtils';
import { showToast } from '../utils/toast';
import { triggerBookingEmail, isValidEmailAddress, BookingEmailEventType } from '../utils/bookingEmailService';
import {
  BillCharge,
  BillSettings,
  calculateBill,
  normalizeBillSettings,
  r2,
} from '../utils/billCalculator';
import {
  allocateInvoiceNumber,
  buildInvoiceRecord,
  buildStayBill,
  toGrcPrintData,
} from '../utils/stayBilling';
import { renderGrcHtml } from '../utils/printTemplates';
import { downloadHotelInvoicePdf, invoiceRecordToPrintHtml } from '../utils/pdfDownload';
import { openPrintWindow } from '../utils/printDocument';
import {
  buildReservationsCsv,
  CanonicalReservationStatus,
  canPerformReservationAction,
  computeReservationFinancials,
  computeStayDurationInfo,
  EnrichedReservationItem,
  findLinkedCheckinForBooking,
  formatDisplayTime12h,
  formatShortHumanDate,
  getReservationRoomNumbers,
  getReservationRoomSummary,
  getStatusPillClasses,
  mergeBookingsAndStandaloneWalkIns,
  OTA_BOOKING_SOURCES,
  ReservationSegment,
  resolveCanonicalStatus,
  resolveReservationSegments,
  validateRoomAllocationForDates,
} from '../utils/reservationHelpers';

interface ReservationViewProps {
  bookings: Booking[];
  rooms: Room[];
  checkins?: GuestCheckIn[];
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  posOrders?: PosOrder[];
  loggedInUser?: string;
  currentRole: UserRole;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onCheckIn?: (booking: Booking) => void;
  onCheckOut?: (booking: Booking) => void;
  onOpenCalendar?: () => void;
  hotelSettings?: any;
  invoices?: Invoice[];
  onUpdateInvoices?: (invoices: Invoice[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  waterBottles?: WaterBottleRecord[];
  onUpdateWaterBottles?: (records: WaterBottleRecord[]) => void;
  initialPreselectedBooking?: { roomNumber?: string; roomType?: string; checkInDate?: string; checkInTime?: string } | null;
  onClearInitialPreselect?: () => void;
  onMoveToDeletedFolder?: (item: Omit<DeletedItemRecord, 'id' | 'deletedAt' | 'deletedBy'>) => void;
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

const to24hTime = (raw?: string, fallback = '12:00'): string => {
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
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
  return fallback;
};

const to12hTime = (raw?: string, fallback = '12:00 PM'): string => {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let h = parseInt(m24[1], 10);
    const min = m24[2];
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${min} ${ap}`;
  }
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2];
    const ap = m12[3].toUpperCase();
    return `${String(h).padStart(2, '0')}:${min} ${ap}`;
  }
  return fallback;
};

export default function ReservationView({
  bookings,
  rooms,
  checkins = [],
  onUpdateCheckins,
  posOrders = [],
  loggedInUser,
  currentRole,
  onUpdateBookings,
  onUpdateRooms,
  onCheckIn,
  onCheckOut,
  onOpenCalendar,
  hotelSettings,
  invoices = [],
  onUpdateInvoices,
  onAddAuditLog,
  waterBottles,
  onUpdateWaterBottles,
  initialPreselectedBooking,
  onClearInitialPreselect,
  onMoveToDeletedFolder,
  travelAgents = [],
  onUpdateTravelAgents
}: ReservationViewProps) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Date-Wise Filter state: All, Today, Yesterday, Date, This Month, From -> To Date
  const [dateFilterType, setDateFilterType] = useState<'All' | 'Today' | 'Yesterday' | 'Date' | 'This Month' | 'Range'>('All');
  const [filterSingleDate, setFilterSingleDate] = useState<string>(getTodayDateStr());
  const [filterStartDate, setFilterStartDate] = useState(getTodayDateStr());
  const [filterEndDate, setFilterEndDate] = useState(getFutureDateStr(7));

  // Edit reservation state
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  // Cancel & Refund + Payment Failure state
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState<number>(0);
  const [refundModeInput, setRefundModeInput] = useState<string>('UPI');
  const [refundRefInput, setRefundRefInput] = useState<string>('');
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('Guest requested cancellation');

  const [paymentIssueBooking, setPaymentIssueBooking] = useState<Booking | null>(null);
  const [paymentFailureReasonInput, setPaymentFailureReasonInput] = useState<string>('UPI / Online Transaction Declined or Timed Out');

  // Form Fields
  const [customBookingId, setCustomBookingId] = useState('');
  const [bookingDateInput, setBookingDateInput] = useState(getTodayDateStr());
  const [guestName, setGuestName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [address, setAddress] = useState('');
  const [nationality, setNationality] = useState('Indian');
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const allowBackDatedCheckIn = Boolean(hotelSettings?.allowBackDatedCheckIn);
  const [purposeOfVisit, setPurposeOfVisit] = useState('Personal / Leisure');
  const [checkInDate, setCheckInDate] = useState(getTodayDateStr());
  const [checkOutDate, setCheckOutDate] = useState(getFutureDateStr(1));
  const [checkInTime, setCheckInTime] = useState(getCurrentTimeStr());
  const [checkOutTime, setCheckOutTime] = useState(hotelSettings?.checkOutTime || '11:00 AM');
  const [roomType, setRoomType] = useState<RoomCategory>('Standard');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>('');
  const [adults, setAdults] = useState<number | ''>(2);
  const [children, setChildren] = useState<number | ''>(0);
  const [maleCount, setMaleCount] = useState<number>(1);
  const [femaleCount, setFemaleCount] = useState<number>(1);
  const [childCount, setChildCount] = useState<number>(0);
  const [mealPlan, setMealPlan] = useState<MealPlanType>('EP');
  const [occupancyType, setOccupancyType] = useState<'Single' | 'Double'>('Double');
  const [singleRate, setSingleRate] = useState<number>(1800);
  const [doubleRate, setDoubleRate] = useState<number>(2000);
  const [hasExtraBed, setHasExtraBed] = useState<boolean>(false);
  const [extraBedCount, setExtraBedCount] = useState<number>(1);
  const [extraBedRate, setExtraBedRate] = useState<number>(500);
  const [bookingSource, setBookingSource] = useState<BookingSource>('Direct');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('In Process');
  const [stayHours, setStayHours] = useState<number | ''>('');
  const [roomPrice, setRoomPrice] = useState(2000);
  const [bookingPrice, setBookingPrice] = useState(2000);
  const [bookingGstRate, setBookingGstRate] = useState<number>(
    hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 5)
  );
  type GstOptionMode = 'non_gst' | 'gst_extra' | 'including_gst';
  const [bookingGstMode, setBookingGstMode] = useState<GstOptionMode>(() => {
    if (hotelSettings?.isGstEnabled === false) return 'non_gst';
    if (hotelSettings?.roomRateIncludesGst) return 'including_gst';
    return 'gst_extra';
  });

  // Hybrid / Split Advance Payment State
  const [isHybridAdvance, setIsHybridAdvance] = useState<boolean>(false);
  const [advanceSplitRows, setAdvanceSplitRows] = useState<
    Array<{ id: string; method: PaymentMethod; amount: number | ''; ref: string }>
  >([
    { id: 'adv-sp-1', method: 'Cash', amount: '', ref: '' },
    { id: 'adv-sp-2', method: 'UPI', amount: '', ref: '' },
  ]);

  // Corporate / Multi-Room Selection State (driven by No. of Rooms)
  const [numberOfRooms, setNumberOfRooms] = useState<number>(1);
  const [isMultiRoomMode, setIsMultiRoomMode] = useState<boolean>(false);
  const [multiRoomSelections, setMultiRoomSelections] = useState<BookedRoom[]>([]);

  // Travel Agent & Commission State
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [commissionValue, setCommissionValue] = useState<number>(0);
  const [showQuickAddAgent, setShowQuickAddAgent] = useState<boolean>(false);
  const [quickAgentName, setQuickAgentName] = useState('');
  const [quickAgencyName, setQuickAgencyName] = useState('');
  const [quickAgentMobile, setQuickAgentMobile] = useState('');
  const [quickAgentCommType, setQuickAgentCommType] = useState<'percentage' | 'fixed'>('percentage');
  const [quickAgentCommVal, setQuickAgentCommVal] = useState<string>('10');

  // Voucher Number for Step 2 Advance Payment
  const [voucherNumber, setVoucherNumber] = useState('');

  // Optional hotel services (configured under Front Desk > Guest Services, or added on-the-fly)
  const [customServices, setCustomServices] = useState<WaterBottleRecord[]>([]);
  const [showAddServiceBox, setShowAddServiceBox] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number>(500);
  const [newServiceIsPerPerson, setNewServiceIsPerPerson] = useState<boolean>(false);

  const [serviceCustomRates, setServiceCustomRates] = useState<Record<string, number>>({});
  const [servicePerPerson, setServicePerPerson] = useState<Record<string, boolean>>({});
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});

  const serviceCatalog = React.useMemo(() => {
    const fromProps = (waterBottles || []).filter(w => w.recordType === 'service_catalog');
    const existingIds = new Set(fromProps.map(s => String(s.id)));
    const merged = [...fromProps];
    for (const cs of customServices) {
      if (!existingIds.has(String(cs.id))) {
        merged.push(cs);
      }
    }
    return merged;
  }, [waterBottles, customServices]);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const serviceAmountOf = (s: WaterBottleRecord) => {
    const sid = String(s.id);
    const unitPrice = serviceCustomRates[sid] !== undefined
      ? serviceCustomRates[sid]
      : Math.max(0, Number(s.configuredAmount ?? s.chargeAmount ?? 0));
    const isPerPerson = servicePerPerson[sid] !== undefined
      ? servicePerPerson[sid]
      : Boolean((s as any).isPerPerson);
    const defaultQty = isPerPerson ? Math.max(1, Number(adults) || 1) : 1;
    const qty = serviceQuantities[sid] !== undefined ? serviceQuantities[sid] : defaultQty;
    return unitPrice * qty;
  };

  const tickedServices = serviceCatalog.filter(s => selectedServiceIds.includes(String(s.id)));
  const servicesTotal = tickedServices.reduce((sum, s) => sum + serviceAmountOf(s), 0);

  const bookedServicesPayload: BookedServiceSelection[] = tickedServices.map(s => {
    const sid = String(s.id);
    const unitPrice = serviceCustomRates[sid] !== undefined
      ? serviceCustomRates[sid]
      : Math.max(0, Number(s.configuredAmount ?? s.chargeAmount ?? 0));
    const isPerPerson = servicePerPerson[sid] !== undefined
      ? servicePerPerson[sid]
      : Boolean((s as any).isPerPerson);
    const defaultQty = isPerPerson ? Math.max(1, Number(adults) || 1) : 1;
    const qty = serviceQuantities[sid] !== undefined ? serviceQuantities[sid] : defaultQty;
    const label = isPerPerson
      ? `${String(s.serviceName || 'Service')} (₹${unitPrice.toLocaleString('en-IN')} × ${qty} Person${qty > 1 ? 's' : ''})`
      : qty > 1
      ? `${String(s.serviceName || 'Service')} (₹${unitPrice.toLocaleString('en-IN')} × ${qty})`
      : `${String(s.serviceName || 'Service')} (₹${unitPrice.toLocaleString('en-IN')})`;
    return {
      serviceId: sid,
      serviceName: label,
      amount: serviceAmountOf(s)
    };
  });

  const handleCreateCustomService = () => {
    const trimmed = newServiceName.trim();
    if (!trimmed) {
      showToast('Please enter a service name.', 'warning');
      return;
    }
    const sId = `SRV-CUST-${Date.now()}`;
    const newRecord: WaterBottleRecord = {
      id: sId,
      serviceId: sId,
      hotelId: hotelSettings?.id || 'hotel-1',
      recordType: 'service_catalog',
      serviceName: trimmed,
      configuredAmount: newServicePrice,
      chargeAmount: newServicePrice,
      unitPrice: newServicePrice,
      totalAmount: newServicePrice,
      isChargeable: true,
      roomNumber: 'CATALOG',
      quantity: 1,
      date: getTodayDateStr(),
      dateTime: new Date().toISOString(),
      deliveredBy: 'Front Desk'
    };
    (newRecord as any).isPerPerson = newServiceIsPerPerson;

    setCustomServices(prev => [...prev, newRecord]);
    if (onUpdateWaterBottles && waterBottles) {
      onUpdateWaterBottles([...waterBottles, newRecord]);
    }

    // Auto-select this newly created service
    setSelectedServiceIds(prev => [...prev, sId]);
    setServiceCustomRates(prev => ({ ...prev, [sId]: newServicePrice }));
    setServicePerPerson(prev => ({ ...prev, [sId]: newServiceIsPerPerson }));
    const defaultQty = newServiceIsPerPerson ? Math.max(1, Number(adults) || 1) : 1;
    setServiceQuantities(prev => ({ ...prev, [sId]: defaultQty }));

    // Reset inputs
    setNewServiceName('');
    setNewServicePrice(500);
    setNewServiceIsPerPerson(false);
    setShowAddServiceBox(false);
    showToast(`Service "${trimmed}" added and selected.`, 'success');

    // Background persistence to backend
    fetch('/api/guest-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceName: trimmed,
        amount: newServicePrice,
        hotelId: hotelSettings?.id || 'hotel-1',
        isPerPerson: newServiceIsPerPerson,
      })
    }).catch(() => {});
  };
  // Progressive Wizard & Save Confirmation states
  const [formStep, setFormStep] = useState(1);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [savedBooking, setSavedBooking] = useState<Booking | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const [formError, setFormError] = useState('');

  // Handle prefill from Room Matrix click or PMS Overview Quick Book
  useEffect(() => {
    if (initialPreselectedBooking) {
      if (initialPreselectedBooking.roomNumber) setSelectedRoomNumber(initialPreselectedBooking.roomNumber);
      if (initialPreselectedBooking.roomType) setRoomType(initialPreselectedBooking.roomType as RoomCategory);
      if (initialPreselectedBooking.checkInDate) {
        setCheckInDate(initialPreselectedBooking.checkInDate);
        setCheckOutDate(initialPreselectedBooking.checkInDate);
      }
      if (initialPreselectedBooking.checkInTime) setCheckInTime(initialPreselectedBooking.checkInTime);
      const rm = rooms.find(r => r.number === initialPreselectedBooking.roomNumber);
      if (rm) {
        setRoomPrice(rm.rate);
        setBookingPrice(rm.rate);
      }
      setIsFormOpen(true);
      setFormStep(1);
      onClearInitialPreselect?.();
      return;
    }

    try {
      const quickDraftRaw = sessionStorage.getItem('directstay_quick_booking_draft');
      if (quickDraftRaw) {
        const parsedDraft = JSON.parse(quickDraftRaw);
        if (!parsedDraft?.bookingMode || parsedDraft.bookingMode === 'reservations') {
          sessionStorage.removeItem('directstay_quick_booking_draft');
          if (parsedDraft.checkInDate) setCheckInDate(String(parsedDraft.checkInDate));
          if (parsedDraft.checkOutDate) setCheckOutDate(String(parsedDraft.checkOutDate));
          if (parsedDraft.numGuests) setAdults(Math.max(1, Number(parsedDraft.numGuests)));
          if (parsedDraft.extraBeds !== undefined) {
            const eb = Number(parsedDraft.extraBeds) || 0;
            setHasExtraBed(eb > 0);
            if (eb > 0) setExtraBedCount(eb);
          }
          if (parsedDraft.extraPersonRate) setExtraBedRate(Number(parsedDraft.extraPersonRate) || 500);
          const firstReq = Array.isArray(parsedDraft.requirements) ? parsedDraft.requirements[0] : null;
          const assignedRmNo = firstReq?.assignedRooms?.[0] || parsedDraft?.preselectedRoom?.number || '';
          if (assignedRmNo) setSelectedRoomNumber(String(assignedRmNo));
          if (firstReq?.categoryName) setRoomType(firstReq.categoryName as RoomCategory);
          const rm = rooms.find(r => r.number === String(assignedRmNo)) || rooms.find(r => r.category === firstReq?.categoryName);
          const effectiveRate = Number(firstReq?.unitPrice) || rm?.rate || 2000;
          const nCount = parsedDraft.checkInDate && parsedDraft.checkOutDate
            ? Math.max(1, Math.ceil((new Date(parsedDraft.checkOutDate).getTime() - new Date(parsedDraft.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 1;
          setRoomPrice(effectiveRate);
          setBookingPrice(effectiveRate * nCount);
          if (parsedDraft.withGst === false || Number(parsedDraft.gstRate) === 0) {
            setBookingGstRate(0);
            setBookingGstMode('non_gst');
          } else if (parsedDraft.roomRateIncludesGst) {
            setBookingGstRate(
              hotelSettings?.isGstEnabled === false
                ? 0
                : Number(hotelSettings?.defaultGstRate ?? 5)
            );
            setBookingGstMode('including_gst');
          } else {
            setBookingGstRate(
              hotelSettings?.isGstEnabled === false
                ? 0
                : Number(hotelSettings?.defaultGstRate ?? 5)
            );
            setBookingGstMode('gst_extra');
          }
          setIsFormOpen(true);
          setFormStep(1);
          return;
        }
      }

      const preselectRaw = sessionStorage.getItem('pms_preselect_room');
      const openAdvance = sessionStorage.getItem('pms_open_advance_modal');
      if (preselectRaw) {
        sessionStorage.removeItem('pms_preselect_room');
        sessionStorage.removeItem('pms_open_advance_modal');
        const parsed = JSON.parse(preselectRaw);
        if (parsed?.roomNumber) setSelectedRoomNumber(String(parsed.roomNumber));
        if (parsed?.roomType) setRoomType(parsed.roomType as RoomCategory);
        if (parsed?.checkInDate) {
          setCheckInDate(String(parsed.checkInDate));
          setCheckOutDate(getFutureDateStr(1, String(parsed.checkInDate)));
        }
        const rm = rooms.find(r => r.number === String(parsed?.roomNumber));
        const effectiveRate = Number(parsed?.rate) || rm?.rate || 2000;
        setRoomPrice(effectiveRate);
        setBookingPrice(effectiveRate);
        setIsFormOpen(true);
        setFormStep(1);
      } else if (openAdvance === '1') {
        sessionStorage.removeItem('pms_open_advance_modal');
        setIsFormOpen(true);
        setFormStep(1);
      }
    } catch {
      // ignore storage errors
    }
  }, [initialPreselectedBooking, rooms, onClearInitialPreselect]);

  // Calculate nights dynamically (supports same-day / short-hour stays and open/flexible stays)
  const calNights = () => {
    if (!checkOutDate) return 1; // Open / Flexible stay defaults to 1 night base
    if (checkInDate === checkOutDate) return 1; // Same-day hourly stay count as 1 unit
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) || diffDays <= 0 ? 1 : diffDays;
  };

  const calNightsForDates = (startStr: string, endStr: string) => {
    if (!endStr) return 1; // Open stay
    if (startStr === endStr) return 1;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) || diffDays <= 0 ? 1 : diffDays;
  };

  const billSettings = normalizeBillSettings(hotelSettings);
  const configuredDefaultGst =
    hotelSettings?.isGstEnabled === false ? 0 : billSettings.roomGstRate;

  const buildBookingStayBill = (bk: Booking, forceGstMode?: boolean) => {
    const nightsCount = bk.nights || calNightsForDates(bk.checkInDate, bk.checkOutDate) || 1;
    const roomObj = rooms.find(r => r.category === bk.roomType || r.number === bk.roomNumber);
    const roomRate = roomObj?.rate || 2000;
    const isBookingWithoutGst =
      forceGstMode !== undefined
        ? !forceGstMode
        : bk.isWithoutGst === true || (bk.gstRate !== undefined && Number(bk.gstRate) <= 0);
    const effectiveRate = isBookingWithoutGst
      ? 0
      : forceGstMode === true
      ? configuredDefaultGst > 0
        ? configuredDefaultGst
        : 5
      : Number(bk.gstRate) > 0
      ? Number(bk.gstRate)
      : configuredDefaultGst;

    const effectiveSettings: BillSettings = {
      ...billSettings,
      roomGstRate: isBookingWithoutGst ? 0 : effectiveRate,
      foodGstRate: isBookingWithoutGst ? 0 : billSettings.foodGstRate || effectiveRate,
      roomRateIncludesGst: Boolean(bk.roomRateIncludesGst),
    };

    const rawBookingAmount = Number(bk.bookingAmount) || roomRate * nightsCount;
    const exBedTotal =
      bk.hasExtraBed && (!Array.isArray(bk.bookedRooms) || bk.bookedRooms.length === 0)
        ? (Number(bk.extraBedCount) || 1) * (Number(bk.extraBedRate) || 500) * nightsCount
        : 0;
    // In ReservationView, bk.bookingAmount includes extraBed when saved from the form — avoid double-charging Extra Bed (H13)
    const adjustedRoomBookingAmount =
      exBedTotal > 0 && rawBookingAmount > exBedTotal
        ? r2(rawBookingAmount - exBedTotal)
        : rawBookingAmount;

    const bookingForFolio: Booking = {
      ...bk,
      nights: nightsCount,
      bookingAmount: adjustedRoomBookingAmount,
    };

    const serviceCharges: BillCharge[] = (bk.bookedServices || [])
      .filter(sv => sv && Number(sv.amount) > 0)
      .map((sv, idx) => ({
        id: `bsvc-${sv.serviceId || idx}`,
        kind: 'service' as const,
        description: sv.serviceName || 'Booked Service',
        amount: Number(sv.amount),
        roomNumber: bk.roomNumber || 'TBD',
        sourceKey: `bsvc:${sv.serviceId || idx}`,
      }));

    return {
      stayBill: buildStayBill({
        booking: bookingForFolio,
        rooms,
        settings: effectiveSettings,
        additionalCharges: serviceCharges,
        gstEnabledOverride: !isBookingWithoutGst && effectiveRate > 0,
      }),
      nightsCount,
      isBookingWithoutGst,
      effectiveRate,
    };
  };

  const handleGenerateOrViewInvoice = (bk: Booking) => {
    // If invoice already exists for this booking ID, open it directly
    const existing = invoices?.find(inv => inv.bookingId === bk.id && !inv.isSeparateInvoice);
    if (existing) {
      setViewingInvoice(existing);
      return;
    }

    const { stayBill, nightsCount } = buildBookingStayBill(bk);
    const allocated = allocateInvoiceNumber(invoices || [], billSettings);
    const invoiceNum = allocated.invoiceNumber;
    const roomNumbers =
      stayBill.folio.roomNumbers.length > 0
        ? stayBill.folio.roomNumbers
        : [bk.roomNumber || 'TBD'];

    const record = buildInvoiceRecord({
      id: `INV-${Date.now()}`,
      invoiceNumber: invoiceNum,
      hotelId: bk.hotelId || hotelSettings?.id,
      bookingId: bk.id,
      guestName: bk.guestName,
      guestMobile: bk.mobile,
      guestAddress: bk.address,
      companyName: bk.companyName,
      guestGstNumber: bk.gstNumber,
      roomNumbers,
      checkInDate: bk.checkInDate,
      checkOutDate: bk.checkOutDate,
      nights: nightsCount,
      bill: stayBill.bill,
      paymentMethod: bk.paymentMethod,
      invoiceStatus: 'Generated',
      extra: {
        nationality: bk.nationality,
        voucherNumber: bk.voucherNumber,
        arrivalTime: bk.checkInTime || hotelSettings?.checkInTime || '12:00 PM',
        departureTime: bk.checkOutTime || hotelSettings?.checkOutTime || '11:00 AM',
        extraBedCount: bk.extraBedCount || 0,
        extraBedRate: bk.extraBedRate || 500,
        isGroupCheckIn: bk.isGroupCheckIn,
        groupBookingId: bk.groupBookingId,
        bookedRooms: bk.bookedRooms,
        invoiceType: stayBill.bill.isGstInvoice ? 'Booking Invoice' : 'Bill of Supply',
        notes: `Generated official booking invoice for ID ${bk.id}`,
      },
    });

    const newInvoice = record as Invoice;

    if (onUpdateInvoices) {
      onUpdateInvoices([...invoices, newInvoice]);
    }
    if (onAddAuditLog) {
      onAddAuditLog(
        'Invoice Generated',
        `Generated Invoice ${invoiceNum} (${
          stayBill.bill.isGstInvoice ? `With GST ${stayBill.bill.headlineGstRate}%` : 'No GST'
        }) for Booking ${bk.id} (${bk.guestName}). Total: ₹${newInvoice.finalAmount}`
      );
    }
    setViewingInvoice(newInvoice);
  };

  // Strict GST Immutability: Once an invoice is generated, its GST/No-GST mode CANNOT be edited.
  // Instead, staff must generate a SEPARATE new invoice with its own unique Invoice Number (PREFIX/1014/2026-27).
  const handleCreateSeparateInvoiceFromViewing = (withGstMode: boolean) => {
    if (!viewingInvoice || !onUpdateInvoices) return;
    const targetRate = withGstMode ? (configuredDefaultGst > 0 ? configuredDefaultGst : 5) : 0;
    const matchedBk = bookings.find(b => b.id === viewingInvoice.bookingId);
    const allocated = allocateInvoiceNumber(invoices || [], billSettings);
    const sepInvNumber = allocated.invoiceNumber;
    const sepId = `INV-SEP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    let separateInvoice: Invoice;
    if (matchedBk) {
      const { stayBill, nightsCount } = buildBookingStayBill(matchedBk, withGstMode);
      const roomNumbers =
        stayBill.folio.roomNumbers.length > 0
          ? stayBill.folio.roomNumbers
          : [viewingInvoice.roomNumber || 'TBD'];
      separateInvoice = buildInvoiceRecord({
        id: sepId,
        invoiceNumber: sepInvNumber,
        hotelId: viewingInvoice.hotelId || hotelSettings?.id,
        bookingId: viewingInvoice.bookingId,
        guestName: viewingInvoice.guestName,
        guestMobile: viewingInvoice.guestMobile,
        guestAddress: viewingInvoice.guestAddress,
        companyName: viewingInvoice.companyName,
        guestGstNumber: matchedBk.gstNumber || viewingInvoice.guestGstNumber || viewingInvoice.gstNumber,
        roomNumbers,
        checkInDate: viewingInvoice.checkInDate,
        checkOutDate: viewingInvoice.checkOutDate,
        nights: nightsCount,
        bill: stayBill.bill,
        paymentMethod: viewingInvoice.paymentMethod,
        isSeparateInvoice: true,
        parentInvoiceId: viewingInvoice.id,
        extra: {
          nationality: viewingInvoice.nationality,
          voucherNumber: viewingInvoice.voucherNumber,
          arrivalTime: viewingInvoice.arrivalTime,
          departureTime: viewingInvoice.departureTime,
          extraBedCount: viewingInvoice.extraBedCount,
          extraBedRate: viewingInvoice.extraBedRate,
          notes: `Separate ${
            stayBill.bill.isGstInvoice ? `GST (${stayBill.bill.headlineGstRate}%)` : 'Without GST'
          } invoice generated against ${viewingInvoice.invoiceNumber}`,
        },
      }) as Invoice;
    } else {
      const nightsCount =
        viewingInvoice.nights ||
        calNightsForDates(viewingInvoice.checkInDate, viewingInvoice.checkOutDate) ||
        1;
      const charges: BillCharge[] = [];
      if (Number(viewingInvoice.roomCharges) > 0) {
        charges.push({
          id: 'sep-room',
          kind: 'room',
          description: 'Room Charges',
          amount: Number(viewingInvoice.roomCharges),
          nights: nightsCount,
          roomNumber: viewingInvoice.roomNumber,
        });
      }
      if (Number(viewingInvoice.extraBedCharges) > 0) {
        charges.push({
          id: 'sep-xbed',
          kind: 'extra_bed',
          description: 'Extra Bed Charges',
          amount: Number(viewingInvoice.extraBedCharges),
          roomNumber: viewingInvoice.roomNumber,
        });
      }
      if (Number(viewingInvoice.foodCharges) > 0) {
        charges.push({
          id: 'sep-food',
          kind: 'food',
          description: 'Food Charges',
          amount: Number(viewingInvoice.foodCharges),
          roomNumber: viewingInvoice.roomNumber,
        });
      }
      if (Number(viewingInvoice.waterCharges) > 0) {
        charges.push({
          id: 'sep-water',
          kind: 'water',
          description: 'Water Charges',
          amount: Number(viewingInvoice.waterCharges),
          roomNumber: viewingInvoice.roomNumber,
        });
      }
      if (Number(viewingInvoice.otherCharges) > 0) {
        charges.push({
          id: 'sep-other',
          kind: 'other',
          description: 'Other Services',
          amount: Number(viewingInvoice.otherCharges),
          roomNumber: viewingInvoice.roomNumber,
        });
      }
      const sepBill = calculateBill({
        charges,
        payments:
          Number(viewingInvoice.advancePaid) > 0
            ? [
                {
                  id: 'sep-adv',
                  amount: Number(viewingInvoice.advancePaid),
                  method: viewingInvoice.paymentMethod || 'UPI',
                },
              ]
            : [],
        discount: Number(viewingInvoice.discount || 0),
        gstEnabled: targetRate > 0,
        settings: {
          ...billSettings,
          roomGstRate: targetRate,
          foodGstRate: targetRate > 0 ? billSettings.foodGstRate || targetRate : 0,
          roomRateIncludesGst: false,
        },
      });
      separateInvoice = buildInvoiceRecord({
        id: sepId,
        invoiceNumber: sepInvNumber,
        hotelId: viewingInvoice.hotelId || hotelSettings?.id,
        bookingId: viewingInvoice.bookingId,
        guestName: viewingInvoice.guestName,
        guestMobile: viewingInvoice.guestMobile,
        guestAddress: viewingInvoice.guestAddress,
        companyName: viewingInvoice.companyName,
        guestGstNumber: viewingInvoice.guestGstNumber || viewingInvoice.gstNumber,
        roomNumbers: [viewingInvoice.roomNumber || 'TBD'],
        checkInDate: viewingInvoice.checkInDate,
        checkOutDate: viewingInvoice.checkOutDate,
        nights: nightsCount,
        bill: sepBill,
        paymentMethod: viewingInvoice.paymentMethod,
        isSeparateInvoice: true,
        parentInvoiceId: viewingInvoice.id,
        extra: {
          notes: `Separate ${
            sepBill.isGstInvoice ? `GST (${targetRate}%)` : 'Without GST'
          } invoice generated against ${viewingInvoice.invoiceNumber}`,
        },
      }) as Invoice;
    }

    onUpdateInvoices([separateInvoice, ...(invoices || [])]);
    if (onAddAuditLog) {
      onAddAuditLog(
        'Separate Invoice Generated',
        `Created separate ${
          !separateInvoice.isWithoutGst ? `With GST (${separateInvoice.gstRate}%)` : 'No GST'
        } invoice ${sepInvNumber} for Booking ${viewingInvoice.bookingId} without modifying ${viewingInvoice.invoiceNumber}.`
      );
    }
    setViewingInvoice(separateInvoice);
  };

  // Automatically calculate reactive variables
  const nights = calNights();
  const activeMatchedRoom =
    rooms.find(r => r.number === selectedRoomNumber) || rooms.find(r => r.category === roomType);
  const activeBaseOccupancy = activeMatchedRoom?.baseOccupancy ?? 2;
  const activeExtraPersonRate =
    Number(activeMatchedRoom?.extraPersonCharge) > 0
      ? Number(activeMatchedRoom?.extraPersonCharge)
      : 500;
  const extraOccupancyCount = Math.max(0, (Number(adults) || 1) + (Number(children) || 0) - activeBaseOccupancy);
  const singleModeExtraBedPerNight = hasExtraBed ? Math.max(1, Number(extraBedCount) || 1) * (Number(extraBedRate) || 0) : 0;
  const singleModeExtraPaxPerNight = extraOccupancyCount * activeExtraPersonRate;
  const multiRoomsNightlySum = multiRoomSelections.reduce((sum, mr) => {
    const rmRate = Number(mr.rate) || 0;
    const exBed = mr.hasExtraBed ? (Math.max(1, Number(mr.extraBedCount) || 1) * (Number(mr.extraBedRate) || 0)) : 0;
    const exPax = (Number(mr.extraGuestsCount) || 0) * (Number(mr.extraBedRate) || activeExtraPersonRate);
    return sum + rmRate + exBed + exPax;
  }, 0);
  const totalRoomPrice = isMultiRoomMode && multiRoomSelections.length > 0
    ? multiRoomsNightlySum * Math.max(1, nights)
    : (roomPrice + singleModeExtraBedPerNight + singleModeExtraPaxPerNight) * Math.max(1, nights);
  const discount = totalRoomPrice - bookingPrice;

  // Travel Agent Commission Calculation (Auto-calculated on Confirmed bookings)
  const selectedAgentObj = travelAgents.find(a => a.id === selectedAgentId);
  const isStatusConfirmedForComm = bookingStatus === 'Confirmed' || bookingStatus === 'Checked In';
  const rawCalculatedCommission = selectedAgentId
    ? commissionType === 'percentage'
      ? Math.round((Math.max(0, bookingPrice) * Math.max(0, Number(commissionValue) || 0)) / 100)
      : Math.round(Math.max(0, Number(commissionValue) || 0))
    : 0;
  const effectiveCommissionAmount = isStatusConfirmedForComm ? rawCalculatedCommission : 0;

  // Early Check-In is evaluated on actual Check-In (not on Advance Booking)
  const earlyCheckInInfo = { isEarly: false, hoursEarly: 0, charge: 0 };
  const earlyCheckInFee = 0;

  // Live Booking Billing Preview via single calculateBill() engine
  const liveBookingCharges: BillCharge[] = [
    ...(bookingPrice > 0
      ? [
          {
            id: 'live-bkg-room',
            kind: 'room' as const,
            description: 'Room Charges',
            amount: bookingPrice,
            nights: Math.max(1, nights),
            rate: r2(bookingPrice / Math.max(1, nights)),
            roomNumber: selectedRoomNumber || '101',
          },
        ]
      : []),
    ...tickedServices.map((s, idx) => ({
      id: `live-bkg-svc-${s.id || idx}`,
      kind: 'service' as const,
      description: String(s.serviceName || 'Service'),
      amount: serviceAmountOf(s),
      roomNumber: selectedRoomNumber || '101',
    })),
    ...(earlyCheckInFee > 0
      ? [
          {
            id: 'live-bkg-early',
            kind: 'early_checkin' as const,
            description: 'Early Check-In',
            amount: earlyCheckInFee,
            roomNumber: selectedRoomNumber || '101',
          },
        ]
      : []),
  ];
  const liveBookingBill = calculateBill({
    charges: liveBookingCharges,
    payments:
      advanceAmount > 0
        ? [{ id: 'live-bkg-adv', amount: advanceAmount, method: paymentMethod }]
        : [],
    gstEnabled: bookingGstMode !== 'non_gst' && bookingGstRate > 0,
    settings: {
      ...billSettings,
      roomGstRate: bookingGstMode === 'non_gst' ? 0 : bookingGstRate,
      foodGstRate: bookingGstMode === 'non_gst' ? 0 : billSettings.foodGstRate || bookingGstRate,
      roomRateIncludesGst: bookingGstMode === 'including_gst',
    },
  });
  const calculatedBookingGst = liveBookingBill.totalTax;
  const totalPayableWithGst = liveBookingBill.grandTotal;
  const pendingAmount = liveBookingBill.balance;

  const computeAutoPriceForStay = (
    rate: number,
    nightsCount: number,
    adultsVal: number = Number(adults) || 1,
    childrenVal: number = Number(children) || 0,
    rmObj?: Room,
    extraBedActive: boolean = hasExtraBed,
    exBedCnt: number = extraBedCount,
    exBedRt: number = extraBedRate
  ) => {
    const targetRoom = rmObj || activeMatchedRoom;
    const baseOcc = Number(targetRoom?.baseOccupancy) > 0 ? Number(targetRoom.baseOccupancy) : 2;
    const extraPaxFee = Number(targetRoom?.extraPersonCharge) > 0 ? Number(targetRoom.extraPersonCharge) : 500;
    const totalOcc = Math.max(1, (Number(adultsVal) || 1) + (Number(childrenVal) || 0));
    const extraPaxCount = Math.max(0, totalOcc - baseOcc);
    const extraPaxTotal = extraPaxCount * extraPaxFee;
    const exBedTotal = extraBedActive ? Math.max(1, Number(exBedCnt) || 1) * (Number(exBedRt) || 0) : 0;
    return (rate + exBedTotal + extraPaxTotal) * Math.max(1, nightsCount);
  };

  // Renew Price: restore standard rates from catalog (Point 6)
  const handleRenewReservationPrice = () => {
    const matchedRoom = selectedRoomNumber ? rooms.find(r => r.number === selectedRoomNumber) : rooms.find(r => r.category === roomType);
    const catDefault = matchedRoom?.rate || 2000;
    setDoubleRate(catDefault);
    const sgl = Math.max(0, catDefault - 200);
    setSingleRate(sgl);
    const curRate = occupancyType === 'Single' ? sgl : catDefault;
    setRoomPrice(curRate);
    setBookingPrice(
      computeAutoPriceForStay(curRate, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, matchedRoom, hasExtraBed, extraBedCount, extraBedRate)
    );
    showToast(`Reservation rate renewed to standard catalog rate (₹${catDefault}/night).`, 'info');
  };

  const syncMultiRoomBookingPrice = (nextMultiRooms: BookedRoom[], nightsCount: number = Math.max(1, calNights())) => {
    const nightly = nextMultiRooms.reduce((sum, mr) => {
      const rmRate = Number(mr.rate) || 0;
      const exBed = mr.hasExtraBed ? (Math.max(1, Number(mr.extraBedCount) || 1) * (Number(mr.extraBedRate) || 0)) : 0;
      return sum + rmRate + exBed;
    }, 0);
    if (nightly > 0) {
      setBookingPrice(nightly * Math.max(1, nightsCount));
    }
  };

  // Room management and multi-room functions are declared below next to isRoomAvailableForReservation

  const handleNightsInputChange = (rawNights: number) => {
    const nightsVal = Math.max(1, Math.min(365, Math.floor(rawNights) || 1));
    const nextOut = getFutureDateStr(nightsVal, checkInDate);
    handleCheckOutDateChange(nextOut);
  };

  const updateMultiRoomEntry = (roomNum: string, updates: Partial<BookedRoom>) => {
    const next = multiRoomSelections.map(mr => (mr.roomNumber === roomNum ? { ...mr, ...updates } : mr));
    setMultiRoomSelections(next);
    if (updates.guestsCount !== undefined) {
      const totalGuestsAcrossRooms = next.reduce((s, r) => s + (Number(r.guestsCount) || 1), 0);
      if (totalGuestsAcrossRooms > 0) setAdults(totalGuestsAcrossRooms);
    }
    syncMultiRoomBookingPrice(next);
  };

  const handleQuickAddTravelAgent = () => {
    if (!quickAgentName.trim()) {
      showToast('Please enter the Travel Agent name.', 'warning');
      return;
    }
    const newAgent: TravelAgent = {
      id: `AGT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      hotelId: hotelSettings?.id,
      name: quickAgentName.trim(),
      agencyName: quickAgencyName.trim() || quickAgentName.trim(),
      mobile: quickAgentMobile.trim() || '',
      commissionType: quickAgentCommType,
      commissionValue: Math.max(0, Number(quickAgentCommVal) || 0),
      status: 'Active',
      createdAt: new Date().toISOString().split('T')[0],
    };
    if (onUpdateTravelAgents) {
      onUpdateTravelAgents([newAgent, ...travelAgents]);
    }
    setSelectedAgentId(newAgent.id);
    setCommissionType(newAgent.commissionType);
    setCommissionValue(newAgent.commissionValue);
    setBookingSource('Travel Agent');
    setShowQuickAddAgent(false);
    setQuickAgentName('');
    setQuickAgencyName('');
    setQuickAgentMobile('');
    showToast(`Travel Agent "${newAgent.name}" added and selected!`, 'success');
  };

  // Helper to sync prices when room type is changed
  const handleRoomTypeChange = (category: RoomCategory) => {
    setRoomType(category);
    const matchingRooms = rooms.filter(r => r.category === category);
    const firstRm = matchingRooms[0];
    const defaultRate = firstRm?.rate || 2000;
    setRoomPrice(defaultRate);
    setDoubleRate(defaultRate);
    setSingleRate(Math.max(0, defaultRate - 200));
    if (selectedRoomNumber && !matchingRooms.some(r => r.number === selectedRoomNumber)) {
      setSelectedRoomNumber(firstRm?.number || '');
    }
    const nightsCount = calNightsForDates(checkInDate, checkOutDate);
    if (!isMultiRoomMode) {
      setBookingPrice(computeAutoPriceForStay(defaultRate, nightsCount, Number(adults) || 1, Number(children) || 0, firstRm));
    }
  };

  // Sync pricing when dates change without resetting custom user tariffs or edited booking prices
  const handleCheckInDateChange = (val: string) => {
    let cleanVal = val;
    setCheckInDate(cleanVal);
    let effectiveOut = checkOutDate;
    if (!effectiveOut || effectiveOut <= cleanVal) {
      effectiveOut = getFutureDateStr(1, cleanVal);
      setCheckOutDate(effectiveOut);
    }
    const nightsCount = Math.max(1, calNightsForDates(cleanVal, effectiveOut));

    // Preserve existing negotiated booking price when duration has not changed
    if (editingBooking) {
      return;
    }

    if (bookingPrice > 0 && nightsCount > 0) {
      // Stay length is preserved, keep user's entered price intact
      return;
    }

    if (isMultiRoomMode && multiRoomSelections.length > 0) {
      syncMultiRoomBookingPrice(multiRoomSelections, nightsCount);
    } else {
      setBookingPrice(computeAutoPriceForStay(roomPrice, nightsCount, Number(adults) || 1, Number(children) || 0, activeMatchedRoom));
    }
  };

  const handleCheckOutDateBlur = () => {
    if (checkOutDate && checkInDate && checkOutDate < checkInDate) {
      setCheckOutDate(checkInDate);
      showToast('Departure date cannot be before Arrival date.', 'warning');
    }
  };

  const handleCheckOutDateChange = (val: string) => {
    const prevNights = calNightsForDates(checkInDate, checkOutDate);
    setCheckOutDate(val);
    if (!val || (checkInDate && val < checkInDate)) {
      // Allow mid-typing intermediate digits (e.g. typing "2" then "1" for 21st) without snapping back
      return;
    }
    const nightsCount = calNightsForDates(checkInDate, val);

    if (editingBooking) {
      if (nightsCount !== prevNights && prevNights > 0 && bookingPrice > 0) {
        const customPerNight = Math.round(bookingPrice / prevNights);
        setBookingPrice(customPerNight * Math.max(1, nightsCount));
      }
      return;
    }

    if (nightsCount === prevNights && bookingPrice > 0) {
      return;
    }

    if (isMultiRoomMode && multiRoomSelections.length > 0) {
      syncMultiRoomBookingPrice(multiRoomSelections, nightsCount);
    } else {
      const customRate = (bookingPrice > 0 && prevNights > 0 && bookingPrice !== computeAutoPriceForStay(roomPrice, prevNights, Number(adults) || 1, Number(children) || 0, activeMatchedRoom))
        ? Math.round(bookingPrice / prevNights)
        : roomPrice;
      setBookingPrice(computeAutoPriceForStay(customRate, nightsCount, Number(adults) || 1, Number(children) || 0, activeMatchedRoom));
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBooking(null);
    setFormStep(1);
    setBookingDateInput(getTodayDateStr());
    setGuestName('');
    setMobile('');
    setEmail('');
    setAadhaarNumber('');
    setAddress('');
    setNationality('Indian');
    setCompanyName('');
    setGstNumber('');
    setPurposeOfVisit('Personal / Leisure');
    setCheckInDate(getTodayDateStr());
    setCheckOutDate(getFutureDateStr(1));
    setStayHours('');
    setCheckInTime(getCurrentTimeStr());
    setCheckOutTime(hotelSettings?.checkOutTime || '11:00 AM');
    setRoomType('Standard');
    setSelectedRoomNumber('');
    setAdults(2);
    setChildren(0);
    setMaleCount(1);
    setFemaleCount(1);
    setChildCount(0);
    setMealPlan('EP');
    setOccupancyType('Double');
    setSingleRate(1800);
    setDoubleRate(2000);
    setHasExtraBed(false);
    setExtraBedCount(1);
    setExtraBedRate(500);
    setNumberOfRooms(1);
    setIsMultiRoomMode(false);
    setMultiRoomSelections([]);
    setSelectedAgentId('');
    setCommissionType('percentage');
    setCommissionValue(0);
    setShowQuickAddAgent(false);
    setVoucherNumber('');
    setBookingSource('Direct');
    setBookingStatus('In Process');
    setRoomPrice(2000);
    setBookingPrice(2000);
    setBookingGstRate(configuredDefaultGst);
    setBookingGstMode(
      hotelSettings?.isGstEnabled === false
        ? 'non_gst'
        : hotelSettings?.roomRateIncludesGst
        ? 'including_gst'
        : 'gst_extra'
    );
    setAdvanceAmount(0);
    setIsHybridAdvance(false);
    setAdvanceSplitRows([
      { id: 'adv-sp-1', method: 'Cash', amount: '', ref: '' },
      { id: 'adv-sp-2', method: 'UPI', amount: '', ref: '' },
    ]);
    setSelectedServiceIds([]);
    setPaymentMethod('Cash');
    setTransactionId('');
    setNotes('');
    setFormError('');
  };

  const handleEditClick = (bk: Booking) => {
    setEditingBooking(bk);
    setCustomBookingId(bk.id || '');
    setBookingDateInput(bk.bookingDate && /^\d{4}-\d{2}-\d{2}/.test(bk.bookingDate) ? bk.bookingDate.slice(0, 10) : getTodayDateStr());
    setGuestName(bk.guestName || '');
    setMobile(bk.mobile || '');
    setEmail(bk.email || '');
    setAadhaarNumber(bk.aadhaarNumber || '');
    setAddress(bk.address || '');
    setNationality(bk.nationality || 'Indian');
    setCompanyName(bk.companyName || '');
    setGstNumber(bk.gstNumber || '');
    setPurposeOfVisit(bk.purposeOfVisit || 'Personal / Leisure');
    setCheckInDate(bk.checkInDate || getTodayDateStr());
    setCheckOutDate(bk.checkOutDate || getFutureDateStr(1));
    setCheckInTime(bk.checkInTime || getCurrentTimeStr());
    setCheckOutTime(bk.checkOutTime || hotelSettings?.checkOutTime || '11:00 AM');
    setRoomType(bk.roomType || 'Standard');
    setSelectedRoomNumber(bk.roomNumber && !bk.roomNumber.includes(',') ? bk.roomNumber : '');
    const ad = bk.adults ?? 2;
    const ch = bk.children ?? 0;
    setAdults(ad);
    setChildren(ch);
    setMaleCount(bk.maleCount ?? Math.ceil(ad / 2));
    setFemaleCount(bk.femaleCount ?? Math.floor(ad / 2));
    setChildCount(bk.childCount ?? ch);
    setMealPlan(bk.mealPlan || 'EP');
    setOccupancyType(bk.occupancyType || 'Double');
    setHasExtraBed(Boolean(bk.hasExtraBed));
    setExtraBedCount(bk.extraBedCount || 1);
    setExtraBedRate(bk.extraBedRate || 500);
    if (Array.isArray(bk.bookedRooms) && bk.bookedRooms.length > 1) {
      setNumberOfRooms(bk.bookedRooms.length);
      setIsMultiRoomMode(true);
      setMultiRoomSelections(bk.bookedRooms);
    } else {
      setNumberOfRooms(1);
      setIsMultiRoomMode(false);
      setMultiRoomSelections([]);
    }
    setSelectedAgentId(bk.travelAgentId || '');
    setCommissionType(bk.commissionType || 'percentage');
    setCommissionValue(bk.commissionValue ?? 0);
    setVoucherNumber(bk.voucherNumber || '');
    setBookingSource(bk.bookingSource || 'Direct');
    setBookingStatus(bk.status || (Number(bk.advanceAmount || 0) > 0 ? 'Confirmed' : 'In Process'));
    setStayHours(bk.stayHours || '');
    const roomObj = rooms.find(r => r.number === bk.roomNumber) || rooms.find(r => r.category === bk.roomType);
    const rate = roomObj?.rate || 2000;
    setRoomPrice(rate);
    setSingleRate(bk.singleRate || Math.max(0, rate - 200));
    setDoubleRate(bk.doubleRate || rate);
    const nightsCount = bk.nights || calNightsForDates(bk.checkInDate, bk.checkOutDate) || 1;
    setBookingPrice(bk.bookingAmount || rate * nightsCount);
    const isBkWithoutGst = bk.isWithoutGst === true || (bk.gstRate !== undefined && Number(bk.gstRate) <= 0);
    setBookingGstRate(
      isBkWithoutGst
        ? 0
        : configuredDefaultGst > 0
        ? configuredDefaultGst
        : Number(bk.gstRate) || 5
    );
    setBookingGstMode(
      isBkWithoutGst
        ? 'non_gst'
        : bk.roomRateIncludesGst
        ? 'including_gst'
        : 'gst_extra'
    );
    setSelectedServiceIds((bk.bookedServices || []).map(s => String(s.serviceId)));
    setAdvanceAmount(bk.advanceAmount || 0);
    const existingAdvPays: any[] = Array.isArray((bk as any).payments) ? (bk as any).payments : [];
    if (existingAdvPays.length > 1) {
      setIsHybridAdvance(true);
      setAdvanceSplitRows(
        existingAdvPays.map((p, idx) => ({
          id: String(p.id || `adv-sp-${idx + 1}`),
          method: (p.paymentMethod || 'Cash') as PaymentMethod,
          amount: Number(p.amount) || 0,
          ref: String(p.transactionId || p.reference || ''),
        }))
      );
      setPaymentMethod((existingAdvPays[0]?.paymentMethod || bk.paymentMethod || 'Cash') as PaymentMethod);
    } else {
      setIsHybridAdvance(false);
      setAdvanceSplitRows([
        { id: 'adv-sp-1', method: 'Cash', amount: '', ref: '' },
        { id: 'adv-sp-2', method: 'UPI', amount: '', ref: '' },
      ]);
      setPaymentMethod(bk.paymentMethod || 'Cash');
    }
    setTransactionId(bk.transactionId || '');
    setNotes(bk.notes || '');
    setFormError('');
    setFormStep(1);
    setIsFormOpen(true);
  };

  const dynamicCategories = Array.from(
    new Set(rooms.map(r => r.category).filter((c): c is RoomCategory => Boolean(c)))
  );

  const generateNextReservationId = () => {
    const allIdPool = new Set([
      ...bookings.map(b => String(b.id || '')),
      ...(invoices || []).map(inv => String(inv.bookingId || ''))
    ]);
    const tsSuffix = Number(String(Date.now()).slice(-6));
    let candidateNum = Math.max(1001, tsSuffix);
    while (allIdPool.has(`GP-BKG-${candidateNum}`)) {
      candidateNum += 1;
    }
    return `GP-BKG-${candidateNum}`;
  };

  const handleNewBookingClick = () => {
    try {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/admin/frontDesk/checkin');
        window.dispatchEvent(
          new CustomEvent('directstay:checkin-nav', {
            detail: {
              bookingCategory: 'standard',
              checkInDate: getTodayDateStr(),
            },
          })
        );
      }
    } catch {}
    if (onCheckIn) {
      onCheckIn(null as any);
      return;
    }
    setEditingBooking(null);
    setCustomBookingId(generateNextReservationId());
    setBookingDateInput(getTodayDateStr());
    setGuestName('');
    setMobile('');
    setEmail('');
    setAadhaarNumber('');
    setAddress('');
    setNationality('Indian');
    setCompanyName('');
    setGstNumber('');
    setPurposeOfVisit('Personal / Leisure');
    setCheckInDate(getTodayDateStr());
    setCheckOutDate(getFutureDateStr(1));
    setStayHours('');
    const firstCat = dynamicCategories[0] || ('' as RoomCategory);
    const firstRate = rooms.find(r => r.category === firstCat)?.rate || rooms[0]?.rate || 0;
    setRoomType(firstCat);
    setSelectedRoomNumber('');
    setAdults(2);
    setChildren(0);
    setMaleCount(1);
    setFemaleCount(1);
    setChildCount(0);
    setMealPlan('EP');
    setOccupancyType('Double');
    setSingleRate(Math.max(0, firstRate - 200));
    setDoubleRate(firstRate);
    setHasExtraBed(false);
    setExtraBedCount(1);
    setExtraBedRate(500);
    setNumberOfRooms(1);
    setIsMultiRoomMode(false);
    setMultiRoomSelections([]);
    setSelectedAgentId('');
    setCommissionType('percentage');
    setCommissionValue(0);
    setShowQuickAddAgent(false);
    setVoucherNumber('');
    setBookingSource('Direct');
    setBookingStatus('In Process');
    setRoomPrice(firstRate);
    setBookingPrice(firstRate);
    setBookingGstRate(configuredDefaultGst);
    setBookingGstMode(
      hotelSettings?.isGstEnabled === false
        ? 'non_gst'
        : hotelSettings?.roomRateIncludesGst
        ? 'including_gst'
        : 'gst_extra'
    );
    setAdvanceAmount(0);
    setIsHybridAdvance(false);
    setAdvanceSplitRows([
      { id: 'adv-sp-1', method: 'Cash', amount: '', ref: '' },
      { id: 'adv-sp-2', method: 'UPI', amount: '', ref: '' },
    ]);
    setSelectedServiceIds([]);
    setPaymentMethod('Cash');
    setTransactionId('');
    setNotes('');
    setFormStep(1);
    setFormError('');
    setIsFormOpen(true);
  };

  const isRoomAvailableForReservation = (
    r: Room,
    startStr: string = checkInDate,
    endStr: string = checkOutDate,
    excludeBookingId: string | undefined = editingBooking?.id
  ): boolean => {
    const check = validateRoomAllocationForDates({
      targetRoomNumbers: [String(r.number || '').trim()],
      checkInDate: startStr,
      checkOutDate: endStr,
      excludeBookingId,
      rooms,
      bookings,
      checkins,
      todayStr: getTodayDateStr(),
    });
    return check.valid;
  };

  const findAvailableRoomForDates = (
    category: RoomCategory,
    startStr: string,
    endStr: string,
    excludeBookingId?: string
  ): Room | undefined => {
    return rooms.find(
      r => r.category === category && isRoomAvailableForReservation(r, startStr, endStr, excludeBookingId)
    );
  };

  const selectedRoomList: string[] =
    isMultiRoomMode && multiRoomSelections.length > 0
      ? multiRoomSelections.map(mr => String(mr.roomNumber).trim())
      : selectedRoomNumber
      ? selectedRoomNumber.split(',').map(s => s.trim()).filter(Boolean)
      : [];

  const categoriesForPicker = (
    dynamicCategories && dynamicCategories.length > 0
      ? dynamicCategories
      : Array.from(new Set(rooms.map(r => r.category).filter(Boolean)))
  ) as RoomCategory[];

  const handleToggleRoom = (rm: Room) => {
    const rmNum = String(rm.number).trim();
    const isPicked = selectedRoomList.includes(rmNum);
    let nextNumbers: string[];
    if (isPicked) {
      nextNumbers = selectedRoomList.filter(num => num !== rmNum);
    } else {
      nextNumbers = [...selectedRoomList, rmNum];
    }

    if (nextNumbers.length === 0) {
      setSelectedRoomNumber('');
      setIsMultiRoomMode(false);
      setMultiRoomSelections([]);
      setNumberOfRooms(1);
      const defaultRm = rooms[0];
      const rate = defaultRm?.rate || 2000;
      setRoomPrice(rate);
      setDoubleRate(rate);
      setSingleRate(Math.max(0, rate - 200));
      setBookingPrice(computeAutoPriceForStay(rate, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, defaultRm));
    } else if (nextNumbers.length === 1) {
      const singleNum = nextNumbers[0];
      const single = rooms.find(r => String(r.number).trim() === singleNum) || rm;
      setSelectedRoomNumber(single.number);
      setRoomType(single.category);
      setIsMultiRoomMode(false);
      setMultiRoomSelections([]);
      setNumberOfRooms(1);
      const rate = Number(single.rate) || 2000;
      setRoomPrice(rate);
      setDoubleRate(rate);
      setSingleRate(Math.max(0, rate - 200));
      setBookingPrice(computeAutoPriceForStay(rate, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, single));
    } else {
      const chosenRooms = nextNumbers.map(num => rooms.find(r => String(r.number).trim() === num)).filter(Boolean) as Room[];
      const nextSelections: BookedRoom[] = chosenRooms.map(r => {
        const nightlyRate = Number(r.rate) || 2000;
        return {
          roomNumber: r.number,
          category: r.category,
          roomType: r.category,
          rate: nightlyRate,
          originalRate: nightlyRate,
          discountAmountOfRoom: 0,
          occupancy: 'Double' as const,
          occupancyType: 'Double' as const,
          guestsCount: 2,
          extraGuestsCount: 0,
          extraPersonChargeApplied: 0,
          totalRoomAmount: nightlyRate * Math.max(1, calNights()),
          hasExtraBed: false,
          extraBedCount: 1,
          extraBedRate: Number(r.extraPersonCharge) > 0 ? Number(r.extraPersonCharge) : 500,
        };
      });
      setSelectedRoomNumber(nextNumbers.join(', '));
      setRoomType(chosenRooms[0]?.category || roomType);
      setIsMultiRoomMode(true);
      setMultiRoomSelections(nextSelections);
      setNumberOfRooms(nextNumbers.length);
      const totalGuests = nextSelections.reduce((s, r) => s + (Number(r.guestsCount) || 1), 0);
      if (totalGuests > 0) setAdults(totalGuests);
      syncMultiRoomBookingPrice(nextSelections);
    }
  };

  const handleNumberOfRoomsChange = (rawCount: number) => {
    const count = Math.max(1, Math.min(50, Math.floor(rawCount) || 1));
    setNumberOfRooms(count);
    if (count <= 1) {
      if (selectedRoomList.length > 1) {
        const firstNum = selectedRoomList[0];
        const single = rooms.find(r => String(r.number).trim() === firstNum);
        if (single) {
          setSelectedRoomNumber(single.number);
          setRoomType(single.category);
          const rate = Number(single.rate) || 2000;
          setRoomPrice(rate);
          setDoubleRate(rate);
          setSingleRate(Math.max(0, rate - 200));
          setBookingPrice(computeAutoPriceForStay(rate, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, single));
        }
      }
      setIsMultiRoomMode(false);
      setMultiRoomSelections([]);
      return;
    }

    setIsMultiRoomMode(true);
    const availList = rooms.filter(r => isRoomAvailableForReservation(r, checkInDate, checkOutDate, editingBooking?.id));
    let nextNums = [...selectedRoomList];
    if (nextNums.length > count) {
      nextNums = nextNums.slice(0, count);
    } else if (nextNums.length < count) {
      for (const rm of availList) {
        if (nextNums.length >= count) break;
        if (nextNums.includes(String(rm.number).trim())) continue;
        nextNums.push(String(rm.number).trim());
      }
    }
    const chosenRooms = nextNums.map(num => rooms.find(r => String(r.number).trim() === num)).filter(Boolean) as Room[];
    const nextSelections: BookedRoom[] = chosenRooms.map(r => {
      const nightlyRate = Number(r.rate) || 2000;
      return {
        roomNumber: r.number,
        category: r.category,
        roomType: r.category,
        rate: nightlyRate,
        originalRate: nightlyRate,
        discountAmountOfRoom: 0,
        occupancy: 'Double' as const,
        occupancyType: 'Double' as const,
        guestsCount: 2,
        extraGuestsCount: 0,
        extraPersonChargeApplied: 0,
        totalRoomAmount: nightlyRate * Math.max(1, calNights()),
        hasExtraBed: false,
        extraBedCount: 1,
        extraBedRate: Number(r.extraPersonCharge) > 0 ? Number(r.extraPersonCharge) : 500,
      };
    });
    setSelectedRoomNumber(nextNums.join(', '));
    if (chosenRooms[0]) setRoomType(chosenRooms[0].category);
    setMultiRoomSelections(nextSelections);
    const totalGuests = nextSelections.reduce((s, r) => s + (Number(r.guestsCount) || 1), 0);
    if (totalGuests > 0) setAdults(totalGuests);
    syncMultiRoomBookingPrice(nextSelections);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!guestName.trim() || !mobile.trim()) {
      setFormError('Guest Name and Mobile Number are required.');
      return;
    }

    if (isMultiRoomMode && multiRoomSelections.length === 0) {
      setFormError('Please select at least one room from the room picker.');
      return;
    }

    if (!editingBooking && !allowBackDatedCheckIn && checkInDate && checkInDate < getTodayDateStr()) {
      setFormError('Arrival date cannot be in the past for new advance bookings.');
      return;
    }

    if (checkOutDate && checkInDate && checkOutDate < checkInDate) {
      setFormError('Departure date cannot be before Arrival date.');
      return;
    }

    const nightsCount = calNights();
    if (checkOutDate && checkInDate && checkOutDate < checkInDate) {
      setFormError('Check-out date cannot occur before the scheduled Check-in date.');
      return;
    }

    if (bookingPrice <= 0) {
      setFormError('Booking amount must be greater than zero.');
      return;
    }

    if (advanceAmount < 0 || advanceAmount > totalPayableWithGst) {
      setFormError(`Advance amount must be between ₹0 and the total payable amount (₹${totalPayableWithGst.toLocaleString()}).`);
      return;
    }

    const resolvedBookedRooms: BookedRoom[] | undefined =
      isMultiRoomMode && multiRoomSelections.length > 0
        ? multiRoomSelections
        : undefined;
    const totalExtraBedsFromMulti = resolvedBookedRooms
      ? resolvedBookedRooms.reduce((s, r) => s + (r.hasExtraBed ? Math.max(1, Number(r.extraBedCount) || 1) : 0), 0)
      : hasExtraBed
      ? Math.max(1, Number(extraBedCount) || 1)
      : 0;

    let updatedBookings: Booking[];
    let finalBooking: Booking;

    const activeHybridSplits = isHybridAdvance
      ? advanceSplitRows.filter(r => (Number(r.amount) || 0) > 0)
      : [];
    if (isHybridAdvance && advanceAmount > 0 && activeHybridSplits.length < 2) {
      setFormError('Hybrid payment requires at least two payment methods with amounts greater than ₹0.');
      return;
    }
    if (advanceAmount > totalPayableWithGst + 0.5) {
      setFormError(`Advance received (₹${advanceAmount}) cannot exceed Total Payable (₹${totalPayableWithGst}).`);
      return;
    }

    const effectiveAdvPaymentMethod: PaymentMethod =
      isHybridAdvance && activeHybridSplits.length > 0
        ? activeHybridSplits[0].method
        : paymentMethod;
    const buildAdvancePaymentItems = (bkgId: string) => {
      const bDate = bookingDateInput || getTodayDateStr();
      if (isHybridAdvance && activeHybridSplits.length > 0) {
        return activeHybridSplits.map((sp, idx) => ({
          id: `pay-adv-${bkgId}-${idx + 1}`,
          bookingId: bkgId,
          amount: Number(sp.amount) || 0,
          paymentMethod: sp.method,
          paymentType: 'Advance Deposit',
          transactionId: sp.ref.trim() || `ADV-${bkgId}-${idx + 1}`,
          date: bDate,
          time: getCurrentTimeStr(),
          recordedBy: 'Front Desk',
          notes: `Advance Deposit (${sp.method})`,
        }));
      }
      if (advanceAmount > 0) {
        return [
          {
            id: `pay-adv-${bkgId}`,
            bookingId: bkgId,
            amount: advanceAmount,
            paymentMethod: effectiveAdvPaymentMethod,
            paymentType: 'Advance Deposit',
            transactionId: transactionId.trim() || `ADV-${bkgId}`,
            date: bDate,
            time: getCurrentTimeStr(),
            recordedBy: 'Front Desk',
            notes: 'Advance deposit',
          },
        ];
      }
      return [];
    };

    if (editingBooking) {
      let allocatedRoomNumber = resolvedBookedRooms
        ? resolvedBookedRooms.map(r => r.roomNumber).join(', ')
        : selectedRoomNumber || editingBooking.roomNumber;
      if (!resolvedBookedRooms && selectedRoomNumber) {
        const typedRoom = rooms.find(r => String(r.number).toLowerCase() === selectedRoomNumber.toLowerCase());
        if (!typedRoom) {
          setFormError(`Room "${selectedRoomNumber}" does not exist. Please type a valid room number or clear it.`);
          return;
        }
        allocatedRoomNumber = String(typedRoom.number);
        if (typedRoom.number !== editingBooking.roomNumber && !isRoomAvailableForReservation(typedRoom, checkInDate, checkOutDate, editingBooking.id)) {
          setFormError(`Room ${typedRoom.number} is already booked or occupied for ${checkInDate} to ${checkOutDate || 'Open Stay'}.`);
          return;
        }
      }
      const needsReallocation =
        !resolvedBookedRooms &&
        !selectedRoomNumber &&
        (editingBooking.roomType !== roomType ||
          editingBooking.checkInDate !== checkInDate ||
          editingBooking.checkOutDate !== checkOutDate);
      if (needsReallocation) {
        const suitableRoom = findAvailableRoomForDates(roomType, checkInDate, checkOutDate, editingBooking.id);
        if (!suitableRoom) {
          setFormError(`No ${roomType} rooms are available for ${checkInDate} to ${checkOutDate} due to existing reservations or occupancy.`);
          return;
        }
        allocatedRoomNumber = suitableRoom.number;
      }

      const prevRawSt = String(editingBooking.status || '').toLowerCase();
      const autoStatus: BookingStatus =
        editingBooking.status === 'Cancelled' || prevRawSt === 'cancelled'
          ? 'Cancelled'
          : prevRawSt === 'no-show' || prevRawSt === 'no show'
          ? 'No-Show'
          : editingBooking.isCompleted || prevRawSt === 'checked-out' || prevRawSt === 'checked out' || prevRawSt === 'checkedout'
          ? 'Checked-Out'
          : editingBooking.isCheckedIn || prevRawSt === 'checked in' || prevRawSt === 'checked-in'
          ? 'Checked-In'
          : bookingStatus === 'Draft'
          ? 'Draft'
          : advanceAmount > 0 || bookingStatus === 'Confirmed'
          ? 'Confirmed'
          : 'In Process';

      finalBooking = {
        ...editingBooking,
        guestName: guestName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        aadhaarNumber: aadhaarNumber.trim(),
        address: address.trim(),
        nationality: nationality.trim() || 'Indian',
        companyName: companyName.trim() || undefined,
        gstNumber: gstNumber.trim().toUpperCase() || undefined,
        purposeOfVisit: purposeOfVisit || undefined,
        checkInDate,
        checkOutDate: checkOutDate || '',
        checkInTime,
        checkOutTime: checkOutTime || '',
        isHourlyStay: Boolean(checkOutDate && checkInDate === checkOutDate),
        stayHours: (checkOutDate && checkInDate === checkOutDate && stayHours !== '') ? Number(stayHours) : undefined,
        isEarlyCheckIn: earlyCheckInInfo.isEarly,
        earlyCheckInHours: earlyCheckInInfo.hoursEarly,
        earlyCheckInCharge: earlyCheckInFee,
        isBackDated: checkInDate < getTodayDateStr(),
        actualLoggedAt: new Date().toISOString(),
        nights: nightsCount,
        adults: Number(adults) || 1,
        children: Number(children) || 0,
        maleCount: Number(maleCount) || 0,
        femaleCount: Number(femaleCount) || 0,
        childCount: Number(childCount) || 0,
        mealPlan,
        occupancyType,
        singleRate,
        doubleRate,
        hasExtraBed: totalExtraBedsFromMulti > 0,
        extraBedCount: totalExtraBedsFromMulti > 0 ? totalExtraBedsFromMulti : undefined,
        extraBedRate: hasExtraBed ? extraBedRate : resolvedBookedRooms?.[0]?.extraBedRate,
        roomType: resolvedBookedRooms ? (((resolvedBookedRooms[0] as any).roomType || resolvedBookedRooms[0].category || roomType) as RoomCategory) : roomType,
        roomNumber: allocatedRoomNumber,
        bookedRooms: resolvedBookedRooms,
        isGroupCheckIn: Boolean(resolvedBookedRooms && resolvedBookedRooms.length > 1),
        bookingSource,
        status: autoStatus,
        isCompleted: Boolean(editingBooking.isCompleted),
        advanceAmount,
        paymentMethod: effectiveAdvPaymentMethod,
        payments: buildAdvancePaymentItems(editingBooking.id),
        voucherNumber: voucherNumber.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || editingBooking.notes,
        bookingAmount: bookingPrice,
        extraPersonChargeApplied: singleModeExtraPaxPerNight * Math.max(1, nightsCount),
        gstRate: bookingGstMode === 'non_gst' ? 0 : bookingGstRate,
        gstAmount: calculatedBookingGst,
        isWithoutGst: bookingGstMode === 'non_gst' || bookingGstRate <= 0,
        gstInvoice: bookingGstMode !== 'non_gst' && bookingGstRate > 0,
        roomRateIncludesGst: bookingGstMode === 'including_gst',
        bookedServices: bookedServicesPayload,
        travelAgentId: selectedAgentId || undefined,
        travelAgentName: selectedAgentObj ? `${selectedAgentObj.name}${selectedAgentObj.agencyName ? ` (${selectedAgentObj.agencyName})` : ''}` : undefined,
        commissionType: selectedAgentId ? commissionType : undefined,
        commissionValue: selectedAgentId ? commissionValue : undefined,
        commissionAmount: selectedAgentId ? effectiveCommissionAmount : undefined,
        bookingDate: bookingDateInput || editingBooking.bookingDate,
        paymentStatus: advanceAmount >= totalPayableWithGst ? 'Fully Paid' : (advanceAmount > 0 ? 'Partially Paid' : 'Unpaid'),
      };
      delete (finalBooking as any).isStandaloneWalkin;

      const existsInBookings = bookings.some(b => b.id === editingBooking.id);
      updatedBookings = existsInBookings
        ? bookings.map(b => (b.id === editingBooking.id ? finalBooking : b))
        : [...bookings, finalBooking];

      if (onUpdateCheckins && checkins.length > 0) {
        const linkedCi = findLinkedCheckinForBooking(editingBooking, checkins);
        if (linkedCi) {
          onUpdateCheckins(
            checkins.map(ci =>
              ci.id === linkedCi.id
                ? {
                    ...ci,
                    guestName: finalBooking.guestName,
                    mobile: finalBooking.mobile,
                    emailAddress: finalBooking.email,
                    address: finalBooking.address,
                    companyName: finalBooking.companyName,
                    gstNumber: finalBooking.gstNumber,
                    checkInDate: finalBooking.checkInDate,
                    checkOutDate: finalBooking.checkOutDate,
                    roomNumber: allocatedRoomNumber,
                    bookedRooms: finalBooking.bookedRooms,
                    advanceAmount: finalBooking.advanceAmount,
                  }
                : ci
            )
          );
        }
      }

      if (onUpdateInvoices && invoices) {
        const existingInv = invoices.find(inv => inv.bookingId === editingBooking.id && !inv.isSeparateInvoice);
        if (existingInv) {
          // STRICT RULE: Never edit or flip GST / No-GST on an already-generated invoice.
          const lockedWithoutGst =
            existingInv.isWithoutGst === true ||
            (existingInv.gstRate !== undefined && Number(existingInv.gstRate) <= 0) ||
            (existingInv.gstRate === undefined && Number(existingInv.gst || 0) <= 0);
          const { stayBill: syncedStayBill, nightsCount: syncedNights } = buildBookingStayBill(
            finalBooking,
            !lockedWithoutGst
          );
          const syncedRoomNumbers =
            syncedStayBill.folio.roomNumbers.length > 0
              ? syncedStayBill.folio.roomNumbers
              : [allocatedRoomNumber || existingInv.roomNumber];
          const syncedInv = {
            ...existingInv,
            ...(buildInvoiceRecord({
              id: existingInv.id,
              invoiceNumber: existingInv.invoiceNumber,
              hotelId: existingInv.hotelId || hotelSettings?.id,
              bookingId: finalBooking.id,
              guestName: finalBooking.guestName,
              guestMobile: finalBooking.mobile,
              guestAddress: finalBooking.address,
              companyName: finalBooking.companyName,
              guestGstNumber: finalBooking.gstNumber,
              roomNumbers: syncedRoomNumbers,
              checkInDate,
              checkOutDate,
              nights: syncedNights,
              bill: syncedStayBill.bill,
              paymentMethod: finalBooking.paymentMethod,
              dateCreated: existingInv.dateCreated,
              invoiceStatus: existingInv.invoiceStatus || 'Generated',
              extra: {
                nationality: finalBooking.nationality,
                voucherNumber: finalBooking.voucherNumber,
                invoiceType: existingInv.invoiceType,
                notes: existingInv.notes,
              },
            }) as Invoice),
          };
          onUpdateInvoices(invoices.map(inv => inv.id === existingInv.id ? syncedInv : inv));
        }
      }

      // Update room reservation statuses ONLY when checkInDate === today (future bookings do NOT block today's rack)
      const prevRoomNums = String(editingBooking.roomNumber || '').split(',').map(s => s.trim()).filter(Boolean);
      const nextRoomNums = String(allocatedRoomNumber || '').split(',').map(s => s.trim()).filter(Boolean);
      const updatedRooms = rooms.map(r => {
        if (prevRoomNums.includes(r.number) && !nextRoomNums.includes(r.number) && r.status === 'Reserved') {
          return { ...r, status: 'Available' as const };
        }
        if (nextRoomNums.includes(r.number) && autoStatus !== 'Cancelled' && checkInDate === getTodayDateStr() && r.status === 'Available') {
          return { ...r, status: 'Reserved' as const };
        }
        if (nextRoomNums.includes(r.number) && (autoStatus === 'Cancelled' || checkInDate > getTodayDateStr()) && r.status === 'Reserved') {
          return { ...r, status: 'Available' as const };
        }
        return r;
      });
      onUpdateRooms(updatedRooms);

      if (onAddAuditLog) {
        const stayDatesLabel = checkOutDate ? `${checkInDate} to ${checkOutDate}` : `${checkInDate} (Open Stay)`;
        onAddAuditLog('Reservation Updated', `Updated reservation ${finalBooking.id} for ${finalBooking.guestName} (Room ${allocatedRoomNumber}, ${stayDatesLabel}).`);
      }
    } else {
      let allocatedRoomNumber = selectedRoomNumber;
      const stayDatesLabel = checkOutDate ? `${checkInDate} to ${checkOutDate}` : `${checkInDate} (Open Stay)`;
      if (resolvedBookedRooms && resolvedBookedRooms.length > 0) {
        for (const br of resolvedBookedRooms) {
          const chosenRoom = rooms.find(r => r.number === br.roomNumber);
          if (!chosenRoom || !isRoomAvailableForReservation(chosenRoom, checkInDate, checkOutDate)) {
            setFormError(`Room ${br.roomNumber} is already booked or occupied for ${stayDatesLabel}. Please deselect it.`);
            return;
          }
        }
        allocatedRoomNumber = resolvedBookedRooms.map(r => r.roomNumber).join(', ');
      } else if (allocatedRoomNumber) {
        const chosenRoom = rooms.find(r => String(r.number).toLowerCase() === String(allocatedRoomNumber).toLowerCase());
        if (!chosenRoom) {
          setFormError(`Room "${allocatedRoomNumber}" does not exist. Please type a valid room number or leave it blank for auto-allocation.`);
          return;
        }
        allocatedRoomNumber = String(chosenRoom.number);
        if (!isRoomAvailableForReservation(chosenRoom, checkInDate, checkOutDate)) {
          setFormError(`Room ${allocatedRoomNumber} is already booked or occupied for ${stayDatesLabel}. Please choose an available room.`);
          return;
        }
      } else {
        const suitableRoom = findAvailableRoomForDates(roomType, checkInDate, checkOutDate);
        if (!suitableRoom) {
          setFormError(`All ${roomType} rooms are already booked or occupied for ${stayDatesLabel}. Please select another room category or date range.`);
          return;
        }
        allocatedRoomNumber = suitableRoom.number;
      }

      const allIdPool = new Set([
        ...bookings.map(b => String(b.id || '')),
        ...(invoices || []).map(inv => String(inv.bookingId || ''))
      ]);
      const tsSuffix = Number(String(Date.now()).slice(-6));
      let candidateNum = Math.max(1001, tsSuffix);
      while (allIdPool.has(`GP-BKG-${candidateNum}`)) {
        candidateNum += 1;
      }
      const trimmedCustomId = customBookingId.trim();
      const newBkgId = trimmedCustomId && !allIdPool.has(trimmedCustomId) ? trimmedCustomId : `GP-BKG-${candidateNum}`;

      finalBooking = {
        id: newBkgId,
        guestName: guestName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        aadhaarNumber: aadhaarNumber.trim(),
        address: address.trim(),
        nationality: nationality.trim() || 'Indian',
        companyName: companyName.trim() || undefined,
        gstNumber: gstNumber.trim().toUpperCase() || undefined,
        purposeOfVisit: purposeOfVisit || undefined,
        checkInDate,
        checkOutDate: checkOutDate || '',
        checkInTime,
        checkOutTime: checkOutTime || '',
        isHourlyStay: Boolean(checkOutDate && checkInDate === checkOutDate),
        stayHours: (checkOutDate && checkInDate === checkOutDate && stayHours !== '') ? Number(stayHours) : undefined,
        isEarlyCheckIn: earlyCheckInInfo.isEarly,
        earlyCheckInHours: earlyCheckInInfo.hoursEarly,
        earlyCheckInCharge: earlyCheckInFee,
        isBackDated: checkInDate < getTodayDateStr(),
        actualLoggedAt: new Date().toISOString(),
        nights: nightsCount,
        adults: Number(adults) || 2,
        children: Number(children) || 0,
        maleCount: Number(maleCount) || 0,
        femaleCount: Number(femaleCount) || 0,
        childCount: Number(childCount) || 0,
        mealPlan,
        occupancyType,
        singleRate,
        doubleRate,
        hasExtraBed: totalExtraBedsFromMulti > 0,
        extraBedCount: totalExtraBedsFromMulti > 0 ? totalExtraBedsFromMulti : undefined,
        extraBedRate: hasExtraBed ? extraBedRate : resolvedBookedRooms?.[0]?.extraBedRate,
        roomNumber: allocatedRoomNumber,
        roomType: resolvedBookedRooms ? (((resolvedBookedRooms[0] as any).roomType || resolvedBookedRooms[0].category || roomType) as RoomCategory) : roomType,
        bookedRooms: resolvedBookedRooms,
        isGroupCheckIn: Boolean(resolvedBookedRooms && resolvedBookedRooms.length > 1),
        advanceAmount,
        paymentMethod: effectiveAdvPaymentMethod,
        payments: buildAdvancePaymentItems(newBkgId),
        voucherNumber: voucherNumber.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
        bookingSource,
        status: advanceAmount > 0 ? 'Confirmed' : 'In Process',
        notes: notes.trim() || 'Advance Booking',
        isCheckedIn: false,
        bookingAmount: bookingPrice,
        extraPersonChargeApplied: singleModeExtraPaxPerNight * Math.max(1, nightsCount),
        gstRate: bookingGstMode === 'non_gst' ? 0 : bookingGstRate,
        gstAmount: calculatedBookingGst,
        isWithoutGst: bookingGstMode === 'non_gst' || bookingGstRate <= 0,
        gstInvoice: bookingGstMode !== 'non_gst' && bookingGstRate > 0,
        roomRateIncludesGst: bookingGstMode === 'including_gst',
        bookedServices: bookedServicesPayload,
        travelAgentId: selectedAgentId || undefined,
        travelAgentName: selectedAgentObj ? `${selectedAgentObj.name}${selectedAgentObj.agencyName ? ` (${selectedAgentObj.agencyName})` : ''}` : undefined,
        commissionType: selectedAgentId ? commissionType : undefined,
        commissionValue: selectedAgentId ? commissionValue : undefined,
        commissionAmount: selectedAgentId ? effectiveCommissionAmount : undefined,
        paymentStatus: advanceAmount >= totalPayableWithGst ? 'Fully Paid' : (advanceAmount > 0 ? 'Partially Paid' : 'Unpaid'),
        bookingDate: bookingDateInput || getTodayDateStr(),
      };

      updatedBookings = [...bookings, finalBooking];

      if (checkInDate === getTodayDateStr() && finalBooking.status !== 'Cancelled') {
        const allocatedNums = allocatedRoomNumber.split(',').map(s => s.trim()).filter(Boolean);
        const updatedRooms = rooms.map(r => allocatedNums.includes(r.number) && r.status === 'Available' ? { ...r, status: 'Reserved' as const } : r);
        onUpdateRooms(updatedRooms);
      }
      if (onAddAuditLog) {
        onAddAuditLog('Reservation Created', `Created reservation ${finalBooking.id} for ${finalBooking.guestName} (Room ${allocatedRoomNumber}, ${checkInDate} to ${checkOutDate}).`);
      }
    }

    onUpdateBookings(updatedBookings);

    if (isValidEmailAddress(finalBooking.email)) {
      void triggerBookingEmail(finalBooking, {
        hotelId: finalBooking.hotelId || hotelSettings?.id,
        hotelName: hotelSettings?.name || 'DirectStay Hotel',
        eventType: editingBooking ? 'booking_updated' : 'booking_confirmation',
      });
    }

    setSavedBooking(finalBooking);
    setShowWhatsAppModal(true);

    handleCloseForm();
  };

  const handleSendBookingEmailAction = async (
    bk: Booking,
    eventType: BookingEmailEventType = 'booking_confirmation',
    forceResend = true
  ) => {
    if (!isValidEmailAddress(bk.email)) {
      showToast('Please add a valid guest email address in Edit Reservation before sending email.', 'warning');
      return;
    }
    const res = await triggerBookingEmail(bk, {
      hotelId: bk.hotelId || hotelSettings?.id,
      hotelName: hotelSettings?.name || 'DirectStay Hotel',
      eventType,
      forceResend,
    });
    if (res.success) {
      const modeLabel = res.delivered
        ? `Booking email delivered to ${bk.email}`
        : `Booking email logged (${res.dryRun ? 'Safe Dry-Run' : res.status}) for ${bk.email}`;
      showToast(modeLabel, 'success');
      onAddAuditLog?.(
        'Booking Email Dispatched',
        `${modeLabel} for Booking #${bk.id} (${bk.guestName}).`
      );
    } else {
      showToast(res.error || 'Failed to dispatch booking email.', 'error');
    }
  };

  const handleCancelReservation = (id: string, _name: string) => {
    const bk = bookings.find(b => b.id === id);
    if (!bk) return;
    setCancellingBooking(bk);
    setRefundAmountInput(Number(bk.advanceAmount || 0));
    setRefundModeInput(bk.paymentMethod || 'UPI');
    setRefundRefInput(`REF-${Date.now().toString().slice(-6)}`);
    setCancelReasonInput('Guest requested cancellation');
  };

  const handleConfirmCancelAndRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBooking) return;
    const id = cancellingBooking.id;
    const name = cancellingBooking.guestName;
    const cleanRefund = Math.max(0, Number(refundAmountInput) || 0);
    const todayStr = getTodayDateStr();

    const updatedBooking: Booking = {
      ...cancellingBooking,
      status: 'Cancelled',
      paymentStatus: cleanRefund > 0 ? 'Refunded' : cancellingBooking.paymentStatus,
      refundAmount: cleanRefund,
      refundMode: cleanRefund > 0 ? refundModeInput : undefined,
      refundReference: cleanRefund > 0 ? refundRefInput.trim() : undefined,
      refundDate: cleanRefund > 0 ? todayStr : undefined,
      cancellationReason: cancelReasonInput.trim() || 'Cancelled',
      notes: `${cancellingBooking.notes ? cancellingBooking.notes + ' • ' : ''}Cancelled (${cancelReasonInput.trim() || 'Guest request'})${cleanRefund > 0 ? ` • Refunded ₹${cleanRefund} via ${refundModeInput} (${refundRefInput.trim()})` : ''}`
    };

    const updatedList = bookings.map(b => b.id === id ? updatedBooking : b);
    onUpdateBookings(updatedList);

    if (onUpdateInvoices && invoices) {
      const linkedInv = invoices.find(inv => inv.bookingId === id);
      if (linkedInv) {
        const updatedInv: Invoice = {
          ...linkedInv,
          paymentStatus: cleanRefund > 0 ? 'Refunded' : 'Cancelled',
          isPaid: false,
          pendingAmount: 0,
          refundAmount: cleanRefund,
          refundMode: cleanRefund > 0 ? refundModeInput : undefined,
          refundDate: cleanRefund > 0 ? todayStr : undefined,
          notes: `${linkedInv.notes || ''} • Booking Cancelled${cleanRefund > 0 ? ` & Refunded ₹${cleanRefund} via ${refundModeInput}` : ''}`
        };
        onUpdateInvoices(invoices.map(inv => inv.id === linkedInv.id ? updatedInv : inv));
      }
    }

    const cancelledRooms = getReservationRoomNumbers(cancellingBooking);
    if (cancelledRooms.length > 0) {
      const updatedRooms = rooms.map(r => {
        if (!cancelledRooms.includes(String(r.number).trim())) return r;
        const stillReservedToday = updatedList.some(
          b =>
            b.id !== id &&
            resolveCanonicalStatus(b, undefined, todayStr) !== 'Cancelled' &&
            resolveCanonicalStatus(b, undefined, todayStr) !== 'No-Show' &&
            resolveCanonicalStatus(b, undefined, todayStr) !== 'Checked-Out' &&
            getReservationRoomNumbers(b).includes(String(r.number).trim()) &&
            b.checkInDate <= todayStr &&
            (b.checkOutDate || getFutureDateStr(1, b.checkInDate)) > todayStr
        );
        if (!stillReservedToday && r.status === 'Reserved') {
          return { ...r, status: 'Available' as const };
        }
        return r;
      });
      onUpdateRooms(updatedRooms);
    }
    if (onAddAuditLog) {
      onAddAuditLog(
        cleanRefund > 0 ? 'Booking Cancelled & Refunded' : 'Reservation Cancelled',
        `Cancelled reservation ${id} for ${name}.${cleanRefund > 0 ? ` Refunded ₹${cleanRefund.toLocaleString('en-IN')} via ${refundModeInput} (Ref: ${refundRefInput.trim()}).` : ''}`
      );
    }
    if (isValidEmailAddress(updatedBooking.email)) {
      void triggerBookingEmail(updatedBooking, {
        hotelId: updatedBooking.hotelId || hotelSettings?.id,
        hotelName: hotelSettings?.name || 'DirectStay Hotel',
        eventType: 'booking_cancelled',
      });
    }
    setCancellingBooking(null);
  };

  const handleMarkPaymentFailed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentIssueBooking) return;
    const reason = paymentFailureReasonInput.trim() || 'Online / UPI Payment Declined';
    const updatedBooking: Booking = {
      ...paymentIssueBooking,
      paymentStatus: 'Payment Failed',
      paymentFailureReason: reason,
      notes: `${paymentIssueBooking.notes ? paymentIssueBooking.notes + ' • ' : ''}[Payment Failed: ${reason}]`
    };
    onUpdateBookings(bookings.map(b => b.id === paymentIssueBooking.id ? updatedBooking : b));

    if (onUpdateInvoices && invoices) {
      const linkedInv = invoices.find(inv => inv.bookingId === paymentIssueBooking.id);
      if (linkedInv) {
        onUpdateInvoices(
          invoices.map(inv =>
            inv.id === linkedInv.id
              ? { ...inv, paymentStatus: 'Payment Failed', isPaid: false, paymentFailureReason: reason }
              : inv
          )
        );
      }
    }
    onAddAuditLog?.(
      'Payment Failure Logged',
      `Marked payment as Failed for Booking ${paymentIssueBooking.id} (${paymentIssueBooking.guestName}). Reason: ${reason}`
    );
    setPaymentIssueBooking(null);
  };

  const handleRetryClearPaymentFailure = (bk: Booking) => {
    const totalBookingAmt = Number(bk.bookingAmount || 0) + Number(bk.gstAmount || 0);
    const adv = Number(bk.advanceAmount || 0);
    const restoredStatus: Booking['paymentStatus'] =
      adv >= totalBookingAmt && totalBookingAmt > 0 ? 'Fully Paid' : adv > 0 ? 'Partially Paid' : 'Unpaid';
    const updatedBooking: Booking = {
      ...bk,
      paymentStatus: restoredStatus,
      paymentFailureReason: undefined
    };
    onUpdateBookings(bookings.map(b => b.id === bk.id ? updatedBooking : b));
    onAddAuditLog?.(
      'Payment Failure Cleared',
      `Cleared payment failure status for Booking ${bk.id} (${bk.guestName}) -> ${restoredStatus}.`
    );
  };

  const handleApprovePendingBooking = (bk: Booking) => {
    const approved: Booking = {
      ...bk,
      status: 'Confirmed',
      notes: `${bk.notes ? bk.notes.replace('[Direct Guest Booking Link • Needs Hotel Approval]', '[Approved by Hotel]') : 'Approved by Hotel'}`
    };
    const updatedList = bookings.map(b => (b.id === bk.id ? approved : b));
    onUpdateBookings(updatedList);

    const todayStr = getTodayDateStr();
    if (bk.roomNumber && bk.checkInDate <= todayStr && bk.checkOutDate > todayStr) {
      onUpdateRooms(
        rooms.map(r => (r.number === bk.roomNumber && r.status === 'Available' ? { ...r, status: 'Reserved' as const } : r))
      );
    }
    onAddAuditLog?.(
      'Guest Booking Approved',
      `Approved direct guest booking ${bk.id} for ${bk.guestName} (Room ${bk.roomNumber}, ${bk.checkInDate} to ${bk.checkOutDate}).`
    );
  };

  const handleRejectPendingBooking = (bk: Booking) => {
    const rejected: Booking = {
      ...bk,
      status: 'Cancelled',
      cancellationReason: 'Rejected by Hotel',
      notes: `${bk.notes ? bk.notes + ' • ' : ''}Rejected by Hotel`
    };
    onUpdateBookings(bookings.map(b => (b.id === bk.id ? rejected : b)));
    onAddAuditLog?.(
      'Guest Booking Rejected',
      `Rejected direct guest booking ${bk.id} for ${bk.guestName} (Room ${bk.roomNumber}).`
    );
  };

  const pendingApprovalBookings = bookings.filter(b => b.status === 'Pending');

  const handleQuickConfirmStatus = (bk: Booking) => {
    const calcComm = bk.travelAgentId
      ? bk.commissionType === 'percentage'
        ? Math.round((Math.max(0, Number(bk.bookingAmount) || 0) * Math.max(0, Number(bk.commissionValue) || 0)) / 100)
        : Math.round(Math.max(0, Number(bk.commissionValue) || 0))
      : undefined;
    const confirmed: Booking = {
      ...bk,
      status: 'Confirmed',
      commissionAmount: bk.travelAgentId ? calcComm : bk.commissionAmount,
    };
    onUpdateBookings(bookings.map(b => (b.id === bk.id ? confirmed : b)));
    const todayStr = getTodayDateStr();
    if (bk.roomNumber && bk.checkInDate <= todayStr && (!bk.checkOutDate || bk.checkOutDate > todayStr)) {
      const rNums = bk.roomNumber.split(',').map(s => s.trim()).filter(Boolean);
      onUpdateRooms(rooms.map(r => (rNums.includes(r.number) && r.status === 'Available' ? { ...r, status: 'Reserved' as const } : r)));
    }
    showToast(`Booking ${bk.id} marked as Confirmed!`, 'success');
    onAddAuditLog?.('Booking Confirmed', `Confirmed reservation ${bk.id} for ${bk.guestName}.`);
  };

  // ==================== REDESIGNED RESERVATIONS LIST STATE & ACTIONS ====================
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'grid'>('list');
  const [segmentFilter, setSegmentFilter] = useState<'All' | ReservationSegment>(() => {
    try {
      const savedSeg = sessionStorage.getItem('pms_reservation_segment');
      if (savedSeg) {
        sessionStorage.removeItem('pms_reservation_segment');
        return savedSeg as 'All' | ReservationSegment;
      }
    } catch {}
    return 'All';
  });

  useEffect(() => {
    const handleSidebarReservationNav = (evt: Event) => {
      const detail = (evt as CustomEvent)?.detail;
      if (detail?.segment) {
        setSegmentFilter(detail.segment as 'All' | ReservationSegment);
        if (detail.segment === 'Group') {
          setIsMultiRoomMode(true);
          setNumberOfRooms((prev) => Math.max(2, prev));
        }
      }
      if (detail?.openModal) {
        setEditingBooking(null);
        setIsFormOpen(true);
        setFormStep(1);
      }
    };
    window.addEventListener('directstay:reservation-nav', handleSidebarReservationNav);
    return () => window.removeEventListener('directstay:reservation-nav', handleSidebarReservationNav);
  }, []);
  const [sortBy, setSortBy] = useState<'booked_desc' | 'checkin_asc' | 'checkin_desc' | 'guest_asc' | 'amount_desc' | 'status'>('booked_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [showDatePopover, setShowDatePopover] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const datePopoverRef = useRef<HTMLDivElement | null>(null);

  // Action Modals State
  const [viewingReservationItem, setViewingReservationItem] = useState<EnrichedReservationItem | null>(null);
  const [roomChangeTarget, setRoomChangeTarget] = useState<EnrichedReservationItem | null>(null);
  const [roomChangeSelection, setRoomChangeSelection] = useState<string[]>([]);
  const [roomChangeReason, setRoomChangeReason] = useState('Guest room reassignment request');
  const [roomChangeError, setRoomChangeError] = useState('');

  const [paymentModalTarget, setPaymentModalTarget] = useState<EnrichedReservationItem | null>(null);
  const [payCollectAmount, setPayCollectAmount] = useState<number>(0);
  const [payCollectMethod, setPayCollectMethod] = useState<PaymentMethod>('Cash');
  const [payCollectRef, setPayCollectRef] = useState('');
  const [payCollectNotes, setPayCollectNotes] = useState('');
  const [isPayHybrid, setIsPayHybrid] = useState(false);
  const [paySplit1Mode, setPaySplit1Mode] = useState<PaymentMethod>('Cash');
  const [paySplit1Amt, setPaySplit1Amt] = useState<number>(0);
  const [paySplit2Mode, setPaySplit2Mode] = useState<PaymentMethod>('UPI');
  const [paySplit2Amt, setPaySplit2Amt] = useState<number>(0);
  const [paySplit2Ref, setPaySplit2Ref] = useState('');

  const [noShowModalTarget, setNoShowModalTarget] = useState<EnrichedReservationItem | null>(null);
  const [noShowReasonInput, setNoShowReasonInput] = useState('Guest failed to arrive before cut-off time');

  const [checkoutModalTarget, setCheckoutModalTarget] = useState<EnrichedReservationItem | null>(null);
  const [checkoutSettleAmount, setCheckoutSettleAmount] = useState<number>(0);
  const [checkoutSettleMethod, setCheckoutSettleMethod] = useState<PaymentMethod>('Cash');
  const [checkoutSettleRef, setCheckoutSettleRef] = useState('');

  const [dirtyOverrideTarget, setDirtyOverrideTarget] = useState<{
    item: EnrichedReservationItem;
    dirtyRooms: Room[];
  } | null>(null);
  const [dirtyOverrideReason, setDirtyOverrideReason] = useState('VIP early arrival — inspected & approved by Duty Manager');

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-res-action-menu]')) {
        setOpenMenuId(null);
      }
      if (datePopoverRef.current && target && !datePopoverRef.current.contains(target)) {
        setShowDatePopover(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sourceFilter, segmentFilter, statusFilter, dateFilterType, filterSingleDate, filterStartDate, filterEndDate, sortBy, rowsPerPage]);

  const enrichedReservations: EnrichedReservationItem[] = useMemo(() => {
    const todayStr = getTodayDateStr();
    const merged = mergeBookingsAndStandaloneWalkIns(bookings, checkins, rooms);
    const defaultInTime = hotelSettings?.checkInTime || '12:00 PM';
    const defaultOutTime = hotelSettings?.checkOutTime || '11:00 AM';

    return merged.map(({ booking: bk, linkedCheckin, isStandaloneCheckin }) => {
      const canonicalStatus = resolveCanonicalStatus(bk, linkedCheckin, todayStr);
      const { primarySegment, segments } = resolveReservationSegments(bk);
      const roomSummary = getReservationRoomSummary(bk, rooms);
      const adultsCount = Math.max(1, Number(bk.adults) || 1);
      const childrenCount = Math.max(0, Number(bk.children) || 0);
      const paxTotal = adultsCount + childrenCount;
      const paxLabel =
        childrenCount > 0
          ? `${paxTotal} Pax (${adultsCount}A, ${childrenCount}C)`
          : `${paxTotal} Pax (${adultsCount}A)`;

      const { nightsCount, durationHoursLabel } = computeStayDurationInfo(
        bk,
        defaultInTime,
        defaultOutTime
      );

      const rawBookedDate =
        bk.bookingDate ||
        (bk.createdAt ? String(bk.createdAt).slice(0, 10) : '') ||
        bk.checkInDate ||
        todayStr;
      const firstPayTime = Array.isArray(bk.payments) && bk.payments[0]?.time ? String(bk.payments[0].time) : '';
      const createdTime =
        bk.createdAt && bk.createdAt.includes('T')
          ? new Date(bk.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : firstPayTime || formatDisplayTime12h(bk.checkInTime, '12:00 PM');

      const linkedInvoice = invoices.find(
        inv =>
          !inv.isSeparateInvoice &&
          !(inv as any).isSuperseded &&
          (inv.bookingId === bk.id || (linkedCheckin && inv.bookingId === linkedCheckin.id))
      );

      const financials = computeReservationFinancials({
        booking: bk,
        linkedCheckin,
        invoices,
        posOrders,
        waterBottles,
        rooms,
        billSettings,
        configuredDefaultGst,
      });

      return {
        booking: bk,
        linkedCheckin,
        linkedInvoice,
        isStandaloneCheckin,
        canonicalStatus,
        primarySegment,
        segments,
        roomNumbers: roomSummary.roomNumbers,
        roomCount: roomSummary.roomCount,
        displayRoomsLabel: roomSummary.displayRoomsLabel,
        categoryLabel: roomSummary.categoryLabel,
        paxTotal,
        adultsCount,
        childrenCount,
        paxLabel,
        nightsCount,
        durationHoursLabel,
        bookedOnDate: formatShortHumanDate(rawBookedDate),
        bookedOnTime: createdTime,
        financials,
      };
    });
  }, [bookings, checkins, rooms, invoices, posOrders, waterBottles, billSettings, configuredDefaultGst, hotelSettings]);

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayStr = getTodayDateStr();
    const yesterdayStr = getFutureDateStr(-1);
    const thisMonthPrefix = todayStr.slice(0, 7);

    const list = enrichedReservations.filter(item => {
      // Reservations List shows ONLY actual reservations (Draft, Confirmed, Upcoming, Cancelled, No-Show).
      // Once checked in or checked out, stays move cleanly to In-House Guest / Checked Out Rooms.
      if (
        item.isStandaloneCheckin ||
        item.canonicalStatus === 'Checked-In' ||
        item.canonicalStatus === 'Checked-Out'
      ) {
        return false;
      }
      const bk = item.booking;
      const matchesSearch =
        !q ||
        bk.guestName.toLowerCase().includes(q) ||
        String(bk.mobile || '').toLowerCase().includes(q) ||
        bk.id.toLowerCase().includes(q) ||
        item.roomNumbers.some(r => r.toLowerCase().includes(q)) ||
        String(bk.roomNumber || '').toLowerCase().includes(q) ||
        String(bk.companyName || '').toLowerCase().includes(q) ||
        String(bk.groupName || '').toLowerCase().includes(q) ||
        String(bk.travelAgentName || '').toLowerCase().includes(q) ||
        String(bk.voucherNumber || '').toLowerCase().includes(q);

      const matchesSegment =
        segmentFilter === 'All' ? true : item.segments.includes(segmentFilter);

      const matchesSource =
        sourceFilter === 'All'
          ? true
          : sourceFilter === 'OTA'
          ? OTA_BOOKING_SOURCES.includes(bk.bookingSource)
          : sourceFilter === 'Direct'
          ? ['Direct', 'Walk-in', 'Phone', 'Website'].includes(bk.bookingSource)
          : bk.bookingSource === sourceFilter;

      const matchesStatus =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Pending'
          ? bk.status === 'Pending'
          : item.canonicalStatus === statusFilter;

      let matchesDate = true;
      const inDate = String(bk.checkInDate || '').slice(0, 10);
      const outDate = String(bk.checkOutDate || inDate).slice(0, 10);
      if (dateFilterType === 'Today') {
        matchesDate = inDate === todayStr;
      } else if (dateFilterType === 'Yesterday') {
        matchesDate = inDate === yesterdayStr;
      } else if (dateFilterType === 'Date') {
        matchesDate = inDate === filterSingleDate;
      } else if (dateFilterType === 'This Month') {
        matchesDate = inDate.startsWith(thisMonthPrefix);
      } else if (dateFilterType === 'Range') {
        const fromOk = !filterStartDate || outDate >= filterStartDate || inDate >= filterStartDate;
        const toOk = !filterEndDate || inDate <= filterEndDate;
        matchesDate = fromOk && toOk;
      }

      return matchesSearch && matchesSegment && matchesSource && matchesStatus && matchesDate;
    });

    const statusOrder: Record<CanonicalReservationStatus, number> = {
      'Checked-In': 1,
      Confirmed: 2,
      Upcoming: 3,
      Draft: 4,
      'Checked-Out': 5,
      'No-Show': 6,
      Cancelled: 7,
    };

    return [...list].sort((a, b) => {
      if (sortBy === 'checkin_asc') {
        return String(a.booking.checkInDate || '').localeCompare(String(b.booking.checkInDate || ''));
      }
      if (sortBy === 'checkin_desc') {
        return String(b.booking.checkInDate || '').localeCompare(String(a.booking.checkInDate || ''));
      }
      if (sortBy === 'guest_asc') {
        return String(a.booking.guestName || '').localeCompare(String(b.booking.guestName || ''));
      }
      if (sortBy === 'amount_desc') {
        return b.financials.totalPayable - a.financials.totalPayable;
      }
      if (sortBy === 'status') {
        return (statusOrder[a.canonicalStatus] || 99) - (statusOrder[b.canonicalStatus] || 99);
      }
      const aBook = String(a.booking.bookingDate || a.booking.checkInDate || '');
      const bBook = String(b.booking.bookingDate || b.booking.checkInDate || '');
      if (bBook !== aBook) return bBook.localeCompare(aBook);
      return String(b.booking.id).localeCompare(String(a.booking.id));
    });
  }, [enrichedReservations, search, segmentFilter, sourceFilter, statusFilter, dateFilterType, filterSingleDate, filterStartDate, filterEndDate, sortBy]);

  const totalItems = filteredReservations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const paginatedReservations = filteredReservations.slice(startIdx, startIdx + rowsPerPage);

  const activeViewingItem = useMemo(() => {
    if (!viewingReservationItem) return null;
    return (
      enrichedReservations.find(i => i.booking.id === viewingReservationItem.booking.id) ||
      viewingReservationItem
    );
  }, [viewingReservationItem, enrichedReservations]);

  // ==================== EXPORT, PRINT & BLANK GRC HANDLERS ====================
  const handleExportExcel = () => {
    if (filteredReservations.length === 0) {
      showToast('No reservations match the current filters to export.', 'warning');
      return;
    }
    const csv = buildReservationsCsv(filteredReservations);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DirectStay_Reservations_${getTodayDateStr()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredReservations.length} reservation(s) to Excel CSV.`, 'success');
  };

  const handlePrintBlankGrc = () => {
    const d = new Date();
    const formattedToday = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const html = renderGrcHtml({
      hotel: {
        name: hotelSettings?.name || 'DirectStay Hotel',
        address: hotelSettings?.address || '',
        phone: hotelSettings?.phone || hotelSettings?.contactPhone || '',
        email: hotelSettings?.email || '',
        gstNumber: hotelSettings?.gstNumber || '',
        logoUrl: hotelSettings?.logoUrl || hotelSettings?.logo || '',
      },
      regNo: '____________________',
      date: formattedToday,
      guestName: '',
      address: '',
      city: '',
      state: '',
      nationality: '',
      mobile: '',
      adults: '____',
      children: '____',
      arrival: '____________________',
      departure: '____________________',
      roomNo: '________',
      roomType: '________________',
      roomCharge: '________',
      planName: '________',
      taxMode: '________',
      bookingNo: '________________',
      company: '',
      voucherNo: '',
      guestIdType: '',
      guestIdNumber: '',
      checkInTime: hotelSettings?.checkInTime || '12:00 PM',
      checkOutTime: hotelSettings?.checkOutTime || '11:00 AM',
    });
    openPrintWindow(html);
  };

  const handlePrintFilledGrc = (item: EnrichedReservationItem) => {
    const grcData = toGrcPrintData({
      hotel: hotelSettings || {},
      regNo: `GRC/${item.booking.id}`,
      booking: item.booking,
      checkin: item.linkedCheckin || undefined,
      settings: billSettings,
    });
    const html = renderGrcHtml(grcData);
    openPrintWindow(html);
  };

  const handlePrintReservationsList = () => {
    const rowsHtml = filteredReservations
      .map(
        (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${item.booking.id}</strong><br/><span style="color:#666;font-size:10px">${item.primarySegment}</span></td>
          <td><strong>${item.booking.guestName}</strong><br/>${item.booking.mobile || '-'} (${item.paxLabel})</td>
          <td><strong>${item.displayRoomsLabel}</strong><br/><span style="color:#555;font-size:10px">${item.categoryLabel}</span></td>
          <td>${formatShortHumanDate(item.booking.checkInDate)} ${formatDisplayTime12h(item.booking.checkInTime, '12:00 PM')}<br/>→ ${formatShortHumanDate(item.booking.checkOutDate)} (${item.nightsCount}N)</td>
          <td>${item.booking.bookingSource}</td>
          <td>${item.bookedOnDate}</td>
          <td style="text-align:right">₹${item.financials.totalPayable.toLocaleString('en-IN')}</td>
          <td style="text-align:right;color:#047857">₹${item.financials.receivedAmount.toLocaleString('en-IN')}</td>
          <td style="text-align:right;color:#b91c1c">₹${item.financials.pendingAmount.toLocaleString('en-IN')}</td>
          <td><strong>${item.canonicalStatus}</strong></td>
        </tr>`
      )
      .join('');

    const sumTotal = filteredReservations.reduce((s, i) => s + i.financials.totalPayable, 0);
    const sumReceived = filteredReservations.reduce((s, i) => s + i.financials.receivedAmount, 0);
    const sumPending = filteredReservations.reduce((s, i) => s + i.financials.pendingAmount, 0);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Reservations Register</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; color: #1e293b; font-size: 11px; margin: 0; }
        .hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1E1610; padding-bottom: 8px; margin-bottom: 12px; }
        .kpi { display: flex; gap: 18px; background: #FBF4E0; border: 1px solid #C49A3A; padding: 8px 14px; border-radius: 8px; margin-bottom: 12px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1E1610; color: #FBF4E0; text-align: left; padding: 7px 6px; font-size: 10px; text-transform: uppercase; }
        td { border-bottom: 1px solid #e2e8f0; padding: 6px; vertical-align: top; }
      </style></head><body>
      <div class="hdr">
        <div>
          <h2 style="margin:0;font-size:18px;color:#1E1610">${hotelSettings?.name || 'DirectStay PMS'} — Reservations List</h2>
          <div style="color:#64748b;margin-top:2px">Printed on ${new Date().toLocaleString('en-IN')} • Showing ${filteredReservations.length} reservation(s)</div>
        </div>
        <div style="text-align:right;font-size:11px">Status Filter: <strong>${statusFilter}</strong> | Segment: <strong>${segmentFilter}</strong></div>
      </div>
      <div class="kpi">
        <span>Total Reservations: ${filteredReservations.length}</span>
        <span>Total Folio Value: ₹${sumTotal.toLocaleString('en-IN')}</span>
        <span style="color:#047857">Total Received: ₹${sumReceived.toLocaleString('en-IN')}</span>
        <span style="color:#b91c1c">Total Pending: ₹${sumPending.toLocaleString('en-IN')}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Booking ID</th><th>Guest & Contact</th><th>Rooms</th><th>Check-In → Check-Out</th><th>Source</th><th>Booked On</th><th style="text-align:right">Total</th><th style="text-align:right">Received</th><th style="text-align:right">Pending</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="11" style="text-align:center;padding:20px">No reservations found.</td></tr>'}</tbody>
      </table>
    </body></html>`;
    openPrintWindow(html);
  };

  // ==================== OPERATIONAL ACTION HANDLERS ====================
  const executeCheckInWithHousekeepingGuard = (item: EnrichedReservationItem, bypassDirty = false, overrideNote = '') => {
    if (!canPerformReservationAction('checkIn', item.canonicalStatus, currentRole)) {
      showToast(`Cannot check in a ${item.canonicalStatus} reservation.`, 'error');
      return;
    }
    if (!onCheckIn) {
      showToast('Check-in flow is unavailable on this screen.', 'warning');
      return;
    }

    const assignedRooms = item.roomNumbers
      .map(rn => rooms.find(r => String(r.number).trim() === rn))
      .filter(Boolean) as Room[];

    const outOfOrderRoom = assignedRooms.find(
      r => r.status === 'Out of Order' || r.status === 'Maintenance' || r.status === 'Blocked' || r.status === 'Out of Service'
    );
    if (outOfOrderRoom) {
      showToast(
        `Room ${outOfOrderRoom.number} is ${outOfOrderRoom.status}. Please reassign the room before Check-In.`,
        'error'
      );
      return;
    }

    const dirtyRooms = assignedRooms.filter(
      r =>
        r.status === 'Dirty' ||
        r.cleaningStatus === 'Dirty' ||
        r.cleaningStatus === 'In Progress' ||
        r.cleaningStatus === 'Inspection'
    );

    if (dirtyRooms.length > 0 && !bypassDirty) {
      setDirtyOverrideTarget({ item, dirtyRooms });
      return;
    }

    if (dirtyRooms.length > 0 && bypassDirty) {
      onAddAuditLog?.(
        'Dirty Room Check-In Override',
        `Authorised check-in override for ${item.booking.guestName} (#${item.booking.id}) on room(s) ${dirtyRooms.map(d => d.number).join(', ')} by ${loggedInUser || currentRole}. Reason: ${overrideNote}`
      );
    }

    setDirtyOverrideTarget(null);
    onCheckIn(item.booking);
  };

  const handleOpenCheckOutAction = (item: EnrichedReservationItem) => {
    if (!canPerformReservationAction('checkOut', item.canonicalStatus, currentRole)) {
      showToast('Only Checked-In reservations can be checked out.', 'warning');
      return;
    }
    if (onCheckOut) {
      onCheckOut(item.booking);
      return;
    }
    setCheckoutModalTarget(item);
    setCheckoutSettleAmount(item.financials.pendingAmount);
    setCheckoutSettleMethod(item.booking.paymentMethod || 'Cash');
    setCheckoutSettleRef('');
  };

  const handleConfirmDirectCheckOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutModalTarget) return;
    const item = checkoutModalTarget;
    const bk = item.booking;
    const nowIso = new Date().toISOString();
    const todayStr = getTodayDateStr();
    const addPay = r2(Math.max(0, Number(checkoutSettleAmount) || 0));
    const newTotalReceived = r2(item.financials.receivedAmount + addPay);
    const shouldMarkDirty = hotelSettings?.autoMarkDirtyOnCheckout !== false;

    const existingPays = Array.isArray(bk.payments) ? [...bk.payments] : [];
    if (addPay > 0) {
      existingPays.push({
        id: `pay-co-${bk.id}-${Date.now()}`,
        bookingId: bk.id,
        amount: addPay,
        paymentMethod: checkoutSettleMethod,
        paymentType: 'Checkout Settlement',
        transactionId: checkoutSettleRef.trim() || `SET-${bk.id}`,
        date: todayStr,
        time: getCurrentTimeStr(),
        recordedBy: loggedInUser || currentRole,
        notes: 'Final checkout settlement',
      });
    }

    const updatedBk: Booking = {
      ...bk,
      status: 'Checked-Out',
      isCheckedIn: false,
      isCompleted: true,
      checkOutDate: bk.checkOutDate || todayStr,
      advanceAmount: newTotalReceived,
      payments: existingPays,
      paymentStatus: newTotalReceived >= item.financials.totalPayable - 0.5 ? 'Fully Paid' : 'Partially Paid',
    };
    delete (updatedBk as any).isStandaloneWalkin;

    const existsInBk = bookings.some(b => b.id === bk.id);
    onUpdateBookings(
      existsInBk ? bookings.map(b => (b.id === bk.id ? updatedBk : b)) : [...bookings, updatedBk]
    );

    if (onUpdateCheckins && checkins.length > 0) {
      onUpdateCheckins(
        checkins.map(ci =>
          ci.id === bk.id || (item.linkedCheckin && ci.id === item.linkedCheckin.id)
            ? {
                ...ci,
                checkedOutDateTime: nowIso,
                advanceAmount: newTotalReceived,
              }
            : ci
        )
      );
    }

    const rmNums = item.roomNumbers;
    if (rmNums.length > 0) {
      onUpdateRooms(
        rooms.map(r =>
          rmNums.includes(String(r.number).trim())
            ? {
                ...r,
                status: shouldMarkDirty ? ('Dirty' as const) : ('Available' as const),
                cleaningStatus: shouldMarkDirty ? ('Dirty' as const) : ('Clean' as const),
                currentGuestName: undefined,
              }
            : r
        )
      );
    }

    onAddAuditLog?.(
      'Guest Checked Out',
      `Checked out ${bk.guestName} (#${bk.id}) from Room ${rmNums.join(', ')}. Settlement collected: ₹${addPay.toLocaleString('en-IN')}.`
    );
    showToast(`Checked out ${bk.guestName} successfully!`, 'success');
    setCheckoutModalTarget(null);
  };

  const handleOpenRoomChangeModal = (item: EnrichedReservationItem) => {
    if (!canPerformReservationAction('roomChange', item.canonicalStatus, currentRole)) {
      showToast(`Room change is not allowed for ${item.canonicalStatus} bookings.`, 'warning');
      return;
    }
    setRoomChangeTarget(item);
    setRoomChangeSelection(item.roomNumbers);
    setRoomChangeReason('Guest room reassignment');
    setRoomChangeError('');
  };

  const handleConfirmRoomChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomChangeTarget) return;
    setRoomChangeError('');
    const item = roomChangeTarget;
    const bk = item.booking;
    const requiredCount = Math.max(1, item.roomCount);

    if (roomChangeSelection.length !== requiredCount) {
      setRoomChangeError(
        `Please select ${requiredCount} room${requiredCount > 1 ? 's' : ''} (currently ${roomChangeSelection.length} selected).`
      );
      return;
    }

    const validation = validateRoomAllocationForDates({
      targetRoomNumbers: roomChangeSelection,
      checkInDate: bk.checkInDate,
      checkOutDate: bk.checkOutDate,
      excludeBookingId: bk.id,
      excludeCheckinId: item.linkedCheckin?.id,
      rooms,
      bookings,
      checkins,
      todayStr: getTodayDateStr(),
    });

    if (!validation.valid) {
      setRoomChangeError(validation.error || 'Selected room(s) are unavailable for these dates.');
      return;
    }

    const prevRooms = item.roomNumbers;
    const nextRooms = roomChangeSelection;
    const chosenRoomObjs = nextRooms
      .map(rn => rooms.find(r => String(r.number).trim() === rn))
      .filter(Boolean) as Room[];

    const updatedBookedRooms: BookedRoom[] | undefined =
      nextRooms.length > 1 || (Array.isArray(bk.bookedRooms) && bk.bookedRooms.length > 0)
        ? chosenRoomObjs.map((rmObj, idx) => {
            const prevBr = bk.bookedRooms?.[idx];
            const rate = Number(prevBr?.rate) || Number(rmObj.rate) || 2000;
            return {
              roomNumber: rmObj.number,
              category: rmObj.category,
              rate,
              originalRate: Number(rmObj.rate) || rate,
              discountAmountOfRoom: prevBr?.discountAmountOfRoom || 0,
              guestsCount: prevBr?.guestsCount || 2,
              extraGuestsCount: prevBr?.extraGuestsCount || 0,
              extraPersonChargeApplied: prevBr?.extraPersonChargeApplied || 0,
              totalRoomAmount: rate * item.nightsCount,
              hasExtraBed: prevBr?.hasExtraBed,
              extraBedCount: prevBr?.extraBedCount,
              extraBedRate: prevBr?.extraBedRate,
            };
          })
        : undefined;

    const updatedBk: Booking = {
      ...bk,
      roomNumber: nextRooms.join(', '),
      roomType: chosenRoomObjs[0]?.category || bk.roomType,
      bookedRooms: updatedBookedRooms,
      notes: `${bk.notes ? bk.notes + ' • ' : ''}Room shifted ${prevRooms.join(', ')} → ${nextRooms.join(', ')} (${roomChangeReason.trim() || 'Reassigned'})`,
    };
    delete (updatedBk as any).isStandaloneWalkin;

    const existsInBk = bookings.some(b => b.id === bk.id);
    onUpdateBookings(
      existsInBk ? bookings.map(b => (b.id === bk.id ? updatedBk : b)) : [...bookings, updatedBk]
    );

    if (onUpdateCheckins && item.linkedCheckin) {
      onUpdateCheckins(
        checkins.map(ci =>
          ci.id === item.linkedCheckin!.id
            ? {
                ...ci,
                roomNumber: nextRooms.join(', '),
                bookedRooms: updatedBookedRooms,
              }
            : ci
        )
      );
    }

    const isGuestCheckedIn = item.canonicalStatus === 'Checked-In';
    const todayStr = getTodayDateStr();
    const updatedRooms = rooms.map(r => {
      const rNum = String(r.number).trim();
      const wasPrev = prevRooms.includes(rNum) && !nextRooms.includes(rNum);
      const isNew = nextRooms.includes(rNum) && !prevRooms.includes(rNum);
      if (wasPrev) {
        if (isGuestCheckedIn) {
          return {
            ...r,
            status: 'Dirty' as const,
            cleaningStatus: 'Dirty' as const,
            currentGuestName: undefined,
            housekeepingNotes: `Room vacated due to room move to ${nextRooms.join(', ')}`,
          };
        }
        if (r.status === 'Reserved') {
          return { ...r, status: 'Available' as const };
        }
      }
      if (isNew) {
        if (isGuestCheckedIn) {
          return {
            ...r,
            status: 'Occupied' as const,
            currentGuestName: bk.guestName,
          };
        }
        if (bk.checkInDate === todayStr && r.status === 'Available') {
          return { ...r, status: 'Reserved' as const };
        }
      }
      return r;
    });
    onUpdateRooms(updatedRooms);

    if (onUpdateInvoices && item.linkedInvoice) {
      onUpdateInvoices(
        invoices.map(inv =>
          inv.id === item.linkedInvoice!.id
            ? { ...inv, roomNumber: nextRooms.join(', ') }
            : inv
        )
      );
    }

    onAddAuditLog?.(
      'Room Changed',
      `Shifted reservation #${bk.id} (${bk.guestName}) from Room ${prevRooms.join(', ') || 'Unassigned'} to Room ${nextRooms.join(', ')}. Reason: ${roomChangeReason}`
    );
    showToast(`Room changed to ${nextRooms.join(', ')} successfully!`, 'success');
    setRoomChangeTarget(null);
  };

  const handleOpenPaymentModal = (item: EnrichedReservationItem) => {
    if (!canPerformReservationAction('payment', item.canonicalStatus, currentRole)) {
      showToast(`Cannot record payments on a ${item.canonicalStatus} reservation.`, 'warning');
      return;
    }
    setPaymentModalTarget(item);
    const defaultDue = item.financials.pendingAmount > 0 ? item.financials.pendingAmount : 0;
    setPayCollectAmount(defaultDue);
    setPayCollectMethod(item.booking.paymentMethod || 'Cash');
    setPayCollectRef('');
    setPayCollectNotes('');
    setIsPayHybrid(false);
    setPaySplit1Mode('Cash');
    setPaySplit1Amt(Math.round(defaultDue / 2));
    setPaySplit2Mode('UPI');
    setPaySplit2Amt(r2(defaultDue - Math.round(defaultDue / 2)));
    setPaySplit2Ref('');
  };

  const handleConfirmRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalTarget) return;
    const item = paymentModalTarget;
    const bk = item.booking;
    const todayStr = getTodayDateStr();
    const timeNow = getCurrentTimeStr();

    const effectiveAmt = isPayHybrid
      ? r2((Number(paySplit1Amt) || 0) + (Number(paySplit2Amt) || 0))
      : r2(Number(payCollectAmount) || 0);

    if (effectiveAmt <= 0) {
      showToast('Please enter a payment amount greater than ₹0.', 'error');
      return;
    }
    if (item.financials.pendingAmount > 0 && effectiveAmt > item.financials.pendingAmount + 1) {
      showToast(
        `Amount ₹${effectiveAmt.toLocaleString('en-IN')} exceeds pending balance ₹${item.financials.pendingAmount.toLocaleString('en-IN')}.`,
        'error'
      );
      return;
    }

    const existingPays = Array.isArray(bk.payments) ? [...bk.payments] : [];
    if (existingPays.length === 0 && Number(bk.advanceAmount || 0) > 0) {
      existingPays.push({
        id: `pay-init-${bk.id}`,
        bookingId: bk.id,
        amount: Number(bk.advanceAmount),
        paymentMethod: bk.paymentMethod || 'Cash',
        paymentType: 'Advance Deposit',
        transactionId: bk.transactionId || `ADV-${bk.id}`,
        date: bk.bookingDate || bk.checkInDate || todayStr,
        time: '12:00 PM',
        recordedBy: 'Front Desk',
      });
    }

    if (isPayHybrid) {
      if (Number(paySplit1Amt) > 0) {
        existingPays.push({
          id: `pay-${bk.id}-${Date.now()}-1`,
          bookingId: bk.id,
          amount: r2(Number(paySplit1Amt)),
          paymentMethod: paySplit1Mode,
          paymentType: item.canonicalStatus === 'Checked-In' ? 'Folio Receipt' : 'Advance Deposit',
          transactionId: `REC-${Date.now().toString().slice(-6)}-1`,
          date: todayStr,
          time: timeNow,
          recordedBy: loggedInUser || currentRole,
          notes: payCollectNotes.trim() || `Split receipt (${paySplit1Mode})`,
        });
      }
      if (Number(paySplit2Amt) > 0) {
        existingPays.push({
          id: `pay-${bk.id}-${Date.now()}-2`,
          bookingId: bk.id,
          amount: r2(Number(paySplit2Amt)),
          paymentMethod: paySplit2Mode,
          paymentType: item.canonicalStatus === 'Checked-In' ? 'Folio Receipt' : 'Advance Deposit',
          transactionId: paySplit2Ref.trim() || `REC-${Date.now().toString().slice(-6)}-2`,
          date: todayStr,
          time: timeNow,
          recordedBy: loggedInUser || currentRole,
          notes: payCollectNotes.trim() || `Split receipt (${paySplit2Mode})`,
        });
      }
    } else {
      existingPays.push({
        id: `pay-${bk.id}-${Date.now()}`,
        bookingId: bk.id,
        amount: effectiveAmt,
        paymentMethod: payCollectMethod,
        paymentType: item.canonicalStatus === 'Checked-In' ? 'Folio Receipt' : 'Advance Deposit',
        transactionId: payCollectRef.trim() || `REC-${Date.now().toString().slice(-6)}`,
        date: todayStr,
        time: timeNow,
        recordedBy: loggedInUser || currentRole,
        notes: payCollectNotes.trim() || 'Reservation payment receipt',
      });
    }

    const nextAdvanceTotal = r2(Number(bk.advanceAmount || 0) + effectiveAmt);
    const nextTotalReceived = r2(item.financials.receivedAmount + effectiveAmt);
    const isNowSettled = nextTotalReceived >= item.financials.totalPayable - 0.5;
    const nextStatus: BookingStatus =
      item.canonicalStatus === 'Draft' ? 'Confirmed' : bk.status;

    const updatedBk: Booking = {
      ...bk,
      status: nextStatus,
      advanceAmount: nextAdvanceTotal,
      paymentMethod: isPayHybrid ? paySplit1Mode : payCollectMethod,
      transactionId: payCollectRef.trim() || bk.transactionId,
      payments: existingPays,
      paymentStatus: isNowSettled ? 'Fully Paid' : 'Partially Paid',
    };
    delete (updatedBk as any).isStandaloneWalkin;

    const existsInBk = bookings.some(b => b.id === bk.id);
    onUpdateBookings(
      existsInBk ? bookings.map(b => (b.id === bk.id ? updatedBk : b)) : [...bookings, updatedBk]
    );

    if (onUpdateCheckins && item.linkedCheckin) {
      onUpdateCheckins(
        checkins.map(ci =>
          ci.id === item.linkedCheckin!.id
            ? {
                ...ci,
                advanceAmount: r2(Number(ci.advanceAmount || 0) + effectiveAmt),
              }
            : ci
        )
      );
    }

    if (onUpdateInvoices && item.linkedInvoice) {
      const remPending = r2(Math.max(0, item.financials.totalPayable - nextTotalReceived));
      onUpdateInvoices(
        invoices.map(inv =>
          inv.id === item.linkedInvoice!.id
            ? {
                ...inv,
                paidAmount: nextTotalReceived,
                pendingAmount: remPending,
                isPaid: remPending <= 0.5,
                paymentStatus: remPending <= 0.5 ? 'Paid' : 'Partially Paid',
              }
            : inv
        )
      );
    }

    onAddAuditLog?.(
      'Reservation Payment Recorded',
      `Collected ₹${effectiveAmt.toLocaleString('en-IN')} via ${isPayHybrid ? `${paySplit1Mode}+${paySplit2Mode}` : payCollectMethod} for ${bk.guestName} (#${bk.id}).`
    );
    showToast(`Recorded ₹${effectiveAmt.toLocaleString('en-IN')} payment for ${bk.guestName}!`, 'success');
    setPaymentModalTarget(null);
  };

  const handleConfirmMarkNoShow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noShowModalTarget) return;
    const item = noShowModalTarget;
    const bk = item.booking;
    if (!canPerformReservationAction('noShow', item.canonicalStatus, currentRole)) {
      showToast(`Cannot mark a ${item.canonicalStatus} booking as No-Show.`, 'error');
      setNoShowModalTarget(null);
      return;
    }

    const todayStr = getTodayDateStr();
    const updatedBk: Booking = {
      ...bk,
      status: 'No-Show',
      isCheckedIn: false,
      noShowReason: noShowReasonInput.trim() || 'Guest did not arrive',
      noShowMarkedAt: new Date().toISOString(),
      notes: `${bk.notes ? bk.notes + ' • ' : ''}[No-Show: ${noShowReasonInput.trim() || 'Did not arrive'}]`,
    };
    const updatedList = bookings.map(b => (b.id === bk.id ? updatedBk : b));
    onUpdateBookings(updatedList);

    if (item.roomNumbers.length > 0) {
      onUpdateRooms(
        rooms.map(r => {
          const rNum = String(r.number).trim();
          if (!item.roomNumbers.includes(rNum)) return r;
          const stillReserved = updatedList.some(
            other =>
              other.id !== bk.id &&
              !['Cancelled', 'No-Show', 'Checked-Out'].includes(resolveCanonicalStatus(other, undefined, todayStr)) &&
              getReservationRoomNumbers(other).includes(rNum) &&
              other.checkInDate <= todayStr &&
              (other.checkOutDate || getFutureDateStr(1, other.checkInDate)) > todayStr
          );
          if (!stillReserved && r.status === 'Reserved') {
            return { ...r, status: 'Available' as const };
          }
          return r;
        })
      );
    }

    onAddAuditLog?.(
      'Marked No-Show',
      `Marked reservation #${bk.id} (${bk.guestName}, Room ${item.roomNumbers.join(', ')}) as No-Show. Reason: ${noShowReasonInput}`
    );
    showToast(`Reservation #${bk.id} marked as No-Show and room availability released.`, 'success');
    setNoShowModalTarget(null);
  };

  const renderSourceIconBadge = (source: string, primarySegment: ReservationSegment) => {
    const lower = String(source || '').toLowerCase();
    if (primarySegment === 'Corporate' || lower === 'corporate') {
      return (
        <div className="w-7 h-7 rounded-lg bg-[#1E1610] text-[#F3D078] flex items-center justify-center shrink-0 shadow-2xs">
          <Building2 className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (primarySegment === 'Travel Agent' || lower === 'travel agent') {
      return (
        <div className="w-7 h-7 rounded-lg bg-[#1E1610] text-[#F3D078] flex items-center justify-center shrink-0 shadow-2xs">
          <Briefcase className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (primarySegment === 'OTA' || OTA_BOOKING_SOURCES.some(o => o.toLowerCase() === lower) || lower === 'website') {
      return (
        <div className="w-7 h-7 rounded-lg bg-[#1E1610] text-[#F3D078] flex items-center justify-center shrink-0 shadow-2xs">
          <Globe className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (primarySegment === 'Group') {
      return (
        <div className="w-7 h-7 rounded-lg bg-[#1E1610] text-[#F3D078] flex items-center justify-center shrink-0 shadow-2xs">
          <Users className="w-3.5 h-3.5" />
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-lg bg-[#1E1610] text-white flex items-center justify-center shrink-0 shadow-2xs">
        <UserCheck className="w-3.5 h-3.5" />
      </div>
    );
  };

  const renderStatusPill = (status: CanonicalReservationStatus) => {
    const cls = getStatusPillClasses(status);
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-bold border whitespace-nowrap ${cls.badge}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
        {status}
      </span>
    );
  };

  const renderActionDropdownMenu = (item: EnrichedReservationItem) => {
    const bk = item.booking;
    const st = item.canonicalStatus;
    const isOpen = openMenuId === bk.id;
    const canCheckIn = canPerformReservationAction('checkIn', st, currentRole) && Boolean(onCheckIn);
    const canCheckOut = canPerformReservationAction('checkOut', st, currentRole);
    const canRoomChange = canPerformReservationAction('roomChange', st, currentRole);
    const canPay = canPerformReservationAction('payment', st, currentRole);
    const canCancel = canPerformReservationAction('cancel', st, currentRole);
    const canNoShow = canPerformReservationAction('noShow', st, currentRole);

    return (
      <div className="relative inline-block text-left" data-res-action-menu>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setOpenMenuId(isOpen ? null : bk.id);
          }}
          className="w-8 h-8 rounded-lg hover:bg-luxury-beige-100 border border-transparent hover:border-luxury-brown-200 flex items-center justify-center text-luxury-brown-700 transition-colors cursor-pointer"
          title="Reservation Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isOpen && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-2xl border border-luxury-brown-200/80 py-1.5 z-50 text-xs font-semibold text-slate-700 animate-fadeIn"
          >
            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                setViewingReservationItem(item);
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-[#FFFDF7] flex items-center gap-2.5 text-luxury-brown-950 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#C49A3A]" />
              <span>View Details &amp; Folio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                handleEditClick(bk);
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-[#FFFDF7] flex items-center gap-2.5 text-luxury-brown-950 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-sky-600" />
              <span>Edit Reservation</span>
            </button>

            {st === 'Draft' && !item.isStandaloneCheckin && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  handleQuickConfirmStatus(bk);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-sky-50 flex items-center gap-2.5 text-sky-700 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark Confirmed</span>
              </button>
            )}

            {canCheckIn && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  executeCheckInWithHousekeepingGuard(item);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-emerald-50 flex items-center gap-2.5 text-emerald-700 font-bold cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Check-In Guest</span>
              </button>
            )}

            {canCheckOut && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  handleOpenCheckOutAction(item);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-teal-50 flex items-center gap-2.5 text-teal-800 font-bold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Check-Out &amp; Settle</span>
              </button>
            )}

            {canRoomChange && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  handleOpenRoomChangeModal(item);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-indigo-50 flex items-center gap-2.5 text-indigo-700 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Room Change</span>
              </button>
            )}

            {canPay && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  handleOpenPaymentModal(item);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-amber-50/80 flex items-center gap-2.5 text-[#8B691E] cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#C49A3A]" />
                <span>Record Payment</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                handleGenerateOrViewInvoice(bk);
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-[#FFFDF7] flex items-center gap-2.5 text-slate-800 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-[#C49A3A]" />
              <span>{item.linkedInvoice ? 'View GST Invoice' : 'Generate Invoice'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                handlePrintFilledGrc(item);
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Guest GRC</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenuId(null);
                void handleSendBookingEmailAction(
                  bk,
                  st === 'Cancelled' ? 'booking_cancelled' : 'booking_confirmation',
                  true
                );
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-blue-50 flex items-center gap-2.5 text-blue-700 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Send Booking Email</span>
            </button>

            {(canNoShow || canCancel) && <div className="my-1 border-t border-slate-100" />}

            {canNoShow && !item.isStandaloneCheckin && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  setNoShowModalTarget(item);
                  setNoShowReasonInput('Guest failed to arrive before cut-off time');
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-amber-50 flex items-center gap-2.5 text-amber-800 cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Mark No-Show</span>
              </button>
            )}

            {canCancel && !item.isStandaloneCheckin && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  handleCancelReservation(bk.id, bk.guestName);
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2.5 text-rose-700 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel &amp; Refund</span>
              </button>
            )}

            {(currentRole === 'Admin' || currentRole === 'SuperAdmin' || currentRole === 'Manager') && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  const recordLabel = item.isStandaloneCheckin ? 'walk-in / stay' : 'booking';
                  const recordId = item.linkedCheckin?.id || bk.id;
                  if (window.confirm(`Move ${recordLabel} #${recordId} (${bk.guestName}) to Deleted Folder? It can be restored later.`)) {
                    if (onMoveToDeletedFolder) {
                      if (item.isStandaloneCheckin && item.linkedCheckin) {
                        onMoveToDeletedFolder({
                          itemType: 'Guest',
                          itemId: item.linkedCheckin.id,
                          title: `Walk-in #${item.linkedCheckin.id} (Room ${item.displayRoomsLabel || bk.roomNumber || 'Auto'})`,
                          guestName: bk.guestName,
                          roomNumber: item.displayRoomsLabel || bk.roomNumber,
                          amount: bk.bookingAmount || (item.financials as any)?.totalPayable || (item.financials as any)?.totalAmount || 0,
                          reason: 'Moved to Deleted Folder from Reservations List',
                          data: item.linkedCheckin,
                        });
                      } else {
                        onMoveToDeletedFolder({
                          itemType: 'Booking',
                          itemId: bk.id,
                          title: `Booking #${bk.id} (${bk.roomType} - Room ${bk.roomNumber || 'Auto'})`,
                          guestName: bk.guestName,
                          roomNumber: bk.roomNumber,
                          amount: bk.bookingAmount || (item.financials as any)?.totalPayable || (item.financials as any)?.totalAmount || 0,
                          reason: 'Moved to Deleted Folder from Reservations List',
                          data: bk,
                          metadata: item.linkedCheckin ? { linkedCheckin: item.linkedCheckin } : undefined,
                        } as any);
                      }
                    }
                    const rmNums = getReservationRoomNumbers(bk);
                    if (rmNums.length > 0) {
                      onUpdateRooms(
                        rooms.map(r =>
                          rmNums.includes(String(r.number).trim()) && (r.status === 'Reserved' || (r.status === 'Occupied' && st !== 'Checked-Out'))
                            ? { ...r, status: 'Available' as const }
                            : r
                        )
                      );
                    }
                    if (bookings.some(b => b.id === bk.id)) {
                      onUpdateBookings(bookings.filter(b => b.id !== bk.id));
                    }
                    if (onUpdateCheckins && (item.linkedCheckin || checkins.length > 0)) {
                      const targetCheckinId = item.linkedCheckin?.id || bk.id;
                      const targetGrpId = item.linkedCheckin?.groupBookingId || bk.groupBookingId;
                      onUpdateCheckins(
                        checkins.filter(c => {
                          if (c.id === targetCheckinId) return false;
                          if (targetGrpId && c.groupBookingId === targetGrpId) return false;
                          if (c.bookingId && c.bookingId === bk.id) return false;
                          if (c.id === bk.id) return false;
                          return true;
                        })
                      );
                    }
                    if (onAddAuditLog) {
                      onAddAuditLog(
                        'Record Moved to Deleted Folder',
                        `${recordLabel.toUpperCase()} #${recordId} (${bk.guestName}, Room ${item.displayRoomsLabel || bk.roomNumber}) moved to Deleted Folder.`
                      );
                    }
                  }
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-rose-50 flex items-center gap-2.5 text-slate-500 hover:text-rose-700 cursor-pointer border-t border-slate-100 mt-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const datePillSummaryLabel = useMemo(() => {
    if (dateFilterType === 'All') return 'All Dates';
    if (dateFilterType === 'Today') return `Today (${formatShortHumanDate(getTodayDateStr())})`;
    if (dateFilterType === 'Yesterday') return `Yesterday (${formatShortHumanDate(getFutureDateStr(-1))})`;
    if (dateFilterType === 'This Month') return 'This Month';
    if (dateFilterType === 'Date') return formatShortHumanDate(filterSingleDate);
    return `${formatShortHumanDate(filterStartDate)} → ${filterEndDate ? formatShortHumanDate(filterEndDate) : '...'}`;
  }, [dateFilterType, filterSingleDate, filterStartDate, filterEndDate]);

  // Get available rooms matching selected category
  const suitableRooms = rooms.filter(r => r.category === roomType && (r.status === 'Available' || r.status === 'Reserved'));

  return (
    <div className="space-y-5 print:space-y-0">
      {/* TOP HEADER BAR — MATCHING SCREENSHOT LAYOUT WITH DIRECTSTAY THEME */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-1 no-print">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-serif text-luxury-brown-950 font-bold tracking-tight">
              Reservations List
            </h1>
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#FBF4E0] text-[#8B691E] border border-[#C49A3A]/40">
              {totalItems} {totalItems === 1 ? 'Reservation' : 'Reservations'}
            </span>
          </div>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Individual, Group, Corporate, Walk-in, OTA &amp; Travel Agent bookings synced live with Stay Overview &amp; Folio
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleNewBookingClick}
            className="px-4 py-2 bg-[#C49A3A] hover:bg-[#b0882e] text-[#17120F] font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Reservation</span>
          </button>

          {onOpenCalendar && (
            <button
              type="button"
              onClick={onOpenCalendar}
              className="px-3 py-2 bg-white hover:bg-[#FFFDF7] text-luxury-brown-900 border border-luxury-brown-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Open Stay Overview Timeline"
            >
              <Calendar className="w-3.5 h-3.5 text-[#C49A3A]" />
              <span className="hidden sm:inline">Stay Overview</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Export filtered reservations to Excel (.csv)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReservationsList}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Print Reservations List"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handlePrintBlankGrc}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Print Blank Guest Registration Card (GRC)"
          >
            <FileText className="w-3.5 h-3.5 text-[#8B691E]" />
            <span>Blank GRC</span>
          </button>
        </div>
      </div>

      {/* Pending Hotel Approval Banner for Direct Guest Booking Link Requests */}
      {pendingApprovalBookings.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-3 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-amber-800 bg-amber-200/70 px-2.5 py-0.5 rounded-full">
                Action Required • {pendingApprovalBookings.length} Direct Guest Booking{pendingApprovalBookings.length > 1 ? 's' : ''} Pending Hotel Approval
              </span>
              <h3 className="text-sm font-serif font-bold text-luxury-brown-950 mt-1">
                Guests have submitted booking / self check-in requests via your Hotel Booking Link. Approve or Reject below:
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
              className="px-3 py-1.5 rounded-xl bg-luxury-brown-900 text-luxury-gold-300 text-xs font-mono font-bold cursor-pointer shrink-0"
            >
              {statusFilter === 'Pending' ? 'Show All Bookings' : `Filter Pending (${pendingApprovalBookings.length})`}
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
            {pendingApprovalBookings.map(pbk => (
              <div
                key={pbk.id}
                className="bg-white border-2 border-amber-300/80 rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3 hover:border-amber-400 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2 border-b border-amber-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="font-serif text-base text-luxury-brown-950">{pbk.guestName}</strong>
                        <span className="font-mono text-xs font-bold text-luxury-gold-700 bg-luxury-gold-50 px-2 py-0.5 rounded border border-luxury-gold-200">
                          {pbk.mobile}
                        </span>
                      </div>
                      {pbk.email && (
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">{pbk.email}</p>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md shrink-0">
                      {pbk.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                    <span className="bg-luxury-brown-900 text-luxury-gold-300 px-2 py-1 rounded-md font-bold">
                      Room {pbk.roomNumber} ({pbk.roomType})
                    </span>
                    <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded-md font-semibold">
                      {pbk.checkInDate} → {pbk.checkOutDate} ({pbk.nights}N)
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-md font-bold">
                      Advance: ₹{(pbk.advanceAmount || 0).toLocaleString()} {pbk.paymentMethod ? `via ${pbk.paymentMethod}` : ''}
                    </span>
                  </div>

                  {pbk.notes && (
                    <div className="text-xs bg-amber-50/70 border border-amber-200/60 rounded-lg p-2 text-luxury-brown-900 leading-relaxed">
                      <span className="font-bold text-amber-900">Request Notes:</span> {pbk.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-100">
                  <button
                    type="button"
                    onClick={() => handleEditClick(pbk)}
                    className="px-3 py-1.5 rounded-lg bg-luxury-gold-100 hover:bg-luxury-gold-200 text-luxury-brown-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-luxury-gold-400 transition-colors shadow-2xs"
                    title="Edit Pending Booking details (dates, room, advance, etc.)"
                  >
                    <Edit className="w-3.5 h-3.5 text-luxury-gold-800" />
                    <span>Edit Booking</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprovePendingBooking(pbk)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectPendingBooking(pbk)}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW SWITCHER + SEARCH + DATE RANGE + STATUS + SEGMENT + SORT TOOLBAR */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 no-print">
        {/* Left: List View / Table View / Grid View Switcher */}
        <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs self-start">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[#1E1610] text-[#F3D078] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-[#1E1610] text-[#F3D078] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Table View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-[#1E1610] text-[#F3D078] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid View</span>
          </button>
        </div>

        {/* Right: Search, Date Range Pill, Segment, Status, Sort */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[230px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search guest, phone, ID, room..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#C49A3A] shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Interactive Date-Range Pill + Popover */}
          <div className="relative" ref={datePopoverRef}>
            <div
              onClick={() => setShowDatePopover(prev => !prev)}
              className={`px-3 py-2 bg-white border rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs transition-colors ${
                dateFilterType !== 'All'
                  ? 'border-[#C49A3A] bg-[#FFFDF7] text-[#8B691E]'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#C49A3A] shrink-0" />
              <span className="truncate max-w-[190px]">{datePillSummaryLabel}</span>
              {dateFilterType !== 'All' && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setDateFilterType('All');
                  }}
                  className="text-slate-400 hover:text-rose-600 ml-0.5 cursor-pointer"
                  title="Clear Date Filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {showDatePopover && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-luxury-brown-200 p-3.5 z-50 space-y-3 text-xs">
                <div className="font-bold text-luxury-brown-950 flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Filter by Check-In / Stay Date</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilterType('All');
                      setShowDatePopover(false);
                    }}
                    className="text-[11px] text-[#8B691E] hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['All', 'Today', 'Yesterday', 'This Month', 'Date', 'Range'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDateFilterType(opt)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-colors cursor-pointer ${
                        dateFilterType === opt
                          ? 'bg-[#1E1610] text-[#F3D078] border-[#1E1610]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt === 'All' ? 'All Dates' : opt === 'Date' ? 'Specific Date' : opt === 'Range' ? 'Custom Range' : opt}
                    </button>
                  ))}
                </div>
                {dateFilterType === 'Date' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] uppercase font-mono font-bold text-slate-500">Pick Date</label>
                    <input
                      type="date"
                      value={filterSingleDate}
                      onChange={e => setFilterSingleDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                )}
                {dateFilterType === 'Range' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-slate-500">From</label>
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={e => setFilterStartDate(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-mono text-[11px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-slate-500">To</label>
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={e => setFilterEndDate(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-mono text-[11px]"
                      />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowDatePopover(false)}
                  className="w-full py-1.5 rounded-lg bg-[#C49A3A] text-[#17120F] font-bold cursor-pointer"
                >
                  Apply Filter
                </button>
              </div>
            )}
          </div>

          {/* Segment Filter */}
          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#C49A3A] shadow-2xs cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="Individual">Individual</option>
            <option value="Group">Group Booking</option>
            <option value="Corporate">Corporate</option>
            <option value="Walk-in">Walk-in</option>
            <option value="OTA">OTA</option>
            <option value="Travel Agent">Travel Agent</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#C49A3A] shadow-2xs cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Cancelled">Cancelled</option>
            <option value="No-Show">No-Show</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#C49A3A] shadow-2xs cursor-pointer"
            title="Sort Reservations"
          >
            <option value="booked_desc">Sort: Newest Booked</option>
            <option value="checkin_asc">Sort: Check-In (Earliest)</option>
            <option value="checkin_desc">Sort: Check-In (Latest)</option>
            <option value="guest_asc">Sort: Guest Name (A–Z)</option>
            <option value="amount_desc">Sort: Folio Amount (High–Low)</option>
            <option value="status">Sort: Status Priority</option>
          </select>
        </div>
      </div>

      {/* ==================== 1. LIST VIEW (SCREENSHOT REFERENCE DESIGN IN DIRECTSTAY THEME) ==================== */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* Bold Rounded Header Bar on Desktop */}
          <div className="hidden lg:grid lg:grid-cols-12 items-center bg-[#1E1610] text-[#FBF4E0] rounded-2xl px-5 py-3.5 text-[11px] font-extrabold uppercase tracking-wider shadow-sm border border-[#C49A3A]/30">
            <div className="col-span-2">Guest &amp; Contact</div>
            <div className="col-span-2">Rooms</div>
            <div className="col-span-4 text-center flex items-center justify-center gap-3">
              <span>Check-In</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C49A3A]" />
              <span>Check-Out</span>
            </div>
            <div className="col-span-1">Source</div>
            <div className="col-span-1">Booked On</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1 text-right pr-1">Actions</div>
          </div>

          {paginatedReservations.length === 0 ? (
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-12 text-center space-y-2 shadow-2xs">
              <CalendarCheck className="w-10 h-10 text-luxury-brown-300 mx-auto" />
              <div className="text-sm font-bold text-luxury-brown-800">No reservations match your active filters</div>
              <p className="text-xs text-slate-500">Try clearing the search query, status filter, or date range.</p>
            </div>
          ) : (
            paginatedReservations.map(item => {
              const bk = item.booking;
              const inTimeStr = formatDisplayTime12h(bk.checkInTime, hotelSettings?.checkInTime || '12:00 PM');
              const outTimeStr = formatDisplayTime12h(bk.checkOutTime, hotelSettings?.checkOutTime || '11:00 AM');
              return (
                <div
                  key={bk.id}
                  onClick={() => setViewingReservationItem(item)}
                  className="bg-white hover:bg-[#FFFDF9] border border-slate-200/90 hover:border-[#C49A3A]/60 rounded-2xl px-4 sm:px-5 py-4 shadow-2xs hover:shadow-md transition-all cursor-pointer"
                >
                  {/* Desktop Row Layout */}
                  <div className="hidden lg:grid lg:grid-cols-12 items-center gap-3">
                    {/* Col 1: Guest & Contact */}
                    <div className="col-span-2 min-w-0 space-y-1">
                      <div className="font-bold text-sm text-slate-900 truncate" title={bk.guestName}>
                        {bk.guestName}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-600 font-mono truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{bk.mobile ? `(+91) ${bk.mobile}` : 'No Mobile'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-bold">
                          <Users className="w-3 h-3 text-slate-500" />
                          {item.paxLabel}
                        </span>
                        {item.primarySegment !== 'Individual' && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FBF4E0] text-[#8B691E] border border-[#C49A3A]/30 text-[10px] font-bold">
                            {item.primarySegment}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">#{bk.id}</div>
                    </div>

                    {/* Col 2: Rooms & Multi-Room Group Info */}
                    <div className="col-span-2 min-w-0">
                      <div className="flex items-start gap-2">
                        <BedDouble className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-slate-900 leading-snug" title={item.roomNumbers.join(', ')}>
                            {item.displayRoomsLabel}
                          </div>
                          <div className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 truncate mt-0.5">
                            {item.categoryLabel}
                          </div>
                          {item.roomCount > 1 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.roomNumbers.slice(0, 4).map(rn => (
                                <span
                                  key={rn}
                                  className="px-1.5 py-0.5 text-[9.5px] font-mono font-bold rounded bg-indigo-50 text-indigo-800 border border-indigo-200"
                                >
                                  Rm {rn}
                                </span>
                              ))}
                              {item.roomNumbers.length > 4 && (
                                <span className="text-[9.5px] font-mono font-bold text-indigo-700">
                                  +{item.roomNumbers.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Col 3: Check-In -> Duration -> Check-Out */}
                    <div className="col-span-4 flex items-center justify-center gap-2">
                      <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center gap-2 min-w-[126px]">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-[11.5px] font-extrabold text-slate-900 whitespace-nowrap">
                            {formatShortHumanDate(bk.checkInDate)}
                          </div>
                          <div className="text-[10px] font-semibold text-emerald-700">{inTimeStr}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center px-1 shrink-0 text-center">
                        <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-sky-700 whitespace-nowrap">
                          <Moon className="w-2.5 h-2.5" />
                          {item.nightsCount} {item.nightsCount === 1 ? 'night' : 'nights'}
                        </span>
                        <div className="w-12 flex items-center justify-center text-slate-400 my-0.5">
                          <div className="h-[1.5px] flex-1 bg-slate-300" />
                          <ArrowRight className="w-3 h-3 -ml-1 text-slate-400" />
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                          <Clock className="w-2.5 h-2.5" />
                          {item.durationHoursLabel}
                        </span>
                      </div>

                      <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl px-3 py-2 flex items-center gap-2 min-w-[126px]">
                        <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <div>
                          <div className="text-[11.5px] font-extrabold text-slate-900 whitespace-nowrap">
                            {bk.checkOutDate ? formatShortHumanDate(bk.checkOutDate) : 'Open Stay'}
                          </div>
                          <div className="text-[10px] font-semibold text-rose-700">{outTimeStr}</div>
                        </div>
                      </div>
                    </div>

                    {/* Col 4: Source */}
                    <div className="col-span-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {renderSourceIconBadge(bk.bookingSource, item.primarySegment)}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate" title={bk.bookingSource}>
                            {bk.bookingSource === 'Walk-in' ? 'Walkin' : bk.bookingSource}
                          </div>
                          {(bk.companyName || bk.travelAgentName) && (
                            <div className="text-[10px] text-[#8B691E] font-semibold truncate">
                              {bk.companyName || bk.travelAgentName}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Col 5: Booked On + Compact Settlement Indicator */}
                    <div className="col-span-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1 text-[11.5px] font-bold text-slate-800 whitespace-nowrap">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{item.bookedOnDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10.5px] text-slate-500 whitespace-nowrap">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{item.bookedOnTime}</span>
                      </div>
                      <div className="text-[10px] font-mono pt-0.5">
                        <span className="text-emerald-700 font-bold">₹{item.financials.receivedAmount.toLocaleString('en-IN')}</span>
                        {item.financials.pendingAmount > 0 && (
                          <span className="text-rose-600 font-bold ml-1">
                            • Due ₹{item.financials.pendingAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Col 6: Status Pill */}
                    <div className="col-span-1 text-center">
                      {renderStatusPill(item.canonicalStatus)}
                    </div>

                    {/* Col 7: Actions Menu */}
                    <div className="col-span-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {renderActionDropdownMenu(item)}
                    </div>
                  </div>

                  {/* Mobile / Tablet Responsive Card Layout */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">{bk.guestName}</span>
                          {renderStatusPill(item.canonicalStatus)}
                        </div>
                        <div className="text-xs font-mono text-slate-600 mt-0.5">
                          (+91) {bk.mobile || '-'} • {item.paxLabel} • <span className="text-slate-400">#{bk.id}</span>
                        </div>
                      </div>
                      <div onClick={e => e.stopPropagation()}>{renderActionDropdownMenu(item)}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-[#1E1610] text-[#F3D078] font-bold flex items-center gap-1.5">
                        <BedDouble className="w-3.5 h-3.5" />
                        {item.displayRoomsLabel} • {item.categoryLabel}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                        {bk.bookingSource} ({item.primarySegment})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">Check-In</span>
                        <strong className="text-slate-900">{formatShortHumanDate(bk.checkInDate)}</strong>
                        <span className="text-[10px] text-slate-500 block">{inTimeStr}</span>
                      </div>
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-2">
                        <span className="text-[10px] uppercase font-bold text-rose-700 block">
                          Check-Out ({item.nightsCount}N)
                        </span>
                        <strong className="text-slate-900">
                          {bk.checkOutDate ? formatShortHumanDate(bk.checkOutDate) : 'Open Stay'}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">{outTimeStr}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-mono">
                      <span className="text-slate-500">Booked: {item.bookedOnDate}</span>
                      <div>
                        <span className="text-emerald-700 font-bold">Paid ₹{item.financials.receivedAmount.toLocaleString('en-IN')}</span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        <span className={item.financials.pendingAmount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                          Due ₹{item.financials.pendingAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ==================== 2. TABLE VIEW (COMPACT FINANCIAL & OPERATIONAL LEDGER) ==================== */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1E1610] text-[#FBF4E0] uppercase text-[10.5px] tracking-wider font-extrabold">
                  <th className="py-3.5 px-3">Booking ID</th>
                  <th className="py-3.5 px-3">Guest &amp; Contact</th>
                  <th className="py-3.5 px-3">Rooms &amp; Category</th>
                  <th className="py-3.5 px-3">Check-In → Check-Out</th>
                  <th className="py-3.5 px-3">Source / Type</th>
                  <th className="py-3.5 px-3">Booked On</th>
                  <th className="py-3.5 px-3 text-right">Total</th>
                  <th className="py-3.5 px-3 text-right">Received</th>
                  <th className="py-3.5 px-3 text-right">Pending</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedReservations.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400">
                      No reservations found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedReservations.map(item => {
                    const bk = item.booking;
                    return (
                      <tr
                        key={bk.id}
                        onClick={() => setViewingReservationItem(item)}
                        className="hover:bg-[#FFFDF7] transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {bk.id}
                          <div className="text-[10px] text-[#8B691E] font-sans">{item.primarySegment}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{bk.guestName}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {bk.mobile || '-'} • {item.paxLabel}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.displayRoomsLabel}</div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">{item.categoryLabel}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {formatShortHumanDate(bk.checkInDate)} → {bk.checkOutDate ? formatShortHumanDate(bk.checkOutDate) : 'Open'}
                          </div>
                          <div className="text-[10.5px] text-sky-700 font-semibold">
                            {item.nightsCount} {item.nightsCount === 1 ? 'night' : 'nights'} ({item.durationHoursLabel})
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800">{bk.bookingSource}</span>
                          {(bk.companyName || bk.travelAgentName) && (
                            <div className="text-[10px] text-[#8B691E] truncate max-w-[140px]">
                              {bk.companyName || bk.travelAgentName}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          <div>{item.bookedOnDate}</div>
                          <div className="text-[10px] text-slate-400">{item.bookedOnTime}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          ₹{item.financials.totalPayable.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          ₹{item.financials.receivedAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={item.financials.pendingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}>
                            ₹{item.financials.pendingAmount.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {renderStatusPill(item.canonicalStatus)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {renderActionDropdownMenu(item)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== 3. GRID VIEW (RESPONSIVE DIRECTSTAY BOOKING CARDS) ==================== */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedReservations.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
              No reservations match your active filters.
            </div>
          ) : (
            paginatedReservations.map(item => {
              const bk = item.booking;
              return (
                <div
                  key={bk.id}
                  onClick={() => setViewingReservationItem(item)}
                  className="bg-white hover:bg-[#FFFDF9] border border-slate-200 hover:border-[#C49A3A]/60 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-base text-slate-900 truncate">{bk.guestName}</div>
                        <div className="text-xs font-mono text-slate-500">
                          (+91) {bk.mobile || '-'} • {item.paxLabel}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        {renderStatusPill(item.canonicalStatus)}
                        {renderActionDropdownMenu(item)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-[#FFFDF7] border border-[#C49A3A]/30 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <BedDouble className="w-4 h-4 text-[#C49A3A] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-luxury-brown-950 truncate">
                            {item.displayRoomsLabel}
                          </div>
                          <div className="text-[10px] uppercase font-bold text-slate-500 truncate">
                            {item.categoryLabel}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-[#1E1610] text-[#F3D078] shrink-0">
                        {item.primarySegment}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold uppercase text-emerald-700 block">Check-In</span>
                        <strong className="text-slate-900">{formatShortHumanDate(bk.checkInDate)}</strong>
                        <span className="text-[10px] text-emerald-700 block">
                          {formatDisplayTime12h(bk.checkInTime, '12:00 PM')}
                        </span>
                      </div>
                      <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold uppercase text-rose-700 block">
                          Check-Out ({item.nightsCount}N)
                        </span>
                        <strong className="text-slate-900">
                          {bk.checkOutDate ? formatShortHumanDate(bk.checkOutDate) : 'Open Stay'}
                        </strong>
                        <span className="text-[10px] text-rose-700 block">
                          {formatDisplayTime12h(bk.checkOutTime, '11:00 AM')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-50 rounded-xl p-2 font-mono">
                      <div>
                        <span className="text-[9.5px] uppercase text-slate-500 block">Total</span>
                        <strong className="text-xs text-slate-900">
                          ₹{item.financials.totalPayable.toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[9.5px] uppercase text-emerald-700 block">Received</span>
                        <strong className="text-xs text-emerald-700">
                          ₹{item.financials.receivedAmount.toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[9.5px] uppercase text-rose-700 block">Pending</span>
                        <strong className="text-xs text-rose-600">
                          ₹{item.financials.pendingAmount.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {bk.bookingSource} • #{bk.id}
                      </span>
                      <span>Booked {item.bookedOnDate}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ==================== BOTTOM PAGINATION BAR (MATCHING SCREENSHOT) ==================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-600 no-print">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-700">
            Showing {totalItems === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + rowsPerPage, totalItems)} of {totalItems}{' '}
            {totalItems === 1 ? 'reservation' : 'reservations'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={e => setRowsPerPage(Number(e.target.value))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce<Array<number | 'ellipsis'>>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
              acc.push(p);
              return acc;
            }, [])
            .map((entry, idx) =>
              entry === 'ellipsis' ? (
                <span key={`el-${idx}`} className="px-1 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setCurrentPage(entry)}
                  className={`w-8 h-8 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                    safePage === entry
                      ? 'bg-[#C49A3A] text-[#17120F] shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {entry}
                </button>
              )
            )}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save Reservation Form Modular Dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative bg-white rounded-2xl border border-luxury-gold-500/20 shadow-2xl max-w-3xl w-full overflow-hidden animate-fadeIn max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FFFDF7] to-[#FBF4E0] text-[#263449] p-5 flex justify-between items-center border-b border-[#C49A3A]/30 shrink-0">
              <div>
                <h3 className="text-base font-serif font-bold text-[#263449] flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-[#C49A3A]" />
                  {editingBooking ? `Edit Booking (${editingBooking.id})` : 'New Advance Booking'}
                </h3>
              </div>
              <button
                onClick={handleCloseForm}
                className="text-[#263449] bg-white hover:bg-[#FBF4E0] border border-[#DCE3EC] px-2.5 py-1 text-xs rounded-md font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 text-rose-700 text-xs p-3.5 border-b border-rose-100 font-semibold text-center shrink-0">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="p-5 space-y-4 overflow-y-auto">
              {/* (A) RESERVATION INFORMATION */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#263449] block border-b border-slate-200 pb-1.5">
                  (A) Reservation Information :-
                </span>

                {/* Row 1: Booking Date & Booking Source (in 1 single line) */}
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                      Booking Date
                    </label>
                    <input
                      type="date"
                      value={bookingDateInput}
                      onChange={(e) => setBookingDateInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                        Booking Source
                      </label>
                      <span className="text-[10px] font-mono text-slate-500">
                        Active: <strong className="text-[#8B691E]">{bookingSource}</strong>
                      </span>
                    </div>

                    {(() => {
                      const isOtaSelected =
                        ['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Airbnb', 'OYO', 'Expedia', 'OTA', 'Other OTA'].includes(bookingSource) ||
                        (!['Direct', 'Walk-in', 'Corporate', 'Phone', 'Website', 'Travel Agent'].includes(bookingSource) && bookingSource !== '');
                      const mainBookingSource: 'Direct' | 'Walk-in' | 'Corporate' | 'Travel Agent' | 'OTA' =
                        bookingSource === 'Travel Agent'
                          ? 'Travel Agent'
                          : bookingSource === 'Walk-in'
                          ? 'Walk-in'
                          : bookingSource === 'Corporate'
                          ? 'Corporate'
                          : isOtaSelected
                          ? 'OTA'
                          : 'Direct';

                      return (
                        <select
                          value={mainBookingSource}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Direct' || val === 'Walk-in' || val === 'Corporate') {
                              setBookingSource(val as BookingSource);
                              setSelectedAgentId('');
                              setCommissionValue(0);
                            } else if (val === 'Travel Agent') {
                              setBookingSource('Travel Agent');
                            } else if (val === 'OTA') {
                              setBookingSource('MakeMyTrip');
                              setSelectedAgentId('');
                              setCommissionValue(0);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-bold bg-white text-luxury-brown-900 focus:outline-none focus:border-luxury-gold-500"
                        >
                          <option value="Direct">Individual / Direct</option>
                          <option value="Walk-in">Walk-in</option>
                          <option value="Corporate">Corporate</option>
                          <option value="Travel Agent">Travel Agent</option>
                          <option value="OTA">OTA (MakeMyTrip, Booking, etc.)</option>
                        </select>
                      );
                    })()}
                  </div>
                </div>

                {/* Dedicated Online Travel Partner (OTA) Details (Shown when OTA is selected) */}
                {['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Airbnb', 'OYO', 'Expedia', 'OTA', 'Other OTA'].includes(bookingSource) && (
                  <div className="p-3 rounded-xl bg-[#FFFDF7] border border-indigo-300/70 space-y-2.5 animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                      <span className="text-[11px] font-mono font-extrabold uppercase text-indigo-950 flex items-center gap-1.5">
                        🌐 Online Travel Partner (OTA) Details
                      </span>
                      <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        OTA: {bookingSource}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">
                          Select OTA Platform *
                        </label>
                        <select
                          value={['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Airbnb', 'OYO', 'Expedia'].includes(bookingSource) ? bookingSource : 'Other OTA'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Other OTA') {
                              setBookingSource('Other OTA');
                            } else {
                              setBookingSource(val as BookingSource);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="MakeMyTrip">MakeMyTrip</option>
                          <option value="Goibibo">Goibibo</option>
                          <option value="Booking.com">Booking.com</option>
                          <option value="Agoda">Agoda</option>
                          <option value="Airbnb">Airbnb</option>
                          <option value="OYO">OYO Rooms</option>
                          <option value="Expedia">Expedia</option>
                          <option value="Other OTA">Other OTA / Custom</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">
                          OTA Booking ID / Ref # (Optional)
                        </label>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="e.g. MMT-1029482 / BKG-8472"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Select Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-mono text-slate-500 mr-1">Quick Select:</span>
                      {['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Airbnb', 'OYO', 'Expedia'].map((ota) => (
                        <button
                          key={ota}
                          type="button"
                          onClick={() => setBookingSource(ota as BookingSource)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                            bookingSource === ota
                              ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs'
                              : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100/50'
                          }`}
                        >
                          {ota}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Travel Agent & Commission Selector (Shown when Travel Agent source is selected) */}
                {(bookingSource === 'Travel Agent' || Boolean(selectedAgentId)) && (
                  <div className="p-3 rounded-xl bg-[#FFFDF7] border border-[#C49A3A]/40 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-extrabold uppercase text-[#8B691E]">
                        Travel Agent &amp; Commission
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddAgent(!showQuickAddAgent)}
                        className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-[#FBF4E0] hover:bg-[#F3E2B3] text-[#8B691E] border border-[#C49A3A]/40 cursor-pointer"
                      >
                        {showQuickAddAgent ? 'Cancel' : '+ Add New Travel Agent'}
                      </button>
                    </div>

                    {showQuickAddAgent && (
                      <div className="p-3 rounded-lg bg-white border border-[#C49A3A]/40 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-600 block">Agent Name *</label>
                          <input
                            type="text"
                            value={quickAgentName}
                            onChange={(e) => setQuickAgentName(e.target.value)}
                            placeholder="e.g. Rajesh Travels"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-600 block">Mobile</label>
                          <input
                            type="tel"
                            value={quickAgentMobile}
                            onChange={(e) => setQuickAgentMobile(e.target.value.replace(/\D/g, ''))}
                            placeholder="9876543210"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-600 block">Default Comm %</label>
                          <input
                            type="number"
                            min={0}
                            value={quickAgentCommVal}
                            onChange={(e) => setQuickAgentCommVal(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickAddTravelAgent}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded cursor-pointer"
                        >
                          Save Agent
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Select Travel Agent</label>
                        <select
                          value={selectedAgentId}
                          onChange={(e) => {
                            const agId = e.target.value;
                            setSelectedAgentId(agId);
                            const found = travelAgents.find(a => a.id === agId);
                            if (found) {
                              setCommissionType(found.commissionType || 'percentage');
                              setCommissionValue(Number(found.commissionValue) || 0);
                            } else {
                              setCommissionValue(0);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold"
                        >
                          <option value="">— Select Agent —</option>
                          {travelAgents.filter(a => a.status !== 'Inactive').map(ag => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name}{ag.agencyName && ag.agencyName !== ag.name ? ` (${ag.agencyName})` : ''} — {ag.commissionType === 'fixed' ? `₹${Number(ag.commissionValue) || 0}` : `${Number(ag.commissionValue) || 0}%`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedAgentId && (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Commission</label>
                            <div className="flex gap-1.5">
                              <select
                                value={commissionType}
                                onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
                                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                              >
                                <option value="percentage">%</option>
                                <option value="fixed">₹</option>
                              </select>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={commissionValue}
                                onChange={(e) => setCommissionValue(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white"
                              />
                            </div>
                          </div>

                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-mono flex items-center justify-between">
                            <span className="text-emerald-800 font-semibold">
                              {isStatusConfirmedForComm ? 'Commission:' : 'Est. Comm:'}
                            </span>
                            <strong className="text-emerald-700 text-sm">
                              ₹{rawCalculatedCommission.toLocaleString('en-IN')}
                            </strong>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* (B) GUEST INFORMATION */}
              <div className="p-3.5 rounded-xl bg-white border border-luxury-brown-200/70 space-y-3">
                <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#263449] block border-b border-slate-100 pb-1.5">
                  (B) Guest Information :-
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Guest Name *</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Rahul Sen"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Mobile No. *</label>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="guest@example.com"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Guest full address or city"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Nationality</label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      placeholder="Indian"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Corporate / Firm Name"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">GSTIN</label>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono uppercase bg-white text-luxury-brown-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Purpose of Visit</label>
                    <input
                      type="text"
                      value={purposeOfVisit}
                      onChange={(e) => setPurposeOfVisit(e.target.value)}
                      placeholder="Personal / Business / Official"
                      className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900"
                    />
                  </div>
                </div>
              </div>

              {/* (C) STAY & ROOM DETAILS — EXACT SIR SHEET ORDER */}
              <div className="p-3.5 rounded-xl bg-white border border-luxury-brown-200/70 space-y-3.5">
                <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#263449] block border-b border-slate-100 pb-1.5">
                  (C) Stay &amp; Room Details :-
                </span>

                {/* 1. Arrival Date & Departure Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <div className="min-h-[22px] flex items-center justify-between">
                      <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                        Arrival Date *
                      </label>
                      <span className="text-[10px] font-mono text-[#8B691E] font-bold">
                        {checkInTime}
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_95px] gap-1">
                      <input
                        type="date"
                        required
                        min={editingBooking || allowBackDatedCheckIn ? undefined : getTodayDateStr()}
                        value={checkInDate}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) => handleCheckInDateChange(e.target.value)}
                        className="w-full h-9 px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900"
                      />
                      <input
                        type="time"
                        value={to24hTime(checkInTime, '12:00')}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const today = getTodayDateStr();
                          const now = new Date();
                          const nowHhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                          if (!editingBooking && !allowBackDatedCheckIn && checkInDate === today && val < nowHhmm) {
                            showToast('Past arrival time blocked. Enable back-dated check-in in Property Setup.', 'warning');
                            return;
                          }
                          setCheckInTime(to12hTime(val, '12:00 PM'));
                        }}
                        className="w-full h-9 px-2 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900"
                        title="Arrival Time (Back-Time)"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="min-h-[22px] flex items-center justify-between gap-1.5">
                      <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Departure Date</label>
                      {checkInDate && checkOutDate && checkInDate === checkOutDate ? (
                        <span className="text-[9.5px] leading-none text-indigo-700 font-bold font-mono bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          ⚡ Hourly / Day-Use Stay
                        </span>
                      ) : checkOutDate ? (
                        <div className="flex items-center gap-1.5 leading-none">
                          <button
                            type="button"
                            onClick={() => handleCheckOutDateChange(checkInDate)}
                            className="text-[9.5px] leading-none text-indigo-700 hover:text-indigo-900 underline font-mono cursor-pointer"
                            title="Set same-day hourly stay"
                          >
                            + Same-Day Stay
                          </button>
                          <span className="text-slate-300 leading-none">|</span>
                          <button
                            type="button"
                            onClick={() => handleCheckOutDateChange('')}
                            className="text-[9.5px] leading-none text-amber-700 hover:text-amber-900 underline font-mono cursor-pointer"
                          >
                            Open Stay
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9.5px] leading-none text-amber-600 font-bold font-mono">(Open Stay)</span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={checkOutDate}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => handleCheckOutDateChange(e.target.value)}
                      onBlur={handleCheckOutDateBlur}
                      className="w-full h-9 px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900"
                    />
                  </div>
                </div>

                {/* Same-Day / Hourly Stay Duration Options (Shown only when Arrival Date === Departure Date) */}
                {checkInDate && checkOutDate && checkInDate === checkOutDate && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50/70 via-indigo-50/60 to-purple-50/50 border border-indigo-200/80 space-y-2 animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-700 text-white tracking-wider">
                          ⚡ Day-Use / Hourly Stay (Same Date)
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          (Check-in &amp; Check-out on {checkInDate})
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-full">
                        Duration Optional (Not Mandatory)
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-mono font-bold uppercase text-slate-700 whitespace-nowrap">
                          Stay Hours:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={stayHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStayHours(val === '' ? '' : Math.max(1, Math.min(24, parseInt(val, 10) || 1)));
                          }}
                          placeholder="e.g. 3"
                          className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                        <span className="text-xs font-mono text-slate-500">Hours</span>
                      </div>

                      {/* Quick Select Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-500 mr-1">Quick Select:</span>
                        {[2, 3, 4, 6, 8, 12].map((hrs) => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => setStayHours(hrs)}
                            className={`px-2 py-1 text-[10px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                              stayHours === hrs
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
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      Guest ko agar confirm duration nahi pata, to isse blank chhod sakte hain (Not Mandatory).
                    </p>
                  </div>
                )}

                {/* 2. No. of Rooms & No. of Night */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <div className="min-h-[22px] flex items-center justify-between gap-2">
                      <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">No. of Rooms *</label>
                      {selectedRoomList.length > 0 && (
                        <span className="text-[10px] leading-none font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          {selectedRoomList.length} Room{selectedRoomList.length > 1 ? 's' : ''} Selected
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={numberOfRooms}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleNumberOfRoomsChange(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-9 px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="min-h-[22px] flex items-center justify-between">
                      <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                        No. of Night {!checkOutDate ? '(Open Stay)' : ''}
                      </label>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={calNights()}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleNightsInputChange(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-9 px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* 3. Choose Rooms (Category-Wise Room Picker) */}
                <div className="space-y-2.5 p-3 rounded-xl bg-amber-50/30 border border-amber-200/80">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-[11px] font-mono text-luxury-brown-800 uppercase font-bold tracking-wide">
                        Choose Rooms (Category-Wise)
                      </span>
                      <span className="text-[10px] text-luxury-brown-500 font-sans ml-2">
                        (Click room numbers to allocate)
                      </span>
                    </div>
                    {selectedRoomList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoomNumber('');
                          setIsMultiRoomMode(false);
                          setMultiRoomSelections([]);
                          setNumberOfRooms(1);
                          if (rooms[0]) {
                            setRoomType(rooms[0].category);
                            setRoomPrice(rooms[0].rate);
                            setBookingPrice(computeAutoPriceForStay(rooms[0].rate, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, rooms[0]));
                          }
                        }}
                        className="text-[10px] font-mono font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                      >
                        Reset Selection
                      </button>
                    )}
                  </div>

                  {/* Category Groups with Room Number Pills */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {categoriesForPicker.length === 0 ? (
                      <div className="text-xs text-luxury-brown-500 italic p-2">
                        No rooms configured yet in Room Management.
                      </div>
                    ) : (
                      categoriesForPicker.map(cat => {
                        const catRooms = rooms.filter(r => r.category === cat);
                        if (catRooms.length === 0) return null;
                        const availCount = catRooms.filter(r => isRoomAvailableForReservation(r, checkInDate, checkOutDate, editingBooking?.id)).length;
                        return (
                          <div key={cat} className="p-2.5 rounded-lg bg-white border border-luxury-brown-200/80 shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-luxury-brown-900 tracking-wide">
                                {cat}
                              </span>
                              <span className="text-[10px] font-mono text-luxury-brown-600">
                                {availCount} of {catRooms.length} Available
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {catRooms.map(rm => {
                                const rmNum = String(rm.number).trim();
                                const isPicked = selectedRoomList.includes(rmNum);
                                const isAvail = isRoomAvailableForReservation(rm, checkInDate, checkOutDate, editingBooking?.id);
                                return (
                                  <button
                                    key={rm.id || rm.number}
                                    type="button"
                                    disabled={!isAvail && !isPicked}
                                    onClick={() => handleToggleRoom(rm)}
                                    title={
                                      !isAvail && !isPicked
                                        ? `Room ${rm.number} is occupied / reserved`
                                        : `Click to ${isPicked ? 'remove' : 'select'} Room ${rm.number} (₹${rm.rate}/night)`
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                      isPicked
                                        ? 'bg-[#7B1123] text-white border-2 border-[#5a0c1a] shadow-xs'
                                        : isAvail
                                        ? 'bg-amber-50/60 text-luxury-brown-900 border border-luxury-brown-300 hover:border-[#7B1123] hover:bg-amber-100'
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50 line-through'
                                    }`}
                                  >
                                    <span>Room {rm.number}</span>
                                    {isPicked && <span className="text-[11px] font-black">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Selected Room Numbers Summary Display */}
                  {selectedRoomList.length > 0 ? (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-950">
                          Allocated Room Numbers:
                        </span>
                        {selectedRoomList.map(num => {
                          const rmObj = rooms.find(r => String(r.number).trim() === num);
                          return (
                            <span
                              key={num}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-emerald-300 text-xs font-mono font-bold text-emerald-900 shadow-2xs"
                            >
                              <span>Room {num}</span>
                              {rmObj && <span className="text-[10px] text-slate-500 font-sans font-normal">({rmObj.category})</span>}
                              <button
                                type="button"
                                onClick={() => rmObj && handleToggleRoom(rmObj)}
                                className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                                title="Remove room"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-700">
                        Total {selectedRoomList.length} Room{selectedRoomList.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-white border border-dashed border-amber-300 text-[11px] text-luxury-brown-700">
                      <span className="font-bold text-luxury-brown-900">Auto-allocation:</span> Leave empty to auto-allocate upon check-in, or click room numbers above to allocate.
                    </div>
                  )}
                </div>

                {/* 4. No. of Person — Male, Female, Child */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                    No. of Person — Male / Female / Child
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 border border-luxury-brown-200 rounded-lg px-3 py-1.5 bg-white">
                      <span className="text-xs font-bold text-slate-700">Male:</span>
                      <input
                        type="number"
                        min={0}
                        value={maleCount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const m = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setMaleCount(m);
                          const totAd = Math.max(1, m + (Number(femaleCount) || 0));
                          setAdults(totAd);
                          if (!isMultiRoomMode) {
                            setBookingPrice(computeAutoPriceForStay(roomPrice, Math.max(1, calNights()), totAd, Number(childCount) || 0, activeMatchedRoom, hasExtraBed, extraBedCount, extraBedRate));
                          }
                        }}
                        className="w-full text-xs font-mono font-bold text-luxury-brown-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 border border-luxury-brown-200 rounded-lg px-3 py-1.5 bg-white">
                      <span className="text-xs font-bold text-slate-700">Female:</span>
                      <input
                        type="number"
                        min={0}
                        value={femaleCount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const f = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setFemaleCount(f);
                          const totAd = Math.max(1, (Number(maleCount) || 0) + f);
                          setAdults(totAd);
                          if (!isMultiRoomMode) {
                            setBookingPrice(computeAutoPriceForStay(roomPrice, Math.max(1, calNights()), totAd, Number(childCount) || 0, activeMatchedRoom, hasExtraBed, extraBedCount, extraBedRate));
                          }
                        }}
                        className="w-full text-xs font-mono font-bold text-luxury-brown-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 border border-luxury-brown-200 rounded-lg px-3 py-1.5 bg-white">
                      <span className="text-xs font-bold text-slate-700">Child:</span>
                      <input
                        type="number"
                        min={0}
                        value={childCount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const c = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setChildCount(c);
                          setChildren(c);
                          if (!isMultiRoomMode) {
                            setBookingPrice(computeAutoPriceForStay(roomPrice, Math.max(1, calNights()), Number(adults) || 1, c, activeMatchedRoom, hasExtraBed, extraBedCount, extraBedRate));
                          }
                        }}
                        className="w-full text-xs font-mono font-bold text-luxury-brown-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>



                {/* 6. Rate — Sgl [ ] Dbl [ ] Extra Bed [ ] (+ Total Tariff) */}
                {!isMultiRoomMode ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                        Rate — Sgl / Dbl / Extra Bed
                      </label>
                      <button
                        type="button"
                        onClick={handleRenewReservationPrice}
                        title="Renew/Reset room rate back to standard catalog rate (Point 6)"
                        className="text-[10px] font-mono font-bold text-amber-700 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-200/80 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        ↺ Renew Price
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Sgl Rate (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={singleRate}
                          onWheel={(e) => e.currentTarget.blur()}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setSingleRate(val);
                            if (occupancyType === 'Single') {
                              setRoomPrice(val);
                              setBookingPrice(computeAutoPriceForStay(val, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, activeMatchedRoom, hasExtraBed, extraBedCount, extraBedRate));
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono font-bold bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Dbl Rate (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={doubleRate}
                          onWheel={(e) => e.currentTarget.blur()}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setDoubleRate(val);
                            if (occupancyType === 'Double') {
                              setRoomPrice(val);
                              setBookingPrice(computeAutoPriceForStay(val, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, activeMatchedRoom, hasExtraBed, extraBedCount, extraBedRate));
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono font-bold bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Extra Bed (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={extraBedRate}
                          onWheel={(e) => e.currentTarget.blur()}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setExtraBedRate(val);
                            if (hasExtraBed) {
                              setBookingPrice(
                                computeAutoPriceForStay(roomPrice, Math.max(1, calNights()), Number(adults) || 1, Number(children) || 0, activeMatchedRoom, true, extraBedCount, val)
                              );
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono font-bold bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-luxury-gold-700 block uppercase font-bold">
                          Total ({calNights()} Night{calNights() === 1 ? '' : 's'}) ₹
                        </label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={bookingPrice}
                          onWheel={(e) => e.currentTarget.blur()}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setBookingPrice(parseInt(e.target.value, 10) || 0)}
                          className="w-full px-2.5 py-1.5 border border-luxury-gold-500 rounded text-xs font-mono font-extrabold bg-white text-luxury-brown-950"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-luxury-gold-700 block uppercase font-bold">
                      Total Room Amount ({multiRoomSelections.length} Rooms × {calNights()} Night{calNights() === 1 ? '' : 's'}) ₹
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={bookingPrice}
                      onWheel={(e) => e.currentTarget.blur()}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setBookingPrice(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-1.5 border border-luxury-gold-500 rounded-lg text-xs font-mono font-extrabold bg-white text-luxury-brown-950"
                    />
                  </div>
                )}

                {/* 6B. Available Extra Services / Optional Hotel Services */}
                <div className="p-3 rounded-xl bg-teal-50/40 border border-teal-200/80 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#263449] font-mono uppercase text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-teal-700" /> Available Extra Services / Options ({serviceCatalog.length})
                      </span>
                      <span className="text-[11px] text-slate-600 block">
                        Select any extra services requested for this Advance Booking (carries automatically into Check-In &amp; Billing)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-teal-800 bg-white px-2.5 py-1 border border-teal-200 rounded-lg">
                        Extra Services Total: + ₹{servicesTotal.toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddServiceBox(prev => !prev)}
                        className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      >
                        {showAddServiceBox ? '✕ Close Form' : '+ Add Service'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Add Custom Service Form */}
                  {showAddServiceBox && (
                    <div className="p-3 rounded-xl bg-white border border-teal-300 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-950 font-mono uppercase tracking-wide">
                          Add New Extra Service
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          (Set Price and Flat Rate vs. Per Person calculation)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-5 space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-600 block uppercase">
                            Service Name *
                          </label>
                          <input
                            type="text"
                            value={newServiceName}
                            onChange={(e) => setNewServiceName(e.target.value)}
                            placeholder="e.g. Candle Light Dinner, Airport Cab, Jungle Safari"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-600 block uppercase">
                            Price (₹) *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={newServicePrice}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setNewServicePrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            placeholder="Amount in ₹"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] font-mono font-bold text-slate-600 block uppercase">
                            Pricing
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer py-1.5">
                            <input
                              type="checkbox"
                              checked={newServiceIsPerPerson}
                              onChange={(e) => setNewServiceIsPerPerson(e.target.checked)}
                              className="w-4 h-4 accent-teal-700 cursor-pointer"
                            />
                            <span>Per Person</span>
                          </label>
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            onClick={handleCreateCustomService}
                            className="w-full py-1.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          >
                            Add &amp; Select
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {serviceCatalog.length === 0 ? (
                    <p className="text-[11px] italic text-slate-500">
                      No extra services yet. Click "+ Add Service" above to add one.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {serviceCatalog.map(s => {
                        const sid = String(s.id);
                        const checked = selectedServiceIds.includes(sid);
                        const unitPrice = serviceCustomRates[sid] !== undefined
                          ? serviceCustomRates[sid]
                          : Math.max(0, Number(s.configuredAmount ?? s.chargeAmount ?? 0));
                        const isPerPerson = servicePerPerson[sid] !== undefined
                          ? servicePerPerson[sid]
                          : Boolean((s as any).isPerPerson);
                        const defaultQty = isPerPerson ? Math.max(1, Number(adults) || 1) : 1;
                        const qty = serviceQuantities[sid] !== undefined ? serviceQuantities[sid] : defaultQty;

                        return (
                          <div
                            key={sid}
                            className={`p-2.5 rounded-lg border transition-all ${
                              checked
                                ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
                                : 'bg-white border-slate-200 hover:border-teal-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex items-center gap-2 font-semibold text-[#263449] text-xs cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => {
                                    const nextChecked = e.target.checked;
                                    setSelectedServiceIds(prev =>
                                      nextChecked ? [...prev, sid] : prev.filter(x => x !== sid)
                                    );
                                    if (nextChecked && serviceQuantities[sid] === undefined) {
                                      setServiceQuantities(prev => ({
                                        ...prev,
                                        [sid]: isPerPerson ? Math.max(1, Number(adults) || 1) : 1
                                      }));
                                    }
                                  }}
                                  className="w-4 h-4 accent-[#15805D] cursor-pointer"
                                />
                                <span>{s.serviceName}</span>
                              </label>

                              <span className="font-mono font-bold text-[#263449] text-xs">
                                + ₹{serviceAmountOf(s).toLocaleString('en-IN')}
                              </span>
                            </div>

                            {/* Service Rate & Per Person Controls */}
                            <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100 flex-wrap">
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-[10px] font-mono text-slate-500 font-bold">₹</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={unitPrice}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    setServiceCustomRates(prev => ({ ...prev, [sid]: val }));
                                  }}
                                  className="w-16 px-1.5 py-0.5 border border-slate-200 rounded font-mono text-xs font-bold text-slate-800 bg-white"
                                  title="Price / Rate"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isPerPerson}
                                    onChange={(e) => {
                                      const nextPerPerson = e.target.checked;
                                      setServicePerPerson(prev => ({ ...prev, [sid]: nextPerPerson }));
                                      setServiceQuantities(prev => ({
                                        ...prev,
                                        [sid]: nextPerPerson ? Math.max(1, Number(adults) || 1) : 1
                                      }));
                                    }}
                                    className="w-3.5 h-3.5 accent-teal-700 cursor-pointer"
                                  />
                                  <span>Per Person</span>
                                </label>

                                {checked && (
                                  <div className="flex items-center gap-1 bg-teal-100/60 px-1.5 py-0.5 rounded border border-teal-300">
                                    <span className="text-[10px] font-mono text-teal-900 font-bold">
                                      {isPerPerson ? 'Persons:' : 'Qty:'}
                                    </span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={50}
                                      value={qty}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                        setServiceQuantities(prev => ({ ...prev, [sid]: val }));
                                      }}
                                      className="w-10 px-1 py-0.5 border border-teal-300 rounded text-center text-xs font-mono font-bold bg-white text-teal-950"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 7. Tax Mode (With GST vs No GST) + Advance Payment Mode & Rupees */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  {/* 3-Way GST Billing Mode Selector */}
                  <div className="bg-[#FFFDF7] border border-luxury-brown-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-mono uppercase font-bold text-luxury-brown-900 block">
                        GST Billing Mode *
                      </label>
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                        bookingGstMode === 'non_gst'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : bookingGstMode === 'including_gst'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}>
                        {bookingGstMode === 'non_gst'
                          ? 'Non-GST (0% Bill of Supply)'
                          : bookingGstMode === 'including_gst'
                          ? `Including GST (${bookingGstRate || configuredDefaultGst || 5}%)`
                          : `GST Extra (+${bookingGstRate || configuredDefaultGst || 5}%)`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBookingGstMode('non_gst');
                          setBookingGstRate(0);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          bookingGstMode === 'non_gst'
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
                          setBookingGstMode('gst_extra');
                          setBookingGstRate(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          bookingGstMode === 'gst_extra'
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
                          setBookingGstMode('including_gst');
                          setBookingGstRate(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          bookingGstMode === 'including_gst'
                            ? 'bg-blue-100 border-blue-500 text-blue-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">3. Including GST ({configuredDefaultGst > 0 ? configuredDefaultGst : 5}%)</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Tariff Includes GST (Net ₹{bookingPrice || 0})</div>
                      </button>
                    </div>
                  </div>
                  {editingBooking && invoices?.some(inv => inv.bookingId === editingBooking.id && !inv.isSeparateInvoice) && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                      🔒 An invoice is already generated for this booking. GST on an existing invoice cannot be edited — if a different GST mode is needed, generate a separate invoice.
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-extrabold uppercase text-[#263449]">
                      Advance — Payment Mode &amp; Rupees
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Payment Mode</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Voucher'] as PaymentMethod[]).map((pm) => {
                          const checked = !isHybridAdvance && paymentMethod === pm;
                          return (
                            <button
                              type="button"
                              key={pm}
                              onClick={() => {
                                setIsHybridAdvance(false);
                                setPaymentMethod(pm);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                                checked ? 'bg-[#FBF4E0] !text-[#17120F] border-[#C49A3A] ring-1 ring-[#C49A3A]' : 'bg-white !text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <span>{pm === 'Bank Transfer' ? 'Bank' : pm}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setIsHybridAdvance(true);
                            const sum = advanceSplitRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
                            setAdvanceAmount(sum);
                            if (bookingStatus !== 'Cancelled') {
                              setBookingStatus(sum > 0 ? 'Confirmed' : 'In Process');
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                            isHybridAdvance
                              ? 'bg-[#FBF4E0] !text-[#17120F] border-[#C49A3A] ring-1 ring-[#C49A3A]'
                              : 'bg-white !text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>⇄ Hybrid / Split</span>
                        </button>
                      </div>
                    </div>

                    {isHybridAdvance ? (
                      <div className="p-3 rounded-xl bg-[#FFFCF5] border border-[#E7E0D2] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-luxury-brown-950 block">
                              Hybrid Advance — Collect by Multiple Methods
                            </span>
                            <span className="text-[10.5px] text-slate-500">
                              Example: Cash ₹2,000 + UPI ₹3,000
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAdvanceSplitRows(prev => [
                                ...prev,
                                { id: `adv-sp-${Date.now()}`, method: 'UPI', amount: '', ref: '' },
                              ])
                            }
                            className="px-2.5 py-1 rounded-lg border border-luxury-brown-300 bg-white hover:bg-amber-50 text-[11px] font-bold text-luxury-brown-900 cursor-pointer"
                          >
                            + Add Method
                          </button>
                        </div>

                        <div className="space-y-2">
                          {advanceSplitRows.map((row) => (
                            <div
                              key={row.id}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-2 rounded-lg border border-slate-200"
                            >
                              <div className="sm:col-span-4 space-y-0.5">
                                <label className="text-[9.5px] font-mono uppercase font-bold text-slate-600 block">
                                  Method
                                </label>
                                <select
                                  value={row.method}
                                  onChange={(e) => {
                                    const next = advanceSplitRows.map(r =>
                                      r.id === row.id ? { ...r, method: e.target.value as PaymentMethod } : r
                                    );
                                    setAdvanceSplitRows(next);
                                  }}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-900"
                                >
                                  <option value="Cash">Cash</option>
                                  <option value="UPI">UPI</option>
                                  <option value="Card">Card</option>
                                  <option value="Bank Transfer">Bank Transfer</option>
                                  <option value="Online">Online</option>
                                </select>
                              </div>
                              <div className="sm:col-span-3 space-y-0.5">
                                <label className="text-[9.5px] font-mono uppercase font-bold text-slate-600 block">
                                  Received (₹)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={row.amount}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                                    const next = advanceSplitRows.map(r =>
                                      r.id === row.id ? { ...r, amount: val } : r
                                    );
                                    setAdvanceSplitRows(next);
                                    const sum = Math.round(next.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
                                    setAdvanceAmount(sum);
                                    if (bookingStatus !== 'Cancelled') {
                                      setBookingStatus(sum > 0 ? 'Confirmed' : 'In Process');
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white text-slate-900"
                                />
                              </div>
                              <div className="sm:col-span-4 space-y-0.5">
                                <label className="text-[9.5px] font-mono uppercase font-bold text-slate-600 block">
                                  Reference / UTR (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={row.ref}
                                  placeholder="Receipt / UTR"
                                  onChange={(e) => {
                                    const next = advanceSplitRows.map(r =>
                                      r.id === row.id ? { ...r, ref: e.target.value } : r
                                    );
                                    setAdvanceSplitRows(next);
                                  }}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white text-slate-900"
                                />
                              </div>
                              <div className="sm:col-span-1 flex justify-end">
                                {advanceSplitRows.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = advanceSplitRows.filter(r => r.id !== row.id);
                                      setAdvanceSplitRows(next);
                                      const sum = Math.round(next.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
                                      setAdvanceAmount(sum);
                                      if (bookingStatus !== 'Cancelled') {
                                        setBookingStatus(sum > 0 ? 'Confirmed' : 'In Process');
                                      }
                                    }}
                                    className="px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer"
                                    title="Remove payment method"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs font-mono">
                          <span className="text-slate-700 font-semibold">Combined Advance Received</span>
                          <strong className="text-emerald-800 text-sm">₹{advanceAmount.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Advance Rupees (₹)</label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={advanceAmount}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const adv = Math.max(0, parseFloat(e.target.value) || 0);
                              setAdvanceAmount(adv);
                              if (bookingStatus !== 'Cancelled') {
                                setBookingStatus(adv > 0 ? 'Confirmed' : 'In Process');
                              }
                            }}
                            placeholder="0"
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Reference / Transaction ID (Optional)</label>
                          <input
                            type="text"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Optional receipt or UTR reference"
                            className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {paymentMethod === 'Voucher' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Voucher No.</label>
                      <input
                        type="text"
                        value={voucherNumber}
                        onChange={(e) => setVoucherNumber(e.target.value)}
                        placeholder="Enter Agency / Corporate Voucher No."
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 text-xs font-mono">
                    <span className="text-slate-600">
                      Total Payable: <strong className="text-slate-900">₹{totalPayableWithGst.toLocaleString('en-IN')}</strong>
                      {bookingGstMode === 'including_gst'
                        ? ` (Tariff incl. ₹${calculatedBookingGst.toLocaleString('en-IN')} GST)`
                        : bookingGstMode !== 'non_gst' && bookingGstRate > 0
                        ? ` (incl. ₹${calculatedBookingGst.toLocaleString('en-IN')} GST)`
                        : ' (Without GST)'}
                    </span>
                    <span className={pendingAmount > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                      Balance Due: ₹{pendingAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* 8. Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter booking description / remarks..."
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900 resize-none"
                  />
                </div>
              </div>

              {/* Direct Save Actions */}
              <div className="flex gap-2 justify-end pt-3 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-700 text-xs rounded-lg transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 !text-[#17120F] font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer"
                >
                  {editingBooking ? 'Update Advance Booking' : 'Save Advance Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Send Confirmation Modal */}
      {showWhatsAppModal && savedBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative bg-white rounded-2xl border border-emerald-500/20 shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-serif font-semibold text-luxury-brown-950">Booking Confirmed & Saved!</h3>
              <p className="text-xs text-luxury-brown-500">
                Booking ID: <strong className="font-mono text-luxury-brown-900">{savedBooking.id}</strong> has been saved.
              </p>
            </div>

            <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100 space-y-2 text-xs text-luxury-brown-800">
              <p><strong>Guest:</strong> {savedBooking.guestName}</p>
              <p><strong>Mobile:</strong> {savedBooking.mobile}</p>
              <p><strong>Room Type:</strong> {savedBooking.roomType}</p>
              <p><strong>Stay Term:</strong> {savedBooking.checkInDate} to {savedBooking.checkOutDate}</p>
              <p><strong>Room Price:</strong> ₹{Number(savedBooking.bookingAmount || 0).toLocaleString()}</p>
              {(savedBooking.gstAmount || 0) > 0 && (
                <p><strong>GST ({savedBooking.gstRate || 0}%):</strong> ₹{Number(savedBooking.gstAmount || 0).toLocaleString()}</p>
              )}
              <p><strong>Total Payable:</strong> ₹{((savedBooking.bookingAmount || 0) + (savedBooking.gstAmount || 0)).toLocaleString()}</p>
              <p><strong>Advance Amount:</strong> ₹{Number(savedBooking.advanceAmount || 0).toLocaleString()} ({savedBooking.paymentMethod})</p>
              <p><strong>Pending Balance:</strong> <span className="font-mono font-bold text-rose-600">₹{Math.max(0, ((savedBooking.bookingAmount || 0) + (savedBooking.gstAmount || 0)) - savedBooking.advanceAmount).toLocaleString()}</span></p>
            </div>

            <button
              onClick={() => {
                const bkg = savedBooking;
                setShowWhatsAppModal(false);
                setSavedBooking(null);
                handleGenerateOrViewInvoice(bkg);
              }}
              className="w-full py-2.5 bg-[#C49A3A] hover:bg-[#B0862B] !text-[#17120F] font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 border border-[#C49A3A] cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-[#17120F]" /> Generate & View Official Invoice
            </button>

            <button
              onClick={() => {
                const totalPay = (savedBooking.bookingAmount || 0) + (savedBooking.gstAmount || 0);
                const pending = Math.max(0, totalPay - savedBooking.advanceAmount);
                const message = `Hello *${savedBooking.guestName}*,\n\n` +
                  `Your reservation at *${hotelSettings?.name || 'Grand Pavilion'}* is confirmed! 🎉\n\n` +
                  `*Booking Details:*\n` +
                  `• Booking ID: ${savedBooking.id}\n` +
                  `• Room Type: ${savedBooking.roomType}\n` +
                  `• Stay Timeline: ${savedBooking.checkInDate} to ${savedBooking.checkOutDate} (${savedBooking.nights} nights)\n\n` +
                  `*Billing Summary:*\n` +
                  `• Booking Price: ₹${savedBooking.bookingAmount}\n` +
                  ((savedBooking.gstAmount || 0) > 0 ? `• GST (${savedBooking.gstRate || 0}%): ₹${savedBooking.gstAmount}\n` : '') +
                  `• Total Payable: ₹${totalPay}\n` +
                  `• Advance Amount Paid: ₹${savedBooking.advanceAmount} via ${savedBooking.paymentMethod}\n` +
                  `• Pending Amount: ₹${pending}\n\n` +
                  `Thank you for choosing us! We look forward to welcoming you soon.\n\n` +
                  `_Sent from Hotel Booking Desk_`;
                openWhatsAppChat(savedBooking.mobile, message);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" /> Send WhatsApp Confirmation
            </button>

            <button
              type="button"
              onClick={() => {
                void handleSendBookingEmailAction(savedBooking, 'booking_confirmation', true);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mail className="w-4 h-4" /> Send Email Confirmation
            </button>

            <button
              onClick={() => {
                setShowWhatsAppModal(false);
                setSavedBooking(null);
              }}
              className="w-full py-2 border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-700 text-xs rounded-xl transition-colors font-medium cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Official Invoice Preview & Print Modal */}
      {viewingInvoice && (
        <div className="invoice-print-modal-root fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 print:static print:block print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="relative bg-white rounded-2xl border border-[#C49A3A]/40 shadow-2xl max-w-3xl w-full overflow-hidden animate-fadeIn my-6 print:my-0 print:max-w-none print:w-full print:rounded-none print:border-none print:shadow-none">
            {/* Top Gold Executive Accent Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#C49A3A] via-[#E0BD6B] to-[#C49A3A]" />

            {/* Modal Screen Header (Hidden in Print) */}
            <div className="bg-gradient-to-r from-[#FFFDF7] to-[#FBF4E0] text-[#263449] py-3.5 px-6 flex flex-wrap justify-between items-center gap-3 border-b border-[#C49A3A]/30 no-print">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#C49A3A]/15 text-[#8B691E] rounded-lg border border-[#C49A3A]/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-[#263449] tracking-wide flex items-center gap-2">
                    {viewingInvoice.gst > 0 ? 'Official GST Tax Invoice' : 'Official Room Bill (No GST)'} <span className="font-mono text-[#8B691E] text-xs font-bold">({viewingInvoice.invoiceNumber})</span>
                  </h3>
                  <p className="text-[11px] text-[#5A6B82] font-mono">
                    GST mode is permanently locked after invoice generation. Need {Number(viewingInvoice.gst || 0) > 0 ? 'No GST' : 'With GST'}? Generate a separate invoice.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
                    Number(viewingInvoice.gst || 0) > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  🔒 Locked: {Number(viewingInvoice.gst || 0) > 0 ? `With GST (${viewingInvoice.gstRate || configuredDefaultGst}%)` : 'No GST (0%)'}
                </span>
                {onUpdateInvoices && (
                  <button
                    type="button"
                    onClick={() => handleCreateSeparateInvoiceFromViewing(Number(viewingInvoice.gst || 0) <= 0)}
                    className="px-3 py-1.5 rounded-lg bg-[#263449] hover:bg-[#1b2636] text-white text-xs font-mono font-bold shadow-2xs cursor-pointer transition-all"
                  >
                    + Separate Invoice ({Number(viewingInvoice.gst || 0) > 0 ? 'No GST' : 'With GST'})
                  </button>
                )}

                <button
                  onClick={() => setViewingInvoice(null)}
                  className="text-[#5A6B82] hover:text-[#263449] p-1.5 rounded-lg hover:bg-[#C49A3A]/15 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Container — Exact Client PDF Replica ("HOTEL M M PRESTIGE" Layout) */}
            <div className="p-4 bg-[#f3f3f3] max-h-[78vh] overflow-y-auto" id="hotel-invoice-printable-tag">
              <iframe
                title={`Invoice ${viewingInvoice.invoiceNumber}`}
                srcDoc={invoiceRecordToPrintHtml(
                  viewingInvoice,
                  hotelSettings,
                  null,
                  bookings.find(b => b.id === viewingInvoice.bookingId) || null
                )}
                className="w-full min-h-[780px] bg-white rounded-lg border border-[#DCE3EC]"
              />
            </div>

            {/* Modal Bottom Actions */}
            <div className="bg-luxury-beige-50 border-t border-luxury-brown-200 p-4 px-6 flex flex-wrap justify-between items-center gap-3 no-print">
              <span className="text-xs text-luxury-brown-600 font-mono">
                Invoice No: <strong>{viewingInvoice.invoiceNumber}</strong>
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const message = `Hello *${viewingInvoice.guestName}*,\n\n` +
                      `Here is your invoice from *${hotelSettings?.name || 'Grand Pavilion'}*:\n\n` +
                      `• Invoice No: ${viewingInvoice.invoiceNumber}\n` +
                      `• Booking ID: ${viewingInvoice.bookingId}\n` +
                      `• Room: ${viewingInvoice.roomNumber}\n` +
                      `• Stay: ${viewingInvoice.checkInDate} to ${viewingInvoice.checkOutDate}\n` +
                      `• Grand Total: ₹${viewingInvoice.finalAmount}\n` +
                      `• Advance Paid: ₹${viewingInvoice.advancePaid || 0}\n` +
                      `• Balance Due: ₹${viewingInvoice.pendingAmount || 0}\n\n` +
                      `Thank you for your stay!\n\n` +
                      `_${hotelSettings?.name || 'Hotel'} Invoicing Desk_`;
                    openWhatsAppChat(viewingInvoice.guestMobile || '7978563771', message);
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Share WhatsApp
                </button>

                <button
                  onClick={() =>
                    downloadHotelInvoicePdf(
                      viewingInvoice,
                      hotelSettings,
                      undefined,
                      bookings.find(b => b.id === viewingInvoice.bookingId)
                    )
                  }
                  className="px-3.5 py-2 bg-[#17120F] hover:bg-[#2A211B] text-[#C49A3A] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#C49A3A]" /> Download PDF
                </button>

                {((Number(viewingInvoice.foodCharges) || 0) > 0 || (viewingInvoice.ledgerLines || []).some(l => l.kind === 'food' || /Food & Beverage|Food & Restaurant|POS Room Charge|Food Bill/i.test(l.description || ''))) && (
                  <button
                    type="button"
                    onClick={() =>
                      openPrintWindow(
                        invoiceRecordToPrintHtml(
                          viewingInvoice,
                          hotelSettings,
                          null,
                          bookings.find(b => b.id === viewingInvoice.bookingId) || null,
                          'food_only'
                        ),
                        true
                      )
                    }
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    title="Print Food Charges Only on a separate official invoice"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-white" /> Separate Food Bill
                  </button>
                )}

                <button
                  onClick={() =>
                    openPrintWindow(
                      invoiceRecordToPrintHtml(
                        viewingInvoice,
                        hotelSettings,
                        null,
                        bookings.find(b => b.id === viewingInvoice.bookingId) || null
                      ),
                      true
                    )
                  }
                  className="px-4 py-2 bg-[#C49A3A] hover:bg-[#B0862B] !text-[#17120F] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#17120F]" /> Print Invoice
                </button>

                <button
                  onClick={() => setViewingInvoice(null)}
                  className="px-3.5 py-2 border border-luxury-brown-200 hover:bg-luxury-beige-100 text-luxury-brown-800 text-xs rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL & REFUND MODAL */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-rose-600 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">Cancel Booking & Process Refund</h3>
                <p className="text-[11px] text-rose-100 font-mono">
                  {cancellingBooking.id} • {cancellingBooking.guestName} (Room {cancellingBooking.roomNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="text-white/80 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmCancelAndRefund} className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <span className="text-slate-500 block">Advance Paid by Guest:</span>
                  <span className="text-base font-extrabold text-slate-800 font-mono">
                    ₹{(cancellingBooking.advanceAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Original Payment Mode:</span>
                  <span className="font-bold text-slate-700 font-mono">{cancellingBooking.paymentMethod}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Cancellation Reason *</label>
                <input
                  type="text"
                  required
                  value={cancelReasonInput}
                  onChange={e => setCancelReasonInput(e.target.value)}
                  placeholder="e.g. Guest travel plan changed"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Refund Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={refundAmountInput}
                    onChange={e => setRefundAmountInput(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-emerald-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Refund Mode</label>
                  <select
                    value={refundModeInput}
                    onChange={e => setRefundModeInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold bg-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card Reversal</option>
                  </select>
                </div>
              </div>

              {refundAmountInput > 0 && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Refund Transaction / Reference No.</label>
                  <input
                    type="text"
                    value={refundRefInput}
                    onChange={e => setRefundRefInput(e.target.value)}
                    placeholder="UTR / Cash Voucher Reference"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  {refundAmountInput > 0
                    ? `Confirm Cancel & Refund ₹${refundAmountInput.toLocaleString('en-IN')}`
                    : 'Confirm Cancellation (No Refund)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT FAILURE MODAL */}
      {paymentIssueBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-amber-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">Log Payment Failure</h3>
                <p className="text-[11px] text-amber-100 font-mono">
                  {paymentIssueBooking.id} • {paymentIssueBooking.guestName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentIssueBooking(null)}
                className="text-white/80 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleMarkPaymentFailed} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Payment Failure Reason *</label>
                <input
                  type="text"
                  required
                  value={paymentFailureReasonInput}
                  onChange={e => setPaymentFailureReasonInput(e.target.value)}
                  placeholder="e.g. UPI Timeout / Bank Server Down / Card Declined"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentIssueBooking(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Mark Payment Failed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 1: RESERVATION DETAILS & FINANCIAL SETTLEMENT SUMMARY ==================== */}
      {activeViewingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-[#C49A3A]/30 shadow-2xl max-w-3xl w-full overflow-hidden max-h-[92vh] flex flex-col animate-fadeIn">
            <div className="bg-[#1E1610] text-[#FBF4E0] px-6 py-4 flex items-center justify-between border-b border-[#C49A3A]/40 shrink-0">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-serif font-bold text-[#FBF4E0]">
                    Reservation #{activeViewingItem.booking.id}
                  </h3>
                  {renderStatusPill(activeViewingItem.canonicalStatus)}
                  <span className="px-2 py-0.5 rounded bg-[#C49A3A]/20 text-[#F3D078] border border-[#C49A3A]/40 text-[10.5px] font-bold">
                    {activeViewingItem.primarySegment}
                  </span>
                </div>
                <p className="text-xs text-[#FBF4E0]/75 mt-1">
                  Booked on {activeViewingItem.bookedOnDate} ({activeViewingItem.bookedOnTime}) • Source: {activeViewingItem.booking.bookingSource}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingReservationItem(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Financial Settlement Cards: Total Payable | Received | Pending | Settlement */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Folio Amount</span>
                  <strong className="text-lg font-mono font-extrabold text-slate-900 mt-0.5 block">
                    ₹{activeViewingItem.financials.totalPayable.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    Incl. ₹{activeViewingItem.financials.taxAmount.toLocaleString('en-IN')} GST
                  </span>
                </div>

                <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Received Amount</span>
                  <strong className="text-lg font-mono font-extrabold text-emerald-800 mt-0.5 block">
                    ₹{activeViewingItem.financials.receivedAmount.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[10px] text-emerald-700">
                    {activeViewingItem.booking.paymentMethod || 'Recorded Receipts'}
                  </span>
                </div>

                <div
                  className={`rounded-xl p-3.5 border ${
                    activeViewingItem.financials.pendingAmount > 0
                      ? 'bg-rose-50/90 border-rose-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase font-bold block ${
                      activeViewingItem.financials.pendingAmount > 0 ? 'text-rose-700' : 'text-slate-500'
                    }`}
                  >
                    Pending Balance
                  </span>
                  <strong
                    className={`text-lg font-mono font-extrabold mt-0.5 block ${
                      activeViewingItem.financials.pendingAmount > 0 ? 'text-rose-700' : 'text-slate-700'
                    }`}
                  >
                    ₹{activeViewingItem.financials.pendingAmount.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[10px] text-slate-500">
                    {activeViewingItem.financials.pendingAmount <= 0 ? 'Cleared / Nil Due' : 'Balance Due'}
                  </span>
                </div>

                <div className="bg-[#FFFDF7] border border-[#C49A3A]/40 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-[#8B691E] block">
                    {activeViewingItem.canonicalStatus === 'Cancelled' ? 'Net Retained' : 'Settlement Amount'}
                  </span>
                  <strong className="text-lg font-mono font-extrabold text-luxury-brown-950 mt-0.5 block">
                    ₹{activeViewingItem.financials.settlementAmount.toLocaleString('en-IN')}
                  </strong>
                  <span className="text-[10px] text-[#8B691E]">
                    {activeViewingItem.financials.refundedAmount > 0
                      ? `Refunded ₹${activeViewingItem.financials.refundedAmount.toLocaleString('en-IN')}`
                      : activeViewingItem.financials.isFullySettled
                      ? 'Fully Settled'
                      : 'Active Folio'}
                  </span>
                </div>
              </div>

              {/* Guest & Stay Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="font-bold uppercase text-[10.5px] tracking-wider text-[#8B691E] border-b border-slate-100 pb-1.5">
                    Guest &amp; Segment Details
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                    <span className="text-slate-500">Guest Name:</span>
                    <strong className="text-slate-900">{activeViewingItem.booking.guestName}</strong>
                    <span className="text-slate-500">Mobile:</span>
                    <span className="font-mono font-semibold text-slate-800">{activeViewingItem.booking.mobile || '-'}</span>
                    <span className="text-slate-500">Guests:</span>
                    <span className="font-semibold text-slate-800">{activeViewingItem.paxLabel}</span>
                    <span className="text-slate-500">Nationality / ID:</span>
                    <span className="text-slate-800">
                      {activeViewingItem.booking.nationality || 'Indian'}
                      {activeViewingItem.booking.aadhaarNumber ? ` • ${activeViewingItem.booking.aadhaarNumber}` : ''}
                    </span>
                    {activeViewingItem.booking.companyName && (
                      <>
                        <span className="text-slate-500">Company / GSTIN:</span>
                        <span className="font-semibold text-indigo-800">
                          {activeViewingItem.booking.companyName}
                          {activeViewingItem.booking.gstNumber ? ` (${activeViewingItem.booking.gstNumber})` : ''}
                        </span>
                      </>
                    )}
                    {activeViewingItem.booking.travelAgentName && (
                      <>
                        <span className="text-slate-500">Travel Agent:</span>
                        <span className="font-semibold text-[#8B691E]">
                          {activeViewingItem.booking.travelAgentName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="font-bold uppercase text-[10.5px] tracking-wider text-[#8B691E] border-b border-slate-100 pb-1.5">
                    Stay Schedule &amp; Room Allocation
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                    <span className="text-slate-500">Check-In:</span>
                    <strong className="text-emerald-800">
                      {formatShortHumanDate(activeViewingItem.booking.checkInDate)} ({formatDisplayTime12h(activeViewingItem.booking.checkInTime, '12:00 PM')})
                    </strong>
                    <span className="text-slate-500">Check-Out:</span>
                    <strong className="text-rose-800">
                      {activeViewingItem.booking.checkOutDate
                        ? `${formatShortHumanDate(activeViewingItem.booking.checkOutDate)} (${formatDisplayTime12h(activeViewingItem.booking.checkOutTime, '11:00 AM')})`
                        : 'Open Stay'}
                    </strong>
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-semibold text-slate-800">
                      {activeViewingItem.nightsCount} {activeViewingItem.nightsCount === 1 ? 'Night' : 'Nights'} ({activeViewingItem.durationHoursLabel})
                    </span>
                    <span className="text-slate-500">Meal Plan:</span>
                    <span className="font-semibold text-slate-800">{activeViewingItem.booking.mealPlan || 'EP (Room Only)'}</span>
                    <span className="text-slate-500">Rooms:</span>
                    <strong className="text-slate-900">{activeViewingItem.displayRoomsLabel}</strong>
                  </div>
                </div>
              </div>

              {/* Multi-Room Breakdown for Group Bookings */}
              {activeViewingItem.roomNumbers.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase text-[10.5px] tracking-wider text-[#8B691E]">
                      Allocated Rooms ({activeViewingItem.roomNumbers.length} {activeViewingItem.roomNumbers.length === 1 ? 'Room' : 'Rooms in Booking'})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {activeViewingItem.roomNumbers.map(rn => {
                      const rmObj = rooms.find(r => String(r.number).trim() === rn);
                      const brObj = activeViewingItem.booking.bookedRooms?.find(b => String(b.roomNumber).trim() === rn);
                      return (
                        <div key={rn} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              <BedDouble className="w-3.5 h-3.5 text-[#C49A3A]" />
                              Room {rn}
                            </div>
                            <div className="text-[10.5px] text-slate-500 uppercase font-bold">
                              {brObj?.category || rmObj?.category || activeViewingItem.booking.roomType}
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="font-bold text-slate-800">
                              ₹{Number(brObj?.rate || rmObj?.rate || 0).toLocaleString('en-IN')}/N
                            </div>
                            {rmObj && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                {rmObj.cleaningStatus || rmObj.status}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Itemized Folio Charges & Receipts */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 font-bold uppercase text-[10.5px] tracking-wider text-slate-700 border-b border-slate-200">
                  Itemized Folio Charges &amp; Payment Ledger
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {activeViewingItem.financials.stayBill.bill.lines.map((ln, idx) => (
                    <div key={idx} className="px-4 py-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-800">{ln.description}</span>
                        {ln.dateLabel && <span className="text-[10px] text-slate-400 ml-2">{ln.dateLabel}</span>}
                      </div>
                      <div className="font-mono font-bold whitespace-nowrap">
                        {ln.type === 'receipt' ? (
                          <span className="text-emerald-700">- ₹{Number(ln.receipts || 0).toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-900">₹{Number(ln.charges || 0).toLocaleString('en-IN')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Quick Actions */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const bk = activeViewingItem.booking;
                    setViewingReservationItem(null);
                    handleEditClick(bk);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#C49A3A] hover:bg-[#b0882e] text-[#17120F] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                {canPerformReservationAction('checkIn', activeViewingItem.canonicalStatus, currentRole) && onCheckIn && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeViewingItem;
                      setViewingReservationItem(null);
                      executeCheckInWithHousekeepingGuard(target);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Check-In</span>
                  </button>
                )}

                {canPerformReservationAction('checkOut', activeViewingItem.canonicalStatus, currentRole) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeViewingItem;
                      setViewingReservationItem(null);
                      handleOpenCheckOutAction(target);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Check-Out</span>
                  </button>
                )}

                {canPerformReservationAction('roomChange', activeViewingItem.canonicalStatus, currentRole) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeViewingItem;
                      setViewingReservationItem(null);
                      handleOpenRoomChangeModal(target);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Room Change</span>
                  </button>
                )}

                {canPerformReservationAction('payment', activeViewingItem.canonicalStatus, currentRole) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeViewingItem;
                      setViewingReservationItem(null);
                      handleOpenPaymentModal(target);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-[#8B691E] border border-[#C49A3A]/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Payment</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const bk = activeViewingItem.booking;
                    setViewingReservationItem(null);
                    handleGenerateOrViewInvoice(bk);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-[#C49A3A]" />
                  <span>Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintFilledGrc(activeViewingItem)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print GRC</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingReservationItem(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: ROOM CHANGE / GROUP ROOM REALLOCATION ==================== */}
      {roomChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#1E1610] text-[#FBF4E0] px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif font-bold flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-[#C49A3A]" />
                  Room Change • {roomChangeTarget.booking.guestName}
                </h3>
                <p className="text-[11px] text-[#FBF4E0]/75 mt-0.5">
                  Current: {roomChangeTarget.displayRoomsLabel} • Select {roomChangeTarget.roomCount} room{roomChangeTarget.roomCount > 1 ? 's' : ''} ({roomChangeTarget.booking.checkInDate} → {roomChangeTarget.booking.checkOutDate || 'Open'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomChangeTarget(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRoomChange} className="p-5 overflow-y-auto space-y-4 text-xs">
              {roomChangeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{roomChangeError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
                {rooms.map(rm => {
                  const rNum = String(rm.number).trim();
                  const isPicked = roomChangeSelection.includes(rNum);
                  const check = validateRoomAllocationForDates({
                    targetRoomNumbers: [rNum],
                    checkInDate: roomChangeTarget.booking.checkInDate,
                    checkOutDate: roomChangeTarget.booking.checkOutDate,
                    excludeBookingId: roomChangeTarget.booking.id,
                    excludeCheckinId: roomChangeTarget.linkedCheckin?.id,
                    rooms,
                    bookings,
                    checkins,
                    todayStr: getTodayDateStr(),
                  });
                  const isDirty = rm.status === 'Dirty' || rm.cleaningStatus === 'Dirty';
                  return (
                    <button
                      key={rm.id}
                      type="button"
                      disabled={!check.valid && !isPicked}
                      onClick={() => {
                        if (roomChangeTarget.roomCount <= 1) {
                          setRoomChangeSelection([rNum]);
                        } else {
                          setRoomChangeSelection(prev =>
                            prev.includes(rNum) ? prev.filter(x => x !== rNum) : [...prev, rNum]
                          );
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isPicked
                          ? 'bg-[#1E1610] text-[#FBF4E0] border-[#C49A3A] shadow-sm cursor-pointer'
                          : check.valid
                          ? 'bg-white hover:bg-[#FFFDF7] border-slate-200 text-slate-800 cursor-pointer'
                          : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold font-mono text-sm">Rm {rNum}</span>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${
                            isPicked
                              ? 'bg-[#C49A3A] text-[#17120F]'
                              : !check.valid
                              ? 'bg-rose-100 text-rose-700'
                              : isDirty
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {!check.valid ? 'Booked' : isDirty ? 'Dirty' : 'Ready'}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-80 truncate mt-0.5">{rm.category}</div>
                      <div className="text-[10.5px] font-mono font-bold mt-0.5">₹{rm.rate}/N</div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Reason for Room Change</label>
                <input
                  type="text"
                  value={roomChangeReason}
                  onChange={e => setRoomChangeReason(e.target.value)}
                  placeholder="e.g. Guest requested higher floor / AC issue"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              {roomChangeTarget.canonicalStatus === 'Checked-In' && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                  Note: Because this guest is currently <strong>Checked-In</strong>, the vacated room(s) will automatically be marked <strong>Dirty</strong> for Housekeeping turnover.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoomChangeTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C49A3A] hover:bg-[#b0882e] text-[#17120F] rounded-xl font-bold cursor-pointer"
                >
                  Confirm Room Change ({roomChangeSelection.join(', ') || 'None'})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: RECORD RESERVATION PAYMENT / FOLIO RECEIPT ==================== */}
      {paymentModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-[#C49A3A]/40 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#1E1610] text-[#FBF4E0] px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif font-bold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#C49A3A]" />
                  Record Payment • {paymentModalTarget.booking.guestName}
                </h3>
                <p className="text-[11px] text-[#FBF4E0]/75 font-mono">
                  #{paymentModalTarget.booking.id} • {paymentModalTarget.displayRoomsLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalTarget(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRecordPayment} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Total Folio</span>
                  <strong className="text-sm text-slate-900">
                    ₹{paymentModalTarget.financials.totalPayable.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 block uppercase">Received</span>
                  <strong className="text-sm text-emerald-700">
                    ₹{paymentModalTarget.financials.receivedAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-rose-700 block uppercase">Pending Due</span>
                  <strong className="text-sm text-rose-600">
                    ₹{paymentModalTarget.financials.pendingAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPayHybrid}
                  onChange={e => setIsPayHybrid(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Split / Hybrid Payment (2 Payment Modes)</span>
              </label>

              {!isPayHybrid ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Amount Received (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={payCollectAmount}
                      onChange={e => setPayCollectAmount(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-emerald-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Payment Mode *</label>
                    <select
                      value={payCollectMethod}
                      onChange={e => setPayCollectMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI (Manual Verification)</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-700 block">UTR / Reference No. (Optional)</label>
                    <input
                      type="text"
                      value={payCollectRef}
                      onChange={e => setPayCollectRef(e.target.value)}
                      placeholder="UPI UTR / Card Slip / Bank Reference"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={paySplit1Mode}
                      onChange={e => setPaySplit1Mode(e.target.value as PaymentMethod)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paySplit1Amt}
                      onChange={e => setPaySplit1Amt(Number(e.target.value) || 0)}
                      placeholder="Amount 1"
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono font-bold bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={paySplit2Mode}
                      onChange={e => setPaySplit2Mode(e.target.value as PaymentMethod)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold bg-white"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paySplit2Amt}
                      onChange={e => setPaySplit2Amt(Number(e.target.value) || 0)}
                      placeholder="Amount 2"
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono font-bold bg-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={paySplit2Ref}
                    onChange={e => setPaySplit2Ref(e.target.value)}
                    placeholder="UTR / Reference for Split 2"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono bg-white"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Receipt Remarks</label>
                <input
                  type="text"
                  value={payCollectNotes}
                  onChange={e => setPayCollectNotes(e.target.value)}
                  placeholder="e.g. Advance top-up / Part settlement"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: MARK NO-SHOW CONFIRMATION ==================== */}
      {noShowModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-amber-300 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <UserX className="w-4 h-4" />
                  Mark Reservation as No-Show
                </h3>
                <p className="text-[11px] text-amber-100 font-mono">
                  #{noShowModalTarget.booking.id} • {noShowModalTarget.booking.guestName} ({noShowModalTarget.displayRoomsLabel})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoShowModalTarget(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmMarkNoShow} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                Marking this booking as <strong>No-Show</strong> will immediately release reserved room availability ({noShowModalTarget.roomNumbers.join(', ') || 'Unassigned'}) for Stay Overview &amp; Front Desk.
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">No-Show Reason *</label>
                <input
                  type="text"
                  required
                  value={noShowReasonInput}
                  onChange={e => setNoShowReasonInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNoShowModalTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Confirm No-Show
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 5: DIRECT CHECK-OUT & FINAL SETTLEMENT ==================== */}
      {checkoutModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-teal-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-teal-800 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Check-Out &amp; Final Settlement
                </h3>
                <p className="text-[11px] text-teal-100 font-mono">
                  #{checkoutModalTarget.booking.id} • {checkoutModalTarget.booking.guestName} ({checkoutModalTarget.displayRoomsLabel})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutModalTarget(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmDirectCheckOut} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Total Bill</span>
                  <strong className="text-sm text-slate-900">
                    ₹{checkoutModalTarget.financials.totalPayable.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 block uppercase">Paid</span>
                  <strong className="text-sm text-emerald-700">
                    ₹{checkoutModalTarget.financials.receivedAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-rose-700 block uppercase">Balance Due</span>
                  <strong className="text-sm text-rose-600">
                    ₹{checkoutModalTarget.financials.pendingAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Collect Balance (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={checkoutSettleAmount}
                    onChange={e => setCheckoutSettleAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-emerald-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Settlement Mode</label>
                  <select
                    value={checkoutSettleMethod}
                    onChange={e => setCheckoutSettleMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Reference / UTR (Optional)</label>
                <input
                  type="text"
                  value={checkoutSettleRef}
                  onChange={e => setCheckoutSettleRef(e.target.value)}
                  placeholder="Settlement Receipt Reference"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCheckoutModalTarget(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  Complete Check-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 6: HOUSEKEEPING DIRTY ROOM CHECK-IN GUARD ==================== */}
      {dirtyOverrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-2xl border border-amber-300 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-rose-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold">Housekeeping Alert — Room Not Ready</h3>
                  <p className="text-[11px] text-rose-100">
                    Room {dirtyOverrideTarget.dirtyRooms.map(d => d.number).join(', ')} is marked Dirty / In Cleaning
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDirtyOverrideTarget(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                DirectStay blocks check-in into <strong>Dirty</strong> rooms by default to protect guest quality. Please reassign a clean room, or use an authorised Manager/Admin override if Housekeeping has physically cleared the room.
              </p>

              {(currentRole === 'Admin' || currentRole === 'SuperAdmin' || currentRole === 'Manager') && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Authorised Override Reason *</label>
                  <input
                    type="text"
                    value={dirtyOverrideReason}
                    onChange={e => setDirtyOverrideReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const target = dirtyOverrideTarget.item;
                    setDirtyOverrideTarget(null);
                    handleOpenRoomChangeModal(target);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Reassign Clean Room
                </button>
                {(currentRole === 'Admin' || currentRole === 'SuperAdmin' || currentRole === 'Manager') && (
                  <button
                    type="button"
                    onClick={() =>
                      executeCheckInWithHousekeepingGuard(
                        dirtyOverrideTarget.item,
                        true,
                        dirtyOverrideReason.trim() || 'Supervisor Override'
                      )
                    }
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
                  >
                    Authorise Override &amp; Check-In
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
