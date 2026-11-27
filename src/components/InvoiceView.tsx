import React, { useState, useEffect } from 'react';
import {
  HybridSplitPaymentBox,
  HybridSplitRow,
  createInitialHybridRows,
  getValidHybridSplits,
  formatHybridLabel,
} from './HybridSplitPaymentBox';
import { Invoice, GuestCheckIn, Booking, UserRole, Room, PaymentRecord, ExtraCharge, HotelSettings } from '../types';
import { showToast } from '../utils/toast';
import { downloadHotelInvoicePdf, invoiceRecordToPrintHtml, extractDetailedFoodLinesForStay } from '../utils/pdfDownload';
import { openPrintWindow } from '../utils/printDocument';
import { openWhatsAppChat } from '../pms-integrated/utils/formatters';
import { evaluateAndBuildInvoice, normalizeInvoiceConditions, deduplicateInvoicesByBooking } from '../utils/invoiceConditions';
import {
  BillCharge,
  BillPayment,
  BillSettings,
  calculateBill,
  formatDateLabel,
  normalizeBillSettings,
  r2,
} from '../utils/billCalculator';
import { buildInvoiceRecord, buildStayBill, isActiveInvoice, resolveConsistentInvoiceTotals } from '../utils/stayBilling';
import InvoiceConditionsModal from './InvoiceConditionsModal';
import { 
  FileText, Plus, Search, Mail, Phone, Printer, Download, Landmark, 
  Trash2, Check, CreditCard, ChevronRight, Sparkles, Receipt, 
  Percent, AlertTriangle, Users, ClipboardCheck, Calendar, X, Edit, FileCheck2, UtensilsCrossed
} from 'lucide-react';

