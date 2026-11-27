import React, { useEffect, useRef, useState } from 'react';
import { CascadeDeleteTarget } from '../utils/guestCascadeDelete';
import { Package } from 'lucide-react';
import QuickAddBookingModal from './components/QuickAddBookingModal';
import BookingDetailsDrawer from './components/BookingDetailsDrawer';
import QuickCheckInModal from './components/QuickCheckInModal';
import GuestDocumentPreviewModal from './components/GuestDocumentPreviewModal';
import RecordPaymentDrawer from './components/RecordPaymentDrawer';
import InvoicePreviewModal from './components/InvoicePreviewModal';
import RoomTasksDrawer from './components/RoomTasksDrawer';
import AddRoomOrderModal from './components/AddRoomOrderModal';
import CheckoutClearanceModal from './components/CheckoutClearanceModal';
import EditInvoiceModal from './components/EditInvoiceModal';

import { DashboardModule, normalizeCategory } from './modules/DashboardModule';
import { FrontDeskModule } from './modules/FrontDeskModule';
import { InvoiceModule } from './modules/InvoiceModule';
import { RoomManagementModule } from './modules/RoomManagementModule';
import { HousekeepingModule, RoomHousekeepingPatch } from './modules/HousekeepingModule';
import { PosModule } from './modules/PosModule';
import { InventoryModule } from './modules/InventoryModule';
import InventoryView from '../components/InventoryView';
import { OtaManagerModule } from './modules/OtaManagerModule';
import { FinanceModule } from './modules/FinanceModule';
import { ReportsModule } from './modules/ReportsModule';
import { StaffModule } from './modules/StaffModule';
import { AuditLogsModule } from './modules/AuditLogsModule';
import { PublicBookingModule } from './modules/PublicBookingModule';
import CalendarBookingView from '../components/CalendarBookingView';
import { openStandalonePosInNewTab } from '../utils/posConfigHelpers';
import { triggerBookingEmail, isValidEmailAddress } from '../utils/bookingEmailService';
import RoomManagementView from '../components/RoomManagementView';
import {
  useRbacMatrix,
  getRoleModulePermission,
  getAllowedSidebarTabsForRole,
  normalizeRbacRole,
  saveRbacMatrix,
} from './utils/rbacPermissions';

import { INITIAL_HOTEL_PROFILE } from './mock-data/initialData';

import {
  AssetGroup,
  AuditLogEntry,
  BookedCategoryRequirement,
  BookingRecord,
  CashBankAccountRecord,
  DailyClosingEntry,
  FinanceExpenseRecord,
  FinanceVoucherRecord,
  GuestPerson,
  HousekeepingTask,
  InventoryItemRecord,
  InventoryPurchaseRecord,
  InventorySupplierRecord,
  InvoiceRecord,
  InvoiceScope,
  LaundryOrderRecord,
  LostFoundRecord,
  OtherServiceItem,
  OtaChannelRecord,
  OwnerPaymentRecord,
  PaymentMethod,
  PaymentRecordItem,
  PettyCashRecord,
  PosMenuItem,
  PosOrderRecord,
  PriceHistoryRecord,
  RoomAsset,
  RoomBlockRecord,
  StaffMemberRecord,
  StaffReimbursementRecord,
  StockMovementRecord,
  WaterBottleLogEntry,
  VendorBillRecord,
  MiscellaneousIncomeRecord,
  OtaSettlementRecord,
} from './types';

import { getHotelTaxSettings, useHotelTaxSettings } from './utils/taxSettings';
import {
  BillCharge,
  BillChargeKind,
  BillPayment,
  BillSettings,
  calculateBill,
  normalizeBillSettings,
  r2,
} from '../utils/billCalculator';
import {
  allocateInvoiceNumber,
  buildInvoiceRecord,
  buildStayBill,
  isActiveInvoice,
  reconcileScopedStayInvoice,
  requestAtomicGrcNumber,
  resolveConsistentInvoiceTotals,
  resolveInvoiceScope,
  toGrcPrintData,
} from '../utils/stayBilling';
import { renderGrcHtml } from '../utils/printTemplates';
import { openPrintWindow } from '../utils/printDocument';
import { showToast } from '../utils/toast';

import type {
  Room,
  Booking,
  GuestCheckIn,
  Invoice,
  Expense,
  Staff,
  AuditLog,
  WaterBottleRecord,
  PosItem,
  PosOrder,
  InventoryProduct,
  InventoryCategory,
  InventorySupplier,
  InventoryPurchase,
  InventoryStockMovement,
  PettyCashTransaction,
  CashBankAccount,
  FinanceVoucher,
  OwnerDirectorPayment,
  CashHandover,
  StaffReimbursement,
  DailyClosingRecord,
  LaundryOrder,
  LostAndFoundItem,
  HousekeepingCleaningLog,
  TravelAgent,
  AgentCommissionPayment,
  FoodAdvanceBooking,
  PosCategory,
  PosTableRecord,
  RolePermission,
} from '../types';

interface IntegratedAdminPmsHubProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  frontDeskSubTab: string;
  setFrontDeskSubTab: (sub: string) => void;
  financeSubTab: string;
  setFinanceSubTab: (sub: string) => void;
  roomSubTab?: string;
  setRoomSubTab?: (sub: string) => void;
  housekeepingSubTab?: string;
  setHousekeepingSubTab?: (sub: string) => void;
  posSubTab?: string;
  setPosSubTab?: (sub: string) => void;
  inventorySubTab?: string;
  setInventorySubTab?: (sub: string) => void;
  otaSubTab?: string;
  setOtaSubTab?: (sub: string) => void;
  reportsSubTab?: string;
  setReportsSubTab?: (sub: string) => void;
  staffSubTab?: string;
  setStaffSubTab?: (sub: string) => void;
  invoiceSubTab?: string;
  setInvoiceSubTab?: (sub: string) => void;
  selectedHotelId?: string;
  hotelName?: string;
  hotelAddress?: string;
  hotelGst?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  hotelSettings?: Record<string, any>;
  onUpdateHotelSettings?: (settings: any) => void;
  currentRole?: string;
  loggedInUser?: string;
  onAddAuditLog?: (action: string, details: string) => void;
  setSelectedBookingForCheckin?: (booking: Booking | null) => void;

  // Live Dynamic Database Props from App.tsx (MongoDB Atlas)
  appRooms?: Room[];
  appBookings?: Booking[];
  appCheckins?: GuestCheckIn[];
  appInvoices?: Invoice[];
  appExpenses?: Expense[];
  appStaff?: Staff[];
  appAuditLogs?: AuditLog[];
  appWaterBottles?: WaterBottleRecord[];
  appPosItems?: PosItem[];
  appPosOrders?: PosOrder[];
  appInventoryProducts?: InventoryProduct[];
  appInventoryCategories?: InventoryCategory[];
  appInventorySuppliers?: InventorySupplier[];
  appInventoryPurchases?: InventoryPurchase[];
  appInventoryStockMovements?: InventoryStockMovement[];
  appPettyCash?: PettyCashTransaction[];
  appCashBankAccounts?: CashBankAccount[];
  appVouchers?: FinanceVoucher[];
  appOwnerPayments?: OwnerDirectorPayment[];
  appHandovers?: CashHandover[];
  appReimbursements?: StaffReimbursement[];
  appDailyClosings?: DailyClosingRecord[];
  appLaundryOrders?: LaundryOrder[];
  appLostAndFoundItems?: LostAndFoundItem[];
  appCleaningLogs?: HousekeepingCleaningLog[];
  appTravelAgents?: TravelAgent[];
  appAgentCommissionPayments?: AgentCommissionPayment[];
  appPosAdvanceBookings?: FoodAdvanceBooking[];
  appPosCategories?: PosCategory[];
  appPosTables?: PosTableRecord[];
  appRolePermissions?: RolePermission[];

  onUpdateRooms?: (updated: Room[]) => void;
  onUpdateBookings?: (updated: Booking[]) => void;
  onUpdateCheckins?: (updated: GuestCheckIn[]) => void;
  onUpdateInvoices?: (updated: Invoice[]) => void;
  onUpdateExpenses?: (updated: Expense[]) => void;
  onUpdateStaff?: (updated: Staff[]) => void;
  onUpdateWaterBottles?: (updated: WaterBottleRecord[]) => void;
  onUpdatePosItems?: (updated: PosItem[]) => void;
  onUpdatePosOrders?: (updated: PosOrder[]) => void;
  onUpdateInventoryProducts?: (updated: InventoryProduct[]) => void;
  onUpdateInventoryCategories?: (updated: InventoryCategory[]) => void;
  onUpdateInventorySuppliers?: (updated: InventorySupplier[]) => void;
  onUpdateInventoryPurchases?: (updated: InventoryPurchase[]) => void;
  onUpdateInventoryMovements?: (updated: InventoryStockMovement[]) => void;
  onUpdatePettyCash?: (updated: PettyCashTransaction[]) => void;
  onUpdateCashBankAccounts?: (updated: CashBankAccount[]) => void;
  onUpdateVouchers?: (updated: FinanceVoucher[]) => void;
  onUpdateOwnerPayments?: (updated: OwnerDirectorPayment[]) => void;
  onUpdateReimbursements?: (updated: StaffReimbursement[]) => void;
  onUpdateDailyClosings?: (updated: DailyClosingRecord[]) => void;
  onUpdateLaundryOrders?: (updated: LaundryOrder[]) => void;
  onUpdateLostAndFoundItems?: (updated: LostAndFoundItem[]) => void;
  onUpdateCleaningLogs?: (updated: HousekeepingCleaningLog[]) => void;
  onUpdateTravelAgents?: (updated: TravelAgent[]) => void;
  onUpdateAgentCommissionPayments?: (updated: AgentCommissionPayment[]) => void;
  onUpdatePosAdvanceBookings?: (updated: FoodAdvanceBooking[]) => void;
  onUpdatePosCategories?: (updated: PosCategory[]) => void;
  onUpdatePosTables?: (updated: PosTableRecord[]) => void;
  onCascadeDeleteGuest?: (target: CascadeDeleteTarget) => void;
}

export function classifyExtraChargeServiceType(ec: {
  category?: string;
  sourceType?: string;
  description?: string;
  serviceType?: string;
}): OtherServiceItem['serviceType'] {
  const cat = String(ec.category || '').toLowerCase();
  const st = String(ec.sourceType || '').toLowerCase();
  const sv = String(ec.serviceType || '').toLowerCase();
  const desc = String(ec.description || '').toLowerCase();
  if (
    st === 'pos_order' ||
    cat === 'food' ||
    cat.includes('food') ||
    cat.includes('restaurant') ||
    cat.includes('kitchen') ||
    sv === 'pos_food' ||
    desc.startsWith('food bill')
  ) {
    return 'POS_FOOD';
  }
  if (st === 'water_bottle' || cat.includes('water') || desc.includes('water bottle')) {
    return 'WATER BOTTLE';
  }
  if (
    st === 'laundry' ||
    cat.includes('laundry') ||
    sv.includes('laundry') ||
    desc.includes('laundry') ||
    desc.includes('dry clean') ||
    /\biron(ing)?\b/.test(desc)
  ) {
    return 'LAUNDRY';
  }
  if (
    cat === 'damage' ||
    sv.includes('damage') ||
    sv.includes('fine') ||
    desc.includes('fine') ||
    desc.includes('damage')
  ) {
    return 'DAMAGE / FINE';
  }
  return 'SPA / OTHER';
}

/**
 * Pure runtime guard: returns the active finalized primary invoice for a booking if one exists.
 * Used to prevent unauthorized post-finalization mutations (BUG-P2-07).
 */
export function findActiveFinalizedInvoiceForBooking(
  bookingId: string,
  invoicesList: Array<Partial<Invoice & InvoiceRecord>>
): (Partial<Invoice & InvoiceRecord>) | undefined {
  return (invoicesList || []).find(
    (inv) =>
      inv &&
      !inv.isSuperseded &&
      !inv.isSeparateInvoice &&
      (inv.bookingId === bookingId || (inv as any).checkInId === bookingId || inv.bookingNo === bookingId) &&
      ((inv as any).isFinalInvoice === true || inv.invoiceStatus === 'Finalized')
  );
}

// Mappers from App.tsx MongoDB types -> IntegratedAdminPmsHub types
function mapAppRoomToAsset(r: Room, bookings: BookingRecord[]): RoomAsset {
  const todayStr = new Date().toISOString().split('T')[0];
  const checkedInBkg = bookings.find(
    (b) =>
      b.roomNumbers.includes(r.number) &&
      b.isCheckedIn &&
      !b.isCheckedOut &&
      b.status !== 'Checked Out' &&
      b.status !== 'Cancelled' &&
      b.status !== 'No-Show'
  );
  // Future advance bookings (checkInDate > todayStr) must NOT mark the room as Booked today on Live Room Rack
  const todayReservedBkg = !checkedInBkg
    ? bookings.find(
        (b) =>
          b.roomNumbers.includes(r.number) &&
          b.status !== 'Checked Out' &&
          b.status !== 'Cancelled' &&
          b.status !== 'No-Show' &&
          (!b.checkInDate || b.checkInDate <= todayStr) &&
          (!b.checkOutDate || b.checkOutDate >= todayStr)
      )
    : undefined;
  const activeBkg = checkedInBkg || todayReservedBkg;
  const normalizedCleanSt: RoomAsset['cleaningStatus'] =
    r.cleaningStatus === 'In Progress'
      ? 'In Progress'
      : r.cleaningStatus === 'Inspection' || r.cleaningStatus === 'Needs Inspection'
      ? 'Inspection'
      : r.cleaningStatus === 'Dirty' || r.status === 'Dirty'
      ? 'Dirty'
      : 'Clean';

  let status: RoomAsset['status'] = 'Available';
  if (activeBkg?.isCheckedIn) status = 'Occupied';
  else if (activeBkg) status = 'Confirmed';
  else if (
    r.status === 'Maintenance' ||
    r.status === 'Out of Order' ||
    r.status === 'Out of Service' ||
    r.status === 'Blocked'
  ) {
    status = 'Out of Service';
  } else if (normalizedCleanSt !== 'Clean') {
    status = 'Dirty';
  }

  return {
    id: r.id,
    number: r.number,
    name: `Room ${r.number}`,
    groupId: `grp-${(r.category || 'standard').toLowerCase().replace(/\s+/g, '-')}`,
    category: normalizeCategory(r.category) || 'Standard',
    rate: Number(r.rate) || 2000,
    mealsRate: (Number(r.rate) || 2000) + 500,
    status,
    cleaningStatus: normalizedCleanSt,
    floor: r.floor || '1st Floor',
    bedType: r.bedType || 'King Bed',
    maxOccupancy: r.maxOccupancy ?? 3,
    baseOccupancy: r.baseOccupancy ?? 2,
    extraPersonCharge: Number(r.extraPersonCharge) > 0 ? Number(r.extraPersonCharge) : 500,
    isLive: true,
    amenities: Array.isArray(r.amenities) && r.amenities.length > 0 ? r.amenities : ['AC', 'Wi-Fi', 'TV'],
    images: Array.isArray(r.images) ? r.images : undefined,
    currentBookingId: activeBkg?.id,
    currentGuestName: activeBkg?.customerName,
    currentNights: activeBkg?.nights,
    blockedReason: r.outOfOrderReason,
    assignedStaff: r.assignedStaff,
    verifiedBy: r.verifiedBy,
    verificationTime: r.verificationTime,
    housekeepingPriority: r.housekeepingPriority,
    housekeepingNotes: r.housekeepingNotes,
    cleaningCompletedAt: r.cleaningCompletedAt || r.verificationTime,
  };
}

function mapAssetToAppRoom(rm: RoomAsset, hotelId: string): Room {
  let status: Room['status'] = 'Available';
  if (rm.status === 'Occupied') status = 'Occupied';
  else if (rm.status === 'Confirmed') status = 'Reserved';
  else if (rm.status === 'Out of Service') status = 'Out of Service';
  else if (rm.status === 'Dirty' || (rm.cleaningStatus && rm.cleaningStatus !== 'Clean')) status = 'Dirty';

  const mappedCleaning: Room['cleaningStatus'] =
    rm.cleaningStatus === 'In Progress'
      ? 'In Progress'
      : rm.cleaningStatus === 'Inspection'
      ? 'Needs Inspection'
      : rm.cleaningStatus === 'Dirty'
      ? 'Dirty'
      : 'Clean';

  return {
    id: rm.id,
    hotelId,
    number: rm.number,
    category: rm.category,
    rate: rm.rate,
    status,
    cleaningStatus: mappedCleaning,
    assignedStaff: rm.assignedStaff,
    verifiedBy: rm.verifiedBy,
    verificationTime: rm.verificationTime,
    housekeepingPriority: rm.housekeepingPriority,
    housekeepingNotes: rm.housekeepingNotes,
    cleaningCompletedAt: rm.cleaningCompletedAt,
    floor: rm.floor,
    bedType: rm.bedType,
    maxOccupancy: rm.maxOccupancy,
    baseOccupancy: rm.baseOccupancy,
    extraPersonCharge: rm.extraPersonCharge,
    amenities: rm.amenities,
    images: rm.images,
    outOfOrderReason: rm.blockedReason,
  };
}

function normalizeDocType(raw?: string): GuestPerson['documentType'] {
  if (!raw) return 'Aadhaar Card';
  const low = raw.toLowerCase();
  if (low.includes('passport')) return 'Passport';
  if (low.includes('pan')) return 'Pan Card';
  if (low.includes('driving') || low.includes('license') || low.includes('dl')) return 'Driving License';
  if (low.includes('voter')) return 'Voter Id Card';
  if (low.includes('visa')) return 'Visa';
  if (low.includes('aadhaar') || low.includes('aadhar')) return 'Aadhaar Card';
  return 'Aadhaar Card';
}

