import React, { useEffect, useState } from 'react';
import { X, Plus, Check, Sparkles, UserCheck } from 'lucide-react';
import { HousekeepingTask, RoomAsset, StaffMemberRecord } from '../types';

interface RoomTasksDrawerProps {
  isOpen: boolean;
  filterRoom: RoomAsset | null;
  tasks: HousekeepingTask[];
  rooms: RoomAsset[];
  staff: StaffMemberRecord[];
  onClose: () => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (newTask: Omit<HousekeepingTask, 'id' | 'timing'>) => void;
}

export default function RoomTasksDrawer({
  isOpen,
  filterRoom,
  tasks,
  rooms,
  staff,
  onClose,
  onCompleteTask,
  onAddTask,
}: RoomTasksDrawerProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('All');
  const [taskSavedToast, setTaskSavedToast] = useState<string | null>(null);

  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>(
    filterRoom?.number || rooms[0]?.number || '101'
  );
  const [taskType, setTaskType] = useState<HousekeepingTask['taskType']>('Cleaning');
  const [assignedTo, setAssignedTo] = useState<string>(staff[2]?.name || 'Sunita Bai');
  const [description, setDescription] = useState<string>(
    'Room cleaning, fresh bedsheet & washroom sanitization'
  );

  useEffect(() => {
    if (filterRoom) {
      setSelectedRoomNumber(filterRoom.number);
    }
  }, [filterRoom]);

  if (!isOpen) return null;

  const visibleTasks = tasks.filter((t) => {
    if (filterRoom && t.roomNumber !== filterRoom.number) return false;
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    if (taskTypeFilter !== 'All' && t.taskType !== taskTypeFilter) return false;
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const rm = rooms.find((r) => r.number === selectedRoomNumber) || filterRoom || rooms[0];
    if (!rm) return;
    onAddTask({
      roomId: rm.id,
      roomName: rm.name,
      roomNumber: rm.number,
      category: rm.category,
      description: description || `${taskType} task for ${rm.name}`,
      taskType,
      assignedTo,
      status: 'Pending',
      checklist: ['Inspect Room', 'Execute Task', 'Supervisor Verification'],
    });
    setTaskSavedToast(`Task assigned to ${assignedTo} for ${rm.name}!`);
    setTimeout(() => setTaskSavedToast(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-3xl h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-[#FBF4E0] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#17120F] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C49A3A]" />
              <span>
                Assign & View Room Tasks {filterRoom ? `• ${filterRoom.name}` : '• All Rooms'}
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              Assign cleaning/maintenance to staff below • Completing a task marks Dirty room Available
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/10 text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* DIRECT INLINE TASK ASSIGNMENT FORM */}
          <form
            onSubmit={handleCreateTask}
            className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-600" />
                Assign New Task to Housekeeping / Maintenance Staff
              </h4>
              {taskSavedToast && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  ✓ {taskSavedToast}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Room</label>
                <select
                  value={selectedRoomNumber}
                  onChange={(e) => setSelectedRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-xl font-bold"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      {r.name} ({r.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Task Type</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as HousekeepingTask['taskType'])}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-xl font-bold"
                >
                  <option value="Cleaning">Room Cleaning</option>
                  <option value="SheetChange">Bedsheet Change</option>
                  <option value="Inspection">Room Inspection</option>
                  <option value="Maintenance">AC / Plumbing Repair</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Staff Member</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-xl font-bold"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task instructions (e.g. Change bedsheets, clean bathroom, restock water)"
                className="flex-1 px-3 py-2 border border-slate-300 bg-white rounded-xl font-medium"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign Task Now</span>
              </button>
            </div>
          </form>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="All">All</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-600">Task Type:</span>
                <select
                  value={taskTypeFilter}
                  onChange={(e) => setTaskTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="All">All</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="SheetChange">SheetChange</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Showing {visibleTasks.length} assigned task(s)
            </span>
          </div>

          {/* Tasks Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-3 text-left whitespace-nowrap">Room</th>
                  <th className="py-2.5 px-3 text-left">Instructions</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Task</th>
                  <th className="py-2.5 px-3 text-left whitespace-nowrap">Assigned Staff</th>
                  <th className="py-2.5 px-3 text-left whitespace-nowrap">Timing</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No tasks pending for this room. Use the form above to assign one to staff.
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{t.roomName}</div>
                        <div className="text-[10px] text-slate-500">{t.category}</div>
                      </td>
                      <td className="py-3 px-3 min-w-[180px] max-w-[260px] whitespace-normal leading-snug text-slate-800">
                        {t.description}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.taskType === 'Cleaning'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.taskType === 'SheetChange'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.taskType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">{t.assignedTo}</td>
                      <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">{t.timing}</td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {t.status === 'Completed' ? (
                          <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center justify-center gap-1 whitespace-nowrap">
                            <Check className="w-3.5 h-3.5 shrink-0" /> Complete
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onCompleteTask(t.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs"
                            title="Mark Task Complete & Set Room Available"
                          >
                            <Check className="w-3 h-3 shrink-0" /> Mark Done
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
    </div>
  );
}
