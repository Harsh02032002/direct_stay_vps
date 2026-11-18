import React, { useState, useMemo, useEffect } from 'react';
import { Booking, GuestCheckIn, Room, Invoice } from '../types';
import { 
  Users, UserPlus, Phone, Mail, MapPin, Calendar, CreditCard, 
  ShieldCheck, Search, Filter, Download, Plus, CheckCircle, 
  ExternalLink, MessageCircle, FileText, ChevronRight, X, Star, 
  Crown, Bed, Clock, AlertCircle, Building2, Eye, Sparkles,
  FileCheck, Printer, Receipt
} from 'lucide-react';
import { showToast } from '../utils/toast';

export interface RegisteredGuest {
  id: string;
  hotelId?: string;
  name: string;
  mobile: string;
  email?: string;
  aadhaarNumber?: string;
  passportNumber?: string;
  nationality?: string;
  city?: string;
  state?: string;
  address?: string;
  companyName?: string;
  gstNumber?: string;
  isVip?: boolean;
  notes?: string;
  totalStays: number;
  totalSpent: number;
  pendingBalance: number;
  lastStayDate?: string;
  lastRoomNumber?: string;
  currentStatus: 'In-House' | 'Upcoming' | 'Past Guest' | 'Registered';
  idVerified: boolean;
  history: Array<{
    id: string;
    type: 'checkin' | 'booking';
    date: string;
    checkOutDate?: string;
    roomNumber: string;
    amount: number;
    status: string;
  }>;
  createdAt: string;
}

interface GuestUserListViewProps {
  checkins: GuestCheckIn[];
  bookings: Booking[];
  rooms: Room[];
  invoices: Invoice[];
  hotelId: string;
  hotelName?: string;
  initialSubTab?: 'directory' | 'documents';
  onNavigateToCheckIn?: (prefillGuest?: { name: string; mobile: string; aadhaar?: string; address?: string }) => void;
  onNavigateToBooking?: (prefillGuest?: { name: string; mobile: string; aadhaar?: string; address?: string }) => void;
}

