import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  RefreshCw,
  CreditCard,
  AlertTriangle,
  Receipt,
  History,
  Smartphone,
  ShieldCheck,
  Check,
  Settings,
  HelpCircle,
} from 'lucide-react';
import {
  BookingRecord,
  PaymentMethod,
  PosMenuItem,
  PosOrderRecord,
  InventoryItemRecord,
} from '../types';
import type { FoodAdvanceBooking } from '../../types';
import FoodAdvanceBookingPanel from '../../components/FoodAdvanceBookingPanel';
import { formatCurrency } from '../utils/formatters';
import { useHotelTaxSettings } from '../utils/taxSettings';
import { r2 } from '../../utils/billCalculator';
import { showToast } from '../../utils/toast';
import {
  computePosBill,
  resolvePayStatus,
  sumPayRows,
  dominantMethod,
  allocatePayRows,
  PayRow,
  r4,
  parseMenuPairText,
  getConfiguredMenuUnitPrice,
  isManualPriceOverride,
  cleanOrderItemBaseName,
} from '../utils/posBilling';
import {
  resolvePosCapabilities,
  writeStoredPosFacilityFallback,
} from '../../utils/posConfigHelpers';

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
  currentRole?: string;
  onAddAuditLog?: (action: string, details: string) => void;
  onSettlePosOrders?: (
    updates: {
      id: string;
      payments: any[];
      amountPaid: number;
      balanceDue: number;
      paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
      paymentMethod: PaymentMethod;
      paymentSummary: string;
    }[]
  ) => void;
  onCreatePosOrder: (order: PosOrderRecord, postToBookingId?: string) => void;
  onUpdateKotStatus: (orderId: string, nextStatus: PosOrderRecord['kotStatus']) => void;
  onUpdatePosOrder?: (order: PosOrderRecord) => void;
  onAddMenuItem?: (item: PosMenuItem) => void;
  onUpdateMenuItem?: (item: PosMenuItem) => void;
  onDeleteMenuItem?: (itemId: string) => void;
  inventoryItems?: InventoryItemRecord[];
  hotelSettings?: any;
  onUpdateHotelSettings?: (updated: any) => void;
  onRecordStockMovement?: (
    itemId: string,
    type: 'IN' | 'OUT',
    qty: number,
    department: string,
    reason: string
  ) => void;
}

export interface HybridPaymentRow {
  id: string;
  method: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  amount: number | '';
  reference: string;
  cashTendered?: number | '';
  upiUtr?: string;
  upiVerified?: boolean;
  cardNetwork?: string;
  cardLast4?: string;
  cardTerminal?: string;
  bankName?: string;
}

interface RestaurantTableConfig {
  tableNumber: string;
  floor: string;
  capacity: number;
}

const DEFAULT_TABLES: RestaurantTableConfig[] = [
  { tableNumber: 'T-01', floor: 'Main Hall', capacity: 2 },
  { tableNumber: 'T-02', floor: 'Main Hall', capacity: 4 },
  { tableNumber: 'T-03', floor: 'Main Hall', capacity: 4 },
  { tableNumber: 'T-04', floor: 'Main Hall', capacity: 6 },
  { tableNumber: 'T-05', floor: 'Main Hall', capacity: 4 },
  { tableNumber: 'T-06', floor: 'Family Zone', capacity: 6 },
  { tableNumber: 'T-07', floor: 'Family Zone', capacity: 8 },
  { tableNumber: 'T-08', floor: 'Terrace / Lawn', capacity: 4 },
];

const BUILTIN_COUPONS: { code: string; type: 'percent' | 'fixed'; value: number; minSubtotal: number }[] = [
  { code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 200 },
  { code: 'FESTIVE15', type: 'percent', value: 15, minSubtotal: 500 },
  { code: 'FLAT100', type: 'fixed', value: 100, minSubtotal: 600 },
  { code: 'VIP20', type: 'percent', value: 20, minSubtotal: 1000 },
];

const getIstTodayStr = (): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}
  return new Date().toISOString().slice(0, 10);
};

const getIstDateTimeStr = (): string => {
  const datePart = getIstTodayStr();
  try {
    const timePart = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .format(new Date())
      .toUpperCase();
    return `${datePart} ${timePart}`;
  } catch {
    return datePart;
  }
};

const escapeHtml = (val: unknown): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Prints ONLY a compact 80mm thermal document (KOT or POS Tax Invoice) inside an isolated offscreen iframe
 * so the background POS interface, sidebar, modals and extra blank pages are NEVER printed.
 */
