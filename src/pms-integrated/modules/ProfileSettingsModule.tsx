import React, { useState } from 'react';
import { Building2, ShieldCheck, Save, CheckCircle2 } from 'lucide-react';
import { HOTEL_PROFILE } from '../mock-data/initialData';

export const ProfileSettingsModule: React.FC = () => {
  const [hotelName, setHotelName] = useState(HOTEL_PROFILE.name);
  const [gstin, setGstin] = useState(HOTEL_PROFILE.gstin);
  const [phone, setPhone] = useState(HOTEL_PROFILE.phone);
  const [email, setEmail] = useState(HOTEL_PROFILE.email);
  const [address, setAddress] = useState(HOTEL_PROFILE.address);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Property Profile, GSTIN & Owner Settings</h1>
          <p className="text-xs text-slate-500">
            Configure hotel branding, statutory GSTIN/SAC details, and UPI merchant settlement credentials
          </p>
        </div>
        {savedToast && (
          <span className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Property Settings Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-amber-500" />
            Hotel Identity & Invoice Header Details
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 mb-1">Property Brand Name</label>
              <input
                type="text"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">Registered GSTIN Number</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Front Desk Helpline</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Official Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">Registered Property Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            Save Property Configuration
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Active License & Statutory Compliance Summary
          </h3>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span>PMS Enterprise Edition</span>
              <strong className="text-emerald-700">DirectStay v4.8 Pro (Active)</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span>FSSAI License Number</span>
              <strong className="text-slate-900">{HOTEL_PROFILE.fssai}</strong>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span>Settlement Bank Account</span>
              <strong className="text-slate-900">{HOTEL_PROFILE.bankName} ({HOTEL_PROFILE.accountNo})</strong>
            </div>
            <div className="flex justify-between py-2">
              <span>Merchant UPI Handle</span>
              <strong className="text-amber-700">{HOTEL_PROFILE.upiId}</strong>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
