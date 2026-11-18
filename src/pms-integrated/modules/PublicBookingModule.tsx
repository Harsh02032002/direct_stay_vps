import React, { useState } from 'react';
import {
  Globe,
  Star,
  MapPin,
  Wifi,
  Coffee,
  Car,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { AssetGroup, RoomAsset } from '../types';
import { formatCurrency } from '../utils/formatters';
import { HOTEL_PROFILE } from '../mock-data/initialData';

interface PublicBookingModuleProps {
  assetGroups: AssetGroup[];
  rooms: RoomAsset[];
  onBookFromWebsite: (room?: RoomAsset) => void;
}

export const PublicBookingModule: React.FC<PublicBookingModuleProps> = ({
  assetGroups,
  rooms,
  onBookFromWebsite,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'Only Rooms' | 'Meals Included'>('Only Rooms');

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white p-8 shadow-lg border border-amber-500/30 relative overflow-hidden">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
            <Globe className="w-3.5 h-3.5" />
            DirectStay Commission-Free Public Booking Engine (Embedded Preview)
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{HOTEL_PROFILE.name}</h1>
          <p className="text-xs text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            {HOTEL_PROFILE.address}
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-amber-300 font-semibold">
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> 4.9 / 5 Verified Guest Rating
            </span>
            <span className="flex items-center gap-1">
              <Wifi className="w-4 h-4" /> Free High-Speed Wi-Fi
            </span>
            <span className="flex items-center gap-1">
              <Coffee className="w-4 h-4" /> Rooftop Fine Dining
            </span>
            <span className="flex items-center gap-1">
              <Car className="w-4 h-4" /> Valet Parking
            </span>
          </div>
        </div>
      </div>

      {/* Plan Toggle */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Live Website Room Categories & Real-Time PMS Inventory
          </h2>
          <p className="text-xs text-slate-500">
            Rates and availability below are synced directly from Room Management (`Asset Groups` & `IS LIVE` rooms)
          </p>
        </div>
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          {(['Only Rooms', 'Meals Included'] as const).map((plan) => (
            <button
              key={plan}
              onClick={() => setSelectedPlan(plan)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedPlan === plan ? 'bg-slate-900 text-amber-400 shadow-sm' : 'text-slate-600'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Room Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {assetGroups.map((grp) => {
          const availRooms = rooms.filter(
            (r) => r.category === grp.name && r.status === 'Available' && r.isLive
          );
          const planObj = grp.planPrices.find((p) => p.planName === selectedPlan) || grp.planPrices[0];

          return (
            <div
              key={grp.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      {availRooms.length} Rooms Available Online
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">{grp.name}</h3>
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>

                <p className="text-xs text-slate-600">{grp.description}</p>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Instant Confirmation • Zero OTA Convenience Fee
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Pay via UPI / Card or Pay at Hotel Desk
                  </div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">{selectedPlan}</div>
                  <div className="text-xl font-extrabold text-slate-900">
                    {formatCurrency(planObj?.price || grp.basePrice)}
                    <span className="text-xs font-normal text-slate-500"> / night</span>
                  </div>
                </div>

                <button
                  onClick={() => onBookFromWebsite(availRooms[0])}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-sm"
                >
                  Book Direct Now
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
