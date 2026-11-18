import React, { useState, useEffect } from 'react';
import { Booking, Room, RoomCategory, BookingSource, PaymentMethod, BookingStatus, UserRole, Invoice, WaterBottleRecord, BookedServiceSelection, DeletedItemRecord, TravelAgent, MealPlanType, BookedRoom } from '../types';
import { Search, Plus, Trash2, CalendarCheck, FileText, CheckCircle2, Send, Check, Printer, Receipt, Download, X, Mail, Clock, Sparkles, AlertTriangle, Edit, Building2, Users, Globe } from 'lucide-react';
import { openWhatsAppChat } from '../pms-integrated/utils/formatters';
import { getCurrentTimeStr, calculateEarlyCheckIn } from '../utils/stayTimeUtils';
import { showToast } from '../utils/toast';
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
} from '../utils/stayBilling';
import { downloadHotelInvoicePdf, invoiceRecordToPrintHtml } from '../utils/pdfDownload';
import { openPrintWindow } from '../utils/printDocument';

interface ReservationViewProps {
  bookings: Booking[];
  rooms: Room[];
  currentRole: UserRole;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onCheckIn?: (booking: Booking) => void;
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

export default function ReservationView({
  bookings,
  rooms,
  currentRole,
  onUpdateBookings,
  onUpdateRooms,
  onCheckIn,
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
          } else {
            setBookingGstRate(
              hotelSettings?.isGstEnabled === false
                ? 0
                : Number(hotelSettings?.defaultGstRate ?? 5)
            );
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
  const multiRoomsNightlySum = multiRoomSelections.reduce((sum, mr) => {
    const rmRate = Number(mr.rate) || 0;
    const exBed = mr.hasExtraBed ? (Math.max(1, Number(mr.extraBedCount) || 1) * (Number(mr.extraBedRate) || 0)) : 0;
    return sum + rmRate + exBed;
  }, 0);
  const totalRoomPrice = isMultiRoomMode && multiRoomSelections.length > 0
    ? multiRoomsNightlySum * Math.max(1, nights)
    : (roomPrice + singleModeExtraBedPerNight) * Math.max(1, nights);
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
    gstEnabled: bookingGstRate > 0,
    settings:
      bookingGstRate > 0
        ? { ...billSettings, roomGstRate: bookingGstRate }
        : { ...billSettings, roomGstRate: 0, foodGstRate: 0 },
  });
  const calculatedBookingGst = liveBookingBill.totalTax;
  const totalPayableWithGst = liveBookingBill.grandTotal;
  const pendingAmount = liveBookingBill.balance;

