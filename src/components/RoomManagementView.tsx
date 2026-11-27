import React, { useState, useMemo, useEffect } from 'react';
import { Room, RoomStatus, UserRole, Booking, HotelSettings, AuditLog, CleaningStatus } from '../types';
import CalendarBookingView from './CalendarBookingView';
import { showToast } from '../utils/toast';
import {
  useRbacMatrix,
  getRoleModulePermission,
} from '../pms-integrated/utils/rbacPermissions';
import { 
  Plus, Edit2, Trash2, Search, Hotel, Tag, RefreshCw, Check, AlertCircle, X, 
  LayoutDashboard, Bed, Calendar, Sparkles, DollarSign, Shield, FileSpreadsheet, 
  Settings as SettingsIcon, CheckCircle2, Lock, Unlock, Image as ImageIcon,
  Layers, Clock, PieChart, BarChart3, Filter, ShieldAlert, Wrench, Eye,
  QrCode, Printer, Building, Building2, Utensils
} from 'lucide-react';
import BuildingFloorView from './rooms/BuildingFloorView';
import TimePicker12h from './TimePicker12h';

interface RoomManagementViewProps {
  rooms: Room[];
  currentRole: UserRole;
  onUpdateRooms: (rooms: Room[]) => void;
  maxRoomsLimit?: number;
  packageName?: string;
  bookings?: Booking[];
  onUpdateBookings?: (bookings: Booking[]) => void;
  hotelSettings?: HotelSettings;
  onUpdateHotelSettings?: (settings: HotelSettings) => void;
  auditLogs?: AuditLog[];
  onAddAuditLog?: (action: string, details: string) => void;
  initialSubTab?: string;
  activeSubTab?: string;
  onSubTabChange?: (sub: string) => void;
}

const PREFERRED_CATEGORY_ORDER = ['Deluxe', 'Executive', 'Family Room', 'Family', 'Standard', 'Premium Standard'];

const normalizeCategory = (cat?: string): string => {
  if (!cat) return 'Standard';
  const trimmed = cat.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'delux' || lower === 'deluxe' || lower === 'super dilux' || lower === 'super deluxe') return 'Deluxe';
  if (lower === 'premium standard' || lower === 'premium standard room') return 'Premium Standard';
  if (lower === 'executive' || lower === 'executive room' || lower === 'executive suite') return 'Executive';
  if (lower === 'standard' || lower === 'standard room') return 'Standard';
  if (lower === 'family' || lower === 'family room' || lower === 'family suite' || lower === 'familyroom') return 'Family Room';
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

interface CategoryConfig {
  name: string;
  rate: number;
  baseOcc: number;
  maxOcc: number;
  extra: number;
  bedType?: string;
  defaultAmenities?: string[];
}

interface AmenityItem {
  id: string;
  name: string;
  iconName: string;
  category: string;
  description: string;
}

