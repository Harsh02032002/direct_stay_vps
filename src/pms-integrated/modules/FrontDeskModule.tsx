import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Eye,
  LogIn,
  LogOut,
  CreditCard,
  FileText,
  Trash2,
  CheckCircle2,
  UserCheck,
  BedDouble,
  Droplets,
  ShieldCheck,
  Sliders,
  Utensils,
  Edit3,
  Clock,
  ArrowRightLeft,
  CalendarPlus,
  XCircle,
  AlertTriangle,
  Sparkles,
  Users,
  Upload,
  Printer,
  Calendar,
} from 'lucide-react';
import {
  AssetGroup,
  BookedCategoryRequirement,
  BookingRecord,
  BookingSource,
  GuestPerson,
  HousekeepingTask,
  MealPlanType,
  PaymentMethod,
  PaymentStatus,
  RoomAsset,
  WaterBottleLogEntry,
} from '../types';
import type { GuestCheckIn } from '../../types';
import { SAMPLE_AADHAAR_SVG_URL } from '../mock-data/initialData';
import {
  formatCurrency,
  formatDate,
  calculateNights,
  getDayName,
  hasDateOverlap,
} from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import { BillSettings, normalizeBillSettings, r2 } from '../../utils/billCalculator';

interface FrontDeskModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  rooms: RoomAsset[];
  assetGroups: AssetGroup[];
  bookings: BookingRecord[];
  checkins?: GuestCheckIn[];
  tasks?: HousekeepingTask[];
  waterLogs: WaterBottleLogEntry[];
  billSettings?: BillSettings;
  loggedInUser?: string;
  onPrintGrc?: (booking: BookingRecord) => void;
  draftBookingSeed?: {
    checkInDate: string;
    checkOutDate: string;
    isOpenStay?: boolean;
    numGuests: number;
    extraBeds?: number;
    extraPersonRate?: number;
    preselectedRoom?: RoomAsset;
    requirements?: BookedCategoryRequirement[];
    editingBooking?: BookingRecord;
    withGst?: boolean;
    gstRate?: number;
  } | null;
  onClearDraftSeed: () => void;
  onSaveFullBooking: (newBooking: BookingRecord, isEdit: boolean) => void;
  onSelectBooking: (booking: BookingRecord) => void;
  onOpenCheckIn: (booking: BookingRecord) => void;
  onQuickCheckOut: (booking: BookingRecord) => void;
  onOpenRecordPayment: (booking: BookingRecord) => void;
  onOpenInvoice: (booking: BookingRecord, scope: 'Only Booking' | 'Booking + Other Services') => void;
  onOpenPreviewDocument: (guest: GuestPerson, bookingNo: string) => void;
  onUpdateGuestDoc?: (
    bookingNoOrId: string,
    guestId: string,
    updates: Partial<GuestPerson>
  ) => void;
  onOpenRoomOrder: (booking: BookingRecord) => void;
  onAddWaterLog: (entry: Omit<WaterBottleLogEntry, 'id'>) => void;
  onExtendStay?: (bookingId: string, extraDays: number) => void;
  onChangeRoom?: (bookingId: string, oldRoomNumber: string, newRoomNumber: string) => void;
  onCancelOrNoShowBooking?: (
    bookingId: string,
    mode: 'Cancelled' | 'No-Show',
    refundAmount: number,
    reason: string
  ) => void;
}

const SUB_TABS = [
  { id: 'dashboard', label: 'All Bookings' },
  { id: 'checkin', label: 'Check-In & GRC' },
  { id: 'reservations', label: 'Advance Bookings' },
  { id: 'prearrival', label: 'Pre-Arrival Desk' },
  { id: 'inhouse', label: 'In-House & 12 PM Stay' },
  { id: 'checkout', label: 'Checkout Desk' },
  { id: 'walkin', label: 'Walk-In' },
  { id: 'services', label: 'Add-Ons & Water' },
  { id: 'documents', label: 'Guest IDs' },
  { id: 'reports', label: 'Lifecycle Reports' },
];

