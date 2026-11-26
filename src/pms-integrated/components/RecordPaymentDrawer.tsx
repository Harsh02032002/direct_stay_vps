import React, { useState, useEffect } from 'react';
import { X, IndianRupee, CheckCircle2, Plus, Trash2, Split } from 'lucide-react';
import { BookingRecord, PaymentMethod } from '../types';
import { formatINRDecimal } from '../utils/formatters';

export interface SplitPaymentEntry {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface RecordPaymentDrawerProps {
  booking: BookingRecord | null;
  onClose: () => void;
  onSavePayment: (
    bookingId: string,
    amount: number,
    method: PaymentMethod,
    transactionId: string,
    dateStr: string,
    completeCheckout?: boolean,
    splitEntries?: SplitPaymentEntry[]
  ) => void;
}

export default function RecordPaymentDrawer({
  booking,
  onClose,
  onSavePayment,
}: RecordPaymentDrawerProps) {
  const getFormattedNow = () => {
    const d = new Date();
    return `${d.toISOString().slice(0, 10)} ${d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase()}`;
  };

  const [amount, setAmount] = useState<number>(500);
  const [settleFull, setSettleFull] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [customModeName, setCustomModeName] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [isHybridMode, setIsHybridMode] = useState<boolean>(false);
  const [splitRows, setSplitRows] = useState<Array<{ id: string; method: PaymentMethod; amount: string; reference: string }>>([
    { id: 'sp-1', method: 'Cash', amount: '', reference: '' },
    { id: 'sp-2', method: 'UPI', amount: '', reference: '' },
  ]);
  const [paymentDate, setPaymentDate] = useState<string>(getFormattedNow);
  const [transactionId, setTransactionId] = useState<string>('');

  useEffect(() => {
    if (booking) {
      const initialAmt = Math.min(500, Math.max(0, booking.dueAmount)) || booking.dueAmount;
      setSettleFull(false);
      setAmount(initialAmt);
      setIsHybridMode(false);
      setIsCustomMode(false);
      setCustomModeName('');
      setPaymentMethod('Cash');
      setSplitRows([
        { id: 'sp-1', method: 'Cash', amount: String(Math.round((initialAmt / 2) * 100) / 100), reference: '' },
        { id: 'sp-2', method: 'UPI', amount: String(Math.round((initialAmt - Math.round((initialAmt / 2) * 100) / 100) * 100) / 100), reference: '' },
      ]);
      setPaymentDate(getFormattedNow());
      setTransactionId(`TXN-${Math.floor(100000 + Math.random() * 900000)}`);
    }
  }, [booking]);

  if (!booking) return null;

  const hybridTotal = Math.round(
    splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) * 100
  ) / 100;

  const handleToggleSettle = (checked: boolean) => {
    setSettleFull(checked);
    if (checked) {
      const fullDue = Number(booking.dueAmount.toFixed(2));
      setAmount(fullDue);
      if (isHybridMode && splitRows.length >= 2) {
        const half = Math.round((fullDue / 2) * 100) / 100;
        const rest = Math.round((fullDue - half) * 100) / 100;
        setSplitRows((prev) =>
          prev.map((r, idx) =>
            idx === 0 ? { ...r, amount: String(half) } : idx === 1 ? { ...r, amount: String(rest) } : { ...r, amount: '0' }
          )
        );
      }
    }
  };

