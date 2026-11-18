import React, { useState, useEffect, useMemo } from 'react';
import { PosItem, PosOrder, PosOrderItem, Room, GuestCheckIn, ExtraCharge } from '../types';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Utensils,
  Phone,
  Bed,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  ArrowLeft,
  ChefHat,
  Receipt
} from 'lucide-react';
import { showToast } from '../utils/toast';

export const FALLBACK_DIGITAL_MENU_ITEMS: PosItem[] = [
  {
    id: 'dm-1',
    name: 'Paneer Butter Masala',
    code: 'MAIN-01',
    category: 'Main Course',
    price: 260,
    taxRate: 5,
    available: true,
    kitchenStation: 'Main Kitchen'
  },
  {
    id: 'dm-2',
    name: 'Dal Tadka Royale',
    code: 'MAIN-02',
    category: 'Main Course',
    price: 180,
    taxRate: 5,
    available: true,
    kitchenStation: 'Main Kitchen'
  },
  {
    id: 'dm-3',
    name: 'Veg Dum Biryani (With Raita)',
    code: 'RICE-01',
    category: 'Biryani & Rice',
    price: 240,
    taxRate: 5,
    available: true,
    kitchenStation: 'Main Kitchen'
  },
  {
    id: 'dm-4',
    name: 'Hyderabadi Chicken Biryani',
    code: 'RICE-02',
    category: 'Biryani & Rice',
    price: 320,
    taxRate: 5,
    available: true,
    kitchenStation: 'Main Kitchen'
  },
  {
    id: 'dm-5',
    name: 'Butter Garlic Naan (2 Pcs)',
    code: 'BRD-01',
    category: 'Breads & Tandoor',
    price: 90,
    taxRate: 5,
    available: true,
    kitchenStation: 'Tandoor'
  },
  {
    id: 'dm-6',
    name: 'Tandoori Roti (Butter)',
    code: 'BRD-02',
    category: 'Breads & Tandoor',
    price: 35,
    taxRate: 5,
    available: true,
    kitchenStation: 'Tandoor'
  },
  {
    id: 'dm-7',
    name: 'Crispy Paneer Tikka',
    code: 'STR-01',
    category: 'Starters & Snacks',
    price: 250,
    taxRate: 5,
    available: true,
    kitchenStation: 'Tandoor'
  },
  {
    id: 'dm-8',
    name: 'Club Veg Sandwich & Fries',
    code: 'STR-02',
    category: 'Starters & Snacks',
    price: 160,
    taxRate: 5,
    available: true,
    kitchenStation: 'Main Kitchen'
  },
  {
    id: 'dm-9',
    name: 'Special Masala Tea / Chai',
    code: 'BEV-01',
    category: 'Beverages & Tea',
    price: 50,
    taxRate: 5,
    available: true,
    kitchenStation: 'Beverage Bar'
  },
  {
    id: 'dm-10',
    name: 'Fresh Lime Soda (Sweet / Salted)',
    code: 'BEV-02',
    category: 'Beverages & Tea',
    price: 80,
    taxRate: 5,
    available: true,
    kitchenStation: 'Beverage Bar'
  },
  {
    id: 'dm-11',
    name: 'Mineral Water Bottle (1L)',
    code: 'BEV-03',
    category: 'Beverages & Tea',
    price: 30,
    taxRate: 5,
    available: true,
    kitchenStation: 'Beverage Bar'
  },
  {
    id: 'dm-12',
    name: 'Hot Gulab Jamun (2 Pcs)',
    code: 'DES-01',
    category: 'Desserts',
    price: 90,
    taxRate: 5,
    available: true,
    kitchenStation: 'Main Kitchen'
  }
];

interface DigitalMenuViewProps {
  hotelId: string;
  hotelName?: string;
  hotelPhone?: string;
  items: PosItem[];
  rooms: Room[];
  checkins: GuestCheckIn[];
  orders: PosOrder[];
  onUpdateOrders?: (orders: PosOrder[]) => void;
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  onBackToAdmin?: () => void;
  isEmbeddedPreview?: boolean;
}

