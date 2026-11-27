import React, { useState, useMemo, useEffect } from 'react';
import {
  Room,
  Booking,
  GuestCheckIn,
  Invoice,
  Expense,
  HotelSettings,
  PosOrder,
  CashHandover,
  Staff,
  OwnerDirectorPayment,
  DailyClosingRecord,
  WaterBottleRecord,
  LaundryOrder,
  FoodAdvanceBooking,
} from '../types';
import DirtyRoomsPanel from './DirtyRoomsPanel';
import { showToast } from '../utils/toast';
import {
  getTodayIst,
  formatDdmmyyyy,
  addDaysIst,
} from '../utils/reportingDates';
import { buildStayBill } from '../utils/stayBilling';
import { normalizeBillSettings, r2 } from '../utils/billCalculator';
import { 
  Printer, Download, Calendar, ChevronLeft, ChevronRight, 
  Search, FileSpreadsheet, DollarSign, Edit3, Check,
  Building2, Wallet, CreditCard, Utensils, TrendingUp, ArrowRight
} from 'lucide-react';

interface DailyCollectionSheetProps {
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  expenses: Expense[];
  posOrders?: PosOrder[];
  posAdvanceBookings?: FoodAdvanceBooking[];
  handovers?: CashHandover[];
  ownerPayments?: OwnerDirectorPayment[];
  dailyClosings?: DailyClosingRecord[];
  waterBottles?: WaterBottleRecord[];
  laundryOrders?: LaundryOrder[];
  staff?: Staff[];
  hotelSettings?: HotelSettings;
  onEditCheckout?: (guest: GuestCheckIn) => void;
}

const localTodayStr = () => getTodayIst();