interface InvoiceViewProps {
  invoices: Invoice[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  rooms: Room[];
  posOrders?: any[];
  currentRole: UserRole;
  hotelSettings?: HotelSettings;
  onUpdateHotelSettings?: (updated: HotelSettings) => void;
  selectedBookingForInvoice: Booking | null;
  setSelectedBookingForInvoice: (booking: Booking | null) => void;
  onUpdateInvoices: (invoices: Invoice[]) => void;
  onUpdateCheckins: (checkins: GuestCheckIn[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  onAddAuditLog: (action: string, details: string) => void;
}

export default function InvoiceView({
  invoices,
  bookings,
  checkins,
  rooms,
  posOrders = [],
  currentRole,
  hotelSettings,
  onUpdateHotelSettings,
  selectedBookingForInvoice,
  setSelectedBookingForInvoice,
  onUpdateInvoices,
  onUpdateCheckins,
  onUpdateRooms,
  onUpdateBookings,
  onAddAuditLog
}: InvoiceViewProps) {
  const billSettings = normalizeBillSettings(hotelSettings);
  const configuredDefaultGst =
    hotelSettings?.isGstEnabled === false ? 0 : billSettings.roomGstRate;

  const [search, setSearch] = useState('');
  const [isConditionsModalOpen, setIsConditionsModalOpen] = useState(false);
  const [isCheckoutFormOpen, setIsCheckoutFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // checkout workflow states
  const [selectedCheckInId, setSelectedCheckInId] = useState('');
  
  // inline extra charges state
  const [chargeCategory, setChargeCategory] = useState<'Laundry' | 'Food' | 'Damage' | 'Late Checkout' | 'Other'>('Food');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState<number>(0);

  // billing overrides state
  const [discount, setDiscount] = useState<number>(0);

  // checkout payment settlement state
  const [checkoutPayAmount, setCheckoutPayAmount] = useState<number>(0);
  const [isAmountOverridden, setIsAmountOverridden] = useState<boolean>(false);
  const [checkoutPayMethod, setCheckoutPayMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank' | 'Hybrid'>('UPI');
  const [checkoutHybridRows, setCheckoutHybridRows] = useState<HybridSplitRow[]>(() => createInitialHybridRows(0, ['Cash', 'UPI', 'Card', 'Bank']));
  const [isFullyPending, setIsFullyPending] = useState<boolean>(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutGstRate, setCheckoutGstRate] = useState<number>(configuredDefaultGst || 5);
  const [isGstBillingEnabled, setIsGstBillingEnabled] = useState<boolean>(hotelSettings?.isGstEnabled !== false);

  const [notification, setNotification] = useState('');

  // Booking invoice generation modal state
  const [isBookingInvoiceModalOpen, setIsBookingInvoiceModalOpen] = useState(false);
  const [selectedBookingForNewInvId, setSelectedBookingForNewInvId] = useState('');
  const [newInvGuestName, setNewInvGuestName] = useState('');
  const [newInvMobile, setNewInvMobile] = useState('');
  const [newInvRoomNumber, setNewInvRoomNumber] = useState('');
  const [newInvCheckInDate, setNewInvCheckInDate] = useState('');
  const [newInvCheckOutDate, setNewInvCheckOutDate] = useState('');
  const [newInvRoomCharges, setNewInvRoomCharges] = useState<number>(2000);
  const [newInvHasExtraBed, setNewInvHasExtraBed] = useState(false);
  const [newInvExtraBedCount, setNewInvExtraBedCount] = useState<number>(1);
  const [newInvExtraBedRate, setNewInvExtraBedRate] = useState<number>(500);
  const [newInvExtraPersonCharges, setNewInvExtraPersonCharges] = useState<number>(0);
  const [newInvGstRate, setNewInvGstRate] = useState<number>(configuredDefaultGst);
  const [newInvDiscount, setNewInvDiscount] = useState<number>(0);
  const [newInvAdvancePaid, setNewInvAdvancePaid] = useState<number>(0);
  const [newInvPaymentMethod, setNewInvPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Online' | 'Hybrid'>('UPI');
  const [newInvHybridRows, setNewInvHybridRows] = useState<HybridSplitRow[]>(() => createInitialHybridRows(0, ['Cash', 'UPI', 'Card', 'Online']));
  const [newInvType, setNewInvType] = useState<'Tax Invoice' | 'Booking Invoice' | 'Proforma Invoice'>('Tax Invoice');
  const [newInvNotes, setNewInvNotes] = useState('');
  const [invoiceCategoryFilter, setInvoiceCategoryFilter] = useState<'All' | 'Booking' | 'Checkout' | 'Due' | 'Superseded'>('All');
  const [dateFilterType, setDateFilterType] = useState<'All' | 'Today' | 'Yesterday' | 'This Month' | 'Range'>('All');
  const [filterStartDate, setFilterStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Sync dynamic hotel GST defaults whenever hotelSettings changes
  useEffect(() => {
    const defRate = hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 5);
    setIsGstBillingEnabled(hotelSettings?.isGstEnabled !== false && defRate > 0);
    setCheckoutGstRate(defRate > 0 ? defRate : Number(hotelSettings?.defaultGstRate ?? 5));
    setNewInvGstRate(defRate);
  }, [hotelSettings?.isGstEnabled, hotelSettings?.defaultGstRate]);

  // active check-in data calculations
  const activeCheckin = checkins.find(c => c.id === selectedCheckInId && !c.checkedOutDateTime);

  // Auto-select the guest's invoice or open checkout form when navigated via Check-Out or Invoice button
  useEffect(() => {
    if (selectedBookingForInvoice) {
      const matchedInvoice =
        invoices.find(
          inv =>
            isActiveInvoice(inv) &&
            (inv.bookingId === selectedBookingForInvoice.id ||
              inv.id === selectedBookingForInvoice.id)
        ) ||
        invoices.find(
          inv =>
            isActiveInvoice(inv) &&
            inv.roomNumber === selectedBookingForInvoice.roomNumber &&
            inv.guestName === selectedBookingForInvoice.guestName
        ) ||
        invoices.find(
          inv => isActiveInvoice(inv) && inv.guestName === selectedBookingForInvoice.guestName
        );

      const matchedCheckin =
        checkins.find(c => c.id === selectedBookingForInvoice.id && !c.checkedOutDateTime) ||
        checkins.find(c => c.roomNumber === selectedBookingForInvoice.roomNumber && !c.checkedOutDateTime) ||
        checkins.find(c => c.guestName === selectedBookingForInvoice.guestName && !c.checkedOutDateTime);

      const isCompletedCheckout =
        Boolean(selectedBookingForInvoice.isCompleted) ||
        String(selectedBookingForInvoice.status || '').toLowerCase() === 'checkedout' ||
        String(selectedBookingForInvoice.status || '').toLowerCase() === 'checked out' ||
        !matchedCheckin;

      if (matchedInvoice) {
        setSelectedInvoice(matchedInvoice);
        setInvoiceCategoryFilter('All');
        setSearch('');
        if (isCompletedCheckout) {
          setIsCheckoutFormOpen(false);
        }
      }

      if (matchedCheckin && !isCompletedCheckout) {
        setSelectedCheckInId(matchedCheckin.id);
        setIsAmountOverridden(false);
        setDiscount(0);
        setChargeAmount(0);
        setChargeDescription('');
        setCheckoutNotes('');
        if (!matchedInvoice) {
          const matchedBooking = bookings.find(b => b.id === matchedCheckin.id) || null;
          const liveStay = buildStayBill({
            booking: matchedBooking || selectedBookingForInvoice,
            checkin: matchedCheckin,
            rooms,
            settings: billSettings,
          });
          const liveFolioInvoice = buildInvoiceRecord({
            id: `FOLIO-${matchedCheckin.id}`,
            invoiceNumber: `FOLIO/${String(matchedCheckin.id).replace(/^#/, '')}`,
            hotelId: matchedCheckin.hotelId || hotelSettings?.id,
            bookingId: matchedCheckin.id,
            checkInId: matchedCheckin.id,
            guestName: matchedCheckin.guestName || selectedBookingForInvoice.guestName || 'Guest',
            guestMobile: matchedCheckin.mobile || selectedBookingForInvoice.mobile,
            guestAddress: matchedCheckin.address,
            companyName: matchedCheckin.companyName,
            guestGstNumber: matchedCheckin.gstNumber,
            roomNumbers: liveStay.folio.roomNumbers.length > 0 ? liveStay.folio.roomNumbers : [matchedCheckin.roomNumber],
            checkInDate: liveStay.folio.checkInDate || matchedCheckin.checkInDate,
            checkOutDate: liveStay.folio.checkOutDate || matchedCheckin.checkOutDate || matchedCheckin.checkInDate,
            nights: liveStay.folio.nights,
            bill: liveStay.bill,
            paymentMethod: liveStay.bill.paymentItems?.map(p => `${p.method} ₹${p.amount}`).join(' + ') || matchedCheckin.paymentMethod || 'Cash',
            invoiceStatus: 'Active Folio',
            extra: {
              invoiceType: 'Active Folio',
              grcNumber: matchedCheckin.grcNumber,
              paymentHistory: (liveStay.bill.paymentItems || []).map((p, idx) => ({
                id: p.id || `folio-pay-${idx}`,
                amount: p.amount,
                paymentMethod: p.method,
                date: p.date || matchedCheckin.checkInDate,
                notes: p.note,
              })),
            },
          }) as Invoice;
          setSelectedInvoice(liveFolioInvoice);
          setInvoiceCategoryFilter('All');
          setSearch('');
          setIsCheckoutFormOpen(false);
        }
      }

      if (matchedInvoice || matchedCheckin) {
        setSelectedBookingForInvoice(null);
      }
    }
  }, [selectedBookingForInvoice, invoices, checkins, setSelectedBookingForInvoice]);

  // Keep selectedInvoice synced if its data changed, or clear it if removed (do NOT auto-open first invoice)
  useEffect(() => {
    if (!selectedInvoice) return;
    if (String(selectedInvoice.id || '').startsWith('FOLIO-')) return;
    const latest = invoices.find(i => i.id === selectedInvoice.id);
    if (!latest) {
      setSelectedInvoice(null);
    } else if (latest !== selectedInvoice) {
      setSelectedInvoice(latest);
    }
  }, [invoices, selectedInvoice]);

  // Auto-sync invoices according to centralized InvoiceConditionsConfig (one booking/stay = at most one invoice)
  useEffect(() => {
    const activeConditions = normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
      isGstEnabled: hotelSettings?.isGstEnabled ?? true,
      defaultGstRate: configuredDefaultGst
    });

    // Respect Condition 6 (Generation Mode) — if manual_only, do not auto-generate background invoices
    if (activeConditions.generationMode === 'manual_only' || activeConditions.triggerEvent === 'manual_only') {
      return;
    }

    const existingBookingIds = new Set(
      invoices.filter(isActiveInvoice).map(inv => inv.bookingId).filter(Boolean)
    );
    const newlySynced: Invoice[] = [];
    let runningInvoices = [...invoices];

    for (const c of checkins) {
      if (!c.id || existingBookingIds.has(c.id)) continue;
      const isCheckedOut = Boolean(c.checkedOutDateTime);
      // If triggerEvent is 'checkout', only auto-generate for checked-out stays
      if (activeConditions.triggerEvent === 'checkout' && !isCheckedOut) continue;
      if (isCheckedOut && !activeConditions.autoGenerateOnCheckout) continue;

      const matchedBooking = bookings.find(b => b.id === c.id) || null;
      const evalResult = evaluateAndBuildInvoice({
        hotelId: c.hotelId || hotelSettings?.id,
        booking: matchedBooking,
        checkin: c,
        rooms,
        existingInvoices: runningInvoices,
        conditions: activeConditions,
        isManualAction: false,
        isCheckoutTrigger: isCheckedOut,
        invoiceType: isCheckedOut ? 'Tax Invoice' : 'Booking Invoice'
      });

      if (evalResult.allowed && evalResult.invoice && !evalResult.duplicatePrevented) {
        const totalPaidNow = Number(c.advanceAmount || 0) + Number(c.cashAmountPaid || 0) + Number(c.onlineAmountPaid || 0);
        const invWithPayment: Invoice = {
          ...evalResult.invoice,
          hotelId: c.hotelId || hotelSettings?.id,
          advancePaid: totalPaidNow,
          amountPaid: totalPaidNow,
          pendingAmount: Math.max(0, Number(evalResult.invoice.finalAmount || 0) - totalPaidNow),
          isPaid: totalPaidNow >= Number(evalResult.invoice.finalAmount || 0),
          paymentStatus: totalPaidNow >= Number(evalResult.invoice.finalAmount || 0) ? 'Paid' : totalPaidNow > 0 ? 'Partially Paid' : 'Unpaid'
        };
        existingBookingIds.add(c.id);
        newlySynced.push(invWithPayment);
        runningInvoices.push(invWithPayment);
      }
    }

    if (activeConditions.triggerEvent === 'booking_confirmation') {
      for (const b of bookings) {
        if (!b.id || b.status === 'Cancelled' || existingBookingIds.has(b.id)) continue;
        const evalResult = evaluateAndBuildInvoice({
          hotelId: b.hotelId || hotelSettings?.id,
          booking: b,
          checkin: checkins.find(c => c.id === b.id) || null,
          rooms,
          existingInvoices: runningInvoices,
          conditions: activeConditions,
          isManualAction: false,
          isCheckoutTrigger: false,
          invoiceType: 'Booking Invoice'
        });

        if (evalResult.allowed && evalResult.invoice && !evalResult.duplicatePrevented) {
          existingBookingIds.add(b.id);
          newlySynced.push(evalResult.invoice);
          runningInvoices.push(evalResult.invoice);
        }
      }
    }

    if (newlySynced.length > 0) {
      onUpdateInvoices(deduplicateInvoicesByBooking([...invoices, ...newlySynced]));
    }
  }, [checkins.length, bookings.length]);

  const calcNightsCount = (inDate: string, outDate: string) => {
    const d1 = new Date(inDate);
    const d2 = new Date(outDate);
    const diff = Math.abs(d2.getTime() - d1.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return isNaN(days) || days <= 0 ? 1 : days;
  };

  // Deduplicate extraCharges by id and (sourceType, sourceId), ignoring zero/complimentary entries
  const deduplicateExtraCharges = (rawCharges: ExtraCharge[] = []): ExtraCharge[] => {
    const seenIds = new Set<string>();
    const seenSources = new Set<string>();
    const result: ExtraCharge[] = [];
    for (const ec of rawCharges) {
      if (!ec || !(Number(ec.amount) > 0)) continue;
      const cid = String(ec.id || '').trim();
      const srcKey = ec.sourceType && ec.sourceId ? `${ec.sourceType}:${ec.sourceId}` : '';
      if (cid && seenIds.has(cid)) continue;
      if (srcKey && seenSources.has(srcKey)) continue;
      if (cid) seenIds.add(cid);
      if (srcKey) seenSources.add(srcKey);
      result.push(ec);
    }
    return result;
  };

  // billing totals computed live via single buildStayBill() / calculateBill() engine
  const calculateStayTotals = (cProfile: GuestCheckIn) => {
    const now = new Date();
    const todayStr =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0');
    const currentHour = now.getHours();

    let targetOutDate = cProfile.checkOutDate || todayStr;
    if (todayStr > targetOutDate) {
      targetOutDate = todayStr;
    }

    let nights = calcNightsCount(cProfile.checkInDate, targetOutDate);
    let isLateCheckout = false;
    if (todayStr >= targetOutDate && currentHour >= 12) {
      nights += 1;
      isLateCheckout = true;
    }
    if (isNaN(nights) || nights <= 0) {
      nights = 1;
    }

    const existingStayInv = invoices.find(
      inv =>
        isActiveInvoice(inv) &&
        !inv.isSeparateInvoice &&
        (inv.bookingId === cProfile.id || inv.checkInId === cProfile.id)
    );
    let activeRate = isGstBillingEnabled ? checkoutGstRate : 0;
    if (existingStayInv) {
      const lockedNoGst =
        existingStayInv.isWithoutGst === true ||
        (existingStayInv.gstRate !== undefined && Number(existingStayInv.gstRate) <= 0) ||
        (existingStayInv.gstRate === undefined && Number(existingStayInv.gst || 0) <= 0);
      activeRate = lockedNoGst
        ? 0
        : Math.max(0.01, Number(existingStayInv.gstRate) || billSettings.roomGstRate || 5);
    }

    const effectiveSettings: BillSettings = {
      ...billSettings,
      roomGstRate: activeRate > 0 ? activeRate : 0,
      foodGstRate: activeRate > 0 ? billSettings.foodGstRate || activeRate : 0,
    };

    const extras = deduplicateExtraCharges(cProfile.extraCharges || []);
    const posExtraTotal = extras
      .filter(e => e.sourceType === 'pos_order')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const laundryExtraTotal = extras
      .filter(e => e.sourceType === 'laundry_order')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const waterExtraTotal = extras
      .filter(e => e.sourceType === 'water_bottle')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pendingInlineExtra =
      cProfile.id === selectedCheckInId && Number(chargeAmount) > 0 ? Number(chargeAmount) : 0;
    const inlineAdditionalCharges: BillCharge[] =
      pendingInlineExtra > 0
        ? [
            {
              id: 'inline-pending-ec',
              kind:
                chargeCategory === 'Damage'
                  ? 'fine'
                  : chargeCategory === 'Food'
                  ? 'food'
                  : chargeCategory === 'Laundry'
                  ? 'laundry'
                  : chargeCategory === 'Late Checkout'
                  ? 'late_checkout'
                  : 'other',
              description: (chargeDescription || '').trim() || `${chargeCategory} Charge`,
              amount: pendingInlineExtra,
              roomNumber: cProfile.roomNumber,
            },
          ]
        : [];

    // Compute targetOutDate corresponding to nights so buildStayBill uses updated nights
    const syntheticOutDate = (() => {
      const d = new Date((cProfile.checkInDate || todayStr) + 'T00:00:00');
      if (isNaN(d.getTime())) return targetOutDate;
      d.setDate(d.getDate() + nights);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const stayBill = buildStayBill({
      checkin: {
        ...cProfile,
        checkOutDate: syntheticOutDate,
        nights,
        extraCharges: extras,
      },
      rooms,
      settings: effectiveSettings,
      additionalCharges: inlineAdditionalCharges,
      gstEnabledOverride: activeRate > 0,
      discountOverride: Math.max(0, Number(discount) || 0),
    });

    const b = stayBill.bill;
    const roomCharges = b.legacy.roomCharges;
    const extraBedTotal = b.legacy.extraBedCharges;
    const extraPersonTotal = b.legacy.extraPersonCharges;
    const extrasTotal = r2(
      b.legacy.earlyCheckInCharges +
        b.legacy.lateCheckOutCharges +
        b.legacy.foodCharges +
        b.legacy.waterCharges +
        b.legacy.laundryCharges +
        b.legacy.serviceCharges +
        b.legacy.otherCharges +
        b.legacy.fineCharges
    );

    return {
      nights,
      roomCharges,
      extraBedTotal,
      extraPersonTotal,
      extrasTotal,
      posExtraTotal,
      laundryExtraTotal,
      waterExtraTotal,
      subtotal: b.subtotal,
      gst: b.totalTax,
      grandTotal: b.grandTotal,
      totalPaid: b.receipts,
      dueAmount: r2(b.grandTotal - b.receipts),
      isLateCheckout,
    };
  };

  // Keep checkoutPayAmount fully synchronized with outstanding due amount automatically
  useEffect(() => {
    if (activeCheckin && !isAmountOverridden) {
      const totals = calculateStayTotals(activeCheckin);
      const realDue = totals.dueAmount > 0 ? totals.dueAmount : 0;
      const depositVal = activeCheckin.depositBalance ?? 0;
      const applied = Math.min(realDue, depositVal);
      const remaining = realDue - applied;
      setCheckoutPayAmount(parseFloat(remaining.toFixed(2)));
    } else if (!activeCheckin) {
      setCheckoutPayAmount(0);
    }
  }, [selectedCheckInId, discount, chargeAmount, checkoutGstRate, isGstBillingEnabled, activeCheckin?.extraCharges, isAmountOverridden, activeCheckin?.depositBalance]);

  // triggers a new inline ancillary charge
  const handleAddExtraAncillaryCharge = () => {
    if (!activeCheckin) {
      showToast('Please select an active checked-in guest first.', 'error');
      return;
    }
    const parsedAmount = Number(chargeAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      showToast('Please enter a Cost (₹) amount greater than 0.', 'warning');
      return;
    }

    const finalDesc = (chargeDescription || '').trim() || `${chargeCategory} Charge`;

    const newCharge: ExtraCharge = {
      id: `EC-${Date.now()}`,
      category: chargeCategory,
      description: finalDesc,
      amount: parsedAmount,
      dateTime: new Date().toISOString()
    };

    const updatedCheckins = checkins.map(c => {
      if (c.id === activeCheckin.id) {
        const existingCharges = c.extraCharges || [];
        return {
          ...c,
          extraCharges: [...existingCharges, newCharge]
        };
      }
      return c;
    });

    onUpdateCheckins(updatedCheckins);
    onAddAuditLog('Ancillary Charge Added', `Added ${chargeCategory} charge of ₹${parsedAmount} (${finalDesc}) to guest ${activeCheckin.guestName} (Room ${activeCheckin.roomNumber}).`);
    showToast(`Added ₹${parsedAmount.toLocaleString()} (${finalDesc}) to stay bill`, 'success');
    
    // Reset charge input form
    setChargeDescription('');
    setChargeAmount(0);
  };

  // deletes an inline ancillary charge
  const handleDeleteAncillaryCharge = (chargeId: string) => {
    if (!activeCheckin) return;

    const updatedCheckins = checkins.map(c => {
      if (c.id === activeCheckin.id) {
        const existingCharges = c.extraCharges || [];
        return {
          ...c,
          extraCharges: existingCharges.filter(ec => ec.id !== chargeId)
        };
      }
      return c;
    });

    onUpdateCheckins(updatedCheckins);
    onAddAuditLog('Ancillary Charge Deleted', `Removed charge from guest ${activeCheckin.guestName}.`);
  };

  // trigger selected guest form sync on change
  const handleCheckInSelected = (checkinId: string) => {
    setSelectedCheckInId(checkinId);
    const selected = checkins.find(c => c.id === checkinId);
    setIsAmountOverridden(false);
    if (selected) {
      const totals = calculateStayTotals(selected);
      setCheckoutPayAmount(totals.dueAmount > 0 ? totals.dueAmount : 0);
      setIsFullyPending(false);
      setDiscount(0);
      setCheckoutNotes('');
    }
  };

  // checkout submission
  const handleExecuteCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckin) {
      showToast('Selection Error: Please choose an active checked-in guest.', 'error');
      return;
    }
    if (activeCheckin.checkedOutDateTime) {
      showToast(`Already Checked Out: Guest ${activeCheckin.guestName} has already completed checkout.`, 'error');
      return;
    }
 
    const totals = calculateStayTotals(activeCheckin);
    const depositBalance = activeCheckin.depositBalance ?? 0;
    const appliedDeposit = Math.min(totals.dueAmount > 0 ? totals.dueAmount : 0, depositBalance);
    const remainingDue = (totals.dueAmount > 0 ? totals.dueAmount : 0) - appliedDeposit;
    const amountToRecord = checkoutPayAmount;

    // Custom settlement allowance: If user wants to check out with partial payment/outstanding dues
    if (remainingDue > 0.05 && amountToRecord < remainingDue) {
      const confirmPartial = window.confirm(
        `Outstanding Balance Notice:\n\nYou are checking out with ₹${amountToRecord.toLocaleString()} received, which is less than the outstanding balance of ₹${remainingDue.toLocaleString()} (after applying deposit of ₹${appliedDeposit.toLocaleString()}).\n\nRemaining ₹${(remainingDue - amountToRecord).toLocaleString()} will be recorded as pending credit/due in the guest ledger. Do you want to proceed and complete the checkout?`
      );
      if (!confirmPartial) {
        return;
      }
    }
    
    // 1. Save final checkout payment record (if payment recorded)
    let updatedPayments = [...(activeCheckin.payments || [])];
    let newDepositBalance = depositBalance;
    
    if (appliedDeposit > 0) {
      updatedPayments.push({
        id: `PAY-DEP-SETTLE-${Date.now()}`,
        amount: appliedDeposit,
        paymentMethod: 'UPI',
        paymentType: 'Settle Balance',
        dateTime: new Date().toISOString(),
        notes: `Dues settled using stored Guest Deposit Balance (₹${appliedDeposit.toLocaleString()} applied)`
      });
      newDepositBalance -= appliedDeposit;
    }

    let finalDue = remainingDue - amountToRecord;
  
    if (checkoutPayMethod === 'Hybrid' && getValidHybridSplits(checkoutHybridRows).length > 0) {
      const validSplits = getValidHybridSplits(checkoutHybridRows);
      const splitTotal = Math.round(validSplits.reduce((s, r) => s + r.amount, 0) * 100) / 100;
      finalDue = remainingDue - splitTotal;
      const baseTs = Date.now();
      validSplits.forEach((sp, idx) => {
        updatedPayments.push({
          id: `PAY-CO-${baseTs}-${idx}`,
          amount: sp.amount,
          paymentMethod: sp.method as any,
          paymentType: finalDue <= 0 ? 'Settle Balance' : 'Partial Payment',
          dateTime: new Date().toISOString(),
          notes: checkoutNotes ? `${checkoutNotes} (Hybrid ${sp.method})` : `Hybrid split (${sp.method})`
        });
      });
      if (finalDue < 0) {
        newDepositBalance += Math.abs(finalDue);
        finalDue = 0;
      }
    } else if (amountToRecord > 0) {
      const checkoutPayment: PaymentRecord = {
        id: `PAY-CO-${Date.now()}`,
        amount: amountToRecord,
        paymentMethod: checkoutPayMethod as any,
        paymentType: finalDue <= 0 ? 'Settle Balance' : 'Partial Payment',
        dateTime: new Date().toISOString(),
        notes: checkoutNotes || undefined
      };
      updatedPayments.push(checkoutPayment);
  
      if (finalDue < 0) {
        // user overpaid! Save as deposit balance
        newDepositBalance += Math.abs(finalDue);
        finalDue = 0;
      }
    }

    // Auto-include any pending un-added chargeAmount typed in the Cost (₹) box
    const rawExtraCharges: ExtraCharge[] = [...(activeCheckin.extraCharges || [])];
    if (Number(chargeAmount) > 0) {
      rawExtraCharges.push({
        id: `EC-${Date.now()}`,
        category: chargeCategory,
        description: (chargeDescription || '').trim() || `${chargeCategory} Charge`,
        amount: Number(chargeAmount),
        dateTime: new Date().toISOString(),
        sourceType: 'manual'
      });
    }
    const finalExtraCharges: ExtraCharge[] = deduplicateExtraCharges(rawExtraCharges);

    // 2. Mark Check-in as checked-out
    const checkOutTime = new Date().toISOString();
    const updatedCheckins = checkins.map(c => {
      if (c.id === activeCheckin.id) {
        return {
          ...c,
          extraCharges: finalExtraCharges,
          payments: updatedPayments,
          depositBalance: newDepositBalance,
          pendingAmount: finalDue > 0 ? finalDue : 0,
          checkedOutDateTime: checkOutTime,
          checkedOutBy: 'Desk Manager'
        };
      }
      return c;
    });

    // 3. Mark all rooms allocated to this stay as Dirty for housekeeping
    const stayRoomNumbers = Array.from(
      new Set([
        activeCheckin.roomNumber,
        ...(activeCheckin.bookedRooms || []).map(br => br.roomNumber)
      ].filter(Boolean))
    );
    const updatedRooms = rooms.map(r => {
      if (stayRoomNumbers.includes(r.number)) {
        return {
          ...r,
          status: 'Dirty' as const, // Room status changes to Dirty to await housekeeping inspection
          cleaningStatus: 'Dirty' as const
        };
      }
      return r;
    });

    // 4. Update booking record ONLY by booking ID (never mark unrelated future bookings in that room as CheckedOut)
    const updatedBookings = bookings.map(b => {
      if (
        b.id === activeCheckin.id ||
        ((activeCheckin as any).bookingId && b.id === (activeCheckin as any).bookingId)
      ) {
        return {
          ...b,
          isCheckedIn: false,
          status: 'CheckedOut' as any,
          isCompleted: true
        };
      }
      return b;
    });

    // 5. Generate or upgrade the single authoritative Tax Invoice via centralized 8-condition engine
    const activeConditions = normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
      ...hotelSettings,
      isGstEnabled: isGstBillingEnabled,
      defaultGstRate: isGstBillingEnabled ? checkoutGstRate : 0
    });

    const updatedCheckinObj = updatedCheckins.find(c => c.id === activeCheckin.id) || {
      ...activeCheckin,
      extraCharges: finalExtraCharges,
      payments: updatedPayments,
      checkedOutDateTime: checkOutTime
    };
    const updatedBookingObj =
      updatedBookings.find(
        b =>
          b.id === activeCheckin.id ||
          ((activeCheckin as any).bookingId && b.id === (activeCheckin as any).bookingId)
      ) || null;

    const evalResult = evaluateAndBuildInvoice({
      hotelId: activeCheckin.hotelId || hotelSettings?.id || (typeof window !== 'undefined' ? sessionStorage.getItem('pms_hotel_id') || undefined : undefined),
      hotelSettings,
      booking: updatedBookingObj,
      checkin: updatedCheckinObj,
      rooms: updatedRooms,
      existingInvoices: invoices,
      conditions: activeConditions,
      isManualAction: false,
      isCheckoutTrigger: true,
      overrideDiscount: discount,
      overrideGstRate: isGstBillingEnabled ? checkoutGstRate : 0,
      overridePaymentMethod:
        checkoutPayMethod === 'Hybrid' ? formatHybridLabel(checkoutHybridRows) : checkoutPayMethod,
      overrideNotes: checkoutNotes,
      invoiceType: 'Tax Invoice'
    });

    if (!evalResult.allowed && !evalResult.existingInvoice) {
      showToast(evalResult.blockingReasons[0] || 'Invoice conditions not met for checkout.', 'warning');
      return;
    }

    const finalInvoice: Invoice = evalResult.invoice || evalResult.existingInvoice!;
    const mergedInvoices = deduplicateInvoicesByBooking(
      invoices.some(
        inv =>
          inv.id === finalInvoice.id ||
          (!inv.isSeparateInvoice && inv.bookingId && inv.bookingId === finalInvoice.bookingId)
      )
        ? invoices.map(inv =>
            inv.id === finalInvoice.id ||
            (!inv.isSeparateInvoice && inv.bookingId && inv.bookingId === finalInvoice.bookingId)
              ? finalInvoice
              : inv
          )
        : [finalInvoice, ...invoices]
    );

    onUpdateCheckins(updatedCheckins);
    onUpdateRooms(updatedRooms);
    onUpdateBookings(updatedBookings);
    onUpdateInvoices(mergedInvoices);

    onAddAuditLog('Guest Checked Out', `Completed stay checkout for ${activeCheckin.guestName} (Room ${activeCheckin.roomNumber}). Invoice finalized: ${finalInvoice.invoiceNumber} (Invoice Status: ${finalInvoice.invoiceStatus || 'Finalized'}, Payment Status: ${finalInvoice.paymentStatus || (finalInvoice.isPaid ? 'Paid' : 'Unpaid')}).`);
    
    // Auto-select the finalized invoice for previewing/printing
    setSelectedInvoice(finalInvoice);
    setInvoiceCategoryFilter('All');
    setSearch('');
    setIsCheckoutFormOpen(false);

    // reset checkout state
    setSelectedCheckInId('');
    setDiscount(0);
    setChargeAmount(0);
    setChargeDescription('');
    setCheckoutPayAmount(0);
    setCheckoutNotes('');

    triggerToast(`Checkout finalized! Room ${activeCheckin.roomNumber} has been marked as Dirty for housekeeping.`);
  };

  const handleSettlePaidStatus = (id: string) => {
    const updated = invoices.map(inv => inv.id === id ? { ...inv, isPaid: true, pendingAmount: 0 } : inv);
    onUpdateInvoices(updated);
    if (selectedInvoice && selectedInvoice.id === id) {
      setSelectedInvoice({ ...selectedInvoice, isPaid: true, pendingAmount: 0 });
    }
    triggerToast('Invoice balance settled successfully.');
  };

  const [isSeparateInvoiceMode, setIsSeparateInvoiceMode] = useState<boolean>(false);
  const [separateParentInvoice, setSeparateParentInvoice] = useState<Invoice | null>(null);

  // Strict GST Immutability: Open Separate Invoice creation modal instead of editing GST on an existing invoice
  const handleOpenSeparateInvoiceModalFrom = (sourceInv: Invoice, preferOppositeGst: boolean = true) => {
    const sourceHasGst = Number(sourceInv.gst || 0) > 0 || (sourceInv.gstRate !== undefined && Number(sourceInv.gstRate) > 0 && !sourceInv.isWithoutGst);
    const nextRate = preferOppositeGst
      ? (sourceHasGst ? 0 : (configuredDefaultGst > 0 ? configuredDefaultGst : 5))
      : (sourceHasGst ? (Number(sourceInv.gstRate) || configuredDefaultGst || 5) : 0);
    setIsSeparateInvoiceMode(true);
    setSeparateParentInvoice(sourceInv);
    setSelectedBookingForNewInvId(sourceInv.bookingId || '');
    setNewInvGuestName(sourceInv.guestName || '');
    setNewInvMobile(sourceInv.guestMobile || '');
    setNewInvRoomNumber(sourceInv.roomNumber || '');
    setNewInvCheckInDate(sourceInv.checkInDate || new Date().toISOString().split('T')[0]);
    setNewInvCheckOutDate(sourceInv.checkOutDate || new Date().toISOString().split('T')[0]);
    const baseRoomCharges = Number(sourceInv.roomCharges || sourceInv.subtotal || 0);
    setNewInvRoomCharges(baseRoomCharges);
    setNewInvHasExtraBed(Number(sourceInv.extraBedCharges || 0) > 0);
    setNewInvExtraBedCount(Number(sourceInv.extraBedCount || 1));
    setNewInvExtraBedRate(Number(sourceInv.extraBedRate || 500));
    setNewInvExtraPersonCharges(Number(sourceInv.extraPersonCharges || 0));
    setNewInvDiscount(Number(sourceInv.discount || 0));
    setNewInvGstRate(nextRate);
    const existingPaid = Number(sourceInv.advancePaid ?? (sourceInv.isPaid ? sourceInv.finalAmount : 0));
    const estimatedNewTotal = nextRate > 0 ? existingPaid : baseRoomCharges;
    setNewInvAdvancePaid(nextRate === 0 && existingPaid > estimatedNewTotal ? estimatedNewTotal : existingPaid);
    setNewInvPaymentMethod((sourceInv.paymentMethod as any) || 'UPI');
    setNewInvType(nextRate > 0 ? 'Tax Invoice' : 'Booking Invoice');
    setNewInvNotes(`Reconciled ${nextRate > 0 ? `With GST (${nextRate}%)` : 'No GST'} invoice replacing ${sourceInv.invoiceNumber}`);
    setIsBookingInvoiceModalOpen(true);
  };

  const triggerToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification('');
    }, 4000);
  };

