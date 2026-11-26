import React, { useState, useMemo } from 'react';
import {
  HybridSplitPaymentBox,
  HybridSplitRow,
  createInitialHybridRows,
  getValidHybridSplits,
} from './HybridSplitPaymentBox';
import {
  TravelAgent,
  AgentCommissionPayment,
  Booking,
  HotelSettings,
} from '../types';
import { showToast } from '../utils/toast';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Coins,
  CheckCircle2,
  Clock,
  Eye,
  CreditCard,
  Building2,
  Phone,
  Mail,
  X,
  Printer,
  BookOpen,
  TrendingUp,
} from 'lucide-react';

interface TravelAgentManagerViewProps {
  travelAgents: TravelAgent[];
  commissionPayments: AgentCommissionPayment[];
  bookings: Booking[];
  hotelSettings?: HotelSettings;
  loggedInUser?: string;
  onUpdateTravelAgents: (agents: TravelAgent[]) => void;
  onUpdateCommissionPayments: (payments: AgentCommissionPayment[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export function isConfirmedForCommission(b: Booking): boolean {
  const st = String(b.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'waiting' || st === 'in process' || st === 'pending') {
    return false;
  }
  return (
    st === 'confirmed' ||
    st === 'checked in' ||
    st === 'checkedin' ||
    Boolean(b.isCheckedIn) ||
    Boolean(b.isCompleted)
  );
}

export function computeBookingCommission(b: Booking, agent?: TravelAgent): number {
  if (!isConfirmedForCommission(b)) return 0;
  if (typeof b.commissionAmount === 'number' && b.commissionAmount >= 0 && (b.commissionValue || 0) > 0) {
    const baseTariff = Number(b.bookingAmount || 0);
    if (b.commissionType === 'percentage') {
      return Math.round((baseTariff * Number(b.commissionValue || 0)) / 100);
    }
    return Math.round(Number(b.commissionAmount));
  }
  if (!agent) return 0;
  const baseTariff = Number(b.bookingAmount || 0);
  if (agent.commissionType === 'percentage') {
    return Math.round((baseTariff * Number(agent.commissionValue || 0)) / 100);
  }
  return Math.round(Number(agent.commissionValue || 0));
}

export default function TravelAgentManagerView({
  travelAgents = [],
  commissionPayments = [],
  bookings = [],
  hotelSettings,
  loggedInUser,
  onUpdateTravelAgents,
  onUpdateCommissionPayments,
  onAddAuditLog,
}: TravelAgentManagerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<TravelAgent | null>(null);

  // Agent form fields
  const [name, setName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [commissionValue, setCommissionValue] = useState<string>('10');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [notes, setNotes] = useState('');

  // Inspect bookings drawer/modal
  const [inspectAgent, setInspectAgent] = useState<TravelAgent | null>(null);

  // Record payment modal
  const [payAgent, setPayAgent] = useState<TravelAgent | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('UPI');
  const [isPayHybrid, setIsPayHybrid] = useState<boolean>(false);
  const [payHybridRows, setPayHybridRows] = useState<HybridSplitRow[]>(() => createInitialHybridRows(0));
  const [payRef, setPayRef] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState<string>('');

  const agentStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        allBookings: Booking[];
        confirmedBookings: Booking[];
        totalRevenue: number;
        commissionEarned: number;
        commissionPaid: number;
        pendingCommission: number;
      }
    >();

    travelAgents.forEach((ag) => {
      const agBookings = bookings.filter(
        (b) =>
          b.travelAgentId === ag.id ||
          (b.travelAgentName &&
            (b.travelAgentName.toLowerCase() === ag.agencyName.toLowerCase() ||
              b.travelAgentName.toLowerCase() === ag.name.toLowerCase()))
      );
      const confirmed = agBookings.filter(isConfirmedForCommission);
      const totalRevenue = confirmed.reduce((s, b) => s + Number(b.bookingAmount || 0), 0);
      const commissionEarned = confirmed.reduce(
        (s, b) => s + computeBookingCommission(b, ag),
        0
      );
      const commissionPaid = commissionPayments
        .filter((p) => p.agentId === ag.id)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const pendingCommission = Math.max(0, commissionEarned - commissionPaid);

      map.set(ag.id, {
        allBookings: agBookings,
        confirmedBookings: confirmed,
        totalRevenue,
        commissionEarned,
        commissionPaid,
        pendingCommission,
      });
    });

    return map;
  }, [travelAgents, bookings, commissionPayments]);

  const totals = useMemo(() => {
    let confirmedCount = 0;
    let totalEarned = 0;
    let totalPaid = 0;
    let totalPending = 0;
    agentStatsMap.forEach((st) => {
      confirmedCount += st.confirmedBookings.length;
      totalEarned += st.commissionEarned;
      totalPaid += st.commissionPaid;
      totalPending += st.pendingCommission;
    });
    return { confirmedCount, totalEarned, totalPaid, totalPending };
  }, [agentStatsMap]);

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return travelAgents;
    return travelAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.agencyName.toLowerCase().includes(q) ||
        a.mobile.includes(q) ||
        (a.city || '').toLowerCase().includes(q)
    );
  }, [travelAgents, searchQuery]);

  const openAddAgent = () => {
    setEditingAgent(null);
    setName('');
    setAgencyName('');
    setMobile('');
    setEmail('');
    setCity('');
    setGstNumber('');
    setCommissionType('percentage');
    setCommissionValue('10');
    setStatus('Active');
    setNotes('');
    setShowAgentModal(true);
  };

  const openEditAgent = (ag: TravelAgent) => {
    setEditingAgent(ag);
    setName(ag.name);
    setAgencyName(ag.agencyName);
    setMobile(ag.mobile);
    setEmail(ag.email || '');
    setCity(ag.city || '');
    setGstNumber(ag.gstNumber || '');
    setCommissionType(ag.commissionType || 'percentage');
    setCommissionValue(String(ag.commissionValue ?? 10));
    setStatus(ag.status || 'Active');
    setNotes(ag.notes || '');
    setShowAgentModal(true);
  };

  const handleSaveAgent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanAgency = agencyName.trim() || cleanName;
    const cleanMob = mobile.trim();
    const parsedComm = Math.max(0, Number(commissionValue) || 0);

    if (!cleanName) {
      showToast('Please enter Agent Name.', 'warning');
      return;
    }
    if (!cleanMob || cleanMob.replace(/\D/g, '').length < 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    if (editingAgent) {
      const updated = travelAgents.map((a) =>
        a.id === editingAgent.id
          ? {
              ...a,
              name: cleanName,
              agencyName: cleanAgency,
              mobile: cleanMob,
              email: email.trim() || undefined,
              city: city.trim() || undefined,
              gstNumber: gstNumber.trim().toUpperCase() || undefined,
              commissionType,
              commissionValue: parsedComm,
              status,
              notes: notes.trim() || undefined,
            }
          : a
      );
      onUpdateTravelAgents(updated);
      onAddAuditLog?.(
        'Travel Agent Updated',
        `Updated partner "${cleanAgency}" (${cleanName}) — Commission: ${
          commissionType === 'percentage' ? `${parsedComm}%` : `₹${parsedComm}`
        }.`
      );
      showToast(`Travel Agent "${cleanAgency}" updated!`, 'success');
    } else {
      const newAgent: TravelAgent = {
        id: `AGT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        hotelId: hotelSettings?.id,
        name: cleanName,
        agencyName: cleanAgency,
        mobile: cleanMob,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        gstNumber: gstNumber.trim().toUpperCase() || undefined,
        commissionType,
        commissionValue: parsedComm,
        status,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString().split('T')[0],
      };
      onUpdateTravelAgents([newAgent, ...travelAgents]);
      onAddAuditLog?.(
        'Travel Agent Added',
        `Added travel agent "${cleanAgency}" (${cleanName}, ${cleanMob}) with default commission ${
          commissionType === 'percentage' ? `${parsedComm}%` : `₹${parsedComm}`
        }.`
      );
      showToast(`Travel Agent "${cleanAgency}" added!`, 'success');
    }
    setShowAgentModal(false);
  };

  const handleDeleteAgent = (ag: TravelAgent) => {
    if (!window.confirm(`Remove travel agent "${ag.agencyName}" (${ag.name})?`)) return;
    onUpdateTravelAgents(travelAgents.filter((a) => a.id !== ag.id));
    onAddAuditLog?.('Travel Agent Removed', `Removed travel agent "${ag.agencyName}" (${ag.name}).`);
    showToast(`Removed travel agent "${ag.agencyName}".`, 'info');
  };

  const openPayModal = (ag: TravelAgent) => {
    const st = agentStatsMap.get(ag.id);
    setPayAgent(ag);
    setPayAmount(String(st?.pendingCommission || 0));
    setPayMethod('UPI');
    setPayRef('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAgent) return;

    if (isPayHybrid) {
      const validSplits = getValidHybridSplits(payHybridRows);
      if (validSplits.length === 0) {
        showToast('Enter at least one split payout amount greater than ₹0.', 'warning');
        return;
      }
      const totalAmt = Math.round(validSplits.reduce((s, r) => s + r.amount, 0) * 100) / 100;
      const baseTs = Date.now();
      const newPayments: AgentCommissionPayment[] = validSplits.map((sp, idx) => ({
        id: `AGPAY-${baseTs}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        hotelId: hotelSettings?.id,
        agentId: payAgent.id,
        agentName: payAgent.name,
        agencyName: payAgent.agencyName,
        amount: sp.amount,
        paymentMethod: sp.method,
        referenceNo: payRef.trim() || undefined,
        date: payDate || new Date().toISOString().split('T')[0],
        notes: payNotes.trim()
          ? `${payNotes.trim()} (Hybrid split ${sp.method})`
          : `Hybrid split payout (${sp.method})`,
        recordedBy: loggedInUser || 'Admin',
      }));
      onUpdateCommissionPayments([...newPayments, ...commissionPayments]);
      const summary = validSplits.map((s) => `${s.method} ₹${s.amount}`).join(' + ');
      onAddAuditLog?.(
        'Agent Commission Paid',
        `Paid ₹${totalAmt.toLocaleString('en-IN')} commission to "${payAgent.agencyName}" via ${summary}.`
      );
      showToast(`Recorded ₹${totalAmt.toLocaleString('en-IN')} hybrid commission payout to ${payAgent.agencyName}!`, 'success');
      setIsPayHybrid(false);
      setPayAgent(null);
      return;
    }

    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid commission payout amount greater than ₹0.', 'warning');
      return;
    }

    const payment: AgentCommissionPayment = {
      id: `AGPAY-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      hotelId: hotelSettings?.id,
      agentId: payAgent.id,
      agentName: payAgent.name,
      agencyName: payAgent.agencyName,
      amount: Math.round(amt * 100) / 100,
      paymentMethod: payMethod,
      referenceNo: payRef.trim() || undefined,
      date: payDate || new Date().toISOString().split('T')[0],
      notes: payNotes.trim() || undefined,
      recordedBy: loggedInUser || 'Admin',
    };

    onUpdateCommissionPayments([payment, ...commissionPayments]);
    onAddAuditLog?.(
      'Agent Commission Paid',
      `Paid ₹${Number(payment.amount || 0).toLocaleString('en-IN')} commission to "${payAgent.agencyName}" via ${payMethod}.`
    );
    showToast(`Recorded ₹${Number(payment.amount || 0).toLocaleString('en-IN')} commission payout to ${payAgent.agencyName}!`, 'success');
    setPayAgent(null);
  };

  const handleDeletePayment = (pay: AgentCommissionPayment) => {
    if (!window.confirm(`Delete commission payment record of ₹${pay.amount} to ${pay.agencyName || pay.agentName}?`)) return;
    onUpdateCommissionPayments(commissionPayments.filter((p) => p.id !== pay.id));
    showToast('Commission payment entry removed.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-luxury-brown-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-luxury-gold-600 font-bold">
            B2B Partner & Agency Commission Hub
          </span>
          <h2 className="text-2xl font-serif font-bold text-luxury-brown-950 mt-0.5">
            Travel Agents &amp; OTA Partners
          </h2>
          <p className="text-xs text-luxury-brown-600 mt-1">
            Manage travel agencies without agent login, assign per-booking commissions, track earned &amp; pending payouts, and maintain full commission payment history.
          </p>
        </div>
        <button
          onClick={openAddAgent}
          className="px-5 py-2.5 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-300 font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Travel Agent / Agency
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-luxury-brown-500 text-xs font-semibold">
            <span>Active Travel Agents</span>
            <Users className="w-4 h-4 text-luxury-gold-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-luxury-brown-950 mt-2">
            {travelAgents.filter((a) => a.status === 'Active').length}{' '}
            <span className="text-xs font-normal text-gray-400">/ {travelAgents.length}</span>
          </p>
        </div>

        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-luxury-brown-500 text-xs font-semibold">
            <span>Confirmed Bookings</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-indigo-700 mt-2">
            {totals.confirmedCount}
          </p>
        </div>

        <div className="bg-white border border-luxury-brown-100 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-luxury-brown-500 text-xs font-semibold">
            <span>Commission Earned</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-luxury-brown-950 mt-2">
            ₹{Number(totals.totalEarned || 0).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Commission Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-emerald-700 mt-2">
            ₹{Number(totals.totalPaid || 0).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
            <span>Pending Payouts</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-rose-700 mt-2">
            ₹{Number(totals.totalPending || 0).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Agent-Wise Ledger Table */}
      <div className="bg-white border border-luxury-brown-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-luxury-brown-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-bold text-base text-luxury-brown-950">
              Agent-Wise Bookings, Commission Earned &amp; Pending Balance
            </h3>
            <p className="text-xs text-gray-500">
              Commission auto-calculates on Confirmed / Checked-In / Completed bookings.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agency, agent or mobile..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-luxury-gold-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-luxury-beige-50 text-luxury-brown-700 uppercase text-[10px] font-mono border-b border-luxury-brown-100">
                <th className="p-3.5">Agency / Agent</th>
                <th className="p-3.5">Contact &amp; City</th>
                <th className="p-3.5">Default Commission</th>
                <th className="p-3.5 text-center">Bookings</th>
                <th className="p-3.5 text-right">Booking Value</th>
                <th className="p-3.5 text-right">Earned</th>
                <th className="p-3.5 text-right">Paid</th>
                <th className="p-3.5 text-right">Pending Due</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                    No travel agents added yet. Click &ldquo;+ Add Travel Agent / Agency&rdquo; to onboard your first partner.
                  </td>
                </tr>
              ) : (
                filteredAgents.map((ag) => {
                  const st = agentStatsMap.get(ag.id) || {
                    allBookings: [],
                    confirmedBookings: [],
                    totalRevenue: 0,
                    commissionEarned: 0,
                    commissionPaid: 0,
                    pendingCommission: 0,
                  };
                  return (
                    <tr key={ag.id} className="hover:bg-luxury-beige-50/30">
                      <td className="p-3.5">
                        <div className="font-bold text-luxury-brown-950 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-luxury-gold-600" />
                          {ag.agencyName}
                        </div>
                        <div className="text-[11px] text-gray-500">Agent: {ag.name}</div>
                        {ag.gstNumber && (
                          <div className="text-[10px] font-mono text-gray-400">GST: {ag.gstNumber}</div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-mono text-luxury-brown-900 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" /> {ag.mobile}
                        </div>
                        {ag.city && <div className="text-[11px] text-gray-500">{ag.city}</div>}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-indigo-700">
                        {ag.commissionType === 'percentage'
                          ? `${ag.commissionValue}% / booking`
                          : `₹${Number(ag.commissionValue || 0).toLocaleString('en-IN')} / booking`}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => setInspectAgent(ag)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold font-mono cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> {st.confirmedBookings.length} Confirmed
                          {st.allBookings.length > st.confirmedBookings.length && (
                            <span className="text-[10px] text-gray-500">
                              ({st.allBookings.length} total)
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-3.5 text-right font-mono font-semibold text-luxury-brown-900">
                        ₹{Number(st.totalRevenue || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-amber-700">
                        ₹{Number(st.commissionEarned || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                        ₹{Number(st.commissionPaid || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black">
                        <span
                          className={
                            st.pendingCommission > 0
                              ? 'px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200'
                              : 'text-emerald-600'
                          }
                        >
                          ₹{Number(st.pendingCommission || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openPayModal(ag)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Pay Commission"
                          >
                            <Coins className="w-3 h-3" /> Pay
                          </button>
                          <button
                            onClick={() => openEditAgent(ag)}
                            className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 cursor-pointer"
                            title="Edit Agent"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(ag)}
                            className="p-1.5 border border-rose-200 hover:bg-rose-50 rounded-lg text-rose-600 cursor-pointer"
                            title="Remove Agent"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission Payment History */}
      <div className="bg-white border border-luxury-brown-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-luxury-brown-100 flex items-center justify-between">
          <div>
            <h3 className="font-serif font-bold text-base text-luxury-brown-950 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-luxury-gold-600" />
              Commission Payment History
            </h3>
            <p className="text-xs text-gray-500">
              Complete audit trail of all travel agent &amp; partner commission settlements.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold">
            {commissionPayments.length} Payouts • ₹{Number(totals.totalPaid || 0).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-luxury-beige-50 text-luxury-brown-700 uppercase text-[10px] font-mono border-b border-luxury-brown-100">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Voucher ID</th>
                <th className="p-3.5">Agency / Agent</th>
                <th className="p-3.5">Payment Mode</th>
                <th className="p-3.5">Reference / UTR</th>
                <th className="p-3.5">Notes</th>
                <th className="p-3.5 text-right">Amount Paid</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commissionPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-400 italic">
                    No commission payouts recorded yet.
                  </td>
                </tr>
              ) : (
                commissionPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-luxury-beige-50/30">
                    <td className="p-3.5 font-mono">{p.date}</td>
                    <td className="p-3.5 font-mono font-bold text-luxury-brown-900">{p.id}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-luxury-brown-950">{p.agencyName || p.agentName}</div>
                      {p.agencyName && p.agentName && (
                        <div className="text-[10px] text-gray-500">{p.agentName}</div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-gray-600">{p.referenceNo || '—'}</td>
                    <td className="p-3.5 text-gray-600">{p.notes || '—'}</td>
                    <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                      ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleDeletePayment(p)}
                        className="p-1.5 border border-rose-200 hover:bg-rose-50 rounded-lg text-rose-600 cursor-pointer"
                        title="Delete Payment Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Agent Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-luxury-brown-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-luxury-brown-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-luxury-gold-300">
                  {editingAgent ? 'Edit Travel Agent / Partner' : 'Add Travel Agent / Partner'}
                </h3>
                <p className="text-[11px] text-luxury-beige-200/80">
                  No agent registration required — managed directly by Admin
                </p>
              </div>
              <button
                onClick={() => setShowAgentModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    Agency / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g. Kalinga Tours & Travels"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    Contact Person / Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Mohanty"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="agent@agency.com"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bhubaneswar / Kolkata"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    Agency GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    placeholder="21AAAAA0000A1Z5"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl uppercase font-mono"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                <label className="block text-[11px] font-bold uppercase text-amber-900">
                  Default Commission Structure (Editable per Booking)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
                    className="px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="percentage">Percentage (%) of Room Tariff</option>
                    <option value="fixed">Fixed Amount (₹) per Booking</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    placeholder={commissionType === 'percentage' ? 'e.g. 10 (%)' : 'e.g. 300 (₹)'}
                    className="px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-luxury-brown-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Bank / UPI details or remarks"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-gray-300 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-luxury-brown-950 text-luxury-gold-300 rounded-xl hover:bg-luxury-brown-900 cursor-pointer"
                >
                  {editingAgent ? 'Save Changes' : '+ Save Travel Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Bookings Drilldown Modal */}
      {inspectAgent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-luxury-brown-200 w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 bg-luxury-brown-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-luxury-gold-300">
                  {inspectAgent.agencyName} — Agent Bookings Ledger
                </h3>
                <p className="text-xs text-luxury-beige-200/80">
                  Agent: {inspectAgent.name} ({inspectAgent.mobile})
                </p>
              </div>
              <button
                onClick={() => setInspectAgent(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {(agentStatsMap.get(inspectAgent.id)?.allBookings || []).length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-8 italic">
                  No bookings assigned to {inspectAgent.agencyName} yet.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-luxury-beige-50 text-luxury-brown-700 uppercase text-[10px] font-mono border-b">
                      <th className="p-2.5">Booking ID</th>
                      <th className="p-2.5">Guest</th>
                      <th className="p-2.5">Room &amp; Dates</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Booking Tariff</th>
                      <th className="p-2.5 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(agentStatsMap.get(inspectAgent.id)?.allBookings || []).map((b) => {
                      const comm = computeBookingCommission(b, inspectAgent);
                      const eligible = isConfirmedForCommission(b);
                      return (
                        <tr key={b.id}>
                          <td className="p-2.5 font-mono font-bold">{b.id}</td>
                          <td className="p-2.5">
                            <div className="font-bold">{b.guestName}</div>
                            <div className="text-[10px] text-gray-500">{b.mobile}</div>
                          </td>
                          <td className="p-2.5 font-mono text-[11px]">
                            Room {b.roomNumber} • {b.checkInDate} → {b.checkOutDate || 'Open'}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                eligible
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            ₹{Number(b.bookingAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-700">
                            {eligible ? `₹${comm.toLocaleString('en-IN')}` : '₹0 (Not Confirmed)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Commission Payment Modal */}
      {payAgent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-luxury-brown-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-emerald-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-emerald-300">
                  Pay Agent Commission
                </h3>
                <p className="text-xs text-emerald-100/80">
                  {payAgent.agencyName} ({payAgent.name})
                </p>
              </div>
              <button
                onClick={() => setPayAgent(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex justify-between items-center text-xs">
                <span className="font-semibold text-emerald-900">Current Pending Commission:</span>
                <span className="font-mono font-black text-base text-emerald-800">
                  ₹{(agentStatsMap.get(payAgent.id)?.pendingCommission || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={isPayHybrid ? '__HYBRID__' : payMethod}
                    onChange={(e) => {
                      if (e.target.value === '__HYBRID__') {
                        setIsPayHybrid(true);
                        setPayHybridRows(createInitialHybridRows(Number(payAmount) || 0, ['UPI', 'Cash', 'Bank Transfer', 'Cheque', 'Card']));
                      } else {
                        setIsPayHybrid(false);
                        setPayMethod(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                    <option value="__HYBRID__">⇄ Hybrid / Split Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                    UTR / Ref No.
                  </label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Optional UTR / Ref"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl font-mono"
                  />
                </div>
              </div>
              {isPayHybrid && (
                <HybridSplitPaymentBox
                  rows={payHybridRows}
                  onChange={(rows) => {
                    setPayHybridRows(rows);
                    const sum = Math.round(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) * 100) / 100;
                    setPayAmount(String(sum));
                  }}
                  modes={['UPI', 'Cash', 'Bank Transfer', 'Cheque', 'Card']}
                  targetAmount={Number(payAmount) || 0}
                  compact
                />
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Settled Nov commission batch"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPayAgent(null)}
                  className="px-4 py-2 text-xs font-semibold border border-gray-300 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl cursor-pointer"
                >
                  Confirm Commission Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
