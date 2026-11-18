import React, { useEffect, useState } from 'react';

interface QuickDateInputProps {
  /** ISO date string (YYYY-MM-DD) or '' */
  value: string;
  onChange: (isoValue: string) => void;
  className?: string;
  minYear?: number;
  maxYear?: number;
}

const isoToDisplay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const formatDigits = (digits: string) => {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/**
 * Fast keyboard-friendly date field. Type digits only (e.g. 15081990) and it auto-formats to
 * DD/MM/YYYY. Avoids the slow native year-scroll calendar popup. Emits ISO (YYYY-MM-DD).
 */
export default function QuickDateInput({ value, onChange, className, minYear = 1900, maxYear }: QuickDateInputProps) {
  const [text, setText] = useState(isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const topYear = maxYear ?? new Date().getFullYear() + 10;

  useEffect(() => {
    // Sync when parent resets / autofills the value
    if (isoToDisplay(value) !== text && (value || !text || text.length === 10)) {
      setText(isoToDisplay(value));
      setInvalid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const formatted = formatDigits(digits);
    setText(formatted);

    if (digits.length === 0) {
      setInvalid(false);
      onChange('');
      return;
    }
    if (digits.length < 8) {
      setInvalid(false);
      if (value) onChange('');
      return;
    }

    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4, 8));
    const dt = new Date(yyyy, mm - 1, dd);
    const valid =
      yyyy >= minYear &&
      yyyy <= topYear &&
      dt.getFullYear() === yyyy &&
      dt.getMonth() === mm - 1 &&
      dt.getDate() === dd;

    if (!valid) {
      setInvalid(true);
      onChange('');
      return;
    }
    setInvalid(false);
    onChange(`${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
  };

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="DD/MM/YYYY"
        maxLength={10}
        className={`${className || ''} ${invalid ? '!border-rose-500' : ''}`}
      />
      {invalid && <span className="text-[10px] text-rose-600 font-mono">Invalid date (DD/MM/YYYY)</span>}
    </div>
  );
}
