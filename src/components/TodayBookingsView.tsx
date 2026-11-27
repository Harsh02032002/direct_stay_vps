import React, { useState } from 'react';
import {
  HybridSplitPaymentBox,
  HybridSplitRow,
  createInitialHybridRows,
  getValidHybridSplits,
  formatHybridLabel,
} from './HybridSplitPaymentBox';
import { Booking, GuestCheckIn, Room, Staff, Invoice, HotelSettings, PaymentRecord, ExtraCharge, RoomUpgradeRecord, RoomStatus, DeletedItemRecord } from '../types';
import { 
  FileText, UserCheck, UserX, User, Printer, Phone, Calendar, 
  ArrowRight, Eye, Sparkles, X, Search, Filter, Pencil, 
  BookOpen, Clock, ShieldCheck, DollarSign, HelpCircle, 
  RefreshCw, Check, Home, Key, MapPin, Receipt, Shield, Plus, Trash2, CreditCard,
  ArrowUpRight, TrendingUp, Layers, FileCheck2, Users, LogOut, XCircle,
  BedDouble, CalendarDays, Utensils, Sliders, Ban
} from 'lucide-react';
import { showToast } from '../utils/toast';
import { evaluateAndBuildInvoice, normalizeInvoiceConditions, deduplicateInvoicesByBooking } from '../utils/invoiceConditions';
import { buildGuestGrcHtml, invoiceRecordToPrintHtml } from '../utils/pdfDownload';
import { openPrintWindow } from '../utils/printDocument';
import InvoiceConditionsModal from './InvoiceConditionsModal';
import CalendarBookingView from './CalendarBookingView';

const PREFERRED_CATEGORY_ORDER = ['Deluxe', 'Executive', 'Family Room', 'Family', 'Standard', 'Premium Standard'];

const normalizeCategory = (cat?: string): string => {
  if (!cat) return 'Standard';
  const trimmed = cat.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'delux' || lower === 'deluxe' || lower === 'super dilux' || lower === 'super deluxe') return 'Deluxe';
  if (lower === 'premium standard' || lower === 'premium standard room') return 'Premium Standard';
  if (lower === 'executive' || lower === 'executive room' || lower === 'executive suite') return 'Executive';
  if (lower === 'standard' || lower === 'standard room') return 'Standard';
  if (lower === 'family' || lower === 'family room' || lower === 'family suite' || lower === 'familyroom') return 'Family Room';
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

interface TodayBookingsViewProps {
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  staff: Staff[];
  invoices?: Invoice[];
  hotelSettings?: HotelSettings;
  onUpdateHotelSettings?: (settings: HotelSettings) => void;
  onCheckIn: (booking: Booking) => void;
  onCheckOut: (booking: Booking) => void;
  onUpdateBookings?: (bookings: Booking[]) => void;
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  onUpdateRooms?: (rooms: Room[]) => void;
  onUpdateInvoices?: (invoices: Invoice[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
  onMoveToDeletedFolder?: (item: Omit<DeletedItemRecord, 'id' | 'deletedAt' | 'deletedBy'>) => void;
}

export default function TodayBookingsView({
  rooms,
  bookings = [],
  checkins = [],
  staff = [],
  invoices = [],
  hotelSettings,
  onUpdateHotelSettings,
  onCheckIn,
  onCheckOut,
  onUpdateBookings,
  onUpdateCheckins,
  onUpdateRooms,
  onUpdateInvoices,
  onAddAuditLog,
  onMoveToDeletedFolder
}: TodayBookingsViewProps) {
  // PMS Master Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [isConditionsModalOpen, setIsConditionsModalOpen] = useState(false);

  // Front Desk Dashboard Room Rack & Matrix Tabs (Requested by User)
  const [dashboardMainTab, setDashboardMainTab] = useState<'rack' | 'matrix'>('rack');
  const [rackStatusFilter, setRackStatusFilter] = useState<'All' | 'Available' | 'Occupied' | 'Booked' | 'Dirty' | 'Blocked'>('All');
  const [bookingScopeMode, setBookingScopeMode] = useState<'today' | 'all'>('today');

  const liveTodayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const currentMonthPrefix = liveTodayStr.substring(0, 7);

  // Full Date-Wise Filter (All, Today, Yesterday, Date, This Month, Range)
  const [dateFilterType, setDateFilterType] = useState<'All' | 'Today' | 'Yesterday' | 'Date' | 'This Month' | 'Range'>('Today');
  const [filterSingleDate, setFilterSingleDate] = useState<string>(liveTodayStr);
  const [filterStartDate, setFilterStartDate] = useState<string>(liveTodayStr);
  const [filterEndDate, setFilterEndDate] = useState<string>(liveTodayStr);

  const isBookingActiveTodayOnRack = (b: Booking, roomNum: string): boolean => {
    const matchesRoom =
      b.roomNumber === roomNum || (b.bookedRooms || []).some(br => br.roomNumber === roomNum);
    if (!matchesRoom) return false;
    const st = String(b.status || '').toLowerCase();
    if (b.status === 'Cancelled' || st === 'cancelled' || b.isCompleted || st === 'checkedout' || st === 'checked out') {
      return false;
    }
    if (b.isCheckedIn || b.status === 'Checked In') return true;
    const activeStatuses = ['Confirmed', 'Advance', 'In Process', 'Pending'];
    if (!activeStatuses.includes(b.status as string)) return false;
    // Future advance bookings (> today) must NOT mark the room Booked today!
    if (b.checkInDate && b.checkInDate > liveTodayStr) return false;
    if (b.checkOutDate && b.checkOutDate < liveTodayStr) return false;
    return true;
  };

  const getRoomOccupancyStatus = (room: Room): 'Available' | 'Occupied' | 'Booked' | 'Dirty' | 'Blocked' => {
    if (room.status === 'Dirty' || room.cleaningStatus === 'Dirty') return 'Dirty';
    if (room.status === 'Blocked' || room.status === 'Maintenance' || (room as any).status === 'Out of Service') return 'Blocked';
    const activeInHouse = checkins.find(
      c => !c.checkedOutDateTime && (c.roomNumber === room.number || (c.bookedRooms || []).some(br => br.roomNumber === room.number))
    );
    if (activeInHouse) return 'Occupied';
    const activeBooking = bookings.find(b => isBookingActiveTodayOnRack(b, room.number));
    if (activeBooking) {
      if (activeBooking.isCheckedIn || activeBooking.status === 'Checked In') return 'Occupied';
      return 'Booked';
    }
    if (room.status === 'Occupied') return 'Occupied';
    return 'Available';
  };

  const getRoomActiveBooking = (room: Room) => {
    return bookings.find(b => isBookingActiveTodayOnRack(b, room.number));
  };

  const handleCleanRoomUnit = (roomNumber: string) => {
    if (onUpdateRooms) {
      const updated = rooms.map(r => r.number === roomNumber ? { ...r, status: 'Available' as RoomStatus, cleaningStatus: 'Clean' as any } : r);
      onUpdateRooms(updated);
      showToast(`Room ${roomNumber} marked Clean & Available!`, 'success');
      if (onAddAuditLog) onAddAuditLog('Housekeeping Complete', `Room ${roomNumber} cleaned & released to Available.`);
    }
  };
  
  // Modals state
  const [selectedGuestDetails, setSelectedGuestDetails] = useState<GuestCheckIn | null>(null);
  const [selectedPrintBooking, setSelectedPrintBooking] = useState<Booking | null>(null);
  
  // Edit Booking Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEditBooking, setSelectedEditBooking] = useState<Booking | null>(null);
  const [editForm, setEditForm] = useState({
    guestName: '',
    mobile: '',
    aadhaarNumber: '',
    address: '',
    roomNumber: '',
    roomType: '',
    checkInDate: '',
    checkOutDate: '',
    advanceAmount: 0,
    bookingAmount: 0, // Maps to rooms rate * nights
    bookingSource: 'Walk-in' as any,
    paymentMethod: 'Cash' as any,
    status: 'Confirmed' as any,
    email: '',
    adults: 1,
    children: 0,
    notes: '',
    transactionId: '',
    paymentStatus: 'Unpaid' as any
  });

  // Housekeeping room verification modal
  const [isVerifyingRoom, setIsVerifyingRoom] = useState(false);
  const [activeCheckoutBooking, setActiveCheckoutBooking] = useState<Booking | null>(null);

  // Housekeeping checklists
  const [verifierName, setVerifierName] = useState(() => 
    staff && staff.length > 0 
      ? `${staff[0].name} (${staff[0].designation})` 
      : 'Ram Kumar (Housekeeping Staff)'
  );
  const [roomChecked, setRoomChecked] = useState(false);
  const [noDamage, setNoDamage] = useState(false);
  const [minibarChecked, setMinibarChecked] = useState(false);
  const [waterBottlesVerified, setWaterBottlesVerified] = useState(false);
  const [laundryVerified, setLaundryVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'Approved' | 'Pending' | 'Issue Found'>('Approved');

  // --- IMPROVED WORKFLOW STATES ---
  // Express Check-In States
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [selectedCheckInBooking, setSelectedCheckInBooking] = useState<Booking | null>(null);
  const [checkInForm, setCheckInForm] = useState({
    idType: 'Aadhaar',
    idNumber: '',
    address: '',
    city: 'Bhubaneswar',
    state: 'Odisha',
    nationality: 'Indian',
    country: 'India',
    companyName: '',
    gstNumber: ''
  });

  // Unified Checkout & Payment Settlement States
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutCheckIn, setCheckoutCheckIn] = useState<GuestCheckIn | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);

  // Extra charges form in Checkout Modal
  const [newChargeCategory, setNewChargeCategory] = useState<'Laundry' | 'Food' | 'Damage' | 'Late Checkout' | 'Other'>('Damage');
  const [newChargeDesc, setNewChargeDesc] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState<number>(0);

  // Room Damage / Tod-Phod Fine Confirmation Box State
  const [hasRoomDamageFine, setHasRoomDamageFine] = useState<boolean>(false);
  const [damageItemDesc, setDamageItemDesc] = useState<string>('');
  const [damageFineAmount, setDamageFineAmount] = useState<number>(0);

  // Settle payment form in Checkout Modal
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank' | 'Hybrid'>('UPI');
  const [settleHybridRows, setSettleHybridRows] = useState<HybridSplitRow[]>(() => createInitialHybridRows(0, ['Cash', 'UPI', 'Card', 'Bank']));
  const [editHybridRows, setEditHybridRows] = useState<HybridSplitRow[]>(() => createInitialHybridRows(0, ['Cash', 'UPI', 'Card', 'Online']));
  const [settleNotes, setSettleNotes] = useState('');
  const [checkoutGstRate, setCheckoutGstRate] = useState<number>(
    hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 5)
  );

  // Manager Overwrite approval
  const [isManagerApproved, setIsManagerApproved] = useState(false);
  const [managerApprover, setManagerApprover] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [markAsDue, setMarkAsDue] = useState(false);

