import React, { useState, useMemo } from 'react';
import {
  Room, Booking, GuestCheckIn, Invoice, UserRole, WaterBottleRecord, Expense, Staff,
  InventoryProduct, InventoryStockMovement, AllocatedGuestService, ExtraCharge
} from '../types';
import { showToast } from '../utils/toast';
import { 
  LayoutDashboard, Users, DoorOpen, CalendarCheck, CreditCard, Banknote, 
  ShieldAlert, ArrowUpRight, TrendingUp, Sparkles, GlassWater, Eye, CheckCheck, RefreshCw, Hammer, AlertTriangle, ShieldCheck,
  Brain, HelpCircle, Loader2, UserCheck, UserX, Briefcase, Headphones, UserPlus
} from 'lucide-react';

interface DashboardViewProps {
  rooms: Room[];
  bookings: Booking[];
  checkins: GuestCheckIn[];
  invoices: Invoice[];
  expenses?: Expense[];
  staff?: Staff[];
  currentRole: UserRole;
  loggedInUser?: string;
  setActiveTab: (tab: string) => void;
  setSelectedBookingForCheckin?: (booking: Booking | null) => void;
  setSelectedBookingForInvoice?: (booking: Booking | null) => void;
  waterBottles: WaterBottleRecord[];
  onUpdateWaterBottles: (records: WaterBottleRecord[]) => void;
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  inventoryProducts?: InventoryProduct[];
  onUpdateInventoryProducts?: (items: InventoryProduct[]) => void;
  inventoryStockMovements?: InventoryStockMovement[];
  onUpdateInventoryMovements?: (items: InventoryStockMovement[]) => void;
  selectedHotelId?: string;
  hotelName?: string;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function DashboardView({
  rooms,
  bookings,
  checkins,
  invoices,
  expenses = [],
  staff = [],
  currentRole,
  loggedInUser,
  setActiveTab,
  setSelectedBookingForCheckin,
  setSelectedBookingForInvoice,
  waterBottles,
  onUpdateWaterBottles,
  onUpdateRooms,
  onUpdateCheckins,
  inventoryProducts = [],
  onUpdateInventoryProducts,
  inventoryStockMovements = [],
  onUpdateInventoryMovements,
  selectedHotelId,
  hotelName,
  onAddAuditLog
}: DashboardViewProps) {
  const [chartTimeframe, setChartTimeframe] = useState<'week' | 'month'>('week');
  const [activeControlTab, setActiveControlTab] = useState<'water' | 'housekeeping'>('water');
  const [isSaraiModalOpen, setIsSaraiModalOpen] = useState(false);

  // AI Advisor Interactive states
  const [selectedAiType, setSelectedAiType] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAiDemoMode, setIsAiDemoMode] = useState(false);

  // Interactive local form states
  const [logRoom, setLogRoom] = useState('');
  const [logBottleCount, setLogBottleCount] = useState(2);
  const [logIsChargeable, setLogIsChargeable] = useState(false);
  const [logUnitPrice, setLogUnitPrice] = useState(30);
  const [hkRoom, setHkRoom] = useState('');
  const [hkStatus, setHkStatus] = useState<'Available' | 'Occupied' | 'Reserved' | 'Maintenance' | 'Dirty' | 'Blocked'>('Dirty');
  const [opsSuccess, setOpsSuccess] = useState('');

  const todayStr = new Date().toISOString().substring(0, 10); // dynamic reference clock date
  const [saraiFromDate, setSaraiFromDate] = useState<string>(todayStr);
  const [saraiToDate, setSaraiToDate] = useState<string>(todayStr);

  // Active hotel subscription / 7-Day Free Trial info
  const activeHotelTrialInfo = React.useMemo(() => {
    try {
      const currentId = selectedHotelId || (typeof window !== 'undefined' && sessionStorage.getItem('pms_hotel_id')) || '';
      const raw = typeof window !== 'undefined' ? localStorage.getItem('pms_hotels') : null;
      if (!raw || !currentId) return null;
      const list = JSON.parse(raw);
      const found = Array.isArray(list) ? list.find((h: any) => h.id === currentId) : null;
      if (!found || found.plan !== 'Trial') return null;
      const expiryStr = found.subscriptionExpiryDate || todayStr;
      const startDateObj = new Date(expiryStr);
      startDateObj.setDate(startDateObj.getDate() - 7);
      const startStr = found.createdDate || startDateObj.toISOString().substring(0, 10);
      const diffMs = new Date(expiryStr + 'T23:59:59').getTime() - Date.now();
      const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return {
        plan: found.plan,
        startStr,
        expiryStr,
        remainingDays,
        isExpired: diffMs < 0
      };
    } catch {
      return null;
    }
  }, [selectedHotelId, todayStr]);

  const saraiFilteredCheckins = checkins.filter(c => {
    const inDate = (c.checkInDate || '').substring(0, 10);
    const outDate = (c.checkedOutDateTime ? c.checkedOutDateTime.substring(0, 10) : c.checkOutDate || inDate).substring(0, 10);
    return (inDate <= saraiToDate && outDate >= saraiFromDate) || (inDate >= saraiFromDate && inDate <= saraiToDate);
  });

