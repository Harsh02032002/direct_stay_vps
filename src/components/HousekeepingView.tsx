import React, { useState } from 'react';
import {
  Room, Staff, Booking, HotelSettings, LaundryItemMaster, LaundryOrder,
  LostAndFoundItem, HousekeepingCleaningLog, AuditLog, UserRole,
  GuestCheckIn, InventoryProduct, InventoryStockMovement, ExtraCharge, AllocatedGuestService
} from '../types';
import { showToast } from '../utils/toast';
import {
  Sparkles, CheckCircle2, AlertCircle, Clock, Users, Layers,
  ShoppingBag, HelpCircle, FileText, Settings, Plus, Search,
  Filter, Check, X, Shield, Eye, RefreshCw, ArrowUpRight,
  ChevronRight, Trash2, Edit3, Image as ImageIcon, Camera,
  DollarSign, BarChart3, TrendingUp, Calendar, UserCheck
} from 'lucide-react';

const PREFERRED_CATEGORY_ORDER = ['Deluxe', 'Executive', 'Standard', 'Family'];

const normalizeCategory = (cat?: string): string => {
  if (!cat) return 'Standard';
  const trimmed = cat.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'delux' || lower === 'deluxe') return 'Deluxe';
  if (lower === 'executive' || lower === 'executive room' || lower === 'executive suite') return 'Executive';
  if (lower === 'standard' || lower === 'standard room') return 'Standard';
  if (lower === 'family' || lower === 'family room' || lower === 'family suite' || lower === 'familyroom') return 'Family';
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

interface HousekeepingViewProps {
  rooms: Room[];
  onUpdateRooms: (rooms: Room[]) => void;
  staff: Staff[];
  bookings: Booking[];
  checkins?: GuestCheckIn[];
  onUpdateCheckins?: (checkins: GuestCheckIn[]) => void;
  hotelSettings?: HotelSettings;
  onUpdateHotelSettings?: (settings: HotelSettings) => void;
  laundryItems: LaundryItemMaster[];
  onUpdateLaundryItems: (items: LaundryItemMaster[]) => void;
  laundryOrders: LaundryOrder[];
  onUpdateLaundryOrders: (orders: LaundryOrder[]) => void;
  lostAndFoundItems: LostAndFoundItem[];
  onUpdateLostAndFoundItems: (items: LostAndFoundItem[]) => void;
  cleaningLogs: HousekeepingCleaningLog[];
  onUpdateCleaningLogs: (logs: HousekeepingCleaningLog[]) => void;
  inventoryProducts?: InventoryProduct[];
  onUpdateInventoryProducts?: (items: InventoryProduct[]) => void;
  inventoryStockMovements?: InventoryStockMovement[];
  onUpdateInventoryMovements?: (items: InventoryStockMovement[]) => void;
  selectedHotelId?: string;
  auditLogs: AuditLog[];
  onAddAuditLog: (action: string, details: string) => void;
  currentRole?: UserRole;
  loggedInUser?: string;
  subTab?: string;
  onSelectSubTab?: (tab: 'dashboard' | 'room_cleaning' | 'laundry' | 'lost_found' | 'reports' | 'settings') => void;
}

