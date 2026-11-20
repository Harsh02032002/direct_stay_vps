import React, { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Users, ArrowRight, Clock, CalendarCheck, UserCheck, BedDouble } from 'lucide-react';
import { AssetGroup, BookedCategoryRequirement, MealPlanType, RoomAsset } from '../types';
import { calculateNights, formatINR, getDayName } from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import { BillSettings, normalizeBillSettings, r2 } from '../../utils/billCalculator';

interface QuickAddBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetGroups: AssetGroup[];
  rooms?: RoomAsset[];
  preselectedRoom?: RoomAsset | null;
  initialBookingMode?: 'reservations' | 'walkin';
  billSettings?: BillSettings;
  onProceedBooking: (step1Data: {
    checkInDate: string;
    checkOutDate: string;
    isOpenStay?: boolean;
    numGuests: number;
    hasExtraPerson?: boolean;
    extraPersonCount?: number;
    extraPersonRate?: number;
    hasExtraBed?: boolean;
    extraBeds?: number;
    extraBedRate?: number;
    requirements: BookedCategoryRequirement[];
    bookingMode: 'reservations' | 'walkin';
    withGst?: boolean;
    gstRate?: number;
  }) => void;
}

export default function QuickAddBookingModal({
  isOpen,
  onClose,
  assetGroups,
  rooms = [],
  preselectedRoom,
  initialBookingMode = 'reservations',
  billSettings,
  onProceedBooking,
}: QuickAddBookingModalProps) {
  const [taxSettings] = useHotelTaxSettings();
  const settings = billSettings || normalizeBillSettings(taxSettings);
  const configuredRoomGst = settings.roomGstRate;

  const [bookingMode, setBookingMode] = useState<'reservations' | 'walkin'>(initialBookingMode);
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [isOpenStay, setIsOpenStay] = useState(false);
  const [numGuests, setNumGuests] = useState(2);
  const [hasExtraPerson, setHasExtraPerson] = useState(false);
  const [extraPersonCount, setExtraPersonCount] = useState(1);
  const [extraPersonRate, setExtraPersonRate] = useState<number>(() => {
    const rmRate = Number(preselectedRoom?.extraPersonCharge || rooms[0]?.extraPersonCharge || 0);
    return rmRate > 0 ? rmRate : 500;
  });
  const [hasExtraBed, setHasExtraBed] = useState(false);
  const [extraBeds, setExtraBeds] = useState(1);
  const [extraBedRate, setExtraBedRate] = useState<number>(() => {
    const rmRate = Number(preselectedRoom?.extraPersonCharge || rooms[0]?.extraPersonCharge || 0);
    return rmRate > 0 ? rmRate : 500;
  });
  const [withGst, setWithGst] = useState(true);

  const defaultCat = preselectedRoom?.category || assetGroups[0]?.name || 'Standard';
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCat);
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [selectedPlan, setSelectedPlan] = useState<MealPlanType>('Only Rooms');

  const [requirements, setRequirements] = useState<BookedCategoryRequirement[]>(() => {
    if (preselectedRoom) {
      return [
        {
          id: `req-${Date.now()}`,
          categoryName: preselectedRoom.category,
          qty: 1,
          planName: 'Only Rooms',
          unitPrice: preselectedRoom.rate,
          assignedRooms: [preselectedRoom.number],
        },
      ];
    }
    if (assetGroups.length > 0) {
      const firstAvailRoom = rooms.find(
        (r) => r.category === assetGroups[0].name && r.status === 'Available'
      );
      return [
        {
          id: 'req-init-1',
          categoryName: assetGroups[0].name,
          qty: 1,
          planName: 'Only Rooms',
          unitPrice: assetGroups[0].basePrice || 2000,
          assignedRooms: firstAvailRoom ? [firstAvailRoom.number] : [],
        },
      ];
    }
    return [];
  });

  useEffect(() => {
    if (isOpen) {
      setBookingMode(initialBookingMode);
      const defaultExtra = Number(preselectedRoom?.extraPersonCharge || rooms[0]?.extraPersonCharge || 0);
      const fallbackRate = defaultExtra > 0 ? defaultExtra : 500;
      setHasExtraPerson(false);
      setExtraPersonCount(1);
      setExtraPersonRate(fallbackRate);
      setHasExtraBed(false);
      setExtraBeds(1);
      setExtraBedRate(fallbackRate);
      if (preselectedRoom) {
        setSelectedCategory(preselectedRoom.category);
        setRequirements([
          {
            id: `req-${Date.now()}`,
            categoryName: preselectedRoom.category,
            qty: 1,
            planName: 'Only Rooms',
            unitPrice: preselectedRoom.rate,
            assignedRooms: [preselectedRoom.number],
          },
        ]);
      } else if (assetGroups.length > 0) {
        const cat = assetGroups[0].name;
        setSelectedCategory(cat);
        const firstAvailRoom = rooms.find((r) => r.category === cat && r.status === 'Available') || rooms.find((r) => r.category === cat);
        setRequirements([
          {
            id: 'req-init-1',
            categoryName: cat,
            qty: 1,
            planName: 'Only Rooms',
            unitPrice: assetGroups[0].basePrice || 2000,
            assignedRooms: firstAvailRoom ? [firstAvailRoom.number] : [],
          },
        ]);
      }
    }
  }, [isOpen, preselectedRoom, initialBookingMode]);

  if (!isOpen) return null;

  const nights = isOpenStay ? 1 : calculateNights(checkInDate, checkOutDate);
  const checkInDay = getDayName(checkInDate);
  const checkOutDay = getDayName(checkOutDate);

  const getPlanPrice = (catName: string, plan: MealPlanType): number => {
    const grp = assetGroups.find((g) => g.name === catName);
    if (!grp) return 2000;
    const foundPlan = grp.planPrices.find((p) => p.planName === plan);
    return foundPlan && foundPlan.price > 0 ? foundPlan.price : grp.basePrice;
  };

  const handleAddRequirement = () => {
    const unitPrice = getPlanPrice(selectedCategory, selectedPlan);
    const alreadyAssigned = new Set(requirements.flatMap((r) => r.assignedRooms));
    const matchingRooms = rooms
      .filter((r) => r.category === selectedCategory && !alreadyAssigned.has(r.number) && r.status !== 'Out of Service')
      .slice(0, Math.max(1, selectedQty))
      .map((r) => r.number);

    // If only the initial default row is present and user hasn't added anything else, replace it if it's a different category with no explicit multi-room intent
    if (requirements.length === 1 && requirements[0].id === 'req-init-1' && requirements[0].categoryName !== selectedCategory) {
      const singleRooms = rooms
        .filter((r) => r.category === selectedCategory && r.status !== 'Out of Service')
        .slice(0, Math.max(1, selectedQty))
        .map((r) => r.number);
      setRequirements([
        {
          id: `req-${Date.now()}`,
          categoryName: selectedCategory,
          qty: Math.max(1, selectedQty),
          planName: selectedPlan,
          unitPrice,
          assignedRooms: singleRooms,
        },
      ]);
      return;
    }

    const newReq: BookedCategoryRequirement = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      categoryName: selectedCategory,
      qty: Math.max(1, selectedQty),
      planName: selectedPlan,
      unitPrice,
      assignedRooms: matchingRooms,
    };
    setRequirements((prev) => [...prev, newReq]);
  };

  const handleRemoveRequirement = (id: string) => {
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  };

  const totalRoomsBooked = Math.max(
    1,
    requirements.reduce((sum, r) => sum + Math.max(1, r.qty), 0)
  );
  const baseOccupancyLimit = totalRoomsBooked * 2;
  const autoExtraPax = Math.max(0, numGuests - baseOccupancyLimit);
  const extraPersonTotal = hasExtraPerson
    ? Math.max(1, extraPersonCount) * Math.max(0, extraPersonRate) * nights
    : 0;
  const extraBedTotal = hasExtraBed
    ? Math.max(1, extraBeds) * Math.max(0, extraBedRate) * nights
    : 0;
  const extraPaxTotal = extraPersonTotal + extraBedTotal;

  const roomOnlyBase = requirements.reduce((sum, r) => sum + r.unitPrice * r.qty * nights, 0);
  const approxRoomBase = roomOnlyBase + extraPaxTotal;
  const effectiveGstRate = withGst ? configuredRoomGst : 0;
  const approxGst = withGst ? r2((approxRoomBase * effectiveGstRate) / 100) : 0;
  const approxTotalCost = r2(approxRoomBase + approxGst);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#DCE3EC] shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-[#FBF4E0]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#17120F]">Add New Booking</h3>
              {preselectedRoom && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
                  <BedDouble className="w-3 h-3" />
                  Room {preselectedRoom.number} ({preselectedRoom.category})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Step 1 of 2 • Choose Advance Booking or Walk-In Booking & Stay Dates
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/10 text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Booking Mode Selector: Advance Booking vs Walk-In Booking */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Select Booking Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBookingMode('reservations')}
                className={`p-3 rounded-xl border-2 text-left transition flex items-start gap-2.5 cursor-pointer ${
                  bookingMode === 'reservations'
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    bookingMode === 'reservations'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">Advance Booking</div>
                  <div className="text-[10px] text-slate-500">
                    Reserve room for today or future dates (Confirmed Reservation)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookingMode('walkin');
                  const today = new Date().toISOString().slice(0, 10);
                  setCheckInDate(today);
                  if (checkOutDate <= today) {
                    const d = new Date(`${today}T00:00:00`);
                    d.setDate(d.getDate() + 1);
                    setCheckOutDate(d.toISOString().slice(0, 10));
                  }
                }}
                className={`p-3 rounded-xl border-2 text-left transition flex items-start gap-2.5 cursor-pointer ${
                  bookingMode === 'walkin'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    bookingMode === 'walkin'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">Walk-In Booking</div>
                  <div className="text-[10px] text-slate-500">
                    Instant guest check-in at Front Desk right now (Occupied)
                  </div>
                </div>
              </button>
            </div>
          </div>
          {/* Date Range Picker with Exact Day Name & Open Check-Out Toggle */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C49A3A]" /> Check-In Date
                  </label>
                  {checkInDay && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                      {checkInDay}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCheckInDate(val);
                    if (val >= checkOutDate) {
                      const d = new Date(`${val}T00:00:00`);
                      d.setDate(d.getDate() + 1);
                      setCheckOutDate(d.toISOString().slice(0, 10));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C49A3A]" /> Check-Out Date ({nights}{' '}
                    {nights === 1 ? 'Night' : 'Nights'})
                  </label>
                  {!isOpenStay && checkOutDay && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-extrabold">
                      {checkOutDay}
                    </span>
                  )}
                </div>
                {isOpenStay ? (
                  <div className="w-full px-3 py-2 text-xs border border-amber-300 bg-amber-50 text-amber-900 rounded-xl font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Open Stay (Auto 12:00 PM Daily Prompt)
                  </div>
                ) : (
                  <input
                    type="date"
                    value={checkOutDate}
                    min={checkInDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                  />
                )}
              </div>
            </div>

            {/* Open Check-Out Date Rule (12:00 PM Daily Auto-Continue / Checkout Prompt) */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isOpenStay}
                  onChange={(e) => setIsOpenStay(e.target.checked)}
                  className="w-4 h-4 accent-[#C49A3A] rounded"
                />
                <div>
                  <span className="text-xs font-extrabold text-slate-900">
                    Open Check-Out Date (No Fixed Departure Date)
                  </span>
                  <p className="text-[10px] text-slate-600">
                    Every morning at 12:00 PM, PMS will automatically prompt: Continue Stay (+1 Day) or Checkout
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-400 text-[10px] font-bold">
                12:00 PM Rule
              </span>
            </label>
          </div>

          {/* Number of Guests + Separate Extra Person & Extra Bed/Mattress Checkboxes (Both OFF by default) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                  <Users className="w-3.5 h-3.5 text-[#C49A3A]" /> No. of Guests
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numGuests}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setNumGuests(val);
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-white rounded-xl font-bold"
                />
              </div>

              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasExtraPerson}
                  onChange={(e) => {
                    const nextOn = e.target.checked;
                    setHasExtraPerson(nextOn);
                    if (nextOn) {
                      setExtraPersonCount(Math.max(1, autoExtraPax || 1));
                    }
                  }}
                  className="w-4 h-4 accent-[#B5822D] rounded cursor-pointer"
                />
                <Users className="w-3.5 h-3.5 text-[#C49A3A]" />
                <span>Extra Person</span>
              </label>

              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasExtraBed}
                  onChange={(e) => {
                    const nextOn = e.target.checked;
                    setHasExtraBed(nextOn);
                    if (nextOn && extraBeds < 1) setExtraBeds(1);
                  }}
                  className="w-4 h-4 accent-[#B5822D] rounded cursor-pointer"
                />
                <BedDouble className="w-3.5 h-3.5 text-[#C49A3A]" />
                <span>Extra Bed / Mattress</span>
              </label>
            </div>

            {hasExtraPerson && (
              <div className="grid grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-white border border-[#C49A3A]/50 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8B691E] block mb-0.5">Extra Persons</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={extraPersonCount}
                    onChange={(e) => setExtraPersonCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#8B691E] block mb-0.5">Price / Night (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={extraPersonRate}
                    onChange={(e) => setExtraPersonRate(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div className="flex flex-col justify-end text-right font-mono pb-1">
                  <span className="text-[10px] text-slate-400">{extraPersonCount} × ₹{extraPersonRate} × {nights}N</span>
                  <strong className="text-xs font-extrabold text-[#8B691E]">{formatINR(extraPersonTotal)}</strong>
                </div>
              </div>
            )}

            {hasExtraBed && (
              <div className="grid grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-white border border-amber-300 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-amber-800 block mb-0.5">Beds / Mattresses</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={extraBeds}
                    onChange={(e) => setExtraBeds(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-amber-800 block mb-0.5">Price / Night (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={extraBedRate}
                    onChange={(e) => setExtraBedRate(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div className="flex flex-col justify-end text-right font-mono pb-1">
                  <span className="text-[10px] text-slate-400">{extraBeds} × ₹{extraBedRate} × {nights}N</span>
                  <strong className="text-xs font-extrabold text-amber-800">{formatINR(extraBedTotal)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Requirements Selector */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Requirements
            </h4>

            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Asset/Service
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setSelectedCategory(newCat);
                    if (requirements.length === 1 && requirements[0].id === 'req-init-1') {
                      const newPrice = getPlanPrice(newCat, selectedPlan);
                      const matchedRooms = rooms
                        .filter((r) => r.category === newCat && r.status !== 'Out of Service')
                        .slice(0, Math.max(1, selectedQty))
                        .map((r) => r.number);
                      setRequirements([
                        {
                          id: 'req-init-1',
                          categoryName: newCat,
                          qty: Math.max(1, selectedQty),
                          planName: selectedPlan,
                          unitPrice: newPrice,
                          assignedRooms: matchedRooms,
                        },
                      ]);
                    }
                  }}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                >
                  {assetGroups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Qty</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={selectedQty}
                  onChange={(e) => {
                    const nextQty = Math.max(1, Number(e.target.value));
                    setSelectedQty(nextQty);
                    if (requirements.length === 1 && requirements[0].id === 'req-init-1') {
                      const matchedRooms = rooms
                        .filter((r) => r.category === selectedCategory && r.status !== 'Out of Service')
                        .slice(0, nextQty)
                        .map((r) => r.number);
                      setRequirements((prev) =>
                        prev.map((r, i) =>
                          i === 0 ? { ...r, qty: nextQty, assignedRooms: matchedRooms } : r
                        )
                      );
                    }
                  }}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Plan</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => {
                    const nextPlan = e.target.value as MealPlanType;
                    setSelectedPlan(nextPlan);
                    if (requirements.length === 1 && requirements[0].id === 'req-init-1') {
                      const newPrice = getPlanPrice(selectedCategory, nextPlan);
                      setRequirements((prev) =>
                        prev.map((r, i) =>
                          i === 0 ? { ...r, planName: nextPlan, unitPrice: newPrice } : r
                        )
                      );
                    }
                  }}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                >
                  <option value="Only Rooms">Only Rooms</option>
                  <option value="Meals Included">Meals Included</option>
                  <option value="EP(SG)">EP(SG)</option>
                </select>
              </div>

              <div className="col-span-2">
                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="w-full py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ADD
                </button>
              </div>
            </div>

            {/* Added Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-3 text-left font-bold text-slate-600">Asset &amp; Room</th>
                    <th className="py-2 px-3 text-center font-bold text-slate-600">Plan</th>
                    <th className="py-2 px-3 text-center font-bold text-slate-600">Qty</th>
                    <th className="py-2 px-3 text-right font-bold text-slate-600">Price/N</th>
                    <th className="py-2 px-3 text-center font-bold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No items added yet. Click ADD above to include rooms.
                      </td>
                    </tr>
                  ) : (
                    requirements.map((req) => (
                      <tr key={req.id} className="border-b border-slate-100">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div>{req.categoryName}</div>
                          {req.assignedRooms.length > 0 && (
                            <div className="text-[10px] font-bold text-emerald-700">
                              Room {req.assignedRooms.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 bg-[#FBF4E0] text-[#8B691E] rounded-md text-[10px] font-bold">
                            {req.planName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">{req.qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatINR(req.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRequirement(req.id)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
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

          {/* Single Clean Checkbox: GST Invoice */}
          <div className="pt-2 space-y-3">
            <label className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/70 border border-amber-200 px-4 py-2.5 rounded-xl cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={withGst}
                  onChange={(e) => setWithGst(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">
                    GST Invoice
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {withGst
                      ? `Applies ${configuredRoomGst}% GST from Profile Settings`
                      : '0% Without GST (Bill of Supply)'}
                  </span>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                  withGst
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                {withGst ? `${configuredRoomGst}% GST` : '0% No GST'}
              </span>
            </label>

            <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
              <div>
                <span>
                  Estimated Cost ({nights} {nights === 1 ? 'Night' : 'Nights'} {withGst ? `+ ${effectiveGstRate}% GST` : '• No GST'}) :
                </span>
                <div className="text-[10px] font-normal text-slate-500">
                  Room Base: {formatINR(roomOnlyBase)}
                  {extraPersonTotal > 0 ? ` + Extra Person: ${formatINR(extraPersonTotal)}` : ''}
                  {extraBedTotal > 0 ? ` + Extra Bed: ${formatINR(extraBedTotal)}` : ''}
                  {withGst ? ` + ${effectiveGstRate}% Tax (${formatINR(approxGst)})` : ' + ₹0 Tax (No GST)'}
                </div>
              </div>
              <span className="text-base font-mono font-extrabold text-[#17120F]">
                {formatINRDecimal(approxTotalCost)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={requirements.length === 0}
                onClick={() =>
                  onProceedBooking({
                    checkInDate,
                    checkOutDate,
                    isOpenStay,
                    numGuests,
                    hasExtraPerson,
                    extraPersonCount: hasExtraPerson ? extraPersonCount : 0,
                    extraPersonRate: hasExtraPerson ? extraPersonRate : 0,
                    hasExtraBed,
                    extraBeds: hasExtraBed ? extraBeds : 0,
                    extraBedRate: hasExtraBed ? extraBedRate : 0,
                    requirements,
                    bookingMode: 'reservations',
                    withGst,
                    gstRate: effectiveGstRate,
                  })
                }
                className={`py-3 px-4 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  bookingMode === 'reservations'
                    ? 'bg-blue-700 hover:bg-blue-800 ring-2 ring-blue-300'
                    : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                <CalendarCheck className="w-4 h-4 shrink-0" />
                <span>Advance Booking</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>

              <button
                type="button"
                disabled={requirements.length === 0}
                onClick={() =>
                  onProceedBooking({
                    checkInDate,
                    checkOutDate,
                    isOpenStay,
                    numGuests,
                    hasExtraPerson,
                    extraPersonCount: hasExtraPerson ? extraPersonCount : 0,
                    extraPersonRate: hasExtraPerson ? extraPersonRate : 0,
                    hasExtraBed,
                    extraBeds: hasExtraBed ? extraBeds : 0,
                    extraBedRate: hasExtraBed ? extraBedRate : 0,
                    requirements,
                    bookingMode: 'walkin',
                    withGst,
                    gstRate: effectiveGstRate,
                  })
                }
                className={`py-3 px-4 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  bookingMode === 'walkin'
                    ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>Walk-In Booking</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatINRDecimal(val: number) {
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