  const handleSubmit = (completeCheckout = false) => {
    if (isHybridMode) {
      const validSplits: SplitPaymentEntry[] = splitRows
        .map((r) => ({
          method: r.method,
          amount: Math.round((parseFloat(r.amount) || 0) * 100) / 100,
          reference: r.reference.trim() || undefined,
        }))
        .filter((r) => r.amount > 0);
      if (validSplits.length === 0) return;
      const totalSplitAmt = Math.round(validSplits.reduce((s, r) => s + r.amount, 0) * 100) / 100;
      const summaryMethod = validSplits.map((s) => s.method).join(' + ') as PaymentMethod;
      onSavePayment(
        booking.id,
        totalSplitAmt,
        summaryMethod,
        transactionId || `HYB-${Date.now().toString().slice(-4)}`,
        paymentDate,
        completeCheckout,
        validSplits
      );
      return;
    }
    if (amount <= 0) return;
    const effectiveMethod = (isCustomMode && customModeName.trim() ? customModeName.trim() : paymentMethod) as PaymentMethod;
    onSavePayment(
      booking.id,
      Number(amount),
      effectiveMethod,
      transactionId || `CASH-${Date.now().toString().slice(-4)}`,
      paymentDate,
      completeCheckout
    );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between p-6 animate-fade-in">
        <div className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Header matching video 05:45 & 09:10 */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-[#17120F]">
                Record Payment for Booking {booking.bookingNo}
              </h3>
              <p className="text-xs font-bold text-rose-600 mt-0.5">
                Due : {formatINRDecimal(booking.dueAmount)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount + Settle Checkbox */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Amount*</label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settleFull}
                  onChange={(e) => handleToggleSettle(e.target.checked)}
                />
                <span>Settle Full Due</span>
              </label>
            </div>
            <div className="relative">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="number"
                step="any"
                value={isHybridMode ? hybridTotal : amount}
                readOnly={isHybridMode}
                onChange={(e) => setAmount(Number(e.target.value))}
                className={`w-full pl-8 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl ${isHybridMode ? 'bg-slate-50 text-slate-700' : ''}`}
              />
            </div>
          </div>

          {/* Payment Method - Dynamic modes + Hybrid Split */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">Payment Mode / Account*</label>
              <button
                type="button"
                onClick={() => {
                  setIsHybridMode(false);
                  setIsCustomMode(!isCustomMode);
                  if (!isCustomMode && !customModeName) setCustomModeName('HDFC Current A/c');
                }}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
              >
                {isCustomMode ? 'Use Standard Mode' : '+ Add Custom Bank / A/c'}
              </button>
            </div>
            
            {isCustomMode ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={customModeName}
                  onChange={(e) => setCustomModeName(e.target.value)}
                  placeholder="e.g. HDFC Current A/c - Hotel, ICICI Bank, QR"
                  className="w-full px-3 py-2 text-xs font-bold border-2 border-amber-400 bg-amber-50/40 rounded-xl focus:outline-none"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400">Custom payment account name recorded on invoice ledger.</p>
              </div>
            ) : (
              <select
                value={isHybridMode ? '__HYBRID__' : paymentMethod}
                onChange={(e) => {
                  if (e.target.value === '__HYBRID__') {
                    setIsHybridMode(true);
                    const targetAmt = amount > 0 ? amount : Number(booking.dueAmount.toFixed(2));
                    const half = Math.round((targetAmt / 2) * 100) / 100;
                    const rest = Math.round((targetAmt - half) * 100) / 100;
                    setSplitRows([
                      { id: `sp-${Date.now()}-1`, method: 'Cash', amount: String(half), reference: '' },
                      { id: `sp-${Date.now()}-2`, method: 'UPI', amount: String(rest), reference: '' },
                    ]);
                  } else if (e.target.value === 'CUSTOM_NEW') {
                    setIsHybridMode(false);
                    setIsCustomMode(true);
                    setCustomModeName('');
                  } else {
                    setIsHybridMode(false);
                    setPaymentMethod(e.target.value as PaymentMethod);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI (PhonePe / GPay / QR)</option>
                <option value="Card">Credit / Debit Card (POS)</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                <option value="HDFC Bank Current A/c">HDFC Bank Current A/c</option>
                <option value="ICICI Bank A/c">ICICI Bank A/c</option>
                <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
                <option value="__HYBRID__">⇄ Hybrid / Split Payment (Multiple Modes)</option>
                <option value="CUSTOM_NEW">+ Type Custom Bank Account / Name...</option>
              </select>
            )}

            {isHybridMode && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Split className="w-3.5 h-3.5" /> Split Payment Breakdown
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSplitRows((prev) => [
                        ...prev,
                        { id: `sp-${Date.now()}`, method: 'Card', amount: '', reference: '' },
                      ])
                    }
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Method
                  </button>
                </div>

                {splitRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <select
                      value={row.method}
                      onChange={(e) =>
                        setSplitRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, method: e.target.value as PaymentMethod } : r))
                        )
                      }
                      className="col-span-5 px-2 py-1.5 text-[11px] font-semibold border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="HDFC Bank Current A/c">HDFC Current A/c</option>
                      <option value="ICICI Bank A/c">ICICI Bank A/c</option>
                      <option value="State Bank of India (SBI)">SBI Bank</option>
                    </select>
                    <input
                      type="number"
                      step="any"
                      placeholder="Amount"
                      value={row.amount}
                      onChange={(e) =>
                        setSplitRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r))
                        )
                      }
                      className="col-span-5 px-2 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white"
                    />
                    <div className="col-span-2 flex justify-end">
                      {splitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitRows((prev) => prev.filter((r) => r.id !== row.id))}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                          title="Remove split row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1.5 border-t border-amber-200 text-[11px] font-bold">
                  <span className="text-amber-900">Split Total:</span>
                  <span className="font-mono text-emerald-700">{formatINRDecimal(hybridTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Payment Date*</label>
            <input
              type="text"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl"
            />
          </div>

          {/* Transaction ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Transaction ID</label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Transaction ID / Receipt Reference"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="w-full py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md cursor-pointer"
          >
            Save Payment
          </button>
          {booking.isCheckedIn && !booking.isCheckedOut && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Pay and Complete Booking (Checkout)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