export default function DigitalMenuView({
  hotelId,
  hotelName = 'Grand Hotel Room Service',
  hotelPhone,
  items = [],
  rooms = [],
  checkins = [],
  orders = [],
  onUpdateOrders,
  onUpdateCheckins,
  onBackToAdmin,
  isEmbeddedPreview = false
}: DigitalMenuViewProps) {
  const [remoteMenuItems, setRemoteMenuItems] = useState<PosItem[]>([]);
  const [remoteRooms, setRemoteRooms] = useState<Room[]>([]);
  const [remoteHotelName, setRemoteHotelName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Cart state: itemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Guest Order Form (Room Name/No + Mobile Number as requested)
  const [roomNumberInput, setRoomNumberInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('room') || '';
    }
    return '';
  });
  const [mobileInput, setMobileInput] = useState('');
  const [guestNameInput, setGuestNameInput] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<PosOrder | null>(null);

  // Fetch live menu & rooms from backend when opened by a guest on mobile
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/digital-menu?hotelId=${encodeURIComponent(hotelId || 'hotel-1')}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data || !data.success) return;
        if (Array.isArray(data.items) && data.items.length > 0) {
          setRemoteMenuItems(data.items);
        }
        if (Array.isArray(data.rooms) && data.rooms.length > 0) {
          setRemoteRooms(data.rooms);
        }
        if (data.hotelName) {
          setRemoteHotelName(data.hotelName);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  const effectiveHotelName = remoteHotelName || hotelName || 'Hotel Digital Menu';

  const activeMenuItems = useMemo(() => {
    const source = items.length > 0 ? items : remoteMenuItems.length > 0 ? remoteMenuItems : FALLBACK_DIGITAL_MENU_ITEMS;
    return source.filter(i => i.available !== false);
  }, [items, remoteMenuItems]);

  const effectiveRooms = useMemo(() => {
    return rooms.length > 0 ? rooms : remoteRooms;
  }, [rooms, remoteRooms]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(activeMenuItems.map(i => i.category || 'General')));
    return ['All', ...cats];
  }, [activeMenuItems]);

  const filteredItems = useMemo(() => {
    return activeMenuItems.filter(item => {
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.code || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [activeMenuItems, selectedCategory, searchQuery]);

  // Auto-fill guest name & mobile if room matches an active check-in
  useEffect(() => {
    const cleanRoom = roomNumberInput.trim();
    if (!cleanRoom) return;
    const activeStay = checkins.find(
      c =>
        !c.checkedOutDateTime &&
        (String(c.roomNumber).trim().toLowerCase() === cleanRoom.toLowerCase() ||
          (c.bookedRooms || []).some(br => String(br.roomNumber).trim().toLowerCase() === cleanRoom.toLowerCase()))
    );
    if (activeStay) {
      if (!guestNameInput && activeStay.guestName) setGuestNameInput(activeStay.guestName);
      if (!mobileInput && (activeStay.mobile || (activeStay as any).phoneNumber)) setMobileInput(activeStay.mobile || (activeStay as any).phoneNumber);
    }
  }, [roomNumberInput, checkins]);

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) {
        delete copy[itemId];
      } else {
        copy[itemId] = next;
      }
      return copy;
    });
  };

  const cartEntries = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const item = activeMenuItems.find(i => i.id === id);
        const numQty = Number(qty) || 0;
        if (!item || numQty <= 0) return null;
        return { item, quantity: numQty, lineTotal: item.price * numQty };
      })
      .filter(Boolean) as { item: PosItem; quantity: number; lineTotal: number }[];
  }, [cart, activeMenuItems]);

  const totalItemsCount = cartEntries.reduce((s, e) => s + e.quantity, 0);
  const cartSubtotal = cartEntries.reduce((s, e) => s + e.lineTotal, 0);
  const cartTax = parseFloat(
    cartEntries.reduce((s, e) => s + (e.lineTotal * (e.item.taxRate ?? 5)) / 100, 0).toFixed(2)
  );
  const cartGrandTotal = parseFloat((cartSubtotal + cartTax).toFixed(2));

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartEntries.length === 0) {
      showToast('Please add at least 1 item from the menu.', 'warning');
      return;
    }

    const cleanRoom = roomNumberInput.trim();
    const cleanMobile = mobileInput.trim();

    if (!cleanRoom) {
      showToast('Please enter your Room Number / Room Name.', 'warning');
      return;
    }
    if (!cleanMobile || cleanMobile.replace(/\D/g, '').length < 10) {
      showToast('Please enter a valid 10-digit Mobile Number.', 'warning');
      return;
    }

    setIsSubmitting(true);

    const activeStay = checkins.find(
      c =>
        !c.checkedOutDateTime &&
        (String(c.roomNumber).trim().toLowerCase() === cleanRoom.toLowerCase() ||
          (c.bookedRooms || []).some(br => String(br.roomNumber).trim().toLowerCase() === cleanRoom.toLowerCase()))
    );

    const resolvedGuestName =
      guestNameInput.trim() || activeStay?.guestName || `Room ${cleanRoom} Guest`;

    const orderId = `order-qr-${Date.now()}`;
    const orderNumber = `QR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const orderItems: PosOrderItem[] = cartEntries.map(entry => ({
      itemId: entry.item.id,
      itemName: entry.item.name,
      itemCode: entry.item.code || 'MENU',
      price: entry.item.price,
      taxRate: entry.item.taxRate ?? 5,
      quantity: entry.quantity,
      total: entry.lineTotal
    }));

    const newOrder: PosOrder = {
      id: orderId,
      orderNumber,
      orderType: 'Room Service',
      roomNumber: cleanRoom,
      checkinId: activeStay?.id,
      checkInId: activeStay?.id,
      folioChargeId: activeStay ? `EC-POS-${orderId}` : undefined,
      guestName: resolvedGuestName,
      customerPhone: cleanMobile,
      items: orderItems,
      subtotal: cartSubtotal,
      taxAmount: cartTax,
      cgst: parseFloat((cartTax / 2).toFixed(2)),
      sgst: parseFloat((cartTax - parseFloat((cartTax / 2).toFixed(2))).toFixed(2)),
      discount: 0,
      grandTotal: cartGrandTotal,
      paymentMethod: 'Room Charge',
      paymentStatus: 'Unpaid',
      status: 'KOT Sent',
      date: todayStr,
      time: timeStr,
      hotelId: hotelId || 'hotel-1',
      isSaved: true,
      kotSent: true,
      kotSentAt: timeStr,
      kitchenStatus: 'Pending',
      notes: orderNotes.trim()
        ? `[QR Digital Menu • Mob: ${cleanMobile}] ${orderNotes.trim()}`
        : `[QR Digital Menu • Mob: ${cleanMobile}]`
    };

    try {
      // 1. Send to backend public QR Order endpoint so KDS & Admin receive it immediately
      await fetch('/api/public/digital-menu/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotelId || 'hotel-1',
          order: newOrder
        })
      }).catch(() => {});

      // 2. Also update local state if in same browser session
      if (onUpdateOrders) {
        onUpdateOrders([newOrder, ...orders]);
      }

      if (activeStay && onUpdateCheckins) {
        const folioChargeId = `EC-POS-${orderId}`;
        const itemsSummary = orderItems.map(i => `${i.itemName} x${i.quantity}`).join(', ');
        const newCharge: ExtraCharge = {
          id: folioChargeId,
          category: 'Food',
          sourceType: 'pos_order',
          sourceId: orderId,
          amount: cartGrandTotal,
          date: todayStr,
          description: `QR Menu Order #${orderNumber} (${itemsSummary})`,
          dateTime: nowIso,
          addedBy: 'Digital QR Menu'
        };
        const updatedCheckins = checkins.map(c => {
          if (c.id !== activeStay.id) return c;
          const prevCharges = Array.isArray(c.extraCharges) ? c.extraCharges : [];
          return {
            ...c,
            extraCharges: [...prevCharges, newCharge],
            pendingAmount: Math.max(0, Number(c.pendingAmount || 0) + cartGrandTotal)
          };
        });
        onUpdateCheckins(updatedCheckins);
      }

      setConfirmedOrder(newOrder);
      setCart({});
      setIsCheckoutOpen(false);
      showToast(`Order #${orderNumber} placed for Room ${cleanRoom}!`, 'success');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${isEmbeddedPreview ? 'rounded-2xl border border-luxury-brown-200 overflow-hidden shadow-lg' : 'min-h-screen'} bg-[#FAF7F2] text-[#1C140E] pb-28`}>
      {/* TOP LUXURY HOTEL DIGITAL MENU BANNER */}
      <div className="bg-gradient-to-r from-[#17120F] via-[#261D17] to-[#17120F] text-white px-4 py-5 border-b border-[#C49A3A]/30 sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {onBackToAdmin && (
                <button
                  type="button"
                  onClick={onBackToAdmin}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#C49A3A] transition cursor-pointer"
                  title="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-[#C49A3A]/20 border border-[#C49A3A]/40 flex items-center justify-center text-[#C49A3A] shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#C49A3A]/20 text-[#E5C158] font-bold">
                    In-Room Digital Menu
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-serif font-bold text-white tracking-tight mt-0.5">
                  {effectiveHotelName}
                </h1>
              </div>
            </div>

            {roomNumberInput && (
              <div className="px-3 py-1.5 rounded-xl bg-[#C49A3A]/20 border border-[#C49A3A]/40 text-right">
                <span className="text-[9px] uppercase font-mono text-[#E5C158] block">Ordering For</span>
                <span className="text-xs font-extrabold text-white">Room {roomNumberInput}</span>
              </div>
            )}
          </div>

          {/* SEARCH BAR (As requested: "search karne pe QR code scan karenge hamara jitna menu rahega woh open hoga") */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#C49A3A] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search dishes, biryani, snacks, beverages..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white text-[#17120F] placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#C49A3A] shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* CATEGORY FILTER PILLS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#C49A3A] text-[#17120F] shadow-sm'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-6">
        {/* ORDER CONFIRMATION BANNER IF JUST ORDERED */}
        {confirmedOrder && (
          <div className="bg-emerald-950 text-white rounded-2xl p-5 border-2 border-emerald-500/40 shadow-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold block">
                    Order Sent to Kitchen (KOT)
                  </span>
                  <h3 className="text-base sm:text-lg font-bold">
                    Order #{confirmedOrder.orderNumber} Confirmed!
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmedOrder(null)}
                className="text-emerald-300 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-black/25 p-3 rounded-xl border border-white/10">
              <div>
                <span className="text-emerald-300/80 block text-[10px]">Room Number</span>
                <strong className="font-mono text-sm">Room {confirmedOrder.roomNumber}</strong>
              </div>
              <div>
                <span className="text-emerald-300/80 block text-[10px]">Mobile Number</span>
                <strong className="font-mono text-sm">{confirmedOrder.customerPhone}</strong>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-emerald-300/80 block text-[10px]">Total Bill (incl. GST)</span>
                <strong className="font-mono text-sm text-[#E5C158]">₹{confirmedOrder.grandTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="text-xs text-emerald-200 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-[#E5C158] shrink-0" />
              <span>Your fresh food order is being prepared by our kitchen and will be delivered to Room {confirmedOrder.roomNumber}.</span>
            </div>
          </div>
        )}

        {/* MENU ITEMS GRID (Domino's / Mall Digital Menu Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredItems.map(item => {
            const qty = cart[item.id] || 0;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 border border-[#E6DEC8] hover:border-[#C49A3A] shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {item.category}
                    </span>
                    {item.code && (
                      <span className="text-[10px] font-mono text-slate-400">{item.code}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-[#17120F] truncate">
                    {item.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5 pt-0.5">
                    <span className="text-base font-extrabold font-mono text-[#17120F]">
                      ₹{item.price}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      +{item.taxRate ?? 5}% GST
                    </span>
                  </div>
                </div>

                {/* + ADD / QUANTITY STEPPER */}
                <div className="shrink-0">
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, 1)}
                      className="px-4 py-2 rounded-xl bg-[#17120F] hover:bg-[#2A211B] text-[#E5C158] font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition active:scale-95 border border-[#C49A3A]/40"
                    >
                      <Plus className="w-3.5 h-3.5" /> ADD
                    </button>
                  ) : (
                    <div className="flex items-center bg-[#17120F] text-white rounded-xl p-1 border border-[#C49A3A] shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-[#E5C158] cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2.5 font-mono font-extrabold text-xs text-white">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-[#E5C158] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl p-10 text-center border border-[#E6DEC8] space-y-2">
              <Utensils className="w-8 h-8 text-[#C49A3A] mx-auto opacity-70" />
              <p className="text-sm font-bold text-slate-700">No dishes match "{searchQuery}"</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="text-xs font-bold text-[#C49A3A] underline cursor-pointer"
              >
                Show Full Menu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING BOTTOM CART BAR */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 bg-gradient-to-t from-black/50 to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto bg-[#17120F] text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl border-2 border-[#C49A3A] flex items-center justify-between gap-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C49A3A] text-[#17120F] flex items-center justify-center font-extrabold text-sm shrink-0">
                {totalItemsCount}
              </div>
              <div>
                <div className="text-xs text-slate-300 font-medium">
                  {totalItemsCount} {totalItemsCount === 1 ? 'Item' : 'Items'} Added
                </div>
                <div className="text-base sm:text-lg font-extrabold font-mono text-[#E5C158]">
                  ₹{cartGrandTotal.toFixed(2)}{' '}
                  <span className="text-[10px] font-normal text-slate-400">(incl. GST)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCheckoutOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#C49A3A] hover:bg-[#d4a942] text-[#17120F] font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Proceed to Order</span>
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (Enter Room Name/No + Mobile Number & Place Order) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#E6DEC8] max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#C49A3A] font-bold block">
                  Express Room Service Checkout
                </span>
                <h3 className="text-lg font-serif font-bold text-[#17120F]">
                  Confirm Your Room Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SELECTED ITEMS SUMMARY */}
            <div className="bg-[#FAF7F2] rounded-2xl p-3.5 border border-[#E6DEC8] space-y-2 max-h-48 overflow-y-auto">
              {cartEntries.map(({ item, quantity, lineTotal }) => (
                <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0">
                  <div className="flex-1 min-w-0 pr-2">
                    <span className="font-bold text-[#17120F] block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">₹{item.price} × {quantity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className="px-2 py-1 text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 font-mono font-bold text-xs">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className="px-2 py-1 text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-mono font-bold text-xs w-14 text-right">
                      ₹{lineTotal}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* GUEST ROOM & MOBILE FORM */}
            <form onSubmit={handlePlaceOrder} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#17120F] flex items-center gap-1.5 mb-1">
                  <Bed className="w-3.5 h-3.5 text-[#C49A3A]" />
                  <span>Room Number / Room Name *</span>
                </label>
                <input
                  type="text"
                  required
                  list="digital-menu-rooms-list"
                  value={roomNumberInput}
                  onChange={e => setRoomNumberInput(e.target.value)}
                  placeholder="Enter Room No. (e.g. 101, 102, Deluxe 201)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-[#17120F] focus:outline-none focus:ring-2 focus:ring-[#C49A3A]"
                />
                <datalist id="digital-menu-rooms-list">
                  {effectiveRooms.map(r => (
                    <option key={r.id} value={r.number}>
                      Room {r.number} ({r.type || r.category || 'Suite'})
                    </option>
                  ))}
                </datalist>
                {effectiveRooms.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span className="text-[10px] text-slate-400 font-medium">Quick Select:</span>
                    {effectiveRooms.slice(0, 8).map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRoomNumberInput(String(r.number))}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border cursor-pointer transition ${
                          String(roomNumberInput).trim() === String(r.number)
                            ? 'bg-[#17120F] text-[#E5C158] border-[#C49A3A]'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        Room {r.number}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-[#17120F] flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5 text-[#C49A3A]" />
                  <span>Mobile Number *</span>
                </label>
                <input
                  type="tel"
                  required
                  value={mobileInput}
                  onChange={e => setMobileInput(e.target.value)}
                  placeholder="Enter 10-digit Mobile Number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-[#17120F] focus:outline-none focus:ring-2 focus:ring-[#C49A3A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Guest Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={guestNameInput}
                    onChange={e => setGuestNameInput(e.target.value)}
                    placeholder="Your Name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-[#17120F] focus:outline-none focus:ring-1 focus:ring-[#C49A3A]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Cooking Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    placeholder="e.g. Less spicy, extra plates"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-[#17120F] focus:outline-none focus:ring-1 focus:ring-[#C49A3A]"
                  />
                </div>
              </div>

              {/* BILL SUMMARY */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-mono">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (5%)</span>
                  <span className="font-mono">₹{cartTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-[#17120F] pt-1 border-t border-slate-200">
                  <span>Grand Total (Billed to Room)</span>
                  <span className="font-mono text-emerald-700">₹{cartGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#17120F] hover:bg-black text-[#E5C158] font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition disabled:opacity-50 border border-[#C49A3A]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Placing Order...' : `Place Room Order • ₹${cartGrandTotal.toFixed(2)}`}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
