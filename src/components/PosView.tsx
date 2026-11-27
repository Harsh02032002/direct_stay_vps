import React, { useState, useEffect } from 'react';
import {
  HybridSplitPaymentBox,
  HybridSplitRow,
  createInitialHybridRows,
  getValidHybridSplits,
  formatHybridLabel,
} from './HybridSplitPaymentBox';
import {
  PosItem,
  PosOrder,
  PosOrderItem,
  Room,
  Booking,
  GuestCheckIn,
  ExtraCharge,
  InventoryProduct,
  InventoryStockMovement,
  Staff,
  AuditLog,
  PosTable,
  PosCategory,
  PosCoupon,
  HotelSettings,
  FoodAdvanceBooking
} from '../types';
import { r2 } from '../utils/billCalculator';
import { useHotelTaxSettings } from '../pms-integrated/utils/taxSettings';
import { getTodayIst, getYesterdayIst, addDaysIst, formatDdmmyyyy } from '../utils/reportingDates';
import {
  DEFAULT_POS_TABLES,
  DEFAULT_POS_CATEGORIES,
  DEFAULT_POS_COUPONS
} from './pos/posTypesAndData';
import PosDashboard from './pos/PosDashboard';
import PosTableManager from './pos/PosTableManager';
import PosKdsView from './pos/PosKdsView';
import PosSplitBillModal from './pos/PosSplitBillModal';
import PosReceiptModal from './pos/PosReceiptModal';
import PosMenuCustomizerModal from './pos/PosMenuCustomizerModal';
import PosCatalogManager from './pos/PosCatalogManager';
import PosReportsView from './pos/PosReportsView';
import DigitalMenuView, { FALLBACK_DIGITAL_MENU_ITEMS } from './DigitalMenuView';
import FoodAdvanceBookingPanel from './FoodAdvanceBookingPanel';
import { openPrintWindow } from '../utils/printDocument';
import { showToast, showConfirmToast } from '../utils/toast';

import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Trash2,
  Printer,
  CheckCircle,
  XCircle,
  CreditCard,
  DollarSign,
  Utensils,
  Calendar,
  Smartphone,
  Bed,
  Layers,
  Sparkles,
  TrendingUp,
  FileText,
  Clock,
  User,
  Edit,
  Tag,
  ChevronRight,
  Receipt,
  AlertTriangle,
  RotateCcw,
  ChefHat,
  Lock,
  Send,
  CheckSquare,
  FileCheck,
  ArrowRight,
  Pause,
  Play,
  Scissors,
  Users,
  Building,
  Phone,
  MapPin,
  QrCode,
  ExternalLink,
  Copy,
  Download
} from 'lucide-react';

export interface ExtendedCartItem {
  cartId: string;
  item: PosItem;
  quantity: number;
  selectedVariant?: string;
  selectedAddons?: string[];
  selectedModifiers?: string[];
  itemNotes?: string;
  unitPrice: number;
  totalPrice: number;
}