const toLocalYmd = (raw?: string): string => {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return s.substring(0, 10);
  const mDmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mDmy) {
    const [, d, mth, y] = mDmy;
    return `${y}-${mth.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return s.substring(0, 10);
};

const isCashModeStr = (raw?: string): boolean => {
  const m = String(raw || '').trim().toLowerCase();
  if (!m) return true; // default unspecified expense/handover to cash drawer
  return m.includes('cash') || m.includes('petty');
};

const isCapitalContributionPayment = (op: any): boolean => {
  const t = String(op?.type || op?.category || '').toLowerCase();
  return t.includes('capital') || t.includes('loan in') || t.includes('introduced') || t.includes('injection');
};

const isLaundryDescription = (raw?: string): boolean => {
  const d = String(raw || '').toLowerCase();
  return d.includes('laundry') || d.includes('dry clean') || /\biron(ing)?\b/.test(d);
};

export interface DailyCollectionReportInput {
  selectedDate: string;
  searchTerm?: string;
  rooms?: Room[];
  bookings?: Booking[];
  checkins?: GuestCheckIn[];
  invoices?: Invoice[];
  expenses?: Expense[];
  posOrders?: PosOrder[];
  posAdvanceBookings?: FoodAdvanceBooking[];
  handovers?: CashHandover[];
  ownerPayments?: OwnerDirectorPayment[];
  waterBottles?: WaterBottleRecord[];
  laundryOrders?: LaundryOrder[];
  hotelSettings?: HotelSettings;
  todayYmdOverride?: string;
}

export function computeDailyCollectionSheet(input: DailyCollectionReportInput) {
  const {
    selectedDate,
    searchTerm = '',
    rooms = [],
    bookings = [],
    checkins = [],
    invoices = [],
    expenses = [],
    posOrders = [],
    posAdvanceBookings = [],
    handovers = [],
    ownerPayments = [],
    waterBottles = [],
    laundryOrders = [],
    hotelSettings,
    todayYmdOverride,
  } = input;

  const billSettings = normalizeBillSettings(hotelSettings as any);
  const rowsMap = new Map<string, any>();
  const makeRowKey = (roomNum: any, guest: any) =>
    `${String(roomNum || '').trim()}_${String(guest || '').trim().toLowerCase()}`;

  // 1. Check-ins active or settled on the selected date (including overdue active in-house guests)
  const todayYmd = todayYmdOverride || localTodayStr();
  checkins.forEach((c) => {
    const inDate = toLocalYmd(c.checkInDate);
    const outDate = toLocalYmd(c.checkOutDate);
    const checkedOutLocal = toLocalYmd(c.checkedOutDateTime);
    const isCurrentlyInHouse = !checkedOutLocal;
    const hasPaymentOnDate = Array.isArray(c.payments)
      ? c.payments.some((p: any) => toLocalYmd(p?.dateTime || p?.date) === selectedDate)
      : false;

    const isActiveOnDate =
      inDate === selectedDate ||
      outDate === selectedDate ||
      checkedOutLocal === selectedDate ||
      hasPaymentOnDate ||
      (!!inDate && !!outDate && inDate <= selectedDate && outDate >= selectedDate) ||
      (!!inDate && !outDate && inDate <= selectedDate) ||
      (isCurrentlyInHouse && !!inDate && inDate <= selectedDate && selectedDate <= todayYmd);

    if (isActiveOnDate) {
      const key = makeRowKey(c.roomNumber, c.guestName);
      rowsMap.set(key, {
        source: 'checkin',
        checkin: c,
        guestName: c.guestName,
        roomNumber: c.roomNumber,
        checkInDate: inDate,
        checkOutDate: outDate,
        roomRate: c.roomRate || 0,
        nights: Math.max(
          1,
          Math.round(
            Math.abs(new Date(outDate || selectedDate).getTime() - new Date(inDate || selectedDate).getTime()) /
              (1000 * 60 * 60 * 24)
          ) || 1
        ),
        advancePayment: Number(c.advanceAmount ?? (c as any).advancePayment ?? 0),
        paymentMethod: c.paymentMethod || 'Cash',
        extraCharges: c.extraCharges || [],
        separateInvoices: [],
      });
    }
  });

  // 2. Invoices generated or settled on selected date (skip superseded/cancelled/credit notes; never overwrite primary stay invoice with INV-SEP)
  invoices.forEach((inv) => {
    if (
      inv.isSuperseded ||
      (inv as any).isCreditNote ||
      inv.invoiceType === 'Credit Note' ||
      inv.invoiceStatus === 'Superseded' ||
      inv.invoiceStatus === 'Cancelled'
    ) {
      return;
    }
    const invDate = toLocalYmd(inv.dateCreated || (inv as any).createdAt || (inv as any).invoiceDate || '');
    const inDate = toLocalYmd(inv.checkInDate);
    const outDate = toLocalYmd(inv.checkOutDate);
    const hasPayOnDate = Array.isArray(inv.paymentHistory)
      ? inv.paymentHistory.some((p: any) => toLocalYmd(p?.date || p?.dateTime) === selectedDate)
      : false;

    const isMatch =
      invDate === selectedDate ||
      inDate === selectedDate ||
      outDate === selectedDate ||
      hasPayOnDate ||
      (!!inDate && !!outDate && inDate <= selectedDate && outDate >= selectedDate);

    if (isMatch) {
      const key = makeRowKey(inv.roomNumber, inv.guestName);
      const existing = rowsMap.get(key) || {
        source: 'invoice',
        guestName: inv.guestName,
        roomNumber: inv.roomNumber,
        checkInDate: inDate,
        checkOutDate: outDate,
        roomRate: inv.roomCharges || 0,
        nights: inv.nights || 1,
        extraCharges: [],
        separateInvoices: [],
      };

      const isSep = Boolean(inv.isSeparateInvoice || String(inv.id || '').startsWith('INV-SEP-'));
      if (isSep) {
        existing.separateInvoices = [...(existing.separateInvoices || []), inv];
      } else {
        existing.invoice = inv;
      }
      rowsMap.set(key, existing);
    }
  });

  // 3. Bookings on that date if not already in checkins (attach matching booking even if checkin exists so booking payments/metadata are available)
  bookings.forEach((b) => {
    const inDate = toLocalYmd(b.checkInDate);
    const outDate = toLocalYmd(b.checkOutDate);
    const bookedOn = toLocalYmd(b.bookingDate);
    const isActive =
      inDate === selectedDate ||
      outDate === selectedDate ||
      (!!inDate && !!outDate && inDate <= selectedDate && outDate >= selectedDate) ||
      (!!inDate && !outDate && inDate <= selectedDate) ||
      (bookedOn === selectedDate && Number(b.advanceAmount || 0) > 0);

    const stLower = String(b.status || '').toLowerCase().trim();
    const isNonBillableStatus =
      stLower === 'cancelled' ||
      stLower === 'waiting' ||
      stLower === 'waitlist' ||
      stLower === 'draft' ||
      stLower === 'no-show';

    if (isActive && !isNonBillableStatus) {
      const key = makeRowKey(b.roomNumber, b.guestName);
      const existing = rowsMap.get(key);
      if (existing) {
        existing.booking = b;
      } else {
        rowsMap.set(key, {
          source: 'booking',
          booking: b,
          guestName: b.guestName,
          roomNumber: b.roomNumber,
          checkInDate: inDate,
          checkOutDate: outDate,
          roomRate: b.bookingAmount ? Math.round(b.bookingAmount / (b.nights || 1)) : 2000,
          nights: b.nights || 1,
          advancePayment: Number(b.advanceAmount ?? (b as any).advancePayment ?? 0),
          paymentMethod: b.paymentMethod || 'Cash',
          extraCharges: [],
          separateInvoices: [],
        });
      }
    }
  });

  // 4. POS Food Orders on selected date (excluding Cancelled/Voided/Held)
  const ordersOnDate = posOrders.filter((o) => {
    const st = String(o.status || '').toLowerCase();
    const kotSt = String((o as any).kotStatus || '').toLowerCase();
    if (st === 'cancelled' || st === 'voided' || st === 'held' || kotSt === 'cancelled' || (o as any).isHeld) {
      return false;
    }
    const oDate = toLocalYmd((o as any).date || (o as any).createdAt || (o as any).orderTime || (o as any).timestamp || '');
    return oDate === selectedDate;
  });

  const allMatchedOrderIds = new Set<string>();
  const cleanNum = (str: any) => String(str || '').replace(/[^\d]/g, '').trim();

  // Transform mapped rows into exact 19-column settlement register using centralized billing engine
  const processed = Array.from(rowsMap.values()).map((row, idx) => {
    const c: GuestCheckIn | undefined = row.checkin;
    const inv: Invoice | undefined = row.invoice;
    const b: Booking | undefined = row.booking;

    const guestName = (row.guestName || 'GUEST').toUpperCase();
    const roomNumber = row.roomNumber || 'N/A';
    const splitRoomNums = String(roomNumber)
      .split(',')
      .map((rn: string) => rn.trim())
      .filter(Boolean);
    const rowRoomClean = cleanNum(roomNumber);
    const cleanSplitRooms = splitRoomNums.map(cleanNum).filter(Boolean);

    // Match POS orders on selectedDate belonging to this room/stay
    const roomOrders = ordersOnDate.filter((o) => {
      const oRoomClean = cleanNum(o.roomNumber);
      const oGuest = String(o.guestName || '').toLowerCase().trim();
      const rGuest = String(guestName || '').toLowerCase().trim();
      const isRoomMatch = Boolean(
        rowRoomClean && oRoomClean && (rowRoomClean === oRoomClean || cleanSplitRooms.includes(oRoomClean))
      );
      const isCheckinMatch = Boolean(
        (c && (o.checkinId === c.id || (o as any).checkInId === c.id)) ||
          (b && (o as any).bookingId === b.id) ||
          (inv && (o as any).linkedInvoiceId === inv.id)
      );
      const isGuestMatch = Boolean(oGuest && rGuest && (oGuest.includes(rGuest) || rGuest.includes(oGuest)));
      return isRoomMatch || isCheckinMatch || (isGuestMatch && Boolean(o.roomNumber));
    });

    const roomBilledOrders: PosOrder[] = [];
    let counterPaidFoodPreTax = 0;
    let counterPaidFoodTax = 0;
    let kitchenUpi = 0;
    let kitchenCash = 0;
    let kitchenIcici = 0;
    let kitchenDue = 0;

    roomOrders.forEach((o) => {
      const oId = String(o.id || (o as any)._id);
      allMatchedOrderIds.add(oId);

      const pMethod = String(o.paymentMethod || '').toLowerCase();
      const pStatus = String(o.paymentStatus || '').toLowerCase();
      const toRoom = (o as any).postToRoomBill === true || pMethod.includes('room');
      const isPaidAtCounter = ((o as any).isPaid === true || pStatus === 'paid') && !toRoom && !pMethod.includes('due') && !pMethod.includes('credit');
      const gross = r2(Number(o.grandTotal ?? (o as any).totalAmount ?? (o as any).total ?? (o as any).subtotal ?? 0));
      if (gross <= 0) return;

      if (isPaidAtCounter) {
        const taxAmt = r2(Number(o.taxAmount ?? (o as any).gstAmount ?? 0));
        const preTax = r2(Math.max(0, gross - taxAmt));
        counterPaidFoodPreTax = r2(counterPaidFoodPreTax + preTax);
        counterPaidFoodTax = r2(counterPaidFoodTax + taxAmt);
        const orderSplits = Array.isArray((o as any).payments) ? (o as any).payments : [];
        if (orderSplits.length > 0) {
          orderSplits.forEach((sp: any) => {
            const amt = r2(Number(sp?.amount || 0));
            if (amt <= 0) return;
            const m = String(sp?.method || '').toLowerCase();
            if (m.includes('cash')) kitchenCash = r2(kitchenCash + amt);
            else if (m.includes('card') || m.includes('bank') || m.includes('icici')) kitchenIcici = r2(kitchenIcici + amt);
            else kitchenUpi = r2(kitchenUpi + amt);
          });
        } else if (pMethod.includes('cash')) kitchenCash = r2(kitchenCash + gross);
        else if (pMethod.includes('card') || pMethod.includes('bank') || pMethod.includes('icici')) kitchenIcici = r2(kitchenIcici + gross);
        else kitchenUpi = r2(kitchenUpi + gross);
      } else {
        roomBilledOrders.push(o);
        kitchenDue = r2(kitchenDue + gross);
      }
    });

    const openingBalance = r2(Number((c as any)?.openingBalance || (b as any)?.openingBalance || 0));

    let nights = row.nights || 1;
    let baseRoomTariff = 0;
    let extraBed = 0;
    let extraPerson = 0;
    let earlyCheckIn = 0;
    let lateCheckOut = 0;
    let discount = 0;
    let roomTariffNum = 0;
    let gstNum = 0;
    let gstDisplay: number | string = 0;
    let foodAmt = 0;
    let waterBottleAmt = 0;
    let laundryAmt = 0;
    let anyOthersAmt = 0;

    // Respect IMMUTABLE finalized historical invoices without recalculating or mutating them.
    // For active stays (no invoice yet or provisional/non-finalized invoice), use centralized buildStayBill().
    const isImmutableFinalInvoice = Boolean(
      inv && !inv.isSuperseded && (inv.isFinalInvoice === true || inv.invoiceStatus === 'Finalized')
    );

    if (isImmutableFinalInvoice && inv) {
      nights = Number(inv.nights) || nights;
      baseRoomTariff = r2(Number(inv.roomCharges) || 0);
      extraBed = r2(Number(inv.extraBedCharges) || 0);
      extraPerson = r2(Number(inv.extraPersonCharges) || 0);
      earlyCheckIn = r2(Number(inv.earlyCheckInCharges) || 0);
      lateCheckOut = r2(Number(inv.lateCheckOutCharges) || 0);
      discount = r2(Number(inv.discount) || 0);
      foodAmt = r2((Number(inv.foodCharges) || 0) + counterPaidFoodPreTax);
      waterBottleAmt = r2(Number(inv.waterCharges) || 0);
      laundryAmt = r2(Number(inv.laundryCharges) || 0);
      // buildInvoiceRecord (billEngine === 'v2') stores otherCharges = legacy.otherCharges + legacy.fineCharges;
      // avoid double-counting fineCharges on top of otherCharges (UI-BUG-04).
      const rawOther = r2(Number(inv.otherCharges) || 0);
      const rawFine = r2(Number(inv.fineCharges) || 0);
      const nonOverlapOtherAndFine =
        (inv as any).billEngine === 'v2' && rawFine > 0 && rawOther >= rawFine
          ? rawOther
          : r2(rawOther + rawFine);
      let serviceMisc = r2((Number(inv.serviceCharges) || 0) + nonOverlapOtherAndFine);

      // Re-classify display column if a historical invoice stored laundry under serviceCharges
      if (laundryAmt === 0 && serviceMisc > 0 && Array.isArray((inv as any).ledgerLines)) {
        let detectedLaundry = 0;
        (inv as any).ledgerLines.forEach((ll: any) => {
          if (ll?.type === 'charge' && (ll.kind === 'service' || ll.kind === 'other') && isLaundryDescription(ll.description)) {
            detectedLaundry = r2(detectedLaundry + (Number(ll.charges) || 0));
          }
        });
        if (detectedLaundry > 0 && detectedLaundry <= serviceMisc + 0.01) {
          laundryAmt = Math.min(detectedLaundry, serviceMisc);
          serviceMisc = r2(Math.max(0, serviceMisc - laundryAmt));
        }
      }

      anyOthersAmt = serviceMisc;
      const roomGross = r2(baseRoomTariff + extraBed + extraPerson + earlyCheckIn + lateCheckOut);
      const roomDisc = Math.min(roomGross, discount);
      const extraDisc = r2(Math.max(0, discount - roomDisc));
      roomTariffNum = r2(roomGross - roomDisc);
      anyOthersAmt = r2(Math.max(0, anyOthersAmt - extraDisc));
      gstNum = r2((Number(inv.gst ?? (inv as any).tax ?? 0) || 0) + counterPaidFoodTax);
      gstDisplay = gstNum;

      // Guarantee finalized invoice reconciliation if a legacy invoice omitted granular breakdown fields
      const expectedTotal = r2((Number(inv.finalAmount) || 0) + counterPaidFoodPreTax + counterPaidFoodTax);
      const computedSum = r2(roomTariffNum + gstNum + foodAmt + waterBottleAmt + laundryAmt + anyOthersAmt);
      if (expectedTotal > 0 && Math.abs(expectedTotal - computedSum) > 0.01) {
        const delta = r2(expectedTotal - computedSum);
        if (roomTariffNum + delta >= 0) {
          roomTariffNum = r2(roomTariffNum + delta);
        } else {
          anyOthersAmt = r2(Math.max(0, anyOthersAmt + delta));
        }
      }
    } else {
      const stay = buildStayBill({
        booking: b || null,
        checkin: c || null,
        posOrders: roomBilledOrders,
        waterBottles,
        laundryOrders,
        rooms,
        settings: billSettings,
      });

      nights = stay.folio.nights || nights;
      baseRoomTariff = stay.bill.totalsByKind.room;
      extraBed = stay.bill.totalsByKind.extra_bed;
      extraPerson = stay.bill.totalsByKind.extra_person;
      earlyCheckIn = stay.bill.totalsByKind.early_checkin;
      lateCheckOut = stay.bill.totalsByKind.late_checkout;
      discount = stay.bill.discount;

      const roomGross = r2(baseRoomTariff + extraBed + extraPerson + earlyCheckIn + lateCheckOut);
      const roomDisc = Math.min(roomGross, discount);
      const extraDisc = r2(Math.max(0, discount - roomDisc));
      roomTariffNum = r2(roomGross - roomDisc);

      foodAmt = r2(stay.bill.totalsByKind.food + counterPaidFoodPreTax);
      waterBottleAmt = r2(stay.bill.totalsByKind.water);
      laundryAmt = r2(stay.bill.totalsByKind.laundry);
      const rawOtherExtras = r2(
        stay.bill.totalsByKind.service + stay.bill.totalsByKind.other + stay.bill.totalsByKind.fine
      );
      anyOthersAmt = r2(Math.max(0, rawOtherExtras - extraDisc));

      gstNum = r2(stay.bill.totalTax + counterPaidFoodTax);
      if (gstNum === 0 && !inv && !c?.gstAmount && ((b as any)?.otaName === 'MakeMyTrip' || (b as any)?.otaName === 'MMT')) {
        gstDisplay = 'MMT';
      } else {
        gstDisplay = gstNum;
      }
    }

    const totalRoom = r2(openingBalance + roomTariffNum + gstNum);
    const totalExtra = r2(foodAmt + waterBottleAmt + laundryAmt + anyOthersAmt);
    const grandTotal = r2(totalRoom + totalExtra);
    const taxableSubtotal = r2(roomTariffNum + totalExtra);

    // Room Payment Modes (Hybrid / Split Payment Aware across checkin.payments, invoice.paymentHistory, invoice.paymentDetails, booking.payments)
    // UI-BUG-02: Separate SELECTED-DAY cash/UPI/card inflows (for Col 15-18 & Daily Vault) from
    // CUMULATIVE stay receipts up through selectedDate (for Col 19 Balance Due), using actual payment date (never checkOutDate).
    let cashPay = 0;
    let upiPay = 0;
    let iciciPay = 0; // Card / Bank / Online (selectedDate inflow only)
    let cumulativeRoomPaid = 0; // Cumulative stay receipts on or before selectedDate

    const fallbackPayDate = toLocalYmd(
      c?.checkInDate || b?.bookingDate || b?.checkInDate || inv?.dateCreated || ''
    );

    const normalizeModeBucket = (modeRaw: string): 'cash' | 'upi' | 'icici' => {
      const m = String(modeRaw || 'Cash').toLowerCase();
      if (m.includes('cash')) return 'cash';
      if (m.includes('upi') || m.includes('gpay') || m.includes('phonepe') || m.includes('paytm') || m.includes('qr')) return 'upi';
      if (m.includes('card') || m.includes('bank') || m.includes('icici') || m.includes('online') || m.includes('neft') || m.includes('rtgs') || m.includes('imps')) return 'icici';
      return 'cash';
    };

    const addPaymentRecord = (modeRaw: string, amtRaw: number, payDateRaw?: string) => {
      const amt = r2(Number(amtRaw) || 0);
      if (amt <= 0) return;
      const pYmd = toLocalYmd(payDateRaw || '') || fallbackPayDate;
      // Cumulative stay payment includes any payment made on or before selectedDate
      if (!pYmd || pYmd <= selectedDate) {
        cumulativeRoomPaid = r2(cumulativeRoomPaid + amt);
      }
      // Daily collection inflow ONLY counts payments actually received on selectedDate
      if (pYmd && pYmd !== selectedDate) return;
      const bucket = normalizeModeBucket(modeRaw);
      if (bucket === 'cash') cashPay = r2(cashPay + amt);
      else if (bucket === 'upi') upiPay = r2(upiPay + amt);
      else iciciPay = r2(iciciPay + amt);
    };

    const structuredPayments: Array<{
      id: string;
      mode: string;
      modeBucket: 'cash' | 'upi' | 'icici';
      amount: number;
      isAdv: boolean;
      isCheckoutSettle: boolean;
      source: string;
      date: string;
    }> = [];
    const seenPayIds = new Set<string>();
    const sourceTotals = new Map<string, number>();

    const pushStructured = (
      source: 'checkin' | 'invoice_hist' | 'invoice_det' | 'booking',
      idRaw: any,
      modeRaw: any,
      amtRaw: any,
      notesRaw?: any,
      typeRaw?: any,
      dateRaw?: any
    ) => {
      const amt = r2(Number(amtRaw) || 0);
      if (amt <= 0) return;
      const notesLower = String(notesRaw || '').toLowerCase();
      if (notesLower.includes('marked as due')) return;
      const idStr = String(idRaw || '').trim();
      const typeLower = String(typeRaw || '').toLowerCase();
      const isAdv =
        typeLower.includes('advance') ||
        notesLower.includes('advance') ||
        notesLower.includes('check-in') ||
        idStr.toLowerCase().includes('adv') ||
        idStr.toLowerCase().includes('checkin');
      const isCheckoutSettle =
        idStr.toUpperCase().startsWith('PAY-CO-') ||
        typeLower.includes('settle') ||
        notesLower.includes('checkout') ||
        notesLower.includes('check-out');
      const modeBucket = normalizeModeBucket(String(modeRaw || 'Cash'));
      const resolvedDate = toLocalYmd(String(dateRaw || '')) || fallbackPayDate;

      if (idStr && seenPayIds.has(idStr)) return;

      // Cross-source deduplication ONLY (never drops two distinct legitimate splits inside the SAME source!):
      // 1. Prevent synthetic/mirrored advance sum from duplicating check-in/invoice payments.
      const primaryTotal = (sourceTotals.get('checkin') || 0) + (sourceTotals.get('invoice_hist') || 0);
      if (source !== 'checkin' && isAdv && primaryTotal > 0 && Math.abs(primaryTotal - amt) < 1) {
        return;
      }

      // 2. Prevent cross-source checkout settlement double-counting when checkin.payments[] and
      //    invoice.paymentHistory[] carry different PAY-CO-* IDs for the same stay settlement
      //    (e.g. historical pre-fix Undo + Re-Checkout where old finalized invoice kept an older PAY-CO-* ID).
      if (source !== 'checkin' && isCheckoutSettle) {
        const checkinAlreadyHasSameCheckout = structuredPayments.some(
          (sp) =>
            sp.source === 'checkin' &&
            sp.isCheckoutSettle &&
            sp.modeBucket === modeBucket &&
            sp.date === resolvedDate &&
            Math.abs(sp.amount - amt) < 0.5
        );
        if (checkinAlreadyHasSameCheckout) {
          return;
        }
      }

      // 3. Prevent mirrored booking.payments[] entries (e.g. pay-adv-1 vs PAY-<id>-adv-1) from
      //    double-counting an advance already present in checkin.payments[] or invoice_hist.
      if (source === 'booking') {
        const mirroredInPrimary = structuredPayments.some(
          (sp) =>
            (sp.source === 'checkin' || sp.source === 'invoice_hist') &&
            sp.modeBucket === modeBucket &&
            sp.date === resolvedDate &&
            Math.abs(sp.amount - amt) < 0.5
        );
        if (mirroredInPrimary) {
          return;
        }
      }

      if (idStr) seenPayIds.add(idStr);
      sourceTotals.set(source, r2((sourceTotals.get(source) || 0) + amt));
      structuredPayments.push({
        id: idStr,
        mode: String(modeRaw || 'Cash'),
        modeBucket,
        amount: amt,
        isAdv,
        isCheckoutSettle,
        source,
        date: resolvedDate,
      });
    };

    if (Array.isArray(c?.payments) && c.payments.length > 0) {
      c.payments.forEach((p: any, i: number) =>
        pushStructured('checkin', p.id || `cp-${i}`, p.paymentMethod || p.method, p.amount, p.notes, p.paymentType, p.date || p.dateTime)
      );
    }
    if (inv && Array.isArray(inv.paymentHistory) && inv.paymentHistory.length > 0) {
      inv.paymentHistory.forEach((p: any, i: number) =>
        pushStructured('invoice_hist', p.id || `iph-${i}`, p.paymentMethod || p.mode || p.method, p.amount, p.notes, undefined, p.date || p.dateTime || inv.dateCreated)
      );
    }
    if (inv && Array.isArray((inv as any).paymentDetails) && (inv as any).paymentDetails.length > 0) {
      (inv as any).paymentDetails.forEach((p: any, i: number) =>
        pushStructured('invoice_det', p.id || `ipd-${i}`, p.mode || p.method || p.paymentMethod, p.amount, p.notes, undefined, p.date || p.dateTime || inv.dateCreated)
      );
    }
    if (Array.isArray((b as any)?.payments) && (b as any).payments.length > 0) {
      (b as any).payments.forEach((p: any, i: number) =>
        pushStructured('booking', p.id || `bp-${i}`, p.paymentMethod || p.method, p.amount, p.notes, p.paymentType, p.date || p.dateTime || b?.bookingDate)
      );
    }

    if (structuredPayments.length > 0) {
      structuredPayments.forEach((sp) => addPaymentRecord(sp.mode, sp.amount, sp.date));
    } else {
      const pMode = String(c?.paymentMethod || b?.paymentMethod || inv?.paymentMethod || 'Cash');
      const splitMatches = Array.from(pMode.matchAll(/(Cash|UPI|Card|Bank(?:\s*Transfer)?|Online)\s*₹?\s*([\d.]+)/gi));
      if (splitMatches.length > 0) {
        splitMatches.forEach((m) => addPaymentRecord(m[1], Number(m[2]), fallbackPayDate));
      } else {
        const legacyCash = Number(c?.cashAmountPaid || 0);
        const legacyOnline = Number(c?.onlineAmountPaid || 0);
        if (legacyCash + legacyOnline > 0) {
          addPaymentRecord('Cash', legacyCash, fallbackPayDate);
          addPaymentRecord(
            pMode.toLowerCase().includes('card') || pMode.toLowerCase().includes('bank') ? pMode : 'UPI',
            legacyOnline,
            fallbackPayDate
          );
        } else {
          const paid = Number(
            inv?.paidAmount ?? inv?.amountPaid ?? Number(c?.advanceAmount || 0) ?? Number(b?.advanceAmount || 0)
          );
          addPaymentRecord(pMode, paid, fallbackPayDate);
        }
      }
    }

    const payCash = r2(cashPay + kitchenCash);
    const payUpi = r2(upiPay + kitchenUpi);
    const payIcici = r2(iciciPay + kitchenIcici);
    const totalPayment = r2(payCash + payUpi + payIcici);
    const cumulativeTotalPaid = r2(cumulativeRoomPaid + kitchenCash + kitchenUpi + kitchenIcici);
    const balanceDue = Math.max(0, r2(grandTotal - cumulativeTotalPaid));

    const checkinTarget: GuestCheckIn | null =
      c ||
      (b
        ? ({
            id: b.id,
            guestName: b.guestName,
            mobile: b.mobile || '',
            roomNumber: b.roomNumber || roomNumber,
            roomType: b.roomType || 'Standard',
            roomRate:
              Number(b.bookedRooms?.[0]?.rate) ||
              Math.round((Number(baseRoomTariff || roomTariffNum) || 0) / Math.max(1, Number(nights) || 1)) ||
              2000,
            checkInDate: b.checkInDate,
            checkOutDate: b.checkOutDate,
            advanceAmount: Number(b.advanceAmount) || 0,
            paymentMethod: b.paymentMethod || 'Cash',
            discount,
            totalAmount: grandTotal,
            pendingAmount: balanceDue,
            checkedOutDateTime: inv?.dateCreated || b.checkOutDate,
          } as GuestCheckIn)
        : null);

    return {
      no: idx + 1,
      guestName,
      roomNumber,
      nights,
      openingBalance,
      roomTariff: roomTariffNum,
      gst: gstDisplay,
      totalRoom,
      food: foodAmt,
      waterBottle: waterBottleAmt,
      laundry: laundryAmt,
      anyOthers: anyOthersAmt,
      totalExtra,
      grandTotal,
      cash: payCash,
      upi: payUpi,
      icici: payIcici,
      totalPayment,
      balanceDue,
      // Detailed components for audit transparency & tooltips
      baseRoomTariff,
      extraBed,
      extraPerson,
      earlyCheckIn,
      lateCheckOut,
      discount,
      taxableSubtotal,
      kitchenUpi,
      kitchenCash,
      kitchenDue,
      totalFoodAmt: foodAmt,
      checkinTarget,
    };
  });

  // 5. Append any walk-in / non-room food orders on the selected date so no food sales are omitted
  const unallocatedOrders = ordersOnDate.filter(
    (o) => !allMatchedOrderIds.has(String(o.id || (o as any)._id))
  );

  unallocatedOrders.forEach((o) => {
    const grossAmt = r2(Number(o.grandTotal ?? (o as any).totalAmount ?? (o as any).total ?? (o as any).subtotal ?? 0));
    if (grossAmt <= 0) return;
    const taxAmt = r2(Number(o.taxAmount ?? (o as any).gstAmount ?? 0));
    const foodPreTax = r2(Math.max(0, grossAmt - taxAmt));

    const pMethod = String(o.paymentMethod || '').toLowerCase();
    const pStatus = String(o.paymentStatus || '').toLowerCase();
    const isPaid = (o as any).isPaid === true || pStatus === 'paid';
    let kUpi = 0;
    let kCash = 0;
    let kIcici = 0;
    let kDue = 0;
    const orderSplits = Array.isArray((o as any).payments) ? (o as any).payments : [];
    if (!isPaid || pMethod.includes('due') || pMethod.includes('room') || pMethod.includes('credit')) {
      kDue = grossAmt;
    } else if (orderSplits.length > 0) {
      orderSplits.forEach((sp: any) => {
        const amt = r2(Number(sp?.amount || 0));
        if (amt <= 0) return;
        const m = String(sp?.method || '').toLowerCase();
        if (m.includes('cash')) kCash = r2(kCash + amt);
        else if (m.includes('card') || m.includes('bank') || m.includes('icici')) kIcici = r2(kIcici + amt);
        else kUpi = r2(kUpi + amt);
      });
    } else if (pMethod.includes('cash')) {
      kCash = grossAmt;
    } else if (pMethod.includes('card') || pMethod.includes('bank') || pMethod.includes('icici')) {
      kIcici = grossAmt;
    } else {
      kUpi = grossAmt;
    }

    processed.push({
      no: processed.length + 1,
      guestName: String(o.guestName || `WALK-IN FOOD (${o.orderType || 'KITCHEN'})`).toUpperCase(),
      roomNumber: o.roomNumber ? String(o.roomNumber) : o.tableNo ? `TBL ${o.tableNo}` : 'KITCHEN',
      nights: 0,
      openingBalance: 0,
      roomTariff: 0,
      gst: taxAmt,
      totalRoom: taxAmt,
      food: foodPreTax,
      waterBottle: 0,
      laundry: 0,
      anyOthers: 0,
      totalExtra: foodPreTax,
      grandTotal: r2(foodPreTax + taxAmt),
      cash: kCash,
      upi: kUpi,
      icici: kIcici,
      totalPayment: r2(kCash + kUpi + kIcici),
      balanceDue: !isPaid ? grossAmt : 0,
      baseRoomTariff: 0,
      extraBed: 0,
      extraPerson: 0,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      discount: 0,
      taxableSubtotal: foodPreTax,
      kitchenUpi: kUpi,
      kitchenCash: kCash,
      kitchenDue: kDue,
      totalFoodAmt: foodPreTax,
      checkinTarget: null,
    });
  });

  // 5B. Append POS Advance Food Booking hybrid payments collected on selectedDate
  (posAdvanceBookings || []).forEach((adv) => {
    if (!adv || adv.status === 'Cancelled') return;
    const rawSplits = Array.isArray(adv.payments) && adv.payments.length > 0
      ? adv.payments
      : Number(adv.advanceAmount || 0) > 0
      ? [
          {
            id: `adv-leg-${adv.id}`,
            method: adv.paymentMethod || 'Cash',
            amount: r2(Number(adv.advanceAmount || 0)),
            date: adv.bookingDate || adv.eventDate || '',
          },
        ]
      : [];
    const todaySplits = rawSplits.filter((p) => toLocalYmd(p.date || adv.bookingDate) === selectedDate && Number(p.amount) > 0);
    if (todaySplits.length === 0) return;

    let advCash = 0;
    let advUpi = 0;
    let advIcici = 0;
    todaySplits.forEach((sp) => {
      const amt = r2(Number(sp.amount || 0));
      const m = String(sp.method || '').toLowerCase();
      if (m.includes('cash')) advCash = r2(advCash + amt);
      else if (m.includes('card') || m.includes('bank') || m.includes('icici')) advIcici = r2(advIcici + amt);
      else advUpi = r2(advUpi + amt);
    });
    const collectedToday = r2(advCash + advUpi + advIcici);
    if (collectedToday <= 0) return;

    const totalAdvVal = r2(Number(adv.totalAmount || collectedToday));
    const gstAmt = r2(Number(adv.gstAmount || 0));
    const foodPreTax = r2(Math.max(0, totalAdvVal - gstAmt));
    const balDue = r2(Number(adv.balanceAmount || 0));

    processed.push({
      no: processed.length + 1,
      guestName: `${String(adv.guestOrGroupName || 'ADVANCE FOOD').toUpperCase()} (${adv.bookingNumber})`,
      roomNumber: adv.tableNumber ? `TBL ${adv.tableNumber}` : 'ADV FOOD',
      nights: 0,
      openingBalance: 0,
      roomTariff: 0,
      gst: gstAmt,
      totalRoom: gstAmt,
      food: foodPreTax,
      waterBottle: 0,
      laundry: 0,
      anyOthers: 0,
      totalExtra: foodPreTax,
      grandTotal: totalAdvVal,
      cash: advCash,
      upi: advUpi,
      icici: advIcici,
      totalPayment: collectedToday,
      balanceDue: balDue,
      baseRoomTariff: 0,
      extraBed: 0,
      extraPerson: 0,
      earlyCheckIn: 0,
      lateCheckOut: 0,
      discount: 0,
      taxableSubtotal: foodPreTax,
      kitchenUpi: advUpi,
      kitchenCash: advCash,
      kitchenDue: balDue,
      totalFoodAmt: foodPreTax,
      checkinTarget: null,
    });
  });

  // Re-index row numbers
  processed.forEach((p, i) => {
    p.no = i + 1;
  });

  const filteredRows = !searchTerm.trim()
    ? processed
    : processed.filter((r) => {
        const term = searchTerm.toLowerCase();
        return r.guestName.toLowerCase().includes(term) || String(r.roomNumber).toLowerCase().includes(term);
      });

  // Cash Expenses on selected date (only physical cash / petty cash leaves the drawer)
  const dailyExpenses = expenses.filter((e) => {
    const eDate = toLocalYmd(e.date || (e as any).createdAt || '');
    if (eDate !== selectedDate) return false;
    if (String((e as any).approvalStatus || (e as any).status || '').toLowerCase() === 'rejected') return false;
    return isCashModeStr((e as any).paymentMethod || (e as any).paymentMode || (e as any).paymentSource);
  });

  const totalExpenseAmt = r2(dailyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));

  // Auto-calculated Cash Taken by Owner (strictly physical Cash from CashHandovers + Cash Owner Withdrawals on selectedDate)
  let handoverSum = 0;
  (handovers || []).forEach((h) => {
    if (toLocalYmd(h.date) !== selectedDate) return;
    const st = String((h as any).status || '').toLowerCase();
    if (st === 'cancelled' || st === 'rejected') return;
    // Never mix UPI / Card / Bank transfers into physical cash handovers
    const method = (h as any).paymentMethod || (h as any).paymentMode;
    if (method && !isCashModeStr(method)) return;
    handoverSum += Number(h.amount) || 0;
  });
  (ownerPayments || []).forEach((op) => {
    if (toLocalYmd(op.date) !== selectedDate) return;
    if (op.status === 'Cancelled') return;
    if (isCapitalContributionPayment(op)) return;
    if (isCashModeStr(op.paymentMethod || (op as any).paymentMode)) {
      handoverSum += Number(op.amount) || 0;
    }
  });
  const autoOwnerHandover = r2(handoverSum);

  // Table Column Totals
  let tOpeningBalance = 0;
  let tRoomTariff = 0;
  let tGst = 0;
  let tTotalRoom = 0;
  let tFood = 0;
  let tWaterBottle = 0;
  let tLaundry = 0;
  let tAnyOthers = 0;
  let tTotalExtra = 0;
  let tGrandTotal = 0;
  let tCash = 0;
  let tUpi = 0;
  let tIcici = 0;
  let tTotalPayment = 0;
  let tBalanceDue = 0;
  let tTaxableSubtotal = 0;
  let tExtraPerson = 0;
  let tExtraBed = 0;
  let tEarlyCheckIn = 0;
  let tKitchenUpi = 0;
  let tKitchenCash = 0;
  let tKitchenDue = 0;
  let tTotalFoodAmt = 0;

  filteredRows.forEach((r) => {
    tOpeningBalance = r2(tOpeningBalance + (Number(r.openingBalance) || 0));
    tRoomTariff = r2(tRoomTariff + (Number(r.roomTariff) || 0));
    if (typeof r.gst === 'number') tGst = r2(tGst + r.gst);
    tTotalRoom = r2(tTotalRoom + (Number(r.totalRoom) || 0));
    tFood = r2(tFood + (Number(r.food) || 0));
    tWaterBottle = r2(tWaterBottle + (Number(r.waterBottle) || 0));
    tLaundry = r2(tLaundry + (Number(r.laundry) || 0));
    tAnyOthers = r2(tAnyOthers + (Number(r.anyOthers) || 0));
    tTotalExtra = r2(tTotalExtra + (Number(r.totalExtra) || 0));
    tGrandTotal = r2(tGrandTotal + (Number(r.grandTotal) || 0));
    tCash = r2(tCash + (Number(r.cash) || 0));
    tUpi = r2(tUpi + (Number(r.upi) || 0));
    tIcici = r2(tIcici + (Number(r.icici) || 0));
    tTotalPayment = r2(tTotalPayment + (Number(r.totalPayment) || 0));
    tBalanceDue = r2(tBalanceDue + (Number(r.balanceDue) || 0));
    tTaxableSubtotal = r2(tTaxableSubtotal + (Number(r.taxableSubtotal) || 0));
    tExtraPerson = r2(tExtraPerson + (Number(r.extraPerson) || 0));
    tExtraBed = r2(tExtraBed + (Number(r.extraBed) || 0));
    tEarlyCheckIn = r2(tEarlyCheckIn + (Number(r.earlyCheckIn) || 0));
    tKitchenUpi = r2(tKitchenUpi + (Number(r.kitchenUpi) || 0));
    tKitchenCash = r2(tKitchenCash + (Number(r.kitchenCash) || 0));
    tKitchenDue = r2(tKitchenDue + (Number(r.kitchenDue) || 0));
    tTotalFoodAmt = r2(tTotalFoodAmt + (Number(r.totalFoodAmt || r.food) || 0));
  });

  return {
    reportRows: filteredRows,
    dailyExpenses,
    totalExpenseAmt,
    autoOwnerHandover,
    totals: {
      openingBalance: tOpeningBalance,
      roomTariff: tRoomTariff,
      gst: tGst,
      totalRoom: tTotalRoom,
      food: tFood,
      waterBottle: tWaterBottle,
      laundry: tLaundry,
      anyOthers: tAnyOthers,
      totalExtra: tTotalExtra,
      grandTotal: tGrandTotal,
      cash: tCash,
      upi: tUpi,
      icici: tIcici,
      totalPayment: tTotalPayment,
      balanceDue: tBalanceDue,
      taxableSubtotal: tTaxableSubtotal,
      extraPerson: tExtraPerson,
      extraBed: tExtraBed,
      earlyCheckIn: tEarlyCheckIn,
      kitchenUpi: tKitchenUpi,
      kitchenCash: tKitchenCash,
      kitchenDue: tKitchenDue,
      totalFoodAmt: tTotalFoodAmt,
    },
  };
}

/**
 * Authoritative cross-device Opening Cash Carry-Forward (BUG-P2-08).
 * Never depends on browser localStorage and NEVER mixes UPI/Card/Bank into physical Cash.
 *
 * Strategy:
 * 1. Anchor to the latest DailyClosingRecord in DB strictly before `selectedDate` (if any),
 *    using its `closingCashActual ?? closingCashSystem`.
 * 2. Roll forward strictly physical Cash net delta (+ Cash Payments - Cash Expenses - Cash Handovers/Owner Cash Withdrawals)
 *    for every transaction date strictly after the anchor closing date and strictly before `selectedDate`.
 */
export function computeAuthoritativeOpeningCash(params: {
  selectedDate: string;
  dailyClosings?: DailyClosingRecord[];
  bookings?: Booking[];
  checkins?: GuestCheckIn[];
  invoices?: Invoice[];
  posOrders?: PosOrder[];
  expenses?: Expense[];
  handovers?: CashHandover[];
  ownerPayments?: OwnerDirectorPayment[];
}): {
  openingCash: number;
  anchorDate: string | null;
  anchorClosingCash: number;
  rolledCashIn: number;
  rolledCashOut: number;
} {
  const {
    selectedDate,
    dailyClosings = [],
    bookings = [],
    checkins = [],
    invoices = [],
    posOrders = [],
    expenses = [],
    handovers = [],
    ownerPayments = [],
  } = params;

  let anchorDate: string | null = null;
  let anchorClosingCash = 0;

  // 1. Find latest DB DailyClosingRecord strictly before selectedDate
  const priorClosings = (dailyClosings || [])
    .filter((dc) => {
      const d = toLocalYmd(dc?.date);
      return Boolean(d && d < selectedDate);
    })
    .sort((a, b) => toLocalYmd(b.date).localeCompare(toLocalYmd(a.date)));

  if (priorClosings.length > 0) {
    const latest = priorClosings[0];
    const val = Number(latest.closingCashActual ?? latest.closingCashSystem ?? 0);
    if (Number.isFinite(val)) {
      anchorDate = toLocalYmd(latest.date);
      anchorClosingCash = r2(val);
    }
  }

  const inRollWindow = (ymd: string): boolean => {
    if (!ymd || ymd >= selectedDate) return false;
    if (anchorDate && ymd <= anchorDate) return false;
    return true;
  };

  // 2. Roll forward strictly physical Cash receipts (deduped by payment ID across checkins/bookings/invoices)
  let rolledCashIn = 0;
  const seenCashPayIds = new Set<string>();
  const stayKeysWithStructured = new Set<string>();
  const checkinCashFingerprints = new Set<string>();

  const recordCashPayment = (
    idRaw: any,
    modeRaw: any,
    amtRaw: any,
    dateRaw: any,
    stayKeyForDedup?: string,
    sourceKind: 'checkin' | 'invoice' | 'booking' = 'checkin'
  ) => {
    const amt = r2(Number(amtRaw) || 0);
    if (amt <= 0) return;
    if (!isCashModeStr(String(modeRaw || ''))) return;
    const ymd = toLocalYmd(String(dateRaw || ''));
    if (!inRollWindow(ymd)) return;
    const pid = String(idRaw || '').trim();
    if (pid && seenCashPayIds.has(pid)) return;
    const fp = stayKeyForDedup ? `${stayKeyForDedup}|${ymd}|${amt}` : '';
    if (sourceKind !== 'checkin' && fp && checkinCashFingerprints.has(fp)) {
      return;
    }
    if (pid) seenCashPayIds.add(pid);
    if (sourceKind === 'checkin' && fp) checkinCashFingerprints.add(fp);
    rolledCashIn = r2(rolledCashIn + amt);
  };

  (checkins || []).forEach((c) => {
    const stayKey = String(c.id || `${c.roomNumber}_${c.guestName}`);
    if (Array.isArray(c.payments) && c.payments.length > 0) {
      stayKeysWithStructured.add(stayKey);
      c.payments.forEach((p: any, i: number) => {
        if (!p || String(p.notes || '').toLowerCase().includes('marked as due')) return;
        recordCashPayment(
          p.id || `ci-${stayKey}-${i}`,
          p.paymentMethod || p.method || 'Cash',
          p.amount,
          p.date || p.dateTime || c.checkInDate,
          stayKey,
          'checkin'
        );
      });
    } else if (Number(c.cashAmountPaid || 0) > 0) {
      stayKeysWithStructured.add(stayKey);
      recordCashPayment(`ci-cash-${stayKey}`, 'Cash', c.cashAmountPaid, c.checkInDate, stayKey, 'checkin');
    } else if (Number(c.advanceAmount || 0) > 0 && isCashModeStr(c.paymentMethod)) {
      stayKeysWithStructured.add(stayKey);
      recordCashPayment(`ci-adv-${stayKey}`, c.paymentMethod, c.advanceAmount, c.checkInDate, stayKey, 'checkin');
    }
  });

  (invoices || []).forEach((inv) => {
    if (
      !inv ||
      inv.isSuperseded ||
      (inv as any).isCreditNote ||
      inv.invoiceType === 'Credit Note' ||
      inv.invoiceStatus === 'Superseded' ||
      inv.invoiceStatus === 'Cancelled'
    )
      return;
    const invStayKey = String(inv.bookingId || inv.checkInId || `${inv.roomNumber}_${inv.guestName}`);
    if (Array.isArray(inv.paymentHistory) && inv.paymentHistory.length > 0) {
      inv.paymentHistory.forEach((p: any, i: number) => {
        recordCashPayment(
          p.id || `inv-${inv.id}-${i}`,
          p.paymentMethod || p.mode || p.method,
          p.amount,
          p.date || p.dateTime || inv.dateCreated,
          invStayKey,
          'invoice'
        );
      });
    }
  });

  (bookings || []).forEach((b) => {
    const bStLower = String(b?.status || '').toLowerCase().trim();
    if (
      !b ||
      bStLower === 'cancelled' ||
      bStLower === 'waiting' ||
      bStLower === 'waitlist' ||
      bStLower === 'draft' ||
      bStLower === 'no-show'
    ) {
      return;
    }
    const stayKey = String(b.id || `${b.roomNumber}_${b.guestName}`);
    if (Array.isArray((b as any).payments) && (b as any).payments.length > 0) {
      (b as any).payments.forEach((p: any, i: number) => {
        recordCashPayment(
          p.id || `bkg-${stayKey}-${i}`,
          p.paymentMethod || p.method,
          p.amount,
          p.date || p.dateTime || b.bookingDate || b.checkInDate,
          stayKey,
          'booking'
        );
      });
    } else if (!stayKeysWithStructured.has(stayKey) && Number(b.advanceAmount || 0) > 0 && isCashModeStr(b.paymentMethod)) {
      recordCashPayment(`bkg-adv-${stayKey}`, b.paymentMethod, b.advanceAmount, b.bookingDate || b.checkInDate, stayKey, 'booking');
    }
  });

  // Counter-paid Cash POS food orders (excluding room-billed & cancelled/voided/held)
  (posOrders || []).forEach((o) => {
    const st = String(o?.status || '').toLowerCase();
    const kotSt = String((o as any)?.kotStatus || '').toLowerCase();
    if (st === 'cancelled' || st === 'voided' || st === 'held' || kotSt === 'cancelled' || (o as any)?.isHeld) return;
    const pm = String(o?.paymentMethod || '').toLowerCase();
    const ps = String(o?.paymentStatus || '').toLowerCase();
    const toRoom = (o as any)?.postToRoomBill === true || pm.includes('room');
    const isPaidCounterCash = ((o as any)?.isPaid === true || ps === 'paid') && !toRoom && pm.includes('cash');
    if (!isPaidCounterCash) return;
    const gross = r2(Number(o.grandTotal ?? (o as any).totalAmount ?? 0));
    recordCashPayment(`pos-${o.id}`, 'Cash', gross, (o as any).date || (o as any).createdAt);
  });

  // 3. Roll forward strictly physical Cash outflows (Cash expenses + Cash handovers + Cash owner withdrawals)
  let rolledCashOut = 0;

  (expenses || []).forEach((e) => {
    const ymd = toLocalYmd(e?.date || (e as any)?.createdAt || '');
    if (!inRollWindow(ymd)) return;
    if (String((e as any).approvalStatus || (e as any).status || '').toLowerCase() === 'rejected') return;
    if (!isCashModeStr((e as any).paymentMethod || (e as any).paymentMode || (e as any).paymentSource)) return;
    rolledCashOut = r2(rolledCashOut + (Number(e.amount) || 0));
  });

  (handovers || []).forEach((h) => {
    const ymd = toLocalYmd(h?.date);
    if (!inRollWindow(ymd)) return;
    const st = String((h as any).status || '').toLowerCase();
    if (st === 'cancelled' || st === 'rejected') return;
    const method = (h as any).paymentMethod || (h as any).paymentMode;
    if (method && !isCashModeStr(method)) return;
    rolledCashOut = r2(rolledCashOut + (Number(h.amount) || 0));
  });

  (ownerPayments || []).forEach((op) => {
    const ymd = toLocalYmd(op?.date);
    if (!inRollWindow(ymd)) return;
    if (op.status === 'Cancelled' || isCapitalContributionPayment(op)) return;
    if (!isCashModeStr(op.paymentMethod || (op as any).paymentMode)) return;
    rolledCashOut = r2(rolledCashOut + (Number(op.amount) || 0));
  });

  const openingCash = r2(anchorClosingCash + rolledCashIn - rolledCashOut);

  return {
    openingCash,
    anchorDate,
    anchorClosingCash,
    rolledCashIn,
    rolledCashOut,
  };
}

export default function DailyCollectionSheet({
  rooms = [],
  bookings = [],
  checkins = [],
  invoices = [],
  expenses = [],
  posOrders = [],
  posAdvanceBookings = [],
  handovers = [],
  ownerPayments = [],
  dailyClosings = [],
  waterBottles = [],
  laundryOrders = [],
  staff = [],
  hotelSettings,
  onEditCheckout
}: DailyCollectionSheetProps) {
  // Selected Report Date (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => {
    return localTodayStr();
  });

  const [searchTerm, setSearchTerm] = useState('');

  const hotelScopeId = String((hotelSettings as any)?.id || (hotelSettings as any)?.hotelId || 'default');

  // Counter Reconciliation States (persisted per hotel + date in localStorage, carried forward from last date)
  const storageKey = `pms_daily_counter_${hotelScopeId}_${selectedDate}`;
  const closingCacheKey = `pms_daily_closing_cache_${hotelScopeId}_${selectedDate}`;
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [manualOwnerHandover, setManualOwnerHandover] = useState<number | null>(null);
  const [customNote, setCustomNote] = useState<string>('');
  const [isEditingCounter, setIsEditingCounter] = useState(false);

  // Authoritative cross-device opening cash computed directly from DB records (BUG-P2-08)
  const authoritativeOpeningCash = useMemo(
    () =>
      computeAuthoritativeOpeningCash({
        selectedDate,
        dailyClosings,
        bookings,
        checkins,
        invoices,
        posOrders,
        expenses,
        handovers,
        ownerPayments,
      }).openingCash,
    [selectedDate, dailyClosings, bookings, checkins, invoices, posOrders, expenses, handovers, ownerPayments]
  );

  // Load explicit per-date manual counter override (if saved for selectedDate) or use authoritative DB carry-forward
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setOpeningBalance(typeof parsed.openingBalance === 'number' ? parsed.openingBalance : authoritativeOpeningCash);
        setManualOwnerHandover(typeof parsed.ownerHandover === 'number' ? parsed.ownerHandover : null);
        setCustomNote(typeof parsed.customNote === 'string' ? parsed.customNote : '');
        return;
      }

      // Reset date-specific manual overrides and apply cross-device authoritative DB carry-forward
      setManualOwnerHandover(null);
      setCustomNote('');
      setOpeningBalance(authoritativeOpeningCash);
    } catch {
      setOpeningBalance(authoritativeOpeningCash);
    }
  }, [selectedDate, storageKey, authoritativeOpeningCash]);

  // Format date as DD-MM-YYYY for display
  const formattedDisplayDate = useMemo(() => {
    return formatDdmmyyyy(selectedDate);
  }, [selectedDate]);

  // Navigate date (IST arithmetic)
  const handleShiftDate = (days: number) => {
    setSelectedDate((prev) => addDaysIst(prev, days));
  };

  // Compile guest ledger records, column totals, cash expenses & handovers via centralized engine
  const {
    reportRows,
    dailyExpenses,
    totalExpenseAmt,
    autoOwnerHandover,
    totals,
  } = useMemo(
    () =>
      computeDailyCollectionSheet({
        selectedDate,
        searchTerm,
        rooms,
        bookings,
        checkins,
        invoices,
        expenses,
        posOrders,
        posAdvanceBookings,
        handovers,
        ownerPayments,
        waterBottles,
        laundryOrders,
        hotelSettings,
      }),
    [
      selectedDate,
      searchTerm,
      rooms,
      bookings,
      checkins,
      invoices,
      expenses,
      posOrders,
      posAdvanceBookings,
      handovers,
      ownerPayments,
      waterBottles,
      laundryOrders,
      hotelSettings,
    ]
  );

  const ownerHandover = manualOwnerHandover !== null ? manualOwnerHandover : autoOwnerHandover;

  // Default expense note built from expenses list
  const defaultExpenseNote = useMemo(() => {
    if (dailyExpenses.length === 0) return 'NO DAILY CASH EXPENSES RECORDED';
    return dailyExpenses
      .map((e) => `${e.amount} - ${((e as any).title || e.description || e.category || 'EXPENSE').toUpperCase()}`)
      .join(', ');
  }, [dailyExpenses]);

  const activeExpenseNote = customNote || defaultExpenseNote;

  // Cash Counter Calculations matching the exact Excel format formula:
  // CASH COLLECTION TODAY = Total Cash Payment Column (Col 15)
  const totalCashCollected = totals.cash;
  const closingCounterSubtotal = openingBalance + totalCashCollected;
  const finalClosingBalance = closingCounterSubtotal - totalExpenseAmt - ownerHandover;

  // Auto-cache closing balance for selectedDate so the next date automatically carries it forward
  useEffect(() => {
    try {
      localStorage.setItem(
        closingCacheKey,
        JSON.stringify({
          openingBalance,
          closingBalance: finalClosingBalance,
          updatedAt: Date.now(),
        })
      );
    } catch {}
  }, [closingCacheKey, openingBalance, finalClosingBalance]);

  // Save counter balance to localStorage
  const handleSaveCounterState = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          openingBalance,
          ownerHandover,
          customNote: activeExpenseNote,
          closingBalance: finalClosingBalance
        })
      );
      setIsEditingCounter(false);
      showToast(`Daily counter reconciliation saved for ${formattedDisplayDate}.`, 'success');
    } catch {}
  };

  // Export to formatted Excel (.xls) matching Client's exact 19-column Draft Format + Cash Reconciliation Box
  const handleDownloadExcel = () => {
    const esc = (v: any) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const dataRowsHtml = reportRows
      .map(
        (r) => `
      <tr>
        <td style="text-align:center;">${r.no}</td>
        <td style="text-align:left;font-weight:bold;">${esc(r.guestName)}</td>
        <td style="text-align:center;">${esc(r.roomNumber)}</td>
        <td style="text-align:center;background:#ffff00;font-weight:bold;">${r.nights}</td>
        <td style="text-align:right;">${r.openingBalance || ''}</td>
        <td style="text-align:right;">${r.roomTariff}</td>
        <td style="text-align:right;">${r.gst}</td>
        <td style="text-align:right;">${r.totalRoom}</td>
        <td style="text-align:right;">${r.food}</td>
        <td style="text-align:right;">${r.waterBottle}</td>
        <td style="text-align:right;">${r.laundry}</td>
        <td style="text-align:right;">${r.anyOthers}</td>
        <td style="text-align:right;">${r.totalExtra}</td>
        <td style="text-align:right;font-weight:bold;">${r.grandTotal}</td>
        <td style="text-align:right;">${r.cash}</td>
        <td style="text-align:right;">${r.upi}</td>
        <td style="text-align:right;">${r.icici}</td>
        <td style="text-align:right;">${r.totalPayment}</td>
        <td style="text-align:right;font-weight:bold;">${r.balanceDue}</td>
      </tr>`
      )
      .join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /></head>
      <body>
        <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;">
          <tr>
            <td colspan="19" style="text-align:center;font-weight:bold;font-size:14pt;background:#f3f4f6;">${esc(hotelName.toUpperCase())} - DAILY COLLECTION SHEET</td>
          </tr>
          <tr>
            <td colspan="19" style="text-align:center;font-weight:bold;font-style:italic;font-size:12pt;">${esc(formattedDisplayDate)}</td>
          </tr>
          <tr style="background:#d9d9d9;font-weight:bold;text-align:center;color:#c00000;">
            <td rowspan="2">SR. NO.</td>
            <td rowspan="2">CUSTOMER NAME</td>
            <td rowspan="2">ROOM NO.</td>
            <td rowspan="2">NO OF DAYS</td>
            <td rowspan="2" style="color:#002060;">OPENING BALANCE</td>
            <td rowspan="2">ROOM TARIFF</td>
            <td rowspan="2">GST</td>
            <td rowspan="2">TOTAL<br/>ROOM TARIFF (+) GST</td>
            <td colspan="4">EXTRA SERVICE</td>
            <td rowspan="2">TOTAL EXTRA SERVICE</td>
            <td rowspan="2">TOTAL (ROOM TARIFF AND EXTRA SERVICE)</td>
            <td colspan="3">PAYMENT</td>
            <td rowspan="2">TOTAL PAYMENT</td>
            <td rowspan="2" style="color:#002060;">BALANCE DUE</td>
          </tr>
          <tr style="background:#d9d9d9;font-weight:bold;text-align:center;color:#c00000;">
            <td>FOOD</td>
            <td>WATER BOTTLE</td>
            <td>LAUNDRY CHARGES</td>
            <td>ANY OTHERS</td>
            <td>CASH</td>
            <td>UPI</td>
            <td>ICICI</td>
          </tr>
          <tr style="background:#d9d9d9;font-weight:bold;text-align:center;color:#c00000;">
            <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td>
            <td>9</td><td>10</td><td>11</td><td>12</td><td>13</td><td>14</td>
            <td>15</td><td>16</td><td>17</td><td>18</td><td>19</td>
          </tr>
          <tr style="background:#e7e6e6;font-weight:bold;text-align:center;color:#c00000;">
            <td></td><td></td><td></td><td></td><td>***</td><td></td><td></td><td>(5+6+7)</td>
            <td></td><td></td><td></td><td></td><td>(9+10+11+12)</td><td>(8+13)</td>
            <td></td><td></td><td></td><td>(15+16+17)</td><td>(14-18)</td>
          </tr>
          ${dataRowsHtml}
          <tr style="background:#d9d9d9;font-weight:bold;color:#c00000;">
            <td></td><td></td><td style="text-align:center;">TOTAL</td><td></td>
            <td style="text-align:right;">${totals.openingBalance || ''}</td>
            <td style="text-align:right;">${totals.roomTariff}</td>
            <td style="text-align:right;">${totals.gst}</td>
            <td style="text-align:right;">${totals.totalRoom}</td>
            <td style="text-align:right;">${totals.food}</td>
            <td style="text-align:right;">${totals.waterBottle}</td>
            <td style="text-align:right;">${totals.laundry}</td>
            <td style="text-align:right;">${totals.anyOthers}</td>
            <td style="text-align:right;">${totals.totalExtra}</td>
            <td style="text-align:right;">${totals.grandTotal}</td>
            <td style="text-align:right;">${totals.cash}</td>
            <td style="text-align:right;">${totals.upi}</td>
            <td style="text-align:right;">${totals.icici}</td>
            <td style="text-align:right;">${totals.totalPayment}</td>
            <td style="text-align:right;">${totals.balanceDue}</td>
          </tr>
          <tr><td colspan="19" style="border:none;">&nbsp;</td></tr>
          <tr>
            <td colspan="2" style="font-weight:bold;color:#c00000;background:#d9d9d9;">OPENING CASH BALANCE</td>
            <td style="text-align:right;font-weight:bold;color:#c00000;background:#d9d9d9;">${openingBalance}</td>
            <td colspan="2" style="border:none;"></td>
            <td colspan="6" style="border:none;font-weight:bold;font-style:italic;color:#c00000;">&#8594; TO BE CARRIED FORWARD FROM LAST DATE</td>
          </tr>
          <tr>
            <td colspan="2" style="font-weight:bold;">CASH COLLECTION TODAY</td>
            <td style="text-align:right;font-weight:bold;">${totals.cash}</td>
            <td style="border:none;"></td>
            <td style="border:none;text-align:center;font-weight:bold;">***</td>
            <td colspan="6" style="border:none;font-weight:bold;">TO BE CARRIED FORWARD FROM LAST DATE</td>
          </tr>
          <tr style="background:#d9d9d9;font-weight:bold;">
            <td colspan="2">TOTAL</td>
            <td style="text-align:right;">${closingCounterSubtotal}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-weight:bold;">LESS : EXPENSES</td>
            <td style="text-align:right;font-weight:bold;">${totalExpenseAmt}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-weight:bold;">LESS : TAKEN BY OWNER</td>
            <td style="text-align:right;font-weight:bold;">${ownerHandover}</td>
          </tr>
          <tr style="background:#d9d9d9;font-weight:bold;color:#c00000;">
            <td colspan="2">CLOSING CASH BALANCE</td>
            <td style="text-align:right;">${finalClosingBalance}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Collection_Sheet_${selectedDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to CSV matching Client Draft Format Daily Collection (Cols 1 to 19 + Counter Cash Settlement)
  const handleDownloadCsv = () => {
    const headers = [
      'SR. NO.', 'CUSTOMER NAME', 'ROOM NO.', 'NO OF DAYS', 'OPENING BALANCE',
      'ROOM TARIFF', 'GST', 'TOTAL ROOM TARIFF (+) GST',
      'FOOD', 'WATER BOTTLE', 'LAUNDRY CHARGES', 'ANY OTHERS', 'TOTAL EXTRA SERVICE',
      'TOTAL (ROOM TARIFF AND EXTRA SERVICE)',
      'CASH', 'UPI', 'ICICI', 'TOTAL PAYMENT', 'BALANCE DUE'
    ];

    const colNumbers = [
      '1', '2', '3', '4', '5',
      '6', '7', '8',
      '9', '10', '11', '12', '13',
      '14',
      '15', '16', '17', '18', '19'
    ];

    const formulaReference = [
      '', '', '', '', '***',
      '', '', '(5+6+7)',
      '', '', '', '', '(9+10+11+12)',
      '(8+13)',
      '', '', '', '(15+16+17)', '(14-18)'
    ];

    const rows = reportRows.map((r) => [
      r.no,
      `"${String(r.guestName || '').replace(/"/g, '""')}"`,
      `"${String(r.roomNumber || '')}"`,
      r.nights,
      r.openingBalance,
      r.roomTariff,
      r.gst,
      r.totalRoom,
      r.food,
      r.waterBottle,
      r.laundry,
      r.anyOthers,
      r.totalExtra,
      r.grandTotal,
      r.cash,
      r.upi,
      r.icici,
      r.totalPayment,
      r.balanceDue
    ]);

    const totalRow = [
      '', '', 'TOTAL', '', totals.openingBalance,
      totals.roomTariff, totals.gst, totals.totalRoom,
      totals.food, totals.waterBottle, totals.laundry, totals.anyOthers, totals.totalExtra,
      totals.grandTotal,
      totals.cash, totals.upi, totals.icici, totals.totalPayment, totals.balanceDue
    ];

    const csvContent = [
      `"DRAFT FORMAT DAILY COLLECTION"`,
      `"${formattedDisplayDate}"`,
      headers.join(','),
      colNumbers.join(','),
      formulaReference.join(','),
      ...rows.map((row) => row.join(',')),
      totalRow.join(','),
      '',
      `"OPENING CASH BALANCE",${openingBalance},,"TO BE CARRIED FORWARD FROM LAST DATE"`,
      `"CASH COLLECTION TODAY",${totals.cash},"***","TO BE CARRIED FORWARD FROM LAST DATE"`,
      `"TOTAL",${closingCounterSubtotal}`,
      `"LESS : EXPENSES",${totalExpenseAmt}`,
      `"LESS : TAKEN BY OWNER",${ownerHandover}`,
      `"CLOSING CASH BALANCE",${finalClosingBalance}`,
      activeExpenseNote ? `"NOTE - ${activeExpenseNote}"` : ''
    ].filter(Boolean).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Collection_Sheet_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const hotelName = hotelSettings?.name || 'Hotel Raj Residency';
  const ownerName = (hotelSettings as any)?.ownerName || 'Adarsh Sir';

  return (
    <div className="space-y-5">
      {/* -------------------- Top Action & Date Bar (Light Luxury Header — Hidden in Print) -------------------- */}
      <div className="bg-gradient-to-br from-[#FFFDF9] via-[#FDF8EC] to-[#F8EED8] border border-[#E6D3A7] rounded-2xl p-5 md:p-6 shadow-sm space-y-5 text-[#1F2937] no-print">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-start gap-3.5">
            <span className="p-3 bg-gradient-to-br from-[#DFB962] to-[#C49A3A] rounded-2xl text-white shadow-sm shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-serif font-extrabold tracking-tight text-[#1F2937]">
                  Daily Reception Collection &amp; Settlement Sheet
                </h1>
                <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 bg-[#F6E8C3] text-[#8B691E] border border-[#DFC07A] rounded-full uppercase tracking-wider">
                  Official Audit Register
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                Guest-by-guest room tariff, mode of payment (Cash, UPI, Bank), extra services, kitchen food settlement, and counter cash vault reconciliation.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#D4A745] to-[#BE8F2E] hover:from-[#C49837] hover:to-[#A87D24] text-white text-xs font-extrabold rounded-xl shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Print Landscape Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-extrabold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Export Excel (.xls)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-[#FDF8EC] text-[#263449] border border-[#DCCBA6] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#B5822D]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditingCounter(!isEditingCounter)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl shadow-2xs border transition-all cursor-pointer ${
                isEditingCounter
                  ? 'bg-amber-100 text-amber-950 border-amber-400'
                  : 'bg-white hover:bg-amber-50 text-[#8B691E] border-[#DFC07A]'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditingCounter ? 'Done Editing' : 'Edit Balances & Notes'}</span>
            </button>
          </div>
        </div>

        {/* Date Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E6D3A7]/70">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleShiftDate(-1)}
              className="p-2 bg-white border border-[#DFC99B] hover:bg-[#FDF8EC] rounded-xl text-[#263449] shadow-2xs transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#DFC99B] rounded-xl shadow-2xs">
              <Calendar className="w-4 h-4 text-[#C49A3A]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-[#1F2937] focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => handleShiftDate(1)}
              className="p-2 bg-white border border-[#DFC99B] hover:bg-[#FDF8EC] rounded-xl text-[#263449] shadow-2xs transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(localTodayStr())}
              className="px-3.5 py-2 text-xs font-mono font-bold bg-[#F6E8C3] hover:bg-[#EFE0B4] text-[#8B691E] border border-[#DFC07A] rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              Today
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search guest name or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-[#DFC99B] rounded-xl focus:outline-none focus:border-[#C49A3A] focus:ring-2 focus:ring-[#C49A3A]/20 font-mono text-[#1F2937] placeholder-slate-400 shadow-2xs"
            />
          </div>
        </div>

        {/* Counter Edit Panel (Visible only when Editing) */}
        {isEditingCounter && (
          <div className="bg-white border border-[#DFC07A] p-4 rounded-xl space-y-3 shadow-xs animate-in fade-in duration-200">
            <h3 className="text-xs font-mono font-extrabold text-[#8B691E] uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#C49A3A]" /> Edit Cash Counter Balances &amp; Settlement Notes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1 font-bold">
                  Opening Counter Balance (₹)
                </label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                  className="w-full p-2.5 bg-[#FDFBF7] border border-[#DCE3EC] rounded-lg font-bold text-[#1F2937] focus:outline-none focus:border-[#C49A3A]"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1 font-bold">
                  Cash Taken by {ownerName} (₹)
                </label>
                <input
                  type="number"
                  value={ownerHandover}
                  onChange={(e) => setManualOwnerHandover(e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                  className="w-full p-2.5 bg-[#FDFBF7] border border-[#DCE3EC] rounded-lg font-bold text-[#1F2937] focus:outline-none focus:border-[#C49A3A]"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1 font-bold">
                  Daily Expense / Handover Note
                </label>
                <input
                  type="text"
                  placeholder={`e.g. 8,500 - CASH TAKEN BY ${ownerName.toUpperCase()}`}
                  value={activeExpenseNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full p-2.5 bg-[#FDFBF7] border border-[#DCE3EC] rounded-lg font-mono text-xs uppercase text-[#1F2937] focus:outline-none focus:border-[#C49A3A]"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveCounterState}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Save Balances for {formattedDisplayDate}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* -------------------- EXECUTIVE KPI SUMMARY CARDS (100% LIGHT LUXURY — NO PRINT) -------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 no-print">
        {/* Card 1: Room Tariff */}
        <div className="bg-white p-4 rounded-2xl border border-[#E6DFCE] shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#DFB962] to-[#C49A3A]" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-slate-500">Room Tariff</span>
            <span className="p-1.5 rounded-lg bg-[#FDF6E3] text-[#B5822D]">
              <Building2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-[#1F2937] mt-2">
            ₹{totals.roomTariff.toLocaleString('en-IN')}
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1">
            {reportRows.length} {reportRows.length === 1 ? 'Stay' : 'Stays'} Logged
          </div>
        </div>

        {/* Card 2: Cash Inflow */}
        <div className="bg-gradient-to-b from-[#F4FBF7] to-white p-4 rounded-2xl border border-emerald-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-emerald-800">Cash Inflow</span>
            <span className="p-1.5 rounded-lg bg-emerald-100/80 text-emerald-700">
              <Wallet className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-emerald-700 mt-2">
            ₹{totalCashCollected.toLocaleString('en-IN')}
          </div>
          <div className="text-[10.5px] text-emerald-700/80 font-medium mt-1">
            Physical Cash Collected
          </div>
        </div>

        {/* Card 3: Online & UPI */}
        <div className="bg-gradient-to-b from-[#F3F8FF] to-white p-4 rounded-2xl border border-sky-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 to-blue-600" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-sky-900">UPI / ICICI Bank</span>
            <span className="p-1.5 rounded-lg bg-sky-100/80 text-sky-700">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-sky-700 mt-2">
            ₹{(totals.upi + totals.icici).toLocaleString('en-IN')}
          </div>
          <div className="text-[10.5px] text-sky-700/80 font-medium mt-1">
            Digital Settlements
          </div>
        </div>

        {/* Card 4: Kitchen Food */}
        <div className="bg-gradient-to-b from-[#FFFBF2] to-white p-4 rounded-2xl border border-amber-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-amber-900">Kitchen Food</span>
            <span className="p-1.5 rounded-lg bg-amber-100/80 text-amber-700">
              <Utensils className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-amber-800 mt-2">
            ₹{totals.totalFoodAmt.toLocaleString('en-IN')}
          </div>
          <div className="text-[10.5px] text-amber-800/80 font-medium mt-1">
            F&amp;B Total Revenue
          </div>
        </div>

        {/* Card 5: Opening Counter */}
        <div className="bg-gradient-to-b from-[#F8FAFC] to-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-slate-300 to-slate-500" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-slate-600">Opening Balance</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-slate-800 mt-2">
            ₹{openingBalance.toLocaleString('en-IN')}
          </div>
          <div className="text-[10.5px] text-slate-500 font-medium mt-1">
            Drawer Start Balance
          </div>
        </div>

        {/* Card 6: Closing Cash (Luminous Champagne Gold — Zero Dark BG!) */}
        <div className="bg-gradient-to-br from-[#FFFDF7] via-[#FDF5DF] to-[#F7E6B7] p-4 rounded-2xl border-2 border-[#D4A745]/70 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#C49A3A] via-[#E5BE67] to-[#A87D24]" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase font-extrabold tracking-wider text-[#7A5915]">Closing Vault</span>
            <span className="p-1.5 rounded-lg bg-[#C49A3A]/15 text-[#8B691E]">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-[#6E4D0E] mt-2">
            ₹{finalClosingBalance.toLocaleString('en-IN')}
          </div>
          <div className="text-[10.5px] text-[#8B691E] font-semibold mt-1">
            Net In-Hand Balance
          </div>
        </div>
      </div>

      {/* -------------------- PRINTABLE A4 LANDSCAPE SHEET CONTAINER -------------------- */}
      <div
        id="daily-collection-print-sheet"
        className="bg-white p-5 md:p-6 border border-[#E6D8B8] shadow-sm rounded-2xl space-y-5 print:border-0 print:p-0 print:shadow-none print:m-0"
      >
        {/* Printable Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-4 border-b-2 border-[#E5D2A6] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-6 rounded-full bg-gradient-to-b from-[#DFB962] to-[#B5822D] inline-block print:hidden" />
              <h2 className="text-xl md:text-2xl font-serif font-black tracking-wide uppercase text-[#1F2937]">
                {hotelName}
              </h2>
            </div>
            <p className="text-xs font-mono font-bold text-[#9A7120] tracking-wider mt-1 pl-4 print:pl-0">
              DAILY RECEPTION COLLECTION &amp; SETTLEMENT SHEET
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono font-bold px-3 py-1.5 bg-[#FBF6E9] text-[#7A5915] border border-[#DFC07A] rounded-xl inline-flex items-center gap-1.5 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[#C49A3A]" />
              <span>Date: {formattedDisplayDate}</span>
            </span>
          </div>
        </div>

        {/* Main Grid Table - Crisp Light Luxury Audit Ledger */}
        <div className="overflow-x-auto rounded-2xl border border-[#E5D6B3] shadow-xs bg-white">
          <table className="w-full border-collapse text-left text-[11px] font-mono min-w-[1380px] tabular-nums">
            <thead>
              {/* Date Banner Row matching Excel Row 7 */}
              <tr className="bg-gradient-to-r from-[#FDF8EC] via-[#F9EED4] to-[#FDF8EC] text-[#263449] text-center font-extrabold border-b border-[#E5D6B3] print:bg-white print:text-black">
                <th colSpan={onEditCheckout ? 20 : 19} className="py-2.5 px-3 text-sm tracking-wider font-serif">
                  Daily Settlement Ledger — {formattedDisplayDate}
                </th>
              </tr>

              {/* Header Row 1 (100% Soft Pastel Light Luxury Headers — Zero Dark Cells!) */}
              <tr className="bg-[#FBF6E9] text-[#263449] text-center font-extrabold border-b border-[#E2D3B0] print:bg-gray-100 print:text-black">
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 w-[3%] min-w-[44px] text-center whitespace-nowrap text-[#5B4720]">
                  SR. NO.
                </th>
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 min-w-[150px] text-left whitespace-nowrap text-[#263449]">
                  CUSTOMER NAME
                </th>
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 min-w-[68px] whitespace-nowrap text-[#263449]">
                  ROOM NO.
                </th>
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 min-w-[58px] whitespace-nowrap text-[#263449]">
                  NO OF DAYS
                </th>
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 min-w-[82px] text-right whitespace-nowrap bg-[#F0F7FF] text-sky-800 print:text-black">
                  OPENING<br/>BALANCE
                </th>
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 min-w-[88px] text-right whitespace-nowrap text-[#263449]" title="Agreed Room Tariff">
                  ROOM TARIFF
                </th>
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 min-w-[62px] text-right whitespace-nowrap text-[#263449]">
                  GST
                </th>
                <th rowSpan={2} className="border-r border-[#E2D3B0] p-2.5 min-w-[94px] text-right whitespace-nowrap bg-[#F5E9CA] text-[#6E4D0E]">
                  TOTAL<br/><span className="text-[9px] font-bold text-[#8B691E]">ROOM TARIFF (+) GST</span>
                </th>
                <th colSpan={4} className="border-r border-[#E6CCA0] p-2 bg-[#FEF5E7] text-[#9A5B13] font-black tracking-wide whitespace-nowrap">
                  EXTRA SERVICE
                </th>
                <th rowSpan={2} className="border-r border-[#E6CCA0] p-2.5 min-w-[92px] text-right whitespace-nowrap bg-[#FDEBD0] text-[#7E4A0E] font-black">
                  TOTAL EXTRA<br/>SERVICE
                </th>
                <th rowSpan={2} className="border-r border-[#DFC07A] p-2.5 min-w-[106px] text-right whitespace-nowrap bg-[#F4E3B8] text-[#5C3F08] font-black">
                  TOTAL<br/><span className="text-[9px] font-bold text-[#7A5915]">(ROOM TARIFF &amp; EXTRA)</span>
                </th>
                <th colSpan={3} className="border-r border-emerald-200 p-2 bg-[#ECFDF5] text-emerald-800 font-black tracking-wide whitespace-nowrap">
                  PAYMENT
                </th>
                <th rowSpan={2} className="border-r border-emerald-200 p-2.5 min-w-[94px] text-right whitespace-nowrap bg-[#D1FAE5] text-emerald-900 font-black">
                  TOTAL<br/>PAYMENT
                </th>
                <th rowSpan={2} className="border-r border-rose-200 p-2.5 min-w-[88px] text-right whitespace-nowrap bg-[#FFF1F2] text-rose-800 font-black">
                  BALANCE<br/>DUE
                </th>
                {onEditCheckout && (
                  <th rowSpan={2} className="p-2.5 min-w-[70px] text-center whitespace-nowrap bg-slate-50 text-slate-600 print:hidden">
                    ACTION
                  </th>
                )}
              </tr>

              {/* Header Row 2 */}
              <tr className="bg-[#FFF9EF] text-center font-bold border-b border-[#E2D3B0] print:bg-gray-200 print:text-black">
                <th className="border-r border-[#E6CCA0] p-2 min-w-[64px] text-right whitespace-nowrap text-[#9A5B13]">
                  FOOD
                </th>
                <th className="border-r border-[#E6CCA0] p-2 min-w-[74px] text-right whitespace-nowrap text-[#9A5B13]">
                  WATER BOTTLE
                </th>
                <th className="border-r border-[#E6CCA0] p-2 min-w-[78px] text-right whitespace-nowrap text-[#9A5B13]">
                  LAUNDRY CHARGES
                </th>
                <th className="border-r border-[#E6CCA0] p-2 min-w-[72px] text-right whitespace-nowrap text-[#9A5B13]">
                  ANY OTHERS
                </th>
                <th className="border-r border-emerald-200 p-2 min-w-[68px] text-right whitespace-nowrap bg-[#F0FDF4] text-emerald-800">
                  CASH
                </th>
                <th className="border-r border-emerald-200 p-2 min-w-[68px] text-right whitespace-nowrap bg-[#F0F9FF] text-sky-800">
                  UPI
                </th>
                <th className="border-r border-emerald-200 p-2 min-w-[68px] text-right whitespace-nowrap bg-[#EEF2FF] text-indigo-800">
                  ICICI
                </th>
              </tr>

              {/* Header Row 3: Column Index Numbers (1 to 19) */}
              <tr className="bg-[#FAF8F3] text-[#8B691E] text-center font-extrabold text-[10px] border-b border-[#EAE1CC] print:bg-gray-100">
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19].map((num) => (
                  <th key={num} className="border-r border-[#EAE1CC] py-1.5 px-1 text-center font-bold">
                    {num}
                  </th>
                ))}
                {onEditCheckout && <th className="py-1.5 px-1 bg-slate-50/70 print:hidden" />}
              </tr>

              {/* Header Row 4: Exact Formula Reference Row matching Excel Row 12 */}
              <tr className="bg-white text-rose-700 text-center font-extrabold text-[10px] border-b-2 border-[#D8C18B] print:bg-gray-50">
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5 text-rose-600 font-black" title="To be carried forward from last date">***</th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5 whitespace-nowrap bg-[#FDF9EE] text-[#7A5915]">(5+6+7)</th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5 whitespace-nowrap bg-[#FFF9F0] text-[#9A5B13]">(9+10+11+12)</th>
                <th className="border-r border-[#EAE1CC] py-1.5 whitespace-nowrap bg-[#FDF6E3] text-[#6E4D0E]">(8+13)</th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5"></th>
                <th className="border-r border-[#EAE1CC] py-1.5 whitespace-nowrap bg-[#F0FDF4] text-emerald-800">(15+16+17)</th>
                <th className="border-r border-[#EAE1CC] py-1.5 whitespace-nowrap bg-[#FFF5F5] text-rose-700">(14-18)</th>
                {onEditCheckout && <th className="py-1.5 bg-slate-50/40 print:hidden" />}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F0E8D6] bg-white">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={onEditCheckout ? 20 : 19} className="p-10 text-center bg-[#FFFDF9]">
                    <div className="max-w-md mx-auto space-y-2.5 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#FDF6E3] border border-[#E6D3A7] text-[#B5822D] flex items-center justify-center mx-auto">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="font-serif font-bold text-sm sm:text-base text-[#1F2937]">
                        No Guest Settlements Recorded for {formattedDisplayDate}
                      </div>
                      <p className="text-xs text-slate-500 font-sans leading-relaxed">
                        There are no active stay collections or checkout transactions registered on this date.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(localTodayStr())}
                        className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A745] to-[#BE8F2E] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer hover:from-[#C49837] hover:to-[#A87D24] shadow-xs transition-all"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Jump to Today's Records
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                reportRows.map((r) => (
                  <tr key={r.no} className="even:bg-[#FDFBF7] hover:bg-[#FDF6E3]/65 text-center font-medium transition-colors border-b border-[#EFE8D8]">
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] font-bold text-slate-600">
                      {r.no}
                    </td>
                    <td className="py-2.5 px-2.5 border-r border-[#EFE8D8] text-left font-bold truncate uppercase text-[#1F2937]">
                      {r.guestName}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-[#FBF6E9] text-[#7A5915] border border-[#E5D2A6]">
                        {r.roomNumber}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] font-bold text-slate-700">
                      {r.nights}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-slate-500">
                      {r.openingBalance > 0 ? `₹${r.openingBalance.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td
                      className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono font-bold text-[#1F2937]"
                      title={
                        [
                          r.baseRoomTariff > 0 ? `Room: ₹${r.baseRoomTariff.toLocaleString('en-IN')}` : '',
                          r.extraBed > 0 ? `Extra Bed: ₹${r.extraBed.toLocaleString('en-IN')}` : '',
                          r.extraPerson > 0 ? `Extra Person: ₹${r.extraPerson.toLocaleString('en-IN')}` : '',
                          r.earlyCheckIn > 0 ? `Early Check-In: ₹${r.earlyCheckIn.toLocaleString('en-IN')}` : '',
                          r.lateCheckOut > 0 ? `Late Check-Out: ₹${r.lateCheckOut.toLocaleString('en-IN')}` : '',
                          r.discount > 0 ? `Discount: -₹${r.discount.toLocaleString('en-IN')}` : '',
                        ]
                          .filter(Boolean)
                          .join(' + ') || undefined
                      }
                    >
                      {r.roomTariff > 0 ? `₹${r.roomTariff.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono">
                      {r.gst && r.gst !== '0' && r.gst !== 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-bold text-[10px]">
                          {typeof r.gst === 'number' ? `₹${r.gst.toLocaleString('en-IN')}` : r.gst}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono font-bold text-[#263449] bg-[#FDF9EE]/70">
                      ₹{r.totalRoom.toLocaleString('en-IN')}
                    </td>

                    {/* Extra Services: Food, Water, Laundry, Any Others */}
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-amber-800 font-semibold">
                      {r.food > 0 ? `₹${r.food.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-slate-700">
                      {r.waterBottle > 0 ? `₹${r.waterBottle.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-slate-700">
                      {r.laundry > 0 ? `₹${r.laundry.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-slate-700">
                      {r.anyOthers > 0 ? `₹${r.anyOthers.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono font-extrabold text-[#9A5B13] bg-[#FFF9F0]/80">
                      ₹{r.totalExtra.toLocaleString('en-IN')}
                    </td>

                    {/* Total (Room + Extra) */}
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono font-black text-[#1F2937] bg-[#FDF6E3]/80">
                      ₹{r.grandTotal.toLocaleString('en-IN')}
                    </td>

                    {/* Payments: Cash, UPI, ICICI */}
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-emerald-700 font-bold">
                      {r.cash > 0 ? `₹${r.cash.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-sky-700 font-bold">
                      {r.upi > 0 ? `₹${r.upi.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono text-indigo-700 font-bold">
                      {r.icici > 0 ? `₹${r.icici.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono font-extrabold text-emerald-800 bg-[#F0FDF4]/80">
                      ₹{r.totalPayment.toLocaleString('en-IN')}
                    </td>

                    {/* Balance Due */}
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono font-bold">
                      {r.balanceDue > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-extrabold">
                          ₹{r.balanceDue.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
                          PAID (₹0)
                        </span>
                      )}
                    </td>

                    {onEditCheckout && (
                      <td className="py-2.5 px-2 text-center print:hidden">
                        {(r as any).checkinTarget ? (
                          <button
                            type="button"
                            onClick={() => onEditCheckout((r as any).checkinTarget)}
                            title="Edit Check-Out Settlement & Payment Modes"
                            className="px-2.5 py-1 rounded-lg bg-[#FDF6E3] hover:bg-[#F5E7C1] border border-[#DFC07A] text-[#7A5915] text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                          >
                            <Edit3 className="w-3 h-3 text-[#B5822D]" /> Edit
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Totals Row (100% Light Pastel Luxury — ZERO Dark/Black Cells!) */}
            <tfoot>
              <tr className="bg-[#FBF6E9] text-[#1F2937] text-center font-extrabold border-t-2 border-[#C49A3A] print:bg-gray-200 print:text-black">
                <td colSpan={4} className="p-3 text-right uppercase tracking-wider text-xs border-r border-[#E2D3B0] text-[#6E4D0E] font-black">
                  GRAND TOTAL:
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E2D3B0] text-sky-800 font-bold">
                  {totals.openingBalance > 0 ? `₹${totals.openingBalance.toLocaleString('en-IN')}` : '₹0'}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E2D3B0] font-extrabold text-[#1F2937]">
                  ₹{totals.roomTariff.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E2D3B0] text-emerald-800 font-bold">
                  {totals.gst > 0 ? `₹${totals.gst.toLocaleString('en-IN')}` : '₹0'}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E2D3B0] font-black text-[#6E4D0E] bg-[#F5E9CA]">
                  ₹{totals.totalRoom.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E6CCA0] text-amber-800 font-bold bg-[#FFFBF2]">
                  ₹{totals.food.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E6CCA0] text-slate-800 bg-[#FFFBF2]">
                  ₹{totals.waterBottle.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E6CCA0] text-slate-800 bg-[#FFFBF2]">
                  ₹{totals.laundry.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#E6CCA0] text-slate-800 bg-[#FFFBF2]">
                  ₹{totals.anyOthers.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-[#DFC07A] font-black text-[#8A4D0D] bg-[#FDEBD0]">
                  ₹{totals.totalExtra.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-[13px] border-r border-[#DFC07A] font-black text-[#5C3F08] bg-[#F4E3B8]">
                  ₹{totals.grandTotal.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs text-emerald-800 font-extrabold border-r border-emerald-200 bg-[#F0FDF4]">
                  ₹{totals.cash.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs text-sky-800 font-extrabold border-r border-emerald-200 bg-[#F0F9FF]">
                  ₹{totals.upi.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-xs text-indigo-800 font-extrabold border-r border-emerald-200 bg-[#EEF2FF]">
                  ₹{totals.icici.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-[13px] text-emerald-900 border-r border-emerald-300 font-black bg-[#D1FAE5]">
                  ₹{totals.totalPayment.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right font-mono text-[13px] text-rose-800 border-r border-rose-200 font-black bg-[#FFE4E6]">
                  ₹{totals.balanceDue.toLocaleString('en-IN')}
                </td>
                {onEditCheckout && (
                  <td className="p-3 bg-[#FBF6E9] text-slate-400 print:hidden">—</td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* -------------------- DIRTY ROOMS (shown in audit sheet & print) -------------------- */}
        <DirtyRoomsPanel rooms={rooms} checkins={checkins} className="mt-2" />

        {/* -------------------- BOTTOM COUNTER RECONCILIATION & NOTE SECTION -------------------- */}
        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-[#1F2937]">
          {/* Left Box: Counter Cash Drawer Reconciliation */}
          <div className="border border-[#E5D2A6] rounded-2xl bg-white shadow-2xs overflow-hidden">
            <div className="bg-gradient-to-r from-[#FBF5E6] to-[#F5E7C3] px-4 py-3 text-[#263449] border-b border-[#E5D2A6] font-serif font-extrabold text-xs uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#B5822D]" />
                Counter Cash Drawer Reconciliation
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/80 border border-[#DFC07A] text-[#8B691E]">
                Daily Vault Audit
              </span>
            </div>
            <table className="w-full text-xs font-mono font-medium border-collapse tabular-nums">
              <tbody className="divide-y divide-[#F0E8D6]">
                <tr className="bg-[#FFFBF2] hover:bg-[#FDF6E3]/60">
                  <td className="p-3 font-extrabold uppercase text-rose-700">
                    Opening Cash Balance
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold italic text-rose-600 normal-case">
                      <ArrowRight className="w-3 h-3 inline text-sky-600" /> Carried forward from last date
                    </span>
                  </td>
                  <td className="p-3 text-right font-black text-rose-700">₹{openingBalance.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="hover:bg-[#FDFBF7]">
                  <td className="p-3 font-bold uppercase text-emerald-800">
                    Cash Collection Today (+)
                    <span className="ml-2 text-[10px] font-medium text-slate-500 normal-case">
                      (*** Opening Bal Col 5 = Carried forward)
                    </span>
                  </td>
                  <td className="p-3 text-right font-black text-emerald-700">₹{totalCashCollected.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="bg-[#FBF6E9] font-black text-[#1F2937]">
                  <td className="p-3 uppercase font-black">Total Cash Available</td>
                  <td className="p-3 text-right font-black">₹{closingCounterSubtotal.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="hover:bg-[#FDFBF7]">
                  <td className="p-3 font-bold uppercase text-rose-800">Less : Expenses (−)</td>
                  <td className="p-3 text-right font-black text-rose-700">
                    {totalExpenseAmt > 0 ? `₹${totalExpenseAmt.toLocaleString('en-IN')}` : '—'}
                  </td>
                </tr>
                <tr className="hover:bg-[#FDFBF7]">
                  <td className="p-3 font-bold uppercase text-slate-700">Less : Taken by Owner ({ownerName.toUpperCase()}) (−)</td>
                  <td className="p-3 text-right font-black text-[#1F2937]">
                    {ownerHandover > 0 ? `₹${ownerHandover.toLocaleString('en-IN')}` : '—'}
                  </td>
                </tr>
                <tr className="bg-gradient-to-r from-emerald-50 to-[#ECFDF5] border-t-2 border-emerald-300 text-emerald-950 font-black text-sm">
                  <td className="p-3.5 uppercase tracking-wide">Closing Cash Balance</td>
                  <td className="p-3.5 text-right font-mono font-black text-emerald-800 text-base">
                    ₹{finalClosingBalance.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Box: Expense Breakdown Note & Authorization */}
          <div className="border border-[#E5D2A6] rounded-2xl bg-gradient-to-b from-[#FFFDF9] to-[#FBF6EA]/70 p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E5D2A6] pb-2.5">
              <span className="text-xs font-serif font-extrabold uppercase text-[#263449] tracking-wider">
                NOTE — Daily Cash &amp; Settlement Memo
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold rounded-full border border-emerald-300">
                ✓ Audit Verified
              </span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-[#E6D8B8] min-h-[72px] flex items-center shadow-2xs">
              <p className="text-xs font-mono font-bold text-[#263449] uppercase leading-relaxed">
                {customNote || (ownerHandover > 0 ? `${ownerHandover.toLocaleString('en-IN')} - CASH TAKEN BY ${ownerName.toUpperCase()}` : activeExpenseNote)}
              </p>
            </div>

            <div className="pt-4 text-[11px] text-slate-600 font-mono grid grid-cols-2 gap-4 border-t border-[#E6D8B8]">
              <div className="border-t-2 border-dashed border-[#D8C18B] pt-1.5 text-center">
                <span className="font-bold text-[#263449] block">Duty Manager</span>
                <span className="text-[10px] text-slate-500">Signature &amp; Clearance</span>
              </div>
              <div className="border-t-2 border-dashed border-[#D8C18B] pt-1.5 text-center">
                <span className="font-bold text-[#263449] block">Receptionist / Cashier</span>
                <span className="text-[10px] text-slate-500">Drawer Reconciliation</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------- PRINT-ONLY CSS -------------------- */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 6mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 10px !important;
          }
          .no-print, header, nav, aside {
            display: none !important;
          }
          #daily-collection-print-sheet {
            display: block !important;
            width: 100% !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            page-break-inside: auto;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th, td {
            border: 1px solid black !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
