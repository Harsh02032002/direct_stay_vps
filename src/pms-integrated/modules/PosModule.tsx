import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Plus,
  Minus,
  Trash2,
  Printer,
  ChefHat,
  CheckCircle2,
  Search,
  BedDouble,
  X,
  FileText,
  QrCode,
  ExternalLink,
  Copy,
  Calendar,
  Pencil,
} from 'lucide-react';
import {
  BookingRecord,
  PaymentMethod,
  PosMenuItem,
  PosOrderRecord,
} from '../types';
import type { FoodAdvanceBooking } from '../../types';
import FoodAdvanceBookingPanel from '../../components/FoodAdvanceBookingPanel';
import { formatCurrency } from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import { r2 } from '../../utils/billCalculator';

interface PosModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  menuItems: PosMenuItem[];
  orders: PosOrderRecord[];
  bookings: BookingRecord[];
  hotelId?: string;
  hotelName?: string;
  loggedInUser?: string;
  foodGstRate?: number;
  posAdvanceBookings?: FoodAdvanceBooking[];
  onUpdatePosAdvanceBookings?: (updated: FoodAdvanceBooking[]) => void;
  onCreatePosOrder: (order: PosOrderRecord, postToBookingId?: string) => void;
  onUpdateKotStatus: (orderId: string, nextStatus: PosOrderRecord['kotStatus']) => void;
  onAddMenuItem?: (item: PosMenuItem) => void;
  onUpdateMenuItem?: (item: PosMenuItem) => void;
  onDeleteMenuItem?: (itemId: string) => void;
}

const SUB_TABS = [
  { id: 'terminal', label: 'POS Billing Terminal' },
  { id: 'advance_booking', label: 'POS Advance Booking' },
  { id: 'kds', label: 'Kitchen Display (KDS / KOT)' },
  { id: 'orders', label: 'All Food Orders' },
  { id: 'tables', label: 'Restaurant Tables' },
  { id: 'catalog', label: 'Menu & Recipe Master' },
  { id: 'qr_menu', label: 'Digital Menu QR Code' },
  { id: 'reports', label: 'F&B Sales Summary' },
];