export default function GuestUserListView({
  checkins = [],
  bookings = [],
  rooms = [],
  invoices = [],
  hotelId,
  hotelName = 'Hotel Grand Pavilion',
  initialSubTab = 'directory',
  onNavigateToCheckIn,
  onNavigateToBooking
}: GuestUserListViewProps) {
  // Sub-tab: 'directory' | 'documents'
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'documents'>(initialSubTab);
  // Local storage key for manually created / custom registered guests
  const storageKey = `hotel_custom_registered_guests_${hotelId || 'default'}`;

  const [customGuests, setCustomGuests] = useState<RegisteredGuest[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal States
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [selectedGuestForDetails, setSelectedGuestForDetails] = useState<RegisteredGuest | null>(null);

  // Form state for adding new guest
  const [newGuestForm, setNewGuestForm] = useState({
    name: '',
    mobile: '',
    email: '',
    nationality: 'Indian',
    aadhaarNumber: '',
    passportNumber: '',
    city: '',
    state: '',
    address: '',
    companyName: '',
    gstNumber: '',
    isVip: false,
    notes: ''
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-house' | 'upcoming' | 'past' | 'vip'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'stays' | 'spent' | 'name'>('recent');
  const getTodayGuestIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getOffsetGuestIso = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [guestDateFilterType, setGuestDateFilterType] = useState<'All' | 'Today' | 'Yesterday' | 'Date' | 'This Month' | 'Range'>('All');
  const [guestFilterSingleDate, setGuestFilterSingleDate] = useState<string>(getTodayGuestIso());
  const [guestFilterStartDate, setGuestFilterStartDate] = useState<string>(getOffsetGuestIso(-7));
  const [guestFilterEndDate, setGuestFilterEndDate] = useState<string>(getTodayGuestIso());

  // Save custom guests to localStorage
  const handleSaveCustomGuests = (updated: RegisteredGuest[]) => {
    setCustomGuests(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save guest to localStorage', e);
    }
  };

  // Compile full guest directory from checkins, bookings, and custom guests
  const allGuests = useMemo(() => {
    const guestMap = new Map<string, RegisteredGuest>();

    const getNormalizedKey = (name: string, mobile: string) => {
      const cleanPhone = (mobile || '').replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) return `phone_${cleanPhone}`;
      return `name_${(name || '').trim().toLowerCase()}`;
    };

    // 1. Process Check-Ins (Most authoritative for In-House and ID proof)
    checkins.forEach((c) => {
      if (!c.guestName) return;
      const key = getNormalizedKey(c.guestName, c.mobile);
      const isCurrentlyInHouse = c.status !== 'CheckedOut' && c.status !== 'Cancelled';
      const tariff = Number(c.roomRate || (c as any).tariff || c.totalAmount || 0);

      const existing = guestMap.get(key);
      const stayRecord = {
        id: c.id,
        type: 'checkin' as const,
        date: c.checkInDate || '',
        checkOutDate: c.checkOutDate,
        roomNumber: c.roomNumber || '',
        amount: tariff,
        status: isCurrentlyInHouse ? 'In-House' : (c.status || 'Checked-Out')
      };

      if (!existing) {
        guestMap.set(key, {
          id: `gst_${c.id}`,
          hotelId: c.hotelId || hotelId,
          name: c.guestName,
          mobile: c.mobile || '',
          email: c.emailAddress || '',
          aadhaarNumber: c.aadhaarNumber || '',
          passportNumber: c.passportNumber || '',
          nationality: c.nationality || 'Indian',
          city: c.city || '',
          state: c.state || '',
          address: c.address || '',
          companyName: c.companyName || '',
          gstNumber: c.gstNumber || '',
          isVip: Boolean((c as any).vipGuest || (c as any).isVip),
          notes: (c as any).notes || (c as any).specialRequests || '',
          totalStays: 1,
          totalSpent: tariff,
          pendingBalance: 0,
          lastStayDate: c.checkInDate,
          lastRoomNumber: c.roomNumber,
          currentStatus: isCurrentlyInHouse ? 'In-House' : 'Past Guest',
          idVerified: Boolean((c.aadhaarNumber && c.aadhaarNumber.length >= 8) || c.passportNumber),
          history: [stayRecord],
          createdAt: c.checkInDate || new Date().toISOString()
        });
      } else {
        existing.totalStays += 1;
        existing.totalSpent += tariff;
        if (isCurrentlyInHouse) existing.currentStatus = 'In-House';
        if (!existing.email && c.emailAddress) existing.email = c.emailAddress;
        if (!existing.aadhaarNumber && c.aadhaarNumber) existing.aadhaarNumber = c.aadhaarNumber;
        if (!existing.passportNumber && c.passportNumber) existing.passportNumber = c.passportNumber;
        if (!existing.city && c.city) existing.city = c.city;
        if (!existing.address && c.address) existing.address = c.address;
        if ((c as any).vipGuest || (c as any).isVip) existing.isVip = true;
        
        if (c.checkInDate && (!existing.lastStayDate || c.checkInDate > existing.lastStayDate)) {
          existing.lastStayDate = c.checkInDate;
          existing.lastRoomNumber = c.roomNumber;
        }
        existing.history.push(stayRecord);
      }
    });

    // 2. Process Bookings
    bookings.forEach((b) => {
      if (!b.guestName) return;
      const key = getNormalizedKey(b.guestName, b.mobile);
      const isConfirmed = b.status === 'Confirmed' || (b.status as string) === 'Booked';
      const existing = guestMap.get(key);

      const stayRecord = {
        id: b.id,
        type: 'booking' as const,
        date: b.checkInDate || '',
        checkOutDate: b.checkOutDate,
        roomNumber: b.roomNumber || '',
        amount: Number(b.advanceAmount || 0),
        status: b.status || 'Confirmed'
      };

      if (!existing) {
        guestMap.set(key, {
          id: `gst_bkg_${b.id}`,
          hotelId: b.hotelId || hotelId,
          name: b.guestName,
          mobile: b.mobile || '',
          email: b.email || '',
          aadhaarNumber: b.aadhaarNumber || '',
          nationality: 'Indian',
          address: b.address || '',
          isVip: false,
          notes: b.notes || '',
          totalStays: 1,
          totalSpent: Number(b.advanceAmount || 0),
          pendingBalance: 0,
          lastStayDate: b.checkInDate,
          lastRoomNumber: b.roomNumber,
          currentStatus: isConfirmed ? 'Upcoming' : 'Past Guest',
          idVerified: Boolean(b.aadhaarNumber && b.aadhaarNumber.length >= 8),
          history: [stayRecord],
          createdAt: b.checkInDate || new Date().toISOString()
        });
      } else {
        // If not already in-house and has confirmed upcoming booking
        if (existing.currentStatus !== 'In-House' && isConfirmed) {
          existing.currentStatus = 'Upcoming';
        }
        if (!existing.history.some(h => h.id === b.id)) {
          existing.totalStays += 1;
          existing.totalSpent += Number(b.advanceAmount || 0);
          existing.history.push(stayRecord);
        }
        if (!existing.email && b.email) existing.email = b.email;
        if (!existing.aadhaarNumber && b.aadhaarNumber) existing.aadhaarNumber = b.aadhaarNumber;
        if (!existing.address && b.address) existing.address = b.address;
      }
    });

    // 3. Process Custom Registered Guests
    customGuests.forEach((cg) => {
      const key = getNormalizedKey(cg.name, cg.mobile);
      if (!guestMap.has(key)) {
        guestMap.set(key, cg);
      } else {
        const existing = guestMap.get(key)!;
        if (cg.isVip) existing.isVip = true;
        if (cg.notes) existing.notes = cg.notes;
        if (cg.companyName) existing.companyName = cg.companyName;
        if (cg.gstNumber) existing.gstNumber = cg.gstNumber;
      }
    });

    // Match with Invoices for accurate total spent & pending dues
    invoices.forEach((inv) => {
      if (!inv.guestName) return;
      const key = getNormalizedKey(inv.guestName, inv.guestMobile || '');
      const existing = guestMap.get(key);
      if (existing) {
        const invTotal = Number(inv.totalAmount ?? (inv as any).grandTotal ?? 0);
        if (invTotal > existing.totalSpent) {
          existing.totalSpent = invTotal;
        }
        const invBalance = Number(inv.balanceAmount ?? (inv as any).balanceDue ?? 0);
        if (invBalance > 0) {
          existing.pendingBalance = Math.max(existing.pendingBalance, invBalance);
        }
      }
    });

    return Array.from(guestMap.values());
  }, [checkins, bookings, customGuests, invoices, hotelId]);

  // Filtered & Sorted Guests
  const filteredGuests = useMemo(() => {
    let result = [...allGuests];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(g => 
        g.name.toLowerCase().includes(q) ||
        g.mobile.includes(q) ||
        (g.email && g.email.toLowerCase().includes(q)) ||
        (g.aadhaarNumber && g.aadhaarNumber.includes(q)) ||
        (g.lastRoomNumber && g.lastRoomNumber.toLowerCase().includes(q)) ||
        (g.city && g.city.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === 'in-house') {
      result = result.filter(g => g.currentStatus === 'In-House');
    } else if (statusFilter === 'upcoming') {
      result = result.filter(g => g.currentStatus === 'Upcoming');
    } else if (statusFilter === 'past') {
      result = result.filter(g => g.currentStatus === 'Past Guest' || g.currentStatus === 'Registered');
    } else if (statusFilter === 'vip') {
      result = result.filter(g => g.isVip || g.totalStays > 1 || g.totalSpent >= 10000);
    }

    if (guestDateFilterType !== 'All') {
      const todayIso = getTodayGuestIso();
      const yestIso = getOffsetGuestIso(-1);
      const monthPrefix = todayIso.slice(0, 7);
      result = result.filter(g => {
        const dStr = String(g.lastStayDate || g.createdAt || '').slice(0, 10);
        if (guestDateFilterType === 'Today') return dStr === todayIso;
        if (guestDateFilterType === 'Yesterday') return dStr === yestIso;
        if (guestDateFilterType === 'Date') return dStr === guestFilterSingleDate;
        if (guestDateFilterType === 'This Month') return dStr.startsWith(monthPrefix);
        if (guestDateFilterType === 'Range') {
          return (!guestFilterStartDate || dStr >= guestFilterStartDate) && (!guestFilterEndDate || dStr <= guestFilterEndDate);
        }
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'recent') {
        return (b.lastStayDate || '').localeCompare(a.lastStayDate || '');
      }
      if (sortBy === 'stays') {
        return b.totalStays - a.totalStays;
      }
      if (sortBy === 'spent') {
        return b.totalSpent - a.totalSpent;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [allGuests, searchQuery, statusFilter, sortBy, guestDateFilterType, guestFilterSingleDate, guestFilterStartDate, guestFilterEndDate]);

  // Key KPI Metrics
  const stats = useMemo(() => {
    const totalCount = allGuests.length;
    const inHouseCount = allGuests.filter(g => g.currentStatus === 'In-House').length;
    const repeatCount = allGuests.filter(g => g.totalStays > 1 || g.isVip).length;
    const verifiedCount = allGuests.filter(g => g.idVerified).length;
    const totalRevenue = allGuests.reduce((sum, g) => sum + g.totalSpent, 0);

    return { totalCount, inHouseCount, repeatCount, verifiedCount, totalRevenue };
  }, [allGuests]);

  // Document states & compiled records for Guest Documents & Identity Archival
  const [docSearch, setDocSearch] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<'All' | 'GRC' | 'Aadhaar Card' | 'Passport' | 'Tax Invoice'>('All');
  const [viewingDocument, setViewingDocument] = useState<any | null>(null);

  const documentRecords = useMemo(() => {
    const list: Array<{
      id: string;
      guestName: string;
      mobile: string;
      roomNumber: string;
      type: 'Aadhaar Card' | 'Passport' | 'GRC' | 'Tax Invoice' | 'Driving License / ID';
      idProofNumber: string;
      date: string;
      checkInDate?: string;
      checkOutDate?: string;
      amount?: number;
      status: 'Verified' | 'Uploaded' | 'System Generated';
      details: string;
      rawCheckin?: GuestCheckIn;
      rawInvoice?: Invoice;
      rawBooking?: Booking;
    }> = [];

    // 1. Process Check-ins for GRC, Aadhaar, Passport & ID proofs
    checkins.forEach((c) => {
      const gName = c.guestName || 'Guest';
      const gMobile = c.mobile || '';
      const rm = c.roomNumber || 'Assigned';
      const cDate = c.checkInDate || '';

      // Digital Guest Registration Card (GRC)
      list.push({
        id: `grc_${c.id}`,
        guestName: gName,
        mobile: gMobile,
        roomNumber: rm,
        type: 'GRC',
        idProofNumber: c.grcNumber || `GRC-${c.id.slice(-6)}`,
        date: cDate,
        checkInDate: c.checkInDate,
        checkOutDate: c.checkOutDate,
        amount: Number(c.totalAmount || c.roomRate || 0),
        status: 'System Generated',
        details: `Digital GRC Registration Card for Room ${rm} (Stay: ${cDate} to ${c.checkOutDate || 'Open'})`,
        rawCheckin: c,
      });

      // Government Aadhaar Card
      if (c.aadhaarNumber && c.aadhaarNumber.trim()) {
        list.push({
          id: `adh_${c.id}`,
          guestName: gName,
          mobile: gMobile,
          roomNumber: rm,
          type: 'Aadhaar Card',
          idProofNumber: c.aadhaarNumber,
          date: cDate,
          checkInDate: c.checkInDate,
          status: 'Verified',
          details: `Govt. 12-Digit Aadhaar ID verified during check-in for Room ${rm}`,
          rawCheckin: c,
        });
      }

      // Foreign Passport
      if (c.passportNumber && c.passportNumber.trim()) {
        list.push({
          id: `pass_${c.id}`,
          guestName: gName,
          mobile: gMobile,
          roomNumber: rm,
          type: 'Passport',
          idProofNumber: c.passportNumber,
          date: cDate,
          checkInDate: c.checkInDate,
          status: 'Verified',
          details: `International Passport verified for Room ${rm} (${c.nationality || 'Foreign National'})`,
          rawCheckin: c,
        });
      }

      // Other Photo ID
      if (c.idProofNumber && c.idProofNumber !== c.aadhaarNumber && c.idProofNumber !== c.passportNumber) {
        list.push({
          id: `idp_${c.id}`,
          guestName: gName,
          mobile: gMobile,
          roomNumber: rm,
          type: 'Driving License / ID',
          idProofNumber: c.idProofNumber,
          date: cDate,
          checkInDate: c.checkInDate,
          status: 'Verified',
          details: `${c.idProofType || 'Govt Photo ID'} verified for Room ${rm}`,
          rawCheckin: c,
        });
      }
    });

    // 2. Process Invoices for Official GST Tax Invoices
    invoices.forEach((inv) => {
      const gName = inv.guestName || 'Guest';
      const gMobile = inv.guestMobile || '';
      const rm = inv.roomNumber || '-';
      const invNum = inv.invoiceNumber || `INV-${inv.id}`;
      const invDate = inv.date || inv.createdAt?.split('T')[0] || '';
      const invAmt = Number(inv.totalAmount ?? (inv as any).grandTotal ?? 0);

      list.push({
        id: `inv_${inv.id}`,
        guestName: gName,
        mobile: gMobile,
        roomNumber: rm,
        type: 'Tax Invoice',
        idProofNumber: invNum,
        date: invDate,
        amount: invAmt,
        status: 'System Generated',
        details: `Official GST Tax Invoice (${invNum}) • Total ₹${invAmt.toLocaleString('en-IN')}`,
        rawInvoice: inv,
      });
    });

    // 3. Process Bookings with Aadhaar/Passport that didn't check in yet
    bookings.forEach((b) => {
      const bAdh = b.aadhaarNumber?.trim();
      const bPass = b.passportNumber?.trim();
      if (bAdh && !list.some(r => r.idProofNumber === bAdh)) {
        list.push({
          id: `adh_bkg_${b.id}`,
          guestName: b.guestName,
          mobile: b.mobile,
          roomNumber: b.roomNumber || 'Pre-allocated',
          type: 'Aadhaar Card',
          idProofNumber: bAdh,
          date: b.checkInDate,
          status: 'Uploaded',
          details: `Advance Booking Govt ID for Booking #${b.bookingNo || b.id}`,
          rawBooking: b,
        });
      }
      if (bPass && !list.some(r => r.idProofNumber === bPass)) {
        list.push({
          id: `pass_bkg_${b.id}`,
          guestName: b.guestName,
          mobile: b.mobile,
          roomNumber: b.roomNumber || 'Pre-allocated',
          type: 'Passport',
          idProofNumber: bPass,
          date: b.checkInDate,
          status: 'Uploaded',
          details: `Advance Booking Passport for Booking #${b.bookingNo || b.id}`,
          rawBooking: b,
        });
      }
    });

    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [checkins, invoices, bookings]);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    let list = [...documentRecords];
    if (docCategoryFilter !== 'All') {
      list = list.filter(d => d.type === docCategoryFilter);
    }
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase().trim();
      list = list.filter(d =>
        d.guestName.toLowerCase().includes(q) ||
        d.mobile.includes(q) ||
        d.roomNumber.toLowerCase().includes(q) ||
        d.idProofNumber.toLowerCase().includes(q) ||
        d.details.toLowerCase().includes(q)
      );
    }
    return list;
  }, [documentRecords, docCategoryFilter, docSearch]);

  // Handle Form Submission for Adding New Guest
  const handleAddNewGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestForm.name.trim() || !newGuestForm.mobile.trim()) {
      showToast('Guest Name and Mobile Number are required', 'error');
      return;
    }

    const newGuest: RegisteredGuest = {
      id: `custom_gst_${Date.now()}`,
      hotelId,
      name: newGuestForm.name.trim(),
      mobile: newGuestForm.mobile.trim(),
      email: newGuestForm.email.trim(),
      nationality: newGuestForm.nationality || 'Indian',
      aadhaarNumber: newGuestForm.aadhaarNumber.trim(),
      passportNumber: newGuestForm.passportNumber.trim(),
      city: newGuestForm.city.trim(),
      state: newGuestForm.state.trim(),
      address: newGuestForm.address.trim(),
      companyName: newGuestForm.companyName.trim(),
      gstNumber: newGuestForm.gstNumber.trim(),
      isVip: newGuestForm.isVip,
      notes: newGuestForm.notes.trim(),
      totalStays: 0,
      totalSpent: 0,
      pendingBalance: 0,
      currentStatus: 'Registered',
      idVerified: Boolean(newGuestForm.aadhaarNumber.length >= 8 || newGuestForm.passportNumber),
      history: [],
      createdAt: new Date().toISOString().split('T')[0]
    };

    handleSaveCustomGuests([newGuest, ...customGuests]);
    showToast(`Guest profile for ${newGuest.name} created successfully!`, 'success');

    // Reset Form
    setNewGuestForm({
      name: '',
      mobile: '',
      email: '',
      nationality: 'Indian',
      aadhaarNumber: '',
      passportNumber: '',
      city: '',
      state: '',
      address: '',
      companyName: '',
      gstNumber: '',
      isVip: false,
      notes: ''
    });
    setShowAddGuestModal(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredGuests.length === 0) {
      showToast('No guest records to export', 'error');
      return;
    }

    const headers = ['Guest Name', 'Mobile', 'Email', 'Nationality', 'City', 'Aadhaar / ID', 'Status', 'Total Stays', 'Total Spent (INR)', 'Last Stay Date', 'Last Room'];
    const rows = filteredGuests.map(g => [
      `"${g.name}"`,
      `"${g.mobile}"`,
      `"${g.email || ''}"`,
      `"${g.nationality || 'Indian'}"`,
      `"${g.city || ''}"`,
      `"${g.aadhaarNumber || g.passportNumber || ''}"`,
      `"${g.currentStatus}"`,
      g.totalStays,
      g.totalSpent,
      `"${g.lastStayDate || ''}"`,
      `"${g.lastRoomNumber || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DirectStay_Guests_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Guest directory exported as CSV!', 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner / Header (Clean Light Theme) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-luxury-brown-100 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-luxury-brown-100/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#FBF4E0] text-[#8B691E] border border-[#C49A3A]/40">
                GUEST CRM &amp; DIRECTORY
              </span>
              <span className="text-xs text-luxury-brown-500 font-medium">
                • {hotelName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2.5">
              <Users className="w-7 h-7 text-[#C49A3A]" />
              Guest &amp; User List Directory
            </h1>
            <p className="text-xs sm:text-sm text-luxury-brown-600 mt-1 max-w-2xl">
              Complete guest registry, stay history, verified identity records, VIP loyalty tracking, and direct one-click WhatsApp communications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-luxury-beige-50 border border-luxury-brown-200 text-luxury-brown-800 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-luxury-brown-600" />
              Export Directory
            </button>
            <button
              type="button"
              onClick={() => setShowAddGuestModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#C49A3A] hover:bg-[#B0862B] text-[#17120F] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              + Register New Guest
            </button>
          </div>
        </div>

        {/* 5 KPI Metric Cards - Clean Light Theme */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-[#FAF7F2] rounded-xl p-3.5 border border-luxury-brown-200/80">
            <div className="text-[10.5px] uppercase tracking-wider text-luxury-brown-600 font-bold">Total Registered</div>
            <div className="text-2xl font-bold font-serif text-luxury-brown-950 mt-1">{stats.totalCount}</div>
            <div className="text-[10px] text-luxury-brown-500 mt-0.5">Unique guest profiles</div>
          </div>

          <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-200">
            <div className="text-[10.5px] uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              In-House Right Now
            </div>
            <div className="text-2xl font-bold font-serif text-emerald-900 mt-1">{stats.inHouseCount}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">Checked-in &amp; staying</div>
          </div>

          <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200">
            <div className="text-[10.5px] uppercase tracking-wider text-amber-900 font-bold flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              Loyal &amp; VIP Guests
            </div>
            <div className="text-2xl font-bold font-serif text-amber-950 mt-1">{stats.repeatCount}</div>
            <div className="text-[10px] text-amber-800 mt-0.5">Multi-stay patrons</div>
          </div>

          <div className="bg-blue-50/70 rounded-xl p-3.5 border border-blue-200">
            <div className="text-[10.5px] uppercase tracking-wider text-blue-900 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              ID Verified
            </div>
            <div className="text-2xl font-bold font-serif text-blue-950 mt-1">{stats.verifiedCount}</div>
            <div className="text-[10px] text-blue-800 mt-0.5">Govt Aadhaar / Passport</div>
          </div>

          <div className="bg-[#FBF4E0]/80 rounded-xl p-3.5 border border-[#C49A3A]/50 col-span-2 sm:col-span-1">
            <div className="text-[10.5px] uppercase tracking-wider text-[#8B691E] font-bold">Guest Lifetime Spends</div>
            <div className="text-2xl font-bold font-serif text-[#8B691E] mt-1">₹{Number(stats.totalRevenue || 0).toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-luxury-brown-600 mt-0.5">Combined stays &amp; tariffs</div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Guest Profiles Directory vs Document & Identity Archival (Light Theme) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-luxury-brown-200/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'directory'
              ? 'bg-[#FBF4E0] text-[#17120F] border-2 border-[#C49A3A] shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 text-[#8B691E]" />
          <span>Guest Profiles Directory</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            activeSubTab === 'directory' ? 'bg-[#C49A3A]/25 text-[#17120F]' : 'bg-slate-100 text-slate-600'
          }`}>
            {allGuests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('documents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'documents'
              ? 'bg-[#FBF4E0] text-[#17120F] border-2 border-[#C49A3A] shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileCheck className="w-4 h-4 text-[#8B691E]" />
          <span>Guest Documents &amp; Identity Archive</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            activeSubTab === 'documents' ? 'bg-[#C49A3A]/25 text-[#17120F]' : 'bg-slate-100 text-slate-600'
          }`}>
            {documentRecords.length}
          </span>
        </button>
      </div>

      {/* SUB-TAB 1: GUEST DIRECTORY */}
      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          {/* Search, Filter Bar and Sorting */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-luxury-brown-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by guest name, mobile, email, Aadhaar, room number or city..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-luxury-brown-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500 transition-all bg-luxury-beige-50/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-luxury-brown-400 hover:text-luxury-brown-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#FBF4E0] text-[#17120F] border border-[#C49A3A] font-bold shadow-2xs'
                : 'bg-luxury-beige-100 text-luxury-brown-700 hover:bg-luxury-beige-200'
            }`}
          >
            All Guests ({allGuests.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in-house')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusFilter === 'in-house'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            In-House ({stats.inHouseCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusFilter === 'upcoming'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('vip')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusFilter === 'vip'
                ? 'bg-luxury-gold-600 text-luxury-brown-950 font-bold shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            ★ VIP & Loyal ({stats.repeatCount})
          </button>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-luxury-brown-400 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-luxury-brown-200 bg-luxury-beige-50/50 text-luxury-brown-900 focus:outline-hidden focus:ring-1 focus:ring-luxury-gold-500 cursor-pointer"
          >
            <option value="recent">Most Recent Stay</option>
            <option value="stays">Total Stays Count</option>
            <option value="spent">Highest Spend (LTV)</option>
            <option value="name">Guest Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Date-Wise Filter Bar (Row 5: All / Today / Yesterday / Specific Date / This Month / Range) */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-luxury-brown-100 shadow-2xs flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono font-bold text-luxury-brown-600 uppercase mr-1">Date-Wise Filter:</span>
        {([
          ['All', `All (${allGuests.length})`],
          ['Today', 'Today'],
          ['Yesterday', 'Yesterday'],
          ['Date', 'Specific Date'],
          ['This Month', 'This Month'],
          ['Range', 'From → To Range']
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setGuestDateFilterType(key)}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
              guestDateFilterType === key
                ? 'bg-luxury-brown-900 text-white border-luxury-brown-900 shadow-2xs'
                : 'bg-white text-luxury-brown-700 border-luxury-brown-200 hover:bg-luxury-beige-50'
            }`}
          >
            {label}
          </button>
        ))}
        {guestDateFilterType === 'Date' && (
          <input
            type="date"
            value={guestFilterSingleDate}
            onChange={e => setGuestFilterSingleDate(e.target.value)}
            className="px-2.5 py-1 border border-luxury-brown-200 rounded-lg bg-white font-mono text-xs font-bold"
          />
        )}
        {guestDateFilterType === 'Range' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="date"
              value={guestFilterStartDate}
              onChange={e => setGuestFilterStartDate(e.target.value)}
              className="px-2.5 py-1 border border-luxury-brown-200 rounded-lg bg-white font-mono text-xs"
            />
            <span className="text-luxury-brown-500 font-bold">→</span>
            <input
              type="date"
              value={guestFilterEndDate}
              onChange={e => setGuestFilterEndDate(e.target.value)}
              className="px-2.5 py-1 border border-luxury-brown-200 rounded-lg bg-white font-mono text-xs"
            />
          </div>
        )}
      </div>

      {/* Guest Directory List / Table */}
      <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
        {filteredGuests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-luxury-beige-100 text-luxury-brown-400 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-serif font-bold text-luxury-brown-950 mb-1">No Guest Records Found</h3>
            <p className="text-sm text-luxury-brown-500 max-w-md mx-auto mb-6">
              {searchQuery ? `No guests match "${searchQuery}". Try searching with a different name or number.` : 'Start registering guest profiles or check-in guests to build your property directory.'}
            </p>
            <button
              type="button"
              onClick={() => setShowAddGuestModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Register First Guest
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-luxury-beige-50/80 border-b border-luxury-brown-100 text-[11px] font-bold text-luxury-brown-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Guest Profile</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Govt ID & City</th>
                  <th className="py-3.5 px-4">Stay Status</th>
                  <th className="py-3.5 px-4">Visits & Spend</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100 text-xs">
                {filteredGuests.map((guest) => {
                  const initials = guest.name
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'G';

                  const cleanPhone = guest.mobile.replace(/\D/g, '').slice(-10);

                  return (
                    <tr key={guest.id} className="hover:bg-luxury-beige-50/50 transition-colors group">
                      {/* Column 1: Guest Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs relative ${
                            guest.isVip || guest.totalStays > 1
                              ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
                              : 'bg-luxury-brown-100 text-luxury-brown-800'
                          }`}>
                            {initials}
                            {(guest.isVip || guest.totalStays > 1) && (
                              <span className="absolute -top-1 -right-1 bg-luxury-gold-400 text-luxury-brown-950 rounded-full p-0.5 shadow-xs" title="VIP Repeat Guest">
                                <Crown className="w-2.5 h-2.5 fill-current" />
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-serif font-bold text-luxury-brown-950 text-sm flex items-center gap-1.5">
                              {guest.name}
                              {guest.isVip && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                                  VIP
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-luxury-brown-400 flex items-center gap-1.5 mt-0.5">
                              <span>{guest.nationality || 'Indian'}</span>
                              {guest.companyName && (
                                <>
                                  <span>•</span>
                                  <span className="text-luxury-brown-600 font-medium">{guest.companyName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${guest.mobile}`}
                              className="font-mono text-luxury-brown-900 font-medium hover:text-luxury-gold-600 flex items-center gap-1 transition-colors"
                              title="Call Guest"
                            >
                              <Phone className="w-3 h-3 text-luxury-brown-400" />
                              {guest.mobile}
                            </a>
                            {cleanPhone.length === 10 && (
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(guest.name)},%20greetings%20from%20${encodeURIComponent(hotelName)}!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          {guest.email ? (
                            <div className="text-[11px] text-luxury-brown-500 flex items-center gap-1 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 text-luxury-brown-400 shrink-0" />
                              <span className="truncate">{guest.email}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-luxury-brown-400 italic">No email saved</span>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Govt ID & City */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {guest.idVerified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                {guest.aadhaarNumber ? `Aadhaar: •••• ${guest.aadhaarNumber.slice(-4)}` : (guest.passportNumber || 'ID Verified')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertCircle className="w-3 h-3" />
                                ID Pending
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-luxury-brown-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-luxury-brown-400 shrink-0" />
                            <span>{guest.city ? `${guest.city}${guest.state ? `, ${guest.state}` : ''}` : (guest.address || 'Address unlisted')}</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Stay Status */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div>
                            {guest.currentStatus === 'In-House' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                In-House ({guest.lastRoomNumber || 'Rm'})
                              </span>
                            ) : guest.currentStatus === 'Upcoming' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                <Clock className="w-3 h-3 text-blue-600" />
                                Upcoming ({guest.lastStayDate || 'Soon'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                                Past Guest
                              </span>
                            )}
                          </div>
                          {guest.lastStayDate && (
                            <div className="text-[10px] text-luxury-brown-400">
                              Last: {guest.lastStayDate} {guest.lastRoomNumber && `(Rm ${guest.lastRoomNumber})`}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Visits & Spend */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-serif font-bold text-luxury-brown-950">
                            ₹{Number(guest.totalSpent || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-luxury-brown-400 flex items-center gap-1 mt-0.5">
                            <span className="font-semibold text-luxury-brown-700">{guest.totalStays} {guest.totalStays === 1 ? 'Stay' : 'Stays'}</span>
                            {guest.pendingBalance > 0 && (
                              <span className="text-rose-600 font-bold ml-1">
                                (Due: ₹{guest.pendingBalance})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedGuestForDetails(guest)}
                            className="p-1.5 rounded-lg bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-800 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="View Full Profile & Stay History"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Profile</span>
                          </button>
                          
                          {guest.currentStatus !== 'In-House' && onNavigateToCheckIn && (
                            <button
                              type="button"
                              onClick={() => onNavigateToCheckIn({
                                name: guest.name,
                                mobile: guest.mobile,
                                aadhaar: guest.aadhaarNumber,
                                address: guest.address || guest.city
                              })}
                              className="px-2.5 py-1.5 rounded-lg bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                              title="Quick Walk-In Check-In for this guest"
                            >
                              Check-In
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
    </div>
  )}

  {/* SUB-TAB 2: GUEST IDENTITY & DOCUMENTS ARCHIVE */}
  {activeSubTab === 'documents' && (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-luxury-brown-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-luxury-brown-100 pb-4">
          <div>
            <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-luxury-gold-600" />
              Guest Identity &amp; Document Archival Center
            </h3>
            <p className="text-xs text-luxury-brown-500 mt-0.5">
              Securely archive, inspect, and print Guest Registration Cards (GRC), Aadhaar scans, Passports, and GST Tax Invoices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search Guest, Mobile, Room, ID..."
                className="w-full bg-luxury-beige-50/70 border border-luxury-brown-200 rounded-xl pl-9 pr-3 py-2 text-xs text-luxury-brown-900 focus:outline-none focus:border-luxury-gold-500"
              />
              {docSearch && (
                <button
                  onClick={() => setDocSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'GRC', 'Aadhaar Card', 'Passport', 'Tax Invoice'] as const).map((cat) => {
            const count = cat === 'All'
              ? documentRecords.length
              : documentRecords.filter(d => d.type === cat).length;
            const isSel = docCategoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setDocCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSel
                    ? 'bg-[#FBF4E0] text-[#17120F] border-2 border-[#C49A3A] shadow-2xs font-extrabold'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{cat === 'All' ? 'All Document Records' : cat === 'GRC' ? 'GRC Registration Cards' : cat}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSel ? 'bg-[#C49A3A]/25 text-[#17120F]' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Document Cards Grid */}
        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center bg-luxury-beige-50/40 rounded-xl border border-dashed border-luxury-brown-200">
            <FileText className="w-10 h-10 text-luxury-brown-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-luxury-brown-800">No Documents Found</div>
            <div className="text-xs text-luxury-brown-500 mt-1">
              {docSearch ? `No document records match "${docSearch}"` : 'No documents recorded for this category yet.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => {
              const typeColor =
                doc.type === 'GRC'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : doc.type === 'Aadhaar Card'
                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                  : doc.type === 'Passport'
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300';

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-luxury-brown-200 rounded-xl p-4 space-y-3 hover:border-luxury-gold-500 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono border ${typeColor}`}>
                        {doc.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {doc.date || 'Recent'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-serif font-bold text-luxury-brown-950 text-sm">
                        {doc.guestName}
                      </h4>
                      <p className="text-xs text-slate-600 font-mono flex items-center gap-1.5 mt-0.5">
                        <span className="font-bold text-luxury-brown-900">Room {doc.roomNumber}</span>
                        <span>•</span>
                        <span>{doc.mobile}</span>
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Ref / ID No:</span>
                        <strong className="text-slate-900">{doc.idProofNumber}</strong>
                      </div>
                      {doc.amount !== undefined && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Amount:</span>
                          <strong className="text-emerald-700">₹{doc.amount.toLocaleString('en-IN')}</strong>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                      {doc.details}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      {doc.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingDocument(doc)}
                        className="px-2.5 py-1 bg-[#FBF4E0] hover:bg-[#F3E2B3] text-[#17120F] font-bold rounded-lg text-xs transition-colors flex items-center gap-1 border border-[#C49A3A]/60 cursor-pointer shadow-2xs"
                        title="Inspect full document details"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#8B691E]" />
                        <span>Inspect</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewingDocument(doc)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 border border-slate-300 cursor-pointer shadow-2xs"
                        title="Print document slip"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )}

      {/* MODAL 1: ADD NEW GUEST PROFILE */}
      {showAddGuestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-luxury-brown-200 relative">
            <button
              onClick={() => setShowAddGuestModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-luxury-gold-100 text-luxury-brown-900 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5 text-luxury-gold-600" />
              </div>
              <div>
                <h3 className="text-xl font-serif font-bold text-luxury-brown-950">Register New Guest Profile</h3>
                <p className="text-xs text-luxury-brown-500">Save guest particulars for instant check-in, bookings & CRM</p>
              </div>
            </div>

            <form onSubmit={handleAddNewGuestSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar Sharma"
                    value={newGuestForm.name}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9829012345"
                    value={newGuestForm.mobile}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, mobile: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="guest@example.com"
                    value={newGuestForm.email}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={newGuestForm.nationality}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, nationality: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    Aadhaar Number (Govt ID)
                  </label>
                  <input
                    type="text"
                    placeholder="12-digit Aadhaar Number"
                    value={newGuestForm.aadhaarNumber}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, aadhaarNumber: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    Passport (if Foreign Guest)
                  </label>
                  <input
                    type="text"
                    placeholder="Passport Number"
                    value={newGuestForm.passportNumber}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, passportNumber: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    City & State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jaipur, Rajasthan"
                    value={newGuestForm.city}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, city: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                    Company Name / Business (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Corporate Client / Firm"
                    value={newGuestForm.companyName}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, companyName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-luxury-brown-800 mb-1">
                  Full Postal Address
                </label>
                <input
                  type="text"
                  placeholder="House/Street, Landmark, District, Pincode"
                  value={newGuestForm.address}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-luxury-brown-200 text-xs focus:ring-2 focus:ring-luxury-gold-500/30 focus:border-luxury-gold-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newGuestForm.isVip}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, isVip: e.target.checked })}
                    className="w-4 h-4 rounded text-luxury-gold-600 focus:ring-luxury-gold-500 border-luxury-brown-300"
                  />
                  <span className="text-xs font-bold text-luxury-brown-900 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-luxury-gold-500" />
                    Mark as VIP Patron / Priority Guest
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setShowAddGuestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-luxury-brown-600 hover:bg-luxury-beige-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl text-xs font-bold bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 transition-all shadow-md cursor-pointer"
                >
                  Save Guest Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GUEST PROFILE & STAY HISTORY VIEW */}
      {selectedGuestForDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-luxury-brown-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedGuestForDetails(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Header */}
            <div className="flex items-start gap-4 pb-6 border-b border-luxury-brown-100">
              <div className="w-14 h-14 rounded-2xl bg-[#FBF4E0] border-2 border-[#C49A3A]/40 text-[#8B691E] font-serif font-bold text-xl flex items-center justify-center shadow-2xs">
                {selectedGuestForDetails.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-serif font-bold text-luxury-brown-950">
                    {selectedGuestForDetails.name}
                  </h3>
                  {selectedGuestForDetails.isVip && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-600" />
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-luxury-brown-500 mt-1">
                  <span className="flex items-center gap-1 font-mono font-medium text-luxury-brown-800">
                    <Phone className="w-3.5 h-3.5 text-luxury-brown-400" />
                    {selectedGuestForDetails.mobile}
                  </span>
                  {selectedGuestForDetails.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-luxury-brown-400" />
                      {selectedGuestForDetails.email}
                    </span>
                  )}
                  {selectedGuestForDetails.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-luxury-brown-400" />
                      {selectedGuestForDetails.city}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="bg-luxury-beige-50 rounded-xl p-3 border border-luxury-brown-100 text-center">
                <div className="text-[10px] uppercase font-bold text-luxury-brown-400">Total Visits</div>
                <div className="text-lg font-serif font-bold text-luxury-brown-950 mt-0.5">{selectedGuestForDetails.totalStays}</div>
              </div>
              <div className="bg-luxury-beige-50 rounded-xl p-3 border border-luxury-brown-100 text-center">
                <div className="text-[10px] uppercase font-bold text-luxury-brown-400">Total Lifetime Spend</div>
                <div className="text-lg font-serif font-bold text-luxury-gold-700 mt-0.5">₹{Number(selectedGuestForDetails.totalSpent || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-luxury-beige-50 rounded-xl p-3 border border-luxury-brown-100 text-center">
                <div className="text-[10px] uppercase font-bold text-luxury-brown-400">Current Status</div>
                <div className="text-xs font-bold text-emerald-700 mt-1">{selectedGuestForDetails.currentStatus}</div>
              </div>
            </div>

            {/* Detailed Particulars */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-luxury-brown-500">Government Identity Particulars</h4>
              <div className="bg-luxury-beige-50/60 rounded-xl p-4 border border-luxury-brown-100 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-luxury-brown-400 block text-[10px]">Aadhaar Number</span>
                    <span className="font-mono font-bold text-luxury-brown-900">{selectedGuestForDetails.aadhaarNumber || 'Not submitted'}</span>
                  </div>
                  <div>
                    <span className="text-luxury-brown-400 block text-[10px]">Passport (Foreign)</span>
                    <span className="font-mono font-bold text-luxury-brown-900">{selectedGuestForDetails.passportNumber || 'N/A'}</span>
                  </div>
                </div>
                {selectedGuestForDetails.address && (
                  <div className="pt-2 border-t border-luxury-brown-100">
                    <span className="text-luxury-brown-400 block text-[10px]">Permanent Address</span>
                    <span className="text-luxury-brown-800">{selectedGuestForDetails.address}</span>
                  </div>
                )}
              </div>

              {/* Stay History List */}
              <h4 className="text-xs font-bold uppercase tracking-wider text-luxury-brown-500 pt-2">Stay History & Reservations</h4>
              {selectedGuestForDetails.history.length === 0 ? (
                <div className="p-4 rounded-xl bg-luxury-beige-50 text-center text-xs text-luxury-brown-400">
                  No previous check-in or stay records logged yet for this guest.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedGuestForDetails.history.map((h, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-luxury-beige-50/70 border border-luxury-brown-100 text-xs">
                      <div>
                        <div className="font-bold text-luxury-brown-950 flex items-center gap-2">
                          <Bed className="w-3.5 h-3.5 text-luxury-gold-600" />
                          <span>Room {h.roomNumber || 'Assigned'}</span>
                          <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-luxury-brown-100 text-luxury-brown-700">
                            {h.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-luxury-brown-400 mt-0.5">
                          Check-In: {h.date} {h.checkOutDate ? `➔ Check-Out: ${h.checkOutDate}` : ''}
                        </div>
                      </div>
                      <div className="font-serif font-bold text-luxury-brown-950 text-right">
                        ₹{Number(h.amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Guest Uploaded Documents & Archival Records */}
              <h4 className="text-xs font-bold uppercase tracking-wider text-luxury-brown-500 pt-3 flex items-center justify-between border-t border-luxury-brown-100">
                <span>📁 Uploaded Documents &amp; Digital Records</span>
                <span className="text-[10px] text-slate-500 font-normal">Compliant with Police Sarai Act</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Aadhaar / ID Card */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Aadhaar / Govt ID Proof
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {selectedGuestForDetails.aadhaarNumber ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-900 mt-2">
                      {selectedGuestForDetails.aadhaarNumber || 'Not Submitted'}
                    </div>
                  </div>
                  {selectedGuestForDetails.aadhaarNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        const rec = documentRecords.find(d => d.guestName === selectedGuestForDetails.name && d.type === 'Aadhaar Card') || {
                          id: `adh_view_${selectedGuestForDetails.id}`,
                          guestName: selectedGuestForDetails.name,
                          mobile: selectedGuestForDetails.mobile,
                          roomNumber: selectedGuestForDetails.lastRoomNumber || '-',
                          type: 'Aadhaar Card',
                          idProofNumber: selectedGuestForDetails.aadhaarNumber,
                          date: selectedGuestForDetails.lastStayDate || '',
                          status: 'Verified',
                          details: `Govt Aadhaar ID proof for ${selectedGuestForDetails.name}`
                        };
                        setViewingDocument(rec);
                      }}
                      className="mt-2 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" /> Inspect ID Slip
                    </button>
                  )}
                </div>

                {/* GRC Card */}
                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        Guest Registration (GRC)
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Digital
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-900 mt-1">
                      Registration card with stay terms &amp; guest signature
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const matchedCheckin = checkins.find(c => c.guestName === selectedGuestForDetails.name || c.mobile === selectedGuestForDetails.mobile);
                      const rec = {
                        id: `grc_${selectedGuestForDetails.id}`,
                        guestName: selectedGuestForDetails.name,
                        mobile: selectedGuestForDetails.mobile,
                        roomNumber: selectedGuestForDetails.lastRoomNumber || 'Assigned',
                        type: 'GRC',
                        idProofNumber: matchedCheckin?.grcNumber || `GRC-${selectedGuestForDetails.id.slice(-6)}`,
                        date: selectedGuestForDetails.lastStayDate || new Date().toISOString().split('T')[0],
                        checkInDate: matchedCheckin?.checkInDate || selectedGuestForDetails.lastStayDate,
                        checkOutDate: matchedCheckin?.checkOutDate,
                        amount: matchedCheckin?.totalAmount || selectedGuestForDetails.totalSpent,
                        status: 'System Generated',
                        details: `Digital GRC Form for ${selectedGuestForDetails.name}`,
                        rawCheckin: matchedCheckin
                      };
                      setViewingDocument(rec);
                    }}
                    className="mt-2 text-[10px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3 h-3" /> View / Print GRC Card
                  </button>
                </div>

                {/* Tax Invoices */}
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-col justify-between sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                      GST Tax Invoices &amp; Folios
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800">
                      Total Spent: ₹{Number(selectedGuestForDetails.totalSpent || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {invoices.filter(i => i.guestName === selectedGuestForDetails.name || (i.guestMobile && i.guestMobile.slice(-10) === selectedGuestForDetails.mobile.slice(-10))).length > 0 ? (
                      invoices.filter(i => i.guestName === selectedGuestForDetails.name || (i.guestMobile && i.guestMobile.slice(-10) === selectedGuestForDetails.mobile.slice(-10))).map(inv => (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => {
                            setViewingDocument({
                              id: `inv_${inv.id}`,
                              guestName: inv.guestName || selectedGuestForDetails.name,
                              mobile: inv.guestMobile || selectedGuestForDetails.mobile,
                              roomNumber: inv.roomNumber || '-',
                              type: 'Tax Invoice',
                              idProofNumber: inv.invoiceNumber || `INV-${inv.id}`,
                              date: inv.date || '',
                              amount: Number(inv.totalAmount ?? (inv as any).grandTotal ?? 0),
                              status: 'System Generated',
                              details: `GST Tax Invoice ${inv.invoiceNumber}`,
                              rawInvoice: inv
                            });
                          }}
                          className="px-2.5 py-1 bg-white border border-emerald-300 rounded text-[10px] font-mono font-bold text-emerald-900 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{inv.invoiceNumber || 'Invoice'}</span>
                          <span className="text-emerald-700">₹{Number(inv.totalAmount || 0).toLocaleString('en-IN')}</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No separate invoices generated yet.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Footer */}
            <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-luxury-brown-100">
              <a
                href={`https://wa.me/91${selectedGuestForDetails.mobile.replace(/\D/g, '').slice(-10)}?text=Hello%20${encodeURIComponent(selectedGuestForDetails.name)},%20greetings%20from%20${encodeURIComponent(hotelName)}!`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Message
              </a>

              <div className="flex items-center gap-2">
                {onNavigateToCheckIn && selectedGuestForDetails.currentStatus !== 'In-House' && (
                  <button
                    type="button"
                    onClick={() => {
                      const g = selectedGuestForDetails;
                      setSelectedGuestForDetails(null);
                      onNavigateToCheckIn({
                        name: g.name,
                        mobile: g.mobile,
                        aadhaar: g.aadhaarNumber,
                        address: g.address || g.city
                      });
                    }}
                    className="px-4 py-2 rounded-xl bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs transition-all cursor-pointer shadow-xs"
                  >
                    Quick Check-In
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedGuestForDetails(null)}
                  className="px-4 py-2 rounded-xl bg-luxury-brown-100 hover:bg-luxury-brown-200 text-luxury-brown-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DOCUMENT INSPECTION & PRINT MODAL */}
      {viewingDocument && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-luxury-brown-200 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setViewingDocument(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Document Header */}
            <div className="border-b border-luxury-brown-200 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-amber-100 text-amber-900 border border-amber-300">
                    {viewingDocument.type}
                  </span>
                  <h3 className="text-xl font-serif font-bold text-luxury-brown-950 mt-1">
                    {viewingDocument.type === 'GRC'
                      ? 'Guest Registration Card (GRC)'
                      : viewingDocument.type === 'Tax Invoice'
                      ? 'Official GST Tax Invoice'
                      : 'Government Identity Proof Record'}
                  </h3>
                  <p className="text-xs text-luxury-brown-500 font-mono">
                    Ref ID: {viewingDocument.idProofNumber} • Date: {viewingDocument.date || 'Current Stay'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-serif font-bold text-luxury-gold-700 block">
                    {hotelName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Digital Archive</span>
                </div>
              </div>
            </div>

            {/* Document Body (Printable Card) */}
            <div className="p-5 rounded-2xl bg-luxury-beige-50/50 border border-luxury-brown-200 space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-b border-luxury-brown-200/60 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Guest Full Name</span>
                  <span className="font-bold text-slate-900 text-sm">{viewingDocument.guestName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Contact Mobile</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{viewingDocument.mobile}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Allocated Room</span>
                  <span className="font-mono font-bold text-luxury-gold-800 text-sm">Room {viewingDocument.roomNumber}</span>
                </div>
              </div>

              {viewingDocument.type === 'GRC' && (
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-950 block uppercase font-mono">
                      Stay &amp; Registration Particulars
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>Check-In Date: <strong className="text-slate-800">{viewingDocument.checkInDate || viewingDocument.date}</strong></div>
                      <div>Check-Out Date: <strong className="text-slate-800">{viewingDocument.checkOutDate || 'Open Stay'}</strong></div>
                      <div>GRC Number: <strong className="text-slate-800">{viewingDocument.idProofNumber}</strong></div>
                      <div>Tariff: <strong className="text-emerald-700">₹{Number(viewingDocument.amount || 0).toLocaleString('en-IN')}</strong></div>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-700 uppercase block font-mono">
                      Hotel Terms &amp; Conditions (Sarai Act Compliant)
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      1. Check-out time is strictly 11:00 AM. Late checkout is subject to availability and charges.<br />
                      2. Valid Govt Photo ID submitted and registered in accordance with Sarai Act 1867 &amp; Local Police instructions.<br />
                      3. Hotel management is not responsible for valuables not deposited in the front desk security locker.<br />
                      4. Smoking and unlawful activities are strictly prohibited inside hotel premises.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-center text-xs">
                    <div className="space-y-8">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Guest Signature</span>
                      <div className="border-t border-dashed border-slate-400 pt-1 font-serif text-slate-800 italic">
                        {viewingDocument.guestName}
                      </div>
                    </div>
                    <div className="space-y-8">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Duty Manager / Receptionist</span>
                      <div className="border-t border-dashed border-slate-400 pt-1 font-serif text-slate-800 italic">
                        Authorized Signatory
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewingDocument.type === 'Tax Invoice' && (
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-950 uppercase font-mono">
                        Tax Invoice Summary ({viewingDocument.idProofNumber})
                      </span>
                      <span className="text-sm font-mono font-black text-emerald-700">
                        Total: ₹{Number(viewingDocument.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Standard GST Invoice issued to {viewingDocument.guestName} ({viewingDocument.mobile}) for Room {viewingDocument.roomNumber}.
                    </p>
                  </div>
                </div>
              )}

              {['Aadhaar Card', 'Passport', 'Driving License / ID'].includes(viewingDocument.type) && (
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-xl border border-blue-200 space-y-2 text-center">
                    <ShieldCheck className="w-8 h-8 text-blue-600 mx-auto" />
                    <div className="text-xs font-mono font-bold uppercase text-blue-950">
                      Verified Identity Document
                    </div>
                    <div className="text-lg font-mono font-black text-slate-900 tracking-wider">
                      {viewingDocument.idProofNumber}
                    </div>
                    <p className="text-xs text-slate-500">
                      Document verified in accordance with Government Identity norms and Police Sarai reporting guidelines.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Print & Action Footer */}
            <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-luxury-brown-100">
              <span className="text-[11px] text-slate-400 font-mono">
                System Verification Record • {new Date().toLocaleDateString()}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingDocument(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C49A3A] hover:bg-[#B0862B] text-[#17120F] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