  // Edit Existing Invoice Modal State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvGuestName, setEditInvGuestName] = useState('');
  const [editInvMobile, setEditInvMobile] = useState('');
  const [editInvRoomNumber, setEditInvRoomNumber] = useState('');
  const [editInvCheckInDate, setEditInvCheckInDate] = useState('');
  const [editInvCheckOutDate, setEditInvCheckOutDate] = useState('');
  const [editInvRoomCharges, setEditInvRoomCharges] = useState<number>(0);
  const [editInvExtraBedCharges, setEditInvExtraBedCharges] = useState<number>(0);
  const [editInvExtraPersonCharges, setEditInvExtraPersonCharges] = useState<number>(0);
  const [editInvFoodCharges, setEditInvFoodCharges] = useState<number>(0);
  const [editInvServiceCharges, setEditInvServiceCharges] = useState<number>(0);
  const [editInvDiscount, setEditInvDiscount] = useState<number>(0);
  const [editInvGstRate, setEditInvGstRate] = useState<number>(configuredDefaultGst);
  const [editInvAdvancePaid, setEditInvAdvancePaid] = useState<number>(0);
  const [editInvPaymentMethod, setEditInvPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Online'>('UPI');
  const [editInvIsPaid, setEditInvIsPaid] = useState<boolean>(false);
  const [editInvNotes, setEditInvNotes] = useState('');
  const [editInvPaymentRows, setEditInvPaymentRows] = useState<
    Array<{ id: string; date: string; paymentMethod: string; amount: number | ''; referenceNo?: string; notes?: string }>
  >([]);

  // Quick Date-wise & Mode-wise Payment Entry state on Selected Invoice panel (Point 4)
  const [quickPayDate, setQuickPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quickPayMode, setQuickPayMode] = useState<string>('Cash');
  const [quickPayCustomMode, setQuickPayCustomMode] = useState<string>('');
  const [quickPayAmount, setQuickPayAmount] = useState<number | ''>('');
  const [quickPayRef, setQuickPayRef] = useState<string>('');

  const deriveInitialPaymentRows = (inv: Invoice) => {
    if (Array.isArray(inv.paymentHistory) && inv.paymentHistory.length > 0) {
      return inv.paymentHistory.map((ph, idx) => ({
        id: String(ph.id || `ph-${idx}-${Date.now()}`),
        date: String(ph.date || inv.dateCreated || new Date().toISOString().slice(0, 10)).slice(0, 10),
        paymentMethod: String(ph.paymentMethod || 'Cash'),
        amount: Number(ph.amount || 0),
        referenceNo: ph.referenceNo || '',
        notes: ph.notes || '',
      }));
    }
    const matchedC = checkins.find(c => c.id === inv.bookingId || c.id === inv.checkInId);
    if (matchedC && Array.isArray(matchedC.payments) && matchedC.payments.length > 0) {
      return matchedC.payments
        .filter(cp => Number(cp.amount || 0) > 0)
        .map((cp, idx) => ({
          id: String(cp.id || `cp-${idx}-${Date.now()}`),
          date: String(cp.date || cp.dateTime || inv.dateCreated || new Date().toISOString().slice(0, 10)).slice(0, 10),
          paymentMethod: String(cp.paymentMethod || 'Cash'),
          amount: Number(cp.amount || 0),
          referenceNo: cp.referenceNo || '',
          notes: cp.notes || cp.paymentType || '',
        }));
    }
    const fallbackPaid = Number(inv.paidAmount ?? inv.advancePaid ?? (inv.isPaid ? inv.finalAmount : 0));
    if (fallbackPaid > 0) {
      return [
        {
          id: `pay-${inv.id}-0`,
          date: String(inv.dateCreated || inv.checkInDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
          paymentMethod: String(inv.paymentMethod || 'Cash'),
          amount: fallbackPaid,
          referenceNo: '',
          notes: 'Payment Received',
        },
      ];
    }
    return [];
  };

  // Persist updated Date-wise & Mode-wise payment rows onto an existing Invoice + linked GuestCheckIn
  const applyUpdatedPaymentsToInvoice = (
    targetInv: Invoice,
    rows: Array<{ id: string; date: string; paymentMethod: string; amount: number; referenceNo?: string; notes?: string }>
  ) => {
    const validRows = rows
      .filter(r => Number(r.amount || 0) !== 0)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const totalPaid = r2(validRows.reduce((s, r) => s + Number(r.amount || 0), 0));
    const grand = r2(Number(targetInv.finalAmount ?? targetInv.totalAmount ?? 0));
    const pending = Math.max(0, r2(grand - totalPaid));
    const refund = Math.max(0, r2(totalPaid - grand));
    const isPaidNow = grand <= 0 || pending <= 0;
    const payStatus: Invoice['paymentStatus'] = isPaidNow ? 'Paid' : totalPaid > 0 ? 'Partially Paid' : 'Unpaid';
    const modeSummary =
      validRows.length > 0
        ? Array.from(new Set(validRows.map(r => r.paymentMethod))).join(' + ')
        : targetInv.paymentMethod || 'Cash';

    const roomDefault = String(targetInv.roomNumber || '');
    const nonReceiptLines = Array.isArray(targetInv.ledgerLines)
      ? targetInv.ledgerLines.filter(l => l.type !== 'receipt')
      : [];
    const receiptLines = validRows.map(r => {
      const meta = [r.referenceNo ? `Ref: ${r.referenceNo}` : '', r.notes || ''].filter(Boolean).join(' • ');
      return {
        type: 'receipt',
        dateLabel: formatDateLabel(r.date),
        roomNumber: roomDefault,
        description: `Receipt — ${r.paymentMethod}${meta ? `\n${meta}` : ''}`,
        sac: '',
        charges: 0,
        receipts: r2(r.amount),
        sourceId: r.id,
      };
    });

    const nextInv: Invoice = {
      ...targetInv,
      paymentHistory: validRows.map(r => ({
        id: r.id,
        amount: r2(r.amount),
        paymentMethod: r.paymentMethod,
        date: r.date,
        referenceNo: r.referenceNo || undefined,
        notes: r.notes || undefined,
      })),
      ledgerLines: nonReceiptLines.length > 0 ? [...nonReceiptLines, ...receiptLines] : targetInv.ledgerLines,
      advancePaid: totalPaid,
      paidAmount: totalPaid,
      amountPaid: totalPaid,
      pendingAmount: pending,
      refundDue: refund,
      isPaid: isPaidNow,
      paymentStatus: payStatus,
      paymentMethod: modeSummary,
    };

    onUpdateInvoices(invoices.map(i => (i.id === nextInv.id ? nextInv : i)));
    if (selectedInvoice?.id === nextInv.id) setSelectedInvoice(nextInv);

    if (targetInv.bookingId && checkins.some(c => c.id === targetInv.bookingId)) {
      const mappedCheckinPayments: PaymentRecord[] = validRows.map(r => ({
        id: r.id,
        amount: r2(r.amount),
        paymentMethod: r.paymentMethod,
        paymentType: 'Partial Payment',
        dateTime: `${r.date}T12:00:00.000Z`,
        date: r.date,
        referenceNo: r.referenceNo || undefined,
        notes: r.notes || `Bill Receipt (${r.paymentMethod})`,
      }));
      const cashSum = r2(
        validRows.filter(r => r.paymentMethod.toLowerCase() === 'cash').reduce((s, r) => s + r.amount, 0)
      );
      const onlineSum = r2(Math.max(0, totalPaid - cashSum));
      onUpdateCheckins(
        checkins.map(c =>
          c.id === targetInv.bookingId
            ? {
                ...c,
                payments: mappedCheckinPayments,
                advanceAmount: 0,
                cashAmountPaid: cashSum,
                onlineAmountPaid: onlineSum,
                pendingAmount: pending,
                paymentMethod: modeSummary,
              }
            : c
        )
      );
    }
  };

  const handleOpenEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditInvGuestName(inv.guestName || '');
    setEditInvMobile(inv.guestMobile || '');
    setEditInvRoomNumber(inv.roomNumber || '');
    setEditInvCheckInDate(inv.checkInDate || '');
    setEditInvCheckOutDate(inv.checkOutDate || '');
    setEditInvRoomCharges(Number(inv.roomCharges || 0));
    setEditInvExtraBedCharges(Number(inv.extraBedCharges || 0));
    setEditInvExtraPersonCharges(Number(inv.extraPersonCharges || 0));
    setEditInvFoodCharges(Number(inv.foodCharges || 0));
    setEditInvServiceCharges(Number(inv.waterCharges || 0) + Number(inv.otherCharges || 0));
    setEditInvDiscount(Number(inv.discount || 0));
    setEditInvGstRate(inv.gstRate ?? (inv.gst > 0 ? configuredDefaultGst : 0));
    setEditInvAdvancePaid(Number(inv.advancePaid ?? (inv.isPaid ? inv.finalAmount : 0)));
    setEditInvPaymentMethod((inv.paymentMethod as any) || 'UPI');
    setEditInvIsPaid(Boolean(inv.isPaid));
    setEditInvNotes(inv.notes || '');
    setEditInvPaymentRows(deriveInitialPaymentRows(inv));
  };

  const handleSaveEditedInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    if (!editInvGuestName.trim()) {
      showToast('Guest Name is required.', 'warning');
      return;
    }
    const rCharges = Math.max(0, Number(editInvRoomCharges) || 0);
    const ebCharges = Math.max(0, Number(editInvExtraBedCharges) || 0);
    const epCharges = Math.max(0, Number(editInvExtraPersonCharges) || 0);
    const fCharges = Math.max(0, Number(editInvFoodCharges) || 0);
    const sCharges = Math.max(0, Number(editInvServiceCharges) || 0);
    const disc = Math.max(0, Number(editInvDiscount) || 0);
    const lockedWithoutGst =
      editingInvoice.isWithoutGst === true ||
      (editingInvoice.gstRate !== undefined && Number(editingInvoice.gstRate) <= 0) ||
      (editingInvoice.gstRate === undefined && Number(editingInvoice.gst || 0) <= 0);
    // STRICT IMMUTABILITY: Preserve original GST / No-GST mode & rate on edited invoices
    const cleanGstRate = lockedWithoutGst
      ? 0
      : Math.max(0.01, Math.min(100, Number(editingInvoice.gstRate) || configuredDefaultGst || 5));

    const stayNightsEdit = calcNightsCount(editInvCheckInDate, editInvCheckOutDate) || 1;
    const editRoomNo = editInvRoomNumber.trim() || 'N/A';
    const editCharges: BillCharge[] = [];
    if (rCharges > 0) {
      editCharges.push({
        id: 'edit-room',
        kind: 'room',
        description: 'Room Charges',
        amount: rCharges,
        nights: stayNightsEdit,
        rate: r2(rCharges / stayNightsEdit),
        roomNumber: editRoomNo,
      });
    }
    if (ebCharges > 0) {
      editCharges.push({
        id: 'edit-xbed',
        kind: 'extra_bed',
        description: 'Extra Bed Charges',
        amount: ebCharges,
        roomNumber: editRoomNo,
      });
    }
    if (epCharges > 0) {
      editCharges.push({
        id: 'edit-xpax',
        kind: 'extra_person',
        description: 'Extra Person Charges',
        amount: epCharges,
        roomNumber: editRoomNo,
      });
    }
    if (fCharges > 0) {
      editCharges.push({
        id: 'edit-food',
        kind: 'food',
        description: 'Food & Restaurant Charges',
        amount: fCharges,
        roomNumber: editRoomNo,
      });
    }
    if (sCharges > 0) {
      editCharges.push({
        id: 'edit-svc',
        kind: 'other',
        description: 'Water / Services / Other Charges',
        amount: sCharges,
        roomNumber: editRoomNo,
      });
    }

    const preBill = calculateBill({
      charges: editCharges,
      payments: [],
      discount: disc,
      gstEnabled: !lockedWithoutGst && cleanGstRate > 0,
      settings: {
        ...billSettings,
        roomGstRate: lockedWithoutGst ? 0 : cleanGstRate,
        foodGstRate: lockedWithoutGst ? 0 : billSettings.foodGstRate || cleanGstRate,
        roomRateIncludesGst: false,
      },
    });

    const finalAmt = preBill.grandTotal;
    const validDatedRows = editInvPaymentRows
      .filter(r => Number(r.amount || 0) > 0)
      .map(r => ({
        id: r.id,
        amount: r2(Number(r.amount || 0)),
        method: r.paymentMethod || 'Cash',
        date: r.date || editingInvoice.dateCreated,
        reference: r.referenceNo || undefined,
        note: r.notes || undefined,
      }));
    const rowsSum = r2(validDatedRows.reduce((s, r) => s + r.amount, 0));
    let billPaymentsPayload: BillPayment[] = validDatedRows;
    if (editInvIsPaid && rowsSum < finalAmt) {
      const rem = r2(finalAmt - rowsSum);
      if (rem > 0) {
        billPaymentsPayload = [
          ...validDatedRows,
          {
            id: `pay-settle-${Date.now()}`,
            amount: rem,
            method: editInvPaymentMethod || 'Cash',
            date: new Date().toISOString().slice(0, 10),
            note: 'Balance Settlement',
          },
        ];
      }
    } else if (billPaymentsPayload.length === 0 && Number(editInvAdvancePaid) > 0) {
      billPaymentsPayload = [
        {
          id: 'edit-paid',
          amount: Math.max(0, Number(editInvAdvancePaid) || 0),
          method: editInvPaymentMethod,
          date: editingInvoice.dateCreated,
        },
      ];
    }
    const advPaid = r2(billPaymentsPayload.reduce((s, r) => s + r.amount, 0));
    const resolvedMethodSummary =
      billPaymentsPayload.length > 0
        ? Array.from(new Set(billPaymentsPayload.map(p => p.method))).join(' + ')
        : editInvPaymentMethod;
    const editedBill = calculateBill({
      charges: editCharges,
      payments: billPaymentsPayload,
      discount: disc,
      gstEnabled: !lockedWithoutGst && cleanGstRate > 0,
      settings: {
        ...billSettings,
        roomGstRate: lockedWithoutGst ? 0 : cleanGstRate,
        foodGstRate: lockedWithoutGst ? 0 : billSettings.foodGstRate || cleanGstRate,
        roomRateIncludesGst: false,
      },
    });
    const pendingAmt = editedBill.balance;

    const updatedRecord = buildInvoiceRecord({
      id: editingInvoice.id,
      invoiceNumber: editingInvoice.invoiceNumber,
      hotelId: editingInvoice.hotelId || hotelSettings?.id,
      bookingId: editingInvoice.bookingId,
      checkInId: editingInvoice.checkInId,
      guestName: editInvGuestName.trim(),
      guestMobile: editInvMobile.trim(),
      guestAddress: editingInvoice.guestAddress,
      companyName: editingInvoice.companyName,
      guestGstNumber: editingInvoice.guestGstNumber || editingInvoice.gstNumber,
      roomNumbers: editRoomNo.split(',').map(s => s.trim()).filter(Boolean),
      checkInDate: editInvCheckInDate,
      checkOutDate: editInvCheckOutDate,
      nights: stayNightsEdit,
      bill: editedBill,
      paymentMethod: resolvedMethodSummary,
      isSeparateInvoice: editingInvoice.isSeparateInvoice,
      parentInvoiceId: editingInvoice.parentInvoiceId,
      dateCreated: editingInvoice.dateCreated,
      invoiceStatus: editingInvoice.invoiceStatus || 'Finalized',
      extra: {
        invoiceType: editingInvoice.invoiceType,
        notes: editInvNotes.trim(),
      },
    });

    const updatedInv: Invoice = {
      ...editingInvoice,
      ...(updatedRecord as Invoice),
    };

    const nextList = invoices.map(i => (i.id === editingInvoice.id ? updatedInv : i));
    onUpdateInvoices(nextList);
    setSelectedInvoice(updatedInv);

    if (editingInvoice.bookingId) {
      const stayNights = calcNightsCount(editInvCheckInDate, editInvCheckOutDate) || 1;
      const perNightRate = Math.round(rCharges / stayNights);
      if (checkins.some(c => c.id === editingInvoice.bookingId)) {
        onUpdateCheckins(
          checkins.map(c =>
            c.id === editingInvoice.bookingId
              ? {
                  ...c,
                  guestName: updatedInv.guestName,
                  mobile: updatedInv.guestMobile || c.mobile,
                  roomNumber: updatedInv.roomNumber,
                  checkInDate: updatedInv.checkInDate,
                  checkOutDate: updatedInv.checkOutDate,
                  roomRate: perNightRate > 0 ? perNightRate : c.roomRate,
                  discount: disc,
                  gstRate: cleanGstRate,
                  totalAmount: finalAmt,
                  finalAmount: finalAmt,
                  advanceAmount: advPaid,
                  pendingAmount: pendingAmt
                }
              : c
          )
        );
      }
      if (bookings.some(b => b.id === editingInvoice.bookingId)) {
        onUpdateBookings(
          bookings.map(b =>
            b.id === editingInvoice.bookingId
              ? {
                  ...b,
                  guestName: updatedInv.guestName,
                  mobile: updatedInv.guestMobile || b.mobile,
                  roomNumber: updatedInv.roomNumber,
                  checkInDate: updatedInv.checkInDate,
                  checkOutDate: updatedInv.checkOutDate,
                  nights: stayNights,
                  bookingAmount: rCharges,
                  advanceAmount: advPaid,
                  gstRate: cleanGstRate
                }
              : b
          )
        );
      }
    }

    onAddAuditLog(
      'Invoice Edited',
      `Edited Invoice ${updatedInv.invoiceNumber} (${updatedInv.guestName}, Room ${updatedInv.roomNumber}). Total: ₹${updatedInv.finalAmount}`
    );
    showToast(`Invoice ${updatedInv.invoiceNumber} updated! New Total: ₹${Number(updatedInv.finalAmount || 0).toLocaleString()}`, 'success');
    triggerToast(`Invoice ${updatedInv.invoiceNumber} updated! New Total: ₹${Number(updatedInv.finalAmount || 0).toLocaleString()}`);
    setEditingInvoice(null);
  };

  const handleSelectBookingForInvoice = (bookingId: string) => {
    setSelectedBookingForNewInvId(bookingId);
    const ck = checkins.find(c => c.id === bookingId);
    if (ck) {
      setNewInvGuestName(ck.guestName);
      setNewInvMobile(ck.mobile);
      setNewInvRoomNumber(ck.roomNumber);
      setNewInvCheckInDate(ck.checkInDate);
      setNewInvCheckOutDate(ck.checkOutDate);
      const nights = calcNightsCount(ck.checkInDate, ck.checkOutDate) || 1;
      const rate = ck.roomRate || rooms.find(r => r.number === ck.roomNumber)?.rate || 2000;
      setNewInvRoomCharges(rate * nights);
      setNewInvHasExtraBed(Boolean(ck.hasExtraBed));
      setNewInvExtraBedCount(ck.extraBedCount || 1);
      setNewInvExtraBedRate(ck.extraBedRate || 500);
      setNewInvExtraPersonCharges(ck.isGroupCheckIn ? 0 : Number(ck.extraPersonChargeApplied || 0));
      const totalPrepaid = (ck.advanceAmount || 0) + (ck.cashAmountPaid || 0) + (ck.onlineAmountPaid || 0);
      setNewInvAdvancePaid(totalPrepaid);
      setNewInvPaymentMethod((ck.paymentMethod as any) || 'UPI');
      setNewInvDiscount(ck.discount || 0);
      if (ck.isWithoutGst === true || (ck.gstRate !== undefined && Number(ck.gstRate) <= 0)) {
        setNewInvGstRate(0);
      } else if (ck.gstRate !== undefined) {
        setNewInvGstRate(Number(ck.gstRate));
      }
      setNewInvNotes(`Official invoice for Stay #${ck.id} (Room ${ck.roomNumber})`);
      return;
    }
    const bk = bookings.find(b => b.id === bookingId);
    if (bk) {
      setNewInvGuestName(bk.guestName);
      setNewInvMobile(bk.mobile);
      setNewInvRoomNumber(bk.roomNumber);
      setNewInvCheckInDate(bk.checkInDate);
      setNewInvCheckOutDate(bk.checkOutDate);
      const nights = bk.nights || calcNightsCount(bk.checkInDate, bk.checkOutDate) || 1;
      const rate = rooms.find(r => r.category === bk.roomType || r.number === bk.roomNumber)?.rate || 2000;
      setNewInvRoomCharges(bk.bookingAmount || (rate * nights));
      setNewInvHasExtraBed(Boolean(bk.hasExtraBed));
      setNewInvExtraBedCount(bk.extraBedCount || 1);
      setNewInvExtraBedRate(bk.extraBedRate || 500);
      setNewInvExtraPersonCharges(0);
      setNewInvAdvancePaid(bk.advanceAmount || 0);
      setNewInvPaymentMethod(bk.paymentMethod as any || 'UPI');
      setNewInvDiscount(0);
      if (bk.isWithoutGst === true || (bk.gstRate !== undefined && Number(bk.gstRate) <= 0)) {
        setNewInvGstRate(0);
      } else if (bk.gstRate !== undefined) {
        setNewInvGstRate(Number(bk.gstRate));
      }
      setNewInvNotes(`Official invoice for Booking #${bk.id}`);
    }
  };

