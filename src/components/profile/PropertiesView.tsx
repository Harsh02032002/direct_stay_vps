import React, { useState } from 'react';
import {
  Building,
  Plus,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  X,
  Save,
  Check,
  User,
  Receipt,
  Crown
} from 'lucide-react';
import { Hotel } from '../../types';
import { showToast } from '../../utils/toast';

interface PropertiesViewProps {
  hotels: Hotel[];
  activeHotel?: Hotel;
  selectedHotelId: string;
  onSelectHotel?: (hotelId: string) => void;
  onUpdateGlobalHotels: (updated: Hotel[]) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function PropertiesView({
  hotels = [],
  activeHotel,
  selectedHotelId,
  onSelectHotel,
  onUpdateGlobalHotels,
  onAddAuditLog,
}: PropertiesViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const currentActiveId = activeHotel?.id || selectedHotelId;

  const handleCreateProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newH: Hotel = {
      id: `hotel-${Date.now()}`,
      name: name.trim(),
      ownerName: ownerName.trim() || 'Property Owner',
      gstNumber: gstNumber.trim() || '',
      phoneNumber: phone.trim() || '+91 9876543210',
      emailAddress: email.trim() || 'owner@directstay.online',
      address: address.trim() || 'Chandigarh, India',
      subscriptionPlan: 'Enterprise Plan',
      subscriptionStatus: 'Active',
      status: 'Approved',
      isGstEnabled: true,
      defaultGstRate: 5,
      invoicePrefix: 'INV',
      nextInvoiceSequence: 1001,
      grcPrefix: 'GRC',
      nextGrcSequence: 1,
    } as any;

    const updated = [...hotels, newH];
    onUpdateGlobalHotels(updated);
    setShowAddModal(false);
    setName('');
    setOwnerName('');
    setGstNumber('');
    setPhone('');
    setEmail('');
    setAddress('');

    const log = `New hotel property onboarded: "${newH.name}" (${newH.address}).`;
    onAddAuditLog?.('Property Onboarded', log);
    showToast(log, 'success', 5000, 'Property Created');
  };

  const handleSwitchHotel = (hotelId: string) => {
    if (onSelectHotel) {
      onSelectHotel(hotelId);
      const target = hotels.find((h) => h.id === hotelId);
      showToast(`Switched active management context to "${target?.name || hotelId}".`, 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <Building className="w-3.5 h-3.5 text-luxury-gold-600" /> Multi-Property Portfolio
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Properties Portfolio &amp; Hotel Switcher
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Centralized registry of hotel properties managed under your DirectStay hospitality account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Property
          </button>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {hotels.map((h) => {
          const isCurrent = h.id === currentActiveId;
          return (
            <div
              key={h.id}
              className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-5 ${
                isCurrent
                  ? 'bg-gradient-to-br from-white via-luxury-beige-50/40 to-white border-luxury-gold-500/60 shadow-md ring-2 ring-luxury-gold-500/20'
                  : 'bg-white border-luxury-brown-100 hover:border-luxury-brown-200 shadow-sm'
              }`}
            >
              {/* Header: Name, Address, Active Badge / Switch Button */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-luxury-gold-500 shrink-0" />
                      <h3 className="font-serif font-bold text-lg text-luxury-brown-950 truncate leading-snug">
                        {h.name}
                      </h3>
                    </div>
                    <p className="text-xs text-luxury-brown-600 flex items-start gap-1.5 leading-relaxed pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-luxury-gold-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{h.address || 'DirectStay Hotel Property, India'}</span>
                    </p>
                  </div>

                  {isCurrent ? (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-300 text-[11px] font-mono font-bold flex items-center gap-1.5 shrink-0 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active Context
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitchHotel(h.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 text-xs font-mono font-bold transition-all shadow-xs hover:shadow cursor-pointer shrink-0"
                    >
                      Switch Context →
                    </button>
                  )}
                </div>

                {/* Structured Aligned Stat Tiles */}
                <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-luxury-brown-100">
                  <div className="p-2.5 bg-luxury-beige-50/60 rounded-xl border border-luxury-brown-100/70 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-400 flex items-center gap-1 font-bold">
                      <User className="w-3 h-3 text-luxury-gold-600" /> Property Owner
                    </span>
                    <span className="font-bold text-xs text-luxury-brown-900 block truncate">
                      {h.ownerName || 'DirectStay Owner'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-luxury-beige-50/60 rounded-xl border border-luxury-brown-100/70 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-400 flex items-center gap-1 font-bold">
                      <Receipt className="w-3 h-3 text-luxury-gold-600" /> GSTIN Status
                    </span>
                    <span className="font-bold text-xs text-luxury-brown-900 block truncate">
                      {h.gstNumber || 'Exempt / None'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-luxury-beige-50/60 rounded-xl border border-luxury-brown-100/70 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-400 flex items-center gap-1 font-bold">
                      <Phone className="w-3 h-3 text-luxury-gold-600" /> Contact Phone
                    </span>
                    <span className="font-bold text-xs text-luxury-gold-800 block truncate font-mono">
                      {h.phoneNumber || 'N/A'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-luxury-beige-50/60 rounded-xl border border-luxury-brown-100/70 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-400 flex items-center gap-1 font-bold">
                      <Crown className="w-3 h-3 text-luxury-gold-600" /> Subscription Plan
                    </span>
                    <span className="font-bold text-xs text-emerald-700 block truncate">
                      {h.subscriptionPlan || 'Trial'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-luxury-brown-500 border-t border-luxury-brown-50">
                <span className="bg-luxury-beige-100/80 px-2 py-0.5 rounded text-[10px] text-luxury-brown-600">
                  ID: {h.id}
                </span>
                <span className="text-luxury-brown-400">
                  Status: <strong className="text-emerald-700">{h.status || 'Active'}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-luxury-brown-950 text-white p-5 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <Building className="w-4 h-4 text-luxury-gold-400" /> Onboard New Hotel Property
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-luxury-brown-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Hotel Property Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Heritage Resort"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Owner Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Malhotra"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="07AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Primary Phone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="contact@hotel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Physical Property Address *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Street address, city, state, pincode..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl p-3"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-luxury-brown-50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 rounded-xl text-luxury-brown-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl cursor-pointer"
                >
                  Create Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