export default function RoomManagementView({ 
  rooms = [], 
  currentRole, 
  onUpdateRooms,
  maxRoomsLimit = 9999,
  packageName = 'Starter',
  bookings = [],
  onUpdateBookings,
  hotelSettings,
  onUpdateHotelSettings,
  auditLogs = [],
  onAddAuditLog,
  initialSubTab = 'dashboard',
  activeSubTab: propActiveSubTab,
  onSubTabChange,
}: RoomManagementViewProps) {
  // Main Module Sub-Tab Navigation State
  const [localSubTab, setLocalSubTab] = useState<string>(initialSubTab);
  const activeSubTab = propActiveSubTab ?? localSubTab;
  const setActiveSubTab = (tab: string) => {
    setLocalSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };
  const [qrModalRoom, setQrModalRoom] = useState<Room | null>(null);
  const [viewRoomDetails, setViewRoomDetails] = useState<Room | null>(null);

  // Common Search & Filters State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [floorFilter, setFloorFilter] = useState<string>('All');
  const [blockedViewFilter, setBlockedViewFilter] = useState<'all_blocked_occupied' | 'Blocked' | 'Occupied'>('all_blocked_occupied');
  const [inlineNewFloor, setInlineNewFloor] = useState('');
  
  // Room Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [roomLimitAlert, setRoomLimitAlert] = useState<string | null>(null);

  // Room Form Fields
  const [roomId, setRoomId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [category, setCategory] = useState<string>('');
  const [rate, setRate] = useState<number>(0);
  const [status, setStatus] = useState<RoomStatus>('Available');
  const [cleaningStatus, setCleaningStatus] = useState<CleaningStatus>('Clean');
  const [baseOccupancy, setBaseOccupancy] = useState<number>(2);
  const [maxOccupancy, setMaxOccupancy] = useState<number>(3);
  const [extraPersonCharge, setExtraPersonCharge] = useState<number>(500);
  const [floor, setFloor] = useState<string>('1st Floor');
  const [bedType, setBedType] = useState<string>('King Size Bed');
  const [allowExtraBed, setAllowExtraBed] = useState<boolean>(true);
  const [selectedRoomAmenities, setSelectedRoomAmenities] = useState<string[]>([]);
  const [roomImages, setRoomImages] = useState<string>('');
  const [outOfOrderReason, setOutOfOrderReason] = useState('');
  const [formError, setFormError] = useState('');

  // Room Add Mode: 'single' | 'range' | 'bulk' (Multi-Floor)
  type RoomCreationMode = 'single' | 'range' | 'bulk';
  interface BulkDraftRoomRow {
    draftId: string;
    number: string;
    floor: string;
    category: string;
    rate: number;
  }
  const [addCreationMode, setAddCreationMode] = useState<RoomCreationMode>('single');
  const [rangeStartNum, setRangeStartNum] = useState<string>('101');
  const [rangeEndNum, setRangeEndNum] = useState<string>('105');
  const [bulkStartRoomNum, setBulkStartRoomNum] = useState<string>('101');
  const [bulkNumFloors, setBulkNumFloors] = useState<string>('3');
  const [bulkRoomsPerFloor, setBulkRoomsPerFloor] = useState<string>('5');
  const [bulkStartFloorNum, setBulkStartFloorNum] = useState<string>('1');
  const [bulkNumberingPattern, setBulkNumberingPattern] = useState<'floor_series' | 'sequential'>('floor_series');
  const [bulkDraftRows, setBulkDraftRows] = useState<BulkDraftRoomRow[]>([]);

  const formatFloorLabel = (floorIdx: number): string => {
    if (floorIdx <= 0) return 'Ground Floor';
    const mod100 = floorIdx % 100;
    const mod10 = floorIdx % 10;
    const suffix =
      mod100 >= 11 && mod100 <= 13
        ? 'th'
        : mod10 === 1
        ? 'st'
        : mod10 === 2
        ? 'nd'
        : mod10 === 3
        ? 'rd'
        : 'th';
    return `${floorIdx}${suffix} Floor`;
  };

  const knownFloorOptions = useMemo(() => {
    const savedCustom = Array.isArray(hotelSettings?.customFloors) && hotelSettings.customFloors.length > 0
      ? hotelSettings.customFloors.map((f) => String(f || '').trim()).filter(Boolean)
      : [
          'Ground Floor',
          '1st Floor',
          '2nd Floor',
          '3rd Floor',
          '4th Floor',
          '5th Floor',
        ];
    const fromRooms = rooms.map(r => String(r.floor || '').trim()).filter(Boolean);
    return Array.from(new Set([...savedCustom, ...fromRooms]));
  }, [rooms, hotelSettings?.customFloors]);

  const handlePersistCustomFloors = (nextFloors: string[]) => {
    const cleaned = Array.from(new Set(nextFloors.map((f) => String(f || '').trim()).filter(Boolean)));
    if (cleaned.length === 0) return;
    if (onUpdateHotelSettings && hotelSettings) {
      onUpdateHotelSettings({
        ...hotelSettings,
        customFloors: cleaned,
      });
    }
    if (onAddAuditLog) {
      onAddAuditLog('Custom Floors Updated', `Configured hotel floors: ${cleaned.join(', ')}`);
    }
  };

  const handleQuickAddCustomFloor = (rawLabel: string) => {
    const clean = String(rawLabel || '').trim();
    if (!clean) {
      showToast('Enter a floor name (e.g., Basement, Mezzanine, 6th Floor, Terrace).', 'warning');
      return;
    }
    if (knownFloorOptions.some((f) => f.toLowerCase() === clean.toLowerCase())) {
      setFloor(clean);
      setInlineNewFloor('');
      return;
    }
    handlePersistCustomFloors([...knownFloorOptions, clean]);
    setFloor(clean);
    setInlineNewFloor('');
    showToast(`Added "${clean}" to custom floors.`, 'success');
  };

  const generateRangeDraftRows = (
    startStr = rangeStartNum,
    endStr = rangeEndNum,
    floorLabel = floor,
    catLabel = category,
    rateVal = rate
  ) => {
    const s = parseInt(startStr.replace(/\D/g, ''), 10);
    const e = parseInt(endStr.replace(/\D/g, ''), 10);
    if (Number.isNaN(s) || Number.isNaN(e) || s <= 0 || e < s) {
      setFormError('Please enter a valid numeric range (From Room No. must be ≤ To Room No.).');
      return;
    }
    const count = e - s + 1;
    if (count > 200) {
      setFormError('Maximum 200 rooms can be generated in one batch.');
      return;
    }
    setFormError('');
    const resolvedFloor = floorLabel.trim() || '1st Floor';
    const resolvedCat = catLabel.trim() || categories[0]?.name || 'Standard';
    const resolvedRate = Number(rateVal) || categories[0]?.rate || 2000;
    const rows: BulkDraftRoomRow[] = [];
    for (let n = s; n <= e; n++) {
      rows.push({
        draftId: `rng-${Date.now()}-${n}`,
        number: String(n),
        floor: resolvedFloor,
        category: resolvedCat,
        rate: resolvedRate,
      });
    }
    setBulkDraftRows(rows);
  };

  const generateMultiFloorDraftRows = (
    startRoomStr = bulkStartRoomNum,
    floorsCountStr = bulkNumFloors,
    perFloorStr = bulkRoomsPerFloor,
    startFloorStr = bulkStartFloorNum,
    pattern = bulkNumberingPattern,
    catLabel = category,
    rateVal = rate
  ) => {
    const baseRoom = parseInt(startRoomStr.replace(/\D/g, ''), 10);
    const numFloors = parseInt(floorsCountStr.replace(/\D/g, ''), 10);
    const perFloor = parseInt(perFloorStr.replace(/\D/g, ''), 10);
    const startFloor = parseInt(startFloorStr.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(baseRoom) || baseRoom <= 0) {
      setFormError('Starting Room Number must be a positive number (e.g. 101).');
      return;
    }
    if (Number.isNaN(numFloors) || numFloors < 1 || numFloors > 50) {
      setFormError('Number of Floors must be between 1 and 50.');
      return;
    }
    if (Number.isNaN(perFloor) || perFloor < 1 || perFloor > 50) {
      setFormError('Rooms per Floor must be between 1 and 50.');
      return;
    }
    if (numFloors * perFloor > 250) {
      setFormError('Maximum 250 rooms can be generated in one batch.');
      return;
    }
    setFormError('');
    const safeStartFloor = Number.isNaN(startFloor) ? 1 : startFloor;
    const resolvedCat = catLabel.trim() || categories[0]?.name || 'Standard';
    const resolvedRate = Number(rateVal) || categories[0]?.rate || 2000;
    const rows: BulkDraftRoomRow[] = [];
    let seqCursor = baseRoom;
    for (let f = 0; f < numFloors; f++) {
      const floorNumber = safeStartFloor + f;
      const floorLabel = formatFloorLabel(floorNumber);
      const floorStartNum =
        pattern === 'floor_series'
          ? baseRoom + f * 100
          : seqCursor;
      for (let rIdx = 0; rIdx < perFloor; rIdx++) {
        const rmNum = pattern === 'floor_series' ? floorStartNum + rIdx : seqCursor++;
        rows.push({
          draftId: `blk-${Date.now()}-${f}-${rIdx}`,
          number: String(rmNum),
          floor: floorLabel,
          category: resolvedCat,
          rate: resolvedRate,
        });
      }
    }
    setBulkDraftRows(rows);
  };

  // Extract Hotel ID for isolated persistence
  const activeHotelId = rooms[0]?.hotelId || hotelSettings?.id || 'hotel-1';

  // Master Amenities Library State (starts empty; derived from hotel rooms or added by admin)
  const [customAmenities, setCustomAmenities] = useState<AmenityItem[]>([]);
  const [deletedAmenityIds, setDeletedAmenityIds] = useState<string[]>([]);
  const amenities = React.useMemo<AmenityItem[]>(() => {
    const list: AmenityItem[] = [...customAmenities];
    rooms.forEach(r => {
      (Array.isArray(r.amenities) ? r.amenities : []).forEach(amName => {
        const cleanAm = String(amName || '').trim();
        const amId = `am-${cleanAm.toLowerCase().replace(/\s+/g, '-')}`;
        if (
          cleanAm &&
          !deletedAmenityIds.includes(amId) &&
          !list.some(a => String(a.name || '').toLowerCase() === cleanAm.toLowerCase())
        ) {
          list.push({
            id: amId,
            name: cleanAm,
            iconName: 'sparkles',
            category: 'Comfort',
            description: 'Room amenity'
          });
        }
      });
    });
    return list;
  }, [rooms, customAmenities, deletedAmenityIds]);

  const [newAmenityName, setNewAmenityName] = useState('');
  const [newAmenityCategory, setNewAmenityCategory] = useState('Comfort');
  const [newAmenityDesc, setNewAmenityDesc] = useState('');

  // Dynamic Room Categories (zero static categories; derived strictly from actual hotel rooms + user-created categories)
  const [customCategories, setCustomCategories] = useState<CategoryConfig[]>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('directstay_room_categories') : null;
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [deletedCategoryNames, setDeletedCategoryNames] = useState<string[]>([]);

  const categories = React.useMemo<CategoryConfig[]>(() => {
    const list: CategoryConfig[] = [...customCategories];
    rooms.forEach(r => {
      const catName = String(r.category || '').trim();
      if (
        catName &&
        !deletedCategoryNames.includes(catName) &&
        !list.some(b => String(b.name || '').toLowerCase() === catName.toLowerCase())
      ) {
        list.push({
          name: catName,
          rate: Number(r.rate || 0),
          baseOcc: Number(r.baseOccupancy || 2),
          maxOcc: Number(r.maxOccupancy || 3),
          extra: Number(r.extraPersonCharge || 0),
          bedType: r.bedType || 'King Size Bed',
          defaultAmenities: Array.isArray(r.amenities) ? r.amenities : []
        });
      }
    });
    return list;
  }, [rooms, customCategories, deletedCategoryNames]);

  // Dynamic Pricing Rules State
  const [weekendMultiplier, setWeekendMultiplier] = useState<number>(15); // 15% surcharge
  const [peakSeasonMultiplier, setPeakSeasonMultiplier] = useState<number>(25); // 25% surcharge
  const [taxSlabs, setTaxSlabs] = useState<{ min: number; max: number; gst: number }[]>([
    { min: 0, max: 1000, gst: 0 },
    { min: 1001, max: 7500, gst: 12 },
    { min: 7501, max: 999999, gst: 18 }
  ]);

  // Room Module Settings State
  const [defaultCheckInTime, setDefaultCheckInTime] = useState(hotelSettings?.checkInTime || '12:00 PM');
  const [defaultCheckOutTime, setDefaultCheckOutTime] = useState(hotelSettings?.checkOutTime || '11:00 AM');
  const [earlyCheckInEnabled, setEarlyCheckInEnabled] = useState<boolean>(hotelSettings?.earlyCheckInEnabled === true);
  const [earlyCheckInType, setEarlyCheckInType] = useState<'hourly' | 'fixed'>(hotelSettings?.earlyCheckInType || 'hourly');
  const [earlyCheckInHourlyRate, setEarlyCheckInHourlyRate] = useState<number>(Number(hotelSettings?.earlyCheckInHourlyRate) || 0);
  const [earlyCheckInFixedRate, setEarlyCheckInFixedRate] = useState<number>(Number(hotelSettings?.earlyCheckInFixedRate) || 0);
  const [autoMarkDirtyOnCheckout, setAutoMarkDirtyOnCheckout] = useState(true);
  const [requireInspectionToClean, setRequireInspectionToClean] = useState(true);
  const [overbookingLimitPercent, setOverbookingLimitPercent] = useState(0);
  const [allowBackDatedCheckIn, setAllowBackDatedCheckIn] = useState(hotelSettings?.allowBackDatedCheckIn ?? false);
  const [allowBackDatedFoodBill, setAllowBackDatedFoodBill] = useState(hotelSettings?.allowBackDatedFoodBill ?? true);

  useEffect(() => {
    if (hotelSettings) {
      if (hotelSettings.checkInTime) setDefaultCheckInTime(hotelSettings.checkInTime);
      if (hotelSettings.checkOutTime) setDefaultCheckOutTime(hotelSettings.checkOutTime);
      if (hotelSettings.earlyCheckInEnabled !== undefined) setEarlyCheckInEnabled(Boolean(hotelSettings.earlyCheckInEnabled));
      if (hotelSettings.earlyCheckInType) setEarlyCheckInType(hotelSettings.earlyCheckInType);
      if (hotelSettings.earlyCheckInHourlyRate !== undefined) setEarlyCheckInHourlyRate(Number(hotelSettings.earlyCheckInHourlyRate) || 0);
      if (hotelSettings.earlyCheckInFixedRate !== undefined) setEarlyCheckInFixedRate(Number(hotelSettings.earlyCheckInFixedRate) || 0);
      if (hotelSettings.allowBackDatedCheckIn !== undefined) setAllowBackDatedCheckIn(hotelSettings.allowBackDatedCheckIn);
      if (hotelSettings.allowBackDatedFoodBill !== undefined) setAllowBackDatedFoodBill(hotelSettings.allowBackDatedFoodBill);
      if (hotelSettings.autoMarkDirtyOnCheckout !== undefined) setAutoMarkDirtyOnCheckout(hotelSettings.autoMarkDirtyOnCheckout);
    }
  }, [hotelSettings]);

  // Category Manager State
  const [newCatName, setNewCatName] = useState('');
  const [newCatRate, setNewCatRate] = useState<number>(0);
  const [newCatBaseOcc, setNewCatBaseOcc] = useState<number>(2);
  const [newCatMaxOcc, setNewCatMaxOcc] = useState<number>(4);
  const [newCatExtra, setNewCatExtra] = useState<number>(0);
  const [newCatBed, setNewCatBed] = useState('King Size Bed');
  const [catError, setCatError] = useState('');

  // Modal for Quick Status Change / Block Room
  const [selectedRoomForStatus, setSelectedRoomForStatus] = useState<Room | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  // Persist categories helper
  const saveCustomCategoriesToStore = (updatedList: CategoryConfig[]) => {
    setCustomCategories(updatedList);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('directstay_room_categories', JSON.stringify(updatedList));
      }
    } catch {}
  };

  // Persist amenities helper
  const saveAmenitiesToStore = (updatedList: AmenityItem[]) => {
    setCustomAmenities(updatedList);
  };

  const [customAmenityInput, setCustomAmenityInput] = useState('');

  const handleAddCustomAmenityToRoom = () => {
    const trimmed = customAmenityInput.trim();
    if (!trimmed) return;
    if (!selectedRoomAmenities.includes(trimmed)) {
      setSelectedRoomAmenities(prev => [...prev, trimmed]);
    }
    const amId = `am-${trimmed.toLowerCase().replace(/\s+/g, '-')}`;
    if (!customAmenities.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      const newAm: AmenityItem = {
        id: amId,
        name: trimmed,
        category: 'Custom',
        iconName: 'Sparkles',
        description: 'Custom room amenity'
      };
      saveAmenitiesToStore([...customAmenities, newAm]);
    }
    setCustomAmenityInput('');
    showToast(`Added custom amenity: "${trimmed}"`, 'success');
  };

  // Restricted permissions check synced with RBAC Module Permissions Matrix
  const [rbacMatrix] = useRbacMatrix();
  const roomsPerm = getRoleModulePermission(rbacMatrix, currentRole, 'rooms');
  const isRestrictedRole = !roomsPerm.createEdit;
  const canDeleteRoom = roomsPerm.deleteCancel;

  // --- Handlers for Add/Edit Room ---
  const handleEditRoomClick = (room: Room) => {
    setFormMode('edit');
    setIsCustomCategoryMode(false);
    setRoomId(room.id);
    setRoomNumber(room.number);
    setCategory(room.category);
    setRate(room.rate);
    setStatus(room.status);
    setCleaningStatus(room.cleaningStatus || 'Clean');
    setBaseOccupancy(room.baseOccupancy ?? 2);
    setMaxOccupancy(room.maxOccupancy ?? 3);
    setExtraPersonCharge(room.extraPersonCharge ?? 0);
    setFloor(room.floor || '1st Floor');
    setBedType(room.bedType || 'King Size Bed');
    setAllowExtraBed(room.allowExtraBed !== false);
    setSelectedRoomAmenities(room.amenities || []);
    setRoomImages(room.images?.[0] || '');
    setOutOfOrderReason(room.outOfOrderReason || '');
    setFormError('');
    setIsFormOpen(true);
  };

  const openAddRoomModalWithMode = (initialMode: RoomCreationMode = 'single') => {
    if (rooms.length >= maxRoomsLimit) {
      setRoomLimitAlert(`Package Limit Reached: Your current plan (${packageName}) permits up to ${maxRoomsLimit} room units. Upgrade your package under Super Admin Hub to add more room entities.`);
      return;
    }
    setRoomLimitAlert(null);
    setFormMode('add');
    setAddCreationMode(initialMode);
    setIsCustomCategoryMode(categories.length === 0);
    setRoomId('');
    setRoomNumber('');
    setAllowExtraBed(true);

    const defaultCat = categories[0]?.name || '';
    setCategory(defaultCat);

    const catConfig = categories.find(c => c.name === defaultCat);
    const initRate = catConfig ? catConfig.rate : 2000;
    if (catConfig) {
      setRate(catConfig.rate);
      setBaseOccupancy(catConfig.baseOcc);
      setMaxOccupancy(catConfig.maxOcc);
      setExtraPersonCharge(catConfig.extra);
      setBedType(catConfig.bedType || 'King Size Bed');
      setSelectedRoomAmenities(catConfig.defaultAmenities || []);
    } else {
      setRate(2000);
      setBaseOccupancy(2);
      setMaxOccupancy(3);
      setExtraPersonCharge(500);
      setBedType('King Size Bed');
      setSelectedRoomAmenities([]);
    }

    setStatus('Available');
    setCleaningStatus('Clean');
    setFloor('1st Floor');
    setRoomImages('');
    setOutOfOrderReason('');
    setFormError('');

    if (initialMode === 'range') {
      generateRangeDraftRows(rangeStartNum, rangeEndNum, '1st Floor', defaultCat || 'Standard', initRate);
    } else if (initialMode === 'bulk') {
      generateMultiFloorDraftRows(
        bulkStartRoomNum,
        bulkNumFloors,
        bulkRoomsPerFloor,
        bulkStartFloorNum,
        bulkNumberingPattern,
        defaultCat || 'Standard',
        initRate
      );
    } else {
      setBulkDraftRows([]);
    }
    setIsFormOpen(true);
  };

  const handleAddRoomClick = () => openAddRoomModalWithMode('single');
  const handleBulkAddRoomsClick = () => openAddRoomModalWithMode('bulk');

  const handleRoomImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const img = new window.Image();
      img.onload = () => {
        const MAX_WIDTH = 900;
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setRoomImages(compressedDataUrl);
        } else {
          setRoomImages(dataUrl);
        }
      };
      img.onerror = () => {
        setRoomImages(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // --- BULK / RANGE SAVE PATH ---
    if (formMode === 'add' && (addCreationMode === 'range' || addCreationMode === 'bulk')) {
      if (bulkDraftRows.length === 0) {
        setFormError('No rooms in the list. Click "Generate Room List" first.');
        return;
      }
      if (baseOccupancy <= 0 || maxOccupancy <= 0) {
        setFormError('Occupancy values must be positive integers.');
        return;
      }
      if (baseOccupancy > maxOccupancy) {
        setFormError('Base occupancy cannot exceed maximum occupancy.');
        return;
      }
      const existingSet = new Set(rooms.map(r => String(r.number).trim()));
      const seenInBatch = new Set<string>();
      const dupInBatch: string[] = [];
      for (const row of bulkDraftRows) {
        const cleanNum = String(row.number || '').replace(/\D/g, '').trim();
        if (!cleanNum) {
          setFormError('Every row in the preview list must have a valid numeric Room Number (or remove blank rows).');
          return;
        }
        if (!existingSet.has(cleanNum)) {
          if (seenInBatch.has(cleanNum)) {
            dupInBatch.push(cleanNum);
          } else {
            seenInBatch.add(cleanNum);
          }
        }
      }
      if (dupInBatch.length > 0) {
        setFormError(`Duplicate room number(s) found in preview list: ${Array.from(new Set(dupInBatch)).join(', ')}. Please edit or remove duplicate rows before creating.`);
        return;
      }

      const validRoomsToAdd: Room[] = [];
      let skippedDuplicates = 0;

      for (const row of bulkDraftRows) {
        const cleanNum = String(row.number || '').replace(/\D/g, '').trim();
        if (existingSet.has(cleanNum)) {
          skippedDuplicates += 1;
          continue;
        }
        const rowFloor = String(row.floor || '').trim();
        if (!rowFloor) {
          setFormError(`Room ${cleanNum} is missing a Floor.`);
          return;
        }
        const rowCat = (row.category || category || 'Standard').trim();
        const rowRate = Number(row.rate) > 0 ? Number(row.rate) : Number(rate) || 0;
        if (!rowCat) {
          setFormError(`Room ${cleanNum} is missing a Category / Type.`);
          return;
        }
        if (rowRate <= 0) {
          setFormError(`Room ${cleanNum} must have a positive Base Price (₹).`);
          return;
        }
        validRoomsToAdd.push({
          id: `${activeHotelId}-${cleanNum}`,
          hotelId: activeHotelId,
          number: cleanNum,
          category: rowCat,
          rate: rowRate,
          status,
          cleaningStatus,
          baseOccupancy,
          maxOccupancy,
          extraPersonCharge,
          floor: rowFloor,
          bedType,
          allowExtraBed,
          amenities: selectedRoomAmenities,
          images: roomImages ? [roomImages] : [],
          outOfOrderReason: status === 'Out of Order' || status === 'Maintenance' || status === 'Blocked' ? outOfOrderReason : ''
        });
      }

      if (validRoomsToAdd.length === 0) {
        setFormError('All room numbers in the list already exist in your hotel registry.');
        return;
      }
      if (rooms.length + validRoomsToAdd.length > maxRoomsLimit) {
        setFormError(
          `Package Limit Exceeded: You can add at most ${Math.max(0, maxRoomsLimit - rooms.length)} more room(s) on your ${packageName} plan.`
        );
        return;
      }

      onUpdateRooms([...rooms, ...validRoomsToAdd]);
      const uniqueFloorsCount = new Set(validRoomsToAdd.map(r => r.floor)).size;
      if (onAddAuditLog) {
        onAddAuditLog(
          'Bulk Add Room Entities',
          `Added ${validRoomsToAdd.length} rooms across ${uniqueFloorsCount} floor(s): ${validRoomsToAdd.map(r => r.number).join(', ')}`
        );
      }
      showToast(
        `Added ${validRoomsToAdd.length} room${validRoomsToAdd.length === 1 ? '' : 's'} across ${uniqueFloorsCount} floor${uniqueFloorsCount === 1 ? '' : 's'}!${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} existing duplicate skipped)` : ''
        }`,
        'success'
      );
      setBulkDraftRows([]);
      setIsFormOpen(false);
      return;
    }

    if (!roomNumber.trim()) {
      setFormError('Room number is required.');
      return;
    }

    if (!floor.trim()) {
      setFormError('Floor is required (e.g. Ground Floor, 1st Floor).');
      return;
    }

    if (!category.trim()) {
      setFormError('Room Category / Type is required.');
      return;
    }

    if (rate <= 0) {
      setFormError('Rate must be positive.');
      return;
    }

    if (baseOccupancy <= 0 || maxOccupancy <= 0) {
      setFormError('Occupancy values must be positive integers.');
      return;
    }

    if (baseOccupancy > maxOccupancy) {
      setFormError('Base occupancy cannot exceed maximum occupancy.');
      return;
    }

    const duplicate = rooms.find(r => r.number === roomNumber && r.id !== roomId);
    if (duplicate) {
      setFormError(`Room number ${roomNumber} is already occupied in the registry.`);
      return;
    }

    if (formMode === 'add') {
      const newRoom: Room = {
        id: `${activeHotelId}-${roomNumber}`,
        hotelId: activeHotelId,
        number: roomNumber,
        category,
        rate,
        status,
        cleaningStatus,
        baseOccupancy,
        maxOccupancy,
        extraPersonCharge,
        floor,
        bedType,
        allowExtraBed,
        amenities: selectedRoomAmenities,
        images: [roomImages],
        outOfOrderReason: status === 'Out of Order' || status === 'Maintenance' || status === 'Blocked' ? outOfOrderReason : ''
      };
      onUpdateRooms([...rooms, newRoom]);
      if (onAddAuditLog) onAddAuditLog('Add Room Entity', `Registered Room ${roomNumber} (${category})`);
    } else {
      const updatedList = rooms.map(r => r.id === roomId ? { 
        ...r, 
        number: roomNumber, 
        category, 
        rate, 
        status,
        cleaningStatus,
        baseOccupancy,
        maxOccupancy,
        extraPersonCharge,
        floor,
        bedType,
        allowExtraBed,
        amenities: selectedRoomAmenities,
        images: [roomImages],
        outOfOrderReason: status === 'Out of Order' || status === 'Maintenance' ? outOfOrderReason : r.outOfOrderReason
      } : r);
      onUpdateRooms(updatedList);
      if (onAddAuditLog) onAddAuditLog('Update Room Entity', `Modified settings for Room ${roomNumber}`);
    }

    setIsFormOpen(false);
  };

  const handleDeleteRoom = (id: string, num: string) => {
    const targetRoom = rooms.find(r => r.id === id);
    if (targetRoom && targetRoom.status === 'Occupied') {
      showToast(`Cannot decommission Room ${num} while it is currently Occupied by an active guest. Please check out or transfer the guest first.`, 'error');
      return;
    }
    const activeReservation = bookings.find(
      b => b.roomNumber === num && b.status === 'Confirmed' && !b.isCheckedIn
    );
    if (activeReservation) {
      showToast(`Cannot decommission Room ${num} because it has an active Confirmed reservation (${activeReservation.id} for ${activeReservation.guestName}). Please reassign or cancel the reservation first.`, 'error');
      return;
    }
    if (confirm(`Are you absolutely sure you want to decommission Room ${num}?`)) {
      onUpdateRooms(rooms.filter(r => r.id !== id));
      if (onAddAuditLog) onAddAuditLog('Delete Room Entity', `Decommissioned Room ${num}`);
    }
  };

  // Quick Direct Room Status Change
  const handleUpdateRoomStatusDirect = (targetRoomId: string, newStatus: RoomStatus, newCleaningStatus?: CleaningStatus, reason?: string) => {
    const updated = rooms.map(r => {
      if (r.id === targetRoomId) {
        return {
          ...r,
          status: newStatus,
          cleaningStatus: newCleaningStatus || r.cleaningStatus || (newStatus === 'Dirty' ? 'Dirty' : 'Clean'),
          outOfOrderReason: reason !== undefined ? reason : r.outOfOrderReason
        };
      }
      return r;
    });
    onUpdateRooms(updated);
    setSelectedRoomForStatus(null);
    setBlockReasonInput('');
    if (onAddAuditLog) {
      const roomNum = rooms.find(r => r.id === targetRoomId)?.number;
      onAddAuditLog('Room Status Changed', `Room ${roomNum} status changed to ${newStatus}`);
    }
  };

  // --- Category Handlers ---
  const handleCategoryChangeInForm = (catName: string) => {
    setCategory(catName);
    const catConfig = categories.find(c => c.name === catName);
    if (catConfig) {
      setRate(catConfig.rate);
      setBaseOccupancy(catConfig.baseOcc);
      setMaxOccupancy(catConfig.maxOcc);
      setExtraPersonCharge(catConfig.extra);
      if (catConfig.bedType) setBedType(catConfig.bedType);
      if (catConfig.defaultAmenities) setSelectedRoomAmenities(catConfig.defaultAmenities);
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');

    if (!newCatName.trim()) {
      setCatError('Category name is required.');
      return;
    }

    const trimmed = newCatName.trim();
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setCatError('A category with this name already exists.');
      return;
    }

    const safeBaseOcc = Math.max(1, Number(newCatBaseOcc) || 1);
    const safeMaxOcc = Math.max(safeBaseOcc, Number(newCatMaxOcc) || safeBaseOcc);

    const newCat: CategoryConfig = {
      name: trimmed,
      rate: newCatRate,
      baseOcc: safeBaseOcc,
      maxOcc: safeMaxOcc,
      extra: newCatExtra,
      bedType: newCatBed,
      defaultAmenities: []
    };

    setDeletedCategoryNames(prev => prev.filter(n => n.toLowerCase() !== trimmed.toLowerCase()));
    const updated = [...customCategories.filter(c => c.name.toLowerCase() !== trimmed.toLowerCase()), newCat];
    saveCustomCategoriesToStore(updated);

    setNewCatName('');
    setNewCatRate(0);
    setNewCatBaseOcc(2);
    setNewCatMaxOcc(4);
    setNewCatExtra(0);
  };

  const handleUpdateCategoryPricing = (name: string, fields: Partial<CategoryConfig>) => {
    const existing = categories.find(c => c.name === name);
    if (!existing) return;
    const updatedCat = { ...existing, ...fields };
    const nextCustom = customCategories.some(c => c.name === name)
      ? customCategories.map(c => c.name === name ? updatedCat : c)
      : [...customCategories, updatedCat];
    saveCustomCategoriesToStore(nextCustom);
  };

  const handleDeleteCategory = (catName: string) => {
    const roomsInCat = rooms.filter(r => r.category === catName).length;
    if (roomsInCat > 0) {
      showToast(`Cannot delete category "${catName}" because ${roomsInCat} rooms are currently mapped to it.`, 'error');
      return;
    }
    if (confirm(`Delete category "${catName}"?`)) {
      setDeletedCategoryNames(prev => [...prev, catName]);
      const updated = customCategories.filter(c => c.name !== catName);
      saveCustomCategoriesToStore(updated);
    }
  };

  const handleApplyCategoryToRooms = (catName: string) => {
    const catConfig = categories.find(c => c.name === catName);
    if (!catConfig) return;

    if (confirm(`Do you want to update standard pricing, occupancies and extra charges for all existing registered rooms belonging to the "${catName}" category?`)) {
      const updatedRooms = rooms.map(r => r.category === catName ? {
        ...r,
        rate: catConfig.rate,
        baseOccupancy: catConfig.baseOcc,
        maxOccupancy: catConfig.maxOcc,
        extraPersonCharge: catConfig.extra,
        bedType: catConfig.bedType || r.bedType
      } : r);
      onUpdateRooms(updatedRooms);
      showToast(`Standardized all existing "${catName}" rooms in PMS registry.`, 'success');
    }
  };

  // --- Amenity Handlers ---
  const handleAddAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmenityName.trim()) return;
    const amId = `am-${newAmenityName.trim().toLowerCase().replace(/\s+/g, '-')}`;
    const newAm: AmenityItem = {
      id: amId,
      name: newAmenityName.trim(),
      iconName: 'sparkles',
      category: newAmenityCategory,
      description: newAmenityDesc || 'Room amenity'
    };
    setDeletedAmenityIds(prev => prev.filter(id => id !== amId));
    saveAmenitiesToStore([...customAmenities.filter(a => a.id !== amId), newAm]);
    setNewAmenityName('');
    setNewAmenityDesc('');
  };

  const handleDeleteAmenity = (id: string) => {
    if (confirm('Delete this amenity from master library?')) {
      setDeletedAmenityIds(prev => [...prev, id]);
      saveAmenitiesToStore(customAmenities.filter(a => a.id !== id));
    }
  };

  // Settings Save Handler
  const handleSaveRoomSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateHotelSettings && hotelSettings) {
      onUpdateHotelSettings({
        ...hotelSettings,
        checkInTime: defaultCheckInTime,
        checkOutTime: defaultCheckOutTime,
        earlyCheckInEnabled,
        earlyCheckInType,
        earlyCheckInHourlyRate: Math.max(0, Number(earlyCheckInHourlyRate) || 0),
        earlyCheckInFixedRate: Math.max(0, Number(earlyCheckInFixedRate) || 0),
        autoMarkDirtyOnCheckout,
        allowBackDatedCheckIn,
        allowBackDatedFoodBill
      });
    }
    showToast('Room Module & Early Check-In settings saved successfully!', 'success');
  };

  // Metrics Calculations for Dashboard
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter(r => r.status === 'Available').length;
  const occupiedRooms = rooms.filter(r => r.status === 'Occupied').length;
  const reservedRooms = rooms.filter(r => r.status === 'Reserved').length;
  const dirtyRooms = rooms.filter(r => r.status === 'Dirty' || r.cleaningStatus === 'Dirty').length;
  const outOfOrderRooms = rooms.filter(r => r.status === 'Out of Order' || r.status === 'Blocked' || r.status === 'Maintenance').length;
  const outOfServiceRooms = rooms.filter(r => r.status === 'Out of Service').length;
  const occupancyPercent = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Filtered rooms listing
  const filteredRooms = rooms.filter(room => {
    const q = String(search || '').toLowerCase();
    const matchesSearch = String(room.number || '').toLowerCase().includes(q) || 
                          String(room.category || '').toLowerCase().includes(q) ||
                          String(room.floor || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'All' || room.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || room.status === statusFilter;
    const matchesFloor = floorFilter === 'All' || String(room.floor || '').trim() === floorFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesFloor;
  });

  // Strictly Blocked / Occupied rooms for the "Blocked Rooms" view (excludes Available, Clean, Dirty, Maintenance, Inspection, OOO, OOS, Reserved)
  const blockedAndOccupiedRooms = useMemo(() => {
    const q = String(search || '').toLowerCase().trim();
    return rooms.filter(room => {
      const isBlockedOrOccupied = room.status === 'Blocked' || room.status === 'Occupied';
      if (!isBlockedOrOccupied) return false;
      if (blockedViewFilter === 'Blocked' && room.status !== 'Blocked') return false;
      if (blockedViewFilter === 'Occupied' && room.status !== 'Occupied') return false;
      if (floorFilter !== 'All' && String(room.floor || '').trim() !== floorFilter) return false;
      if (categoryFilter !== 'All' && room.category !== categoryFilter) return false;
      if (q) {
        const match =
          String(room.number || '').toLowerCase().includes(q) ||
          String(room.category || '').toLowerCase().includes(q) ||
          String(room.floor || '').toLowerCase().includes(q) ||
          String(room.outOfOrderReason || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rooms, blockedViewFilter, floorFilter, categoryFilter, search]);

  const roomCategories = useMemo(() => {
    const unique = Array.from(
      new Set(filteredRooms.map((r) => normalizeCategory(r.category)).filter(Boolean))
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

  const getStatusBadge = (st: RoomStatus) => {
    switch (st) {
      case 'Available': return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'Occupied': return 'bg-rose-50 text-rose-700 border-rose-300';
      case 'Reserved': return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'Maintenance': return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'Dirty': return 'bg-amber-100 text-amber-900 border-amber-400';
      case 'Clean': return 'bg-teal-50 text-teal-800 border-teal-300';
      case 'Inspection': return 'bg-purple-50 text-purple-800 border-purple-300';
      case 'Out of Order': return 'bg-red-100 text-red-900 border-red-300';
      case 'Out of Service': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'Blocked': return 'bg-zinc-100 text-zinc-900 border-zinc-400';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Nav Sub-Tabs Configuration
  const roomSubTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: `${occupancyPercent}% Occ` },
    { id: 'buildingFloor', label: 'Building & Floor Setup', icon: Building, badge: null },
    { id: 'addRoom', label: 'Add Room', icon: Plus, badge: null },
    { id: 'categories', label: 'Room Categories / Types', icon: Tag, badge: categories.length },
    { id: 'amenities', label: 'Amenities', icon: Sparkles, badge: amenities.length },
    { id: 'status', label: 'Room Status', icon: Layers, badge: dirtyRooms > 0 ? `${dirtyRooms} Dirty` : null },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, badge: null },
  ];

  return (
    <div className="space-y-6">
      {/* 🛏️ ROOMS MODULE TOP HEADER & NAVIGATION BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#C49A3A] to-[#A67C20] rounded-xl flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              <Hotel className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-serif font-bold text-slate-800 tracking-wide">Rooms Management Module</h2>
                <span className="px-2.5 py-0.5 bg-amber-50 text-[#9B7625] border border-amber-200 text-[10px] uppercase font-mono font-bold rounded-full">
                  Inventory & Tariff Control
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Configure room inventory, rate cards, live availability, amenities library & housekeeping statuses
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-600 flex items-center gap-2">
              <Bed className="w-3.5 h-3.5 text-[#C49A3A]" />
              <span>Total Units: <strong className="text-slate-900">{totalRooms}</strong></span>
            </div>
            {!isRestrictedRole && (
              <>
                <button
                  type="button"
                  onClick={handleBulkAddRoomsClick}
                  className="px-3.5 py-2 bg-[#FDF6E3] hover:bg-[#F5E7C1] text-[#8B691E] border border-[#DFC07A] font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-[#B5822D]" /> Bulk Add Rooms
                </button>
                <button
                  type="button"
                  onClick={handleAddRoomClick}
                  className="px-3.5 py-2 bg-[#C49A3A] hover:bg-[#b0882e] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Room Entity
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {roomSubTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'addRoom') {
                    handleAddRoomClick();
                  } else {
                    setActiveSubTab(tab.id);
                  }
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#DFB962] via-[#CEA346] to-[#BE9032] text-[#17120F] font-bold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#17120F]' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-black/10 text-black' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* PACKAGE LIMIT ALERT */}
      {roomLimitAlert && (
        <div className="bg-amber-950/90 border border-amber-500/30 text-amber-100 p-4 rounded-2xl flex items-center justify-between text-xs animate-fade-in shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-luxury-gold-400 shrink-0" />
            <span>{roomLimitAlert}</span>
          </div>
          <button onClick={() => setRoomLimitAlert(null)} className="text-amber-300 hover:text-white ml-2 cursor-pointer p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --- SUB-TAB 1: DASHBOARD --- */}
      {(activeSubTab === 'dashboard' || (!['categories', 'availability', 'amenities', 'status', 'settings', 'blockAssets', 'priceHistory', 'buildingFloor'].includes(activeSubTab))) && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-white border border-luxury-brown-200/60 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-luxury-brown-400 block">Total Rooms</span>
              <span className="text-2xl font-serif font-black text-luxury-brown-950">{totalRooms}</span>
              <span className="text-[9px] text-luxury-brown-500 block">100% Capacity</span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-700 block">Available</span>
              <span className="text-2xl font-serif font-black text-emerald-900">{availableRooms}</span>
              <span className="text-[9px] text-emerald-700 block font-bold">Ready to Rent</span>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-rose-700 block">Occupied</span>
              <span className="text-2xl font-serif font-black text-rose-900">{occupiedRooms}</span>
              <span className="text-[9px] text-rose-700 block font-bold">In-House Guests</span>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-blue-700 block">Reserved</span>
              <span className="text-2xl font-serif font-black text-blue-900">{reservedRooms}</span>
              <span className="text-[9px] text-blue-700 block font-bold">Advance Booking</span>
            </div>

            <div className="bg-amber-50/60 border border-amber-300 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-amber-800 block">Dirty</span>
              <span className="text-2xl font-serif font-black text-amber-950">{dirtyRooms}</span>
              <span className="text-[9px] text-amber-800 block font-bold">Needs Cleaning</span>
            </div>

            <div className="bg-red-50/60 border border-red-200 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-red-800 block">Out of Order</span>
              <span className="text-2xl font-serif font-black text-red-950">{outOfOrderRooms}</span>
              <span className="text-[9px] text-red-700 block font-bold">Maintenance / Blocked</span>
            </div>

            <div className="bg-gray-100/60 border border-gray-300 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-gray-700 block">Out of Service</span>
              <span className="text-2xl font-serif font-black text-gray-950">{outOfServiceRooms}</span>
              <span className="text-[9px] text-gray-600 block">Temporarily Closed</span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 shadow-xs text-center space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-[#9B7625] block">Occupancy %</span>
              <span className="text-2xl font-serif font-black text-[#C49A3A]">{occupancyPercent}%</span>
              <span className="text-[9px] text-amber-800 block font-bold">Live Yield Rate</span>
            </div>
          </div>

          {/* Room Category Yield Breakdown & Status Visual Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-luxury-brown-200/60 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
                <div>
                  <h3 className="font-serif font-bold text-luxury-brown-950 text-base flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-luxury-gold-600" /> Room Categories & Yield Distribution
                  </h3>
                  <p className="text-xs text-luxury-brown-500">Breakdown of inventory, rate cards, occupied count & occupancy rate per category</p>
                </div>
                <button
                  onClick={() => setActiveSubTab('categories')}
                  className="px-3 py-1.5 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 text-xs font-bold rounded-lg transition-colors border border-luxury-brown-200"
                >
                  Manage Categories →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-luxury-beige-100/70 border-b border-luxury-brown-200 text-luxury-brown-800 font-serif font-bold">
                      <th className="p-3">Category Name</th>
                      <th className="p-3">Total Units</th>
                      <th className="p-3">Available</th>
                      <th className="p-3">Occupied</th>
                      <th className="p-3">Base Tariff</th>
                      <th className="p-3 text-right">Occupancy %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100">
                    {categories.map(cat => {
                      const catRooms = rooms.filter(r => r.category === cat.name);
                      const catTotal = catRooms.length;
                      const catAvail = catRooms.filter(r => r.status === 'Available').length;
                      const catOcc = catRooms.filter(r => r.status === 'Occupied').length;
                      const catPct = catTotal > 0 ? Math.round((catOcc / catTotal) * 100) : 0;

                      return (
                        <tr key={cat.name} className="hover:bg-luxury-beige-50/50 font-mono">
                          <td className="p-3 font-serif font-bold text-luxury-brown-950 text-sm">{cat.name}</td>
                          <td className="p-3 font-bold text-luxury-brown-900">{catTotal}</td>
                          <td className="p-3 text-emerald-700 font-bold">{catAvail}</td>
                          <td className="p-3 text-rose-700 font-bold">{catOcc}</td>
                          <td className="p-3 font-bold text-luxury-gold-700">₹{Number(cat.rate || 0).toLocaleString()}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div className="bg-luxury-gold-500 h-2 rounded-full" style={{ width: `${catPct}%` }} />
                              </div>
                              <span className="font-bold text-luxury-brown-950 text-[11px] min-w-[32px]">{catPct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Actions & Status Visuals */}
            <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="font-serif font-bold text-luxury-brown-950 text-base flex items-center gap-2 border-b border-luxury-brown-100 pb-3">
                <PieChart className="w-5 h-5 text-luxury-gold-600" /> Operational Overview
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] font-mono font-bold mb-1">
                    <span className="text-emerald-800">Available ({availableRooms})</span>
                    <span className="text-luxury-brown-600">{totalRooms > 0 ? Math.round((availableRooms / totalRooms) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${totalRooms > 0 ? (availableRooms / totalRooms) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono font-bold mb-1">
                    <span className="text-rose-800">Occupied ({occupiedRooms})</span>
                    <span className="text-luxury-brown-600">{totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-rose-500 h-2.5 rounded-full" style={{ width: `${totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono font-bold mb-1">
                    <span className="text-amber-800">Dirty / Housekeeping ({dirtyRooms})</span>
                    <span className="text-luxury-brown-600">{totalRooms > 0 ? Math.round((dirtyRooms / totalRooms) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${totalRooms > 0 ? (dirtyRooms / totalRooms) * 100 : 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-mono font-bold mb-1">
                    <span className="text-red-800">Out of Order / Blocked ({outOfOrderRooms})</span>
                    <span className="text-luxury-brown-600">{totalRooms > 0 ? Math.round((outOfOrderRooms / totalRooms) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-red-500 h-2.5 rounded-full" style={{ width: `${totalRooms > 0 ? (outOfOrderRooms / totalRooms) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-luxury-brown-100 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-luxury-brown-500 block">Quick Navigation</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveSubTab('availability')}
                    className="p-2.5 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-luxury-gold-600" /> Availability Matrix
                  </button>
                  <button
                    onClick={() => setActiveSubTab('status')}
                    className="p-2.5 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-luxury-gold-400" /> Status Board
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* All Registered Hotel Rooms Directory on Dashboard */}
          <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-luxury-brown-100 pb-3">
              <div>
                <h3 className="font-serif font-bold text-luxury-brown-950 text-base flex items-center gap-2">
                  <Bed className="w-5 h-5 text-luxury-gold-600" /> Registered Hotel Rooms Registry ({filteredRooms.length})
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Manage individual room entities, tariffs, extra person charges, housekeeping statuses & QR codes
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-luxury-brown-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search Room # or Category..."
                    className="pl-8 pr-3 py-1.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-900 focus:outline-none"
                  />
                </div>
                {!isRestrictedRole && (
                  <button
                    onClick={handleAddRoomClick}
                    className="px-3.5 py-1.5 bg-[#C49A3A] hover:bg-[#b0882e] text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Room
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {filteredRooms.length === 0 ? (
                <div className="py-12 text-center text-xs text-luxury-brown-400 bg-luxury-beige-50 rounded-2xl">
                  No rooms match the search or filter criteria.
                </div>
              ) : (
                roomCategories.map((catName) => {
                  const catRooms = filteredRooms
                    .filter((r) => normalizeCategory(r.category) === catName)
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
                        <div className="text-[11px] sm:text-xs text-slate-600 flex items-center gap-1">
                          <span className="text-slate-400 font-medium">Base Tariff:</span>
                          <strong className="text-[#17120F] font-bold font-mono">₹{Number(catRooms[0]?.rate || 2000).toLocaleString('en-IN')}</strong>
                          <span className="text-slate-400">/ night</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {catRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-white border border-luxury-brown-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-luxury-gold-500 transition-all"
                >
                  {room.images?.[0] && (
                    <div className="h-32 w-full rounded-xl overflow-hidden border border-luxury-brown-100">
                      <img
                        src={room.images[0]}
                        alt={`Room ${room.number}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif font-bold text-luxury-brown-950 text-base">
                        Room {room.number}
                      </h4>
                      <span className="text-[10px] uppercase font-mono text-luxury-brown-500">
                        {room.category} • {room.floor || '1st Floor'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-2.5 py-1 border rounded-full uppercase tracking-wide ${getStatusBadge(
                        room.status
                      )}`}
                    >
                      {room.status}
                    </span>
                  </div>

                  <div className="bg-luxury-beige-50 p-2.5 rounded-xl text-xs space-y-1 border border-luxury-brown-100">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-luxury-brown-500">TARIFF:</span>
                      <strong className="text-luxury-gold-700">
                        ₹{Number(room.rate || 0).toLocaleString()}/N
                      </strong>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-luxury-brown-500">OCCUPANCY:</span>
                      <strong className="text-luxury-brown-800">
                        {room.baseOccupancy || 2} Base / {room.maxOccupancy || 3} Max
                      </strong>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-luxury-brown-500">CLEANING:</span>
                      <strong
                        className={
                          room.cleaningStatus === 'Clean'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {room.cleaningStatus || 'Clean'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-luxury-brown-500">EXTRA BED:</span>
                      <strong className={room.allowExtraBed !== false ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {room.allowExtraBed !== false ? '✓ Possible' : '✕ Not Allowed'}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setViewRoomDetails(room)}
                        className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        title="View Room & Guest Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" /> View
                      </button>
                      {!isRestrictedRole ? (
                        <button
                          onClick={() => setSelectedRoomForStatus(room)}
                          className="py-1.5 px-2 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Change Room Operational Status"
                        >
                          <Edit2 className="w-3.5 h-3.5 shrink-0" /> Status
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQrModalRoom(room)}
                        className="flex-1 py-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Room QR Code for Direct Guest Booking / Room Service"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-700 shrink-0" /> QR
                      </button>
                      {!isRestrictedRole && (
                        <button
                          onClick={() => handleEditRoomClick(room)}
                          className="flex-1 py-1 px-2 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="Edit Room Details & Photo"
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteRoom && (
                        <button
                          onClick={() => handleDeleteRoom(room.id, room.number)}
                          className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                          title="Delete Room"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: BUILDING & FLOOR ARCHITECTURE SETUP --- */}
      {activeSubTab === 'buildingFloor' && (
        <BuildingFloorView
          rooms={rooms}
          onUpdateRooms={onUpdateRooms}
          hotelName={hotelSettings?.name}
          hotelId={activeHotelId}
          customFloorLabels={knownFloorOptions}
          onUpdateCustomFloors={handlePersistCustomFloors}
          categories={categories.map(c => ({ name: c.name, rate: c.rate }))}
          onAddAuditLog={onAddAuditLog}
        />
      )}

      {/* --- SUB-TAB 2: ROOM CATEGORIES / TYPES --- */}
      {(activeSubTab === 'categories' || activeSubTab === 'priceHistory') && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-luxury-gold-600" /> Room Categories & Type Definitions
                </h3>
                <p className="text-xs text-luxury-brown-500">Create, edit, and delete category tiers with default capacity, bed configuration, amenities & tariff rates.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form to Create Custom Category */}
              {!isRestrictedRole ? (
                <form onSubmit={handleCreateCategory} className="bg-luxury-beige-100/30 border border-luxury-gold-500/20 rounded-2xl p-5 space-y-4 h-fit">
                  <h4 className="font-serif font-bold text-xs text-luxury-brown-950 flex items-center gap-1.5 border-b border-luxury-brown-100 pb-2">
                    <Plus className="w-3.5 h-3.5 text-luxury-gold-600" /> Add New Room Category
                  </h4>
                  
                  {catError && (
                    <p className="text-[10px] text-rose-600 bg-rose-50 p-2 rounded-lg font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {catError}
                    </p>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Category Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Sea View Villa"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Base Tariff (₹) *</label>
                      <input 
                        type="number" 
                        step="any"
                        required min={100} placeholder="e.g. 2500"
                        value={newCatRate === 0 ? '' : newCatRate}
                        onChange={(e) => setNewCatRate(parseInt(e.target.value) || 0)}
                        className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Extra Pax Fee (₹)</label>
                      <input 
                        type="number" 
                        step="any"
                        min={0} placeholder="0"
                        value={newCatExtra === 0 ? '' : newCatExtra}
                        onChange={(e) => setNewCatExtra(parseInt(e.target.value) || 0)}
                        className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none text-luxury-brown-950"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Base Occ</label>
                      <input 
                        type="text" inputMode="numeric" required placeholder="2"
                        value={newCatBaseOcc === 0 ? '' : String(newCatBaseOcc)}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const d = e.target.value.replace(/[^0-9]/g, '');
                          setNewCatBaseOcc(d === '' ? 0 : parseInt(d, 10));
                        }}
                        className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Max Occ</label>
                      <input 
                        type="text" inputMode="numeric" required placeholder="3"
                        value={newCatMaxOcc === 0 ? '' : String(newCatMaxOcc)}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const d = e.target.value.replace(/[^0-9]/g, '');
                          setNewCatMaxOcc(d === '' ? 0 : parseInt(d, 10));
                        }}
                        className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Bed Type</label>
                    <select
                      value={newCatBed}
                      onChange={e => setNewCatBed(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                    >
                      <option value="King Size Bed">King Size Bed</option>
                      <option value="Queen Size Bed">Queen Size Bed</option>
                      <option value="Double Bed">Double Bed</option>
                      <option value="Twin Beds">Twin Beds</option>
                      <option value="Suite Bedding">Suite Bedding</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    Save Category Definition
                  </button>
                </form>
              ) : (
                <div className="bg-luxury-beige-100/30 border border-luxury-brown-100 rounded-2xl p-5 text-center text-xs text-luxury-brown-500 flex flex-col justify-center items-center gap-2">
                  <span>🔒 Operational Read-Only</span>
                  <p className="text-[10px] leading-normal">Staff profiles are restricted from altering standard hotel categories and dynamic pricing rules.</p>
                </div>
              )}

              {/* Active Category Listings Table */}
              <div className="lg:col-span-2 overflow-x-auto border border-luxury-brown-100 rounded-2xl bg-white">
                <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                  <thead>
                    <tr className="bg-luxury-beige-50 text-luxury-brown-800 font-serif font-bold border-b border-luxury-brown-100">
                      <th className="p-3">Category Name</th>
                      <th className="p-3">Bed Type</th>
                      <th className="p-3">Nightly Rate (₹)</th>
                      <th className="p-3">Base / Max</th>
                      <th className="p-3">Extra Pax Fee</th>
                      <th className="p-3">Rooms Mapped</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-brown-100">
                    {categories.map((cat) => {
                      const roomsInCat = rooms.filter(r => r.category === cat.name).length;
                      return (
                        <tr key={cat.name} className="hover:bg-luxury-beige-50/30 font-mono text-luxury-brown-900">
                          <td className="p-3 font-serif font-bold text-luxury-brown-950 text-sm">{cat.name}</td>
                          <td className="p-3 text-luxury-brown-600">{cat.bedType || 'King / Queen'}</td>
                          <td className="p-3 font-bold text-luxury-gold-700">
                            {!isRestrictedRole ? (
                              <input 
                                type="number"
                                step="any"
                                value={cat.rate}
                                onChange={(e) => handleUpdateCategoryPricing(cat.name, { rate: parseInt(e.target.value) || 0 })}
                                className="w-20 px-2 py-1 border border-luxury-brown-200 rounded text-center text-xs text-luxury-brown-950 focus:border-luxury-gold-500 focus:outline-none"
                              />
                            ) : (
                              <span>₹{cat.rate}</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span>{cat.baseOcc} / {cat.maxOcc} Pax</span>
                          </td>
                          <td className="p-3 font-bold text-emerald-700">₹{cat.extra}</td>
                          <td className="p-3">
                            <span className="font-bold text-luxury-brown-900 bg-luxury-beige-100 px-2.5 py-1 rounded-full text-[10px]">
                              {roomsInCat} Units
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1">
                            {!isRestrictedRole && roomsInCat > 0 && (
                              <button
                                type="button"
                                onClick={() => handleApplyCategoryToRooms(cat.name)}
                                className="text-[10px] bg-luxury-brown-900 hover:bg-black text-white font-serif font-bold px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1 shadow-xs"
                                title="Update tariff inside all registered rooms"
                              >
                                <span>Sync Tariff</span>
                              </button>
                            )}
                            {!isRestrictedRole && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.name)}
                                className="text-[10px] p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors inline-block"
                                title="Delete Category"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 3: ROOM AVAILABILITY & CALENDAR MATRIX --- */}
      {activeSubTab === 'availability' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-luxury-gold-600" /> Live Room Availability & Booking Matrix
                </h3>
                <p className="text-xs text-luxury-brown-500">Real-time availability status, calendar booking timeline, and manual room blocking controls.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-luxury-brown-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search room number/category..."
                    className="pl-9 pr-3 py-1.5 bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl text-xs text-luxury-brown-900 focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>
              </div>
            </div>

            {/* Matrix Calendar Component Embedded */}
            <CalendarBookingView
              rooms={rooms}
              bookings={bookings}
              setActiveTab={() => {}}
              onUpdateBookings={onUpdateBookings || (() => {})}
              onUpdateRooms={onUpdateRooms}
              onAddAuditLog={onAddAuditLog}
            />
          </div>
        </div>
      )}

      {/* --- SUB-TAB 4: AMENITIES --- */}
      {activeSubTab === 'amenities' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-luxury-gold-600" /> Master Room Amenities Library
                </h3>
                <p className="text-xs text-luxury-brown-500">Define in-room amenities, features & appliances to attach to room types or specific room entities.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {!isRestrictedRole && (
                <form onSubmit={handleAddAmenity} className="bg-luxury-beige-100/30 border border-luxury-gold-500/20 rounded-2xl p-5 space-y-4 h-fit">
                  <h4 className="font-serif font-bold text-xs text-luxury-brown-950 flex items-center gap-1.5 border-b border-luxury-brown-100 pb-2">
                    <Plus className="w-3.5 h-3.5 text-luxury-gold-600" /> Create New Amenity
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Amenity Name *</label>
                    <input
                      type="text" required
                      placeholder="e.g. Ocean View Balcony"
                      value={newAmenityName}
                      onChange={e => setNewAmenityName(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 text-luxury-brown-950 focus:border-luxury-gold-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Category Group</label>
                    <select
                      value={newAmenityCategory}
                      onChange={e => setNewAmenityCategory(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 text-luxury-brown-950 focus:border-luxury-gold-500 focus:outline-none"
                    >
                      <option value="Connectivity">Connectivity</option>
                      <option value="Climate">Climate Control</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Bathroom">Bathroom Luxury</option>
                      <option value="Appliance">Appliance / Refreshment</option>
                      <option value="Security">Security & Safety</option>
                      <option value="Comfort">General Comfort</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-mono text-luxury-brown-600 block font-bold">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Brief amenity feature note..."
                      value={newAmenityDesc}
                      onChange={e => setNewAmenityDesc(e.target.value)}
                      className="w-full text-xs bg-white border border-luxury-brown-200 rounded-lg px-3 py-2 text-luxury-brown-950 focus:border-luxury-gold-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    Add Amenity to Library
                  </button>
                </form>
              )}

              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {amenities.map(item => (
                  <div key={item.id} className="bg-luxury-beige-50/60 border border-luxury-brown-200 rounded-xl p-4 space-y-2 relative group">
                    {!isRestrictedRole && (
                      <button
                        onClick={() => handleDeleteAmenity(item.id)}
                        className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Delete Amenity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-luxury-gold-500/10 text-luxury-gold-700 rounded-lg">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-serif font-bold text-sm text-luxury-brown-950">{item.name}</h5>
                        <span className="text-[9px] uppercase font-mono font-bold text-luxury-gold-700 bg-luxury-gold-500/10 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-luxury-brown-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 6A: BLOCKED & OCCUPIED ROOMS (STRICT FILTER) --- */}
      {activeSubTab === 'blockAssets' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-luxury-gold-600" /> Blocked &amp; Occupied Rooms
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Displaying only truly <strong>Blocked</strong> and <strong>Occupied</strong> rooms. Available, Clean, Dirty, Inspection, and Maintenance rooms are excluded.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl p-1 text-xs font-bold">
                  {(
                    [
                      { id: 'all_blocked_occupied', label: `All (${rooms.filter(r => r.status === 'Blocked' || r.status === 'Occupied').length})` },
                      { id: 'Blocked', label: `Blocked (${rooms.filter(r => r.status === 'Blocked').length})` },
                      { id: 'Occupied', label: `Occupied (${rooms.filter(r => r.status === 'Occupied').length})` },
                    ] as const
                  ).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBlockedViewFilter(opt.id)}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        blockedViewFilter === opt.id
                          ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs'
                          : 'text-luxury-brown-600 hover:text-luxury-brown-950'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <select
                  value={floorFilter}
                  onChange={e => setFloorFilter(e.target.value)}
                  className="bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 text-xs text-luxury-brown-900 font-serif"
                >
                  <option value="All">All Floors</option>
                  {knownFloorOptions.map(fl => (
                    <option key={fl} value={fl}>{fl}</option>
                  ))}
                </select>
              </div>
            </div>

            {blockedAndOccupiedRooms.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-luxury-beige-50/50 border border-dashed border-luxury-brown-200 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-serif font-bold text-luxury-brown-900">
                  No Blocked or Occupied Rooms Match This Filter
                </p>
                <p className="text-xs text-luxury-brown-500">
                  Rooms marked Available, Clean, Dirty, Maintenance, or Inspection are intentionally hidden from Blocked Rooms.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {blockedAndOccupiedRooms.map(room => (
                  <div
                    key={room.id}
                    className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 transition-all ${
                      room.status === 'Blocked' ? 'border-zinc-400 hover:border-zinc-700' : 'border-rose-200 hover:border-rose-400'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-serif font-bold text-luxury-brown-950 text-base">Room {room.number}</h4>
                        <span className="text-[10px] uppercase font-mono text-luxury-brown-500">
                          {room.category} • {room.floor || '1st Floor'}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2.5 py-1 border rounded-full uppercase tracking-wide ${getStatusBadge(room.status)}`}>
                        {room.status}
                      </span>
                    </div>

                    <div className="bg-luxury-beige-50 p-2.5 rounded-xl text-xs space-y-1 border border-luxury-brown-100">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-luxury-brown-500">TARIFF:</span>
                        <strong className="text-luxury-gold-700">₹{Number(room.rate || 0).toLocaleString()}/N</strong>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-luxury-brown-500">HOUSEKEEPING:</span>
                        <strong className={room.cleaningStatus === 'Clean' ? 'text-emerald-700' : 'text-amber-700'}>
                          {room.cleaningStatus || 'Clean'}
                        </strong>
                      </div>
                      {room.outOfOrderReason && (
                        <div className="text-[10px] text-rose-800 font-mono italic pt-1 border-t border-luxury-brown-100">
                          Reason: {room.outOfOrderReason}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={() => setViewRoomDetails(room)}
                        className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" /> View
                      </button>
                      <button
                        onClick={() => setSelectedRoomForStatus(room)}
                        className="py-1.5 px-2 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0" /> {room.status === 'Blocked' ? 'Unblock' : 'Status'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUB-TAB 6B: ROOM STATUS --- */}
      {activeSubTab === 'status' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-luxury-brown-100 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-luxury-gold-600" /> Operational Room Status & Housekeeping Board
                </h3>
                <p className="text-xs text-luxury-brown-500">Live operational status: Available, Occupied, Reserved, Dirty, Clean, Inspection, Out of Order, Out of Service, Maintenance.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={floorFilter}
                  onChange={e => setFloorFilter(e.target.value)}
                  className="bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 text-xs text-luxury-brown-900 font-serif"
                >
                  <option value="All">All Floors</option>
                  {knownFloorOptions.map(fl => (
                    <option key={fl} value={fl}>{fl}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 text-xs text-luxury-brown-900 font-serif"
                >
                  <option value="All">All Operational Statuses</option>
                  <option value="Available">Available</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Dirty">Dirty</option>
                  <option value="Clean">Clean</option>
                  <option value="Inspection">Inspection Required</option>
                  <option value="Out of Order">Out of Order (OOO)</option>
                  <option value="Out of Service">Out of Service (OOS)</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
            </div>

            {/* Room Status Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredRooms.map(room => (
                <div key={room.id} className="bg-white border border-luxury-brown-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-luxury-gold-500 transition-all">
                  {room.images?.[0] && (
                    <div className="h-32 w-full rounded-xl overflow-hidden border border-luxury-brown-100">
                      <img src={room.images[0]} alt={`Room ${room.number}`} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif font-bold text-luxury-brown-950 text-base">Room {room.number}</h4>
                      <span className="text-[10px] uppercase font-mono text-luxury-brown-500">{room.category} • {room.floor || '1st Floor'}</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2.5 py-1 border rounded-full uppercase tracking-wide ${getStatusBadge(room.status)}`}>
                      {room.status}
                    </span>
                  </div>

                  <div className="bg-luxury-beige-50 p-2.5 rounded-xl text-xs space-y-1 border border-luxury-brown-100">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-luxury-brown-500">TARIFF:</span>
                      <strong className="text-luxury-gold-700">₹{Number(room.rate || 0).toLocaleString()}/N</strong>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-luxury-brown-500">CLEANING:</span>
                      <strong className={room.cleaningStatus === 'Clean' ? 'text-emerald-700' : 'text-amber-700'}>
                        {room.cleaningStatus || 'Clean'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-luxury-brown-500">EXTRA BED:</span>
                      <strong className={room.allowExtraBed !== false ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {room.allowExtraBed !== false ? '✓ Possible' : '✕ Not Allowed'}
                      </strong>
                    </div>
                    {room.outOfOrderReason && (
                      <div className="text-[10px] text-red-800 font-mono italic">
                        Note: {room.outOfOrderReason}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setViewRoomDetails(room)}
                        className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        title="View Room & Guest Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" /> View
                      </button>
                      <button
                        onClick={() => setSelectedRoomForStatus(room)}
                        className="py-1.5 px-2 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Change Room Operational Status"
                      >
                        <Edit2 className="w-3.5 h-3.5 shrink-0" /> Status
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQrModalRoom(room)}
                        className="flex-1 py-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Room QR Code for Direct Guest Booking / Room Service"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-700 shrink-0" /> QR
                      </button>
                      {!isRestrictedRole && (
                        <>
                          <button
                            onClick={() => handleEditRoomClick(room)}
                            className="flex-1 py-1 px-2 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            title="Edit Room Details & Photo"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(room.id, room.number)}
                            className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                            title="Delete Room"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 8: SETTINGS --- */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white border border-luxury-brown-200/60 rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
            <div className="border-b border-luxury-brown-100 pb-4">
              <h3 className="text-lg font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-luxury-gold-600" /> Room Module Specific Settings
              </h3>
              <p className="text-xs text-luxury-brown-500">Configure default check-in/out times, room cleaning automation schedules & status workflow parameters.</p>
            </div>

            <form onSubmit={handleSaveRoomSettings} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-luxury-brown-700 font-bold block">
                    Standard Check-In Time (12-Hour AM / PM)
                  </label>
                  <TimePicker12h
                    value={defaultCheckInTime}
                    onChange={(display12h) => setDefaultCheckInTime(display12h)}
                    title="Standard Hotel Check-In Time"
                    className="w-full py-1 px-2.5 !border-luxury-brown-200 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Arrivals before <strong>{defaultCheckInTime}</strong> will trigger Early Check-In detection.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-luxury-brown-700 font-bold block">
                    Standard Check-Out Time (12-Hour AM / PM)
                  </label>
                  <TimePicker12h
                    value={defaultCheckOutTime}
                    onChange={(display12h) => setDefaultCheckOutTime(display12h)}
                    title="Standard Hotel Check-Out Time"
                    className="w-full py-1 px-2.5 !border-luxury-brown-200 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Default departure time pre-filled on new reservations &amp; check-ins.
                  </span>
                </div>
              </div>

              {/* ⚡ EARLY CHECK-IN PRICING RULES */}
              <div className="bg-gradient-to-br from-[#FFFDF7] via-[#FDF8EC] to-[#FAF1DC] p-4 rounded-2xl border border-[#DFC07A] space-y-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <span className="font-serif font-bold text-[#263449] text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#C49A3A]" /> Early Check-In Time &amp; Pricing Rules
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Set per-hour or fixed surcharge when a guest arrives before Standard Check-In Time ({defaultCheckInTime}).
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E5D2A6] cursor-pointer shadow-2xs">
                    <input
                      type="checkbox"
                      checked={earlyCheckInEnabled}
                      onChange={e => setEarlyCheckInEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#C49A3A] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#263449]">
                      {earlyCheckInEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                {earlyCheckInEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10.5px] font-mono uppercase font-bold text-[#7A5915] block">
                        Charge Calculation Mode
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-[#E5D2A6]">
                        <button
                          type="button"
                          onClick={() => setEarlyCheckInType('hourly')}
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            earlyCheckInType === 'hourly'
                              ? 'bg-[#FDF6E3] text-[#7A5915] border border-[#C49A3A]'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Per Hour (₹/hr)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEarlyCheckInType('fixed')}
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            earlyCheckInType === 'fixed'
                              ? 'bg-[#FDF6E3] text-[#7A5915] border border-[#C49A3A]'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Fixed Flat (₹)
                        </button>
                      </div>
                    </div>

                    {earlyCheckInType === 'hourly' ? (
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-mono uppercase font-bold text-[#7A5915] block">
                          Early Check-In Rate (₹ / Hour) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={earlyCheckInHourlyRate === 0 ? '' : String(earlyCheckInHourlyRate)}
                          placeholder="0"
                          onFocus={e => e.currentTarget.select()}
                          onChange={e => {
                            const d = e.target.value.replace(/[^0-9]/g, '');
                            setEarlyCheckInHourlyRate(d === '' ? 0 : parseInt(d, 10));
                          }}
                          className="w-full px-3 py-2 bg-white border border-[#DFC07A] rounded-xl text-xs font-mono font-extrabold text-[#1F2937] focus:outline-none focus:border-[#C49A3A]"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          Default ₹0 • Current rate: ₹{earlyCheckInHourlyRate.toLocaleString('en-IN')}/hr (editable at check-in)
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[10.5px] font-mono uppercase font-bold text-[#7A5915] block">
                          Fixed Early Check-In Charge (₹) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={earlyCheckInFixedRate === 0 ? '' : String(earlyCheckInFixedRate)}
                          placeholder="0"
                          onFocus={e => e.currentTarget.select()}
                          onChange={e => {
                            const d = e.target.value.replace(/[^0-9]/g, '');
                            setEarlyCheckInFixedRate(d === '' ? 0 : parseInt(d, 10));
                          }}
                          className="w-full px-3 py-2 bg-white border border-[#DFC07A] rounded-xl text-xs font-mono font-extrabold text-[#1F2937] focus:outline-none focus:border-[#C49A3A]"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          Default ₹0 • Flat ₹{earlyCheckInFixedRate.toLocaleString('en-IN')} surcharge for early arrival (editable at check-in)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-luxury-beige-50 p-4 rounded-xl space-y-3 border border-luxury-brown-200">
                <span className="font-serif font-bold text-luxury-brown-950 text-sm block">Automated Status Workflow Rules</span>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox" id="chkDirty"
                    checked={autoMarkDirtyOnCheckout}
                    onChange={e => setAutoMarkDirtyOnCheckout(e.target.checked)}
                    className="rounded text-luxury-gold-500 focus:ring-0"
                  />
                  <label htmlFor="chkDirty" className="text-luxury-brown-800 font-medium cursor-pointer">
                    Automatically change room status to <strong className="text-amber-800 font-mono">Dirty</strong> upon guest check-out
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox" id="chkInspect"
                    checked={requireInspectionToClean}
                    onChange={e => setRequireInspectionToClean(e.target.checked)}
                    className="rounded text-luxury-gold-500 focus:ring-0"
                  />
                  <label htmlFor="chkInspect" className="text-luxury-brown-800 font-medium cursor-pointer">
                    Require Housekeeping Supervisor inspection before marking room <strong className="text-emerald-800 font-mono">Available</strong>
                  </label>
                </div>
              </div>

              {/* 🕒 BACK-DATED CHECK-IN & PAST-TIME ENTRY POLICY */}
              <div className="bg-gradient-to-r from-amber-50/70 via-stone-50 to-amber-50/40 p-4 rounded-xl space-y-3 border border-luxury-gold-200/80 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-serif font-bold text-luxury-brown-950 text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-luxury-gold-600" /> Back-Dated & Past-Time Check-In Policy
                    </span>
                    <p className="text-[11px] text-luxury-brown-600">
                      Enable front desk receptionists to select past arrival dates and retrospective arrival times on check-in & booking forms.
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase shrink-0 ${
                    allowBackDatedCheckIn
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-300'
                  }`}>
                    {allowBackDatedCheckIn ? '● Active' : '○ Disabled'}
                  </span>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="chkAllowBackDated"
                    checked={allowBackDatedCheckIn}
                    onChange={e => setAllowBackDatedCheckIn(e.target.checked)}
                    className="mt-0.5 rounded text-luxury-gold-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chkAllowBackDated" className="text-luxury-brown-900 font-medium cursor-pointer text-xs">
                    <strong>Allow Back-Date & Back-Time Check-In Entries</strong>
                    <span className="block text-[11px] text-luxury-brown-500 mt-0.5 font-normal">
                      When checked, the arrival date picker unlocks past dates (before today) and the arrival time picker allows past timestamps for retrospective guest arrival logging.
                    </span>
                  </label>
                </div>
              </div>

              {/* 🍽️ BACK-DATED FOOD BILLING & RESTAURANT ENTRY POLICY */}
              <div className="bg-gradient-to-r from-amber-50/70 via-stone-50 to-amber-50/40 p-4 rounded-xl space-y-3 border border-luxury-gold-200/80 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-serif font-bold text-luxury-brown-950 text-sm flex items-center gap-1.5">
                      <Utensils className="w-4 h-4 text-luxury-gold-600" /> Back-Dated & Past-Time Food Bill Policy
                    </span>
                    <p className="text-[11px] text-luxury-brown-600">
                      Enable restaurant, room service, and POS billing staff to enter past order dates & times for retroactive food billing.
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase shrink-0 ${
                    allowBackDatedFoodBill
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-300'
                  }`}>
                    {allowBackDatedFoodBill ? '● Active' : '○ Disabled'}
                  </span>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="chkAllowBackDatedFood"
                    checked={allowBackDatedFoodBill}
                    onChange={e => setAllowBackDatedFoodBill(e.target.checked)}
                    className="mt-0.5 rounded text-luxury-gold-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chkAllowBackDatedFood" className="text-luxury-brown-900 font-medium cursor-pointer text-xs">
                    <strong>Allow Back-Date & Back-Time Food Bill Entries</strong>
                    <span className="block text-[11px] text-luxury-brown-500 mt-0.5 font-normal">
                      When checked, POS and food billing forms unlock past dates and times so staff can log previous room service and restaurant orders.
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-luxury-brown-700 font-bold block">Overbooking Protection Margin (%)</label>
                <input
                  type="number" min="0" max="20"
                  value={overbookingLimitPercent}
                  onChange={e => setOverbookingLimitPercent(Number(e.target.value))}
                  className="w-full bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl p-2.5 text-luxury-brown-950 font-mono"
                />
                <span className="text-[10px] text-luxury-brown-400 block">Set to 0% for strict zero-overbooking safety in PMS.</span>
              </div>

              <div className="pt-2 border-t border-luxury-brown-100 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#D4A745] to-[#BE8F2E] hover:from-[#C49837] hover:to-[#A87D24] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Save Module Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT ROOM MODAL FORM (Single + Range + Bulk Multi-Floor) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div
            className={`relative bg-white rounded-3xl border border-[#E5D2A6] shadow-2xl w-full overflow-hidden animate-fade-in max-h-[92vh] flex flex-col transition-all ${
              formMode === 'add' && (addCreationMode === 'range' || addCreationMode === 'bulk')
                ? 'max-w-3xl'
                : 'max-w-lg'
            }`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FFFDF9] to-[#FDF6E3] p-5 flex justify-between items-center border-b border-[#E6D3A7] shrink-0">
              <div>
                <h3 className="text-base font-serif font-bold text-[#1F2937]">
                  {formMode === 'edit'
                    ? `Configure Room ${roomNumber}`
                    : addCreationMode === 'bulk'
                    ? 'Bulk Add Rooms (Multi-Floor Builder)'
                    : addCreationMode === 'range'
                    ? 'Add Room Range (From → To)'
                    : 'Register New Hotel Room Entity'}
                </h3>
                <p className="text-[10px] text-[#9A7120] uppercase tracking-widest font-mono font-bold">
                  {isRestrictedRole
                    ? 'Status Adjustments Only'
                    : formMode === 'add'
                    ? 'Single Room • Room Range • Multi-Floor Bulk Setup'
                    : 'Database Level Room Definition'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-600 hover:bg-white/80 px-2.5 py-1 text-xs rounded-lg cursor-pointer font-semibold border border-transparent hover:border-[#E5D2A6]"
              >
                ✕ Close
              </button>
            </div>

            {/* 3-Tab Mode Switcher (Only in Add Mode) */}
            {formMode === 'add' && !isRestrictedRole && (
              <div className="px-6 pt-3.5 pb-2 bg-[#FFFDF9] border-b border-slate-100 shrink-0">
                <div className="grid grid-cols-3 gap-1.5 bg-[#F6EFE0] p-1 rounded-xl border border-[#E6D3A7]/80">
                  {(
                    [
                      { id: 'single', label: 'Single Room', sub: '1 room' },
                      { id: 'range', label: 'Room Range', sub: 'e.g. 101 → 110' },
                      { id: 'bulk', label: 'Bulk Multi-Floor', sub: 'Floors × Rooms' },
                    ] as const
                  ).map(tab => {
                    const active = addCreationMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setAddCreationMode(tab.id);
                          setFormError('');
                          if (tab.id === 'range') {
                            generateRangeDraftRows(rangeStartNum, rangeEndNum, floor, category, rate);
                          } else if (tab.id === 'bulk') {
                            generateMultiFloorDraftRows(
                              bulkStartRoomNum,
                              bulkNumFloors,
                              bulkRoomsPerFloor,
                              bulkStartFloorNum,
                              bulkNumberingPattern,
                              category,
                              rate
                            );
                          }
                        }}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          active
                            ? 'bg-white text-[#7A5915] shadow-xs border border-[#DFC07A]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="block leading-tight">{tab.label}</span>
                        <span className="block text-[10px] font-mono font-normal opacity-75">{tab.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error messaging */}
            {formError && (
              <div className="bg-rose-50 text-rose-700 text-xs p-3 border-b border-rose-100 font-bold text-center flex items-center justify-center gap-1 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
              </div>
            )}

            {/* Shared Floor Datalist */}
            <datalist id="directstay-floor-presets">
              {knownFloorOptions.map(fl => (
                <option key={fl} value={fl} />
              ))}
            </datalist>

            {/* Form Scrollable Body */}
            <form onSubmit={handleSaveRoom} className="p-6 space-y-4 overflow-y-auto">
              {/* MODE A: SINGLE ROOM OR EDIT MODE */}
              {(formMode === 'edit' || addCreationMode === 'single') && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">
                        Room Number * <span className="text-[10px] font-normal normal-case text-slate-400">(Numbers only)</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        disabled={formMode === 'edit' || isRestrictedRole}
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 101"
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 bg-luxury-beige-50/50 disabled:bg-luxury-brown-100/50 font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">
                        Floor (Custom / Select) *
                      </label>
                      <input
                        type="text"
                        list="directstay-floor-presets"
                        required
                        disabled={isRestrictedRole}
                        value={floor}
                        onChange={e => setFloor(e.target.value)}
                        placeholder="e.g. Ground Floor, 1st Floor, 6th Floor..."
                        className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500 bg-white text-luxury-brown-950 font-semibold"
                      />
                    </div>
                  </div>
                  {!isRestrictedRole && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase mr-0.5">Floors:</span>
                        {knownFloorOptions.map(fl => (
                          <button
                            key={fl}
                            type="button"
                            onClick={() => setFloor(fl)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                              floor === fl
                                ? 'bg-[#FDF6E3] border-[#C49A3A] text-[#7A5915]'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {fl}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <input
                          type="text"
                          value={inlineNewFloor}
                          onChange={e => setInlineNewFloor(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddCustomFloor(inlineNewFloor);
                            }
                          }}
                          placeholder="Add custom floor (e.g. Basement, Mezzanine, 6th Floor, Terrace)"
                          className="flex-1 px-2.5 py-1 border border-dashed border-luxury-brown-300 rounded-lg text-[11px] bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddCustomFloor(inlineNewFloor)}
                          className="px-2.5 py-1 rounded-lg bg-[#FDF6E3] hover:bg-[#F7E8C4] border border-[#DFC07A] text-[#7A5915] text-[10.5px] font-bold cursor-pointer shrink-0"
                        >
                          + Save Floor
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE B: ROOM RANGE (FROM -> TO ON CUSTOM FLOOR) */}
              {formMode === 'add' && addCreationMode === 'range' && (
                <div className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#E5D2A6] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-serif font-bold text-[#263449] block">
                        Generate Rooms by Range (From → To)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Enter starting &amp; ending room numbers and custom floor — edit or remove any room in the list below.
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#7A5915] block">
                        From Room No. *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={rangeStartNum}
                        onChange={e => setRangeStartNum(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 101"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white text-[#1F2937]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#7A5915] block">
                        To Room No. *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={rangeEndNum}
                        onChange={e => setRangeEndNum(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 110"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white text-[#1F2937]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#7A5915] block">
                        Floor Name *
                      </label>
                      <input
                        type="text"
                        list="directstay-floor-presets"
                        value={floor}
                        onChange={e => setFloor(e.target.value)}
                        placeholder="e.g. 1st Floor, Terrace..."
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-semibold bg-white text-[#1F2937]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => generateRangeDraftRows(rangeStartNum, rangeEndNum, floor, category, rate)}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#D4A745] to-[#BE8F2E] hover:from-[#C49837] hover:to-[#A87D24] text-white text-xs font-extrabold cursor-pointer shadow-xs"
                    >
                      Generate List ↓
                    </button>
                  </div>
                </div>
              )}

              {/* MODE C: BULK MULTI-FLOOR GENERATOR */}
              {formMode === 'add' && addCreationMode === 'bulk' && (
                <div className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#E5D2A6] space-y-3">
                  <div>
                    <span className="text-xs font-serif font-bold text-[#263449] block">
                      Bulk Multi-Floor Room Builder
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Enter starting room number, number of floors &amp; rooms per floor — edit any room or remove skipped numbers below.
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#7A5915] block">
                        Starting Room No. *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bulkStartRoomNum}
                        onChange={e => setBulkStartRoomNum(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 101"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white text-[#1F2937]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#7A5915] block">
                        No. of Floors *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bulkNumFloors}
                        onChange={e => setBulkNumFloors(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 3"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white text-[#1F2937]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#7A5915] block">
                        Rooms per Floor *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bulkRoomsPerFloor}
                        onChange={e => setBulkRoomsPerFloor(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 5"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white text-[#1F2937]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#7A5915] block">
                        Start Floor (0=Ground)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bulkStartFloorNum}
                        onChange={e => setBulkStartFloorNum(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 1 (or 0)"
                        className="w-full px-3 py-2 border border-[#DCE3EC] rounded-xl text-xs font-mono font-bold bg-white text-[#1F2937]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="inline-flex items-center gap-1.5 text-[11px]">
                      <span className="font-bold text-slate-600">Pattern:</span>
                      <button
                        type="button"
                        onClick={() => setBulkNumberingPattern('floor_series')}
                        className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                          bulkNumberingPattern === 'floor_series'
                            ? 'bg-[#FDF6E3] border-[#C49A3A] text-[#7A5915]'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        Floor-wise (101, 201, 301...)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkNumberingPattern('sequential')}
                        className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                          bulkNumberingPattern === 'sequential'
                            ? 'bg-[#FDF6E3] border-[#C49A3A] text-[#7A5915]'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        Sequential (101, 102, 103...)
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        generateMultiFloorDraftRows(
                          bulkStartRoomNum,
                          bulkNumFloors,
                          bulkRoomsPerFloor,
                          bulkStartFloorNum,
                          bulkNumberingPattern,
                          category,
                          rate
                        )
                      }
                      className="py-2 px-4 rounded-xl bg-gradient-to-r from-[#D4A745] to-[#BE8F2E] hover:from-[#C49837] hover:to-[#A87D24] text-white text-xs font-extrabold cursor-pointer shadow-xs"
                    >
                      Generate Room List ↓
                    </button>
                  </div>
                </div>
              )}

              {/* EDITABLE GENERATED ROOMS LIST (Range & Bulk Modes) */}
              {formMode === 'add' && (addCreationMode === 'range' || addCreationMode === 'bulk') && (() => {
                const existingNums = new Set(rooms.map(r => String(r.number).trim()));
                const batchCounts = new Map<string, number>();
                bulkDraftRows.forEach(r => {
                  const k = String(r.number || '').trim();
                  if (k) batchCounts.set(k, (batchCounts.get(k) || 0) + 1);
                });
                const existingSkipCount = bulkDraftRows.filter(r => {
                  const k = String(r.number || '').trim();
                  return Boolean(k && existingNums.has(k));
                }).length;
                const batchDupCount = bulkDraftRows.filter(r => {
                  const k = String(r.number || '').trim();
                  return Boolean(k && !existingNums.has(k) && (batchCounts.get(k) || 0) > 1);
                }).length;
                const invalidCount = bulkDraftRows.filter(r => {
                  const k = String(r.number || '').trim();
                  const isSkipped = Boolean(k && existingNums.has(k));
                  if (isSkipped) return false;
                  return !k || !String(r.floor || '').trim() || !String(r.category || '').trim() || Number(r.rate) <= 0;
                }).length;
                const readyCount = bulkDraftRows.filter(r => {
                  const k = String(r.number || '').trim();
                  return (
                    k &&
                    !existingNums.has(k) &&
                    (batchCounts.get(k) || 0) === 1 &&
                    Boolean(String(r.floor || '').trim()) &&
                    Boolean(String(r.category || '').trim()) &&
                    Number(r.rate) > 0
                  );
                }).length;
                const allCategoryChoices = Array.from(
                  new Set([
                    ...categories.map(c => c.name),
                    ...bulkDraftRows.map(r => String(r.category || '').trim()).filter(Boolean),
                    'Standard',
                    'Deluxe',
                    'Executive',
                    'Suite',
                  ])
                );

                return (
                  <div className="rounded-2xl border border-[#E5D2A6] bg-white overflow-hidden shadow-2xs">
                    <div className="px-4 py-2.5 bg-[#FBF6E9] border-b border-[#E5D2A6] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-serif font-bold text-[#263449]">
                          Generated Rooms Preview ({bulkDraftRows.length})
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold">
                          {readyCount} Ready
                        </span>
                        {existingSkipCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold">
                            {existingSkipCount} Existing (Skip)
                          </span>
                        )}
                        {batchDupCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-mono font-bold">
                            {batchDupCount} Duplicate
                          </span>
                        )}
                        {invalidCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-mono font-bold">
                            {invalidCount} Incomplete
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setBulkDraftRows(prev =>
                              prev.map(r => ({
                                ...r,
                                floor: addCreationMode === 'range' && floor.trim() ? floor.trim() : r.floor,
                                category: category.trim() || r.category,
                                rate: Number(rate) > 0 ? Number(rate) : r.rate,
                              }))
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#FDF6E3] border border-[#DFC07A] text-[#7A5915] text-[10.5px] font-bold cursor-pointer"
                          title="Explicitly apply default Category, Base Price (and Floor in Range mode) to all preview rows"
                        >
                          Apply Defaults to All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const last = bulkDraftRows[bulkDraftRows.length - 1];
                            const nextNum = last && /^\d+$/.test(last.number) ? String(parseInt(last.number, 10) + 1) : '';
                            setBulkDraftRows(prev => [
                              ...prev,
                              {
                                draftId: `man-${Date.now()}-${prev.length}`,
                                number: nextNum,
                                floor: last?.floor || floor || knownFloorOptions[0] || '1st Floor',
                                category: category.trim() || categories[0]?.name || 'Standard',
                                rate: Number(rate) || categories[0]?.rate || 2000,
                              },
                            ]);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10.5px] font-bold cursor-pointer"
                        >
                          + Add Row
                        </button>
                      </div>
                    </div>

                    {bulkDraftRows.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Enter your range or floor counts above and click <strong>Generate List ↓</strong> to preview, edit, or remove rooms.
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-50 text-[10px] font-mono font-bold uppercase text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                          <span className="col-span-2">Room No.</span>
                          <span className="col-span-3">Floor</span>
                          <span className="col-span-3">Category / Type</span>
                          <span className="col-span-3 text-right">Base Price (₹)</span>
                          <span className="col-span-1 text-center">Del</span>
                        </div>
                        {bulkDraftRows.map(row => {
                          const cleanN = String(row.number || '').trim();
                          const isExistingDup = Boolean(cleanN && existingNums.has(cleanN));
                          const isBatchDup = Boolean(cleanN && (batchCounts.get(cleanN) || 0) > 1);
                          const isInvalidRow = !isExistingDup && (!cleanN || !String(row.floor || '').trim() || !String(row.category || '').trim() || Number(row.rate) <= 0);
                          return (
                            <div
                              key={row.draftId}
                              className={`grid grid-cols-12 gap-2 px-3 py-1.5 items-center text-xs ${
                                isExistingDup
                                  ? 'bg-amber-50/70'
                                  : isBatchDup || isInvalidRow
                                  ? 'bg-rose-50/70'
                                  : 'hover:bg-[#FFFDF7]'
                              }`}
                            >
                              <div className="col-span-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={row.number}
                                  placeholder="e.g. 101"
                                  onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '');
                                    setBulkDraftRows(prev =>
                                      prev.map(item =>
                                        item.draftId === row.draftId ? { ...item, number: digits } : item
                                      )
                                    );
                                  }}
                                  className={`w-full px-2 py-1 border rounded-lg font-mono font-bold text-xs bg-white ${
                                    isExistingDup || isBatchDup || !cleanN
                                      ? 'border-rose-400 text-rose-800'
                                      : 'border-slate-200 text-[#1F2937]'
                                  }`}
                                />
                                {isExistingDup && (
                                  <span className="text-[9px] text-amber-700 font-bold block leading-tight mt-0.5">
                                    Exists (skip)
                                  </span>
                                )}
                                {!isExistingDup && isBatchDup && (
                                  <span className="text-[9px] text-rose-700 font-bold block leading-tight mt-0.5">
                                    Duplicate
                                  </span>
                                )}
                                {!cleanN && (
                                  <span className="text-[9px] text-rose-600 font-bold block leading-tight mt-0.5">
                                    Required
                                  </span>
                                )}
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="text"
                                  list="directstay-floor-presets"
                                  value={row.floor}
                                  placeholder="e.g. 1st Floor"
                                  onChange={e => {
                                    const val = e.target.value;
                                    setBulkDraftRows(prev =>
                                      prev.map(item =>
                                        item.draftId === row.draftId ? { ...item, floor: val } : item
                                      )
                                    );
                                  }}
                                  className={`w-full px-2 py-1 border rounded-lg text-xs bg-white text-[#1F2937] ${
                                    !String(row.floor || '').trim() ? 'border-rose-400' : 'border-slate-200'
                                  }`}
                                />
                              </div>
                              <div className="col-span-3">
                                <select
                                  value={row.category}
                                  onChange={e => {
                                    const nextCat = e.target.value;
                                    const matchedCat = categories.find(c => c.name === nextCat);
                                    setBulkDraftRows(prev =>
                                      prev.map(item =>
                                        item.draftId === row.draftId
                                          ? {
                                              ...item,
                                              category: nextCat,
                                              rate: matchedCat && matchedCat.rate > 0 ? matchedCat.rate : item.rate,
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                  className={`w-full px-2 py-1 border rounded-lg text-xs bg-white text-[#1F2937] font-medium ${
                                    !String(row.category || '').trim() ? 'border-rose-400' : 'border-slate-200'
                                  }`}
                                >
                                  {allCategoryChoices.map(catOpt => (
                                    <option key={catOpt} value={catOpt}>{catOpt}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={row.rate === 0 ? '' : String(row.rate)}
                                  placeholder="2000"
                                  onChange={e => {
                                    const d = e.target.value.replace(/[^0-9]/g, '');
                                    setBulkDraftRows(prev =>
                                      prev.map(item =>
                                        item.draftId === row.draftId
                                          ? { ...item, rate: d === '' ? 0 : parseInt(d, 10) }
                                          : item
                                      )
                                    );
                                  }}
                                  className={`w-full px-2 py-1 border rounded-lg font-mono font-bold text-xs text-right bg-white text-[#1F2937] ${
                                    Number(row.rate) <= 0 ? 'border-rose-400 text-rose-700' : 'border-slate-200'
                                  }`}
                                />
                              </div>
                              <div className="col-span-1 flex justify-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBulkDraftRows(prev => prev.filter(item => item.draftId !== row.draftId))
                                  }
                                  className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer"
                                  title={`Remove Room ${row.number || ''} from batch`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Category / Type *</label>
                    {categories.length > 0 && !isRestrictedRole && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isCustomCategoryMode) {
                            setIsCustomCategoryMode(false);
                            if (!category.trim() && categories[0]) {
                              handleCategoryChangeInForm(categories[0].name);
                            }
                          } else {
                            setIsCustomCategoryMode(true);
                            setCategory('');
                          }
                        }}
                        className="text-[10px] font-bold text-[#C49A3A] hover:underline cursor-pointer"
                      >
                        {isCustomCategoryMode ? '← Choose Existing' : '+ New Category'}
                      </button>
                    )}
                  </div>
                  {categories.length > 0 && !isCustomCategoryMode ? (
                    <select
                      required={formMode === 'edit' || addCreationMode === 'single'}
                      disabled={isRestrictedRole}
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW_CATEGORY__') {
                          setIsCustomCategoryMode(true);
                          setCategory('');
                          return;
                        }
                        handleCategoryChangeInForm(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500 bg-white text-luxury-brown-950 font-semibold"
                    >
                      {!categories.some(cat => cat.name === category) && category && (
                        <option value={category}>{category}</option>
                      )}
                      {categories.map(cat => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name} (₹{cat.rate.toLocaleString('en-IN')}/Night)
                        </option>
                      ))}
                      <option value="__ADD_NEW_CATEGORY__">+ Add New Custom Category...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required={formMode === 'edit' || addCreationMode === 'single'}
                      disabled={isRestrictedRole}
                      value={category}
                      onChange={(e) => handleCategoryChangeInForm(e.target.value)}
                      placeholder="Type new category name (e.g. Royal Suite)"
                      className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500 bg-white text-luxury-brown-950 font-semibold"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Bed Type</label>
                  <select
                    disabled={isRestrictedRole}
                    value={bedType}
                    onChange={e => setBedType(e.target.value)}
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500 bg-white text-luxury-brown-950"
                  >
                    <option value="King Size Bed">King Size Bed</option>
                    <option value="Queen Size Bed">Queen Size Bed</option>
                    <option value="Double Bed">Double Bed</option>
                    <option value="Twin Beds">Twin Beds</option>
                    <option value="Suite Bedding">Suite Bedding</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">Base Price (₹ / Night) *</label>
                <input
                  type="text" inputMode="numeric" required={formMode === 'edit' || addCreationMode === 'single'} placeholder="0"
                  disabled={isRestrictedRole}
                  value={rate === 0 ? '' : String(rate)}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const d = e.target.value.replace(/[^0-9]/g, '');
                    setRate(d === '' ? 0 : parseInt(d, 10));
                  }}
                  className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs focus:outline-none focus:border-luxury-gold-500 text-luxury-brown-950 font-mono font-bold"
                />
              </div>

              <div className="bg-luxury-beige-100/30 p-3.5 rounded-2xl border border-luxury-gold-500/10 space-y-3">
                <span className="text-[11px] uppercase font-mono tracking-wider font-bold text-luxury-brown-700 block">Occupancy Capacity</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-luxury-brown-600 block uppercase font-bold">Base Occ</label>
                    <input
                      type="text" inputMode="numeric" required placeholder="2" disabled={isRestrictedRole}
                      value={baseOccupancy === 0 ? '' : String(baseOccupancy)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const d = e.target.value.replace(/[^0-9]/g, '');
                        setBaseOccupancy(d === '' ? 0 : parseInt(d, 10));
                      }}
                      className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-950"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-luxury-brown-600 block uppercase font-bold">Max Occ</label>
                    <input
                      type="text" inputMode="numeric" required placeholder="3" disabled={isRestrictedRole}
                      value={maxOccupancy === 0 ? '' : String(maxOccupancy)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const d = e.target.value.replace(/[^0-9]/g, '');
                        setMaxOccupancy(d === '' ? 0 : parseInt(d, 10));
                      }}
                      className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-950"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-luxury-brown-600 block uppercase font-bold">Extra Pax Fee</label>
                    <input
                      type="text" inputMode="numeric" placeholder="0" disabled={isRestrictedRole}
                      value={extraPersonCharge === 0 ? '' : String(extraPersonCharge)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const d = e.target.value.replace(/[^0-9]/g, '');
                        setExtraPersonCharge(d === '' ? 0 : parseInt(d, 10));
                      }}
                      className="w-full px-2 py-1.5 border border-luxury-brown-200 rounded-lg text-xs font-mono bg-white text-luxury-brown-950"
                    />
                  </div>
                </div>
              </div>

              {/* Extra Bed Capability Configuration */}
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-mono text-amber-950 block uppercase font-bold">
                      Extra Bed / Mattress Allowed?
                    </label>
                    <span className="text-[10px] text-amber-800/80 block">
                      Does this room physically have space to fit an extra mattress/bed?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <button
                      type="button"
                      disabled={isRestrictedRole}
                      onClick={() => setAllowExtraBed(true)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        allowExtraBed
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ✓ Yes (Allowed)
                    </button>
                    <button
                      type="button"
                      disabled={isRestrictedRole}
                      onClick={() => setAllowExtraBed(false)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        !allowExtraBed
                          ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ✕ No (Small Room)
                    </button>
                  </div>
                </div>
              </div>

              {/* In-Room Amenities Checklist */}
              <div className="space-y-2 bg-luxury-beige-50 p-3.5 rounded-2xl border border-luxury-brown-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold">In-Room Amenities</label>
                  <span className="text-[10px] text-luxury-gold-700 font-bold">{selectedRoomAmenities.length} selected</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto text-xs p-1">
                  {amenities.map(am => (
                    <label key={am.id} className="flex items-center gap-1.5 text-[11px] text-luxury-brown-900 cursor-pointer hover:text-black">
                      <input
                        type="checkbox"
                        checked={selectedRoomAmenities.includes(am.name)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedRoomAmenities([...selectedRoomAmenities, am.name]);
                          } else {
                            setSelectedRoomAmenities(selectedRoomAmenities.filter(a => a !== am.name));
                          }
                        }}
                        className="rounded text-luxury-gold-500 focus:ring-0"
                      />
                      <span>{am.name}</span>
                    </label>
                  ))}
                </div>

                {/* Custom Amenity Adder */}
                <div className="pt-2 border-t border-luxury-brown-200/60 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add custom amenity (e.g. Jacuzzi, Smart TV)..."
                    value={customAmenityInput}
                    onChange={(e) => setCustomAmenityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomAmenityToRoom();
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-luxury-brown-200 rounded-lg bg-white text-luxury-brown-950 focus:ring-1 focus:ring-luxury-gold-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAmenityToRoom}
                    className="px-3 py-1.5 bg-luxury-gold-500 hover:bg-luxury-gold-400 text-luxury-brown-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Room Photo Upload & Optional URL */}
              <div className="space-y-2.5 bg-luxury-beige-50/70 p-3.5 rounded-2xl border border-luxury-brown-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-luxury-brown-800 block uppercase font-bold">
                    Room Photo / Picture
                  </label>
                  {roomImages && !isRestrictedRole && (
                    <button
                      type="button"
                      onClick={() => setRoomImages('')}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove Photo
                    </button>
                  )}
                </div>

                {roomImages && (
                  <div className="relative rounded-xl overflow-hidden border border-luxury-brown-200 bg-black/5 h-36">
                    <img
                      src={roomImages}
                      alt="Room Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                  <label className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FDF6E3] hover:bg-[#F5E7C1] text-[#7A5915] border border-[#DFC07A] rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs text-center">
                    <ImageIcon className="w-4 h-4 text-[#B5822D] shrink-0" />
                    <span>{roomImages ? 'Change Room Photo' : 'Upload Room Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isRestrictedRole}
                      onChange={handleRoomImageFileUpload}
                      className="hidden"
                    />
                  </label>

                  <input
                    type="text"
                    disabled={isRestrictedRole}
                    value={roomImages.startsWith('data:image/') ? '' : roomImages}
                    onChange={e => setRoomImages(e.target.value)}
                    placeholder="Or paste image URL (https://...)"
                    className="w-full px-3 py-2 border border-luxury-brown-200 rounded-xl text-xs bg-white text-luxury-brown-950 focus:outline-none focus:border-luxury-gold-500"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1 bg-luxury-beige-100/30 p-3 rounded-2xl border border-luxury-gold-500/10">
                <label className="text-xs font-mono text-luxury-brown-600 block uppercase font-bold mb-1.5">Initial Operational PMS Status</label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {['Available', 'Occupied', 'Reserved', 'Maintenance', 'Dirty', 'Clean', 'Inspection', 'Out of Order', 'Blocked'].map((st) => (
                    <label 
                      key={st}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer font-bold text-[10px] ${
                        status === st 
                          ? 'border-luxury-gold-500 bg-luxury-gold-500/10 text-luxury-brown-950' 
                          : 'border-luxury-brown-200 bg-white text-luxury-brown-600 hover:bg-luxury-beige-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="room_status_modal_radio"
                        checked={status === st}
                        onChange={() => setStatus(st as RoomStatus)}
                        className="hidden"
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(status === 'Out of Order' || status === 'Maintenance' || status === 'Blocked') && (
                <div className="space-y-1">
                  <label className="text-xs font-mono text-rose-800 block uppercase font-bold">Reason for Out of Order / Block</label>
                  <input
                    type="text"
                    value={outOfOrderReason}
                    onChange={e => setOutOfOrderReason(e.target.value)}
                    placeholder="e.g. AC Repair / Plumbing leakage"
                    className="w-full px-3 py-2 border border-rose-300 bg-rose-50 rounded-xl text-xs text-rose-950"
                  />
                </div>
              )}

              <div className="flex gap-2.5 justify-end pt-3 border-t border-luxury-brown-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#D4A745] to-[#BE8F2E] hover:from-[#C49837] hover:to-[#A87D24] text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  {(() => {
                    if (formMode === 'add' && (addCreationMode === 'range' || addCreationMode === 'bulk')) {
                      const existingSet = new Set(rooms.map(r => String(r.number).trim()));
                      const counts = new Map<string, number>();
                      bulkDraftRows.forEach(r => {
                        const k = String(r.number || '').trim();
                        if (k) counts.set(k, (counts.get(k) || 0) + 1);
                      });
                      const validCnt = bulkDraftRows.filter(r => {
                        const k = String(r.number || '').trim();
                        return k && !existingSet.has(k) && (counts.get(k) || 0) === 1 && Number(r.rate) > 0;
                      }).length;
                      return `Create ${validCnt} Valid Room${validCnt === 1 ? '' : 's'}`;
                    }
                    return 'Save Room Entity';
                  })()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- QUICK ROOM STATUS SWITCH / BLOCK MODAL --- */}
      {selectedRoomForStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-luxury-gold-500/30 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-serif font-bold text-luxury-brown-950 text-base">Quick Status Update • Room {selectedRoomForStatus.number}</h3>
                <p className="text-xs text-luxury-brown-500">Current Status: <strong>{selectedRoomForStatus.status}</strong></p>
              </div>
              <button onClick={() => setSelectedRoomForStatus(null)} className="text-luxury-brown-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-luxury-brown-800 block">Select Operational Status</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  onClick={() => handleUpdateRoomStatusDirect(selectedRoomForStatus.id, 'Available', 'Clean')}
                  className="p-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-left border border-emerald-300"
                >
                  ✓ Available & Clean
                </button>
                <button
                  onClick={() => handleUpdateRoomStatusDirect(selectedRoomForStatus.id, 'Dirty', 'Dirty')}
                  className="p-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-left border border-amber-300"
                >
                  🧹 Dirty (Needs Housekeeping)
                </button>
                <button
                  onClick={() => handleUpdateRoomStatusDirect(selectedRoomForStatus.id, 'Inspection', 'Needs Inspection')}
                  className="p-2.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-left border border-purple-300"
                >
                  🔍 Ready For Inspection
                </button>
                <button
                  onClick={() => handleUpdateRoomStatusDirect(selectedRoomForStatus.id, 'Maintenance', 'In Progress', 'Scheduled Maintenance')}
                  className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 rounded-xl text-left border border-amber-300"
                >
                  🛠 Maintenance
                </button>
                <button
                  onClick={() => handleUpdateRoomStatusDirect(selectedRoomForStatus.id, 'Out of Order', 'Dirty', blockReasonInput || 'Out of Order')}
                  className="p-2.5 bg-red-100 hover:bg-red-200 text-red-950 rounded-xl text-left border border-red-300"
                >
                  ⚠️ Out of Order (OOO)
                </button>
                <button
                  onClick={() => handleUpdateRoomStatusDirect(selectedRoomForStatus.id, 'Blocked', 'Clean', blockReasonInput || 'Blocked for VIP')}
                  className="p-2.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 rounded-xl text-left border border-zinc-400"
                >
                  🔒 Block Room
                </button>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <label className="text-[10px] font-bold text-luxury-brown-600 uppercase block">Block / Maintenance Reason Note</label>
              <input
                type="text"
                value={blockReasonInput}
                onChange={e => setBlockReasonInput(e.target.value)}
                placeholder="Optional reason e.g. Plumbing issue / VIP hold"
                className="w-full bg-luxury-beige-50 border rounded-xl p-2 text-xs text-luxury-brown-950"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedRoomForStatus(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-xl text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ROOM QR CODE DOWNLOAD & PRINT MODAL --- */}
      {qrModalRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-luxury-brown-200 space-y-5 text-center">
            <div className="flex justify-between items-center border-b border-luxury-brown-100 pb-3">
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold-600 block">
                  Smart Room QR Standee
                </span>
                <h3 className="text-lg font-serif font-bold text-luxury-brown-900">
                  Room {qrModalRoom.number} — {qrModalRoom.category || (qrModalRoom as any).type || 'Room'}
                </h3>
              </div>
              <button
                onClick={() => setQrModalRoom(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(() => {
              const targetHotelId = qrModalRoom.hotelId || activeHotelId;
              const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?hotelBooking=${encodeURIComponent(targetHotelId)}&room=${encodeURIComponent(qrModalRoom.number)}`;
              const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(bookingUrl)}`;
              return (
                <>
                  <div id="printable-room-qr-card" className="bg-luxury-beige-50/70 border-2 border-dashed border-luxury-gold-400/60 rounded-2xl p-6 flex flex-col items-center space-y-3">
                    <div className="px-3 py-1 rounded-full bg-luxury-brown-950 text-luxury-gold-400 text-[10px] font-bold uppercase tracking-widest">
                      {hotelSettings?.name || 'Hotel Direct Check-In & Service'}
                    </div>
                    <div className="text-2xl font-serif font-bold text-luxury-brown-950">
                      ROOM {qrModalRoom.number}
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-md border border-luxury-brown-100">
                      <img
                        src={qrImgUrl}
                        alt={`QR Code Room ${qrModalRoom.number}`}
                        className="w-48 h-48 object-contain mx-auto"
                        crossOrigin="anonymous"
                      />
                    </div>
                    <p className="text-xs font-bold text-luxury-brown-800 max-w-xs">
                      Scan this QR Code with your phone camera for Direct Guest Check-In, Room Availability & Express Services
                    </p>
                    <span className="text-[10px] font-mono text-luxury-brown-500 break-all px-2">
                      {bookingUrl}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <a
                      href={qrImgUrl}
                      download={`Room-${qrModalRoom.number}-QR.png`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2.5 px-4 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" /> Download QR
                    </a>
                    <button
                      onClick={() => window.print()}
                      className="py-2.5 px-4 bg-luxury-brown-950 hover:bg-black text-luxury-gold-400 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Print QR Standee
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* --- ROOM DETAILS & ACTIVE GUEST VIEW MODAL --- */}
      {viewRoomDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-luxury-brown-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-luxury-brown-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold-600 bg-luxury-gold-50 px-2 py-0.5 rounded-full border border-luxury-gold-200">
                    Room Overview & Inspection
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    viewRoomDetails.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                    viewRoomDetails.status === 'Occupied' ? 'bg-rose-100 text-rose-800' :
                    viewRoomDetails.status === 'Reserved' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {viewRoomDetails.status}
                  </span>
                </div>
                <h3 className="text-2xl font-serif font-bold text-luxury-brown-950 mt-1">
                  Room {viewRoomDetails.number} — {viewRoomDetails.category || (viewRoomDetails as any).type || 'Standard'}
                </h3>
                <p className="text-xs text-luxury-brown-500">
                  Floor: {viewRoomDetails.floor || '1st Floor'} • Bed: {viewRoomDetails.bedType || 'King Bed'} • Tariff: ₹{(viewRoomDetails.rate || 0).toLocaleString('en-IN')}/night
                </p>
              </div>
              <button
                onClick={() => setViewRoomDetails(null)}
                className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Room Photo Gallery if present */}
            {viewRoomDetails.images && viewRoomDetails.images.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-luxury-brown-600">Room Photos</span>
                <div className="grid grid-cols-3 gap-2">
                  {viewRoomDetails.images.slice(0, 3).map((img, idx) => (
                    <div key={idx} className="h-28 rounded-xl overflow-hidden border border-luxury-brown-200 bg-slate-100">
                      <img src={img} alt={`Room ${viewRoomDetails.number} photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Room Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-luxury-beige-50/60 p-4 rounded-2xl border border-luxury-beige-200">
              <div className="bg-white p-3 rounded-xl border border-luxury-brown-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-luxury-brown-400 block">Nightly Tariff</span>
                <span className="text-base font-bold font-serif text-luxury-brown-900">₹{(viewRoomDetails.rate || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-luxury-brown-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-luxury-brown-400 block">Housekeeping</span>
                <span className={`text-sm font-bold block ${viewRoomDetails.cleaningStatus === 'Dirty' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {viewRoomDetails.cleaningStatus || 'Clean'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-luxury-brown-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-luxury-brown-400 block">Occupancy</span>
                <span className="text-sm font-bold text-luxury-brown-900">
                  {viewRoomDetails.baseOccupancy || 2} Base / {viewRoomDetails.maxOccupancy || 3} Max
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-luxury-brown-100 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-luxury-brown-400 block">Extra Bed</span>
                <span className={`text-sm font-bold block ${viewRoomDetails.allowExtraBed !== false ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {viewRoomDetails.allowExtraBed !== false ? `Allowed (+₹${viewRoomDetails.extraPersonCharge || 500})` : 'Not Allowed'}
                </span>
              </div>
            </div>

            {/* Active Guest Info if Occupied or Booked */}
            {(() => {
              const activeBooking = bookings?.find(b =>
                (b.status === 'Checked-In' || b.status === 'Confirmed') &&
                (b.roomNumber === viewRoomDetails.number || (Array.isArray((b as any).assignedRooms) && (b as any).assignedRooms.includes(viewRoomDetails.number)))
              );

              if (activeBooking) {
                return (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h4 className="font-serif font-bold text-sm text-luxury-brown-950">
                          Active In-House Guest Details
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {activeBooking.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-luxury-brown-500 uppercase font-bold block">Guest Name</span>
                        <span className="font-bold text-luxury-brown-900">{activeBooking.guestName || 'Guest'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-luxury-brown-500 uppercase font-bold block">Contact</span>
                        <span className="font-bold text-luxury-brown-900">{activeBooking.mobile || activeBooking.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-luxury-brown-500 uppercase font-bold block">Booking ID</span>
                        <span className="font-mono text-luxury-gold-700 font-bold">{activeBooking.id}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-luxury-brown-500 uppercase font-bold block">Stay Dates</span>
                        <span className="font-medium text-slate-700">{activeBooking.checkInDate} to {activeBooking.checkOutDate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-luxury-brown-500 uppercase font-bold block">Advance Paid</span>
                        <span className="font-bold text-emerald-700">₹{(activeBooking.advanceAmount || (activeBooking as any).advancePaid || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-luxury-brown-500 uppercase font-bold block">Total Amount</span>
                        <span className="font-bold text-luxury-brown-900">₹{(activeBooking.bookingAmount || (activeBooking as any).totalAmount || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center text-xs text-slate-500">
                  No active stay or booking assigned to Room {viewRoomDetails.number} right now. Room is ready for assignment.
                </div>
              );
            })()}

            {/* Amenities Library */}
            {viewRoomDetails.amenities && viewRoomDetails.amenities.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-luxury-brown-600 block">
                  Configured Amenities
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {viewRoomDetails.amenities.map((am, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-luxury-beige-100 text-luxury-brown-900 text-xs font-medium border border-luxury-brown-200">
                      <Check className="w-3 h-3 text-emerald-600" /> {am}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-luxury-brown-100">
              <button
                onClick={() => setViewRoomDetails(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const r = viewRoomDetails;
                    setViewRoomDetails(null);
                    setSelectedRoomForStatus(r);
                  }}
                  className="px-4 py-2 bg-luxury-brown-900 hover:bg-black text-luxury-gold-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Update Status
                </button>
                {!isRestrictedRole && (
                  <button
                    onClick={() => {
                      const r = viewRoomDetails;
                      setViewRoomDetails(null);
                      handleEditRoomClick(r);
                    }}
                    className="px-4 py-2 bg-luxury-gold-500 hover:bg-luxury-gold-600 text-luxury-brown-950 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Edit Room
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
