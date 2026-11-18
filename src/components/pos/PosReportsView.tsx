import React, { useState } from 'react';
import { PosOrder } from '../../types';
import {
  TrendingUp,
  Calendar,
  FileText,
  DollarSign,
  CreditCard,
  Receipt,
  PieChart,
  BarChart,
  Download,
  Printer
} from 'lucide-react';

interface PosReportsViewProps {
  orders: PosOrder[];
}

export default function PosReportsView({ orders }: PosReportsViewProps) {
  const [dateRange, setDateRange] = useState<'today' | '7days' | 'month'>('today');

  const todayStr = new Date().toISOString().split('T')[0];

  // Date filtering logic
  const filteredOrders = orders.filter(o => {
    if (o.status === 'Cancelled') return false;
    if (dateRange === 'today') return o.date === todayStr;
    if (dateRange === '7days') {
      const oDate = new Date(o.date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return oDate >= sevenDaysAgo;
    }
    if (dateRange === 'month') {
      const oMonth = o.date.substring(0, 7);
      const thisMonth = todayStr.substring(0, 7);
      return oMonth === thisMonth;
    }
    return true;
  });

  const settledOrders = filteredOrders.filter(o => o.isSettled || o.status === 'Settled' || o.status === 'Completed');

  // Key Financial Metrics
  const totalSubtotal = settledOrders.reduce((acc, o) => acc + o.subtotal, 0);
  const totalDiscount = settledOrders.reduce((acc, o) => acc + o.discount, 0);
  const totalTax = settledOrders.reduce((acc, o) => acc + o.taxAmount, 0);
  const totalGrand = settledOrders.reduce((acc, o) => acc + o.grandTotal, 0);

  const cgst = totalTax / 2;
  const sgst = totalTax / 2;

  // Payment Breakdown
  const paymentMethodMap: Record<string, number> = {
    Cash: 0,
    Card: 0,
    UPI: 0,
    Credit: 0,
    'Room Charge': 0
  };

  settledOrders.forEach(o => {
    const method = o.paymentMethod || 'Cash';
    paymentMethodMap[method] = (paymentMethodMap[method] || 0) + o.grandTotal;
  });

  // Item-wise Breakdown
  const itemMap: Record<string, { name: string; qty: number; total: number }> = {};
  settledOrders.forEach(o => {
    o.items.forEach(it => {
      if (!itemMap[it.itemId]) {
        itemMap[it.itemId] = { name: it.itemName, qty: 0, total: 0 };
      }
      itemMap[it.itemId].qty += it.quantity;
      itemMap[it.itemId].total += it.total;
    });
  });

  const itemSalesList = Object.values(itemMap).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      {/* Header & Date Range Filter */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">POS Sales & Tax Reports</h2>
          <p className="text-xs text-slate-500">
            Analytics for revenue, payment methods, GST tax breakdown, and item sales.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRange === 'today' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange('7days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRange === '7days' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateRange === 'month' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Gross Sales Subtotal</span>
          <h3 className="text-2xl font-black text-slate-900">₹{totalSubtotal.toFixed(2)}</h3>
          <p className="text-[11px] text-slate-500">Before discounts & GST</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Discounts</span>
          <h3 className="text-2xl font-black text-rose-600">₹{totalDiscount.toFixed(2)}</h3>
          <p className="text-[11px] text-slate-500">Coupons & manual discounts</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total GST Tax Collected</span>
          <h3 className="text-2xl font-black text-blue-600">₹{totalTax.toFixed(2)}</h3>
          <p className="text-[11px] text-slate-500">CGST ₹{cgst.toFixed(1)} + SGST ₹{sgst.toFixed(1)}</p>
        </div>

        <div className="p-4 bg-amber-600 text-white rounded-xl shadow-xs space-y-1">
          <span className="text-xs text-amber-200 uppercase font-bold tracking-wider">Net POS Revenue</span>
          <h3 className="text-2xl font-black">₹{totalGrand.toFixed(2)}</h3>
          <p className="text-[11px] text-amber-100">{settledOrders.length} Settled Transactions</p>
        </div>
      </div>

      {/* Payment Method & Tax Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-base">Payment Method Breakdown</h3>
          <div className="space-y-3 text-xs">
            {Object.entries(paymentMethodMap).map(([method, amount]) => {
              const pct = totalGrand > 0 ? (amount / totalGrand) * 100 : 0;
              return (
                <div key={method} className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-700">{method}</span>
                    <span className="text-slate-900 font-bold">₹{amount.toFixed(2)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GST Tax Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-base">GST & Tax Summary</h3>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between font-semibold text-slate-700">
              <span>Taxable Value (Subtotal - Discount):</span>
              <span>₹{(totalSubtotal - totalDiscount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Central GST (CGST @ 2.5%):</span>
              <span>₹{cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>State GST (SGST @ 2.5%):</span>
              <span>₹{sgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
              <span>Total GST Tax Liability:</span>
              <span>₹{totalTax.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Item Sales Table */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-800 text-base">Item-wise Sales Report</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                <th className="py-2.5 px-4">Item Name</th>
                <th className="py-2.5 px-4 text-center">Quantity Sold</th>
                <th className="py-2.5 px-4 text-right">Total Sales Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {itemSalesList.map(item => (
                <tr key={item.name} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">{item.name}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-slate-900">{item.qty} portions</td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
