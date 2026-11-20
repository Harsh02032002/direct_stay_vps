import React, { useState, useRef } from 'react';
import { 
  Room, Booking, GuestCheckIn, Invoice, Expense, Staff, AuditLog, 
  HotelSettings, WaterBottleRecord, PosOrder, PosItem, UserRole, RoomVerification,
  HotelPolicy, AllocatedGuestService, ExtraCharge, InventoryProduct, InventoryStockMovement, DeletedItemRecord,
  TravelAgent, AgentCommissionPayment, PaymentRecord
} from '../types';
import { showToast, showConfirmToast } from '../utils/toast';
import { evaluateAndBuildInvoice, normalizeInvoiceConditions, deduplicateInvoicesByBooking } from '../utils/invoiceConditions';
import {
  BillCharge,
  BillPayment,
  BillSettings,
  calculateBill,
  normalizeBillSettings,
  r2,
} from '../utils/billCalculator';
import { stayNights } from '../utils/folioCollector';
import {
  allocateGrcNumber,
  allocateInvoiceNumber,
  buildInvoiceRecord,
  buildStayBill,
  toGrcPrintData,
} from '../utils/stayBilling';
import { defaultGrcTerms, renderGrcHtml } from '../utils/printTemplates';
import { openPrintWindow } from '../utils/printDocument';
import TodayBookingsView from './TodayBookingsView';
import ReservationView from './ReservationView';
import CheckInFormView from './CheckInFormView';
import CalendarBookingView from './CalendarBookingView';
import DeletedFolderView from './DeletedFolderView';
import TravelAgentManagerView from './TravelAgentManagerView';
import InvoiceView from './InvoiceView';
import InvoiceConditionsModal from './InvoiceConditionsModal';
import EditCheckoutModal from './EditCheckoutModal';
import ReportsView from './ReportsView';
import DailyReportView from './DailyReportView';
import PolicyManager from './PolicyManager';
import DocumentPreviewBody, { printPreviewElement } from './DocumentPreviewBody';
import { 
  LayoutDashboard, BookOpen, UserCheck, Users, Building2, LogOut, 
  Hotel as HotelIcon, FileText, Sparkles, FileCheck, FileCheck2, FileSpreadsheet, 
  ShieldCheck, Search, Plus, Printer, Phone, Calendar, ArrowRight, Eye, 
  Filter, Check, Key, Shield, RefreshCw, Clock, DollarSign, Download, 
  Trash2, Tag, ChevronRight, AlertCircle, ShoppingBag, Droplets, Bed, CheckCircle2, X, Receipt, Edit, Undo2
} from 'lucide-react';

interface FrontDeskViewProps {
  currentSubTab: string;
  onSelectSubTab: (subTab: string) => void;
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  expenses: Expense[];
  staff: Staff[];
  policies: HotelPolicy[];
  waterBottles: WaterBottleRecord[];
  posOrders?: PosOrder[];
  posItems?: PosItem[];
  auditLogs: AuditLog[];
  roomVerifications?: RoomVerification[];
  hotelSettings: HotelSettings;
  currentRole: UserRole;
  loggedInUser?: string;
  selectedBookingForCheckin: Booking | null;
  setSelectedBookingForCheckin: (booking: Booking | null) => void;
  selectedBookingForInvoice: Booking | null;
  setSelectedBookingForInvoice: (booking: Booking | null) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onUpdateCheckins: (checkins: GuestCheckIn[]) => void;
  onUpdateInvoices: (invoices: Invoice[]) => void;
  onUpdatePolicies: (policies: HotelPolicy[]) => void;
  onUpdateHotelSettings: (settings: HotelSettings) => void;
  onAddAuditLog: (action: string, details: string) => void;
  onAddRoomVerification?: (verification: RoomVerification) => void;
  onUpdateWaterBottles?: (records: WaterBottleRecord[]) => void;
  inventoryProducts?: InventoryProduct[];
  onUpdateInventoryProducts?: (items: InventoryProduct[]) => void;
  inventoryStockMovements?: InventoryStockMovement[];
  onUpdateInventoryMovements?: (items: InventoryStockMovement[]) => void;
  selectedHotelId?: string;
  deletedItems?: DeletedItemRecord[];
  onMoveToDeletedFolder?: (item: Omit<DeletedItemRecord, 'id' | 'deletedAt' | 'deletedBy'>) => void;
  onRestoreDeletedItem?: (item: DeletedItemRecord) => void;
  onPermanentDelete?: (itemId: string) => void;
  travelAgents?: TravelAgent[];
  agentCommissionPayments?: AgentCommissionPayment[];
  onUpdateTravelAgents?: (agents: TravelAgent[]) => void;
  onUpdateAgentCommissionPayments?: (payments: AgentCommissionPayment[]) => void;
}

