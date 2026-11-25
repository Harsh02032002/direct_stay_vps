import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimePicker12hProps {
  /** Accepts either 12h ("03:38 PM") or 24h ("15:38") time string. */
  value: string;
  /** Emits (display12h e.g. "03:38 PM", hhmm24 e.g. "15:38"). */
  onChange: (display12h: string, hhmm24: string) => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES_ALL = Array.from({ length: 60 }, (_, i) => i);

const parseTimeParts = (raw: string): { hour12: number; minute: number; period: 'AM' | 'PM' } => {
  const s = String(raw || '').trim().toUpperCase();
  const m12 = s.match(/^(\d{1,2}):(\d{1,2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = Math.min(59, Math.max(0, parseInt(m12[2], 10) || 0));
    const p: 'AM' | 'PM' = m12[3] === 'PM' ? 'PM' : 'AM';
    if (h < 1 || h > 12) h = (h % 12) || 12;
    return { hour12: h, minute: min, period: p };
  }
  const m24 = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (m24) {
    const h24 = Math.min(23, Math.max(0, parseInt(m24[1], 10) || 0));
    const min = Math.min(59, Math.max(0, parseInt(m24[2], 10) || 0));
    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { hour12, minute: min, period };
  }
  return { hour12: 12, minute: 0, period: 'PM' };
};

const formatOutputs = (hour12: number, minute: number, period: 'AM' | 'PM') => {
  const safeH12 = Math.min(12, Math.max(1, hour12 || 12));
  const safeMin = Math.min(59, Math.max(0, minute || 0));
  let h24 = safeH12 % 12;
  if (period === 'PM') h24 += 12;
  const hh12Str = String(safeH12).padStart(2, '0');
  const mmStr = String(safeMin).padStart(2, '0');
  const hh24Str = String(h24).padStart(2, '0');
  return {
    display12h: `${hh12Str}:${mmStr} ${period}`,
    hhmm24: `${hh24Str}:${mmStr}`,
  };
};

/**
 * 12-hour time input with explicit AM / PM selector + visual Clock picker popover.
 * Typing is never overwritten mid-edit (no snap-back when typing "25" or "9").
 */
export default function TimePicker12h({
  value,
  onChange,
  className = '',
  title,
  disabled = false,
}: TimePicker12hProps) {
  const parsed = parseTimeParts(value);
  const [hourDraft, setHourDraft] = useState<string>(String(parsed.hour12).padStart(2, '0'));
  const [minuteDraft, setMinuteDraft] = useState<string>(String(parsed.minute).padStart(2, '0'));
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const isEditingHourRef = useRef(false);
  const isEditingMinuteRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external prop changes ONLY when the corresponding input is NOT actively being typed in
  useEffect(() => {
    const p = parseTimeParts(value);
    if (!isEditingHourRef.current) {
      setHourDraft(String(p.hour12).padStart(2, '0'));
    }
    if (!isEditingMinuteRef.current) {
      setMinuteDraft(String(p.minute).padStart(2, '0'));
    }
    setPeriod(p.period);
  }, [value]);

  // Close clock popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handleOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [popoverOpen]);

  const emitChange = (nextH12: number, nextMin: number, nextPeriod: 'AM' | 'PM') => {
    const { display12h, hhmm24 } = formatOutputs(nextH12, nextMin, nextPeriod);
    onChange(display12h, hhmm24);
  };

  const currentHourNum = () => {
    const n = parseInt(hourDraft, 10);
    return Number.isNaN(n) || n <= 0 ? parsed.hour12 : Math.min(12, n);
  };

  const currentMinuteNum = () => {
    const n = parseInt(minuteDraft, 10);
    return Number.isNaN(n) ? parsed.minute : Math.min(59, Math.max(0, n));
  };

  const handleHourChange = (rawVal: string) => {
    let digits = rawVal.replace(/\D/g, '');
    // If user typed a new digit without selecting all (e.g. "04" -> "049"), start fresh with the newly typed digit ("9")!
    if (digits.length > 2) {
      digits = digits.slice(-1);
    }
    setHourDraft(digits);
    if (digits === '') return;

    const num = parseInt(digits, 10);
    if (num >= 1 && num <= 12) {
      emitChange(num, currentMinuteNum(), period);
    } else if (num >= 13 && num <= 23) {
      // Smart assist: typing 15 converts to 03 PM
      const h12 = num - 12;
      setHourDraft(String(h12).padStart(2, '0'));
      setPeriod('PM');
      emitChange(h12, currentMinuteNum(), 'PM');
    }
  };

  const handleHourBlur = () => {
    isEditingHourRef.current = false;
    const num = parseInt(hourDraft, 10);
    let safeH = Number.isNaN(num) || num <= 0 ? 12 : num;
    let nextP = period;
    if (safeH >= 13 && safeH <= 23) {
      safeH = safeH - 12;
      nextP = 'PM';
      setPeriod('PM');
    } else if (safeH > 12) {
      safeH = 12;
    }
    setHourDraft(String(safeH).padStart(2, '0'));
    emitChange(safeH, currentMinuteNum(), nextP);
  };

  const handleMinuteChange = (rawVal: string) => {
    let digits = rawVal.replace(/\D/g, '');
    // If user typed a new digit without selecting all (e.g. "29" -> "292"), start fresh with the newly typed digit ("2")!
    if (digits.length > 2) {
      digits = digits.slice(-1);
    }
    setMinuteDraft(digits);
    if (digits === '') return;

    const num = parseInt(digits, 10);
    if (num >= 0 && num <= 59) {
      emitChange(currentHourNum(), num, period);
    }
  };

  const handleMinuteBlur = () => {
    isEditingMinuteRef.current = false;
    const num = parseInt(minuteDraft, 10);
    const safeMin = Number.isNaN(num) ? 0 : Math.min(59, Math.max(0, num));
    setMinuteDraft(String(safeMin).padStart(2, '0'));
    emitChange(currentHourNum(), safeMin, period);
  };

  const handlePeriodChange = (nextPeriod: 'AM' | 'PM') => {
    setPeriod(nextPeriod);
    emitChange(currentHourNum(), currentMinuteNum(), nextPeriod);
  };

  const applyClockPick = (h12: number, min: number, per: 'AM' | 'PM') => {
    isEditingHourRef.current = false;
    isEditingMinuteRef.current = false;
    setHourDraft(String(h12).padStart(2, '0'));
    setMinuteDraft(String(min).padStart(2, '0'));
    setPeriod(per);
    emitChange(h12, min, per);
  };

  const activeH = currentHourNum();
  const activeM = currentMinuteNum();

  return (
    <div
      ref={containerRef}
      title={title || 'Type 12-hour time or click clock icon to pick (AM / PM)'}
      className={`relative inline-flex items-center justify-between gap-0.5 px-1.5 border border-[#DCE3EC] rounded-xl bg-white focus-within:border-[#C49A3A] focus-within:ring-1 focus-within:ring-[#C49A3A]/30 shrink-0 ${className}`}
    >
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={hourDraft}
        onFocus={e => {
          isEditingHourRef.current = true;
          e.currentTarget.select();
        }}
        onChange={e => handleHourChange(e.target.value)}
        onBlur={handleHourBlur}
        aria-label="Hour (1 to 12)"
        placeholder="12"
        className="w-6 py-1.5 text-center text-xs font-mono font-bold text-[#263449] bg-transparent focus:outline-none"
      />
      <span className="text-xs font-mono font-extrabold text-slate-400 select-none">:</span>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={minuteDraft}
        onFocus={e => {
          isEditingMinuteRef.current = true;
          e.currentTarget.select();
        }}
        onChange={e => handleMinuteChange(e.target.value)}
        onBlur={handleMinuteBlur}
        aria-label="Minute (00 to 59)"
        placeholder="00"
        className="w-6 py-1.5 text-center text-xs font-mono font-bold text-[#263449] bg-transparent focus:outline-none"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => handlePeriodChange(period === 'AM' ? 'PM' : 'AM')}
        aria-label="Toggle AM or PM"
        title="Click to switch AM / PM"
        className="px-1.5 py-1 rounded-md bg-[#FDF8ED] hover:bg-[#F5E7C1] border border-[#E5D2A6] text-[10.5px] font-mono font-extrabold text-[#8B691E] focus:outline-none cursor-pointer transition-colors shrink-0"
      >
        {period}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setPopoverOpen(prev => !prev)}
        aria-label="Open Time Picker"
        title="Click to select time"
        className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
          popoverOpen
            ? 'bg-[#F6E9C8] text-[#8B691E]'
            : 'text-slate-500 hover:bg-[#FDF8ED] hover:text-[#8B691E]'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
      </button>

      {/* VISUAL 12-HOUR CLOCK PICKER POPOVER (Light Luxury Theme) */}
      {popoverOpen && !disabled && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-white border border-[#DFC07A] rounded-2xl shadow-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#EFE6D2] pb-1.5">
            <span className="text-[11px] font-serif font-bold text-[#263449] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C49A3A]" />
              Select Time
            </span>
            <span className="text-[11px] font-mono font-extrabold text-[#8B691E] bg-[#FDF6E3] px-2 py-0.5 rounded-md border border-[#E5D2A6]">
              {String(activeH).padStart(2, '0')}:{String(activeM).padStart(2, '0')} {period}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            {/* Hours Column */}
            <div>
              <span className="text-[9.5px] font-mono font-bold uppercase text-slate-400 block mb-1">Hr</span>
              <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5">
                {HOURS_12.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => applyClockPick(h, activeM, period)}
                    className={`w-full py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                      activeH === h
                        ? 'bg-[#C49A3A] text-white shadow-2xs'
                        : 'text-[#263449] hover:bg-[#FDF6E3]'
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div>
              <span className="text-[9.5px] font-mono font-bold uppercase text-slate-400 block mb-1">Min</span>
              <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5">
                {MINUTES_ALL.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyClockPick(activeH, m, period)}
                    className={`w-full py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                      activeM === m
                        ? 'bg-[#C49A3A] text-white shadow-2xs'
                        : m % 5 === 0
                        ? 'text-[#263449] hover:bg-[#FDF6E3]'
                        : 'text-slate-500 hover:bg-[#FDF6E3]'
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            {/* AM / PM Column */}
            <div>
              <span className="text-[9.5px] font-mono font-bold uppercase text-slate-400 block mb-1">AM/PM</span>
              <div className="space-y-1.5 pt-1">
                {(['AM', 'PM'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyClockPick(activeH, activeM, p)}
                    className={`w-full py-2 rounded-lg text-xs font-mono font-extrabold cursor-pointer border transition-colors ${
                      period === p
                        ? 'bg-[#FDF6E3] border-[#C49A3A] text-[#7A5915] shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Hotel Time Presets + Done */}
          <div className="pt-2 border-t border-[#EFE6D2] flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const h24 = now.getHours();
                  const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
                  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                  applyClockPick(h12, now.getMinutes(), p);
                }}
                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-[#FDF6E3] text-[10px] font-bold text-[#263449] cursor-pointer"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => applyClockPick(12, 0, 'PM')}
                className="px-1.5 py-1 rounded-md bg-slate-100 hover:bg-[#FDF6E3] text-[10px] font-bold text-[#263449] cursor-pointer"
              >
                12 PM
              </button>
              <button
                type="button"
                onClick={() => applyClockPick(11, 0, 'AM')}
                className="px-1.5 py-1 rounded-md bg-slate-100 hover:bg-[#FDF6E3] text-[10px] font-bold text-[#263449] cursor-pointer"
              >
                11 AM
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-[#C49A3A] hover:bg-[#A8812B] text-white text-[10.5px] font-extrabold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
