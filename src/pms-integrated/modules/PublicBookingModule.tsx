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
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { AssetGroup, RoomAsset } from '../types';
import { formatCurrency } from '../utils/formatters';

interface PublicBookingModuleProps {
  assetGroups: AssetGroup[];
  rooms: RoomAsset[];
  hotelId?: string;
  hotelName?: string;
  hotelAddress?: string;
  onBookFromWebsite: (room?: RoomAsset) => void;
}

export const PublicBookingModule: React.FC<PublicBookingModuleProps> = ({
  assetGroups,
  rooms,
  hotelId = 'hotel-1',
  hotelName = 'DirectStay Property',
  hotelAddress = 'DirectStay Verified Hotel Property',
  onBookFromWebsite,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'Only Rooms' | 'Meals Included'>('Only Rooms');
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?hotelBooking=${encodeURIComponent(hotelId)}`
      : `/?hotelBooking=${encodeURIComponent(hotelId)}`;

  const handleCopyUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#17120F] via-[#221912] to-[#2F2318] text-[#FBF4E0] p-6 sm:p-8 shadow-lg border border-[#C49A3A]/35 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C49A3A]/20 border border-[#DFB962]/40 text-[#F5D88A] text-xs font-bold">
              <Globe className="w-3.5 h-3.5" />
              DirectStay Commission-Free Public Booking Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-extrabold tracking-tight">
              {hotelName}
            </h1>
            <p className="text-xs text-[#D8CBB8] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#DFB962] shrink-0" />
              {hotelAddress || 'DirectStay Verified Hotel Property'}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#F5D88A] font-semibold">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-[#DFB962] text-[#DFB962]" /> Direct Website Inventory Sync
              </span>
              <span className="flex items-center gap-1">
                <Wifi className="w-4 h-4" /> Real-Time Availability
              </span>
              <span className="flex items-center gap-1">
                <Coffee className="w-4 h-4" /> Room &amp; Meal Plans
              </span>
              <span className="flex items-center gap-1">
                <Car className="w-4 h-4" /> Zero OTA Commission
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-4 py-2.5 rounded-xl bg-[#2B2018] hover:bg-[#382A1F] text-[#FBF4E0] border border-[#C49A3A]/40 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#DFB962]" />}
              <span>{copied ? 'Booking Link Copied' : 'Copy Booking Link'}</span>
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#DFB962] to-[#C49A3A] text-[#17120F] font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm hover:opacity-95 transition"
            >
              <span>Open Live Guest Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Plan Toggle */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8DEC8] shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#17120F]">
            Live Website Room Categories &amp; Real-Time PMS Inventory
          </h2>
          <p className="text-xs text-slate-500">
            Rates and availability below are synced directly from Property Setup &amp; Room Status ({rooms.length} total rooms)
          </p>
        </div>
        <div className="flex items-center bg-[#FAF6EE] p-1 rounded-xl border border-[#E2D6BE]">
          {(['Only Rooms', 'Meals Included'] as const).map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => setSelectedPlan(plan)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedPlan === plan
                  ? 'bg-[#17120F] text-[#F5D88A] shadow-2xs'
                  : 'text-slate-600 hover:text-[#17120F]'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Room Category Cards */}
      {assetGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#DFC078] p-8 text-center space-y-2">
          <div className="text-sm font-bold text-[#17120F]">No Room Categories Configured Yet</div>
          <p className="text-xs text-slate-500">
            Add rooms and categories under Property Setup → Rooms &amp; Category to publish them on your DirectStay Booking Engine.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {assetGroups.map((grp) => {
            const availRooms = rooms.filter(
              (r) => r.category === grp.name && r.status === 'Available' && r.isLive
            );
            const planObj =
              grp.planPrices.find((p) => p.planName === selectedPlan) || grp.planPrices[0];

            return (
              <div
                key={grp.id}
                className="bg-white rounded-2xl border border-[#E8DEC8] shadow-2xs overflow-hidden flex flex-col justify-between"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          availRooms.length > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {availRooms.length} Rooms Available Online
                      </span>
                      <h3 className="text-lg font-extrabold text-[#17120F] mt-1.5">{grp.name}</h3>
                    </div>
                    <Sparkles className="w-5 h-5 text-[#C49A3A]" />
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

                <div className="p-5 bg-[#FAF7F0] border-t border-[#EDE3CE] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#8C7355]">
                      {selectedPlan}
                    </div>
                    <div className="text-xl font-extrabold text-[#17120F]">
                      {formatCurrency(planObj?.price || grp.basePrice)}
                      <span className="text-xs font-normal text-slate-500"> / night</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onBookFromWebsite(availRooms[0])}
                    className="px-4 py-2.5 rounded-xl bg-[#17120F] hover:bg-black text-[#F5D88A] font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    Create Direct Booking
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
