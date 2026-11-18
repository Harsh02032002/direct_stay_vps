import { useEffect, useState } from 'react';

export interface HotelTaxSettings {
  roomCgst: number;
  roomSgst: number;
  fnbCgst: number;
  fnbSgst: number;
  invoicePrefix: string;
  roomSacCode: string;
  fnbSacCode: string;
  laundrySacCode: string;
  invoiceTerms: string;
}

const STORAGE_KEY = 'pms_hotel_tax_settings_v1';
const EVENT_NAME = 'pms-tax-settings-updated';

export const DEFAULT_TAX_SETTINGS: HotelTaxSettings = {
  roomCgst: 2.5,
  roomSgst: 2.5,
  fnbCgst: 2.5,
  fnbSgst: 2.5,
  invoicePrefix: 'INV-2026-',
  roomSacCode: '996311',
  fnbSacCode: '996331',
  laundrySacCode: '999712',
  invoiceTerms:
    '1. Standard Check-out time is 11:00 AM.\n2. Subject to local jurisdiction.\n3. Goods & Services Tax (CGST + SGST) applied as per Government GST Council norms.',
};

export function getHotelTaxSettings(): HotelTaxSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TAX_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      roomCgst: parsed.roomCgst !== undefined ? Number(parsed.roomCgst) : DEFAULT_TAX_SETTINGS.roomCgst,
      roomSgst: parsed.roomSgst !== undefined ? Number(parsed.roomSgst) : DEFAULT_TAX_SETTINGS.roomSgst,
      fnbCgst: parsed.fnbCgst !== undefined ? Number(parsed.fnbCgst) : DEFAULT_TAX_SETTINGS.fnbCgst,
      fnbSgst: parsed.fnbSgst !== undefined ? Number(parsed.fnbSgst) : DEFAULT_TAX_SETTINGS.fnbSgst,
      invoicePrefix: parsed.invoicePrefix || DEFAULT_TAX_SETTINGS.invoicePrefix,
      roomSacCode: parsed.roomSacCode || DEFAULT_TAX_SETTINGS.roomSacCode,
      fnbSacCode: parsed.fnbSacCode || DEFAULT_TAX_SETTINGS.fnbSacCode,
      laundrySacCode: parsed.laundrySacCode || DEFAULT_TAX_SETTINGS.laundrySacCode,
      invoiceTerms: parsed.invoiceTerms || DEFAULT_TAX_SETTINGS.invoiceTerms,
    };
  } catch {
    return DEFAULT_TAX_SETTINGS;
  }
}

export function saveHotelTaxSettings(next: Partial<HotelTaxSettings>, hotelId = 'hotel-1'): HotelTaxSettings {
  const merged: HotelTaxSettings = {
    ...getHotelTaxSettings(),
    ...next,
  };
  merged.roomCgst = Math.max(0, Number(merged.roomCgst) || 0);
  merged.roomSgst = Math.max(0, Number(merged.roomSgst) || 0);
  merged.fnbCgst = Math.max(0, Number(merged.fnbCgst) || 0);
  merged.fnbSgst = Math.max(0, Number(merged.fnbSgst) || 0);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: merged }));
  } catch {
    // ignore storage errors
  }

  // Persist to MongoDB Atlas module collection in background
  try {
    const token = sessionStorage.getItem('pms_session_token') || '';
    const role = sessionStorage.getItem('pms_role') || 'Admin';
    fetch('/api/pms/modules/taxSettings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
        'x-user-role': role,
        'x-hotel-id': hotelId,
        'x-target-hotel-id': hotelId,
      },
      body: JSON.stringify({
        hotelId,
        items: [{ id: `tax-${hotelId}`, hotelId, ...merged }],
      }),
    }).catch(() => {});
  } catch {
    // non-blocking
  }

  return merged;
}

export function useHotelTaxSettings(): [
  HotelTaxSettings,
  (updates: Partial<HotelTaxSettings>) => void
] {
  const [settings, setSettings] = useState<HotelTaxSettings>(() => getHotelTaxSettings());

  useEffect(() => {
    const handler = () => setSettings(getHotelTaxSettings());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const updateSettings = (updates: Partial<HotelTaxSettings>) => {
    const updated = saveHotelTaxSettings(updates);
    setSettings(updated);
  };

  return [settings, updateSettings];
}