export const PosModule: React.FC<PosModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  menuItems,
  orders,
  bookings,
  hotelId = 'hotel-1',
  hotelName = 'Hotel Royal Palace',
  loggedInUser = 'Admin',
  foodGstRate,
  posAdvanceBookings = [],
  onUpdatePosAdvanceBookings,
  onCreatePosOrder,
  onUpdateKotStatus,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<'Room Service' | 'Dine In' | 'Takeaway'>('Room Service');
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    bookings.find((b) => b.isCheckedIn && !b.isCheckedOut)?.id || bookings[0]?.id || ''
  );
  const [tableNumber, setTableNumber] = useState('T-01');
  const [cart, setCart] = useState<{ item: PosMenuItem; qty: number }[]>([]);
  const [printingFoodOrder, setPrintingFoodOrder] = useState<PosOrderRecord | null>(null);

  // New / Edit Menu Item State
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<PosMenuItem['category']>('North Indian');
  const [newItemPrice, setNewItemPrice] = useState<number | ''>(180);
  const [newItemVeg, setNewItemVeg] = useState<boolean>(true);

  // Video Exact "Additional Details" Modal State
  const [showAdditionalModal, setShowAdditionalModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Room Charge');
  const [instructions, setInstructions] = useState('');

  const inHouseBookings = bookings.filter((b) => !b.isCheckedOut);
  const activeBooking =
    inHouseBookings.find((b) => b.id === selectedBookingId) ||
    bookings.find((b) => b.id === selectedBookingId) ||
    inHouseBookings[0] ||
    bookings[0];

  useEffect(() => {
    if (!selectedBookingId && (inHouseBookings[0] || bookings[0])) {
      setSelectedBookingId((inHouseBookings[0] || bookings[0]).id);
    } else if (
      selectedBookingId &&
      inHouseBookings.length > 0 &&
      !inHouseBookings.some((b) => b.id === selectedBookingId)
    ) {
      setSelectedBookingId(inHouseBookings[0].id);
    }
  }, [bookings, inHouseBookings, selectedBookingId]);

  const addToCart = (item: PosMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.item.id === itemId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const [taxSettings] = useHotelTaxSettings();
  const configuredFnbGst =
    foodGstRate !== undefined ? foodGstRate : r2(taxSettings.fnbCgst + taxSettings.fnbSgst);
  const subtotal = r2(cart.reduce((sum, c) => sum + c.item.price * c.qty, 0));
  const taxAmount = r2((subtotal * configuredFnbGst) / 100);
  const grandTotal = r2(subtotal + taxAmount);

  useEffect(() => {
    if (orderType !== 'Room Service' && paymentMethod === 'Room Charge') {
      setPaymentMethod('Cash');
    } else if (orderType === 'Room Service' && paymentMethod !== 'Room Charge') {
      setPaymentMethod('Room Charge');
    }
  }, [orderType]);

  const handleFinalizeOrder = (actionLabel: 'Print' | 'KOT' | 'KOT + Invoice' | 'Save') => {
    if (cart.length === 0) return;
    const orderNum = `POS-${Math.floor(10000 + Math.random() * 90000)}`;
    const isRoomPost = orderType === 'Room Service' && paymentMethod === 'Room Charge';
    const effectiveMode: PaymentMethod =
      orderType !== 'Room Service' && paymentMethod === 'Room Charge' ? 'Cash' : paymentMethod;
    const newOrder: PosOrderRecord = {
      id: `pos-${Date.now()}`,
      orderNumber: orderNum,
      orderType,
      roomNumber: orderType === 'Room Service' ? activeBooking?.roomNumbers[0] : undefined,
      roomName: orderType === 'Room Service' ? `Room ${activeBooking?.roomNumbers[0]}` : undefined,
      bookingId: isRoomPost ? activeBooking?.id : undefined,
      tableNumber: orderType === 'Dine In' ? tableNumber : undefined,
      customerName:
        orderType === 'Room Service' ? activeBooking?.customerName || 'In-House Guest' : 'Walk-In Diner',
      customerPhone: orderType === 'Room Service' ? activeBooking?.mobile || '' : '',
      items: cart.map((c) => ({
        itemId: c.item.id,
        name: c.item.name,
        qty: c.qty,
        price: c.item.price,
        total: r2(c.item.price * c.qty),
      })),
      subtotal,
      discount: 0,
      taxAmount,
      grandTotal,
      paymentMethod: effectiveMode,
      paymentStatus: isRoomPost ? 'Unpaid (Room Folio)' : 'Paid',
      kotStatus: actionLabel.includes('KOT') ? 'KOT Sent' : 'Preparing',
      instructions,
      dateTime: new Date().toISOString().slice(0, 10),
    };

    onCreatePosOrder(
      newOrder,
      isRoomPost ? activeBooking?.id : undefined
    );
    if (actionLabel === 'Print' || actionLabel === 'KOT + Invoice') {
      setPrintingFoodOrder(newOrder);
    }
    setCart([]);
    setShowAdditionalModal(false);
  };

  const filteredMenu = menuItems.filter((m) => {
    const matchCat = selectedCategory === 'ALL' || m.category === selectedCategory;
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header & Sub-Tabs */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              POS Restaurant & Room Service Terminal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Direct Room Folio Sync (`Other Services`) • Kitchen Order Tickets (KOT) • Multi-Mode Settlement
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 text-[11px] sm:text-xs w-full md:w-auto">
            <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-bold text-center">
              Active KOTs: {orders.filter((o) => o.kotStatus !== 'Served').length}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-center truncate">
              Today POS Sales: {formatCurrency(orders.reduce((s, o) => s + o.grandTotal, 0))}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {SUB_TABS.map((t) => {
            const isActive = (activeSubTab === 'dashboard' ? 'terminal' : activeSubTab) === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSubTabChange(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-amber-400 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.id === 'qr_menu' && <QrCode className="w-3.5 h-3.5" />}
                {t.id === 'advance_booking' && <Calendar className="w-3.5 h-3.5" />}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: POS TERMINAL & ROOM SERVICE CART */}
      {(activeSubTab === 'terminal' || activeSubTab === 'dashboard') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Items Grid */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from(
                  new Set([
                    'ALL',
                    ...menuItems.map((m) => m.category).filter(Boolean),
                    'North Indian',
                    'Fast Food',
                    'Breakfast',
                    'Beverages',
                    'Desserts',
                  ])
                ).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search dish or code..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredMenu.length === 0 ? (
                <div className="col-span-full py-10 text-center text-xs text-slate-500 space-y-2">
                  <div>No menu items added yet.</div>
                  <button
                    type="button"
                    onClick={() => onSubTabChange('catalog')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                  >
                    + Add Items in Menu & Recipe Master
                  </button>
                </div>
              ) : null}
              {filteredMenu.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 cursor-pointer transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{item.code}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded ${
                          item.isVeg ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.isVeg ? 'VEG' : 'NON-VEG'}
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 mt-1">{item.name}</div>
                    <div className="text-[10px] text-slate-500">{item.kitchenStation}</div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/70">
                    <span className="text-sm font-extrabold text-slate-900">{formatCurrency(item.price)}</span>
                    <span className="px-2 py-1 rounded-lg bg-slate-900 text-amber-400 text-[10px] font-bold flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right POS Cart & Room Linker */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4 h-fit sticky top-20">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-amber-500" />
                  Current POS Order Ticket
                </h3>
                <span className="text-xs font-bold text-slate-400">{cart.length} Items</span>
              </div>

              {/* Order Type Toggle */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['Room Service', 'Dine In', 'Takeaway'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      orderType === t ? 'bg-slate-900 text-amber-400 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Room Selector if Room Service */}
              {orderType === 'Room Service' ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase text-amber-900">
                    Link to In-House Room & Guest Folio
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900"
                  >
                    {inHouseBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        Room {b.roomNumbers.join(', ')} — {b.customerName} (#{b.bookingNo})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Table Number
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
              )}

              {/* Cart Items */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {cart.map(({ item, qty }) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {formatCurrency(item.price)} x {qty}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold w-4 text-center">{qty}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="font-extrabold text-slate-900 w-14 text-right">
                        {formatCurrency(item.price * qty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals & Additional Details Trigger */}
            <div className="space-y-3 pt-3 border-t border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Food Subtotal</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  F&B GST ({configuredFnbGst}% = {taxSettings.fnbCgst}% CGST + {taxSettings.fnbSgst}% SGST)
                </span>
                <span className="font-bold">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                <span>Grand Total</span>
                <span className="text-amber-600">{formatCurrency(grandTotal)}</span>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={() => setShowAdditionalModal(true)}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-sm transition"
              >
                Proceed to KOT & Settlement →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: MENU & RECIPE MASTER */}
      {activeSubTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newItemName.trim()) return;
              if (editingMenuItemId && onUpdateMenuItem) {
                const existing = menuItems.find((m) => m.id === editingMenuItemId);
                onUpdateMenuItem({
                  ...(existing || {}),
                  id: editingMenuItemId,
                  code: newItemCode.trim() || existing?.code || `FD-${Math.floor(100 + Math.random() * 900)}`,
                  name: newItemName.trim(),
                  category: newItemCategory,
                  price: Number(newItemPrice) || 100,
                  taxRate: existing?.taxRate ?? 5,
                  isVeg: Boolean(newItemVeg),
                  available: existing?.available !== false,
                  isAvailable: true,
                });
                setEditingMenuItemId(null);
              } else if (onAddMenuItem) {
                onAddMenuItem({
                  id: `pos-item-${Date.now()}`,
                  code: newItemCode.trim() || `FD-${Math.floor(100 + Math.random() * 900)}`,
                  name: newItemName.trim(),
                  category: newItemCategory,
                  price: Number(newItemPrice) || 100,
                  taxRate: 5,
                  isVeg: Boolean(newItemVeg),
                  available: true,
                  isAvailable: true,
                });
              }
              setNewItemName('');
              setNewItemCode('');
              setNewItemPrice(180);
              setNewItemVeg(true);
            }}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-500" />
                {editingMenuItemId ? '✏️ Edit Menu Item' : '+ Add Dynamic Menu Item'}
              </h3>
              {editingMenuItemId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMenuItemId(null);
                    setNewItemName('');
                    setNewItemCode('');
                    setNewItemPrice(180);
                    setNewItemVeg(true);
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Dish / Item Name *</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Paneer Butter Masala"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    Category (Select or Type) *
                  </label>
                  <input
                    type="text"
                    required
                    list="pos-menu-category-options"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    placeholder="Select or type category (e.g. Chinese)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white focus:border-amber-500 focus:outline-none"
                  />
                  <datalist id="pos-menu-category-options">
                    {Array.from(
                      new Set([
                        ...menuItems.map((m) => m.category).filter(Boolean),
                        'North Indian',
                        'South Indian',
                        'Chinese',
                        'Continental',
                        'Fast Food',
                        'Breakfast',
                        'Tandoor & Breads',
                        'Thali & Combos',
                        'Beverages',
                        'Desserts',
                        'Snacks & Starters',
                      ])
                    ).map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 250"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">Food Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItemVeg(true)}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      newItemVeg
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    <span>🟢</span> Pure Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemVeg(false)}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      !newItemVeg
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50'
                    }`}
                  >
                    <span>🔴</span> Non-Veg
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              {editingMenuItemId ? '✓ Update Menu Item' : '+ Save Item to POS Menu'}
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Menu Catalog ({menuItems.length} Items)
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Type</th>
                    {(onUpdateMenuItem || onDeleteMenuItem) && <th className="py-3 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {menuItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No menu items added yet. Use the form on the left to add dynamic food & beverage items.
                      </td>
                    </tr>
                  ) : (
                    menuItems.map((m) => (
                      <tr key={m.id} className={editingMenuItemId === m.id ? 'bg-amber-50/70' : ''}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-600 whitespace-nowrap">{m.code}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{m.name}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{m.category}</td>
                        <td className="py-3 px-4 font-extrabold whitespace-nowrap">{formatCurrency(m.price)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.isVeg ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {m.isVeg ? 'VEG' : 'NON-VEG'}
                          </span>
                        </td>
                        {(onUpdateMenuItem || onDeleteMenuItem) && (
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            {onUpdateMenuItem && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMenuItemId(m.id);
                                  setNewItemName(m.name);
                                  setNewItemCode(m.code);
                                  setNewItemCategory(m.category);
                                  setNewItemPrice(m.price);
                                  setNewItemVeg(Boolean(m.isVeg));
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 font-bold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                                title="Edit Dish Name, Category, Price & Veg/Non-Veg"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                            )}
                            {onDeleteMenuItem && (
                              <button
                                type="button"
                                onClick={() => onDeleteMenuItem(m.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer inline-flex"
                                title="Delete Dish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: DIGITAL MENU QR CODE */}
      {activeSubTab === 'qr_menu' && (() => {
        const publicMenuUrl = `${window.location.origin}/digital-menu?hotelId=${encodeURIComponent(hotelId || 'hotel-1')}`;
        const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(publicMenuUrl)}`;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Printable QR Standee Card */}
            <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-amber-300/80 shadow-lg p-6 text-center space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-extrabold uppercase tracking-wider">
                <QrCode className="w-3.5 h-3.5" />
                Universal Digital Menu QR Code
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {hotelName || 'Hotel Digital Menu'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Scan from any smartphone to view our live Food & Beverage menu and order directly to your Room or Table
                </p>
              </div>
              <div className="mx-auto w-64 h-64 p-4 rounded-3xl bg-white border-2 border-slate-900 shadow-md flex items-center justify-center">
                <img
                  src={qrImageSrc}
                  alt="Digital Menu QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">Public Digital Menu Link</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-slate-700 truncate">{publicMenuUrl}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(publicMenuUrl);
                      window.alert('Digital Menu Link copied to clipboard!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print QR Standee
                </button>
                <a
                  href={publicMenuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Live Menu
                </a>
              </div>
            </div>

            {/* Live Menu Items Preview & How It Works */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    How the Universal Hotel QR Menu Works
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    One QR code for the entire hotel — automatically syncs with your Menu & Recipe Master ({menuItems.length} active dishes)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSubTabChange('catalog')}
                  className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs cursor-pointer"
                >
                  + Edit Menu Items
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">STEP 1</span>
                  <div className="font-extrabold text-slate-900">Guest Scans QR Code</div>
                  <p className="text-[11px] text-slate-600">Place this printed QR standee in rooms, reception, or restaurant tables.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">STEP 2</span>
                  <div className="font-extrabold text-slate-900">Selects Dishes & Room</div>
                  <p className="text-[11px] text-slate-600">Guest browses categories, adds items to cart, and enters their Room or Table No.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-blue-600 text-white font-black text-[10px]">STEP 3</span>
                  <div className="font-extrabold text-slate-900">Instant KOT & Folio Sync</div>
                  <p className="text-[11px] text-slate-600">Order lands directly in Kitchen Display (KDS) and links to the Room Folio.</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Live Dishes Shown on QR Menu ({menuItems.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.category} • {item.isVeg ? 'Pure Veg' : 'Non-Veg'}</div>
                      </div>
                      <span className="font-extrabold text-slate-900 shrink-0">{formatCurrency(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUB-TAB 2 & 3: KITCHEN DISPLAY (KDS) & ALL FOOD ORDERS */}
      {(activeSubTab === 'kds' || activeSubTab === 'orders' || activeSubTab === 'tables' || activeSubTab === 'reports') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Live Kitchen Order Tickets (KOT) & Room Service Ledger</span>
            </h3>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[740px] text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Order / KOT #</th>
                  <th className="py-3 px-4">Type & Room</th>
                  <th className="py-3 px-4">Guest Name</th>
                  <th className="py-3 px-4">Items Ordered</th>
                  <th className="py-3 px-4">Grand Total</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">KOT Status</th>
                  <th className="py-3 px-4 text-right">Kitchen Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 whitespace-nowrap">
                      <div>{ord.orderNumber}</div>
                      <div className="text-[10px] font-normal text-slate-400">{ord.dateTime}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-bold text-[10px]">
                        {ord.roomName || ord.tableNumber || ord.orderType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold whitespace-nowrap">{ord.customerName}</td>
                    <td className="py-3.5 px-4">
                      {ord.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold whitespace-nowrap">{formatCurrency(ord.grandTotal)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                        {ord.paymentMethod} ({ord.paymentStatus})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          ord.kotStatus === 'Served'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ord.kotStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPrintingFoodOrder(ord)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Print POS Food Bill / Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Food Bill</span>
                        </button>
                        {ord.kotStatus !== 'Served' && (
                          <button
                            onClick={() => onUpdateKotStatus(ord.id, 'Served')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Mark Served
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'advance_booking' && (
        <FoodAdvanceBookingPanel
          bookings={posAdvanceBookings}
          hotelName={hotelName}
          loggedInUser={loggedInUser}
          onUpdateBookings={(updated) => {
            if (onUpdatePosAdvanceBookings) {
              onUpdatePosAdvanceBookings(updated);
            }
          }}
          onCreatePosOrderFromAdvance={(adv) => {
            const orderId = `POS-ADV-${Date.now().toString().slice(-6)}`;
            const orderNo = `KOT-${Date.now().toString().slice(-5)}`;
            const billablePax = Math.max(1, (Number(adv.pax) || 1) - (Number(adv.focPax) || 0));
            const totalAmt = Number(adv.totalAmount) || billablePax * (Number(adv.ratePerPax) || 0);
            const unitPrice = billablePax > 0 ? r2(totalAmt / billablePax) : totalAmt;
            const newPosOrder: PosOrderRecord = {
              id: orderId,
              orderNumber: orderNo,
              orderType: 'Dine In',
              tableNumber: 'BANQUET',
              customerName: `${adv.guestOrGroupName}${adv.companyName ? ` (${adv.companyName})` : ''}`,
              customerPhone: adv.mobile || '',
              items: [
                {
                  itemId: `adv-${adv.id}`,
                  name: `${(adv.meals || ['Meal']).join('/')} — ${adv.menuCuisine || 'Pre-Booked Menu'} (${adv.pax} Pax${adv.focPax ? `, ${adv.focPax} FOC` : ''})`,
                  qty: billablePax,
                  price: unitPrice,
                  total: totalAmt,
                },
              ],
              subtotal: totalAmt,
              discount: 0,
              taxAmount: 0,
              grandTotal: totalAmt,
              paymentMethod: (adv.paymentMethod === 'UPI' || adv.paymentMethod === 'Cash' || adv.paymentMethod === 'Card'
                ? adv.paymentMethod
                : 'Cash') as PaymentMethod,
              paymentStatus: Number(adv.balanceAmount || 0) <= 0 ? 'Paid' : 'Unpaid (Room Folio)',
              kotStatus: 'Preparing',
              dateTime: new Date().toISOString().slice(0, 10),
              instructions: adv.specialRequest || `Advance Paid: ₹${adv.advanceAmount || 0} | Balance: ₹${adv.balanceAmount || 0}`,
            };
            onCreatePosOrder(newPosOrder);
            if (onUpdatePosAdvanceBookings) {
              onUpdatePosAdvanceBookings(
                posAdvanceBookings.map((item) =>
                  item.id === adv.id
                    ? { ...item, convertedPosOrderId: orderId, status: item.status === 'Advance' || item.status === 'In Process' ? 'Confirmed' : item.status }
                    : item
                )
              );
            }
            onSubTabChange('kds');
          }}
        />
      )}

      {/* VIDEO EXACT MODAL: "ADDITIONAL DETAILS" WITH PRINT | KOT | KOT + INVOICE | SAVE */}
      {showAdditionalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  POS Order Confirmation
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Additional Details & KOT Dispatch
                </h3>
              </div>
              <button onClick={() => setShowAdditionalModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500">Selected Room / Guest</div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {orderType === 'Room Service'
                      ? `Room ${activeBooking?.roomNumbers.join(', ')} — ${activeBooking?.customerName}`
                      : `Table ${tableNumber} — Walk-In Diner`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500">Order Payable</div>
                  <div className="font-extrabold text-amber-600 text-base">
                    {formatCurrency(grandTotal)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Settlement / Payment Option
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    (orderType === 'Room Service'
                      ? ['Room Charge', 'Cash', 'UPI', 'Card']
                      : ['Cash', 'UPI', 'Card']) as PaymentMethod[]
                  ).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPaymentMethod(mode)}
                      className={`py-2 px-2 rounded-xl font-bold text-xs border transition ${
                        paymentMethod === mode
                          ? 'bg-slate-900 text-amber-400 border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'Room Charge' && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                    ✓ This order will automatically appear under `{activeBooking?.customerName}` Booking Details → Other Services & Combined GST Invoice.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chef / Room Delivery Instructions
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            {/* 4 Video Action Buttons: Print | KOT | KOT + Invoice | Save */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleFinalizeOrder('Print')}
                className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                type="button"
                onClick={() => handleFinalizeOrder('KOT')}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1"
              >
                <ChefHat className="w-3.5 h-3.5" />
                KOT
              </button>
              <button
                type="button"
                onClick={() => handleFinalizeOrder('KOT + Invoice')}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                KOT + Invoice
              </button>
              <button
                type="button"
                onClick={() => handleFinalizeOrder('Save')}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* POPUP PRINTABLE FOOD BILL / INVOICE AS REQUESTED BY RAGHUNATH SIR */}
      {printingFoodOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  POS Restaurant Food Bill
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Invoice #{printingFoodOrder.orderNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintingFoodOrder(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between font-bold text-slate-800">
                <span>Guest / Customer:</span>
                <span>{printingFoodOrder.customerName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Order Destination:</span>
                <span className="font-semibold">{printingFoodOrder.roomName || printingFoodOrder.tableNumber || printingFoodOrder.orderType}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                <span>Date & Time:</span>
                <span>{printingFoodOrder.dateTime}</span>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 font-bold text-slate-600 border-b">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printingFoodOrder.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium text-slate-800">{it.name}</td>
                      <td className="p-2 text-center font-bold">{it.qty}</td>
                      <td className="p-2 text-right font-mono">₹{it.price}</td>
                      <td className="p-2 text-right font-mono font-bold">₹{it.qty * it.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(() => {
              const printTax = r2(printingFoodOrder.taxAmount ?? 0);
              const printDiscount = r2(printingFoodOrder.discount ?? 0);
              const printSubtotal =
                Number(printingFoodOrder.subtotal) > 0
                  ? r2(printingFoodOrder.subtotal)
                  : r2(Math.max(0, Number(printingFoodOrder.grandTotal || 0) - printTax + printDiscount));
              const netFoodTaxable = Math.max(0, r2(printSubtotal - printDiscount));
              const effFoodGstPct =
                netFoodTaxable > 0 && printTax > 0
                  ? r2((printTax / netFoodTaxable) * 100)
                  : configuredFnbGst;
              return (
                <div className="space-y-1.5 pt-2 border-t text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Food Subtotal:</span>
                    <span className="font-mono font-bold">₹{printSubtotal.toFixed(2)}</span>
                  </div>
                  {printDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Less Discount:</span>
                      <span className="font-mono font-bold">-₹{printDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>F&B GST ({printTax > 0 ? `${effFoodGstPct}%` : '0%'}):</span>
                    <span className="font-mono font-bold">₹{printTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t pt-1.5">
                    <span>Total Net Payable:</span>
                    <span className="font-mono text-emerald-700">
                      ₹{r2(printingFoodOrder.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 pt-1">
                    <span>Payment Mode:</span>
                    <span className="font-bold text-slate-700">
                      {printingFoodOrder.paymentMethod} ({printingFoodOrder.paymentStatus})
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Food Bill (Thermal / A4)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintingFoodOrder(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
