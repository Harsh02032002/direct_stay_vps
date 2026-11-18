import React, { useState } from 'react';
import { PosTable, PosOrder, Staff } from '../../types';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Utensils,
  User,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';

interface PosTableManagerProps {
  tables: PosTable[];
  onUpdateTables: (tables: PosTable[]) => void;
  orders: PosOrder[];
  staff?: Staff[];
  onStartOrderForTable: (tableNumber: string, floor: string, waiterName?: string) => void;
}

export default function PosTableManager({
  tables,
  onUpdateTables,
  orders,
  staff = [],
  onStartOrderForTable
}: PosTableManagerProps) {
  const [selectedFloor, setSelectedFloor] = useState<string>('All');
  const [showTableModal, setShowTableModal] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<PosTable | null>(null);

  const [tableForm, setTableForm] = useState<{
    tableNumber: string;
    floor: string;
    capacity: number;
    status: 'Available' | 'Occupied' | 'Reserved' | 'Cleaning';
    assignedWaiter: string;
  }>({
    tableNumber: '',
    floor: 'Main Dining',
    capacity: 4,
    status: 'Available',
    assignedWaiter: ''
  });

  const floors = ['All', ...Array.from(new Set(tables.map(t => t.floor)))];

  const filteredTables = tables.filter(
    t => selectedFloor === 'All' || t.floor === selectedFloor
  );

  const waitersList = staff.filter(s => s.role === 'Waiter' || s.role === 'Staff' || s.role === 'Manager');

  const handleSaveTable = () => {
    if (!tableForm.tableNumber) return;

    if (editingTable) {
      const updated = tables.map(t =>
        t.id === editingTable.id
          ? {
              ...t,
              tableNumber: tableForm.tableNumber,
              floor: tableForm.floor,
              capacity: tableForm.capacity,
              status: tableForm.status,
              assignedWaiter: tableForm.assignedWaiter
            }
          : t
      );
      onUpdateTables(updated);
    } else {
      const newTbl: PosTable = {
        id: `tbl-${Date.now()}`,
        tableNumber: tableForm.tableNumber,
        floor: tableForm.floor,
        capacity: tableForm.capacity,
        status: tableForm.status,
        assignedWaiter: tableForm.assignedWaiter
      };
      onUpdateTables([...tables, newTbl]);
    }

    setShowTableModal(false);
    setEditingTable(null);
  };

  const handleOpenEdit = (table: PosTable) => {
    setEditingTable(table);
    setTableForm({
      tableNumber: table.tableNumber,
      floor: table.floor,
      capacity: table.capacity,
      status: table.status,
      assignedWaiter: table.assignedWaiter || ''
    });
    setShowTableModal(true);
  };

  const handleDeleteTable = (id: string) => {
    if (confirm('Delete this table configuration?')) {
      onUpdateTables(tables.filter(t => t.id !== id));
    }
  };

  const handleChangeTableStatus = (
    tableId: string,
    newStatus: 'Available' | 'Occupied' | 'Reserved' | 'Cleaning'
  ) => {
    const updated = tables.map(t => (t.id === tableId ? { ...t, status: newStatus } : t));
    onUpdateTables(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Floor Tabs */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Restaurant Floor & Table Management</h2>
          <p className="text-xs text-slate-500">
            Manage seating floors, table statuses, waiter assignments, and start dine-in orders.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Floor selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {floors.map(flr => (
              <button
                key={flr}
                onClick={() => setSelectedFloor(flr)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  selectedFloor === flr
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {flr}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setEditingTable(null);
              setTableForm({
                tableNumber: `T-0${tables.length + 1}`,
                floor: 'Main Dining',
                capacity: 4,
                status: 'Available',
                assignedWaiter: ''
              });
              setShowTableModal(true);
            }}
            className="px-3.5 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Table</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map(table => {
          // Find active order for table
          const activeOrder = orders.find(
            o => o.tableNo === table.tableNumber && !o.isSettled && o.status !== 'Cancelled'
          );

          const statusColor =
            table.status === 'Available'
              ? 'border-emerald-200 bg-emerald-50/30'
              : table.status === 'Occupied'
              ? 'border-rose-200 bg-rose-50/30'
              : table.status === 'Reserved'
              ? 'border-amber-200 bg-amber-50/30'
              : 'border-blue-200 bg-blue-50/30';

          const badgeColor =
            table.status === 'Available'
              ? 'bg-emerald-100 text-emerald-800'
              : table.status === 'Occupied'
              ? 'bg-rose-100 text-rose-800'
              : table.status === 'Reserved'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-blue-100 text-blue-800';

          return (
            <div
              key={table.id}
              className={`p-4 rounded-xl border ${statusColor} shadow-xs flex flex-col justify-between space-y-3 relative group transition-all`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-slate-900 text-lg">
                    {table.tableNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badgeColor}`}>
                    {table.status}
                  </span>
                </div>

                <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                  <div>Floor: <span className="font-semibold text-slate-700">{table.floor}</span></div>
                  <div>Capacity: <span className="font-semibold text-slate-700">{table.capacity} Guests</span></div>
                  {table.assignedWaiter && (
                    <div className="text-amber-800 font-medium">
                      Waiter: <span className="font-bold">{table.assignedWaiter}</span>
                    </div>
                  )}
                </div>

                {/* Active Order snippet */}
                {activeOrder && (
                  <div className="mt-2.5 p-2 bg-white/80 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Order #{activeOrder.orderNumber}</span>
                      <span>₹{activeOrder.grandTotal.toFixed(0)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Kitchen: <span className="font-semibold text-amber-700">{activeOrder.kitchenStatus || 'Pending'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status & Actions Bar */}
              <div className="pt-2 border-t border-slate-200/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <select
                    value={table.status}
                    onChange={e =>
                      handleChangeTableStatus(
                        table.id,
                        e.target.value as 'Available' | 'Occupied' | 'Reserved' | 'Cleaning'
                      )
                    }
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Available">Set Available</option>
                    <option value="Occupied">Set Occupied</option>
                    <option value="Reserved">Set Reserved</option>
                    <option value="Cleaning">Set Cleaning</option>
                  </select>

                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleOpenEdit(table)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded"
                      title="Edit Table"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTable(table.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete Table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Start Dine-In order button */}
                <button
                  onClick={() =>
                    onStartOrderForTable(table.tableNumber, table.floor, table.assignedWaiter)
                  }
                  className="w-full py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1"
                >
                  <Utensils className="w-3.5 h-3.5 text-amber-400" />
                  <span>{activeOrder ? 'Open Active Bill' : 'Take Table Order'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800">
              {editingTable ? 'Edit Table Configuration' : 'Add New Table'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Table Number/Code</label>
                <input
                  type="text"
                  placeholder="e.g. T-05, GT-04"
                  value={tableForm.tableNumber}
                  onChange={e => setTableForm({ ...tableForm, tableNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Floor / Section</label>
                <input
                  type="text"
                  placeholder="e.g. Main Dining, Terrace, VIP"
                  value={tableForm.floor}
                  onChange={e => setTableForm({ ...tableForm, floor: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={tableForm.capacity}
                    onChange={e => setTableForm({ ...tableForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Status</label>
                  <select
                    value={tableForm.status}
                    onChange={e =>
                      setTableForm({
                        ...tableForm,
                        status: e.target.value as 'Available' | 'Occupied' | 'Reserved' | 'Cleaning'
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Available">Available</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Cleaning">Cleaning</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Assigned Waiter (Optional)</label>
                <select
                  value={tableForm.assignedWaiter}
                  onChange={e => setTableForm({ ...tableForm, assignedWaiter: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Unassigned --</option>
                  {waitersList.length > 0
                    ? waitersList.map(w => (
                        <option key={w.id} value={w.name}>
                          {w.name} ({w.role})
                        </option>
                      ))
                    : [
                        <option key="w1" value="Ramesh Kumar">Ramesh Kumar</option>,
                        <option key="w2" value="Priya Sharma">Priya Sharma</option>,
                        <option key="w3" value="Vikram Singh">Vikram Singh</option>
                      ]}
                </select>
              </div>
            </div>

            <div className="flex space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowTableModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTable}
                className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg text-xs hover:bg-amber-700"
              >
                Save Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
