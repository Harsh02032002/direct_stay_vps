import React from 'react';
import { PosOrder, PosTable, PosItem } from '../../types';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle,
  Users,
  Utensils,
  DollarSign,
  Receipt,
  ChefHat,
  ArrowUpRight,
  Layers,
  Sparkles,
  CreditCard,
  Bed,
  FileText
} from 'lucide-react';

interface PosDashboardProps {
  orders: PosOrder[];
  tables: PosTable[];
  items: PosItem[];
  heldOrdersCount: number;
  onNavigateTab: (tab: 'terminal' | 'tables' | 'kds' | 'orders' | 'catalog' | 'reports') => void;
  onStartNewOrderForTable?: (tableNo: string) => void;
}

export default function PosDashboard({
  orders,
  tables,
  items,
  heldOrdersCount,
  onNavigateTab
}: PosDashboardProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.date === todayStr && o.status !== 'Cancelled');
  const settledOrders = todayOrders.filter(o => o.isSettled || o.status === 'Settled' || o.status === 'Completed');

  const todayRevenue = settledOrders.reduce((acc, o) => acc + o.grandTotal, 0);
  const avgTicketValue = settledOrders.length > 0 ? todayRevenue / settledOrders.length : 0;

  const occupiedTables = tables.filter(t => t.status === 'Occupied').length;
  const tableOccupancyRate = tables.length > 0 ? Math.round((occupiedTables / tables.length) * 100) : 0;

  const activeKotsCount = orders.filter(o => o.kotSent && !o.isSettled && o.status !== 'Cancelled').length;

  // Revenue breakdown by type
  const roomChargeTotal = settledOrders.filter(o => o.orderType === 'Room Charge' || o.orderType === 'Room Service').reduce((a, c) => a + c.grandTotal, 0);
  const dineInTotal = settledOrders.filter(o => o.orderType === 'Dine In').reduce((a, c) => a + c.grandTotal, 0);
  const takeawayTotal = settledOrders.filter(o => o.orderType === 'Takeaway' || o.orderType === 'Walk In' || o.orderType === 'Delivery').reduce((a, c) => a + c.grandTotal, 0);

  // Top Selling Items calculation
  const itemSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  todayOrders.forEach(o => {
    o.items.forEach(it => {
      if (!itemSalesMap[it.itemId]) {
        itemSalesMap[it.itemId] = { name: it.itemName, qty: 0, revenue: 0 };
      }
      itemSalesMap[it.itemId].qty += it.quantity;
      itemSalesMap[it.itemId].revenue += it.total;
    });
  });

  const topSellingItems = Object.values(itemSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today's POS Revenue</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">₹{todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center space-x-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{settledOrders.length} Settled Invoices</span>
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Table Occupancy</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{tableOccupancyRate}%</h3>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-bold text-amber-700">{occupiedTables}</span> of {tables.length} tables occupied
            </p>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
            <Utensils className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active KOT Tickets</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{activeKotsCount}</h3>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-bold text-rose-600">{heldOrdersCount}</span> orders on hold
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <ChefHat className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg Ticket Size</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">₹{avgTicketValue.toFixed(0)}</h3>
            <p className="text-xs text-slate-500 mt-1">Per settled order today</p>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => onNavigateTab('terminal')}
          className="p-4 bg-amber-600 text-white rounded-xl shadow-xs hover:bg-amber-700 transition-all text-left space-y-2 group"
        >
          <Utensils className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-bold text-sm">POS Terminal</div>
            <div className="text-[11px] text-amber-100">Take New Order</div>
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('tables')}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-amber-400 transition-all text-left space-y-2 group"
        >
          <Users className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-bold text-sm text-slate-800">Table Map</div>
            <div className="text-[11px] text-slate-500">{tables.length} Tables Configured</div>
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('kds')}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-amber-400 transition-all text-left space-y-2 group"
        >
          <ChefHat className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-bold text-sm text-slate-800">Kitchen Display</div>
            <div className="text-[11px] text-slate-500">{activeKotsCount} Live Tickets</div>
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('orders')}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-amber-400 transition-all text-left space-y-2 group"
        >
          <Receipt className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-bold text-sm text-slate-800">Order Register</div>
            <div className="text-[11px] text-slate-500">Settle & Invoices</div>
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('catalog')}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-amber-400 transition-all text-left space-y-2 group"
        >
          <Layers className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-bold text-sm text-slate-800">Menu Catalog</div>
            <div className="text-[11px] text-slate-500">{items.length} Menu Items</div>
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('reports')}
          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-amber-400 transition-all text-left space-y-2 group"
        >
          <TrendingUp className="w-5 h-5 text-rose-600 group-hover:scale-110 transition-transform" />
          <div>
            <div className="font-bold text-sm text-slate-800">POS Reports</div>
            <div className="text-[11px] text-slate-500">Daily, GST & Tax</div>
          </div>
        </button>
      </div>

      {/* Middle Grid: Revenue Channel Breakdown & Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-base">Today's Sales Channels</h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-600 flex items-center space-x-1">
                  <Utensils className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dine-In Restaurant</span>
                </span>
                <span className="text-slate-900">₹{dineInTotal.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${todayRevenue > 0 ? (dineInTotal / todayRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-600 flex items-center space-x-1">
                  <Bed className="w-3.5 h-3.5 text-purple-600" />
                  <span>Room Charge / Room Service</span>
                </span>
                <span className="text-slate-900">₹{roomChargeTotal.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full"
                  style={{ width: `${todayRevenue > 0 ? (roomChargeTotal / todayRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-600 flex items-center space-x-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Takeaway & Delivery</span>
                </span>
                <span className="text-slate-900">₹{takeawayTotal.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${todayRevenue > 0 ? (takeawayTotal / todayRevenue) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">Top Selling Menu Items Today</h3>
            <span className="text-xs text-slate-500">Ranked by volume</span>
          </div>

          {topSellingItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No item sales recorded today yet. Place orders from the POS Terminal!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topSellingItems.map((item, idx) => (
                <div key={item.name} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 font-bold text-xs text-slate-700 flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-sm block">{item.qty} portions</span>
                    <span className="text-xs text-slate-500">₹{item.revenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
