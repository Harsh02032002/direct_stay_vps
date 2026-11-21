import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Search,
  Key,
  ShieldCheck,
  Smartphone,
  Mail,
  Calendar,
  ExternalLink,
  Receipt,
  Eye,
  CheckCircle2,
  Lock,
  Plus,
  CalendarRange,
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Staff, Booking, CheckInRecord } from '../../types';
import { showToast } from '../../utils/toast';

interface AllUsersViewProps {
  staff: Staff[];
  checkins?: CheckInRecord[];
  bookings?: Booking[];
  hotelName?: string;
  onOpenAddStaff?: () => void;
  onOpenEditStaff?: (member: Staff) => void;
  onSendWhatsAppCredentials?: (member: Staff) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function AllUsersView({
  staff = [],
  checkins = [],
  bookings = [],
  hotelName = 'DirectStay Hotel',
  onOpenAddStaff,
  onOpenEditStaff,
  onSendWhatsAppCredentials,
  onAddAuditLog,
}: AllUsersViewProps) {
  const [activeUserTab, setActiveUserTab] = useState<'staff' | 'guests' | 'advance'>('staff');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestFilter, setGuestFilter] = useState<'all' | 'in_house' | 'checkout'>('all');
  const [advanceFilter, setAdvanceFilter] = useState<'all' | 'confirmed' | 'pending'>('all');