interface PosViewProps {
  items: PosItem[];
  onUpdateItems: (items: PosItem[]) => void;
  orders: PosOrder[];
  onUpdateOrders: (orders: PosOrder[]) => void;
  rooms: Room[];
  bookings?: Booking[];
  checkins: GuestCheckIn[];
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  inventoryProducts?: InventoryProduct[];
  onUpdateInventoryProducts?: (products: InventoryProduct[]) => void;
  inventoryStockMovements?: InventoryStockMovement[];
  onUpdateInventoryMovements?: (movements: InventoryStockMovement[]) => void;
  posAdvanceBookings?: FoodAdvanceBooking[];
  onUpdatePosAdvanceBookings?: (bookings: FoodAdvanceBooking[]) => void;
  categories?: PosCategory[];
  onUpdateCategories?: (categories: PosCategory[]) => void;
  selectedHotelId: string;
  hotelName?: string;
  hotelSettings?: HotelSettings;
  currentSubTab?: string;
  onSelectSubTab?: (subTab: string) => void;
  staff?: Staff[];
  auditLogs?: AuditLog[];
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function PosView({
  items,
  onUpdateItems,
  orders,
  onUpdateOrders,
  rooms,
  bookings = [],
  checkins,
  onUpdateCheckins,
  inventoryProducts = [],
  onUpdateInventoryProducts,
  inventoryStockMovements = [],
  onUpdateInventoryMovements,
  posAdvanceBookings = [],
  onUpdatePosAdvanceBookings,
  categories: propCategories,
  onUpdateCategories,
  selectedHotelId,
  hotelName,
  hotelSettings,
  currentSubTab,
  onSelectSubTab,
  staff = [],
  auditLogs = [],
  onAddAuditLog
}: PosViewProps) {
  // Navigation Sub-tab
  const [internalTab, setInternalTab] = useState<
    'dashboard' | 'terminal' | 'tables' | 'kds' | 'orders' | 'catalog' | 'reports' | 'qr_menu' | 'advance_booking'
  >((currentSubTab as any) || 'terminal');

  useEffect(() => {
    if (currentSubTab) {
      setInternalTab(currentSubTab as any);
    }
  }, [currentSubTab]);

  const activeTab = internalTab;
  const setActiveTab = (
    nextTab: 'dashboard' | 'terminal' | 'tables' | 'kds' | 'orders' | 'catalog' | 'reports' | 'qr_menu' | 'advance_booking'
  ) => {
    setInternalTab(nextTab);
    onSelectSubTab?.(nextTab);
  };

  // State for Tables, Categories, Coupons (no localStorage)
  const [tables, setTables] = useState<PosTable[]>(DEFAULT_POS_TABLES);

  const [internalCategories, setInternalCategories] = useState<PosCategory[]>(
    propCategories && propCategories.length > 0 ? propCategories : DEFAULT_POS_CATEGORIES
  );

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setInternalCategories(propCategories);
    }
  }, [propCategories]);

  const categories = propCategories && propCategories.length > 0 ? propCategories : internalCategories;

  const setCategories = (catsOrUpdater: PosCategory[] | ((prev: PosCategory[]) => PosCategory[])) => {
    const nextCats = typeof catsOrUpdater === 'function' ? catsOrUpdater(categories) : catsOrUpdater;
    setInternalCategories(nextCats);
    onUpdateCategories?.(nextCats);
  };

  const [coupons, setCoupons] = useState<PosCoupon[]>(DEFAULT_POS_COUPONS);

  // Terminal Cart & Order State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick Category & Sub-Category Modal state in Terminal
  const [showQuickCatModal, setShowQuickCatModal] = useState<boolean>(false);
  const [quickCatMode, setQuickCatMode] = useState<'new_category' | 'new_subcategory'>('new_category');
  const [quickCatName, setQuickCatName] = useState<string>('');
  const [quickCatSubInput, setQuickCatSubInput] = useState<string>('');
  const [quickTargetCatId, setQuickTargetCatId] = useState<string>('');
  const [cart, setCart] = useState<ExtendedCartItem[]>([]);

  const [orderType, setOrderType] = useState<
    'Dine In' | 'Room Service' | 'Takeaway' | 'Delivery' | 'Room Charge' | 'Walk In'
  >('Dine In');

  const [tableNo, setTableNo] = useState<string>('');
  const [assignedWaiter, setAssignedWaiter] = useState<string>('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Discount & Coupon State
  const [appliedCoupon, setAppliedCoupon] = useState<PosCoupon | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Credit' | 'Room Charge'>('Cash');

  // Active loaded order state (for edit/add before settlement)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Customization Modal State
  const [customizingItem, setCustomizingItem] = useState<PosItem | null>(null);

  // KOT Ticket Modal State
  const [viewingKotOrder, setViewingKotOrder] = useState<PosOrder | null>(null);

  // Split Bill Modal State
  const [splitOrderModal, setSplitOrderModal] = useState<PosOrder | null>(null);

  // Settlement Modal State
  const [settlingOrder, setSettlingOrder] = useState<PosOrder | null>(null);
  const [settlementDiscount, setSettlementDiscount] = useState<number>(0);
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Credit' | 'Room Charge' | 'Hybrid'>('Cash');
  const [settleHybridRows, setSettleHybridRows] = useState<HybridSplitRow[]>(() => createInitialHybridRows(0, ['Cash', 'UPI', 'Card']));

  // Receipt Modal State
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<PosOrder | null>(null);

  // Direct Edit Menu Item Modal State (Point 15)
  const [editingMenuItem, setEditingMenuItem] = useState<PosItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState<number>(0);
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemSubCategory, setEditItemSubCategory] = useState('');
  const [editItemTaxRate, setEditItemTaxRate] = useState<number>(5);
  const [editItemAvailable, setEditItemAvailable] = useState(true);

  // POS Order GST Include / Exclude Toggle (Point 10)
  const [applyGstOnOrder, setApplyGstOnOrder] = useState<boolean>(true);

  // Back-Dated Food Order Date & Time State
  const [orderDateInput, setOrderDateInput] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [orderTimeInput, setOrderTimeInput] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // Toast Notification Message
  const [posNoticeMessage, setPosNoticeMessage] = useState<string | null>(null);

  // Held Orders drawer toggle
  const [showHeldOrdersDrawer, setShowHeldOrdersDrawer] = useState<boolean>(false);

  // Date-Wise Filter state for POS Order Register (Row 5: Today / All / Yesterday / Date / Range) - Defaults to Today IST
  const getTodayLocalIso = () => getTodayIst();
  const getOffsetLocalIso = (days: number) => addDaysIst(getTodayIst(), days);
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderDateFilterType, setOrderDateFilterType] = useState<
    'All' | 'Today' | 'Yesterday' | 'Date' | 'This Month' | 'Range'
  >('Today');
  const [orderFilterSingleDate, setOrderFilterSingleDate] = useState<string>(getTodayLocalIso());
  const [orderFilterStartDate, setOrderFilterStartDate] = useState<string>(getOffsetLocalIso(-7));
  const [orderFilterEndDate, setOrderFilterEndDate] = useState<string>(getTodayLocalIso());

  // Ensure every hotel always has an editable POS menu out-of-the-box (Row 16: POS menu editable)
  const effectiveItems: PosItem[] = React.useMemo(
    () =>
      items.length > 0
        ? items
        : FALLBACK_DIGITAL_MENU_ITEMS.map(it => ({
            ...it,
            hotelId: selectedHotelId || 'hotel-1'
          })),
    [items, selectedHotelId]
  );

  const effectiveCategories: PosCategory[] = React.useMemo(() => {
    const merged: PosCategory[] = [...categories];
    const seen = new Set(merged.map(c => c.name.toLowerCase()));
    for (const it of effectiveItems) {
      const cat = String(it.category || '').trim();
      if (cat && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        merged.push({
          id: `cat-auto-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: cat,
          description: `${cat} menu items`
        });
      }
    }
    return merged;
  }, [categories, effectiveItems]);

  // Filter Active Checked-In & Walk-In / Booked Guests for Room Charge, Room Service & POS Linking
  const checkedInGuests: GuestCheckIn[] = React.useMemo(() => {
    const activeStays = checkins.filter(
      c =>
        Boolean(c.roomNumber) &&
        !c.checkedOutBy &&
        !c.checkedOutDateTime &&
        (c as any).status !== 'Checked Out' &&
        (c as any).status !== 'Completed'
    );
    const seenIds = new Set(activeStays.map(c => c.id));
    const seenRooms = new Set(activeStays.map(c => String(c.roomNumber).trim()));

    const fromBookings: GuestCheckIn[] = bookings
      .filter(b => {
        const rawSt = String(b.status || '').toLowerCase();
        if (b.status === 'Cancelled' || rawSt === 'cancelled') return false;
        if (!b.roomNumber) return false;
        if (seenIds.has(b.id) || seenRooms.has(String(b.roomNumber).trim())) return false;
        return true;
      })
      .map(b => {
        seenIds.add(b.id);
        seenRooms.add(String(b.roomNumber).trim());
        return {
          id: b.id,
          hotelId: b.hotelId,
          bookingId: b.id,
          guestName: b.guestName,
          mobile: b.mobile,
          phone: b.mobile,
          emailAddress: b.emailAddress || b.email,
          address: b.address || '',
          nationality: b.nationality || 'Indian',
          idType: b.aadhaarNumber ? 'Aadhaar' : 'ID',
          idNumber: b.aadhaarNumber || b.passportNumber || '',
          aadhaarNumber: b.aadhaarNumber || '',
          passportNumber: b.passportNumber || '',
          depositBalance: 0,
          payments: [],
          extraCharges: [],
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          numGuests: (b.adults || 1) + (b.children || 0),
          roomNumber: b.roomNumber,
          roomRate: Math.round((b.bookingAmount || 0) / Math.max(1, b.nights || 1)),
          totalAmount: b.bookingAmount || 0,
          advanceAmount: b.advanceAmount || 0,
          cashAmountPaid: 0,
          onlineAmountPaid: 0,
          pendingAmount: Math.max(0, (b.bookingAmount || 0) - (b.advanceAmount || 0)),
          dateTime: b.checkInDate || new Date().toISOString(),
          secondaryGuests: []
        } as unknown as GuestCheckIn;
      });

    const todayStr = new Date().toISOString().split('T')[0];
    const recentWalkIns = checkins.filter(c => {
      if (!c.roomNumber) return false;
      const rmKey = String(c.roomNumber).trim();
      if (seenIds.has(c.id) || seenRooms.has(rmKey)) return false;
      if (c.checkOutDate && c.checkOutDate >= todayStr) {
        seenIds.add(c.id);
        seenRooms.add(rmKey);
        return true;
      }
      return false;
    });

    return [...activeStays, ...fromBookings, ...recentWalkIns];
  }, [checkins, bookings]);

  // Held Orders List
  const heldOrders = orders.filter(o => o.isHeld || o.status === 'Held');

  // Categories list derived from categories state or items
  const allCategoryNames = [
    'All',
    ...Array.from(new Set([...effectiveCategories.map(c => c.name), ...effectiveItems.map(i => i.category)]))
  ];

  // Sub-Categories list derived from selected category or all items
  const availableSubCategories = React.useMemo(() => {
    if (selectedCategory === 'All') {
      const set = new Set<string>();
      effectiveCategories.forEach(c => (c.subcategories || []).forEach(s => set.add(s)));
      effectiveItems.forEach(i => {
        if (i.subCategory) set.add(i.subCategory);
      });
      return Array.from(set).filter(Boolean);
    }
    const matchedCat = effectiveCategories.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase());
    const set = new Set<string>(matchedCat?.subcategories || []);
    effectiveItems
      .filter(i => i.category.toLowerCase() === selectedCategory.toLowerCase() && i.subCategory)
      .forEach(i => set.add(i.subCategory!));
    return Array.from(set).filter(Boolean);
  }, [selectedCategory, effectiveCategories, effectiveItems]);

  // Filtered Items for Terminal (filtering by Category, Sub-Category, and Search)
  const filteredItems = effectiveItems.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSubCategory =
      selectedSubCategory === 'All' ||
      !selectedSubCategory ||
      (item.subCategory && item.subCategory.toLowerCase() === selectedSubCategory.toLowerCase());
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subCategory && item.subCategory.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSubCategory && matchesSearch;
  });

  // Food / Restaurant GST rate from centralized settings (0% stays 0%, never fallback to 5% on 0)
  const [hubTaxSettings] = useHotelTaxSettings();
  const foodGstRate =
    hotelSettings?.isGstEnabled === false
      ? 0
      : r2(
          Number(
            hotelSettings?.foodGstRate ??
              +(Number(hubTaxSettings.fnbCgst || 0) + Number(hubTaxSettings.fnbSgst || 0)).toFixed(2)
          )
        );

  // Cart Financial Calculations (Discount applied BEFORE GST — fixes G3)
  const cartSubtotal = r2(cart.reduce((acc, curr) => acc + curr.totalPrice, 0));

  const couponDiscountAmount = appliedCoupon
    ? appliedCoupon.discountType === 'Percentage'
      ? r2((cartSubtotal * appliedCoupon.discountValue) / 100)
      : r2(appliedCoupon.discountValue)
    : 0;

  const totalDiscountAmount = r2(
    Math.min(cartSubtotal, Math.max(0, couponDiscountAmount + manualDiscount))
  );
  const cartDiscountFactor =
    cartSubtotal > 0 ? Math.max(0, cartSubtotal - totalDiscountAmount) / cartSubtotal : 0;

  const cartTax = applyGstOnOrder
    ? r2(
        cart.reduce((acc, curr) => {
          const itemTaxRate = curr.item.taxRate ?? foodGstRate;
          const discountedLineBase = curr.totalPrice * cartDiscountFactor;
          return acc + (discountedLineBase * itemTaxRate) / 100;
        }, 0)
      )
    : 0;

  const cartGrandTotal = r2(Math.max(0, cartSubtotal - totalDiscountAmount) + cartTax);

  const computeSettledOrderTotals = (order: PosOrder, discountVal: number) => {
    const sub = r2(Number(order.subtotal || 0));
    const clampedDisc = r2(Math.min(sub, Math.max(0, Number(discountVal || 0))));
    const factor = sub > 0 ? Math.max(0, sub - clampedDisc) / sub : 0;
    const tax = order.isWithoutGst
      ? 0
      : Array.isArray(order.items) && order.items.length > 0
      ? r2(
          order.items.reduce((sum, oi) => {
            const rate = oi.taxRate ?? foodGstRate;
            const lineBase = Number(oi.total || 0) * factor;
            return sum + (lineBase * rate) / 100;
          }, 0)
        )
      : r2(Number(order.taxAmount || 0) * factor);
    const grandTotal = r2(Math.max(0, sub - clampedDisc) + tax);
    return { subtotal: sub, discount: clampedDisc, taxAmount: tax, grandTotal };
  };

  // Show Toast Notice
  const showNotice = (msg: string) => {
    showToast(msg, 'success');
    setPosNoticeMessage(msg);
    setTimeout(() => {
      setPosNoticeMessage(null);
    }, 4000);
  };

  // Validate available inventory stock before order save / settlement
  const validateInventoryStockForOrderItems = (orderItems: PosOrderItem[]): string | null => {
    if (!inventoryProducts || inventoryProducts.length === 0) return null;
    const requiredByProdId = new Map<string, { qty: number; itemName: string }>();
    for (const oi of orderItems) {
      const menuItem = effectiveItems.find(i => i.id === oi.itemId);
      if (menuItem && menuItem.inventoryProductId) {
        const prev = requiredByProdId.get(menuItem.inventoryProductId);
        requiredByProdId.set(menuItem.inventoryProductId, {
          qty: (prev?.qty || 0) + Number(oi.quantity || 0),
          itemName: oi.itemName || menuItem.name
        });
      }
    }
    for (const [prodId, reqInfo] of requiredByProdId.entries()) {
      const prod = inventoryProducts.find(p => p.id === prodId);
      if (prod && prod.currentStock < reqInfo.qty) {
        return `Insufficient stock for "${prod.name}" (Menu: ${reqInfo.itemName}). Available: ${prod.currentStock} ${prod.unit || 'units'}, Required: ${reqInfo.qty}.`;
      }
    }
    return null;
  };

  // Deduct inventory stock, recalculate status & lastUpdated, and append OUT StockMovement entries
  const deductInventoryStockForOrder = (orderObj: PosOrder) => {
    if (orderObj.inventoryUpdated || !onUpdateInventoryProducts || inventoryProducts.length === 0) {
      return;
    }
    const updatedProds = [...inventoryProducts];
    const newMovements: InventoryStockMovement[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    let stockDeductedCount = 0;

    for (const orderItem of orderObj.items) {
      const menuItem = effectiveItems.find(i => i.id === orderItem.itemId);
      if (menuItem && menuItem.inventoryProductId) {
        const invIndex = updatedProds.findIndex(p => p.id === menuItem.inventoryProductId);
        if (invIndex !== -1) {
          const prod = updatedProds[invIndex];
          const deductQty = Math.max(0, Number(orderItem.quantity || 0));
          if (deductQty <= 0) continue;
          const nextStock = Math.max(0, prod.currentStock - deductQty);
          const nextStatus: InventoryProduct['status'] =
            nextStock <= 0
              ? 'Out of Stock'
              : nextStock <= (Number((prod as any).minStockLevel ?? (prod as any).reorderLevel) || 0)
              ? 'Low Stock'
              : 'In Stock';

          updatedProds[invIndex] = {
            ...prod,
            currentStock: nextStock,
            status: nextStatus,
            lastUpdated: todayStr
          };
          stockDeductedCount++;

          newMovements.push({
            id: `MOV-POS-${orderObj.id}-${prod.id}-${stockDeductedCount}`,
            hotelId: selectedHotelId,
            productId: prod.id,
            productName: prod.name,
            type: 'OUT',
            quantity: deductQty,
            date: orderObj.date || todayStr,
            reference: `POS Order #${orderObj.orderNumber}`,
            notes: `POS consumption (${orderObj.orderType}${orderObj.roomNumber ? `, Room ${orderObj.roomNumber}` : ''}) — ${orderItem.itemName}`,
            performedBy: 'POS Terminal'
          } as unknown as InventoryStockMovement);
        }
      }
    }

    if (stockDeductedCount > 0) {
      onUpdateInventoryProducts(updatedProds);
      if (onUpdateInventoryMovements && newMovements.length > 0) {
        onUpdateInventoryMovements([...newMovements, ...inventoryStockMovements]);
      }
    }
  };

  // Post or update POS Room Charge on the active guest folio (idempotent by EC-POS-<order.id>)
  const syncPosOrderToGuestFolio = (
    orderObj: PosOrder,
    activeStay: GuestCheckIn
  ): { folioChargeId: string } => {
    const folioChargeId = `EC-POS-${orderObj.id}`;
    if (!onUpdateCheckins) return { folioChargeId };

    const itemsSummary = orderObj.items
      .map(i => `${i.itemName} x${i.quantity}`)
      .join(', ');
    const newCharge: ExtraCharge = {
      id: folioChargeId,
      category: 'Food',
      sourceType: 'pos_order',
      sourceId: orderObj.id,
      amount: Number(orderObj.grandTotal || 0),
      description: `POS Room Charge #${orderObj.orderNumber} (${itemsSummary})${orderObj.isWithoutGst ? ' [GST Exempt]' : ''}`,
      dateTime: orderObj.date
        ? `${String(orderObj.date).slice(0, 10)}T${/^\d{2}:\d{2}/.test(String(orderObj.time || '')) ? String(orderObj.time).slice(0, 5) : '12:00'}:00`
        : new Date().toISOString(),
      ...(orderObj.isWithoutGst ? { isWithoutGst: true, gstExempt: true, taxAmount: 0 } : { isWithoutGst: false, gstExempt: false, taxAmount: Number(orderObj.taxAmount || 0) })
    } as ExtraCharge;

    const existsInCheckins = checkins.some(c => c.id === activeStay.id);
    const updatedCheckins = existsInCheckins
      ? checkins.map(c => {
          if (c.id !== activeStay.id) return c;
          const existingCharges = Array.isArray(c.extraCharges) ? c.extraCharges : [];
          const prevCharge = existingCharges.find(
            ec =>
              ec.id === folioChargeId ||
              (ec.sourceType === 'pos_order' && ec.sourceId === orderObj.id)
          );
          const nextCharges = prevCharge
            ? existingCharges.map(ec =>
                ec.id === prevCharge.id ? newCharge : ec
              )
            : [...existingCharges, newCharge];
          const deltaAmount = newCharge.amount - (prevCharge ? Number(prevCharge.amount || 0) : 0);
          return {
            ...c,
            extraCharges: nextCharges,
            pendingAmount: Math.max(0, Number(c.pendingAmount || 0) + deltaAmount)
          };
        })
      : [
          ...checkins,
          {
            ...activeStay,
            extraCharges: [newCharge],
            pendingAmount: Math.max(0, Number(activeStay.pendingAmount || 0) + newCharge.amount)
          }
        ];

    onUpdateCheckins(updatedCheckins);
    return { folioChargeId };
  };

  // Remove POS Room Charge from linked guest folio if order is cancelled or voided
  const removePosOrderFromGuestFolio = (orderObj: PosOrder) => {
    if (!onUpdateCheckins || !checkins || checkins.length === 0) return;
    const folioChargeId = orderObj.folioChargeId || `EC-POS-${orderObj.id}`;
    let modified = false;
    const updatedCheckins = checkins.map(c => {
      const existingCharges = Array.isArray(c.extraCharges) ? c.extraCharges : [];
      const matchCharge = existingCharges.find(
        ec =>
          ec.id === folioChargeId ||
          (ec.sourceType === 'pos_order' && ec.sourceId === orderObj.id) ||
          ec.id === `EC-POS-${orderObj.id}`
      );
      if (!matchCharge) return c;
      modified = true;
      const nextCharges = existingCharges.filter(ec => ec !== matchCharge);
      const chargeAmt = Number(matchCharge.amount || 0);
      return {
        ...c,
        extraCharges: nextCharges,
        pendingAmount: Math.max(0, Number(c.pendingAmount || 0) - chargeAmt)
      };
    });
    if (modified) {
      onUpdateCheckins(updatedCheckins);
    }
  };

  // Click Menu Item Handlers
  const handleItemClick = (item: PosItem) => {
    if (!item.available) return;
    if (
      (item.variants && item.variants.length > 0) ||
      (item.addons && item.addons.length > 0) ||
      (item.modifiers && item.modifiers.length > 0)
    ) {
      setCustomizingItem(item);
    } else {
      // Direct Add to Cart
      const cartEntry: ExtendedCartItem = {
        cartId: `cart-${Date.now()}-${Math.random()}`,
        item,
        quantity: 1,
        unitPrice: item.price,
        totalPrice: item.price
      };
      setCart(prev => [...prev, cartEntry]);
    }
  };

  const handleCustomizedAddToCart = (configuredItem: {
    item: PosItem;
    quantity: number;
    selectedVariant?: string;
    selectedAddons?: string[];
    selectedModifiers?: string[];
    itemNotes?: string;
    finalUnitPrice: number;
  }) => {
    const cartEntry: ExtendedCartItem = {
      cartId: `cart-${Date.now()}-${Math.random()}`,
      item: configuredItem.item,
      quantity: configuredItem.quantity,
      selectedVariant: configuredItem.selectedVariant,
      selectedAddons: configuredItem.selectedAddons,
      selectedModifiers: configuredItem.selectedModifiers,
      itemNotes: configuredItem.itemNotes,
      unitPrice: configuredItem.finalUnitPrice,
      totalPrice: configuredItem.finalUnitPrice * configuredItem.quantity
    };
    setCart(prev => [...prev, cartEntry]);
  };

  const handleUpdateCartItemQuantity = (cartId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(c => {
          if (c.cartId === cartId) {
            const newQty = c.quantity + delta;
            if (newQty > 0) {
              return { ...c, quantity: newQty, totalPrice: c.unitPrice * newQty };
            }
            return null;
          }
          return c;
        })
        .filter(Boolean) as ExtendedCartItem[]
    );
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCart(prev => prev.filter(c => c.cartId !== cartId));
  };

  // Editable Unit Price in Cart (Points 9 & 14 — e.g. change Dal from ₹100 to ₹200 directly)
  const handleUpdateCartItemPrice = (cartId: string, newUnitPrice: number) => {
    setCart(prev =>
      prev.map(c => {
        if (c.cartId === cartId) {
          const unitPrice = Math.max(0, r2(newUnitPrice));
          return {
            ...c,
            unitPrice,
            totalPrice: r2(unitPrice * c.quantity)
          };
        }
        return c;
      })
    );
  };

  // Direct Edit Menu Item Modal Handlers (Point 15)
  const handleOpenEditMenuItem = (item: PosItem) => {
    setEditingMenuItem(item);
    setEditItemName(item.name);
    setEditItemPrice(item.price);
    setEditItemCategory(item.category || '');
    setEditItemSubCategory(item.subCategory || '');
    setEditItemTaxRate(item.taxRate ?? foodGstRate);
    setEditItemAvailable(item.available !== false);
  };

  const handleSaveEditedMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenuItem) return;
    const priceNum = Math.max(0, r2(editItemPrice));
    const taxNum = Math.max(0, r2(editItemTaxRate));
    const chosenCat = editItemCategory.trim() || editingMenuItem.category;
    const chosenSub = editItemSubCategory.trim() || undefined;

    // Register subcategory in categories list if not present
    if (chosenSub) {
      setCategories(
        categories.map(c => {
          if (c.name.toLowerCase() === chosenCat.toLowerCase()) {
            const subs = c.subcategories || [];
            if (!subs.some(s => s.toLowerCase() === chosenSub.toLowerCase())) {
              return { ...c, subcategories: [...subs, chosenSub] };
            }
          }
          return c;
        })
      );
    }

    const updated = effectiveItems.map(it =>
      it.id === editingMenuItem.id
        ? {
            ...it,
            name: editItemName.trim() || it.name,
            price: priceNum,
            category: chosenCat,
            subCategory: chosenSub,
            taxRate: taxNum,
            available: editItemAvailable,
          }
        : it
    );
    onUpdateItems(updated);
    if (onAddAuditLog) {
      onAddAuditLog(
        'POS Menu Item Updated',
        `Updated item "${editItemName}" (Code: ${editingMenuItem.code}) price from ₹${editingMenuItem.price} to ₹${priceNum}.`
      );
    }
    showNotice(`Menu item "${editItemName}" updated to ₹${priceNum}!`);
    setEditingMenuItem(null);
  };

  const handleSaveQuickCategoryOrSub = () => {
    if (quickCatMode === 'new_category') {
      const name = quickCatName.trim();
      if (!name) {
        showToast('Please enter a category name.', 'warning');
        return;
      }
      const subs = quickCatSubInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        const mergedSubs = Array.from(new Set([...(existing.subcategories || []), ...subs]));
        setCategories(
          categories.map(c => (c.id === existing.id ? { ...c, subcategories: mergedSubs } : c))
        );
      } else {
        const newCat: PosCategory = {
          id: `cat-${Date.now()}`,
          name,
          description: `${name} items`,
          subcategories: subs
        };
        setCategories([...categories, newCat]);
      }
      setSelectedCategory(name);
      setSelectedSubCategory('All');
      showToast(`Food category "${name}" saved!`, 'success');
      setShowQuickCatModal(false);
      setQuickCatName('');
      setQuickCatSubInput('');
    } else {
      const targetCat = categories.find(c => c.id === quickTargetCatId) || categories[0];
      const sub = quickCatSubInput.trim();
      if (!targetCat) {
        showToast('Please select or create a category first.', 'warning');
        return;
      }
      if (!sub) {
        showToast('Please enter sub-category name.', 'warning');
        return;
      }
      const existingSubs = targetCat.subcategories || [];
      if (!existingSubs.some(s => s.toLowerCase() === sub.toLowerCase())) {
        setCategories(
          categories.map(c =>
            c.id === targetCat.id ? { ...c, subcategories: [...existingSubs, sub] } : c
          )
        );
      }
      setSelectedCategory(targetCat.name);
      setSelectedSubCategory(sub);
      showToast(`Sub-category "${sub}" added under "${targetCat.name}"!`, 'success');
      setShowQuickCatModal(false);
      setQuickCatSubInput('');
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setManualDiscount(0);
    setActiveOrderId(null);
    setSelectedRoomNumber('');
    setGuestName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setOrderNotes('');
    setOrderDateInput(new Date().toISOString().split('T')[0]);
    const d = new Date();
    setOrderTimeInput(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  // Sync Room Guest Name & Mobile when Room selected
  const handleRoomSelect = (roomNum: string) => {
    setSelectedRoomNumber(roomNum);
    const guest = checkedInGuests.find(c => c.roomNumber === roomNum);
    if (guest) {
      setGuestName(guest.guestName);
      if (guest.mobile) setCustomerPhone(guest.mobile);
    }
  };

  // Coupon Application
  const handleApplyCoupon = () => {
    if (!couponCodeInput) return;
    const found = coupons.find(c => c.code.toUpperCase() === couponCodeInput.trim().toUpperCase() && c.active);
    if (!found) {
      showToast('Invalid or inactive coupon code!', 'error');
      return;
    }
    if (cartSubtotal < found.minOrderValue) {
      showToast(`Minimum order value for code ${found.code} is ₹${found.minOrderValue}`, 'warning');
      return;
    }
    setAppliedCoupon(found);
    showNotice(`Coupon ${found.code} applied successfully!`);
  };

  // -------------------------------------------------------------
  // POS WORKFLOW IMPLEMENTATION:
  // Create Order -> Save Order -> Send KOT -> Kitchen Status -> Settlement -> Generate Invoice -> Payment -> Close Order
  // -------------------------------------------------------------

  // STEP 1 & 2: Save Order (returns saved order so Send KOT works in a single click!)
  const handleSaveOrder = (): PosOrder | null => {
    if (cart.length === 0) {
      showToast('Cart is empty. Please add menu items first.', 'warning');
      return null;
    }

    const isRoomBilled = orderType === 'Room Charge' || paymentMethod === 'Room Charge';
    if ((isRoomBilled || orderType === 'Room Service') && !selectedRoomNumber) {
      showToast('Please select a Room Number for Room Charge/Room Service!', 'warning');
      return null;
    }

    const activeStayForRoom = selectedRoomNumber
      ? checkedInGuests.find(c => String(c.roomNumber) === String(selectedRoomNumber))
      : undefined;

    if (isRoomBilled && !activeStayForRoom) {
      showToast(
        `Cannot post Room Charge: Room ${selectedRoomNumber} does not have an active checked-in guest stay.`,
        'error'
      );
      return null;
    }

    const resolveCatalogPrice = (c: ExtendedCartItem): number => {
      if (c.selectedVariant && c.item.variants?.length) {
        const v = c.item.variants.find(vr => vr.name === c.selectedVariant);
        if (v) return Number(v.price) || Number(c.item.price) || 0;
      }
      return Number(c.item.price) || 0;
    };

    const orderItems: PosOrderItem[] = cart.map(c => ({
      itemId: c.item.id,
      itemName: c.item.name,
      itemCode: c.item.code,
      price: c.unitPrice,
      menuPrice: resolveCatalogPrice(c),
      taxRate: c.item.taxRate ?? foodGstRate,
      quantity: c.quantity,
      total: c.totalPrice,
      selectedVariant: c.selectedVariant,
      selectedAddons: c.selectedAddons,
      selectedModifiers: c.selectedModifiers,
      itemNotes: c.itemNotes
    }));

    // Validate inventory stock before saving
    const stockError = validateInventoryStockForOrderItems(orderItems);
    if (stockError) {
      showToast(stockError, 'error');
      return null;
    }

    const resolvedGuestName =
      activeStayForRoom?.guestName ||
      guestName.trim() ||
      (selectedRoomNumber ? `Room ${selectedRoomNumber} Guest` : 'Walk-in Guest');

    let savedOrderObj: PosOrder;

    if (activeOrderId) {
      // Update existing saved order (Allow edit before settlement)
      const existing = orders.find(o => o.id === activeOrderId);
      if (existing?.isSettled) {
        showToast('This order is already settled and locked!', 'warning');
        return null;
      }

      savedOrderObj = {
        ...existing!,
        orderType,
        tableNo: orderType === 'Dine In' ? tableNo : undefined,
        roomNumber: selectedRoomNumber || undefined,
        checkinId: activeStayForRoom?.id || existing?.checkinId,
        folioChargeId: isRoomBilled ? `EC-POS-${existing!.id}` : existing?.folioChargeId,
        guestName: resolvedGuestName,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: orderType === 'Delivery' ? deliveryAddress : undefined,
        waiterName: orderType === 'Dine In' ? assignedWaiter : undefined,
        items: orderItems,
        subtotal: cartSubtotal,
        isWithoutGst: !applyGstOnOrder,
        taxAmount: applyGstOnOrder ? cartTax : 0,
        discount: totalDiscountAmount,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscountAmount,
        grandTotal: cartGrandTotal,
        paymentMethod: isRoomBilled ? 'Room Charge' : paymentMethod,
        paymentStatus: (isRoomBilled ? 'Posted to Room' : existing?.paymentStatus || 'Unpaid') as any,
        isSaved: true,
        isHeld: false,
        status: existing?.kotSent ? existing.status : 'Saved',
        kitchenStatus: existing?.kitchenStatus || 'Pending',
        date: orderDateInput || existing?.date || new Date().toISOString().split('T')[0],
        time: orderTimeInput || existing?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes: orderNotes
      };

      if (isRoomBilled && activeStayForRoom) {
        syncPosOrderToGuestFolio(savedOrderObj, activeStayForRoom);
      }

      const updatedOrders = orders.map(o => (o.id === activeOrderId ? savedOrderObj : o));
      onUpdateOrders(updatedOrders);
      onAddAuditLog?.(
        'POS Order Updated',
        `Updated POS Order #${savedOrderObj.orderNumber} (${savedOrderObj.orderType}) for ${resolvedGuestName} — Total: ₹${savedOrderObj.grandTotal.toFixed(2)}.`
      );
      showNotice(`Order #${savedOrderObj.orderNumber} (${resolvedGuestName}) saved. Send KOT when ready!`);
    } else {
      // Create new order
      const newOrderId = `order-${Date.now()}`;
      const newOrderNum = `POS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      savedOrderObj = {
        id: newOrderId,
        orderNumber: newOrderNum,
        orderType,
        tableNo: orderType === 'Dine In' ? tableNo : undefined,
        roomNumber: selectedRoomNumber || undefined,
        checkinId: activeStayForRoom?.id,
        folioChargeId: isRoomBilled ? `EC-POS-${newOrderId}` : undefined,
        guestName: resolvedGuestName,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: orderType === 'Delivery' ? deliveryAddress : undefined,
        waiterName: orderType === 'Dine In' ? assignedWaiter : undefined,
        items: orderItems,
        subtotal: cartSubtotal,
        isWithoutGst: !applyGstOnOrder,
        taxAmount: applyGstOnOrder ? cartTax : 0,
        discount: totalDiscountAmount,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscountAmount,
        grandTotal: cartGrandTotal,
        paymentMethod: isRoomBilled ? 'Room Charge' : paymentMethod,
        paymentStatus: (isRoomBilled ? 'Posted to Room' : 'Unpaid') as any,
        status: 'Saved',
        date: orderDateInput || new Date().toISOString().split('T')[0],
        time: orderTimeInput || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hotelId: selectedHotelId,
        isSaved: true,
        kotSent: false,
        kitchenStatus: 'Pending',
        isSettled: false,
        inventoryUpdated: true,
        notes: orderNotes
      };

      // Deduct inventory stock & record OUT stock movement immediately on order creation
      deductInventoryStockForOrder({ ...savedOrderObj, inventoryUpdated: false });

      // If Room Charge, immediately post to active guest folio (idempotent EC-POS-<id>)
      if (isRoomBilled && activeStayForRoom) {
        syncPosOrderToGuestFolio(savedOrderObj, activeStayForRoom);
      }

      onUpdateOrders([savedOrderObj, ...orders]);
      setActiveOrderId(savedOrderObj.id);
      onAddAuditLog?.(
        'POS Order Created',
        `Created POS Order #${savedOrderObj.orderNumber} (${savedOrderObj.orderType}${savedOrderObj.roomNumber ? `, Room ${savedOrderObj.roomNumber}` : ''}) for ${resolvedGuestName} — Total: ₹${savedOrderObj.grandTotal.toFixed(2)}.`
      );

      // Update table status if Dine-In
      if (orderType === 'Dine In' && tableNo) {
        setTables(prev =>
          prev.map(t =>
            t.tableNumber === tableNo ? { ...t, status: 'Occupied', currentOrderId: savedOrderObj.id } : t
          )
        );
      }

      showNotice(
        isRoomBilled
          ? `Order #${savedOrderObj.orderNumber} saved & ₹${savedOrderObj.grandTotal.toFixed(2)} posted to Room ${selectedRoomNumber} Folio!`
          : `Order #${savedOrderObj.orderNumber} created & saved successfully!`
      );
    }
    return savedOrderObj;
  };

  const printKotTicket = (kot: PosOrder) => {
    const escHtml = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const isWithGst = !kot.isWithoutGst;
    const rowsHtml = kot.items
      .map(it => {
        const catPrice = it.menuPrice ?? items.find(m => m.id === it.itemId)?.price;
        const diffNote =
          catPrice !== undefined && Math.abs(Number(it.price) - Number(catPrice)) >= 0.5
            ? `<div style="font-size:10px;color:#555">Menu: Rs ${Number(catPrice).toFixed(2)}</div>`
            : '';
        return `<tr>
          <td style="padding:5px 4px;border-bottom:1px dashed #ccc">
            <div style="font-weight:700">${escHtml(it.itemName)}${it.selectedVariant ? ` (${escHtml(it.selectedVariant)})` : ''}</div>
            ${it.itemNotes ? `<div style="font-size:10px;color:#444">Note: ${escHtml(it.itemNotes)}</div>` : ''}
            ${diffNote}
          </td>
          <td style="padding:5px 4px;text-align:center;border-bottom:1px dashed #ccc;font-weight:700">${it.quantity}</td>
          <td style="padding:5px 4px;text-align:right;border-bottom:1px dashed #ccc">${Number(it.price).toFixed(2)}</td>
          <td style="padding:5px 4px;text-align:right;border-bottom:1px dashed #ccc;font-weight:700">${Number(it.total).toFixed(2)}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>KOT ${escHtml(kot.orderNumber)}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: 'Courier New', monospace; color: #111; margin: 0; padding: 8px; max-width: 320px; margin-inline: auto; font-size: 12px; }
        .center { text-align: center; }
        .hr { border-top: 1px dashed #111; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      </style></head><body>
      <div class="center">
        <div style="font-size:15px;font-weight:800">${escHtml(hotelName || hotelSettings?.name || 'HOTEL RESTAURANT')}</div>
        <div style="font-size:13px;font-weight:800;margin-top:2px">KITCHEN ORDER TICKET (KOT)</div>
        <div>Ticket #: <strong>${escHtml(kot.orderNumber)}</strong></div>
        <div>Date: ${escHtml(kot.date)} &nbsp; Time: ${escHtml(kot.kotSentAt || kot.time)}</div>
      </div>
      <div class="hr"></div>
      <div><strong>Guest:</strong> ${escHtml(kot.guestName || 'Walk-in Guest')}</div>
      <div><strong>Type:</strong> ${escHtml(kot.orderType)}${kot.roomNumber ? ` | <strong>Room: ${escHtml(kot.roomNumber)}</strong>` : ''}${kot.tableNo ? ` | <strong>Table: ${escHtml(kot.tableNo)}</strong>` : ''}</div>
      ${kot.waiterName ? `<div><strong>Steward/Waiter:</strong> ${escHtml(kot.waiterName)}</div>` : ''}
      <div class="hr"></div>
      <table>
        <thead>
          <tr style="border-bottom:1px solid #111">
            <th style="text-align:left;padding:4px">Item</th>
            <th style="text-align:center;padding:4px">Qty</th>
            <th style="text-align:right;padding:4px">Rate</th>
            <th style="text-align:right;padding:4px">Amt</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="hr"></div>
      <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><strong>Rs ${Number(kot.subtotal || 0).toFixed(2)}</strong></div>
      ${Number(kot.discount || 0) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount:</span><strong>-Rs ${Number(kot.discount || 0).toFixed(2)}</strong></div>` : ''}
      <div style="display:flex;justify-content:space-between">
        <span>GST (${isWithGst ? `${foodGstRate}% Included` : 'Excluded / 0%'}):</span>
        <strong>Rs ${isWithGst ? Number(kot.taxAmount || 0).toFixed(2) : '0.00'}</strong>
      </div>
      <div class="hr"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800">
        <span>KOT TOTAL:</span>
        <span>Rs ${Number(kot.grandTotal || 0).toFixed(2)}</span>
      </div>
      <div class="hr"></div>
      <div class="center" style="font-size:10.5px;margin-top:6px">Prepared via DirectStay POS • ${isWithGst ? 'Taxable KOT' : 'Non-GST KOT'}</div>
      </body></html>`;
    openPrintWindow(html, true);
  };

  // Sync updated KOT back to orders + linked guest Room Folio (if Room Charge)
  const commitUpdatedKotOrder = (updatedKot: PosOrder, baseList?: PosOrder[]) => {
    setViewingKotOrder(updatedKot);
    const sourceOrders = baseList || orders;
    const exists = sourceOrders.some(o => o.id === updatedKot.id);
    const nextOrders = exists
      ? sourceOrders.map(o => (o.id === updatedKot.id ? updatedKot : o))
      : [updatedKot, ...sourceOrders];
    onUpdateOrders(nextOrders);
    if (updatedKot.orderType === 'Room Charge' || updatedKot.paymentMethod === 'Room Charge') {
      const stay =
        (updatedKot.checkinId && checkins.find(c => c.id === updatedKot.checkinId && !c.checkedOutDateTime)) ||
        (updatedKot.roomNumber && checkedInGuests.find(c => String(c.roomNumber) === String(updatedKot.roomNumber)));
      if (stay) {
        syncPosOrderToGuestFolio(updatedKot, stay);
      }
    }
  };

  // STEP 3: Send KOT (auto-saves if needed and opens KOT Price & GST Print Modal in 1 click!)
  const handleSendKot = () => {
    let orderToSendKot: PosOrder | undefined = activeOrderId
      ? orders.find(o => o.id === activeOrderId)
      : undefined;

    let latestOrdersList = orders;
    if (!orderToSendKot || !orderToSendKot.isSaved || cart.length > 0) {
      const freshlySaved = handleSaveOrder();
      if (!freshlySaved) return;
      orderToSendKot = freshlySaved;
      const alreadyIn = orders.some(o => o.id === freshlySaved.id);
      latestOrdersList = alreadyIn
        ? orders.map(o => (o.id === freshlySaved.id ? freshlySaved : o))
        : [freshlySaved, ...orders];
    }

    const updatedOrder: PosOrder = {
      ...orderToSendKot,
      kotSent: true,
      kotSentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'KOT Sent',
      kitchenStatus: orderToSendKot.kitchenStatus || 'Pending'
    };

    commitUpdatedKotOrder(updatedOrder, latestOrdersList);
    onAddAuditLog?.(
      'POS KOT Sent',
      `Sent Kitchen Order Ticket (KOT) for Order #${updatedOrder.orderNumber} (${updatedOrder.items.length} item(s), ${updatedOrder.isWithoutGst ? 'GST Excluded' : 'GST Included'}).`
    );

    showNotice(`KOT Ticket #${updatedOrder.orderNumber} ready — review/edit item prices or GST & Print KOT!`);
  };

  // STEP: Hold Order
  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const holdNoteInput = prompt('Enter hold note (e.g., Guest stepped out):') || 'Order Held';

    const newOrderNum = `POS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const heldOrderObj: PosOrder = {
      id: `order-held-${Date.now()}`,
      orderNumber: newOrderNum,
      orderType,
      tableNo: orderType === 'Dine In' ? tableNo : undefined,
      items: cart.map(c => ({
        itemId: c.item.id,
        itemName: c.item.name,
        itemCode: c.item.code,
        price: c.unitPrice,
        taxRate: c.item.taxRate ?? foodGstRate,
        quantity: c.quantity,
        total: c.totalPrice,
        selectedVariant: c.selectedVariant,
        selectedAddons: c.selectedAddons,
        selectedModifiers: c.selectedModifiers,
        itemNotes: c.itemNotes
      })),
      subtotal: cartSubtotal,
      taxAmount: cartTax,
      discount: totalDiscountAmount,
      grandTotal: cartGrandTotal,
      paymentMethod,
      paymentStatus: 'Unpaid',
      status: 'Held',
      date: orderDateInput || new Date().toISOString().split('T')[0],
      time: orderTimeInput || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hotelId: selectedHotelId,
      isHeld: true,
      heldAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      holdNote: holdNoteInput
    };

    onUpdateOrders([heldOrderObj, ...orders]);
    onAddAuditLog?.(
      'POS Order Held',
      `Placed POS Order #${heldOrderObj.orderNumber} (₹${heldOrderObj.grandTotal.toFixed(2)}) on hold — Note: "${holdNoteInput}".`
    );
    handleClearCart();
    showNotice(`Order #${heldOrderObj.orderNumber} placed on Hold.`);
  };

  // STEP: Resume Held Order
  const handleResumeHeldOrder = (heldOrder: PosOrder) => {
    setActiveOrderId(heldOrder.id);
    setOrderType(heldOrder.orderType);
    if (heldOrder.tableNo) setTableNo(heldOrder.tableNo);
    if (heldOrder.date) setOrderDateInput(String(heldOrder.date).slice(0, 10));
    if (heldOrder.time && /^\d{2}:\d{2}/.test(String(heldOrder.time))) setOrderTimeInput(String(heldOrder.time).slice(0, 5));

    // Reconstruct cart
    const reconstructedCart: ExtendedCartItem[] = heldOrder.items.map((it, idx) => {
      const origItem = items.find(i => i.id === it.itemId) || {
        id: it.itemId,
        name: it.itemName,
        code: it.itemCode,
        category: 'Food',
        price: it.price,
        taxRate: it.taxRate,
        available: true
      };

      return {
        cartId: `cart-res-${idx}-${Date.now()}`,
        item: origItem,
        quantity: it.quantity,
        selectedVariant: it.selectedVariant,
        selectedAddons: it.selectedAddons,
        selectedModifiers: it.selectedModifiers,
        itemNotes: it.itemNotes,
        unitPrice: it.price,
        totalPrice: it.total
      };
    });

    setCart(reconstructedCart);

    // Un-hold order
    const updated = orders.map(o => (o.id === heldOrder.id ? { ...o, isHeld: false, status: 'Saved' as const } : o));
    onUpdateOrders(updated);
    onAddAuditLog?.(
      'POS Order Resumed',
      `Resumed held POS Order #${heldOrder.orderNumber} (₹${heldOrder.grandTotal.toFixed(2)}).`
    );
    setShowHeldOrdersDrawer(false);
    showNotice(`Resumed held order #${heldOrder.orderNumber}`);
  };

  // STEP 4 & 5: Settlement & Invoice Generation
  const handleOpenSettlementModal = (orderToSettle?: PosOrder) => {
    let target = orderToSettle;

    if (!target && activeOrderId) {
      target = orders.find(o => o.id === activeOrderId);
    }

    if (!target) {
      if (cart.length === 0) {
        showToast('Please add items to cart and save order before settlement.', 'warning');
        return;
      }
      handleSaveOrder();
      const newlySaved = orders.find(o => o.id === activeOrderId);
      if (newlySaved) target = newlySaved;
    }

    if (!target) return;

    if (target.isSettled) {
      showToast('This order is already settled and locked!', 'warning');
      return;
    }

    setSettlingOrder(target);
    setSettlementDiscount(target.discount);
    setSettlementPaymentMethod(target.paymentMethod);
  };

  const handleConfirmSettlement = () => {
    if (!settlingOrder) return;

    // If inventory was not yet deducted on save, validate stock before settling
    if (!settlingOrder.inventoryUpdated) {
      const stockError = validateInventoryStockForOrderItems(settlingOrder.items);
      if (stockError) {
        showToast(stockError, 'error');
        return;
      }
    }

    const isRoomChargeSettlement =
      settlementPaymentMethod === 'Room Charge' || settlingOrder.orderType === 'Room Charge';
    const roomNumForFolio = settlingOrder.roomNumber || selectedRoomNumber;
    const activeStay = roomNumForFolio
      ? checkedInGuests.find(c => String(c.roomNumber) === String(roomNumForFolio))
      : settlingOrder.checkinId
      ? checkins.find(c => c.id === settlingOrder.checkinId && !c.checkedOutBy)
      : undefined;

    if (isRoomChargeSettlement && !activeStay) {
      showToast(
        `Cannot settle via Room Charge: Room ${roomNumForFolio || 'N/A'} has no active checked-in guest stay.`,
        'error'
      );
      return;
    }

    const settledTotals = computeSettledOrderTotals(settlingOrder, settlementDiscount);

    const generatedInvNo = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const finalSettledOrder: PosOrder = {
      ...settlingOrder,
      roomNumber: roomNumForFolio || settlingOrder.roomNumber,
      checkinId: activeStay?.id || settlingOrder.checkinId,
      folioChargeId: isRoomChargeSettlement ? `EC-POS-${settlingOrder.id}` : settlingOrder.folioChargeId,
      discount: settledTotals.discount,
      taxAmount: settledTotals.taxAmount,
      grandTotal: settledTotals.grandTotal,
      paymentMethod:
        settlementPaymentMethod === 'Hybrid'
          ? (formatHybridLabel(settleHybridRows) as any)
          : settlementPaymentMethod,
      ...(settlementPaymentMethod === 'Hybrid' && getValidHybridSplits(settleHybridRows).length > 0
        ? { splitPayments: getValidHybridSplits(settleHybridRows) as any }
        : {}),
      paymentStatus: isRoomChargeSettlement ? 'Posted to Room' : 'Paid',
      status: 'Settled',
      isSettled: true,
      settledAt: new Date().toISOString(),
      invoiceGenerated: true,
      invoiceNumber: generatedInvNo,
      invoiceDate: settlingOrder.date || orderDateInput || new Date().toISOString().split('T')[0],
      isClosed: true,
      inventoryUpdated: true
    };

    // Deduct inventory stock & record OUT movement if not already deducted on save
    if (!settlingOrder.inventoryUpdated) {
      deductInventoryStockForOrder({ ...finalSettledOrder, inventoryUpdated: false });
    }

    // If settled via Room Charge, ensure guest folio extraCharge is up-to-date
    if (isRoomChargeSettlement && activeStay) {
      syncPosOrderToGuestFolio(finalSettledOrder, activeStay);
    }

    // Update Order list
    const updatedOrders = orders.map(o => (o.id === settlingOrder.id ? finalSettledOrder : o));
    onUpdateOrders(updatedOrders);

    // Free table if Dine In
    if (finalSettledOrder.tableNo) {
      setTables(prev =>
        prev.map(t =>
          t.tableNumber === finalSettledOrder.tableNo
            ? { ...t, status: 'Cleaning', currentOrderId: undefined }
            : t
        )
      );
    }

    // PMS Audit Log
    if (onAddAuditLog) {
      onAddAuditLog(
        'POS_ORDER_SETTLED',
        `Settled Order #${finalSettledOrder.orderNumber} via ${finalSettledOrder.paymentMethod} for ₹${finalSettledOrder.grandTotal.toFixed(2)}. Invoice #${generatedInvNo}`
      );
    }

    setSettlingOrder(null);
    setViewingReceiptOrder(finalSettledOrder);
    handleClearCart();
    showNotice(
      isRoomChargeSettlement
        ? `Order #${finalSettledOrder.orderNumber} posted to Room ${finalSettledOrder.roomNumber} Folio (₹${finalSettledOrder.grandTotal.toFixed(2)})!`
        : `Order #${finalSettledOrder.orderNumber} settled & Invoice #${generatedInvNo} generated!`
    );
  };

  // Handle Start Order for specific Table from Table Manager
  const handleStartOrderForTable = (tblNo: string, flr: string, waiter?: string) => {
    setActiveTab('terminal');
    setOrderType('Dine In');
    setTableNo(tblNo);
    if (waiter) setAssignedWaiter(waiter);

    // Check if table has an active unsettled order
    const existingActive = orders.find(
      o => o.tableNo === tblNo && !o.isSettled && o.status !== 'Cancelled'
    );

    if (existingActive) {
      setActiveOrderId(existingActive.id);
      if (existingActive.date) setOrderDateInput(String(existingActive.date).slice(0, 10));
      if (existingActive.time && /^\d{2}:\d{2}/.test(String(existingActive.time))) setOrderTimeInput(String(existingActive.time).slice(0, 5));
      // Reconstruct cart
      const reconstructedCart: ExtendedCartItem[] = existingActive.items.map((it, idx) => {
        const origItem = items.find(i => i.id === it.itemId) || {
          id: it.itemId,
          name: it.itemName,
          code: it.itemCode,
          category: 'Food',
          price: it.price,
          taxRate: it.taxRate,
          available: true
        };

        return {
          cartId: `cart-tbl-${idx}-${Date.now()}`,
          item: origItem,
          quantity: it.quantity,
          selectedVariant: it.selectedVariant,
          selectedAddons: it.selectedAddons,
          selectedModifiers: it.selectedModifiers,
          itemNotes: it.itemNotes,
          unitPrice: it.price,
          totalPrice: it.total
        };
      });
      setCart(reconstructedCart);
      showNotice(`Opened active order #${existingActive.orderNumber} for Table ${tblNo}`);
    } else {
      handleClearCart();
      setTableNo(tblNo);
      showNotice(`Started new order for Table ${tblNo}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notice Banner */}
      {posNoticeMessage && (
        <div className="bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-amber-200" />
            <span>{posNoticeMessage}</span>
          </div>
          <button onClick={() => setPosNoticeMessage(null)} className="text-amber-200 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Module Tabs Header */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between overflow-x-auto">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
              activeTab === 'terminal'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>POS Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
              activeTab === 'tables'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Table Map</span>
          </button>

          <button
            onClick={() => setActiveTab('kds')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all relative ${
              activeTab === 'kds'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Live KDS Screen</span>
            {orders.filter(o => o.kotSent && !o.isSettled).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
              activeTab === 'orders'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Order Register</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
              activeTab === 'catalog'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Menu & Coupons</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
              activeTab === 'reports'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>POS Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('qr_menu')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'qr_menu'
                ? 'bg-[#17120F] text-[#E5C158] border border-[#C49A3A] shadow-sm'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <QrCode className="w-4 h-4 text-[#C49A3A]" />
            <span>Digital Menu QR</span>
          </button>

          <button
            onClick={() => setActiveTab('advance_booking')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'advance_booking'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Advance Food Booking</span>
            {posAdvanceBookings && posAdvanceBookings.filter(b => b.status !== 'Cancelled').length > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] rounded-full font-bold ml-1">
                {posAdvanceBookings.filter(b => b.status !== 'Cancelled').length}
              </span>
            )}
          </button>
        </div>

        {/* Held Orders quick trigger */}
        {heldOrders.length > 0 && (
          <button
            onClick={() => setShowHeldOrdersDrawer(true)}
            className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-200 flex items-center space-x-1.5"
          >
            <Pause className="w-3.5 h-3.5 text-amber-700" />
            <span>Held Orders ({heldOrders.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: POS DASHBOARD */}
      {activeTab === 'dashboard' && (
        <PosDashboard
          orders={orders}
          tables={tables}
          items={items}
          heldOrdersCount={heldOrders.length}
          onNavigateTab={setActiveTab}
        />
      )}

      {/* TAB 2: TABLE MAP MANAGER */}
      {activeTab === 'tables' && (
        <PosTableManager
          tables={tables}
          onUpdateTables={setTables}
          orders={orders}
          staff={staff}
          onStartOrderForTable={handleStartOrderForTable}
        />
      )}

      {/* TAB 3: LIVE KDS SCREEN */}
      {activeTab === 'kds' && (
        <PosKdsView
          orders={orders}
          onUpdateOrders={onUpdateOrders}
          onPrintKot={order => setViewingKotOrder(order)}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {/* TAB 4: POS TERMINAL */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT 7 COLS: CATEGORY FIRST MENU CATALOG */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Category Selector Strip */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search dishes by name, code or sub-category (e.g. Paneer, Thali)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                {/* Quick Advance Food Booking Button */}
                <button
                  type="button"
                  onClick={() => setActiveTab('advance_booking')}
                  className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition"
                  title="Open Food Advance Booking"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Advance Booking</span>
                </button>

                {/* Quick Add Category / Sub-Category Button */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickCatMode('new_category');
                    setQuickCatName('');
                    setQuickCatSubInput('');
                    setShowQuickCatModal(true);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition"
                  title="Add Category or Sub-Category"
                >
                  <Plus className="w-4 h-4 text-amber-600" />
                  <span className="hidden sm:inline">+ Category / Sub</span>
                </button>
              </div>

              {/* Category Pills Strip */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                {allCategoryNames.map(catName => {
                  const isSelected = selectedCategory === catName;
                  return (
                    <button
                      key={catName}
                      onClick={() => {
                        setSelectedCategory(catName);
                        setSelectedSubCategory('All');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>

              {/* Sub-Category Pills Strip (Rendered when subcategories exist) */}
              {availableSubCategories.length > 0 && (
                <div className="flex items-center space-x-1.5 overflow-x-auto pt-1.5 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                    Sub-Category:
                  </span>
                  <button
                    onClick={() => setSelectedSubCategory('All')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                      selectedSubCategory === 'All'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    All {selectedCategory !== 'All' ? selectedCategory : ''}
                  </button>
                  {availableSubCategories.map(sub => {
                    const isSelected = selectedSubCategory.toLowerCase() === sub.toLowerCase();
                    return (
                      <button
                        key={sub}
                        onClick={() => setSelectedSubCategory(sub)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                          isSelected
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCatMode('new_subcategory');
                      setQuickTargetCatId(
                        effectiveCategories.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase())?.id ||
                        categories[0]?.id ||
                        ''
                      );
                      setQuickCatSubInput('');
                      setShowQuickCatModal(true);
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded-lg whitespace-nowrap cursor-pointer ml-1"
                  >
                    + Add Sub-category
                  </button>
                </div>
              )}
            </div>

            {/* Category Cards (When 'All' selected and search empty, show category-first entry cards) */}
            {selectedCategory === 'All' && !searchQuery && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {effectiveCategories.map(cat => {
                  const itemCount = effectiveItems.filter(i => i.category === cat.name).length;
                  if (itemCount === 0 && effectiveItems.length > 0 && !categories.some(c => c.id === cat.id)) return null;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setSelectedSubCategory('All');
                      }}
                      className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm group-hover:bg-amber-600 group-hover:text-white transition-all">
                          <Utensils className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {itemCount} items
                        </span>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-amber-700">{cat.name}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{cat.description || 'Explore menu items'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Menu Items Grid */}
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-slate-700 px-1">
                <span>
                  Showing {filteredItems.length} items {selectedCategory !== 'All' ? `in ${selectedCategory}` : ''}
                </span>
                <div className="flex items-center gap-3">
                  {selectedCategory !== 'All' && (
                    <button
                      onClick={() => setSelectedCategory('All')}
                      className="text-amber-700 hover:underline text-xs cursor-pointer"
                    >
                      View All Categories
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Edit className="w-3 h-3" /> Manage / Add Menu Items
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredItems.map(item => {
                  const hasCustomizations =
                    (item.variants && item.variants.length > 0) ||
                    (item.addons && item.addons.length > 0) ||
                    (item.modifiers && item.modifiers.length > 0);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`p-3.5 bg-white border rounded-2xl shadow-xs transition-all flex flex-col justify-between relative space-y-2 ${
                        item.available
                          ? 'border-slate-200 hover:border-amber-500 hover:shadow-md cursor-pointer'
                          : 'border-slate-100 bg-slate-50/60 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.code}
                          </span>
                          {!item.available && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              Sold Out
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-800 text-xs mt-1.5 line-clamp-2">{item.name}</h4>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-black text-slate-900 text-sm">₹{item.price}</span>
                          <span className="text-[10px] text-slate-500 block">GST {item.taxRate}%</span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            title="Edit Menu Item details & price (Point 15)"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditMenuItem(item);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-300 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={!item.available}
                            className={`p-1.5 rounded-xl font-bold transition-all ${
                              item.available
                                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                                : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {hasCustomizations && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[9px] font-black rounded uppercase">
                          Options
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLS: TICKET CART & POS WORKFLOW CONTROLLER */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Order Header & Type Selector */}
              <div className="space-y-3 pb-3 border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">Current POS Ticket</h3>
                    <p className="text-[11px] text-slate-500">
                      {activeOrderId ? `Editing Active Order #${orders.find(o => o.id === activeOrderId)?.orderNumber}` : 'New Order'}
                    </p>
                  </div>

                  {activeOrderId && (
                    <button
                      onClick={handleClearCart}
                      className="text-xs text-rose-600 font-bold hover:underline flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>New Ticket</span>
                    </button>
                  )}
                </div>

                {/* Order Type Selector */}
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  {(['Dine In', 'Room Service', 'Takeaway', 'Delivery', 'Room Charge', 'Walk In'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`py-1.5 rounded-lg text-[11px] transition-all ${
                        orderType === type
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Guest / Customer Details (Visible across ALL Order Types) */}
                <div className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">
                      Guest / Customer Identification
                    </span>
                    {selectedRoomNumber && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold">
                        Room {selectedRoomNumber} Linked
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-0.5">
                      {orderType === 'Room Charge' || orderType === 'Room Service'
                        ? 'Select Checked-In Guest Room *:'
                        : 'Link Checked-In Room Guest (Optional):'}
                    </label>
                    <select
                      value={selectedRoomNumber}
                      onChange={e => handleRoomSelect(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">
                        {checkedInGuests.length > 0
                          ? '-- Outside / Walk-in Customer (Or Select Checked-in Room) --'
                          : '-- No Active Checked-in Rooms (Enter Customer Name Below) --'}
                      </option>
                      {checkedInGuests.map(g => (
                        <option key={g.id} value={g.roomNumber}>
                          Room {g.roomNumber} — {g.guestName} ({g.mobile || 'No Phone'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-0.5">Guest / Customer Name:</label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-0.5">Mobile Number:</label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Back-Dated Food Bill Date & Time Section */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" /> Bill / Order Date & Time (Back-Date Allowed)
                    </span>
                    {orderDateInput !== new Date().toISOString().split('T')[0] && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[9px] font-bold border border-amber-300">
                        Back-Dated Entry
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Order Date:</label>
                      <input
                        type="date"
                        value={orderDateInput}
                        onChange={e => setOrderDateInput(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Order Time:</label>
                      <input
                        type="time"
                        value={orderTimeInput}
                        onChange={e => setOrderTimeInput(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Dynamic Inputs based on Order Type */}
                {orderType === 'Dine In' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-0.5">Select Table:</label>
                      <select
                        value={tableNo}
                        onChange={e => setTableNo(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {tables.map(t => (
                          <option key={t.id} value={t.tableNumber}>
                            {t.tableNumber} ({t.floor} - {t.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 block mb-0.5">Assigned Waiter:</label>
                      <select
                        value={assignedWaiter}
                        onChange={e => setAssignedWaiter(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {staff.filter(s => s.role === 'Waiter' || s.role === 'Staff' || s.role === 'Manager').length > 0
                          ? staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)
                          : [
                              <option key="w1" value="Ramesh Kumar">Ramesh Kumar</option>,
                              <option key="w2" value="Priya Sharma">Priya Sharma</option>,
                              <option key="w3" value="Vikram Singh">Vikram Singh</option>
                            ]}
                      </select>
                    </div>
                  </div>
                )}

                {orderType === 'Delivery' && (
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      placeholder="Delivery Address"
                      value={deliveryAddress}
                      onChange={e => setDeliveryAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
                    <p>Ticket cart is empty.</p>
                    <p className="text-[11px] text-slate-600">Click items on the left to add to bill.</p>
                  </div>
                ) : (
                  cart.map(c => (
                    <div
                      key={c.cartId}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs space-x-2"
                    >
                      <div className="flex-1 space-y-0.5">
                        <div className="font-bold text-slate-800">{c.item.name}</div>
                        {c.selectedVariant && (
                          <div className="text-[10px] text-slate-500 font-semibold">Var: {c.selectedVariant}</div>
                        )}
                        {c.selectedAddons && c.selectedAddons.length > 0 && (
                          <div className="text-[10px] text-slate-500">Addons: {c.selectedAddons.join(', ')}</div>
                        )}
                        {c.selectedModifiers && c.selectedModifiers.length > 0 && (
                          <div className="text-[10px] text-rose-700 font-medium">Mods: {c.selectedModifiers.join(', ')}</div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Editable Unit Price in Cart before/at KOT printing (Point 2) */}
                        <div className="flex flex-col items-end">
                          <div className="flex items-center space-x-0.5 bg-white border border-amber-300 rounded-lg px-1.5 py-0.5 shadow-2xs" title="Editable KOT food price (does not overwrite fixed menu price)">
                            <span className="text-[10px] font-bold text-amber-700">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={c.unitPrice}
                              onChange={(e) => handleUpdateCartItemPrice(c.cartId, parseFloat(e.target.value) || 0)}
                              className="w-14 bg-transparent font-bold text-slate-900 text-xs text-right focus:outline-none"
                            />
                          </div>
                          {Math.abs(c.unitPrice - c.item.price) >= 0.5 && (
                            <span className="text-[9.5px] font-mono text-amber-700">
                              Menu: ₹{c.item.price}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 bg-white border border-slate-200 p-0.5 rounded-lg">
                          <button
                            onClick={() => handleUpdateCartItemQuantity(c.cartId, -1)}
                            className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 rounded"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-slate-900">{c.quantity}</span>
                          <button
                            onClick={() => handleUpdateCartItemQuantity(c.cartId, 1)}
                            className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 rounded"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-black text-slate-900 w-16 text-right">₹{c.totalPrice.toFixed(2)}</span>

                        <button
                          onClick={() => handleRemoveFromCart(c.cartId)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Coupon & Promo Code Section */}
              {cart.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Promo Coupon Code (e.g. WELCOME10)"
                      value={couponCodeInput}
                      onChange={e => setCouponCodeInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg uppercase text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800"
                    >
                      Apply
                    </button>
                  </div>

                  {appliedCoupon && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg flex justify-between items-center text-xs font-bold">
                      <span>Coupon {appliedCoupon.code} Applied</span>
                      <button onClick={() => setAppliedCoupon(null)} className="text-rose-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total Financial Summary & Workflow Action Controls */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Guest / Customer:</span>
                  <span className="font-bold text-slate-900">
                    {guestName.trim() || (selectedRoomNumber ? `Room ${selectedRoomNumber} Guest` : 'Walk-in Guest')}
                    {selectedRoomNumber ? ` (Room ${selectedRoomNumber})` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-800">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-700">Food GST Option:</span>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setApplyGstOnOrder(true)}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          applyGstOnOrder
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        5% GST (2.5% CGST + 2.5% SGST)
                      </button>
                      <button
                        type="button"
                        onClick={() => setApplyGstOnOrder(false)}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          !applyGstOnOrder
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Without GST (Exempt)
                      </button>
                    </div>
                  </div>
                  <span className="font-bold text-slate-800">
                    {applyGstOnOrder ? `₹${cartTax.toFixed(2)}` : '₹0.00'}
                  </span>
                </div>
                {applyGstOnOrder && cartTax > 0 && (
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium pl-1">
                    <span>CGST (2.5%): ₹{(cartTax / 2).toFixed(2)}</span>
                    <span>SGST (2.5%): ₹{(cartTax / 2).toFixed(2)}</span>
                  </div>
                )}
                {totalDiscountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Discount:</span>
                    <span>-₹{totalDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 text-base pt-1.5 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span>₹{cartGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* POS Workflow Step Buttons */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleSaveOrder}
                    disabled={cart.length === 0}
                    className="py-2.5 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>Save Order</span>
                  </button>

                  <button
                    onClick={handleSendKot}
                    disabled={cart.length === 0}
                    className="py-2.5 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1"
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    <span>Send KOT</span>
                  </button>

                  <button
                    onClick={handleHoldOrder}
                    disabled={cart.length === 0}
                    className="py-2.5 bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 border border-slate-200"
                  >
                    <Pause className="w-3.5 h-3.5 text-slate-600" />
                    <span>Hold</span>
                  </button>
                </div>

                <button
                  onClick={() => handleOpenSettlementModal()}
                  disabled={cart.length === 0}
                  className="w-full py-3 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-xs font-black shadow-md flex items-center justify-between px-4"
                >
                  <span className="flex items-center space-x-1.5">
                    <Receipt className="w-4 h-4" />
                    <span>Settle Bill & Generate Invoice</span>
                  </span>
                  <span>₹{cartGrandTotal.toFixed(2)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ORDER REGISTER */}
      {activeTab === 'orders' && (() => {
        const todayIso = getTodayLocalIso();
        const yesterdayIso = getOffsetLocalIso(-1);
        const monthPrefix = todayIso.slice(0, 7);
        const filteredOrders = orders.filter(ord => {
          const q = orderSearchQuery.trim().toLowerCase();
          if (q) {
            const matchText = `${ord.orderNumber || ''} ${ord.guestName || ''} ${ord.roomNumber || ''} ${ord.tableNo || ''} ${ord.customerPhone || ''}`.toLowerCase();
            if (!matchText.includes(q)) return false;
          }
          const ordDate = String(ord.date || '').slice(0, 10);
          if (orderDateFilterType === 'Today') return ordDate === todayIso;
          if (orderDateFilterType === 'Yesterday') return ordDate === yesterdayIso;
          if (orderDateFilterType === 'Date') return ordDate === orderFilterSingleDate;
          if (orderDateFilterType === 'This Month') return ordDate.startsWith(monthPrefix);
          if (orderDateFilterType === 'Range') {
            return (!orderFilterStartDate || ordDate >= orderFilterStartDate) && (!orderFilterEndDate || ordDate <= orderFilterEndDate);
          }
          return true;
        });

        return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-800">POS Order Register & History</h2>
              <p className="text-xs text-slate-500">
                View orders, guest details, track KOT status, split bills, settle payments, and print GST tax invoices.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
              Showing {filteredOrders.length} of {orders.length} Orders
            </span>
          </div>

          {/* Search + Date-Wise Filter Bar (Row 5: All / Today / Yesterday / Specific Date / This Month / Range) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 text-xs">
            <div className="relative max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search order #, guest name, room, table, phone..."
                value={orderSearchQuery}
                onChange={e => setOrderSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono font-bold text-slate-600 uppercase mr-1">Date-Wise Filter:</span>
              {([
                ['All', `All (${orders.length})`],
                ['Today', 'Today'],
                ['Yesterday', 'Yesterday'],
                ['Date', 'Specific Date'],
                ['This Month', 'This Month'],
                ['Range', 'From → To Range']
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOrderDateFilterType(key)}
                  className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                    orderDateFilterType === key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
              {orderDateFilterType === 'Date' && (
                <input
                  type="date"
                  value={orderFilterSingleDate}
                  onChange={e => setOrderFilterSingleDate(e.target.value)}
                  className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white font-mono text-xs font-bold"
                />
              )}
              {orderDateFilterType === 'Range' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="date"
                    value={orderFilterStartDate}
                    onChange={e => setOrderFilterStartDate(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white font-mono text-xs"
                  />
                  <span className="text-slate-500 font-bold">→</span>
                  <input
                    type="date"
                    value={orderFilterEndDate}
                    onChange={e => setOrderFilterEndDate(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-lg bg-white font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Guest / Customer</th>
                  <th className="py-3 px-4">Type / Location</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Grand Total</th>
                  <th className="py-3 px-4">KOT Status</th>
                  <th className="py-3 px-4">Settlement</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {order.orderNumber}
                      {order.invoiceNumber && (
                        <div className="text-[10px] text-emerald-700 font-semibold">{order.invoiceNumber}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {order.guestName || 'Walk-in Guest'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {order.roomNumber ? `Room ${order.roomNumber}` : ''}
                        {order.roomNumber && order.customerPhone ? ' • ' : ''}
                        {order.customerPhone ? order.customerPhone : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {order.orderType}
                      <span className="block text-[11px] text-slate-500 font-normal">
                        {order.tableNo
                          ? `Table: ${order.tableNo}`
                          : order.roomNumber
                          ? `Room ${order.roomNumber}`
                          : order.waiterName || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{order.time}</td>
                    <td className="py-3 px-4">{order.items.length} items</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{order.grandTotal.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.kotSent ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {order.kotSent ? `KOT (${order.kitchenStatus || 'Pending'})` : 'KOT Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          order.status === 'Cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : order.isSettled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.status === 'Cancelled'
                          ? 'Cancelled'
                          : order.isSettled
                          ? `Settled (${order.paymentMethod})`
                          : 'Unsettled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {!order.isSettled && order.status !== 'Cancelled' && (
                        <>
                          <button
                            onClick={() => setSplitOrderModal(order)}
                            className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-[11px] font-bold"
                          >
                            Split
                          </button>
                          <button
                            onClick={() => handleOpenSettlementModal(order)}
                            className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-[11px] font-bold shadow-xs"
                          >
                            Settle
                          </button>
                          <button
                            onClick={async () => {
                              const confirmed = await showConfirmToast({
                                message: `Cancel POS Order #${order.orderNumber}?`,
                                title: 'Cancel POS Order',
                                confirmLabel: 'Cancel Order',
                                severity: 'warning'
                              });
                              if (!confirmed) return;
                              removePosOrderFromGuestFolio(order);
                              const updated = orders.map(o =>
                                o.id === order.id ? { ...o, status: 'Cancelled' as const, isClosed: true } : o
                              );
                              onUpdateOrders(updated);
                              onAddAuditLog?.(
                                'POS Order Cancelled',
                                `Cancelled POS Order #${order.orderNumber} (${order.orderType}) for ${order.guestName || 'Walk-in Guest'} — Amount: ₹${order.grandTotal.toFixed(2)}.`
                              );
                              showNotice(`Order #${order.orderNumber} cancelled.`);
                            }}
                            className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-bold"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {order.isSettled && (
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => setViewingReceiptOrder(order)}
                            className="px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded text-[11px] font-bold flex items-center space-x-1 inline-flex"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Invoice</span>
                          </button>
                          <button
                            onClick={async () => {
                              const confirmed = await showConfirmToast({
                                message: `Void settled Food Bill #${order.orderNumber} (₹${order.grandTotal.toFixed(2)})? This will reverse any room folio charges.`,
                                title: 'Void Food Bill',
                                confirmLabel: 'Void Bill',
                                severity: 'warning'
                              });
                              if (!confirmed) return;
                              removePosOrderFromGuestFolio(order);
                              const updated = orders.map(o =>
                                o.id === order.id ? { ...o, status: 'Cancelled' as const, isClosed: true, isSettled: false } : o
                              );
                              onUpdateOrders(updated);
                              onAddAuditLog?.(
                                'POS Order Voided',
                                `Voided Settled POS Order #${order.orderNumber} (${order.orderType}) for ${order.guestName || 'Guest'} — Amount: ₹${order.grandTotal.toFixed(2)}.`
                              );
                              showNotice(`Food Bill #${order.orderNumber} voided successfully.`);
                            }}
                            className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-bold"
                            title="Void / Cancel this food bill"
                          >
                            Void
                          </button>
                        </div>
                      )}
                      {order.status === 'Cancelled' && (
                        <button
                          onClick={async () => {
                            const confirmed = await showConfirmToast({
                              message: `Permanently delete cancelled Food Bill #${order.orderNumber}?`,
                              title: 'Delete Order Record',
                              confirmLabel: 'Delete Permanently',
                              severity: 'warning'
                            });
                            if (!confirmed) return;
                            const updated = orders.filter(o => o.id !== order.id);
                            onUpdateOrders(updated);
                            showNotice(`Food Bill #${order.orderNumber} deleted.`);
                          }}
                          className="px-2 py-1 bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700 rounded text-[10px] font-semibold"
                          title="Permanently remove record"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* TAB 6: CATALOG & COUPON MANAGEMENT */}
      {activeTab === 'catalog' && (
        <PosCatalogManager
          items={effectiveItems}
          onUpdateItems={onUpdateItems}
          categories={effectiveCategories}
          onUpdateCategories={setCategories}
          coupons={coupons}
          onUpdateCoupons={setCoupons}
          inventoryProducts={inventoryProducts}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {/* TAB 7: POS REPORTS */}
      {activeTab === 'reports' && <PosReportsView orders={orders} />}

      {/* TAB 8: UNIVERSAL DIGITAL MENU QR CODE & LIVE ORDER PREVIEW */}
      {activeTab === 'qr_menu' && (() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const targetHotelId = selectedHotelId || 'hotel-1';
        const digitalMenuUrl = `${origin}/?digitalMenu=${encodeURIComponent(targetHotelId)}`;
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=340x340&margin=14&data=${encodeURIComponent(digitalMenuUrl)}`;

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT 5 COLS: PRINTABLE UNIVERSAL QR CODE STANDEE */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 no-print">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-600 font-bold block">
                      1 Single Universal QR For All Rooms
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      Hotel Digital Food Menu QR Code
                    </h3>
                  </div>
                  {items.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateItems(
                          FALLBACK_DIGITAL_MENU_ITEMS.map(it => ({
                            ...it,
                            hotelId: targetHotelId
                          }))
                        );
                        showToast('Sample Hotel Menu loaded into POS Catalog!', 'success');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs cursor-pointer transition"
                    >
                      + Load Sample Menu
                    </button>
                  )}
                </div>

                {/* PRINTABLE QR STANDEE CARD */}
                <div
                  id="printable-digital-menu-qr"
                  className="bg-gradient-to-b from-[#17120F] via-[#221A15] to-[#17120F] text-white rounded-3xl p-6 border-2 border-[#C49A3A] shadow-xl text-center space-y-4"
                >
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#C49A3A]/20 border border-[#C49A3A]/40 text-[#E5C158] text-[10px] font-mono uppercase tracking-widest font-bold">
                    <Utensils className="w-3 h-3" /> In-Room Dining & Digital Menu
                  </div>

                  <div>
                    <h2 className="text-xl font-serif font-bold text-white tracking-wide">
                      {hotelName || 'Hotel Room Service'}
                    </h2>
                    <p className="text-xs text-[#E5C158] mt-0.5 font-medium">
                      Scan QR Code to Browse Menu & Order Directly to Your Room
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl shadow-lg inline-block mx-auto border-4 border-[#C49A3A]">
                    <img
                      src={qrImgUrl}
                      alt="Hotel Digital Menu QR Code"
                      className="w-52 h-52 object-contain mx-auto"
                      crossOrigin="anonymous"
                    />
                  </div>

                  <div className="bg-black/35 rounded-2xl p-3.5 border border-white/10 text-left space-y-1.5 text-xs">
                    <div className="font-bold text-[#E5C158] text-[11px] uppercase tracking-wider text-center mb-1">
                      How To Order From Your Room:
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-[#C49A3A] text-[#17120F] font-extrabold text-[11px] flex items-center justify-center shrink-0">1</span>
                      <span>Scan this QR Code with your phone camera</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-[#C49A3A] text-[#17120F] font-extrabold text-[11px] flex items-center justify-center shrink-0">2</span>
                      <span>Search & select dishes from our Digital Menu</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-[#C49A3A] text-[#17120F] font-extrabold text-[11px] flex items-center justify-center shrink-0">3</span>
                      <span>Enter your <strong>Room No.</strong> & <strong>Mobile No.</strong> to Place Order</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 break-all px-2">
                    {digitalMenuUrl}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="grid grid-cols-2 gap-2.5 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-2.5 px-4 bg-[#17120F] hover:bg-black text-[#E5C158] rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition border border-[#C49A3A]/50 shadow-sm"
                  >
                    <Printer className="w-4 h-4" /> Print QR Standee
                  </button>

                  <a
                    href={qrImgUrl}
                    download={`Digital-Menu-QR-${targetHotelId}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Download className="w-4 h-4" /> Download QR PNG
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(digitalMenuUrl);
                      showToast('Digital Menu link copied to clipboard!', 'success');
                    }}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Copy className="w-4 h-4" /> Copy Menu Link
                  </button>

                  <a
                    href={digitalMenuUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" /> Open Public Link
                  </a>
                </div>
              </div>

              {/* RIGHT 7 COLS: LIVE INTERACTIVE GUEST MENU PREVIEW */}
              <div className="lg:col-span-7 space-y-3 no-print">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-extrabold text-slate-800">
                      Live Guest Mobile Menu Preview (Test Ordering Below)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">
                    {items.length > 0 ? `${items.length} Custom Dishes` : '12 Default Dishes Active'}
                  </span>
                </div>

                <DigitalMenuView
                  hotelId={targetHotelId}
                  hotelName={hotelName}
                  items={items}
                  rooms={rooms}
                  checkins={checkins}
                  orders={orders}
                  onUpdateOrders={onUpdateOrders}
                  onUpdateCheckins={onUpdateCheckins}
                  isEmbeddedPreview={true}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 9: ADVANCE FOOD BOOKING */}
      {activeTab === 'advance_booking' && (
        <FoodAdvanceBookingPanel
          bookings={posAdvanceBookings}
          hotelName={hotelName}
          loggedInUser={staff[0]?.name || 'Admin'}
          availableTables={tables.map(t => t.name)}
          onUpdateBookings={onUpdatePosAdvanceBookings || (() => {})}
          onCreatePosOrderFromAdvance={(adv) => {
            if (adv.tableNumber) {
              setTableNo(adv.tableNumber);
            }
            if (adv.guestOrGroupName) {
              setGuestName(adv.guestOrGroupName);
            }
            if (adv.mobile) {
              setCustomerPhone(adv.mobile);
            }
            const mealNotes = [
              `Advance Booking #${adv.bookingNumber || ''}`,
              adv.pax ? `Pax: ${adv.pax}` : '',
              adv.meals && adv.meals.length > 0 ? `Meal: ${adv.meals.join(', ')}` : '',
              adv.advanceAmount ? `Adv Paid: ₹${adv.advanceAmount}` : '',
              adv.balanceAmount ? `Bal Due: ₹${adv.balanceAmount}` : '',
              adv.specialRequest ? `Notes: ${adv.specialRequest}` : ''
            ].filter(Boolean).join(' | ');

            setOrderNotes(mealNotes);
            setActiveTab('terminal');
            showToast(`Advance booking for ${adv.guestOrGroupName} loaded into POS terminal!`, 'success');
          }}
        />
      )}

      {/* MODAL 1: ITEM CUSTOMIZER */}
      {customizingItem && (
        <PosMenuCustomizerModal
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={handleCustomizedAddToCart}
        />
      )}

      {/* MODAL 2: KOT PRINT TICKET VIEW */}
      {viewingKotOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="text-center pb-3 border-b border-slate-200">
              <h3 className="font-black text-slate-900 text-base uppercase">KITCHEN ORDER TICKET (KOT)</h3>
              <p className="text-xs text-slate-500">Ticket #{viewingKotOrder.orderNumber}</p>
              <p className="text-xs font-bold text-amber-700 mt-1">Time: {viewingKotOrder.kotSentAt || viewingKotOrder.time}</p>
            </div>

            <div className="text-xs space-y-1 text-slate-700 border-b border-slate-200 pb-2">
              <div><strong>Guest / Customer:</strong> {viewingKotOrder.guestName || 'Walk-in Guest'}</div>
              {viewingKotOrder.customerPhone && <div><strong>Phone:</strong> {viewingKotOrder.customerPhone}</div>}
              <div><strong>Order Type:</strong> {viewingKotOrder.orderType}</div>
              {viewingKotOrder.tableNo && <div><strong>Table:</strong> {viewingKotOrder.tableNo}</div>}
              {viewingKotOrder.roomNumber && <div><strong>Room:</strong> {viewingKotOrder.roomNumber}</div>}
              {viewingKotOrder.waiterName && <div><strong>Waiter:</strong> {viewingKotOrder.waiterName}</div>}
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-500 uppercase flex justify-between border-b border-slate-200 pb-1">
                <span>Item (Qty) &amp; Fixed Menu Rate</span>
                <span>Editable KOT Price (₹)</span>
              </div>
              {viewingKotOrder.items.map((it, idx) => {
                const fixedMenuPrice = it.menuPrice ?? effectiveItems.find(m => m.id === it.itemId)?.price ?? it.price;
                const priceDiff = r2(Number(it.price || 0) - Number(fixedMenuPrice || 0));
                return (
                  <div key={idx} className="text-xs flex justify-between items-center font-bold text-slate-800 py-1.5 border-b border-slate-100 gap-2">
                    <div className="flex-1 pr-2">
                      <div>{it.quantity}x {it.itemName} {it.selectedVariant ? `(${it.selectedVariant})` : ''}</div>
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                        <span>Menu Fixed: ₹{Number(fixedMenuPrice).toFixed(0)}</span>
                        {Math.abs(priceDiff) >= 0.5 && (
                          <span className={`px-1.5 py-0.2 rounded font-bold ${priceDiff < 0 ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                            {priceDiff < 0 ? `-₹${Math.abs(priceDiff)}` : `+₹${priceDiff}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-amber-700 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={it.price}
                        onChange={(e) => {
                          const newPrice = Math.max(0, parseFloat(e.target.value) || 0);
                          const updatedItems = viewingKotOrder.items.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  menuPrice: item.menuPrice ?? fixedMenuPrice,
                                  price: newPrice,
                                  total: r2(newPrice * item.quantity),
                                }
                              : item
                          );
                          const newSub = r2(updatedItems.reduce((s, itm) => s + itm.total, 0));
                          const factor = newSub > 0 ? Math.max(0, newSub - (viewingKotOrder.discount || 0)) / newSub : 0;
                          const newTax = !viewingKotOrder.isWithoutGst
                            ? r2(updatedItems.reduce((acc, itm) => acc + ((itm.total * factor) * (itm.taxRate ?? foodGstRate)) / 100, 0))
                            : 0;
                          const newGrand = r2(Math.max(0, newSub - (viewingKotOrder.discount || 0)) + newTax);
                          const updatedKot: PosOrder = {
                            ...viewingKotOrder,
                            items: updatedItems,
                            subtotal: newSub,
                            taxAmount: newTax,
                            grandTotal: newGrand
                          };
                          commitUpdatedKotOrder(updatedKot);
                        }}
                        className="w-20 px-2 py-1 border-2 border-amber-400 rounded-lg font-mono font-bold text-slate-900 text-xs text-right bg-white focus:outline-none"
                        title="Edit Food Item Price at KOT Printing"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explicit GST Include / Exclude Option at KOT Printing (Point 3) */}
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800 uppercase font-mono text-[10.5px]">KOT GST Option:</span>
                <span className="font-mono font-bold text-slate-800">
                  {!viewingKotOrder.isWithoutGst ? `GST (${foodGstRate}%): ₹${(viewingKotOrder.taxAmount || 0).toFixed(2)}` : 'GST Excluded (₹0.00)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const factor = viewingKotOrder.subtotal > 0
                      ? Math.max(0, viewingKotOrder.subtotal - (viewingKotOrder.discount || 0)) / viewingKotOrder.subtotal
                      : 0;
                    const newTax = r2(
                      viewingKotOrder.items.reduce((acc, itm) => acc + ((itm.total * factor) * (itm.taxRate ?? foodGstRate)) / 100, 0)
                    );
                    const newGrand = r2(Math.max(0, viewingKotOrder.subtotal - (viewingKotOrder.discount || 0)) + newTax);
                    commitUpdatedKotOrder({
                      ...viewingKotOrder,
                      isWithoutGst: false,
                      taxAmount: newTax,
                      grandTotal: newGrand,
                    });
                  }}
                  className={`py-1.5 px-2.5 rounded-lg font-bold text-xs border transition cursor-pointer ${
                    !viewingKotOrder.isWithoutGst
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  ✓ Include GST ({foodGstRate}%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newGrand = r2(Math.max(0, viewingKotOrder.subtotal - (viewingKotOrder.discount || 0)));
                    commitUpdatedKotOrder({
                      ...viewingKotOrder,
                      isWithoutGst: true,
                      taxAmount: 0,
                      grandTotal: newGrand,
                    });
                  }}
                  className={`py-1.5 px-2.5 rounded-lg font-bold text-xs border transition cursor-pointer ${
                    viewingKotOrder.isWithoutGst
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  ✕ Exclude GST (0%)
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-bold text-slate-800 pt-1 border-t border-slate-200">
              <span>Total KOT Order:</span>
              <span className="text-sm font-black text-slate-900">₹{viewingKotOrder.grandTotal.toFixed(2)}</span>
            </div>

            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setViewingKotOrder(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => printKotTicket(viewingKotOrder)}
                className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg text-xs hover:bg-amber-700 flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print KOT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SPLIT BILL */}
      {splitOrderModal && (
        <PosSplitBillModal
          order={splitOrderModal}
          onClose={() => setSplitOrderModal(null)}
          onConfirmSplit={(updated, amounts) => {
            const updatedOrders = orders.map(o => (o.id === updated.id ? updated : o));
            onUpdateOrders(updatedOrders);
            setSplitOrderModal(null);
            showNotice(`Bill split into ${amounts.length} parts for Order #${updated.orderNumber}`);
          }}
        />
      )}

      {/* MODAL 4: SETTLEMENT */}
      {settlingOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Settle Bill for Order #{settlingOrder.orderNumber}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Guest / Customer: <strong className="text-slate-800">{settlingOrder.guestName || 'Walk-in Guest'}</strong>
                {settlingOrder.roomNumber ? ` • Room ${settlingOrder.roomNumber}` : ''}
                {settlingOrder.tableNo ? ` • Table ${settlingOrder.tableNo}` : ''}
              </p>
            </div>

            {(() => {
              const previewSettled = computeSettledOrderTotals(settlingOrder, settlementDiscount);
              return (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>₹{previewSettled.subtotal.toFixed(2)}</span>
                  </div>
                  {previewSettled.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount (Before GST):</span>
                      <span>- ₹{previewSettled.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>GST Tax:</span>
                    <span>₹{previewSettled.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-amber-200">
                    <span>Bill Grand Total:</span>
                    <span>₹{previewSettled.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Additional Discount (₹)</label>
                <input
                  type="number"
                  value={settlementDiscount}
                  onChange={e => setSettlementDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Payment Method</label>
                <select
                  value={settlementPaymentMethod}
                  onChange={e => {
                    const val = e.target.value as 'Cash' | 'Card' | 'UPI' | 'Credit' | 'Room Charge' | 'Hybrid';
                    if (val === 'Hybrid' && settlingOrder) {
                      const totals = computeSettledOrderTotals(settlingOrder, settlementDiscount);
                      setSettleHybridRows(createInitialHybridRows(totals.grandTotal, ['Cash', 'UPI', 'Card']));
                    }
                    setSettlementPaymentMethod(val);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Cash">Cash Payment</option>
                  <option value="UPI">UPI / Digital QR</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Room Charge">Room Charge (Post to Folio)</option>
                  <option value="Credit">Credit / Postpaid Ledger</option>
                  <option value="Hybrid">⇄ Hybrid / Split Payment</option>
                </select>
                {settlementPaymentMethod === 'Hybrid' && settlingOrder && (
                  <HybridSplitPaymentBox
                    rows={settleHybridRows}
                    onChange={setSettleHybridRows}
                    modes={['Cash', 'UPI', 'Card']}
                    targetAmount={computeSettledOrderTotals(settlingOrder, settlementDiscount).grandTotal}
                    compact
                  />
                )}
              </div>
            </div>

            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSettlingOrder(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSettlement}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700 shadow-xs"
              >
                Confirm Payment & Issue Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RECEIPT & TAX INVOICE */}
      {viewingReceiptOrder && (
        <PosReceiptModal
          order={viewingReceiptOrder}
          onClose={() => setViewingReceiptOrder(null)}
        />
      )}

      {/* DRAWER: HELD ORDERS */}
      {showHeldOrdersDrawer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full p-6 space-y-4 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <Pause className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-slate-800 text-base">Held Orders Drawer</h3>
                </div>
                <button onClick={() => setShowHeldOrdersDrawer(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {heldOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No held orders found.</p>
                ) : (
                  heldOrders.map(ho => (
                    <div key={ho.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>Order #{ho.orderNumber}</span>
                        <span>₹{ho.grandTotal.toFixed(2)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Held at: {ho.heldAt || ho.time} • Note: "{ho.holdNote}"
                      </div>
                      <button
                        onClick={() => handleResumeHeldOrder(ho)}
                        className="w-full py-1.5 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 flex items-center justify-center space-x-1"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume Order</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowHeldOrdersDrawer(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* MODAL: DIRECT EDIT POS MENU ITEM (Point 15) */}
      {editingMenuItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Edit Menu Item</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMenuItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedMenuItem} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Item Code / SKU</label>
                  <input
                    type="text"
                    disabled
                    value={editingMenuItem.code}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editItemPrice}
                    onChange={(e) => setEditItemPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <input
                    type="text"
                    value={editItemCategory}
                    onChange={(e) => setEditItemCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Sub-Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Paneer Special"
                    value={editItemSubCategory}
                    onChange={(e) => setEditItemSubCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tax Rate (GST %)</label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    value={editItemTaxRate}
                    onChange={(e) => setEditItemTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center space-x-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editItemAvailable}
                    onChange={(e) => setEditItemAvailable(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span>Item Available for Ordering</span>
                </label>
              </div>

              <div className="flex space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMenuItem(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 shadow-xs"
                >
                  Save Item Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD CATEGORY / SUB-CATEGORY MODAL */}
      {showQuickCatModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Utensils className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  {quickCatMode === 'new_category' ? 'Add Food Category' : 'Add Sub-Category'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCatModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setQuickCatMode('new_category')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quickCatMode === 'new_category'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + New Category
              </button>
              <button
                type="button"
                onClick={() => setQuickCatMode('new_subcategory')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quickCatMode === 'new_subcategory'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Add Sub-Category
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {quickCatMode === 'new_category' ? (
                <>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Course, Chinese, Snacks, Beverages, Thali"
                      value={quickCatName}
                      onChange={e => setQuickCatName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Sub-Categories (Optional, comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paneer Special, Dal, Breads, Rice, Noodles"
                      value={quickCatSubInput}
                      onChange={e => setQuickCatSubInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Multiple sub-categories can be entered separated by commas.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Select Parent Category *</label>
                    <select
                      value={quickTargetCatId || categories[0]?.id || ''}
                      onChange={e => setQuickTargetCatId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500 font-semibold bg-white"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Sub-Category Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Paneer Special, Dal, Tandoori Breads"
                      value={quickCatSubInput}
                      onChange={e => setQuickCatSubInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-amber-500 font-semibold"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickCatModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickCategoryOrSub}
                className="flex-1 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 shadow-xs cursor-pointer"
              >
                Save
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowQuickCatModal(false);
                  setActiveTab('catalog');
                }}
                className="text-amber-700 hover:underline text-xs font-semibold cursor-pointer"
              >
                Open Full Menu & Category Manager →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
