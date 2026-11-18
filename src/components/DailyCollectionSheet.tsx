import React, { useState, useMemo, useEffect } from 'react';
import { Room, Booking, GuestCheckIn, Invoice, Expense, HotelSettings, PosOrder, CashHandover, Staff } from '../types';
import DirtyRoomsPanel from './DirtyRoomsPanel';
import { 
  Printer, Download, Calendar, ChevronLeft, ChevronRight, 
  Search, RefreshCw, FileSpreadsheet, DollarSign, ArrowDown, Edit3, Check,
  Building2, Wallet, CreditCard, Utensils, TrendingUp, ShieldCheck, Sparkles, Receipt
} from 'lucide-react';

interface DailyCollectionSheetProps {
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  expenses: Expense[];
  posOrders?: PosOrder[];
  handovers?: CashHandover[];
  staff?: Staff[];
  hotelSettings?: HotelSettings;
}

const localTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function DailyCollectionSheet({
  rooms = [],
  bookings = [],
  checkins = [],
  invoices = [],
  expenses = [],
  posOrders = [],
  handovers = [],
  staff = [],
  hotelSettings
}: DailyCollectionSheetProps) {
  // Selected Report Date (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => {
    return localTodayStr();
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Counter Reconciliation States (persisted per date in localStorage)
  const storageKey = `pms_daily_counter_${selectedDate}`;
  const [openingBalance, setOpeningBalance] = useState<number>(26126);
  const [ownerHandover, setOwnerHandover] = useState<number>(0);
  const [customNote, setCustomNote] = useState<string>('');
  const [isEditingCounter, setIsEditingCounter] = useState(false);

  // Load persisted counter values for the selected date
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.openingBalance === 'number') setOpeningBalance(parsed.openingBalance);
        if (typeof parsed.ownerHandover === 'number') setOwnerHandover(parsed.ownerHandover);
        if (typeof parsed.customNote === 'string') setCustomNote(parsed.customNote);
      } else {
        // Look up previous day's closing if available
        const prevDate = new Date(selectedDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevKey = `pms_daily_counter_${prevDate.toISOString().substring(0, 10)}`;
        const prevSaved = localStorage.getItem(prevKey);
        if (prevSaved) {
          const prevParsed = JSON.parse(prevSaved);
          if (typeof prevParsed.closingBalance === 'number') {
            setOpeningBalance(prevParsed.closingBalance);
          }
        }
      }
    } catch {}
  }, [selectedDate, storageKey]);

  // Format date as DD-MM-YYYY for display
  const formattedDisplayDate = useMemo(() => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return selectedDate;
  }, [selectedDate]);

  // Navigate date
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1 * days);
    setSelectedDate(d.toISOString().substring(0, 10));
  };

  // Compile guest ledger records for the selected date
  const reportRows = useMemo(() => {
    const rowsMap = new Map<string, any>();

    // 1. Check-ins active on the selected date
    checkins.forEach((c) => {
      const inDate = (c.checkInDate || '').substring(0, 10);
      const outDate = (c.checkOutDate || '').substring(0, 10);
      
      const isActiveOnDate =
        inDate === selectedDate ||
        outDate === selectedDate ||
        (inDate <= selectedDate && outDate >= selectedDate) ||
        (!!inDate && !outDate && inDate <= selectedDate);

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
          extraCharges: c.extraCharges || []
        });
      }
    });

    // 2. Invoices generated or settled on selected date
    invoices.forEach((inv) => {
      const invDate = (inv.dateCreated || (inv as any).createdAt || (inv as any).invoiceDate || '').substring(0, 10);
      const inDate = (inv.checkInDate || '').substring(0, 10);
      const outDate = (inv.checkOutDate || '').substring(0, 10);

      const isMatch =
        invDate === selectedDate ||
        inDate === selectedDate ||
        outDate === selectedDate ||
        (inDate <= selectedDate && outDate >= selectedDate);

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
          extraCharges: []
        };

        existing.invoice = inv;
        rowsMap.set(key, existing);
      }
    });

    // 3. Bookings on that date if not already in checkins
    bookings.forEach((b) => {
      const inDate = (b.checkInDate || '').substring(0, 10);
      const outDate = (b.checkOutDate || '').substring(0, 10);
      const bookedOn = (b.bookingDate || '').substring(0, 10);
      const isActive =
        inDate === selectedDate ||
        outDate === selectedDate ||
        (inDate <= selectedDate && outDate >= selectedDate) ||
        (!!inDate && !outDate && inDate <= selectedDate) ||
        (bookedOn === selectedDate && Number(b.advanceAmount || 0) > 0);

      if (isActive && b.status !== 'Cancelled') {
        const key = `${b.roomNumber}_${b.guestName}`;
        if (!rowsMap.has(key)) {
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
            extraCharges: []
          });
        }
      }
    });

    // 4. POS Food Orders on selected date
    const ordersOnDate = posOrders.filter((o) => {
      const oDate = ((o as any).createdAt || (o as any).orderTime || (o as any).timestamp || '').substring(0, 10);
      return oDate === selectedDate;
    });

    // Transform mapped rows into exact table items matching Raghunath Sir's sheet
    const processed = Array.from(rowsMap.values()).map((row, idx) => {
      const c = row.checkin;
      const inv = row.invoice;
      const b = row.booking;

      const guestName = (row.guestName || 'GUEST').toUpperCase();
      const roomNumber = row.roomNumber || 'N/A';
      const nights = row.nights || 1;

      // Catalog Rack Tariff vs Agreed / Charged Rate
      const matchedRoom = rooms.find(r => r.number === roomNumber);
      const rackTariff = matchedRoom ? matchedRoom.rate * nights : (row.roomRate || 2000) * nights;
      let roomTariff = inv ? inv.roomCharges : (c ? c.roomRate * nights : row.roomRate * nights);
      if (!roomTariff || roomTariff <= 0) roomTariff = rackTariff;

      // GST on room
      let gstAmount: number | string = 0;
      if (inv) {
        gstAmount = inv.tax || inv.gst || 0;
      } else if (b?.otaName === 'MakeMyTrip' || b?.otaName === 'MMT') {
        gstAmount = 'MMT';
      } else {
        // GST from booking, else from Settings default rate
        const settingsRate = hotelSettings?.isGstEnabled === false ? 0 : Number(hotelSettings?.defaultGstRate ?? 0);
        gstAmount = b && b.gstAmount !== undefined ? Number(b.gstAmount) : Math.round((roomTariff * settingsRate) / 100);
      }

      // Room Payment Modes
      let cashPay = 0;
      let upiPay = 0;
      let iciciPay = 0; // Card / Bank / Online

      // Payments from Invoice
      if (inv && Array.isArray(inv.paymentDetails)) {
        inv.paymentDetails.forEach((p: any) => {
          const m = (p.mode || p.method || '').toLowerCase();
          const amt = Number(p.amount) || 0;
          if (m.includes('cash')) cashPay += amt;
          else if (m.includes('upi') || m.includes('gpay') || m.includes('phonepe') || m.includes('paytm')) upiPay += amt;
          else iciciPay += amt;
        });
      } else {
        // Fallback to check-in or booking payment mode
        const pMode = (c?.paymentMethod || b?.paymentMethod || 'Cash').toLowerCase();
        const paid = Number(c?.advanceAmount || b?.advanceAmount || c?.advancePayment || b?.advancePayment || c?.totalPaid || inv?.paidAmount || inv?.advancePaid || 0);
        if (pMode.includes('cash')) cashPay = paid;
        else if (pMode.includes('upi')) upiPay = paid;
        else if (pMode.includes('card') || pMode.includes('bank') || pMode.includes('icici') || pMode.includes('online')) iciciPay = paid;
        else cashPay = paid;
      }

      // Balance
      const totalPaidRoom = cashPay + upiPay + iciciPay;
      const totalRoomPayable = roomTariff + (typeof gstAmount === 'number' ? gstAmount : 0);
      let balance = Math.max(0, totalRoomPayable - totalPaidRoom);
      if (inv && typeof inv.pendingAmount === 'number') {
        balance = inv.pendingAmount;
      }

      // Room Amenities & Extra Charges
      let waterBottle = 0;
      let extraPerson = 0;
      let laundry = 0;
      let extraBed = 0;

      const extras = (c?.extraCharges || []).concat(inv?.extraCharges || []);
      extras.forEach((ec: any) => {
        const cat = (ec.category || ec.description || '').toLowerCase();
        const amt = Number(ec.amount) || 0;
        if (cat.includes('water') || cat.includes('bottle')) waterBottle += amt;
        else if (cat.includes('person') || cat.includes('occupant') || cat === 'ep') extraPerson += amt;
        else if (cat.includes('laundry') || cat.includes('wash')) laundry += amt;
        else if (cat.includes('bed') || cat.includes('mattress')) extraBed += amt;
      });

      if (inv) {
        if (inv.waterCharges) waterBottle = Math.max(waterBottle, inv.waterCharges);
        if (inv.extraBedCharges) extraBed = Math.max(extraBed, inv.extraBedCharges);
      }

      // Kitchen / Food Amounts
      let kitchenUpi = 0;
      let kitchenCash = 0;
      let kitchenDue = 0;

      // Find POS orders matching this room
      const roomOrders = ordersOnDate.filter(
        (o) => o.roomNumber === roomNumber || o.guestName?.toLowerCase() === guestName.toLowerCase()
      );
      roomOrders.forEach((o) => {
        const pMethod = (o.paymentMethod || '').toLowerCase();
        const amt = Number((o as any).total ?? (o as any).totalAmount ?? 0);
        if (!(o as any).isPaid || pMethod.includes('due') || pMethod.includes('room')) {
          kitchenDue += amt;
        } else if (pMethod.includes('cash')) {
          kitchenCash += amt;
        } else {
          kitchenUpi += amt;
        }
      });

      // If food charges on invoice exist and no separate POS orders
      if (roomOrders.length === 0 && inv && inv.foodCharges > 0) {
        const f = inv.foodCharges;
        if (inv.isPaid) kitchenUpi = f;
        else kitchenDue = f;
      }

      const totalFoodAmt = kitchenUpi + kitchenCash + kitchenDue;

      return {
        no: idx + 1,
        guestName,
        roomNumber,
        rackTariff,
        roomTariff,
        gst: gstAmount,
        cash: cashPay,
        upi: upiPay,
        icici: iciciPay,
        balance,
        nights,
        waterBottle,
        extraPerson,
        laundry,
        extraBed,
        kitchenUpi,
        kitchenCash,
        kitchenDue,
        totalFoodAmt
      };
    });

    if (!searchTerm.trim()) return processed;
    const term = searchTerm.toLowerCase();
    return processed.filter(
      (r) =>
        r.guestName.toLowerCase().includes(term) ||
        String(r.roomNumber).toLowerCase().includes(term)
    );
  }, [checkins, invoices, bookings, posOrders, selectedDate, searchTerm, hotelSettings]);

  // Expenses on selected date
  const dailyExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const eDate = (e.date || (e as any).createdAt || '').substring(0, 10);
      return eDate === selectedDate;
    });
  }, [expenses, selectedDate]);

  const totalExpenseAmt = useMemo(() => {
    return dailyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [dailyExpenses]);

  // Default expense note built from expenses list
  const defaultExpenseNote = useMemo(() => {
    if (dailyExpenses.length === 0) return 'NO DAILY CASH EXPENSES RECORDED';
    return dailyExpenses
      .map((e) => `${e.amount} - ${(e.title || e.description || e.category || 'EXPENSE').toUpperCase()}`)
      .join(', ');
  }, [dailyExpenses]);

  const activeExpenseNote = customNote || defaultExpenseNote;

  // Table Column Totals
  const totals = useMemo(() => {
    let rackTariff = 0;
    let roomTariff = 0;
    let gstNum = 0;
    let cash = 0;
    let upi = 0;
    let icici = 0;
    let balance = 0;
    let waterBottle = 0;
    let extraPerson = 0;
    let laundry = 0;
    let extraBed = 0;
    let kitchenUpi = 0;
    let kitchenCash = 0;
    let kitchenDue = 0;
    let totalFoodAmt = 0;

    reportRows.forEach((r) => {
      rackTariff += Number((r as any).rackTariff) || Number(r.roomTariff) || 0;
      roomTariff += Number(r.roomTariff) || 0;
      if (typeof r.gst === 'number') gstNum += r.gst;
      cash += Number(r.cash) || 0;
      upi += Number(r.upi) || 0;
      icici += Number(r.icici) || 0;
      balance += Number(r.balance) || 0;
      waterBottle += Number(r.waterBottle) || 0;
      extraPerson += Number(r.extraPerson) || 0;
      laundry += Number(r.laundry) || 0;
      extraBed += Number(r.extraBed) || 0;
      kitchenUpi += Number(r.kitchenUpi) || 0;
      kitchenCash += Number(r.kitchenCash) || 0;
      kitchenDue += Number(r.kitchenDue) || 0;
      totalFoodAmt += Number(r.totalFoodAmt) || 0;
    });

    return {
      rackTariff,
      roomTariff,
      gst: gstNum,
      cash,
      upi,
      icici,
      balance,
      waterBottle,
      extraPerson,
      laundry,
      extraBed,
      kitchenUpi,
      kitchenCash,
      kitchenDue,
      totalFoodAmt
    };
  }, [reportRows]);

  // Cash Counter Calculations matching the exact photo formula:
  // TOTAL CASH = Room Cash + Kitchen Cash
  const totalCashCollected = totals.cash + totals.kitchenCash;
  const closingCounterSubtotal = openingBalance + totalCashCollected;
  const finalClosingBalance = closingCounterSubtotal - totalExpenseAmt - ownerHandover;

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
      alert('✓ Daily counter reconciliation saved for ' + formattedDisplayDate);
    } catch {}
  };

  // Export to CSV
  const handleDownloadCsv = () => {
    const headers = [
      'NO.', 'CUSTOMER NAME', 'ROOM NO.', 'ROOM TARIFF', 'GST',
      'ROOM CASH', 'ROOM UPI', 'ROOM ICICI/CARD', 'BALANCE', 'NO. OF DAYS',
      'WATER BOTTLE', 'EP', 'LAUNDRY', 'EXTRA BED',
      'KITCHEN UPI', 'KITCHEN CASH', 'KITCHEN DUE', 'TOTAL FOOD AMT'
    ];

    const rows = reportRows.map((r) => [
      r.no, `"${r.guestName}"`, r.roomNumber, r.roomTariff, r.gst,
      r.cash, r.upi, r.icici, r.balance, r.nights,
      r.waterBottle, r.extraPerson, r.laundry, r.extraBed,
      r.kitchenUpi, r.kitchenCash, r.kitchenDue, r.totalFoodAmt
    ]);

    const totalRow = [
      'TOTAL', '', '', totals.roomTariff, totals.gst,
      totals.cash, totals.upi, totals.icici, totals.balance, '',
      totals.waterBottle, totals.extraPerson, totals.laundry, totals.extraBed,
      totals.kitchenUpi, totals.kitchenCash, totals.kitchenDue, totals.totalFoodAmt
    ];

    const csvContent = [
      `"DAILY COLLECTION & COUNTER SETTLEMENT SHEET - ${hotelSettings?.name || 'HOTEL'}"`,
      `"DATE: ${formattedDisplayDate}"`,
      '',
      headers.join(','),
      ...rows.map((row) => row.join(',')),
      totalRow.join(','),
      '',
      `"OPENING COUNTER BALANCE",${openingBalance}`,
      `"TOTAL CASH COLLECTED",${totalCashCollected}`,
      `"CLOSING COUNTER SUBTOTAL",${closingCounterSubtotal}`,
      `"EXPENSES",${totalExpenseAmt}`,
      `"OWNER HANDOVER (RAJ SIR)",${ownerHandover}`,
      `"FINAL CLOSING COUNTER BALANCE",${finalClosingBalance}`,
      `"NOTE - ${activeExpenseNote}"`
    ].join('\n');

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

  const hotelName = hotelSettings?.name || 'Dasrath Palace';
  const ownerName = (hotelSettings as any)?.ownerName || 'Raj Sir';

  return (
    <div className="space-y-6">
      {/* -------------------- Top Action & Date Bar (Hidden in Print) -------------------- */}
      <div className="bg-gradient-to-r from-luxury-brown-950 via-[#1C160C] to-luxury-brown-900 border border-luxury-gold-500/30 rounded-2xl p-5 md:p-6 shadow-xl space-y-5 text-white no-print">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-luxury-gold-500/10 border border-luxury-gold-500/30 rounded-xl text-luxury-gold-400">
                <FileSpreadsheet className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-serif font-black tracking-wide text-white">
                    Daily Reception Collection & Settlement Sheet
                  </h1>
                  <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 bg-luxury-gold-500/20 text-luxury-gold-300 border border-luxury-gold-500/40 rounded-full uppercase tracking-wider">
                    Official Audit Register
                  </span>
                </div>
                <p className="text-xs text-luxury-brown-300 mt-1 leading-relaxed">
                  Guest-by-guest room tariff, mode of payment (Cash, UPI, Bank), extra services, kitchen food settlement, and counter cash vault reconciliation.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Print Landscape Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-luxury-gold-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditingCounter(!isEditingCounter)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditingCounter ? 'Done Editing' : 'Edit Balances & Notes'}</span>
            </button>
          </div>
        </div>

        {/* Date Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/15">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleShiftDate(-1)}
              className="p-2 border border-white/20 hover:bg-white/10 rounded-xl text-white transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white/10 border border-white/20 rounded-xl">
              <Calendar className="w-4 h-4 text-luxury-gold-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => handleShiftDate(1)}
              className="p-2 border border-white/20 hover:bg-white/10 rounded-xl text-white transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(localTodayStr())}
              className="px-3 py-1.5 text-xs font-mono font-bold bg-luxury-gold-500/20 hover:bg-luxury-gold-500/30 text-luxury-gold-300 border border-luxury-gold-500/40 rounded-xl transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search guest name or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:border-luxury-gold-400 font-mono text-white placeholder-luxury-brown-400"
            />
          </div>
        </div>

        {/* Counter Edit Panel (Visible only when Editing) */}
        {isEditingCounter && (
          <div className="bg-white/10 border border-luxury-gold-500/40 p-4 rounded-xl space-y-3 animate-in fade-in duration-200">
            <h3 className="text-xs font-mono font-bold text-luxury-gold-300 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-luxury-gold-400" /> Edit Cash Counter Balances & Settlement Notes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div>
                <label className="text-[11px] text-luxury-brown-300 block mb-1 font-bold">
                  Opening Counter Balance (₹)
                </label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                  className="w-full p-2.5 bg-black/40 border border-white/20 rounded-lg font-bold text-white focus:outline-none focus:border-luxury-gold-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-luxury-brown-300 block mb-1 font-bold">
                  Owner Handover / Raj Sir (₹)
                </label>
                <input
                  type="number"
                  value={ownerHandover}
                  onChange={(e) => setOwnerHandover(Number(e.target.value) || 0)}
                  className="w-full p-2.5 bg-black/40 border border-white/20 rounded-lg font-bold text-white focus:outline-none focus:border-luxury-gold-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-luxury-brown-300 block mb-1 font-bold">
                  Daily Expense Settlement Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. 300 - GARBAGE CLEANING (NAGAR NIGAM)"
                  value={activeExpenseNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full p-2.5 bg-black/40 border border-white/20 rounded-lg font-mono text-xs uppercase text-white focus:outline-none focus:border-luxury-gold-400"
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

      {/* -------------------- EXECUTIVE KPI SUMMARY CARDS (NO PRINT) -------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        {/* Card 1: Room Tariff */}
        <div className="bg-white p-3.5 rounded-2xl border border-luxury-brown-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-luxury-brown-400">
            <span className="text-[10px] font-mono uppercase font-bold">Room Tariff</span>
            <Building2 className="w-3.5 h-3.5 text-luxury-gold-600" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-luxury-brown-950 mt-1.5">
            ₹{totals.roomTariff.toLocaleString()}
          </div>
          <div className="text-[10px] text-luxury-brown-400 font-mono mt-0.5">
            {reportRows.length} Stays Logged
          </div>
        </div>

        {/* Card 2: Cash Inflow */}
        <div className="bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-emerald-800">
            <span className="text-[10px] font-mono uppercase font-bold">Cash Inflow</span>
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1.5">
            ₹{totalCashCollected.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
            Physical Cash Collected
          </div>
        </div>

        {/* Card 3: Online & UPI */}
        <div className="bg-blue-50/40 p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-blue-800">
            <span className="text-[10px] font-mono uppercase font-bold">UPI / ICICI Bank</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-blue-700 mt-1.5">
            ₹{(totals.upi + totals.icici).toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-600 font-mono mt-0.5">
            Digital Settlements
          </div>
        </div>

        {/* Card 4: Kitchen Food */}
        <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-amber-900">
            <span className="text-[10px] font-mono uppercase font-bold">Kitchen Food</span>
            <Utensils className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-amber-800 mt-1.5">
            ₹{totals.totalFoodAmt.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-700 font-mono mt-0.5">
            F&B Total Revenue
          </div>
        </div>

        {/* Card 5: Opening Counter */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] font-mono uppercase font-bold">Opening Balance</span>
            <DollarSign className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1.5">
            ₹{openingBalance.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Drawer Start Balance
          </div>
        </div>

        {/* Card 6: Closing Cash */}
        <div className="bg-gradient-to-br from-luxury-brown-950 to-luxury-brown-900 p-3.5 rounded-2xl border border-luxury-gold-500/40 text-white shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-center text-luxury-gold-300">
            <span className="text-[10px] font-mono uppercase font-bold">Closing Vault</span>
            <TrendingUp className="w-3.5 h-3.5 text-luxury-gold-400" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-luxury-gold-300 mt-1.5">
            ₹{finalClosingBalance.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/60 font-mono mt-0.5">
            Net In-Hand Balance
          </div>
        </div>
      </div>

      {/* -------------------- PRINTABLE A4 LANDSCAPE SHEET CONTAINER -------------------- */}
      <div 
        id="daily-collection-print-sheet" 
        className="bg-white p-5 md:p-6 border border-luxury-brown-200/90 shadow-md rounded-2xl space-y-4 print:border-0 print:p-0 print:shadow-none print:m-0"
      >
        {/* Printable Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-3 border-b-2 border-luxury-brown-950 gap-2">
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-black tracking-wider uppercase text-luxury-brown-950">
              {hotelName}
            </h2>
            <p className="text-xs font-mono font-bold text-luxury-gold-700 tracking-wide mt-0.5">
              DAILY RECEPTION COLLECTION & SETTLEMENT SHEET
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs sm:text-sm font-mono font-black border-2 border-luxury-brown-950 px-3 py-1 bg-luxury-beige-50 text-luxury-brown-950 rounded-lg inline-block shadow-2xs">
              Date: {formattedDisplayDate}
            </span>
          </div>
        </div>

        {/* Main Grid Table - Luxury Responsive Design */}
        <div className="overflow-x-auto rounded-xl border border-luxury-brown-300 shadow-md bg-white">
          <table className="w-full border-collapse text-left text-[11px] font-mono min-w-[1380px]">
            <thead>
              {/* Header Row 1 */}
              <tr className="bg-luxury-brown-950 text-luxury-gold-200 text-center font-extrabold border-b border-luxury-brown-800 print:bg-gray-100 print:text-black">
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[3%] min-w-[45px] text-center whitespace-nowrap">NO.</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[14%] min-w-[170px] text-left whitespace-nowrap">CUSTOMER NAME</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[5%] min-w-[75px] whitespace-nowrap">ROOM NO.</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2 w-[6%] min-w-[85px] text-right whitespace-nowrap" title="Standard Catalog Rack Tariff">ROOM TARIFF</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2 w-[6%] min-w-[85px] text-right whitespace-nowrap" title="Owner Price / Final Agreed Rate">OWNER PRICE</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[5%] min-w-[65px] whitespace-nowrap">GST</th>
                <th colSpan={3} className="border-r border-luxury-brown-800 p-2 bg-[#2D2214] text-amber-300 font-black tracking-wide whitespace-nowrap">
                  ROOM PAYMENT MODE
                </th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[6%] min-w-[90px] text-right whitespace-nowrap">BALANCE</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[4%] min-w-[55px] whitespace-nowrap">DAYS</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[6%] min-w-[100px] text-right whitespace-nowrap">WATER BOTTLE</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[4%] min-w-[50px] whitespace-nowrap">EP</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[5%] min-w-[80px] text-right whitespace-nowrap">LAUNDRY</th>
                <th rowSpan={2} className="border-r border-luxury-brown-800 p-2.5 w-[5%] min-w-[85px] text-right whitespace-nowrap">EXTRA BED</th>
                <th colSpan={4} className="p-2 bg-[#2D2214] text-amber-300 font-black tracking-wide whitespace-nowrap">
                  KITCHEN AMOUNT
                </th>
              </tr>

              {/* Header Row 2 */}
              <tr className="bg-luxury-brown-900 text-luxury-gold-300 text-center font-bold border-b-2 border-luxury-brown-950 print:bg-gray-200 print:text-black">
                <th className="border-r border-luxury-brown-800 p-1.5 min-w-[65px] text-right whitespace-nowrap">CASH</th>
                <th className="border-r border-luxury-brown-800 p-1.5 min-w-[65px] text-right whitespace-nowrap">UPI</th>
                <th className="border-r border-luxury-brown-800 p-1.5 min-w-[65px] text-right whitespace-nowrap">ICICI</th>
                <th className="border-r border-luxury-brown-800 p-1.5 min-w-[65px] text-right whitespace-nowrap">UPI</th>
                <th className="border-r border-luxury-brown-800 p-1.5 min-w-[65px] text-right whitespace-nowrap">CASH</th>
                <th className="border-r border-luxury-brown-800 p-1.5 min-w-[55px] text-right whitespace-nowrap">DUE</th>
                <th className="p-1.5 min-w-[90px] text-right whitespace-nowrap">TOTAL FOOD</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-luxury-brown-100/70 bg-white">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-10 text-center bg-luxury-beige-50/20">
                    <div className="max-w-md mx-auto space-y-2.5 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-700 flex items-center justify-center mx-auto">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="font-serif font-bold text-sm sm:text-base text-luxury-brown-950">
                        No Guest Settlements Recorded for {formattedDisplayDate}
                      </div>
                      <p className="text-xs text-luxury-brown-500 font-sans leading-relaxed">
                        There are no active stay collections or checkout transactions registered on this date.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(localTodayStr())}
                        className="mt-2 px-3.5 py-1.5 rounded-lg bg-luxury-brown-950 text-luxury-gold-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-black transition-all"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Jump to Today's Records
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                reportRows.map((r, idx) => (
                  <tr key={r.no} className="hover:bg-amber-50/40 text-center font-medium transition-colors border-b border-luxury-brown-100/60">
                    <td className="p-2 border-r border-luxury-brown-100/70 font-bold text-luxury-brown-900 bg-luxury-beige-50/30">
                      {r.no}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-left font-bold truncate uppercase text-luxury-brown-950">
                      {r.guestName}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 font-bold text-luxury-brown-900">
                      <span className="px-1.5 py-0.5 rounded bg-luxury-beige-100 text-luxury-brown-950 border border-luxury-brown-200">
                        {r.roomNumber}
                      </span>
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono text-slate-500">
                      {(r as any).rackTariff > 0 ? `₹${(r as any).rackTariff.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono font-bold text-luxury-brown-950">
                      {r.roomTariff > 0 ? `₹${r.roomTariff.toLocaleString()}` : '—'}
                      {(r as any).rackTariff > r.roomTariff && (
                        <span className="block text-[9px] text-emerald-700 font-semibold">(-₹{((r as any).rackTariff - r.roomTariff).toLocaleString()})</span>
                      )}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-center font-mono">
                      {r.gst && r.gst !== '0' ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                          {typeof r.gst === 'number' ? `₹${r.gst.toLocaleString()}` : r.gst}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    
                    {/* Room Payment Modes */}
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono text-emerald-700 font-bold">
                      {r.cash > 0 ? `₹${r.cash.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono text-blue-700 font-bold">
                      {r.upi > 0 ? `₹${r.upi.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono text-indigo-700 font-bold">
                      {r.icici > 0 ? `₹${r.icici.toLocaleString()}` : '—'}
                    </td>
                    
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono font-bold">
                      {r.balance > 0 ? (
                        <span className="text-rose-600 font-bold">₹{Number(r.balance || 0).toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600 text-[10px] font-bold">PAID</span>
                      )}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 font-bold text-luxury-brown-700">
                      {r.nights}
                    </td>
                    
                    {/* Amenities */}
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono">
                      {r.waterBottle > 0 ? `₹${r.waterBottle.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono">
                      {r.extraPerson > 0 ? `₹${r.extraPerson.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono">
                      {r.laundry > 0 ? `₹${r.laundry.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono">
                      {r.extraBed > 0 ? `₹${r.extraBed.toLocaleString()}` : '—'}
                    </td>

                    {/* Kitchen Amount */}
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono text-blue-700">
                      {r.kitchenUpi > 0 ? `₹${r.kitchenUpi.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono text-emerald-700">
                      {r.kitchenCash > 0 ? `₹${r.kitchenCash.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 border-r border-luxury-brown-100/70 text-right font-mono text-rose-600 font-bold">
                      {r.kitchenDue > 0 ? `₹${r.kitchenDue.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-2 text-right font-mono font-black text-luxury-brown-950 bg-luxury-beige-50/40">
                      {r.totalFoodAmt > 0 ? `₹${r.totalFoodAmt.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Totals Row */}
            <tfoot>
              <tr className="bg-luxury-brown-950 text-luxury-gold-200 text-center font-extrabold border-t-2 border-luxury-brown-900 print:bg-gray-200 print:text-black">
                <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-xs border-r border-luxury-brown-800">
                  GRAND TOTAL:
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-luxury-brown-800 text-slate-300">
                  ₹{totals.rackTariff.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-luxury-brown-800 font-bold text-luxury-gold-200">
                  ₹{totals.roomTariff.toLocaleString()}
                </td>
                <td className="p-3 text-center font-mono text-xs border-r border-luxury-brown-800">
                  {totals.gst > 0 ? `₹${totals.gst.toLocaleString()}` : '0'}
                </td>
                <td className="p-3 text-right font-mono text-xs text-emerald-300 border-r border-luxury-brown-800">
                  ₹{totals.cash.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-xs text-blue-300 border-r border-luxury-brown-800">
                  ₹{totals.upi.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-xs text-indigo-300 border-r border-luxury-brown-800">
                  ₹{totals.icici.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-xs text-rose-300 border-r border-luxury-brown-800">
                  ₹{Number(totals.balance || 0).toLocaleString()}
                </td>
                <td className="p-3 font-black border-r border-luxury-brown-800">-</td>
                <td className="p-3 text-right font-mono text-xs border-r border-luxury-brown-800">
                  {totals.waterBottle > 0 ? `₹${totals.waterBottle.toLocaleString()}` : '0'}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-luxury-brown-800">
                  {totals.extraPerson > 0 ? `₹${totals.extraPerson.toLocaleString()}` : '0'}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-luxury-brown-800">
                  {totals.laundry > 0 ? `₹${totals.laundry.toLocaleString()}` : '0'}
                </td>
                <td className="p-3 text-right font-mono text-xs border-r border-luxury-brown-800">
                  {totals.extraBed > 0 ? `₹${totals.extraBed.toLocaleString()}` : '0'}
                </td>
                <td className="p-3 text-right font-mono text-xs text-blue-300 border-r border-luxury-brown-800">
                  ₹{totals.kitchenUpi.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-xs text-emerald-300 border-r border-luxury-brown-800">
                  ₹{totals.kitchenCash.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-xs text-rose-300 border-r border-luxury-brown-800">
                  ₹{totals.kitchenDue.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-xs text-luxury-gold-300 font-black">
                  ₹{totals.totalFoodAmt.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* -------------------- DIRTY ROOMS (shown in audit sheet & print) -------------------- */}
        <DirtyRoomsPanel rooms={rooms} checkins={checkins} className="mt-2" />

        {/* -------------------- BOTTOM COUNTER RECONCILIATION & NOTE SECTION -------------------- */}
        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-luxury-brown-950">
          {/* Left Box: Counter Cash Drawer Reconciliation */}
          <div className="border border-luxury-brown-200/90 rounded-2xl bg-white shadow-2xs overflow-hidden">
            <div className="bg-luxury-brown-950 px-4 py-2.5 text-luxury-gold-200 font-serif font-bold text-xs uppercase tracking-wider flex items-center justify-between">
              <span>Counter Cash Drawer Reconciliation</span>
              <Wallet className="w-3.5 h-3.5 text-luxury-gold-400" />
            </div>
            <table className="w-full text-xs font-mono font-medium border-collapse">
              <tbody className="divide-y divide-luxury-brown-100">
                <tr className="hover:bg-luxury-beige-50/40">
                  <td className="p-2.5 font-bold uppercase text-luxury-brown-600">Opening Counter Balance</td>
                  <td className="p-2.5 text-right font-black text-luxury-brown-950">₹{openingBalance.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-luxury-beige-50/40">
                  <td className="p-2.5 font-bold uppercase text-emerald-800">Total Cash Collected (+)</td>
                  <td className="p-2.5 text-right font-black text-emerald-700">₹{totalCashCollected.toLocaleString()}</td>
                </tr>
                <tr className="bg-luxury-beige-100/60 font-black text-luxury-brown-950">
                  <td className="p-2.5 uppercase">Closing Counter Subtotal</td>
                  <td className="p-2.5 text-right font-black">₹{closingCounterSubtotal.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-luxury-beige-50/40">
                  <td className="p-2.5 font-bold uppercase text-rose-800">Expenses Deducted (-)</td>
                  <td className="p-2.5 text-right font-black text-rose-700">
                    {totalExpenseAmt > 0 ? `₹${totalExpenseAmt.toLocaleString()}` : '₹0'}
                  </td>
                </tr>
                <tr className="hover:bg-luxury-beige-50/40">
                  <td className="p-2.5 font-bold uppercase text-luxury-brown-700">{ownerName.toUpperCase()} (Handover) (-)</td>
                  <td className="p-2.5 text-right font-black text-luxury-brown-950">
                    {ownerHandover > 0 ? `₹${ownerHandover.toLocaleString()}` : '—'}
                  </td>
                </tr>
                <tr className="bg-emerald-50 border-t-2 border-emerald-300 !text-emerald-900 font-black text-sm">
                  <td className="p-3 uppercase tracking-wide">Final In-Hand Closing Balance</td>
                  <td className="p-3 text-right font-mono font-black !text-emerald-800 text-base">
                    ₹{finalClosingBalance.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Box: Expense Breakdown Note & Authorization */}
          <div className="border border-luxury-brown-200/90 rounded-2xl bg-luxury-beige-50/40 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-luxury-brown-200 pb-2">
              <span className="text-xs font-serif font-black uppercase text-luxury-brown-950 tracking-wider">
                Daily Note & Settlement Details
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded-full border border-emerald-300">
                Audit Verified
              </span>
            </div>
            
            <div className="p-3 bg-white rounded-xl border border-luxury-brown-200 min-h-[64px] flex items-center">
              <p className="text-xs font-mono font-bold text-luxury-brown-900 uppercase leading-relaxed">
                {activeExpenseNote || 'No special daily notes logged for this audit session.'}
              </p>
            </div>

            <div className="pt-3 text-[11px] text-luxury-brown-500 font-mono grid grid-cols-2 gap-4 border-t border-luxury-brown-200/80">
              <div className="border-t-2 border-dashed border-luxury-brown-300 pt-1 text-center">
                <span className="font-bold text-luxury-brown-800 block">Duty Manager</span>
                <span className="text-[10px] text-luxury-brown-400">Signature & Clearance</span>
              </div>
              <div className="border-t-2 border-dashed border-luxury-brown-300 pt-1 text-center">
                <span className="font-bold text-luxury-brown-800 block">Receptionist / Cashier</span>
                <span className="text-[10px] text-luxury-brown-400">Drawer Reconciliation</span>
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