export default function FrontDeskView({
  currentSubTab,
  onSelectSubTab,
  rooms = [],
  bookings = [],
  checkins: rawCheckinsProp = [],
  invoices = [],
  expenses = [],
  staff = [],
  policies = [],
  waterBottles = [],
  posOrders = [],
  posItems = [],
  auditLogs = [],
  roomVerifications = [],
  hotelSettings,
  currentRole,
  loggedInUser,
  selectedBookingForCheckin,
  setSelectedBookingForCheckin,
  selectedBookingForInvoice,
  setSelectedBookingForInvoice,
  onUpdateRooms,
  onUpdateBookings,
  onUpdateCheckins: rawOnUpdateCheckins,
  onUpdateInvoices,
  onUpdatePolicies,
  onUpdateHotelSettings,
  onAddAuditLog,
  onAddRoomVerification,
  onUpdateWaterBottles,
  inventoryProducts = [],
  onUpdateInventoryProducts,
  inventoryStockMovements = [],
  onUpdateInventoryMovements,
  selectedHotelId,
  deletedItems = [],
  onMoveToDeletedFolder,
  onRestoreDeletedItem,
  onPermanentDelete,
  travelAgents = [],
  agentCommissionPayments = [],
  onUpdateTravelAgents,
  onUpdateAgentCommissionPayments
}: FrontDeskViewProps) {
  const checkins: GuestCheckIn[] = React.useMemo(() => {
    const list = [...rawCheckinsProp];
    bookings.forEach(b => {
      const rawSt = String(b.status || '').toLowerCase();
      const isCheckedOut = Boolean(
        b.isCompleted || (b as any).isCheckedOut || rawSt === 'checked out' || rawSt === 'checkedout'
      );
      const isCheckedIn = Boolean(
        !isCheckedOut && b.status !== 'Cancelled' && (b.isCheckedIn || rawSt === 'checked in')
      );
      if (isCheckedIn) {
        const bNameNorm = String(b.guestName || (b as any).customerName || '').trim().toLowerCase();
        const exists = list.some(c => {
          if (c.id === b.id || (c as any).bookingId === b.id) return true;
          const cNameNorm = String(c.guestName || '').trim().toLowerCase();
          if (c.roomNumber === b.roomNumber && cNameNorm && cNameNorm === bNameNorm) {
            if (!c.checkedOutDateTime || !b.checkInDate || c.checkInDate === b.checkInDate) {
              return true;
            }
          }
          return false;
        });
        if (!exists) {
          const matchedRm = rooms.find(r => r.number === b.roomNumber);
          list.push({
            id: b.id,
            hotelId: b.hotelId,
            guestName: b.guestName || (b as any).customerName || 'Guest',
            mobile: b.mobile || '',
            emailAddress: b.email || '',
            address: b.address || '',
            idType: 'Aadhaar',
            idNumber: b.aadhaarNumber || '',
            roomNumber:
              b.roomNumber ||
              (Array.isArray((b as any).roomNumbers) ? (b as any).roomNumbers[0] : '') ||
              '101',
            roomType: b.roomType || matchedRm?.category || 'Standard',
            roomRate:
              matchedRm?.rate ||
              (b.bookingAmount && b.nights
                ? Math.round(b.bookingAmount / Math.max(1, b.nights))
                : 2000),
            checkInDate: b.checkInDate,
            arrivalTime: (b as any).checkInTime || '12:00 PM',
            checkOutDate: b.checkOutDate,
            departureTime: '11:00 AM',
            numGuests: (Number(b.adults) || 2) + (Number(b.children) || 0),
            adults: Number(b.adults) || 2,
            children: Number(b.children) || 0,
            advanceAmount: Number(b.advanceAmount ?? (b as any).amountPaid) || 0,
            paymentMethod: b.paymentMethod || (b as any).paymentMode || 'Cash',
            status: 'Active',
            hasExtraBed: b.hasExtraBed,
            extraBedCount: b.extraBedCount,
            extraBedRate: b.extraBedRate,
            bookedRooms: b.bookedRooms,
            isGroupCheckIn: b.isGroupCheckIn,
            groupBookingId: b.groupBookingId,
          } as unknown as GuestCheckIn);
        }
      }
    });
    return list;
  }, [rawCheckinsProp, bookings, rooms]);

  const onUpdateCheckins = (updated: GuestCheckIn[]) => {
    rawOnUpdateCheckins(updated);
  };

  // Local state for navigation sub-views inside Room Management, Reports, etc.
  const [roomSubView, setRoomSubView] = useState<'inventory' | 'calendar'>('inventory');
  const [reportSubView, setReportSubView] = useState<'operational' | 'daily'>('operational');
  const [preArrivalSearch, setPreArrivalSearch] = useState('');
  const [preArrivalDateFilter, setPreArrivalDateFilter] = useState<'all' | 'today'>('all');
  const [prefillForReservation, setPrefillForReservation] = useState<{ roomNumber?: string; roomType?: string; checkInDate?: string; checkInTime?: string } | null>(null);
  
  // Quick Search state for In-House & Document archives
  const [inHouseSearch, setInHouseSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState('All');
  
  // Selected item modals
  const [viewingGrc, setViewingGrc] = useState<GuestCheckIn | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{ title: string; type: string; guestName: string; roomNumber: string; date: string; fileData?: string } | null>(null);

  // Edit In-House / Walk-In Guest Modal State
  const [editingInHouseGuest, setEditingInHouseGuest] = useState<GuestCheckIn | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestMobile, setEditGuestMobile] = useState('');
  const [editGuestEmail, setEditGuestEmail] = useState('');
  const [editGuestAddress, setEditGuestAddress] = useState('');
  const [editGuestIdType, setEditGuestIdType] = useState('Aadhaar');
  const [editGuestIdNumber, setEditGuestIdNumber] = useState('');
  const [editGuestRoomNo, setEditGuestRoomNo] = useState('');
  const [editGuestCheckInDate, setEditGuestCheckInDate] = useState('');
  const [editGuestCheckOutDate, setEditGuestCheckOutDate] = useState('');
  const [editGuestNumGuests, setEditGuestNumGuests] = useState(2);
  const [editGuestRoomRate, setEditGuestRoomRate] = useState(2000);
  const [editGuestAdvance, setEditGuestAdvance] = useState(0);
  const [editGuestCompanyName, setEditGuestCompanyName] = useState('');
  const [editGuestGstNumber, setEditGuestGstNumber] = useState('');
  const [editGuestHasExtraBed, setEditGuestHasExtraBed] = useState(false);
  const [editGuestExtraBedCount, setEditGuestExtraBedCount] = useState(1);
  const [editGuestExtraBedRate, setEditGuestExtraBedRate] = useState(500);
  const [editGuestDiscount, setEditGuestDiscount] = useState(0);
  const [editGuestPaymentMethod, setEditGuestPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Online' | 'Custom'>('UPI');
  const [editCustomPayLabel, setEditCustomPayLabel] = useState('');

  // Hybrid / Split payment (e.g. ₹2000 Cash + rest UPI) for In-House Edit & Check-Out modals
  type SplitMode = 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Other';
  const SPLIT_MODES: SplitMode[] = ['Cash', 'UPI', 'Card', 'Bank', 'Other'];
  const emptySplit: Record<SplitMode, number | ''> = { Cash: '', UPI: '', Card: '', Bank: '', Other: '' };
  const [editHybridPay, setEditHybridPay] = useState(false);
  const [editSplit, setEditSplit] = useState<Record<SplitMode, number | ''>>(emptySplit);
  const [editSplitOtherLabel, setEditSplitOtherLabel] = useState('');
  const editSplitTotal = SPLIT_MODES.reduce((s, m) => s + (Number(editSplit[m]) || 0), 0);
  const normalizeSplitMode = (m: any): SplitMode => {
    const v = String(m || '').toLowerCase();
    if (v === 'cash') return 'Cash';
    if (v === 'upi') return 'UPI';
    if (v === 'card') return 'Card';
    if (v === 'bank' || v === 'online' || v === 'bank transfer' || v === 'neft') return 'Bank';
    return 'Other';
  };

  // Check-Out Confirmation & Room Damage / Fine Modal State
  const [checkoutConfirmGuest, setCheckoutConfirmGuest] = useState<GuestCheckIn | null>(null);
  const [coHasDamageFine, setCoHasDamageFine] = useState<boolean>(false);
  const [coDamageDesc, setCoDamageDesc] = useState<string>('');
  const [coDamageAmount, setCoDamageAmount] = useState<number>(0);
  const [coPayAmount, setCoPayAmount] = useState<number>(0);
  const [coPayAmountTouched, setCoPayAmountTouched] = useState<boolean>(false);
  const [coPayMethod, setCoPayMethod] = useState<'UPI' | 'Cash' | 'Card' | 'Bank' | 'Custom'>('UPI');
  const [coCustomPayLabel, setCoCustomPayLabel] = useState<string>('');
  const [coHybridPay, setCoHybridPay] = useState<boolean>(false);
  const [coSplit, setCoSplit] = useState<Record<SplitMode, number | ''>>(emptySplit);
  const [coSplitOtherLabel, setCoSplitOtherLabel] = useState<string>('');
  const [coSplitTarget, setCoSplitTarget] = useState<'checkout' | 'advance'>('checkout');
  const coSplitTotal = r2(SPLIT_MODES.reduce((s, m) => s + (Number(coSplit[m]) || 0), 0));
  const [coRoomInspected, setCoRoomInspected] = useState<boolean>(true);
  const [coMinibarVerified, setCoMinibarVerified] = useState<boolean>(true);
  const [coLinenVerified, setCoLinenVerified] = useState<boolean>(true);
  // Editable bill adjustments in the Check-Out modal (same fields as "Edit Invoice"). A key that is absent = automatic value.
  const [coOv, setCoOv] = useState<Record<string, string>>({});
  const [coMarkPaid, setCoMarkPaid] = useState<boolean>(false);
  const coOvNum = (ov: Record<string, string>, key: string): number | undefined => {
    if (!(key in ov)) return undefined;
    const n = Number(ov[key]);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };
  const [isConditionsModalOpen, setIsConditionsModalOpen] = useState<boolean>(false);
  const [editingCheckedOutGuest, setEditingCheckedOutGuest] = useState<GuestCheckIn | null>(null);
  const [checkedOutHistoryFilter, setCheckedOutHistoryFilter] = useState<'today' | '7days' | 'all'>('all');
  const [checkedOutSearch, setCheckedOutSearch] = useState<string>('');

  const handleOpenCheckoutConfirmModal = (guest: GuestCheckIn) => {
    setCheckoutConfirmGuest(guest);
    setCoHasDamageFine(false);
    setCoDamageDesc('');
    setCoDamageAmount(0);
    setCoPayAmountTouched(false);
    setCoPayAmount(0);
    setCoPayMethod((guest.paymentMethod as any) === 'Cash' ? 'Cash' : 'UPI');
    setCoCustomPayLabel('');
    setCoHybridPay(false);
    setCoSplit(emptySplit);
    setCoSplitOtherLabel('');
    setCoRoomInspected(true);
    setCoMinibarVerified(true);
    setCoLinenVerified(true);
    setCoOv({});
    const initialCalc = computeConfirmGuestFinancials(guest, 0);
    setCoMarkPaid(initialCalc.balanceDue <= 0);
    setCoSplitTarget(initialCalc.balanceDue <= 0 && initialCalc.alreadyPaid > 0 ? 'advance' : 'checkout');
  };

  const handlePrintGuestGrc = (guest: GuestCheckIn) => {
    const billSettings = normalizeBillSettings(hotelSettings);
    const matchedBooking =
      bookings.find(
        b =>
          b.id === guest.id ||
          ((guest as any).bookingId && b.id === (guest as any).bookingId)
      ) || null;
    const existingGrcNumbers = [
      ...checkins.map(c => (c as any).grcNumber as string | undefined),
      ...bookings.map(b => (b as any).grcNumber as string | undefined),
    ];
    const regNo =
      String((guest as any).grcNumber || (matchedBooking as any)?.grcNumber || '').trim() ||
      allocateGrcNumber(existingGrcNumbers, billSettings);
    const roomObj = rooms.find(r => r.number === guest.roomNumber);
    const rawTerms = Array.isArray(hotelSettings?.grcTerms)
      ? hotelSettings.grcTerms.filter(t => String(t || '').trim().length > 0)
      : undefined;
    const grcData = toGrcPrintData({
      hotel: hotelSettings,
      regNo,
      booking: matchedBooking,
      checkin: guest,
      roomRate: Number(guest.roomRate) || roomObj?.rate,
      roomType: guest.roomType || roomObj?.category,
      settings: billSettings,
      terms: rawTerms && rawTerms.length > 0 ? rawTerms : defaultGrcTerms(),
    });
    openPrintWindow(renderGrcHtml(grcData), true);
  };

  const computeConfirmGuestFinancials = (
    guest: GuestCheckIn,
    extraPendingFine = 0,
    ov: Record<string, string> = coOv
  ) => {
    const effectiveOut = guest.checkOutDate || new Date().toISOString().split('T')[0];
    const nights = stayNights(guest.checkInDate, effectiveOut, (guest as any).nights);
    const baseSettings = normalizeBillSettings(hotelSettings);

    // STRICT IMMUTABILITY: If an invoice already exists for this stay, lock GST rate to that invoice's tax mode
    const matchedBooking =
      bookings.find(
        b =>
          b.id === guest.id ||
          ((guest as any).bookingId && b.id === (guest as any).bookingId)
      ) || null;
    const existingStayInv = invoices.find(
      inv =>
        !inv.isSeparateInvoice &&
        (inv.bookingId === guest.id ||
          inv.checkInId === guest.id ||
          (matchedBooking && inv.bookingId === matchedBooking.id))
    );

    const guestDefaultGst =
      guest.isWithoutGst === true || (guest.gstRate !== undefined && Number(guest.gstRate) <= 0)
        ? 0
        : guest.gstRate !== undefined && Number.isFinite(Number(guest.gstRate))
        ? Number(guest.gstRate)
        : hotelSettings?.isGstEnabled === false
        ? 0
        : baseSettings.roomGstRate;

    const ovGst = coOvNum(ov, 'gst');
    let resolvedGstRate = ovGst ?? guestDefaultGst;
    if (existingStayInv) {
      const lockedNoGst =
        existingStayInv.isWithoutGst === true ||
        (existingStayInv.gstRate !== undefined && Number(existingStayInv.gstRate) <= 0) ||
        (existingStayInv.gstRate === undefined && Number(existingStayInv.gst || 0) <= 0);
      resolvedGstRate = lockedNoGst
        ? 0
        : Math.max(0.01, Number(existingStayInv.gstRate) || baseSettings.roomGstRate || 5);
    }

    const gstEnabled = resolvedGstRate > 0;
    const effectiveSettings: BillSettings = {
      ...baseSettings,
      roomGstRate: gstEnabled ? resolvedGstRate : 0,
      foodGstRate: gstEnabled
        ? ovGst !== undefined
          ? resolvedGstRate
          : baseSettings.foodGstRate || resolvedGstRate
        : 0,
    };

    const fallbackRate =
      rooms.find(r => r.number === guest.roomNumber)?.rate || 2000;
    const checkinForFolio: GuestCheckIn = {
      ...guest,
      checkOutDate: effectiveOut,
      roomRate:
        guest.isGroupCheckIn && Array.isArray(guest.bookedRooms) && guest.bookedRooms.length > 0
          ? guest.roomRate
          : Number(guest.roomRate) > 0
          ? Number(guest.roomRate)
          : fallbackRate,
      payments: Array.isArray(guest.payments)
        ? guest.payments.filter(
            p => p && Number(p.amount) > 0 && !String(p.notes || '').toLowerCase().includes('marked as due')
          )
        : undefined,
    };

    const extraChargesNow: BillCharge[] = [];
    if (Number(extraPendingFine) > 0) {
      extraChargesNow.push({
        id: 'co-pending-fine',
        kind: 'fine',
        description: coDamageDesc.trim() || 'Room Damage / Breakage Penalty',
        amount: Math.max(0, Number(extraPendingFine)),
        roomNumber: guest.roomNumber,
      });
    }

    const extraPaymentsNow: BillPayment[] = [];
    if (!Array.isArray(checkinForFolio.payments) || checkinForFolio.payments.length === 0) {
      const deskPaid =
        Math.max(0, Number(checkinForFolio.cashAmountPaid) || 0) +
        Math.max(0, Number(checkinForFolio.onlineAmountPaid) || 0);
      if (deskPaid > 0) {
        extraPaymentsNow.push({
          id: `desk-${checkinForFolio.id}`,
          amount: r2(deskPaid),
          method: String(checkinForFolio.paymentMethod || 'Cash'),
          date: checkinForFolio.checkInDate,
          note: 'Check-In Desk Payment',
        });
      }
    }

    const ovDiscount = coOvNum(ov, 'discount');
    const stayBill = buildStayBill({
      booking: matchedBooking,
      checkin: checkinForFolio,
      posOrders,
      waterBottles,
      rooms,
      settings: effectiveSettings,
      additionalCharges: extraChargesNow,
      additionalPayments: extraPaymentsNow,
      gstEnabledOverride: gstEnabled,
      discountOverride: ovDiscount !== undefined ? Math.max(0, ovDiscount) : undefined,
    });

    const ovRoom = coOvNum(ov, 'room');
    const ovExtraBed = coOvNum(ov, 'extraBed');
    const ovExtraPerson = coOvNum(ov, 'extraPerson');
    const ovFood = coOvNum(ov, 'food');
    const ovWater = coOvNum(ov, 'water');
    const ovPaid = coOvNum(ov, 'paid');

    let finalBill = stayBill.bill;
    let finalCharges = stayBill.folio.charges;
    let finalPayments = stayBill.folio.payments;
    let finalSettings = effectiveSettings;

    if (
      ovRoom !== undefined ||
      ovExtraBed !== undefined ||
      ovExtraPerson !== undefined ||
      ovFood !== undefined ||
      ovWater !== undefined ||
      ovPaid !== undefined
    ) {
      let adjustedCharges = [...stayBill.folio.charges];
      let adjustedPayments = [...stayBill.folio.payments];

      if (ovRoom !== undefined) {
        adjustedCharges = adjustedCharges.filter(c => c.kind !== 'room');
        if (ovRoom > 0) {
          adjustedCharges.push({
            id: `ovr-room-${guest.roomNumber}`,
            kind: 'room',
            description: 'Room Charges',
            amount: Math.max(0, ovRoom),
            rate: r2(Math.max(0, ovRoom) / Math.max(1, nights)),
            nights,
            roomNumber: guest.roomNumber,
            sourceKey: `ovr-room:${guest.roomNumber}`,
          });
        }
        finalSettings = { ...effectiveSettings, roomRateIncludesGst: false };
      }
      if (ovExtraBed !== undefined) {
        adjustedCharges = adjustedCharges.filter(c => c.kind !== 'extra_bed');
        if (ovExtraBed > 0) {
          adjustedCharges.push({
            id: `ovr-xbed-${guest.roomNumber}`,
            kind: 'extra_bed',
            description: 'Extra Bed Charges',
            amount: Math.max(0, ovExtraBed),
            roomNumber: guest.roomNumber,
            sourceKey: `ovr-xbed:${guest.roomNumber}`,
          });
        }
      }
      if (ovExtraPerson !== undefined) {
        adjustedCharges = adjustedCharges.filter(c => c.kind !== 'extra_person');
        if (ovExtraPerson > 0) {
          adjustedCharges.push({
            id: `ovr-xpax-${guest.roomNumber}`,
            kind: 'extra_person',
            description: 'Extra Person Charges',
            amount: Math.max(0, ovExtraPerson),
            roomNumber: guest.roomNumber,
            sourceKey: `ovr-xpax:${guest.roomNumber}`,
          });
        }
      }
      if (ovFood !== undefined) {
        adjustedCharges = adjustedCharges.filter(c => c.kind !== 'food');
        if (ovFood > 0) {
          adjustedCharges.push({
            id: `ovr-food-${guest.roomNumber}`,
            kind: 'food',
            description: 'Food & Restaurant Charges',
            amount: Math.max(0, ovFood),
            roomNumber: guest.roomNumber,
            sourceKey: `ovr-food:${guest.roomNumber}`,
          });
        }
      }
      if (ovWater !== undefined) {
        adjustedCharges = adjustedCharges.filter(c => c.kind !== 'water' && c.kind !== 'laundry');
        if (ovWater > 0) {
          adjustedCharges.push({
            id: `ovr-water-${guest.roomNumber}`,
            kind: 'water',
            description: 'Water / Laundry Charges',
            amount: Math.max(0, ovWater),
            roomNumber: guest.roomNumber,
            sourceKey: `ovr-water:${guest.roomNumber}`,
          });
        }
      }
      if (ovPaid !== undefined) {
        const cleanPaid = r2(Math.max(0, ovPaid));
        adjustedPayments =
          cleanPaid > 0
            ? [
                {
                  id: 'ovr-paid',
                  amount: cleanPaid,
                  method: String(guest.paymentMethod || 'Cash'),
                  date: effectiveOut,
                  note: 'Advance / Paid',
                },
              ]
            : [];
      }

      finalCharges = adjustedCharges;
      finalPayments = adjustedPayments;
      finalBill = calculateBill({
        charges: adjustedCharges,
        payments: adjustedPayments,
        discount: stayBill.folio.discount,
        gstEnabled,
        settings: finalSettings,
      });
    }

    const roomCharges = finalBill.legacy.roomCharges;
    const extraBedTotal = finalBill.legacy.extraBedCharges;
    const extraPersonTotal = finalBill.legacy.extraPersonCharges;
    const earlyCheckInTotal = finalBill.legacy.earlyCheckInCharges;
    const foodSum = finalBill.legacy.foodCharges;
    const waterSum = finalBill.legacy.waterCharges;
    const laundryOnlySum = finalBill.legacy.laundryCharges;
    const laundrySum = r2(waterSum + laundryOnlySum);
    const damageSum = finalBill.legacy.fineCharges;
    const otherExtrasSum = r2(finalBill.legacy.serviceCharges + finalBill.legacy.otherCharges);
    const discountVal = finalBill.discount;
    const subtotal = finalBill.taxableAmount;
    const gstRate = finalBill.isGstInvoice ? finalBill.headlineGstRate || resolvedGstRate : 0;
    const gstAmount = finalBill.totalTax;
    const cgst = finalBill.cgst;
    const sgst = finalBill.sgst;
    const grandTotal = finalBill.grandTotal;
    const alreadyPaid = finalBill.receipts;
    const balanceDue = finalBill.balance;

    return {
      nights,
      roomCharges,
      extraBedTotal,
      extraPersonTotal,
      earlyCheckInTotal,
      foodSum,
      waterSum,
      laundryOnlySum,
      laundrySum,
      damageSum,
      otherExtrasSum,
      discountVal,
      subtotal,
      gstRate,
      gstAmount,
      cgst,
      sgst,
      grandTotal,
      alreadyPaid,
      balanceDue,
      bill: finalBill,
      charges: finalCharges,
      payments: finalPayments,
      settings: finalSettings,
      baseSettings,
      gstEnabled,
      roomNumbers:
        stayBill.folio.roomNumbers.length > 0
          ? stayBill.folio.roomNumbers
          : [guest.roomNumber],
    };
  };

  const handleAddFineToConfirmGuest = () => {
    if (!checkoutConfirmGuest) return;
    const amt = Math.max(0, Number(coDamageAmount) || 0);
    if (amt <= 0) {
      showToast('Please enter a Room Damage / Fine Amount (₹) greater than 0.', 'warning');
      return;
    }
    const desc = coDamageDesc.trim() || 'Room Damage / Breakage Penalty';
    const newFine: ExtraCharge = {
      id: `EC-FINE-${Date.now()}`,
      category: 'Damage',
      description: `Damage Fine: ${desc}`,
      amount: amt,
      dateTime: new Date().toISOString()
    };
    const updatedGuest: GuestCheckIn = {
      ...checkoutConfirmGuest,
      extraCharges: [...(checkoutConfirmGuest.extraCharges || []), newFine]
    };
    setCheckoutConfirmGuest(updatedGuest);
    onUpdateCheckins(checkins.map(c => (c.id === updatedGuest.id ? updatedGuest : c)));
    showToast(`Added Room Damage Fine ₹${amt.toLocaleString('en-IN')} (${desc}) to bill`, 'success');
    setCoDamageDesc('');
    setCoDamageAmount(0);
  };

  const handleRemoveChargeFromConfirmGuest = (chargeId: string) => {
    if (!checkoutConfirmGuest) return;
    const updatedGuest: GuestCheckIn = {
      ...checkoutConfirmGuest,
      extraCharges: (checkoutConfirmGuest.extraCharges || []).filter(ec => ec.id !== chargeId)
    };
    setCheckoutConfirmGuest(updatedGuest);
    onUpdateCheckins(checkins.map(c => (c.id === updatedGuest.id ? updatedGuest : c)));
  };

  const handleConfirmFinalCheckOut = () => {
    if (!checkoutConfirmGuest) return;
    let workingGuest: GuestCheckIn = {
      ...checkoutConfirmGuest,
      extraCharges: [...(checkoutConfirmGuest.extraCharges || [])]
    };

    // If admin typed a Fine Amount without clicking "+ Add Fine", automatically include it!
    if (Number(coDamageAmount) > 0) {
      const desc = coDamageDesc.trim() || 'Room Damage / Breakage Penalty';
      workingGuest.extraCharges = [
        ...(workingGuest.extraCharges || []),
        {
          id: `EC-FINE-${Date.now()}`,
          category: 'Damage',
          description: `Damage Fine: ${desc}`,
          amount: Number(coDamageAmount),
          dateTime: new Date().toISOString()
        }
      ];
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const checkoutPayId = `PAY-CO-${Date.now()}`;

    const coSplitLabel = (m: SplitMode): string =>
      m === 'Other' ? (coSplitOtherLabel.trim() || 'Other') : m;
    const coSplitEntries = coHybridPay
      ? SPLIT_MODES.map(m => ({ mode: m, amount: Math.max(0, r2(Number(coSplit[m]) || 0)) })).filter(e => e.amount > 0)
      : [];
    const resolvedSingleCoMethod =
      coPayMethod === 'Custom' ? (coCustomPayLabel.trim() || 'Custom') : coPayMethod;

    // If receptionist chose to split the Advance / Already-Paid amount across Cash/UPI/Card/Custom:
    let effectiveOvForCalc = coOv;
    if (coHybridPay && coSplitTarget === 'advance' && coSplitEntries.length > 0) {
      const keptNonAdvance = (workingGuest.payments || []).filter(p => p && p.paymentType !== 'Advance Deposit');
      const priorAdvRec = (workingGuest.payments || []).find(p => p && p.paymentType === 'Advance Deposit');
      const splitAdvRecs: PaymentRecord[] = coSplitEntries.map(e => ({
        id: `PAY-${workingGuest.id}-adv-${e.mode.toLowerCase()}`,
        amount: e.amount,
        paymentMethod: coSplitLabel(e.mode) as any,
        paymentType: 'Advance Deposit',
        dateTime: priorAdvRec?.dateTime || workingGuest.checkInDate || nowIso,
        notes: `Hybrid payment: ₹${e.amount} via ${coSplitLabel(e.mode)}${coSplitOtherLabel.trim() && e.mode !== 'Other' ? ` (${coSplitOtherLabel.trim()})` : ''}`,
      }));
      workingGuest = {
        ...workingGuest,
        advanceAmount: coSplitTotal,
        cashAmountPaid: 0,
        onlineAmountPaid: 0,
        payments: [...splitAdvRecs, ...keptNonAdvance],
      };
      const { paid: _dropPaidOv, ...restOv } = coOv;
      effectiveOvForCalc = restOv;
    }

    const calc = computeConfirmGuestFinancials(workingGuest, 0, effectiveOvForCalc);
    const collectedNow = coHybridPay
      ? coSplitTarget === 'checkout'
        ? coSplitTotal
        : 0
      : coMarkPaid && !coPayAmountTouched
      ? calc.balanceDue
      : coPayAmountTouched
      ? Math.max(0, r2(Number(coPayAmount) || 0))
      : 0;

    const nextPayments = [...(workingGuest.payments || [])];
    if (coHybridPay && coSplitTarget === 'checkout' && coSplitEntries.length > 0) {
      coSplitEntries.forEach(e => {
        nextPayments.push({
          id: `${checkoutPayId}-${e.mode.toLowerCase()}`,
          amount: e.amount,
          paymentMethod: coSplitLabel(e.mode) as any,
          paymentType: 'Settle Balance',
          dateTime: nowIso,
          notes: `Final Checkout Hybrid Settlement (${coSplitLabel(e.mode)}${coSplitOtherLabel.trim() && e.mode !== 'Other' ? ` - ${coSplitOtherLabel.trim()}` : ''})`,
        });
      });
    } else if (!coHybridPay && collectedNow > 0) {
      nextPayments.push({
        id: checkoutPayId,
        amount: collectedNow,
        paymentMethod: resolvedSingleCoMethod as any,
        paymentType: 'Settle Balance',
        dateTime: nowIso,
        notes: coPayMethod === 'Custom' && coCustomPayLabel.trim()
          ? `Final Checkout Settlement (${coCustomPayLabel.trim()})`
          : 'Final Checkout Settlement'
      });
    }

    const resolvedSummaryMethod =
      coHybridPay && coSplitEntries.length > 0
        ? coSplitEntries.map(e => `${coSplitLabel(e.mode)} ₹${e.amount}`).join(' + ')
        : resolvedSingleCoMethod;

    const totalPaidFinal = r2(calc.alreadyPaid + collectedNow);
    const finalPending = Math.max(0, r2(calc.grandTotal - totalPaidFinal));

    const finalizedGuest: GuestCheckIn = {
      ...workingGuest,
      payments: nextPayments,
      paymentMethod: (coHybridPay && coSplitEntries.length > 0 ? coSplitLabel(coSplitEntries[0].mode) : resolvedSingleCoMethod) as any,
      totalAmount: calc.grandTotal,
      discount: calc.discountVal,
      pendingAmount: finalPending,
      checkedOutDateTime: nowIso,
      checkedOutBy: loggedInUser || currentRole || 'Front Desk'
    };

    // NOTE: the checked-out guest record (with its 24-hour Undo snapshot) is saved further below,
    // once the final invoice has been resolved.

    // Release room(s) for housekeeping
    const stayRoomNumbers = Array.from(
      new Set(
        [
          finalizedGuest.roomNumber,
          ...(finalizedGuest.bookedRooms || []).map(br => br.roomNumber)
        ].filter(Boolean)
      )
    );
    // Remember the exact pre-checkout state of these rooms + the booking so Undo can restore it
    const priorRoomStates = rooms
      .filter(r => stayRoomNumbers.includes(r.number))
      .map(r => ({ number: r.number, status: r.status, cleaningStatus: r.cleaningStatus }));
    const matchesFinalizedBooking = (b: Booking): boolean => {
      if (b.id === finalizedGuest.id || ((finalizedGuest as any).bookingId && b.id === (finalizedGuest as any).bookingId)) {
        return true;
      }
      if (!b.isCompleted && b.roomNumber === finalizedGuest.roomNumber) {
        const bName = String(b.guestName || '').trim().toLowerCase();
        const gName = String(finalizedGuest.guestName || '').trim().toLowerCase();
        if (bName && bName === gName && (!b.checkInDate || !finalizedGuest.checkInDate || b.checkInDate === finalizedGuest.checkInDate)) {
          return true;
        }
      }
      return false;
    };
    const priorBookingState = (() => {
      const pb = bookings.find(matchesFinalizedBooking);
      return pb
        ? { id: pb.id, isCheckedIn: pb.isCheckedIn, isCompleted: pb.isCompleted, status: pb.status }
        : null;
    })();
    onUpdateRooms(
      rooms.map(r =>
        stayRoomNumbers.includes(r.number)
          ? { ...r, status: 'Dirty' as const, cleaningStatus: 'Dirty' as const }
          : r
      )
    );

    // Update associated Booking record for this stay (never mark unrelated future bookings in that room as CheckedOut)
    onUpdateBookings(
      bookings.map(b =>
        matchesFinalizedBooking(b)
          ? ({
              ...b,
              isCheckedIn: false,
              isCompleted: true,
              isCheckedOut: true,
              status: 'CheckedOut' as any,
              amountPaid: totalPaidFinal,
              dueAmount: finalPending,
              paymentStatus: finalPending <= 0 ? 'Paid' : totalPaidFinal > 0 ? 'Partially Paid' : 'Unpaid',
            } as any)
          : b
      )
    );

    // Create or update Official Tax Invoice / Room Bill via centralized 8-condition engine
    const activeConditions = normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
      ...hotelSettings,
      isGstEnabled: calc.gstRate > 0,
      defaultGstRate: calc.gstRate
    });
    const matchedBooking = bookings.find(matchesFinalizedBooking) || null;
    const existingInv = invoices.find(
      inv =>
        !inv.isSeparateInvoice &&
        (inv.bookingId === finalizedGuest.id ||
          inv.checkInId === finalizedGuest.id ||
          (matchedBooking && inv.bookingId === matchedBooking.id))
    );
    const hasManualPaidOverride = 'paid' in effectiveOvForCalc;
    const evalResult = evaluateAndBuildInvoice({
      hotelId: finalizedGuest.hotelId || hotelSettings?.id || selectedHotelId,
      hotelSettings,
      booking: matchedBooking
        ? { ...matchedBooking, isCheckedIn: false, isCompleted: true, status: 'CheckedOut' as any }
        : null,
      checkin: finalizedGuest,
      rooms,
      posOrders,
      waterBottles,
      existingInvoices: invoices,
      conditions: activeConditions,
      isManualAction: false,
      isCheckoutTrigger: true,
      allowUpdateExistingFinalOnCheckout: true,
      overrideDiscount: calc.discountVal,
      overrideGstRate: calc.gstRate,
      ...(hasManualPaidOverride ? { overrideAdvancePaid: totalPaidFinal } : {}),
      ...(coOvNum(coOv, 'room') !== undefined ? { overrideRoomCharges: calc.roomCharges } : {}),
      ...(coOvNum(coOv, 'extraBed') !== undefined ? { overrideExtraBedCharges: calc.extraBedTotal } : {}),
      ...(coOvNum(coOv, 'extraPerson') !== undefined ? { overrideExtraPersonCharges: calc.extraPersonTotal } : {}),
      ...(coOvNum(coOv, 'food') !== undefined ? { overrideFoodCharges: calc.foodSum } : {}),
      ...(coOvNum(coOv, 'water') !== undefined ? { overrideWaterOrLaundryCharges: calc.laundrySum } : {}),
      overridePaymentMethod: resolvedSummaryMethod as any,
      overrideNotes: calc.damageSum > 0 ? `Includes Room Damage / Fine: ₹${calc.damageSum}` : undefined,
      invoiceType: 'Tax Invoice'
    });

    const fallbackAllocated = allocateInvoiceNumber(invoices, calc.baseSettings);
    const invNum =
      evalResult.invoice?.invoiceNumber ||
      existingInv?.invoiceNumber ||
      fallbackAllocated.invoiceNumber;

    const fallbackPayments = hasManualPaidOverride
      ? totalPaidFinal > 0
        ? [
            {
              id: `pay-final-${finalizedGuest.id}`,
              amount: r2(totalPaidFinal),
              method: resolvedSummaryMethod,
              date: todayStr,
              note: 'Checkout Settlement',
            },
          ]
        : []
      : [
          ...calc.payments,
          ...(coHybridPay && coSplitTarget === 'checkout' && coSplitEntries.length > 0
            ? coSplitEntries.map(e => ({
                id: `${checkoutPayId}-${e.mode.toLowerCase()}`,
                amount: r2(e.amount),
                method: coSplitLabel(e.mode),
                date: todayStr,
                note: `Final Checkout Hybrid Settlement (${coSplitLabel(e.mode)})`,
              }))
            : collectedNow > 0
            ? [
                {
                  id: checkoutPayId,
                  amount: r2(collectedNow),
                  method: resolvedSingleCoMethod,
                  date: todayStr,
                  note: 'Final Checkout Settlement',
                },
              ]
            : []),
        ];

    const fallbackBill = calculateBill({
      charges: calc.charges,
      payments: fallbackPayments,
      discount: calc.discountVal,
      gstEnabled: calc.gstEnabled,
      settings: calc.settings,
    });

    const fallbackRecord = buildInvoiceRecord({
      id: existingInv?.id || `INV-STAY-${finalizedGuest.id}`,
      invoiceNumber: invNum,
      hotelId: finalizedGuest.hotelId || hotelSettings?.id,
      bookingId: matchedBooking?.id || finalizedGuest.id,
      checkInId: finalizedGuest.id,
      guestName: finalizedGuest.guestName,
      guestMobile: finalizedGuest.mobile,
      guestAddress: [finalizedGuest.address, finalizedGuest.city, finalizedGuest.state]
        .filter(Boolean)
        .join(', '),
      companyName: finalizedGuest.companyName,
      guestGstNumber: finalizedGuest.gstNumber,
      roomNumbers: calc.roomNumbers,
      checkInDate: finalizedGuest.checkInDate,
      checkOutDate: finalizedGuest.checkOutDate || todayStr,
      nights: calc.nights,
      bill: fallbackBill,
      paymentMethod: resolvedSummaryMethod,
      dateCreated: existingInv?.dateCreated || todayStr,
      invoiceStatus: 'Finalized',
      extra: {
        extraBedCount: finalizedGuest.hasExtraBed ? finalizedGuest.extraBedCount || 1 : 0,
        extraBedRate: finalizedGuest.extraBedRate || 500,
        isFinalInvoice: true,
        notes:
          calc.damageSum > 0
            ? `Includes Room Damage / Fine: ₹${calc.damageSum}`
            : existingInv?.notes,
      },
    });

    const rawFinalInvoice: Invoice =
      evalResult.invoice ||
      ({
        ...(existingInv || {}),
        ...(fallbackRecord as Invoice),
      } as Invoice);

    // Attach structured paymentHistory when multiple payment records exist so Finance / Reports credit each mode separately
    const finalInvoice: Invoice = {
      ...rawFinalInvoice,
      paymentMethod: resolvedSummaryMethod as any,
      ...(nextPayments.length >= 1
        ? {
            paymentHistory: nextPayments
              .filter(p => p && Number(p.amount) > 0)
              .map(p => {
                const rawDt = String(p.dateTime || '').trim();
                let localDate = todayStr;
                if (/^\d{4}-\d{2}-\d{2}$/.test(rawDt)) {
                  localDate = rawDt;
                } else if (rawDt) {
                  const parsed = new Date(rawDt);
                  if (!Number.isNaN(parsed.getTime())) {
                    localDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
                  } else {
                    localDate = rawDt.slice(0, 10);
                  }
                }
                return {
                  id: p.id,
                  amount: Number(p.amount),
                  paymentMethod: String(p.paymentMethod || 'Cash') as any,
                  date: localDate,
                  notes: p.notes,
                };
              }),
          }
        : {}),
    };

    const nextInvoices = deduplicateInvoicesByBooking(
      invoices.some(
        inv =>
          inv.id === finalInvoice.id ||
          (existingInv && inv.id === existingInv.id) ||
          (!inv.isSeparateInvoice && inv.bookingId && inv.bookingId === finalInvoice.bookingId)
      )
        ? invoices.map(inv =>
            inv.id === finalInvoice.id ||
            (existingInv && inv.id === existingInv.id) ||
            (!inv.isSeparateInvoice && inv.bookingId && inv.bookingId === finalInvoice.bookingId)
              ? finalInvoice
              : inv
          )
        : [finalInvoice, ...invoices]
    );
    onUpdateInvoices(nextInvoices);

    // Save the checked-out guest together with a snapshot that allows "Undo Check-Out" for 24 hours
    const { checkoutUndoSnapshot: _prevSnap, ...guestBeforeCheckout } = checkoutConfirmGuest as any;
    const undoSnapshot = {
      takenAt: nowIso,
      guest: {
        payments: guestBeforeCheckout.payments,
        extraCharges: guestBeforeCheckout.extraCharges,
        totalAmount: guestBeforeCheckout.totalAmount,
        discount: guestBeforeCheckout.discount,
        pendingAmount: guestBeforeCheckout.pendingAmount,
      },
      rooms: priorRoomStates,
      booking: priorBookingState,
      hadInvoice: Boolean(existingInv),
      invoice: existingInv || null,
      finalInvoiceId: finalInvoice.id,
    };
    onUpdateCheckins(
      checkins.map(c =>
        c.id === finalizedGuest.id
          ? { ...finalizedGuest, checkoutUndoSnapshot: undoSnapshot, checkoutUndoneAt: undefined, checkoutUndoneBy: undefined }
          : c
      )
    );

    onAddAuditLog(
      'Guest Checked Out',
      `Checked out ${finalizedGuest.guestName} from Room ${finalizedGuest.roomNumber}.${
        calc.damageSum > 0 ? ` Room Damage/Fine added: ₹${calc.damageSum}.` : ''
      } Final Invoice: ${invNum} (₹${calc.grandTotal}).`
    );

    showToast(
      `Check-Out Complete for Room ${finalizedGuest.roomNumber} (${finalizedGuest.guestName})! Final Invoice ${invNum} ready.`,
      'success'
    );

    setSelectedBookingForInvoice({
      ...(matchedBooking || {}),
      id: finalizedGuest.id,
      guestName: finalizedGuest.guestName,
      mobile: finalizedGuest.mobile,
      email: matchedBooking?.email || finalizedGuest.emailAddress || '',
      aadhaarNumber: finalizedGuest.aadhaarNumber || '',
      address: finalizedGuest.address || '',
      adults: finalizedGuest.adults || 1,
      children: finalizedGuest.children || 0,
      nights: calc.nights,
      bookingAmount: calc.grandTotal,
      bookingSource: finalizedGuest.bookingSource || 'Direct',
      roomNumber: finalizedGuest.roomNumber,
      roomType: (finalizedGuest.roomType || matchedBooking?.roomType || 'Standard') as any,
      checkInDate: finalizedGuest.checkInDate,
      checkOutDate: finalizedGuest.checkOutDate,
      advanceAmount: totalPaidFinal,
      paymentMethod: (resolvedSummaryMethod as any) || 'UPI',
      isCheckedIn: false,
      isCompleted: true,
      status: 'CheckedOut' as any
    } as Booking);
    setCheckoutConfirmGuest(null);
    onSelectSubTab('billing');
  };

  // ───────────── UNDO CHECK-OUT (valid for 24 hours after check-out) ─────────────
  const CHECKOUT_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

  const getUndoTimeLeftMs = (guest: GuestCheckIn): number => {
    if (!guest.checkedOutDateTime) return 0;
    const t = new Date(guest.checkedOutDateTime).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, CHECKOUT_UNDO_WINDOW_MS - (Date.now() - t));
  };

  const formatUndoTimeLeft = (ms: number): string => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const isSameGuestPerson = (a: Partial<GuestCheckIn>, b: Partial<GuestCheckIn>): boolean => {
    const mobA = String(a.mobile || '').replace(/\D/g, '').slice(-10);
    const mobB = String(b.mobile || '').replace(/\D/g, '').slice(-10);
    if (mobA.length === 10 && mobA === mobB) return true;
    const nameA = String(a.guestName || '').trim().toLowerCase();
    const nameB = String(b.guestName || '').trim().toLowerCase();
    return Boolean(nameA && nameA === nameB);
  };

  const handleUndoCheckOut = async (guest: GuestCheckIn) => {
    if (getUndoTimeLeftMs(guest) <= 0) {
      showToast('Undo window (24 hours) is over for this check-out.', 'error');
      return;
    }
    const snap = (guest as any).checkoutUndoSnapshot || null;
    const stayRoomNumbers = Array.from(
      new Set([guest.roomNumber, ...(guest.bookedRooms || []).map(br => br.roomNumber)].filter(Boolean))
    );

    // Block undo ONLY if the room has been given to a DIFFERENT in-house guest meanwhile
    const conflict = rawCheckinsProp.find(
      c =>
        c.id !== guest.id &&
        !c.checkedOutDateTime &&
        !isSameGuestPerson(c, guest) &&
        [c.roomNumber, ...(c.bookedRooms || []).map(br => br.roomNumber)].some(rn => stayRoomNumbers.includes(rn))
    );
    if (conflict) {
      showToast(
        `Cannot undo: Room ${conflict.roomNumber} is currently occupied by another guest (${String(conflict.guestName || '').trim()}).`,
        'error'
      );
      return;
    }

    // If the exact same guest already has another active In-House entry in this room (e.g. manually re-checked-in earlier),
    // avoid creating two active rows for the same room: drop the duplicate or keep the active one cleanly.
    const sameGuestActive = rawCheckinsProp.find(
      c =>
        c.id !== guest.id &&
        !c.checkedOutDateTime &&
        isSameGuestPerson(c, guest) &&
        [c.roomNumber, ...(c.bookedRooms || []).map(br => br.roomNumber)].some(rn => stayRoomNumbers.includes(rn))
    );
    if (sameGuestActive) {
      showToast(
        `${String(guest.guestName || '').trim()} is already active In-House in Room ${guest.roomNumber}.`,
        'info'
      );
      return;
    }

    const ok = await showConfirmToast({
      title: 'Confirm Undo Check-Out',
      message: `Undo Check-Out for ${String(guest.guestName || '').trim()} (Room ${guest.roomNumber})?\nGuest will move back to In-House Guests, Room ${guest.roomNumber} becomes Occupied again, and checkout settlement / invoice will be reverted.`,
      confirmLabel: 'Yes, Undo Check-Out',
      cancelLabel: 'Cancel',
      severity: 'warning',
    });
    if (!ok) return;

    const nowIso = new Date().toISOString();
    const {
      checkoutUndoSnapshot: _snap,
      checkedOutDateTime: _outAt,
      checkedOutBy: _outBy,
      ...rest
    } = guest as any;

    const restoredGuest: GuestCheckIn = {
      ...rest,
      status: 'Active',
      isCheckedOut: false,
      ...(snap?.guest
        ? {
            payments: snap.guest.payments,
            extraCharges: snap.guest.extraCharges,
            totalAmount: snap.guest.totalAmount,
            discount: snap.guest.discount,
            pendingAmount: snap.guest.pendingAmount,
          }
        : {
            payments: (guest.payments || []).filter(p => !String((p as any).id || '').startsWith('PAY-CO-')),
          }),
      checkoutUndoneAt: nowIso,
      checkoutUndoneBy: loggedInUser || currentRole || 'Front Desk',
    } as GuestCheckIn;

    onUpdateCheckins(rawCheckinsProp.map(c => (c.id === guest.id ? restoredGuest : c)));

    // Rooms: back to their pre-checkout state (Occupied)
    onUpdateRooms(
      rooms.map(r => {
        if (!stayRoomNumbers.includes(r.number)) return r;
        const prior = (snap?.rooms || []).find((pr: any) => pr.number === r.number);
        return {
          ...r,
          status: (prior?.status && prior.status !== 'Dirty' ? prior.status : 'Occupied') as any,
          cleaningStatus: (prior?.cleaningStatus || 'Clean') as any,
        };
      })
    );

    // Booking: back to checked-in
    onUpdateBookings(
      bookings.map(b => {
        const pb = snap?.booking;
        const isThis =
          b.id === guest.id ||
          ((guest as any).bookingId && b.id === (guest as any).bookingId) ||
          (pb?.id && b.id === pb.id);
        if (!isThis) return b;
        return {
          ...b,
          isCheckedIn: pb ? Boolean(pb.isCheckedIn) : true,
          isCompleted: pb ? Boolean(pb.isCompleted) : false,
          isCheckedOut: false,
          status: (pb?.status && String(pb.status).toLowerCase() !== 'checkedout' ? pb.status : 'Confirmed') as any,
        };
      })
    );

    // Invoice: restore the one that existed before check-out, or drop the one created at check-out
    if (snap) {
      if (snap.hadInvoice && snap.invoice) {
        onUpdateInvoices(
          invoices.map(inv =>
            inv.id === snap.invoice.id || inv.id === snap.finalInvoiceId ? (snap.invoice as Invoice) : inv
          )
        );
      } else if (snap.finalInvoiceId) {
        onUpdateInvoices(invoices.filter(inv => inv.id !== snap.finalInvoiceId));
      }
    }

    onAddAuditLog(
      'Check-Out Reverted',
      `Check-out of ${guest.guestName} (Room ${guest.roomNumber}) was reverted by ${
        loggedInUser || currentRole || 'Front Desk'
      } within the 24-hour undo window. Guest is In-House again.`
    );
    showToast(`Check-Out undone: ${guest.guestName} is back In-House (Room ${guest.roomNumber}).`, 'success');
  };

  const handleOpenEditInHouseGuest = (guest: GuestCheckIn) => {
    setEditingInHouseGuest(guest);
    setEditGuestName(guest.guestName || '');
    setEditGuestMobile(guest.mobile || '');
    setEditGuestEmail(guest.emailAddress || '');
    setEditGuestAddress(guest.address || '');
    setEditGuestIdType(guest.idType || (guest.passportNumber ? 'Passport' : 'Aadhaar'));
    setEditGuestIdNumber(guest.idNumber || guest.aadhaarNumber || guest.passportNumber || '');
    setEditGuestRoomNo(guest.roomNumber || '');
    setEditGuestCheckInDate(guest.checkInDate || '');
    setEditGuestCheckOutDate(guest.checkOutDate || '');
    setEditGuestNumGuests(guest.numGuests || 1);
    setEditGuestRoomRate(guest.roomRate || 2000);
    setEditGuestAdvance(guest.advanceAmount || 0);
    setEditGuestCompanyName(guest.companyName || '');
    setEditGuestGstNumber(guest.gstNumber || '');
    setEditGuestHasExtraBed(Boolean(guest.hasExtraBed));
    setEditGuestExtraBedCount(guest.extraBedCount || 1);
    setEditGuestExtraBedRate(guest.extraBedRate || 500);
    setEditGuestDiscount(guest.discount || 0);
    const rawPrevMethod = String(guest.paymentMethod || 'UPI');
    if (['UPI', 'Cash', 'Card', 'Online'].includes(rawPrevMethod)) {
      setEditGuestPaymentMethod(rawPrevMethod as any);
      setEditCustomPayLabel('');
    } else {
      setEditGuestPaymentMethod('Custom');
      setEditCustomPayLabel(rawPrevMethod);
    }

    // Detect an existing split (hybrid) advance: more than one payment mode on Advance Deposit records
    const advRecs = (guest.payments || []).filter(
      p => p && p.paymentType === 'Advance Deposit' && Number(p.amount) > 0
    );
    const byMode: Record<SplitMode, number> = { Cash: 0, UPI: 0, Card: 0, Bank: 0, Other: 0 };
    let otherLabel = '';
    advRecs.forEach(p => {
      const k = normalizeSplitMode(p.paymentMethod);
      byMode[k] += Number(p.amount) || 0;
      if (k === 'Other') otherLabel = String(p.paymentMethod || '');
    });
    const usedModes = SPLIT_MODES.filter(m => byMode[m] > 0);
    if (usedModes.length > 1) {
      setEditHybridPay(true);
      setEditSplit({
        Cash: byMode.Cash || '',
        UPI: byMode.UPI || '',
        Card: byMode.Card || '',
        Bank: byMode.Bank || '',
        Other: byMode.Other || '',
      });
      setEditSplitOtherLabel(otherLabel);
    } else {
      setEditHybridPay(false);
      setEditSplit(emptySplit);
      setEditSplitOtherLabel('');
    }
  };

  const getEditGrandTotal = (): number => {
    if (!editingInHouseGuest) return 0;
    const d1 = new Date(editGuestCheckInDate);
    const d2 = new Date(editGuestCheckOutDate);
    const nights = Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) || 1);
    const roomRent = Math.max(0, Number(editGuestRoomRate) || 0) * nights;
    const extraBed = editGuestHasExtraBed
      ? Math.max(1, Number(editGuestExtraBedCount) || 1) * Math.max(0, Number(editGuestExtraBedRate) || 0) * nights
      : 0;
    const sub = Math.max(0, roomRent + extraBed - Math.max(0, Number(editGuestDiscount) || 0));
    const gstPct = editingInHouseGuest.gstRate !== undefined
      ? Number(editingInHouseGuest.gstRate)
      : (hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 5));
    return sub + Math.round((sub * gstPct) / 100);
  };

  const handleToggleHybridPay = (on: boolean) => {
    setEditHybridPay(on);
    if (on) {
      // Pre-fill the current advance into the currently selected mode so only the split needs adjusting
      const key = normalizeSplitMode(editGuestPaymentMethod);
      const next: Record<SplitMode, number | ''> = { ...emptySplit };
      next[key] = Math.max(0, Number(editGuestAdvance) || 0) || '';
      setEditSplit(next);
    } else {
      // Collapse back to a single amount + the biggest mode
      const biggest = SPLIT_MODES.reduce(
        (best, m) => ((Number(editSplit[m]) || 0) > (Number(editSplit[best]) || 0) ? m : best),
        'Cash' as SplitMode
      );
      if (editSplitTotal > 0) {
        setEditGuestAdvance(editSplitTotal);
        setEditGuestPaymentMethod((biggest === 'Bank' ? 'Online' : biggest === 'Other' ? 'UPI' : biggest) as any);
      }
    }
  };

  const applyEditInHouseGuestChanges = (openInvoiceAfterSave = false) => {
    if (!editingInHouseGuest) return;
    if (!editGuestName.trim() || !editGuestMobile.trim() || !editGuestRoomNo.trim()) {
      showToast('Guest Name, Mobile, and Room Number are required.', 'warning');
      return;
    }

    const prevRoomNo = editingInHouseGuest.roomNumber;
    if (editGuestRoomNo !== prevRoomNo) {
      const targetRoom = rooms.find(r => r.number === editGuestRoomNo);
      if (!targetRoom) {
        showToast(`Room ${editGuestRoomNo} does not exist.`, 'error');
        return;
      }
      const otherOccupant = checkins.find(
        c => !c.checkedOutDateTime && c.id !== editingInHouseGuest.id && c.roomNumber === editGuestRoomNo
      );
      if (otherOccupant || targetRoom.status === 'Occupied') {
        showToast(`Room ${editGuestRoomNo} is currently occupied.`, 'error');
        return;
      }
    }

    const d1 = new Date(editGuestCheckInDate);
    const d2 = new Date(editGuestCheckOutDate);
    if (d2 < d1) {
      showToast('Check-out date cannot be earlier than check-in date.', 'warning');
      return;
    }
    const stayNights = Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) || 1);
    const targetRoomObj = rooms.find(r => r.number === editGuestRoomNo);
    const extraBedTotal = editGuestHasExtraBed
      ? Math.max(1, Number(editGuestExtraBedCount) || 1) * Math.max(0, Number(editGuestExtraBedRate) || 0) * stayNights
      : 0;
    const roomRentTotal = Math.max(0, Number(editGuestRoomRate) || 0) * stayNights;
    const discountVal = Math.max(0, Number(editGuestDiscount) || 0);
    const netRoomSubtotal = Math.max(0, roomRentTotal + extraBedTotal - discountVal);
    const dynamicGstPercent = editingInHouseGuest.gstRate !== undefined
      ? Number(editingInHouseGuest.gstRate)
      : (hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 5));
    const gstTax = Math.round((netRoomSubtotal * dynamicGstPercent) / 100);
    const newTotalAmount = netRoomSubtotal + gstTax;
    const alreadyPaid = (editingInHouseGuest.cashAmountPaid || 0) + (editingInHouseGuest.onlineAmountPaid || 0);
    // Hybrid / split payment: amount per mode typed by the receptionist (Cash / UPI / Card / Bank / custom)
    const splitEntries = editHybridPay
      ? SPLIT_MODES.map(m => ({ mode: m, amount: Math.max(0, Number(editSplit[m]) || 0) })).filter(e => e.amount > 0)
      : [];
    const advanceTotal = editHybridPay ? splitEntries.reduce((s, e) => s + e.amount, 0) : Number(editGuestAdvance) || 0;
    const biggestSplit = splitEntries.reduce(
      (best, e) => (e.amount > best.amount ? e : best),
      { mode: 'Cash' as SplitMode, amount: -1 }
    );
    const splitMethodLabel = (m: SplitMode): string =>
      m === 'Other' ? (editSplitOtherLabel.trim() || 'Other') : m;
    const resolvedSingleEditMethod =
      editGuestPaymentMethod === 'Custom'
        ? (editCustomPayLabel.trim() || 'Custom')
        : editGuestPaymentMethod;
    const effectiveMethod: any = editHybridPay
      ? (biggestSplit.mode === 'Bank' ? 'Online' : splitMethodLabel(biggestSplit.mode))
      : resolvedSingleEditMethod;
    const effectiveSummaryMethod: string = editHybridPay && splitEntries.length > 0
      ? splitEntries.map(e => `${splitMethodLabel(e.mode)} ₹${e.amount}`).join(' + ')
      : resolvedSingleEditMethod;
    const nowIsoPay = new Date().toISOString();
    const priorAdvanceRec = (editingInHouseGuest.payments || []).find(
      p => p && p.paymentType === 'Advance Deposit'
    );
    const hadPaymentsArray = Array.isArray(editingInHouseGuest.payments) && editingInHouseGuest.payments.length > 0;
    let nextPayments: PaymentRecord[] | undefined = editingInHouseGuest.payments;
    if (editHybridPay || hadPaymentsArray || editGuestPaymentMethod === 'Custom') {
      const keptPayments = (editingInHouseGuest.payments || []).filter(
        p => p && p.paymentType !== 'Advance Deposit'
      );
      // Legacy guests (no payments array) keep their desk payment so the folio stays correct
      const legacyDeskPaid = (editingInHouseGuest.cashAmountPaid || 0) + (editingInHouseGuest.onlineAmountPaid || 0);
      if (!hadPaymentsArray && legacyDeskPaid > 0) {
        keptPayments.push({
          id: `desk-${editingInHouseGuest.id}`,
          amount: legacyDeskPaid,
          paymentMethod: (editingInHouseGuest.paymentMethod || 'Cash') as any,
          paymentType: 'Partial Payment',
          dateTime: editingInHouseGuest.checkInDate || nowIsoPay,
          notes: 'Check-In Desk Payment',
        });
      }
      const advanceRecords: PaymentRecord[] = editHybridPay
        ? splitEntries.map(e => ({
            id: `PAY-${editingInHouseGuest.id}-adv-${e.mode.toLowerCase()}`,
            amount: e.amount,
            paymentMethod: (e.mode === 'Bank' ? 'Bank' : splitMethodLabel(e.mode)) as any,
            paymentType: 'Advance Deposit' as const,
            dateTime: priorAdvanceRec?.dateTime || nowIsoPay,
            notes: `Hybrid payment: ₹${e.amount} via ${splitMethodLabel(e.mode)}`,
          }))
        : advanceTotal > 0
        ? [
            {
              id: priorAdvanceRec?.id || `PAY-${editingInHouseGuest.id}-adv`,
              amount: advanceTotal,
              paymentMethod: (editGuestPaymentMethod === 'Online' ? 'Bank' : resolvedSingleEditMethod) as any,
              paymentType: 'Advance Deposit' as const,
              dateTime: priorAdvanceRec?.dateTime || nowIsoPay,
              notes: priorAdvanceRec?.notes || `Advance paid (${resolvedSingleEditMethod})`,
            },
          ]
        : [];
      nextPayments = [...advanceRecords, ...keptPayments];
    }
    const newPendingAmount = Math.max(0, newTotalAmount - advanceTotal - alreadyPaid);

    const updatedCheckin: GuestCheckIn = {
      ...editingInHouseGuest,
      guestName: editGuestName.trim(),
      mobile: editGuestMobile.trim(),
      emailAddress: editGuestEmail.trim() || undefined,
      address: editGuestAddress.trim(),
      companyName: editGuestCompanyName.trim() || undefined,
      gstNumber: editGuestGstNumber.trim().toUpperCase() || undefined,
      idType: editGuestIdType,
      idNumber: editGuestIdNumber.trim(),
      aadhaarNumber: editGuestIdType === 'Aadhaar' ? editGuestIdNumber.trim() : editingInHouseGuest.aadhaarNumber,
      passportNumber: editGuestIdType === 'Passport' ? editGuestIdNumber.trim() : editingInHouseGuest.passportNumber,
      roomNumber: editGuestRoomNo,
      roomType: (targetRoomObj?.category || editingInHouseGuest.roomType || 'Standard') as any,
      checkInDate: editGuestCheckInDate,
      checkOutDate: editGuestCheckOutDate,
      numGuests: Number(editGuestNumGuests) || 1,
      roomRate: Number(editGuestRoomRate) || 0,
      hasExtraBed: editGuestHasExtraBed,
      extraBedCount: editGuestHasExtraBed ? Math.max(1, Number(editGuestExtraBedCount) || 1) : 0,
      extraBedRate: Math.max(0, Number(editGuestExtraBedRate) || 0),
      discount: discountVal,
      paymentMethod: effectiveMethod,
      payments: nextPayments,
      totalAmount: newTotalAmount,
      finalAmount: newTotalAmount,
      advanceAmount: advanceTotal,
      pendingAmount: newPendingAmount,
      bookedRooms:
        editingInHouseGuest.bookedRooms && editingInHouseGuest.bookedRooms.length > 0
          ? editingInHouseGuest.bookedRooms.map((br, idx) =>
              idx === 0
                ? {
                    ...br,
                    roomNumber: editGuestRoomNo,
                    category: (targetRoomObj?.category || br.category) as any,
                    rate: Number(editGuestRoomRate) || br.rate,
                    guestsCount: Number(editGuestNumGuests) || br.guestsCount,
                    hasExtraBed: editGuestHasExtraBed,
                    extraBedCount: editGuestHasExtraBed ? Math.max(1, Number(editGuestExtraBedCount) || 1) : 0,
                    extraBedRate: Math.max(0, Number(editGuestExtraBedRate) || 0),
                    totalRoomAmount: newTotalAmount
                  }
                : br
            )
          : editingInHouseGuest.bookedRooms
    };

    onUpdateCheckins(checkins.map(c => (c.id === editingInHouseGuest.id ? updatedCheckin : c)));

    // Sync matching Booking record if exists
    let matchedBookingObj: Booking | null = null;
    const updatedBookings = bookings.map(b => {
      if (b.id === editingInHouseGuest.id || (b.roomNumber === prevRoomNo && !b.isCompleted && b.guestName === editingInHouseGuest.guestName)) {
        const syncedB: Booking = {
          ...b,
          guestName: editGuestName.trim(),
          mobile: editGuestMobile.trim(),
          email: editGuestEmail.trim() || b.email,
          address: editGuestAddress.trim() || b.address,
          aadhaarNumber: editGuestIdType === 'Aadhaar' ? editGuestIdNumber.trim() : b.aadhaarNumber,
          roomNumber: editGuestRoomNo,
          roomType: (targetRoomObj?.category || b.roomType) as any,
          checkInDate: editGuestCheckInDate,
          checkOutDate: editGuestCheckOutDate,
          nights: stayNights,
          adults: Number(editGuestNumGuests) || b.adults,
          hasExtraBed: editGuestHasExtraBed,
          extraBedCount: editGuestHasExtraBed ? Math.max(1, Number(editGuestExtraBedCount) || 1) : 0,
          extraBedRate: Math.max(0, Number(editGuestExtraBedRate) || 0),
          paymentMethod: effectiveMethod,
          bookingAmount: newTotalAmount,
          advanceAmount: advanceTotal + alreadyPaid
        };
        matchedBookingObj = syncedB;
        return syncedB;
      }
      return b;
    });
    onUpdateBookings(updatedBookings);

    // Sync any existing invoice linked to this stay
    const hasLinkedInvoice = invoices.some(inv => inv.bookingId === editingInHouseGuest.id);
    if (hasLinkedInvoice) {
      const updatedInvoices = invoices.map(inv => {
        if (inv.bookingId === editingInHouseGuest.id) {
          const food = Number(inv.foodCharges || 0);
          const water = Number(inv.waterCharges || 0);
          const other = Number(inv.otherCharges || 0);
          const sub = roomRentTotal + extraBedTotal + food + water + other;
          const invGstRate = inv.gstRate ?? dynamicGstPercent;
          const invGst = invGstRate > 0 ? parseFloat(((Math.max(0, sub - discountVal) * invGstRate) / 100).toFixed(2)) : 0;
          const invFinal = parseFloat((Math.max(0, sub - discountVal) + invGst).toFixed(2));
          const invAdv = advanceTotal + alreadyPaid;
          const invPending = Math.max(0, parseFloat((invFinal - invAdv).toFixed(2)));
          return {
            ...inv,
            guestName: editGuestName.trim(),
            guestMobile: editGuestMobile.trim(),
            roomNumber: editGuestRoomNo,
            checkInDate: editGuestCheckInDate,
            checkOutDate: editGuestCheckOutDate,
            roomCharges: roomRentTotal,
            extraBedCharges: extraBedTotal,
            extraBedCount: editGuestHasExtraBed ? Math.max(1, Number(editGuestExtraBedCount) || 1) : 0,
            extraBedRate: Math.max(0, Number(editGuestExtraBedRate) || 0),
            discount: discountVal,
            subtotal: sub,
            gst: invGst,
            finalAmount: invFinal,
            advancePaid: invAdv,
            pendingAmount: invPending,
            isPaid: invPending <= 0,
            paymentMethod: effectiveSummaryMethod as any,
            ...(Array.isArray(nextPayments) && nextPayments.length > 1
              ? {
                  paymentHistory: nextPayments
                    .filter(p => p && Number(p.amount) > 0)
                    .map(p => ({
                      id: p.id,
                      amount: Number(p.amount),
                      paymentMethod: String(p.paymentMethod || 'Cash') as any,
                      date: String(p.dateTime || editGuestCheckInDate || '').slice(0, 10),
                      notes: p.notes,
                    })),
                }
              : {}),
          };
        }
        return inv;
      });
      onUpdateInvoices(updatedInvoices);
    }

    // Sync room occupancy if room number changed
    if (editGuestRoomNo !== prevRoomNo) {
      onUpdateRooms(
        rooms.map(r => {
          if (r.number === editGuestRoomNo) return { ...r, status: 'Occupied' as const };
          if (r.number === prevRoomNo) return { ...r, status: 'Available' as const };
          return r;
        })
      );
    }

    onAddAuditLog(
      'In-House / Walk-In Stay Edited',
      `Updated guest stay record #${editingInHouseGuest.id}: ${editGuestName} (Room ${editGuestRoomNo}${editGuestRoomNo !== prevRoomNo ? `, transferred from Room ${prevRoomNo}` : ''}).`
    );
    showToast(`Updated stay details for ${editGuestName} (Room ${editGuestRoomNo}).`, 'success');
    const targetForInvoice: Booking = matchedBookingObj || ({
      id: editingInHouseGuest.id,
      guestName: editGuestName.trim(),
      mobile: editGuestMobile.trim(),
      roomNumber: editGuestRoomNo,
      roomType: (targetRoomObj?.category || editingInHouseGuest.roomType || 'Standard') as any,
      checkInDate: editGuestCheckInDate,
      checkOutDate: editGuestCheckOutDate,
      nights: stayNights,
      bookingAmount: newTotalAmount,
      advanceAmount: advanceTotal + alreadyPaid,
      hasExtraBed: editGuestHasExtraBed,
      extraBedCount: editGuestHasExtraBed ? Math.max(1, Number(editGuestExtraBedCount) || 1) : 0,
      extraBedRate: Math.max(0, Number(editGuestExtraBedRate) || 0),
      paymentMethod: effectiveMethod,
      status: 'Confirmed',
      isCheckedIn: true
    } as unknown as Booking);
    setEditingInHouseGuest(null);
    if (openInvoiceAfterSave) {
      setSelectedBookingForInvoice(targetForInvoice);
      onSelectSubTab('billing');
    }
  };

  const handleSaveEditInHouseGuest = (e: React.FormEvent) => {
    e.preventDefault();
    applyEditInHouseGuestChanges(false);
  };
  
  // Find water bottle product in inventory for current hotel (declared before state hooks that read it)
  const waterBottleInventoryProduct = inventoryProducts.find(
    p =>
      p.name.toLowerCase().includes('water bottle') ||
      p.name.toLowerCase().includes('drinking water') ||
      p.name.toLowerCase().includes('mineral water') ||
      p.name.toLowerCase() === 'water' ||
      ((p as any).sku && String((p as any).sku).toUpperCase().includes('WATER'))
  );

  // Water Bottle & Service Requests State (user-configured rate ONLY — no hardcoded ₹20 default)
  const defaultWaterBottleRate = Math.max(
    0,
    Number(waterBottleInventoryProduct?.sellingPrice || hotelSettings?.waterBottleRate || 0)
  );
  const [showWaterBottleModal, setShowWaterBottleModal] = useState(false);
  const [waterModalTab, setWaterModalTab] = useState<'allocate' | 'stock'>('allocate');
  const [addWaterStockQty, setAddWaterStockQty] = useState<number>(24);
  const [addWaterSellingRate, setAddWaterSellingRate] = useState<number | ''>('');
  const [addWaterCostRate, setAddWaterCostRate] = useState<number | ''>('');
  const [editingWaterBottleRecord, setEditingWaterBottleRecord] = useState<WaterBottleRecord | null>(null);
  const [waterRoomNo, setWaterRoomNo] = useState('');
  const [waterQuantity, setWaterQuantity] = useState(1);
  const [waterIsChargeable, setWaterIsChargeable] = useState(false);
  const [waterUnitPrice, setWaterUnitPrice] = useState<number>(() =>
    Math.max(0, Number(waterBottleInventoryProduct?.sellingPrice || hotelSettings?.waterBottleRate || 0))
  );

  React.useEffect(() => {
    if (!showWaterBottleModal && !editingWaterBottleRecord) {
      setWaterUnitPrice(
        Math.max(0, Number(waterBottleInventoryProduct?.sellingPrice || hotelSettings?.waterBottleRate || 0))
      );
    }
  }, [waterBottleInventoryProduct?.sellingPrice, hotelSettings?.waterBottleRate, showWaterBottleModal, editingWaterBottleRecord]);

  React.useEffect(() => {
    if (currentSubTab === 'services') {
      try {
        if (sessionStorage.getItem('pms_open_water_modal') === '1') {
          sessionStorage.removeItem('pms_open_water_modal');
          setEditingWaterBottleRecord(null);
          setWaterModalTab('allocate');
          setWaterRoomNo('');
          setWaterQuantity(1);
          setWaterIsChargeable(false);
          setWaterUnitPrice(
            Math.max(0, Number(waterBottleInventoryProduct?.sellingPrice || hotelSettings?.waterBottleRate || 0))
          );
          setShowWaterBottleModal(true);
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [currentSubTab, waterBottleInventoryProduct?.sellingPrice, hotelSettings?.waterBottleRate]);

  const handleAddWaterStockDirect = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyToAdd = Math.max(0, Math.floor(Number(addWaterStockQty) || 0));
    if (qtyToAdd <= 0) {
      showToast('Please enter valid Water Bottle stock quantity to add (>= 1).', 'warning');
      return;
    }
    const sellRate = addWaterSellingRate !== '' ? Math.max(0, Number(addWaterSellingRate) || 0) : Number(waterBottleInventoryProduct?.sellingPrice || 0);
    const costRate = addWaterCostRate !== '' ? Math.max(0, Number(addWaterCostRate) || 0) : Number(waterBottleInventoryProduct?.costPrice || 0);
    const currentHotelId =
      selectedHotelId ||
      (typeof window !== 'undefined' && sessionStorage.getItem('pms_hotel_id')) ||
      hotelSettings?.id ||
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
      status: nextStock <= 0 ? 'Out of Stock' : nextStock <= 5 ? 'Low Stock' : 'In Stock',
      lastRestockedDate: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString(),
    };

    if (onUpdateInventoryProducts) {
      const exists = inventoryProducts.some(p => p.id === updatedWaterProd.id);
      const nextList = exists
        ? inventoryProducts.map(p => (p.id === updatedWaterProd.id ? updatedWaterProd : p))
        : [updatedWaterProd, ...inventoryProducts];
      onUpdateInventoryProducts(nextList);
    }

    if (onUpdateInventoryMovements) {
      const mov: InventoryStockMovement = {
        id: `MOV-WB-IN-${Date.now()}`,
        hotelId: currentHotelId,
        productId: updatedWaterProd.id,
        productName: updatedWaterProd.name,
        type: 'IN',
        quantity: qtyToAdd,
        previousStock: prevStock,
        newStock: nextStock,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        referenceType: 'Purchase' as any,
        notes: `Added ${qtyToAdd} Water Bottles to Inventory${sellRate > 0 ? ` (Selling Rate: ₹${sellRate}/bottle)` : ''}`,
        performedBy: loggedInUser || currentRole || 'Front Desk',
      };
      onUpdateInventoryMovements([mov, ...inventoryStockMovements]);
    }

    if (sellRate > 0) {
      setWaterUnitPrice(sellRate);
      if (Number(hotelSettings?.waterBottleRate || 0) !== sellRate) {
        onUpdateHotelSettings({ ...hotelSettings, waterBottleRate: sellRate });
      }
    }

    onAddAuditLog(
      'Water Bottle Stock Added',
      `Added ${qtyToAdd} bottles to Packaged Drinking Water (1L) inventory (Stock: ${prevStock} → ${nextStock}${sellRate > 0 ? `, Rate: ₹${sellRate}/bottle` : ''}).`
    );
    showToast(`Added ${qtyToAdd} Water Bottles to Inventory! Total Available: ${nextStock} Bottles.`, 'success');
    setWaterModalTab('allocate');
  };

  const handleStartEditWaterBottle = (wb: WaterBottleRecord) => {
    setEditingWaterBottleRecord(wb);
    setWaterRoomNo(wb.roomNumber || '');
    setWaterQuantity(wb.quantity || 1);
    setWaterIsChargeable(Boolean(wb.isChargeable));
    setWaterUnitPrice(
      wb.unitPrice !== undefined && wb.unitPrice > 0
        ? wb.unitPrice
        : wb.chargeAmount && wb.quantity
        ? r2(wb.chargeAmount / wb.quantity)
        : defaultWaterBottleRate
    );
    setShowWaterBottleModal(true);
  };

  const handleDeleteWaterBottle = async (recordId: string) => {
    const ok = await showConfirmToast({
      title: 'Delete Water Bottle Entry',
      message: 'Are you sure you want to delete this water bottle log entry?',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'Cancel',
      severity: 'warning',
    });
    if (!ok) return;
    if (onUpdateWaterBottles) {
      onUpdateWaterBottles(waterBottles.filter(w => w.id !== recordId));
      // Also remove corresponding EC-WB-<id> & ALLOC-WB-<id> from guest check-in folios
      const ecId = `EC-WB-${recordId}`;
      const allocId = `ALLOC-WB-${recordId}`;
      const cleanedCheckins = checkins.map(c => {
        const prevExtras = c.extraCharges || [];
        const removedExtra = prevExtras.find(
          ec => ec.id === ecId || (ec.sourceType === 'water_bottle' && ec.sourceId === recordId)
        );
        const nextExtras = prevExtras.filter(
          ec => ec.id !== ecId && !(ec.sourceType === 'water_bottle' && ec.sourceId === recordId)
        );
        const nextAlloc = (c.allocatedServices || []).filter(s => s.id !== allocId);
        if (nextExtras.length === prevExtras.length && nextAlloc.length === (c.allocatedServices || []).length) {
          return c;
        }
        return {
          ...c,
          extraCharges: nextExtras,
          allocatedServices: nextAlloc,
          pendingAmount: removedExtra
            ? Math.max(0, r2(Number(c.pendingAmount || 0) - Number(removedExtra.amount || 0)))
            : c.pendingAmount,
        };
      });
      onUpdateCheckins(cleanedCheckins);
      onAddAuditLog('Water Bottle Log Deleted', `Deleted water bottle record ${recordId}`);
      showToast('Water bottle log entry deleted.', 'info');
    }
  };

  const handleDeleteAllocatedService = async (recordId: string) => {
    const ok = await showConfirmToast({
      title: 'Remove Allocated Service',
      message: 'Are you sure you want to remove this allocated room service?',
      confirmLabel: 'Yes, Remove',
      cancelLabel: 'Cancel',
      severity: 'warning',
    });
    if (!ok) return;
    if (onUpdateWaterBottles) {
      onUpdateWaterBottles(waterBottles.filter(w => w.id !== recordId));
      onAddAuditLog('Room Service Removed', `Removed allocated room service ${recordId}`);
      showToast('Allocated room service removed.', 'info');
    }
  };

  // Add Service & Allocate Service State
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceAmount, setNewServiceAmount] = useState('');
  const [isSavingService, setIsSavingService] = useState(false);
  const [createServiceReqId, setCreateServiceReqId] = useState('');
  const savingServiceLockRef = useRef(false);

  const [showAllocateServiceModal, setShowAllocateServiceModal] = useState(false);
  const [selectedServiceRoomNo, setSelectedServiceRoomNo] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [chargeServiceToGuest, setChargeServiceToGuest] = useState(false);
  const [isAllocatingService, setIsAllocatingService] = useState(false);
  const [allocateServiceReqId, setAllocateServiceReqId] = useState('');
  const allocatingServiceLockRef = useRef(false);

  // Active checkins (not yet checked out)
  const activeCheckins = checkins.filter(c => !c.checkedOutDateTime);

  // Segregated records from waterBottles array
  const waterOnlyRecords = waterBottles.filter(w => !w.recordType || w.recordType === 'water');
  const savedServices = waterBottles.filter(w => w.recordType === 'service_catalog');
  const serviceAllocationRecords = waterBottles.filter(w => w.recordType === 'service_allocation');

  // Helper to find active guest stay for a given room number
  const getActiveStayForRoom = (roomNo: string): GuestCheckIn | undefined => {
    if (!roomNo) return undefined;
    return activeCheckins.find(
      c =>
        String(c.roomNumber).trim() === String(roomNo).trim() ||
        (c.bookedRooms || []).some(br => String(br.roomNumber).trim() === String(roomNo).trim())
    );
  };

  // Occupied rooms with an active guest stay in the current hotel
  const occupiedRoomsWithStay = rooms.filter(r => Boolean(getActiveStayForRoom(r.number)));
  const selectedRoomActiveStay = getActiveStayForRoom(selectedServiceRoomNo);
  const selectedServiceConfig = savedServices.find(
    s => String(s.id) === String(selectedServiceId) || String(s.serviceId) === String(selectedServiceId)
  );
  const selectedServiceAmountVal = selectedServiceConfig
    ? Number(selectedServiceConfig.configuredAmount ?? selectedServiceConfig.chargeAmount ?? 0)
    : 0;

  // Nav Menu items mapping: Old Front Desk items + Pre-Arrival Desk
  const preArrivalBookingsList = bookings.filter(
    b =>
      !b.isCheckedIn &&
      !b.isCompleted &&
      b.status !== 'Cancelled' &&
      String(b.status || '').toLowerCase() !== 'checkedout' &&
      String(b.status || '').toLowerCase() !== 'checked out'
  );

  // Helper Check-in handler from Reservations / Dashboard
  const handleTriggerCheckIn = (booking: Booking) => {
    setSelectedBookingForCheckin(booking);
    onSelectSubTab('checkin');
    try {
      if (window.location.pathname !== '/admin/frontDesk/checkin') {
        window.history.pushState({}, '', '/admin/frontDesk/checkin');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  // Helper Check-Out trigger
  const handleTriggerCheckOut = (booking: Booking) => {
    const isAlreadyCheckedOut =
      Boolean(booking.isCompleted) ||
      String(booking.status || '').toLowerCase() === 'checkedout' ||
      String(booking.status || '').toLowerCase() === 'checked out';
    const matchedGuest =
      !isAlreadyCheckedOut &&
      (checkins.find(c => !c.checkedOutDateTime && c.id === booking.id) ||
        checkins.find(c => !c.checkedOutDateTime && c.roomNumber === booking.roomNumber));
    if (matchedGuest) {
      handleOpenCheckoutConfirmModal(matchedGuest);
    } else {
      setSelectedBookingForInvoice(booking);
      onSelectSubTab('billing');
    }
  };

  // Water bottle log save with inventory validation, stock deduction, OUT movement, and Guest Folio / Slip billing
  const handleSaveWaterBottle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waterRoomNo) {
      showToast('Please select an occupied room.', 'warning');
      return;
    }
    const qty = Math.max(0, Math.floor(Number(waterQuantity) || 0));
    if (qty <= 0) {
      showToast('Please enter a valid water bottle quantity (>= 1).', 'warning');
      return;
    }

    const activeStay = getActiveStayForRoom(waterRoomNo);
    if (!activeStay) {
      showToast(`Room ${waterRoomNo} does not have an active checked-in guest stay.`, 'error');
      return;
    }

    // Strict Inventory Stock Validation before room allocation
    const prevEditQty = editingWaterBottleRecord ? Number(editingWaterBottleRecord.quantity || 0) : 0;
    const availStock = Number(waterBottleInventoryProduct?.currentStock ?? 0) + prevEditQty;
    if (availStock <= 0) {
      showToast(
        'Insufficient Water Bottle stock in Inventory (0 available). If bottles are physically available, please add a stock record in Inventory first.',
        'error'
      );
      return;
    }
    if (availStock < qty) {
      showToast(
        `Insufficient Water Bottle stock in Inventory! Only ${availStock} bottle(s) available while requesting ${qty}. Please add stock in Inventory first.`,
        'error'
      );
      return;
    }

    if (waterIsChargeable && !(Number(waterUnitPrice) > 0)) {
      showToast('Please enter your Rate / Bottle (₹) before saving a chargeable entry.', 'warning');
      return;
    }

    const currentHotelId =
      selectedHotelId ||
      (typeof window !== 'undefined' && sessionStorage.getItem('pms_hotel_id')) ||
      activeStay.hotelId ||
      hotelSettings?.id ||
      'hotel-1';

    if (editingWaterBottleRecord) {
      const editId = editingWaterBottleRecord.id;
      const parsedUnit = Number(waterUnitPrice);
      const unitPrice = waterIsChargeable
        ? Math.max(0, Number.isFinite(parsedUnit) ? parsedUnit : defaultWaterBottleRate)
        : 0;
      const totalAmount = waterIsChargeable ? r2(qty * unitPrice) : 0;
      const editFolioChargeId = `EC-WB-${editId}`;
      const editAllocId = `ALLOC-WB-${editId}`;
      const nowIsoEdit = new Date().toISOString();
      const todayEdit = editingWaterBottleRecord.date || nowIsoEdit.split('T')[0];
      const nowTimeEdit = editingWaterBottleRecord.dateTime || nowIsoEdit.replace('T', ' ').substring(0, 16);
      const actorEdit = loggedInUser || currentRole || 'Front Desk Staff';

      const updatedList = waterBottles.map(w => {
        if (w.id === editId) {
          return {
            ...w,
            roomNumber: waterRoomNo,
            guestName: activeStay.guestName,
            checkInId: activeStay.id,
            checkinId: activeStay.id,
            quantity: qty,
            type: (waterIsChargeable ? 'Chargeable' : 'Complimentary') as any,
            isChargeable: waterIsChargeable,
            unitPrice,
            totalAmount,
            chargeAmount: totalAmount,
            folioChargeId: waterIsChargeable && totalAmount > 0 ? editFolioChargeId : undefined,
          };
        }
        return w;
      });
      if (onUpdateWaterBottles) onUpdateWaterBottles(updatedList);

      // Sync edited water bottle record to checkins (EC-WB-<id> & ALLOC-WB-<id> -> fixes C6)
      const updatedAllocEntry: AllocatedGuestService = {
        id: editAllocId,
        hotelId: currentHotelId,
        serviceId: 'WATER-BOTTLE',
        serviceName: waterIsChargeable
          ? `Water Bottles (${qty} x ₹${unitPrice})`
          : `Water Bottles (${qty} - Complimentary)`,
        configuredAmount: totalAmount,
        chargedAmount: totalAmount,
        isChargeable: Boolean(waterIsChargeable && totalAmount > 0),
        roomNumber: waterRoomNo,
        checkInId: activeStay.id,
        guestName: activeStay.guestName,
        allocatedBy: actorEdit,
        dateTime: nowTimeEdit,
      };

      const syncedCheckins = checkins.map(c => {
        const prevExtras = c.extraCharges || [];
        const prevAllocated = c.allocatedServices || [];
        const existingEc = prevExtras.find(
          ec => ec.id === editFolioChargeId || (ec.sourceType === 'water_bottle' && ec.sourceId === editId)
        );
        const filteredExtras = prevExtras.filter(
          ec => ec.id !== editFolioChargeId && !(ec.sourceType === 'water_bottle' && ec.sourceId === editId)
        );
        const filteredAllocated = prevAllocated.filter(s => s.id !== editAllocId);

        if (c.id !== activeStay.id) {
          // If room/stay changed, clean up old stay's folio
          if (filteredExtras.length === prevExtras.length && filteredAllocated.length === prevAllocated.length) {
            return c;
          }
          return {
            ...c,
            extraCharges: filteredExtras,
            allocatedServices: filteredAllocated,
            pendingAmount: existingEc
              ? Math.max(0, r2(Number(c.pendingAmount || 0) - Number(existingEc.amount || 0)))
              : c.pendingAmount,
          };
        }

        const nextAllocated = [...filteredAllocated, updatedAllocEntry];
        const prevAmt = Number(existingEc?.amount || 0);

        if (waterIsChargeable && totalAmount > 0) {
          const updatedExtra: ExtraCharge = {
            id: editFolioChargeId,
            category: 'Water Bottle' as any,
            description: `Chargeable Water Bottles (${qty} x ₹${unitPrice})`,
            amount: totalAmount,
            dateTime: nowTimeEdit,
            sourceType: 'water_bottle',
            sourceId: editId,
          };
          return {
            ...c,
            allocatedServices: nextAllocated,
            extraCharges: [...filteredExtras, updatedExtra],
            pendingAmount: Math.max(0, r2(Number(c.pendingAmount || 0) - prevAmt + totalAmount)),
          };
        }

        return {
          ...c,
          allocatedServices: nextAllocated,
          extraCharges: filteredExtras,
          pendingAmount: Math.max(0, r2(Number(c.pendingAmount || 0) - prevAmt)),
        };
      });
      onUpdateCheckins(syncedCheckins);

      onAddAuditLog('Water Bottle Log Updated', `Updated water bottle record ${editId} for Room ${waterRoomNo}`);
      showToast('Water bottle log entry & guest folio updated successfully.', 'success');
      setEditingWaterBottleRecord(null);
      setShowWaterBottleModal(false);
      setWaterRoomNo('');
      setWaterQuantity(2);
      setWaterIsChargeable(false);
      setWaterUnitPrice(defaultWaterBottleRate);
      return;
    }

    const recordId = `WB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const parsedNewUnit = Number(waterUnitPrice);
    const unitPrice = waterIsChargeable
      ? Math.max(0, Number.isFinite(parsedNewUnit) ? parsedNewUnit : defaultWaterBottleRate)
      : 0;
    const totalAmount = waterIsChargeable ? r2(qty * unitPrice) : 0;
    const folioChargeId = waterIsChargeable && totalAmount > 0 ? `EC-WB-${recordId}` : undefined;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const nowTimeStr = nowIso.replace('T', ' ').substring(0, 16);
    const actorLabel = loggedInUser || currentRole || 'Front Desk Staff';

    // 1. Deduct inventory stock & record OUT movement if tracked product exists
    if (waterBottleInventoryProduct && onUpdateInventoryProducts) {
      const prevStock = Number(waterBottleInventoryProduct.currentStock) || 0;
      const newStock = Math.max(0, prevStock - qty);
      const minAlert = Number((waterBottleInventoryProduct as any).minStockAlert ?? (waterBottleInventoryProduct as any).reorderLevel) || 0;
      const newStatus: InventoryProduct['status'] =
        newStock <= 0 ? 'Out of Stock' : newStock <= minAlert ? 'Low Stock' : 'In Stock';

      onUpdateInventoryProducts(
        inventoryProducts.map(p =>
          p.id === waterBottleInventoryProduct.id
            ? { ...p, currentStock: newStock, status: newStatus, lastUpdated: nowIso }
            : p
        )
      );

      if (newStock === 0) {
        showToast('Water Bottle allocated! Alert: Water Bottle stock in Inventory is now 0 — please restock in Inventory Store.', 'warning');
      } else if (newStock <= 5) {
        showToast(`Low Stock Alert: Only ${newStock} water bottle(s) remaining in Inventory.`, 'warning');
      }

      if (onUpdateInventoryMovements) {
        const movement = {
          id: `MOV-WB-${recordId}`,
          productId: waterBottleInventoryProduct.id,
          productName: waterBottleInventoryProduct.name,
          type: 'OUT' as const,
          quantity: qty,
          previousStock: prevStock,
          newStock,
          date: todayStr,
          time: new Date().toLocaleTimeString(),
          referenceType: 'Housekeeping' as any,
          referenceId: recordId,
          notes: `Water Bottle allocation (${waterIsChargeable ? `Chargeable ₹${totalAmount}` : 'Complimentary ₹0'}) to Room ${waterRoomNo} (${activeStay.guestName})`,
          performedBy: actorLabel,
          hotelId: currentHotelId
        } as unknown as InventoryStockMovement;
        onUpdateInventoryMovements([movement, ...inventoryStockMovements]);
      }
    }

    // 2. Create WaterBottleRecord
    const newRecord = {
      id: recordId,
      hotelId: currentHotelId,
      roomNumber: waterRoomNo,
      guestName: activeStay.guestName,
      checkInId: activeStay.id,
      checkinId: activeStay.id,
      quantity: qty,
      date: todayStr,
      type: waterIsChargeable ? 'Chargeable' : 'Complimentary',
      isChargeable: waterIsChargeable,
      unitPrice,
      totalAmount,
      chargeAmount: totalAmount,
      folioChargeId,
      deliveredBy: actorLabel,
      dateTime: nowTimeStr,
      recordType: 'water'
    } as unknown as WaterBottleRecord;

    if (onUpdateWaterBottles) {
      onUpdateWaterBottles([newRecord, ...waterBottles]);
    }

    // 3. Sync to active Guest Stay (Chargeable -> ExtraCharge EC-WB-* + AllocatedService; Complimentary -> ₹0 AllocatedService ONLY)
    const allocEntry: AllocatedGuestService = {
      id: `ALLOC-WB-${recordId}`,
      hotelId: currentHotelId,
      serviceId: 'WATER-BOTTLE',
      serviceName: waterIsChargeable
        ? `Water Bottles (${qty} x ₹${unitPrice})`
        : `Water Bottles (${qty} - Complimentary)`,
      configuredAmount: totalAmount,
      chargedAmount: totalAmount,
      isChargeable: Boolean(waterIsChargeable && totalAmount > 0),
      roomNumber: waterRoomNo,
      checkInId: activeStay.id,
      guestName: activeStay.guestName,
      allocatedBy: actorLabel,
      dateTime: nowTimeStr
    };

    const updatedCheckins = checkins.map(c => {
      if (c.id !== activeStay.id) return c;
      const prevAllocated = c.allocatedServices || [];
      const nextAllocated = prevAllocated.some(s => s.id === allocEntry.id)
        ? prevAllocated
        : [...prevAllocated, allocEntry];

      if (waterIsChargeable && totalAmount > 0 && folioChargeId) {
        const extraCharge: ExtraCharge = {
          id: folioChargeId,
          category: 'Water Bottle' as any,
          description: `Chargeable Water Bottles (${qty} x ₹${unitPrice})`,
          amount: totalAmount,
          dateTime: nowTimeStr,
          sourceType: 'water_bottle',
          sourceId: recordId
        };
        const prevExtras = c.extraCharges || [];
        const alreadyExists = prevExtras.some(
          ec => ec.id === folioChargeId || (ec.sourceType === 'water_bottle' && ec.sourceId === recordId)
        );
        const nextExtras = alreadyExists ? prevExtras : [...prevExtras, extraCharge];
        const nextPending = alreadyExists
          ? c.pendingAmount
          : parseFloat((Number(c.pendingAmount || 0) + totalAmount).toFixed(2));
        return {
          ...c,
          allocatedServices: nextAllocated,
          extraCharges: nextExtras,
          pendingAmount: nextPending
        };
      }

      // Complimentary: ₹0, never added to extraCharges or pendingAmount
      return {
        ...c,
        allocatedServices: nextAllocated
      };
    });

    onUpdateCheckins(updatedCheckins);

    onAddAuditLog(
      'Water Bottle Allocation',
      `Allocated ${qty} water bottle(s) to Room ${waterRoomNo} (${activeStay.guestName}) as ${
        waterIsChargeable ? `Chargeable (₹${totalAmount} added to folio)` : 'Complimentary (₹0)'
      }`
    );

    showToast(
      waterIsChargeable
        ? `Allocated ${qty} water bottle(s) to Room ${waterRoomNo}. ₹${totalAmount} added to ${activeStay.guestName}'s folio.`
        : `Allocated ${qty} complimentary water bottle(s) to Room ${waterRoomNo} (₹0 charged).`,
      'success'
    );

    setShowWaterBottleModal(false);
    setWaterRoomNo('');
    setWaterQuantity(2);
    setWaterIsChargeable(false);
  };

  const getActiveSessionToken = (): string => {
    if (typeof window === 'undefined') return '';
    return (
      sessionStorage.getItem('pms_session_token') ||
      sessionStorage.getItem('pms_auth_token') ||
      ''
    );
  };

  const buildAuthHeaders = (): Record<string, string> => {
    const token = getActiveSessionToken();
    const hotelId =
      selectedHotelId ||
      hotelSettings?.id ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('pms_hotel_id') : '') ||
      'hotel-1';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-role': currentRole || 'Admin',
      'x-hotel-id': hotelId,
      'x-user-name': loggedInUser || currentRole || 'Front Desk Staff'
    };
    if (token) {
      headers['x-session-token'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // 1. Add Service (Service Name + Amount ₹)
  const handleOpenAddServiceModal = () => {
    if (currentRole === 'Housekeeping') {
      showToast('Only authorized Front Desk / Admin staff can add services.', 'error');
      return;
    }
    setNewServiceName('');
    setNewServiceAmount('');
    setCreateServiceReqId(`REQ-SRV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    setIsSavingService(false);
    savingServiceLockRef.current = false;
    setShowAddServiceModal(true);
  };

  const handleSaveNewService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingServiceLockRef.current || isSavingService) return;

    if (currentRole === 'Housekeeping') {
      showToast('Forbidden: Only authorized hotel staff can create services.', 'error');
      return;
    }

    const trimmedName = newServiceName.trim();
    if (!trimmedName) {
      showToast('Please enter a Service Name.', 'warning');
      return;
    }

    const parsedAmount = Number(newServiceAmount);
    if (newServiceAmount.trim() === '' || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      showToast('Please enter a valid non-negative Service Amount (₹).', 'warning');
      return;
    }

    savingServiceLockRef.current = true;
    setIsSavingService(true);

    const requestId = createServiceReqId || `REQ-SRV-${Date.now()}`;
    const currentHotelId =
      selectedHotelId ||
      hotelSettings?.id ||
      (typeof window !== 'undefined' && sessionStorage.getItem('pms_hotel_id')) ||
      'hotel-1';
    const roundedAmount = parseFloat(parsedAmount.toFixed(2));
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const nowDisplay = nowIso.replace('T', ' ').substring(0, 16);
    const serviceId = `SRV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fallbackCatalogRecord: WaterBottleRecord = {
      id: serviceId,
      serviceId,
      requestId,
      hotelId: currentHotelId,
      recordType: 'service_catalog',
      serviceName: trimmedName,
      configuredAmount: roundedAmount,
      chargeAmount: roundedAmount,
      isChargeable: true,
      roomNumber: 'CATALOG',
      quantity: 0,
      date: todayStr,
      dateTime: nowDisplay,
      deliveredBy: loggedInUser || currentRole || 'Front Desk Staff'
    };

    try {
      let catalogRecord: WaterBottleRecord = fallbackCatalogRecord;
      try {
        const resp = await fetch('/api/guest-services', {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            serviceName: trimmedName,
            amount: roundedAmount,
            hotelId: currentHotelId,
            requestId,
            token: getActiveSessionToken(),
            role: currentRole || 'Admin',
            username: loggedInUser || currentRole || 'Front Desk Staff'
          })
        });

        const data = await resp.json().catch(() => null);
        if (resp.ok && data?.success && data?.catalogRecord) {
          catalogRecord = { ...data.catalogRecord, hotelId: currentHotelId };
        } else if (resp.status === 400 || resp.status === 403 || resp.status === 409) {
          showToast(data?.error || 'Failed to save service.', 'error');
          savingServiceLockRef.current = false;
          setIsSavingService(false);
          return;
        }
      } catch {
        // Fallback to local state persistence (synced automatically via PMS state sync)
      }

      if (onUpdateWaterBottles && catalogRecord) {
        const exists = waterBottles.some(w => w.id === catalogRecord.id || (w.requestId && w.requestId === requestId));
        if (!exists) {
          onUpdateWaterBottles([catalogRecord, ...waterBottles]);
        }
      }

      onAddAuditLog(
        'Service Added',
        `Added guest service "${catalogRecord.serviceName}" with configured amount ₹${catalogRecord.configuredAmount}`
      );
      showToast(`Service "${catalogRecord.serviceName}" (₹${catalogRecord.configuredAmount}) saved!`, 'success');
      setShowAddServiceModal(false);
      setNewServiceName('');
      setNewServiceAmount('');
    } finally {
      savingServiceLockRef.current = false;
      setIsSavingService(false);
    }
  };

  // 2. Allocate Service to an Occupied Room
  const handleOpenAllocateServiceModal = () => {
    if (currentRole === 'Housekeeping') {
      showToast('Only authorized Front Desk / Admin staff can allocate services.', 'error');
      return;
    }
    const defaultRoom = occupiedRoomsWithStay[0]?.number || '';
    const defaultSrv = savedServices[0]?.id || '';
    setSelectedServiceRoomNo(defaultRoom);
    setSelectedServiceId(defaultSrv);
    setChargeServiceToGuest(false);
    setAllocateServiceReqId(`REQ-ALLOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    setIsAllocatingService(false);
    allocatingServiceLockRef.current = false;
    setShowAllocateServiceModal(true);
  };

  const handleAllocateServiceToRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent duplicate charges if Save button is clicked multiple times
    if (allocatingServiceLockRef.current || isAllocatingService) return;

    if (currentRole === 'Housekeeping') {
      showToast('Forbidden: Only authorized hotel staff can allocate services.', 'error');
      return;
    }

    if (!selectedServiceRoomNo) {
      showToast('Please select an occupied room.', 'warning');
      return;
    }

    const activeStay = getActiveStayForRoom(selectedServiceRoomNo);
    if (!activeStay) {
      showToast(`Room ${selectedServiceRoomNo} does not have an active guest stay.`, 'error');
      return;
    }

    if (!selectedServiceId || !selectedServiceConfig) {
      showToast('Please select a saved service to allocate.', 'warning');
      return;
    }

    allocatingServiceLockRef.current = true;
    setIsAllocatingService(true);

    const requestId = allocateServiceReqId || `REQ-ALLOC-${Date.now()}`;
    const currentHotelId =
      selectedHotelId ||
      activeStay.hotelId ||
      hotelSettings?.id ||
      (typeof window !== 'undefined' && sessionStorage.getItem('pms_hotel_id')) ||
      'hotel-1';

    const authoritativeAmount = parseFloat(
      Number(selectedServiceConfig.configuredAmount ?? selectedServiceConfig.chargeAmount ?? 0).toFixed(2)
    );
    const authoritativeServiceName = String(selectedServiceConfig.serviceName || 'Room Service').trim();
    const shouldChargeGuest = Boolean(chargeServiceToGuest);
    const chargedAmount = shouldChargeGuest ? authoritativeAmount : 0;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const nowDisplay = nowIso.replace('T', ' ').substring(0, 16);
    const fallbackAllocId = `SALLOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let allocation: AllocatedGuestService = {
      id: fallbackAllocId,
      requestId,
      hotelId: currentHotelId,
      serviceId: String(selectedServiceConfig.id),
      serviceName: authoritativeServiceName,
      configuredAmount: authoritativeAmount,
      chargedAmount,
      isChargeable: shouldChargeGuest,
      roomNumber: selectedServiceRoomNo,
      checkInId: String(activeStay.id),
      guestName: String(activeStay.guestName),
      allocatedBy: loggedInUser || currentRole || 'Front Desk Staff',
      dateTime: nowDisplay
    };

    let logRecord: WaterBottleRecord = {
      id: fallbackAllocId,
      requestId,
      hotelId: currentHotelId,
      recordType: 'service_allocation',
      serviceId: String(selectedServiceConfig.id),
      serviceName: authoritativeServiceName,
      configuredAmount: authoritativeAmount,
      chargeAmount: chargedAmount,
      isChargeable: shouldChargeGuest,
      roomNumber: selectedServiceRoomNo,
      checkInId: String(activeStay.id),
      guestName: String(activeStay.guestName),
      quantity: 0,
      date: todayStr,
      dateTime: nowDisplay,
      deliveredBy: loggedInUser || currentRole || 'Front Desk Staff'
    };

    let extraCharge: ExtraCharge | null = shouldChargeGuest
      ? {
          id: fallbackAllocId,
          category: 'Other',
          description: `${authoritativeServiceName} (Room ${selectedServiceRoomNo})`,
          amount: authoritativeAmount,
          dateTime: nowIso
        }
      : null;

    try {
      try {
        const resp = await fetch('/api/guest-services/allocate', {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            roomNumber: selectedServiceRoomNo,
            serviceId: selectedServiceConfig.id,
            isChargeable: chargeServiceToGuest,
            hotelId: currentHotelId,
            requestId,
            token: getActiveSessionToken(),
            role: currentRole || 'Admin',
            username: loggedInUser || currentRole || 'Front Desk Staff'
          })
        });

        const data = await resp.json().catch(() => null);
        if (resp.ok && data?.success) {
          if (data.allocation) allocation = { ...data.allocation, hotelId: currentHotelId };
          if (data.logRecord) logRecord = { ...data.logRecord, hotelId: currentHotelId };
          if (data.extraCharge !== undefined) extraCharge = data.extraCharge;
        } else if (resp.status === 400 || resp.status === 403 || resp.status === 404 || resp.status === 409) {
          showToast(data?.error || 'Failed to allocate service to room.', 'error');
          if (!data?.duplicate) {
            allocatingServiceLockRef.current = false;
            setIsAllocatingService(false);
          }
          return;
        }
      } catch {
        // Fallback to local state persistence (synced automatically via PMS state sync)
      }

      // Update checkins state with the authoritative allocation & folio charge (added at most once)
      const updatedCheckins = checkins.map(c => {
        if (c.id === activeStay.id) {
          const prevAllocated = c.allocatedServices || [];
          const alreadyAllocated = prevAllocated.some(
            s => s.id === allocation.id || (s.requestId && s.requestId === requestId)
          );
          const nextAllocated = alreadyAllocated ? prevAllocated : [...prevAllocated, allocation];

          const prevExtras = c.extraCharges || [];
          const nextExtras =
            allocation.isChargeable && extraCharge && !prevExtras.some(ec => ec.id === extraCharge.id)
              ? [...prevExtras, extraCharge]
              : prevExtras;

          const nextPending =
            allocation.isChargeable && !alreadyAllocated
              ? parseFloat((Number(c.pendingAmount || 0) + Number(allocation.chargedAmount || 0)).toFixed(2))
              : c.pendingAmount;

          return {
            ...c,
            allocatedServices: nextAllocated,
            extraCharges: nextExtras,
            pendingAmount: nextPending
          };
        }
        return c;
      });

      onUpdateCheckins(updatedCheckins);

      if (onUpdateWaterBottles && logRecord) {
        const exists = waterBottles.some(w => w.id === logRecord.id || (w.requestId && w.requestId === requestId));
        if (!exists) {
          onUpdateWaterBottles([logRecord, ...waterBottles]);
        }
      }

      onAddAuditLog(
        'Room Service Allocated',
        `Allocated "${allocation.serviceName}" to Room ${allocation.roomNumber} (${allocation.guestName}) as ${
          allocation.isChargeable ? `Chargeable (₹${allocation.chargedAmount})` : 'Complimentary (₹0 charged)'
        }`
      );

      showToast(
        allocation.isChargeable
          ? `Allocated "${allocation.serviceName}" to Room ${allocation.roomNumber}. ₹${allocation.chargedAmount} added to ${allocation.guestName}'s folio.`
          : `Allocated "${allocation.serviceName}" to Room ${allocation.roomNumber} as Complimentary (₹0 charged).`,
        'success'
      );

      setShowAllocateServiceModal(false);
    } finally {
      allocatingServiceLockRef.current = false;
      setIsAllocatingService(false);
    }
  };

  // Filtered in-house stays
  const activeInHouseGuests = activeCheckins.filter(c => {
    const q = inHouseSearch.toLowerCase();
    const gName = c.guestName || '';
    const rNo = c.roomNumber || '';
    const mob = c.mobile || '';
    const idStr = c.id || '';
    return gName.toLowerCase().includes(q) ||
           rNo.toLowerCase().includes(q) ||
           mob.includes(q) ||
           idStr.toLowerCase().includes(q);
  });

  // Filtered documents archive
  const documentRecords = [
    ...checkins.map(c => ({
      id: `DOC-GRC-${c.id}`,
      title: `Guest Registration Card (GRC)`,
      type: 'GRC',
      guestName: c.guestName,
      roomNumber: c.roomNumber,
      date: c.checkInDate,
      mobile: c.mobile,
      idProofType: c.idType || 'Aadhaar Card',
      idProofNumber: c.idNumber || c.aadhaarNumber || 'N/A',
      fileData: c.idProofFileData || c.aadhaarUploadData,
      source: c
    })),
    ...invoices.map(inv => ({
      id: `DOC-INV-${inv.id}`,
      title: `Tax Invoice ${inv.invoiceNumber}`,
      type: 'Tax Invoice',
      guestName: inv.guestName,
      roomNumber: inv.roomNumber || 'N/A',
      date: inv.dateCreated || inv.checkInDate || '',
      mobile: inv.guestMobile || 'N/A',
      idProofType: 'GST Invoice',
      idProofNumber: `Amount: ₹${inv.finalAmount || inv.subtotal || 0}`,
      fileData: undefined,
      source: inv
    }))
  ].filter(d => {
    const q = docSearch.toLowerCase();
    const matchesSearch = (d.guestName || '').toLowerCase().includes(q) ||
                          (d.roomNumber || '').toLowerCase().includes(q) ||
                          (d.title || '').toLowerCase().includes(q) ||
                          (d.id || '').toLowerCase().includes(q);
    const matchesCat = docCategoryFilter === 'All' || d.type === docCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* 🏨 DYNAMIC FRONT DESK VIEW SECTIONS */}

      {/* 1. DASHBOARD SUB-TAB */}
      {currentSubTab === 'dashboard' && (
        <TodayBookingsView
          rooms={rooms}
          bookings={bookings}
          checkins={checkins}
          staff={staff}
          invoices={invoices}
          hotelSettings={hotelSettings}
          onUpdateHotelSettings={onUpdateHotelSettings}
          onCheckIn={handleTriggerCheckIn}
          onCheckOut={handleTriggerCheckOut}
          onUpdateBookings={onUpdateBookings}
          onUpdateCheckins={onUpdateCheckins}
          onUpdateRooms={onUpdateRooms}
          onUpdateInvoices={onUpdateInvoices}
          onAddAuditLog={onAddAuditLog}
          onMoveToDeletedFolder={onMoveToDeletedFolder}
        />
      )}

      {/* 1B. ROOM CALENDAR MATRIX SUB-TAB */}
      {(currentSubTab === 'calendar' || currentSubTab === 'matrix') && (
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 shadow-sm">
          <CalendarBookingView
            rooms={rooms}
            bookings={bookings}
            setActiveTab={(tab) => onSelectSubTab(tab)}
            onUpdateBookings={onUpdateBookings}
            onUpdateRooms={onUpdateRooms}
            onAddAuditLog={onAddAuditLog}
            onOpenAdvanceBooking={(prefill) => {
              setPrefillForReservation(prefill);
              onSelectSubTab('reservations');
            }}
          />
        </div>
      )}

      {/* 2. ADVANCE BOOKINGS & RESERVATION LIST SUB-TAB */}
      {currentSubTab === 'reservations' && (
        <div className="space-y-4 print:space-y-0">
          {roomSubView === 'calendar' && (
            <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-luxury-brown-100 shadow-xs no-print">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-luxury-gold-600" />
                <h3 className="font-serif font-bold text-luxury-brown-900">Stay Overview & Matrix Calendar</h3>
              </div>
              <button
                onClick={() => setRoomSubView('inventory')}
                className="px-3 py-1.5 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors border border-luxury-brown-200 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-luxury-gold-600" />
                Back to Reservations List
              </button>
            </div>
          )}

          {roomSubView === 'inventory' ? (
            <ReservationView
              waterBottles={waterBottles}
              onUpdateWaterBottles={onUpdateWaterBottles}
              bookings={bookings}
              rooms={rooms}
              checkins={checkins}
              onUpdateCheckins={onUpdateCheckins}
              posOrders={posOrders}
              loggedInUser={loggedInUser}
              currentRole={currentRole}
              onUpdateBookings={onUpdateBookings}
              onUpdateRooms={onUpdateRooms}
              onCheckIn={handleTriggerCheckIn}
              onCheckOut={handleTriggerCheckOut}
              onOpenCalendar={() => setRoomSubView('calendar')}
              hotelSettings={hotelSettings}
              invoices={invoices}
              onUpdateInvoices={onUpdateInvoices}
              onAddAuditLog={onAddAuditLog}
              initialPreselectedBooking={prefillForReservation}
              onClearInitialPreselect={() => setPrefillForReservation(null)}
              onMoveToDeletedFolder={onMoveToDeletedFolder}
              travelAgents={travelAgents}
              onUpdateTravelAgents={onUpdateTravelAgents}
            />
          ) : (
            <CalendarBookingView
              rooms={rooms}
              bookings={bookings}
              checkins={checkins}
              onUpdateCheckins={onUpdateCheckins}
              loggedInUser={loggedInUser}
              autoMarkDirtyOnCheckout={hotelSettings?.autoMarkDirtyOnCheckout !== false}
              currentRole={currentRole}
              setActiveTab={(tab) => onSelectSubTab(tab)}
              onUpdateBookings={onUpdateBookings}
              onUpdateRooms={onUpdateRooms}
              onAddAuditLog={onAddAuditLog}
              onOpenAdvanceBooking={(prefill) => {
                setPrefillForReservation(prefill);
                setRoomSubView('inventory');
              }}
            />
          )}
        </div>
      )}

      {/* 2B. PRE-ARRIVAL DESK SUB-TAB */}
      {currentSubTab === 'prearrival' && (() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const filteredPreArrival = preArrivalBookingsList.filter(bk => {
          const q = preArrivalSearch.toLowerCase();
          const matchesSearch =
            (bk.guestName || '').toLowerCase().includes(q) ||
            (bk.mobile || '').includes(q) ||
            (bk.roomNumber || '').toLowerCase().includes(q) ||
            (bk.id || '').toLowerCase().includes(q);
          const matchesDate = preArrivalDateFilter === 'all' || bk.checkInDate === todayStr;
          return matchesSearch && matchesDate;
        });

        const arrivingTodayCount = preArrivalBookingsList.filter(b => b.checkInDate === todayStr).length;
        const totalPrepaid = preArrivalBookingsList.reduce((s, b) => s + Number(b.advanceAmount || 0), 0);

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-mono uppercase text-slate-500 font-bold">Upcoming Reservations</span>
                <div className="text-2xl font-serif font-bold text-[#263449] mt-1">{preArrivalBookingsList.length}</div>
                <span className="text-[11px] text-slate-500">Pending guest arrival & check-in</span>
              </div>
              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-mono uppercase text-amber-700 font-bold">Arriving Today ({todayStr})</span>
                <div className="text-2xl font-serif font-bold text-amber-700 mt-1">{arrivingTodayCount}</div>
                <span className="text-[11px] text-slate-500">Scheduled check-in @ {hotelSettings.checkInTime || '12:00 PM'}</span>
              </div>
              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-mono uppercase text-emerald-700 font-bold">Ready & Clean Rooms</span>
                <div className="text-2xl font-serif font-bold text-emerald-700 mt-1">
                  {rooms.filter(r => r.status === 'Available' && r.cleaningStatus !== 'Dirty').length}
                </div>
                <span className="text-[11px] text-slate-500">Inspected & ready for allocation</span>
              </div>
              <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-xs">
                <span className="text-[11px] font-mono uppercase text-[#8B691E] font-bold">Advance Deposits Collected</span>
                <div className="text-2xl font-mono font-bold text-[#263449] mt-1">₹{totalPrepaid.toLocaleString('en-IN')}</div>
                <span className="text-[11px] text-slate-500">Pre-arrival advance payments</span>
              </div>
            </div>

            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-luxury-brown-100 pb-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-[#263449] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#C49A3A]" /> Pre-Arrival Verification & Room Readiness Desk
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verify upcoming guest arrivals, inspect assigned room readiness, send pre-arrival welcome alerts & launch 1-click Check-In & GRC.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPreArrivalDateFilter('all')}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                        preArrivalDateFilter === 'all' ? 'bg-[#17120F] text-[#C49A3A] shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      All Upcoming ({preArrivalBookingsList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreArrivalDateFilter('today')}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                        preArrivalDateFilter === 'today' ? 'bg-[#17120F] text-[#C49A3A] shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Today ({arrivingTodayCount})
                    </button>
                  </div>
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={preArrivalSearch}
                      onChange={e => setPreArrivalSearch(e.target.value)}
                      placeholder="Search Guest, Mobile, Room..."
                      className="w-full bg-white border border-luxury-brown-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#263449] focus:outline-none focus:border-[#C49A3A]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSubTab('reservations')}
                    className="px-3.5 py-2 bg-[#C49A3A] hover:bg-[#B0862B] text-[#17120F] font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" /> New Advance Booking
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[920px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#17120F] text-white font-mono font-bold uppercase">
                      <th className="p-3.5 whitespace-nowrap">Booking ID</th>
                      <th className="p-3.5 whitespace-nowrap">Guest & Occupants</th>
                      <th className="p-3.5 whitespace-nowrap">Contact</th>
                      <th className="p-3.5 whitespace-nowrap">Assigned Room & Readiness</th>
                      <th className="p-3.5 whitespace-nowrap">Arrival & Stay</th>
                      <th className="p-3.5 whitespace-nowrap">Advance Paid</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Pre-Arrival Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPreArrival.length > 0 ? (
                      filteredPreArrival.map(bk => {
                        const roomObj = rooms.find(r => r.number === bk.roomNumber);
                        const isRoomClean = !roomObj || (roomObj.cleaningStatus !== 'Dirty' && roomObj.status !== 'Dirty');
                        return (
                          <tr key={bk.id} className="hover:bg-[#FDF8ED] transition-colors">
                            <td className="p-3.5 font-mono font-bold text-[#263449] whitespace-nowrap">
                              <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md">{bk.id}</span>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="font-serif font-bold text-[#263449] text-sm">{bk.guestName}</div>
                              <span className="text-[11px] font-mono text-slate-500">
                                {bk.adults || 2} Adult(s){bk.children ? `, ${bk.children} Child` : ''} • {bk.bookingSource || 'Direct'}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-[#263449] whitespace-nowrap">
                              <div>{bk.mobile}</div>
                              {bk.email && <div className="text-[10px] text-slate-400">{bk.email}</div>}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-[#17120F] text-[#C49A3A] rounded-lg font-mono font-bold text-xs">
                                  Room {bk.roomNumber || 'TBD'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    isRoomClean
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}
                                >
                                  {isRoomClean ? '✓ Clean & Ready' : '⚠ Needs Cleaning'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5 font-mono whitespace-nowrap">
                              <div className="font-bold text-emerald-800">In: {bk.checkInDate}</div>
                              <div className="text-slate-500 text-[11px]">Out: {bk.checkOutDate} ({bk.nights || 1}N)</div>
                            </td>
                            <td className="p-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                              ₹{Number(bk.advanceAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                {!isRoomClean && roomObj && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateRooms(
                                        rooms.map(r =>
                                          r.number === roomObj.number
                                            ? { ...r, cleaningStatus: 'Clean', status: r.status === 'Dirty' ? 'Available' : r.status }
                                            : r
                                        )
                                      );
                                      showToast(`Room ${roomObj.number} marked Clean & Ready for Pre-Arrival`, 'success');
                                    }}
                                    className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-xs cursor-pointer"
                                  >
                                    Mark Room Ready
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleTriggerCheckIn(bk)}
                                  className="px-3.5 py-1.5 bg-[#15805D] hover:bg-emerald-800 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> Proceed to Check-In & GRC
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400 italic">
                          No upcoming pre-arrival reservations found matching your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. WALK-IN BOOKING SUB-TAB */}
      {currentSubTab === 'walkin' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-white via-[#FFFDF7] to-[#FBF4E0] border border-[#C49A3A]/40 rounded-2xl p-6 text-[#263449] shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-3 py-1 bg-[#C49A3A]/20 text-[#8B691E] border border-[#C49A3A]/35 font-mono text-xs uppercase tracking-wider rounded-full font-bold">
                  Express Desk • Walk-In Registration
                </span>
                <h3 className="text-xl font-serif font-bold text-[#263449] mt-2">Instant Walk-In Guest Check-In</h3>
                <p className="text-xs text-[#5A6B82] mt-1">
                  Select an available room, capture guest identity details, assign extra beds & proceed to immediate guest check-in.
                </p>
              </div>
              <button
                onClick={() => onSelectSubTab('reservations')}
                className="px-3.5 py-1.5 bg-white hover:bg-[#FBF4E0] text-[#263449] border border-[#DCE3EC] rounded-lg text-xs font-bold cursor-pointer"
              >
                ← Back to Advance Bookings
              </button>
            </div>
          </div>

          <CheckInFormView
            waterBottles={waterBottles}
            onUpdateWaterBottles={onUpdateWaterBottles}
            posOrders={posOrders}
            inventoryProducts={inventoryProducts}
            onUpdateInventoryProducts={onUpdateInventoryProducts}
            inventoryStockMovements={inventoryStockMovements}
            onUpdateInventoryMovements={onUpdateInventoryMovements}
            mode="walkin"
            onSwitchTab={(t) => onSelectSubTab(t)}
            bookings={bookings}
            rooms={rooms}
            checkins={checkins}
            invoices={invoices}
            onUpdateInvoices={onUpdateInvoices}
            selectedBooking={null}
            setSelectedBooking={setSelectedBookingForCheckin}
            onUpdateBookings={onUpdateBookings}
            onUpdateRooms={onUpdateRooms}
            onUpdateCheckins={onUpdateCheckins}
            currentRole={currentRole}
            staff={staff}
            onAddAuditLog={onAddAuditLog}
            hotelSettings={hotelSettings}
            onUpdateHotelSettings={onUpdateHotelSettings}
            loggedInUser={loggedInUser}
            travelAgents={travelAgents}
            onUpdateTravelAgents={onUpdateTravelAgents}
          />
        </div>
      )}

      {/* 4. CHECK-IN SUB-TAB */}
      {currentSubTab === 'checkin' && (
        <CheckInFormView
          waterBottles={waterBottles}
          onUpdateWaterBottles={onUpdateWaterBottles}
          posOrders={posOrders}
          inventoryProducts={inventoryProducts}
          onUpdateInventoryProducts={onUpdateInventoryProducts}
          inventoryStockMovements={inventoryStockMovements}
          onUpdateInventoryMovements={onUpdateInventoryMovements}
          mode="checkin"
          onSwitchTab={(t) => onSelectSubTab(t)}
          bookings={bookings}
          rooms={rooms}
          checkins={checkins}
          invoices={invoices}
          onUpdateInvoices={onUpdateInvoices}
          selectedBooking={selectedBookingForCheckin}
          setSelectedBooking={setSelectedBookingForCheckin}
          onUpdateBookings={onUpdateBookings}
          onUpdateRooms={onUpdateRooms}
          onUpdateCheckins={onUpdateCheckins}
          currentRole={currentRole}
          staff={staff}
          onAddAuditLog={onAddAuditLog}
          hotelSettings={hotelSettings}
          onUpdateHotelSettings={onUpdateHotelSettings}
          loggedInUser={loggedInUser}
          travelAgents={travelAgents}
          onUpdateTravelAgents={onUpdateTravelAgents}
        />
      )}

      {/* 5. IN-HOUSE GUESTS SUB-TAB */}
      {currentSubTab === 'inhouse' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#263449] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#C49A3A]" /> In-House Active Guest Roster
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Currently checked-in guests, occupied room folios, room charges & stay durations.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inHouseSearch}
                    onChange={e => setInHouseSearch(e.target.value)}
                    placeholder="Search by Guest Name, Room, Mobile..."
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#263449] focus:outline-none focus:border-[#C49A3A]"
                  />
                </div>
                <button
                  onClick={() => {
                    setEditingWaterBottleRecord(null);
                    setWaterQuantity(2);
                    setWaterIsChargeable(false);
                    setWaterUnitPrice(defaultWaterBottleRate);
                    setShowWaterBottleModal(true);
                  }}
                  className="px-4 py-2 bg-[#17120F] text-[#C49A3A] border border-[#C49A3A]/30 font-bold text-xs rounded-xl hover:bg-[#241C17] transition-all shrink-0 flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
                >
                  <Droplets className="w-4 h-4 text-[#C49A3A]" /> Log Water Bottles
                </button>
              </div>
            </div>

            {/* In-House Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[920px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#17120F] text-white font-mono font-bold uppercase">
                    <th className="p-3.5 whitespace-nowrap">Room</th>
                    <th className="p-3.5 whitespace-nowrap">Primary Guest</th>
                    <th className="p-3.5 whitespace-nowrap">Contact</th>
                    <th className="p-3.5 whitespace-nowrap">Check-In Date</th>
                    <th className="p-3.5 whitespace-nowrap">Exp. Check-Out</th>
                    <th className="p-3.5 whitespace-nowrap">Advance Paid</th>
                    <th className="p-3.5 whitespace-nowrap">Status</th>
                    <th className="p-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeInHouseGuests.length > 0 ? (
                    activeInHouseGuests.map(guest => {
                      const liveGuestCalc = computeConfirmGuestFinancials(guest);
                      const effectiveAdvancePaid = liveGuestCalc.alreadyPaid;
                      const uniquePayModes = Array.from(
                        new Set(
                          (liveGuestCalc.payments || [])
                            .filter(p => Number(p.amount) > 0 && p.method)
                            .map(p => String(p.method))
                        )
                      );
                      const associatedBooking =
                        bookings.find(b => b.id === guest.id) ||
                        bookings.find(b => b.roomNumber === guest.roomNumber && !b.isCompleted);
                      const effectivePayModeLabel =
                        uniquePayModes.length > 0
                          ? uniquePayModes.join(' + ')
                          : guest.paymentMethod || associatedBooking?.paymentMethod || 'UPI';
                      const targetBookingForCheckout: Booking = associatedBooking || ({
                        id: guest.id,
                        guestName: guest.guestName,
                        mobile: guest.mobile,
                        roomNumber: guest.roomNumber,
                        roomType: guest.roomType || 'Standard',
                        checkInDate: guest.checkInDate,
                        checkOutDate: guest.checkOutDate,
                        advanceAmount: effectiveAdvancePaid,
                        paymentMethod: (uniquePayModes[0] || guest.paymentMethod || 'UPI') as any,
                        status: 'Confirmed',
                        isCheckedIn: true
                      } as unknown as Booking);
                      return (
                        <tr key={guest.id} className="hover:bg-[#FDF8ED] transition-colors">
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#17120F] text-[#C49A3A] border border-[#C49A3A]/40 rounded-lg font-mono font-bold text-xs whitespace-nowrap shadow-2xs">
                              <Bed className="w-3.5 h-3.5 text-[#C49A3A]" />
                              Room {guest.roomNumber}
                            </span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="text-[#263449] font-serif font-bold text-sm leading-tight">{guest.guestName}</div>
                            <span className="inline-block text-[10.5px] font-mono font-semibold text-slate-500 mt-0.5">
                              Guests: {guest.numGuests || 1} Adult(s)
                            </span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[#263449] text-xs">
                              <Phone className="w-3.5 h-3.5 text-[#C49A3A]" />
                              {guest.mobile}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-semibold text-[#263449] whitespace-nowrap">
                            {guest.checkInDate}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-[#9E7822] whitespace-nowrap">
                            {guest.checkOutDate}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-mono font-extrabold text-[#15805D] text-sm leading-tight">
                              ₹{effectiveAdvancePaid.toLocaleString('en-IN')}
                            </div>
                            {effectiveAdvancePaid > 0 && (
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#15805D] font-mono text-[10px] font-bold uppercase">
                                {effectivePayModeLabel}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ECFDF5] text-[#15805D] border border-[#A7F3D0] font-bold rounded-full text-[11px] whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#15805D] animate-pulse" />
                              In-House Stay
                            </span>
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2 flex-nowrap">
                              <button
                                onClick={() => handleOpenEditInHouseGuest(guest)}
                                title="Edit Walk-In / Stay Details"
                                className="px-3 py-1.5 bg-[#C49A3A] hover:bg-[#A8812B] text-[#17120F] font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer whitespace-nowrap"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedBookingForInvoice(targetBookingForCheckout);
                                  onSelectSubTab('billing');
                                }}
                                title="Generate or View Stay Tax Invoice in Invoice System"
                                className="px-3 py-1.5 bg-[#17120F] hover:bg-[#2A211B] text-[#C49A3A] border border-[#C49A3A]/40 font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer whitespace-nowrap"
                              >
                                <Receipt className="w-3.5 h-3.5 text-[#C49A3A]" /> Invoice
                              </button>
                              <button
                                onClick={() => setViewingGrc(guest)}
                                title="View Guest Registration Card (GRC)"
                                className="px-3 py-1.5 bg-[#F4F6F9] hover:bg-[#E6EBF2] text-[#263449] border border-[#C2CDD9] rounded-lg transition-colors inline-flex items-center gap-1.5 font-bold text-xs cursor-pointer whitespace-nowrap"
                              >
                                <FileCheck className="w-3.5 h-3.5 text-[#C49A3A]" /> GRC
                              </button>
                              <button
                                onClick={() => handlePrintGuestGrc(guest)}
                                title="Print Official Guest Registration Card (GRC)"
                                className="px-3 py-1.5 bg-white hover:bg-[#FDF8ED] text-[#263449] border border-[#C49A3A] rounded-lg transition-colors inline-flex items-center gap-1.5 font-bold text-xs cursor-pointer whitespace-nowrap shadow-2xs"
                              >
                                <Printer className="w-3.5 h-3.5 text-[#C49A3A]" /> Print GRC
                              </button>
                              <button
                                onClick={() => handleOpenCheckoutConfirmModal(guest)}
                                title="Open Check-Out Confirmation & Room Damage / Fine Inspection Box"
                                className="px-3 py-1.5 bg-[#D92D4B] hover:bg-[#B4223B] text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer whitespace-nowrap"
                              >
                                <LogOut className="w-3.5 h-3.5" /> Check-Out
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400 italic">
                        No active in-house guests found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Checked-Out Guests & Settlement History (Edit Check-Out anytime + 24-hr Undo Check-Out) */}
          {(() => {
            const nowD = new Date();
            const todayLocalYmd = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
            const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const toOutLocalYmd = (iso?: string) => {
              const s = String(iso || '').trim();
              if (!s) return '';
              if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
              const dt = new Date(s);
              if (!Number.isNaN(dt.getTime())) {
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
              }
              return s.slice(0, 10);
            };

            const allCheckedOut = rawCheckinsProp
              .filter((c) => Boolean(c.checkedOutDateTime))
              .sort((a, b) => String(b.checkedOutDateTime).localeCompare(String(a.checkedOutDateTime)));

            const filteredCheckouts = allCheckedOut.filter((c) => {
              if (checkedOutHistoryFilter === 'today') {
                if (toOutLocalYmd(c.checkedOutDateTime) !== todayLocalYmd && c.checkOutDate !== todayLocalYmd) {
                  return false;
                }
              } else if (checkedOutHistoryFilter === '7days') {
                const ts = new Date(c.checkedOutDateTime as string).getTime();
                if (!Number.isNaN(ts) && ts < sevenDaysAgoMs) return false;
              }
              if (checkedOutSearch.trim()) {
                const q = checkedOutSearch.trim().toLowerCase();
                const match =
                  String(c.guestName || '').toLowerCase().includes(q) ||
                  String(c.mobile || '').toLowerCase().includes(q) ||
                  String(c.roomNumber || '').toLowerCase().includes(q) ||
                  String(c.id || '').toLowerCase().includes(q);
                if (!match) return false;
              }
              return true;
            });

            return (
              <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-amber-100 pb-3">
                  <div>
                    <h3 className="text-base font-serif font-bold text-[#263449] flex items-center gap-2">
                      <Edit className="w-5 h-5 text-[#C49A3A]" /> Checked-Out Guests &amp; Settlement History ({filteredCheckouts.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Edit any Checked-Out guest&apos;s payment modes / hybrid split, extra charges, or discount (auto-synced to Reports &amp; Invoices), or Undo within 24 hours.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={checkedOutSearch}
                        onChange={(e) => setCheckedOutSearch(e.target.value)}
                        placeholder="Search guest, room, mobile..."
                        className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:border-[#C49A3A]"
                      />
                    </div>
                    <div className="inline-flex rounded-lg border border-amber-200 bg-amber-50/50 p-0.5 text-[11px] font-mono font-bold">
                      {(
                        [
                          { id: 'today', label: 'Today' },
                          { id: '7days', label: 'Last 7 Days' },
                          { id: 'all', label: `All (${allCheckedOut.length})` },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setCheckedOutHistoryFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
                            checkedOutHistoryFilter === tab.id
                              ? 'bg-[#17120F] text-[#F6DE98]'
                              : 'text-amber-900 hover:bg-amber-100/70'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {filteredCheckouts.length === 0 ? (
                  <p className="text-xs italic text-slate-400 py-2">
                    No checked-out guest records match the selected filter.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#FBF4E0] text-[#263449] font-mono font-bold uppercase">
                          <th className="p-3 whitespace-nowrap">Room</th>
                          <th className="p-3 whitespace-nowrap">Guest</th>
                          <th className="p-3 whitespace-nowrap">Contact</th>
                          <th className="p-3 whitespace-nowrap">Checked-Out At</th>
                          <th className="p-3 whitespace-nowrap">Final Bill</th>
                          <th className="p-3 whitespace-nowrap">Balance</th>
                          <th className="p-3 text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredCheckouts.map((g) => {
                          const canUndo =
                            getUndoTimeLeftMs(g) > 0 &&
                            !rawCheckinsProp.some(
                              (ac) =>
                                ac.id !== g.id &&
                                !ac.checkedOutDateTime &&
                                ac.roomNumber === g.roomNumber &&
                                isSameGuestPerson(ac, g)
                            );
                          const pendingDue = Math.max(0, Number(g.pendingAmount || 0));
                          return (
                            <tr key={g.id} className="hover:bg-[#FDF8ED] transition-colors">
                              <td className="p-3 whitespace-nowrap font-mono font-bold text-[#263449]">
                                Room {g.roomNumber}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-serif font-bold text-sm text-[#263449] leading-tight">{g.guestName}</div>
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                                  Checked-Out
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap font-mono font-semibold text-[#263449]">{g.mobile}</td>
                              <td className="p-3 whitespace-nowrap font-mono text-slate-700">
                                {new Date(g.checkedOutDateTime as string).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {g.checkedOutBy ? (
                                  <span className="block text-[10px] text-slate-400">by {g.checkedOutBy}</span>
                                ) : null}
                              </td>
                              <td className="p-3 whitespace-nowrap font-mono font-bold text-[#15805D]">
                                ₹{Number(g.totalAmount || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="p-3 whitespace-nowrap font-mono font-bold">
                                {pendingDue > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px]">
                                    ₹{pendingDue.toLocaleString('en-IN')} Due
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                                    PAID
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCheckedOutGuest(g)}
                                    title="Edit Check-Out Settlement, Hybrid Split Payments, Extra Charges, or Discount"
                                    className="px-3 py-1.5 bg-[#F6DE98] hover:bg-[#E8CE84] text-[#17120F] border border-[#C49A3A] font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer whitespace-nowrap"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-[#8B691E]" /> Edit Check-Out
                                  </button>
                                  {canUndo && (
                                    <button
                                      type="button"
                                      onClick={() => handleUndoCheckOut(g)}
                                      title={`Undo Check-Out (${formatUndoTimeLeft(getUndoTimeLeftMs(g))} left)`}
                                      className="px-3 py-1.5 bg-[#17120F] hover:bg-[#2A211B] text-[#C49A3A] border border-[#C49A3A]/50 font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer whitespace-nowrap"
                                    >
                                      <Undo2 className="w-3.5 h-3.5" /> Undo
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* 6. CHECK-OUT SUB-TAB */}
      {currentSubTab === 'checkout' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#263449] flex items-center gap-2">
                  <LogOut className="w-5 h-5 text-[#D92D4B]" /> Express Check-Out & Departure Settlement Desk
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Process departure folios, verify 8 Invoice Conditions, apply auto CGST + SGST from Settings, & issue final GST tax invoices.
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3.5 py-1.5 bg-[#FFF1F3] text-[#D92D4B] border border-[#FECDD6] font-mono text-xs rounded-full font-bold whitespace-nowrap">
                  {activeCheckins.length} Active In-House Folios
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[900px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#17120F] text-white font-mono font-bold uppercase">
                    <th className="p-3.5 whitespace-nowrap">Room</th>
                    <th className="p-3.5 whitespace-nowrap">Guest Name</th>
                    <th className="p-3.5 whitespace-nowrap">Check-In</th>
                    <th className="p-3.5 whitespace-nowrap">Exp. Check-Out</th>
                    <th className="p-3.5 whitespace-nowrap">Total Tariff (Incl. CGST+SGST)</th>
                    <th className="p-3.5 whitespace-nowrap">Paid</th>
                    <th className="p-3.5 whitespace-nowrap">Outstanding Balance</th>
                    <th className="p-3.5 text-right whitespace-nowrap">Settlement Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeCheckins.map(guest => {
                    const liveCalc = computeConfirmGuestFinancials(guest);
                    const totalPaid = liveCalc.alreadyPaid;
                    const totalEst = liveCalc.grandTotal;
                    const balance = liveCalc.balanceDue;
                    const associatedBooking =
                      bookings.find(b => b.id === guest.id) ||
                      bookings.find(b => b.roomNumber === guest.roomNumber && !b.isCompleted);
                    const targetBookingForCheckout: Booking = associatedBooking || ({
                      id: guest.id,
                      guestName: guest.guestName,
                      mobile: guest.mobile,
                      roomNumber: guest.roomNumber,
                      roomType: guest.roomType || 'Standard',
                      checkInDate: guest.checkInDate,
                      checkOutDate: guest.checkOutDate,
                      advanceAmount: guest.advanceAmount || 0,
                      paymentMethod: guest.paymentMethod || 'UPI',
                      status: 'Confirmed',
                      isCheckedIn: true
                    } as unknown as Booking);

                    return (
                      <tr key={guest.id} className="hover:bg-[#FDF8ED] transition-colors">
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#17120F] text-[#C49A3A] border border-[#C49A3A]/40 rounded-lg font-mono font-bold text-xs whitespace-nowrap">
                            Room {guest.roomNumber}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold font-serif text-[#263449] text-sm whitespace-nowrap">{guest.guestName}</td>
                        <td className="p-3.5 font-mono text-[#263449] whitespace-nowrap">{guest.checkInDate}</td>
                        <td className="p-3.5 font-mono font-bold text-[#D92D4B] whitespace-nowrap">{guest.checkOutDate}</td>
                        <td className="p-3.5 font-mono font-bold text-[#263449] whitespace-nowrap">₹{totalEst.toLocaleString()}</td>
                        <td className="p-3.5 font-mono text-[#15805D] font-bold whitespace-nowrap">₹{totalPaid.toLocaleString()}</td>
                        <td className="p-3.5 font-mono font-bold whitespace-nowrap">
                          {balance > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FFF1F3] text-[#D92D4B] border border-[#FECDD6] text-[11px]">
                              ₹{balance.toLocaleString()} Due
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#15805D] border border-[#A7F3D0] text-[11px]">
                              ₹0 (Fully Paid)
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintGuestGrc(guest)}
                              className="px-3 py-1.5 bg-white hover:bg-[#FDF8ED] text-[#263449] border border-slate-300 font-bold rounded-lg text-xs shadow-2xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              title="Print Official Guest Registration Card (GRC)"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#C49A3A]" /> Print GRC
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditInHouseGuest(guest)}
                              className="px-3 py-1.5 bg-white hover:bg-[#FDF8ED] text-[#263449] border border-[#C49A3A] font-bold rounded-lg text-xs shadow-2xs inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              title="Edit stay dates, room transfer, extra bed, discount, or advance"
                            >
                              <Edit className="w-3.5 h-3.5 text-[#C49A3A]" /> Edit Stay
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCheckoutConfirmModal(guest)}
                              className="px-4 py-1.5 bg-[#D92D4B] hover:bg-[#B4223B] text-white font-bold rounded-lg text-xs shadow-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                              title="Open Check-Out Confirmation & Room Damage / Fine Inspection Box"
                            >
                              <LogOut className="w-3.5 h-3.5" /> Check-Out & Room Fine
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {activeCheckins.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400 italic">
                        No checked-in rooms pending check-out currently.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. BILLING SUB-TAB */}
      {currentSubTab === 'billing' && (
        <InvoiceView
          invoices={invoices}
          bookings={bookings}
          checkins={checkins}
          rooms={rooms}
          currentRole={currentRole}
          hotelSettings={hotelSettings}
          onUpdateHotelSettings={onUpdateHotelSettings}
          selectedBookingForInvoice={selectedBookingForInvoice}
          setSelectedBookingForInvoice={setSelectedBookingForInvoice}
          onUpdateInvoices={onUpdateInvoices}
          onUpdateCheckins={onUpdateCheckins}
          onUpdateRooms={onUpdateRooms}
          onUpdateBookings={onUpdateBookings}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {/* 9. GUEST SERVICES SUB-TAB */}
      {currentSubTab === 'services' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
                <Droplets className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-luxury-brown-400 font-bold uppercase">Water Bottle Issue Log</span>
                <h4 className="text-xl font-bold font-mono text-luxury-brown-900">
                  {waterOnlyRecords.reduce((s, w) => s + (Number(w.quantity) || 0), 0)} Bottles
                </h4>
              </div>
            </div>

            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-luxury-brown-400 font-bold uppercase">Room Service Orders</span>
                <h4 className="text-xl font-bold font-mono text-luxury-brown-900">{posOrders.length} Orders</h4>
              </div>
            </div>

            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-luxury-brown-400 font-bold uppercase">Guest Services</span>
                <h4 className="text-xl font-bold font-mono text-luxury-brown-900">
                  {savedServices.length} Saved • {serviceAllocationRecords.length} Allocated
                </h4>
              </div>
            </div>
          </div>

          {/* ADD SERVICE & ALLOCATE SERVICE TO ROOM PANEL */}
          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-luxury-gold-600" /> Guest Services & Room Allocation
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Add hotel services with a configured amount (₹) and allocate them to occupied guest rooms as complimentary (₹0) or chargeable.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddServiceModal}
                  className="px-4 py-2 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Service
                </button>
                <button
                  type="button"
                  onClick={handleOpenAllocateServiceModal}
                  className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Add/Allocate Service
                </button>
              </div>
            </div>

            {/* Saved Services Catalog Bar */}
            <div className="bg-luxury-beige-50/70 border border-luxury-brown-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-luxury-brown-700">
                  Configured Hotel Services ({savedServices.length})
                </span>
                <span className="text-[11px] text-luxury-brown-500">
                  Available for selection when allocating to an occupied room
                </span>
              </div>
              {savedServices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {savedServices.map(srv => (
                    <div
                      key={srv.id}
                      className="px-3 py-1.5 bg-white border border-luxury-brown-200 rounded-lg text-xs flex items-center gap-2 shadow-2xs"
                    >
                      <span className="font-bold text-luxury-brown-950">{srv.serviceName}</span>
                      <span className="px-2 py-0.5 bg-luxury-gold-500/20 text-luxury-brown-900 font-mono font-bold rounded text-[11px]">
                        ₹{Number(srv.configuredAmount ?? srv.chargeAmount ?? 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-luxury-brown-400 italic">
                  No services configured yet. Click "Add Service" to add a service name and amount (₹).
                </p>
              )}
            </div>

            {/* Allocated Room Services Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-luxury-beige-100/70 border-b border-luxury-brown-200 text-luxury-brown-700 font-serif font-bold">
                    <th className="p-3">Room</th>
                    <th className="p-3">Guest & Stay</th>
                    <th className="p-3">Service Name</th>
                    <th className="p-3">Service Price</th>
                    <th className="p-3">Billing Status</th>
                    <th className="p-3">Charged to Guest</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3 text-right">Guest Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100">
                  {(() => {
                    // Combine allocations from active/past checkins and serviceAllocationRecords (deduplicated by id)
                    const combinedMap = new Map<string, AllocatedGuestService>();
                    checkins.forEach(c => {
                      (c.allocatedServices || []).forEach(s => {
                        if (s && s.id) combinedMap.set(s.id, s);
                      });
                    });
                    serviceAllocationRecords.forEach(r => {
                      if (r && r.id && !combinedMap.has(r.id)) {
                        combinedMap.set(r.id, {
                          id: r.id,
                          requestId: r.requestId,
                          hotelId: r.hotelId,
                          serviceId: r.serviceId || r.id,
                          serviceName: r.serviceName || 'Service',
                          configuredAmount: Number(r.configuredAmount ?? r.chargeAmount ?? 0),
                          chargedAmount: r.isChargeable ? Number(r.chargeAmount ?? r.configuredAmount ?? 0) : 0,
                          isChargeable: Boolean(r.isChargeable),
                          roomNumber: r.roomNumber,
                          checkInId: r.checkInId || '',
                          guestName: r.guestName || 'In-House Guest',
                          allocatedBy: r.deliveredBy,
                          dateTime: r.dateTime || r.date
                        });
                      }
                    });
                    const allocationsList = Array.from(combinedMap.values());

                    if (allocationsList.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-luxury-brown-400 italic">
                            No room services allocated yet. Click "Add/Allocate Service" to assign a service to an occupied room.
                          </td>
                        </tr>
                      );
                    }

                    return allocationsList.map(alloc => {
                      const guestRecord =
                        checkins.find(c => c.id === alloc.checkInId) ||
                        checkins.find(c => c.roomNumber === alloc.roomNumber && !c.checkedOutDateTime);

                      return (
                        <tr key={alloc.id} className="hover:bg-luxury-beige-50/80">
                          <td className="p-3 font-mono font-bold text-luxury-gold-700">Room {alloc.roomNumber}</td>
                          <td className="p-3">
                            <span className="font-bold text-luxury-brown-950 block">{alloc.guestName}</span>
                            {alloc.checkInId && (
                              <span className="text-[10px] font-mono text-luxury-brown-400">Stay #{alloc.checkInId}</span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-luxury-brown-900">{alloc.serviceName}</td>
                          <td className="p-3 font-mono text-gray-600">₹{Number(alloc.configuredAmount || 0).toLocaleString()}</td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                alloc.isChargeable
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {alloc.isChargeable ? 'Chargeable' : 'Complimentary'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold">
                            {alloc.isChargeable ? (
                              <span className="text-amber-900">₹{Number(alloc.chargedAmount || 0).toLocaleString()}</span>
                            ) : (
                              <span className="text-emerald-700">₹0 (Complimentary)</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-gray-500">{alloc.dateTime}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {guestRecord && (
                                <button
                                  type="button"
                                  onClick={() => setViewingGrc(guestRecord)}
                                  className="px-2 py-1 bg-luxury-brown-100 hover:bg-luxury-brown-200 text-luxury-brown-900 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FileCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> View Slip
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteAllocatedService(alloc.id)}
                                className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors cursor-pointer border border-rose-200"
                                title="Remove Allocated Service"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-luxury-gold-600" /> Water Bottle & Guest Amenity Dispatch Log
                </h3>
                <p className="text-xs text-luxury-brown-500">Record complimentary / chargeable water bottle distributions to room guests.</p>
              </div>
              <button
                onClick={() => {
                  setEditingWaterBottleRecord(null);
                  setWaterQuantity(2);
                  setWaterIsChargeable(false);
                  setWaterUnitPrice(defaultWaterBottleRate);
                  setShowWaterBottleModal(true);
                }}
                className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Water Bottle Log
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-luxury-beige-100/70 border-b border-luxury-brown-200 text-luxury-brown-700 font-serif font-bold">
                    <th className="p-3">Room</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Charge Amount</th>
                    <th className="p-3">Delivered By</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100">
                  {waterOnlyRecords.length > 0 ? (
                    waterOnlyRecords.map(wb => (
                      <tr key={wb.id} className="hover:bg-luxury-beige-50/80">
                        <td className="p-3 font-mono font-bold text-luxury-gold-700">Room {wb.roomNumber}</td>
                        <td className="p-3 font-bold font-mono text-gray-900">{Number(wb.quantity) || 1} Bottles</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            wb.isChargeable ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {wb.isChargeable ? 'Chargeable' : 'Complimentary'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-gray-700">₹{wb.chargeAmount || 0}</td>
                        <td className="p-3 text-gray-800">{wb.deliveredBy || 'Staff'}</td>
                        <td className="p-3 font-mono text-gray-500">{wb.dateTime || wb.date}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditWaterBottle(wb)}
                              className="px-2.5 py-1 rounded-lg bg-luxury-gold-50 hover:bg-luxury-gold-100 text-luxury-brown-900 font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer border border-luxury-gold-500/40 shadow-xs"
                              title="Edit Water Bottle Log"
                            >
                              <Edit className="w-3.5 h-3.5 text-luxury-gold-700" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWaterBottle(wb.id)}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors cursor-pointer border border-rose-200"
                              title="Delete Water Bottle Log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-luxury-brown-400 italic">
                        No water bottle records logged yet today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9B. TRAVEL AGENTS / PARTNERS SUB-TAB */}
      {currentSubTab === 'agents' && (
        <TravelAgentManagerView
          travelAgents={travelAgents}
          commissionPayments={agentCommissionPayments}
          bookings={bookings}
          hotelSettings={hotelSettings}
          loggedInUser={loggedInUser}
          onUpdateTravelAgents={(updated) => {
            if (onUpdateTravelAgents) onUpdateTravelAgents(updated);
          }}
          onUpdateCommissionPayments={(updated) => {
            if (onUpdateAgentCommissionPayments) onUpdateAgentCommissionPayments(updated);
          }}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {/* 10. DOCUMENTS SUB-TAB */}
      {currentSubTab === 'documents' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-luxury-gold-600" /> Guest Document & Identity Archival Center
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Search & inspect Aadhaar scans, Passport proofs, GRC digital signatures, & PDF Tax Invoices.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  value={docCategoryFilter}
                  onChange={e => setDocCategoryFilter(e.target.value)}
                  className="bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 text-xs text-luxury-brown-900"
                >
                  <option value="All">All Documents</option>
                  <option value="GRC">Guest Registration Cards (GRC)</option>
                  <option value="Tax Invoice">Tax Invoices</option>
                </select>

                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    placeholder="Search Documents..."
                    className="w-full bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl pl-9 pr-3 py-2 text-xs text-luxury-brown-900"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documentRecords.map(doc => (
                <div key={doc.id} className="bg-luxury-beige-50/60 border border-luxury-brown-200 rounded-xl p-4 space-y-3 hover:border-luxury-gold-500 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 bg-luxury-gold-500/20 text-luxury-brown-900 font-mono text-[10px] font-bold rounded">
                      {doc.type}
                    </span>
                    <span className="text-[10px] text-luxury-brown-400 font-mono">{doc.date}</span>
                  </div>

                  <div>
                    <h4 className="font-serif font-bold text-luxury-brown-950 text-sm">{doc.guestName}</h4>
                    <p className="text-xs text-luxury-brown-500 font-mono">Room {doc.roomNumber} • {doc.mobile}</p>
                  </div>

                  <div className="pt-2 border-t border-luxury-brown-200 flex justify-between items-center text-xs">
                    <span className="text-[10px] font-mono text-luxury-brown-600">{doc.idProofNumber}</span>
                    <button
                      onClick={() => setViewingDocument(doc)}
                      className="px-3 py-1 bg-luxury-brown-900 text-luxury-gold-300 font-bold rounded-lg text-[11px] hover:bg-black transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Document
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 10B. DELETED FOLDER (TRASH / RECYCLE BIN) */}
      {currentSubTab === 'deleted' && (
        <DeletedFolderView
          deletedItems={deletedItems}
          onRestoreItem={onRestoreDeletedItem || (() => {})}
          onPermanentDelete={onPermanentDelete || (() => {})}
          hotelName={hotelSettings.name}
        />
      )}

      {/* 11. REPORTS SUB-TAB */}
      {currentSubTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-luxury-brown-100 shadow-xs no-print">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#C49A3A]" />
              <h3 className="font-serif font-bold text-[#263449]">Front Desk Operational & Night Audit Reports</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportSubView('operational')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  reportSubView === 'operational'
                    ? 'bg-[#17120F] text-[#C49A3A] shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Comprehensive Audit Reports
              </button>
              <button
                type="button"
                onClick={() => setReportSubView('daily')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  reportSubView === 'daily'
                    ? 'bg-[#17120F] text-[#C49A3A] shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Daily Shift Night Audit
              </button>
            </div>
          </div>

          {reportSubView === 'operational' ? (
            <ReportsView
              rooms={rooms}
              bookings={bookings}
              checkins={checkins}
              invoices={invoices}
              expenses={expenses}
              waterBottles={waterBottles}
              posOrders={posOrders}
              posItems={posItems}
              staff={staff}
              hotelSettings={hotelSettings}
              onUpdateHotelSettings={onUpdateHotelSettings}
              onUpdateInvoices={onUpdateInvoices}
              onUpdateBookings={onUpdateBookings}
              onAddAuditLog={onAddAuditLog}
              onEditCheckout={(g) => setEditingCheckedOutGuest(g)}
            />
          ) : (
            <DailyReportView
              rooms={rooms}
              bookings={bookings}
              checkins={checkins}
              invoices={invoices}
              expenses={expenses}
              staff={staff}
              posOrders={posOrders}
              posItems={posItems}
              hotelSettings={hotelSettings}
            />
          )}
        </div>
      )}

      {/* 12. SETTINGS SUB-TAB */}
      {currentSubTab === 'settings' && (
        <PolicyManager
          policies={policies}
          currentRole={currentRole}
          hotelSettings={hotelSettings}
          onUpdateHotelSettings={onUpdateHotelSettings}
          onUpdatePolicies={onUpdatePolicies}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {/* --- MODALS --- */}

      {/* 1. ADD SERVICE MODAL */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-luxury-brown-200 rounded-2xl p-6 max-w-md w-full space-y-4 text-[#263449] shadow-2xl">
            <div className="flex justify-between items-center border-b border-luxury-brown-200 pb-3">
              <h3 className="text-base font-serif font-bold text-[#263449] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#C49A3A]" /> Add Service
              </h3>
              <button
                type="button"
                onClick={() => setShowAddServiceModal(false)}
                className="text-slate-400 hover:text-[#263449] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewService} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[#263449] font-bold block mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Airport Pickup, Ironing, Spa, Room Heater"
                  value={newServiceName}
                  onChange={e => setNewServiceName(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449]"
                />
              </div>

              <div>
                <label className="text-[#263449] font-bold block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="e.g., 500"
                  value={newServiceAmount}
                  onChange={e => setNewServiceAmount(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-luxury-brown-200">
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="px-4 py-2 bg-[#F4F6F9] hover:bg-slate-200 text-[#263449] border border-luxury-brown-200 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingService}
                  className="px-5 py-2 bg-[#C49A3A] hover:bg-[#a9822d] disabled:opacity-50 text-white font-bold rounded-lg shadow cursor-pointer"
                >
                  {isSavingService ? 'Saving...' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD / ALLOCATE SERVICE TO OCCUPIED ROOM MODAL */}
      {showAllocateServiceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-luxury-brown-200 rounded-2xl p-6 max-w-md w-full space-y-4 text-[#263449] shadow-2xl">
            <div className="flex justify-between items-center border-b border-luxury-brown-200 pb-3">
              <h3 className="text-base font-serif font-bold text-[#263449] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#C49A3A]" /> Add/Allocate Service to Room
              </h3>
              <button
                type="button"
                onClick={() => setShowAllocateServiceModal(false)}
                className="text-slate-400 hover:text-[#263449] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllocateServiceToRoom} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[#263449] font-bold block mb-1">Select Occupied Room *</label>
                <select
                  required
                  value={selectedServiceRoomNo}
                  onChange={e => setSelectedServiceRoomNo(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-semibold"
                >
                  <option value="">-- Choose Occupied Room --</option>
                  {occupiedRoomsWithStay.map(r => {
                    const stay = getActiveStayForRoom(r.number);
                    return (
                      <option key={r.id} value={r.number}>
                        Room {r.number} ({r.category}) — {stay?.guestName || 'Occupied'}
                      </option>
                    );
                  })}
                </select>
                {occupiedRoomsWithStay.length === 0 && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    No occupied rooms with an active guest stay found for this hotel.
                  </p>
                )}
              </div>

              {/* Automatically Identified Guest & Active Stay */}
              <div className="bg-[#FAFBFD] border border-luxury-brown-200 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#C49A3A] font-bold block">
                  Identified Guest & Active Stay
                </span>
                {selectedRoomActiveStay ? (
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-[#263449]">{selectedRoomActiveStay.guestName}</p>
                    <p className="text-[11px] font-mono text-slate-600">
                      Stay ID: {selectedRoomActiveStay.id} • Room {selectedServiceRoomNo}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Check-In: {selectedRoomActiveStay.checkInDate} → Check-Out: {selectedRoomActiveStay.checkOutDate}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Select an occupied room above to automatically identify the guest and active stay.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[#263449] font-bold block mb-1">Select Service *</label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={e => setSelectedServiceId(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-semibold"
                >
                  <option value="">-- Choose Saved Service --</option>
                  {savedServices.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.serviceName} (₹{Number(s.configuredAmount ?? s.chargeAmount ?? 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Service Amount */}
              <div className="flex items-center justify-between bg-[#FAFBFD] border border-luxury-brown-200 rounded-lg p-2.5">
                <span className="text-[#263449] font-bold">Configured Service Amount:</span>
                <span className="font-mono font-bold text-sm text-[#C49A3A]">
                  ₹{selectedServiceAmountVal.toLocaleString()}
                </span>
              </div>

              {/* Checkbox: Charge this service to the guest? */}
              <div className="bg-[#FAFBFD] border border-[#C49A3A]/40 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="chkChargeServiceToGuest"
                    checked={chargeServiceToGuest}
                    onChange={e => setChargeServiceToGuest(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C49A3A] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="chkChargeServiceToGuest" className="text-[#263449] font-bold cursor-pointer select-none">
                    Charge this service to the guest?
                  </label>
                </div>
                <p className="text-[11px] text-slate-600 pl-6">
                  {chargeServiceToGuest
                    ? `Chargeable: ₹${selectedServiceAmountVal.toLocaleString()} will be added once to the guest's active room folio and final checkout invoice.`
                    : `Complimentary: ₹0 will be charged to the guest. The service will appear on the guest slip as Complimentary (₹0), and no amount will be added to the folio or invoice.`}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-luxury-brown-200">
                <button
                  type="button"
                  onClick={() => setShowAllocateServiceModal(false)}
                  className="px-4 py-2 bg-[#F4F6F9] hover:bg-slate-200 text-[#263449] border border-luxury-brown-200 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAllocatingService || !selectedRoomActiveStay || !selectedServiceConfig}
                  className="px-5 py-2 bg-[#C49A3A] hover:bg-[#a9822d] disabled:opacity-50 text-white font-bold rounded-lg shadow cursor-pointer"
                >
                  {isAllocatingService ? 'Saving...' : 'Save Service Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WATER BOTTLE LOG & STOCK MODAL */}
      {showWaterBottleModal && (() => {
        const waterTargetStay = getActiveStayForRoom(waterRoomNo);
        const parsedRate = Number(waterUnitPrice);
        const effectiveRate = Number.isFinite(parsedRate) ? Math.max(0, parsedRate) : defaultWaterBottleRate;
        const totalWaterCharge = waterIsChargeable
          ? r2(Math.max(0, Number(waterQuantity) || 0) * effectiveRate)
          : 0;
        const currentInvStock = Number(waterBottleInventoryProduct?.currentStock ?? 0);
        const effectiveAvailForEdit = currentInvStock + (editingWaterBottleRecord ? Number(editingWaterBottleRecord.quantity || 0) : 0);
        const requestedQty = Math.max(0, Math.floor(Number(waterQuantity) || 0));
        const hasInsufficientStock = effectiveAvailForEdit <= 0 || requestedQty > effectiveAvailForEdit;

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-luxury-brown-200 rounded-2xl p-6 max-w-md w-full space-y-4 text-[#263449] shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-luxury-brown-200 pb-3">
                <h3 className="text-base font-serif font-bold text-[#263449] flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-[#C49A3A]" />{' '}
                  {editingWaterBottleRecord ? 'Edit Water Bottle Allocation' : 'Water Bottle Allocation & Stock'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowWaterBottleModal(false);
                    setEditingWaterBottleRecord(null);
                    setWaterModalTab('allocate');
                  }}
                  className="text-slate-400 hover:text-[#263449] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!editingWaterBottleRecord && (
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F4F6F9] rounded-xl border border-luxury-brown-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setWaterModalTab('allocate')}
                    className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                      waterModalTab === 'allocate'
                        ? 'bg-[#263449] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#263449]'
                    }`}
                  >
                    🛎️ Allocate to Room
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddWaterSellingRate(defaultWaterBottleRate > 0 ? defaultWaterBottleRate : '');
                      setAddWaterCostRate(
                        Number(waterBottleInventoryProduct?.costPrice || 0) > 0
                          ? Number(waterBottleInventoryProduct?.costPrice)
                          : ''
                      );
                      setWaterModalTab('stock');
                    }}
                    className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                      waterModalTab === 'stock'
                        ? 'bg-[#C49A3A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#263449]'
                    }`}
                  >
                    📦 Add Inventory Stock
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between bg-[#FAFBFD] border border-luxury-brown-200 rounded-lg px-3 py-2 text-[11px]">
                <span className="text-slate-600 font-medium">
                  Inventory Stock ({waterBottleInventoryProduct?.name || 'Packaged Drinking Water (1L)'}):
                </span>
                <span className={`font-mono font-bold ${currentInvStock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {currentInvStock} {waterBottleInventoryProduct?.unit || 'Bottles'} Available
                </span>
              </div>

              {waterModalTab === 'stock' && !editingWaterBottleRecord ? (
                <form onSubmit={handleAddWaterStockDirect} className="space-y-3 text-xs">
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-950">
                    Add Water Bottle stock and set your hotel&apos;s own bottle rate. This syncs directly with <strong>Inventory Store</strong>.
                  </div>

                  <div>
                    <label className="text-[#263449] font-bold block mb-1">Add Stock Quantity (Bottles) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={addWaterStockQty}
                      onChange={e => setAddWaterStockQty(Math.max(1, Number(e.target.value) || 0))}
                      placeholder="e.g. 24"
                      className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-mono font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[#263449] font-bold block mb-1">Guest Selling Rate / Bottle (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={addWaterSellingRate}
                        onChange={e => setAddWaterSellingRate(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Set your rate (e.g. 20)"
                        className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[#263449] font-bold block mb-1">Purchase Cost / Bottle (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={addWaterCostRate}
                        onChange={e => setAddWaterCostRate(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Optional (e.g. 12)"
                        className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-luxury-brown-200">
                    <button
                      type="button"
                      onClick={() => setWaterModalTab('allocate')}
                      className="px-4 py-2 bg-[#F4F6F9] hover:bg-slate-200 text-[#263449] border border-luxury-brown-200 font-semibold rounded-lg cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow cursor-pointer"
                    >
                      + Save Water Stock to Inventory
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSaveWaterBottle} className="space-y-3 text-xs">
                  {hasInsufficientStock && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2 text-[11px] text-rose-900">
                      <p className="font-bold">
                        ⚠️ Insufficient Water Bottle stock in Inventory! (Available: {effectiveAvailForEdit}, Requested: {requestedQty})
                      </p>
                      <p className="text-rose-700">
                        If water bottles are physically available at your hotel, please add their stock record in Inventory first.
                      </p>
                      {!editingWaterBottleRecord && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddWaterSellingRate(defaultWaterBottleRate > 0 ? defaultWaterBottleRate : '');
                            setWaterModalTab('stock');
                          }}
                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                        >
                          + Add Water Bottle Stock in Inventory →
                        </button>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-[#263449] font-bold block mb-1">Select Occupied Room *</label>
                    <select
                      required
                      value={waterRoomNo}
                      onChange={e => setWaterRoomNo(e.target.value)}
                      className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-semibold"
                    >
                      <option value="">-- Choose Occupied Room --</option>
                      {occupiedRoomsWithStay.map(r => {
                        const stay = getActiveStayForRoom(r.number);
                        return (
                          <option key={r.id} value={r.number}>
                            Room {r.number} ({r.category}) — {stay?.guestName || 'Occupied'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {waterTargetStay && (
                    <div className="bg-[#FAFBFD] border border-luxury-brown-200 rounded-xl p-2.5 text-[11px] space-y-0.5">
                      <span className="text-[10px] font-mono uppercase text-[#C49A3A] font-bold block">Active Guest Folio</span>
                      <p className="font-bold text-[#263449]">{waterTargetStay.guestName} (Stay #{waterTargetStay.id})</p>
                    </div>
                  )}

                  <div>
                    <label className="text-[#263449] font-bold block mb-1.5">Billing Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWaterIsChargeable(false)}
                        className={`py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                          !waterIsChargeable
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                        }`}
                      >
                        Complimentary (₹0)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWaterIsChargeable(true);
                          if (!(Number(waterUnitPrice) > 0) && defaultWaterBottleRate > 0) {
                            setWaterUnitPrice(defaultWaterBottleRate);
                          }
                        }}
                        className={`py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                          waterIsChargeable
                            ? 'bg-[#C49A3A] text-white border-[#a9822d] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                        }`}
                      >
                        {defaultWaterBottleRate > 0 ? `Chargeable (₹${defaultWaterBottleRate}/bottle)` : 'Chargeable (Set Rate)'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[#263449] font-bold block mb-1">Quantity (Bottles) *</label>
                      <input
                        type="number" min="1" required
                        value={waterQuantity}
                        onChange={e => setWaterQuantity(Number(e.target.value))}
                        className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[#263449] font-bold block mb-1">Rate / Bottle (₹) {waterIsChargeable ? '*' : ''}</label>
                      <input
                        type="number" min="0" step="0.5"
                        disabled={!waterIsChargeable}
                        placeholder={waterIsChargeable ? 'Enter rate (e.g. 20)' : '0'}
                        value={waterIsChargeable ? (waterUnitPrice || '') : 0}
                        onChange={e => setWaterUnitPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full bg-white border border-luxury-brown-200 rounded-lg p-2.5 text-[#263449] font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="bg-[#FAFBFD] border border-[#C49A3A]/40 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox" id="chkCharge"
                        checked={waterIsChargeable}
                        onChange={e => {
                          const checked = e.target.checked;
                          setWaterIsChargeable(checked);
                          if (checked && !(Number(waterUnitPrice) > 0) && defaultWaterBottleRate > 0) {
                            setWaterUnitPrice(defaultWaterBottleRate);
                          }
                        }}
                        className="rounded text-[#C49A3A] focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="chkCharge" className="text-[#263449] font-bold cursor-pointer">
                        Chargeable to Room Folio (₹{totalWaterCharge.toLocaleString('en-IN')})
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-600 pl-5">
                      {waterIsChargeable
                        ? `₹${totalWaterCharge.toLocaleString('en-IN')} will be synced to the guest's active room folio and final checkout invoice.`
                        : 'Complimentary: ₹0 will be charged to the guest. Will appear as Complimentary (₹0) on Guest Slip.'}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-luxury-brown-200">
                    <button type="button" onClick={() => { setShowWaterBottleModal(false); setEditingWaterBottleRecord(null); }} className="px-4 py-2 bg-[#F4F6F9] hover:bg-slate-200 text-[#263449] border border-luxury-brown-200 font-semibold rounded-lg cursor-pointer">Cancel</button>
                    <button
                      type="submit"
                      disabled={hasInsufficientStock}
                      className="px-5 py-2 bg-[#C49A3A] hover:bg-[#a9822d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow cursor-pointer"
                    >
                      {editingWaterBottleRecord ? 'Update Log Entry' : 'Save Log Entry'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* INSPECT GRC / GUEST SLIP MODAL */}
      {viewingGrc && (() => {
        const liveGrc = checkins.find(c => c.id === viewingGrc.id) || viewingGrc;
        const allocatedList: AllocatedGuestService[] = [
          ...(liveGrc.allocatedServices || []),
          ...serviceAllocationRecords
            .filter(
              r =>
                (r.checkInId === liveGrc.id || r.roomNumber === liveGrc.roomNumber) &&
                !(liveGrc.allocatedServices || []).some(s => s.id === r.id)
            )
            .map(r => ({
              id: r.id,
              requestId: r.requestId,
              hotelId: r.hotelId,
              serviceId: r.serviceId || r.id,
              serviceName: r.serviceName || 'Service',
              configuredAmount: Number(r.configuredAmount ?? r.chargeAmount ?? 0),
              chargedAmount: r.isChargeable ? Number(r.chargeAmount ?? r.configuredAmount ?? 0) : 0,
              isChargeable: Boolean(r.isChargeable),
              roomNumber: r.roomNumber,
              checkInId: liveGrc.id,
              guestName: liveGrc.guestName,
              allocatedBy: r.deliveredBy,
              dateTime: r.dateTime || r.date
            }))
        ];

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white text-gray-900 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl relative border-2 border-luxury-gold-500 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setViewingGrc(null)} className="absolute top-4 right-4 text-gray-500 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <div className="border-b pb-3">
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950">GUEST REGISTRATION SLIP (GRC)</h3>
                <p className="text-xs text-gray-500 font-mono">Ref No: {liveGrc.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Guest Name</span>
                  <p className="font-bold text-gray-900">{liveGrc.guestName}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Assigned Room</span>
                  <p className="font-bold text-luxury-gold-700 font-mono">Room {liveGrc.roomNumber}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Mobile / Phone</span>
                  <p className="font-mono text-gray-800">{liveGrc.mobile}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">ID Proof</span>
                  <p className="font-mono text-gray-800">{liveGrc.idType || 'Aadhaar'} ({liveGrc.idNumber || liveGrc.aadhaarNumber})</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">D.O.B &amp; Nationality</span>
                  <p className="font-mono text-gray-800">{liveGrc.dob || '—'} • {liveGrc.nationality || 'Indian'}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Persons (M / F / Ch) &amp; Plan</span>
                  <p className="font-mono text-gray-800">
                    {liveGrc.maleCount ?? '—'}M · {liveGrc.femaleCount ?? '—'}F · {liveGrc.childCount ?? 0}Ch | Plan: {liveGrc.mealPlan || 'EP'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Coming From → Going To</span>
                  <p className="text-gray-800">{liveGrc.comingFrom || '—'} → {liveGrc.goingTo || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Purpose of Visit</span>
                  <p className="text-gray-800">{liveGrc.purposeOfVisit || 'Leisure'}</p>
                </div>
                {(liveGrc.arrivalDateInIndia || liveGrc.durationOfStayInIndia) && (
                  <div className="col-span-2">
                    <span className="text-gray-400 uppercase text-[10px] font-bold block">Arrival Date &amp; Duration in India</span>
                    <p className="font-mono text-gray-800">{liveGrc.arrivalDateInIndia || '—'} • {liveGrc.durationOfStayInIndia || '—'}</p>
                  </div>
                )}
                {(liveGrc.travelAgentName || liveGrc.voucherNumber) && (
                  <div className="col-span-2">
                    <span className="text-gray-400 uppercase text-[10px] font-bold block">Travel Agent / Voucher No.</span>
                    <p className="font-mono text-gray-800">{liveGrc.travelAgentName || 'Direct'} {liveGrc.voucherNumber ? `(Voucher: ${liveGrc.voucherNumber})` : ''}</p>
                  </div>
                )}
              </div>

              {/* Allocated Services on Guest Slip */}
              <div className="border border-luxury-brown-200 rounded-xl overflow-hidden text-xs">
                <div className="bg-luxury-beige-100/80 px-3 py-2 border-b border-luxury-brown-200 flex justify-between items-center">
                  <span className="font-serif font-bold text-luxury-brown-950">Allocated Room Services on Guest Slip</span>
                  <span className="text-[10px] font-mono font-bold text-luxury-brown-600">{allocatedList.length} Service(s)</span>
                </div>
                {allocatedList.length > 0 ? (
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 border-b text-gray-600 font-mono uppercase text-[10px]">
                        <th className="p-2">Service Name</th>
                        <th className="p-2">Service Price</th>
                        <th className="p-2">Billing Type</th>
                        <th className="p-2 text-right">Charged to Guest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allocatedList.map(srv => (
                        <tr key={srv.id}>
                          <td className="p-2 font-bold text-gray-900">{srv.serviceName}</td>
                          <td className="p-2 font-mono text-gray-600">₹{Number(srv.configuredAmount || 0).toLocaleString()}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                srv.isChargeable ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {srv.isChargeable ? 'Chargeable' : 'Complimentary'}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-bold">
                            {srv.isChargeable ? (
                              <span className="text-amber-900">₹{Number(srv.chargedAmount || 0).toLocaleString()}</span>
                            ) : (
                              <span className="text-emerald-700">₹0 (Complimentary)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-3 text-center text-gray-400 italic text-[11px]">
                    No additional room services allocated to this stay.
                  </p>
                )}
              </div>

              {(liveGrc.idProofFileData || liveGrc.aadhaarUploadData) && (
                <div className="bg-gray-100 p-2 rounded-lg text-center border">
                  <span className="text-[10px] text-gray-500 block mb-1">Attached ID Proof Scan</span>
                  <img src={liveGrc.idProofFileData || liveGrc.aadhaarUploadData} alt="Guest ID Proof" className="max-h-40 mx-auto object-contain rounded" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = liveGrc;
                    setViewingGrc(null);
                    handleOpenEditInHouseGuest(target);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> Edit Stay Details
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintGuestGrc(liveGrc)}
                  className="px-4 py-2 bg-luxury-brown-900 text-luxury-gold-300 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print GRC
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT IN-HOUSE / WALK-IN GUEST MODAL */}
      {editingInHouseGuest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-luxury-brown-200 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl text-[#263449] max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-luxury-brown-200 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#263449]">
                  Edit Checked-In Guest / Stay / Room Transfer
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Ref: {editingInHouseGuest.id} • Current Room: Room {editingInHouseGuest.roomNumber}
                  {editGuestRoomNo !== editingInHouseGuest.roomNumber && (
                    <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                      → Transferring to Room {editGuestRoomNo}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInHouseGuest(null)}
                className="text-slate-400 hover:text-[#263449] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditInHouseGuest} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editGuestName}
                    onChange={e => setEditGuestName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={editGuestMobile}
                    onChange={e => setEditGuestMobile(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editGuestEmail}
                    onChange={e => setEditGuestEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449]"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Allocated Room (Room Transfer) *</label>
                  <select
                    required
                    value={editGuestRoomNo}
                    onChange={e => {
                      const nextRoomNo = e.target.value;
                      setEditGuestRoomNo(nextRoomNo);
                      const nextRoomObj = rooms.find(r => r.number === nextRoomNo);
                      if (nextRoomObj && nextRoomNo !== editingInHouseGuest.roomNumber) {
                        setEditGuestRoomRate(nextRoomObj.rate || editGuestRoomRate);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-bold"
                  >
                    {rooms.map(r => {
                      const isCurrent = r.number === editingInHouseGuest.roomNumber;
                      const isOcc = r.status === 'Occupied' && !isCurrent;
                      return (
                        <option key={r.number} value={r.number} disabled={isOcc}>
                          Room {r.number} — {r.category} {isCurrent ? '(Current)' : isOcc ? '(Occupied)' : `(₹${r.rate}/night)`}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">ID Document Type</label>
                  <select
                    value={editGuestIdType}
                    onChange={e => setEditGuestIdType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449]"
                  >
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Other">Other ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">ID Proof Number</label>
                  <input
                    type="text"
                    value={editGuestIdNumber}
                    onChange={e => setEditGuestIdNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Company Name (Optional GST Bill)</label>
                  <input
                    type="text"
                    value={editGuestCompanyName}
                    onChange={e => setEditGuestCompanyName(e.target.value)}
                    placeholder="Corporate / Company Name"
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449]"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Customer GSTIN Number</label>
                  <input
                    type="text"
                    value={editGuestGstNumber}
                    onChange={e => setEditGuestGstNumber(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Check-In Date *</label>
                  <input
                    type="date"
                    required
                    value={editGuestCheckInDate}
                    onChange={e => setEditGuestCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Expected Check-Out Date (Early / Extend) *</label>
                  <input
                    type="date"
                    required
                    value={editGuestCheckOutDate}
                    onChange={e => setEditGuestCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Occupants (Guests)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editGuestNumGuests}
                    onChange={e => setEditGuestNumGuests(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Agreed Room Rate / Night (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editGuestRoomRate}
                    onChange={e => setEditGuestRoomRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#C49A3A] font-mono font-bold"
                  />
                </div>
              </div>

              {/* Extra Bed / Mattress & Discount Row */}
              <div className="bg-[#FAFBFD] border border-luxury-brown-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 font-bold text-[#263449] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editGuestHasExtraBed}
                      onChange={e => setEditGuestHasExtraBed(e.target.checked)}
                      className="rounded border-luxury-brown-300 text-[#C49A3A] focus:ring-[#C49A3A]"
                    />
                    <span>Add Extra Bed / Mattress Charges</span>
                  </label>
                  {editGuestHasExtraBed && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-slate-500">Beds:</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={editGuestExtraBedCount}
                          onChange={e => setEditGuestExtraBedCount(Math.max(1, Number(e.target.value) || 1))}
                          className="w-14 px-2 py-1 bg-white border border-luxury-brown-200 rounded font-mono font-bold text-[#263449]"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-slate-500">Rate/Night (₹):</span>
                        <input
                          type="number"
                          min={0}
                          value={editGuestExtraBedRate}
                          onChange={e => setEditGuestExtraBedRate(Math.max(0, Number(e.target.value) || 0))}
                          className="w-20 px-2 py-1 bg-white border border-luxury-brown-200 rounded font-mono font-bold text-[#C49A3A]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-luxury-brown-200/60">
                  <div>
                    <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Discount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editGuestDiscount}
                      onChange={e => setEditGuestDiscount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-rose-700 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                      Advance / Amount Paid (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editHybridPay ? editSplitTotal : editGuestAdvance}
                      readOnly={editHybridPay}
                      onChange={e => setEditGuestAdvance(Math.max(0, Number(e.target.value) || 0))}
                      className={`w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-emerald-700 font-mono font-bold ${
                        editHybridPay ? 'bg-emerald-50 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Payment Mode</label>
                    {editHybridPay ? (
                      <div className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold">
                        Hybrid (Split)
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <select
                          value={editGuestPaymentMethod}
                          onChange={e => setEditGuestPaymentMethod(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449] font-bold"
                        >
                          <option value="UPI">UPI / QR Scan</option>
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="Online">Online / NEFT</option>
                          <option value="Custom">Custom / Type Manually...</option>
                        </select>
                        {editGuestPaymentMethod === 'Custom' && (
                          <input
                            type="text"
                            value={editCustomPayLabel}
                            onChange={e => setEditCustomPayLabel(e.target.value)}
                            placeholder="Type how guest paid (e.g. Paytm, Cheque, Wallet)"
                            className="w-full px-3 py-1.5 bg-white border border-[#C49A3A] rounded-lg text-xs text-[#263449] font-semibold"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hybrid / Split Payment */}
                  <div className="sm:col-span-3 space-y-2.5">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none font-bold text-[#263449] text-xs bg-[#FDF8ED] px-3 py-2 rounded-lg border border-[#C49A3A]/50">
                      <input
                        type="checkbox"
                        checked={editHybridPay}
                        onChange={e => handleToggleHybridPay(e.target.checked)}
                        className="w-4 h-4 accent-[#C49A3A] cursor-pointer"
                      />
                      Hybrid / Split Payment
                      <span className="font-normal text-slate-600">(e.g. ₹2000 Cash + baaki UPI / Card / Custom)</span>
                    </label>

                    {editHybridPay && (() => {
                      const grand = getEditGrandTotal();
                      const alreadyPaidDesk = (editingInHouseGuest.cashAmountPaid || 0) + (editingInHouseGuest.onlineAmountPaid || 0);
                      const remaining = Math.max(0, grand - alreadyPaidDesk - editSplitTotal);
                      const over = editSplitTotal + alreadyPaidDesk > grand;
                      return (
                        <div className="p-3 bg-[#FDF8ED] border border-[#C49A3A]/60 rounded-xl space-y-2.5">
                          <p className="text-[11px] text-slate-600">
                            Enter the exact amount collected from the guest across Cash, UPI, Card, Bank, or Custom payment modes below:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {SPLIT_MODES.map(m => (
                              <div key={m}>
                                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                                  {m === 'Bank' ? 'Bank / Online' : m === 'Other' ? 'Custom / Other' : m} (₹)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={editSplit[m]}
                                  placeholder="0"
                                  onChange={e =>
                                    setEditSplit(prev => ({
                                      ...prev,
                                      [m]: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0),
                                    }))
                                  }
                                  className="w-full px-2.5 py-2 bg-white border border-luxury-brown-200 rounded-lg font-mono font-bold text-[#263449]"
                                />
                              </div>
                            ))}
                          </div>
                          <div>
                            <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                              Custom Payment Mode / Detail (e.g. GPay, PhonePe, Cheque, Voucher)
                            </label>
                            <input
                              type="text"
                              value={editSplitOtherLabel}
                              onChange={e => setEditSplitOtherLabel(e.target.value)}
                              placeholder="e.g. Paytm QR / Cheque / Company Transfer..."
                              className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449]"
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                            <span className="font-bold text-emerald-800">
                              Total Paid: ₹{editSplitTotal.toLocaleString('en-IN')}
                              {SPLIT_MODES.filter(m => (Number(editSplit[m]) || 0) > 0).length > 0 && (
                                <span className="text-slate-600 font-normal">
                                  {' '}(
                                  {SPLIT_MODES.filter(m => (Number(editSplit[m]) || 0) > 0)
                                    .map(m => `${m === 'Other' ? (editSplitOtherLabel.trim() || 'Other') : m} ₹${Number(editSplit[m])}`)
                                    .join(' + ')}
                                  )
                                </span>
                              )}
                            </span>
                            <span className={`font-bold ${over ? 'text-rose-700' : remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {over
                                ? `Paid is ₹${(editSplitTotal + alreadyPaidDesk - grand).toLocaleString('en-IN')} more than the bill`
                                : remaining > 0
                                ? `Remaining: ₹${remaining.toLocaleString('en-IN')}`
                                : 'Fully paid'}
                            </span>
                          </div>
                          {remaining > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] text-slate-600 self-center font-semibold">Baaki ₹{remaining.toLocaleString('en-IN')} daalo:</span>
                              {(['Cash', 'UPI', 'Card', 'Bank'] as SplitMode[]).map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() =>
                                    setEditSplit(prev => ({ ...prev, [m]: (Number(prev[m]) || 0) + remaining }))
                                  }
                                  className="px-2.5 py-1 bg-white hover:bg-[#FBF4E0] border border-[#C49A3A]/60 rounded-lg text-[11px] font-bold text-[#263449] cursor-pointer"
                                >
                                  + {m === 'Bank' ? 'Bank / Online' : m}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">Address</label>
                <input
                  type="text"
                  value={editGuestAddress}
                  onChange={e => setEditGuestAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-[#263449]"
                />
              </div>

              {/* Live Recalculated Stay Summary (Crisp Light Luxury Card) */}
              {(() => {
                const d1 = new Date(editGuestCheckInDate);
                const d2 = new Date(editGuestCheckOutDate);
                const nights = Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) || 1);
                const roomRent = Math.max(0, Number(editGuestRoomRate) || 0) * nights;
                const extraBed = editGuestHasExtraBed
                  ? Math.max(1, Number(editGuestExtraBedCount) || 1) * Math.max(0, Number(editGuestExtraBedRate) || 0) * nights
                  : 0;
                const disc = Math.max(0, Number(editGuestDiscount) || 0);
                const sub = Math.max(0, roomRent + extraBed - disc);
                const gstPct = editingInHouseGuest.gstRate !== undefined
                  ? Number(editingInHouseGuest.gstRate)
                  : (hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 5));
                const gstAmt = Math.round((sub * gstPct) / 100);
                const grandTotal = sub + gstAmt;
                const alreadyPaid = (editingInHouseGuest.cashAmountPaid || 0) + (editingInHouseGuest.onlineAmountPaid || 0);
                const totalPaid = (editHybridPay ? editSplitTotal : Math.max(0, Number(editGuestAdvance) || 0)) + alreadyPaid;
                const netDue = Math.max(0, grandTotal - totalPaid);

                return (
                  <div className="bg-[#FFFDF7] text-[#263449] p-3.5 rounded-xl font-mono text-[11px] space-y-2 border-2 border-[#E6D9B3]">
                    <div className="flex justify-between items-center border-b border-[#E6D9B3] pb-1.5">
                      <span className="text-[#8B691E] font-bold uppercase">Live Updated Stay Summary ({nights} Night{nights > 1 ? 's' : ''})</span>
                      <span className="text-[#263449] font-bold bg-[#FBF4E0] px-2 py-0.5 rounded border border-[#E6D9B3]">Room {editGuestRoomNo}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="text-[#5A6B82] block text-[9px] uppercase font-semibold">Room + Extra Bed</span>
                        <span className="font-bold text-[#17120F]">₹{(roomRent + extraBed).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[#5A6B82] block text-[9px] uppercase font-semibold">Discount / GST ({gstPct}%)</span>
                        <span className="font-bold text-[#8B691E]">-₹{disc} / +₹{gstAmt}</span>
                      </div>
                      <div>
                        <span className="text-[#5A6B82] block text-[9px] uppercase font-semibold">Grand Total</span>
                        <span className="font-extrabold text-[#17120F] text-xs">₹{grandTotal.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[#5A6B82] block text-[9px] uppercase font-semibold">Balance Due</span>
                        <span className={`font-extrabold text-xs ${netDue > 0 ? 'text-[#D92D4B]' : 'text-[#15805D]'}`}>
                          {netDue > 0 ? `₹${netDue.toLocaleString()} Due` : '₹0 (Paid)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-luxury-brown-200">
                <button
                  type="button"
                  onClick={() => setEditingInHouseGuest(null)}
                  className="px-4 py-2 bg-[#F4F6F9] hover:bg-slate-200 text-[#263449] border border-luxury-brown-200 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => applyEditInHouseGuestChanges(true)}
                  className="px-4 py-2 bg-[#263449] hover:bg-slate-800 text-white font-bold rounded-lg shadow cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5 text-[#C49A3A]" /> Save & Open Invoice
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#C49A3A] hover:bg-[#a9822d] text-white font-bold rounded-lg shadow cursor-pointer"
                >
                  Save Updated Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT DOCUMENT MODAL */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white text-gray-900 rounded-2xl p-6 max-w-3xl w-full max-h-[92vh] flex flex-col space-y-4 shadow-2xl relative border-2 border-luxury-gold-500">
            <button onClick={() => setViewingDocument(null)} className="absolute top-4 right-4 text-gray-500 hover:text-black">
              <X className="w-5 h-5" />
            </button>
            <div className="border-b pb-2 shrink-0">
              <h3 className="text-base font-serif font-bold text-luxury-brown-950">{viewingDocument.title}</h3>
              <p className="text-xs text-gray-500 font-mono">{viewingDocument.guestName} • Room {viewingDocument.roomNumber}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border overflow-y-auto min-h-[180px]" id="front-desk-doc-preview">
              <DocumentPreviewBody doc={viewingDocument} hotelSettings={hotelSettings} />
            </div>

            <div className="flex justify-end pt-2 shrink-0">
              <button onClick={() => printPreviewElement('front-desk-doc-preview', viewingDocument.title)} className="px-4 py-2 bg-luxury-brown-900 text-luxury-gold-300 font-bold text-xs rounded-lg flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Print Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-OUT CONFIRMATION & ROOM DAMAGE / FINE INSPECTION MODAL */}
      {checkoutConfirmGuest && (() => {
        const calc = computeConfirmGuestFinancials(checkoutConfirmGuest, Number(coDamageAmount) || 0);
        const halfGstRate = (calc.gstRate / 2).toFixed(1).replace(/\.0$/, '');
        const halfGstAmt = calc.cgst;
        const activeCollectAmount = coHybridPay
          ? coSplitTarget === 'checkout'
            ? coSplitTotal
            : 0
          : coMarkPaid && !coPayAmountTouched
          ? calc.balanceDue
          : coPayAmountTouched
          ? coPayAmount
          : 0;
        const effectiveAlreadyPaidPreview =
          coHybridPay && coSplitTarget === 'advance' && coSplitTotal > 0 ? coSplitTotal : calc.alreadyPaid;
        const effectiveBalanceBeforeSettle = Math.max(0, r2(calc.grandTotal - effectiveAlreadyPaidPreview));
        const remainingDueAfterCollect = Math.max(0, r2(effectiveBalanceBeforeSettle - (Number(activeCollectAmount) || 0)));
        const isFullySettledChecked = effectiveBalanceBeforeSettle <= 0 || remainingDueAfterCollect <= 0;
        const liveCoModeLabel = coHybridPay
          ? SPLIT_MODES.filter(m => (Number(coSplit[m]) || 0) > 0)
              .map(m => `${m === 'Other' ? (coSplitOtherLabel.trim() || 'Other') : m} ₹${Number(coSplit[m])}`)
              .join(' + ') || 'Hybrid Split'
          : coPayMethod === 'Custom'
          ? coCustomPayLabel.trim() || 'Custom'
          : coPayMethod;
        const activeConditions = normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
          ...hotelSettings,
          isGstEnabled: hotelSettings?.isGstEnabled ?? true,
          defaultGstRate: calc.gstRate
        });
        const matchedBookingForEval =
          bookings.find(
            b =>
              b.id === checkoutConfirmGuest.id ||
              ((checkoutConfirmGuest as any).bookingId && b.id === (checkoutConfirmGuest as any).bookingId)
          ) || null;
        const liveEval = evaluateAndBuildInvoice({
          hotelId: checkoutConfirmGuest.hotelId || hotelSettings?.id || selectedHotelId,
          hotelSettings,
          booking: matchedBookingForEval
            ? { ...matchedBookingForEval, isCheckedIn: false, isCompleted: true, status: 'CheckedOut' as any }
            : null,
          checkin: {
            ...checkoutConfirmGuest,
            checkedOutDateTime: new Date().toISOString()
          },
          rooms,
          posOrders,
          waterBottles,
          existingInvoices: invoices,
          conditions: activeConditions,
          isManualAction: false,
          isCheckoutTrigger: true,
          allowUpdateExistingFinalOnCheckout: true,
          overrideDiscount: calc.discountVal,
          overrideGstRate: calc.gstRate,
          ...('paid' in coOv || (coHybridPay && coSplitTarget === 'advance' && coSplitTotal > 0)
            ? { overrideAdvancePaid: effectiveAlreadyPaidPreview + (Number(activeCollectAmount) || 0) }
            : { additionalSettlementNow: Number(activeCollectAmount) || 0 }),
          ...(coOvNum(coOv, 'room') !== undefined ? { overrideRoomCharges: calc.roomCharges } : {}),
          ...(coOvNum(coOv, 'extraBed') !== undefined ? { overrideExtraBedCharges: calc.extraBedTotal } : {}),
          ...(coOvNum(coOv, 'extraPerson') !== undefined ? { overrideExtraPersonCharges: calc.extraPersonTotal } : {}),
          ...(coOvNum(coOv, 'food') !== undefined ? { overrideFoodCharges: calc.foodSum } : {}),
          ...(coOvNum(coOv, 'water') !== undefined ? { overrideWaterOrLaundryCharges: calc.laundrySum } : {}),
          overridePaymentMethod: liveCoModeLabel as any,
          invoiceType: 'Tax Invoice'
        });

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
            <div className="bg-white rounded-2xl max-w-2xl w-full border-2 border-[#C49A3A] shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Header (Clean Light Luxury Surface — crisp dark text & close button) */}
              <div className="bg-[#FFF9EB] text-[#17120F] p-5 flex justify-between items-center border-b-2 border-[#E6D9B3] gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#D92D4B]/15 border border-[#D92D4B]/35 rounded-xl text-[#D92D4B]">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-[#17120F]">
                      Check-Out Confirmation & Room Damage / Fine Inspection
                    </h3>
                    <p className="text-[11px] font-mono font-bold text-[#8B691E] mt-0.5">
                      Room {checkoutConfirmGuest.roomNumber} • {checkoutConfirmGuest.guestName} ({checkoutConfirmGuest.mobile})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutConfirmGuest(null)}
                    className="text-[#263449] hover:text-[#17120F] hover:bg-amber-100/80 p-1.5 rounded-lg cursor-pointer transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {/* 8-Condition Invoice Verification Strip on Check-Out */}
                <div className="bg-[#FDF8ED] border border-[#C49A3A]/60 rounded-xl p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-[#C49A3A]" />
                      <span className="font-serif font-bold text-[#263449] text-xs">
                        Invoice Conditions (8 Rules Verified on Check-Out)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-mono text-[10px] font-bold">
                      CGST {halfGstRate}% + SGST {halfGstRate}% = {calc.gstRate}% ({coOv.gst !== undefined ? 'Custom' : 'Auto from Settings'})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    {liveEval.conditionResults
                      .slice()
                      .sort((a, b) => a.conditionNumber - b.conditionNumber)
                      .map(cond => (
                        <div
                          key={cond.conditionNumber}
                          className={`px-2 py-1 rounded border text-[10px] font-mono flex items-center gap-1 ${
                            cond.passed
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                              : 'bg-rose-50 border-rose-200 text-rose-800 font-bold'
                          }`}
                          title={cond.reason}
                        >
                          <span>{cond.passed ? '✓' : '✕'}</span>
                          <span className="truncate">
                            #{cond.conditionNumber} {cond.conditionName.replace(/ Condition$/i, '')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* 1. Room Inspection Checklist */}
                <div className="bg-[#FAFBFD] border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#263449] block">
                    1. Pre-Departure Room Inspection Checklist
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer font-semibold text-[#263449]">
                      <input
                        type="checkbox"
                        checked={coRoomInspected}
                        onChange={e => setCoRoomInspected(e.target.checked)}
                        className="w-4 h-4 accent-[#15805D]"
                      />
                      <span>Room Inspected</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer font-semibold text-[#263449]">
                      <input
                        type="checkbox"
                        checked={coMinibarVerified}
                        onChange={e => setCoMinibarVerified(e.target.checked)}
                        className="w-4 h-4 accent-[#15805D]"
                      />
                      <span>Keys & Water Checked</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer font-semibold text-[#263449]">
                      <input
                        type="checkbox"
                        checked={coLinenVerified}
                        onChange={e => setCoLinenVerified(e.target.checked)}
                        className="w-4 h-4 accent-[#15805D]"
                      />
                      <span>Linen & Appliances OK</span>
                    </label>
                  </div>
                </div>

                {/* 2. Room Damage / Tod-Phod Fine Box */}
                <div className={`p-4 rounded-xl border-2 space-y-3 transition-all ${coHasDamageFine ? 'bg-rose-50/85 border-rose-300' : 'bg-[#FFFDF7] border-[#C49A3A]/50'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200/60 pb-2.5">
                    <div>
                      <h4 className="font-serif font-bold text-[#17120F] text-sm flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-[#D92D4B]" /> 2. Room Damage & Breakage Fine Box
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        If any room property was damaged or broken during the stay, add the applicable fine below:
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCoHasDamageFine(false);
                          setCoDamageDesc('');
                          setCoDamageAmount(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold border cursor-pointer transition-all ${
                          !coHasDamageFine
                            ? 'bg-[#15805D] text-white border-[#15805D] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                        }`}
                      >
                        ✓ Room OK (₹0 Fine)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoHasDamageFine(true)}
                        className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold border cursor-pointer transition-all ${
                          coHasDamageFine
                            ? 'bg-[#D92D4B] text-white border-[#D92D4B] shadow-xs'
                            : 'bg-white text-[#D92D4B] border-rose-300 hover:bg-rose-50'
                        }`}
                      >
                        ⚠️ Add Damage Fine
                      </button>
                    </div>
                  </div>

                  {/* Quick Fine Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                      Quick Damage / Fine Presets (Click to Fill):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Broken Glass / Crockery', amt: 500 },
                        { label: 'Bed Sheet / Towel Stain', amt: 800 },
                        { label: 'Room Key / Card Lost', amt: 500 },
                        { label: 'TV / Remote / AC Damage', amt: 2000 },
                        { label: 'Smoking / Property Fine', amt: 1500 },
                      ].map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setCoHasDamageFine(true);
                            setCoDamageDesc(preset.label);
                            setCoDamageAmount(preset.amt);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[10.5px] font-mono font-bold transition cursor-pointer"
                        >
                          + {preset.label} (₹{preset.amt})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Fine Description + Amount Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                    <div className="sm:col-span-6 space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-rose-900 block">
                        Damaged Item / Fine Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Broken Glass, Towel Stain, Key Lost..."
                        value={coDamageDesc}
                        onChange={e => {
                          setCoDamageDesc(e.target.value);
                          if (e.target.value.trim()) setCoHasDamageFine(true);
                        }}
                        className="w-full px-3 py-2 border border-rose-300 rounded-lg bg-white text-xs text-[#17120F] font-medium focus:outline-none focus:border-[#D92D4B]"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-rose-900 block">
                        Fine Amount (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="₹0"
                        value={coDamageAmount || ''}
                        onChange={e => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setCoDamageAmount(val);
                          if (val > 0) setCoHasDamageFine(true);
                        }}
                        className="w-full px-3 py-2 border border-rose-300 rounded-lg bg-white text-xs font-mono font-extrabold text-[#D92D4B] focus:outline-none focus:border-[#D92D4B]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddFineToConfirmGuest}
                        className="w-full px-3 py-2 bg-[#D92D4B] hover:bg-[#B4223B] text-white font-mono font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add to Bill
                      </button>
                    </div>
                  </div>

                  {/* List of added Fines / Extra Charges */}
                  {(checkoutConfirmGuest.extraCharges || []).filter(ec => Number(ec.amount) > 0).length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-1">
                        Logged Extra Charges & Damage Fines on Bill:
                      </span>
                      <div className="border border-rose-200 rounded-lg bg-white divide-y divide-slate-100 max-h-28 overflow-y-auto">
                        {(checkoutConfirmGuest.extraCharges || [])
                          .filter(ec => Number(ec.amount) > 0)
                          .map(ec => (
                            <div key={ec.id} className="px-3 py-1.5 flex justify-between items-center text-xs">
                              <div>
                                <span className="font-mono font-bold text-[#D92D4B] text-[10px] uppercase mr-2">
                                  [{ec.category || 'Charge'}]
                                </span>
                                <span className="font-medium text-[#263449]">{ec.description}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#17120F]">₹{Number(ec.amount).toLocaleString('en-IN')}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChargeFromConfirmGuest(ec.id)}
                                  className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                  title="Remove Charge"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bill Adjustments: same editable fields as "Edit Invoice" */}
                <div className="bg-[#FDF8ED] border border-[#C49A3A]/60 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C49A3A]/30 pb-2">
                    <div>
                      <h4 className="font-serif font-bold text-[#17120F] text-sm">Bill Adjustments (edit before generating invoice)</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Amounts are pre-filled automatically. Change any value to edit the final bill.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoOv({})}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#263449] border border-slate-300 rounded-lg font-bold text-[11px] cursor-pointer"
                    >
                      Reset to Auto
                    </button>
                  </div>

                  {/* With GST vs No GST Switch (Locked if stay invoice already exists) */}
                  {(() => {
                    const existingStayInv = invoices.find(
                      inv =>
                        !inv.isSeparateInvoice &&
                        (inv.bookingId === checkoutConfirmGuest.id || inv.checkInId === checkoutConfirmGuest.id)
                    );
                    if (existingStayInv) {
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-mono uppercase font-bold text-amber-950">
                              🔒 Locked Invoice Tax Mode ({existingStayInv.invoiceNumber})
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border ${
                                calc.gstRate > 0
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {calc.gstRate > 0 ? `With GST (${calc.gstRate}%)` : 'No GST (0% Bill)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900">
                            GST cannot be edited on an already-generated invoice. Complete checkout here, and generate a separate invoice from Billing &amp; Invoices if another GST mode is needed.
                          </p>
                        </div>
                      );
                    }
                    const defaultRoomGst = Number(hotelSettings?.defaultGstRate ?? 5) || 5;
                    return (
                      <div className="p-3 bg-white border border-[#C49A3A]/40 rounded-xl">
                        <label className="flex items-center justify-between gap-3 cursor-pointer">
                          <span className="flex items-center gap-2 font-bold text-xs text-[#263449]">
                            <input
                              type="checkbox"
                              checked={calc.gstRate > 0}
                              onChange={e => {
                                setCoOv(prev => ({
                                  ...prev,
                                  gst: e.target.checked ? String(defaultRoomGst) : '0',
                                }));
                              }}
                              className="w-4 h-4 accent-[#15805D] rounded cursor-pointer"
                            />
                            GST Invoice ({defaultRoomGst}% Room GST from Settings)
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border ${
                              calc.gstRate > 0
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            {calc.gstRate > 0 ? `Tax Invoice (${calc.gstRate}%)` : 'Bill of Supply (0% GST)'}
                          </span>
                        </label>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      ['room', '1. Room Rent Total (₹)', calc.roomCharges],
                      ['extraBed', '2. Extra Bed / Mattress (₹)', calc.extraBedTotal],
                      ['extraPerson', 'Extra Person / Guest Charges (₹)', calc.extraPersonTotal],
                      ['food', '3. Food / Restaurant (₹)', calc.foodSum],
                      ['water', '4. Water / Laundry / Services (₹)', calc.laundrySum],
                      ['discount', 'Less: Discount (₹)', calc.discountVal],
                      ['paid', 'Advance / Paid Amount (₹)', calc.alreadyPaid]
                    ] as [string, string, number][]).map(([key, label, autoVal]) => (
                      <div key={key}>
                        <label className="text-[10px] font-mono uppercase font-bold text-[#263449] block mb-1">{label}</label>
                        <input
                          type="number"
                          min={0}
                          step={key === 'gst' ? '0.5' : '1'}
                          value={key in coOv ? coOv[key] : String(autoVal)}
                          onChange={e => setCoOv(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-sm text-[#263449]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {/* 3. Live Final Bill & GST Summary (Clean High-Contrast Light Luxury Card — Zero Invisible White Text) */}
                <div className="bg-[#FFFDF7] text-[#263449] p-4 rounded-xl border-2 border-[#E6D9B3] space-y-2 font-mono text-xs shadow-2xs">
                  <div className="flex justify-between items-center border-b border-[#E6D9B3] pb-2">
                    <span className="text-[#8B691E] font-serif font-bold text-xs uppercase">
                      3. Final Bill & GST Summary ({calc.nights} Night{calc.nights > 1 ? 's' : ''})
                    </span>
                    <span className="text-[11px] font-bold text-[#263449] bg-[#FBF4E0] px-2.5 py-0.5 rounded border border-[#E6D9B3]">
                      Room {checkoutConfirmGuest.roomNumber}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11.5px]">
                    <div className="flex justify-between">
                      <span className="text-[#3E5068] font-semibold">Room Tariff Charges:</span>
                      <span className="font-bold text-[#17120F]">₹{calc.roomCharges.toLocaleString('en-IN')}</span>
                    </div>
                    {calc.extraBedTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#3E5068] font-semibold">Extra Bed Charges:</span>
                        <span className="font-bold text-[#17120F]">₹{calc.extraBedTotal.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {calc.extraPersonTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#3E5068] font-semibold">Extra Person / Guest Charges:</span>
                        <span className="font-bold text-[#17120F]">₹{calc.extraPersonTotal.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {calc.earlyCheckInTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#3E5068] font-semibold">Early Check-In Charges:</span>
                        <span className="font-bold text-[#17120F]">₹{calc.earlyCheckInTotal.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {(calc.foodSum > 0 || calc.laundrySum > 0 || calc.otherExtrasSum > 0) && (
                      <div className="flex justify-between">
                        <span className="text-[#3E5068] font-semibold">Food / Laundry / Room Services:</span>
                        <span className="font-bold text-[#17120F]">₹{(calc.foodSum + calc.laundrySum + calc.otherExtrasSum).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[#D92D4B]">
                      <span>Room Damage / Fine Penalty:</span>
                      <span>₹{calc.damageSum.toLocaleString('en-IN')}</span>
                    </div>
                    {calc.discountVal > 0 && (
                      <div className="flex justify-between text-[#15805D] font-bold">
                        <span>Less: Discount:</span>
                        <span>-₹{calc.discountVal.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[#E6D9B3] pt-1.5 font-bold text-[#17120F]">
                      <span>Taxable Subtotal:</span>
                      <span>₹{calc.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {calc.gstRate > 0 ? (
                      <>
                        <div className="flex justify-between text-[#3E5068] font-semibold">
                          <span>Add: CGST ({halfGstRate}%):</span>
                          <span className="text-[#17120F] font-bold">₹{halfGstAmt.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-[#3E5068] font-semibold">
                          <span>Add: SGST ({halfGstRate}%):</span>
                          <span className="text-[#17120F] font-bold">₹{halfGstAmt.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-[#8B691E] font-bold">
                          <span>Total GST ({calc.gstRate}% = CGST + SGST):</span>
                          <span>₹{calc.gstAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-[#8B691E] font-bold">
                        Without GST Active — Printed as ROOM BILL (₹0 Tax)
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-extrabold text-[#17120F] border-t-2 border-[#D4AD50] pt-1.5">
                      <span>Grand Total Invoice Amount:</span>
                      <span>₹{calc.grandTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-[#15805D] font-bold">
                      <span>Less: Advance / Already Paid:</span>
                      <span>-₹{effectiveAlreadyPaidPreview.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold border-t border-[#E6D9B3] pt-1.5 text-[#8B691E]">
                      <span>Outstanding Before Settlement:</span>
                      <span>₹{effectiveBalanceBeforeSettle.toLocaleString('en-IN')}</span>
                    </div>
                    {Number(activeCollectAmount) > 0 && (
                      <div className="flex justify-between text-[#15805D] font-bold">
                        <span>Collecting Now ({liveCoModeLabel}):</span>
                        <span>-₹{Number(activeCollectAmount).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div
                      className={`flex justify-between text-sm font-extrabold border-t border-[#E6D9B3] pt-1.5 ${
                        remainingDueAfterCollect <= 0 ? 'text-[#15805D]' : 'text-[#D92D4B]'
                      }`}
                    >
                      <span>Remaining Balance After Check-Out:</span>
                      <span>
                        ₹{remainingDueAfterCollect.toLocaleString('en-IN')}{' '}
                        {remainingDueAfterCollect <= 0 ? '(Fully Paid)' : '(Due)'}
                      </span>
                    </div>
                  </div>
                </div>

                <label
                  className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer font-bold ${
                    isFullySettledChecked
                      ? 'bg-emerald-50 border-emerald-200 text-[#15805D]'
                      : 'bg-amber-50/70 border-amber-200 text-[#263449]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isFullySettledChecked}
                    onChange={e => {
                      const nextChecked = e.target.checked;
                      setCoMarkPaid(nextChecked);
                      if (nextChecked) {
                        setCoPayAmount(calc.balanceDue);
                        setCoPayAmountTouched(false);
                      } else {
                        setCoPayAmount(0);
                        setCoPayAmountTouched(true);
                      }
                    }}
                    className="w-4 h-4 accent-[#15805D]"
                  />
                  <span>
                    Mark Bill as Fully Paid (₹0 Due)
                    {effectiveBalanceBeforeSettle > 0 && !isFullySettledChecked
                      ? ` — Collect ₹${effectiveBalanceBeforeSettle.toLocaleString('en-IN')} to clear`
                      : ''}
                  </span>
                </label>

                {/* 4. Final Payment Collection & Hybrid Split Payment */}
                <div className="bg-[#FAFBFD] p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-mono uppercase font-bold text-[#263449]">
                      4. Check-Out Settlement &amp; Hybrid Payment Mode
                    </span>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FDF8ED] hover:bg-[#FBF4E0] border border-[#C49A3A] rounded-lg cursor-pointer select-none font-bold text-[#17120F] text-xs shadow-2xs">
                      <input
                        type="checkbox"
                        checked={coHybridPay}
                        onChange={e => {
                          const on = e.target.checked;
                          setCoHybridPay(on);
                          if (on) {
                            const useAdv = calc.balanceDue <= 0 && calc.alreadyPaid > 0;
                            setCoSplitTarget(useAdv ? 'advance' : 'checkout');
                            const seedAmt = useAdv ? calc.alreadyPaid : (Number(activeCollectAmount) || calc.balanceDue || 0);
                            const modeKey = normalizeSplitMode(coPayMethod === 'Custom' ? 'Other' : coPayMethod);
                            const next: Record<SplitMode, number | ''> = { ...emptySplit };
                            if (seedAmt > 0) next[modeKey] = seedAmt;
                            setCoSplit(next);
                          }
                        }}
                        className="w-4 h-4 accent-[#C49A3A] cursor-pointer"
                      />
                      <span>Hybrid / Split Payment (Cash + UPI + Card + Custom)</span>
                    </label>
                  </div>

                  {!coHybridPay ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono uppercase font-bold text-[#263449] block mb-1">
                          Amount Collected at Check-Out (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={activeCollectAmount}
                          onChange={e => {
                            const val = Math.max(0, r2(Number(e.target.value) || 0));
                            setCoPayAmountTouched(true);
                            setCoPayAmount(val);
                            setCoMarkPaid(calc.balanceDue <= 0 || val >= r2(calc.balanceDue));
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-sm text-[#15805D]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono uppercase font-bold text-[#263449] block mb-1">
                          Settlement Payment Mode
                        </label>
                        <select
                          value={coPayMethod}
                          onChange={e => setCoPayMethod(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold text-xs text-[#263449]"
                        >
                          <option value="UPI">UPI / QR Scan</option>
                          <option value="Cash">Cash</option>
                          <option value="Card">Debit / Credit Card</option>
                          <option value="Bank">Bank Transfer / NEFT</option>
                          <option value="Custom">Custom / Type Manually...</option>
                        </select>
                        {coPayMethod === 'Custom' && (
                          <input
                            type="text"
                            value={coCustomPayLabel}
                            onChange={e => setCoCustomPayLabel(e.target.value)}
                            placeholder="Type how guest paid (e.g. Paytm, Cheque, Wallet)"
                            className="w-full px-3 py-2 border border-[#C49A3A] rounded-lg bg-white text-xs text-[#263449] font-semibold"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const targetAmount = coSplitTarget === 'advance' ? (calc.alreadyPaid || calc.grandTotal) : calc.balanceDue;
                      const splitRemaining = Math.max(0, r2(targetAmount - coSplitTotal));
                      return (
                        <div className="p-3.5 bg-[#FDF8ED] border border-[#C49A3A]/60 rounded-xl space-y-3">
                          {calc.alreadyPaid > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10.5px] font-bold text-[#263449]">Split Kis Amount Par Lagana Hai:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCoSplitTarget('checkout');
                                  const next: Record<SplitMode, number | ''> = { ...emptySplit };
                                  if (calc.balanceDue > 0) next.Cash = calc.balanceDue;
                                  setCoSplit(next);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                                  coSplitTarget === 'checkout'
                                    ? 'bg-[#F5E3B8] border-[#C49A3A] text-[#17120F]'
                                    : 'bg-white border-slate-300 text-slate-600'
                                }`}
                              >
                                Check-Out Balance (₹{calc.balanceDue.toLocaleString('en-IN')})
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCoSplitTarget('advance');
                                  const next: Record<SplitMode, number | ''> = { ...emptySplit };
                                  if (calc.alreadyPaid > 0) next.Cash = calc.alreadyPaid;
                                  setCoSplit(next);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                                  coSplitTarget === 'advance'
                                    ? 'bg-[#F5E3B8] border-[#C49A3A] text-[#17120F]'
                                    : 'bg-white border-slate-300 text-slate-600'
                                }`}
                              >
                                Already Paid / Total Paid (₹{calc.alreadyPaid.toLocaleString('en-IN')})
                              </button>
                            </div>
                          )}

                          <p className="text-[11px] text-slate-600">
                            Guest ne jitna Cash, UPI, Card, Bank ya Custom mode se diya hai wo alag-alag bharein (e.g. Cash ₹2000 + baaki UPI):
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {SPLIT_MODES.map(m => (
                              <div key={m}>
                                <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                                  {m === 'Bank' ? 'Bank / Online' : m === 'Other' ? 'Custom / Other' : m} (₹)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={coSplit[m]}
                                  placeholder="0"
                                  onChange={e =>
                                    setCoSplit(prev => ({
                                      ...prev,
                                      [m]: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0),
                                    }))
                                  }
                                  className="w-full px-2.5 py-2 bg-white border border-luxury-brown-200 rounded-lg font-mono font-bold text-[#263449]"
                                />
                              </div>
                            ))}
                          </div>

                          <div>
                            <label className="block text-[#263449] font-bold uppercase font-mono text-[10px] mb-1">
                              Custom Payment Mode / Detail (e.g. GPay, PhonePe, Cheque, Company Account)
                            </label>
                            <input
                              type="text"
                              value={coSplitOtherLabel}
                              onChange={e => setCoSplitOtherLabel(e.target.value)}
                              placeholder="Type payment mode or note (e.g. 2000 Cash + remaining via PhonePe QR)"
                              className="w-full px-3 py-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-[#263449]"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono pt-1 border-t border-[#E6D9B3]">
                            <span className="font-bold text-[#15805D]">
                              Split Total: ₹{coSplitTotal.toLocaleString('en-IN')}
                              {SPLIT_MODES.filter(m => (Number(coSplit[m]) || 0) > 0).length > 0 && (
                                <span className="text-slate-600 font-normal">
                                  {' '}({liveCoModeLabel})
                                </span>
                              )}
                            </span>
                            <span className={`font-bold ${splitRemaining > 0 ? 'text-amber-700' : 'text-[#15805D]'}`}>
                              {splitRemaining > 0
                                ? `Baaki ₹${splitRemaining.toLocaleString('en-IN')} bacha hai`
                                : '✓ Full Amount Split Matched'}
                            </span>
                          </div>

                          {splitRemaining > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] text-slate-600 self-center font-semibold">
                                Baaki ₹{splitRemaining.toLocaleString('en-IN')} seedha daalo:
                              </span>
                              {(['Cash', 'UPI', 'Card', 'Bank'] as SplitMode[]).map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() =>
                                    setCoSplit(prev => ({ ...prev, [m]: r2((Number(prev[m]) || 0) + splitRemaining) }))
                                  }
                                  className="px-2.5 py-1 bg-white hover:bg-[#FBF4E0] border border-[#C49A3A]/70 rounded-lg text-[11px] font-bold text-[#263449] cursor-pointer"
                                >
                                  + {m === 'Bank' ? 'Bank / Online' : m}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#FAFBFD] px-5 py-4 border-t border-slate-200 flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCheckoutConfirmGuest(null)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-[#263449] border border-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFinalCheckOut}
                  className="px-5 py-2.5 bg-[#15805D] hover:bg-[#11694B] text-white rounded-xl font-serif font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm Check-Out & Generate Final Invoice
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editingCheckedOutGuest && (
        <EditCheckoutModal
          guest={editingCheckedOutGuest}
          rooms={rooms}
          bookings={bookings}
          checkins={checkins}
          invoices={invoices}
          posOrders={posOrders}
          waterBottles={waterBottles}
          hotelSettings={hotelSettings}
          loggedInUser={loggedInUser}
          onUpdateCheckins={onUpdateCheckins}
          onUpdateBookings={onUpdateBookings}
          onUpdateInvoices={onUpdateInvoices}
          onAddAuditLog={onAddAuditLog}
          onClose={() => setEditingCheckedOutGuest(null)}
        />
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