  const handleExportSaraiCSV = () => {
    let csv = `${hotelName || 'DIRECTSTAY PMS'},FORM C / POLICE SARAI COMPLIANCE REGISTER\n`;
    csv += `Audit Period,${saraiFromDate} to ${saraiToDate}\n\n`;
    csv += `S.No,Room,Guest Name,Mobile,Additional Occupants,Nationality,ID Document,Permanent Address,Check-In Date,Check-Out Date,Vehicle No,Company\n`;
    saraiFilteredCheckins.forEach((c, idx) => {
      const companions = (c.secondaryGuests || []).map(sg => `${sg.fullName} (${sg.aadhaarNumber || sg.passportNumber || 'N/A'})`).join(' | ');
      const idDoc = `Aadhaar: ${c.aadhaarNumber || 'N/A'}${c.passportNumber ? ` / Passport: ${c.passportNumber}` : ''}`;
      const addr = `${c.address || ''} ${c.city || ''} ${c.state || ''}`.replace(/"/g, '""').trim();
      csv += `${idx + 1},"Rm ${c.roomNumber}","${(c.guestName || '').replace(/"/g, '""')}","${c.mobile || ''}","${companions.replace(/"/g, '""')}","${c.nationality || 'Indian'}","${idDoc}","${addr}","${c.checkInDate || ''}","${c.checkOutDate || ''}","${c.vehicleNumber || 'None'}","${(c.companyName || 'None').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sarai_FormC_${saraiFromDate}_to_${saraiToDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 1. STATS CALCULATIONS
  const totalRoomsCount = rooms.length;
  const occupiedRoomsCount = rooms.filter(r => r.status === 'Occupied').length;
  const availableRoomsCount = rooms.filter(r => r.status === 'Available').length;
  const dirtyRoomsCount = rooms.filter(r => r.status === 'Dirty').length;
  const blockedRoomsCount = rooms.filter(r => r.status === 'Blocked').length;
  const maintenanceRoomsCount = rooms.filter(r => r.status === 'Maintenance').length;
  const reservedRoomsCount = rooms.filter(r => r.status === 'Reserved').length;

  const occupancyRate = totalRoomsCount > 0 ? Math.round((occupiedRoomsCount / totalRoomsCount) * 100) : 0;

  // Expected checkins today
  const todayCheckinsCount = bookings.filter(b => b.checkInDate === todayStr && b.status === 'Confirmed' && !b.isCheckedIn).length;
  // Expected checkouts today
  const todayCheckoutsCount = bookings.filter(b => b.checkOutDate === todayStr && b.status === 'Confirmed' && b.isCheckedIn).length;
  // Upcoming bookings
  const advanceBookingsCount = bookings.filter(b => b.checkInDate > todayStr && b.status === 'Confirmed').length;

  // Total Guests In-House logic (Primary + Companion list lengths)
  const totalGuestsInHouse = bookings
    .filter(b => b.isCheckedIn && b.status === 'Confirmed')
    .reduce((sum, b) => {
      const record = checkins.find(c => c.id === b.id || c.roomNumber === b.roomNumber);
      const companionsCount = record?.secondaryGuests?.length || 0;
      return sum + 1 + companionsCount;
    }, 0);

  // Water bottle consumption
  const todayWaterBottlesConsumed = waterBottles
    .filter(wb => wb.date === todayStr)
    .reduce((sum, wb) => sum + wb.quantity, 0);

  const totalWaterBottlesConsumed = waterBottles.reduce((sum, wb) => sum + wb.quantity, 0);

  // Active (non-superseded) invoices for revenue accounting
  const activeInvoices = useMemo(
    () => (invoices || []).filter(inv => !inv.isSuperseded && inv.invoiceStatus !== 'Superseded'),
    [invoices]
  );

  // Revenue sums
  const todayRevenue = activeInvoices
    .filter(inv => inv.dateCreated === todayStr)
    .reduce((sum, inv) => sum + inv.finalAmount, 0) + 
    bookings.filter(b => b.checkInDate === todayStr).reduce((sum, b) => sum + b.advanceAmount, 0);

  const monthlyRevenue = activeInvoices.reduce((sum, inv) => sum + inv.finalAmount, 0);

  // Cash vs Online
  const cashCollection = checkins.reduce((sum, c) => sum + c.cashAmountPaid, 0) + 
    bookings.filter(b => b.paymentMethod === 'Cash').reduce((sum, b) => sum + b.advanceAmount, 0);

  const onlineCollection = checkins.reduce((sum, c) => sum + c.onlineAmountPaid, 0) + 
    bookings.filter(b => b.paymentMethod !== 'Cash').reduce((sum, b) => sum + b.advanceAmount, 0);

  // Pending payments
  const pendingPayments = checkins.reduce((sum, c) => sum + c.pendingAmount, 0) +
    activeInvoices.filter(inv => !inv.isPaid).reduce((sum, inv) => sum + inv.finalAmount, 0);

  // Staff statistics calculation (excluding Hotel Admin accounts)
  const nonAdminStaff = (staff || []).filter(s => 
    s.department !== 'Admin' && 
    !s.designation?.toLowerCase().includes('admin') && 
    s.role !== 'Admin' &&
    s.role !== 'SuperAdmin'
  );

  const totalStaffCount = nonAdminStaff.length;
  const activeStaffCount = nonAdminStaff.filter(s => s.status === 'Active').length;
  const inactiveStaffCount = nonAdminStaff.filter(s => s.status === 'Inactive').length;

  const managersCount = nonAdminStaff.filter(s => {
    const dep = s.department;
    const des = (s.designation || '').toLowerCase();
    const role = (s.role || '').toLowerCase();
    return dep === 'Manager' || des.includes('manager') || role.includes('manager');
  }).length;

  const receptionistsCount = nonAdminStaff.filter(s => {
    const dep = s.department;
    const des = (s.designation || '').toLowerCase();
    const role = (s.role || '').toLowerCase();
    return dep === 'Reception' || des.includes('reception') || des.includes('front desk') || role.includes('reception');
  }).length;

  const housekeepingCount = nonAdminStaff.filter(s => {
    const dep = s.department;
    const des = (s.designation || '').toLowerCase();
    const role = (s.role || '').toLowerCase();
    return dep === 'Housekeeping' || des.includes('housekeep') || role.includes('housekeep');
  }).length;

  const cashiersCount = nonAdminStaff.filter(s => {
    const dep = s.department;
    const des = (s.designation || '').toLowerCase();
    const role = (s.role || '').toLowerCase();
    return dep === 'Accounts' || des.includes('cashier') || des.includes('account') || role.includes('cashier');
  }).length;

  const otherStaffCount = nonAdminStaff.filter(s => {
    const dep = s.department;
    const des = (s.designation || '').toLowerCase();
    const role = (s.role || '').toLowerCase();
    const isManager = dep === 'Manager' || des.includes('manager') || role.includes('manager');
    const isReception = dep === 'Reception' || des.includes('reception') || des.includes('front desk') || role.includes('reception');
    const isHK = dep === 'Housekeeping' || des.includes('housekeep') || role.includes('housekeep');
    const isCashier = dep === 'Accounts' || des.includes('cashier') || des.includes('account') || role.includes('cashier');
    return !isManager && !isReception && !isHK && !isCashier;
  }).length;

  // Helper to compute revenue dynamically
  const getRevenueForDate = (dateStr: string) => {
    const invAmt = activeInvoices
      .filter(inv => inv.dateCreated === dateStr)
      .reduce((sum, inv) => sum + inv.finalAmount, 0);
    const bookingAmt = bookings
      .filter(b => b.checkInDate === dateStr)
      .reduce((sum, b) => sum + b.advanceAmount, 0);
    return invAmt + bookingAmt;
  };

  const getRevenueForMonth = (monthPrefix: string) => {
    const invAmt = activeInvoices
      .filter(inv => inv.dateCreated && inv.dateCreated.startsWith(monthPrefix))
      .reduce((sum, inv) => sum + inv.finalAmount, 0);
    const bookingAmt = bookings
      .filter(b => b.checkInDate && b.checkInDate.startsWith(monthPrefix))
      .reduce((sum, b) => sum + b.advanceAmount, 0);
    return invAmt + bookingAmt;
  };

  // Chart configurations
  const dailyRevenueData = [
    { label: 'Mon 09', amount: getRevenueForDate('2026-06-09') },
    { label: 'Tue 10', amount: getRevenueForDate('2026-06-10') },
    { label: 'Wed 11', amount: getRevenueForDate('2026-06-11') },
    { label: 'Thu 12', amount: getRevenueForDate('2026-06-12') },
    { label: 'Fri 13', amount: getRevenueForDate('2026-06-13') },
    { label: 'Sat 14', amount: getRevenueForDate('2026-06-14') },
    { label: 'Sun 15 (Today)', amount: todayRevenue }
  ];

  const monthlyRevenueData = [
    { label: 'Mar 26', amount: getRevenueForMonth('2026-03') },
    { label: 'Apr 26', amount: getRevenueForMonth('2026-04') },
    { label: 'May 26', amount: getRevenueForMonth('2026-05') },
    { label: 'Jun 26 (Current)', amount: monthlyRevenue }
  ];

  const activeChartData = chartTimeframe === 'week' ? dailyRevenueData : monthlyRevenueData;
  const maxAmount = Math.max(...activeChartData.map(d => d.amount), 1000);

  // 2. FORM ACTIONS CALLBACKS
  const activeCheckins = checkins.filter(c => !c.checkedOutDateTime);
  const getActiveStayForRoom = (roomNo: string): GuestCheckIn | undefined => {
    if (!roomNo) return undefined;
    return activeCheckins.find(
      c =>
        String(c.roomNumber).trim() === String(roomNo).trim() ||
        (c.bookedRooms || []).some(br => String(br.roomNumber).trim() === String(roomNo).trim())
    );
  };
  const occupiedRoomsWithStay = rooms.filter(r => Boolean(getActiveStayForRoom(r.number)));
  const waterBottleInventoryProduct = inventoryProducts.find(
    p =>
      p.name.toLowerCase().includes('water bottle') ||
      p.name.toLowerCase().includes('mineral water') ||
      p.name.toLowerCase() === 'water' ||
      (p.sku && p.sku.toUpperCase().includes('WATER'))
  );

  const handleLogWaterBottleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logRoom) {
      showToast('Please select an occupied room.', 'warning');
      return;
    }
    const qty = Math.max(0, Math.floor(Number(logBottleCount) || 0));
    if (qty <= 0) {
      showToast('Please enter a valid water bottle quantity (>= 1).', 'warning');
      return;
    }

    const activeStay = getActiveStayForRoom(logRoom);
    if (!activeStay) {
      showToast(`Room ${logRoom} does not have an active checked-in guest stay.`, 'error');
      return;
    }

    if (waterBottleInventoryProduct && waterBottleInventoryProduct.currentStock < qty) {
      showToast(
        `Note: Store stock for "${waterBottleInventoryProduct.name}" is low (${waterBottleInventoryProduct.currentStock} ${waterBottleInventoryProduct.unit || 'Bottles'}). Logging issue to Room ${logRoom}.`,
        'info'
      );
    }

    const currentHotelId =
      selectedHotelId ||
      (typeof window !== 'undefined' && sessionStorage.getItem('pms_hotel_id')) ||
      activeStay.hotelId ||
      'hotel-1';

    const recordId = `WB-ADD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const unitPrice = logIsChargeable ? Math.max(0, Number(logUnitPrice) || 30) : 0;
    const totalAmount = logIsChargeable ? parseFloat((qty * unitPrice).toFixed(2)) : 0;
    const folioChargeId = logIsChargeable && totalAmount > 0 ? `EC-WB-${recordId}` : undefined;
    const nowIso = new Date().toISOString();
    const nowTimeStr = nowIso.replace('T', ' ').substring(0, 16);
    const actorLabel = loggedInUser || currentRole || 'Front Desk Staff';

    if (waterBottleInventoryProduct && onUpdateInventoryProducts) {
      const prevStock = Number(waterBottleInventoryProduct.currentStock) || 0;
      const newStock = Math.max(0, prevStock - qty);
      const minAlert = Number(waterBottleInventoryProduct.minStockAlert) || 0;
      const newStatus: InventoryProduct['status'] =
        newStock <= 0 ? 'Out of Stock' : newStock <= minAlert ? 'Low Stock' : 'In Stock';

      onUpdateInventoryProducts(
        inventoryProducts.map(p =>
          p.id === waterBottleInventoryProduct.id
            ? { ...p, currentStock: newStock, status: newStatus, lastUpdated: nowIso }
            : p
        )
      );

      if (onUpdateInventoryMovements) {
        const movement: InventoryStockMovement = {
          id: `MOV-WB-${recordId}`,
          productId: waterBottleInventoryProduct.id,
          productName: waterBottleInventoryProduct.name,
          type: 'OUT',
          quantity: qty,
          previousStock: prevStock,
          newStock,
          date: todayStr,
          time: new Date().toLocaleTimeString(),
          referenceType: 'Housekeeping',
          referenceId: recordId,
          notes: `Water Bottle allocation (${logIsChargeable ? `Chargeable ₹${totalAmount}` : 'Complimentary ₹0'}) to Room ${logRoom} (${activeStay.guestName})`,
          performedBy: actorLabel,
          hotelId: currentHotelId
        };
        onUpdateInventoryMovements([movement, ...inventoryStockMovements]);
      }
    }

    const newRecord: WaterBottleRecord = {
      id: recordId,
      hotelId: currentHotelId,
      roomNumber: logRoom,
      guestName: activeStay.guestName,
      checkInId: activeStay.id,
      checkinId: activeStay.id,
      quantity: qty,
      date: todayStr,
      type: logIsChargeable ? 'Chargeable' : 'Complimentary',
      isChargeable: logIsChargeable,
      unitPrice,
      totalAmount,
      chargeAmount: totalAmount,
      folioChargeId,
      deliveredBy: actorLabel,
      dateTime: nowTimeStr,
      recordType: 'water'
    };
    onUpdateWaterBottles([newRecord, ...waterBottles]);

    if (onUpdateCheckins) {
      const allocEntry: AllocatedGuestService = {
        id: `ALLOC-WB-${recordId}`,
        hotelId: currentHotelId,
        serviceId: 'WATER-BOTTLE',
        serviceName: logIsChargeable
          ? `Water Bottles (${qty} x ₹${unitPrice})`
          : `Water Bottles (${qty} - Complimentary)`,
        configuredAmount: totalAmount,
        chargedAmount: totalAmount,
        isChargeable: Boolean(logIsChargeable && totalAmount > 0),
        roomNumber: logRoom,
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

        if (logIsChargeable && totalAmount > 0 && folioChargeId) {
          const extraCharge: ExtraCharge = {
            id: folioChargeId,
            description: `Chargeable Water Bottles (${qty} x ₹${unitPrice})`,
            amount: totalAmount,
            date: todayStr,
            dateTime: nowTimeStr,
            addedBy: actorLabel,
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

        return {
          ...c,
          allocatedServices: nextAllocated
        };
      });

      onUpdateCheckins(updatedCheckins);
    }

    onAddAuditLog?.(
      'Water Bottle Allocated',
      `Allocated ${qty} mineral water bottle(s) to Room ${logRoom} (${activeStay.guestName}) as ${
        logIsChargeable ? `Chargeable (₹${totalAmount})` : 'Complimentary (₹0)'
      }.`
    );
    setLogRoom('');
    setLogIsChargeable(false);
    setOpsSuccess(
      logIsChargeable
        ? `Allocated ${qty} chargeable water bottle(s) to Room ${logRoom}. ₹${totalAmount} added to folio!`
        : `Allocated ${qty} complimentary water bottle(s) to Room ${logRoom} (₹0 charged)!`
    );
    setTimeout(() => setOpsSuccess(''), 4000);
  };

  const handleUpdateRoomStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hkRoom) {
      showToast('Locate target room directory.', 'warning');
      return;
    }
    const updated = rooms.map(r => r.number === hkRoom ? { ...r, status: hkStatus } : r);
    onUpdateRooms(updated);
    onAddAuditLog?.(
      'Room Status Updated',
      `Room ${hkRoom} status updated to ${hkStatus} via Dashboard quick control.`
    );
    setHkRoom('');
    setOpsSuccess(`Room ${hkRoom} space successfully pivoted to ${hkStatus}!`);
    setTimeout(() => setOpsSuccess(''), 4000);
  };

  const todayArrivals = bookings.filter(b => b.checkInDate === todayStr && b.status === 'Confirmed');
  const todayDepartures = bookings.filter(b => b.checkOutDate === todayStr && b.status === 'Confirmed');

  // Trigger Gemini/Demo analytics engine call
  const triggerAiAnalysis = async (type: string) => {
    setSelectedAiType(type);
    setAiLoading(true);
    setAiResult(null);
    setIsAiDemoMode(false);

    let payload: any = {};
    if (type === 'revenue') {
      payload = {
        todayRevenue,
        monthlyRevenue,
        pendingPayments,
        invoicesCount: activeInvoices.length,
        averageInvoiceAmount: activeInvoices.length > 0 ? Math.round(monthlyRevenue / activeInvoices.length) : 0,
        invoicedSum: activeInvoices.reduce((s, i) => s + i.finalAmount, 0)
      };
    } else if (type === 'occupancy') {
      payload = {
        occupiedRoomsCount,
        availableRoomsCount,
        dirtyRoomsCount,
        maintenanceRoomsCount,
        reservedRoomsCount,
        totalRooms: rooms.length,
        occupancyRate
      };
    } else if (type === 'forecast') {
      payload = {
        todayStr,
        sourceCounts: bookings.reduce((acc: any, b) => {
          acc[b.bookingSource] = (acc[b.bookingSource] || 0) + 1;
          return acc;
        }, {}),
        upcomingNightsMap: bookings.slice(0, 10).map(b => ({
          roomNumber: b.roomNumber,
          roomType: b.roomType,
          nights: b.nights,
          source: b.bookingSource
        }))
      };
    } else if (type === 'monthly') {
      payload = {
        monthlyRevenue,
        cashCollection,
        onlineCollection,
        pendingPayments,
        totalReservations: bookings.length
      };
    } else if (type === 'expense') {
      payload = {
        monthlyRevenue,
        totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
        expensesByCategory: expenses.reduce((acc: any, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        }, {})
      };
    }

    try {
      const response = await fetch('/api/ai/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: payload })
      });
      const resData = await response.json();
      setAiResult(resData.text);
      setIsAiDemoMode(resData.isDemo || false);
    } catch (err: any) {
      setAiResult(`### ⚠️ Connection Lost\nCould not compile analytical parameters. Error details: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 7-Day Free Trial Status & Countdown Banner (Shown when hotel is on 7-Day Free Trial) */}
      {activeHotelTrialInfo && (
        <div className={`rounded-2xl p-4 border shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          activeHotelTrialInfo.remainingDays <= 2
            ? 'bg-gradient-to-r from-amber-950 via-luxury-brown-900 to-amber-950 border-amber-500/50 text-white'
            : 'bg-gradient-to-r from-luxury-brown-950 via-luxury-brown-900 to-luxury-brown-950 border-luxury-gold-500/40 text-white'
        }`}>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest font-bold bg-[#D4AF37] text-black">
                7-Day Free Trial Active
              </span>
              <span className="text-xs font-mono text-luxury-gold-300">
                Trial Start: <strong>{activeHotelTrialInfo.startStr}</strong> • Trial Expiry: <strong>{activeHotelTrialInfo.expiryStr}</strong>
              </span>
            </div>
            <p className="text-xs text-luxury-beige-200">
              {activeHotelTrialInfo.isExpired
                ? 'Your 7-day free trial has expired. Your hotel data is 100% safe — upgrade to a monthly, 6-month, or annual plan to continue uninterrupted operations.'
                : `You have ${activeHotelTrialInfo.remainingDays} day${activeHotelTrialInfo.remainingDays === 1 ? '' : 's'} remaining in your 7-day free trial. All rooms, bookings, and billing data remain saved when you upgrade.`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-luxury-gold-500/30 text-center">
              <span className="block text-lg font-serif font-bold text-[#D4AF37] leading-none">{activeHotelTrialInfo.remainingDays}</span>
              <span className="text-[9px] uppercase font-mono tracking-wider text-gray-300">Days Left</span>
            </div>
            <button
              onClick={() => setActiveTab('subscription')}
              className="px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29d2f] text-black font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              Upgrade Subscription →
            </button>
          </div>
        </div>
      )}

      {/* Upper Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-luxury-brown-900 border border-luxury-gold-500/20 rounded-2xl p-6 text-white overflow-hidden relative shadow-lg">
        <div className="absolute right-0 top-0 w-80 h-80 bg-radial from-luxury-gold-500/10 to-transparent pointer-events-none rounded-full" />
        <div className="z-10 space-y-2">
          <div className="flex items-center gap-2 text-luxury-gold-300 font-medium">
            <Sparkles className="w-4 h-4 animate-pulse text-luxury-gold-400" />
            <span className="text-xs uppercase tracking-widest font-mono">{hotelName || 'Hotel'} PMS Workspace</span>
          </div>
          <h1 className="text-3xl font-serif tracking-wide font-medium">
            {hotelName || 'Hotel Hub'}: <span className="text-luxury-gold-300 capitalize">{currentRole.toLowerCase()} control panel</span>
          </h1>
          <p className="text-luxury-brown-200 text-xs max-w-xl">
            Reference operating clock set on: <span className="text-white font-mono font-bold">{todayStr}</span>. Operating with authority of <strong className="text-luxury-gold-300 capitalize">{currentRole}</strong>.
          </p>
        </div>
        <div className="mt-4 md:mt-0 z-10 flex gap-2.5 flex-wrap">
          <button 
            onClick={() => setActiveTab('todayBookings')} 
            className="px-4 py-2 rounded-lg bg-[#15805D] hover:bg-[#166534] text-white font-serif font-semibold text-xs transition-all flex items-center gap-1.5 shadow"
          >
            Today's Desk
          </button>
          <button 
            onClick={() => setActiveTab('checkin')} 
            className="px-4 py-2.5 rounded-lg bg-[#C49A3A] hover:bg-[#B0862B] text-[#17120F] font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
          >
            Check-In Desk <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setActiveTab('rooms')} 
            className="px-4 py-2.5 rounded-lg border border-luxury-gold-500/30 bg-luxury-gold-500/20 hover:bg-luxury-gold-500/30 text-luxury-gold-200 font-serif font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
          >
            Room Management
          </button>
          <button 
            onClick={() => setActiveTab('calendar')} 
            className="px-4 py-2.5 rounded-lg border border-luxury-brown-300/30 bg-luxury-brown-800 hover:bg-luxury-brown-700 text-luxury-beige-100 font-medium text-xs transition-all flex items-center gap-1.5"
          >
            Room Matrix
          </button>
        </div>
      </div>

      {/* 7 QUICK ACTIONS BUTTONS */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm no-print space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700"><Sparkles className="w-4 h-4" /></span>
            Operational Fast-Track
          </h3>
          <span className="text-[11px] font-mono text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md font-bold">7 Instant Hotkeys</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <button
            onClick={() => setActiveTab('bookings')}
            className="flex flex-col items-center justify-center p-4 bg-slate-50/80 hover:bg-amber-50 border-2 border-slate-200/90 hover:border-amber-400 rounded-xl transition-all duration-200 group text-center cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-amber-100/80 text-amber-700 mb-2 transition-transform group-hover:scale-110">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <span className="text-sm font-sans font-extrabold text-slate-900 block leading-tight">Advance Booking</span>
            <span className="text-[10px] font-mono font-semibold text-slate-500 mt-1 leading-none">Reservations Desk</span>
          </button>
          
          <button
            onClick={() => setActiveTab('checkin')}
            className="flex flex-col items-center justify-center p-4 bg-slate-50/80 hover:bg-amber-50 border-2 border-slate-200/90 hover:border-amber-400 rounded-xl transition-all duration-200 group text-center cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-yellow-100/80 text-yellow-800 mb-2 transition-transform group-hover:scale-110">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-sm font-sans font-extrabold text-slate-900 block leading-tight">New Check-In</span>
            <span className="text-[10px] font-mono font-semibold text-slate-500 mt-1 leading-none">Instant Entry</span>
          </button>

          <button
            onClick={() => {
              setSelectedBookingForInvoice?.(null);
              setActiveTab('todayBookings');
            }}
            className="flex flex-col items-center justify-center p-4 bg-slate-50/80 hover:bg-teal-50 border-2 border-slate-200/90 hover:border-teal-400 rounded-xl transition-all duration-200 group text-center cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-teal-100/80 text-teal-700 mb-2 transition-transform group-hover:scale-110">
              <DoorOpen className="w-5 h-5" />
            </div>
            <span className="text-sm font-sans font-extrabold text-slate-900 block leading-tight">New Check-Out</span>
            <span className="text-[10px] font-mono font-semibold text-slate-500 mt-1 leading-none">Settle Account</span>
          </button>

          <button
            onClick={() => {
              setActiveControlTab('water');
              setTimeout(() => {
                document.getElementById('operations-log')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="flex flex-col items-center justify-center p-4 bg-slate-50/80 hover:bg-blue-50 border-2 border-slate-200/90 hover:border-blue-400 rounded-xl transition-all duration-200 group text-center cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-blue-100/80 text-blue-700 mb-2 transition-transform group-hover:scale-110">
              <GlassWater className="w-5 h-5" />
            </div>
            <span className="text-sm font-sans font-extrabold text-slate-900 block leading-tight">Add Water Bottle</span>
            <span className="text-[10px] font-mono font-semibold text-slate-500 mt-1 leading-none">Log Consumption</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className="flex flex-col items-center justify-center p-4 bg-slate-50/80 hover:bg-orange-50 border-2 border-slate-200/90 hover:border-orange-400 rounded-xl transition-all duration-200 group text-center cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-orange-100/80 text-orange-700 mb-2 transition-transform group-hover:scale-110">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-sm font-sans font-extrabold text-slate-900 block leading-tight">Add Expense</span>
            <span className="text-[10px] font-mono font-semibold text-slate-500 mt-1 leading-none">Post Outflows</span>
          </button>

          <button
            onClick={() => setActiveTab('invoice')}
            className="flex flex-col items-center justify-center p-4 bg-slate-50/80 hover:bg-emerald-50 border-2 border-slate-200/90 hover:border-emerald-400 rounded-xl transition-all duration-200 group text-center cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="p-2.5 rounded-xl bg-emerald-100/80 text-emerald-700 mb-2 transition-transform group-hover:scale-110">
              <Banknote className="w-5 h-5" />
            </div>
            <span className="text-sm font-sans font-extrabold text-slate-900 block leading-tight">Generate Invoice</span>
            <span className="text-[10px] font-mono font-semibold text-slate-500 mt-1 leading-none">Bill Generation</span>
          </button>

          <button
            onClick={() => setIsSaraiModalOpen(true)}
            className="flex flex-col items-center justify-center p-4 bg-[#17120F] hover:bg-[#1E1713] border-2 border-[#C49A3A]/50 rounded-xl transition-all duration-200 group text-center shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-[#C49A3A]/20 text-[#C49A3A] mb-2 transition-transform group-hover:scale-110">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-sm font-sans font-extrabold text-luxury-gold-300 block leading-tight">Sarai Report</span>
            <span className="text-[10px] font-mono font-semibold text-[#C49A3A] mt-1 leading-none">Police Form C</span>
          </button>
        </div>
      </div>

      {/* Specialty Dashboard for HOTEL OWNER */}
      {currentRole === 'Owner' && (
        <div className="bg-[#17120F] border border-[#C49A3A]/25 p-6 rounded-2xl text-white space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-luxury-gold-500/20 pb-4 gap-2">
            <div className="flex items-center gap-2.5">
              <Brain className="w-6 h-6 text-[#C49A3A] animate-pulse" />
              <div>
                <h2 className="text-base font-serif font-bold text-luxury-gold-100">Boutique Executive Advisor Core</h2>
                <p className="text-[10px] text-luxury-gold-300/70 font-mono">Consolidated parameters & live AI intelligence</p>
              </div>
            </div>
            <span className="text-[10px] bg-luxury-gold-500/10 border border-[#C49A3A]/40 text-luxury-gold-300 rounded-lg px-2.5 py-1 font-mono uppercase tracking-wider">
              Secure Owner audit
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3.5 bg-[#231B16] rounded-xl border border-luxury-brown-800">
              <span className="text-[10px] text-gray-400 uppercase">Average Daily Tariff (ADR)</span>
              <p className="text-xl font-serif font-bold text-[#C49A3A] mt-1 font-mono">
                ₹{occupiedRoomsCount > 0 ? Math.round(todayRevenue / occupiedRoomsCount).toLocaleString() : '0'}
              </p>
              <span className="text-[9px] text-[#C49A3A] font-sans">Across active stays</span>
            </div>
            <div className="p-3.5 bg-[#231B16] rounded-xl border border-luxury-brown-800">
              <span className="text-[10px] text-gray-400 uppercase">RevPAR (Rev/Avail Rm)</span>
              <p className="text-xl font-serif font-bold text-[#15805D] mt-1 font-mono">₹{(todayRevenue / (totalRoomsCount || 1)).toFixed(0)}</p>
              <span className="text-[9px] text-gray-500 font-sans">Active room division yield</span>
            </div>
            <div className="p-3.5 bg-[#231B16] rounded-xl border border-luxury-brown-800">
              <span className="text-[10px] text-gray-400 uppercase">Cash Reserve Liquidity %</span>
              <p className="text-xl font-serif font-bold text-white mt-1 font-mono">
                {cashCollection + onlineCollection > 0 ? Math.round((cashCollection / (cashCollection + onlineCollection)) * 100) : 0}%
              </p>
              <span className="text-[9px] text-gray-400 font-mono text-ellipsis overflow-hidden block">Vault: ₹{cashCollection.toLocaleString()}</span>
            </div>
            <div className="p-3.5 bg-[#231B16] rounded-xl border border-luxury-brown-800">
              <span className="text-[10px] text-gray-400 uppercase">Dynamic In-House Guests</span>
              <p className="text-xl font-serif font-bold text-[#C49A3A] mt-1 font-mono">{totalGuestsInHouse} Guests</p>
              <span className="text-[9px] text-emerald-400 font-sans">Active companion index</span>
            </div>
          </div>

          {/* AI Features Interactive Hotkeys Grid */}
          <div className="space-y-3 pt-3 border-t border-luxury-gold-500/10">
            <h3 className="text-xs font-mono uppercase tracking-wider text-luxury-gold-300 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Execute AI Operational Analysis:
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-mono">
              <button
                onClick={() => triggerAiAnalysis('revenue')}
                className={`px-3 py-2.5 rounded-xl border font-bold tracking-wide transition-all cursor-pointer ${
                  selectedAiType === 'revenue' 
                    ? 'bg-[#C49A3A] text-[#17120F] border-[#C49A3A]' 
                    : 'bg-[#231B16] hover:bg-[#2F241E] text-white border-luxury-brown-800'
                }`}
              >
                AI Revenue Summary
              </button>
              <button
                onClick={() => triggerAiAnalysis('occupancy')}
                className={`px-3 py-2.5 rounded-xl border font-bold tracking-wide transition-all cursor-pointer ${
                  selectedAiType === 'occupancy' 
                    ? 'bg-[#C49A3A] text-[#17120F] border-[#C49A3A]' 
                    : 'bg-[#231B16] hover:bg-[#2F241E] text-white border-luxury-brown-800'
                }`}
              >
                AI Occupancy Analysis
              </button>
              <button
                onClick={() => triggerAiAnalysis('forecast')}
                className={`px-3 py-2.5 rounded-xl border font-bold tracking-wide transition-all cursor-pointer ${
                  selectedAiType === 'forecast' 
                    ? 'bg-[#C49A3A] text-[#17120F] border-[#C49A3A]' 
                    : 'bg-[#231B16] hover:bg-[#2F241E] text-white border-luxury-brown-800'
                }`}
              >
                AI Booking Forecast
              </button>
              <button
                onClick={() => triggerAiAnalysis('monthly')}
                className={`px-3 py-2.5 rounded-xl border font-bold tracking-wide transition-all cursor-pointer ${
                  selectedAiType === 'monthly' 
                    ? 'bg-[#C49A3A] text-[#17120F] border-[#C49A3A]' 
                    : 'bg-[#231B16] hover:bg-[#2F241E] text-white border-luxury-brown-800'
                }`}
              >
                AI Monthly Synopsis
              </button>
              <button
                onClick={() => triggerAiAnalysis('expense')}
                className={`px-3 py-2.5 rounded-xl border font-bold tracking-wide transition-all col-span-2 md:col-span-1 cursor-pointer ${
                  selectedAiType === 'expense' 
                    ? 'bg-[#C49A3A] text-[#17120F] border-[#C49A3A]' 
                    : 'bg-[#231B16] hover:bg-[#2F241E] text-white border-luxury-brown-800'
                }`}
              >
                AI Expense Analysis
              </button>
            </div>

            {/* AI Interactive Analysis Output Panel */}
            {selectedAiType && (
              <div className="bg-[#120E0B] border border-[#C49A3A]/20 rounded-xl p-5 space-y-3.5 mt-4 text-xs font-mono">
                <div className="flex justify-between items-center border-b border-luxury-brown-850/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#C49A3A]" />
                    <span className="font-mono text-[10px] tracking-wider uppercase text-luxury-gold-300">
                      Deep analysis: <strong className="text-white capitalize">{selectedAiType} advisor</strong>
                    </span>
                  </div>
                  {isAiDemoMode && (
                    <span className="text-[8.5px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase">
                      Demo Mode Falling Back
                    </span>
                  )}
                </div>

                {aiLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-[#C49A3A] animate-spin" />
                    <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest animate-pulse">Running Hospitality Gemini Engines...</span>
                  </div>
                ) : (
                  <div className="leading-relaxed font-sans text-gray-200 whitespace-pre-wrap text-[11.5px] max-w-full overflow-hidden">
                    {/* Render headings and lists cleanly */}
                    {aiResult?.split('\n').map((line, i) => {
                      if (line.trim().startsWith('###')) {
                        return <h4 key={i} className="text-md font-serif font-bold text-luxury-gold-300 mt-3 mb-1">{line.replace('###', '').trim()}</h4>;
                      } else if (line.trim().startsWith('####')) {
                        return <h5 key={i} className="text-sm font-serif font-bold text-[#C49A3A] mt-3 mb-1">{line.replace('####', '').trim()}</h5>;
                      } else if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                        const cleanLine = line.trim().substring(1).trim();
                        // check bold text inside list e.g. **Title**: value
                        if (cleanLine.includes('**')) {
                          const parts = cleanLine.split('**');
                          // parts[0] is empty, parts[1] is bold title, parts[2] is normal text
                          return (
                            <div key={i} className="flex items-start gap-2 pl-2 my-1">
                              <span className="text-[#C49A3A] mt-1">•</span>
                              <span>
                                <strong>{parts[1]}</strong>
                                {parts.slice(2).join('**')}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div key={i} className="flex items-start gap-2 pl-2 my-1">
                            <span className="text-[#C49A3A] mt-1">•</span>
                            <span>{cleanLine}</span>
                          </div>
                        );
                      } else if (line.trim().includes('**')) {
                        // text contains bold blocks
                        const parts = line.split('**');
                        return (
                          <p key={i} className="my-1.5">
                            {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx} className="text-white">{part}</strong> : part)}
                          </p>
                        );
                      } else {
                        return <p key={i} className="my-1.5">{line}</p>;
                      }
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CORE LIVE KPIs GRID (9 Indicators) */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-extrabold border-b border-slate-300 pb-2 flex justify-between items-center">
          <span>Operational KPIs Desk</span>
          <span className="text-[11px] text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md font-bold">Reference Clock: Today</span>
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-3.5">
          {/* 1. Today Arrivals */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#C49A3A] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#263449] uppercase block font-extrabold tracking-tight">Planned Arrivals</span>
            <span className="text-2xl font-sans font-extrabold text-[#263449] block mt-1.5 tracking-tight">{todayArrivals.length}</span>
            <span className="inline-block text-[10px] font-bold text-[#9E7822] bg-[#FCF9F1] border border-[#DFC47B] px-2 py-0.5 rounded-full mt-1.5">{todayCheckinsCount} remaining</span>
          </div>

          {/* 2. Today Departures */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#D92D4B] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#263449] uppercase block font-extrabold tracking-tight">Planned Departures</span>
            <span className="text-2xl font-sans font-extrabold text-[#263449] block mt-1.5 tracking-tight">{todayDepartures.length}</span>
            <span className="inline-block text-[10px] font-bold text-[#D92D4B] bg-[#FFF1F3] border border-[#FECDD6] px-2 py-0.5 rounded-full mt-1.5">{todayCheckoutsCount} pending invoice</span>
          </div>

          {/* 3. Current Occupancy */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#263449] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#263449] uppercase block font-extrabold tracking-tight">Occupancy Rate</span>
            <span className="text-2xl font-sans font-extrabold text-[#263449] block mt-1.5 tracking-tight">{occupancyRate}%</span>
            <span className="inline-block text-[10px] font-bold text-[#15805D] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-full mt-1.5">{occupiedRoomsCount} Sold rooms</span>
          </div>

          {/* 4. Available Rooms */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#15805D] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#263449] uppercase block font-extrabold tracking-tight">Available Rooms</span>
            <span className="text-2xl font-sans font-extrabold text-[#15805D] block mt-1.5 tracking-tight">{availableRoomsCount}</span>
            <span className="inline-block text-[10px] font-bold text-[#263449] bg-[#F4F6F9] border border-slate-200 px-2 py-0.5 rounded-full mt-1.5">Vacant / clean</span>
          </div>

          {/* 5. Total Guests In House */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#C49A3A] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#263449] uppercase block font-extrabold tracking-tight">Guests In-House</span>
            <span className="text-2xl font-sans font-extrabold text-[#C49A3A] block mt-1.5 tracking-tight">{totalGuestsInHouse}</span>
            <span className="inline-block text-[10px] font-bold text-[#9E7822] bg-[#FCF9F1] border border-[#DFC47B] px-2 py-0.5 rounded-full mt-1.5">Companions tracked</span>
          </div>

          {/* 6. Today Revenue */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#15805D] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#15805D] uppercase block font-extrabold tracking-tight">Today Revenue</span>
            <span className="text-xl font-sans font-extrabold text-[#15805D] block mt-2 tracking-tight">₹{todayRevenue.toLocaleString()}</span>
            <span className="inline-block text-[10px] font-bold text-[#15805D] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded-full mt-1.5">Advance + Bill out</span>
          </div>

          {/* 7. Pending Payments */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#D92D4B] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#D92D4B] uppercase block font-extrabold tracking-tight">Pending Amount</span>
            <span className="text-xl font-sans font-extrabold text-[#D92D4B] block mt-2 tracking-tight">₹{pendingPayments.toLocaleString()}</span>
            <span className="inline-block text-[10px] font-bold text-[#D92D4B] bg-[#FFF1F3] border border-[#FECDD6] px-2 py-0.5 rounded-full mt-1.5">Unsettled accounts</span>
          </div>

          {/* 8. Water Bottle Consumption */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#C49A3A] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#263449] block font-extrabold uppercase tracking-tight">Today Bottles</span>
            <span className="text-2xl font-sans font-extrabold text-[#263449] block mt-1.5 tracking-tight">{todayWaterBottlesConsumed}</span>
            <span className="inline-block text-[10px] font-bold text-[#263449] bg-[#F4F6F9] border border-slate-200 px-2 py-0.5 rounded-full mt-1.5">Total count: {totalWaterBottlesConsumed}</span>
          </div>

          {/* 9. Housekeeping Statuses */}
          <div className="bg-white border border-slate-200 border-t-4 border-t-[#17120F] p-4 rounded-xl xl:col-span-1 text-center shadow-sm">
            <span className="text-[10.5px] font-mono text-[#263449] uppercase block font-extrabold tracking-tight">Dirty / Blocked</span>
            <span className="text-base font-sans font-extrabold block mt-2.5 text-[#263449]">
              {dirtyRoomsCount} Dirty / {blockedRoomsCount} Blk
            </span>
            <span className="inline-block text-[10px] font-bold text-[#263449] bg-[#F4F6F9] border border-slate-200 px-2 py-0.5 rounded-full mt-1.5">Status monitors</span>
          </div>
        </div>
      </div>

      {/* STAFF SUMMARY SECTION */}
      <div className="space-y-3" id="staff-summary-section">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-300 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-luxury-gold-600" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-extrabold">
              Staff Summary & Roster Metrics
            </h2>
            <span className="text-[10.5px] text-amber-900 bg-amber-100 border border-amber-300 rounded-full px-2.5 py-0.5 font-bold">
              Excludes Admin Accounts
            </span>
          </div>
          <button
            onClick={() => setActiveTab('staff')}
            className="text-xs font-bold text-slate-800 hover:text-amber-700 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            Manage Staff Members <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
          {/* Card 1: Total Staff */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-slate-800 hover:border-amber-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-600 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Total Staff</span>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-slate-900 block tracking-tight">{totalStaffCount}</span>
            <span className="text-[10px] text-slate-600 font-semibold block mt-1">Non-admin staff</span>
          </div>

          {/* Card 2: Active Staff */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-emerald-500 hover:border-emerald-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-emerald-800 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Active Staff</span>
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-emerald-700 block tracking-tight">{activeStaffCount}</span>
            <span className="text-[10px] text-emerald-700 font-semibold block mt-1">On active roster</span>
          </div>

          {/* Card 3: Inactive Staff */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-rose-500 hover:border-rose-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-rose-800 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Inactive Staff</span>
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <UserX className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-rose-700 block tracking-tight">{inactiveStaffCount}</span>
            <span className="text-[10px] text-rose-700 font-semibold block mt-1">Off duty / suspended</span>
          </div>

          {/* Card 4: Managers */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-purple-500 hover:border-purple-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Managers</span>
              <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-slate-900 block tracking-tight">{managersCount}</span>
            <span className="text-[10px] text-slate-600 font-semibold block mt-1">Management leads</span>
          </div>

          {/* Card 5: Receptionists */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-blue-500 hover:border-blue-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Receptionists</span>
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Headphones className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-slate-900 block tracking-tight">{receptionistsCount}</span>
            <span className="text-[10px] text-slate-600 font-semibold block mt-1">Front desk team</span>
          </div>

          {/* Card 6: Housekeeping */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-teal-500 hover:border-teal-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Housekeeping</span>
              <div className="p-1.5 rounded-lg bg-teal-100 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-slate-900 block tracking-tight">{housekeepingCount}</span>
            <span className="text-[10px] text-slate-600 font-semibold block mt-1">Sanitation & Rooms</span>
          </div>

          {/* Card 7: Cashiers */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-amber-500 hover:border-amber-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Cashiers</span>
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-slate-900 block tracking-tight">{cashiersCount}</span>
            <span className="text-[10px] text-slate-600 font-semibold block mt-1">Accounts & Billing</span>
          </div>

          {/* Card 8: Other Staff */}
          <div 
            onClick={() => setActiveTab('staff')}
            className="bg-white border border-slate-200 border-t-4 border-t-slate-500 hover:border-slate-400 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 mb-1.5">
              <span className="text-[10.5px] font-mono uppercase font-extrabold tracking-tight">Other Staff</span>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                <UserPlus className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-2xl font-sans font-extrabold text-slate-900 block tracking-tight">{otherStaffCount}</span>
            <span className="text-[10px] text-slate-600 font-semibold block mt-1">Kitchen, Security, etc.</span>
          </div>
        </div>
      </div>

      {/* QUICK LOG CONTROL CENTER + STATUS GAUGE (Row Layout) */}
      <div id="operations-log" className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* LOG PANEL (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-luxury-brown-200/50 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex border-b border-luxury-brown-100 pb-2 mb-4 justify-between items-center">
              <h3 className="text-sm font-serif font-bold text-luxury-brown-900 flex items-center gap-1">
                <LayoutDashboard className="w-4 h-4 text-luxury-gold-500" /> Ground Operations Log
              </h3>
              <div className="flex gap-1.5 p-0.5 bg-luxury-beige-100 rounded-lg text-[10px]">
                <button
                  onClick={() => setActiveControlTab('water')}
                  className={`px-3 py-1 font-semibold rounded-md transition-all ${
                    activeControlTab === 'water' ? 'bg-luxury-brown-950 text-white' : 'text-luxury-brown-600'
                  }`}
                >
                  Water Tracking
                </button>
                <button
                  onClick={() => setActiveControlTab('housekeeping')}
                  className={`px-3 py-1 font-semibold rounded-md transition-all ${
                    activeControlTab === 'housekeeping' ? 'bg-luxury-brown-950 text-white' : 'text-luxury-brown-600'
                  }`}
                >
                  Room Status Switcher
                </button>
              </div>
            </div>

            {opsSuccess && (
              <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-2 rounded-lg font-mono font-bold text-center">
                ✓ {opsSuccess}
              </div>
            )}

            {/* TAB 1: WATER LOG */}
            {activeControlTab === 'water' && (
              <form onSubmit={handleLogWaterBottleSubmit} className="space-y-3">
                <p className="text-[11px] text-luxury-brown-405 italic">
                  Issue mineral water bottles to occupied suites with an active stay. Chargeable bottles post directly to the guest folio; complimentary bottles remain ₹0.
                </p>
                {waterBottleInventoryProduct && (
                  <div className="flex items-center justify-between bg-luxury-beige-50 border border-luxury-brown-100 rounded-lg px-3 py-1.5 text-[11px]">
                    <span className="text-luxury-brown-600 font-semibold">Inventory ({waterBottleInventoryProduct.name}):</span>
                    <span className={`font-mono font-bold ${waterBottleInventoryProduct.currentStock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {waterBottleInventoryProduct.currentStock} {waterBottleInventoryProduct.unit || 'Bottles'} in stock
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600">Occupied Room *</label>
                    <select
                      required
                      value={logRoom}
                      onChange={(e) => setLogRoom(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="">Select Occupied Room</option>
                      {occupiedRoomsWithStay.map(r => {
                        const stay = getActiveStayForRoom(r.number);
                        return (
                          <option key={r.number} value={r.number}>
                            Rm {r.number} — {stay?.guestName || r.status}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600">Bottle Quantity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="20"
                      value={logBottleCount}
                      onChange={(e) => setLogBottleCount(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 bg-luxury-beige-50/70 border border-luxury-brown-100 rounded-lg px-3 py-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-luxury-brown-900">
                    <input
                      type="checkbox"
                      checked={logIsChargeable}
                      onChange={e => setLogIsChargeable(e.target.checked)}
                      className="rounded text-luxury-gold-500"
                    />
                    <span>Chargeable to Room Folio</span>
                  </label>
                  {logIsChargeable ? (
                    <div className="flex items-center gap-1 font-mono">
                      <span className="text-[10px] text-luxury-brown-500">₹/Bottle:</span>
                      <input
                        type="number"
                        min="0"
                        value={logUnitPrice}
                        onChange={e => setLogUnitPrice(Number(e.target.value))}
                        className="w-16 px-2 py-0.5 border rounded bg-white text-right font-bold"
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] font-mono font-bold text-emerald-700">₹0 (Complimentary)</span>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-300 font-bold rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <GlassWater className="w-3.5 h-3.5 text-luxury-gold-300" /> Log Water Issue
                </button>
              </form>
            )}

            {/* TAB 2: HOUSEKEEPING CONTROL */}
            {activeControlTab === 'housekeeping' && (
              <form onSubmit={handleUpdateRoomStatusSubmit} className="space-y-4">
                <p className="text-[11px] text-luxury-brown-405 italic">
                  Manually switch room operational statuses. Useful to set checked-out suites to "Dirty" or "Blocked" during maintenance repairs.
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600">Select Room *</label>
                    <select
                      required
                      value={hkRoom}
                      onChange={(e) => setHkRoom(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white font-mono"
                    >
                      <option value="">Select Room</option>
                      {rooms.map(r => (
                        <option key={r.number} value={r.number}>
                          Suite #{r.number} (Current: {r.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-luxury-brown-600">Target Level</label>
                    <select
                      required
                      value={hkStatus}
                      onChange={(e) => setHkStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="Available">Available (Vacant & Clean)</option>
                      <option value="Occupied">Occupied</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Dirty">Dirty (Requires Cleanup)</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-300 font-bold rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-luxury-gold-300" /> Save Housekeeping Status
                </button>
              </form>
            )}
          </div>
          
          <div className="text-[10px] text-gray-400 font-mono text-center pt-3 border-t border-dashed mt-4">
            Changes save to global secure browser state instantly.
          </div>
        </div>

        {/* RADIAL CHART OR RATIOS (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-luxury-brown-200/50 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-serif font-medium text-luxury-brown-900 border-b border-luxury-brown-100 pb-2 mb-4">
              Real-time Suite Distribution Gauge
            </h3>
            
            <div className="grid grid-cols-2 gap-4 my-2">
              {/* Radial circle representation */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="56" cy="56" r="46" stroke="#f4efdf" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="56"
                      cy="56"
                      r="46"
                      stroke="#caa05a"
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 * (1 - occupancyRate / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xl font-serif font-bold text-luxury-brown-900">{occupancyRate}%</span>
                    <span className="text-[8px] font-mono text-luxury-brown-405">Occupied</span>
                  </div>
                </div>
              </div>

              {/* Status color legends including Dirty and Blocked */}
              <div className="space-y-1.5 text-[11px] font-mono text-luxury-brown-800 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0" />
                  <span>Available: <strong>{availableRoomsCount} Rooms</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-luxury-gold-500 rounded-full shrink-0" />
                  <span>Occupied: <strong>{occupiedRoomsCount} Rooms</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
                  <span>Dirty (Clean req): <strong className="text-rose-600">{dirtyRoomsCount} Rooms</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-zinc-800 rounded-full shrink-0" />
                  <span>Blocked: <strong className="text-zinc-600">{blockedRoomsCount} Rooms</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full shrink-0" />
                  <span>Reserved: <strong>{reservedRoomsCount} Rooms</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-250 rounded-full shrink-0" />
                  <span>Maintenance: <strong>{maintenanceRoomsCount} Rooms</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-luxury-brown-100 pt-3.5 mt-2 flex justify-between gap-2">
            <button
              onClick={() => setActiveTab('rooms')}
              className="flex-1 py-1.5 bg-luxury-beige-100 hover:bg-luxury-gold-200 text-luxury-brown-900 rounded-lg text-xs font-serif font-semibold text-center transition-all"
            >
              Rooms Inventory Matrix
            </button>
            <button
              onClick={() => setActiveTab('todayBookings')}
              className="flex-1 py-1.5 bg-luxury-brown-950 hover:bg-luxury-brown-850 text-white rounded-lg text-xs font-serif font-semibold text-center transition-all"
            >
              Arrivals Desk
            </button>
          </div>
        </div>
      </div>

      {/* Revenue trend visualization */}
      <div className="bg-white border border-luxury-brown-200/50 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-luxury-brown-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-serif font-semibold text-luxury-brown-900">Yield revenue pipeline</h3>
            <p className="text-xs text-luxury-brown-500 font-mono text-[10px]">Reference timeframe: {chartTimeframe === 'week' ? 'Past 7 Days' : 'Historic Months'}</p>
          </div>
          <div className="flex gap-1 bg-luxury-beige-50 p-1 rounded-lg">
            <button
              onClick={() => setChartTimeframe('week')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                chartTimeframe === 'week' ? 'bg-luxury-brown-950 text-white shadow-xs' : 'text-luxury-brown-600'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setChartTimeframe('month')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                chartTimeframe === 'month' ? 'bg-luxury-brown-950 text-white shadow-xs' : 'text-luxury-brown-600'
              }`}
            >
              Month-wise
            </button>
          </div>
        </div>

        {/* Custom graphic bars */}
        <div className="h-44 flex items-end justify-between px-3 pt-6 border-b border-luxury-brown-100 pb-1">
          {activeChartData.map((d, i) => {
            const hPerc = Math.min(100, Math.max(8, Math.round((d.amount / maxAmount) * 100)));
            return (
              <div key={i} className="flex flex-col items-center flex-1 group relative">
                <span className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-luxury-brown-900 text-luxury-gold-300 text-[10px] px-1.5 py-0.5 rounded font-mono transition-opacity z-10 whitespace-nowrap shadow-md">
                  ₹{Number(d.amount || 0).toLocaleString()}
                </span>
                <div className="w-6 md:w-10 bg-luxury-beige-100 hover:bg-luxury-gold-200 rounded-t h-32 flex items-end overflow-hidden">
                  <div 
                    className="w-full bg-[#C5A059] group-hover:bg-luxury-gold-400 origin-bottom transition-all"
                    style={{ height: `${hPerc}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-luxury-brown-500 mt-2 block">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. SARAI COMPLIANCE REPORT MODAL */}
      {isSaraiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl border border-luxury-brown-100 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Report Header */}
              <div className="text-center border-b-2 border-luxury-brown-900 pb-5 mb-6 space-y-2">
                <h1 className="text-2xl font-serif font-bold text-luxury-brown-950 uppercase tracking-wide">
                  Form 'C' / Department of Tourism & Local Police Authority
                </h1>
                <p className="text-sm font-mono text-luxury-gold-700 tracking-widest uppercase font-bold">
                  Daily Sarai Guard & Guest Registration Compliance Log (Sarai Act 1867)
                </p>
                <div className="flex flex-wrap justify-between items-center text-xs font-mono text-luxury-brown-500 pt-2 border-t border-luxury-brown-100 mt-2 gap-3">
                  <span>PROPERTY: <strong>{(hotelName || 'DIRECTSTAY HOTEL').toUpperCase()}</strong></span>
                  <div className="flex flex-wrap items-center gap-2 bg-luxury-beige-50 px-3 py-1.5 rounded-xl border border-luxury-gold-300/60">
                    <span className="text-[10px] font-bold text-luxury-brown-800 uppercase">From Date:</span>
                    <input
                      type="date"
                      value={saraiFromDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSaraiFromDate(v);
                        if (saraiToDate < v) setSaraiToDate(v);
                      }}
                      className="px-2 py-1 border rounded text-xs font-mono bg-white text-luxury-brown-950"
                    />
                    <span className="text-[10px] font-bold text-luxury-brown-800 uppercase">To Date:</span>
                    <input
                      type="date"
                      value={saraiToDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (saraiFromDate > v) setSaraiFromDate(v);
                        setSaraiToDate(v);
                      }}
                      className="px-2 py-1 border rounded text-xs font-mono bg-white text-luxury-brown-950"
                    />
                  </div>
                  <span>GENERATED BY: <strong>{currentRole} WORKSTATION</strong></span>
                </div>
              </div>

              {/* Table of In-House & Checked-In Guests (Filtered Date-to-Date) */}
              <div className="overflow-x-auto border border-luxury-brown-200 rounded-xl shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-luxury-brown-900 text-white font-mono uppercase tracking-wider text-[10px] border-b border-luxury-brown-950">
                      <th className="py-2.5 px-3 border-r border-luxury-brown-800 text-center">S.No</th>
                      <th className="py-2.5 px-3 border-r border-luxury-brown-800 text-center">Room</th>
                      <th className="py-2.5 px-4 border-r border-luxury-brown-800">Guest Particulars</th>
                      <th className="py-2.5 px-4 border-r border-luxury-brown-800">Additional Occupant(s)</th>
                      <th className="py-2.5 px-3 border-r border-luxury-brown-800 text-center">Nationality</th>
                      <th className="py-2.5 px-4 border-r border-luxury-brown-800">ID Document</th>
                      <th className="py-2.5 px-4 border-r border-luxury-brown-800">Home/Permanent Address</th>
                      <th className="py-2.5 px-4 border-r border-luxury-brown-800">Check-In Duration</th>
                      <th className="py-2.5 px-3 border-r border-luxury-brown-800 text-center">Vehicle No</th>
                      <th className="py-2.5 px-3">Company</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100 font-sans">
                    {saraiFilteredCheckins.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-luxury-brown-400 font-mono italic">
                          No checked-in guest registration records found between {saraiFromDate} and {saraiToDate}.
                        </td>
                      </tr>
                    ) : (
                      saraiFilteredCheckins.map((c, i) => (
                        <tr key={c.id} className="hover:bg-luxury-beige-50/50 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-luxury-brown-900 border-r border-luxury-brown-100 text-center">{i + 1}</td>
                          <td className="py-3 px-3 font-semibold text-teal-700 bg-teal-50/20 border-r border-luxury-brown-100 text-center font-mono">Rm {c.roomNumber}</td>
                          <td className="py-3 px-4 border-r border-luxury-brown-100">
                            <p className="font-bold text-luxury-brown-950">{c.guestName}</p>
                            <p className="text-[10px] text-luxury-brown-500 font-mono">{c.mobile}</p>
                            {c.emailAddress && <p className="text-[9px] text-[#C5A059] font-mono">{c.emailAddress}</p>}
                          </td>
                          <td className="py-3 px-4 text-luxury-brown-700 border-r border-luxury-brown-100 font-mono text-[10px]">
                            {c.secondaryGuests && c.secondaryGuests.length > 0 ? (
                              <div className="space-y-1">
                                {c.secondaryGuests.map((sg, sgidx) => (
                                  <div key={sgidx} className="border-b border-dashed border-luxury-brown-100/50 last:border-0 pb-1 pt-1">
                                    <span className="font-bold text-luxury-brown-900 block">{sg.fullName}</span>
                                    <span className="text-[9px] text-luxury-brown-500 block">Aadhaar: {sg.aadhaarNumber || 'N/A'}</span>
                                    {sg.passportNumber && <span className="text-[9px] text-[#A855F7] block">Passport: {sg.passportNumber}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-luxury-brown-300 italic text-[11px]">No Additional Guests</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-center text-luxury-brown-800 border-r border-luxury-brown-100">{c.nationality}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-luxury-brown-900 border-r border-luxury-brown-100">
                            <p className="font-bold">Aadhaar: {c.aadhaarNumber || 'N/A'}</p>
                            {c.passportNumber && <p className="text-[10px] text-purple-700 font-bold">Passport: {c.passportNumber}</p>}
                            {c.gstNumber && <p className="text-[9px] text-teal-700 font-semibold">GSTIN: {c.gstNumber}</p>}
                          </td>
                          <td className="py-3 px-4 text-luxury-brown-700 border-r border-luxury-brown-100 leading-tight">
                            <p>{c.address}</p>
                            <p className="text-[10px] font-semibold text-luxury-brown-900">{c.city}, {c.state}</p>
                          </td>
                          <td className="py-3 px-4 text-luxury-brown-800 border-r border-luxury-brown-100 font-mono text-[10px]">
                            <p className="text-emerald-700 font-bold">In: {c.checkInDate}</p>
                            <p className="text-rose-700">Out: {c.checkOutDate}</p>
                          </td>
                          <td className="py-3 px-3 font-mono text-center text-luxury-brown-800 border-r border-luxury-brown-100">
                            {c.vehicleNumber || <span className="text-luxury-brown-300 italic">None</span>}
                          </td>
                          <td className="py-3 px-3 font-serif text-luxury-brown-800">
                            {c.companyName || <span className="text-luxury-brown-300 italic">None</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legal Notes */}
              <div className="mt-5 text-[10px] text-luxury-brown-500 font-mono border-t border-dashed border-luxury-brown-200 pt-3 leading-relaxed space-y-1">
                <p>1. Under the Sarai Act (Act No. XXII of 1867), all guest records, identity certificates, and permanent address listings must be certified correctly by hotel operators.</p>
                <p>2. Deletion or permanent modification of verified check-in data is strictly audited in compliance with security guidelines.</p>
                <p>3. This report serves as authorized daily statutory compliance data subject to inspection by local administrative authorities.</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-luxury-brown-100 pt-4 justify-end no-print">
              <button
                onClick={handleExportSaraiCSV}
                className="px-6 py-2.5 rounded-xl bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white font-serif font-bold text-xs transition duration-200 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                ⬇ Export Date-to-Date CSV ({saraiFromDate} to {saraiToDate})
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-serif font-bold text-xs transition duration-200 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                ✓ Print Police Sarai Act Form
              </button>
              <button
                onClick={() => setIsSaraiModalOpen(false)}
                className="px-6 py-2.5 rounded-xl border border-luxury-brown-300 hover:bg-luxury-beige-100 text-luxury-brown-800 font-bold text-xs transition duration-250 cursor-pointer"
              >
                Close Compliance Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