const printThermalDocument = (docTitle: string, bodyHtml: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    html, body {
      width: 74mm;
      max-width: 74mm;
      margin: 0 auto;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kot-wrap { padding: 2mm 1mm; page-break-inside: avoid; break-inside: avoid; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .xbold { font-weight: 800; }
    .mono { font-family: 'Courier New', Consolas, monospace; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    .solid-divider { border-top: 1.5px solid #000; margin: 5px 0; }
    .tag {
      display: inline-block;
      border: 1px solid #000;
      padding: 1px 5px;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      margin: 2px 2px 3px;
    }
    .meta-grid { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .meta-grid td { padding: 1.5px 0; vertical-align: top; }
    .items-tbl { width: 100%; border-collapse: collapse; margin-top: 3px; }
    .items-tbl th {
      font-size: 9.5px;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      padding: 2px 0;
      text-align: left;
    }
    .items-tbl td { padding: 3px 0; vertical-align: top; border-bottom: 0.5px dotted #666; }
    .portion-pill {
      display: inline-block;
      border: 1px solid #000;
      padding: 0 4px;
      font-size: 9.5px;
      font-weight: 800;
      margin-left: 3px;
    }
    .station-lbl { font-size: 9px; font-weight: 700; color: #222; }
    .note-box { font-size: 10px; font-weight: 700; margin-top: 1px; }
    .order-note { border: 1px dashed #000; padding: 4px; margin-top: 5px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="kot-wrap">${bodyHtml}</div>
</body>
</html>`;

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1200);
    }
  };

  if (doc.readyState === 'complete') {
    setTimeout(triggerPrint, 80);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 80);
  }
};

const makeCartLineId = (itemId: string, variant?: string, addons?: string[]): string =>
  `${itemId}::${String(variant || '').trim().toLowerCase()}::${(addons || [])
    .map((a) => a.trim().toLowerCase())
    .sort()
    .join('|')}`;

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

interface CartLine {
  lineId: string;
  item: PosMenuItem;
  qty: number;
  /** Set ONLY when an authorized user manually overrides the configured portion + add-on selling price. */
  customUnitPrice?: number;
  overrideReason?: string;
  variant?: string;
  addons?: string[];
  itemNotes?: string;
  itemDiscount?: number;
}

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
  currentRole = 'Admin',
  onAddAuditLog,
  onSettlePosOrders,
  onCreatePosOrder,
  onUpdateKotStatus,
  onUpdatePosOrder,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  inventoryItems = [],
  hotelSettings,
  onUpdateHotelSettings,
  onRecordStockMovement,
}) => {
  // Per-hotel POS Facility Configuration (In-House Kitchen & In-House Café / Restaurant)
  const [facilityOverrides, setFacilityOverrides] = useState<{
    inHouseKitchenAvailable?: boolean;
    inHouseRestaurantAvailable?: boolean;
    posOutletName?: string;
  }>({});

  useEffect(() => {
    setFacilityOverrides({});
  }, [
    hotelId,
    hotelSettings?.inHouseKitchenAvailable,
    hotelSettings?.inHouseRestaurantAvailable,
    hotelSettings?.posOutletName,
  ]);

  const posCapabilities = useMemo(
    () =>
      resolvePosCapabilities(
        {
          ...(hotelSettings || {}),
          ...facilityOverrides,
        },
        hotelId
      ),
    [hotelSettings, facilityOverrides, hotelId]
  );

  const [outletNameInput, setOutletNameInput] = useState<string>(posCapabilities.posOutletName);
  const [fnbGstRateInput, setFnbGstRateInput] = useState<number>(
    Number(hotelSettings?.foodGstRate ?? foodGstRate ?? 5)
  );
  useEffect(() => {
    setOutletNameInput(posCapabilities.posOutletName);
  }, [posCapabilities.posOutletName]);

  const handleSavePosFacilitySettings = (patch: {
    inHouseKitchenAvailable?: boolean;
    inHouseRestaurantAvailable?: boolean;
    posOutletName?: string;
    foodGstRate?: number;
  }) => {
    const nextKitchen =
      patch.inHouseKitchenAvailable !== undefined
        ? patch.inHouseKitchenAvailable
        : posCapabilities.inHouseKitchenAvailable;
    const nextRestaurant =
      patch.inHouseRestaurantAvailable !== undefined
        ? patch.inHouseRestaurantAvailable
        : posCapabilities.inHouseRestaurantAvailable;
    const nextOutlet =
      patch.posOutletName !== undefined
        ? patch.posOutletName.trim() ||
          (nextRestaurant ? 'Main Restaurant & Room Service' : 'In-Room Dining (Room Service)')
        : posCapabilities.posOutletName;

    setFacilityOverrides({
      inHouseKitchenAvailable: nextKitchen,
      inHouseRestaurantAvailable: nextRestaurant,
      posOutletName: nextOutlet,
    });

    writeStoredPosFacilityFallback(hotelId, {
      inHouseKitchenAvailable: nextKitchen,
      inHouseRestaurantAvailable: nextRestaurant,
      posOutletName: nextOutlet,
    });

    if (onUpdateHotelSettings) {
      onUpdateHotelSettings({
        ...(hotelSettings || { name: hotelName }),
        id: hotelId,
        name: hotelSettings?.name || hotelName,
        inHouseKitchenAvailable: nextKitchen,
        inHouseRestaurantAvailable: nextRestaurant,
        posOutletName: nextOutlet,
        ...(patch.foodGstRate !== undefined ? { foodGstRate: patch.foodGstRate } : {}),
      });
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        'POS Configuration Updated',
        `Updated POS settings for ${hotelName} by ${loggedInUser}: In-House Kitchen = ${
          nextKitchen ? 'YES' : 'NO'
        }, In-House Café/Restaurant = ${nextRestaurant ? 'YES' : 'NO'}, Outlet = "${nextOutlet}".`
      );
    }
    showToast(
      `POS settings updated (Kitchen: ${nextKitchen ? 'ON' : 'OFF'} • Restaurant/Café: ${
        nextRestaurant ? 'ON' : 'Room Service Only'
      })`,
      'success'
    );
  };

  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyModeFilter, setHistoryModeFilter] = useState<'ALL' | 'Dine In' | 'Takeaway' | 'Room Service'>('ALL');
  const [leftColTab, setLeftColTab] = useState<'tables' | 'orders' | 'bookings'>('tables');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [mealWindowFilter, setMealWindowFilter] = useState<'All' | 'Breakfast' | 'Lunch' | 'Dinner'>('All');
  const [vegFilter, setVegFilter] = useState<'All' | 'Veg' | 'Non-Veg'>('All');
  const [search, setSearch] = useState('');
  const [leftOrderSearch, setLeftOrderSearch] = useState('');

  const [orderType, setOrderType] = useState<'Room Service' | 'Dine In' | 'Takeaway'>('Dine In');
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    bookings.find((b) => b.isCheckedIn && !b.isCheckedOut)?.id || ''
  );
  const [tableNumber, setTableNumber] = useState('T-01');
  const [dineInPax, setDineInPax] = useState<number>(2);
  const [waiterName, setWaiterName] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState<string>('');
  const [packagingCharge, setPackagingCharge] = useState<number | ''>('');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [linkedAdvanceId, setLinkedAdvanceId] = useState<string>('');
  const [advanceDepositCredit, setAdvanceDepositCredit] = useState<number>(0);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingOrder, setEditingOrder] = useState<PosOrderRecord | null>(null);
  const [pendingEditAdvanceId, setPendingEditAdvanceId] = useState<string | null>(null);
  const [printingFoodOrder, setPrintingFoodOrder] = useState<PosOrderRecord | null>(null);
  const [printingKotOrder, setPrintingKotOrder] = useState<{ order: PosOrderRecord; isReprint?: boolean } | null>(null);

  // Persisted Restaurant Tables config per hotel
  const tablesStorageKey = `pms_pos_tables_cfg_${hotelId}`;
  const [tableConfigs, setTableConfigs] = useState<RestaurantTableConfig[]>(() => {
    try {
      const raw = localStorage.getItem(tablesStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_TABLES;
  });
  const [editingTableOriginalNo, setEditingTableOriginalNo] = useState<string | null>(null);
  const [newTableNo, setNewTableNo] = useState('');
  const [newTableFloor, setNewTableFloor] = useState('Main Hall');
  const [newTableCap, setNewTableCap] = useState<number>(4);

  const saveTableConfigs = (next: RestaurantTableConfig[]) => {
    setTableConfigs(next);
    try {
      localStorage.setItem(tablesStorageKey, JSON.stringify(next));
    } catch {}
  };

  // New / Edit Menu Item State (Complete Section 1 Product Management)
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<PosMenuItem['category']>('North Indian');
  const [newItemSubCategory, setNewItemSubCategory] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number | ''>(180);
  const [newItemCostPrice, setNewItemCostPrice] = useState<number | ''>('');
  const [newItemTaxRate, setNewItemTaxRate] = useState<number>(5);
  const [newItemVeg, setNewItemVeg] = useState<boolean>(true);
  const [newItemStation, setNewItemStation] = useState<string>('Main Kitchen');
  const [newItemPrepTime, setNewItemPrepTime] = useState<number | ''>(15);
  const [newItemImage, setNewItemImage] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemVariantsText, setNewItemVariantsText] = useState(''); // e.g. "Half:160, Full:280"
  const [newItemAddonsText, setNewItemAddonsText] = useState(''); // e.g. "Extra Butter:30, Cheese:50"
  const [newItemMeals, setNewItemMeals] = useState<('Breakfast' | 'Lunch' | 'Dinner' | 'All Day')[]>(['All Day']);
  const [newItemStockTrack, setNewItemStockTrack] = useState<boolean>(false);
  const [newItemStockQty, setNewItemStockQty] = useState<number | ''>('');
  const [newItemAvailable, setNewItemAvailable] = useState<boolean>(true);
  const [newItemActive, setNewItemActive] = useState<boolean>(true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCatFilter, setCatalogCatFilter] = useState('ALL');
  const [bulkPctInput, setBulkPctInput] = useState<number | ''>('');

  // Recipe Builder State in Menu & Recipe Master (Section 2: BOM & Stock Deduction)
  const [newItemRecipeIngredients, setNewItemRecipeIngredients] = useState<
    { inventoryItemId: string; ingredientName: string; quantity: number; unit: string }[]
  >([]);
  const [recipeSelectItemId, setRecipeSelectItemId] = useState('');
  const [recipeQtyInput, setRecipeQtyInput] = useState<number | ''>('');

  // Multi-Device Synchronization States & Channels (Module 3)
  const POS_SYNC_CHANNEL = 'pms_pos_multi_device_channel';
  const POS_SYNC_STORAGE = 'pms_pos_last_sync_event';
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  const broadcastPosEvent = (type: string, payload?: any) => {
    try {
      const msg = {
        type,
        payload,
        timestamp: Date.now(),
        sender: loggedInUser || 'POS Terminal',
      };
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(POS_SYNC_CHANNEL);
        bc.postMessage(msg);
        bc.close();
      }
      localStorage.setItem(POS_SYNC_STORAGE, JSON.stringify(msg));
    } catch {}
  };

  useEffect(() => {
    const handleSync = () => {
      setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(POS_SYNC_CHANNEL);
        bc.onmessage = handleSync;
      } catch {}
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === POS_SYNC_STORAGE) handleSync();
    };
    window.addEventListener('storage', onStorage);

    const interval = setInterval(handleSync, 6000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = () => {
    broadcastPosEvent('MANUAL_SYNC');
    setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    showToast('POS synchronized with multi-device network.', 'success');
  };

  // Dedicated Order Payment / Settle Modal (works for ALL orders: Dine-In, Takeaway, Room Service)
  const [orderPaymentModal, setOrderPaymentModal] = useState<PosOrderRecord | null>(null);
  const [orderPayAmtInput, setOrderPayAmtInput] = useState<number | ''>('');
  const [orderPayMethod, setOrderPayMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer'>('Cash');
  const [orderPayCashTendered, setOrderPayCashTendered] = useState<number | ''>('');
  const [orderPayUpiUtr, setOrderPayUpiUtr] = useState('');
  const [orderPayUpiVerified, setOrderPayUpiVerified] = useState(false);
  const [orderPayCardNetwork, setOrderPayCardNetwork] = useState<'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Other'>('Visa');
  const [orderPayCardLast4, setOrderPayCardLast4] = useState('');
  const [orderPayCardTerminal, setOrderPayCardTerminal] = useState('');
  const [orderPayBankName, setOrderPayBankName] = useState('');
  const [orderPayBankRef, setOrderPayBankRef] = useState('');

  // Modal & Settlement States
  const [showAdditionalModal, setShowAdditionalModal] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [voidModalOrder, setVoidModalOrder] = useState<PosOrderRecord | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState<number | ''>('');

  const inHouseBookings = bookings.filter((b) => b.isCheckedIn && !b.isCheckedOut);
  const activeBooking =
    inHouseBookings.find((b) => b.id === selectedBookingId) ||
    inHouseBookings[0];

  useEffect(() => {
    if (!selectedBookingId && inHouseBookings[0]) {
      setSelectedBookingId(inHouseBookings[0].id);
    } else if (
      selectedBookingId &&
      inHouseBookings.length > 0 &&
      !inHouseBookings.some((b) => b.id === selectedBookingId)
    ) {
      setSelectedBookingId(inHouseBookings[0].id);
    }
  }, [inHouseBookings, selectedBookingId]);

  const getLineConfiguredInfo = (c: Pick<CartLine, 'item' | 'variant' | 'addons'>) =>
    getConfiguredMenuUnitPrice(c.item, c.variant, c.addons);

  const getEffectiveLineUnitPrice = (c: CartLine): number => {
    const { configuredUnitPrice } = getLineConfiguredInfo(c);
    return isManualPriceOverride(c.customUnitPrice, configuredUnitPrice)
      ? r2(c.customUnitPrice as number)
      : configuredUnitPrice;
  };

  const isCartLinePriceOverridden = (c: CartLine): boolean => {
    const { configuredUnitPrice } = getLineConfiguredInfo(c);
    return isManualPriceOverride(c.customUnitPrice, configuredUnitPrice);
  };

  const addToCart = (item: PosMenuItem, explicitVariantName?: string) => {
    if (item.available === false || item.isActive === false) {
      showToast(`"${item.name}" is currently marked Out of Stock / Unavailable.`, 'warning');
      return;
    }
    if (item.stockTracking && (Number(item.currentStock) || 0) <= 0) {
      showToast(`"${item.name}" is Out of Stock (0 remaining).`, 'error');
      return;
    }
    const totalDishQtyInCart = cart
      .filter((c) => c.item.id === item.id)
      .reduce((s, c) => s + c.qty, 0);

    // Check Recipe BOM raw ingredient stock from warehouse (4-decimal exact check)
    if (item.recipeIngredients && item.recipeIngredients.length > 0) {
      const nextDishQty = totalDishQtyInCart + 1;
      const shortageIng = item.recipeIngredients.find((ri) => {
        const inv = inventoryItems.find((i) => i.id === ri.inventoryItemId);
        return inv && r4(Number(inv.currentStock) || 0) < r4(ri.quantity * nextDishQty);
      });
      if (shortageIng) {
        showToast(
          `Cannot add "${item.name}": insufficient "${shortageIng.ingredientName}" in warehouse.`,
          'error'
        );
        return;
      }
    }

    const chosenVariantObj = explicitVariantName
      ? item.variants?.find((v) => v.name === explicitVariantName)
      : item.variants && item.variants.length > 0
      ? item.variants[0]
      : undefined;
    const chosenVariant = chosenVariantObj?.name;
    const targetLineId = makeCartLineId(item.id, chosenVariant, []);

    setCart((prev) => {
      const totalCurrent = prev.filter((c) => c.item.id === item.id).reduce((s, c) => s + c.qty, 0);
      if (item.stockTracking && totalCurrent + 1 > (Number(item.currentStock) || 0)) {
        showToast(`Only ${item.currentStock} unit(s) of "${item.name}" available in stock.`, 'warning');
        return prev;
      }
      const existing = prev.find((c) => c.lineId === targetLineId && c.customUnitPrice === undefined);
      if (existing) {
        return prev.map((c) => (c.lineId === existing.lineId ? { ...c, qty: c.qty + 1 } : c));
      }
      return [
        ...prev,
        {
          lineId: `${targetLineId}::${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          item,
          qty: 1,
          variant: chosenVariant,
          customUnitPrice: undefined,
        },
      ];
    });
  };

  const updateQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      const targetLine = prev.find((c) => c.lineId === lineId);
      if (!targetLine) return prev;
      const totalDishQty = prev
        .filter((c) => c.item.id === targetLine.item.id)
        .reduce((s, c) => s + c.qty, 0);
      if (delta > 0) {
        if (
          targetLine.item.stockTracking &&
          totalDishQty + delta > (Number(targetLine.item.currentStock) || 0)
        ) {
          showToast(
            `Only ${targetLine.item.currentStock} unit(s) of "${targetLine.item.name}" available in stock.`,
            'warning'
          );
          return prev;
        }
        if (targetLine.item.recipeIngredients && targetLine.item.recipeIngredients.length > 0) {
          const outOfStockIng = targetLine.item.recipeIngredients.find((ri) => {
            const inv = inventoryItems.find((i) => i.id === ri.inventoryItemId);
            return inv && r4(Number(inv.currentStock) || 0) < r4(ri.quantity * (totalDishQty + delta));
          });
          if (outOfStockIng) {
            showToast(
              `Cannot increase "${targetLine.item.name}": insufficient "${outOfStockIng.ingredientName}" in warehouse.`,
              'warning'
            );
            return prev;
          }
        }
      }
      return prev
        .map((c) => (c.lineId === lineId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0);
    });
  };

  const [taxSettings] = useHotelTaxSettings();
  const configuredFnbGst =
    foodGstRate !== undefined ? foodGstRate : r2(taxSettings.fnbCgst + taxSettings.fnbSgst);

  // ---------------- Billing state (discount / coupon / negotiated settlement / GST / payments / open checks) ----------------
  const canApprove = ['Admin', 'Owner', 'Manager', 'SuperAdmin'].includes(String(currentRole));
  const canOverrideItemPrice = [
    'Admin',
    'Owner',
    'Manager',
    'SuperAdmin',
    'Reception',
    'Receptionist',
    'Accounts',
  ].includes(String(currentRole));

  // Enforce In-House Café / Restaurant setting: when NO, switch POS interface to Room Service Only
  useEffect(() => {
    if (!posCapabilities.inHouseRestaurantAvailable) {
      setOrderType('Room Service');
      if (leftColTab !== 'orders') {
        setLeftColTab('orders');
      }
    }
  }, [posCapabilities.inHouseRestaurantAvailable]);

  // Listen to Standalone POS Top Header events (New Order, Search, Operational Date)
  useEffect(() => {
    const onNewOrderEvt = () => {
      setCart([]);
      setEditingOrder(null);
      setOrderType(posCapabilities.defaultOrderType);
    };
    const onGlobalSearchEvt = (e: Event) => {
      const q = String((e as CustomEvent)?.detail?.query ?? '');
      setSearch(q);
      setHistorySearch(q);
    };
    const onDateFilterEvt = (e: Event) => {
      const dt = String((e as CustomEvent)?.detail?.date ?? '');
      if (dt) setHistoryDateFilter(dt);
    };
    window.addEventListener('directstay:pos-new-order', onNewOrderEvt);
    window.addEventListener('directstay:pos-global-search', onGlobalSearchEvt);
    window.addEventListener('directstay:pos-date-filter', onDateFilterEvt);
    return () => {
      window.removeEventListener('directstay:pos-new-order', onNewOrderEvt);
      window.removeEventListener('directstay:pos-global-search', onGlobalSearchEvt);
      window.removeEventListener('directstay:pos-date-filter', onDateFilterEvt);
    };
  }, [posCapabilities.defaultOrderType]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [discountReason, setDiscountReason] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [settlementEnabled, setSettlementEnabled] = useState(false);
  const [settlementFinal, setSettlementFinal] = useState<number | ''>('');
  const [settlementReason, setSettlementReason] = useState('');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [customerGstin, setCustomerGstin] = useState('');
  const [companyName, setCompanyName] = useState('');
  // Back-Dated Food Billing Date & Time
  const [customOrderDate, setCustomOrderDate] = useState<string>(() => getIstTodayStr());
  const [customOrderTime, setCustomOrderTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [payMode, setPayMode] = useState<
    'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Room Charge' | 'Hybrid'
  >('Cash');
  const [amountReceived, setAmountReceived] = useState<number | ''>('');
  const [payReference, setPayReference] = useState('');

  // Cash manual verification
  const [cashTendered, setCashTendered] = useState<number | ''>('');

  // UPI manual verification
  const [upiUtr, setUpiUtr] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);

  // Card manual entry
  const [cardNetwork, setCardNetwork] = useState<'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Other'>('Visa');
  const [cardLast4, setCardLast4] = useState('');
  const [cardTerminal, setCardTerminal] = useState('');

  // Bank Transfer manual entry
  const [bankName, setBankName] = useState('');
  const [bankRef, setBankRef] = useState('');

  // Hybrid Split Rows
  const [hybridRows, setHybridRows] = useState<HybridPaymentRow[]>([
    { id: 'hy1', method: 'Cash', amount: '', reference: '' },
    { id: 'hy2', method: 'UPI', amount: '', reference: '' },
  ]);
  const [keepTableOpen, setKeepTableOpen] = useState(false);
  const isSubmittingRef = useRef(false);

  // Open table checks settlement (consolidated bill)
  const [settleTable, setSettleTable] = useState<string | null>(null);
  const [settleMode, setSettleMode] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Hybrid'>('Cash');
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settleRef, setSettleRef] = useState('');
  const [settleCashTendered, setSettleCashTendered] = useState<number | ''>('');
  const [settleUpiUtr, setSettleUpiUtr] = useState('');
  const [settleUpiVerified, setSettleUpiVerified] = useState(false);
  const [settleCardNetwork, setSettleCardNetwork] = useState<'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Other'>('Visa');
  const [settleCardLast4, setSettleCardLast4] = useState('');
  const [settleCardTerminal, setSettleCardTerminal] = useState('');
  const [settleBankName, setSettleBankName] = useState('');
  const [settleBankRef, setSettleBankRef] = useState('');
  const [settleRows, setSettleRows] = useState<HybridPaymentRow[]>([
    { id: 'sh1', method: 'Cash', amount: '', reference: '' },
    { id: 'sh2', method: 'UPI', amount: '', reference: '' },
  ]);

  const effectiveGstPct = gstEnabled ? configuredFnbGst : 0;
  const itemLevelDiscountSum = r2(
    cart.reduce(
      (s, c) =>
        s +
        Math.min(
          getEffectiveLineUnitPrice(c) * c.qty,
          Math.max(0, Number(c.itemDiscount) || 0)
        ),
      0
    )
  );
  const extraPkg = orderType === 'Takeaway' ? Math.max(0, r2(Number(packagingCharge) || 0)) : 0;

  const bill = computePosBill({
    lines: [
      ...cart.map((c) => ({ unitPrice: getEffectiveLineUnitPrice(c), qty: c.qty })),
      ...(extraPkg > 0 ? [{ unitPrice: extraPkg, qty: 1 }] : []),
    ],
    discountEnabled: discountEnabled || itemLevelDiscountSum > 0,
    discountType: discountEnabled ? discountType : 'fixed',
    discountValue: discountEnabled
      ? discountType === 'percent'
        ? Number(discountValue) || 0
        : (Number(discountValue) || 0) + itemLevelDiscountSum
      : itemLevelDiscountSum,
    gstPct: effectiveGstPct,
    settlementEnabled,
    settlementFinal,
  });
  const subtotal = bill.subtotal;
  const taxAmount = bill.tax;
  const grandTotal = bill.payable;
  const discountAmount = bill.discount;
  const alreadyPaidOnEditingOrder = editingOrder
    ? r2(Math.max(0, (Number(editingOrder.amountPaid) || 0) - (Number(editingOrder.advanceDepositApplied) || 0)))
    : 0;
  const netPayableAfterDeposit = r2(
    Math.max(0, grandTotal - advanceDepositCredit - alreadyPaidOnEditingOrder)
  );

  const setLinePrice = (lineId: string, raw: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.lineId !== lineId) return c;
        const { configuredUnitPrice } = getLineConfiguredInfo(c);
        if (raw === '') {
          return { ...c, customUnitPrice: undefined, overrideReason: '' };
        }
        const parsed = Math.max(0, Number(raw) || 0);
        if (Math.abs(parsed - configuredUnitPrice) < 0.005) {
          return { ...c, customUnitPrice: undefined, overrideReason: '' };
        }
        return { ...c, customUnitPrice: parsed };
      })
    );
  };
  const setLineReason = (lineId: string, reason: string) => {
    setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, overrideReason: reason } : c)));
  };
  const setLineNotes = (lineId: string, notes: string) => {
    setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, itemNotes: notes } : c)));
  };
  const setLineItemDiscount = (lineId: string, disc: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.lineId === lineId ? { ...c, itemDiscount: disc === '' ? 0 : Math.max(0, Number(disc) || 0) } : c
      )
    );
  };
  const setLineVariant = (lineId: string, varName: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.lineId !== lineId) return c;
        // Changing to a predefined portion resets any accidental price override so configured portion price is used cleanly
        return {
          ...c,
          variant: varName,
          customUnitPrice: undefined,
          overrideReason: '',
        };
      })
    );
  };
  const toggleLineAddon = (lineId: string, addonName: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.lineId !== lineId) return c;
        const current = c.addons || [];
        const nextAddons = current.includes(addonName)
          ? current.filter((a) => a !== addonName)
          : [...current, addonName];
        return {
          ...c,
          addons: nextAddons.length > 0 ? nextAddons : undefined,
        };
      })
    );
  };
  const resetLinePrice = (lineId: string) => {
    setCart((prev) =>
      prev.map((c) => (c.lineId === lineId ? { ...c, customUnitPrice: undefined, overrideReason: '' } : c))
    );
  };

  const handleApplyCouponCode = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const found = BUILTIN_COUPONS.find((c) => c.code === code);
    if (!found) {
      showToast(`Invalid or expired coupon code "${code}". Try WELCOME10, FESTIVE15, FLAT100, or VIP20.`, 'error');
      return;
    }
    if (subtotal < found.minSubtotal) {
      showToast(`Coupon ${found.code} requires a minimum order of ₹${found.minSubtotal}.`, 'warning');
      return;
    }
    setDiscountEnabled(true);
    setDiscountType(found.type);
    setDiscountValue(found.value);
    setDiscountReason(`Coupon ${found.code}`);
    setAppliedCouponCode(found.code);
    showToast(`Coupon ${found.code} applied!`, 'success');
  };

  // Running open table checks & Held Orders
  const openChecks = useMemo(() => {
    const groups = new Map<string, PosOrderRecord[]>();
    orders
      .filter(
        (o) =>
          o.orderType === 'Dine In' &&
          !o.isHeld &&
          o.kotStatus !== 'Cancelled' &&
          o.isOpenCheck &&
          (o.balanceDue ?? 0) > 0.5
      )
      .forEach((o) => {
        const key = o.tableNumber || '—';
        groups.set(key, [...(groups.get(key) || []), o]);
      });
    return Array.from(groups.entries()).map(([table, list]) => {
      const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
      const allServed = sorted.every((o) => o.kotStatus === 'Served');
      return {
        table,
        orders: sorted,
        total: r2(sorted.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0)),
        paid: r2(sorted.reduce((s, o) => s + (Number(o.amountPaid) || 0), 0)),
        due: r2(sorted.reduce((s, o) => s + (Number(o.balanceDue ?? o.grandTotal) || 0), 0)),
        allServed,
      };
    });
  }, [orders]);

  const heldOrdersList = useMemo(
    () => orders.filter((o) => o.isHeld && o.kotStatus !== 'Cancelled'),
    [orders]
  );

  const rawOpenCheckForCurrentTable =
    orderType === 'Dine In' ? openChecks.find((g) => g.table === tableNumber) : undefined;

  const openCheckForCurrentTable = useMemo(() => {
    if (!rawOpenCheckForCurrentTable) return undefined;
    if (!editingOrder) return rawOpenCheckForCurrentTable;
    const otherOrders = rawOpenCheckForCurrentTable.orders.filter((o) => o.id !== editingOrder.id);
    if (otherOrders.length === 0) return undefined;
    return {
      ...rawOpenCheckForCurrentTable,
      orders: otherOrders,
      total: r2(otherOrders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0)),
      paid: r2(otherOrders.reduce((s, o) => s + (Number(o.amountPaid) || 0), 0)),
      due: r2(otherOrders.reduce((s, o) => s + (Number(o.balanceDue ?? o.grandTotal) || 0), 0)),
      allServed: otherOrders.every((o) => o.kotStatus === 'Served'),
    };
  }, [rawOpenCheckForCurrentTable, editingOrder]);

  // Compute live table status: Available -> Reserved (only when real advance booking exists!) -> Occupied -> Billing -> Available
  const todayIst = getIstTodayStr();
  const getTableLiveStatus = (
    tblNo: string
  ): { status: 'Available' | 'Reserved' | 'Occupied' | 'Billing'; openCheck?: (typeof openChecks)[number]; reservation?: FoodAdvanceBooking } => {
    const openCk = openChecks.find((g) => g.table === tblNo);
    if (openCk) {
      return {
        status: openCk.allServed ? 'Billing' : 'Occupied',
        openCheck: openCk,
      };
    }
    const activeRes = posAdvanceBookings.find(
      (b) =>
        b.status !== 'Cancelled' &&
        b.status !== 'Completed' &&
        !b.convertedPosOrderId &&
        b.eventDate === todayIst &&
        (String((b as any).tableNumber || '').toUpperCase() === tblNo.toUpperCase() ||
          String(b.specialRequest || '').toUpperCase().includes(tblNo.toUpperCase()))
    );
    if (activeRes) {
      return { status: 'Reserved', reservation: activeRes };
    }
    return { status: 'Available' };
  };

  useEffect(() => {
    if (orderType === 'Room Service') {
      setPayMode((m) => (m === 'Room Charge' ? m : 'Room Charge'));
    } else {
      setPayMode((m) => (m === 'Room Charge' ? 'Cash' : m));
    }
    if (orderType !== 'Dine In') setKeepTableOpen(false);
  }, [orderType]);

  const resetBillingState = () => {
    setDiscountEnabled(false);
    setDiscountValue('');
    setDiscountReason('');
    setCouponInput('');
    setAppliedCouponCode('');
    setSettlementEnabled(false);
    setSettlementFinal('');
    setSettlementReason('');
    setGstEnabled(true);
    setCustomerGstin('');
    setCompanyName('');
    setCustomOrderDate(getIstTodayStr());
    const _now = new Date();
    setCustomOrderTime(`${String(_now.getHours()).padStart(2, '0')}:${String(_now.getMinutes()).padStart(2, '0')}`);
    setPayMode('Cash');
    setAmountReceived('');
    setPayReference('');
    setCashTendered('');
    setUpiUtr('');
    setUpiVerified(false);
    setCardLast4('');
    setCardTerminal('');
    setBankName('');
    setBankRef('');
    setHybridRows([
      { id: 'hy1', method: 'Cash', amount: '', reference: '' },
      { id: 'hy2', method: 'UPI', amount: '', reference: '' },
    ]);
    setKeepTableOpen(false);
    setInstructions('');
    setPackagingCharge('');
    setPickupTime('');
    setLinkedAdvanceId('');
    setAdvanceDepositCredit(0);
    setEditingOrder(null);
  };

  const handleLoadOrderIntoTicket = (ord: PosOrderRecord, silentToast?: boolean) => {
    if (ord.kotStatus === 'Cancelled') {
      showToast(`Order ${ord.orderNumber} is cancelled and cannot be edited.`, 'warning');
      return;
    }
    setEditingOrder(ord);
    setOrderType(ord.orderType);
    if (ord.orderType === 'Dine In') {
      setTableNumber(ord.tableNumber || 'T-01');
      setDineInPax(Math.max(1, Number(ord.pax) || 2));
      setWaiterName(ord.waiterName || '');
    } else if (ord.orderType === 'Room Service') {
      const matched =
        bookings.find((b) => b.id === ord.bookingId) ||
        bookings.find((b) => ord.roomNumber && b.roomNumbers.includes(String(ord.roomNumber)));
      if (matched) setSelectedBookingId(matched.id);
    }
    const genericNames = new Set(['Walk-In Diner', 'Takeaway Customer', 'In-House Guest']);
    setCustomerNameInput(ord.customerName && !genericNames.has(ord.customerName) ? ord.customerName : '');
    setCustomerPhoneInput(ord.customerPhone || '');
    setInstructions(ord.instructions || '');
    setPackagingCharge(ord.packagingCharge ?? '');
    setPickupTime(ord.pickupTime || '');
    setLinkedAdvanceId(ord.advanceBookingId || '');
    setAdvanceDepositCredit(Math.max(0, Number(ord.advanceDepositApplied) || 0));
    setGstEnabled(!ord.isWithoutGst);
    setCustomerGstin(ord.customerGstin || '');
    setCompanyName(ord.companyName || '');

    if (ord.discountMeta && ord.discountMeta.amount > 0) {
      setDiscountEnabled(true);
      setDiscountType(ord.discountMeta.type);
      setDiscountValue(ord.discountMeta.value);
      setDiscountReason(ord.discountMeta.reason || '');
      setAppliedCouponCode(ord.discountMeta.couponCode || '');
    } else {
      setDiscountEnabled(false);
      setDiscountValue('');
      setDiscountReason('');
      setAppliedCouponCode('');
    }

    if (ord.settlement) {
      setSettlementEnabled(true);
      setSettlementFinal(ord.settlement.finalAmount);
      setSettlementReason(ord.settlement.reason || '');
    } else {
      setSettlementEnabled(false);
      setSettlementFinal('');
      setSettlementReason('');
    }

    setPayMode(ord.orderType === 'Room Service' ? 'Room Charge' : 'Cash');
    setAmountReceived('');
    setPayReference('');
    setCashTendered('');
    setUpiUtr('');
    setUpiVerified(false);
    setCardLast4('');
    setCardTerminal('');
    setBankName('');
    setBankRef('');

    setCart(
      ord.items.map((it, idx) => {
        const foundMenu = menuItems.find((m) => m.id === it.itemId);
        const cleanBaseName = cleanOrderItemBaseName(it.name, it.variant);
        const baseMenu: PosMenuItem = foundMenu || {
          id: it.itemId,
          code: it.itemId.slice(-4).toUpperCase(),
          name: cleanBaseName,
          category: 'North Indian',
          price: it.menuPrice ?? it.price,
          taxRate: configuredFnbGst,
          isVeg: true,
          available: true,
          kitchenStation: (it.kitchenStation as any) || 'Main Kitchen',
        };
        const { configuredUnitPrice } = getConfiguredMenuUnitPrice(baseMenu, it.variant, it.addons);
        const manuallyOverridden = Math.abs(it.price - configuredUnitPrice) >= 0.005;
        return {
          lineId: `${makeCartLineId(baseMenu.id, it.variant, it.addons)}::edit-${idx}`,
          item: baseMenu,
          qty: it.qty,
          customUnitPrice: manuallyOverridden ? it.price : undefined,
          overrideReason: manuallyOverridden ? it.overrideReason || 'Edited order rate' : undefined,
          variant: it.variant,
          addons: it.addons,
          itemNotes: it.itemNotes,
          itemDiscount: it.itemDiscount,
        };
      })
    );

    if (
      activeSubTab !== 'terminal' &&
      activeSubTab !== 'take_order' &&
      activeSubTab !== 'dashboard'
    ) {
      onSubTabChange('terminal');
    }
    if (!silentToast) {
      showToast(
        `Loaded ${ord.orderNumber}${ord.tableNumber ? ` (Table ${ord.tableNumber})` : ''} into Current POS Order Ticket for editing.`,
        'info'
      );
    }
  };

  const handleCancelEditOrder = (startSupplementaryKot?: boolean) => {
    const prevTbl = tableNumber;
    setCart([]);
    resetBillingState();
    if (startSupplementaryKot) {
      setOrderType('Dine In');
      setTableNumber(prevTbl);
      showToast(`Ready to add Supplementary KOT items on Table ${prevTbl}.`, 'info');
    }
  };

  const buildPayRows = (): PayRow[] => {
    if (payMode === 'Hybrid') {
      return hybridRows
        .filter((r) => (Number(r.amount) || 0) > 0)
        .map((r) => ({
          method: r.method,
          amount: r2(Number(r.amount) || 0),
          reference: r.reference.trim() || r.upiUtr?.trim() || undefined,
          upiUtr: r.method === 'UPI' ? r.upiUtr?.trim() || undefined : undefined,
          verifiedBy: r.method === 'UPI' && r.upiVerified ? loggedInUser : undefined,
          verifiedAt: r.method === 'UPI' && r.upiVerified ? new Date().toISOString() : undefined,
          verificationStatus: r.method === 'UPI' ? (r.upiVerified ? 'verified' : 'unverified') : undefined,
          cardNetwork: r.method === 'Card' ? r.cardNetwork || undefined : undefined,
          cardLast4: r.method === 'Card' ? r.cardLast4?.trim() || undefined : undefined,
          cardTerminal: r.method === 'Card' ? r.cardTerminal?.trim() || undefined : undefined,
          bankName: r.method === 'Bank Transfer' ? r.bankName?.trim() || undefined : undefined,
          bankRef: r.method === 'Bank Transfer' ? r.reference.trim() || undefined : undefined,
        }));
    }
    const amt = amountReceived === '' ? netPayableAfterDeposit : r2(Number(amountReceived) || 0);
    if (amt <= 0) return [];
    if (payMode === 'Cash') {
      const tender = Number(cashTendered) || 0;
      const change = tender > amt ? r2(tender - amt) : 0;
      return [
        {
          method: 'Cash',
          amount: amt,
          cashTendered: tender > 0 ? tender : undefined,
          changeReturned: change > 0 ? change : undefined,
          notes: change > 0 ? `Cash Tendered: ₹${tender}, Change: ₹${change}` : undefined,
        },
      ];
    }
    if (payMode === 'UPI') {
      return [
        {
          method: 'UPI',
          amount: amt,
          reference: upiUtr.trim() || undefined,
          upiUtr: upiUtr.trim() || undefined,
          verifiedBy: upiVerified ? loggedInUser : undefined,
          verifiedAt: upiVerified ? new Date().toISOString() : undefined,
          verificationStatus: upiVerified ? 'verified' : 'unverified',
        },
      ];
    }
    if (payMode === 'Card') {
      return [
        {
          method: 'Card',
          amount: amt,
          reference: cardTerminal.trim() ? `Slip: ${cardTerminal.trim()}` : cardLast4 ? `Card ...${cardLast4}` : undefined,
          cardNetwork,
          cardLast4: cardLast4.trim() || undefined,
          cardTerminal: cardTerminal.trim() || undefined,
        },
      ];
    }
    if (payMode === 'Bank Transfer') {
      return [
        {
          method: 'Bank Transfer',
          amount: amt,
          reference: bankRef.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankRef: bankRef.trim() || undefined,
        },
      ];
    }
    return [{ method: payMode, amount: amt, reference: payReference.trim() || undefined }];
  };

  // Hold current cart without sending KOT to kitchen (NEVER deducts BOM stock until confirmed)
  const handleHoldCurrentOrder = () => {
    if (cart.length === 0) {
      showToast('Add at least one item before holding the order.', 'warning');
      return;
    }
    const orderNum = `HOLD-${Math.floor(10000 + Math.random() * 90000)}`;
    const heldOrd: PosOrderRecord = {
      id: `pos-hold-${Date.now()}`,
      orderNumber: orderNum,
      orderType,
      tableNumber: orderType === 'Dine In' ? tableNumber : undefined,
      roomNumber: orderType === 'Room Service' ? activeBooking?.roomNumbers[0] : undefined,
      pax: orderType === 'Dine In' ? dineInPax : undefined,
      waiterName: waiterName.trim() || undefined,
      customerName:
        orderType === 'Room Service'
          ? activeBooking?.customerName || 'In-House Guest'
          : customerNameInput.trim() || 'Walk-In Guest',
      customerPhone:
        orderType === 'Room Service' ? activeBooking?.mobile || '' : customerPhoneInput.trim(),
      items: cart.map((c) => {
        const { configuredUnitPrice, addonTotal } = getLineConfiguredInfo(c);
        const unit = getEffectiveLineUnitPrice(c);
        const overridden = isCartLinePriceOverridden(c);
        return {
          itemId: c.item.id,
          name: c.item.name,
          qty: c.qty,
          price: unit,
          total: r2(unit * c.qty),
          menuPrice: configuredUnitPrice,
          overrideReason: overridden ? c.overrideReason : undefined,
          variant: c.variant,
          addons: c.addons,
          addonPriceTotal: addonTotal > 0 ? addonTotal : undefined,
          kitchenStation: c.item.kitchenStation || 'Main Kitchen',
          itemNotes: c.itemNotes,
          itemDiscount: c.itemDiscount,
        };
      }),
      subtotal,
      discount: discountAmount,
      packagingCharge: extraPkg > 0 ? extraPkg : undefined,
      taxAmount,
      grandTotal,
      paymentMethod: 'Cash',
      paymentStatus: 'Unpaid',
      kotStatus: 'KOT Sent',
      isHeld: true,
      bomDeducted: false,
      holdNote: instructions.trim() || `Held on ${orderType === 'Dine In' ? `Table ${tableNumber}` : orderType}`,
      dateTime: customOrderDate && customOrderTime ? `${customOrderDate} ${customOrderTime}` : getIstDateTimeStr(),
    };
    onCreatePosOrder(heldOrd);
    setCart([]);
    resetBillingState();
    setLeftColTab('orders');
    showToast(`Order ${orderNum} placed on Hold. Resume it anytime from the Left Orders & Held panel.`, 'success');
  };

  const handleResumeHeldOrder = (held: PosOrderRecord) => {
    setEditingOrder(null);
    setOrderType((held.orderType as any) || 'Dine In');
    if (held.tableNumber) setTableNumber(held.tableNumber);
    if (held.pax) setDineInPax(held.pax);
    if (held.waiterName) setWaiterName(held.waiterName);
    setCustomerNameInput(held.customerName || '');
    setCustomerPhoneInput(held.customerPhone || '');
    setCart(
      held.items.map((it, idx) => {
        const cleanBaseName = cleanOrderItemBaseName(it.name, it.variant);
        const foundMenu = menuItems.find((m) => m.id === it.itemId) || {
          id: it.itemId,
          code: it.itemId.slice(-4).toUpperCase(),
          name: cleanBaseName,
          category: 'North Indian',
          price: it.menuPrice ?? it.price,
          taxRate: configuredFnbGst,
          isVeg: true,
          available: true,
          kitchenStation: (it.kitchenStation as any) || 'Main Kitchen',
        };
        const { configuredUnitPrice } = getConfiguredMenuUnitPrice(foundMenu, it.variant, it.addons);
        const manuallyOverridden = Math.abs(it.price - configuredUnitPrice) >= 0.005;
        return {
          lineId: `${makeCartLineId(foundMenu.id, it.variant, it.addons)}::resume-${idx}`,
          item: foundMenu,
          qty: it.qty,
          customUnitPrice: manuallyOverridden ? it.price : undefined,
          overrideReason: manuallyOverridden ? it.overrideReason : undefined,
          variant: it.variant,
          addons: it.addons,
          itemNotes: it.itemNotes,
          itemDiscount: it.itemDiscount,
        };
      })
    );
    if (onUpdatePosOrder) {
      onUpdatePosOrder({ ...held, isHeld: false, kotStatus: 'Cancelled', voidReason: 'Resumed into active cart' });
    }
    showToast(`Resumed Held Order ${held.orderNumber} into active cart.`, 'success');
  };

  // Convert Advance Restaurant Booking into live order (carries forward deposit & table!)
  const handleConvertAdvanceToLive = (adv: FoodAdvanceBooking) => {
    setEditingOrder(null);
    const tbl = (adv as any).tableNumber || 'T-01';
    setOrderType('Dine In');
    setTableNumber(tbl);
    setDineInPax(Math.max(1, Number(adv.pax) || 2));
    setCustomerNameInput(adv.guestOrGroupName || '');
    setCustomerPhoneInput(adv.mobile || '');
    setLinkedAdvanceId(adv.id);
    setAdvanceDepositCredit(Math.max(0, Number(adv.advanceAmount) || 0));
    setInstructions(adv.specialRequest || '');
    const billablePax = Math.max(1, (Number(adv.pax) || 1) - (Number(adv.focPax) || 0));
    const rate = Number(adv.ratePerPax) || 0;
    if (rate > 0) {
      const synthItem: PosMenuItem = {
        id: `adv-pkg-${adv.id}`,
        code: 'ADV-PKG',
        name: `${(adv.meals || ['Meal']).join('/')} — ${adv.menuCuisine || 'Advance Package'}`,
        category: 'Buffet / Package',
        price: rate,
        taxRate: configuredFnbGst,
        isVeg: !(adv.mealTypes || []).includes('Non-Veg'),
        available: true,
        kitchenStation: 'Main Kitchen',
      };
      setCart([{ lineId: `${makeCartLineId(synthItem.id)}::adv`, item: synthItem, qty: billablePax }]);
    }
    if (onUpdatePosAdvanceBookings) {
      onUpdatePosAdvanceBookings(
        posAdvanceBookings.map((b) => (b.id === adv.id ? { ...b, status: 'In Process' } : b))
      );
    }
    showToast(
      `Seated ${adv.guestOrGroupName} at Table ${tbl} (${adv.pax} Pax). Advance deposit ₹${adv.advanceAmount || 0} carried forward! Review items and click Send KOT when ready.`,
      'success'
    );
  };

  const handleFinalizeOrder = (
    actionLabel: 'Print' | 'KOT' | 'KOT + Invoice' | 'Save' | 'KOT_OPEN' | 'UPDATE_ONLY'
  ) => {
    if (cart.length === 0 || isSubmittingRef.current) return;
    const isRoomService = orderType === 'Room Service';
    const roomOk = Boolean(activeBooking && activeBooking.isCheckedIn && !activeBooking.isCheckedOut);
    if (isRoomService && !roomOk) {
      showToast('Room Service can only be posted to an occupied room with a checked-in guest. Please select a valid in-house room.', 'error');
      return;
    }
    if (orderType === 'Takeaway' && !customerNameInput.trim()) {
      showToast('Please enter Customer Name for the Takeaway order.', 'warning');
      return;
    }

    // Price overrides: ONLY when customUnitPrice manually differs from configured portion + add-on price!
    const overriddenLines = cart.filter((c) => isCartLinePriceOverridden(c));
    if (overriddenLines.length > 0) {
      if (!canOverrideItemPrice) {
        showToast('Authorised staff permission is required to change an item selling price.', 'error');
        return;
      }
      const missing = overriddenLines.find((c) => !String(c.overrideReason || '').trim());
      if (missing) {
        showToast(`Please enter a reason for the custom price on "${missing.item.name}".`, 'warning');
        return;
      }
    }
    if ((discountEnabled && bill.discountEntered > 0) || itemLevelDiscountSum > 0) {
      if (!canApprove && !appliedCouponCode) {
        showToast('Manager approval is required to apply a discount.', 'error');
        return;
      }
      if (discountEnabled && !discountReason.trim() && !appliedCouponCode) {
        showToast('Please enter a reason for the discount.', 'warning');
        return;
      }
    }
    if (settlementEnabled && bill.settlementApplied) {
      if (!canApprove) {
        showToast('Manager approval is required for a negotiated settlement.', 'error');
        return;
      }
      if (!settlementReason.trim()) {
        showToast('Please enter a reason for the negotiated settlement.', 'warning');
        return;
      }
    }
    if (settlementEnabled && settlementFinal !== '' && !bill.settlementApplied) {
      showToast('Negotiated settlement must be lower than the bill total and not negative.', 'warning');
      return;
    }

    // =========================================================================
    // UPDATE EXISTING ORDER IN-PLACE WHEN editingOrder IS ACTIVE
    // =========================================================================
    if (editingOrder) {
      const noNewPaymentNow = actionLabel === 'UPDATE_ONLY' || actionLabel === 'KOT_OPEN';
      const isRoomPostEdit =
        isRoomService &&
        (noNewPaymentNow
          ? editingOrder.paymentStatus === 'Unpaid (Room Folio)' || editingOrder.paymentMethod === 'Room Charge'
          : payMode === 'Room Charge');
      const keepOpenEdit =
        noNewPaymentNow ||
        (orderType === 'Dine In' && keepTableOpen) ||
        netPayableAfterDeposit <= 0.005;

      if (!isRoomPostEdit && !keepOpenEdit && payMode === 'UPI' && !upiVerified) {
        showToast(
          'UPI payment requires manual verification by staff. Please confirm receipt and check "Verified", or click "Update Order" to save without recording payment.',
          'warning'
        );
        return;
      }

      const newRows: PayRow[] = isRoomPostEdit || keepOpenEdit ? [] : buildPayRows();
      if (!isRoomPostEdit && !keepOpenEdit && payMode === 'Hybrid') {
        if (newRows.length < 2) {
          showToast('Hybrid payment needs at least two payment methods with amounts greater than ₹0.', 'warning');
          return;
        }
        const unverifiedUpiRow = newRows.find((r) => r.method === 'UPI' && r.verificationStatus !== 'verified');
        if (unverifiedUpiRow) {
          showToast('UPI split payment entry is not verified. Please confirm receipt and check "Verified".', 'warning');
          return;
        }
      }

      const receivedNowEdit = sumPayRows(newRows);
      const totalPaidAfterEdit = r2(alreadyPaidOnEditingOrder + advanceDepositCredit + receivedNowEdit);
      if (!noNewPaymentNow && receivedNowEdit > 0 && totalPaidAfterEdit > grandTotal + 0.5) {
        showToast(
          `Total paid (₹${totalPaidAfterEdit}) cannot exceed updated bill total (₹${grandTotal}).`,
          'error'
        );
        return;
      }

      isSubmittingRef.current = true;
      try {
        const nowIso = new Date().toISOString();
        const prevPayments = editingOrder.payments || [];
        const appendedPayments = [
          ...prevPayments,
          ...newRows.map((r, i) => ({
            id: `PAY-${editingOrder.id}-${prevPayments.length + i + 1}`,
            method: r.method,
            amount: r.amount,
            reference: r.reference,
            time: nowIso,
            staff: loggedInUser,
            upiUtr: r.upiUtr,
            verifiedBy: r.verifiedBy,
            verifiedAt: r.verifiedAt,
            verificationStatus: r.verificationStatus,
            cardNetwork: r.cardNetwork,
            cardLast4: r.cardLast4,
            cardTerminal: r.cardTerminal,
            bankName: r.bankName,
            bankRef: r.bankRef,
            cashTendered: r.cashTendered,
            changeReturned: r.changeReturned,
            notes: r.notes,
          })),
        ];

        const payStatusEdit = isRoomPostEdit
          ? 'Unpaid (Room Folio)'
          : resolvePayStatus(grandTotal, totalPaidAfterEdit);
        const balanceDueEdit = isRoomPostEdit
          ? grandTotal
          : r2(Math.max(0, grandTotal - totalPaidAfterEdit));
        const isOpenCheckEdit = orderType === 'Dine In' && balanceDueEdit > 0.5;
        const legacyMethodEdit = (
          isRoomPostEdit
            ? 'Room Charge'
            : newRows.length > 0
            ? dominantMethod(newRows)
            : editingOrder.paymentMethod || 'Cash'
        ) as PaymentMethod;
        const summaryEdit = isRoomPostEdit
          ? 'Posted to Room Folio'
          : appendedPayments.length > 0
          ? appendedPayments.map((p) => `${p.method} ₹${p.amount}`).join(' + ')
          : 'Unpaid';

        const priceOverridesEdit = overriddenLines.map((c) => {
          const { configuredUnitPrice } = getLineConfiguredInfo(c);
          return {
            itemId: c.item.id,
            name: c.variant ? `${c.item.name} (${c.variant})` : c.item.name,
            originalPrice: configuredUnitPrice,
            newPrice: getEffectiveLineUnitPrice(c),
            reason: String(c.overrideReason || '').trim(),
            by: loggedInUser,
            at: nowIso,
          };
        });

        const updatedItems = cart.map((c) => {
          const { configuredUnitPrice, addonTotal } = getLineConfiguredInfo(c);
          const unit = getEffectiveLineUnitPrice(c);
          const overridden = isCartLinePriceOverridden(c);
          const prevLine = editingOrder.items.find(
            (oldIt) => oldIt.itemId === c.item.id && (oldIt.variant || '') === (c.variant || '')
          );
          return {
            itemId: c.item.id,
            name: c.item.name,
            qty: c.qty,
            price: unit,
            total: r2(unit * c.qty),
            menuPrice: configuredUnitPrice,
            overrideReason: overridden ? String(c.overrideReason || '').trim() : undefined,
            variant: c.variant,
            addons: c.addons,
            addonPriceTotal: addonTotal > 0 ? addonTotal : undefined,
            kitchenStation: c.item.kitchenStation || 'Main Kitchen',
            itemNotes: c.itemNotes,
            itemDiscount: c.itemDiscount,
            itemStatus:
              prevLine && c.qty <= prevLine.qty
                ? prevLine.itemStatus || 'KOT Sent'
                : 'KOT Sent',
          };
        });

        const hasUnservedAfterEdit = updatedItems.some((i) => i.itemStatus !== 'Served');
        const nextKotStatus =
          editingOrder.kotStatus === 'Served' && hasUnservedAfterEdit
            ? 'Preparing'
            : editingOrder.kotStatus;

        // Recompute BOM snapshot for updated cart (4-decimal precision)
        const updatedBomMap = new Map<
          string,
          { inventoryItemId: string; ingredientName: string; deductedQty: number; unit: string }
        >();
        cart.forEach((ci) => {
          if (ci.item.recipeIngredients && ci.item.recipeIngredients.length > 0) {
            ci.item.recipeIngredients.forEach((ing) => {
              const reqQty = r4(ing.quantity * ci.qty);
              if (reqQty > 0) {
                const prev = updatedBomMap.get(ing.inventoryItemId);
                updatedBomMap.set(ing.inventoryItemId, {
                  inventoryItemId: ing.inventoryItemId,
                  ingredientName: ing.ingredientName,
                  deductedQty: r4((prev?.deductedQty || 0) + reqQty),
                  unit: ing.unit,
                });
              }
            });
          }
        });
        const updatedBomSnapshot = Array.from(updatedBomMap.values());

        const updatedOrder: PosOrderRecord = {
          ...editingOrder,
          orderType,
          roomNumber: isRoomService ? activeBooking?.roomNumbers[0] : undefined,
          roomName: isRoomService ? `Room ${activeBooking?.roomNumbers[0]}` : undefined,
          bookingId: isRoomPostEdit ? activeBooking?.id : undefined,
          tableNumber: orderType === 'Dine In' ? tableNumber : undefined,
          pax: orderType === 'Dine In' ? dineInPax : undefined,
          waiterName: waiterName.trim() || undefined,
          customerName: isRoomService
            ? activeBooking?.customerName || 'In-House Guest'
            : customerNameInput.trim() ||
              companyName.trim() ||
              (orderType === 'Takeaway' ? 'Takeaway Customer' : 'Walk-In Diner'),
          customerPhone: isRoomService ? activeBooking?.mobile || '' : customerPhoneInput.trim(),
          items: updatedItems,
          subtotal,
          discount: discountAmount,
          packagingCharge: extraPkg > 0 ? extraPkg : undefined,
          taxAmount,
          grandTotal,
          paymentMethod: legacyMethodEdit,
          paymentStatus: payStatusEdit,
          kotStatus: nextKotStatus,
          instructions,
          payments: appendedPayments,
          amountPaid: isRoomPostEdit ? 0 : Math.min(grandTotal, totalPaidAfterEdit),
          balanceDue: balanceDueEdit,
          paymentSummary: summaryEdit,
          isOpenCheck: isOpenCheckEdit,
          pickupTime: orderType === 'Takeaway' ? pickupTime || undefined : undefined,
          isWithoutGst: !gstEnabled,
          gstRate: effectiveGstPct,
          customerGstin: customerGstin.trim() || undefined,
          companyName: companyName.trim() || undefined,
          discountMeta:
            (discountEnabled && bill.discountEntered > 0) || itemLevelDiscountSum > 0
              ? {
                  type: discountType,
                  value: Number(discountValue) || itemLevelDiscountSum,
                  amount: bill.discountEntered,
                  couponCode: appliedCouponCode || undefined,
                  reason:
                    discountReason.trim() ||
                    (appliedCouponCode ? `Coupon ${appliedCouponCode}` : 'Item Discount'),
                  by: loggedInUser,
                  at: nowIso,
                }
              : undefined,
          settlement: bill.settlementApplied
            ? {
                originalAmount: bill.grandBeforeSettlement,
                finalAmount: bill.payable,
                adjustment: bill.settlementAdjustment,
                reason: settlementReason.trim(),
                authorisedBy: loggedInUser,
                at: nowIso,
              }
            : undefined,
          priceOverrides: priceOverridesEdit.length > 0 ? priceOverridesEdit : undefined,
          bomDeducted: updatedBomSnapshot.length > 0 || Boolean(editingOrder.bomDeducted),
          bomDeductionSnapshot: updatedBomSnapshot.length > 0 ? updatedBomSnapshot : undefined,
        };

        // Adjust Recipe BOM raw ingredient delta (newQty - oldQty, 4-decimal precision)
        if (onRecordStockMovement) {
          const oldQtyByItem = new Map<string, number>();
          editingOrder.items.forEach((oi) => {
            oldQtyByItem.set(oi.itemId, (oldQtyByItem.get(oi.itemId) || 0) + oi.qty);
          });
          const newQtyByItem = new Map<string, number>();
          cart.forEach((ci) => {
            newQtyByItem.set(ci.item.id, (newQtyByItem.get(ci.item.id) || 0) + ci.qty);
          });
          const allIds = new Set([...oldQtyByItem.keys(), ...newQtyByItem.keys()]);
          allIds.forEach((mId) => {
            const delta = (newQtyByItem.get(mId) || 0) - (oldQtyByItem.get(mId) || 0);
            if (delta === 0) return;
            const mObj = menuItems.find((m) => m.id === mId);
            if (mObj?.recipeIngredients && mObj.recipeIngredients.length > 0) {
              mObj.recipeIngredients.forEach((ing) => {
                const diffAmt = r4(Math.abs(delta) * ing.quantity);
                if (diffAmt > 0) {
                  onRecordStockMovement(
                    ing.inventoryItemId,
                    delta > 0 ? 'OUT' : 'IN',
                    diffAmt,
                    'Restaurant Kitchen',
                    `POS Order Edited ${editingOrder.orderNumber} (${mObj.name} ${delta > 0 ? `+${delta}` : delta})`
                  );
                }
              });
            }
          });
        }

        if (onUpdatePosOrder) onUpdatePosOrder(updatedOrder);
        broadcastPosEvent('ORDER_UPDATED', {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
        });

        if (onAddAuditLog) {
          priceOverridesEdit.forEach((po) =>
            onAddAuditLog(
              'POS Item Price Override',
              `${po.name}: Original ₹${po.originalPrice} → Custom ₹${po.newPrice} on order ${updatedOrder.orderNumber} by ${po.by} (${currentRole}). Reason: ${po.reason}`
            )
          );
          onAddAuditLog(
            'POS Order Edited',
            `Order ${updatedOrder.orderNumber} (${updatedOrder.tableNumber ? `Table ${updatedOrder.tableNumber}` : updatedOrder.orderType}) updated by ${loggedInUser} — Total ₹${updatedOrder.grandTotal}, Due ₹${updatedOrder.balanceDue}.`
          );
        }

        if ((actionLabel === 'KOT_OPEN' || actionLabel === 'KOT') && posCapabilities.kotEnabled) {
          setPrintingKotOrder({ order: updatedOrder, isReprint: false });
        } else if (actionLabel === 'Print' || actionLabel === 'KOT + Invoice') {
          setPrintingFoodOrder(updatedOrder);
        }

        showToast(
          `Order ${updatedOrder.orderNumber} updated! Total: ${formatCurrency(updatedOrder.grandTotal)}${
            updatedOrder.balanceDue ? ` (Due: ${formatCurrency(updatedOrder.balanceDue)})` : ' (Paid)'
          }`,
          'success'
        );
        setCart([]);
        resetBillingState();
        setShowAdditionalModal(false);
      } finally {
        isSubmittingRef.current = false;
      }
      return;
    }

    const forceKeepOpen = actionLabel === 'KOT_OPEN';
    const isRoomPost = isRoomService && payMode === 'Room Charge' && !forceKeepOpen;
    const keepOpen = (orderType === 'Dine In' && (keepTableOpen || forceKeepOpen)) || (isRoomService && forceKeepOpen);

    // UPI manual verification safeguard: never mark paid unless explicitly verified!
    if (!isRoomPost && !keepOpen && payMode === 'UPI' && !upiVerified) {
      showToast('UPI payment requires manual verification by staff. Please confirm receipt on merchant soundbox/bank app and check "Verified", or keep the check open as Unpaid/Pending.', 'warning');
      return;
    }

    const rows: PayRow[] = isRoomPost || keepOpen ? [] : buildPayRows();
    if (!isRoomPost && !keepOpen && payMode === 'Hybrid') {
      if (rows.length < 2) {
        showToast('Hybrid payment needs at least two payment methods with amounts greater than ₹0.', 'warning');
        return;
      }
      const unverifiedUpiRow = rows.find((r) => r.method === 'UPI' && r.verificationStatus !== 'verified');
      if (unverifiedUpiRow) {
        showToast('UPI split payment entry is not verified. Please confirm receipt and check "Verified" before completing payment.', 'warning');
        return;
      }
    }
    const receivedNow = sumPayRows(rows);
    const totalReceivedWithDeposit = r2(receivedNow + advanceDepositCredit);
    if (totalReceivedWithDeposit > grandTotal + 0.5) {
      showToast(`Total received + deposit (₹${totalReceivedWithDeposit}) cannot exceed the payable bill (₹${grandTotal}).`, 'error');
      return;
    }

    isSubmittingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const existingNums = new Set(orders.map((o) => o.orderNumber));
      let orderNum = `POS-${Math.floor(10000 + Math.random() * 90000)}`;
      while (existingNums.has(orderNum)) orderNum = `POS-${Math.floor(10000 + Math.random() * 90000)}`;
      const orderId = `pos-${Date.now()}`;

      const payStatus = isRoomPost ? 'Unpaid (Room Folio)' : resolvePayStatus(grandTotal, totalReceivedWithDeposit);
      const balanceDue = isRoomPost ? grandTotal : r2(Math.max(0, grandTotal - totalReceivedWithDeposit));
      const isOpenCheck = orderType === 'Dine In' && balanceDue > 0.5;
      const checkId = openCheckForCurrentTable
        ? openCheckForCurrentTable.orders[0].checkId || openCheckForCurrentTable.orders[0].id
        : `CHK-${Date.now()}`;
      const isSupplementary = Boolean(openCheckForCurrentTable);
      const kotNumber = `KOT-${(openCheckForCurrentTable ? openCheckForCurrentTable.orders.length + 1 : 1)}-${orderNum.replace('POS-', '')}`;

      const payments = [
        ...(advanceDepositCredit > 0
          ? [
              {
                id: `PAY-${orderId}-ADV`,
                method: 'Advance Deposit',
                amount: advanceDepositCredit,
                reference: linkedAdvanceId || 'Advance Booking Deposit',
                time: nowIso,
                staff: loggedInUser,
              },
            ]
          : []),
        ...rows.map((r, i) => ({
          id: `PAY-${orderId}-${i + 1}`,
          method: r.method,
          amount: r.amount,
          reference: r.reference,
          time: nowIso,
          staff: loggedInUser,
          upiUtr: r.upiUtr,
          verifiedBy: r.verifiedBy,
          verifiedAt: r.verifiedAt,
          verificationStatus: r.verificationStatus,
          cardNetwork: r.cardNetwork,
          cardLast4: r.cardLast4,
          cardTerminal: r.cardTerminal,
          bankName: r.bankName,
          bankRef: r.bankRef,
          cashTendered: r.cashTendered,
          changeReturned: r.changeReturned,
          notes: r.notes,
        })),
      ];
      const legacyMethod = (
        isRoomPost ? 'Room Charge' : rows.length > 0 ? dominantMethod(rows) : 'Cash'
      ) as PaymentMethod;
      const summary = isRoomPost
        ? 'Posted to Room Folio'
        : payments.length > 0
        ? payments.map((r) => `${r.method} ₹${r.amount}`).join(' + ')
        : 'Unpaid';

      const priceOverrides = overriddenLines.map((c) => {
        const { configuredUnitPrice } = getLineConfiguredInfo(c);
        return {
          itemId: c.item.id,
          name: c.variant ? `${c.item.name} (${c.variant})` : c.item.name,
          originalPrice: configuredUnitPrice,
          newPrice: getEffectiveLineUnitPrice(c),
          reason: String(c.overrideReason || '').trim(),
          by: loggedInUser,
          at: nowIso,
        };
      });

      // Build exact 4-decimal BOM deduction snapshot for confirmed order
      const bomSnapshotMap = new Map<
        string,
        { inventoryItemId: string; ingredientName: string; deductedQty: number; unit: string }
      >();
      cart.forEach((c) => {
        if (c.item.recipeIngredients && c.item.recipeIngredients.length > 0) {
          c.item.recipeIngredients.forEach((ing) => {
            const reqQty = r4(ing.quantity * c.qty);
            if (reqQty > 0) {
              const prev = bomSnapshotMap.get(ing.inventoryItemId);
              bomSnapshotMap.set(ing.inventoryItemId, {
                inventoryItemId: ing.inventoryItemId,
                ingredientName: ing.ingredientName,
                deductedQty: r4((prev?.deductedQty || 0) + reqQty),
                unit: ing.unit,
              });
            }
          });
        }
      });
      const bomDeductionSnapshot = Array.from(bomSnapshotMap.values());

      const newOrder: PosOrderRecord = {
        id: orderId,
        orderNumber: orderNum,
        orderType,
        roomNumber: isRoomService ? activeBooking?.roomNumbers[0] : undefined,
        roomName: isRoomService ? `Room ${activeBooking?.roomNumbers[0]}` : undefined,
        bookingId: isRoomPost ? activeBooking?.id : undefined,
        tableNumber: orderType === 'Dine In' ? tableNumber : undefined,
        pax: orderType === 'Dine In' ? dineInPax : undefined,
        waiterName: waiterName.trim() || undefined,
        customerName: isRoomService
          ? activeBooking?.customerName || 'In-House Guest'
          : customerNameInput.trim() || companyName.trim() || (orderType === 'Takeaway' ? 'Takeaway Customer' : 'Walk-In Diner'),
        customerPhone: isRoomService ? activeBooking?.mobile || '' : customerPhoneInput.trim(),
        items: cart.map((c) => {
          const { configuredUnitPrice, addonTotal } = getLineConfiguredInfo(c);
          const unit = getEffectiveLineUnitPrice(c);
          const overridden = isCartLinePriceOverridden(c);
          return {
            itemId: c.item.id,
            name: c.item.name,
            qty: c.qty,
            price: unit,
            total: r2(unit * c.qty),
            menuPrice: configuredUnitPrice,
            overrideReason: overridden ? String(c.overrideReason || '').trim() : undefined,
            variant: c.variant,
            addons: c.addons,
            addonPriceTotal: addonTotal > 0 ? addonTotal : undefined,
            kitchenStation: c.item.kitchenStation || 'Main Kitchen',
            itemNotes: c.itemNotes,
            itemDiscount: c.itemDiscount,
            itemStatus: 'KOT Sent',
          };
        }),
        subtotal,
        discount: discountAmount,
        packagingCharge: extraPkg > 0 ? extraPkg : undefined,
        taxAmount,
        grandTotal,
        paymentMethod: legacyMethod,
        paymentStatus: payStatus,
        kotStatus: 'KOT Sent',
        instructions,
        dateTime: customOrderDate && customOrderTime ? `${customOrderDate} ${customOrderTime}` : getIstDateTimeStr(),
        payments,
        amountPaid: isRoomPost ? 0 : totalReceivedWithDeposit,
        balanceDue,
        paymentSummary: summary,
        isOpenCheck,
        checkId: orderType === 'Dine In' ? checkId : undefined,
        kotNumber,
        isSupplementaryKot: isSupplementary,
        pickupTime: orderType === 'Takeaway' ? pickupTime || undefined : undefined,
        pickupStatus: orderType === 'Takeaway' ? 'Preparing' : undefined,
        advanceBookingId: linkedAdvanceId || undefined,
        advanceDepositApplied: advanceDepositCredit > 0 ? advanceDepositCredit : undefined,
        isWithoutGst: !gstEnabled,
        gstRate: effectiveGstPct,
        customerGstin: customerGstin.trim() || undefined,
        companyName: companyName.trim() || undefined,
        discountMeta:
          (discountEnabled && bill.discountEntered > 0) || itemLevelDiscountSum > 0
            ? {
                type: discountType,
                value: Number(discountValue) || itemLevelDiscountSum,
                amount: bill.discountEntered,
                couponCode: appliedCouponCode || undefined,
                reason: discountReason.trim() || (appliedCouponCode ? `Coupon ${appliedCouponCode}` : 'Item Discount'),
                by: loggedInUser,
                at: nowIso,
              }
            : undefined,
        settlement: bill.settlementApplied
          ? {
              originalAmount: bill.grandBeforeSettlement,
              finalAmount: bill.payable,
              adjustment: bill.settlementAdjustment,
              reason: settlementReason.trim(),
              authorisedBy: loggedInUser,
              at: nowIso,
            }
          : undefined,
        priceOverrides: priceOverrides.length > 0 ? priceOverrides : undefined,
        bomDeducted: bomDeductionSnapshot.length > 0,
        bomDeductionSnapshot: bomDeductionSnapshot.length > 0 ? bomDeductionSnapshot : undefined,
      };

      onCreatePosOrder(newOrder, isRoomPost ? activeBooking?.id : undefined);

      // Deduct product stock if stockTracking is enabled on any ordered menu item
      if (onUpdateMenuItem) {
        const qtyByItem = new Map<string, { item: PosMenuItem; qty: number }>();
        cart.forEach((c) => {
          const prev = qtyByItem.get(c.item.id);
          qtyByItem.set(c.item.id, { item: c.item, qty: (prev?.qty || 0) + c.qty });
        });
        qtyByItem.forEach(({ item, qty }) => {
          if (item.stockTracking && item.currentStock !== undefined) {
            const nextStock = Math.max(0, Number(item.currentStock) - qty);
            onUpdateMenuItem({
              ...item,
              currentStock: nextStock,
              available: nextStock > 0,
            });
          }
        });
      }

      // Deduct warehouse inventory raw materials ONLY on confirmed order creation (4-decimal exact precision)
      if (onRecordStockMovement && bomDeductionSnapshot.length > 0) {
        bomDeductionSnapshot.forEach((snap) => {
          onRecordStockMovement(
            snap.inventoryItemId,
            'OUT',
            snap.deductedQty,
            'Restaurant Kitchen',
            `POS Order ${orderNum} (${snap.ingredientName} ${snap.deductedQty} ${snap.unit})`
          );
        });
      }

      // Multi-device sync broadcast
      broadcastPosEvent('ORDER_CREATED', { orderId: newOrder.id, orderNumber: newOrder.orderNumber });

      // Mark linked Advance Booking as Completed / Converted
      if (linkedAdvanceId && onUpdatePosAdvanceBookings) {
        onUpdatePosAdvanceBookings(
          posAdvanceBookings.map((b) =>
            b.id === linkedAdvanceId ? { ...b, convertedPosOrderId: orderId, status: 'Completed' } : b
          )
        );
      }

      if (onAddAuditLog) {
        priceOverrides.forEach((po) =>
          onAddAuditLog(
            'POS Item Price Override',
            `${po.name}: Original ₹${po.originalPrice} → Custom ₹${po.newPrice} on order ${orderNum} by ${po.by} (${currentRole}). Reason: ${po.reason}`
          )
        );
        if (newOrder.discountMeta) {
          onAddAuditLog(
            'POS Discount Applied',
            `Order ${orderNum}: ₹${newOrder.discountMeta.amount} by ${loggedInUser}. Reason: ${newOrder.discountMeta.reason}`
          );
        }
        if (newOrder.settlement) {
          onAddAuditLog(
            'POS Negotiated Settlement',
            `Order ${orderNum}: ₹${newOrder.settlement.originalAmount} → ₹${newOrder.settlement.finalAmount} (adjustment ₹${newOrder.settlement.adjustment}) authorised by ${loggedInUser}. Reason: ${newOrder.settlement.reason}`
          );
        }
        if (isSupplementary && posCapabilities.kotEnabled) {
          onAddAuditLog('POS Supplementary KOT', `Table ${tableNumber}: ${kotNumber} created for check ${checkId} (new items only).`);
        }
      }

      if ((actionLabel === 'KOT_OPEN' || actionLabel === 'KOT') && posCapabilities.kotEnabled) {
        setPrintingKotOrder({ order: newOrder, isReprint: false });
      } else if (actionLabel === 'Print' || actionLabel === 'KOT + Invoice') {
        setPrintingFoodOrder(newOrder);
      }

      showToast(
        isRoomPost
          ? `Order ${orderNum} posted to Room ${activeBooking?.roomNumbers[0]} folio.`
          : isOpenCheck
          ? `${isSupplementary ? 'Supplementary ' : ''}${kotNumber} sent to Kitchen! Table ${tableNumber} check stays open (due ₹${balanceDue}).`
          : payStatus === 'Partially Paid'
          ? `Order ${orderNum} saved — ₹${totalReceivedWithDeposit} received, balance ₹${balanceDue}.`
          : `Order ${orderNum} saved & paid (${summary}).`,
        'success'
      );
      setCart([]);
      resetBillingState();
      setShowAdditionalModal(false);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const settleGroup = openChecks.find((g) => g.table === settleTable);
  const buildSettleRows = (due: number): PayRow[] => {
    if (settleMode === 'Hybrid') {
      return settleRows
        .filter((r) => (Number(r.amount) || 0) > 0)
        .map((r) => ({
          method: r.method,
          amount: r2(Number(r.amount) || 0),
          reference: r.reference.trim() || r.upiUtr?.trim() || undefined,
          upiUtr: r.method === 'UPI' ? r.upiUtr?.trim() || undefined : undefined,
          verifiedBy: r.method === 'UPI' && r.upiVerified ? loggedInUser : undefined,
          verifiedAt: r.method === 'UPI' && r.upiVerified ? new Date().toISOString() : undefined,
          verificationStatus: r.method === 'UPI' ? (r.upiVerified ? 'verified' : 'unverified') : undefined,
          cardNetwork: r.method === 'Card' ? r.cardNetwork || undefined : undefined,
          cardLast4: r.method === 'Card' ? r.cardLast4?.trim() || undefined : undefined,
          cardTerminal: r.method === 'Card' ? r.cardTerminal?.trim() || undefined : undefined,
          bankName: r.method === 'Bank Transfer' ? r.bankName?.trim() || undefined : undefined,
          bankRef: r.method === 'Bank Transfer' ? r.reference.trim() || undefined : undefined,
        }));
    }
    const amt = settleAmount === '' ? due : r2(Number(settleAmount) || 0);
    if (amt <= 0) return [];
    if (settleMode === 'Cash') {
      const tender = Number(settleCashTendered) || 0;
      const change = tender > amt ? r2(tender - amt) : 0;
      return [
        {
          method: 'Cash',
          amount: amt,
          cashTendered: tender > 0 ? tender : undefined,
          changeReturned: change > 0 ? change : undefined,
          notes: change > 0 ? `Tendered: ₹${tender}, Change: ₹${change}` : undefined,
        },
      ];
    }
    if (settleMode === 'UPI') {
      return [
        {
          method: 'UPI',
          amount: amt,
          reference: settleUpiUtr.trim() || undefined,
          upiUtr: settleUpiUtr.trim() || undefined,
          verifiedBy: settleUpiVerified ? loggedInUser : undefined,
          verifiedAt: settleUpiVerified ? new Date().toISOString() : undefined,
          verificationStatus: settleUpiVerified ? 'verified' : 'unverified',
        },
      ];
    }
    if (settleMode === 'Card') {
      return [
        {
          method: 'Card',
          amount: amt,
          reference: settleCardTerminal.trim() ? `Slip: ${settleCardTerminal.trim()}` : settleCardLast4 ? `Card ...${settleCardLast4}` : undefined,
          cardNetwork: settleCardNetwork,
          cardLast4: settleCardLast4.trim() || undefined,
          cardTerminal: settleCardTerminal.trim() || undefined,
        },
      ];
    }
    if (settleMode === 'Bank Transfer') {
      return [
        {
          method: 'Bank Transfer',
          amount: amt,
          reference: settleBankRef.trim() || undefined,
          bankName: settleBankName.trim() || undefined,
          bankRef: settleBankRef.trim() || undefined,
        },
      ];
    }
    return [{ method: settleMode, amount: amt, reference: settleRef.trim() || undefined }];
  };

  const handleSettleTable = () => {
    if (!settleGroup || isSubmittingRef.current) return;
    const rows = buildSettleRows(settleGroup.due);
    if (settleMode === 'Hybrid' && rows.length < 2) {
      showToast('Hybrid payment needs at least two payment methods with amounts greater than ₹0.', 'warning');
      return;
    }
    if (settleMode === 'UPI' && !settleUpiVerified) {
      showToast('UPI payments require authorised staff verification. Please verify receipt on merchant soundbox/bank app.', 'warning');
      return;
    }
    const received = sumPayRows(rows);
    if (received <= 0) {
      showToast('Enter the amount received to settle this table.', 'warning');
      return;
    }
    if (received > settleGroup.due + 0.5) {
      showToast(`Received amount (₹${received}) cannot exceed the outstanding bill (₹${settleGroup.due}).`, 'error');
      return;
    }
    isSubmittingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const { byOrder } = allocatePayRows(
        settleGroup.orders.map((o) => ({ id: o.id, due: Number(o.balanceDue ?? o.grandTotal) || 0 })),
        rows
      );
      const updates = settleGroup.orders.map((o) => {
        const slices = byOrder[o.id] || [];
        const newPays = slices.map((sl, i) => ({
          id: `PAY-${o.id}-${Date.now()}-${i + 1}`,
          method: sl.method,
          amount: sl.amount,
          reference: sl.reference,
          time: nowIso,
          staff: loggedInUser,
          upiUtr: sl.upiUtr,
          verifiedBy: sl.verifiedBy,
          verifiedAt: sl.verifiedAt,
          verificationStatus: sl.verificationStatus,
          cardNetwork: sl.cardNetwork,
          cardLast4: sl.cardLast4,
          cardTerminal: sl.cardTerminal,
          bankName: sl.bankName,
          bankRef: sl.bankRef,
          cashTendered: sl.cashTendered,
          changeReturned: sl.changeReturned,
          notes: sl.notes,
        }));
        const allPays = [...(o.payments || []), ...newPays];
        const paidTotal = r2(allPays.reduce((s, p) => s + (Number(p.amount) || 0), 0));
        const balance = r2(Math.max(0, (Number(o.grandTotal) || 0) - paidTotal));
        return {
          id: o.id,
          payments: allPays,
          amountPaid: paidTotal,
          balanceDue: balance,
          paymentStatus: resolvePayStatus(Number(o.grandTotal) || 0, paidTotal),
          paymentMethod: (allPays.length > 0 ? dominantMethod(allPays.map((p) => ({ method: p.method, amount: p.amount }))) : 'Cash') as PaymentMethod,
          paymentSummary: allPays.map((p) => `${p.method} ₹${p.amount}`).join(' + '),
        };
      });
      if (onSettlePosOrders) onSettlePosOrders(updates);

      const first = settleGroup.orders[0];
      const consolidated: PosOrderRecord = {
        ...first,
        orderNumber: settleGroup.orders.length > 1 ? `${first.orderNumber} (+${settleGroup.orders.length - 1} KOT)` : first.orderNumber,
        items: settleGroup.orders.flatMap((o) => o.items),
        subtotal: r2(settleGroup.orders.reduce((s, o) => s + (Number(o.subtotal) || 0), 0)),
        discount: r2(settleGroup.orders.reduce((s, o) => s + (Number(o.discount) || 0), 0)),
        taxAmount: r2(settleGroup.orders.reduce((s, o) => s + (Number(o.taxAmount) || 0), 0)),
        grandTotal: settleGroup.total,
        paymentMethod: updates[0].paymentMethod,
        paymentStatus: updates.every((u) => u.paymentStatus === 'Paid') ? 'Paid' : 'Partially Paid',
      };
      if (onAddAuditLog) {
        onAddAuditLog(
          'POS Table Settled',
          `Table ${settleGroup.table}: ₹${received} received (${rows.map((r) => `${r.method} ₹${r.amount}`).join(' + ')}) against ${settleGroup.orders.length} KOT(s); balance ₹${r2(settleGroup.due - received)}.`
        );
      }
      showToast(
        received >= settleGroup.due - 0.5
          ? `Table ${settleGroup.table} bill settled (₹${received}). Table released.`
          : `Part payment ₹${received} recorded. Balance ₹${r2(settleGroup.due - received)} remains on Table ${settleGroup.table}.`,
        'success'
      );
      setPrintingFoodOrder(consolidated);
      broadcastPosEvent('TABLE_SETTLED', { table: settleGroup.table });
      setSettleTable(null);
      setSettleAmount('');
      setSettleRef('');
      setSettleCashTendered('');
      setSettleUpiUtr('');
      setSettleUpiVerified(false);
      setSettleCardLast4('');
      setSettleCardTerminal('');
      setSettleBankName('');
      setSettleBankRef('');
      setSettleRows([
        { id: 'sh1', method: 'Cash', amount: '', reference: '' },
        { id: 'sh2', method: 'UPI', amount: '', reference: '' },
      ]);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Dedicated Order Payment / Settle Handler (Module 1: Hybrid / Partial / Manual Verification)
  const handleRecordAdditionalPayment = () => {
    if (!orderPaymentModal || isSubmittingRef.current) return;
    const due = orderPaymentModal.balanceDue ?? Math.max(0, orderPaymentModal.grandTotal - (orderPaymentModal.amountPaid || 0));
    const amt = orderPayAmtInput === '' ? due : r2(Number(orderPayAmtInput) || 0);
    if (amt <= 0) {
      showToast('Please enter an amount to pay.', 'warning');
      return;
    }
    if (amt > due + 0.5) {
      showToast(`Payment amount (₹${amt}) cannot exceed balance due (₹${due}).`, 'error');
      return;
    }
    if (orderPayMethod === 'UPI' && !orderPayUpiVerified) {
      showToast('UPI payments require authorised staff verification. Please verify receipt on merchant soundbox/bank app.', 'warning');
      return;
    }

    isSubmittingRef.current = true;
    try {
      const nowIso = new Date().toISOString();
      const tender = Number(orderPayCashTendered) || 0;
      const change = tender > amt ? r2(tender - amt) : 0;
      const newPayRecord = {
        id: `PAY-${orderPaymentModal.id}-${Date.now()}`,
        method: orderPayMethod,
        amount: amt,
        reference: orderPayMethod === 'UPI' ? orderPayUpiUtr.trim() || undefined : orderPayMethod === 'Bank Transfer' ? orderPayBankRef.trim() || undefined : orderPayMethod === 'Card' ? (orderPayCardTerminal.trim() ? `Slip: ${orderPayCardTerminal.trim()}` : orderPayCardLast4 ? `Card ...${orderPayCardLast4}` : undefined) : undefined,
        time: nowIso,
        staff: loggedInUser,
        upiUtr: orderPayMethod === 'UPI' ? orderPayUpiUtr.trim() || undefined : undefined,
        verifiedBy: orderPayMethod === 'UPI' && orderPayUpiVerified ? loggedInUser : undefined,
        verifiedAt: orderPayMethod === 'UPI' && orderPayUpiVerified ? nowIso : undefined,
        verificationStatus: orderPayMethod === 'UPI' ? (orderPayUpiVerified ? ('verified' as const) : ('unverified' as const)) : undefined,
        cardNetwork: orderPayMethod === 'Card' ? orderPayCardNetwork : undefined,
        cardLast4: orderPayMethod === 'Card' ? orderPayCardLast4.trim() || undefined : undefined,
        cardTerminal: orderPayMethod === 'Card' ? orderPayCardTerminal.trim() || undefined : undefined,
        bankName: orderPayMethod === 'Bank Transfer' ? orderPayBankName.trim() || undefined : undefined,
        bankRef: orderPayMethod === 'Bank Transfer' ? orderPayBankRef.trim() || undefined : undefined,
        cashTendered: orderPayMethod === 'Cash' && tender > 0 ? tender : undefined,
        changeReturned: orderPayMethod === 'Cash' && change > 0 ? change : undefined,
        notes: orderPayMethod === 'Cash' && change > 0 ? `Cash Tendered: ₹${tender}, Change Returned: ₹${change}` : undefined,
      };

      const updatedPayments = [...(orderPaymentModal.payments || []), newPayRecord];
      const newPaidTotal = r2(updatedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
      const newBalanceDue = r2(Math.max(0, orderPaymentModal.grandTotal - newPaidTotal));
      const newStatus = resolvePayStatus(orderPaymentModal.grandTotal, newPaidTotal);
      const newSummary = updatedPayments.map((p) => `${p.method} ₹${p.amount}`).join(' + ');

      const updatedOrder: PosOrderRecord = {
        ...orderPaymentModal,
        payments: updatedPayments,
        amountPaid: newPaidTotal,
        balanceDue: newBalanceDue,
        paymentStatus: newStatus,
        paymentSummary: newSummary,
        isOpenCheck: orderPaymentModal.orderType === 'Dine In' && newBalanceDue > 0.5,
      };

      if (onUpdatePosOrder) {
        onUpdatePosOrder(updatedOrder);
      }
      if (onAddAuditLog) {
        onAddAuditLog(
          'POS Payment Recorded',
          `Order ${orderPaymentModal.orderNumber}: ₹${amt} received via ${orderPayMethod} by ${loggedInUser}. Remaining balance: ₹${newBalanceDue}.`
        );
      }
      broadcastPosEvent('ORDER_UPDATED', { orderId: updatedOrder.id });
      showToast(
        newBalanceDue <= 0.01
          ? `Order ${orderPaymentModal.orderNumber} is now fully PAID!`
          : `Payment of ₹${amt} recorded. Balance due: ₹${newBalanceDue}.`,
        'success'
      );
      setOrderPaymentModal(updatedOrder);
      setOrderPayAmtInput('');
      setOrderPayCashTendered('');
      setOrderPayUpiUtr('');
      setOrderPayUpiVerified(false);
      setOrderPayCardLast4('');
      setOrderPayCardTerminal('');
      setOrderPayBankName('');
      setOrderPayBankRef('');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleVoidPayment = (order: PosOrderRecord, payId: string, payAmt: number) => {
    if (!canApprove) {
      showToast('Only Manager or Admin can void/refund payments.', 'error');
      return;
    }
    const reason = window.prompt(`Enter mandatory reason for voiding/refunding payment ₹${payAmt}:`);
    if (!reason || !reason.trim()) {
      showToast('Void cancelled: reason is mandatory.', 'warning');
      return;
    }

    const updatedPayments = (order.payments || []).filter((p) => p.id !== payId);
    const newPaidTotal = r2(updatedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
    const newBalanceDue = r2(Math.max(0, order.grandTotal - newPaidTotal));
    const newStatus = resolvePayStatus(order.grandTotal, newPaidTotal);
    const newSummary = updatedPayments.length > 0 ? updatedPayments.map((p) => `${p.method} ₹${p.amount}`).join(' + ') : 'Unpaid';

    const updatedOrder: PosOrderRecord = {
      ...order,
      payments: updatedPayments,
      amountPaid: newPaidTotal,
      balanceDue: newBalanceDue,
      paymentStatus: newStatus,
      paymentSummary: newSummary,
      isOpenCheck: order.orderType === 'Dine In' && newBalanceDue > 0.5,
    };

    if (onUpdatePosOrder) {
      onUpdatePosOrder(updatedOrder);
    }
    if (onAddAuditLog) {
      onAddAuditLog(
        'POS Payment Voided / Refunded',
        `Order ${order.orderNumber}: Payment of ₹${payAmt} voided by ${loggedInUser}. Reason: ${reason.trim()}. New balance: ₹${newBalanceDue}.`
      );
    }
    broadcastPosEvent('ORDER_UPDATED', { orderId: updatedOrder.id });
    showToast(`Payment of ₹${payAmt} voided. Audit log created.`, 'info');
    setOrderPaymentModal(updatedOrder);
  };

  // KDS Order & Item-level status updates + Takeaway Pickup status + Reprint + Void/Refund
  const handleAdvanceKotStage = (ord: PosOrderRecord, nextStage: PosOrderRecord['kotStatus']) => {
    onUpdateKotStatus(ord.id, nextStage);
    broadcastPosEvent('KOT_STATUS_UPDATED', { orderId: ord.id, nextStage });
    if (onUpdatePosOrder) {
      const mappedItemSt: any =
        nextStage === 'Kitchen Accepted'
          ? 'Accepted'
          : nextStage === 'Preparing'
          ? 'Preparing'
          : nextStage === 'Ready'
          ? 'Ready'
          : nextStage === 'Served'
          ? 'Served'
          : 'KOT Sent';
      onUpdatePosOrder({
        ...ord,
        kotStatus: nextStage,
        items: ord.items.map((it) => ({ ...it, itemStatus: mappedItemSt })),
        ...(ord.orderType === 'Takeaway' && nextStage === 'Ready' ? { pickupStatus: 'Ready for Pickup' } : {}),
        ...(ord.orderType === 'Takeaway' && nextStage === 'Served' ? { pickupStatus: 'Picked Up / Delivered' } : {}),
      });
    }
    if (nextStage === 'Ready') {
      showToast(`Food READY for ${ord.roomName || (ord.tableNumber ? `Table ${ord.tableNumber}` : ord.orderNumber)}!`, 'success');
    } else if (nextStage === 'Served') {
      showToast(`${ord.orderNumber} marked Served / Delivered.`, 'success');
    }
  };

  const handleToggleSingleItemStatus = (ord: PosOrderRecord, itemIdx: number) => {
    if (!onUpdatePosOrder) return;
    const stages: ('KOT Sent' | 'Accepted' | 'Preparing' | 'Ready' | 'Served')[] = [
      'KOT Sent',
      'Accepted',
      'Preparing',
      'Ready',
      'Served',
    ];
    const nextItems = ord.items.map((it, idx) => {
      if (idx !== itemIdx) return it;
      const curIdx = stages.indexOf(it.itemStatus || 'KOT Sent');
      const nextSt = stages[Math.min(stages.length - 1, curIdx + 1)];
      return { ...it, itemStatus: nextSt };
    });
    const allServed = nextItems.every((i) => i.itemStatus === 'Served');
    const allReady = nextItems.every((i) => i.itemStatus === 'Ready' || i.itemStatus === 'Served');
    const anyPrep = nextItems.some((i) => i.itemStatus === 'Preparing' || i.itemStatus === 'Ready' || i.itemStatus === 'Served');
    const derivedKot: PosOrderRecord['kotStatus'] = allServed
      ? 'Served'
      : allReady
      ? 'Ready'
      : anyPrep
      ? 'Preparing'
      : ord.kotStatus;
    onUpdatePosOrder({ ...ord, items: nextItems, kotStatus: derivedKot });
  };

  const handleReprintKot = (ord: PosOrderRecord) => {
    const nextCount = (Number(ord.reprintCount) || 0) + 1;
    if (onUpdatePosOrder) {
      onUpdatePosOrder({ ...ord, reprintCount: nextCount });
    }
    if (onAddAuditLog) {
      onAddAuditLog('POS KOT Reprinted', `Reprinted ${ord.kotNumber || ord.orderNumber} (Reprint #${nextCount}) by ${loggedInUser}.`);
    }
    setPrintingKotOrder({ order: { ...ord, reprintCount: nextCount }, isReprint: true });
  };

  const [reverseStockOnVoid, setReverseStockOnVoid] = useState<boolean>(true);

  const handleConfirmVoidOrRefund = () => {
    if (!voidModalOrder) return;
    if (!canApprove) {
      showToast('Manager / Admin permission is required to cancel, void, or refund an order.', 'error');
      return;
    }
    if (!voidReasonInput.trim()) {
      showToast('Please enter a reason for voiding / cancelling this order (required for audit trail).', 'warning');
      return;
    }

    const canReverseBom =
      !voidModalOrder.isHeld &&
      voidModalOrder.kotStatus !== 'Cancelled' &&
      !voidModalOrder.bomReversed &&
      reverseStockOnVoid;

    let reversedBomFlag = Boolean(voidModalOrder.bomReversed);

    if (canReverseBom) {
      // 1. Reverse BOM raw materials (from exact snapshot if present, else compute from menuItems)
      if (onRecordStockMovement) {
        const toReverse =
          voidModalOrder.bomDeductionSnapshot && voidModalOrder.bomDeductionSnapshot.length > 0
            ? voidModalOrder.bomDeductionSnapshot
            : (() => {
                const map = new Map<
                  string,
                  { inventoryItemId: string; ingredientName: string; deductedQty: number; unit: string }
                >();
                voidModalOrder.items.forEach((oi) => {
                  const foundMenu = menuItems.find((m) => m.id === oi.itemId);
                  foundMenu?.recipeIngredients?.forEach((ing) => {
                    const q = r4(ing.quantity * oi.qty);
                    if (q > 0) {
                      const prev = map.get(ing.inventoryItemId);
                      map.set(ing.inventoryItemId, {
                        inventoryItemId: ing.inventoryItemId,
                        ingredientName: ing.ingredientName,
                        deductedQty: r4((prev?.deductedQty || 0) + q),
                        unit: ing.unit,
                      });
                    }
                  });
                });
                return Array.from(map.values());
              })();

        if (toReverse.length > 0) {
          toReverse.forEach((snap) => {
            onRecordStockMovement(
              snap.inventoryItemId,
              'IN',
              snap.deductedQty,
              'Restaurant Kitchen',
              `Void Stock Reversal ${voidModalOrder.orderNumber} (${snap.ingredientName} +${snap.deductedQty} ${snap.unit})`
            );
          });
          reversedBomFlag = true;
        }
      }

      // 2. Reverse tracked product stock if stockTracking was enabled
      if (onUpdateMenuItem) {
        voidModalOrder.items.forEach((oi) => {
          const foundMenu = menuItems.find((m) => m.id === oi.itemId);
          if (foundMenu && foundMenu.stockTracking && foundMenu.currentStock !== undefined) {
            const nextStock = Number(foundMenu.currentStock) + oi.qty;
            onUpdateMenuItem({
              ...foundMenu,
              currentStock: nextStock,
              available: nextStock > 0,
            });
          }
        });
      }
    }

    const refAmt = Math.min(Number(voidModalOrder.amountPaid) || 0, Math.max(0, Number(refundAmountInput) || 0));
    const updated: PosOrderRecord = {
      ...voidModalOrder,
      kotStatus: 'Cancelled',
      isOpenCheck: false,
      isHeld: false,
      balanceDue: 0,
      voidedAt: new Date().toISOString(),
      voidReason: voidReasonInput.trim(),
      voidedBy: loggedInUser,
      refundAmount: refAmt > 0 ? refAmt : undefined,
      bomReversed: reversedBomFlag,
    };
    if (onUpdatePosOrder) onUpdatePosOrder(updated);
    onUpdateKotStatus(voidModalOrder.id, 'Cancelled');
    broadcastPosEvent('ORDER_VOIDED', { orderId: voidModalOrder.id });
    if (onAddAuditLog) {
      onAddAuditLog(
        'POS Order Voided / Cancelled',
        `Order ${voidModalOrder.orderNumber} (${voidModalOrder.kotStatus}) voided by ${loggedInUser}. Reason: ${voidReasonInput.trim()}${
          reversedBomFlag ? ' | BOM Stock Reversed to Inventory' : ''
        }${refAmt > 0 ? ` | Refund: ₹${refAmt}` : ''}`
      );
    }
    showToast(
      `Order ${voidModalOrder.orderNumber} cancelled${reversedBomFlag ? ' & raw stock reversed' : ''}.`,
      'success'
    );
    setVoidModalOrder(null);
    setVoidReasonInput('');
    setRefundAmountInput('');
  };

  // derive 9-stage live order progress label
  const getLiveOrderStageLabel = (ord: PosOrderRecord): { label: string; color: string } => {
    if (ord.kotStatus === 'Cancelled') return { label: 'Cancelled / Void', color: 'bg-rose-100 text-rose-800' };
    if (ord.isHeld) return { label: 'Held Bill', color: 'bg-purple-100 text-purple-800' };
    const servedCount = ord.items.filter((i) => i.itemStatus === 'Served').length;
    if (ord.kotStatus === 'Served') {
      if (ord.paymentStatus === 'Paid') return { label: '9. Paid / Closed', color: 'bg-emerald-100 text-emerald-800' };
      if (ord.paymentStatus === 'Partially Paid') return { label: '8. Partially Paid', color: 'bg-amber-100 text-amber-800' };
      return { label: '7. Billing Pending', color: 'bg-blue-100 text-blue-800' };
    }
    if (servedCount > 0 && servedCount < ord.items.length) {
      return { label: `5. Partially Served (${servedCount}/${ord.items.length})`, color: 'bg-teal-100 text-teal-800' };
    }
    if (ord.kotStatus === 'Ready') return { label: '4. Food Ready', color: 'bg-emerald-100 text-emerald-900' };
    if (ord.kotStatus === 'Preparing') return { label: '3. Preparing', color: 'bg-amber-100 text-amber-900' };
    if (ord.kotStatus === 'Kitchen Accepted') return { label: '2b. Kitchen Accepted', color: 'bg-indigo-100 text-indigo-800' };
    return { label: '2. KOT Sent', color: 'bg-slate-200 text-slate-800' };
  };

  const [kdsStationFilter, setKdsStationFilter] = useState<string>('ALL');

  const parsePairText = parseMenuPairText;

  const resetCatalogForm = () => {
    setEditingMenuItemId(null);
    setNewItemName('');
    setNewItemCode('');
    setNewItemCategory('North Indian');
    setNewItemSubCategory('');
    setNewItemPrice(180);
    setNewItemCostPrice('');
    setNewItemTaxRate(configuredFnbGst || 5);
    setNewItemVeg(true);
    setNewItemStation('Main Kitchen');
    setNewItemPrepTime(15);
    setNewItemImage('');
    setNewItemDesc('');
    setNewItemVariantsText('');
    setNewItemAddonsText('');
    setNewItemMeals(['All Day']);
    setNewItemStockTrack(false);
    setNewItemStockQty('');
    setNewItemAvailable(true);
    setNewItemActive(true);
    setNewItemRecipeIngredients([]);
    setRecipeSelectItemId('');
    setRecipeQtyInput('');
  };

  const handleSaveMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      showToast('Please enter a Dish / Product Name.', 'warning');
      return;
    }
    const priceNum = Math.max(0, Number(newItemPrice) || 0);
    if (priceNum <= 0) {
      showToast('Selling price must be greater than ₹0.', 'warning');
      return;
    }
    const variantsParsed = newItemVariantsText.trim() ? parsePairText(newItemVariantsText) : undefined;
    const addonsParsed = newItemAddonsText.trim() ? parsePairText(newItemAddonsText) : undefined;
    const itemRecord: PosMenuItem = {
      id: editingMenuItemId || `pos-item-${Date.now()}`,
      code: newItemCode.trim() || `FNB-${Math.floor(100 + Math.random() * 900)}`,
      name: newItemName.trim(),
      category: newItemCategory || 'North Indian',
      subCategory: newItemSubCategory.trim() || undefined,
      price: priceNum,
      costPrice: newItemCostPrice === '' ? undefined : Math.max(0, Number(newItemCostPrice) || 0),
      taxRate: Math.max(0, Number(newItemTaxRate) || 0),
      isVeg: newItemVeg,
      available: newItemAvailable,
      isActive: newItemActive,
      kitchenStation: (newItemStation as PosMenuItem['kitchenStation']) || 'Main Kitchen',
      prepTime: newItemPrepTime === '' ? undefined : Math.max(1, Number(newItemPrepTime) || 15),
      image: newItemImage.trim() || undefined,
      description: newItemDesc.trim() || undefined,
      variants: variantsParsed,
      addons: addonsParsed,
      mealWindows: newItemMeals.length > 0 ? newItemMeals : ['All Day'],
      stockTracking: newItemStockTrack,
      currentStock: newItemStockTrack ? Math.max(0, Number(newItemStockQty) || 0) : undefined,
      recipeIngredients: newItemRecipeIngredients.length > 0 ? newItemRecipeIngredients : undefined,
    };
    if (editingMenuItemId && onUpdateMenuItem) {
      onUpdateMenuItem(itemRecord);
      if (onAddAuditLog) {
        onAddAuditLog('POS Product Updated', `Updated menu product "${itemRecord.name}" (${itemRecord.code}) at ₹${itemRecord.price}.`);
      }
      showToast(`Updated product "${itemRecord.name}" (historical orders unchanged).`, 'success');
    } else if (onAddMenuItem) {
      onAddMenuItem(itemRecord);
      if (onAddAuditLog) {
        onAddAuditLog('POS Product Added', `Added menu product "${itemRecord.name}" (${itemRecord.code}) at ₹${itemRecord.price}.`);
      }
      showToast(`Added "${itemRecord.name}" to POS menu catalog.`, 'success');
    }
    broadcastPosEvent('MENU_UPDATED', { itemId: itemRecord.id });
    resetCatalogForm();
  };

  const handleStartEditMenuItem = (item: PosMenuItem) => {
    setEditingMenuItemId(item.id);
    setNewItemName(item.name);
    setNewItemCode(item.code || '');
    setNewItemCategory(item.category);
    setNewItemSubCategory(item.subCategory || '');
    setNewItemPrice(item.price);
    setNewItemCostPrice(item.costPrice ?? '');
    setNewItemTaxRate(item.taxRate ?? configuredFnbGst);
    setNewItemVeg(item.isVeg);
    setNewItemStation(item.kitchenStation || 'Main Kitchen');
    setNewItemPrepTime(item.prepTime ?? 15);
    setNewItemImage(item.image || '');
    setNewItemDesc(item.description || '');
    setNewItemVariantsText(item.variants?.map((v) => `${v.name}:${v.price}`).join(', ') || '');
    setNewItemAddonsText(item.addons?.map((a) => `${a.name}:${a.price}`).join(', ') || '');
    setNewItemMeals(item.mealWindows && item.mealWindows.length > 0 ? item.mealWindows : ['All Day']);
    setNewItemStockTrack(Boolean(item.stockTracking));
    setNewItemStockQty(item.currentStock ?? '');
    setNewItemAvailable(item.available !== false);
    setNewItemActive(item.isActive !== false);
    setNewItemRecipeIngredients(item.recipeIngredients ? [...item.recipeIngredients] : []);
    setRecipeSelectItemId('');
    setRecipeQtyInput('');
  };

  const handleBulkPriceUpdate = () => {
    if (!canApprove) {
      showToast('Manager / Admin permission is required for bulk price updates.', 'error');
      return;
    }
    const pct = Number(bulkPctInput);
    if (!pct || isNaN(pct)) {
      showToast('Enter a non-zero percentage (e.g. 10 for +10% or -5 for -5%).', 'warning');
      return;
    }
    if (!onUpdateMenuItem) return;
    const targets = menuItems.filter((m) => catalogCatFilter === 'ALL' || m.category === catalogCatFilter);
    targets.forEach((m) => {
      const nextPrice = Math.max(1, Math.round(m.price * (1 + pct / 100)));
      const nextVars = m.variants?.map((v) => ({
        ...v,
        price: Math.max(1, Math.round(v.price * (1 + pct / 100))),
      }));
      onUpdateMenuItem({ ...m, price: nextPrice, variants: nextVars });
    });
    if (onAddAuditLog) {
      onAddAuditLog(
        'POS Bulk Price Update',
        `Adjusted ${targets.length} item(s) in "${catalogCatFilter}" by ${pct > 0 ? `+${pct}%` : `${pct}%`} by ${loggedInUser}.`
      );
    }
    showToast(`Updated prices for ${targets.length} product(s) by ${pct > 0 ? `+${pct}%` : `${pct}%`}.`, 'success');
    setBulkPctInput('');
  };

  const handleStartEditTable = (tbl: RestaurantTableConfig) => {
    setEditingTableOriginalNo(tbl.tableNumber);
    setNewTableNo(tbl.tableNumber);
    setNewTableCap(tbl.capacity);
    setNewTableFloor(tbl.floor || 'Main Hall');
  };

  const handleCancelEditTable = () => {
    setEditingTableOriginalNo(null);
    setNewTableNo('');
    setNewTableCap(4);
    setNewTableFloor('Main Hall');
  };

  const handleAddTable = () => {
    const code = newTableNo.trim().toUpperCase();
    if (!code) {
      showToast('Enter a Table Number (e.g. T-09).', 'warning');
      return;
    }
    if (editingTableOriginalNo) {
      const conflict = tableConfigs.some(
        (t) =>
          t.tableNumber.toUpperCase() === code &&
          t.tableNumber.toUpperCase() !== editingTableOriginalNo.toUpperCase()
      );
      if (conflict) {
        showToast(`Table ${code} already exists.`, 'warning');
        return;
      }
      saveTableConfigs(
        tableConfigs.map((t) =>
          t.tableNumber === editingTableOriginalNo
            ? {
                tableNumber: code,
                floor: newTableFloor.trim() || 'Main Hall',
                capacity: Math.max(1, Number(newTableCap) || 4),
              }
            : t
        )
      );
      if (code !== editingTableOriginalNo && onUpdatePosOrder) {
        orders
          .filter((o) => o.tableNumber === editingTableOriginalNo && o.isOpenCheck)
          .forEach((o) => onUpdatePosOrder({ ...o, tableNumber: code }));
      }
      if (tableNumber === editingTableOriginalNo) {
        setTableNumber(code);
      }
      showToast(`Updated Table ${code} (${newTableCap} Seats • ${newTableFloor || 'Main Hall'}).`, 'success');
      handleCancelEditTable();
      return;
    }
    if (tableConfigs.some((t) => t.tableNumber.toUpperCase() === code)) {
      showToast(`Table ${code} already exists.`, 'warning');
      return;
    }
    saveTableConfigs([
      ...tableConfigs,
      { tableNumber: code, floor: newTableFloor.trim() || 'Main Hall', capacity: Math.max(1, Number(newTableCap) || 4) },
    ]);
    setNewTableNo('');
    showToast(`Added Table ${code} to Restaurant floor.`, 'success');
  };

  const handleRemoveTable = (tblNo: string) => {
    const hasOpen = openChecks.some((g) => g.table === tblNo);
    if (hasOpen) {
      showToast(`Cannot delete Table ${tblNo} while it has an active running check.`, 'error');
      return;
    }
    saveTableConfigs(tableConfigs.filter((t) => t.tableNumber !== tblNo));
    showToast(`Removed Table ${tblNo}.`, 'info');
  };

  // Section 15: Comprehensive POS Reports & Analytics
  const reportData = useMemo(() => {
    const activeOrders = orders.filter((o) => !o.isHeld && o.kotStatus !== 'Cancelled');
    const voidedOrders = orders.filter((o) => o.kotStatus === 'Cancelled');
    const todayOrders = activeOrders.filter((o) => String(o.dateTime || '').startsWith(todayIst));

    const totalSales = r2(activeOrders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0));
    const todaySales = r2(todayOrders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0));
    const totalTax = r2(activeOrders.reduce((s, o) => s + (Number(o.taxAmount) || 0), 0));
    const totalDiscount = r2(activeOrders.reduce((s, o) => s + (Number(o.discount) || 0), 0));
    const totalRefunded = r2(voidedOrders.reduce((s, o) => s + (Number(o.refundAmount) || 0), 0));

    const dineInSales = r2(activeOrders.filter((o) => o.orderType === 'Dine In').reduce((s, o) => s + o.grandTotal, 0));
    const takeawaySales = r2(activeOrders.filter((o) => o.orderType === 'Takeaway').reduce((s, o) => s + o.grandTotal, 0));
    const roomServiceSales = r2(activeOrders.filter((o) => o.orderType === 'Room Service').reduce((s, o) => s + o.grandTotal, 0));

    const byProduct: Record<string, { name: string; category: string; qty: number; revenue: number }> = {};
    const byCategory: Record<string, { qty: number; revenue: number }> = {};
    activeOrders.forEach((o) => {
      o.items.forEach((it) => {
        const menuObj = menuItems.find((m) => m.id === it.itemId);
        const cat = menuObj?.category || 'General F&B';
        if (!byProduct[it.name]) byProduct[it.name] = { name: it.name, category: cat, qty: 0, revenue: 0 };
        byProduct[it.name].qty += it.qty;
        byProduct[it.name].revenue = r2(byProduct[it.name].revenue + it.total);
        if (!byCategory[cat]) byCategory[cat] = { qty: 0, revenue: 0 };
        byCategory[cat].qty += it.qty;
        byCategory[cat].revenue = r2(byCategory[cat].revenue + it.total);
      });
    });

    const byMethod: Record<string, number> = {
      Cash: 0,
      UPI: 0,
      Card: 0,
      'Bank Transfer': 0,
      'Virtual QR': 0,
      'Room Folio': 0,
      'Advance Deposit': 0,
    };
    activeOrders.forEach((o) => {
      if (o.paymentStatus === 'Unpaid (Room Folio)' || o.paymentMethod === 'Room Charge') {
        byMethod['Room Folio'] = r2((byMethod['Room Folio'] || 0) + o.grandTotal);
      } else if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p) => {
          byMethod[p.method] = r2((byMethod[p.method] || 0) + (Number(p.amount) || 0));
        });
      } else if (o.paymentStatus === 'Paid') {
        const m = o.paymentMethod || 'Cash';
        byMethod[m] = r2((byMethod[m] || 0) + o.grandTotal);
      }
    });

    const unpaidOrders = activeOrders.filter(
      (o) => o.paymentStatus !== 'Paid' && o.paymentStatus !== 'Unpaid (Room Folio)' && (o.balanceDue ?? o.grandTotal) > 0.5
    );
    const overrideRows = activeOrders.flatMap((o) =>
      (o.priceOverrides || []).map((po) => ({
        orderNo: o.orderNumber,
        itemName: po.name,
        originalPrice: po.originalPrice,
        newPrice: po.newPrice,
        reason: po.reason,
        approvedBy: po.by,
      }))
    );

    return {
      activeOrders,
      voidedOrders,
      todayOrders,
      totalSales,
      todaySales,
      totalTax,
      totalDiscount,
      totalRefunded,
      dineInSales,
      takeawaySales,
      roomServiceSales,
      byProduct,
      byCategory,
      byMethod,
      unpaidOrders,
      overrideRows,
      pendingKotCount: activeOrders.filter((o) => o.kotStatus === 'KOT Sent' || o.kotStatus === 'Kitchen Accepted' || o.kotStatus === 'Preparing').length,
      readyKotCount: activeOrders.filter((o) => o.kotStatus === 'Ready').length,
      servedKotCount: activeOrders.filter((o) => o.kotStatus === 'Served').length,
    };
  }, [orders, menuItems, todayIst]);

  const filteredMenu = menuItems.filter((m) => {
    if (m.isActive === false) return false;
    const matchCat = selectedCategory === 'ALL' || m.category === selectedCategory;
    const matchVeg = vegFilter === 'All' || (vegFilter === 'Veg' ? m.isVeg : !m.isVeg);
    const matchMeal =
      mealWindowFilter === 'All' ||
      !m.mealWindows ||
      m.mealWindows.length === 0 ||
      m.mealWindows.includes('All Day') ||
      m.mealWindows.includes(mealWindowFilter);
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      String(m.code || '').toLowerCase().includes(q) ||
      String(m.subCategory || '').toLowerCase().includes(q);
    return matchCat && matchVeg && matchMeal && matchSearch;
  });

  const visibleSubTabs = useMemo(
    () =>
      [
        { id: 'terminal', label: 'POS Billing Terminal', show: true },
        {
          id: 'advance_booking',
          label: 'Table Reservations',
          show: posCapabilities.tableReservationsEnabled,
        },
        {
          id: 'kds',
          label: 'Kitchen Display (KDS / KOT)',
          show: posCapabilities.kdsEnabled,
        },
        { id: 'orders_current', label: 'Current Orders', show: true },
        { id: 'orders_history', label: 'Order History', show: true },
        {
          id: 'tables',
          label: 'Restaurant Tables',
          show: posCapabilities.tablesEnabled,
        },
        { id: 'catalog', label: 'Menu & Recipe Master', show: true },
        { id: 'qr_menu', label: 'Digital Menu QR', show: true },
        { id: 'reports', label: 'F&B Sales Summary', show: true },
        { id: 'settings', label: 'POS Settings', show: true },
      ].filter((t) => t.show),
    [posCapabilities]
  );

  return (
    <div className="space-y-4">
      {/* Header & Sub-Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E8DEC8] shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-serif font-extrabold text-[#17120F] leading-snug">
                {posCapabilities.inHouseRestaurantAvailable
                  ? 'POS Restaurant & Room Service Terminal'
                  : 'In-Room Dining (Room Service POS)'}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  posCapabilities.inHouseKitchenAvailable
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                Kitchen: {posCapabilities.inHouseKitchenAvailable ? 'ON (KOT + KDS)' : 'OFF'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  posCapabilities.inHouseRestaurantAvailable
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                {posCapabilities.inHouseRestaurantAvailable
                  ? 'Café / Restaurant: ON'
                  : 'Room Service Only'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {posCapabilities.inHouseRestaurantAvailable
                ? 'Dine-In Tables, Takeaway & Room Service • Custom Order Pricing • GST Billing & Hybrid Settlement'
                : 'In-House Café/Restaurant is OFF — Room Service orders post directly to active PMS guest folios'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs w-full md:w-auto">
            {posCapabilities.kotEnabled && (
              <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-bold text-center whitespace-nowrap shrink-0">
                Active KOTs:{' '}
                {
                  orders.filter(
                    (o) => !o.isHeld && o.kotStatus !== 'Served' && o.kotStatus !== 'Cancelled'
                  ).length
                }
              </span>
            )}
            <span className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-900 font-bold text-center whitespace-nowrap shrink-0">
              Held: {heldOrdersList.length}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-center whitespace-nowrap shrink-0">
              Sales:{' '}
              {formatCurrency(
                orders
                  .filter((o) => o.kotStatus !== 'Cancelled' && !o.isHeld)
                  .reduce((s, o) => s + o.grandTotal, 0)
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleSubTabs.map((t) => {
              const normalizedActive =
                activeSubTab === 'dashboard' || activeSubTab === 'take_order'
                  ? 'terminal'
                  : activeSubTab === 'orders'
                  ? 'orders_current'
                  : activeSubTab;
              const isActive = normalizedActive === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSubTabChange(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#17120F] text-[#F5D88A] shadow-xs'
                      : 'bg-[#FAF6EE] text-slate-700 border border-[#E2D6BE] hover:bg-[#F3E9D4]'
                  }`}
                >
                  {t.id === 'qr_menu' && <QrCode className="w-3.5 h-3.5" />}
                  {t.id === 'advance_booking' && <Calendar className="w-3.5 h-3.5" />}
                  {t.id === 'settings' && <Settings className="w-3.5 h-3.5" />}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 ml-auto text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active <span className="text-[10px] text-emerald-600 font-normal">({lastSyncTime})</span>
            </span>
            <button
              type="button"
              onClick={handleManualSync}
              className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Broadcast & Refresh POS data across devices"
            >
              <RefreshCw className="w-3 h-3 text-slate-500" /> Sync
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================================= */}
      {/* SUB-TAB 1: 3-COLUMN POS BILLING TERMINAL (/pos, /pos/take-order & /admin/pos)     */}
      {/* Left: Tables/Rooms, Orders & Advance Bookings | Center: Menu | Right: Cart/Bill   */}
      {/* ================================================================================= */}
      {(activeSubTab === 'terminal' ||
        activeSubTab === 'take_order' ||
        activeSubTab === 'dashboard') && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start min-w-0">
          {/* ---------------- LEFT COLUMN (3 COLS): TABLES/ROOMS | ORDERS & HELD | BOOKINGS ---------------- */}
          <div className="xl:col-span-3 min-w-0 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            {posCapabilities.inHouseRestaurantAvailable ? (
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setLeftColTab('tables')}
                  className={`py-1.5 rounded-lg cursor-pointer transition ${
                    leftColTab === 'tables'
                      ? 'bg-slate-900 text-amber-400 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Tables ({tableConfigs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeftColTab('orders')}
                  className={`py-1.5 rounded-lg cursor-pointer transition ${
                    leftColTab === 'orders'
                      ? 'bg-slate-900 text-amber-400 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Orders ({openChecks.length + heldOrdersList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeftColTab('bookings')}
                  className={`py-1.5 rounded-lg cursor-pointer transition ${
                    leftColTab === 'bookings'
                      ? 'bg-slate-900 text-amber-400 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Bookings (
                  {
                    posAdvanceBookings.filter(
                      (b) => b.status !== 'Cancelled' && b.status !== 'Completed'
                    ).length
                  }
                  )
                </button>
              </div>
            ) : (
              /* ROOM SERVICE ONLY MODE: In-House Occupied Rooms Quick Picker */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                    In-House Rooms ({inHouseBookings.length})
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Room Service Only</span>
                </div>
                {inHouseBookings.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900">
                    No checked-in guests currently in-house. Check in a guest in PMS Front Office to post Room Service orders.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {inHouseBookings.map((bk) => {
                      const active = selectedBookingId === bk.id;
                      return (
                        <button
                          key={bk.id}
                          type="button"
                          onClick={() => {
                            setOrderType('Room Service');
                            setSelectedBookingId(bk.id);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            active
                              ? 'border-2 border-[#17120F] bg-amber-50/70 shadow-2xs'
                              : 'border-slate-200 hover:border-amber-400 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-extrabold text-slate-900">
                            <span>Room {bk.roomNumbers.join(', ')}</span>
                            <span className="text-[10px] font-mono text-amber-800">
                              #{bk.bookingNo}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                            {bk.customerName}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* LEFT TAB A: TABLES */}
            {posCapabilities.inHouseRestaurantAvailable && leftColTab === 'tables' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-0.5">
                  <span>Click table to load/edit order or bill</span>
                  <button
                    type="button"
                    onClick={() => onSubTabChange('tables')}
                    className="text-amber-700 hover:underline cursor-pointer"
                  >
                    Manage Tables →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[540px] overflow-y-auto pr-0.5">
                  {tableConfigs.map((tbl) => {
                    const live = getTableLiveStatus(tbl.tableNumber);
                    const isSelected = orderType === 'Dine In' && tableNumber === tbl.tableNumber;
                    const badgeCls =
                      live.status === 'Occupied'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : live.status === 'Billing'
                        ? 'bg-blue-100 text-blue-900 border-blue-300'
                        : live.status === 'Reserved'
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    return (
                      <div
                        key={tbl.tableNumber}
                        onClick={() => {
                          if (live.openCheck && live.openCheck.orders.length > 0) {
                            handleLoadOrderIntoTicket(
                              live.openCheck.orders[live.openCheck.orders.length - 1]
                            );
                            return;
                          }
                          if (editingOrder) {
                            setCart([]);
                            resetBillingState();
                          }
                          setOrderType('Dine In');
                          setTableNumber(tbl.tableNumber);
                          if (live.reservation) {
                            setCustomerNameInput(live.reservation.guestOrGroupName);
                            setCustomerPhoneInput(live.reservation.mobile || '');
                            setDineInPax(live.reservation.pax || tbl.capacity);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition space-y-1 ${
                          isSelected
                            ? 'border-2 border-slate-900 bg-amber-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-amber-400 bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-xs text-slate-900">{tbl.tableNumber}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeCls}`}>
                            {live.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {tbl.floor} • {tbl.capacity} Seats
                        </div>
                        {live.openCheck && (
                          <div className="pt-1 border-t border-slate-200/70 space-y-1 text-[10px]">
                            <div className="font-extrabold text-rose-700">
                              Due {formatCurrency(live.openCheck.due)}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoadOrderIntoTicket(
                                    live.openCheck!.orders[live.openCheck!.orders.length - 1]
                                  );
                                }}
                                className="flex-1 py-0.5 px-1.5 rounded border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[9px] inline-flex items-center justify-center gap-0.5 cursor-pointer"
                              >
                                <Pencil className="w-2.5 h-2.5" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSettleTable(tbl.tableNumber);
                                  setSettleMode('Cash');
                                  setSettleAmount('');
                                }}
                                className="flex-1 py-0.5 px-1.5 rounded bg-slate-900 text-amber-400 font-bold text-[9px] cursor-pointer"
                              >
                                Settle
                              </button>
                            </div>
                          </div>
                        )}
                        {live.reservation && !live.openCheck && (
                          <div className="text-[9.5px] font-semibold text-purple-800 truncate">
                            Res: {live.reservation.guestOrGroupName} ({live.reservation.pax}p)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LEFT TAB B: RUNNING ORDERS & HELD CHECKS */}
            {leftColTab === 'orders' && (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-0.5 text-xs">
                <input
                  type="text"
                  value={leftOrderSearch}
                  onChange={(e) => setLeftOrderSearch(e.target.value)}
                  placeholder="Search table, room, guest or KOT..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                />

                {/* Held Bills */}
                {heldOrdersList.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase text-purple-800">
                      Held Checks ({heldOrdersList.length})
                    </div>
                    {heldOrdersList.map((h) => (
                      <div key={h.id} className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-1">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{h.orderNumber} • {h.tableNumber || h.orderType}</span>
                          <span>{formatCurrency(h.grandTotal)}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 truncate">
                          {h.customerName} — {h.items.map((i) => `${i.name} x${i.qty}`).join(', ')}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleResumeHeldOrder(h)}
                            className="flex-1 py-1 rounded-lg bg-purple-700 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Resume / Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVoidModalOrder(h);
                              setVoidReasonInput('Discarded held check');
                            }}
                            className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 font-bold text-[10px] cursor-pointer"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Open Table Checks (shown when In-House Café / Restaurant is ON) */}
                {posCapabilities.inHouseRestaurantAvailable && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase text-amber-800">
                      Running Table Checks ({openChecks.length})
                    </div>
                    {openChecks
                      .filter(
                        (g) =>
                          !leftOrderSearch.trim() ||
                          g.table.toLowerCase().includes(leftOrderSearch.toLowerCase()) ||
                          g.orders.some((o) =>
                            o.customerName.toLowerCase().includes(leftOrderSearch.toLowerCase())
                          )
                      )
                      .map((g) => (
                        <div key={g.table} className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900">
                              Table {g.table} ({g.orders.length} KOT{g.orders.length > 1 ? 's' : ''})
                            </span>
                            <span className="font-extrabold text-rose-700">Due {formatCurrency(g.due)}</span>
                          </div>
                          <div className="text-[10px] text-slate-600">
                            {g.orders.flatMap((o) => o.items).map((i) => `${i.name} x${i.qty}`).join(', ')}
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => handleLoadOrderIntoTicket(g.orders[g.orders.length - 1])}
                              className="py-1 rounded-lg border border-amber-300 bg-amber-100 hover:bg-amber-200 font-bold text-[10px] text-amber-950 inline-flex items-center justify-center gap-0.5 cursor-pointer"
                            >
                              <Pencil className="w-2.5 h-2.5" /> Edit
                            </button>
                            {posCapabilities.kotEnabled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCart([]);
                                  resetBillingState();
                                  setOrderType('Dine In');
                                  setTableNumber(g.table);
                                }}
                                className="py-1 rounded-lg border border-slate-300 bg-white font-bold text-[10px] text-slate-800 cursor-pointer"
                              >
                                + Supp. KOT
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSettleTable(g.table);
                                setSettleMode('Cash');
                                setSettleAmount('');
                              }}
                              className="py-1 rounded-lg bg-slate-900 text-amber-400 font-bold text-[10px] cursor-pointer"
                            >
                              Settle
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Recent Active Kitchen / Takeaway / Room Service Orders */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500">
                    {posCapabilities.inHouseRestaurantAvailable
                      ? 'Live Order Progress'
                      : 'Room Service Orders'}
                  </div>
                  {orders
                    .filter(
                      (o) =>
                        !o.isHeld &&
                        (posCapabilities.inHouseRestaurantAvailable ||
                          o.orderType === 'Room Service') &&
                        (!leftOrderSearch.trim() ||
                          o.orderNumber.toLowerCase().includes(leftOrderSearch.toLowerCase()) ||
                          o.customerName.toLowerCase().includes(leftOrderSearch.toLowerCase()) ||
                          String(o.tableNumber || o.roomNumber || '')
                            .toLowerCase()
                            .includes(leftOrderSearch.toLowerCase()))
                    )
                    .slice(0, 8)
                    .map((ord) => {
                      const st = getLiveOrderStageLabel(ord);
                      return (
                        <div key={ord.id} className="p-2 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 text-[11px]">
                              {ord.kotNumber || ord.orderNumber} • {ord.roomName || (ord.tableNumber ? `Table ${ord.tableNumber}` : ord.orderType)}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${st.color}`}>{st.label}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>{ord.customerName}</span>
                            <span className="font-bold text-slate-800">{formatCurrency(ord.grandTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setPrintingFoodOrder(ord)}
                              className="font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Print Bill
                            </button>
                            <div className="flex items-center gap-1">
                              {ord.kotStatus !== 'Cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => handleLoadOrderIntoTicket(ord)}
                                  className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Pencil className="w-2.5 h-2.5" /> Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOrderPaymentModal(ord);
                                  setOrderPayAmtInput(ord.balanceDue ?? (ord.grandTotal - (ord.amountPaid || 0)));
                                  setOrderPayCashTendered('');
                                  setOrderPayUpiUtr('');
                                  setOrderPayUpiVerified(false);
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                              >
                                {(ord.balanceDue ?? 0) > 0 ? `Settle (₹${ord.balanceDue})` : 'Payments'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* LEFT TAB C: ADVANCE RESTAURANT BOOKINGS */}
            {posCapabilities.inHouseRestaurantAvailable && leftColTab === 'bookings' && (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-0.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Upcoming Table Bookings</span>
                  <button
                    type="button"
                    onClick={() => onSubTabChange('advance_booking')}
                    className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                  >
                    + New / Manage
                  </button>
                </div>
                {posAdvanceBookings.filter((b) => b.status !== 'Cancelled').length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-[11px]">
                    No advance restaurant bookings yet. Click + New / Manage to schedule a table or banquet reservation.
                  </div>
                ) : (
                  posAdvanceBookings
                    .filter((b) => b.status !== 'Cancelled')
                    .map((adv) => (
                      <div key={adv.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900">{adv.guestOrGroupName}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPendingEditAdvanceId(adv.id);
                                onSubTabChange('advance_booking');
                              }}
                              className="px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[9.5px] font-bold inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <Pencil className="w-2.5 h-2.5" /> Edit
                            </button>
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9.5px] font-bold">
                              {adv.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-600">
                          {adv.eventDate} {adv.eventTime ? `at ${adv.eventTime}` : ''} • {adv.pax} Pax
                          {(adv as any).tableNumber ? ` • Table ${(adv as any).tableNumber}` : ''}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-emerald-700 font-bold">Deposit: ₹{adv.advanceAmount || 0}</span>
                          <span className="text-slate-700">Est: ₹{adv.totalAmount || 0}</span>
                        </div>
                        {adv.status !== 'Completed' && (
                          <button
                            type="button"
                            onClick={() => handleConvertAdvanceToLive(adv)}
                            className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[10.5px] cursor-pointer"
                          >
                            Seat Guest &amp; Load Live Order →
                          </button>
                        )}
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* ---------------- CENTER COLUMN (5 COLS): CATEGORIES, MENU & ITEM SELECTION ---------------- */}
          <div className="xl:col-span-5 min-w-0 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search dish name, SKU code or subcategory..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                {(['All', 'Veg', 'Non-Veg'] as const).map((vf) => (
                  <button
                    key={vf}
                    type="button"
                    onClick={() => setVegFilter(vf)}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border cursor-pointer ${
                      vegFilter === vf ? 'bg-slate-900 text-amber-400 border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {vf}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onSubTabChange('catalog')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[10.5px] font-bold cursor-pointer"
                >
                  + Menu
                </button>
              </div>
            </div>

            {/* Meal Window Filter + Category Strip */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Breakfast', 'Lunch', 'Dinner'] as const).map((mw) => (
                <button
                  key={mw}
                  type="button"
                  onClick={() => setMealWindowFilter(mw)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    mealWindowFilter === mw ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {mw === 'All' ? 'All Meals' : mw}
                </button>
              ))}
              <span className="text-slate-300">|</span>
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
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-amber-400'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[560px] overflow-y-auto pr-1">
              {filteredMenu.length === 0 ? (
                <div className="col-span-full py-10 text-center text-xs text-slate-500 space-y-2">
                  <div>No matching menu items found.</div>
                  <button
                    type="button"
                    onClick={() => onSubTabChange('catalog')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    + Manage Menu in Recipe Master
                  </button>
                </div>
              ) : null}
              {filteredMenu.map((item) => {
                const rawOutOfStock = item.recipeIngredients?.some((ri) => {
                  const inv = inventoryItems.find((i) => i.id === ri.inventoryItemId);
                  return inv && r4(Number(inv.currentStock) || 0) < r4(ri.quantity);
                });
                const isOut =
                  item.available === false ||
                  (item.stockTracking && (Number(item.currentStock) || 0) <= 0) ||
                  Boolean(rawOutOfStock);
                const hasVariants = Boolean(item.variants && item.variants.length > 0);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isOut) addToCart(item);
                    }}
                    className={`p-3 rounded-2xl border transition flex flex-col justify-between ${
                      isOut
                        ? 'border-slate-200 bg-slate-100/70 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>
                          {item.code}
                          {item.subCategory ? ` • ${item.subCategory}` : ''}
                        </span>
                        <div className="flex items-center gap-1">
                          {rawOutOfStock && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-extrabold text-[9px] border border-rose-200">
                              Shortage
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded ${
                              item.isVeg ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.isVeg ? 'VEG' : 'NON-VEG'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-extrabold text-slate-900 mt-1">{item.name}</div>
                      <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>{item.kitchenStation}</span>
                        {item.prepTime ? <span>• {item.prepTime}m</span> : null}
                        {hasVariants ? (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">
                            {item.variants!.map((v) => `${v.name}: ₹${v.price}`).join(' | ')}
                          </span>
                        ) : null}
                        {item.stockTracking ? (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 font-bold">
                            Stock: {item.currentStock ?? 0}
                          </span>
                        ) : null}
                        {item.recipeIngredients && item.recipeIngredients.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200 font-semibold text-[9.5px]">
                            {item.recipeIngredients.length} ingredients (BOM)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-slate-200/70">
                      {!hasVariants || isOut ? (
                        <>
                          <span className="text-sm font-extrabold text-slate-900">
                            {formatCurrency(item.price)}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                              isOut ? 'bg-rose-100 text-rose-800' : 'bg-slate-900 text-amber-400'
                            }`}
                          >
                            {rawOutOfStock ? (
                              'Ingredient OOS'
                            ) : isOut ? (
                              'Out of Stock'
                            ) : (
                              <>
                                <Plus className="w-3 h-3" /> Add
                              </>
                            )}
                          </span>
                        </>
                      ) : (
                        <div
                          className="flex flex-wrap items-center gap-1.5 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.variants!.map((v, vIdx) => (
                            <button
                              key={v.id || `${v.name}-${vIdx}`}
                              type="button"
                              onClick={() => addToCart(item, v.name)}
                              className="flex-1 min-w-[78px] py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 text-[10.5px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" /> {v.name} ₹{v.price}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------------- RIGHT COLUMN (4 COLS): CURRENT ORDER, KOT, DISCOUNTS & BILLING ---------------- */}
          <div
            className={`xl:col-span-4 min-w-0 bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-between space-y-3.5 h-fit xl:sticky xl:top-20 transition-all ${
              editingOrder ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200/80'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-amber-500" />
                  <span>{editingOrder ? 'Edit POS Order Ticket' : 'Current POS Order Ticket'}</span>
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  {cart.reduce((s, c) => s + c.qty, 0)} Qty ({cart.length} Items)
                </span>
              </div>

              {/* Active Order Edit Banner */}
              {editingOrder && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-amber-950 flex items-center gap-1.5 min-w-0">
                      <Pencil className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="truncate">
                        Editing {editingOrder.kotNumber || editingOrder.orderNumber}
                        {editingOrder.tableNumber ? ` • Table ${editingOrder.tableNumber}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {orderType === 'Dine In' && (
                        <button
                          type="button"
                          onClick={() => handleCancelEditOrder(true)}
                          title="Start a separate new Supplementary KOT on this table"
                          className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer"
                        >
                          + Supp. KOT
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCancelEditOrder(false)}
                        title="Exit edit mode"
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[10px] inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>

                  {rawOpenCheckForCurrentTable && rawOpenCheckForCurrentTable.orders.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-amber-200/80">
                      <span className="text-[10px] font-bold text-amber-800 mr-1">Table KOTs:</span>
                      {rawOpenCheckForCurrentTable.orders.map((ko, idx) => (
                        <button
                          key={ko.id}
                          type="button"
                          onClick={() => handleLoadOrderIntoTicket(ko, true)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            ko.id === editingOrder.id
                              ? 'bg-slate-900 text-amber-400'
                              : 'bg-white border border-amber-300 text-amber-900'
                          }`}
                        >
                          KOT #{idx + 1} ({formatCurrency(ko.grandTotal)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Order Type Toggle: Dynamic per In-House Café / Restaurant Setting */}
              <div
                className={`grid ${
                  posCapabilities.allowedOrderTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-3'
                } gap-1 bg-slate-100 p-1 rounded-xl`}
              >
                {posCapabilities.allowedOrderTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      orderType === t ? 'bg-slate-900 text-amber-400 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Mode-Specific Context Fields */}
              {orderType === 'Room Service' ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase text-amber-900">
                    Occupied In-House Room &amp; Guest Folio *
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-slate-900"
                  >
                    {inHouseBookings.length === 0 ? (
                      <option value="">-- No Active Checked-In Rooms --</option>
                    ) : (
                      inHouseBookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          Room {b.roomNumbers.join(', ')} — {b.customerName} (#{b.bookingNo})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : orderType === 'Dine In' ? (
                <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Table *</label>
                      <select
                        value={tableNumber}
                        onChange={(e) => {
                          const nextTbl = e.target.value;
                          setTableNumber(nextTbl);
                          if (!editingOrder && cart.length === 0) {
                            const foundOpen = openChecks.find((g) => g.table === nextTbl);
                            if (foundOpen && foundOpen.orders.length > 0) {
                              handleLoadOrderIntoTicket(foundOpen.orders[foundOpen.orders.length - 1]);
                            }
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-bold bg-white"
                      >
                        {tableConfigs.map((t) => (
                          <option key={t.tableNumber} value={t.tableNumber}>
                            {t.tableNumber} ({t.capacity}p)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">PAX (Guests)</label>
                      <input
                        type="number"
                        min={1}
                        value={dineInPax}
                        onChange={(e) => setDineInPax(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Waiter</label>
                      <input
                        type="text"
                        value={waiterName}
                        onChange={(e) => setWaiterName(e.target.value)}
                        placeholder="Staff"
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customerNameInput}
                      onChange={(e) => setCustomerNameInput(e.target.value)}
                      placeholder="Guest name (optional)"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                    <input
                      type="text"
                      value={customerPhoneInput}
                      onChange={(e) => setCustomerPhoneInput(e.target.value)}
                      placeholder="Mobile (optional)"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>
              ) : (
                /* TAKEAWAY FIELDS */
                <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Customer Name *</label>
                      <input
                        type="text"
                        value={customerNameInput}
                        onChange={(e) => setCustomerNameInput(e.target.value)}
                        placeholder="Customer name"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Mobile Number</label>
                      <input
                        type="text"
                        value={customerPhoneInput}
                        onChange={(e) => setCustomerPhoneInput(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Packaging Charge (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={packagingCharge}
                        onChange={(e) => setPackagingCharge(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Pickup Time</label>
                      <input
                        type="time"
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Running Check / Advance Deposit Banner */}
              {openCheckForCurrentTable && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-amber-950">
                    <span>Running Check on Table {tableNumber} ({openCheckForCurrentTable.orders.length} KOTs)</span>
                    <span>Previous Due: {formatCurrency(openCheckForCurrentTable.due)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-amber-800">
                      New items below generate a <strong>Supplementary KOT</strong>, or click Edit to modify existing KOT.
                    </p>
                    {!editingOrder && (
                      <button
                        type="button"
                        onClick={() =>
                          handleLoadOrderIntoTicket(
                            openCheckForCurrentTable.orders[openCheckForCurrentTable.orders.length - 1]
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[10px] shrink-0 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-2.5 h-2.5" /> Edit KOT
                      </button>
                    )}
                  </div>
                </div>
              )}

              {advanceDepositCredit > 0 && (
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] flex items-center justify-between font-bold text-emerald-900">
                  <span>Advance Booking Deposit Applied:</span>
                  <span>− {formatCurrency(advanceDepositCredit)}</span>
                </div>
              )}

              {/* Cart Items with Portion/Variant, Item Notes, Item Discount & Authorised Price Override */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {cart.map((line) => {
                  const { lineId, item, qty, overrideReason, variant, addons, itemNotes, itemDiscount } = line;
                  const { configuredUnitPrice } = getLineConfiguredInfo(line);
                  const eff = getEffectiveLineUnitPrice(line);
                  const overridden = isCartLinePriceOverridden(line);
                  return (
                    <div
                      key={lineId}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {item.name}
                            {variant ? (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                                {variant}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatCurrency(eff)} x {qty}
                            {overridden && (
                              <span className="ml-1.5 text-amber-700 font-semibold">
                                (configured {formatCurrency(configuredUnitPrice)})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQty(lineId, -1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-bold w-4 text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(lineId, 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="font-extrabold text-slate-900 w-14 text-right">
                            {formatCurrency(r2(eff * qty))}
                          </span>
                        </div>
                      </div>

                      {item.variants && item.variants.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500">Portion:</span>
                          <select
                            value={variant || item.variants[0].name}
                            onChange={(e) => setLineVariant(lineId, e.target.value)}
                            className="px-2 py-0.5 rounded border border-slate-200 bg-white text-[11px] font-bold"
                          >
                            {item.variants.map((v, vIdx) => (
                              <option key={v.id || `${v.name}-${vIdx}`} value={v.name}>
                                {v.name} (₹{v.price})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {item.addons && item.addons.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500">Add-ons:</span>
                          {item.addons.map((ad, adIdx) => {
                            const selected = Boolean(addons?.includes(ad.name));
                            return (
                              <button
                                key={ad.id || `${ad.name}-${adIdx}`}
                                type="button"
                                onClick={() => toggleLineAddon(lineId, ad.name)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                  selected
                                    ? 'bg-slate-900 text-amber-400 border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
                                }`}
                              >
                                {selected ? '✓ ' : '+ '}
                                {ad.name} (₹{ad.price})
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500">Order ₹</span>
                        <input
                          type="number"
                          min={0}
                          disabled={!canOverrideItemPrice}
                          title={
                            canOverrideItemPrice
                              ? 'Custom selling price for this order only — original product master price stays unchanged'
                              : 'Authorised staff permission is required to change an item selling price'
                          }
                          value={eff}
                          onChange={(e) => setLinePrice(lineId, e.target.value)}
                          className={`w-20 px-1.5 py-1 rounded-lg border text-xs font-extrabold disabled:bg-slate-100 disabled:text-slate-400 ${
                            overridden
                              ? 'border-amber-400 bg-amber-50 text-amber-950'
                              : 'border-slate-200 bg-white text-slate-900'
                          }`}
                        />
                        <input
                          type="number"
                          min={0}
                          value={itemDiscount || ''}
                          onChange={(e) => setLineItemDiscount(lineId, e.target.value)}
                          placeholder="Disc ₹"
                          title="Item-level discount (₹)"
                          className="w-16 px-1.5 py-1 rounded-lg border border-slate-200 text-[11px]"
                        />
                        <input
                          type="text"
                          value={itemNotes || ''}
                          onChange={(e) => setLineNotes(lineId, e.target.value)}
                          placeholder="Chef note (e.g. less spicy)"
                          className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-200 text-[11px] bg-white"
                        />
                      </div>

                      {overridden && (
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-amber-800">
                            <span>
                              Custom Order Price: ₹{eff} (Master Price ₹{configuredUnitPrice} unchanged)
                            </span>
                            <button
                              type="button"
                              onClick={() => resetLinePrice(lineId)}
                              className="underline hover:text-amber-950 cursor-pointer"
                            >
                              Reset to ₹{configuredUnitPrice}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Reason for custom price (required for audit log) *"
                              value={overrideReason || ''}
                              onChange={(e) => setLineReason(lineId, e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-[11px]"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {['Special Guest Prep', 'Extra Rich / Add-on', 'Custom Order Rate'].map(
                              (preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setLineReason(lineId, preset)}
                                  className="px-1.5 py-0.5 rounded bg-white border border-amber-200 hover:border-amber-400 text-[9.5px] font-semibold text-amber-900 cursor-pointer"
                                >
                                  {preset}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals & Action Buttons (Hold Bill | Send KOT | Settle & Bill) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Food Subtotal{extraPkg > 0 ? ` (incl. ₹${extraPkg} Pkg)` : ''}</span>
                <span className="font-bold">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount / Adjustment (before GST)</span>
                  <span className="font-bold">− {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>
                  {gstEnabled
                    ? `F&B GST (${configuredFnbGst}% = ${taxSettings.fnbCgst}% CGST + ${taxSettings.fnbSgst}% SGST)`
                    : 'GST not applied (Bill of Supply)'}
                </span>
                <span className="font-bold">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-100">
                <span>{editingOrder ? 'Updated Order Total' : 'Current Ticket Total'}</span>
                <span className="text-amber-600">{formatCurrency(grandTotal)}</span>
              </div>
              {editingOrder && alreadyPaidOnEditingOrder > 0 && (
                <div className="flex justify-between text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                  <span>Already Paid ({formatCurrency(alreadyPaidOnEditingOrder)}) • Balance Due:</span>
                  <span>{formatCurrency(netPayableAfterDeposit)}</span>
                </div>
              )}
              {openCheckForCurrentTable && (
                <div className="flex justify-between text-xs font-extrabold text-slate-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                  <span>Consolidated Table Bill (Prev + New)</span>
                  <span>{formatCurrency(r2(openCheckForCurrentTable.due + grandTotal))}</span>
                </div>
              )}

              {editingOrder ? (
                <>
                  <div className={`grid ${posCapabilities.kotEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1`}>
                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={() => handleFinalizeOrder('UPDATE_ONLY')}
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Update Order
                    </button>
                    {posCapabilities.kotEnabled && (
                      <button
                        type="button"
                        disabled={cart.length === 0}
                        onClick={() => handleFinalizeOrder('KOT_OPEN')}
                        className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Update &amp; KOT
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => setShowAdditionalModal(true)}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-sm transition cursor-pointer"
                  >
                    Update Discount, Bill &amp; Settle →
                  </button>
                </>
              ) : (
                <>
                  <div className={`grid ${posCapabilities.kotEnabled && posCapabilities.dineInEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1`}>
                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={handleHoldCurrentOrder}
                      className="py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-800 font-bold text-xs cursor-pointer"
                    >
                      Hold Bill
                    </button>
                    {posCapabilities.kotEnabled && posCapabilities.dineInEnabled && (
                      <button
                        type="button"
                        disabled={cart.length === 0 || orderType !== 'Dine In'}
                        onClick={() => handleFinalizeOrder('KOT_OPEN')}
                        title="Send KOT to kitchen and keep table check open"
                        className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                      >
                        {openCheckForCurrentTable ? 'Send Supp. KOT' : 'Send KOT (Open)'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => setShowAdditionalModal(true)}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-sm transition cursor-pointer"
                  >
                    {posCapabilities.kotEnabled
                      ? 'Proceed to KOT, Discount & Settlement →'
                      : 'Proceed to Discount, Bill & Settlement →'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ===================================================================== */}
      {/* 2. PRODUCT & MENU MANAGEMENT (RECIPE MASTER / CATALOG)                */}
      {/* ===================================================================== */}
      {activeSubTab === 'catalog' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Complete Product &amp; Menu Management (Recipe Master)
              </h3>
              <p className="text-xs text-slate-500">
                Manage dishes, SKU codes, categories, subcategories, variants/portions, add-ons, meal windows, stock tracking and GST rates. Updating a price here never alters historical orders.
              </p>
            </div>
            {/* Bulk Price Update */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-600 text-[11px]">
                Bulk Price Update ({catalogCatFilter === 'ALL' ? 'All Categories' : catalogCatFilter}):
              </span>
              <input
                type="number"
                value={bulkPctInput}
                onChange={(e) => setBulkPctInput(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="+% or -%"
                className="w-24 px-2 py-1 rounded-lg border border-slate-200 bg-white font-bold text-[11px]"
              />
              <button
                type="button"
                onClick={handleBulkPriceUpdate}
                className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 font-bold text-[11px] cursor-pointer"
              >
                Apply %
              </button>
            </div>
          </div>

          {/* Product Form */}
          <form
            onSubmit={handleSaveMenuItem}
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Chicken Biryani"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">SKU / Code</label>
                <input
                  type="text"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  placeholder="FNB-101"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category *</label>
                <input
                  type="text"
                  required
                  list="pos-category-options"
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  placeholder="North Indian"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
                <datalist id="pos-category-options">
                  <option value="North Indian" />
                  <option value="Fast Food" />
                  <option value="Breakfast" />
                  <option value="Beverages" />
                  <option value="Desserts" />
                  <option value="Chinese" />
                  <option value="Tandoor" />
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Subcategory</label>
                <input
                  type="text"
                  value={newItemSubCategory}
                  onChange={(e) => setNewItemSubCategory(e.target.value)}
                  placeholder="e.g. Rice / Mains"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Selling Price (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cost Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={newItemCostPrice}
                  onChange={(e) => setNewItemCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Veg / Non-Veg</label>
                <select
                  value={newItemVeg ? 'VEG' : 'NONVEG'}
                  onChange={(e) => setNewItemVeg(e.target.value === 'VEG')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                >
                  <option value="VEG">Pure Veg</option>
                  <option value="NONVEG">Non-Veg</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">GST Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={newItemTaxRate}
                  onChange={(e) => setNewItemTaxRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Kitchen Station</label>
                <select
                  value={newItemStation}
                  onChange={(e) => setNewItemStation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="Main Kitchen">Main Kitchen</option>
                  <option value="Tandoor">Tandoor</option>
                  <option value="Beverage Bar">Beverage Bar</option>
                  <option value="Bakery">Bakery</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Prep Time (mins)</label>
                <input
                  type="number"
                  min={1}
                  value={newItemPrepTime}
                  onChange={(e) => setNewItemPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Portions / Variants (Name:Price)
                </label>
                <input
                  type="text"
                  value={newItemVariantsText}
                  onChange={(e) => setNewItemVariantsText(e.target.value)}
                  placeholder="Half:160, Full:280"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Add-ons / Modifiers (Name:Price)
                </label>
                <input
                  type="text"
                  value={newItemAddonsText}
                  onChange={(e) => setNewItemAddonsText(e.target.value)}
                  placeholder="Extra Raita:30, Cheese:40"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Section 2: Recipe & Raw Material BOM (Stock Deduction on Order) */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-slate-800">
                    Recipe &amp; Raw Material BOM (Kitchen Stock Deduction)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Auto-deducts warehouse raw materials on confirmed POS orders
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <select
                  value={recipeSelectItemId}
                  onChange={(e) => setRecipeSelectItemId(e.target.value)}
                  className="sm:col-span-6 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium"
                >
                  <option value="">-- Choose Raw Ingredient from Warehouse --</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.code}) • In Stock: {inv.currentStock} {inv.unit}
                    </option>
                  ))}
                </select>
                <div className="sm:col-span-4 flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min={0.001}
                    value={recipeQtyInput}
                    onChange={(e) =>
                      setRecipeQtyInput(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Qty per portion"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                  />
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap min-w-[36px]">
                    {inventoryItems.find((i) => i.id === recipeSelectItemId)?.unit || 'Unit'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!recipeSelectItemId) {
                      showToast('Select an inventory ingredient from the list.', 'warning');
                      return;
                    }
                    const qty = Number(recipeQtyInput) || 0;
                    if (qty <= 0) {
                      showToast('Enter a valid quantity per portion greater than 0.', 'warning');
                      return;
                    }
                    const inv = inventoryItems.find((i) => i.id === recipeSelectItemId);
                    if (!inv) return;
                    if (newItemRecipeIngredients.some((ri) => ri.inventoryItemId === inv.id)) {
                      showToast('Ingredient already added to this recipe.', 'warning');
                      return;
                    }
                    setNewItemRecipeIngredients((prev) => [
                      ...prev,
                      {
                        inventoryItemId: inv.id,
                        ingredientName: inv.name,
                        quantity: qty,
                        unit: inv.unit,
                      },
                    ]);
                    setRecipeSelectItemId('');
                    setRecipeQtyInput('');
                  }}
                  className="sm:col-span-2 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  + Add BOM
                </button>
              </div>

              {newItemRecipeIngredients.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {newItemRecipeIngredients.map((ing, idx) => {
                    const invStock = inventoryItems.find((i) => i.id === ing.inventoryItemId)?.currentStock ?? 0;
                    return (
                      <span
                        key={ing.inventoryItemId}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                          invStock <= 0
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-white text-slate-800 border-amber-300 shadow-2xs'
                        }`}
                      >
                        <span>
                          {ing.ingredientName}: <strong>{ing.quantity} {ing.unit}</strong>
                          <span className="text-[10px] text-slate-500 ml-1">({invStock} in stock)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setNewItemRecipeIngredients((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  No warehouse ingredients linked yet. When linked, ordering this dish automatically reduces raw material stock.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Product Image URL</label>
                <input
                  type="text"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Description</label>
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Chef special aromatic preparation"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Meal Availability Windows
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(['All Day', 'Breakfast', 'Lunch', 'Dinner'] as const).map((mw) => {
                    const checked = newItemMeals.includes(mw);
                    return (
                      <button
                        key={mw}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? newItemMeals.filter((w) => w !== mw)
                            : [...newItemMeals, mw];
                          setNewItemMeals(next.length ? next : ['All Day']);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold border cursor-pointer ${
                          checked
                            ? 'bg-slate-900 text-amber-400 border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {mw}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newItemStockTrack}
                    onChange={(e) => setNewItemStockTrack(e.target.checked)}
                  />
                  Track Stock
                </label>
                {newItemStockTrack && (
                  <input
                    type="number"
                    min={0}
                    value={newItemStockQty}
                    onChange={(e) => setNewItemStockQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Qty"
                    className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                  />
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                {editingMenuItemId && (
                  <button
                    type="button"
                    onClick={resetCatalogForm}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold cursor-pointer"
                >
                  {editingMenuItemId ? 'Update Product' : '+ Add Product'}
                </button>
              </div>
            </div>
          </form>

          {/* Catalog Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search products by name, SKU code or category..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set(['ALL', ...menuItems.map((m) => m.category)])).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCatalogCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    catalogCatFilter === cat ? 'bg-slate-900 text-amber-400' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Dish &amp; Details</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Station &amp; Meals</th>
                  <th className="py-2.5 px-3">Portions / Add-ons</th>
                  <th className="py-2.5 px-3">Price / GST</th>
                  <th className="py-2.5 px-3">Availability</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menuItems
                  .filter((item) => {
                    if (catalogCatFilter !== 'ALL' && item.category !== catalogCatFilter) return false;
                    if (!catalogSearch.trim()) return true;
                    const q = catalogSearch.toLowerCase();
                    return (
                      item.name.toLowerCase().includes(q) ||
                      item.code.toLowerCase().includes(q) ||
                      item.category.toLowerCase().includes(q)
                    );
                  })
                  .map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 ${item.isActive === false ? 'opacity-50' : ''}`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{item.code}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        {item.description && <div className="text-[10px] text-slate-500">{item.description}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{item.category}</div>
                        {item.subCategory && <div className="text-[10px] text-slate-400">{item.subCategory}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.isVeg ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.isVeg ? 'VEG' : 'NON-VEG'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{item.kitchenStation}</div>
                        <div className="text-[10px] text-slate-400">
                          {(item.mealWindows || ['All Day']).join(', ')}
                          {item.prepTime ? ` • ${item.prepTime}m` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[10.5px] text-slate-600">
                        {item.variants && item.variants.length > 0 ? (
                          <div>Portions: {item.variants.map((v) => `${v.name} ₹${v.price}`).join(', ')}</div>
                        ) : (
                          <span className="text-slate-400">Standard</span>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-[10px] text-amber-700">
                            Add-ons: {item.addons.map((a) => `${a.name} +₹${a.price}`).join(', ')}
                          </div>
                        )}
                        {item.recipeIngredients && item.recipeIngredients.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.recipeIngredients.map((ri) => {
                              const inv = inventoryItems.find((i) => i.id === ri.inventoryItemId);
                              const stock = inv ? inv.currentStock : undefined;
                              const isOut = stock !== undefined && stock <= 0;
                              const isLow = stock !== undefined && inv && stock <= inv.minStock;
                              return (
                                <span
                                  key={ri.inventoryItemId}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] ${
                                    isOut
                                      ? 'bg-rose-100 text-rose-800 font-extrabold border border-rose-300'
                                      : isLow
                                      ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                  title={isOut ? 'Raw ingredient out of stock in warehouse!' : isLow ? 'Low stock in warehouse!' : ''}
                                >
                                  {isOut ? '🚨 ' : isLow ? '⚠️ ' : '🥬 '}
                                  {ri.ingredientName}: {ri.quantity} {ri.unit}
                                  {stock !== undefined ? ` (${stock} left)` : ''}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900">{formatCurrency(item.price)}</div>
                        <div className="text-[10px] text-slate-400">
                          GST {item.taxRate ?? configuredFnbGst}%
                          {item.costPrice ? ` • Cost ₹${item.costPrice}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMenuItem && onUpdateMenuItem({ ...item, available: !item.available })
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer w-fit ${
                              item.available
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.available ? 'Available' : 'Out of Stock'}
                          </button>
                          {item.stockTracking && (
                            <span className="text-[10px] font-bold text-slate-500">
                              Stock: {item.currentStock ?? 0}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMenuItem &&
                              onUpdateMenuItem({ ...item, isActive: item.isActive === false ? true : false })
                            }
                            className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold text-[10.5px] cursor-pointer"
                          >
                            {item.isActive === false ? 'Activate' : 'Archive'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditMenuItem(item)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMenuItem && onDeleteMenuItem(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. RESTAURANT TABLES VIEW (AVAILABLE -> RESERVED -> OCCUPIED -> BILLING) */}
      {/* ===================================================================== */}
      {activeSubTab === 'tables' && (
        <div className="space-y-4">
          <div
            className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-3 transition-all ${
              editingTableOriginalNo ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200/80'
            }`}
          >
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingTableOriginalNo
                  ? `Edit Restaurant Table: ${editingTableOriginalNo}`
                  : 'Restaurant Floor Tables (Available → Reserved → Occupied → Billing → Available)'}
              </h3>
              <p className="text-xs text-slate-500">
                {editingTableOriginalNo
                  ? 'Update Table Number, Seating Capacity, or Floor/Section and click Save Table.'
                  : '"Reserved" is shown only when an active Advance Restaurant Booking is allocated to that table today.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={newTableNo}
                onChange={(e) => setNewTableNo(e.target.value)}
                placeholder="Table # (e.g. T-09)"
                className="w-28 px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold"
              />
              <input
                type="number"
                min={1}
                value={newTableCap}
                onChange={(e) => setNewTableCap(Math.max(1, Number(e.target.value) || 4))}
                placeholder="Seats"
                className="w-20 px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold"
              />
              <input
                type="text"
                value={newTableFloor}
                onChange={(e) => setNewTableFloor(e.target.value)}
                placeholder="Section (Main Hall)"
                className="w-32 px-2.5 py-1.5 rounded-xl border border-slate-200"
              />
              <button
                type="button"
                onClick={handleAddTable}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                {editingTableOriginalNo ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Save Table
                  </>
                ) : (
                  '+ Add Table'
                )}
              </button>
              {editingTableOriginalNo && (
                <button
                  type="button"
                  onClick={handleCancelEditTable}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {tableConfigs.map((tbl) => {
              const live = getTableLiveStatus(tbl.tableNumber);
              const isEditingThisTable = editingTableOriginalNo === tbl.tableNumber;
              return (
                <div
                  key={tbl.tableNumber}
                  onClick={() => {
                    if (live.openCheck && live.openCheck.orders.length > 0) {
                      handleLoadOrderIntoTicket(live.openCheck.orders[live.openCheck.orders.length - 1]);
                    }
                  }}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                    isEditingThisTable ? 'ring-2 ring-amber-400 ' : ''
                  }${live.openCheck ? 'cursor-pointer ' : ''}${
                    live.status === 'Billing'
                      ? 'bg-purple-50 border-purple-300'
                      : live.status === 'Occupied'
                      ? 'bg-amber-50 border-amber-300'
                      : live.status === 'Reserved'
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-slate-200 hover:border-emerald-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-base font-extrabold text-slate-900">{tbl.tableNumber}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditTable(tbl);
                          }}
                          title="Edit table number, seats or section"
                          className="px-2 py-0.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <Pencil className="w-2.5 h-2.5" /> Edit
                        </button>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            live.status === 'Billing'
                              ? 'bg-purple-200 text-purple-900'
                              : live.status === 'Occupied'
                              ? 'bg-amber-200 text-amber-900'
                              : live.status === 'Reserved'
                              ? 'bg-blue-200 text-blue-900'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {live.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Capacity: {tbl.capacity} Seats • {tbl.floor || 'Main Hall'}
                    </div>

                    {live.openCheck && (
                      <div className="mt-2 p-2 rounded-xl bg-white/80 border border-amber-200 text-[11px] space-y-0.5">
                        <div className="font-bold text-slate-800">
                          {live.openCheck.orders.length} Running KOT(s)
                        </div>
                        <div className="font-extrabold text-amber-800">
                          Outstanding: {formatCurrency(live.openCheck.due)}
                        </div>
                      </div>
                    )}

                    {live.reservation && !live.openCheck && (
                      <div className="mt-2 p-2 rounded-xl bg-white/80 border border-blue-200 text-[11px] space-y-0.5">
                        <div className="font-bold text-blue-900">{live.reservation.guestOrGroupName}</div>
                        <div className="text-blue-700">
                          {live.reservation.eventTime || 'Reserved'} • {live.reservation.pax} Guests
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {live.openCheck ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleLoadOrderIntoTicket(
                              live.openCheck!.orders[live.openCheck!.orders.length - 1]
                            )
                          }
                          className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" /> Edit Order
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCart([]);
                            resetBillingState();
                            setOrderType('Dine In');
                            setTableNumber(tbl.tableNumber);
                            onSubTabChange('terminal');
                          }}
                          className="py-1.5 px-2 rounded-lg bg-slate-900 text-amber-400 text-[11px] font-bold cursor-pointer"
                        >
                          + Items
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSettleTable(tbl.tableNumber);
                            setSettleAmount(live.openCheck!.due);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Settle
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingOrder) {
                              setCart([]);
                              resetBillingState();
                            }
                            setOrderType('Dine In');
                            setTableNumber(tbl.tableNumber);
                            onSubTabChange('terminal');
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 text-amber-400 text-[11px] font-bold cursor-pointer"
                        >
                          Open Table
                        </button>
                        {tableConfigs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTable(tbl.tableNumber)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove table"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. COMPLETE KOT SYSTEM, LIVE KDS & CURRENT ORDERS                     */}
      {/* ===================================================================== */}
      {(activeSubTab === 'kds' ||
        activeSubTab === 'orders' ||
        activeSubTab === 'orders_current') && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {activeSubTab === 'kds' && posCapabilities.kdsEnabled
                  ? 'Kitchen Display System (KDS) — Live KOT Routing & Preparation'
                  : 'Current POS Orders, Preparation Status & Live Billing'}
              </h3>
              <p className="text-xs text-slate-500">
                {posCapabilities.kotEnabled
                  ? 'Workflow: Order Created → KOT Sent → Kitchen Accepted → Preparing → Ready → Served / Delivered → Paid / Closed'
                  : 'In-House Kitchen is OFF — Direct Order Fulfillment, Delivery & Settlement'}
              </p>
            </div>
            {posCapabilities.kdsEnabled && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', 'Main Kitchen', 'Tandoor', 'Beverage Bar', 'Bakery'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setKdsStationFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      kdsStationFilter === st
                        ? 'bg-slate-900 text-amber-400'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All Kitchen Stations' : st}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders
              .filter((o) => {
                if (activeSubTab === 'orders_current') {
                  if (o.kotStatus === 'Cancelled') return false;
                  const isClosed =
                    o.kotStatus === 'Served' &&
                    (o.paymentStatus === 'Paid' || o.paymentStatus === 'Unpaid (Room Folio)');
                  if (isClosed && !o.isHeld) return false;
                } else if (o.isHeld) {
                  return false;
                }
                if (!posCapabilities.kdsEnabled || kdsStationFilter === 'ALL') return true;
                return o.items.some((i) => {
                  const found = menuItems.find((m) => m.id === i.itemId);
                  return (found?.kitchenStation || 'Main Kitchen') === kdsStationFilter;
                });
              })
              .map((order) => {
                const liveStage = getLiveOrderStageLabel(order);
                const isCancelled = order.kotStatus === 'Cancelled';
                return (
                  <div
                    key={order.id}
                    className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-between space-y-3 ${
                      isCancelled ? 'border-rose-200 bg-rose-50/40 opacity-75' : 'border-slate-200/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900">{order.orderNumber}</span>
                            {order.kotNumber && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 text-[10px] font-mono font-bold">
                                {order.kotNumber}
                              </span>
                            )}
                            {order.isSupplementaryKot && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9.5px] font-bold">
                                SUPP. KOT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-amber-700 mt-0.5">
                            {order.orderType} •{' '}
                            {order.roomNumber ? `Room ${order.roomNumber}` : `Table ${order.tableNumber || 'Counter'}`}
                            {order.customerName ? ` • ${order.customerName}` : ''}
                            {order.pax ? ` • ${order.pax} PAX` : ''}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {order.dateTime}
                            {order.waiterName ? ` • Waiter: ${order.waiterName}` : ''}
                            {order.reprintCount ? ` • Reprinted ${order.reprintCount}x` : ''}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isCancelled
                                ? 'bg-rose-100 text-rose-800'
                                : order.kotStatus === 'Ready'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.kotStatus === 'Preparing' || order.kotStatus === 'Kitchen Accepted'
                                ? 'bg-amber-100 text-amber-800'
                                : order.kotStatus === 'Served'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {order.kotStatus}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold ${liveStage.color}`}>
                            {liveStage.label}
                          </span>
                        </div>
                      </div>

                      {/* Item List with Portion, Station, Add-ons, Chef Notes & Exact Portion Price */}
                      <div className="space-y-1.5 mt-3">
                        {order.items.map((it, idx) => {
                          const itemSt = it.itemStatus || 'KOT Sent';
                          const cleanName = cleanOrderItemBaseName(it.name, it.variant);
                          const stationName =
                            it.kitchenStation ||
                            menuItems.find((m) => m.id === it.itemId)?.kitchenStation ||
                            'Main Kitchen';
                          return (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold flex flex-wrap items-center gap-1">
                                  <span>
                                    {it.qty}x {cleanName}
                                  </span>
                                  {it.variant ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-200">
                                      {it.variant}
                                    </span>
                                  ) : null}
                                  <span className="text-[9.5px] font-bold text-slate-400">
                                    • {stationName}
                                  </span>
                                </div>
                                {it.addons && it.addons.length > 0 && (
                                  <div className="text-[10px] text-slate-600 font-medium">
                                    + Add-ons: {it.addons.join(', ')}
                                  </div>
                                )}
                                {it.itemNotes && (
                                  <div className="text-[10px] text-rose-700 font-semibold">
                                    Chef Note: {it.itemNotes}
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-400">
                                  {formatCurrency(it.price)} × {it.qty}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSingleItemStatus(order, idx)}
                                    title="Click to advance item preparation status"
                                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold cursor-pointer ${
                                      itemSt === 'Served'
                                        ? 'bg-slate-200 text-slate-700'
                                        : itemSt === 'Ready'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {itemSt}
                                  </button>
                                )}
                                <span className="font-bold">{formatCurrency(r2(it.qty * it.price))}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Takeaway Pickup Status Controls */}
                      {order.orderType === 'Takeaway' && !isCancelled && (
                        <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700">
                            Pickup: {order.pickupStatus || 'Preparing'}
                            {order.pickupTime ? ` (${order.pickupTime})` : ''}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdatePosOrder &&
                                onUpdatePosOrder({ ...order, pickupStatus: 'Ready for Pickup', kotStatus: 'Ready' })
                              }
                              className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] cursor-pointer"
                            >
                              Ready for Pickup
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdatePosOrder &&
                                onUpdatePosOrder({
                                  ...order,
                                  pickupStatus: 'Picked Up / Delivered',
                                  kotStatus: 'Served',
                                })
                              }
                              className="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-bold text-[10px] cursor-pointer"
                            >
                              Picked Up
                            </button>
                          </div>
                        </div>
                      )}

                      {order.voidReason && (
                        <div className="mt-2 p-2 rounded-xl bg-rose-100/80 border border-rose-200 text-[10.5px] text-rose-900">
                          <strong>Void / Cancel Reason:</strong> {order.voidReason} ({order.voidedBy})
                          {order.refundAmount ? ` • Refunded: ${formatCurrency(order.refundAmount)}` : ''}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-500 font-medium">{order.paymentStatus}</span>
                          {(order.balanceDue ?? 0) > 0 && !isCancelled && (
                            <span className="ml-1.5 text-[10.5px] font-extrabold text-rose-600">
                              (Due: {formatCurrency(order.balanceDue || 0)})
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-extrabold text-slate-900">
                          {formatCurrency(order.grandTotal)}
                        </span>
                      </div>

                      {/* KOT Stage Transitions (adapts when In-House Kitchen is OFF) */}
                      {!isCancelled && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {posCapabilities.kotEnabled ? (
                            <>
                              {order.kotStatus === 'KOT Sent' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceKotStage(order, 'Kitchen Accepted')}
                                  className="col-span-2 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                                >
                                  Accept KOT in Kitchen
                                </button>
                              )}
                              {(order.kotStatus === 'KOT Sent' || order.kotStatus === 'Kitchen Accepted') && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceKotStage(order, 'Preparing')}
                                  className="col-span-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
                                >
                                  Start Preparing
                                </button>
                              )}
                              {order.kotStatus === 'Preparing' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceKotStage(order, 'Ready')}
                                  className="col-span-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                                >
                                  Mark Food Ready
                                </button>
                              )}
                              {order.kotStatus === 'Ready' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceKotStage(order, 'Served')}
                                  className="col-span-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold cursor-pointer"
                                >
                                  {order.orderType === 'Room Service'
                                    ? 'Mark Delivered to Room'
                                    : order.orderType === 'Takeaway'
                                    ? 'Mark Handed Over'
                                    : 'Mark Served at Table'}
                                </button>
                              )}
                            </>
                          ) : (
                            order.kotStatus !== 'Served' && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceKotStage(order, 'Served')}
                                className="col-span-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold cursor-pointer"
                              >
                                {order.orderType === 'Room Service'
                                  ? 'Mark Delivered to Room'
                                  : 'Mark Served / Completed'}
                              </button>
                            )
                          )}
                        </div>
                      )}

                      {/* Edit Order, Print KOT (only when Kitchen=ON), Food Bill, Settle & Void */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleLoadOrderIntoTicket(order)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl border border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                            title="Load into POS Billing Terminal to edit items, quantities, guest or table"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                        {posCapabilities.kotPrintingEnabled && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPrintingKotOrder({ order, isReprint: false })}
                              className="flex-1 py-1.5 px-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" /> KOT
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReprintKot(order)}
                              className="flex-1 py-1.5 px-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" /> Reprint
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setPrintingFoodOrder(order)}
                          className="flex-1 py-1.5 px-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Bill
                        </button>
                        {!isCancelled && order.paymentStatus !== 'Unpaid (Room Folio)' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOrderPaymentModal(order);
                              setOrderPayAmtInput(order.balanceDue ?? (order.grandTotal - (order.amountPaid || 0)));
                              setOrderPayCashTendered('');
                              setOrderPayUpiUtr('');
                              setOrderPayUpiVerified(false);
                            }}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" /> {(order.balanceDue ?? 0) > 0 ? `Settle (₹${order.balanceDue})` : 'Payments'}
                          </button>
                        )}
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => {
                              setVoidModalOrder(order);
                              setVoidReasonInput('');
                              setRefundAmountInput(order.amountPaid || 0);
                              setReverseStockOnVoid(true);
                            }}
                            className="py-1.5 px-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. 15-SECTION POS REPORTS & ANALYTICS DASHBOARD                       */}
      {/* ===================================================================== */}
      {activeSubTab === 'reports' && (
        <div className="space-y-5">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Net POS Revenue</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {formatCurrency(reportData.totalSales)}
              </div>
              <div className="text-[10px] text-slate-500">{reportData.activeOrders.length} active orders</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Today POS Sales</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">
                {formatCurrency(reportData.todaySales)}
              </div>
              <div className="text-[10px] text-slate-500">{reportData.todayOrders.length} orders today</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Total F&amp;B GST</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {formatCurrency(reportData.totalTax)}
              </div>
              <div className="text-[10px] text-slate-500">
                CGST {formatCurrency(reportData.totalTax / 2)} + SGST {formatCurrency(reportData.totalTax / 2)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Discounts Given</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1">
                {formatCurrency(reportData.totalDiscount)}
              </div>
              <div className="text-[10px] text-slate-500">
                {reportData.overrideRows.length} price overrides
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Outstanding / Open Checks</div>
              <div className="text-lg font-extrabold text-rose-600 mt-1">
                {formatCurrency(
                  reportData.unpaidOrders.reduce((s, o) => s + (o.balanceDue ?? o.grandTotal), 0)
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                {openChecks.length} open tables • {heldOrdersList.length} held
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Voided / Refunded</div>
              <div className="text-lg font-extrabold text-rose-700 mt-1">
                {reportData.voidedOrders.length} Orders
              </div>
              <div className="text-[10px] text-slate-500">
                Refunds: {formatCurrency(reportData.totalRefunded)}
              </div>
            </div>
          </div>

          {/* Order Mode Breakdown + Payment Method Breakdown + KOT Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Sales by Order Mode (Dine-In / Takeaway / Room Service)
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                  <span className="font-bold text-slate-700">Dine-In Revenue</span>
                  <span className="font-extrabold text-slate-900">{formatCurrency(reportData.dineInSales)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                  <span className="font-bold text-slate-700">Takeaway Revenue</span>
                  <span className="font-extrabold text-slate-900">{formatCurrency(reportData.takeawaySales)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="font-bold text-amber-900">Room Service Revenue (PMS Linked)</span>
                  <span className="font-extrabold text-amber-900">{formatCurrency(reportData.roomServiceSales)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Payment Method &amp; Cashier Closing Breakdown
              </h4>
              <div className="space-y-1.5 text-xs">
                {Object.entries(reportData.byMethod).map(([method, amt]) => (
                  <div key={method} className="flex justify-between py-1.5 px-2.5 rounded-lg bg-slate-50">
                    <span className="font-semibold text-slate-700">{method}</span>
                    <span className="font-extrabold text-slate-900">{formatCurrency(Number(amt) || 0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                KOT Kitchen Status &amp; Advance Bookings Summary
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-amber-50">
                  <span className="font-bold text-amber-900">Pending / Preparing Kitchen KOTs</span>
                  <span className="font-extrabold text-amber-900">{reportData.pendingKotCount}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-emerald-50">
                  <span className="font-bold text-emerald-900">Ready to Serve KOTs</span>
                  <span className="font-extrabold text-emerald-900">{reportData.readyKotCount}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-slate-50">
                  <span className="font-bold text-slate-700">Served / Delivered KOTs</span>
                  <span className="font-extrabold text-slate-900">{reportData.servedKotCount}</span>
                </div>
                <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-blue-50">
                  <span className="font-bold text-blue-900">Advance Restaurant Bookings</span>
                  <span className="font-extrabold text-blue-900">
                    {posAdvanceBookings.length} (Deposits:{' '}
                    {formatCurrency(posAdvanceBookings.reduce((s, b) => s + (Number(b.advanceAmount) || 0), 0))})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sales by Product & Sales by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Sales by Product
              </h4>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                {Object.values(reportData.byProduct)
                  .sort((a: any, b: any) => (Number(b?.revenue) || 0) - (Number(a?.revenue) || 0))
                  .map((p: any) => (
                    <div key={p.name} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="ml-2 text-[10px] text-slate-400">({p.category})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-600 mr-3">{p.qty} sold</span>
                        <span className="font-extrabold text-slate-900">{formatCurrency(p.revenue)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Sales by Category
              </h4>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                {Object.entries(reportData.byCategory)
                  .sort((a: any, b: any) => (Number(b?.[1]?.revenue) || 0) - (Number(a?.[1]?.revenue) || 0))
                  .map(([cat, stats]: [string, any]) => (
                    <div key={cat} className="py-2 flex items-center justify-between">
                      <span className="font-bold text-slate-800">{cat}</span>
                      <div>
                        <span className="font-bold text-slate-600 mr-3">{stats.qty} items</span>
                        <span className="font-extrabold text-slate-900">{formatCurrency(stats.revenue)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Audit Table: Item-Level Price Overrides & Voided Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Item-Level Price Overrides Audit Trail
              </h4>
              {reportData.overrideRows.length === 0 ? (
                <div className="text-xs text-slate-400 py-4">No item-level price overrides recorded yet.</div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {reportData.overrideRows.map((ov, i) => (
                    <div key={i} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">
                          {ov.itemName} ({ov.orderNo})
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Reason: {ov.reason} • Approved by: {ov.approvedBy}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-[10px] line-through text-slate-400">
                          {formatCurrency(ov.originalPrice)}
                        </div>
                        <div className="font-extrabold text-amber-700">{formatCurrency(ov.newPrice)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Cancelled / Voided Orders &amp; Refunds Audit
              </h4>
              {reportData.voidedOrders.length === 0 ? (
                <div className="text-xs text-slate-400 py-4">No cancelled or voided orders recorded.</div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {reportData.voidedOrders.map((vo) => (
                    <div key={vo.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-rose-800">{vo.orderNumber}</div>
                        <div className="text-[10px] text-slate-500">
                          Reason: {vo.voidReason || 'Cancelled'} • By: {vo.voidedBy || 'Manager'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-700">Bill: {formatCurrency(vo.grandTotal)}</div>
                        <div className="text-[10px] font-bold text-rose-600">
                          Refund: {formatCurrency(vo.refundAmount || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. DIGITAL QR MENU STANDEE                                            */}
      {/* ===================================================================== */}
      {activeSubTab === 'qr_menu' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm max-w-2xl mx-auto text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center mx-auto">
            <QrCode className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">
            In-Room &amp; Table Digital Menu QR Ordering
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Place this QR code standee on restaurant tables and inside guest rooms. Guests scan to browse live availability, place room-service orders and track KOT preparation.
          </p>
          <div className="p-6 rounded-2xl bg-slate-900 text-white max-w-xs mx-auto space-y-2">
            <div className="w-36 h-36 mx-auto bg-white rounded-xl p-3 flex items-center justify-center">
              <QrCode className="w-28 h-28 text-slate-900" />
            </div>
            <div className="text-xs font-bold text-amber-400">SCAN FOR LIVE MENU</div>
            <div className="text-[10px] text-slate-400">{hotelName} • Room Service &amp; Table Ordering</div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-slate-900 text-amber-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Table QR Standee Card
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. ADVANCE RESTAURANT BOOKING TAB (GUARDED WHEN RESTAURANT IS OFF)    */}
      {/* ===================================================================== */}
      {activeSubTab === 'advance_booking' &&
        (posCapabilities.tableReservationsEnabled ? (
          <FoodAdvanceBookingPanel
            bookings={posAdvanceBookings}
            hotelName={hotelName}
            loggedInUser={loggedInUser}
            availableTables={tableConfigs.map((t) => t.tableNumber)}
            initialEditBookingId={pendingEditAdvanceId}
            onClearInitialEdit={() => setPendingEditAdvanceId(null)}
            onUpdateBookings={(updated) =>
              onUpdatePosAdvanceBookings && onUpdatePosAdvanceBookings(updated)
            }
            onCreatePosOrderFromAdvance={(booking) => {
              handleConvertAdvanceToLive(booking);
              onSubTabChange('terminal');
            }}
          />
        ) : (
          <div className="bg-white p-8 rounded-2xl border border-[#E8DEC8] text-center space-y-3 max-w-xl mx-auto">
            <div className="text-base font-serif font-extrabold text-[#17120F]">
              Table Reservations Disabled (Room Service Only Mode)
            </div>
            <p className="text-xs text-slate-500">
              In-House Café / Restaurant is currently set to <strong>NO</strong> for {hotelName}. All{' '}
              {posAdvanceBookings.length} existing reservation record(s) are safely preserved. Enable In-House Café / Restaurant in POS Settings to manage table reservations.
            </p>
            <button
              type="button"
              onClick={() => onSubTabChange('settings')}
              className="px-4 py-2 rounded-xl bg-[#17120F] text-[#F5D88A] font-bold text-xs cursor-pointer"
            >
              Open POS Settings →
            </button>
          </div>
        ))}

      {/* ===================================================================== */}
      {/* 8. ORDER HISTORY TAB (/pos/orders/history)                            */}
      {/* ===================================================================== */}
      {activeSubTab === 'orders_history' && (
        <div className="bg-white p-5 rounded-2xl border border-[#E8DEC8] shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-base font-serif font-extrabold text-[#17120F]">
                POS Order History &amp; Invoices
              </h3>
              <p className="text-xs text-slate-500">
                Complete historical ledger of all POS orders (Dine-In, Takeaway &amp; Room Service), custom item prices, GST invoices and payment settlements.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search order #, guest, room/table..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-[#FAF7F0] text-xs w-56"
                />
              </div>
              <input
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              />
              {historyDateFilter && (
                <button
                  type="button"
                  onClick={() => setHistoryDateFilter('')}
                  className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer"
                >
                  All Dates
                </button>
              )}
              <select
                value={historyModeFilter}
                onChange={(e) => setHistoryModeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold"
              >
                <option value="ALL">All Order Modes</option>
                <option value="Dine In">Dine In</option>
                <option value="Takeaway">Takeaway</option>
                <option value="Room Service">Room Service</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                  <th className="py-2.5 px-3">Order / KOT</th>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Mode &amp; Target</th>
                  <th className="py-2.5 px-3">Guest</th>
                  <th className="py-2.5 px-3">Items Ordered</th>
                  <th className="py-2.5 px-3 text-right">Subtotal / GST</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3">Payment Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders
                  .filter((o) => {
                    if (o.isHeld) return false;
                    if (historyModeFilter !== 'ALL' && o.orderType !== historyModeFilter) return false;
                    if (historyDateFilter && !String(o.dateTime || '').startsWith(historyDateFilter)) {
                      return false;
                    }
                    const q = historySearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      o.orderNumber.toLowerCase().includes(q) ||
                      String(o.kotNumber || '').toLowerCase().includes(q) ||
                      o.customerName.toLowerCase().includes(q) ||
                      String(o.roomNumber || o.tableNumber || '').toLowerCase().includes(q) ||
                      o.items.some((i) => i.name.toLowerCase().includes(q))
                    );
                  })
                  .map((ord) => (
                    <tr key={ord.id} className="hover:bg-[#FAF7F0]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#17120F]">
                        <div>{ord.orderNumber}</div>
                        {ord.kotNumber && posCapabilities.kotEnabled && (
                          <div className="text-[10px] text-[#8C7355]">{ord.kotNumber}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{ord.dateTime}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800">{ord.orderType}</span>
                        <div className="text-[10px] text-amber-800 font-semibold">
                          {ord.roomNumber
                            ? `Room ${ord.roomNumber}`
                            : ord.tableNumber
                            ? `Table ${ord.tableNumber}`
                            : 'Counter'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{ord.customerName}</div>
                        {ord.customerPhone && (
                          <div className="text-[10px] text-slate-400 font-mono">{ord.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 max-w-[260px]">
                        <div className="truncate font-medium text-slate-700">
                          {ord.items
                            .map((i) => `${i.qty}x ${i.name} (₹${i.price})`)
                            .join(', ')}
                        </div>
                        {ord.priceOverrides && ord.priceOverrides.length > 0 && (
                          <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                            Custom Price Override ({ord.priceOverrides.length})
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        <div>{formatCurrency(ord.subtotal)}</div>
                        <div className="text-[10px] text-slate-400">
                          GST: {formatCurrency(ord.taxAmount)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#17120F]">
                        {formatCurrency(ord.grandTotal)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.kotStatus === 'Cancelled'
                              ? 'bg-rose-100 text-rose-800'
                              : ord.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.paymentStatus === 'Unpaid (Room Folio)'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ord.kotStatus === 'Cancelled' ? 'Void / Cancelled' : ord.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrintingFoodOrder(ord)}
                            className="px-2.5 py-1 rounded-lg bg-[#17120F] text-[#F5D88A] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" /> Invoice
                          </button>
                          {ord.kotStatus !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidModalOrder(ord);
                                setVoidReasonInput('');
                                setRefundAmountInput(ord.amountPaid || '');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] cursor-pointer"
                              title="Void / Cancel this order"
                            >
                              Void
                            </button>
                          )}
                          {ord.kotStatus !== 'Cancelled' &&
                            ord.paymentStatus !== 'Unpaid (Room Folio)' &&
                            (ord.balanceDue ?? 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOrderPaymentModal(ord);
                                  setOrderPayAmtInput(ord.balanceDue || 0);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                              >
                                Settle
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

      {/* ===================================================================== */}
      {/* 9. POS CONFIGURATION SETTINGS (/pos/settings)                         */}
      {/* ===================================================================== */}
      {activeSubTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-[#E8DEC8] shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900">
                  Property-Scoped POS Settings
                </span>
                <h2 className="text-lg font-serif font-extrabold text-[#17120F] mt-1">
                  POS Configuration Settings — {hotelName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure kitchen KOT/KDS operations and café/restaurant dining modes for this property. Existing orders, menus, tables and folios are always preserved when switching modes.
                </p>
              </div>
            </div>

            {/* TWO CORE ON/OFF SWITCHES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Switch 1: In-House Kitchen Available? */}
              <div
                className={`p-5 rounded-2xl border-2 transition ${
                  posCapabilities.inHouseKitchenAvailable
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-[#17120F] flex items-center gap-2">
                      <ChefHat className="w-4 h-4 text-[#B08326]" />
                      <span>In-House Kitchen Available?</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      <strong>YES:</strong> Enables KOT generation, 80mm thermal KOT printing, supplementary KOTs and live Kitchen Display System (KDS).
                      <br />
                      <strong>NO:</strong> Hides/disables KOT printing and Kitchen Display options for direct billing &amp; delivery.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Current Status:{' '}
                    <strong
                      className={
                        posCapabilities.inHouseKitchenAvailable
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                      }
                    >
                      {posCapabilities.inHouseKitchenAvailable ? 'YES (Enabled)' : 'NO (Disabled)'}
                    </strong>
                  </span>
                  <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      data-testid="toggle-kitchen-yes"
                      onClick={() =>
                        handleSavePosFacilitySettings({ inHouseKitchenAvailable: true })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        posCapabilities.inHouseKitchenAvailable
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      data-testid="toggle-kitchen-no"
                      onClick={() =>
                        handleSavePosFacilitySettings({ inHouseKitchenAvailable: false })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        !posCapabilities.inHouseKitchenAvailable
                          ? 'bg-slate-900 text-amber-400 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>

              {/* Switch 2: In-House Café / Restaurant Available? */}
              <div
                className={`p-5 rounded-2xl border-2 transition ${
                  posCapabilities.inHouseRestaurantAvailable
                    ? 'border-amber-300 bg-amber-50/40'
                    : 'border-blue-200 bg-blue-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-[#17120F] flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-[#B08326]" />
                      <span>In-House Café / Restaurant Available?</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      <strong>YES:</strong> Enables Dine-In, Restaurant Tables, Table Reservations, Takeaway and Room Service.
                      <br />
                      <strong>NO:</strong> Shows <strong>only Room Service</strong> in the POS interface while preserving all historical Dine-In &amp; Reservation records.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Current Status:{' '}
                    <strong
                      className={
                        posCapabilities.inHouseRestaurantAvailable
                          ? 'text-amber-800'
                          : 'text-blue-800'
                      }
                    >
                      {posCapabilities.inHouseRestaurantAvailable
                        ? 'YES (Full Outlet)'
                        : 'NO (Room Service Only)'}
                    </strong>
                  </span>
                  <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      data-testid="toggle-restaurant-yes"
                      onClick={() =>
                        handleSavePosFacilitySettings({ inHouseRestaurantAvailable: true })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        posCapabilities.inHouseRestaurantAvailable
                          ? 'bg-[#17120F] text-[#F5D88A] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      data-testid="toggle-restaurant-no"
                      onClick={() =>
                        handleSavePosFacilitySettings({ inHouseRestaurantAvailable: false })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        !posCapabilities.inHouseRestaurantAvailable
                          ? 'bg-blue-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Outlet Name & F&B Tax Configuration */}
            <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E8DEC8] grid grid-cols-1 md:grid-cols-3 gap-3 items-end text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#7A6A53] mb-1">
                  POS Outlet Display Name
                </label>
                <input
                  type="text"
                  value={outletNameInput}
                  onChange={(e) => setOutletNameInput(e.target.value)}
                  placeholder="e.g. Main Restaurant & Room Service"
                  className="w-full px-3 py-2 rounded-xl border border-[#DFD3BA] bg-white font-bold text-[#17120F]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#7A6A53] mb-1">
                  Default F&amp;B GST Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={fnbGstRateInput}
                  onChange={(e) => setFnbGstRateInput(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-[#DFD3BA] bg-white font-bold text-[#17120F]"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    handleSavePosFacilitySettings({
                      posOutletName: outletNameInput,
                      foodGstRate: fnbGstRateInput,
                    })
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-[#17120F] hover:bg-black text-[#F5D88A] font-extrabold text-xs cursor-pointer"
                >
                  Save Outlet &amp; Tax Preferences
                </button>
              </div>
            </div>

            {/* Quick Management Links */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onSubTabChange('catalog')}
                className="px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#F3E8D0] border border-[#DFC078] text-[#17120F] font-bold text-xs cursor-pointer"
              >
                Manage Menu &amp; Recipe Master ({menuItems.length} Products) →
              </button>
              {posCapabilities.tablesEnabled && (
                <button
                  type="button"
                  onClick={() => onSubTabChange('tables')}
                  className="px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#F3E8D0] border border-[#DFC078] text-[#17120F] font-bold text-xs cursor-pointer"
                >
                  Manage Restaurant Tables ({tableConfigs.length} Tables) →
                </button>
              )}
              <button
                type="button"
                onClick={() => onSubTabChange('reports')}
                className="px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#F3E8D0] border border-[#DFC078] text-[#17120F] font-bold text-xs cursor-pointer"
              >
                View F&amp;B Sales &amp; Audit Summary →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10. POS HELP GUIDE (/pos/help)                                        */}
      {/* ===================================================================== */}
      {activeSubTab === 'help' && (
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl border border-[#E8DEC8] shadow-2xs space-y-5 text-xs">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-[#B08326] font-extrabold uppercase tracking-wider text-[11px]">
              <HelpCircle className="w-4 h-4" />
              <span>DirectStay POS Operations Manual</span>
            </div>
            <h2 className="text-lg font-serif font-extrabold text-[#17120F] mt-1">
              POS Quick Reference &amp; Cashier Guide
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E8DEC8] space-y-1.5">
              <div className="font-extrabold text-[#17120F] text-sm">
                1. Taking Dine-In, Takeaway &amp; Room Service Orders
              </div>
              <p className="text-slate-600 leading-relaxed">
                Click <strong>Take Order</strong> or <strong>+ New Order</strong>, choose the order mode, click items from the menu grid to add to the ticket, and select <strong>Send KOT (Open)</strong> for running table checks or <strong>Proceed to Settlement</strong> for instant billing.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E8DEC8] space-y-1.5">
              <div className="font-extrabold text-[#17120F] text-sm">
                2. Custom Product Price Per Order
              </div>
              <p className="text-slate-600 leading-relaxed">
                Need a custom rate for a single order (e.g. Paneer ₹500 → ₹600)? Edit the <strong>Order ₹</strong> field directly inside the cart line and pick/type a reason. The invoice and GST recalculate automatically, the master menu price remains ₹500, and an audit log is recorded.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E8DEC8] space-y-1.5">
              <div className="font-extrabold text-[#17120F] text-sm">
                3. Room Service &amp; Guest Folio Sync
              </div>
              <p className="text-slate-600 leading-relaxed">
                Select <strong>Room Service</strong>, pick the occupied room &amp; checked-in guest, and choose <strong>Post to Room Folio</strong>. Charges post directly to that guest&apos;s PMS stay bill without duplicate entries or double GST.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F0] border border-[#E8DEC8] space-y-1.5">
              <div className="font-extrabold text-[#17120F] text-sm">
                4. Kitchen &amp; Restaurant ON/OFF Modes
              </div>
              <p className="text-slate-600 leading-relaxed">
                Under <strong>Settings</strong>, toggle <strong>In-House Kitchen Available?</strong> to show/hide KOT &amp; KDS, and toggle <strong>In-House Café / Restaurant Available?</strong> to switch between full Restaurant + Takeaway + Room Service or Room-Service-Only mode.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSubTabChange('take_order')}
              className="px-4 py-2 rounded-xl bg-[#17120F] text-[#F5D88A] font-bold cursor-pointer"
            >
              Go to Take Order →
            </button>
            <button
              type="button"
              onClick={() => onSubTabChange('settings')}
              className="px-4 py-2 rounded-xl border border-[#DFC078] bg-[#FAF6EE] text-[#17120F] font-bold cursor-pointer"
            >
              Open POS Settings →
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL A: ORDER CONFIRMATION, DISCOUNT, NEGOTIATED SETTLEMENT & PAYMENT */}
      {/* ===================================================================== */}
      {showAdditionalModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAdditionalModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Order Confirmation, Discount, GST &amp; Settlement
                </h3>
                <p className="text-xs text-slate-500">
                  {orderType} •{' '}
                  {orderType === 'Room Service'
                    ? `Room ${activeBooking?.roomNumbers.join(', ') || 'N/A'} (${activeBooking?.customerName || 'Guest'})`
                    : orderType === 'Dine In'
                    ? `Table ${tableNumber} (${dineInPax} PAX)`
                    : `Takeaway (${customerNameInput || 'Walk-In'})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdditionalModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Kitchen / Chef Notes &amp; Dietary Instructions
                </label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Less spicy, no onion, serve starter first..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                />
              </div>

              {/* Coupon Code & Discount Section */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Coupon Code &amp; Order Discount</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="WELCOME10 / FLAT100"
                      className="w-36 px-2 py-1 rounded-lg border border-slate-200 bg-white font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCouponCode}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 font-bold text-[11px] cursor-pointer"
                    >
                      Apply Coupon
                    </button>
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <span className="font-bold text-slate-800">Enable Full-Order Discount</span>
                  <input
                    type="checkbox"
                    checked={discountEnabled}
                    onChange={(e) => {
                      setDiscountEnabled(e.target.checked);
                      if (e.target.checked) setSettlementEnabled(false);
                    }}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
                {discountEnabled && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percent')}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                      >
                        <option value="fixed">Fixed (₹)</option>
                        <option value="percent">Percent (%)</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={discountType === 'percent' ? 100 : subtotal}
                        value={discountValue}
                        onChange={(e) =>
                          setDiscountValue(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder={discountType === 'percent' ? 'e.g. 10%' : 'e.g. ₹100'}
                        className="col-span-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                      />
                    </div>
                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Reason for discount (required for audit log)"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Negotiated Final Settlement Price */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800">Negotiated Final Settlement Price</span>
                    <p className="text-[10px] text-slate-500">
                      Override final payable total (GST-inclusive when GST is ON)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settlementEnabled}
                    disabled={!canApprove}
                    onChange={(e) => {
                      setSettlementEnabled(e.target.checked);
                      if (e.target.checked) {
                        setDiscountEnabled(false);
                        if (settlementFinal === '') setSettlementFinal(bill.grandBeforeSettlement);
                      }
                    }}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
                {settlementEnabled && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <span className="text-[11px] text-slate-600">
                        Calculated Bill: <strong>{formatCurrency(bill.grandBeforeSettlement)}</strong>
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={settlementFinal}
                        onChange={(e) =>
                          setSettlementFinal(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="Agreed final ₹"
                        className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 font-extrabold text-slate-900"
                      />
                    </div>
                    <input
                      type="text"
                      value={settlementReason}
                      onChange={(e) => setSettlementReason(e.target.value)}
                      placeholder="Settlement approval reason (required)"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Back-Dated Order Date & Time (Allows Past Date/Time Entries) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      Order Date &amp; Time (Back-Date Allowed)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Record retroactive or past-dated food &amp; restaurant billing entries
                    </div>
                  </div>
                  {customOrderDate !== getIstTodayStr() && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Back-Dated
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Bill Date</label>
                    <input
                      type="date"
                      value={customOrderDate}
                      onChange={(e) => setCustomOrderDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Bill Time</label>
                    <input
                      type="time"
                      value={customOrderTime}
                      onChange={(e) => setCustomOrderTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* GST Toggle + B2C / B2B Details */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-bold text-slate-800">
                      Apply F&amp;B GST ({configuredFnbGst}% = {taxSettings.fnbCgst}% CGST + {taxSettings.fnbSgst}% SGST)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Turn OFF only for non-GST Bill of Supply where legally applicable
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={gstEnabled}
                    onChange={(e) => setGstEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
                {gstEnabled && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="B2B Company Name (optional)"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      placeholder="Customer GSTIN (optional B2B)"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Payment Mode & Hybrid Split */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase text-slate-500">Payment Option</label>
                  {orderType === 'Dine In' && (
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepTableOpen}
                        onChange={(e) => setKeepTableOpen(e.target.checked)}
                      />
                      Keep as Running Table Check (pay later)
                    </label>
                  )}
                </div>

                {!keepTableOpen && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ...(orderType === 'Room Service' ? (['Room Charge'] as const) : []),
                          'Cash',
                          'UPI',
                          'Card',
                          'Bank Transfer',
                          'Hybrid',
                        ] as const
                      ).map((pm) => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setPayMode(pm)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            payMode === pm
                              ? 'bg-slate-900 text-amber-400 border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {pm === 'Room Charge' ? 'Post to Room Folio' : pm === 'Hybrid' ? '⇄ Hybrid / Split' : pm}
                        </button>
                      ))}
                    </div>

                    {/* Cash Manual Verification */}
                    {payMode === 'Cash' && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">
                            Cash Tendered by Guest:
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={cashTendered}
                            onChange={(e) => setCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={`e.g. ${netPayableAfterDeposit}`}
                            className="w-32 px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-right"
                          />
                        </div>
                        {Number(cashTendered) > (amountReceived === '' ? netPayableAfterDeposit : Number(amountReceived) || 0) && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900">
                            <span>Change to Return to Guest:</span>
                            <strong className="text-sm font-black font-mono">
                              {formatCurrency(r2((Number(cashTendered) || 0) - (amountReceived === '' ? netPayableAfterDeposit : Number(amountReceived) || 0)))}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* UPI Manual Verification Box */}
                    {payMode === 'UPI' && (
                      <div className="mt-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-300 space-y-2.5">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-xl bg-white border border-amber-300 flex flex-col items-center justify-center shrink-0 p-1 shadow-2xs">
                            <QrCode className="w-10 h-10 text-slate-900" />
                            <span className="text-[8px] font-extrabold text-amber-800">SCAN &amp; PAY</span>
                          </div>
                          <div className="text-[11px] space-y-0.5">
                            <div className="font-extrabold text-slate-900">
                              Hotel Static UPI — {formatCurrency(netPayableAfterDeposit)}
                            </div>
                            <div className="font-mono text-[10px] text-amber-900 font-bold">
                              UPI ID: {hotelSettings?.upiId || 'hotelroyal@icici'}
                            </div>
                            <div className="text-slate-500 text-[10px]">
                              Ask guest to scan QR or pay via GPay/PhonePe/Paytm/BHIM to the hotel UPI ID.
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center pt-1">
                          <input
                            type="text"
                            value={upiUtr}
                            onChange={(e) => setUpiUtr(e.target.value)}
                            placeholder="12-digit UPI UTR / Ref (Required) *"
                            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-[11px]"
                          />
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 cursor-pointer bg-white px-2 py-1.5 rounded-lg border border-amber-200">
                            <input
                              type="checkbox"
                              checked={upiVerified}
                              onChange={(e) => setUpiVerified(e.target.checked)}
                              className="w-4 h-4 accent-emerald-600"
                            />
                            Verified by {loggedInUser}
                          </label>
                        </div>
                        {!upiVerified && (
                          <div className="text-[10px] font-semibold text-amber-800 bg-amber-100/70 p-1.5 rounded-lg">
                            ⚠️ Displaying or scanning QR never marks payment as paid automatically. Staff must verify on bank statement/merchant app before marking Paid.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Manual Entry */}
                    {payMode === 'Card' && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={cardNetwork}
                            onChange={(e) => setCardNetwork(e.target.value as any)}
                            className="col-span-4 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-[11px]"
                          >
                            <option value="Visa">Visa</option>
                            <option value="Mastercard">Mastercard</option>
                            <option value="RuPay">RuPay</option>
                            <option value="Amex">Amex</option>
                            <option value="Other">Other</option>
                          </select>
                          <input
                            type="text"
                            maxLength={4}
                            value={cardLast4}
                            onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="Last 4 (e.g. 4242)"
                            className="col-span-4 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-[11px]"
                          />
                          <input
                            type="text"
                            value={cardTerminal}
                            onChange={(e) => setCardTerminal(e.target.value)}
                            placeholder="EDC Slip / Auth #"
                            className="col-span-4 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Bank Transfer Manual Entry */}
                    {payMode === 'Bank Transfer' && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="Bank Name (e.g. HDFC Bank)"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                          />
                          <input
                            type="text"
                            value={bankRef}
                            onChange={(e) => setBankRef(e.target.value)}
                            placeholder="IMPS / NEFT / RTGS Ref #"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Single-method partial payment option */}
                    {payMode !== 'Hybrid' && payMode !== 'Room Charge' && (
                      <div className="mt-2 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-semibold text-slate-600">
                          Amount Received Now (leave blank for full {formatCurrency(netPayableAfterDeposit)}):
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={netPayableAfterDeposit}
                          value={amountReceived}
                          onChange={(e) =>
                            setAmountReceived(
                              e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          placeholder={String(netPayableAfterDeposit)}
                          className="w-28 px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold text-right"
                        />
                      </div>
                    )}

                    {/* Hybrid split rows */}
                    {payMode === 'Hybrid' && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        {hybridRows.map((row, idx) => (
                          <div key={row.id} className="space-y-1 p-2 rounded-lg bg-white border border-slate-200">
                            <div className="grid grid-cols-12 gap-1.5 items-center">
                              <select
                                value={row.method}
                                onChange={(e) => {
                                  const next = [...hybridRows];
                                  next[idx] = { ...row, method: e.target.value as any };
                                  setHybridRows(next);
                                }}
                                className="col-span-4 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-xs"
                              >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                              </select>
                              <input
                                type="number"
                                min={0}
                                value={row.amount}
                                onChange={(e) => {
                                  const next = [...hybridRows];
                                  next[idx] = {
                                    ...row,
                                    amount: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0),
                                  };
                                  setHybridRows(next);
                                }}
                                placeholder="Amount ₹"
                                className="col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-xs"
                              />
                              <input
                                type="text"
                                value={row.reference}
                                onChange={(e) => {
                                  const next = [...hybridRows];
                                  next[idx] = { ...row, reference: e.target.value };
                                  setHybridRows(next);
                                }}
                                placeholder="Ref / Notes"
                                className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                              />
                              <button
                                type="button"
                                disabled={hybridRows.length <= 1}
                                onClick={() => setHybridRows(hybridRows.filter((_, i) => i !== idx))}
                                className="col-span-1 text-rose-600 font-bold text-xs disabled:opacity-30 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                            {row.method === 'UPI' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 items-center pt-1 text-[11px]">
                                <input
                                  type="text"
                                  value={row.upiUtr || ''}
                                  onChange={(e) => {
                                    const next = [...hybridRows];
                                    next[idx] = { ...row, upiUtr: e.target.value };
                                    setHybridRows(next);
                                  }}
                                  placeholder="UPI UTR (Required)"
                                  className="px-2 py-1 rounded border border-amber-300 bg-amber-50/50 font-mono text-[10.5px]"
                                />
                                <label className="flex items-center gap-1.5 font-bold text-emerald-900 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(row.upiVerified)}
                                    onChange={(e) => {
                                      const next = [...hybridRows];
                                      next[idx] = { ...row, upiVerified: e.target.checked };
                                      setHybridRows(next);
                                    }}
                                    className="w-3.5 h-3.5 accent-emerald-600"
                                  />
                                  <span>Verified by {loggedInUser}</span>
                                </label>
                              </div>
                            )}
                            {row.method === 'Card' && (
                              <div className="grid grid-cols-12 gap-1.5 items-center pt-1 text-[11px]">
                                <select
                                  value={row.cardNetwork || 'Visa'}
                                  onChange={(e) => {
                                    const next = [...hybridRows];
                                    next[idx] = { ...row, cardNetwork: e.target.value };
                                    setHybridRows(next);
                                  }}
                                  className="col-span-4 px-1.5 py-1 rounded border border-slate-200 bg-white text-[10.5px] font-bold"
                                >
                                  <option value="Visa">Visa</option>
                                  <option value="Mastercard">Mastercard</option>
                                  <option value="RuPay">RuPay</option>
                                  <option value="Amex">Amex</option>
                                  <option value="Other">Other</option>
                                </select>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={row.cardLast4 || ''}
                                  onChange={(e) => {
                                    const next = [...hybridRows];
                                    next[idx] = { ...row, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) };
                                    setHybridRows(next);
                                  }}
                                  placeholder="Last 4"
                                  className="col-span-4 px-2 py-1 rounded border border-slate-200 bg-white font-mono text-[10.5px]"
                                />
                                <input
                                  type="text"
                                  value={row.cardTerminal || ''}
                                  onChange={(e) => {
                                    const next = [...hybridRows];
                                    next[idx] = { ...row, cardTerminal: e.target.value };
                                    setHybridRows(next);
                                  }}
                                  placeholder="EDC Slip #"
                                  className="col-span-4 px-2 py-1 rounded border border-slate-200 bg-white text-[10.5px]"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              const rem = Math.max(
                                0,
                                r2(
                                  netPayableAfterDeposit -
                                    hybridRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
                                )
                              );
                              setHybridRows([
                                ...hybridRows,
                                { id: `hy-${Date.now()}`, method: 'UPI', amount: rem, reference: '' },
                              ]);
                            }}
                            className="font-bold text-amber-700 cursor-pointer"
                          >
                            + Add Payment Split
                          </button>
                          <span className="font-bold text-slate-700">
                            Paid:{' '}
                            {formatCurrency(
                              r2(hybridRows.reduce((s, r) => s + (Number(r.amount) || 0), 0))
                            )}{' '}
                            • Balance Due:{' '}
                            <strong className="text-rose-600">
                              {formatCurrency(
                                Math.max(
                                  0,
                                  r2(
                                    netPayableAfterDeposit -
                                      hybridRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
                                  )
                                )
                              )}
                            </strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bill Summary Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Food Subtotal ({cart.reduce((s, c) => s + c.qty, 0)} qty)</span>
                  <span className="font-bold">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount / Adjustment</span>
                    <span className="font-bold">− {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>{gstEnabled ? `Taxable Value (${configuredFnbGst}% GST)` : 'Taxable Value (No GST)'}</span>
                  <span className="font-bold">{formatCurrency(bill.taxable)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{gstEnabled ? `CGST + SGST` : 'GST (0%)'}</span>
                  <span className="font-bold">{formatCurrency(taxAmount)}</span>
                </div>
                {advanceDepositCredit > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Advance Booking Deposit Deducted</span>
                    <span className="font-bold">− {formatCurrency(advanceDepositCredit)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Net Payable Now</span>
                  <span className="text-amber-600">{formatCurrency(netPayableAfterDeposit)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Print | KOT (when Kitchen=ON) | KOT + Invoice / Save & Print | Save */}
            <div
              className={`grid grid-cols-2 ${
                posCapabilities.kotEnabled ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
              } gap-2 pt-2 border-t border-slate-200`}
            >
              <button
                type="button"
                onClick={() => handleFinalizeOrder('Print')}
                className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Bill
              </button>
              {posCapabilities.kotEnabled && (
                <button
                  type="button"
                  onClick={() => handleFinalizeOrder('KOT')}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ChefHat className="w-3.5 h-3.5" /> KOT Only
                </button>
              )}
              <button
                type="button"
                onClick={() => handleFinalizeOrder('KOT + Invoice')}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                {posCapabilities.kotEnabled ? 'KOT + Bill' : 'Save & Invoice'}
              </button>
              <button
                type="button"
                onClick={() => handleFinalizeOrder('Save')}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Save Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL B: SETTLE CONSOLIDATED RUNNING TABLE CHECK                      */}
      {/* ===================================================================== */}
      {settleGroup && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSettleTable(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Settle Consolidated Bill — Table {settleGroup.table}
                </h3>
                <p className="text-xs text-slate-500">
                  {settleGroup.orders.length} KOT ticket(s) • Total Bill {formatCurrency(settleGroup.total)}
                  {settleGroup.paid > 0 ? ` • Previously Paid ${formatCurrency(settleGroup.paid)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleTable(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50">
              {settleGroup.orders.map((o) => (
                <div key={o.id} className="py-1.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">
                      {o.orderNumber} ({o.kotNumber || 'KOT'})
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {o.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatCurrency(o.grandTotal)}</div>
                    {(o.amountPaid ?? 0) > 0 && (
                      <div className="text-[10px] text-emerald-700">Paid: {formatCurrency(o.amountPaid || 0)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-5 gap-1.5">
                {(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Hybrid'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSettleMode(m)}
                    className={`py-1.5 px-2 rounded-lg font-bold border text-[11px] cursor-pointer ${
                      settleMode === m
                        ? 'bg-slate-900 text-amber-400 border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {settleMode !== 'Hybrid' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Amount to Settle (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={settleGroup.due}
                        value={settleAmount}
                        onChange={(e) =>
                          setSettleAmount(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder={`Full ₹${settleGroup.due}`}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                      />
                    </div>
                    {settleMode === 'Cash' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Cash Tendered (₹)
                        </label>
                        <input
                          type="number"
                          value={settleCashTendered}
                          onChange={(e) => setSettleCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Amount handed"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                        />
                        {(Number(settleCashTendered) || 0) > (settleAmount === '' ? settleGroup.due : Number(settleAmount) || 0) && (
                          <p className="text-[10px] font-extrabold text-emerald-700 mt-1">
                            Change: {formatCurrency((Number(settleCashTendered) || 0) - (settleAmount === '' ? settleGroup.due : Number(settleAmount) || 0))}
                          </p>
                        )}
                      </div>
                    )}
                    {settleMode === 'UPI' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          UPI UTR / Ref (Required) *
                        </label>
                        <input
                          type="text"
                          value={settleUpiUtr}
                          onChange={(e) => setSettleUpiUtr(e.target.value)}
                          placeholder="12-digit UPI UTR"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-[11px]"
                        />
                      </div>
                    )}
                    {settleMode === 'Card' && (
                      <div className="flex gap-1.5">
                        <select
                          value={settleCardNetwork}
                          onChange={(e) => setSettleCardNetwork(e.target.value as any)}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold"
                        >
                          <option value="Visa">Visa</option>
                          <option value="Mastercard">Mastercard</option>
                          <option value="RuPay">RuPay</option>
                          <option value="Amex">Amex</option>
                        </select>
                        <input
                          type="text"
                          maxLength={4}
                          value={settleCardLast4}
                          onChange={(e) => setSettleCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="Last 4"
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-[11px]"
                        />
                      </div>
                    )}
                    {settleMode === 'Bank Transfer' && (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={settleBankName}
                          onChange={(e) => setSettleBankName(e.target.value)}
                          placeholder="Bank (e.g. HDFC)"
                          className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                        />
                        <input
                          type="text"
                          value={settleBankRef}
                          onChange={(e) => setSettleBankRef(e.target.value)}
                          placeholder="Ref / UTR"
                          className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                        />
                      </div>
                    )}
                  </div>
                  {settleMode === 'UPI' && (
                    <label className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settleUpiVerified}
                        onChange={(e) => setSettleUpiVerified(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span>Payment verified on merchant soundbox/bank app by {loggedInUser}</span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {settleRows.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const next = [...settleRows];
                          next[idx] = { ...row, method: e.target.value as any };
                          setSettleRows(next);
                        }}
                        className="col-span-5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={row.amount}
                        onChange={(e) => {
                          const next = [...settleRows];
                          next[idx] = {
                            ...row,
                            amount: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0),
                          };
                          setSettleRows(next);
                        }}
                        placeholder="Amount ₹"
                        className="col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                      />
                      <input
                        type="text"
                        value={row.reference}
                        onChange={(e) => {
                          const next = [...settleRows];
                          next[idx] = { ...row, reference: e.target.value };
                          setSettleRows(next);
                        }}
                        placeholder="Ref / UTR"
                        className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSettleTable(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSettleTable}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
              >
                Record Payment &amp; Print Consolidated Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL B2: DEDICATED ORDER PAYMENT & SETTLEMENT MODAL (ALL ORDERS)     */}
      {/* ===================================================================== */}
      {orderPaymentModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setOrderPaymentModal(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  Order Payment &amp; Settlement — {orderPaymentModal.orderNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {orderPaymentModal.orderType} • {orderPaymentModal.tableNumber ? `Table ${orderPaymentModal.tableNumber}` : orderPaymentModal.roomNumber ? `Room ${orderPaymentModal.roomNumber}` : 'Takeaway'} • {orderPaymentModal.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderPaymentModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Grand Total</span>
                <strong className="text-sm font-extrabold text-slate-900">{formatCurrency(orderPaymentModal.grandTotal)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-bold block uppercase">Total Paid</span>
                <strong className="text-sm font-extrabold text-emerald-700">{formatCurrency(orderPaymentModal.amountPaid || 0)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] text-rose-700 font-bold block uppercase">Balance Due</span>
                <strong className="text-sm font-extrabold text-rose-700">
                  {formatCurrency(orderPaymentModal.balanceDue ?? Math.max(0, orderPaymentModal.grandTotal - (orderPaymentModal.amountPaid || 0)))}
                </strong>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" /> Payment History ({orderPaymentModal.payments?.length || 0} transaction{orderPaymentModal.payments?.length === 1 ? '' : 's'})
              </h4>
              {orderPaymentModal.payments && orderPaymentModal.payments.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                  {orderPaymentModal.payments.map((p, idx) => (
                    <div key={p.id || idx} className="p-2.5 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>{p.method}</span>
                          <span className="text-emerald-700 font-black">{formatCurrency(p.amount)}</span>
                          {p.verificationStatus === 'verified' && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Verified
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 space-x-2">
                          {p.reference && <span>Ref/UTR: <strong className="font-mono">{p.reference}</strong></span>}
                          {p.cardLast4 && <span>Card: ••••{p.cardLast4} ({p.cardNetwork || 'Card'})</span>}
                          {p.cardTerminal && <span>EDC Slip: {p.cardTerminal}</span>}
                          {p.bankName && <span>Bank: {p.bankName}</span>}
                          {p.verifiedBy && <span>Verified by {p.verifiedBy}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">{p.time?.slice(11, 19) || p.time || ''}</span>
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() => handleVoidPayment(orderPaymentModal, p.id, p.amount)}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer mt-0.5"
                          >
                            Void / Refund
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  No payments recorded yet. Order is completely unpaid.
                </div>
              )}
            </div>

            {/* Manual Payment Entry Form (if balance due > 0) */}
            {(orderPaymentModal.balanceDue ?? Math.max(0, orderPaymentModal.grandTotal - (orderPaymentModal.amountPaid || 0))) > 0.5 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Record Manual Payment (Authorized Staff Verification)
                  </span>
                  <span className="text-xs font-extrabold text-amber-700">
                    Due: {formatCurrency(orderPaymentModal.balanceDue ?? 0)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {(['Cash', 'UPI', 'Card', 'Bank Transfer'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOrderPayMethod(m)}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs border cursor-pointer ${
                        orderPayMethod === m
                          ? 'bg-slate-900 text-amber-400 border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Amount (₹)</label>
                    <input
                      type="number"
                      min={1}
                      max={orderPaymentModal.balanceDue ?? orderPaymentModal.grandTotal}
                      value={orderPayAmtInput}
                      onChange={(e) => setOrderPayAmtInput(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={`Full: ${orderPaymentModal.balanceDue ?? orderPaymentModal.grandTotal}`}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                    />
                  </div>

                  {orderPayMethod === 'Cash' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cash Tendered (₹)</label>
                      <input
                        type="number"
                        value={orderPayCashTendered}
                        onChange={(e) => setOrderPayCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Tendered by customer"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                      {(Number(orderPayCashTendered) || 0) > (Number(orderPayAmtInput) || (orderPaymentModal.balanceDue ?? 0)) && (
                        <p className="text-[10px] font-extrabold text-emerald-700 mt-1">
                          Change to Return: {formatCurrency((Number(orderPayCashTendered) || 0) - (Number(orderPayAmtInput) || (orderPaymentModal.balanceDue ?? 0)))}
                        </p>
                      )}
                    </div>
                  )}

                  {orderPayMethod === 'UPI' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">UPI UTR / Reference # *</label>
                      <input
                        type="text"
                        value={orderPayUpiUtr}
                        onChange={(e) => setOrderPayUpiUtr(e.target.value)}
                        placeholder="12-digit UTR from phone"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                      />
                    </div>
                  )}

                  {orderPayMethod === 'Card' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Card Network &amp; Last 4</label>
                      <div className="flex gap-1.5">
                        <select
                          value={orderPayCardNetwork}
                          onChange={(e) => setOrderPayCardNetwork(e.target.value as any)}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                        >
                          <option value="Visa">Visa</option>
                          <option value="Mastercard">Mastercard</option>
                          <option value="RuPay">RuPay</option>
                          <option value="Amex">Amex</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="text"
                          maxLength={4}
                          value={orderPayCardLast4}
                          onChange={(e) => setOrderPayCardLast4(e.target.value)}
                          placeholder="4021"
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {orderPayMethod === 'Bank Transfer' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bank Name &amp; Ref #</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={orderPayBankName}
                          onChange={(e) => setOrderPayBankName(e.target.value)}
                          placeholder="Bank (e.g. HDFC)"
                          className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                        />
                        <input
                          type="text"
                          value={orderPayBankRef}
                          onChange={(e) => setOrderPayBankRef(e.target.value)}
                          placeholder="IMPS/NEFT Ref"
                          className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {orderPayMethod === 'UPI' && (
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderPayUpiVerified}
                      onChange={(e) => setOrderPayUpiVerified(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span>I confirm payment received in Hotel UPI account / merchant soundbox</span>
                  </label>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRecordAdditionalPayment}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer shadow-xs"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs font-extrabold text-emerald-800">
                ✓ This order is completely paid and settled.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setOrderPaymentModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL C: AUTHORISED VOID / CANCEL / REFUND MODAL                      */}
      {/* ===================================================================== */}
      {voidModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setVoidModalOrder(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-rose-700">
                  Authorised Order Cancellation / Void &amp; Refund
                </h3>
                <p className="text-xs text-slate-500">
                  {voidModalOrder.orderNumber} • {formatCurrency(voidModalOrder.grandTotal)} • KOT Status:{' '}
                  {voidModalOrder.kotStatus}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVoidModalOrder(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Cancellation / Void Reason (Required for Audit Log) *
                </label>
                <input
                  type="text"
                  value={voidReasonInput}
                  onChange={(e) => setVoidReasonInput(e.target.value)}
                  placeholder="e.g. Guest changed mind / Wrong item punched"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
                />
              </div>
              {(voidModalOrder.amountPaid ?? 0) > 0 && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Refund Amount (₹) — Paid {formatCurrency(voidModalOrder.amountPaid || 0)}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={voidModalOrder.amountPaid || voidModalOrder.grandTotal}
                    value={refundAmountInput}
                    onChange={(e) =>
                      setRefundAmountInput(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  />
                </div>
              )}
              {!voidModalOrder.isHeld && !voidModalOrder.bomReversed && (
                <label className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reverseStockOnVoid}
                    onChange={(e) => setReverseStockOnVoid(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <div className="font-bold text-emerald-950 text-[11px]">
                      Reverse deducted BOM raw materials &amp; stock to Inventory Store
                    </div>
                    <div className="text-[10px] text-emerald-800">
                      Uncheck only if the dish was already cooked and ingredients were consumed/wasted.
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setVoidModalOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmVoidOrRefund}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
              >
                Confirm Void &amp; Log Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL D: PRINTABLE 80MM THERMAL KOT SLIP (ISOLATED SINGLE-SLIP PRINT) */}
      {/* ===================================================================== */}
      {printingKotOrder && (() => {
        const kotOrd = printingKotOrder.order;
        const targetLabel = kotOrd.roomNumber
          ? `Room ${kotOrd.roomNumber}`
          : kotOrd.orderType === 'Takeaway'
          ? 'Takeaway Counter'
          : `Table ${kotOrd.tableNumber || 'Counter'}`;
        const guestCountLabel = kotOrd.pax ? `${kotOrd.pax} Guest(s)` : '1 Guest';
        const stationsSet = Array.from(
          new Set(
            kotOrd.items.map(
              (it) =>
                it.kitchenStation ||
                menuItems.find((m) => m.id === it.itemId)?.kitchenStation ||
                'Main Kitchen'
            )
          )
        );

        const handlePrintIsolatedKot = () => {
          const tagsHtml = [
            printingKotOrder.isReprint
              ? `<span class="tag">REPRINT #${kotOrd.reprintCount || 1}</span>`
              : '',
            kotOrd.isSupplementaryKot
              ? `<span class="tag">SUPPLEMENTARY KOT</span>`
              : '',
          ]
            .filter(Boolean)
            .join('');

          const rowsHtml = kotOrd.items
            .map((it) => {
              const baseName = cleanOrderItemBaseName(it.name, it.variant);
              const stName =
                it.kitchenStation ||
                menuItems.find((m) => m.id === it.itemId)?.kitchenStation ||
                'Main Kitchen';
              const portionHtml = it.variant
                ? `<span class="portion-pill">${escapeHtml(it.variant)}</span>`
                : `<span class="station-lbl">(Regular)</span>`;
              const addonsHtml =
                it.addons && it.addons.length > 0
                  ? `<div style="font-size:9.5px;margin-top:1px;">+ ${escapeHtml(it.addons.join(', '))}</div>`
                  : '';
              const chefNoteHtml = it.itemNotes
                ? `<div class="note-box">* Chef Note: ${escapeHtml(it.itemNotes)}</div>`
                : '';
              return `<tr>
                <td style="padding-right:4px;">
                  <div class="bold">${escapeHtml(baseName)} ${portionHtml}</div>
                  <div class="station-lbl">Station: ${escapeHtml(stName)}</div>
                  ${addonsHtml}
                  ${chefNoteHtml}
                </td>
                <td class="right xbold mono" style="font-size:12px;white-space:nowrap;">x${it.qty}</td>
              </tr>`;
            })
            .join('');

          const orderNoteHtml = kotOrd.instructions
            ? `<div class="order-note"><span class="bold">Chef / Order Instructions:</span> ${escapeHtml(
                kotOrd.instructions
              )}</div>`
            : '';

          const bodyHtml = `
            <div class="center">
              ${tagsHtml ? `<div>${tagsHtml}</div>` : ''}
              <div class="xbold" style="font-size:13px;letter-spacing:0.4px;">${escapeHtml(hotelName)}</div>
              <div class="bold" style="font-size:11px;">KITCHEN ORDER TICKET (KOT)</div>
            </div>
            <div class="solid-divider"></div>
            <table class="meta-grid">
              <tr>
                <td><span class="bold">KOT No:</span> <span class="mono bold">${escapeHtml(
                  kotOrd.kotNumber || kotOrd.orderNumber
                )}</span></td>
                <td class="right"><span class="bold">Order:</span> <span class="mono">${escapeHtml(
                  kotOrd.orderNumber
                )}</span></td>
              </tr>
              <tr>
                <td><span class="bold">${kotOrd.roomNumber ? 'Room:' : 'Table:'}</span> <span class="xbold">${escapeHtml(
                  targetLabel
                )}</span></td>
                <td class="right"><span class="bold">Mode:</span> ${escapeHtml(kotOrd.orderType)}</td>
              </tr>
              <tr>
                <td><span class="bold">Guests:</span> ${escapeHtml(guestCountLabel)}</td>
                <td class="right"><span class="bold">Station:</span> ${escapeHtml(
                  stationsSet.join(', ')
                )}</td>
              </tr>
              ${
                kotOrd.customerName || kotOrd.waiterName
                  ? `<tr>
                      <td>${kotOrd.customerName ? `<span class="bold">Guest:</span> ${escapeHtml(kotOrd.customerName)}` : ''}</td>
                      <td class="right">${kotOrd.waiterName ? `<span class="bold">Steward:</span> ${escapeHtml(kotOrd.waiterName)}` : ''}</td>
                    </tr>`
                  : ''
              }
              <tr>
                <td colspan="2"><span class="bold">Date &amp; Time:</span> <span class="mono">${escapeHtml(
                  kotOrd.dateTime
                )}</span></td>
              </tr>
            </table>
            <div class="solid-divider"></div>
            <table class="items-tbl">
              <thead>
                <tr>
                  <th>Item / Portion / Station</th>
                  <th class="right">Qty</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            ${orderNoteHtml}
            <div class="divider"></div>
            <div class="center" style="font-size:9.5px;">Total Items: ${kotOrd.items.reduce(
              (s, i) => s + i.qty,
              0
            )} • Prepared via DirectStay POS</div>
          `;

          printThermalDocument(
            `${kotOrd.kotNumber || kotOrd.orderNumber} - ${hotelName}`,
            bodyHtml
          );
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPrintingKotOrder(null)}
          >
            <div
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-3.5 font-mono text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
                <div>
                  {printingKotOrder.isReprint && (
                    <span className="inline-block px-2 py-0.5 mr-1 rounded bg-amber-200 text-amber-950 font-extrabold text-[10px]">
                      REPRINT #{kotOrd.reprintCount || 1}
                    </span>
                  )}
                  {kotOrd.isSupplementaryKot && (
                    <span className="inline-block px-2 py-0.5 rounded bg-blue-200 text-blue-950 font-extrabold text-[10px]">
                      SUPPLEMENTARY KOT
                    </span>
                  )}
                </div>
                <div className="text-sm font-extrabold text-slate-900 uppercase">{hotelName}</div>
                <div className="text-[11px] font-extrabold text-amber-700">
                  KITCHEN ORDER TICKET (80mm Thermal)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] border-b border-dashed border-slate-300 pb-2.5">
                <div>
                  <span className="text-slate-500">KOT No:</span>{' '}
                  <strong className="text-slate-900">{kotOrd.kotNumber || kotOrd.orderNumber}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Order No:</span>{' '}
                  <strong className="text-slate-900">{kotOrd.orderNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500">{kotOrd.roomNumber ? 'Room:' : 'Table:'}</span>{' '}
                  <strong className="text-slate-900">{targetLabel}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Type:</span>{' '}
                  <strong className="text-slate-900">{kotOrd.orderType}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Guests:</span>{' '}
                  <strong className="text-slate-900">{guestCountLabel}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Station:</span>{' '}
                  <strong className="text-slate-900">{stationsSet.join(', ')}</strong>
                </div>
                {kotOrd.waiterName && (
                  <div>
                    <span className="text-slate-500">Waiter:</span>{' '}
                    <strong className="text-slate-800">{kotOrd.waiterName}</strong>
                  </div>
                )}
                <div className={kotOrd.waiterName ? 'text-right' : 'col-span-2'}>
                  <span className="text-slate-500">Date/Time:</span>{' '}
                  <strong className="text-slate-800">{kotOrd.dateTime}</strong>
                </div>
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-300 pb-3 max-h-60 overflow-y-auto">
                <div className="flex justify-between font-bold text-slate-500 text-[10px] uppercase">
                  <span>Item • Portion • Station</span>
                  <span>Qty</span>
                </div>
                {kotOrd.items.map((it, idx) => {
                  const cleanName = cleanOrderItemBaseName(it.name, it.variant);
                  const stName =
                    it.kitchenStation ||
                    menuItems.find((m) => m.id === it.itemId)?.kitchenStation ||
                    'Main Kitchen';
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between items-start gap-2 font-bold text-slate-900">
                        <div>
                          <span>{cleanName}</span>
                          {it.variant ? (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-extrabold">
                              {it.variant}
                            </span>
                          ) : null}
                          <div className="text-[10px] font-normal text-slate-500">
                            Station: {stName}
                            {it.addons && it.addons.length > 0 ? ` • + ${it.addons.join(', ')}` : ''}
                          </div>
                        </div>
                        <span className="text-sm font-extrabold">x{it.qty}</span>
                      </div>
                      {it.itemNotes && (
                        <div className="text-[10.5px] font-bold text-rose-700">
                          Chef Note: {it.itemNotes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {kotOrd.instructions && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                  <strong>Chef Instructions:</strong> {kotOrd.instructions}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrintIsolatedKot}
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print 80mm KOT
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingKotOrder(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL E: PRINTABLE RESTAURANT GST TAX INVOICE / BILL OF SUPPLY        */}
      {/* ===================================================================== */}
      {printingFoodOrder && (() => {
        const handlePrintIsolatedBill = () => {
          const itemRowsHtml = printingFoodOrder.items
            .map((it) => {
              const cleanName = cleanOrderItemBaseName(it.name, it.variant);
              const portionLbl = it.variant ? ` (${escapeHtml(it.variant)})` : '';
              const addonsLbl =
                it.addons && it.addons.length > 0
                  ? `<div style="font-size:9px;color:#333;">+ ${escapeHtml(it.addons.join(', '))}</div>`
                  : '';
              return `<tr>
                <td>
                  <div class="bold">${escapeHtml(cleanName)}${portionLbl}</div>
                  ${addonsLbl}
                </td>
                <td class="center mono">${it.qty}</td>
                <td class="right mono">₹${r2(it.price).toFixed(2)}</td>
                <td class="right bold mono">₹${r2(it.qty * it.price).toFixed(2)}</td>
              </tr>`;
            })
            .join('');

          const pkgRowHtml =
            (printingFoodOrder.packagingCharge || 0) > 0
              ? `<tr>
                  <td class="bold">Packaging Charge</td>
                  <td class="center mono">1</td>
                  <td class="right mono">₹${r2(printingFoodOrder.packagingCharge || 0).toFixed(2)}</td>
                  <td class="right bold mono">₹${r2(printingFoodOrder.packagingCharge || 0).toFixed(2)}</td>
                </tr>`
              : '';

          const halfGstPct = ((printingFoodOrder.gstRate ?? configuredFnbGst) / 2).toFixed(1);
          const paymentsHtml =
            printingFoodOrder.payments && printingFoodOrder.payments.length > 0
              ? `<div class="divider"></div>` +
                printingFoodOrder.payments
                  .map(
                    (p) =>
                      `<div style="display:flex;justify-content:space-between;font-size:10px;">
                        <span>Paid (${escapeHtml(p.method)}${p.reference ? ` • ${escapeHtml(p.reference)}` : ''})</span>
                        <span class="bold mono">₹${r2(p.amount).toFixed(2)}</span>
                      </div>`
                  )
                  .join('')
              : '';

          const bodyHtml = `
            <div class="center">
              <div class="xbold" style="font-size:13px;">${escapeHtml(hotelName)}</div>
              ${hotelSettings?.gstin ? `<div class="mono" style="font-size:9.5px;">GSTIN: ${escapeHtml(hotelSettings.gstin)}</div>` : ''}
              <div class="tag">${
                printingFoodOrder.isWithoutGst
                  ? 'BILL OF SUPPLY'
                  : printingFoodOrder.customerGstin
                  ? 'B2B GST TAX INVOICE'
                  : 'RESTAURANT TAX INVOICE'
              }</div>
            </div>
            <div class="solid-divider"></div>
            <table class="meta-grid">
              <tr>
                <td><span class="bold">Bill No:</span> <span class="mono">${escapeHtml(printingFoodOrder.orderNumber)}</span></td>
                <td class="right"><span class="bold">Mode:</span> ${escapeHtml(printingFoodOrder.orderType)}</td>
              </tr>
              <tr>
                <td><span class="bold">${printingFoodOrder.roomNumber ? 'Room:' : 'Table:'}</span> ${escapeHtml(
                  printingFoodOrder.roomNumber ? `Room ${printingFoodOrder.roomNumber}` : printingFoodOrder.tableNumber || 'Counter'
                )}</td>
                <td class="right"><span class="bold">Date:</span> <span class="mono">${escapeHtml(printingFoodOrder.dateTime)}</span></td>
              </tr>
              ${
                printingFoodOrder.customerName
                  ? `<tr><td colspan="2"><span class="bold">Guest:</span> ${escapeHtml(printingFoodOrder.customerName)}</td></tr>`
                  : ''
              }
              ${
                printingFoodOrder.companyName || printingFoodOrder.customerGstin
                  ? `<tr><td colspan="2"><span class="bold">Company/GSTIN:</span> ${escapeHtml(
                      [printingFoodOrder.companyName, printingFoodOrder.customerGstin].filter(Boolean).join(' • ')
                    )}</td></tr>`
                  : ''
              }
            </table>
            <div class="solid-divider"></div>
            <table class="items-tbl">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th class="center">Qty</th>
                  <th class="right">Rate</th>
                  <th class="right">Amt</th>
                </tr>
              </thead>
              <tbody>${itemRowsHtml}${pkgRowHtml}</tbody>
            </table>
            <div class="solid-divider"></div>
            <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span class="mono">₹${r2(printingFoodOrder.subtotal).toFixed(2)}</span></div>
            ${
              (printingFoodOrder.discount || 0) > 0
                ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span class="mono">− ₹${r2(printingFoodOrder.discount || 0).toFixed(2)}</span></div>`
                : ''
            }
            ${
              printingFoodOrder.isWithoutGst
                ? `<div style="display:flex;justify-content:space-between;"><span>GST</span><span class="mono">₹0.00</span></div>`
                : `<div style="display:flex;justify-content:space-between;"><span>CGST (${halfGstPct}%)</span><span class="mono">₹${r2(printingFoodOrder.taxAmount / 2).toFixed(2)}</span></div>
                   <div style="display:flex;justify-content:space-between;"><span>SGST (${halfGstPct}%)</span><span class="mono">₹${r2(printingFoodOrder.taxAmount / 2).toFixed(2)}</span></div>`
            }
            ${
              (printingFoodOrder.advanceDepositApplied || 0) > 0
                ? `<div style="display:flex;justify-content:space-between;"><span>Less Advance Deposit</span><span class="mono">− ₹${r2(printingFoodOrder.advanceDepositApplied || 0).toFixed(2)}</span></div>`
                : ''
            }
            <div class="solid-divider"></div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;" class="xbold">
              <span>GRAND TOTAL</span>
              <span class="mono">₹${r2(printingFoodOrder.grandTotal).toFixed(2)}</span>
            </div>
            ${paymentsHtml}
            ${
              (printingFoodOrder.balanceDue ?? 0) > 0
                ? `<div style="display:flex;justify-content:space-between;margin-top:3px;" class="bold"><span>Balance Due</span><span class="mono">₹${r2(printingFoodOrder.balanceDue || 0).toFixed(2)}</span></div>`
                : ''
            }
            <div class="divider"></div>
            <div class="center bold" style="font-size:10px;">Status: ${escapeHtml(printingFoodOrder.paymentStatus)}</div>
            <div class="center" style="font-size:9.5px;margin-top:2px;">Thank you for dining at ${escapeHtml(hotelName)}!</div>
          `;

          printThermalDocument(
            `${printingFoodOrder.orderNumber} - Invoice`,
            bodyHtml
          );
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPrintingFoodOrder(null)}
          >
            <div
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center border-b border-slate-200 pb-3">
                <div className="text-base font-extrabold text-slate-900 uppercase">{hotelName}</div>
                <div className="mt-2 inline-block px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px] uppercase">
                  {printingFoodOrder.isWithoutGst
                    ? 'Restaurant Food Bill (Bill of Supply)'
                    : printingFoodOrder.customerGstin
                    ? 'B2B Restaurant GST Tax Invoice'
                    : 'Restaurant Food Bill / Tax Invoice'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-b border-slate-100 pb-2.5">
                <div>
                  <div>
                    <strong>Bill No:</strong> {printingFoodOrder.orderNumber}
                  </div>
                  <div>
                    <strong>Mode:</strong> {printingFoodOrder.orderType}
                  </div>
                  {printingFoodOrder.companyName && (
                    <div>
                      <strong>Company:</strong> {printingFoodOrder.companyName}
                    </div>
                  )}
                  {printingFoodOrder.customerGstin && (
                    <div>
                      <strong>Customer GSTIN:</strong> {printingFoodOrder.customerGstin}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div>
                    <strong>Date:</strong> {printingFoodOrder.dateTime}
                  </div>
                  <div>
                    <strong>Target:</strong>{' '}
                    {printingFoodOrder.roomNumber
                      ? `Room ${printingFoodOrder.roomNumber}`
                      : `Table ${printingFoodOrder.tableNumber || 'Counter'}`}
                  </div>
                  {printingFoodOrder.customerName && (
                    <div>
                      <strong>Guest:</strong> {printingFoodOrder.customerName}
                    </div>
                  )}
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400">
                    <th className="py-1.5">Dish</th>
                    <th className="py-1.5 text-center">Qty</th>
                    <th className="py-1.5 text-right">Rate</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printingFoodOrder.items.map((it, idx) => {
                    const cleanName = cleanOrderItemBaseName(it.name, it.variant);
                    return (
                      <tr key={idx}>
                        <td className="py-1.5 font-semibold text-slate-800">
                          <div>
                            {cleanName}
                            {it.variant ? (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                {it.variant}
                              </span>
                            ) : null}
                          </div>
                          {it.addons && it.addons.length > 0 && (
                            <div className="text-[10px] text-slate-500 font-normal">
                              + {it.addons.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 text-center">{it.qty}</td>
                        <td className="py-1.5 text-right">{formatCurrency(it.price)}</td>
                        <td className="py-1.5 text-right font-bold">{formatCurrency(r2(it.qty * it.price))}</td>
                      </tr>
                    );
                  })}
                  {(printingFoodOrder.packagingCharge || 0) > 0 && (
                    <tr>
                      <td className="py-1.5 font-semibold text-slate-700">Packaging Charge</td>
                      <td className="py-1.5 text-center">1</td>
                      <td className="py-1.5 text-right">{formatCurrency(printingFoodOrder.packagingCharge || 0)}</td>
                      <td className="py-1.5 text-right font-bold">{formatCurrency(printingFoodOrder.packagingCharge || 0)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="border-t border-slate-200 pt-2.5 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Food Subtotal</span>
                  <span>{formatCurrency(printingFoodOrder.subtotal)}</span>
                </div>
                {(printingFoodOrder.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      Discount
                      {printingFoodOrder.discountMeta?.reason ? ` (${printingFoodOrder.discountMeta.reason})` : ''}
                    </span>
                    <span>− {formatCurrency(printingFoodOrder.discount || 0)}</span>
                  </div>
                )}
                {printingFoodOrder.isWithoutGst ? (
                  <div className="flex justify-between text-slate-500">
                    <span>GST</span>
                    <span>Not Applied (₹0)</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST ({((printingFoodOrder.gstRate ?? configuredFnbGst) / 2).toFixed(1)}%)</span>
                      <span>{formatCurrency(printingFoodOrder.taxAmount / 2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST ({((printingFoodOrder.gstRate ?? configuredFnbGst) / 2).toFixed(1)}%)</span>
                      <span>{formatCurrency(printingFoodOrder.taxAmount / 2)}</span>
                    </div>
                  </>
                )}
                {(printingFoodOrder.advanceDepositApplied || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Advance Deposit Deducted</span>
                    <span>− {formatCurrency(printingFoodOrder.advanceDepositApplied || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Grand Total</span>
                  <span>{formatCurrency(printingFoodOrder.grandTotal)}</span>
                </div>
                {printingFoodOrder.payments && printingFoodOrder.payments.length > 0 && (
                  <div className="pt-1 text-[11px] text-slate-600 space-y-0.5">
                    {printingFoodOrder.payments.map((p, i) => (
                      <div key={i} className="flex justify-between">
                        <span>
                          Paid via {p.method}
                          {p.reference ? ` (${p.reference})` : ''}
                        </span>
                        <span className="font-bold">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(printingFoodOrder.balanceDue ?? 0) > 0 && (
                  <div className="flex justify-between text-xs font-extrabold text-rose-600 pt-1">
                    <span>Balance Due</span>
                    <span>{formatCurrency(printingFoodOrder.balanceDue || 0)}</span>
                  </div>
                )}
                <div className="text-[11px] font-bold text-emerald-700 pt-1">
                  Settlement Status: {printingFoodOrder.paymentStatus}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handlePrintIsolatedBill}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print 80mm Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingFoodOrder(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