export function mapAppBookingToRecord(
  b: Booking,
  checkins: GuestCheckIn[],
  rooms: Room[],
  settings?: BillSettings
): BookingRecord {
  const anyB = b as any;
  const linkedCheckin = checkins.find(
    (c) =>
      c.id === b.id ||
      (c as any).bookingId === b.id ||
      (c.roomNumber === b.roomNumber &&
        c.checkInDate === b.checkInDate &&
        (c.guestName === b.guestName || c.guestName === anyB.customerName))
  );
  const anyC = linkedCheckin as any;
  const isCheckedOut = Boolean(
    b.isCompleted ||
      anyB.isCheckedOut ||
      (linkedCheckin &&
        (linkedCheckin.id === b.id || anyC?.bookingId === b.id) &&
        linkedCheckin.status === 'Checked Out')
  );
  const isCheckedIn = Boolean(
    !isCheckedOut &&
      (b.isCheckedIn ||
        anyB.isCheckedIn ||
        b.status === 'Checked In' ||
        (linkedCheckin &&
          (linkedCheckin.id === b.id || anyC?.bookingId === b.id) &&
          linkedCheckin.status === 'Active'))
  );
  const status: BookingRecord['status'] =
    b.status === 'Cancelled'
      ? 'Cancelled'
      : (b.status as string) === 'No-Show'
      ? 'No-Show'
      : isCheckedOut
      ? 'Checked Out'
      : isCheckedIn
      ? 'Checked In'
      : b.status === 'Pending'
      ? 'Pending'
      : 'Confirmed';

  const stay = buildStayBill({
    booking: b,
    checkin: linkedCheckin || null,
    rooms,
    settings,
  });
  const roomNums = stay.folio.roomNumbers;
  const matchedRm = rooms.find((r) => r.number === roomNums[0]);
  const nights = stay.folio.nights;
  const unitRate =
    matchedRm?.rate ||
    (b.bookingAmount && nights ? r2(b.bookingAmount / Math.max(1, nights)) : 2000);

  const roomSubtotal = r2(
    stay.bill.legacy.roomCharges +
      stay.bill.legacy.extraBedCharges +
      stay.bill.legacy.extraPersonCharges +
      stay.bill.legacy.earlyCheckInCharges +
      stay.bill.legacy.lateCheckOutCharges
  );
  const otherServicesTotal = r2(stay.bill.subtotal - roomSubtotal);
  const discountAmount = stay.bill.discount;
  const taxRate = stay.bill.headlineGstRate;
  const taxAmount = stay.bill.totalTax;
  const totalPayable = stay.bill.grandTotal;
  const amountPaid = stay.bill.receipts;
  const dueAmount =
    status === 'Cancelled' || status === 'No-Show' ? 0 : stay.bill.balance;

  const extraServices: OtherServiceItem[] = (linkedCheckin?.extraCharges || []).map((ec, idx) => ({
    id: ec.id || `srv-${b.id}-${idx}`,
    bookingId: b.id,
    orderNumber: `ORD-${idx + 1}`,
    roomNumber: roomNums[0] || '',
    roomName: `Room ${roomNums[0] || ''}`,
    serviceType: classifyExtraChargeServiceType({
      category: ec.category,
      sourceType: (ec as any).sourceType,
      description: ec.description,
    }),
    description: ec.description || ec.category || 'Room Charge',
    itemsSummary: ec.description || 'Service',
    quantity: 1,
    amount: r2(ec.amount || 0),
    taxAmount: 0,
    dateTime: ec.dateTime || b.checkInDate,
    isPaid: false,
  }));

  const isOpenStay = Boolean(anyB.isOpenStay || (b.notes && b.notes.includes('[OPEN-STAY]')));

  const toLocalYmd = (raw?: string, fallback = ''): string => {
    const s = String(raw || '').trim();
    if (!s) return fallback;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
    return s.slice(0, 10) || fallback;
  };

  const rawBookingPayments: PaymentRecordItem[] = Array.isArray(anyB.payments)
    ? [...anyB.payments]
    : [];
  const genuineNonSyntheticSum = r2(
    rawBookingPayments
      .filter((p) => p && !String(p.id || '').startsWith('pay-adv-') && Number(p.amount) > 0)
      .reduce((s, p) => s + Number(p.amount || 0), 0)
  );
  // Drop stale synthetic pay-adv-* wrapper if genuine split/check-in payments already cover it (UI-BUG-03 Part A)
  const paymentsList: PaymentRecordItem[] = rawBookingPayments.filter((p) => {
    if (!p) return false;
    const isSynthAdv = String(p.id || '') === `pay-adv-${b.id}`;
    if (isSynthAdv && genuineNonSyntheticSum > 0 && genuineNonSyntheticSum >= Number(p.amount || 0) - 0.01) {
      return false;
    }
    return true;
  });

  const seenPaymentIds = new Set(paymentsList.map((p) => String(p?.id || '')).filter(Boolean));
  const linkedCheckinPosPays = (linkedCheckin?.payments || []).filter(
    (p) => p && Number(p.amount) > 0 && !String(p.notes || '').toLowerCase().includes('marked as due')
  );
  const existingPosSum = r2(
    paymentsList.reduce((s, p) => s + (Number(p?.amount) > 0 ? Number(p.amount) : 0), 0)
  );
  const linkedPosSum = r2(linkedCheckinPosPays.reduce((s, p) => s + Number(p.amount || 0), 0));

  const hasAdvanceEntry =
    paymentsList.some((p) => {
      const pid = String(p?.id || '').toLowerCase();
      const notes = String(p?.notes || '').toLowerCase();
      const ptype = String((p as any)?.paymentType || '').toLowerCase();
      return (
        pid.includes('adv') ||
        pid.includes('checkin') ||
        notes.includes('advance') ||
        notes.includes('check-in') ||
        notes.includes('hybrid') ||
        ptype.includes('advance') ||
        ptype.includes('partial')
      );
    }) ||
    (Number(b.advanceAmount) > 0 &&
      (existingPosSum >= Number(b.advanceAmount) - 0.01 ||
        linkedPosSum >= Number(b.advanceAmount) - 0.01));

  if (!hasAdvanceEntry && Number(b.advanceAmount) > 0) {
    const advId = `pay-adv-${b.id}`;
    seenPaymentIds.add(advId);
    paymentsList.push({
      id: advId,
      bookingId: b.id,
      amount: r2(b.advanceAmount),
      paymentMethod: (b.paymentMethod as any) || 'UPI',
      transactionId: b.transactionId || `ADV-${b.id}`,
      date: b.bookingDate || b.checkInDate,
      time: '12:00 PM',
      recordedBy: b.createdBy || 'Front Desk',
      notes: 'Advance deposit',
    });
  }
  if (Number(b.refundAmount) > 0 && !seenPaymentIds.has(`pay-ref-${b.id}`)) {
    seenPaymentIds.add(`pay-ref-${b.id}`);
    paymentsList.push({
      id: `pay-ref-${b.id}`,
      bookingId: b.id,
      amount: -r2(b.refundAmount),
      paymentMethod: (b.paymentMethod as any) || 'UPI',
      transactionId: `REF-${b.id}`,
      date: b.bookingDate || b.checkInDate,
      time: '12:00 PM',
      recordedBy: 'Front Desk',
      notes: b.cancellationReason ? `Refund: ${b.cancellationReason}` : 'Cancellation Refund',
    });
  }
  linkedCheckinPosPays.forEach((p, idx) => {
    const anyP = p as any;
    const pid = String(p.id || `pay-${b.id}-${idx}`);
    if (seenPaymentIds.has(pid)) return;
    if (
      p.paymentType === 'Advance Deposit' &&
      paymentsList.some((bp) => String(bp.id || '') === `pay-adv-${b.id}`)
    ) {
      return;
    }
    const pMethodNorm = String(anyP.method || p.paymentMethod || 'UPI').toLowerCase();
    const isCheckInDeskPay =
      String(p.id || '').includes('-checkin') ||
      String(p.notes || '').toLowerCase().includes('check-in');
    if (
      isCheckInDeskPay &&
      paymentsList.some(
        (bp) =>
          Math.abs(bp.amount - p.amount) < 0.01 &&
          String(bp.paymentMethod || '').toLowerCase() === pMethodNorm
      )
    ) {
      return;
    }
    seenPaymentIds.add(pid);
    paymentsList.push({
      id: pid,
      bookingId: b.id,
      amount: r2(p.amount || 0),
      paymentMethod: anyP.method || p.paymentMethod || 'UPI',
      transactionId: anyP.reference || anyP.transactionId || anyP.transactionReference || `TXN-${idx + 1}`,
      date: toLocalYmd(anyP.date || p.dateTime, b.checkInDate),
      time: '12:00 PM',
      recordedBy: anyP.recordedBy || anyP.collectedBy || 'Front Desk',
      notes: p.notes || p.paymentType,
    });
  });

  const custName = b.guestName || anyB.customerName || anyB.name || linkedCheckin?.guestName || 'Guest';

  const primaryDocImg =
    anyB.idProofFileData ||
    anyB.aadhaarUploadData ||
    anyB.passportUploadData ||
    anyB.documentImageUrl ||
    linkedCheckin?.idProofFileData ||
    linkedCheckin?.aadhaarUploadData ||
    linkedCheckin?.passportUploadData ||
    linkedCheckin?.guestPhotoData ||
    anyC?.idDocumentFront;

  const primaryDocNum =
    b.aadhaarNumber ||
    b.passportNumber ||
    anyB.idNumber ||
    anyB.idProofNumber ||
    linkedCheckin?.idNumber ||
    linkedCheckin?.aadhaarNumber ||
    linkedCheckin?.passportNumber ||
    '';

  const primaryDocType = normalizeDocType(
    anyB.idType ||
      anyB.idProofType ||
      linkedCheckin?.idType ||
      (b.passportNumber || linkedCheckin?.passportNumber ? 'Passport' : 'Aadhaar Card')
  );

  let mappedGuests: GuestPerson[] = [];
  if (Array.isArray(anyB.guests) && anyB.guests.length > 0) {
    mappedGuests = anyB.guests.map((g: GuestPerson, idx: number) => ({
      ...g,
      documentType: normalizeDocType(g.documentType || (idx === 0 ? primaryDocType : 'Aadhaar Card')),
      documentNumber: g.documentNumber || (idx === 0 ? primaryDocNum : ''),
      documentImageUrl: g.documentImageUrl || (idx === 0 ? primaryDocImg : undefined),
    }));
  } else {
    mappedGuests = [
      {
        id: `gst-${b.id}`,
        name: custName,
        phone: b.mobile || anyB.mobile || anyC?.phone || linkedCheckin?.mobile || '',
        email: b.email || anyB.email || anyC?.email || linkedCheckin?.emailAddress || '',
        gender: 'Male',
        age: 30,
        dob: '',
        isAdult: true,
        documentType: primaryDocType,
        documentNumber: primaryDocNum,
        documentImageUrl: primaryDocImg,
      },
    ];
  }

  if (Array.isArray(linkedCheckin?.secondaryGuests) && linkedCheckin.secondaryGuests.length > 0) {
    linkedCheckin.secondaryGuests.forEach((sg, idx) => {
      const anySg = sg as any;
      const sgName = sg.fullName || anySg.name || '';
      if (!sgName) return;
      const alreadyExists = mappedGuests.some(
        (mg) => mg.name.toLowerCase().trim() === sgName.toLowerCase().trim()
      );
      if (!alreadyExists) {
        mappedGuests.push({
          id: `gst-sec-${b.id}-${idx}`,
          name: sgName,
          phone: b.mobile || anyC?.phone || linkedCheckin?.mobile || '',
          email: b.email || anyC?.email || linkedCheckin?.emailAddress || '',
          gender: 'Female',
          age: 26,
          dob: '',
          isAdult: true,
          documentType: normalizeDocType(sg.idType),
          documentNumber: sg.idNumber || '',
          documentImageUrl: anySg.idFileData || anySg.documentImageUrl,
        });
      }
    });
  }

  return {
    id: b.id,
    bookingNo: anyB.bookingNo || b.id.replace(/^#/, ''),
    billId: anyB.billId || `BL-${b.id.replace(/[^0-9A-Za-z]/g, '').slice(-6)}`,
    grcNumber: anyB.grcNumber || linkedCheckin?.grcNumber,
    bookingType: b.companyName || linkedCheckin?.companyName ? 'Corporate' : 'Personal',
    companyName: b.companyName || linkedCheckin?.companyName,
    companyGst: b.gstNumber || linkedCheckin?.gstNumber,
    gstInvoice: stay.folio.gstEnabled,
    customerName: custName,
    mobile: b.mobile || anyB.mobile || anyC?.phone || linkedCheckin?.mobile || '',
    email: b.email || anyB.email || anyC?.email || linkedCheckin?.emailAddress || '',
    address: b.address || anyB.address || linkedCheckin?.address || '',
    city: anyB.city || linkedCheckin?.city || '',
    state: anyB.state || linkedCheckin?.state || '',
    nationality: b.nationality || linkedCheckin?.nationality || 'Indian',
    voucherNumber: b.voucherNumber || linkedCheckin?.voucherNumber,
    hasExtraBed: b.hasExtraBed ?? linkedCheckin?.hasExtraBed,
    extraBedCount: b.extraBedCount ?? linkedCheckin?.extraBedCount,
    extraBedRate: b.extraBedRate ?? linkedCheckin?.extraBedRate,
    earlyCheckInCharge: b.earlyCheckInCharge ?? linkedCheckin?.earlyCheckInCharge,
    numGuests: Math.max((Number(b.adults) || 1) + (Number(b.children) || 0), mappedGuests.length),
    adults: Math.max(Number(b.adults) || 1, mappedGuests.length),
    children: Number(b.children) || 0,
    checkInDate: b.checkInDate,
    checkOutDate: b.checkOutDate,
    isOpenStay,
    expectedArrivalTime: anyB.expectedArrivalTime || '12:00 PM',
    checkInTime: anyC?.checkInTime || linkedCheckin?.arrivalTime || b.checkInTime || anyB.checkInTime || '12:00 PM',
    checkOutTime: anyC?.checkOutTime || linkedCheckin?.departureTime || b.checkOutTime || anyB.checkOutTime || '11:00 AM',
    nights,
    status,
    paymentStatus:
      Number(b.refundAmount) > 0 && status === 'Cancelled'
        ? ('Refunded' as any)
        : stay.bill.paymentStatus === 'Paid'
        ? 'Fully Paid'
        : stay.bill.paymentStatus,
    isCheckedIn,
    isCheckedOut,
    source: (b.bookingSource === 'Walk-in' ? 'WALK-IN' : (b.bookingSource as any)) || anyB.source || 'WALK-IN',
    bookedOn: b.bookingDate || b.checkInDate,
    requirements:
      Array.isArray(anyB.requirements) && anyB.requirements.length > 0
        ? roomNums.length === 1 && anyB.requirements.length > 1
          ? [
              {
                ...anyB.requirements[0],
                categoryName: matchedRm?.category || b.roomType || anyB.requirements[0].categoryName || 'Standard',
                qty: 1,
                unitPrice: matchedRm?.rate || unitRate,
                assignedRooms: roomNums,
              },
            ]
          : anyB.requirements
        : [
            {
              id: `req-${b.id}`,
              categoryName: b.roomType || matchedRm?.category || 'Standard',
              qty: Math.max(1, roomNums.length),
              planName: 'Only Rooms',
              unitPrice: unitRate,
              assignedRooms: roomNums,
            },
          ],
    roomNumbers: roomNums,
    roomCategorySummary:
      roomNums.length === 1 && typeof anyB.roomCategorySummary === 'string' && anyB.roomCategorySummary.includes(',')
        ? `1x ${matchedRm?.category || b.roomType || 'Standard'} (Only Rooms)`
        : anyB.roomCategorySummary || `${b.roomType || matchedRm?.category || 'Standard'} (${roomNums.join(', ')})`,
    roomSubtotal,
    otherServicesTotal,
    discountType: anyB.discountType || 'flat',
    discountValue: anyB.discountValue ?? discountAmount,
    discountAmount,
    taxRate,
    taxAmount,
    totalPayable,
    amountPaid,
    dueAmount,
    refundAmount: b.refundAmount,
    cancellationReason: b.cancellationReason,
    guests: mappedGuests,
    payments: paymentsList,
    otherServices:
      Array.isArray(anyB.otherServices) && anyB.otherServices.length > 0
        ? anyB.otherServices.map((sv: any) => ({
            ...sv,
            serviceType: classifyExtraChargeServiceType({
              category: sv.category,
              sourceType: sv.sourceType,
              serviceType: sv.serviceType,
              description: sv.description || sv.itemsSummary,
            }),
          }))
        : extraServices,
    remarks: b.notes || anyB.remarks,
  };
}

export function mapStandaloneCheckinToRecord(
  c: GuestCheckIn,
  rooms: Room[],
  settings?: BillSettings
): BookingRecord {
  const anyC = c as any;
  const stay = buildStayBill({
    booking: null,
    checkin: c,
    rooms,
    settings,
  });
  const roomNums = stay.folio.roomNumbers;
  const matchedRm = rooms.find((r) => r.number === c.roomNumber);
  const unitRate = Number(c.roomRate) || matchedRm?.rate || 2000;
  const nights = stay.folio.nights;
  const roomSubtotal = r2(
    stay.bill.legacy.roomCharges +
      stay.bill.legacy.extraBedCharges +
      stay.bill.legacy.extraPersonCharges +
      stay.bill.legacy.earlyCheckInCharges +
      stay.bill.legacy.lateCheckOutCharges
  );
  const otherServicesTotal = r2(stay.bill.subtotal - roomSubtotal);
  const discountAmount = stay.bill.discount;
  const taxRate = stay.bill.headlineGstRate;
  const taxAmount = stay.bill.totalTax;
  const totalPayable = stay.bill.grandTotal;
  const amountPaid = stay.bill.receipts;
  const dueAmount = stay.bill.balance;
  const isCheckedOut = c.status === 'Checked Out';
  const isCheckedIn = !isCheckedOut;

  const extraServices: OtherServiceItem[] = (c.extraCharges || []).map((ec, idx) => ({
    id: ec.id || `srv-${c.id}-${idx}`,
    bookingId: c.id,
    orderNumber: `ORD-${idx + 1}`,
    roomNumber: c.roomNumber || '',
    roomName: `Room ${c.roomNumber || ''}`,
    serviceType: classifyExtraChargeServiceType({
      category: ec.category,
      sourceType: (ec as any).sourceType,
      description: ec.description,
    }),
    description: ec.description || ec.category || 'Room Charge',
    itemsSummary: ec.description || 'Service',
    quantity: 1,
    amount: r2(ec.amount || 0),
    taxAmount: 0,
    dateTime: ec.dateTime || c.checkInDate,
    isPaid: false,
  }));

  const primaryDocImg =
    c.idProofFileData ||
    c.aadhaarUploadData ||
    c.passportUploadData ||
    c.guestPhotoData ||
    anyC.idDocumentFront ||
    anyC.documentImageUrl;

  const primaryDocNum = c.idNumber || c.aadhaarNumber || c.passportNumber || '';
  const primaryDocType = normalizeDocType(
    c.idType || (c.passportNumber ? 'Passport' : 'Aadhaar Card')
  );

  const guestsList: GuestPerson[] = [
    {
      id: `gst-${c.id}`,
      name: c.guestName || 'Guest',
      phone: anyC.phone || c.mobile || '',
      email: anyC.email || c.emailAddress || '',
      gender: 'Female',
      age: 28,
      dob: '',
      isAdult: true,
      documentType: primaryDocType,
      documentNumber: primaryDocNum,
      documentImageUrl: primaryDocImg,
    },
  ];

  if (Array.isArray(c.secondaryGuests) && c.secondaryGuests.length > 0) {
    c.secondaryGuests.forEach((sg, idx) => {
      const anySg = sg as any;
      if (!sg.fullName) return;
      guestsList.push({
        id: `gst-sec-${c.id}-${idx}`,
        name: sg.fullName,
        phone: anyC.phone || c.mobile || '',
        email: anyC.email || c.emailAddress || '',
        gender: 'Female',
        age: 25,
        dob: '',
        isAdult: true,
        documentType: normalizeDocType(sg.idType),
        documentNumber: sg.idNumber || '',
        documentImageUrl: anySg.idFileData || anySg.documentImageUrl,
      });
    });
  }

  const paymentsList: PaymentRecordItem[] = (c.payments || []).map((p, idx) => {
    const anyP = p as any;
    return {
      id: p.id || `pay-${c.id}-${idx}`,
      bookingId: c.id,
      amount: r2(p.amount || 0),
      paymentMethod: anyP.method || p.paymentMethod || 'UPI',
      transactionId: anyP.reference || anyP.transactionId || anyP.transactionReference || `TXN-${idx + 1}`,
      date: (p.dateTime || c.checkInDate).slice(0, 10),
      time: '12:00 PM',
      recordedBy: anyP.recordedBy || anyP.collectedBy || 'Front Desk',
      notes: p.notes || p.paymentType,
    };
  });

  return {
    id: c.id,
    bookingNo: c.id.replace(/^#/, ''),
    billId: `BL-${c.id.replace(/[^0-9A-Za-z]/g, '').slice(-6)}`,
    grcNumber: c.grcNumber,
    bookingType: c.companyName ? 'Corporate' : 'Personal',
    companyName: c.companyName,
    companyGst: c.gstNumber,
    gstInvoice: stay.folio.gstEnabled,
    customerName: c.guestName || 'Guest',
    mobile: anyC.phone || c.mobile || '',
    email: anyC.email || c.emailAddress || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    nationality: c.nationality || 'Indian',
    voucherNumber: c.voucherNumber,
    hasExtraBed: c.hasExtraBed,
    extraBedCount: c.extraBedCount,
    extraBedRate: c.extraBedRate,
    earlyCheckInCharge: c.earlyCheckInCharge,
    numGuests: Math.max((Number(c.adults) || 1) + (Number(c.children) || 0), guestsList.length),
    adults: Math.max(Number(c.adults) || 1, guestsList.length),
    children: Number(c.children) || 0,
    checkInDate: c.checkInDate,
    checkOutDate: c.checkOutDate,
    isOpenStay: false,
    expectedArrivalTime: anyC.checkInTime || c.arrivalTime || '12:00 PM',
    checkInTime: anyC.checkInTime || c.arrivalTime || '12:00 PM',
    checkOutTime: anyC.checkOutTime || c.departureTime || '11:00 AM',
    nights,
    status: isCheckedOut ? 'Checked Out' : 'Checked In',
    paymentStatus:
      stay.bill.paymentStatus === 'Paid' ? 'Fully Paid' : stay.bill.paymentStatus,
    isCheckedIn,
    isCheckedOut,
    source: 'WALK-IN',
    bookedOn: c.checkInDate,
    requirements: [
      {
        id: `req-${c.id}`,
        categoryName: matchedRm?.category || 'Standard',
        qty: 1,
        planName: 'Only Rooms',
        unitPrice: unitRate,
        assignedRooms: roomNums,
      },
    ],
    roomNumbers: roomNums,
    roomCategorySummary: `${matchedRm?.category || 'Standard'} (${roomNums.join(', ')})`,
    roomSubtotal,
    otherServicesTotal,
    discountType: 'flat',
    discountValue: discountAmount,
    discountAmount,
    taxRate,
    taxAmount,
    totalPayable,
    amountPaid,
    dueAmount,
    guests: guestsList,
    payments: paymentsList,
    otherServices: extraServices,
    remarks: anyC.specialRequests || '',
  };
}

function mapRecordToAppBooking(rec: BookingRecord, hotelId: string, existing?: Booking): Booking {
  const baseNote = rec.remarks || '';
  const notesWithFlag = rec.isOpenStay && !baseNote.includes('[OPEN-STAY]') ? `[OPEN-STAY] ${baseNote}`.trim() : baseNote;
  const primaryGuest = rec.guests?.[0];
  return {
    ...(existing || {}),
    id: rec.id,
    hotelId,
    guestName: rec.customerName,
    mobile: rec.mobile,
    email: rec.email,
    aadhaarNumber: primaryGuest?.documentNumber || existing?.aadhaarNumber || '',
    address: rec.address ?? existing?.address,
    checkInDate: rec.checkInDate,
    checkOutDate: rec.checkOutDate,
    nights: rec.nights,
    adults: rec.adults || rec.numGuests || 1,
    children: rec.children || 0,
    roomNumber: rec.roomNumbers.length > 1 ? rec.roomNumbers.join(', ') : (rec.roomNumbers[0] || existing?.roomNumber || ''),
    roomType: rec.requirements[0]?.categoryName || existing?.roomType || 'Standard',
    advanceAmount: rec.amountPaid,
    paymentMethod: (rec.payments[0]?.paymentMethod === 'UPI' ||
    rec.payments[0]?.paymentMethod === 'Cash' ||
    rec.payments[0]?.paymentMethod === 'Card'
      ? rec.payments[0].paymentMethod
      : existing?.paymentMethod || 'UPI') as any,
    bookingSource: existing?.bookingSource || (rec.source === 'WALK-IN' ? 'Walk-in' : (rec.source as any)) || 'Walk-in',
    status:
      rec.status === 'Checked In'
        ? 'Checked In'
        : rec.status === 'No-Show'
        ? ('No-Show' as any)
        : rec.status === 'Cancelled'
        ? 'Cancelled'
        : rec.status === 'Pending'
        ? (existing?.status === 'Advance' || existing?.status === 'In Process' || existing?.status === 'Waiting' ? existing.status : 'Pending')
        : 'Confirmed',
    isCheckedIn: rec.isCheckedIn,
    isCompleted: rec.isCheckedOut,
    bookingAmount: rec.roomSubtotal,
    gstRate: rec.gstInvoice && rec.taxRate > 0 ? rec.taxRate : 0,
    gstAmount: rec.gstInvoice && rec.taxRate > 0 ? rec.taxAmount : 0,
    isWithoutGst: !rec.gstInvoice || rec.taxRate <= 0,
    paymentStatus:
      rec.dueAmount <= 0 && rec.amountPaid > 0
        ? 'Fully Paid'
        : rec.amountPaid > 0
        ? 'Partially Paid'
        : 'Unpaid',
    transactionId: rec.payments[0]?.transactionId || existing?.transactionId || '',
    bookingDate: rec.bookedOn || existing?.bookingDate,
    refundAmount: rec.refundAmount ?? existing?.refundAmount,
    cancellationReason: rec.cancellationReason ?? existing?.cancellationReason,
    companyName: rec.companyName ?? existing?.companyName,
    gstNumber: rec.companyGst ?? existing?.gstNumber,
    notes: notesWithFlag,
      bookedRooms:
        existing?.bookedRooms && existing.bookedRooms.length === rec.roomNumbers.length
          ? existing.bookedRooms
          : rec.roomNumbers.map((rn) => {
              const rate = rec.requirements[0]?.unitPrice || 2000;
              return {
                roomNumber: rn,
                category: rec.requirements[0]?.categoryName || 'Standard',
                rate,
                originalRate: rate,
                discountAmountOfRoom: 0,
                guestsCount: 2,
                extraGuestsCount: 0,
                extraPersonChargeApplied: 0,
                totalRoomAmount: rate * Math.max(1, rec.nights),
              };
            }),
      // Preserve full PMS record fields in MongoDB so guest documents, co-guests, GRC, and folios never get wiped
      ...({
        bookingNo: rec.bookingNo,
        billId: rec.billId,
        grcNumber: rec.grcNumber ?? (existing as any)?.grcNumber,
        city: rec.city ?? (existing as any)?.city,
        state: rec.state ?? (existing as any)?.state,
        hasExtraBed: rec.hasExtraBed ?? existing?.hasExtraBed,
        extraBedCount: rec.extraBedCount ?? existing?.extraBedCount,
        extraBedRate: rec.extraBedRate ?? existing?.extraBedRate,
        earlyCheckInCharge: rec.earlyCheckInCharge ?? existing?.earlyCheckInCharge,
        customerName: rec.customerName,
      isOpenStay: rec.isOpenStay,
      expectedArrivalTime: rec.expectedArrivalTime,
      checkInTime: rec.checkInTime,
      checkOutTime: rec.checkOutTime,
      isCheckedOut: rec.isCheckedOut,
      roomNumbers: rec.roomNumbers,
      roomCategorySummary: rec.roomCategorySummary,
      requirements: rec.requirements,
      roomSubtotal: rec.roomSubtotal,
      otherServicesTotal: rec.otherServicesTotal,
      discountType: rec.discountType,
      discountValue: rec.discountValue,
      discountAmount: rec.discountAmount,
      gstInvoice: rec.gstInvoice && rec.taxRate > 0,
      taxRate: rec.gstInvoice && rec.taxRate > 0 ? rec.taxRate : 0,
      taxAmount: rec.gstInvoice && rec.taxRate > 0 ? rec.taxAmount : 0,
      totalPayable: rec.totalPayable,
      amountPaid: rec.amountPaid,
      dueAmount: rec.dueAmount,
      guests: rec.guests,
      payments: rec.payments,
      otherServices: rec.otherServices,
      idType: primaryGuest?.documentType || 'Aadhaar Card',
      idNumber: primaryGuest?.documentNumber || '',
      idProofFileData: primaryGuest?.documentImageUrl,
      documentImageUrl: primaryGuest?.documentImageUrl,
    } as any ),
  };
}

export const IntegratedAdminPmsHub: React.FC<IntegratedAdminPmsHubProps> = ({
  activeTab,
  setActiveTab,
  frontDeskSubTab,
  setFrontDeskSubTab,
  financeSubTab,
  setFinanceSubTab,
  roomSubTab: propRoomSubTab,
  setRoomSubTab: propSetRoomSubTab,
  housekeepingSubTab: propHousekeepingSubTab,
  setHousekeepingSubTab: propSetHousekeepingSubTab,
  posSubTab: propPosSubTab,
  setPosSubTab: propSetPosSubTab,
  inventorySubTab: propInventorySubTab,
  setInventorySubTab: propSetInventorySubTab,
  otaSubTab: propOtaSubTab,
  setOtaSubTab: propSetOtaSubTab,
  reportsSubTab: propReportsSubTab,
  setReportsSubTab: propSetReportsSubTab,
  staffSubTab: propStaffSubTab,
  setStaffSubTab: propSetStaffSubTab,
  invoiceSubTab: propInvoiceSubTab,
  setInvoiceSubTab: propSetInvoiceSubTab,
  selectedHotelId = 'hotel-1',
  hotelName,
  hotelAddress,
  hotelGst,
  hotelPhone,
  hotelEmail,
  hotelSettings,
  onUpdateHotelSettings,
  currentRole = 'Admin',
  loggedInUser,
  onAddAuditLog,
  setSelectedBookingForCheckin,
  appRooms = [],
  appBookings = [],
  appCheckins = [],
  appInvoices = [],
  appExpenses = [],
  appStaff = [],
  appAuditLogs = [],
  appWaterBottles = [],
  appPosItems = [],
  appPosOrders = [],
  appInventoryProducts = [],
  appInventoryCategories = [],
  appInventorySuppliers = [],
  appInventoryPurchases = [],
  appInventoryStockMovements = [],
  appPettyCash = [],
  appCashBankAccounts = [],
  appVouchers = [],
  appOwnerPayments = [],
  appHandovers = [],
  appReimbursements = [],
  appDailyClosings = [],
  appLaundryOrders = [],
  appLostAndFoundItems = [],
  appCleaningLogs = [],
  appTravelAgents = [],
  appAgentCommissionPayments = [],
  appPosAdvanceBookings = [],
  appPosCategories = [],
  appPosTables = [],
  appRolePermissions = [],
  onUpdateRooms,
  onUpdateBookings,
  onUpdateCheckins,
  onUpdateInvoices,
  onUpdateExpenses,
  onUpdateStaff,
  onUpdateWaterBottles,
  onUpdatePosItems,
  onUpdatePosOrders,
  onUpdateInventoryProducts,
  onUpdateInventoryCategories,
  onUpdateInventorySuppliers,
  onUpdateInventoryPurchases,
  onUpdateInventoryMovements,
  onUpdatePettyCash,
  onUpdateCashBankAccounts,
  onUpdateVouchers,
  onUpdateOwnerPayments,
  onUpdateReimbursements,
  onUpdateDailyClosings,
  onUpdateLaundryOrders,
  onUpdateLostAndFoundItems,
  onUpdateCleaningLogs,
  onUpdateTravelAgents,
  onUpdateAgentCommissionPayments,
  onUpdatePosAdvanceBookings,
  onUpdatePosCategories,
  onUpdatePosTables,
  onCascadeDeleteGuest,
}) => {
  const [hubTaxSettings] = useHotelTaxSettings();
  const billSettings = React.useMemo(
    () => normalizeBillSettings(getHotelTaxSettings(), hubTaxSettings, hotelSettings),
    [hubTaxSettings, hotelSettings]
  );

  // Wipe any legacy dummy localStorage keys on mount
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('directstay_integrated_pms_v2_')) {
          localStorage.removeItem(k);
        }
      });
    } catch {
      // ignore
    }
  }, []);

  // Sub-Tab States for internal modules (synced with Sidebar props when provided)
  const [localInvoiceSubTab, setLocalInvoiceSubTab] = useState<string>('all');
  const [localRoomSubTab, setLocalRoomSubTab] = useState<string>('dashboard');
  const [localHousekeepingSubTab, setLocalHousekeepingSubTab] = useState<string>('dashboard');
  const [localPosSubTab, setLocalPosSubTab] = useState<string>('terminal');
  const [localInventorySubTab, setLocalInventorySubTab] = useState<string>('dashboard');
  const [localOtaSubTab, setLocalOtaSubTab] = useState<string>('channels');
  const [localReportsSubTab, setLocalReportsSubTab] = useState<string>('dashboard');
  const [localStaffSubTab, setLocalStaffSubTab] = useState<string>('directory');
  const [inventoryViewMode, setInventoryViewMode] = useState<'modern' | 'catalog'>('modern');

  const invoiceSubTab = propInvoiceSubTab ?? localInvoiceSubTab;
  const setInvoiceSubTab = propSetInvoiceSubTab ?? setLocalInvoiceSubTab;
  const roomSubTab = propRoomSubTab ?? localRoomSubTab;
  const setRoomSubTab = propSetRoomSubTab ?? setLocalRoomSubTab;
  const housekeepingSubTab = propHousekeepingSubTab ?? localHousekeepingSubTab;
  const setHousekeepingSubTab = propSetHousekeepingSubTab ?? setLocalHousekeepingSubTab;
  const posSubTab = propPosSubTab ?? localPosSubTab;
  const setPosSubTab = propSetPosSubTab ?? setLocalPosSubTab;
  const inventorySubTab = propInventorySubTab ?? localInventorySubTab;
  const setInventorySubTab = propSetInventorySubTab ?? setLocalInventorySubTab;
  const otaSubTab = propOtaSubTab ?? localOtaSubTab;
  const setOtaSubTab = propSetOtaSubTab ?? setLocalOtaSubTab;
  const reportsSubTab = propReportsSubTab ?? localReportsSubTab;
  const setReportsSubTab = propSetReportsSubTab ?? setLocalReportsSubTab;
  const staffSubTab = propStaffSubTab ?? localStaffSubTab;
  const setStaffSubTab = propSetStaffSubTab ?? setLocalStaffSubTab;

  // Helper to persist any module collection directly to MongoDB Atlas via /api/pms/modules/:collection
  const persistModuleCollectionToApi = async (collectionKey: string, items: any[]) => {
    try {
      const token = sessionStorage.getItem('pms_session_token') || localStorage.getItem('pms_session_token') || '';
      const role = sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role') || currentRole || 'Admin';
      const user = sessionStorage.getItem('pms_user') || localStorage.getItem('pms_user') || loggedInUser || 'Admin';
      await fetch(`/api/pms/modules/${collectionKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': token,
          'x-user-role': role,
          'x-hotel-id': selectedHotelId,
          'x-target-hotel-id': selectedHotelId,
          'x-user-name': user,
        },
        body: JSON.stringify({
          hotelId: selectedHotelId,
          items: items.map((item) => ({ ...item, hotelId: selectedHotelId })),
        }),
      });
    } catch {
      // Non-blocking fallback
    }
  };

  // Master Dynamic State (Synced with App.tsx MongoDB Atlas State)
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [rooms, setRooms] = useState<RoomAsset[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [roomBlocks, setRoomBlocks] = useState<RoomBlockRecord[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [laundryOrders, setLaundryOrders] = useState<LaundryOrderRecord[]>([]);
  const [lostFound, setLostFound] = useState<LostFoundRecord[]>([]);
  const [posMenu, setPosMenu] = useState<PosMenuItem[]>([]);
  const [posOrders, setPosOrders] = useState<PosOrderRecord[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRecord[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplierRecord[]>([]);
  const [purchases, setPurchases] = useState<InventoryPurchaseRecord[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovementRecord[]>([]);

  const latestInvItemsRef = useRef<InventoryItemRecord[]>([]);
  const latestAppInvProductsRef = useRef<InventoryProduct[]>(appInventoryProducts);
  const latestAppInvMovementsRef = useRef<InventoryStockMovement[]>(appInventoryStockMovements);
  const stockMovSeqRef = useRef<number>(0);

  useEffect(() => {
    latestInvItemsRef.current = inventoryItems;
  }, [inventoryItems]);
  useEffect(() => {
    latestAppInvProductsRef.current = appInventoryProducts;
  }, [appInventoryProducts]);
  useEffect(() => {
    latestAppInvMovementsRef.current = appInventoryStockMovements;
  }, [appInventoryStockMovements]);

  const recordWarehouseStockMovement = (
    itemId: string,
    type: 'IN' | 'OUT',
    qty: number,
    department: string,
    reason: string
  ) => {
    const r4 = (v: number) => Math.round(v * 10000) / 10000;
    const cleanQty = r4(Math.max(0, Number(qty) || 0));
    if (cleanQty <= 0) return;

    const currentItems = latestInvItemsRef.current;
    const target = currentItems.find((i) => i.id === itemId);
    if (!target) return;

    const nextItems = currentItems.map((i) => {
      if (i.id !== itemId) return i;
      const nextStock =
        type === 'IN' ? r4((Number(i.currentStock) || 0) + cleanQty) : r4(Math.max(0, (Number(i.currentStock) || 0) - cleanQty));
      return { ...i, currentStock: nextStock };
    });
    latestInvItemsRef.current = nextItems;
    setInventoryItems(nextItems);

    if (onUpdateInventoryProducts) {
      const nextProducts = latestAppInvProductsRef.current.map((ip) => {
        if (ip.id !== itemId) return ip;
        const nextStock =
          type === 'IN'
            ? r4((Number(ip.currentStock) || 0) + cleanQty)
            : r4(Math.max(0, (Number(ip.currentStock) || 0) - cleanQty));
        const minSt = Number(ip.minimumStock ?? target.minStock) || 0;
        return {
          ...ip,
          currentStock: nextStock,
          status: nextStock <= minSt ? 'Low Stock' : 'In Stock',
          lastUpdated: new Date().toISOString().slice(0, 10),
        } as InventoryProduct;
      });
      latestAppInvProductsRef.current = nextProducts;
      onUpdateInventoryProducts(nextProducts);
    }

    stockMovSeqRef.current += 1;
    const newMovId = `SM-${Date.now()}-${stockMovSeqRef.current}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    const localMov: StockMovementRecord = {
      id: newMovId,
      date: todayIso,
      productName: target.name,
      type,
      qty: cleanQty,
      department,
      reason,
      handledBy: loggedInUser || 'Restaurant Staff',
    };
    setStockMovements((prev) => [localMov, ...prev]);

    if (onUpdateInventoryMovements) {
      const dbMov: InventoryStockMovement = {
        id: newMovId,
        hotelId: selectedHotelId,
        productId: target.id,
        productName: target.name,
        productCode: target.code,
        type,
        quantity: cleanQty,
        date: todayIso,
        reason: `${department}: ${reason}`,
        notes: reason,
      };
      const nextDbMovs = [dbMov, ...latestAppInvMovementsRef.current];
      latestAppInvMovementsRef.current = nextDbMovs;
      onUpdateInventoryMovements(nextDbMovs);
    }
  };
  const [otaChannels, setOtaChannels] = useState<OtaChannelRecord[]>([
    {
      id: 'ota-mmt',
      name: 'MakeMyTrip',
      logoBadge: 'MMT',
      connected: false,
      hotelCode: '',
      commissionPercent: 15,
      markupPercent: 15,
      lastSync: 'Not Synced',
      bookingsCount: 0,
      revenueGenerated: 0,
      status: 'Disconnected',
    },
    {
      id: 'ota-goi',
      name: 'Goibibo',
      logoBadge: 'GOI',
      connected: false,
      hotelCode: '',
      commissionPercent: 15,
      markupPercent: 15,
      lastSync: 'Not Synced',
      bookingsCount: 0,
      revenueGenerated: 0,
      status: 'Disconnected',
    },
    {
      id: 'ota-bdc',
      name: 'Booking.com',
      logoBadge: 'BDC',
      connected: false,
      hotelCode: '',
      commissionPercent: 18,
      markupPercent: 18,
      lastSync: 'Not Synced',
      bookingsCount: 0,
      revenueGenerated: 0,
      status: 'Disconnected',
    },
    {
      id: 'ota-agd',
      name: 'Agoda',
      logoBadge: 'AGD',
      connected: false,
      hotelCode: '',
      commissionPercent: 16,
      markupPercent: 16,
      lastSync: 'Not Synced',
      bookingsCount: 0,
      revenueGenerated: 0,
      status: 'Disconnected',
    },
  ]);
  const [expenses, setExpenses] = useState<FinanceExpenseRecord[]>([]);
  const [vouchers, setVouchers] = useState<FinanceVoucherRecord[]>([]);
  const [accounts, setAccounts] = useState<CashBankAccountRecord[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCashRecord[]>([]);
  const [ownerPayments, setOwnerPayments] = useState<OwnerPaymentRecord[]>([]);
  const [reimbursements, setReimbursements] = useState<StaffReimbursementRecord[]>([]);
  const [dailyClosings, setDailyClosings] = useState<DailyClosingEntry[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBillRecord[]>([]);
  const [miscIncome, setMiscIncome] = useState<MiscellaneousIncomeRecord[]>([]);
  const [otaSettlements, setOtaSettlements] = useState<OtaSettlementRecord[]>([]);
  const [staff, setStaff] = useState<StaffMemberRecord[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterBottleLogEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Hydrate assetGroups, roomBlocks, priceHistory, otaChannels, vendorBills, miscIncome, otaSettlements from Backend MongoDB Atlas APIs
  useEffect(() => {
    let cancelled = false;
    const loadModuleCollections = async () => {
      try {
        const token = sessionStorage.getItem('pms_session_token') || localStorage.getItem('pms_session_token') || '';
        const role = sessionStorage.getItem('pms_role') || localStorage.getItem('pms_role') || currentRole || 'Admin';
        if (!token) return;
        const headers: Record<string, string> = {
          'x-session-token': token,
          'x-user-role': role,
          'x-hotel-id': selectedHotelId,
          'x-target-hotel-id': selectedHotelId,
        };
        const [agRes, rbRes, phRes, otaRes, vbRes, miRes, osRes, rbacRes] = await Promise.all([
          fetch(`/api/pms/modules/assetGroups?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
          fetch(`/api/pms/modules/roomBlocks?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
          fetch(`/api/pms/modules/priceHistory?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
          fetch(`/api/pms/modules/otaChannels?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
          fetch(`/api/pms/modules/vendorBills?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
          fetch(`/api/pms/modules/miscIncome?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
          fetch(`/api/pms/modules/otaSettlements?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
          fetch(`/api/pms/modules/rbacMatrix?hotelId=${encodeURIComponent(selectedHotelId)}`, { headers }),
        ]);
        if (cancelled) return;
        if (rbacRes && rbacRes.ok) {
          const rbacJson = await rbacRes.json();
          if (Array.isArray(rbacJson.items) && rbacJson.items[0]?.matrix) {
            saveRbacMatrix(rbacJson.items[0].matrix);
          }
        }
        if (agRes.ok) {
          const agJson = await agRes.json();
          if (Array.isArray(agJson.items) && agJson.items.length > 0) {
            setAssetGroups(agJson.items);
          }
        }
        if (rbRes.ok) {
          const rbJson = await rbRes.json();
          if (Array.isArray(rbJson.items)) {
            setRoomBlocks(rbJson.items);
          }
        }
        if (phRes.ok) {
          const phJson = await phRes.json();
          if (Array.isArray(phJson.items)) {
            setPriceHistory(phJson.items);
          }
        }
        if (otaRes.ok) {
          const otaJson = await otaRes.json();
          if (Array.isArray(otaJson.items) && otaJson.items.length > 0) {
            setOtaChannels(otaJson.items);
          }
        }
        if (vbRes.ok) {
          const vbJson = await vbRes.json();
          if (Array.isArray(vbJson.items)) {
            setVendorBills(vbJson.items);
          }
        }
        if (miRes.ok) {
          const miJson = await miRes.json();
          if (Array.isArray(miJson.items)) {
            setMiscIncome(miJson.items);
          }
        }
        if (osRes.ok) {
          const osJson = await osRes.json();
          if (Array.isArray(osJson.items)) {
            setOtaSettlements(osJson.items);
          }
        }
      } catch {
        // Fallback to derived state
      }
    };
    loadModuleCollections();
    return () => {
      cancelled = true;
    };
  }, [selectedHotelId, currentRole]);

  // Hydrate & sync from App.tsx MongoDB Atlas props whenever hotel or DB arrays update
  useEffect(() => {
    const baseBookings = appBookings.map((b) =>
      mapAppBookingToRecord(b, appCheckins, appRooms, billSettings)
    );
    const standaloneCheckins = appCheckins
      .filter(
        (c) =>
          !appBookings.some(
            (b) =>
              b.id === c.id ||
              (c as any).bookingId === b.id ||
              (b.roomNumber === c.roomNumber &&
                b.checkInDate === c.checkInDate &&
                (b.guestName === c.guestName || (b as any).customerName === c.guestName))
          )
      )
      .map((c) => mapStandaloneCheckinToRecord(c, appRooms, billSettings));

    const rawBookings = [...baseBookings, ...standaloneCheckins];

    // Enrich EVERY booking using the Single Source of Truth Bill Calculator (buildStayBill)
    // - Food enters PRE-TAX (never double-taxed!)
    // - Duplicate EC-POS-x / EC-WB-x / EC-LND-x collapse automatically
    // - Counter-paid Dine-In / Takeaway POS orders are excluded from room folios
    // - Paise r2 rounding & accurate bill.paymentStatus
    const mappedBookings = rawBookings.map((b) => {
      const rawAppBkg = appBookings.find((ab) => ab.id === b.id);
      const linkedCheckin = appCheckins.find(
        (c) =>
          c.id === b.id ||
          (c as any).bookingId === b.id ||
          (c.roomNumber === b.roomNumbers[0] &&
            c.checkInDate === b.checkInDate &&
            c.guestName === b.customerName)
      );

      const { folio, bill } = buildStayBill({
        booking: rawAppBkg || b,
        checkin: linkedCheckin || null,
        posOrders: appPosOrders,
        laundryOrders: appLaundryOrders,
        waterBottles: appWaterBottles,
        rooms: appRooms,
        settings: billSettings,
      });

      const roomStayKinds = new Set<string>([
        'room',
        'extra_bed',
        'extra_person',
        'early_checkin',
        'late_checkout',
      ]);

      const deDupedServices: OtherServiceItem[] = bill.chargeLines
        .filter((cl) => !roomStayKinds.has(cl.kind || ''))
        .map((cl, idx) => {
          const serviceType: OtherServiceItem['serviceType'] =
            cl.kind === 'food'
              ? 'POS_FOOD'
              : cl.kind === 'laundry'
              ? 'LAUNDRY'
              : cl.kind === 'water'
              ? 'WATER BOTTLE'
              : cl.kind === 'fine'
              ? 'DAMAGE / FINE'
              : 'SPA / OTHER';
          return {
            id: cl.sourceId || `srv-${b.id}-${idx}`,
            bookingId: b.id,
            orderNumber: cl.sourceId || `ORD-${idx + 1}`,
            roomNumber: cl.roomNumber || b.roomNumbers[0] || '',
            roomName: `Room ${cl.roomNumber || b.roomNumbers[0] || ''}`,
            serviceType,
            description: cl.description,
            itemsSummary: cl.description,
            quantity: 1,
            amount: cl.charges,
            taxAmount: 0,
            dateTime: cl.dateLabel || b.checkInDate,
            isPaid: false,
          };
        });

      const roomSubtotal = r2(
        bill.legacy.roomCharges +
          bill.legacy.extraBedCharges +
          bill.legacy.extraPersonCharges +
          bill.legacy.earlyCheckInCharges +
          bill.legacy.lateCheckOutCharges
      );
      const otherServicesTotal = r2(bill.subtotal - roomSubtotal);
      const isCancelledOrNoShow = b.status === 'Cancelled' || b.status === 'No-Show';
      const dueAmount = isCancelledOrNoShow ? 0 : bill.balance;
      const paymentStatus: BookingRecord['paymentStatus'] =
        Number(b.refundAmount) > 0 && isCancelledOrNoShow
          ? 'Refunded'
          : bill.paymentStatus === 'Paid'
          ? 'Fully Paid'
          : bill.paymentStatus;

      return {
        ...b,
        roomNumbers: folio.roomNumbers.length > 0 ? folio.roomNumbers : b.roomNumbers,
        nights: folio.nights,
        gstInvoice: folio.gstEnabled,
        roomSubtotal,
        otherServices: deDupedServices,
        otherServicesTotal,
        discountAmount: bill.discount,
        taxRate: bill.headlineGstRate,
        taxAmount: bill.totalTax,
        totalPayable: bill.grandTotal,
        amountPaid: bill.receipts,
        dueAmount,
        paymentStatus,
      };
    });
    setBookings(mappedBookings);

    const mappedRooms = appRooms.map((r) => mapAppRoomToAsset(r, mappedBookings));
    setRooms(mappedRooms);

    // Derive assetGroups dynamically from rooms & merge with any saved custom assetGroups
    const catMap = new Map<string, { rate: number; count: number }>();
    mappedRooms.forEach((rm) => {
      const normCat = normalizeCategory(rm.category);
      const existing = catMap.get(normCat);
      if (existing) {
        existing.count += 1;
      } else {
        catMap.set(normCat, { rate: rm.rate, count: 1 });
      }
    });
    const derivedGroups: AssetGroup[] = Array.from(catMap.entries()).map(([name, info]) => ({
      id: `grp-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      description: `${name} Inventory`,
      basePrice: info.rate,
      taxRate: billSettings.roomGstRate,
      pricingMode: 'Match Pricing',
      assetCount: info.count,
      planPrices: [
        { planName: 'Only Rooms', price: info.rate, enabled: true },
        { planName: 'Meals Included', price: info.rate + 500, enabled: true },
        { planName: 'EP(SG)', price: Math.max(500, info.rate - 200), enabled: true },
      ],
    }));
    setAssetGroups((prev) => {
      const mergedMap = new Map<string, AssetGroup>();
      prev.forEach((g) => mergedMap.set(g.name.toLowerCase(), g));
      derivedGroups.forEach((dg) => {
        const ex = mergedMap.get(dg.name.toLowerCase());
        if (ex) {
          mergedMap.set(dg.name.toLowerCase(), { ...ex, assetCount: dg.assetCount });
        } else {
          mergedMap.set(dg.name.toLowerCase(), dg);
        }
      });
      return Array.from(mergedMap.values());
    });

    // Map saved invoices — NEVER recompute already-issued invoices! Reconcile authoritative taxRows/totalAmount/balance consistently at read-time without mutating DB records.
    const mappedInvoices: InvoiceRecord[] = appInvoices.map((inv) => {
      const anyInv = inv as any;
      const resolvedTotals = resolveConsistentInvoiceTotals(inv, billSettings.roomGstRate);
      const isInvNoGst = resolvedTotals.isNoGst;
      const totalTax = resolvedTotals.totalTax;
      const cgst = resolvedTotals.cgst;
      const sgst = resolvedTotals.sgst;

      const extraBedCharges = r2(inv.extraBedCharges || 0);
      const extraPersonCharges = r2(inv.extraPersonCharges || 0);
      const earlyCheckInCharges = r2(anyInv.earlyCheckInCharges || 0);
      const lateCheckOutCharges = r2(anyInv.lateCheckOutCharges || 0);
      const foodCharges = r2(inv.foodCharges || 0);
      const waterCharges = r2(inv.waterCharges || 0);
      const laundryCharges = r2(inv.laundryCharges || 0);
      const serviceCharges = r2(inv.serviceCharges || 0);
      const fineCharges = r2(anyInv.fineCharges || 0);
      const rawOtherCharges = r2(inv.otherCharges || 0);
      // In buildInvoiceRecord (billEngine === 'v2'), otherCharges already includes fineCharges
      const netOtherPlusFine =
        anyInv.billEngine === 'v2' ? rawOtherCharges : r2(rawOtherCharges + fineCharges);

      const otherSrv = r2(
        extraBedCharges +
          extraPersonCharges +
          earlyCheckInCharges +
          lateCheckOutCharges +
          foodCharges +
          waterCharges +
          laundryCharges +
          serviceCharges +
          netOtherPlusFine +
          (Number(inv.extraChargesTotal) || 0)
      );

      const isCreditNoteInv = resolvedTotals.isCreditNote;
      const savedGrandTotal = resolvedTotals.grandTotal;
      const savedPaid = resolvedTotals.receipts;
      const savedPending = resolvedTotals.balance;

      const savedRoomNums: string[] =
        Array.isArray(anyInv.roomNumbers) && anyInv.roomNumbers.length > 0
          ? anyInv.roomNumbers.map(String)
          : String(inv.roomNumber || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

      const ciDate = String(inv.checkInDate || '').slice(0, 10);
      const coDate = String(inv.checkOutDate || '').slice(0, 10);
      const derivedNights =
        Number(anyInv.nights) > 0
          ? Number(anyInv.nights)
          : ciDate && coDate
          ? Math.max(
              1,
              Math.round(
                (new Date(`${coDate}T00:00:00`).getTime() - new Date(`${ciDate}T00:00:00`).getTime()) /
                  86400000
              ) || 1
            )
          : 1;

      const paymentStatus: InvoiceRecord['paymentStatus'] = resolvedTotals.paymentStatus;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber || inv.id,
        bookingId: inv.bookingId,
        bookingNo: anyInv.bookingNo || inv.bookingId,
        gstRate: isInvNoGst ? 0 : resolvedTotals.headlineGstRate,
        isWithoutGst: isInvNoGst,
        isSeparateInvoice: anyInv.isSeparateInvoice,
        isFoodRoomSplitSettled: Boolean(
          anyInv.isFoodRoomSplitSettled === true ||
            String(anyInv.invoiceScope || '').toLowerCase() === 'room_only' ||
            String(anyInv.invoiceScope || '').toLowerCase() === 'food_only'
        ),
        parentInvoiceId: anyInv.parentInvoiceId,
        invoiceStatus: anyInv.invoiceStatus,
        invoiceType: anyInv.invoiceType,
        isCreditNote: isCreditNoteInv,
        isSuperseded: resolvedTotals.isSuperseded,
        supersededByInvoiceId: anyInv.supersededByInvoiceId,
        supersededByInvoiceNumber: anyInv.supersededByInvoiceNumber,
        supersededAt: anyInv.supersededAt,
        invoiceScope: resolveInvoiceScope(anyInv),
        customerName: inv.guestName,
        mobile: inv.mobile || inv.guestMobile || '',
        companyName: anyInv.companyName,
        gstNumber: inv.gstNumber || inv.guestGstNumber,
        roomNumbers: savedRoomNums.length > 0 ? savedRoomNums : [inv.roomNumber].filter(Boolean),
        checkInDateTime: inv.checkInDate,
        checkOutDateTime: inv.checkOutDate,
        bookedOnDateTime: inv.checkInDate,
        nights: derivedNights,
        roomCharges: r2(inv.roomCharges || 0),
        otherServicesCharges: otherSrv,
        foodCharges,
        waterCharges,
        laundryCharges,
        serviceCharges,
        extraBedCharges,
        extraPersonCharges,
        earlyCheckInCharges,
        lateCheckOutCharges,
        fineCharges,
        otherCharges: rawOtherCharges,
        subtotal: anyInv.subtotal !== undefined ? resolvedTotals.subtotal : undefined,
        discount: resolvedTotals.discount,
        taxableAmount: inv.taxableAmount !== undefined || Array.isArray(anyInv.taxRows) ? resolvedTotals.taxableAmount : undefined,
        cgst,
        sgst,
        totalTax,
        grandTotal: savedGrandTotal,
        amountPaid: savedPaid,
        balanceDue: savedPending,
        refundDue: resolvedTotals.refundDue > 0 ? resolvedTotals.refundDue : (anyInv.refundDue !== undefined ? r2(anyInv.refundDue) : undefined),
        paymentStatus,
        paymentMethod: (anyInv.paymentMethod as any) || 'UPI',
        createdAt: inv.dateCreated || inv.date || inv.checkOutDate,
        ledgerLines: anyInv.ledgerLines,
        taxRows: anyInv.taxRows,
        amountInWords: anyInv.amountInWords,
        billEngine: anyInv.billEngine,
      };
    });
    setInvoices(mappedInvoices);

    // Map housekeeping tasks from cleaningLogs
    const mappedTasks: HousekeepingTask[] = appCleaningLogs.map((cl) => {
      const matchedRm = mappedRooms.find((r) => r.number === cl.roomNumber);
      return {
        id: cl.id,
        roomId: `rm-${cl.roomNumber}`,
        roomName: `Room ${cl.roomNumber}`,
        roomNumber: cl.roomNumber,
        category: cl.category || matchedRm?.category || 'Standard',
        floor: cl.floor || matchedRm?.floor || '1st Floor',
        description: cl.notes || 'Room Cleaning & Sanitization',
        notes: cl.notes,
        priority: cl.priority || 'Normal',
        completedAt: cl.completedAt || cl.inspectedAt || cl.cleanedAt,
        inspectedBy: cl.inspectedBy,
        inspectedAt: cl.inspectedAt,
        taskType: cl.status === 'Inspection' ? 'Inspection' : 'Cleaning',
        assignedTo: cl.assignedStaff || 'Unassigned',
        timing: cl.assignedAt || (cl as any).date || '',
        status:
          cl.status === 'Cleaned' || cl.status === 'Inspected' || (cl.status as any) === 'Completed'
            ? 'Completed'
            : cl.status === 'Inspection'
            ? 'Inspection'
            : cl.status === 'In Progress'
            ? 'In Progress'
            : 'Pending',
        checklist: cl.checklistCompleted || ['Change bedsheets', 'Sanitize bathroom', 'Restock amenities'],
      };
    });
    setTasks(mappedTasks);

    // Map laundry
    setLaundryOrders(
      appLaundryOrders.map((lo) => ({
        id: lo.id,
        orderNumber: lo.orderNumber || lo.id,
        orderType: lo.orderType === 'Hotel Linen Laundry' ? 'Hotel Linen' : 'Guest Laundry',
        roomNumber: lo.roomNumber,
        guestName: lo.guestName,
        itemsSummary:
          (lo.items || [])
            .map((i) => `${i.quantity}x ${i.name || (i as any).itemName || 'Item'}`)
            .join(', ') ||
          lo.notes ||
          'Laundry',
        totalAmount: Number(lo.totalAmount) || 0,
        paymentStatus:
          lo.paymentStatus === 'Paid'
            ? 'Paid'
            : lo.paymentStatus === 'Billed to Room' || (lo as any).postToRoomBill
            ? 'Billed to Room'
            : 'Pending',
        deliveryStatus: (lo.deliveryStatus as any) || (lo as any).status || 'Pending',
        date: lo.date || (lo as any).createdAt || '',
        handledBy: lo.handledBy || (lo as any).assignedVendorOrStaff || 'Housekeeping',
      }))
    );

    // Map Lost & Found (preserving full Lost + Found + Matching + Audit schema)
    setLostFound(
      appLostAndFoundItems.map((lf) => ({
        id: lf.id,
        hotelId: lf.hotelId,
        recordType: lf.recordType || (String(lf.status || '').startsWith('Lost') ? 'lost' : 'found'),
        itemName: lf.itemName,
        category: lf.category || 'Others',
        description: lf.description,
        roomNumber: lf.roomNumber || lf.locationFound || 'Lobby',
        bookingId: lf.bookingId,
        checkInId: lf.checkInId,
        source: lf.source,
        locationFound: lf.locationFound,
        foundBy: lf.foundByStaff || (lf as any).foundBy || 'Staff',
        dateFound: lf.dateFound || (lf as any).foundDate || lf.dateReported || '',
        storageLocation: lf.storageLocation,
        guestName: lf.guestName,
        guestMobile: lf.guestMobile,
        guestEmail: lf.guestEmail,
        dateReported: lf.dateReported,
        lastSeenLocation: lf.lastSeenLocation,
        reportedByStaff: lf.reportedByStaff,
        matchedItemId: lf.matchedItemId,
        matchedItemName: lf.matchedItemName,
        matchedBy: lf.matchedBy,
        matchedAt: lf.matchedAt,
        matchNotes: lf.matchNotes,
        status:
          lf.status === 'Claimed' || (lf.status as any) === 'Returned'
            ? 'Returned to Guest'
            : lf.status === 'Disposed'
            ? 'Closed'
            : lf.status === 'Registered'
            ? (lf.recordType === 'lost' ? 'Lost – Reported' : 'Found – Registered')
            : (lf.status as any) || 'Found – Registered',
        claimedBy: lf.claimedByGuest || (lf as any).claimedBy || (lf as any).claimedByGuestName,
        claimGuestMobile: lf.claimGuestMobile,
        claimIdProof: lf.claimIdProof,
        claimDate: lf.claimDate,
        returnedBy: lf.returnedBy,
        returnNotes: lf.returnNotes,
        closedAt: lf.closedAt,
        closedBy: lf.closedBy,
        closedReason: lf.closedReason,
        createdAt: lf.createdAt,
        updatedAt: lf.updatedAt,
        auditHistory: lf.auditHistory,
      }))
    );

    // Map POS menu & orders
    setPosMenu(
      appPosItems.map((pi) => ({
        id: pi.id,
        code: pi.code || (pi as any).sku || pi.id.slice(-5).toUpperCase(),
        name: pi.name,
        category: (pi.category as any) || 'North Indian',
        subCategory: (pi as any).subCategory,
        price: Number(pi.price) || 0,
        costPrice: (pi as any).costPrice !== undefined ? Number((pi as any).costPrice) : undefined,
        taxRate: Number(pi.taxRate ?? (pi as any).gstRate) || 5,
        isVeg: (pi as any).isVeg !== false,
        available: pi.available !== false && (pi as any).isAvailable !== false,
        isActive: (pi as any).isActive !== false,
        image: pi.image,
        description: (pi as any).description,
        prepTime: (pi as any).prepTime !== undefined ? Number((pi as any).prepTime) : undefined,
        kitchenStation: (pi.kitchenStation as any) || 'Main Kitchen',
        variants: Array.isArray(pi.variants) ? pi.variants : undefined,
        addons: Array.isArray(pi.addons) ? pi.addons : undefined,
        modifiers: Array.isArray(pi.modifiers) ? pi.modifiers : undefined,
        mealWindows: Array.isArray((pi as any).mealWindows) ? (pi as any).mealWindows : undefined,
        stockTracking: Boolean((pi as any).stockTracking),
        currentStock: (pi as any).currentStock !== undefined ? Number((pi as any).currentStock) : undefined,
        recipeIngredients: Array.isArray((pi as any).recipeIngredients) ? (pi as any).recipeIngredients : undefined,
      }))
    );
    setPosOrders(
      appPosOrders.map((po) => {
        const anyPo = po as any;
        const resolvedPaySt: PosOrderRecord['paymentStatus'] =
          anyPo.paymentStatusDetail ||
          (po.paymentMethod === 'Room Charge' || anyPo.postToRoomBill
            ? 'Unpaid (Room Folio)'
            : po.paymentStatus === 'Paid'
            ? 'Paid'
            : (Number(anyPo.amountPaid) || 0) > 0
            ? 'Partially Paid'
            : 'Unpaid');
        return {
          id: po.id,
          orderNumber: po.orderNumber || po.id,
          orderType:
            po.orderType === 'Room Service' || po.orderType === 'Room Charge'
              ? 'Room Service'
              : po.orderType === 'Takeaway'
              ? 'Takeaway'
              : 'Dine In',
          roomNumber: po.roomNumber,
          roomName: po.roomNumber ? `Room ${po.roomNumber}` : undefined,
          bookingId: anyPo.bookingId,
          tableNumber: po.tableNo || anyPo.tableNumber,
          pax: anyPo.pax,
          waiterName: po.waiterName || anyPo.waiterName,
          customerName: po.guestName || 'Guest',
          customerPhone: po.customerPhone || anyPo.guestMobile || '',
          items: (po.items || []).map((it: any) => ({
            itemId: it.itemId,
            name: it.itemName || it.name || 'Item',
            qty: Number(it.quantity ?? it.qty) || 1,
            price: Number(it.price) || 0,
            total: Number(it.total) || (Number(it.quantity ?? it.qty) || 1) * (Number(it.price) || 0),
            menuPrice: it.menuPrice,
            overrideReason: it.overrideReason,
            variant: it.selectedVariant || it.variant,
            addons: it.selectedAddons || it.addons,
            addonPriceTotal: it.addonPriceTotal,
            kitchenStation: it.kitchenStation,
            itemNotes: it.itemNotes,
            itemDiscount: it.itemDiscount,
            itemStatus: it.itemStatus,
          })),
          subtotal: Number(po.subtotal) || 0,
          discount: Number(po.discount) || 0,
          packagingCharge: anyPo.packagingCharge ? Number(anyPo.packagingCharge) : undefined,
          taxAmount: Number(po.taxAmount ?? anyPo.gstAmount) || 0,
          grandTotal: Number(po.grandTotal ?? anyPo.totalAmount) || 0,
          paymentMethod: (po.paymentMethod as any) || 'Cash',
          paymentStatus: resolvedPaySt,
          kotStatus:
            (po.kitchenStatus as any) ||
            anyPo.kotStatus ||
            (po.status === 'Cancelled'
              ? 'Cancelled'
              : po.status === 'KOT Sent'
              ? 'KOT Sent'
              : 'Served'),
          instructions: po.notes || anyPo.instructions,
          dateTime: anyPo.createdAt || po.date || '',
          payments: Array.isArray(anyPo.payments) ? anyPo.payments : undefined,
          amountPaid: anyPo.amountPaid !== undefined ? Number(anyPo.amountPaid) : undefined,
          balanceDue: anyPo.balanceDue !== undefined ? Number(anyPo.balanceDue) : undefined,
          paymentSummary: anyPo.paymentSummary,
          isOpenCheck: Boolean(anyPo.isOpenCheck),
          isHeld: Boolean(po.isHeld || anyPo.isHeld),
          holdNote: po.holdNote || anyPo.holdNote,
          checkId: anyPo.checkId,
          kotNumber: anyPo.kotNumber,
          isSupplementaryKot: Boolean(anyPo.isSupplementaryKot),
          reprintCount: anyPo.reprintCount,
          pickupTime: anyPo.pickupTime,
          pickupStatus: anyPo.pickupStatus,
          advanceBookingId: anyPo.advanceBookingId,
          advanceDepositApplied: anyPo.advanceDepositApplied,
          isWithoutGst: Boolean(po.isWithoutGst),
          gstRate: anyPo.gstRate,
          customerGstin: anyPo.customerGstin,
          companyName: anyPo.companyName,
          voidedAt: anyPo.voidedAt,
          voidReason: anyPo.voidReason,
          voidedBy: anyPo.voidedBy,
          refundAmount: anyPo.refundAmount,
          discountMeta: anyPo.discountMeta,
          settlement: anyPo.settlement,
          priceOverrides: anyPo.priceOverrides,
          bomDeducted: Boolean(anyPo.bomDeducted),
          bomReversed: Boolean(anyPo.bomReversed),
          bomDeductionSnapshot: Array.isArray(anyPo.bomDeductionSnapshot) ? anyPo.bomDeductionSnapshot : undefined,
        };
      })
    );

    // Map Inventory
    setInventoryItems(
      appInventoryProducts.map((ip) => ({
        id: ip.id,
        code: ip.code || (ip as any).sku || ip.id.slice(-6).toUpperCase(),
        name: ip.name,
        category: (ip.category || (ip as any).categoryName || 'Housekeeping & Cleaning') as any,
        unit: (ip.unit as any) || 'Pcs',
        purchasePrice: Number(ip.purchasePrice ?? (ip as any).costPrice) || 0,
        currentStock: Number(ip.currentStock) || 0,
        minStock:
          ip.minimumStock !== undefined
            ? Number(ip.minimumStock)
            : (ip as any).minStockLevel !== undefined
            ? Number((ip as any).minStockLevel)
            : 5,
        supplierName: (ip as any).supplierName || 'Vendor',
        lastUpdated: ip.lastUpdated || new Date().toISOString().slice(0, 10),
      }))
    );
    setSuppliers(
      appInventorySuppliers.map((s) => ({
        id: s.id,
        name: s.name,
        category: (s as any).suppliedCategories?.[0] || 'General',
        contactPerson: (s as any).contactPerson || s.name,
        mobile: s.mobile || (s as any).phone || '',
        gstin: s.gst || (s as any).gstNumber || '',
        city: s.address || '',
        balancePayable: 0,
      }))
    );
    setPurchases(
      appInventoryPurchases.map((p) => ({
        id: p.id,
        poNumber: p.purchaseNumber || (p as any).invoiceNumber || p.id,
        supplierName: p.supplierName,
        itemsSummary: (p.items || []).map((i) => `${i.quantity}x ${i.productName}`).join(', '),
        totalAmount: Number(p.grandTotal ?? (p as any).totalAmount) || 0,
        status: 'Received',
        paymentStatus: p.paymentStatus === 'Paid' ? 'Paid' : p.paymentStatus === 'Partial' ? 'Partial' : 'Unpaid',
        date: p.date || (p as any).purchaseDate || '',
      }))
    );
    setStockMovements(
      appInventoryStockMovements.map((m) => ({
        id: m.id,
        date: m.date,
        productName: m.productName,
        type: m.type === 'IN' ? 'IN' : 'OUT',
        qty: Number(m.quantity) || 0,
        department: (m as any).department || 'Housekeeping',
        reason: m.reason || m.notes || '',
        handledBy: (m as any).performedBy || 'Staff',
      }))
    );

    // Map Finance
    setExpenses(
      appExpenses.map((e) => ({
        id: e.id,
        expenseNo: e.expenseNo || e.id,
        date: e.date,
        category: e.category,
        department: e.department || 'Operations',
        vendorName: e.vendorName || 'Vendor',
        description: e.description,
        amount: Number(e.amount) || 0,
        gstAmount: Number(e.gstAmount ?? e.taxAmount) || 0,
        paymentMethod: (e.paymentMethod as any) || 'Cash',
        approvalStatus: (e.approvalStatus as any) || 'Approved',
        recordedBy: e.createdBy || (e as any).recordedBy || 'Admin',
      }))
    );
    setVouchers(
      appVouchers.map((v) => ({
        id: v.id,
        voucherNo: v.voucherNumber || v.id,
        type:
          v.voucherType === 'Receipt Voucher' || (v.voucherType as any) === 'Receipt'
            ? 'Receipt Voucher'
            : 'Payment Voucher',
        date: v.date,
        partyName: v.partyName || 'Guest / Vendor',
        category: v.category || 'General',
        amount: Number(v.amount) || 0,
        paymentMethod: (v.paymentMethod || (v as any).paymentMode || 'Cash') as any,
        referenceNo: v.referenceNo || (v as any).referenceNumber || '',
        narration: v.narration || (v as any).description || '',
        preparedBy: v.preparedBy || (v as any).createdBy || 'Accounts',
        sourceType: (v as any).sourceType,
      }))
    );
    setAccounts(
      appCashBankAccounts.map((a) => ({
        id: a.id,
        accountName: a.accountName,
        accountType:
          a.accountType === 'Cash Drawer' || (a.accountType as any) === 'Cash'
            ? 'Cash Drawer'
            : a.accountType === 'UPI / Digital' || (a.accountType as any) === 'UPI'
            ? 'UPI Merchant'
            : a.accountType === 'POS Machine / Card'
            ? 'POS Card Terminal'
            : 'Bank Account',
        accountNumber: a.accountNumber || '',
        openingBalance: Number(a.openingBalance) || 0,
        inflowTotal: 0,
        outflowTotal: 0,
        currentBalance: Number(a.currentBalance) || 0,
        lastReconciled: a.lastReconciled || '',
      }))
    );
    setPettyCash(
      appPettyCash.map((pc) => ({
        id: pc.id,
        date: pc.date,
        type:
          pc.type === 'Inflow' || (pc.type as any) === 'Addition' || (pc.type as any) === 'Opening'
            ? 'Inflow'
            : 'Outflow',
        category: pc.category || 'Petty Cash',
        amount: Number(pc.amount) || 0,
        handler: pc.handler || (pc as any).handledBy || 'Front Desk',
        notes: pc.notes || (pc as any).description || '',
      }))
    );
    setOwnerPayments(
      appOwnerPayments.map((op) => ({
        id: op.id,
        date: op.date,
        directorName: op.directorName || (op as any).ownerName || 'Owner',
        type:
          op.type === 'Capital Injection' ||
          op.type === 'Capital Introduced' ||
          (op as any).paymentType === 'Capital Infusion'
            ? 'Capital Injection'
            : op.type === 'Director Remuneration'
            ? 'Director Remuneration'
            : op.type === 'Profit Distribution'
            ? 'Profit Distribution'
            : 'Owner Withdrawal / Drawing',
        amount: Number(op.amount) || 0,
        paymentMethod: (op.paymentMethod || (op as any).paymentMode || 'Bank Transfer') as any,
        referenceNo: op.referenceNo || '',
        notes: op.notes || '',
      }))
    );
    setReimbursements(
      appReimbursements.map((r) => ({
        id: r.id,
        date: r.date,
        staffName: r.staffName,
        department: r.staffRole || (r as any).department || 'Operations',
        title: r.expenseTitle || (r as any).description || r.category || 'Staff Expense',
        amount: Number(r.amount) || 0,
        status: r.status === 'Paid' ? 'Paid' : r.status === 'Approved' ? 'Approved' : 'Pending',
      }))
    );
    setDailyClosings(
      appDailyClosings.map((dc) => ({
        id: dc.id,
        date: dc.date,
        openingCash: Number(dc.openingCash) || 0,
        roomCashIn: Number(dc.roomCashCollected ?? (dc as any).cashSales) || 0,
        posCashIn: Number(dc.posCashCollected) || 0,
        cashExpensesOut:
          (Number(dc.expensesPaidInCash ?? (dc as any).cashExpenses) || 0) +
          (Number(dc.pettyCashOutflow) || 0),
        expectedClosing: Number(dc.expectedClosingCash ?? dc.closingCashSystem) || 0,
        physicalCounted: Number(dc.physicalCashCounted ?? dc.closingCashActual ?? (dc as any).actualClosingCash) || 0,
        discrepancy: Number(dc.discrepancy ?? dc.cashMismatch) || 0,
        closedBy: dc.closedBy || 'Reception',
        status: (dc.discrepancy ?? 0) === 0 ? 'Balanced' : 'Discrepancy Logged',
      }))
    );

    // Map Staff
    setStaff(
      appStaff.map((s) => {
        const anyS = s as any;
        return {
          id: s.id,
          name: s.name,
          role: (s.designation as any) || (s.role as any) || 'Receptionist',
          department: (s.department as any) || 'Front Office',
          mobile: s.mobile || anyS.phone || '',
          username: s.username || s.name.toLowerCase().replace(/\s+/g, '.'),
          password: s.plainPassword || s.password || `${s.name.split(' ')[0]}@123`,
          shift: (anyS.shift || s.shiftTiming || 'Morning (7AM–3PM)') as any,
          salary: Number(s.salary) || 0,
          joiningDate: s.joiningDate || anyS.joinDate || '',
          status: s.status === 'Active' ? 'Active' : 'On Leave',
          checkInsHandled: Number(s.checkInsCount) || 0,
          roomsCleaned: Number(s.roomsCleanedCount) || 0,
        };
      })
    );

    // Map Water Bottles (reads BOTH legacy & hub fields so 0-bottle bugs never happen!)
    setWaterLogs(
      appWaterBottles
        .filter((w) => w.recordType !== 'service_catalog' && w.recordType !== 'service_allocation')
        .map((w) => {
          const anyW = w as any;
          const chgCount =
            anyW.extraChargeableCount !== undefined
              ? Number(anyW.extraChargeableCount) || 0
              : w.isChargeable
              ? Number(w.quantity) || 0
              : 0;
          const compCount =
            anyW.complimentaryCount !== undefined
              ? Number(anyW.complimentaryCount) || 0
              : w.isChargeable
              ? 0
              : Number(w.quantity) || 0;
          const totalQty = Number(w.quantity) || compCount + chgCount;
          const amt = r2(w.chargeAmount ?? w.totalAmount ?? anyW.totalCharge ?? 0);
          const isChg = Boolean(w.isChargeable === true || chgCount > 0 || amt > 0);
          const rate =
            Number(w.unitPrice ?? anyW.ratePerBottle) ||
            (chgCount > 0 ? r2(amt / chgCount) : billSettings.waterBottleRate);
          return {
            id: w.id,
            date: w.date,
            dateTime: w.dateTime || w.date,
            roomNumber: w.roomNumber,
            bookingId: w.bookingId,
            checkInId: w.checkInId || w.checkinId,
            guestName: w.guestName || 'Guest',
            qty: totalQty,
            complimentaryCount: compCount,
            extraChargeableCount: chgCount,
            ratePerBottle: rate,
            isChargeable: isChg,
            amount: amt,
            deliveredBy: w.deliveredBy || anyW.suppliedBy || 'Front Desk',
          };
        })
    );

    // Map Audit Logs
    setAuditLogs(
      appAuditLogs.map((a) => ({
        id: a.id,
        timestamp: a.dateTime ? new Date(a.dateTime).toLocaleString('en-IN') : '',
        actorName: a.performedBy || a.actorUsername || 'User',
        actorRole: a.actorRole || currentRole,
        module: 'PMS',
        action: a.action,
        details: a.details,
        severity: a.outcome === 'failed' || (a.outcome as string) === 'failure' ? 'warning' : 'info',
      }))
    );
  }, [
    selectedHotelId,
    billSettings,
    appRooms,
    appBookings,
    appCheckins,
    appInvoices,
    appExpenses,
    appStaff,
    appAuditLogs,
    appWaterBottles,
    appPosItems,
    appPosOrders,
    appInventoryProducts,
    appInventorySuppliers,
    appInventoryPurchases,
    appInventoryStockMovements,
    appPettyCash,
    appCashBankAccounts,
    appVouchers,
    appOwnerPayments,
    appReimbursements,
    appDailyClosings,
    appLaundryOrders,
    appLostAndFoundItems,
    appCleaningLogs,
    currentRole,
  ]);

  // Global Modals & Drawers State
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState<'reservations' | 'walkin'>('reservations');
  const [preselectedRoom, setPreselectedRoom] = useState<RoomAsset | null>(null);
  const [draftBookingSeed, setDraftBookingSeed] = useState<{
    checkInDate: string;
    checkOutDate: string;
    isOpenStay?: boolean;
    numGuests: number;
    extraBeds?: number;
    extraPersonRate?: number;
    withGst?: boolean;
    gstRate?: number;
    preselectedRoom?: RoomAsset;
    requirements?: BookedCategoryRequirement[];
    editingBooking?: BookingRecord;
  } | null>(null);

  const [selectedBookingForDrawer, setSelectedBookingForDrawer] = useState<BookingRecord | null>(null);
  const [checkInBooking, setCheckInBooking] = useState<BookingRecord | null>(null);
  const [checkoutClearanceBooking, setCheckoutClearanceBooking] = useState<BookingRecord | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<BookingRecord | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [invoiceModalState, setInvoiceModalState] = useState<{
    booking: BookingRecord;
    scope: InvoiceScope;
    invoiceRecord?: InvoiceRecord;
  } | null>(null);
  const [previewDocState, setPreviewDocState] = useState<{
    guest: GuestPerson;
    bookingNo: string;
  } | null>(null);
  const [roomTasksDrawerRoom, setRoomTasksDrawerRoom] = useState<RoomAsset | null>(null);
  const [isRoomTasksOpen, setIsRoomTasksOpen] = useState(false);
  const [roomOrderBooking, setRoomOrderBooking] = useState<BookingRecord | null>(null);

  const handleRedirectToFullCheckInPage = (b: BookingRecord) => {
    const matchedExisting = appBookings.find(
      (ab) =>
        ab.id === b.id ||
        ab.id === b.bookingNo ||
        ab.id.replace(/^#/, '') === String(b.bookingNo || '').replace(/^#/, '')
    );
    const targetAppBooking = matchedExisting || mapRecordToAppBooking(b, selectedHotelId);
    setSelectedBookingForDrawer(null);
    setCheckInBooking(null);
    if (setSelectedBookingForCheckin) {
      setSelectedBookingForCheckin(targetAppBooking);
    } else {
      setActiveTab('frontDesk');
      setFrontDeskSubTab('checkin');
      try {
        if (window.location.pathname !== '/admin/frontDesk/checkin') {
          window.history.pushState({}, '', '/admin/frontDesk/checkin');
        }
      } catch {
        // ignore
      }
    }
  };

  const syncRoomsToDb = (nextRooms: RoomAsset[]) => {
    setRooms(nextRooms);
    if (onUpdateRooms) {
      onUpdateRooms(nextRooms.map((rm) => mapAssetToAppRoom(rm, selectedHotelId)));
    }
  };

  const syncBookingsToDb = (nextBookings: BookingRecord[]) => {
    setBookings(nextBookings);
    if (onUpdateBookings) {
      onUpdateBookings(
        nextBookings.map((b) =>
          mapRecordToAppBooking(
            b,
            selectedHotelId,
            appBookings.find((ab) => ab.id === b.id)
          )
        )
      );
    }
    if (onUpdateCheckins && appCheckins.length > 0) {
      const updatedCheckins = appCheckins.map((c) => {
        const matchedBkg = nextBookings.find(
          (b) => b.id === c.id || b.bookingNo === c.id || (c as any).bookingId === b.id
        );
        if (!matchedBkg) return c;
        const pri = matchedBkg.guests?.[0];

        // Merge any newly added payments from matchedBkg without duplicating existing payment IDs (BUG-P2-04)
        const existingPayments = Array.isArray(c.payments) ? [...c.payments] : [];
        const existingPayIds = new Set(existingPayments.map((p: any) => String(p?.id || '')).filter(Boolean));
        const existingPaySigs = new Set(
          existingPayments.map((p: any) => `${String(p?.paymentMethod || '').toLowerCase()}|${r2(p?.amount || 0)}|${String(p?.date || p?.dateTime || '').slice(0, 10)}`)
        );
        const syncedPayments = [...existingPayments];
        (Array.isArray(matchedBkg.payments) ? matchedBkg.payments : []).forEach((mp) => {
          const mpId = String(mp?.id || '').trim();
          const mpAmt = r2(mp?.amount || 0);
          if (mpAmt === 0) return;
          if (mpId && existingPayIds.has(mpId)) return;
          const sig = `${String(mp?.paymentMethod || '').toLowerCase()}|${mpAmt}|${String(mp?.date || '').slice(0, 10)}`;
          if (existingPaySigs.has(sig) && mpId.startsWith('pay-adv-')) return;
          if (mpId) existingPayIds.add(mpId);
          existingPaySigs.add(sig);
          syncedPayments.push({
            id: mpId || `PAY-SYNC-${Date.now()}`,
            amount: mpAmt,
            paymentMethod: (mp.paymentMethod as any) || 'Cash',
            paymentType: (matchedBkg.isCheckedOut ? 'Final Settlement' : 'Partial Payment') as any,
            dateTime: mp.date ? `${mp.date}T12:00:00` : new Date().toISOString(),
            date: String(mp.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
            notes: mp.notes || (matchedBkg.isCheckedOut ? 'Checkout Settlement' : 'Payment Recorded'),
          } as any);
        });

        // Merge any newly added checkout/folio extra services without duplicating existing extraCharges (BUG-P2-04)
        const existingExtras = Array.isArray(c.extraCharges) ? [...c.extraCharges] : [];
        const existingExtraKeys = new Set(
          existingExtras
            .flatMap((ec: any) => [String(ec?.id || ''), String(ec?.sourceId || '')])
            .filter(Boolean)
        );
        const syncedExtras = [...existingExtras];
        (Array.isArray(matchedBkg.otherServices) ? matchedBkg.otherServices : []).forEach((sv) => {
          const svId = String(sv?.id || '').trim();
          const svOrd = String(sv?.orderNumber || '').trim();
          const svAmt = r2(sv?.amount || 0);
          if (svAmt <= 0) return;
          if (svId && (existingExtraKeys.has(svId) || svId.startsWith('EC-WB-') || svId.startsWith('EC-POS-') || svId.startsWith('EC-LND-'))) return;
          if (svOrd && existingExtraKeys.has(svOrd)) return;
          const stUpper = String(sv.serviceType || '').toUpperCase();
          const cat: any =
            stUpper === 'LAUNDRY'
              ? 'Laundry'
              : stUpper.includes('WATER')
              ? 'Water Bottle'
              : stUpper.includes('DAMAGE') || stUpper.includes('FINE')
              ? 'Damage'
              : stUpper === 'POS_FOOD' || stUpper === 'ROOM SERVICE'
              ? 'Food'
              : 'Other';
          if (svId) existingExtraKeys.add(svId);
          syncedExtras.push({
            id: svId || `ec-sync-${Date.now()}`,
            category: cat,
            description: sv.description || sv.itemsSummary || sv.serviceType || 'Extra Service',
            amount: svAmt,
            dateTime: sv.dateTime || new Date().toISOString(),
          });
        });

        return {
          ...c,
          status: matchedBkg.isCheckedOut ? ('Checked Out' as const) : c.status,
          checkedOutDateTime: matchedBkg.isCheckedOut
            ? c.checkedOutDateTime || new Date().toISOString()
            : c.checkedOutDateTime,
          idType: (pri?.documentType as any) || c.idType,
          idNumber: pri?.documentNumber || c.idNumber,
          idProofFileData: pri?.documentImageUrl || c.idProofFileData,
          gstRate: matchedBkg.gstInvoice && matchedBkg.taxRate > 0 ? matchedBkg.taxRate : 0,
          gstAmount: matchedBkg.gstInvoice && matchedBkg.taxRate > 0 ? matchedBkg.taxAmount : 0,
          isWithoutGst: !matchedBkg.gstInvoice || matchedBkg.taxRate <= 0,
          discount: r2(matchedBkg.discountAmount || 0),
          discountAmount: r2(matchedBkg.discountAmount || 0),
          totalAmount: r2(matchedBkg.totalPayable || c.totalAmount || 0),
          pendingAmount: r2(matchedBkg.dueAmount ?? c.pendingAmount ?? 0),
          payments: syncedPayments,
          extraCharges: syncedExtras,
        };
      });
      onUpdateCheckins(updatedCheckins);
    }
  };

  const handleUpdateGuestDocument = (
    bookingNoOrId: string,
    guestId: string,
    updates: Partial<GuestPerson>
  ) => {
    const nextBookings = bookings.map((b) => {
      if (b.id !== bookingNoOrId && b.bookingNo !== bookingNoOrId) return b;
      const updatedGuests = b.guests.map((g) => (g.id === guestId ? { ...g, ...updates } : g));
      const updatedBkg: BookingRecord = {
        ...b,
        guests: updatedGuests,
      };
      if (selectedBookingForDrawer?.id === b.id) {
        setSelectedBookingForDrawer(updatedBkg);
      }
      return updatedBkg;
    });
    syncBookingsToDb(nextBookings);
    setPreviewDocState((prev) =>
      prev && prev.guest.id === guestId
        ? { ...prev, guest: { ...prev.guest, ...updates } }
        : prev
    );
    logAudit(
      'Front Desk',
      'Guest Identity Document Updated',
      `Updated ID document (${updates.documentType || 'ID'}) for booking ${bookingNoOrId}.`,
      'success'
    );
  };

  const logAudit = (
    module: string,
    action: string,
    details: string,
    severity: AuditLogEntry['severity'] = 'info'
  ) => {
    setAuditLogs((prev) => [
      {
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toLocaleString('en-IN'),
        actorName: loggedInUser || currentRole,
        actorRole: currentRole,
        module,
        action,
        details,
        severity,
      },
      ...prev,
    ]);
    if (onAddAuditLog) {
      onAddAuditLog(`${module}: ${action}`, details);
    }
  };

  const handleNavigate = (mod: string, subTab?: string) => {
    const normalized = mod === 'front_desk' ? 'frontDesk' : mod;
    if (normalized === 'pos') {
      const isAlreadyInStandalonePos =
        typeof window !== 'undefined' &&
        window.location.pathname.toLowerCase().startsWith('/pos');
      if (!isAlreadyInStandalonePos) {
        openStandalonePosInNewTab(subTab || 'terminal', selectedHotelId);
        return;
      }
      setActiveTab('pos');
      if (subTab) setPosSubTab(subTab);
      return;
    }
    setActiveTab(normalized);
    if (normalized === 'frontDesk' && subTab) setFrontDeskSubTab(subTab);
    if (normalized === 'finance' && subTab) setFinanceSubTab(subTab);
    if (normalized === 'rooms' && subTab) setRoomSubTab(subTab);
    if (normalized === 'housekeeping' && subTab) setHousekeepingSubTab(subTab);
    if (normalized === 'reports' && subTab) setReportsSubTab(subTab);
    if (normalized === 'staff' && subTab && setStaffSubTab) setStaffSubTab(subTab);
  };

  // 1. Save or Update Full Booking (Step 1 / Step 2)
  const handleSaveFullBooking = (newBooking: BookingRecord, isEdit: boolean) => {
    if (isEdit) {
      const nextBookings = bookings.map((b) => (b.id === newBooking.id ? newBooking : b));
      syncBookingsToDb(nextBookings);
      if (selectedBookingForDrawer?.id === newBooking.id) {
        setSelectedBookingForDrawer(newBooking);
      }
      logAudit(
        'Front Desk',
        'Booking Updated',
        `Updated Booking ${newBooking.bookingNo} for ${newBooking.customerName}.`,
        'info'
      );
    } else {
      const nextBookings = [newBooking, ...bookings];
      syncBookingsToDb(nextBookings);
      const nextRooms = rooms.map((rm) =>
        newBooking.roomNumbers.includes(rm.number)
          ? {
              ...rm,
              status: (newBooking.isCheckedIn ? 'Occupied' : 'Confirmed') as RoomAsset['status'],
              currentBookingId: newBooking.id,
              currentGuestName: newBooking.customerName,
              currentNights: newBooking.nights,
            }
          : rm
      );
      syncRoomsToDb(nextRooms);
      logAudit(
        'Front Desk',
        'New Booking Created',
        `Created Booking ${newBooking.bookingNo} (${newBooking.customerName}) for Room(s) ${newBooking.roomNumbers.join(', ')} with ${newBooking.taxRate}% GST.`,
        'success'
      );
    }

    if (isValidEmailAddress(newBooking.email)) {
      const mappedForEmail = mapRecordToAppBooking(newBooking, selectedHotelId);
      void triggerBookingEmail(mappedForEmail, {
        hotelId: selectedHotelId,
        hotelName: hotelName || hotelSettings?.name || 'DirectStay Hotel',
        eventType: isEdit ? 'booking_updated' : 'booking_confirmation',
      });
    }
  };

  // Helper: Find existing active non-superseded invoice for a booking
  const findPrimaryInvoiceForBooking = (b: BookingRecord | null | undefined): InvoiceRecord | undefined => {
    if (!b) return undefined;
    return (
      invoices.find(
        (inv) =>
          !inv.id.startsWith('FOLIO-') &&
          isActiveInvoice(inv) &&
          !inv.isSeparateInvoice &&
          (inv.bookingId === b.id || inv.bookingNo === b.bookingNo)
      ) ||
      invoices.find(
        (inv) =>
          !inv.id.startsWith('FOLIO-') &&
          isActiveInvoice(inv) &&
          (inv.bookingId === b.id || inv.bookingNo === b.bookingNo)
      )
    );
  };

  // Option A: Generate Official / Split-Scope Separate / Replacement Invoice without overlapping charges or phantom refunds
  const handleCreateSeparateInvoiceInHub = (
    targetBkg: BookingRecord,
    scope: InvoiceScope,
    withGst: boolean,
    requestedGstRate: number,
    confirmedRefundAmount = 0
  ) => {
    void requestedGstRate;
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const newInvId = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const { invoiceNumber: newInvNumber } = allocateInvoiceNumber(appInvoices, billSettings);

    const rawAppBkg = appBookings.find((ab) => ab.id === targetBkg.id);
    const linkedCheckin = appCheckins.find(
      (c) =>
        c.id === targetBkg.id ||
        (c as any).bookingId === targetBkg.id ||
        c.id === targetBkg.bookingNo
    );

    const stay = buildStayBill({
      booking: rawAppBkg || targetBkg,
      checkin: linkedCheckin || null,
      posOrders: appPosOrders,
      laundryOrders: appLaundryOrders,
      waterBottles: appWaterBottles,
      rooms: appRooms,
      settings: billSettings,
      gstEnabledOverride: withGst,
    });

    const existingForStay = invoices.filter(
      (inv) =>
        !inv.id.startsWith('FOLIO-') &&
        (inv.bookingId === targetBkg.id || inv.bookingNo === targetBkg.bookingNo)
    );

    const reconciled = reconcileScopedStayInvoice({
      folio: stay.folio,
      scope,
      withGst,
      settings: billSettings,
      existingInvoicesForStay: existingForStay,
      confirmedRefundAmount,
    });

    if (reconciled.scopedCharges.length === 0) {
      logAudit(
        'Invoice Center',
        'Invoice Scope Empty',
        `Cannot generate "${scope}" invoice for Booking #${targetBkg.bookingNo}: no charges exist in that scope.`,
        'warning'
      );
      return;
    }

    const finalBill = reconciled.bill;
    const supersededSet = new Set(reconciled.supersededInvoiceIds);
    const hasRetainedSplitInvoices = reconciled.retainedActiveInvoices.length > 0;
    const existingParent = findPrimaryInvoiceForBooking(targetBkg);
    const isSeparate = hasRetainedSplitInvoices;

    const safeRoomNums =
      stay.folio.roomNumbers.length > 0
        ? stay.folio.roomNumbers
        : Array.isArray(targetBkg.roomNumbers) && targetBkg.roomNumbers.length > 0
        ? targetBkg.roomNumbers
        : ['101'];

    const roomTotal = reconciled.roomChargesTotal;
    const srvTotal = reconciled.otherServicesTotal;

    const newInvoiceRecord: InvoiceRecord = {
      id: newInvId,
      invoiceNumber: newInvNumber,
      bookingId: targetBkg.id,
      bookingNo: targetBkg.bookingNo,
      gstRate: finalBill.headlineGstRate,
      isWithoutGst: !finalBill.isGstInvoice,
      isSeparateInvoice: isSeparate,
      parentInvoiceId: existingParent?.id,
      invoiceStatus: 'Finalized',
      isSuperseded: false,
      invoiceScope: scope,
      customerName: targetBkg.customerName,
      mobile: targetBkg.mobile || '',
      companyName: targetBkg.companyName,
      gstNumber: finalBill.isGstInvoice ? targetBkg.companyGst : undefined,
      roomNumbers: safeRoomNums,
      checkInDateTime: targetBkg.checkInDate,
      checkOutDateTime: targetBkg.checkOutDate,
      bookedOnDateTime: targetBkg.bookedOn || targetBkg.checkInDate,
      nights: stay.folio.nights,
      roomCharges: roomTotal,
      otherServicesCharges: srvTotal,
      foodCharges: finalBill.legacy.foodCharges,
      waterCharges: finalBill.legacy.waterCharges,
      laundryCharges: finalBill.legacy.laundryCharges,
      serviceCharges: finalBill.legacy.serviceCharges,
      extraBedCharges: finalBill.legacy.extraBedCharges,
      extraPersonCharges: finalBill.legacy.extraPersonCharges,
      earlyCheckInCharges: finalBill.legacy.earlyCheckInCharges,
      lateCheckOutCharges: finalBill.legacy.lateCheckOutCharges,
      fineCharges: finalBill.legacy.fineCharges,
      otherCharges: r2(finalBill.legacy.otherCharges + finalBill.legacy.fineCharges),
      subtotal: finalBill.subtotal,
      discount: finalBill.discount,
      taxableAmount: finalBill.taxableAmount,
      cgst: finalBill.cgst,
      sgst: finalBill.sgst,
      totalTax: finalBill.totalTax,
      grandTotal: finalBill.grandTotal,
      amountPaid: finalBill.receipts,
      balanceDue: finalBill.balance,
      refundDue: finalBill.refundDue,
      paymentStatus: finalBill.paymentStatus,
      paymentMethod: (targetBkg.payments[0]?.paymentMethod as any) || 'UPI',
      createdAt: todayStr,
      ledgerLines: finalBill.lines,
      taxRows: finalBill.taxRows,
      amountInWords: finalBill.amountInWords,
      billEngine: 'v2',
    };

    setInvoices((prev) => [
      newInvoiceRecord,
      ...prev.map((inv) =>
        supersededSet.has(inv.id)
          ? {
              ...inv,
              invoiceStatus: 'Superseded' as const,
              isSuperseded: true,
              supersededByInvoiceId: newInvId,
              supersededByInvoiceNumber: newInvNumber,
              supersededAt: nowIso,
            }
          : inv
      ),
    ]);

    // When superseding a Full-Bill invoice to switch GST <-> No-GST, keep BookingRecord tax & payment totals synchronized
    let reconciledBooking = targetBkg;
    if (scope === 'Booking + Other Services' && supersededSet.size > 0) {
      const reconciledPayments: PaymentRecordItem[] = reconciled.allocatedPayments.map((ap, idx) => ({
        id: ap.id || `PAY-REC-${idx}`,
        bookingId: targetBkg.id,
        amount: r2(ap.amount),
        paymentMethod: (ap.method as PaymentMethod) || 'UPI',
        transactionId: ap.reference || `TXN-${idx + 1}`,
        date: ap.date || todayStr,
        time: '',
        recordedBy: loggedInUser || 'Admin',
        notes: ap.note || 'Stay Receipt',
      }));
      if (finalBill.refundDue > 0) {
        reconciledPayments.push({
          id: `REF-REC-${Date.now()}`,
          bookingId: targetBkg.id,
          amount: -r2(finalBill.refundDue),
          paymentMethod: reconciledPayments[0]?.paymentMethod || 'UPI',
          transactionId: `REF-${Date.now().toString().slice(-6)}`,
          date: todayStr,
          time: '',
          recordedBy: loggedInUser || 'Admin',
          notes: 'Confirmed refund on tax-mode re-issue',
        });
      }
      reconciledBooking = {
        ...targetBkg,
        gstInvoice: finalBill.isGstInvoice,
        taxRate: finalBill.headlineGstRate,
        taxAmount: finalBill.totalTax,
        totalPayable: finalBill.grandTotal,
        amountPaid: finalBill.receipts,
        dueAmount: finalBill.balance,
        refundAmount: finalBill.refundDue,
        paymentStatus:
          finalBill.refundDue > 0 && finalBill.balance <= 0
            ? 'Refunded'
            : finalBill.paymentStatus === 'Paid'
            ? 'Fully Paid'
            : finalBill.paymentStatus,
        payments: reconciledPayments,
      };
      syncBookingsToDb(bookings.map((b) => (b.id === reconciledBooking.id ? reconciledBooking : b)));
    }

    if (onUpdateInvoices) {
      const newAppInvoice = buildInvoiceRecord({
        id: newInvId,
        invoiceNumber: newInvNumber,
        hotelId: selectedHotelId,
        bookingId: targetBkg.id,
        checkInId: linkedCheckin?.id,
        guestName: targetBkg.customerName,
        guestMobile: targetBkg.mobile,
        guestAddress: targetBkg.address,
        companyName: targetBkg.companyName,
        guestGstNumber: targetBkg.companyGst,
        roomNumbers: safeRoomNums,
        checkInDate: targetBkg.checkInDate,
        checkOutDate: targetBkg.checkOutDate,
        nights: stay.folio.nights,
        bill: finalBill,
        paymentMethod: (targetBkg.payments[0]?.paymentMethod as any) || 'UPI',
        isSeparateInvoice: isSeparate,
        parentInvoiceId: existingParent?.id,
        invoiceScope: scope,
        dateCreated: todayStr,
        invoiceStatus: 'Finalized',
        extra: { bookingNo: targetBkg.bookingNo, isFinalInvoice: true },
      }) as Invoice;

      const updatedAppInvoices = appInvoices.map((inv) =>
        supersededSet.has(inv.id)
          ? ({
              ...inv,
              invoiceStatus: 'Superseded',
              isSuperseded: true,
              supersededByInvoiceId: newInvId,
              supersededByInvoiceNumber: newInvNumber,
              supersededAt: nowIso,
            } as Invoice)
          : inv
      );
      onUpdateInvoices([newAppInvoice, ...updatedAppInvoices]);
    }

    const supersededNumbers = existingForStay
      .filter((i) => supersededSet.has(i.id))
      .map((i) => i.invoiceNumber)
      .join(', ');

    logAudit(
      'Invoice Center',
      supersededSet.size > 0
        ? 'Invoice Superseded & Re-Issued'
        : isSeparate
        ? 'Split-Scope Separate Invoice Generated'
        : 'Official Invoice Generated',
      `Generated Invoice ${newInvNumber} [${scope}, ${
        finalBill.isGstInvoice ? `With GST ${finalBill.headlineGstRate}%` : 'No GST 0%'
      }] for Booking #${targetBkg.bookingNo} (${targetBkg.customerName})${
        supersededNumbers ? ` — Superseded ${supersededNumbers} (audit preserved)` : ''
      }.`,
      'success'
    );

    setInvoiceModalState({
      booking: reconciledBooking,
      scope,
      invoiceRecord: newInvoiceRecord,
    });
  };

  // 2. Confirm Guest Check-In (Uses Single Bill Calculator + Settings GST %)
  const handleConfirmCheckIn = (
    bookingId: string,
    verifiedGuests: GuestPerson[],
    checkInTimeStr: string,
    withGst?: boolean,
    gstRate?: number
  ) => {
    void gstRate;
    let targetBooking: BookingRecord | undefined;
    const existingInv = invoices.find(
      (inv) => !inv.id.startsWith('FOLIO-') && (inv.bookingId === bookingId || inv.bookingNo === bookingId)
    );
    const nextBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      const effectiveGstEnabled = !existingInv && withGst !== undefined ? withGst : b.gstInvoice;
      const rawAppBkg = appBookings.find((ab) => ab.id === b.id);
      const linkedCheckin = appCheckins.find(
        (c) => c.id === b.id || (c as any).bookingId === b.id
      );
      const { bill } = buildStayBill({
        booking: rawAppBkg || b,
        checkin: linkedCheckin || null,
        posOrders: appPosOrders,
        laundryOrders: appLaundryOrders,
        waterBottles: appWaterBottles,
        rooms: appRooms,
        settings: billSettings,
        gstEnabledOverride: effectiveGstEnabled,
      });

      const updated: BookingRecord = {
        ...b,
        status: 'Checked In',
        isCheckedIn: true,
        checkInTime: checkInTimeStr,
        guests: verifiedGuests,
        gstInvoice: effectiveGstEnabled,
        taxRate: bill.headlineGstRate,
        taxAmount: bill.totalTax,
        totalPayable: bill.grandTotal,
        dueAmount: bill.balance,
        paymentStatus: bill.paymentStatus === 'Paid' ? 'Fully Paid' : bill.paymentStatus,
      };
      targetBooking = updated;
      return updated;
    });
    syncBookingsToDb(nextBookings);

    if (targetBooking) {
      const tb = targetBooking;
      const nextRooms = rooms.map((rm) =>
        tb.roomNumbers.includes(rm.number)
          ? {
              ...rm,
              status: 'Occupied' as RoomAsset['status'],
              currentBookingId: tb.id,
              currentGuestName: tb.customerName,
              currentNights: tb.nights,
            }
          : rm
      );
      syncRoomsToDb(nextRooms);
      if (selectedBookingForDrawer?.id === tb.id) {
        setSelectedBookingForDrawer(tb);
      }
      logAudit(
        'Front Desk',
        'Guest Checked In',
        `Checked in ${tb.customerName} (${verifiedGuests.length} guests verified) into Room(s) ${tb.roomNumbers.join(', ')}.`,
        'success'
      );
    }
    setCheckInBooking(null);
  };

  // 3. Complete Guest Checkout (Single Bill Calculator + buildInvoiceRecord + allocateInvoiceNumber — fixes C1 & H8!)
  const handleCompleteCheckoutClearance = (payload: {
    bookingId: string;
    addedServices: BookingRecord['otherServices'];
    updatedDiscount: number;
    withGst?: boolean;
    roomRateIncludesGst?: boolean;
    updatedGstRate: number;
    paymentsToRecord: Array<{
      amount: number;
      method: PaymentMethod;
      referenceNo: string;
      notes: string;
    }>;
    refundAmount: number;
    isFoodRoomSplitSettled?: boolean;
  }) => {
    const targetBkg = bookings.find((b) => b.id === payload.bookingId);
    if (!targetBkg) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const newPaymentItems: PaymentRecordItem[] = payload.paymentsToRecord.map((p, idx) => ({
      id: `PAY-CO-${Date.now()}-${idx}`,
      bookingId: targetBkg.id,
      amount: r2(p.amount),
      paymentMethod: p.method,
      transactionId: p.referenceNo || `TXN-${Date.now()}`,
      date: todayStr,
      time: nowTimeStr,
      recordedBy: loggedInUser || 'Reception Desk',
      notes: p.notes,
    }));

    const existingPrimaryInv = findPrimaryInvoiceForBooking(targetBkg);
    const lockedExistingNoGst = existingPrimaryInv
      ? existingPrimaryInv.isWithoutGst === true ||
        (existingPrimaryInv.gstRate !== undefined && Number(existingPrimaryInv.gstRate) <= 0) ||
        (existingPrimaryInv.gstRate === undefined && Number(existingPrimaryInv.totalTax || 0) <= 0)
      : false;

    const effectiveGstEnabled = existingPrimaryInv
      ? !lockedExistingNoGst
      : payload.withGst !== undefined
      ? payload.withGst
      : Number(payload.updatedGstRate) > 0;

    // Map ONLY newly added checkout charges to BillCharge[] (never duplicating existingServices!)
    const existingIds = new Set((targetBkg.otherServices || []).map((s) => s.id));
    const trulyNewServices = (payload.addedServices || []).filter((s) => !existingIds.has(s.id));

    const additionalCharges: BillCharge[] = trulyNewServices.map((s) => {
      const sv = String(s.serviceType || '').toLowerCase();
      const d = String(s.description || '').toLowerCase();
      const kind: BillChargeKind =
        sv.includes('damage') || sv.includes('fine') || d.includes('fine')
          ? 'fine'
          : sv.includes('room service') || sv.includes('food')
          ? 'food'
          : sv.includes('laundry')
          ? 'laundry'
          : sv.includes('water')
          ? 'water'
          : sv.includes('extra bed')
          ? 'extra_bed'
          : d.includes('late check')
          ? 'late_checkout'
          : 'service';
      return {
        id: s.id,
        kind,
        description: s.description,
        amount: r2(s.amount),
        date: todayStr,
        roomNumber: s.roomNumber || targetBkg.roomNumbers[0] || '',
        sourceKey: `chk:${s.id}`,
      };
    });

    const additionalPayments: BillPayment[] = newPaymentItems.map((np) => ({
      id: np.id,
      amount: r2(np.amount),
      method: np.paymentMethod,
      date: np.date,
      reference: np.transactionId,
      note: np.notes,
    }));
    if (payload.refundAmount > 0) {
      additionalPayments.push({
        id: `REF-CO-${targetBkg.id}`,
        amount: -r2(payload.refundAmount),
        method: newPaymentItems[0]?.paymentMethod || 'Cash',
        date: todayStr,
        note: 'Checkout Excess Advance Refund',
      });
    }

    const rawAppBkg = appBookings.find((ab) => ab.id === targetBkg.id);
    const linkedCheckin = appCheckins.find(
      (c) =>
        c.id === targetBkg.id ||
        (c as any).bookingId === targetBkg.id ||
        c.id === targetBkg.bookingNo
    );

    const { folio, bill } = buildStayBill({
      booking: rawAppBkg || targetBkg,
      checkin: linkedCheckin || null,
      posOrders: appPosOrders,
      laundryOrders: appLaundryOrders,
      waterBottles: appWaterBottles,
      rooms: appRooms,
      settings:
        payload.roomRateIncludesGst !== undefined
          ? { ...billSettings, roomRateIncludesGst: payload.roomRateIncludesGst }
          : billSettings,
      additionalCharges,
      additionalPayments,
      gstEnabledOverride: effectiveGstEnabled,
      discountOverride: payload.updatedDiscount,
    });

    const roomSubtotal = r2(
      bill.legacy.roomCharges +
        bill.legacy.extraBedCharges +
        bill.legacy.extraPersonCharges +
        bill.legacy.earlyCheckInCharges +
        bill.legacy.lateCheckOutCharges
    );
    const updatedOtherServicesTotal = r2(bill.subtotal - roomSubtotal);

    // Never hardcode 'Fully Paid' when bill.balance > 0!
    const checkoutPayStatus: BookingRecord['paymentStatus'] =
      payload.refundAmount > 0 && bill.balance <= 0
        ? 'Refunded'
        : bill.paymentStatus === 'Paid'
        ? 'Fully Paid'
        : bill.paymentStatus;

    const safeRoomNums =
      folio.roomNumbers.length > 0
        ? folio.roomNumbers
        : Array.isArray(targetBkg.roomNumbers) && targetBkg.roomNumbers.length > 0
        ? targetBkg.roomNumbers
        : ['101'];

    const refundPaymentRecord: PaymentRecordItem[] =
      payload.refundAmount > 0
        ? [
            {
              id: `REF-CO-${targetBkg.id}`,
              bookingId: targetBkg.id,
              amount: -r2(payload.refundAmount),
              paymentMethod: newPaymentItems[0]?.paymentMethod || 'UPI',
              transactionId: `REF-${Date.now().toString().slice(-6)}`,
              date: todayStr,
              time: nowTimeStr,
              recordedBy: loggedInUser || 'Reception Desk',
              notes: 'Checkout excess advance refund',
            },
          ]
        : [];

    const updatedBooking: BookingRecord = {
      ...targetBkg,
      status: 'Checked Out',
      paymentStatus: checkoutPayStatus,
      isCheckedOut: true,
      checkOutTime: `${todayStr}, ${nowTimeStr}`,
      roomNumbers: safeRoomNums,
      nights: folio.nights,
      roomSubtotal,
      otherServices: [...trulyNewServices, ...(targetBkg.otherServices || [])],
      otherServicesTotal: updatedOtherServicesTotal,
      discountAmount: bill.discount,
      gstInvoice: bill.isGstInvoice,
      taxRate: bill.headlineGstRate,
      taxAmount: bill.totalTax,
      totalPayable: bill.grandTotal,
      amountPaid: bill.receipts,
      dueAmount: bill.balance,
      refundAmount: r2(payload.refundAmount),
      payments: [...newPaymentItems, ...refundPaymentRecord, ...(targetBkg.payments || [])],
    };

    const nextBookings = bookings.map((b) => (b.id === updatedBooking.id ? updatedBooking : b));
    syncBookingsToDb(nextBookings);

    if (selectedBookingForDrawer?.id === updatedBooking.id) {
      setSelectedBookingForDrawer(updatedBooking);
    }

    // Allocate proper PREFIX/1014/2026-27 invoice number (preserving existing invoice's number if one already exists!)
    const resolvedInvId = existingPrimaryInv?.id || `INV-${Date.now()}`;
    const resolvedInvNumber =
      existingPrimaryInv?.invoiceNumber ||
      allocateInvoiceNumber(appInvoices, billSettings).invoiceNumber;

    const effectivePayMethod: PaymentMethod =
      newPaymentItems[0]?.paymentMethod ||
      updatedBooking.payments[0]?.paymentMethod ||
      'UPI';

    const newInvoiceRecord: InvoiceRecord = {
      id: resolvedInvId,
      invoiceNumber: resolvedInvNumber,
      bookingId: updatedBooking.id,
      bookingNo: updatedBooking.bookingNo,
      gstRate: bill.headlineGstRate,
      isWithoutGst: !bill.isGstInvoice,
      isSeparateInvoice: false,
      isFoodRoomSplitSettled: Boolean(payload.isFoodRoomSplitSettled),
      invoiceScope:
        updatedOtherServicesTotal > 0 ? 'Booking + Other Services' : 'Only Booking',
      customerName: updatedBooking.customerName,
      mobile: updatedBooking.mobile || '',
      companyName: updatedBooking.companyName,
      gstNumber: bill.isGstInvoice ? updatedBooking.companyGst : undefined,
      roomNumbers: safeRoomNums,
      checkInDateTime: updatedBooking.checkInDate,
      checkOutDateTime: updatedBooking.checkOutDate,
      bookedOnDateTime: updatedBooking.bookedOn || updatedBooking.checkInDate,
      nights: folio.nights,
      roomCharges: roomSubtotal,
      otherServicesCharges: updatedOtherServicesTotal,
      foodCharges: bill.legacy.foodCharges,
      waterCharges: bill.legacy.waterCharges,
      laundryCharges: bill.legacy.laundryCharges,
      serviceCharges: bill.legacy.serviceCharges,
      extraBedCharges: bill.legacy.extraBedCharges,
      extraPersonCharges: bill.legacy.extraPersonCharges,
      earlyCheckInCharges: bill.legacy.earlyCheckInCharges,
      lateCheckOutCharges: bill.legacy.lateCheckOutCharges,
      fineCharges: bill.legacy.fineCharges,
      otherCharges: r2(bill.legacy.otherCharges + bill.legacy.fineCharges),
      subtotal: bill.subtotal,
      discount: bill.discount,
      taxableAmount: bill.taxableAmount,
      cgst: bill.cgst,
      sgst: bill.sgst,
      totalTax: bill.totalTax,
      grandTotal: bill.grandTotal,
      amountPaid: bill.receipts,
      balanceDue: bill.balance,
      refundDue: bill.refundDue,
      paymentStatus: bill.paymentStatus,
      paymentMethod: effectivePayMethod,
      invoiceStatus: 'Finalized',
      isSuperseded: false,
      createdAt: existingPrimaryInv?.createdAt || todayStr,
      ledgerLines: bill.lines,
      taxRows: bill.taxRows,
      amountInWords: bill.amountInWords,
      billEngine: 'v2',
    };

    setInvoices((prev) =>
      existingPrimaryInv
        ? prev.map((inv) => (inv.id === existingPrimaryInv.id ? newInvoiceRecord : inv))
        : [newInvoiceRecord, ...prev]
    );

    if (onUpdateInvoices) {
      const checkoutPaymentHistory = (updatedBooking.payments || [])
        .filter((p) => p && Number(p.amount) > 0)
        .map((p) => ({
          id: p.id,
          amount: r2(p.amount),
          paymentMethod: String(p.paymentMethod || 'Cash') as any,
          date: String(p.date || todayStr).slice(0, 10),
          referenceNo: p.transactionId,
          notes: p.notes,
        }));

      const newAppInvoice = buildInvoiceRecord({
        id: resolvedInvId,
        invoiceNumber: resolvedInvNumber,
        hotelId: selectedHotelId,
        bookingId: updatedBooking.id,
        checkInId: linkedCheckin?.id,
        guestName: updatedBooking.customerName,
        guestMobile: updatedBooking.mobile,
        guestAddress: updatedBooking.address,
        companyName: updatedBooking.companyName,
        guestGstNumber: updatedBooking.companyGst,
        roomNumbers: safeRoomNums,
        checkInDate: updatedBooking.checkInDate,
        checkOutDate: updatedBooking.checkOutDate,
        nights: folio.nights,
        bill,
        paymentMethod: effectivePayMethod,
        isSeparateInvoice: false,
        invoiceScope:
          updatedOtherServicesTotal > 0 ? 'Booking + Other Services' : 'Only Booking',
        dateCreated: existingPrimaryInv?.createdAt || todayStr,
        invoiceStatus: 'Finalized',
        extra: {
          bookingNo: updatedBooking.bookingNo,
          isFinalInvoice: true,
          isFoodRoomSplitSettled: Boolean(payload.isFoodRoomSplitSettled),
          ...(checkoutPaymentHistory.length > 0 ? { paymentHistory: checkoutPaymentHistory } : {}),
        },
      }) as Invoice;

      // Preserve existing superseded/separate invoice history; replace only the provisional primary invoice if present
      const filteredPrev = appInvoices.filter(
        (inv) =>
          inv.id !== resolvedInvId &&
          !(
            inv.bookingId === updatedBooking.id &&
            !(inv as any).isSeparateInvoice &&
            !(inv as any).isSuperseded &&
            inv.invoiceStatus !== 'Superseded'
          )
      );
      onUpdateInvoices([newAppInvoice, ...filteredPrev]);
    }

    if (newPaymentItems.length > 0) {
      const newVouchers: FinanceVoucherRecord[] = newPaymentItems.map((np) => ({
        id: `VCH-${np.id}`,
        voucherNo: `RV-${Date.now().toString().slice(-5)}`,
        type: 'Receipt Voucher',
        date: np.date,
        partyName: `${updatedBooking.customerName} (Booking ${updatedBooking.bookingNo})`,
        category: 'Checkout Final Bill Settlement',
        amount: np.amount,
        paymentMethod: np.paymentMethod,
        referenceNo: np.transactionId,
        narration: np.notes || 'Checkout clearance payment',
        preparedBy: loggedInUser || 'Reception Desk',
        sourceType: 'booking_payment',
        sourceId: updatedBooking.id,
      }));
      setVouchers((prev) => [...newVouchers, ...prev]);
      if (onUpdateVouchers) {
        const dbVouchers: FinanceVoucher[] = newVouchers.map((nv) => ({
          id: nv.id,
          hotelId: selectedHotelId,
          voucherNumber: nv.voucherNo,
          voucherType: 'Receipt',
          date: nv.date,
          amount: nv.amount,
          paymentMode: (nv.paymentMethod as any) || 'Cash',
          partyName: nv.partyName,
          category: nv.category,
          referenceNumber: nv.referenceNo,
          description: nv.narration,
          createdBy: nv.preparedBy,
          ...({ sourceType: 'booking_payment', sourceId: updatedBooking.id } as any),
        }));
        onUpdateVouchers([...dbVouchers, ...appVouchers]);
      }
    }

    const shouldAutoDirty = hotelSettings?.autoMarkDirtyOnCheckout !== false;
    const nextRooms = rooms.map((rm) =>
      safeRoomNums.includes(rm.number)
        ? {
            ...rm,
            status: (shouldAutoDirty ? 'Dirty' : 'Available') as RoomAsset['status'],
            cleaningStatus: (shouldAutoDirty ? 'Dirty' : 'Clean') as RoomAsset['cleaningStatus'],
            housekeepingPriority: shouldAutoDirty ? ('High' as const) : rm.housekeepingPriority,
            housekeepingNotes: shouldAutoDirty
              ? `Post-Checkout Turnaround (${updatedBooking.customerName})`
              : rm.housekeepingNotes,
            currentBookingId: undefined,
            currentGuestName: undefined,
          }
        : rm
    );
    syncRoomsToDb(nextRooms);

    if (shouldAutoDirty) {
      const newAutoTasks: HousekeepingTask[] = safeRoomNums.map((rn) => {
        const rmObj = rooms.find((r) => r.number === rn);
        return {
          id: `HK-${Date.now()}-${rn}`,
          roomId: rmObj?.id || `rm-${rn}`,
          roomName: rmObj?.name || `Room ${rn}`,
          roomNumber: rn,
          category: rmObj?.category || 'Standard',
          floor: rmObj?.floor || '1st Floor',
          priority: 'High',
          notes: `Post-Checkout Turnaround Cleaning & Inspection for Booking ${updatedBooking.bookingNo} (${updatedBooking.customerName})`,
          description: `Post-Checkout Turnaround Cleaning & Inspection for Booking ${updatedBooking.bookingNo} (${updatedBooking.customerName})`,
          taskType: 'Cleaning',
          assignedTo: rmObj?.assignedStaff || 'Unassigned',
          timing: `${todayStr} ${nowTimeStr}`,
          status: 'Pending',
          checklist: [
            'Strip & replace bedsheets',
            'Sanitize bathroom & floor',
            'Inspect mini-bar & restock water bottles',
          ],
          autoCreatedFromBookingId: updatedBooking.id,
        };
      });

      setTasks((prev) => [...newAutoTasks, ...prev]);
      if (onUpdateCleaningLogs) {
        const newLogs: HousekeepingCleaningLog[] = newAutoTasks.map((t) => ({
          id: t.id,
          hotelId: selectedHotelId,
          roomNumber: t.roomNumber,
          category: t.category,
          floor: t.floor,
          priority: 'High',
          assignedStaff: t.assignedTo,
          assignedAt: `${todayStr} ${nowTimeStr}`,
          status: 'Pending',
          checklistCompleted: [],
          notes: t.description,
        }));
        onUpdateCleaningLogs([...newLogs, ...appCleaningLogs]);
      }
    }

    setCheckoutClearanceBooking(null);
    setSelectedBookingForDrawer(null);

    // Redirect directly to Invoice page and open the generated GST Invoice
    setActiveTab('invoice');
    setInvoiceSubTab('all');
    setInvoiceModalState({
      booking: updatedBooking,
      scope: 'Booking + Other Services',
      invoiceRecord: newInvoiceRecord,
    });

    logAudit(
      'Front Desk',
      'Guest Checked Out & Invoice Generated',
      `Completed checkout for ${updatedBooking.customerName} (Room ${safeRoomNums.join(', ')}). Generated Invoice ${resolvedInvNumber}, marked room Dirty & redirected to Invoice Center.`,
      'success'
    );
  };

  // 4. 12:00 PM Daily Stay Continuation / Extend Stay (+1 Night — preserves extra bed / extra person charges via buildStayBill, fixes H10!)
  const handleExtendStay = (bookingId: string, extraDays: number) => {
    const nextBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      const oldNights = Math.max(1, Number(b.nights) || 1);
      const newNights = oldNights + extraDays;
      const d = new Date(`${b.checkOutDate}T00:00:00`);
      d.setDate(d.getDate() + extraDays);
      const newCheckOutDate = d.toISOString().slice(0, 10);

      const oldBaseRoomTariff = b.requirements.reduce(
        (sum, r) => sum + r.unitPrice * Math.max(r.qty, r.assignedRooms.length || 1) * oldNights,
        0
      );
      const oldExtraBedOrPaxTotal = Math.max(0, r2((b.roomSubtotal || 0) - oldBaseRoomTariff));
      const extraBedOrPaxPerNight = r2(oldExtraBedOrPaxTotal / oldNights);

      const newBaseRoomTariff = b.requirements.reduce(
        (sum, r) => sum + r.unitPrice * Math.max(r.qty, r.assignedRooms.length || 1) * newNights,
        0
      );
      const preservedRoomSubtotal = r2(newBaseRoomTariff + extraBedOrPaxPerNight * newNights);

      const rawAppBkg = appBookings.find((ab) => ab.id === b.id);
      const linkedCheckin = appCheckins.find(
        (c) => c.id === b.id || (c as any).bookingId === b.id
      );

      const candidateBooking = {
        ...(rawAppBkg || {}),
        ...b,
        nights: newNights,
        checkOutDate: newCheckOutDate,
        roomSubtotal: preservedRoomSubtotal,
      };
      const candidateCheckin = linkedCheckin
        ? { ...linkedCheckin, checkOutDate: newCheckOutDate }
        : null;

      const { bill } = buildStayBill({
        booking: candidateBooking,
        checkin: candidateCheckin,
        posOrders: appPosOrders,
        laundryOrders: appLaundryOrders,
        waterBottles: appWaterBottles,
        rooms: appRooms,
        settings: billSettings,
        gstEnabledOverride: b.gstInvoice,
      });

      const computedRoomSubtotal = r2(
        bill.legacy.roomCharges +
          bill.legacy.extraBedCharges +
          bill.legacy.extraPersonCharges +
          bill.legacy.earlyCheckInCharges +
          bill.legacy.lateCheckOutCharges
      );
      const computedServicesTotal = r2(bill.subtotal - computedRoomSubtotal);

      const updated: BookingRecord = {
        ...b,
        nights: newNights,
        checkOutDate: newCheckOutDate,
        roomSubtotal: computedRoomSubtotal,
        otherServicesTotal: computedServicesTotal,
        taxRate: bill.headlineGstRate,
        taxAmount: bill.totalTax,
        totalPayable: bill.grandTotal,
        amountPaid: bill.receipts,
        dueAmount: bill.balance,
        paymentStatus: bill.paymentStatus === 'Paid' ? 'Fully Paid' : bill.paymentStatus,
      };
      if (selectedBookingForDrawer?.id === b.id) {
        setSelectedBookingForDrawer(updated);
      }
      return updated;
    });
    syncBookingsToDb(nextBookings);

    if (onUpdateCheckins && appCheckins.length > 0) {
      const updatedTarget = nextBookings.find((b) => b.id === bookingId);
      if (updatedTarget) {
        onUpdateCheckins(
          appCheckins.map((c) =>
            c.id === bookingId || (c as any).bookingId === bookingId
              ? { ...c, checkOutDate: updatedTarget.checkOutDate }
              : c
          )
        );
      }
    }

    logAudit(
      'Front Desk',
      '12:00 PM Stay Extended (+1 Day)',
      `Extended stay by +${extraDays} Night(s) via Single Bill Calculator.`,
      'info'
    );
  };

  // 5. In-House Room Shift / Change
  const handleChangeRoom = (bookingId: string, oldRoomNumber: string, newRoomNumber: string) => {
    const newRmObj = rooms.find((r) => r.number === newRoomNumber);
    const nextBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      const updatedRooms = b.roomNumbers.map((rn) =>
        rn === oldRoomNumber ? newRoomNumber : rn
      );
      const updatedReqs = b.requirements.map((req) => ({
        ...req,
        assignedRooms: req.assignedRooms.map((rn) =>
          rn === oldRoomNumber ? newRoomNumber : rn
        ),
      }));
      const updated: BookingRecord = {
        ...b,
        roomNumbers: updatedRooms,
        requirements: updatedReqs,
        roomCategorySummary: `${newRmObj?.name || `Room ${newRoomNumber}`} (Shifted from Rm ${oldRoomNumber})`,
      };
      if (selectedBookingForDrawer?.id === b.id) {
        setSelectedBookingForDrawer(updated);
      }
      return updated;
    });
    syncBookingsToDb(nextBookings);

    const nextRooms = rooms.map((rm) => {
      if (rm.number === oldRoomNumber) {
        return {
          ...rm,
          status: 'Dirty' as RoomAsset['status'],
          cleaningStatus: 'Dirty' as RoomAsset['cleaningStatus'],
          currentBookingId: undefined,
          currentGuestName: undefined,
        };
      }
      if (rm.number === newRoomNumber) {
        const targetBkg = bookings.find((b) => b.id === bookingId);
        return {
          ...rm,
          status: 'Occupied' as RoomAsset['status'],
          currentBookingId: bookingId,
          currentGuestName: targetBkg?.customerName || 'In-House Guest',
        };
      }
      return rm;
    });
    syncRoomsToDb(nextRooms);

    logAudit(
      'Front Desk',
      'In-House Room Shifted',
      `Shifted Booking ${bookingId} from Room ${oldRoomNumber} to Room ${newRoomNumber}. Old room marked Dirty.`,
      'warning'
    );
  };

  // 6. Cancel Reservation or Mark No-Show
  const handleCancelOrNoShowBooking = (
    bookingId: string,
    mode: 'Cancelled' | 'No-Show',
    refundAmount: number,
    reason: string
  ) => {
    let releasedRooms: string[] = [];
    let cancelledTarget: BookingRecord | null = null;
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const nextBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      releasedRooms = b.roomNumbers;
      const refundPaymentItem: PaymentRecordItem | null =
        refundAmount > 0
          ? {
              id: `pay-ref-${b.id}`,
              bookingId: b.id,
              amount: -refundAmount,
              paymentMethod: 'UPI',
              transactionId: `REF-${b.id}`,
              date: todayStr,
              time: nowTimeStr,
              recordedBy: loggedInUser || 'Front Desk',
              notes: reason ? `Refund: ${reason}` : 'Cancellation Refund',
            }
          : null;
      const filteredPayments = b.payments.filter((p) => p.id !== `pay-ref-${b.id}`);
      const updatedBkg: BookingRecord = {
        ...b,
        status: mode,
        paymentStatus: (refundAmount > 0 ? 'Refunded' : b.paymentStatus) as BookingRecord['paymentStatus'],
        refundAmount,
        cancellationReason: reason,
        dueAmount: 0,
        payments: refundPaymentItem ? [...filteredPayments, refundPaymentItem] : filteredPayments,
      };
      cancelledTarget = updatedBkg;
      return updatedBkg;
    });
    syncBookingsToDb(nextBookings);

    if (cancelledTarget && selectedBookingForDrawer?.id === bookingId) {
      setSelectedBookingForDrawer(cancelledTarget);
    }

    // Automatically record Refund Voucher & Expense in Finance Hub when refundAmount > 0
    if (refundAmount > 0 && cancelledTarget) {
      const targetRef = cancelledTarget as BookingRecord;
      const newVchId = `VCH-REF-${Date.now()}`;
      const vchNo = `PV-REF-${targetRef.bookingNo}`;
      const newVch: FinanceVoucherRecord = {
        id: newVchId,
        voucherNo: vchNo,
        type: 'Payment Voucher',
        date: todayStr,
        partyName: `${targetRef.customerName} (Booking #${targetRef.bookingNo})`,
        category: 'Guest Refund',
        paymentMethod: 'UPI',
        referenceNo: `REF-${targetRef.bookingNo}`,
        amount: refundAmount,
        narration: `Booking Cancellation Refund for #${targetRef.bookingNo} (${reason})`,
        preparedBy: loggedInUser || 'Front Desk',
      };
      setVouchers((prev) => [newVch, ...prev]);
      if (onUpdateVouchers) {
        const dbVch: FinanceVoucher = {
          id: newVchId,
          hotelId: selectedHotelId,
          voucherNumber: vchNo,
          voucherType: 'Payment Voucher',
          date: todayStr,
          partyName: newVch.partyName,
          category: 'Guest Refund',
          referenceNo: newVch.referenceNo,
          paymentMethod: 'UPI',
          amount: refundAmount,
          narration: newVch.narration,
          preparedBy: newVch.preparedBy,
          status: 'Issued',
        };
        onUpdateVouchers([dbVch, ...appVouchers]);
      }

      const newExpId = `EXP-REF-${Date.now()}`;
      const expNo = `EXP-REF-${targetRef.bookingNo}`;
      const newExp: FinanceExpenseRecord = {
        id: newExpId,
        expenseNo: expNo,
        date: todayStr,
        category: 'Guest Refund',
        department: 'Front Desk',
        vendorName: targetRef.customerName,
        description: `Advance Booking Cancellation Refund (#${targetRef.bookingNo}) — ${reason}`,
        amount: refundAmount,
        gstAmount: 0,
        paymentMethod: 'UPI',
        approvalStatus: 'Approved',
        recordedBy: loggedInUser || 'Front Desk',
      };
      setExpenses((prev) => [newExp, ...prev]);
      if (onUpdateExpenses) {
        const dbExp: Expense = {
          id: newExpId,
          hotelId: selectedHotelId,
          expenseNo: expNo,
          department: 'Front Desk',
          category: 'Guest Refund',
          amount: refundAmount,
          gstAmount: 0,
          date: todayStr,
          description: newExp.description,
          vendorName: targetRef.customerName,
          paymentMethod: 'UPI',
          approvalStatus: 'Approved',
          createdBy: newExp.recordedBy,
        };
        onUpdateExpenses([dbExp, ...appExpenses]);
      }
    }

    if (releasedRooms.length > 0) {
      const nextRooms = rooms.map((rm) =>
        releasedRooms.includes(rm.number)
          ? {
              ...rm,
              status: 'Available' as RoomAsset['status'],
              currentBookingId: undefined,
              currentGuestName: undefined,
            }
          : rm
      );
      syncRoomsToDb(nextRooms);
    }

    logAudit(
      'Front Desk',
      `Reservation Marked ${mode}`,
      `Marked booking ${bookingId} as ${mode}. Refund authorized: ₹${refundAmount}. Reason: ${reason}`,
      'warning'
    );
  };

  // 7. Record Payment (with Finalized Invoice Immutability Guard — BUG-P2-07 + Hybrid Split Support)
  const handleSavePayment = (
    bookingId: string,
    amount: number,
    method: PaymentMethod,
    transactionId: string,
    dateStr: string,
    completeCheckout?: boolean,
    splitEntries?: Array<{ method: PaymentMethod; amount: number; reference?: string }>
  ) => {
    const finalizedInv =
      findActiveFinalizedInvoiceForBooking(bookingId, appInvoices as any) ||
      findActiveFinalizedInvoiceForBooking(bookingId, invoices as any);
    if (finalizedInv) {
      showToast(
        `Invoice ${finalizedInv.invoiceNumber || finalizedInv.id} is Finalized and immutable. Post-finalization payment edits require an authorized adjustment / credit-note workflow.`,
        'warning'
      );
      logAudit(
        'Payments',
        'Finalized Invoice Payment Blocked',
        `Blocked unauthorized payment modification of ₹${Number(amount || 0).toLocaleString('en-IN')} (${method}) on booking ${bookingId} because Invoice ${finalizedInv.invoiceNumber || finalizedInv.id} is already Finalized.`,
        'warning'
      );
      setPaymentBooking(null);
      return;
    }

    const effectiveEntries =
      splitEntries && splitEntries.length > 0
        ? splitEntries.filter((e) => Number(e.amount) > 0)
        : [{ method, amount, reference: transactionId }];
    const totalCollectedNow = Math.round(effectiveEntries.reduce((s, e) => s + Number(e.amount || 0), 0) * 100) / 100;
    const baseTs = Date.now();
    const payDatePart = dateStr.split(' ')[0] || new Date().toISOString().slice(0, 10);
    const payTimePart = dateStr.split(' ').slice(1).join(' ') || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const nextBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      const newPaid = Math.round((b.amountPaid + totalCollectedNow) * 100) / 100;
      const newDue = Math.max(0, Math.round((b.totalPayable - newPaid) * 100) / 100);
      const newPayments = effectiveEntries.map((entry, idx) => ({
        id: `PAY-${baseTs}-${idx}`,
        bookingId: b.id,
        amount: Number(entry.amount),
        paymentMethod: entry.method,
        transactionId: entry.reference || transactionId || `TXN-${baseTs}-${idx}`,
        date: payDatePart,
        time: payTimePart,
        recordedBy: loggedInUser || 'Reception Desk',
      }));
      const updated: BookingRecord = {
        ...b,
        amountPaid: newPaid,
        dueAmount: newDue,
        paymentStatus: newDue <= 0 ? 'Fully Paid' : 'Partially Paid',
        payments: [...newPayments, ...b.payments],
        status: completeCheckout ? 'Checked Out' : b.status,
        isCheckedOut: completeCheckout ? true : b.isCheckedOut,
      };
      if (selectedBookingForDrawer?.id === b.id) {
        setSelectedBookingForDrawer(updated);
      }
      return updated;
    });
    syncBookingsToDb(nextBookings);

    const targetBkg = bookings.find((b) => b.id === bookingId);
    if (targetBkg) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const newVchs: FinanceVoucherRecord[] = effectiveEntries.map((entry, idx) => ({
        id: `VCH-${baseTs}-${idx}`,
        voucherNo: `RV-${String(baseTs + idx).slice(-5)}`,
        type: 'Receipt Voucher',
        date: todayIso,
        partyName: `${targetBkg.customerName} (Booking ${targetBkg.bookingNo})`,
        category: 'Room & Folio Settlement',
        amount: Number(entry.amount),
        paymentMethod: entry.method,
        referenceNo: entry.reference || transactionId,
        narration:
          effectiveEntries.length > 1
            ? `Hybrid split bill payment (${entry.method} ₹${entry.amount}) of ₹${totalCollectedNow}`
            : `Bill payment received via ${entry.method}`,
        preparedBy: loggedInUser || 'Reception Desk',
        sourceType: 'booking_payment',
        sourceId: targetBkg.id,
      }));
      setVouchers((prev) => [...newVchs, ...prev]);
      if (onUpdateVouchers) {
        onUpdateVouchers([
          ...newVchs.map((newVch) => ({
            id: newVch.id,
            hotelId: selectedHotelId,
            voucherNumber: newVch.voucherNo,
            voucherType: 'Receipt' as const,
            date: newVch.date,
            amount: newVch.amount,
            paymentMode: (newVch.paymentMethod as any) || 'Cash',
            partyName: newVch.partyName,
            category: newVch.category,
            referenceNumber: newVch.referenceNo,
            description: newVch.narration,
            createdBy: newVch.preparedBy,
            ...({ sourceType: 'booking_payment', sourceId: targetBkg.id } as any),
          })),
          ...appVouchers,
        ]);
      }
      const modeSummary = effectiveEntries.map((e) => `${e.method} ₹${e.amount}`).join(' + ');
      logAudit(
        'Payments',
        'Bill Payment Recorded',
        `Collected ₹${totalCollectedNow.toLocaleString('en-IN')} via ${modeSummary} (${transactionId}) for ${targetBkg.customerName}.`,
        'success'
      );
    }

    setPaymentBooking(null);
    if (completeCheckout) {
      const updatedTarget = nextBookings.find((b) => b.id === bookingId);
      setSelectedBookingForDrawer(null);
      setActiveTab('invoice');
      setInvoiceSubTab('all');
      if (updatedTarget) {
        setInvoiceModalState({
          booking: updatedTarget,
          scope: 'Booking + Other Services',
        });
      }
    }
  };

  // 8. Complete Housekeeping Task & Full Room Housekeeping Sync
  const handleCompleteTask = (taskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    const nowStr = new Date().toLocaleString('en-IN');
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'Completed', completedAt: nowStr } : t))
    );
    if (onUpdateCleaningLogs) {
      onUpdateCleaningLogs(
        appCleaningLogs.map((cl) =>
          cl.id === taskId
            ? {
                ...cl,
                status: 'Cleaned',
                cleanedAt: nowStr,
                completedAt: nowStr,
                inspectedAt: nowStr,
                inspectedBy: loggedInUser || 'Supervisor',
              }
            : cl
        )
      );
    }
    if (targetTask) {
      const nextRooms = rooms.map((rm) =>
        rm.number === targetTask.roomNumber
          ? {
              ...rm,
              status: (rm.currentBookingId ? rm.status : 'Available') as RoomAsset['status'],
              cleaningStatus: 'Clean' as RoomAsset['cleaningStatus'],
              cleaningCompletedAt: nowStr,
              verifiedBy: loggedInUser || 'Supervisor',
              verificationTime: nowStr,
              housekeepingNotes: '',
            }
          : rm
      );
      syncRoomsToDb(nextRooms);
      logAudit(
        'Housekeeping',
        'Room Cleaning & Inspection Completed',
        `Completed cleaning task for ${targetTask.roomName}. Status synced to Clean & Available.`,
        'success'
      );
    }
  };

  // 8b. Unified Room Housekeeping Update (Board / Table / By Attendant / Bulk Staff Assignment)
  const handleUpdateRoomHousekeeping = (roomNumbers: string[], patch: RoomHousekeepingPatch) => {
    if (!Array.isArray(roomNumbers) || roomNumbers.length === 0) return;
    const roomSet = new Set(roomNumbers);
    const nowStr = new Date().toLocaleString('en-IN');

    const nextRooms = rooms.map((rm) => {
      if (!roomSet.has(rm.number)) return rm;
      const nextClean: RoomAsset['cleaningStatus'] = patch.cleaningStatus ?? rm.cleaningStatus;
      const nextStaff =
        patch.assignedStaff !== undefined
          ? patch.assignedStaff === 'Unassigned'
            ? ''
            : patch.assignedStaff
          : rm.assignedStaff;
      const nextPrio = patch.priority ?? rm.housekeepingPriority ?? 'Normal';
      const nextNotes =
        patch.notes !== undefined
          ? patch.notes
          : nextClean === 'Clean'
          ? ''
          : rm.housekeepingNotes;

      let nextStatus: RoomAsset['status'] = rm.status;
      if (patch.markOutOfOrder === true) {
        nextStatus = 'Out of Service';
      } else if (patch.markOutOfOrder === false && rm.status === 'Out of Service') {
        nextStatus = nextClean === 'Clean' ? 'Available' : 'Dirty';
      } else if (rm.status !== 'Occupied' && rm.status !== 'Confirmed' && rm.status !== 'Out of Service') {
        nextStatus = nextClean === 'Clean' ? 'Available' : 'Dirty';
      }

      return {
        ...rm,
        status: nextStatus,
        cleaningStatus: nextClean,
        assignedStaff: nextStaff,
        housekeepingPriority: nextPrio,
        housekeepingNotes: nextNotes,
        blockedReason:
          patch.markOutOfOrder === true
            ? patch.outOfOrderReason || rm.blockedReason || 'Maintenance / Out of Order'
            : patch.markOutOfOrder === false
            ? undefined
            : rm.blockedReason,
        cleaningCompletedAt: nextClean === 'Clean' ? nowStr : rm.cleaningCompletedAt,
        verifiedBy: nextClean === 'Clean' ? loggedInUser || 'Supervisor' : rm.verifiedBy,
        verificationTime: nextClean === 'Clean' ? nowStr : rm.verificationTime,
      };
    });
    syncRoomsToDb(nextRooms);

    // Sync Housekeeping Task Queue & MongoDB `appCleaningLogs`
    const nextTasksList = [...tasks];
    const nextDbLogs = [...appCleaningLogs];

    roomNumbers.forEach((rn, idx) => {
      const rmMeta = nextRooms.find((r) => r.number === rn);
      const targetStage = patch.cleaningStatus ?? rmMeta?.cleaningStatus ?? 'Dirty';
      const taskStatus: HousekeepingTask['status'] =
        targetStage === 'Clean'
          ? 'Completed'
          : targetStage === 'Inspection'
          ? 'Inspection'
          : targetStage === 'In Progress'
          ? 'In Progress'
          : 'Pending';
      const dbStatus: HousekeepingCleaningLog['status'] =
        targetStage === 'Clean'
          ? 'Cleaned'
          : targetStage === 'Inspection'
          ? 'Inspection'
          : targetStage === 'In Progress'
          ? 'In Progress'
          : 'Pending';

      const openTaskIdx = nextTasksList.findIndex(
        (t) => t.roomNumber === rn && t.status !== 'Completed'
      );
      if (openTaskIdx >= 0) {
        const existingT = nextTasksList[openTaskIdx];
        nextTasksList[openTaskIdx] = {
          ...existingT,
          assignedTo:
            patch.assignedStaff !== undefined ? patch.assignedStaff : existingT.assignedTo,
          priority: patch.priority ?? existingT.priority,
          notes: patch.notes !== undefined ? patch.notes : existingT.notes,
          description:
            patch.notes !== undefined && patch.notes.trim()
              ? patch.notes.trim()
              : existingT.description,
          status: taskStatus,
          completedAt: taskStatus === 'Completed' ? nowStr : existingT.completedAt,
          inspectedAt:
            taskStatus === 'Completed' || taskStatus === 'Inspection'
              ? nowStr
              : existingT.inspectedAt,
          inspectedBy:
            taskStatus === 'Completed' ? loggedInUser || 'Supervisor' : existingT.inspectedBy,
          checklist: patch.checklist || existingT.checklist,
        };
      } else if (taskStatus !== 'Completed') {
        const newId = `HK-${Date.now()}-${idx}-${rn}`;
        nextTasksList.unshift({
          id: newId,
          roomId: rmMeta?.id || `rm-${rn}`,
          roomName: rmMeta?.name || `Room ${rn}`,
          roomNumber: rn,
          category: rmMeta?.category || 'Standard',
          floor: rmMeta?.floor || '1st Floor',
          description: patch.notes?.trim() || `Housekeeping (${targetStage})`,
          notes: patch.notes,
          priority: patch.priority || 'Normal',
          taskType: targetStage === 'Inspection' ? 'Inspection' : 'Cleaning',
          assignedTo: patch.assignedStaff || rmMeta?.assignedStaff || 'Unassigned',
          timing: nowStr,
          status: taskStatus,
          checklist: patch.checklist || ['Strip & replace bedsheets', 'Sanitize bathroom', 'Restock amenities'],
        });
        nextDbLogs.unshift({
          id: newId,
          hotelId: selectedHotelId,
          roomNumber: rn,
          category: rmMeta?.category,
          floor: rmMeta?.floor,
          priority: patch.priority || 'Normal',
          assignedStaff: patch.assignedStaff || rmMeta?.assignedStaff || 'Unassigned',
          assignedAt: nowStr,
          status: dbStatus,
          checklistCompleted: patch.checklist || [],
          notes: patch.notes?.trim() || `Housekeeping (${targetStage})`,
        });
      }

      const openDbIdx = nextDbLogs.findIndex(
        (cl) => cl.roomNumber === rn && cl.status !== 'Cleaned' && cl.status !== 'Inspected'
      );
      if (openDbIdx >= 0) {
        const existingCl = nextDbLogs[openDbIdx];
        nextDbLogs[openDbIdx] = {
          ...existingCl,
          assignedStaff:
            patch.assignedStaff !== undefined ? patch.assignedStaff : existingCl.assignedStaff,
          priority: patch.priority ?? existingCl.priority,
          notes: patch.notes !== undefined && patch.notes.trim() ? patch.notes : existingCl.notes,
          status: dbStatus,
          cleanedAt: dbStatus === 'Cleaned' ? nowStr : existingCl.cleanedAt,
          completedAt: dbStatus === 'Cleaned' ? nowStr : existingCl.completedAt,
          inspectedAt:
            dbStatus === 'Cleaned' || dbStatus === 'Inspection' ? nowStr : existingCl.inspectedAt,
          inspectedBy:
            dbStatus === 'Cleaned' ? loggedInUser || 'Supervisor' : existingCl.inspectedBy,
          checklistCompleted: patch.checklist || existingCl.checklistCompleted,
        };
      }
    });

    setTasks(nextTasksList);
    if (onUpdateCleaningLogs) {
      onUpdateCleaningLogs(nextDbLogs);
    }

    logAudit(
      'Housekeeping',
      'Room Housekeeping Updated',
      `Updated Room(s) ${roomNumbers.join(', ')} -> Status: ${
        patch.markOutOfOrder ? 'Out of Order' : patch.cleaningStatus || 'Updated'
      }${patch.assignedStaff ? `, Staff: ${patch.assignedStaff}` : ''}${
        patch.priority ? `, Priority: ${patch.priority}` : ''
      }.`,
      'info'
    );
  };

  // 9b. Apply payments to existing open POS checks (consolidated table bill). Updates both the live POS ledger and the persisted orders.
  const handleSettlePosOrders = (
    updates: {
      id: string;
      payments: any[];
      amountPaid: number;
      balanceDue: number;
      paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
      paymentMethod: PaymentMethod;
      paymentSummary: string;
    }[]
  ) => {
    const map = new Map(updates.map((u) => [u.id, u]));
    setPosOrders((prev) =>
      prev.map((o) => {
        const u = map.get(o.id);
        return u
          ? {
              ...o,
              payments: u.payments,
              amountPaid: u.amountPaid,
              balanceDue: u.balanceDue,
              paymentStatus: u.paymentStatus,
              paymentMethod: u.paymentMethod,
              paymentSummary: u.paymentSummary,
              isOpenCheck: u.balanceDue > 0.5,
            }
          : o;
      })
    );
    if (onUpdatePosOrders) {
      onUpdatePosOrders(
        appPosOrders.map((po) => {
          const u = map.get(po.id);
          if (!u) return po;
          const paid = u.paymentStatus === 'Paid';
          return {
            ...po,
            paymentMethod: u.paymentMethod as any,
            paymentStatus: paid ? 'Paid' : 'Unpaid',
            status: paid ? 'Settled' : po.status,
            isSettled: paid,
            settledAt: paid ? new Date().toISOString() : (po as any).settledAt,
            ...({
              payments: u.payments,
              amountPaid: u.amountPaid,
              balanceDue: u.balanceDue,
              paymentSummary: u.paymentSummary,
              paymentStatusDetail: u.paymentStatus,
              isOpenCheck: u.balanceDue > 0.5,
            } as any),
          } as PosOrder;
        })
      );
    }
  };

  const reconcileBookingIdsWithPosOrders = (
    bookingIdsToSync: Array<string | undefined>,
    nextAppPosOrders: PosOrder[]
  ) => {
    const validIds = new Set(bookingIdsToSync.filter(Boolean) as string[]);
    if (validIds.size === 0) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const roomStayKinds = new Set<string>([
      'room',
      'extra_bed',
      'extra_person',
      'early_checkin',
      'late_checkout',
    ]);

    const nextBookings = bookings.map((b) => {
      if (!validIds.has(b.id)) return b;
      const rawAppBkg = appBookings.find((ab) => ab.id === b.id);
      const linkedCheckin = appCheckins.find(
        (c) => c.id === b.id || (c as any).bookingId === b.id
      );
      const { bill } = buildStayBill({
        booking: rawAppBkg || b,
        checkin: linkedCheckin || null,
        posOrders: nextAppPosOrders,
        laundryOrders: appLaundryOrders,
        waterBottles: appWaterBottles,
        rooms: appRooms,
        settings: billSettings,
        gstEnabledOverride: b.gstInvoice,
      });

      const deDupedServices: OtherServiceItem[] = bill.chargeLines
        .filter((cl) => !roomStayKinds.has(cl.kind || ''))
        .map((cl, idx) => ({
          id: cl.sourceId || `srv-${b.id}-${idx}`,
          bookingId: b.id,
          orderNumber: cl.sourceId || `ORD-${idx + 1}`,
          roomNumber: cl.roomNumber || b.roomNumbers[0] || '',
          roomName: `Room ${cl.roomNumber || b.roomNumbers[0] || ''}`,
          serviceType:
            cl.kind === 'food'
              ? 'ROOM SERVICE'
              : cl.kind === 'laundry'
              ? 'LAUNDRY'
              : cl.kind === 'water'
              ? 'WATER BOTTLE'
              : cl.kind === 'fine'
              ? 'DAMAGE / FINE'
              : 'SPA / OTHER',
          description: cl.description,
          itemsSummary: cl.description,
          quantity: 1,
          amount: cl.charges,
          taxAmount: 0,
          dateTime: cl.dateLabel || todayIso,
          isPaid: false,
        }));

      const roomSubtotal = r2(
        bill.legacy.roomCharges +
          bill.legacy.extraBedCharges +
          bill.legacy.extraPersonCharges +
          bill.legacy.earlyCheckInCharges +
          bill.legacy.lateCheckOutCharges
      );
      const otherServicesTotal = r2(bill.subtotal - roomSubtotal);

      const updated: BookingRecord = {
        ...b,
        roomSubtotal,
        otherServices: deDupedServices,
        otherServicesTotal,
        taxRate: bill.headlineGstRate,
        taxAmount: bill.totalTax,
        totalPayable: bill.grandTotal,
        amountPaid: bill.receipts,
        dueAmount: bill.balance,
        paymentStatus: bill.paymentStatus === 'Paid' ? 'Fully Paid' : bill.paymentStatus,
      };
      if (selectedBookingForDrawer?.id === b.id) {
        setSelectedBookingForDrawer(updated);
      }
      return updated;
    });

    syncBookingsToDb(nextBookings);
  };

  // 9. Create POS Order (Uses billSettings.foodGstRate; excludes counter-paid Dine-In/Takeaway from room folio; recalculates Room Service via buildStayBill so F&B GST is NEVER taxed twice!)
  const handleCreatePosOrder = (order: PosOrderRecord, postToBookingId?: string) => {
    const isPostToRoom =
      order.paymentMethod === 'Room Charge' ||
      (order.orderType === 'Room Service' && order.paymentStatus === 'Unpaid (Room Folio)');

    const targetBooking = isPostToRoom
      ? bookings.find((b) => b.id === (postToBookingId || order.bookingId)) ||
        (order.roomNumber
          ? bookings.find(
              (b) =>
                b.roomNumbers.includes(String(order.roomNumber)) &&
                b.status !== 'Cancelled' &&
                !b.isCheckedOut
            ) ||
            bookings.find((b) => b.roomNumbers.includes(String(order.roomNumber)))
          : undefined)
      : undefined;

    const effectiveBookingId = isPostToRoom
      ? postToBookingId || order.bookingId || targetBooking?.id
      : undefined;
    const effectiveRoomNumber = isPostToRoom
      ? order.roomNumber || targetBooking?.roomNumbers[0]
      : undefined;

    const enrichedOrder: PosOrderRecord = {
      ...order,
      bookingId: effectiveBookingId,
      roomNumber: effectiveRoomNumber,
      roomName: effectiveRoomNumber ? `Room ${effectiveRoomNumber}` : undefined,
      paymentStatus: isPostToRoom ? 'Unpaid (Room Folio)' : order.paymentStatus || 'Paid',
    };

    setPosOrders((prev) => [enrichedOrder, ...prev]);

    const todayIso = new Date().toISOString().slice(0, 10);
    const rawOrderDt = String(enrichedOrder.dateTime || '').trim();
    const resolvedOrderDate = /^\d{4}-\d{2}-\d{2}/.test(rawOrderDt) ? rawOrderDt.slice(0, 10) : todayIso;
    const dbOrder: PosOrder = {
      id: enrichedOrder.id,
      hotelId: selectedHotelId,
      orderNumber: enrichedOrder.orderNumber,
      orderType:
        enrichedOrder.orderType === 'Room Service'
          ? 'Room Service'
          : enrichedOrder.orderType === 'Takeaway'
          ? 'Takeaway'
          : 'Dine In',
      roomNumber: enrichedOrder.roomNumber,
      bookingId: enrichedOrder.bookingId,
      tableNo: enrichedOrder.tableNumber,
      guestName: enrichedOrder.customerName,
      customerPhone: enrichedOrder.customerPhone,
      items: enrichedOrder.items.map((it) => ({
        itemId: it.itemId,
        itemName: it.name,
        itemCode: it.itemId.slice(-5).toUpperCase(),
        quantity: it.qty,
        price: it.price,
        taxRate: enrichedOrder.isWithoutGst ? 0 : (enrichedOrder.gstRate ?? billSettings.foodGstRate),
        total: it.total,
        ...({
          menuPrice: it.menuPrice,
          overrideReason: it.overrideReason,
          selectedVariant: it.variant,
          variant: it.variant,
          selectedAddons: it.addons,
          addons: it.addons,
          addonPriceTotal: it.addonPriceTotal,
          kitchenStation: it.kitchenStation,
          itemNotes: it.itemNotes,
          itemDiscount: it.itemDiscount,
          itemStatus: it.itemStatus || 'KOT Sent',
        } as any),
      })),
      subtotal: enrichedOrder.subtotal,
      discount: enrichedOrder.discount,
      taxAmount: enrichedOrder.taxAmount,
      grandTotal: enrichedOrder.grandTotal,
      paymentMethod: isPostToRoom ? 'Room Charge' : (enrichedOrder.paymentMethod as any) || 'Cash',
      paymentStatus: isPostToRoom ? 'Unpaid' : enrichedOrder.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
      status: enrichedOrder.isHeld
        ? 'Held'
        : enrichedOrder.kotStatus === 'Cancelled'
        ? 'Cancelled'
        : 'KOT Sent',
      date: resolvedOrderDate,
      ...({
        kitchenStatus: enrichedOrder.kotStatus || 'KOT Sent',
        kotStatus: enrichedOrder.kotStatus || 'KOT Sent',
        notes: enrichedOrder.instructions,
        instructions: enrichedOrder.instructions,
        payments: enrichedOrder.payments,
        amountPaid: enrichedOrder.amountPaid,
        balanceDue: enrichedOrder.balanceDue,
        paymentSummary: enrichedOrder.paymentSummary,
        paymentStatusDetail: enrichedOrder.paymentStatus,
        pax: enrichedOrder.pax,
        waiterName: enrichedOrder.waiterName,
        packagingCharge: enrichedOrder.packagingCharge,
        isOpenCheck: enrichedOrder.isOpenCheck,
        isHeld: enrichedOrder.isHeld,
        holdNote: enrichedOrder.holdNote,
        checkId: enrichedOrder.checkId,
        kotNumber: enrichedOrder.kotNumber,
        isSupplementaryKot: enrichedOrder.isSupplementaryKot,
        reprintCount: enrichedOrder.reprintCount,
        pickupTime: enrichedOrder.pickupTime,
        pickupStatus: enrichedOrder.pickupStatus,
        advanceBookingId: enrichedOrder.advanceBookingId,
        advanceDepositApplied: enrichedOrder.advanceDepositApplied,
        isWithoutGst: enrichedOrder.isWithoutGst,
        customerGstin: enrichedOrder.customerGstin,
        companyName: enrichedOrder.companyName,
        discountMeta: enrichedOrder.discountMeta,
        settlement: enrichedOrder.settlement,
        priceOverrides: enrichedOrder.priceOverrides,
        bomDeducted: enrichedOrder.bomDeducted,
        bomReversed: enrichedOrder.bomReversed,
        bomDeductionSnapshot: enrichedOrder.bomDeductionSnapshot,
        postToRoomBill: isPostToRoom,
        gstRate: enrichedOrder.isWithoutGst ? 0 : (enrichedOrder.gstRate ?? billSettings.foodGstRate),
        gstAmount: enrichedOrder.taxAmount,
        totalAmount: enrichedOrder.grandTotal,
        createdAt: enrichedOrder.dateTime || resolvedOrderDate,
      } as any),
    };

    if (onUpdatePosOrders) {
      onUpdatePosOrders([dbOrder, ...appPosOrders]);
    }

    // Only post to room folio when Room Service / Room Charge (never counter-paid Dine-In/Takeaway!)
    if (isPostToRoom && effectiveBookingId) {
      const nextBookings = bookings.map((b) => {
        if (b.id !== effectiveBookingId) return b;
        const rawAppBkg = appBookings.find((ab) => ab.id === b.id);
        const linkedCheckin = appCheckins.find(
          (c) => c.id === b.id || (c as any).bookingId === b.id
        );
        const { bill } = buildStayBill({
          booking: rawAppBkg || b,
          checkin: linkedCheckin || null,
          posOrders: [dbOrder, ...appPosOrders],
          laundryOrders: appLaundryOrders,
          waterBottles: appWaterBottles,
          rooms: appRooms,
          settings: billSettings,
          gstEnabledOverride: b.gstInvoice,
        });

        const roomStayKinds = new Set<string>([
          'room',
          'extra_bed',
          'extra_person',
          'early_checkin',
          'late_checkout',
        ]);
        const deDupedServices: OtherServiceItem[] = bill.chargeLines
          .filter((cl) => !roomStayKinds.has(cl.kind || ''))
          .map((cl, idx) => ({
            id: cl.sourceId || `srv-${b.id}-${idx}`,
            bookingId: b.id,
            orderNumber: cl.sourceId || `ORD-${idx + 1}`,
            roomNumber: cl.roomNumber || b.roomNumbers[0] || '',
            roomName: `Room ${cl.roomNumber || b.roomNumbers[0] || ''}`,
            serviceType:
              cl.kind === 'food'
                ? 'ROOM SERVICE'
                : cl.kind === 'laundry'
                ? 'LAUNDRY'
                : cl.kind === 'water'
                ? 'WATER BOTTLE'
                : cl.kind === 'fine'
                ? 'DAMAGE / FINE'
                : 'SPA / OTHER',
            description: cl.description,
            itemsSummary: cl.description,
            quantity: 1,
            amount: cl.charges,
            taxAmount: 0,
            dateTime: cl.dateLabel || todayIso,
            isPaid: false,
          }));

        const roomSubtotal = r2(
          bill.legacy.roomCharges +
            bill.legacy.extraBedCharges +
            bill.legacy.extraPersonCharges +
            bill.legacy.earlyCheckInCharges +
            bill.legacy.lateCheckOutCharges
        );
        const otherServicesTotal = r2(bill.subtotal - roomSubtotal);

        const updated: BookingRecord = {
          ...b,
          roomSubtotal,
          otherServices: deDupedServices,
          otherServicesTotal,
          taxRate: bill.headlineGstRate,
          taxAmount: bill.totalTax,
          totalPayable: bill.grandTotal,
          amountPaid: bill.receipts,
          dueAmount: bill.balance,
          paymentStatus: bill.paymentStatus === 'Paid' ? 'Fully Paid' : bill.paymentStatus,
        };
        if (selectedBookingForDrawer?.id === b.id) {
          setSelectedBookingForDrawer(updated);
        }
        return updated;
      });
      syncBookingsToDb(nextBookings);
    }

    logAudit(
      'POS Terminal',
      'POS KOT & Order Created',
      `Created ${enrichedOrder.orderNumber} (${enrichedOrder.orderType}) for ${enrichedOrder.customerName}${enrichedOrder.roomNumber ? ` (Room ${enrichedOrder.roomNumber})` : ''} — ₹${enrichedOrder.grandTotal}.`,
      'info'
    );
  };

  const effectiveHotelProfile = {
    ...INITIAL_HOTEL_PROFILE,
    name: hotelName || hotelSettings?.name || INITIAL_HOTEL_PROFILE.name,
    hotelName: hotelName || hotelSettings?.name || INITIAL_HOTEL_PROFILE.name,
    address: hotelAddress || hotelSettings?.address || INITIAL_HOTEL_PROFILE.address,
    gstin: hotelGst || hotelSettings?.gstNumber || INITIAL_HOTEL_PROFILE.gstin,
    gstNumber:
      hotelGst ||
      hotelSettings?.gstNumber ||
      INITIAL_HOTEL_PROFILE.gstNumber ||
      INITIAL_HOTEL_PROFILE.gstin,
    panNumber: hotelSettings?.panNumber || INITIAL_HOTEL_PROFILE.panNumber || '',
    website: hotelSettings?.website || INITIAL_HOTEL_PROFILE.website || '',
    logoUrl: hotelSettings?.logoUrl || '',
    phone:
      hotelPhone ||
      hotelSettings?.phoneNumber ||
      hotelSettings?.phone ||
      INITIAL_HOTEL_PROFILE.phone,
    email:
      hotelEmail ||
      hotelSettings?.emailAddress ||
      hotelSettings?.email ||
      INITIAL_HOTEL_PROFILE.email,
    checkInTime: hotelSettings?.checkInTime || INITIAL_HOTEL_PROFILE.checkInTime,
    checkOutTime: hotelSettings?.checkOutTime || INITIAL_HOTEL_PROFILE.checkOutTime,
  };

  // Print Guest Registration Card (HOTEL RAJ RESIDENCY Exact PDF Replica)
  const handlePrintGrc = async (targetBkg: BookingRecord) => {
    const rawAppBkg = appBookings.find((ab) => ab.id === targetBkg.id);
    const linkedCheckin = appCheckins.find(
      (c) =>
        c.id === targetBkg.id ||
        (c as any).bookingId === targetBkg.id ||
        c.id === targetBkg.bookingNo
    );
    const persistedRegNo = String(
      targetBkg.grcNumber ||
        (rawAppBkg as any)?.grcNumber ||
        linkedCheckin?.grcNumber ||
        ''
    ).trim();
    const regNo =
      persistedRegNo ||
      (await requestAtomicGrcNumber({
        existingGrc: persistedRegNo,
        checkinId: linkedCheckin?.id || targetBkg.id,
        bookingId: targetBkg.id,
        settings: billSettings,
      })) ||
      'PENDING (Assigned at Check-In)';

    if (!persistedRegNo && regNo) {
      const nextBookings = bookings.map((b) =>
        b.id === targetBkg.id ? { ...b, grcNumber: regNo } : b
      );
      syncBookingsToDb(nextBookings);
      if (selectedBookingForDrawer?.id === targetBkg.id) {
        setSelectedBookingForDrawer({ ...targetBkg, grcNumber: regNo });
      }
    }

    const html = renderGrcHtml(
      toGrcPrintData({
        hotel: { ...effectiveHotelProfile, ...(hotelSettings || {}) },
        regNo,
        booking: rawAppBkg || targetBkg,
        checkin: linkedCheckin || null,
        settings: billSettings,
        terms: hotelSettings?.grcTerms,
      })
    );
    openPrintWindow(html, true);
    logAudit(
      'Front Desk',
      'GRC Printed',
      `Printed Guest Registration Card ${regNo} for ${targetBkg.customerName} (Room ${targetBkg.roomNumbers.join(', ')}).`,
      'info'
    );
  };

  // RBAC Module Permission Enforcement for Staff Logins
  const [rbacMatrix] = useRbacMatrix();
  const normalizedStaffRole = normalizeRbacRole(currentRole);
  const staffUsername =
    typeof window !== 'undefined' ? sessionStorage.getItem('pms_staff_username') : null;
  const activeModulePerm = getRoleModulePermission(
    rbacMatrix,
    currentRole,
    activeTab,
    staffUsername
  );

  // Auto-redirect staff away from modules where View is unchecked in RBAC
  useEffect(() => {
    if (normalizedStaffRole && !activeModulePerm.view) {
      const allowedTabs = getAllowedSidebarTabsForRole(rbacMatrix, currentRole, staffUsername);
      const fallbackTab = allowedTabs.find((t) => t !== 'notifications' && t !== 'profile') || 'dashboard';
      if (fallbackTab && fallbackTab !== activeTab) {
        setActiveTab(fallbackTab);
      }
    }
  }, [normalizedStaffRole, activeModulePerm.view, rbacMatrix, currentRole, staffUsername, activeTab, setActiveTab]);

  // Capture-phase guard to block Create/Edit, Cancel/Delete, or Approve/CSV Export clicks & form submits when unchecked in RBAC
  const handleRbacActionGuardCapture = (e: React.SyntheticEvent<HTMLDivElement>) => {
    if (!normalizedStaffRole) return; // Admin / Owner / SuperAdmin have full access
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (e.type === 'submit' && !activeModulePerm.createEdit) {
      e.preventDefault();
      e.stopPropagation();
      window.alert(
        `Access Restricted (${normalizedStaffRole}): "Create & Edit" permission is disabled for this module in RBAC Module Permissions.`
      );
      return;
    }

    const btn = target.closest('button, a[download]') as HTMLElement | null;
    if (!btn) return;
    const text = `${btn.textContent || ''} ${btn.getAttribute('title') || ''}`.toLowerCase();

    // Never block sub-tab navigation, search, preview, print, GRC, close, or modal dismiss buttons
    if (
      text.includes('close') ||
      text.includes('dismiss') ||
      text.includes('preview') ||
      text.includes('view') ||
      text.includes('print') ||
      text.includes('grc') ||
      text.includes('id doc') ||
      text.includes('back')
    ) {
      return;
    }

    // 1. Check Cancel / Delete permission
    if (!activeModulePerm.deleteCancel) {
      const isDeleteOrCancelAction =
        text.includes('delete') ||
        text.includes('remove') ||
        text.includes('decommission') ||
        text.includes('cancel booking') ||
        text.includes('cancel reservation') ||
        text.includes('no-show') ||
        text.includes('trash');
      if (isDeleteOrCancelAction) {
        e.preventDefault();
        e.stopPropagation();
        window.alert(
          `Access Restricted (${normalizedStaffRole}): "Cancel / Delete" permission is disabled for this module in RBAC Module Permissions.`
        );
        return;
      }
    }

    // 2. Check Approve & CSV Export permission
    if (!activeModulePerm.approveExport) {
      const isExportOrApproveAction =
        text.includes('export') ||
        text.includes('csv') ||
        text.includes('excel') ||
        text.includes('approve') ||
        btn.hasAttribute('download');
      if (isExportOrApproveAction) {
        e.preventDefault();
        e.stopPropagation();
        window.alert(
          `Access Restricted (${normalizedStaffRole}): "Approve & CSV Export" permission is disabled for this module in RBAC Module Permissions.`
        );
        return;
      }
    }

    // 3. Check Create & Edit permission
    if (!activeModulePerm.createEdit) {
      const isCreateOrEditAction =
        btn.getAttribute('type') === 'submit' ||
        text.includes('+ add') ||
        text.includes('add ') ||
        text.includes('create ') ||
        text.includes('new ') ||
        text.includes('save ') ||
        text.includes('edit') ||
        text.includes('update ') ||
        text.includes('check-in') ||
        text.includes('check in') ||
        text.includes('checkout') ||
        text.includes('check-out') ||
        text.includes('book') ||
        text.includes('record') ||
        text.includes('issue') ||
        text.includes('disburse') ||
        text.includes('sync') ||
        text.includes('block') ||
        text.includes('assign') ||
        text.includes('complete');
      if (isCreateOrEditAction) {
        e.preventDefault();
        e.stopPropagation();
        window.alert(
          `Access Restricted (${normalizedStaffRole}): "Create & Edit" permission is disabled for this module in RBAC Module Permissions (View-Only Mode).`
        );
      }
    }
  };

  if (normalizedStaffRole && !activeModulePerm.view) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-3 shadow-xs my-6">
        <div className="text-base font-extrabold text-rose-800">
          🔒 Module Access Restricted ({normalizedStaffRole})
        </div>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Your current role (<strong>{normalizedStaffRole}</strong>) does not have <strong>View Module</strong> permission for this section. Please contact your Hotel Admin to enable it under <em>Staff Workspace → RBAC Module Permissions</em>.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      onClickCapture={handleRbacActionGuardCapture}
      onSubmitCapture={handleRbacActionGuardCapture}
    >
      {normalizedStaffRole &&
        (!activeModulePerm.createEdit ||
          !activeModulePerm.deleteCancel ||
          !activeModulePerm.approveExport) && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-800">
              🛡️ Active Role Policy (<span className="text-amber-800">{normalizedStaffRole}</span>):
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                ✓ View Module
              </span>
              <span
                className={`px-2 py-0.5 rounded ${
                  activeModulePerm.createEdit
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {activeModulePerm.createEdit ? '✓ Create & Edit' : '✕ Create & Edit (Read-Only)'}
              </span>
              <span
                className={`px-2 py-0.5 rounded ${
                  activeModulePerm.deleteCancel
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {activeModulePerm.deleteCancel ? '✓ Cancel / Delete' : '✕ Cancel / Delete'}
              </span>
              <span
                className={`px-2 py-0.5 rounded ${
                  activeModulePerm.approveExport
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {activeModulePerm.approveExport ? '✓ Approve & Export' : '✕ Approve & Export'}
              </span>
            </div>
          </div>
        )}
      {(activeTab === 'dashboard' || activeTab === 'todayBookings') && (
        <DashboardModule
          rooms={rooms}
          bookings={bookings}
          tasks={tasks}
          hotelName={effectiveHotelProfile.name}
          appRooms={appRooms}
          appBookings={appBookings}
          appCheckins={appCheckins}
          appPosOrders={appPosOrders}
          appInvoices={appInvoices}
          roomBlocks={roomBlocks}
          hotelSettings={hotelSettings}
          onUpdateBookings={onUpdateBookings}
          onUpdateRooms={onUpdateRooms}
          onUpdateCheckins={onUpdateCheckins}
          onChangeRoom={handleChangeRoom}
          onOpenQuickAddBooking={(rm, mode = 'checkin') => {
            setPreselectedRoom(rm || null);
            if (mode) {
              const today = new Date().toISOString().slice(0, 10);
              const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
              setDraftBookingSeed({
                checkInDate: today,
                checkOutDate: tomorrow,
                isOpenStay: false,
                numGuests: 2,
                preselectedRoom: rm || undefined,
              });
              try {
                if (rm) {
                  sessionStorage.setItem(
                    'pms_preselect_room',
                    JSON.stringify({
                      roomNumber: rm.number,
                      roomType: rm.category,
                      rate: rm.rate,
                      mode,
                    })
                  );
                }
              } catch {
                // ignore storage errors
              }
              if (setSelectedBookingForCheckin) {
                setSelectedBookingForCheckin(null);
              }
              setActiveTab('frontDesk');
              setFrontDeskSubTab('checkin');
              try {
                if (window.location.pathname !== '/admin/frontDesk/checkin') {
                  window.history.pushState({}, '', '/admin/frontDesk/checkin');
                }
              } catch {
                // ignore
              }
            } else {
              setQuickAddMode('reservations');
              setQuickAddOpen(true);
            }
          }}
          onSelectBooking={(b) => setSelectedBookingForDrawer(b)}
          onOpenCheckIn={(b) => handleRedirectToFullCheckInPage(b)}
          onQuickCheckOut={(b) => setCheckoutClearanceBooking(b)}
          onOpenRecordPayment={(b) => setPaymentBooking(b)}
          onOpenInvoice={(b, scope) =>
            setInvoiceModalState({
              booking: b,
              scope,
              invoiceRecord: findPrimaryInvoiceForBooking(b),
            })
          }
          onOpenRoomTasks={(rm) => {
            setRoomTasksDrawerRoom(rm);
            setIsRoomTasksOpen(true);
          }}
          onOpenRoomOrder={(b) => setRoomOrderBooking(b)}
          onNavigate={handleNavigate}
          onCancelBooking={(b) => {
            handleCancelOrNoShowBooking(
              b.id,
              'Cancelled',
              b.amountPaid,
              'Guest requested cancellation prior to arrival'
            );
          }}
        />
      )}

      {(activeTab === 'frontDesk' ||
        activeTab === 'bookings' ||
        activeTab === 'checkin') && (
        <FrontDeskModule
          activeSubTab={
            activeTab === 'bookings'
              ? 'reservations'
              : activeTab === 'checkin'
              ? 'checkin'
              : frontDeskSubTab
          }
          onSubTabChange={(sub) => {
            setActiveTab('frontDesk');
            setFrontDeskSubTab(sub);
          }}
          rooms={rooms}
          assetGroups={assetGroups}
          bookings={bookings}
          checkins={appCheckins}
          tasks={tasks}
          waterLogs={waterLogs}
          billSettings={billSettings}
          loggedInUser={loggedInUser}
          onPrintGrc={handlePrintGrc}
          draftBookingSeed={draftBookingSeed}
          onClearDraftSeed={() => setDraftBookingSeed(null)}
          onSaveFullBooking={handleSaveFullBooking}
          onSelectBooking={(b) => setSelectedBookingForDrawer(b)}
          onOpenCheckIn={(b) => handleRedirectToFullCheckInPage(b)}
          onQuickCheckOut={(b) => setCheckoutClearanceBooking(b)}
          onOpenRecordPayment={(b) => setPaymentBooking(b)}
          onOpenInvoice={(b, scope) =>
            setInvoiceModalState({
              booking: b,
              scope,
              invoiceRecord: findPrimaryInvoiceForBooking(b),
            })
          }
          onOpenPreviewDocument={(guest, bookingNo) => setPreviewDocState({ guest, bookingNo })}
          onUpdateGuestDoc={handleUpdateGuestDocument}
          onOpenRoomOrder={(b) => setRoomOrderBooking(b)}
          onDeleteGuestRecord={
            onCascadeDeleteGuest
              ? (target) => {
                  const idSet = new Set([target.bookingId, target.checkinId].filter(Boolean).map(String));
                  const nextBookings = bookings.filter(
                    (b) => !idSet.has(String(b.id)) && (!target.bookingRef || b.bookingNo !== target.bookingRef)
                  );
                  setBookings(nextBookings);
                  setInvoices((prev) => prev.filter((inv) => !idSet.has(String(inv.bookingId))));
                  setVouchers((prev) => prev.filter((v) => !idSet.has(String((v as any).sourceId || ''))));
                  setPosOrders((prev) => prev.filter((po) => !idSet.has(String((po as any).bookingId || ''))));
                  setWaterLogs((prev) => prev.filter((w) => !idSet.has(String((w as any).bookingId || ''))));
                  if (selectedBookingForDrawer && idSet.has(String(selectedBookingForDrawer.id))) {
                    setSelectedBookingForDrawer(null);
                  }
                  const rmNums = new Set((target.roomNumbers || []).map((n) => String(n).trim()));
                  if (rmNums.size > 0) {
                    const stillActiveRooms = new Set<string>();
                    nextBookings.forEach((b) => {
                      if (b.isCheckedIn && !b.isCheckedOut) {
                        (b.roomNumbers || []).forEach((rn) => stillActiveRooms.add(String(rn).trim()));
                      }
                    });
                    setRooms((prev) =>
                      prev.map((r) =>
                        rmNums.has(String(r.number).trim()) &&
                        !stillActiveRooms.has(String(r.number).trim()) &&
                        (r.status === 'Occupied' || r.status === 'Reserved')
                          ? { ...r, status: 'Available' as const }
                          : r
                      )
                    );
                  }
                  onCascadeDeleteGuest({ ...target, hotelId: selectedHotelId });
                }
              : undefined
          }
          onAddWaterLog={(entry) => {
            const newId = `WB-${Date.now()}`;
            const todayIso = new Date().toISOString().slice(0, 10);
            const totalQty = Math.max(1, Number(entry.qty) || 1);
            const chgQty =
              entry.extraChargeableCount !== undefined
                ? Math.max(0, Number(entry.extraChargeableCount) || 0)
                : entry.isChargeable
                ? totalQty
                : 0;
            const freeQty =
              entry.complimentaryCount !== undefined
                ? Math.max(0, Number(entry.complimentaryCount) || 0)
                : Math.max(0, totalQty - chgQty);
            const rate =
              Number(entry.ratePerBottle) > 0
                ? r2(entry.ratePerBottle)
                : billSettings.waterBottleRate;
            const amount = r2(entry.amount ?? chgQty * rate);
            const matchedStay = bookings.find(
              (b) =>
                (entry.bookingId && b.id === entry.bookingId) ||
                (b.roomNumbers.includes(entry.roomNumber) && b.isCheckedIn && !b.isCheckedOut)
            );
            const fullEntry: WaterBottleLogEntry = {
              id: newId,
              date: entry.date || todayIso,
              dateTime: entry.dateTime || new Date().toLocaleString('en-IN'),
              roomNumber: entry.roomNumber,
              bookingId: entry.bookingId || matchedStay?.id,
              checkInId: entry.checkInId || matchedStay?.id,
              guestName: entry.guestName || matchedStay?.customerName || 'In-House Guest',
              qty: totalQty,
              complimentaryCount: freeQty,
              extraChargeableCount: chgQty,
              ratePerBottle: rate,
              isChargeable: chgQty > 0,
              amount,
              deliveredBy: entry.deliveredBy || loggedInUser || 'Front Desk',
            };
            setWaterLogs((prev) => [fullEntry, ...prev]);
            if (onUpdateWaterBottles) {
              // Store BOTH legacy fields & hub fields so 0-bottle bugs never happen!
              const dbWater: WaterBottleRecord = {
                id: newId,
                hotelId: selectedHotelId,
                roomNumber: fullEntry.roomNumber,
                guestName: fullEntry.guestName,
                bookingId: fullEntry.bookingId,
                checkInId: fullEntry.checkInId,
                recordType: 'water',
                quantity: totalQty,
                unitPrice: rate,
                totalAmount: amount,
                chargeAmount: amount,
                isChargeable: chgQty > 0,
                deliveredBy: fullEntry.deliveredBy,
                date: todayIso,
                dateTime: fullEntry.dateTime,
                ...({
                  complimentaryCount: freeQty,
                  extraChargeableCount: chgQty,
                  ratePerBottle: rate,
                  totalCharge: amount,
                  suppliedBy: fullEntry.deliveredBy,
                } as any),
              };
              onUpdateWaterBottles([dbWater, ...appWaterBottles]);
            }
          }}
          onExtendStay={handleExtendStay}
          onChangeRoom={handleChangeRoom}
          onCancelOrNoShowBooking={handleCancelOrNoShowBooking}
        />
      )}

      {(activeTab === 'calendar' ||
        (activeTab === 'frontDesk' && frontDeskSubTab === 'calendar')) && (
        <CalendarBookingView
          rooms={appRooms}
          bookings={appBookings}
          checkins={appCheckins}
          roomBlocks={roomBlocks}
          hubBookings={bookings}
          currentRole={currentRole}
          loggedInUser={loggedInUser}
          autoMarkDirtyOnCheckout={hotelSettings?.autoMarkDirtyOnCheckout !== false}
          allowBackDatedCheckIn={Boolean(hotelSettings?.allowBackDatedCheckIn)}
          setActiveTab={setActiveTab}
          setFrontDeskSubTab={setFrontDeskSubTab}
          onUpdateBookings={(b) => onUpdateBookings && onUpdateBookings(b)}
          onUpdateRooms={(r) => onUpdateRooms && onUpdateRooms(r)}
          onUpdateCheckins={(c) => onUpdateCheckins && onUpdateCheckins(c)}
          onAddAuditLog={onAddAuditLog}
          onSelectHubBooking={(b) => setSelectedBookingForDrawer(b)}
          onOpenCheckInHub={(b) => handleRedirectToFullCheckInPage(b)}
          onOpenCheckOutHub={(b) => setCheckoutClearanceBooking(b)}
          onCancelOrNoShowHub={handleCancelOrNoShowBooking}
        />
      )}

      {activeTab === 'invoice' && (
        <InvoiceModule
          activeSubTab={invoiceSubTab}
          onSubTabChange={setInvoiceSubTab}
          invoices={invoices}
          bookings={bookings}
          billSettings={billSettings}
          hotelSettings={hotelSettings}
          appBookings={appBookings}
          appCheckins={appCheckins}
          posOrders={appPosOrders}
          laundryOrders={appLaundryOrders}
          waterBottles={appWaterBottles}
          rooms={appRooms}
          onOpenInvoiceModal={(b, scope, invRec) =>
            setInvoiceModalState({
              booking: b,
              scope,
              invoiceRecord: invRec || findPrimaryInvoiceForBooking(b),
            })
          }
          onOpenRecordPayment={(b) => setPaymentBooking(b)}
          onCreateSeparateInvoice={handleCreateSeparateInvoiceInHub}
          onEditInvoice={(invRec) => setEditInvoiceId(invRec.id)}
        />
      )}

      {activeTab === 'rooms' && (
        <RoomManagementView
          rooms={appRooms}
          currentRole={currentRole as any}
          onUpdateRooms={(r) => onUpdateRooms && onUpdateRooms(r)}
          bookings={appBookings}
          onUpdateBookings={(b) => onUpdateBookings && onUpdateBookings(b)}
          activeSubTab={roomSubTab}
          onSubTabChange={(st) => setRoomSubTab && setRoomSubTab(st)}
          hotelSettings={{
            id: selectedHotelId,
            name: hotelName || 'Hotel Royal Palace',
            gstNumber: hotelGst || '',
            phone: hotelPhone || '',
            email: hotelEmail || '',
            address: hotelAddress || '',
            ...effectiveHotelProfile,
            ...(hotelSettings || {}),
          } as any}
          onUpdateHotelSettings={(updated) => {
            if (onUpdateHotelSettings) onUpdateHotelSettings(updated);
            logAudit('Room Management', 'Settings Updated', 'Updated room & hotel tariff settings', 'info');
          }}
          auditLogs={appAuditLogs}
          onAddAuditLog={(action, details) => logAudit('Room Management', action, details, 'info')}
        />
      )}

      {activeTab === 'housekeeping' && (
        <HousekeepingModule
          activeSubTab={housekeepingSubTab}
          onSubTabChange={setHousekeepingSubTab}
          rooms={rooms}
          staff={staff}
          tasks={tasks}
          laundryOrders={laundryOrders}
          lostFound={lostFound}
          autoMarkDirtyOnCheckout={hotelSettings?.autoMarkDirtyOnCheckout !== false}
          onToggleAutoMarkDirty={(enabled) => {
            if (onUpdateHotelSettings) {
              onUpdateHotelSettings({ ...(hotelSettings || {}), autoMarkDirtyOnCheckout: enabled });
            }
            logAudit(
              'Housekeeping Settings',
              'Auto-Dirty on Checkout Updated',
              `Set automatic post-checkout room Dirty status to ${enabled ? 'ENABLED' : 'DISABLED'}.`,
              'info'
            );
          }}
          onUpdateRoomHousekeeping={handleUpdateRoomHousekeeping}
          onCompleteTask={handleCompleteTask}
          onAddTask={(t) => {
            const newId = `HK-${Date.now()}`;
            setTasks((prev) => [{ id: newId, ...t }, ...prev]);
            if (onUpdateCleaningLogs) {
              const newLog: HousekeepingCleaningLog = {
                id: newId,
                hotelId: selectedHotelId,
                roomNumber: t.roomNumber,
                assignedStaff: t.assignedTo,
                assignedAt: t.timing || new Date().toLocaleString('en-IN'),
                status: 'Assigned',
                checklistCompleted: [],
                notes: t.description,
              };
              onUpdateCleaningLogs([newLog, ...appCleaningLogs]);
            }
          }}
          onAddLaundryOrder={(ord) => {
            const newId = `LND-${Date.now()}`;
            setLaundryOrders((prev) => [{ id: newId, ...ord }, ...prev]);
            if (onUpdateLaundryOrders) {
              const dbLaundry: LaundryOrder = {
                id: newId,
                orderNumber: ord.orderNumber || newId,
                hotelId: selectedHotelId,
                orderType: ord.orderType === 'Hotel Linen' ? 'Hotel Linen Laundry' : 'Guest Laundry',
                roomNumber: ord.roomNumber,
                guestName: ord.guestName,
                items: [
                  {
                    itemId: `li-${Date.now()}`,
                    name: ord.itemsSummary,
                    unitPrice: ord.totalAmount,
                    quantity: 1,
                    total: ord.totalAmount,
                  },
                ],
                totalAmount: ord.totalAmount,
                paymentStatus: ord.paymentStatus === 'Paid' ? 'Paid' : 'Billed to Room',
                deliveryStatus: 'In Wash',
                date: ord.date,
                handledBy: ord.handledBy,
              };
              onUpdateLaundryOrders([dbLaundry, ...appLaundryOrders]);
            }
            if (ord.paymentStatus === 'Billed to Room' && ord.roomNumber && ord.totalAmount > 0) {
              const nextBookings = bookings.map((b) => {
                if (!b.roomNumbers.includes(ord.roomNumber!) || b.status === 'Checked Out' || b.status === 'Cancelled') {
                  return b;
                }
                const newSrv = {
                  id: `SRV-LND-${Date.now()}`,
                  bookingId: b.id,
                  orderNumber: ord.orderNumber,
                  roomNumber: ord.roomNumber!,
                  roomName: `Room ${ord.roomNumber}`,
                  serviceType: 'LAUNDRY' as const,
                  description: `Guest Laundry (${ord.itemsSummary})`,
                  itemsSummary: ord.itemsSummary,
                  quantity: 1,
                  amount: ord.totalAmount,
                  taxAmount: 0,
                  dateTime: ord.date,
                  isPaid: false,
                };
                return {
                  ...b,
                  otherServices: [newSrv, ...b.otherServices],
                  otherServicesTotal: b.otherServicesTotal + ord.totalAmount,
                  totalPayable: b.totalPayable + ord.totalAmount,
                  dueAmount: Math.max(0, b.dueAmount + ord.totalAmount),
                };
              });
              syncBookingsToDb(nextBookings);
            }
          }}
          loggedInUser={loggedInUser}
          onAddLostFound={(item) => {
            const newId = `LF-${Date.now()}`;
            const fullRecord = { id: newId, ...item };
            setLostFound((prev) => [fullRecord, ...prev]);
            if (onUpdateLostAndFoundItems) {
              const dbLf: LostAndFoundItem = {
                id: newId,
                hotelId: selectedHotelId,
                recordType: item.recordType || 'found',
                itemName: item.itemName,
                category: (item.category as any) || 'Others',
                description: item.description,
                roomNumber: item.roomNumber,
                bookingId: item.bookingId,
                checkInId: item.checkInId,
                source: item.source || 'Register',
                locationFound: item.locationFound || `Room ${item.roomNumber}`,
                foundByStaff: item.foundBy || loggedInUser || 'Staff',
                dateFound: item.dateFound,
                storageLocation: item.storageLocation,
                guestName: item.guestName,
                guestMobile: item.guestMobile,
                guestEmail: item.guestEmail,
                dateReported: item.dateReported,
                lastSeenLocation: item.lastSeenLocation,
                reportedByStaff: item.reportedByStaff,
                status: item.status || (item.recordType === 'lost' ? 'Lost – Reported' : 'Found – Registered'),
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString(),
                auditHistory: item.auditHistory,
              };
              onUpdateLostAndFoundItems([dbLf, ...appLostAndFoundItems]);
            }
            logAudit('Lost & Found', item.recordType === 'lost' ? 'Lost Item Reported' : 'Found Item Registered', `${item.itemName} (${item.category}, Room ${item.roomNumber || 'N/A'})`, 'info');
          }}
          onUpdateLostFound={(id, patch) => {
            setLostFound((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
            if (onUpdateLostAndFoundItems) {
              const nextDb = appLostAndFoundItems.map((lf) =>
                lf.id === id
                  ? {
                      ...lf,
                      ...patch,
                      claimedByGuest: patch.claimedBy ?? lf.claimedByGuest,
                      foundByStaff: patch.foundBy ?? lf.foundByStaff,
                    }
                  : lf
              );
              onUpdateLostAndFoundItems(nextDb);
            }
          }}
          onUpdateAllLostFound={(nextAll) => {
            setLostFound(nextAll);
            if (onUpdateLostAndFoundItems) {
              const nextDb: LostAndFoundItem[] = nextAll.map((it) => ({
                id: it.id,
                hotelId: it.hotelId || selectedHotelId,
                recordType: it.recordType || 'found',
                itemName: it.itemName,
                category: it.category || 'Others',
                description: it.description,
                roomNumber: it.roomNumber,
                bookingId: it.bookingId,
                checkInId: it.checkInId,
                source: it.source,
                locationFound: it.locationFound || `Room ${it.roomNumber}`,
                foundByStaff: it.foundBy || 'Staff',
                dateFound: it.dateFound,
                storageLocation: it.storageLocation,
                guestName: it.guestName,
                guestMobile: it.guestMobile,
                guestEmail: it.guestEmail,
                dateReported: it.dateReported,
                lastSeenLocation: it.lastSeenLocation,
                reportedByStaff: it.reportedByStaff,
                matchedItemId: it.matchedItemId,
                matchedItemName: it.matchedItemName,
                matchedBy: it.matchedBy,
                matchedAt: it.matchedAt,
                matchNotes: it.matchNotes,
                status: it.status,
                claimedByGuest: it.claimedBy,
                claimGuestMobile: it.claimGuestMobile,
                claimIdProof: it.claimIdProof,
                claimDate: it.claimDate,
                returnedBy: it.returnedBy,
                returnNotes: it.returnNotes,
                closedAt: it.closedAt,
                closedBy: it.closedBy,
                closedReason: it.closedReason,
                createdAt: it.createdAt,
                updatedAt: it.updatedAt,
                auditHistory: it.auditHistory,
              }));
              onUpdateLostAndFoundItems(nextDb);
            }
          }}
        />
      )}

      {activeTab === 'pos' && (
        <PosModule
          activeSubTab={posSubTab}
          onSubTabChange={setPosSubTab}
          menuItems={posMenu}
          orders={posOrders}
          bookings={bookings}
          hotelId={selectedHotelId}
          hotelName={effectiveHotelProfile.name}
          loggedInUser={loggedInUser}
          foodGstRate={billSettings.foodGstRate}
          inventoryItems={inventoryItems}
          hotelSettings={{ ...effectiveHotelProfile, ...(hotelSettings || {}) }}
          onUpdateHotelSettings={onUpdateHotelSettings}
          onRecordStockMovement={recordWarehouseStockMovement}
          posAdvanceBookings={appPosAdvanceBookings}
          onUpdatePosAdvanceBookings={onUpdatePosAdvanceBookings}
          posCategories={appPosCategories}
          onUpdatePosCategories={onUpdatePosCategories}
          posTables={appPosTables}
          onUpdatePosTables={onUpdatePosTables}
          currentRole={currentRole}
          onAddAuditLog={onAddAuditLog}
          onSettlePosOrders={handleSettlePosOrders}
          onCreatePosOrder={handleCreatePosOrder}
          onUpdateKotStatus={(ordId, status) => {
            setPosOrders((prev) =>
              prev.map((o) => (o.id === ordId ? { ...o, kotStatus: status } : o))
            );
            const nextAppOrders = appPosOrders.map((po) =>
              po.id === ordId
                ? ({
                    ...po,
                    status: status === 'Cancelled' ? 'Cancelled' : po.status,
                    kitchenStatus: status as any,
                    kotStatus: status,
                  } as any)
                : po
            );
            if (onUpdatePosOrders) {
              onUpdatePosOrders(nextAppOrders);
            }
            const targetOrd = appPosOrders.find((po) => po.id === ordId);
            if (targetOrd?.bookingId) {
              reconcileBookingIdsWithPosOrders([targetOrd.bookingId], nextAppOrders);
            }
          }}
          onUpdatePosOrder={(updatedOrd) => {
            const prevOrd = posOrders.find((o) => o.id === updatedOrd.id);
            setPosOrders((prev) => prev.map((o) => (o.id === updatedOrd.id ? updatedOrd : o)));
            const nextAppOrders = appPosOrders.map((po) =>
              po.id === updatedOrd.id
                ? ({
                    ...po,
                    orderType:
                      updatedOrd.orderType === 'Room Service'
                        ? 'Room Service'
                        : updatedOrd.orderType === 'Takeaway'
                        ? 'Takeaway'
                        : 'Dine In',
                    roomNumber: updatedOrd.roomNumber,
                    roomName: updatedOrd.roomName,
                    bookingId: updatedOrd.bookingId,
                    tableNo: updatedOrd.tableNumber,
                    tableNumber: updatedOrd.tableNumber,
                    pax: updatedOrd.pax,
                    waiterName: updatedOrd.waiterName,
                    guestName: updatedOrd.customerName,
                    customerName: updatedOrd.customerName,
                    customerPhone: updatedOrd.customerPhone,
                    subtotal: updatedOrd.subtotal,
                    discount: updatedOrd.discount,
                    packagingCharge: updatedOrd.packagingCharge,
                    taxAmount: updatedOrd.taxAmount,
                    gstAmount: updatedOrd.taxAmount,
                    grandTotal: updatedOrd.grandTotal,
                    totalAmount: updatedOrd.grandTotal,
                    notes: updatedOrd.instructions,
                    instructions: updatedOrd.instructions,
                    pickupTime: updatedOrd.pickupTime,
                    isWithoutGst: updatedOrd.isWithoutGst,
                    gstRate: updatedOrd.gstRate,
                    customerGstin: updatedOrd.customerGstin,
                    companyName: updatedOrd.companyName,
                    date: /^\d{4}-\d{2}-\d{2}/.test(String(updatedOrd.dateTime || '').trim())
                      ? String(updatedOrd.dateTime).trim().slice(0, 10)
                      : po.date,
                    createdAt: updatedOrd.dateTime || (po as any).createdAt || po.date,
                    discountMeta: updatedOrd.discountMeta,
                    settlement: updatedOrd.settlement,
                    priceOverrides: updatedOrd.priceOverrides,
                    bomDeducted: updatedOrd.bomDeducted,
                    bomReversed: updatedOrd.bomReversed,
                    bomDeductionSnapshot: updatedOrd.bomDeductionSnapshot,
                    postToRoomBill:
                      updatedOrd.paymentMethod === 'Room Charge' ||
                      updatedOrd.paymentStatus === 'Unpaid (Room Folio)',
                    status: updatedOrd.isHeld
                      ? 'Held'
                      : updatedOrd.kotStatus === 'Cancelled'
                      ? 'Cancelled'
                      : updatedOrd.paymentStatus === 'Paid'
                      ? 'Settled'
                      : 'KOT Sent',
                    kitchenStatus: updatedOrd.kotStatus as any,
                    kotStatus: updatedOrd.kotStatus,
                    paymentMethod: updatedOrd.paymentMethod as any,
                    paymentStatus: updatedOrd.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
                    paymentStatusDetail: updatedOrd.paymentStatus,
                    payments: updatedOrd.payments,
                    amountPaid: updatedOrd.amountPaid,
                    balanceDue: updatedOrd.balanceDue,
                    paymentSummary: updatedOrd.paymentSummary,
                    isOpenCheck: updatedOrd.isOpenCheck,
                    isHeld: updatedOrd.isHeld,
                    holdNote: updatedOrd.holdNote,
                    reprintCount: updatedOrd.reprintCount,
                    pickupStatus: updatedOrd.pickupStatus,
                    voidedAt: updatedOrd.voidedAt,
                    voidReason: updatedOrd.voidReason,
                    voidedBy: updatedOrd.voidedBy,
                    refundAmount: updatedOrd.refundAmount,
                    items: updatedOrd.items.map((it) => ({
                      itemId: it.itemId,
                      itemName: it.name,
                      itemCode: it.itemId.slice(-5).toUpperCase(),
                      quantity: it.qty,
                      price: it.price,
                      taxRate: updatedOrd.isWithoutGst
                        ? 0
                        : (updatedOrd.gstRate ?? billSettings.foodGstRate),
                      total: it.total,
                      menuPrice: it.menuPrice,
                      overrideReason: it.overrideReason,
                      selectedVariant: it.variant,
                      variant: it.variant,
                      selectedAddons: it.addons,
                      addons: it.addons,
                      addonPriceTotal: it.addonPriceTotal,
                      kitchenStation: it.kitchenStation,
                      itemNotes: it.itemNotes,
                      itemDiscount: it.itemDiscount,
                      itemStatus: it.itemStatus,
                    })),
                  } as any)
                : po
            );
            if (onUpdatePosOrders) {
              onUpdatePosOrders(nextAppOrders);
            }
            reconcileBookingIdsWithPosOrders(
              [prevOrd?.bookingId, updatedOrd.bookingId],
              nextAppOrders
            );
          }}
          onAddMenuItem={(item) => {
            setPosMenu((prev) => [...prev, item]);
            if (onUpdatePosItems) {
              const dbItem: PosItem = {
                ...(item as any),
                id: item.id,
                hotelId: selectedHotelId,
                code: item.code,
                name: item.name,
                category: item.category,
                price: item.price,
                taxRate: item.taxRate,
                isVeg: Boolean(item.isVeg),
                available: item.available !== false,
                kitchenStation: item.kitchenStation,
              };
              onUpdatePosItems([...appPosItems, dbItem]);
            }
          }}
          onUpdateMenuItem={(item) => {
            setPosMenu((prev) => prev.map((m) => (m.id === item.id ? item : m)));
            if (onUpdatePosItems) {
              const dbItem: PosItem = {
                ...(item as any),
                id: item.id,
                hotelId: selectedHotelId,
                code: item.code,
                name: item.name,
                category: item.category,
                price: item.price,
                taxRate: item.taxRate,
                isVeg: Boolean(item.isVeg),
                available: item.available !== false,
                kitchenStation: item.kitchenStation,
              };
              onUpdatePosItems(appPosItems.map((pi) => (pi.id === item.id ? dbItem : pi)));
            }
          }}
          onDeleteMenuItem={(itemId) => {
            setPosMenu((prev) => prev.filter((m) => m.id !== itemId));
            if (onUpdatePosItems) {
              onUpdatePosItems(appPosItems.filter((pi) => pi.id !== itemId));
            }
          }}
        />
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Header Switcher: Integrated Store Hub vs Full Products & Stock Catalog */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs no-print">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-slate-900 text-sm sm:text-base">
                  Hotel Inventory & Store Stock Control
                </h2>
                <p className="text-[11px] text-slate-500 font-sans">
                  Manage hotel store items, suppliers, water bottles, dynamic SKUs, and stock IN / OUT movements.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setInventoryViewMode('modern')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  inventoryViewMode === 'modern'
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Store Stock Hub
              </button>
              <button
                type="button"
                onClick={() => setInventoryViewMode('catalog')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  inventoryViewMode === 'catalog'
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Products & Stock Catalog
              </button>
            </div>
          </div>

          {inventoryViewMode === 'modern' ? (
            <InventoryModule
          activeSubTab={inventorySubTab}
          onSubTabChange={setInventorySubTab}
          items={inventoryItems}
          suppliers={suppliers}
          purchases={purchases}
          movements={stockMovements}
          onAddInventoryItem={(newItem) => {
            setInventoryItems((prev) => [...prev, newItem]);
            if (onUpdateInventoryProducts) {
              const dbProd: InventoryProduct = {
                id: newItem.id,
                hotelId: selectedHotelId,
                code: newItem.code,
                name: newItem.name,
                category: newItem.category,
                unit: newItem.unit,
                purchasePrice: newItem.purchasePrice,
                currentStock: newItem.currentStock,
                minimumStock: newItem.minStock,
                status: newItem.currentStock <= newItem.minStock ? 'Low Stock' : 'In Stock',
                lastUpdated: newItem.lastUpdated,
                ...(newItem.supplierName ? ({ supplierName: newItem.supplierName } as any) : {}),
              };
              onUpdateInventoryProducts([...appInventoryProducts, dbProd]);
            }
          }}
          onUpdateInventoryItem={(updatedItem) => {
            setInventoryItems((prev) =>
              prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
            );
            if (onUpdateInventoryProducts) {
              const existsInDb = appInventoryProducts.some((ip) => ip.id === updatedItem.id);
              const nextDbProd: InventoryProduct = {
                id: updatedItem.id,
                hotelId: selectedHotelId,
                code: updatedItem.code,
                name: updatedItem.name,
                category: updatedItem.category,
                unit: updatedItem.unit,
                purchasePrice: updatedItem.purchasePrice,
                currentStock: updatedItem.currentStock,
                minimumStock: updatedItem.minStock,
                status: updatedItem.currentStock <= updatedItem.minStock ? 'Low Stock' : 'In Stock',
                lastUpdated: updatedItem.lastUpdated,
                ...(updatedItem.supplierName ? ({ supplierName: updatedItem.supplierName } as any) : {}),
              };
              onUpdateInventoryProducts(
                existsInDb
                  ? appInventoryProducts.map((ip) => (ip.id === updatedItem.id ? nextDbProd : ip))
                  : [...appInventoryProducts, nextDbProd]
              );
            }
            // Sync name & unit inside any linked POS Recipe BOM ingredients
            const hasLinkedPosItem = posMenu.some((m) =>
              m.recipeIngredients?.some((ri) => ri.inventoryItemId === updatedItem.id)
            );
            if (hasLinkedPosItem) {
              setPosMenu((prev) =>
                prev.map((m) =>
                  m.recipeIngredients?.some((ri) => ri.inventoryItemId === updatedItem.id)
                    ? {
                        ...m,
                        recipeIngredients: m.recipeIngredients.map((ri) =>
                          ri.inventoryItemId === updatedItem.id
                            ? { ...ri, ingredientName: updatedItem.name, unit: updatedItem.unit }
                            : ri
                        ),
                      }
                    : m
                )
              );
              if (onUpdatePosItems) {
                onUpdatePosItems(
                  appPosItems.map((pi) => {
                    const recs = (pi as any).recipeIngredients as any[] | undefined;
                    if (!Array.isArray(recs) || !recs.some((ri) => ri.inventoryItemId === updatedItem.id)) {
                      return pi;
                    }
                    return {
                      ...pi,
                      recipeIngredients: recs.map((ri) =>
                        ri.inventoryItemId === updatedItem.id
                          ? { ...ri, ingredientName: updatedItem.name, unit: updatedItem.unit }
                          : ri
                      ),
                    } as PosItem;
                  })
                );
              }
            }
          }}
          onDeleteInventoryItem={(itemId) => {
            setInventoryItems((prev) => prev.filter((it) => it.id !== itemId));
            if (onUpdateInventoryProducts) {
              onUpdateInventoryProducts(appInventoryProducts.filter((ip) => ip.id !== itemId));
            }
          }}
          onAddSupplier={(newSup) => {
            setSuppliers((prev) => [newSup, ...prev]);
            if (onUpdateInventorySuppliers) {
              const dbSup: InventorySupplier = {
                id: newSup.id,
                hotelId: selectedHotelId,
                name: newSup.name,
                mobile: newSup.mobile,
                gst: newSup.gstin,
                address: newSup.city,
              };
              onUpdateInventorySuppliers([dbSup, ...appInventorySuppliers]);
            }
          }}
          onAddPurchase={(newPo) => {
            setPurchases((prev) => [newPo, ...prev]);
            if (onUpdateInventoryPurchases) {
              const dbPo: InventoryPurchase = {
                id: newPo.id,
                hotelId: selectedHotelId,
                purchaseNumber: newPo.poNumber,
                supplierId: 'sup-1',
                supplierName: newPo.supplierName,
                date: newPo.date,
                items: [
                  {
                    productId: 'prod-1',
                    productName: newPo.itemsSummary,
                    productCode: 'SKU',
                    quantity: 1,
                    unitPrice: newPo.totalAmount,
                    totalPrice: newPo.totalAmount,
                  },
                ],
                grandTotal: newPo.totalAmount,
                paymentStatus: newPo.paymentStatus,
                status: 'Completed',
              };
              onUpdateInventoryPurchases([dbPo, ...appInventoryPurchases]);
            }
          }}
          onRecordStockMovement={recordWarehouseStockMovement}
        />
          ) : (
            <InventoryView
              products={appInventoryProducts}
              onUpdateProducts={onUpdateInventoryProducts || (() => {})}
              categories={appInventoryCategories}
              onUpdateCategories={onUpdateInventoryCategories || (() => {})}
              suppliers={appInventorySuppliers}
              onUpdateSuppliers={onUpdateInventorySuppliers || (() => {})}
              purchases={appInventoryPurchases}
              onUpdatePurchases={onUpdateInventoryPurchases || (() => {})}
              stockMovements={appInventoryStockMovements}
              onUpdateStockMovements={onUpdateInventoryMovements || (() => {})}
              selectedHotelId={selectedHotelId}
              onAddAuditLog={onAddAuditLog}
            />
          )}
        </div>
      )}

      {activeTab === 'otaManager' && (
        <OtaManagerModule
          activeSubTab={otaSubTab}
          onSubTabChange={setOtaSubTab}
          channels={otaChannels}
          rooms={rooms}
          assetGroups={assetGroups}
          bookings={bookings}
          appBookings={appBookings}
          travelAgents={appTravelAgents}
          agentCommissionPayments={appAgentCommissionPayments}
          onUpdateTravelAgents={onUpdateTravelAgents}
          onUpdateAgentCommissionPayments={onUpdateAgentCommissionPayments}
          onAddAuditLog={onAddAuditLog}
          selectedHotelId={selectedHotelId}
          hotelName={effectiveHotelProfile.name}
          currentRole={currentRole}
          loggedInUser={loggedInUser}
          onSyncChannel={(chId) => {
            const nextChannels = otaChannels.map((c) =>
              c.id === chId ? { ...c, lastSync: new Date().toLocaleTimeString('en-IN') } : c
            );
            setOtaChannels(nextChannels);
            persistModuleCollectionToApi('otaChannels', nextChannels);
          }}
          onToggleChannelConnection={(chId) => {
            const nextChannels = otaChannels.map((c) =>
              c.id === chId
                ? {
                    ...c,
                    connected: !c.connected,
                    status: (!c.connected ? 'Healthy' : 'Disconnected') as OtaChannelRecord['status'],
                  }
                : c
            );
            setOtaChannels(nextChannels);
            persistModuleCollectionToApi('otaChannels', nextChannels);
          }}
          onSaveChannelCredentials={(chId, updates) => {
            const nextChannels = otaChannels.map((c) => (c.id === chId ? { ...c, ...updates } : c));
            setOtaChannels(nextChannels);
            persistModuleCollectionToApi('otaChannels', nextChannels);
            logAudit(
              'OTA Channel Manager',
              'OTA API Key & Webhook Saved',
              `Updated API credentials for channel ${chId} (${updates.hotelCode || ''}).`,
              'success'
            );
          }}
          onSimulateOtaBooking={() => {
            setQuickAddOpen(true);
          }}
        />
      )}

      {(activeTab === 'finance' || activeTab === 'expenses') && (
        <FinanceModule
          activeSubTab={activeTab === 'expenses' ? 'expenses' : financeSubTab}
          onSubTabChange={(sub) => {
            setActiveTab('finance');
            setFinanceSubTab(sub);
          }}
          bookings={bookings}
          posOrders={posOrders}
          laundryOrders={laundryOrders}
          purchases={purchases}
          suppliers={suppliers}
          invoices={invoices}
          otaSettlements={otaSettlements}
          expenses={expenses}
          vouchers={vouchers}
          accounts={accounts}
          pettyCash={pettyCash}
          ownerLedger={ownerPayments}
          reimbursements={reimbursements}
          dailyClosings={dailyClosings}
          vendorBills={vendorBills}
          miscIncome={miscIncome}
          onAddExpense={(exp) => {
            const newId = `EXP-${Date.now()}`;
            const newExpRecord: FinanceExpenseRecord = { id: newId, ...exp };
            const nextExpenses = [newExpRecord, ...expenses];
            setExpenses(nextExpenses);
            persistModuleCollectionToApi('expenses', nextExpenses);
            if (onUpdateExpenses) {
              const dbExp: Expense = {
                id: newId,
                hotelId: selectedHotelId,
                expenseNo: exp.expenseNo,
                department: exp.department,
                category: exp.category,
                amount: exp.amount,
                gstAmount: exp.gstAmount,
                date: exp.date,
                description: exp.description,
                vendorName: exp.vendorName,
                paymentMethod: exp.paymentMethod,
                approvalStatus: 'Approved',
                createdBy: exp.recordedBy,
              };
              onUpdateExpenses([dbExp, ...appExpenses]);
            }
            logAudit(
              'Finance Hub',
              'Expense Recorded',
              `Recorded ₹${Number(exp.amount || 0).toLocaleString('en-IN')} expense under ${exp.category} (${exp.vendorName}).`,
              'info'
            );
          }}
          onUpdateExpense={(id, updates) => {
            const nextExpenses = expenses.map((e) => (e.id === id ? { ...e, ...updates } : e));
            setExpenses(nextExpenses);
            persistModuleCollectionToApi('expenses', nextExpenses);
            if (onUpdateExpenses) {
              onUpdateExpenses(
                appExpenses.map((e) => (e.id === id ? ({ ...e, ...updates } as any) : e))
              );
            }
          }}
          onDeleteExpense={(id) => {
            const nextExpenses = expenses.filter((e) => e.id !== id);
            setExpenses(nextExpenses);
            persistModuleCollectionToApi('expenses', nextExpenses);
            if (onUpdateExpenses) {
              onUpdateExpenses(appExpenses.filter((e) => e.id !== id));
            }
          }}
          onAddPettyCash={(entry) => {
            const newId = `PC-${Date.now()}`;
            const newRecord: PettyCashRecord = { id: newId, ...entry };
            const nextPetty = [newRecord, ...pettyCash];
            setPettyCash(nextPetty);
            persistModuleCollectionToApi('pettyCash', nextPetty);
            if (onUpdatePettyCash) {
              const dbPc: PettyCashTransaction = {
                id: newId,
                hotelId: selectedHotelId,
                date: entry.date,
                type: entry.type,
                category: entry.category,
                notes: entry.notes,
                amount: entry.amount,
                handler: entry.handler,
              };
              onUpdatePettyCash([dbPc, ...appPettyCash]);
            }
            logAudit(
              'Petty Cash',
              `Petty Cash ${entry.type}`,
              `${entry.type} of ₹${Number(entry.amount || 0).toLocaleString('en-IN')} (${entry.category}) by ${entry.handler}.`,
              'info'
            );
          }}
          onDeletePettyCash={(id) => {
            const nextPetty = pettyCash.filter((p) => p.id !== id);
            setPettyCash(nextPetty);
            persistModuleCollectionToApi('pettyCash', nextPetty);
            if (onUpdatePettyCash) {
              onUpdatePettyCash(appPettyCash.filter((p) => p.id !== id));
            }
          }}
          onAddVoucher={(vch) => {
            const newId = `VCH-${Date.now()}`;
            const newRecord: FinanceVoucherRecord = { id: newId, ...vch };
            const nextVouchers = [newRecord, ...vouchers];
            setVouchers(nextVouchers);
            persistModuleCollectionToApi('vouchers', nextVouchers);
            if (onUpdateVouchers) {
              const dbVch: FinanceVoucher = {
                id: newId,
                hotelId: selectedHotelId,
                voucherNumber: vch.voucherNo,
                voucherType: vch.type,
                date: vch.date,
                partyName: vch.partyName,
                paymentMethod: (vch.paymentMethod as any) || 'Cash',
                amount: vch.amount,
                narration: vch.narration,
                referenceNo: vch.referenceNo,
                category: vch.category,
                preparedBy: vch.preparedBy,
                status: 'Issued',
                ...({ sourceType: vch.sourceType, sourceId: vch.sourceId } as any),
              };
              onUpdateVouchers([dbVch, ...appVouchers]);
            }
          }}
          onAddAccount={(acc) => {
            const newId = `ACC-${Date.now()}`;
            const newRecord: CashBankAccountRecord = { id: newId, ...acc };
            const nextAccounts = [...accounts, newRecord];
            setAccounts(nextAccounts);
            persistModuleCollectionToApi('cashBankAccounts', nextAccounts);
            if (onUpdateCashBankAccounts) {
              const dbAcc: CashBankAccount = {
                id: newId,
                hotelId: selectedHotelId,
                accountName: acc.accountName,
                accountType:
                  acc.accountType === 'Cash Drawer'
                    ? 'Cash Drawer'
                    : acc.accountType === 'UPI Merchant'
                    ? 'UPI / Digital'
                    : acc.accountType === 'POS Card Terminal'
                    ? 'POS Machine / Card'
                    : acc.accountType === 'Petty Cash'
                    ? 'Cash Drawer'
                    : 'Bank Account',
                accountNumber: acc.accountNumber,
                openingBalance: acc.openingBalance,
                currentBalance: acc.currentBalance,
                lastReconciled: acc.lastReconciled,
              };
              onUpdateCashBankAccounts([...appCashBankAccounts, dbAcc]);
            }
          }}
          onAddOwnerPayment={(entry) => {
            const newId = `OWN-${Date.now()}`;
            const newRecord: OwnerPaymentRecord = { id: newId, ...entry };
            const nextOwner = [newRecord, ...ownerPayments];
            setOwnerPayments(nextOwner);
            persistModuleCollectionToApi('ownerPayments', nextOwner);
            if (onUpdateOwnerPayments) {
              const dbOwn: OwnerDirectorPayment = {
                id: newId,
                hotelId: selectedHotelId,
                date: entry.date,
                directorName: entry.directorName,
                type: entry.type,
                amount: entry.amount,
                paymentMethod: entry.paymentMethod,
                referenceNo: entry.referenceNo,
                notes: entry.notes,
              };
              onUpdateOwnerPayments([dbOwn, ...appOwnerPayments]);
            }
          }}
          onAddReimbursement={(entry) => {
            const newId = `RM-${Date.now()}`;
            const newRecord: StaffReimbursementRecord = { id: newId, ...entry };
            const nextReimb = [newRecord, ...reimbursements];
            setReimbursements(nextReimb);
            persistModuleCollectionToApi('reimbursements', nextReimb);
            if (onUpdateReimbursements) {
              const dbRm: StaffReimbursement = {
                id: newId,
                hotelId: selectedHotelId,
                date: entry.date,
                staffName: entry.staffName,
                staffRole: entry.department,
                expenseTitle: entry.title,
                category: entry.department,
                amount: entry.amount,
                receiptAttached: false,
                status: entry.status,
              };
              onUpdateReimbursements([dbRm, ...appReimbursements]);
            }
          }}
          onUpdateReimbursementStatus={(id, status) => {
            const nextReimb = reimbursements.map((r) => (r.id === id ? { ...r, status } : r));
            setReimbursements(nextReimb);
            persistModuleCollectionToApi('reimbursements', nextReimb);
            if (onUpdateReimbursements) {
              onUpdateReimbursements(
                appReimbursements.map((r) => (r.id === id ? { ...r, status } : r))
              );
            }
          }}
          onAddDailyClosing={(entry) => {
            const newId = `DC-${Date.now()}`;
            const newRecord: DailyClosingEntry = { id: newId, ...entry };
            const nextClosings = [newRecord, ...dailyClosings];
            setDailyClosings(nextClosings);
            persistModuleCollectionToApi('dailyClosings', nextClosings);
            if (onUpdateDailyClosings) {
              const dbDc: DailyClosingRecord = {
                id: newId,
                hotelId: selectedHotelId,
                date: entry.date,
                closedBy: entry.closedBy,
                openingCash: entry.openingCash,
                roomCashCollected: entry.roomCashIn,
                posCashCollected: entry.posCashIn,
                otherCashInflow: 0,
                expensesPaidInCash: entry.cashExpensesOut,
                pettyCashOutflow: 0,
                expectedClosingCash: entry.expectedClosing,
                physicalCashCounted: entry.physicalCounted,
                discrepancy: entry.discrepancy,
                upiCollected: 0,
                cardCollected: 0,
                bankTransferCollected: 0,
                status: entry.status,
              };
              onUpdateDailyClosings([dbDc, ...appDailyClosings]);
            }
            logAudit(
              'Daily Shift Closing',
              'Shift Cash Handover Saved',
              `Closed shift for ${entry.date}. Expected: ₹${entry.expectedClosing}, Physical: ₹${entry.physicalCounted} (${entry.status}).`,
              entry.discrepancy === 0 ? 'success' : 'warning'
            );
          }}
          onAddVendorBill={(bill) => {
            const newId = `VB-${Date.now()}`;
            const newRecord: VendorBillRecord = { id: newId, ...bill };
            const nextBills = [newRecord, ...vendorBills];
            setVendorBills(nextBills);
            persistModuleCollectionToApi('vendorBills', nextBills);
            logAudit(
              'Vendor Payments',
              'Vendor Bill Recorded',
              `Recorded vendor bill ${bill.billNumber} from ${bill.vendorName} for ₹${Number(bill.totalAmount || 0).toLocaleString('en-IN')} (${bill.paymentStatus}).`,
              'info'
            );
          }}
          onPayVendorBill={(billId, payment) => {
            const nextBills = vendorBills.map((b) => {
              if (b.id !== billId) return b;
              const paidSoFar = (b.paidAmount || 0) + payment.amount;
              const remaining = Math.max(0, b.totalAmount - paidSoFar);
              const newStatus: 'Paid' | 'Partially Paid' = remaining === 0 ? 'Paid' : 'Partially Paid';
              const newHistory = [
                ...(b.paymentHistory || []),
                {
                  id: `VBP-${Date.now()}`,
                  date: payment.date,
                  amount: payment.amount,
                  paymentMethod: payment.paymentMethod,
                  notes: payment.notes || '',
                },
              ];
              return {
                ...b,
                paidAmount: paidSoFar,
                remainingPayable: remaining,
                status: newStatus,
                paymentHistory: newHistory,
              };
            });
            setVendorBills(nextBills);
            persistModuleCollectionToApi('vendorBills', nextBills);
            logAudit(
              'Vendor Payments',
              'Vendor Bill Payment Recorded',
              `Settled payment of ₹${Number(payment.amount || 0).toLocaleString('en-IN')} via ${payment.paymentMethod} for Bill ${billId}.`,
              'success'
            );
          }}
          onAddMiscIncome={(income) => {
            const newId = `MI-${Date.now()}`;
            const newRecord: MiscellaneousIncomeRecord = { id: newId, ...income };
            const nextIncome = [newRecord, ...miscIncome];
            setMiscIncome(nextIncome);
            persistModuleCollectionToApi('miscIncome', nextIncome);
            logAudit(
              'Income Ledger',
              'Miscellaneous Income Recorded',
              `Recorded ₹${Number(income.amount || 0).toLocaleString('en-IN')} miscellaneous income under ${income.incomeCategory} (${income.paymentMode}).`,
              'success'
            );
          }}
          onTransferFunds={(transfer) => {
            const nextAccounts = accounts.map((acc) => {
              if (acc.id === transfer.fromAccountId) {
                return {
                  ...acc,
                  currentBalance: acc.currentBalance - transfer.amount,
                  outflowTotal: (acc.outflowTotal || 0) + transfer.amount,
                };
              }
              if (acc.id === transfer.toAccountId) {
                return {
                  ...acc,
                  currentBalance: acc.currentBalance + transfer.amount,
                  inflowTotal: (acc.inflowTotal || 0) + transfer.amount,
                };
              }
              return acc;
            });
            setAccounts(nextAccounts);
            persistModuleCollectionToApi('cashBankAccounts', nextAccounts);
            if (onUpdateCashBankAccounts) {
              onUpdateCashBankAccounts(nextAccounts as any);
            }
            logAudit(
              'Cash & Bank Accounts',
              'Internal Fund Transfer',
              `Transferred ₹${Number(transfer.amount || 0).toLocaleString('en-IN')} between accounts on ${transfer.date}.`,
              'info'
            );
          }}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsModule
          activeSubTab={reportsSubTab}
          onSubTabChange={setReportsSubTab}
          bookings={bookings}
          invoices={invoices}
          otaChannels={otaChannels}
          waterLogs={waterLogs}
          tasks={tasks}
          rooms={rooms}
          appCheckins={appCheckins}
          appBookings={appBookings}
          appInvoices={appInvoices}
          appExpenses={Array.from(
            new Map(
              [...(appExpenses || []), ...(expenses || [])].map((e: any) => [String(e.id || Math.random()), e])
            ).values()
          )}
          appOwnerPayments={Array.from(
            new Map(
              [...(appOwnerPayments || []), ...(ownerPayments || [])].map((op: any) => [String(op.id || Math.random()), op])
            ).values()
          )}
          appHandovers={appHandovers}
          appDailyClosings={appDailyClosings}
          appWaterBottles={appWaterBottles}
          appLaundryOrders={appLaundryOrders}
          appPosOrders={appPosOrders}
          appPosItems={appPosItems}
          appPosAdvanceBookings={appPosAdvanceBookings}
          appRooms={appRooms}
          appStaff={appStaff}
          hotelSettings={{
            ...(hotelSettings || {}),
            id: selectedHotelId,
            name: effectiveHotelProfile.hotelName || (hotelSettings as any)?.name || 'DirectStay Hotel',
            ownerName: (hotelSettings as any)?.ownerName || 'Owner',
          }}
          hotelId={selectedHotelId}
          userKey={loggedInUser || currentRole}
          onNavigateModule={(tab, sub) => handleNavigate(tab, sub)}
          onOpenRecordPayment={(b) => setPaymentBooking(b)}
        />
      )}

      {activeTab === 'staff' && (
        <StaffModule
          activeSubTab={staffSubTab}
          onSubTabChange={setStaffSubTab}
          staff={staff}
          hotelName={effectiveHotelProfile.hotelName}
          onSaveRbacMatrix={(nextMatrix) => {
            persistModuleCollectionToApi('rbacMatrix', [{ id: 'rbac-master', matrix: nextMatrix }]);
            logAudit(
              'Staff & RBAC',
              'RBAC Module Permissions Updated',
              'Updated role-based module access & action permissions.',
              'info'
            );
          }}
          onAddStaff={(m) => {
            const newId = `STF-${Date.now()}`;
            setStaff((prev) => [{ id: newId, ...m }, ...prev]);
            if (onUpdateStaff) {
              const dbStaff: Staff = {
                id: newId,
                hotelId: selectedHotelId,
                name: m.name,
                designation: m.role,
                role: m.role,
                department: m.department as any,
                phone: m.mobile,
                mobile: m.mobile,
                email: '',
                shift: (m.shift.startsWith('Morning') ? 'Morning' : m.shift.startsWith('Evening') ? 'Evening' : 'Night') as any,
                status: 'Active',
                salary: m.salary,
                joinDate: m.joiningDate,
                joiningDate: m.joiningDate,
                username: m.username,
                password: m.password || 'Staff@123',
                plainPassword: m.password || 'Staff@123',
              } as any;
              onUpdateStaff([dbStaff, ...appStaff]);
            }
          }}
          onUpdateStaffMember={(id, updates) => {
            setStaff((prev) =>
              prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
            );
            if (onUpdateStaff) {
              onUpdateStaff(
                appStaff.map((s) =>
                  s.id === id
                    ? ({
                        ...s,
                        phone: updates.mobile ?? s.phone,
                        mobile: updates.mobile ?? (s as any).mobile ?? s.phone,
                        username: updates.username ?? s.username,
                        password: updates.password ?? (s as any).password,
                        plainPassword: updates.password ?? (s as any).plainPassword,
                        shift: updates.shift
                          ? ((updates.shift.startsWith('Morning')
                              ? 'Morning'
                              : updates.shift.startsWith('Evening')
                              ? 'Evening'
                              : 'Night') as any)
                          : s.shift,
                        status: updates.status ? (updates.status as any) : s.status,
                        salary: updates.salary ?? s.salary,
                      } as any)
                    : s
                )
              );
            }
          }}
          onDeleteStaffMember={(id) => {
            setStaff((prev) => prev.filter((s) => s.id !== id));
            if (onUpdateStaff) {
              onUpdateStaff(appStaff.filter((s) => s.id !== id));
            }
          }}
          onDisburseSalary={({ staffName, role, month, netAmount, paymentMethod }) => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const newExpId = `EXP-SAL-${Date.now()}`;
            const expNo = `EXP-SAL-${Date.now().toString().slice(-4)}`;
            const newExp: FinanceExpenseRecord = {
              id: newExpId,
              expenseNo: expNo,
              date: todayStr,
              category: 'Staff Salary & Daily Wages',
              department: 'HR & Payroll',
              vendorName: `${staffName} (${role})`,
              description: `Monthly Salary Disbursement for ${month} — ${staffName}`,
              amount: netAmount,
              gstAmount: 0,
              paymentMethod,
              approvalStatus: 'Approved',
              recordedBy: loggedInUser || 'Admin',
            };
            setExpenses((prev) => [newExp, ...prev]);
            if (onUpdateExpenses) {
              onUpdateExpenses([
                {
                  id: newExpId,
                  hotelId: selectedHotelId,
                  expenseNo: expNo,
                  department: 'HR & Payroll',
                  category: 'Staff Salary & Daily Wages',
                  amount: netAmount,
                  gstAmount: 0,
                  date: todayStr,
                  description: newExp.description,
                  vendorName: newExp.vendorName,
                  paymentMethod,
                  approvalStatus: 'Approved',
                  createdBy: newExp.recordedBy,
                },
                ...appExpenses,
              ]);
            }

            const newVchId = `VCH-SAL-${Date.now()}`;
            const vchNo = `PV-SAL-${Date.now().toString().slice(-4)}`;
            const newVch: FinanceVoucherRecord = {
              id: newVchId,
              voucherNo: vchNo,
              type: 'Payment Voucher',
              date: todayStr,
              partyName: `${staffName} (${role})`,
              category: 'Staff Salary & Daily Wages',
              referenceNo: expNo,
              paymentMethod,
              amount: netAmount,
              narration: `Salary Paid for ${month}`,
              preparedBy: loggedInUser || 'Admin',
            };
            setVouchers((prev) => [newVch, ...prev]);
            if (onUpdateVouchers) {
              onUpdateVouchers([
                {
                  id: newVchId,
                  hotelId: selectedHotelId,
                  voucherNumber: vchNo,
                  voucherType: 'Payment Voucher',
                  date: todayStr,
                  partyName: newVch.partyName,
                  category: 'Staff Salary & Daily Wages',
                  referenceNo: expNo,
                  paymentMethod: paymentMethod as any,
                  amount: netAmount,
                  narration: newVch.narration,
                  preparedBy: newVch.preparedBy,
                  status: 'Issued',
                },
                ...appVouchers,
              ]);
            }
          }}
        />
      )}

      {activeTab === 'auditLogs' && <AuditLogsModule logs={auditLogs} />}

      {activeTab === 'bookingEngine' && (
        <PublicBookingModule
          assetGroups={assetGroups}
          rooms={rooms}
          hotelId={selectedHotelId}
          hotelName={effectiveHotelProfile.name}
          hotelAddress={effectiveHotelProfile.address}
          onBookFromWebsite={(rm) => {
            setPreselectedRoom(rm || null);
            setQuickAddMode('reservations');
            setQuickAddOpen(true);
          }}
        />
      )}

      {/* SHARED GLOBAL MODALS & RIGHT-SIDE DRAWERS */}
      <QuickAddBookingModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        assetGroups={assetGroups}
        rooms={rooms}
        preselectedRoom={preselectedRoom}
        initialBookingMode={quickAddMode}
        billSettings={billSettings}
        allowBackDatedCheckIn={Boolean(hotelSettings?.allowBackDatedCheckIn)}
        onProceedBooking={(step1) => {
          setQuickAddOpen(false);
          try {
            sessionStorage.setItem(
              'directstay_quick_booking_draft',
              JSON.stringify({
                ...step1,
                preselectedRoomNumber: preselectedRoom?.number || '',
              })
            );
          } catch {
            // ignore storage errors
          }
          setDraftBookingSeed({
            checkInDate: step1.checkInDate,
            checkOutDate: step1.checkOutDate,
            isOpenStay: step1.isOpenStay,
            numGuests: step1.numGuests,
            extraBeds: step1.extraBeds,
            extraPersonRate: step1.extraPersonRate,
            withGst: step1.withGst,
            gstRate: step1.gstRate,
            preselectedRoom: preselectedRoom || undefined,
            requirements: step1.requirements,
          });
          setActiveTab('frontDesk');
          setFrontDeskSubTab(step1.bookingMode || 'reservations');
        }}
      />

      <BookingDetailsDrawer
        booking={selectedBookingForDrawer}
        onClose={() => setSelectedBookingForDrawer(null)}
        onOpenCheckInModal={(b) => handleRedirectToFullCheckInPage(b)}
        onCheckoutBooking={(b) => setCheckoutClearanceBooking(b)}
        onOpenRecordPayment={(b) => setPaymentBooking(b)}
        onPreviewGuestDoc={(guest, bookingNo) => setPreviewDocState({ guest, bookingNo })}
        onOpenInvoiceModal={(b, scope) =>
          setInvoiceModalState({
            booking: b,
            scope,
            invoiceRecord: findPrimaryInvoiceForBooking(b),
          })
        }
        onEditBooking={(b) => {
          setSelectedBookingForDrawer(null);
          const isInHouseOrCheckedOut = Boolean(
            b.isCheckedIn ||
              b.isCheckedOut ||
              b.status === 'Checked In' ||
              b.status === 'Checked Out'
          );
          if (isInHouseOrCheckedOut) {
            // Route checked-in / in-house guests directly to In-House Guests & auto-open Edit Guest modal (UI-BUG-03 Part B)
            try {
              sessionStorage.setItem('pms_open_edit_guest_id', String(b.id));
            } catch {
              // ignore storage errors
            }
            setActiveTab('frontDesk');
            setFrontDeskSubTab('inhouse');
          } else {
            setDraftBookingSeed({
              checkInDate: b.checkInDate,
              checkOutDate: b.checkOutDate,
              isOpenStay: b.isOpenStay,
              numGuests: b.numGuests,
              withGst: b.gstInvoice && b.taxRate > 0,
              gstRate: b.gstInvoice && b.taxRate > 0 ? b.taxRate : 0,
              editingBooking: b,
            });
            setActiveTab('frontDesk');
            setFrontDeskSubTab('reservations');
          }
        }}
        onOpenAddPosOrder={(b) => setRoomOrderBooking(b)}
        onExtendStay={handleExtendStay}
        onPrintGrc={handlePrintGrc}
        onCancelBooking={(b) => {
          handleCancelOrNoShowBooking(
            b.id,
            'Cancelled',
            b.amountPaid,
            'Guest requested cancellation from Booking Details Drawer'
          );
          setSelectedBookingForDrawer(null);
        }}
      />

      <QuickCheckInModal
        booking={checkInBooking}
        rooms={rooms}
        currentRole={currentRole}
        loggedInUser={loggedInUser}
        hasExistingInvoice={Boolean(findPrimaryInvoiceForBooking(checkInBooking))}
        billSettings={billSettings}
        allowBackDatedCheckIn={Boolean(hotelSettings?.allowBackDatedCheckIn)}
        onClose={() => setCheckInBooking(null)}
        onLogOverride={(details) =>
          logAudit('Front Desk', 'Authorised Room Check-In Override', details, 'warning')
        }
        onConfirmCheckIn={handleConfirmCheckIn}
      />

      {checkoutClearanceBooking && (
      <CheckoutClearanceModal
        booking={checkoutClearanceBooking}
        hotelId={(hotelSettings as any)?.id}
        paymentModes={(hotelSettings as any)?.paymentModes}
        existingInvoice={findPrimaryInvoiceForBooking(checkoutClearanceBooking) || null}
        billSettings={billSettings}
        rawBooking={
          checkoutClearanceBooking
            ? appBookings.find((ab) => ab.id === checkoutClearanceBooking.id) || null
            : null
        }
        rawCheckin={
          checkoutClearanceBooking
            ? appCheckins.find(
                (c) =>
                  c.id === checkoutClearanceBooking.id ||
                  (c as any).bookingId === checkoutClearanceBooking.id
              ) || null
            : null
        }
        posOrders={appPosOrders}
        laundryOrders={appLaundryOrders}
        waterBottles={appWaterBottles}
        rooms={appRooms}
        onClose={() => setCheckoutClearanceBooking(null)}
        onCompleteFinalCheckout={handleCompleteCheckoutClearance}
        onRegisterLostFound={(item) => {
          const newId = `LF-${Date.now()}`;
          const nowIso = new Date().toISOString();
          const todayIso = nowIso.slice(0, 10);
          const dbLf: LostAndFoundItem = {
            id: newId,
            hotelId: selectedHotelId,
            recordType: 'found',
            itemName: item.itemName,
            category: item.category || 'Others',
            description: item.description,
            roomNumber: item.roomNumber,
            bookingId: item.bookingId,
            source: 'Checkout',
            locationFound: `Room ${item.roomNumber} (During Checkout)`,
            foundByStaff: loggedInUser || 'Front Desk',
            dateFound: todayIso,
            storageLocation: item.storageLocation || 'Front Desk Safe',
            guestName: item.guestName,
            guestMobile: item.guestMobile,
            status: 'Found – Registered',
            createdAt: nowIso,
            updatedAt: nowIso,
            auditHistory: [
              {
                id: `AUD-${Date.now()}`,
                action: 'Found Item Registered at Checkout',
                toStatus: 'Found – Registered',
                performedBy: loggedInUser || 'Front Desk',
                dateTime: nowIso,
                notes: `Found in Room ${item.roomNumber} during checkout of ${item.guestName}`,
              },
            ],
          };
          setLostFound((prev) => [
            {
              ...dbLf,
              roomNumber: item.roomNumber,
              foundBy: dbLf.foundByStaff,
              status: 'Found – Registered',
            },
            ...prev,
          ]);
          if (onUpdateLostAndFoundItems) {
            onUpdateLostAndFoundItems([dbLf, ...appLostAndFoundItems]);
          }
          logAudit('Lost & Found', 'Checkout Found Item Logged', `Logged "${item.itemName}" found in Room ${item.roomNumber} during checkout.`, 'info');
        }}
        onPreviewInvoice={(b) =>
          setInvoiceModalState({
            booking: b,
            scope: 'Booking + Other Services',
            invoiceRecord: findPrimaryInvoiceForBooking(b),
          })
        }
      />
      )}

      {editInvoiceId && (
        <EditInvoiceModal
          invoiceId={editInvoiceId}
          invoices={appInvoices as any[]}
          billSettings={billSettings}
          appCheckins={appCheckins as any[]}
          appBookings={appBookings as any[]}
          posOrders={appPosOrders as any[]}
          onClose={() => setEditInvoiceId(null)}
          onSave={(nextInvoices, summary) => {
            if (onUpdateInvoices) onUpdateInvoices(nextInvoices as any);
            logAudit('Invoice Center', 'Invoice Edited & Re-Issued', summary, 'info');
            setEditInvoiceId(null);
          }}
        />
      )}

      <RecordPaymentDrawer
        booking={paymentBooking}
        onClose={() => setPaymentBooking(null)}
        onSavePayment={handleSavePayment}
      />

      <InvoicePreviewModal
        booking={invoiceModalState?.booking || null}
        invoiceScope={invoiceModalState?.scope || 'Booking + Other Services'}
        invoiceRecord={
          invoiceModalState?.invoiceRecord ||
          findPrimaryInvoiceForBooking(invoiceModalState?.booking) ||
          null
        }
        rawInvoice={
          (() => {
            const rec =
              invoiceModalState?.invoiceRecord ||
              findPrimaryInvoiceForBooking(invoiceModalState?.booking);
            return rec ? appInvoices.find((ai) => ai.id === rec.id) || null : null;
          })()
        }
        rawBooking={
          invoiceModalState?.booking
            ? appBookings.find((ab) => ab.id === invoiceModalState.booking.id) || null
            : null
        }
        rawCheckin={
          invoiceModalState?.booking
            ? appCheckins.find(
                (c) =>
                  c.id === invoiceModalState.booking.id ||
                  (c as any).bookingId === invoiceModalState.booking.id
              ) || null
            : null
        }
        posOrders={appPosOrders}
        laundryOrders={appLaundryOrders}
        waterBottles={appWaterBottles}
        rooms={appRooms}
        hotelProfile={effectiveHotelProfile}
        hotelSettings={hotelSettings}
        billSettings={billSettings}
        allInvoices={invoices}
        onClose={() => setInvoiceModalState(null)}
        onCreateSeparateInvoice={(bkg, targetWithGst, scope, confirmedRefund) =>
          handleCreateSeparateInvoiceInHub(
            bkg,
            scope,
            targetWithGst,
            targetWithGst ? billSettings.roomGstRate : 0,
            confirmedRefund || 0
          )
        }
      />

      <GuestDocumentPreviewModal
        guest={previewDocState?.guest || null}
        bookingNo={previewDocState?.bookingNo || ''}
        onClose={() => setPreviewDocState(null)}
        onUpdateGuestDoc={handleUpdateGuestDocument}
      />

      <RoomTasksDrawer
        isOpen={isRoomTasksOpen}
        filterRoom={roomTasksDrawerRoom}
        tasks={tasks}
        rooms={rooms}
        staff={staff}
        onClose={() => setIsRoomTasksOpen(false)}
        onCompleteTask={handleCompleteTask}
        onAddTask={(newTask) => {
          const newId = `HK-${Date.now()}`;
          const nowStr = new Date().toLocaleString('en-IN');
          setTasks((prev) => [
            {
              ...newTask,
              id: newId,
              timing: nowStr,
            },
            ...prev,
          ]);
          if (onUpdateCleaningLogs) {
            onUpdateCleaningLogs([
              {
                id: newId,
                hotelId: selectedHotelId,
                roomNumber: newTask.roomNumber,
                assignedStaff: newTask.assignedTo,
                assignedAt: nowStr,
                status: 'Assigned',
                checklistCompleted: [],
                notes: newTask.description,
              },
              ...appCleaningLogs,
            ]);
          }
        }}
      />

      <AddRoomOrderModal
        booking={roomOrderBooking}
        onClose={() => setRoomOrderBooking(null)}
        onProceedToPos={() => {
          setRoomOrderBooking(null);
          setActiveTab('pos');
          setPosSubTab('terminal');
        }}
      />
    </div>
  );
};
export default IntegratedAdminPmsHub;
