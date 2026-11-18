import React, { useState, useMemo } from 'react';
import { FoodAdvanceBooking } from '../types';
import { showToast } from '../utils/toast';
import {
  Calendar,
  Plus,
  Edit,
  Trash2,
  Printer,
  CheckCircle2,
  Clock,
  Users,
  Search,
  UtensilsCrossed,
  X,
  Coins,
} from 'lucide-react';

interface FoodAdvanceBookingPanelProps {
  bookings: FoodAdvanceBooking[];
  hotelName?: string;
  loggedInUser?: string;
  onUpdateBookings: (updated: FoodAdvanceBooking[]) => void;
  onCreatePosOrderFromAdvance?: (adv: FoodAdvanceBooking) => void;
}

export default function FoodAdvanceBookingPanel({
  bookings = [],
  hotelName = 'Hotel Restaurant & Banquet',
  loggedInUser = 'Admin',
  onUpdateBookings,
  onCreatePosOrderFromAdvance,
}: FoodAdvanceBookingPanelProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodAdvanceBooking | null>(null);
  const [printSlip, setPrintSlip] = useState<FoodAdvanceBooking | null>(null);

  // Form fields matching Raghunath Sir's handwritten Food Advance Booking form
  const [bookingNumber, setBookingNumber] = useState('');
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [guestOrGroupName, setGuestOrGroupName] = useState('');
  const [mobile, setMobile] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [meals, setMeals] = useState<Array<'Breakfast' | 'Lunch' | 'Dinner'>>(['Lunch']);
  const [eventDate, setEventDate] = useState(todayStr);
  const [eventTime, setEventTime] = useState('01:00 PM');
  const [pax, setPax] = useState<string>('20');
  const [menuCuisine, setMenuCuisine] = useState('');
  const [mealTypes, setMealTypes] = useState<Array<'Veg' | 'Non-Veg'>>(['Veg']);
  const [ratePerPax, setRatePerPax] = useState<string>('350');
  const [focPax, setFocPax] = useState<string>('0');
  const [manualTotalOverride, setManualTotalOverride] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [status, setStatus] = useState<FoodAdvanceBooking['status']>('Confirmed');
  const [specialRequest, setSpecialRequest] = useState('');
  const [confirmedBy, setConfirmedBy] = useState(loggedInUser || 'Manager');

  const computedTotal = useMemo(() => {
    if (manualTotalOverride.trim() !== '') {
      return Math.max(0, Number(manualTotalOverride) || 0);
    }
    const chargeablePax = Math.max(0, (Number(pax) || 0) - (Number(focPax) || 0));
    return Math.round(chargeablePax * (Number(ratePerPax) || 0));
  }, [pax, focPax, ratePerPax, manualTotalOverride]);

  const computedBalance = useMemo(() => {
    return Math.max(0, computedTotal - (Number(advanceAmount) || 0));
  }, [computedTotal, advanceAmount]);

  const generateNextBookingNo = () => {
    const nums = bookings.map((b) => {
      const m = String(b.bookingNumber || '').match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 1000;
    });
    const maxN = nums.length > 0 ? Math.max(1000, ...nums) : 1000;
    return `FAB-${maxN + 1}`;
  };

  const openAddModal = () => {
    setEditingItem(null);
    setBookingNumber(generateNextBookingNo());
    setBookingDate(todayStr);
    setGuestOrGroupName('');
    setMobile('');
    setCompanyName('');
    setMeals(['Lunch']);
    setEventDate(todayStr);
    setEventTime('01:00 PM');
    setPax('20');
    setMenuCuisine('');
    setMealTypes(['Veg']);
    setRatePerPax('350');
    setFocPax('0');
    setManualTotalOverride('');
    setAdvanceAmount('0');
    setPaymentMethod('Cash');
    setStatus('Advance');
    setSpecialRequest('');
    setConfirmedBy(loggedInUser || 'Manager');
    setShowModal(true);
  };

  const openEditModal = (item: FoodAdvanceBooking) => {
    setEditingItem(item);
    setBookingNumber(item.bookingNumber);
    setBookingDate(item.bookingDate || todayStr);
    setGuestOrGroupName(item.guestOrGroupName);
    setMobile(item.mobile || '');
    setCompanyName(item.companyName || '');
    setMeals(item.meals?.length ? item.meals : ['Lunch']);
    setEventDate(item.eventDate || todayStr);
    setEventTime(item.eventTime || '');
    setPax(String(item.pax || 1));
    setMenuCuisine(item.menuCuisine || '');
    setMealTypes(item.mealTypes?.length ? item.mealTypes : ['Veg']);
    setRatePerPax(String(item.ratePerPax || 0));
    setFocPax(String(item.focPax || 0));
    const expectedAuto = Math.round(Math.max(0, (item.pax || 0) - (item.focPax || 0)) * (item.ratePerPax || 0));
    setManualTotalOverride(item.totalAmount !== expectedAuto ? String(item.totalAmount) : '');
    setAdvanceAmount(String(item.advanceAmount || 0));
    setPaymentMethod(item.paymentMethod || 'Cash');
    setStatus(item.status || 'Confirmed');
    setSpecialRequest(item.specialRequest || '');
    setConfirmedBy(item.confirmedBy || loggedInUser || 'Manager');
    setShowModal(true);
  };

  const toggleMeal = (m: 'Breakfast' | 'Lunch' | 'Dinner') => {
    setMeals((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const toggleMealType = (mt: 'Veg' | 'Non-Veg') => {
    setMealTypes((prev) => (prev.includes(mt) ? prev.filter((x) => x !== mt) : [...prev, mt]));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestOrGroupName.trim()) {
      showToast('Please enter Guest / Group Name.', 'warning');
      return;
    }
    if (meals.length === 0) {
      showToast('Please select at least one Meal (Breakfast / Lunch / Dinner).', 'warning');
      return;
    }

    const record: FoodAdvanceBooking = {
      id: editingItem?.id || `FAB-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      bookingNumber: bookingNumber.trim() || generateNextBookingNo(),
      bookingDate,
      guestOrGroupName: guestOrGroupName.trim(),
      mobile: mobile.trim() || undefined,
      companyName: companyName.trim() || undefined,
      meals,
      eventDate,
      eventTime: eventTime.trim() || undefined,
      pax: Math.max(1, Number(pax) || 1),
      menuCuisine: menuCuisine.trim() || 'Standard Buffet / Ala Carte',
      mealTypes: mealTypes.length > 0 ? mealTypes : ['Veg'],
      ratePerPax: Math.max(0, Number(ratePerPax) || 0),
      focPax: Math.max(0, Number(focPax) || 0),
      totalAmount: computedTotal,
      advanceAmount: Math.max(0, Number(advanceAmount) || 0),
      balanceAmount: computedBalance,
      paymentMethod,
      status,
      specialRequest: specialRequest.trim() || undefined,
      confirmedBy: confirmedBy.trim() || loggedInUser || 'Manager',
      createdAt: editingItem?.createdAt || new Date().toISOString(),
    };

    if (editingItem) {
      onUpdateBookings(bookings.map((b) => (b.id === editingItem.id ? record : b)));
      showToast(`Food Advance Booking ${record.bookingNumber} updated!`, 'success');
    } else {
      onUpdateBookings([record, ...bookings]);
      showToast(`Food Advance Booking ${record.bookingNumber} created!`, 'success');
    }
    setShowModal(false);
  };

  const handleSettleBalance = (item: FoodAdvanceBooking) => {
    const updated: FoodAdvanceBooking = {
      ...item,
      advanceAmount: item.totalAmount,
      balanceAmount: 0,
      status: 'Completed',
    };
    onUpdateBookings(bookings.map((b) => (b.id === item.id ? updated : b)));
    showToast(`Full balance settled for ${item.bookingNumber}!`, 'success');
  };

  const handleDelete = (item: FoodAdvanceBooking) => {
    if (!window.confirm(`Delete Food Advance Booking ${item.bookingNumber} (${item.guestOrGroupName})?`)) return;
    onUpdateBookings(bookings.filter((b) => b.id !== item.id));
    showToast('Food advance booking deleted.', 'info');
  };

  const filteredList = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        b.bookingNumber.toLowerCase().includes(q) ||
        b.guestOrGroupName.toLowerCase().includes(q) ||
        (b.companyName || '').toLowerCase().includes(q) ||
        (b.mobile || '').includes(q)
      );
    });
  }, [bookings, statusFilter, searchQuery]);

  const kpis = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'Cancelled');
    return {
      count: active.length,
      totalPax: active.reduce((s, b) => s + Number(b.pax || 0), 0),
      totalVal: active.reduce((s, b) => s + Number(b.totalAmount || 0), 0),
      advCollected: active.reduce((s, b) => s + Number(b.advanceAmount || 0), 0),
      pendingBal: active.reduce((s, b) => s + Number(b.balanceAmount || 0), 0),
    };
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-600 font-bold">
            POS Banquet, Group Meal &amp; Party Reservations
          </span>
          <h3 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600" />
            Food Advance Booking Register
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Book advance Breakfast / Lunch / Dinner orders for groups &amp; corporate events with Pax, FOC, Advance, Balance &amp; Printable Slip.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> + New Food Advance Booking
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] text-slate-500 font-semibold">Active Bookings</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{kpis.count}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] text-slate-500 font-semibold">Total Booked Pax</span>
          <p className="text-xl font-bold text-indigo-700 mt-1">{kpis.totalPax} Pax</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <span className="text-[11px] text-slate-500 font-semibold">Total Order Value</span>
          <p className="text-xl font-bold text-slate-900 mt-1">₹{Number(kpis.totalVal || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-3.5">
          <span className="text-[11px] text-emerald-700 font-semibold">Advance Received</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">₹{Number(kpis.advCollected || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-rose-200 rounded-xl p-3.5">
          <span className="text-[11px] text-rose-700 font-semibold">Balance Receivable</span>
          <p className="text-xl font-bold text-rose-700 mt-1">₹{Number(kpis.pendingBal || 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'Advance', 'In Process', 'Confirmed', 'Completed', 'Cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  statusFilter === st
                    ? 'bg-slate-900 text-amber-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Booking No, Guest, Company..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-mono border-b">
                <th className="p-3">Booking No</th>
                <th className="p-3">Guest / Group &amp; Company</th>
                <th className="p-3">Event Date &amp; Meal</th>
                <th className="p-3">Pax &amp; FOC</th>
                <th className="p-3">Menu / Type</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Advance</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    No food advance bookings found. Click &ldquo;+ New Food Advance Booking&rdquo; to create one.
                  </td>
                </tr>
              ) : (
                filteredList.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      <div>{b.bookingNumber}</div>
                      <div className="text-[10px] text-slate-400">Booked: {b.bookingDate}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{b.guestOrGroupName}</div>
                      {b.companyName && (
                        <div className="text-[11px] text-indigo-700 font-semibold">{b.companyName}</div>
                      )}
                      {b.mobile && <div className="text-[10px] font-mono text-slate-500">{b.mobile}</div>}
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-900">
                        {b.eventDate} {b.eventTime ? `• ${b.eventTime}` : ''}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {b.meals.map((m) => (
                          <span
                            key={m}
                            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="font-bold">{b.pax} Pax</div>
                      <div className="text-[10px] text-slate-500">
                        FOC: {b.focPax || 0} • ₹{b.ratePerPax}/pax
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800 truncate max-w-[160px]" title={b.menuCuisine}>
                        {b.menuCuisine}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700">
                        {(b.mealTypes || []).join(' + ')}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      ₹{Number(b.advanceAmount || 0).toLocaleString('en-IN')}
                      <div className="text-[10px] text-slate-400">{b.paymentMethod}</div>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-rose-700">
                      ₹{Number(b.balanceAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'Confirmed' || b.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'Cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {b.balanceAmount > 0 && b.status !== 'Cancelled' && (
                          <button
                            onClick={() => handleSettleBalance(b)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                            title="Settle Balance"
                          >
                            Settle
                          </button>
                        )}
                        {onCreatePosOrderFromAdvance && !b.convertedPosOrderId && b.status !== 'Cancelled' && (
                          <button
                            onClick={() => onCreatePosOrderFromAdvance(b)}
                            className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
                            title="Send to Kitchen / POS Order"
                          >
                            KOT
                          </button>
                        )}
                        <button
                          onClick={() => setPrintSlip(b)}
                          className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                          title="Print Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(b)}
                          className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="p-1.5 border border-rose-200 hover:bg-rose-50 rounded-lg text-rose-600 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Food Advance Booking Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-amber-300">
                  {editingItem ? `Edit Food Advance Booking (${bookingNumber})` : 'New Food Advance Booking'}
                </h3>
                <p className="text-xs text-slate-300">
                  Group Meal / Banquet / Restaurant Advance Order Form
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
              {/* Row 1: Booking No, Booking Date, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Booking No.</label>
                  <input
                    type="text"
                    value={bookingNumber}
                    onChange={(e) => setBookingNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Booking Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Booking Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FoodAdvanceBooking['status'])}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="Advance">Advance</option>
                    <option value="In Process">In Process</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Guest/Group Name, Mobile, Company */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Guest / Group Name *</label>
                  <input
                    type="text"
                    required
                    value={guestOrGroupName}
                    onChange={(e) => setGuestOrGroupName(e.target.value)}
                    placeholder="e.g. Sharma Wedding Group"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Optional Company / Org"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Row 3: Meal Checkboxes + Event Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl">
                <div>
                  <label className="block font-bold uppercase text-amber-900 mb-2">
                    Meal Session (Tick One or More) *
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {(['Breakfast', 'Lunch', 'Dinner'] as const).map((m) => (
                      <label key={m} className="inline-flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={meals.includes(m)}
                          onChange={() => toggleMeal(m)}
                          className="w-4 h-4 accent-amber-600"
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold uppercase text-amber-900 mb-1">Meal / Event Date *</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-amber-900 mb-1">Time</label>
                    <input
                      type="text"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      placeholder="e.g. 01:30 PM"
                      className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Pax, Meal Type (Veg/Non-Veg), Menu/Cuisine */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">No. of Pax *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pax}
                    onChange={(e) => setPax(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-2">Meal Type</label>
                  <div className="flex items-center gap-4 pt-1">
                    {(['Veg', 'Non-Veg'] as const).map((mt) => (
                      <label key={mt} className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mealTypes.includes(mt)}
                          onChange={() => toggleMealType(mt)}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        {mt}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Menu / Cuisine</label>
                  <input
                    type="text"
                    value={menuCuisine}
                    onChange={(e) => setMenuCuisine(e.target.value)}
                    placeholder="e.g. North Indian Buffet / Chinese"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Row 5: Rate, FOC, Total, Advance, Balance */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Rate / Pax (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={ratePerPax}
                    onChange={(e) => setRatePerPax(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">FOC (Free Pax)</label>
                  <input
                    type="number"
                    min="0"
                    value={focPax}
                    onChange={(e) => setFocPax(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Total (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={manualTotalOverride !== '' ? manualTotalOverride : computedTotal}
                    onChange={(e) => setManualTotalOverride(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-emerald-700 mb-1">Advance (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    className="w-full px-2.5 py-2 border border-emerald-300 rounded-lg bg-white font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-rose-700 mb-1">Balance (₹)</label>
                  <div className="px-2.5 py-2 border border-rose-200 rounded-lg bg-rose-50 font-mono font-black text-rose-700">
                    ₹{computedBalance.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Row 6: Payment Mode checkboxes/pills */}
              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1.5">Payment Mode</label>
                <div className="flex flex-wrap gap-2">
                  {['Cash', 'UPI', 'Card', 'Bank', 'Voucher'].map((pm) => (
                    <button
                      type="button"
                      key={pm}
                      onClick={() => setPaymentMethod(pm)}
                      className={`px-3.5 py-1.5 rounded-xl font-bold border cursor-pointer ${
                        paymentMethod === pm
                          ? 'bg-slate-900 text-amber-300 border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {paymentMethod === pm ? '✓ ' : ''}{pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 7: Special Request & Confirmed By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Special Request</label>
                  <input
                    type="text"
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                    placeholder="e.g. Less spicy, Jain counter, Stage table"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Confirmed By</label>
                  <input
                    type="text"
                    value={confirmedBy}
                    onChange={(e) => setConfirmedBy(e.target.value)}
                    placeholder="Manager / Staff Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-slate-900 text-amber-300 rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  {editingItem ? 'Save Booking Changes' : '+ Save Food Advance Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Food Advance Booking Slip Modal */}
      {printSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between no-print">
              <span className="font-bold text-sm text-amber-300">Food Advance Booking Slip</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setPrintSlip(null)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono text-slate-900">
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-3">
                <h2 className="text-base font-bold uppercase">{hotelName}</h2>
                <p className="text-[11px] font-bold uppercase text-slate-600 mt-0.5">
                  FOOD ADVANCE BOOKING VOUCHER
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><strong>Booking No:</strong> {printSlip.bookingNumber}</div>
                <div className="text-right"><strong>Date:</strong> {printSlip.bookingDate}</div>
                <div><strong>Guest/Group:</strong> {printSlip.guestOrGroupName}</div>
                <div className="text-right"><strong>Status:</strong> {printSlip.status}</div>
                {printSlip.companyName && (
                  <div className="col-span-2"><strong>Company:</strong> {printSlip.companyName}</div>
                )}
                <div><strong>Meal Date:</strong> {printSlip.eventDate} {printSlip.eventTime || ''}</div>
                <div className="text-right"><strong>Meal:</strong> {printSlip.meals.join(', ')}</div>
                <div><strong>No. of Pax:</strong> {printSlip.pax} (FOC: {printSlip.focPax || 0})</div>
                <div className="text-right"><strong>Type:</strong> {printSlip.mealTypes.join(' / ')}</div>
                <div className="col-span-2"><strong>Menu/Cuisine:</strong> {printSlip.menuCuisine}</div>
              </div>

              <div className="border-t border-b border-slate-300 py-3 space-y-1.5">
                <div className="flex justify-between">
                  <span>Rate per Pax:</span>
                  <span>₹{Number(printSlip.ratePerPax || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-sm">
                  <span>Total Amount:</span>
                  <span>₹{Number(printSlip.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Advance Paid ({printSlip.paymentMethod}):</span>
                  <span>₹{Number(printSlip.advanceAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-black text-sm">
                  <span>Balance Due:</span>
                  <span>₹{Number(printSlip.balanceAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {printSlip.specialRequest && (
                <div><strong>Special Request:</strong> {printSlip.specialRequest}</div>
              )}

              <div className="pt-6 flex justify-between text-[11px] text-slate-600">
                <div>Guest Signature</div>
                <div>Confirmed By: <strong>{printSlip.confirmedBy || 'Manager'}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