  // 1. Derive unique guests list from checkins & bookings
  const guestsList = React.useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      mobile: string;
      email: string;
      idProofNumber?: string;
      idProofType?: string;
      city?: string;
      totalStays: number;
      totalSpend: number;
      lastVisitDate: string;
      currentStatus: 'In-House' | 'Checked Out' | 'Upcoming';
      lastRoom?: string;
    }>();

    // From checkins
    checkins.forEach((c) => {
      const gName = c.guestName || (c as any).primaryGuestName || 'Guest';
      const phone = c.guestPhone || (c as any).phone || '';
      const key = phone || gName;
      const existing = map.get(key);
      const spend = Number(c.tariffCharged || (c as any).totalAmount || 0);
      const statusVal = c.status === 'Checked-In' ? 'In-House' : 'Checked Out';

      if (existing) {
        existing.totalStays += 1;
        existing.totalSpend += spend;
        if (c.checkInDate && c.checkInDate > existing.lastVisitDate) {
          existing.lastVisitDate = c.checkInDate;
          existing.currentStatus = statusVal;
          existing.lastRoom = c.roomNumber;
        }
      } else {
        map.set(key, {
          id: `GST-${map.size + 101}`,
          name: gName,
          mobile: phone,
          email: (c as any).guestEmail || (c as any).email || 'guest@example.com',
          idProofNumber: (c as any).idProofNumber || (c as any).idNumber,
          idProofType: (c as any).idProofType || 'Aadhaar Card',
          city: (c as any).city || (c as any).address || 'Chandigarh',
          totalStays: 1,
          totalSpend: spend,
          lastVisitDate: c.checkInDate || new Date().toISOString().split('T')[0],
          currentStatus: statusVal,
          lastRoom: c.roomNumber,
        });
      }
    });

    // From bookings if not in checkins
    bookings.forEach((b) => {
      const gName = (b as any).guestName || (b as any).customerName || 'Booking Guest';
      const phone = (b as any).guestPhone || (b as any).phone || '';
      const key = phone || gName;
      if (!map.has(key)) {
        map.set(key, {
          id: `GST-${map.size + 101}`,
          name: gName,
          mobile: phone,
          email: (b as any).guestEmail || 'customer@directstay.online',
          city: 'Domestic Traveller',
          totalStays: 1,
          totalSpend: Number(b.totalAmount || 0),
          lastVisitDate: b.checkInDate || new Date().toISOString().split('T')[0],
          currentStatus: 'Upcoming',
          lastRoom: b.roomNumber,
        });
      }
    });

    // If empty fallback demo guests for rich UI rendering
    if (map.size === 0) {
      map.set('9876543210', {
        id: 'GST-101',
        name: 'Rajesh Sharma',
        mobile: '9876543210',
        email: 'rajesh.sharma@gmail.com',
        idProofNumber: '4892-1092-4821',
        idProofType: 'Aadhaar Card',
        city: 'New Delhi, India',
        totalStays: 3,
        totalSpend: 14500,
        lastVisitDate: '2026-11-21',
        currentStatus: 'In-House',
        lastRoom: '102',
      });
      map.set('9812345678', {
        id: 'GST-102',
        name: 'Simranjeet Singh',
        mobile: '9812345678',
        email: 'simran.singh@yahoo.com',
        idProofNumber: 'Z82910481',
        idProofType: 'Passport',
        city: 'Ludhiana, Punjab',
        totalStays: 1,
        totalSpend: 4200,
        lastVisitDate: '2026-11-18',
        currentStatus: 'Checked Out',
        lastRoom: '204',
      });
    }

    return Array.from(map.values());
  }, [checkins, bookings]);

  // 2. Derive Advance Bookings list
  const advanceBookingsList = React.useMemo(() => {
    const list = (bookings || []).map((b) => {
      const gName = (b as any).guestName || (b as any).customerName || 'Advance Guest';
      const phone = (b as any).guestPhone || (b as any).phone || (b as any).customerPhone || '+91 98765 00000';
      const email = (b as any).guestEmail || (b as any).email || 'guest@directstay.online';
      const roomNum = b.roomNumber || (b as any).room || 'Assigned on Arrival';
      const category = (b as any).roomType || (b as any).roomCategory || (b as any).category || 'Deluxe Room';
      const checkIn = b.checkInDate || (b as any).arrivalDate || new Date().toISOString().split('T')[0];
      const checkOut = b.checkOutDate || (b as any).departureDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const advancePaid = Number((b as any).advancePayment || (b as any).advancePaid || 0);
      const total = Number(b.totalAmount || (b as any).tariff || 3500);
      const balance = Math.max(0, total - advancePaid);
      const source = (b as any).bookingSource || (b as any).source || 'Direct Website';
      const status = b.status || 'Confirmed';

      return {
        id: b.id,
        guestName: gName,
        phone,
        email,
        roomNumber: roomNum,
        category,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        advancePaid,
        totalAmount: total,
        balanceDue: balance,
        source,
        status,
      };
    });

    if (list.length === 0) {
      return [
        {
          id: 'BK-2026-8910',
          guestName: 'Amit Roy',
          phone: '+91 98888 12345',
          email: 'amit.roy@techmail.com',
          roomNumber: '105',
          category: 'Executive Suite',
          checkInDate: '2026-11-23',
          checkOutDate: '2026-11-25',
          advancePaid: 3500,
          totalAmount: 7000,
          balanceDue: 3500,
          source: 'Direct Phone / Walk-in',
          status: 'Confirmed',
        },
        {
          id: 'BK-2026-8911',
          guestName: 'Neha Verma',
          phone: '+91 97777 54321',
          email: 'neha.v@consulting.in',
          roomNumber: '201',
          category: 'Luxury Deluxe',
          checkInDate: '2026-11-24',
          checkOutDate: '2026-11-26',
          advancePaid: 5000,
          totalAmount: 5000,
          balanceDue: 0,
          source: 'Direct Website',
          status: 'Advance Paid',
        },
      ];
    }

    return list;
  }, [bookings]);

  // Filtered lists
  const filteredStaff = staff.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.username && s.username.toLowerCase().includes(q)) ||
      (s.mobile && s.mobile.includes(q)) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.role && s.role.toLowerCase().includes(q))
    );
  });

  const filteredGuests = guestsList.filter((g) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      g.name.toLowerCase().includes(q) ||
      g.mobile.includes(q) ||
      g.email.toLowerCase().includes(q) ||
      (g.city && g.city.toLowerCase().includes(q));

    if (guestFilter === 'in_house') return matchQ && g.currentStatus === 'In-House';
    if (guestFilter === 'checkout') return matchQ && g.currentStatus === 'Checked Out';
    return matchQ;
  });

  const filteredAdvance = advanceBookingsList.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      b.guestName.toLowerCase().includes(q) ||
      b.phone.includes(q) ||
      b.id.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      b.roomNumber.toLowerCase().includes(q);

    if (advanceFilter === 'confirmed') return matchQ && (b.status === 'Confirmed' || b.status === 'Advance Paid');
    if (advanceFilter === 'pending') return matchQ && b.balanceDue > 0;
    return matchQ;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> Multi-Category Directory &amp; Governance
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Users Directory &amp; Stakeholder Accounts
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Single-pane administration of Hotel Internal Staff, Guest Customer Database, and Advance Bookings for {hotelName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeUserTab === 'staff' && onOpenAddStaff && (
            <button
              type="button"
              onClick={onOpenAddStaff}
              className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Staff Account
            </button>
          )}
        </div>
      </div>

      {/* Primary Sub-Tabs: 3 Categories (Staff / Guests / Advance Bookings) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex p-1.5 bg-luxury-beige-100/80 rounded-2xl border border-luxury-brown-100 gap-1 overflow-x-auto">
          {/* Tab 1: Staff */}
          <button
            type="button"
            onClick={() => setActiveUserTab('staff')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeUserTab === 'staff'
                ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                : 'text-luxury-brown-700 hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Accounts</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-luxury-gold-500/20 text-luxury-gold-400">
              {staff.length}
            </span>
          </button>

          {/* Tab 2: Guests */}
          <button
            type="button"
            onClick={() => setActiveUserTab('guests')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeUserTab === 'guests'
                ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                : 'text-luxury-brown-700 hover:bg-white/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Guest Customers</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-luxury-gold-500/20 text-luxury-gold-400">
              {guestsList.length}
            </span>
          </button>

          {/* Tab 3: Advance Bookings */}
          <button
            type="button"
            onClick={() => setActiveUserTab('advance')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeUserTab === 'advance'
                ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                : 'text-luxury-brown-700 hover:bg-white/60'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>Advance Bookings</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-luxury-gold-500/20 text-luxury-gold-400">
              {advanceBookingsList.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-luxury-brown-400" />
          <input
            type="text"
            placeholder={
              activeUserTab === 'staff'
                ? 'Search staff by name, user ID, role...'
                : activeUserTab === 'guests'
                ? 'Search guest by name, mobile, email...'
                : 'Search advance bookings by guest, ID, room...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-900 focus:outline-none"
          />
        </div>
      </div>

      {/* --- CATEGORY 1: STAFF ACCOUNTS --- */}
      {activeUserTab === 'staff' && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                  <th className="py-2.5 px-4">Employee Name</th>
                  <th className="py-2.5 px-4">Login ID / Username</th>
                  <th className="py-2.5 px-4">Role &amp; Department</th>
                  <th className="py-2.5 px-4">Mobile &amp; WhatsApp</th>
                  <th className="py-2.5 px-4">Account Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-luxury-brown-400 font-mono">
                      No staff accounts match your search filter. Click "+ Add Staff Account" to onboard.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-luxury-beige-50/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-luxury-brown-950 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-luxury-gold-600" />
                          {s.name}
                        </div>
                        <div className="text-[10px] font-mono text-luxury-brown-500">{s.designation || s.role}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-luxury-gold-700 bg-luxury-gold-500/10 px-2 py-0.5 rounded">
                          {s.username || 'staff.user'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-luxury-brown-800">{s.role || 'Staff'}</div>
                        <div className="text-[10px] font-mono text-luxury-brown-500">{s.department || 'Front Office'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-luxury-brown-700">
                        {s.mobile || s.phone || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {onSendWhatsAppCredentials && (
                            <button
                              type="button"
                              onClick={() => onSendWhatsAppCredentials(s)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                              title="Send WhatsApp Login ID & Password"
                            >
                              WhatsApp
                            </button>
                          )}
                          {onOpenEditStaff && (
                            <button
                              type="button"
                              onClick={() => onOpenEditStaff(s)}
                              className="px-2.5 py-1 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CATEGORY 2: GUEST CUSTOMER ACCOUNTS --- */}
      {activeUserTab === 'guests' && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-luxury-brown-50">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase font-bold text-luxury-brown-500">Filter Stay:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-luxury-beige-100 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setGuestFilter('all')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    guestFilter === 'all' ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs' : 'text-luxury-brown-700'
                  }`}
                >
                  All ({guestsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGuestFilter('in_house')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    guestFilter === 'in_house' ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs' : 'text-luxury-brown-700'
                  }`}
                >
                  In-House
                </button>
                <button
                  type="button"
                  onClick={() => setGuestFilter('checkout')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    guestFilter === 'checkout' ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs' : 'text-luxury-brown-700'
                  }`}
                >
                  Checked Out
                </button>
              </div>
            </div>

            <span className="text-xs font-mono text-luxury-brown-500">
              Showing <strong>{filteredGuests.length}</strong> Guest Profile(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                  <th className="py-2.5 px-4">Guest Customer</th>
                  <th className="py-2.5 px-4">Contact Details</th>
                  <th className="py-2.5 px-4">Govt ID Proof</th>
                  <th className="py-2.5 px-4">Total Stays</th>
                  <th className="py-2.5 px-4 text-right">Lifetime Spend</th>
                  <th className="py-2.5 px-4">Current Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-luxury-brown-400 font-mono">
                      No guest customer profiles match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((g) => (
                    <tr key={g.id} className="hover:bg-luxury-beige-50/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-luxury-brown-950 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-luxury-gold-600" />
                          {g.name}
                        </div>
                        <div className="text-[10px] font-mono text-luxury-brown-500">{g.city}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-luxury-brown-900 font-semibold">{g.mobile}</div>
                        <div className="text-[10px] text-luxury-brown-500">{g.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-luxury-brown-800 font-semibold">{g.idProofNumber || 'Verified on Check-In'}</div>
                        <div className="text-[10px] font-mono text-luxury-gold-700">{g.idProofType}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-luxury-brown-950">{g.totalStays} stay(s)</span>
                        <div className="text-[10px] text-luxury-brown-400">Last: {g.lastVisitDate}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-right text-emerald-700">
                        ₹{g.totalSpend.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            g.currentStatus === 'In-House'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : g.currentStatus === 'Upcoming'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-luxury-beige-100 text-luxury-brown-700 border border-luxury-brown-200'
                          }`}
                        >
                          {g.currentStatus === 'In-House' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {g.currentStatus} {g.lastRoom && `(Rm ${g.lastRoom})`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => showToast(`Opening Guest History Folio for ${g.name}...`, 'info')}
                          className="px-2.5 py-1 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                        >
                          Folio &amp; History
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CATEGORY 3: ADVANCE BOOKINGS & RESERVATIONS --- */}
      {activeUserTab === 'advance' && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-luxury-brown-50">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase font-bold text-luxury-brown-500">Filter Bookings:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-luxury-beige-100 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setAdvanceFilter('all')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    advanceFilter === 'all' ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs' : 'text-luxury-brown-700'
                  }`}
                >
                  All ({advanceBookingsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceFilter('confirmed')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    advanceFilter === 'confirmed' ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs' : 'text-luxury-brown-700'
                  }`}
                >
                  Confirmed / Paid
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceFilter('pending')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    advanceFilter === 'pending' ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs' : 'text-luxury-brown-700'
                  }`}
                >
                  Balance Due
                </button>
              </div>
            </div>

            <span className="text-xs font-mono text-luxury-brown-500">
              Showing <strong>{filteredAdvance.length}</strong> Advance Booking(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                  <th className="py-2.5 px-4">Booking Ref / Guest</th>
                  <th className="py-2.5 px-4">Room &amp; Category</th>
                  <th className="py-2.5 px-4">Stay Schedule</th>
                  <th className="py-2.5 px-4">Advance Paid</th>
                  <th className="py-2.5 px-4">Total &amp; Balance</th>
                  <th className="py-2.5 px-4">Booking Channel</th>
                  <th className="py-2.5 px-4 text-right">Status &amp; Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {filteredAdvance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-luxury-brown-400 font-mono">
                      No advance bookings match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredAdvance.map((b) => (
                    <tr key={b.id} className="hover:bg-luxury-beige-50/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-luxury-brown-950 flex items-center gap-1.5">
                          <CalendarRange className="w-3.5 h-3.5 text-luxury-gold-600" />
                          {b.guestName}
                        </div>
                        <div className="text-[10px] font-mono text-luxury-brown-500">
                          {b.id} • {b.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-luxury-brown-900">{b.category}</div>
                        <div className="text-[10px] font-mono text-luxury-gold-700">Room: {b.roomNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-luxury-brown-800 font-bold">{b.checkInDate}</div>
                        <div className="text-[10px] text-luxury-brown-400">To: {b.checkOutDate}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        ₹{b.advancePaid.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-luxury-brown-950 font-bold">₹{b.totalAmount.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-amber-800">
                          Due: ₹{b.balanceDue.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-luxury-beige-100 text-luxury-brown-800 text-[10px] font-mono font-bold">
                          {b.source}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {b.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => showToast(`Opening Advance Booking #${b.id} details...`, 'info')}
                            className="px-2.5 py-1 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                          >
                            Voucher
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
      )}
    </div>
  );
}
