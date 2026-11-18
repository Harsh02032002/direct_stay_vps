import React from 'react';
import { PosOrder } from '../../types';
import {
  Printer,
  CheckCircle,
  XCircle,
  Receipt,
  Download,
  Building,
  Phone
} from 'lucide-react';

interface PosReceiptModalProps {
  order: PosOrder;
  onClose: () => void;
}

export default function PosReceiptModal({ order, onClose }: PosReceiptModalProps) {
  const handleTriggerPrint = () => {
    window.print();
  };

  const isNoGst = Boolean(order.isWithoutGst || (order.taxAmount || 0) === 0);
  const cgst = isNoGst ? 0 : (order.taxAmount || 0) / 2;
  const sgst = isNoGst ? 0 : (order.taxAmount || 0) / 2;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
        {/* Action Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-slate-800 text-sm">Tax Invoice & Receipt</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTriggerPrint}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 flex items-center space-x-1 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE RECEIPT CONTAINER */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-xs font-mono text-slate-800">
          {/* Header & Logo */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h2 className="text-base font-black uppercase text-slate-900">Grand Palace Hotel & Restaurant</h2>
            <p className="text-[11px] text-slate-600">123 Hospitality Way, Beach Road</p>
            <p className="text-[11px] text-slate-600">GSTIN: 21ABCDE1234F1Z5 | Tel: +91 98765 43210</p>
            <div className={`mt-2 inline-block px-2.5 py-0.5 text-white font-bold text-[10px] rounded uppercase ${isNoGst ? 'bg-slate-700' : 'bg-slate-900'}`}>
              {isNoGst ? 'BILL OF SUPPLY (COMPOSITION / NO GST)' : 'TAX INVOICE'}
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pb-3 border-b border-dashed border-slate-300">
            <div>
              <div><strong>Invoice #:</strong> {order.invoiceNumber || order.orderNumber}</div>
              <div><strong>Date:</strong> {order.invoiceDate || order.date}</div>
              <div><strong>Time:</strong> {order.time}</div>
            </div>
            <div className="text-right">
              <div><strong>Order Type:</strong> {order.orderType}</div>
              {order.tableNo && <div><strong>Table:</strong> {order.tableNo}</div>}
              {order.roomNumber && <div><strong>Room:</strong> {order.roomNumber}</div>}
              {order.guestName && <div><strong>Guest:</strong> {order.guestName}</div>}
              {order.waiterName && <div><strong>Waiter:</strong> {order.waiterName}</div>}
            </div>
          </div>

          {/* Itemized Table */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 font-bold border-b border-slate-300 pb-1 text-[11px]">
              <span className="col-span-6">ITEM</span>
              <span className="col-span-2 text-center">QTY</span>
              <span className="col-span-2 text-right">RATE</span>
              <span className="col-span-2 text-right">AMT</span>
            </div>

            <div className="divide-y divide-slate-200 text-[11px]">
              {order.items.map((it, idx) => (
                <div key={idx} className="py-1.5 grid grid-cols-12 items-start">
                  <div className="col-span-6">
                    <div className="font-semibold">{it.itemName}</div>
                    {it.selectedVariant && (
                      <div className="text-[10px] text-slate-500">Var: {it.selectedVariant}</div>
                    )}
                    {it.selectedAddons && it.selectedAddons.length > 0 && (
                      <div className="text-[10px] text-slate-500">Addons: {it.selectedAddons.join(', ')}</div>
                    )}
                  </div>
                  <span className="col-span-2 text-center font-bold">{it.quantity}</span>
                  <span className="col-span-2 text-right">₹{it.price}</span>
                  <span className="col-span-2 text-right font-bold">₹{it.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calculation Breakdown */}
          <div className="pt-3 border-t border-dashed border-slate-300 space-y-1 text-[11px] text-slate-700">
            <div className="flex justify-between">
              <span>Item Subtotal:</span>
              <span>₹{order.subtotal.toFixed(2)}</span>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount Applied:</span>
                <span>-₹{order.discount.toFixed(2)}</span>
              </div>
            )}

            {!isNoGst ? (
              <>
                <div className="flex justify-between">
                  <span>CGST (2.5%):</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST (2.5%):</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-500 italic">
                <span>GST Tax (Exempt / No GST):</span>
                <span>₹0.00</span>
              </div>
            )}

            <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-400">
              <span>GRAND TOTAL:</span>
              <span>₹{order.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment & Status */}
          <div className="p-2.5 bg-slate-200/70 rounded-lg text-center text-[11px] font-bold text-slate-800 space-y-0.5">
            <div>Payment Status: {order.paymentStatus === 'Paid' ? 'PAID / SETTLED' : 'UNPAID'}</div>
            <div>Payment Method: {order.paymentMethod}</div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
            <p>Thank you for dining with us!</p>
            <p>Have a wonderful stay & day ahead.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