  const handleCreateBookingInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvGuestName) {
      showToast('Please specify a valid guest name.', 'warning');
      return;
    }

    const nights = calcNightsCount(newInvCheckInDate, newInvCheckOutDate) || 1;
    const extraBedTotal = newInvHasExtraBed ? (newInvExtraBedCount * newInvExtraBedRate * nights) : 0;
    const targetBookingId = selectedBookingForNewInvId || `BKG-DIR-${Date.now()}`;
    const matchedBooking = bookings.find(b => b.id === targetBookingId) || null;
    const matchedCheckin = checkins.find(c => c.id === targetBookingId) || null;

    const existingInvForTarget = selectedBookingForNewInvId
      ? invoices.find(
          i =>
            !i.isSeparateInvoice &&
            (i.bookingId === selectedBookingForNewInvId || i.checkInId === selectedBookingForNewInvId)
        )
      : undefined;
    const shouldMintSeparateInvoice = Boolean(isSeparateInvoiceMode || existingInvForTarget);

    const activeConditions = normalizeInvoiceConditions(hotelSettings?.invoiceConditions, {
      ...hotelSettings,
      isGstEnabled: newInvGstRate > 0,
      defaultGstRate: newInvGstRate
    });

    const evalResult = evaluateAndBuildInvoice({
      hotelId: hotelSettings?.id || matchedCheckin?.hotelId || matchedBooking?.hotelId || (typeof window !== 'undefined' ? sessionStorage.getItem('pms_hotel_id') || undefined : undefined),
      hotelSettings,
      booking: matchedBooking || ({
        id: targetBookingId,
        guestName: newInvGuestName,
        mobile: newInvMobile,
        email: '',
        aadhaarNumber: '',
        address: '',
        adults: 2,
        children: 0,
        bookingSource: 'Direct',
        roomType: 'Deluxe',
        roomNumber: newInvRoomNumber || 'N/A',
        checkInDate: newInvCheckInDate || new Date().toISOString().split('T')[0],
        checkOutDate: newInvCheckOutDate || new Date().toISOString().split('T')[0],
        nights,
        bookingAmount: newInvRoomCharges,
        advanceAmount: newInvAdvancePaid,
        paymentMethod:
          newInvPaymentMethod === 'Hybrid' ? (formatHybridLabel(newInvHybridRows) as any) : newInvPaymentMethod,
        status: matchedCheckin ? (matchedCheckin.checkedOutDateTime ? 'CheckedOut' : 'Checked In') : 'Confirmed',
        isCheckedIn: Boolean(matchedCheckin)
      } as Booking),
      checkin: matchedCheckin,
      rooms,
      existingInvoices: invoices,
      conditions: activeConditions,
      isManualAction: true,
      isCheckoutTrigger: newInvType === 'Tax Invoice' && Boolean(matchedCheckin?.checkedOutDateTime),
      overrideGuestName: newInvGuestName,
      overrideMobile: newInvMobile,
      overrideRoomNumber: newInvRoomNumber || 'N/A',
      overrideCheckInDate: newInvCheckInDate,
      overrideCheckOutDate: newInvCheckOutDate,
      overrideRoomCharges: newInvRoomCharges,
      overrideExtraBedCharges: extraBedTotal,
      overrideExtraPersonCharges: Math.max(0, Number(newInvExtraPersonCharges) || 0),
      overrideDiscount: newInvDiscount,
      overrideGstRate: newInvGstRate,
      overrideAdvancePaid: newInvAdvancePaid,
      overridePaymentMethod:
        newInvPaymentMethod === 'Hybrid' ? formatHybridLabel(newInvHybridRows) : newInvPaymentMethod,
      overrideNotes: newInvNotes,
      invoiceType: newInvGstRate <= 0 && newInvType === 'Tax Invoice' ? 'Bill of Supply' : newInvType,
      createSeparateInvoice: shouldMintSeparateInvoice,
      parentInvoiceId: shouldMintSeparateInvoice ? (separateParentInvoice?.id || existingInvForTarget?.id) : undefined,
    });

    if (!shouldMintSeparateInvoice && evalResult.duplicatePrevented && evalResult.existingInvoice) {
      setSelectedInvoice(evalResult.existingInvoice);
      setIsBookingInvoiceModalOpen(false);
      showToast(
        `Final Invoice ${evalResult.existingInvoice.invoiceNumber} already exists for this stay. Displaying existing invoice.`,
        'info'
      );
      return;
    }

    if (!evalResult.allowed || !evalResult.invoice) {
      showToast(
        evalResult.blockingReasons[0] || 'Invoice conditions were not satisfied.',
        'warning'
      );
      return;
    }

    const newInvoice = evalResult.invoice;
    let baseInvoices = [...invoices];
    if (shouldMintSeparateInvoice && separateParentInvoice) {
      baseInvoices = baseInvoices.map(inv =>
        inv.id === separateParentInvoice.id
          ? {
              ...inv,
              isSuperseded: true,
              invoiceStatus: 'Superseded' as const,
              supersededByInvoiceId: newInvoice.id,
              supersededByInvoiceNumber: newInvoice.invoiceNumber,
              supersededAt: new Date().toISOString(),
            }
          : inv
      );
      // Cap advance payment to new finalAmount so no phantom refund is created unless genuinely confirmed
      if (Number(newInvoice.advancePaid || 0) > Number(newInvoice.finalAmount || 0)) {
        newInvoice.advancePaid = newInvoice.finalAmount;
        newInvoice.isPaid = true;
        (newInvoice as any).pendingAmount = 0;
        (newInvoice as any).refundDue = 0;
        (newInvoice as any).refundAmount = 0;
      }
    }

    const nextInvoices = shouldMintSeparateInvoice
      ? deduplicateInvoicesByBooking([newInvoice, ...baseInvoices])
      : deduplicateInvoicesByBooking(
          baseInvoices.some(
            inv =>
              inv.id === newInvoice.id ||
              (!inv.isSeparateInvoice && !inv.isSuperseded && inv.invoiceStatus !== 'Superseded' && inv.bookingId && inv.bookingId === newInvoice.bookingId)
          )
            ? baseInvoices.map(inv =>
                inv.id === newInvoice.id ||
                (!inv.isSeparateInvoice && !inv.isSuperseded && inv.invoiceStatus !== 'Superseded' && inv.bookingId && inv.bookingId === newInvoice.bookingId)
                  ? newInvoice
                  : inv
              )
            : [...baseInvoices, newInvoice]
        );

    onUpdateInvoices(nextInvoices);
    onAddAuditLog(
      shouldMintSeparateInvoice ? (separateParentInvoice ? 'Invoice Superseded & Re-Issued' : 'Separate Invoice Generated') : 'Invoice Generated',
      `Generated ${shouldMintSeparateInvoice ? 'SEPARATE ' : ''}${newInvoice.invoiceType || newInvType} (${newInvoice.invoiceNumber}, ${newInvGstRate > 0 ? `With GST ${newInvGstRate}%` : 'No GST'}) for ${newInvGuestName} (Room ${newInvRoomNumber}). Amount: ₹${newInvoice.finalAmount}${separateParentInvoice ? `. Superseded previous invoice ${separateParentInvoice.invoiceNumber}.` : ''}`
    );
    setSelectedInvoice(newInvoice);
    setIsBookingInvoiceModalOpen(false);
    setIsSeparateInvoiceMode(false);
    setSeparateParentInvoice(null);
    triggerToast(
      shouldMintSeparateInvoice
        ? (separateParentInvoice
            ? `New Invoice ${newInvoice.invoiceNumber} (${newInvGstRate > 0 ? 'With GST' : 'No GST'}) generated! Previous invoice ${separateParentInvoice.invoiceNumber} marked as superseded.`
            : `Separate Invoice ${newInvoice.invoiceNumber} (${newInvGstRate > 0 ? 'With GST' : 'No GST'}) generated without modifying existing invoice!`)
        : `Official Invoice ${newInvoice.invoiceNumber} generated successfully for ${newInvGuestName}!`
    );
  };

  // Filter list (Search + Category + Date-Wise Filter)
  const filteredInvoices = invoices.filter(inv => {
    const q = (search || '').toLowerCase();
    const matchesSearch =
      String(inv.guestName || '').toLowerCase().includes(q) ||
      String(inv.roomNumber || '').toLowerCase().includes(q) ||
      String(inv.invoiceNumber || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (dateFilterType !== 'All') {
      const nowD = new Date();
      const todayIso = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
      const yD = new Date(nowD);
      yD.setDate(yD.getDate() - 1);
      const yesterdayIso = `${yD.getFullYear()}-${String(yD.getMonth() + 1).padStart(2, '0')}-${String(yD.getDate()).padStart(2, '0')}`;
      const thisMonthPrefix = todayIso.slice(0, 7);
      const invDate = String(
        inv.dateCreated || (inv as any).date || inv.checkOutDate || inv.checkInDate || ''
      ).slice(0, 10);
      if (dateFilterType === 'Today' && invDate !== todayIso) return false;
      if (dateFilterType === 'Yesterday' && invDate !== yesterdayIso) return false;
      if (dateFilterType === 'This Month' && !invDate.startsWith(thisMonthPrefix)) return false;
      if (
        dateFilterType === 'Range' &&
        ((filterStartDate && invDate < filterStartDate) ||
          (filterEndDate && invDate > filterEndDate))
      ) {
        return false;
      }
    }

    const isCn = Boolean(
      (inv as any).isCreditNote ||
        inv.invoiceType === 'Credit Note' ||
        String(inv.invoiceNumber || '').toUpperCase().startsWith('CN/')
    );
    if (invoiceCategoryFilter === 'Booking') {
      return !isCn && inv.invoiceType === 'Booking Invoice' && !inv.isSuperseded && inv.invoiceStatus !== 'Superseded';
    }
    if (invoiceCategoryFilter === 'Checkout') {
      return !isCn && inv.invoiceType !== 'Booking Invoice' && !inv.isSuperseded && inv.invoiceStatus !== 'Superseded';
    }
    if (invoiceCategoryFilter === 'Due') {
      return !isCn && !inv.isPaid && !inv.isSuperseded && inv.invoiceStatus !== 'Superseded';
    }
    if (invoiceCategoryFilter === 'Superseded') {
      return isCn || Boolean(inv.isSuperseded) || inv.invoiceStatus === 'Superseded';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* PRINTABLE COMPLIANT INVOICE */}
      {selectedInvoice && (
        <div id="hotel-invoice-printable-tag" className="print-only hidden p-6 bg-white text-[#263449] shrink-0 font-sans border border-[#DCE3EC] rounded-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#C49A3A] via-[#E0BD6B] to-[#C49A3A] mb-5" />
          <div className="flex justify-between items-start border-b-2 border-[#C49A3A]/40 pb-5 mb-5">
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
                <h1 className="text-2xl font-sans text-black font-extrabold tracking-tight">
                  {hotelSettings?.name || 'Hotel Grant Heights'}
                </h1>
                {hotelSettings?.address && String(hotelSettings.address).trim() !== '0' && (
                  <p className="text-xs text-[#222] mt-0.5">{hotelSettings.address}</p>
                )}
                <p className="text-[11px] text-[#222] font-mono mt-0.5">
                  Phone: {hotelSettings?.phoneNumber || 'N/A'} {hotelSettings?.emailAddress ? `| Email: ${hotelSettings.emailAddress}` : ''}
                  {(selectedInvoice.gst || 0) > 0 && hotelSettings?.gstNumber ? ` | GSTIN: ${hotelSettings.gstNumber}` : ''}
                </p>
              </div>
            </div>
            {(() => {
              const selTotals = resolveConsistentInvoiceTotals(selectedInvoice, configuredDefaultGst);
              return (
                <div className="text-right">
                  <p className={`text-sm font-extrabold uppercase tracking-wider mb-1 ${selTotals.isCreditNote || selTotals.isSuperseded ? 'text-rose-700' : 'text-black'}`}>
                    {selTotals.isCreditNote ? 'CREDIT NOTE / CHECKOUT REVERSAL' : 'BOOKING CONFIRMATION & INVOICE'}
                  </p>
                  <p className="text-xs text-[#222] font-semibold">
                    Conf #: <span className="font-mono">{selectedInvoice.grcNumber || selectedInvoice.bookingId || selectedInvoice.invoiceNumber}</span> | Date: {selectedInvoice.dateCreated}
                  </p>
                  <p className={`text-xs font-bold mt-0.5 ${selTotals.isCreditNote || selTotals.isSuperseded ? 'text-rose-700' : 'text-black'}`}>
                    Status:{' '}
                    <span className="uppercase">
                      {selTotals.isCreditNote
                        ? 'CREDIT NOTE — REVERSAL ISSUED'
                        : selTotals.isSuperseded
                        ? `SUPERSEDED (REVERSED${(selectedInvoice as any).supersededByInvoiceNumber ? ` BY ${(selectedInvoice as any).supersededByInvoiceNumber}` : ''})`
                        : selTotals.balance <= 0 && selTotals.grandTotal > 0
                        ? 'CONFIRMED (PAID)'
                        : 'CONFIRMED'}
                    </span>
                  </p>
                </div>
              );
            })()}
          </div>
          <div className="border-b-2 border-black my-3"></div>
          {(selectedInvoice.isSuperseded || selectedInvoice.invoiceStatus === 'Superseded') && !(selectedInvoice as any).isCreditNote && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 border-2 border-rose-400 text-rose-800 text-xs font-extrabold">
              SUPERSEDED — REVERSED
              {(selectedInvoice as any).supersededByInvoiceNumber
                ? ` BY ${(selectedInvoice as any).supersededByInvoiceNumber}`
                : ''}{' '}
              | Historical audit record only. Excluded from active revenue &amp; daily collection.
            </div>
          )}

          <div className="space-y-4 text-xs font-sans">
            {(() => {
              const checkinRecord = checkins.find(c => c.id === selectedInvoice.bookingId);
              const bookingRecord = bookings.find(b => b.id === selectedInvoice.bookingId);
              const compName = selectedInvoice.companyName || checkinRecord?.companyName || bookingRecord?.companyName;
              const custGst = selectedInvoice.gstNumber || checkinRecord?.gstNumber || bookingRecord?.gstNumber;
              const custAddr = selectedInvoice.guestAddress || checkinRecord?.address || bookingRecord?.address;
              const custNat = selectedInvoice.nationality || checkinRecord?.nationality || bookingRecord?.nationality || 'Indian';
              const vchNo = selectedInvoice.voucherNumber || checkinRecord?.voucherNumber || bookingRecord?.voucherNumber;
              const arrTime = selectedInvoice.arrivalTime || checkinRecord?.arrivalTime || bookingRecord?.checkInTime || selectedInvoice.checkInTime || '12:00 PM';
              const depTime = selectedInvoice.departureTime || checkinRecord?.departureTime || bookingRecord?.checkOutTime || selectedInvoice.checkOutTime || '11:00 AM';
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-black uppercase text-xs tracking-wider mb-2">GUEST INFORMATION</p>
                    <p className="text-sm font-sans font-bold text-slate-900">{compName || selectedInvoice.guestName}</p>
                    <p><strong>Name:</strong> {selectedInvoice.guestName}</p>
                    <p><strong>Phone:</strong> {selectedInvoice.guestMobile || checkinRecord?.mobile || (bookingRecord as any)?.mobile || '—'}</p>
                    <p><strong>Email:</strong> {selectedInvoice.guestEmail || checkinRecord?.emailAddress || (bookingRecord as any)?.guestEmail || '—'}</p>
                    {custAddr && <p><strong>Location:</strong> {custAddr}</p>}
                    {compName && <p className="font-semibold text-slate-700">Company Name: {compName}</p>}
                    {(selectedInvoice.gst || 0) > 0 && custGst && (
                      <p className="font-mono font-semibold text-slate-700">Customer GSTIN: {custGst}</p>
                    )}
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="font-extrabold text-black uppercase text-xs tracking-wider mb-2">STAY DETAILS</p>
                    <p>Check-In: <strong>{selectedInvoice.checkInDate} ({arrTime})</strong></p>
                    <p>Check-Out: <strong>{selectedInvoice.checkOutDate || 'Open Stay'} ({depTime})</strong></p>
                    <p>Duration: <strong>{selectedInvoice.isHourlyStay ? `${selectedInvoice.stayHours || 3} Hours (Day-Use)` : `${calcNightsCount(selectedInvoice.checkInDate, selectedInvoice.checkOutDate)} Night(s)`}</strong></p>
                    <p>Occupants: <strong>{Number(checkinRecord?.adults || bookingRecord?.adults || 1)} Adult(s), {Number(checkinRecord?.children || bookingRecord?.children || 0)} Child(ren)</strong></p>
                    <p>Booking Source: <strong>{selectedInvoice.bookingSource || checkinRecord?.bookingSource || 'Walkin'}</strong></p>
                    <p>Room No: <strong>{selectedInvoice.roomNumber}</strong></p>
                  </div>
                </div>
              );
            })()}

            <table className="w-full text-xs text-left border divide-y mt-6">
              <thead className="bg-slate-50 font-bold">
                <tr>
                  <th className="p-3">Bill Particulars / Charge Description</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                <tr>
                  <td className="p-3">
                    1. Room Rent / Tariff — Room {selectedInvoice.roomNumber} ({calcNightsCount(selectedInvoice.checkInDate, selectedInvoice.checkOutDate)} Night(s))
                    {selectedInvoice.isGroupCheckIn && selectedInvoice.groupBookingId && (
                      <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                        Group Booking Ref: {selectedInvoice.groupBookingId} ({selectedInvoice.bookedRooms?.length || 1} Rooms)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">₹{Number(selectedInvoice.roomCharges || 0).toLocaleString()}</td>
                </tr>
                {selectedInvoice.extraBedCharges && selectedInvoice.extraBedCharges > 0 ? (
                  <tr>
                    <td className="p-3">
                      2. Extra Bed / Mattress Charges ({selectedInvoice.extraBedCount || 1} Bed(s) @ ₹{selectedInvoice.extraBedRate || 500}/night × {calcNightsCount(selectedInvoice.checkInDate, selectedInvoice.checkOutDate)} Night(s))
                    </td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.extraBedCharges || 0).toLocaleString()}</td>
                  </tr>
                ) : null}
                {Number(selectedInvoice.extraPersonCharges || 0) > 0 ? (
                  <tr>
                    <td className="p-3">Extra Person / Extra Guest Charges</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.extraPersonCharges || 0).toLocaleString()}</td>
                  </tr>
                ) : null}                {Number(selectedInvoice.foodCharges || 0) > 0 && (
                  <tr>
                    <td className="p-3">3. Food / Restaurant / POS Room Orders</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.foodCharges || 0).toLocaleString()}</td>
                  </tr>
                )}
                {Number(selectedInvoice.waterCharges || 0) > 0 && (
                  <tr>
                    <td className="p-3">4. Water Bottles / Beverage Charges</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.waterCharges || 0).toLocaleString()}</td>
                  </tr>
                )}
                {Number(selectedInvoice.laundryCharges || 0) > 0 && (
                  <tr>
                    <td className="p-3">5. Laundry & Linen Services Charges</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.laundryCharges || 0).toLocaleString()}</td>
                  </tr>
                )}
                {Number(selectedInvoice.serviceCharges || 0) > 0 && (
                  <tr>
                    <td className="p-3">6. Guest Service Charges</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.serviceCharges || 0).toLocaleString()}</td>
                  </tr>
                )}
                {Number(selectedInvoice.earlyCheckInCharges || 0) > 0 && (
                  <tr>
                    <td className="p-3">7. Early Check-In Surcharge</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.earlyCheckInCharges || 0).toLocaleString()}</td>
                  </tr>
                )}
                {Number(selectedInvoice.fineCharges || 0) > 0 && (
                  <tr>
                    <td className="p-3">8. Room Damage / Penalty / Fine Charges</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.fineCharges || 0).toLocaleString()}</td>
                  </tr>
                )}
                {Number(selectedInvoice.otherCharges || 0) > 0 && (
                  <tr>
                    <td className="p-3">9. Extra Guest Services / Ancillary Charges</td>
                    <td className="p-3 text-right">₹{Number(selectedInvoice.otherCharges || 0).toLocaleString()}</td>
                  </tr>
                )}
                <tr className="font-semibold bg-slate-50/50">
                  <td className="p-3 text-left">Subtotal (Before Discount & GST)</td>
                  <td className="p-3 text-right font-mono font-bold">₹{Number(selectedInvoice.subtotal || 0).toLocaleString()}</td>
                </tr>
                {selectedInvoice.discount > 0 && (
                  <tr className="text-emerald-700 font-medium">
                    <td className="p-3 text-left">Less: Discount (-)</td>
                    <td className="p-3 text-right font-mono font-semibold">-₹{Number(selectedInvoice.discount || 0).toLocaleString()}</td>
                  </tr>
                )}
                {(() => {
                  const selTotals = resolveConsistentInvoiceTotals(selectedInvoice, configuredDefaultGst);
                  const slab = selTotals.headlineGstRate || configuredDefaultGst;
                  const cgstRate = (slab / 2).toFixed(1).replace(/\.0$/, '');
                  const sgstRate = (slab / 2).toFixed(1).replace(/\.0$/, '');
                  return (
                    <>
                      {Math.abs(selTotals.totalTax) > 0 && (
                        <>
                          <tr>
                            <td className="p-3 text-left text-slate-600 font-mono">Add: CGST ({cgstRate}%)</td>
                            <td className="p-3 text-right text-slate-700 font-mono font-semibold">₹{selTotals.cgst.toLocaleString('en-IN')}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-left text-slate-600 font-mono">Add: SGST ({sgstRate}%)</td>
                            <td className="p-3 text-right text-slate-700 font-mono font-semibold">₹{selTotals.sgst.toLocaleString('en-IN')}</td>
                          </tr>
                          <tr className="bg-amber-50/40 font-semibold">
                            <td className="p-3 text-left text-[#8B691E] font-mono">Total GST ({slab}% = CGST + SGST)</td>
                            <td className="p-3 text-right text-[#8B691E] font-mono font-bold">₹{selTotals.totalTax.toLocaleString('en-IN')}</td>
                          </tr>
                        </>
                      )}
                      <tr className="font-bold text-slate-900 bg-slate-100 text-sm">
                        <td className="p-3 text-left uppercase tracking-wider">
                          {selTotals.isCreditNote ? 'TOTAL CREDIT NOTE REVERSAL (₹)' : 'GRAND TOTAL BILL (₹)'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-base">₹{selTotals.grandTotal.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="text-emerald-700 font-semibold">
                        <td className="p-3 text-left">
                          {selTotals.isCreditNote ? 'New Payment Collected' : 'Less: Advance / Amount Paid'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {selTotals.isCreditNote ? '₹0' : `-₹${selTotals.receipts.toLocaleString('en-IN')}`}
                        </td>
                      </tr>
                      {selTotals.refundDue > 0 && (
                        <tr className="text-amber-800 bg-amber-50 font-bold">
                          <td className="p-3 text-left uppercase font-mono">Refund Due / Payable to Guest</td>
                          <td className="p-3 text-right font-mono font-bold">₹{selTotals.refundDue.toLocaleString('en-IN')}</td>
                        </tr>
                      )}
                      <tr className="font-bold text-slate-900 bg-amber-50/70 text-xs">
                        <td className="p-3 text-left uppercase font-mono">NET BALANCE DUE (₹)</td>
                        <td className="p-3 text-right font-mono font-bold">
                          {selTotals.isCreditNote
                            ? '₹0 (REVERSAL ISSUED)'
                            : selTotals.balance <= 0
                            ? '₹0 (PAID IN FULL)'
                            : `₹${selTotals.balance.toLocaleString('en-IN')} DUE`}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>

            <div className="pt-12 text-[9px] text-slate-500 space-y-4">
              <p className="leading-relaxed border-t pt-2">
                {(selectedInvoice.gst || 0) > 0 ? (
                  <>
                    <strong>GST DECLARATION:</strong> Tax value declared corresponds to standard lodging provisioning regulations in the hotel trade. Balance due covers all items registered during room occupation.
                  </>
                ) : (
                  <>
                    <strong>ROOM BILL DECLARATION:</strong> Official hotel stay room bill issued without GST tax component. Balance due covers all items registered during room occupation.
                  </>
                )}
              </p>
              <div className="flex justify-between items-center pt-8">
                <span className="text-[10px] text-emerald-600 font-bold uppercase font-mono border border-emerald-300 bg-emerald-50 px-2 py-0.5 rounded">
                  Status: {selectedInvoice.isPaid ? 'PAID IN FULL' : 'UNPAID / BALANCE DUE'}
                </span>
                <span className="border-t w-52 text-center pt-1 text-slate-500">Authorized Signatory</span>
              </div>
              <div className="bg-[#ECECEC] p-3 rounded text-left my-4">
                <p className="text-xs font-extrabold uppercase text-black tracking-wider mb-1">HOTEL POLICY</p>
                <p className="text-xs text-[#222]">Non-Refundable. If you lose any personal items, the hotel will not be responsible.</p>
              </div>
              <div className="text-center font-bold italic text-sm text-black pt-2 pb-1">
                Thank you for choosing {hotelSettings?.name || 'Hotel Grant Heights'}!
              </div>
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

      {/* VIEW HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-luxury-brown-100 pb-4 no-print gap-3">
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-[#C5A059] font-bold block mb-1">Invoices & Billing Hub</span>
          <h1 className="text-2xl font-serif text-luxury-brown-950 font-semibold tracking-wide flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#9E2A2B]" /> Hotel Bill & GST Invoice Center
          </h1>
          <p className="text-xs text-luxury-brown-500">
            View, edit, print, and download all generated hotel GST invoices. Completing Check-Out automatically generates the guest's final invoice and opens it here.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setIsSeparateInvoiceMode(false);
              setSeparateParentInvoice(null);
              setSelectedBookingForNewInvId('');
              setNewInvGuestName('');
              setNewInvMobile('');
              setNewInvRoomNumber('');
              setNewInvRoomCharges(0);
              setNewInvDiscount(0);
              setNewInvAdvancePaid(0);
              setNewInvGstRate(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
              setIsBookingInvoiceModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#263449] hover:bg-[#1a2433] text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
          >
            <Receipt className="w-4 h-4 text-[#E0BD6B]" /> + Generate New / Separate Invoice
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-luxury-brown-900 text-luxury-gold-300 p-3.5 rounded-xl border border-luxury-gold-500/20 text-xs text-center font-semibold font-mono animate-bounce no-print">
          🛎️ Notification Feed: {notification}
        </div>
      )}

      {/* FILTERS & CATEGORIES */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-xl p-4 shadow-xs space-y-3 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-luxury-brown-400" />
            <input
              type="text"
              placeholder="Search invoice number, room number, guest name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-luxury-brown-200 rounded-lg text-sm focus:outline-none focus:border-[#C5A059] text-luxury-brown-905"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-end font-mono text-xs text-luxury-brown-500">
            Total of {filteredInvoices.length} matched invoice(s) ({invoices.length} total in system).
          </div>
        </div>

        {/* Sub-Category Filter Badges */}
        <div className="flex items-center gap-2 pt-2 border-t border-luxury-brown-100 flex-wrap">
          <span className="text-[11px] font-mono text-luxury-brown-500 font-bold uppercase mr-1">Filter Invoices:</span>
          <button
            onClick={() => setInvoiceCategoryFilter('All')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              invoiceCategoryFilter === 'All'
                ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs'
                : 'bg-luxury-beige-50 text-luxury-brown-700 hover:bg-luxury-beige-100 border border-luxury-brown-200'
            }`}
          >
            All Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setInvoiceCategoryFilter('Booking')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              invoiceCategoryFilter === 'Booking'
                ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-xs'
                : 'bg-luxury-beige-50 text-luxury-brown-700 hover:bg-luxury-beige-100 border border-luxury-brown-200'
            }`}
          >
            Booking Invoices ({invoices.filter(i => i.invoiceType === 'Booking Invoice' && !i.isSuperseded && i.invoiceStatus !== 'Superseded').length})
          </button>
          <button
            onClick={() => setInvoiceCategoryFilter('Checkout')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              invoiceCategoryFilter === 'Checkout'
                ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs'
                : 'bg-luxury-beige-50 text-luxury-brown-700 hover:bg-luxury-beige-100 border border-luxury-brown-200'
            }`}
          >
            Checkout Invoices ({invoices.filter(i => i.invoiceType !== 'Booking Invoice' && !i.isSuperseded && i.invoiceStatus !== 'Superseded').length})
          </button>
          <button
            onClick={() => setInvoiceCategoryFilter('Due')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              invoiceCategoryFilter === 'Due'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Balance Due ({invoices.filter(i => !i.isPaid && !i.isSuperseded && i.invoiceStatus !== 'Superseded').length})
          </button>
          <button
            onClick={() => setInvoiceCategoryFilter('Superseded')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              invoiceCategoryFilter === 'Superseded'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            Superseded ({invoices.filter(i => i.isSuperseded || i.invoiceStatus === 'Superseded').length})
          </button>
        </div>

        {/* Date-Wise Filter Row (All, Today, Yesterday, This Month, From -> To Date) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 pt-2.5 border-t border-luxury-brown-100 text-xs flex-wrap">
          <span className="text-[11px] font-mono text-luxury-brown-500 font-bold uppercase mr-1">
            Date-Wise Filter:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['All', 'All'],
              ['Today', 'Today'],
              ['Yesterday', 'Yesterday'],
              ['This Month', 'This Month'],
              ['Range', 'From → To Date'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDateFilterType(key)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                  dateFilterType === key
                    ? 'bg-[#17120F] text-[#E0BD6B] border-[#17120F] shadow-xs'
                    : 'bg-white text-luxury-brown-700 border-luxury-brown-200 hover:bg-luxury-beige-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {dateFilterType === 'Range' && (
            <div className="flex items-center flex-wrap gap-2 bg-luxury-beige-50 border border-luxury-brown-200 px-2.5 py-1.5 rounded-lg">
              <span className="text-luxury-brown-600 font-semibold">From:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="px-2 py-1 border border-luxury-brown-200 rounded bg-white text-luxury-brown-900 font-mono text-xs"
              />
              <span className="text-luxury-brown-600 font-semibold">→ To:</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="px-2 py-1 border border-luxury-brown-200 rounded bg-white text-luxury-brown-900 font-mono text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* INVOICES LIST & PREVIEW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
        
        {/* Left Side: Invoice List (Full width when no bill is open, 7 Cols when viewing bill) */}
        <div className={`${selectedInvoice ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-luxury-brown-100 rounded-2xl shadow-sm overflow-hidden transition-all`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#17120F] text-white font-bold font-mono uppercase tracking-wider text-[11px]">
                  <th className="p-3.5 whitespace-nowrap">Invoice No</th>
                  <th className="p-3.5 whitespace-nowrap">Guest Information</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Room</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Grand Total</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100 text-[#263449] font-medium">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500 space-y-2">
                      <p className="font-serif font-bold text-sm text-[#263449]">No generated invoices yet.</p>
                      <p className="text-xs text-slate-500">
                        Use the <strong>1-Click Generate Bill</strong> buttons above for any Checked-In Guest, or click <strong>+ Create / Generate Bill</strong> on the top right.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr 
                      key={inv.id} 
                      className={`hover:bg-amber-50/40 transition-colors ${
                        selectedInvoice?.id === inv.id ? 'bg-amber-50/70 border-l-4 border-l-[#C49A3A]' : ''
                      }`}
                    >
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-[#263449] text-xs">{inv.invoiceNumber}</span>
                        <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                          GST: {inv.gstRate ?? (inv.gst > 0 ? 5 : 0)}%
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-serif font-bold text-[#263449] text-sm">{inv.guestName}</div>
                        <span className="text-[10px] text-slate-500 font-mono">Date: {inv.dateCreated}</span>
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 bg-[#17120F] !text-[#C49A3A] rounded-lg font-bold font-mono text-xs whitespace-nowrap">
                          Room {inv.roomNumber}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-[#263449] text-sm whitespace-nowrap">
                        {(() => {
                          const rt = resolveConsistentInvoiceTotals(inv, configuredDefaultGst);
                          return (
                            <div>
                              <div>₹{rt.grandTotal.toLocaleString('en-IN')}</div>
                              {!rt.isCreditNote && (
                                <div className="text-[10px] font-mono text-slate-500 font-normal">
                                  Paid: ₹{rt.receipts.toLocaleString('en-IN')} • Due: ₹{rt.balance.toLocaleString('en-IN')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {(inv as any).isCreditNote ||
                          inv.invoiceType === 'Credit Note' ||
                          String(inv.invoiceNumber || '').toUpperCase().startsWith('CN/') ? (
                            <>
                              <span className="inline-flex items-center px-2 py-0.5 border font-mono rounded-full text-[9px] font-bold uppercase whitespace-nowrap bg-rose-50 text-rose-800 border-rose-300">
                                CREDIT NOTE
                              </span>
                              <span className="text-[9px] font-mono text-slate-500 block">
                                Reversal (Non-Revenue)
                              </span>
                            </>
                          ) : inv.isSuperseded || inv.invoiceStatus === 'Superseded' ? (
                            <>
                              <span className="inline-flex items-center px-2 py-0.5 border font-mono rounded-full text-[9px] font-bold uppercase whitespace-nowrap bg-rose-50 text-rose-700 border-rose-300">
                                SUPERSEDED
                              </span>
                              {inv.supersededByInvoiceNumber && (
                                <span className="text-[9px] font-mono text-slate-500 block">
                                  Replaced by {inv.supersededByInvoiceNumber}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className={`inline-flex items-center px-2 py-0.5 border font-mono rounded-full text-[9px] font-bold uppercase whitespace-nowrap ${
                                (inv.invoiceStatus || (inv.invoiceType === 'Tax Invoice' ? 'Finalized' : 'Generated')) === 'Finalized'
                                  ? 'bg-indigo-50 !text-indigo-800 border-indigo-200'
                                  : 'bg-slate-100 !text-slate-700 border-slate-300'
                              }`}>
                                Inv: {inv.invoiceStatus || (inv.invoiceType === 'Tax Invoice' ? 'Finalized' : 'Generated')}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 border font-mono rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                                inv.paymentStatus === 'Paid' || inv.isPaid
                                  ? 'bg-emerald-50 !text-[#15805D] border-emerald-200'
                                  : inv.paymentStatus === 'Partially Paid' || (Number(inv.advancePaid || 0) > 0 && !inv.isPaid)
                                  ? 'bg-amber-50 !text-amber-800 border-amber-200'
                                  : 'bg-rose-50 !text-[#D92D4B] border-rose-200'
                              }`}>
                                {inv.paymentStatus || (inv.isPaid ? 'Paid' : Number(inv.advancePaid || 0) > 0 ? 'Partially Paid' : 'Unpaid')}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditInvoice(inv);
                            }}
                            className="px-2.5 py-1.5 bg-white hover:bg-[#FDF8ED] text-[#263449] border border-[#C49A3A] rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
                            title="Edit Invoice Charges, Guest Name, Room, GST, or Discount"
                          >
                            <Edit className="w-3 h-3 text-[#C49A3A]" /> Edit
                          </button>
                          {(() => {
                            const matchedCheckin =
                              checkins.find(c => c.id === inv.checkInId || c.id === inv.bookingId || c.bookingId === inv.bookingId) || null;
                            const matchedBooking = bookings.find(b => b.id === inv.bookingId) || null;
                            const rowFoodItems = extractDetailedFoodLinesForStay({
                              invoice: inv,
                              checkinRecord: matchedCheckin,
                              bookingRecord: matchedBooking,
                              posOrders,
                            });
                            const rowHasFood =
                              !(inv as any).isCreditNote &&
                              ((Number(inv.foodCharges) || 0) > 0 ||
                                (inv.ledgerLines || []).some(
                                  l => l.kind === 'food' || /Food & Beverage|Food & Restaurant|POS Room Charge|Food Bill/i.test(l.description || '')
                                ) ||
                                rowFoodItems.length > 0);
                            if (!rowHasFood) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadHotelInvoicePdf(inv, hotelSettings, matchedCheckin || undefined, matchedBooking || undefined);
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#8B691E] border border-[#C49A3A]/60 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
                                  title="Download Invoice as PDF"
                                >
                                  <Download className="w-3 h-3 text-[#C49A3A]" /> PDF
                                </button>
                              );
                            }
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPrintWindow(
                                      invoiceRecordToPrintHtml(inv, hotelSettings, matchedCheckin, matchedBooking, 'room_only', posOrders),
                                      true
                                    );
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 !text-white rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                  title="Print Room Bill Only (Zero Food details & ₹0 Food amount)"
                                >
                                  <Printer className="w-3 h-3" /> Room Bill
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPrintWindow(
                                      invoiceRecordToPrintHtml(inv, hotelSettings, matchedCheckin, matchedBooking, 'food_only', posOrders),
                                      true
                                    );
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 !text-white rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                  title="Print Separate Food Bill (All item-wise dishes & Food GST)"
                                >
                                  <UtensilsCrossed className="w-3 h-3" /> Food Bill
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPrintWindow(
                                      invoiceRecordToPrintHtml(inv, hotelSettings, matchedCheckin, matchedBooking, 'all', posOrders),
                                      true
                                    );
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#8B691E] border border-[#C49A3A]/70 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
                                  title="Print Combined Room + Food Invoice"
                                >
                                  <Download className="w-3 h-3 text-[#C49A3A]" /> Combined
                                </button>
                              </>
                            );
                          })()}
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(inv);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer shadow-2xs transition-colors ${
                              selectedInvoice?.id === inv.id
                                ? 'bg-[#C49A3A] !text-[#17120F]'
                                : 'bg-[#17120F] hover:bg-[#2A211B] !text-white'
                            }`}
                          >
                            View Bill
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

        {/* Right Side: Invoice Visual Inspection (Only shown when View Bill is clicked) */}
        {selectedInvoice && (
          <div className="lg:col-span-5">
            <div className="bg-white border border-luxury-brown-100 rounded-2xl p-5 shadow-sm sticky top-4 space-y-4">
              <div className="flex justify-between items-start border-b border-luxury-brown-100 pb-3.5 gap-2">
                <div>
                  <h3 className="font-serif font-bold text-[#263449] text-base">Invoice {selectedInvoice.invoiceNumber}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Created on: {selectedInvoice.dateCreated}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenEditInvoice(selectedInvoice)}
                    className="px-2.5 py-1 bg-[#FDF8ED] hover:bg-amber-100 text-[#263449] border border-[#C49A3A] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3 h-3 text-[#C49A3A]" /> Edit Bill
                  </button>
                  <span className={`px-2 py-1 border text-[10px] font-mono leading-none rounded-full font-bold whitespace-nowrap ${
                    selectedInvoice.isSuperseded || selectedInvoice.invoiceStatus === 'Superseded'
                      ? 'bg-rose-50 !text-rose-700 border-rose-300'
                      : 'bg-indigo-50 !text-indigo-800 border-indigo-200'
                  }`}>
                    {selectedInvoice.isSuperseded || selectedInvoice.invoiceStatus === 'Superseded'
                      ? 'SUPERSEDED'
                      : (selectedInvoice.invoiceStatus || (selectedInvoice.invoiceType === 'Tax Invoice' ? 'Finalized' : 'Generated'))}
                  </span>
                  {(() => {
                    const rtSel = resolveConsistentInvoiceTotals(selectedInvoice, configuredDefaultGst);
                    return (
                      <span className={`px-2.5 py-1 border text-[10px] font-mono leading-none rounded-full font-bold whitespace-nowrap ${
                        rtSel.paymentStatus === 'Paid'
                          ? 'bg-emerald-50 !text-[#15805D] border-emerald-200'
                          : rtSel.paymentStatus === 'Partially Paid'
                          ? 'bg-amber-50 !text-amber-800 border-amber-200'
                          : 'bg-rose-50 !text-[#D92D4B] border-rose-200'
                      }`}>
                        {rtSel.isCreditNote
                          ? 'CREDIT NOTE'
                          : rtSel.paymentStatus === 'Paid'
                          ? 'PAID IN FULL'
                          : rtSel.paymentStatus === 'Partially Paid'
                          ? 'PARTIALLY PAID'
                          : 'UNPAID / DUE'}
                      </span>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(null)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Close Bill Preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Superseded Warning Banner if applicable */}
              {(selectedInvoice.isSuperseded || selectedInvoice.invoiceStatus === 'Superseded') && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl text-rose-950 text-xs space-y-1.5">
                  <div className="font-bold flex items-center justify-between flex-wrap gap-1.5">
                    <span className="flex items-center gap-1.5 text-rose-800 font-mono uppercase font-extrabold">
                      ⚠️ SUPERSEDED — REVERSED{selectedInvoice.supersededByInvoiceNumber ? ` BY ${selectedInvoice.supersededByInvoiceNumber}` : ''}
                    </span>
                    {selectedInvoice.supersededByInvoiceNumber && (
                      <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-rose-300 text-rose-800">
                        Ref: {selectedInvoice.supersededByInvoiceNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    This historical invoice has been superseded and reversed. It is preserved immutably for accounting audit trail and excluded from active hotel revenue &amp; daily collection.
                  </p>
                </div>
              )}

              {/* Locked GST / No-GST Status on Generated Invoice + Separate Invoice Action */}
              {!(selectedInvoice.isSuperseded || selectedInvoice.invoiceStatus === 'Superseded') && (
                <div className="p-3 bg-[#FAF6F0] border border-[#E6DCCF] rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-[#263449] block">
                        Locked Invoice Tax Mode:
                      </span>
                      <span className="text-[10px] text-slate-600">
                        GST mode cannot be edited on a generated invoice. Need {(selectedInvoice.gst || 0) > 0 ? 'No GST' : 'With GST'}? Create a separate invoice.
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                        (selectedInvoice.gst || 0) > 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      🔒 {(selectedInvoice.gst || 0) > 0 ? `With GST (${selectedInvoice.gstRate || configuredDefaultGst}%)` : 'No GST (0% Bill)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenSeparateInvoiceModalFrom(selectedInvoice, true)}
                    className="w-full py-2 px-3 rounded-lg bg-[#263449] hover:bg-[#1a2433] text-white text-[11px] font-mono font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5 text-[#E0BD6B]" />
                    + Generate Separate Invoice ({(selectedInvoice.gst || 0) > 0 ? 'No GST' : 'With GST'})
                  </button>
                </div>
              )}

              {/* Point 4: Date-Wise & Mode-Wise Payment Entry in the Bill */}
              {!(selectedInvoice.isSuperseded || selectedInvoice.invoiceStatus === 'Superseded') && (() => {
                const currentPayRows = deriveInitialPaymentRows(selectedInvoice);
                const modeTotalsMap = new Map<string, number>();
                currentPayRows.forEach(r => {
                  const m = String(r.paymentMethod || 'Cash');
                  modeTotalsMap.set(m, r2((modeTotalsMap.get(m) || 0) + Number(r.amount || 0)));
                });
                const totalReceived = r2(currentPayRows.reduce((s, r) => s + Number(r.amount || 0), 0));
                const selTotalsPay = resolveConsistentInvoiceTotals(selectedInvoice, configuredDefaultGst);
                const billDue = Math.max(0, r2(selTotalsPay.grandTotal - totalReceived));
                return (
                  <div className="p-3.5 bg-[#FDF8ED] border border-[#C49A3A]/50 rounded-xl space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DCCF] pb-2">
                      <div>
                        <span className="text-[10.5px] font-mono uppercase font-extrabold text-[#263449] flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-[#C49A3A]" /> Date-Wise &amp; Mode-Wise Bill Payments
                        </span>
                        <span className="text-[10px] text-slate-600">
                          Record each receipt with exact Date &amp; Payment Mode — prints directly on the Bill.
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold">
                        {Array.from(modeTotalsMap.entries()).map(([m, amt]) => (
                          <span key={m} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                            {m}: ₹{amt.toLocaleString('en-IN')}
                          </span>
                        ))}
                        <span className={`px-2 py-0.5 rounded border ${billDue > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                          {billDue > 0 ? `Due: ₹${billDue.toLocaleString('en-IN')}` : 'Fully Paid'}
                        </span>
                      </div>
                    </div>

                    {currentPayRows.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                        {currentPayRows.map(row => (
                          <div key={row.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                {formatDateLabel(row.date) || row.date}
                              </span>
                              <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                {row.paymentMethod}
                              </span>
                              {(row.referenceNo || row.notes) && (
                                <span className="text-slate-500 truncate max-w-[180px]">
                                  {[row.referenceNo ? `Ref: ${row.referenceNo}` : '', row.notes || ''].filter(Boolean).join(' • ')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-bold text-slate-900">
                                ₹{Number(row.amount || 0).toLocaleString('en-IN')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextRows = currentPayRows
                                    .filter(r => r.id !== row.id)
                                    .map(r => ({ ...r, amount: Number(r.amount || 0) }));
                                  applyUpdatedPaymentsToInvoice(selectedInvoice, nextRows);
                                  onAddAuditLog(
                                    'Bill Payment Entry Removed',
                                    `Removed ₹${row.amount} (${row.paymentMethod} on ${row.date}) from Invoice ${selectedInvoice.invoiceNumber}.`
                                  );
                                  showToast(`Removed ₹${row.amount} (${row.paymentMethod}) from bill.`, 'info');
                                }}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                title="Remove payment entry"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end pt-1">
                      <div className="sm:col-span-3">
                        <label className="block text-[9.5px] font-mono uppercase font-bold text-slate-600 mb-0.5">Payment Date</label>
                        <input
                          type="date"
                          value={quickPayDate}
                          onChange={e => setQuickPayDate(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-[11px] font-bold"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[9.5px] font-mono uppercase font-bold text-slate-600 mb-0.5">Payment Mode</label>
                        <select
                          value={quickPayMode}
                          onChange={e => setQuickPayMode(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-bold"
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Card">Card</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Other">Custom Mode...</option>
                        </select>
                      </div>
                      {quickPayMode === 'Other' && (
                        <div className="sm:col-span-3">
                          <label className="block text-[9.5px] font-mono uppercase font-bold text-slate-600 mb-0.5">Custom Mode</label>
                          <input
                            type="text"
                            placeholder="e.g. Paytm / NEFT"
                            value={quickPayCustomMode}
                            onChange={e => setQuickPayCustomMode(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-bold"
                          />
                        </div>
                      )}
                      <div className={quickPayMode === 'Other' ? 'sm:col-span-3' : 'sm:col-span-2'}>
                        <label className="block text-[9.5px] font-mono uppercase font-bold text-slate-600 mb-0.5">Amount (₹)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder={billDue > 0 ? String(billDue) : '0'}
                          value={quickPayAmount}
                          onChange={e => setQuickPayAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-mono text-[11px] font-bold text-emerald-800"
                        />
                      </div>
                      <div className={quickPayMode === 'Other' ? 'sm:col-span-9' : 'sm:col-span-2'}>
                        <label className="block text-[9.5px] font-mono uppercase font-bold text-slate-600 mb-0.5">Ref / Note</label>
                        <input
                          type="text"
                          placeholder="UTR / Note"
                          value={quickPayRef}
                          onChange={e => setQuickPayRef(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px]"
                        />
                      </div>
                      <div className={quickPayMode === 'Other' ? 'sm:col-span-3' : 'sm:col-span-2'}>
                        <button
                          type="button"
                          onClick={() => {
                            const amt = r2(Number(quickPayAmount || 0));
                            if (amt <= 0) {
                              showToast('Please enter a valid payment amount (₹).', 'warning');
                              return;
                            }
                            const modeLabel =
                              quickPayMode === 'Other'
                                ? quickPayCustomMode.trim() || 'Other'
                                : quickPayMode;
                            const dt = quickPayDate || new Date().toISOString().slice(0, 10);
                            const newEntry = {
                              id: `PAY-INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              date: dt,
                              paymentMethod: modeLabel,
                              amount: amt,
                              referenceNo: quickPayRef.trim() || undefined,
                              notes: 'Bill Receipt',
                            };
                            const nextRows = [
                              ...currentPayRows.map(r => ({ ...r, amount: Number(r.amount || 0) })),
                              newEntry,
                            ];
                            applyUpdatedPaymentsToInvoice(selectedInvoice, nextRows);
                            onAddAuditLog(
                              'Bill Payment Added',
                              `Recorded ₹${amt} via ${modeLabel} on ${dt} for Invoice ${selectedInvoice.invoiceNumber}.`
                            );
                            setQuickPayAmount('');
                            setQuickPayRef('');
                            showToast(`Added ₹${amt} (${modeLabel} on ${dt}) to Bill ${selectedInvoice.invoiceNumber}!`, 'success');
                          }}
                          className="w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Exact Client PDF Invoice Preview ("HOTEL M M PRESTIGE" Layout) */}
              <div className="bg-[#f3f3f3] p-2 rounded-xl border border-luxury-brown-200">
                <iframe
                  title={`Invoice ${selectedInvoice.invoiceNumber}`}
                  srcDoc={invoiceRecordToPrintHtml(
                    selectedInvoice,
                    hotelSettings,
                    checkins.find(c => c.id === selectedInvoice.bookingId) || null,
                    bookings.find(b => b.id === selectedInvoice.bookingId) || null
                  )}
                  className="w-full min-h-[680px] bg-white rounded-lg border border-[#DCE3EC]"
                />
              </div>

              {/* Action Operations Rows */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const matchedCheckin = checkins.find(c => c.id === selectedInvoice.bookingId);
                    const matchedBooking = bookings.find(b => b.id === selectedInvoice.bookingId);
                    downloadHotelInvoicePdf(selectedInvoice, hotelSettings, matchedCheckin, matchedBooking);
                  }}
                  className="w-full p-2.5 bg-gradient-to-r from-[#C49A3A] to-[#B0862B] hover:from-[#d4aa47] hover:to-[#C49A3A] text-[#17120F] rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                >
                  <Download className="w-4 h-4" /> Download / Save Invoice PDF ({selectedInvoice.invoiceNumber})
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const matchedCheckin = checkins.find(c => c.id === selectedInvoice.bookingId) || null;
                      const matchedBooking = bookings.find(b => b.id === selectedInvoice.bookingId) || null;
                      openPrintWindow(
                        invoiceRecordToPrintHtml(
                          selectedInvoice,
                          hotelSettings,
                          matchedCheckin,
                          matchedBooking
                        ),
                        true
                      );
                    }}
                    className="p-2.5 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Tax Invoice
                  </button>
                  <button
                    onClick={() => handleOpenEditInvoice(selectedInvoice)}
                    className="p-2.5 bg-luxury-beige-100 text-luxury-brown-900 font-semibold rounded-lg text-xs hover:bg-luxury-beige-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#C49A3A]/40"
                  >
                    <Edit className="w-3.5 h-3.5 text-[#C49A3A]" /> Edit Invoice Details
                  </button>
                </div>

                {(() => {
                  const selCheckin =
                    checkins.find(c => c.id === selectedInvoice.checkInId || c.id === selectedInvoice.bookingId || c.bookingId === selectedInvoice.bookingId) || null;
                  const selBooking = bookings.find(b => b.id === selectedInvoice.bookingId) || null;
                  const selFoodItems = extractDetailedFoodLinesForStay({
                    invoice: selectedInvoice,
                    checkinRecord: selCheckin,
                    bookingRecord: selBooking,
                    posOrders,
                  });
                  const hasFood =
                    (Number(selectedInvoice.foodCharges) || 0) > 0 ||
                    (selectedInvoice.ledgerLines || []).some(
                      l => l.kind === 'food' || /Food & Beverage|Food & Restaurant|POS Room Charge|Food Bill/i.test(l.description || '')
                    ) ||
                    selFoodItems.length > 0;
                  if (!hasFood) return null;
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          openPrintWindow(
                            invoiceRecordToPrintHtml(selectedInvoice, hotelSettings, selCheckin, selBooking, 'room_only', posOrders),
                            true
                          );
                        }}
                        className="p-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                        title="Print Room Charges only (Zero Food details & ₹0 Food amount)"
                      >
                        <Printer className="w-3.5 h-3.5" /> Room Bill
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openPrintWindow(
                            invoiceRecordToPrintHtml(selectedInvoice, hotelSettings, selCheckin, selBooking, 'food_only', posOrders),
                            true
                          );
                        }}
                        className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                        title="Print Separate Food Bill (All item-wise dishes & Food GST)"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" /> Food Bill
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openPrintWindow(
                            invoiceRecordToPrintHtml(selectedInvoice, hotelSettings, selCheckin, selBooking, 'all', posOrders),
                            true
                          );
                        }}
                        className="p-2 bg-[#17120F] hover:bg-[#2A211B] text-[#E0BD6B] rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer"
                        title="Print Combined Room + Food Invoice"
                      >
                        <Download className="w-3.5 h-3.5" /> Combined
                      </button>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const guestMobile = selectedInvoice.guestMobile || checkins.find(c => c.id === selectedInvoice.bookingId)?.mobile || '7978563771';
                      const msg = `Hello *${selectedInvoice.guestName}*,\n\n` +
                        `Here is your invoice *${selectedInvoice.invoiceNumber}* from *${hotelSettings?.name || 'Grand Pavilion'}*:\n` +
                        `• Room: ${selectedInvoice.roomNumber}\n` +
                        `• Stay Duration: ${selectedInvoice.checkInDate} to ${selectedInvoice.checkOutDate}\n` +
                        `• Grand Total Bill: ₹${Number(selectedInvoice.finalAmount || 0).toLocaleString()}\n` +
                        `• Status: *${selectedInvoice.isPaid ? 'PAID IN FULL' : 'PENDING'}*\n\n` +
                        `Thank you!`;
                      openWhatsAppChat(guestMobile, msg);
                    }}
                    className="p-2.5 border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Send
                  </button>

                  <button
                    onClick={() => triggerToast('GST tax invoice payload emailed via SMTP relay.')}
                    className="p-2.5 border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-600" /> Email PDF Invoice
                  </button>
                </div>

                {/* Settle outstanding check action */}
                {!selectedInvoice.isPaid && (
                  <button
                    onClick={() => handleSettlePaidStatus(selectedInvoice.id)}
                    className="w-full mt-2 p-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Settle Account Due Balance
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FULL OUT CHECKOUT & SETTLEMENT MODAL */}
      {isCheckoutFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 p-4">
          <div className="relative bg-white rounded-2xl border border-luxury-brown-100 shadow-2xl max-w-2xl w-full overflow-hidden no-print flex flex-col max-h-[90vh]">
            
            <div className="bg-luxury-brown-950 text-white p-5 flex justify-between items-center border-b">
              <div>
                <h3 className="text-lg font-serif font-medium text-luxury-gold-300 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-luxury-gold-400" /> Complete Stay Checkout & Generate GST Invoice
                </h3>
                <p className="text-[10px] text-luxury-brown-200 uppercase tracking-widest font-mono">
                  Calculates 18% standard hoteliery GST automatically
                </p>
              </div>
              <button 
                onClick={() => setIsCheckoutFormOpen(false)}
                className="text-white hover:text-gray-300 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Select active check-in */}
              <div className="space-y-1.5 bg-luxury-beige-50 p-4 rounded-xl border">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Select Active Guest Stay Occupant *</label>
                <select
                  required
                  value={selectedCheckInId}
                  onChange={(e) => handleCheckInSelected(e.target.value)}
                  className="w-full px-3 py-2 border border-luxury-brown-200 bg-white rounded-lg text-sm font-serif font-bold text-luxury-brown-950"
                >
                  <option value="">-- Choose active stay occupant --</option>
                  {checkins.filter(c => !c.checkedOutDateTime).map(c => (
                    <option key={c.id} value={c.id}>
                      Room {c.roomNumber} - {c.guestName} (Checked in: {c.checkInDate})
                    </option>
                  ))}
                </select>
              </div>

              {activeCheckin && (() => {
                const activeTotals = calculateStayTotals(activeCheckin);
                return (
                  <>
                    {/* Tabbed breakdown details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2.5 bg-gray-50 rounded-xl border text-center">
                        <span className="text-gray-400 text-[9px] uppercase block">Room stay rate</span>
                        <span className="font-bold text-luxury-brown-950">₹{Number(activeCheckin.roomRate || 0).toLocaleString()}/night</span>
                      </div>
                      <div className="p-2.5 bg-gray-50 rounded-xl border text-center relative overflow-hidden flex flex-col justify-center min-h-[50px]">
                        <span className="text-gray-400 text-[9px] uppercase block">Stay nights</span>
                        <span className="font-bold text-luxury-brown-950">
                          {activeTotals.nights} nights
                        </span>
                        {activeTotals.isLateCheckout && (
                          <span className="absolute bottom-0 left-0 right-0 bg-[#9E2A2B] text-[7.5px] text-white uppercase font-mono py-0.5 tracking-tighter">
                            Late Checkout Active (+1 Day)
                          </span>
                        )}
                      </div>
                      {activeCheckin.companyName && (
                        <div className="p-2.5 bg-blue-50/50 rounded-xl border text-center md:col-span-2 col-span-2">
                          <span className="text-blue-500 text-[9px] uppercase block">Corporate Entity Details</span>
                          <span className="font-bold text-blue-900 block truncate">{activeCheckin.companyName}</span>
                          {activeCheckin.gstNumber && <span className="font-mono text-[9px] text-blue-700">GST: {activeCheckin.gstNumber}</span>}
                        </div>
                      )}
                    </div>

                  {/* SECTION A: REGISTER ANCILLARY CHARGES & ROOM DAMAGE / FINE BEFORE CHECKOUT */}
                  <div className="space-y-3 p-4 border-2 border-[#9E2A2B]/25 bg-[#9E2A2B]/5 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#9E2A2B]/15 pb-2">
                      <div>
                        <h4 className="text-xs uppercase font-mono tracking-wider text-[#9E2A2B] font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> Room Inspection & Damage / Fine / Extra Charges Box
                        </h4>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          Record any room damage, breakage, or extra inspection charges below:
                        </p>
                      </div>
                    </div>

                    {/* Quick Damage / Fine Presets */}
                    <div className="space-y-1">
                      <span className="text-[9.5px] font-mono uppercase font-bold text-slate-500 block">
                        Quick Room Damage / Fine Presets (Click to Fill):
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
                              setChargeCategory('Damage');
                              setChargeDescription(`Damage Fine: ${preset.label}`);
                              setChargeAmount(preset.amt);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-rose-100 text-[#9E2A2B] border border-rose-200 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                          >
                            + {preset.label} (₹{preset.amt})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Add charge mini-form */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-3 space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase block">Charge Category</span>
                        <select
                          value={chargeCategory}
                          onChange={(e) => setChargeCategory(e.target.value as any)}
                          className="w-full px-3 py-1.5 border bg-white rounded-lg text-xs font-bold"
                        >
                          <option value="Damage">Damage Penalty / Fine</option>
                          <option value="Food">Food / Room Kitchen</option>
                          <option value="Laundry">Laundry Service</option>
                          <option value="Late Checkout">Late Checkout Fees</option>
                          <option value="Other">Other Miscellaneous</option>
                        </select>
                      </div>

                      <div className="md:col-span-4 space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase block">Item Description / Note</span>
                        <input
                          type="text"
                          placeholder="e.g. Dinner, Tea, Laundry (Optional)"
                          value={chargeDescription}
                          onChange={(e) => setChargeDescription(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExtraAncillaryCharge();
                            }
                          }}
                          className="w-full px-3 py-1.5 border bg-white rounded-lg text-xs"
                        />
                      </div>

                      <div className="md:col-span-3 space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase block">Cost (₹) *</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="Enter cost (₹)"
                          value={chargeAmount > 0 ? chargeAmount : ''}
                          onChange={(e) => setChargeAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExtraAncillaryCharge();
                            }
                          }}
                          className="w-full px-3 py-1.5 border bg-white rounded-lg text-xs font-mono font-bold text-luxury-brown-950"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddExtraAncillaryCharge}
                          className="w-full py-1.5 px-3 bg-[#9E2A2B] text-white font-bold rounded-lg hover:bg-[#802223] transition-all cursor-pointer text-xs flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>

                    {/* Active charges list */}
                    {activeCheckin.extraCharges && activeCheckin.extraCharges.length > 0 ? (
                      <div className="border bg-white rounded-lg divide-y overflow-hidden max-h-32 overflow-y-auto">
                        {activeCheckin.extraCharges.map((ec) => (
                          <div key={ec.id} className="p-2 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-[#9E2A2B] uppercase font-mono text-[9px] mr-2">[{ec.category}]</span>
                              <span className="text-gray-700">{ec.description}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-gray-900">₹{ec.amount}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAncillaryCharge(ec.id)}
                                className="text-rose-600 hover:bg-rose-50 p-1 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 italic">No extra ancillary charges logged yet for this stay.</p>
                    )}
                  </div>

                  {/* SECTION B: BILLING TOTALS & BREAKDOWN */}
                  {(() => {
                    const math = calculateStayTotals(activeCheckin);
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left column: Bill breakdown */}
                        <div className="space-y-2 border p-3 rounded-xl bg-gray-50/50">
                          <h5 className="font-mono uppercase font-bold text-[#C5A059] border-b pb-1">Stay Invoice Math</h5>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Lodging Tariffs ({math.nights} {math.nights === 1 ? 'Night' : 'Nights'}):</span>
                              <span className="font-mono font-bold">₹{math.roomCharges.toLocaleString()}</span>
                            </div>
                            {math.extraPersonTotal > 0 && (
                              <div className="flex justify-between">
                                <span>Extra Person / Guest Charges:</span>
                                <span className="font-mono font-bold">₹{math.extraPersonTotal.toLocaleString()}</span>
                              </div>
                            )}
                            {math.extraBedTotal > 0 && (
                              <div className="flex justify-between text-amber-900">
                                <span>Extra Bed Charges:</span>
                                <span className="font-mono font-bold">₹{math.extraBedTotal.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Ancillary Extras Total:</span>
                              <span className="font-mono font-bold">₹{math.extrasTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Subtotal before Tax:</span>
                              <span className="font-mono font-bold">₹{math.subtotal.toLocaleString()}</span>
                            </div>

                            {/* With GST vs No GST Switch (Locked if stay invoice already exists) */}
                            {(() => {
                              const existingStayInv = activeCheckin
                                ? invoices.find(
                                    inv =>
                                      !inv.isSeparateInvoice &&
                                      (inv.bookingId === activeCheckin.id || inv.checkInId === activeCheckin.id)
                                  )
                                : undefined;
                              if (existingStayInv) {
                                const lockedHasGst =
                                  !existingStayInv.isWithoutGst &&
                                  ((existingStayInv.gstRate !== undefined && Number(existingStayInv.gstRate) > 0) ||
                                    (existingStayInv.gstRate === undefined && Number(existingStayInv.gst || 0) > 0));
                                return (
                                  <div className="py-2 border-t border-b border-dashed my-2 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-mono uppercase font-bold text-gray-600">
                                        Locked Invoice Mode ({existingStayInv.invoiceNumber}):
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                          lockedHasGst
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                            : 'bg-amber-50 text-amber-800 border-amber-300'
                                        }`}
                                      >
                                        🔒 {lockedHasGst ? `With GST (${existingStayInv.gstRate || configuredDefaultGst}%)` : 'No GST (0%)'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-amber-800">
                                      GST cannot be edited on an existing invoice. Generate a separate invoice if another GST mode is required.
                                    </p>
                                  </div>
                                );
                              }
                              return (
                                <div className="py-2 border-t border-b border-dashed my-2">
                                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-gray-800">
                                    <input
                                      type="checkbox"
                                      checked={isGstBillingEnabled}
                                      onChange={e => {
                                        const checked = e.target.checked;
                                        setIsGstBillingEnabled(checked);
                                        if (checked && checkoutGstRate <= 0) {
                                          setCheckoutGstRate(configuredDefaultGst > 0 ? configuredDefaultGst : 5);
                                        }
                                      }}
                                      className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                                    />
                                    <span>
                                      GST Invoice ({configuredDefaultGst > 0 ? configuredDefaultGst : 5}% Room GST from Settings)
                                    </span>
                                  </label>
                                </div>
                              );
                            })()}

                            {(() => {
                              const activeRate = isGstBillingEnabled ? checkoutGstRate : 0;
                              if (activeRate <= 0) {
                                return (
                                  <div className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                                    Without GST — Printed as ROOM BILL (₹0 Tax)
                                  </div>
                                );
                              }
                              const halfRate = (activeRate / 2).toFixed(1).replace(/\.0$/, '');
                              const totalGstVal = Number(math.gst || 0);
                              const halfGstVal = parseFloat((totalGstVal / 2).toFixed(2));
                              return (
                                <div className="space-y-1 text-[11px] font-mono text-gray-600">
                                  <div className="flex justify-between">
                                    <span>CGST ({halfRate}%):</span>
                                    <span>₹{halfGstVal.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>SGST ({halfRate}%):</span>
                                    <span>₹{halfGstVal.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between font-bold text-[#8B691E]">
                                    <span>Total GST ({activeRate}% = CGST + SGST):</span>
                                    <span>₹{totalGstVal.toLocaleString('en-IN')}</span>
                                  </div>
                                </div>
                              );
                            })()}
                            
                            <div className="flex justify-between items-center gap-2 pt-1 border-t border-dashed">
                              <span>Apply Discount (₹):</span>
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={discount > 0 ? discount : ''}
                                onChange={(e) => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))}
                                className="w-24 px-2 py-0.5 border rounded text-right font-mono text-xs font-bold text-emerald-700 bg-white"
                              />
                            </div>

                            <div className="flex justify-between font-bold text-sm text-luxury-brown-950 border-t pt-1.5 mt-2">
                              <span>Grand Total Bill:</span>
                              <span>₹{Math.max(0, math.grandTotal).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right column: Payments & Ledger Balance */}
                        <div className="space-y-2 border p-3 rounded-xl bg-[#C5A059]/5">
                          <h5 className="font-mono uppercase font-bold text-[#C5A059] border-b pb-1">Payment Ledger Diagnostics</h5>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Advance Deposit:</span>
                              <span className="font-mono text-emerald-700 font-bold">₹{Number(activeCheckin.advanceAmount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Subsequent Payments:</span>
                              <span className="font-mono text-emerald-700 font-bold">
                                ₹{((activeCheckin.payments || []).filter(p => p.paymentType !== 'Advance Deposit').reduce((sum, p) => sum + p.amount, 0)).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between font-bold text-emerald-700">
                              <span>Total Payments Made:</span>
                              <span className="font-mono">₹{math.totalPaid.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between font-bold text-sm text-luxury-brown-950 border-t pt-1.5 mt-2">
                              <span>Remaining Due Amount:</span>
                              <span className={`font-mono font-bold ${math.dueAmount > 0 ? 'text-[#9E2A2B]' : 'text-emerald-700'}`}>
                                ₹{Math.max(0, math.dueAmount).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* SECTION C: SETTLEMENT TRANSACTION FOR CHECKOUT */}
                  {(() => {
                    const math = calculateStayTotals(activeCheckin);
                    const realDue = math.dueAmount > 0 ? math.dueAmount : 0;

                    return (
                      <div className="p-4 border border-[#9E2A2B]/20 bg-slate-50 rounded-xl space-y-4">
                        <h4 className="text-xs uppercase font-mono tracking-wider text-luxury-brown-950 font-bold flex items-center justify-between border-b pb-2">
                          <span className="flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-[#9E2A2B]" /> Settle & Clear Stay Dues
                          </span>
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-full font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                            Available / Paid: ₹{math.totalPaid.toLocaleString()}
                          </span>
                        </h4>

                        {/* 4-Column Financial Ledger Grid */}
                        {(() => {
                          const depositVal = activeCheckin.depositBalance ?? 0;
                          const appliedDeposit = Math.min(realDue, depositVal);
                          const remainingDue = realDue - appliedDeposit;
                          const finalAmount = math.grandTotal > 0 ? math.grandTotal : 0;

                          return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-luxury-brown-950 text-white p-4 rounded-xl font-mono text-xs border border-luxury-gold-550/20">
                              <div className="border-r border-white/10 pr-2">
                                <span className="text-luxury-gold-300 uppercase block text-[9px] font-bold">Final Amount</span>
                                <span className="text-sm font-bold block text-slate-100">₹{finalAmount.toLocaleString()}</span>
                                <span className="text-[9px] text-zinc-400 block mt-0.5">Stay with taxes</span>
                              </div>
                              <div className="border-r border-white/10 pr-2">
                                <span className="text-luxury-gold-300 uppercase block text-[9px] font-bold">Paid Amount</span>
                                <span className="text-sm font-bold block text-emerald-400">₹{math.totalPaid.toLocaleString()}</span>
                                <span className="text-[9px] text-zinc-400 block mt-0.5">Paid so far</span>
                              </div>
                              <div className="border-r border-white/10 pr-2">
                                <span className="text-luxury-gold-300 uppercase block text-[9px] font-bold">Deposit Amount</span>
                                <span className="text-sm font-bold block text-slate-100">₹{depositVal.toLocaleString()}</span>
                                <span className="text-[9px] text-emerald-300 block mt-0.5">Applied: -₹{appliedDeposit.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-[#8B691E] uppercase block text-[9px] font-bold tracking-widest">Due Amount</span>
                                <span className="text-sm font-bold block text-[#263449]">₹{remainingDue.toLocaleString()}</span>
                                <span className="text-[9px] text-zinc-300 block mt-0.5">Net outstanding</span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="font-bold text-gray-700 block text-xs">Hotel Policy Mandate</span>
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 leading-normal">
                              <strong>Flexible Settlement Enabled!</strong> You can edit the amount received if the guest is paying partially, has a custom corporate arrangement, or has departed with pending credit. Dues remaining will be saved on their ledger.
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-gray-700 block text-xs">Amount Received (₹) *</span>
                              {isAmountOverridden && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAmountOverridden(false);
                                    const totals = calculateStayTotals(activeCheckin);
                                    const rDue = totals.dueAmount > 0 ? totals.dueAmount : 0;
                                    const depVal = activeCheckin.depositBalance ?? 0;
                                    const remDue = rDue - Math.min(rDue, depVal);
                                    setCheckoutPayAmount(parseFloat(remDue.toFixed(2)));
                                  }}
                                  className="text-[10px] text-[#9E2A2B] hover:underline font-mono font-bold"
                                >
                                  [Reset to Due]
                                </button>
                              )}
                            </div>
                            {(() => {
                              const depVal = activeCheckin.depositBalance ?? 0;
                              const remDue = realDue - Math.min(realDue, depVal);
                              return (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    value={checkoutPayAmount}
                                    onChange={(e) => {
                                      setCheckoutPayAmount(Number(e.target.value));
                                      setIsAmountOverridden(true);
                                    }}
                                    className={`w-full px-3 py-2 border-2 rounded-lg font-mono font-bold text-sm focus:outline-none ${
                                      checkoutPayAmount < remDue 
                                        ? 'border-amber-400 bg-amber-50/20 text-amber-800 focus:border-amber-500' 
                                        : 'border-emerald-400 bg-emerald-50/10 text-emerald-800 focus:border-emerald-500'
                                    }`}
                                  />
                                  <div className="text-[10px] font-medium leading-relaxed">
                                    {checkoutPayAmount > remDue ? (
                                      <span className="text-emerald-700">
                                        ✓ Overpayment! Excess <strong>₹{(checkoutPayAmount - remDue).toLocaleString()}</strong> will be saved to Guest Deposit Balance.
                                      </span>
                                    ) : checkoutPayAmount < remDue ? (
                                      <span className="text-amber-600 font-bold block">
                                        ⚠️ Partial Checkout! Outstanding balance of <strong>₹{(remDue - checkoutPayAmount).toLocaleString()}</strong> will remain on the Guest Stay Ledger as credit due.
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 font-bold">
                                        ✓ Perfect Settlement! Dues fully cleared (₹0.00 outstanding).
                                      </span>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {!isFullyPending && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="font-bold text-gray-700 block">Payment Method *</span>
                              <select
                                value={checkoutPayMethod}
                                onChange={(e) => {
                                  const v = e.target.value as any;
                                  if (v === 'Hybrid') {
                                    setCheckoutHybridRows(createInitialHybridRows(Number(checkoutPayAmount) || 0, ['Cash', 'UPI', 'Card', 'Bank']));
                                  }
                                  setCheckoutPayMethod(v);
                                }}
                                className="w-full px-3 py-1.5 border bg-white rounded-lg font-bold text-xs"
                              >
                                <option value="UPI">UPI Sync / QR Scanner</option>
                                <option value="Cash">Cash Drawer</option>
                                <option value="Card">Terminal POS Card Reader</option>
                                <option value="Bank">Direct NetBanking Transfer</option>
                                <option value="Hybrid">⇄ Hybrid / Split Payment</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <span className="font-bold text-gray-700 block">Transaction Notes / Reference</span>
                              <input
                                type="text"
                                placeholder="e.g. UPI ID or reference number"
                                value={checkoutNotes}
                                onChange={(e) => setCheckoutNotes(e.target.value)}
                                className="w-full px-3 py-1.5 border rounded-lg text-xs"
                              />
                            </div>
                            {checkoutPayMethod === 'Hybrid' && (
                              <div className="md:col-span-2">
                                <HybridSplitPaymentBox
                                  rows={checkoutHybridRows}
                                  onChange={(rows) => {
                                    setCheckoutHybridRows(rows);
                                    const sum = Math.round(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) * 100) / 100;
                                    setCheckoutPayAmount(sum);
                                  }}
                                  modes={['Cash', 'UPI', 'Card', 'Bank']}
                                  targetAmount={Number(checkoutPayAmount) || 0}
                                  compact
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCheckoutFormOpen(false)}
                className="px-4 py-2 border rounded-lg font-bold text-gray-700 bg-white hover:bg-gray-100 transition-colors cursor-pointer text-xs"
              >
                Cancel Checkout
              </button>
              <button
                type="button"
                onClick={handleExecuteCheckout}
                disabled={!selectedCheckInId}
                className="px-6 py-2 bg-[#9E2A2B] hover:bg-[#802223] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-all active:scale-98 cursor-pointer text-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Verify Settlement & Checkout Guest
              </button>
            </div>

          </div>
        </div>
      )}

      {/* GENERATE INVOICE FOR BOOKING MODAL */}
      {isBookingInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative bg-white rounded-2xl border border-luxury-gold-500/30 shadow-2xl max-w-2xl w-full overflow-hidden no-print flex flex-col max-h-[92vh] animate-fadeIn">
            {/* Header */}
            <div className="bg-luxury-brown-950 text-white p-5 flex justify-between items-center border-b border-luxury-gold-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-luxury-gold-500/20 text-luxury-gold-400 rounded-lg border border-luxury-gold-500/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-white tracking-wide">
                    {isSeparateInvoiceMode ? 'Generate Separate Invoice' : 'Generate Invoice for Booking'}
                  </h3>
                  <p className="text-[10px] text-luxury-brown-300 uppercase tracking-widest font-mono">
                    {isSeparateInvoiceMode
                      ? `Creates a brand-new separate invoice without modifying ${separateParentInvoice?.invoiceNumber || 'existing invoice'}`
                      : 'Issue legal With GST or No GST invoice for any reservation or guest stay'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsBookingInvoiceModalOpen(false);
                  setIsSeparateInvoiceMode(false);
                  setSeparateParentInvoice(null);
                }}
                className="text-luxury-brown-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateBookingInvoice} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs text-luxury-brown-900">
              {/* Separate Invoice Notice when an invoice already exists */}
              {(() => {
                const existingForSel =
                  separateParentInvoice ||
                  (selectedBookingForNewInvId
                    ? invoices.find(
                        i =>
                          !i.isSeparateInvoice &&
                          (i.bookingId === selectedBookingForNewInvId || i.checkInId === selectedBookingForNewInvId)
                      )
                    : undefined);
                if (!isSeparateInvoiceMode && !existingForSel) return null;
                return (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>🔒 Separate Invoice Mode Active</span>
                      {existingForSel && (
                        <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-amber-300">
                          Existing: {existingForSel.invoiceNumber} ({(existingForSel.gst || 0) > 0 ? 'With GST' : 'No GST'})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-900">
                      Submitting this form will generate a <strong>new sequential invoice</strong> ({newInvGstRate > 0 ? `With GST ${newInvGstRate}%` : 'Bill of Supply (0% GST)'}) and supersede the previous overlapping invoice ({existingForSel?.invoiceNumber}), preventing duplicate billing and phantom refunds in PMS accounts.
                    </p>
                  </div>
                );
              })()}

              {/* Select Existing Booking or Active Stay */}
              <div className="bg-luxury-beige-50/70 p-4 rounded-xl border border-luxury-brown-200/80 space-y-2">
                <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">
                  Select Checked-In Guest or Advance Booking *
                </label>
                <select
                  value={selectedBookingForNewInvId}
                  onChange={(e) => handleSelectBookingForInvoice(e.target.value)}
                  className="w-full px-3 py-2 border border-luxury-brown-200 bg-white rounded-lg text-xs font-semibold text-luxury-brown-950 focus:border-luxury-gold-500 focus:outline-none"
                >
                  <option value="">
                    -- Select Checked-In Guest ({checkins.filter(c => !c.checkedOutDateTime).length}) or Booking ({bookings.length}) --
                  </option>
                  {checkins.filter(c => !c.checkedOutDateTime).length > 0 && (
                    <optgroup label="Active Checked-In Guests (In-House / Walk-In)">
                      {checkins
                        .filter(c => !c.checkedOutDateTime)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            [IN-HOUSE] Room {c.roomNumber} • {c.guestName} ({c.checkInDate} to {c.checkOutDate}) • ₹{c.roomRate || 2000}/night
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {bookings.length > 0 && (
                    <optgroup label="Advance Reservations / Bookings">
                      {bookings.map(b => (
                        <option key={b.id} value={b.id}>
                          [BOOKING] {b.id} • {b.guestName} (Room {b.roomNumber || 'TBD'}) • {b.checkInDate} to {b.checkOutDate} • ₹{b.bookingAmount || b.advanceAmount || 2000}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <span className="text-[10px] text-luxury-brown-400 font-mono block">
                  Selecting any checked-in guest or booking automatically fills guest name, room, dates, room rent, extra bed, and advance paid.
                </span>
              </div>

              {/* Guest & Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newInvGuestName}
                    onChange={(e) => setNewInvGuestName(e.target.value)}
                    placeholder="e.g. Aditi Sharma"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs bg-white text-luxury-brown-900 focus:border-luxury-gold-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Mobile Number</label>
                  <input
                    type="tel"
                    value={newInvMobile}
                    onChange={(e) => setNewInvMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900 focus:border-luxury-gold-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Room & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Assigned Room</label>
                  <input
                    type="text"
                    value={newInvRoomNumber}
                    onChange={(e) => setNewInvRoomNumber(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900 focus:border-luxury-gold-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Check-In Date</label>
                  <input
                    type="date"
                    required
                    value={newInvCheckInDate}
                    onChange={(e) => setNewInvCheckInDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900 focus:border-luxury-gold-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Check-Out Date</label>
                  <input
                    type="date"
                    required
                    value={newInvCheckOutDate}
                    onChange={(e) => setNewInvCheckOutDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900 focus:border-luxury-gold-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Financial Tariffs & Extra Bed Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Total Room Tariff (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newInvRoomCharges}
                    onChange={(e) => setNewInvRoomCharges(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-900 focus:border-luxury-gold-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-luxury-brown-400 font-mono">
                    Nights count: {calcNightsCount(newInvCheckInDate, newInvCheckOutDate)} night(s)
                  </span>
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold pt-2">Extra Person / Guest Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={newInvExtraPersonCharges}
                    onChange={(e) => setNewInvExtraPersonCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-luxury-brown-900 focus:border-luxury-gold-500 focus:outline-none"
                  />
                </div>

                {/* Extra Bed Section */}
                <div className="bg-luxury-beige-50/80 p-3 rounded-xl border border-luxury-brown-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-mono font-bold uppercase text-luxury-brown-700 flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={newInvHasExtraBed}
                        onChange={(e) => setNewInvHasExtraBed(e.target.checked)}
                        className="rounded text-luxury-gold-600 focus:ring-luxury-gold-500"
                      />
                      Add Extra Bed
                    </label>
                    {newInvHasExtraBed && (
                      <span className="text-[10px] font-mono font-bold text-luxury-gold-700">
                        ₹{((newInvExtraBedCount * newInvExtraBedRate * calcNightsCount(newInvCheckInDate, newInvCheckOutDate)) || 0).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {newInvHasExtraBed && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-luxury-brown-200/60">
                      <div>
                        <span className="text-[10px] font-mono text-luxury-brown-500 block">Bed Quantity</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={newInvExtraBedCount}
                          onChange={(e) => setNewInvExtraBedCount(parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1 border rounded bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-luxury-brown-500 block">Price / Bed (₹)</span>
                        <input
                          type="number"
                          min={0}
                          value={newInvExtraBedRate}
                          onChange={(e) => setNewInvExtraBedRate(parseFloat(e.target.value) || 500)}
                          className="w-full px-2 py-1 border rounded bg-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* GST Slab, Advance & Invoice Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">
                    GST Invoice Option
                  </label>
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-mono font-bold cursor-pointer select-none transition-all ${
                      newInvGstRate > 0
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-400'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={newInvGstRate > 0}
                      onChange={(e) =>
                        setNewInvGstRate(
                          e.target.checked
                            ? configuredDefaultGst > 0
                              ? configuredDefaultGst
                              : 5
                            : 0
                        )
                      }
                      className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                    />
                    <span>
                      GST Invoice ({newInvGstRate > 0 ? `${newInvGstRate}% Applied` : 'Without GST'})
                    </span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Advance Paid (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={newInvAdvancePaid}
                    onChange={(e) => setNewInvAdvancePaid(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono font-bold bg-white text-emerald-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Invoice Type</label>
                  <select
                    value={newInvType}
                    onChange={(e) => setNewInvType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 bg-white rounded-lg text-xs font-serif font-bold"
                  >
                    <option value="Tax Invoice">Tax Invoice (Official GST)</option>
                    <option value="Booking Invoice">Booking Confirmation Invoice</option>
                    <option value="Proforma Invoice">Proforma Estimate</option>
                  </select>
                </div>
              </div>

              {/* Discount & Payment Method */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Discount / Concession (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={newInvDiscount}
                    onChange={(e) => setNewInvDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-luxury-brown-600 block uppercase font-bold">Payment Method</label>
                  <select
                    value={newInvPaymentMethod}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      if (v === 'Hybrid') {
                        setNewInvHybridRows(createInitialHybridRows(Number(newInvAdvancePaid) || 0, ['Cash', 'UPI', 'Card', 'Online']));
                      }
                      setNewInvPaymentMethod(v);
                    }}
                    className="w-full px-3 py-2 border border-luxury-brown-200 bg-white rounded-lg text-xs"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash at Desk</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Online">Online / Bank Wire</option>
                    <option value="Hybrid">⇄ Hybrid / Split Payment</option>
                  </select>
                </div>
              </div>
              {newInvPaymentMethod === 'Hybrid' && (
                <HybridSplitPaymentBox
                  rows={newInvHybridRows}
                  onChange={(rows) => {
                    setNewInvHybridRows(rows);
                    const sum = Math.round(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) * 100) / 100;
                    setNewInvAdvancePaid(sum);
                  }}
                  modes={['Cash', 'UPI', 'Card', 'Online']}
                  targetAmount={Number(newInvAdvancePaid) || 0}
                  compact
                />
              )}

              {/* Live Calculation Preview Card (via single calculateBill() engine) */}
              {(() => {
                const n = calcNightsCount(newInvCheckInDate, newInvCheckOutDate) || 1;
                const eb = newInvHasExtraBed ? (newInvExtraBedCount * newInvExtraBedRate * n) : 0;
                const previewCharges: BillCharge[] = [
                  ...(newInvRoomCharges > 0
                    ? [{ id: 'prev-room', kind: 'room' as const, description: 'Room Charges', amount: newInvRoomCharges, nights: n, roomNumber: newInvRoomNumber || '101' }]
                    : []),
                  ...(eb > 0
                    ? [{ id: 'prev-eb', kind: 'extra_bed' as const, description: 'Extra Bed Charges', amount: eb, roomNumber: newInvRoomNumber || '101' }]
                    : []),
                  ...(Number(newInvExtraPersonCharges) > 0
                    ? [{ id: 'prev-ep', kind: 'extra_person' as const, description: 'Extra Person Charges', amount: Number(newInvExtraPersonCharges), roomNumber: newInvRoomNumber || '101' }]
                    : []),
                ];
                const previewBill = calculateBill({
                  charges: previewCharges,
                  payments:
                    newInvAdvancePaid > 0
                      ? [{ id: 'prev-adv', amount: newInvAdvancePaid, method: newInvPaymentMethod }]
                      : [],
                  discount: newInvDiscount,
                  gstEnabled: newInvGstRate > 0,
                  settings: {
                    ...billSettings,
                    roomGstRate: newInvGstRate > 0 ? newInvGstRate : 0,
                    foodGstRate: newInvGstRate > 0 ? billSettings.foodGstRate || newInvGstRate : 0,
                    roomRateIncludesGst: false,
                  },
                });
                const sub = previewBill.taxableAmount;
                const tax = previewBill.totalTax;
                const grand = previewBill.grandTotal;
                const bal = previewBill.balance;

                return (
                  <div className="bg-luxury-brown-950 text-white p-4 rounded-xl font-mono text-xs border border-luxury-gold-500/20 space-y-2">
                    <div className="flex justify-between border-b border-white/10 pb-2 mb-2 font-serif font-bold text-luxury-gold-300">
                      <span>Calculated Invoice Summary</span>
                      <span className="font-mono text-xs">{n} Night(s) Stay</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                      <div>
                        <span className="text-luxury-brown-300 block text-[9px] uppercase">Taxable Subtotal</span>
                        <span className="text-white font-bold">₹{sub.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-luxury-brown-300 block text-[9px] uppercase">
                          CGST + SGST = Total GST ({newInvGstRate}%)
                        </span>
                        <span className="text-luxury-gold-300 font-bold">
                          ₹{previewBill.cgst.toLocaleString('en-IN')} + ₹{previewBill.sgst.toLocaleString('en-IN')} = ₹{tax.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-luxury-brown-300 block text-[9px] uppercase">Grand Total Bill</span>
                        <span className="text-white font-bold text-sm">₹{grand.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-luxury-brown-300 block text-[9px] uppercase">Balance Pending</span>
                        <span className={`font-bold text-sm ${bal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {bal > 0 ? `₹${bal.toLocaleString('en-IN')} Due` : '₹0 (Paid)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="pt-3 border-t border-luxury-brown-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBookingInvoiceModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-luxury-brown-700 bg-white hover:bg-luxury-beige-100 transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-luxury-gold-500 to-luxury-gold-400 hover:from-luxury-gold-400 hover:to-luxury-gold-300 text-luxury-brown-950 font-bold rounded-lg shadow-md transition-all active:scale-98 cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <Receipt className="w-4 h-4" /> Generate & Save Official Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EXISTING INVOICE MODAL */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative bg-white rounded-2xl border border-luxury-brown-200 shadow-2xl max-w-2xl w-full overflow-hidden no-print flex flex-col max-h-[92vh]">
            <div className="bg-[#17120F] text-white p-5 flex justify-between items-center border-b border-[#C49A3A]/30">
              <div>
                <h3 className="text-base font-serif font-bold text-[#C49A3A]">
                  Edit Invoice — {editingInvoice.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-300 font-mono">
                  Modify Guest Details, Charges, Discount, or Payment Status (GST mode is locked on generated invoices)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="text-slate-300 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedInvoice} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-[#263449]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editInvGuestName}
                    onChange={e => setEditInvGuestName(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={editInvMobile}
                    onChange={e => setEditInvMobile(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Room Number</label>
                  <input
                    type="text"
                    value={editInvRoomNumber}
                    onChange={e => setEditInvRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Check-In Date</label>
                  <input
                    type="date"
                    value={editInvCheckInDate}
                    onChange={e => setEditInvCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Check-Out Date</label>
                  <input
                    type="date"
                    value={editInvCheckOutDate}
                    onChange={e => setEditInvCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">1. Room Rent Total (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editInvRoomCharges}
                    onChange={e => setEditInvRoomCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono font-bold text-[#263449]"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">2. Extra Bed / Mattress (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editInvExtraBedCharges}
                    onChange={e => setEditInvExtraBedCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Extra Person / Guest Charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editInvExtraPersonCharges}
                    onChange={e => setEditInvExtraPersonCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono"
                  />
                </div>                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">3. Food / Restaurant (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editInvFoodCharges}
                    onChange={e => setEditInvFoodCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">4. Water / Laundry / Services (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editInvServiceCharges}
                    onChange={e => setEditInvServiceCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Less: Discount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editInvDiscount}
                    onChange={e => setEditInvDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono font-bold text-rose-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">
                    Locked GST Tax Mode (Immutable After Generation)
                  </label>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border ${
                          editInvGstRate > 0
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        🔒 {editInvGstRate > 0 ? `With GST (${editInvGstRate}%)` : 'No GST (0% Bill)'}
                      </span>
                      <p className="text-[10px] text-amber-900">
                        GST / No-GST cannot be edited on this invoice. Create a separate invoice if needed.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const src = editingInvoice;
                        setEditingInvoice(null);
                        handleOpenSeparateInvoiceModalFrom(src, true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#263449] hover:bg-[#1a2433] text-white text-[11px] font-mono font-bold cursor-pointer shrink-0"
                    >
                      + Separate Invoice ({editInvGstRate > 0 ? 'No GST' : 'With GST'})
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-mono font-bold uppercase text-[10px] mb-1">Advance / Paid Amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editInvAdvancePaid}
                    onChange={e => setEditInvAdvancePaid(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-lg bg-white font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              {/* Point 4: Date-Wise & Mode-Wise Payment Schedule inside Edit Bill Modal */}
              <div className="p-3.5 rounded-xl bg-[#FDF8ED] border border-[#C49A3A]/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-mono font-bold uppercase text-[10.5px] text-[#263449]">
                      Date-Wise &amp; Mode-Wise Payment Entries
                    </span>
                    <span className="text-[10px] text-slate-600">
                      Add one row per payment date &amp; mode (e.g. Cash on Day 1, UPI on Day 2).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextRows = [
                        ...editInvPaymentRows,
                        {
                          id: `pay-row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          date: new Date().toISOString().slice(0, 10),
                          paymentMethod: 'Cash',
                          amount: '' as number | '',
                          referenceNo: '',
                          notes: '',
                        },
                      ];
                      setEditInvPaymentRows(nextRows);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Payment Row
                  </button>
                </div>

                {editInvPaymentRows.length === 0 ? (
                  <p className="text-[11px] italic text-slate-500">
                    No dated payment rows yet. Click &quot;+ Add Payment Row&quot; to record Date-wise &amp; Mode-wise receipts.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {editInvPaymentRows.map((row, idx) => (
                      <div key={row.id} className="grid grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-lg border border-slate-200">
                        <input
                          type="date"
                          value={row.date}
                          onChange={e => {
                            const updated = editInvPaymentRows.map((r, i) => (i === idx ? { ...r, date: e.target.value } : r));
                            setEditInvPaymentRows(updated);
                          }}
                          className="col-span-3 px-2 py-1 border border-slate-300 rounded font-mono text-[11px] font-bold"
                        />
                        <select
                          value={row.paymentMethod}
                          onChange={e => {
                            const updated = editInvPaymentRows.map((r, i) => (i === idx ? { ...r, paymentMethod: e.target.value } : r));
                            setEditInvPaymentRows(updated);
                          }}
                          className="col-span-3 px-2 py-1 border border-slate-300 rounded text-[11px] font-bold bg-white"
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Card">Card</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Online">Online</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          placeholder="₹ Amount"
                          value={row.amount}
                          onChange={e => {
                            const v = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                            const updated = editInvPaymentRows.map((r, i) => (i === idx ? { ...r, amount: v } : r));
                            setEditInvPaymentRows(updated);
                            setEditInvAdvancePaid(r2(updated.reduce((s, r) => s + Number(r.amount || 0), 0)));
                          }}
                          className="col-span-3 px-2 py-1 border border-slate-300 rounded font-mono text-[11px] font-bold text-emerald-800"
                        />
                        <input
                          type="text"
                          placeholder="UTR / Note"
                          value={row.referenceNo || ''}
                          onChange={e => {
                            const updated = editInvPaymentRows.map((r, i) => (i === idx ? { ...r, referenceNo: e.target.value } : r));
                            setEditInvPaymentRows(updated);
                          }}
                          className="col-span-2 px-2 py-1 border border-slate-300 rounded text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editInvPaymentRows.filter((_, i) => i !== idx);
                            setEditInvPaymentRows(updated);
                            setEditInvAdvancePaid(r2(updated.reduce((s, r) => s + Number(r.amount || 0), 0)));
                          }}
                          className="col-span-1 flex items-center justify-center p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-[#E6DCCF] text-[11px]">
                  <span className="font-mono font-bold text-slate-700">
                    Total Dated Receipts: ₹{r2(editInvPaymentRows.reduce((s, r) => s + Number(r.amount || 0), 0)).toLocaleString('en-IN')}
                  </span>
                  <label className="inline-flex items-center gap-1.5 font-bold text-emerald-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editInvIsPaid}
                      onChange={e => setEditInvIsPaid(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Mark Bill as Fully Paid (₹0 Due)</span>
                  </label>
                </div>
              </div>

              {/* Live Preview in Edit Invoice Modal */}
              {(() => {
                const sub = (Number(editInvRoomCharges) || 0) + (Number(editInvExtraBedCharges) || 0) + (Number(editInvExtraPersonCharges) || 0) + (Number(editInvFoodCharges) || 0) + (Number(editInvServiceCharges) || 0);
                const disc = Number(editInvDiscount) || 0;
                const taxable = Math.max(0, sub - disc);
                const gstAmt = editInvGstRate > 0 ? parseFloat(((taxable * editInvGstRate) / 100).toFixed(2)) : 0;
                const grand = parseFloat((taxable + gstAmt).toFixed(2));
                const rowsTotal = r2(editInvPaymentRows.reduce((s, r) => s + Number(r.amount || 0), 0));
                const paid = editInvIsPaid ? grand : (editInvPaymentRows.length > 0 ? rowsTotal : (Number(editInvAdvancePaid) || 0));
                const due = editInvIsPaid ? 0 : Math.max(0, parseFloat((grand - paid).toFixed(2)));
                return (
                  <div className="bg-[#FDF8ED] text-[#17120F] border border-[#C49A3A]/50 p-3.5 rounded-xl font-mono text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Subtotal</span>
                      <span className="font-bold">₹{sub.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">
                        CGST + SGST = GST ({editInvGstRate}%)
                      </span>
                      <span className="font-bold text-amber-800">
                        ₹{parseFloat((gstAmt / 2).toFixed(2))} + ₹{parseFloat((gstAmt / 2).toFixed(2))} = ₹{gstAmt}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Grand Total Bill</span>
                      <span className="font-bold text-sm">₹{grand.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase">Net Balance Due</span>
                      <span className={`font-bold text-sm ${due > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {due > 0 ? `₹${due.toLocaleString()} Due` : '₹0 (Paid)'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-luxury-brown-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2 border border-luxury-brown-200 rounded-lg font-bold text-[#263449] bg-white hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#C49A3A] hover:bg-[#a8822d] text-white font-bold rounded-lg shadow cursor-pointer"
                >
                  Save Updated Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
