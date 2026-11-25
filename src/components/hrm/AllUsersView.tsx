import React, { useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  Search,
  ShieldCheck,
  CheckCircle2,
  CalendarRange,
} from 'lucide-react';
import { Staff, Booking, CheckInRecord } from '../../types';
import { showToast } from '../../utils/toast';

interface AllUsersViewProps {
  staff: Staff[];
  checkins?: CheckInRecord[];
  bookings?: Booking[];
  hotelName?: string;
  onOpenEditStaff?: (member: Staff) => void;
  onSendWhatsAppCredentials?: (member: Staff) => void;
}

export default function AllUsersView({
  staff = [],
  checkins = [],
  bookings = [],
  hotelName = 'DirectStay Hotel',
  onOpenEditStaff,
  onSendWhatsAppCredentials,
}: AllUsersViewProps) {
  const [activeUserTab, setActiveUserTab] = useState<'all' | 'staff' | 'guests' | 'advance'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestFilter, setGuestFilter] = useState<'all' | 'in_house' | 'checkout'>('all');
  const [advanceFilter, setAdvanceFilter] = useState<'all' | 'confirmed' | 'pending'>('all');

  // 1. Derive unique real guests list from checkins & bookings (no hardcoded demo users)
  const guestsList = useMemo(() => {
    const map = new Map<
      string,
      {
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
      }
    >();

    // From checkins
    (checkins || []).forEach((c) => {
      const gName = c.guestName || (c as any).primaryGuestName || 'Guest';
      const phone = String((c as any).mobile || (c as any).guestPhone || (c as any).phone || '').trim();
      const key = phone || gName.toLowerCase();
      const existing = map.get(key);
      const spend = Number((c as any).totalAmount ?? (c as any).tariffCharged ?? (c as any).roomRate ?? 0);
      const isInHouse =
        !(c as any).checkedOutDateTime &&
        String((c as any).status || '').toLowerCase() !== 'checked-out' &&
        String((c as any).status || '').toLowerCase() !== 'checked out';
      const statusVal: 'In-House' | 'Checked Out' = isInHouse ? 'In-House' : 'Checked Out';

      if (existing) {
        existing.totalStays += 1;
        existing.totalSpend += spend;
        if (c.checkInDate && c.checkInDate >= existing.lastVisitDate) {
          existing.lastVisitDate = c.checkInDate;
          existing.currentStatus = statusVal;
          existing.lastRoom = c.roomNumber;
        }
      } else {
        map.set(key, {
          id: c.id || `GST-${map.size + 101}`,
          name: gName,
          mobile: phone || '—',
          email: (c as any).emailAddress || (c as any).guestEmail || (c as any).email || '—',
          idProofNumber: (c as any).idNumber || (c as any).idProofNumber || (c as any).aadhaarNumber || '',
          idProofType: (c as any).idType || (c as any).idProofType || 'Government ID',
          city: [((c as any).city || '').trim(), ((c as any).state || '').trim()].filter(Boolean).join(', ') || (c as any).address || '—',
          totalStays: 1,
          totalSpend: spend,
          lastVisitDate: c.checkInDate || '',
          currentStatus: statusVal,
          lastRoom: c.roomNumber,
        });
      }
    });

    // From bookings if not already in checkins
    (bookings || []).forEach((b) => {
      if (String(b.status || '').toLowerCase() === 'cancelled') return;
      const gName = b.guestName || (b as any).customerName || 'Booking Guest';
      const phone = String(b.mobile || (b as any).guestPhone || (b as any).phone || '').trim();
      const key = phone || gName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: b.id || `GST-${map.size + 101}`,
          name: gName,
          mobile: phone || '—',
          email: (b as any).guestEmail || (b as any).email || '—',
          idProofNumber: (b as any).aadhaarNumber || (b as any).idNumber || '',
          idProofType: (b as any).idType || 'Government ID',
          city: (b as any).city || (b as any).address || '—',
          totalStays: 1,
          totalSpend: Number(b.totalAmount ?? b.bookingAmount ?? 0),
          lastVisitDate: b.checkInDate || '',
          currentStatus: b.isCheckedIn ? 'In-House' : b.isCompleted ? 'Checked Out' : 'Upcoming',
          lastRoom: b.roomNumber,
        });
      }
    });

    return Array.from(map.values());
  }, [checkins, bookings]);

  // 2. Derive real Advance / Confirmed Bookings list (no hardcoded demo bookings)
  const advanceBookingsList = useMemo(() => {
    return (bookings || [])
      .filter((b) => String(b.status || '').toLowerCase() !== 'cancelled')
      .map((b) => {
        const gName = b.guestName || (b as any).customerName || 'Guest';
        const phone = String(b.mobile || (b as any).guestPhone || (b as any).phone || '—');
        const email = (b as any).guestEmail || (b as any).email || '—';
        const roomNum = b.roomNumber || (b as any).room || 'Unassigned';
        const category = (b as any).roomType || (b as any).roomCategory || (b as any).category || 'Room';
        const checkIn = b.checkInDate || '';
        const checkOut = b.checkOutDate || '';
        const advancePaid = Number((b as any).amountPaid ?? b.advanceAmount ?? (b as any).advancePayment ?? 0);
        const total = Number(b.totalAmount ?? b.bookingAmount ?? 0);
        const balance = Number((b as any).dueAmount ?? Math.max(0, total - advancePaid));
        const source = (b as any).bookingSource || (b as any).source || 'Direct';
        const status = b.isCheckedIn ? 'In-House' : b.status || 'Confirmed';

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
  }, [bookings]);

  const q = searchQuery.trim().toLowerCase();

  const filteredStaff = staff.filter((s) => {
    if (!q) return true;
    return (
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.username || '').toLowerCase().includes(q) ||
      String(s.mobile || s.phone || '').toLowerCase().includes(q) ||
      String(s.department || '').toLowerCase().includes(q) ||
      String(s.role || '').toLowerCase().includes(q)
    );
  });

  const filteredGuests = guestsList.filter((g) => {
    const matchQ =
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.mobile.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      String(g.city || '').toLowerCase().includes(q) ||
      String(g.lastRoom || '').toLowerCase().includes(q);

    if (guestFilter === 'in_house') return matchQ && g.currentStatus === 'In-House';
    if (guestFilter === 'checkout') return matchQ && g.currentStatus === 'Checked Out';
    return matchQ;
  });

  const filteredAdvance = advanceBookingsList.filter((b) => {
    const matchQ =
      !q ||
      b.guestName.toLowerCase().includes(q) ||
      b.phone.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      String(b.roomNumber || '').toLowerCase().includes(q);

    if (advanceFilter === 'confirmed')
      return matchQ && (b.status === 'Confirmed' || b.status === 'Advance Paid' || b.status === 'In-House');
    if (advanceFilter === 'pending') return matchQ && b.balanceDue > 0;
    return matchQ;
  });

  const totalAllUsersCount = staff.length + guestsList.length;

  return (
    <div className="space-y-6">
      {/* Top Banner (Add Staff removed — Staff onboarding lives under HRM -> Staff Directory) */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold-600" /> Multi-Category Directory &amp; Governance
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Users Directory &amp; Stakeholder Accounts
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Complete directory of Hotel Staff Accounts, Guest Customers, and Bookings for {hotelName}. (To onboard new staff, use <strong>HRM → Staff Directory</strong>.)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-luxury-beige-50 border border-luxury-brown-200 text-luxury-brown-900 font-bold">
            Total Users: {totalAllUsersCount}
          </span>
        </div>
      </div>

      {/* Primary Sub-Tabs: All Users / Staff Accounts / Guest Customers / Bookings */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex p-1.5 bg-luxury-beige-100/80 rounded-2xl border border-luxury-brown-100 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveUserTab('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeUserTab === 'all'
                ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-sm'
                : 'text-luxury-brown-700 hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>All Users</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-luxury-gold-500/20 text-luxury-gold-400">
              {totalAllUsersCount}
            </span>
          </button>

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
                ? 'Search guest by name, mobile, room...'
                : activeUserTab === 'advance'
                ? 'Search bookings by guest, ID, room...'
                : 'Search all users by name, mobile, role...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-900 focus:outline-none"
          />
        </div>
      </div>

      {/* --- CATEGORY 0: UNIFIED ALL USERS (STAFF + GUESTS) --- */}
      {activeUserTab === 'all' && (
        <div className="bg-white border border-luxury-brown-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                  <th className="py-2.5 px-4">User Name</th>
                  <th className="py-2.5 px-4">Category / Role</th>
                  <th className="py-2.5 px-4">Contact &amp; Email</th>
                  <th className="py-2.5 px-4">Room / Login ID</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {filteredStaff.length === 0 && filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-luxury-brown-400 font-mono">
                      No users match your search filter.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredStaff.map((s) => (
                      <tr key={`staff-${s.id}`} className="hover:bg-luxury-beige-50/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-luxury-brown-950 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-luxury-gold-600" />
                            {s.name}
                          </div>
                          <div className="text-[10px] font-mono text-luxury-brown-500">
                            {s.designation || s.role || 'Staff'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            Staff • {s.role || s.department || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <div className="text-luxury-brown-900 font-semibold">{s.mobile || s.phone || '—'}</div>
                          <div className="text-[10px] text-luxury-brown-500">{s.email || '—'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-luxury-gold-700 font-bold">
                          @{s.username || 'staff'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {s.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredGuests.map((g) => (
                      <tr key={`guest-${g.id}`} className="hover:bg-luxury-beige-50/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-luxury-brown-950 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-luxury-gold-600" />
                            {g.name}
                          </div>
                          <div className="text-[10px] font-mono text-luxury-brown-500">{g.city}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            Guest • {g.totalStays} stay(s)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <div className="text-luxury-brown-900 font-semibold">{g.mobile}</div>
                          <div className="text-[10px] text-luxury-brown-500">{g.email}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-luxury-brown-800 font-semibold">
                          {g.lastRoom ? `Room ${g.lastRoom}` : '—'}
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
                            {g.currentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                      No staff accounts found. Onboard staff accounts in HRM → Staff Directory.
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
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {s.status || 'Active'}
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
                        <div className="font-mono text-luxury-brown-800 font-semibold">
                          {g.idProofNumber || 'Verified on Check-In'}
                        </div>
                        <div className="text-[10px] font-mono text-luxury-gold-700">{g.idProofType}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-luxury-brown-950">{g.totalStays} stay(s)</span>
                        <div className="text-[10px] text-luxury-brown-400">Last: {g.lastVisitDate || '—'}</div>
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
                          onClick={() => showToast(`Guest ${g.name} (${g.lastRoom ? `Room ${g.lastRoom}` : 'No room'})`, 'info')}
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
                  Confirmed / Active
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
              Showing <strong>{filteredAdvance.length}</strong> Booking(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-luxury-brown-100 text-[10px] font-mono uppercase text-luxury-brown-500 bg-luxury-beige-50/70">
                  <th className="py-2.5 px-4">Booking Ref / Guest</th>
                  <th className="py-2.5 px-4">Room &amp; Category</th>
                  <th className="py-2.5 px-4">Stay Schedule</th>
                  <th className="py-2.5 px-4">Amount Paid</th>
                  <th className="py-2.5 px-4">Total &amp; Balance</th>
                  <th className="py-2.5 px-4">Booking Channel</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-luxury-brown-100">
                {filteredAdvance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-luxury-brown-400 font-mono">
                      No bookings match your filter.
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
                        <div className="text-luxury-brown-800 font-bold">{b.checkInDate || '—'}</div>
                        <div className="text-[10px] text-luxury-brown-400">To: {b.checkOutDate || '—'}</div>
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
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {b.status}
                        </span>
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
