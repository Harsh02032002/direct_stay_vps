import React, { useState } from 'react';
import { PosOrder } from '../../types';
import {
  ChefHat,
  Clock,
  CheckCircle,
  Printer,
  XCircle,
  Filter,
  Utensils,
  AlertCircle,
  User,
  CheckSquare
} from 'lucide-react';

interface PosKdsViewProps {
  orders: PosOrder[];
  onUpdateOrders: (orders: PosOrder[]) => void;
  onPrintKot: (order: PosOrder) => void;
  onAddAuditLog?: (action: string, details: string) => void;
}

export default function PosKdsView({
  orders,
  onUpdateOrders,
  onPrintKot,
  onAddAuditLog
}: PosKdsViewProps) {
  const [selectedStation, setSelectedStation] = useState<string>('All');

  const activeKotOrders = orders.filter(
    o => o.kotSent && !o.isSettled && o.status !== 'Cancelled'
  );

  const stations = ['All', 'Main Kitchen', 'Bar & Beverages', 'Bakery', 'Tandoor'];

  const filteredOrders = activeKotOrders.filter(o => {
    if (selectedStation === 'All') return true;
    return o.kitchenStation === selectedStation || !o.kitchenStation;
  });

  const handleUpdateKitchenStatus = (
    orderId: string,
    status: 'Pending' | 'Preparing' | 'Ready' | 'Served'
  ) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const updated = orders.map(o => (o.id === orderId ? { ...o, kitchenStatus: status } : o));
    onUpdateOrders(updated);
    onAddAuditLog?.(
      'POS Kitchen Status Updated',
      `Updated KOT prep status for Order #${targetOrder?.orderNumber || orderId} to "${status}".`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Station Filters */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ChefHat className="w-6 h-6 text-amber-600" />
            <h2 className="text-xl font-bold text-slate-800">Kitchen Display System (KDS)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Kitchen Order Tickets (KOT). Monitor timers and prep status.
          </p>
        </div>

        {/* Station Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto">
          {stations.map(st => (
            <button
              key={st}
              onClick={() => setSelectedStation(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStation === st
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* KOT Cards Grid */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <ChefHat className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-base">All Kitchen Tickets Cleared!</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            New KOT tickets sent from the POS Terminal will appear live on this screen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => {
            const statusBg =
              order.kitchenStatus === 'Served'
                ? 'bg-emerald-50 border-emerald-300'
                : order.kitchenStatus === 'Ready'
                ? 'bg-blue-50 border-blue-300'
                : order.kitchenStatus === 'Preparing'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-slate-50 border-slate-300';

            const statusBadge =
              order.kitchenStatus === 'Served'
                ? 'bg-emerald-600 text-white'
                : order.kitchenStatus === 'Ready'
                ? 'bg-blue-600 text-white'
                : order.kitchenStatus === 'Preparing'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-600 text-white';

            return (
              <div
                key={order.id}
                className={`rounded-2xl border ${statusBg} shadow-xs p-5 space-y-4 flex flex-col justify-between transition-all`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-slate-900 text-base">
                          {order.orderNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                          {order.orderType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-800 font-bold mt-1">
                        Guest: {order.guestName || 'Walk-in Guest'}
                        {order.customerPhone ? ` (${order.customerPhone})` : ''}
                      </div>
                      <div className="text-xs text-slate-600 font-medium mt-0.5">
                        {order.orderType === 'Dine In'
                          ? `Table: ${order.tableNo || '-'}${order.roomNumber ? ` • Room ${order.roomNumber}` : ''}`
                          : order.roomNumber
                          ? `Room ${order.roomNumber}`
                          : order.orderType}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${statusBadge}`}>
                        {order.kitchenStatus || 'Pending'}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-end space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>KOT Sent: {order.kotSentAt || order.time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Waiter Name */}
                  {order.waiterName && (
                    <div className="text-xs text-amber-900 font-medium flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-amber-700" />
                      <span>Assigned Waiter: <strong>{order.waiterName}</strong></span>
                    </div>
                  )}

                  {/* KOT Items List */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {order.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-800 text-xs">
                            <span className="text-amber-700 font-extrabold mr-1.5">{it.quantity}x</span>
                            {it.itemName}
                          </span>
                          {it.selectedVariant && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                              {it.selectedVariant}
                            </span>
                          )}
                        </div>

                        {/* Modifiers / Addons / Notes */}
                        {(it.selectedModifiers && it.selectedModifiers.length > 0) ||
                        (it.selectedAddons && it.selectedAddons.length > 0) ||
                        it.itemNotes ? (
                          <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                            {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                              <div className="text-rose-700 font-medium">
                                Modifiers: {it.selectedModifiers.join(', ')}
                              </div>
                            )}
                            {it.selectedAddons && it.selectedAddons.length > 0 && (
                              <div>Addons: {it.selectedAddons.join(', ')}</div>
                            )}
                            {it.itemNotes && (
                              <div className="italic text-slate-600">Note: "{it.itemNotes}"</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="p-2 bg-amber-100/60 text-amber-900 text-xs rounded-lg border border-amber-200 italic">
                      Special Kitchen Instruction: "{order.notes}"
                    </div>
                  )}
                </div>

                {/* Status Action Buttons */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                    <button
                      onClick={() => handleUpdateKitchenStatus(order.id, 'Preparing')}
                      className={`py-1.5 px-2 rounded-lg transition-all ${
                        order.kitchenStatus === 'Preparing'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-amber-100 border border-slate-200'
                      }`}
                    >
                      Preparing
                    </button>
                    <button
                      onClick={() => handleUpdateKitchenStatus(order.id, 'Ready')}
                      className={`py-1.5 px-2 rounded-lg transition-all ${
                        order.kitchenStatus === 'Ready'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-blue-100 border border-slate-200'
                      }`}
                    >
                      Mark Ready
                    </button>
                    <button
                      onClick={() => handleUpdateKitchenStatus(order.id, 'Served')}
                      className={`py-1.5 px-2 rounded-lg transition-all ${
                        order.kitchenStatus === 'Served'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-emerald-100 border border-slate-200'
                      }`}
                    >
                      Mark Served
                    </button>
                  </div>

                  <button
                    onClick={() => onPrintKot(order)}
                    className="w-full py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print KOT Slip</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
