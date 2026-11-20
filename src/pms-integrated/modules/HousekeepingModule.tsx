import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Plus,
  Shirt,
  PackageSearch,
  Trash2,
  Users,
  Download,
  UserPlus,
  Search,
  Building2,
  AlertCircle,
  ClipboardCheck,
  X,
  ArrowRight,
  Flag,
  FileText,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import {
  HousekeepingTask,
  LaundryOrderRecord,
  LostFoundRecord,
  RoomAsset,
  StaffMemberRecord,
} from '../types';
import { formatCurrency } from '../utils/formatters';
import { showToast } from '../../utils/toast';

export type HkStage = 'Dirty' | 'In Progress' | 'Inspection' | 'Clean';
export type HkPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface RoomHousekeepingPatch {
  cleaningStatus?: HkStage;
  assignedStaff?: string;
  priority?: HkPriority;
  notes?: string;
  markOutOfOrder?: boolean;
  outOfOrderReason?: string;
  checklist?: string[];
}

interface HousekeepingModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  rooms: RoomAsset[];
  staff?: StaffMemberRecord[];
  tasks: HousekeepingTask[];
  laundryOrders: LaundryOrderRecord[];
  lostFound: LostFoundRecord[];
  autoMarkDirtyOnCheckout?: boolean;
  onToggleAutoMarkDirty?: (enabled: boolean) => void;
  onUpdateRoomHousekeeping?: (roomNumbers: string[], patch: RoomHousekeepingPatch) => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (task: Omit<HousekeepingTask, 'id'>) => void;
  onAddLaundryOrder: (order: Omit<LaundryOrderRecord, 'id'>) => void;
  onAddLostFound?: (item: Omit<LostFoundRecord, 'id'>) => void;
}

const SUB_TABS = [
  { id: 'dashboard', label: 'Housekeeping Board' },
  { id: 'room_cleaning', label: 'Task Queue' },
  { id: 'laundry', label: 'Laundry & Linen Desk' },
  { id: 'lost_found', label: 'Lost & Found Register' },
  { id: 'reports', label: 'Productivity & SOPs' },
];

function resolveRoomHkStage(room: RoomAsset): HkStage {
  const cs = String(room.cleaningStatus || '').toLowerCase();
  if (cs === 'in progress') return 'In Progress';
  if (cs === 'inspection' || cs === 'needs inspection') return 'Inspection';
  if (cs === 'dirty' || room.status === 'Dirty') return 'Dirty';
  return 'Clean';
}

function nextHkStage(current: HkStage): HkStage {
  if (current === 'Dirty') return 'In Progress';
  if (current === 'In Progress') return 'Inspection';
  return 'Clean';
}

function nextStageButtonLabel(current: HkStage): string {
  if (current === 'Dirty') return 'Start Cleaning';
  if (current === 'In Progress') return 'Send to Inspection';
  if (current === 'Inspection') return 'Approve Clean & Ready';
  return 'Mark Dirty';
}

