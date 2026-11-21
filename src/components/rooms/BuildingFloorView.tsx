import React, { useState } from 'react';
import {
  Building,
  Building2,
  Layers,
  Plus,
  Bed,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  Trash2,
  Edit2,
  Check,
  X,
  ArrowRight
} from 'lucide-react';
import { Room, RoomStatus } from '../../types';
import { showToast } from '../../utils/toast';

interface BuildingFloorViewProps {
  rooms: Room[];
  onUpdateRooms: (rooms: Room[]) => void;
  hotelName?: string;
  onAddAuditLog?: (action: string, details: string) => void;
}

interface BuildingEntity {
  id: string;
  name: string;
  code: string;
  totalFloors: number;
  description: string;
}

export default function BuildingFloorView({
  rooms = [],
  onUpdateRooms,
  hotelName = 'DirectStay Hotel',
  onAddAuditLog,
}: BuildingFloorViewProps) {
  // Buildings State
  const [buildings, setBuildings] = useState<BuildingEntity[]>([
    { id: 'bld-1', name: 'Main Hotel Wing', code: 'MAIN', totalFloors: 6, description: 'Primary guest accommodation & reception wing' },
    { id: 'bld-2', name: 'Executive Annex Tower', code: 'ANNEX', totalFloors: 4, description: 'Premium suites & conference facility block' },
  ]);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('bld-1');
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [newBldName, setNewBldName] = useState('');
  const [newBldCode, setNewBldCode] = useState('');
  const [newBldFloors, setNewBldFloors] = useState(4);
  const [newBldDesc, setNewBldDesc] = useState('');

  // Floors List: Ground (0), 1st, 2nd, 3rd, 4th, 5th
  const [customFloors, setCustomFloors] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');

  // Bulk Generator Modal
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [genFloor, setGenFloor] = useState<number>(1);
  const [genStartNum, setGenStartNum] = useState<number>(101);
  const [genCount, setGenCount] = useState<number>(6);
  const [genCategory, setGenCategory] = useState<string>('Deluxe');
  const [genBaseTariff, setGenBaseTariff] = useState<number>(2500);

  // Helper to determine a room's floor number (robust and null-safe)
  const getRoomFloor = (r: Room | any): number => {
    if (!r) return 1;
    if (typeof r.floorNumber === 'number') return r.floorNumber;
    const rawNum = r.roomNumber ?? r.number ?? r.room_number ?? '';
    const cleanNum = String(rawNum).replace(/\D/g, '');
    if (!cleanNum) return 1;
    const num = parseInt(cleanNum, 10);
    if (num < 100) return 0; // Ground floor
    return Math.floor(num / 100);
  };

  const getFloorName = (floorNum: number): string => {
    if (floorNum === 0) return 'Ground Floor';
    if (floorNum === 1) return '1st Floor';
    if (floorNum === 2) return '2nd Floor';
    if (floorNum === 3) return '3rd Floor';
    return `${floorNum}th Floor`;
  };

  const handleAddBuilding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBldName.trim()) return;
    const newB: BuildingEntity = {
      id: `bld-${Date.now()}`,
      name: newBldName.trim(),
      code: newBldCode.trim().toUpperCase() || 'BLK',
      totalFloors: Number(newBldFloors) || 3,
      description: newBldDesc.trim() || 'Hotel property wing',
    };
    setBuildings([...buildings, newB]);
    setSelectedBuildingId(newB.id);
    setShowAddBuildingModal(false);
    setNewBldName('');
    setNewBldCode('');
    setNewBldDesc('');
    showToast(`Added building wing: "${newB.name}"`, 'success');
  };

  const handleAddFloorLevel = () => {
    const nextLevel = customFloors.length > 0 ? Math.max(...customFloors) + 1 : 1;
    setCustomFloors([...customFloors, nextLevel]);
    showToast(`Added ${getFloorName(nextLevel)} to hotel structure!`, 'success');
  };

  const handleMoveRoomFloor = (roomId: string, nextFloor: number) => {
    const updated = rooms.map((r) => {
      if (r.id === roomId) {
        return {
          ...r,
          floorNumber: nextFloor,
        } as Room;
      }
      return r;
    });
    onUpdateRooms(updated);
    showToast(`Room re-assigned to ${getFloorName(nextFloor)}.`, 'info');
  };

  const handleBulkGenerateRooms = (e: React.FormEvent) => {
    e.preventDefault();
    const count = Math.min(25, Math.max(1, Number(genCount) || 1));
    const newRooms: Room[] = [];

    for (let i = 0; i < count; i++) {
      const roomNum = String(Number(genStartNum) + i);
      // Check if room number already exists
      if ((rooms || []).some((r) => r && (r.roomNumber === roomNum || (r as any).number === roomNum))) continue;

      newRooms.push({
        id: `rm-gen-${Date.now()}-${i}`,
        roomNumber: roomNum,
        type: genCategory,
        category: genCategory,
        price: Number(genBaseTariff) || 2000,
        status: 'Available',
        cleaningStatus: 'Clean',
        capacity: 2,
        amenities: ['WiFi', 'Air Conditioning', 'Television', 'Attached Bath'],
        description: `${genCategory} room located on ${getFloorName(genFloor)}`,
        floorNumber: genFloor,
      } as any);
    }

    if (newRooms.length === 0) {
      showToast('All room numbers in this range already exist.', 'warning');
      return;
    }

    const updated = [...rooms, ...newRooms];
    onUpdateRooms(updated);
    setShowGeneratorModal(false);
    const firstNum = newRooms[0].roomNumber || newRooms[0].number;
    const lastNum = newRooms[newRooms.length - 1].roomNumber || newRooms[newRooms.length - 1].number;
    const log = `Bulk generated ${newRooms.length} room(s) on ${getFloorName(genFloor)} (Numbers: ${firstNum} to ${lastNum}).`;
    onAddAuditLog?.('Bulk Rooms Generated', log);
    showToast(log, 'success', 5000, 'Rooms Created');
  };

  const activeBuilding = buildings.find((b) => b.id === selectedBuildingId) || buildings[0];

  // Group rooms by floor (safely guarded against undefined/null objects)
  const roomsByFloor = customFloors.reduce<Record<number, Room[]>>((acc, f) => {
    acc[f] = (rooms || []).filter((r) => Boolean(r) && getRoomFloor(r) === f);
    return acc;
  }, {});

  const displayedFloors = selectedFloor === 'all' ? customFloors : [selectedFloor];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
            <Building className="w-3.5 h-3.5 text-luxury-gold-600" /> Property Architecture &amp; Unit Distribution
          </div>
          <h2 className="text-xl font-serif font-bold text-luxury-brown-950 flex items-center gap-2">
            Building &amp; Floor Architecture Setup
          </h2>
          <p className="text-xs text-luxury-brown-500 mt-0.5">
            Configure hotel wings, manage floor elevations (Ground to 5th+ Floor), map room inventories, and bulk-generate room blocks for {hotelName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGeneratorModal(true)}
            className="px-4 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Bulk Floor Room Generator
          </button>
          <button
            type="button"
            onClick={() => setShowAddBuildingModal(true)}
            className="px-3.5 py-2 bg-luxury-beige-100 hover:bg-luxury-beige-200 text-luxury-brown-900 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-luxury-brown-200 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Building Wing
          </button>
        </div>
      </div>

      {/* Buildings Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {buildings.map((b) => {
          const isSelected = b.id === selectedBuildingId;
          const bldRoomCount = rooms.length; // Can be segmented per building
          return (
            <div
              key={b.id}
              onClick={() => setSelectedBuildingId(b.id)}
              className={`p-5 rounded-3xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-br from-[#1C140E] to-[#2B1B11] text-white border-luxury-gold-500 shadow-md ring-2 ring-luxury-gold-500/30'
                  : 'bg-white border-luxury-brown-100 hover:border-luxury-brown-200 text-luxury-brown-950'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                      isSelected ? 'bg-luxury-gold-500 text-luxury-brown-950' : 'bg-luxury-beige-100 text-luxury-gold-700'
                    }`}
                  >
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-base">{b.name}</h3>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isSelected ? 'bg-white/10 text-luxury-gold-300' : 'bg-luxury-beige-200 text-luxury-brown-800'
                        }`}
                      >
                        {b.code}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isSelected ? 'text-luxury-brown-200' : 'text-luxury-brown-500'}`}>
                      {b.description}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold block">{customFloors.length} Floors</span>
                  <span
                    className={`text-[10px] font-mono ${
                      isSelected ? 'text-luxury-gold-400 font-bold' : 'text-luxury-brown-500'
                    }`}
                  >
                    {rooms.length} Units Active
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floor Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-luxury-brown-100 shadow-3xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          <span className="text-xs font-mono font-bold uppercase text-luxury-brown-400 mr-2">Filter Floor:</span>
          <button
            type="button"
            onClick={() => setSelectedFloor('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedFloor === 'all'
                ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs'
                : 'bg-luxury-beige-50 text-luxury-brown-700 hover:bg-luxury-beige-100'
            }`}
          >
            All Floors ({rooms.length} Rooms)
          </button>
          {customFloors.map((f) => {
            const count = (roomsByFloor[f] || []).length;
            const isSel = selectedFloor === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFloor(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSel
                    ? 'bg-luxury-brown-950 text-luxury-gold-400 shadow-xs'
                    : 'bg-luxury-beige-50 text-luxury-brown-700 hover:bg-luxury-beige-100'
                }`}
              >
                {getFloorName(f)} ({count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAddFloorLevel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luxury-beige-100 hover:bg-luxury-gold-500 hover:text-luxury-brown-950 text-luxury-brown-800 text-xs font-mono font-bold transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Next Floor Elevation
        </button>
      </div>

      {/* Floor Sections & Room Allocation Cards */}
      <div className="space-y-6">
        {displayedFloors.map((floorNum) => {
          const floorRooms = roomsByFloor[floorNum] || [];
          const occupied = floorRooms.filter((r) => r.status === 'Occupied').length;
          const available = floorRooms.filter((r) => r.status === 'Available').length;
          const dirty = floorRooms.filter((r) => r.cleaningStatus === 'Dirty' || r.status === 'Dirty').length;

          return (
            <div
              key={floorNum}
              className="bg-white border border-luxury-brown-100 rounded-3xl p-6 shadow-sm space-y-4"
            >
              {/* Floor Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-luxury-brown-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-luxury-gold-500/10 text-luxury-gold-700 border border-luxury-gold-500/20 flex items-center justify-center font-mono font-bold text-sm">
                    {floorNum === 0 ? 'G' : `${floorNum}F`}
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-luxury-brown-950 flex items-center gap-2">
                      {getFloorName(floorNum)}
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-luxury-beige-100 text-luxury-brown-700">
                        {floorRooms.length} Rooms Assigned
                      </span>
                    </h3>
                    <p className="text-[11px] text-luxury-brown-500">
                      Level {floorNum} of {activeBuilding.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {available} Available
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                    {occupied} Occupied
                  </span>
                  {dirty > 0 && (
                    <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                      {dirty} Dirty
                    </span>
                  )}
                </div>
              </div>

              {/* Room Cards Grid */}
              {floorRooms.length === 0 ? (
                <div className="p-8 text-center bg-luxury-beige-50/40 rounded-2xl border border-dashed border-luxury-brown-200 space-y-2">
                  <Bed className="w-8 h-8 text-luxury-brown-300 mx-auto" />
                  <p className="text-xs font-bold text-luxury-brown-800">
                    No rooms mapped to {getFloorName(floorNum)} yet.
                  </p>
                  <p className="text-[11px] text-luxury-brown-500">
                    Use the Bulk Floor Room Generator above to generate rooms for this floor.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {floorRooms.map((r) => {
                    const isOccupied = r.status === 'Occupied';
                    const isAvailable = r.status === 'Available';
                    const isDirty = r.cleaningStatus === 'Dirty' || r.status === 'Dirty';

                    return (
                      <div
                        key={r.id}
                        className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                          isOccupied
                            ? 'bg-blue-50/60 border-blue-200'
                            : isDirty
                            ? 'bg-amber-50/60 border-amber-200'
                            : 'bg-emerald-50/50 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-luxury-brown-950">
                            Room {r.roomNumber || (r as any).number || '---'}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOccupied ? 'bg-blue-600' : isDirty ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                        </div>

                        <div>
                          <span className="text-[11px] font-semibold text-luxury-brown-800 block truncate">
                            {r.type || r.category}
                          </span>
                          <span className="text-[10px] font-mono text-luxury-brown-500">
                            ₹{r.price}/night
                          </span>
                        </div>

                        {/* Quick Move Floor Selector */}
                        <div className="pt-2 border-t border-luxury-brown-100 flex items-center justify-between text-[10px]">
                          <span className="text-luxury-brown-400 font-mono">Move:</span>
                          <select
                            value={floorNum}
                            onChange={(e) => handleMoveRoomFloor(r.id, parseInt(e.target.value, 10))}
                            className="bg-white border border-luxury-brown-200 rounded px-1.5 py-0.5 font-mono text-luxury-brown-900 cursor-pointer"
                          >
                            {customFloors.map((f) => (
                              <option key={f} value={f}>
                                {f === 0 ? 'G Floor' : `${f}F`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bulk Generator Modal */}
      {showGeneratorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-luxury-brown-950 text-white p-5 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-luxury-gold-400" /> Bulk Floor Room Generator
              </h3>
              <button
                type="button"
                onClick={() => setShowGeneratorModal(false)}
                className="text-luxury-brown-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkGenerateRooms} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Target Floor *
                </label>
                <select
                  value={genFloor}
                  onChange={(e) => {
                    const f = parseInt(e.target.value, 10);
                    setGenFloor(f);
                    setGenStartNum(f === 0 ? 1 : f * 100 + 1);
                  }}
                  className="w-full bg-luxury-beige-50 border border-luxury-brown-200 rounded-xl px-3 py-2 font-bold"
                >
                  {customFloors.map((f) => (
                    <option key={f} value={f}>
                      {getFloorName(f)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Start Room Number *
                  </label>
                  <input
                    type="number"
                    required
                    value={genStartNum}
                    onChange={(e) => setGenStartNum(parseInt(e.target.value, 10) || 101)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Quantity to Generate *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    required
                    value={genCount}
                    onChange={(e) => setGenCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Room Category *
                  </label>
                  <select
                    value={genCategory}
                    onChange={(e) => setGenCategory(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Deluxe">Deluxe</option>
                    <option value="Executive">Executive</option>
                    <option value="Suite">Suite</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Base Tariff (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={genBaseTariff}
                    onChange={(e) => setGenBaseTariff(parseInt(e.target.value, 10) || 2000)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-luxury-beige-50 rounded-xl border border-luxury-brown-100 text-[11px] text-luxury-brown-600">
                Will create <strong>{genCount}</strong> rooms starting from <strong>{genStartNum}</strong> to{' '}
                <strong>{Number(genStartNum) + Number(genCount) - 1}</strong> on {getFloorName(genFloor)}.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-luxury-brown-50">
                <button
                  type="button"
                  onClick={() => setShowGeneratorModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 rounded-xl text-luxury-brown-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl cursor-pointer"
                >
                  Generate Rooms
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Building Modal */}
      {showAddBuildingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-luxury-brown-100 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="bg-luxury-brown-950 text-white p-5 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <Building className="w-4 h-4 text-luxury-gold-400" /> Add Property Wing / Building
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBuildingModal(false)}
                className="text-luxury-brown-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBuilding} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Building Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tower B / Heritage Block"
                  value={newBldName}
                  onChange={(e) => setNewBldName(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Short Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TWR-B"
                    value={newBldCode}
                    onChange={(e) => setNewBldCode(e.target.value)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                    Total Floors
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newBldFloors}
                    onChange={(e) => setNewBldFloors(parseInt(e.target.value, 10) || 4)}
                    className="w-full bg-white border border-luxury-brown-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono font-bold text-[10px] uppercase text-luxury-brown-600 block mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional architectural or location details..."
                  value={newBldDesc}
                  onChange={(e) => setNewBldDesc(e.target.value)}
                  className="w-full bg-white border border-luxury-brown-200 rounded-xl p-3"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-luxury-brown-50">
                <button
                  type="button"
                  onClick={() => setShowAddBuildingModal(false)}
                  className="px-4 py-2 border border-luxury-brown-200 rounded-xl text-luxury-brown-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-luxury-brown-950 hover:bg-luxury-brown-900 text-luxury-gold-400 font-bold rounded-xl cursor-pointer"
                >
                  Create Building
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