  // Final Automated Invoice Preview State
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Delete Booking State
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);

  // Dedicated Quick Food Bill Modal State
  const [foodBillModalData, setFoodBillModalData] = useState<{
    room: Room;
    booking?: Booking;
    checkin?: GuestCheckIn;
  } | null>(null);
  const [foodBillItemDesc, setFoodBillItemDesc] = useState('');
  const [foodBillBaseAmount, setFoodBillBaseAmount] = useState<number>(0);
  const [foodBillDate, setFoodBillDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [foodBillTime, setFoodBillTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [foodBillApplyGst, setFoodBillApplyGst] = useState<boolean>(true);
  const [foodBillGstRate, setFoodBillGstRate] = useState<number>(5);

  // --- ROOM UPGRADE FEATURE STATES ---
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedUpgradeBooking, setSelectedUpgradeBooking] = useState<Booking | null>(null);
  const [selectedUpgradeCheckIn, setSelectedUpgradeCheckIn] = useState<GuestCheckIn | null>(null);
  const [targetRoomNumber, setTargetRoomNumber] = useState<string>('');
  const [upgradeReason, setUpgradeReason] = useState<string>('Guest requested room upgrade / relocation');
  const [overrideUpgradeCharge, setOverrideUpgradeCharge] = useState<string>('');
  const [upgradeSuccessToast, setUpgradeSuccessToast] = useState<string | null>(null);

  const todayStr = new Date().toISOString().substring(0, 10); // dynamic reference clock date

  // Helper helper helpers to identify statuses
  const isBookingCheckedOut = (b: Booking) => {
    if (b.status === 'Cancelled') return false;
    if ((b.status as string) === 'CheckedOut') return true;
    const checkin = checkins.find(c => c.id === b.id || (c.roomNumber === b.roomNumber && c.checkInDate === b.checkInDate));
    if (checkin && checkin.checkedOutDateTime) return true;
    return false;
  };

  const isBookingCheckedIn = (b: Booking) => {
    if (b.status === 'Cancelled') return false;
    if (isBookingCheckedOut(b)) return false;
    return !!b.isCheckedIn;
  };

  const isBookingAdvance = (b: Booking) => {
    if (b.status === 'Cancelled') return false;
    if (isBookingCheckedIn(b)) return false;
    if (isBookingCheckedOut(b)) return false;
    return true; // Confirmed, but not yet checked in
  };

  const getBookingStatusText = (b: Booking) => {
    if (b.status === 'Cancelled') return 'Cancelled';
    if (isBookingCheckedOut(b)) return 'Checked Out';
    if (isBookingCheckedIn(b)) return 'Checked In';
    return 'Advance Booking';
  };

  // Helper to calculate nights count
  const calcNights = (inDate: string, outDate: string) => {
    if (!inDate || !outDate) return 1;
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    const diff = d2.getTime() - d1.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return isNaN(days) || days <= 0 ? 1 : days;
  };

  // Helper to calculate total booking amount
  const getBookingAmountVal = (b: Booking): number => {
    // If there is an associated checkin, sum up totalAmount/finalAmount, otherwise use bookingAmount or standard roomRate * nights
    const checkin = checkins.find(c => c.id === b.id);
    if (checkin && (checkin.totalAmount !== undefined || (checkin as any).finalAmount !== undefined)) {
      return Number(checkin.totalAmount ?? (checkin as any).finalAmount ?? 0) || 0;
    }
    if (b.bookingAmount !== undefined && b.bookingAmount !== null && !Number.isNaN(Number(b.bookingAmount))) {
      return Number(b.bookingAmount) || 0;
    }

    const room = rooms.find(r => r.number === b.roomNumber);
    const rate = Number(room ? room.rate : 2500) || 2500;
    const nights = Math.max(1, Number(b.nights || 1) || 1);
    return rate * nights;
  };

  // Setup Edit Form on selecting a booking
  const handleOpenEditModal = (b: Booking) => {
    const room = rooms.find(r => r.number === b.roomNumber);
    const calculatedRate = room ? room.rate : 2500;
    const totalAmt = getBookingAmountVal(b);
    
    setSelectedEditBooking(b);
    setEditForm({
      guestName: b.guestName || '',
      mobile: b.mobile || '',
      aadhaarNumber: b.aadhaarNumber || '',
      address: b.address || '',
      roomNumber: b.roomNumber || '',
      roomType: b.roomType || (room ? room.category : 'Standard'),
      checkInDate: b.checkInDate || todayStr,
      checkOutDate: b.checkOutDate || todayStr,
      advanceAmount: b.advanceAmount || 0,
      bookingAmount: totalAmt,
      bookingSource: b.bookingSource || 'Walk-in',
      paymentMethod: b.paymentMethod || 'Cash',
      status: b.status || 'Confirmed',
      email: b.email || '',
      adults: b.adults || 1,
      children: b.children || 0,
      notes: b.notes || '',
      transactionId: b.transactionId || '',
      paymentStatus: b.paymentStatus || (b.advanceAmount === 0 ? 'Unpaid' : 'Partially Paid')
    });
    setIsEditModalOpen(true);
  };

  // Save modified values to PMS database state
  const handleSaveEditForm = () => {
    if (!selectedEditBooking) return;
    if (!editForm.guestName.trim()) {
      showToast('Guest Name is required', 'warning');
      return;
    }
    if (!editForm.mobile.trim()) {
      showToast('Mobile Number is required', 'warning');
      return;
    }
    if (!editForm.roomNumber) {
      showToast('Please assign a room', 'warning');
      return;
    }

    const calculatedNights = calcNights(editForm.checkInDate, editForm.checkOutDate);

    // 1. Create modified booking
    const updatedBooking: Booking = {
      ...selectedEditBooking,
      guestName: editForm.guestName,
      mobile: editForm.mobile,
      aadhaarNumber: editForm.aadhaarNumber,
      address: editForm.address,
      roomNumber: editForm.roomNumber,
      roomType: editForm.roomType,
      checkInDate: editForm.checkInDate,
      checkOutDate: editForm.checkOutDate,
      nights: calculatedNights,
      advanceAmount: Number(editForm.advanceAmount),
      bookingSource: editForm.bookingSource,
      paymentMethod: editForm.paymentMethod,
      status: editForm.status,
      email: editForm.email,
      adults: Number(editForm.adults),
      children: Number(editForm.children),
      notes: editForm.notes,
      transactionId: editForm.transactionId || undefined,
      paymentStatus: editForm.paymentStatus
    };

    // 2. Propagate Booking updates to parent state
    if (onUpdateBookings) {
      const newBookingsList = bookings.map(b => b.id === selectedEditBooking.id ? updatedBooking : b);
      onUpdateBookings(newBookingsList);
    }

    // 3. Propagate Check-In profile updates if they are checked-in
    const matchingCheckinIdx = checkins.findIndex(c => c.id === selectedEditBooking.id);
    if (matchingCheckinIdx !== -1 && onUpdateCheckins) {
      const originalCheckin = checkins[matchingCheckinIdx];
      const updatedCheckin: GuestCheckIn = {
        ...originalCheckin,
        guestName: editForm.guestName,
        mobile: editForm.mobile,
        aadhaarNumber: editForm.aadhaarNumber,
        address: editForm.address,
        roomNumber: editForm.roomNumber,
        checkInDate: editForm.checkInDate,
        checkOutDate: editForm.checkOutDate,
        advanceAmount: Number(editForm.advanceAmount),
        numGuests: Number(editForm.adults) + Number(editForm.children),
        totalAmount: Number(editForm.bookingAmount),
        pendingAmount: Math.max(0, Number(editForm.bookingAmount) - Number(editForm.advanceAmount)),
        roomRate: rooms.find(r => r.number === editForm.roomNumber)?.rate || originalCheckin.roomRate,
      };
      
      const newCheckinsList = [...checkins];
      newCheckinsList[matchingCheckinIdx] = updatedCheckin;
      onUpdateCheckins(newCheckinsList);
    }

    // 4. Update Room status if assigned room is modified
    if (onUpdateRooms && editForm.roomNumber !== selectedEditBooking.roomNumber) {
      const oldRoomNum = selectedEditBooking.roomNumber;
      const newRoomNum = editForm.roomNumber;

      const newRoomsList = rooms.map(r => {
        if (r.number === oldRoomNum) {
          return { ...r, status: 'Available' as const };
        }
        if (r.number === newRoomNum) {
          return { 
            ...r, 
            status: selectedEditBooking.isCheckedIn ? ('Occupied' as const) : ('Reserved' as const) 
          };
        }
        return r;
      });
      onUpdateRooms(newRoomsList);
    }

    setIsEditModalOpen(false);
    setSelectedEditBooking(null);
  };

  // --- WORKFLOW BUSINESS HANDLERS ---

  // Initiate Express Check-In Confirmation
  const handleInitiateExpressCheckIn = (booking: Booking) => {
    setSelectedCheckInBooking(booking);
    setCheckInForm({
      idType: 'Aadhaar',
      idNumber: booking.aadhaarNumber || '',
      address: booking.address || '',
      city: 'Bhubaneswar',
      state: 'Odisha',
      nationality: booking.nationality || 'Indian',
      country: 'India',
      companyName: booking.companyName || '',
      gstNumber: booking.gstNumber || ''
    });
    setIsCheckInModalOpen(true);
  };

  // Perform Express Check-In and convert booking into active stay
  const handleConfirmExpressCheckIn = () => {
    if (!selectedCheckInBooking) return;
    if (!checkInForm.idNumber.trim()) {
      showToast('Government ID Proof Number is required to check in the guest.', 'warning');
      return;
    }

    const booking = selectedCheckInBooking;
    const room = rooms.find(r => r.number === booking.roomNumber);
    const standardRate = room ? room.rate : 2500;
    const stayNights = booking.nights;
    const totalRoomAmount = standardRate * stayNights;

    // GST calculation: default to 5% GST for hotel stay
    const gstPercent = 5;
    const gstTax = Math.round((totalRoomAmount * gstPercent) / 100);
    const finalAmount = totalRoomAmount + gstTax;

    const initialPayments: PaymentRecord[] = [];
    if (booking.advanceAmount > 0) {
      initialPayments.push({
        id: `PAY-${Date.now()}-adv`,
        amount: booking.advanceAmount,
        paymentMethod: booking.paymentMethod,
        paymentType: 'Advance Deposit',
        dateTime: new Date().toISOString(),
        notes: 'Advance deposit during check-in'
      });
    }

    const newCheckIn: GuestCheckIn = {
      id: booking.id,
      guestName: booking.guestName,
      mobile: booking.mobile,
      alternateMobile: booking.alternateMobile || undefined,
      aadhaarNumber: checkInForm.idType === 'Aadhaar' ? checkInForm.idNumber : '',
      passportNumber: checkInForm.idType === 'Passport' ? checkInForm.idNumber : '',
      nationality: checkInForm.nationality,
      address: `${checkInForm.address}, ${checkInForm.city}, ${checkInForm.state}, ${checkInForm.country}`,
      city: checkInForm.city,
      state: checkInForm.state,
      country: checkInForm.country,
      idType: checkInForm.idType,
      idNumber: checkInForm.idNumber,
      companyName: checkInForm.companyName || undefined,
      gstNumber: checkInForm.gstNumber || undefined,
      depositBalance: 0,
      payments: initialPayments,
      extraCharges: [],
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numGuests: booking.adults + booking.children,
      roomNumber: booking.roomNumber,
      roomRate: standardRate,
      totalAmount: finalAmount,
      advanceAmount: booking.advanceAmount,
      cashAmountPaid: booking.paymentMethod === 'Cash' ? booking.advanceAmount : 0,
      onlineAmountPaid: booking.paymentMethod !== 'Cash' ? booking.advanceAmount : 0,
      pendingAmount: Math.max(0, finalAmount - booking.advanceAmount),
      dateTime: new Date().toISOString(),
      secondaryGuests: [],
      bookedRooms: [
        {
          roomNumber: booking.roomNumber,
          category: booking.roomType,
          rate: standardRate,
          originalRate: standardRate,
          discountAmountOfRoom: 0,
          guestsCount: booking.adults + booking.children,
          extraGuestsCount: 0,
          extraPersonChargeApplied: 0,
          totalRoomAmount: finalAmount
        }
      ],
      checkedInBy: 'Reception Desk'
    };

    // Update Room status to Occupied
    if (onUpdateRooms) {
      const updatedRooms = rooms.map(r => 
        r.number === booking.roomNumber ? { ...r, status: 'Occupied' as const } : r
      );
      onUpdateRooms(updatedRooms);
    }

    // Update Booking status
    if (onUpdateBookings) {
      const updatedBkgs = bookings.map(b => 
        b.id === booking.id ? { ...b, isCheckedIn: true, companyName: checkInForm.companyName || undefined, gstNumber: checkInForm.gstNumber || undefined } : b
      );
      onUpdateBookings(updatedBkgs);
    }

    // Save check-in
    if (onUpdateCheckins) {
      onUpdateCheckins([...checkins, newCheckIn]);
    }

    if (onAddAuditLog) {
      onAddAuditLog('Guest Checked In', `Express check-in processed for ${booking.guestName} into Room ${booking.roomNumber}.`);
    }

    setIsCheckInModalOpen(false);
    setSelectedCheckInBooking(null);
  };

  // Open Unified Checkout & Payment Settlement Modal
  const handleOpenCheckoutModal = (booking: Booking) => {
    setCheckoutBooking(booking);
    
    // Find matching check-in
    const matchedCheckin = checkins.find(c => c.id === booking.id || (c.roomNumber === booking.roomNumber && !c.checkedOutDateTime));
    if (matchedCheckin) {
      setCheckoutCheckIn(JSON.parse(JSON.stringify(matchedCheckin))); // clone
    } else {
      // Fallback if no check-in record existed
      const fallbackCheckIn: GuestCheckIn = {
        id: booking.id,
        guestName: booking.guestName,
        mobile: booking.mobile,
        aadhaarNumber: booking.aadhaarNumber || '',
        nationality: 'Indian',
        address: booking.address,
        city: 'Bhubaneswar',
        state: 'Odisha',
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        numGuests: booking.adults + booking.children,
        roomNumber: booking.roomNumber,
        roomRate: rooms.find(r => r.number === booking.roomNumber)?.rate || 2500,
        totalAmount: getBookingAmountVal(booking),
        advanceAmount: booking.advanceAmount,
        cashAmountPaid: booking.paymentMethod === 'Cash' ? booking.advanceAmount : 0,
        onlineAmountPaid: booking.paymentMethod !== 'Cash' ? booking.advanceAmount : 0,
        pendingAmount: Math.max(0, getBookingAmountVal(booking) - booking.advanceAmount),
        dateTime: booking.checkInDate + 'T14:00:00',
        payments: booking.advanceAmount > 0 ? [{
          id: `PAY-${Date.now()}-adv`,
          amount: booking.advanceAmount,
          paymentMethod: booking.paymentMethod === 'Cash' ? 'Cash' : 'UPI',
          paymentType: 'Advance Deposit',
          dateTime: new Date().toISOString(),
          notes: 'Advance deposit'
        }] : [],
        extraCharges: []
      };
      setCheckoutCheckIn(fallbackCheckIn);
    }

    // Reset checklists (pre-verified by default so admin can quickly confirm or add damage fine)
    setRoomChecked(true);
    setNoDamage(true);
    setMinibarChecked(true);
    setWaterBottlesVerified(true);
    setLaundryVerified(true);
    setVerificationStatus('Approved');
    setHasRoomDamageFine(false);
    setDamageItemDesc('');
    setDamageFineAmount(0);
    
    // Reset settle form & initialize GST mode from booking/checkin/settings
    setSettleAmount(0);
    setSettleMethod('UPI');
    setSettleNotes('');
    const initGst =
      booking.gstRate !== undefined
        ? Number(booking.gstRate)
        : matchedCheckin?.gstRate !== undefined
        ? Number(matchedCheckin.gstRate)
        : hotelSettings?.isGstEnabled === false
        ? 0
        : Number(hotelSettings?.defaultGstRate ?? 5);
    setCheckoutGstRate(initGst);

    // Reset manager approval
    setIsManagerApproved(false);
    setManagerApprover('');
    setManagerNotes('');
    setMarkAsDue(false);

    setIsCheckoutModalOpen(true);
  };

  // Settle Checkout Financials live
  const getCheckoutFinancialSummary = (cProfile: GuestCheckIn) => {
    const calcDays = (inDate: string, outDate: string) => {
      const d1 = new Date(inDate);
      const d2 = new Date(outDate);
      const diff = Math.abs(d2.getTime() - d1.getTime());
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return isNaN(days) || days <= 0 ? 1 : days;
    };

    const sysNow = new Date();
    const sysTodayStr = sysNow.getFullYear() + '-' + String(sysNow.getMonth() + 1).padStart(2, '0') + '-' + String(sysNow.getDate()).padStart(2, '0');
    const sysHour = sysNow.getHours();

    let targetOutDate = cProfile.checkOutDate || sysTodayStr;
    if (sysTodayStr > targetOutDate) {
      targetOutDate = sysTodayStr;
    }

    let nights = calcDays(cProfile.checkInDate, targetOutDate);
    let isLateCheckout = false;

    // Late checkout past 12:00 PM adds a night
    if (sysTodayStr >= targetOutDate && sysHour >= 12) {
      nights += 1;
      isLateCheckout = true;
    }

    if (isNaN(nights) || nights <= 0) {
      nights = 1;
    }

    let bookingPrice = cProfile.roomRate * nights;
    if (cProfile.isGroupCheckIn && cProfile.bookedRooms && cProfile.bookedRooms.length > 0) {
      bookingPrice = cProfile.bookedRooms.reduce((sum, r) => sum + (r.rate * nights), 0);
    }

    let extraBedTotal = 0;
    if (cProfile.isGroupCheckIn && cProfile.bookedRooms && cProfile.bookedRooms.length > 0) {
      cProfile.bookedRooms.forEach(br => {
        if (br.hasExtraBed) {
          extraBedTotal += (br.extraBedCount || 1) * (br.extraBedRate || 500) * nights;
        }
      });
    } else if (cProfile.hasExtraBed) {
      extraBedTotal += (cProfile.extraBedCount || 1) * (cProfile.extraBedRate || 500) * nights;
    }

    const earlyCheckInCharge = Number(cProfile.earlyCheckInCharge || 0);
    const extraCharges = (cProfile.extraCharges || [])
      .filter(item => item.category === 'Extra' || item.category === 'Laundry' || item.category === 'Damage' || item.category === 'Late Checkout' || item.category === 'Upgrade')
      .reduce((sum, item) => sum + item.amount, 0) + extraBedTotal + earlyCheckInCharge;
    const foodCharges = (cProfile.extraCharges || [])
      .filter(item => item.category === 'Food')
      .reduce((sum, item) => sum + item.amount, 0);
    const waterCharges = (cProfile.extraCharges || [])
      .filter(item => item.category === 'Water Bottle')
      .reduce((sum, item) => sum + item.amount, 0);
    const otherCharges = (cProfile.extraCharges || [])
      .filter(item => item.category === 'Other')
      .reduce((sum, item) => sum + item.amount, 0);

    const subtotal = bookingPrice + extraCharges + foodCharges + waterCharges + otherCharges;
    const gstRate = checkoutGstRate;
    const gst = gstRate > 0 ? parseFloat(((subtotal * gstRate) / 100).toFixed(2)) : 0;
    const cgst = parseFloat((gst / 2).toFixed(2));
    const sgst = parseFloat((gst - cgst).toFixed(2));
    const grandTotal = parseFloat((subtotal + gst).toFixed(2));

    const advancePaid = cProfile.advanceAmount || 0;
    const additionalPayment = (cProfile.payments || [])
      .filter(p => p.paymentType !== 'Advance Deposit')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPaid = advancePaid + additionalPayment;
    const dueAmount = Math.max(0, parseFloat((grandTotal - totalPaid).toFixed(2)));
    const depositBalance = cProfile.depositBalance || 0;

    return {
      nights,
      bookingPrice,
      roomCharges: bookingPrice,
      extraCharges,
      extrasTotal: extraCharges + foodCharges + waterCharges + otherCharges,
      foodCharges,
      waterCharges,
      otherCharges,
      subtotal,
      gstRate,
      cgst,
      sgst,
      gst,
      grandTotal,
      advancePaid,
      additionalPayment,
      totalPaid,
      dueAmount,
      depositBalance,
      isLateCheckout
    };
  };

  // Add extra charge on-the-fly inside Checkout Modal
  const handleAddLocalExtraCharge = () => {
    if (!checkoutCheckIn) return;
    const parsedAmt = Number(newChargeAmount);
    if (!parsedAmt || parsedAmt <= 0) {
      showToast('Please enter a valid Price (₹) greater than 0.', 'warning');
      return;
    }
    const finalDesc = (newChargeDesc || '').trim() || `${newChargeCategory} Charge`;
    const newCharge: ExtraCharge = {
      id: `EC-${Date.now()}`,
      category: newChargeCategory,
      description: finalDesc,
      amount: parsedAmt,
      dateTime: new Date().toISOString()
    };
    const updatedStay: GuestCheckIn = {
      ...checkoutCheckIn,
      extraCharges: [...(checkoutCheckIn.extraCharges || []), newCharge]
    };
    setCheckoutCheckIn(updatedStay);
    if (onUpdateCheckins) {
      onUpdateCheckins(checkins.map(c => c.id === updatedStay.id ? updatedStay : c));
    }
    showToast(`Added ₹${parsedAmt.toLocaleString()} (${finalDesc}) to stay bill`, 'success');
    // Reset form
    setNewChargeDesc('');
    setNewChargeAmount(0);
  };

  // Add Room Damage / Penalty Fine directly inside Checkout Modal
  const handleAddDamageFineToStay = (presetDesc?: string, presetAmt?: number) => {
    if (!checkoutCheckIn) return;
    const amt = presetAmt !== undefined ? Number(presetAmt) : Number(damageFineAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid Room Damage / Fine Amount (₹) greater than 0.', 'warning');
      return;
    }
    const desc = (presetDesc !== undefined ? presetDesc : damageItemDesc).trim() || 'Room Damage / Breakage Fine';
    const newFine: ExtraCharge = {
      id: `EC-FINE-${Date.now()}`,
      category: 'Damage',
      description: `Damage Fine: ${desc}`,
      amount: amt,
      dateTime: new Date().toISOString()
    };
    const updatedStay: GuestCheckIn = {
      ...checkoutCheckIn,
      extraCharges: [...(checkoutCheckIn.extraCharges || []), newFine]
    };
    setCheckoutCheckIn(updatedStay);
    if (onUpdateCheckins) {
      onUpdateCheckins(checkins.map(c => c.id === updatedStay.id ? updatedStay : c));
    }
    showToast(`Added Room Damage Fine ₹${amt.toLocaleString('en-IN')} (${desc}) to guest bill`, 'success');
    setDamageItemDesc('');
    setDamageFineAmount(0);
  };

  // Dedicated Food Bill Handlers (Point 3 & 4: Back-date entry & 5% GST option)
  const handleOpenFoodBillModal = (room: Room, activeBooking?: Booking) => {
    const linkedStay = checkins.find(c => String(c.roomNumber) === String(room.number) && !c.checkedOutDateTime) ||
                       checkins.find(c => c.id === activeBooking?.id);
    setFoodBillModalData({ room, booking: activeBooking, checkin: linkedStay });
    setFoodBillItemDesc('');
    setFoodBillBaseAmount(0);
    setFoodBillDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    setFoodBillTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setFoodBillApplyGst(true);
    setFoodBillGstRate(5);
  };

  const handleSubmitFoodBill = () => {
    if (!foodBillModalData) return;
    const baseAmt = Number(foodBillBaseAmount);
    if (!baseAmt || baseAmt <= 0) {
      showToast('Please enter a valid Food Amount (₹) greater than 0.', 'warning');
      return;
    }
    const gstAmt = foodBillApplyGst ? Math.round(baseAmt * (foodBillGstRate / 100) * 100) / 100 : 0;
    const totalFoodBill = Math.round((baseAmt + gstAmt) * 100) / 100;
    const itemDesc = foodBillItemDesc.trim() || 'Restaurant / Room Service Food Bill';
    const taxNote = foodBillApplyGst ? ` (Incl. ${foodBillGstRate}% GST: ₹${gstAmt})` : ' (Without GST)';
    const dateNote = ` [Date: ${foodBillDate} ${foodBillTime}]`;

    const newCharge: ExtraCharge = {
      id: `EC-FOOD-${Date.now()}`,
      category: 'Food',
      description: `${itemDesc}${taxNote}${dateNote}`,
      amount: totalFoodBill,
      dateTime: `${foodBillDate}T${foodBillTime}:00`
    };

    if (foodBillModalData.checkin && onUpdateCheckins) {
      const stay = foodBillModalData.checkin;
      const prevExtras = stay.extraCharges || [];
      const updatedStay: GuestCheckIn = {
        ...stay,
        extraCharges: [...prevExtras, newCharge],
        pendingAmount: (stay.pendingAmount || 0) + totalFoodBill
      };
      const nextCheckins = checkins.map(c => c.id === stay.id ? updatedStay : c);
      onUpdateCheckins(nextCheckins);
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        'Food Bill Posted',
        `Posted Food Bill of ₹${totalFoodBill} (Base: ₹${baseAmt}, GST: ₹${gstAmt}) for Room ${foodBillModalData.room.number} (${foodBillModalData.booking?.guestName || 'Guest'}). Bill Date: ${foodBillDate} ${foodBillTime}.`
      );
    }

    showToast(`Food bill of ₹${totalFoodBill} posted to Room ${foodBillModalData.room.number} successfully!`, 'success');
    setFoodBillModalData(null);
  };

  // Remove extra charge inside Checkout Modal
  const handleRemoveLocalExtraCharge = (id: string) => {
    if (!checkoutCheckIn) return;
    const updatedStay: GuestCheckIn = {
      ...checkoutCheckIn,
      extraCharges: (checkoutCheckIn.extraCharges || []).filter(c => c.id !== id)
    };
    setCheckoutCheckIn(updatedStay);
    if (onUpdateCheckins) {
      onUpdateCheckins(checkins.map(c => c.id === updatedStay.id ? updatedStay : c));
    }
  };

  // Settle partial or full payment inside Checkout Modal
  const handleAddLocalPayment = () => {
    if (!checkoutCheckIn) return;
    if (settleMethod === 'Hybrid') {
      const validSplits = getValidHybridSplits(settleHybridRows);
      if (validSplits.length === 0) return;
      const baseTs = Date.now();
      const newPayments: PaymentRecord[] = validSplits.map((sp, idx) => ({
        id: `PAY-SETTLE-${baseTs}-${idx}`,
        amount: sp.amount,
        paymentMethod: sp.method as any,
        paymentType: 'Settle Balance',
        dateTime: new Date().toISOString(),
        notes: settleNotes ? `${settleNotes} (Hybrid ${sp.method})` : `Hybrid split checkout (${sp.method})`
      }));
      setCheckoutCheckIn(prev => {
        if (!prev) return null;
        return { ...prev, payments: [...(prev.payments || []), ...newPayments] };
      });
      setSettleAmount(0);
      setSettleNotes('');
      setSettleMethod('UPI');
      return;
    }
    if (settleAmount <= 0) return;
    const newPayment: PaymentRecord = {
      id: `PAY-SETTLE-${Date.now()}`,
      amount: settleAmount,
      paymentMethod: settleMethod,
      paymentType: 'Settle Balance',
      dateTime: new Date().toISOString(),
      notes: settleNotes || 'Settle checkout balance'
    };
    setCheckoutCheckIn(prev => {
      if (!prev) return null;
      const existing = prev.payments || [];
      return {
        ...prev,
        payments: [...existing, newPayment]
      };
    });
    // Reset payment fields
    setSettleAmount(0);
    setSettleNotes('');
  };

  // Process stay checkout, updates, and tax invoice generation
  const handleCompleteUnifiedCheckout = () => {
    if (!checkoutCheckIn || !checkoutBooking) return;

    if (checkoutCheckIn.checkedOutDateTime || String(checkoutBooking.status || '').toLowerCase() === 'checkedout') {
      showToast(`Already Checked Out: Guest ${checkoutCheckIn.guestName} has already completed checkout.`, 'error');
      return;
    }

    // If admin typed a Damage Fine amount or Extra Charge amount without clicking "+ Add", include it automatically!
    let workingCheckIn: GuestCheckIn = {
      ...checkoutCheckIn,
      extraCharges: [...(checkoutCheckIn.extraCharges || [])]
    };

    if (Number(damageFineAmount) > 0) {
      const autoFineDesc = (damageItemDesc || '').trim() || 'Room Damage / Breakage Fine';
      workingCheckIn.extraCharges = [
        ...(workingCheckIn.extraCharges || []),
        {
          id: `EC-FINE-${Date.now()}`,
          category: 'Damage',
          description: `Damage Fine: ${autoFineDesc}`,
          amount: Number(damageFineAmount),
          dateTime: new Date().toISOString()
        }
      ];
      setDamageFineAmount(0);
      setDamageItemDesc('');
    }

    if (Number(newChargeAmount) > 0) {
      const autoExtraDesc = (newChargeDesc || '').trim() || `${newChargeCategory} Charge`;
      workingCheckIn.extraCharges = [
        ...(workingCheckIn.extraCharges || []),
        {
          id: `EC-${Date.now() + 1}`,
          category: newChargeCategory,
          description: autoExtraDesc,
          amount: Number(newChargeAmount),
          dateTime: new Date().toISOString()
        }
      ];
      setNewChargeAmount(0);
      setNewChargeDesc('');
    }

    if (settleMethod === 'Hybrid' && getValidHybridSplits(settleHybridRows).length > 0) {
      const baseTs = Date.now();
      workingCheckIn.payments = [
        ...(workingCheckIn.payments || []),
        ...getValidHybridSplits(settleHybridRows).map((sp, idx) => ({
          id: `PAY-SETTLE-${baseTs}-${idx}`,
          amount: sp.amount,
          paymentMethod: sp.method as any,
          paymentType: 'Settle Balance' as const,
          dateTime: new Date().toISOString(),
          notes: settleNotes ? `${settleNotes} (Hybrid ${sp.method})` : `Hybrid split checkout (${sp.method})`
        }))
      ];
      setSettleAmount(0);
      setSettleNotes('');
      setSettleMethod('UPI');
    } else if (Number(settleAmount) > 0) {
      workingCheckIn.payments = [
        ...(workingCheckIn.payments || []),
        {
          id: `PAY-SETTLE-${Date.now()}`,
          amount: Number(settleAmount),
          paymentMethod: settleMethod as any,
          paymentType: 'Settle Balance',
          dateTime: new Date().toISOString(),
          notes: settleNotes || 'Checkout balance settlement'
        }
      ];
      setSettleAmount(0);
      setSettleNotes('');
    }

    const summary = getCheckoutFinancialSummary(workingCheckIn);

    // 1. Mark Check-in as checked-out (do NOT insert fake payment records when Marked as Due — keep invoiceStatus and paymentStatus separate)
    const checkOutTime = new Date().toISOString();
    const finalPayments = [...(workingCheckIn.payments || [])];

    const finalizedCheckIn: GuestCheckIn = {
      ...workingCheckIn,
      payments: finalPayments,
      pendingAmount: summary.dueAmount > 0 ? summary.dueAmount : 0,
      checkedOutDateTime: checkOutTime,
      checkedOutBy: markAsDue ? 'Receptionist (Marked as Due)' : 'Desk Agent'
    };

    if (onUpdateCheckins) {
      const otherCheckins = checkins.filter(c => c.id !== finalizedCheckIn.id);
      onUpdateCheckins([...otherCheckins, finalizedCheckIn]);
    }

    // 2. Mark all rooms allocated to this stay as Dirty
    if (onUpdateRooms) {
      const stayRoomNumbers = Array.from(
        new Set([
          workingCheckIn.roomNumber,
          ...(workingCheckIn.bookedRooms || []).map(br => br.roomNumber)
        ].filter(Boolean))
      );
      const updatedRooms = rooms.map(r => {
        if (stayRoomNumbers.includes(r.number)) {
          return {
            ...r,
            status: 'Dirty' as const,
            cleaningStatus: 'Dirty' as const
          };
        }
        return r;
      });
      onUpdateRooms(updatedRooms);
    }

    // 3. Update Booking status to CheckedOut
    if (onUpdateBookings) {
      const updatedBookings = bookings.map(b => {
        if (b.id === checkoutBooking.id) {
          return {
            ...b,
            isCheckedIn: false,
            status: 'CheckedOut' as any,
            isCompleted: true
          };
        }
        return b;
      });
      onUpdateBookings(updatedBookings);
    }

    // 4. Generate or update the single final Tax Invoice via centralized 8-condition engine
    // Always pick up CGST + SGST rate automatically from Hotel Settings
    const existingInv = invoices.find(
      inv =>
        inv.bookingId === finalizedCheckIn.id ||
        inv.bookingId === checkoutBooking.id ||
        (inv.roomNumber === finalizedCheckIn.roomNumber && inv.guestName === finalizedCheckIn.guestName)
    );
    const gstRate = checkoutGstRate;
    const activeConditions = normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
      isGstEnabled: gstRate > 0,
      defaultGstRate: gstRate
    });

    const evalResult = evaluateAndBuildInvoice({
      hotelId: finalizedCheckIn.hotelId || checkoutBooking.hotelId || hotelSettings?.id,
      booking: {
        ...checkoutBooking,
        isCheckedIn: false,
        status: 'CheckedOut' as any,
        isCompleted: true
      },
      checkin: finalizedCheckIn,
      rooms,
      existingInvoices: invoices,
      conditions: activeConditions,
      isManualAction: false,
      isCheckoutTrigger: true,
      allowUpdateExistingFinalOnCheckout: true,
      overrideRoomCharges: summary.bookingPrice,
      overrideGstRate: gstRate,
      overrideAdvancePaid: summary.totalPaid,
      invoiceType: 'Tax Invoice'
    });

    const invoiceNum =
      evalResult.invoice?.invoiceNumber ||
      existingInv?.invoiceNumber ||
      `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`;
    const gstAmt = summary.gst;
    const finalAmtWithGst = summary.grandTotal;
    const netPending = Math.max(0, parseFloat((finalAmtWithGst - summary.totalPaid).toFixed(2)));

    const finalInvoice: Invoice = evalResult.invoice || {
      ...(existingInv || {}),
      id: existingInv?.id || `INV-${Date.now()}`,
      invoiceNumber: invoiceNum,
      bookingId: finalizedCheckIn.id,
      guestName: finalizedCheckIn.guestName,
      guestMobile: finalizedCheckIn.mobile,
      roomNumber: finalizedCheckIn.roomNumber,
      checkInDate: finalizedCheckIn.checkInDate,
      checkOutDate: finalizedCheckIn.checkOutDate,
      roomCharges: summary.bookingPrice,
      foodCharges: summary.foodCharges,
      waterCharges: summary.waterCharges,
      otherCharges: summary.otherCharges + summary.extraCharges,
      subtotal: summary.subtotal,
      gst: gstAmt,
      cgst: summary.cgst,
      sgst: summary.sgst,
      discount: 0,
      finalAmount: finalAmtWithGst,
      advancePaid: summary.totalPaid,
      pendingAmount: netPending,
      invoiceType: 'Tax Invoice',
      invoiceStatus: 'Finalized',
      paymentStatus: netPending <= 0 ? 'Paid' : summary.totalPaid > 0 ? 'Partially Paid' : 'Unpaid',
      isFinalInvoice: true,
      dateCreated: new Date().toISOString().split('T')[0],
      isPaid: netPending <= 0,
      gstRate
    };

    if (onUpdateInvoices) {
      const mergedList = deduplicateInvoicesByBooking(
        invoices.some(
          inv =>
            inv.id === finalInvoice.id ||
            (existingInv && inv.id === existingInv.id) ||
            (inv.bookingId && (inv.bookingId === finalInvoice.bookingId || inv.bookingId === checkoutBooking.id))
        )
          ? invoices.map(inv =>
              inv.id === finalInvoice.id ||
              (existingInv && inv.id === existingInv.id) ||
              (inv.bookingId && (inv.bookingId === finalInvoice.bookingId || inv.bookingId === checkoutBooking.id))
                ? finalInvoice
                : inv
            )
          : [finalInvoice, ...invoices]
      );
      onUpdateInvoices(mergedList);
    }

    if (onAddAuditLog) {
      onAddAuditLog('Guest Checked Out', `Stay checkout completed for ${finalizedCheckIn.guestName} (Room ${finalizedCheckIn.roomNumber}). Final Invoice generated: ${invoiceNum} (₹${finalAmtWithGst}).`);
    }

    showToast(
      `Check-Out Complete for ${finalizedCheckIn.guestName} (Room ${finalizedCheckIn.roomNumber})! Opening Invoice ${invoiceNum}...`,
      'success'
    );

    // 5. Close checkout modal and redirect straight to the Invoices & Billing page with this guest's invoice selected
    setIsCheckoutModalOpen(false);
    setCheckoutCheckIn(null);
    setCheckoutBooking(null);
    onCheckOut({
      ...checkoutBooking,
      id: finalizedCheckIn.id,
      guestName: finalizedCheckIn.guestName,
      mobile: finalizedCheckIn.mobile,
      roomNumber: finalizedCheckIn.roomNumber,
      isCheckedIn: false,
      isCompleted: true,
      status: 'CheckedOut' as any
    });
  };

  // Fast registration receipt triggers — route cleanly through isolated A4 GRC print window
  const handlePrintCard = (booking: Booking) => {
    const linkedChk = checkins.find(c => c.id === booking.id) || null;
    openPrintWindow(
      buildGuestGrcHtml({
        booking,
        checkin: linkedChk,
        hotelSettings,
      }),
      true
    );
  };

  const configuredDefaultGst = hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 5);
  const configuredGstSlabs = Array.from(
    new Set([
      0,
      ...(Array.isArray(hotelSettings?.gstSlabs) && hotelSettings!.gstSlabs!.length > 0
        ? hotelSettings!.gstSlabs!
        : [0, 5, 12, 18]),
      configuredDefaultGst
    ])
  ).sort((a, b) => a - b);

  const handleGenerateOrViewInvoiceForBooking = (b: Booking) => {
    const existing = invoices?.find(inv => inv.bookingId === b.id);
    if (existing) {
      setPreviewInvoice(existing);
      return;
    }

    // Auto-generate invoice using dynamic GST rate from booking, check-in, or Hotel Settings
    const linkedCheckin = checkins.find(c => c.id === b.id);
    const nights = b.nights || 1;
    const roomRate = rooms.find(r => r.category === b.roomType || r.number === b.roomNumber)?.rate || 2000;
    const roomCharges = b.bookingAmount || (roomRate * nights);
    const extraBedCharges = b.hasExtraBed ? ((b.extraBedCount || 1) * (b.extraBedRate || 500) * nights) : 0;
    const subtotal = roomCharges + extraBedCharges;
    const gstRate = b.gstRate ?? linkedCheckin?.gstRate ?? configuredDefaultGst;
    const gst = gstRate > 0 ? parseFloat((subtotal * (gstRate / 100)).toFixed(2)) : 0;
    const finalAmount = parseFloat((subtotal + gst).toFixed(2));
    const advancePaid = b.advanceAmount || 0;
    const pendingAmount = Math.max(0, parseFloat((finalAmount - advancePaid).toFixed(2)));
    const isPaid = pendingAmount <= 0;

    const count = (invoices?.length || 0) + 1;
    const invoiceNum = `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const newInvoice: Invoice = {
      id: `INV-${Date.now()}`,
      invoiceNumber: invoiceNum,
      bookingId: b.id,
      guestName: b.guestName,
      guestMobile: b.mobile,
      roomNumber: b.roomNumber,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      roomCharges,
      foodCharges: 0,
      waterCharges: 0,
      otherCharges: 0,
      extraBedCharges,
      extraBedCount: b.extraBedCount || 0,
      extraBedRate: b.extraBedRate || 500,
      isGroupCheckIn: b.isGroupCheckIn,
      groupBookingId: b.groupBookingId,
      bookedRooms: b.bookedRooms,
      subtotal,
      gst,
      discount: 0,
      finalAmount,
      advancePaid,
      pendingAmount,
      paymentMethod: b.paymentMethod,
      invoiceType: 'Booking Invoice',
      dateCreated: new Date().toISOString().split('T')[0],
      isPaid,
      gstRate,
      notes: `Invoice generated for booking ID ${b.id}`
    };

    if (onUpdateInvoices) {
      onUpdateInvoices([...(invoices || []), newInvoice]);
    }
    if (onAddAuditLog) {
      onAddAuditLog('Invoice Generated', `Generated ${newInvoice.invoiceType} (${invoiceNum}) for Booking ${b.id} (${b.guestName}). Total: ₹${finalAmount}`);
    }
    setPreviewInvoice(newInvoice);
  };

  const handleChangePreviewInvoiceGst = (newRate: number) => {
    const cleanRate = Math.max(0, Math.min(100, Number(newRate) || 0));
    if (!previewInvoice) return;
    const sub = Number(previewInvoice.subtotal || previewInvoice.roomCharges || 0);
    const disc = Number(previewInvoice.discount || 0);
    const newGst = cleanRate > 0 ? parseFloat((sub * (cleanRate / 100)).toFixed(2)) : 0;
    const newFinal = parseFloat((sub + newGst - disc).toFixed(2));
    const adv = Number(previewInvoice.advancePaid || 0);
    const newPending = Math.max(0, parseFloat((newFinal - adv).toFixed(2)));
    const updatedInv: Invoice = {
      ...previewInvoice,
      gstRate: cleanRate,
      gst: newGst,
      finalAmount: newFinal,
      pendingAmount: newPending,
      isPaid: newPending <= 0
    };
    setPreviewInvoice(updatedInv);
    if (onUpdateInvoices && invoices) {
      onUpdateInvoices(invoices.map(inv => inv.id === previewInvoice.id ? updatedInv : inv));
    }
    showToast(`GST updated to ${cleanRate}% (₹${newGst.toLocaleString()}). Total: ₹${newFinal.toLocaleString()}`, 'success');
  };

  const handleChangePreviewInvoiceGstAmount = (newAmount: number) => {
    const cleanGst = Math.max(0, parseFloat(String(newAmount)) || 0);
    if (!previewInvoice) return;
    const sub = Number(previewInvoice.subtotal || previewInvoice.roomCharges || 0);
    const disc = Number(previewInvoice.discount || 0);
    const computedRate = sub > 0 ? parseFloat(((cleanGst / sub) * 100).toFixed(2)) : 0;
    const newFinal = parseFloat((sub + cleanGst - disc).toFixed(2));
    const adv = Number(previewInvoice.advancePaid || 0);
    const newPending = Math.max(0, parseFloat((newFinal - adv).toFixed(2)));
    const updatedInv: Invoice = {
      ...previewInvoice,
      gstRate: computedRate,
      gst: cleanGst,
      finalAmount: newFinal,
      pendingAmount: newPending,
      isPaid: newPending <= 0
    };
    setPreviewInvoice(updatedInv);
    if (onUpdateInvoices && invoices) {
      onUpdateInvoices(invoices.map(inv => inv.id === previewInvoice.id ? updatedInv : inv));
    }
  };

  const handleDeleteBooking = (booking: Booking) => {
    setBookingToDelete(booking);
  };

  const confirmDeleteBooking = () => {
    if (!bookingToDelete) return;
    
    // Remove from bookings list
    if (onUpdateBookings) {
      const updatedBkgs = bookings.filter(b => b.id !== bookingToDelete.id);
      onUpdateBookings(updatedBkgs);
    }
    
    // Also release room if the booking was Checked In or Reserved
    if (onUpdateRooms) {
      const roomNum = bookingToDelete.roomNumber;
      const roomObj = rooms.find(r => r.number === roomNum);
      if (roomObj && (roomObj.status === 'Occupied' || roomObj.status === 'Reserved')) {
        const updatedRooms = rooms.map(r => 
          r.number === roomNum ? { ...r, status: 'Available' as const, cleaningStatus: 'Clean' as const } : r
        );
        onUpdateRooms(updatedRooms);
      }
    }

    // Filter checkins if any associated
    if (onUpdateCheckins) {
      const updatedCheckins = checkins.filter(c => c.id !== bookingToDelete.id);
      onUpdateCheckins(updatedCheckins);
    }

    // Move to Deleted Folder to ensure zero permanent data loss
    if (onMoveToDeletedFolder) {
      onMoveToDeletedFolder({
        itemType: 'Booking',
        itemId: bookingToDelete.id,
        title: `Booking #${bookingToDelete.id} (${bookingToDelete.roomType} - Room ${bookingToDelete.roomNumber || 'Auto'})`,
        guestName: bookingToDelete.guestName,
        roomNumber: bookingToDelete.roomNumber,
        amount: bookingToDelete.bookingAmount,
        reason: 'User deleted from Dashboard / Today Bookings',
        data: bookingToDelete
      });
    }

    if (onAddAuditLog) {
      onAddAuditLog('Booking Moved to Deleted Folder', `Booking ID ${bookingToDelete.id} for guest ${bookingToDelete.guestName} moved to Deleted Folder. Retained safely.`);
    }

    setBookingToDelete(null);
  };

  // --- ROOM UPGRADE HANDLERS ---
  const handleOpenUpgradeModal = (b: Booking) => {
    setSelectedUpgradeBooking(b);
    const existingCheckin = checkins.find(c => c.id === b.id || (c.roomNumber === b.roomNumber && c.checkInDate === b.checkInDate));
    setSelectedUpgradeCheckIn(existingCheckin || null);
    
    // Find first available room that isn't the current room
    const availRooms = rooms.filter(r => r.status === 'Available' && r.number !== b.roomNumber);
    if (availRooms.length > 0) {
      setTargetRoomNumber(availRooms[0].number);
    } else {
      setTargetRoomNumber('');
    }
    setUpgradeReason('Guest requested room upgrade / relocation');
    setOverrideUpgradeCharge('');
    setIsUpgradeModalOpen(true);
  };

  const getUpgradeCalculationDetails = () => {
    if (!selectedUpgradeBooking) {
      return { remainingNights: 0, totalStayNights: 0, elapsedDays: 0, oldRoomRate: 0, newRoomRate: 0, rateDiffPerNight: 0, totalCalculatedCharge: 0, oldRoom: null, newRoom: null };
    }
    
    const b = selectedUpgradeBooking;
    const oldRoom = rooms.find(r => r.number === b.roomNumber) || null;
    const newRoom = rooms.find(r => r.number === targetRoomNumber) || null;
    
    const oldRoomRate = oldRoom?.rate || selectedUpgradeCheckIn?.roomRate || 2500;
    const newRoomRate = newRoom?.rate || 0;
    
    // Calculate remaining nights
    const sysNow = new Date();
    const todayYMD = sysNow.getFullYear() + '-' + String(sysNow.getMonth() + 1).padStart(2, '0') + '-' + String(sysNow.getDate()).padStart(2, '0');
    
    const checkInDate = b.checkInDate || todayYMD;
    const checkOutDate = b.checkOutDate || todayYMD;
    
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const dNow = new Date(todayYMD);
    
    const totalStayNights = Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)));
    
    let elapsedDays = Math.floor((dNow.getTime() - d1.getTime()) / (1000 * 3600 * 24));
    if (elapsedDays < 0) elapsedDays = 0;
    
    let remainingNights = totalStayNights - elapsedDays;
    if (remainingNights < 1) remainingNights = 1;
    
    const rateDiffPerNight = Math.max(0, newRoomRate - oldRoomRate);
    const totalCalculatedCharge = rateDiffPerNight * remainingNights;
    
    return {
      remainingNights,
      totalStayNights,
      elapsedDays,
      oldRoomRate,
      newRoomRate,
      rateDiffPerNight,
      totalCalculatedCharge,
      oldRoom,
      newRoom
    };
  };

  const handleConfirmUpgrade = () => {
    if (!selectedUpgradeBooking || !targetRoomNumber) return;
    
    const b = selectedUpgradeBooking;
    const { remainingNights, oldRoomRate, newRoomRate, rateDiffPerNight, totalCalculatedCharge, oldRoom, newRoom } = getUpgradeCalculationDetails();
    
    if (!newRoom) {
      showToast('Please select a valid destination room for the upgrade.', 'warning');
      return;
    }
    
    const finalUpgradeCharge = overrideUpgradeCharge !== '' && !isNaN(Number(overrideUpgradeCharge))
      ? Number(overrideUpgradeCharge)
      : totalCalculatedCharge;
      
    const oldRoomNumber = b.roomNumber;
    const oldCategory = b.roomType || oldRoom?.category || 'Standard';
    const newRoomNumber = newRoom.number;
    const newCategory = newRoom.category;
    
    // 1. Update Room Statuses
    if (onUpdateRooms) {
      const updatedRooms = rooms.map(r => {
        if (r.number === oldRoomNumber) {
          return { ...r, status: 'Dirty' as RoomStatus, cleaningStatus: 'Dirty' as any };
        }
        if (r.number === newRoomNumber) {
          return { ...r, status: 'Occupied' as RoomStatus };
        }
        return r;
      });
      onUpdateRooms(updatedRooms);
    }
    
    // 2. Create Upgrade History Record
    const upgradeRecord: RoomUpgradeRecord = {
      id: `UPG-${Date.now()}`,
      bookingId: b.id,
      guestName: b.guestName,
      oldRoomNumber,
      oldRoomCategory: oldCategory,
      oldRoomRate,
      newRoomNumber,
      newRoomCategory: newCategory,
      newRoomRate,
      remainingNights,
      rateDifferencePerNight: rateDiffPerNight,
      totalUpgradeCharge: finalUpgradeCharge,
      upgradedAt: new Date().toISOString(),
      upgradedBy: verifierName || 'Front Desk Reception',
      reason: upgradeReason || 'Guest Requested Upgrade'
    };
    
    // 3. Update Booking Record (keep same booking ID!)
    if (onUpdateBookings) {
      const updatedBookings = bookings.map(item => {
        if (item.id === b.id) {
          const prevHistory = item.upgradeHistory || [];
          const currentBVal = item.bookingAmount ?? getBookingAmountVal(item);
          return {
            ...item,
            roomNumber: newRoomNumber,
            roomType: newCategory,
            bookingAmount: currentBVal + finalUpgradeCharge,
            upgradeHistory: [...prevHistory, upgradeRecord]
          };
        }
        return item;
      });
      onUpdateBookings(updatedBookings);
    }
    
    // 4. Update CheckIn Record
    if (onUpdateCheckins) {
      const updatedCheckins = checkins.map(item => {
        if (item.id === b.id || (item.guestName === b.guestName && item.checkInDate === b.checkInDate)) {
          const prevHistory = item.upgradeHistory || [];
          const prevExtraCharges = item.extraCharges || [];
          
          const newExtraCharge: ExtraCharge = {
            id: `EC-UPG-${Date.now()}`,
            category: 'Upgrade',
            description: `Room Upgrade: #${oldRoomNumber} (${oldCategory}) → #${newRoomNumber} (${newCategory}) for ${remainingNights} remaining night(s) @ +₹${rateDiffPerNight}/night`,
            amount: finalUpgradeCharge,
            dateTime: new Date().toISOString()
          };
          
          return {
            ...item,
            roomNumber: newRoomNumber,
            roomRate: newRoomRate,
            totalAmount: (item.totalAmount || 0) + finalUpgradeCharge,
            pendingAmount: (item.pendingAmount || 0) + finalUpgradeCharge,
            extraCharges: [...prevExtraCharges, newExtraCharge],
            upgradeHistory: [...prevHistory, upgradeRecord]
          };
        }
        return item;
      });
      onUpdateCheckins(updatedCheckins);
    }
    
    // 5. Audit log
    if (onAddAuditLog) {
      onAddAuditLog(
        'Room Upgrade',
        `Moved guest ${b.guestName} (Booking ID: ${b.id}) from Room ${oldRoomNumber} (${oldCategory}) to Room ${newRoomNumber} (${newCategory}). Added rate difference of ₹${finalUpgradeCharge} for ${remainingNights} remaining night(s). Reason: ${upgradeReason}`
      );
    }
    
    setUpgradeSuccessToast(`Room upgraded successfully! ${b.guestName} moved from Room ${oldRoomNumber} to Room ${newRoomNumber}. Added ₹${finalUpgradeCharge} to existing bill.`);
    setIsUpgradeModalOpen(false);
    setSelectedUpgradeBooking(null);
    setSelectedUpgradeCheckIn(null);
    
    setTimeout(() => {
      setUpgradeSuccessToast(null);
    }, 6000);
  };

  // View Modal routines
  const openGuestDetailsByBooking = (booking: Booking) => {
    const record = checkins.find(c => c.id === booking.id || c.roomNumber === booking.roomNumber);
    if (record) {
      setSelectedGuestDetails(record);
    } else {
      const tempDetails: GuestCheckIn = {
        id: booking.id,
        guestName: booking.guestName,
        mobile: booking.mobile,
        aadhaarNumber: booking.aadhaarNumber,
        nationality: booking.nationality || 'Indian',
        address: booking.address,
        city: 'City',
        state: 'State',
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        numGuests: booking.adults + booking.children,
        roomNumber: booking.roomNumber,
        roomRate: rooms.find(r => r.number === booking.roomNumber)?.rate || 2500,
        totalAmount: getBookingAmountVal(booking),
        advanceAmount: booking.advanceAmount,
        cashAmountPaid: booking.paymentMethod === 'Cash' ? booking.advanceAmount : 0,
        onlineAmountPaid: booking.paymentMethod !== 'Cash' ? booking.advanceAmount : 0,
        pendingAmount: Math.max(0, getBookingAmountVal(booking) - booking.advanceAmount),
        dateTime: booking.checkInDate + 'T14:00:00'
      };
      setSelectedGuestDetails(tempDetails);
    }
  };

  // MASTER BOOKINGS LIST DATA — Dynamic Date-Wise Filter & Scope Control
  const futureAdvanceCount = bookings.filter(
    b => isBookingAdvance(b) && Boolean(b.checkInDate && b.checkInDate > liveTodayStr)
  ).length;

  const masterBookingsList = bookings.filter(b => {
    if (searchQuery.trim().length > 0) return true;
    if (dateFilterType === 'All') return true;
    const bDate = b.checkInDate || b.date || '';
    if (dateFilterType === 'Today') {
      return (
        bDate === liveTodayStr ||
        (b.checkInDate && b.checkInDate <= liveTodayStr && (!b.checkOutDate || b.checkOutDate >= liveTodayStr) && (b.isCheckedIn || b.status === 'Confirmed' || b.status === 'Advance'))
      );
    }
    if (dateFilterType === 'Yesterday') {
      return bDate === yesterdayStr;
    }
    if (dateFilterType === 'Date') {
      return bDate === filterSingleDate;
    }
    if (dateFilterType === 'This Month') {
      return bDate.startsWith(currentMonthPrefix);
    }
    if (dateFilterType === 'Range') {
      return (!filterStartDate || bDate >= filterStartDate) && (!filterEndDate || bDate <= filterEndDate);
    }
    return true;
  });

  // Filter lists based on inputs
  const filteredBookings = masterBookingsList.filter(b => {
    // 1. Search filter (ID, Guest Name, Mobile, Room Number)
    const matchSearch = 
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.mobile.includes(searchQuery) ||
      b.roomNumber.includes(searchQuery);

    // 2. Status Badge Filter
    const statusText = getBookingStatusText(b);
    const matchStatus = statusFilter === 'All' || statusText === statusFilter;

    // 3. Room Category Filter
    const matchCategory = categoryFilter === 'All' || b.roomType === categoryFilter;

    return matchSearch && matchStatus && matchCategory;
  });

  // Calculate high-level metrics for standard visual headers
  const countAdvance = masterBookingsList.filter(b => isBookingAdvance(b)).length;
  const countCheckedIn = masterBookingsList.filter(b => isBookingCheckedIn(b)).length;
  const countCheckedOut = masterBookingsList.filter(b => isBookingCheckedOut(b)).length;
  const countCancelled = masterBookingsList.filter(b => b.status === 'Cancelled').length;

  return (
    <div className="space-y-6">
      {/* Fast Printed Registration Card (hidden on screen) */}
      {selectedPrintBooking && (
        <div className="print-only hidden p-8 bg-white text-black font-sans border border-gray-300" id="registration-print-template">
          <div className="border-b-2 border-luxury-brown-500 pb-3 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-serif font-bold text-gray-900">GRAND PAVILION BOUTIQUE HOTEL</h1>
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Fast-Track Registration Card</p>
            </div>
            <div className="text-right text-xs font-mono">
              <p>ID Reference: {selectedPrintBooking.id}</p>
              <p>Room Assigned: {selectedPrintBooking.roomNumber}</p>
            </div>
          </div>
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Primary Occupant:</strong> {selectedPrintBooking.guestName}</p>
                <p><strong>Mobile No:</strong> {selectedPrintBooking.mobile}</p>
                <p><strong>Channel Source:</strong> {selectedPrintBooking.bookingSource}</p>
              </div>
              <div>
                <p><strong>Aadhaar / National ID:</strong> {selectedPrintBooking.aadhaarNumber}</p>
                <p><strong>Address:</strong> {selectedPrintBooking.address}</p>
                <p><strong>Stay Term:</strong> {selectedPrintBooking.checkInDate} to {selectedPrintBooking.checkOutDate} ({selectedPrintBooking.nights} nights)</p>
              </div>
            </div>
            <div className="border-t border-dashed pt-4 mt-6">
              <p className="text-[10px] text-gray-500 mb-8">I certify that the information details supplied above are accurate and legal. I agree to abide by the boutique guidelines and safety directives of Grand Pavilion.</p>
              <div className="flex justify-between items-center px-4">
                <div className="border-t border-black w-40 text-center pt-1 font-mono text-[10px]">Guest Signature</div>
                <div className="border-t border-black w-40 text-center pt-1 font-mono text-[10px]">Duty Reception Officer</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Operational Title Block */}
      <div className="border-b border-luxury-brown-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center no-print">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-[#C5A059] font-bold block mb-1">
            Real-Time PMS Booking Desk
          </span>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide flex items-center gap-2">
            Today's Front Office Desk
          </h1>
          <p className="text-xs text-luxury-brown-500">
            Automatically display and manage all advance bookings, live checked-in suites, and historical checkouts
          </p>
        </div>
        <div className="mt-2 md:mt-0 flex flex-wrap items-center gap-2">
          {/* Full Date-Wise Filter Control */}
          <div className="flex flex-wrap items-center gap-1.5 bg-luxury-beige-50 p-1.5 rounded-xl border border-luxury-brown-200 text-xs font-mono">
            <span className="text-[10.5px] font-bold text-luxury-brown-700 uppercase px-1">
              Date Filter:
            </span>
            <button
              type="button"
              onClick={() => setDateFilterType('All')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                dateFilterType === 'All'
                  ? 'bg-[#17120F] text-[#E5C378] shadow-2xs'
                  : 'text-luxury-brown-700 hover:bg-amber-100/60'
              }`}
            >
              All ({bookings.length})
            </button>
            <button
              type="button"
              onClick={() => setDateFilterType('Today')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                dateFilterType === 'Today'
                  ? 'bg-[#17120F] text-[#E5C378] shadow-2xs'
                  : 'text-luxury-brown-700 hover:bg-amber-100/60'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateFilterType('Yesterday')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                dateFilterType === 'Yesterday'
                  ? 'bg-[#17120F] text-[#E5C378] shadow-2xs'
                  : 'text-luxury-brown-700 hover:bg-amber-100/60'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDateFilterType('Date')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                dateFilterType === 'Date'
                  ? 'bg-[#17120F] text-[#E5C378] shadow-2xs'
                  : 'text-luxury-brown-700 hover:bg-amber-100/60'
              }`}
            >
              Pick Date
            </button>
            <button
              type="button"
              onClick={() => setDateFilterType('This Month')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                dateFilterType === 'This Month'
                  ? 'bg-[#17120F] text-[#E5C378] shadow-2xs'
                  : 'text-luxury-brown-700 hover:bg-amber-100/60'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDateFilterType('Range')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                dateFilterType === 'Range'
                  ? 'bg-[#17120F] text-[#E5C378] shadow-2xs'
                  : 'text-luxury-brown-700 hover:bg-amber-100/60'
              }`}
            >
              From → To
            </button>

            {dateFilterType === 'Date' && (
              <input
                type="date"
                value={filterSingleDate}
                onChange={(e) => setFilterSingleDate(e.target.value)}
                className="px-2 py-0.5 ml-1 border border-luxury-brown-300 rounded text-xs bg-white text-luxury-brown-900 font-bold"
              />
            )}

            {dateFilterType === 'Range' && (
              <div className="flex items-center gap-1 ml-1">
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="px-2 py-0.5 border border-luxury-brown-300 rounded text-xs bg-white text-luxury-brown-900"
                />
                <span className="text-luxury-brown-500">→</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="px-2 py-0.5 border border-luxury-brown-300 rounded text-xs bg-white text-luxury-brown-900"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-luxury-brown-500 bg-luxury-beige-50 px-3 py-1.5 rounded-lg border border-luxury-gold-500/10 font-mono">
            <Clock className="w-3.5 h-3.5 text-luxury-gold-500 animate-spin-slow" />
            <span>Operational Clock: <strong>{todayStr} (12:00 PM)</strong></span>
          </div>
        </div>
      </div>

      {/* High-Level PMS Metrics Grid (Same PMS Overview Style) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-4 no-print">
        {/* Total Reservations */}
        <div
          onClick={() => setStatusFilter('All')}
          className={`bg-white p-3 sm:p-4 rounded-2xl border shadow-sm cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px] ${
            statusFilter === 'All'
              ? 'border-slate-800 ring-2 ring-slate-800/15 shadow-md bg-slate-50/50'
              : 'border-slate-200/80 hover:border-slate-400'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 leading-tight">Total Reservations</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-1.5 sm:mt-2 leading-tight">
              {masterBookingsList.length} Stays
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 leading-snug">
              All active & saved stays
            </div>
          </div>
        </div>

        {/* Advance Bookings */}
        <div
          onClick={() => setStatusFilter('Advance Booking')}
          className={`bg-white p-3 sm:p-4 rounded-2xl border shadow-sm cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px] ${
            statusFilter === 'Advance Booking'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md bg-amber-50/40'
              : 'border-amber-200/80 hover:border-amber-400'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-700 leading-tight">Advance Bookings</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-amber-700 mt-1.5 sm:mt-2 leading-tight">
              {countAdvance} Bookings
            </div>
            <div className="text-[10px] sm:text-[11px] text-amber-600 mt-1 leading-snug">
              Pre-booked & awaiting arrival
            </div>
          </div>
        </div>

        {/* Active Checked-In */}
        <div
          onClick={() => setStatusFilter('Checked In')}
          className={`bg-white p-3 sm:p-4 rounded-2xl border shadow-sm cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px] ${
            statusFilter === 'Checked In'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/40'
              : 'border-emerald-200/80 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 leading-tight">Active Checked-In</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-emerald-700 mt-1.5 sm:mt-2 leading-tight">
              {countCheckedIn} In-House
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-600 mt-1 leading-snug">
              Currently staying in rooms
            </div>
          </div>
        </div>

        {/* Total Checked Out */}
        <div
          onClick={() => setStatusFilter('Checked Out')}
          className={`bg-white p-3 sm:p-4 rounded-2xl border shadow-sm cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px] ${
            statusFilter === 'Checked Out'
              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/40'
              : 'border-blue-200/80 hover:border-blue-400'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-blue-700 leading-tight">Total Checked Out</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-blue-700 mt-1.5 sm:mt-2 leading-tight">
              {countCheckedOut} Stays
            </div>
            <div className="text-[10px] sm:text-[11px] text-blue-600 mt-1 leading-snug">
              Departed & room cleaning
            </div>
          </div>
        </div>

        {/* Cancelled Stays */}
        <div
          onClick={() => setStatusFilter('Cancelled')}
          className={`bg-white p-3 sm:p-4 rounded-2xl border shadow-sm cursor-pointer transition flex flex-col justify-between min-h-[112px] sm:min-h-[124px] ${
            statusFilter === 'Cancelled'
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-md bg-rose-50/40'
              : 'border-rose-200/80 hover:border-rose-400'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-700 leading-tight">Cancelled Stays</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-rose-700 mt-1.5 sm:mt-2 leading-tight">
              {countCancelled} Cancelled
            </div>
            <div className="text-[10px] sm:text-[11px] text-rose-600 mt-1 leading-snug">
              Released room inventory
            </div>
          </div>
        </div>
      </div>

      {/* 2 MAIN TABS BELOW STATS CARDS (Front Desk Dashboard Live Rack & Room Matrix - As Requested) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-luxury-brown-200/60 pb-1.5 no-print">
        <button
          type="button"
          onClick={() => setDashboardMainTab('rack')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            dashboardMainTab === 'rack'
              ? 'border-luxury-gold-500 bg-amber-50/80 text-luxury-brown-950 shadow-2xs font-extrabold'
              : 'border-transparent text-luxury-brown-500 hover:text-luxury-brown-900 hover:bg-luxury-beige-50'
          }`}
        >
          <BedDouble className="w-4 h-4 text-luxury-gold-500 shrink-0" />
          <span>Live Room Status Rack (Click Room for Booking Details or Quick Book)</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardMainTab('matrix')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            dashboardMainTab === 'matrix'
              ? 'border-luxury-gold-500 bg-amber-50/80 text-luxury-brown-950 shadow-2xs font-extrabold'
              : 'border-transparent text-luxury-brown-500 hover:text-luxury-brown-900 hover:bg-luxury-beige-50'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-luxury-gold-500 shrink-0" />
          <span>Room Matrix (interactive calendar grid view)</span>
        </button>
      </div>

      {/* TAB CONTENT: ROOM MATRIX OR LIVE ROOM STATUS RACK */}
      {dashboardMainTab === 'matrix' ? (
        <div className="bg-white rounded-2xl border border-luxury-brown-200/70 p-4 shadow-sm no-print">
          <CalendarBookingView
            rooms={rooms}
            bookings={bookings}
            onUpdateBookings={onUpdateBookings || (() => {})}
            onUpdateRooms={onUpdateRooms || (() => {})}
            onAddAuditLog={onAddAuditLog}
          />
        </div>
      ) : (
        /* LIVE ROOM STATUS RACK */
        <div className="bg-white rounded-2xl border border-luxury-brown-200/70 shadow-sm p-4 sm:p-5 space-y-4 no-print">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-luxury-brown-100">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-luxury-brown-950 flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-luxury-gold-500 shrink-0" />
                <span>Live Room Status Rack (Click Room for Booking Details or Quick Book)</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-luxury-brown-400 mt-0.5">
                Grouped by Asset Categories • Synchronized with Front Desk, Housekeeping & POS Room Service
              </p>
            </div>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Available', 'Occupied', 'Booked', 'Dirty', 'Blocked'] as const).map((st) => {
                const count = st === 'All'
                  ? rooms.length
                  : rooms.filter(r => getRoomOccupancyStatus(r) === st).length;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setRackStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border cursor-pointer ${
                      rackStatusFilter === st
                        ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold shadow-2xs'
                        : 'bg-luxury-beige-50/60 text-luxury-brown-600 border-luxury-brown-200 hover:bg-luxury-beige-100'
                    }`}
                  >
                    <span>{st}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-luxury-brown-900 font-bold border border-luxury-brown-100">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grouped by Asset Categories */}
          <div className="space-y-5">
            {(() => {
              const uniqueCategories = Array.from(
                new Set(rooms.map((r) => normalizeCategory(r.category || (r as any).type || 'Standard')).filter(Boolean))
              ).sort((a, b) => {
                const idxA = PREFERRED_CATEGORY_ORDER.indexOf(a);
                const idxB = PREFERRED_CATEGORY_ORDER.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
              });

              return uniqueCategories.map((categoryName) => {
                const categoryRooms = rooms
                  .filter((r) => {
                    const rCat = normalizeCategory(r.category || (r as any).type || 'Standard');
                    if (rCat !== categoryName) return false;
                    if (rackStatusFilter === 'All') return true;
                    return getRoomOccupancyStatus(r) === rackStatusFilter;
                  })
                  .sort((a, b) => {
                    const numA = parseInt(String(a.number).replace(/\D/g, ''), 10) || 0;
                    const numB = parseInt(String(b.number).replace(/\D/g, ''), 10) || 0;
                    return numA - numB;
                  });

                if (categoryRooms.length === 0) return null;

              return (
                <div key={categoryName} className="space-y-3">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#FAF6EE] to-white border border-[#E8DEC8] px-3.5 py-2 rounded-xl shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#C49A3A] shadow-xs" />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-[#DFB962] via-[#CEA346] to-[#BE9032] text-[#17120F] font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs border border-[#C49A3A]/40">
                        {categoryName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-[#3E5068] border border-[#E2D6BE]">
                        {categoryRooms.length} {categoryRooms.length === 1 ? 'room' : 'rooms'}
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-600 flex items-center gap-1">
                      <span className="text-slate-400 font-medium">Base Tariff:</span>
                      <strong className="text-[#17120F] font-bold font-mono">₹{(categoryRooms[0]?.rate || 2000).toLocaleString()}</strong>
                      <span className="text-slate-400">/ night</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {categoryRooms.map((room) => {
                      const occStatus = getRoomOccupancyStatus(room);
                      const activeBooking = getRoomActiveBooking(room);

                      let borderClass = 'border-emerald-300 bg-white hover:border-emerald-500';
                      let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

                      if (occStatus === 'Occupied') {
                        borderClass = 'border-blue-300 bg-white hover:border-blue-500';
                        badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
                      } else if (occStatus === 'Booked') {
                        borderClass = 'border-purple-300 bg-purple-50/20 hover:border-purple-500';
                        badgeClass = 'bg-purple-100 text-purple-800 border-purple-300';
                      } else if (occStatus === 'Dirty') {
                        borderClass = 'border-amber-300 bg-amber-50/20 hover:border-amber-500';
                        badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                      } else if (occStatus === 'Blocked') {
                        borderClass = 'border-slate-300 bg-slate-50';
                        badgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
                      }

                      return (
                        <div
                          key={room.id}
                          className={`p-3.5 rounded-xl border transition shadow-2xs flex flex-col justify-between min-h-[142px] ${borderClass}`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <h4 className="font-extrabold text-sm text-luxury-brown-950">
                                  Room {room.number}
                                </h4>
                                <p className="text-[11px] text-luxury-brown-400">
                                  {room.floor ? (room.floor.toLowerCase().includes('floor') ? room.floor : `${room.floor} Floor`) : '1st Floor'} • {room.bedType || 'King Size Bed'}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                                {occStatus}
                              </span>
                            </div>

                            <div className="mt-2 text-xs">
                              {occStatus === 'Occupied' && activeBooking ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-luxury-brown-900 truncate">{activeBooking.guestName}</div>
                                  <div className="flex justify-between text-[11px] text-luxury-brown-500 font-mono">
                                    <span>{activeBooking.checkInDate}</span>
                                    <span className="text-rose-600 font-bold">Due ₹{((activeBooking.bookingAmount || (activeBooking as any).totalAmount || (activeBooking as any).roomRate || 0) - (activeBooking.advanceAmount || 0)).toLocaleString()}</span>
                                  </div>
                                </div>
                              ) : occStatus === 'Booked' && activeBooking ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-luxury-brown-900 truncate">{activeBooking.guestName}</div>
                                  <div className="text-[10px] text-purple-700 font-mono">Arriving: {activeBooking.checkInDate}</div>
                                </div>
                              ) : occStatus === 'Dirty' ? (
                                <div className="text-[11px] text-amber-800 font-medium">Housekeeping required before next check-in</div>
                              ) : occStatus === 'Blocked' ? (
                                <div className="text-[11px] text-slate-500 font-medium">Out of Service / Maintenance</div>
                              ) : (
                                <div className="font-mono text-xs font-bold text-luxury-brown-800">
                                  ₹{(room.rate || 2000).toLocaleString()}{' '}
                                  <span className="text-[10px] font-normal text-luxury-brown-400">/ night</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Actions per Room */}
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs">
                            {occStatus === 'Available' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onCheckIn({
                                    id: `WALK-${Date.now().toString().slice(-4)}`,
                                    guestName: '',
                                    mobile: '',
                                    roomNumber: room.number,
                                    roomType: room.category,
                                    checkInDate: new Date().toISOString().split('T')[0],
                                    checkOutDate: new Date().toISOString().split('T')[0],
                                    bookingAmount: room.rate || 2000,
                                    advanceAmount: 0,
                                    bookingSource: 'Walk-in' as any,
                                    paymentMethod: 'Cash' as any,
                                    status: 'Confirmed' as any,
                                    adults: 1,
                                    children: 0,
                                    createdAt: new Date().toISOString()
                                  } as any)}
                                  className="flex-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
                                >
                                  <Plus className="w-3 h-3" /> Book
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenFoodBillModal(room, activeBooking)}
                                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                  title="Add Food / Room Service"
                                >
                                  <Utensils className="w-3 h-3" /> Food
                                </button>
                                <button
                                  type="button"
                                  onClick={() => showToast(`Housekeeping Task assigned for Room ${room.number}`, 'info')}
                                  className="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition"
                                >
                                  Task
                                </button>
                              </>
                            ) : occStatus === 'Occupied' ? (
                              <>
                                {activeBooking && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(activeBooking)}
                                    className="flex-1 py-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
                                    title="View Guest Stay & Folio Profile"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenFoodBillModal(room, activeBooking)}
                                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                  title="Add Food / Room Service"
                                >
                                  <Utensils className="w-3 h-3" /> Food
                                </button>
                                <button
                                  type="button"
                                  onClick={() => showToast(`Housekeeping Task assigned for Room ${room.number}`, 'info')}
                                  className="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition"
                                >
                                  Task
                                </button>
                              </>
                            ) : occStatus === 'Booked' ? (
                              <>
                                {activeBooking && (
                                  <button
                                    type="button"
                                    onClick={() => onCheckIn(activeBooking)}
                                    className="flex-1 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
                                  >
                                    <UserCheck className="w-3 h-3" /> Check-In
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => showToast(`Housekeeping Task assigned for Room ${room.number}`, 'info')}
                                  className="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition"
                                >
                                  Task
                                </button>
                              </>
                            ) : occStatus === 'Dirty' ? (
                              <button
                                type="button"
                                onClick={() => handleCleanRoomUnit(room.number)}
                                className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
                              >
                                <Sparkles className="w-3.5 h-3.5" /> Clean Room (Dirty)
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Maintenance</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        </div>
      )}

      {/* PMS Advanced Filter Toolbar */}
      <div className="bg-white p-4 border border-luxury-brown-200/50 rounded-2xl space-y-3.5 shadow-2xs no-print">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Quick Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-luxury-brown-400" />
            <input
              type="text"
              placeholder="Search by ID, guest name, mobile, or room unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-luxury-brown-200 rounded-xl text-xs bg-luxury-beige-50/10 focus:outline-none focus:ring-1 focus:ring-luxury-gold-500 text-luxury-brown-950"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Status Selector Dropdown */}
            <div className="flex items-center gap-1 bg-luxury-beige-50 px-2.5 py-1 rounded-xl border border-luxury-brown-200">
              <span className="text-[10px] font-mono text-luxury-brown-500 font-bold uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-serif font-bold text-luxury-brown-900 border-none focus:outline-none p-0 pr-6 cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Advance Booking">Advance Booking</option>
                <option value="Checked In">Checked In</option>
                <option value="Checked Out">Checked Out</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Room Category Dropdown */}
            <div className="flex items-center gap-1 bg-luxury-beige-50 px-2.5 py-1 rounded-xl border border-luxury-brown-200">
              <span className="text-[10px] font-mono text-luxury-brown-500 font-bold uppercase">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-xs font-serif font-bold text-luxury-brown-900 border-none focus:outline-none p-0 pr-6 cursor-pointer"
              >
                <option value="All">All Categories</option>
                {Array.from(new Set(masterBookingsList.map(b => b.roomType))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setCategoryFilter('All');
              }}
              title="Reset Search Parameters"
              className="px-3 py-1.5 bg-luxury-brown-50 hover:bg-luxury-brown-100 text-luxury-brown-850 rounded-xl text-xs font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Booking PMS Data Table */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-2xl overflow-hidden shadow-xs no-print">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 px-4 space-y-3">
            <div className="w-14 h-14 bg-luxury-beige-50 rounded-full flex items-center justify-center text-luxury-brown-300 mx-auto border border-luxury-gold-500/10">
              <UserX className="size-6 text-luxury-gold-500" />
            </div>
            <div>
              <p className="text-md font-serif font-semibold text-luxury-brown-900">No Reservations Found</p>
              <p className="text-xs text-luxury-brown-400 max-w-md mx-auto mt-1">
                There are no advance bookings or stay logs matching your active filter choices. Try modifying your search parameters.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-luxury-beige-50/80 border-b border-luxury-brown-100 font-serif text-luxury-brown-900 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Booking ID</th>
                  <th className="py-3 px-2.5 font-bold text-left whitespace-nowrap">Guest Details</th>
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Mobile Number</th>
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Room Unit</th>
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Room Category</th>
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Booking Amount</th>
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Stay Timeline</th>
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Booking Status</th>
                  <th className="py-3 px-2.5 font-bold text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-50">
                {filteredBookings.map((b) => {
                  const statusText = getBookingStatusText(b);
                  const bAmount = getBookingAmountVal(b);
                  
                  return (
                    <tr key={b.id} className="hover:bg-luxury-brown-50/20 transition-colors">
                      {/* Booking ID */}
                      <td className="py-3 px-2.5 text-center font-mono font-bold text-luxury-brown-950 whitespace-nowrap">
                        {b.id}
                      </td>

                      {/* Guest Details */}
                      <td className="py-3 px-2.5 text-left whitespace-nowrap">
                        <div>
                          <p className="font-serif font-bold text-luxury-brown-900 text-sm">{b.guestName}</p>
                          <p className="text-[10px] font-mono text-luxury-brown-300 uppercase mt-0.5">
                            Source: {b.bookingSource}
                          </p>
                        </div>
                      </td>

                      {/* Mobile Number */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <span className="font-mono text-luxury-brown-850 inline-flex items-center justify-center gap-1 whitespace-nowrap">
                          <Phone className="w-3 h-3 text-luxury-brown-350 shrink-0" />
                          {b.mobile}
                        </span>
                      </td>

                      {/* Room Number */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 bg-[#17120F] !text-[#C49A3A] font-mono font-bold rounded-lg border border-[#C49A3A]/30 whitespace-nowrap text-xs">
                          Room {b.roomNumber}
                        </span>
                      </td>

                      {/* Room Category */}
                      <td className="py-3 px-2.5 text-center font-semibold text-[#263449] whitespace-nowrap">
                        {b.roomType}
                      </td>

                      {/* Booking Amount */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center">
                          <div className="font-mono font-bold text-[#263449] text-sm">
                            ₹{Number(bAmount || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Paid: <span className="font-bold text-[#15805D]">₹{Number(b.advanceAmount || 0).toLocaleString()}</span>
                          </div>
                          {b.transactionId && (
                            <div className="text-[9px] text-slate-400 font-mono truncate max-w-[120px] mx-auto select-all" title={b.transactionId}>
                              Txn: {b.transactionId}
                            </div>
                          )}
                          <div className="mt-1">
                            {(() => {
                              const pStat = b.paymentStatus || (b.advanceAmount === 0 ? 'Unpaid' : (b.advanceAmount >= bAmount ? 'Fully Paid' : 'Partially Paid'));
                              switch (pStat) {
                                case 'Fully Paid':
                                  return <span className="inline-block text-[9px] font-bold !text-[#15805D] bg-emerald-50 px-2 py-0.5 rounded-full font-mono border border-emerald-200 whitespace-nowrap">Fully Paid</span>;
                                case 'Partially Paid':
                                  return <span className="inline-block text-[9px] font-bold !text-[#9E7822] bg-amber-50 px-2 py-0.5 rounded-full font-mono border border-amber-200 whitespace-nowrap">Partially Paid</span>;
                                case 'Unpaid':
                                default:
                                  return <span className="inline-block text-[9px] font-bold !text-[#D92D4B] bg-rose-50 px-2 py-0.5 rounded-full font-mono border border-rose-200 whitespace-nowrap">Unpaid</span>;
                              }
                            })()}
                          </div>
                        </div>
                      </td>

                      {/* Stay Timeline */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-start text-[11px] font-mono text-[#263449] font-medium">
                          <p className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#15805D] inline-block shrink-0" />
                            {b.checkInDate}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D92D4B] inline-block shrink-0" />
                            {b.checkOutDate} ({b.nights}N)
                          </p>
                        </div>
                      </td>

                      {/* Booking Status Badge */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        {statusText === 'Advance Booking' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 !text-[#9E7822] rounded-full text-[10px] font-bold border border-amber-200 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-[#C49A3A] shrink-0" /> Advance Booking
                          </span>
                        )}
                        {statusText === 'Checked In' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 !text-[#15805D] rounded-full text-[10px] font-bold border border-emerald-200 whitespace-nowrap">
                            <UserCheck className="w-3 h-3 text-[#15805D] shrink-0" /> Checked In
                          </span>
                        )}
                        {statusText === 'Checked Out' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 !text-[#263449] rounded-full text-[10px] font-bold border border-slate-200 whitespace-nowrap">
                            <Check className="w-3 h-3 text-slate-500 shrink-0" /> Checked Out
                          </span>
                        )}
                        {statusText === 'Cancelled' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 !text-[#D92D4B] rounded-full text-[10px] font-bold border border-rose-200 whitespace-nowrap">
                            <X className="w-3 h-3 text-[#D92D4B] shrink-0" /> Cancelled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex justify-center items-center gap-1 flex-nowrap">
                          {/* View details (Icon Only to prevent overflow next to Check-Out) */}
                          <button
                            onClick={() => openGuestDetailsByBooking(b)}
                            title="View guest stay profile details"
                            className="px-2 py-1 border border-luxury-brown-200 bg-white hover:bg-luxury-beige-50 rounded-lg !text-[#263449] inline-flex items-center justify-center transition-colors font-bold text-[10.5px] cursor-pointer shadow-2xs shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C49A3A] shrink-0" />
                          </button>

                          {/* Edit Details (before checkout only) */}
                          {statusText !== 'Checked Out' && statusText !== 'Cancelled' && (
                            <button
                              onClick={() => handleOpenEditModal(b)}
                              title="Edit guest, rooms, or price particulars"
                              className="px-2 py-1 border border-luxury-brown-200 bg-white hover:bg-luxury-beige-50 rounded-lg !text-[#263449] inline-flex items-center gap-1 transition-colors font-bold text-[10.5px] whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
                            >
                              <Pencil className="w-3 h-3 text-[#C49A3A] shrink-0" /> Edit
                            </button>
                          )}
                          
                          {/* Generate / View Invoice */}
                          <button
                            onClick={() => handleGenerateOrViewInvoiceForBooking(b)}
                            title={invoices?.some(i => i.bookingId === b.id) ? "View Official Invoice" : "Generate Official Invoice for Booking"}
                            className="px-2 py-1 bg-[#17120F] hover:bg-[#241C17] !text-[#C49A3A] border border-[#C49A3A]/30 rounded-lg inline-flex items-center gap-1 transition-colors font-bold text-[10.5px] whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
                          >
                            <Receipt className="w-3 h-3 text-[#C49A3A] shrink-0" />
                            <span>{invoices?.some(i => i.bookingId === b.id) ? "View Invoice" : "Invoice"}</span>
                          </button>

                          {/* Print registration card option */}
                          <button
                            onClick={() => handlePrintCard(b)}
                            title="Print registration receipt form"
                            className="px-2 py-1 border border-luxury-brown-200 bg-white hover:bg-luxury-beige-50 rounded-lg !text-[#263449] inline-flex items-center gap-1 transition-colors font-bold text-[10.5px] whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
                          >
                            <Printer className="w-3 h-3 text-[#263449] shrink-0" /> GRC
                          </button>

                          {/* Action specific: Check in only for Advance bookings */}
                          {statusText === 'Advance Booking' && (
                            <button
                              onClick={() => onCheckIn(b)}
                              className="px-2 py-1 bg-[#C49A3A] hover:bg-[#B0862B] !text-[#17120F] font-bold rounded-lg inline-flex items-center gap-1 transition-colors text-[10.5px] whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
                            >
                              <UserCheck className="w-3 h-3 shrink-0" /> Check-In
                            </button>
                          )}

                          {/* Action specific: Check out & Upgrade only after Check-In */}
                          {statusText === 'Checked In' && (
                            <>
                              <button
                                onClick={() => handleOpenUpgradeModal(b)}
                                className="px-2 py-1 bg-[#C49A3A] hover:bg-[#B0862B] !text-[#17120F] font-bold rounded-lg inline-flex items-center gap-1 transition-colors text-[10.5px] whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
                                title="Upgrade or move guest room during active stay"
                              >
                                <ArrowUpRight className="w-3 h-3 shrink-0" /> Upgrade
                              </button>

                              <button
                                onClick={() => handleOpenCheckoutModal(b)}
                                className="px-2 py-1 bg-[#15805D] hover:bg-[#11694B] !text-white font-bold rounded-lg inline-flex items-center gap-1 transition-colors text-[10.5px] whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
                                title="Begin Checkout Room Verification Checklist"
                              >
                                <UserX className="w-3 h-3 shrink-0" /> Check-Out
                              </button>
                            </>
                          )}

                          {/* Delete Booking Option */}
                          <button
                            onClick={() => handleDeleteBooking(b)}
                            className="px-2 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 !text-[#D92D4B] rounded-lg inline-flex items-center gap-1 transition-colors font-bold text-[10.5px] whitespace-nowrap cursor-pointer shrink-0"
                            title="Permanently Delete Booking"
                          >
                            <Trash2 className="w-3 h-3 text-[#D92D4B] shrink-0" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Card list for mobile screens */}
          <div className="block md:hidden divide-y divide-luxury-brown-100">
            {filteredBookings.map((b) => {
              const statusText = getBookingStatusText(b);
              const bAmount = getBookingAmountVal(b);
              return (
                <div key={b.id} className="p-4 space-y-3 bg-white">
                  {/* Top Header */}
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-luxury-brown-950 bg-luxury-beige-100 px-2 py-0.5 rounded text-[10px]">
                      ID: {b.id}
                    </span>
                    <div>
                      {statusText === 'Advance Booking' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200/40">
                          <Clock className="w-3 h-3 text-amber-500" /> Advance
                        </span>
                      )}
                      {statusText === 'Checked In' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full text-[10px] font-bold border border-emerald-200/40">
                          <UserCheck className="w-3 h-3 text-emerald-600 animate-pulse" /> Checked In
                        </span>
                      )}
                      {statusText === 'Checked Out' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-[10px] font-bold border border-slate-200">
                          <Check className="w-3 h-3 text-slate-500" /> Checked Out
                        </span>
                      )}
                      {statusText === 'Cancelled' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full text-[10px] font-bold border border-rose-200/40">
                          <X className="w-3 h-3 text-rose-500" /> Cancelled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Guest and Phone */}
                  <div>
                    <h4 className="font-serif font-bold text-luxury-brown-950 text-sm">{b.guestName}</h4>
                    <p className="text-[11px] text-luxury-brown-600 font-mono flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3 text-luxury-brown-400" /> {b.mobile}
                    </p>
                  </div>

                  {/* Room Particulars & Stay Timeline */}
                  <div className="grid grid-cols-2 gap-3 bg-luxury-beige-50/60 p-2.5 rounded-xl border border-luxury-brown-100/30 text-[11px]">
                    <div>
                      <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-semibold">Room Assigned</span>
                      <strong className="text-luxury-brown-950 font-mono">Suite {b.roomNumber}</strong>
                      <span className="block text-[10px] text-luxury-brown-500">{b.roomType}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-semibold">Timeline</span>
                      <p className="font-mono text-luxury-brown-900 font-bold">{b.checkInDate} to {b.checkOutDate}</p>
                      <span className="block text-[10px] text-luxury-brown-500 font-mono">({b.nights} {b.nights === 1 ? 'Night' : 'Nights'})</span>
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="space-y-1.5 bg-luxury-beige-50/20 p-2 rounded-lg border border-dashed border-luxury-brown-100">
                    <div className="flex justify-between items-center text-[11px]">
                      <div>
                        <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-semibold">Tariff Amount</span>
                        <strong className="font-mono font-bold text-luxury-brown-900">₹{Number(bAmount || 0).toLocaleString()}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-semibold">Advance Deposit</span>
                        <strong className="font-mono font-bold text-emerald-700">₹{Number(b.advanceAmount || 0).toLocaleString()}</strong>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-luxury-brown-100/50 text-[10px]">
                      <span className="text-luxury-brown-500 font-mono">
                        {b.transactionId ? `Txn: ${b.transactionId}` : `via ${b.paymentMethod}`}
                      </span>
                      {(() => {
                        const pStat = b.paymentStatus || (b.advanceAmount === 0 ? 'Unpaid' : (b.advanceAmount >= bAmount ? 'Fully Paid' : 'Partially Paid'));
                        switch (pStat) {
                          case 'Fully Paid':
                            return <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono border border-emerald-100">Fully Paid</span>;
                          case 'Partially Paid':
                            return <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono border border-amber-100">Partially Paid</span>;
                          case 'Unpaid':
                          default:
                            return <span className="inline-block text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-mono border border-rose-100">Unpaid</span>;
                        }
                      })()}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <button
                      onClick={() => openGuestDetailsByBooking(b)}
                      className="flex-1 min-w-[70px] p-2 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 rounded text-luxury-brown-850 flex items-center justify-center gap-1 text-[11px] font-medium cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-luxury-brown-500" /> View
                    </button>

                    {statusText !== 'Checked Out' && statusText !== 'Cancelled' && (
                      <button
                        onClick={() => handleOpenEditModal(b)}
                        className="flex-1 min-w-[70px] p-2 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 rounded text-luxury-brown-850 flex items-center justify-center gap-1 text-[11px] font-medium cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-luxury-gold-500" /> Edit
                      </button>
                    )}

                    <button
                      onClick={() => handleGenerateOrViewInvoiceForBooking(b)}
                      className="flex-1 min-w-[70px] p-2 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 rounded flex items-center justify-center gap-1 text-[11px] font-bold cursor-pointer shadow-2xs"
                    >
                      <Receipt className="w-3.5 h-3.5 text-luxury-gold-400" />
                      <span>{invoices?.some(i => i.bookingId === b.id) ? "View Inv" : "Invoice"}</span>
                    </button>

                    <button
                      onClick={() => handlePrintCard(b)}
                      className="flex-1 min-w-[70px] p-2 bg-white border border-luxury-brown-200 hover:bg-luxury-beige-100 rounded text-luxury-brown-850 flex items-center justify-center gap-1 text-[11px] font-medium cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-luxury-brown-500" /> Print
                    </button>

                    {statusText === 'Advance Booking' && (
                      <button
                        onClick={() => onCheckIn(b)}
                        className="flex-1 min-w-[90px] p-2 bg-[#C5A059] hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded flex items-center justify-center gap-1 text-[11px] cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Check-In
                      </button>
                    )}

                    {statusText === 'Checked In' && (
                      <>
                        <button
                          onClick={() => handleOpenUpgradeModal(b)}
                          className="flex-1 min-w-[90px] p-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded flex items-center justify-center gap-1 text-[11px] cursor-pointer"
                          title="Upgrade guest room"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" /> Upgrade
                        </button>

                        <button
                          onClick={() => handleOpenCheckoutModal(b)}
                          className="flex-1 min-w-[90px] p-2 bg-luxury-brown-950 hover:bg-luxury-brown-850 text-white font-bold rounded flex items-center justify-center gap-1 text-[11px] cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5 text-luxury-gold-300" /> Check-Out
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteBooking(b)}
                      className="p-2 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded flex items-center justify-center gap-1 text-[11px] font-medium cursor-pointer"
                      title="Permanently Delete Booking"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>

      {/* Guest Profile read-only Detailed Modal */}
      {selectedGuestDetails && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-luxury-gold-500/30 overflow-hidden shadow-2xl animate-in fade-in duration-300">
            {/* Modal Header */}
            <div className="bg-luxury-brown-900 p-5 text-white flex justify-between items-center border-b border-luxury-gold-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-luxury-gold-400" />
                <h2 className="text-md font-serif font-bold text-luxury-beige-50">Grand Pavilion Resident Profiles</h2>
              </div>
              <button 
                onClick={() => setSelectedGuestDetails(null)}
                className="text-luxury-brown-300 hover:text-white transition-colors p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Profile card summary */}
              <div className="flex items-start gap-4 p-4 bg-luxury-beige-50 rounded-xl border border-luxury-gold-500/10">
                <div className="w-20 h-20 bg-luxury-gold-200/40 border border-luxury-gold-300 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {selectedGuestDetails.guestPhotoData ? (
                    <img src={selectedGuestDetails.guestPhotoData} alt="portrait" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-luxury-brown-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-md font-serif font-bold text-luxury-brown-900">{selectedGuestDetails.guestName}</h3>
                  <p className="text-xs text-luxury-brown-500 mt-1">Primary Guest / Occupying Room <strong>{selectedGuestDetails.roomNumber}</strong></p>
                  <div className="flex gap-4 text-xs font-mono text-luxury-brown-500 mt-2">
                    <p>Phone: <strong>{selectedGuestDetails.mobile}</strong></p>
                    <p>Nationality: <strong>{selectedGuestDetails.nationality}</strong></p>
                  </div>
                </div>
              </div>

              {/* Personal and ID coordinates */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <h4 className="font-semibold text-luxury-brown-950 uppercase tracking-wide border-b pb-1 mb-2">Staying Logistics</h4>
                  <p className="text-luxury-brown-500 mt-1">Check-in Date: <strong className="text-luxury-brown-900">{selectedGuestDetails.checkInDate}</strong></p>
                  <p className="text-luxury-brown-500 mt-1">Check-out Date: <strong className="text-luxury-brown-900">{selectedGuestDetails.checkOutDate}</strong></p>
                  <p className="text-luxury-brown-500 mt-1">Assigned Base Tariff: <strong className="text-luxury-brown-900">₹{Number(selectedGuestDetails.roomRate || 0).toLocaleString()}/night</strong></p>
                  <p className="text-luxury-brown-500 mt-1">Checked-In By: <strong className="text-luxury-brown-900">{selectedGuestDetails.checkedInBy || 'Duty Officer'}</strong></p>
                  <p className="text-luxury-brown-500 mt-1">Logged Time: <strong className="text-luxury-brown-900">{selectedGuestDetails.registrationLoggedTime || selectedGuestDetails.checkInTime || 'Auto-Detected'}</strong></p>
                </div>
                <div>
                  <h4 className="font-semibold text-luxury-brown-950 uppercase tracking-wide border-b pb-1 mb-2">Legal Coordinates</h4>
                  <p className="text-luxury-brown-500 mt-1">Government ID Proof: <strong className="text-luxury-brown-900">{selectedGuestDetails.aadhaarNumber}</strong></p>
                  <p className="text-luxury-brown-500 mt-1">Permanent Address: <strong className="text-luxury-brown-900">{selectedGuestDetails.address}</strong></p>
                  <p className="text-luxury-brown-500 mt-1">Nationality Category: <strong className="text-luxury-brown-900">{selectedGuestDetails.nationality}</strong></p>
                </div>
              </div>

              {/* Companion details */}
              <div>
                <h4 className="font-semibold text-luxury-brown-950 uppercase tracking-wide border-b pb-1 mb-2">Companion Occupants (Multiple Occupancy)</h4>
                {!selectedGuestDetails.secondaryGuests || selectedGuestDetails.secondaryGuests.length === 0 ? (
                  <p className="text-xs text-luxury-brown-300 italic pt-1">No secondary companion registered for this room occupancy.</p>
                ) : (
                  <div className="space-y-3 mt-2 pr-1">
                    {selectedGuestDetails.secondaryGuests.map((sg, sidx) => (
                      <div key={sidx} className="p-3 bg-white border border-luxury-brown-200/50 rounded-lg shadow-2xs">
                        <div className="flex justify-between items-center mb-1 bg-luxury-beige-100/50 p-1 px-2.5 rounded font-serif font-bold text-luxury-brown-900">
                          <span>Companion Guest #{sidx + 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-luxury-brown-650 mt-1 p-1">
                          <p>Full Name: <strong>{sg.fullName}</strong></p>
                          <p>Mobile: <strong>{sg.mobile || 'Not Registered'}</strong></p>
                          <p>National ID: <strong>{sg.aadhaarNumber || 'Not Registered'}</strong></p>
                          <p>Permanent Address: <strong className="truncate block">{sg.address || 'Same as primary'}</strong></p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Room Upgrade & Relocation History */}
              {selectedGuestDetails.upgradeHistory && selectedGuestDetails.upgradeHistory.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="font-semibold text-luxury-brown-950 uppercase tracking-wide border-b pb-1 text-xs flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-luxury-gold-600" /> Room Upgrade & Relocation History
                  </h4>
                  <div className="space-y-2">
                    {selectedGuestDetails.upgradeHistory.map((upg, idx) => (
                      <div key={upg.id || idx} className="p-3 bg-luxury-beige-50 border border-luxury-gold-500/20 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between items-center text-luxury-brown-950 font-bold font-serif">
                          <span>Suite #{upg.oldRoomNumber} ({upg.oldRoomCategory}) → Suite #{upg.newRoomNumber} ({upg.newRoomCategory})</span>
                          <span className="text-emerald-700 font-mono">+₹{Number(upg.totalUpgradeCharge || 0).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-luxury-brown-600 font-mono pt-1">
                          <p>Remaining Nights: <strong>{upg.remainingNights}</strong></p>
                          <p>Rate Difference: <strong>₹{Number(upg.rateDifferencePerNight || 0).toLocaleString()}/night</strong></p>
                          <p>Upgraded Date: <strong>{new Date(upg.upgradedAt).toLocaleDateString()}</strong></p>
                          <p>Authorized By: <strong>{upg.upgradedBy || 'Reception'}</strong></p>
                        </div>
                        {upg.reason && (
                          <p className="text-[11px] text-luxury-brown-700 italic border-t border-luxury-brown-100 pt-1 mt-1">
                            Reason: "{upg.reason}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-luxury-beige-50 p-4 border-t flex justify-between items-center gap-2 text-xs">
              <div>
                {(() => {
                  const b = bookings.find(item => item.id === selectedGuestDetails.id || item.roomNumber === selectedGuestDetails.roomNumber);
                  if (b && isBookingCheckedIn(b)) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedGuestDetails(null);
                          handleOpenUpgradeModal(b);
                        }}
                        className="px-3.5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <ArrowUpRight className="w-4 h-4" /> Upgrade Guest Room
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>

              <button
                onClick={() => setSelectedGuestDetails(null)}
                className="px-4 py-2 border border-luxury-brown-250 bg-white text-luxury-brown-850 hover:bg-luxury-beige-50 rounded-lg transition-colors font-medium cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE EDIT BOOKING MODAL (PMS EDITOR) */}
      {isEditModalOpen && selectedEditBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-luxury-gold-500/30 overflow-hidden shadow-2xl my-8 animate-in fade-in duration-300">
            {/* Modal Header */}
            <div className="bg-luxury-brown-900 p-5 text-white flex justify-between items-center border-b border-luxury-gold-500/20">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-luxury-gold-400" />
                <div>
                  <h3 className="text-sm font-serif font-bold text-luxury-gold-200">
                    Edit Front-Desk Reservation Particulars
                  </h3>
                  <p className="text-[10px] text-luxury-gold-300/80 font-mono mt-0.5">Booking ID: {selectedEditBooking.id}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedEditBooking(null);
                }}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto text-xs font-sans">
              
              {/* Part 1: Primary Guest Details */}
              <div className="space-y-3.5">
                <h4 className="font-serif font-bold text-luxury-brown-950 text-xs border-b border-luxury-brown-100 pb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-luxury-gold-500" /> 1. Guest Registration Info
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Guest Name *</label>
                    <input
                      type="text"
                      value={editForm.guestName}
                      onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Mobile Number *</label>
                    <input
                      type="text"
                      value={editForm.mobile}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Email Address</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Aadhaar / Passport ID Proof</label>
                    <input
                      type="text"
                      value={editForm.aadhaarNumber}
                      onChange={(e) => setEditForm({ ...editForm, aadhaarNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Permanent Address</label>
                  <textarea
                    rows={2}
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Part 2: Room Inventory Assignment */}
              <div className="space-y-3.5">
                <h4 className="font-serif font-bold text-luxury-brown-950 text-xs border-b border-luxury-brown-100 pb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-luxury-gold-500" /> 2. Room Unit & Category Setup
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Assigned Room Unit *</label>
                    <select
                      value={editForm.roomNumber}
                      onChange={(e) => {
                        const selectedNum = e.target.value;
                        const matchingRoom = rooms.find(r => r.number === selectedNum);
                        const rate = matchingRoom ? matchingRoom.rate : 2500;
                        const cat = matchingRoom ? matchingRoom.category : 'Standard';
                        
                        // Calculate nights
                        const calculatedNights = calcNights(editForm.checkInDate, editForm.checkOutDate);
                        
                        setEditForm({
                          ...editForm,
                          roomNumber: selectedNum,
                          roomType: cat,
                          bookingAmount: rate * calculatedNights
                        });
                      }}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    >
                      <option value="">Select Room Number</option>
                      {rooms.map(room => (
                        <option key={room.id} value={room.number}>
                          Suite {room.number} - {room.category} (₹{Number(room.rate || 0).toLocaleString()}/N)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Derived Room Category</label>
                    <input
                      type="text"
                      value={editForm.roomType}
                      onChange={(e) => setEditForm({ ...editForm, roomType: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-luxury-beige-50 text-luxury-brown-850 text-xs focus:outline-none cursor-not-allowed"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Part 3: Stay Dates & Duration */}
              <div className="space-y-3.5">
                <h4 className="font-serif font-bold text-luxury-brown-950 text-xs border-b border-luxury-brown-100 pb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-luxury-gold-500" /> 3. Timeline & Duration
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Check-In Date *</label>
                    <input
                      type="date"
                      value={editForm.checkInDate}
                      onChange={(e) => {
                        const inDate = e.target.value;
                        const calculatedNights = calcNights(inDate, editForm.checkOutDate);
                        const room = rooms.find(r => r.number === editForm.roomNumber);
                        const rate = room ? room.rate : 2500;
                        
                        setEditForm({
                          ...editForm,
                          checkInDate: inDate,
                          bookingAmount: rate * calculatedNights
                        });
                      }}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Check-Out Date *</label>
                    <input
                      type="date"
                      value={editForm.checkOutDate}
                      onChange={(e) => {
                        const outDate = e.target.value;
                        const calculatedNights = calcNights(editForm.checkInDate, outDate);
                        const room = rooms.find(r => r.number === editForm.roomNumber);
                        const rate = room ? room.rate : 2500;
                        
                        setEditForm({
                          ...editForm,
                          checkOutDate: outDate,
                          bookingAmount: rate * calculatedNights
                        });
                      }}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-luxury-beige-50 rounded-xl border border-luxury-brown-100 flex justify-between items-center">
                  <span className="font-serif font-bold text-luxury-brown-900">Total Calculated Stay Duration:</span>
                  <strong className="font-mono text-xs text-luxury-brown-950 bg-[#C5A059]/20 px-3 py-1 rounded-md">
                    {calcNights(editForm.checkInDate, editForm.checkOutDate)} Nights
                  </strong>
                </div>
              </div>

              {/* Part 4: Financial particulars */}
              <div className="space-y-3.5">
                <h4 className="font-serif font-bold text-luxury-brown-950 text-xs border-b border-luxury-brown-100 pb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-luxury-gold-500" /> 4. Financial & Tariff Details
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Total Room Amount (Tariff)</label>
                    <input
                      type="number"
                      value={editForm.bookingAmount}
                      onChange={(e) => setEditForm({ ...editForm, bookingAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Advance Amount Paid</label>
                    <input
                      type="number"
                      value={editForm.advanceAmount}
                      onChange={(e) => setEditForm({ ...editForm, advanceAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Booking Source</label>
                    <select
                      value={editForm.bookingSource}
                      onChange={(e) => setEditForm({ ...editForm, bookingSource: e.target.value as any })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    >
                      <option value="Walk-in">Walk-in (Direct)</option>
                      <option value="OYO">OYO Rooms</option>
                      <option value="Agoda">Agoda</option>
                      <option value="Booking.com">Booking.com</option>
                      <option value="Goibibo">Goibibo</option>
                      <option value="MakeMyTrip">MakeMyTrip</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Payment Method</label>
                    <select
                      value={editForm.paymentMethod}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        if (val === 'Hybrid') {
                          setEditHybridRows(createInitialHybridRows(Number((editForm as any).advanceAmount) || 0, ['Cash', 'UPI', 'Card', 'Online']));
                        }
                        setEditForm({ ...editForm, paymentMethod: val });
                      }}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    >
                      <option value="Cash">Cash Currency</option>
                      <option value="Online">Online Bank Transfer</option>
                      <option value="Card">Credit/Debit Card</option>
                      <option value="UPI">UPI Digital Payment</option>
                      <option value="Hybrid">⇄ Hybrid / Split Payment</option>
                    </select>
                    {editForm.paymentMethod === 'Hybrid' && (
                      <HybridSplitPaymentBox
                        rows={editHybridRows}
                        onChange={(rows) => {
                          setEditHybridRows(rows);
                          setEditForm({ ...editForm, transactionId: formatHybridLabel(rows) });
                        }}
                        modes={['Cash', 'UPI', 'Card', 'Online']}
                        compact
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Transaction Reference ID</label>
                    <input
                      type="text"
                      value={editForm.transactionId}
                      onChange={(e) => setEditForm({ ...editForm, transactionId: e.target.value })}
                      placeholder="e.g. UPI-992384918"
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Payment Status</label>
                    <select
                      value={editForm.paymentStatus}
                      onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value as any })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    >
                      <option value="Unpaid">Unpaid / Pending</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Fully Paid">Fully Paid</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    >
                      <option value="Confirmed">Confirmed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Adults</label>
                      <input
                        type="number"
                        min={1}
                        value={editForm.adults}
                        onChange={(e) => setEditForm({ ...editForm, adults: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Children</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.children}
                        onChange={(e) => setEditForm({ ...editForm, children: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Reception Notes & Directives</label>
                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-900 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer buttons */}
            <div className="bg-luxury-beige-50/50 p-4 border-t flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleSaveEditForm}
                className="px-5 py-2.5 bg-[#C5A059] hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-bold rounded-lg transition shadow-md cursor-pointer"
              >
                ✓ Save Changes
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedEditBooking(null);
                }}
                className="px-5 py-2.5 border border-luxury-brown-200 bg-white text-luxury-brown-850 hover:bg-luxury-beige-100 rounded-lg transition cursor-pointer"
              >
                Cancel Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. EXPRESS CHECK-IN REGISTRATION MODAL */}
      {isCheckInModalOpen && selectedCheckInBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-luxury-gold-500/30 overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-luxury-brown-950 p-5 text-white flex justify-between items-center border-b border-luxury-gold-500/20">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="text-sm font-serif font-bold text-luxury-gold-200">
                  Guest Registration & Express Check-In
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsCheckInModalOpen(false);
                  setSelectedCheckInBooking(null);
                }}
                className="text-white/85 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs font-sans max-h-[70vh] overflow-y-auto">
              <div className="bg-luxury-beige-50 p-3.5 rounded-xl border border-luxury-brown-100 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Guest Name</span>
                  <strong className="text-sm text-luxury-brown-900 font-serif">{selectedCheckInBooking.guestName}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Assigned Unit</span>
                  <strong className="text-sm text-luxury-brown-900 font-serif">Suite {selectedCheckInBooking.roomNumber} ({selectedCheckInBooking.roomType})</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Stay Dates</span>
                  <span className="font-mono text-luxury-brown-850 font-bold">{selectedCheckInBooking.checkInDate} to {selectedCheckInBooking.checkOutDate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-luxury-brown-400 block font-bold">Advance Deposited</span>
                  <span className="font-mono text-[#C5A059] font-bold">₹{Number(selectedCheckInBooking.advanceAmount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* ID Proof Fields */}
              <div className="space-y-3.5">
                <h4 className="font-serif font-bold text-luxury-brown-950 text-xs border-b border-luxury-brown-100 pb-1 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-[#C5A059]" /> Government ID Verification *
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">ID Document Type *</label>
                    <select
                      value={checkInForm.idType}
                      onChange={(e) => setCheckInForm({ ...checkInForm, idType: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950"
                    >
                      <option value="Aadhaar">Aadhaar Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter ID">Voter ID</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">ID Document Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 5642 1245 9852"
                      value={checkInForm.idNumber}
                      onChange={(e) => setCheckInForm({ ...checkInForm, idNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950 text-xs focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Address Fields */}
              <div className="space-y-3.5">
                <h4 className="font-serif font-bold text-luxury-brown-950 text-xs border-b border-luxury-brown-100 pb-1 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#C5A059]" /> Contact Address Particulars
                </h4>
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Street Address</label>
                    <input
                      type="text"
                      placeholder="Plot No, Street, Locality"
                      value={checkInForm.address}
                      onChange={(e) => setCheckInForm({ ...checkInForm, address: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">City</label>
                      <input
                        type="text"
                        value={checkInForm.city}
                        onChange={(e) => setCheckInForm({ ...checkInForm, city: e.target.value })}
                        className="w-full px-2 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">State</label>
                      <input
                        type="text"
                        value={checkInForm.state}
                        onChange={(e) => setCheckInForm({ ...checkInForm, state: e.target.value })}
                        className="w-full px-2 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Nationality</label>
                      <input
                        type="text"
                        value={checkInForm.nationality}
                        onChange={(e) => setCheckInForm({ ...checkInForm, nationality: e.target.value })}
                        className="w-full px-2 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Corporate Billing */}
              <div className="space-y-3.5">
                <h4 className="font-serif font-bold text-luxury-brown-950 text-xs border-b border-luxury-brown-100 pb-1 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-4 h-4 text-[#C5A059]" /> Corporate Invoice Setup (Optional)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Company Name</label>
                    <input
                      type="text"
                      placeholder="Corporate Name"
                      value={checkInForm.companyName}
                      onChange={(e) => setCheckInForm({ ...checkInForm, companyName: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-500">Company GSTIN</label>
                    <input
                      type="text"
                      placeholder="15-character GST"
                      value={checkInForm.gstNumber}
                      onChange={(e) => setCheckInForm({ ...checkInForm, gstNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-luxury-beige-50/50 p-4 border-t flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleConfirmExpressCheckIn}
                className="px-5 py-2.5 bg-[#C5A059] hover:bg-luxury-gold-400 text-luxury-brown-950 font-serif font-bold rounded-lg transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Issue Room & Activate Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCheckInModalOpen(false);
                  setSelectedCheckInBooking(null);
                }}
                className="px-5 py-2.5 border border-luxury-brown-200 bg-white text-luxury-brown-850 hover:bg-luxury-beige-100 rounded-lg transition cursor-pointer"
              >
                Cancel Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. UNIFIED CHECKOUT & PAYMENT SETTLEMENT MODAL */}
      {isCheckoutModalOpen && checkoutCheckIn && checkoutBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full border border-luxury-gold-500/30 overflow-hidden shadow-2xl my-4 animate-in fade-in duration-200">
            
            {/* Modal Header */}
            <div className="bg-luxury-brown-950 p-5 text-white flex justify-between items-center border-b border-luxury-gold-500/20 gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-luxury-gold-400" />
                <h3 className="text-sm font-serif font-bold text-luxury-gold-200">
                  Guest Payment Settlement & Checkout Ledger (Suite {checkoutCheckIn.roomNumber})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setIsCheckoutModalOpen(false);
                    setCheckoutCheckIn(null);
                    setCheckoutBooking(null);
                  }}
                  className="text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Double-Column Layout */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[75vh] overflow-y-auto text-xs font-sans">
              
              {/* LEFT COLUMN (Housekeeping & Authorizations) - 5 Cols */}
              <div className="lg:col-span-5 space-y-4 border-r border-luxury-brown-100 lg:pr-6">
                
                {/* Comprehensive Guest & Reservation Particulars Summary */}
                {(() => {
                  const summary = getCheckoutFinancialSummary(checkoutCheckIn);
                  return (
                    <div className="bg-luxury-beige-50/80 p-4 rounded-xl border border-luxury-gold-500/20 space-y-3 shadow-2xs">
                      <h4 className="font-serif font-bold text-luxury-brown-950 border-b border-luxury-gold-500/20 pb-1.5 uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-luxury-gold-600" /> Stay & Reservation Summary
                      </h4>
                      
                      {/* Guest Details */}
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-bold">Guest Details</span>
                        <div className="pl-2 border-l border-luxury-gold-500/30 text-luxury-brown-900 leading-relaxed font-medium text-[11px]">
                          <p className="font-bold text-xs">{checkoutCheckIn.guestName}</p>
                          <p>Mobile: {checkoutCheckIn.mobile}</p>
                          <p>ID Proof: {checkoutCheckIn.aadhaarNumber || 'Not provided'}</p>
                          <p>Address: {checkoutCheckIn.address || 'Not provided'}</p>
                        </div>
                      </div>

                      {/* Room Details */}
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-bold">Room Assigned</span>
                        <div className="pl-2 border-l border-luxury-gold-500/30 text-luxury-brown-900 font-medium text-[11px]">
                          <p className="font-bold">Suite {checkoutCheckIn.roomNumber}</p>
                          <p className="text-luxury-brown-600">{checkoutCheckIn.roomType || 'Standard Category'}</p>
                          <p>Daily Base Rate: ₹{Number(checkoutCheckIn.roomRate || 0).toLocaleString()}/night</p>
                        </div>
                      </div>

                      {/* Timeline Details */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-bold">Check-In</span>
                          <p className="font-mono text-luxury-brown-900 font-bold">{checkoutCheckIn.checkInDate}</p>
                          <span className="text-[9px] text-luxury-brown-500 font-mono block">Time: {checkoutCheckIn.dateTime ? new Date(checkoutCheckIn.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '12:00 PM'}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-mono text-luxury-brown-400 block font-bold">Check-Out</span>
                          <p className="font-mono text-luxury-brown-900 font-bold">{checkoutCheckIn.checkOutDate}</p>
                          <span className="text-[9px] text-luxury-brown-500 font-mono block">Time: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (Live)</span>
                        </div>
                      </div>

                      {/* Summary Particulars Checklist for User */}
                      <div className="bg-white p-3 rounded-lg border border-luxury-brown-100 space-y-1.5 text-[11px]">
                        <span className="text-[9.5px] uppercase font-mono text-luxury-brown-400 block font-bold border-b pb-0.5">Summary Particulars Checklist</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-luxury-brown-900 font-medium font-mono text-[10px]">
                          <span className="text-luxury-brown-500">Booking Price:</span>
                          <span className="text-right">₹{Number(summary.bookingPrice || 0).toLocaleString()}</span>
                          
                          <span className="text-luxury-brown-500">Extra Charges:</span>
                          <span className="text-right">₹{Number(summary.extraCharges || 0).toLocaleString()}</span>

                          <span className="text-luxury-brown-500">Food Charges:</span>
                          <span className="text-right">₹{Number(summary.foodCharges || 0).toLocaleString()}</span>

                          <span className="text-luxury-brown-500">Water Bottle Charges:</span>
                          <span className="text-right">₹{Number(summary.waterCharges || 0).toLocaleString()}</span>

                          <span className="text-luxury-brown-500">Other Charges:</span>
                          <span className="text-right">₹{Number(summary.otherCharges || 0).toLocaleString()}</span>
                          
                          <span className="text-luxury-brown-500 font-bold border-t border-luxury-brown-100 pt-0.5 mt-0.5">Total Bill:</span>
                          <span className="text-right font-bold text-luxury-brown-950 border-t border-luxury-brown-100 pt-0.5 mt-0.5">₹{Number(summary.grandTotal || 0).toLocaleString()}</span>
                          
                          <span className="text-emerald-700">Advance Paid:</span>
                          <span className="text-right text-emerald-700 font-bold">₹{Number(summary.advancePaid || 0).toLocaleString()}</span>

                          <span className="text-teal-700">Additional Payment:</span>
                          <span className="text-right text-teal-700 font-bold">₹{Number(summary.additionalPayment || 0).toLocaleString()}</span>

                          <span className="text-teal-700 font-bold border-t border-luxury-brown-100 pt-0.5 mt-0.5">Total Paid:</span>
                          <span className="text-right text-teal-700 font-bold border-t border-luxury-brown-100 pt-0.5 mt-0.5">₹{Number(summary.totalPaid || 0).toLocaleString()}</span>

                          <span className={`font-bold border-t border-luxury-brown-100 pt-0.5 mt-0.5 ${summary.dueAmount > 0 ? "text-rose-700" : "text-emerald-700"}`}>Pending Balance Due:</span>
                          <span className={`text-right font-bold border-t border-luxury-brown-100 pt-0.5 mt-0.5 ${summary.dueAmount > 0 ? "text-rose-700" : "text-emerald-700"}`}>₹{Number(summary.dueAmount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Housekeeping Checklist */}
                <div className="space-y-2">
                  <h4 className="font-serif font-bold text-luxury-brown-950 border-b border-luxury-brown-100/60 pb-1 uppercase text-[10px] tracking-wider flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-[#C5A059]" /> Housekeeping Room Verification
                  </h4>

                  <div className="space-y-1.5 select-none font-medium">
                    <label className="flex items-center gap-2.5 p-2 bg-luxury-beige-50/10 hover:bg-luxury-beige-50/30 rounded-lg border border-luxury-brown-100 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={roomChecked}
                        onChange={(e) => setRoomChecked(e.target.checked)}
                        className="w-4 h-4 rounded accent-luxury-brown-950"
                      />
                      <span>Room physically inspected & certified</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 bg-luxury-beige-50/10 hover:bg-luxury-beige-50/30 rounded-lg border border-luxury-brown-100 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={noDamage && !hasRoomDamageFine}
                        onChange={(e) => {
                          setNoDamage(e.target.checked);
                          setHasRoomDamageFine(!e.target.checked);
                        }}
                        className="w-4 h-4 rounded accent-luxury-brown-950"
                      />
                      <span>No damages detected to suite inventory</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 bg-luxury-beige-50/10 hover:bg-luxury-beige-50/30 rounded-lg border border-luxury-brown-100 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={minibarChecked}
                        onChange={(e) => setMinibarChecked(e.target.checked)}
                        className="w-4 h-4 rounded accent-luxury-brown-950"
                      />
                      <span>Mini Bar checked & consumption accounted</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 bg-luxury-beige-50/10 hover:bg-luxury-beige-50/30 rounded-lg border border-luxury-brown-100 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={waterBottlesVerified}
                        onChange={(e) => setWaterBottlesVerified(e.target.checked)}
                        className="w-4 h-4 rounded accent-luxury-brown-950"
                      />
                      <span>Water bottles tally verified</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 bg-luxury-beige-50/10 hover:bg-luxury-beige-50/30 rounded-lg border border-luxury-brown-100 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={laundryVerified}
                        onChange={(e) => setLaundryVerified(e.target.checked)}
                        className="w-4 h-4 rounded accent-luxury-brown-950"
                      />
                      <span>Bed linens, towels, robes matched</span>
                    </label>
                  </div>

                  {/* Verifier Name */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-gray-400">Inspected By</label>
                      <select
                        value={verifierName}
                        onChange={(e) => setVerifierName(e.target.value)}
                        className="w-full px-2 py-1 border border-luxury-brown-200 rounded bg-white text-luxury-brown-950"
                      >
                        {staff.map(s => (
                          <option key={s.id} value={`${s.name} (${s.designation})`}>
                            {s.name} ({s.designation})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-gray-400">Approval Status</label>
                      <select
                        value={verificationStatus}
                        onChange={(e) => setVerificationStatus(e.target.value as any)}
                        className="w-full px-2 py-1 border border-luxury-brown-200 rounded bg-white font-bold"
                      >
                        <option value="Approved" className="text-emerald-700 font-bold">Approved</option>
                        <option value="Pending" className="text-amber-700 font-bold">Pending</option>
                        <option value="Issue Found" className="text-rose-700 font-bold">Issue Found</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Mark as Due Option (Triggered only if dues exist) */}
                {(() => {
                  const summary = getCheckoutFinancialSummary(checkoutCheckIn);
                  if (summary.dueAmount <= 0) return null;
                  return (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/60 space-y-3">
                      <div className="flex items-start gap-1.5">
                        <span className="text-amber-800 text-sm">⚠️</span>
                        <div>
                          <p className="font-serif font-bold text-amber-900 text-xs">Unsettled Outstanding Dues (₹{Number(summary.dueAmount || 0).toLocaleString()})</p>
                          <p className="text-[10px] text-amber-700">Dues must be fully settled or marked as due in order to authorize check-out completion.</p>
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 select-none font-bold text-amber-950 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={markAsDue}
                          onChange={(e) => setMarkAsDue(e.target.checked)}
                          className="w-4.5 h-4.5 rounded border-amber-400 accent-amber-800 cursor-pointer"
                        />
                        <span>Mark as Due (Save balance & create pending record)</span>
                      </label>
                    </div>
                  );
                })()}

              </div>

              {/* RIGHT COLUMN (Stay Financial Ledger & Live Settlement) - 7 Cols */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Live Invoice Financial Ledger */}
                {(() => {
                  const summary = getCheckoutFinancialSummary(checkoutCheckIn);
                  return (
                    <div className="bg-luxury-brown-950 text-white p-5 rounded-2xl border border-luxury-gold-500/20 shadow-lg space-y-3 font-mono">
                      <div className="flex justify-between items-center border-b border-white/15 pb-2">
                        <span className="font-serif font-bold text-luxury-gold-200 text-xs">STAY LEDGER SUMMARY</span>
                        <span className="text-[10px] text-white/60">Duration: {summary.nights} {summary.nights === 1 ? 'Night' : 'Nights'}</span>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-white/60">Booking Price:</span>
                          <span>₹{Number(summary.bookingPrice || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Extra Charges:</span>
                          <span>₹{Number(summary.extraCharges || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Food Charges:</span>
                          <span>₹{Number(summary.foodCharges || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Water Bottle Charges:</span>
                          <span>₹{Number(summary.waterCharges || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pb-1.5 border-b border-white/10">
                          <span className="text-white/60">Other Charges:</span>
                          <span>₹{Number(summary.otherCharges || 0).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between font-bold text-white/90 pt-1">
                          <span>Taxable Subtotal:</span>
                          <span>₹{Number(summary.subtotal || 0).toLocaleString()}</span>
                        </div>

                        {/* Direct With GST vs Without GST Switch */}
                        <div className="py-2 border-y border-white/15 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setCheckoutGstRate(configuredDefaultGst > 0 ? configuredDefaultGst : 5)}
                              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                checkoutGstRate > 0
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-white/10 text-white/75 border-white/20 hover:bg-white/20'
                              }`}
                            >
                              With GST
                            </button>
                            <button
                              type="button"
                              onClick={() => setCheckoutGstRate(0)}
                              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                checkoutGstRate === 0
                                  ? 'bg-amber-600 text-white border-amber-500'
                                  : 'bg-white/10 text-white/75 border-white/20 hover:bg-white/20'
                              }`}
                            >
                              Without GST
                            </button>
                          </div>
                          {checkoutGstRate > 0 ? (
                            <>
                              <div className="flex justify-between text-white/75">
                                <span>Add: CGST ({(summary.gstRate / 2).toFixed(1).replace(/\.0$/, '')}%):</span>
                                <span>₹{Number(summary.cgst || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-white/75">
                                <span>Add: SGST ({(summary.gstRate / 2).toFixed(1).replace(/\.0$/, '')}%):</span>
                                <span>₹{Number(summary.sgst || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-[#C49A3A] font-bold">
                                <span>Total GST ({summary.gstRate}% = CGST + SGST):</span>
                                <span>₹{Number(summary.gst || 0).toLocaleString('en-IN')}</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] text-amber-300 font-bold">
                              Without GST Active — Printed as ROOM BILL (₹0 Tax)
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between font-bold text-luxury-gold-300 pt-1.5 text-xs">
                          <span>Grand Total Bill:</span>
                          <span>₹{Number(summary.grandTotal || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-emerald-400">
                          <span>Advance Paid:</span>
                          <span>- ₹{Number(summary.advancePaid || 0).toLocaleString()}</span>
                        </div>
                        
                        {/* List payments inside ledger */}
                        {(checkoutCheckIn.payments || []).filter(p => p.paymentType !== 'Advance Deposit').map((payment, i) => (
                          <div key={payment.id || i} className="flex justify-between text-teal-300 text-[10px]">
                            <span className="italic">Additional Payment ({payment.paymentMethod} - {payment.dateTime.split('T')[0]}):</span>
                            <span>- ₹{Number(payment.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}

                        <div className="flex justify-between text-teal-400">
                          <span>Additional Payment (Total):</span>
                          <span>- ₹{Number(summary.additionalPayment || 0).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between text-emerald-400 font-bold border-t border-white/10 pt-1.5">
                          <span>Total Paid:</span>
                          <span>₹{Number(summary.totalPaid || 0).toLocaleString()}</span>
                        </div>

                        {summary.depositBalance > 0 && (
                          <div className="flex justify-between text-amber-400 font-bold border-t border-white/10 pt-1.5">
                            <span>Refund Balance (Deposit Balance):</span>
                            <span>₹{Number(summary.depositBalance || 0).toLocaleString()}</span>
                          </div>
                        )}

                        <div className={`flex justify-between font-serif font-bold text-sm border-t border-white/20 pt-2 ${summary.dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          <span>Pending Balance Due:</span>
                          <span>{summary.dueAmount > 0 ? `₹${Number(summary.dueAmount || 0).toLocaleString()}` : '₹0.00 (Cleared)'}</span>
                        </div>
                      </div>

                      {summary.isLateCheckout && (
                        <div className="bg-rose-500/10 text-rose-300 text-[9px] p-2 rounded border border-rose-500/20 leading-relaxed">
                          ⚠️ Late Check-Out (Overstay past 12:00 PM). Automatic 1 additional night stay tariff applied.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ROOM INSPECTION & DAMAGE / FINE CONFIRMATION BOX */}
                <div className={`p-4 rounded-xl border-2 space-y-3 transition-all ${hasRoomDamageFine ? 'bg-rose-50/80 border-rose-300 shadow-sm' : 'bg-amber-50/60 border-[#C5A059]/40'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
                    <div>
                      <h4 className="font-serif font-bold text-[#17120F] text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-rose-600" /> Room Inspection & Damage / Fine Confirmation
                      </h4>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Record any room damage, breakage, or missing item charges below:
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHasRoomDamageFine(false);
                          setNoDamage(true);
                        }}
                        className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold border cursor-pointer transition-all ${
                          !hasRoomDamageFine
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                        }`}
                      >
                        ✓ Room OK (₹0 Fine)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasRoomDamageFine(true);
                          setNoDamage(false);
                        }}
                        className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold border cursor-pointer transition-all ${
                          hasRoomDamageFine
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                        }`}
                      >
                        ⚠️ Add Damage / Fine
                      </button>
                    </div>
                  </div>

                  {/* Quick Fine Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[9.5px] font-mono uppercase font-bold text-slate-500 block">
                      Quick Room Damage / Fine Presets (1-Click Add):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Broken Glass / Cup', amt: 500 },
                        { label: 'Bed Sheet / Towel Stain', amt: 800 },
                        { label: 'Room Key / Card Lost', amt: 500 },
                        { label: 'TV / AC / Furniture Damage', amt: 2000 },
                        { label: 'Smoking / Property Fine', amt: 1500 },
                      ].map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setHasRoomDamageFine(true);
                            setNoDamage(false);
                            setDamageItemDesc(preset.label);
                            setDamageFineAmount(preset.amt);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                        >
                          + {preset.label} (₹{preset.amt})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Damage Item + Fine Amount Input */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end pt-1">
                    <div className="md:col-span-6 space-y-0.5">
                      <label className="text-[9.5px] uppercase font-mono text-rose-900 font-bold">
                        Damaged Item / Fine Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Broken Glass, Mirror Crack, Key Lost, Stain..."
                        value={damageItemDesc}
                        onChange={(e) => {
                          setDamageItemDesc(e.target.value);
                          if (e.target.value.trim()) {
                            setHasRoomDamageFine(true);
                            setNoDamage(false);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 border border-rose-300 rounded-lg bg-white text-xs text-luxury-brown-950 font-medium"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-0.5">
                      <label className="text-[9.5px] uppercase font-mono text-rose-900 font-bold">
                        Fine Amount (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="₹0"
                        value={damageFineAmount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setDamageFineAmount(val);
                          if (val > 0) {
                            setHasRoomDamageFine(true);
                            setNoDamage(false);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 border border-rose-300 rounded-lg bg-white text-xs font-mono font-extrabold text-rose-700"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <button
                        type="button"
                        onClick={() => handleAddDamageFineToStay()}
                        className="w-full px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-mono font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Fine
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tab: Add Ancillary Extra Charge on-the-fly */}
                <div className="bg-luxury-beige-50/50 p-4 rounded-xl border border-luxury-brown-100 space-y-2">
                  <h4 className="font-serif font-bold text-luxury-brown-950 text-[11px] uppercase tracking-wider flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-[#C5A059]" /> Log New Room Service / Ancillary Charge
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-3 space-y-0.5">
                      <label className="text-[9px] uppercase font-mono text-gray-400 font-bold">Category</label>
                      <select
                        value={newChargeCategory}
                        onChange={(e) => setNewChargeCategory(e.target.value as any)}
                        className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded bg-white font-medium text-xs text-luxury-brown-950"
                      >
                        <option value="Damage">Room Damage / Fine</option>
                        <option value="Extra">Extra Charges</option>
                        <option value="Food">Food Charges</option>
                        <option value="Water Bottle">Water Bottle Charges</option>
                        <option value="Other">Other Charges</option>
                      </select>
                    </div>

                    <div className="md:col-span-5 space-y-0.5">
                      <label className="text-[9px] uppercase font-mono text-gray-400 font-bold">Item Description</label>
                      <input
                        type="text"
                        placeholder="e.g. 2x Sandwich & Milkshake"
                        value={newChargeDesc}
                        onChange={(e) => setNewChargeDesc(e.target.value)}
                        className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded bg-white text-xs text-luxury-brown-950"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[9px] uppercase font-mono text-gray-400 font-bold">Price (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={newChargeAmount || ''}
                        onChange={(e) => setNewChargeAmount(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded bg-white text-xs text-luxury-brown-950"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddLocalExtraCharge}
                        className="w-full px-3 py-2 bg-luxury-brown-900 hover:bg-luxury-brown-800 text-white rounded font-serif font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Log
                      </button>
                    </div>
                  </div>

                  {/* Table of active logged extras */}
                  {checkoutCheckIn.extraCharges && checkoutCheckIn.extraCharges.length > 0 && (
                    <div className="pt-2">
                      <table className="w-full text-[10px] text-left border border-luxury-brown-100 rounded overflow-hidden">
                        <thead>
                          <tr className="bg-luxury-beige-100 text-luxury-brown-950 font-bold border-b border-luxury-brown-200">
                            <th className="p-1.5 pl-2">Category</th>
                            <th className="p-1.5">Description</th>
                            <th className="p-1.5 text-right">Price</th>
                            <th className="p-1.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-luxury-brown-100/50">
                          {checkoutCheckIn.extraCharges.map((c) => (
                            <tr key={c.id}>
                              <td className="p-1.5 pl-2 font-bold text-luxury-brown-850">{c.category}</td>
                              <td className="p-1.5 text-gray-600">{c.description}</td>
                              <td className="p-1.5 text-right font-mono font-bold text-luxury-brown-900">₹{Number(c.amount || 0).toLocaleString()}</td>
                              <td className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLocalExtraCharge(c.id)}
                                  className="text-rose-600 hover:text-rose-800 transition cursor-pointer"
                                  title="Remove Charge"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Settle Outstanding Dues Form */}
                {getCheckoutFinancialSummary(checkoutCheckIn).dueAmount > 0 && (
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 space-y-2">
                    <h4 className="font-serif font-bold text-emerald-950 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-700" /> Settle Pending Stay Dues Before Checkout
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <div className="md:col-span-3 space-y-0.5">
                        <label className="text-[9px] uppercase font-mono text-emerald-800 font-bold">Paying Amount (₹)</label>
                        <input
                          type="number"
                          placeholder="Amount"
                          value={settleAmount || ''}
                          onChange={(e) => setSettleAmount(Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-emerald-300 rounded bg-white text-xs text-luxury-brown-950 font-mono font-bold"
                        />
                      </div>

                      <div className="md:col-span-3 space-y-0.5">
                        <label className="text-[9px] uppercase font-mono text-emerald-800 font-bold">Method</label>
                        <select
                          value={settleMethod}
                          onChange={(e) => {
                            const v = e.target.value as any;
                            if (v === 'Hybrid') {
                              setSettleHybridRows(createInitialHybridRows(Number(settleAmount) || 0, ['Cash', 'UPI', 'Card', 'Bank']));
                            }
                            setSettleMethod(v);
                          }}
                          className="w-full px-2 py-1.5 border border-emerald-300 rounded bg-white text-xs font-bold text-luxury-brown-950"
                        >
                          <option value="UPI">UPI Digital</option>
                          <option value="Cash">Cash Currency</option>
                          <option value="Card">Credit Card</option>
                          <option value="Bank">Bank Wire</option>
                          <option value="Hybrid">⇄ Hybrid / Split</option>
                        </select>
                      </div>
                      {settleMethod === 'Hybrid' && (
                        <div className="md:col-span-12">
                          <HybridSplitPaymentBox
                            rows={settleHybridRows}
                            onChange={(rows) => {
                              setSettleHybridRows(rows);
                              const sum = Math.round(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) * 100) / 100;
                              setSettleAmount(sum);
                            }}
                            modes={['Cash', 'UPI', 'Card', 'Bank']}
                            targetAmount={Number(settleAmount) || 0}
                            compact
                          />
                        </div>
                      )}

                      <div className="md:col-span-4 space-y-0.5">
                        <label className="text-[9px] uppercase font-mono text-emerald-800 font-bold">Payment Note / Reference</label>
                        <input
                          type="text"
                          placeholder="e.g. UPI Ref #4512"
                          value={settleNotes}
                          onChange={(e) => setSettleNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-emerald-300 rounded bg-white text-xs text-luxury-brown-950"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddLocalPayment}
                          className="w-full px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-serif font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow"
                        >
                          Settle
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-luxury-beige-50/50 p-4 border-t flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleCompleteUnifiedCheckout}
                className="px-6 py-3 bg-teal-700 hover:bg-teal-600 text-white font-serif font-bold rounded-lg transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                ✓ Complete Check-Out & Generate Invoice
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCheckoutModalOpen(false);
                  setCheckoutCheckIn(null);
                  setCheckoutBooking(null);
                }}
                className="px-5 py-3 border border-luxury-brown-200 bg-white text-luxury-brown-850 hover:bg-luxury-beige-100 rounded-lg transition cursor-pointer"
              >
                Cancel Checkout Panel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. AUTOMATED FINAL INVOICE PRINT PREVIEW MODAL */}
      {previewInvoice && (
        <div className="invoice-print-modal-root fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:block print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-luxury-gold-500/30 overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:my-0 print:mx-0 print:max-w-none print:w-full print:rounded-none">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#C49A3A] via-[#E0BD6B] to-[#C49A3A]" />
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#FFFDF7] to-[#FBF4E0] p-5 text-[#263449] flex justify-between items-center border-b border-[#C49A3A]/30 no-print">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-[#C49A3A]" />
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#263449]">
                    Official Tax Invoice — {previewInvoice.invoiceNumber}
                  </h3>
                  <p className="text-[10px] font-mono text-[#5A6B82]">
                    Adjust GST slab below or print voucher directly
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewInvoice(null)}
                className="text-[#5A6B82] hover:text-[#263449] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Live With GST vs Without GST Control Strip (No Print) */}
            <div className="px-6 py-3 bg-[#FAF6F0] border-b border-[#E6DCCF] flex flex-wrap items-center justify-between gap-2 no-print">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChangePreviewInvoiceGst(configuredDefaultGst > 0 ? configuredDefaultGst : 5)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    (previewInvoice.gst || 0) > 0
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                  }`}
                >
                  With GST
                </button>
                <button
                  type="button"
                  onClick={() => handleChangePreviewInvoiceGst(0)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    (previewInvoice.gst || 0) <= 0
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                  }`}
                >
                  Without GST
                </button>
              </div>
            </div>



            {/* Invoice Printable Body */}
            <div className="p-8 print:p-4 space-y-6 text-xs font-sans text-[#263449]" id="print-tax-invoice-voucher">
              
              {/* Header Grid */}
              <div className="flex justify-between items-start border-b-2 border-[#C49A3A]/40 pb-5">
                <div className="flex items-start gap-3.5">
                  {hotelSettings?.logoUrl ? (
                    <img
                      src={hotelSettings.logoUrl}
                      alt={hotelSettings?.name || 'Hotel Logo'}
                      className="w-16 h-16 object-contain rounded-xl border border-[#C49A3A]/40 bg-white p-1 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FBF4E0] to-[#F3E2B3] border-2 border-[#C49A3A] flex flex-col items-center justify-center shrink-0 shadow-2xs">
                      <span className="text-base font-serif font-extrabold text-[#8B691E] leading-none">
                        {(hotelSettings?.name || 'Hotel')
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
                  <div>
                    <h1 className="text-xl font-serif font-bold text-[#263449] uppercase tracking-tight">
                      {hotelSettings?.name || 'Hotel Property'}
                    </h1>
                    <p className="text-slate-500 leading-relaxed font-medium">
                      {hotelSettings?.address && String(hotelSettings.address).trim() !== '0' ? <>{hotelSettings.address}<br /></> : null}
                      Phone: {hotelSettings?.phoneNumber || 'N/A'} {hotelSettings?.emailAddress ? `| Email: ${hotelSettings.emailAddress}` : ''}<br />
                      {hotelSettings?.website && <span>Website: {hotelSettings.website} | </span>}
                      {(previewInvoice.gst || 0) > 0 && hotelSettings?.gstNumber && (
                        <span className="font-mono font-bold text-[#8B691E]">GSTIN: {hotelSettings.gstNumber}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-[#FBF4E0] !text-[#8B691E] border border-[#C49A3A]/40 font-serif font-bold text-xs uppercase rounded-md tracking-wider mb-2">
                    {(previewInvoice.gst || 0) > 0 ? 'TAX INVOICE' : 'ROOM BILL'}
                  </div>
                  <p className="font-mono text-[10px] text-slate-500">Invoice No.: <strong className="text-[#263449]">{previewInvoice.invoiceNumber}</strong></p>
                  <p className="font-mono text-[10px] text-slate-500">GRC / Ref.: <strong className="text-[#263449]">{previewInvoice.grcNumber || previewInvoice.bookingId}</strong></p>
                  <p className="font-mono text-[10px] text-slate-500">Date: <strong className="text-[#263449]">{previewInvoice.dateCreated}</strong></p>
                  <p className="font-mono text-[10px] text-slate-500">Status: <strong className={previewInvoice.isPaid ? 'text-[#15805D] uppercase font-bold' : 'text-[#D92D4B] uppercase font-bold'}>{previewInvoice.isPaid ? 'PAID IN FULL' : 'BALANCE DUE'}</strong></p>
                </div>
              </div>

              {/* Bill To Grid (Page 3 Room Bill Fields) */}
              {(() => {
                const linkedBkg = bookings.find(b => b.id === previewInvoice.bookingId);
                const linkedChk = checkins.find(c => c.id === previewInvoice.bookingId);
                const compName = previewInvoice.companyName || linkedChk?.companyName || linkedBkg?.companyName;
                const custGstin = previewInvoice.gstNumber || linkedChk?.gstNumber || linkedBkg?.gstNumber;
                const custAddr = previewInvoice.guestAddress || linkedChk?.address || linkedBkg?.address;
                const custNat = previewInvoice.nationality || linkedChk?.nationality || linkedBkg?.nationality || 'Indian';
                const vchNo = previewInvoice.voucherNumber || linkedChk?.voucherNumber || linkedBkg?.voucherNumber;
                const arrTime = previewInvoice.arrivalTime || linkedChk?.arrivalTime || linkedBkg?.checkInTime || '12:00 PM';
                const depTime = previewInvoice.departureTime || linkedChk?.departureTime || linkedBkg?.checkOutTime || '11:00 AM';
                return (
                  <div className="grid grid-cols-2 gap-6 bg-[#FAFBFD] p-4 rounded-xl border border-luxury-brown-100">
                    <div className="space-y-1">
                      <h3 className="font-serif font-bold text-[#263449] text-xs uppercase mb-1 tracking-wider border-b border-luxury-brown-100 pb-1">
                        Name of Receiver / Bill To:
                      </h3>
                      <p className="text-sm font-serif font-bold text-[#263449]">{compName || previewInvoice.guestName}</p>
                      <p className="text-xs text-[#263449]"><strong>Guest Name:</strong> {previewInvoice.guestName}</p>
                      {custAddr && <p className="text-[11px] text-slate-600"><strong>Address:</strong> {custAddr}</p>}
                      {previewInvoice.guestMobile && <p className="text-[11px] font-mono text-slate-500">Mobile: {previewInvoice.guestMobile} • Nationality: {custNat}</p>}
                      {compName && <p className="text-[11px] font-bold text-indigo-900">Company: {compName}</p>}
                      {(previewInvoice.gst || 0) > 0 && custGstin && (
                        <p className="text-[11px] font-mono text-indigo-700">Customer GSTIN: {custGstin}</p>
                      )}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-[#263449] text-xs uppercase mb-1.5 tracking-wider border-b border-luxury-brown-100 pb-1">
                        Stay &amp; Room Bill Particulars:
                      </h3>
                      <div className="grid grid-cols-2 gap-1 font-medium text-slate-600">
                        <span>Room Assigned:</span>
                        <strong className="text-[#263449] font-mono">Room {previewInvoice.roomNumber}</strong>
                        <span>GRC No.:</span>
                        <span className="font-mono font-bold text-[#263449]">{previewInvoice.grcNumber || previewInvoice.bookingId}</span>
                        {vchNo && (
                          <>
                            <span>Voucher / Tour No.:</span>
                            <span className="font-mono font-bold text-[#263449]">{vchNo}</span>
                          </>
                        )}
                        <span>Arrival Date &amp; Time:</span>
                        <span className="font-mono">{previewInvoice.checkInDate} • {arrTime}</span>
                        <span>Departure Date &amp; Time:</span>
                        <span className="font-mono">{previewInvoice.checkOutDate || 'Open Stay'} • {depTime}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Line Items Table */}
              <table className="w-full text-left border border-luxury-brown-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#17120F] text-white font-mono font-bold border-b border-[#C49A3A]">
                    <th className="p-3 pl-4">Service / Particular Log</th>
                    <th className="p-3 text-right pr-4">Gross Tariff / Charge Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs font-medium text-[#263449]">
                  <tr>
                    <td className="p-3 pl-4">Lodging Accommodations Tariff Charges (Room {previewInvoice.roomNumber})</td>
                    <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.roomCharges || 0).toLocaleString()}</td>
                  </tr>
                  {previewInvoice.extraBedCharges && previewInvoice.extraBedCharges > 0 ? (
                    <tr>
                      <td className="p-3 pl-4">Extra Bed Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.extraBedCharges || 0).toLocaleString()}</td>
                    </tr>
                  ) : null}
                  {Number(previewInvoice.extraPersonCharges || 0) > 0 ? (
                    <tr>
                      <td className="p-3 pl-4">Extra Person / Extra Guest Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.extraPersonCharges || 0).toLocaleString()}</td>
                    </tr>
                  ) : null}
                  {Number(previewInvoice.foodCharges || 0) > 0 && (
                    <tr>
                      <td className="p-3 pl-4">Dining & Food Room Service Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.foodCharges || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  {Number(previewInvoice.waterCharges || 0) > 0 && (
                    <tr>
                      <td className="p-3 pl-4">Water Bottles / Beverage Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.waterCharges || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  {Number(previewInvoice.laundryCharges || 0) > 0 && (
                    <tr>
                      <td className="p-3 pl-4">Laundry & Linen Services Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.laundryCharges || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  {Number(previewInvoice.serviceCharges || 0) > 0 && (
                    <tr>
                      <td className="p-3 pl-4">Guest Service Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.serviceCharges || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  {Number(previewInvoice.earlyCheckInCharges || 0) > 0 && (
                    <tr>
                      <td className="p-3 pl-4">Early Check-In Surcharge</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.earlyCheckInCharges || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  {Number(previewInvoice.fineCharges || 0) > 0 && (
                    <tr>
                      <td className="p-3 pl-4">Room Damage / Penalty / Fine Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.fineCharges || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  {Number(previewInvoice.otherCharges || 0) > 0 && (
                    <tr>
                      <td className="p-3 pl-4">Miscellaneous Ancillary Charges</td>
                      <td className="p-3 text-right font-mono font-bold pr-4">₹{Number(previewInvoice.otherCharges || 0).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#FAFBFD] font-bold border-t border-luxury-brown-100">
                    <td className="p-2.5 pl-4 text-right text-slate-500 uppercase text-[10px] font-mono tracking-wider">Subtotal:</td>
                    <td className="p-2.5 text-right font-mono text-[#263449] pr-4">₹{Number(previewInvoice.subtotal || 0).toLocaleString()}</td>
                  </tr>
                  {(previewInvoice.gst || 0) > 0 && (
                    <>
                      <tr className="bg-[#FAFBFD] font-semibold border-t border-luxury-brown-100/50">
                        <td className="p-2 pl-4 text-right text-slate-500 uppercase text-[10px] font-mono tracking-wider">
                          Add: CGST ({(previewInvoice.gstRate || 0) / 2}%):
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600 pr-4">
                          ₹{parseFloat(((previewInvoice.gst || 0) / 2).toFixed(2)).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr className="bg-[#FAFBFD] font-semibold border-t border-luxury-brown-100/50">
                        <td className="p-2 pl-4 text-right text-slate-500 uppercase text-[10px] font-mono tracking-wider">
                          Add: SGST ({(previewInvoice.gstRate || 0) / 2}%):
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600 pr-4">
                          ₹{parseFloat(((previewInvoice.gst || 0) / 2).toFixed(2)).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr className="bg-[#FAFBFD] font-bold border-t border-luxury-brown-100/50">
                        <td className="p-2 pl-4 text-right text-[#8B691E] uppercase text-[10px] font-mono tracking-wider">
                          Total GST ({previewInvoice.gstRate || 0}% = CGST + SGST):
                        </td>
                        <td className="p-2 text-right font-mono text-[#8B691E] pr-4">
                          ₹{Number(previewInvoice.gst || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-[#FBF4E0] text-[#263449] font-serif font-bold text-sm border-t-2 border-[#C49A3A]">
                    <td className="p-3 pl-4 text-right uppercase tracking-wider !text-[#263449]">
                      {(previewInvoice.gst || 0) > 0 ? 'Grand Total Invoice Amount:' : 'Grand Total Room Bill:'}
                    </td>
                    <td className="p-3 text-right font-mono !text-[#8B691E] pr-4">₹{Number(previewInvoice.finalAmount || 0).toLocaleString()}</td>
                  </tr>
                  {previewInvoice.advancePaid !== undefined && (
                    <tr className="bg-emerald-50/70 font-bold border-t border-emerald-100">
                      <td className="p-2.5 pl-4 text-right text-[#15805D] uppercase text-[10px] font-mono tracking-wider">Less: Advance / Amount Paid:</td>
                      <td className="p-2.5 text-right font-mono text-[#15805D] pr-4">-₹{Number(previewInvoice.advancePaid || 0).toLocaleString()}</td>
                    </tr>
                  )}
                  {Number(previewInvoice.refundDue ?? previewInvoice.refundAmount ?? 0) > 0 && (
                    <tr className="bg-amber-50 font-bold border-t border-amber-200">
                      <td className="p-2.5 pl-4 text-right text-amber-900 uppercase text-[10px] font-mono tracking-wider">Refund Due / Payable to Guest:</td>
                      <td className="p-2.5 text-right font-mono text-amber-900 pr-4">₹{Number(previewInvoice.refundDue ?? previewInvoice.refundAmount ?? 0).toLocaleString()}</td>
                    </tr>
                  )}
                  <tr className="bg-[#FAFBFD] font-bold border-t border-luxury-brown-200 text-xs">
                    <td className="p-2.5 pl-4 text-right text-[#263449] uppercase font-mono tracking-wider">Net Balance Due:</td>
                    <td className={`p-2.5 text-right font-mono pr-4 ${previewInvoice.isPaid ? 'text-[#15805D]' : 'text-[#D92D4B]'}`}>
                      {previewInvoice.isPaid
                        ? '₹0 (PAID IN FULL)'
                        : `₹${Number(previewInvoice.pendingAmount ?? Math.max(0, Number(previewInvoice.finalAmount || 0) - Number(previewInvoice.advancePaid || 0))).toLocaleString()} DUE`}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Declarations */}
              <div className="border-t border-luxury-brown-100 pt-4 flex justify-between items-end leading-relaxed text-slate-500 font-medium">
                <div className="max-w-md">
                  <p className="font-serif font-bold text-[#263449] mb-1">Terms & Conditions:</p>
                  <p>1. All disputes are subject to local hotel jurisdiction only.</p>
                  <p>2. This is a computer-generated tax invoice and requires no physical signature.</p>
                </div>
                <div className="text-right pr-3 border-t border-dashed border-luxury-brown-200 pt-8 w-48">
                  <p className="font-serif font-bold text-[#263449]">Authorized Desk Signatory</p>
                  <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500">{hotelSettings?.name || 'Hotel Front Desk'}</p>
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="bg-luxury-beige-50/50 p-4 border-t flex justify-end gap-2 text-xs no-print">
              <button
                type="button"
                onClick={() => {
                  const linkedBkg = bookings.find(b => b.id === previewInvoice.bookingId) || null;
                  const linkedChk = checkins.find(c => c.id === previewInvoice.bookingId) || null;
                  openPrintWindow(
                    invoiceRecordToPrintHtml(previewInvoice, hotelSettings, linkedChk, linkedBkg),
                    true
                  );
                }}
                className="px-5 py-2.5 bg-luxury-brown-950 hover:bg-luxury-brown-850 text-white font-serif font-bold rounded-lg transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Invoice Voucher
              </button>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="px-5 py-2.5 border border-luxury-brown-200 bg-white text-luxury-brown-850 hover:bg-luxury-beige-100 rounded-lg transition cursor-pointer"
              >
                Close Receipt
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. PERMANENT DELETE BOOKING CONFIRMATION MODAL */}
      {bookingToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-rose-500/20 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-rose-950 p-4 text-white flex justify-between items-center border-b border-rose-500/20">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4.5 h-4.5 text-rose-300" />
                <h3 className="text-xs font-serif font-bold text-rose-200">
                  Confirm Permanent Reservation Deletion
                </h3>
              </div>
              <button 
                onClick={() => setBookingToDelete(null)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3.5 text-xs text-luxury-brown-950">
              <p className="font-medium text-[13px] leading-relaxed">
                Are you absolutely sure you want to permanently delete the reservation record for <strong className="text-luxury-brown-900">{bookingToDelete.guestName}</strong>?
              </p>
              
              <div className="bg-rose-50 p-3 rounded-lg border border-rose-100/70 space-y-1.5 font-mono text-[11px] text-rose-950">
                <p>• <strong className="text-rose-900">Booking ID:</strong> {bookingToDelete.id}</p>
                <p>• <strong className="text-rose-900">Assigned Suite:</strong> Suite {bookingToDelete.roomNumber} ({bookingToDelete.roomType})</p>
                <p>• <strong className="text-rose-900">Duration:</strong> {bookingToDelete.checkInDate} to {bookingToDelete.checkOutDate}</p>
                <p>• <strong className="text-rose-900">Advance Paid:</strong> ₹{Number(bookingToDelete.advanceAmount || 0).toLocaleString()}</p>
              </div>

              <p className="text-rose-600 font-semibold leading-normal">
                ⚠️ WARNING: This action is completely irreversible. Deleting this record will also release the assigned room unit and remove any active check-in stay profiles matching this ID.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-rose-50/50 p-4 border-t border-rose-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={confirmDeleteBooking}
                className="px-4.5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-serif font-bold rounded-lg transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Yes, Permanently Delete
              </button>
              <button
                type="button"
                onClick={() => setBookingToDelete(null)}
                className="px-4.5 py-2.5 border border-luxury-brown-200 bg-white text-luxury-brown-850 hover:bg-luxury-beige-100 rounded-lg transition cursor-pointer"
              >
                Cancel Keep Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ROOM UPGRADE & RELOCATION MODAL */}
      {isUpgradeModalOpen && selectedUpgradeBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-luxury-gold-500/30 overflow-hidden shadow-2xl animate-in fade-in duration-300 my-8">
            {/* Header */}
            <div className="bg-luxury-brown-900 p-5 text-white flex justify-between items-center border-b border-luxury-gold-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-luxury-gold-500/20 rounded-xl border border-luxury-gold-500/30">
                  <ArrowUpRight className="w-5 h-5 text-luxury-gold-400" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-luxury-beige-50">
                    Active Stay Room Upgrade / Relocation
                  </h3>
                  <p className="text-[11px] text-luxury-gold-300/90 font-mono mt-0.5">
                    Guest: <strong>{selectedUpgradeBooking.guestName}</strong> • Booking ID: <strong className="text-white">{selectedUpgradeBooking.id}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsUpgradeModalOpen(false);
                  setSelectedUpgradeBooking(null);
                }}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-xs text-luxury-brown-900 max-h-[75vh] overflow-y-auto">
              {/* Current Stay & Room Info */}
              <div className="grid grid-cols-2 gap-3 bg-luxury-beige-50/80 p-3.5 rounded-2xl border border-luxury-brown-200/50">
                <div>
                  <span className="text-[10px] font-mono text-luxury-brown-400 uppercase block font-bold">Current Occupied Suite</span>
                  <strong className="text-sm font-serif text-luxury-brown-950 block mt-0.5">
                    Suite #{selectedUpgradeBooking.roomNumber} ({selectedUpgradeBooking.roomType})
                  </strong>
                  <span className="text-[11px] text-luxury-brown-600 font-mono">
                    Current Rate: ₹{(rooms.find(r => r.number === selectedUpgradeBooking.roomNumber)?.rate || selectedUpgradeCheckIn?.roomRate || 2500).toLocaleString()}/night
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-luxury-brown-400 uppercase block font-bold">Stay Schedule</span>
                  <strong className="text-xs font-mono text-luxury-brown-950 block mt-0.5">
                    {selectedUpgradeBooking.checkInDate} → {selectedUpgradeBooking.checkOutDate}
                  </strong>
                  <span className="text-[11px] text-emerald-700 font-mono font-bold block mt-0.5">
                    {getUpgradeCalculationDetails().remainingNights} Remaining Night(s) for Rate Diff
                  </span>
                </div>
              </div>

              {/* Select Target Available Room */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-luxury-brown-950 flex items-center justify-between">
                  <span>Select Destination Upgrade Suite *</span>
                  <span className="text-[10px] font-normal text-luxury-brown-500 font-mono">
                    Showing Available Suites Only
                  </span>
                </label>
                <select
                  value={targetRoomNumber}
                  onChange={(e) => setTargetRoomNumber(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-white border border-luxury-brown-250 rounded-xl px-3.5 py-2.5 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950 shadow-2xs"
                >
                  {rooms.filter(r => r.status === 'Available' && r.number !== selectedUpgradeBooking.roomNumber).length === 0 ? (
                    <option value="">No other vacant rooms available for upgrade</option>
                  ) : (
                    rooms
                      .filter(r => r.status === 'Available' && r.number !== selectedUpgradeBooking.roomNumber)
                      .map(r => (
                        <option key={r.id} value={r.number}>
                          Suite #{r.number} — {r.category} (₹{Number(r.rate || 0).toLocaleString()}/night)
                        </option>
                      ))
                  )}
                </select>
                {rooms.filter(r => r.status === 'Available' && r.number !== selectedUpgradeBooking.roomNumber).length === 0 && (
                  <p className="text-[11px] text-rose-600 font-medium pt-1">
                    ⚠️ Warning: No vacant available rooms found. Clear or check out rooms to proceed with upgrade.
                  </p>
                )}
              </div>

              {/* Live Rate Difference Calculation Box */}
              {(() => {
                const calc = getUpgradeCalculationDetails();
                return (
                  <div className="bg-luxury-brown-950 text-white p-4 rounded-2xl space-y-2.5 border border-luxury-gold-500/30">
                    <div className="flex justify-between items-center border-b border-luxury-gold-500/20 pb-2">
                      <span className="text-xs font-serif font-bold text-luxury-gold-300 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-luxury-gold-400" /> Automatic Remaining Nights Rate Difference Calculator
                      </span>
                      <span className="text-[10px] font-mono text-luxury-brown-300">
                        {calc.remainingNights} Remaining Night(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-luxury-brown-400 block text-[9px] uppercase">Old Room Rate</span>
                        <p className="text-white font-bold">₹{Number(calc.oldRoomRate || 0).toLocaleString()}/N</p>
                      </div>
                      <div>
                        <span className="text-luxury-brown-400 block text-[9px] uppercase">New Room Rate</span>
                        <p className="text-luxury-gold-300 font-bold">₹{Number(calc.newRoomRate || 0).toLocaleString()}/N</p>
                      </div>
                      <div>
                        <span className="text-luxury-brown-400 block text-[9px] uppercase">Diff / Night</span>
                        <p className="text-emerald-400 font-bold">+₹{Number(calc.rateDiffPerNight || 0).toLocaleString()}/N</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-luxury-brown-800 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-luxury-gold-400 block font-bold">Total Tariff Addition to Folio</span>
                        <p className="text-[10px] text-luxury-brown-300 font-mono">
                          ₹{Number(calc.rateDiffPerNight || 0).toLocaleString()} × {calc.remainingNights} night(s) remaining
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-serif font-bold text-emerald-400">
                          +₹{Number(calc.totalCalculatedCharge || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Override / Discount Option */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-luxury-brown-800 flex justify-between">
                  <span>Override Rate Difference Amount (Optional)</span>
                  <span className="text-[10px] text-luxury-brown-400 font-normal">Leave blank to charge auto calculated ₹{getUpgradeCalculationDetails().totalCalculatedCharge}</span>
                </label>
                <input
                  type="number"
                  placeholder={`Calculated amount: ${getUpgradeCalculationDetails().totalCalculatedCharge}`}
                  value={overrideUpgradeCharge}
                  onChange={(e) => setOverrideUpgradeCharge(e.target.value)}
                  className="w-full text-xs font-mono bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 text-luxury-brown-950 focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
                />
              </div>

              {/* Reason for Upgrade */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-luxury-brown-800">Reason for Upgrade / Relocation *</label>
                <input
                  type="text"
                  value={upgradeReason}
                  onChange={(e) => setUpgradeReason(e.target.value)}
                  placeholder="e.g. Guest requested upgrade to Executive Suite, AC maintenance issue"
                  className="w-full text-xs bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 text-luxury-brown-950 focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
                />
              </div>

              {/* Automatic Status Notice */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-950">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Automated System Updates on Upgrade Confirmation:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[10px]">
                  <li>Previous Suite <strong>#{selectedUpgradeBooking.roomNumber}</strong> status automatically changes to <strong>Dirty</strong> for Housekeeping.</li>
                  <li>New Suite <strong>#{targetRoomNumber}</strong> status automatically changes to <strong>Occupied</strong>.</li>
                  <li>Booking ID <strong>{selectedUpgradeBooking.id}</strong> is retained without changes.</li>
                  <li>Rate difference is added to the guest folio and automatically billed on checkout.</li>
                  <li>Complete relocation history is stored in guest audit logs.</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-luxury-beige-50 p-4 border-t border-luxury-brown-100 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setIsUpgradeModalOpen(false);
                  setSelectedUpgradeBooking(null);
                }}
                className="px-4 py-2 border border-luxury-brown-250 bg-white text-luxury-brown-850 hover:bg-luxury-beige-100 rounded-xl transition-colors font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpgrade}
                disabled={!targetRoomNumber || rooms.filter(r => r.status === 'Available' && r.number !== selectedUpgradeBooking.roomNumber).length === 0}
                className="px-5 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-400 disabled:opacity-50 text-luxury-brown-950 font-bold rounded-xl transition-colors text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" /> Confirm Room Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS TOAST NOTIFICATION BANNER */}
      {upgradeSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-luxury-brown-950 text-white border border-luxury-gold-500/40 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300 max-w-md">
          <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-serif font-bold text-luxury-gold-300 text-sm">Room Upgrade Complete</p>
            <p className="text-luxury-brown-200 mt-0.5 font-mono text-[11px] leading-relaxed">{upgradeSuccessToast}</p>
          </div>
          <button 
            onClick={() => setUpgradeSuccessToast(null)}
            className="text-white/60 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* QUICK FOOD BILL MODAL (Back-Dated Entry + 5% GST Option) */}
      {foodBillModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-luxury-brown-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-luxury-brown-950 via-luxury-brown-900 to-luxury-brown-950 text-white p-5 border-b border-luxury-gold-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base text-luxury-gold-300">
                    Post Food Bill &amp; Room Service
                  </h3>
                  <p className="text-xs text-luxury-brown-200 font-mono">
                    Room #{foodBillModalData.room.number} • {foodBillModalData.room.category} • {foodBillModalData.booking?.guestName || foodBillModalData.checkin?.guestName || 'Occupied Guest'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFoodBillModalData(null)}
                className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Item Description */}
              <div className="space-y-1">
                <label className="font-bold text-luxury-brown-900 block">
                  Food Item Description / KOT Summary *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2x Paneer Butter Masala, 4x Tandoori Roti, 1x Jeera Rice"
                  value={foodBillItemDesc}
                  onChange={(e) => setFoodBillItemDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-950 focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
                />
              </div>

              {/* Base Food Amount */}
              <div className="space-y-1">
                <label className="font-bold text-luxury-brown-900 block">
                  Food Base Amount (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 450"
                  value={foodBillBaseAmount || ''}
                  onChange={(e) => setFoodBillBaseAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs font-mono font-bold text-luxury-brown-950 focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
                />
              </div>

              {/* Back-Dated Entry: Date & Time Picker */}
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    Bill Date &amp; Time (Back-Date Allowed)
                  </span>
                  {foodBillDate !== new Date().toISOString().split('T')[0] && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Back-Dated
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Order Date:</label>
                    <input
                      type="date"
                      value={foodBillDate}
                      onChange={(e) => setFoodBillDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Order Time:</label>
                    <input
                      type="time"
                      value={foodBillTime}
                      onChange={(e) => setFoodBillTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* GST Option (5% GST vs Without GST) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px]">
                    GST Billing Option
                  </span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFoodBillApplyGst(true)}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        foodBillApplyGst
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      5% GST (CGST + SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFoodBillApplyGst(false)}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        !foodBillApplyGst
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Without GST (0%)
                    </button>
                  </div>
                </div>

                {/* Calculation Breakdown */}
                {(() => {
                  const base = Number(foodBillBaseAmount) || 0;
                  const gst = foodBillApplyGst ? Math.round(base * (foodBillGstRate / 100) * 100) / 100 : 0;
                  const total = Math.round((base + gst) * 100) / 100;
                  return (
                    <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span>Food Base Amount:</span>
                        <strong className="text-slate-800">₹{base.toLocaleString()}</strong>
                      </div>
                      {foodBillApplyGst && (
                        <div className="flex justify-between text-emerald-700">
                          <span>5% GST (2.5% CGST + 2.5% SGST):</span>
                          <strong>₹{gst.toLocaleString()}</strong>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-200">
                        <span>Total Payable Food Bill:</span>
                        <span className="text-emerald-700 font-sans font-extrabold text-sm">₹{total.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-luxury-beige-50 p-4 border-t border-luxury-brown-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFoodBillModalData(null)}
                className="px-4 py-2 border border-luxury-brown-250 bg-white text-luxury-brown-850 hover:bg-luxury-beige-100 rounded-xl transition-colors font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFoodBill}
                disabled={!foodBillBaseAmount || foodBillBaseAmount <= 0}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" /> Post Food Bill to Room #{foodBillModalData.room.number}
              </button>
            </div>
          </div>
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