export const FrontDeskModule: React.FC<FrontDeskModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  rooms,
  assetGroups,
  bookings,
  checkins = [],
  tasks = [],
  waterLogs,
  billSettings,
  loggedInUser,
  onPrintGrc,
  draftBookingSeed,
  onClearDraftSeed,
  onSaveFullBooking,
  onSelectBooking,
  onOpenCheckIn,
  onQuickCheckOut,
  onOpenRecordPayment,
  onOpenInvoice,
  onOpenPreviewDocument,
  onUpdateGuestDoc,
  onOpenRoomOrder,
  onAddWaterLog,
  onExtendStay,
  onChangeRoom,
  onCancelOrNoShowBooking,
}) => {
  const normalizedSubTab =
    activeSubTab === 'billing'
      ? 'checkout'
      : activeSubTab === 'settings' || activeSubTab === 'calendar'
      ? 'dashboard'
      : activeSubTab;

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const todayIsoStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

  const [fdDatePreset, setFdDatePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today');
  const [fdFromDate, setFdFromDate] = useState<string>(todayIsoStr);
  const [fdToDate, setFdToDate] = useState<string>(todayIsoStr);
  const [lifecycleBanner, setLifecycleBanner] = useState<string | null>(null);
  const [fdPage, setFdPage] = useState(1);
  const [fdPageSize, setFdPageSize] = useState(10);

  const applyFdDatePreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all') => {
    setFdDatePreset(preset);
    if (preset === 'all') {
      setFdFromDate('');
      setFdToDate('');
    } else if (preset === 'today') {
      setFdFromDate(todayIsoStr);
      setFdToDate(todayIsoStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      setFdFromDate(y);
      setFdToDate(y);
    } else if (preset === 'this_week') {
      const w = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      setFdFromDate(w);
      setFdToDate(todayIsoStr);
    } else if (preset === 'this_month') {
      setFdFromDate(`${todayIsoStr.slice(0, 7)}-01`);
      setFdToDate(todayIsoStr);
    }
  };

  useEffect(() => {
    setFdPage(1);
  }, [search, sourceFilter, statusFilter, fdDatePreset, fdFromDate, fdToDate, normalizedSubTab]);

  const [taxSettings] = useHotelTaxSettings();
  const settings = billSettings || normalizeBillSettings(taxSettings);
  const configuredRoomGst = settings.roomGstRate;

  // Step-2 Create / Update Booking State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bookingType, setBookingType] = useState<'Personal' | 'Corporate'>('Personal');
  const [companyName, setCompanyName] = useState('');
  const [companyGst, setCompanyGst] = useState('');
  const [gstInvoice, setGstInvoice] = useState(true);
  const [gstSlab, setGstSlab] = useState<number>(configuredRoomGst);

  useEffect(() => {
    setGstSlab(configuredRoomGst);
  }, [configuredRoomGst, editingId]);
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [isOpenStay, setIsOpenStay] = useState(false);
  const [expectedArrivalTime, setExpectedArrivalTime] = useState('12:00 PM');
  const [numGuests, setNumGuests] = useState(2);
  const [extraBeds, setExtraBeds] = useState(0);
  const [extraPersonRate, setExtraPersonRate] = useState<number>(() => {
    const rmCharge = Number(rooms[0]?.extraPersonCharge);
    return rmCharge > 0 ? rmCharge : 500;
  });
  const [mobile, setMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [source, setSource] = useState<BookingSource>('WALK-IN');
  const [sourceBookingId, setSourceBookingId] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('UPI');
  const [primaryDocType, setPrimaryDocType] = useState<GuestPerson['documentType']>('Aadhaar Card');
  const [primaryDocNumber, setPrimaryDocNumber] = useState<string>('');
  const [primaryDocImage, setPrimaryDocImage] = useState<string | undefined>(undefined);
  const [additionalOccupants, setAdditionalOccupants] = useState<
    Array<{
      id: string;
      name: string;
      age: number;
      gender: 'Male' | 'Female' | 'Other';
      idNumber: string;
      docType?: GuestPerson['documentType'];
      docImage?: string;
    }>
  >([]);
  const [requirements, setRequirements] = useState<BookedCategoryRequirement[]>(() => {
    const defaultCat = assetGroups[0]?.name || rooms[0]?.category || 'Standard';
    const defaultPrice = assetGroups[0]?.basePrice || rooms[0]?.rate || 2000;
    const defaultRm = rooms.find((r) => r.status === 'Available')?.number || rooms[0]?.number || '';
    return [
      {
        id: 'req-1',
        categoryName: defaultCat,
        qty: 1,
        planName: 'Only Rooms',
        unitPrice: defaultPrice,
        assignedRooms: defaultRm ? [defaultRm] : [],
      },
    ];
  });

  // Room Shift / Change Modal State
  const [roomShiftModalBooking, setRoomShiftModalBooking] = useState<BookingRecord | null>(null);
  const [shiftTargetRoom, setShiftTargetRoom] = useState<string>('');

  // Cancel / Refund Modal State
  const [cancelModalBooking, setCancelModalBooking] = useState<BookingRecord | null>(null);
  const [cancelMode, setCancelMode] = useState<'Cancelled' | 'No-Show'>('Cancelled');
  const [cancelRefundAmt, setCancelRefundAmt] = useState<number>(0);
  const [cancelRefundMethod, setCancelRefundMethod] = useState<PaymentMethod>('UPI');
  const [cancelRefundRef, setCancelRefundRef] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('Guest requested cancellation prior to arrival');

  // Water log state (Total Bottles, Complimentary Free Bottles, Auto Chargeable, Rate per Bottle)
  const [waterRoom, setWaterRoom] = useState(() => rooms[0]?.number || '');
  const [waterTotalBottles, setWaterTotalBottles] = useState<number>(2);
  const [waterFreeBottles, setWaterFreeBottles] = useState<number>(0);
  const [waterRatePerBottle, setWaterRatePerBottle] = useState<number>(() => settings.waterBottleRate || 20);

  useEffect(() => {
    if (settings.waterBottleRate > 0) {
      setWaterRatePerBottle(settings.waterBottleRate);
    }
  }, [settings.waterBottleRate]);

  useEffect(() => {
    if (!waterRoom && rooms.length > 0) {
      setWaterRoom(rooms[0].number);
    }
    if (requirements.length === 1 && requirements[0].assignedRooms.length === 0 && rooms.length > 0 && !editingId) {
      const avail = rooms.find((r) => r.status === 'Available') || rooms[0];
      setRequirements([
        {
          id: 'req-1',
          categoryName: avail.category,
          qty: 1,
          planName: 'Only Rooms',
          unitPrice: avail.rate,
          assignedRooms: [avail.number],
        },
      ]);
    }
  }, [rooms, waterRoom, editingId]);

  // Lifecycle Report Sub-filter
  const [lifecycleReportType, setLifecycleReportType] = useState<string>('advance_res');

  // Guest Identity Documents Search & Category Filter
  const [docSearch, setDocSearch] = useState('');
  const [docCategory, setDocCategory] = useState<'All' | 'Aadhaar' | 'Passport' | 'PAN' | 'Voter'>('All');

  useEffect(() => {
    if (!draftBookingSeed) return;
    if (draftBookingSeed.editingBooking) {
      const eb = draftBookingSeed.editingBooking;
      setEditingId(eb.id);
      setBookingType(eb.bookingType);
      setCompanyName(eb.companyName || '');
      setCompanyGst(eb.companyGst || '');
      setGstInvoice(eb.gstInvoice);
      setGstSlab(eb.taxRate || 5);
      setCheckInDate(eb.checkInDate);
      setCheckOutDate(eb.checkOutDate);
      setIsOpenStay(Boolean(eb.isOpenStay));
      setNumGuests(eb.numGuests);
      setMobile(eb.mobile);
      setCustomerName(eb.customerName);
      setEmail(eb.email);
      setAddress(eb.address);
      setSource(eb.source);
      setSourceBookingId(eb.sourceBookingId || '');
      setDiscountType(eb.discountType);
      setDiscountValue(eb.discountValue);
      setRequirements(eb.requirements);
      const priG = eb.guests?.[0];
      setPrimaryDocType(priG?.documentType || 'Aadhaar Card');
      setPrimaryDocNumber(priG?.documentNumber || '');
      setPrimaryDocImage(priG?.documentImageUrl);
      setAdditionalOccupants(
        (eb.guests || []).slice(1).map((cg) => ({
          id: cg.id,
          name: cg.name,
          age: cg.age || 26,
          gender: cg.gender || 'Female',
          idNumber: cg.documentNumber || '',
          docType: cg.documentType || 'Aadhaar Card',
          docImage: cg.documentImageUrl,
        }))
      );
    } else {
      setEditingId(null);
      setCheckInDate(draftBookingSeed.checkInDate);
      setCheckOutDate(draftBookingSeed.checkOutDate);
      setIsOpenStay(Boolean(draftBookingSeed.isOpenStay));
      setNumGuests(draftBookingSeed.numGuests);
      setExtraBeds(draftBookingSeed.extraBeds ?? 0);
      if (draftBookingSeed.withGst !== undefined) {
        setGstInvoice(draftBookingSeed.withGst);
      }
      if (draftBookingSeed.gstRate !== undefined && draftBookingSeed.gstRate > 0) {
        setGstSlab(draftBookingSeed.gstRate);
      }
      if (draftBookingSeed.extraPersonRate && draftBookingSeed.extraPersonRate > 0) {
        setExtraPersonRate(draftBookingSeed.extraPersonRate);
      }
      if (draftBookingSeed.requirements && draftBookingSeed.requirements.length > 0) {
        const usedRoomSet = new Set<string>();
        setRequirements(
          draftBookingSeed.requirements.map((req, idx) => {
            let assigned = (req.assignedRooms || []).filter((rn) => !usedRoomSet.has(rn));
            if (idx === 0 && draftBookingSeed.preselectedRoom && assigned.length === 0) {
              assigned = [draftBookingSeed.preselectedRoom.number];
            }
            if (assigned.length === 0) {
              const needed = Math.max(1, req.qty || 1);
              const catMatches = rooms
                .filter(
                  (r) =>
                    r.category === req.categoryName &&
                    r.status === 'Available' &&
                    !usedRoomSet.has(r.number)
                )
                .slice(0, needed)
                .map((r) => r.number);
              assigned =
                catMatches.length > 0
                  ? catMatches
                  : rooms
                      .filter((r) => r.status === 'Available' && !usedRoomSet.has(r.number))
                      .slice(0, needed)
                      .map((r) => r.number);
            }
            assigned.forEach((rn) => usedRoomSet.add(rn));
            return {
              ...req,
              assignedRooms: assigned,
              qty: Math.max(1, assigned.length),
            };
          })
        );
      } else if (draftBookingSeed.preselectedRoom) {
        const rm = draftBookingSeed.preselectedRoom;
        setRequirements([
          {
            id: `req-${Date.now()}`,
            categoryName: rm.category,
            qty: 1,
            planName: 'Only Rooms',
            unitPrice: rm.rate,
            assignedRooms: [rm.number],
          },
        ]);
      }
      setTimeout(() => {
        document.getElementById('frontdesk-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [draftBookingSeed]);

  const nights = isOpenStay ? 1 : calculateNights(checkInDate, checkOutDate);
  const checkInDayName = getDayName(checkInDate);
  const checkOutDayName = getDayName(checkOutDate);

  const getPlanRate = (categoryName: string, planName: MealPlanType): number => {
    const grp = assetGroups.find((g) => g.name === categoryName);
    if (!grp) return 2000;
    const foundPlan = grp.planPrices.find((p) => p.planName === planName);
    return foundPlan ? foundPlan.price : grp.basePrice;
  };

  // Strict Overlap Validation: Check if a room is already booked for overlapping dates
  const findOverlappingBookingForRoom = (roomNumber: string): BookingRecord | undefined => {
    return bookings.find((b) => {
      if (b.id === editingId) return false;
      if (b.status === 'Checked Out' || b.status === 'Cancelled' || b.status === 'No-Show') {
        return false;
      }
      if (!b.roomNumbers.includes(roomNumber)) return false;
      return hasDateOverlap(checkInDate, checkOutDate, b.checkInDate, b.checkOutDate);
    });
  };

  const handleToggleRoomChip = (reqId: string, roomNumber: string) => {
    setRequirements((prev) => {
      const targetReq = prev.find((r) => r.id === reqId);
      const isRemoving = targetReq?.assignedRooms.includes(roomNumber);
      return prev.map((req) => {
        if (req.id !== reqId) {
          // Ensure a physical room number is never assigned to two requirement rows simultaneously
          if (!isRemoving && req.assignedRooms.includes(roomNumber)) {
            const filtered = req.assignedRooms.filter((r) => r !== roomNumber);
            return {
              ...req,
              assignedRooms: filtered,
              qty: Math.max(1, filtered.length),
            };
          }
          return req;
        }
        const updatedRooms = isRemoving
          ? req.assignedRooms.filter((r) => r !== roomNumber)
          : [...req.assignedRooms, roomNumber];
        return {
          ...req,
          assignedRooms: updatedRooms,
          qty: Math.max(1, updatedRooms.length),
        };
      });
    });
  };

  const handleAddCategoryRow = () => {
    const defaultGrp = assetGroups[0];
    setRequirements((prev) => [
      ...prev,
      {
        id: `req-${Date.now()}`,
        categoryName: defaultGrp?.name || 'Standard',
        qty: 1,
        planName: 'Only Rooms',
        unitPrice: defaultGrp?.basePrice || 2000,
        assignedRooms: [],
      },
    ]);
  };

  const baseRoomTariffSubtotal = requirements.reduce(
    (sum, r) => sum + r.unitPrice * Math.max(1, r.assignedRooms.length || r.qty) * nights,
    0
  );

  // Calculate Extra Pax / Extra Bed Fee automatically when guests or extra beds increase
  const allSelectedRoomNumbers = Array.from(new Set(requirements.flatMap((r) => r.assignedRooms)));
  const selectedRoomObjects = allSelectedRoomNumbers
    .map((rn) => rooms.find((rm) => rm.number === rn))
    .filter((rm): rm is RoomAsset => Boolean(rm));
  const totalRoomsCount = Math.max(
    1,
    allSelectedRoomNumbers.length || requirements.reduce((sum, r) => sum + Math.max(1, r.qty), 0)
  );
  const totalBaseOccupancy =
    selectedRoomObjects.length > 0
      ? selectedRoomObjects.reduce((sum, rm) => sum + (Number(rm.baseOccupancy) > 0 ? Number(rm.baseOccupancy) : 2), 0)
      : totalRoomsCount * 2;
  const extraPaxByGuests = Math.max(0, numGuests - totalBaseOccupancy);
  const extraPaxCount = Math.max(extraPaxByGuests, extraBeds);
  const defaultRoomExtraCharge =
    selectedRoomObjects.length > 0 && Number(selectedRoomObjects[0].extraPersonCharge) > 0
      ? Number(selectedRoomObjects[0].extraPersonCharge)
      : Number(rooms[0]?.extraPersonCharge) > 0
      ? Number(rooms[0]?.extraPersonCharge)
      : 500;
  const extraPaxRatePerNight = extraPersonRate > 0 ? extraPersonRate : defaultRoomExtraCharge;
  const extraPaxSubtotal = extraPaxCount * extraPaxRatePerNight * nights;

  const roomSubtotal = baseRoomTariffSubtotal + extraPaxSubtotal;
  const discountAmount =
    discountType === 'flat' ? discountValue : Math.round((roomSubtotal * discountValue) / 100);
  const taxableAmount = Math.max(0, roomSubtotal - discountAmount);
  const taxRate = gstInvoice ? configuredRoomGst : 0;
  const taxAmount = r2((taxableAmount * taxRate) / 100);
  const totalPayable = r2(taxableAmount + taxAmount);

  const getPaymentStatusBadge = (b: BookingRecord): { label: PaymentStatus; cls: string } => {
    if (b.status === 'Cancelled' && (b.refundAmount || 0) > 0) {
      return { label: 'Refunded', cls: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    if (b.dueAmount <= 0 && b.amountPaid > 0) {
      return { label: 'Fully Paid', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (b.amountPaid > 0 && !b.isCheckedIn) {
      return { label: 'Advance Paid', cls: 'bg-amber-100 text-amber-900 border-amber-300' };
    }
    if (b.amountPaid > 0) {
      return { label: 'Partially Paid', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    return { label: 'Unpaid', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
  };

  const handleSaveBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enforce 1-to-1 physical room assignment so 2 categories/rooms are never stacked onto 1 room
    const usedRoomNumbers = new Set<string>();
    const normalizedRequirements: BookedCategoryRequirement[] = [];

    for (const req of requirements) {
      let distinctAssigned = (req.assignedRooms || []).filter((rn) => !usedRoomNumbers.has(rn));
      if (distinctAssigned.length === 0) {
        const needed = Math.max(1, req.qty || 1);
        const catAvail = rooms
          .filter(
            (r) =>
              r.category === req.categoryName &&
              r.status === 'Available' &&
              !usedRoomNumbers.has(r.number) &&
              !findOverlappingBookingForRoom(r.number)
          )
          .slice(0, needed)
          .map((r) => r.number);
        distinctAssigned = catAvail;
      }
      distinctAssigned.forEach((rn) => usedRoomNumbers.add(rn));
      if (distinctAssigned.length > 0) {
        normalizedRequirements.push({
          ...req,
          assignedRooms: distinctAssigned,
          qty: distinctAssigned.length,
        });
      }
    }

    if (normalizedRequirements.length === 0) {
      const availableFallbackRoom =
        rooms.find((r) => r.status === 'Available' && !findOverlappingBookingForRoom(r.number)) ||
        rooms[0];
      const fallbackNum = availableFallbackRoom?.number || '101';
      const firstReq = requirements[0];
      normalizedRequirements.push({
        id: firstReq?.id || `req-${Date.now()}`,
        categoryName: availableFallbackRoom?.category || firstReq?.categoryName || 'Standard',
        qty: 1,
        planName: firstReq?.planName || 'Only Rooms',
        unitPrice: availableFallbackRoom?.rate || firstReq?.unitPrice || 2000,
        assignedRooms: [fallbackNum],
      });
    }

    const finalRooms = Array.from(new Set(normalizedRequirements.flatMap((r) => r.assignedRooms)));

    // Strict Overlap Check before saving
    for (const rn of finalRooms) {
      const conflict = findOverlappingBookingForRoom(rn);
      if (conflict) {
        alert(
          `Room ${rn} is already reserved under Booking ${conflict.bookingNo} (${conflict.customerName}) for ${conflict.checkInDate} to ${conflict.checkOutDate}. Please select another available room chip.`
        );
        return;
      }
    }

    const existingBooking = editingId ? bookings.find((b) => b.id === editingId) : undefined;
    const bookingNo = existingBooking
      ? existingBooking.bookingNo
      : `#${bookings.length + 101}`;
    const paidAmount = existingBooking ? existingBooking.amountPaid : advancePaid;
    const isWalkInImmediate = normalizedSubTab === 'walkin';

    const existingPrimary = existingBooking?.guests?.[0];
    const primaryGuest: GuestPerson = {
      id: existingPrimary?.id || `gst-pri-${Date.now()}`,
      name: customerName.trim() || 'Walk-In Guest',
      phone: mobile.trim() || '9829011223',
      email: email.trim() || 'guest@directstay.in',
      gender: existingPrimary?.gender || 'Male',
      age: existingPrimary?.age || 32,
      dob: existingPrimary?.dob || '1994-05-12',
      isAdult: true,
      documentType: primaryDocType || 'Aadhaar Card',
      documentNumber:
        primaryDocNumber.trim() || existingPrimary?.documentNumber || '',
      documentImageUrl: primaryDocImage || existingPrimary?.documentImageUrl,
    };

    const coGuests: GuestPerson[] = additionalOccupants
      .filter((o) => o.name.trim())
      .map((o) => ({
        id: o.id,
        name: o.name.trim(),
        phone: mobile.trim() || '9829011223',
        email: email.trim() || 'guest@directstay.in',
        gender: o.gender,
        age: o.age,
        dob: '1996-01-01',
        isAdult: o.age >= 12,
        documentType: o.docType || 'Aadhaar Card',
        documentNumber: o.idNumber || '',
        documentImageUrl: o.docImage,
      }));

    const grandPayable = totalPayable + (existingBooking ? existingBooking.otherServicesTotal : 0);
    const balanceDue = Math.max(0, Math.round((grandPayable - paidAmount) * 100) / 100);

    const record: BookingRecord = {
      id: existingBooking ? existingBooking.id : `bkg-${Date.now()}`,
      bookingNo,
      billId: existingBooking ? existingBooking.billId : `20261100${Math.floor(100 + Math.random() * 899)}`,
      bookingType,
      companyName: bookingType === 'Corporate' ? companyName : undefined,
      companyGst: bookingType === 'Corporate' ? companyGst : undefined,
      gstInvoice,
      customerName: customerName.trim() || 'Walk-In Guest',
      mobile: mobile.trim() || '9829011223',
      email: email.trim() || 'guest@directstay.in',
      address,
      numGuests: Math.max(numGuests, 1 + coGuests.length),
      adults: Math.max(numGuests, 1 + coGuests.length),
      children: 0,
      checkInDate,
      checkOutDate,
      checkInTime: existingBooking?.checkInTime || `${checkInDate}, ${expectedArrivalTime}`,
      checkOutTime: isOpenStay ? 'Open Stay (12:00 PM Daily Auto-Prompt)' : `${checkOutDate}, 11:00 AM`,
      nights,
      isOpenStay,
      expectedArrivalTime,
      status: existingBooking
        ? existingBooking.status
        : isWalkInImmediate
        ? 'Checked In'
        : 'Confirmed',
      paymentStatus:
        balanceDue <= 0 && paidAmount > 0
          ? 'Fully Paid'
          : paidAmount > 0
          ? 'Advance Paid'
          : 'Unpaid',
      isCheckedIn: existingBooking ? existingBooking.isCheckedIn : isWalkInImmediate,
      isCheckedOut: existingBooking ? existingBooking.isCheckedOut : false,
      source: isWalkInImmediate ? 'WALK-IN' : source,
      sourceBookingId: sourceBookingId || undefined,
      bookedOn: existingBooking ? existingBooking.bookedOn : todayIsoStr,
      hasExtraBed: extraPaxCount > 0,
      extraBedCount: extraPaxCount,
      extraBedRate: extraPaxRatePerNight,
      extraPersonCharges: extraPaxSubtotal,
      requirements: normalizedRequirements,
      roomNumbers: finalRooms,
      roomCategorySummary: normalizedRequirements
        .map((r) => `${r.assignedRooms.length}x ${r.categoryName} (${r.planName})`)
        .join(', '),
      roomSubtotal,
      otherServicesTotal: existingBooking ? existingBooking.otherServicesTotal : 0,
      discountType,
      discountValue,
      discountAmount,
      taxRate,
      taxAmount,
      totalPayable: grandPayable,
      amountPaid: paidAmount,
      dueAmount: balanceDue,
      guests: [primaryGuest, ...coGuests],
      payments: existingBooking
        ? existingBooking.payments
        : advancePaid > 0
        ? [
            {
              id: `pay-${Date.now()}`,
              bookingId: `bkg-${Date.now()}`,
              amount: advancePaid,
              paymentMethod: advanceMethod,
              transactionId:
                advanceMethod === 'Cash'
                  ? 'CASH-ADV'
                  : `UTR${Math.floor(10000000 + Math.random() * 90000000)}`,
              date: checkInDate,
              time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
              recordedBy: 'Front Desk',
              notes: 'Advance collected at reservation creation (Carried forward to folio)',
            },
          ]
        : [],
      otherServices: existingBooking ? existingBooking.otherServices : [],
    };

    onSaveFullBooking(record, Boolean(editingId));
    onClearDraftSeed();
    setLifecycleBanner(
      `Booking ${record.bookingNo} (${record.customerName}) saved for Room ${record.roomNumbers.join(
        ', '
      )} with ${taxRate}% GST (${checkInDayName} to ${
        isOpenStay ? 'Open Stay 12:00 PM Daily' : checkOutDayName
      }). Advance ₹${paidAmount} linked to folio.`
    );
    onSubTabChange('dashboard');
  };

  const filteredBookings = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchText =
      !q ||
      b.customerName.toLowerCase().includes(q) ||
      b.bookingNo.toLowerCase().includes(q) ||
      b.mobile.includes(q) ||
      b.roomNumbers.some((r) => r.includes(q));
    const matchSource = sourceFilter === 'ALL' || b.source === sourceFilter;
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;

    let matchDate = true;
    if (fdDatePreset !== 'all' || fdFromDate || fdToDate) {
      const ci = String(b.checkInDate || '').slice(0, 10);
      const co = String(b.checkOutDate || '').slice(0, 10);
      const bo = String(b.bookedOn || '').slice(0, 10);
      const dates = [ci, co, /^\d{4}-\d{2}-\d{2}$/.test(bo) ? bo : ''].filter(Boolean);
      if (dates.length > 0) {
        const overlapsStay =
          ci && co && fdFromDate && fdToDate ? ci <= fdToDate && co >= fdFromDate : false;
        const anyInRange = dates.some(
          (d) => (!fdFromDate || d >= fdFromDate) && (!fdToDate || d <= fdToDate)
        );
        matchDate = overlapsStay || anyInRange;
      }
    }

    return matchText && matchSource && matchStatus && matchDate;
  });

  const allGuestsWithDocs = (() => {
    const items = bookings.flatMap((b) => {
      const safeRooms =
        Array.isArray(b.roomNumbers) && b.roomNumbers.length > 0
          ? b.roomNumbers
          : [(b as any).roomNumber || (b as any).room || '101'];

      const linkedChk = checkins.find(
        (c) =>
          c.id === b.id ||
          c.id === b.bookingNo ||
          (c as any).bookingId === b.id ||
          (c.roomNumber === safeRooms[0] &&
            c.checkInDate === b.checkInDate &&
            c.guestName === b.customerName)
      );

      const fallbackDocImg =
        (b as any).idProofFileData ||
        (b as any).aadhaarUploadData ||
        (b as any).documentImageUrl ||
        linkedChk?.idProofFileData ||
        linkedChk?.aadhaarUploadData ||
        linkedChk?.passportUploadData ||
        linkedChk?.guestPhotoData;

      const fallbackDocNum =
        (b as any).idProofNumber ||
        (b as any).aadhaarNumber ||
        linkedChk?.idNumber ||
        linkedChk?.aadhaarNumber ||
        linkedChk?.passportNumber ||
        '';

      const fallbackDocType =
        (b as any).idProofType ||
        linkedChk?.idType ||
        'Aadhaar Card';

      const guestList: GuestPerson[] =
        Array.isArray(b.guests) && b.guests.length > 0
          ? b.guests
          : [
              {
                id: `gst-${b.id}`,
                name: b.customerName || (b as any).guestName || 'Guest',
                phone: b.mobile || (b as any).phone || '',
                email: b.email || '',
                gender: 'Male',
                age: 30,
                dob: '',
                isAdult: true,
                documentType: fallbackDocType as any,
                documentNumber: fallbackDocNum,
                documentImageUrl: fallbackDocImg,
              } as GuestPerson,
            ];

      return guestList.map((g, idx) => ({
        guest: {
          ...g,
          documentType: (g.documentType || (idx === 0 ? fallbackDocType : 'Aadhaar Card')) as any,
          documentNumber: g.documentNumber || (idx === 0 ? fallbackDocNum : ''),
          documentImageUrl:
            g.documentImageUrl || (idx === 0 ? fallbackDocImg : undefined),
        },
        booking: b,
        roomDisplay: safeRooms.join(', '),
      }));
    });

    // Sort so guests with actual uploaded document images appear first!
    return items.sort((a, b) => {
      const aHasImg = Boolean(
        a.guest.documentImageUrl && a.guest.documentImageUrl !== SAMPLE_AADHAAR_SVG_URL
      );
      const bHasImg = Boolean(
        b.guest.documentImageUrl && b.guest.documentImageUrl !== SAMPLE_AADHAAR_SVG_URL
      );
      if (aHasImg && !bHasImg) return -1;
      if (!aHasImg && bHasImg) return 1;
      return 0;
    });
  })();

  const filteredGuestsWithDocs = allGuestsWithDocs.filter(({ guest, booking, roomDisplay }) => {
    const q = docSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      guest.name.toLowerCase().includes(q) ||
      booking.bookingNo.toLowerCase().includes(q) ||
      guest.phone.includes(q) ||
      roomDisplay.toLowerCase().includes(q) ||
      (guest.documentNumber && guest.documentNumber.toLowerCase().includes(q));

    const matchesCategory =
      docCategory === 'All' ||
      guest.documentType.toLowerCase().includes(docCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const inhouseBookings = bookings.filter((b) => b.isCheckedIn && !b.isCheckedOut);
  const preArrivalBookings = bookings.filter(
    (b) => !b.isCheckedIn && !b.isCheckedOut && b.status !== 'Cancelled' && b.status !== 'No-Show'
  );
  const availableCleanRooms = rooms.filter((r) => r.status === 'Available' && r.cleaningStatus === 'Clean');

  return (
    <div className="space-y-5">
      {/* Module Header & Connected Lifecycle Sub-Navigation Pills */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Front Desk — Complete Booking-to-Checkout Guest Lifecycle
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Advance Reservation → Pre-Arrival → Check-In & GRC → In-House & 12:00 PM Daily Stay Prompt → Split-Payment Checkout → Housekeeping Turnaround
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                onSubTabChange('reservations');
                setTimeout(() => {
                  document.getElementById('frontdesk-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
              }}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Advance Booking</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                onSubTabChange('walkin');
                setTimeout(() => {
                  document.getElementById('frontdesk-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
              }}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Walk-In Booking</span>
            </button>
          </div>
        </div>

        {lifecycleBanner && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs text-emerald-900 font-bold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lifecycleBanner}</span>
            </span>
            <button
              type="button"
              onClick={() => setLifecycleBanner(null)}
              className="text-emerald-700 hover:underline text-[11px] whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 12:00 PM DAILY STAY CONTINUATION BANNER (Calm Light Cream Theme) */}
      {(normalizedSubTab === 'inhouse' || normalizedSubTab === 'dashboard') &&
        inhouseBookings.length > 0 && (
          <div className="bg-gradient-to-r from-[#FFFDF7] via-[#FBF4E0] to-[#FFF9EB] text-[#263449] p-4 rounded-2xl border border-[#DFC078] shadow-xs flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F5E3B8] border border-[#D4AD50] text-[#8B691E] flex items-center justify-center shrink-0 font-extrabold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider border border-amber-300">
                    12:00 PM Daily Stay Continuation Rule Active
                  </span>
                  <span className="text-xs text-[#5A6B82] font-semibold">
                    {inhouseBookings.length} In-House Guest Bookings Monitored
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#263449] mt-1">
                  Open Check-Out / Daily 12:00 PM Morning Prompt: Continue Stay (+1 Day) or Checkout
                </h3>
                <p className="text-[11px] text-[#5A6B82]">
                  For guests without a fixed departure date (or extending stay at 12:00 PM), click{' '}
                  <strong className="text-emerald-700">Continue (+1 Day)</strong> to auto-post 1 night tariff + 5% GST, or click{' '}
                  <strong className="text-rose-700">Checkout</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {inhouseBookings.map((ib) => (
                <div
                  key={ib.id}
                  className="px-3 py-2 rounded-xl bg-white border border-[#DFC078] shadow-2xs flex items-center gap-2.5 text-xs"
                >
                  <div>
                    <div className="font-bold text-[#263449] whitespace-nowrap">
                      Rm {ib.roomNumbers.join(', ')} • {ib.customerName}
                    </div>
                    <div className="text-[10px] text-[#5A6B82] whitespace-nowrap">
                      {ib.nights}N • Due: {formatCurrency(ib.dueAmount)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onExtendStay) onExtendStay(ib.id, 1);
                      setLifecycleBanner(
                        `12:00 PM Daily Action: Extended ${ib.customerName} (Room ${ib.roomNumbers.join(
                          ', '
                        )}) by +1 Night with 5% GST.`
                      );
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <CalendarPlus className="w-3 h-3 shrink-0" />
                    <span>Continue (+1 Day)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickCheckOut(ib)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3 h-3 shrink-0" />
                    <span>Checkout</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* STEP 2: PRE-ARRIVAL DESK */}
      {normalizedSubTab === 'prearrival' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-[#FAF6EE]">
            <div>
              <h3 className="text-sm font-extrabold text-[#263449]">
                Pre-Arrival Verification, Expected Arrival Time & Room Readiness Desk
              </h3>
              <p className="text-xs text-[#5A6B82]">
                Verify guest identity, check room cleaning readiness, collect advance deposits, or mark No-Show
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#F5E3B8] text-[#7A5813] border border-[#D4AD50] text-xs font-bold whitespace-nowrap shrink-0">
              {preArrivalBookings.length} Upcoming Arrivals
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-3 whitespace-nowrap">Booking #</th>
                  <th className="py-3 px-3 whitespace-nowrap">Guest & Contact</th>
                  <th className="py-3 px-3 whitespace-nowrap">Arrival Date & Day</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">ETA</th>
                  <th className="py-3 px-3 whitespace-nowrap">Room & Prep Status</th>
                  <th className="py-3 px-3 whitespace-nowrap">Advance Deposit</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Pre-Arrival Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preArrivalBookings.map((b) => {
                  const assignedRmObj = rooms.find((r) => b.roomNumbers.includes(r.number));
                  const isRoomClean = !assignedRmObj || assignedRmObj.cleaningStatus === 'Clean';
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold whitespace-nowrap">
                        <div>#{b.bookingNo.replace(/^#/, '')}</div>
                        <div className="text-[10px] text-amber-700 font-semibold">{b.source}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{b.customerName}</div>
                        <div className="text-[11px] text-slate-500">
                          +91 {b.mobile} • {b.numGuests} Guests
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{formatDate(b.checkInDate)}</div>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {getDayName(b.checkInDate)}
                        </span>
                      </td>
                      <td className="py-3 px-2.5 font-semibold text-blue-800 whitespace-nowrap">
                        {b.expectedArrivalTime || '12:00 PM'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900">
                          Room {b.roomNumbers.join(', ')}
                        </div>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            isRoomClean
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isRoomClean ? '✓ Room Clean & Ready' : '⚠ Cleaning Required'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-emerald-700">
                          Paid: {formatCurrency(b.amountPaid)}
                        </div>
                        <div className="text-[10px] text-rose-600 font-semibold">
                          Pending: {formatCurrency(b.dueAmount)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenCheckIn(b)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <LogIn className="w-3 h-3 shrink-0" />
                            <span>Check-In</span>
                          </button>
                          {onPrintGrc && (
                            <button
                              type="button"
                              onClick={() => onPrintGrc(b)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#17120F] hover:bg-slate-800 text-[#E0BD6B] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              title="Print Guest Registration Card (GRC)"
                            >
                              <Printer className="w-3 h-3 shrink-0" />
                              <span>Print GRC</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenRecordPayment(b)}
                            className="px-2 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] inline-flex items-center cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>+ Advance</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalBooking(b);
                              setCancelMode('Cancelled');
                              setCancelRefundAmt(b.amountPaid);
                              setCancelReason('Guest requested cancellation prior to arrival');
                            }}
                            className="px-2 py-1.5 rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 font-bold text-[11px] inline-flex items-center cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>Cancel & Refund</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalBooking(b);
                              setCancelMode('No-Show');
                              setCancelRefundAmt(0);
                              setCancelReason('Guest did not arrive before cutoff time (No-Show)');
                            }}
                            className="px-2 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] inline-flex items-center cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>No-Show</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 1, 3, 4, 5/6: ALL BOOKINGS / ADVANCE BOOKINGS / CHECK-IN / IN-HOUSE / CHECK-OUT DIRECTORY */}
      {(normalizedSubTab === 'dashboard' ||
        normalizedSubTab === 'reservations' ||
        normalizedSubTab === 'inhouse' ||
        normalizedSubTab === 'checkin' ||
        normalizedSubTab === 'checkout') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 space-y-3">
            {/* Date-Wise Filter Bar */}
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1 mr-1">
                  <Calendar className="w-3.5 h-3.5" />
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
                    onClick={() => applyFdDatePreset(p.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      fdDatePreset === p.id
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
                  value={fdFromDate}
                  onChange={(e) => {
                    setFdDatePreset('custom');
                    setFdFromDate(e.target.value);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white font-bold text-slate-800 text-xs"
                />
                <span className="text-slate-400 font-bold">→</span>
                <input
                  type="date"
                  value={fdToDate}
                  onChange={(e) => {
                    setFdDatePreset('custom');
                    setFdToDate(e.target.value);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white font-bold text-slate-800 text-xs"
                />
                <button
                  type="button"
                  onClick={() => applyFdDatePreset('today')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-[11px] cursor-pointer"
                >
                  Reset to Today
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, mobile, #booking, room..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Booking Sources</option>
                <option value="WALK-IN">WALK-IN</option>
                <option value="MakeMyTrip">MakeMyTrip</option>
                <option value="Booking.com">Booking.com</option>
                <option value="Website">Direct Website</option>
                <option value="Corporate">Corporate</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Booking Statuses</option>
                <option value="Confirmed">Confirmed (Advance)</option>
                <option value="Checked In">Checked In (In-House)</option>
                <option value="Checked Out">Checked Out</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-Show">No-Show</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing{' '}
              <strong>
                {
                  filteredBookings.filter((b) => {
                    if (normalizedSubTab === 'inhouse') return b.isCheckedIn && !b.isCheckedOut;
                    if (normalizedSubTab === 'reservations') return !b.isCheckedIn && !b.isCheckedOut;
                    if (normalizedSubTab === 'checkin')
                      return !b.isCheckedIn && !b.isCheckedOut && b.status !== 'Cancelled' && b.status !== 'No-Show';
                    if (normalizedSubTab === 'checkout')
                      return (
                        b.isCheckedIn ||
                        b.isCheckedOut ||
                        b.status === 'Checked In' ||
                        b.status === 'Confirmed'
                      );
                    return true;
                  }).length
                }
              </strong>{' '}
              guest bookings
            </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-2.5">Booking #</th>
                  <th className="py-3 px-2.5">Guest & Occupants</th>
                  <th className="py-3 px-2.5">Room & Plan</th>
                  <th className="py-3 px-2.5">Stay Dates</th>
                  <th className="py-3 px-2.5">Total / Paid / Due</th>
                  <th className="py-3 px-2.5">Booking & Pay Status</th>
                  <th className="py-3 px-2.5 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {(() => {
                  const subTabFiltered = filteredBookings.filter((b) => {
                    if (normalizedSubTab === 'inhouse') return b.isCheckedIn && !b.isCheckedOut;
                    if (normalizedSubTab === 'reservations') return !b.isCheckedIn && !b.isCheckedOut;
                    if (normalizedSubTab === 'checkin')
                      return !b.isCheckedIn && !b.isCheckedOut && b.status !== 'Cancelled' && b.status !== 'No-Show';
                    if (normalizedSubTab === 'checkout')
                      return (
                        b.isCheckedIn ||
                        b.isCheckedOut ||
                        b.status === 'Checked In' ||
                        b.status === 'Confirmed'
                      );
                    return true;
                  });
                  if (subTabFiltered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          No bookings found for the selected filter. Click <strong>+ Walk-In Booking</strong> to create a new reservation.
                        </td>
                      </tr>
                    );
                  }
                  const fdStartIndex = (fdPage - 1) * fdPageSize;
                  const fdEndIndex = Math.min(fdStartIndex + fdPageSize, subTabFiltered.length);
                  const paginated = subTabFiltered.slice(fdStartIndex, fdEndIndex);
                  return paginated.map((booking) => {
                    const payBadge = getPaymentStatusBadge(booking);
                    return (
                      <tr
                        key={booking.id}
                        onClick={() => onSelectBooking(booking)}
                        className="hover:bg-amber-50/30 cursor-pointer transition"
                      >
                        <td className="py-3 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                          <div>#{booking.bookingNo.replace(/^#/, '')}</div>
                          <div className="text-[10px] text-amber-700 font-semibold">
                            {booking.source}
                          </div>
                        </td>
                        <td className="py-3 px-2.5">
                          <div className="font-bold text-slate-900">{booking.customerName}</div>
                          <div className="text-[11px] text-slate-500">
                            +91 {booking.mobile} • {booking.numGuests} Guests
                          </div>
                        </td>
                        <td className="py-3 px-2.5">
                          <div className="flex flex-wrap gap-1 mb-0.5">
                            {booking.roomNumbers.map((rn) => (
                              <span
                                key={rn}
                                className="px-2 py-0.5 rounded bg-[#FBF0D4] text-[#7A5813] border border-[#DFC078] font-bold text-[10px] whitespace-nowrap"
                              >
                                Room {rn}
                              </span>
                            ))}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {booking.roomCategorySummary}
                          </div>
                        </td>
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 text-[11px]">
                            In: {formatDate(booking.checkInDate)}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Out: {booking.isOpenStay ? 'Open Stay' : formatDate(booking.checkOutDate)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {booking.nights} Night(s) • GST {booking.taxRate}%
                          </div>
                        </td>
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {formatCurrency(booking.totalPayable)}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-semibold">
                            Paid/Adv: {formatCurrency(booking.amountPaid)}
                          </div>
                          {(booking.refundAmount || 0) > 0 && (
                            <div className="text-[11px] font-extrabold text-purple-700">
                              Refunded: {formatCurrency(booking.refundAmount || 0)}
                            </div>
                          )}
                          {booking.dueAmount > 0 && booking.status !== 'Cancelled' && (
                            <div className="text-[11px] font-bold text-rose-600">
                              Due: {formatCurrency(booking.dueAmount)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                booking.status === 'Checked In'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : booking.status === 'Confirmed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : booking.status === 'Cancelled' || booking.status === 'No-Show'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {booking.status === 'Confirmed' ? '✓ Confirmed' : `Booking: ${booking.status}`}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold ${payBadge.cls}`}
                            >
                              Pay: {payBadge.label}
                            </span>
                          </div>
                        </td>
                        <td
                          className="py-3 px-2.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap items-center justify-end gap-1 max-w-[240px] ml-auto">
                            {/* Edit Booking: for un-checked-in bookings */}
                            {!booking.isCheckedIn &&
                              !booking.isCheckedOut &&
                              booking.status !== 'Cancelled' &&
                              booking.status !== 'No-Show' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(booking.id);
                                    setBookingType(booking.bookingType);
                                    setCompanyName(booking.companyName || '');
                                    setCompanyGst(booking.companyGst || '');
                                    setGstInvoice(booking.gstInvoice);
                                    setGstSlab(booking.taxRate || 5);
                                    setCheckInDate(booking.checkInDate);
                                    setCheckOutDate(booking.checkOutDate);
                                    setIsOpenStay(Boolean(booking.isOpenStay));
                                    setNumGuests(booking.numGuests);
                                    setMobile(booking.mobile);
                                    setCustomerName(booking.customerName);
                                    setEmail(booking.email);
                                    setAddress(booking.address);
                                    setSource(booking.source);
                                    setRequirements(booking.requirements);
                                    const priG = booking.guests?.[0];
                                    setPrimaryDocType(priG?.documentType || 'Aadhaar Card');
                                    setPrimaryDocNumber(priG?.documentNumber || '');
                                    setPrimaryDocImage(priG?.documentImageUrl);
                                    setAdditionalOccupants(
                                      (booking.guests || []).slice(1).map((cg) => ({
                                        id: cg.id,
                                        name: cg.name,
                                        age: cg.age || 26,
                                        gender: cg.gender || 'Female',
                                        idNumber: cg.documentNumber || '',
                                        docType: cg.documentType || 'Aadhaar Card',
                                        docImage: cg.documentImageUrl,
                                      }))
                                    );
                                    onSubTabChange('reservations');
                                    setTimeout(() => {
                                      document.getElementById('frontdesk-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }, 80);
                                  }}
                                  className="px-2 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                  title="Edit Reservation"
                                >
                                  <Edit3 className="w-3 h-3 shrink-0" />
                                  <span>Edit</span>
                                </button>
                              )}

                            {/* Cancel & Refund: for un-checked-in bookings */}
                            {!booking.isCheckedIn &&
                              !booking.isCheckedOut &&
                              booking.status !== 'Cancelled' &&
                              booking.status !== 'No-Show' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelModalBooking(booking);
                                    setCancelMode('Cancelled');
                                    setCancelRefundAmt(booking.amountPaid);
                                    setCancelReason('Guest requested date change / cancellation prior to arrival');
                                  }}
                                  className="px-2 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                  title="Cancel Booking & Authorize Refund"
                                >
                                  <span>Cancel & Refund</span>
                                </button>
                              )}

                            {/* Check-In Action: for un-checked-in bookings */}
                            {!booking.isCheckedIn &&
                              !booking.isCheckedOut &&
                              booking.status !== 'Cancelled' &&
                              booking.status !== 'No-Show' && (
                                <button
                                  type="button"
                                  onClick={() => onOpenCheckIn(booking)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                                >
                                  <LogIn className="w-3 h-3 shrink-0" />
                                  <span>Check-In</span>
                                </button>
                              )}

                            {/* Cancelled & Refunded Badge */}
                            {(booking.status === 'Cancelled' || booking.status === 'No-Show') && (
                              <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[10px] inline-flex items-center gap-1 whitespace-nowrap">
                                <span>↩ Refunded {formatCurrency(booking.refundAmount || 0)}</span>
                              </span>
                            )}

                            {/* In-House Guest Operations: Shift, Extend (+1 Day), POS */}
                            {booking.isCheckedIn && !booking.isCheckedOut && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onExtendStay) onExtendStay(booking.id, 1);
                                    setLifecycleBanner(
                                      `Extended stay by +1 Night for ${booking.customerName} (Room ${booking.roomNumbers.join(
                                        ', '
                                      )})`
                                    );
                                  }}
                                  className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                  title="12:00 PM Continue Stay (+1 Night)"
                                >
                                  <CalendarPlus className="w-3 h-3 shrink-0" />
                                  <span>+1 Day</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRoomShiftModalBooking(booking);
                                    setShiftTargetRoom(availableCleanRooms[0]?.number || '');
                                  }}
                                  className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                  title="Shift / Change Room"
                                >
                                  <ArrowRightLeft className="w-3 h-3 shrink-0" />
                                  <span>Shift Rm</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenRoomOrder(booking)}
                                  className="px-2 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                  title="Add POS / Laundry Service"
                                >
                                  <Utensils className="w-3 h-3 shrink-0" />
                                  <span>+ POS</span>
                                </button>
                              </>
                            )}

                            {/* Checkout Clearance Action: for In-House or on Checkout Desk */}
                            {!booking.isCheckedOut &&
                              booking.status !== 'Cancelled' &&
                              booking.status !== 'No-Show' &&
                              (booking.isCheckedIn ||
                                normalizedSubTab === 'checkout' ||
                                booking.status === 'Checked In') && (
                                <button
                                  type="button"
                                  onClick={() => onQuickCheckOut(booking)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                                  title="Perform Checkout Clearance & Folio Settlement"
                                >
                                  <LogOut className="w-3 h-3 shrink-0" />
                                  <span>Checkout</span>
                                </button>
                              )}

                            {/* Checked Out Completed Badge */}
                            {booking.isCheckedOut && (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Checked Out</span>
                              </span>
                            )}

                            {onPrintGrc && booking.status !== 'Cancelled' && booking.status !== 'No-Show' && (
                              <button
                                type="button"
                                onClick={() => onPrintGrc(booking)}
                                className="px-2 py-1.5 rounded-lg bg-[#17120F] hover:bg-slate-800 text-[#E0BD6B] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                title="Print Guest Registration Card (GRC)"
                              >
                                <Printer className="w-3 h-3 shrink-0" />
                                <span>Print GRC</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenInvoice(booking, 'Booking + Other Services')}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                              title="Confirmation Voucher / GST Invoice"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectBooking(booking)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                              title="Booking Confirmation & Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
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

          {/* Dynamic Front Desk Pagination Controls */}
          {(() => {
            const subTabFiltered = filteredBookings.filter((b) => {
              if (normalizedSubTab === 'inhouse') return b.isCheckedIn && !b.isCheckedOut;
              if (normalizedSubTab === 'reservations') return !b.isCheckedIn && !b.isCheckedOut;
              if (normalizedSubTab === 'checkin')
                return !b.isCheckedIn && !b.isCheckedOut && b.status !== 'Cancelled' && b.status !== 'No-Show';
              if (normalizedSubTab === 'checkout') return b.isCheckedIn || b.isCheckedOut;
              return true;
            });
            const fdTotal = subTabFiltered.length;
            const fdTotalPages = Math.max(1, Math.ceil(fdTotal / fdPageSize));
            const fdStartIndex = (fdPage - 1) * fdPageSize;
            const fdEndIndex = Math.min(fdStartIndex + fdPageSize, fdTotal);

            return (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    Showing <strong className="text-slate-800">{fdTotal === 0 ? 0 : fdStartIndex + 1}</strong> to{' '}
                    <strong className="text-slate-800">{fdEndIndex}</strong> of{' '}
                    <strong className="text-slate-800">{fdTotal}</strong> bookings
                  </span>
                  <div className="flex items-center gap-1.5 ml-0 sm:ml-4">
                    <span>Rows per page:</span>
                    <select
                      value={fdPageSize}
                      onChange={(e) => {
                        setFdPageSize(Number(e.target.value));
                        setFdPage(1);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFdPage((p) => Math.max(1, p - 1))}
                    disabled={fdPage <= 1}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1 ${
                      fdPage <= 1
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                    }`}
                  >
                    Previous
                  </button>

                  {Array.from({ length: fdTotalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === fdTotalPages || Math.abs(p - fdPage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const isCurrent = p === fdPage;
                      return (
                        <React.Fragment key={p}>
                          {prev && p - prev > 1 && <span className="px-1 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setFdPage(p)}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition ${
                              isCurrent
                                ? 'bg-[#C49A3A] text-white shadow-2xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    type="button"
                    onClick={() => setFdPage((p) => Math.min(fdTotalPages, p + 1))}
                    disabled={fdPage >= fdTotalPages}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1 ${
                      fdPage >= fdTotalPages
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* STEP 1 & WALK-IN: FULL CREATE / EDIT BOOKING PAGE (Exact Day Name, Open Stay 12 PM, 5% GST, No Overlap) */}
      {(normalizedSubTab === 'reservations' || normalizedSubTab === 'walkin') && (
        <form id="frontdesk-booking-form" onSubmit={handleSaveBookingSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Customer Details + Occupants + Requirements & Room Assignment Chips */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    {editingId
                      ? 'Modify Existing Reservation'
                      : normalizedSubTab === 'walkin'
                      ? 'Instant Walk-In Check-In Builder'
                      : 'Advance Reservation & Room Allocation'}
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {editingId
                      ? 'Update Booking & Room Allocation'
                      : normalizedSubTab === 'walkin'
                      ? 'Create Walk-In Booking (Instant Check-In)'
                      : 'Create Advance Booking & Assign Rooms'}
                  </h2>
                </div>

                {/* Advance vs Walk-In Switcher + Personal / Corporate Toggle + 5% GST Invoice Selector */}
                <div className="flex flex-wrap items-center gap-3">
                  {!editingId && (
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => onSubTabChange('reservations')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          normalizedSubTab === 'reservations'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Advance Booking
                      </button>
                      <button
                        type="button"
                        onClick={() => onSubTabChange('walkin')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          normalizedSubTab === 'walkin'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Walk-In Booking
                      </button>
                    </div>
                  )}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                    {(['Personal', 'Corporate'] as const).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setBookingType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          bookingType === type
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gstInvoice}
                      onChange={(e) => setGstInvoice(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span className="text-xs font-extrabold text-slate-900">
                      GST Invoice ({gstInvoice ? `${configuredRoomGst}%` : '0% No GST'})
                    </span>
                  </label>
                </div>
              </div>

              {/* Stay Dates (with Exact Day Badge) & Open Stay 12:00 PM Toggle */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase text-slate-500">
                        Check-In Date
                      </label>
                      {checkInDayName && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                          {checkInDayName}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCheckInDate(val);
                        if (val >= checkOutDate) {
                          const d = new Date(`${val}T00:00:00`);
                          d.setDate(d.getDate() + 1);
                          setCheckOutDate(d.toISOString().slice(0, 10));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase text-slate-500">
                        Check-Out Date
                      </label>
                      {!isOpenStay && checkOutDayName && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-extrabold">
                          {checkOutDayName}
                        </span>
                      )}
                    </div>
                    {isOpenStay ? (
                      <div className="w-full px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Open (12 PM Auto)</span>
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={checkOutDate}
                        min={checkInDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Stay Duration
                    </label>
                    <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-extrabold text-amber-900">
                      {nights} {nights === 1 ? 'Night' : 'Nights'} {isOpenStay ? '(Open)' : ''}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      No. of Guests (Persons)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={numGuests}
                      onChange={(e) => setNumGuests(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Extra Bed / Extra Person Charge Live Control */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 items-center">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                      Extra Beds / Extra Persons
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={extraBeds}
                      onChange={(e) => setExtraBeds(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                      Extra Bed / Person Rate (₹ / Night)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={extraPersonRate}
                      onChange={(e) => setExtraPersonRate(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div className="text-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Base Occupancy: {totalBaseOccupancy} Guests ({totalRoomsCount} Rm)
                    </div>
                    {extraPaxCount > 0 ? (
                      <div className="font-extrabold text-amber-900 mt-0.5">
                        + {formatCurrency(extraPaxSubtotal)} added ({extraPaxCount} Extra × {formatCurrency(extraPaxRatePerNight)}/N)
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Increase Guests (&gt;{totalBaseOccupancy}) or Extra Beds to auto-add tariff
                      </div>
                    )}
                  </div>
                </div>

                {/* Open Check-Out Date (12:00 PM Every Morning Rule) Checkbox */}
                <label className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isOpenStay}
                      onChange={(e) => setIsOpenStay(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-slate-900">
                        Open Check-Out Date (Guest Check-In Without Fixed Departure Date)
                      </span>
                      <p className="text-[11px] text-slate-600">
                        Automatically triggers a daily prompt every morning at <strong>12:00 PM</strong>:{' '}
                        <span className="text-emerald-700 font-bold">Continue Stay (+1 Day)</span> or{' '}
                        <span className="text-rose-600 font-bold">Checkout</span>
                      </p>
                    </div>
                  </div>
                  <span
                    style={{ backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#F59E0B' }}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold"
                  >
                    12:00 PM Daily Rule
                  </span>
                </label>
              </div>

              {/* Corporate Details if Corporate */}
              {bookingType === 'Corporate' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-indigo-50/60 border border-indigo-200">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-indigo-800 mb-1">
                      Company / Organization Name
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. TechVista Solutions Pvt Ltd"
                      className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-indigo-800 mb-1">
                      Company GSTIN Number
                    </label>
                    <input
                      type="text"
                      value={companyGst}
                      onChange={(e) => setCompanyGst(e.target.value)}
                      placeholder="e.g. 08AABCT3518Q1ZV"
                      className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-semibold uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Primary Guest Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter 10-digit mobile (e.g. 9829011223)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Primary Guest Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma / Jay Thakur"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    City / Billing Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Jaipur, Rajasthan"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Primary Guest Identity Document (Aadhaar / Passport / Govt ID Upload) */}
              <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#E2D6BE] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#263449] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Primary Guest Identity Document (Aadhaar / Passport / Govt ID)
                  </span>
                  {primaryDocImage && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ID Document Scan Attached
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      ID Proof Type
                    </label>
                    <select
                      value={primaryDocType}
                      onChange={(e) =>
                        setPrimaryDocType(e.target.value as GuestPerson['documentType'])
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                    >
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Pan Card">Pan Card</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter Id Card">Voter Id Card</option>
                      <option value="Visa">Visa</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      ID / Aadhaar / Passport Number
                    </label>
                    <input
                      type="text"
                      value={primaryDocNumber}
                      onChange={(e) => setPrimaryDocNumber(e.target.value)}
                      placeholder="e.g. 4829 7731 9012"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-3 pt-4">
                    <label
                      style={{ backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#F59E0B' }}
                      className="w-full py-2 px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                      <span>{primaryDocImage ? 'Change ID Scan' : 'Upload ID Scan'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setPrimaryDocImage(reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {primaryDocImage && (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="flex items-center gap-3">
                      <img
                        src={primaryDocImage}
                        alt="Primary Guest ID"
                        className="w-24 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                      <div className="text-xs">
                        <div className="font-bold text-slate-900">
                          {primaryDocType} {primaryDocNumber ? `— ${primaryDocNumber}` : ''}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          ✓ Linked to Guest Profile, Check-In GRC & Guest IDs Archive
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrimaryDocImage(undefined)}
                      className="text-xs text-rose-600 hover:underline font-bold cursor-pointer px-2"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Additional Occupants (Carried forward to Check-In & Police C-Form) */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    Additional Occupants ({additionalOccupants.length}) — Auto-Carries to Check-In
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAdditionalOccupants((prev) => [
                        ...prev,
                        {
                          id: `occ-${Date.now()}`,
                          name: '',
                          age: 26,
                          gender: 'Female',
                          idNumber: '',
                          docType: 'Aadhaar Card',
                        },
                      ])
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                  >
                    + Add Co-Occupant
                  </button>
                </div>

                {additionalOccupants.map((occ, idx) => (
                  <div
                    key={occ.id}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <input
                      type="text"
                      value={occ.name}
                      onChange={(e) =>
                        setAdditionalOccupants((prev) =>
                          prev.map((o) => (o.id === occ.id ? { ...o, name: e.target.value } : o))
                        )
                      }
                      placeholder={`Co-Guest #${idx + 2} Name`}
                      className="col-span-3 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                    />
                    <input
                      type="number"
                      value={occ.age}
                      onChange={(e) =>
                        setAdditionalOccupants((prev) =>
                          prev.map((o) =>
                            o.id === occ.id ? { ...o, age: Number(e.target.value) } : o
                          )
                        )
                      }
                      placeholder="Age"
                      className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                    />
                    <select
                      value={occ.gender}
                      onChange={(e) =>
                        setAdditionalOccupants((prev) =>
                          prev.map((o) =>
                            o.id === occ.id ? { ...o, gender: e.target.value as any } : o
                          )
                        )
                      }
                      className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                    <input
                      type="text"
                      value={occ.idNumber}
                      onChange={(e) =>
                        setAdditionalOccupants((prev) =>
                          prev.map((o) =>
                            o.id === occ.id ? { ...o, idNumber: e.target.value } : o
                          )
                        )
                      }
                      placeholder="Aadhaar / ID No."
                      className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                    <label className="col-span-2 px-2 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3 shrink-0" />
                      <span>{occ.docImage ? 'ID Added ✓' : 'Upload ID'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              const imgData = reader.result;
                              setAdditionalOccupants((prev) =>
                                prev.map((o) =>
                                  o.id === occ.id ? { ...o, docImage: imgData } : o
                                )
                              );
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalOccupants((prev) => prev.filter((o) => o.id !== occ.id))
                      }
                      className="col-span-1 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Booked Requirements & Non-Overlapping Room Assignment Chips */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Booked Requirements & Overlap-Protected Room Assignment Chips
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rooms with overlapping dates ({checkInDate} to {checkOutDate}) are automatically locked to prevent double-booking
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCategoryRow}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Category Row
                </button>
              </div>

              <div className="space-y-4">
                {requirements.map((req, idx) => {
                  const categoryRooms = rooms.filter((r) => r.category === req.categoryName);

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Asset Category #{idx + 1}
                          </label>
                          <select
                            value={req.categoryName}
                            onChange={(e) => {
                              const newCat = e.target.value;
                              const newPrice = getPlanRate(newCat, req.planName);
                              const usedOthers = new Set(
                                requirements
                                  .filter((r) => r.id !== req.id)
                                  .flatMap((r) => r.assignedRooms)
                              );
                              const firstAvail = rooms.find(
                                (rm) =>
                                  rm.category === newCat &&
                                  rm.status === 'Available' &&
                                  !usedOthers.has(rm.number) &&
                                  !findOverlappingBookingForRoom(rm.number)
                              );
                              setRequirements((prev) =>
                                prev.map((r) =>
                                  r.id === req.id
                                    ? {
                                        ...r,
                                        categoryName: newCat,
                                        unitPrice: newPrice,
                                        assignedRooms: firstAvail ? [firstAvail.number] : [],
                                        qty: 1,
                                      }
                                    : r
                                )
                              );
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                          >
                            {assetGroups.map((g) => (
                              <option key={g.id} value={g.name}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Rate Plan Type
                          </label>
                          <select
                            value={req.planName}
                            onChange={(e) => {
                              const newPlan = e.target.value as MealPlanType;
                              const newPrice = getPlanRate(req.categoryName, newPlan);
                              setRequirements((prev) =>
                                prev.map((r) =>
                                  r.id === req.id
                                    ? { ...r, planName: newPlan, unitPrice: newPrice }
                                    : r
                                )
                              );
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                          >
                            <option value="Only Rooms">Only Rooms</option>
                            <option value="Meals Included">Meals Included</option>
                            <option value="EP(SG)">EP(SG)</option>
                            <option value="CP (With Breakfast)">CP (With Breakfast)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Room Qty
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={req.qty}
                            onChange={(e) => {
                              const nextQty = Math.max(1, Number(e.target.value));
                              const usedOthers = new Set(
                                requirements
                                  .filter((r) => r.id !== req.id)
                                  .flatMap((r) => r.assignedRooms)
                              );
                              const availForCat = rooms
                                .filter(
                                  (rm) =>
                                    rm.category === req.categoryName &&
                                    rm.status === 'Available' &&
                                    !usedOthers.has(rm.number) &&
                                    !findOverlappingBookingForRoom(rm.number)
                                )
                                .slice(0, nextQty)
                                .map((rm) => rm.number);
                              setRequirements((prev) =>
                                prev.map((r) =>
                                  r.id === req.id
                                    ? {
                                        ...r,
                                        qty: availForCat.length > 0 ? availForCat.length : nextQty,
                                        assignedRooms:
                                          availForCat.length > 0 ? availForCat : r.assignedRooms.slice(0, nextQty),
                                      }
                                    : r
                                )
                              );
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                          />
                        </div>

                        <div className="sm:col-span-2 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">
                              Tariff/N
                            </div>
                            <div className="text-xs font-extrabold text-slate-900">
                              {formatCurrency(req.unitPrice)}
                            </div>
                          </div>
                          {requirements.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setRequirements((prev) => prev.filter((r) => r.id !== req.id))
                              }
                              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Room Assignment Chips with Overlap Prevention */}
                      <div>
                        <div className="text-[11px] font-bold text-slate-600 mb-2 flex flex-wrap items-center justify-between gap-1">
                          <span>
                            Click Available Room Chips to Assign ({req.assignedRooms.length} selected):
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Date-overlapping or Dirty/Blocked rooms are locked automatically
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {categoryRooms.map((room) => {
                            const isSelected = req.assignedRooms.includes(room.number);
                            const overlappingBkg = findOverlappingBookingForRoom(room.number);
                            const isOtherBooking = !isSelected && Boolean(overlappingBkg);
                            const isBlocked = room.status === 'Out of Service';
                            const isDirty = room.status === 'Dirty';

                            return (
                              <button
                                type="button"
                                key={room.id}
                                disabled={isOtherBooking || isBlocked}
                                onClick={() => handleToggleRoomChip(req.id, room.number)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-sm cursor-pointer'
                                    : isOtherBooking
                                    ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
                                    : isBlocked
                                    ? 'bg-rose-50 text-rose-400 border-rose-200 cursor-not-allowed'
                                    : isDirty
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500 cursor-pointer'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-amber-500 cursor-pointer'
                                }`}
                              >
                                <BedDouble className="w-3.5 h-3.5" />
                                <span>{room.name}</span>
                                {isOtherBooking && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-300 text-slate-700 text-[9px]">
                                    Overlap ({overlappingBkg?.customerName.split(' ')[0]})
                                  </span>
                                )}
                                {isDirty && !isSelected && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px]">
                                    Dirty
                                  </span>
                                )}
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Billing Summary, 5% GST, Discount, Source & Advance Settlement */}
          <div className="space-y-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 sticky top-20">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                Booking Source, 5% GST & Advance Deposit
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Booking Source
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as BookingSource)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="WALK-IN">WALK-IN</option>
                    <option value="Website">Direct Website</option>
                    <option value="MakeMyTrip">MakeMyTrip</option>
                    <option value="Booking.com">Booking.com</option>
                    <option value="Goibibo">Goibibo</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Expected Arrival
                  </label>
                  <input
                    type="text"
                    value={expectedArrivalTime}
                    onChange={(e) => setExpectedArrivalTime(e.target.value)}
                    placeholder="e.g. 12:00 PM"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Discount Input (₹ or %) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Apply Special Discount</span>
                  <div className="flex rounded-lg overflow-hidden border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setDiscountType('flat')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold cursor-pointer ${
                        discountType === 'flat'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600'
                      }`}
                    >
                      ₹ Flat
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold cursor-pointer ${
                        discountType === 'percent'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600'
                      }`}
                    >
                      % Off
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                  placeholder={discountType === 'flat' ? 'Discount in ₹' : 'Discount %'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                />
              </div>

              {/* Advance Collection (Automatically Carried Forward to Check-In & Checkout) */}
              {!editingId && (
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">
                      Advance Payment at Booking
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">
                      Auto-Deducted at Checkout
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(Math.max(0, Number(e.target.value)))}
                      placeholder="₹ Advance"
                      className="px-3 py-2 rounded-xl border border-emerald-200 bg-white text-xs font-bold"
                    />
                    <select
                      value={advanceMethod}
                      onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)}
                      className="px-2.5 py-2 rounded-xl border border-emerald-200 bg-white text-xs font-bold"
                    >
                      <option value="UPI">UPI QR</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card POS</option>
                      <option value="Bank Transfer">NEFT / Bank</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Totals Breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    Room Tariff ({nights} {nights === 1 ? 'Night' : 'Nights'})
                  </span>
                  <span className="font-bold text-slate-900">{formatCurrency(baseRoomTariffSubtotal)}</span>
                </div>
                {extraPaxCount > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>
                      Extra Pax ({extraPaxCount} Pax × {formatCurrency(extraPaxRatePerNight)} × {nights}N)
                    </span>
                    <span className="font-bold">+ {formatCurrency(extraPaxSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-700">
                  <span>Discount Applied</span>
                  <span className="font-bold">- {formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    GST (
                    {gstInvoice
                      ? taxRate === configuredRoomGst
                        ? `${taxRate}% (${taxSettings.roomCgst}% CGST + ${taxSettings.roomSgst}% SGST)`
                        : `${taxRate}% (${taxRate / 2}% CGST + ${taxRate / 2}% SGST)`
                      : 'Exempt 0%'}
                    )
                  </span>
                  <span className="font-bold text-slate-900">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Payable</span>
                  <span className="text-amber-600">{formatCurrency(totalPayable)}</span>
                </div>
                {!editingId && (
                  <>
                    <div className="flex justify-between text-xs font-bold text-emerald-700">
                      <span>Less: Advance Paid Now</span>
                      <span>- {formatCurrency(advancePaid)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-extrabold text-rose-600">
                      <span>Balance Due on Bill</span>
                      <span>{formatCurrency(Math.max(0, totalPayable - advancePaid))}</span>
                    </div>
                  </>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-md transition cursor-pointer"
              >
                {editingId
                  ? 'Save & Update Reservation'
                  : normalizedSubTab === 'walkin'
                  ? 'Confirm Walk-In & Check-In Now'
                  : 'Confirm & Create Advance Booking'}
              </button>

              {normalizedSubTab === 'reservations' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingId) {
                        const target = bookings.find((b) => b.id === editingId);
                        if (target) {
                          onOpenCheckIn(target);
                          return;
                        }
                      }
                      onSubTabChange('walkin');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" />
                    <span>Check-In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = editingId
                        ? bookings.find((b) => b.id === editingId)
                        : bookings.find(
                            (b) => !b.isCheckedIn && b.status !== 'Cancelled' && b.status !== 'No-Show'
                          );
                      if (target) {
                        setCancelModalBooking(target);
                        setCancelMode('Cancelled');
                        setCancelRefundAmt(target.amountPaid);
                        setCancelReason('Guest cancelled advance reservation');
                      } else {
                        setCustomerName('');
                        setMobile('');
                        setEmail('');
                        setAddress('');
                        setAdvancePaid(0);
                      }
                    }}
                    className="py-2.5 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Cancel Booking</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB: 7-DAY ROOM TAPE CALENDAR */}
      {normalizedSubTab === 'calendar' && (() => {
        const tapeDays = Array.from({ length: 7 }, (_, idx) => {
          const d = new Date();
          d.setDate(d.getDate() + idx);
          const iso = d.toISOString().slice(0, 10);
          const label = d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            weekday: 'short',
          });
          return { iso, label };
        });
        return (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  7-Day Interactive Room Tape Chart (Overlap-Protected)
                </h3>
                <p className="text-xs text-slate-500">
                  Visual room allocation matrix across {tapeDays[0].label} – {tapeDays[6].label}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Occupied
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-indigo-500 inline-block" /> Confirmed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />{' '}
                  Available
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-3 text-left rounded-tl-xl">Room Asset</th>
                    <th className="p-3 text-left">Category</th>
                    {tapeDays.map((d) => (
                      <th key={d.iso} className="p-3 text-center border-l border-slate-800">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{room.name}</td>
                      <td className="p-3 text-slate-500">{room.category}</td>
                      {tapeDays.map((d) => {
                        const bkg = bookings.find(
                          (b) =>
                            b.roomNumbers.includes(room.number) &&
                            b.status !== 'Cancelled' &&
                            b.status !== 'No-Show' &&
                            d.iso >= b.checkInDate &&
                            d.iso < b.checkOutDate
                        );
                        return (
                          <td key={d.iso} className="p-2 border-l border-slate-100 text-center">
                            {bkg ? (
                              <div
                                onClick={() => onSelectBooking(bkg)}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer truncate ${
                                  bkg.isCheckedIn
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                }`}
                              >
                                {bkg.customerName}
                              </div>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold">
                                ₹{room.rate}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* SUB-TAB: ADDITIONAL SERVICES & WATER BOTTLE LOGS */}
      {normalizedSubTab === 'services' && (() => {
        const selectedRoomObj = rooms.find((r) => r.number === waterRoom);
        const activeRoomBooking =
          bookings.find(
            (b) =>
              b.roomNumbers.includes(waterRoom) &&
              b.isCheckedIn &&
              !b.isCheckedOut &&
              b.status !== 'Cancelled' &&
              b.status !== 'No-Show'
          ) ||
          bookings.find(
            (b) =>
              b.roomNumbers.includes(waterRoom) &&
              !b.isCheckedOut &&
              b.status !== 'Cancelled' &&
              b.status !== 'No-Show'
          );

        const totalBottlesSafe = Math.max(1, Math.floor(Number(waterTotalBottles) || 0));
        const freeBottlesSafe = Math.max(0, Math.floor(Number(waterFreeBottles) || 0));
        const chargeableBottles = Math.max(0, totalBottlesSafe - freeBottlesSafe);
        const rateSafe = Math.max(0, r2(waterRatePerBottle));
        const calculatedWaterTotal = r2(chargeableBottles * rateSafe);

        // Room-Wise Water Summary
        const roomWaterMap = new Map<
          string,
          { roomNumber: string; guestName: string; totalQty: number; freeQty: number; chargeableQty: number; totalAmt: number }
        >();
        waterLogs.forEach((log) => {
          const rn = String(log.roomNumber || '');
          const cur = roomWaterMap.get(rn) || {
            roomNumber: rn,
            guestName: log.guestName || 'Guest',
            totalQty: 0,
            freeQty: 0,
            chargeableQty: 0,
            totalAmt: 0,
          };
          const qty = Number(log.qty) || 0;
          const chgQty =
            log.extraChargeableCount !== undefined
              ? Number(log.extraChargeableCount)
              : log.isChargeable
              ? qty
              : 0;
          const compQty =
            log.complimentaryCount !== undefined
              ? Number(log.complimentaryCount)
              : Math.max(0, qty - chgQty);
          cur.totalQty += qty;
          cur.freeQty += compQty;
          cur.chargeableQty += chgQty;
          cur.totalAmt = r2(cur.totalAmt + (Number(log.amount) || 0));
          roomWaterMap.set(rn, cur);
        });
        const roomWaterSummaries = Array.from(roomWaterMap.values());

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-600" />
                  Log Mineral Water Delivery
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Auto-calculates chargeable bottles (Total − Free) × ₹Rate and syncs to Room Folio.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Select Room</label>
                  <select
                    value={waterRoom}
                    onChange={(e) => setWaterRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    {rooms.map((r) => {
                      const occBkg = bookings.find(
                        (b) => b.roomNumbers.includes(r.number) && b.isCheckedIn && !b.isCheckedOut
                      );
                      const labelGuest = occBkg?.customerName || r.currentGuestName || r.status;
                      return (
                        <option key={r.id} value={r.number}>
                          Room {r.number} — {labelGuest}
                        </option>
                      );
                    })}
                  </select>
                  {activeRoomBooking && (
                    <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                      ✓ Occupied by {activeRoomBooking.customerName} (#{String(activeRoomBooking.bookingNo).replace(/^#/, '')})
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      Total Bottles Given
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={waterTotalBottles}
                      onChange={(e) => setWaterTotalBottles(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      Complimentary (Free)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={totalBottlesSafe}
                      value={waterFreeBottles}
                      onChange={(e) => setWaterFreeBottles(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      Chargeable Bottles
                    </label>
                    <div className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-extrabold text-slate-900">
                      {chargeableBottles} Bottle{chargeableBottles === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      Rate per Bottle (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={waterRatePerBottle}
                      onChange={(e) => setWaterRatePerBottle(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Live Calculation Display */}
                <div
                  className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between ${
                    chargeableBottles > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-950'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <span>
                    {chargeableBottles > 0
                      ? `Chargeable: ${chargeableBottles} Bottles × ₹${rateSafe}`
                      : 'All Bottles Complimentary'}
                  </span>
                  <span className="font-mono text-sm font-extrabold">
                    {chargeableBottles > 0 ? `= ₹${calculatedWaterTotal}` : '₹0 (Complimentary)'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nowIso = new Date().toISOString().slice(0, 10);
                    const nowDateTime = new Date().toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const guestName =
                      activeRoomBooking?.customerName ||
                      selectedRoomObj?.currentGuestName ||
                      'In-House Guest';

                    onAddWaterLog({
                      date: nowIso,
                      dateTime: nowDateTime,
                      roomNumber: waterRoom,
                      bookingId: activeRoomBooking?.id,
                      checkInId: activeRoomBooking?.id,
                      guestName,
                      qty: totalBottlesSafe,
                      complimentaryCount: Math.min(totalBottlesSafe, freeBottlesSafe),
                      extraChargeableCount: chargeableBottles,
                      ratePerBottle: rateSafe,
                      isChargeable: chargeableBottles > 0,
                      amount: calculatedWaterTotal,
                      deliveredBy: loggedInUser || 'Front Desk',
                    });

                    setLifecycleBanner(
                      `Water delivery logged for Room ${waterRoom} (${guestName}): ${totalBottlesSafe} given (${Math.min(
                        totalBottlesSafe,
                        freeBottlesSafe
                      )} free, ${chargeableBottles} chargeable = ₹${calculatedWaterTotal}).`
                    );
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold cursor-pointer shadow-xs"
                >
                  + Record Water Delivery
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4 min-w-0">
              {/* Room-Wise Water Summary */}
              {roomWaterSummaries.length > 0 && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Room-Wise Water Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {roomWaterSummaries.map((rs) => (
                      <div
                        key={rs.roomNumber}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-slate-900">
                            Room {rs.roomNumber} • {rs.guestName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Total: <strong>{rs.totalQty}</strong> ({rs.freeQty} Free •{' '}
                            <strong className="text-amber-800">{rs.chargeableQty} Chargeable</strong>)
                          </div>
                        </div>
                        <div className="font-mono font-extrabold text-sm text-slate-900">
                          {formatCurrency(rs.totalAmt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Water Bottle Log Table */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm min-w-0 overflow-hidden">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Water Bottle & Room Amenity Logs ({waterLogs.length})
                </h3>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Room</th>
                        <th className="py-2.5 px-3">Guest Name</th>
                        <th className="py-2.5 px-3">Bottles (Total / Free / Paid)</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Supplied By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {waterLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No water bottle deliveries recorded yet.
                          </td>
                        </tr>
                      ) : (
                        waterLogs.map((log) => {
                          const totalB = Number(log.qty) || 0;
                          const chgB =
                            log.extraChargeableCount !== undefined
                              ? Number(log.extraChargeableCount)
                              : log.isChargeable
                              ? totalB
                              : 0;
                          const freeB =
                            log.complimentaryCount !== undefined
                              ? Number(log.complimentaryCount)
                              : Math.max(0, totalB - chgB);
                          return (
                            <tr key={log.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                {log.dateTime || log.date}
                              </td>
                              <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                                Room {log.roomNumber}
                              </td>
                              <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                                {log.guestName}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="font-bold text-slate-900">{totalB} Total</span>
                                <span className="text-[11px] text-slate-500 ml-1">
                                  ({freeB} Free • {chgB} Paid
                                  {log.ratePerBottle && chgB > 0 ? ` @ ₹${log.ratePerBottle}` : ''})
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    log.isChargeable
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {log.isChargeable ? 'Chargeable' : 'Complimentary'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                                {formatCurrency(log.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                {log.deliveredBy}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUB-TAB: GUEST ID DOCUMENTS & FRRO C-FORM ARCHIVE */}
      {normalizedSubTab === 'documents' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Guest Document & Identity Archival Center
              </h3>
              <p className="text-xs text-slate-500">
                Search & inspect verified Aadhaar scans, Passport proofs, GRC identity records, and Tax Invoices.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['All', 'Aadhaar', 'Passport', 'PAN', 'Voter'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDocCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                      docCategory === cat
                        ? 'bg-[#17120F] text-[#E0BD6B]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Guest, Room, ID..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {filteredGuestsWithDocs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-xs font-bold text-slate-700">No guest identity documents found</div>
              <p className="text-[11px] text-slate-400">
                {docSearch ? `No records matching "${docSearch}" in category "${docCategory}".` : 'No verified guest identity cards registered yet.'}
              </p>
              {docSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setDocSearch('');
                    setDocCategory('All');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer inline-block"
                >
                  Clear Search Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGuestsWithDocs.map(({ guest, booking, roomDisplay }) => {
                const hasRealScan = Boolean(
                  guest.documentImageUrl && guest.documentImageUrl !== SAMPLE_AADHAAR_SVG_URL
                );
                const previewImg = guest.documentImageUrl || SAMPLE_AADHAAR_SVG_URL;
                return (
                  <div
                    key={`${booking.id}-${guest.id}`}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-amber-400 transition flex flex-col justify-between gap-3 bg-slate-50/60 shadow-2xs hover:shadow-md"
                  >
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {guest.name}
                            </span>
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] uppercase">
                              {guest.documentType}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] truncate mt-0.5">
                            Booking #{booking.bookingNo} • Room {roomDisplay}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            hasRealScan
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {hasRealScan ? '✓ Uploaded Scan' : 'Digital ID'}
                        </span>
                      </div>

                      {/* Live Visual Document Image Preview on Card */}
                      <div
                        onClick={() => onOpenPreviewDocument(guest, booking.bookingNo)}
                        className="w-full h-36 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-2 cursor-pointer group relative"
                        title="Click to inspect & zoom guest ID document"
                      >
                        <img
                          src={previewImg}
                          alt={`${guest.name} ${guest.documentType}`}
                          className="max-w-full max-h-full object-contain rounded group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="font-mono font-bold text-slate-700 text-[11px] bg-white px-2.5 py-1 rounded-lg border border-slate-200 truncate">
                          ID: {guest.documentNumber || 'Not Entered'}
                        </div>
                        <div className="text-[11px] text-slate-500 shrink-0">
                          +91 {guest.phone || booking.mobile}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                      {onUpdateGuestDoc && (
                        <label className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                          <Upload className="w-3.5 h-3.5 shrink-0" />
                          <span>{hasRealScan ? 'Replace Scan' : 'Upload Scan'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === 'string') {
                                  onUpdateGuestDoc(booking.bookingNo, guest.id, {
                                    documentImageUrl: reader.result,
                                  });
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenPreviewDocument(guest, booking.bookingNo)}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-[#E0BD6B] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        title="Open Document Preview & Zoom Inspector"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span>Inspect / Zoom</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 8: ALL 9 REQUIRED LIFECYCLE REPORTS */}
      {normalizedSubTab === 'reports' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Front Desk Lifecycle Reports
              </h3>
              <p className="text-xs text-slate-500">
                Switch between statutory & operational reports below
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100">
            {[
              { id: 'advance_res', label: 'Advance Reservations' },
              { id: 'arrivals_dep', label: 'Arrivals & Departures' },
              { id: 'inhouse', label: 'In-House Guests' },
              { id: 'noshow_cancel', label: 'No-Shows & Cancellations' },
              { id: 'advance_coll', label: 'Advance Collections' },
              { id: 'outstanding', label: 'Outstanding Payments' },
              { id: 'daily_co', label: 'Daily Checkouts' },
              { id: 'folios', label: 'Guest Folios' },
              { id: 'hk_pending', label: 'Housekeeping Pending' },
            ].map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() => setLifecycleReportType(rt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  lifecycleReportType === rt.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto w-full">
          {lifecycleReportType === 'hk_pending' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Task #</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Task Type</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks
                  .filter((t) => t.status !== 'Completed')
                  .map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 px-4 font-bold">{t.id}</td>
                      <td className="py-3 px-4 font-extrabold">{t.roomName}</td>
                      <td className="py-3 px-4">{t.taskType}</td>
                      <td className="py-3 px-4 font-semibold">{t.assignedTo}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-2">Booking #</th>
                  <th className="py-2.5 px-2">Guest Name</th>
                  <th className="py-2.5 px-2">Room</th>
                  <th className="py-2.5 px-2">Stay Dates</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Total (5% GST)</th>
                  <th className="py-2.5 px-2">Paid / Adv</th>
                  <th className="py-2.5 px-2">Refunded</th>
                  <th className="py-2.5 px-2 text-right">Due / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings
                  .filter((b) => {
                    if (lifecycleReportType === 'advance_res')
                      return !b.isCheckedIn && !b.isCheckedOut && b.status === 'Confirmed';
                    if (lifecycleReportType === 'inhouse')
                      return b.isCheckedIn && !b.isCheckedOut;
                    if (lifecycleReportType === 'noshow_cancel')
                      return b.status === 'Cancelled' || b.status === 'No-Show';
                    if (lifecycleReportType === 'advance_coll') return b.amountPaid > 0;
                    if (lifecycleReportType === 'outstanding') return b.dueAmount > 0;
                    if (lifecycleReportType === 'daily_co') return b.isCheckedOut;
                    return true;
                  })
                  .map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => onSelectBooking(b)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2.5 px-2 font-bold">#{b.bookingNo.replace(/^#/, '')}</td>
                      <td className="py-2.5 px-2 font-bold">{b.customerName}</td>
                      <td className="py-2.5 px-2 font-extrabold">Rm {b.roomNumbers.join(', ')}</td>
                      <td className="py-2.5 px-2">
                        <div>{formatDate(b.checkInDate)}</div>
                        <div className="text-[10px] text-slate-500">→ {formatDate(b.checkOutDate)}</div>
                      </td>
                      <td className="py-2.5 px-2 font-bold">{b.status}</td>
                      <td className="py-2.5 px-2 font-bold">{formatCurrency(b.totalPayable)}</td>
                      <td className="py-2.5 px-2 font-bold text-emerald-700">
                        {formatCurrency(b.amountPaid)}
                      </td>
                      <td className="py-2.5 px-2 font-extrabold text-purple-700">
                        {(b.refundAmount || 0) > 0 ? `↩ ${formatCurrency(b.refundAmount || 0)}` : '₹0'}
                      </td>
                      <td className="py-2.5 px-2 font-extrabold text-rose-600 text-right">
                        {b.status === 'Cancelled' || b.status === 'No-Show' ? (
                          <span className="text-[11px] font-semibold text-slate-600">
                            {b.cancellationReason || 'Cancelled'}
                          </span>
                        ) : (
                          formatCurrency(b.dueAmount)
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          </div>
        </div>
      )}

      {/* MODAL: IN-HOUSE ROOM CHANGE / SHIFT WITH AVAILABILITY VALIDATION */}
      {roomShiftModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-amber-400">
                  In-House Room Change / Shift Room
                </h3>
                <p className="text-[11px] text-slate-300">
                  {roomShiftModalBooking.customerName} • Current Room:{' '}
                  {roomShiftModalBooking.roomNumbers.join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomShiftModalBooking(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Available Clean Target Room *
                </label>
                <select
                  value={shiftTargetRoom}
                  onChange={(e) => setShiftTargetRoom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  {availableCleanRooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      {r.name} ({r.category} — ₹{r.rate}/N • Clean & Available)
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                Shifting the guest will mark old Room {roomShiftModalBooking.roomNumbers[0]} as{' '}
                <strong>Dirty</strong> for housekeeping and mark new Room {shiftTargetRoom} as{' '}
                <strong>Occupied</strong>.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoomShiftModalBooking(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onChangeRoom && shiftTargetRoom) {
                      onChangeRoom(
                        roomShiftModalBooking.id,
                        roomShiftModalBooking.roomNumbers[0],
                        shiftTargetRoom
                      );
                      setLifecycleBanner(
                        `Shifted ${roomShiftModalBooking.customerName} from Room ${roomShiftModalBooking.roomNumbers[0]} to Room ${shiftTargetRoom}.`
                      );
                    }
                    setRoomShiftModalBooking(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold cursor-pointer"
                >
                  Confirm Room Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL RESERVATION / MARK NO-SHOW & REFUND WORKFLOW */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/25 flex items-end justify-center pb-5 px-4">
          <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
            <div className="px-5 py-3.5 bg-[#FAF6EE] border-b border-[#DFC078] text-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                  ✓ Booking #{cancelModalBooking.bookingNo.replace(/^#/, '')} Confirmed
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {cancelMode === 'No-Show'
                      ? 'Mark Reservation as No-Show'
                      : 'Booking Confirmation, Edit, Cancellation & Authorized Refund Desk'}
                  </h3>
                  <p className="text-[11px] text-slate-600 font-semibold">
                    Guest: {cancelModalBooking.customerName} (+91 {cancelModalBooking.mobile}) • Room {cancelModalBooking.roomNumbers.join(', ')} ({cancelModalBooking.roomCategorySummary})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer text-sm font-bold px-2"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Package (5% GST)</span>
                  <strong className="text-sm text-slate-900 font-mono">
                    {formatCurrency(cancelModalBooking.totalPayable)}
                  </strong>
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    Advance Paid: {formatCurrency(cancelModalBooking.amountPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Authorized Refund to Guest</span>
                  <strong className="text-sm text-purple-800 font-mono">
                    {formatCurrency(cancelRefundAmt)}
                  </strong>
                  <span className="text-[10px] text-purple-600 font-semibold block">
                    Mode: {cancelRefundMethod} Refund
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Cancellation Fee / Retained</span>
                  <strong className="text-sm text-slate-900 font-mono">
                    {formatCurrency(Math.max(0, cancelModalBooking.amountPaid - cancelRefundAmt))}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    Auto-updates Folio & Room Rack
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Authorized Refund Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={cancelModalBooking.amountPaid}
                    value={cancelRefundAmt}
                    onChange={(e) => setCancelRefundAmt(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Refund Payment Mode
                  </label>
                  <select
                    value={cancelRefundMethod}
                    onChange={(e) => setCancelRefundMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="UPI">UPI Refund</option>
                    <option value="Cash">Cash Counter Refund</option>
                    <option value="Bank Transfer">Bank / NEFT Refund</option>
                    <option value="Card">Card Reversal</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Refund UTR / Voucher Ref
                  </label>
                  <input
                    type="text"
                    value={cancelRefundRef}
                    onChange={(e) => setCancelRefundRef(e.target.value)}
                    placeholder="UTR-99887766"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cancellation / Refund Authorization Reason
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const bk = cancelModalBooking;
                    setCancelModalBooking(null);
                    setEditingId(bk.id);
                    setCustomerName(bk.customerName);
                    setMobile(bk.mobile);
                    setEmail(bk.email);
                    setAddress(bk.address);
                    setCheckInDate(bk.checkInDate);
                    setCheckOutDate(bk.checkOutDate);
                    onSubTabChange('reservations');
                    setTimeout(() => {
                      document.getElementById('frontdesk-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 80);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Reservation Instead</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCancelModalBooking(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onCancelOrNoShowBooking) {
                        const detailedReason =
                          cancelRefundAmt > 0
                            ? `${cancelReason} [Refunded ₹${cancelRefundAmt} via ${cancelRefundMethod}${
                                cancelRefundRef ? ` • Ref: ${cancelRefundRef}` : ''
                              }]`
                            : cancelReason;
                        onCancelOrNoShowBooking(
                          cancelModalBooking.id,
                          cancelMode,
                          cancelRefundAmt,
                          detailedReason
                        );
                        setLifecycleBanner(
                          `Booking ${cancelModalBooking.bookingNo} marked ${cancelMode}. ${
                            cancelRefundAmt > 0
                              ? `Refund of ₹${cancelRefundAmt} (${cancelRefundMethod}) recorded in Folio, Reports & Finance Vouchers.`
                              : 'Room released to Available.'
                          }`
                        );
                      }
                      setCancelRefundRef('');
                      setCancelModalBooking(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold cursor-pointer shadow-sm"
                  >
                    Confirm {cancelMode} & Authorize Refund ({formatCurrency(cancelRefundAmt)})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
