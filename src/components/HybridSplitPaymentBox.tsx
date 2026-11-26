import React from 'react';
import { Plus, Trash2, Split } from 'lucide-react';

export interface HybridSplitRow {
  id: string;
  method: string;
  amount: string;
  reference?: string;
}

export const DEFAULT_HYBRID_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

export function createInitialHybridRows(totalAmount: number, modes: string[] = DEFAULT_HYBRID_MODES): HybridSplitRow[] {
  const safeTotal = Math.max(0, Math.round((Number(totalAmount) || 0) * 100) / 100);
  const half = Math.round((safeTotal / 2) * 100) / 100;
  const rest = Math.round((safeTotal - half) * 100) / 100;
  const m1 = modes[0] || 'Cash';
  const m2 = modes[1] || 'UPI';
  return [
    { id: `hyb-${Date.now()}-1`, method: m1, amount: safeTotal > 0 ? String(half) : '', reference: '' },
    { id: `hyb-${Date.now()}-2`, method: m2, amount: safeTotal > 0 ? String(rest) : '', reference: '' },
  ];
}

export function getValidHybridSplits(rows: HybridSplitRow[]): Array<{ method: string; amount: number; reference?: string }> {
  return rows
    .map((r) => ({
      method: r.method || 'Cash',
      amount: Math.round((parseFloat(r.amount) || 0) * 100) / 100,
      reference: r.reference?.trim() || undefined,
    }))
    .filter((r) => r.amount > 0);
}

export function getHybridTotal(rows: HybridSplitRow[]): number {
  return Math.round(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) * 100) / 100;
}

export function formatHybridLabel(rows: HybridSplitRow[]): string {
  const valid = getValidHybridSplits(rows);
  if (valid.length === 0) return 'Hybrid';
  return valid.map((r) => `${r.method} ₹${r.amount}`).join(' + ');
}

interface HybridSplitPaymentBoxProps {
  rows: HybridSplitRow[];
  onChange: (rows: HybridSplitRow[]) => void;
  modes?: string[];
  targetAmount?: number;
  compact?: boolean;
}

export const HybridSplitPaymentBox: React.FC<HybridSplitPaymentBoxProps> = ({
  rows,
  onChange,
  modes = DEFAULT_HYBRID_MODES,
  targetAmount,
  compact = false,
}) => {
  const total = getHybridTotal(rows);
  const diff = typeof targetAmount === 'number' && targetAmount > 0
    ? Math.round((targetAmount - total) * 100) / 100
    : null;

  return (
    <div className={`${compact ? 'p-2.5' : 'p-3'} bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 mt-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
          <Split className="w-3.5 h-3.5" /> Hybrid / Split Payment
        </span>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...rows,
              {
                id: `hyb-${Date.now()}-${rows.length + 1}`,
                method: modes[Math.min(rows.length, modes.length - 1)] || 'Card',
                amount: diff && diff > 0 ? String(diff) : '',
                reference: '',
              },
            ])
          }
          className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-0.5 cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add Method
        </button>
      </div>

      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-12 gap-1.5 items-center">
          <select
            value={row.method}
            onChange={(e) =>
              onChange(rows.map((r) => (r.id === row.id ? { ...r, method: e.target.value } : r)))
            }
            className="col-span-5 px-2 py-1.5 text-[11px] font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
          >
            {modes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="any"
            placeholder="Amount ₹"
            value={row.amount}
            onChange={(e) =>
              onChange(rows.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r)))
            }
            className="col-span-5 px-2 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
          />
          <div className="col-span-2 flex justify-end">
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                title="Remove row"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-1.5 border-t border-amber-200 text-[11px] font-bold">
        <span className="text-amber-900">Split Total: ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        {diff !== null && (
          <span className={Math.abs(diff) < 0.01 ? 'text-emerald-700' : 'text-rose-600'}>
            {Math.abs(diff) < 0.01 ? '✓ Matched' : diff > 0 ? `Remaining: ₹${diff}` : `Excess: ₹${Math.abs(diff)}`}
          </span>
        )}
      </div>
    </div>
  );
};

export default HybridSplitPaymentBox;
