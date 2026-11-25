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
} from '../types';
import DirtyRoomsPanel from './DirtyRoomsPanel';
import { showToast } from '../utils/toast';
import {
  getTodayIst,
  formatDdmmyyyy,
  addDaysIst,
} from '../utils/reportingDates';
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

export default function DailyCollectionSheet({
  rooms = [],
  bookings = [],
  checkins = [],
  invoices = [],
  expenses = [],
  posOrders = [],
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

  // Load persisted counter values or carry forward from last date's Closing Cash Balance
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setOpeningBalance(typeof parsed.openingBalance === 'number' ? parsed.openingBalance : 0);
        setManualOwnerHandover(typeof parsed.ownerHandover === 'number' ? parsed.ownerHandover : null);
        setCustomNote(typeof parsed.customNote === 'string' ? parsed.customNote : '');
        return;
      }

      // Reset date-specific manual overrides before checking carry-forward
      setManualOwnerHandover(null);
      setCustomNote('');

      // 1. Check prior dates (up to 30 days back) for saved closing balance or cached closing balance
      let carriedOpening: number | null = null;
      for (let i = 1; i <= 30; i++) {
        const prevYmd = addDaysIst(selectedDate, -i);
        const prevSavedRaw = localStorage.getItem(`pms_daily_counter_${hotelScopeId}_${prevYmd}`);
        if (prevSavedRaw) {
          const prevParsed = JSON.parse(prevSavedRaw);
          if (typeof prevParsed.closingBalance === 'number') {
            carriedOpening = prevParsed.closingBalance;
            break;
          }
        }
        const prevCacheRaw = localStorage.getItem(`pms_daily_closing_cache_${hotelScopeId}_${prevYmd}`);
        if (prevCacheRaw) {
          const prevCache = JSON.parse(prevCacheRaw);
          if (typeof prevCache.closingBalance === 'number') {
            carriedOpening = prevCache.closingBalance;
            break;
          }
        }
      }

      // 2. Fallback to latest DailyClosingRecord from DB strictly before selectedDate
      if (carriedOpening === null && Array.isArray(dailyClosings) && dailyClosings.length > 0) {
        const priorClosings = dailyClosings
          .filter((dc) => {
            const d = toLocalYmd(dc.date);
            return Boolean(d && d < selectedDate);
          })
          .sort((a, b) => toLocalYmd(b.date).localeCompare(toLocalYmd(a.date)));
        if (priorClosings.length > 0) {
          const latest = priorClosings[0];
          const val = Number(latest.closingCashActual ?? latest.closingCashSystem ?? 0);
          if (Number.isFinite(val)) carriedOpening = val;
        }
      }

      setOpeningBalance(carriedOpening !== null ? carriedOpening : 0);
    } catch {
      setOpeningBalance(0);
    }
  }, [selectedDate, storageKey, hotelScopeId, dailyClosings]);

  // Format date as DD-MM-YYYY for display
  const formattedDisplayDate = useMemo(() => {
    return formatDdmmyyyy(selectedDate);
  }, [selectedDate]);

  // Navigate date (IST arithmetic)
  const handleShiftDate = (days: number) => {
    setSelectedDate((prev) => addDaysIst(prev, days));
  };

  // Compile guest ledger records for the selected date
  const reportRows = useMemo(() => {
    const rowsMap = new Map<string, any>();

    // 1. Check-ins active or settled on the selected date (including overdue active in-house guests)
    const todayYmd = localTodayStr();
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
        const key = `${c.roomNumber}_${c.guestName}`;
        rowsMap.set(key, {
          source: 'checkin',
          checkin: c,
          guestName: c.guestName,
          roomNumber: c.roomNumber,
          checkInDate: inDate,
          checkOutDate: outDate,
          roomRate: c.roomRate || 0,
          nights: Math.max(1, Math.round(Math.abs(new Date(outDate || selectedDate).getTime() - new Date(inDate || selectedDate).getTime()) / (1000 * 60 * 60 * 24)) || 1),
          advancePayment: Number(c.advanceAmount ?? (c as any).advancePayment ?? 0),
          paymentMethod: c.paymentMethod || 'Cash',
          extraCharges: c.extraCharges || [],
          separateInvoices: []
        });
      }
    });

    // 2. Invoices generated or settled on selected date (skip superseded/cancelled; never overwrite primary stay invoice with INV-SEP)
    invoices.forEach((inv) => {
      if (inv.isSuperseded || inv.invoiceStatus === 'Superseded' || inv.invoiceStatus === 'Cancelled') {
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
        const key = `${inv.roomNumber}_${inv.guestName}`;
        const existing = rowsMap.get(key) || {
          source: 'invoice',
          guestName: inv.guestName,
          roomNumber: inv.roomNumber,
          checkInDate: inDate,
          checkOutDate: outDate,
          roomRate: inv.roomCharges || 0,
          nights: inv.nights || 1,
          extraCharges: [],
          separateInvoices: []
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

      if (isActive && b.status !== 'Cancelled') {
        const key = `${b.roomNumber}_${b.guestName}`;
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
            separateInvoices: []
          });
        }
      }
    });

    // 4. POS Food Orders on selected date
    const ordersOnDate = posOrders.filter((o) => {
      const oDate = toLocalYmd((o as any).date || (o as any).createdAt || (o as any).orderTime || (o as any).timestamp || '');
      return oDate === selectedDate;
    });

    // Track all matched POS order IDs to ensure non-room orders can also be shown
    const allMatchedOrderIds = new Set<string>();

    // Transform mapped rows into exact table items matching the audit register
    const processed = Array.from(rowsMap.values()).map((row, idx) => {
      const c = row.checkin;
      const inv = row.invoice;
      const b = row.booking;

      const guestName = (row.guestName || 'GUEST').toUpperCase();
      const roomNumber = row.roomNumber || 'N/A';
      const nights = row.nights || 1;

      // Agreed / Charged Room Tariff (Direct negotiated rate, e.g. ₹1800, matching physical register)
      const splitRoomNums = String(roomNumber)
        .split(',')
        .map((rn: string) => rn.trim())
        .filter(Boolean);
      const bookedRoomsArr: any[] =
        (Array.isArray(c?.bookedRooms) && c.bookedRooms.length > 0
          ? c.bookedRooms
          : Array.isArray(b?.bookedRooms) && b.bookedRooms.length > 0
          ? b.bookedRooms
          : []) as any[];

      let roomTariff = 0;
      if (inv && Number(inv.roomCharges) > 0) {
        roomTariff = Number(inv.roomCharges);
      } else if (bookedRoomsArr.length > 0) {
        roomTariff = bookedRoomsArr.reduce((sum, br) => sum + Number(br.rate || 0) * nights, 0);
      } else if (c && Number(c.roomRate) > 0) {
        roomTariff = Number(c.roomRate) * Math.max(1, splitRoomNums.length) * nights;
      } else {
        roomTariff = (row.roomRate || 0) * nights;
      }
      if (!roomTariff || roomTariff <= 0) {
        if (bookedRoomsArr.length > 0) {
          roomTariff = bookedRoomsArr.reduce((sum, br) => {
            const rmObj = rooms.find(r => r.number === String(br.roomNumber || '').trim());
            return sum + Number(br.rate || rmObj?.rate || 0) * nights;
          }, 0);
        } else if (splitRoomNums.length > 0) {
          roomTariff = splitRoomNums.reduce((sum, rn) => {
            const rmObj = rooms.find(r => r.number === rn);
            return sum + (rmObj ? Number(rmObj.rate || 0) * nights : 0);
          }, 0);
        }
      }
      if (!roomTariff || roomTariff <= 0) roomTariff = (row.roomRate || 2000) * nights;

      // GST on stay
      let gstAmount: number | string = 0;
      if (inv) {
        gstAmount = inv.tax ?? inv.gst ?? 0;
      } else if (c && c.gstAmount !== undefined) {
        gstAmount = Number(c.gstAmount) || 0;
      } else if (b?.otaName === 'MakeMyTrip' || b?.otaName === 'MMT') {
        gstAmount = 'MMT';
      } else {
        const settingsRate = hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 0);
        gstAmount = b && b.gstAmount !== undefined ? Number(b.gstAmount) : Math.round((roomTariff * settingsRate) / 100);
      }

      // Room Payment Modes (Hybrid / Split Payment Aware across checkin.payments, invoice.paymentHistory, invoice.paymentDetails, booking.payments)
      let cashPay = 0;
      let upiPay = 0;
      let iciciPay = 0; // Card / Bank / Online

      const addByMode = (modeRaw: string, amtRaw: number) => {
        const amt = Number(amtRaw) || 0;
        if (amt <= 0) return;
        const m = String(modeRaw || 'Cash').toLowerCase();
        if (m.includes('cash')) cashPay += amt;
        else if (m.includes('upi') || m.includes('gpay') || m.includes('phonepe') || m.includes('paytm') || m.includes('qr')) upiPay += amt;
        else if (m.includes('card') || m.includes('bank') || m.includes('icici') || m.includes('online') || m.includes('neft') || m.includes('rtgs') || m.includes('imps')) iciciPay += amt;
        else cashPay += amt;
      };

      const structuredPayments: Array<{ id: string; mode: string; amount: number; isAdv: boolean }> = [];
      const seenPayIds = new Set<string>();
      let seenAdvanceTotal = 0;

      const pushStructured = (idRaw: any, modeRaw: any, amtRaw: any, notesRaw?: any, typeRaw?: any) => {
        const amt = Number(amtRaw) || 0;
        if (amt <= 0) return;
        const idStr = String(idRaw || '');
        const isAdv =
          String(typeRaw || '').toLowerCase().includes('advance') ||
          String(notesRaw || '').toLowerCase().includes('advance') ||
          String(notesRaw || '').toLowerCase().includes('check-in') ||
          idStr.toLowerCase().includes('adv') ||
          idStr.toLowerCase().includes('checkin');
        if (idStr && seenPayIds.has(idStr)) return;
        // Collapse duplicate advance records across booking/checkin/invoice (e.g. pay-adv-X, adv-X, PAY-X-adv)
        if (isAdv && seenAdvanceTotal > 0 && Math.abs(seenAdvanceTotal - amt) < 1) {
          return;
        }
        if (idStr) seenPayIds.add(idStr);
        if (isAdv) seenAdvanceTotal += amt;
        structuredPayments.push({ id: idStr, mode: String(modeRaw || 'Cash'), amount: amt, isAdv });
      };

      if (Array.isArray(c?.payments) && c.payments.length > 0) {
        c.payments.forEach((p: any, i: number) =>
          pushStructured(p.id || `cp-${i}`, p.paymentMethod || p.method, p.amount, p.notes, p.paymentType)
        );
      }
      if (inv && Array.isArray(inv.paymentHistory) && inv.paymentHistory.length > 0) {
        inv.paymentHistory.forEach((p: any, i: number) =>
          pushStructured(p.id || `iph-${i}`, p.paymentMethod || p.mode || p.method, p.amount, p.notes)
        );
      }
      if (inv && Array.isArray((inv as any).paymentDetails) && (inv as any).paymentDetails.length > 0) {
        (inv as any).paymentDetails.forEach((p: any, i: number) =>
          pushStructured(p.id || `ipd-${i}`, p.mode || p.method || p.paymentMethod, p.amount, p.notes)
        );
      }
      if (Array.isArray((b as any)?.payments) && (b as any).payments.length > 0) {
        (b as any).payments.forEach((p: any, i: number) =>
          pushStructured(p.id || `bp-${i}`, p.paymentMethod || p.method, p.amount, p.notes, p.paymentType)
        );
      }

      if (structuredPayments.length > 0) {
        structuredPayments.forEach(sp => addByMode(sp.mode, sp.amount));
      } else {
        const pMode = String(c?.paymentMethod || b?.paymentMethod || inv?.paymentMethod || 'Cash');
        // Handle summary strings like "Cash ₹4000 + UPI ₹345" if ever encountered without structured array
        const splitMatches = Array.from(pMode.matchAll(/(Cash|UPI|Card|Bank(?:\s*Transfer)?|Online)\s*₹?\s*([\d.]+)/gi));
        if (splitMatches.length > 0) {
          splitMatches.forEach(m => addByMode(m[1], Number(m[2])));
        } else {
          const paid = Number(
            inv?.paidAmount ??
              inv?.amountPaid ??
              ((Number(c?.advanceAmount || 0) + Number(c?.cashAmountPaid || 0) + Number(c?.onlineAmountPaid || 0)) ||
                Number(b?.advanceAmount || 0))
          );
          addByMode(pMode, paid);
        }
      }

      // Balance
      const totalPaidRoom = cashPay + upiPay + iciciPay;
      const totalStayPayable =
        inv && Number(inv.finalAmount) > 0
          ? Number(inv.finalAmount)
          : c && Number(c.totalAmount) > 0
          ? Number(c.totalAmount)
          : roomTariff + (typeof gstAmount === 'number' ? gstAmount : 0);
      let balance = Math.max(0, Math.round((totalStayPayable - totalPaidRoom) * 100) / 100);
      if (inv && typeof inv.pendingAmount === 'number') {
        balance = inv.pendingAmount;
      } else if (c && typeof c.pendingAmount === 'number') {
        balance = c.pendingAmount;
      }

      // Room Amenities & Extra Charges
      let waterBottle = 0;
      let extraPerson = 0;
      let laundry = 0;
      let extraBed = 0;
      let otherMiscExtras = 0;

      const isFoodCategory = (cat: string) =>
        cat.includes('food') ||
        cat.includes('kitchen') ||
        cat.includes('restaurant') ||
        cat.includes('thali') ||
        cat.includes('breakfast') ||
        cat.includes('lunch') ||
        cat.includes('dinner') ||
        cat.includes('room service');

      const seenExtraIds = new Set<string>();
      const extras = (c?.extraCharges || []).concat(inv?.extraCharges || []);
      extras.forEach((ec: any) => {
        const ecId = String(ec?.id || '');
        if (ecId && seenExtraIds.has(ecId)) return;
        if (ecId) seenExtraIds.add(ecId);
        const cat = String(ec.category || ec.description || '').toLowerCase();
        const amt = Number(ec.amount) || 0;
        if (amt <= 0 || isFoodCategory(cat)) return;
        if (cat.includes('water') || cat.includes('bottle')) waterBottle += amt;
        else if (cat.includes('person') || cat.includes('occupant') || cat === 'ep') extraPerson += amt;
        else if (cat.includes('laundry') || cat.includes('wash') || cat.includes('iron') || cat.includes('dry clean')) laundry += amt;
        else if (cat.includes('bed') || cat.includes('mattress')) extraBed += amt;
        else otherMiscExtras += amt;
      });

      // Also include chargeable WaterBottleRecord logs for this room on selectedDate if not already counted in extraCharges
      if (waterBottle === 0 && Array.isArray(waterBottles) && waterBottles.length > 0) {
        const roomWaterLogs = waterBottles.filter((wb) => {
          if (toLocalYmd(wb.date || wb.dateTime) !== selectedDate) return false;
          const wbRoom = String(wb.roomNumber || '').replace(/[^\d]/g, '').trim();
          const rowRoomDigits = String(roomNumber || '').replace(/[^\d]/g, '').trim();
          const splitDigits = splitRoomNums.map((rn) => rn.replace(/[^\d]/g, '').trim()).filter(Boolean);
          const roomOk = Boolean(wbRoom && (wbRoom === rowRoomDigits || splitDigits.includes(wbRoom)));
          const chargeable = wb.isChargeable === true || String(wb.type || '').toLowerCase() === 'chargeable';
          return roomOk && chargeable;
        });
        roomWaterLogs.forEach((wb) => {
          const amt = Number(wb.totalAmount ?? wb.chargeAmount ?? (Number(wb.quantity || 0) * Number(wb.unitPrice || 0)));
          if (amt > 0) waterBottle += amt;
        });
      }

      // Also include Guest LaundryOrder records for this room/checkin on selectedDate if not already counted in extraCharges
      if (laundry === 0 && Array.isArray(laundryOrders) && laundryOrders.length > 0) {
        const roomLaundry = laundryOrders.filter((lo) => {
          if (lo.orderType !== 'Guest Laundry' || lo.paymentStatus === 'Complimentary') return false;
          if (toLocalYmd(lo.date) !== selectedDate) return false;
          if (lo.folioChargeId && seenExtraIds.has(lo.folioChargeId)) return false;
          const loRoom = String(lo.roomNumber || '').replace(/[^\d]/g, '').trim();
          const rowRoomDigits = String(roomNumber || '').replace(/[^\d]/g, '').trim();
          const splitDigits = splitRoomNums.map((rn) => rn.replace(/[^\d]/g, '').trim()).filter(Boolean);
          const checkinMatch = Boolean(c && (lo.checkInId === c.id || lo.checkinId === c.id));
          return checkinMatch || Boolean(loRoom && (loRoom === rowRoomDigits || splitDigits.includes(loRoom)));
        });
        roomLaundry.forEach((lo) => {
          const amt = Number(lo.totalAmount) || 0;
          if (amt > 0) laundry += amt;
        });
      }

      if (inv) {
        if (inv.waterCharges) waterBottle = Math.max(waterBottle, inv.waterCharges);
        if (inv.extraBedCharges) extraBed = Math.max(extraBed, inv.extraBedCharges);
      }

      // Kitchen / Food Amounts breakdown (UPI, CASH, DUE, TOTAL FOOD AMT)
      let kitchenUpi = 0;
      let kitchenCash = 0;
      let kitchenDue = 0;

      const cleanNum = (str: any) => String(str || '').replace(/[^\d]/g, '').trim();
      const rowRoomClean = cleanNum(roomNumber);
      const cleanSplitRooms = splitRoomNums.map(cleanNum).filter(Boolean);

      // Find POS orders matching this room, stay or guest
      const roomOrders = ordersOnDate.filter((o) => {
        const oRoomClean = cleanNum(o.roomNumber);
        const oGuest = String(o.guestName || '').toLowerCase().trim();
        const rGuest = String(guestName || '').toLowerCase().trim();
        const isRoomMatch =
          Boolean(rowRoomClean && oRoomClean && (rowRoomClean === oRoomClean || cleanSplitRooms.includes(oRoomClean)));
        const isCheckinMatch =
          Boolean((c && (o.checkinId === c.id || (o as any).checkInId === c.id)) ||
          (b && (o as any).bookingId === b.id) ||
          (inv && (o as any).linkedInvoiceId === inv.id));
        const isGuestMatch = Boolean(oGuest && rGuest && (oGuest.includes(rGuest) || rGuest.includes(oGuest)));

        return isRoomMatch || isCheckinMatch || (isGuestMatch && Boolean(o.roomNumber));
      });

      roomOrders.forEach((o) => {
        const oId = String(o.id || (o as any)._id);
        allMatchedOrderIds.add(oId);

        const pMethod = String(o.paymentMethod || '').toLowerCase();
        const pStatus = String(o.paymentStatus || '').toLowerCase();
        const isPaid = (o as any).isPaid === true || pStatus === 'paid';
        const amt = Number(o.grandTotal ?? (o as any).totalAmount ?? (o as any).total ?? (o as any).subtotal ?? 0);
        if (amt <= 0) return;

        if (!isPaid || pMethod.includes('due') || pMethod.includes('room') || pMethod.includes('credit')) {
          kitchenDue += amt;
        } else if (pMethod.includes('cash')) {
          kitchenCash += amt;
        } else {
          kitchenUpi += amt;
        }
      });

      // Also check extraCharges (Guest Folio) for food charges not already counted via POS orders
      const extrasList = (c?.extraCharges || []).concat(inv?.extraCharges || []);
      extrasList.forEach((ec: any) => {
        const cat = String(ec.category || ec.description || '').toLowerCase();
        const isFood =
          cat.includes('food') ||
          cat.includes('kitchen') ||
          cat.includes('restaurant') ||
          cat.includes('thali') ||
          cat.includes('breakfast') ||
          cat.includes('lunch') ||
          cat.includes('dinner') ||
          cat.includes('room service');
        if (!isFood) return;

        const ecId = String(ec.id || '');
        const ecSrc = String(ec.sourceId || '');
        if (ecSrc && allMatchedOrderIds.has(ecSrc)) return;
        if (ecId && allMatchedOrderIds.has(ecId)) return;
        if (Array.from(allMatchedOrderIds).some((oid) => ecId.includes(oid))) return;

        const amt = Number(ec.amount) || 0;
        if (amt <= 0) return;

        if (balance > 0) {
          kitchenDue += amt;
        } else if (cashPay > 0 && upiPay === 0) {
          kitchenCash += amt;
        } else {
          kitchenUpi += amt;
        }
      });

      // If food charges on invoice exist and no separate POS orders or folio charges found
      if (roomOrders.length === 0 && kitchenUpi === 0 && kitchenCash === 0 && kitchenDue === 0 && inv && Number(inv.foodCharges) > 0) {
        const f = Number(inv.foodCharges);
        if (inv.isPaid) {
          const invMethod = String(inv.paymentMethod || '').toLowerCase();
          if (invMethod.includes('cash')) kitchenCash = f;
          else kitchenUpi = f;
        } else {
          kitchenDue = f;
        }
      }

      const totalFoodAmt = kitchenUpi + kitchenCash + kitchenDue;

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
                Math.round((Number(roomTariff) || 0) / Math.max(1, Number(nights) || 1)) ||
                2000,
              checkInDate: b.checkInDate,
              checkOutDate: b.checkOutDate,
              advanceAmount: Number(b.advanceAmount) || 0,
              paymentMethod: b.paymentMethod || 'Cash',
              discount: Number((b as any).discount || inv?.discount || 0),
              totalAmount: totalStayPayable,
              pendingAmount: balance,
              checkedOutDateTime: inv?.dateCreated || b.checkOutDate,
            } as GuestCheckIn)
          : null);

      const openingBalance = Number((c as any)?.openingBalance || (b as any)?.openingBalance || 0);
      const roomTariffNum = Number(roomTariff) || 0;
      const gstNum = typeof gstAmount === 'number' ? gstAmount : 0;
      const totalRoom = openingBalance + roomTariffNum + gstNum;

      const foodAmt = totalFoodAmt;
      const waterBottleAmt = waterBottle;
      const laundryAmt = laundry;
      const anyOthersAmt = extraPerson + extraBed + otherMiscExtras;
      const totalExtra = foodAmt + waterBottleAmt + laundryAmt + anyOthersAmt;

      const grandTotal = totalRoom + totalExtra;

      const payCash = cashPay + kitchenCash;
      const payUpi = upiPay + kitchenUpi;
      const payIcici = iciciPay;
      const totalPayment = payCash + payUpi + payIcici;

      const balanceDue = Math.max(0, Math.round((grandTotal - totalPayment) * 100) / 100);

      return {
        no: idx + 1,
        guestName,
        roomNumber,
        nights,
        openingBalance,
        roomTariff: roomTariffNum,
        gst: gstAmount,
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
        // Detailed components
        extraPerson,
        extraBed,
        kitchenUpi,
        kitchenCash,
        kitchenDue,
        totalFoodAmt,
        checkinTarget
      };
    });

    // 5. Append any walk-in / non-room food orders on the selected date so no food sales are omitted
    const unallocatedOrders = ordersOnDate.filter(
      (o) => !allMatchedOrderIds.has(String(o.id || (o as any)._id))
    );

    unallocatedOrders.forEach((o) => {
      const amt = Number(o.grandTotal ?? (o as any).totalAmount ?? (o as any).total ?? (o as any).subtotal ?? 0);
      if (amt <= 0) return;
      const pMethod = String(o.paymentMethod || '').toLowerCase();
      const pStatus = String(o.paymentStatus || '').toLowerCase();
      const isPaid = (o as any).isPaid === true || pStatus === 'paid';
      let kUpi = 0;
      let kCash = 0;
      let kDue = 0;
      if (!isPaid || pMethod.includes('due') || pMethod.includes('room') || pMethod.includes('credit')) {
        kDue = amt;
      } else if (pMethod.includes('cash')) {
        kCash = amt;
      } else {
        kUpi = amt;
      }

      processed.push({
        no: processed.length + 1,
        guestName: String(o.guestName || `WALK-IN FOOD (${o.orderType || 'KITCHEN'})`).toUpperCase(),
        roomNumber: o.roomNumber ? String(o.roomNumber) : (o.tableNo ? `TBL ${o.tableNo}` : 'KITCHEN'),
        nights: 0,
        openingBalance: 0,
        roomTariff: 0,
        gst: Number(o.taxAmount || 0),
        totalRoom: Number(o.taxAmount || 0),
        food: amt,
        waterBottle: 0,
        laundry: 0,
        anyOthers: 0,
        totalExtra: amt,
        grandTotal: amt + Number(o.taxAmount || 0),
        cash: kCash,
        upi: kUpi,
        icici: 0,
        totalPayment: kCash + kUpi,
        balanceDue: !isPaid ? amt : 0,
        extraPerson: 0,
        extraBed: 0,
        kitchenUpi: kUpi,
        kitchenCash: kCash,
        kitchenDue: kDue,
        totalFoodAmt: amt,
        checkinTarget: null,
      });
    });

    // Re-index row numbers
    processed.forEach((p, i) => {
      p.no = i + 1;
    });

    if (!searchTerm.trim()) return processed;
    const term = searchTerm.toLowerCase();
    return processed.filter(
      (r) =>
        r.guestName.toLowerCase().includes(term) ||
        String(r.roomNumber).toLowerCase().includes(term)
    );
  }, [checkins, invoices, bookings, posOrders, waterBottles, laundryOrders, selectedDate, searchTerm, hotelSettings]);

  // Cash Expenses on selected date (only physical cash / petty cash leaves the drawer)
  const dailyExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const eDate = toLocalYmd(e.date || (e as any).createdAt || '');
      if (eDate !== selectedDate) return false;
      if (String((e as any).approvalStatus || (e as any).status || '').toLowerCase() === 'rejected') return false;
      return isCashModeStr((e as any).paymentMethod || (e as any).paymentMode || (e as any).paymentSource);
    });
  }, [expenses, selectedDate]);

  const totalExpenseAmt = useMemo(() => {
    return dailyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [dailyExpenses]);

  // Auto-calculated Cash Taken by Owner (from CashHandovers + Cash Owner Withdrawals on selectedDate)
  const autoOwnerHandover = useMemo(() => {
    let sum = 0;
    (handovers || []).forEach((h) => {
      if (toLocalYmd(h.date) === selectedDate) {
        sum += Number(h.amount) || 0;
      }
    });
    (ownerPayments || []).forEach((op) => {
      if (toLocalYmd(op.date) !== selectedDate) return;
      if (op.status === 'Cancelled') return;
      if (isCapitalContributionPayment(op)) return;
      if (isCashModeStr(op.paymentMethod || (op as any).paymentMode)) {
        sum += Number(op.amount) || 0;
      }
    });
    return Math.round(sum * 100) / 100;
  }, [handovers, ownerPayments, selectedDate]);

  const ownerHandover = manualOwnerHandover !== null ? manualOwnerHandover : autoOwnerHandover;

  // Default expense note built from expenses list
  const defaultExpenseNote = useMemo(() => {
    if (dailyExpenses.length === 0) return 'NO DAILY CASH EXPENSES RECORDED';
    return dailyExpenses
      .map((e) => `${e.amount} - ${((e as any).title || e.description || e.category || 'EXPENSE').toUpperCase()}`)
      .join(', ');
  }, [dailyExpenses]);

  const activeExpenseNote = customNote || defaultExpenseNote;

  // Table Column Totals
  const totals = useMemo(() => {
    let openingBalance = 0;
    let roomTariff = 0;
    let gstNum = 0;
    let totalRoom = 0;
    let food = 0;
    let waterBottle = 0;
    let laundry = 0;
    let anyOthers = 0;
    let totalExtra = 0;
    let grandTotal = 0;
    let cash = 0;
    let upi = 0;
    let icici = 0;
    let totalPayment = 0;
    let balanceDue = 0;

    let extraPerson = 0;
    let extraBed = 0;
    let kitchenUpi = 0;
    let kitchenCash = 0;
    let kitchenDue = 0;
    let totalFoodAmt = 0;

    reportRows.forEach((r) => {
      openingBalance += Number(r.openingBalance) || 0;
      roomTariff += Number(r.roomTariff) || 0;
      if (typeof r.gst === 'number') gstNum += r.gst;
      totalRoom += Number(r.totalRoom) || 0;
      food += Number(r.food) || 0;
      waterBottle += Number(r.waterBottle) || 0;
      laundry += Number(r.laundry) || 0;
      anyOthers += Number(r.anyOthers) || 0;
      totalExtra += Number(r.totalExtra) || 0;
      grandTotal += Number(r.grandTotal) || 0;
      cash += Number(r.cash) || 0;
      upi += Number(r.upi) || 0;
      icici += Number(r.icici) || 0;
      totalPayment += Number(r.totalPayment) || 0;
      balanceDue += Number(r.balanceDue) || 0;

      extraPerson += Number(r.extraPerson) || 0;
      extraBed += Number(r.extraBed) || 0;
      kitchenUpi += Number(r.kitchenUpi) || 0;
      kitchenCash += Number(r.kitchenCash) || 0;
      kitchenDue += Number(r.kitchenDue) || 0;
      totalFoodAmt += Number(r.totalFoodAmt || r.food) || 0;
    });

    return {
      openingBalance,
      roomTariff,
      gst: gstNum,
      totalRoom,
      food,
      waterBottle,
      laundry,
      anyOthers,
      totalExtra,
      grandTotal,
      cash,
      upi,
      icici,
      totalPayment,
      balanceDue,
      extraPerson,
      extraBed,
      kitchenUpi,
      kitchenCash,
      kitchenDue,
      totalFoodAmt
    };
  }, [reportRows]);

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
                    <td className="py-2.5 px-2 border-r border-[#EFE8D8] text-right font-mono font-bold text-[#1F2937]">
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