  const computeAutoPriceForStay = (
    rate: number,
    nightsCount: number,
    _adultsVal: number,
    _childrenVal: number,
    _rmObj?: Room,
    extraBedActive: boolean = hasExtraBed,
    exBedCnt: number = extraBedCount,
    exBedRt: number = extraBedRate
  ) => {
    const exBedTotal = extraBedActive ? Math.max(1, Number(exBedCnt) || 1) * (Number(exBedRt) || 0) : 0;
    return (rate + exBedTotal) * Math.max(1, nightsCount);
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

  // Sync pricing when dates change
  const handleCheckInDateChange = (val: string) => {
    let cleanVal = val;
    if (!editingBooking && cleanVal && cleanVal < getTodayDateStr()) {
      cleanVal = getTodayDateStr();
      showToast('Arrival date cannot be in the past.', 'warning');
    }
    setCheckInDate(cleanVal);
    let nextCheckOut = checkOutDate;
    if (checkOutDate && checkOutDate < cleanVal) {
      nextCheckOut = cleanVal;
      setCheckOutDate(cleanVal);
    }
    const nightsCount = calNightsForDates(cleanVal, nextCheckOut);
    if (isMultiRoomMode && multiRoomSelections.length > 0) {
      syncMultiRoomBookingPrice(multiRoomSelections, nightsCount);
    } else {
      setBookingPrice(computeAutoPriceForStay(roomPrice, nightsCount, Number(adults) || 1, Number(children) || 0, activeMatchedRoom));
    }
  };

  const handleCheckOutDateChange = (val: string) => {
    let cleanVal = val;
    if (cleanVal && checkInDate && cleanVal < checkInDate) {
      cleanVal = checkInDate;
      showToast('Departure date cannot be before Arrival date.', 'warning');
    }
    setCheckOutDate(cleanVal);
    const nightsCount = calNightsForDates(checkInDate, cleanVal);
    if (isMultiRoomMode && multiRoomSelections.length > 0) {
      syncMultiRoomBookingPrice(multiRoomSelections, nightsCount);
    } else {
      setBookingPrice(computeAutoPriceForStay(roomPrice, nightsCount, Number(adults) || 1, Number(children) || 0, activeMatchedRoom));
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
    setAdvanceAmount(0);
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
    setBookingGstRate(
      bk.isWithoutGst === true || (bk.gstRate !== undefined && Number(bk.gstRate) <= 0)
        ? 0
        : configuredDefaultGst > 0
        ? configuredDefaultGst
        : Number(bk.gstRate) || 5
    );
    setSelectedServiceIds((bk.bookedServices || []).map(s => String(s.serviceId)));
    setAdvanceAmount(bk.advanceAmount || 0);
    setPaymentMethod(bk.paymentMethod || 'Cash');
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
    setAdvanceAmount(0);
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
    if (r.status === 'Out of Order' || r.status === 'Maintenance') return false;
    const effectiveEndStr = endStr || getFutureDateStr(1, startStr);
    if (startStr <= getTodayDateStr() && effectiveEndStr > getTodayDateStr() && r.status === 'Occupied') {
      return false;
    }
    const targetNum = String(r.number || '').trim();
    const hasOverlappingBooking = bookings.some(b => {
      if (b.id === excludeBookingId) return false;
      const rawSt = String(b.status || '').toLowerCase();
      if (b.status === 'Cancelled' || rawSt === 'cancelled') return false;
      if (b.isCompleted || rawSt === 'checkedout' || rawSt === 'checked out') return false;
      const roomMatchesSingle = String(b.roomNumber || '')
        .split(',')
        .map(s => s.trim())
        .includes(targetNum);
      const roomMatchesMulti = (b.bookedRooms || []).some(br => String(br.roomNumber || '').trim() === targetNum);
      if (!roomMatchesSingle && !roomMatchesMulti) return false;
      const bEnd = b.checkOutDate || getFutureDateStr(1, b.checkInDate);
      return startStr === b.checkInDate || (startStr < bEnd && effectiveEndStr > b.checkInDate);
    });
    return !hasOverlappingBooking;
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

    if (!editingBooking && checkInDate && checkInDate < getTodayDateStr()) {
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

      const autoStatus: BookingStatus =
        editingBooking.status === 'Cancelled'
          ? 'Cancelled'
          : advanceAmount > 0
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
        isCompleted: autoStatus === 'Cancelled' ? editingBooking.isCompleted : false,
        advanceAmount,
        paymentMethod,
        voucherNumber: voucherNumber.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || editingBooking.notes,
        bookingAmount: bookingPrice,
        gstRate: bookingGstRate,
        gstAmount: calculatedBookingGst,
        isWithoutGst: bookingGstRate <= 0,
        bookedServices: bookedServicesPayload,
        travelAgentId: selectedAgentId || undefined,
        travelAgentName: selectedAgentObj ? `${selectedAgentObj.name}${selectedAgentObj.agencyName ? ` (${selectedAgentObj.agencyName})` : ''}` : undefined,
        commissionType: selectedAgentId ? commissionType : undefined,
        commissionValue: selectedAgentId ? commissionValue : undefined,
        commissionAmount: selectedAgentId ? effectiveCommissionAmount : undefined,
        bookingDate: bookingDateInput || editingBooking.bookingDate,
        paymentStatus: advanceAmount >= totalPayableWithGst ? 'Fully Paid' : (advanceAmount > 0 ? 'Partially Paid' : 'Unpaid'),
      };

      updatedBookings = bookings.map(b => b.id === editingBooking.id ? finalBooking : b);

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
        paymentMethod,
        voucherNumber: voucherNumber.trim() || undefined,
        transactionId: transactionId.trim() || undefined,
        bookingSource,
        status: advanceAmount > 0 ? 'Confirmed' : 'In Process',
        notes: notes.trim() || 'Advance Booking',
        isCheckedIn: false,
        bookingAmount: bookingPrice,
        gstRate: bookingGstRate,
        gstAmount: calculatedBookingGst,
        isWithoutGst: bookingGstRate <= 0,
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
    
    setSavedBooking(finalBooking);
    setShowWhatsAppModal(true);
    
    handleCloseForm();
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

    if (cancellingBooking.roomNumber) {
      const stillReservedToday = updatedList.some(
        b =>
          b.id !== id &&
          b.status === 'Confirmed' &&
          b.roomNumber === cancellingBooking.roomNumber &&
          b.checkInDate <= todayStr &&
          b.checkOutDate > todayStr
      );
      if (!stillReservedToday) {
        const updatedRooms = rooms.map(r =>
          r.number === cancellingBooking.roomNumber && r.status === 'Reserved'
            ? { ...r, status: 'Available' as const }
            : r
        );
        onUpdateRooms(updatedRooms);
      }
    }
    if (onAddAuditLog) {
      onAddAuditLog(
        cleanRefund > 0 ? 'Booking Cancelled & Refunded' : 'Reservation Cancelled',
        `Cancelled reservation ${id} for ${name}.${cleanRefund > 0 ? ` Refunded ₹${cleanRefund.toLocaleString('en-IN')} via ${refundModeInput} (Ref: ${refundRefInput.trim()}).` : ''}`
      );
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

  // Filter list
  const filteredBookings = bookings.filter(bk => {
    const q = search.toLowerCase();
    const matchesSearch =
      bk.guestName.toLowerCase().includes(q) ||
      bk.mobile.includes(search) ||
      bk.roomNumber.toLowerCase().includes(q) ||
      bk.id.toLowerCase().includes(q) ||
      (bk.companyName || '').toLowerCase().includes(q) ||
      (bk.travelAgentName || '').toLowerCase().includes(q);

    const otaList = ['MakeMyTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Airbnb', 'OYO', 'Expedia', 'OTA', 'Other OTA'];
    const matchesSource =
      sourceFilter === 'All'
        ? true
        : sourceFilter === 'OTA'
        ? otaList.includes(bk.bookingSource)
        : sourceFilter === 'Direct'
        ? bk.bookingSource === 'Direct' || bk.bookingSource === 'Walk-in' || bk.bookingSource === 'Phone' || bk.bookingSource === 'Website'
        : bk.bookingSource === sourceFilter;

    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Confirmed'
        ? bk.status === 'Confirmed' || bk.status === 'Advance' || bk.status === 'Checked In' || (Number(bk.advanceAmount || 0) > 0 && bk.status !== 'Cancelled')
        : statusFilter === 'In Process'
        ? (bk.status === 'In Process' || bk.status === 'Pending' || bk.status === 'Waiting') && Number(bk.advanceAmount || 0) <= 0
        : statusFilter === 'Cancelled'
        ? bk.status === 'Cancelled'
        : bk.status === statusFilter;
    
    let matchesDate = true;
    const todayStr = getTodayDateStr();
    const yesterdayStr = getFutureDateStr(-1);
    const thisMonthPrefix = todayStr.slice(0, 7);
    const targetDate = String(bk.checkInDate || '').slice(0, 10);
    if (dateFilterType === 'Today') {
      matchesDate = targetDate === todayStr;
    } else if (dateFilterType === 'Yesterday') {
      matchesDate = targetDate === yesterdayStr;
    } else if (dateFilterType === 'Date') {
      matchesDate = targetDate === filterSingleDate;
    } else if (dateFilterType === 'This Month') {
      matchesDate = targetDate.startsWith(thisMonthPrefix);
    } else if (dateFilterType === 'Range') {
      matchesDate =
        (!filterStartDate || targetDate >= filterStartDate) &&
        (!filterEndDate || targetDate <= filterEndDate);
    }

    return matchesSearch && matchesSource && matchesStatus && matchesDate;
  });

  const getStatusBadge = (st: BookingStatus) => {
    switch (st) {
      case 'Confirmed':
      case 'Advance':
      case 'Checked In':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
      case 'In Process':
      case 'Pending':
      case 'Waiting':
      default:
        return 'bg-blue-50 text-blue-800 border-blue-300 font-bold';
    }
  };

  // Get available rooms matching selected category
  const suitableRooms = rooms.filter(r => r.category === roomType && (r.status === 'Available' || r.status === 'Reserved'));

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-luxury-brown-100 pb-4 no-print">
        <div>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide">Advance Bookings & Reservations</h1>
          <p className="text-xs text-luxury-brown-500">Record future reservations, approve direct guest bookings, capture prepayment advances, and pre-allocate rooms</p>
        </div>
        <button
          onClick={handleNewBookingClick}
          className="mt-3 sm:mt-0 px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-medium rounded-lg text-sm transition-all shadow-md flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New Advance Booking
        </button>
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

      {/* Filter and search panel */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl p-4 shadow-xs space-y-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-luxury-brown-400" />
            <input
              type="text"
              placeholder="Search Guest Name/Mobile/Room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-luxury-brown-200 rounded-lg text-sm focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-900"
            />
          </div>

          <div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-905"
            >
              <option value="All">All Booking Sources</option>
              <option value="Direct">Direct</option>
              <option value="Travel Agent">Travel Agent</option>
              <option value="OTA">All OTAs (MakeMyTrip, Goibibo, etc.)</option>
              <option value="MakeMyTrip">MakeMyTrip</option>
              <option value="Goibibo">Goibibo</option>
              <option value="Booking.com">Booking.com</option>
              <option value="Agoda">Agoda</option>
              <option value="OYO">OYO</option>
              <option value="Airbnb">Airbnb</option>
              <option value="Expedia">Expedia</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-sm bg-white focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-905"
            >
              <option value="All">All Booking Statuses</option>
              <option value="Confirmed">Confirmed (Advance Paid)</option>
              <option value="In Process">In Process (Pending Advance)</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center justify-end font-mono text-xs text-luxury-brown-500 gap-1">
            <span>Match Counter:</span>
            <span className="font-bold text-luxury-brown-900 bg-luxury-beige-100 px-2 py-0.5 rounded">
              {filteredBookings.length} bookings
            </span>
          </div>
        </div>

        {/* Date-Wise Filter Selection Row (All, Today, Yesterday, Specific Date, This Month, From -> To Date) */}
        <div className="pt-3 border-t border-luxury-brown-100/60 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs flex-wrap">
          <span className="font-mono font-bold text-luxury-brown-600 uppercase tracking-wider">Date-Wise Filter:</span>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['All', `All (${bookings.length})`],
              ['Today', 'Today'],
              ['Yesterday', 'Yesterday'],
              ['Date', 'Specific Date'],
              ['This Month', 'This Month'],
              ['Range', 'From → To Range'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDateFilterType(key)}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                  dateFilterType === key
                    ? 'bg-luxury-brown-900 text-white border-luxury-brown-900 shadow-sm'
                    : 'bg-white text-luxury-brown-700 border-luxury-brown-200 hover:bg-luxury-beige-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {dateFilterType === 'Date' && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0 bg-luxury-beige-50 border border-luxury-brown-200 p-1.5 rounded-lg">
              <span className="text-luxury-brown-600 font-bold">Select Date:</span>
              <input
                type="date"
                value={filterSingleDate}
                onChange={(e) => setFilterSingleDate(e.target.value)}
                className="px-2.5 py-1 border border-luxury-brown-200 rounded-md bg-white text-luxury-brown-900 font-mono text-xs focus:outline-none focus:border-luxury-gold-500 font-bold"
              />
            </div>
          )}

          {dateFilterType === 'Range' && (
            <div className="flex items-center flex-wrap gap-2 mt-2 sm:mt-0 bg-luxury-beige-50 border border-luxury-brown-100 p-1.5 rounded-lg">
              <span className="text-luxury-brown-500 font-medium">From:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="px-2.5 py-1 border border-luxury-brown-200 rounded-md bg-white text-luxury-brown-900 font-mono text-xs focus:outline-none focus:border-luxury-gold-500"
              />
              <span className="text-luxury-brown-500 font-medium">→ To:</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="px-2.5 py-1 border border-luxury-brown-200 rounded-md bg-white text-luxury-brown-900 font-mono text-xs focus:outline-none focus:border-luxury-gold-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bookings Ledger / Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left text-xs divide-y divide-slate-200">
            <thead className="bg-luxury-brown-900 text-white font-bold select-none">
              <tr>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Booking ID</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Guest Name</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Contact Info</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Room & Type</th>
                <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Nights</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Stay Timeline</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Source</th>
                <th className="py-3 px-3 font-bold text-right whitespace-nowrap">Prepaid Advance</th>
                <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Registered</th>
                <th className="py-3 px-3 font-bold text-center whitespace-nowrap sticky right-0 bg-luxury-brown-900 z-20 shadow-[-6px_0_12px_rgba(0,0,0,0.25)] border-l border-luxury-brown-800">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500 font-mono text-xs uppercase font-bold">
                    No active advanced bookings matched your filter set.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((bk) => (
                  <tr key={bk.id} className="group hover:bg-amber-50/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-extrabold text-slate-900 whitespace-nowrap">
                      <span className="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-md text-xs">{bk.id}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-sans font-extrabold text-slate-950 text-sm">{bk.guestName}</div>
                      {bk.companyName && (
                        <div className="text-[10.5px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 inline-block px-1.5 py-0.5 rounded mt-0.5">
                          🏢 {bk.companyName}
                        </div>
                      )}
                      <div className="text-[11px] font-mono font-semibold text-slate-500">ID: {bk.aadhaarNumber || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-3 space-y-0.5 whitespace-nowrap">
                      <p className="font-mono font-bold text-slate-900 text-xs">{bk.mobile}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate max-w-[170px]">{bk.email}</p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-sans font-extrabold text-slate-900 text-sm">Room {bk.roomNumber}</div>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <span className="inline-block text-[10px] uppercase font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">{bk.roomType}</span>
                        {bk.mealPlan && (
                          <span className="inline-block text-[10px] uppercase font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded">
                            {bk.mealPlan}
                          </span>
                        )}
                        {bk.bookedRooms && bk.bookedRooms.length > 1 && (
                          <span className="inline-block text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                            {bk.bookedRooms.length} Rooms
                          </span>
                        )}
                        {bk.bookedServices && bk.bookedServices.length > 0 && (
                          <span
                            className="inline-block text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded"
                            title={bk.bookedServices.map(s => `${s.serviceName} (₹${s.amount})`).join(', ')}
                          >
                            ✨ +{bk.bookedServices.length} Extra Service{bk.bookedServices.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2.5 text-center font-mono font-extrabold text-sm text-slate-900 whitespace-nowrap">{bk.nights}</td>
                    <td className="py-3 px-3 space-y-1 text-xs font-bold font-mono text-slate-800 whitespace-nowrap">
                      <div className="text-emerald-800">In: {bk.checkInDate}</div>
                      <div className="text-rose-700">
                        Out: {bk.checkOutDate ? bk.checkOutDate : <span className="text-amber-800 font-semibold italic bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">Open Stay</span>}
                      </div>
                      {(bk.checkInDate === bk.checkOutDate || bk.isHourlyStay) && (
                        <div className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded inline-block mt-0.5">
                          ⚡ Hourly Stay {bk.stayHours ? `(${bk.stayHours} hrs)` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium whitespace-nowrap space-y-1">
                      <span className="px-2.5 py-1 text-[10.5px] uppercase tracking-wider font-extrabold rounded-md bg-slate-100 border border-slate-300 text-slate-800 whitespace-nowrap inline-block">
                        {bk.bookingSource}
                      </span>
                      {bk.travelAgentName && (
                        <div className="text-[10px] font-mono font-bold text-[#8B691E] bg-[#FBF4E0] border border-[#C49A3A]/40 px-1.5 py-0.5 rounded">
                          🤝 {bk.travelAgentName}
                          {(bk.commissionAmount || 0) > 0 && (
                            <span className="ml-1 text-emerald-700">• Comm ₹{Number(bk.commissionAmount).toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="font-mono font-extrabold text-sm text-slate-950">₹{Number(bk.advanceAmount || 0).toLocaleString()}</div>
                      <div className="text-[10.5px] text-slate-600 font-mono font-semibold">
                        via {bk.paymentMethod}
                      </div>
                      {bk.transactionId && (
                        <div className="text-[9px] text-luxury-brown-400 font-mono truncate max-w-[120px] ml-auto select-all" title={bk.transactionId}>
                          ID: {bk.transactionId}
                        </div>
                      )}
                      <div className="mt-1">
                        {(() => {
                          const pStat = bk.paymentStatus || (bk.advanceAmount === 0 ? 'Unpaid' : 'Partially Paid');
                          switch (pStat) {
                            case 'Fully Paid':
                              return <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono border border-emerald-100">Fully Paid</span>;
                            case 'Partially Paid':
                              return <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono border border-amber-100">Partially Paid</span>;
                            case 'Refunded':
                              return (
                                <span className="inline-block text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-mono border border-purple-200" title={`Refunded via ${bk.refundMode || 'UPI'} (${bk.refundReference || ''})`}>
                                  ↩ Refunded ₹{(bk.refundAmount || 0).toLocaleString()}
                                </span>
                              );
                            case 'Payment Failed':
                              return (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="inline-block text-[9px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded font-mono" title={bk.paymentFailureReason}>
                                    ⚠ Payment Failed
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryClearPaymentFailure(bk)}
                                    className="text-[9px] font-mono font-bold text-emerald-700 underline cursor-pointer"
                                  >
                                    Retry / Clear
                                  </button>
                                </div>
                              );
                            case 'Unpaid':
                            default:
                              return <span className="inline-block text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-mono border border-rose-100">Unpaid</span>;
                          }
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-2.5 text-center whitespace-nowrap">
                      {(() => {
                        const finalSt: BookingStatus =
                          bk.status === 'Cancelled'
                            ? 'Cancelled'
                            : (bk.status === 'Confirmed' || Number(bk.advanceAmount || 0) > 0)
                            ? 'Confirmed'
                            : 'In Process';
                        return (
                          <span className={`px-2.5 py-1 border text-[11px] font-mono font-extrabold rounded-md ${getStatusBadge(finalSt)}`}>
                            {finalSt}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-2.5 text-center whitespace-nowrap">
                      {bk.isCheckedIn ? (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 font-extrabold border border-emerald-300 px-2.5 py-1 rounded-md font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> In House
                        </span>
                      ) : (
                        <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-mono font-bold uppercase">Unchecked</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#FFFDF7] z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.08)] border-l border-luxury-brown-100">
                      <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                        {(bk.status === 'Advance' || bk.status === 'In Process' || bk.status === 'Waiting') && (
                          <button
                            type="button"
                            onClick={() => handleQuickConfirmStatus(bk)}
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer whitespace-nowrap"
                            title="Confirm Booking & Finalize Commission"
                          >
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            Confirm
                          </button>
                        )}
                        {bk.status === 'Pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprovePendingBooking(bk)}
                              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer whitespace-nowrap"
                              title="Approve Direct Guest Booking"
                            >
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectPendingBooking(bk)}
                              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer whitespace-nowrap"
                              title="Reject Direct Guest Booking"
                            >
                              <X className="w-3.5 h-3.5 shrink-0" />
                              Reject
                            </button>
                          </>
                        )}
                        {/* Always accessible Generate/View Invoice button for every booking */}
                        {(() => {
                          const hasInv = invoices?.some(inv => inv.bookingId === bk.id);
                          return (
                            <button
                              onClick={() => handleGenerateOrViewInvoice(bk)}
                              className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shadow-2xs cursor-pointer bg-[#FBF4E0] !text-[#8B691E] border border-[#C49A3A]/40 hover:bg-[#C49A3A] hover:!text-[#17120F] whitespace-nowrap"
                              title={hasInv ? 'View Official Invoice' : 'Generate Official GST Invoice for Booking'}
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#C49A3A] shrink-0" />
                              {hasInv ? 'View Invoice' : 'Invoice'}
                            </button>
                          );
                        })()}

                        {/* Edit button available on ALL reservations (Online, Pending, Confirmed, etc.) */}
                        <button
                          onClick={() => handleEditClick(bk)}
                          className="px-2.5 py-1.5 text-xs bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs border border-luxury-gold-600/30 whitespace-nowrap"
                          title="Edit Reservation & Guest Data"
                        >
                          <Edit className="w-3.5 h-3.5 text-luxury-brown-950" />
                          <span>Edit</span>
                        </button>

                        {bk.status !== 'Cancelled' && onCheckIn && (
                          <button
                            onClick={() => {
                              if (bk.isCompleted || (bk.status as string) === 'CheckedOut') {
                                const reactivated: Booking = {
                                  ...bk,
                                  status: 'Confirmed',
                                  isCompleted: false,
                                };
                                onUpdateBookings(bookings.map(b => (b.id === bk.id ? reactivated : b)));
                                onCheckIn(reactivated);
                              } else {
                                onCheckIn(bk);
                              }
                            }}
                            className="px-2.5 py-1 text-[10px] bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 font-bold rounded transition-colors cursor-pointer"
                          >
                            {bk.isCheckedIn ? 'Check-In / Stay' : 'Check In'}
                          </button>
                        )}

                        {bk.paymentStatus !== 'Payment Failed' && (
                          <button
                            onClick={() => {
                              setPaymentIssueBooking(bk);
                              setPaymentFailureReasonInput('UPI / Online Transaction Declined or Timed Out');
                            }}
                            className="px-2 py-1 text-[10px] bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded transition-colors font-bold cursor-pointer"
                            title="Log Payment Failure / Declined Transaction"
                          >
                            Pay Failed
                          </button>
                        )}

                        <button
                          onClick={() => handleCancelReservation(bk.id, bk.guestName)}
                          className="px-2.5 py-1 text-[10px] bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 rounded transition-colors font-bold cursor-pointer"
                          title="Cancel Reservation or Record Guest Refund"
                        >
                          {bk.status === 'Cancelled' ? 'Refund' : 'Cancel / Refund'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Move booking #${bk.id} (${bk.guestName}) to Deleted Folder? It will be held safely and can be restored.`)) {
                              if (onMoveToDeletedFolder) {
                                onMoveToDeletedFolder({
                                  itemType: 'Booking',
                                  itemId: bk.id,
                                  title: `Booking #${bk.id} (${bk.roomType} - Room ${bk.roomNumber || 'Auto'})`,
                                  guestName: bk.guestName,
                                  roomNumber: bk.roomNumber,
                                  amount: bk.bookingAmount,
                                  reason: 'User moved to Deleted Folder from Reservations Ledger',
                                  data: bk
                                });
                              }
                              if (bk.roomNumber) {
                                onUpdateRooms(rooms.map(r => r.number === bk.roomNumber && r.status === 'Reserved' ? { ...r, status: 'Available' as const } : r));
                              }
                              onUpdateBookings(bookings.filter(b => b.id !== bk.id));
                            }
                          }}
                          className="p-1 text-luxury-brown-500 hover:text-rose-700 hover:bg-rose-50 rounded border border-luxury-brown-200 transition-colors cursor-pointer"
                          title="Move to Deleted Folder (Trash)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                      const mainBookingSource: 'Direct' | 'Travel Agent' | 'OTA' =
                        bookingSource === 'Travel Agent' ? 'Travel Agent' : isOtaSelected ? 'OTA' : 'Direct';

                      return (
                        <select
                          value={mainBookingSource}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'Direct') {
                              setBookingSource('Direct');
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
                          <option value="Direct">Direct</option>
                          <option value="Travel Agent">Travel Agent</option>
                          <option value="OTA">OTA</option>
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
                      <label className="text-[10px] font-mono text-luxury-brown-600 block uppercase font-bold">Arrival Date *</label>
                    </div>
                    <input
                      type="date"
                      required
                      min={editingBooking ? undefined : getTodayDateStr()}
                      value={checkInDate}
                      onChange={(e) => handleCheckInDateChange(e.target.value)}
                      className="w-full h-9 px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900"
                    />
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
                      min={checkInDate || getTodayDateStr()}
                      value={checkOutDate}
                      onChange={(e) => handleCheckOutDateChange(e.target.value)}
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
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <span className="text-[10px] font-mono font-extrabold uppercase text-[#263449] block">
                        GST Invoice Option
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Click or unclick to apply GST ({configuredDefaultGst > 0 ? configuredDefaultGst : 5}% configured in Profile Settings)
                      </span>
                    </div>
                    <label
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-mono font-extrabold cursor-pointer select-none transition-all ${
                        bookingGstRate > 0
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-400 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={bookingGstRate > 0}
                        onChange={(e) => {
                          setBookingGstRate(
                            e.target.checked
                              ? configuredDefaultGst > 0
                                ? configuredDefaultGst
                                : 5
                              : 0
                          );
                        }}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                      <span>
                        GST Invoice {bookingGstRate > 0 ? `(${bookingGstRate}% Applied)` : '(Without GST)'}
                      </span>
                    </label>
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

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-7 space-y-1.5">
                      <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Payment Mode</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Voucher'] as PaymentMethod[]).map((pm) => {
                          const checked = paymentMethod === pm;
                          return (
                            <label
                              key={pm}
                              onClick={() => setPaymentMethod(pm)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                                checked ? 'bg-[#FBF4E0] !text-[#17120F] border-[#C49A3A] ring-1 ring-[#C49A3A]' : 'bg-white !text-slate-700 border-slate-200'
                              }`}
                            >
                              <input type="checkbox" checked={checked} onChange={() => {}} className="pointer-events-none" />
                              {pm === 'Bank Transfer' ? 'Bank' : pm}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[10px] font-mono text-slate-600 block uppercase font-bold">Advance Rupees (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={advanceAmount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const adv = parseFloat(e.target.value) || 0;
                          setAdvanceAmount(adv);
                          if (bookingStatus !== 'Cancelled') {
                            if (adv > 0) {
                              setBookingStatus('Confirmed');
                            } else {
                              setBookingStatus('In Process');
                            }
                          }
                        }}
                        placeholder="0"
                        className="w-full px-3 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-900"
                      />
                    </div>
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
                      {bookingGstRate > 0 ? ` (incl. ₹${calculatedBookingGst.toLocaleString('en-IN')} GST)` : ' (Without GST)'}
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
    </div>
  );
}
