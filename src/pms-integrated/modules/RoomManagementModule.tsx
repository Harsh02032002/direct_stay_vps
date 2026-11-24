import React, { useState } from 'react';
import {
  BedDouble,
  Plus,
  QrCode,
  Ban,
  Calendar,
  IndianRupee,
  History,
  CheckCircle2,
  X,
  Sparkles,
  Layers,
  Trash2,
  Sliders,
  Edit2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  AssetGroup,
  MealPlanType,
  PriceHistoryRecord,
  RoomAsset,
  RoomBlockRecord,
} from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface RoomManagementModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  rooms: RoomAsset[];
  assetGroups: AssetGroup[];
  roomBlocks: RoomBlockRecord[];
  priceHistory: PriceHistoryRecord[];
  onToggleRoomLive: (roomId: string) => void;
  onAddRoomAsset: (newRoom: RoomAsset) => void;
  onUpdateRoomAsset?: (updatedRoom: RoomAsset) => void;
  onDeleteRoomAsset?: (roomId: string) => void;
  onAddAssetGroup: (newGroup: AssetGroup) => void;
  onAddRoomBlock: (newBlock: RoomBlockRecord) => void;
  onRemoveRoomBlock: (blockId: string) => void;
  onApplyBulkPrice: (record: PriceHistoryRecord) => void;
  calendarNode?: React.ReactNode;
}

const DEFAULT_AMENITIES_LIST = [
  'AC',
  'High-Speed Wi-Fi',
  '4K Smart TV',
  '24x7 Hot Geyser',
  'Tea / Coffee Kettle',
  'Mini Fridge',
  'Electronic Safe',
  'Work Desk & Chair',
  'Complimentary Water',
  'Balcony View',
];

const SUB_TABS = [
  { id: 'dashboard', label: 'Assets (All Rooms)' },
  { id: 'categories', label: 'Asset Groups & Plans' },
  { id: 'blockAssets', label: 'Block Assets' },
  { id: 'availability', label: 'Room Calendar Matrix' },
  { id: 'priceHistory', label: 'Bulk Pricing & History' },
  { id: 'amenities', label: 'Room Amenities' },
  { id: 'status', label: 'Live Status Board' },
  { id: 'settings', label: 'Tariff Rules' },
];

