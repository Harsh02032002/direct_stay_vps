import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Plus,
  Shirt,
  PackageSearch,
  Trash2,
  Users,
} from 'lucide-react';
import {
  HousekeepingTask,
  LaundryOrderRecord,
  LostFoundRecord,
  RoomAsset,
  StaffMemberRecord,
} from '../types';
import { formatCurrency } from '../utils/formatters';

interface HousekeepingModuleProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  rooms: RoomAsset[];
  staff?: StaffMemberRecord[];
  tasks: HousekeepingTask[];
  laundryOrders: LaundryOrderRecord[];
  lostFound: LostFoundRecord[];
  onCompleteTask: (taskId: string) => void;
  onAddTask: (task: Omit<HousekeepingTask, 'id'>) => void;
  onAddLaundryOrder: (order: Omit<LaundryOrderRecord, 'id'>) => void;
  onAddLostFound?: (item: Omit<LostFoundRecord, 'id'>) => void;
}

const SUB_TABS = [
  { id: 'dashboard', label: 'Housekeeping Overview' },
  { id: 'room_cleaning', label: 'Room Cleaning Queue' },
  { id: 'laundry', label: 'Laundry & Linen Desk' },
  { id: 'lost_found', label: 'Lost & Found Register' },
  { id: 'reports', label: 'Staff Productivity' },
  { id: 'settings', label: 'Cleaning Checklists' },
];

