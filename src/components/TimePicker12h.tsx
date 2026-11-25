import React, { useEffect, useState } from 'react';

interface TimePicker12hProps {
  /** Accepts either 12h ("03:38 PM") or 24h ("15:38") time string. */
  value: string;
  /** Emits (display12h e.g. "03:38 PM", hhmm24 e.g. "15:38"). */
  onChange: (display12h: string, hhmm24: string) => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}

const parseTimeParts = (raw: string): { hour12: number; minute: number; period: 'AM' | 'PM' } => {
  const s = String(raw || '').trim().toUpperCase();
  const m12 = s.match(/^(\d{1,2}):(\d{1,2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = Math.min(59, Math.max(0, parseInt(m12[2], 10) || 0));
    const p: 'AM' | 'PM' = m12[3] === 'PM' ? 'PM' : 'AM';
    if (h < 1 || h > 12) h = ((h % 12) || 12);
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
 * Clean 12-hour time input with explicit AM / PM selector so receptionists
 * never have to convert 24-hour times (like 15:38 -> 03:38 PM) manually.
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

  useEffect(() => {
    const p = parseTimeParts(value);
    setHourDraft(String(p.hour12).padStart(2, '0'));
    setMinuteDraft(String(p.minute).padStart(2, '0'));
    setPeriod(p.period);
  }, [value]);

  const emitChange = (nextH12: number, nextMin: number, nextPeriod: 'AM' | 'PM') => {
    const { display12h, hhmm24 } = formatOutputs(nextH12, nextMin, nextPeriod);
    onChange(display12h, hhmm24);
  };

  const handleHourChange = (rawVal: string) => {
    const digits = rawVal.replace(/\D/g, '').slice(0, 2);
    setHourDraft(digits);
    if (digits === '') return;
    const num = parseInt(digits, 10);
    if (num >= 1 && num <= 12) {
      emitChange(num, parseInt(minuteDraft, 10) || 0, period);
    } else if (num >= 13 && num <= 23) {
      // Smart assist: if user still types 15, auto-convert to 03 PM!
      const h12 = num - 12;
      setHourDraft(String(h12).padStart(2, '0'));
      setPeriod('PM');
      emitChange(h12, parseInt(minuteDraft, 10) || 0, 'PM');
    }
  };

  const handleHourBlur = () => {
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
    emitChange(safeH, parseInt(minuteDraft, 10) || 0, nextP);
  };

  const handleMinuteChange = (rawVal: string) => {
    const digits = rawVal.replace(/\D/g, '').slice(0, 2);
    setMinuteDraft(digits);
    if (digits === '') return;
    const num = parseInt(digits, 10);
    if (num >= 0 && num <= 59) {
      emitChange(parseInt(hourDraft, 10) || 12, num, period);
    }
  };

  const handleMinuteBlur = () => {
    const num = parseInt(minuteDraft, 10);
    const safeMin = Number.isNaN(num) ? 0 : Math.min(59, Math.max(0, num));
    setMinuteDraft(String(safeMin).padStart(2, '0'));
    emitChange(parseInt(hourDraft, 10) || 12, safeMin, period);
  };

  const handlePeriodChange = (nextPeriod: 'AM' | 'PM') => {
    setPeriod(nextPeriod);
    emitChange(parseInt(hourDraft, 10) || 12, parseInt(minuteDraft, 10) || 0, nextPeriod);
  };

  return (
    <div
      title={title || 'Enter 12-hour time & select AM / PM'}
      className={`inline-flex items-center justify-between gap-0.5 px-1.5 border border-[#DCE3EC] rounded-xl bg-white focus-within:border-[#C49A3A] focus-within:ring-1 focus-within:ring-[#C49A3A]/30 ${className}`}
    >
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={hourDraft}
        onFocus={e => e.currentTarget.select()}
        onChange={e => handleHourChange(e.target.value)}
        onBlur={handleHourBlur}
        aria-label="Hour (1 to 12)"
        placeholder="12"
        className="w-7 py-1.5 text-center text-xs font-mono font-bold text-[#263449] bg-transparent focus:outline-none"
      />
      <span className="text-xs font-mono font-extrabold text-slate-400 select-none">:</span>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={minuteDraft}
        onFocus={e => e.currentTarget.select()}
        onChange={e => handleMinuteChange(e.target.value)}
        onBlur={handleMinuteBlur}
        aria-label="Minute (00 to 59)"
        placeholder="00"
        className="w-7 py-1.5 text-center text-xs font-mono font-bold text-[#263449] bg-transparent focus:outline-none"
      />
      <select
        disabled={disabled}
        value={period}
        onChange={e => handlePeriodChange(e.target.value === 'PM' ? 'PM' : 'AM')}
        aria-label="AM or PM"
        className="ml-0.5 px-1.5 py-1 rounded-lg bg-[#FDF8ED] border border-[#E5D2A6] text-[11px] font-mono font-extrabold text-[#8B691E] focus:outline-none cursor-pointer"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