export const HousekeepingModule: React.FC<HousekeepingModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  rooms,
  staff = [],
  tasks,
  laundryOrders,
  lostFound,
  autoMarkDirtyOnCheckout = true,
  onToggleAutoMarkDirty,
  onUpdateRoomHousekeeping,
  onCompleteTask,
  onAddTask,
  onAddLaundryOrder,
  onAddLostFound,
}) => {
  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      const aHk = a.department === 'Housekeeping' || a.role === 'Housekeeping' ? 0 : 1;
      const bHk = b.department === 'Housekeeping' || b.role === 'Housekeeping' ? 0 : 1;
      return aHk - bHk;
    });
  }, [staff]);

  // Board / Table / By Attendant View & Filters
  const [viewLayout, setViewLayout] = useState<'board' | 'table' | 'attendant'>('board');
  const [globalSearch, setGlobalSearch] = useState('');
  const [roomBoxSearch, setRoomBoxSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'Clean' | 'Dirty' | 'In Progress' | 'Inspection' | 'Out of Service'
  >('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | HkPriority>('ALL');

  // Room Detail & Status Progression Modal
  const [editingRoom, setEditingRoom] = useState<RoomAsset | null>(null);
  const [modalStage, setModalStage] = useState<HkStage>('Clean');
  const [modalStaff, setModalStaff] = useState('');
  const [modalCustomStaff, setModalCustomStaff] = useState(false);
  const [modalPriority, setModalPriority] = useState<HkPriority>('Normal');
  const [modalNotes, setModalNotes] = useState('');
  const [modalOutOfOrder, setModalOutOfOrder] = useState(false);
  const [modalOutOfOrderReason, setModalOutOfOrderReason] = useState('');
  const [modalCheckedSop, setModalCheckedSop] = useState<Record<string, boolean>>({});

  // Bulk "+ Assign Staff" Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [bulkSelectedRooms, setBulkSelectedRooms] = useState<string[]>([]);
  const [bulkStaff, setBulkStaff] = useState('');
  const [bulkCustomStaff, setBulkCustomStaff] = useState(false);
  const [bulkStage, setBulkStage] = useState<HkStage>('Dirty');
  const [bulkPriority, setBulkPriority] = useState<HkPriority>('Normal');
  const [bulkNotes, setBulkNotes] = useState('');

  // Legacy Queue / Laundry / Lost & Found states (100% preserved)
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(() => rooms[0]?.number || '');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedTo, setAssignedTo] = useState(() => sortedStaff[0]?.name || '');
  const [taskPriority, setTaskPriority] = useState<HkPriority>('Normal');
  const [isCustomStaff, setIsCustomStaff] = useState(false);

  const [laundryRoom, setLaundryRoom] = useState(() => rooms[0]?.number || '');
  const [laundryItems, setLaundryItems] = useState('');
  const [laundryAmount, setLaundryAmount] = useState(0);

  useEffect(() => {
    if (!selectedRoomNumber && rooms.length > 0) setSelectedRoomNumber(rooms[0].number);
    if (!laundryRoom && rooms.length > 0) setLaundryRoom(rooms[0].number);
  }, [rooms, selectedRoomNumber, laundryRoom]);

  useEffect(() => {
    if (!assignedTo && sortedStaff.length > 0 && !isCustomStaff) {
      setAssignedTo(sortedStaff[0].name);
    }
    if (!bulkStaff && sortedStaff.length > 0 && !bulkCustomStaff) {
      setBulkStaff(sortedStaff[0].name);
    }
  }, [sortedStaff, assignedTo, isCustomStaff, bulkStaff, bulkCustomStaff]);

  const [localLostFound, setLocalLostFound] = useState<LostFoundRecord[]>(lostFound);
  useEffect(() => setLocalLostFound(lostFound), [lostFound]);

  const [lfItemName, setLfItemName] = useState('');
  const [lfCategory, setLfCategory] = useState('Electronics');
  const [lfRoom, setLfRoom] = useState('');
  const [lfFoundBy, setLfFoundBy] = useState(() => sortedStaff[0]?.name || '');

  // SOP Checklist
  const DEFAULT_SOP_CHECKLIST = [
    'Strip & replace bedsheets, duvet cover & pillow cases',
    'Sanitize washroom, WC, mirror & floor with disinfectant',
    'Restock guest toiletries (soap, dental kit, fresh bath towels)',
    'Check & replenish 2x 1L complimentary water bottles',
    'Verify AC remote, Smart TV remote & kettle operation',
  ];

  const [sopChecklist, setSopChecklist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ds_housekeeping_sop_checklist_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SOP_CHECKLIST;
  });
  const [newChecklistStep, setNewChecklistStep] = useState('');
  const [checkedSopSteps, setCheckedSopSteps] = useState<Record<string, boolean>>({});

  const saveSopChecklist = (nextList: string[]) => {
    setSopChecklist(nextList);
    try {
      localStorage.setItem('ds_housekeeping_sop_checklist_v1', JSON.stringify(nextList));
    } catch {}
  };

  // Enrich each room with latest active task metadata (staff, priority, notes, completion time)
  const enrichedRooms = useMemo(() => {
    return rooms.map((rm) => {
      const rmTasks = tasks.filter((t) => t.roomNumber === rm.number);
      const openTask = rmTasks.find((t) => t.status !== 'Completed');
      const latestCompleted = rmTasks.find((t) => t.status === 'Completed');
      const stage = resolveRoomHkStage(rm);
      const effectiveStaff =
        rm.assignedStaff ||
        openTask?.assignedTo ||
        (stage !== 'Clean' ? '' : latestCompleted?.assignedTo || '');
      const effectivePriority: HkPriority =
        rm.housekeepingPriority || openTask?.priority || (stage === 'Dirty' ? 'Normal' : 'Normal');
      const effectiveNotes =
        rm.housekeepingNotes || openTask?.notes || openTask?.description || '';
      const completedTimestamp =
        rm.cleaningCompletedAt ||
        rm.verificationTime ||
        latestCompleted?.completedAt ||
        latestCompleted?.inspectedAt ||
        '';
      return {
        room: rm,
        stage,
        effectiveStaff:
          effectiveStaff && effectiveStaff !== 'Unassigned' ? effectiveStaff : '',
        effectivePriority,
        effectiveNotes,
        completedTimestamp,
        openTask,
      };
    });
  }, [rooms, tasks]);

  // Distinct Floors for Floor Filter Pills
  const uniqueFloors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      const f = String(r.floor || '1st Floor').trim();
      if (f) set.add(f);
    });
    return Array.from(set);
  }, [rooms]);

  // KPI Counts
  const totalRoomsCount = rooms.length;
  const cleanCount = enrichedRooms.filter(
    (x) => x.room.status !== 'Out of Service' && x.stage === 'Clean'
  ).length;
  const dirtyCount = enrichedRooms.filter(
    (x) => x.room.status !== 'Out of Service' && x.stage === 'Dirty'
  ).length;
  const inProgressCount = enrichedRooms.filter(
    (x) => x.room.status !== 'Out of Service' && x.stage === 'In Progress'
  ).length;
  const inspectionCount = enrichedRooms.filter(
    (x) => x.room.status !== 'Out of Service' && x.stage === 'Inspection'
  ).length;
  const cleanPct = totalRoomsCount > 0 ? Math.round((cleanCount / totalRoomsCount) * 100) : 0;
  const dirtyPct = totalRoomsCount > 0 ? Math.round((dirtyCount / totalRoomsCount) * 100) : 0;

  // Filtered Rooms for Board / Table / Attendant Views
  const filteredRooms = useMemo(() => {
    const q1 = globalSearch.trim().toLowerCase();
    const q2 = roomBoxSearch.trim().toLowerCase();
    return enrichedRooms.filter((item) => {
      const { room, stage, effectiveStaff, effectivePriority, effectiveNotes } = item;
      const floorLabel = String(room.floor || '1st Floor').trim();
      if (selectedFloor !== 'ALL' && floorLabel !== selectedFloor) return false;

      if (statusFilter === 'Out of Service') {
        if (room.status !== 'Out of Service') return false;
      } else if (statusFilter !== 'ALL') {
        if (room.status === 'Out of Service' || stage !== statusFilter) return false;
      }

      if (priorityFilter !== 'ALL' && effectivePriority !== priorityFilter) return false;

      if (q1) {
        const hay = `${room.number} ${room.category} ${floorLabel} ${effectiveStaff} ${effectiveNotes} ${
          room.currentGuestName || ''
        }`.toLowerCase();
        if (!hay.includes(q1)) return false;
      }
      if (q2) {
        const hay2 = `${room.number} ${room.category} ${floorLabel}`.toLowerCase();
        if (!hay2.includes(q2)) return false;
      }
      return true;
    });
  }, [
    enrichedRooms,
    selectedFloor,
    statusFilter,
    priorityFilter,
    globalSearch,
    roomBoxSearch,
  ]);

  // Apply Room Housekeeping Update (Status / Staff / Priority / Notes / Out-of-Order)
  const applyHousekeepingPatch = (roomNums: string[], patch: RoomHousekeepingPatch) => {
    if (roomNums.length === 0) return;
    if (onUpdateRoomHousekeeping) {
      onUpdateRoomHousekeeping(roomNums, patch);
      return;
    }
    // Fallback if legacy handler only
    roomNums.forEach((rn) => {
      const rm = rooms.find((r) => r.number === rn);
      if (!rm) return;
      if (patch.cleaningStatus === 'Clean') {
        const openT = tasks.find((t) => t.roomNumber === rn && t.status !== 'Completed');
        if (openT) onCompleteTask(openT.id);
      } else {
        onAddTask({
          roomId: rm.id,
          roomName: rm.name,
          roomNumber: rm.number,
          category: rm.category,
          floor: rm.floor,
          description: patch.notes || 'Room Cleaning & Turnaround',
          notes: patch.notes,
          priority: patch.priority || 'Normal',
          taskType: patch.cleaningStatus === 'Inspection' ? 'Inspection' : 'Cleaning',
          assignedTo: patch.assignedStaff || 'Housekeeping Staff',
          timing: new Date().toLocaleString('en-IN'),
          status:
            patch.cleaningStatus === 'In Progress'
              ? 'In Progress'
              : patch.cleaningStatus === 'Inspection'
              ? 'Inspection'
              : 'Pending',
          checklist: sopChecklist,
        });
      }
    });
  };

  // Open Single-Room Modal
  const openRoomDetailModal = (item: (typeof enrichedRooms)[number]) => {
    setEditingRoom(item.room);
    setModalStage(item.stage);
    setModalStaff(item.effectiveStaff || sortedStaff[0]?.name || '');
    setModalCustomStaff(false);
    setModalPriority(item.effectivePriority || 'Normal');
    setModalNotes(item.effectiveNotes || '');
    setModalOutOfOrder(item.room.status === 'Out of Service');
    setModalOutOfOrderReason(item.room.blockedReason || '');
    const initialSop: Record<string, boolean> = {};
    sopChecklist.forEach((s) => {
      initialSop[s] = item.stage === 'Clean' || item.stage === 'Inspection';
    });
    setModalCheckedSop(initialSop);
  };

  const handleSaveRoomModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    const completedSteps = sopChecklist.filter((s) => modalCheckedSop[s]);
    applyHousekeepingPatch([editingRoom.number], {
      cleaningStatus: modalStage,
      assignedStaff: modalStaff.trim() || 'Unassigned',
      priority: modalPriority,
      notes: modalNotes.trim(),
      markOutOfOrder: modalOutOfOrder,
      outOfOrderReason: modalOutOfOrder ? modalOutOfOrderReason.trim() || 'Maintenance / Out of Order' : undefined,
      checklist: completedSteps,
    });
    showToast(
      modalOutOfOrder
        ? `Room ${editingRoom.number} marked Out of Order.`
        : `Updated Room ${editingRoom.number} -> ${modalStage}${
            modalStaff.trim() ? ` (${modalStaff.trim()})` : ''
          }.`,
      'success'
    );
    setEditingRoom(null);
  };

  // Open Bulk "+ Assign Staff" Modal
  const openBulkAssignModal = () => {
    const dirtyRoomNums = enrichedRooms
      .filter((x) => x.stage !== 'Clean' && x.room.status !== 'Out of Service')
      .map((x) => x.room.number);
    setBulkSelectedRooms(dirtyRoomNums);
    setBulkStaff(sortedStaff[0]?.name || '');
    setBulkCustomStaff(false);
    setBulkStage('Dirty');
    setBulkPriority('High');
    setBulkNotes('');
    setShowAssignModal(true);
  };

  const handleConfirmBulkAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkSelectedRooms.length === 0) {
      showToast('Please select at least one room to assign.', 'warning');
      return;
    }
    if (!bulkStaff.trim()) {
      showToast('Please select or enter a housekeeping staff name.', 'warning');
      return;
    }
    applyHousekeepingPatch(bulkSelectedRooms, {
      cleaningStatus: bulkStage,
      assignedStaff: bulkStaff.trim(),
      priority: bulkPriority,
      notes: bulkNotes.trim() || `Assigned to ${bulkStaff.trim()}`,
      checklist: sopChecklist,
    });
    showToast(
      `Assigned ${bulkStaff.trim()} to ${bulkSelectedRooms.length} room(s) (${bulkPriority} priority).`,
      'success'
    );
    setShowAssignModal(false);
  };

  // CSV Export Report
  const handleExportCsv = () => {
    const headers = [
      'Room Number',
      'Category',
      'Floor',
      'Front Office Status',
      'Housekeeping Status',
      'Assigned Staff',
      'Priority',
      'Cleaning Notes',
      'Completed / Verified At',
      'Verified By',
    ];
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = enrichedRooms.map((item) => [
      item.room.number,
      item.room.category,
      item.room.floor || '1st Floor',
      item.room.status,
      item.room.status === 'Out of Service' ? 'Out of Order' : item.stage,
      item.effectiveStaff || 'Unassigned',
      item.effectivePriority,
      item.effectiveNotes,
      item.completedTimestamp,
      item.room.verifiedBy || '',
    ]);
    const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DirectStay_Housekeeping_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported Housekeeping Report CSV.', 'success');
  };

  // Legacy Form Handlers (Queue / Laundry / Lost & Found / SOP)
  const handleAddChecklistStep = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newChecklistStep.trim();
    if (!trimmed) return;
    if (!sopChecklist.includes(trimmed)) {
      saveSopChecklist([...sopChecklist, trimmed]);
    }
    setNewChecklistStep('');
  };

  const handleRemoveChecklistStep = (stepToRemove: string) => {
    saveSopChecklist(sopChecklist.filter((s) => s !== stepToRemove));
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const rm = rooms.find((r) => r.number === selectedRoomNumber) || rooms[0];
    const roomNum = rm?.number || selectedRoomNumber.trim() || '101';
    const chosenStaff = assignedTo.trim() || sortedStaff[0]?.name || 'Housekeeping Staff';
    if (onUpdateRoomHousekeeping) {
      onUpdateRoomHousekeeping([roomNum], {
        cleaningStatus: 'Dirty',
        assignedStaff: chosenStaff,
        priority: taskPriority,
        notes: taskDesc.trim() || 'Room Cleaning & Sanitization',
        checklist: sopChecklist.length > 0 ? sopChecklist : DEFAULT_SOP_CHECKLIST,
      });
    } else {
      onAddTask({
        roomId: rm?.id || `rm-${roomNum}`,
        roomName: rm?.name || `Room ${roomNum}`,
        roomNumber: roomNum,
        category: rm?.category || 'Standard',
        floor: rm?.floor || '1st Floor',
        description: taskDesc.trim() || 'Room Cleaning & Sanitization',
        notes: taskDesc.trim(),
        priority: taskPriority,
        taskType: 'Cleaning',
        assignedTo: chosenStaff,
        timing: new Date().toLocaleString('en-IN'),
        status: 'Pending',
        checklist: sopChecklist.length > 0 ? sopChecklist : DEFAULT_SOP_CHECKLIST,
      });
    }
    showToast(`Queued cleaning task for Room ${roomNum} (${chosenStaff}).`, 'success');
    setTaskDesc('');
  };

  const handleCreateLaundry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!laundryItems.trim()) return;
    const rm = rooms.find((r) => r.number === laundryRoom) || rooms[0];
    onAddLaundryOrder({
      orderNumber: `LND-${Math.floor(1000 + Math.random() * 9000)}`,
      orderType: 'Guest Laundry',
      roomNumber: laundryRoom || rm?.number || '101',
      guestName: rm?.currentGuestName || 'In-House Guest',
      itemsSummary: laundryItems.trim(),
      totalAmount: laundryAmount,
      paymentStatus: 'Billed to Room',
      deliveryStatus: 'In Wash',
      date: new Date().toLocaleString('en-IN'),
      handledBy: assignedTo.trim() || 'Laundry Desk',
    });
    setLaundryItems('');
    setLaundryAmount(0);
  };

  const handleCreateLostFound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lfItemName.trim()) return;
    const newItem: Omit<LostFoundRecord, 'id'> = {
      itemName: lfItemName.trim(),
      category: lfCategory,
      roomNumber: lfRoom.trim() || rooms[0]?.number || 'Lobby',
      foundBy: lfFoundBy.trim() || 'Housekeeping Staff',
      dateFound: new Date().toISOString().slice(0, 10),
      status: 'Registered',
    };
    setLocalLostFound((prev) => [{ id: `lf-${Date.now()}`, ...newItem }, ...prev]);
    if (onAddLostFound) onAddLostFound(newItem);
    setLfItemName('');
    setLfRoom('');
    setLfFoundBy('');
  };

  // Group rooms by Attendant for "By Attendant" View
  const attendantGroups = useMemo(() => {
    const map = new Map<string, typeof filteredRooms>();
    sortedStaff.forEach((s) => {
      if (s.department === 'Housekeeping' || s.role === 'Housekeeping') {
        map.set(s.name, []);
      }
    });
    filteredRooms.forEach((item) => {
      const key = item.effectiveStaff || 'Unassigned';
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    });
    return Array.from(map.entries()).filter(
      ([name, list]) => list.length > 0 || name !== 'Unassigned'
    );
  }, [filteredRooms, sortedStaff]);

  const normalizedSub =
    activeSubTab === 'settings' ? 'reports' : activeSubTab || 'dashboard';

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* TOP HEADER BAR: TITLE, SUB-TABS, EXPORT CSV & "+ ASSIGN STAFF"        */}
      {/* ===================================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Housekeeping</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time Room Turnaround • Dirty → Cleaning in Progress → Inspection → Clean/Ready • Front Office Synced
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onToggleAutoMarkDirty && (
              <button
                type="button"
                onClick={() => onToggleAutoMarkDirty(!autoMarkDirtyOnCheckout)}
                title="Automatically mark rooms Dirty and queue cleaning when a guest checks out"
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  autoMarkDirtyOnCheckout
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    autoMarkDirtyOnCheckout ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                <span>Auto-Dirty on Checkout: {autoMarkDirtyOnCheckout ? 'ON' : 'OFF'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={openBulkAssignModal}
              className="px-4 py-2 rounded-xl bg-[#C49A3A] hover:bg-[#b0882e] text-[#17120F] font-extrabold text-xs inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Assign Staff</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {SUB_TABS.map((t) => {
            const isActive = normalizedSub === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSubTabChange(t.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MAIN HOUSEKEEPING BOARD, TABLE & BY-ATTENDANT WORKSPACE               */}
      {/* ===================================================================== */}
      {normalizedSub === 'dashboard' && (
        <div className="space-y-4">
          {/* 5 Summary KPI Cards (Screenshot Reference Design + All 5 Required Statuses) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {/* 1. Total Rooms */}
            <div
              onClick={() => setStatusFilter('ALL')}
              className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-slate-800 p-4 shadow-2xs cursor-pointer hover:shadow-sm transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Total Rooms
                </span>
                <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 my-2">{totalRoomsCount}</div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-500 font-medium">Managed Units</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                  {totalRoomsCount} Total
                </span>
              </div>
            </div>

            {/* 2. Clean */}
            <div
              onClick={() => setStatusFilter('Clean')}
              className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 p-4 shadow-2xs cursor-pointer hover:shadow-sm transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Clean
                </span>
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 inline-flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 my-2">{cleanCount}</div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-500 font-medium">{cleanPct}% of inventory</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                  Guest Ready
                </span>
              </div>
            </div>

            {/* 3. Dirty */}
            <div
              onClick={() => setStatusFilter('Dirty')}
              className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-rose-500 p-4 shadow-2xs cursor-pointer hover:shadow-sm transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Dirty
                </span>
                <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 inline-flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 my-2">{dirtyCount}</div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-500 font-medium">{dirtyPct}% need turnover</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold">
                  Requires Cleaning
                </span>
              </div>
            </div>

            {/* 4. Cleaning in Progress */}
            <div
              onClick={() => setStatusFilter('In Progress')}
              className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-amber-500 p-4 shadow-2xs cursor-pointer hover:shadow-sm transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Cleaning in Progress
                </span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 inline-flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 my-2">{inProgressCount}</div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-500 font-medium">Active turnaround</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold">
                  In Progress
                </span>
              </div>
            </div>

            {/* 5. Inspection Pending */}
            <div
              onClick={() => setStatusFilter('Inspection')}
              className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-slate-200 border-l-4 border-l-indigo-500 p-4 shadow-2xs cursor-pointer hover:shadow-sm transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Inspection Pending
                </span>
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 inline-flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 my-2">{inspectionCount}</div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-slate-500 font-medium">Supervisor check</span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                  Pending Verify
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Bar: Board View | Table View | By Attendant + Search & Priority Filter */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="inline-flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs w-fit">
              <button
                type="button"
                onClick={() => setViewLayout('board')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewLayout === 'board'
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Board View
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewLayout === 'table'
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('attendant')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewLayout === 'attendant'
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Attendant
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search room, attendant, category..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 w-full sm:w-60"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-600">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Workspace Container with Floor Filter Pills + Room Search + Status Dropdown */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Dynamic Floor Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedFloor('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedFloor === 'ALL'
                      ? 'bg-[#C49A3A] text-[#17120F] shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Floors
                </button>
                {uniqueFloors.map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setSelectedFloor(fl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedFloor === fl
                        ? 'bg-[#C49A3A] text-[#17120F] shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {fl}
                  </button>
                ))}
              </div>

              {/* Room Filter Input + Status Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={roomBoxSearch}
                    onChange={(e) => setRoomBoxSearch(e.target.value)}
                    placeholder="Search room..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 w-36 sm:w-44"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Clean">Clean / Guest Ready</option>
                  <option value="Dirty">Dirty</option>
                  <option value="In Progress">Cleaning in Progress</option>
                  <option value="Inspection">Inspection Pending</option>
                  <option value="Out of Service">Out of Order</option>
                </select>
              </div>
            </div>

            {/* --------------------------------------------------------------- */}
            {/* LAYOUT 1: BOARD VIEW (Individual Room Cards Grid)               */}
            {/* --------------------------------------------------------------- */}
            {viewLayout === 'board' && (
              <>
                {filteredRooms.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                    No rooms match the selected floor/status filters.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                    {filteredRooms.map((item) => {
                      const {
                        room,
                        stage,
                        effectiveStaff,
                        effectivePriority,
                        effectiveNotes,
                        completedTimestamp,
                      } = item;
                      const isOoo = room.status === 'Out of Service';
                      const borderAccent = isOoo
                        ? 'border-l-slate-500'
                        : stage === 'Clean'
                        ? 'border-l-emerald-500'
                        : stage === 'Dirty'
                        ? 'border-l-rose-500'
                        : stage === 'In Progress'
                        ? 'border-l-amber-500'
                        : 'border-l-indigo-500';

                      const badgeClasses = isOoo
                        ? 'bg-slate-200 text-slate-800'
                        : stage === 'Clean'
                        ? 'bg-emerald-50 text-emerald-700'
                        : stage === 'Dirty'
                        ? 'bg-rose-50 text-rose-700'
                        : stage === 'In Progress'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-indigo-50 text-indigo-700';

                      const badgeText = isOoo
                        ? '• Blocked'
                        : stage === 'In Progress'
                        ? '• In Progress'
                        : stage === 'Inspection'
                        ? '• Inspection'
                        : `• ${stage}`;

                      return (
                        <div
                          key={room.id}
                          onClick={() => openRoomDetailModal(item)}
                          className={`group rounded-2xl border border-slate-200/90 border-l-4 ${borderAccent} bg-white hover:shadow-md transition p-3.5 flex flex-col justify-between cursor-pointer space-y-3`}
                        >
                          <div className="space-y-1.5">
                            {/* Room Number & Status Badge */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-base font-extrabold text-slate-900 tracking-tight font-mono">
                                {room.number}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap ${badgeClasses}`}
                              >
                                {badgeText}
                              </span>
                            </div>

                            {/* Category + Occupancy Tag */}
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-bold text-slate-700 truncate">
                                {room.category}
                              </span>
                              {room.status === 'Occupied' && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 text-[9.5px] font-bold shrink-0">
                                  Occupied
                                </span>
                              )}
                            </div>

                            {/* Priority / Notes / Completion Timestamp */}
                            {(effectivePriority === 'Urgent' ||
                              effectivePriority === 'High' ||
                              effectiveNotes ||
                              completedTimestamp) && (
                              <div className="pt-1 space-y-1">
                                {(effectivePriority === 'Urgent' || effectivePriority === 'High') &&
                                  stage !== 'Clean' && (
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ${
                                        effectivePriority === 'Urgent'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-amber-100 text-amber-900'
                                      }`}
                                    >
                                      <Flag className="w-2.5 h-2.5" />
                                      {effectivePriority} Priority
                                    </span>
                                  )}
                                {effectiveNotes && stage !== 'Clean' && (
                                  <p className="text-[10.5px] text-slate-500 line-clamp-1">
                                    {effectiveNotes}
                                  </p>
                                )}
                                {stage === 'Clean' && completedTimestamp && (
                                  <p className="text-[10px] text-emerald-700 font-medium truncate">
                                    ✓ Ready: {completedTimestamp}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Bottom Row: Assigned Staff & Floor Pill + Quick Stage Advance */}
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-800 inline-flex items-center justify-center shrink-0">
                                  <Users className="w-3 h-3" />
                                </span>
                                <span
                                  className={`truncate ${
                                    effectiveStaff
                                      ? 'font-bold text-slate-800'
                                      : 'italic text-slate-400'
                                  }`}
                                >
                                  {effectiveStaff || 'Unassigned'}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-amber-50/90 text-amber-950 font-bold text-[10px] shrink-0">
                                {room.floor || '1st Floor'}
                              </span>
                            </div>

                            {!isOoo && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const targetNext: HkStage =
                                    stage === 'Clean' ? 'Dirty' : nextHkStage(stage);
                                  applyHousekeepingPatch([room.number], {
                                    cleaningStatus: targetNext,
                                    assignedStaff: effectiveStaff || undefined,
                                    priority: effectivePriority,
                                    notes: effectiveNotes,
                                  });
                                  showToast(
                                    `Room ${room.number} marked as ${
                                      targetNext === 'Clean' ? 'Clean & Ready' : targetNext
                                    }.`,
                                    'success'
                                  );
                                }}
                                className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                  stage === 'Dirty'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : stage === 'In Progress'
                                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                                    : stage === 'Inspection'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                              >
                                <span>{nextStageButtonLabel(stage)}</span>
                                {stage !== 'Clean' && <ArrowRight className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* --------------------------------------------------------------- */}
            {/* LAYOUT 2: TABLE VIEW                                            */}
            {/* --------------------------------------------------------------- */}
            {viewLayout === 'table' && (
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[780px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10.5px] font-bold uppercase text-slate-500 border-y border-slate-200">
                      <th className="py-3 px-3.5">Room</th>
                      <th className="py-3 px-3.5">Category &amp; Floor</th>
                      <th className="py-3 px-3.5">Front Office</th>
                      <th className="py-3 px-3.5">Housekeeping Status</th>
                      <th className="py-3 px-3.5">Priority</th>
                      <th className="py-3 px-3.5">Assigned Staff</th>
                      <th className="py-3 px-3.5">Notes / Completed At</th>
                      <th className="py-3 px-3.5 text-right">Workflow Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRooms.map((item) => {
                      const {
                        room,
                        stage,
                        effectiveStaff,
                        effectivePriority,
                        effectiveNotes,
                        completedTimestamp,
                      } = item;
                      const isOoo = room.status === 'Out of Service';

                      return (
                        <tr key={room.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3.5 font-extrabold text-slate-900 font-mono text-sm">
                            {room.number}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-slate-800">{room.category}</div>
                            <div className="text-[11px] text-slate-400">{room.floor || '1st Floor'}</div>
                          </td>
                          <td className="py-3 px-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                room.status === 'Occupied'
                                  ? 'bg-sky-100 text-sky-800'
                                  : room.status === 'Confirmed'
                                  ? 'bg-amber-100 text-amber-900'
                                  : room.status === 'Out of Service'
                                  ? 'bg-slate-200 text-slate-700'
                                  : room.status === 'Dirty'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {room.status}
                              {room.currentGuestName ? ` • ${room.currentGuestName}` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            {isOoo ? (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-[11px]">
                                Out of Order
                              </span>
                            ) : (
                              <select
                                value={stage}
                                onChange={(e) => {
                                  const nextSt = e.target.value as HkStage;
                                  applyHousekeepingPatch([room.number], {
                                    cleaningStatus: nextSt,
                                    assignedStaff: effectiveStaff || undefined,
                                    priority: effectivePriority,
                                    notes: effectiveNotes,
                                  });
                                  showToast(`Room ${room.number} -> ${nextSt}`, 'success');
                                }}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                                  stage === 'Clean'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : stage === 'Dirty'
                                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                                    : stage === 'In Progress'
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                }`}
                              >
                                <option value="Dirty">Dirty</option>
                                <option value="In Progress">Cleaning in Progress</option>
                                <option value="Inspection">Inspection</option>
                                <option value="Clean">Clean / Ready</option>
                              </select>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <select
                              value={effectivePriority}
                              onChange={(e) =>
                                applyHousekeepingPatch([room.number], {
                                  cleaningStatus: stage,
                                  assignedStaff: effectiveStaff || undefined,
                                  priority: e.target.value as HkPriority,
                                  notes: effectiveNotes,
                                })
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-bold text-[11px]"
                            >
                              <option value="Low">Low</option>
                              <option value="Normal">Normal</option>
                              <option value="High">High</option>
                              <option value="Urgent">Urgent</option>
                            </select>
                          </td>
                          <td className="py-3 px-3.5">
                            <select
                              value={effectiveStaff || ''}
                              onChange={(e) => {
                                applyHousekeepingPatch([room.number], {
                                  cleaningStatus: stage,
                                  assignedStaff: e.target.value || 'Unassigned',
                                  priority: effectivePriority,
                                  notes: effectiveNotes,
                                });
                                showToast(
                                  e.target.value
                                    ? `Assigned ${e.target.value} to Room ${room.number}.`
                                    : `Unassigned Room ${room.number}.`,
                                  'info'
                                );
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 text-[11px]"
                            >
                              <option value="">Unassigned</option>
                              {sortedStaff.map((s) => (
                                <option key={s.id} value={s.name}>
                                  {s.name} ({s.role})
                                </option>
                              ))}
                              {effectiveStaff &&
                                !sortedStaff.some((s) => s.name === effectiveStaff) && (
                                  <option value={effectiveStaff}>{effectiveStaff}</option>
                                )}
                            </select>
                          </td>
                          <td className="py-3 px-3.5 max-w-[200px]">
                            {effectiveNotes && (
                              <div className="text-slate-700 truncate" title={effectiveNotes}>
                                {effectiveNotes}
                              </div>
                            )}
                            {completedTimestamp && (
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                Done: {completedTimestamp}
                              </div>
                            )}
                            {!effectiveNotes && !completedTimestamp && (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap space-x-1.5">
                            {!isOoo && stage !== 'Clean' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextSt = nextHkStage(stage);
                                  applyHousekeepingPatch([room.number], {
                                    cleaningStatus: nextSt,
                                    assignedStaff: effectiveStaff || undefined,
                                    priority: effectivePriority,
                                    notes: effectiveNotes,
                                  });
                                  showToast(`Room ${room.number} -> ${nextSt}`, 'success');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                              >
                                {nextStageButtonLabel(stage)}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openRoomDetailModal(item)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] cursor-pointer"
                            >
                              Notes / Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* LAYOUT 3: BY ATTENDANT VIEW                                     */}
            {/* --------------------------------------------------------------- */}
            {viewLayout === 'attendant' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {attendantGroups.map(([attendantName, assignedList]) => {
                  const doneInGroup = assignedList.filter((x) => x.stage === 'Clean').length;
                  const pct =
                    assignedList.length > 0
                      ? Math.round((doneInGroup / assignedList.length) * 100)
                      : 0;
                  const staffMeta = sortedStaff.find((s) => s.name === attendantName);

                  return (
                    <div
                      key={attendantName}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-9 h-9 rounded-xl font-extrabold text-xs inline-flex items-center justify-center ${
                                attendantName === 'Unassigned'
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-slate-900 text-amber-400'
                              }`}
                            >
                              {attendantName.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                {attendantName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {staffMeta
                                  ? `${staffMeta.role} • ${staffMeta.shift}`
                                  : attendantName === 'Unassigned'
                                  ? 'Awaiting staff allocation'
                                  : 'Housekeeping Attendant'}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-800">
                            {assignedList.length} Rooms
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10.5px] font-bold text-slate-500">
                            <span>
                              {doneInGroup}/{assignedList.length} Clean
                            </span>
                            <span>{pct}% Ready</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Assigned Room Pills */}
                        <div className="space-y-2 pt-1 max-h-64 overflow-y-auto pr-1">
                          {assignedList.length === 0 ? (
                            <div className="p-3 rounded-xl bg-white border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                              No rooms currently assigned to {attendantName}.
                            </div>
                          ) : (
                            assignedList.map((item) => (
                              <div
                                key={item.room.id}
                                onClick={() => openRoomDetailModal(item)}
                                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 flex items-center justify-between gap-2 text-xs cursor-pointer transition"
                              >
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900">
                                    Room {item.room.number}{' '}
                                    <span className="font-normal text-slate-500">
                                      • {item.room.category}
                                    </span>
                                  </div>
                                  {item.effectiveNotes && (
                                    <div className="text-[10.5px] text-slate-500 truncate">
                                      {item.effectiveNotes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      item.stage === 'Clean'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : item.stage === 'Dirty'
                                        ? 'bg-rose-50 text-rose-700'
                                        : item.stage === 'In Progress'
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'bg-indigo-50 text-indigo-700'
                                    }`}
                                  >
                                    {item.stage}
                                  </span>
                                  {item.stage !== 'Clean' && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextSt = nextHkStage(item.stage);
                                        applyHousekeepingPatch([item.room.number], {
                                          cleaningStatus: nextSt,
                                          assignedStaff: item.effectiveStaff || undefined,
                                          priority: item.effectivePriority,
                                          notes: item.effectiveNotes,
                                        });
                                      }}
                                      className="px-2 py-0.5 rounded bg-slate-900 text-amber-400 text-[10px] font-bold cursor-pointer"
                                    >
                                      Next →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: TASK QUEUE & DISPATCH LOG (Preserved & Enhanced)           */}
      {/* ===================================================================== */}
      {normalizedSub === 'room_cleaning' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateTask}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit"
          >
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Dispatch Room Cleaning Task
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Select Room</label>
                <select
                  value={selectedRoomNumber}
                  onChange={(e) => setSelectedRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      {r.name} ({r.category} • {resolveRoomHkStage(r)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Task Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as HkPriority)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-600">Assign Attendant (Staff)</label>
                  {sortedStaff.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomStaff((v) => !v)}
                      className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                    >
                      {isCustomStaff ? 'Select from Staff List' : '+ Type Custom Name'}
                    </button>
                  )}
                </div>
                {sortedStaff.length > 0 && !isCustomStaff ? (
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                  >
                    <option value="">-- Select Staff Member --</option>
                    {sortedStaff.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.role} • {s.department})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="Enter staff name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Cleaning Notes</label>
                <textarea
                  rows={3}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="e.g., Deep clean washroom, replace linen, VIP arrival at 2 PM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create &amp; Dispatch Task
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Housekeeping Task &amp; Completion Log ({tasks.length})
              </h3>
              <span className="text-xs text-slate-500">
                Synced with Room Board &amp; Front Desk Availability
              </span>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Notes &amp; Priority</th>
                    <th className="py-3 px-4">Assigned Staff</th>
                    <th className="py-3 px-4">Stage &amp; Timestamps</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        No housekeeping tasks logged yet. Tasks are auto-created on Guest Check-Out or via Assign Staff.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-extrabold text-slate-900">{task.roomName}</div>
                          <div className="text-[10px] text-slate-400">{task.category}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {task.priority && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                  task.priority === 'Urgent'
                                    ? 'bg-rose-100 text-rose-800'
                                    : task.priority === 'High'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {task.priority}
                              </span>
                            )}
                            <span className="font-semibold text-slate-800">{task.description}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Queued: {task.timing}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700 whitespace-nowrap">
                          {task.assignedTo}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              task.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : task.status === 'Inspection'
                                ? 'bg-indigo-100 text-indigo-800'
                                : task.status === 'In Progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {task.status === 'Completed' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {task.status === 'Pending' ? 'Dirty / Queued' : task.status}
                          </span>
                          {task.completedAt && (
                            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Done: {task.completedAt}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {task.status !== 'Completed' ? (
                            <button
                              type="button"
                              onClick={() => onCompleteTask(task.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Mark Clean &amp; Ready
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600">
                              ✓ Synced Clean
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: LAUNDRY & LINEN DESK (100% Preserved)                      */}
      {/* ===================================================================== */}
      {normalizedSub === 'laundry' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateLaundry}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shirt className="w-4 h-4 text-blue-600" />
              New Guest Laundry Order
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Guest Room</label>
                <select
                  value={laundryRoom}
                  onChange={(e) => setLaundryRoom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      {r.name} ({r.currentGuestName || r.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Garment Items Summary *</label>
                <input
                  type="text"
                  required
                  value={laundryItems}
                  onChange={(e) => setLaundryItems(e.target.value)}
                  placeholder="e.g., 2x Shirts, 1x Trouser (Wash & Iron)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Total Charge (₹) — Posted to Room Folio
                </label>
                <input
                  type="number"
                  min={0}
                  value={laundryAmount || ''}
                  onChange={(e) => setLaundryAmount(Number(e.target.value))}
                  placeholder="250"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs cursor-pointer"
            >
              + Create Laundry Order &amp; Post to Folio
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Room &amp; Guest</th>
                    <th className="py-3 px-4">Garments</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Billing</th>
                    <th className="py-3 px-4">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {laundryOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No laundry orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    laundryOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td className="py-3.5 px-4 font-bold whitespace-nowrap">{ord.orderNumber}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold">Room {ord.roomNumber}</div>
                          <div className="text-[11px] text-slate-500">{ord.guestName}</div>
                        </td>
                        <td className="py-3.5 px-4">{ord.itemsSummary}</td>
                        <td className="py-3.5 px-4 font-extrabold whitespace-nowrap">
                          {formatCurrency(ord.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-blue-700 whitespace-nowrap">
                          {ord.deliveryStatus}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: LOST & FOUND REGISTER (100% Preserved)                     */}
      {/* ===================================================================== */}
      {normalizedSub === 'lost_found' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateLostFound}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PackageSearch className="w-4 h-4 text-amber-600" />
              + Register Found Guest Item
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Item Description *</label>
                <input
                  type="text"
                  required
                  value={lfItemName}
                  onChange={(e) => setLfItemName(e.target.value)}
                  placeholder="e.g., Apple iPhone Charger, Gold Ring"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Category</label>
                <select
                  value={lfCategory}
                  onChange={(e) => setLfCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Jewelry / Watch">Jewelry / Watch</option>
                  <option value="Documents / Wallet">Documents / Wallet</option>
                  <option value="Clothing / Bag">Clothing / Bag</option>
                  <option value="Other Personal Item">Other Personal Item</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Room / Area Found</label>
                  <input
                    type="text"
                    value={lfRoom}
                    onChange={(e) => setLfRoom(e.target.value)}
                    placeholder="e.g., 102 or Lobby"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Found By Staff</label>
                  {sortedStaff.length > 0 ? (
                    <select
                      value={lfFoundBy}
                      onChange={(e) => setLfFoundBy(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                    >
                      <option value="">-- Select Staff --</option>
                      {sortedStaff.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={lfFoundBy}
                      onChange={(e) => setLfFoundBy(e.target.value)}
                      placeholder="Staff Name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  )}
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs cursor-pointer"
            >
              + Log Lost &amp; Found Item
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Lost &amp; Found Guest Property Register</h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Item Found</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Room #</th>
                    <th className="py-3 px-4">Found By</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localLostFound.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No lost &amp; found items registered yet.
                      </td>
                    </tr>
                  ) : (
                    localLostFound.map((lf) => (
                      <tr key={lf.id}>
                        <td className="py-3 px-4 font-bold text-slate-900">{lf.itemName}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{lf.category}</td>
                        <td className="py-3 px-4 font-bold whitespace-nowrap">Room {lf.roomNumber}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{lf.foundBy}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{lf.dateFound}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {lf.status === 'Returned to Guest' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Returned to Guest
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setLocalLostFound((prev) =>
                                  prev.map((it) =>
                                    it.id === lf.id ? { ...it, status: 'Returned to Guest' } : it
                                  )
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Mark Returned
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5: STAFF PRODUCTIVITY & SOP CHECKLISTS (Preserved)            */}
      {/* ===================================================================== */}
      {normalizedSub === 'reports' && (() => {
        const completedTasksCount = tasks.filter((t) => t.status === 'Completed').length;
        const pendingTasksCount = tasks.filter((t) => t.status !== 'Completed').length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Housekeeping Turnaround SOP Checklist ({sopChecklist.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Standard room cleaning &amp; supervisor inspection steps
                </p>
              </div>

              <form onSubmit={handleAddChecklistStep} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistStep}
                  onChange={(e) => setNewChecklistStep(e.target.value)}
                  placeholder="Add new checklist step..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Step</span>
                </button>
              </form>

              <div className="space-y-2 text-xs text-slate-700">
                {sopChecklist.map((step, i) => {
                  const isChecked = checkedSopSteps[step] !== false;
                  return (
                    <div
                      key={`${step}-${i}`}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCheckedSopSteps((prev) => ({
                            ...prev,
                            [step]: prev[step] === false ? true : false,
                          }))
                        }
                        className="flex items-center gap-2.5 text-left flex-1 cursor-pointer"
                      >
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            isChecked ? 'text-emerald-600' : 'text-slate-300'
                          }`}
                        />
                        <span className={isChecked ? 'font-semibold text-slate-800' : 'text-slate-400 line-through'}>
                          {step}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistStep(step)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Attendant Turnaround Productivity
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Completed vs. pending assignments per housekeeping attendant
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">
                    Clean &amp; Ready Rooms
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-900 mt-1">{cleanCount}</div>
                  <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                    {completedTasksCount} Tasks Completed
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[10px] font-bold uppercase text-amber-800">
                    Active Queue
                  </div>
                  <div className="text-2xl font-extrabold text-amber-900 mt-1">
                    {dirtyCount + inProgressCount + inspectionCount}
                  </div>
                  <div className="text-[11px] font-semibold text-amber-700 mt-1">
                    {pendingTasksCount} Open Logs
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {sortedStaff.map((s) => {
                  const done = tasks.filter(
                    (t) => t.assignedTo === s.name && t.status === 'Completed'
                  ).length;
                  const open = enrichedRooms.filter(
                    (x) => x.effectiveStaff === s.name && x.stage !== 'Clean'
                  ).length;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[10.5px] text-slate-500">
                          {s.role} • {s.shift}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 font-bold text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {done} Cleaned
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                          {open} Active
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MODAL 1: INDIVIDUAL ROOM HOUSEKEEPING WORKFLOW & NOTES MODAL          */}
      {/* ===================================================================== */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-400">
                  Room {editingRoom.number} — {editingRoom.category} ({editingRoom.floor || '1st Floor'})
                </h3>
                <p className="text-[11px] text-slate-300">
                  Front Office Status: {editingRoom.status}
                  {editingRoom.currentGuestName ? ` • Guest: ${editingRoom.currentGuestName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoomModal} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* 4-Stage Status Pipeline */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Cleaning Status Pipeline
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Dirty', 'In Progress', 'Inspection', 'Clean'] as HkStage[]).map((st) => {
                    const active = !modalOutOfOrder && modalStage === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setModalOutOfOrder(false);
                          setModalStage(st);
                        }}
                        className={`py-2 px-2.5 rounded-xl border font-bold text-[11px] transition cursor-pointer ${
                          active
                            ? st === 'Clean'
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : st === 'Dirty'
                              ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                              : st === 'In Progress'
                              ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xs'
                              : 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {st === 'In Progress' ? 'Cleaning' : st === 'Clean' ? 'Clean / Ready' : st}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Assigned Staff</label>
                    {sortedStaff.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setModalCustomStaff((v) => !v)}
                        className="text-[10px] font-bold text-amber-700 hover:underline cursor-pointer"
                      >
                        {modalCustomStaff ? 'Roster' : 'Custom'}
                      </button>
                    )}
                  </div>
                  {sortedStaff.length > 0 && !modalCustomStaff ? (
                    <select
                      value={modalStaff}
                      onChange={(e) => setModalStaff(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                    >
                      <option value="">Unassigned</option>
                      {sortedStaff.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={modalStaff}
                      onChange={(e) => setModalStaff(e.target.value)}
                      placeholder="Attendant name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Task Priority</label>
                  <select
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value as HkPriority)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cleaning Notes / Supervisor Remarks
                </label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g., Stain on carpet treated, extra towels placed, inspected AC..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              {/* Checklist Verification */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Turnaround Checklist</label>
                <div className="max-h-36 overflow-y-auto space-y-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  {sopChecklist.map((step) => (
                    <label
                      key={step}
                      className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(modalCheckedSop[step])}
                        onChange={(e) =>
                          setModalCheckedSop((prev) => ({ ...prev, [step]: e.target.checked }))
                        }
                        className="accent-emerald-600"
                      />
                      <span>{step}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Out of Order Toggle */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalOutOfOrder}
                    onChange={(e) => setModalOutOfOrder(e.target.checked)}
                    className="accent-rose-600"
                  />
                  <span>Mark Room Out of Order / Under Maintenance (Blocks Check-In)</span>
                </label>
                {modalOutOfOrder && (
                  <input
                    type="text"
                    value={modalOutOfOrderReason}
                    onChange={(e) => setModalOutOfOrderReason(e.target.value)}
                    placeholder="Reason (e.g. AC servicing / plumbing repair)..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                )}
              </div>

              {editingRoom.cleaningCompletedAt && (
                <div className="text-[11px] text-emerald-700 font-semibold">
                  Last Completed: {editingRoom.cleaningCompletedAt}
                  {editingRoom.verifiedBy ? ` • Verified by ${editingRoom.verifiedBy}` : ''}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold cursor-pointer"
                >
                  Save &amp; Sync Room Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: BULK "+ ASSIGN STAFF" MODAL                                  */}
      {/* ===================================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-400">
                  Assign Housekeeping Staff to Rooms
                </h3>
                <p className="text-[11px] text-slate-300">
                  Select one or multiple rooms, set priority and dispatch to an attendant
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBulkAssign} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">
                    Select Rooms ({bulkSelectedRooms.length} selected)
                  </label>
                  <div className="space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setBulkSelectedRooms(
                          enrichedRooms
                            .filter((x) => x.stage !== 'Clean' && x.room.status !== 'Out of Service')
                            .map((x) => x.room.number)
                        )
                      }
                      className="font-bold text-rose-700 hover:underline cursor-pointer"
                    >
                      Select Dirty ({dirtyCount + inProgressCount + inspectionCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkSelectedRooms(rooms.map((r) => r.number))}
                      className="font-bold text-amber-700 hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkSelectedRooms([])}
                      className="font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  {enrichedRooms.map(({ room, stage }) => {
                    const checked = bulkSelectedRooms.includes(room.number);
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() =>
                          setBulkSelectedRooms((prev) =>
                            prev.includes(room.number)
                              ? prev.filter((n) => n !== room.number)
                              : [...prev, room.number]
                          )
                        }
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          checked
                            ? 'bg-slate-900 border-slate-900 text-amber-400'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                        }`}
                      >
                        <div className="font-extrabold font-mono">{room.number}</div>
                        <div className="text-[10px] opacity-80 truncate">{stage}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Housekeeping Staff *</label>
                    {sortedStaff.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBulkCustomStaff((v) => !v)}
                        className="text-[10px] font-bold text-amber-700 hover:underline cursor-pointer"
                      >
                        {bulkCustomStaff ? 'Roster' : 'Custom'}
                      </button>
                    )}
                  </div>
                  {sortedStaff.length > 0 && !bulkCustomStaff ? (
                    <select
                      value={bulkStaff}
                      onChange={(e) => setBulkStaff(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                    >
                      <option value="">-- Select Staff --</option>
                      {sortedStaff.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={bulkStaff}
                      onChange={(e) => setBulkStaff(e.target.value)}
                      placeholder="Attendant name"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={bulkPriority}
                    onChange={(e) => setBulkPriority(e.target.value as HkPriority)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Stage</label>
                  <select
                    value={bulkStage}
                    onChange={(e) => setBulkStage(e.target.value as HkStage)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="Dirty">Dirty (Queued)</option>
                    <option value="In Progress">Cleaning in Progress</option>
                    <option value="Inspection">Inspection Pending</option>
                    <option value="Clean">Clean / Ready</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cleaning Instructions</label>
                  <input
                    type="text"
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                    placeholder="Optional task note..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#C49A3A] hover:bg-[#b0882e] text-[#17120F] font-extrabold cursor-pointer"
                >
                  Assign Staff ({bulkSelectedRooms.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