export const RoomManagementModule: React.FC<RoomManagementModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  rooms,
  assetGroups,
  roomBlocks,
  priceHistory,
  onToggleRoomLive,
  onAddRoomAsset,
  onUpdateRoomAsset,
  onDeleteRoomAsset,
  onAddAssetGroup,
  onAddRoomBlock,
  onRemoveRoomBlock,
  onApplyBulkPrice,
  calendarNode,
}) => {
  const [qrRoom, setQrRoom] = useState<RoomAsset | null>(null);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);

  // Full Add/Edit Room Asset Form State (All Original Fields)
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState(() => assetGroups[0]?.name || 'Standard');
  const [newRoomFloor, setNewRoomFloor] = useState('1st Floor');
  const [newRoomBedType, setNewRoomBedType] = useState('King Size Bed');
  const [newRoomRate, setNewRoomRate] = useState(2000);
  const [newRoomMealsRate, setNewRoomMealsRate] = useState(2500);
  const [newRoomOccupancy, setNewRoomOccupancy] = useState(2);
  const [newRoomMaxOccupancy, setNewRoomMaxOccupancy] = useState(3);
  const [newRoomExtraPaxFee, setNewRoomExtraPaxFee] = useState(500);
  const [newRoomAmenities, setNewRoomAmenities] = useState<string[]>(['AC', 'High-Speed Wi-Fi', '4K Smart TV', '24x7 Hot Geyser']);
  const [customAmenityInput, setCustomAmenityInput] = useState('');
  const [newRoomImage, setNewRoomImage] = useState('');
  const [newRoomStatus, setNewRoomStatus] = useState<RoomAsset['status']>('Available');
  const [newRoomBlockedReason, setNewRoomBlockedReason] = useState('');
  const [newRoomAllowExtraBed, setNewRoomAllowExtraBed] = useState<boolean>(true);

  const openAddRoomModal = () => {
    setEditingRoomId(null);
    setNewRoomNumber('');
    const defaultGrp = assetGroups[0];
    setNewRoomCategory(defaultGrp?.name || 'Standard');
    setNewRoomFloor('1st Floor');
    setNewRoomBedType('King Size Bed');
    setNewRoomRate(defaultGrp?.basePrice || 2000);
    setNewRoomMealsRate((defaultGrp?.basePrice || 2000) + 500);
    setNewRoomOccupancy(2);
    setNewRoomMaxOccupancy(3);
    setNewRoomExtraPaxFee(500);
    setNewRoomAllowExtraBed(true);
    setNewRoomAmenities(['AC', 'High-Speed Wi-Fi', '4K Smart TV', '24x7 Hot Geyser']);
    setNewRoomImage('');
    setNewRoomStatus('Available');
    setNewRoomBlockedReason('');
    setShowAddAssetModal(true);
  };

  const openEditRoomModal = (room: RoomAsset) => {
    setEditingRoomId(room.id);
    setNewRoomNumber(room.number);
    setNewRoomCategory(room.category);
    setNewRoomFloor(room.floor || '1st Floor');
    setNewRoomBedType(room.bedType || 'King Size Bed');
    setNewRoomRate(room.rate);
    setNewRoomMealsRate(room.mealsRate || room.rate + 500);
    setNewRoomOccupancy(room.baseOccupancy || 2);
    setNewRoomMaxOccupancy(room.maxOccupancy || 3);
    setNewRoomExtraPaxFee(room.extraPersonCharge ?? 500);
    setNewRoomAllowExtraBed(room.allowExtraBed !== false);
    setNewRoomAmenities(Array.isArray(room.amenities) && room.amenities.length > 0 ? room.amenities : ['AC', 'High-Speed Wi-Fi']);
    setNewRoomImage(room.images?.[0] || '');
    setNewRoomStatus(room.status || 'Available');
    setNewRoomBlockedReason(room.blockedReason || '');
    setShowAddAssetModal(true);
  };

  const handleRoomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewRoomImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Asset Group Form
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [pricingMode, setPricingMode] = useState<'Match Pricing' | 'Diff Pricing'>('Diff Pricing');
  const [onlyRoomsPrice, setOnlyRoomsPrice] = useState(2000);
  const [mealsPrice, setMealsPrice] = useState(2500);
  const [epSgPrice, setEpSgPrice] = useState(1800);

  // Block Asset Form
  const [blockRoomNumber, setBlockRoomNumber] = useState(() => rooms[0]?.number || '');
  const [blockStart, setBlockStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [blockEnd, setBlockEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [blockReason, setBlockReason] = useState('');

  // Bulk Price Form
  const [bulkGroupId, setBulkGroupId] = useState(() => assetGroups[0]?.id || '');
  const [bulkPlan, setBulkPlan] = useState<MealPlanType>('Only Rooms');
  const [bulkPrice, setBulkPrice] = useState(2000);
  const [bulkStart, setBulkStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [bulkEnd, setBulkEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) return;
    const catName = newRoomCategory.trim() || assetGroups[0]?.name || 'Standard';
    const grp = assetGroups.find((g) => g.name.toLowerCase() === catName.toLowerCase());
    const grpId = grp?.id || `grp-${catName.toLowerCase().replace(/\s+/g, '-')}`;
    if (!grp) {
      onAddAssetGroup({
        id: grpId,
        name: catName,
        description: `${catName} Category`,
        basePrice: newRoomRate,
        taxRate: 5,
        pricingMode: 'Diff Pricing',
        assetCount: 1,
        planPrices: [
          { planName: 'Only Rooms', price: newRoomRate, enabled: true },
          { planName: 'Meals Included', price: newRoomMealsRate || newRoomRate + 500, enabled: true },
          { planName: 'EP(SG)', price: Math.max(500, newRoomRate - 200), enabled: true },
        ],
      });
    }

    const roomPayload: RoomAsset = {
      id: editingRoomId || `rm-${Date.now()}`,
      number: newRoomNumber.trim(),
      name: `Room ${newRoomNumber.trim()}`,
      groupId: grpId,
      category: catName,
      rate: newRoomRate,
      mealsRate: newRoomMealsRate || newRoomRate + 500,
      status: newRoomStatus,
      cleaningStatus: newRoomStatus === 'Dirty' ? 'Dirty' : 'Clean',
      floor: newRoomFloor,
      bedType: newRoomBedType,
      maxOccupancy: newRoomMaxOccupancy,
      baseOccupancy: newRoomOccupancy,
      extraPersonCharge: newRoomExtraPaxFee,
      allowExtraBed: newRoomAllowExtraBed,
      isLive: true,
      amenities: newRoomAmenities.length > 0 ? newRoomAmenities : ['AC', 'High-Speed Wi-Fi'],
      images: newRoomImage ? [newRoomImage] : undefined,
      blockedReason: newRoomStatus === 'Out of Service' ? newRoomBlockedReason || 'Maintenance / Out of Order' : undefined,
    };

    if (editingRoomId && onUpdateRoomAsset) {
      onUpdateRoomAsset(roomPayload);
    } else {
      onAddRoomAsset(roomPayload);
    }
    setEditingRoomId(null);
    setNewRoomNumber('');
    setShowAddAssetModal(false);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    onAddAssetGroup({
      id: `grp-${Date.now()}`,
      name: groupName.trim(),
      description: groupDesc.trim() || `${groupName.trim()} Category`,
      basePrice: onlyRoomsPrice,
      taxRate: 5,
      pricingMode,
      assetCount: 0,
      planPrices: [
        { planName: 'Only Rooms', price: onlyRoomsPrice, enabled: true },
        { planName: 'Meals Included', price: mealsPrice, enabled: true },
        { planName: 'EP(SG)', price: epSgPrice, enabled: true },
      ],
    });
    setShowAddGroupModal(false);
    setGroupName('');
    setGroupDesc('');
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const rm = rooms.find((r) => r.number === blockRoomNumber) || rooms[0];
    if (!rm) return;
    onAddRoomBlock({
      id: `blk-${Date.now()}`,
      category: rm.category,
      roomId: rm.id,
      roomNumber: rm.number,
      roomName: rm.name,
      startDate: blockStart,
      endDate: blockEnd,
      reason: blockReason || 'Maintenance Block',
      createdBy: 'Admin',
      createdAt: new Date().toLocaleString('en-IN'),
    });
    setShowBlockModal(false);
  };

  const handleCreateBulkPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const grp = assetGroups.find((g) => g.id === bulkGroupId) || assetGroups[0];
    if (!grp) return;
    onApplyBulkPrice({
      id: `ph-${Date.now()}`,
      groupId: grp.id,
      groupName: grp.name,
      planName: bulkPlan,
      price: bulkPrice,
      addedOn: new Date().toLocaleString('en-IN'),
      startDate: bulkStart,
      endDate: bulkEnd,
    });
    setShowBulkPriceModal(false);
  };

  const next7Days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    const dayNum = d.getDay();
    const isWknd = dayNum === 0 || dayNum === 6;
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    return { label: isWknd ? `${label} (Wknd)` : label, isWknd };
  });

  return (
    <div className="space-y-5">
      {/* Header & Sub-Tabs */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Room & Asset Inventory Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Asset Groups • Plan Pricing (`Only Rooms` / `Meals Included`) • Block Assets • Bulk Pricing & QR Codes
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowAddGroupModal(true)}
              className="px-3 sm:px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
              <span>+ Add Asset Group</span>
            </button>
            <button
              onClick={() => setShowBlockModal(true)}
              className="px-3 sm:px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>+ Block Asset</span>
            </button>
            <button
              onClick={openAddRoomModal}
              className="col-span-2 sm:col-span-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>+ Add Asset (Room)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSubTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold truncate text-center sm:whitespace-nowrap transition ${
                activeSubTab === tab.id
                  ? 'bg-slate-900 text-amber-400'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUB-TAB 1: ASSETS DIRECTORY (WITH IS LIVE TOGGLE & QR CODE) */}
      {(activeSubTab === 'dashboard' || activeSubTab === 'status') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3.5 px-4">Asset Name</th>
                  <th className="py-3.5 px-4">Asset Group</th>
                  <th className="py-3.5 px-4">Floor & Bed</th>
                  <th className="py-3.5 px-4">Only Rooms Rate</th>
                  <th className="py-3.5 px-4">Meals Included Rate</th>
                  <th className="py-3.5 px-4">Occupancy & Extra Pax</th>
                  <th className="py-3.5 px-4">Live Status</th>
                  <th className="py-3.5 px-4">IS LIVE (OTA/Booking)</th>
                  <th className="py-3.5 px-4 text-right">Actions & QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        {room.images?.[0] && (
                          <img
                            src={room.images[0]}
                            alt={room.name}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        )}
                        <div>
                          <div>{room.name}</div>
                          {room.amenities?.length > 0 && (
                            <div className="text-[10px] font-normal text-slate-400 truncate max-w-[160px]">
                              {room.amenities.slice(0, 3).join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{room.category}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {room.floor} • {room.bedType}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{formatCurrency(room.rate)}</td>
                    <td className="py-3.5 px-4 font-bold text-amber-700">{formatCurrency(room.mealsRate)}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-semibold text-slate-800">
                        Base {room.baseOccupancy} • Max {room.maxOccupancy}
                      </div>
                      <div className="text-[11px] font-bold text-amber-700">
                        Extra Pax: {formatCurrency(room.extraPersonCharge || 0)}/night
                      </div>
                      <div className={`text-[10px] font-bold ${room.allowExtraBed !== false ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {room.allowExtraBed !== false ? '✓ Extra Bed Allowed' : '✕ No Extra Bed'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          room.status === 'Available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : room.status === 'Occupied'
                            ? 'bg-blue-100 text-blue-800'
                            : room.status === 'Dirty'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {room.status} ({room.cleaningStatus})
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => onToggleRoomLive(room.id)}
                        className={`w-11 h-6 rounded-full p-0.5 transition flex items-center ${
                          room.isLive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditRoomModal(room)}
                          title="Edit Room Details & Extra Pax Fee"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 text-slate-700 hover:text-amber-700 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteRoomAsset && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete ${room.name} (${room.category})?`)) {
                                onDeleteRoomAsset(room.id);
                              }
                            }}
                            title="Delete Room"
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setQrRoom(room)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          QR Code
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

      {/* SUB-TAB 2: ASSET GROUPS & PLAN PRICING (Video Exact Match) */}
      {activeSubTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {assetGroups.map((grp) => (
            <div
              key={grp.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                      {grp.pricingMode}
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 mt-1">{grp.name}</h3>
                    <p className="text-xs text-slate-500">{grp.description}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-amber-400 font-bold text-xs">
                    {rooms.filter((r) => r.category === grp.name).length} Rooms
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold uppercase text-slate-400">Configured Rate Plans</div>
                  {grp.planPrices.map((p) => (
                    <div
                      key={p.planName}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                    >
                      <span className="font-bold text-slate-800">{p.planName}</span>
                      <span className="font-extrabold text-amber-700">{formatCurrency(p.price)} / night</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setBulkGroupId(grp.id);
                  setShowBulkPriceModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                Configure Plan Prices
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 3: BLOCK ASSETS (OUT OF SERVICE / MAINTENANCE) */}
      {activeSubTab === 'blockAssets' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Blocked Assets Register (Out-of-Order Rooms)</h3>
              <p className="text-xs text-slate-500">
                Blocked rooms are automatically excluded from Walk-In, Website, and OTA inventory
              </p>
            </div>
            <button
              onClick={() => setShowBlockModal(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Ban className="w-4 h-4" />
              + Add Block Assets
            </button>
          </div>
          <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Asset Category</th>
                <th className="py-3 px-4">Blocked Room</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">End Date</th>
                <th className="py-3 px-4">Maintenance Reason</th>
                <th className="py-3 px-4">Blocked By</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roomBlocks.map((blk) => (
                <tr key={blk.id}>
                  <td className="py-3.5 px-4 font-semibold">{blk.category}</td>
                  <td className="py-3.5 px-4 font-extrabold text-rose-600">{blk.roomName}</td>
                  <td className="py-3.5 px-4">{formatDate(blk.startDate)}</td>
                  <td className="py-3.5 px-4">{formatDate(blk.endDate)}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">{blk.reason}</td>
                  <td className="py-3.5 px-4 text-slate-500">{blk.createdBy}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onRemoveRoomBlock(blk.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                    >
                      Unblock & Release Room
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ROOM CALENDAR MATRIX (`availability`) */}
      {activeSubTab === 'availability' && calendarNode && (
        <div className="space-y-4">{calendarNode}</div>
      )}

      {/* SUB-TAB 5: BULK PRICE CONFIGURATION & PRICE HISTORY (Video Exact Match) */}
      {(activeSubTab === 'priceHistory' || (activeSubTab === 'availability' && !calendarNode)) && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  7-Day Date-Wise Plan Price Matrix & Bulk Configuration
                </h3>
                <p className="text-xs text-slate-500">
                  Compare `Only Rooms`, `Meals Included`, and `EP(SG)` rates across upcoming dates
                </p>
              </div>
              <button
                onClick={() => setShowBulkPriceModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5"
              >
                <Calendar className="w-4 h-4" />
                Bulk Price Configuration
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-3 text-left rounded-tl-xl">Asset Group</th>
                    <th className="p-3 text-left">Meal Plan</th>
                    {next7Days.map((d) => (
                      <th key={d.label} className="p-3 text-center border-l border-slate-800">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {assetGroups.map((grp) =>
                    grp.planPrices.slice(0, 2).map((plan) => (
                      <tr key={`${grp.id}-${plan.planName}`} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{grp.name}</td>
                        <td className="p-3 font-semibold text-amber-700">{plan.planName}</td>
                        {next7Days.map((d, dayIdx) => {
                          const weekendBump = d.isWknd ? 300 : 0;
                          return (
                            <td key={dayIdx} className="p-3 text-center border-l border-slate-100 font-bold">
                              {formatCurrency(plan.price + weekendBump)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Asset Price History Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Asset Price History Audit Log</h3>
            </div>
            <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Added On</th>
                  <th className="py-3 px-4">Asset Group</th>
                  <th className="py-3 px-4">Plan Name</th>
                  <th className="py-3 px-4">Revised Price</th>
                  <th className="py-3 px-4">Effective Start Date</th>
                  <th className="py-3 px-4">Effective End Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priceHistory.map((ph) => (
                  <tr key={ph.id}>
                    <td className="py-3 px-4 text-slate-500">{ph.addedOn}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{ph.groupName}</td>
                    <td className="py-3 px-4 font-semibold text-amber-700">{ph.planName}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">{formatCurrency(ph.price)}</td>
                    <td className="py-3 px-4">{formatDate(ph.startDate)}</td>
                    <td className="py-3 px-4">{formatDate(ph.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6 & 8: AMENITIES & TARIFF RULES */}
      {(activeSubTab === 'amenities' || activeSubTab === 'settings') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Standard Room Amenities Master
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                'Daikin Split AC',
                'High-Speed Fiber Wi-Fi',
                '43" 4K Smart TV',
                '24x7 Solar + Electric Geyser',
                'Tea / Coffee Kettle Maker',
                'Electronic Safe Locker',
                'Mini Fridge',
                'Orthopedic King Mattress',
                'Work Desk & Lamp',
                'Complimentary 2x 1L Bisleri',
              ].map((item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              Extra Mattress & Dynamic GST Slabs
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span>Room Tariff ≤ ₹7,500 / night</span>
                <strong className="text-slate-900">12% GST (6% CGST + 6% SGST)</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span>Room Tariff &gt; ₹7,500 / night</span>
                <strong className="text-slate-900">18% GST (9% CGST + 9% SGST)</strong>
              </div>
              <div className="flex justify-between py-2">
                <span>Extra Adult Mattress Charge</span>
                <strong className="text-amber-700">₹500 / night (AC) • ₹350 / night (Non-AC)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ROOM QR CODE PREVIEW */}
      {qrRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-amber-600">In-Room Digital Concierge QR</span>
              <button onClick={() => setQrRoom(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-2">
              <div className="text-lg font-extrabold text-amber-400">{qrRoom.name}</div>
              <div className="text-xs text-slate-300">{qrRoom.category} • In-Room Concierge</div>
              <div className="w-44 h-44 mx-auto bg-white p-4 rounded-2xl flex items-center justify-center">
                <QrCode className="w-32 h-32 text-slate-900" />
              </div>
              <div className="text-[11px] text-slate-400 pt-2">
                Scan to Order Room Service Food, Request Housekeeping, or View Wi-Fi Password
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
            >
              Print Acrylic Tent Card QR
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: FULL ADD / EDIT ROOM ASSET MODAL (ALL ORIGINAL PMS FIELDS + EXTRA PAX FEE) */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-amber-400">
                  {editingRoomId ? `Edit Room ${newRoomNumber}` : 'Add New Room Asset'}
                </h3>
                <p className="text-[11px] text-slate-300">
                  Configure room number, floor, category, occupancy, Extra Pax Fee, amenities & photo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAssetModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Row 1: Room Number & Floor Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900 bg-slate-50/60 focus:bg-white focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">
                    Floor Level
                  </label>
                  <select
                    value={newRoomFloor}
                    onChange={(e) => setNewRoomFloor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900 bg-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="1st Floor">1st Floor</option>
                    <option value="2nd Floor">2nd Floor</option>
                    <option value="3rd Floor">3rd Floor</option>
                    <option value="4th Floor">4th Floor</option>
                    <option value="5th Floor">5th Floor</option>
                    <option value="Executive Floor">Executive Floor</option>
                    <option value="Penthouse">Penthouse Tier</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Asset Group / Category & Bed Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">
                    Category / Room Type *
                  </label>
                  <input
                    type="text"
                    required
                    list="pms-room-category-options"
                    value={newRoomCategory}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRoomCategory(val);
                      const matchedGrp = assetGroups.find(
                        (g) => g.name.toLowerCase() === val.toLowerCase()
                      );
                      if (matchedGrp) {
                        setNewRoomRate(matchedGrp.basePrice);
                        const mealsPlan = matchedGrp.planPrices.find(
                          (p) => p.planName === 'Meals Included'
                        );
                        setNewRoomMealsRate(
                          mealsPlan ? mealsPlan.price : matchedGrp.basePrice + 500
                        );
                      }
                    }}
                    placeholder="Select or type category (e.g. Deluxe)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900 bg-white focus:border-amber-500 focus:outline-none"
                  />
                  <datalist id="pms-room-category-options">
                    {Array.from(
                      new Set([
                        ...assetGroups.map((g) => g.name),
                        'Standard',
                        'Deluxe',
                        'Super Deluxe',
                        'Executive Suite',
                        'Family Room',
                        'Royal Suite',
                      ])
                    ).map((catName) => (
                      <option key={catName} value={catName} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">
                    Bed Type
                  </label>
                  <select
                    value={newRoomBedType}
                    onChange={(e) => setNewRoomBedType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900 bg-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="King Size Bed">King Size Bed</option>
                    <option value="Queen Size Bed">Queen Size Bed</option>
                    <option value="Double Bed">Double Bed</option>
                    <option value="Twin Beds">Twin Beds</option>
                    <option value="Suite Bedding">Suite Bedding</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Base Price (Only Rooms) & Meals Included Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">
                    Base Price — Only Rooms (₹ / Night) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newRoomRate}
                    onChange={(e) => {
                      const r = Number(e.target.value) || 0;
                      setNewRoomRate(r);
                      if (!editingRoomId) setNewRoomMealsRate(r + 500);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-extrabold text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-amber-800 uppercase text-[11px] mb-1">
                    Meals Included Rate (₹ / Night)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newRoomMealsRate}
                    onChange={(e) => setNewRoomMealsRate(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/40 font-extrabold text-amber-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Occupancy Capacity & Extra Pax Fee Box */}
              <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-800">
                    Occupancy Capacity & Extra Pax Charge
                  </span>
                  <span className="text-[10px] font-semibold text-amber-800">
                    Auto-applied on Extra Adult / Mattress
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Base Occ (Adults)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="2"
                      value={newRoomOccupancy === 0 ? '' : String(newRoomOccupancy)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const d = e.target.value.replace(/[^0-9]/g, '');
                        setNewRoomOccupancy(d === '' ? 0 : parseInt(d, 10));
                      }}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      Max Occ (With Extra)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="3"
                      value={newRoomMaxOccupancy === 0 ? '' : String(newRoomMaxOccupancy)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const d = e.target.value.replace(/[^0-9]/g, '');
                        setNewRoomMaxOccupancy(d === '' ? 0 : parseInt(d, 10));
                      }}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">
                      Extra Pax Fee (₹) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g. 500"
                      value={newRoomExtraPaxFee}
                      onChange={(e) => setNewRoomExtraPaxFee(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-2 rounded-xl border-2 border-amber-400 bg-white font-extrabold text-slate-900 focus:outline-none"
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
                      onClick={() => setNewRoomAllowExtraBed(true)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        newRoomAllowExtraBed
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ✓ Yes (Allowed)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRoomAllowExtraBed(false)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        !newRoomAllowExtraBed
                          ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ✕ No (Small Room)
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 5: In-Room Amenities Checklist */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="block text-[11px] font-bold uppercase text-slate-700">
                  In-Room Amenities
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {Array.from(new Set([...DEFAULT_AMENITIES_LIST, ...newRoomAmenities])).map((am) => (
                    <label
                      key={am}
                      className="flex items-center gap-1.5 text-[11px] text-slate-800 font-medium cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newRoomAmenities.includes(am)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRoomAmenities((prev) => [...prev, am]);
                          } else {
                            setNewRoomAmenities((prev) => prev.filter((item) => item !== am));
                          }
                        }}
                        className="rounded accent-amber-500"
                      />
                      <span>{am}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customAmenityInput}
                    onChange={(e) => setCustomAmenityInput(e.target.value)}
                    placeholder="Add custom amenity (e.g. Jacuzzi / Bathtub)..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = customAmenityInput.trim();
                      if (trimmed && !newRoomAmenities.includes(trimmed)) {
                        setNewRoomAmenities((prev) => [...prev, trimmed]);
                        setCustomAmenityInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-amber-400 font-bold text-[11px]"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Row 6: Room Photo Upload & Optional URL */}
              <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase text-slate-700">
                    Room Photo / Picture
                  </label>
                  {newRoomImage && (
                    <button
                      type="button"
                      onClick={() => setNewRoomImage('')}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove Photo
                    </button>
                  )}
                </div>

                {newRoomImage && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-32">
                    <img
                      src={newRoomImage}
                      alt="Room Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                  <label className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-bold cursor-pointer transition text-center">
                    <ImageIcon className="w-4 h-4 shrink-0" />
                    <span>{newRoomImage ? 'Change Room Photo' : 'Upload Room Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRoomImageUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={newRoomImage.startsWith('data:image/') ? '' : newRoomImage}
                    onChange={(e) => setNewRoomImage(e.target.value)}
                    placeholder="Or paste image URL (https://...)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
                  />
                </div>
              </div>

              {/* Row 7: Initial Operational PMS Status */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-[11px] font-bold uppercase text-slate-700">
                  Operational PMS Status
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(['Available', 'Occupied', 'Confirmed', 'Dirty', 'Out of Service'] as const).map(
                    (st) => (
                      <button
                        type="button"
                        key={st}
                        onClick={() => setNewRoomStatus(st)}
                        className={`py-1.5 px-2 rounded-lg border font-bold text-[10px] transition ${
                          newRoomStatus === st
                            ? 'border-amber-500 bg-amber-500/15 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {newRoomStatus === 'Out of Service' && (
                <div>
                  <label className="block font-bold text-rose-700 uppercase text-[11px] mb-1">
                    Reason for Out of Service / Block
                  </label>
                  <input
                    type="text"
                    value={newRoomBlockedReason}
                    onChange={(e) => setNewRoomBlockedReason(e.target.value)}
                    placeholder="e.g. AC Repair / Plumbing work"
                    className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-950 font-semibold"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-sm"
                >
                  {editingRoomId ? 'Update Room Entity' : 'Save & Create Room Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD ASSET GROUP & PLAN PRICING MODAL */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateGroup}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Add Asset Group & Meal Plan Rates</h3>
              <button type="button" onClick={() => setShowAddGroupModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Royal Suite Rooms"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                {(['Match Pricing', 'Diff Pricing'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 font-bold cursor-pointer">
                    <input
                      type="radio"
                      checked={pricingMode === m}
                      onChange={() => setPricingMode(m)}
                      className="accent-amber-500"
                    />
                    {m}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Only Rooms (₹)</label>
                  <input
                    type="number"
                    value={onlyRoomsPrice}
                    onChange={(e) => setOnlyRoomsPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Meals Incl. (₹)</label>
                  <input
                    type="number"
                    value={mealsPrice}
                    onChange={(e) => setMealsPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">EP(SG) (₹)</label>
                  <input
                    type="number"
                    value={epSgPrice}
                    onChange={(e) => setEpSgPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs"
            >
              Create Asset Group
            </button>
          </form>
        </div>
      )}

      {/* MODAL 4: BLOCK ASSETS MODAL */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBlock}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-rose-700">Block Room Asset (Maintenance)</h3>
              <button type="button" onClick={() => setShowBlockModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Select Room to Block</label>
                <select
                  value={blockRoomNumber}
                  onChange={(e) => setBlockRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      {r.name} ({r.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Maintenance / Block Reason</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs"
            >
              Confirm Block Asset
            </button>
          </form>
        </div>
      )}

      {/* MODAL 5: BULK PRICE CONFIGURATION MODAL */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBulkPrice}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Bulk Price Configuration</h3>
              <button type="button" onClick={() => setShowBulkPriceModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Select Asset Group</label>
                <select
                  value={bulkGroupId}
                  onChange={(e) => setBulkGroupId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                >
                  {assetGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Meal Plan</label>
                  <select
                    value={bulkPlan}
                    onChange={(e) => setBulkPlan(e.target.value as MealPlanType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="Only Rooms">Only Rooms</option>
                    <option value="Meals Included">Meals Included</option>
                    <option value="EP(SG)">EP(SG)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">New Tariff (₹)</label>
                  <input
                    type="number"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs"
            >
              Apply Bulk Price Update
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