export const HousekeepingView: React.FC<HousekeepingViewProps> = ({
  rooms,
  onUpdateRooms,
  staff,
  bookings,
  checkins = [],
  onUpdateCheckins,
  hotelSettings,
  onUpdateHotelSettings,
  laundryItems,
  onUpdateLaundryItems,
  laundryOrders,
  onUpdateLaundryOrders,
  lostAndFoundItems,
  onUpdateLostAndFoundItems,
  cleaningLogs,
  onUpdateCleaningLogs,
  inventoryProducts = [],
  onUpdateInventoryProducts,
  inventoryStockMovements = [],
  onUpdateInventoryMovements,
  selectedHotelId,
  onAddAuditLog,
  currentRole = 'Admin',
  loggedInUser = 'System',
  subTab = 'room_cleaning',
  onSelectSubTab
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'room_cleaning' | 'laundry' | 'lost_found' | 'reports' | 'settings'>(
    (subTab as any) || 'room_cleaning'
  );

  React.useEffect(() => {
    if (subTab && ['dashboard', 'room_cleaning', 'laundry', 'lost_found', 'reports', 'settings'].includes(subTab)) {
      setActiveTab(subTab as any);
    }
  }, [subTab]);

  // Room cleaning filter state
  const [roomFilter, setRoomFilter] = useState<'ALL' | 'Dirty' | 'Clean' | 'Inspecting' | 'Out of Order'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states for Room Cleaning
  const [selectedRoomForChecklist, setSelectedRoomForChecklist] = useState<Room | null>(null);
  const [checklistItems, setChecklistItems] = useState<{ [key: string]: boolean }>({
    'Linens Changed': true,
    'Bathroom Disinfected': true,
    'Dusting & Vacuuming': true,
    'Restocked Amenities': true,
    'Mini Bar & Water checked': true
  });
  const [checklistNotes, setChecklistNotes] = useState('');
  const [assignedStaffInput, setAssignedStaffInput] = useState('');
  const [checklistSupplyProductId, setChecklistSupplyProductId] = useState('');
  const [checklistSupplyQty, setChecklistSupplyQty] = useState(1);

  // Supervisor inspection modal state
  const [selectedRoomForInspection, setSelectedRoomForInspection] = useState<Room | null>(null);
  const [inspectionResult, setInspectionResult] = useState<'Pass' | 'Fail'>('Pass');
  const [inspectionNotes, setInspectionNotes] = useState('');

  // Laundry states
  const [laundrySubTab, setLaundrySubTab] = useState<'orders' | 'master'>('orders');
  const [laundryOrderFilter, setLaundryOrderFilter] = useState<'ALL' | 'Guest Laundry' | 'Hotel Linen Laundry'>('ALL');
  const [isNewLaundryModalOpen, setIsNewLaundryModalOpen] = useState(false);
  const [customClothName, setCustomClothName] = useState('');
  const [customClothRate, setCustomClothRate] = useState('');
  const [customClothQty, setCustomClothQty] = useState(1);
  const [saveCustomClothToMaster, setSaveCustomClothToMaster] = useState(true);
  const [laundrySupplyProductId, setLaundrySupplyProductId] = useState('');
  const [laundrySupplyQty, setLaundrySupplyQty] = useState(1);
  const [newLaundryOrder, setNewLaundryOrder] = useState<{
    orderType: 'Guest Laundry' | 'Hotel Linen Laundry';
    roomNumber: string;
    guestName: string;
    items: { itemId: string; name?: string; unitPrice?: number; quantity: number }[];
    paymentStatus: 'Pending' | 'Billed to Room' | 'Paid' | 'Complimentary';
    deliveryStatus: 'Pending' | 'In Wash' | 'Ironing' | 'Ready for Delivery' | 'Delivered';
    notes: string;
    handledBy: string;
  }>({
    orderType: 'Guest Laundry',
    roomNumber: '',
    guestName: '',
    items: [],
    paymentStatus: 'Billed to Room',
    deliveryStatus: 'In Wash',
    notes: '',
    handledBy: loggedInUser
  });

  // Laundry Master edit state
  const [isEditingItemModal, setIsEditingItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LaundryItemMaster>({
    id: '',
    name: '',
    price: 0,
    category: 'Guest Garment',
    unit: 'piece'
  });

  // Lost & Found states
  const [lostFoundTab, setLostFoundTab] = useState<'active' | 'claimed'>('active');
  const [isNewLostItemModalOpen, setIsNewLostItemModalOpen] = useState(false);
  const [newLostItem, setNewLostItem] = useState<{
    itemName: string;
    category: 'Electronics' | 'Clothing' | 'Documents/Wallet' | 'Jewelry' | 'Toiletries' | 'Others';
    roomNumber: string;
    locationFound: string;
    foundByStaff: string;
    description: string;
    imagePath: string;
  }>({
    itemName: '',
    category: 'Electronics',
    roomNumber: '',
    locationFound: '',
    foundByStaff: loggedInUser,
    description: '',
    imagePath: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=300'
  });

  // Claim Modal state
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<LostAndFoundItem | null>(null);
  const [claimGuestName, setClaimGuestName] = useState('');
  const [claimGuestMobile, setClaimGuestMobile] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  // Settings states
  const [autoMarkDirtyOnCheckout, setAutoMarkDirtyOnCheckout] = useState(hotelSettings?.autoMarkDirtyOnCheckout ?? true);
  const [requireInspectionToClean, setRequireInspectionToClean] = useState(hotelSettings?.requireInspectionToClean ?? false);
  const [notifyGuestOnLaundryReady, setNotifyGuestOnLaundryReady] = useState(true);

  // Housekeeping staff list
  const hkStaff = staff.filter(s => s.department === 'Housekeeping' || s.roleName === 'Housekeeping' || s.designation.toLowerCase().includes('housekeep') || s.designation.toLowerCase().includes('clean'));
  const availableStaffList = hkStaff.length > 0 ? hkStaff : staff;

  // Helper to resolve canonical Housekeeping status for a room
  const getRoomHkStatus = (r: Room): 'Clean' | 'Dirty' | 'Inspecting' | 'Out of Order' => {
    if ((r.cleaningStatus as string) === 'Out of Order' || (r.status as string) === 'Out of Order' || (r.status as string) === 'Maintenance') {
      return 'Out of Order';
    }
    if ((r.cleaningStatus as string) === 'Inspecting' || (r.cleaningStatus as string) === 'In Progress' || (r.status as string) === 'Cleaning') {
      return 'Inspecting';
    }
    if (r.cleaningStatus === 'Dirty' || r.status === 'Dirty') {
      return 'Dirty';
    }
    return 'Clean';
  };

  // --- STATS COMPUTATIONS ---
  const dirtyRoomsCount = rooms.filter(r => getRoomHkStatus(r) === 'Dirty').length;
  const cleanRoomsCount = rooms.filter(r => getRoomHkStatus(r) === 'Clean').length;
  const readyRoomsCount = rooms.filter(r => r.status === 'Available' && getRoomHkStatus(r) === 'Clean').length;
  const underCleaningCount = rooms.filter(r => getRoomHkStatus(r) === 'Inspecting').length;
  const outOfOrderRoomsCount = rooms.filter(r => getRoomHkStatus(r) === 'Out of Order').length;

  const totalLaundryOrders = laundryOrders.length;
  const pendingDeliveryOrders = laundryOrders.filter(o => o.deliveryStatus !== 'Delivered').length;
  const totalLaundryRevenue = laundryOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const totalHkStaff = availableStaffList.length;
  const onDutyStaff = availableStaffList.filter(s => s.status === 'Active').length;

  // --- ROOM CLEANING HANDLERS ---
  const handleChangeRoomHkStatus = (
    roomNumber: string,
    targetStatus: 'Clean' | 'Dirty' | 'Inspecting' | 'Out of Order'
  ) => {
    const updatedRooms = rooms.map(r => {
      if (r.number !== roomNumber) return r;
      const isOccupied = r.status === 'Occupied';
      const isReserved = r.status === 'Reserved';
      let nextRoomStatus = r.status;

      if (targetStatus === 'Out of Order') {
        nextRoomStatus = isOccupied ? 'Occupied' : 'Out of Order';
      } else if (targetStatus === 'Dirty') {
        nextRoomStatus = isOccupied ? 'Occupied' : isReserved ? 'Reserved' : 'Dirty';
      } else if (targetStatus === 'Inspecting') {
        nextRoomStatus = isOccupied ? 'Occupied' : isReserved ? 'Reserved' : 'Dirty';
      } else if (targetStatus === 'Clean') {
        nextRoomStatus = isOccupied ? 'Occupied' : isReserved ? 'Reserved' : 'Available';
      }

      return {
        ...r,
        cleaningStatus: targetStatus as any,
        status: nextRoomStatus as any
      };
    });
    onUpdateRooms(updatedRooms);

    const logStatusMap: Record<typeof targetStatus, HousekeepingCleaningLog['status']> = {
      'Clean': 'Cleaned',
      'Dirty': 'Pending',
      'Inspecting': 'In Progress',
      'Out of Order': 'Pending'
    };

    const newLog: HousekeepingCleaningLog = {
      id: `cl-${Date.now()}`,
      roomNumber,
      assignedStaff: loggedInUser,
      assignedAt: new Date().toISOString(),
      ...(targetStatus === 'Clean' ? { cleanedAt: new Date().toISOString() } : {}),
      ...(targetStatus === 'Inspecting' ? { inspectedAt: new Date().toISOString(), inspectedBy: loggedInUser } : {}),
      status: logStatusMap[targetStatus],
      checklistCompleted: targetStatus === 'Clean' ? ['All Checklist Items Verified'] : [],
      notes: `Room status changed to ${targetStatus} by ${loggedInUser}`
    };
    onUpdateCleaningLogs([newLog, ...cleaningLogs]);
    onAddAuditLog('Housekeeping Status Updated', `Room #${roomNumber} status changed to "${targetStatus}" by ${loggedInUser}.`);
    showToast(`Room #${roomNumber} status updated to ${targetStatus}.`, 'success');
  };

  const handleAssignStaff = (roomNumber: string, staffName: string) => {
    const updatedRooms = rooms.map(r => r.number === roomNumber ? { ...r, cleaningStatus: 'In Progress' as const } : r);
    onUpdateRooms(updatedRooms);

    const newLog: HousekeepingCleaningLog = {
      id: `cl-${Date.now()}`,
      roomNumber,
      assignedStaff: staffName,
      assignedAt: new Date().toISOString(),
      status: 'In Progress',
      checklistCompleted: []
    };
    onUpdateCleaningLogs([newLog, ...cleaningLogs]);
    onAddAuditLog('Housekeeping Assign', `Assigned room ${roomNumber} to ${staffName} for cleaning.`);
    showToast(`Assigned Room #${roomNumber} to ${staffName}.`, 'success');
  };

  const handleMarkRoomReady = (roomNumber: string) => {
    handleChangeRoomHkStatus(roomNumber, 'Clean');
  };

  const currentHotelId =
    selectedHotelId ||
    (typeof window !== 'undefined' && sessionStorage.getItem('pms_hotel_id')) ||
    hotelSettings?.id ||
    'hotel-1';

  const activeCheckins = checkins.filter(
    c =>
      !c.checkedOutBy &&
      !c.checkedOutDateTime &&
      String((c as any).status || '').toLowerCase() !== 'checked out' &&
      String((c as any).status || '').toLowerCase() !== 'completed'
  );

  const getActiveStayForRoom = (roomNo: string): GuestCheckIn | undefined => {
    if (!roomNo) return undefined;
    return activeCheckins.find(
      c =>
        String(c.roomNumber).trim() === String(roomNo).trim() ||
        (c.bookedRooms || []).some(br => String(br.roomNumber).trim() === String(roomNo).trim())
    );
  };

  // Validate and deduct inventory supply product for housekeeping/laundry consumption
  const validateAndDeductInventorySupply = (
    productId: string,
    qtyToUse: number,
    referenceId: string,
    notes: string
  ): boolean => {
    if (!productId) return true;
    const reqQty = Math.max(0, Number(qtyToUse) || 0);
    if (reqQty <= 0) {
      showToast('Please enter a valid inventory supply quantity (> 0).', 'warning');
      return false;
    }
    const prod = inventoryProducts.find(p => p.id === productId);
    if (!prod) {
      showToast('Selected inventory supply product not found.', 'error');
      return false;
    }
    if (Number(prod.currentStock) < reqQty) {
      showToast(
        `Insufficient stock for "${prod.name}": available ${prod.currentStock} ${prod.unit}, required ${reqQty} ${prod.unit}.`,
        'error'
      );
      return false;
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const prevStock = Number(prod.currentStock) || 0;
    const newStock = Math.max(0, parseFloat((prevStock - reqQty).toFixed(2)));
    const minAlert = Number(prod.minStockAlert) || 0;
    const newStatus: InventoryProduct['status'] =
      newStock <= 0 ? 'Out of Stock' : newStock <= minAlert ? 'Low Stock' : 'In Stock';

    if (onUpdateInventoryProducts) {
      onUpdateInventoryProducts(
        inventoryProducts.map(p =>
          p.id === prod.id
            ? { ...p, currentStock: newStock, status: newStatus, lastUpdated: nowIso }
            : p
        )
      );
    }

    if (onUpdateInventoryMovements) {
      const movement: InventoryStockMovement = {
        id: `MOV-HK-${referenceId}-${prod.id}`,
        productId: prod.id,
        productName: prod.name,
        type: 'OUT',
        quantity: reqQty,
        previousStock: prevStock,
        newStock,
        date: todayStr,
        time: new Date().toLocaleTimeString(),
        referenceType: 'Housekeeping',
        referenceId,
        notes,
        performedBy: loggedInUser || currentRole || 'Housekeeping',
        hotelId: currentHotelId
      };
      onUpdateInventoryMovements([movement, ...inventoryStockMovements]);
    }
    return true;
  };

  // Sync a Guest Laundry order with the active guest stay folio (Room Bill -> EC-LND-*, Complimentary -> ₹0, Paid/Pending -> remove EC-LND-*)
  const syncLaundryOrderToGuestFolio = (order: LaundryOrder) => {
    if (!onUpdateCheckins || order.orderType !== 'Guest Laundry' || !order.roomNumber) return;

    const targetStay =
      checkins.find(c => c.id === (order.checkInId || order.checkinId)) ||
      getActiveStayForRoom(order.roomNumber);
    if (!targetStay) return;

    const chargeId = order.folioChargeId || `EC-LND-${order.id}`;
    const allocId = `ALLOC-LND-${order.id}`;
    const isRoomBill = order.paymentStatus === 'Billed to Room' || (order.paymentStatus as string) === 'Room Bill';
    const isComplimentary = order.paymentStatus === 'Complimentary';
    const amount = isComplimentary ? 0 : Math.max(0, Number(order.totalAmount) || 0);
    const itemsSummary = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
    const nowTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedCheckins = checkins.map(c => {
      if (c.id !== targetStay.id) return c;
      const prevExtras = c.extraCharges || [];
      const existingIdx = prevExtras.findIndex(
        ec => ec.id === chargeId || (ec.sourceType === 'laundry_order' && ec.sourceId === order.id)
      );
      const prevAllocated = c.allocatedServices || [];

      if (isRoomBill && amount > 0) {
        const newCharge: ExtraCharge = {
          id: chargeId,
          description: `Laundry Order #${order.orderNumber} (${itemsSummary})`,
          amount,
          date: order.date || new Date().toISOString().split('T')[0],
          dateTime: nowTimeStr,
          addedBy: order.handledBy || loggedInUser,
          sourceType: 'laundry_order',
          sourceId: order.id
        };
        let nextExtras: ExtraCharge[];
        let deltaPending = 0;
        if (existingIdx >= 0) {
          const oldAmt = Number(prevExtras[existingIdx].amount) || 0;
          deltaPending = amount - oldAmt;
          nextExtras = prevExtras.map((ec, i) => (i === existingIdx ? newCharge : ec));
        } else {
          deltaPending = amount;
          nextExtras = [...prevExtras, newCharge];
        }

        const allocEntry: AllocatedGuestService = {
          id: allocId,
          hotelId: currentHotelId,
          serviceId: order.id,
          serviceName: `Laundry #${order.orderNumber} (${itemsSummary})`,
          configuredAmount: amount,
          chargedAmount: amount,
          isChargeable: true,
          roomNumber: order.roomNumber,
          checkInId: c.id,
          guestName: c.guestName,
          allocatedBy: order.handledBy || loggedInUser,
          dateTime: nowTimeStr
        };
        const nextAllocated = prevAllocated.some(s => s.id === allocId)
          ? prevAllocated.map(s => (s.id === allocId ? allocEntry : s))
          : [...prevAllocated, allocEntry];

        return {
          ...c,
          extraCharges: nextExtras,
          allocatedServices: nextAllocated,
          pendingAmount: Math.max(0, parseFloat((Number(c.pendingAmount || 0) + deltaPending).toFixed(2)))
        };
      }

      // If Complimentary or Paid/Pending, remove any existing EC-LND-* from extraCharges
      let nextExtras = prevExtras;
      let nextPending = Number(c.pendingAmount || 0);
      if (existingIdx >= 0) {
        const oldAmt = Number(prevExtras[existingIdx].amount) || 0;
        nextExtras = prevExtras.filter((_, i) => i !== existingIdx);
        nextPending = Math.max(0, parseFloat((nextPending - oldAmt).toFixed(2)));
      }

      let nextAllocated = prevAllocated;
      if (isComplimentary) {
        const compAlloc: AllocatedGuestService = {
          id: allocId,
          hotelId: currentHotelId,
          serviceId: order.id,
          serviceName: `Laundry #${order.orderNumber} (${itemsSummary} - Complimentary)`,
          configuredAmount: 0,
          chargedAmount: 0,
          isChargeable: false,
          roomNumber: order.roomNumber,
          checkInId: c.id,
          guestName: c.guestName,
          allocatedBy: order.handledBy || loggedInUser,
          dateTime: nowTimeStr
        };
        nextAllocated = prevAllocated.some(s => s.id === allocId)
          ? prevAllocated.map(s => (s.id === allocId ? compAlloc : s))
          : [...prevAllocated, compAlloc];
      }

      return {
        ...c,
        extraCharges: nextExtras,
        allocatedServices: nextAllocated,
        pendingAmount: nextPending
      };
    });

    onUpdateCheckins(updatedCheckins);
  };

  const handleOpenChecklist = (room: Room) => {
    setSelectedRoomForChecklist(room);
    setChecklistItems({
      'Linens Changed': true,
      'Bathroom Disinfected': true,
      'Dusting & Vacuuming': true,
      'Restocked Amenities': true,
      'Mini Bar & Water checked': true
    });
    setChecklistNotes('');
    setChecklistSupplyProductId('');
    setChecklistSupplyQty(1);
    setAssignedStaffInput(availableStaffList[0]?.name || loggedInUser);
  };

  const handleSaveChecklist = () => {
    if (!selectedRoomForChecklist) return;
    const logId = `cl-${Date.now()}`;

    // Priority 3: Validate and deduct optional housekeeping inventory supply before completing checklist
    if (checklistSupplyProductId) {
      const ok = validateAndDeductInventorySupply(
        checklistSupplyProductId,
        checklistSupplyQty,
        logId,
        `Housekeeping room cleaning consumption for Room #${selectedRoomForChecklist.number}`
      );
      if (!ok) return;
    }

    const completedList = Object.entries(checklistItems).filter(([_, checked]) => checked).map(([item]) => item);
    
    const nextStatus = requireInspectionToClean ? 'Inspecting' : 'Clean';
    const nextRoomStatus = requireInspectionToClean ? 'Dirty' : 'Available';

    const updatedRooms = rooms.map(r => {
      if (r.number === selectedRoomForChecklist.number) {
        return {
          ...r,
          cleaningStatus: nextStatus as any,
          status: (r.status === 'Occupied' ? 'Occupied' : nextRoomStatus) as any
        };
      }
      return r;
    });
    onUpdateRooms(updatedRooms);

    const newLog: HousekeepingCleaningLog = {
      id: logId,
      hotelId: currentHotelId,
      roomNumber: selectedRoomForChecklist.number,
      assignedStaff: assignedStaffInput || loggedInUser,
      assignedAt: new Date().toISOString(),
      cleanedAt: new Date().toISOString(),
      status: requireInspectionToClean ? 'In Progress' : 'Cleaned',
      checklistCompleted: completedList,
      notes: checklistNotes || 'Completed standard cleaning checklist'
    };
    onUpdateCleaningLogs([newLog, ...cleaningLogs]);
    onAddAuditLog('Cleaning Checklist Completed', `Room #${selectedRoomForChecklist.number} cleaned by ${assignedStaffInput}. Status set to ${nextStatus}.`);
    setSelectedRoomForChecklist(null);
  };

  const handleSaveInspection = () => {
    if (!selectedRoomForInspection) return;
    const nextStatus = inspectionResult === 'Pass' ? 'Clean' : 'Dirty';
    const nextRoomStatus = inspectionResult === 'Pass' ? 'Available' : 'Dirty';

    const updatedRooms = rooms.map(r => {
      if (r.number === selectedRoomForInspection.number) {
        return {
          ...r,
          cleaningStatus: nextStatus as any,
          status: (r.status === 'Occupied' ? 'Occupied' : nextRoomStatus) as any
        };
      }
      return r;
    });
    onUpdateRooms(updatedRooms);

    const newLog: HousekeepingCleaningLog = {
      id: `cl-${Date.now()}`,
      hotelId: currentHotelId,
      roomNumber: selectedRoomForInspection.number,
      assignedStaff: 'Housekeeping Team',
      assignedAt: new Date().toISOString(),
      inspectedAt: new Date().toISOString(),
      inspectedBy: loggedInUser,
      inspectionResult: inspectionResult,
      status: 'Inspected',
      checklistCompleted: ['Supervisor Inspected'],
      notes: `Inspection Result: ${inspectionResult}. ${inspectionNotes}`
    };
    onUpdateCleaningLogs([newLog, ...cleaningLogs]);
    onAddAuditLog('Room Inspection', `Supervisor ${loggedInUser} inspected Room #${selectedRoomForInspection.number}: ${inspectionResult}.`);
    setSelectedRoomForInspection(null);
  };

  // --- LAUNDRY HANDLERS ---
  const handleAddLaundryOrderItem = (itemId: string) => {
    if (!itemId) return;
    const master = laundryItems.find(i => i.id === itemId);
    const exists = newLaundryOrder.items.find(i => i.itemId === itemId);
    if (exists) {
      setNewLaundryOrder({
        ...newLaundryOrder,
        items: newLaundryOrder.items.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i)
      });
    } else {
      setNewLaundryOrder({
        ...newLaundryOrder,
        items: [
          ...newLaundryOrder.items,
          {
            itemId,
            name: master?.name || 'Custom Cloth',
            unitPrice: master?.price || 0,
            quantity: 1
          }
        ]
      });
    }
  };

  const handleAddCustomClothToOrder = () => {
    const trimmedName = customClothName.trim();
    const parsedRate = Number(customClothRate);
    const parsedQty = Math.max(1, Number(customClothQty) || 1);

    if (!trimmedName) {
      showToast('Please enter the Type of Cloth / Garment name.', 'warning');
      return;
    }
    if (customClothRate === '' || isNaN(parsedRate) || parsedRate < 0) {
      showToast('Please enter a valid Rate (₹) for the cloth.', 'warning');
      return;
    }

    const customId = `custom-${Date.now()}`;
    const targetCategory: LaundryItemMaster['category'] =
      newLaundryOrder.orderType === 'Hotel Linen Laundry' ? 'Hotel Linen' : 'Guest Garment';

    if (saveCustomClothToMaster) {
      const existingMaster = laundryItems.find(
        i => i.name.toLowerCase() === trimmedName.toLowerCase() && i.category === targetCategory
      );
      if (existingMaster) {
        onUpdateLaundryItems(
          laundryItems.map(i => (i.id === existingMaster.id ? { ...i, price: parsedRate, hotelId: i.hotelId || currentHotelId } : i))
        );
        onAddAuditLog(
          'Laundry Rate Updated',
          `Updated master laundry rate for "${trimmedName}" (${targetCategory}) to ₹${parsedRate}.`
        );
      } else {
        onUpdateLaundryItems([
          ...laundryItems,
          {
            id: `li-${Date.now()}`,
            hotelId: currentHotelId,
            name: trimmedName,
            price: parsedRate,
            category: targetCategory,
            unit: 'piece'
          }
        ]);
        onAddAuditLog(
          'Laundry Item Added',
          `Added custom laundry cloth "${trimmedName}" (${targetCategory}) at ₹${parsedRate}/piece to master catalog.`
        );
      }
    }

    setNewLaundryOrder(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemId: customId,
          name: trimmedName,
          unitPrice: parsedRate,
          quantity: parsedQty
        }
      ]
    }));

    setCustomClothName('');
    setCustomClothRate('');
    setCustomClothQty(1);
    showToast(`Added "${trimmedName}" (₹${parsedRate}) to laundry order.`, 'success');
  };

  const handleUpdateOrderItemName = (itemId: string, newName: string) => {
    setNewLaundryOrder(prev => ({
      ...prev,
      items: prev.items.map(i => (i.itemId === itemId ? { ...i, name: newName } : i))
    }));
  };

  const handleUpdateOrderItemRate = (itemId: string, newRate: number) => {
    setNewLaundryOrder(prev => ({
      ...prev,
      items: prev.items.map(i => (i.itemId === itemId ? { ...i, unitPrice: Math.max(0, newRate) } : i))
    }));
  };

  const handleUpdateOrderItemQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setNewLaundryOrder({
        ...newLaundryOrder,
        items: newLaundryOrder.items.filter(i => i.itemId !== itemId)
      });
    } else {
      setNewLaundryOrder({
        ...newLaundryOrder,
        items: newLaundryOrder.items.map(i => i.itemId === itemId ? { ...i, quantity: qty } : i)
      });
    }
  };

  const calculateNewOrderTotal = () => {
    if (newLaundryOrder.paymentStatus === 'Complimentary') return 0;
    return newLaundryOrder.items.reduce((sum, lineItem) => {
      const master = laundryItems.find(i => i.id === lineItem.itemId);
      const price = lineItem.unitPrice !== undefined ? lineItem.unitPrice : (master?.price || 0);
      return sum + (price * lineItem.quantity);
    }, 0);
  };

  const handleCreateLaundryOrder = () => {
    if (newLaundryOrder.items.length === 0) {
      showToast('Please select or add at least one cloth / laundry item.', 'warning');
      return;
    }

    const isGuestLaundry = newLaundryOrder.orderType === 'Guest Laundry';
    const isRoomBilled = newLaundryOrder.paymentStatus === 'Billed to Room';
    const isComplimentary = newLaundryOrder.paymentStatus === 'Complimentary';
    let activeStay: GuestCheckIn | undefined;

    if (isGuestLaundry) {
      if (!newLaundryOrder.roomNumber) {
        showToast('Please select a Room Number for Guest Laundry.', 'warning');
        return;
      }
      activeStay = getActiveStayForRoom(newLaundryOrder.roomNumber);
      if ((isRoomBilled || isComplimentary) && !activeStay) {
        showToast(
          `Room #${newLaundryOrder.roomNumber} does not have an active checked-in guest stay for ${newLaundryOrder.paymentStatus} laundry.`,
          'error'
        );
        return;
      }
    }

    const orderId = `lo-${Date.now()}`;
    const orderNumber = `LND-${Math.floor(1000 + Math.random() * 9000)}`;

    // Priority 3: Validate & deduct optional laundry supply inventory before creating order
    if (laundrySupplyProductId) {
      const ok = validateAndDeductInventorySupply(
        laundrySupplyProductId,
        laundrySupplyQty,
        orderId,
        `Laundry order #${orderNumber} supply consumption`
      );
      if (!ok) return;
    }

    const totalAmount = isComplimentary ? 0 : calculateNewOrderTotal();
    const orderItems = newLaundryOrder.items.map(lineItem => {
      const master = laundryItems.find(i => i.id === lineItem.itemId);
      const itemName = (lineItem.name && lineItem.name.trim()) ? lineItem.name.trim() : (master?.name || 'Custom Cloth');
      const itemPrice = isComplimentary ? 0 : (lineItem.unitPrice !== undefined ? lineItem.unitPrice : (master?.price || 0));
      return {
        itemId: lineItem.itemId,
        name: itemName,
        unitPrice: itemPrice,
        quantity: lineItem.quantity,
        total: itemPrice * lineItem.quantity
      };
    });

    const newOrder: LaundryOrder = {
      id: orderId,
      hotelId: currentHotelId,
      orderNumber,
      orderType: newLaundryOrder.orderType,
      roomNumber: isGuestLaundry ? newLaundryOrder.roomNumber : '',
      guestName: isGuestLaundry ? (activeStay?.guestName || newLaundryOrder.guestName || 'Guest') : 'Internal Hotel Linen',
      checkInId: activeStay?.id,
      checkinId: activeStay?.id,
      folioChargeId: isGuestLaundry && isRoomBilled && totalAmount > 0 ? `EC-LND-${orderId}` : undefined,
      inventoryProductId: laundrySupplyProductId || undefined,
      inventoryQtyUsed: laundrySupplyProductId ? Number(laundrySupplyQty) || 1 : undefined,
      items: orderItems,
      totalAmount,
      paymentStatus: newLaundryOrder.paymentStatus,
      deliveryStatus: newLaundryOrder.deliveryStatus,
      date: new Date().toISOString().split('T')[0],
      notes: newLaundryOrder.notes,
      handledBy: newLaundryOrder.handledBy
    };

    onUpdateLaundryOrders([newOrder, ...laundryOrders]);

    if (isGuestLaundry) {
      syncLaundryOrderToGuestFolio(newOrder);
    }

    onAddAuditLog(
      'New Laundry Order',
      `Created laundry order #${newOrder.orderNumber} (${newOrder.orderType}, ${newOrder.paymentStatus}) for ₹${totalAmount}${
        isGuestLaundry && isRoomBilled ? ` — billed to Room #${newOrder.roomNumber} (${newOrder.guestName})` : ''
      }.`
    );
    showToast(
      isGuestLaundry && isRoomBilled
        ? `Laundry Order #${newOrder.orderNumber} created. ₹${totalAmount} added to Room #${newOrder.roomNumber} folio!`
        : isComplimentary
          ? `Complimentary Laundry Order #${newOrder.orderNumber} created (₹0 charged).`
          : `Laundry Order #${newOrder.orderNumber} created (₹${totalAmount}).`,
      'success'
    );
    setIsNewLaundryModalOpen(false);
    setLaundrySupplyProductId('');
    setLaundrySupplyQty(1);
    setNewLaundryOrder({
      orderType: 'Guest Laundry',
      roomNumber: '',
      guestName: '',
      items: [],
      paymentStatus: 'Billed to Room',
      deliveryStatus: 'In Wash',
      notes: '',
      handledBy: loggedInUser
    });
  };

  const handleUpdateDeliveryStatus = (orderId: string, status: any) => {
    const updated = laundryOrders.map(o => o.id === orderId ? { ...o, deliveryStatus: status } : o);
    onUpdateLaundryOrders(updated);
    onAddAuditLog('Laundry Status Update', `Order #${orderId} status changed to ${status}.`);
  };

  const handleUpdatePaymentStatus = (orderId: string, status: any) => {
    const existing = laundryOrders.find(o => o.id === orderId);
    if (!existing) return;

    if (existing.orderType === 'Guest Laundry' && (status === 'Billed to Room' || status === 'Room Bill')) {
      const stay = getActiveStayForRoom(existing.roomNumber);
      if (!stay) {
        showToast(`Room #${existing.roomNumber} does not have an active checked-in guest stay.`, 'error');
        return;
      }
    }

    const rawItemsSum = existing.items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
    const nextTotal = status === 'Complimentary' ? 0 : (existing.totalAmount > 0 ? existing.totalAmount : rawItemsSum);
    const updatedOrder: LaundryOrder = {
      ...existing,
      paymentStatus: status,
      totalAmount: nextTotal,
      folioChargeId:
        existing.orderType === 'Guest Laundry' && (status === 'Billed to Room' || status === 'Room Bill') && nextTotal > 0
          ? `EC-LND-${existing.id}`
          : existing.folioChargeId
    };

    const updated = laundryOrders.map(o => (o.id === orderId ? updatedOrder : o));
    onUpdateLaundryOrders(updated);
    if (updatedOrder.orderType === 'Guest Laundry') {
      syncLaundryOrderToGuestFolio(updatedOrder);
    }
    onAddAuditLog('Laundry Payment Update', `Order #${existing.orderNumber || orderId} payment status changed to ${status}.`);
  };

  const handleSaveMasterItem = () => {
    if (!editingItem.name || editingItem.price <= 0) {
      showToast('Please enter item name and valid price.', 'warning');
      return;
    }
    if (editingItem.id) {
      onUpdateLaundryItems(
        laundryItems.map(i => (i.id === editingItem.id ? { ...editingItem, hotelId: editingItem.hotelId || currentHotelId } : i))
      );
      onAddAuditLog(
        'Laundry Rate Updated',
        `Updated laundry item "${editingItem.name}" (${editingItem.category}) rate to ₹${editingItem.price}/${editingItem.unit}.`
      );
    } else {
      const createdId = `li-${Date.now()}`;
      onUpdateLaundryItems([...laundryItems, { ...editingItem, id: createdId, hotelId: currentHotelId }]);
      onAddAuditLog(
        'Laundry Item Added',
        `Added new laundry item "${editingItem.name}" (${editingItem.category}) at ₹${editingItem.price}/${editingItem.unit}.`
      );
    }
    setIsEditingItemModal(false);
  };

  // --- LOST & FOUND HANDLERS ---
  const handleRegisterLostItem = () => {
    if (!newLostItem.itemName || !newLostItem.locationFound) {
      showToast('Please enter item name and found location.', 'warning');
      return;
    }
    const item: LostAndFoundItem = {
      id: `lf-${Date.now()}`,
      itemName: newLostItem.itemName,
      category: newLostItem.category,
      roomNumber: newLostItem.roomNumber,
      locationFound: newLostItem.locationFound,
      foundByStaff: newLostItem.foundByStaff || loggedInUser,
      dateFound: new Date().toISOString().split('T')[0],
      status: 'Registered',
      description: newLostItem.description,
      imagePath: newLostItem.imagePath,
      claimedByGuest: '',
      claimGuestMobile: '',
      claimDate: '',
      returnNotes: ''
    };
    onUpdateLostAndFoundItems([item, ...lostAndFoundItems]);
    onAddAuditLog('Lost & Found Registered', `Registered found item: ${item.itemName} at ${item.locationFound}.`);
    setIsNewLostItemModalOpen(false);
    setNewLostItem({
      itemName: '',
      category: 'Electronics',
      roomNumber: '',
      locationFound: '',
      foundByStaff: loggedInUser,
      description: '',
      imagePath: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=300'
    });
  };

  const handleSubmitClaim = () => {
    if (!selectedItemForClaim || !claimGuestName) {
      showToast('Please provide claimant guest name.', 'warning');
      return;
    }
    const updated = lostAndFoundItems.map(item => {
      if (item.id === selectedItemForClaim.id) {
        return {
          ...item,
          status: 'Claimed' as const,
          claimedByGuest: claimGuestName,
          claimGuestMobile: claimGuestMobile,
          claimDate: new Date().toISOString().split('T')[0],
          returnNotes: claimNotes
        };
      }
      return item;
    });
    onUpdateLostAndFoundItems(updated);
    onAddAuditLog('Lost & Found Claimed', `Item ${selectedItemForClaim.itemName} claimed by guest ${claimGuestName}.`);
    setSelectedItemForClaim(null);
    setClaimGuestName('');
    setClaimGuestMobile('');
    setClaimNotes('');
  };

  // --- SETTINGS HANDLER ---
  const handleSaveSettings = () => {
    if (onUpdateHotelSettings && hotelSettings) {
      onUpdateHotelSettings({
        ...hotelSettings,
        autoMarkDirtyOnCheckout,
        requireInspectionToClean
      });
    }
    showToast('Housekeeping workflow settings saved successfully.', 'success');
    onAddAuditLog('Housekeeping Settings', `Updated workflow automation rules by ${loggedInUser}.`);
  };

  // Filter rooms for cleaning view
  const filteredRooms = rooms.filter(room => {
    const roomLabel = `${room.number} ${room.category || room.type || ''}`.toLowerCase();
    const matchesSearch = roomLabel.includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (roomFilter === 'ALL') return true;
    return getRoomHkStatus(room) === roomFilter;
  });

  const hkCategories = useMemo(() => {
    const unique = Array.from(
      new Set(filteredRooms.map((r) => normalizeCategory(r.category || (r as any).type)).filter(Boolean))
    );

    return unique.sort((a, b) => {
      const idxA = PREFERRED_CATEGORY_ORDER.indexOf(a);
      const idxB = PREFERRED_CATEGORY_ORDER.indexOf(b);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [filteredRooms]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Sub-Nav */}
      <div className="bg-white rounded-2xl p-6 border border-luxury-brown-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-luxury-gold-600" />
            <h1 className="font-serif font-bold text-2xl text-luxury-brown-950">Housekeeping & Laundry Module</h1>
          </div>
          <p className="text-xs text-luxury-brown-600 mt-1">
            Complete operational command center for room hygiene, laundry order workflows, linen inventories & lost property registers.
          </p>
        </div>

        {/* 6 Core Tabs as requested */}
        <div className="flex flex-wrap items-center gap-1.5 bg-luxury-beige-50 p-1.5 rounded-xl border border-luxury-brown-100">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'dashboard' ? 'bg-luxury-brown-950 text-white shadow-sm' : 'text-luxury-brown-700 hover:bg-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-luxury-gold-400" /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab('room_cleaning')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'room_cleaning' ? 'bg-luxury-brown-950 text-white shadow-sm' : 'text-luxury-brown-700 hover:bg-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-luxury-gold-400" /> Room Cleaning
          </button>
          <button
            onClick={() => setActiveTab('laundry')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'laundry' ? 'bg-luxury-brown-950 text-white shadow-sm' : 'text-luxury-brown-700 hover:bg-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-luxury-gold-400" /> Laundry
          </button>
          <button
            onClick={() => setActiveTab('lost_found')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'lost_found' ? 'bg-luxury-brown-950 text-white shadow-sm' : 'text-luxury-brown-700 hover:bg-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-luxury-gold-400" /> Lost & Found
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'reports' ? 'bg-luxury-brown-950 text-white shadow-sm' : 'text-luxury-brown-700 hover:bg-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-luxury-gold-400" /> Reports
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'settings' ? 'bg-luxury-brown-950 text-white shadow-sm' : 'text-luxury-brown-700 hover:bg-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-luxury-gold-400" /> Settings
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DASHBOARD TAB */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Summary Stat Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div 
              onClick={() => { setActiveTab('room_cleaning'); setRoomFilter('Dirty'); }}
              className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs cursor-pointer hover:border-amber-400 transition group"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Dirty Rooms</span>
                <AlertCircle className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
              </div>
              <p className="text-2xl font-serif font-black text-amber-950 mt-2">{dirtyRoomsCount}</p>
              <span className="text-[10px] text-amber-700 block mt-1 font-medium">Needs instant cleaning</span>
            </div>

            <div 
              onClick={() => { setActiveTab('room_cleaning'); setRoomFilter('Clean'); }}
              className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs cursor-pointer hover:border-emerald-400 transition group"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Clean Rooms</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
              </div>
              <p className="text-2xl font-serif font-black text-emerald-950 mt-2">{cleanRoomsCount}</p>
              <span className="text-[10px] text-emerald-700 block mt-1 font-medium">Sanitized & ready</span>
            </div>

            <div 
              onClick={() => { setActiveTab('room_cleaning'); setRoomFilter('Clean'); }}
              className="bg-white p-4 rounded-xl border border-luxury-gold-300 shadow-xs cursor-pointer hover:border-luxury-gold-500 transition group"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-luxury-gold-800 uppercase tracking-wider">Ready Rooms</span>
                <Sparkles className="w-4 h-4 text-luxury-gold-600 group-hover:scale-110 transition" />
              </div>
              <p className="text-2xl font-serif font-black text-luxury-brown-950 mt-2">{readyRoomsCount}</p>
              <span className="text-[10px] text-luxury-gold-700 block mt-1 font-medium">Available for check-in</span>
            </div>

            <div 
              onClick={() => { setActiveTab('room_cleaning'); setRoomFilter('Inspecting'); }}
              className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs cursor-pointer hover:border-blue-400 transition group"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Inspecting</span>
                <Clock className="w-4 h-4 text-blue-600 group-hover:scale-110 transition" />
              </div>
              <p className="text-2xl font-serif font-black text-blue-950 mt-2">{underCleaningCount}</p>
              <span className="text-[10px] text-blue-700 block mt-1 font-medium">In progress / inspection</span>
            </div>

            <div 
              onClick={() => { setActiveTab('room_cleaning'); setRoomFilter('Out of Order'); }}
              className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs cursor-pointer hover:border-rose-400 transition group"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Out of Order</span>
                <X className="w-4 h-4 text-rose-600 group-hover:scale-110 transition" />
              </div>
              <p className="text-2xl font-serif font-black text-rose-950 mt-2">{outOfOrderRoomsCount}</p>
              <span className="text-[10px] text-rose-700 block mt-1 font-medium">Under maintenance / blocked</span>
            </div>

            <div 
              onClick={() => setActiveTab('laundry')}
              className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs cursor-pointer hover:border-purple-400 transition group"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Laundry Summary</span>
                <ShoppingBag className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
              </div>
              <p className="text-2xl font-serif font-black text-purple-950 mt-2">{totalLaundryOrders}</p>
              <span className="text-[10px] text-purple-700 block mt-1 font-medium">{pendingDeliveryOrders} orders pending</span>
            </div>
          </div>

          {/* Quick Operational Board & Recent Jobs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-luxury-brown-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-serif font-bold text-lg text-luxury-brown-950 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-luxury-gold-600" /> Live Room Status Overview
                </h3>
                <button onClick={() => setActiveTab('room_cleaning')} className="text-xs font-bold text-luxury-gold-700 hover:underline flex items-center gap-1">
                  View full cleaning matrix <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {rooms.slice(0, 8).map(room => {
                  const hkStatus = getRoomHkStatus(room);
                  return (
                    <div
                      key={room.id}
                      onClick={() => { setActiveTab('room_cleaning'); }}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        hkStatus === 'Dirty' ? 'bg-amber-50/50 border-amber-300 hover:bg-amber-100/50' :
                        hkStatus === 'Inspecting' ? 'bg-blue-50/50 border-blue-300 hover:bg-blue-100/50' :
                        hkStatus === 'Out of Order' ? 'bg-rose-50/50 border-rose-300 hover:bg-rose-100/50' :
                        'bg-emerald-50/50 border-emerald-300 hover:bg-emerald-100/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-serif font-bold text-base text-luxury-brown-950">#{room.number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          hkStatus === 'Dirty' ? 'bg-amber-500 text-white' :
                          hkStatus === 'Inspecting' ? 'bg-blue-600 text-white' :
                          hkStatus === 'Out of Order' ? 'bg-rose-600 text-white' :
                          'bg-emerald-500 text-white'
                        }`}>
                          {hkStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-luxury-brown-600 font-medium truncate mt-1">{room.category || room.type}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Laundry / Lost & Found Preview */}
            <div className="bg-white rounded-2xl p-6 border border-luxury-brown-100 shadow-sm space-y-4">
              <h3 className="font-serif font-bold text-lg text-luxury-brown-950 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-purple-600" /> Active Laundry Pipeline
              </h3>
              <div className="space-y-2.5">
                {laundryOrders.slice(0, 4).map(order => (
                  <div key={order.id} className="p-3 rounded-xl bg-luxury-beige-50/50 border border-luxury-brown-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-luxury-brown-950">
                        {order.orderNumber} ({order.roomNumber ? `Room #${order.roomNumber}` : 'Hotel Linen'})
                      </p>
                      <p className="text-[11px] text-luxury-brown-600 font-medium">{order.items.length} items • ₹{order.totalAmount}</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 bg-purple-100 text-purple-800 font-bold rounded-lg">
                      {order.deliveryStatus}
                    </span>
                  </div>
                ))}
                {laundryOrders.length === 0 && (
                  <p className="text-xs text-luxury-brown-500 italic py-4 text-center">No active laundry orders.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ROOM CLEANING TAB */}
      {/* ========================================================================= */}
      {activeTab === 'room_cleaning' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-luxury-brown-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {([
                { id: 'ALL', label: `All Rooms (${rooms.length})` },
                { id: 'Dirty', label: `Dirty (${dirtyRoomsCount})` },
                { id: 'Clean', label: `Clean (${cleanRoomsCount})` },
                { id: 'Inspecting', label: `Inspecting (${underCleaningCount})` },
                { id: 'Out of Order', label: `Out of Order (${outOfOrderRoomsCount})` },
              ] as const).map(f => (
                <button
                  key={f.id}
                  onClick={() => setRoomFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    roomFilter === f.id ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-xs' : 'bg-luxury-beige-100 text-luxury-brown-700 hover:bg-luxury-beige-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-luxury-brown-400" />
              <input
                type="text"
                placeholder="Search Room Number or Type..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-luxury-beige-50/50 border border-luxury-brown-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-luxury-gold-500"
              />
            </div>
          </div>

          <div className="space-y-6">
            {filteredRooms.length === 0 ? (
              <div className="py-12 text-center text-xs text-luxury-brown-400 bg-luxury-beige-50 rounded-2xl">
                No rooms match the selected floor or status.
              </div>
            ) : (
              hkCategories.map((catName) => {
                const catRooms = filteredRooms
                  .filter((r) => normalizeCategory(r.category || (r as any).type) === catName)
                  .sort((a, b) => {
                    const numA = parseInt(String(a.number).replace(/\D/g, ''), 10) || 0;
                    const numB = parseInt(String(b.number).replace(/\D/g, ''), 10) || 0;
                    return numA - numB;
                  });

                if (catRooms.length === 0) return null;

                return (
                  <div key={catName} className="space-y-3">
                    <div className="flex items-center justify-between bg-gradient-to-r from-[#FAF6EE] to-white border border-[#E8DEC8] px-3.5 py-2 rounded-xl shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#C49A3A] shadow-xs" />
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-[#DFB962] via-[#CEA346] to-[#BE9032] text-[#17120F] font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs border border-[#C49A3A]/40">
                          {catName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-[#3E5068] border border-[#E2D6BE]">
                          {catRooms.length} {catRooms.length === 1 ? 'room' : 'rooms'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {catRooms.map(room => {
              const hkStatus = getRoomHkStatus(room);
              const displayRate = room.rate ?? (room as any).price ?? 0;

              return (
                <div key={room.id} className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm p-4 space-y-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-serif font-black text-xl text-luxury-brown-950">#{room.number}</span>
                        <span className="text-xs text-luxury-brown-500 font-medium block">{room.category || room.type || 'Standard'} • {room.floor || 'Floor 1'}</span>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                        hkStatus === 'Dirty' ? 'bg-amber-500 text-white' :
                        hkStatus === 'Inspecting' ? 'bg-blue-600 text-white' :
                        hkStatus === 'Out of Order' ? 'bg-rose-600 text-white' :
                        'bg-emerald-500 text-white'
                      }`}>
                        {hkStatus}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-luxury-brown-100/60 flex justify-between text-xs text-luxury-brown-700">
                      <span>Occupancy: <strong className="text-luxury-brown-950">{room.status === 'Occupied' ? 'Occupied' : room.status === 'Reserved' ? 'Reserved' : 'Vacant'}</strong></span>
                      <span>Rate: <strong className="text-luxury-gold-700">₹{Number(displayRate).toLocaleString()}</strong></span>
                    </div>
                  </div>

                  {/* Direct 4-State Housekeeping Status Switcher: Clean | Dirty | Inspecting | Out of Order */}
                  <div className="pt-2 border-t border-luxury-brown-100/60 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-luxury-brown-500 font-bold block">
                      Change Room Status:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleChangeRoomHkStatus(room.number, 'Clean')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                          hkStatus === 'Clean'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Clean
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeRoomHkStatus(room.number, 'Dirty')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                          hkStatus === 'Dirty'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <AlertCircle className="w-3 h-3" /> Dirty
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeRoomHkStatus(room.number, 'Inspecting')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                          hkStatus === 'Inspecting'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        <Shield className="w-3 h-3" /> Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeRoomHkStatus(room.number, 'Out of Order')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                          hkStatus === 'Out of Order'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <X className="w-3 h-3" /> Out of Order
                      </button>
                    </div>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenChecklist(room)}
                        className="px-2.5 py-1.5 bg-luxury-brown-950 text-white hover:bg-luxury-brown-800 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-luxury-gold-400" /> Checklist
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRoomForInspection(room)}
                        className="px-2.5 py-1.5 bg-luxury-beige-100 text-luxury-brown-900 hover:bg-luxury-beige-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-blue-600" /> Supervisor Log
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-1.5">
                      <select
                        onChange={(e) => { if (e.target.value) handleAssignStaff(room.number, e.target.value); }}
                        defaultValue=""
                        className="w-2/3 py-1 px-2 text-[10px] bg-luxury-beige-50 border border-luxury-brown-200 rounded-lg text-luxury-brown-800 font-medium focus:outline-none"
                      >
                        <option value="" disabled>Assign Staff...</option>
                        {availableStaffList.map(s => (
                          <option key={s.id} value={s.name}>{s.name} ({s.designation})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleMarkRoomReady(room.number)}
                        title="Mark Room Clean & Ready"
                        className="w-1/3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-[10px] font-bold transition text-center cursor-pointer"
                      >
                        Ready ✓
                      </button>
                    </div>
                  </div>
                </div>
              );
})}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LAUNDRY TAB */}
      {/* ========================================================================= */}
      {activeTab === 'laundry' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-luxury-brown-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLaundrySubTab('orders')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  laundrySubTab === 'orders' ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-xs' : 'bg-luxury-beige-100 text-luxury-brown-700 hover:bg-luxury-beige-200'
                }`}
              >
                Laundry Orders ({laundryOrders.length})
              </button>
              <button
                onClick={() => setLaundrySubTab('master')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  laundrySubTab === 'master' ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-xs' : 'bg-luxury-beige-100 text-luxury-brown-700 hover:bg-luxury-beige-200'
                }`}
              >
                Items & Pricing Master ({laundryItems.length})
              </button>
            </div>

            {laundrySubTab === 'orders' ? (
              <button
                onClick={() => setIsNewLaundryModalOpen(true)}
                className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-4 h-4 text-luxury-gold-400" /> New Laundry Order
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingItem({ id: '', name: '', price: 0, category: 'Guest Garment', unit: 'piece' });
                  setIsEditingItemModal(true);
                }}
                className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-4 h-4 text-luxury-gold-400" /> Add Laundry Item
              </button>
            )}
          </div>

          {/* LAUNDRY ORDERS SUB-VIEW */}
          {laundrySubTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['ALL', 'Guest Laundry', 'Hotel Linen Laundry'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLaundryOrderFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      laundryOrderFilter === f ? 'bg-purple-600 text-white' : 'bg-white text-luxury-brown-700 border border-luxury-brown-200 hover:bg-luxury-beige-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-luxury-beige-50 border-b border-luxury-brown-100 text-[11px] uppercase font-bold text-luxury-brown-800">
                      <th className="p-3">Order #</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Room / Guest</th>
                      <th className="p-3">Items & Calculation</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Delivery Status</th>
                      <th className="p-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100 text-xs text-luxury-brown-800">
                    {laundryOrders
                      .filter(o => laundryOrderFilter === 'ALL' || o.orderType === laundryOrderFilter)
                      .map(order => (
                        <tr key={order.id} className="hover:bg-luxury-beige-50/50">
                          <td className="p-3 font-mono font-bold text-luxury-brown-950">{order.orderNumber}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              order.orderType === 'Guest Laundry' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {order.orderType}
                            </span>
                          </td>
                          <td className="p-3">
                            {order.orderType === 'Guest Laundry' ? (
                              <div>
                                <p className="font-bold text-luxury-brown-950">Room #{order.roomNumber}</p>
                                <p className="text-[11px] text-luxury-brown-600">{order.guestName}</p>
                              </div>
                            ) : (
                              <span className="text-luxury-brown-600 font-medium">Hotel Linen Pool</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="space-y-0.5 max-h-20 overflow-y-auto">
                              {order.items.map((item, idx) => (
                                <p key={idx} className="text-[11px] text-luxury-brown-700">
                                  {item.name} ₹{item.unitPrice} × {item.quantity} = <strong className="text-luxury-brown-950">₹{item.total}</strong>
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 font-serif font-black text-sm text-luxury-brown-950">₹{order.totalAmount}</td>
                          <td className="p-3">
                            <select
                              value={order.deliveryStatus}
                              onChange={(e) => handleUpdateDeliveryStatus(order.id, e.target.value)}
                              className={`py-1 px-2 rounded-lg text-[11px] font-bold border focus:outline-none ${
                                order.deliveryStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Wash">In Wash</option>
                              <option value="Ironing">Ironing</option>
                              <option value="Ready for Delivery">Ready for Delivery</option>
                              <option value="Delivered">Delivered</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={order.paymentStatus}
                              onChange={(e) => handleUpdatePaymentStatus(order.id, e.target.value)}
                              className={`py-1 px-2 rounded-lg text-[11px] font-bold border focus:outline-none ${
                                order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                order.paymentStatus === 'Billed to Room' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                order.paymentStatus === 'Complimentary' ? 'bg-teal-100 text-teal-800 border-teal-300' :
                                'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Billed to Room">Billed to Room</option>
                              <option value="Paid">Paid</option>
                              <option value="Complimentary">Complimentary (₹0)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LAUNDRY ITEMS MASTER SUB-VIEW */}
          {laundrySubTab === 'master' && (
            <div className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-luxury-beige-50 border-b border-luxury-brown-100 text-[11px] uppercase font-bold text-luxury-brown-800">
                    <th className="p-3">Garment / Linen Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Standard Price (₹)</th>
                    <th className="p-3">Billing Unit</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs text-luxury-brown-800 font-medium">
                  {laundryItems.map(item => (
                    <tr key={item.id} className="hover:bg-luxury-beige-50/50">
                      <td className="p-3 font-bold text-luxury-brown-950">{item.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-luxury-beige-100 text-luxury-brown-800 font-bold text-[10px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 font-serif font-bold text-sm text-luxury-gold-700">₹{item.price}</td>
                      <td className="p-3 text-luxury-brown-600">Per {item.unit}</td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => { setEditingItem(item); setIsEditingItemModal(true); }}
                          className="p-1.5 text-luxury-brown-700 hover:text-luxury-brown-950 hover:bg-luxury-beige-100 rounded transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            onUpdateLaundryItems(laundryItems.filter(i => i.id !== item.id));
                            showToast(`Removed "${item.name}" from laundry pricing master.`, 'info');
                          }}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. LOST & FOUND TAB */}
      {/* ========================================================================= */}
      {activeTab === 'lost_found' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-luxury-brown-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLostFoundTab('active')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  lostFoundTab === 'active' ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-xs' : 'bg-luxury-beige-100 text-luxury-brown-700 hover:bg-luxury-beige-200'
                }`}
              >
                Active Registered Items ({lostAndFoundItems.filter(i => i.status === 'Registered').length})
              </button>
              <button
                onClick={() => setLostFoundTab('claimed')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  lostFoundTab === 'claimed' ? 'bg-luxury-gold-500 text-luxury-brown-950 shadow-xs' : 'bg-luxury-beige-100 text-luxury-brown-700 hover:bg-luxury-beige-200'
                }`}
              >
                Return History / Claimed ({lostAndFoundItems.filter(i => i.status !== 'Registered').length})
              </button>
            </div>

            <button
              onClick={() => setIsNewLostItemModalOpen(true)}
              className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4 text-luxury-gold-400" /> Register Found Item
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lostAndFoundItems
              .filter(item => lostFoundTab === 'active' ? item.status === 'Registered' : item.status !== 'Registered')
              .map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-luxury-brown-100 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div>
                    {item.imagePath && (
                      <div className="h-40 w-full bg-luxury-beige-100 relative overflow-hidden">
                        <img src={item.imagePath} alt={item.itemName} className="w-full h-full object-cover" />
                        <span className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-bold">
                          {item.category}
                        </span>
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-serif font-bold text-lg text-luxury-brown-950">{item.itemName}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'Registered' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-luxury-brown-600">
                        Found in: <strong className="text-luxury-brown-950">{item.locationFound}</strong> {item.roomNumber && `(Room #${item.roomNumber})`}
                      </p>
                      <p className="text-xs text-luxury-brown-600">
                        Found by: <strong className="text-luxury-brown-950">{item.foundByStaff}</strong> on <strong className="font-mono">{item.dateFound}</strong>
                      </p>
                      {item.description && (
                        <p className="text-xs text-luxury-brown-500 bg-luxury-beige-50 p-2 rounded-lg italic">
                          "{item.description}"
                        </p>
                      )}

                      {item.status === 'Claimed' && (
                        <div className="mt-3 pt-3 border-t border-luxury-brown-100 text-xs space-y-1 bg-emerald-50/50 p-2.5 rounded-xl">
                          <p className="text-emerald-900 font-bold">✓ Claimed by: {item.claimedByGuest}</p>
                          <p className="text-emerald-800 text-[11px]">Mobile: {item.claimGuestMobile} • Date: {item.claimDate}</p>
                          {item.returnNotes && <p className="text-emerald-700 text-[11px] italic">Notes: {item.returnNotes}</p>}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.status === 'Registered' && (
                    <div className="p-4 pt-0">
                      <button
                        onClick={() => setSelectedItemForClaim(item)}
                        className="w-full py-2 bg-luxury-gold-500 hover:bg-luxury-gold-600 text-luxury-brown-950 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <UserCheck className="w-4 h-4" /> Guest Claim & Return Sign-off
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. REPORTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-2">
              <span className="text-xs font-bold text-luxury-brown-600 uppercase tracking-wider">Total Rooms Cleaned</span>
              <p className="text-3xl font-serif font-black text-luxury-brown-950">{cleaningLogs.filter(l => l.status === 'Inspected' || l.status === 'Cleaned').length}</p>
              <span className="text-xs text-emerald-700 font-bold flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> 98% Inspection Pass Rate</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-2">
              <span className="text-xs font-bold text-luxury-brown-600 uppercase tracking-wider">Total Laundry Revenue</span>
              <p className="text-3xl font-serif font-black text-purple-950">₹{totalLaundryRevenue}</p>
              <span className="text-xs text-purple-700 font-bold">{totalLaundryOrders} processed batches</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-2">
              <span className="text-xs font-bold text-luxury-brown-600 uppercase tracking-wider">Lost Items Recovery</span>
              <p className="text-3xl font-serif font-black text-emerald-900">
                {lostAndFoundItems.length > 0 ? Math.round((lostAndFoundItems.filter(i => i.status === 'Claimed').length / lostAndFoundItems.length) * 100) : 100}%
              </p>
              <span className="text-xs text-luxury-brown-600 font-medium">{lostAndFoundItems.filter(i => i.status === 'Claimed').length} of {lostAndFoundItems.length} returned safely</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-luxury-brown-100 shadow-sm space-y-2">
              <span className="text-xs font-bold text-luxury-brown-600 uppercase tracking-wider">Active HK Workforce</span>
              <p className="text-3xl font-serif font-black text-luxury-brown-950">{totalHkStaff}</p>
              <span className="text-xs text-luxury-brown-600 font-medium">Average turnaround: 22 mins/room</span>
            </div>
          </div>

          {/* Staff Performance Matrix Table */}
          <div className="bg-white rounded-2xl p-6 border border-luxury-brown-100 shadow-sm space-y-4">
            <h3 className="font-serif font-bold text-lg text-luxury-brown-950 flex items-center gap-2">
              <Users className="w-5 h-5 text-luxury-gold-600" /> Housekeeping Staff Performance Report
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-luxury-beige-50 border-b border-luxury-brown-100 text-[11px] uppercase font-bold text-luxury-brown-800">
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Designation</th>
                    <th className="p-3">Rooms Assigned</th>
                    <th className="p-3">Rooms Cleaned / Inspected</th>
                    <th className="p-3">Avg Duration</th>
                    <th className="p-3">Inspection Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-luxury-brown-100 text-xs text-luxury-brown-800 font-medium">
                  {availableStaffList.map((st, idx) => {
                    const assignedCount = cleaningLogs.filter(l => l.assignedStaff.includes(st.name)).length;
                    const passCount = cleaningLogs.filter(l => l.assignedStaff.includes(st.name) && l.inspectionResult === 'Pass').length;
                    return (
                      <tr key={st.id || idx} className="hover:bg-luxury-beige-50/50">
                        <td className="p-3 font-bold text-luxury-brown-950">{st.name}</td>
                        <td className="p-3">{st.designation}</td>
                        <td className="p-3">{assignedCount || 5} rooms</td>
                        <td className="p-3 font-bold text-emerald-800">{assignedCount || 5} cleaned</td>
                        <td className="p-3">22 mins</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {passCount > 0 ? Math.round((passCount / assignedCount) * 100) : 100}% Pass
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SETTINGS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl p-6 border border-luxury-brown-100 shadow-sm space-y-6 max-w-3xl">
          <h3 className="font-serif font-bold text-lg text-luxury-brown-950 flex items-center gap-2 border-b border-luxury-brown-100 pb-3">
            <Settings className="w-5 h-5 text-luxury-gold-600" /> Housekeeping Workflow & Automation Parameters
          </h3>

          <div className="space-y-4 text-xs font-medium text-luxury-brown-800">
            <label className="flex items-start gap-3 p-3.5 bg-luxury-beige-50/50 rounded-xl border border-luxury-brown-100 cursor-pointer hover:bg-luxury-beige-100/50 transition">
              <input
                type="checkbox"
                checked={autoMarkDirtyOnCheckout}
                onChange={e => setAutoMarkDirtyOnCheckout(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-luxury-brown-950"
              />
              <div>
                <p className="font-bold text-luxury-brown-950">Auto-mark Room Dirty upon Guest Check-out</p>
                <p className="text-luxury-brown-600 text-[11px] mt-0.5">
                  When front-desk processes guest check-out, automatically switch room status to Dirty and add to Housekeeping queue.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-luxury-beige-50/50 rounded-xl border border-luxury-brown-100 cursor-pointer hover:bg-luxury-beige-100/50 transition">
              <input
                type="checkbox"
                checked={requireInspectionToClean}
                onChange={e => setRequireInspectionToClean(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-luxury-brown-950"
              />
              <div>
                <p className="font-bold text-luxury-brown-950">Require Supervisor Inspection Sign-off</p>
                <p className="text-luxury-brown-600 text-[11px] mt-0.5">
                  Staff checklist completion sets room to "Inspecting". Requires Housekeeping Supervisor pass sign-off to make room Available.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 bg-luxury-beige-50/50 rounded-xl border border-luxury-brown-100 cursor-pointer hover:bg-luxury-beige-100/50 transition">
              <input
                type="checkbox"
                checked={notifyGuestOnLaundryReady}
                onChange={e => setNotifyGuestOnLaundryReady(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-luxury-brown-950"
              />
              <div>
                <p className="font-bold text-luxury-brown-950">Send SMS/WhatsApp notification on Laundry Ready</p>
                <p className="text-luxury-brown-600 text-[11px] mt-0.5">
                  Automatically notify guest when their garment laundry batch is marked "Ready for Delivery".
                </p>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-luxury-brown-100 flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="px-6 py-2.5 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-white font-bold text-xs rounded-xl transition shadow-sm"
            >
              Save Workflow Settings
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. Cleaning Checklist Modal */}
      {selectedRoomForChecklist && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-luxury-brown-200 space-y-5">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
              <h3 className="font-serif font-bold text-xl text-luxury-brown-950 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-luxury-gold-600" /> Room #{selectedRoomForChecklist.number} Cleaning Checklist
              </h3>
              <button onClick={() => setSelectedRoomForChecklist(null)} className="text-luxury-brown-400 hover:text-luxury-brown-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-luxury-brown-800">Assign / Executing Staff:</label>
              <select
                value={assignedStaffInput}
                onChange={e => setAssignedStaffInput(e.target.value)}
                className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs font-medium focus:outline-none"
              >
                {availableStaffList.map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.designation})</option>
                ))}
              </select>

              <p className="text-xs font-bold text-luxury-brown-800 pt-2">Standard Operational Steps:</p>
              <div className="space-y-2 bg-luxury-beige-50/50 p-3 rounded-xl border border-luxury-brown-100">
                {Object.keys(checklistItems).map(item => (
                  <label key={item} className="flex items-center gap-3 p-1.5 cursor-pointer text-xs font-medium text-luxury-brown-900">
                    <input
                      type="checkbox"
                      checked={checklistItems[item]}
                      onChange={e => setChecklistItems({ ...checklistItems, [item]: e.target.checked })}
                      className="w-4 h-4 rounded accent-luxury-brown-950"
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>

              {inventoryProducts.length > 0 && (
                <div className="bg-luxury-beige-50/70 border border-luxury-brown-100 rounded-xl p-3 space-y-2 text-xs">
                  <span className="font-bold text-luxury-brown-900 block">Optional Inventory Supply Consumption:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <select
                        value={checklistSupplyProductId}
                        onChange={e => setChecklistSupplyProductId(e.target.value)}
                        className="w-full p-2 bg-white border border-luxury-brown-200 rounded-lg text-xs"
                      >
                        <option value="">-- No Supply Deducted --</option>
                        {inventoryProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.currentStock} {p.unit} in stock)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        disabled={!checklistSupplyProductId}
                        value={checklistSupplyQty}
                        onChange={e => setChecklistSupplyQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full p-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-center font-mono disabled:opacity-50"
                        placeholder="Qty"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-luxury-brown-800 mb-1">Housekeeping Remarks / Observations:</label>
                <textarea
                  value={checklistNotes}
                  onChange={e => setChecklistNotes(e.target.value)}
                  placeholder="e.g. Broken towel rack reported, carpets vacuumed..."
                  className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs font-medium focus:outline-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-luxury-brown-100">
              <button onClick={() => setSelectedRoomForChecklist(null)} className="px-4 py-2 bg-luxury-beige-100 text-luxury-brown-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveChecklist} className="px-6 py-2 bg-luxury-brown-950 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-luxury-brown-800">
                Complete Cleaning Checklist ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. New Laundry Order Modal */}
      {isNewLaundryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-luxury-brown-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
              <h3 className="font-serif font-bold text-xl text-luxury-brown-950 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-purple-600" /> New Laundry Service Order
              </h3>
              <button onClick={() => setIsNewLaundryModalOpen(false)} className="text-luxury-brown-400 hover:text-luxury-brown-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-medium text-luxury-brown-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Order Type</label>
                  <select
                    value={newLaundryOrder.orderType}
                    onChange={e => setNewLaundryOrder({ ...newLaundryOrder, orderType: e.target.value as any })}
                    className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl focus:outline-none font-bold text-luxury-brown-950"
                  >
                    <option value="Guest Laundry">Guest Laundry</option>
                    <option value="Hotel Linen Laundry">Hotel Linen Laundry</option>
                  </select>
                </div>
                {newLaundryOrder.orderType === 'Guest Laundry' && (
                  <div>
                    <label className="block font-bold text-luxury-brown-950 mb-1">Select Occupied Room #</label>
                    <select
                      value={newLaundryOrder.roomNumber}
                      onChange={e => {
                        const roomNum = e.target.value;
                        const activeStay = getActiveStayForRoom(roomNum);
                        const activeBooking = bookings.find(b => b.roomNumber === roomNum && (b.status === 'Checked-In' || b.status === 'Confirmed'));
                        setNewLaundryOrder({
                          ...newLaundryOrder,
                          roomNumber: roomNum,
                          guestName: activeStay?.guestName || activeBooking?.guestName || `Guest Room #${roomNum}`
                        });
                      }}
                      className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl focus:outline-none"
                    >
                      <option value="">Select Room...</option>
                      {rooms.map(r => {
                        const stay = getActiveStayForRoom(r.number);
                        return (
                          <option key={r.id} value={r.number}>
                            Room #{r.number} — {stay ? `${stay.guestName} (Active Stay)` : r.status}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Items Selection & Auto Price Calculation */}
              <div className="space-y-3">
                <label className="block font-bold text-luxury-brown-950">Add Garments / Linen Items (Auto Price × Qty Calculation):</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-luxury-beige-50/50 rounded-xl border border-luxury-brown-100 max-h-32 overflow-y-auto">
                  {laundryItems
                    .filter(i => newLaundryOrder.orderType === 'Guest Laundry' ? i.category !== 'Hotel Linen' : i.category === 'Hotel Linen')
                    .map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddLaundryOrderItem(item.id)}
                        className="px-2.5 py-1.5 bg-white hover:bg-luxury-gold-100 border border-luxury-brown-200 rounded-lg text-xs font-bold text-luxury-brown-900 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-luxury-gold-600" /> {item.name} (₹{item.price})
                      </button>
                    ))}
                </div>

                {/* Admin Custom Cloth Type & Rate Input */}
                <div className="p-3 bg-luxury-beige-50/80 border border-luxury-brown-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-luxury-brown-950">
                      Or Enter Custom Cloth Type & Rate Manually:
                    </span>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-luxury-brown-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveCustomClothToMaster}
                        onChange={e => setSaveCustomClothToMaster(e.target.checked)}
                        className="rounded accent-luxury-brown-950"
                      />
                      Save to Rate Card for future
                    </label>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <label className="block text-[10px] font-bold text-luxury-brown-700 uppercase mb-0.5">Type of Cloth *</label>
                      <input
                        type="text"
                        placeholder="e.g. Saree, Suit, Jeans, Kurta..."
                        value={customClothName}
                        onChange={e => setCustomClothName(e.target.value)}
                        className="w-full p-2 bg-white border border-luxury-brown-200 rounded-lg text-xs font-bold text-luxury-brown-950 focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] font-bold text-luxury-brown-700 uppercase mb-0.5">Rate (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="₹ Rate"
                        value={customClothRate}
                        onChange={e => setCustomClothRate(e.target.value)}
                        className="w-full p-2 bg-white border border-luxury-brown-200 rounded-lg text-xs font-bold text-luxury-brown-950 focus:outline-none focus:border-luxury-gold-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-luxury-brown-700 uppercase mb-0.5">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={customClothQty}
                        onChange={e => setCustomClothQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full p-2 bg-white border border-luxury-brown-200 rounded-lg text-xs font-bold text-center text-luxury-brown-950 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={handleAddCustomClothToOrder}
                        className="w-full py-2 px-2 bg-luxury-brown-950 hover:bg-luxury-brown-800 text-luxury-gold-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Items Table */}
              {newLaundryOrder.items.length > 0 && (
                <div className="border border-luxury-brown-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-luxury-beige-100 text-[10px] uppercase font-bold text-luxury-brown-800">
                        <th className="p-2">Item (Cloth Type)</th>
                        <th className="p-2">Rate (₹)</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">Total</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-luxury-brown-100">
                      {newLaundryOrder.items.map((lineItem) => {
                        const master = laundryItems.find(i => i.id === lineItem.itemId);
                        const itemName = lineItem.name !== undefined ? lineItem.name : (master?.name || '');
                        const rate = lineItem.unitPrice !== undefined ? lineItem.unitPrice : (master?.price || 0);
                        const lineTotal = rate * lineItem.quantity;
                        return (
                          <tr key={lineItem.itemId} className="bg-white">
                            <td className="p-2">
                              <input
                                type="text"
                                value={itemName}
                                onChange={e => handleUpdateOrderItemName(lineItem.itemId, e.target.value)}
                                className="w-full p-1 border border-luxury-brown-200 rounded font-bold text-luxury-brown-950 text-xs focus:outline-none focus:border-luxury-gold-500"
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <span className="text-luxury-brown-600 font-bold">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={rate}
                                  onChange={e => handleUpdateOrderItemRate(lineItem.itemId, parseFloat(e.target.value) || 0)}
                                  className="w-20 p-1 border border-luxury-brown-200 rounded font-bold text-luxury-brown-950 text-xs focus:outline-none focus:border-luxury-gold-500"
                                />
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={lineItem.quantity}
                                onChange={e => handleUpdateOrderItemQty(lineItem.itemId, parseInt(e.target.value) || 0)}
                                className="w-16 p-1 border border-luxury-brown-200 rounded text-center font-bold"
                              />
                            </td>
                            <td className="p-2 font-bold text-luxury-gold-800">₹{lineTotal}</td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderItemQty(lineItem.itemId, 0)}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="bg-luxury-brown-950 text-white p-3 flex justify-between items-center font-serif font-bold">
                    <span>Total Laundry Bill Amount:</span>
                    <span className="text-lg text-luxury-gold-400">₹{calculateNewOrderTotal()}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Payment Status</label>
                  <select
                    value={newLaundryOrder.paymentStatus}
                    onChange={e => setNewLaundryOrder({ ...newLaundryOrder, paymentStatus: e.target.value as any })}
                    className="w-full p-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  >
                    <option value="Billed to Room">Billed to Room</option>
                    <option value="Paid">Paid Immediately</option>
                    <option value="Pending">Pending</option>
                    <option value="Complimentary">Complimentary (₹0)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Initial Delivery Status</label>
                  <select
                    value={newLaundryOrder.deliveryStatus}
                    onChange={e => setNewLaundryOrder({ ...newLaundryOrder, deliveryStatus: e.target.value as any })}
                    className="w-full p-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  >
                    <option value="In Wash">In Wash</option>
                    <option value="Ironing">Ironing</option>
                    <option value="Ready for Delivery">Ready for Delivery</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>

              {inventoryProducts.length > 0 && (
                <div className="bg-luxury-beige-50/70 border border-luxury-brown-100 rounded-xl p-3 space-y-2 text-xs">
                  <span className="font-bold text-luxury-brown-900 block">Optional Inventory Supply Consumption (Detergent / Packaging):</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <select
                        value={laundrySupplyProductId}
                        onChange={e => setLaundrySupplyProductId(e.target.value)}
                        className="w-full p-2 bg-white border border-luxury-brown-200 rounded-lg text-xs"
                      >
                        <option value="">-- No Supply Deducted --</option>
                        {inventoryProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.currentStock} {p.unit} in stock)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        disabled={!laundrySupplyProductId}
                        value={laundrySupplyQty}
                        onChange={e => setLaundrySupplyQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full p-2 bg-white border border-luxury-brown-200 rounded-lg text-xs text-center font-mono disabled:opacity-50"
                        placeholder="Qty"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-luxury-brown-100">
              <button onClick={() => setIsNewLaundryModalOpen(false)} className="px-4 py-2 bg-luxury-beige-100 text-luxury-brown-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleCreateLaundryOrder} className="px-6 py-2 bg-purple-900 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-purple-800">
                Create Order & Bill ₹{calculateNewOrderTotal()} ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Register Found Item Modal */}
      {isNewLostItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-luxury-brown-200 space-y-5">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
              <h3 className="font-serif font-bold text-xl text-luxury-brown-950 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-luxury-gold-600" /> Register Lost & Found Property
              </h3>
              <button onClick={() => setIsNewLostItemModalOpen(false)} className="text-luxury-brown-400 hover:text-luxury-brown-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-medium text-luxury-brown-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Item Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Gold Watch, Wallet"
                    value={newLostItem.itemName}
                    onChange={e => setNewLostItem({ ...newLostItem, itemName: e.target.value })}
                    className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Category</label>
                  <select
                    value={newLostItem.category}
                    onChange={e => setNewLostItem({ ...newLostItem, category: e.target.value as any })}
                    className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Documents/Wallet">Documents/Wallet</option>
                    <option value="Jewelry">Jewelry</option>
                    <option value="Toiletries">Toiletries</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Location / Room Found</label>
                  <input
                    type="text"
                    placeholder="e.g. Room #302 / Pool poolside"
                    value={newLostItem.locationFound}
                    onChange={e => setNewLostItem({ ...newLostItem, locationFound: e.target.value })}
                    className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Found by Staff</label>
                  <select
                    value={newLostItem.foundByStaff}
                    onChange={e => setNewLostItem({ ...newLostItem, foundByStaff: e.target.value })}
                    className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  >
                    {availableStaffList.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-luxury-brown-950 mb-1">Item Description & Characteristics</label>
                <textarea
                  value={newLostItem.description}
                  onChange={e => setNewLostItem({ ...newLostItem, description: e.target.value })}
                  placeholder="e.g. Black leather wallet containing ID card..."
                  className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  rows={2}
                />
              </div>

              <div>
                <label className="block font-bold text-luxury-brown-950 mb-1">Image Attachment URL / Reference</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLostItem.imagePath}
                    onChange={e => setNewLostItem({ ...newLostItem, imagePath: e.target.value })}
                    className="w-full p-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl font-mono text-[10px]"
                  />
                  <button type="button" className="px-3 bg-luxury-beige-100 hover:bg-luxury-beige-200 rounded-xl text-luxury-brown-900 font-bold flex items-center gap-1">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-luxury-brown-100">
              <button onClick={() => setIsNewLostItemModalOpen(false)} className="px-4 py-2 bg-luxury-beige-100 text-luxury-brown-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleRegisterLostItem} className="px-6 py-2 bg-luxury-brown-950 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-luxury-brown-800">
                Register Found Property ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Guest Claim Sign-off Modal */}
      {selectedItemForClaim && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-luxury-brown-200 space-y-4">
            <h3 className="font-serif font-bold text-xl text-luxury-brown-950 flex items-center gap-2 border-b border-luxury-brown-100 pb-3">
              <UserCheck className="w-6 h-6 text-emerald-600" /> Guest Return Sign-off
            </h3>

            <div className="space-y-3 text-xs font-medium text-luxury-brown-800">
              <div className="p-3 bg-luxury-beige-50 rounded-xl border border-luxury-brown-100">
                <p className="font-bold text-luxury-brown-950">{selectedItemForClaim.itemName}</p>
                <p className="text-[11px] text-luxury-brown-600">Found at: {selectedItemForClaim.locationFound}</p>
              </div>

              <div>
                <label className="block font-bold text-luxury-brown-950 mb-1">Claiming Guest Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Patel"
                  value={claimGuestName}
                  onChange={e => setClaimGuestName(e.target.value)}
                  className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-luxury-brown-950 mb-1">Guest Mobile Phone *</label>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  value={claimGuestMobile}
                  onChange={e => setClaimGuestMobile(e.target.value)}
                  className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-luxury-brown-950 mb-1">ID Proof & Return Verification Notes</label>
                <textarea
                  value={claimNotes}
                  onChange={e => setClaimNotes(e.target.value)}
                  placeholder="e.g. Verified Aadhaar card matching name. Signature taken."
                  className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-luxury-brown-100">
              <button onClick={() => setSelectedItemForClaim(null)} className="px-4 py-2 bg-luxury-beige-100 text-luxury-brown-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleSubmitClaim} className="px-6 py-2 bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-800">
                Confirm Return Sign-off ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add/Edit Laundry Item Master Modal */}
      {isEditingItemModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-luxury-brown-200 space-y-4">
            <h3 className="font-serif font-bold text-lg text-luxury-brown-950 border-b border-luxury-brown-100 pb-2">
              {editingItem.id ? 'Edit Laundry Item' : 'Add New Laundry Item'}
            </h3>

            <div className="space-y-3 text-xs font-medium text-luxury-brown-800">
              <div>
                <label className="block font-bold text-luxury-brown-950 mb-1">Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bedsheet, Bath Towel"
                  value={editingItem.name}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={editingItem.price}
                    onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-luxury-brown-950 mb-1">Unit</label>
                  <input
                    type="text"
                    value={editingItem.unit}
                    onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                    placeholder="piece / kg"
                    className="w-full p-2 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-luxury-brown-950 mb-1">Category</label>
                <select
                  value={editingItem.category}
                  onChange={e => setEditingItem({ ...editingItem, category: e.target.value as any })}
                  className="w-full p-2.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl"
                >
                  <option value="Guest Garment">Guest Garment</option>
                  <option value="Hotel Linen">Hotel Linen</option>
                  <option value="Uniform">Uniform</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-luxury-brown-100">
              <button onClick={() => setIsEditingItemModal(false)} className="px-4 py-2 bg-luxury-beige-100 text-luxury-brown-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button onClick={handleSaveMasterItem} className="px-6 py-2 bg-luxury-brown-950 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-luxury-brown-800">
                Save Item ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
