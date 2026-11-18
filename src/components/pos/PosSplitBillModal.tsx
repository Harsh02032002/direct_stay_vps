import React, { useState } from 'react';
import { PosOrder } from '../../types';
import {
  Scissors,
  Users,
  CheckCircle,
  XCircle,
  Receipt,
  DollarSign
} from 'lucide-react';

interface PosSplitBillModalProps {
  order: PosOrder;
  onClose: () => void;
  onConfirmSplit: (order: PosOrder, splitAmounts: number[]) => void;
}

export default function PosSplitBillModal({
  order,
  onClose,
  onConfirmSplit
}: PosSplitBillModalProps) {
  const [splitMode, setSplitMode] = useState<'Equal' | 'By Item'>('Equal');
  const [splitCount, setSplitCount] = useState<number>(2);

  const perHeadAmount = order.grandTotal / Math.max(1, splitCount);

  const handleApplyEqualSplit = () => {
    const amounts = Array(splitCount).fill(Number(perHeadAmount.toFixed(2)));
    const updatedOrder: PosOrder = {
      ...order,
      splitDetails: {
        splitType: 'Equal',
        splitCount,
        paidSplits: 0,
        splitAmounts: amounts
      }
    };
    onConfirmSplit(updatedOrder, amounts);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Scissors className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-800 text-lg">
              Split Bill for Order #{order.orderNumber}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Total Summary */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-600 block">Total Bill Amount:</span>
            <span className="text-lg font-black text-slate-900">₹{order.grandTotal.toFixed(2)}</span>
          </div>
          <div className="text-right text-slate-500">
            <span>{order.items.length} Items</span>
            <span className="block">{order.orderType}</span>
          </div>
        </div>

        {/* Split Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setSplitMode('Equal')}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              splitMode === 'Equal'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Split Equally (By N Persons)
          </button>
          <button
            onClick={() => setSplitMode('By Item')}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              splitMode === 'By Item'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Split By Items
          </button>
        </div>

        {splitMode === 'Equal' ? (
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-600 block mb-1.5">
                Number of Ways to Split:
              </label>
              <div className="flex items-center space-x-3">
                {[2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    onClick={() => setSplitCount(num)}
                    className={`flex-1 py-2 rounded-lg font-extrabold text-sm border transition-all ${
                      splitCount === num
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                    }`}
                  >
                    {num} Ways
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Total Amount:</span>
                <span>₹{order.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-800 text-sm pt-2 border-t border-slate-200">
                <span>Each Person Pays ({splitCount} Person Split):</span>
                <span>₹{perHeadAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Each item will be assigned to individual split receipts. Total bill ₹{order.grandTotal.toFixed(2)}.
            </p>
            <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
              {order.items.map((it, idx) => (
                <div key={idx} className="py-2 flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-800">{it.quantity}x {it.itemName}</span>
                  <span className="font-bold text-slate-900">₹{it.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex space-x-2 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyEqualSplit}
            className="flex-1 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 shadow-xs"
          >
            Confirm & Apply Split
          </button>
        </div>
      </div>
    </div>
  );
}