export const HousekeepingModule: React.FC<HousekeepingModuleProps> = ({
  activeSubTab,
  onSubTabChange,
  rooms,
  staff = [],
  tasks,
  laundryOrders,
  lostFound,
  onCompleteTask,
  onAddTask,
  onAddLaundryOrder,
  onAddLostFound,
}) => {
  const sortedStaff = React.useMemo(() => {
    return [...staff].sort((a, b) => {
      const aHk = a.department === 'Housekeeping' || a.role === 'Housekeeping' ? 0 : 1;
      const bHk = b.department === 'Housekeeping' || b.role === 'Housekeeping' ? 0 : 1;
      return aHk - bHk;
    });
  }, [staff]);

  const [selectedRoomNumber, setSelectedRoomNumber] = useState(() => rooms[0]?.number || '');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedTo, setAssignedTo] = useState(() => sortedStaff[0]?.name || '');
  const [isCustomStaff, setIsCustomStaff] = useState(false);

  const [laundryRoom, setLaundryRoom] = useState(() => rooms[0]?.number || '');
  const [laundryItems, setLaundryItems] = useState('');
  const [laundryAmount, setLaundryAmount] = useState(0);

  // Sync default room & staff selection when async data arrives
  useEffect(() => {
    if (!selectedRoomNumber && rooms.length > 0) {
      setSelectedRoomNumber(rooms[0].number);
    }
    if (!laundryRoom && rooms.length > 0) {
      setLaundryRoom(rooms[0].number);
    }
  }, [rooms, selectedRoomNumber, laundryRoom]);

  useEffect(() => {
    if (!assignedTo && sortedStaff.length > 0 && !isCustomStaff) {
      setAssignedTo(sortedStaff[0].name);
    }
  }, [sortedStaff, assignedTo, isCustomStaff]);

  // Lost & Found Local + Prop State
  const [localLostFound, setLocalLostFound] = useState<LostFoundRecord[]>(lostFound);
  useEffect(() => setLocalLostFound(lostFound), [lostFound]);

  const [lfItemName, setLfItemName] = useState('');
  const [lfCategory, setLfCategory] = useState('Electronics');
  const [lfRoom, setLfRoom] = useState('');
  const [lfFoundBy, setLfFoundBy] = useState(() => sortedStaff[0]?.name || '');

  // Dynamic & Persistent Housekeeping Turnaround SOP Checklist
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
    onAddTask({
      roomId: rm?.id || `rm-${roomNum}`,
      roomName: rm?.name || `Room ${roomNum}`,
      roomNumber: roomNum,
      category: rm?.category || 'Standard',
      description: taskDesc.trim() || 'Room Cleaning & Sanitization',
      taskType: 'Cleaning',
      assignedTo: assignedTo.trim() || sortedStaff[0]?.name || 'Housekeeping Staff',
      timing: new Date().toLocaleString('en-IN'),
      status: 'Pending',
      checklist: sopChecklist.length > 0 ? sopChecklist : DEFAULT_SOP_CHECKLIST,
    });
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

  return (
    <div className="space-y-5">
      {/* Header & Sub-Tabs */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Housekeeping & Laundry Automation
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Auto-triggered tasks on Guest Check-Out • 1-Click Room Clean Sync • Guest Laundry Billing
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 text-[11px] sm:text-xs w-full md:w-auto">
            <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-bold text-center">
              Pending Tasks: {tasks.filter((t) => t.status !== 'Completed').length}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-center">
              Clean Rooms: {rooms.filter((r) => r.cleaningStatus === 'Clean').length}/{rooms.length}
            </span>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1 & 2: ROOM CLEANING QUEUE & ASSIGN TASK */}
      {(activeSubTab === 'dashboard' || activeSubTab === 'room_cleaning') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assign Task Card */}
          <form
            onSubmit={handleCreateTask}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 h-fit"
          >
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Assign New Housekeeping Task
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Select Room</label>
                {rooms.length > 0 ? (
                  <select
                    value={selectedRoomNumber}
                    onChange={(e) => setSelectedRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.number}>
                        {r.name} ({r.status} / {r.cleaningStatus})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedRoomNumber}
                    onChange={(e) => setSelectedRoomNumber(e.target.value)}
                    placeholder="Room No. (e.g. 101)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-600">Assign Attendant (Staff)</label>
                  {sortedStaff.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomStaff((prev) => {
                          const next = !prev;
                          if (!next && sortedStaff[0]) {
                            setAssignedTo(sortedStaff[0].name);
                          } else if (next) {
                            setAssignedTo('');
                          }
                          return next;
                        });
                      }}
                      className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                    >
                      {isCustomStaff ? 'Select from Staff List' : '+ Type Custom Name'}
                    </button>
                  )}
                </div>
                {sortedStaff.length > 0 && !isCustomStaff ? (
                  <select
                    value={assignedTo}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomStaff(true);
                        setAssignedTo('');
                      } else {
                        setAssignedTo(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                  >
                    <option value="">-- Select Staff Member --</option>
                    {sortedStaff.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.role} • {s.department})
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Type Custom Attendant Name...</option>
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
                <label className="block font-bold text-slate-600 mb-1">Cleaning Instructions</label>
                <textarea
                  rows={3}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="e.g., Deep clean bathroom, replace linen"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create & Dispatch Task
            </button>
          </form>

          {/* Active Tasks Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-sm font-bold text-slate-900">Active Room Cleaning & Turnaround Queue</h3>
              <span className="text-[11px] sm:text-xs text-slate-500">
                Completing a task automatically marks the Room as Clean & Available
              </span>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Task Description</th>
                    <th className="py-3 px-4">Assigned Staff</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        No housekeeping tasks queued yet. Tasks are auto-created on Guest Check-Out or can be assigned on the left.
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
                          <div className="font-semibold text-slate-800">{task.description}</div>
                          <div className="text-[10px] text-slate-400">{task.timing}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700 whitespace-nowrap">{task.assignedTo}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              task.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {task.status === 'Completed' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {task.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {task.status !== 'Completed' ? (
                            <button
                              onClick={() => onCompleteTask(task.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                            >
                              Mark Clean & Ready
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600">Synced to Room Rack</span>
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

      {/* SUB-TAB 3: LAUNDRY & LINEN DESK */}
      {activeSubTab === 'laundry' && (
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
                {rooms.length > 0 ? (
                  <select
                    value={laundryRoom}
                    onChange={(e) => setLaundryRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.number}>
                        {r.name} ({r.currentGuestName || r.status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={laundryRoom}
                    onChange={(e) => setLaundryRoom(e.target.value)}
                    placeholder="Room No. (e.g. 101)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                )}
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
                <label className="block font-bold text-slate-600 mb-1">Total Charge (₹) — Posted to Room Folio</label>
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
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs"
            >
              + Create Laundry Order & Post to Folio
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Room & Guest</th>
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
                        <td className="py-3.5 px-4 font-extrabold whitespace-nowrap">{formatCurrency(ord.totalAmount)}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-blue-700 whitespace-nowrap">{ord.deliveryStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: LOST & FOUND REGISTER */}
      {activeSubTab === 'lost_found' && (
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
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs"
            >
              + Log Lost & Found Item
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Lost & Found Guest Property Register</h3>
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
                        No lost & found items registered yet.
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

      {/* SUB-TAB 5 & 6: STAFF PRODUCTIVITY & CLEANING CHECKLISTS */}
      {(activeSubTab === 'reports' || activeSubTab === 'settings') && (() => {
        const completedTasksCount = tasks.filter((t) => t.status === 'Completed').length;
        const pendingTasksCount = tasks.filter((t) => t.status !== 'Completed').length;
        const cleanRoomsCount = rooms.filter((r) => r.cleaningStatus === 'Clean').length;
        const dirtyRoomsWithoutTaskCount = rooms.filter(
          (r) =>
            r.cleaningStatus !== 'Clean' &&
            !tasks.some((t) => t.roomNumber === r.number && t.status !== 'Completed')
        ).length;
        const effectiveCompletedTurnarounds =
          completedTasksCount > 0 ? completedTasksCount : cleanRoomsCount;
        const effectivePendingRoomTasks = pendingTasksCount + dirtyRoomsWithoutTaskCount;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: Dynamic & Editable SOP Checklist */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Housekeeping Turnaround SOP Checklist ({sopChecklist.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add, check, or remove standard cleaning checklist items for room turnarounds
                  </p>
                </div>
              </div>

              {/* Add New Checklist Item Form */}
              <form onSubmit={handleAddChecklistStep} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistStep}
                  onChange={(e) => setNewChecklistStep(e.target.value)}
                  placeholder="Add new checklist step (e.g., Clean balcony & glass door)..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Step</span>
                </button>
              </form>

              <div className="space-y-2 text-xs text-slate-700">
                {sopChecklist.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200/60">
                    No checklist items yet. Add a step above.
                  </div>
                ) : (
                  sopChecklist.map((step, i) => {
                    const isChecked = checkedSopSteps[step] !== false;
                    return (
                      <div
                        key={`${step}-${i}`}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-slate-100/70 transition"
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
                          <span
                            className={`font-semibold ${
                              isChecked ? 'text-slate-800' : 'text-slate-400 line-through'
                            }`}
                          >
                            {step}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklistStep(step)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                          title="Remove checklist step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Card: Live Attendant Productivity Summary + Staff Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Attendant Productivity Summary
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Real-time room readiness & staff-wise turnaround metrics
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                  Total Rooms: {rooms.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">
                    Completed Turnarounds
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-900 mt-1">
                    {effectiveCompletedTurnarounds}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                    {completedTasksCount} Tasks Done • {cleanRoomsCount}/{rooms.length} Rooms Clean
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[10px] font-bold uppercase text-amber-800">
                    Pending Room Tasks
                  </div>
                  <div className="text-2xl font-extrabold text-amber-900 mt-1">
                    {effectivePendingRoomTasks}
                  </div>
                  <div className="text-[11px] font-semibold text-amber-800 mt-1">
                    {pendingTasksCount} Queued Tasks • {dirtyRoomsWithoutTaskCount} Dirty Rooms
                  </div>
                </div>
              </div>

              {/* Staff-Wise Breakdown */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    Staff-Wise Turnaround Performance ({sortedStaff.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onSubTabChange('room_cleaning')}
                    className="text-amber-700 hover:underline cursor-pointer"
                  >
                    + Assign Room Task
                  </button>
                </div>
                <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/60 text-[10px] uppercase text-slate-500 border-b border-slate-100">
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Role / Dept</th>
                      <th className="py-2.5 px-3 text-center">Assigned</th>
                      <th className="py-2.5 px-3 text-center">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedStaff.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          No staff registered yet.
                        </td>
                      </tr>
                    ) : (
                      sortedStaff.map((s) => {
                        const staffTasks = tasks.filter(
                          (t) => t.assignedTo.toLowerCase() === s.name.toLowerCase()
                        );
                        const staffCompleted =
                          staffTasks.filter((t) => t.status === 'Completed').length +
                          (s.roomsCleaned || 0);
                        const staffPending = staffTasks.filter(
                          (t) => t.status !== 'Completed'
                        ).length;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{s.name}</td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500">
                              {s.role} • {s.department}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                              {staffPending}
                            </td>
                            <td className="py-2.5 px-3 text-center font-extrabold text-emerald-700">
                              {staffCompleted}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
export default HousekeepingModule;
